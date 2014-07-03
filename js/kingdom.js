(function ()
{
    "use strict";
    
    var board = BOARD("board"),
        game = {},
        zobrist_keys,
        stalemate_by_rules,
        engine,
        evaler,
        ai_thinking = 0,
        discard_move = 0,
        loading_el,
        starting_new_game;
    
    function array_remove(arr, i, order_irrelevant)
    {
        var len = arr.length;
        
        /// Handle negative numbers.
        if (i < 0) {
            i = len + i;
        }
        
        /// If the last element is to be removed, then all we need to do is pop it off.
        ///NOTE: This is always the fastest method and it is orderly too.
        if (i === len - 1) {
            arr.pop();
        /// If the second to last element is to be removed, we can just pop off the last one and replace the second to last one with it.
        ///NOTE: This is always the fastest method and it is orderly too.
        } else if (i === len - 2) {
            arr[len - 2] = arr.pop();
        /// Can use we the faster (but unorderly) remove method?
        } else if (order_irrelevant || i === len - 2) {
            if (i >= 0 && i < len) {
                /// This works by popping off the last array element and using that to replace the element to be removed.
                arr[i] = arr.pop();
            }
        } else {
            /// The first element can be quickly shifted off.
            if (i === 0) {
                arr.shift();
            /// Ignore numbers that are still negative.
            ///NOTE: By default, if a number is below the total array count (e.g., array_remove([0,1], -3)), splice() will remove the first element.
            ///      This behavior is undesirable because it is unexpected.
            } else if (i > 0) {
                /// Use the orderly, but slower, splice method.
                arr.splice(i, 1);
            }
        }
    }
    
    function error(str)
    {
        str = str || "Unknown error";
        
        alert("An error occured.\n" + str);
        throw new Error(str);
    }
    
    function load_engine()
    {
        var worker = new Worker("js/stockfish.js"),
            engine = {},
            que = [];
        
        function get_first_word(line)
        {
            return line.substr(0, line.indexOf(" "));
        }
        
        function determine_que_num(line, que)
        {
            var cmd_type,
                first_word = get_first_word(line),
                cmd_first_word,
                i,
                len;
            
            if (first_word === "uciok" || first_word === "option") {
                cmd_type = "uci"
            } else if (first_word === "readyok") {
                cmd_type = "isready";
            } else if (first_word === "bestmove" || first_word === "info") {
                cmd_type = "go";
            } else {
                /// eval and d are more difficult.
                cmd_type = "other";
            }
            
            len = que.length;
            
            for (i = 0; i < len; i += 1) {
                cmd_first_word = get_first_word(que[i].cmd);
                if (cmd_first_word === cmd_type || (cmd_type === "other" && (cmd_first_word === "d" || cmd_first_word === "eval"))) {
                    return i;
                }
            }
            
            /// Not sure; just go with the first one.
            return 0;
        }
        
        worker.onmessage = function (e)
        {
            var line = e.data,
                done,
                que_num = 0,
                my_que;
            
            /// Stream everything to this, even invalid lines.
            if (engine.stream) {
                engine.stream(line);
            }
            
            /// Ignore invalid setoption commands since valid ones do not repond.
            if (line.substr(0, 14) === "No such option") {
                return;
            }
            
            que_num = determine_que_num(line, que);
            
            my_que = que[que_num];
            
            if (my_que.stream) {
                my_que.stream(line);
            }
            
            if (typeof my_que.message === "undefined") {
                my_que.message = "";
            } else if (my_que.message !== "") {
                my_que.message += "\n";
            }
            
            my_que.message += line;
            
            /// Try to determine if the stream is done.
            if (line === "uciok") {
                /// uci
                done = true;
                engine.loaded = true;
            } else if (line === "readyok") {
                /// isready
                done = true;
                engine.ready = true;
            } else if (line.substr(0, 8) === "bestmove") {
                /// go [...]
                done = true;
                /// All "go" needs is the last line (use stream to get more)
                my_que.message = line;
            } else if (my_que.cmd === "d" && line.substr(0, 15) === "Legal uci moves") {
                done = true;
            } else if (my_que.cmd === "eval" && /Total Evaluation[\s\S]+\n$/.test(my_que.message)) {
                done = true;
            } else if (line.substr(0, 15) === "Unknown command") {
                done = true;
            }
            ///NOTE: Stockfish.js does not support the "debug" or "register" commands.
            ///TODO: Add support for "perft", "bench", and "key" commands.
            ///TODO: Get welcome message so that it does not get caught with other messages.
            ///TODO: Prevent (or handle) multiple messages from different commands
            ///      E.g., "go depth 20" followed later by "uci"
            
            if (done) {
                if (my_que.cb) {
                    my_que.cb(my_que.message);
                }
                
                /// Remove this from the que.
                array_remove(que, que_num);
            }
        };
        
        engine.send = function send(cmd, cb, stream)
        {
            cmd = String(cmd).trim();
            
            /// Can't quit. This is a browser.
            if (cmd === "quit") {
                return;
            }
            
            console.log(cmd);
            
            /// Only add a que for commands that always print.
            ///NOTE: setoption may or may not print a statement.
            if (cmd !== "ucinewgame" && cmd !== "flip" && cmd !== "stop" && cmd !== "ponderhit" && cmd.substr(0, 8) !== "position"  && cmd.substr(0, 9) !== "setoption") {
                que[que.length] = {
                    cmd: cmd,
                    cb: cb,
                    stream: stream
                };
            }
            worker.postMessage(cmd);
        };
        
        return engine;
    }
    
    function onresize()
    {
        var w = window.innerWidth,
            h = window.innerHeight;
        
        if (w > h) {
            w = h
        } else {
            h = w;
        }
        
        board.size_board(w * .9, h * .9);
    }
    
    function get_legal_moves(cb)
    {
        engine.send("d", function ond(str)
        {
            var san = str.match(/Legal moves\:(.*)/),
                uci = str.match(/Legal uci moves\:(.*)/),
                key = str.match(/Key\: (\S+)/),
                fen = str.match(/Fen\: (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/),
                checkers = str.match(/Checkers\:(.*)/),
                res;
            
            if (!san || !uci || !checkers || !key) {
                error("Invalid d response: \n" + str);
            }
            
            res = {
                san: san[1].trim().split(" "),
                uci: uci[1].trim().split(" "),
                key: key[1],
                checkers: checkers[1].trim().split(" "),
            };
            
            if (fen) {
                res.fen = {
                    placement: fen[1],
                    turn: fen[2],
                    castling_ability: fen[3],
                    en_passant: fen[4],
                    half_move_clock: fen[5],
                    full_move_counter: fen[6],
                };
            }
            
            if (res.san.length === 1 && res.san[0] === "") {
                res.san = [];
            }
            if (res.uci.length === 1 && res.uci[0] === "") {
                res.uci = [];
            }
            if (res.checkers.length === 1 && res.checkers[0] === "") {
                res.checkers = [];
            }
            
            cb(res);
            
        });
    }
    
    function is_stalemate_by_rule(fen, key)
    {
        var i,
            count = 1,
            piece_counts = {
                knights: 0,
                bishops: 0,
                light_bishops: 0
            },
            piece_type;
        
        /// Check 50 move rull
        if (fen.half_move_clock > 99) {
            return "50";
        }
        
        /// Check three-fold repition
        if (!key) {
            key = zobrist_keys[zobrist_keys.length - 1];
            ///NOTE: The last move and this one cannot be the same since a different player has moved.
            i = zobrist_keys.length - 2;
        } else {
            i = zobrist_keys.length - 1;
        }
        ///TODO: Delete keys after a capture, pawn movement, or castling abilities change.
        for (; i >= 0; i -= 1) {
            if (key === zobrist_keys[i]) {
                count += 1;
                if (count === 3) {
                    return "3";
                }
            }
        }
        
        /// Check insufficient material
        /// 1. Only Kings
        /// 2. Kings and one knight
        /// 3. Kings and any number of bishops on either or one side all of which are on the same color
        ///NOTE: Could examine the fen position too, but it would take a little more work to determine bishop color.
        if (board.pieces) {
            for (i = board.pieces.length - 1; i >= 0; i -= 1) {
                if (!board.pieces[i].captured) {
                    piece_type = board.pieces[i].type;
                    if (piece_type === "p" || piece_type === "r" || piece_type === "q") {
                        piece_counts.others = 1;
                        break;
                        /// We found a mating piece. Stop now.
                    } else if (piece_type === "n") {
                        piece_counts.knights += 1;
                    } else if (piece_type === "b") {
                        piece_counts.bishops += 1;
                        if ((board.pieces[i].rank + board.pieces[i].file) % 2) {
                            piece_counts.light_bishops += 1;
                        }
                    }
                }
            }
            if (!piece_counts.others && ((!piece_counts.knights && !piece_counts.bishops) || ((piece_counts.knights === 1 && !piece_counts.bishops) ||(!piece_counts.knights && (piece_counts.light_bishops === 0 || (piece_counts.bishops === piece_counts.light_bishops)))))) {
                return "material";
            }
        }
    }
    
    function set_legal_moves(cb)
    {
        get_legal_moves(function onget(moves)
        {
            zobrist_keys.push(moves.key);
            
            stalemate_by_rules = is_stalemate_by_rule(moves.fen);
            /// Is the game still on?
            
            ///TODO: Only AI should automatically claim 50 move rule. (And probably not the lower levels).
            if (moves.uci.length && !stalemate_by_rules) {
                board.legal_moves = moves;
                if (cb) {
                    cb();
                }
            } else {
                board.legal_moves = [];
                if (board.mode === "play") {
                    /// Was it checkmate?
                    if (moves.checkers.length && !stalemate_by_rules) {
                        alert((board.turn === "b" ? "Black" : "White") + " is checkmated!");
                    } else {
                        if (stalemate_by_rules) {
                            if (stalemate_by_rules === "50") {
                                alert("Stalemate: 50 move rule");
                            } else if (stalemate_by_rules === "3") {
                                alert("Stalemate: Three-fold repetition");
                            } else if (stalemate_by_rules === "material") {
                                alert("Stalemate: Insufficient material");
                            }
                        } else {
                            alert("Stalemate!");
                        }
                    }
                    board.wait();
                }
            }
        });
    }
    
    function onengine_move(str)
    {
        var res = str.match(/^bestmove\s(\S+)(?:\sponder\s(\S+))?/);
        
        ai_thinking -= 1;
        
        if (discard_move) {
            discard_move -= 1;
            if (discard_move < 0) {
                console.log("Too many discard_move's: " + discard_move);
                discard_move = 0;
            }
            return;
        }
        
        if (!res) {
            error("Can't get move: " + str);
        }
        
        ///TODO: Allow ponder.
        game.ai_ponder = res[2];
        
        board.move(res[1]);
        set_ai_position();
        
        set_legal_moves(tell_engine_to_move);
    }
    
    function onthinking(str)
    {
        //console.log("thinking: " + str);
    }
    
    function set_ai_position()
    {
        var cmd = "position startpos";
        
        if (board.moves && board.moves.length) {
            cmd += " moves " + board.moves.join(" ");
        }
        
        engine.send(cmd);
    }
    
    function tell_engine_to_move()
    {
        if (board.players[board.turn].type === "ai") {
            ai_thinking += 1;
            //uciCmd("go " + (time.depth ? "depth " + time.depth : "") + " wtime " + time.wtime + " winc " + time.winc + " btime " + time.btime + " binc " + time.binc);
            /// Without time, it thinks really fast.
            engine.send("go " + (typeof engine.depth !== "undefined" ? "depth " + engine.depth : "") + " wtime 100000 btime 100000" , onengine_move, onthinking);
            return true;
        }
    }
    
    function onmove(move)
    {
        set_ai_position();
        
        ///NOTE: We need to get legal moves (even for AI) because we need to know if a move is castling or not.
        set_legal_moves(tell_engine_to_move);
    }
    
    function stop_ai()
    {
        if (ai_thinking) {
            discard_move += 1;
            engine.send("stop");
        }
    }
    
    function start_new_game()
    {
        if (!engine.ready || starting_new_game) {
            return;
        }
        
        starting_new_game = true;
        
        zobrist_keys = [];
        stalemate_by_rules = null;
        
        engine.send("ucinewgame");
        
        if (board.messy) {
            board.set_board();
        }
        
        stop_ai();
        set_ai_position();
        
        set_legal_moves(function onset()
        {
            loading_el.classList.add("hidden");
            board.play();
            tell_engine_to_move();
            starting_new_game = false;
        });
    }
    
    function init()
    {
        onresize();
        
        window.addEventListener("resize", onresize);
        
        loading_el = document.createElement("div");
        
        loading_el.textContent = "Loading...";
        loading_el.classList.add("loading");
        
        document.documentElement.appendChild(loading_el);
        
        board.wait();
        
        board.onmove = onmove;
        
        engine = load_engine();
        evaler = load_engine();
        
        engine.send("uci", function onuci(str)
        {
            engine.send("isready", function onready()
            {
                console.log("ready");
                start_new_game();
            });
        });
    }
    
    window.addEventListener("keydown", function catch_key(e)
    {
        if (e.keyCode === 113) { /// F2
            start_new_game();
        }
    });
    
    init();
}());

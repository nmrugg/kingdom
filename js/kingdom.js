(function ()
{
    "use strict";
    
    var board = BOARD("board"),
        game = {},
        engine,
        evaler,
        loading_el;
    
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
            que = [],
            cur_message = "";
        
        worker.onmessage = function (e)
        {
            var line = e.data,
                done;
            //var obj = que.shift();
            
            /// Stream everything to this, even invalid lines.
            if (engine.stream) {
                engine.stream(line);
            }
            
            /// Ignore invalid setoption commands since valid ones do not repond.
            if (line.substr(0, 14) === "No such option") {
                return;
            }
            
            if (que[0].stream) {
                que[0].stream(line);
            }
            
            if (cur_message !== "") {
                cur_message += "\n";
            }
            
            cur_message += line;
            
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
                cur_message = line;
            } else if (que[0].cmd === "d" && line.substr(0, 15) === "Legal uci moves") {
                done = true;
            } else if (que[0].cmd === "eval" && /Total Evaluation[\s\S]+\n$/.test(cur_message)) {
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
                if (que[0].cb) {
                    que[0].cb(cur_message);
                }
                cur_message = "";
                /// Remove this from the que.
                que.shift();
            }
        };
        
        engine.send = function send(cmd, cb, stream)
        {
            cmd = String(cmd).trim();
            
            /// Can't quit. This is a browser.
            if (cmd === "quit") {
                return;
            }
            
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
                checkers = str.match(/Checkers\:(.*)/),
                fen = str.match(/Fen\: (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/),
                res;
            
            if (!san || !uci || !checkers) {
                error("Invalid d response: \n" + str);
            }
            
            res = {
                san: san[1].trim().split(" "),
                uci: uci[1].trim().split(" "),
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
    
    function is_stalemate_by_rule(fen)
    {
        if (fen.half_move_clock > 99) {
            return "50";
        }
    }
    
    function set_legal_moves(cb)
    {
        get_legal_moves(function onget(moves)
        {
            var stalemate_by_rules = is_stalemate_by_rule(moves.fen);
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
        var res = str.match(/^bestmove\s(\S+)(?:\sponder\s(\S+))?/)
        
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
        engine.send("position startpos moves " + board.moves.join(" "));
    }
    
    function tell_engine_to_move()
    {
        if (board.players[board.turn].type === "ai") {
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
    
    function start_new_game()
    {
        board.moves = [];
        
        engine.send("ucinewgame");
        
        set_legal_moves(function onset()
        {
            loading_el.classList.add("hidden");
            board.play();
            tell_engine_to_move();
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
    
    init();
}());

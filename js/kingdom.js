(function ()
{
    "use strict";
    
    var board = BOARD("board"),
        game = {},
        zobrist_keys,
        stalemate_by_rules,
        evaler,
        loading_el,
        player1_el = document.createElement("div"),
        player2_el = document.createElement("div"),
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
            engine = {
                ai_thinking: 0,
                discard_move: 0
            },
            que = [];
        
        function get_first_word(line)
        {
            var space_index = line.indexOf(" ");
            
            /// If there are no spaces, send the whole line.
            if (space_index === -1) {
                return line;
            }
            return line.substr(0, space_index);
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
            
            if (!my_que) {
                return;
            }
            
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
    
    function calculate_board_size(w, h)
    {
        w = w || window.innerWidth; 
        h = h || window.innerHeight;
        
        if (w > h) {
            w = h
        } else {
            h = w;
        }
        
        return Math.round(w * .9);
    }
    
    function resize_board()
    {
        var size = calculate_board_size();
        
        board.size_board(size, size);
    }
    
    function resize_players()
    {
        var board_size = calculate_board_size(),
            width = Math.round(window.innerWidth * .9),
            el_width;
        
        if (width > board_size) {
            width = board_size;
        }
        
        el_width = Math.floor((window.innerWidth - width) / 2);
        
        player1_el.style.width = el_width + "px";
        player2_el.style.width = el_width + "px";
    }
    
    function onresize()
    {
        resize_board();
        resize_players()
    }
    
    function get_legal_moves(cb)
    {
        evaler.send("d", function ond(str)
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
        
        board.players[board.turn].engine.ai_thinking -= 1;
        
        if (board.players[board.turn].engine.discard_move) {
            board.players[board.turn].engine.discard_move -= 1;
            if (board.players[board.turn].engine.discard_move < 0) {
                console.log("Too many discard_move's: " + board.players[board.turn].engine.discard_move);
                board.players[board.turn].engine.discard_move = 0;
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
        console.log("thinking: " + str);
    }
    
    function set_ai_position()
    {
        var cmd = "position startpos";
        
        if (board.moves && board.moves.length) {
            cmd += " moves " + board.moves.join(" ");
        }
        
        if (evaler) {
            evaler.send(cmd);
        }
        if (board.players.w.type === "ai") {
            board.players.w.engine.send(cmd)
        }
        if (board.players.b.type === "ai") {
            board.players.b.engine.send(cmd)
        }
    }
    
    function tell_engine_to_move()
    {
        var default_time = 500000,
            wtime,
            btime,
            depth;
        
        if (board.players[board.turn].type === "ai") {
            board.players[board.turn].engine.ai_thinking += 1;
            //uciCmd("go " + (time.depth ? "depth " + time.depth : "") + " wtime " + time.wtime + " winc " + time.winc + " btime " + time.btime + " binc " + time.binc);
            /// Without time, it thinks really fast.
            //engine.send("go " + (typeof engine.depth !== "undefined" ? "depth " + engine.depth : "") + " wtime 1800000 btime 1800000" , onengine_move, onthinking);
            //engine.send("go " + (typeof engine.depth !== "undefined" ? "depth " + engine.depth : "") + " wtime 200000 btime 200000" , onengine_move, onthinking);
            if (board.players.w.time_type === "none") {
                wtime = default_time;
            } else {
                ///TODO: Use clock.
                wtime = board.players.w.time;
                
            }
            if (board.players.b.time_type === "none") {
                btime = default_time;
            } else {
                ///TODO: Use clock.
                btime = board.players.b.time;
            }
            
            /// If there's no time limit, limit the depth on some players.
            ///NOTE: There's no reason not to limit depth 1 since it's always fast.
            if (board.players[board.turn].time_type === "none" || Number(board.players[board.turn].engine.depth) === 1) {
                depth = board.players[board.turn].engine.depth;
            }
            
            
            board.players[board.turn].engine.send("go " + (typeof depth !== "undefined" ? "depth " + depth : "") + " wtime " + wtime + " btime " + btime , onengine_move, onthinking);
            return true;
        }
    }
    
    function onmove(move)
    {
        set_ai_position();
        
        ///NOTE: We need to get legal moves (even for AI) because we need to know if a move is castling or not.
        set_legal_moves(tell_engine_to_move);
    }
    
    function stop_ai(engine)
    {
        /// Is the engine currently thinking of a move.
        if (engine && engine.ai_thinking) {
            /// Discard the result of the thinking.
            engine.discard_move += 1;
            engine.send("stop");
        }
    }
    
    function start_new_game()
    {
        if (!evaler.ready || starting_new_game) {
            return;
        }
        
        starting_new_game = true;
        
        zobrist_keys = [];
        stalemate_by_rules = null;
        
        if (board.messy) {
            board.set_board();
        }
        
        
        evaler.send("ucinewgame");
        
        ///TODO: Need a better loading thing for each indivually.
        if (board.players.w.type === "ai") {
            stop_ai(board.players.w.engine);
            board.players.w.engine.send("ucinewgame");
        }
        if (board.players.b.type === "ai") {
            board.players.b.engine.send("ucinewgame");
            stop_ai(board.players.b.engine);
        }
        
        set_ai_position();
        //engine.send("position fen 6R1/1pp5/5k2/p1b4r/P1P2p2/1P5r/4R2P/7K w - - 0 39");
        //board.moves = "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4 e5d4 e1g1 f6e4 f1e1 d7d5 c4d5 d8d5 b1c3 d5c4 c3e4 c8e6 b2b3 c4d5 c1g5 f8b4 c2c3 f7f5 e4d6 b4d6 c3c4 d5c5 d1e2 e8g8 e2e6 g8h8 a1d1 f5f4 e1e4 c5a5 e4e2 a5f5 e6f5 f8f5 g5h4 a8f8 d1d3 h7h6 f3d4 c6d4 d3d4 g7g5 h4g5 h6g5 g1f1 g5g4 f2f3 g4f3 g2f3 h8g7 a2a4 f8h8 f1g2 g7f6 g2h1 h8h3 d4d3 d6c5 e2b2 f5g5 b2b1 a7a5 b1f1 c5e3 f1e1 h3f3 d3d8 g5h5 d8g8 f3h3 e1e2 e3c5".split(" ");
        set_legal_moves(function onset()
        {
            loading_el.classList.add("hidden");
            board.play();
            tell_engine_to_move();
            starting_new_game = false;
        });
    }
    //setInterval(start_new_game, 30000);
    
    function change_selected(el, value)
    {
        var i;
        
        for (i = el.options.length - 1; i >= 0; i -= 1) {
            if (el.options[i].value === value) {
                el.selectedIndex = i;
                break;
            }
        }
    }
    
    function make_type_change(player)
    {
        function set_type(type)
        {
            if (type === "human" || type === "ai") {
                change_selected(player.els.type, type);
                
                if (type !== player.type) {
                    player.type = type;
                    if (player.type === "ai") {
                        if (!player.engine) {
                            player.engine = load_engine();
                        }
                        
                        /// Set the AI level if not already.
                        player.set_level(player.level);
                        
                        if (board.mode === "play") {
                            set_ai_position();
                            tell_engine_to_move();
                        }
                        player.els.level.style.display = "inline";
                    } else {
                        stop_ai(player.engine);
                        player.els.level.style.display = "none";
                    }
                }
            }
        }
        
        function onchange()
        {
            set_type(this.value);
        }
        
        player.set_type = set_type;
        
        return onchange;
    }
    
    function make_set_level(player)
    {
        function set_level(level)
        {
            var depth,
                err_prob,
                max_err;
            
            if (level < 0) {
                level = 0;
            }
            if (level > 20) {
                level = 20;
            }
            
            if (level === player.engine.level) {
                return false;
            }
            
            /// Change thinking depth allowance.
            if (level < 2) {
                depth = "1";
            } else if (level < 4) {
                depth = "2";
            } else if (level < 6) {
                depth = "3";
            } else if (level < 8) {
                depth = "4";
            } else if (level < 10) {
                depth = "5";
            } else if (level < 12) {
                depth = "6";
            } else if (level < 14) {
                depth = "8";
            } else if (level < 16) {
                depth = "10";
            }
            
            player.engine.level = level;
            player.engine.depth = depth;
            
            change_selected(player.els.level, level);
            
            if (player.engine) {
                player.engine.send("setoption name Skill Level value " + level);
                
                ///NOTE: Stockfish level 20 does not make errors (intentially), so these numbers have no effect on level 20.
                /// Level 0 starts at 1
                err_prob = Math.round((level * 6.35) + 1);
                /// Level 0 starts at 10
                max_err = Math.round((level * -0.25) + 5);
                
                player.engine.err_prob = err_prob;
                player.engine.max_err  = max_err;
                
                player.engine.send("setoption name Skill Level Maximum Error value " + max_err);
                player.engine.send("setoption name Skill Level Probability value " + err_prob);
            }
        }
        
        function onchange()
        {
            set_level(parseFloat(this.value));
        }
        
        player.set_level = set_level;
        
        return onchange;
    }
    
    function time_from_str(str)
    {
        var split,
            mil = 0,
            sec = 0,
            min = 0,
            hour = 0,
            day = 0;
        
        if (typeof str === "number") {
            return str;
        } else if (typeof str === "string") {
            split = str.split(":");
            //console.log(split);
            if (split.length === 1) {
                sec = split[0];
            } else if (split.length === 2) {
                min = split[0];
                sec = split[1];
            } else if (split.length === 3) {
                hour = split[0];
                min  = split[1];
                sec  = split[2];
            } else if (split.length > 3) {
                day  = split[0];
                hour = split[1];
                min  = split[2];
                sec  = split[3];
            }
            split = sec.split(".");
            if (split.length === 2) {
                sec = split[0];
                mil = split[1];
                if (mil.length === 1) {
                    mil *= 100;
                } else if (mil.length === 2) {
                    mil *= 10;
                } else {
                    /// It can't be greater than 999 (i.e., longer than 3 digits).
                    mil = mil.substr(0, 3);
                }
            } else {
                sec = String(Math.round(sec));
            }
            
            return Number(mil) + (sec * 1000) + (min * 1000 * 60) + (hour * 1000 * 60 * 60) + (day * 1000 * 60 * 60 * 24);
        }
    }
    
    function make_set_time_type(player)
    {
        function set_time_type(type)
        {
            if (type !== "none" && type !== "sd") {
                type = "none";
            }
            
            change_selected(player.els.time_type, type);
            
            player.time_type = type;
            
            if (type === "sd") {
                player.els.sd_container.style.display = "block";
                player.set_sd_time();
            } else {
                player.els.sd_container.style.display = "none";
            }
        }
        
        function onchange()
        {
            set_time_type(this.value);
        }
        
        player.set_time_type = set_time_type;
        
        return onchange;
    }
    
    function make_set_sd_time(player)
    {
        function set_sd_time(time)
        {
            if (typeof time === "undefined") {
                time = player.els.sd.value;
            }
            
            player.time = time_from_str(time);
            ///TODO: Start clock.
        }
        
        function onchange()
        {
            set_sd_time(this.value);
        }
        
        player.set_sd_time = set_sd_time;
        
        return onchange;
    }
    
    function add_player_els(el, player)
    {
        var level_el = G.cde("select", null, {all_on_changes: make_set_level(player)}, [
            G.cde("option", {t:  0, value:  0, selected: player.level ===  0}),
            G.cde("option", {t:  1, value:  1, selected: player.level ===  1}),
            G.cde("option", {t:  2, value:  2, selected: player.level ===  2}),
            G.cde("option", {t:  3, value:  3, selected: player.level ===  3}),
            G.cde("option", {t:  4, value:  4, selected: player.level ===  4}),
            G.cde("option", {t:  5, value:  5, selected: player.level ===  5}),
            G.cde("option", {t:  6, value:  6, selected: player.level ===  6}),
            G.cde("option", {t:  7, value:  7, selected: player.level ===  7}),
            G.cde("option", {t:  8, value:  8, selected: player.level ===  8}),
            G.cde("option", {t:  9, value:  9, selected: player.level ===  9}),
            G.cde("option", {t: 10, value: 10, selected: player.level === 10}),
            G.cde("option", {t: 11, value: 11, selected: player.level === 11}),
            G.cde("option", {t: 12, value: 12, selected: player.level === 12}),
            G.cde("option", {t: 13, value: 13, selected: player.level === 13}),
            G.cde("option", {t: 14, value: 14, selected: player.level === 14}),
            G.cde("option", {t: 15, value: 15, selected: player.level === 15}),
            G.cde("option", {t: 16, value: 16, selected: player.level === 16}),
            G.cde("option", {t: 17, value: 17, selected: player.level === 17}),
            G.cde("option", {t: 18, value: 18, selected: player.level === 18}),
            G.cde("option", {t: 19, value: 19, selected: player.level === 19}),
            G.cde("option", {t: 20, value: 20, selected: player.level === 20}),
        ]);
        
        var type_el = G.cde("select", null, {all_on_changes: make_type_change(player)}, [
            G.cde("option", {t: "Human", value: "human", selected: player.type === "human"}),
            G.cde("option", {t: "Computer", value: "ai", selected: player.type === "ai"}),
        ]);
        
        ///
        /// Time
        ///
        var time_container = G.cde("div");
        var sd_container = G.cde("div");
        
        if (!player.time) {
            player.time = {};
        }
        
        var time_type_el = G.cde("select", null, {all_on_changes: make_set_time_type(player)}, [
            G.cde("option", {t: "none", value: "none", selected: player.time.type === "none"}),
            G.cde("option", {t: "Sudden Death", value: "sd", selected: player.time.type === "sd"}),
        ]);
        
        var sd_el = G.cde("input", {type: "text", value: player.time.sd || "5:00"}, {all_on_changes: make_set_sd_time(player)});
        
        sd_container.appendChild(G.cde("", [
            "Time: ",
            sd_el,
        ]));
        
        time_container.appendChild(G.cde("", [
            "Time type: ",
            time_type_el,
            sd_container,
        ]));
        
        ///
        /// Add elements
        ///
        
        el.appendChild(type_el);
        el.appendChild(level_el);
        el.appendChild(time_container);
        
        player.els = {
            type: type_el,
            level: level_el,
            time_container: time_container,
            time_type: time_type_el,
            sd_container: sd_container,
            sd: sd_el,
        };
    }
    
    function create_players()
    {
        player1_el.classList.add("player");
        player1_el.classList.add("left_player");
        player2_el.classList.add("player");
        player2_el.classList.add("right_player");
        
        board.players.w.level = 0;
        board.players.b.level = 0;
        
        add_player_els(player1_el, board.players.w);
        add_player_els(player2_el, board.players.b);
        
        board.el.parentNode.insertBefore(player1_el, board.el);
        board.el.parentNode.insertBefore(player2_el, board.el.nextSibling);
        
        board.players.w.set_type("human");
        board.players.b.set_type("ai");
        
        board.players.w.set_time_type("none");
        board.players.b.set_time_type("none");
    }
    
    function init()
    {
        onresize();
        
        window.addEventListener("resize", onresize);
        
        loading_el = document.createElement("div");
        
        loading_el.textContent = "Loading...";
        loading_el.classList.add("loading");
        
        document.documentElement.appendChild(loading_el);
        
        create_players();
        
        board.wait();
        
        board.onmove = onmove;
        
        //engine = load_engine();
        evaler = load_engine();
        
        evaler.stream = function (line)
        {
            /*
            if (line.substr(0, 4) === "info") {
                player1_el.textContent = line;
            }
            */
            console.log(line);
        }
        
        //board.players.b.type = "human";
        //board.players.w.type = "ai";
        
        evaler.send("uci", function onuci(str)
        {
            evaler.send("isready", function onready()
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

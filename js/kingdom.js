(function ()
{
    "use strict";
    
    var board = BOARD("board"),
        zobrist_keys,
        stalemate_by_rules,
        evaler,
        loading_el,
        player1_el = G.cde("div", {c: "player player_white"}),
        player2_el = G.cde("div", {c: "player player_black"}),
        center_el  = G.cde("div", {c: "center_el"}),
        rating_slider,
        new_game_el,
        setup_game_el,
        starting_new_game,
        retry_move_timer,
        clock_manager,
        pieces_moved,
        startpos,
        debugging = false,
        legal_move_engine,
        cur_pos_cmd,
        game_history,
        eval_depth = 8,
        rating_font_style = "Impact,monospace,mono,sans-serif",
        font_fit;
    
    function error(str)
    {
        str = str || "Unknown error";
        
        alert("An error occured.\n" + str);
        throw new Error(str);
    }
    
    function load_engine()
    {
        var worker = new Worker("js/stockfish6.js"),
            engine = {started: Date.now()},
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
                if (my_que.cb && !my_que.discard) {
                    my_que.cb(my_que.message);
                }
                
                /// Remove this from the que.
                G.array_remove(que, que_num);
            }
        };
        
        engine.send = function send(cmd, cb, stream)
        {
            cmd = String(cmd).trim();
            
            /// Can't quit. This is a browser.
            ///TODO: Destroy the engine.
            if (cmd === "quit") {
                return;
            }
            
            if (debugging) {
                console.log(cmd);
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
        
        engine.stop_moves = function stop_moves()
        {
            var i,
                len = que.length;
            
            for (i = 0; i < len; i += 1) {
                if (debugging) {
                    console.log(i, get_first_word(que[i].cmd))
                }
                /// We found a move that has not been stopped yet.
                if (get_first_word(que[i].cmd) === "go" && !que[i].discard) {
                    engine.send("stop");
                    que[i].discard = true;
                }
            }
        }
        
        engine.get_cue_len = function get_cue_len()
        {
            return que.length;
        }
        
        return engine;
    }
    
    function calculate_board_size(w, h)
    {
        var snap;
        
        w = w || window.innerWidth;
        h = h || window.innerHeight;
        
        if (w > h) {
            w = h
        } else {
            h = w;
        }
        
        w = Math.round(w * .9);
        
        snap = w % board.board_details.files;
        
        w -= snap;
        
        return w;
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
        
        el_width = Math.floor((window.innerWidth - width) / 2) - 10;
        
        player1_el.style.width = el_width + "px";
        player2_el.style.width = el_width + "px";
        
        clock_manager.clock_els.w.style.width = el_width + "px";
        clock_manager.clock_els.b.style.width = el_width + "px";
    }
    
    function resize_center()
    {
        center_el.style.width = calculate_board_size() + "px";
    }
    
    function onresize()
    {
        resize_board();
        resize_players();
        resize_center();
        rating_slider.resize();
    }
    
    function get_legal_moves(pos, cb)
    {
        if (pos) {
            legal_move_engine.send(pos);
        }
        legal_move_engine.send("d", function ond(str)
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
    
    function is_insufficient_material(color)
    {
        var i,
            piece_counts = {
                knights: 0,
                bishops: 0,
                light_bishops: 0
            },
            piece_type;
        
        /// Check insufficient material
        /// 1. Only Kings
        /// 2. Kings and one knight
        /// 3. Kings and any number of bishops on either or one side all of which are on the same color
        ///NOTE: Could examine the fen position too, but it would take a little more work to determine bishop color.
        if (board.pieces) {
            for (i = board.pieces.length - 1; i >= 0; i -= 1) {
                /// Make sure the piece is on the board and it is one that we are counting.
                if (!board.pieces[i].captured && (!color || board.pieces[i].color === color)) {
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
                return true;
            }
        }
    }
    
    function is_stalemate_by_rule(fen, key)
    {
        var i,
            count = 1;
        
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
        
        if (is_insufficient_material()) {
            return "material";
        }
    }
    
    function pause_game()
    {
        board.wait();
        G.events.trigger("gamePaused");
    }
    
    function set_legal_moves(cb)
    {
        get_legal_moves(cur_pos_cmd, function onget(moves)
        {
            zobrist_keys.push(moves.key);
            
            stalemate_by_rules = is_stalemate_by_rule(moves.fen);
            
            /// Is the game still on?
            ///TODO: Only AI should automatically claim 50 move rule. (And probably not the lower levels).
            if (moves.uci.length && !stalemate_by_rules) {
                board.set_legal_moves(moves);
                if (cb) {
                    cb();
                }
            } else {
                board.set_legal_moves(moves);
                if (board.get_mode() === "play") {
                    /// Was it checkmate?
                    if (moves.checkers.length && !stalemate_by_rules) {
                        alert((board.turn === "b" ? "White" : "Black") + " wins!\n" + (board.turn === "b" ? "Black" : "White") + " is checkmated!");
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
                    pause_game();
                }
            }
        });
    }
    
    function prep_eval(pos, ply)
    {
        game_history[ply].pos = pos;
        
        setTimeout(eval_stack, 0);
    }
    
    function eval_stack()
    {
        var i;
        
        for (i = game_history.length - 1; i >= 0; i -= 1) {
            if (!game_history[i].evaled) {
                return eval_pos(i);
            }
        }
    }
    
    G.events.attach("evaled", eval_stack);
    
    function eval_pos(ply)
    {
        /// If we are in the middle of an eval, stop it and do the latest one.
        if (evaler.busy) {
            if (evaler.cur_ply === ply) {
                return;
            }
            evaler.stop = true;
            return evaler.send("stop");
        }
        
        evaler.stop = false;
        evaler.busy = true;
        evaler.cur_ply = ply;
        
        evaler.send(game_history[ply].pos);
        
        evaler.send("go depth " + eval_depth, function ongo(str)
        {
            var matches = str.match(/^bestmove\s(\S+)(?:\sponder\s(\S+))?/);
            
            if (game_history[ply] && !evaler.stop) {
                if (matches) {
                    game_history[ply].eval_best_move = matches[1];
                    game_history[ply].eval_ponder = matches[2];
                }
                
                game_history[ply].evaled = true;
            }
            evaler.busy = false;
            G.events.trigger("evaled", {ply: ply});
        }, function stream(str)
        {
            var matches = str.match(/depth (\d+) .*score (cp|mate) ([-\d]+) .*pv (.+)/),
                score,
                type,
                depth,
                pv,
                data;
            
            /// Are we still supposed to be evaling?
            ///NOTE: When a new game starts, the game_history array will be empty.
            if (game_history[ply]) {
                if (matches) {
                    depth = Number(matches[1]);
                    type = matches[2];
                    score = Number(matches[3]);
                    pv = matches[4].split(" ");
                    
                    /// Convert the relative score to an absolute score.
                    if (game_history[ply].turn === "b") {
                        score *= -1;
                    }
                    
                    game_history[ply].eval_score = score;
                    game_history[ply].eval_type = type;
                    game_history[ply].eval_depth = depth;
                    game_history[ply].eval_pv = pv;
                    
                    data = {score: score, type: type, depth: depth, pv: pv};
                } else {
                    if (/score mate 0\b/.test(str)) {
                        game_history[ply].eval_score = 0;
                        game_history[ply].eval_type = "mate";
                        game_history[ply].eval_depth = 0;
                        data = {score: 0, type: "mate", depth: 0};
                    }
                }
            }
            
            if (data) {
                data.ply = ply;
                data.turn = game_history[ply].turn;
                G.events.trigger("eval", data);
            }
        });
    }
    
    function onengine_move(str)
    {
        var res = str.match(/^bestmove\s(\S+)(?:\sponder\s(\S+))?/),
            player = board.players[board.turn],
            move,
            ponder,
            pos,
            legal_moves = board.get_legal_moves();
        
        if (board.get_mode() !== "play") {
            return;
        }
        
        if (!res) {
            error("Can't get move: " + str);
        }
        
        if (!board.is_legal_move(res[1])) {
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!");
            console.log("ILLEGAL MOVE: " + res[1]);
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!");
            
            if (!legal_moves || !legal_moves.uci) {
                error("Cannot find a legal move");
            }
            /// Just use the first legal move
            move = legal_moves.uci[0];
            ponder = "";
        } else {
            move = res[1];
            ponder = res[2];
        }
        
        ///TODO: Allow ponder.
        player.engine.ponder_move = ponder;
        
        board.move(move);
        set_cur_pos_cmd();
        
        /// Clear legal moves to indicate that we are between moves. (This is used by the clock manager to determine if it should look call the flag.)
        board.set_legal_moves({});
        
        /// Wait until we set legal moves. It's only fair.
        clock_manager.stop_timer();
        set_legal_moves(function onset()
        {
            tell_engine_to_move();
            if (board.get_mode() === "play") {
                clock_manager.start_timer();
            }
        });
        
        G.events.trigger("move", {move: move, ponder: ponder});
    }
    
    function onthinking(str)
    {
        if (debugging) {
            console.log("thinking: " + str);
        }
    }
    
    function set_cur_pos_cmd()
    {
        var cmd = "position " + startpos,
            ply = 0;
        
        if (board.moves && board.moves.length) {
            ply = board.moves.length;
            cmd += " moves " + board.moves.join(" ");
        }
        
        cur_pos_cmd = cmd;
    }
    
    function use_depth(player)
    {
        /// On a timed game, if the player has more than 20 secs per depth, then limit to that depth.
        /// We don't want to always force an ai to use a depth because it may take too long when time is low.
        return player.engine.depth && (player.time_type === "none" || (player.time > player.engine.depth * 20000));
    }
    
    function tell_engine_to_move()
    {
        ///NOTE: Without time, it thinks really fast. So, we give it a something to make it move reasonably quickly.
        ///      This time is also tweaked based on the level.
        var default_time = 1000 * 60, /// 1 minute
            wtime,
            btime,
            depth,
            player = board.players[board.turn];
        
        if (board.get_mode() !== "play") {
            return;
        }
        
        function tweak_default_time(player)
        {
            var level;
            
            if (player.type === "ai") {
                level = player.engine.level;
            } else {
                level = 20;
            }
            return default_time + (default_time * (level / 20));
        }
        
        if (player.type === "ai") {
            /// Pause the game if the computer is not ready.
            ///TODO: Unpause when changed to human.
            if (!player.engine.loaded || !player.engine.ready) {
                show_loading();
                return retry_move_timer = setInterval(function onretry()
                {
                    if (player.engine.loaded && player.engine.ready) {
                        hide_loading();
                        clearInterval(retry_move_timer);
                        tell_engine_to_move();
                    }
                }, 100);
            }
            
            //uciCmd("go " + (time.depth ? "depth " + time.depth : "") + " wtime " + time.wtime + " winc " + time.winc + " btime " + time.btime + " binc " + time.binc);
            
            //engine.send("go " + (typeof engine.depth !== "undefined" ? "depth " + engine.depth : "") + " wtime 1800000 btime 1800000" , onengine_move, onthinking);
            //engine.send("go " + (typeof engine.depth !== "undefined" ? "depth " + engine.depth : "") + " wtime 200000 btime 200000" , onengine_move, onthinking);
            if (board.players.w.time_type === "none") {
                wtime = tweak_default_time(board.players.w);
            } else {
                wtime = board.players.w.time;
                
            }
            if (board.players.b.time_type === "none") {
                btime = tweak_default_time(board.players.b);
            } else {
                btime = board.players.b.time;
            }
            
            /// If there's no time limit, limit the depth on some players.
            ///NOTE: There's no reason not to limit depth 1 since it's always fast.
            //if (player.time_type === "none" || Number(player.engine.depth) === 1) {
            if (use_depth(player)) {
                depth = player.engine.depth;
            }
            
            //depth = 1;
            player.engine.send(cur_pos_cmd);
            player.engine.send("go " + (typeof depth !== "undefined" ? "depth " + depth : "") + " wtime " + wtime + " btime " + btime , onengine_move, onthinking);
            return true;
        }
    }
    
    function on_human_move(move)
    {
        set_cur_pos_cmd();
        
        ///NOTE: We need to get legal moves (even for AI) because we need to know if a move is castling or not.
        set_legal_moves(tell_engine_to_move);
        
        G.events.trigger("move", {move: move});
    }
    
    function all_ready(cb)
    {
        function ready_black()
        {
            if (board.players.b.type === "ai") {
                board.players.b.engine.send("isready", cb);
            } else {
                cb();
            }
        }
        
        evaler.send("isready", function evaler_ready()
        {
            if (board.players.w.type === "ai") {
                board.players.w.engine.send("isready", ready_black);
            } else {
                ready_black();
            }
        });
    }
    
    function all_flushed(cb)
    {
        function wait()
        {
            setTimeout(function retry()
            {
                all_flushed(cb);
            }, 100);
        }
        
        if (evaler.get_cue_len()) {
            return wait();
        }
        
        if (legal_move_engine && legal_move_engine.get_cue_len()) {
            return wait();
        }
        
        if (board.players.w.type === "ai" && board.players.w.engine.get_cue_len()) {
            return wait();
        }
        
        if (board.players.b.type === "ai" && board.players.b.engine.get_cue_len()) {
            return wait();
        }
        
        all_ready(cb);
    }
    
    function stop_game()
    {
        /// Prevent possible future moves.
        clearInterval(retry_move_timer);
        
        ///TODO: Need a better loading thing for each indivually.
        if (board.players.w.type === "ai") {
            board.players.w.engine.stop_moves();
        }
        if (board.players.b.type === "ai") {
            board.players.b.engine.stop_moves();
        }
    }
    
    function init_setup()
    {
        pause_game();
        board.enable_setup();
        new_game_el.textContent = "Start Game";
        setup_game_el.disabled = true;
        hide_loading(true);
        G.events.trigger("initSetup");
    }
    
    function check_startpos(cb)
    {
        /// The default position is always right.
        if (startpos === "startpos") {
            return setTimeout(function ()
            {
                cb(true);
            }, 0);
        }
        
        check_fen(startpos, cb);
    }
    
    function check_fen(fen, cb)
    {
        var temp_pos;
        
        function return_val(is_valid)
        {
            setTimeout(function ()
            {
                cb(is_valid);
            }, 0);
        }
        
        /// A simple check to see if the FEN makes sense.
        if (!/^\s*fen\s+[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*/i.test(fen)) {
            return return_val(false);
        }
        
        /// Set it to an invalid one first, so that when we set it to a valid one, it should change; otherwise it will remain invalid.
        ///NOTE: Stockfish just completely ignores invalid FEN's. It also allows for lots of omissions.
        legal_move_engine.send("position fen 8/8/8/8/8/8/8/8 b - - 0 1");
        get_legal_moves("position " + fen, function onget(data)
        {
            var wkings = 0,
                bkings = 0;
            
            if (!data.uci.length) {
                /// The starting side needs a valid move.
                return return_val(false);
            }
            
            /// Count kings.
            data.fen.placement.replace(/k/gi, function counter(char)
            {
                if (char === "k") {
                    bkings += 1;
                } else {
                    wkings += 1;
                }
            });
            
            if (bkings !== 1 || wkings !== 1) {
                /// Both sides need exactly one king.
                return return_val(false);
            }
            
            get_legal_moves("position fen " + data.fen.placement + " " + (data.fen.turn === "w" ? "b" : "w"), function onget(data)
            {
                /// There must not be anyone already checking the opponent's king.
                return return_val(!data.checkers.length);
            });
        });
    }
    
    function get_legal_move_engine()
    {
        if (!legal_move_engine) {
            if (board.players.b.engine) {
                legal_move_engine = board.players.b.engine;
            } else if (board.players.w.engine) {
                legal_move_engine = board.players.w.engine;
            } else {
                board.players.b.engine = load_engine();
                legal_move_engine = board.players.b.engine;
            }
        }
    }
    
    function start_new_game()
    {
        var dont_reset = board.get_mode() === "setup",
            stop_new_game;
        
        show_loading();
        
        new_game_el.textContent = "New Game";
        setup_game_el.disabled = false;
        
        if (starting_new_game) {
            return;
        }
        
        starting_new_game = true;
        
        /// Stop loading a new game if the user clicks on setup.
        G.events.attach("initSetup", function ()
        {
            stop_new_game = true;
        }, true);
        
        stop_game();
        
        game_history = [];
        
        evaler.send("stop");
        evaler.send("ucinewgame");
        
        if (board.players.w.type === "ai") {
            board.players.w.engine.send("ucinewgame");
        }
        if (board.players.b.type === "ai") {
            board.players.b.engine.send("ucinewgame");
        }
        
        get_legal_move_engine();
        
        all_flushed(function start_game()
        {
            if (stop_new_game) {
                return starting_new_game = false;
            }
            
            if (dont_reset) {
                ///TEMP: There needs to be a way to set turn, castling, and moves (maybe also a PGN and FEN importer).
                startpos = board.get_fen() + " w - - 0 1";
                board.turn = "w";
                board.set_board(startpos);
                startpos = "fen " + startpos;
                ///TODO: Get move count.
                /*
                if (move_count > 0) {
                    board.messy = true;
                }
                */
            } else {
                board.set_board();
                startpos = "startpos";
            }
            
            check_startpos(function oncheck(is_valid)
            {
                if (stop_new_game) {
                    return starting_new_game = false;
                }
                
                if (!is_valid) {
                    starting_new_game = false;
                    pause_game();
                    hide_loading(true);
                    alert("Position is invalid");
                    return;
                }
                
                zobrist_keys = [];
                stalemate_by_rules = null;
                pieces_moved = false;
                
                set_cur_pos_cmd();
                //engine.send("position fen 6R1/1pp5/5k2/p1b4r/P1P2p2/1P5r/4R2P/7K w - - 0 39");
                //board.moves = "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4 e5d4 e1g1 f6e4 f1e1 d7d5 c4d5 d8d5 b1c3 d5c4 c3e4 c8e6 b2b3 c4d5 c1g5 f8b4 c2c3 f7f5 e4d6 b4d6 c3c4 d5c5 d1e2 e8g8 e2e6 g8h8 a1d1 f5f4 e1e4 c5a5 e4e2 a5f5 e6f5 f8f5 g5h4 a8f8 d1d3 h7h6 f3d4 c6d4 d3d4 g7g5 h4g5 h6g5 g1f1 g5g4 f2f3 g4f3 g2f3 h8g7 a2a4 f8h8 f1g2 g7f6 g2h1 h8h3 d4d3 d6c5 e2b2 f5g5 b2b1 a7a5 b1f1 c5e3 f1e1 h3f3 d3d8 g5h5 d8g8 f3h3 e1e2 e3c5".split(" ");
                set_legal_moves(function onset()
                {
                    if (stop_new_game) {
                        return starting_new_game = false;
                    }
                    
                    game_history = [{turn: board.turn, pos: "position " + startpos}];
                    //debugger;
                    prep_eval(game_history[0].pos, 0);
                    
                    clock_manager.reset_clocks();
                    starting_new_game = false;
                    hide_loading();
                    tell_engine_to_move();
                    G.events.trigger("newGameBegins");
                });
            });
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
    
    function get_other_player(player)
    {
        return board.players[player.color === "w" ? "b" : "w"];
    }
    
    function make_type_change(player)
    {
        function set_type(type)
        {
            var other_player,
                this_engine,
                tmp_engine;
            
            if (type === "human" || type === "ai") {
                change_selected(player.els.type, type);
                
                if (type !== player.type) {
                    player.type = type;
                    if (player.type === "ai") {
                        if (!player.engine) {
                            other_player = get_other_player(player);
                            if (other_player.type === "human" && other_player.engine) {
                                player.engine = other_player.engine;
                                delete other_player.engine;
                            } else {
                                player.engine = load_engine();
                                /// Keep the correct engine, even if it gets switched.
                                this_engine = player.engine;
                                ///NOTE: This shows that it's loaded so that we know that it can move.
                                player.engine.send("uci", function onload()
                                {
                                    /// Make sure it's all ready too.
                                    ///NOTE: We need to link directly to the engine because it could get switched while loading.
                                    this_engine.send("isready");
                                });
                            }
                        }
                        
                        /// Set the AI level if not already.
                        player.set_level(player.level);
                        
                        if (board.get_mode() === "play") {
                            set_cur_pos_cmd();
                            tell_engine_to_move();
                        }
                        player.els.level.style.display = "inline";
                    } else { /// Human
                        if (player.engine) {
                            player.engine.stop_moves();
                        }
                        player.els.level.style.display = "none";
                        other_player = get_other_player(player);
                        
                        /// Do we have an engine we don't need now and the other player needs one?
                        if (player.engine && other_player.type === "ai" && !other_player.engine.ready && player.engine.started < other_player.engine.started) {
                            /// Switch engines.
                            tmp_engine = player.engine;
                            player.engine = other_player.engine;
                            other_player.engine = tmp_engine;
                            
                            /// Reset levels.
                            player.set_level(player.level);
                            other_player.set_level(other_player.level);
                        }
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
            
            /// Nothing to change.
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
            }
            
            player.engine.level = level;
            player.engine.depth = depth;
            
            change_selected(player.els.level, level);
            
            if (player.engine) {
                player.engine.send("setoption name Skill Level value " + level);
                
                ///NOTE: Stockfish level 20 does not make errors (intentially), so these numbers have no effect on level 20.
                /// Level 0 starts at 1
                err_prob = Math.round((level * 6.35) + 1);
                /// Level 0 starts at 5
                max_err = Math.round((level * -0.25) + 5);
                
                player.engine.err_prob = err_prob;
                player.engine.max_err  = max_err;
                
                player.engine.send("setoption name Skill Level Maximum Error value " + max_err);
                player.engine.send("setoption name Skill Level Probability value " + err_prob);
                
                ///NOTE: Could clear the hash to make the player more like it's brand new.
                /// player.engine.send("setoption name Clear Hash");
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
            
            if (player.time_type !== type) {
                player.time_type = type;
                
                if (type === "sd") {
                    player.els.sd_container.style.display = "block";
                    player.set_sd_time();
                } else {
                    player.els.sd_container.style.display = "none";
                    player.time = "";
                    player.start_time = "";
                    clock_manager.clear(player.color);
                }
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
            var time_val;
            
            if (typeof time === "undefined") {
                time = player.els.sd.value;
            }
            
            time_val = time_from_str(time);
            
            if (time_val && time_val !== player.start_time) {
                player.time = time_val;
                player.start_time = time_val;
                clock_manager.update_clock(player.color);
            }
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
        
        var sd_el = G.cde("input", {type: "text", value: player.time.sd || "15:00"}, {all_on_changes: make_set_sd_time(player)});
        
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
        board.players.w.level = 20;
        board.players.b.level = 20;
        
        add_player_els(player1_el, board.players.w);
        add_player_els(player2_el, board.players.b);
        
        board.el.parentNode.insertBefore(player1_el, board.el);
        board.el.parentNode.insertBefore(player2_el, board.el.nextSibling);
        
        board.players.w.set_type("human");
        board.players.b.set_type("ai");
        
        board.players.w.set_time_type("none");
        board.players.b.set_time_type("none");
    }
    
    function create_center()
    {
        new_game_el = G.cde("button", {t: "New Game"}, {click: start_new_game});
        setup_game_el = G.cde("button", {t: "Setup Game"}, {click: init_setup});
        
        center_el.appendChild(G.cde("documentFragment", [
            new_game_el,
            setup_game_el,
        ]));
        
        board.el.parentNode.insertBefore(center_el, null);
    }
    
    function hide_loading(do_not_start)
    {
        loading_el.classList.add("hidden");
        if (!do_not_start) {
            board.play();
            G.events.trigger("gameUnpaused");
        }
    }
    
    function show_loading()
    {
        if (!loading_el) {
            loading_el = G.cde("div", {t: "Loading...", c: "loading"});
            
            document.documentElement.appendChild(loading_el);
        } else {
            loading_el.classList.remove("hidden");
        }
        
        pause_game();
    }
    
    function init()
    {
        if (typeof Worker === "undefined") {
            return alert("Sorry, Kingdom does not support this browser.");
        }
        
        onresize();
        
        window.addEventListener("resize", onresize);
        
        show_loading();
        
        create_players();
        
        create_center();
        
        board.onmove = on_human_move;
        
        evaler = load_engine();
        
        evaler.send("uci", function onuci(str)
        {
            evaler.send("isready", function onready()
            {
                if (board.get_mode() === "wait") {
                    start_new_game();
                }
            });
        });
    }
    
    font_fit = FONT_FIT({fontFamily: rating_font_style});
    
    window.addEventListener("keydown", function catch_key(e)
    {
        if (e.keyCode === 113) { /// F2
            start_new_game();
        }
    });
    
    G.events.attach("move", function onmove(e)
    {
        var ply = game_history.length;
        
        if (!pieces_moved) {
            G.events.trigger("firstMove");
            pieces_moved = true;
        }
        
        ///NOTE: board.turn has already switched.
        game_history[ply] = {move: e.move, ponder: e.ponder, turn: board.turn, pos: cur_pos_cmd};
        prep_eval(cur_pos_cmd, ply);
    });
    
    
    clock_manager = (function make_clocks()
    {
        var last_time,
            tick_timer,
            clock_els = {
                w: G.cde("div", {c: "clock clock_white"}),
                b: G.cde("div", {c: "clock clock_black"}),
            },
            clock_manager = {},
            timer_on;
        
        function tick(color)
        {
            var now = Date.now(),
                diff,
                player = board.players[color || board.turn],
                legal_moves;
            
            diff = now - last_time;
            last_time = now;
            
            if (player.time_type !== "none") {
                legal_moves = board.get_legal_moves();
                player.time -= diff;
                update_clock(player.color);
                /// Has someone's time run out?
                /// Also, make sure that the system has time to check to see if the game has already ended (either by checkmake or stalemate) by checking for legal moves.
                if (player.time < 0 && (legal_moves && legal_moves.uci && legal_moves.uci.length)) {
                    /// If the player with time is almost beaten (or the game is almost a stalemate) call it a stalemate.
                    if (is_insufficient_material(player.color === "w" ? "b" : "w")) {
                        alert("Stalemate: Player with time has insufficient material");
                    } else {
                        alert((player.color === "w" ? "White" : "Black") + " loses on time.");
                    }
                    /// Stop player from moving.
                    stop_game();
                    /// Disable board play.
                    pause_game();
                }
            }
        }
        
        function start_timer()
        {
            var speed = 34;
            
            if (G.mobile) {
                speed = 234;
            }
            
            /// Don't start the timer if the game has not yet begun.
            if (board.messy && !timer_on) {
                last_time = Date.now();
                tick_timer = setInterval(tick, 34);
                timer_on = true;
            }
        }
        
        function stop_timer()
        {
            clearInterval(tick_timer);
            timer_on = false;
        }
        
        function format_time(time, allow_neg)
        {
            var sign = "",
                res,
                sec,
                min,
                hour,
                day;
            
            time = parseFloat(time);
            
            if (time < 0) {
                if (allow_neg) {
                    sign = "-";
                } else {
                    time = 0;
                }
            }
            time = Math.abs(time);
            
            if (time < 10000) { /// Less than 10 sec
                res = (time / 1000).toFixed(3); /// Show decimal
            } else if (time < 60000) { /// Less than 1 minute
                /// Always floor since we don't want to round to 60.
                res = "0:" + Math.floor(time / 1000);
            } else if (time < 3600000) { /// Less than 1 hour
                /// Always floor since we don't want to round to 60.
                sec = Math.floor((time % 60000) / 1000);
                min = Math.floor(time / 60000);
                if (sec < 10) {
                    sec = "0" + sec;
                }
                res = min + ":" + sec;
            } else if (time < 86400000) { /// Less than 1 day
                /// Always floor since we don't want to round to 60.
                sec  = Math.floor((time % 60000) / 1000);
                hour = Math.floor(time / 60000);
                min  = Math.floor(hour % 60);
                hour = (hour - min) / 60;
                
                if (sec < 10) {
                    sec = "0" + sec;
                }
                if (min < 10) {
                    min = "0" + min;
                }
                
                res = hour + ":" + min + ":" + sec;
                
            } else { /// Days
                ///NOTE: NaN is always falsey, so it will come here. We check this here so that we don't need to waste time checking eariler.
                if (isNaN(time)) {
                    return "Error";
                }
                /// Always floor since we don't want to round to 60.
                sec  = Math.floor((time % 60000) / 1000);
                hour = Math.floor(time / 60000);
                min  = Math.floor(hour % 60);
                hour = (hour - min) / 60;
                day = Math.floor(hour / 24);
                hour = hour % 24;
                
                if (sec < 10) {
                    sec = "0" + sec;
                }
                if (min < 10) {
                    min = "0" + min;
                }
                if (hour < 10) {
                    hour = "0" + hour;
                }
                
                res = day + ":" + hour + ":" + min + ":" + sec;
            }
            
            return sign + res;
        }
        
        function update_clock(color)
        {
            clock_els[color].textContent = format_time(board.players[color].time);
        }
        
        function reset_clock(color)
        {
            var player = board.players[color];
            if (player.time_type !== "none") {
                player.time = player.start_time;
                clock_manager.update_clock(player.color)
            }
        }
        
        clock_manager.reset_clocks = function ()
        {
            reset_clock("w");
            reset_clock("b");
        };
        
        board.onswitch = function onswitch()
        {
            if (timer_on) {
                tick(board.turn === "w" ? "b" : "w");
            }
        };
        
        board.el.parentNode.insertBefore(clock_els.w, board.el);
        board.el.parentNode.insertBefore(clock_els.b, board.el.nextSibling);
        
        G.events.attach("gameUnpaused", start_timer);
        G.events.attach("firstMove", start_timer);
        G.events.attach("gamePaused", stop_timer);
        
        clock_manager.clock_els = clock_els;
        
        clock_manager.update_clock = update_clock;
        
        clock_manager.clear = function clear(color)
        {
            if (clock_els[color]) {
                clock_els[color].textContent = "--";
            }
        };
        
        clock_manager.start_timer = start_timer;
        clock_manager.stop_timer = stop_timer;
        
        return clock_manager;
    }());
    
    rating_slider = function make_rating_slider()
    {
        var container = G.cde("div", {c: "ratingContainer"});
        var slider_el = G.cde("div", {c: "ratingSlider"});
        var canvas = G.cde("canvas", {c: "ratingCanvas"});
        var obj = {max: 1000, min: -1000, value: 0};
        var ctx = canvas.getContext("2d");
        
        function calculate_slope()
        {
            /// m = change in y-value (y2 - y1)
            ///     change in x-value (x2 - x1)
            obj.m = (100 - 0) / (obj.min - obj.max);
        }
        
        function draw_marks()
        {
            var height = canvas.height,
                width = canvas.width,
                qrt_width,
                pos,
                median,
                line_y,
                font_size,
                text;
            
            median = height / 2;
            /// Draw median.
            ctx.beginPath();
            ctx.lineWidth = height / 150;
            ctx.strokeStyle = "rgba(200,0,0,.9)";
            ctx.moveTo(0, median);
            ctx.lineTo(width, median);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.lineWidth = height / 500;
            ctx.fillStyle = ctx.strokeStyle = "rgba(128,128,128,.6)";
            ctx.textAlign = "center";
            qrt_width = width / 4;
            
            for (pos = ((obj.min + 1) - (obj.min + 1) % 100); pos < obj.max; pos += 100) {
                if (pos !== 0) {
                    text = String(pos / 100);
                    font_size = font_fit.fit(text, {w: width / 2, h: width / 2});
                    ctx.font = font_size + "px " + rating_font_style;
                    line_y = median - ((pos / obj.max) * median);
                    ctx.moveTo(0, line_y);
                    ctx.lineTo(qrt_width, line_y);
                    ctx.moveTo(width - qrt_width, line_y);
                    ctx.lineTo(width, line_y);
                    ctx.fillText(text, width / 2 - 1, line_y + qrt_width / 2);
                }
            }
            
            ctx.stroke();
        }
        
        calculate_slope();
        
        obj.resize = function ()
        {
            var board_rect = board.el.getBoundingClientRect();
            container.style.top = board_rect.top + "px";
            container.style.bottom = (window.innerHeight - board_rect.bottom) + "px";
            container.style.right = (window.innerWidth - board_rect.left) + "px";
            container.style.left = (board_rect.left - (board_rect.width / 16)) + "px";
            ///NOTE: clientWidth/clientHeight gets the width without the board.
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            
            draw_marks();
        };
        
        obj.set_eval = function (value)
        {
            obj.value = Number(value);
            slider_el.style.height = ((obj.m * obj.value) + 50) + "%";
        };
        
        /// Set default.
        obj.set_eval(obj.value);
        
        container.appendChild(canvas);
        
        container.appendChild(slider_el);
        
        board.el.parentNode.insertBefore(container, board.el);
    
        G.events.attach("eval", function oneval(e)
        {
            if (debugging) {
                console.log(e)
            }
            
            /// Is this eval for the current position?
            if (e.ply === game_history.length - 1) {
                if (e.type === "cp") {
                    obj.set_eval(e.score);
                } else if (e.type === "mate") {
                    if (e.score === 0) {
                        obj.set_eval(e.turn === "w" ? -obj.max : obj.max);
                    } else {
                        obj.set_eval(e.score > 0 ? obj.max : -obj.max);
                    }
                }
            }
        });
        
        return obj;
    }();
    
    init();
}());

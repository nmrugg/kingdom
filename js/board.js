/* exported BOARD */

var BOARD = function board_init(el, options)
{
    "use strict";
    
    var pieces,
        board,
        board_details = {
            ranks: 8,
            files: 8,
        },
        squares,
        pos;
    
    function error(str)
    {
        str = str || "Unknown error";
        
        alert("An error occured.\n" + str);
        throw new Error(str);
    }
    
    function check_el(el)
    {
        if (typeof el === "string") {
            return document.getElementById(el);
        }
        return el;
    }
    
    function get_init_pos()
    {
        ///NOTE: I made this a function so that we could pass other arguments, like chess varients.
        return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
    
    function make_square(x, y)
    {
        var el = document.createElement("div");
        
        el.classList.add("square");
        el.classList.add("rank" + y);
        el.classList.add("file" + x);
        
        if ((x + y) % 2) {
            el.classList.add("light");
        } else {
            el.classList.add("dark");
        }
        
        ///TODO: attach events
        
        return el;
    }
    
    function make_rank(num)
    {
        var el = document.createElement("div");
        
        el.classList.add("rank");
        el.classList.add("rank" + num);
        
        return el;
    }
    
    function size_board(w, h)
    {
        board_details.width = parseFloat(w);
        board_details.height = parseFloat(h);
        
        board.el.style.width  = board_details.width + "px";
        board.el.style.height = board_details.height + "px";
    }
    
    function make_board_num(num)
    {
        var el = document.createElement("div");
        
        el.classList.add("notation");
        el.classList.add("num");
        el.textContent = num + 1;
        
        return el;
    }
    
    function get_file_letter(num)
    {
        return String.fromCharCode(97 + num);
    }
    
    function make_board_letter(num)
    {
        var el = document.createElement("div");
        
        el.classList.add("notation");
        el.classList.add("letter");
        el.textContent = get_file_letter(num);
        
        return el;
    }
    
    function switch_turn()
    {
        if (board.turn === "w") {
            board.turn = "b";
        } else {
            board.turn = "w";
        }
    }
    
    function create_board(el, dim)
    {
        var x,
            y,
            cur_rank;
        
        if (el) {
            board.el = check_el(el);
        }
        
        board.el.innerHTML = "";
        
        /// Prevent I beam cursor.
        board.el.addEventListener("mousedown", function onboard_mouse_down(e)
        {
            e.preventDefault();
        });
        
        if (dim) {
            size_board(dim.w, dim.h);
        } else {
            size_board(600, 600);
        }
        
        squares = [];
        
        for (y = board_details.ranks - 1; y >= 0; y -= 1) {
            squares[y] = [];
            for (x = 0; x < board_details.files; x += 1) {
                squares[y][x] = make_square(x, y);
                if (x === 0) {
                    cur_rank = make_rank(y);
                    board.el.appendChild(cur_rank);
                    squares[y][x].appendChild(make_board_num(y));
                }
                if (y === 0) {
                    squares[y][x].appendChild(make_board_letter(x));
                }
                cur_rank.appendChild(squares[y][x]);
            }
        }
        
        board.el.classList.add("chess_board");
        
        return board;
    }
    
    function load_pieces_from_start()
    {
        var fen_pieces = pos.match(/^\S+/),
            rank = 7,
            file = 0,
            id = 0;
        
        ///TODO: Delete old pieces.
        pieces = [];
        
        if (!fen_pieces) {
            error("Bad position: " + pos);
        }
        
        fen_pieces[0].split("").forEach(function oneach(letter)
        {
            var piece;
            
            if (letter === "/") {
                rank -= 1;
                file = 0;
            } else if (/\d/.test(letter)) {
                file += parseInt(letter, 10);
            } else {
                /// It's a piece.
                piece = {};
                piece.type = letter.toLowerCase();
                /// Is it white?
                if (/[A-Z]/.test(letter)) {
                    piece.color = "w";
                } else {
                    piece.color = "b";
                }
                piece.rank = rank;
                piece.file = file;
                piece.id = id;
                pieces[pieces.length] = piece;
                file += 1;
                id += 1;
            }
        });
    }
    
    function is_piece_moveable(piece)
    {
        return board.mode === "setup" || (board.mode === "play" && board.legal_moves && board.turn === piece.color && board.players[board.turn].type === "human");
    }
    
    function is_left_click(e)
    {
        return (e.which || (e || window.event).button) === 1;
    }
    
    function add_piece_events(piece)
    {
        piece.el.addEventListener("mousedown", function onpiece_mouse_down(e)
        {
            ///TODO: Test and make sure it works on touch devices.
            if (is_left_click(e) && is_piece_moveable(piece)) {
                board.dragging = {};
                board.dragging.piece = piece;
                board.dragging.origin = {x: e.clientX, y: e.clientY};
                board.dragging.box = piece.el.getBoundingClientRect();
                
                board.el.classList.add("dragging");
                board.dragging.piece.el.classList.add("dragging");
            }
            if (e.preventDefault) {
                /// Prevent the cursor from becoming an I beam.
                e.preventDefault();
            }
        });
    }
    
    function prefix_css(el, prop, value)
    {
        el.style[prop] = value;
        el.style["Webkit" + prop[0].toUpperCase() + prop.substr(1)] = value;
        el.style["O" + prop[0].toUpperCase() + prop.substr(1)] = value;
        el.style["MS" + prop[0].toUpperCase() + prop.substr(1)] = value;
        el.style["Moz" + prop[0].toUpperCase() + prop.substr(1)] = value;
    }
    
    function onmousemove(e)
    {
        if (board.dragging && board.dragging.piece) {
            prefix_css(board.dragging.piece.el, "transform", "translate(" + (e.clientX - board.dragging.origin.x) + "px," + (e.clientY - board.dragging.origin.y) + "px)")
        }
    }
    
    function get_hovering_square(e)
    {
        var el,
            match,
            square = {},
            rank_m,
            file_m,
            /// Use the position of the middle of the piece being dragged, not necessarily the mouse cursor.
            x = e.clientX + ((board.dragging.box.left + Math.round(board.dragging.box.width / 2)) - board.dragging.origin.x),
            y = e.clientY + ((board.dragging.box.top + Math.round(board.dragging.box.height / 2)) - board.dragging.origin.y);
        
        el = document.elementFromPoint(x, y);
        
        if (el && el.className && el.classList.contains("square")) {
            rank_m = el.className.match(/rank(\d+)/);
            file_m = el.className.match(/file(\d+)/);
            
            if (rank_m) {
                square.rank = parseInt(rank_m[1], 10);
            }
            if (file_m) {
                square.file = parseInt(file_m[1], 10);
            }
        }
        if (!isNaN(square.rank) && !isNaN(square.file)) {
            square.el = el;
            return square;
        }
        
    }
    
    function is_legal_move(uci)
    {
        ///TODO: Determine how to underpromote.
        ///      We should first make sure it's a legal move before even asking.
        if (!board.legal_moves) {
            return false;
        }
        
        return board.legal_moves.uci.indexOf(uci) > -1;
    }
    
    function get_move(starting, ending)
    {
        if (starting && ending) {
            return get_file_letter(starting.file) + (parseInt(starting.rank, 10) + 1) + get_file_letter(ending.file) + (parseInt(ending.rank, 10) + 1);
        }
    }
    
    function create_promotion_icon(which, cb)
    {
        var icon = document.createElement("div");
        
        icon.addEventListener("click", function onclick()
        {
            cb(which);
        });
        
        icon.style.backgroundImage = get_piece_img({color: board.turn, type: which});
        
        icon.classList.add("promotion_icon");
        
        return icon;
    }
    
    function promotion_prompt(cb)
    {
        var mod_win = document.createElement("div"),
            text_el = document.createElement("div");
        
        mod_win.classList.add("board_modular_window");
        
        function close_window()
        {
            document.body.removeChild(mod_win);
            delete board.modular_window_close;
        }
        
        function onselect(which)
        {
            board.mode = "play";
            close_window();
            cb(which);
        }
        
        text_el.textContent = "Promote to";
        text_el.classList.add("promotion_text");
        
        mod_win.appendChild(text_el);
        
        mod_win.appendChild(create_promotion_icon("q", onselect));
        mod_win.appendChild(create_promotion_icon("r", onselect));
        mod_win.appendChild(create_promotion_icon("b", onselect));
        mod_win.appendChild(create_promotion_icon("n", onselect));
        
        document.body.appendChild(mod_win);
        board.mode = "waiting_for_modular_window";
        board.modular_window_close = close_window;
    }
    
    function report_move(uci, promoting, cb)
    {
        /// We make it async because of promotion.
        function record()
        {
            delete board.legal_moves;
            
            if (board.mode === "play" && board.onmove) {
                track_move(uci);
                board.onmove(uci);
            }
            
            if (cb) {
                cb(uci)
            }
        }
        
        if (promoting) {
            promotion_prompt(function onres(answer)
            {
                ///NOTE: The uci move already includes a promotion to queen to make it a valid move. We need to remove this and replace it with the desired promotion.
                uci = uci.substr(0, 4) + answer;
                record();
            });
        } else {
            setTimeout(record, 10);
        }
    }
    
    function set_piece_pos(piece, square)
    {
        piece.el.style.top = -(square.rank * 100) + "%";
        piece.el.style.bottom = (square.rank * 100) + "%";
        
        piece.el.style.left = (square.file * 100) + "%";
        piece.el.style.right = -(square.file * 100) + "%";
    }
    
    function get_san(uci)
    {
        if (!board.legal_moves) {
            return;
        }
        
        return board.legal_moves.san[board.legal_moves.uci.indexOf(uci)];
    }
    
    function promote_piece(piece, uci)
    {
        if (uci.length === 5 && /[qrbn]/.test(uci[4])) {
            piece.type = uci[4];
            piece.el.style.backgroundImage = get_piece_img(piece);
        }
    }
    
    function move_piece(piece, square, uci)
    {
        var captured_piece,
            rook,
            san = get_san(uci),
            rook_rank = board.turn === "w" ? 0 : 7; ///TODO: Use board_details.ranks
        
        set_piece_pos(piece, square);
        
        ///NOTE: This does not find en passant captures. See below.
        captured_piece = get_piece_from_rank_file(square.rank, square.file);
        
        if (board.mode === "play") {
            /// En passant
            if (!captured_piece && piece.type === "p" && piece.file !== square.file && ((piece.color === "w" && square.rank === board_details.ranks - 3) || (piece.color === "b" && square.rank === 2))) {
                captured_piece = get_piece_from_rank_file(piece.rank, square.file);
            }
            
            if (captured_piece && captured_piece.id !== piece.id) {
                capture(captured_piece);
            }
            
            /// Is it castling?
            ///TODO: Use board_details.files
            if (san === "O-O") { /// Kingside castle
                rook = get_piece_from_rank_file(rook_rank, 7);
                set_piece_pos(rook, {rank: rook_rank, file: 5});
                rook.file = 5;
            } else if (san === "O-O-O") { /// Queenside castle
                rook = get_piece_from_rank_file(rook_rank, 0);
                set_piece_pos(rook, {rank: rook_rank, file: 3});
                rook.file = 3;
            }
        }
        
        /// Make sure to change the rank and file after checking for a capured piece so that you don't capture yourself.
        piece.rank = square.rank;
        piece.file = square.file;
    }
    
    function is_promoting(piece, square)
    {
        if (!piece || !square) {
            return;
        }
        
        return piece.type === "p" && square.rank % (board_details.ranks - 1) === 0;
    }
    
    function onmouseup(e)
    {
        var square,
            uci,
            promoting,
            piece_storage;
        
        if (board.dragging && board.dragging.piece) {
            square = get_hovering_square(e);
            promoting = is_promoting(board.dragging.piece, square);
            
            uci = get_move(board.dragging.piece, square);
            
            if (promoting) {
                uci += "q"; /// We just add something to make sure it's a legal move. We'll ask the user later what he actually wants to promote to.
            }
            
            if (square && (board.mode === "setup" || is_legal_move(uci))) {
                piece_storage = board.dragging.piece;
                move_piece(board.dragging.piece, square, uci);
                report_move(uci, promoting, function onreport(finalized_uci)
                {
                    ///NOTE: Since this is async, we need to store which piece was moved.
                    promote_piece(piece_storage, finalized_uci);
                });
            } else {
                /// Snap back.
                ///TODO: Be able to remove pieces in setup mode.
            }
            
            prefix_css(board.dragging.piece.el, "transform", "none");
            board.dragging.piece.el.classList.remove("dragging");
            board.el.classList.remove("dragging");
            
            delete board.dragging;
        }
    }
    
    function get_piece_img(piece)
    {
        return "url(\"" + encodeURI("img/pieces/" + board.theme + "/" + piece.color + piece.type + (board.theme_ext || ".svg")) + "\")";
    }
    
    function set_board()
    {
        load_pieces_from_start();
        
        pieces.forEach(function oneach(piece)
        {
            if (!piece.el) {
                piece.el = document.createElement("div");
                
                piece.el.classList.add("piece");
                
                piece.el.style.backgroundImage = get_piece_img(piece)
                
                add_piece_events(piece);
            }
            
            /// We just put them all in the bottom left corner and more the position.
            squares[0][0].appendChild(piece.el);
            set_piece_pos(piece, {rank: piece.rank, file: piece.file});
        });
    }
    
    function wait()
    {
        board.mode = "wait";
        board.el.classList.add("waiting");
        board.el.classList.remove("playing");
    }
    
    function play()
    {
        board.turn = "w";
        board.mode = "play";
        board.el.classList.remove("waiting");
        board.el.classList.add("playing");
    }
    
    function get_piece_from_rank_file(rank, file)
    {
        var i;
        
        rank = parseInt(rank, 10);
        file = parseInt(file, 10);
        
        for (i = pieces.length - 1; i >= 0; i -= 1) {
            if (!pieces[i].captured && pieces[i].rank === rank && pieces[i].file === file) {
                return pieces[i];
            }
        }
    }
    
    function split_uci(uci)
    {
        var positions = {
            starting: {
                file: uci.charCodeAt(0) - 97,
                rank: parseInt(uci[1], 10) - 1
            },
            ending: {
                file: uci.charCodeAt(2) - 97,
                rank: parseInt(uci[3], 10) - 1
            }
        };
        
        if (uci.length === 5) {
            positions.promote_to = uci[4];
        }
        
        return positions;
    }
    
    function capture(piece)
    {
        piece.captured = true;
        piece.el.classList.add("captured");
    }
    
    function move_piece_uci(uci)
    {
        var positions = split_uci(uci),
            piece,
            captured_piece,
            ending_square;
        
        ending_square = {
            el: squares[positions.ending.rank][positions.ending.file],
            rank: positions.ending.rank,
            file: positions.ending.file
        };
        
        piece = get_piece_from_rank_file(positions.starting.rank, positions.starting.file);
        
        move_piece(piece, ending_square, uci);
        promote_piece(piece, uci);
    }
    
    function track_move(uci)
    {
        board.moves.push(uci);
        switch_turn();
    }
    
    function move(uci)
    {
        move_piece_uci(uci);
        track_move(uci);
    }
    
    board = {
        size_board: size_board,
        theme: "default",
        mode: "setup",
        wait: wait,
        play: play,
        move: move,
        players: {
            w: {
                type: "human",
            },
            b: {
                type: "ai",
            }
        },
        switch_turn: switch_turn
    /// moves: []
    /// legal_move[]
    /// onmove()
    };
    
    options = options || {};
    
    if (!options.pos) {
        pos = get_init_pos();
    }
    
    create_board(el, options.dim);
    
    set_board();
    
    window.addEventListener("mousemove", onmousemove);
    window.addEventListener("mouseup", onmouseup);
    
    return board;
};

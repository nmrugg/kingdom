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
            file = 0;
        
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
                pieces[pieces.length] = piece;
                file += 1;
            }
        });
    }
    
    function is_piece_moveable(piece)
    {
        return board.mode === "setup" || (board.mode === "play" && board.legal_moves && board.turn === piece.color);
    }
    
    function add_piece_events(piece)
    {
        piece.el.addEventListener("mousedown", function onpiece_mouse_down(e)
        {
            if (is_piece_moveable(piece)) {
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
        return board.legal_moves.uci.indexOf(uci) > -1;
    }
    
    function get_move(starting, ending)
    {
        return get_file_letter(starting.file) + (parseInt(starting.rank, 10) + 1) + get_file_letter(ending.file) + (parseInt(ending.rank, 10) + 1);
    }
    
    function report_move(move, is_promoting)
    {
        /// We make it async because of promotion.
        function record()
        {
            switch_turn();
            
            delete board.legal_moves;
            
            if (board.onmove) {
                board.onmove(move);
            }
        }
        
        if (is_promoting) {
            ///TODO: Ask...
            move += "q"; /// For now, defaulting to queen.
            setTimeout(record, 10);
        } else {
            setTimeout(record, 10);
        }
    }
    
    function onmouseup(e)
    {
        var square,
            move;
        
        if (board.dragging && board.dragging.piece) {
            ///TODO: Move it
            square = get_hovering_square(e);
            
            move = get_move(board.dragging.piece, square);
            
            if (square && is_legal_move(move)) {
                ///TODO: Underpromotion
                square.el.appendChild(board.dragging.piece.el);
                report_move(move, square.rank === 7);
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
    
    function set_board()
    {
        load_pieces_from_start();
        
        pieces.forEach(function oneach(piece)
        {
            if (!piece.el) {
                piece.el = document.createElement("div");
                
                piece.el.classList.add("piece");
                
                piece.el.style.backgroundImage = "url(\"" + encodeURI("img/pieces/" + board.theme + "/" + piece.color + piece.type + (board.theme_ext || ".svg")) + "\")";
                
                add_piece_events(piece);
            }
            
            squares[piece.rank][piece.file].appendChild(piece.el);
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
    
    board = {
        size_board: size_board,
        theme: "default",
        mode: "setup",
        wait: wait,
        play: play,
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

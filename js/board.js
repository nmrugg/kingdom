var BOARD = function board_init(el, options)
{
    "use strict";
    
    var pieces,
        board,
        board_details = {
            ranks: 8,
            files: 8
        },
        squares,
        pos;
    
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
        
        el.style.width  = board_details.width + "px";
        el.style.height = board_details.height + "px";
    }
    
    function make_board_num(num)
    {
        var el = document.createElement("div");
        
        el.classList.add("notation");
        el.classList.add("num");
        el.textContent = num + 1;
        
        return el;
    }
    
    function make_board_letter(num)
    {
        var el = document.createElement("div");
        
        el.classList.add("notation");
        el.classList.add("letter");
        el.textContent = String.fromCharCode(97 + num);
        
        return el;
    }
    
    function create_board(new_el, dim)
    {
        var x,
            y,
            i = 0,
            cur_rank;
        
        if (new_el) {
            el = check_el(new_el);
        }
        
        el.innerHTML = "";
        
        if (dim) {
            size_board(dim.w, dim.h);
        } else {
            size_board(600, 600);
        }
        
        squares = [];
        pieces = [];
        
        for (y = board_details.ranks - 1; y >= 0; y -= 1) {
            for (x = 0; x < board_details.files; x += 1) {
                squares[i] = make_square(x, y);
                if (x === 0) {
                    cur_rank = make_rank(y);
                    el.appendChild(cur_rank);
                    squares[i].appendChild(make_board_num(y));
                }
                if (y === 0) {
                    squares[i].appendChild(make_board_letter(x));
                }
                cur_rank.appendChild(squares[i]);
                i += 1;
            }
        }
        
        el.classList.add("chess_board");
        
        return board;
    }
    
    function set_board()
    {
        
    }
    
    options = options || {};
    
    el = check_el(el);
    
    if (!options.pos) {
        pos = get_init_pos();
    }
    
    create_board(el, options.dim);
    
    set_board();
    
    board = {
        create_board: create_board,
        set_board: set_board,
        size_board: size_board,
    };
    
    return board;
};

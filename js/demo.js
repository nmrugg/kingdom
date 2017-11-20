(function ()
{
    "use strict";
    
    var main = document.getElementById("main");
    var board1 = document.createElement("div");
    var board2 = document.createElement("div");
    
    var boardSize = 300;
    
    var fen1 = "rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 2 4";
    var fen2 = "q4k2/8/8/3R3P/5N2/6K1/8/8 w - - 0 1"
    
    function createBoard1(el)
    {
        var board = BOARD(el);
        board.size_board(boardSize, boardSize);
        board.set_board(fen1);
        board.wait(); /// Disable movement
        
        /// board.highlight_square(rank, file, color)
        ///NOTE: Both `rank` and `file` are numbers starting from a1 (0, 0).
        ///NOTE: `color` can be any of the following: "blue", "red", "green", "yellow", "teal", "orange", "purple", "pink"
        ///      These colors are defined in `board.highlight_colors` and the CSS is in board.css.
        board.highlight_square(2, 2, "red");
        board.highlight_square(3, 1, "green");
        
        /// board.arrow_manager.draw(startRank, startFile, endRank, endFile, CSSColor)
        ///NOTE: All ranks and files are numbers starting from a1 (0, 0).
        ///NOTE: `CSSColor` is any valid CSS color value, eg., "blue" or "rgba(0, 0, 240, .6)".
        ///      `board.color_values` has predefined CSS color values in the following order: "blue", "red", "green", "yellow", "teal", "orange", "purple", "pink"
        board.arrow_manager.draw(3, 1, 0, 4, board.color_values[board.highlight_colors.indexOf("red")]);
    }
    
    function createBoard2(el)
    {
        var board = BOARD(el);
        board.size_board(boardSize, boardSize);
        board.set_board(fen2);
        board.wait(); /// Disable movement
        
        /// board.highlight_square(rank, file, color)
        ///NOTE: Both `rank` and `file` are numbers starting from a1 (0, 0).
        ///NOTE: `color` can be any of the following: "blue", "red", "green", "yellow", "teal", "orange", "purple", "pink"
        ///      These colors are defined in `board.highlight_colors` and the CSS is in board.css.
        board.highlight_square(7, 3, "green");
        
        /// board.arrow_manager.draw(startRank, startFile, endRank, endFile, CSSColor)
        ///NOTE: All ranks and files are numbers starting from a1 (0, 0).
        ///NOTE: `CSSColor` is any valid CSS color value, eg., "blue" or "rgba(0, 0, 240, .6)".
        ///      `board.color_values` has predefined CSS color values in the following order: "blue", "red", "green", "yellow", "teal", "orange", "purple", "pink"
        board.arrow_manager.draw(4, 3, 7, 3, board.color_values[board.highlight_colors.indexOf("green")]);
    }
    
    function init()
    {
        createBoard1(board1);
        createBoard2(board2);
        
        main.appendChild(board1);
        main.appendChild(document.createElement("br"));
        main.appendChild(board2);
    }
    
    document.addEventListener("DOMContentLoaded", init);
}());

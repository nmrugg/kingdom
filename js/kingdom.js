(function ()
{
    "use strict";
    
    var board = BOARD("board");
    
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
    
    onresize();
    
    window.addEventListener("resize", onresize);
}());

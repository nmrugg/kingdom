(function ()
{
    "use strict";
    
    var board = BOARD("board"),
        engine,
        evaler;
    
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
            
            if (line.substr(0, 14) === "No such option") {
                /// Ignore invalid setoption commands since valid ones do not repond.
                return;
            }
            
            if (que[0].stream) {
                que[0].stream(line);
            }
            
            if (cur_message !== "") {
                cur_message += "\n";
            }
            
            cur_message += line;
            
            /// Try to determine if the steam is done.
            if (line === "uciok") {
                done = true;
                engine.loaded = true;
            } else if (line === "readyok") {
                done = true;
                engine.ready = true;
            } else if (line.substr(0, 8) === "bestmove") {
                /// A go command finished.
                done = true;
            } else if (que[0].cmd === "d" && line.substr(0, 15) === "Legal uci moves") {
                done = true;
            } else if (que[0].cmd === "eval" && /Total Evaluation[\s\S]+\n$/.test(cur_message)) {
                done = true;
            }
            ///NOTE: Stockfish.js does not support the "debug" or "register" commands.
            ///TODO: Add support for "perft", "bench", and "key" commands.
            
            if (done) {
                if (que[0].cb) {
                    que[0].cb(cur_message);
                }
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
                    steam: stream
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
                uci = str.match(/Legal uci moves\:(.*)/);
            
            if (!san || !uci) {
                error("Invalid d response: " + str);
            }
            
            cb({
                san: san[1].trim().split(" "),
                uci: uci[1].trim().split(" "),
            });
            
        });
    }
    
    function init()
    {
        var loading_el = document.createElement("div");
        
        loading_el.textContent = "Loading...";
        loading_el.classList.add("loading");
        
        document.documentElement.appendChild(loading_el);
        
        onresize();
        
        window.addEventListener("resize", onresize);
        
        board.wait();
        
        engine = load_engine();
        evaler = load_engine();
        
        engine.send("uci", function onuci(str)
        {
            //console.log(str);
            engine.send("isready", function onready()
            {
                console.log("ready");
                get_legal_moves(function (moves)
                {
                    loading_el.classList.add("hidden");
                    board.play();
                    board.set_legal_moves(moves);
                });
            });
        });
    }
    
    init();
}());

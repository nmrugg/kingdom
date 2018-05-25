/*jslint onevar: true, undef: true, newcap: true, nomen: true, regexp: true, plusplus: true, bitwise: true, node: true, indent: 4, white: false */

/// Usage: node static_server.js PORT

var http = require("http"),
    url  = require("url"),
    path = require("path"),
    fs   = require("fs"),
    port = process.argv[2] || 9864; /// Defaults to port 9864

function parse_range(headers, total)
{
    var match;
    var start;
    var end;
    if (headers && headers.range && typeof headers.range === "string" && total) {
        match = headers.range.match(/bytes=(\d+)(?:-(\d+))?/) || [];
        start = match[1] && match[1] >= 0 ? Number(match[1]) : 0;
        end = match[2] && match[2] > start && match[2] < total ? Number(match[2]) : total - 1;
        return {
            start: start,
            end: end
        };
    }
}

function get_mime(filename)
{
    var ext = path.extname(filename);
    
    if (ext === ".html" || ext === ".htm") {
        return "text/html";
    } else if (ext === ".css") {
        return "text/css";
    } else if (ext === ".js") {
        return "application/javascript";
    } else if (ext === ".png") {
        return "image/png";
    } else if (ext === ".jpg" || ext === ".jpeg") {
        return "image/jpeg";
    } else if (ext === ".gif") {
        return "image/gif";
    } else if (ext === ".pdf") {
        return "application/pdf";
    } else if (ext === ".webp") {
        return "image/webp";
    } else if (ext === ".txt") {
        return "text/plain";
    } else if (ext === ".svg") {
        return "image/svg+xml";
    } else if (ext === ".xml") {
        return "application/xml";
    } else if (ext === ".bin") {
        return "application/octet-stream";
    } else if (ext === ".ttf") {
        return "application/x-font-ttf";
    } else if (ext === ".woff") {
        return "application/font-woff";
    }
}

/// Start the server.
http.createServer(function (request, response)
{
    var cwd = process.cwd(),
        filename,
        uri = url.parse(request.url).pathname;
    
    filename = path.join(cwd, uri);
    
    /// Make sure the URI is valid and withing the current working directory.
    if (uri.indexOf("/../") !== -1 || uri[0] !== "/" || path.relative(cwd, filename).substr(0, 3) === "../") {
        response.writeHead(404, {"Content-Type": "text/plain"});
        response.write("404 Not Found\n");
        response.end();
        return;
    }
    
    function sendFile(filename)
    {
        fs.stat(filename, function (err, stats)
        {
            var responseHeaders = {};
            var range;
            var streamOptions = {"bufferSize": 4096};
            var code = 200;
            
            if (!err && stats.isDirectory()) {
                filename += "/index.html";
                return sendFile(filename);
            }
            
            fs.exists(filename, function(exists) {
                if (!exists) {
                    response.writeHead(404, {"Content-Type": "text/plain"});
                    response.write("404 Not Found\n");
                    response.end();
                    return;
                }
                
                responseHeaders["Content-Type"] = get_mime(filename);
                responseHeaders["Content-Length"] = stats.size;
                responseHeaders["Accept-Ranges"] = "bytes";
                
                range = parse_range(request.headers, stats.size);
                
                if (range) {
                    if (range.end <= range.start) {
                        /// Range not satisfiable.
                        response.writeHead(416);
                        response.end();
                        return;
                    }
                    streamOptions.start = range.start;
                    streamOptions.end = range.end;
                    responseHeaders["Content-Range"] = "bytes " + range.start + '-' + range.end + '/' + stats.size;
                    code = 206;
                }
                
                response.writeHead(code, responseHeaders);
                
                /// Stream the data out to prevent massive buffers on large files.
                fs.createReadStream(filename, streamOptions).pipe(response);
            });
        });
    }
    
    sendFile(filename)
}).listen(parseInt(port, 10));

console.log("http://localhost:" + port + "/\nCTRL + C to shutdown");

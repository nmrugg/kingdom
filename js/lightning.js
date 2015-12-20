/**
 * This contains code from akm2 licensed under the MIT license 2012 (jsdo.it/akm2).
 */

(function (global)
{
    /**
     * Using PerlinNoise class
     * Using Point class
     * @see http://jsdo.it/akm2/fhMC
     */
    
    var CHILD_NUM = 1;
    //var BACKGROUND_COLOR = 'rgba(0, 15, 20, 0.8)';
    var BACKGROUND_COLOR = "transparent";
    //var BACKGROUND_COLOR = "rgb(200,200,200)";
    
    // Color
    var H = 195;
    var S = 100;
    var L_MAX = 85;
    var L_MIN = 45;
    var default_alpha = 0.3;
    
    var mouse = new LIGHTNING.lib.Point();
    
    document.addEventListener('mousemove', mouseMove, false);
    
    function mouseMove(e) {
        mouse.set(e.clientX, e.clientY);
        /*
        var hit = false;
        for (var i = 0, len = dragPoints.length; i < len; i++) {
            if (dragPoints[i].hitTest(mouse)) {
                hit = true;
                break;
            }
        }
        document.body.style.cursor = hit ? 'pointer' : 'default';
        */
    }
    
    if (!global.LIGHTNING) {
        global.LIGHTNING = {};
    }
    
    function get_point_on_line(sp, ep, d)
    {
        /// Create the vector.
        var vx = ep.x - sp.x,
            vy = ep.y - sp.y,
            len;
        
        /// Get the vector length.
        len = Math.sqrt(vx * vx + vy * vy);
        
        /// Normalize, scale and add the vector to the starting point.
        return {x: sp.x + (vx / len * d), y: sp.y + (vy / len * d)};
    }
    
    function create_dot(x, y)
    {
        var dot = document.createElement("div");
        dot.style.position = "absolute";
        dot.style.left = (x - 1) + "px";
        dot.style.top = (y - 1) + "px";
        dot.style.zIndex = "9999";
        dot.style.width = "3px";
        dot.style.height = "3px";
        dot.style.backgroundColor = "rgba(255, 0, 0, .7)";
        dot.style.pointerEvents = "none";
        document.body.appendChild(dot);
    }
    
    function drawLine(options)
    {
        var radius = options.radius,
            speed = options.speed,
            delay = options.delay;
        
        var canvas;
        var context;
        var lightPoints = [];
        
        var baseLine;
        var lightningLine;
        var NoiseLine;
        var half_min_dim;
        var distance = 0;
        var box = {};
        var lineHue = H;
        var reached_end;
        
        if (typeof options.hue !== "undefined") {
            lineHue = options.hue;
        }
        
        options.points.forEach(function (point)
        {
            if (typeof box.left === "undefined" || point.x < box.left) {
                box.left = point.x;
            }
            if (typeof box.right === "undefined" || point.x > box.right) {
                box.right = point.x;
            }
            if (typeof box.top === "undefined" || point.y < box.top) {
                box.top = point.y;
            }
            if (typeof box.bottom === "undefined" || point.y > box.bottom) {
                box.bottom = point.y;
            }
        });
        
        if (!radius || radius < 0) {
            radius = 50;
        }
        
        if (!speed || speed < 0) {
            speed = 50;
        }
        
        half_min_dim = Math.max(130, radius) / 2;
        
        //box.offsetLeft = box.left - half_min_dim;
        //box.offsetTop = box.top - half_min_dim;
        
        box.left -= half_min_dim;
        box.right += half_min_dim;
        box.top -= half_min_dim;
        box.bottom += half_min_dim;
        
        box.padding = half_min_dim;
        
        /*
        if (box.right - box.left < min_dim) {
            box.left = (Math.abs(x1 + x2) / 2) - (min_dim / 2);
            box.right = (Math.abs(x1 + x2) / 2) + (min_dim / 2);
        }
        if (box.bottom - box.top < min_dim) {
            box.top = (Math.abs(y1 + y2) / 2) - (min_dim / 2);
            box.bottom = (Math.abs(y1 + y2) / 2) + (min_dim / 2);
        }
        */
        box.width = box.right - box.left;
        box.height = box.bottom - box.top;
        
        //console.log(box)
        
        var timer;
    
        function init() {
            /*
            var cwidth = radius * 2.6;
            if (cwidth < 130) {
                cwidth = 130;
            }
            */
            //document.body.style.backgroundColor = BACKGROUND_COLOR;
            //canvas = document.getElementById('c');
            canvas = document.createElement("canvas");
            canvas.style.pointerEvents = "none";
            canvas.style.position = "absolute";
            //canvas.style.backgroundColor = "rgba(0,0,0,.3)";
            canvas.style.left = box.left + "px";
            canvas.style.top = box.top + "px";
            document.body.appendChild(canvas);
            
            //document.addEventListener('resize', resize, false);
            //resize();
            //canvas.width = cwidth;
            //canvas.height = 400;
            
            canvas.width = box.width;
            canvas.height = box.height;
            //console.log(canvas.width, canvas.height, canvas.style.top, canvas.style.left)
            
            context = canvas.getContext('2d');
            context.lineCap = 'round';
            
            var i;
            
            for (i = 0; i < options.points.length; i++) {
                //lightPoints.push(new LightPoint(canvas.width * random(), canvas.height * random()));
                lightPoints[i] = new LightPoint(canvas.width / 2, canvas.height, options.points[i].radius || radius);
                //lightPoints[i].alpha = 0.75;
                lightPoints[i].alpha = default_alpha;
                lightPoints[i].orig_radius = lightPoints[i].radius;
                //lightPoints[i].y -= lightPoints[i].radius;
                lightPoints[i].x = options.points[i].x - box.left;
                lightPoints[i].y = options.points[i].y - box.top;
                if (typeof options.points[i].hue === "undefined") {
                    lightPoints[i].hue = lineHue;
                } else {
                    lightPoints[i].hue = options.points[i].hue;
                }
                
            }
            
            var baseNoiseOpts      = { base: 10, amplitude: 0.3, speed: 0.02 };
            var lightningNoiseOpts = { base: 30, amplitude: 0.2, speed: 0.05 };
            var childNoiseOpts     = { base: 20, amplitude: 0.2, speed: 0.08 };
            
            baseLine      = new NoiseLine(8,  baseNoiseOpts);
            lightningLine = new NoiseLine(16, lightningNoiseOpts);
            for (i = 0; i < CHILD_NUM; i++) {
                lightningLine.createChild(childNoiseOpts);
            }
            // *** Debug
            //baseLine.debug = true;
            // *********
            
            timer = setInterval(loop, 1000 / 30);
        }
        
        function fade_out(cb)
        {
            var change = 0.4;
            
            function tick(amt)
            {
                setTimeout(function ontick()
                {
                    fade_it(amt);
                }, 16);
            }
            
            function fade_it(amt)
            {
                if (amt >= 0) {
                    canvas.style.opacity = amt;
                    tick(amt - change);
                } else {
                    canvas.style.opacity = 0;
                    if (cb) {
                        setTimeout(cb, 10);
                    }
                }
            }
            
            tick(1);
        }
        
        var start = Date.now();
        
        function loop() {
            var new_point,
                reached_x, reached_y, surpassed_x, surpassed_y;
            
            context.globalCompositeOperation = 'source-over';
            //context.fillStyle = BACKGROUND_COLOR;
            //context.fillRect(0, 0, canvas.width, canvas.height);
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            context.globalCompositeOperation = 'lighter';
            
            var i, len, p;
            
            var controls = [];
            
            //lightPoints[1].update(20, 40);
            /*
            if (Date.now() - start > delay) {
                //new_point_x = .5 * (7-1) + 1
                //count += 1;
                
                distance += speed;
                //console.log(distance)
                
                new_point = get_point_on_line({x: x1, y: y1}, {x: x2, y: y2}, distance);
                
                if (new_point.x === x2) {
                    reached_x = true;
                } else if (x1 > x2) {
                    if (new_point.x < x2) {
                        surpassed_x = true;
                    }
                } else {
                    if (new_point.x > x2) {
                        surpassed_x = true;
                    }
                }
                if (new_point.y === y2) {
                    reached_y = true;
                } else if (y1 > y2) {
                    if (new_point.y < y2) {
                        surpassed_y = true;
                    }
                } else {
                    if (new_point.y > y2) {
                        surpassed_y = true;
                    }
                }
                
                if (surpassed_x || surpassed_y || (reached_x && reached_y)) {
                    reached_end = true;
                    new_point = {x: x2, y: y2};
                }
                //console.log(new_point)
                //create_dot(new_point.x + box.left, new_point.y + box.top)
                //create_dot(new_point.x, new_point.y)
                lightPoints[1].update(new_point.x - box.left, new_point.y - box.top);
            } else {
                lightPoints[1].update();
            }
            */
            
            //lightPoints[0].update();
            //lightPoints[1].update();
            
            
            for (i = 0, len = lightPoints.length; i < len; i++) {
                p = lightPoints[i];
                p.update();
                //p.update(20, 40);
                //p.alpha = p.hitTest(mouse) ? 0.9 : 0.2;
                /// Is the mouse over a point?
                if (p.hitTest(mouse)) {
                    p.alpha = 0.9;
                    p.radius = p.orig_radius * 1.5;
                } else {
                    p.alpha = default_alpha;
                    p.radius = p.orig_radius;
                }
                
                //console.log(p.hitTest(mouse))
                //console.log(p.alpha)
                //p.alpha = 0.75;
                /// Change color of a point here. (And below)
                ///**
                Color.h = p.hue;
                //*/
                p.draw(context);
                if (p.dead) {
                    lightPoints.splice(i, 1);
                    i--;
                    len--;
                    continue;
                }
                if (!p.dying) {
                    controls.push(p);
                }
            }
            /// Reset color here.
            Color.h = lineHue;
            
            // Sorted by the distance from the origin
            //controls.sort(sortPoints);
            
            baseLine.update(controls);
            
            lightningLine.update(baseLine.points);
            //drawLightningBlur(lightningLine, 50, 30);
            drawLightningLine(lightningLine, 0.75, 1, 1, 5);
            drawLightningCap(lightningLine);
            
            lightningLine.eachChild(function(child, i) {
                drawLightningLine(child, 0, 1, 0, 4);
                //drawLightningBlur(child, 50, 30);
            });
            
            Color.l = randomRange(L_MIN, L_MAX);
            
            //if (lightPoints[1].y <= box.padding) {
            if (reached_end) {
                for (i = 0, len = lightPoints.length; i < len; i++) {
                    lightPoints[i].kill();
                }
                clearInterval(timer);
                fade_out(function onfade()
                {
                    if (canvas.parentNode) {
                        canvas.parentNode.removeChild(canvas);
                    }
                });
            }
            
            // * debug
            //Debug.exec();
        }
        
        // Array sort callback
        function sortPoints(p1, p2) {
            return p1.length() - p2.length();
        }
        
        
        // Lightning draw methods
        
        function drawLightningLine(line, maxAlpha, minAlpha, maxLineW, minLineW) {
            context.beginPath();
            context.strokeStyle = Color.setAlphaToString(randomRange(minAlpha, maxAlpha));
            context.lineWidth   = randomRange(minLineW, maxLineW);
            line.eachPoints(function(p, i) {
                context[i === 0 ? 'moveTo' : 'lineTo'](p.x, p.y);
            });
            context.stroke();
        }
        
        function drawLightningBlur(line, blur, maxSize) {
            var dist;
            context.save();
            context.fillStyle = 'rgba(0, 0, 0, 1)';
            context.shadowBlur = blur;
            context.shadowColor = Color.setAlphaToString();
            context.beginPath();
            line.eachPoints(function(p, i, len) {
                dist = len > 1 ? p.distance(this[i === len - 1 ? i - 1 : i + 1]) : 0;
                if (dist > maxSize) dist = maxSize;
                context.moveTo(p.x + dist, p.y);
                context.arc(p.x, p.y, dist, 0, Math.PI * 2, false);
            });
            context.fill();
            context.restore();
        }
        
        function drawLightningCap(line) {
            var points = line.points;
            var p, radius, gradient;
            for (var i = 0, len = points.length; i < len; i += len - 1) {
                p = points[i];
                radius = randomRange(3, 8);
                gradient = context.createRadialGradient(p.x, p.y, radius / 3, p.x, p.y, radius);
                gradient.addColorStop(0, Color.setAlphaToString(1));
                gradient.addColorStop(1, Color.setAlphaToString(0));
                context.fillStyle = gradient;
                context.beginPath();
                context.arc(p.x, p.y, radius, 0, Math.PI * 2, false);
                context.fill();
            }
        }
        
        
        // Helper
        
        function randomRange(min, max) {
            return Math.random() * (max - min) + min;
        }
        
        
        (function() {
            //PerlinNoise.useClassic = true;
            var perlinNoise = new LIGHTNING.lib.PerlinNoise();
            perlinNoise.octaves(3);
            
            /**
             * NoiseLine
             * 
             * @param segmentsNum (The number of divisions between the control points)
             * @param noiseOptions
             */
            NoiseLine = function NoiseLine (segmentsNum, noiseOptions) {
                this.segmentsNum = segmentsNum;
        
                this.noiseOptions = LIGHTNING.lib.extend({
                    base: 30,
                    amplitude: 0.5,
                    speed: 0.002,
                    offset: 0
                }, noiseOptions);
                
                this.points = [];
                this.lineLength = 0;
                this.children = [];
            };
        
            NoiseLine.prototype = {
                createChild: function(noiseOptions) {
                    var child = new NoiseLineChild(this, noiseOptions || this.noiseOptions);
                    this.children.push(child);
                    return child;
                },
                
                eachChild: function(callback) {
                    var children = this.children;
                    for (var i = 0, len = children.length; i < len; i++) {
                        callback.call(children, children[i], i, len);
                    }
                },
        
                eachPoints: function(callback) {
                    var points = this.points;
                    for (var i = 0, len = points.length; i < len; i++) {
                        callback.call(points, points[i], i, len);
                    }
                },
        
                update: function(controls) {
                    var i, len;
                    
                    // Get the distance connecting the control points all straight for use as coefficients in the swing width
                    var lineLength = 0;
                    for (i = 0, len = controls.length; i < len; i++) {
                        if (i === len - 1) break;
                        lineLength += controls[i].distance(controls[i + 1]);
                    }
                    this.lineLength = lineLength;
                    
                    // Apply noise by generating a spline curve
                    this.noise(spline(controls, this.segmentsNum), lineLength);
                    
                    /*
                    // *** Debug
                    if (Debug.enabled && this.debug) {
                        this.eachPoints(function(p, i) {
                            Debug.addCommand(function() { Debug.point(p.x, p.y, 3, 'blue'); });
                        });
                    }
                    // *********
                    */
                    
                    // Get shortest distance
                    this.points = shortest(this.points);
                    
                    /*
                    // *** Debug
                    if (Debug.enabled && this.debug) {
                        this.eachPoints(function(p, i) {
                            Debug.addCommand(function() { Debug.point(p.x, p.y, 3, 'red'); });
                        });
                    }
                    // *********
                    */
                    
                    // Update children
                    var children = this.children;
                    for (i = 0, len = children.length; i < len; i++) {
                        children[i].update();
                    }
                },
                
                noise: function(bases, range) {
                    var pointsOld = this.points;
                    var points = this.points = [];
                    
                    var opts = this.noiseOptions;
                    var base = opts.base;
                    var amp = opts.amplitude;
                    var speed = opts.speed;
                    var offset = opts.offset += Math.random() * speed;
                    
                    var p, next, angle, sin, cos, av, ax, ay, bv, bx, by, m, px, py;
                    
                    for (var i = 0, len = bases.length; i < len; i++) {
                        p = bases[i];
                        next = i === len - 1 ? p : bases[i + 1];
                        
                        if (!next) {
                            break;
                        }
                        angle = next.subtract(p).angle();
                        sin = Math.sin(angle);
                        cos = Math.cos(angle);
                        
                        av = range * perlinNoise.noise(i / base - offset, offset) * 0.5 * amp;
                        ax = av * sin;
                        ay = av * cos;
        
                        bv = range * perlinNoise.noise(i / base + offset, offset) * 0.5 * amp;
                        bx = bv * sin;
                        by = bv * cos;
        
                        m = Math.sin(Math.PI * (i / (len - 1)));
        
                        px = p.x + (ax - bx) * m;
                        py = p.y - (ay - by) * m;
        
                        points.push(pointsOld.length ? pointsOld.shift().set(px, py) : new LIGHTNING.lib.Point(px, py));
                        
                        // *** Debug
                        /*
                        if (Debug.enabled && this.debug) {
                            Debug.addCommand((function(p, angle) {
                                return function() {
                                    context.save();
                                    context.translate(p.x, p.y);
                                    context.rotate(angle);
                                    this.line(0, 0, 15, 0, 'pink', 1);
                                    this.point(0, 0, 2, 'pink');
                                    context.restore();
                                };
                            })(p, angle));
                        }
                        // *********
                        */
                    }
                }
            };
        
        
            /**
             * NoiseLineChild
             * 
             * @super NoiseLine
             */
            function NoiseLineChild(parent, noiseOptions) {
                this.parent = lightningLine;
                this._lastChangeTime = 0;
                NoiseLine.call(this, 0, noiseOptions || lightningLine.noiseOptions);
            }
        
            NoiseLineChild.prototype = LIGHTNING.lib.extend({}, NoiseLine.prototype, {
                startStep: 0,
                endStep: 0,
                
                // Clear super class methods
                createChild: undefined,
                eachChild: undefined,
        
                update: function() {
                    var parent = this.parent;
                    var plen = parent.points.length;
        
                    // Regular intervals or to update the acquisition position of the parent of the start and end points if the number of parent point is below the end step position of the child.
                    var currentTime = new Date().getTime();
                    if (currentTime - this._lastChangeTime > 10000 * Math.random() || plen < this.endStep) {
                        var stepMin = Math.floor(plen / 10);
                        var startStep = this.startStep = Math.floor(Math.random() * Math.floor(plen / 3 * 2));
                        this.endStep = startStep + stepMin + Math.floor(Math.random() * (plen - startStep - stepMin) + 1);
                        this._lastChangeTime = currentTime;
                    }
        
                    // I cut out the acquisition range from the parent of the point array
                    var range = parent.points.slice(this.startStep, this.endStep);
                    var rangeLen = range.length;
                    
                    // I get the control points of the spline curve from range
                    var sep = 2; // Division number
                    var seg = (rangeLen - 1) / sep;
                    var controls = [];
                    var i, j;
                    for (i = 0; i <= sep; i++) {
                        j = Math.floor(seg * i);
                        controls.push(range[j]);
                    }
                    /*
                    // *** Debug
                    if (Debug.enabled) {
                        (function() {
                            for (var i = 0, len = controls.length - 1, p, n; i < len; i++) {
                                p = controls[i];
                                Debug.addCommand((function(p) {
                                    return function() { Debug.point(p.x, p.y, 3, 'yellow'); };
                                })(p));
                            }
                        })();
                    }
                    // *********
                    */
                    
                    // Generate spline curve
                    var base = spline(controls, Math.floor(rangeLen / 3));
                    
                    /*
                    // *** Debug
                    if (Debug.enabled) {
                        (function() {
                            for (var i = 0, len = base.length - 1, p, n; i < len; i++) {
                                p = base[i];
                                n = base[i + 1];
                                Debug.addCommand((function(p, n) {
                                    return function() { Debug.line(p.x, p.y, n.x, n.y, 'yellow', 1); };
                                })(p, n));
                            }
                        })();
                    }
                    */
                    // *********
                    
                    // Apply noise
                    if (!controls[0]) {
                        return;
                    }
                    this.noise(base, controls[0].distance(controls[2]));
                    // Get shortest distance
                    this.points = shortest(this.points);
                }
            });
            
            function spline(controls, segmentsNum) {
                // Starting point of the line before and after the array for the spline supplement; I replicate each a reference to the end point
                controls.unshift(controls[0]);
                controls.push(controls[controls.length - 1]);
        
                // Get the point of the spline curve
                var points = [];
                var p0, p1, p2, p3, t;
                var j;
                for (var i = 0, len = controls.length - 3; i < len; i++) {
                    p0 = controls[i];
                    p1 = controls[i + 1];
                    p2 = controls[i + 2];
                    p3 = controls[i + 3];
                    
                    for (j = 0; j < segmentsNum; j++) {
                        t = (j + 1) / segmentsNum;
                        
                        points.push(new LIGHTNING.lib.Point(
                            catmullRom(p0.x, p1.x, p2.x, p3.x, t),
                            catmullRom(p0.y, p1.y, p2.y, p3.y, t)
                        ));
                    }
                }
        
                // Remove the reference that was added for the complement
                controls.pop();
                // Add as a starting point of drawing to delete incidentally
                points.unshift(controls.shift());
                
                return points;
            }
            
            /**
             * Catmull-Rom Spline Curve
             * 
             * @see http://l00oo.oo00l.com/blog/archives/264
             */
            function catmullRom(p0, p1, p2, p3, t) {
                var v0 = (p2 - p0) / 2;
                var v1 = (p3 - p1) / 2;
                return (2 * p1 - 2 * p2 + v0 + v1) * t * t * t + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t * t + v0 * t + p1;
            }
            
            function shortest(bases) {
                var points = [bases[0]];
                var p, j, p2, dist, minDist, k;
                for (var i = 0, len = bases.length; i < len; i++) {
                    p = bases[i];
        
                    minDist = Infinity;
                    k = -1;
                    for (j = i; j < len; j++) {
                        if ((p2 = bases[j]) !== p && (dist = p.distance(p2)) < minDist) {
                            minDist = dist;
                            k = j;
                        }
                    }
                    if (k < 0) break;
        
                    points.push(bases[k]);
                    i = k - 1;
                }
        
                return points;
            }
            
        })();
        
        
        /**
         * LightPoint
         * 
         * @super Point http://jsdo.it/akm2/fhMC
         */
        function LightPoint(x, y, radius) {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.alpha = 0.2;
            this.dragging = false;
            this.dying = false;
            this.dead = false;
            
            this._v = new LIGHTNING.lib.Point(randomRange(-3, 3), randomRange(-3, 3));
            
            this._mouse = null;
            this._latestMouse = new LIGHTNING.lib.Point();
            this._mouseDist = null;
            
            this._currentAlpha = 0;
            this._currentRadius = 0;
        }
        
        LightPoint.prototype = LIGHTNING.lib.extend({}, LIGHTNING.lib.Point.prototype, {
            hitTest: function(mouse) {
                return this.distance({x: mouse.x - box.left, y: mouse.y - box.top}) < this.radius;
            },
            kill: function() {
                this.dying = true;
                this.radius = 0;
            },
        
            update: function(x, y) {
                var v = this._v;
                
                
                if (typeof x !== "undefined") {
                    this.x = x;
                }
                if (typeof y !== "undefined") {
                    this.y = y;
                }
                
                var d;
                // Alpha
                d = this.alpha - this._currentAlpha;
                if ((d < 0 ? -d : d) > 0.001) this._currentAlpha += d * 0.1;
                // Radius
                d = this.radius - this._currentRadius;
                if ((d < 0 ? -d : d) > 0.01) {
                    this._currentRadius += d * 0.35;
                } else if (this.dying) {
                    this.dead = true;
                }
                this._currentRadius *= randomRange(0.9, 1);
            },
        
            draw: function(ctx) {
                var radius = this._currentRadius;
                var gradient = ctx.createRadialGradient(this.x, this.y, radius / 3, this.x, this.y, radius);
                gradient.addColorStop(0, Color.setAlphaToString(this._currentAlpha));
                gradient.addColorStop(1, Color.setAlphaToString(0));
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(this.x + radius, this.y);
                ctx.arc(this.x, this.y, radius, 0, Math.PI * 2, false);
                ctx.fill();
            }
        });
        
        
        /**
         * Color
         */
        var Color = (function() {
            var o = {};
            o.h = H;
            o.s = S;
            o.l = L_MAX;
            
            /// Rotate through colors.
            /**
            setInterval(function ()
            {
                o.h += 1;
                if (o.h > 256) {
                    o.h = 0;
                }
            }, 10)
            */
            
            o.setAlphaToString = function(alpha) {
                if (typeof alpha === 'undefined' || alpha === null) {
                    return 'hsl(' + o.h + ', ' + o.s + '%, ' + o.l + '%)';
                }
                return 'hsla(' + o.h + ', ' + o.s + '%, ' + o.l + '%, ' + alpha + ')';
            };
            return o;
        }());
        
        
        // Init
        /*
        window.onload = function() {
            init();
        };
        */
        
        
        //-----------------------------------------
        // DEBUG
        //-----------------------------------------
        /*
        var Debug = {
            enabled: false,
            _commands: [],
            
            addCommand: function(fn) {
                if (this.enabled) this._commands.push(fn);
            },
            
            exec: function() {
                if (this.enabled) {
                    var commands = this._commands;
                    for (var i = 0, len = commands.length; i < len; i++) {
                        commands[i].call(this);
                    }
                    this._commands = [];
                }
            },
            
            line: function(x1, y1, x2, y2, color, lineWidth) {
                if (this.enabled) {
                    context.save();
                    context.globalCompositeOperation = 'source-over';
                    context.strokeStyle = color;
                    context.lineWidth = !lineWidth ? 1 : lineWidth;
                    context.beginPath();
                    context.moveTo(x1, y1);
                    context.lineTo(x2, y2);
                    context.stroke();
                    context.restore();
                }
            },
            
            point: function(x, y, radius, color) {
                if (this.enabled) {
                    context.save();
                    context.globalCompositeOperation = 'source-over';
                    context.fillStyle = color;
                    context.beginPath();
                    context.arc(x, y, radius, 0, Math.PI * 2, false);
                    context.fill();
                    context.restore();
                }
            }
        };
        */
        
        init();
        
        return {
            kill: function kill()
            {
                reached_end = true;
            }
        };
    }
    
    global.LIGHTNING.drawLine = drawLine;
    //setTimeout(function () {drawLine({radius: 50, hue: 100,points:[{x:100, y: 100},{x:200,y:200, hue:50,radius: 30},{x:300,y:200},{x:400,y:300,hue:0}]})}, 100);
    /*
    setTimeout(function () {
        var line = drawLine({points:[{x:100, y: 100},{x:200,y:200, hue:50,radius: 30},{x:300,y:200},{x:400,y:300,hue:0}]});
        setTimeout(line.kill, 2000);
    }, 100);
    */
    /*
    setTimeout(function () {shoot(550, 400, 950, 320)}, 100);
    setTimeout(function () {shoot(950, 453, 30, 20, 50, 200)}, 100);
    setTimeout(function () {shoot(850, 53, 30, 420, 50, 50)}, 200);
    setTimeout(function () {shoot(900, 100, 1100, 100, 10, 30)}, 500);
    */
    //setTimeout(function () {shoot(250, 500, 250, -50)}, 100);
    //setTimeout(function () {shoot(450, 400, 450, 0)}, 100);
    //setTimeout(function () {shoot(550, 400, 550, 320)}, 100);
    //setTimeout(function () {shoot( 50, 400,  50, 0)}, 100);
    //setTimeout(function () {shoot(150, 400, 150, 0, 20)}, 100);
    //setTimeout(function () {shoot(250, 400, 250, 0, 75)}, 100);
    //setTimeout(function () {shoot(350, 400, 350, 0)}, 100);
    //setTimeout(function () {shoot(450, 400, 450, -50, 0, 0, 700)}, 100);
    //setTimeout(function () {shoot(550, 400, 550, 100)}, 2000);
}(window));

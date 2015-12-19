(function(global) {

if (!global.LIGHTNING) {
    global.LIGHTNING = {};
}

global.LIGHTNING.lib = {};


function isObject(value, ignoreArray) {
    return typeof value === "object" && value !== null;
}

function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
}


/**
 * extend
 */
function extend() {
    var target = arguments[0] || {}, o, p;

    for (var i = 1, len = arguments.length; i < len; i++) {
        o = arguments[i];

        if (!isObject(o)) continue;

        for (p in o) {
            target[p] = o[p];
        }
    }

    return target;
}

global.LIGHTNING.lib.extend = extend;



    
/**
 * Debug
 */
(function(global) {
    
    var limit = 0;
    var count = 0;
    
    function log() {
        if (limit > 0) {
            if (limit === count) return;
            count++;
        }
        window.console.log.apply(window.console, arguments);
    }
    
    log.limit = function(limitCount) {
        limit = limitCount < 0 ? 0 : limitCount;
    };
    
    global.LIGHTNING.lib.log = log;
    
})(window);


/**
 * Point
 */
function Point(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

Point.create = function(o, y) {
    if (isArray(o)) return new Point(o[0], o[1]);
    if (isObject(o)) return new Point(o.x, o.y);
    return new Point(o, y);
};

Point.add = function(p1, p2) {
    return new Point(p1.x + p2.x, p1.y + p2.y);
};

Point.subtract = function(p1, p2) {
    return new Point(p1.x - p2.x, p1.y - p2.y);
};

Point.scale = function(p, scaleX, scaleY) {
    if (isObject(scaleX)) {
        scaleY = scaleX.y;
        scaleX = scaleX.x;
    } else if (typeof scaleY !== "number") {
        scaleY = scaleX;
    }
    return new Point(p.x * scaleX, p.y * scaleY);
};

Point.equals = function(p1, p2) {
    return p1.x == p2.x && p1.y == p2.y;
};

Point.angle = function(p) {
    return Math.atan2(p.y, p.x);
};

Point.distance = function(p1, p2) {
    var a = p1.x - p2.x;
    var b = p1.y - p2.y;
    return Math.sqrt(a * a + b * b);
};

Point.dot = function(p1, p2) {
    return p1.x * p2.x + p1.y * p2.y;
};

Point.cross = function(p1, p2) {
    return p1.x * p2.y - p1.y * p2.x;
};

Point.interpolate = function(p1, p2, f) {
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    return new Point(p1.x + dx * f, p1.y + dy * f);
};

// Test
Point.polar = function(length, radian) {
    return new Point(length * Math.sin(radian), length * Math.cos(radian));
};

Point.prototype = {    
    add: function(p) {
        return Point.add(this, p);
    },
    
    subtract: function(p) {
        return Point.subtract(this, p);
    },
    
    scale: function(scaleX, scaleY) {
        return Point.scale(this, scaleX, scaleY);
    },
    
    equals: function(p) {
        return Point.equals(this, p);
    },
    
    angle: function() {
        return Point.angle(this);
    },
    
    distance: function(p) {
        return Point.distance(this, p);
    },
    
    length: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    },
    
    set: function(x, y) {
        if (isObject(x)) {
            y = x.y;
            x = x.x;
        }
        
        this.x = x || 0;
        this.y = y || 0;
        
        return this;
    },
    
    offset: function(x, y) {
        if (isObject(x)) {
            y = x.y;
            x = x.x;
        }
        
        this.x += x || 0;
        this.y += y || 0;
        
        return this;
    },
    
    normalize: function(thickness) {
        if (thickness === null || typeof thickness === "undefined") {
            thickness = 1;
        }
        
        var length = this.length();
        
        if (length > 0) {
            this.x = this.x / length * thickness;
            this.y = this.y / length * thickness;
        }
        
        return this;
    },
    
    negate: function() {
        this.x *= -1;
        this.y *= -1;
        
        return this;
    },
    
    perp: function() {
        this.x = - y;
        this.y = x;
        
        return this;
    },
    
    clone: function() {
        return Point.create(this);
    },

    toArray: function() {
        return [this.x, this.y];
    },
    
    toString: function() {
        return '(x:' + this.x + ', y:' + this.y + ')';
    }
};

global.LIGHTNING.lib.Point = Point;




var Xorshift = (function() {
    /**
     * Random numbers generator
     * 
     * @see http://baagoe.com/en/RandomMusings/javascript/
     */
    
    function Xorshift() {
        var self = this;
        var seeds = (arguments.length) ? Array.prototype.slice.call(arguments) : [new Date().getTime()];
               
        var x = 123456789;
        var y = 362436069;
        var z = 521288629;
        var w = 88675123;
        var v = 886756453;

        self.uint32 = function() {
            var t = (x ^ (x >>> 7)) >>> 0;
            x = y;
            y = z;
            z = w;
            w = v;
            v = (v ^ (v << 6)) ^ (t ^ (t << 13)) >>> 0;
            return ((y + y + 1) * v) >>> 0;
        };

        self.random = function() {
            return self.uint32() * 2.3283064365386963e-10;
        };

        self.fract53 = function() {
            return self.random() + (self.uint32() & 0x1fffff) * 1.1102230246251565e-16;
        };

        for (var i = 0, len = seeds.length, seed; i < len; i++) {
            seed = seeds[i];
            x ^= mash(seed) * 0x100000000;
            y ^= mash(seed) * 0x100000000;
            z ^= mash(seed) * 0x100000000;
            v ^= mash(seed) * 0x100000000;
            w ^= mash(seed) * 0x100000000;
        }
    }
    
    // Helper
    
    function mash(data) {
        data = data.toString();
        var n = 0xefc8249d;
        for (var i = 0, len = data.length; i < len; i++) {
            n += data.charCodeAt(i);
            var h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 0x100000000;
        }
        return (n >>> 0) * 2.3283064365386963e-10;
    }
    
    return Xorshift;

})();

(function(global) {
    /**
     * Perlin Noise
     * 
     * @see http://staffwww.itn.liu.se/~stegu/simplexnoise/simplexnoise.pdf
     * 
     * Tiling Example (heavy...)
     * 
     * var perlinNoise = new LIGHTNING.lib.PerlinNoise();
     * 
     * function tilingNoise2d(x, y, w, h) {
     *     return (perlinNoise.noise(x, y) * (w - x) * (h - y) +
     *         perlinNoise.noise(x - w, y) * x * (h - y) +
     *         perlinNoise.noise(x - w, y - h) * x * y +
     *         perlinNoise.noise(x, y - h) * (w - x) * y) / (w * h);
     * }
     * 
     * function tilingNoise3d(x, y, z, w, h) {
     *     return (perlinNoise.noise(x, y, z) * (w - x) * (h - y) +
     *         perlinNoise.noise(x - w, y, z) * x * (h - y) +
     *         perlinNoise.noise(x - w, y - h, z) * x * y +
     *         perlinNoise.noise(x, y - h, z) * (w - x) * y) / (w * h);
     * }
     */
     
    function PerlinNoise(seed) {
        this.isClassic = PerlinNoise.useClassic;
        LIGHTNING.lib.extend(this, this.isClassic ? new ClassicNoise(seed) : new SimplexNoise(seed));
    }
    
    PerlinNoise.useClassic = false;
    
    var GRAD3 = [
        [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],  
        [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],  
        [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];
    
    var GRAD4 = [
        [0, 1, 1, 1],  [0, 1, 1, -1],  [0, 1, -1, 1],  [0, 1, -1, -1],
        [0, -1, 1, 1], [0, -1, 1, -1], [0, -1, -1, 1], [0, -1, -1, -1],
        [1, 0, 1, 1],  [1, 0, 1, -1],  [1, 0, -1, 1],  [1, 0, -1, -1],
        [-1, 0, 1, 1], [-1, 0, 1, -1], [-1, 0, -1, 1], [-1, 0, -1, -1],
        [1, 1, 0, 1],  [1, 1, 0, -1],  [1, -1, 0, 1],  [1, -1, 0, -1],
        [-1, 1, 0, 1], [-1, 1, 0, -1], [-1, -1, 0, 1], [-1, -1, 0, -1],
        [1, 1, 1, 0],  [1, 1, -1, 0],  [1, -1, 1, 0],  [1, -1, -1, 0],
        [-1, 1, 1, 0], [-1, 1, -1, 0], [-1, -1, 1, 0], [-1, -1, -1, 0]
    ];
    
    var SIMPLEX = [ 
        [0, 1, 2, 3], [0, 1, 3, 2], [0, 0, 0, 0], [0, 2, 3, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [1, 2, 3, 0],  
        [0, 2, 1, 3], [0, 0, 0, 0], [0, 3, 1, 2], [0, 3, 2, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [1, 3, 2, 0],  
        [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],  
        [1, 2, 0, 3], [0, 0, 0, 0], [1, 3, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 3, 0, 1], [2, 3, 1, 0],  
        [1, 0, 2, 3], [1, 0, 3, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 3, 1], [0, 0, 0, 0], [2, 1, 3, 0],  
        [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],  
        [2, 0, 1, 3], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [3, 0, 1, 2], [3, 0, 2, 1], [0, 0, 0, 0], [3, 1, 2, 0],  
        [2, 1, 0, 3], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [3, 1, 0, 2], [0, 0, 0, 0], [3, 2, 0, 1], [3, 2, 1, 0]
    ];
    
    /**
     * ClassicNoise
     */
    function ClassicNoise(seed) {
        this.seed(seed);
    }
    
    ClassicNoise.prototype = {
        _octaves: 4,
        _fallout: 0.5,
        
        seed: function(seed) {
            var random = new Xorshift(seed || new Date().getTime()).random;

            var i;
            var p = [];
            for (i = 0; i < 256; i++) {
                p[i] = Math.floor(random() * 256);
            }

            var perm = [];
            for (i = 0; i < 512; i++) {
                perm[i] = p[i & 255];
            }

            this._perm = perm;
        },
        
        octaves: function(octaves) {
            if (!arguments.length) return this._octaves;
            return (this._octaves = octaves);
        },

        fallout: function(fallout) {
            if (!arguments.length) return this._fallout;
            return (this._fallout = fallout);
        },
        
        noise: function(x, y, z) {
            var result = 0;
            var noise;
            var f = 1;
            var oct = this._octaves;
            var amp = 0.5;
            var fallout = this._fallout;
            
            switch (arguments.length) {
                case 1  : noise = function() { return this.noise2d(x * f, 0); }; break;
                case 2  : noise = function() { return this.noise2d(x * f, y * f); }; break;
                case 3  : noise = function() { return this.noise3d(x * f, y * f, z * f); }; break;
                default : return result;
            }
            
            for (var i = 0; i < oct; ++i) {
                result += (1 + noise.call(this)) * amp * 0.5;
                amp *= fallout;
                f *= 2;
            }
            
            return result;
        },
        
        noise2d: function(x, y) {
            var X = Math.floor(x); var Y = Math.floor(y);
            x = x - X;             y = y - Y;
            X = X & 255;           Y = Y & 255;
            
            var perm = this._perm;
            
            var gi00 = perm[X + perm[Y]] % 12;
            var gi01 = perm[X + perm[Y + 1]] % 12;
            var gi10 = perm[X + 1 + perm[Y]] % 12;
            var gi11 = perm[X + 1 + perm[Y + 1]] % 12;
            
            var n00 = dot2d(GRAD3[gi00], x, y);
            var n10 = dot2d(GRAD3[gi10], x - 1, y);
            var n01 = dot2d(GRAD3[gi01], x, y - 1);
            var n11 = dot2d(GRAD3[gi11], x - 1, y - 1);
            
            var u = fade(x); var v = fade(y);
            
            var nx0 = mix(n00, n10, u); var nx1 = mix(n01, n11, u);
            
            var nxy = mix(nx0, nx1, v);

            return nxy;
        },
        
        noise3d: function(x, y, z) {
            var X = Math.floor(x); var Y = Math.floor(y); var Z = Math.floor(z);
            x = x - X;             y = y - Y;             z = z - Z;
            X = X & 255;           Y = Y & 255;           Z = Z & 255;
            
            var perm = this._perm;
            
            var gi000 = perm[X + perm[Y + perm[Z]]] % 12;
            var gi001 = perm[X + perm[Y + perm[Z + 1]]] % 12;
            var gi010 = perm[X + perm[Y + 1 + perm[Z]]] % 12;
            var gi011 = perm[X + perm[Y + 1 + perm[Z + 1]]] % 12;
            var gi100 = perm[X + 1 + perm[Y + perm[Z]]] % 12;
            var gi101 = perm[X + 1 + perm[Y + perm[Z + 1]]] % 12;
            var gi110 = perm[X + 1 + perm[Y + 1 + perm[Z]]] % 12;
            var gi111 = perm[X + 1 + perm[Y + 1 + perm[Z + 1]]] % 12;
            
            var n000 = dot3d(GRAD3[gi000], x, y, z);
            var n100 = dot3d(GRAD3[gi100], x - 1, y, z);
            var n010 = dot3d(GRAD3[gi010], x, y - 1, z);
            var n110 = dot3d(GRAD3[gi110], x - 1, y - 1, z);
            var n001 = dot3d(GRAD3[gi001], x, y, z - 1);
            var n101 = dot3d(GRAD3[gi101], x - 1, y, z - 1);
            var n011 = dot3d(GRAD3[gi011], x, y - 1, z - 1);
            var n111 = dot3d(GRAD3[gi111], x - 1, y - 1, z - 1);
            
            var u = fade(x); var v = fade(y); var w = fade(z);
            
            var nx00 = mix(n000, n100, u); var nx01 = mix(n001, n101, u); 
            var nx10 = mix(n010, n110, u); var nx11 = mix(n011, n111, u);
            
            var nxy0 = mix(nx00, nx10, v); var nxy1 = mix(nx01, nx11, v);
            
            var nxyz = mix(nxy0, nxy1, w); 

            return nxyz;
        }
    };
    
    
    /**
     * SimplexNoise
     * 
     * @super ClassicNoise
     */
    function SimplexNoise(seed) {
        this.seed(seed);
    }

    SimplexNoise.prototype = LIGHTNING.lib.extend({}, ClassicNoise.prototype, {
        noise: function(x, y, z, w) {
            var result = 0;
            var noise;
            var f = 1;
            var oct = this._octaves;
            var amp = 0.5;
            var fallout = this._fallout;
            
            switch (arguments.length) {
                case 1  : noise = function() { return this.noise2d(x * f, 0); }; break;
                case 2  : noise = function() { return this.noise2d(x * f, y * f); }; break;
                case 3  : noise = function() { return this.noise3d(x * f, y * f, z * f); }; break;
                case 4  : noise = function() { return this.noise4d(x * f, y * f, z * f, w * f); }; break;
                default : return result;
            }
            
            for (var i = 0; i < oct; ++i) {
                result += (1 + noise.call(this)) * amp * 0.5;
                amp *= fallout;
                f *= 2;
            }
            
            return result;
        },
        
        noise2d: function(x, y) {
            var n0, n1, n2;

            var F2 = 0.5 * (Math.sqrt(3) - 1); 
            var s = (x + y) * F2;
            var i = Math.floor(x + s); var j = Math.floor(y + s);

            var G2 = (3 - Math.sqrt(3)) / 6;
            var t = (i + j) * G2; 
            var X0 = i - t;  var Y0 = j - t; 
            var x0 = x - X0; var y0 = y - Y0;

            var i1, j1;
            if (x0 > y0) {
                i1 = 1; j1 = 0; 
            } else {
                i1 = 0; j1 = 1;
            }

            var x1 = x0 - i1 + G2;    var y1 = y0 - j1 + G2; 
            var x2 = x0 - 1 + 2 * G2; var y2 = y0 - 1 + 2 * G2;

            var perm = this._perm;

            var ii = i & 255; var jj = j & 255;
            var gi0 = perm[ii + perm[jj]] % 12; 
            var gi1 = perm[ii + i1 + perm[jj + j1]] % 12; 
            var gi2 = perm[ii + 1 + perm[jj + 1]] % 12;

            var t0 = 0.5 - x0 * x0 - y0 * y0; 
            if (t0 < 0) {
                n0 = 0; 
            } else { 
                t0 *= t0;
                n0 = t0 * t0 * dot2d(GRAD3[gi0], x0, y0);
            }

            var t1 = 0.5 - x1 * x1 - y1 * y1; 
            if (t1 < 0) {
                n1 = 0; 
            } else { 
                t1 *= t1; 
                n1 = t1 * t1 * dot2d(GRAD3[gi1], x1, y1); 
            }

            var t2 = 0.5 - x2 * x2 - y2 * y2; 
            if (t2 < 0) {
                n2 = 0; 
            } else { 
                t2 *= t2; 
                n2 = t2 * t2 * dot2d(GRAD3[gi2], x2, y2); 
            }

            return 70 * (n0 + n1 + n2);
        },
        
        noise3d: function(x, y, z) {
            var n0, n1, n2, n3;
            
            var F3 = 1 / 3;
            var s = (x + y + z) * F3;
            var i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
            
            var G3 = 1 / 6;
            var t = (i + j + k) * G3; 
            var X0 = i - t;  var Y0 = j - t;  var Z0 = k - t;
            var x0 = x - X0; var y0 = y - Y0; var z0 = z - Z0;
            
            var i1, j1, k1;
            var i2, j2, k2;
            if (x0 >= y0) {
                if (y0 >= z0) {
                    i1 = 1; j1 = 0; k1 = 0;
                    i2 = 1; j2 = 1; k2 = 0;
                } else if (x0 >= z0) {
                    i1 = 1; j1 = 0; k1 = 0;
                    i2 = 1; j2 = 0; k2 = 1;
                } else {
                    i1 = 0; j1 = 0; k1 = 1;
                    i2 = 1; j2 = 0; k2 = 1;
                }
            } else {
                if (y0 < z0) {
                    i1 = 0; j1 = 0; k1 = 1;
                    i2 = 0; j2 = 1; k2 = 1;
                } else if (x0 < z0) {
                    i1 = 0; j1 = 1; k1 = 0;
                    i2 = 0; j2 = 1; k2 = 1;
                } else {
                    i1 = 0; j1 = 1; k1 = 0;
                    i2 = 1; j2 = 1; k2 = 0;
                }
            }
            
            var x1 = x0 - i1 + G3;     var y1 = y0 - j1 + G3;     var z1 = z0 - k1 + G3;
            var x2 = x0 - i2 + 2 * G3; var y2 = y0 - j2 + 2 * G3; var z2 = z0 - k2 + 2 * G3;
            var x3 = x0 - 1 + 3 * G3;  var y3 = y0 - 1 + 3 * G3;  var z3 = z0 - 1 + 3 * G3;
            
            var perm = this._perm;
            
            var ii = i & 255; var jj = j & 255; var kk = k & 255;
            var gi0 = perm[ii + perm[jj + perm[kk]]] % 12;
            var gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12;
            var gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12;
            var gi3 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12;
            
            var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
            if (t0 < 0) {
                n0 = 0;
            } else {
                t0 *= t0;
                n0 = t0 * t0 * dot3d(GRAD3[gi0], x0, y0, z0);
            }
            
            var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
            if (t1 < 0) {
                n1 = 0;
            } else {
                t1 *= t1;
                n1 = t1 * t1 * dot3d(GRAD3[gi1], x1, y1, z1);
            }
            
            var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
            if (t2 < 0) {
                n2 = 0;
            } else {
                t2 *= t2;
                n2 = t2 * t2 * dot3d(GRAD3[gi2], x2, y2, z2);
            }
            
            var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
            if (t3 < 0) {
                n3 = 0;
            } else {
                t3 *= t3;
                n3 = t3 * t3 * dot3d(GRAD3[gi3], x3, y3, z3);
            }
            
            return 32 * (n0 + n1 + n2 + n3);
        },
        
        noise4d: function(x, y, z, w) {
            var F4 = (Math.sqrt(5) - 1) / 4;
            var G4 = (5 - Math.sqrt(5)) / 20;
            var n0, n1, n2, n3, n4;
            
            var s = (x + y + z + w) * F4;
            var i = Math.floor(x + s); var j = Math.floor(y + s);
            var k = Math.floor(z + s); var l = Math.floor(w + s);
            var t = (i + j + k + l) * G4;
            var X0 = i - t;  var Y0 = j - t;  var Z0 = k - t;  var W0 = l - t;
            var x0 = x - X0; var y0 = y - Y0; var z0 = z - Z0; var w0 = w - W0;
            
            var c1 = (x0 > y0) ? 32 : 0; var c2 = (x0 > z0) ? 16 : 0; var c3 = (y0 > z0) ? 8 : 0;
            var c4 = (x0 > w0) ? 4 : 0;  var c5 = (y0 > w0) ? 2 : 0;  var c6 = (z0 > w0) ? 1 : 0;
            var c = c1 + c2 + c3 + c4 + c5 + c6;
            
            var i1 = SIMPLEX[c][0] >= 3 ? 1 : 0;
            var j1 = SIMPLEX[c][1] >= 3 ? 1 : 0;
            var k1 = SIMPLEX[c][2] >= 3 ? 1 : 0;
            var l1 = SIMPLEX[c][3] >= 3 ? 1 : 0;
            
            var i2 = SIMPLEX[c][0] >= 2 ? 1 : 0;
            var j2 = SIMPLEX[c][1] >= 2 ? 1 : 0;
            var k2 = SIMPLEX[c][2] >= 2 ? 1 : 0;
            var l2 = SIMPLEX[c][3] >= 2 ? 1 : 0;
            
            var i3 = SIMPLEX[c][0] >= 1 ? 1 : 0;
            var j3 = SIMPLEX[c][1] >= 1 ? 1 : 0;
            var k3 = SIMPLEX[c][2] >= 1 ? 1 : 0;
            var l3 = SIMPLEX[c][3] >= 1 ? 1 : 0;
            
            var x1 = x0 - i1 + G4;
            var y1 = y0 - j1 + G4;
            var z1 = z0 - k1 + G4;
            var w1 = w0 - l1 + G4;
            var x2 = x0 - i2 + 2 * G4;
            var y2 = y0 - j2 + 2 * G4;
            var z2 = z0 - k2 + 2 * G4;
            var w2 = w0 - l2 + 2 * G4;
            var x3 = x0 - i3 + 3 * G4;
            var y3 = y0 - j3 + 3 * G4;
            var z3 = z0 - k3 + 3 * G4;
            var w3 = w0 - l3 + 3 * G4;
            var x4 = x0 - 1 + 4 * G4;
            var y4 = y0 - 1 + 4 * G4;
            var z4 = z0 - 1 + 4 * G4;
            var w4 = w0 - 1 + 4 * G4;
            
            var perm = this._perm;
            
            var ii = i & 255; var jj = j & 255; var kk = k & 255; var ll = l & 255;
            var gi0 = perm[ii + perm[jj + perm[kk + perm[ll]]]] % 32;
            var gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1+perm[ll + l1]]]] % 32;
            var gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2+perm[ll + l2]]]] % 32;
            var gi3 = perm[ii + i3 + perm[jj + j3 + perm[kk + k3+perm[ll + l3]]]] % 32;
            var gi4 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1 + perm[ll + 1]]]] % 32;

            var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
            if (t0 < 0) {
                n0 = 0;
            } else {
                t0 *= t0;
                n0 = t0 * t0 * dot4d(GRAD4[gi0], x0, y0, z0, w0);
            }
            
            var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
            if (t1 < 0) {
                n1 = 0;
            } else {
                t1 *= t1;
                n1 = t1 * t1 * dot4d(GRAD4[gi1], x1, y1, z1, w1);
            }
            
            var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
            if (t2 < 0) {
                n2 = 0;
            } else {
                t2 *= t2;
                n2 = t2 * t2 * dot4d(GRAD4[gi2], x2, y2, z2, w2);
            }
            
            var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
            if (t3 < 0) {
                n3 = 0;
            } else {
                t3 *= t3;
                n3 = t3 * t3 * dot4d(GRAD4[gi3], x3, y3, z3, w3);
            }
            
            var t4 = 0.6 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
            if (t4 < 0) {
                n4 = 0;
            } else {
                t4 *= t4;
                n4 = t4 * t4 * dot4d(GRAD4[gi4], x4, y4, z4, w4);
            }
            
            return 27 * (n0 + n1 + n2 + n3 + n4);
        }
    });
    
    // Common helpers
    
    function dot2d(g, x, y) {
        return g[0] * x + g[1] * y;
    }
    
    function dot3d(g, x, y, z) {
        return g[0] * x + g[1] * y + g[2] * z;
    }
    
    // Simplex helper
    
    function dot4d(g, x, y, z, w) {
        return g[0] * x + g[1] * y + g[2] * z + g[3] * w;
    }
    
    // Classic helpers
    
    function mix(a, b, t) { 
        return (1 - t) * a + t * b; 
    }

    function fade(t) { 
        return t * t * t * (t * (t * 6 - 15) + 10); 
    }
    
    global.LIGHTNING.lib.PerlinNoise = PerlinNoise;
    
})(global);

})(window);

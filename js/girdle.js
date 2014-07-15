// jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, onevar:true, strict:true, undef:true, unused:strict, curly:true, browser:true, evil:true, node:true

/* global Cookies, Spinner */

var G = (function ()
{
    "use strict";
    
    var G = {
        array_remove: function array_remove(arr, i, order_irrelevant)
        {
            var len = arr.length;
            
            /// Handle negative numbers.
            if (i < 0) {
                i = len + i;
            }
            
            /// If the last element is to be removed, then all we need to do is pop it off.
            ///NOTE: This is always the fastest method and it is orderly too.
            if (i === len - 1) {
                arr.pop();
            /// If the second to last element is to be removed, we can just pop off the last one and replace the second to last one with it.
            ///NOTE: This is always the fastest method and it is orderly too.
            } else if (i === len - 2) {
                arr[len - 2] = arr.pop();
            /// Can use we the faster (but unorderly) remove method?
            } else if (order_irrelevant || i === len - 2) {
                if (i >= 0 && i < len) {
                    /// This works by popping off the last array element and using that to replace the element to be removed.
                    arr[i] = arr.pop();
                }
            } else {
                /// The first element can be quickly shifted off.
                if (i === 0) {
                    arr.shift();
                /// Ignore numbers that are still negative.
                ///NOTE: By default, if a number is below the total array count (e.g., array_remove([0,1], -3)), splice() will remove the first element.
                ///      This behavior is undesirable because it is unexpected.
                } else if (i > 0) {
                    /// Use the orderly, but slower, splice method.
                    arr.splice(i, 1);
                }
            }
        },
        
        format_money: function format_money(cents, free, currancy)
        {
            var money = cents / 100;
            
            if (!currancy) {
                currancy = "$";
            }
            
            if (isNaN(money)) {
                money = 0;
            }
            
            if (money % 1 !== 0) {
                money = money.toFixed(2);
            }
            
            if (money === 0 && typeof free !== "undefined") {
                return free;
            }
            
            return currancy + money;
        },
        
        get_random_int: function get_random_int(min, max)
        {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        
        is_object: function is_object(mixed)
        {
            return mixed instanceof Object && !(mixed instanceof Array);
        },
        
        /**
         * Safely parse JSON.
         */
        parse_json: function parse_json(str)
        {
            try {
                return JSON.parse(str);
            } catch (e) {}
        },
        async_loop: function async_loop(arr, done, oneach)
        {
            var len;
            
            if (!Array.isArray(arr)) {
                return done({error: "Not an array."});
            }
            
            len = arr.length;
            
            (function loop(i)
            {
                if (i >= len) {
                    if (done) {
                        return done();
                    }
                    return;
                }
                
                oneach(arr[i], function next()
                {
                    loop(i + 1);
                }, i);
            }(0));
        },
        escape_html: function escape_html(str)
        {
            return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        },
    };
    
    /// Is this (probably) a browser?
    if (typeof window === "object") {
        /// Is there a DOM?
        if (typeof window.document === "object") {
            G.cde = function create_dom_el(type, properties, events, children)
            {
                var el = (!type || type === "documentFragment") ? document.createDocumentFragment() : document.createElement(type),
                    prop_sub = {
                        c: "className",
                        t: "textContent",
                    };
                
                /// Make properties and events optional.
                if (Array.isArray(properties) && !events && !children) {
                    children = properties;
                    properties = undefined;
                    events = undefined;
                } else if (Array.isArray(events) && !children) {
                    children = events;
                    events = undefined;
                }
                
                if (G.is_object(properties)) {
                    Object.keys(properties).forEach(function (prop)
                    {
                        var prop_name = prop_sub[prop] || prop;
                        try {
                            if (prop === "colspan" || prop === "list" || prop === "for" || prop.indexOf(":") > -1) {
                                el.setAttribute(prop_name, properties[prop]);
                            } else {
                                el[prop_name] = properties[prop];
                            }
                        } catch (e) {
                            console.log(prop);
                            console.log(e);
                        }
                    });
                }
                
                if (G.is_object(events)) {
                    Object.keys(events).forEach(function (prop)
                    {
                        /// A psuedo event
                        if (prop === "all_on_changes") {
                            el.addEventListener("change", events[prop]);
                            el.addEventListener("keypress", events[prop]);
                            el.addEventListener("keyup", events[prop]);
                        } else {
                            el.addEventListener(prop, events[prop]);
                        }
                    });
                }
                
                if (Array.isArray(children)) {
                    children.forEach(function (child)
                    {
                        if (typeof child === "string") {
                            el.appendChild(document.createTextNode(child));
                        } else {
                            el.appendChild(child);
                        }
                    });
                }
                
                return el;
            };
            
            /// Detect and label mobile devices.
            G.mobile = (function is_it_mobile()
            {
                var mobile = false,
                    regex = /android|ipad|iphone|mobi|tablet|linux\sarmv7l/i; /// Android often has "Linux armv7l" as it's platform.
                
                if (window.navigator) {
                    mobile = regex.test(navigator.userAgent) || regex.test(navigator.platform);
                }
                
                /// Add a flag to the HTML class for CSS detection.
                if (mobile && document.documentElement) {
                    document.documentElement.classList.add("mobile");
                }
                
                return mobile;
            }());
            
            
            /// Identify the browser.
            G.browser = window.opera ? "o" : /// Test for Opera first since it also is now webkit/blink.
                window.chrome || window.navigator.userAgent.indexOf("WebKit/") >= 0 ? "webkit" :
                window.navigator.userAgent.indexOf("Firefox/") >= 0 ? "moz" :
                
                /MSIE|Trident/.test(navigator.userAgent) ? "ms" : "";
            
            /// Mark for CSS.
            if (G.browser && document.documentElement) {
                document.documentElement.classList.add(G.browser);
            }
            
            /// **************************
            /// * End of window.document *
            /// **************************
        }
        
        G.normalize_mouse_buttons = function normalize_mouse_buttons(e)
        {
            if (e) {
                if (typeof e.which !== "undefined") {
                    return e.which;
                }
                if (typeof e.button !== "undefined") {
                    if (e.button === 0) {
                        return 1;
                    } else if (e.button === 1) {
                        return 4;
                    } else {
                        return e.button;
                    }
                }
            }
        };
        
        if (window.XMLHttpRequest) {
            /**
             * Options
             *   method  (GET)
             *   message
             *   timeout (30000)
             *   retry   (false)
             *   retry_interval (2000)
             *   csrf (defaults to the _csrf cookie on non-GET requests)
             *   headers (an object or array of objects)
             *      [{name: "}]
             */
            G.easy_ajax = function easy_ajax(path, options, callback)
            {
                var aborted,
                    ajax = new window.XMLHttpRequest(),
                    retrying,
                    retry_timer,
                    query_timer,
                    tried_new_csrf_token;
                
                ajax.is_busy = function is_busy()
                {
                    return retrying || Boolean(ajax.readyState % 4);
                };
                
                ajax.orig_abort = ajax.abort;
                
                ajax.abort = function better_abort()
                {
                    if (retrying) {
                        clearTimeout(retry_timer);
                        retrying = false;
                    }
                    
                    if (ajax.is_busy()) {
                        /// Stop it from retrying from a timeout.
                        clearTimeout(query_timer);
                        aborted = true;
                        ajax.orig_abort();
                    }
                    
                    /// Make sure a callback is called.
                    if (ajax.onerror) {
                        ajax.onerror();
                    }
                };
                
                function parse_if_json()
                {
                    var res,
                        type;
                    
                    if (ajax.readyState === 4) {
                        ///NOTE: If the request returned a blob, accesing the responseText property throws an error.
                        if (ajax.responseType === "blob") {
                            res = ajax.response;
                        } else {
                            /// Chrome throws an error if this is called before it's ready.
                            type = ajax.getResponseHeader("Content-Type");
                            ///NOTE: The header may include a charset.
                            if (type && type.indexOf("application/json") > -1) {
                                res = G.parse_json(ajax.responseText);
                            } else {
                                res = ajax.responseText;
                            }
                        }
                    }
                    
                    return res;
                }
                
                function query()
                {
                    var method = typeof options.method === "string" ? options.method.toUpperCase() : "GET",
                        message = typeof options.message === "object" ? G.make_params(options.message) : options.message,
                        timeout = options.timeout || 30000, /// Default to 30 seconds.
                        headers = options.headers || [],
                        csrf_token,
                        post_message,
                        csrf_cookie = options.csrf_cookie || "_csrf";
                    
                    aborted = false;
                    
                    function onload()
                    {
                        var err;
                        
                        ///NOTE: Really any 200 level request is good, but I don't think any one ever uses other codes.
                        if (ajax.status !== 200) {
                            /// Was their (probably) a CRSF token failure and easy_ajax is handleing CSRF?
                            if (ajax.status === 403 && !options.csrf) {
                                /// Make sure we don't try this more than once because that won't help.
                                tried_new_csrf_token = true;
                                /// First, clear the current bad cookie.
                                Cookies.expire(csrf_cookie);
                                /// Next, try to get another cookie and retry the request.
                                ///TODO: Make an API or something for this.
                                G.easy_ajax("/get_csrf", {}, query);
                                /// Stop processing anything else and wait to see if getting a new CSRF token cookie fixes things.
                                return;
                            }
                            
                            err = {status: ajax.status, aborted: aborted};
                        }
                        
                        if (err && options.retry && !aborted) {
                            retry_timer = setTimeout(query, options.retry_interval || 2000);
                            return;
                        }
                        
                        if (callback) {
                            /// query() is sent back to let the caller retry if desired.
                            /// ajax is also sent back because it can offer extra data, like ajax.status.
                            callback(err, parse_if_json(ajax), query, ajax);
                            /// Make sure it's not called twice. For example, if both onerror and onload are called.
                            callback = null;
                        }
                    }
                    
                    if (method.toUpperCase() === "GET") {
                        /// GET requests need the message appended to the path.
                        ajax.open(method, path + (message ? "?" + message : ""));
                    } else {
                        /// POST requests send the message later on (with .send()).
                        ajax.open(method, path);
                        post_message = message;
                    }
                    
                    if (options.responseType) {
                        ajax.responseType = options.responseType;
                    }
                    
                    /// Prepare headers.
                    if (!Array.isArray(headers)) {
                        headers = [headers];
                    }
                    
                    /// Set default header.
                    headers.push({name: "Content-Type", value: "application/x-www-form-urlencoded"});
                    
                    /// Set CSRF token.
                    if (!options.csrf && method !== "GET") {
                        csrf_token = Cookies.get(csrf_cookie);
                    } else {
                        csrf_token = options.csrf;
                    }
                    if (csrf_token) {
                        headers.push({name: "x-csrf-token", value: csrf_token});
                    }
                    
                    headers.forEach(function oneach(header)
                    {
                        ajax.setRequestHeader(header.name, header.value);
                    });
                    
                    
                    ajax.onerror = onload;
                    ajax.onload  = onload;
                    
                    ajax.send(post_message);
                    
                    if (timeout) {
                        query_timer = setTimeout(function timeout()
                        {
                            ajax.abort();
                        }, timeout);
                    }
                }
                
                options = options || {};
                
                query();
                
                return ajax;
            };
            
            /**
             * Load some Javascript and optionally send it some variables from the closure.
             *
             * @example include("/path/to/script.js", {needed_var: var_from_the_closure}, function () {}, 20000, false);
             * @param   path     (string)              The location of the JavaScript to load.
             * @param   context  (object)   (optional) The variable to send to the included JavaScript.
             * @param   callback (function) (optional) A function to call after the code has been loaded.
             * @param   timeout  (number)   (optional) How long to wait before giving up on the script to load (in milliseconds).
             *                                         A falsey value (such as 0 or FALSE) disables timing out.         (Default is 10,000 milliseconds.)
             * @param   retry    (boolean)  (optional) Whether or not to retry loading the script if a timeout occurs.  (Default is TRUE.)
             * @return  NULL.  Executes code.
             * @todo    If the code has already been loaded, simply run the script without re-downloading anything.
             * @todo    Determine if it would be better to use a callback function rather than passing context.
             */
            G.include = (function ()
            {
                /// Store the "this" variable to let the other functions access it.
                var that = this;
                
                /**
                 * Eval code in a neutral scope.
                 *
                 * @param  code (string) The string to eval.
                 * @return The result of the eval'ed code.
                 * @note   Called when the Ajax request returns successfully.
                 * @note   This function is used to prevent included code from having access to the variables inside of the function's scope.
                 */
                this.evaler = function (code)
                {
                    ///NOTE: Since the eval'ed code has access to the variables in this closure, we need to clear out the code variable both as a security caution and
                    ///      to prevent memory leaks.  The following code does just that: (code = ""). However, this also messes up Firebug's debugger.
                    return eval(code + (code = ""));
                };
                
                /// Prevent any eval'ed code from being able to modify the evaler() function.
                Object.freeze(this);
                
                function include_one(path, callback, context, timeout, retry)
                {
                    var clean_path = path.replace(/(\?[^?]+)?(\#[^#]+)?$/, "").toLowerCase(),
                        fallback;
                    
                    function done()
                    {
                        clearTimeout(fallback);
                        if (callback) {
                            callback();
                            /// Make sure it can't be called twice.
                            callback = null;
                        }
                    }
                    
                    /// Not all browsers support onload (like Android).
                    fallback = setTimeout(done, 3000);
                    
                    if (clean_path.slice(-4) === ".css") {
                        ///TODO: Check other link tags to see if this has already been added.
                        document.getElementsByTagName("head")[0].appendChild(G.cde("link", {
                                href: path,
                                rel: "stylesheet"
                            }, {load: done}
                        ));
                    } else { /// JS
                        G.easy_ajax(path, {method: "GET"}, function (err, res)
                        {
                            /// Evaluate the code in a safe environment.
                            /// Before evaluation, add the sourceURL so that debuggers can debug properly be matching the code to the correct file.
                            /// See https://blog.getfirebug.com/2009/08/11/give-your-eval-a-name-with-sourceurl/.
                            var code = that.evaler(res + "//# sourceURL=" + path);
                            
                            if (err) {
                                console.log(err);
                            }
                            
                            /// If the eval'ed code is a function, send it the context.
                            if (typeof code === "function") {
                                code(context);
                            }
                            
                            if (callback) {
                                callback();
                            }
                        }, timeout, retry);
                    }
                }
                
                return function include(path, callback, context, timeout, retry)
                {
                    var len;
                    
                    if (!Array.isArray(path)) {
                        path = [path];
                    }
                    
                    len = path.length;
                    
                    (function loop(i)
                    {
                        if (i === len) {
                            if (callback) {
                                callback();
                            }
                            return;
                        }
                        
                        include_one(path[i], function next()
                        {
                            loop(i + 1);
                        }, context, timeout, retry);
                    }(0));
                };
            ///NOTE: Since this anonymous function would have an undefined "this" variable, we need to use the call() function to specify an empty "this" object.
            ///      The "this" object is used to "secure" the code from the eval'ed code using Object.freeze().
            }).call({});
        }
        
        G.get_params = function get_params()
        {
            var sep1 = location.search.split(/\&|\?/g),
                sep2,
                params = {},
                i,
                len;
            
            len = sep1.length;
            
            if (len > 1) {
                ///NOTE: Skip the first empty element (it's empty because URL's start with a slash).
                for (i = 1; i < len; i += 1) {
                    sep2 = sep1[i].split(/=/);
                    sep2[0] = decodeURIComponent(sep2[0]);
                    if (sep2[1]) {
                        sep2[1] = decodeURIComponent(sep2[1]);
                    }
                    if (params[sep2[0]]) {
                        if (typeof params[sep2[0]] !== "object") {
                            params[sep2[0]] = [params[sep2[0]]];
                        }
                        params[sep2[0]].push(sep2[1]);
                    } else {
                        params[sep2[0]] = sep2[1];
                    }
                }
            }
            
            return params;
        };
        
        G.get_data_from_form = function get_data_from_form(form)
        {
            var data = {arr: [], obj: {}},
                i,
                len,
                value;
            
            if (form && form.elements && form.elements.length) {
                ///NOTE: HTMLCollections are not real arrays, so there is no forEach().
                len = form.elements.length;
                
                for (i = 0; i < len; i += 1) {
                    /// Only elements with a name should be retreaved.
                    ///NOTE: This does store an element with a space (" ") as a name. Is that good?
                    if (form.elements[i].name) {
                        if (form.elements[i].type === "checkbox") {
                            value = form.elements[i].checked ? true : false;
                        } else {
                            value = form.elements[i].value;
                        }
                        /// If the element already exists, turn it into an array.
                        if (data.obj[form.elements[i].name]) {
                            if (!Array.isArray(data.obj[form.elements[i].name])) {
                                data.obj[form.elements[i].name] = [data.obj[form.elements[i].name]];
                            }
                            data.obj[form.elements[i].name].push(value);
                        } else {
                            data.obj[form.elements[i].name] = value;
                        }
                        data.arr[i] = form.elements[i];
                    }
                }
            }
            
            return data;
        };
        
        G.make_params = function (params)
        {
            var str = "";
            if (params) {
                Object.keys(params).forEach(function oneach(key, i)
                {
                    if (i > 0) {
                        str += "&";
                    }
                    str += encodeURIComponent(key);
                    if (typeof params[key] !== "undefined") {
                         str += "=" + encodeURIComponent(params[key]);
                    }
                });
            }
            return str;
        };
        
        ///NOTE: Even though this doesn't need to be client-side only, Node already has an event system.
        G.events = (function ()
        {
            var func_list = {};
            
            return {
                /**
                 * Add one or more events to the event cue.
                 *
                 * @example system.event.attach("contentAddedAbove", function (e) {});
                 * @example system.event.attach("contentAddedAbove", function (e) {}, true);
                 * @example system.event.attach(["contentAddedAbove", "contentRemovedAbove"], function (e) {});
                 * @example system.event.attach(["contentAddedAbove", "contentRemovedAbove"], function (e) {}, true);
                 * @example system.event.attach(["contentAddedAbove", "contentRemovedAbove"], function (e) {}, [true, false]);
                 * @param   name (string || array)             The name of the event or an array of names of events.
                 * @param   func (function)                    The function to call when the event it triggered.
                 * @param   once (boolean || array) (optional) Whether or not to detach this function after being executed once. If "name" is an array, then "once" can also be an array of booleans.
                 * @return  NULL
                 * @note    If func(e) calls e.stopPropagation(), it will stop further event propagation.
                 * @todo    Determine the value of adding a run_once property that removes function after the first run.
                 */
                attach: function attach(name, func, once)
                {
                    var arr_len,
                        i;
                    
                    /// Should the function be attached to multiple events?
                    if (name instanceof Array) {
                        arr_len = name.length;
                        for (i = 0; i < arr_len; i += 1) {
                            /// If "once" is an array, then use the elements of the array.
                            /// If "once" is not an array, then just send the "once" variable each time.
                            this.attach(name[i], func, once instanceof Array ? once[i] : once);
                        }
                    } else {
                        if (typeof func === "function") {
                            /// Has a function been previously attached to this event? If not, create a function to handle them.
                            if (!func_list[name]) {
                                func_list[name] = [];
                            }
                            /// Since we may remove events while calling them, it's easiest to store the array in reverse.
                            func_list[name].unshift({
                                func: func,
                                once: once
                            });
                        }
                    }
                },
                /**
                 * Remove an event from the event cue.
                 *
                 * @example system.event.detach("contentAddedAbove", function (e) {});
                 * @example system.event.detach(["contentAddedAbove", "contentRemovedAbove"], function (e) {}, [true, false]);
                 * @example system.event.detach(["contentAddedAbove", "contentRemovedAbove"], function (e) {}, true);
                 * @param   name (string || array)             The name of the event or an array of names of events.
                 * @param   func (function)                    The function that was attached to the specified event.
                 * @param   once (boolean || array) (optional) Whether or not to detach this function after being executed once. If "name" is an array, then "once" can also be an array of booleans.
                 */
                detach: function detach(name, func, once)
                {
                    var i;
                    
                    /// Are there multiple events to remove?
                    if (name instanceof Array) {
                        for (i = name.length - 1; i >= 0; i -= 1) {
                            /// If "once" is an array, then use the elements of the array.
                            /// If "once" is not an array, then just send the "once" variable each time.
                            this.detach(name[i], func, once instanceof Array ? once[i] : once);
                        }
                    } else if (func_list[name]) {
                        for (i = func_list[name].length - 1; i >= 0; i -= 1) {
                            ///NOTE: Both func and once must match.
                            if (func_list[name][i].func === func && func_list[name][i].once === once) {
                                G.array_remove(func_list[name], i);
                                /// Since only one event should be removed at a time, we can end now.
                                return;
                            }
                        }
                    }
                },
                /**
                 * Trigger the functions attached to an event.
                 *
                 * @param  name (string) The name of the event to trigger.
                 * @param  e    (object) The event object sent to the called functions.
                 * @return NULL
                 */
                trigger: function trigger(name, e)
                {
                    var i,
                        stop_propagation;
                    
                    /// Does this event have any functions attached to it?
                    if (func_list[name]) {
                        if (!G.is_object(e)) {
                            /// If the event object was not specificed, it needs to be created in order to attach stopPropagation() to it.
                            e = {};
                        }
                        
                        /// If an attached function runs this function, it will stop calling other functions.
                        e.stopPropagation = function ()
                        {
                            stop_propagation = true;
                        };
                        
                        /// Execute the functions in reverse order so that we can remove them without throwing the order off.
                        for (i = func_list[name].length - 1; i >= 0; i -= 1) {
                            ///NOTE: It would be a good idea to use a try/catch to prevent errors in events from preventing the code that called the
                            ///      event from firing.  However, there would need to be some sort of error handling. Sending a message back to the
                            ///      server would be a good feature.
                            /// Check to make sure the function actually exists.
                            if (func_list[name][i]) {
                                func_list[name][i].func(e);
                            }
                            
                            /// Is this function only supposed to be executed once?
                            if (!func_list[name][i] || func_list[name][i].once) {
                                G.array_remove(func_list[name], i);
                            }
                            
                            /// Was e.stopPropagation() called?
                            if (stop_propagation) {
                                break;
                            }
                        }
                    }
                }
            };
        }());
        
        G.redirect_login = function ()
        {
            var next_page,
                r = G.validate_redirect(G.get_params().r),
                cur_path = location.pathname;
            
            if (r) {
                next_page = r;
            } else if (cur_path === "/" || cur_path === "/login/" || cur_path === "/logout/") {
                /// For now, default to Reading Cards.
                /// In the future, this should go to a dashboard page in the accounts, or something similar.
                next_page = "/reading_cards/";
            } else {
                next_page = location.href;
            }
            
            window.location = next_page;
        };
        
        G.get_products = function ()
        {
            return G.parse_json(Cookies.get("p")) || {};
        };
        
        G.set_login_cookie = function (products)
        {
            var expires_in = 23328000000; /// 9 months in milliseconds (1000 * 60 * 60 * 24 * 30 * 9)
            
            /// Expires matches session_cookie_expire from config.
            Cookies.set("li", 1, {secure: location.protocol === "https:", expires: expires_in});
            if (!products) {
                products = G.get_products();
            }
            Cookies.set("p", JSON.stringify(products), {secure: location.protocol === "https:", expires: expires_in});
        };
        
        G.is_logged_in = function ()
        {
            if (Cookies.get("li")) {
                /// Keep the cookie date updated.
                G.set_login_cookie();
                return true;
            }
            return false;
        };
        
        G.is_authenticated = function (product_id)
        {
            return G.is_logged_in() && Boolean(G.get_products()[product_id]);
        };
        
        G.remove_login_cookie = function ()
        {
            Cookies.expire("li");
            Cookies.expire("_csrf");
            Cookies.expire("p");
        };
        
        G.set_login_link = function (sign_up_el, login_el, downloads_el, account_el)
        {
            if (G.is_logged_in()) {
                sign_up_el.classList.add("hidden");
                login_el.classList.add("hidden");
                downloads_el.classList.remove("hidden");
                account_el.classList.remove("hidden");
            } else {
                /// Handle login.
                login_el.addEventListener("click", function (e)
                {
                    e.preventDefault();
                    if (G.mobile) {
                        /// Touch devices don't work well with the login form because its floating in the middle of the screen and the keyboard can't be displayed properly.
                        G.redirect_unlogged();
                    } else {
                        G.show_login_form();
                    }
                    return false;
                });
            }
        };
        
        G.confirm_logged_in = function (cb)
        {
            G.easy_ajax("/api", {method: "POST", message: "action=confirm_logged_in"}, function (err, res)
            {
                cb(!err && res && res.logged_in);
            });
        };
        
        G.redirect_unlogged = function ()
        {
            if (!G.is_logged_in()) {
                window.location = "/login/?r=" + encodeURIComponent(location.pathname + location.search + location.hash);
                return true;
            }
        };
        
        G.validate_redirect = function(page)
        {
            /// A valid redirect page should start with a slash so as not to redirect to another domain.
            if (page && page[0] === "/") {
                return page;
            }
        };
        
        /**
         * Requires spin.js (not included)
         */
        G.create_spinner = function (new_options)
        {
            var options = {
                    lines:     11,       /// The number of lines to draw
                    length:    15,       /// The length of each line
                    width:      6,       /// The line thickness
                    radius:    15,       /// The radius of the inner circle
                    corners:    1,       /// Corner roundness (0..1)
                    rotate:     0,       /// The rotation offset
                    direction:  1,       /// 1: clockwise, -1: counterclockwise
                    color:    "#000",    /// #rgb or #rrggbb
                    speed:      1,       /// Rounds per second
                    trail:     60,       /// Afterglow percentage
                    shadow:    true,     /// Whether to render a shadow
                    hwaccel:   false,    /// Whether to use hardware acceleration
                    className:"spinner", /// The CSS class to assign to the spinner
                    zIndex:    2e9,      /// The z-index (defaults to 2000000000)
                    top:      "auto",    /// Top position relative to parent in px
                    left:     "auto",    /// Left position relative to parent in px
                },
                spin;
            
            function create_centered_spin(spin)
            {
                var fake_spin = {},
                    el;
                
                function center_it()
                {
                    el.style.top = ((window.innerHeight / 2) - (el.offsetHeight / 2)) + "px";
                    el.style.left = ((window.innerWidth / 2) - (el.offsetWidth  / 2)) + "px";
                }
                
                fake_spin.spin = function ()
                {
                    el = spin.spin().el;
                    
                    el.style.position = "fixed";
                    document.body.appendChild(el);
                    
                    window.addEventListener("resize", center_it);
                    
                    center_it();
                    
                    return el;
                };
                fake_spin.stop = function ()
                {
                    window.removeEventListener("resize", center_it);
                    
                    return spin.stop();
                };
                
                return fake_spin;
            }
            
            if (new_options) {
                Object.keys(new_options).forEach(function oneach(key)
                {
                    options[key] = new_options[key];
                });
            }
            
            if (Spinner) {
                spin = new Spinner(options);
                if (!options.centered) {
                    return spin;
                }
                
                return create_centered_spin(spin);
            }
        };
        
        /**
         * options.form, options.button and options.message can be an element or a string.
         */
        G.handle_forms = function handle_forms(options)
        {
            var hide_message_timer,
                form    = typeof options.form    === "string" ? document.getElementById(options.form)    : options.form,
                button  = typeof options.button  === "string" ? document.getElementById(options.button)  : options.button,
                message = typeof options.message === "string" ? document.getElementById(options.message) : options.message;
            
            function show_message(str, success)
            {
                /// Ignore NULL values.
                if (str === null) {
                    return;
                }
                if (!str) {
                    if (success) {
                        str = "Success";
                    } else {
                        str = "An error occurred.\nPlease reload the page, or try again.";
                    }
                }
                
                message.textContent = str;
                
                if (success) {
                    message.classList.remove("errorMessage");
                    message.classList.add("successMessage");
                } else {
                    message.classList.remove("successMessage");
                    message.classList.add("errorMessage");
                }
                
                if (success && options.success_popup) {
                    G.create_modular_window({align: "left", button_text: "OK"}).set_text(str).open();
                } else {
                    clearTimeout(hide_message_timer);
                    message.classList.remove("hidden");
                    
                    if (success) {
                        hide_message_timer = setTimeout(function ontime()
                        {
                            message.classList.add("hidden");
                        }, 5000);
                    }
                }
            }
            
            function submit_form(e)
            {
                var data = G.get_data_from_form(form),
                    validate_error;
                
                ///NOTE: This function can be called by the code instead of an event from the user.
                if (e && typeof e.preventDefault === "function") {
                    /// Stop the form from submitting.
                    e.preventDefault();
                }
                
                if (!data || !data.obj) {
                    show_message();
                    return false;
                }
                
                if (options.validator) {
                    validate_error = options.validator(data.obj);
                    if (validate_error) {
                        return show_message(validate_error);
                    }
                }
                
                /// Set the API action.
                if (options.action) {
                    data.obj.action = options.action;
                }
                
                G.easy_ajax(options.url || "/api", {method: "POST", message: G.make_params(data.obj)}, function onres(err, res)
                {
                    var failed,
                        fail_message = {message: ""};
                    
                    button.disabled = false;
                    button.classList.remove("disabled");
                    
                    if (options.evaluate) {
                        failed = options.evaluate(err, res, fail_message) === false;
                    } else {
                        failed = Boolean(err || !res || res.err || !res.success);
                    }
                    
                    if (failed) {
                        if (!fail_message.message && res && res.err && res.err.message) {
                            fail_message.message = res.err.message;
                        }
                        show_message(fail_message.message);
                        if (options.onfail) {
                            options.onfail(err, res);
                        }
                    } else {
                        show_message(options.success_message, true);
                        if (options.onsuccess) {
                            options.onsuccess(res);
                        }
                    }
                });
                
                button.disabled = true;
                button.classList.add("disabled");
                
                message.classList.add("hidden");
                
                return false;
            }
            
            /// If form is a function, then it can be called to send the onsubmit event.
            if (form) {
                form.addEventListener("submit", submit_form);
                return submit_form;
            } else if (options.trigger_form_submit) {
                throw "In order for this to work, we need a way to get_data_from_form() and not try to prevent the default event.";
                //options.trigger_form_submit(submit_form)
            } else {
                throw "No form!";
            }
        };
        
        /*! Cookies.js - 0.3.1; Copyright (c) 2013, Scott Hamper; http://www.opensource.org/licenses/MIT */
        /// Streamed lined by Greenfield Education.
        (function (undefined)
        {
            var Cookies = function (key, value, options) {
                return arguments.length === 1 ?
                    Cookies.get(key) : Cookies.set(key, value, options);
            };
        
            Cookies.defaults = {
                path: "/"
            };
            
            Cookies._document = document;
        
            Cookies.get = function (key) {
                if (Cookies._cachedDocumentCookie !== Cookies._document.cookie) {
                    Cookies._renewCache();
                }
        
                return Cookies._cache[key];
            };
        
            Cookies.set = function (key, value, options) {
                options = Cookies._getExtendedOptions(options);
                options.expires = Cookies._getExpiresDate(value === undefined ? -1 : options.expires);
        
                Cookies._document.cookie = Cookies._generateCookieString(key, value, options);
        
                return Cookies;
            };
        
            Cookies.expire = function (key, options) {
                return Cookies.set(key, undefined, options);
            };
        
            Cookies._getExtendedOptions = function (options) {
                return {
                    path: options && options.path || Cookies.defaults.path,
                    domain: options && options.domain || Cookies.defaults.domain,
                    expires: options && options.expires || Cookies.defaults.expires,
                    secure: options && options.secure !== undefined ?  options.secure : Cookies.defaults.secure
                };
            };
        
            Cookies._isValidDate = function (date) {
                return Object.prototype.toString.call(date) === "[object Date]" && !isNaN(date.getTime());
            };
        
            Cookies._getExpiresDate = function (expires, now) {
                now = now || new Date();
                switch (typeof expires) {
                    case "number": expires = new Date(now.getTime() + expires * 1000); break;
                    case "string": expires = new Date(expires); break;
                }
        
                if (expires && !Cookies._isValidDate(expires)) {
                    throw new Error("`expires` parameter cannot be converted to a valid Date instance");
                }
        
                return expires;
            };
        
            Cookies._generateCookieString = function (key, value, options) {
                key = encodeURIComponent(key);
                value = (value + "").replace(/[^!#$&-+\--:<-\[\]-~]/g, encodeURIComponent);
                options = options || {};
        
                var cookieString = key + "=" + value;
                cookieString += options.path ? ";path=" + options.path : "";
                cookieString += options.domain ? ";domain=" + options.domain : "";
                cookieString += options.expires ? ";expires=" + options.expires.toUTCString() : "";
                cookieString += options.secure ? ";secure" : "";
        
                return cookieString;
            };
        
            Cookies._getCookieObjectFromString = function (documentCookie) {
                var cookieObject = {};
                var cookiesArray = documentCookie ? documentCookie.split("; ") : [];
        
                for (var i = 0; i < cookiesArray.length; i++) {
                    var cookieKvp = Cookies._getKeyValuePairFromCookieString(cookiesArray[i]);
        
                    if (cookieObject[cookieKvp.key] === undefined) {
                        cookieObject[cookieKvp.key] = cookieKvp.value;
                    }
                }
        
                return cookieObject;
            };
        
            Cookies._getKeyValuePairFromCookieString = function (cookieString) {
                // "=" is a valid character in a cookie value according to RFC6265, so cannot `split("=")`
                var separatorIndex = cookieString.indexOf("=");
        
                // IE omits the "=" when the cookie value is an empty string
                separatorIndex = separatorIndex < 0 ? cookieString.length : separatorIndex;
        
                return {
                    key: decodeURIComponent(cookieString.substr(0, separatorIndex)),
                    value: decodeURIComponent(cookieString.substr(separatorIndex + 1))
                };
            };
        
            Cookies._renewCache = function () {
                Cookies._cache = Cookies._getCookieObjectFromString(Cookies._document.cookie);
                Cookies._cachedDocumentCookie = Cookies._document.cookie;
            };
        
            Cookies._areEnabled = function () {
                return Cookies.set("cookies.js", 1).get("cookies.js") === "1";
            };
            /// Removed enabled check. If you want to know, run Cookies._areEnabled().
        
            window.Cookies = Cookies;
        })();
        
        /// *****************
        /// * End of window *
        /// *****************
    }
    
    return G;
}());

if (typeof module !== "undefined") {
    module.exports = G;
}

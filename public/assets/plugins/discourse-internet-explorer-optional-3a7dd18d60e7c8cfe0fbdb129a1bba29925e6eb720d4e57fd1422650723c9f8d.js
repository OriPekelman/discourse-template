Object.entries||(Object.entries=function(t){for(var e=Object.keys(t),r=e.length,n=new Array(r);r--;)n[r]=[e[r],t[e[r]]];return n}),Object.values||(Object.values=function(t){for(var e=Object.keys(t),r=e.length,n=new Array(r);r--;)n[r]=t[e[r]];return n}),window.NodeList&&!NodeList.prototype.forEach&&(NodeList.prototype.forEach=function(t,e){e=e||window;for(var r=0;r<this.length;r++)t.call(e,this[r],r,this)}),Array.prototype.includes||Object.defineProperty(Array.prototype,"includes",{value:function(t,e){if(null==this)throw new TypeError('"this" is null or not defined');var r=Object(this),n=r.length>>>0;if(0===n)return!1;var o,i,a=0|e,u=Math.max(0<=a?a:n-Math.abs(a),0);for(;u<n;){if((o=r[u])===(i=t)||"number"==typeof o&&"number"==typeof i&&isNaN(o)&&isNaN(i))return!0;u++}return!1}}),String.prototype.includes||Object.defineProperty(String.prototype,"includes",{value:function(t,e){return"number"!=typeof e&&(e=0),!(e+t.length>this.length)&&-1!==this.indexOf(t,e)}}),Array.prototype.find||Object.defineProperty(Array.prototype,"find",{value:function(t){if(null==this)throw new TypeError('"this" is null or not defined');var e=Object(this),r=e.length>>>0;if("function"!=typeof t)throw new TypeError("predicate must be a function");for(var n=arguments[1],o=0;o<r;){var i=e[o];if(t.call(n,i,o,e))return i;o++}},configurable:!0,writable:!0}),Array.from||(Array.from=function(){var e=Object.prototype.toString,l=function(t){return"function"==typeof t||"[object Function]"===e.call(t)},n=Math.pow(2,53)-1,f=function(t){var e,r=(e=Number(t),isNaN(e)?0:0!==e&&isFinite(e)?(0<e?1:-1)*Math.floor(Math.abs(e)):e);return Math.min(Math.max(r,0),n)};return function(t){var e=Object(t);if(null==t)throw new TypeError("Array.from requires an array-like object - not null or undefined");var r,n=1<arguments.length?arguments[1]:void 0;if(void 0!==n){if(!l(n))throw new TypeError("Array.from: when provided, the second argument must be a function");2<arguments.length&&(r=arguments[2])}for(var o,i=f(e.length),a=l(this)?Object(new this(i)):new Array(i),u=0;u<i;)o=e[u],a[u]=n?void 0===r?n(o,u):n.call(r,o,u):o,u+=1;return a.length=i,a}}()),"function"!=typeof Object.assign&&Object.defineProperty(Object,"assign",{value:function(t){"use strict";if(null==t)throw new TypeError("Cannot convert undefined or null to object");for(var e=Object(t),r=1;r<arguments.length;r++){var n=arguments[r];if(null!=n)for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o])}return e},writable:!0,configurable:!0}),String.prototype.repeat||(String.prototype.repeat=function(t){"use strict";if(null==this)throw new TypeError("can't convert "+this+" to object");var e=""+this;if((t=+t)!=t&&(t=0),t<0)throw new RangeError("repeat count must be non-negative");if(t==1/0)throw new RangeError("repeat count must be less than infinity");if(t=Math.floor(t),0==e.length||0==t)return"";if(e.length*t>=1<<28)throw new RangeError("repeat count must not overflow maximum string size");var r=e.length*t;for(t=Math.floor(Math.log(t)/Math.log(2));t;)e+=e,t--;return e+=e.substring(0,r-e.length)}),String.prototype.startsWith||Object.defineProperty(String.prototype,"startsWith",{value:function(t,e){var r=0<e?0|e:0;return this.substring(r,r+t.length)===t}}),function(t,e){"use strict";"object"==typeof module&&"object"==typeof module.exports?module.exports=e(t):e(t)}("undefined"!=typeof window?window:global,function(t){"use strict";var e=Object.defineProperty,r=Object.defineProperties,n=0,o=[],i=Array.prototype.slice,u="object"==typeof t.ES6?t.ES6:t.ES6={},a=Array.isArray,l=Object.prototype.toString,f=Array.prototype.push,c=function(){},s=function(t){return t},p=function(t){return"function"==typeof t},h=function(){},y=function(t,e){this._array=t,this._flag=e,this._nextIndex=0},g=function(t,e){this._string=t,this._flag=e,this._nextIndex=0},b=function(t){return null!==t&&("object"==typeof t||"function"==typeof t)},d=function(t,e){return r(t,{_description:{value:e},_isSymbol:{value:!0},_id:{value:n++}}),t},w=function(t,e){if("number"==typeof t.length&&0<=t.length&&"number"==typeof e.length&&0<=e.length){var r=Math.floor(t.length),n=Math.floor(e.length),o=0;for(t.length=r+n;o<n;++o)e.hasOwnProperty(o)&&(t[r+o]=e[o])}},v=function(t,e){if("function"!=typeof t||"function"!=typeof e)throw new TypeError("Child and Parent must be function type");t.prototype=Object.create(e.prototype),t.prototype.constructor=t},_=function t(e){if(e=void 0===e?"":String(e),this instanceof t)throw new TypeError("Symbol is not a constructor");return d(Object.create(t.prototype),e)};r(_,{for:{value:function(t){t=String(t);for(var e,r=o.length,n=0;n<r;++n)if((e=o[n]).key===t)return e.symbol;return e={key:t,symbol:_(t)},o.push(e),e.symbol},writable:!0,configurable:!0},keyFor:{value:function(t){if(!u.isSymbol(t))throw new TypeError(String(t)+" is not a symbol");for(var e,r=o.length,n=0;n<r;++n)if((e=o[n]).symbol===t)return e.key},writable:!0,configurable:!0},hasInstance:{value:_("Symbol.hasInstance")},isConcatSpreadable:{value:_("Symbol.isConcatSpreadable")},iterator:{value:_("Symbol.iterator")},toStringTag:{value:_("Symbol.toStringTag")}}),_.prototype.toString=function(){return"@@_____"+this._id+"_____"},_.prototype.valueOf=function(){return this},e(h.prototype,_.iterator.toString(),{value:function(){return this},writable:!0,configurable:!0}),v(y,h),v(g,h),e(y.prototype,_.toStringTag.toString(),{value:"Array Iterator",configurable:!0}),e(g.prototype,_.toStringTag.toString(),{value:"String Iterator",configurable:!0}),y.prototype.next=function(){if(!(this instanceof y))throw new TypeError("Method Array Iterator.prototype.next called on incompatible receiver "+String(this));var t,e=this;return-1===e._nextIndex?{done:!0,value:void 0}:"number"==typeof e._array.length&&0<=e._array.length&&e._nextIndex<Math.floor(e._array.length)?(1===e._flag?t=[e._nextIndex,e._array[e._nextIndex]]:2===e._flag?t=e._array[e._nextIndex]:3===e._flag&&(t=e._nextIndex),e._nextIndex++,{done:!1,value:t}):(e._nextIndex=-1,{done:!0,value:void 0})},g.prototype.next=function(){if(!(this instanceof g))throw new TypeError("Method String Iterator.prototype.next called on incompatible receiver "+String(this));var t,e=this,r=new String(this._string);return-1===e._nextIndex?{done:!0,value:void 0}:e._nextIndex<r.length?(t=r[e._nextIndex],e._nextIndex++,{done:!1,value:t}):(e._nextIndex=-1,{done:!0,value:void 0})};var m=function(t,e){this._target=t,this._values=[],this._thisArg=e};m.prototype.spread=function(){var e=this;return i.call(arguments).forEach(function(t){u.forOf(t,function(t){e._values.push(t)})}),e},m.prototype.add=function(){var e=this;return i.call(arguments).forEach(function(t){e._values.push(t)}),e},m.prototype.call=function(t){if("function"!=typeof this._target)throw new TypeError("Target is not a function");return t=arguments.length<=0?this._thisArg:t,this._target.apply(t,this._values)},m.prototype.new=function(){if("function"!=typeof this._target)throw new TypeError("Target is not a constructor");var t,e;return t=Object.create(this._target.prototype),e=this._target.apply(t,this._values),b(e)?e:t},m.prototype.array=function(){if(!a(this._target))throw new TypeError("Target is not a array");return f.apply(this._target,this._values),this._target};return r(u,{isSymbol:{value:function(t){return t instanceof _&&!0===(e=t)._isSymbol&&"number"==typeof e._id&&"string"==typeof e._description;var e},writable:!0,configurable:!0},instanceOf:{value:function(t,e){if(!b(e))throw new TypeError("Right-hand side of 'instanceof' is not an object");var r=e[_.hasInstance];if(void 0===r)return t instanceof e;if("function"!=typeof r)throw new TypeError(typeof r+" is not a function");return r.call(e,t)},writable:!0,configurable:!0},forOf:{value:function(t,e,r){if(e="function"!=typeof e?c:e,"function"!=typeof t[_.iterator])throw new TypeError("Iterable[Symbol.iterator] is not a function");var n,o=t[_.iterator]();if("function"!=typeof o.next)throw new TypeError(".iterator.next is not a function");for(;;){if(n=o.next(),!b(n))throw new TypeError("Iterator result "+n+" is not an object");if(n.done)break;e.call(r,n.value)}},writable:!0,configurable:!0},spreadOperator:{value:function(t,e){if("function"!=typeof t&&!a(t))throw new TypeError("Spread operator only supports on array and function objects at this moment");return new m(t,e)},writable:!0,configurable:!0}}),e(t,"Symbol",{value:_,writable:!0,configurable:!0}),e(Function.prototype,_.hasInstance.toString(),{value:function(t){return"function"==typeof this&&t instanceof this}}),e(Array.prototype,"concat",{value:function(){if(null==this)throw new TypeError("Array.prototype.concat called on null or undefined");var t=Object(this),e=i.call(arguments),r=[];return e.unshift(t),e.forEach(function(t){b(t)?void 0!==t[_.isConcatSpreadable]?t[_.isConcatSpreadable]?w(r,t):r.push(t):a(t)?w(r,t):r.push(t):r.push(t)}),r},writable:!0,configurable:!0}),e(Object.prototype,"toString",{value:function(){return null==this?l.call(this):"string"==typeof this[_.toStringTag]?"[object "+this[_.toStringTag]+"]":l.call(this)},writable:!0,configurable:!0}),e(Array.prototype,_.iterator.toString(),{value:function(){if(null==this)throw new TypeError("Cannot convert undefined or null to object");var t=Object(this);return new y(t,2)},writable:!0,configurable:!0}),e(Array,"from",{value:function(t,e,r){var n,o,i,a=0;if(n=p(this)?this:Array,null==t)throw new TypeError("Cannot convert undefined or null to object");if(t=Object(t),void 0===e)e=s;else if(!p(e))throw new TypeError(e+" is not a function");if(void 0===t[_.iterator]){if(!("number"==typeof t.length&&0<=t.length))return(i=new n(0)).length=0,i;for(o=Math.floor(t.length),(i=new n(o)).length=o;a<o;++a)i[a]=e.call(r,t[a])}else(i=new n).length=0,u.forOf(t,function(t){i.length++,i[i.length-1]=e.call(r,t)});return i},writable:!0,configurable:!0}),e(Array.prototype,"entries",{value:function(){if(null==this)throw new TypeError("Cannot convert undefined or null to object");var t=Object(this);return new y(t,1)},writable:!0,configurable:!0}),e(Array.prototype,"keys",{value:function(){if(null==this)throw new TypeError("Cannot convert undefined or null to object");var t=Object(this);return new y(t,3)},writable:!0,configurable:!0}),e(String.prototype,_.iterator.toString(),{value:function(){if(null==this)throw new TypeError("String.prototype[Symbol.iterator] called on null or undefined");return new g(String(this),0)},writable:!0,configurable:!0}),u}),window.addEventListener("load",function(){window.Promise=require("rsvp").Promise},!1);
//# sourceMappingURL=/assets/plugins/discourse-internet-explorer-optional-3a7dd18d60e7c8cfe0fbdb129a1bba29925e6eb720d4e57fd1422650723c9f8d.js.map
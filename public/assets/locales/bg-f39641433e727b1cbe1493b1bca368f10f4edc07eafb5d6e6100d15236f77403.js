/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
      locale = options.locale || I18n.currentLocale(),
      messages = translations[locale] || {},
      currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
      opts,
      count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
      placeholder,
      value,
      name;

  if (!matches) { return message; }

  for (var i = 0; placeholder = matches[i]; i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}"));
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== 'en') {
      options.locale = 'en';
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.format"),
    {precision: 3, separator: this.SEPARATOR, delimiter: ",", strip_insignificant_zeros: false}
  );

  var negative = number < 0,
      string = Math.abs(number).toFixed(options.precision).toString(),
      parts = string.split(this.SEPARATOR),
      precision,
      buffer = [],
      formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length -3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
        separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
        zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "")
    ;
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
      size = number,
      iterations = 0,
      unit,
      precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", {count: size});
    precision = 0;
  } else {
    unit = this.t("number.human.storage_units.units." + [null, "kb", "mb", "gb", "tb"][iterations]);
    precision = (size - Math.floor(size) === 0) ? 0 : 1;
  }

  options = this.prepareOptions(
    options,
    {precision: precision, format: "%n%u", delimiter: ""}
  );

  number = this.toNumber(size, options);
  number = options.format
    .replace("%u", unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = ((typeof key === "object") && (key instanceof Array)) ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = '[' + this.currentLocale() + this.SEPARATOR + scope;
  if (key) { message += this.SEPARATOR + key; }
  return message + ']';
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value){
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return 'Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.';
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"topic.read_more_MF" : function(d){
var r = "";
r += "Има ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 непрочетено</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " непрочетени </a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 нова </a> тема";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " теми </a>";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " или ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "потърси други теми в ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Тази тема има ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 reply";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " replies";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "with a high like to post ratio";
return r;
},
"med" : function(d){
var r = "";
r += "with a very high like to post ratio";
return r;
},
"high" : function(d){
var r = "";
r += "with an extremely high like to post ratio";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "logs_error_rate_notice.reached_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> reached site setting limit of ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> reached site setting limit of ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> exceeded site setting limit of ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> exceeded site setting limit of ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "You are about to delete ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> post";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> posts";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> topic";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " from this user, remove their account, block signups from their IP address <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b>, and add their email address <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> to a permanent block list. Are you sure this user is really a spammer?";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "You are about to delete ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 post";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " posts";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 topic";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["bg"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Are you sure?";
return r;
}};
MessageFormat.locale.bg = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"bg":{"js":{"number":{"format":{"separator":".","delimiter":", "},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Байт","other":"Байта"},"gb":"ГБ","kb":"КБ","mb":"МБ","tb":"ТБ"}}},"short":{"thousands":"{{number}}k ","millions":"{{number}}M "}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"D MMM h:mm a","long_no_year_no_time":"D MMM","full_no_year_no_time":"Do MMMM","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY ","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"преди %{date}","tiny":{"half_a_minute":"\u003c 1 мин.","less_than_x_seconds":{"one":"\u003c %{count}сек","other":"\u003c %{count}сек"},"x_seconds":{"one":"%{count}сек","other":"%{count}сек"},"less_than_x_minutes":{"one":"\u003c %{count}м","other":"\u003c %{count}м"},"x_minutes":{"one":"%{count}мин","other":"%{count}мин"},"about_x_hours":{"one":"%{count}ч","other":"%{count}ч"},"x_days":{"one":"%{count}д","other":"%{count}д"},"x_months":{"one":"%{count}месец","other":"%{count}месеца"},"about_x_years":{"one":"%{count}г","other":"%{count}г"},"over_x_years":{"one":"\u003e %{count}г","other":"\u003e %{count}г"},"almost_x_years":{"one":"%{count}г","other":"%{count}г"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} минута","other":"%{count} минути"},"x_hours":{"one":"%{count} час","other":"%{count} часа"},"x_days":{"one":"%{count} ден","other":"%{count} дни"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"преди %{count} минута","other":"преди %{count} минути"},"x_hours":{"one":"преди %{count} час","other":"преди %{count} часа"},"x_days":{"one":"преди %{count} ден","other":"преди %{count} дни"},"x_months":{"one":"преди %{count} месец","other":"преди %{count} месеца"},"x_years":{"one":"преди %{count} година","other":"преди %{count} години "}},"later":{"x_days":{"one":"%{count} ден по-късно","other":"%{count} дни по-късно"},"x_months":{"one":"%{count} месец по-късно","other":"%{count} месеца по-късно"},"x_years":{"one":"%{count} година по-късно","other":"%{count} години по-късно"}},"previous_month":"Предишен месец","next_month":"Следващ месец","placeholder":"дата"},"share":{"topic_html":"Тема: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"публикации #%{postNumber}","close":"затвори","twitter":"Споделете тази връзка в Twitter","facebook":"Споделете тази връзка във Facebook","email":"Изпратете тази връзка с имейл"},"action_codes":{"public_topic":"направи тази тема публична на %{when}","private_topic":"направи тази тема персонално съобщение%{when}","split_topic":"раздели тази тема %{when}","invited_user":"покани %{who} %{when}","invited_group":"покани %{who} на %{when}","user_left":"%{who}напусна чата %{when}","removed_user":"изтри %{who} %{when}","removed_group":"изтри %{who} на %{when}","autoclosed":{"enabled":"затворена %{when}","disabled":"отворена %{when}"},"closed":{"enabled":"затворена %{when}","disabled":"отворена %{when}"},"archived":{"enabled":"архивирана %{when}","disabled":"разархивирана %{when}"},"pinned":{"enabled":"закована %{when}","disabled":"откована %{when}"},"pinned_globally":{"enabled":"закована глобално %{when}","disabled":"откована %{when}"},"visible":{"enabled":"добавена в списъка %{when}","disabled":"премахната от списъка %{when}"}},"emails_are_disabled":"Всички изходящи имейли са изцяло забранени от администратора. Няма да бъдат изпращани никакви имейл известия.","bootstrap_mode_enabled":"За да помогнем със стартирането на вашия нов сайт по-лесно поставихме сайта в \"стартиращо режим\". Всички нови потребители ще получат ниво на доверие 1 и ще имат активирани дневни известия за активноста във форума. Този режим ще бъде автоматично спрян когато бройката регистрирани потребители стигне %{min_users} .","themes":{"default_description":"По подразбиране","broken_theme_alert":"Вашият уебсайт може да не работи, защото в тема / компонент %{theme} има грешки. Изключете я тук %{path}."},"s3":{"regions":{"ap_northeast_1":"Азия (Токио)","ap_northeast_2":"Азия (Сеул)","ap_south_1":"Азия (Мумбай)","ap_southeast_1":"Азия (Сингапур)","ap_southeast_2":"Океания (Сидни)","ca_central_1":"Canada (Central)","cn_north_1":"Китай (Пекин)","cn_northwest_1":"China (Ningxia)","eu_central_1":"EU (Франкфурт)","eu_north_1":"EU (Stockholm)","eu_west_1":"EU (Ирландия)","eu_west_2":"EU (London)","eu_west_3":"EU (Paris)","sa_east_1":"South America (São Paulo)","us_east_1":"US East (Из. Вирджиния)","us_east_2":"US East (Ohio)","us_gov_east_1":"AWS GovCloud (US-East)","us_gov_west_1":"AWS GovCloud (US-West)","us_west_1":"US West (С. Калифорния)","us_west_2":"US West (Орегон)"}},"edit":"редактирайте заглавието и категорията на тази тема","expand":"Разшири","not_implemented":"Тази функционалност все още не е добавена.","no_value":"Не","yes_value":"Да","submit":"Изпрати","generic_error":"Съжаляваме, възникна грешка.","generic_error_with_reason":"Грешка: %{error}","go_ahead":"Продължете напред","sign_up":"Регистрация","log_in":"Вход","age":"Години","joined":"Присъединен","admin_title":"Админ","show_more":"покажи повече","show_help":"опции","links":"Връзки","links_lowercase":{"one":"Линк","other":"Линкове"},"faq":"FAQ","guidelines":"Насоки","privacy_policy":"Декларация за поверителност","privacy":"Поверителност","tos":"Правила за ползване","rules":"Правила","conduct":"Правила за поведение","mobile_view":"Мобилен изглед","desktop_view":"Десктоп изглед","you":"Вие","or":"или","now":"преди малко","read_more":"прочетете повече","more":"Повече","less":"По-малко","never":"никога","every_30_minutes":"на всеки 30 минути","every_hour":"на всеки час","daily":"ежедневно","weekly":"седмично","every_month":"всеки месец","every_six_months":"на всеки шест месеца","max_of_count":"максимално от {{count}}","alternation":"или","character_count":{"one":"{{count}} символ","other":"{{count}} символа"},"related_messages":{"title":"Свързани съобщения"},"suggested_topics":{"title":"Подобни теми","pm_title":"Предложени съобщения"},"about":{"simple_title":"Относно","title":"За %{title}","stats":"Статистика на сайта","our_admins":"Нашите админи","our_moderators":"Нашите модератори","moderators":"Модератори","stat":{"all_time":"От началото","last_7_days":"Последните 7","last_30_days":"Последните 30"},"like_count":"Харесвания","topic_count":"Теми","post_count":"Публикации","user_count":"Потребители","active_user_count":"Активни потребители","contact":"Свържете се с нас","contact_info":"В случай на критичен или спешен въпрос засягащ този сайт, моля свържете се с нас на адрес %{contact_email}."},"bookmarked":{"title":"Отметка","clear_bookmarks":"Изчисти отметките","help":{"bookmark":"Щракнете за да добавите в отметки първата публикация в тази тема","unbookmark":"Щракнете тук за да изтриите всички отметки в тази тема"}},"bookmarks":{"created":"Вие добавихте тази публикация в отметки","not_bookmarked":"добавете тази публикация в Отметки","remove":"Премахнете отметката","save":"Запази"},"drafts":{"remove":"Премахване","abandon":{"yes_value":"Да, напусни","no_value":"Не, запази"}},"topic_count_new":{"one":"Вижте {{count}} нова тема","other":"Вижте {{count}} нови теми"},"preview":"преглед","cancel":"прекрати","save":"Запазете промените","saving":"Запазва се...","saved":"Запазено!","upload":"Качване","uploading":"Качва се...","uploading_filename":"Качване: {{filename}}...","uploaded":"Качено!","pasting":"Вмъкване...","enable":"Позволи","disable":"Деактивиране","continue":"Напред","undo":"Отмени","revert":"Върни","failed":"Провалени","switch_to_anon":"Влез в Анонимен режим. ","switch_from_anon":"Излез от Анонимен режим.","banner":{"close":"Премахнете банера","edit":"Редактирай този банер \u003e\u003e"},"choose_topic":{"none_found":"Няма нови теми."},"review":{"order_by":"Подреди по","explain":{"total":"Общо"},"delete":"Изтрий","settings":{"save_changes":"Запази промените","title":"Настройки"},"topic":"Тема:","filtered_user":"Потребител","user":{"username":"Потребителско име","email":"Имейл","name":"Име"},"topics":{"topic":"Тема"},"edit":"Редактирай","save":"Запази","cancel":"Отмени","filters":{"type":{"title":"Тип"},"refresh":"Опресни","category":"Категория"},"scores":{"date":"Дата","type":"Тип"},"statuses":{"pending":{"title":"Чакащи"},"rejected":{"title":"Отхвърлени"}},"types":{"reviewable_user":{"title":"Потребител"}},"approval":{"title":"Публикацията изисква одобрение","description":"Ние получихме вашата публикация, но тя трябва да бъде одобрена от модератора преди да бъде показана. Моля, проявете търпение.","ok":"Ок"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e публикува \u003ca href='{{topicUrl}}'\u003eтази тема\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eВие\u003c/a\u003e публикувахте \u003ca href='{{topicUrl}}'\u003eтази тема\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e отговори на \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eВие\u003c/a\u003e отговорихте на \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e отговори в \u003ca href='{{topicUrl}}'\u003eтази тема\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eВие\u003c/a\u003e отговорихте в \u003ca href='{{topicUrl}}'\u003eтази тема\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e спомена \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003eВи\u003c/a\u003e спомена","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eВие\u003c/a\u003e споменахте \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Публикувано от \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Публикувано от \u003ca href='{{userUrl}}'\u003eвас\u003c/a\u003e","sent_by_user":"Изпратено от \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Изпратено от \u003ca href='{{userUrl}}'\u003eВас\u003c/a\u003e"},"directory":{"filter_name":"филтър по потребитилско име","title":"Потребители","likes_given":"Дадени","likes_received":"Получени","topics_entered":"Видяни","topics_entered_long":"Видяни теми","time_read":"Време за прочитане","topic_count":"Теми","topic_count_long":"Създадени теми","post_count":"Отговори","post_count_long":"Публикувани отговори","no_results":"Няма намерени резултати.","days_visited":"Посещения","days_visited_long":"Посетени дни","posts_read":"Прочетени","posts_read_long":"Прочетени публикации","total_rows":{"one":"%{count} потребител","other":"%{count} потребители"}},"group_histories":{"actions":{"change_group_setting":"Промени настройки","add_user_to_group":"Добави потребител","remove_user_from_group":"Премахни потребител","make_user_group_owner":"Превърни в собственик","remove_user_as_group_owner":"Премахни като собственик"}},"groups":{"add_members":{"title":"Добавете потребители","usernames":"Потебителско име"},"requests":{"reason":"Причина"},"manage":{"title":"Управление","name":"Име","full_name":"Пълно име","add_members":"Добавете потребители","delete_member_confirm":"Премахнете '%{username}' от група '%{group}' ?","profile":{"title":"Профил"},"interaction":{"posting":"Публикуване","notification":"Известие"},"membership":{"title":"Членство","access":"Достъп"},"logs":{"title":"Логове","when":"Кога","action":"Действие","acting_user":"Действащ потребител","target_user":"Целеви потребител","subject":"Тема","details":"Детайли ","from":"От","to":"До"}},"public_admission":"Разрешено е на потребителите да се присъединяват към групата свободно (Изисква се публично видима група)","public_exit":"Разрешено е на потребителите да напуската групата свободно","empty":{"posts":"Няма публикации от членове на тази група.","members":"Няма членове в тази група.","mentions":"Няма споменавания на тази група.","messages":"Няма съобщения за тази група.","topics":"Няма теми от членове на тази група.","logs":"Няма журнал за тази група."},"add":"Добави","join":"Влизане","leave":"Напусни","request":"Заявка","message":"Съобщение","membership":"Членство","name":"Име","user_count":"Потребители","bio":"Относно групата","selector_placeholder":"въведи потребителско име ","owner":"собственик","index":{"title":"Групи","all":"Всички групи","empty":"Няма видими групи.","close_groups":"Затворени групи","automatic":"Автоматично","closed":"Затворена","public":"Публични","private":"Затворени","automatic_group":"Автоматична група","my_groups":"Моите групи","is_group_user":"Член","is_group_owner":"Собественик"},"activity":"Активност","members":{"title":"Членове","filter_placeholder":"Потребителско име","owner":"Собественик"},"topics":"Теми","posts":"Публикации","mentions":"Споменавания","messages":"Съобщения","notification_level":"Nиво на уведомяване по подразбиране за груповите съобщения","alias_levels":{"mentionable":"Кой може да @mention (споменава) тази група?","messageable":"Кой може да изпраща съобщения към тази група?","nobody":"Никой","only_admins":"Само администратори","mods_and_admins":"Само модератори и администратори","members_mods_and_admins":"Само членове, модератори и администратори","everyone":"Всички"},"notifications":{"watching":{"title":"Наблюдава","description":"Вие бъдете уведомени за всеки нов пост във всяко съобщение, както и за броя на новите съобщения."},"watching_first_post":{"title":"Следейки за първа публикация"},"tracking":{"title":"Проследяване","description":"Ще бъдете уведомени, ако някой ви спомене чрез @name или ви отговори, както и на броя на новите ви съобщения ще бъдат показани."},"regular":{"title":"Нормален","description":"Ще бъдете уведомени, ако някой ви споменава чрез @name или ви отговори."},"muted":{"title":"Заглушен"}},"flair_url":"Добавка към аватара","flair_url_placeholder":"(По желание) Адрес към снимка или Font Awesome клас","flair_bg_color":"Фон на добавка към аватара","flair_bg_color_placeholder":"(По желание) Шестнадесетична стойност на цвят","flair_color":"Цвят на добавка към аватар","flair_color_placeholder":"(По желание) Шестнадесетична стойност на цвят","flair_preview_icon":"Икона за прегледа","flair_preview_image":"Снимка за преглед"},"user_action_groups":{"1":"Дадени харесвания","2":"Получени харесвания","3":"Отметки","4":"Теми","5":"Отговори","6":"Отговори","7":"Споменавания","9":"Цитати","11":"Редакции","12":"Изпратени","13":"Кутия","14":"Чакащи"},"categories":{"all":"всички категории","all_subcategories":"всички подкатегории","no_subcategory":"без подкатегория","category":"Категории","category_list":"Покажи списък с категориите","reorder":{"title":"Пренареди Категориите","title_long":"Реорганизирай списъка с категориите","save":"Запази реда","apply_all":"Приложи","position":"Позиция"},"posts":"Публикации","topics":"Теми","latest":"Последни","latest_by":"последни от","toggle_ordering":"включете контрол на подредбата","subcategories":"Подкатегории","topic_sentence":{"one":"%{count} тема","other":"%{count} теми"}},"ip_lookup":{"title":"Търсене по IP адрес","hostname":"Хост","location":"Локация","location_not_found":"(неизвестно)","organisation":"Организация","phone":"Телефон","other_accounts":"Други профили с този IP адрес:","delete_other_accounts":"Изтрий %{count}","username":"Потребителско име","trust_level":"TL","read_time":"Време за прочитане","topics_entered":"добавени теми","post_count":"# публикации","confirm_delete_other_accounts":"Сигурни ли сте, че искате да изтриете тези профили?"},"user_fields":{"none":"(изберете опция)"},"user":{"said":"{{username}}:","profile":"Профил","mute":"Заглуши","edit":"Редактирай настройките","download_archive":{"confirm":"Сигурни ли сте, че искате да свалите своите публикации?","success":"Свалянето е инициирано, ще бъдете уведомени чрез съобщение когато процесът е завършен.","rate_limit_error":"Публикации могат да бъдат сваляни веднъж дневно, моля опитайте отново утре."},"new_private_message":"Ново Съобщение","private_message":"Съобщение","private_messages":"Съобщения","user_notifications":{"ignore_duration_username":"Потребителско име","mute_option":"Заглушен","normal_option":"Нормален"},"activity_stream":"Активност","preferences":"Настройки","feature_topic_on_profile":{"save":"Запази","clear":{"title":"Изчисти"}},"expand_profile":"Разшири","bookmarks":"Отметки","bio":"За мен","invited_by":"Поканен от","trust_level":"Ниво на доверие","notifications":"Известия","statistics":"Статистика","desktop_notifications":{"label":"Известявания в реално време","not_supported":"Известията не се поддържат от този браузър. Съжаляваме.","perm_default":"Включване на Известията","perm_denied_btn":"Разрешението е отказано","perm_denied_expl":"Вие сте забранили известията. Моля разрешете ги чрез настройките на браузъра си.","disable":"Деактивиране на Известията","enable":"Активиране на Известията","each_browser_note":"Забележка: Трябва да промените тази настройка при всички браузъри, които използвате.","consent_prompt":"Искате ли известявания в реално време, когато хората отговарят на вашите публикации?"},"dismiss":"Отмени","dismiss_notifications":"Отмени всички","dismiss_notifications_tooltip":"Маркирайте всички непрочетени известия, като прочетени","first_notification":"Вашето първо известие! Изберете го за да започнете.","external_links_in_new_tab":"Отваряй всички външни връзки в нов раздел.","enable_quoting":"Включи отговор с цитат при маркиран текст.","change":"промени","moderator":"{{user}} е модератор","admin":"{{user}} е админ","moderator_tooltip":"Този потребител е модератор","admin_tooltip":"Този потребител е админ","suspended_notice":"Този потребител е отстранен до {{date}}.","suspended_reason":"Причина:","github_profile":"Github","email_activity_summary":"Сумарна активност","mailing_list_mode":{"label":"Режим Бюлетин","enabled":"Включи режим Бюлетин","individual":"Изпращане на email за всяка нова публикация","individual_no_echo":"Пращай имейл за всяка нова публикация освен моите собствени","many_per_day":"Пращай имейл за всяка нова публикация (около {{dailyEmailEstimate}} на ден)","few_per_day":"Изпратете ми имейл за всяка нова публикация (около 2 на ден)"},"tag_settings":"Етикети","watched_tags":"Наблюдавани","watched_tags_instructions":"Вие автоматично ще наблюдавате всички теми с този етикет. Ще бъдете информиран за всички нови публикации и теми, и броят на непрочетените и новите публикации ще се появява до съответната тема. ","tracked_tags":"Следени","tracked_tags_instructions":"Вие автоматично ще следите всички нови теми с този етикет. Броят новите публикации ще се появява до съответната тема. ","muted_tags":"Заглушени","muted_tags_instructions":"Вие няма да бъдете уведомяван за нищо свързано с нови теми с тези етикети, и те няма да се показват в \"последни\".","watched_categories":"Наблюдавани","watched_categories_instructions":"Вие автоматично ще наблюдавате всички нови теми в тази категория. Ще бъдете информиран за всички нови публикации и теми, и броят на непрочетените и новите публикации ще се появява до съответната тема. ","tracked_categories":"Следени","tracked_categories_instructions":"Вие автоматично ще следите всички нови теми в тези категории. Броят новите публикации ще се появява до съответната тема. ","watched_first_post_categories":"Наблюдаване на Първа Публикация","watched_first_post_categories_instructions":"Ще бъдете уведомени за първата публикация във всяка нова тема в тези категории","watched_first_post_tags":"Наблюдавайки Първа Публикация","watched_first_post_tags_instructions":"Ще бъдете уведомени за първата публикация във всяка нова тема с тези етикети.","muted_categories":"Заглушен","no_category_access":"Като модератор имате ограничен достъп до категориите, запазването е изключено.","delete_account":"Изтрий моя профил","delete_account_confirm":"Сигурни ли сте, че искате да изтриете вашия акаунт? Акаунтът не може да бъде възстановен !","deleted_yourself":"Вашият профил беше изтрит успешно.","delete_yourself_not_allowed":"Моля, свържете се с член на персонала, ако искате профилът Ви да бъде изтрит.","unread_message_count":"Съобщения","admin_delete":"Изтрий","users":"Потребители","muted_users":"Заглушен","muted_users_instructions":"Забрани всички съобщения от тези потребители","tracked_topics_link":"Покажи ","automatically_unpin_topics":"Автоматично отключете темите когато стигнете най-долу на форума.","apps":"Приложения","revoke_access":"Прекратяване на достъпа","undo_revoke_access":"Отмяна прекратяване на достъпа","api_approved":"Одобрени:","staff_counters":{"flags_given":"полезни сигнали","flagged_posts":"публикации със сигнали","deleted_posts":"изтрити публикации","suspensions":"отстранявания","warnings_received":"предупреждения"},"messages":{"all":"Всички","inbox":"Входяща кутия","sent":"Изпратени","archive":"Архив","groups":"Моите групи","bulk_select":"Изберете съобщения","move_to_inbox":"Премести във входящи","move_to_archive":"Архив","failed_to_move":"Грешка при преместването на съобщенията (може би интернета ви спря?)","select_all":"Избери всички","tags":"Етикети"},"preferences_nav":{"account":"Профил","profile":"Профил","emails":"Имейли","notifications":"Известия","categories":"Категории","users":"Потребители","tags":"Етикети","apps":"Апликации"},"change_password":{"success":"(имейлът е изпратен)","in_progress":"(изпраща се имейл)","error":"(грешка)","action":"Изпратете имейл за смяна на паролата","set_password":"Задайте парола","choose_new":"Избери нова парола","choose":"Избери парола"},"second_factor_backup":{"regenerate":"Регенерирай","disable":"Деактивиране","enable":"Позволи"},"second_factor":{"title":"Двуфакторно удостоверяване","confirm_password_description":"Моля, потвърдете паролата за да продължите","name":"Име","label":"Код","edit":"Редактирай","security_key":{"register":"Регистриране","delete":"Изтрий"}},"change_about":{"title":"Смяна на За мен","error":"Имаше грешка при промяна на тази стойност."},"change_username":{"title":"Смяна на потребителското име.","taken":"Съжаляваме, това потребителско име е заето.","invalid":"Потребителското име не е валидно. Трябва да включва само цифри и букви"},"change_email":{"title":"Смяна на Имейла","taken":"Съжаляваме, този имейл адрес не е свободен.","error":"Получи се грешка при смяната на адреса. Вероятно адресът вече е зает?","success":"Изпратихме съобщение на този адрес. Моля, следвайте инструкциите за потвърждаване.","success_staff":"Изпратихме съобщение на този адрес. Моля, следвайте инструкциите за потвърждаване."},"change_avatar":{"title":"Сменете аватара на вашия профил ","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, базиран на","gravatar_title":"Промени вашият аватар на сайта на Граватар","refresh_gravatar_title":"Опреснете Gravatar","letter_based":"Системен аватар","uploaded_avatar":"Собствено изображение","uploaded_avatar_empty":"Добавете собствено изображение","upload_title":"Качете изображение","image_is_not_a_square":"Внимание: изрязахмеИзрязахме вашата снимка,снимка защото не е с квадратна форма."},"change_card_background":{"title":"Потребителски фон","instructions":"Фонът ще бъде центриран и ще има дължина 590 пиксела."},"email":{"title":"Имейл","instructions":"Не е публичен","ok":"Ще Ви изпратим имейл за потвърждение.","invalid":"Моля, въведете валиден имейл адрес","authenticated":"Вашият имейл беше потвърден от {{provider}}.","frequency_immediately":"Ще ви изпратим мейл веднага, ако не сте прочели поста за който сме ви писали.","frequency":{"one":"Ние ще ви изпратим имейл само ако не сме ви виждали през последната минута.","other":"Ние ще ви изпратим имейл само ако не сме ви виждали през последните {{count}} минути."}},"associated_accounts":{"revoke":"Анулирай","cancel":"Отмени"},"name":{"title":"Име","instructions":"вашето пълно име (опционално)","instructions_required":"Вашето пълно име","too_short":"Името е твърде кратко.","ok":"Вашето име изглежда добре"},"username":{"title":"Потребителско име","instructions":"уникално, без интервали","short_instructions":"Хора могат да Ви споменават като @{{username}}","available":"Вашето потребителско име е свободно","not_available":"Не е налично. Пробвайте с {{suggestion}}?","not_available_no_suggestion":"Не е наличен!","too_short":"Потребителското име е твърде кратко","too_long":"Потребителското име е твърде дълго","checking":"Проверяваме дали потребителското име е свободно...","prefilled":"Имейлът съвпада с това потребителско име"},"locale":{"title":"Език на интерфейса","instructions":"Езикът на потребителския интерфейс, ще бъде променен, след като презаредите страницата.","default":"(по подразбиране)"},"password_confirmation":{"title":"Паролата отново"},"auth_tokens":{"ip":"IP ","details":"Детайли "},"last_posted":"Последна публикация","last_emailed":"Последен имейл","last_seen":"Видян","created":"Присъединен","log_out":"Изход","location":"Локация","website":"Уеб сайт","email_settings":"Имейл ","text_size":{"normal":"Нормален"},"like_notification_frequency":{"title":"Информирай ме когато е харесан","always":"Винаги","first_time_and_daily":"За първи път пост е харесан и през деня","first_time":"За първи път пост е харесан","never":"Никога"},"email_previous_replies":{"title":"Добави последните отговори в края на мейлите","unless_emailed":"освен ако не е изпратен вече","always":"винаги","never":"никога"},"email_digests":{"every_30_minutes":"на всеки 30 минути","every_hour":"почасово","daily":"дневно","weekly":"седмично","every_month":"всеки месец","every_six_months":"на всеки шест месеца"},"email_level":{"title":"Изпращайте ми имейл, когато някой ме цитира, отговаря на моите публикации, цитира моето @потребителско_име или ме кани да се присъединя към тема.","always":"винаги","never":"никога"},"email_messages_level":"Изпращай ми имейл, когато някой ми изпрати съобщение","include_tl0_in_digests":"Включи мненията от нови потребители в обобщените имейли","email_in_reply_to":"Включи откъс от отговора на поста в мейлите","other_settings":"Други","categories_settings":"Категории","new_topic_duration":{"label":"Отбелязване на темите като нови, когато","not_viewed":"Аз все още не съм ги видял","last_here":"създадени след последното ми посещение","after_1_day":"създадени през последния ден","after_2_days":"създадени през последните 2 дни","after_1_week":"създадени през последната седмица","after_2_weeks":"създадени през последните 2 седмици"},"auto_track_topics":"Автоматично следи темите които съм въвел","auto_track_options":{"never":"никога","immediately":"веднага","after_30_seconds":"след 30 секунди","after_1_minute":"след 1 минута","after_2_minutes":"след 2 минути","after_3_minutes":"след 3 минути","after_4_minutes":"след 4 минути","after_5_minutes":"след 5 минути","after_10_minutes":"след 10 минути"},"invited":{"search":"търсете покани","title":"Покани","user":"Поканени потребители","truncated":{"one":"Показване на първата покана.","other":"Показване на пъврите {{count}} покани."},"redeemed":"Взети покани","redeemed_tab":"Взети","redeemed_tab_with_count":"Взети ({{count}})","redeemed_at":"Взети","pending":"Изчакващи покани","pending_tab":"Чакащи","pending_tab_with_count":"Чакащи ({{count}})","topics_entered":"Прегледани теми","posts_read_count":"Прочетени публикации","expired":"Тази покана е изтекла.","rescind":"Премахване","rescinded":"Поканата е премахната","reinvite":"Изпратете отново","reinvite_all":"Препрати всички покани","reinvited":"Поканата е изпратена отново","reinvited_all":"Всички покани са препратени!","time_read":"Време за прочитане","days_visited":"Дни Посетена","account_age_days":"Период на акаунта в дни","create":"Изпрати покана","generate_link":"Копирай Връзката-Покана","bulk_invite":{"text":"Групова покана чрез файл","success":"Файлът е качен успешно. Ще бъдете информирани чрез съобщение, когато процесът завърши."}},"password":{"title":"Парола","too_short":"Вашата парола е твърде кратка.","common":"Вашата парола е твърде разпространена.","same_as_username":"Вашата парола е същата като вашето потребителско име.","same_as_email":"Вашата парола е същата като вашия email.","ok":"Вашата парола изглежда добре.","instructions":"поне %{count}знака"},"summary":{"title":"Сумарно","stats":"Статистика","time_read":"Време за прочитане","topic_count":{"one":"Създадена тема","other":"Създадени теми"},"post_count":{"one":"Създадена публикация","other":"Създадени публикации "},"days_visited":{"one":"Посетен ден","other":"Посетени дни"},"posts_read":{"one":"Прочетена публикация","other":"Прочетени публикации "},"bookmark_count":{"one":"маркер","other":"маркери"},"top_replies":"Най-отговаряни","no_replies":"Все още няма отговори.","more_replies":"Още отговори","top_topics":"Най-добри теми","no_topics":"Все още няма теми.","more_topics":"Още теми","top_badges":"С най-много значки","no_badges":"Все още няма значки.","more_badges":"Още значки","top_links":"Най-добри връзки","no_links":"Все още няма линкове.","most_liked_by":"По най-харесвани","most_liked_users":"Най-харесвани","most_replied_to_users":"По най-отговаряни","no_likes":"Все още няма харесвания.","topics":"Теми","replies":"Отговори"},"ip_address":{"title":"Последен IP адрес."},"registration_ip_address":{"title":"IP адрес при регистрацията."},"avatar":{"title":"Аватар","header_title":"профил, съобщения, отметки и предпочитания"},"title":{"title":"Заглавие","none":"(никой)"},"primary_group":{"title":"Главна група","none":"(никой)"},"filters":{"all":"Всички"},"stream":{"posted_by":"Публикувано от","sent_by":"Изпратено от","private_message":"Съобщение","the_topic":"темата"}},"loading":"Зарежда се...","errors":{"prev_page":"докато се зареждаше","reasons":{"network":"Грешка при свързване","server":"Грешка в сървъра","forbidden":"Достъпът е ограничен","unknown":"Грешка","not_found":"Страницата не е намерена"},"desc":{"network":"Моля проверете вашата връзка","network_fixed":"Изглежда се е върнала.","server":"Грешка: {{status}}","forbidden":"Няматe права да виждате това.","not_found":"Опаа, приложението опита да зареди URL, който не съществува.","unknown":"Нещо се обърка."},"buttons":{"back":"Назад","again":"Опитайте отново","fixed":"Заредете страницата"}},"close":"Затвори","assets_changed_confirm":"Страницата беше обновена. Презаредете, за да видите последната версия.","logout":"Вие бяхте отписан.","refresh":"Опресни","read_only_mode":{"enabled":"Сайта е в режим само за четене. Моля продължете да разглеждате, но отгавяне, харесване и всичко останали опции са спряни за сега.","login_disabled":"Влизането е изключено докато страницата е в мод само за четене.","logout_disabled":"Излизане от сайта е временно спряно, докато е пуснат режим \"само за четене\"."},"learn_more":"научете повече...","all_time":"общо","all_time_desc":"общо създадени теми","year":"година","year_desc":"теми създадени през последните 365 дни","month":"месец","month_desc":"теми създадени през последните 30 дни","week":"седмица","week_desc":"теми създадени през последните 7 дни","day":"ден","first_post":"Първа публикация","mute":"Заглушаване","unmute":"Премахване на заглушаване","last_post":"Публикувано","time_read":"Прочетени","last_reply_lowercase":"последен отговор","replies_lowercase":{"one":"отговор","other":"отговори"},"signup_cta":{"sign_up":"Регистрирай се","hide_session":"Напомни ми утре","hide_forever":"не благодаря","hidden_for_session":"Добре, Ще ви питам отново утре. През това време можете да използвате бутона \"Влизане\" или да си създадете нов потребител."},"summary":{"enabled_description":"В момента гледате резюме на тази тема: най-интересните публикации определени от общността.","description":"Има \u003cb\u003e{{replyCount}}\u003c/b\u003e отговора.","description_time":"В момента има \u003cb\u003e{{replyCount}}\u003c/b\u003e отговора прочетени за \u003cb\u003e{{readingTime}} минути\u003c/b\u003e.","enable":"Обобщи Тази Тема","disable":"Покажи всички публикации"},"deleted_filter":{"enabled_description":"Тази тема има изтрити публикации, които са скрити.","disabled_description":"Изтритите публикации в тази тема са показани.","enable":"Скрий изтритите публикации","disable":"Покажи изтритите публикации"},"private_message_info":{"title":"Съобщение","remove_allowed_user":"Сигурни ли сте, че искате да премахнете {{name}} от това съобщение?","remove_allowed_group":"Сигурни ли сте, че искате да премахнете {{name}} от това съобщение?"},"email":"Имейл","username":"Потребителско име","last_seen":"Видяно","created":"Създадено","created_lowercase":"създадено","trust_level":"Ниво на доверие","search_hint":"потребителско име, имейл или IP адрес","create_account":{"title":"Създай нов профил","failed":"Нещо се случи, вероятно вече има регистрация с този имейл адрес, опитайте с линка за забравена парола."},"forgot_password":{"title":"Възстановяване на парола","action":"Забравих си паролата","invite":"Въведете вашето потребителско име или имейл и ние ще Ви изпратим имейл за смяна на паролата.","reset":"Смяна на паролата","complete_username":"Ако профилът съвпада с потребителското име \u003cb\u003e%{username}\u003c/b\u003e, трябва да получите имейл с инструкции, как да си смените паролата. ","complete_email":"Ако профилът съвпада с \u003cb\u003e%{email}\u003c/b\u003e, трябва да получите имейл с инструкции, как да си смените паролата. ","complete_username_not_found":"Няма профил, който да съвпада с потребителскоto име \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Няма акаунт който да съвпада с \u003cb\u003e%{email}\u003c/b\u003e","button_ok":"Ок"},"email_login":{"complete_username_found":"Намерихме профил, който съвпада с %{username}, трябва да получите имейл с линк за логин.","complete_email_found":"Намерихме профил, който съвпада с \u003cb\u003e%{email}\u003c/b\u003e, трябва да получите имейл с линк за логин.","complete_username_not_found":"Няма профил, който да съвпада с потребителскоto име \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Няма акаунт който да съвпада с \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Продължете към %{site_name}"},"login":{"title":"Вход","username":"Потребител","password":"Парола","second_factor_title":"Удостоверяване с два фактора","email_placeholder":"имейл или потребителско име","caps_lock_warning":"Включен е Caps Lock","error":"Непозната грешка","rate_limit":"Моля, изчакайте, преди да се опитате да влезете отново.","blank_username_or_password":"Моля, въведете Вашия имейл или потребителско име и парола.","reset_password":"Смяна на парола","logging_in":"Влизане...","or":"Или","authenticating":"Оторизация...","awaiting_activation":"Вашият акаунт изчаква активация, използвайте линка за забравена парола, за да изпратите друг имейл за активация.","awaiting_approval":"Вашия акаунт все още не е одобрен от администратора. Ще получите известие, когато това се случи.","requires_invite":"Съжаляваме, този форум е достъпен само с покани.","not_activated":"Не може да влезете. Изпратихме имейл за активация на \u003cb\u003e{{sentTo}}\u003c/b\u003e. Моля, следвайте инструкциите в имейла, за да активирате профила.","not_allowed_from_ip_address":"Не може да влезете от този IP адрес.","admin_not_allowed_from_ip_address":"Не може да влезете като админ от този IP адрес.","resend_activation_email":"Натиснете тук, за да изпратите повторен имейл за активация.","omniauth_disallow_totp":"Профилът ви има активирано удостоверяване с два фактора. Моля, влезте с паролата си.","resend_title":"Изпрати отново активационен имейл ","sent_activation_email_again":"Изпратихме имейл за активация на \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Може да изминат няколко минути докато пристигне. Не забравяйте да проверите Вашата спам папка.","to_continue":"Моля влезте","preferences":"Трябва да сте влезли, за да можете да променяте потребителските си настройки.","forgot":"Не си спомням подробности за профила ми","not_approved":"Вашият профил все още не е одобрен. Ще бъдете уведомени с имейл когато е възможно влизането Ви. ","google_oauth2":{"name":"Google","title":"с Google"},"twitter":{"name":"Twitter","title":"с Twitter"},"instagram":{"title":"чрез Instagram"},"facebook":{"title":"със Facebook"},"github":{"title":" с Github"}},"invites":{"welcome_to":"Добре дошли в %{site_name}!","success":"Профилът ви е създаден и вече сте влезли в него.","name_label":"Име","password_label":"Задайте парола"},"password_reset":{"continue":"Продължете към %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","win10":"Win10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"conditional_loading_section":{"loading":"Зарежда се..."},"select_kit":{"default_header_text":"Изберете...","filter_placeholder":"Търсене ... "},"date_time_picker":{"from":"От","to":"До"},"emoji_picker":{"filter_placeholder":"Търсене на имотикони","flags":"Сигнали"},"composer":{"emoji":"Емошънка :)","more_emoji":"още...","options":"Опции","whisper":"шепот","unlist":"скрити","blockquote_text":"Текстов блок","add_warning":"Това е официално предупреждение.","toggle_whisper":"Включи шепот","posting_not_on_topic":"На коя тема искате да отговорите ?","saved_local_draft_tip":"запазено локално","similar_topics":"Вашата тема е подобна на...","drafts_offline":"чернови офлайн","error":{"title_missing":"Заглавието е задължително","title_too_short":"Заглавието трябва да е минимум {{min}} символа","title_too_long":"Заглавието не може да е повече от {{max}} символа","post_length":"Публикацията трябва да е най-малко {{min}} символа.","category_missing":"Трябва да изберете категория","tags_missing":"Трябва да изберете поне %{count} етикети."},"save_edit":"Запази редакцията","reply_original":"Отговори на Оригинална Тема","reply_here":"Отговори тук","reply":"Отговорете","cancel":"Прекрати","create_topic":"Създай тема","create_pm":"Съобщение","title":"Или натиснете Ctrl+Enter","users_placeholder":"Добави потребител","title_placeholder":"За какво става дума в дискусията с едно изречение?","title_or_link_placeholder":"Напишете заглавие или поставете линк тук","edit_reason_placeholder":"защо редактирате ?","reply_placeholder":"Пиши тук. Използвай Markdown, BBCode, или HTML за форматиране. Издърпайте или поставете изображенията.","view_new_post":"Вижте публикацията.","saving":"Запаметяване","saved":"Запазено!","uploading":"Качва се...","show_preview":"покажи прегледa \u0026raquo;","hide_preview":"\u0026laquo; скрий прегледa","quote_post_title":"Цитирай цялата публикация","bold_title":"Удебелен","bold_text":"удебелен текст","italic_title":"Италик","italic_text":"Подчертан текст","link_title":"Хипервръзка","link_description":"добави описание на връзката тук","link_dialog_title":"Добави хипервръзка","link_optional_text":"заглавие по избор","quote_title":"Текстов блок","quote_text":"Текстов блок","code_title":"Форматиран текст","code_text":"Избутай текста с 4 интервала","paste_code_text":"въведете или поставете кода тук","upload_title":"Качване","upload_description":"причина за качването","olist_title":"Номериран списък","ulist_title":"Списък с водещи символи","list_item":"Списък","help":"Помощ с Markdown","modal_ok":"Ок","modal_cancel":"Отмени","cant_send_pm":"Съжеляваме, но неможете да изпращате съобщения до %{username}.","admin_options_title":"Допълнителни настройки за тази тема","composer_actions":{"reply":"Отговорете","edit":"Редактирай","create_topic":{"label":"Нова тема"}},"details_title":"Сумарно","details_text":"Този текст ще бъде скрит."},"notifications":{"title":"уведомления за @name споменавания, отговори на вашите публикации и теми, лични съобщения, и т.н.","none":"В момента не могат да бъдат заредени уведомленията.","empty":"Няма намерени нотификации.","popup":{"mentioned":"{{username}} ви спомена в \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} ви спомена в \"{{topic}}\" - {{site_title}}","quoted":"{{username}} ви цитира в \"{{topic}}\" - {{site_title}}","replied":"{{username}} ви отговори в \"{{topic}}\" - {{site_title}}","posted":"{{username}} публикува в \"{{topic}}\" - {{site_title}}","linked":"{{username}} прикачи вашата публикация от \"{{topic}}\" - {{site_title}}","confirm_title":"Включени известявания - %{site_title}","confirm_body":"Успех! Известяването е включено."},"titles":{"watching_first_post":"нова тема","post_approved":"публикацията е одобрена"}},"upload_selector":{"title":"Добавете изображение","title_with_attachments":"Добавете изображение или файл","from_my_computer":"От моето устройство","from_the_web":"От мрежата","remote_tip":"линк към изображение","remote_tip_with_attachments":"връзка към картинка или файл {{authorized_extensions}}","local_tip":"изберете изображения от вашето устройство","local_tip_with_attachments":"изберете картинки или файлове от вашето устройство {{authorized_extensions}}","hint":"(за да ги качите също можете да ги провлачите и пуснете в редактора)","hint_for_supported_browsers":"вие можете винаги да привлачите или поставите картинки върху вашия редактора","uploading":"Качване ","select_file":"Избери файл","default_image_alt_text":"изображение"},"search":{"sort_by":"Сортирай по","relevance":"Приложимост","latest_post":"Последен пост","most_viewed":"Най-четени","most_liked":"Най-харесвани","select_all":"Избери Всички ","clear_all":"Изчисти Всички","too_short":"Думата за търсене е твърде кратка.","title":"търсете по тема, пост, потребител или категория","full_page_title":"търсене на теми или публикации","no_results":"Няма резултати ","no_more_results":"Не са намерени резултати.","searching":"Търсене ... ","post_format":"#{{post_number}} от {{username}} ","results_page":"Резултати от търсенето на '{{term}}'","more_results":"Има повече резултати. Моля, прецизирайте търсенето си.","or_search_google":"Или вместо това опитайте търсене с Гугъл:","search_google":"Опитайте вместо това търсене с Гугъл:","search_google_button":"Google","search_google_title":"Търсене в този сайт","context":{"user":"Търсете публикация от @{{username}}","category":"Търсене за категория #{{category}}","topic":"Търсете тази тема","private_messages":"Търси съобщения"},"advanced":{"title":"Разширено търсене","posted_by":{"label":"Публикувано от"},"in_group":{"label":"В група"},"with_badge":{"label":"Със значка"},"filters":{"likes":"Аз харесах","posted":"Аз публикувах в","watching":"Аз наблюдавам","tracking":"Аз следя","first":"е първата публикация","pinned":"са закачени","unpinned":"не са закачени","all_tags":"Всички по-горни етикети"},"post":{"time":{"label":"Публикувано","before":"преди","after":"след"}}}},"hamburger_menu":"Отиди към друг списък с теми или друга категория ","new_item":"нови","go_back":"Назад ","not_logged_in_user":"Потребителска страница с история на текущата дейност и предпочитания","current_user":"Отиди към потребителската страница ","topics":{"new_messages_marker":"последно посещение","bulk":{"select_all":"Селектирай всички","clear_all":"Изчисти всички","unlist_topics":"Непоказани теми","reset_read":"Изчисти прочетеното ","delete":"Изтрий темите","dismiss":"Отмени","dismiss_read":"Отхвърли всички непрочетени","dismiss_button":"Отмени...","dismiss_tooltip":"Отхвърляне само новите мнения или спрете да следите теми","also_dismiss_topics":"Спрете проследяване тези теми, така че те никога да не се появяват като непрочетени отново","dismiss_new":"Премахни новите ","toggle":"Включв./Изкл. избор на няколко теми","actions":"Групови действия ","close_topics":"Затвори темите","archive_topics":"Архивирай темите","notification_level":"Известия","choose_new_category":"Избери нова категория за тези теми:","selected":{"one":"Вие сте избрали \u003cb\u003e%{count}\u003c/b\u003e тема.","other":"Вие сте избрали \u003cb\u003e{{count}}\u003c/b\u003e теми."},"change_tags":"Замени етикетите","append_tags":"Добави етикетите","choose_new_tags":"Избери нови етикети за тези теми:","choose_append_tags":"Избери нови етикети, които да се добавят към тези теми:","changed_tags":"Етикетите на тези теми бяха сменени."},"none":{"unread":"Нямате непрочетени теми.","new":"Нямате нови теми.","read":"Все още не сте прочели нито една тема.","posted":"Все още не сте публикували нито една тема.","latest":"Няма повече теми в Последни. Това е тъжно.","bookmarks":"Все още нямате теми в Отметки.","category":"Няма теми в категория {{category}}.","top":"Няма топ теми.","educate":{"new":"\u003cp\u003eНепрочетените теми се появяват тук.\u003c/p\u003e\u003cp\u003eПо подразбиране темите се считат за непрочетени и ще показват бройката \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003e нови\u003c/span\u003e ако са създадени през последните 2 дни.\u003c/p\u003e\u003cp\u003e Моля посетете вашите \u003ca href=\"%{userPrefsUrl}\"\u003eнастройки\u003c/a\u003e за да промените това.\u003c/p\u003e","unread":"\u003cp\u003eВашите непрочетени теми са тук.\u003c/p\u003e\u003cp\u003eПо подразбиране, темите се считат за непрочетени и ще им се показва брояч \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e ако вие:\u003c/p\u003e\u003cul\u003e\u003cli\u003eСте създали тема\u003c/li\u003e\u003cli\u003eОтговорили на тема\u003c/li\u003e\u003cli\u003eПрочели темата преди повече от 4 минути\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eИли ако са изрично определени в темата да бъдат проследявани и гледани чрез контрол на уведомление в долната част на всяка тема.\n\u003c/p\u003e\u003cp\u003eЗа да промените това, влезте във \u003ca href=\"%{userPrefsUrl}\"\u003eвашите настройки от тук.\u003c/a\u003e\u003c/p\u003e"}},"bottom":{"latest":"Няма повече теми в Последни.","posted":"Няма повече публикувани теми.","read":"Няма повече прочетени теми.","new":"Няма повече нови теми.","unread":"Няма повече непрочетени теми.","category":"Няма повече теми в {{category}}","top":"Няма повече топ теми.","bookmarks":"Няма теми в Отметки"}},"topic":{"create":"Нова тема","create_long":"Създайте нова тема","open_draft":"Довърши ревизия","private_message":"Започни съобщение","archive_message":{"help":"Преместете съобщението в архив","title":"Архив"},"move_to_inbox":{"title":"Премести във входящи","help":"Премести съобщението обратно във входящи"},"defer":{"title":"Отложи "},"list":"Теми","new":"нова тема","unread":"непрочетено","new_topics":{"one":"%{count} нова тема","other":"{{count}} нови теми"},"unread_topics":{"one":"%{count} непрочетена тема","other":"{{count}} непрочетени теми"},"title":"Тема","invalid_access":{"title":"Темата е частна","description":"Съжаляваме, нямате достъп до тази тема !","login_required":"Трябва да се логнат, за да видите темата."},"server_error":{"title":"Темата не може да бъде заредена.","description":"Съжаляваме, темата не може да бъде заредена, вероятно се дължи на проблеми с връзката. Моля, опитайте отново. Ако проблемът все още съществува, моля да ни уведомите."},"not_found":{"title":"Темата не е намерена","description":"Темата не може да бъде открита. Възможно ли е да е премахната от модератор?"},"total_unread_posts":{"one":"имате %{count} непрочетено мнение в тази тема","other":" Вие имате {{count}} непрочетени мнения в тази тема"},"unread_posts":{"one":"Вие имате %{count} непрочетено старо мнение в тази тема","other":"Вие имате {{count}} непрочетени стари мнения в тази тема"},"new_posts":{"one":"има %{count} нова публикация в темата от последното Ви посещение на темата","other":"от последното Ви посещение в темата до сега има {{count}} нови публикации"},"likes":{"one":"има %{count} харесване в тази тема","other":"има {{count}} харесвания в тази тема"},"back_to_list":"Назад към Списъка с теми","options":"Настройки на темата","show_links":"покажи връзките в тази тема","toggle_information":"Показване / скриване на подробна информация за дадена тема ","read_more_in_category":"Искате да прочетете повече ? Разгледайте други теми в {{catLink}} или {{latestLink}}.","read_more":"Искате да прочетете повече ? {{catLink}} или {{latestLink}}.","browse_all_categories":"Прегледай всички категории","view_latest_topics":"виж последните теми","suggest_create_topic":"Защо не създадете тема ?","jump_reply_up":"към по ранен отговор","jump_reply_down":"към по-късен отговор","deleted":"Темата беше изтрита","auto_update_input":{"none":"Избери времева рамка","later_today":"По-късно днес","tomorrow":"Утре","later_this_week":"По-късно тази седмица","this_weekend":"Този уикенд","next_week":"Следваща седмица","two_weeks":"Две седмиц","next_month":"Следващия месец","three_months":"Три месеца","six_months":"Шест месеца","one_year":"Една година","forever":"Завинаги"},"auto_close":{"error":"Моля, въведете валидна стойност.","based_on_last_post":"Не затваряйте преди последната публикация да бъде поне толкова стара."},"status_update_notice":{"auto_close":"Тази тема ще се затвори автоматично след %{timeLeft}.","auto_close_based_on_last_post":"Тази тема ще се затвори %{duration} след последния отговор. "},"auto_close_title":"Настройки за автоматично затваряне","timeline":{"back":"Назад"},"progress":{"title":"прогрес на темата","go_top":"горе","go_bottom":"долу","go":"go","jump_bottom":"към последната публикация","jump_bottom_with_number":"отиди на публикация %{post_number}","jump_prompt_or":"или","total":"всички публикации","current":"текуща публикация"},"notifications":{"reasons":{"3_10":"Ще получавате известия, защото наблюдавате таг на тази тема.","3_6":"Ще получавате известия, защото наблюдавате тази категория","3_5":"Ще получавате известия, защото започнахте да наблюдавате тази тема автоматично.","3_2":"Ще получавате известия, защото наблюдавате тази тема.","3_1":"Ще получавате известия, защото създадохте тази тема.","3":"Ще получавате известия, защото наблюдавате тази тема.","1_2":"Ще ви уведобим, ако някой ви отговори или спомене вашето @име","1":"Ще ви уведобим, ако някой ви отговори или спомене вашето @име","0_7":"Вие игнорирате всички известия в тази категория.","0_2":"Вие игнорирате всички известия за тази тема.","0":"Вие игнорирате всички известия за тази тема."},"watching_pm":{"title":"Наблюдавай","description":"Вие ще бъдете информиран за всеки нов отговор на това съобщение, също така ще се показва и броя на новите отговори"},"watching":{"title":"Наблюдаване","description":"Вие ще бъдете информиран за всеки нов отговор в тази тема, също така ще се показва и броя на новите отговори"},"tracking_pm":{"title":"Следене","description":"Броят на новите отговори ще присъства в това съобщение. Вие ще бъдете информиран ако някой ви отговори или спомене вашето @име."},"tracking":{"title":"Следене","description":"Броя на новите отговори ще присъства в тази тема. Вие ще бъдете информиран ако някой ви отговори или спомене вашето @име."},"regular":{"title":"Нормален","description":"Ще ви уведобим, ако някой ви отговори или спомене вашето @име"},"regular_pm":{"title":"Нормален","description":"Вие ще бъдете информиран ако някой ви отговори или спомене вашето @име"},"muted_pm":{"title":"Заглуши","description":"Няма да бъдете уведомени за нищо свързано с това съобщение."},"muted":{"title":"Заглушен","description":"Вие никога няма да бъде уведомен за нещо по тази тема, и то няма да се появи в най-новата."}},"actions":{"title":"Действия","recover":"Възстанови темата","delete":"Изтрий темата","open":"Отвори темата","close":"Изчисти темата","multi_select":"Избери публикации...","pin":"Закови темата...","unpin":"Откови темата...","unarchive":"Разархивирай темата","archive":"Архивирай темата","invisible":"Премахни от списъците","visible":"Включи в списъците","reset_read":"Изчисти прочетените данни ","make_public":"Направи темата публична"},"feature":{"pin":"Закови темата","unpin":"Отгови темата","pin_globally":"Закови темата глобално","make_banner":"Банер тема","remove_banner":"Премахни банер тема"},"reply":{"title":"Отговорете","help":"започнете да пишете отговор на тази тема"},"clear_pin":{"title":"Изчисти пин ","help":"Изчисти пиннатия статус на тази тема така, че тя повече да не се появява в горната част на Вашият списък с теми."},"share":{"title":"Споделяне","help":"споделете връзка към тази тема"},"flag_topic":{"title":"Сигнал","help":"скрито сигнализирайте за публикацията, за да ѝ бъде обърнато внимание или изпратете скрито известие за нея","success_message":"Успешно сигнализирахте за тази тема."},"feature_topic":{"title":"Фокусирай тази тема","pin":"Тази тема да се появява в горната част на {{categoryLink}} категорията докато","confirm_pin":"Вие вече имате {{count}} заковани теми. Прекалено много заковани теми може да объркат новите и анонимни потребители. Сигурни ли сте че искате да заковете още една тема към тази категория ?","unpin":"Премахни тази тема от началото на категория {{categoryLink}}","unpin_until":"Премахни тази тема от горната част на {{categoryLink}} категорията или изчакай докато \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Потребителите могат да отковат тази тема индивидуално само за тях","pin_validation":"Необходимо е да се избере дата, за да може да се закачи темата.","not_pinned":"Няма закачени теми в {{categoryLink}}.","already_pinned":{"one":"Темата е закачена в {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003eе %{count}\u003c/strong\u003e","other":"Темите закачени в {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003eса {{count}}\u003c/strong\u003e"},"pin_globally":"Тази тема да се появява в горната част на всички списъци докато","confirm_pin_globally":"Вие вече имате {{count}} глобално заковани теми. Прекалено много заковани теми може да объркат новите и анонимни потребители. Сигурни ли сте че искате да заковете още една тема глобално към тази категория ?","unpin_globally":"Премахни тази тема от началото на списъците с теми.","unpin_globally_until":"Премахни тази тема от горната част на списъка с теми или изчакай докато \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Потребителите могат да отговат темата индивидуално само за тях.","not_pinned_globally":"Няма никакви закачени теми.","already_pinned_globally":{"one":"Темата закачена глобално е: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Темите закачени глобално: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Направете тази тема на банер който ще присъства в началото на всички страници","remove_banner":"Премахнете този банер който се появява в началото на всички страници","banner_note":"Потребителите могат да откажат банера като го затворят. Само една тема може да бъде банер в едно и също време.","no_banner_exists":"Няма блокирани теми.","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003e е\u003c/strong\u003e тема за банер."},"inviting":"Покана...","invite_private":{"title":"Покани за съобщение","email_or_username":"Имейл адрес или Потребителско име","email_or_username_placeholder":"имейл адрес или потребителско име","action":"Покана","success":"Поканихте този потребител да се включи в това съобщение.","error":"Получи се грешка при поканата на този потребител.","group_name":"име на групата"},"controls":"Контрол на темата","invite_reply":{"title":"Покана","username_placeholder":"потребителско име","action":"Изпрати покана","help":"поканете другите да се присъединят към тази тема чрез имейл или уведомление","to_forum":"Изпратихме кратък имейл, който позволява на Вашия приятел, да се включи в разговора, само с едно натискане върху връзката. Не се изисква вход в системата.","sso_enabled":"Въведете потребителското име на човека който желаете да поканите към в тема.","to_topic_blank":"Въведете потребителско име или имейл адрес на човека който желаете да поканите към тази тема.","to_topic_email":"Вие въведохте имейл адрес. Ние ще изпратим имейл чрез която вашият приятел може да отговори веднака на тази тема.","to_topic_username":"Въведохте потребителско име. Ние ще изпратим напомняне с връзка която го кани в тази тема.","to_username":"Въведете потребителското име на човека който искате да поканите. Ние ще му изпратим напомняне с връзка която го кани в тази тема.","email_placeholder":"name@example.com","success_email":"Изпратихте покана на \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Ще Ви уведомим, когато поканата е използвана. Проверявайте раздела с покани на Вашата потребителска страница, за да следите на Вашите покани.","success_username":"Ние поканихме този потребител да се присъедини темата.","error":"Съжаляваме, не можем да поканим този човек. Вероятно вече е потребител? ( Поканите са ограничени)"},"login_reply":"Влезте, за да отговорите ","filters":{"n_posts":{"one":"%{count} публикация","other":"{{count}} публикации"},"cancel":"Премахни филтъра"},"split_topic":{"title":"Премести в нова тема","action":"премести в нова тема","radio_label":"Нова тема","error":"Възникна грешка при преместването на публикацията в нова тема.","instructions":{"one":"На път сте да създадете нова тема и да я запълните с публикацията която избрахте.","other":"На път сте да създадете нова тема и да я запълните с \u003cb\u003e{{count}}\u003c/b\u003e избрани публикации."}},"merge_topic":{"title":"Преместете в съществуваща тема.","action":"преместете в съществуваща тема.","error":"Възникна грешка при преместване мнения в тази тема.","instructions":{"one":"Моля изберете тема в която искате да преместите тази публикация. ","other":"Моля, изберете тема, в която искате да преместите тези \u003cb\u003e{{count}}\u003c/b\u003e публикации. "}},"move_to_new_message":{"radio_label":"Ново Съобщение"},"change_owner":{"action":"смени собственика","error":"Възникна грешка при смяната на собственика","placeholder":"име на новия собственик"},"change_timestamp":{"action":"смени времевия показател","invalid_timestamp":"Времевия показател неможе да бъде в бъдещето.","error":"Грешка при смяната на времевия показател.","instructions":"Моля, изберете ново заглавие на темата. Публикациите в темата ще бъдат актуализирани, за да имат една и съща времева разлика."},"multi_select":{"select":"избери","selected":"избрани ({{count}})","select_post":{"label":"избери"},"select_replies":{"label":"избери +отговори "},"delete":"изтрий избраните ","cancel":"прекрати избирането","select_all":"избери всички ","deselect_all":"премахване на всички ","description":{"one":"Вие избрахте \u003cb\u003e%{count}\u003c/b\u003e публикация.","other":"Вие избрахте \u003cb\u003e{{count}}\u003c/b\u003e публикации. "}}},"post":{"edit_reason":"Причина: ","post_number":"публикация {{number}} ","last_edited_on":"публикацията последно е редактирана на ","reply_as_new_topic":"Отговори като свързана тема","continue_discussion":"Продължаване на дискусията от {{postLink}}: ","follow_quote":"отиди на цитираната публикация ","show_full":"Покажи цялата публикация","deleted_by_author":{"one":"(публикация оттеглена от автора, ще бъде автоматично изтрита след %{count} час, освен, ако не бъде сигнализирана)","other":"(публикация оттеглена от автора, ще бъде автоматично изтрита след %{count} часа, освен, ако не бъде сигнализирана) "},"expand_collapse":"разшири/намали ","gap":{"one":"покажи %{count} скрит отговор","other":"покажи {{count}} скрити отговора"},"unread":"Публикацията е непрочетена","has_replies":{"one":"{{count}} Отговор","other":"{{count}} Отговори"},"has_likes_title":{"one":"%{count} човек харесва тази публикация","other":"{{count}} човека харесват тази публикация"},"has_likes_title_only_you":"вие харесахте този пост","has_likes_title_you":{"one":"вие и още %{count} човек сте харесали този пост","other":"вие и {{count}} човека сте харесали този пост"},"errors":{"create":"При създаването на Вашата публикация се получи грешка. Моля, опитайте отново.","edit":"Съжаляваме, възникна грешка при редактирането на публикацията. Моля, опитайте отново. ","upload":"Съжаляваме, възникна грешка при качването на този файл. Моля, опитайте отново.","too_many_uploads":"Съжаляваме, не можете да качвате повече от един файл наведнъж.","image_upload_not_allowed_for_new_user":"Съжаляваме, новите потребители не могат да качват снимки.","attachment_upload_not_allowed_for_new_user":"Съжаляваме, новите потребители не могат да прикачват файлове.","attachment_download_requires_login":"Съжаляваме, трябва да сте логнат, за да може да сваляте прикачените файлове."},"abandon_edit":{"no_value":"Не, запази"},"abandon":{"confirm":"Сигурни ли сте, че искате да напуснете тази публикация?","no_value":"Не, запази","yes_value":"Да, напусни"},"via_email":"тази публикация пристига чрез имейл","whisper":"този пост е отбелязан като таен за модераторите","wiki":{"about":"този пост е wiki"},"archetypes":{"save":"Запазете опциите"},"few_likes_left":"Благодарим за споделянето на любовта Ви! Вие имате право на само още няколко харесвания за днес.","controls":{"reply":"започни отговор на тази публикация","like":"харесай тази публикация","has_liked":"Вие харесахте тази публикация","undo_like":"премахни харесването","edit":"редактирай тази публикация","edit_action":"Редактирай","edit_anonymous":"Съжаляваме, но трябва да сте логнат, за да редактирате. ","flag":"скрито сигнализирайте за публикацията, за да ѝ бъде обърнато внимание или изпратете скрито известие за нея","delete":"изтрий тази публикация","undelete":"възстановете тази публикация","share":"сподели връзка към публикацията","more":"Повече","delete_replies":{"just_the_post":"Не, само публикацията"},"admin":"действия на админа на публикации","wiki":"Направи Wiki съобщение","unwiki":"Премахни Wiki съобщение","convert_to_moderator":"Добави цвят за екипа ","revert_to_regular":"Премахни цвета на екипа ","rebake":"Прегенерирай HTML ","unhide":"Покажи ","change_owner":"Смени Правомощията","grant_badge":"Присъдени значка","delete_topic":"изтрий темата "},"actions":{"flag":"Сигнал","undo":{"off_topic":"Отмени сигнала","spam":"Отмени сигнала ","inappropriate":"Отмени сигнала","bookmark":"Отмени отметката","like":"Отмен харесването "},"people":{"off_topic":"отбелязан като оф-топик","spam":"отбелязан като спам","inappropriate":"отбелязан като неприемлив","notify_moderators":"съобщено на модераторите","notify_user":"изпрати съобщение","bookmark":"маркирай това"},"by_you":{"off_topic":"Маркирахте това като извън темата","spam":"Маркирахте това като спам","inappropriate":"Маркирахте това като неприлично","notify_moderators":"Маркирахте това за модерация","notify_user":"Изпратихте лично съобщение на този потребител","bookmark":"Сложихте тази публикация в Отметки","like":"Вие харесахте това"}},"revisions":{"controls":{"first":"Първа ревизия","previous":"Предишна ревизия","next":"Следваща ревизия","last":"Последна ревизия","hide":"Скрий ревизията","show":"Покажи ревизията","revert":"Връщане към тази редакция"},"displays":{"inline":{"title":"Покажи съобщение с включени допълнения и заличавания. "},"side_by_side":{"title":"Покажи разликите side-by-side "},"side_by_side_markdown":{"title":"Покажи разликите на неподправения източник side-by-side "}}},"bookmarks":{"name":"Име"}},"category":{"can":"can\u0026hellip;","none":"(без категория)","all":"Всички категории","edit":"Редактирай","view":"Покажи темите в категория ","general":"Основни","settings":"Настройки","topic_template":"Шаблон на темата","tags":"Етикети","tags_placeholder":"(По желание) списък на позволените етикети","delete":"Изтрий категорията","create":"Нова категория","create_long":"Създай нова категория","save":"Запази категорията","slug":"Описателно име за URL ","slug_placeholder":"(Опционално) пунктирани думи за url ","creation_error":"Възникна грешка при създаването на категория.","save_error":"Възникна грешка при запазването на категорията.","name":"Име на категорията","description":"Описание","topic":"предмет на категорията","logo":"Изображение за категория ","background_image":"Изображение за фон на категорията ","badge_colors":"Цветове на значките","background_color":"Цвят на фона","foreground_color":"Цвят на преден план","name_placeholder":"Максимум една или две думи","color_placeholder":"Някакъв уеб цвят ","delete_confirm":"Сигурни ли сте, че искате да изтриете тази категория? ","delete_error":"Възникна грешка по време на изтриването на категорията. ","list":"Списък Категории ","no_description":"Моля, добавете описание за тази категория. ","change_in_category_topic":"Редактирай Описанието ","already_used":"Този цвят вече е използван за друга категория. ","security":"Сигурност","special_warning":"Внимание: Тази категория е предварително семена категория и настройките й за сигурност не могат да се променят. Ако не искате да използвате тази категория, изтрийте темата си, вместо да я местите в категорията по предназначение.","images":"Изображения","email_in":"Персонализиран входящ имейл адрес: ","email_in_allow_strangers":"Приемай имейли от анонимни потребители, които нямат регистрация","email_in_disabled":"Публикуването на нови теми чрез имейл е забранено от настройките на сайта. За да разрешите публикуването на нови теми чрез имейл,","email_in_disabled_click":"разрешете \"email in\" настройката ","allow_badges_label":"Разрешете използването на значки в тази категория. ","edit_permissions":"Редакция на достъпа","review_group_name":"име на групата","this_year":"тази година ","default_position":"Позиция по подразбиране ","position_disabled":"Категорията ще се показва в ред на активност. За да контролирате реда на категориите в списъците, ","position_disabled_click":"Разреши \"fixed category positions\" настройка ","minimum_required_tags":"Минимален брой етикети на тема","parent":"Главна категория","notifications":{"watching":{"title":"Наблюдаване","description":"Вие ще наблюдавате всички нови теми в тези категории. Ще бъдете информирани за всеки нов пост във всяка тема, и броят на отговорите ще ви бъде показан."},"watching_first_post":{"title":"Наблюдаване на Първа Публикация"},"tracking":{"title":"Следене"},"regular":{"title":"Нормален","description":"Ще ви уведобим, ако някой ви отговори или спомене вашето @име"},"muted":{"title":"Заглушени","description":"Вие никога няма да бъде уведомен за нови теми в тези категории, и те няма да се появят в най-нови."}},"search_priority":{"options":{"normal":"Нормален"}},"sort_options":{"likes":"Харесвания","views":"Преглеждания","posts":"Публикации","activity":"Активност","posters":"Автори","category":"Категория","created":"Създадени"},"sort_ascending":"В възходящ ред","sort_descending":"В низходящ ред","subcategory_list_styles":{"rows":"Редове","rows_with_featured_topics":"Редове с представени теми","boxes":"Кутии","boxes_with_featured_topics":"Кутии с представени теми"},"settings_sections":{"general":"Основни","email":"Имейл"}},"flagging":{"title":"Благодарим ви, че помагате да поддържаме дискусията цивилизована!","action":"Сигнализирай публикацията ","take_action":"Предприеми действие ","notify_action":"Съобщение","official_warning":"Официално предупреждение","delete_spammer":"Изтрий спамера ","yes_delete_spammer":"Да, изтрий спамера","ip_address_missing":"(N/A)","hidden_email_address":"(скрит)","submit_tooltip":"Пусни скрит сигнал","take_action_tooltip":"Достигнете границата от сигнали веднага, вместо да чакате за още сигнали от общността","cant":"Не може да сигнализирате за тази публикация в момента.","notify_staff":"Съобщи лично на екипа","formatted_name":{"off_topic":"Не е по темата","inappropriate":"Неподходяща е","spam":"Съдържа спам"},"custom_placeholder_notify_user":"Бъдете точни, конструктивни и учтиви.","custom_placeholder_notify_moderators":"Споделете ни какви точно са Вашите притеснения и ако е възможно ни дайте съответните връзки или примери, които имат отношение по темата."},"flagging_topic":{"title":"Благодарим ви, че помагате да поддържаме дискусията цивилизована.","action":"Сигнализирай темата","notify_action":"Съобщение"},"topic_map":{"title":"Резюме на темата","participants_title":"Чести автори","links_title":"Популярни връзки","links_shown":"покажи повече адреси...","clicks":{"one":"%{count} кликване","other":"%{count} кликвания"}},"topic_statuses":{"warning":{"help":"Това е официално предупреждение."},"bookmarked":{"help":"Сложихте тази публикация в Отметки"},"locked":{"help":"Тази тема е затворена; в нея не може да бъде публикувано."},"archived":{"help":"Тази тема е архивирана; не може да бъде променяна."},"locked_and_archived":{"help":"Тази тема е затворена и архивирана; тя вече не приема нови отговори и не може да се променя"},"unpinned":{"title":"Откована","help":"Тази тема е откована за Вас, тя ще се показва в стандартен ред "},"pinned_globally":{"title":"Закована глобално","help":"Тази тема е глобално закована; тя ще се покаже в горната част на най-новите и в нейната категория"},"pinned":{"title":"Закована","help":"Тази тема е закована за Вас, тя ще се показва в началото на категорията "},"unlisted":{"help":"Тази тема е скрита; не се появява в списъка с теми и може да бъде достъпна само с директен линк."}},"posts":"Публикации","posts_long":"има {{number}} публикации в тази тема","original_post":"Оригинална публикация","views":"Прегледи","views_lowercase":{"one":"преглед","other":"прегледи"},"replies":"Отговори","activity":"Активност","likes":"Харесвания","likes_lowercase":{"one":"харесване","other":"харесвания"},"likes_long":"има {{number}} харесвания в тази тема","users":"Потребители","users_lowercase":{"one":"потребител","other":"потребители"},"category_title":"Категория","history":"История","changed_by":"от {{author}}","raw_email":{"title":"Входяща поща","not_available":"Не е наличен!"},"categories_list":"Списък с категории","filters":{"with_topics":"%{filter} теми","with_category":"%{filter} %{category} теми","latest":{"title":"Последни","title_with_count":{"one":"Последен (%{count})","other":"Последни ({{count}})"},"help":"теми със скорошни публикации"},"read":{"title":"Прочети","help":"прочетени теми по реда на прочитане"},"categories":{"title":"Категории","title_in":"Категория - {{categoryName}}","help":"всички теми групирани по категория"},"unread":{"title":"Непрочетени","title_with_count":{"one":"Непрочетен (%{count})","other":"Непрочетени ({{count}})"},"help":"теми които гледате или следите, с непрочетени публикации","lower_title_with_count":{"one":"%{count} непрочетен","other":"{{count}} непрочетени"}},"new":{"lower_title_with_count":{"one":"%{count} нов","other":"{{count}} нови"},"lower_title":"нови","title":"Нов","title_with_count":{"one":"Нов (%{count})","other":"Нови ({{count}})"},"help":"теми създадени през последните няколко дни"},"posted":{"title":"Моите публикации","help":"теми в които сте публикували"},"bookmarks":{"title":"Отметки","help":"теми, които сте отбелязали в Отметки"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"последни теми в категория {{categoryName}}"},"top":{"title":"Топ","help":"Най-активни теми в последната година, месец, седмица или ден","all":{"title":"От началото"},"yearly":{"title":"Годишно"},"quarterly":{"title":"Тримесечно"},"monthly":{"title":"Месечно"},"weekly":{"title":"Седмично"},"daily":{"title":"Дневно"},"all_time":"От началото","this_year":"Година","this_quarter":"Тримесечие","this_month":"Месец","this_week":"Седмица","today":"Днес","other_periods":"виж отгоре"}},"permission_types":{"full":"Създай / Отговори / Виж","create_post":"Отговари / Виж","readonly":"Виж"},"lightbox":{"download":"изтегли"},"keyboard_shortcuts_help":{"title":"Бързи клавиши","jump_to":{"title":"Премини към","home":"%{shortcut} Начало","latest":"%{shortcut} Последни","new":"%{shortcut} Нови","unread":"%{shortcut} Непрочетени","categories":"%{shortcut} Категории","top":"%{shortcut} Топ","bookmarks":"%{shortcut} Отметки","profile":"%{shortcut} Профил","messages":"%{shortcut} Съобщения"},"navigation":{"title":"Навигация","jump":"%{shortcut} Към публикация #","back":"%{shortcut} Назад","up_down":"%{shortcut} Преместване на селекцията \u0026uarr; \u0026darr;","open":"%{shortcut} Отворяне на избраната тема","next_prev":"%{shortcut} Следваща/Предишна секция "},"application":{"title":"Приложение","create":"%{shortcut} Създайте нова тема","notifications":"%{shortcut} Отворяне на известията","hamburger_menu":"%{shortcut} Отворяне на хамбургерното менюто","user_profile_menu":"%{shortcut} Отваряне на потребителското меню","show_incoming_updated_topics":"%{shortcut} Показване на обновените теми","search":"%{shortcut} Отписване","help":"%{shortcut} Помощ с клавиатурата ","dismiss_new_posts":"%{shortcut} Отхвърляне на Нова/Публикации","dismiss_topics":"%{shortcut} Отхвърляне на темите","log_out":"%{shortcut} Отписване"},"composing":{"title":"Съставяне","return":"%{shortcut} Връщане към редактора"},"actions":{"title":"Действия","bookmark_topic":"%{shortcut} Отменете статуса на темата в отментки.","pin_unpin_topic":"%{shortcut} Pin/Unpin на темата ","share_topic":"%{shortcut} Споделете тема ","share_post":"%{shortcut} Споделете публикация","reply_as_new_topic":"%{shortcut} Отговор с нова тема","reply_topic":"%{shortcut} Отговорете на тема","reply_post":"%{shortcut} Отговорете на публикация","quote_post":"%{shortcut} Цитат","like":"%{shortcut} Харесване","flag":"%{shortcut} Сигнал","bookmark":"%{shortcut} Отметка","edit":"%{shortcut} Редакция","delete":"%{shortcut} Изтриване","mark_muted":"%{shortcut} Заглушете темата","mark_regular":"%{shortcut} Номална (стандартна) тема","mark_tracking":"%{shortcut} Следете темата","mark_watching":"%{shortcut} Наблюдаване на темата"}},"badges":{"granted_on":"Разрешен %{date}","others_count":"Други са такава значка (%{count})","title":"Значки","allow_title":"Може да използвате тази значка като титла.","select_badge_for_title":"Изберете значка за титла?","none":"(никой)","successfully_granted":"Успешно дадохте %{badge}на %{username}","badge_grouping":{"getting_started":{"name":"В началото"},"community":{"name":"Общност "},"trust_level":{"name":"Ниво на Доверие"},"other":{"name":"Други"},"posting":{"name":"Публикуване"}}},"tagging":{"all_tags":"Всички тагове","other_tags":"Други тагове","selector_all_tags":"всички тагове","selector_no_tags":"няма тагове","changed":"променени тагове:","tags":"Тагове","choose_for_topic":"етикети по желание","add_synonyms":"Добави","delete_tag":"Изтрийте таг","manage_groups_description":"Дефинирай групи за организране на етикетите","cancel_delete_unused":"Отмени","notifications":{"watching":{"title":"Наблюдаване","description":"Вие автоматично ще следите всички теми с този таг. Ще бъдете информиран за всички нови публикации и теми, и броят на непрочетените и новите публикации ще бъде показан до съответната тема. "},"watching_first_post":{"title":"Наблюдаване на първа публикация"},"tracking":{"title":"Следене","description":"Автоматично ще следите всички теми с този етикет. Броя на непрочетените и новите публикации ще се появява до темата."},"regular":{"title":"Редовен","description":"Ще бъдете уведомен, ако някой спомене вашето @име или отговори на Ваша публикация."},"muted":{"title":"Заглушен","description":"Няма да бъдете уведомявани относно нови теми с този етикет и те няма да се появяват в 'непрочетени'. "}},"groups":{"title":"Групи етикети","about":"Добавете етикетите към групи за да управлявате по-лесно.","tags_label":"Етикети в тази група:","parent_tag_description":"Етикетите от тази група не могат да бъдат използвани, освен ако го има родителският етикет","save":"Запази","delete":"Изтрий","everyone_can_use":"Етикетите могат да се използват от всички","usable_only_by_staff":"Етикетите са видими за всички, но само персонал може да ги използва","visible_only_to_staff":"Етикетите са видими само за персонала"},"topics":{"none":{"unread":"Нямате непрочетени теми.","new":"Нямате нови теми.","read":"Все още не сте прочели нито една тема.","posted":"Все още не сте публикували нито една тема.","bookmarks":"Все още нямате теми в Отметки.","top":"Няма топ теми."},"bottom":{"latest":"Няма повече теми в Последни.","posted":"Няма повече публикувани теми.","read":"Няма повече прочетени теми.","new":"Няма повече нови теми.","unread":"Няма повече непрочетени теми.","top":"Няма повече топ теми.","bookmarks":"Няма теми в Отметки."}}},"invite":{"custom_message_placeholder":"Въведете вашето персонализирано съобщение","custom_message_template_forum":"Хей, трябва да се присъединиш към този форум!","custom_message_template_topic":"Хей, мисля си, че ще се насладиш на тази тема!"},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Стартирай урока за нови потребители за всеки нов потребител.","welcome_message":"Изпращайте съобщение с насоки за бързо стартиране на всички нови потребители"}},"details":{"title":"Скрий детайлите"},"discourse_local_dates":{"create":{"form":{"date_title":"Дата","time_title":"Време "}}},"poll":{"voters":{"one":"гласуващ","other":"Гласуващи "},"total_votes":{"one":"общ брой гласове","other":"общо гласове"},"average_rating":"Средна отценка: \u003cstrong\u003e%{average}\u003c/strong\u003e.","multiple":{"help":{"at_least_min_options":{"one":"Избери поне \u003cstrong\u003e%{count}\u003c/strong\u003e отговора","other":"Избери поне \u003cstrong\u003e%{count}\u003c/strong\u003e отговора"},"between_min_and_max_options":"Може да изберете между \u003cstrong\u003e%{min}\u003c/strong\u003e и \u003cstrong\u003e%{max}\u003c/strong\u003e възможни отговора."}},"cast-votes":{"title":"Изчислете вашите гласове","label":"Гласувай сега!"},"show-results":{"title":"Покажи резултатите от гласуването","label":"Покажи резултатите"},"hide-results":{"title":"Обратно към вашите гласове"},"export-results":{"label":"Експорт "},"open":{"title":"Отвори гласуването","label":"Отвори","confirm":"Сигурни ли сте, че искате да отворите гласуването ?"},"close":{"title":"Затвори гласуването","label":"Затвори","confirm":"Сигурни ли сте, че искате да затворите гласуването?"},"error_while_toggling_status":"Съжаляваме, получи се грешка при превключване статуса на тази анкета.","error_while_casting_votes":"Получи се грешка при подаването на гласа ви.","error_while_fetching_voters":"Получи се грешка при показването на гласовете.","ui_builder":{"poll_type":{"label":"Тип"},"poll_result":{"label":"Резултати"},"poll_config":{"max":"Максимално","min":"Минимално","step":"Стъпка"}}}}},"en_US":{"js":{"dates":{"time_short_day":"ddd, h:mm a"}}},"en":{"js":{"action_codes":{"autobumped":"automatically bumped %{when}","banner":{"enabled":"made this a banner %{when}. It will appear at the top of every page until it is dismissed by the user.","disabled":"removed this banner %{when}. It will no longer appear at the top of every page."},"forwarded":"forwarded the above email"},"topic_admin_menu":"topic actions","wizard_required":"Welcome to your new Discourse! Let’s get started with \u003ca href='%{url}' data-auto-route='true'\u003ethe setup wizard\u003c/a\u003e ✨","bootstrap_mode_disabled":"Bootstrap mode will be disabled within 24 hours.","related_messages":{"see_all":"See \u003ca href=\"%{path}\"\u003eall messages\u003c/a\u003e from @%{username}..."},"bookmarks":{"created_with_reminder":"you've bookmarked this post with a reminder at %{date}","confirm_clear":"Are you sure you want to clear all your bookmarks from this topic?","no_timezone":"You have not set a timezone yet. You will not be able to set reminders. Set one up \u003ca href=\"%{basePath}/my/preferences/profile\"\u003ein your profile\u003c/a\u003e.","reminders":{"at_desktop":"Next time I'm at my desktop","later_today":"Later today \u003cbr/\u003e{{date}}","next_business_day":"Next business day \u003cbr/\u003e{{date}}","tomorrow":"Tomorrow \u003cbr/\u003e{{date}}","next_week":"Next week \u003cbr/\u003e{{date}}","next_month":"Next month \u003cbr/\u003e{{date}}","custom":"Custom date and time"}},"drafts":{"resume":"Resume","new_topic":"New topic draft","new_private_message":"New private message draft","topic_reply":"Draft reply","abandon":{"confirm":"You already opened another draft in this topic. Are you sure you want to abandon it?"}},"topic_count_latest":{"one":"See {{count}} new or updated topic","other":"See {{count}} new or updated topics"},"topic_count_unread":{"one":"See {{count}} unread topic","other":"See {{count}} unread topics"},"clipboard":"clipboard","pwa":{"install_banner":"Do you want to \u003ca href\u003einstall %{title} on this device?\u003c/a\u003e"},"choose_topic":{"title":{"search":"Search for a Topic","placeholder":"type the topic title, url or id here"}},"choose_message":{"none_found":"No messages found.","title":{"search":"Search for a Message","placeholder":"type the message title, url or id here"}},"review":{"in_reply_to":"in reply to","explain":{"why":"explain why this item ended up in the queue","title":"Reviewable Scoring","formula":"Formula","subtotal":"Subtotal","min_score_visibility":"Minimum Score for Visibility","score_to_hide":"Score to Hide Post","take_action_bonus":{"name":"took action","title":"When a staff member chooses to take action the flag is given a bonus."},"user_accuracy_bonus":{"name":"user accuracy","title":"Users whose flags have been historically agreed with are given a bonus."},"trust_level_bonus":{"name":"trust level","title":"Reviewable items created by higher trust level users have a higher score."},"type_bonus":{"name":"type bonus","title":"Certain reviewable types can be assigned a bonus by staff to make them a higher priority."}},"claim_help":{"optional":"You can claim this item to prevent others from reviewing it.","required":"You must claim items before you can review them.","claimed_by_you":"You've claimed this item and can review it.","claimed_by_other":"This item can only be reviewed by \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"claim this topic"},"unclaim":{"help":"remove this claim"},"awaiting_approval":"Awaiting Approval","settings":{"saved":"Saved","priorities":{"title":"Reviewable Priorities"}},"moderation_history":"Moderation History","view_all":"View All","grouped_by_topic":"Grouped by Topic","none":"There are no items to review.","view_pending":"view pending","topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval","other":"This topic has \u003cb\u003e{{count}}\u003c/b\u003e posts pending approval"},"title":"Review","filtered_topic":"You have filtered to reviewable content in a single topic.","show_all_topics":"show all topics","deleted_post":"(post deleted)","deleted_user":"(user deleted)","user":{"bio":"Bio","website":"Website","fields":"Fields"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flags)"},"agreed":{"one":"{{count}}% agree","other":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree","other":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore","other":"{{count}}% ignore"}},"topics":{"reviewable_count":"Count","reported_by":"Reported by","deleted":"[Topic Deleted]","original":"(original topic)","details":"details","unique_users":{"one":"%{count} user","other":"{{count}} users"}},"replies":{"one":"%{count} reply","other":"{{count}} replies"},"new_topic":"Approving this item will create a new topic","filters":{"all_categories":"(all categories)","type":{"all":"(all types)"},"minimum_score":"Minimum Score:","status":"Status","orders":{"priority":"Priority","priority_asc":"Priority (reverse)","created_at":"Created At","created_at_asc":"Created At (reverse)"},"priority":{"title":"Minimum Priority","low":"(any)","medium":"Medium","high":"High"}},"conversation":{"view_full":"view full conversation"},"scores":{"about":"This score is calculated based on the trust level of the reporter, the accuracy of their previous flags, and the priority of the item being reported.","score":"Score","status":"Status","submitted_by":"Submitted By","reviewed_by":"Reviewed By"},"statuses":{"approved":{"title":"Approved"},"ignored":{"title":"Ignored"},"deleted":{"title":"Deleted"},"reviewed":{"title":"(all reviewed)"},"all":{"title":"(everything)"}},"types":{"reviewable_flagged_post":{"title":"Flagged Post","flagged_by":"Flagged By"},"reviewable_queued_topic":{"title":"Queued Topic"},"reviewable_queued_post":{"title":"Queued Post"}},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending.","other":"You have \u003cstrong\u003e{{count}}\u003c/strong\u003e posts pending."}}},"groups":{"member_added":"Added","member_requested":"Requested at","add_members":{"description":"Manage the membership of this group"},"requests":{"title":"Requests","accept":"Accept","accepted":"accepted","deny":"Deny","denied":"denied","undone":"request undone"},"manage":{"interaction":{"title":"Interaction"}},"empty":{"requests":"There are no membership requests for this group."},"confirm_leave":"Are you sure you want to leave this group?","allow_membership_requests":"Allow users to send membership requests to group owners (Requires publicly visible group)","membership_request_template":"Custom template to display to users when sending a membership request","membership_request":{"submit":"Submit Request","title":"Request to join @%{group_name}","reason":"Let the group owners know why you belong in this group"},"group_name":"Group name","index":{"filter":"Filter by group type","owner_groups":"Groups I own","automatic_groups":"Automatic Groups","public_groups":"Public Groups","close_group":"Close Group","group_type":"Group type"},"title":{"one":"Group","other":"Groups"},"members":{"filter_placeholder_admin":"username or email","remove_member":"Remove Member","remove_member_description":"Remove \u003cb\u003e%{username}\u003c/b\u003e from this group","make_owner":"Make Owner","make_owner_description":"Make \u003cb\u003e%{username}\u003c/b\u003e an owner of this group","remove_owner":"Remove as Owner","remove_owner_description":"Remove \u003cb\u003e%{username}\u003c/b\u003e as an owner of this group","forbidden":"You're not allowed to view the members."},"alias_levels":{"owners_mods_and_admins":"Only group owners, moderators and admins"},"notifications":{"watching_first_post":{"description":"You will be notified of new messages in this group but not replies to the messages."},"muted":{"description":"You will not be notified of anything about messages in this group."}},"flair_url_description":"Use square images no smaller than 20px by 20px or FontAwesome icons (accepted formats: \"fa-icon\", \"far fa-icon\" or \"fab fa-icon\")."},"user_action_groups":{"15":"Drafts"},"categories":{"topic_stat_sentence_week":{"one":"%{count} new topic in the past week.","other":"%{count} new topics in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month.","other":"%{count} new topics in the past month."},"n_more":"Categories (%{count} more) ..."},"ip_lookup":{"powered_by":"using \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"copied"},"user":{"download_archive":{"button_text":"Download All"},"user_notifications":{"ignore_duration_title":"Ignore Timer","ignore_duration_when":"Duration:","ignore_duration_save":"Ignore","ignore_duration_note":"Please note that all ignores are automatically removed after the ignore duration expires.","ignore_duration_time_frame_required":"Please select a time frame","ignore_no_users":"You have no ignored users.","ignore_option":"Ignored","ignore_option_title":"You will not receive notifications related to this user and all of their topics and replies will be hidden.","add_ignored_user":"Add...","mute_option_title":"You will not receive any notifications related to this user.","normal_option_title":"You will be notified if this user replies to you, quotes you, or mentions you."},"feature_topic_on_profile":{"open_search":"Select a New Topic","title":"Select a Topic","search_label":"Search for Topic by title","clear":{"warning":"Are you sure you want to clear your featured topic?"}},"profile_hidden":"This user's public profile is hidden.","collapse_profile":"Collapse","timezone":"Timezone","dynamic_favicon":"Show counts on browser icon","theme_default_on_all_devices":"Make this the default theme on all my devices","text_size_default_on_all_devices":"Make this the default text size on all my devices","allow_private_messages":"Allow other users to send me personal messages","enable_defer":"Enable defer to mark topics unread","featured_topic":"Featured Topic","silenced_tooltip":"This user is silenced","suspended_permanently":"This user is suspended.","mailing_list_mode":{"instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","warning":"Mailing list mode enabled. Email notification settings are overridden."},"muted_categories_instructions":"You will not be notified of anything about new topics in these categories, and they will not appear on the categories or latest pages.","muted_categories_instructions_dont_hide":"You will not be notified of anything about new topics in these categories.","ignored_users":"Ignored","ignored_users_instructions":"Suppress all posts and notifications from these users.","api_last_used_at":"Last used at:","theme":"Theme","home":"Default Home Page","staged":"Staged","preferences_nav":{"interface":"Interface"},"second_factor_backup":{"title":"Two Factor Backup Codes","enable_long":"Enable backup codes","manage":"Manage backup codes. You have \u003cstrong\u003e{{count}}\u003c/strong\u003e backup codes remaining.","copied_to_clipboard":"Copied to Clipboard","copy_to_clipboard_error":"Error copying data to Clipboard","remaining_codes":"You have \u003cstrong\u003e{{count}}\u003c/strong\u003e backup codes remaining.","use":"Use a backup code","enable_prerequisites":"You must enable a primary second factor before generating backup codes.","codes":{"title":"Backup Codes Generated","description":"Each of these backup codes can only be used once. Keep them somewhere safe but accessible."}},"second_factor":{"enable":"Manage Two Factor Authentication","forgot_password":"Forgot password?","rate_limit":"Please wait before trying another authentication code.","enable_description":"Scan this QR code in a supported app (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) and enter your authentication code.\n","disable_description":"Please enter the authentication code from your app","show_key_description":"Enter manually","short_description":"Protect your account with one-time use security codes.\n","extended_description":"Two factor authentication adds extra security to your account by requiring a one-time token in addition to your password. Tokens can be generated on \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e and \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e devices.\n","oauth_enabled_warning":"Please note that social logins will be disabled once two factor authentication has been enabled on your account.","use":"Use Authenticator app","enforced_notice":"You are required to enable two factor authentication before accessing this site.","disable":"disable","disable_title":"Disable Second Factor","disable_confirm":"Are you sure you want to disable all second factors?","edit_title":"Edit Second Factor","edit_description":"Second Factor Name","enable_security_key_description":"When you have your physical security key prepared press the Register button below.","totp":{"title":"Token-Based Authenticators","add":"New Authenticator","default_name":"My Authenticator"},"security_key":{"title":"Security Keys","add":"Register Security Key","default_name":"Main Security Key","not_allowed_error":"The security key registration process either timed out or was cancelled.","already_added_error":"You have already registered this security key. You don’t have to register it again.","edit":"Edit Security Key","edit_description":"Security Key Name"}},"change_username":{"confirm":"Are you absolutely sure you want to change your username?"},"change_avatar":{"gravatar_failed":"We could not find a Gravatar with that email address."},"change_profile_background":{"title":"Profile Header","instructions":"Profile headers will be centered and have a default width of 1110px."},"change_featured_topic":{"title":"Featured Topic","instructions":"A link to this topic will be on your user card, and profile."},"email":{"primary":"Primary Email","secondary":"Secondary Emails","no_secondary":"No secondary emails","sso_override_instructions":"Email can be updated from SSO provider."},"associated_accounts":{"title":"Associated Accounts","connect":"Connect","not_connected":"(not connected)","confirm_modal_title":"Connect %{provider} Account","confirm_description":{"account_specific":"Your %{provider} account '%{account_description}' will be used for authentication.","generic":"Your %{provider} account will be used for authentication."}},"locale":{"any":"any"},"auth_tokens":{"title":"Recently Used Devices","log_out_all":"Log out all","active":"active now","not_you":"Not you?","show_all":"Show all ({{count}})","show_few":"Show fewer","was_this_you":"Was this you?","was_this_you_description":"If it wasn’t you, we recommend you change your password and log out everywhere.","browser_and_device":"{{browser}} on {{device}}","secure_account":"Secure my Account","latest_post":"You last posted…"},"hide_profile_and_presence":"Hide my public profile and presence features","enable_physical_keyboard":"Enable physical keyboard support on iPad","text_size":{"title":"Text Size","smaller":"Smaller","larger":"Larger","largest":"Largest"},"title_count_mode":{"title":"Background page title displays count of:","notifications":"New notifications","contextual":"New page content"},"email_digests":{"title":"When I don’t visit here, send me an email summary of popular topics and replies"},"email_level":{"only_when_away":"only when away"},"notification_level_when_replying":"When I post in a topic, set that topic to","invited":{"sent":"Last Sent","none":"No invites to display.","rescind_all":"Remove all Expired Invites","rescinded_all":"All Expired Invites removed!","rescind_all_confirm":"Are you sure you want to remove all expired invites?","reinvite_all_confirm":"Are you sure you want to resend all invites?","link_generated":"Invite link generated successfully!","valid_for":"Invite link is only valid for this email address: %{email}","bulk_invite":{"none":"You haven't invited anyone here yet. Send individual invites, or invite many people at once by \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003euploading a CSV file\u003c/a\u003e.","error":"Sorry, file should be CSV format.","confirmation_message":"You’re about to email invites to everyone in the uploaded file."}},"summary":{"recent_time_read":"recent read time","likes_given":{"one":"given","other":"given"},"likes_received":{"one":"received","other":"received"},"topics_entered":{"one":"topic viewed","other":"topics viewed"},"top_categories":"Top Categories"}},"too_few_topics_and_posts_notice":"Let's \u003ca href='https://blog.discourse.org/2014/08/building-a-discourse-community/'\u003estart the discussion!\u003c/a\u003e There are \u003cstrong\u003e%{currentTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{currentPosts}\u003c/strong\u003e posts. Visitors need more to read and reply to – we recommend at least \u003cstrong\u003e%{requiredTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{requiredPosts}\u003c/strong\u003e posts. Only staff can see this message.","too_few_topics_notice":"Let's \u003ca href='https://blog.discourse.org/2014/08/building-a-discourse-community/'\u003estart the discussion!\u003c/a\u003e There are \u003cstrong\u003e%{currentTopics}\u003c/strong\u003e topics. Visitors need more to read and reply to – we recommend at least \u003cstrong\u003e%{requiredTopics}\u003c/strong\u003e topics. Only staff can see this message.","too_few_posts_notice":"Let's \u003ca href='https://blog.discourse.org/2014/08/building-a-discourse-community/'\u003estart the discussion!\u003c/a\u003e There are \u003cstrong\u003e%{currentPosts}\u003c/strong\u003e posts. Visitors need more to read and reply to – we recommend at least \u003cstrong\u003e%{requiredPosts}\u003c/strong\u003e posts. Only staff can see this message.","logs_error_rate_notice":{},"time_read_recently":"%{time_read} recently","time_read_tooltip":"%{time_read} total time read","time_read_recently_tooltip":"%{time_read} total time read (%{recent_time_read} in the last 60 days)","signup_cta":{"intro":"Hello! Looks like you’re enjoying the discussion, but you haven’t signed up for an account yet.","value_prop":"When you create an account, we remember exactly what you’ve read, so you always come right back where you left off. You also get notifications, here and via email, whenever someone replies to you. And you can like posts to share the love. :heartpulse:"},"private_message_info":{"invite":"Invite Others ...","edit":"Add or Remove ...","leave_message":"Do you really want to leave this message?"},"create_account":{"disclaimer":"By registering, you agree to the \u003ca href='{{privacy_link}}' target='blank'\u003eprivacy policy\u003c/a\u003e and \u003ca href='{{tos_link}}' target='blank'\u003eterms of service\u003c/a\u003e."},"forgot_password":{"complete_username_found":"We found an account that matches the username \u003cb\u003e%{username}\u003c/b\u003e. You should receive an email with instructions on how to reset your password shortly.","complete_email_found":"We found an account that matches \u003cb\u003e%{email}\u003c/b\u003e. You should receive an email with instructions on how to reset your password shortly.","help":"Email not arriving? Be sure to check your spam folder first.\u003cp\u003eNot sure which email address you used? Enter an email address and we’ll let you know if it exists here.\u003c/p\u003e\u003cp\u003eIf you no longer have access to the email address on your account, please contact \u003ca href='%{basePath}/about'\u003eour helpful staff.\u003c/a\u003e\u003c/p\u003e","button_help":"Help"},"email_login":{"link_label":"Email me a login link","button_label":"with email","complete_username":"If an account matches the username \u003cb\u003e%{username}\u003c/b\u003e, you should receive an email with a login link shortly.","complete_email":"If an account matches \u003cb\u003e%{email}\u003c/b\u003e, you should receive an email with a login link shortly.","logging_in_as":"Logging in as %{email}","confirm_button":"Finish Login"},"login":{"second_factor_description":"Please enter the authentication code from your app:","second_factor_backup":"Log in using a backup code","second_factor_backup_title":"Two Factor Backup","second_factor_backup_description":"Please enter one of your backup codes:","second_factor":"Log in using Authenticator app","security_key_description":"When you have your physical security key prepared press the Authenticate with Security Key button below.","security_key_alternative":"Try another way","security_key_authenticate":"Authenticate with Security Key","security_key_not_allowed_error":"The security key authentication process either timed out or was cancelled.","security_key_no_matching_credential_error":"No matching credentials could be found in the provided security key.","security_key_support_missing_error":"Your current device or browser does not support the use of security keys. Please use a different method.","cookies_error":"Your browser seems to have cookies disabled. You might not be able to log in without enabling them first.","blank_username":"Please enter your email or username.","change_email":"Change Email Address","provide_new_email":"Provide a new address and we'll resend your confirmation email.","submit_new_email":"Update Email Address","sent_activation_email_again_generic":"We sent another activation email. It might take a few minutes for it to arrive; be sure to check your spam folder.","instagram":{"name":"Instagram"},"facebook":{"name":"Facebook"},"github":{"name":"GitHub"},"discord":{"name":"Discord","title":"with Discord"},"second_factor_toggle":{"totp":"Use an authenticator app instead","backup_code":"Use a backup code instead"}},"invites":{"accept_title":"Invitation","invited_by":"You were invited by:","social_login_available":"You'll also be able to sign in with any social login using that email.","your_email":"Your account email address is \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Accept Invitation","optional_description":"(optional)"},"emoji_set":{"emoji_one":"JoyPixels (formerly EmojiOne)","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics","categories_and_top_topics":"Categories and Top Topics","categories_boxes":"Boxes with Subcategories","categories_boxes_with_topics":"Boxes with Featured Topics"},"shortcut_modifier_key":{"enter":"Enter"},"category_row":{"topic_count":"{{count}} topics in this category"},"select_kit":{"no_content":"No matches found","filter_placeholder_with_any":"Search or create...","create":"Create: '{{content}}'","max_content_reached":{"one":"You can only select {{count}} item.","other":"You can only select {{count}} items."},"min_content_not_reached":{"one":"Select at least {{count}} item.","other":"Select at least {{count}} items."},"invalid_selection_length":"Selection must be at least {{count}} characters."},"date_time_picker":{"errors":{"to_before_from":"To date must be later than from date."}},"emoji_picker":{"smileys_\u0026_emotion":"Smileys and Emotion","people_\u0026_body":"People and Body","animals_\u0026_nature":"Animals and Nature","food_\u0026_drink":"Food and Drink","travel_\u0026_places":"Travel and Places","activities":"Activities","objects":"Objects","symbols":"Symbols","custom":"Custom emojis","recent":"Recently used","default_tone":"No skin tone","light_tone":"Light skin tone","medium_light_tone":"Medium light skin tone","medium_tone":"Medium skin tone","medium_dark_tone":"Medium dark skin tone","dark_tone":"Dark skin tone"},"shared_drafts":{"title":"Shared Drafts","notice":"This topic is only visible to those who can see the \u003cb\u003e{{category}}\u003c/b\u003e category.","destination_category":"Destination Category","publish":"Publish Shared Draft","confirm_publish":"Are you sure you want to publish this draft?","publishing":"Publishing Topic..."},"composer":{"toggle_unlisted":"Toggle Unlisted","edit_conflict":"edit conflict","group_mentioned_limit":"\u003cb\u003eWarning!\u003c/b\u003e You mentioned \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, however this group has more members than the administrator configured mention limit of {{max}} users. Nobody will be notified.","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e%{count} person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"cannot_see_mention":{"category":"You mentioned {{username}} but they won't be notified because they do not have access to this category. You will need to add them to a group that has access to this category.","private":"You mentioned {{username}} but they won't be notified because they are unable to see this personal message. You will need to invite them to this PM."},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply on {{ago}}\u003c/a\u003e – are you sure you want to post it again?","reference_topic_title":"RE: {{title}}","error":{"post_missing":"Post can’t be empty","try_like":"Have you tried the {{heart}} button?","topic_template_not_modified":"Please add details and specifics to your topic by editing the topic template."},"overwrite_edit":"Overwrite Edit","create_whisper":"Whisper","create_shared_draft":"Create Shared Draft","edit_shared_draft":"Edit Shared Draft","topic_featured_link_placeholder":"Enter link shown with title.","remove_featured_link":"Remove link from topic.","reply_placeholder_no_images":"Type here. Use Markdown, BBCode, or HTML to format.","reply_placeholder_choose_category":"Select a category before typing here.","saved_draft":"Post draft in progress. Tap to resume.","bold_label":"B","italic_label":"I","link_url_placeholder":"Paste a URL or type to search topics","toggle_direction":"Toggle Direction","collapse":"minimize the composer panel","open":"open the composer panel","abandon":"close composer and discard draft","enter_fullscreen":"enter fullscreen composer","exit_fullscreen":"exit fullscreen composer","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"composer_actions":{"draft":"Draft","reply_to_post":{"label":"Reply to post %{postNumber} by %{postUsername}","desc":"Reply to a specific post"},"reply_as_new_topic":{"label":"Reply as linked topic","desc":"Create a new topic linked to this topic","confirm":"You have a new topic draft saved, which will be overwritten if you create a linked topic."},"reply_as_private_message":{"label":"New message","desc":"Create a new personal message"},"reply_to_topic":{"label":"Reply to topic","desc":"Reply to the topic, not any specific post"},"toggle_whisper":{"label":"Toggle whisper","desc":"Whispers are only visible to staff members"},"shared_draft":{"label":"Shared Draft","desc":"Draft a topic that will only be visible to staff"},"toggle_topic_bump":{"label":"Toggle topic bump","desc":"Reply without changing latest reply date"}}},"notifications":{"tooltip":{"regular":{"one":"%{count} unseen notification","other":"{{count}} unseen notifications"},"message":{"one":"%{count} unread message","other":"{{count}} unread messages"}},"post_approved":"Your post was approved","reviewable_items":"items requiring review","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} other\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"liked {{count}} of your posts","other":"liked {{count}} of your posts"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Earned '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}","membership_request_accepted":"Membership accepted in '{{group_name}}'","membership_request_consolidated":"{{count}} open membership requests for '{{group_name}}'","group_message_summary":{"one":"{{count}} message in your {{group_name}} inbox","other":"{{count}} messages in your {{group_name}} inbox"},"popup":{"private_message":"{{username}} sent you a personal message in \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} created a new topic \"{{topic}}\" - {{site_title}}","custom":"Notification from {{username}} on %{site_title}"},"titles":{"mentioned":"mentioned","replied":"new reply","quoted":"quoted","edited":"edited","liked":"new like","private_message":"new private message","invited_to_private_message":"invited to private message","invitee_accepted":"invite accepted","posted":"new post","moved_post":"post moved","linked":"linked","granted_badge":"badge granted","invited_to_topic":"invited to topic","group_mentioned":"group mentioned","group_message_summary":"new group messages","topic_reminder":"topic reminder","liked_consolidated":"new likes","membership_request_consolidated":"new membership requests"}},"search":{"latest_topic":"Latest Topic","result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} results for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"cant_find":"Can’t find what you’re looking for?","start_new_topic":"Perhaps start a new topic?","context":{"tag":"Search the #{{tag}} tag"},"advanced":{"in_category":{"label":"Categorized"},"with_tags":{"label":"Tagged"},"filters":{"label":"Only return topics/posts...","title":"Matching in title only","created":"I created","private":"In my messages","bookmarks":"I bookmarked","seen":"I read","unseen":"I've not read","wiki":"are wiki","images":"include image(s)"},"statuses":{"label":"Where topics","open":"are open","closed":"are closed","public":"are public","archived":"are archived","noreplies":"have zero replies","single_user":"contain a single user"},"post":{"count":{"label":"Minimum Post Count"}}}},"view_all":"view all","topics":{"bulk":{"relist_topics":"Relist Topics","change_category":"Set Category"}},"topic":{"filter_to":{"one":"%{count} post in topic","other":"{{count}} posts in topic"},"edit_message":{"help":"Edit first post of the message","title":"Edit Message"},"defer":{"help":"Mark as unread"},"feature_on_profile":{"help":"Add a link to this topic on your user card and profile","title":"Feature On Profile"},"remove_from_profile":{"warning":"Your profile already has a featured topic. If you continue, this topic will replace the existing topic.","help":"Remove the link to this topic on your user profile","title":"Remove From Profile"},"group_request":"You need to request membership to the `{{name}}` group to see this topic","group_join":"You need join the `{{name}}` group to see this topic","group_request_sent":"Your group membership request has been sent. You will be informed when it's accepted.","unread_indicator":"No member has read the last post of this topic yet.","topic_status_update":{"title":"Topic Timer","save":"Set Timer","num_of_hours":"Number of hours:","remove":"Remove Timer","publish_to":"Publish To:","when":"When:","public_timer_types":"Topic Timers","private_timer_types":"User Topic Timers","time_frame_required":"Please select a time frame"},"auto_update_input":{"two_months":"Two Months","four_months":"Four Months","pick_date_and_time":"Pick date and time","set_based_on_last_post":"Close based on last post"},"publish_to_category":{"title":"Schedule Publishing"},"temp_open":{"title":"Open Temporarily"},"auto_reopen":{"title":"Auto-open Topic"},"temp_close":{"title":"Close Temporarily"},"auto_close":{"title":"Auto-Close Topic","label":"Auto-close topic hours:"},"auto_delete":{"title":"Auto-Delete Topic"},"auto_bump":{"title":"Auto-Bump Topic"},"reminder":{"title":"Remind Me"},"status_update_notice":{"auto_open":"This topic will automatically open %{timeLeft}.","auto_publish_to_category":"This topic will be published to \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_delete":"This topic will be automatically deleted %{timeLeft}.","auto_bump":"This topic will be automatically bumped %{timeLeft}.","auto_reminder":"You will be reminded about this topic %{timeLeft}."},"auto_close_immediate":{"one":"The last post in the topic is already %{count} hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to...","jump_prompt_of":"of %{count} posts","jump_prompt_long":"Jump to...","jump_prompt_to_date":"to date"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","2_8":"You will see a count of new replies because you are tracking this category.","2_4":"You will see a count of new replies because you posted a reply to this topic.","2_2":"You will see a count of new replies because you are tracking this topic.","2":"You will see a count of new replies because you \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eread this topic\u003c/a\u003e."}},"actions":{"timed_update":"Set Topic Timer...","make_private":"Make Personal Message","reset_bump_date":"Reset Bump Date"},"share":{"extended_title":"Share a link"},"print":{"title":"Print","help":"Open a printer friendly version of this topic"},"make_public":{"title":"Convert to Public Topic","choose_category":"Please choose a category for the public topic:"},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"invite_reply":{"success_existing_email":"A user with email \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e already exists. We've invited that user to participate in this topic."},"move_to":{"title":"Move to","action":"move to","error":"There was an error moving posts."},"split_topic":{"topic_name":"New Topic Title"},"merge_topic":{"radio_label":"Existing Topic"},"move_to_new_message":{"title":"Move to New Message","action":"move to new message","message_title":"New Message Title","participants":"Participants","instructions":{"one":"You are about to create a new message and populate it with the post you've selected.","other":"You are about to create a new message and populate it with the \u003cb\u003e{{count}}\u003c/b\u003e posts you've selected."}},"move_to_existing_message":{"title":"Move to Existing Message","action":"move to existing message","radio_label":"Existing Message","participants":"Participants","instructions":{"one":"Please choose the message you'd like to move that post to.","other":"Please choose the message you'd like to move those \u003cb\u003e{{count}}\u003c/b\u003e posts to."}},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."},"change_owner":{"title":"Change Owner","instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Please choose a new owner for the {{count}} posts by \u003cb\u003e@{{old_user}}\u003c/b\u003e"}},"change_timestamp":{"title":"Change Timestamp..."},"multi_select":{"select_post":{"title":"Add post to selection"},"selected_post":{"label":"selected","title":"Click to remove post from selection"},"select_replies":{"title":"Add post and all its replies to selection"},"select_below":{"label":"select +below","title":"Add post and all after it to selection"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)","other":"(topic withdrawn by author, will be automatically deleted in %{count} hours unless flagged)"}},"post":{"quote_reply":"Quote","ignored":"Ignored content","wiki_last_edited_on":"wiki last edited on","reply_as_new_private_message":"Reply as new message to the same recipients","show_hidden":"View ignored content.","collapse":"collapse","locked":"a staff member has locked this post from being edited","notice":{"new_user":"This is the first time {{user}} has posted — let’s welcome them to our community!","returning_user":"It’s been a while since we’ve seen {{user}} — their last post was {{time}}."},"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then paste the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload {{max}} files at a time.","upload_not_authorized":"Sorry, the file you are trying to upload is not authorized (authorized extensions: {{authorized_extensions}})."},"abandon_edit":{"confirm":"Are you sure you want to discard your changes?","no_save_draft":"No, save draft","yes_value":"Yes, discard edit"},"abandon":{"no_save_draft":"No, save draft"},"via_auto_generated_email":"this post arrived via an auto generated email","controls":{"read_indicator":"members who read this post","delete_replies":{"confirm":"Do you also want to delete the replies to this post?","direct_replies":{"one":"Yes, and %{count} direct reply","other":"Yes, and {{count}} direct replies"},"all_replies":{"one":"Yes, and %{count} reply","other":"Yes, and all {{count}} replies"}},"lock_post":"Lock Post","lock_post_description":"prevent the poster from editing this post","unlock_post":"Unlock Post","unlock_post_description":"allow the poster to edit this post","delete_topic_disallowed_modal":"You don't have permission to delete this topic. If you really want it to be deleted, submit a flag for moderator attention together with reasoning.","delete_topic_disallowed":"you don't have permission to delete this topic","add_post_notice":"Add Staff Notice","remove_post_notice":"Remove Staff Notice","remove_timer":"remove timer"},"actions":{"defer_flags":{"one":"Ignore flag","other":"Ignore flags"},"people":{"like":{"one":"liked this","other":"liked this"},"read":{"one":"read this","other":"read this"},"like_capped":{"one":"and {{count}} other liked this","other":"and {{count}} others liked this"},"read_capped":{"one":"and {{count}} other read this","other":"and {{count}} others read this"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?","other":"Are you sure you want to delete those {{count}} posts?"}},"merge":{"confirm":{"one":"Are you sure you want to merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"edit_wiki":"Edit Wiki","edit_post":"Edit Post","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"button":"HTML"},"side_by_side":{"button":"HTML"},"side_by_side_markdown":{"button":"Raw"}}},"raw_email":{"displays":{"raw":{"title":"Show the raw email","button":"Raw"},"text_part":{"title":"Show the text part of the email","button":"Text"},"html_part":{"title":"Show the html part of the email","button":"HTML"}}},"bookmarks":{"create":"Create bookmark","name_placeholder":"Name the bookmark to help jog your memory","set_reminder":"Set a reminder","actions":{"delete_bookmark":{"name":"Delete bookmark","description":"Removes the bookmark from your profile and stops all reminders for the bookmark"}}}},"category":{"choose":"category\u0026hellip;","edit_dialog_title":"Edit: %{categoryName}","tags_allowed_tags":"Restrict these tags to this category:","tags_allowed_tag_groups":"Restrict these tag groups to this category:","tags_tab_description":"Tags and tag groups specified above will only be available in this category and other categories that also specify them. They won't be available for use in other categories.","tag_groups_placeholder":"(Optional) list of allowed tag groups","manage_tag_groups_link":"Manage tag groups here.","allow_global_tags_label":"Also allow other tags","tag_group_selector_placeholder":"(Optional) Tag group","required_tag_group_description":"Require new topics to have tags from a tag group:","min_tags_from_required_group_label":"Num Tags:","required_tag_group_label":"Tag group:","topic_featured_link_allowed":"Allow featured links in this category","uncategorized_security_warning":"This category is special. It is intended as holding area for topics that have no category; it cannot have security settings.","uncategorized_general_warning":"This category is special. It is used as the default category for new topics that do not have a category selected. If you want to prevent this behavior and force category selection, \u003ca href=\"%{settingLink}\"\u003eplease disable the setting here\u003c/a\u003e. If you want to change the name or description, go to \u003ca href=\"%{customizeLink}\"\u003eCustomize / Text Content\u003c/a\u003e.","pending_permission_change_alert":"You haven't added %{group} to this category; click this button to add them.","mailinglist_mirror":"Category mirrors a mailing list","show_subcategory_list":"Show subcategory list above topics in this category.","num_featured_topics":"Number of topics shown on the categories page:","subcategory_num_featured_topics":"Number of featured topics on parent category's page:","all_topics_wiki":"Make new topics wikis by default","subcategory_list_style":"Subcategory List Style:","sort_order":"Topic List Sort By:","default_view":"Default Topic List:","default_top_period":"Default Top Period:","reviewable_by_group":"In addition to staff, posts and flags in this category can be also be reviewed by:","require_topic_approval":"Require moderator approval of all new topics","require_reply_approval":"Require moderator approval of all new replies","position":"Position on the categories page:","num_auto_bump_daily":"Number of open topics to automatically bump daily:","navigate_to_first_post_after_read":"Navigate to first post after topics are read","notifications":{"watching_first_post":{"description":"You will be notified of new topics in this category but not replies to the topics."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}},"search_priority":{"label":"Search Priority","options":{"ignore":"Ignore","very_low":"Very Low","low":"Low","high":"High","very_high":"Very High"}},"sort_options":{"default":"default","op_likes":"Original Post Likes"},"settings_sections":{"moderation":"Moderation","appearance":"Appearance"}},"flagging":{"custom_message":{"at_least":{"one":"enter at least %{count} character","other":"enter at least {{count}} characters"},"more":{"one":"%{count} to go...","other":"{{count}} to go..."},"left":{"one":"%{count} remaining","other":"{{count}} remaining"}}},"post_links":{"about":"expand more links for this post","title":{"one":"%{count} more","other":"%{count} more"}},"topic_statuses":{"personal_message":{"title":"This topic is a personal message"}},"views_long":{"one":"this topic has been viewed %{count} time","other":"this topic has been viewed {{number}} times"},"browser_update":"Unfortunately, \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eyour browser is too old to work on this site\u003c/a\u003e. Please \u003ca href=\"https://browsehappy.com\"\u003eupgrade your browser\u003c/a\u003e.","lightbox":{"previous":"Previous (Left arrow key)","next":"Next (Right arrow key)","counter":"%curr% of %total%","close":"Close (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eThe content\u003c/a\u003e could not be loaded.","image_load_error":"\u003ca href=\"%url%\"\u003eThe image\u003c/a\u003e could not be loaded."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} or %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","jump_to":{"drafts":"%{shortcut} Drafts"},"navigation":{"go_to_unread_post":"%{shortcut} Go to the first unread post"},"composing":{"fullscreen":"%{shortcut} Fullscreen composer"},"actions":{"print":"%{shortcut} Print topic","defer":"%{shortcut} Defer topic","topic_admin_actions":"%{shortcut} Open topic admin actions"}},"badges":{"earned_n_times":{"one":"Earned this badge %{count} time","other":"Earned this badge %{count} times"},"multiple_grant":"You can earn this multiple times","badge_count":{"one":"%{count} Badge","other":"%{count} Badges"},"more_badges":{"one":"+%{count} More","other":"+%{count} More"},"granted":{"one":"%{count} granted","other":"%{count} granted"}},"tagging":{"info":"Info","default_info":"This tag isn't restricted to any categories, and has no synonyms.","category_restricted":"This tag is restricted to categories you don't have permission to access.","synonyms":"Synonyms","synonyms_description":"When the following tags are used, they will be replaced with \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\".","other":"This tag belongs to these groups: {{tag_groups}}."},"category_restrictions":{"one":"It can only be used in this category:","other":"It can only be used in these categories:"},"edit_synonyms":"Manage Synonyms","add_synonyms_label":"Add synonyms:","add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?","other":"Any place that currently uses these tags will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"add_synonyms_failed":"The following tags couldn't be added as synonyms: \u003cb\u003e%{tag_names}\u003c/b\u003e. Ensure they don't have synonyms and aren't synonyms of another tag.","remove_synonym":"Remove Synonym","delete_synonym_confirm":"Are you sure you want to delete the synonym \"%{tag_name}\"?","delete_confirm":{"one":"Are you sure you want to delete this tag and remove it from %{count} topic it is assigned to?","other":"Are you sure you want to delete this tag and remove it from {{count}} topics it is assigned to?"},"delete_confirm_no_topics":"Are you sure you want to delete this tag?","delete_confirm_synonyms":{"one":"Its synonym will also be deleted.","other":"Its {{count}} synonyms will also be deleted."},"rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","upload":"Upload Tags","upload_description":"Upload a csv file to create tags in bulk","upload_instructions":"One per line, optionally with a tag group in the format 'tag_name,tag_group'.","upload_successful":"Tags uploaded successfully","delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}","other":"%{count} tags will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more","other":"%{tags} and %{count} more"},"delete_unused":"Delete Unused Tags","delete_unused_description":"Delete all tags which are not attached to any topics or personal messages","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching_first_post":{"description":"You will be notified of new topics in this tag but not replies to the topics."}},"groups":{"new":"New Group","tags_placeholder":"tags","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","name_placeholder":"Tag Group Name","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"latest":"There are no latest topics."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a \u003ca href\u003ecustom message\u003c/a\u003e."},"forced_anonymous":"Due to extreme load, this is temporarily being shown to everyone as a logged out user would see it.","safe_mode":{"enabled":"Safe mode is enabled, to exit safe mode close this browser window"},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"discourse_local_dates":{"relative_dates":{"today":"Today %{time}","tomorrow":"Tomorrow %{time}","yesterday":"Yesterday %{time}","countdown":{"passed":"date has passed"}},"title":"Insert date / time","create":{"form":{"insert":"Insert","advanced_mode":"Advanced mode","simple_mode":"Simple mode","format_description":"Format used to display the date to the user. Use \"\\T\\Z\" to display the user timezone in words (Europe/Paris)","timezones_title":"Timezones to display","timezones_description":"Timezones will be used to display dates in preview and fallback.","recurring_title":"Recurrence","recurring_description":"Define the recurrence of an event. You can also manually edit the recurring option generated by the form and use one of the following keys: years, quarters, months, weeks, days, hours, minutes, seconds, milliseconds.","recurring_none":"No recurrence","invalid_date":"Invalid date, make sure date and time are correct","format_title":"Date format","timezone":"Timezone","until":"Until...","recurring":{"every_day":"Every day","every_week":"Every week","every_two_weeks":"Every two weeks","every_month":"Every month","every_two_months":"Every two months","every_three_months":"Every three months","every_six_months":"Every six months","every_year":"Every year"}}}},"poll":{"public":{"title":"Votes are \u003cstrong\u003epublic\u003c/strong\u003e."},"results":{"groups":{"title":"You need to be a member of %{groups} to vote in this poll."},"vote":{"title":"Results will be shown on \u003cstrong\u003evote\u003c/strong\u003e."},"closed":{"title":"Results will be shown once \u003cstrong\u003eclosed\u003c/strong\u003e."},"staff":{"title":"Results are only shown to \u003cstrong\u003estaff\u003c/strong\u003e members."}},"multiple":{"help":{"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"}}},"hide-results":{"label":"Show vote"},"group-results":{"title":"Group votes by user field","label":"Show breakdown"},"ungroup-results":{"title":"Combine all votes","label":"Hide breakdown"},"export-results":{"title":"Export the poll results"},"automatic_close":{"closes_in":"Closes in \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Closed \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_exporting_results":"Sorry, there was an error exporting poll results.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 1 option","invalid_values":"Minimum value must be smaller than the maximum value.","min_step_value":"The minimum step value is 1"},"poll_type":{"regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_result":{"always":"Always visible","vote":"On vote","closed":"When closed","staff":"Staff only"},"poll_groups":{"label":"Allowed groups"},"poll_chart_type":{"label":"Chart type"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"},"automatic_close":{"label":"Automatically close poll"}}},"presence":{"replying":"replying","editing":"editing","replying_to_topic":{"one":"replying","other":"replying"}}}}};
I18n.locale = 'bg';
I18n.pluralizationRules.bg = MessageFormat.locale.bg;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    var bg = moment.defineLocale('bg', {
        months : 'януари_февруари_март_април_май_юни_юли_август_септември_октомври_ноември_декември'.split('_'),
        monthsShort : 'янр_фев_мар_апр_май_юни_юли_авг_сеп_окт_ное_дек'.split('_'),
        weekdays : 'неделя_понеделник_вторник_сряда_четвъртък_петък_събота'.split('_'),
        weekdaysShort : 'нед_пон_вто_сря_чет_пет_съб'.split('_'),
        weekdaysMin : 'нд_пн_вт_ср_чт_пт_сб'.split('_'),
        longDateFormat : {
            LT : 'H:mm',
            LTS : 'H:mm:ss',
            L : 'D.MM.YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY H:mm',
            LLLL : 'dddd, D MMMM YYYY H:mm'
        },
        calendar : {
            sameDay : '[Днес в] LT',
            nextDay : '[Утре в] LT',
            nextWeek : 'dddd [в] LT',
            lastDay : '[Вчера в] LT',
            lastWeek : function () {
                switch (this.day()) {
                    case 0:
                    case 3:
                    case 6:
                        return '[В изминалата] dddd [в] LT';
                    case 1:
                    case 2:
                    case 4:
                    case 5:
                        return '[В изминалия] dddd [в] LT';
                }
            },
            sameElse : 'L'
        },
        relativeTime : {
            future : 'след %s',
            past : 'преди %s',
            s : 'няколко секунди',
            ss : '%d секунди',
            m : 'минута',
            mm : '%d минути',
            h : 'час',
            hh : '%d часа',
            d : 'ден',
            dd : '%d дни',
            M : 'месец',
            MM : '%d месеца',
            y : 'година',
            yy : '%d години'
        },
        dayOfMonthOrdinalParse: /\d{1,2}-(ев|ен|ти|ви|ри|ми)/,
        ordinal : function (number) {
            var lastDigit = number % 10,
                last2Digits = number % 100;
            if (number === 0) {
                return number + '-ев';
            } else if (last2Digits === 0) {
                return number + '-ен';
            } else if (last2Digits > 10 && last2Digits < 20) {
                return number + '-ти';
            } else if (lastDigit === 1) {
                return number + '-ви';
            } else if (lastDigit === 2) {
                return number + '-ри';
            } else if (lastDigit === 7 || lastDigit === 8) {
                return number + '-ми';
            } else {
                return number + '-ти';
            }
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 7th is the first week of the year.
        }
    });

    return bg;

})));

// moment-timezone-localization for lang code: bg

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Абиджан","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Акра","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Адис Абеба","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Алжир","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Асмара","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Бамако","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Бангуи","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Банджул","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Бисау","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Блантайър","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Бразавил","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Бужумбура","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Кайро","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Казабланка","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Сеута","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Конакри","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Дакар","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Дар ес Салам","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Джибути","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Дуала","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"Ел Аюн","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Фрийтаун","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Габороне","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Хараре","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Йоханесбург","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Джуба","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Кампала","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Хартум","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Кигали","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Киншаса","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Лагос","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Либревил","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Ломе","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Луанда","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Лубумбаши","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Лусака","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Малабо","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Мапуто","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Масеру","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Мбабане","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Могадишу","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Монровия","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Найроби","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Нджамена","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Ниамей","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Нуакшот","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Уагадугу","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Порто Ново","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Сао Томе","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Триполи","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Тунис","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Виндхук","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Адак","id":"America/Adak"},{"value":"America/Anchorage","name":"Анкъридж","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Ангуила","id":"America/Anguilla"},{"value":"America/Antigua","name":"Антигуа","id":"America/Antigua"},{"value":"America/Araguaina","name":"Арагуайна","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"Ла Риоха","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Рио Галегос","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Салта","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"Сан Хуан","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"Сан Луис","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Тукуман","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ушуая","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Аруба","id":"America/Aruba"},{"value":"America/Asuncion","name":"Асунсион","id":"America/Asuncion"},{"value":"America/Bahia","name":"Баия","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Баия де Бандерас","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Барбадос","id":"America/Barbados"},{"value":"America/Belem","name":"Белем","id":"America/Belem"},{"value":"America/Belize","name":"Белиз","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Блан-Саблон","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Боа Виста","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Богота","id":"America/Bogota"},{"value":"America/Boise","name":"Бойси","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Буенос Айрес","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Кеймбридж Бей","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Кампо Гранде","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Канкун","id":"America/Cancun"},{"value":"America/Caracas","name":"Каракас","id":"America/Caracas"},{"value":"America/Catamarca","name":"Катамарка","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Кайен","id":"America/Cayenne"},{"value":"America/Cayman","name":"Кайманови острови","id":"America/Cayman"},{"value":"America/Chicago","name":"Чикаго","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Чиуауа","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Корал Харбър","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Кордоба","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Коста Рика","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Крестън","id":"America/Creston"},{"value":"America/Cuiaba","name":"Чуяба","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Кюрасао","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Данмарксхавн","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Доусън","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Доусън Крийк","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Денвър","id":"America/Denver"},{"value":"America/Detroit","name":"Детройт","id":"America/Detroit"},{"value":"America/Dominica","name":"Доминика","id":"America/Dominica"},{"value":"America/Edmonton","name":"Едмънтън","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Ейрунепе","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"Салвадор","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Форт Нелсън","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Форталеза","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Глейс Бей","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Нуук","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Гус Бей","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Гранд Търк","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Гренада","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Гваделупа","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Гватемала","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Гуаякил","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Гаяна","id":"America/Guyana"},{"value":"America/Halifax","name":"Халифакс","id":"America/Halifax"},{"value":"America/Havana","name":"Хавана","id":"America/Havana"},{"value":"America/Hermosillo","name":"Ермосильо","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Нокс","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Маренго","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Питърсбърг","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Тел Сити","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Виви","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Винсенс","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Уинамак","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Индианаполис","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Инувик","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Иквалуит","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Ямайка","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Хухуй","id":"America/Jujuy"},{"value":"America/Juneau","name":"Джуно","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Монтичело","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Кралендейк","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"Ла Пас","id":"America/La_Paz"},{"value":"America/Lima","name":"Лима","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Лос Анджелис","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Луисвил","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Лоуър принсес куотър","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Масейо","id":"America/Maceio"},{"value":"America/Managua","name":"Манагуа","id":"America/Managua"},{"value":"America/Manaus","name":"Манаус","id":"America/Manaus"},{"value":"America/Marigot","name":"Мариго","id":"America/Marigot"},{"value":"America/Martinique","name":"Мартиника","id":"America/Martinique"},{"value":"America/Matamoros","name":"Матаморос","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Масатлан","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Мендоса","id":"America/Mendoza"},{"value":"America/Menominee","name":"Меномини","id":"America/Menominee"},{"value":"America/Merida","name":"Мерида","id":"America/Merida"},{"value":"America/Metlakatla","name":"Метлакатла","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Мексико Сити","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Микелон","id":"America/Miquelon"},{"value":"America/Moncton","name":"Монктон","id":"America/Moncton"},{"value":"America/Monterrey","name":"Монтерей","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Монтевидео","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Монтсерат","id":"America/Montserrat"},{"value":"America/Nassau","name":"Насау","id":"America/Nassau"},{"value":"America/New_York","name":"Ню Йорк","id":"America/New_York"},{"value":"America/Nipigon","name":"Нипигон","id":"America/Nipigon"},{"value":"America/Nome","name":"Ноум","id":"America/Nome"},{"value":"America/Noronha","name":"Нороня","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Бюла","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Сентър","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"Ню Сейлъм","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Охинага","id":"America/Ojinaga"},{"value":"America/Panama","name":"Панама","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Пангниртунг","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Парамарибо","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Финикс","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Порт-о-Пренс","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Порт ъф Спейн","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Порто Вельо","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Пуерто Рико","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Пунта Аренас","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Рейни Ривър","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Ранкин Инлет","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Ресифе","id":"America/Recife"},{"value":"America/Regina","name":"Риджайна","id":"America/Regina"},{"value":"America/Resolute","name":"Резолют","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Рио Бранко","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Санта Исабел","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Сантарем","id":"America/Santarem"},{"value":"America/Santiago","name":"Сантяго","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Санто Доминго","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"Сао Пауло","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Сгорсбисон","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Ситка","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Сен Бартелеми","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"Сейнт Джонс","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Сейнт Китс","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Сейнт Лусия","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Сейнт Томас","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Сейнт Винсънт","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Суифт Кърент","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Тегусигалпа","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Туле","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Тъндър Бей","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Тихуана","id":"America/Tijuana"},{"value":"America/Toronto","name":"Торонто","id":"America/Toronto"},{"value":"America/Tortola","name":"Тортола","id":"America/Tortola"},{"value":"America/Vancouver","name":"Ванкувър","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Уайтхорс","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Уинипег","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Якутат","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Йелоунайф","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Кейси","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Дейвис","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Дюмон Дюрвил","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Маккуори","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Моусън","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"Макмърдо","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Палмър","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Ротера","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Шова","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Трол","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Восток","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Лонгирбюен","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Аден","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Алмати","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Аман","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Анадир","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Актау","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Актобе","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ашхабад","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Атърау","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Багдад","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Бахрейн","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Баку","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Банкок","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Барнаул","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Бейрут","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Бишкек","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Бруней","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Колката","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Чита","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Чойбалсан","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Коломбо","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Дамаск","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Дака","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Дили","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Дубай","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Душанбе","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Фамагуста","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Газа","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Хеброн","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Хонконг","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Ховд","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Иркутск","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Джакарта","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Джаяпура","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Йерусалим","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Кабул","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Камчатка","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Карачи","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Катманду","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Хандига","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Красноярск","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Куала Лумпур","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Кучин","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Кувейт","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Макао","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Магадан","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Макасар","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Манила","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Мускат","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Никозия","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Новокузнецк","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Новосибирск","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Омск","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Арал","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Пном Пен","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Понтианак","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Пхенян","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Катар","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Къзълорда","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Рангун","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Рияд","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Хошимин","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Сахалин","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Самарканд","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Сеул","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Шанхай","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Сингапур","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Среднеколимск","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Тайпе","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Ташкент","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Тбилиси","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Техеран","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Тхимпху","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Токио","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Томск","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Улан Батор","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Урумчи","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Уст-Нера","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Виентян","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Владивосток","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Якутск","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Екатеринбург","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Ереван","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Азорски острови","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Бермудски острови","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Канарски острови","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Кабо Верде","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Фарьорски острови","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Мадейра","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Рейкявик","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Южна Джорджия","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Света Елена","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Стенли","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Аделаида","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Бризбейн","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Броукън Хил","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Къри","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Дарвин","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Юкла","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Хобарт","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Линдеман","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Лорд Хау","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Мелбърн","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Пърт","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Сидни","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Координирано универсално време","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Амстердам","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Андора","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Астрахан","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Атина","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Белград","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Берлин","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Братислава","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Брюксел","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Букурещ","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Будапеща","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Бюзинген","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Кишинев","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Копенхаген","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Ирландско стандартно времеДъблин","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Гибралтар","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Гърнзи","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Хелзинки","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"остров Ман","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Истанбул","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Джърси","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Калининград","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Киев","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Киров","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Лисабон","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Любляна","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Британско лятно часово времеЛондон","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Люксембург","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Мадрид","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Малта","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Мариехамн","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Минск","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Монако","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Москва","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Осло","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Париж","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Подгорица","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Прага","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Рига","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Рим","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Самара","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"Сан Марино","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Сараево","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Саратов","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Симферопол","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Скопие","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"София","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Стокхолм","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Талин","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Тирана","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Уляновск","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Ужгород","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Вадуц","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Ватикан","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Виена","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Вилнюс","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Волгоград","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Варшава","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Загреб","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Запорожие","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Цюрих","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Антананариво","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Чагос","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Рождество","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Кокосови острови","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Коморски острови","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Кергелен","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Мае","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Малдиви","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Мавриций","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Майот","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Реюнион","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Апия","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Окланд","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Бугенвил","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Чатам","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Великденски остров","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Ефате","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Ендърбъри","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Факаофо","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Фиджи","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Фунафути","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Галапагос","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Гамбие","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Гуадалканал","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Гуам","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Хонолулу","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Джонстън","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Киритимати","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Кошрай","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Куаджалин","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Маджуро","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Маркизки острови","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Мидуей","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Науру","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Ниуе","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Норфолк","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Нумеа","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Паго Паго","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Палау","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Питкерн","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Понпей","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Порт Морсби","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Раротонга","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Сайпан","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Таити","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Тарауа","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Тонгатапу","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Чуюк","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Уейк","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Уолис","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

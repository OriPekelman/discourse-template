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
r += "Palikusi <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 nelasīta</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "Palikušas <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " nelasītas</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "/new'>1 jauna</a> tēma";
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
})() + " jaunas</a> tēmas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " remaining, or ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "pārlūkot citas tēmas iekš ";
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
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "Jūs grasāties izdzēst šī lietotāja ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "IERAKSTUS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> ierakstu";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> ierakstus";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " un ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TĒMAS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> tēmu";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> tēmas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ", izdzēst viņa profilu, bloķēt reģistrēšanos no viņa IP adreses <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> un pievienot viņa e-pasta adresi <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> pastāvīgajam bloķēto sarakstam. Vai jūs esat pārliecināts, ka šis lietotājs patiešām ir spameris?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Šai tēmā ir ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 atbilde";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " atbildes";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "ar nedaudzām atzinībām";
return r;
},
"med" : function(d){
var r = "";
r += "ar vidēji daudzām atzinībām";
return r;
},
"high" : function(d){
var r = "";
r += "ar ļoti daudzām atzinībām";
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
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "Jūs grasaties dzēst šos ierakstus. Vai est drošs?";
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
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["lv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}};
MessageFormat.locale.lv = function (n) {
  if (n === 0) {
    return 'zero';
  }
  if ((n % 10) == 1 && (n % 100) != 11) {
    return 'one';
  }
  return 'other';
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

I18n.translations = {"lv":{"js":{"number":{"format":{"separator":",","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"zero":"baiti","one":"baits","other":"baiti"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}} tūkst.","millions":"{{number}} milj."}},"dates":{"time":"hh:mm","timeline_date":"MMM YYYY","long_no_year":"MMM D hh:mm","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY hh:mm","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"pirms %{date}","tiny":{"half_a_minute":"\u003c 1 m","less_than_x_seconds":{"zero":"\u003c 0 s","one":"\u003c %{count} s","other":"\u003c %{count} s"},"x_seconds":{"zero":"0 s","one":"%{count} s","other":"%{count} s"},"x_minutes":{"zero":"0 m","one":"%{count} m","other":"%{count} m"},"about_x_hours":{"zero":"0 h","one":"%{count} h","other":"%{count} h"},"x_days":{"zero":"0 d","one":"%{count} d","other":"%{count} d"},"about_x_years":{"zero":"0 g","one":"%{count} g","other":"%{count} g"},"over_x_years":{"zero":"\u003e 0 g","one":"\u003e %{count} g","other":"\u003e %{count} g"},"almost_x_years":{"zero":"0 g","one":"%{count} g","other":"%{count} g"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"zero":"0 minūtes","one":"%{count} minūtes","other":"%{count} minūtes"},"x_hours":{"zero":"0 stundas","one":"%{count} stunda","other":"%{count} stundas"},"x_days":{"zero":"0 dienas","one":"%{count} diena","other":"%{count} dienas"},"date_year":"D MMM, YYYY"},"medium_with_ago":{"x_minutes":{"zero":"pirms 0 minūtēm","one":"pirms %{count} minūtes","other":"pirms %{count} minūtēm"},"x_hours":{"zero":"pirms 0 stundām","one":"pirms %{count} stundas","other":"pirms %{count} stundām"},"x_days":{"zero":"pirms 0 dienām","one":"pirms %{count} dienas","other":"pirms %{count} dienām"}},"later":{"x_days":{"zero":"pēc 0 dienām","one":"pēc %{count} dienas","other":"pēc %{count} dienām"},"x_months":{"zero":"pēc 0 mēnešiem","one":"pēc %{count} mēneša","other":"pēc %{count} mēnešiem"},"x_years":{"zero":"pēc 0 gadiem","one":"pēc %{count} gada","other":"pēc %{count} gadiem"}},"previous_month":"Iepriekšējais mēnesis","next_month":"Nākamais mēnesis","placeholder":"datums"},"share":{"topic_html":"Temats: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"ieraksts #%{postNumber}","close":"aizvērt","twitter":"Dalīties ar šo saiti Twitter","facebook":"Dalīties ar šo saiti Facebook","email":"Nosūtīt šo saiti e-pastā"},"action_codes":{"public_topic":"padarīja tēmu publisku %{when}","split_topic":"sadalīja šo tēmu %{when}","invited_user":"uzaicināja %{who} %{when}","invited_group":"uzaicināja %{who} %{when}","removed_user":"izdzēsa %{who} %{when}","removed_group":"izdzēsa %{who} %{when}","autoclosed":{"enabled":"slēdza %{when}","disabled":"atvēra %{when}"},"closed":{"enabled":"slēdza %{when}","disabled":"atvēra %{when}"},"archived":{"enabled":"pievienoja arhīvam %{when}","disabled":"izņēma no arhīva %{when}"},"pinned":{"enabled":"piesprauda %{when}","disabled":"atsprauda %{when}"},"pinned_globally":{"enabled":"piesprauda globāli %{when}","disabled":"atsprauda globāli %{when}"},"visible":{"enabled":"pievienoja uzskaitei %{when}","disabled":"izņēma no uzskaites %{when}"},"banner":{"enabled":"padarīja šo par baneri %{when}. Tas parādīsies katras lapas augšā, līdz lietotājs to aizvērs.","disabled":"noņēma šo baneri %{when}. Tas vairs neparādīsies katras lapas augšā."}},"wizard_required":"Laipni lūgti jūsu jaunajā Discourse! Sāksim ar \u003ca href='%{url}' data-auto-route='true'\u003euzstādīšanas palīgu\u003c/a\u003e ✨","emails_are_disabled":"Administrators ir globāli izslēdzis visus izejošos e-pastus. Netiks nosūtīti nekāda veida paziņojumi.","themes":{"default_description":"Noklusējums"},"s3":{"regions":{"ap_northeast_1":"Āzijas un Klusā okeāna reģions (Tokija)","ap_northeast_2":"Āzijas un Klusā okeāna reģions (Seula)","ap_south_1":"Āzijas un Klusā okeāna reģions (Mumbaja)","ap_southeast_1":"Āzijas un Klusā okeāna reģions (Singapūra)","ap_southeast_2":"Āzijas un Klusā okeāna reģions (Sidneja)","cn_north_1":"Ķīna (Pekina)","eu_central_1":"ES (Frankfurte)","eu_west_1":"ES (Īrija)","eu_west_2":"ES (Londona)","us_east_1":"ASV austrumi (Z-Virdžīnija)","us_east_2":"ASV austrumi (Ohaijo)","us_west_1":"ASV rietumi (Z-Kalifornija)","us_west_2":"ASV rietumi (Oregona)"}},"edit":"labot šīs tēmas nosaukumu un sadaļu","expand":"Paplašināt","not_implemented":"Šī funkcionalitāte vēl nav ieviesta, atvainojiet!","no_value":"Nē","yes_value":"Jā","submit":"Iesniegt","generic_error":"Atvainojiet, ir notikusi kļūda.","generic_error_with_reason":"Notikusi kļūda: %{error}","sign_up":"Reģistrēties","log_in":"Ienākt","age":"Vecums","joined":"Pievienojās","admin_title":"Administrators","show_more":"parādīt vairāk","show_help":"iespējas","links":"Saites","links_lowercase":{"zero":"saite","one":"saite","other":"saites"},"faq":"BUJ","guidelines":"Vadlīnijas","privacy_policy":"Privātuma politika","privacy":"Privātums","tos":"Pakalpojuma noteikumi","rules":"Noteikumi","mobile_view":"Mobilais skats","desktop_view":"Datora skats","you":"Tu","or":"vai","now":"tikko","read_more":"lasīt vairāk","more":"Vairāk","less":"Mazāk","never":"nekad","every_30_minutes":"katras 30 minūtes","every_hour":"katru stundu","daily":"katru dienu","weekly":"katru nedēļu","every_month":"katru mēnesi","every_six_months":"katrus sešus mēnešus","max_of_count":"ne vairāk kā {{count}}","alternation":"vai","character_count":{"zero":"{{count}} zīmes","one":"{{count}} zīme","other":"{{count}} zīmes"},"related_messages":{"title":"Saistītās ziņas"},"suggested_topics":{"title":"Ieteiktās tēmas","pm_title":"Ieteiktās ziņas"},"about":{"simple_title":"Par","title":"Par %{title}","stats":"Vietnes statistika","our_admins":"Mūsu administratori","our_moderators":"Mūsu moderatori","moderators":"Moderātori","stat":{"all_time":"Visi"},"like_count":"Atzinības","topic_count":"Tēmas","post_count":"Ieraksti","user_count":"Lietotāji","active_user_count":"Aktīvi lietotāji","contact":"Sazinies ar mums","contact_info":"Ar šo vietni saistītu kritisku problēmu gadījumā lūdzu sazinieties ar mums %{contact_info}."},"bookmarked":{"title":"Grāmatzīmes","clear_bookmarks":"Noņemt grāmatzīmi","help":{"bookmark":"Uzklikšķiniet, lai pievienot šīs tēmas pirmo ierakstu grāmatzīmēm","unbookmark":"Uzklikšķiniet, lai noņemtu visas grāmatzīmes šai temā"}},"bookmarks":{"created":"tu esi pievienojies šim ierakstam grāmatzīmi","remove":"Noņemt grāmatzīmi","save":"Saglabāt"},"drafts":{"resume":"Turpināt","remove":"Atcelt","abandon":{"yes_value":"Jā, pamest","no_value":"Nē, paturēt"}},"preview":"priekšskatījums","cancel":"atcelt","save":"Saglabāt izmaiņas","saving":"Saglabāju...","saved":"Saglabāts!","upload":"Augšuplādēt","uploading":"Augšuplādēju...","uploaded":"Augšuplādēts!","enable":"Ieslēgt","disable":"Atslēgt","continue":"Turpināt","undo":"Atsaukt","revert":"Atgriezt","failed":"Neizdevās","switch_to_anon":"Ieiet anonīmajā režīmā","switch_from_anon":"Iziet no anonīmā režīma","banner":{"close":"Aizvērt šo baneri.","edit":"Rediģēt šo banneri \u003e\u003e"},"choose_topic":{"none_found":"Tēmas netika atrastas."},"review":{"order_by":"Kārtot pēc","explain":{"total":"Kopā"},"delete":"Dzēst","settings":{"saved":"Saglabāts","save_changes":"Saglabāt izmaiņas","title":"Iestatījumi"},"view_all":"Skatīt visus","topic":"Tēma:","filtered_user":"Lietotājs","show_all_topics":"rādīt visas tēmas","deleted_post":"(ieraksts dzēsts)","deleted_user":"(lietotājs dzēsts)","user":{"username":"Lietotājvārds","email":"E-pasts","name":"Vārds","fields":"Lauki"},"topics":{"topic":"Tēmas","reviewable_count":"Skaits","deleted":"[Temats dzēsts]","original":"(sākotnējais temats)"},"edit":"Labot","save":"Saglabāt","cancel":"Atcelt","filters":{"refresh":"Pārlādēt","status":"Statuss","category":"Sadaļa","orders":{"priority":"Prioritāte"}},"scores":{"date":"Datums","status":"Statuss"},"statuses":{"pending":{"title":"Gaidošie"},"rejected":{"title":"Noraidīts"}},"types":{"reviewable_user":{"title":"Lietotājs"}},"approval":{"title":"Ieraksts gaida apstiprinājumu","description":"Mēs saņēmām jūsu ierakstu, taču vispirms to jāapstiprina moderatoram. Lūdzu, esiet pacietīgi.","ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e pievienoja ierakstus \u003ca href='{{topicUrl}}'\u003etēmai\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eJūs\u003c/a\u003e pievienojāt ierakstu \u003ca href='{{topicUrl}}'\u003etēmai\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e atbildēja \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eJūs\u003c/a\u003e atbildējāt \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e atbildēja \u003ca href='{{topicUrl}}'\u003etemā\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eJūs\u003c/a\u003e atbildējāt \u003ca href='{{topicUrl}}'\u003etemā\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e pieminēja \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e pieminēja \u003ca href='{{user2Url}}'\u003eJūs\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eJūs\u003c/a\u003e pieminējāt \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Ierakstīja \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Ierakstījāt \u003ca href='{{userUrl}}'\u003eJūs\u003c/a\u003e","sent_by_user":"Nosūtīja \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Nosūtījāt \u003ca href='{{userUrl}}'\u003eJūs\u003c/a\u003e"},"directory":{"filter_name":"atlasīt pēc lietotājvārda","title":"Lietotāji","likes_given":"Dots","likes_received":"Saņemts","topics_entered":"Skatīts","topics_entered_long":"Skatītās tēmas","time_read":"Lasīšanas laiks","topic_count":"Tēmas","topic_count_long":"Izveidotās tēmas","post_count":"Atbildes","post_count_long":"Ierakstītās atbildes","no_results":"Nav rezultātu.","days_visited":"Apmeklējumi","days_visited_long":"Apmeklējuma dienas","posts_read":"Lasīts","posts_read_long":"Lasītie ieraksti","total_rows":{"zero":"Nav lietotāju","one":"%{count} lietotājs","other":"%{count} lietotāji"}},"group_histories":{"actions":{"change_group_setting":"Mainīt grupas iestatījumus","add_user_to_group":"Pievienot lietotāju","remove_user_from_group":"Noņemt lietotāju","make_user_group_owner":"Padarīt par īpašnieku","remove_user_as_group_owner":"Noņemt īpašnieka tiesības"}},"groups":{"add_members":{"title":"Pievienot dalībniekus"},"requests":{"reason":"Iemesls"},"manage":{"name":"Vārds","full_name":"Pilns vārds","add_members":"Pievienot dalībniekus","delete_member_confirm":"Izņemt '%{username}' no grupas '%{group}'?","profile":{"title":"Profils"},"interaction":{"posting":"Ieraksti"},"membership":{"title":"Piederība"},"logs":{"title":"Žurnāls","when":"Kad","action":"Darbība","acting_user":"Lietotājs, kas veica darbību","target_user":"Mērķa lietotājs","subject":"Tēma","details":"Detaļas","from":"No","to":"Kam"}},"public_admission":"Atļaut lietotājiem brīvi pievienoties grupai (šai grupai jābūt publiski redzamai)","public_exit":"Ļaut lietotājiem brīvi pamest grupu","empty":{"posts":"Grupas dalībnieki nav veikuši nevienu ierakstu.","members":"Šai grupā nav dalībnieku.","mentions":"Neviens nav pieminējis šo grupu.","messages":"Nav šai grupai adresētu ziņu.","topics":"Grupas dalībnieki nav izveidojuši nevienu tēmu.","logs":"Par šo grupu nav žurnāla ierakstu."},"add":"Pievienot","request":"Pieprasījums","message":"Ziņa","membership":"Piederība","name":"Vārds","group_name":"Grupas nosaukums","user_count":"Lietotāji","bio":"Par grupu","selector_placeholder":"ievadi lietotājvārdu","owner":"īpašnieks","index":{"title":"Grupas","all":"Visas grupas","empty":"Nav redzamu grupu.","automatic":"Automātiski","closed":"Slēgts","public":"Publisks","private":"Privāts","automatic_group":"Automātiska grupa","my_groups":"Manas grupas"},"title":{"zero":"Grupas","one":"Grupa","other":"Grupas"},"activity":"Aktivitāte","members":{"title":"Dalībnieki","filter_placeholder":"lietotājvārds"},"topics":"Tēmas","posts":"Ieraksti","mentions":"Pieminēšanas","messages":"Ziņas","notification_level":"Noklusējuma līmenis paziņojumiem par jaunām grupas ziņām","alias_levels":{"nobody":"Neviens","only_admins":"Tikai administratori","mods_and_admins":"Tikai moderatori un administratori","members_mods_and_admins":"Tikai grupu biedri, moderatori un administratori","everyone":"Ikviens"},"notifications":{"watching":{"title":"Skatās","description":"Jums paziņos par katru jaunu ierakstu katrā ziņā, kā arī parādīs jauno atbilžu skaitu."},"watching_first_post":{"title":"Seko pirmajam ierakstam"},"tracking":{"title":"Sekošana","description":"Jums paziņos, ja kāds pieminēs jūsu @vārdu vai atbildēs jums. Jūs redzēsiet jauno atbilžu skaitu."},"regular":{"title":"Normāls","description":"Jums paziņos, ja kāds pieminēs jūsu @vārdu vai atbildēs Jums."},"muted":{"title":"Noklusināts"}},"flair_url":"Avatāra attēls","flair_url_placeholder":"(Neobligāti) Saite uz attēlu vai Font Awesome klasi","flair_bg_color":"Avatāra attēla fona krāsa","flair_bg_color_placeholder":"(Neobligāti) Heksadecimālā krāsas vērtība","flair_color":"Avatāra attēla krāsa","flair_color_placeholder":"(Neobligāti) Heksadecimālā krāsas vērtība","flair_preview_icon":"Priekšskatījuma ikona","flair_preview_image":"Priekšskatījuma attēls"},"user_action_groups":{"1":"Veiktās atzinības","2":"Saņemtās atzinības","3":"Grāmatzīmes","4":"Tēmas","5":"Atbildes","6":"Reakcijas","7":"Pieminēšanas","9":"Citāti","11":"Labojumi","12":"Nosūtne","13":"Iesūtne","14":"Gaida apstiprinājumu"},"categories":{"all":"visas sadaļas","all_subcategories":"Viss","no_subcategory":"nekas","category":"Sadaļa","category_list":"Parādīt sadaļu sarakstu","reorder":{"title":"Pārkārtot sadaļas","title_long":"Pārkārtot sadaļu sarakstu","save":"Saglabāt kārtību","apply_all":"Pielietot","position":"Pozīcija"},"posts":"Raksti","topics":"Tēmas","latest":"Jaunākie","latest_by":"jaunāks par","toggle_ordering":"mainīt secības kontroli","subcategories":"Apakšsadaļas","topic_sentence":{"zero":"Nav tēmu","one":"%{count} tēma","other":"%{count} tēmas"}},"ip_lookup":{"title":"IP adreses meklēšana","hostname":"Resursdatora nosaukums","location":"Atrašanās vieta","location_not_found":"(nezināms)","organisation":"Organizācija","phone":"Tālrunis","other_accounts":"Citi profili ar šo IP adresi:","delete_other_accounts":"Izdzēst %{count}","username":"lietotājvārds","trust_level":"Uzticības līmenis","read_time":"lasīšanas laiks","topics_entered":"pievienotās tēmas","post_count":"# ieraksti","confirm_delete_other_accounts":"Vai esat pārliecināti, ka vēlaties dzēst šos profilus?"},"user_fields":{"none":"(izvēlieties opciju)"},"user":{"said":"{{username}}:","profile":"Profils","mute":"Klusināt","edit":"Mainīt iestatījumus","download_archive":{"button_text":"Lejupielādēt visu","confirm":"Vai esat droši, ka vēlaties lejuplādēt savus ierakstus?","success":"Lejuplāde uzsākta; pavēstīsim jums ziņā, kad šis process būs beidzies.","rate_limit_error":"Ierakstus var lejuplādēt reizi dienā, lūdzu mēģiniet atkal rītdien."},"new_private_message":"Jauns ziņa","private_message":"Ziņa","private_messages":"Ziņas","user_notifications":{"ignore_duration_username":"Lietotājvārds","ignore_duration_when":"Ilgums:","ignore_duration_save":"Ignorēt","add_ignored_user":"Pievienot...","mute_option":"Noklusināts","normal_option":"Normāls"},"activity_stream":"Aktivitāte","preferences":"Iestatījumi","feature_topic_on_profile":{"save":"Saglabāt","clear":{"title":"Notīrīt"}},"expand_profile":"Paplašināt","collapse_profile":"Sakļaut","bookmarks":"Grāmatzīmes","bio":"Par mani","invited_by":"Uzaicināja","trust_level":"Uzticības līmenis","notifications":"Paziņojumi","statistics":"Statistika","desktop_notifications":{"not_supported":"Atvainojiet, bet šī pārlūkprogramma neatbalsta paziņojumus.","perm_default":"Ieslēgt paziņojumus","perm_denied_btn":"Piekļuve liegta","perm_denied_expl":"Jūs neatļāvāt paziņojumus. Atļaujiet paziņojumus jūsu pārlūkprogrammas iestatījumos.","disable":"Atslēgt paziņojumus","enable":"Ieslēgt paziņojumus","each_browser_note":"Piezīme: šis iestatījums jānomaina katrā pārlūkprogrammā. kuru izmantojat."},"dismiss":"Nerādīt","dismiss_notifications":"Vairs nerādīt visus","dismiss_notifications_tooltip":"Atzīmēt visus nelasītos paziņojumus kā izlasītus","first_notification":"Jūsu pirmais paziņojums! Izvēlieties to, lai sāktu.","external_links_in_new_tab":"Atvērt visas saites jaunā cilnē","enable_quoting":"Ieslēgt atbildi ar iezīmētā teksta citēšanu","change":"mainīt","moderator":"{{user}} ir moderators","admin":"{{user}} ir administrators","moderator_tooltip":"Šis lietotājs ir moderators","admin_tooltip":"Šis lietotājs ir administrators","suspended_notice":"Lietotājs ir īslaicīgi bloķēts līdz {{date}}.","suspended_reason":"Iemesls:","github_profile":"Github","email_activity_summary":"Aktivitātes atskaite","mailing_list_mode":{"label":"Vēstkopas režīms","enabled":"Ieslēgt vēstkopas režīmu","instructions":"Šis iestatījums neievēro aktivitātes atskaiti.\u003cbr /\u003e\nKlusinātās tēmas un sadaļas nav iekļautas šajos e-pastos.\n","individual":"Sūtīt e-pastu par katru jauno ierakstu","individual_no_echo":"Sūtīt e-pastu par katru jauno ierakstu, izņemot manus","many_per_day":"Sūtīt e-pastu par katru jauno ierakstu (apmēram {{dailyEmailEstimate}} dienā)","few_per_day":"Sūtīt e-pastu par katru jauno ierakstu (apmēram divus dienā)"},"tag_settings":"Tagi","watched_tags":"Skatīts","watched_tags_instructions":"Jūs automātiski sekosiet visām tēmām ar šiem tagiem. Jums paziņos par visām jaunām tēmām un ierakstiem, un pie tēmas redzēsiet jauno ierakstu skaitu.","tracked_tags":"Sekots","tracked_tags_instructions":"Jūs automātiski sekosiet visām tēmām ar šiem tagiem. Pie tēmas redzēsiet jauno ierakstu skaitu.","muted_tags":"Klusināts","muted_tags_instructions":"Jums neko neziņos par jaunām tēmām ar šiem tagiem, un tās neparādīsies starp tēmām ar pēdējām izmaiņām.","watched_categories":"Skatīts","watched_categories_instructions":"Jūs automātiski sekosiet visām tēmām šajās sadaļās. Jums paziņos par visām jaunajām tēmām un ierakstiem, un pie tēmas redzēsiet jauno ierakstu skaitu.","tracked_categories":"Sekots","tracked_categories_instructions":"Jūs automātiski sekosiet visām tēmām šajās sadaļās. Pie tēmas redzēsiet jauno ierakstu skaitu.","watched_first_post_categories":"Seko pirmajam ierakstam","watched_first_post_categories_instructions":"Jums paziņos par pirmo ierakstu katrā jaunajā tēmā šajās sadaļās.","watched_first_post_tags":"Seko pirmajam ierakstam","watched_first_post_tags_instructions":"Jums paziņos par pirmo ierakstu katrā jaunajā tēmā ar šiem tagiem.","muted_categories":"Klusināts","no_category_access":"Kā moderatoram jums ir ierobežota kategoriju piekļuve, saglabāšana ir atspējota.","delete_account":"Izdzēst manu profilu","delete_account_confirm":"Vai esat drošs, ka vēlaties neatgriezeniski dzēst savu profilu? Šo darbību nevar atcelt!","deleted_yourself":"Jūsu profils ir veiksmīgi izdzēsts.","unread_message_count":"Ziņas","admin_delete":"Dzēst","users":"Lietotāji","muted_users":"Klusināts","muted_users_instructions":"Nerādīt paziņojumus no šiem lietotājiem.","tracked_topics_link":"Parādīt","automatically_unpin_topics":"Automātiski atspraust tēmas, kad sasniedzu beigas.","apps":"Lietotnes","revoke_access":"Liegt piekļuvi","undo_revoke_access":"Atcelt piekļuves liegšanu","api_approved":"Apstiprināts:","theme":"Tēma","staff_counters":{"flags_given":"noderīgas sūdzības","flagged_posts":"ieraksti ar sūdzībām","deleted_posts":"izdzēstie ieraksti","suspensions":"īslaicīgās bloķēšanas","warnings_received":"brīdinājumi"},"messages":{"all":"Viss","inbox":"Iesūtne","sent":"Nosūtne","archive":"Arhīvs","groups":"Manas grupas","bulk_select":"Atlasīt ziņas","move_to_inbox":"Pārvietot uz iesūtni","move_to_archive":"Arhivēt","failed_to_move":"Neizdevās pārvietot izvēlētas ziņas (varbūt pazudis pieslēgums internetam)","select_all":"Izvēlēties visu","tags":"Birkas"},"preferences_nav":{"account":"Konts","profile":"Profils","emails":"E-pasti","notifications":"Paziņojumi","categories":"Sadaļas","users":"Lietotāji","tags":"Tagi","interface":"Saskarne","apps":"Lietotnes"},"change_password":{"success":"(e-pasts nosūtīts)","in_progress":"(sūta e-pastu)","error":"(kļūda)","action":"Sūtīt paroles atjaunošanas e-pastu","set_password":"Uzstādīt paroli","choose_new":"Izvēlēties jaunu paroli","choose":"Izvēlēties paroli"},"second_factor_backup":{"regenerate":"Atkārtoti radīt","disable":"Atslēgt","enable":"Ieslēgt","copied_to_clipboard":"Nokopēts uz starpliktuvi (clipboard)","copy_to_clipboard_error":"Radās kļūda, kopējot uz starpliktuvi (clipboard)"},"second_factor":{"name":"Vārds","label":"Kods","edit":"Labot","security_key":{"delete":"Dzēst"}},"change_about":{"title":"Mainīt aprakstu par mani","error":"Mainot šo vērtību, notika kļūda."},"change_username":{"title":"Mainīt lietotājvārdu","taken":"Atvainojiet, šis lietotājvārds ir aizņemts.","invalid":"Šis lietotājvārds ir nederīgs. Izmantojiet tikai ciparus un burtus"},"change_email":{"title":"Mainīt e-pastu","taken":"Atvainojiet, šis e-pasts nav pieejams.","error":"Mainot jūsu e-pasta adresi, notika kļūda. Varbūt šī adrese jau tiek izmantota?","success":"Mēs aizsūtījām e-pastu uz šo adresi. Lūdzu sekojiet apstiprināšanas instrukcijām vēstulē."},"change_avatar":{"title":"Nomainīt savu profila bildi","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, balstīts uz","gravatar_title":"Nomainiet jūsu avatāra attēlu Gravatar lapā","refresh_gravatar_title":"Atjaunot jūsu Gravatar attēlu","letter_based":"Sistēmas piešķirtais profila attēls","uploaded_avatar":"Savs attēls","uploaded_avatar_empty":"Pievienot savu attēlu","upload_title":"Augšupielādēt savu attēlu","image_is_not_a_square":"Uzmanību: mēs apgriezām jūsu attēlu; platums un augstums nebija vienādi."},"change_card_background":{"title":"Lietotāja kartiņas fons","instructions":"Fona attēli būs centrēti un ar noklusējuma platumu 590px."},"email":{"title":"E-pasts","ok":"Mēs jums nosūtīsim apstiprinājuma e-pastu","invalid":"Lūdzu ievadiet derīgu e-pasta adresi","authenticated":"Jūsu e-pastu autentificēja {{provider}}","frequency_immediately":"Mēs nekavējoties sūtīsim jums epastu par jaunām neizlasītām ziņām.","frequency":{"zero":"Mēs sūtīsim jums e-pastu tikai tad, ja nebūsim jūs redzējuši pēdējo {{count}} minūšu laikā.","one":"Mēs sūtīsim jums e-pastu tikai tad, ja nebūsim jūs redzējuši pēdējās minūtes laikā.","other":"Mēs sūtīsim jums e-pastu tikai tad, ja nebūsim jūs redzējuši pēdējo {{count}} minūšu laikā."}},"associated_accounts":{"revoke":"Atsaukt","cancel":"Atcelt"},"name":{"title":"Vārds","instructions":"jūsu pilnais vārds (neobligāti)","instructions_required":"Jūsu pilnais vārds","too_short":"Jūsu vārds ir pārāk īss","ok":"Jūsu vārds izskatās labi"},"username":{"title":"Lietotājvārds","instructions":"unikāls, bez atstarpēm, īss","short_instructions":"Cilvēki var pieminēt jūs kā @{{username}}","available":"Jūsu lietotājvārds ir pieejams","not_available":"Nav pieejams. Mēģiniet {{suggestion}}?","not_available_no_suggestion":"Nav pieejams","too_short":"Jūsu lietotājvārds ir parāk īss","too_long":"Jūsu lietotājvārds ir pārāk garš","checking":"Pārbauda lietotājvārda pieejamību...","prefilled":"E-pasts atbilst šim reģistrētajam lietotājvārdam"},"locale":{"title":"Saskarnes valoda","instructions":"Lietotāja saskarnes valoda. Tā mainīsies pēc lapas atsvaidzināšanas.","default":"(noklusējums)","any":"jebkura"},"password_confirmation":{"title":"Parole vēlreiz"},"auth_tokens":{"ip":"IP","details":"Detaļas"},"last_posted":"Pēdējais ieraksts","last_emailed":"Pēdējais e-pasts","last_seen":"Redzēts","created":"Pievienojās","log_out":"Iziet","location":"Atrašanās vieta","website":"Tīmekļa vietne","email_settings":"E-pasts","text_size":{"title":"Teksta izmērs","smaller":"Mazāks","normal":"Normāls","larger":"Lielāks","largest":"Lielākais"},"like_notification_frequency":{"title":"Paziņot, ja saņemta atzinība","always":"Vienmēr","first_time_and_daily":"Pirmo reizi, kad izteikta atzinība, un katru dienu","first_time":"Pirmo reizi, kad izteikta atzinība par ierakstu","never":"Nekad"},"email_previous_replies":{"title":"Iekļaut iepriekšējās atbildes epasta beigās","unless_emailed":"izņemot, ja iepriekš sūtīts","always":"vienmēr","never":"nekad"},"email_digests":{"every_30_minutes":"katras 30 minūtes","every_hour":"katru stundu","daily":"katru dienu","weekly":"katru nedēļu","every_month":"katru mēnesi","every_six_months":"katrus sešus mēnešus"},"email_level":{"title":"Sūtīt man e-pastu, kad kāds citē mani, atbild manam ierakstam, piemin manu @lietotājvārdu vai ielūdz mani kādā tēmā","always":"vienmēr","never":"nekad"},"email_messages_level":"Sūtīt man e-pastu, kad kāds sūta man ziņu","include_tl0_in_digests":"Iekļaut kopsavilkuma e-pastos saturu no jaunajiem lietotājiem","email_in_reply_to":"Iekļaut e-pastā citātu no atbildes uz ierakstu","other_settings":"Citi","categories_settings":"Sadaļas","new_topic_duration":{"label":"Uzskatīt tēmas par jaunām, ja","not_viewed":"Es vēl neesmu tās skatījis","last_here":"izveidotas, kopš es šeit pēdējo reizi biju","after_1_day":"izveidots pēdējā dienā","after_2_days":"izveidots pēdējās 2 dienās","after_1_week":"izveidots pēdējā nedēļā","after_2_weeks":"izveidots pēdējās 2 nedēļās"},"auto_track_topics":"Automātiski sekot tēmām, kuras ievadu","auto_track_options":{"never":"nekad","immediately":"tūlīt","after_30_seconds":"pēc 30 sekundēm","after_1_minute":"pēc 1 minūtes","after_2_minutes":"pēc 2 minūtēm","after_3_minutes":"pēc 3 minūtēm","after_4_minutes":"pēc 4 minūtēm","after_5_minutes":"pēc 5 minūtēm","after_10_minutes":"pēc 10 minūtēm"},"notification_level_when_replying":"Kad es ierakstu tēmā, iestatīt tēmai","invited":{"search":"raksti, lai meklētu ielūgumos...","title":"Ielūgumi","user":"Ielūgtie lietotāji","truncated":{"zero":"Nav ielūgumu.","one":"Pirmais ielūgums.","other":"Pirmie {{count}} ielūgumi."},"redeemed":"Pieņemtie ielūgumi","redeemed_tab":"Pieņemti","redeemed_tab_with_count":"Pieņemti ({{count}})","redeemed_at":"Pieņemti","pending":"Gaidošie ielūgumi","pending_tab":"Gaidošie","pending_tab_with_count":"Gaidošie ({{count}})","topics_entered":"Apskatītās tēmas","posts_read_count":"Izlasītie ieraksti","expired":"Šis ielūgums ir izbeidzies.","rescind":"Atcelt","rescinded":"Ielūgums atcelts","reinvite":"Atkārtot ielūgumu","reinvite_all":"Atkārtot visus ielūgumus","reinvite_all_confirm":"Vai tiešām vēlaties atkārtot visus ielūgumus?","reinvited":"Ielūgums atkārtots","reinvited_all":"Visi ielūgumi atkārtoti!","time_read":"Laiks, ko lasīja","days_visited":"Dienas, kurās apmeklēja","account_age_days":"Konta vecums dienās","create":"Nosūtīt ielūgumu","generate_link":"Kopēt ielūguma saiti","link_generated":"Ielūguma saite gatava!","valid_for":"Ielūguma saite ir derīga tikai šai e-pasta adresei: %{email}","bulk_invite":{"none":"Jūs vēl šeit neesat nevienu ielūdzis. Nosūtiet atsevišķus ielūgumus vai ielūdziet daudzus lietotājus vienlaicīgi,\u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e augšupielādējot CSV failu\u003c/a\u003e","text":"Ielūgt visus no faila","success":"Fails veiksmīgi lejuplādēts, jums paziņos, kad process beidzies.","error":"Atvainojiet, failam jābūt CSV formātā."}},"password":{"title":"Parole","too_short":"Jūsu parole ir pārāk īsa.","common":"Šī parole ir pārāk vienkārša.","same_as_username":"Jūsu parole ir tāda pati, kā jūsu lietotājvārds.","same_as_email":"Jūsu parole ir tāda pati, kā jūsu e-pasts.","ok":"Jūsu parole izskatās labi.","instructions":"vismaz %{count} rakstzīmes"},"summary":{"title":"Kopsavilkums","stats":"Statistika","time_read":"lasīšanas laiks","topic_count":{"zero":"nav izveidotu tēmu","one":"viena tēma izveidota","other":"izveidotās tēmas"},"post_count":{"zero":"ierakstu izveidoti","one":"ieraksts izveidots","other":"izveidotie ieraksti"},"days_visited":{"zero":"apmeklētas dienas","one":" apmeklēta diena","other":"apmeklējuma dienas"},"posts_read":{"zero":"ierakstu izlasīti","one":"ieraksts izlasīts","other":"izlasītie ieraksti"},"bookmark_count":{"zero":"atzīmes","one":"atzīme","other":"grāmatzīmes"},"top_replies":"Labākās atbildes","no_replies":"Vēl nav atbilžu.","more_replies":"Vairāk atbilžu","top_topics":"Labākās tēmas","no_topics":"Vēl nav tēmu.","more_topics":"Vairāk tēmu","top_badges":"Labākie žetoni","no_badges":"Vēl nav žetonu.","more_badges":"Vairāk žetonu","top_links":"Labākās saites","no_links":"Vēl nav saišu.","most_liked_by":"Visvairāk atzinību no","most_liked_users":"Visvairāk atzinību","most_replied_to_users":"Visvairāk atbildēja","no_likes":"Pagaidām atzinību nav.","topics":"Tēmas","replies":"Atbildes"},"ip_address":{"title":"Pēdējā IP adrese"},"registration_ip_address":{"title":"Reģistrēšanās IP adrese"},"avatar":{"title":"Profila attēls","header_title":"profils, ziņas, grāmatzīmes un iestatījumi"},"title":{"title":"Virsraksts","none":"(neviens)"},"primary_group":{"title":"Galvenā grupa","none":"(neviens)"},"filters":{"all":"Visi"},"stream":{"posted_by":"Ierakstīja","sent_by":"Nosūtīja","private_message":"ziņa","the_topic":"tēma"}},"loading":"Ielādē...","errors":{"prev_page":"mēģinot ielādēt","reasons":{"network":"Tīkla kļūda","server":"Servera kļūda","forbidden":"Piekļuve liegta","unknown":"Kļūda","not_found":"Lapa nav atrasta"},"desc":{"network":"Lūdzu, pārbaudiet jūsu savienojumu.","network_fixed":"Šķiet, tīkls atkal pieslēgts.","server":"Kļūdas kods: {{status}}","forbidden":"Jums nav pieejas šai lapai.","not_found":"Upss, aplikācija mēģināja ielādēt saiti, kura neeksistē.","unknown":"Kaut kas nogāja greizi."},"buttons":{"back":"Atgriezties","again":"Mēģināt vēlreiz","fixed":"Ielādēt lapu"}},"close":"Aizvērt","assets_changed_confirm":"Šī vietne tikko bija atjaunota. Pārlādēt lapu, lai pārietu uz jaunāko versiju?","logout":"Jūs izgājāt.","refresh":"Pārlādēt","read_only_mode":{"enabled":"Vietne ir \"tikai lasīšanas\" režīmā. Lūdzu turpiniet lasīt, taču atbildēšana, atzinības izteikšana un citas funkcijas šobrīd ir atslēgtas.","login_disabled":"Pieslēgšanās ir atslēgta, kamēr vietne ir \"tikai lasīšanas\" režīmā.","logout_disabled":"Iziešana ir atslēgta, kamēr vietne ir \"tikai lasīšanas\" režīmā."},"learn_more":"uzzināt vairāk...","all_time":"kopā","all_time_desc":"pavisam izveidotas tēmas","year":"gads","year_desc":"pēdējās 365 dienās izveidotie ieraksti","month":"mēnesis","month_desc":"pēdējās 30 dienās izveidotās tēmas","week":"nedēļa","week_desc":"pēdējās 7 dienās izveidotās tēmas","day":"diena","first_post":"Pirmais ieraksts","mute":"Noklusināt","unmute":"Pārtraukt klusināšanu","last_post":"Ierakstīts","time_read":"Lasīts","last_reply_lowercase":"pēdējā atbilde","replies_lowercase":{"zero":"atbildes","one":"atbilde","other":"atbildes"},"signup_cta":{"sign_up":"Pierakstīties","hide_session":"Atgādināt man rīt","hide_forever":"nē, paldies","hidden_for_session":"Labi, pajautāšu jums rīt. Starp citu, vienmēr var piereģistrēties, spiežot \"Ieiet sistēmā\"."},"summary":{"enabled_description":"Jūs skatāties šīs tēmas kopsavilkumu: pašus interesantākos ierakstus, pēc kopienas domām.","description":"Ir \u003cb\u003e{{replyCount}}\u003c/b\u003e atbildes.","description_time":"Ir \u003cb\u003e{{replyCount}}\u003c/b\u003e atbildes ar paredzamo lasīšanas laiku: \u003cb\u003e{{readingTime}} minūtes\u003c/b\u003e.","enable":"Tēmas kopsavilkums","disable":"Parādīt visus ierakstus"},"deleted_filter":{"enabled_description":"Šī tēma satur dzēstus ierakstus, kuri ir paslēpti.","disabled_description":"Dzēstie ieraksti šajā tēmā ir redzami.","enable":"Paslēpt dzēstos ierakstus ","disable":"Rādīt dzēstos ierakstus"},"private_message_info":{"title":"Ziņa","edit":"Pievienot vai noņemt...","remove_allowed_user":"Vai jūs tiešām gribat dzēst {{name}} no šīs ziņas?","remove_allowed_group":"Vai jūs tiešām gribat dzēst {{name}} no šīs ziņas?"},"email":"E-pasts","username":"Lietotājvārds","last_seen":"Redzēts","created":"Izveidots","created_lowercase":"izveidots","trust_level":"Uzticības līmenis","search_hint":"lietotājvārds, e-pasts vai IP adrese","create_account":{"title":"Izveidot jaunu profilu","failed":"Notika neparedzēta kļūda; varbūt šis e-pasts ir jau reģistrēts, pamēģiniet izmantot \"aizmirsu paroli\""},"forgot_password":{"title":"Paroles atjaunošana","action":"Es aizmirsu savu paroli ","invite":"Ievadiet jūsu lietotājvārdu vai e-pasta adresi, un mēs jums nosūtīsim paroles atjaunošanas e-pastu.","reset":"Atjaunot paroli","complete_username":"Ja konts atbildīs lietotājvārdam \u003cb\u003e%{username}\u003c/b\u003e, jūs drīz saņemsiet e-pastu ar paroles atjaunošanas instrukcijām.","complete_email":"Ja konts atbildīs\u003cb\u003e%{email}\u003c/b\u003e, Jūs drīz saņemsiet e-pastu ar paroles atjaunošanas instrukcijām.","complete_username_not_found":"Neviens konts neatbilst lietotājvārdam \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Neviens konts neatbilst \u003cb\u003e%{email}\u003c/b\u003e","help":"Nesaņēmāt e-pastu? Pārbaudiet savu surogātpasta mapi. \u003cp\u003eNeesat drošs par to, kuru e-pasta adresi izmantojāt? Ievadiet e-pasta adresi, un mēs paziņosim, ja tā ir izmantota.\u003c/p\u003e \u003cp\u003eJa jums vairs nav piekļuves sava konta e-pasta adresei, lūdzu, sazinieties \u003ca href='%{basePath}/about'\u003ear mūsu izpalīdzīgajiem darbiniekiem.\u003c/a\u003e\u003c/p\u003e","button_ok":"Labi","button_help":"Palīdzība"},"email_login":{"complete_username_not_found":"Neviens konts neatbilst lietotājvārdam \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Neviens konts neatbilst \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Turpināt %{site_name}"},"login":{"title":"Ieiet sistēmā","username":"Lietotājs","password":"Parole","email_placeholder":"e-pasts vai lietotājvārds","caps_lock_warning":"Ir ieslēgts Caps Lock","error":"Nezināma kļūda","rate_limit":"Lūdzu uzgaidiet pirms nākamā mēģinājuma ieiet sistēmā","blank_username_or_password":"Lūdzu ievadiet savu e-pastu vai lietotājvārdu un paroli","reset_password":"Atjaunot paroli","logging_in":"Ieejam sistēmā...","or":"Vai","authenticating":"Autorizējam...","awaiting_activation":"Jūsu profils gaida aktivizāciju; izmantojiet saiti \"aizmirsu paroli\", lai izsūtītu citu aktivizācijas e-pastu.","awaiting_approval":"Darbinieki pagaidām nav apstiprinājuši jūsu profilu. Jums nosūtīs e-pastu, kad tas notiks.","requires_invite":"Atvainojiet, šim forumam var piekļūt tikai ar ielūgumiem.","not_activated":"Lai ieietu forumā, nepieciešams aktivizēt jūsu profilu. Mēs nosūtījām uz e-pastu {{sentTo}} instrukcijas, kā to paveikt.","not_allowed_from_ip_address":"Jūs nevarat ieiet no šīs IP adreses.","admin_not_allowed_from_ip_address":"Jūs nevarat ieiet kā administrators no šīs IP adreses.","resend_activation_email":"Klikšķiniet šeit, lai saņemtu aktivācijas e-pastu atkārtoti.","resend_title":"Atkārtoti nosūtīt aktivācijas e-pastu","change_email":"Mainīt e-pasta adresi","provide_new_email":"Norādiet jaunu adresi, un mēs atkārtoti nosūtīsim jūsu apstiprinājuma e-pastu.","submit_new_email":"Atjaunināt e-pasta adresi","sent_activation_email_again":"Mēs nosūtijām vēl vienu aktivācijas epastu uz \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Tas var pienākt dažu minūšu laikā; atcerieties pārbaudīt jūsu surogātpasta mapi.","to_continue":"Lūdzu ieejiet","preferences":"Jums ir jāieiet, lai izmainītu savus iestatījumus.","forgot":"Es nevaru atcerēties sava konta informāciju.","not_approved":"Jūsu konts vēl nav apstiprināts. Jums tiks paziņots e-pastā, kad varēsiet pieslēgties.","google_oauth2":{"name":"Google","title":"ar Google"},"twitter":{"name":"Twitter","title":"ar Twitter"},"instagram":{"name":"Instagram","title":"ar Instagram"},"facebook":{"name":"Facebook","title":"ar Facebook"},"github":{"name":"GitHub","title":"ar GitHub"},"discord":{"name":"Discord","title":"ar Discord"}},"invites":{"accept_title":"Ielūgums","welcome_to":"Laipni lūdzam %{site_name}!","invited_by":"Jūs uzaicināja: ","social_login_available":"Jūs varēsiet ieiet ar šo e-pastu, arī izmantojot sociālo tīklu profilus.","your_email":"Jūsu konta e-pasta adrese ir \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Pieņemt ielūgumu","success":"Jūsu konts ir izveidots un jūs esat ielogojies ","name_label":"Vārds","password_label":"Iestatīt paroli","optional_description":"(pēc izvēles)"},"password_reset":{"continue":"Turpināt %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Tikai sadaļas","categories_with_featured_topics":"Sadaļas un to labākās tēmas","categories_and_latest_topics":"Sadaļas un jaunākās tēmas"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"conditional_loading_section":{"loading":"Ielādē..."},"date_time_picker":{"from":false,"to":"Kam"},"emoji_picker":{"filter_placeholder":"Meklēt emoji","objects":"Priekšmeti","symbols":"Simboli","flags":"Sūdzības","custom":"Lietotāja emoji","recent":"Nesen izmantotie","default_tone":"Noklusējuma ādas krāsa","light_tone":"Gaiša ādas krāsa","medium_light_tone":"Vidēji gaiša ādas krāsa","medium_tone":"Vidēja ādas krāsa","medium_dark_tone":"Vidēji tumša ādas krāsa","dark_tone":"Tumša ādas krāsa"},"composer":{"emoji":"Emoji :)","more_emoji":"vairāk...","options":"Iespējas","whisper":"čuksts","unlist":"paslēpts","blockquote_text":"Bloka citāts","add_warning":"Šis ir oficiāls brīdinājums.","toggle_whisper":"Čukstēšana","toggle_unlisted":"Paslēpšana no tēmu saraksta","posting_not_on_topic":"Kurā tēmā vēlaties komentēt?","saved_local_draft_tip":"saglabāts lokāli","similar_topics":"Jūsu tēma ir līdzīga...","drafts_offline":"lokāls melnraksts","group_mentioned":{"zero":"Pieminot {{group}}, neviens nesaņems paziņojumu, jo grupa ir tukša.","one":"Pieminot {{group}}, šis cilvēks saņems paziņojumu – esat pārliecināti?","other":"Pieminot {{group}}, šiem \u003ca href='{{group_link}}'\u003e{{count}} cilvēki\u003c/a\u003e saņems paziņojumu – esat pārliecināti?"},"cannot_see_mention":{"category":"Jūs pieminējāt {{username}}, kas ir bez piekļuves šai sadaļai un tāpēc nesaņems nekādu paziņojumu. Lai to izlabotu, pievieno viņus grupai ar pieeju šai sadaļai.","private":"Jūsu pieminējāt {{username}}, kas neredzēs šo privāto ziņu un tāpēc nesaņems nekādu paziņojumu. Lai to izlabotu, pievieno viņus šai ziņai."},"duplicate_link":"Izskatās, ka jūsu saiti uz \u003cb\u003e{{domain}}\u003c/b\u003e tēmā jau ievietoja \u003cb\u003e@{{username}}\u003c/b\u003e \u003ca href='{{post_url}}'\u003eierakstā {{ago}}\u003c/a\u003e - vai jūs tiešām vēlaties to ievietot vēlreiz?","error":{"title_missing":"Vajadzīgs nosaukums","title_too_short":"Nosaukumā jābūt vismaz {{min}} burtiem","title_too_long":"Nosaukums nevar būt garāks par {{max}} burtiem","post_length":"Ierakstā jābūt vismaz {{min}} burtiem","category_missing":"Jums ir jāizvēlas sadaļa"},"save_edit":"Saglabāt izmaiņas","reply_original":"Atbildēt sākotnējā tēmā","reply_here":"Atbildēt šeit","reply":"Atbildēt","cancel":"Atcelt","create_topic":"Izveidot tēmu","create_pm":"Ziņa","title":"Vai nospiediet Ctrl+Enter","users_placeholder":"Pievienot lietotāju","title_placeholder":"Aprakstiet šis diskusijas saturu īsā teikumā!","title_or_link_placeholder":"Ierakstiet nosaukumu vai ievietojiet šeit saiti","edit_reason_placeholder":"kāpēc jūs rediģējat?","topic_featured_link_placeholder":"Ievadiet saiti, kas redzama virsrakstā.","reply_placeholder":"Rakstiet šeit. Izmantojiet Markdown, BBCode, vai HTML formatēšanai. Velciet vai ielīmējiet bildes.","view_new_post":"Apskatīt jūsu jauno ierakstu.","saving":"Saglabā","saved":"Saglabāts!","uploading":"Augšuplādē...","show_preview":"rādīt priekšskatījumu \u0026raquo;","hide_preview":"\u0026laquo; slēpt priekšskatījumu","quote_post_title":"Citēt visu ierakstu","bold_label":"B","bold_title":"Treknraksts","bold_text":"treknrakstā","italic_label":"I","italic_title":"Uzsvars","italic_text":"Uzsvērts teksts","link_title":"Saite","link_description":"ievadiet saites aprakstu šeit","link_dialog_title":"Ievietojiet saiti","link_optional_text":"neobligāts nosaukums","quote_title":"Bloka citāts","quote_text":"Ierakstiet bloka citāta saturu","code_title":"Formatēts teksts","code_text":"piešķirt formatētajam tekstam 4 atstarpju atkāpi","paste_code_text":"ierakstiet vai ielīmējiet formatēto tekstu šeit","upload_title":"Augšupielādēt","upload_description":"pievienojiet faila aprakstu","olist_title":"Numurēts saraksts","ulist_title":"Nenumurēts saraksts","list_item":"Saraksta punkts","help":"Palīdzība ar formatēšanu, izmantojot Markdown","modal_ok":"Labi","modal_cancel":"Atcelt","cant_send_pm":"Atvainojiet, jūs nevarat sūtīt ziņu %{username}.","yourself_confirm":{"title":"Vai jūs aizmirsāt pievienot saņēmējus?","body":"Šobrīd šī ziņa tiek sūtīta tikai jums!"},"admin_options_title":"Papildus tēmas iestatījumi darbiniekiem","composer_actions":{"reply":"Atbilde","edit":"Labot","create_topic":{"label":"Jauna tēma"}},"details_title":"Kopsavilkums"},"notifications":{"title":"paziņojumi par @vārda pieminēšanu, atbildēm uz jūsu ierakstiem un tēmām, ziņām, utt.","none":"Pašlaik neizdodas ielādēt paziņojumus.","empty":"Nav atrasti paziņojumi.","popup":{"mentioned":"{{username}} pieminēja jūs \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} pieminēja jūs \"{{topic}}\" - {{site_title}}","quoted":"{{username}} citēja jūs \"{{topic}}\" - {{site_title}}","replied":"{{username}} atbildēja jums \"{{topic}}\" - {{site_title}}","posted":"{{username}} ierakstīja \"{{topic}}\" - {{site_title}}","linked":"{{username}} ievietoja saiti uz jūsu ierakstu no \"{{topic}}\" - {{site_title}}"},"titles":{"watching_first_post":"Jauna tēma"}},"upload_selector":{"title":"Pievienot attēlu","title_with_attachments":"Pievienot attēlu vai failu","from_my_computer":"No manas ierīces","from_the_web":"No interneta","remote_tip":"saite uz attēlu","remote_tip_with_attachments":"saite uz attēlu vai failu {{authorized_extensions}}","local_tip":"izvēlēties attēlus no jūsu ierīces","local_tip_with_attachments":"izvēlēties attēlus vai failus no jūsu ierīces {{authorized_extensions}}","hint":"(Jūs varat arī augšuplādēt failus, ievelkot tos redaktorā)","hint_for_supported_browsers":"Jūs varat arī ievilkt vai ielīmēt redaktorā attēlus","uploading":"Augšuplādē","select_file":"Izvēlēties failu"},"search":{"sort_by":"Kārtot pēc","relevance":"Nozīmīgums","latest_post":"Jaunākais ieraksts","latest_topic":"Jaunākā tēma","most_viewed":"Visvairāk skatīts","most_liked":"Visvairāk atzinību","select_all":"Izvēlēties visu","clear_all":"Noņemt visus","too_short":"Jūsu meklēšanas frāze ir pārāk īsa.","title":"meklēt tēmās, ierakstos, lietotājos vai kategorijās","no_results":"Nav rezultātu.","no_more_results":"Vairāk nav rezultātu.","searching":"Meklējam...","post_format":"#{{post_number}} - {{username}}","more_results":"Ir vēl vairāk rezultātu. Lūdzu precizējiet meklēšanas kritērijus.","search_google_button":"Google","search_google_title":"Meklēt šajā vietnē","context":{"user":"Meklēt ierakstus ar @{{username}}","category":"Meklēt #{{category}} sadaļā","topic":"Meklēt šai tēmā","private_messages":"Meklēt ziņās"},"advanced":{"title":"Izvērstā meklēšana","posted_by":{"label":"Ierakstīja"},"in_group":{"label":"Grupā"},"with_badge":{"label":"Ar žetonu"},"filters":{"likes":"Man patika","posted":"Es ierakstīju","watching":"Es skatos","tracking":"Es sekoju","first":"ir tēmas pirmais ieraksts","pinned":"ir piesprausts","unpinned":"nav piesprausts","unseen":"neesmu izlasījis","wiki":"ir wiki"},"statuses":{"label":"Kur tēmas","open":"ir atvērtas","closed":"ir slēgtas","archived":"ir arhivētas","noreplies":"ir bez atbildēm","single_user":"ir rakstījis tikai viens lietotājs"},"post":{"count":{"label":"Minimālais ierakstu skaits"},"time":{"label":"Ierakstīts","before":"līdz","after":"pēc"}}}},"hamburger_menu":"iet uz citu tēmu sarakstu vai sadaļu","new_item":"jauns","go_back":"atgriezties","not_logged_in_user":"lietotāja lapa ar pēdējo aktivitāšu un iestatījumu vēsturi","current_user":"doties uz jūsu lietotāja lapu","topics":{"new_messages_marker":"pēdējais apmeklējums","bulk":{"select_all":"Izvēlēties visu","clear_all":"Noņemt visu","unlist_topics":"Izņemt no sarakstiem tēmas","relist_topics":"Atkal padarīt tēmas redzamas sarakstiem","reset_read":"Noņemt statusus \"lasīts\"","delete":"Dzēst tēmas","dismiss":"Nerādīt","dismiss_read":"Nerādīt visu neizlasīto","dismiss_button":"Nerādīt...","dismiss_tooltip":"Nerādīt tikai jaunos ierakstus vai pārtraukt sekot tēmām","also_dismiss_topics":"Pārtraukt sekot šīm tēmām, lai tās man vairs nekad nerādītos kā neizlasītas","dismiss_new":"Nerādīt jaunus","toggle":"darbības ar vairākām tēmām","actions":"Darbības ar vairumu","change_category":"Norādīt sadaļu","close_topics":"Slēgt tēmas","archive_topics":"Arhivēt tēmas","notification_level":"Paziņojumi","choose_new_category":"Izvēlēties jaunu sadaļu šīm tēmām:","selected":{"zero":"Jūs izvēlējāties \u003cb\u003e0.\u003c/b\u003e tēmas.","one":"Jūs izvēlējāties \u003cb\u003e%{count}.\u003c/b\u003e tēmu.","other":"Jūs izvēlējāties \u003cb\u003e{{count}}\u003c/b\u003e tēmas."},"change_tags":"Aizvietot tagus","append_tags":"Pievienot tagus","choose_new_tags":"Izvēlēties jaunus tagus šīm tēmām:","choose_append_tags":"Izvēlēties jaunas birkas, ko pievienot šīm tēmām:","changed_tags":"Šo tēmu tagi tika mainīti."},"none":{"unread":"Jums nav nelasītu tēmu.","new":"Jums nav jaunu tēmu.","read":"Jūs vēl neesat izlasījuši nevienu tēmu.","posted":"Jūs vel neesat rakstījuši nevienā tēmā.","latest":"Nav jaunu tēmu. Neraža.","bookmarks":"Jūs vēl neesat pievienojuši grāmatzīmēm nevienu tēmu.","category":"Sadaļā {{category}} nav tēmu.","top":"Nav svarīgu tēmu.","educate":{"new":"\u003cp\u003eJūsu jaunās tēmas parādās šeit.\u003c/p\u003e \u003cp\u003ePēc noklusējuma tēmas tiek uzskatītas par jaunām un parādīsies \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003ejauns\u003c/span\u003e indikators, ja tās tika izveidotas pēdējo 2 dienu laikā.\u003c/p\u003e \u003cp\u003eTo var izmainīt jūsu \u003ca href=\"%{userPrefsUrl}\"\u003eiestatījumos\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eJūsu nelasītās tēmas parādās šeit.\u003c/p\u003e\u003cp\u003ePēc noklusējuma tēmas tiek uzskatītas par nelasītām un tiks uzskaitītas \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e ja jūs:\u003c/p\u003e\u003cul\u003e\u003cli\u003eIzveidojāt tēmu\u003c/li\u003e\u003cli\u003eAtbildējāt tēmā\u003c/li\u003e\u003cli\u003eLasījāt tēmu vairāk nekā 4 minūtes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eVai jūs atzīmējāt Sekot vai Skatī tēmas apakšā.\u003c/p\u003e\u003cp\u003eTo var izmainīt jūsu \u003ca href=\"%{userPrefsUrl}\"\u003eiestatījumos\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Vairāk jaunāko tēmu nav. ","posted":"Vairāk publicēto tēmu nav. ","read":"Vairāk lasīto tēmu nav. ","new":"Vairāk jauno tēmu nav. ","unread":"Vairāk nelasīto tēmu nav. ","category":"Vairāk sadaļās {{category}} tēmu nav. ","top":"Vairāk svarīgu tēmu nav. ","bookmarks":"Vairāk grāmatzīmēs ievietoto tēmu nav. "}},"topic":{"filter_to":{"zero":"tēmā ziņu nav","one":"%{count} ziņa tēmā","other":"{{count}} ziņas tēmā"},"create":"Jauna tēma","create_long":"Izveidot jaunu tēmu ","private_message":"Rakstīt ziņu ","archive_message":{"help":"Pārvietot ziņu uz arhīvu ","title":"Arhīvs"},"move_to_inbox":{"title":"Pārvietot uz iesūtni","help":"Atgriezt ziņu uz iesūtni "},"defer":{"title":"Nepiekrist"},"list":"Tēmas","new":"Jauna tēma","unread":"nelasīti","new_topics":{"zero":"Jaunu tēmu nav","one":"%{count} jauna tēma","other":"{{count}} jaunas tēmas "},"unread_topics":{"zero":"Nelasītu tēmu nav","one":"%{count} nelasīta tēma","other":"{{count}} nelasītas tēmas"},"title":"Tēma","invalid_access":{"title":"Šī tēma ir privāta ","description":"Atvainojiet, jums nav pieejas šai tēmai!","login_required":"Jums jāieiet forumā, lai redzētu tēmu."},"server_error":{"title":"Tēmu neizdevās ielādēt","description":"Atvainojiet, nevarējām ielādēt šo tēmu, iespējams, saistībā ar savienojuma problēmu. Lūdzu mēģiniet vēlreiz. Ja problēma atkārtojas, dodiet mums ziņu."},"not_found":{"title":"Tēma nav atrasta ","description":"Atvainojiet, šo tēmu neatradām. Varbūt to noņēma moderators? "},"total_unread_posts":{"zero":"Tev šajā tēmā nav neizlasītu ziņojumu","one":"Tev šajā tēmā ir %{count} neizlasīts ziņojums","other":"Tev šajā tēmā ir {{count}} neizlasītu ziņojumu "},"unread_posts":{"zero":"Tev šajā tēmā nav vecu neizlasītu ziņojumu","one":"Tev šajā tēmā ir %{count} vecs neizlasīts ziņojums","other":"Tev šajā tēmā ir {{count}} vecu neizlasītu ziņojumu. "},"new_posts":{"zero":"Šajā tēmā nav jaunu nelasītu ziņojumu","one":"Šajā tēmā ir %{count} jauns nelasīts ziņojums","other":"Šajā tēmā ir {{count}} jauni nelasīti ziņojumi"},"likes":{"zero":"Šai tēmai nav \"patīk\"","one":"Šai tēmai ir viens \"patīk\"","other":"Šai tēmā ir {{count}} atzinības"},"back_to_list":"Atpakaļ pie tēmu saraksta ","options":"Tēmas iestatījumi ","show_links":"rādīt saites šajā tēmā","toggle_information":"rādīt / slēpt tēmas informāciju ","read_more_in_category":"Vēlies lasīt vēl? Pārlūko citas tēmas: {{catLink}} vai {{latestLink}}.","read_more":"Vēlies lasīt vēl? {{catLink}} or {{latestLink}}.","browse_all_categories":"Pārlūkot visas sadaļas","view_latest_topics":"Skatīt jaunākās tēmas","suggest_create_topic":"Kādēļ gan neizveidot jaunu tēmu? ","jump_reply_up":"pāriet uz agrāku atbildi","jump_reply_down":"pāriet uz vēlāku atbildi ","deleted":"Tēma ir dzēsta ","topic_status_update":{"save":"Uzstādīt taimeri ","num_of_hours":"Stundu skaits:","remove":"Noņemt taimeri","publish_to":"Publicēt: ","when":"Kad:"},"auto_update_input":{"later_today":"Vēlāk šodien","tomorrow":"Rītdien","later_this_week":"Vēlāk šonedēļ","this_weekend":"Šajā nedēļas nogalē","next_week":"Nākamā nedēļā","next_month":"Nākamā mēnesī","pick_date_and_time":"Izvēlēties datumu un laiku ","set_based_on_last_post":"Aizvērt, balstoties uz pēdējo ziņojumu "},"publish_to_category":{"title":"Ieplānot publicēšanu "},"temp_open":{"title":"Atvērts uz laiku "},"auto_reopen":{"title":"Automātiski atvērt tēmu "},"temp_close":{"title":"Aizvērt uz laiku "},"auto_close":{"title":"Automātiski aizvērt tēmu ","label":"Automātiski aizvērt tēmas stundas","error":"Lūdzu ievadiet derīgu vērtību ","based_on_last_post":"Neaizvērt, līdz pēdējais ziņojums šajā tēmā ir vismaz tik vecs. "},"auto_delete":{"title":"Automātiski dzēst tēmu "},"reminder":{"title":"Atgādināt man"},"status_update_notice":{"auto_open":"Šo tēmu automātiski atvērs %{timeLeft}.","auto_close":"Šo tēmu automātiski slēgs %{timeLeft}.","auto_publish_to_category":"Šo tēmu publicēs \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"Šo tēmu slēgs %{duration} pēc pēdējās atbildes.","auto_delete":"Šo tēmu automātiski dzēsīs pēc %{timeLeft}.","auto_reminder":"Jums atgādinās par šo tēmu pēc %{timeLeft}."},"auto_close_title":"Automātiskās slēgšanas iestatījumi","auto_close_immediate":{"zero":"Pēdējais ieraksts tēmā ir %{count} stundas vecs, tāpēc tēma tiks slēgta nekavējoties.","one":"Pēdējais ieraksts tēmā ir %{count} stundu vecs, tāpēc tēma tiks slēgta nekavējoties.","other":"Pēdējais ieraksts tēmā ir %{count} stundas vecs, tāpēc tēma tiks slēgta nekavējoties."},"timeline":{"back":"Atpakaļ","back_description":"Atgriezties pie pēdējā nelasītā ieraksta","replies_short":"%{current} / %{total}"},"progress":{"title":"tēmas progress","go_top":"pāriet uz augšu","go_bottom":"pāriet uz leju","go":"doties","jump_bottom":"pāriet pie pēdējā ieraksta","jump_prompt":"pāriet pie...","jump_prompt_of":"no %{count} ierakstiem","jump_bottom_with_number":"pāriet pie ieraksta %{post_number}","jump_prompt_or":"vai","total":"kopējais ierakstu skaits","current":"šis ieraksts"},"notifications":{"title":"izmainīt to, cik bieži jūs saņemsiet paziņojumus par šo temu","reasons":{"mailing_list_mode":"Jums ir ieslēgts vēstkopas ieraksts, tāpēc par atbildēm šai tēmā ziņosim e-pastā.","3_10":"Jūs saņemsiet paziņojumus, jo novērojat tagu, kas ir šai tēmai.","3_6":"Jūs saņemsiet paziņojumus, jo novērojat šo sadaļu.","3_5":"Jūs saņemsiet paziņojumus, jo sākāt novērot šo tēmu automātiski.","3_2":"Jūs saņemsiet paziņojumus, jo novērojat šo tēmu.","3_1":"Jūs saņemsiet paziņojumus, jo izveidojāt šo tēmu.","3":"Jūs saņemsiet paziņojumus, jo jūs novērojat šo tēmu.","2_8":"Jūs redzēsiet jauno atbilžu skaitu, jo sekojat šai sadaļai.","2_4":"Jūs redzēsiet jauno atbilžu skaitu, jo atbildējāt šajā tēmā.","2_2":"Jūs redzēsiet jauno atbilžu skaitu, jo jūs sekojat šai tēmai.","2":"Jūs redzēsiet jauno atbilžu skaitu, jo jūs \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003elasījāt šo tēmu\u003c/a\u003e.","1_2":"Jūs saņemsiet paziņojumu, ja kāds pieminēs jūsu vārdu paziņos, ja @pseidonīmu vai atbildēs jums.","1":"Jūs saņemsiet paziņojumu, ja kāds pieminēs jūsu vārdu paziņos, ja @pseidonīmu vai atbildēs jums.","0_7":"Nesaņemt nekādus paziņojumus par šo sadaļu.","0_2":"Nesaņemt nekādus paziņojumus par šo tēmu.","0":"Nesaņemt nekādus paziņojumus par šo tēmu."},"watching_pm":{"title":"Novērot","description":"Jums paziņos par katru jaunu atbildi šai ziņai un rādīs jauno atbilžu skaitu."},"watching":{"title":"Novērot","description":"Jums paziņos par katru jaunu atbildi šai tēmā un rādīs jauno atbilžu skaitu."},"tracking_pm":{"title":"Sekot","description":"Parādīs jauno atbilžu skaitu šai ziņai. Jums paziņos, ja kāds pieminēs jūsu @lietotājvārdu vai atbildēs jums."},"tracking":{"title":"Sekot","description":"Parādīs jauno atbilžu skaitu šai tēmā. Jums paziņos, ja kāds pieminēs jūsu @lietotājvārdu vai atbildēs jums."},"regular":{"title":"Normāls","description":"Jums paziņos, ja kāds pieminēs jūsu @lietotājvārdu vai atbildēs jums."},"regular_pm":{"title":"Normāls","description":"Jums paziņos, ja kāds pieminēs jūsu @lietotājvārdu vai atbildēs jums."},"muted_pm":{"title":"Klusināts","description":"Jūs par šo ziņu nesaņemsiet nekādus paziņojumus."},"muted":{"title":"Klusināts","description":"Jūs par šo tēmu nesanemsiet nekādus paziņojumus, un tā neparādīsies pēdējās tēmās."}},"actions":{"title":"Darbības","recover":"Atcelt tēmas dzēšanu","delete":"Dzēst tēmu","open":"Atvērt tēmu","close":"Slēgt tēmu","multi_select":"Izvēlēties ierakstus...","timed_update":"Iestatīt tēmas taimeri","pin":"Piespraust tēmu...","unpin":"Atspraust tēmu...","unarchive":"Izņemt tēmu no arhīva","archive":"Arhivēt tēmu","invisible":"Izņemt tēmu no sarakstiem","visible":"Atgriezt tēmu sarakstos","reset_read":"Atstatīt visu kā nelasītu","make_public":"Izveidot publisku tēmu"},"feature":{"pin":"Piespraust tēmu","unpin":"Atspraust tēmu","pin_globally":"Piespraust tēmu globāli","make_banner":"Banera tēma","remove_banner":"Noņemt banera tēmu"},"reply":{"title":"Atbildēt","help":"sākt rakstīt atbildi šai tēmai"},"clear_pin":{"title":"Noņemt piespraušanu","help":"Noņemt šai tēmai statusu 'piesprausta', lai tā vairs neparādītos jūsu tēmu saraksta augšgalā"},"share":{"title":"Dalīties","help":"dalīties ar saiti uz so tēmu"},"print":{"title":"Drukāt","help":"Atvērt šīs tēmas drukas versiju"},"flag_topic":{"title":"Ziņot","help":"privāti atzīmēt šo tēmu vai nosūtīt privāti ziņojumu par to","success_message":"Jūs veiksmīgi ziņojāt par šo tēmu."},"feature_topic":{"title":"Novietot šo tēmu augšgalā","pin":"Nostiprināt šo tēmu sadaļas {{categoryLink}} augšgalā līdz","confirm_pin":"Jums jau ir {{count}} piespraustas tēmas. Pārāk daudz piespraustu tēmu ir apgrūtinājums jauniem un anonīmiem lietotājiem. Vai jūs esat drošs, ka vēlaties piespraust vēl vienu tēmu šajā sadaļā.","unpin":"Noņemt šo tēmu no sadaļas {{categoryLink}} augšgala.","unpin_until":"Noņemt šo tēmu no sadaļas {{categoryLink}} augšgala vai gaidīt līdz \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Lietotāji var atspraust tēmu, katrs sev personīgi.","pin_validation":"Lai piespraustu šo tēmu, ir nepieciešams datums.","not_pinned":"Sadaļā {{categoryLink}} nav piespraustu tēmu.","already_pinned":{"zero":"Sadaļā {{categoryLink}} šobrīd nav piespraustu tēmu","one":"Sadaļā {{categoryLink}} šobrīd piesprausta {{count}} tēma","other":"Sadaļā {{categoryLink}} šobrīd piespraustas \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e tēmas"},"pin_globally":"Likt šai tēmai parādīties visu tēmu sarakstu augšgalos līdz","confirm_pin_globally":"Jums jau ir {{count}} globāli piespraustas tēmas. Pārāk daudz piespraustu tēmu ir apgrūtinājums jauniem un anonīmiem lietotājiem. Vai jūs esat drošs, ka vēlaties globāli piespraust vēl vienu tēmu.","unpin_globally":"Noņemt šo tēmu no visu tēmu sarakstu augšgaliem.","unpin_globally_until":"Noņemt šo tēmu no visu tēmu sarakstu augšgaliem vai gaidīt līdz \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Lietotāji var atspraust tēmu, katrs sev personīgi.","not_pinned_globally":"Nav nevienas globāli piespraustas tēmas.","already_pinned_globally":{"zero":"Šobrīd globāli piespraustas \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e tēmas","one":"Šobrīd globāli piesprausta \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e tēma","other":"Šobrīd globāli piespraustas \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e tēmas"},"make_banner":"Pārveidot šo tēmu par baneri, kas parādīsies visu lapu augšpusē.","remove_banner":"Noņemt baneri, kas parādās visu lapu augšpusē.","banner_note":"Lietotāji var noņemt baneri, aizverot to. Jebkurā brīdī tikai viena tēma var būt par baneri.","no_banner_exists":"Nav tēmas, kas būtu baneris.","banner_exists":"Šobrīd \u003cstrong class='badge badge-notification unread'\u003eir\u003c/strong\u003e tēma, ko izmanto banerī."},"inviting":"Ielūdzam...","automatically_add_to_groups":"Šis ielūgums ietver arī piekļuvi šīm grupām:","invite_private":{"title":"Ielūgums rakstīt ziņas","email_or_username":"Ielūdzamā e-pasts vai lietotājvārds","email_or_username_placeholder":"e-pasta adrese vai lietotāja vārds","action":"Ielūgt","success":"Mēs esam ielūguši šo lietotāju piedalīties šai diskusijā.","success_group":"Mēs esam ielūguši šo grupu piedalīties šai diskusijā.","error":"Atvainojiet, ielūdzot šo lietotāju, notika kļūda.","group_name":"grupas nosaukums"},"controls":"Tēmas pārvaldīšana","invite_reply":{"title":"Ielūgt","username_placeholder":"lietotājvārds","action":"Nosūtīt ielūgumu","help":"Ielūgt citus uz šo tēmu, izmantojot e-pastu vai paziņojumus","to_forum":"Mēs nosūtīsim īsu e-pastu, kas ļaus jūsu draugam nekavējoties pievienoties, uzklikšķinot uz saites un bez ienākšanas forumā.","sso_enabled":"Ievadiet personas, ko vēlētos ielūgt šai tēmā, lietotājvārdu.","to_topic_blank":"Ievadiet personas, ko vēlētos ielūgt šai tēmā, lietotājvārdu vai e-pastu.","to_topic_email":"Jūs esat ievadījis e-pasta adresi. Mēs nosūtīsim e-pastā ielūgumu, kas ļaus jūsu draugam nekavējoties atbildēt šai tēmā.","to_topic_username":"Jūs esat ievadījis lietotājvārdu. Mēs nosūtīsim paziņojumu ar saiti, kas ļaus pievienoties šai tēmai.","to_username":"Ievadiet personas, ko vēlētos ielūgt, lietotājvārdu. Mēs nosūtīsim paziņojumu ar saiti, kas ļaus pievienoties šai tēmai.","email_placeholder":"vards@piemers.com","success_email":"Mēs nosūtījām ielūguma e-pastu uz \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Mēs paziņosim jums, kad ielūgums būs izmantots. Pārbaudiet ielūgumu cilni jūsu lietotāja lapā, lai sekotu līdzi savu ielūgumu statusiem.","success_username":"Mēs ielūdzām šo lietotāju piedalīties šai tēmā.","error":"Atvainojiet, mēs nevarējām ielūgt šo cilvēku. Varbūt jau ir nosūtīts ielūgums?","success_existing_email":"Jau pastāv lietotājs ar e-pastu \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Mēs ielūdzām šo lietotāju piedalīties šai tēmā."},"login_reply":"Lai atbildētu, ienāc forumā","filters":{"n_posts":{"zero":"{{count}} ieraksti","one":"%{count} ieraksts","other":"{{count}} ieraksti"},"cancel":"Noņemt filtru"},"split_topic":{"title":"Pārvietot uz jaunu tēmu","action":"pārvietot uz jaunu tēmu","radio_label":"Jauna tēma","error":"Pārvietojot ierakstus uz jauno tēmu, notika kļūda.","instructions":{"zero":"Jūs tūlīt izveidosiet jaunu tēmu bez ierakstiem.","one":"Jūs tūlīt izveidosiet jaunu tēmu ar izvēlēto ierakstu.","other":"Jūs tūlīt izveidosiet jaunu tēmu un aizpildīsiet to ar \u003cb\u003e{{count}}\u003c/b\u003e izvēlētajiem ierakstiem."}},"merge_topic":{"title":"Pārvietot uz esošu tēmu","action":"pārvietot uz esošu tēmu","error":"Pārvietojot ierakstus uz šo tēmu, notika kļūda.","instructions":{"zero":"Lūdzu izvēlieties tēmu, uz kuru vēlaties pārvietot šos ierakstus.","one":"Lūdzu izvēlieties tēmu, uz kuru vēlaties pārvietot šo ierakstu.","other":"Lūdzu izvēlieties tēmu, uz kuru vēlaties pārvietot šos \u003cb\u003e{{count}}\u003c/b\u003e ierakstus."}},"move_to_new_message":{"radio_label":"Jauns ziņa"},"merge_posts":{"title":"Apvienot izvēlētos ierakstus","action":"apvienot izvēlētos ierakstus","error":"Apvienojot izvēlētos ierakstus, notika kļūda."},"change_owner":{"action":"nomainīt īpašnieku","error":"Mainot ierakstu īpašnieku, notika kļūda.","placeholder":"jaunā īpašnieka lietotājvārds"},"change_timestamp":{"title":"Nomainīt laika zīmogu...","action":"nomainīt laika zīmogu","invalid_timestamp":"Laika zīmogs nevar būt nākotnē.","error":"Mainot ieraksta laika zīmogu, notika kļūda.","instructions":"Lūdzu izvēlieties tēmas jauno laika zīmogu. Tēmas ieraksti tiks atjaunināti, ņemot vērā attiecīgo laika starpību."},"multi_select":{"select":"izvēlēties","selected":"izvēlēti ({{count}})","select_post":{"label":"izvēlēties"},"select_replies":{"label":"izvēlēties +atbildes"},"delete":"dzēst izvēlētos","cancel":"atcelt izvēlēšanos","select_all":"izvēlēties visu","deselect_all":"visiem noņemt izvēli","description":{"zero":"Jūs esat izvēlējies \u003cb\u003e0\u003c/b\u003e ierakstu.","one":"Jūs esat izvēlējies \u003cb\u003e%{count}\u003c/b\u003e ierakstu.","other":"Jūs esat izvēlējies \u003cb\u003e{{count}}\u003c/b\u003e ierakstus."}}},"post":{"quote_reply":"Citāts","edit_reason":"Iemesls:","post_number":"ieraksts {{number}}","wiki_last_edited_on":"wiki pēdējo reizi rediģēta","last_edited_on":"ieraksts pēdējo reizi rediģēts","reply_as_new_topic":"Atbildēt jaunā saistītā tēmā","reply_as_new_private_message":"Atbildēt jaunā vēstulē tiem pašiem adresātiem","continue_discussion":"Turpinot diskusiju no {{postLink}}:","follow_quote":"doties uz citēto ierakstu","show_full":"Parādīt visu ierakstu","deleted_by_author":{"zero":"(autors atcēlis ierakstu, tas tiks automātiski dzēsts pēc %{count} stundām, ja neviens nav ziņojis par to)","one":"(autors atcēlis ierakstu, tas tiks automātiski dzēsts pēc %{count} stundas, ja neviens nav ziņojis par to)","other":"(autors atcēlis ierakstu, tas tiks automātiski dzēsts pēc %{count} stundām, ja neviens nav ziņojis par to)"},"expand_collapse":"paplašināt/minimizēt","gap":{"zero":"apslēpt {{count}} slēptās atbildes","one":"aplūjot %{count} slēpto atbildi","other":"aplūkot {{count}} slēptās atbildes"},"notice":{"new_user":"Šis ir pirmais {{user}} ieraksts — sagaidīsim viņu mūsu kopienā!"},"unread":"Ieraksts nav lasīts","has_replies":{"zero":"{{count}} atbildes","one":"{{count}} atbilde","other":"{{count}} atbildes"},"has_likes_title":{"zero":"{{count}} cilvēkiem patika šis ieraksts","one":"%{count} cilvēkam patika šis ieraksts","other":"{{count}} cilvēkiem patika šis ieraksts"},"has_likes_title_only_you":"jums patika šis ieraksts","has_likes_title_you":{"zero":"jums patika šis ieraksts","one":"jums un %{count} citam cilvēkam patika šis ieraksts","other":"jums un {{count}} citiem cilvēkiem patika šis ieraksts"},"errors":{"create":"Atvainojiet, izveidojot jūsu ierakstu, notika kļūda. Lūdzu, mēģiniet vēlreiz.","edit":"Atvainojiet, rediģējot jūsu ierakstu, notika kļūda. Lūdzu, mēģiniet vēlreiz.","upload":"Atvainojiet, augšuplādējot šo failu, notika kļūda. Lūdzu, mēģiniet vēlreiz.","too_many_uploads":"Atvainojiet, jūs varat augšuplādēt tikai vienu failu vienā reizē.","upload_not_authorized":"Atvainojiet, fails, ko mēģināt augšuplādēt, nav atļauts (atļautie paplašinājumi: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Atvainojiet, jaunie lietotāji nevar augšuplādēt attēlus.","attachment_upload_not_allowed_for_new_user":"Atvainojiet, jaunie lietotāji nevar augšuplādēt pielikumus.","attachment_download_requires_login":"Atvainojiet, jums jābūt ienākušam forumā, lai varētu lejuplādēt pielikumus."},"abandon_edit":{"no_value":"Nē, paturēt"},"abandon":{"confirm":"Vai esat drošs, ka vēlaties atteikties no sava ieraksta?","no_value":"Nē, paturēt","yes_value":"Jā, pamest"},"via_email":"šis ieraksts atnāca e-pastā","via_auto_generated_email":"šis ieraksts atnāca automātiski ģenerētā e-pastā","whisper":"šis ieraksts ir privāts čuksts moderatoriem","wiki":{"about":"šis ieraksts ir wiki"},"archetypes":{"save":"Saglabāšanas iespējas"},"few_likes_left":"Paldies par dalīšanos ar atzinību! Jums šodien ir palikušas tikai dažas iespējas izteikt atzinību.","controls":{"reply":"sākt rakstīt atbildi šim ierakstam","like":"patīk šis ieraksts","has_liked":"jums patika šis ieraksts","undo_like":"atcelt atzinību","edit":"rediģēt šo ierakstu","edit_action":"Rediģēt","edit_anonymous":"Atvainojiet, bet jums jāienāk forumā, lai rediģētu šo ierakstu.","flag":"privāti ziņot par šo ierakstu vai nosūtīt privātu paziņojumu par to","delete":"dzēst šo ierakstu","undelete":"atcelt šī ieraksta dzēšanu","share":"dalīties ar saiti uz šo ierakstu","more":"Vairāk","delete_replies":{"just_the_post":"Nē, tikai šo ierakstu"},"admin":"ieraksta administratora darbības","wiki":"Pārveidot par wiki ierakstu","unwiki":"Noņemt wiki statusu","convert_to_moderator":"Pievienot darbinieka krāsu","revert_to_regular":"Noņemt darbinieka krāsu","rebake":"Pārbūvēt HTML","unhide":"Noņemt slēpšanu","change_owner":"Mainīt īpašnieku","grant_badge":"Piešķirt Žetonu","delete_topic":"Dzēst tēmu"},"actions":{"flag":"Ziņot","undo":{"off_topic":"Atcelt ziņošanu","spam":"Atcelt ziņošanu","inappropriate":"Atcelt ziņošanu","bookmark":"Atcelt grāmatzīmi","like":"Atcelt atzinību"},"people":{"off_topic":"ziņot par šo kā novirzīšanos no tēmas","spam":"ziņot par šo kā spamu","inappropriate":"ziņot par šo kā nepiedienīgu","notify_moderators":"paziņoja moderatoriem","notify_user":"nosūtīja ziņu","bookmark":"pievienoja grāmatzīmēm"},"by_you":{"off_topic":"Jūs ziņojāt par šo kā novirzīšanos no tēmas","spam":"Jūs ziņojāt par šo kā spamu","inappropriate":"Jūs ziņojāt par šo kā nepiedienīgu","notify_moderators":"Jūs ziņojāt par šo moderācijai","notify_user":"Jūs nosūtījāt ziņu šim lietotājam","bookmark":"Jūs pievienojāt šo ierakstu grāmatzīmēm","like":"Jūs izteicāt atzinību šim"}},"merge":{"confirm":{"zero":"Vai jūs esat drošs, ka vēlaties apvienot šos {{count}} ierakstus?","one":"Vai jūs esat drošs, ka vēlaties apvienot šos ierakstus?","other":"Vai jūs esat drošs, ka vēlaties apvienot šos {{count}} ierakstus?"}},"revisions":{"controls":{"first":"Pirmā versija","previous":"Iepriekšējā versija","next":"Nākamā versija","last":"Pēdējā versija","hide":"Paslēpt versiju","show":"Parādīt versiju","revert":"Atgriezties pie šīs versijas","edit_wiki":"Rediģēt wiki","edit_post":"Rediģēt ierakstu"},"displays":{"inline":{"button":"HTML"},"side_by_side":{"button":"HTML"},"side_by_side_markdown":{"title":"Parādīt izejas koda atšķirības"}}},"raw_email":{"displays":{"text_part":{"title":"Parādīt e-pasta teksta daļu","button":"Teksts"},"html_part":{"title":"Parādīt e-pasta html daļu","button":"HTML"}}},"bookmarks":{"name":"Vārds"}},"category":{"can":"var\u0026hellip;","none":"(nav sadaļas)","all":"Visas sadaļas","edit":"Labot","view":"Aplūkot sadaļas ierakstus","general":"Vispārīgi","settings":"Iestatījumi","topic_template":"Tēmas šablons","tags":"Tagi","tags_placeholder":"(Pēc izvēles) atļauto tagu saraksts","tag_groups_placeholder":"(Pēc izvēles) atļauto tagu grupu saraksts","delete":"Dzēst sadaļu","create":"Jauna sadaļa","create_long":"Izveidot jaunu sadaļu","save":"Saglabāt sadaļu","creation_error":"Izveidojot šo sadaļu, notika kļūda.","save_error":"Saglabājot šo sadaļu, notika kļūda.","name":"Sadaļas nosaukums","description":"Apraksts","topic":"sadaļas tema","logo":"Sadaļas logo attēls","background_image":"Sadaļas fona attēls","badge_colors":"Žetona krāsas","background_color":"Fona krāsa","foreground_color":"Priekšplāna krāsa","name_placeholder":"Ne vairāk par vienu vai diviem vārdiem","color_placeholder":"Jebkura interneta krāsa","delete_confirm":"Vai tiešām vēlies dzēst šo kategoriju?","delete_error":"Dzēšot šo sadaļu, notika kļūda.","list":"Uzskaitīt sadaļas","no_description":"Lūdzu, pievieno aprakstu šai sadaļai.","change_in_category_topic":"Rediģēt aprakstu","already_used":"Šī krāsa ir izmantota citai sadaļai","security":"Drošība","special_warning":"Brīdinājums: šī sadaļa ir automātiski izveidota un tās drošības uzstādījumi nav maināmi. Ja jūs nevēlaties šo sadaļu izmantot, izdzēsiet to, nevis pielietojiet citiem mērķiem.","images":"Attēli","email_in_allow_strangers":"Pieņemt e-pastus no anonīmiem lietotājiem bez profiliem","email_in_disabled":"Jaunu tēmu ievietošana, izmantojot e-pastu, ir atcelta foruma iestatījumos. Lai atļautu ievietot jaunas tēmas, izmantojot e-pastu,","show_subcategory_list":"Rādīt apakšsadaļu sarakstu virs tēmām šai sadaļā.","num_featured_topics":"Sadaļu lapā parādīto tēmu skaits:","subcategory_list_style":"Apakšsadaļu saraksta stils:","sort_order":"Kārtot tēmu sarakstu pēc:","default_view":"Noklusējuma tēmu saraksts:","default_top_period":"Noklusējuma topa periods:","allow_badges_label":"Atļaut apbalvot ar žetoniem šai sadaļā","edit_permissions":"Mainīt atļaujas","review_group_name":"grupas nosaukums","this_year":"šogad","default_position":"Noklusētā pozīcija","position_disabled":"Sadaļas tiks sakārtotas pēc aktivitātes. Lai kontrolētu sadaļu secību sarakstos,","position_disabled_click":"ieslēgt iestatījumu \"fiksētas sadaļu pozīcijas\".","parent":"Vecāksadaļa","notifications":{"watching":{"title":"Novērošana","description":"Jūs automātiski novērosiet visas tēmas šajās sadaļās. Jums paziņos par katru jaunu ierakstu katrā tēmā, kā arī parādīs jauno atbilžu skaitu."},"watching_first_post":{"title":"Novērot pirmo ierakstu"},"tracking":{"title":"Sekošana","description":"Jūs automātiski sekosiet visām tēmām šajās sadaļās. Jums paziņos, ja kāds pieminēs jūsu @lietotājvārdu vai atbildēs jums, kā arī parādīs jauno atbilžu skaitu."},"regular":{"title":"Normāls","description":"Jums paziņos, ja kāds pieminēs jūsu @lietotājvārdu vai atbildēs jums."},"muted":{"title":"Noklusināts","description":"Jums neko neziņos par jaunajām tēmām šajās sadaļās, kā arī tās neparādīsies starp pēdējām izmaiņām."}},"search_priority":{"options":{"normal":"Normāls","ignore":"Ignorēt"}},"sort_options":{"default":"noklusējuma","likes":"Atzinības","op_likes":"Oriģinālā ieraksta atzinības","views":"Skatījumi","posts":"Ieraksti","activity":"Aktivitāte","posters":"Plakāti","category":"Sadaļas","created":"Izveidots"},"sort_ascending":"Augoši","sort_descending":"Dilstoši","subcategory_list_styles":{"rows":"Rindas","rows_with_featured_topics":"Rindas ar labākajām tēmām","boxes":"Kastes","boxes_with_featured_topics":"Kastes ar labākajām tēmām"},"settings_sections":{"general":"Vispārīgi","email":"E-pasts"}},"flagging":{"title":"Paldies, ka palīdzat uzturēt mūsu forumu civilizētu!","action":"Ziņot par ierakstu","notify_action":"Ziņa","official_warning":"Oficiāls brīdinājums","delete_spammer":"Dzēst spamotāju","yes_delete_spammer":"Jā, izdzēst spameri","ip_address_missing":"(N/A)","hidden_email_address":"(paslēpts)","submit_tooltip":"Paziņot privāti","take_action_tooltip":"Sasniegt ziņojumu robežu uzreiz, nevis gaidīt vēl ziņojumus no lietotājiem","cant":"Atvainojiet, šobrīd jūs nevarat ziņot par šo ierakstu.","notify_staff":"Ziņot darbiniekiem privāti","formatted_name":{"off_topic":"Nav saistīts ar tēmu","inappropriate":"Tas ir nepiedienīgs","spam":"Spams"},"custom_placeholder_notify_user":"Esi specifisks, konstruktīvs un vienmēr esi laipns.","custom_placeholder_notify_moderators":"Ļaujiet mums uzzināt, kādu problēmu saredzat, un sniedziet būtiskās saites un piemērus, ja iespējams.","custom_message":{"at_least":{"zero":"ievadiet vismaz {{count}} simbolus","one":"ievadiet vismaz %{count} simbolu","other":"ievadiet vismaz {{count}} simbolus"},"more":{"zero":"vēl {{count}}...","one":"vēl %{count}","other":"vēl {{count}}..."},"left":{"zero":"palikuši {{count}}","one":"palicis %{count}","other":"palikuši {{count}}"}}},"flagging_topic":{"title":"Paldies, ka palīdzat uzturēt mūsu forumu civilizētu!","action":"Ziņot par tēmu","notify_action":"Ziņa"},"topic_map":{"title":"Tēmas kopsavilkums","participants_title":"Bieži rakstītāji","links_title":"Populāras saites","links_shown":"parādīt papildus saites...","clicks":{"zero":"%{count} klikšķi","one":"%{count} klikšķis","other":"%{count} klikšķi"}},"post_links":{"title":{"zero":"vēl %{count}","one":"vēl %{count}","other":"vēl %{count}"}},"topic_statuses":{"warning":{"help":"Šis ir oficiāls brīdinājums."},"bookmarked":{"help":"Jūs pievienojāt šo ierakstu grāmatzīmēm"},"locked":{"help":"Šī tēma ir slēgta; tā vairs nepieņem jaunas atbildes"},"archived":{"help":"Šī tēma ir arhivēta; tā ir iesaldēta un nevar tikt mainīta"},"locked_and_archived":{"help":"Šī tēma ir slēgta un arhivēta; tā vairs nepieņem jaunas atbildes un nevar tikt mainīta"},"unpinned":{"title":"Atsprausts","help":"Jums šī tēma ir atsprausta; tā parādīsies parastajā secībā"},"pinned_globally":{"title":"Piesprausts globāli","help":"Šī tēma ir piesprausta globāli; tā parādīsies pēdējo tēmu saraksta un savas sadaļas augšgalā"},"pinned":{"title":"Piesprausts","help":"Jums šī tēma ir piesprausta; tā parādīsies savas sadaļas augšgalā"},"unlisted":{"help":"Šī tēma nav iekļauta sarakstos; tā netiks attēlota tēmu sarakstos, un piekļūt tai varēs, tikai izmantojot tiešu saiti"}},"posts":"Ieraksti","posts_long":"šai tēmā ir {{number}} ieraksts","original_post":"Oriģinālais ieraksts","views":"Skatījumi","views_lowercase":{"zero":"skatījumi","one":"skatījums","other":"skatījumi"},"replies":"Atbildes","views_long":{"zero":"šo tēmu ir apskatījuši {{number}} reizes","one":"šo tēmu ir apskatījuši %{count} reizi","other":"šo tēmu ir apskatījuši {{number}} reizes"},"activity":"Aktivitāte","likes":"Patīk","likes_lowercase":{"zero":"atzinības","one":"atzinība","other":"atzinības"},"likes_long":"šajā tēmā ir {{number}} atzinības","users":"Lietotāji","users_lowercase":{"zero":"lietotāji","one":"lietotājs","other":"lietotāji"},"category_title":"Sadaļa","history":"Vēsture","changed_by":"{{author}}","raw_email":{"title":"Ienākošie e-pasti","not_available":"Nav pieejams!"},"categories_list":"Sadaļu saraksts","filters":{"with_topics":"%{filter} tēmas","with_category":"%{filter} Sadaļas %{category} tēmas","latest":{"title":"Pēdējie","title_with_count":{"zero":"Pēdējie ({{count}})","one":"Pēdējais (%{count})","other":"Pēdējie ({{count}})"},"help":"tēmas ar neseniem ierakstiem"},"read":{"title":"Lasīts","help":"Jūsu lasītās tēmas tajā secībā, kādā lasījāt"},"categories":{"title":"Sadaļas","title_in":"Kategorija - {{categoryName}}","help":"visas tēmas, sagrupētas pēc sadaļām"},"unread":{"title":"Nelasīts","title_with_count":{"zero":"Nelasīti ({{count}})","one":"Nelasīts (%{count})","other":"Nelasīti ({{count}})"},"help":"tēmas, kuras novērojat vai kurām sekojat, ar nelasītiem ierakstiem","lower_title_with_count":{"zero":"{{count}} nelasītas","one":"%{count} nelasīta","other":"{{count}} nelasītas"}},"new":{"lower_title_with_count":{"zero":"{{count}} jaunas","one":"%{count} jauna","other":"{{count}} jaunas"},"lower_title":"jaunie","title":"Jaunie","title_with_count":{"zero":"Jaunie ({{count}})","one":"Jauns (%{count})","other":"Jaunie ({{count}})"},"help":"pēdējās dažās dienās izveidotās tēmas"},"posted":{"title":"Mani ieraksti","help":"tēmas, kurās esat rakstījis"},"bookmarks":{"title":"Grāmatzīmes","help":"tēmas, kurās esat veicis grāmatzīmes"},"category":{"title":"{{categoryName}}","title_with_count":{"zero":"{{categoryName}} ({{count}})","one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"pēdējās tēmas sadaļā {{categoryName}}"},"top":{"title":"Populārākās","help":"visaktīvākās tēmas pēdējā gada, mēneša, nedēļas vai dienas laikā","all":{"title":"Visa laika"},"yearly":{"title":"Gada"},"quarterly":{"title":"Ceturkšņa"},"monthly":{"title":"Mēneša"},"weekly":{"title":"Nedēļas"},"daily":{"title":"Dienas"},"all_time":"Visa laika","this_year":"Gada","this_quarter":"Ceturkšņa","this_month":"Mēneša","this_week":"Nedēļas","today":"Šodienas","other_periods":"skatīt topu"}},"permission_types":{"full":"Izveidot / Atbildēt / Skatīt","create_post":"Atbildēt / Skatīt","readonly":"Skatīt"},"lightbox":{"download":"lejuplādēt"},"keyboard_shortcuts_help":{"title":"Klaviatūras saīsnes","jump_to":{"title":"Pāriet uz","home":"%{shortcut} Sākums","latest":"%{shortcut} Pēdējais","new":"%{shortcut} Jaunākais","unread":"%{shortcut} Nelasītais","categories":"%{shortcut} Sadaļas","top":"%{shortcut} Populārākais","bookmarks":"%{shortcut} Grāmatzīmes","profile":"%{shortcut} Profils","messages":"%{shortcut} Ziņas"},"navigation":{"title":"Pārvietošanās","jump":"%{shortcut} Doties uz ierakstu #","back":"%{shortcut} Atgriezties","up_down":"%{shortcut} Pārvietot atlasīto \u0026uarr; \u0026darr;","open":"%{shortcut} Atvērt izvēlēto tēmu","next_prev":"%{shortcut} Nākamā/iepriekšējā sadaļa"},"application":{"title":"Lietotne","create":"%{shortcut} Izveidot jaunu tēmu","notifications":"%{shortcut} Atvērt paziņojumus","user_profile_menu":"%{shortcut} Atvērt lietotaja menu","show_incoming_updated_topics":"%{shortcut} Parādīt tēmas ar izmaiņām","help":"%{shortcut} Atvērt klaviatūras palīdzību","dismiss_new_posts":"%{shortcut} Ignorēt jauno/ierakstus","dismiss_topics":"%{shortcut} Ignorēt tēmas","log_out":"%{shortcut} Iziet no foruma"},"actions":{"title":"Darbības","bookmark_topic":"%{shortcut} Mainīt tēmas grāmatzīmes statusu","pin_unpin_topic":"%{shortcut} Piespraust/atspraust tēmu","share_topic":"%{shortcut} Dalīties ar tēmu","share_post":"%{shortcut} Dalīties ar ierakstu","reply_as_new_topic":"%{shortcut} Atbildēt ar saistītu tēmu","reply_topic":"%{shortcut} Atbildēt tēmai","reply_post":"%{shortcut} Atbildēt ierakstam","quote_post":"%{shortcut} Citēt ierakstu","like":"%{shortcut} Izteikt atzinību ierakstam","flag":"%{shortcut} Ziņot par ierakstu","bookmark":"%{shortcut} Pievienot ierakstu grāmatzīmēm","edit":"%{shortcut} Rediģēt ierakstu","delete":"%{shortcut} Dzēst ierakstu","mark_muted":"%{shortcut} Klusināt ierakstu","mark_regular":"%{shortcut} Parasta tēma","mark_tracking":"%{shortcut} Sekot tēmai","mark_watching":"%{shortcut} Novērot tēmu","print":"%{shortcut} Drukāt tēmu"}},"badges":{"earned_n_times":{"zero":"Nopelnīja šo žetonu %{count} reizes","one":"Nopelnīja šo žetonu %{count} reizi","other":"Nopelnīja šo žetonu %{count} reizes"},"granted_on":"Piešķirts %{date}","others_count":"Citi ar šo žetonu (%{count})","title":"Žetoni","allow_title":"Jūs varat izmantot šo žetonu kā titulu","multiple_grant":"Jūs esat nopelnījis šo vairākkārt","badge_count":{"zero":"%{count} žetoni","one":"%{count} žetons","other":"%{count} žetoni"},"granted":{"zero":"%{count} piešķirti","one":"%{count} piešķirts","other":"%{count} piešķirti"},"select_badge_for_title":"Izvēlieties žetonu, ko lietot kā jūsu titulu","none":"(neviens)","badge_grouping":{"getting_started":{"name":"Uzsākt darbu"},"community":{"name":"Kopiena"},"trust_level":{"name":"Uzticības līmenis"},"other":{"name":"Citi"},"posting":{"name":"Ieraksti"}}},"tagging":{"all_tags":"Visi tagi","selector_all_tags":"visi tagi","selector_no_tags":"bez tagiem","changed":"mainītie tagi:","tags":"Tagi","add_synonyms":"Pievienot","delete_tag":"Dzēst tagu","rename_tag":"Pārsaukt tagu","rename_instructions":"Izvēlēties jaunu nosaukumu tagam:","sort_by":"Kārtot pēc:","sort_by_count":"skaita","sort_by_name":"vārda","manage_groups":"Pārvaldīt tagu grupas","manage_groups_description":"Izveidot grupas, lai organizētu tagus","cancel_delete_unused":"Atcelt","filters":{"without_category":"%{filter} %{tag} tēmas","with_category":"%{filter} %{tag} tēmas sadaļā %{category}","untagged_without_category":"%{filter} tēmas bez tagiem","untagged_with_category":"%{filter} tēmas bez tagiem sadaļā %{category}"},"notifications":{"watching":{"title":"Novērošana"},"watching_first_post":{"title":"Pirmā ieraksta novērošana"},"tracking":{"title":"Sekošana"},"regular":{"title":"Regulārs","description":"Jums paziņos, ja kāds pieminēs jūsu @lietotājvārdu vai atbildēs uz jūsu ierakstu."},"muted":{"title":"Klusināts"}},"groups":{"title":"Tagu grupas","about":"Pievieno tagus grupām, lai vieglāk tos pārvaldītu.","new":"Jauna grupa","tags_label":"Tagi šai grupā:","parent_tag_label":"Vecāktags:","parent_tag_placeholder":"Pēc izvēles","parent_tag_description":"Tagus no šīs grupas nevar izmantot, ja vien neizmanto arī vecāktagu","one_per_topic_label":"No šīs grupas atļaut tikai vienu tagu vienā tēmā","new_name":"Jauna tagu grupa","save":"Saglabāt","delete":"Dzēst","confirm_delete":"Vai jūs esat drošs, ka vēlaties dzēst šo tagu grupu?"},"topics":{"none":{"unread":"Jums nav nelasītu tēmu.","new":"Jums nav jaunu tēmu.","read":"Jūs vēl neesat lasījis nevienu tēmu.","posted":"Jūs vēl neesat rakstījis nevienā tēmā.","latest":"Nav pēdējo tēmu.","bookmarks":"Jūs vēl neesat pievienojis nevienu tēmu grāmatzīmēm.","top":"Nav populāru tēmu."},"bottom":{"latest":"Vairāk pēdējo tēmu nav.","posted":"Vairāk publicētu tēmu nav.","read":"Vairāk lasītu tēmu nav.","new":"Vairāk jaunu tēmu nav.","unread":"Vairāk nelasītu tēmu nav.","top":"Vairāk populāru tēmu nav.","bookmarks":"Vairāk tēmu grāmatzīmēs nav."}}},"invite":{"custom_message_placeholder":"Ievadi savu ziņas tekstu","custom_message_template_forum":"Sveiks, Tev ir jāpievienojas šim forumam!","custom_message_template_topic":"Sveiks, man šķiet, ka Tu varētu izbaudīt šo tēmu!"},"safe_mode":{"enabled":"Ir ieslēgts drošais režīms; lai pamestu drošo režīmu, aizveriet šo pārlūkprogrammas logu"},"discourse_local_dates":{"create":{"form":{"date_title":"Datums","time_title":"Laiks"}}},"poll":{"cast-votes":{"label":"Balso tagad!"},"show-results":{"title":"Parādīt aptaujas rezultātus","label":"Rādīt rezultātus"},"hide-results":{"title":"Atpakaļ pie balsojumiem"},"export-results":{"label":"Eksportēt"},"open":{"title":"Atvērt aptauju","label":"Atvērt"},"close":{"title":"Aizvērt aptauju","label":"Aizvērt"}}}},"en_US":{"js":{"dates":{"time_short_day":"ddd, h:mm a"}}},"en":{"js":{"dates":{"tiny":{"less_than_x_minutes":{"one":"\u003c %{count}m","other":"\u003c %{count}m"},"x_months":{"one":"%{count}mon","other":"%{count}mon"}},"medium_with_ago":{"x_months":{"one":"%{count} month ago","other":"%{count} months ago"},"x_years":{"one":"%{count} year ago","other":"%{count} years ago"}}},"action_codes":{"private_topic":"made this topic a personal message %{when}","user_left":"%{who} removed themselves from this message %{when}","autobumped":"automatically bumped %{when}","forwarded":"forwarded the above email"},"topic_admin_menu":"topic actions","bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email summary emails enabled. This will be automatically turned off when %{min_users} users have joined.","bootstrap_mode_disabled":"Bootstrap mode will be disabled within 24 hours.","themes":{"broken_theme_alert":"Your site may not work because theme / component %{theme} has errors. Disable it at %{path}."},"s3":{"regions":{"ca_central_1":"Canada (Central)","cn_northwest_1":"China (Ningxia)","eu_north_1":"EU (Stockholm)","eu_west_3":"EU (Paris)","sa_east_1":"South America (São Paulo)","us_gov_east_1":"AWS GovCloud (US-East)","us_gov_west_1":"AWS GovCloud (US-West)"}},"go_ahead":"Go ahead","conduct":"Code of Conduct","related_messages":{"see_all":"See \u003ca href=\"%{path}\"\u003eall messages\u003c/a\u003e from @%{username}..."},"about":{"stat":{"last_7_days":"Last 7","last_30_days":"Last 30"}},"bookmarks":{"not_bookmarked":"bookmark this post","created_with_reminder":"you've bookmarked this post with a reminder at %{date}","confirm_clear":"Are you sure you want to clear all your bookmarks from this topic?","no_timezone":"You have not set a timezone yet. You will not be able to set reminders. Set one up \u003ca href=\"%{basePath}/my/preferences/profile\"\u003ein your profile\u003c/a\u003e.","reminders":{"at_desktop":"Next time I'm at my desktop","later_today":"Later today \u003cbr/\u003e{{date}}","next_business_day":"Next business day \u003cbr/\u003e{{date}}","tomorrow":"Tomorrow \u003cbr/\u003e{{date}}","next_week":"Next week \u003cbr/\u003e{{date}}","next_month":"Next month \u003cbr/\u003e{{date}}","custom":"Custom date and time"}},"drafts":{"new_topic":"New topic draft","new_private_message":"New private message draft","topic_reply":"Draft reply","abandon":{"confirm":"You already opened another draft in this topic. Are you sure you want to abandon it?"}},"topic_count_latest":{"one":"See {{count}} new or updated topic","other":"See {{count}} new or updated topics"},"topic_count_unread":{"one":"See {{count}} unread topic","other":"See {{count}} unread topics"},"topic_count_new":{"one":"See {{count}} new topic","other":"See {{count}} new topics"},"uploading_filename":"Uploading: {{filename}}...","clipboard":"clipboard","pasting":"Pasting...","pwa":{"install_banner":"Do you want to \u003ca href\u003einstall %{title} on this device?\u003c/a\u003e"},"choose_topic":{"title":{"search":"Search for a Topic","placeholder":"type the topic title, url or id here"}},"choose_message":{"none_found":"No messages found.","title":{"search":"Search for a Message","placeholder":"type the message title, url or id here"}},"review":{"in_reply_to":"in reply to","explain":{"why":"explain why this item ended up in the queue","title":"Reviewable Scoring","formula":"Formula","subtotal":"Subtotal","min_score_visibility":"Minimum Score for Visibility","score_to_hide":"Score to Hide Post","take_action_bonus":{"name":"took action","title":"When a staff member chooses to take action the flag is given a bonus."},"user_accuracy_bonus":{"name":"user accuracy","title":"Users whose flags have been historically agreed with are given a bonus."},"trust_level_bonus":{"name":"trust level","title":"Reviewable items created by higher trust level users have a higher score."},"type_bonus":{"name":"type bonus","title":"Certain reviewable types can be assigned a bonus by staff to make them a higher priority."}},"claim_help":{"optional":"You can claim this item to prevent others from reviewing it.","required":"You must claim items before you can review them.","claimed_by_you":"You've claimed this item and can review it.","claimed_by_other":"This item can only be reviewed by \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"claim this topic"},"unclaim":{"help":"remove this claim"},"awaiting_approval":"Awaiting Approval","settings":{"priorities":{"title":"Reviewable Priorities"}},"moderation_history":"Moderation History","grouped_by_topic":"Grouped by Topic","none":"There are no items to review.","view_pending":"view pending","topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval","other":"This topic has \u003cb\u003e{{count}}\u003c/b\u003e posts pending approval"},"title":"Review","filtered_topic":"You have filtered to reviewable content in a single topic.","user":{"bio":"Bio","website":"Website"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flags)"},"agreed":{"one":"{{count}}% agree","other":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree","other":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore","other":"{{count}}% ignore"}},"topics":{"reported_by":"Reported by","details":"details","unique_users":{"one":"%{count} user","other":"{{count}} users"}},"replies":{"one":"%{count} reply","other":"{{count}} replies"},"new_topic":"Approving this item will create a new topic","filters":{"all_categories":"(all categories)","type":{"title":"Type","all":"(all types)"},"minimum_score":"Minimum Score:","orders":{"priority_asc":"Priority (reverse)","created_at":"Created At","created_at_asc":"Created At (reverse)"},"priority":{"title":"Minimum Priority","low":"(any)","medium":"Medium","high":"High"}},"conversation":{"view_full":"view full conversation"},"scores":{"about":"This score is calculated based on the trust level of the reporter, the accuracy of their previous flags, and the priority of the item being reported.","score":"Score","type":"Type","submitted_by":"Submitted By","reviewed_by":"Reviewed By"},"statuses":{"approved":{"title":"Approved"},"ignored":{"title":"Ignored"},"deleted":{"title":"Deleted"},"reviewed":{"title":"(all reviewed)"},"all":{"title":"(everything)"}},"types":{"reviewable_flagged_post":{"title":"Flagged Post","flagged_by":"Flagged By"},"reviewable_queued_topic":{"title":"Queued Topic"},"reviewable_queued_post":{"title":"Queued Post"}},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending.","other":"You have \u003cstrong\u003e{{count}}\u003c/strong\u003e posts pending."}}},"groups":{"member_added":"Added","member_requested":"Requested at","add_members":{"description":"Manage the membership of this group","usernames":"Usernames"},"requests":{"title":"Requests","accept":"Accept","accepted":"accepted","deny":"Deny","denied":"denied","undone":"request undone"},"manage":{"title":"Manage","interaction":{"title":"Interaction","notification":"Notification"},"membership":{"access":"Access"}},"empty":{"requests":"There are no membership requests for this group."},"join":"Join","leave":"Leave","confirm_leave":"Are you sure you want to leave this group?","allow_membership_requests":"Allow users to send membership requests to group owners (Requires publicly visible group)","membership_request_template":"Custom template to display to users when sending a membership request","membership_request":{"submit":"Submit Request","title":"Request to join @%{group_name}","reason":"Let the group owners know why you belong in this group"},"index":{"filter":"Filter by group type","owner_groups":"Groups I own","close_groups":"Closed Groups","automatic_groups":"Automatic Groups","public_groups":"Public Groups","close_group":"Close Group","group_type":"Group type","is_group_user":"Member","is_group_owner":"Owner"},"members":{"filter_placeholder_admin":"username or email","remove_member":"Remove Member","remove_member_description":"Remove \u003cb\u003e%{username}\u003c/b\u003e from this group","make_owner":"Make Owner","make_owner_description":"Make \u003cb\u003e%{username}\u003c/b\u003e an owner of this group","remove_owner":"Remove as Owner","remove_owner_description":"Remove \u003cb\u003e%{username}\u003c/b\u003e as an owner of this group","owner":"Owner","forbidden":"You're not allowed to view the members."},"alias_levels":{"mentionable":"Who can @mention this group?","messageable":"Who can message this group?","owners_mods_and_admins":"Only group owners, moderators and admins"},"notifications":{"watching_first_post":{"description":"You will be notified of new messages in this group but not replies to the messages."},"muted":{"description":"You will not be notified of anything about messages in this group."}},"flair_url_description":"Use square images no smaller than 20px by 20px or FontAwesome icons (accepted formats: \"fa-icon\", \"far fa-icon\" or \"fab fa-icon\")."},"user_action_groups":{"15":"Drafts"},"categories":{"topic_stat_sentence_week":{"one":"%{count} new topic in the past week.","other":"%{count} new topics in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month.","other":"%{count} new topics in the past month."},"n_more":"Categories (%{count} more) ..."},"ip_lookup":{"powered_by":"using \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"copied"},"user":{"user_notifications":{"ignore_duration_title":"Ignore Timer","ignore_duration_note":"Please note that all ignores are automatically removed after the ignore duration expires.","ignore_duration_time_frame_required":"Please select a time frame","ignore_no_users":"You have no ignored users.","ignore_option":"Ignored","ignore_option_title":"You will not receive notifications related to this user and all of their topics and replies will be hidden.","mute_option_title":"You will not receive any notifications related to this user.","normal_option_title":"You will be notified if this user replies to you, quotes you, or mentions you."},"feature_topic_on_profile":{"open_search":"Select a New Topic","title":"Select a Topic","search_label":"Search for Topic by title","clear":{"warning":"Are you sure you want to clear your featured topic?"}},"profile_hidden":"This user's public profile is hidden.","timezone":"Timezone","desktop_notifications":{"label":"Live Notifications","consent_prompt":"Do you want live notifications when people reply to your posts?"},"dynamic_favicon":"Show counts on browser icon","theme_default_on_all_devices":"Make this the default theme on all my devices","text_size_default_on_all_devices":"Make this the default text size on all my devices","allow_private_messages":"Allow other users to send me personal messages","enable_defer":"Enable defer to mark topics unread","featured_topic":"Featured Topic","silenced_tooltip":"This user is silenced","suspended_permanently":"This user is suspended.","mailing_list_mode":{"warning":"Mailing list mode enabled. Email notification settings are overridden."},"muted_categories_instructions":"You will not be notified of anything about new topics in these categories, and they will not appear on the categories or latest pages.","muted_categories_instructions_dont_hide":"You will not be notified of anything about new topics in these categories.","delete_yourself_not_allowed":"Please contact a staff member if you wish your account to be deleted.","ignored_users":"Ignored","ignored_users_instructions":"Suppress all posts and notifications from these users.","api_last_used_at":"Last used at:","home":"Default Home Page","staged":"Staged","second_factor_backup":{"title":"Two Factor Backup Codes","enable_long":"Enable backup codes","manage":"Manage backup codes. You have \u003cstrong\u003e{{count}}\u003c/strong\u003e backup codes remaining.","remaining_codes":"You have \u003cstrong\u003e{{count}}\u003c/strong\u003e backup codes remaining.","use":"Use a backup code","enable_prerequisites":"You must enable a primary second factor before generating backup codes.","codes":{"title":"Backup Codes Generated","description":"Each of these backup codes can only be used once. Keep them somewhere safe but accessible."}},"second_factor":{"title":"Two Factor Authentication","enable":"Manage Two Factor Authentication","forgot_password":"Forgot password?","confirm_password_description":"Please confirm your password to continue","rate_limit":"Please wait before trying another authentication code.","enable_description":"Scan this QR code in a supported app (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) and enter your authentication code.\n","disable_description":"Please enter the authentication code from your app","show_key_description":"Enter manually","short_description":"Protect your account with one-time use security codes.\n","extended_description":"Two factor authentication adds extra security to your account by requiring a one-time token in addition to your password. Tokens can be generated on \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e and \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e devices.\n","oauth_enabled_warning":"Please note that social logins will be disabled once two factor authentication has been enabled on your account.","use":"Use Authenticator app","enforced_notice":"You are required to enable two factor authentication before accessing this site.","disable":"disable","disable_title":"Disable Second Factor","disable_confirm":"Are you sure you want to disable all second factors?","edit_title":"Edit Second Factor","edit_description":"Second Factor Name","enable_security_key_description":"When you have your physical security key prepared press the Register button below.","totp":{"title":"Token-Based Authenticators","add":"New Authenticator","default_name":"My Authenticator"},"security_key":{"register":"Register","title":"Security Keys","add":"Register Security Key","default_name":"Main Security Key","not_allowed_error":"The security key registration process either timed out or was cancelled.","already_added_error":"You have already registered this security key. You don’t have to register it again.","edit":"Edit Security Key","edit_description":"Security Key Name"}},"change_username":{"confirm":"Are you absolutely sure you want to change your username?"},"change_email":{"success_staff":"We've sent an email to your current address. Please follow the confirmation instructions."},"change_avatar":{"gravatar_failed":"We could not find a Gravatar with that email address."},"change_profile_background":{"title":"Profile Header","instructions":"Profile headers will be centered and have a default width of 1110px."},"change_featured_topic":{"title":"Featured Topic","instructions":"A link to this topic will be on your user card, and profile."},"email":{"primary":"Primary Email","secondary":"Secondary Emails","no_secondary":"No secondary emails","sso_override_instructions":"Email can be updated from SSO provider.","instructions":"Never shown to the public."},"associated_accounts":{"title":"Associated Accounts","connect":"Connect","not_connected":"(not connected)","confirm_modal_title":"Connect %{provider} Account","confirm_description":{"account_specific":"Your %{provider} account '%{account_description}' will be used for authentication.","generic":"Your %{provider} account will be used for authentication."}},"auth_tokens":{"title":"Recently Used Devices","log_out_all":"Log out all","active":"active now","not_you":"Not you?","show_all":"Show all ({{count}})","show_few":"Show fewer","was_this_you":"Was this you?","was_this_you_description":"If it wasn’t you, we recommend you change your password and log out everywhere.","browser_and_device":"{{browser}} on {{device}}","secure_account":"Secure my Account","latest_post":"You last posted…"},"hide_profile_and_presence":"Hide my public profile and presence features","enable_physical_keyboard":"Enable physical keyboard support on iPad","title_count_mode":{"title":"Background page title displays count of:","notifications":"New notifications","contextual":"New page content"},"email_digests":{"title":"When I don’t visit here, send me an email summary of popular topics and replies"},"email_level":{"only_when_away":"only when away"},"invited":{"sent":"Last Sent","none":"No invites to display.","rescind_all":"Remove all Expired Invites","rescinded_all":"All Expired Invites removed!","rescind_all_confirm":"Are you sure you want to remove all expired invites?","bulk_invite":{"confirmation_message":"You’re about to email invites to everyone in the uploaded file."}},"summary":{"recent_time_read":"recent read time","likes_given":{"one":"given","other":"given"},"likes_received":{"one":"received","other":"received"},"topics_entered":{"one":"topic viewed","other":"topics viewed"},"top_categories":"Top Categories"}},"too_few_topics_and_posts_notice":"Let's \u003ca href='https://blog.discourse.org/2014/08/building-a-discourse-community/'\u003estart the discussion!\u003c/a\u003e There are \u003cstrong\u003e%{currentTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{currentPosts}\u003c/strong\u003e posts. Visitors need more to read and reply to – we recommend at least \u003cstrong\u003e%{requiredTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{requiredPosts}\u003c/strong\u003e posts. Only staff can see this message.","too_few_topics_notice":"Let's \u003ca href='https://blog.discourse.org/2014/08/building-a-discourse-community/'\u003estart the discussion!\u003c/a\u003e There are \u003cstrong\u003e%{currentTopics}\u003c/strong\u003e topics. Visitors need more to read and reply to – we recommend at least \u003cstrong\u003e%{requiredTopics}\u003c/strong\u003e topics. Only staff can see this message.","too_few_posts_notice":"Let's \u003ca href='https://blog.discourse.org/2014/08/building-a-discourse-community/'\u003estart the discussion!\u003c/a\u003e There are \u003cstrong\u003e%{currentPosts}\u003c/strong\u003e posts. Visitors need more to read and reply to – we recommend at least \u003cstrong\u003e%{requiredPosts}\u003c/strong\u003e posts. Only staff can see this message.","logs_error_rate_notice":{},"time_read_recently":"%{time_read} recently","time_read_tooltip":"%{time_read} total time read","time_read_recently_tooltip":"%{time_read} total time read (%{recent_time_read} in the last 60 days)","signup_cta":{"intro":"Hello! Looks like you’re enjoying the discussion, but you haven’t signed up for an account yet.","value_prop":"When you create an account, we remember exactly what you’ve read, so you always come right back where you left off. You also get notifications, here and via email, whenever someone replies to you. And you can like posts to share the love. :heartpulse:"},"private_message_info":{"invite":"Invite Others ...","leave_message":"Do you really want to leave this message?"},"create_account":{"disclaimer":"By registering, you agree to the \u003ca href='{{privacy_link}}' target='blank'\u003eprivacy policy\u003c/a\u003e and \u003ca href='{{tos_link}}' target='blank'\u003eterms of service\u003c/a\u003e."},"forgot_password":{"complete_username_found":"We found an account that matches the username \u003cb\u003e%{username}\u003c/b\u003e. You should receive an email with instructions on how to reset your password shortly.","complete_email_found":"We found an account that matches \u003cb\u003e%{email}\u003c/b\u003e. You should receive an email with instructions on how to reset your password shortly."},"email_login":{"link_label":"Email me a login link","button_label":"with email","complete_username":"If an account matches the username \u003cb\u003e%{username}\u003c/b\u003e, you should receive an email with a login link shortly.","complete_email":"If an account matches \u003cb\u003e%{email}\u003c/b\u003e, you should receive an email with a login link shortly.","complete_username_found":"We found an account that matches the username \u003cb\u003e%{username}\u003c/b\u003e, you should receive an email with a login link shortly.","complete_email_found":"We found an account that matches \u003cb\u003e%{email}\u003c/b\u003e, you should receive an email with a login link shortly.","logging_in_as":"Logging in as %{email}","confirm_button":"Finish Login"},"login":{"second_factor_title":"Two Factor Authentication","second_factor_description":"Please enter the authentication code from your app:","second_factor_backup":"Log in using a backup code","second_factor_backup_title":"Two Factor Backup","second_factor_backup_description":"Please enter one of your backup codes:","second_factor":"Log in using Authenticator app","security_key_description":"When you have your physical security key prepared press the Authenticate with Security Key button below.","security_key_alternative":"Try another way","security_key_authenticate":"Authenticate with Security Key","security_key_not_allowed_error":"The security key authentication process either timed out or was cancelled.","security_key_no_matching_credential_error":"No matching credentials could be found in the provided security key.","security_key_support_missing_error":"Your current device or browser does not support the use of security keys. Please use a different method.","cookies_error":"Your browser seems to have cookies disabled. You might not be able to log in without enabling them first.","blank_username":"Please enter your email or username.","omniauth_disallow_totp":"Your account has two factor authentication enabled. Please log in with your password.","sent_activation_email_again_generic":"We sent another activation email. It might take a few minutes for it to arrive; be sure to check your spam folder.","second_factor_toggle":{"totp":"Use an authenticator app instead","backup_code":"Use a backup code instead"}},"emoji_set":{"emoji_one":"JoyPixels (formerly EmojiOne)"},"category_page_style":{"categories_and_top_topics":"Categories and Top Topics","categories_boxes":"Boxes with Subcategories","categories_boxes_with_topics":"Boxes with Featured Topics"},"shortcut_modifier_key":{"enter":"Enter"},"category_row":{"topic_count":"{{count}} topics in this category"},"select_kit":{"default_header_text":"Select...","no_content":"No matches found","filter_placeholder":"Search...","filter_placeholder_with_any":"Search or create...","create":"Create: '{{content}}'","max_content_reached":{"one":"You can only select {{count}} item.","other":"You can only select {{count}} items."},"min_content_not_reached":{"one":"Select at least {{count}} item.","other":"Select at least {{count}} items."},"invalid_selection_length":"Selection must be at least {{count}} characters."},"date_time_picker":{"errors":{"to_before_from":"To date must be later than from date."}},"emoji_picker":{"smileys_\u0026_emotion":"Smileys and Emotion","people_\u0026_body":"People and Body","animals_\u0026_nature":"Animals and Nature","food_\u0026_drink":"Food and Drink","travel_\u0026_places":"Travel and Places","activities":"Activities"},"shared_drafts":{"title":"Shared Drafts","notice":"This topic is only visible to those who can see the \u003cb\u003e{{category}}\u003c/b\u003e category.","destination_category":"Destination Category","publish":"Publish Shared Draft","confirm_publish":"Are you sure you want to publish this draft?","publishing":"Publishing Topic..."},"composer":{"edit_conflict":"edit conflict","group_mentioned_limit":"\u003cb\u003eWarning!\u003c/b\u003e You mentioned \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, however this group has more members than the administrator configured mention limit of {{max}} users. Nobody will be notified.","reference_topic_title":"RE: {{title}}","error":{"post_missing":"Post can’t be empty","try_like":"Have you tried the {{heart}} button?","tags_missing":"You must choose at least {{count}} tags","topic_template_not_modified":"Please add details and specifics to your topic by editing the topic template."},"overwrite_edit":"Overwrite Edit","create_whisper":"Whisper","create_shared_draft":"Create Shared Draft","edit_shared_draft":"Edit Shared Draft","remove_featured_link":"Remove link from topic.","reply_placeholder_no_images":"Type here. Use Markdown, BBCode, or HTML to format.","reply_placeholder_choose_category":"Select a category before typing here.","saved_draft":"Post draft in progress. Tap to resume.","link_url_placeholder":"Paste a URL or type to search topics","toggle_direction":"Toggle Direction","collapse":"minimize the composer panel","open":"open the composer panel","abandon":"close composer and discard draft","enter_fullscreen":"enter fullscreen composer","exit_fullscreen":"exit fullscreen composer","composer_actions":{"draft":"Draft","reply_to_post":{"label":"Reply to post %{postNumber} by %{postUsername}","desc":"Reply to a specific post"},"reply_as_new_topic":{"label":"Reply as linked topic","desc":"Create a new topic linked to this topic","confirm":"You have a new topic draft saved, which will be overwritten if you create a linked topic."},"reply_as_private_message":{"label":"New message","desc":"Create a new personal message"},"reply_to_topic":{"label":"Reply to topic","desc":"Reply to the topic, not any specific post"},"toggle_whisper":{"label":"Toggle whisper","desc":"Whispers are only visible to staff members"},"shared_draft":{"label":"Shared Draft","desc":"Draft a topic that will only be visible to staff"},"toggle_topic_bump":{"label":"Toggle topic bump","desc":"Reply without changing latest reply date"}},"details_text":"This text will be hidden"},"notifications":{"tooltip":{"regular":{"one":"%{count} unseen notification","other":"{{count}} unseen notifications"},"message":{"one":"%{count} unread message","other":"{{count}} unread messages"}},"post_approved":"Your post was approved","reviewable_items":"items requiring review","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} other\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"liked {{count}} of your posts","other":"liked {{count}} of your posts"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Earned '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}","membership_request_accepted":"Membership accepted in '{{group_name}}'","membership_request_consolidated":"{{count}} open membership requests for '{{group_name}}'","group_message_summary":{"one":"{{count}} message in your {{group_name}} inbox","other":"{{count}} messages in your {{group_name}} inbox"},"popup":{"private_message":"{{username}} sent you a personal message in \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} created a new topic \"{{topic}}\" - {{site_title}}","confirm_title":"Notifications enabled - %{site_title}","confirm_body":"Success! Notifications have been enabled.","custom":"Notification from {{username}} on %{site_title}"},"titles":{"mentioned":"mentioned","replied":"new reply","quoted":"quoted","edited":"edited","liked":"new like","private_message":"new private message","invited_to_private_message":"invited to private message","invitee_accepted":"invite accepted","posted":"new post","moved_post":"post moved","linked":"linked","granted_badge":"badge granted","invited_to_topic":"invited to topic","group_mentioned":"group mentioned","group_message_summary":"new group messages","topic_reminder":"topic reminder","liked_consolidated":"new likes","post_approved":"post approved","membership_request_consolidated":"new membership requests"}},"upload_selector":{"default_image_alt_text":"image"},"search":{"result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} results for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"full_page_title":"search topics or posts","results_page":"Search results for '{{term}}'","cant_find":"Can’t find what you’re looking for?","start_new_topic":"Perhaps start a new topic?","or_search_google":"Or try searching with Google instead:","search_google":"Try searching with Google instead:","context":{"tag":"Search the #{{tag}} tag"},"advanced":{"in_category":{"label":"Categorized"},"with_tags":{"label":"Tagged"},"filters":{"label":"Only return topics/posts...","title":"Matching in title only","created":"I created","private":"In my messages","bookmarks":"I bookmarked","seen":"I read","images":"include image(s)","all_tags":"All the above tags"},"statuses":{"public":"are public"}}},"view_all":"view all","topic":{"open_draft":"Open Draft","edit_message":{"help":"Edit first post of the message","title":"Edit Message"},"defer":{"help":"Mark as unread"},"feature_on_profile":{"help":"Add a link to this topic on your user card and profile","title":"Feature On Profile"},"remove_from_profile":{"warning":"Your profile already has a featured topic. If you continue, this topic will replace the existing topic.","help":"Remove the link to this topic on your user profile","title":"Remove From Profile"},"group_request":"You need to request membership to the `{{name}}` group to see this topic","group_join":"You need join the `{{name}}` group to see this topic","group_request_sent":"Your group membership request has been sent. You will be informed when it's accepted.","unread_indicator":"No member has read the last post of this topic yet.","topic_status_update":{"title":"Topic Timer","public_timer_types":"Topic Timers","private_timer_types":"User Topic Timers","time_frame_required":"Please select a time frame"},"auto_update_input":{"none":"Select a timeframe","two_weeks":"Two Weeks","two_months":"Two Months","three_months":"Three Months","four_months":"Four Months","six_months":"Six Months","one_year":"One Year","forever":"Forever"},"auto_bump":{"title":"Auto-Bump Topic"},"status_update_notice":{"auto_bump":"This topic will be automatically bumped %{timeLeft}."},"progress":{"jump_prompt_long":"Jump to...","jump_prompt_to_date":"to date"},"actions":{"make_private":"Make Personal Message","reset_bump_date":"Reset Bump Date"},"share":{"extended_title":"Share a link"},"make_public":{"title":"Convert to Public Topic","choose_category":"Please choose a category for the public topic:"},"move_to":{"title":"Move to","action":"move to","error":"There was an error moving posts."},"split_topic":{"topic_name":"New Topic Title"},"merge_topic":{"radio_label":"Existing Topic"},"move_to_new_message":{"title":"Move to New Message","action":"move to new message","message_title":"New Message Title","participants":"Participants","instructions":{"one":"You are about to create a new message and populate it with the post you've selected.","other":"You are about to create a new message and populate it with the \u003cb\u003e{{count}}\u003c/b\u003e posts you've selected."}},"move_to_existing_message":{"title":"Move to Existing Message","action":"move to existing message","radio_label":"Existing Message","participants":"Participants","instructions":{"one":"Please choose the message you'd like to move that post to.","other":"Please choose the message you'd like to move those \u003cb\u003e{{count}}\u003c/b\u003e posts to."}},"change_owner":{"title":"Change Owner","instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Please choose a new owner for the {{count}} posts by \u003cb\u003e@{{old_user}}\u003c/b\u003e"}},"multi_select":{"select_post":{"title":"Add post to selection"},"selected_post":{"label":"selected","title":"Click to remove post from selection"},"select_replies":{"title":"Add post and all its replies to selection"},"select_below":{"label":"select +below","title":"Add post and all after it to selection"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)","other":"(topic withdrawn by author, will be automatically deleted in %{count} hours unless flagged)"}},"post":{"ignored":"Ignored content","show_hidden":"View ignored content.","collapse":"collapse","locked":"a staff member has locked this post from being edited","notice":{"returning_user":"It’s been a while since we’ve seen {{user}} — their last post was {{time}}."},"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then paste the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload {{max}} files at a time."},"abandon_edit":{"confirm":"Are you sure you want to discard your changes?","no_save_draft":"No, save draft","yes_value":"Yes, discard edit"},"abandon":{"no_save_draft":"No, save draft"},"controls":{"read_indicator":"members who read this post","delete_replies":{"confirm":"Do you also want to delete the replies to this post?","direct_replies":{"one":"Yes, and %{count} direct reply","other":"Yes, and {{count}} direct replies"},"all_replies":{"one":"Yes, and %{count} reply","other":"Yes, and all {{count}} replies"}},"lock_post":"Lock Post","lock_post_description":"prevent the poster from editing this post","unlock_post":"Unlock Post","unlock_post_description":"allow the poster to edit this post","delete_topic_disallowed_modal":"You don't have permission to delete this topic. If you really want it to be deleted, submit a flag for moderator attention together with reasoning.","delete_topic_disallowed":"you don't have permission to delete this topic","add_post_notice":"Add Staff Notice","remove_post_notice":"Remove Staff Notice","remove_timer":"remove timer"},"actions":{"defer_flags":{"one":"Ignore flag","other":"Ignore flags"},"people":{"like":{"one":"liked this","other":"liked this"},"read":{"one":"read this","other":"read this"},"like_capped":{"one":"and {{count}} other liked this","other":"and {{count}} others liked this"},"read_capped":{"one":"and {{count}} other read this","other":"and {{count}} others read this"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?","other":"Are you sure you want to delete those {{count}} posts?"}},"revisions":{"controls":{"comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Show the rendered output with additions and removals inline"},"side_by_side":{"title":"Show the rendered output diffs side-by-side"},"side_by_side_markdown":{"button":"Raw"}}},"raw_email":{"displays":{"raw":{"title":"Show the raw email","button":"Raw"}}},"bookmarks":{"create":"Create bookmark","name_placeholder":"Name the bookmark to help jog your memory","set_reminder":"Set a reminder","actions":{"delete_bookmark":{"name":"Delete bookmark","description":"Removes the bookmark from your profile and stops all reminders for the bookmark"}}}},"category":{"choose":"category\u0026hellip;","edit_dialog_title":"Edit: %{categoryName}","tags_allowed_tags":"Restrict these tags to this category:","tags_allowed_tag_groups":"Restrict these tag groups to this category:","tags_tab_description":"Tags and tag groups specified above will only be available in this category and other categories that also specify them. They won't be available for use in other categories.","manage_tag_groups_link":"Manage tag groups here.","allow_global_tags_label":"Also allow other tags","tag_group_selector_placeholder":"(Optional) Tag group","required_tag_group_description":"Require new topics to have tags from a tag group:","min_tags_from_required_group_label":"Num Tags:","required_tag_group_label":"Tag group:","topic_featured_link_allowed":"Allow featured links in this category","slug":"Category Slug","slug_placeholder":"(Optional) dashed-words for url","uncategorized_security_warning":"This category is special. It is intended as holding area for topics that have no category; it cannot have security settings.","uncategorized_general_warning":"This category is special. It is used as the default category for new topics that do not have a category selected. If you want to prevent this behavior and force category selection, \u003ca href=\"%{settingLink}\"\u003eplease disable the setting here\u003c/a\u003e. If you want to change the name or description, go to \u003ca href=\"%{customizeLink}\"\u003eCustomize / Text Content\u003c/a\u003e.","pending_permission_change_alert":"You haven't added %{group} to this category; click this button to add them.","email_in":"Custom incoming email address:","email_in_disabled_click":"enable the \"email in\" setting.","mailinglist_mirror":"Category mirrors a mailing list","subcategory_num_featured_topics":"Number of featured topics on parent category's page:","all_topics_wiki":"Make new topics wikis by default","reviewable_by_group":"In addition to staff, posts and flags in this category can be also be reviewed by:","require_topic_approval":"Require moderator approval of all new topics","require_reply_approval":"Require moderator approval of all new replies","position":"Position on the categories page:","minimum_required_tags":"Minimum number of tags required in a topic:","num_auto_bump_daily":"Number of open topics to automatically bump daily:","navigate_to_first_post_after_read":"Navigate to first post after topics are read","notifications":{"watching_first_post":{"description":"You will be notified of new topics in this category but not replies to the topics."}},"search_priority":{"label":"Search Priority","options":{"very_low":"Very Low","low":"Low","high":"High","very_high":"Very High"}},"settings_sections":{"moderation":"Moderation","appearance":"Appearance"}},"flagging":{"take_action":"Take Action"},"post_links":{"about":"expand more links for this post"},"topic_statuses":{"personal_message":{"title":"This topic is a personal message"}},"browser_update":"Unfortunately, \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eyour browser is too old to work on this site\u003c/a\u003e. Please \u003ca href=\"https://browsehappy.com\"\u003eupgrade your browser\u003c/a\u003e.","lightbox":{"previous":"Previous (Left arrow key)","next":"Next (Right arrow key)","counter":"%curr% of %total%","close":"Close (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eThe content\u003c/a\u003e could not be loaded.","image_load_error":"\u003ca href=\"%url%\"\u003eThe image\u003c/a\u003e could not be loaded."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} or %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","jump_to":{"drafts":"%{shortcut} Drafts"},"navigation":{"go_to_unread_post":"%{shortcut} Go to the first unread post"},"application":{"hamburger_menu":"%{shortcut} Open hamburger menu","search":"%{shortcut} Search"},"composing":{"title":"Composing","return":"%{shortcut} Return to composer","fullscreen":"%{shortcut} Fullscreen composer"},"actions":{"defer":"%{shortcut} Defer topic","topic_admin_actions":"%{shortcut} Open topic admin actions"}},"badges":{"more_badges":{"one":"+%{count} More","other":"+%{count} More"},"successfully_granted":"Successfully granted %{badge} to %{username}"},"tagging":{"other_tags":"Other Tags","choose_for_topic":"optional tags","info":"Info","default_info":"This tag isn't restricted to any categories, and has no synonyms.","category_restricted":"This tag is restricted to categories you don't have permission to access.","synonyms":"Synonyms","synonyms_description":"When the following tags are used, they will be replaced with \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\".","other":"This tag belongs to these groups: {{tag_groups}}."},"category_restrictions":{"one":"It can only be used in this category:","other":"It can only be used in these categories:"},"edit_synonyms":"Manage Synonyms","add_synonyms_label":"Add synonyms:","add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?","other":"Any place that currently uses these tags will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"add_synonyms_failed":"The following tags couldn't be added as synonyms: \u003cb\u003e%{tag_names}\u003c/b\u003e. Ensure they don't have synonyms and aren't synonyms of another tag.","remove_synonym":"Remove Synonym","delete_synonym_confirm":"Are you sure you want to delete the synonym \"%{tag_name}\"?","delete_confirm":{"one":"Are you sure you want to delete this tag and remove it from %{count} topic it is assigned to?","other":"Are you sure you want to delete this tag and remove it from {{count}} topics it is assigned to?"},"delete_confirm_no_topics":"Are you sure you want to delete this tag?","delete_confirm_synonyms":{"one":"Its synonym will also be deleted.","other":"Its {{count}} synonyms will also be deleted."},"upload":"Upload Tags","upload_description":"Upload a csv file to create tags in bulk","upload_instructions":"One per line, optionally with a tag group in the format 'tag_name,tag_group'.","upload_successful":"Tags uploaded successfully","delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}","other":"%{count} tags will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more","other":"%{tags} and %{count} more"},"delete_unused":"Delete Unused Tags","delete_unused_description":"Delete all tags which are not attached to any topics or personal messages","notifications":{"watching":{"description":"You will automatically watch all topics with this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"description":"You will be notified of new topics in this tag but not replies to the topics."},"tracking":{"description":"You will automatically track all topics with this tag. A count of unread and new posts will appear next to the topic."},"muted":{"description":"You will not be notified of anything about new topics with this tag, and they will not appear on your unread tab."}},"groups":{"tags_placeholder":"tags","name_placeholder":"Tag Group Name","everyone_can_use":"Tags can be used by everyone","usable_only_by_staff":"Tags are visible to everyone, but only staff can use them","visible_only_to_staff":"Tags are visible only to staff"}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a \u003ca href\u003ecustom message\u003c/a\u003e."},"forced_anonymous":"Due to extreme load, this is temporarily being shown to everyone as a logged out user would see it.","discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Start the new user tutorial for all new users","welcome_message":"Send all new users a welcome message with a quick start guide"}},"details":{"title":"Hide Details"},"discourse_local_dates":{"relative_dates":{"today":"Today %{time}","tomorrow":"Tomorrow %{time}","yesterday":"Yesterday %{time}","countdown":{"passed":"date has passed"}},"title":"Insert date / time","create":{"form":{"insert":"Insert","advanced_mode":"Advanced mode","simple_mode":"Simple mode","format_description":"Format used to display the date to the user. Use \"\\T\\Z\" to display the user timezone in words (Europe/Paris)","timezones_title":"Timezones to display","timezones_description":"Timezones will be used to display dates in preview and fallback.","recurring_title":"Recurrence","recurring_description":"Define the recurrence of an event. You can also manually edit the recurring option generated by the form and use one of the following keys: years, quarters, months, weeks, days, hours, minutes, seconds, milliseconds.","recurring_none":"No recurrence","invalid_date":"Invalid date, make sure date and time are correct","format_title":"Date format","timezone":"Timezone","until":"Until...","recurring":{"every_day":"Every day","every_week":"Every week","every_two_weeks":"Every two weeks","every_month":"Every month","every_two_months":"Every two months","every_three_months":"Every three months","every_six_months":"Every six months","every_year":"Every year"}}}},"poll":{"voters":{"one":"voter","other":"voters"},"total_votes":{"one":"total vote","other":"total votes"},"average_rating":"Average rating: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Votes are \u003cstrong\u003epublic\u003c/strong\u003e."},"results":{"groups":{"title":"You need to be a member of %{groups} to vote in this poll."},"vote":{"title":"Results will be shown on \u003cstrong\u003evote\u003c/strong\u003e."},"closed":{"title":"Results will be shown once \u003cstrong\u003eclosed\u003c/strong\u003e."},"staff":{"title":"Results are only shown to \u003cstrong\u003estaff\u003c/strong\u003e members."}},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"cast-votes":{"title":"Cast your votes"},"hide-results":{"label":"Show vote"},"group-results":{"title":"Group votes by user field","label":"Show breakdown"},"ungroup-results":{"title":"Combine all votes","label":"Hide breakdown"},"export-results":{"title":"Export the poll results"},"open":{"confirm":"Are you sure you want to open this poll?"},"close":{"confirm":"Are you sure you want to close this poll?"},"automatic_close":{"closes_in":"Closes in \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Closed \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","error_while_exporting_results":"Sorry, there was an error exporting poll results.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 1 option","invalid_values":"Minimum value must be smaller than the maximum value.","min_step_value":"The minimum step value is 1"},"poll_type":{"label":"Type","regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_result":{"label":"Results","always":"Always visible","vote":"On vote","closed":"When closed","staff":"Staff only"},"poll_groups":{"label":"Allowed groups"},"poll_chart_type":{"label":"Chart type"},"poll_config":{"max":"Max","min":"Min","step":"Step"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"},"automatic_close":{"label":"Automatically close poll"}}},"presence":{"replying":"replying","editing":"editing","replying_to_topic":{"one":"replying","other":"replying"}}}}};
I18n.locale = 'lv';
I18n.pluralizationRules.lv = MessageFormat.locale.lv;
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


    var units = {
        'ss': 'sekundes_sekundēm_sekunde_sekundes'.split('_'),
        'm': 'minūtes_minūtēm_minūte_minūtes'.split('_'),
        'mm': 'minūtes_minūtēm_minūte_minūtes'.split('_'),
        'h': 'stundas_stundām_stunda_stundas'.split('_'),
        'hh': 'stundas_stundām_stunda_stundas'.split('_'),
        'd': 'dienas_dienām_diena_dienas'.split('_'),
        'dd': 'dienas_dienām_diena_dienas'.split('_'),
        'M': 'mēneša_mēnešiem_mēnesis_mēneši'.split('_'),
        'MM': 'mēneša_mēnešiem_mēnesis_mēneši'.split('_'),
        'y': 'gada_gadiem_gads_gadi'.split('_'),
        'yy': 'gada_gadiem_gads_gadi'.split('_')
    };
    /**
     * @param withoutSuffix boolean true = a length of time; false = before/after a period of time.
     */
    function format(forms, number, withoutSuffix) {
        if (withoutSuffix) {
            // E.g. "21 minūte", "3 minūtes".
            return number % 10 === 1 && number % 100 !== 11 ? forms[2] : forms[3];
        } else {
            // E.g. "21 minūtes" as in "pēc 21 minūtes".
            // E.g. "3 minūtēm" as in "pēc 3 minūtēm".
            return number % 10 === 1 && number % 100 !== 11 ? forms[0] : forms[1];
        }
    }
    function relativeTimeWithPlural(number, withoutSuffix, key) {
        return number + ' ' + format(units[key], number, withoutSuffix);
    }
    function relativeTimeWithSingular(number, withoutSuffix, key) {
        return format(units[key], number, withoutSuffix);
    }
    function relativeSeconds(number, withoutSuffix) {
        return withoutSuffix ? 'dažas sekundes' : 'dažām sekundēm';
    }

    var lv = moment.defineLocale('lv', {
        months : 'janvāris_februāris_marts_aprīlis_maijs_jūnijs_jūlijs_augusts_septembris_oktobris_novembris_decembris'.split('_'),
        monthsShort : 'jan_feb_mar_apr_mai_jūn_jūl_aug_sep_okt_nov_dec'.split('_'),
        weekdays : 'svētdiena_pirmdiena_otrdiena_trešdiena_ceturtdiena_piektdiena_sestdiena'.split('_'),
        weekdaysShort : 'Sv_P_O_T_C_Pk_S'.split('_'),
        weekdaysMin : 'Sv_P_O_T_C_Pk_S'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY.',
            LL : 'YYYY. [gada] D. MMMM',
            LLL : 'YYYY. [gada] D. MMMM, HH:mm',
            LLLL : 'YYYY. [gada] D. MMMM, dddd, HH:mm'
        },
        calendar : {
            sameDay : '[Šodien pulksten] LT',
            nextDay : '[Rīt pulksten] LT',
            nextWeek : 'dddd [pulksten] LT',
            lastDay : '[Vakar pulksten] LT',
            lastWeek : '[Pagājušā] dddd [pulksten] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'pēc %s',
            past : 'pirms %s',
            s : relativeSeconds,
            ss : relativeTimeWithPlural,
            m : relativeTimeWithSingular,
            mm : relativeTimeWithPlural,
            h : relativeTimeWithSingular,
            hh : relativeTimeWithPlural,
            d : relativeTimeWithSingular,
            dd : relativeTimeWithPlural,
            M : relativeTimeWithSingular,
            MM : relativeTimeWithPlural,
            y : relativeTimeWithSingular,
            yy : relativeTimeWithPlural
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return lv;

})));

// moment-timezone-localization for lang code: lv

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidžana","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Akra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Adisabeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Alžīra","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangi","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Bandžula","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bisava","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantaira","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazavila","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bužumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Kaira","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Kasablanka","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Seuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Konakri","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakara","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dāresalāma","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Džibutija","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Duala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"Ajūna","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Frītauna","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburga","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Džūba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Hartūma","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinšasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagosa","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Librevila","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lome","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbaši","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputu","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadīšo","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovija","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndžamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niameja","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nuakšota","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Vagadugu","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Portonovo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Santome","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripole","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunisa","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Vindhuka","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adaka","id":"America/Adak"},{"value":"America/Anchorage","name":"Ankurāža","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Angilja","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigva","id":"America/Antigua"},{"value":"America/Araguaina","name":"Aragvaina","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"Larjoha","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Riogaljegosa","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"Sanhuana","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"Sanluisa","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tukumana","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ušuaja","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunsjona","id":"America/Asuncion"},{"value":"America/Bahia","name":"Baija","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bajabanderasa","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbadosa","id":"America/Barbados"},{"value":"America/Belem","name":"Belena","id":"America/Belem"},{"value":"America/Belize","name":"Beliza","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blansablona","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boavista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogota","id":"America/Bogota"},{"value":"America/Boise","name":"Boisisitija","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenosairesa","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Kembridžbeja","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Kampugrandi","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Kankuna","id":"America/Cancun"},{"value":"America/Caracas","name":"Karakasa","id":"America/Caracas"},{"value":"America/Catamarca","name":"Katamarka","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Kajenna","id":"America/Cayenne"},{"value":"America/Cayman","name":"Kaimanu salas","id":"America/Cayman"},{"value":"America/Chicago","name":"Čikāga","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Čivava","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokana","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Kordova","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Kostarika","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Krestona","id":"America/Creston"},{"value":"America/Cuiaba","name":"Kujaba","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Kirasao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Denmārkšavna","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dousona","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dousonkrīka","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denvera","id":"America/Denver"},{"value":"America/Detroit","name":"Detroita","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominika","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmontona","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepe","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"Salvadora","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fortnelsona","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Gleisbeja","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nūka","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Gūsbeja","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grandtkērka","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenāda","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Gvadelupa","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Gvatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Gvajakila","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Gajāna","id":"America/Guyana"},{"value":"America/Halifax","name":"Helifeksa","id":"America/Halifax"},{"value":"America/Havana","name":"Havana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Ermosiljo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Noksa, Indiāna","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiāna","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Pītersbērga, Indiāna","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Telsitija, Indiāna","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vīveja, Indiāna","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vinsensa, Indiāna","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Vinamaka, Indiāna","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolisa","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvika","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Ikaluita","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaika","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Huhuja","id":"America/Jujuy"},{"value":"America/Juneau","name":"Džuno","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Montičelo, Kentuki","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Krālendeika","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"Lapasa","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Losandželosa","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Lūivila","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Louerprinseskvotera","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Masejo","id":"America/Maceio"},{"value":"America/Managua","name":"Managva","id":"America/Managua"},{"value":"America/Manaus","name":"Manausa","id":"America/Manaus"},{"value":"America/Marigot","name":"Merigota","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinika","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamorosa","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Masatlana","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendosa","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominī","id":"America/Menominee"},{"value":"America/Merida","name":"Merida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Mehiko","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Mikelona","id":"America/Miquelon"},{"value":"America/Moncton","name":"Monktona","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterreja","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrata","id":"America/Montserrat"},{"value":"America/Nassau","name":"Naso","id":"America/Nassau"},{"value":"America/New_York","name":"Ņujorka","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigona","id":"America/Nipigon"},{"value":"America/Nome","name":"Noma","id":"America/Nome"},{"value":"America/Noronha","name":"Noroņa","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Bjula, Ziemeļdakota","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Sentera, Ziemeļdakota","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"Ņūseilema, Ziemeļdakota","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ohinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pannirtuna","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Fīniksa","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Portoprensa","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Portofspeina","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Portuveļu","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Puertoriko","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Puntaarenasa","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Reinirivera","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankininleta","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Resifi","id":"America/Recife"},{"value":"America/Regina","name":"Ridžaina","id":"America/Regina"},{"value":"America/Resolute","name":"Rezolūta","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Riobranko","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santaisabela","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarena","id":"America/Santarem"},{"value":"America/Santiago","name":"Santjago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santodomingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"Sanpaulu","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Itokortormita","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Senbartelmī","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"Sentdžonsa","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Sentkitsa","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Sentlūsija","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Sentomasa","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Sentvinsenta","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Sviftkarenta","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegusigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Tule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Tanderbeja","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tihuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vankūvera","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Vaithorsa","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Vinipega","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Jakutata","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Jelounaifa","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Keisi","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Deivisa","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dimondirvila","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Makvori","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mosona","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"Makmerdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Pālmera","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rotera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Šova","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Trolla","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostoka","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longjērbīene","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Adena","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almati","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Ammāna","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadira","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aktau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aktebe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ašgabata","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atirau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdāde","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahreina","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Baku","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkoka","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaula","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beirūta","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Biškeka","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Bruneja","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Kalkāta","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Čita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Čoibalsana","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Kolombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damaska","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Daka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubaija","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dušanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebrona","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Honkonga","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovda","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutska","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Džakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Džajapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jeruzaleme","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabula","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamčatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karāči","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Katmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Handiga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnojarska","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kualalumpura","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kučina","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuveita","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Makao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadana","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makasara","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Maskata","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nikosija","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuzņecka","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirska","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omska","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Orala","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Pnompeņa","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianaka","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Phenjana","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Katara","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kizilorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Ranguna","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Rijāda","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Hošimina","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sahalīna","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarkanda","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seula","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Šanhaja","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapūra","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Sredņekolimska","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Taibei","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Taškenta","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teherāna","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokija","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomska","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulanbatora","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumči","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ustjņera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vjenčana","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostoka","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakutska","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Jekaterinburga","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Erevāna","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azoru salas","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermuda","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Kanāriju salas","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Kaboverde","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Fēru salas","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reikjavika","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Dienviddžordžija","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Sv.Helēnas sala","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stenli","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaida","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbena","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Brokenhila","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Kari","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Dārvina","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Jukla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobārta","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindemana","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lordhava","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melburna","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Pērta","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sidneja","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Universālais koordinētais laiks","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdama","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andora","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrahaņa","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Atēnas","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrada","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlīne","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Brisele","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bukareste","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapešta","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Bīzingene","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Kišiņeva","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Kopenhāgena","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Īrijas ziemas laiksDublina","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltārs","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Gērnsija","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Menas sala","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Stambula","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Džērsija","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaļiņingrada","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kijeva","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirova","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lisabona","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Ļubļana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Lielbritānijas vasaras laiksLondona","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luksemburga","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madride","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamna","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minska","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monako","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Maskava","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Parīze","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Prāga","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Rīga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Roma","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"Sanmarīno","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajeva","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratova","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopole","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofija","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Stokholma","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallina","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirāna","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Uļjanovska","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Užhoroda","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduca","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vatikāns","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Vīne","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Viļņa","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograda","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varšava","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreba","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporožje","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Cīrihe","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivu","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Čagosu arhipelāgs","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Ziemsvētku sala","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Kokosu (Kīlinga) sala","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Komoras","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kergelēna sala","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mae","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldīvija","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Maurīcija","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Majota","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Reinjona","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apija","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Oklenda","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bugenvila sala","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Četema","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Lieldienu sala","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderberija","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fidži","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagu salas","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambjē salas","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Gvadalkanala","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guama","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Džonstona atols","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kirisimasi","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosraja","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kvadžaleina","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Madžuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marķīza salas","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midvejs","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolka","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Numea","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pagopago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitkērna","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Ponpeja","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Portmorsbi","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipana","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Taiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarava","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Čūka","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Veika sala","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Volisa","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

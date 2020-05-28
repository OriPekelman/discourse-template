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
r += "Έχεις ";
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
r += "μόνο <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 αδιάβαστο</a> ";
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
})() + " αδιάβαστα</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "και ";
return r;
},
"false" : function(d){
var r = "";
r += "έχεις ";
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
r += "/new'>1 νέο</a> νήμα";
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
r += "και ";
return r;
},
"false" : function(d){
var r = "";
r += "έχεις ";
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
})() + " νέα</a> νήματα";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ακόμη ή ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "περιηγήσου σε άλλα νήματα ";
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
r += "Πρόκειται να διαγράψεις ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> ανάρτηση";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> αναρτήσεις";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " και";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> νήμα";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> νήματα";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " από το χρήστη, να διαγράψεις τον λογαριασμό του, να απαγορεύσεις τις εγγραφές από τη διεύθυνση IP <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> και να πρόσθεσεις την διεύθυνση email <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> στην λίστα ανεπιθύμητων. Είσαι βέβαιος πως αυτός ο χρήστης είναι ανεπιθύμητος;";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "\nΑυτό το νήμα έχει ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 απάντηση";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " απαντήσεις";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "με μεγάλη αναλογία «μου αρέσει» στις αναρτήσεις";
return r;
},
"med" : function(d){
var r = "";
r += "με πολύ μεγάλη αναλογία «μου αρέσει» στις αναρτήσεις";
return r;
},
"high" : function(d){
var r = "";
r += "με εξαιρετικά μεγάλη αναλογία «μου αρέσει» στις αναρτήσεις";
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
r += "Πρόκειται να διαγράψεις ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 ανάρτηση";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " αναρτήσεις";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "1 νήμα";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " νήματα";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Είσαι σίγουρος;";
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
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["el"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}};
MessageFormat.locale.el = function ( n ) {
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

I18n.translations = {"el":{"js":{"number":{"format":{"separator":",","delimiter":"."},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}χιλ.","millions":"{{number}}εκατ."}},"dates":{"time":"ΗΗ:mm","timeline_date":"MMM YYYY","long_no_year":"DD MMM HH:mm","long_no_year_no_time":"DD MMM","full_no_year_no_time":"Do MMMM","long_with_year":"D MMM YYYY HH:mm","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"D MMMM YYYY","long_date_with_year":"D MMM 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} πριν","tiny":{"half_a_minute":"\u003c 1λ","less_than_x_seconds":{"one":"\u003c %{count}δ","other":"\u003c %{count}δ"},"x_seconds":{"one":"%{count}δ","other":"%{count}δ"},"less_than_x_minutes":{"one":"\u003c %{count}λ","other":"\u003c %{count}λ"},"x_minutes":{"one":"%{count}λ","other":"%{count}λ"},"about_x_hours":{"one":"%{count}ώ","other":"%{count}ώ"},"x_days":{"one":"%{count}η","other":"%{count}η"},"x_months":{"one":"%{count}μην","other":"%{count}μην"},"about_x_years":{"one":"%{count}χ","other":"%{count}έ"},"over_x_years":{"one":"\u003e %{count}χ","other":"\u003e %{count}έ"},"almost_x_years":{"one":"%{count}χ","other":"%{count}έ"},"date_month":"DD MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} λεπτό","other":"%{count} λεπτά"},"x_hours":{"one":"%{count} ώρα","other":"%{count} ώρες"},"x_days":{"one":"%{count} ημέρα","other":"%{count} ημέρες"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"πριν από %{count} λεπτό ","other":"πριν από %{count} λεπτά"},"x_hours":{"one":"πριν από %{count} ώρα","other":"πριν από %{count} ώρες"},"x_days":{"one":"πριν από %{count} ημέρα","other":"πριν από %{count} ημέρες"}},"later":{"x_days":{"one":"%{count} μέρα μετά","other":"%{count} μέρες μετά"},"x_months":{"one":"ένα μήνα μετά","other":"%{count} μήνες μετά"},"x_years":{"one":"ενα χρόνο μετά","other":"%{count} χρόνια μετά"}},"previous_month":"Προηγούμενος μήνας","next_month":"Επόμενος μήνας","placeholder":"ημερομηνία"},"share":{"post":"ανάρτηση #%{postNumber}","close":"κλείσιμο"},"action_codes":{"public_topic":"έκανε το νήμα δημόσιο στις %{when}","split_topic":"διαχώρισε αυτό το νήμα %{when}","invited_user":"προσκάλεσε τον χρήστη %{who} στις %{when}","invited_group":"προσκάλεσε την ομάδα %{who} στις %{when}","removed_user":"αφαίρεσε τον χρήστη %{who} στις %{when}","removed_group":"αφαίρεσε την ομάδα %{who} στις %{when}","autoclosed":{"enabled":"έκλεισε στις %{when}","disabled":"άνοιξε στις %{when}"},"closed":{"enabled":"έκλεισε στις %{when}","disabled":"άνοιξε στις %{when}"},"archived":{"enabled":"αρχειοθετήθηκε στις %{when}","disabled":"βγήκε από το αρχείο στις %{when}"},"pinned":{"enabled":"καρφιτσώθηκε στις %{when}","disabled":"ξεκαρφιτσώθηκε στις %{when}"},"pinned_globally":{"enabled":"καρφιτσώθηκε καθολικά %{when}","disabled":"ξεκαρφιτσώθηκε %{when}"},"visible":{"enabled":"ορατό στις %{when}","disabled":"κρυφό στις %{when}"},"banner":{"enabled":"το έκανε ανακοίνωση στις %{when}. Θα εμφανίζεται στην κορυφή κάθε σελίδας μέχρι να απορριφθεί από τον χρήστη.","disabled":"το αφαίρεσε από ανακοίνωση %{when}. Δεν θα εμφανίζεται πλέον στην κορυφή κάθε σελίδας."}},"wizard_required":"Καλώς ήλθατε στο νέο σας Discourse! Ας αρχίσουμε με τον \u003ca href='%{url}' data-auto-route='true'\u003eοδηγό εγκατάστασης\u003c/a\u003e ✨","emails_are_disabled":"Τα εξερχόμενα emails έχουν απενεργοποιηθεί καθολικά από κάποιον διαχειριστή. Δε θα σταλεί κανένα email.","themes":{"default_description":"Προεπιλογή"},"s3":{"regions":{"ap_northeast_1":"Ασία-Ειρηνικός (Τόκιο)","ap_northeast_2":"Ασία-Ειρηνικός (Σεούλ)","ap_south_1":"Ασία - Ειρηνικός (Μομβάη)","ap_southeast_1":"Ασία-Ειρηνικός (Σιγκαπούρη)","ap_southeast_2":"Ασία-Ειρηνικός (Σίδνεϊ)","cn_north_1":"Κίνα (Πεκίνο)","eu_central_1":"ΕΕ (Φρανκφούρτη)","eu_west_1":"ΕΕ (Ιρλανδία)","eu_west_2":"EU (Λονδίνο)","us_east_1":"Ανατολικές ΗΠΑ (Β. Βιρτζίνια)","us_east_2":"Ανατολικές ΗΠΑ (Οχάιο)","us_west_1":"Δυτικές ΗΠΑ (Β. Καλιφόρνια)","us_west_2":"Δυτικές ΗΠΑ (Όρεγκον)"}},"edit":"αλλαγή του τίτλου και της κατηγορίας του νήματος","expand":"Επέκτεινε","not_implemented":"Λυπούμαστε! Αυτή η λειτουργία δεν έχει υλοποιηθεί ακόμα.","no_value":"Όχι","yes_value":"Ναι","generic_error":"Λυπούμαστε, προέκυψε κάποιο σφάλμα.","generic_error_with_reason":"Προέκυψε ένα σφάλμα: %{error}","sign_up":"Εγγραφείτε","log_in":"Συνδεθείτε","age":"Ηλικία","joined":"Έγινε μέλος","admin_title":"Διαχειριστής","show_more":"περισσότερα","show_help":"επιλογές","links":"Σύνδεσμοι","links_lowercase":{"one":"Σύνδεσμος","other":"σύνδεσμοι"},"faq":"Συχνές ερωτήσεις","guidelines":"Οδηγίες","privacy_policy":"Πολιτική Ιδιωτικότητας","privacy":"Ιδιωτικότητα","tos":"Όροι Χρήσης","mobile_view":"Προβολή Κινητού","desktop_view":"Προβολή Υπολογιστή","you":"Εσύ","or":"ή","now":"μόλις τώρα","read_more":"διάβασε περισσότερα","more":"Περισσότερα","less":"Λιγότερα","never":"ποτέ","every_30_minutes":"κάθε 30 λεπτά","every_hour":"κάθε ώρα","daily":"καθημερινά","weekly":"κάθε εβδομάδα","every_month":"κάθε μήνα","max_of_count":"μέγιστο {{count}}","alternation":"ή","character_count":{"one":"{{count}} χαρακτήρα","other":"{{count}} χαρακτήρες"},"related_messages":{"title":"Σχετικά Μηνύματα"},"suggested_topics":{"title":"Προτεινόμενα Νήματα","pm_title":"Προτεινόμενα Μηνύματα"},"about":{"simple_title":"Σχετικά","title":"Σχετικά με %{title}","stats":"Στατιστικά Ιστοσελίδας","our_admins":"Οι διαχειριστές μας","our_moderators":"Οι συντονιστές μας","moderators":"Συντονιστές","stat":{"all_time":"Συνολικά"},"like_count":"Αρέσει","topic_count":"Νήματα","post_count":"Αναρτήσεις","user_count":"Χρήστες","active_user_count":"Ενεργοί Χρήστες","contact":"Επικοινώνησε μαζί μας","contact_info":"Σε περίπτωση που προκύψει κάποιο κρίσιμο πρόβλημα ή κάποιο επείγον θέμα που αφορά αυτόν τον ιστότοπο, παρακαλούμε να επικοινωνήσεις μαζί μας στο %{contact_info}."},"bookmarked":{"title":"Σελιδοδείκτης","clear_bookmarks":"Διαγραφή Σελιδοδεικτών","help":{"bookmark":"Πάτα εδώ για να μπεί σελιδοδείκτης στην πρώτη ανάρτηση του νήματος.","unbookmark":"Πάτα εδώ για να αφαιρεθούν όλοι οι σελιδοδείκτες από αυτό το νήμα."}},"bookmarks":{"created":"έχεις προσθέσει σελιδοδείκτη σε αυτή την ανάρτηση","remove":"Αφαίρεση Σελιδοδείκτη","save":"Αποθήκευση"},"drafts":{"remove":"Αναίρεση Πρόσκλησης","abandon":{"yes_value":"Ναί, απέρριψέ τη","no_value":"Όχι, κράτησέ τη"}},"preview":"προεπισκόπιση","cancel":"ακύρωση","save":"Αποθήκευση Αλλαγών","saving":"Αποθήκευση σε εξέλιξη...","saved":"Αποθηκεύτηκε!","upload":"Ανέβασμα","uploading":"Ανεβαίνει...","uploaded":"Ανέβηκε!","enable":"Ενεργοποίηση","disable":"Απενεργοποίηση","undo":"Αναίρεση","revert":"Επαναφορά","failed":"Απέτυχε","switch_to_anon":"Έναρξη Κατάστασης Ανωνυμίας","switch_from_anon":"Τερματισμός Κατάστασης Ανωνυμίας","banner":{"close":"Απόρριψη αυτής της ανακοίνωσης.","edit":"Επεξεργασία αυτής της ανακοίνωσης \u003e\u003e"},"choose_topic":{"none_found":"Δεν βρέθηκαν νήματα."},"review":{"explain":{"total":"Σύνολο"},"delete":"Σβήσιμο","settings":{"saved":"Αποθηκεύτηκε! ","save_changes":"Αποθήκευση Αλλαγών","title":"Ρυθμίσεις"},"topic":"Νήμα:","filtered_user":"Χρήστης","user":{"username":"Όνομα Χρήστη","email":"Διεύθυνση Email","name":"Όνομα","fields":"Πεδία"},"topics":{"topic":"Νήμα","details":"λεπτομέρειες"},"edit":"Επεξεργασία","save":"Αποθήκευση","cancel":"Άκυρο","filters":{"type":{"title":"Τύπος"},"refresh":"Ανανέωση ","category":"Κατηγορία"},"scores":{"type":"Τύπος"},"statuses":{"pending":{"title":"Εκκρεμή"},"approved":{"title":"Εγκρίθηκε "},"rejected":{"title":"Απορρίφθηκε"},"ignored":{"title":"Αγνοήθηκε "},"deleted":{"title":"Διαγράφηκε"}},"types":{"reviewable_user":{"title":"Χρήστης"}},"approval":{"title":"Απαιτείται Έγκριση Ανάρτησης","description":"Λάβαμε την ανάρτησή σου, αλλά πρέπει πρώτα να εγκριθεί από έναν συντονιστή πριν εμφανιστεί. Παρακαλώ περιμένετε.","ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ανάρτησε \u003ca href='{{topicUrl}}'\u003eτο νήμα \u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eΑνάρτησες\u003c/a\u003e αυτό \u003ca href='{{topicUrl}}'\u003eτο νήμα\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e απάντησε στο \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eΑπάντησες\u003c/a\u003e στο \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e απάντησε στο \u003ca href='{{topicUrl}}'\u003eνήμα\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eΑπάντησες\u003c/a\u003e στο \u003ca href='{{topicUrl}}'\u003eνήμα\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e ανάφερε τον/την \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e ανάφερε \u003ca href='{{user2Url}}'\u003eεσένα\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eΑνάφερες\u003c/a\u003e τον/την \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Αναρτήθηκε από τον/την \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Αναρτήθηκε από \u003ca href='{{userUrl}}'\u003eεσένα\u003c/a\u003e","sent_by_user":"Στάλθηκε από τον/την \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Στάλθηκε από \u003ca href='{{userUrl}}'\u003eεσένα\u003c/a\u003e"},"directory":{"filter_name":"φιλτράρισμα με βάση το όνομα χρήστη","title":"Χρήστες","likes_given":"Δόθηκαν","likes_received":"Λήφθησαν","topics_entered":"Προβλήθηκαν","topics_entered_long":"Προβεβλημένα Νήματα","time_read":"Χρόνος Ανάγνωσης","topic_count":"Νήματα","topic_count_long":"Δημιουργημένα Νήματα","post_count":"Απαντήσεις","post_count_long":"Αναρτημένες Απαντήσεις","no_results":"Δεν βρέθηκαν αποτελέσματα.","days_visited":"Επισκέψεις","days_visited_long":"Ημέρες Επίσκεψης","posts_read":"Διαβασμένο","posts_read_long":"Διαβασμένες Αναρτήσεις","total_rows":{"one":"%{count} χειριστής","other":"%{count} χρήστες"}},"group_histories":{"actions":{"change_group_setting":"Αλλαγή ρυθμίσεων ομάδας","add_user_to_group":"Προσθήκη χρήστη","remove_user_from_group":"Αφαίρεση χρήστη","make_user_group_owner":"Κάνε ιδιοκτήτη","remove_user_as_group_owner":"Απέσυρε ιδιοκτήτη"}},"groups":{"add_members":{"title":"Προσθήκη Μελών"},"requests":{"reason":"Αιτία"},"manage":{"name":"Όνομα","full_name":"Πλήρες Όνομα","add_members":"Προσθήκη Μελών","delete_member_confirm":"Να αφαιρεθεί ο/η '%{username}' από την ομάδα '%{group}' ;","profile":{"title":"Προφίλ"},"interaction":{"posting":"Αναρτήσεις"},"membership":{"title":"Συνδρομή","access":"Πρόσβαση"},"logs":{"title":"Αρχεία καταγραφής","when":"Πότε","action":"Ενέργεια","acting_user":"Ενέργεια από","target_user":"Αποδέκτης","subject":"Αντικείμενο","details":"Λεπτομέρειες","from":"Από","to":"Προς"}},"public_admission":"Επίτρεψε στους χρήστες να προσχωρήσουν στην ομάδα (Απαιτεί δημόσια ορατή ομάδα)","public_exit":"Επίτρεψε στους χρήστες να αποχωρήσουν από την ομάδα","empty":{"posts":"Δεν υπάρχουν αναρτήσεις από μέλη της ομάδας.","members":"Δεν υπάρχουν μέλη σε αυτή την ομάδα.","mentions":"Δεν υπάρχουν αναφορές αυτής της ομάδας.","messages":"Δεν υπάρχουν μηνύματα για αυτή την ομάδα.","topics":"Δεν υπάρχουν νήματα από μέλη της ομάδας.","logs":"Δεν υπάρχουν logs για αυτή την ομάδα."},"add":"Προσθήκη","request":"Αίτημα","message":"Μήνυμα","membership_request_template":"Προσαρμοσμένο πρότυπο που θα εμφανίζεται στους χρήστες όταν αποστέλλεται αίτημα συμμετοχής","membership_request":{"submit":"Αποστολή Αιτήματος","title":"Αιτήματα για συμετοχή @%{group_name}","reason":"Ενημέρωσε τους ιδιοκτήτες της ομάδας για τον λόγο που θέλεις να συμμετέχεις σε αυτήν"},"membership":"Συνδρομή","name":"Όνομα","user_count":"Χρήστες","bio":"Σχετικά με την Ομάδα","selector_placeholder":"εισαγωγή ονόματος χρήστη","owner":"ιδιοκτήτης","index":{"title":"Ομάδες","empty":"Δεν υπάρχουν ορατές ομάδες.","automatic":"Αυτόματα","public":"Δημόσια","private":"Ιδιωτική","automatic_group":"Αυτόματη Ομάδα","my_groups":"Οι Ομάδες Μου","is_group_user":"Μέλος"},"title":{"one":"Ομάδα","other":"Ομάδες"},"activity":"Δραστηριότητα","members":{"title":"Μέλη","filter_placeholder":"όνομα χρήστη"},"topics":"Νήματα","posts":"Αναρτήσεις","mentions":"Αναφορές","messages":"Μηνύματα","notification_level":"Προκαθορισμένο επίπεδο ειδοποιήσεων για μηνύματα ομάδων","alias_levels":{"mentionable":"Ποιός μπορεί να @αναφέρει αυτή την ομάδα;","messageable":"Ποιός μπορεί να στείλει μήνυμα σε αυτή την ομάδα;","nobody":"Κανένας","only_admins":"Μόνο διαχειριστές","mods_and_admins":"Μόνο συντονιστές και διαχειριστές","members_mods_and_admins":"Μόνο τα μέλη της ομάδας, οι συντονιστές και οι διαχειριστές","everyone":"Όλοι"},"notifications":{"watching":{"title":"Επιτηρείται","description":"Θα λαμβάνεις ειδοποιήσεις για κάθε καινούρια ανάρτηση σε κάθε μήνυμα και θα εμφανίζεται ο αριθμός των καινούριων απαντήσεων ."},"watching_first_post":{"title":"Επιτήρηση Πρώτης Ανάρτησης"},"tracking":{"title":"Παρακολουθείται","description":"Θα λαμβάνεις ειδοποιήσεις εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε εσένα και θα εμφανίζεται ο αριθμός των καινούριων απαντήσεων."},"regular":{"title":"Κανονικό","description":"Θα λαμβάνεις ειδοποιήσεις αν κάποιος αναφέρει το @name σου ή σου απαντήσει"},"muted":{"title":"Σε σιγή"}},"flair_url":"Avatar Flair Εικόνα","flair_url_placeholder":"(Προαιρετικό) URL εικόνας ή Font Awesome class ","flair_bg_color":"Avatar Flair Χρώμα Φόντου","flair_bg_color_placeholder":"(Προαιρετικό) Τιμή χρώματος Hex","flair_color":"Avatar Flair Χρώμα","flair_color_placeholder":"(Προαιρετικό) Τιμή χρώματος Hex","flair_preview_icon":"Εικονίδιο Προεπισκόπησης","flair_preview_image":"Εικόνα Προεπισκόπησης"},"user_action_groups":{"1":"Αρέσει που Έδωσα","2":"Αρέσει που Έλαβα","3":"Σελιδοδείκτες","4":"Νήματα","5":"Απαντήσεις","6":"Αποκρίσεις","7":"Αναφορές","9":"Παραθέσεις","11":"Επεξεργασίες","12":"Απεσταλμένα","13":"Εισερχόμενα","14":"Εκκρεμή"},"categories":{"all":"όλες οι κατηγορίες","all_subcategories":"όλα","no_subcategory":"κανένα","category":"Κατηγορία","category_list":"Εμφάνισε τη λίστα κατηγοριών","reorder":{"title":"Επαναταξινόμησε τις κατηγορίες","title_long":"Αναδιοργάνωση της λίστας κατηγοριών","save":"Αποθήκευση Κατάταξης","apply_all":"Εφαρμογή","position":"Θέση"},"posts":"Αναρτήσεις","topics":"Νήματα","latest":"Πρόσφατες","latest_by":"πρόσφατες από","toggle_ordering":"εναλλαγή ταξινόμησης","subcategories":"Υποκατηγορίες","topic_sentence":{"one":"%{count} θέμα","other":"%{count} νήματα"}},"ip_lookup":{"title":"Αναζήτηση Διεύθυνσης IP","hostname":"Hostname","location":"Τοποθεσία","location_not_found":"(άγνωστο)","organisation":"Οργανισμός","phone":"Τηλέφωνο","other_accounts":"Άλλοι λογαριασμοί με αυτή την IP διεύθυνση:","delete_other_accounts":"Διαγραφή %{count}","username":"όνομα χρήστη","trust_level":"TL","read_time":"χρόνος ανάγνωσης","topics_entered":"νήματα που προβλήθηκαν","post_count":"# αναρτήσεις","confirm_delete_other_accounts":"Είσε σίγουρος ότι θέλεις να διαγράψεις αυτούς τους λογαριασμούς;"},"user_fields":{"none":"(διαλέξτε μία επιλογή)"},"user":{"said":"{{username}}:","profile":"Προφίλ","mute":"Σίγαση","edit":"Επεξεργασία Ρυθμίσεων","download_archive":{"button_text":"Λήψη Όλων","confirm":"Είσαι σίγουρος πως θέλεις να κάνεις λήψη των αναρτήσεών σου;","success":"Ξεκίνησε η διαδικασία λήψης. Θα ειδοποιηθείτε μόλις ολοκληρωθεί η διαδικασία.","rate_limit_error":"Μπορείς να κάνεις λήψη των αναρτήσεών σου μια φορά την ημέρα, προσπάθησε ξανά αύριο."},"new_private_message":"Νέο Μήνυμα","private_message":"Μήνυμα","private_messages":"Μηνύματα","user_notifications":{"ignore_duration_username":"Όνομα Χρήστη","ignore_duration_save":"Αγνόηση","ignore_option":"Αγνοήθηκε ","mute_option":"Σίγαση","normal_option":"Φυσιολογικά"},"activity_stream":"Δραστηριότητα","preferences":"Προτιμήσεις","feature_topic_on_profile":{"save":"Αποθήκευση","clear":{"title":"Καθαρισμός"}},"expand_profile":"Επέκτεινε","bookmarks":"Σελιδοδείκτες","bio":"Σχετικά με εμένα","invited_by":"Προσκλήθηκε Από","trust_level":"Επίπεδο Εμπιστοσύνης","notifications":"Ειδοποιήσεις","statistics":"Στατιστικά","desktop_notifications":{"not_supported":"Οι ειδοποιήσεις δεν υποστηρίζονται από αυτό το πρόγραμμα περιήγησης. Λυπάμαι.","perm_default":"Ενεργοποίησε τις Ειδοποιήσεις","perm_denied_btn":"Η άδεια απορρίφθηκε","perm_denied_expl":"Απορρίψατε την άδεια για ειδοποιήσεις. Επιτρέψτε τις ειδοποιήσεις μέσω των ρυθμίσεων του browser σας.","disable":"Απενεργοποίηση Ειδοποιήσεων","enable":"Ενεργοποίηση Ειδοποιήσεων","each_browser_note":"Σημείωση: Θα πρέπει να αλλάξετε αυτή τη ρύθμιση σε κάθε browser που χρησιμοποιείτε."},"dismiss":"Απόρριψη","dismiss_notifications":"Απόρριψη Όλων","dismiss_notifications_tooltip":"Όλες οι αδιάβαστες ειδοποιήσεις να χαρακτηριστούν διαβασμένες","first_notification":"Η πρώτη σου ειδοποίηση! Επίλεξε την για να ξεκινήσεις.","external_links_in_new_tab":"Άνοιγε όλους τους εξωτερικούς συνδέσμους σε νέα καρτέλα","enable_quoting":"Το κείμενο που επισημαίνεται να παρατίθεται στην απάντηση ","change":"αλλαγή","moderator":"Ο/Η {{user}} είναι συντονιστής","admin":"Ο/Η {{user}} είναι διαχειριστής","moderator_tooltip":"Αυτός ο χρήστης είναι συντονιστής","admin_tooltip":"Αυτός ο χρήστης είναι διαχειριστής","silenced_tooltip":"Χρήστης σε σιγή","suspended_notice":"Αυτός ο χρήστης είναι σε αποβολή μέχρι τις {{date}}.","suspended_permanently":"Ο χρήστης είναι αποβλημένος.","suspended_reason":"Αιτιολογία:","github_profile":"Github","email_activity_summary":"Περίληψη Ενεργειών","mailing_list_mode":{"label":"Λειτουργία ταχυδρομικής λίστας","enabled":"Ενεργοποίησε λειτουργία ταχυδρομικής λίστας","instructions":"\nΗ ρύθμιση παρακάμπτει την περίληψη δραστηριότητας.\u003cbr /\u003e\n\nΤα νήματα σε σίγαση και οι κατηγορίες δεν συμπεριλαμβάνονται σε αυτά τα ηλεκτρονικά μηνύματα.\n","individual":"Στείλε ένα email για κάθε νέα ανάρτηση","individual_no_echo":"Στείλε ένα email για κάθε νέα ανάρτηση, εκτός από τις δικές μου.","many_per_day":"Στείλε μου ένα email για κάθε νέα ανάρτηση (περίπου {{dailyEmailEstimate}} τη μέρα)","few_per_day":"Στείλε μου ένα email για κάθε νέα ανάρτηση (περίπου 2 τη μέρα)"},"tag_settings":"Ετικέτες","watched_tags":"Επιτηρείται","watched_tags_instructions":"Θα επιτηρείς αυτόματα όλα τα νήματα με αυτές τις ετικέτες. Θα λαμβάνεις ειδοποιήσεις για όλες τις καινούριες αναρτήσεις και νήματα και η καταμέτρηση των καινούριων αναρτήσεων θα εμφανίζεται επίσης δίπλα στο νήμα.","tracked_tags":"Παρακολουθείται","tracked_tags_instructions":"Θα παρακολουθείς αυτόματα όλα τα νήματα με αυτές τις ετικέτες. Η καταμέτρηση των καινούριων αναρτήσεων θα εμφανίζεται δίπλα στο νήμα.","muted_tags":"Σίγαση","muted_tags_instructions":"Δε θα λαμβάνεις ειδοποιήσεις για τίποτα σχετικά με νέα νήματα με αυτές τις ετικέτες και δε θα εμφανίζονται στα τελευταία. ","watched_categories":"Επιτηρείται","watched_categories_instructions":"Θα παρακολουθείς αυτόματα όλα τα νήματα σε αυτές τις κατηγορίες. Θα λαμβάνεις ειδοποιήσεις για όλες τις καινούριες αναρτήσεις και νήματα και η καταμέτρηση των καινούριων αναρτήσεων θα εμφανίζεται επίσης δίπλα στο νήμα.","tracked_categories":"Παρακολουθείται","tracked_categories_instructions":"Θα παρακολουθείς αυτόματα όλα τα νήματα σε αυτές τις κατηγορίες. Η καταμέτρηση των καινούριων αναρτήσεων θα εμφανίζεται δίπλα στο νήμα.","watched_first_post_categories":"Επιτήρηση Πρώτης Ανάρτησης","watched_first_post_categories_instructions":"Θα ειδοποιηθείς για την πρώτη ανάρτηση σε κάθε νέο νήμα αυτών των κατηγοριών.","watched_first_post_tags":"Επιτήρηση Πρώτης Ανάρτησης","watched_first_post_tags_instructions":"Θα ειδοποιηθείς για την πρώτη ανάρτηση σε κάθε νέο νήμα με αυτές τις ετικέτες. ","muted_categories":"Σε σίγαση","no_category_access":"Ως συντονιστής έχεις περιορισμένη πρόσβαση στην κατηγορία, η αποθήκευση είναι απενεργοποιημένη.","delete_account":"Διαγραφή Λογαριασμού","delete_account_confirm":"Είσαι σίγουρος πως θέλεις να διαγράψεις μόνιμα τον λογαριασμό σου; Αυτή η πράξη είναι μη αναστρέψιμη!","deleted_yourself":"Ο λογαριασμός σου διαγράφηκε.","unread_message_count":"Μηνύματα","admin_delete":"Διαγραφή","users":"Χρήστες","muted_users":"Σε σίγαση","muted_users_instructions":"Αποσιώπησε όλες τις ειδοποιήσεις από αυτούς τους χρήστες.","ignored_users":"Αγνοήθηκε ","tracked_topics_link":"Δείξε","automatically_unpin_topics":"Τα νήματα ξεκαρφιτσώνονται αυτόματα όταν φτάνω στο κάτω μέρος.","apps":"Εφαρμογές","revoke_access":"Ανάκληση Πρόσβασης","undo_revoke_access":"Απενεργοποίηση Ανάκλησης Πρόσβασης","api_approved":"Εγκεκριμένο:","theme":"Θέμα","home":"Προεπιλεγμένη Αρχική Σελίδα","staff_counters":{"flags_given":"χρήσιμες σημάνσεις","flagged_posts":"επισημασμένες αναρτήσεις","deleted_posts":"διαγραμμένες αναρτήσεις","suspensions":"αποβολές","warnings_received":"προειδοποιήσεις"},"messages":{"all":"Όλα","inbox":"Εισερχόμενα","sent":"Απεσταλμένα","archive":"Αρχείο","groups":"Οι Ομάδες Μου","bulk_select":"Επιλογή μηνυμάτων","move_to_inbox":"Μετακίνηση στα Εισερχόμενα","move_to_archive":"Αρχειοθέτηση","failed_to_move":"Αποτυχία μετακίνησης των επιλεγμένων μηνυμάτων (πιθανόν δεν υπάρχει σύνδεση στο δίκτυο)","select_all":"Επιλογή Όλων","tags":"Ετικέτες"},"preferences_nav":{"account":"Λογαριασμός","profile":"Προφίλ","emails":"Emails","notifications":"Ειδοποιήσεις","categories":"Κατηγορίες","users":"Χρήστες","tags":"Ετικέτες","interface":"Διεπαφή","apps":"Εφαρμογές"},"change_password":{"success":"(το email στάλθηκε)","in_progress":"(αποστολή email)","error":"(σφάλμα)","action":"Αποστολή Email Επαναφοράς Συνθηματικού","set_password":"Ορισμός Συνθηματικού","choose_new":"Επιλέξτε νέο κωδικό πρόσβασης","choose":"Επιλέξτε έναν κωδικό πρόσβασης"},"second_factor_backup":{"regenerate":"Αναδημιουγία","disable":"Απενεργοποίηση","enable":"Ενεργοποίηση","copied_to_clipboard":"Αντιγράφτηκε στο Clipboard","copy_to_clipboard_error":"Σφάλμα αντιγραφής δεδομένων στο Clipboard"},"second_factor":{"name":"Όνομα","edit":"Επεξεργασία","security_key":{"register":"Εγγραφή","delete":"Σβήσιμο"}},"change_about":{"title":"Άλλαξε τα «σχετικά με εμένα»","error":"Προέκυψε σφάλμα στην αλλαγή της αξίας."},"change_username":{"title":"Αλλαγή Ονόματος Χρήστη","taken":"Λυπούμαστε, αυτό το όνομα χρήστη χρησιμοποιείται ήδη.","invalid":"Αυτό το όνομα χρήστη δεν είναι έγκυρο. Θα πρέπει να αποτελείται μόνο από αριθμούς και γράμματα"},"change_email":{"title":"Αλλαγή διεύθυνσης Email","taken":"Λυπούμαστε, αυτή η διεύθυνση email δεν είναι διαθέσιμη.","error":"Υπήρξε ένα σφάλμα κατά την αλλαγή της διεύθυνσης email σου. Ίσως αυτή η διεύθυνση είναι ήδη σε χρήση;","success":"Έχουμε στείλει ένα email σε αυτή τη διεύθυνση. Παρακαλούμε ακολούθησε τις οδηγίες επιβεβαίωσης που περιέχει.","success_staff":"Στείλαμε ένα email στην τρέχουσα διεύθυνσή σας. Παρακαλούμε ακολουθήστε τις οδηγίες επικύρωσης."},"change_avatar":{"title":"Αλλαγή της φωτογραφίας του προφίλ σου","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, που βασίζεται σε","gravatar_title":"Άλλαξε το άβατάρ σου στην ιστοσελίδα Gravatar ","refresh_gravatar_title":"Ανανέωσε το Gravatar σου","letter_based":"Εικόνα προφίλ που ανέθεσε το σύστημα","uploaded_avatar":"Προσαρμοσμένη εικόνα","uploaded_avatar_empty":"Πρόσθεσε μια δική σου εικόνα","upload_title":"Ανέβασε την εικόνα σου","image_is_not_a_square":"Προσοχή: Περικόψαμε την εικόνα σου γιατί το ύψος και το πλάτος δεν ήταν ίσα."},"change_card_background":{"title":"Φόντο Καρτέλας Χρήστη","instructions":"Οι εικόνες στο φόντο θα κεντραρίζονται και το προκαθορισμένο πλάτος τους είναι 590px."},"email":{"title":"Email","ok":"Για επιβεβαίωση θα σου στείλουμε ένα email","invalid":"Παρακαλώ δώσε μία έγκυρη διεύθυνση email","authenticated":"Η διεύθυνση email σου ταυτοποιήθηκε από τον πάροχο {{provider}}","frequency_immediately":"Θα σου στείλουμε αμέσως email, εάν δεν έχεις διαβάσει αυτό για το οποίο σου στέλνουμε το μήνυμα.","frequency":{"one":"Θα σου στείλουμε ηλεκτρονικό μήνυμα μόνο εάν δε σε έχουμε δει το τελευταίο λεπτό.","other":"Θα σου στείλουμε ηλεκτρονικό μήνυμα μόνο εάν δεν σε έχουμε δει τα τελευταία {{count}} λεπτά."}},"associated_accounts":{"revoke":"Ανάκληση","cancel":"Άκυρο"},"name":{"title":"Όνομα","instructions":"το ονοματεπώνυμό σου (προαιρετικό)","instructions_required":"Το ονοματεπώνυμό σου","too_short":"Το όνομά σου είναι πολύ μικρό","ok":"Το όνομά σου είναι καλό"},"username":{"title":"Όνομα Χρήστη","instructions":"μοναδικό, χωρίς κενά, σύντομο","short_instructions":"Οι άλλοι μπορούν να αναφερθούν σε σένα με το @{{username}} ","available":"Το όνομα χρήστη είναι διαθέσιμο","not_available":"Δεν είναι διαθέσιμο. Δοκίμασε {{suggestion}};","not_available_no_suggestion":"Μη διαθέσιμο ","too_short":"Το όνομα χρήστη σου είναι μικρό","too_long":"Το όνομα χρήστη σου είναι μεγάλο","checking":"Έλεγχεται αν το όνομα χρήστη είναι διαθέσιμο...","prefilled":"Η διεύθυνση email ταιριάζει με το εγγεγραμμένο όνομα χρήστη"},"locale":{"title":"Γλώσσα διεπαφής","instructions":"Η γλώσσα της διεπαφής. Θα αλλάξει μόλις ανανεωθεί η σελίδα","default":"(προεπιλογή)","any":"καθένα"},"password_confirmation":{"title":"Επανάληψη του κωδικού πρόσβασης"},"auth_tokens":{"ip":"IP","details":"Λεπτομέρειες"},"last_posted":"Τελευταία Ανάρτηση","last_emailed":"Τελευταίο email","last_seen":"Εθεάθη","created":"Μέλος από","log_out":"Αποσύνδεση","location":"Τοποθεσία","website":"Ιστοσελίδα","email_settings":"Email","text_size":{"normal":"Φυσιολογικά"},"like_notification_frequency":{"title":"Ειδοποίησέ με όταν έχω \"μου αρέσει\"","always":"Πάντα","first_time_and_daily":"Πρώτη φορά που μια ανάρτησή έχει \"μου αρέσει\" και καθημερινά","first_time":"Πρώτη φορά που μια ανάρτηση έχει \"μου αρέσει\"","never":"Ποτέ"},"email_previous_replies":{"title":"Συμπερίλαβε προηγούμενες απαντήσεις στο κάτω μέρος των email","unless_emailed":"εάν δεν έχει σταλεί προηγουμένως","always":"πάντα","never":"ποτέ"},"email_digests":{"every_30_minutes":"κάθε 30 λεπτά","every_hour":"ωριαία","daily":"καθημερινά","weekly":"εβδομαδιαία","every_month":"κάθε μήνα"},"email_level":{"title":"Στείλε μου ένα email όταν κάποιος παραθέσει ανάρτησή μου, απαντήσει σε ανάρτησή μου, αναφέρει το @username μου ή με προσκαλεί σε ένα νήμα.","always":"πάντα","never":"ποτέ"},"email_messages_level":"Στείλε μου ένα email όταν κάποιος μου στείλει προσωπικό μήνυμα.","include_tl0_in_digests":"Συμπερίλαβε περιεχόμενο από νέους χρήστες σε περιληπτικά email","email_in_reply_to":"Συμπερίλαβε ένα απόσπασμα της απαντημένης ανάρτησης στο email","other_settings":"Λοιπά","categories_settings":"Κατηγορίες","new_topic_duration":{"label":"Τα νήματα να θεωρούνται νέα όταν","not_viewed":"Δεν τα έχω δει αυτά ακόμη","last_here":"δημιουργήθηκαν από την τελευταία επίσκεψή μου","after_1_day":"δημιουργήθηκαν την τελευταία ημέρα","after_2_days":"δημιουργήθηκαν τις 2 τελευταίες ημέρες","after_1_week":"δημιουργήθηκαν την τελευταία εβδομάδα","after_2_weeks":"δημιουργήθηκαν τις 2 τελευταίες εβδομάδες"},"auto_track_topics":"Τα νήματα που επισκέπτομαι να παρακολουθούνται αυτόματα ","auto_track_options":{"never":"ποτέ","immediately":"αμέσως","after_30_seconds":"μετά από 30 δευτερόλεπτα","after_1_minute":"μετά από 1 λεπτό","after_2_minutes":"μετά από 2 λεπτά","after_3_minutes":"μετά από 3 λεπτά","after_4_minutes":"μετά από 4 λεπτά","after_5_minutes":"μετά από 5 λεπτά","after_10_minutes":"μετά από 10 λεπτά"},"notification_level_when_replying":"Όταν αναρτώ σε ένα νήμα, τοποθέτησε αυτό το νήμα σε","invited":{"search":"γράψε για να αναζητήσεις προσκλήσεις...","title":"Προσκλήσεις","user":"Προσκεκλημένος Χρήστης","truncated":{"one":"Δείχνοντας την πρώτη πρόσκληση.","other":"Προβάλονται οι πρώτες {{count}} προσκλήσεις."},"redeemed":"Αποδεκτές Προσκλήσεις","redeemed_tab":"Αποδεκτές","redeemed_tab_with_count":"Αποδεκτές ({{count}})","redeemed_at":"Αποδεκτές","pending":"Εκρεμείς προσκλήσεις","pending_tab":"Εκρεμείς","pending_tab_with_count":"Εκρεμείς ({{count}})","topics_entered":"Προβεβλημένα Νήματα","posts_read_count":"Διαβασμένες Αναρτήσεις","expired":"Αυτή η πρόσκληση έχει λήξει.","rescind":"Αναίρεση Πρόσκλησης","rescinded":"Η πρόσκληση αναιρέθηκε","reinvite":"Επαναποστολή Πρόσκλησης","reinvite_all":"Επαναποστολή όλων των προσκλήσεων","reinvite_all_confirm":"Σίγουρα θέλετε να στείλετε ξανά όλες τις προσκλήσεις;","reinvited":"Η πρόσκληση στάλθηκε ξανά","reinvited_all":"Όλες οι προσκλήσεις ξανά-εστάλησαν!","time_read":"Χρόνος Ανάγνωσης","days_visited":"Μέρες Επίσκεψης","account_age_days":"Ηλικία λογαριασμού σε ημέρες","create":"Αποστολή Πρόσκλησης","generate_link":"Αντιγραφή Συνδέσμου Πρόσκλησης","link_generated":"Η δημιουργία του συνδέσμου πρόσκλησης έγινε επιτυχώς!","valid_for":"Ο σύνδεσμος πρόσκλησης είναι έγκυρος μόνο για αυτή τη διεύθυνση email: %{email}","bulk_invite":{"none":"Δεν έχετε προσκαλέσει κανέναν ακόμα. Στείλτε ατομικές προσκλήσεις ή καλέστε πολλά άτομα με τη μία \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e μεταφορτώνοντας ένα αρχείο CSV\u003c/a\u003e.","text":"Ομαδική πρόσκληση από αρχείο","success":"Το αρχείο ανέβηκε. Θα ενημερωθείς με ένα μήνυμα όταν ολοκληρωθεί η διαδικασία.","error":"Λυπούμαστε, το αρχείο πρέπει να έχει την μορφή CSV."}},"password":{"title":"Κωδικός Πρόσβασης","too_short":"Ο κωδικός πρόσβασης είναι μικρός.","common":"Ο κωδικός πρόσβασης είναι πολύ κοινός.","same_as_username":"Ο κωδικός πρόσβασης που έδωσες είναι ο ίδιος με το όνομα χρήστη.","same_as_email":"Ο κωδικός πρόσβασής σου είναι ίδιος με τη διεύθυνση email σου.","ok":"Ο κωδικός πρόσβασης φαίνεται καλός.","instructions":"τουλάχιστον %{count} χαρακτήρες"},"summary":{"title":"Περίληψη","stats":"Στατιστικά","time_read":"χρόνος ανάγνωσης","recent_time_read":"πρόσφατος χρόνος ανάγνωσης","topic_count":{"one":"δημιουργημένο θέμα","other":"δημιουργημένα θέματα"},"post_count":{"one":"δημιουργημένη ανάρτηση","other":"δημιουργημένες αναρτήσεις"},"likes_given":{"one":"δόθηκε","other":"δόθηκαν"},"likes_received":{"one":"ελήφθη","other":"ελήφθησαν"},"days_visited":{"one":"ημέρα επίσκεψης","other":"ημέρες επίσκεψης"},"topics_entered":{"one":"νήμα προβλήθηκε","other":"νήματα προβλήθηκαν"},"posts_read":{"one":"διαβασμένη ανάρτηση","other":"διαβασμένες αναρτήσεις"},"bookmark_count":{"one":"σελιδοδείκτης","other":"σελιδοδείκτες"},"top_replies":"Κορυφαίες Απαντήσεις","no_replies":"Καμία απάντηση ακόμα.","more_replies":"Περισσότερες Απαντήσεις","top_topics":"Κορυφαία Νήματα","no_topics":"Κανένα νήμα ακόμα.","more_topics":"Περισσότερα Νήματα","top_badges":"Κορυφαία Παράσημα","no_badges":"Κανένα παράσημο ακόμα.","more_badges":"Περισσότερα Παράσημα","top_links":"Κορυφαίοι Σύνδεσμοι","no_links":"Κανένας σύνδεσμος ακόμα.","most_liked_by":"Περισσότερα \"Μου αρέσει\" από","most_liked_users":"Περισσότερα \"Μου αρέσει\"","most_replied_to_users":"Περισσότερες απαντήσεις προς","no_likes":"Κανένα μου αρέσει ακόμα.","topics":"Θέματα","replies":"Απαντήσεις"},"ip_address":{"title":"Τελευταία διεύθυνση IP"},"registration_ip_address":{"title":"Διεύθυνσης IP Εγγραφής"},"avatar":{"title":"Εικόνα προφίλ","header_title":"προφίλ, μηνύματα, σελιδοδείκτες και προτιμήσεις"},"title":{"title":"Τίτλος"},"primary_group":{"title":"Κύρια ομάδα"},"filters":{"all":"Όλα"},"stream":{"posted_by":"Αναρτήθηκε από","sent_by":"Στάλθηκε από","private_message":"μήνυμα","the_topic":"το νήμα"}},"loading":"Φόρτωση... ","errors":{"prev_page":"κατά το φόρτωμα","reasons":{"network":"Σφάλμα Δικτύου","server":"Σφάλμα Διακομιστή","forbidden":"Άρνηση Πρόσβασης","unknown":"Σφάλμα","not_found":"Η σελίδα δεν βρέθηκε"},"desc":{"network":"Παρακαλώ έλεγξε την σύνδεση.","network_fixed":"Μοιάζει να επανήλθε.","server":"Κωδικός σφάλματος: {{status}}","forbidden":"Δεν επιτρέπεται να το δείς αυτό.","not_found":"Ουπς, η εφαρμογή προσπάθησε να φορτώσει μια διεύθυνση URL που δεν υπάρχει.","unknown":"Κάτι δεν πήγε καλά."},"buttons":{"back":"Πίσω","again":"Δοκίμασε ξανά","fixed":"Φόρτωση Σελίδας"}},"close":"Κλείσιμο","assets_changed_confirm":"Αυτή η ιστοσελίδα μόλις ενημερώθηκε. Να ανανεωθεί τώρα για να φανεί η τελευταία έκδοση;","logout":"Αποσυνδέθηκες.","refresh":"Ανανέωση","read_only_mode":{"enabled":"Αυτή η ιστοσελίδα είναι σε λειτουργία μόνο ανάγνωσης. Παρακαλώ συνέχισε να κάνεις περιήγηση, όμως το να απαντάς να πατάς \"μου αρέσει\" και κάποιες άλλες λειτουργίες δεν είναι διαθέσιμες τώρα.","login_disabled":"Η δυνατότητα σύνδεσης έχει απενεργοποιηθεί όσο η ιστοσελίδα είναι σε κατάσταση μόνο ανάγνωσης.","logout_disabled":"Η αποσύνδεση δεν είναι διαθέσιμη ενώ η ιστοσελίδα είναι σε λειτουργία μόνο ανάγνωσης."},"learn_more":"μάθε περισσότερα...","all_time":"σύνολο","all_time_desc":"συνολικά δημιουργημένα νήματα","year":"έτος","year_desc":"νήματα που έχουν δημιουργηθεί τις τελευταίες 365 ημέρες","month":"μήνας","month_desc":"νήματα που έχουν δημιουργηθεί τις τελευταίες 30 ημέρες","week":"εβδομάδα","week_desc":"νήματα που έχουν δημιουργηθεί τις τελευταίες 7 ημέρες","day":"ημέρα","first_post":"Πρώτη ανάρτηση","mute":"Σίγαση","unmute":"Αναίρεση σίγασης","last_post":"Αναρτήθηκε","time_read":"Διαβάστηκε","time_read_recently":"%{time_read} πρόσφατα","time_read_tooltip":"%{time_read} συνολικός χρόνος ανάγνωσης","time_read_recently_tooltip":"%{time_read}συνολικός χρόνος ανάγνωσης (%{recent_time_read} τις τελευταίες 60 ημέρες)","last_reply_lowercase":"τελευταία απάντηση","replies_lowercase":{"one":"απάντηση","other":"απαντήσεις"},"signup_cta":{"sign_up":"Εγγραφή","hide_session":"Υπενθύμιση αύριο","hide_forever":"όχι ευχαριστώ","hidden_for_session":"Εντάξει, θα σε ρωτήσω αύριο. Μπορείς πάντα να χρησιμοποιείς τη \"Σύνδεση\" για να δημιουργήσεις ένα λογαριασμό."},"summary":{"enabled_description":"Βλέπεις μια περίληψη αυτού του νήματος: οι πιο ενδιαφέρουσες αναρτήσεις, όπως αυτές καθορίστηκαν από την κοινότητα.","description":"Υπάρχουν \u003cb\u003e{{replyCount}}\u003c/b\u003e απαντήσεις.","description_time":"Υπάρχουν \u003cb\u003e{{replyCount}}\u003c/b\u003e απαντήσεις με εκτιμώμενο χρόνο ανάγνωσης \u003cb\u003e{{readingTime}} λεπτών\u003c/b\u003e.","enable":"Σύνοψη του Νήματος","disable":"Εμφάνιση όλων των αναρτήσεων"},"deleted_filter":{"enabled_description":"Αυτό το νήμα περιέχει σβησμένες αναρτήσεις, οι οποίες αποκρύπτονται.","disabled_description":"Σε αυτό το νήμα εμφανίζονται oι σβησμένες αναρτήσεις.","enable":"Κρύψε τις σβησμένες αναρτήσεις","disable":"Εμφάνισε τις σβησμένες αναρτήσεις"},"private_message_info":{"title":"Μήνυμα","leave_message":"Σίγουρα θελετε να αφήσετε αυτό το μήνυμα;","remove_allowed_user":"Θέλεις σίγουρα να αφαιρέσεις τον/την {{name}} από αυτή τη συζήτηση;","remove_allowed_group":"Θέλεις σίγουρα να αφαιρέσεις τον/την {{name}} από αυτό το μήνυμα;"},"email":"Email","username":"Όνομα Χρήστη","last_seen":"Εθεάθη","created":"Δημιουργήθηκε","created_lowercase":"δημιουργήθηκε","trust_level":"Επίπεδο Εμπιστοσύνης","search_hint":"όνομα χρήστη, email ή IP διεύθυνση","create_account":{"disclaimer":"Κάνοντας εγγραφή συμφωνείς με την \u003ca href='{{privacy_link}}'\u003eπολιτική ιδιωτικότητας\u003c/a\u003e και με τους \u003ca href='{{tos_link}}'\u003eόρους χρήσης\u003c/a\u003e.","title":"Δημιουργία Λογαριασμού","failed":"Κάτι πήγε στραβά. Ίσως αυτή η διεύθυνση email να είναι ήδη δηλωμένη. Δοκίμασε την λειτουργία «ξέχασα τον κωδικό μου»."},"forgot_password":{"title":"Επαναφορά Κωδικού","action":"Ξέχασα τον κωδικό πρόσβασής μου","invite":"Δώσε το όνομα χρήστη σου ή την διεύθυνση email σου και θα σου στείλουμε ένα email για να ορίσεις νέο κωδικό πρόσβασης.","reset":"Επαναφορά Κωδικού Πρόσβασης","complete_username":"Αν βρεθεί λογαριασμός με το όνομα χρήστη \u003cb\u003e%{username}\u003c/b\u003e, σύντομα θα λάβεις ένα email με οδηγίες για το πως να ορίσεις νέο κωδικό πρόσβασης.","complete_email":"Αν υπάρχει λογαριασμός με τη διεύθυνση \u003cb\u003e%{email}\u003c/b\u003e, σε λίγο θα λάβεις ένα email με οδηγίες για το πως να ορίσεις νέο κωδικό πρόσβασης.","complete_username_not_found":"Δεν υπάρχει λογαριασμός με το όνομα χρήστη \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Δεν υπάρχει λογαριασμός με τη διεύθυνση \u003cb\u003e%{email}\u003c/b\u003e","help":"Δεν λαμβάνετε το email; Ελέγξτε αρχικά τον φάκελο spam.\u003cp\u003eΔεν γνωρίζετε ποια διεύθυνση email χρησιμοποιήσατε; Πείτε μας την διεύθυνση που θεωρείτε πιο πιθανή και θα σας πούμε αν υπάρχει στο σύστημα.\u003c/p\u003e\u003cp\u003eΑν δεν έχετε πλέον πρόσβαση στην διεύθυνση email του λογαριασμού σας, παρακαλούμε επικοινωνήστε\u003ca href='%{basePath}/about'\u003eμε την ομάδα διαχείρισης.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Βοήθεια"},"email_login":{"complete_username_not_found":"Δεν υπάρχει λογαριασμός με το όνομα χρήστη \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Δεν υπάρχει λογαριασμός με τη διεύθυνση \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Συνεχίστε στην %{site_name}"},"login":{"title":"Σύνδεση","username":"Όνομα Χρήστη","password":"Κωδικός Πρόσβασης","email_placeholder":"διεύθυνση email ή όνομα χρήστη","caps_lock_warning":"Είναι ενεργά τα ΚΕΦΑΛΑΙΑ","error":"Άγνωστο σφάλμα","rate_limit":"Παρακαλώ περιμένετε προτού προσπαθήσετε ξανά να συνδεθείτε.","blank_username_or_password":"Παρακαλώ δώσε την διεύθυνση email σου ή το όνομα χρήστη σου καθώς και τον κωδικό πρόσβασής σου.","reset_password":"Επαναφορά Κωδικού Πρόσβασης","logging_in":"Σύνδεση...","or":"Ή","authenticating":"Ταυτοποιώ...","awaiting_activation":"Ο λογαριασμός σας αναμένει ενεργοποίηση, χρησιμοποιήστε τον σύνδεσμο ξεχασμένου συνθηματικού για δημιουργία νέου email ενεργοποίησης.","awaiting_approval":"Ο λογαριασμός σου δεν έχει εγκριθεί από κανέναν συνεργάτη ακόμη. Θα λάβεις ένα email όταν εγκριθεί.","requires_invite":"Λυπούμαστε, αλλά η πρόσβαση σε αυτό το φόρουμ είναι δυνατή μόνο με πρόσκληση.","not_activated":"Δεν γίνεται να συνδεθείς ακόμη. Έχουμε ήδη στείλει ένα email με οδηγίες ενεργοποίησης στη διεύθυνση \u003cb\u003e{{sentTo}}\u003c/b\u003e. Ακολούθησε τις οδηγίες σε αυτό το μήνυμα για να ενεργοποιήσεις το λογαριασμό σου.","not_allowed_from_ip_address":"Δεν μπορείς να συνδεθείς από αυτή τη διεύθυνση IP.","admin_not_allowed_from_ip_address":"Από αυτή τη διεύθυνση IP δεν επιτρέπεται να συνδεθείς ως διαχειριστής.","resend_activation_email":"Πάτησε εδώ για να σταλεί ξανά το email ενεργοποίησης.","resend_title":"Επαναποστολή Email Ενεργοποίησης","change_email":"Αλλαγή Διεύθυνσης Email","provide_new_email":"Καταχωρήστε μια νέα διεύθυνση και θα σας στείλουμε εκ νέου το email ενεργοποίησης.","submit_new_email":"Ενημέρωση Διεύθυνσης Email","sent_activation_email_again":"Στάλθηκε ένα ακόμα email ενεργοποίησης στο \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Θα χρειαστούν κάποια λεπτά για να το λάβεις, βεβαιώσου ότι έλεγξες και το φάκελο ανεπιθύμητης αλληλογραφίας.","to_continue":"Παρακαλώ Συνδεθείτε","preferences":"Πρέπει να συνδεθείς για να αλλάξεις τις προτιμήσεις χρήστη.","forgot":"Δεν θυμάμαι τις λεπτομέρειες του λογαριασμού μου","not_approved":"Ο λογαριασμός σας δεν έχει εγκριθεί ακόμα. Θα ειδοποιηθείτε με email όταν είστε έτοιμοι να συνδεθείτε.","google_oauth2":{"name":"Google","title":"μέσω της Google"},"twitter":{"name":"Twitter","title":"μέσω του Twitter"},"instagram":{"title":"μέσω του Instagram"},"facebook":{"title":"μέσω του Facebook"},"github":{"title":"μέσω του GitHub"}},"invites":{"accept_title":"Πρόσκληση","welcome_to":"Καλώς ήλθατε στην %{site_name}!","invited_by":"Προσκληθήκατε από:","social_login_available":"Μπορείτε επίσης να συνδεθείτε μέσω λογαριασμών κοινωνικής δικτύωσης στους οποίους χρησιμοποιείτε αυτό το email.","your_email":"Η διεύθυνση email του λογαριασμού σας είναι \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Αποδοχή Πρόσκλησης","success":"Ο λογαριασμός σας έχει δημιουργηθεί και έχετε συνδεθεί. ","name_label":"Όνομα","password_label":"Ορισμός Κωδικού Πρόσβασης","optional_description":"(προεραιτικό)"},"password_reset":{"continue":"Συνεχίστε στην %{site_name}"},"emoji_set":{"apple_international":"Apple/Διεθνής","google":"Google","twitter":"Twitter","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Μόνο Κατηγορίες","categories_with_featured_topics":"Κατηγορίες με Προτεινόμενα Νήματα","categories_and_latest_topics":"Κατηγορίες και Τελευταία Νήματα"},"shortcut_modifier_key":{"shift":" Shift","ctrl":"Ctrl","alt":"Alt"},"conditional_loading_section":{"loading":"Φόρτωση... "},"select_kit":{"default_header_text":"Επιλογή...","no_content":"Δεν βρέθηκαν αποτελέσματα","filter_placeholder":"Αναζήτηση..."},"date_time_picker":{"from":"Από","to":"Προς"},"emoji_picker":{"filter_placeholder":"Αναζήτηση για emoji","objects":"Αντικείμενα","flags":"Σημάνσεις","custom":"Προσαρμοσμένα emojis","recent":"Πρόσφατα χρησιμοποιημένα","default_tone":"Χωρίς απόχρωση επιδερμίδας","light_tone":"Λευκή απόχρωση επιδερμίδας","medium_light_tone":"Ανοιχτόχρωμη απόχρωση επιδερμίδας","medium_tone":"Μέτρια απόχρωση επιδερμίδας","medium_dark_tone":"Σκουρόχρωμη απόχρωση επιδερμίδας","dark_tone":"Σκούρη απόχρωση επιδερμίδας"},"composer":{"emoji":"Emoji :)","more_emoji":"περισσότερα...","options":"Επιλογές","whisper":"ψιθύρισμα","unlist":"κρυμμένο","blockquote_text":"Blockquote","add_warning":"Αυτή είναι μια επίσημη προειδοποίηση.","toggle_whisper":"Εναλλαγή Ψιθύρων","toggle_unlisted":"Εναλλαγή Κρυφών","posting_not_on_topic":"Σε ποιο νήμα θέλεις να απαντήσεις;","saved_local_draft_tip":"αποθηκεύτηκε τοπικά","similar_topics":"Το νήμα σας είναι παρόμοιο με ...","drafts_offline":"τοπικά πρόχειρα","group_mentioned":{"one":"Αναφέροντας {{group}}, πρόκειται να λάβει ειδοποίηση \u003ca href='{{group_link}}'\u003e %{count} άτομο\u003c/a\u003e - είσαι βέβαιος;","other":"Αναφέροντας το {{group}}, πρόκειται να ειδοποίησεις \u003ca href='{{group_link}}'\u003e{{count}} μέλη\u003c/a\u003e - είσαι σίγουρος;"},"cannot_see_mention":{"category":"Ανέφερες το {{username}} αλλά δε θα λάβουν ειδοποίηση, επειδή δεν έχουν πρόσβαση σε αυτή την κατηγορία. Θα πρέπει να τους προσθέσεις σε μια ομάδα που έχει πρόσβαση σε αυτή την κατηγορία.","private":"Ανέφερες {{username}} αλλά δεν θα λάβουν ειδοποίηση, επειδή δεν μπορούν να δουν αυτό το προσωπικό μήνυμα. Πρέπει να τους προσκαλέσεις σε αυτό το ΠΜ."},"duplicate_link":"Όπως φαίνετα ο σύνδεσμος σας προς \u003cb\u003e{{domain}}\u003c/b\u003e έχει ήδη αναρτηθεί στο νήμα από \u003cb\u003e@{{username}}\u003c/b\u003e σε μία \u003ca href='{{post_url}}'\u003eαπάντηση πριν από {{ago}}\u003c/a\u003e – θέλετε σίγουρα να αναρτήσετε τον σύνδεσμο ξανά;","error":{"title_missing":"Απαιτείται τίτλος","title_too_short":"Ο τίτλος πρέπει να έχει τουλάχιστον {{min}} χαρακτήρες","title_too_long":"Ο τίτλος δεν μπορεί να έχει πάνω από {{max}} χαρακτήρες","post_length":"Κάθε ανάρτηση πρέπει να περιέχει τουλάχιστον {{min}} χαρακτήρες","category_missing":"Πρέπει να διαλέξεις μια κατηγορία"},"save_edit":"Αποθήκευση Επεξεργασίας","reply_original":"Απάντηση στο αρχικό νήμα","reply_here":"Απάντησε Εδώ","reply":"Απάντηση","cancel":"Ακύρωση","create_topic":"Δημιουργία Νήματος","create_pm":"Μήνυμα","create_whisper":"Ψυθίρισμα","title":"Ή πάτα Ctrl+Enter","users_placeholder":"Προσθήκη χρήστη","title_placeholder":"Τι αφορά αυτή η συζήτησης σε μία σύντομη πρόταση;","title_or_link_placeholder":"Πληκτρολόγησε τίτλο, ή κάνε επικόλληση ένα σύνδεσμο εδώ","edit_reason_placeholder":"γιατί αναθεωρείς;","topic_featured_link_placeholder":"Εισάγετε τον συνδέσμο που εμφανίζεται με τον τίτλο","reply_placeholder":"Πληκτρολόγησε εδώ. Χρησιμοποίησε την μορφή Markdown, BBCode, ή HTML. Σύρε ή επικόλλησε εικόνες.","view_new_post":"Δες τη νέα σου ανάρτηση.","saving":"Αποθηκεύεται","saved":"Αποθηκεύτηκε!","uploading":"Ανεβαίνει...","show_preview":"εμφάνιση προεπισκόπησης \u0026raquo;","hide_preview":"\u0026laquo; απόκρυψη προεπισκόπησης","quote_post_title":"Παράθεση ολόκληρης την ανάρτησης","bold_label":"B","bold_title":"Έντονα","bold_text":"έντονη γραφή","italic_label":"I","italic_title":"Έμφαση","italic_text":"κείμενο σε έμφαση","link_title":"Υπερσύνδεσμος","link_description":"δώσε εδώ μια περιγραφή για το σύνδεσμο","link_dialog_title":"Εισαγωγή Υπερσύνδεσμου","link_optional_text":"προαιρετικός τίτλος","quote_title":"Μπλοκ Κειμένου","quote_text":"Μπλοκ κειμένου σε παράθεση","code_title":"Προ-διαμορφωμένο κείμενο","code_text":"το προ-διαμορφωμένο κείμενο να μπει σε εσοχή με 4 κενά","paste_code_text":"πληκτρολογήστε ή επικολλήστε τον κώδικα εδώ","upload_title":"Ανέβασμα","upload_description":"δώσε μια περιγραφή για την μεταφόρτωση","olist_title":"Αριθμημένη λίστα","ulist_title":"Κουκίδες","list_item":"Στοιχείο Λίστας","help":"Βοήθεια Επεξεργασίας Markdown","modal_ok":"OK","modal_cancel":"Ακύρωση","cant_send_pm":"Λυπούμαστε, δεν μπορείτε να στείλετε μήνυμα στο χρήστη %{username}.","yourself_confirm":{"title":"Ξεχάσατε να προσθέσετε αποδέκτες;","body":"Αυτή τη στιγμή το μήνυμα στέλνεται μόνο σε εσάς!"},"admin_options_title":"Προαιρετικές ρυθμίσεις συνεργατών για αυτό το νήμα","composer_actions":{"reply":"Απάντηση","edit":"Επεξεργασία","create_topic":{"label":"Νέο Νήμα"}},"details_title":"Περίληψη"},"notifications":{"title":"ειδοποιήσεις για αναφορές στο @name, απαντήσεις στις αναρτήσεις σου και στα νήματά σου, προσωπικά μηνύματα, κλπ.","none":"Αυτή τη στιγμή δεν είναι δυνατόν να φορτωθούν οι ειδοποιήσεις.","empty":"Δεν βρέθηκαν ειδοποιήσεις.","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} και %{count} ακόμα\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} και {{count}} ακόμα\u003c/span\u003e {{description}}"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e αποδέχτηκε την πρόσκλησή σου","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e μετακίνησε {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Έλαβες '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eΝέο Νήμα\u003c/span\u003e {{description}}","group_message_summary":{"one":"{{count}} μήνυμα στα εισερχόμενα της ομάδας {{group_name}}","other":"{{count}} μηνύματα στα εισερχόμενα της ομάδας {{group_name}} "},"popup":{"mentioned":"{{username}} σε ανέφερε στο \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} σε ανέφερε στο \"{{topic}}\" - {{site_title}}","quoted":"{{username}} σε παράθεσε στο \"{{topic}}\" - {{site_title}}","replied":"{{username}} σου απάντησε στο \"{{topic}}\" - {{site_title}}","posted":"{{username}} ανάρτησε στο \"{{topic}}\" - {{site_title}}","linked":"{{username}} έκανε μια σύνδεση στην ανάρτηση που έκανες στο νήμα \"{{topic}}\" - {{site_title}}"},"titles":{"watching_first_post":"νέο νήμα"}},"upload_selector":{"title":"Προσθήκη εικόνας","title_with_attachments":"Προσθήκη εικόνας ή αρχείου","from_my_computer":"Από τη συσκευή μου","from_the_web":"Από το διαδίκτυο","remote_tip":"υπερσύνδεσμος προς μια εικόνα","remote_tip_with_attachments":"σύνδεσμος σε εικόνα ή αρχείο {{authorized_extensions}}","local_tip":"επιλογή εικόνων από τη συσκευή σου","local_tip_with_attachments":"επίλεξε εικόνες ή αρχεία από τη συσκευή σου {{authorized_extensions}}","hint":"(μπορείς επίσης να τα σύρεις με το ποντίκι στον editor για να τα ανεβάσεις)","hint_for_supported_browsers":"μπορείς επίσης να σύρεις ή να επικόλλησεις εικόνες στον editor","uploading":"Ανεβαίνει","select_file":"Επιλογή Αρχείου","default_image_alt_text":"εικόνα"},"search":{"sort_by":"Ταξινόμηση κατά","relevance":"Συνάφεια","latest_post":"Νεότερη Ανάρτηση","latest_topic":"Νεότερο Νήμα","most_viewed":"Περισσότερες Εμφανίσεις","most_liked":"Περισσότερα \"Μου Αρέσει\"","select_all":"Επιλογή Όλων","clear_all":"Καθαρισμός Όλων","too_short":"Ο όρος αναζήτησής σου είναι πολύ μικρός.","title":"ψάξε σε νήματα, αναρτήσεις, χρήστες ή κατηγορίες","no_results":"Δε βρέθηκαν αποτελέσματα.","no_more_results":"Δε βρέθηκαν άλλα αποτελέσματα","searching":"Ψάχνω ...","post_format":"#{{post_number}} από {{username}}","results_page":"Αποτελέσματα αναζήτησης για '{{term}}'","more_results":"Υπάρχουν περισσότερα αποτελέσματα. Παρακαλούμε περιορίστε την αναζήτησή σας.","cant_find":"Δεν μπορείτε να βρείτε αυτό που ψάχνετε;","start_new_topic":"Ίσως να ξεκινούσατε ένα νέο νήμα;","or_search_google":"Ή προσπαθήστε να κάνετε αναζήτηση με το Google:","search_google":"Προσπαθήστε να κάνετε αναζήτηση με το Google:","search_google_button":"Google","search_google_title":"Αναζήτηση στην ιστοσελίδα","context":{"user":"Ψάξε στις αναρτήσεις του χρήστη @{{username}}","category":"Αναζήτηση στην κατηγορία #{{category}} ","topic":"Ψάξε σε αυτό το νήμα","private_messages":"Αναζήτηση στα μηνύματα"},"advanced":{"title":"Προηγμένη Αναζήτηση","posted_by":{"label":"Αναρτήθηκε από"},"in_group":{"label":"Σε ομάδα"},"with_badge":{"label":"Με Παράσημο"},"filters":{"likes":"μου άρεσαν","posted":"απάντησα","watching":"επιτηρώ","tracking":"παρακολουθώ","first":"είναι η πρώτη ανάρτηση","pinned":"είναι καρφιτσωμένα","unpinned":"δεν είναι καρφιτσωμένα","unseen":"δεν διάβασα","wiki":" είναι βίκι"},"statuses":{"label":"Τα οποία νήματα","open":"είναι ανοιχτά","closed":"είναι κλειστά","archived":"είναι αρχειοθετημένα","noreplies":"έχουν μηδέν απαντήσεις","single_user":"περιέχουν ένα μόνο χρήστη"},"post":{"count":{"label":"Ελάχιστος αριθμός αναρτήσεων"},"time":{"label":"Αναρτήθηκε","before":"πριν","after":"μετά"}}}},"hamburger_menu":"πήγαινε σε άλλη καταχώρηση νήματος ή κατηγορία","new_item":"καινούριο","go_back":"επιστροφή","not_logged_in_user":"σελίδα λογαριασμού που περιέχει σύνοψη της τρέχουσας δραστηριότητας και τις προτιμήσεις","current_user":"πήγαινε στη σελίδα του λογαριασμού σου","topics":{"new_messages_marker":"τελευταία επίσκεψη","bulk":{"select_all":"Επιλογή Όλων","clear_all":"Καθαρισμός Όλων","unlist_topics":"Απόκρυψη Νημάτων","relist_topics":"Εμφάνιση Νημάτων","reset_read":"Μηδενισμός Διαβασμένων","delete":"Διαγραφή Νημάτων","dismiss":"Απόρριψη","dismiss_read":"Απόρριψη όλων των μη αναγνωσμένων","dismiss_button":"Απόρριψη...","dismiss_tooltip":"Απόρριψη μόνο των νέων αναρτήσεων ή διακοπή της παρακολούθησης νημάτων","also_dismiss_topics":"Διακοπή παρακολούθησης αυτών των νημάτων ώστε να μην εμφανιστούν ξανά ως μη αναγνωσμένα σε εμένα","dismiss_new":"Αγνόησε τα νέα","toggle":"εναλλαγή μαζικής επιλογής νημάτων","actions":"Μαζικές Ενέργειες","change_category":"Θέσε Κατηγορία","close_topics":"Κλείσιμο Νημάτων","archive_topics":"Αρχειοθέτηση Νημάτων","notification_level":"Ειδοποιήσεις","choose_new_category":"Διάλεξε νέα κατηγορία για τα νήματα:","selected":{"one":"Έχεις διαλέξει \u003cb\u003e%{count}\u003c/b\u003e νήμα.","other":"Έχεις διαλέξει \u003cb\u003e{{count}}\u003c/b\u003e νήματα."},"change_tags":"Αντικατάσταση Ετικετών ","append_tags":"Προσάρτηση Ετικετών ","choose_new_tags":"Επίλεξε καινούριες ετικέτες για αυτά τα νήματα:","choose_append_tags":"Επιλογή νέων ετικετών για την προσάρτηση τους σε αυτά τα νήματα","changed_tags":"Οι ετικέτες αυτών των νημάτων έχουν αλλάξει."},"none":{"unread":"Έχεις διαβάσει όλα τα νήματα.","new":"Δεν υπάρχουν νέα νήματα.","read":"Δεν έχεις διαβάσει κανένα νήμα ακόμη.","posted":"Δεν έχεις αναρτήσει σε κάποιο νήμα ακόμη.","latest":"Δεν υπάρχουν νέα νήματα. Αυτό είναι λυπηρό.","bookmarks":"Δεν έχεις βάλει σελιδοδείκτη σε κανένα νήμα.","category":"Δεν υπάρχουν νήματα στην κατηγορία {{category}}.","top":"Δεν υπάρχουν κορυφαία νήματα.","educate":{"new":"\u003cp\u003eΤα νέα σου νήματα εμφανίζονται εδώ.\u003c/p\u003e\u003cp\u003eΑπό προεπιλογή, τα νήματα συζητήσεων θεωρούνται καινούρια και θα δείχνουν ένα \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eκαινούριο\u003c/span\u003e δείκτη εαν έχουν δημιουργηθεί τις τελευταίες 2 μέρες.\u003c/p\u003e\u003cp\u003eΕπισκέψου τις \u003ca href=\"%{userPrefsUrl}\"\u003eπροτιμήσεις σου\u003c/a\u003e για να το αλλάξεις αυτό.\u003c/p\u003e","unread":"\u003cp\u003eΤα αδιάβαστα νήματά σου εμφανίζονται εδώ.\u003c/p\u003e\u003cp\u003eΑπό προεπιλογή, τα νήματα συζητήσεων θεωρούνται αδιάβαστα και θα δείχνουν αριθμό αδιάβαστων αναρτήσεων \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e έαν:\u003c/p\u003e\u003cul\u003e\u003cli\u003e Δημιούργησες το νήμα\u003c/li\u003e\u003cli\u003eΑπάντησες στο νήμα\u003c/li\u003e\u003cli\u003eΔιάβασες το νήμα για περισσότερα από 4 λεπτά\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eΉ εάν έχεις ορίσει το νήμα να επιτηρείται ή να παρακολουθείται μέσω της επιλογής ειδοποιήσεων στο κάτω μέρος του κάθε νήματος.\u003c/p\u003e\u003cp\u003eΕπισκέψου τις \u003ca href=\"%{userPrefsUrl}\"\u003eπροτιμήσεις σου\u003c/a\u003e για να το αλλάξεις αυτό.\u003c/p\u003e"}},"bottom":{"latest":"Δεν υπάρχουν άλλα πρόσφατα νήματα.","posted":"Δεν υπάρχουν άλλα αναρτημένα νήματα.","read":"Δεν υπάρχουν άλλα διαβασμένα νήματα.","new":"Δεν υπάρχουν άλλα νέα νήματα.","unread":"Δεν υπάρχουν άλλα αδιάβαστα νήματα.","category":"Δεν υπάρχουν άλλα νήματα στην κατηγορία {{category}}.","top":"Δεν υπάρχουν άλλα κορυφαία νήματα.","bookmarks":"Δεν υπάρχουν άλλα νήματα με σελιδοδείκτη."}},"topic":{"filter_to":{"one":"%{count} δημοσίευση σε νήματα","other":"{{count}} αναρτήσεις σε νήματα"},"create":"Νέο Νήμα","create_long":"Δημιουργία νέου Νήματος","private_message":"Στείλε ένα προσωπικό μήνυμα","archive_message":{"help":"Αρχειοθέτηση μηνύματος","title":"Αρχειοθέτηση"},"move_to_inbox":{"title":"Μετακίνηση στα Εισερχόμενα","help":"Μετακίνηση μηνύματος πίσω στα Εισερχόμενα"},"defer":{"title":"Αναβολή"},"list":"Νήματα","new":"νέο νήμα","unread":"αδιάβαστο","new_topics":{"one":"%{count} νέο νήμα","other":"{{count}} νέα νήματα"},"unread_topics":{"one":"%{count} μη αναγνωσμένο νήμα","other":"{{count}} αδιάβαστα νήματα"},"title":"Νήμα","invalid_access":{"title":"Το νήμα είναι ιδιωτικό","description":"Λυπούμαστε, αλλά δεν έχεις πρόσβαση σε αυτό το νήμα!","login_required":"Θα πρέπει να συνδεθείς για να δείς αυτό το νήμα."},"server_error":{"title":"Το νήμα δεν ήταν δυνατό να φορτωθεί","description":"Λυπούμαστε, δεν μπορέσαμε να φορτώσουμε αυτό το νήμα, πιθανότατα λόγω προβλήματος στη σύνδεση. Παρακαλούμε δοκίμασε ξανά. Εάν το πρόβλημα επιμείνει ενημερώσέ μας."},"not_found":{"title":"Το νήμα δεν βρέθηκε.","description":"Συγνώμη, δεν μπορέσαμε να βρούμε αυτό το νήμα συζήτησης. Μήπως έχει αφαιρεθεί από κάποιον συντονιστή;"},"total_unread_posts":{"one":"έχεις %{count} αδιάβαστη ανάρτηση σε αυτό το νήμα","other":"έχεις {{count}} αδιάβαστες αναρτήσεις σε αυτό το νήμα"},"unread_posts":{"one":"έχεις %{count} αδιάβαστη παλιά ανάρτηση σε αυτό το νήμα","other":"έχεις {{count}} αδιάβαστες παλιές αναρτήσεις σε αυτό το νήμα"},"new_posts":{"one":"υπάρχει %{count} νέα ανάρτηση σε αυτό το νήμα από την τελευταία φορά που το διάβασες","other":"υπάρχουν {{count}} νέες αναρτήσεις σε αυτό το νήμα από την τελευταία φορά που το διάβασες"},"likes":{"one":"υπάρχει %{count} «Μου αρέσει» σε αυτό το νήμα","other":"υπάρχουν {{count}} «μου αρέσει» σε αυτό το νήμα"},"back_to_list":"Επιστροφή στη Λίστα Νημάτων","options":"Ρυθμίσεις Νήματος","show_links":"εμφάνιση συνδέσμων εντός του νήματος","toggle_information":"εναλλαγή λεπτομερειών νήματος","read_more_in_category":"Θέλεις να διαβάσεις περισσότερα; Βρες άλλα νήματα στο {{catLink}} ή {{latestLink}}.","read_more":"Θέλεις να διαβασεις περισσότερα; {{catLink}} ή {{latestLink}}.","browse_all_categories":"Περιήγηση σε όλες τις κατηγορίες","view_latest_topics":"δες τα πρόσφατα νήματα","suggest_create_topic":"Γιατί δεν φτιάχνεις ένα νέο νήμα;","jump_reply_up":"μετάβαση στην απάντηση που προηγείται","jump_reply_down":"μετάβαση στην απάντηση που ακολουθεί","deleted":"Το νήμα έχει διαγραφεί ","topic_status_update":{"title":"Χρονοδιακόπτης Νήματος","save":"Ρύθμιση Χρονοδιακόπτη","num_of_hours":"Ώρες:","remove":"Αφαίρεση Χρονοδιακόπτη","publish_to":"Δημοσίευση Σε:","when":"Πότε:","public_timer_types":"Χρονοδιακόπτες Νημάτων","private_timer_types":"Χρονοδιακόπτες Νημάτων Χρήστη"},"auto_update_input":{"none":"Επιλέξτε χρονικό περιθώριο","later_today":"Αργότερα σήμερα","tomorrow":"Αύριο","later_this_week":"Αργότερα αυτή την εβδομάδα","this_weekend":"Αυτό το Σαββατοκύριακο","next_week":"Την άλλη εβδομάδα","two_weeks":"Δύο Εβδομάδες","next_month":"Τον άλλο μήνα","three_months":"Τρεις Μήνες","six_months":"Έξη Μήνες","one_year":"Ένα Έτος","forever":"Για Πάντα","pick_date_and_time":"Επίλεξε ημερομηνία και ώρα","set_based_on_last_post":"Κλείσε ανάλογα με την τελευταία ανάρτηση"},"publish_to_category":{"title":"Χρονοδιάγραμμα Δημοσιεύσεων"},"temp_open":{"title":"Ανοιχτό Προσωρινά"},"auto_reopen":{"title":"Αυτόματο άνοιγμα νήματος"},"temp_close":{"title":"Κλειστό Προσωρινά"},"auto_close":{"title":"Αυτόματο κλείσιμο νήματος","label":"Ώρες αυτόματου κλεισίματος νήματος:","error":"Παρακαλώ εισάγετε μια έγκυρη αξία.","based_on_last_post":"Να μην κλείσει μέχρι η τελευταία ανάρτηση στο νήμα να είναι τόσο παλιά."},"auto_delete":{"title":"Αυτόματη διαγραφή νήματος"},"reminder":{"title":"Υπενθύμισέ Μου"},"status_update_notice":{"auto_open":"Αυτό το νήμα θα ανοίξει αυτόματα σε %{timeLeft}.","auto_close":"Αυτό το νήμα θα κλείσει αυτόματα σε %{timeLeft}.","auto_publish_to_category":"Αυτό το νήμα θα αναρτηθεί στην κατηγορία \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"Αυτό το νήμα θα κλείσει σε %{duration} μετά την τελευταία απάντηση.","auto_delete":"Αυτό το νήμα θα διαγραφεί αυτόματα σε %{timeLeft}.","auto_reminder":"Θα λάβεις υπενθύμιση σχετικά με αυτό το νήμα σε %{timeLeft}."},"auto_close_title":"Ρυθμίσεις για το αυτόματο κλείσιμο","auto_close_immediate":{"one":"Η τελευταία δημοσίευση στο νήμα είναι ήδη %{count} ώρα παλιό, έτσι το νήμα θα κλείσει αμέσως.","other":"Η τελευταία ανάρτηση είναι ήδη %{count} ώρες παλιά, έτσι το νήμα θα κλείσει αμέσως."},"timeline":{"back":"Πίσω","back_description":"Πήγαινε πίσω στην τελευταία μη αναγνωσμένη ανάρτηση","replies_short":"%{current} / %{total}"},"progress":{"title":"πρόοδος νήματος","go_top":"αρχή","go_bottom":"τέλος","go":"πάμε","jump_bottom":"μετάβαση στην τελευταία ανάρτηση","jump_prompt":"μετάβαση σε...","jump_prompt_of":"των %{count} αναρτήσεων","jump_bottom_with_number":"μετάβαση στην ανάρτηση %{post_number}","jump_prompt_or":"ή","total":"σύνολο αναρτήσεων","current":"τρέχουσα ανάρτηση"},"notifications":{"title":"άλλαξε το πόσο συχνά ειδοποιείσαι για αυτό το θέμα","reasons":{"mailing_list_mode":"Έχεις ενεργοποιημένη τη λειτουργία λίστας αποδεκτών αλληλογραφίας, έτσι θα λαμβάνεις ενημερώσεις για τις απαντήσεις για το νήμα μέσω email.","3_10":"Θα λαμβάνεις ειδοποιήσεις επειδή επιτηρείς μια ετικέτα σε αυτό το νήμα.","3_6":"Θα λαμβάνεις ειδοποιήσεις επειδή επιτηρείς αυτήν την κατηγορία.","3_5":"Θα λαμβάνεις ειδοποιήσεις επειδή ξεκίνησες να επιτηρείς αυτόματα αυτό το νήμα.","3_2":"Θα λαμβάνεις ειδοποιήσεις επειδή επιτηρείς αυτό το νήμα.","3_1":"Θα λαμβάνεις ειδοποιήσεις επειδή δημιούργησες αυτό το νήμα.","3":"Θα λαμβάνεις ειδοποιήσεις επειδή επιτηρείς αυτό το νήμα.","2_8":"Θα βλέπεις έναν μετρητή νέων απαντήσεων επειδή παρακολουθείς αυτήν την κατηγορία.","2_4":"Θα βλέπεις έναν μετρητή νέων απαντήσεων επειδή απάντησες σε αυτό το νήμα.","2_2":"Θα βλέπεις έναν μετρητή νέων απαντήσεων επειδή παρακολουθείς αυτό το νήμα.","2":"Θα βλέπεις έναν μετρητή νέων απαντήσεων επειδή \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eδιάβασες αυτό το νήμα\u003c/a\u003e.","1_2":"Θα λαμβάνεις ειδοποιήσεις εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε εσένα.","1":"Θα λαμβάνεις ειδοποιήσεις εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε εσένα.","0_7":"Αγνοείς όλες τις ειδοποιήσεις αυτής της κατηγορίας.","0_2":"Αγνοείς όλες τις ειδοποιήσεις αυτού του νήματος.","0":"Αγνοείς όλες τις ειδοποιήσεις αυτού του νήματος."},"watching_pm":{"title":"Επιτηρείται","description":"Θα λαμβάνεις ειδοποιήσεις για κάθε νέα απάντηση σε αυτό το μήνυμα και ένας μετρητής νέων απαντήσεων θα εμφανίζεται."},"watching":{"title":"Επιτηρείται","description":"Θα λαμβάνεις ειδοποιήσεις για κάθε νέα απάντηση σε αυτό το νήμα και ένας μετρητής νέων απαντήσεων θα εμφανίζεται."},"tracking_pm":{"title":"Παρακολουθείται","description":"Ένας μετρητής νέων απαντήσεων θα εμφανίζεται για αυτό το μήνυμα. Θα λαμβάνεις ειδοποιήσεις εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε εσένα."},"tracking":{"title":"Παρακολουθείται","description":"Ένας μετρητής νέων απαντήσεων θα εμφανίζεται για αυτό το νήμα. Θα λαμβάνεις ειδοποιήσεις εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε εσένα."},"regular":{"title":"Φυσιολογικό","description":"Θα ειδοποιηθείς εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε εσένα."},"regular_pm":{"title":"Φυσιολογικό","description":"Θα ειδοποιηθείς εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε εσένα."},"muted_pm":{"title":"Σε σίγαση","description":"Δε θα ειδοποιείσαι ποτέ για οτιδήποτε σχετικά με αυτό το μήνυμα."},"muted":{"title":"Σε σίγαση","description":"Δε θα ειδοποιείσαι ποτέ για οτιδήποτε σχετικά με αυτό το θέμα και δε θα εμφανίζεται στα τελευταία."}},"actions":{"title":"Ενέργειες","recover":"Επαναφορά του νήματος","delete":"Διαγραφή Νήματος","open":"Νέο Νήμα","close":"Κλείσιμο Νήματος","multi_select":"Διάλεξε Αναρτήσεις...","timed_update":"Θέσε Χρονοδιακόπτη Νήματος...","pin":"Καρφίτσωμα Νήματος...","unpin":"Ξεκαρφίτσωμα Νήματος...","unarchive":"Επαναφορά Νήματος από Αρχείο","archive":"Αρχειοθέτηση Νήματος","invisible":"Απόκρυψη Νήματος","visible":"Εμφάνιση Νήματος","reset_read":"Μηδενισμός Διαβασμένων","make_public":"Κάνε Δημόσιο το Νήμα"},"feature":{"pin":"Καρφίτσωμα Νήματος","unpin":"Ξεκαρφίτσωμα Νήματος","pin_globally":"Καθολικό Καρφίτσωμα Νήματος","make_banner":"Νήμα Ανακοίνωσης","remove_banner":"Αφαίρεση Νήματος Ανακοίνωσης"},"reply":{"title":"Απάντηση","help":"ξεκινήστε να συνθέτετε μια απάντηση σε αυτό το νήμα"},"clear_pin":{"title":"Ξεκαρφίτσωμα","help":"Ξεκαρφίτσωσε αυτό το νήμα ώστε να μην εμφανίζεται πια στην κορυφή της λίστας."},"share":{"title":"Κοινοποίηση","help":"κοινοποίησε έναν σύνδεσμο προς αυτό το νήμα"},"print":{"title":"Εκτύπωση","help":"Άνοιξε μια φιλική έκδοση εκτυπωτή αυτού του νήματος"},"flag_topic":{"title":"Σήμανση","help":"επισήμανε ιδιωτικά αυτό το νήμα για έλεγχο ή στείλε μια προσωπική ειδοποίηση σχετικά με αυτό","success_message":"Επισήμανες αυτό το νήμα."},"feature_topic":{"title":"Θέσε το νήμα σε προβολή","pin":"Το νήμα αυτό να εμφανίζεται στην κορυφή της {{categoryLink}} κατηγορίας μέχρι","confirm_pin":"Υπάρχουν ήδη {{count}} καρφιτσωμένα νήματα. Τόσα πολλά καρφιτσωμένα νήματα μπορεί να είναι υπερβολικός φόρτος για νέους και ανώνυμους χρήστες. Θες στ' αλήθεια να καρφιτσώσεις ακόμη ένα νήμα σε αυτή την κατηγορία;","unpin":"Απομάκρυνε το νήμα από την κορυφή της κατηγορίας {{categoryLink}}.","unpin_until":"Απομάκρυνε το νήμα από την κορυφή της {{categoryLink}} κατηγορίας ή περίμενε μέχρι \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Οι χρήστες μπορούν να ξεκαρφιτσώσουν αυτό το νήμα ο καθένας για τον εαυτό του.","pin_validation":"Απαιτείται ημερομηνία για να καρφιτσώσεις το νήμα.","not_pinned":"Δεν υπάρχουν νήματα καρφιτσωμένα σε {{categoryLink}}.","already_pinned":{"one":"Νήμα καρφιτσωμένο σε {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Νήματα καρφιτσωμένα σε {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Εμφάνισε αυτό το νήμα στην κορυφή όλων των λιστών νημάτων μέχρι","confirm_pin_globally":"Υπάρχουν ήδη {{count}} καθολικά καρφιτσωμένα νήματα. Τόσα πολλά καρφιτσωμένα νήματα μπορεί να είναι υπερβολικός φόρτος για νέους και ανώνυμους χρήστες. Θες στ' αλήθεια να καρφιτσώσεις καθολικά ακόμη ένα νήμα;","unpin_globally":"Αφαίρεσε αυτό το νήμα από την κορυφή όλων των λίστων νημάτων","unpin_globally_until":"Αφαίρεσε αυτό το νήμα από την κορυφή όλων των λίστων νημάτων ή περίμενε μέχρι \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Οι χρήστες μπορούν να ξεκαρφιτσώσουν το νήμα ο καθένας για τον εαυτό του.","not_pinned_globally":"Δεν υπάρχουν καθολικά καρφιτσωμένα νήματα.","already_pinned_globally":{"one":"Πρόσφατα καθολικά καρφιτσωμένα νήματα:\u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Πρόσφατα καθολικά καρφιτσωμένα νήματα: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Αυτό το νήμα να γίνει νήμα ανακοίνωσης και να εμφανίζεται στην κορυφή όλων των σελίδων.","remove_banner":"Αφαίρεσε το νήμα ανακοίνωσης το οποίο εμφανίζεται στην κορυφή όλων των σελίδων.","banner_note":"Οι χρήστες μπορούν να κλείσουν την ανακοίνωση έτσι ώστε να μην εμφανίζεται σε αυτούς. Ένα μόνο νήμα μπορεί να είναι νήμα ανακοίνωσης κάθε φορά.","no_banner_exists":"Δεν υπάρχει νήμα ανακοίνωσης.","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eΥπάρχει\u003c/strong\u003e προς το παρόν ένα νήμα ανακοίνωσης."},"inviting":"Οι προσκλήσεις αποστέλλονται...","automatically_add_to_groups":"Αυτή η πρόσκληση συμπεριλαμβάνει επίσης και πρόσβαση σε αυτές τις ομάδες:","invite_private":{"title":"Πρόσκληση σε Μήνυμα","email_or_username":"Διεύθυνση email ή όνομα χρήστη του προσκεκλημένου","email_or_username_placeholder":"διεύθυνση email ή όνομα χρήστη","action":"Πρόσκληση","success":"Προσκαλέσαμε το χρήστη να συμμετέχει σε αυτό το μήνυμα.","success_group":"Προσκαλέσαμε την ομάδα να συμμετέχει σε αυτό το μήνυμα.","error":"Συγγνώμη, παρουσιάστηκε σφάλμα κατά την πρόσκληση αυτού του χρήστη.","group_name":"όνομα ομάδας"},"controls":"Λειτουργίες Νήματος","invite_reply":{"title":"Πρόσκληση","username_placeholder":"όνομα χρήστη","action":"Αποστολή Πρόσκλησης","help":"να προσκληθούν και άλλοι σε αυτό το νήμα με email ή με ειδοποίηση","to_forum":"Θα στείλουμε ένα σύντομο email στον φίλο σας για να συμμετέχει άμεσα κάνοντας κλικ σε ένα σύνδεσμο. Δεν θα χρειαστεί να συνδεθεί.","sso_enabled":"Δώσε το όνομα χρήστη του ατόμου που θα ήθελες να προσκαλέσεις σε αυτό το νήμα.","to_topic_blank":"Δώσε το όνομα χρήστη ή το email του ατόμου που θα ήθελες να προσκαλέσεις σε αυτό το νήμα.","to_topic_email":"Έδωσες μια διεύθυνση email. Θα στείλουμε μια πρόσκληση που θα επιτρέπει στον παραλήπτη να απαντήσει άμεσα σε αυτό το νήμα.","to_topic_username":"Έδωσες όνομα χρήστη. Θα στείλουμε ειδοποίηση με ένα σύνδεσμο πρόσκλησης προς αυτό το νήμα.","to_username":"Δώσε το όνομα χρήστη του ατόμου που θα ήθελες να προσκαλέσεις. Θα στείλουμε ειδοποίηση με ένα σύνδεσμο πρόσκλησης προς αυτό το νήμα.","email_placeholder":"name@example.com","success_email":"Στείλαμε μια πρόσκληση στον/στην \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Θα σε ειδοποιήσουμε όταν η πρόσκληση γίνει αποδεκτή. Στη σελίδα του προφίλ σου μπορείς να παρακολουθήσεις την εξέλιξη όλων των προσκλήσεών σου.","success_username":"Προσκαλέσαμε τον χρήστη να συμμετέχει σε αυτό το νήμα.","error":"Λυπούμαστε αλλά δεν μπορέσαμε να προσκαλέσουμε αυτό το άτομο. Μήπως έχει ήδη προσκληθεί; (ο ρυθμός αποστολής προσκλήσεων είναι περιορισμένος)","success_existing_email":"Ο χρήστης με email \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e υπάρχει ήδη. Προσκαλέσαμε αυτόν τον χρήστης να συμμετέχει στο νήμα."},"login_reply":"Συνδέσου για να απαντήσεις","filters":{"n_posts":{"one":"%{count} ανάρτηση","other":"{{count}} αναρτήσεις"},"cancel":"Αφαίρεση φίλτρου"},"split_topic":{"title":"Μεταφορά σε Νέο Νήμα ","action":"μεταφορά σε νέο νήμα ","radio_label":"Νέο Νήμα","error":"Παρουσιάστηκε σφάλμα κατά τη μεταφορά των αναρτήσεων στο νέο νήμα.","instructions":{"one":"Ετοιμάζεσαι να δημιουργήσεις ένα νέο νήμα και να μεταφέρεις σε αυτό την επιλεγμένη ανάρτηση.","other":"Ετοιμάζεσαι να δημιουργήσεις ένα νέο νήμα και να μεταφέρεις σε αυτό τις \u003cb\u003e{{count}}\u003c/b\u003e επιλεγμένες αναρτήσεις."}},"merge_topic":{"title":"Μεταφορά σε Υφιστάμενο Νήμα","action":"μεταφορά σε υφιστάμενο νήμα","error":"Παρουσιάστηκε σφάλμα κατά τη μεταφορά των αναρτήσεων σε αυτό το νήμα. ","instructions":{"one":"Παρακαλώ επίλεξε το νήμα στο οποίο θέλεις να μεταφέρεις την ανάρτηση.","other":"Παρακαλώ επίλεξε το νήμα στο οποίο θέλεις να μεταφέρεις τις \u003cb\u003e{{count}}\u003c/b\u003e αυτές αναρτήσεις."}},"move_to_new_message":{"radio_label":"Νέο Μήνυμα"},"merge_posts":{"title":"Συγχώνευσε Επιλεγμένες Αναρτήσεις","action":"συγχώνευσε επιλεγμένες αναρτήσεις","error":"Προέκυψε σφάλμα κατά τη συγχώνευση των επιλεγμένων αναρτήσεων."},"change_owner":{"action":"αλλαγή ιδιοκτήτη","error":"Παρουσιάστηκε ένα σφάλμα κατά την αλλαγή του ιδιοκτήτη των αναρτήσεων.","placeholder":"όνομα χρήστη του νέου ιδιοκτήτη"},"change_timestamp":{"title":"Αλλαγή Χρονοσήμανσης...","action":"αλλαγή χρονοσήμανσης","invalid_timestamp":"Η χρονοσήμανση δεν μπορεί να υπάρξει στο μέλλον.","error":"Προέκυψε σφάλμα κατά την αλλαγή χρονοσήμανσης του νήματος.","instructions":"Παρακαλώ επίλεξε τη νέα χρονοσήμανση του νήματος. Οι αναρτήσεις του νήματος θα ενημερωθούν ώστε να έχουν την ίδια διαφορά ώρας."},"multi_select":{"select":"επίλεξε","selected":"επιλεγμένες ({{count}})","select_post":{"label":"επίλεξε"},"select_replies":{"label":"επίλεξε +απαντήσεις"},"delete":"διαγραφή επιλεγμένων","cancel":"ακύρωση επιλογής","select_all":"επιλογή όλων","deselect_all":"απεπιλογή όλων","description":{"one":"Έχεις επιλέξει \u003cb\u003e%{count}\u003c/b\u003e ανάρτηση.","other":"Έχεις επιλέξει \u003cb\u003e{{count}}\u003c/b\u003e αναρτήσεις."}}},"post":{"quote_reply":"Παράθεση","edit_reason":"Αιτία:","post_number":"ανάρτηση {{number}}","wiki_last_edited_on":"το βίκι επεξεργάστηκε τελευταία φορά στις","last_edited_on":"η ανάρτηση επεξεργάστηκε τελευταία φορά στις","reply_as_new_topic":"Απάντηση με διασυνδεδεμένο νήμα","reply_as_new_private_message":"Απάντηση ως νέο μήνυμα στον ίδιο παραλήπτη","continue_discussion":"Συνέχιση της συζήτησης από το {{postLink}}:","follow_quote":"πήγαινε στην παρατεθειμένη ανάρτηση","show_full":"Δείξε Πλήρη Ανάρτηση ","deleted_by_author":{"one":"(η ανάρτηση ανακλήθηκε από το συγγραφέα της και θα σβηστεί αυτόματα σε %{count} ώρα, εκτός και αν κάποιος την επισημάνει στους συντοντιστές)","other":"(η ανάρτηση ανακλήθηκε από το συγγραφέα της και θα σβηστεί αυτόματα σε %{count} ώρες, εκτός και αν κάποιος την επισημάνει στους συντοντιστές)"},"expand_collapse":"επέκταση/σύμπτυξη","gap":{"one":"δες %{count} κρυφή απάντηση","other":"δες {{count}} κρυφές απαντήσεις"},"unread":"Η ανάρτηση δεν έχει διαβαστεί","has_replies":{"one":"{{count}} Απάντηση","other":"{{count}} Απαντήσεις"},"has_likes_title":{"one":"%{count} άτομο πάτησε \"μου αρέσει\" στη δημοσίευση","other":"{{count}} άτομα πάτησαν \"Μου αρέσει\" στην ανάρτηση"},"has_likes_title_only_you":"σου αρέσει αυτή η ανάρτηση","has_likes_title_you":{"one":"εσύ και %{count} άλλο άτομο πάτησε \"Μου αρέσει\" στη δημοσίευση","other":"εσύ και {{count}} ακόμα άτομα πατήσατε \"Μου αρέσει\" στην ανάρτηση"},"errors":{"create":"Λυπούμαστε, παρουσιάστηκε σφάλμα κατά την δημιουργία της ανάρτησης. Προσπάθησε πάλι.","edit":"Λυπούμαστε, παρουσιάστηκε σφάλμα κατά την επεξεργασία της ανάρτησης. Προσπάθησε πάλι.","upload":"Λυπούμαστε, παρουσιάστηκε σφάλμα κατά το ανέβασμα του αρχείου. Προσπάθησε πάλι.","too_many_uploads":"Λυπούμαστε, μπορείς να ανεβάζεις μόνο ένα αρχείο τη φορά.","upload_not_authorized":"Λυπούμαστε, το αρχείο που προσπαθείς να ανεβάσεις δεν επιτρέπεται (επιτρεπόμενες επεκτάσεις:{{authorized_extensions}})","image_upload_not_allowed_for_new_user":"Λυπούμαστε, οι νέοι χρήστες δεν μπορούν να ανεβάσουν εικόνες.","attachment_upload_not_allowed_for_new_user":"Λυπούμαστε, οι νέοι χρήστες δεν μπορούν να επισυνάψουν αρχεία.","attachment_download_requires_login":"Λυπούμαστε, για να κατεβάσεις συνημμένα αρχεία, πρέπει πρώτα να συνδεθείς."},"abandon_edit":{"no_value":"Όχι, κράτησέ τη"},"abandon":{"confirm":"Σίγουρα θέλεις να απορρίψεις την ανάρτησή σου;","no_value":"Όχι, κράτησέ τη","yes_value":"Ναί, απέρριψέ τη"},"via_email":"αυτή η ανάρτηση ήρθε μέσω email","via_auto_generated_email":"αυτή η ανάρτηση ήρθε μέσω ενός email που δημιουργήθηκε αυτόματα","whisper":"αυτή η ανάρτηση είναι εμπιστευτική προς τους συντονιστές","wiki":{"about":"αυτή η ανάρτηση είναι βίκι"},"archetypes":{"save":"Αποθήκευση Επιλογών"},"few_likes_left":"Ευχαριστούμε που μοιράστηκες την αγάπη σου! Έχεις μόνο μερικά \"μου αρέσει\" ακόμα να χρησιμοποιήσεις σήμερα.","controls":{"reply":"απάντησε σε αυτή την ανάρτηση","like":"αυτή η ανάρτηση μου αρέσει","has_liked":"σου άρεσε αυτή η ανάρτηση","undo_like":"δεν μου αρέσει πια","edit":"επεξεργασία ανάρτησης","edit_action":"Επεξεργασία","edit_anonymous":"Λυπούμαστε, αλλά για να επεξεργαστείς αυτή την ανάρτηση πρέπει πρώτα να συνδεθείς.","flag":"ανέφερε την ανάρτηση στους συντονιστές ή στείλε μια προσωπική ειδοποίηση σχετικά με αυτή","delete":"διαγραφή ανάρτησης","undelete":"επαναφορά ανάρτησης","share":"κοινοποίησε έναν σύνδεσμο προς αυτή την ανάρτηση ","more":"Περισσότερα","delete_replies":{"just_the_post":"Όχι, σβήσε μόνο την ανάρτηση"},"admin":"ενέργειες διαχειριστή ανάρτησης","wiki":"Δημιουργία Βίκι","unwiki":"Αφαίρεση Βίκι","convert_to_moderator":"Πρόσθεσε Χρώμα Συνεργάτη","revert_to_regular":"Αφαίρεσε Χρώμα Συνεργάτη","rebake":"Ανανέωση HTML","unhide":"Επανεμφάνιση","change_owner":"Αλλαγή Ιδιοκτησίας","grant_badge":"Απονομή Παράσημου","delete_topic":"διαγραφή νήματος"},"actions":{"flag":"Επισήμανση","defer_flags":{"one":"Αγνόηση επισήμανσης","other":"Αγνόηση επισημάνσεων"},"undo":{"off_topic":"Αναίρεση σήμανσης","spam":"Αναίρεση σήμανσης","inappropriate":"Αναίρεση σήμανσης","bookmark":"Αφαίρεση σελιδοδείκτη","like":"Αναίρεση «μου αρέσει»"},"people":{"off_topic":"επισήμαναν ως εκτός θέματος","spam":"επισήμαναν ως ανεπιθύμητη αλληλογραφία","inappropriate":"επισήμαναν ως ακατάλληλο","notify_moderators":"ειδοποιήθηκαν οι συντονιστές","notify_user":"έστειλαν ένα μήνυμα","bookmark":"έβαλαν σελιδοδείκτη","like_capped":{"one":"και {{count}} άλλος το άρεσε αυτό ","other":"και {{count}} άλλοι το άρεσαν αυτό "}},"by_you":{"off_topic":"Το επισήμανες σαν εκτός θέματος","spam":"Το επισήμανες σαν ανεπιθύμητο","inappropriate":"Το επισήμανες σαν ανάρμοστο","notify_moderators":"Το επισήμανες στους συντονιστές","notify_user":"Έστειλες ένα μήνυμα σε αυτόν τον χρήστη","bookmark":"Τοποθέτησες σελιδοδείκτη στην ανάρτηση","like":"Σου άρεσε η ανάρτηση"}},"merge":{"confirm":{"one":"Είσαι σίγουρος πως θέλεις να συγχωνεύσεις αυτές τις δημοσιεύσεις;","other":"Είσαι σίγουρος πως θέλεις να συγχωνεύσεις αυτές τις {{count}} αναρτήσεις;"}},"revisions":{"controls":{"first":"Πρώτη αναθεώρηση","previous":"Προηγούμενη αναθεώρηση","next":"Επόμενη αναθεώρηση","last":"Τελευταία αναθεώρηση","hide":"Κρύψε την αναθεώρηση","show":"Εμφάνισε την αναθεώρηση","revert":"Επιστροφή σε αυτήν την αναθεώρηση","edit_wiki":"Επεξεργασία του Βίκι","edit_post":"Επεξεργασία Ανάρτησης"},"displays":{"inline":{"title":"Δείξε το φορμαρισμένο κείμενο με τις αλλαγές και προσθηκες ενσωματωμένες σε αυτό","button":"HTML"},"side_by_side":{"title":"Δείξε τις αλλαγές στο φορμαρισμένο κείμενο δίπλα-δίπλα","button":"HTML"},"side_by_side_markdown":{"title":"Δείξε τις αλλαγές στο αρχικό κείμενο δίπλα-δίπλα","button":"Ακατέργαστο"}}},"raw_email":{"displays":{"raw":{"title":"Εμφάνιση ακατέργαστου email","button":"Ακατέργαστο"},"text_part":{"title":"Εμφάνιση του τμήματος κειμένου του email","button":"Κείμενο"},"html_part":{"title":"Εμφάνιση του τμήματος html του email","button":"HTML"}}},"bookmarks":{"name":"Όνομα"}},"category":{"can":"μπορεί\u0026hellip; ","none":"(χωρίς κατηγορία)","all":"Όλες οι κατηγορίες","edit":"Επεξεργασία","view":"Προβολή Νημάτων στην Κατηγορία","general":"Γενικά","settings":"Ρυθμίσεις","topic_template":"Πρότυπο Νήματος","tags":"Ετικέτες","tags_placeholder":"(Προαιρετική) λίστα επιτρεπόμενων ετικετών","tag_groups_placeholder":"(Προαιρετική) λίστα επιτρεπόμενων ομάδων ετικετών","topic_featured_link_allowed":"Επίτρεψε προτεινόμενους συνδέσμους σε αυτή την κατηγορία","delete":"Διαγραφή Κατηγορίας","create":"Νέα Κατηγορία","create_long":"Δημιουργία νέας κατηγορίας","save":"Αποθήκευση Κατηγορίας","slug":"Φιλικό Όνομα Κατηγορίας","slug_placeholder":"(Προαιρετικά) λέξεις ενωμένες με παύλα για το URL","creation_error":"Παρουσιάστηκε κάποιο σφάλμα κατά την δημιουργία της κατηγορίας","save_error":"Παρουσιάστηκε κάποιο σφάλμα κατά την αποθήκευση της κατηγορίας.","name":"Όνομα Κατηγορίας","description":"Περιγραφή","topic":"νήμα κατηγορίας","logo":"Εικονίδιο Κατηγορίας","background_image":"Εικόνα Φόντου Κατηγορίας","badge_colors":"Χρώματα παρασήμων","background_color":"Χρώμα φόντου","foreground_color":"Χρώμα στο προσκήνιο","name_placeholder":"Μια ή δύο λέξεις το πολύ","color_placeholder":"Οποιοδήποτε χρώμα","delete_confirm":"Είσαι σίγουρος ότι θέλεις να διαγράψεις αυτή την κατηγορία;","delete_error":"Παρουσιάστηκε κάποιο σφάλμα κατά τη διαγραφή της κατηγορίας.","list":"Λίστα Κατηγοριών","no_description":"Παρακαλώ πρόσθεσε μια περιγραφή στην κατηγορία","change_in_category_topic":"Επεξεργασία Περιγραφής","already_used":"Αυτό το χρώμα έχει χρησιμοποιηθεί σε άλλη κατηγορία","security":"Ασφάλεια","special_warning":"Προσοχή: Αυτή η κατηγορία είναι pre-seeded και οι ρυθμίσεις προστασίας δεν μπορούν να επεξεργαστούν. Εάν δεν επιθυμείτε να χρησιμοποιήσετε αυτήν την κατηγορία, διαγράψτε την αντί να την επαναχρησιμοποιήσετε.","images":"Εικόνες","email_in":"Προσαρμοσμένη διεύθυνση εισερχόμενων email:","email_in_allow_strangers":"Αποδοχή emails από ανώνυμους χρήστες χωρίς λογαριασμό","email_in_disabled":"Η δημιουργία νέων νημάτων μέσω email είναι απενεργοποιημένη στις ρυθμίσεις ιστοσελίδας. Για να επιτραπεί η δημιουργία νέων νημάτων μέσω email,","email_in_disabled_click":"ενεργοποίησε τη ρύθμιση «εισερχόμενα email».","show_subcategory_list":"Προβολή λίστας υποκατηγοριών πάνω απο τα νήματα αυτής της κατηγορίας ","num_featured_topics":"Αριθμός νημάτων που εμφανίζονται στην σελίδα κατηγοριών:","subcategory_num_featured_topics":"Αριθμός προτεινόμενων νημάτων στην σελίδα της γονικής κατηγορίας:","subcategory_list_style":"Μορφή Λίστας Υποκατηγορίων:","sort_order":"Ταξινόμηση Λίστας Νημάτων Κατά:","default_view":"Προκαθορισμένη Λίστα Νημάτων:","default_top_period":"Προκαθορισμένη Περίοδος Κορυφαίων:","allow_badges_label":"Να επιτρέπεται η απονομή παράσημων σε αυτή την κατηγορία","edit_permissions":"Επεξεργασία Δικαιωμάτων","review_group_name":"όνομα ομάδας","this_year":"φέτος","default_position":"Προκαθορισμένη Θέση","position_disabled":"Οι κατηγορίες εμφανίζονται ανάλογα με το πόσο ενεργές είναι. Για να αλλάξει η σειρά εμφάνισης των κατηγοριών, ","position_disabled_click":"ενεργοποίησε τη ρύθμιση «σταθερές θεσεις κατηγοριών»","parent":"Μητρική Κατηγορία","notifications":{"watching":{"title":"Επιτηρείται","description":"Θα επιτηρείς αυτόματα όλα τα νήματα σε αυτές τις κατηγορίες. Θα λαμβάνεις ειδοποιήσεις για κάθε νέα ανάρτηση και ένας μετρητής για το πλήθος των νέων απαντήσεων θα εμφανίζεται."},"watching_first_post":{"title":"Επιτήρηση Πρώτης Ανάρτησης"},"tracking":{"title":"Παρακολουθείται","description":"Θα παρακολουθείς αυτόματα όλα τα νήματα σε αυτές τις κατηγορίες. Θα λαμβάνεις ειδοποιήσεις εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε εσένα και ένας μετρητής για το πλήθος των νέων απαντήσεων θα εμφανίζεται."},"regular":{"title":"Φυσιολογικά","description":"Θα ειδοποιείσαι εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε εσένα."},"muted":{"title":"Σε σιγή","description":"Δε θα λαμβάνεις ποτέ ειδοποιήσεις για οτιδήποτε σχετικό με τα νέα νήματα σε αυτές τις κατηγορίες και δε θα εμφανίζονται στα τελευταία."}},"search_priority":{"options":{"normal":"Φυσιολογικά","ignore":"Αγνόηση"}},"sort_options":{"default":"προεπιλογή","likes":"Αρέσει","op_likes":"\"Μου αρέσει\" Αρχικής Ανάρτησης","views":"Προβολές","posts":"Αναρτήσεις","activity":"Δραστηριότητα","posters":"Συμμετέχοντες","category":"Κατηγορία","created":"Δημιουργήθηκε"},"sort_ascending":"Αύξουσα","sort_descending":"Φθίνουσα","subcategory_list_styles":{"rows":"Σειρές","rows_with_featured_topics":"Σειρές με προτεινόμενα νήματα","boxes":"Κουτιά","boxes_with_featured_topics":"Κουτιά με προτεινόμενα νήματα"},"settings_sections":{"general":"Γενικά","email":"Διεύθυνση Email"}},"flagging":{"title":"Ευχαριστούμε για τη συνεισφορά σου!","action":"Επισήμανση Ανάρτησης","take_action":"Λάβε Δράση","notify_action":"Μήνυμα","official_warning":"Επίσημη Προειδοποίηση","delete_spammer":"Διαγραφή Ανεπιθύμητου","yes_delete_spammer":"Ναι, σβήσε τον ανεπιθύμητο χρήστη","ip_address_missing":"(μη διαθέσιμο)","hidden_email_address":"(κρυφό)","submit_tooltip":"Στείλε την κρυφή επισήμανση","take_action_tooltip":"Να φτάσει αμέσως στο όριο των απαραίτητων ειδοποιήσεων, αντί να περιμένει και άλλες ειδοποιήσεις από την κοινότητα.","cant":"Λυπούμαστε, αυτή τη στιγμή δεν γίνεται να επισημάνεις την ανάρτηση.","notify_staff":"Ιδιωτική ειδοποίηση συνεργατών","formatted_name":{"off_topic":"Είναι εκτός θέματος","inappropriate":"Είναι ανάρμοστο","spam":"Είναι ανεπιθύμητο"},"custom_placeholder_notify_user":"Να είσαι συγκεκριμένος, εποικοδομητικός και πάντα φιλικός.","custom_placeholder_notify_moderators":"Παρακαλούμε πες τι ακριβως είναι αυτό που σε ανησυχεί. Αν είναι δυνατό, παράπεμψε σε σχετικούς συνδέσμους και παραδείγματα.","custom_message":{"at_least":{"one":"βάλε τουλάχιστον %{count} χαρακτήρα","other":"γράψε τουλάχιστον {{count}} χαρακτήρες"},"more":{"one":"%{count} να πας...","other":"{{count}} ακόμα..."},"left":{"one":"%{count} απομένει","other":"{{count}} απομένουν"}}},"flagging_topic":{"title":"Ευχαριστούμε για τη συνεισφρορά σου...","action":"Επισήμανση Νήματος","notify_action":"Μήνυμα"},"topic_map":{"title":"Περίληψη Νήματος","participants_title":"Συχνοί Συμμετέχοντες","links_title":"Δημοφιλείς Σύνδεσμοι","links_shown":"εμφάνισε περισσότερους συνδέσμους...","clicks":{"one":"%{count} κλικ","other":"%{count} κλικ"}},"post_links":{"about":"ανάπτυξε περισσότερους συνδέσμους για αυτή την ανάρτηση","title":{"one":"%{count} περισσότερο","other":"%{count} περισσότερα"}},"topic_statuses":{"warning":{"help":"Αυτή είναι μια επίσημη προειδοποίηση."},"bookmarked":{"help":"Τοποθέτησες σελιδοδείκτη σε αυτό το νήμα"},"locked":{"help":"Αυτό το νήμα είναι πια κλειστό. Οι απαντήσεις δεν είναι πλέον δυνατές"},"archived":{"help":"Αυτό το νήμα είναι αρχειοθετημένο. Έχει παγώσει και δεν μπορεί πλέον να τροποποιηθεί"},"locked_and_archived":{"help":"Αυτό το νήμα είναι κλειστό και αρχειοθετημένο. Δε δέχεται πια καινούριες απαντήσεις και δεν μπορεί να τροποποιηθεί"},"unpinned":{"title":"Ξεκαρφιτσωμένο","help":"Για σένα αυτό το νήμα είναι ξεκαρφιτσωμένο. Θα εμφανίζεται στην κανονική του σειρά."},"pinned_globally":{"title":"Καρφιτσωμένο Καθολικά","help":"Αυτό το νήμα είναι καρφιτσωμένο καθολικά. Θα εμφανίζεται στην κορυφή των τελευταίων και στην κατηγορία του"},"pinned":{"title":"Καρφιτσωμένο","help":"Αυτό το νήμα είναι καρφιτσωμένο για σένα. Θα εμφανίζεται πάντα στην κορυφή της κατηγορίας του "},"unlisted":{"help":"Αυτό το νήμα είναι αόρατο. Δε θα εμφανίζεται σε καμια λίστα νημάτων και μπορεί να εμφανιστεί μόνο αν ακολουθήσεις ένα άμεσο σύνδεσμο προς αυτό."}},"posts":"Αναρτήσεις","posts_long":"υπάρχουν {{number}} αναρτήσεις σε αυτό το νήμα","original_post":"Αρχική Ανάρτηση","views":"Προβολές","views_lowercase":{"one":"προβολή","other":"προβολές"},"replies":"Απαντήσεις","views_long":{"one":"αυτό το νήμα έχει προβληθεί %{count} φορά","other":"αυτό το νήμα έχει προβληθεί {{number}} φορές"},"activity":"Δραστηριότητα","likes":"«Μου αρέσει»","likes_lowercase":{"one":"μου αρέσει","other":"μου αρέσει"},"likes_long":"υπάρχουν {{number}} «μου αρέσει» σε αυτό το νήμα","users":"Χρήστες","users_lowercase":{"one":"χρήστης","other":"χρήστες"},"category_title":"Κατηγορία","history":"Ιστορικό","changed_by":"του/της {{author}}","raw_email":{"title":"Εισερχόμενα email","not_available":"Μη διαθέσιμο!"},"categories_list":"Λίστα Κατηγοριών","filters":{"with_topics":"%{filter} νήματα","with_category":"%{filter} %{category} νήματα","latest":{"title":"Τελευταία","title_with_count":{"one":"Τελευταία (%{count})","other":"Τελευταία ({{count}})"},"help":"νήματα με πρόσφατες αναρτήσεις"},"read":{"title":"Διαβασμένα","help":"νήματα που έχεις διαβάσει, με τη σειρά που τα έχεις διαβάσει"},"categories":{"title":"Κατηγορίες","title_in":"Κατηγορία - {{categoryName}}","help":"όλα τα νήματα ομαδοποιημένα ανά κατηγορία"},"unread":{"title":"Αδιάβαστα","title_with_count":{"one":"Μη αναγνωσμένα (%{count})","other":"Αδιάβαστα ({{count}})"},"help":"νήματα που επιτηρείς ή παρακολουθείς και που έχουν αδιάβαστες αναρτήσεις","lower_title_with_count":{"one":"%{count} μη αναγνωσμένο","other":"{{count}} αδιάβαστα"}},"new":{"lower_title_with_count":{"one":"%{count} νέο","other":"{{count}} νέα"},"lower_title":"νέα","title":"Νέα","title_with_count":{"one":"Νέα (%{count})","other":"Νέα ({{count}})"},"help":"νήματα που δημιουργήθηκαν τις προηγούμενες μέρες"},"posted":{"title":"Οι αναρτήσεις μου","help":"νήματα στα οποία έχεις αναρτήσεις"},"bookmarks":{"title":"Σελιδοδείκτες","help":"νήματα στα οποία έχεις βάλει σελιδοδείκτη"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"τελευταία νήματα στην κατηγορία {{categoryName}} "},"top":{"title":"Κορυφαία","help":"τα πιο ενεργά νήματα τον τελευταίο χρόνο, μήνα, εβδομάδα ή μέρα","all":{"title":"Από πάντα"},"yearly":{"title":"Ετήσια"},"quarterly":{"title":"Τριμηνιαία"},"monthly":{"title":"Μηνιαία"},"weekly":{"title":"Εβδομαδιαία"},"daily":{"title":"Ημερήσια"},"all_time":"Από πάντα","this_year":"Χρόνος","this_quarter":"Τέταρτο","this_month":"Μήνας","this_week":"Εβδομάδα","today":"Σήμερα","other_periods":"δες τα κορυφαία"}},"permission_types":{"full":"Δημιούργησε / Απάντησε / Δες","create_post":"Απάντησε / Δες","readonly":"Δες"},"lightbox":{"download":"λήψη"},"keyboard_shortcuts_help":{"title":"Συντομεύσεις Πληκτρολογίου","jump_to":{"title":"Μετάβαση Προς","home":"%{shortcut} Αρχική","latest":"%{shortcut} Τελευταία","new":"%{shortcut} Νέα","unread":"%{shortcut} Αδιάβαστα","categories":"%{shortcut} Κατηγορίες","top":"%{shortcut} Κορυφαία","bookmarks":"%{shortcut} Σελιδοδείκτες","profile":"%{shortcut} Προφίλ","messages":"%{shortcut} Μηνύματα"},"navigation":{"title":"Πλοήγηση","jump":"%{shortcut} Πήγαινε στην ανάρτηση #","back":"%{shortcut} Πίσω","up_down":"%{shortcut} Μετακίνηση επιλογής \u0026uarr; \u0026darr;","open":"%{shortcut} Άνοιξε το επιλεγμένο νήμα","next_prev":"%{shortcut} Επόμενη/Προηγούμενη ενότητα"},"application":{"title":"Εφαρμογή","create":"%{shortcut} Δημιουργία νέου νήματος","notifications":"%{shortcut} Άνοιγμα ειδοποιήσεων","hamburger_menu":"%{shortcut}'Ανοιξε μενού χάμπουρκερ","user_profile_menu":"%{shortcut} Άνοιγμα μενού χρήστη","show_incoming_updated_topics":"%{shortcut} Εμφάνιση ενημερωμένων νημάτων","search":"%{shortcut} Αναζήτηση","help":"%{shortcut} Εμφάνισε βοήθειας πληκτρολογίου","dismiss_new_posts":"%{shortcut} Απόρριψη Νέων/Αναρτήσεων","dismiss_topics":"%{shortcut} Απόρριψη Νημάτων","log_out":"%{shortcut} Αποσύνδεση"},"actions":{"title":"Ενέργειες","bookmark_topic":"%{shortcut} Εναλλαγή σελιδοδείκτη νήματος","pin_unpin_topic":"%{shortcut} Καρφίτσωμα/Ξεκαρφίτσωμα νήματος","share_topic":"%{shortcut} Κοινοποίηση νήματος","share_post":"%{shortcut} Κοινοποίηση ανάρτησης","reply_as_new_topic":"%{shortcut} Απάντηση σαν συνδεδεμένο νήμα","reply_topic":"%{shortcut} Απάντηση στο νήμα","reply_post":"%{shortcut} Απάντηση στην ανάρτηση","quote_post":"%{shortcut} Παράθεση ανάρτησης","like":"%{shortcut} \"Μου αρέσει\" η ανάρτηση","flag":"%{shortcut} Επισήμανση ανάρτησης","bookmark":"%{shortcut} Τοποθέτηση σελιδοδείκτη στην ανάρτηση","edit":"%{shortcut} Επεξεργασία ανάρτησης","delete":"%{shortcut} Διαγραφή ανάρτησης","mark_muted":"%{shortcut} Σίγαση νήματος","mark_regular":"%{shortcut} Κανονικό (προεπιλογή) νήμα","mark_tracking":"%{shortcut} Παρακολούθηση νήματος","mark_watching":"%{shortcut} Επιτήρηση Νήματος","print":"%{shortcut} Εκτύπωση νήματος"}},"badges":{"earned_n_times":{"one":"Κέρδισε αυτό το παράσημο %{count} φορά","other":"Κέρδισε αυτό το παράσημο %{count} φορές"},"granted_on":"Χορηγήθηκε στις %{date}","others_count":"Άλλοι με αυτό το παράσημο (%{count})","title":"Παράσημα","allow_title":"Μπορείς να χρησιμοποιήσεις αυτό το παράσημο σαν τίτλο","multiple_grant":"Μπορείς να το κερδίσεις πολλές φορές","badge_count":{"one":"%{count} Παράσημο","other":"%{count} Παράσημα"},"more_badges":{"one":"+%{count} Περισσότερα","other":"+%{count} Περισσότερα"},"granted":{"one":"%{count} χορηγήθηκε","other":"%{count} χορηγήθηκε"},"select_badge_for_title":"Επίλεξε ένα παράσημο για να χρησιμοποιήσεις ως τίτλο","badge_grouping":{"getting_started":{"name":"Ξεκινώντας"},"community":{"name":"Κοινότητα"},"trust_level":{"name":"Επίπεδο Εμπιστοσύνης"},"other":{"name":"Άλλο"},"posting":{"name":"Αναρτάται"}}},"tagging":{"all_tags":"Όλες οι Ετικέτες","selector_all_tags":"όλες οι ετικέτες","selector_no_tags":"καμία ετικέτα","changed":"αλλαγμένες ετικέτες:","tags":"Ετικέτες","add_synonyms":"Προσθήκη","delete_tag":"Αφαίρεση Ετικέτας","delete_confirm":{"one":"Είσαι βέβαιος πως θέλεις να διαγράψεις αυτήν την ετικέτα και να την αφαιρέσεις από το %{count} νήμα στο οποίο είναι προσαρτημένη;","other":"Είσαι βέβαιος πως θέλεις να διαγράψεις αυτήν την ετικέτα και να την αφαιρέσεις από τα {{count}} νήματα στα οποία είναι προσαρτημένη;"},"delete_confirm_no_topics":"Είσαι βέβαιος πως θέλεις να διαγράψεις αυτήν την ετικέτα;","rename_tag":"Μετονομασία Ετικέτας","rename_instructions":"Επίλεξε ένα καινούριο όνομα για την ετικέτα:","sort_by":"Ταξινόμηση κατά:","sort_by_count":"άθροισμα","sort_by_name":"όνομα","manage_groups":"Διαχείριση Ομάδων Ετικέτας","manage_groups_description":"Καθορισμός ομάδων για την οργάνωση ετικετών","cancel_delete_unused":"Άκυρο","filters":{"without_category":"%{filter} %{tag} νήματα","with_category":"%{filter} %{tag} νήματα στην %{category}","untagged_without_category":"%{filter} νήματα χωρίς ετικέτες","untagged_with_category":"%{filter} νήματα χωρίς ετικέτες σε %{category}"},"notifications":{"watching":{"title":"Επιτηρείται"},"watching_first_post":{"title":"Επιτήρηση Πρώτης Ανάρτησης"},"tracking":{"title":"Παρακολουθείται"},"regular":{"title":"Τακτικός","description":"Θα λαμβάνεις ειδοποίηση εάν κάποιος αναφέρει το @όνομά σου ή απαντήσει σε αυτή τη ανάρτηση."},"muted":{"title":"Σίγαση"}},"groups":{"title":"Ομάδες Ετικετών","about":"Πρόσθεσε ετικέτες σε ομάδες για να τις διαχειριστείς με περισσότερη ευκολία.","new":"Νέα Ομάδα","tags_label":"Ετικέτες σε αυτή την ομάδα:","parent_tag_label":"Μητρική ετικέτα:","parent_tag_placeholder":"Προαιρετικό","parent_tag_description":"Οι ετικέτες από αυτή την ομάδα δεν μπορούν να χρησιμοποιηθούν αν δεν είναι παρούσα η μητρική ετικέτα.","one_per_topic_label":"Περιορισμός μιας ετικέτας για κάθε νήμα από αυτή την ομάδα","new_name":"Νέα Ομάδα Ετικετών","save":"Αποθήκευση","delete":"Διαγραφή","confirm_delete":"Είσαι βέβαιος πως θέλεις να διαγράψεις αυτή την ομάδα ετικετών;"},"topics":{"none":{"unread":"Δεν έχεις αδιάβαστα νήματα.","new":"Δεν έχεις νέα νήματα.","read":"Δεν έχεις διαβάσει κανένα νήμα ακόμα.","posted":"Δεν έχεις αναρτήσει σε κανένα νήμα ακόμα.","latest":"Δεν υπάρχουν τελευταία νήματα.","bookmarks":"Δεν υπάρχουν νήματα με σελιδοδείκτη ακόμα.","top":"Δεν υπάρχουν κορυφαία νήματα."},"bottom":{"latest":"Δεν υπάρχουν άλλα τελευταία νήματα.","posted":"Δεν υπάρχουν άλλα νήματα που έχουν δημοσιευθεί.","read":"Δεν υπάρχουν άλλα διαβασμένα νήματα.","new":"Δεν υπάρχουν άλλα νέα νήματα.","unread":"Δεν υπάρχουν άλλα αδιάβαστα νήματα.","top":"Δεν υπάρχουν άλλα κορυφαία νήματα.","bookmarks":"Δεν υπάρχουν άλλα νήματα με σελιδοδείκτη."}}},"invite":{"custom_message_placeholder":"Πρόσθεσε το προσαρμοσμένο μήνυμά σου","custom_message_template_forum":"Γεια, θα πρέπει να λάβεις μέρος σε αυτό το χώρο συζητήσεων!","custom_message_template_topic":"Γεια, νομίζω ότι θα απολαύσεις αυτό το νήμα!"},"safe_mode":{"enabled":"Η λειτουργία ασφαλείας είναι ενεργοποιημένη, για να εξέλθεις από τη λειτουργία ασφαλείας κλείσε το παράθυρο περιήγησης"},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Ξεκίνησε την εκπαίδευση νέου μέλους σε όλους τους νέους χρήστες","welcome_message":"Στείλε σε όλα τα νέα μέλη ένα μήνυμα καλοσωρίσματος με έναν οδηγό γρήγορης εκκίνησης"}},"discourse_local_dates":{"create":{"form":{"time_title":"Ώρα"}}},"poll":{"voters":{"one":"ψηφοφόρος","other":"ψηφοφόροι"},"total_votes":{"one":"συνολική ψήφος","other":"συνολικές ψήφοι"},"average_rating":"Μέση βαθμολογία: \u003cstrong\u003e%{average}\u003c/strong\u003e.","multiple":{"help":{"at_least_min_options":{"one":"Επιλέξτε τουλάχιστον \u003cstrong\u003e%{count}\u003c/strong\u003e επιλογή","other":"Επέλεξε τουλάχιστον \u003cstrong\u003e%{count}\u003c/strong\u003e επιλογές"},"up_to_max_options":{"one":"Επιλέξτε μέχρι \u003cstrong\u003e%{count}\u003c/strong\u003e επιλογή","other":"Επέλεξε μέχρι \u003cstrong\u003e%{count}\u003c/strong\u003e επιλογές"},"x_options":{"one":"Επιλέξτε \u003cstrong\u003e%{count}\u003c/strong\u003e επιλογή","other":"Επέλεξε \u003cstrong\u003e%{count}\u003c/strong\u003e επιλογές"},"between_min_and_max_options":"Επιλέξτε ανάμεσα σε \u003cstrong\u003e%{min}\u003c/strong\u003e και \u003cstrong\u003e%{max}\u003c/strong\u003e επιλογές"}},"cast-votes":{"title":"Δώσε τις ψήφους σου","label":"Ψήφισε τώρα!"},"show-results":{"title":"Εμφάνισε τα αποτελέσματα της ψηφοφορίας","label":"Εμφάνισε τα αποτελέσματα"},"hide-results":{"title":"Πίσω στην ψηφοφορία"},"export-results":{"label":"Εξαγωγή"},"open":{"title":"Να ξεκινήσει η ψηφοφορία","label":"Ξεκίνημα","confirm":"Σίγουρα θες να ξεκινήσεις αυτή την ψηφοφορία;"},"close":{"title":"Να κλείσει η ψηφοφορία","label":"Κλείσιμο","confirm":"Σίγουρα θες να κλείσεις αυτή την ψηφοφορία;"},"error_while_toggling_status":"Λυπούμαστε, παρουσιάστηκε ένα σφάλμα σχετικά με την εναλλαγή της κατάστασης αυτής της δημοσκόπησης.","error_while_casting_votes":"Λυπούμαστε, παρουσιάστηκε ένα σφάλμα με τις ψήφους σας.","error_while_fetching_voters":"Συγνώμη, παρουσιάστηκε ένα σφάλμα κατά την διαδικασία εμφάνισης των ψηφοφόρων.","ui_builder":{"title":"Δημιουργία Ψηφοφορίας","insert":"Εισαγωγή Ψηφοφορίας","help":{"invalid_values":"Η ελάχιστη τιμή θα πρέπει να είναι μικρότερη από την μέγιστη τιμή.","min_step_value":"Η ελάχιστη τιμή για το βήμα είναι 1"},"poll_type":{"label":"Τύπος","regular":"Μία επιλογή","multiple":"Πολλαπλές επιλογές","number":"Αξιολόγηση αριθμoύ"},"poll_result":{"label":"Αποτελέσματα"},"poll_config":{"max":"Μέγιστο","min":"Ελάχιστο","step":"Βήμα"},"poll_public":{"label":"Δείξε ποιοι ψηφίσαν."},"poll_options":{"label":"Εισάγετε μία επιλογή ψηφοφορίας ανα γραμμή"}}},"presence":{"replying":"απαντά","editing":"επεξεργάζεται"}}},"en_US":{"js":{"dates":{"time_short_day":"ddd, h:mm a"}}},"en":{"js":{"dates":{"medium_with_ago":{"x_months":{"one":"%{count} month ago","other":"%{count} months ago"},"x_years":{"one":"%{count} year ago","other":"%{count} years ago"}}},"share":{"topic_html":"Topic: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","twitter":"Share this link on Twitter","facebook":"Share this link on Facebook","email":"Send this link in an email"},"action_codes":{"private_topic":"made this topic a personal message %{when}","user_left":"%{who} removed themselves from this message %{when}","autobumped":"automatically bumped %{when}","forwarded":"forwarded the above email"},"topic_admin_menu":"topic actions","bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email summary emails enabled. This will be automatically turned off when %{min_users} users have joined.","bootstrap_mode_disabled":"Bootstrap mode will be disabled within 24 hours.","themes":{"broken_theme_alert":"Your site may not work because theme / component %{theme} has errors. Disable it at %{path}."},"s3":{"regions":{"ca_central_1":"Canada (Central)","cn_northwest_1":"China (Ningxia)","eu_north_1":"EU (Stockholm)","eu_west_3":"EU (Paris)","sa_east_1":"South America (São Paulo)","us_gov_east_1":"AWS GovCloud (US-East)","us_gov_west_1":"AWS GovCloud (US-West)"}},"submit":"Submit","go_ahead":"Go ahead","rules":"Rules","conduct":"Code of Conduct","every_six_months":"every six months","related_messages":{"see_all":"See \u003ca href=\"%{path}\"\u003eall messages\u003c/a\u003e from @%{username}..."},"about":{"stat":{"last_7_days":"Last 7","last_30_days":"Last 30"}},"bookmarks":{"not_bookmarked":"bookmark this post","created_with_reminder":"you've bookmarked this post with a reminder at %{date}","confirm_clear":"Are you sure you want to clear all your bookmarks from this topic?","no_timezone":"You have not set a timezone yet. You will not be able to set reminders. Set one up \u003ca href=\"%{basePath}/my/preferences/profile\"\u003ein your profile\u003c/a\u003e.","reminders":{"at_desktop":"Next time I'm at my desktop","later_today":"Later today \u003cbr/\u003e{{date}}","next_business_day":"Next business day \u003cbr/\u003e{{date}}","tomorrow":"Tomorrow \u003cbr/\u003e{{date}}","next_week":"Next week \u003cbr/\u003e{{date}}","next_month":"Next month \u003cbr/\u003e{{date}}","custom":"Custom date and time"}},"drafts":{"resume":"Resume","new_topic":"New topic draft","new_private_message":"New private message draft","topic_reply":"Draft reply","abandon":{"confirm":"You already opened another draft in this topic. Are you sure you want to abandon it?"}},"topic_count_latest":{"one":"See {{count}} new or updated topic","other":"See {{count}} new or updated topics"},"topic_count_unread":{"one":"See {{count}} unread topic","other":"See {{count}} unread topics"},"topic_count_new":{"one":"See {{count}} new topic","other":"See {{count}} new topics"},"uploading_filename":"Uploading: {{filename}}...","clipboard":"clipboard","pasting":"Pasting...","continue":"Continue","pwa":{"install_banner":"Do you want to \u003ca href\u003einstall %{title} on this device?\u003c/a\u003e"},"choose_topic":{"title":{"search":"Search for a Topic","placeholder":"type the topic title, url or id here"}},"choose_message":{"none_found":"No messages found.","title":{"search":"Search for a Message","placeholder":"type the message title, url or id here"}},"review":{"order_by":"Order by","in_reply_to":"in reply to","explain":{"why":"explain why this item ended up in the queue","title":"Reviewable Scoring","formula":"Formula","subtotal":"Subtotal","min_score_visibility":"Minimum Score for Visibility","score_to_hide":"Score to Hide Post","take_action_bonus":{"name":"took action","title":"When a staff member chooses to take action the flag is given a bonus."},"user_accuracy_bonus":{"name":"user accuracy","title":"Users whose flags have been historically agreed with are given a bonus."},"trust_level_bonus":{"name":"trust level","title":"Reviewable items created by higher trust level users have a higher score."},"type_bonus":{"name":"type bonus","title":"Certain reviewable types can be assigned a bonus by staff to make them a higher priority."}},"claim_help":{"optional":"You can claim this item to prevent others from reviewing it.","required":"You must claim items before you can review them.","claimed_by_you":"You've claimed this item and can review it.","claimed_by_other":"This item can only be reviewed by \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"claim this topic"},"unclaim":{"help":"remove this claim"},"awaiting_approval":"Awaiting Approval","settings":{"priorities":{"title":"Reviewable Priorities"}},"moderation_history":"Moderation History","view_all":"View All","grouped_by_topic":"Grouped by Topic","none":"There are no items to review.","view_pending":"view pending","topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval","other":"This topic has \u003cb\u003e{{count}}\u003c/b\u003e posts pending approval"},"title":"Review","filtered_topic":"You have filtered to reviewable content in a single topic.","show_all_topics":"show all topics","deleted_post":"(post deleted)","deleted_user":"(user deleted)","user":{"bio":"Bio","website":"Website"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flags)"},"agreed":{"one":"{{count}}% agree","other":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree","other":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore","other":"{{count}}% ignore"}},"topics":{"reviewable_count":"Count","reported_by":"Reported by","deleted":"[Topic Deleted]","original":"(original topic)","unique_users":{"one":"%{count} user","other":"{{count}} users"}},"replies":{"one":"%{count} reply","other":"{{count}} replies"},"new_topic":"Approving this item will create a new topic","filters":{"all_categories":"(all categories)","type":{"all":"(all types)"},"minimum_score":"Minimum Score:","status":"Status","orders":{"priority":"Priority","priority_asc":"Priority (reverse)","created_at":"Created At","created_at_asc":"Created At (reverse)"},"priority":{"title":"Minimum Priority","low":"(any)","medium":"Medium","high":"High"}},"conversation":{"view_full":"view full conversation"},"scores":{"about":"This score is calculated based on the trust level of the reporter, the accuracy of their previous flags, and the priority of the item being reported.","score":"Score","date":"Date","status":"Status","submitted_by":"Submitted By","reviewed_by":"Reviewed By"},"statuses":{"reviewed":{"title":"(all reviewed)"},"all":{"title":"(everything)"}},"types":{"reviewable_flagged_post":{"title":"Flagged Post","flagged_by":"Flagged By"},"reviewable_queued_topic":{"title":"Queued Topic"},"reviewable_queued_post":{"title":"Queued Post"}},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending.","other":"You have \u003cstrong\u003e{{count}}\u003c/strong\u003e posts pending."}}},"groups":{"member_added":"Added","member_requested":"Requested at","add_members":{"description":"Manage the membership of this group","usernames":"Usernames"},"requests":{"title":"Requests","accept":"Accept","accepted":"accepted","deny":"Deny","denied":"denied","undone":"request undone"},"manage":{"title":"Manage","interaction":{"title":"Interaction","notification":"Notification"}},"empty":{"requests":"There are no membership requests for this group."},"join":"Join","leave":"Leave","confirm_leave":"Are you sure you want to leave this group?","allow_membership_requests":"Allow users to send membership requests to group owners (Requires publicly visible group)","group_name":"Group name","index":{"all":"All Groups","filter":"Filter by group type","owner_groups":"Groups I own","close_groups":"Closed Groups","automatic_groups":"Automatic Groups","closed":"Closed","public_groups":"Public Groups","close_group":"Close Group","group_type":"Group type","is_group_owner":"Owner"},"members":{"filter_placeholder_admin":"username or email","remove_member":"Remove Member","remove_member_description":"Remove \u003cb\u003e%{username}\u003c/b\u003e from this group","make_owner":"Make Owner","make_owner_description":"Make \u003cb\u003e%{username}\u003c/b\u003e an owner of this group","remove_owner":"Remove as Owner","remove_owner_description":"Remove \u003cb\u003e%{username}\u003c/b\u003e as an owner of this group","owner":"Owner","forbidden":"You're not allowed to view the members."},"alias_levels":{"owners_mods_and_admins":"Only group owners, moderators and admins"},"notifications":{"watching_first_post":{"description":"You will be notified of new messages in this group but not replies to the messages."},"muted":{"description":"You will not be notified of anything about messages in this group."}},"flair_url_description":"Use square images no smaller than 20px by 20px or FontAwesome icons (accepted formats: \"fa-icon\", \"far fa-icon\" or \"fab fa-icon\")."},"user_action_groups":{"15":"Drafts"},"categories":{"topic_stat_sentence_week":{"one":"%{count} new topic in the past week.","other":"%{count} new topics in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month.","other":"%{count} new topics in the past month."},"n_more":"Categories (%{count} more) ..."},"ip_lookup":{"powered_by":"using \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"copied"},"user":{"user_notifications":{"ignore_duration_title":"Ignore Timer","ignore_duration_when":"Duration:","ignore_duration_note":"Please note that all ignores are automatically removed after the ignore duration expires.","ignore_duration_time_frame_required":"Please select a time frame","ignore_no_users":"You have no ignored users.","ignore_option_title":"You will not receive notifications related to this user and all of their topics and replies will be hidden.","add_ignored_user":"Add...","mute_option_title":"You will not receive any notifications related to this user.","normal_option_title":"You will be notified if this user replies to you, quotes you, or mentions you."},"feature_topic_on_profile":{"open_search":"Select a New Topic","title":"Select a Topic","search_label":"Search for Topic by title","clear":{"warning":"Are you sure you want to clear your featured topic?"}},"profile_hidden":"This user's public profile is hidden.","collapse_profile":"Collapse","timezone":"Timezone","desktop_notifications":{"label":"Live Notifications","consent_prompt":"Do you want live notifications when people reply to your posts?"},"dynamic_favicon":"Show counts on browser icon","theme_default_on_all_devices":"Make this the default theme on all my devices","text_size_default_on_all_devices":"Make this the default text size on all my devices","allow_private_messages":"Allow other users to send me personal messages","enable_defer":"Enable defer to mark topics unread","featured_topic":"Featured Topic","mailing_list_mode":{"warning":"Mailing list mode enabled. Email notification settings are overridden."},"muted_categories_instructions":"You will not be notified of anything about new topics in these categories, and they will not appear on the categories or latest pages.","muted_categories_instructions_dont_hide":"You will not be notified of anything about new topics in these categories.","delete_yourself_not_allowed":"Please contact a staff member if you wish your account to be deleted.","ignored_users_instructions":"Suppress all posts and notifications from these users.","api_last_used_at":"Last used at:","staged":"Staged","second_factor_backup":{"title":"Two Factor Backup Codes","enable_long":"Enable backup codes","manage":"Manage backup codes. You have \u003cstrong\u003e{{count}}\u003c/strong\u003e backup codes remaining.","remaining_codes":"You have \u003cstrong\u003e{{count}}\u003c/strong\u003e backup codes remaining.","use":"Use a backup code","enable_prerequisites":"You must enable a primary second factor before generating backup codes.","codes":{"title":"Backup Codes Generated","description":"Each of these backup codes can only be used once. Keep them somewhere safe but accessible."}},"second_factor":{"title":"Two Factor Authentication","enable":"Manage Two Factor Authentication","forgot_password":"Forgot password?","confirm_password_description":"Please confirm your password to continue","label":"Code","rate_limit":"Please wait before trying another authentication code.","enable_description":"Scan this QR code in a supported app (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) and enter your authentication code.\n","disable_description":"Please enter the authentication code from your app","show_key_description":"Enter manually","short_description":"Protect your account with one-time use security codes.\n","extended_description":"Two factor authentication adds extra security to your account by requiring a one-time token in addition to your password. Tokens can be generated on \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e and \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e devices.\n","oauth_enabled_warning":"Please note that social logins will be disabled once two factor authentication has been enabled on your account.","use":"Use Authenticator app","enforced_notice":"You are required to enable two factor authentication before accessing this site.","disable":"disable","disable_title":"Disable Second Factor","disable_confirm":"Are you sure you want to disable all second factors?","edit_title":"Edit Second Factor","edit_description":"Second Factor Name","enable_security_key_description":"When you have your physical security key prepared press the Register button below.","totp":{"title":"Token-Based Authenticators","add":"New Authenticator","default_name":"My Authenticator"},"security_key":{"title":"Security Keys","add":"Register Security Key","default_name":"Main Security Key","not_allowed_error":"The security key registration process either timed out or was cancelled.","already_added_error":"You have already registered this security key. You don’t have to register it again.","edit":"Edit Security Key","edit_description":"Security Key Name"}},"change_username":{"confirm":"Are you absolutely sure you want to change your username?"},"change_avatar":{"gravatar_failed":"We could not find a Gravatar with that email address."},"change_profile_background":{"title":"Profile Header","instructions":"Profile headers will be centered and have a default width of 1110px."},"change_featured_topic":{"title":"Featured Topic","instructions":"A link to this topic will be on your user card, and profile."},"email":{"primary":"Primary Email","secondary":"Secondary Emails","no_secondary":"No secondary emails","sso_override_instructions":"Email can be updated from SSO provider.","instructions":"Never shown to the public."},"associated_accounts":{"title":"Associated Accounts","connect":"Connect","not_connected":"(not connected)","confirm_modal_title":"Connect %{provider} Account","confirm_description":{"account_specific":"Your %{provider} account '%{account_description}' will be used for authentication.","generic":"Your %{provider} account will be used for authentication."}},"auth_tokens":{"title":"Recently Used Devices","log_out_all":"Log out all","active":"active now","not_you":"Not you?","show_all":"Show all ({{count}})","show_few":"Show fewer","was_this_you":"Was this you?","was_this_you_description":"If it wasn’t you, we recommend you change your password and log out everywhere.","browser_and_device":"{{browser}} on {{device}}","secure_account":"Secure my Account","latest_post":"You last posted…"},"hide_profile_and_presence":"Hide my public profile and presence features","enable_physical_keyboard":"Enable physical keyboard support on iPad","text_size":{"title":"Text Size","smaller":"Smaller","larger":"Larger","largest":"Largest"},"title_count_mode":{"title":"Background page title displays count of:","notifications":"New notifications","contextual":"New page content"},"email_digests":{"title":"When I don’t visit here, send me an email summary of popular topics and replies","every_six_months":"every six months"},"email_level":{"only_when_away":"only when away"},"invited":{"sent":"Last Sent","none":"No invites to display.","rescind_all":"Remove all Expired Invites","rescinded_all":"All Expired Invites removed!","rescind_all_confirm":"Are you sure you want to remove all expired invites?","bulk_invite":{"confirmation_message":"You’re about to email invites to everyone in the uploaded file."}},"summary":{"top_categories":"Top Categories"},"title":{"none":"(none)"},"primary_group":{"none":"(none)"}},"too_few_topics_and_posts_notice":"Let's \u003ca href='https://blog.discourse.org/2014/08/building-a-discourse-community/'\u003estart the discussion!\u003c/a\u003e There are \u003cstrong\u003e%{currentTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{currentPosts}\u003c/strong\u003e posts. Visitors need more to read and reply to – we recommend at least \u003cstrong\u003e%{requiredTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{requiredPosts}\u003c/strong\u003e posts. Only staff can see this message.","too_few_topics_notice":"Let's \u003ca href='https://blog.discourse.org/2014/08/building-a-discourse-community/'\u003estart the discussion!\u003c/a\u003e There are \u003cstrong\u003e%{currentTopics}\u003c/strong\u003e topics. Visitors need more to read and reply to – we recommend at least \u003cstrong\u003e%{requiredTopics}\u003c/strong\u003e topics. Only staff can see this message.","too_few_posts_notice":"Let's \u003ca href='https://blog.discourse.org/2014/08/building-a-discourse-community/'\u003estart the discussion!\u003c/a\u003e There are \u003cstrong\u003e%{currentPosts}\u003c/strong\u003e posts. Visitors need more to read and reply to – we recommend at least \u003cstrong\u003e%{requiredPosts}\u003c/strong\u003e posts. Only staff can see this message.","logs_error_rate_notice":{},"signup_cta":{"intro":"Hello! Looks like you’re enjoying the discussion, but you haven’t signed up for an account yet.","value_prop":"When you create an account, we remember exactly what you’ve read, so you always come right back where you left off. You also get notifications, here and via email, whenever someone replies to you. And you can like posts to share the love. :heartpulse:"},"private_message_info":{"invite":"Invite Others ...","edit":"Add or Remove ..."},"forgot_password":{"complete_username_found":"We found an account that matches the username \u003cb\u003e%{username}\u003c/b\u003e. You should receive an email with instructions on how to reset your password shortly.","complete_email_found":"We found an account that matches \u003cb\u003e%{email}\u003c/b\u003e. You should receive an email with instructions on how to reset your password shortly."},"email_login":{"link_label":"Email me a login link","button_label":"with email","complete_username":"If an account matches the username \u003cb\u003e%{username}\u003c/b\u003e, you should receive an email with a login link shortly.","complete_email":"If an account matches \u003cb\u003e%{email}\u003c/b\u003e, you should receive an email with a login link shortly.","complete_username_found":"We found an account that matches the username \u003cb\u003e%{username}\u003c/b\u003e, you should receive an email with a login link shortly.","complete_email_found":"We found an account that matches \u003cb\u003e%{email}\u003c/b\u003e, you should receive an email with a login link shortly.","logging_in_as":"Logging in as %{email}","confirm_button":"Finish Login"},"login":{"second_factor_title":"Two Factor Authentication","second_factor_description":"Please enter the authentication code from your app:","second_factor_backup":"Log in using a backup code","second_factor_backup_title":"Two Factor Backup","second_factor_backup_description":"Please enter one of your backup codes:","second_factor":"Log in using Authenticator app","security_key_description":"When you have your physical security key prepared press the Authenticate with Security Key button below.","security_key_alternative":"Try another way","security_key_authenticate":"Authenticate with Security Key","security_key_not_allowed_error":"The security key authentication process either timed out or was cancelled.","security_key_no_matching_credential_error":"No matching credentials could be found in the provided security key.","security_key_support_missing_error":"Your current device or browser does not support the use of security keys. Please use a different method.","cookies_error":"Your browser seems to have cookies disabled. You might not be able to log in without enabling them first.","blank_username":"Please enter your email or username.","omniauth_disallow_totp":"Your account has two factor authentication enabled. Please log in with your password.","sent_activation_email_again_generic":"We sent another activation email. It might take a few minutes for it to arrive; be sure to check your spam folder.","instagram":{"name":"Instagram"},"facebook":{"name":"Facebook"},"github":{"name":"GitHub"},"discord":{"name":"Discord","title":"with Discord"},"second_factor_toggle":{"totp":"Use an authenticator app instead","backup_code":"Use a backup code instead"}},"emoji_set":{"emoji_one":"JoyPixels (formerly EmojiOne)"},"category_page_style":{"categories_and_top_topics":"Categories and Top Topics","categories_boxes":"Boxes with Subcategories","categories_boxes_with_topics":"Boxes with Featured Topics"},"shortcut_modifier_key":{"enter":"Enter"},"category_row":{"topic_count":"{{count}} topics in this category"},"select_kit":{"filter_placeholder_with_any":"Search or create...","create":"Create: '{{content}}'","max_content_reached":{"one":"You can only select {{count}} item.","other":"You can only select {{count}} items."},"min_content_not_reached":{"one":"Select at least {{count}} item.","other":"Select at least {{count}} items."},"invalid_selection_length":"Selection must be at least {{count}} characters."},"date_time_picker":{"errors":{"to_before_from":"To date must be later than from date."}},"emoji_picker":{"smileys_\u0026_emotion":"Smileys and Emotion","people_\u0026_body":"People and Body","animals_\u0026_nature":"Animals and Nature","food_\u0026_drink":"Food and Drink","travel_\u0026_places":"Travel and Places","activities":"Activities","symbols":"Symbols"},"shared_drafts":{"title":"Shared Drafts","notice":"This topic is only visible to those who can see the \u003cb\u003e{{category}}\u003c/b\u003e category.","destination_category":"Destination Category","publish":"Publish Shared Draft","confirm_publish":"Are you sure you want to publish this draft?","publishing":"Publishing Topic..."},"composer":{"edit_conflict":"edit conflict","group_mentioned_limit":"\u003cb\u003eWarning!\u003c/b\u003e You mentioned \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, however this group has more members than the administrator configured mention limit of {{max}} users. Nobody will be notified.","reference_topic_title":"RE: {{title}}","error":{"post_missing":"Post can’t be empty","try_like":"Have you tried the {{heart}} button?","tags_missing":"You must choose at least {{count}} tags","topic_template_not_modified":"Please add details and specifics to your topic by editing the topic template."},"overwrite_edit":"Overwrite Edit","create_shared_draft":"Create Shared Draft","edit_shared_draft":"Edit Shared Draft","remove_featured_link":"Remove link from topic.","reply_placeholder_no_images":"Type here. Use Markdown, BBCode, or HTML to format.","reply_placeholder_choose_category":"Select a category before typing here.","saved_draft":"Post draft in progress. Tap to resume.","link_url_placeholder":"Paste a URL or type to search topics","toggle_direction":"Toggle Direction","collapse":"minimize the composer panel","open":"open the composer panel","abandon":"close composer and discard draft","enter_fullscreen":"enter fullscreen composer","exit_fullscreen":"exit fullscreen composer","composer_actions":{"draft":"Draft","reply_to_post":{"label":"Reply to post %{postNumber} by %{postUsername}","desc":"Reply to a specific post"},"reply_as_new_topic":{"label":"Reply as linked topic","desc":"Create a new topic linked to this topic","confirm":"You have a new topic draft saved, which will be overwritten if you create a linked topic."},"reply_as_private_message":{"label":"New message","desc":"Create a new personal message"},"reply_to_topic":{"label":"Reply to topic","desc":"Reply to the topic, not any specific post"},"toggle_whisper":{"label":"Toggle whisper","desc":"Whispers are only visible to staff members"},"shared_draft":{"label":"Shared Draft","desc":"Draft a topic that will only be visible to staff"},"toggle_topic_bump":{"label":"Toggle topic bump","desc":"Reply without changing latest reply date"}},"details_text":"This text will be hidden"},"notifications":{"tooltip":{"regular":{"one":"%{count} unseen notification","other":"{{count}} unseen notifications"},"message":{"one":"%{count} unread message","other":"{{count}} unread messages"}},"post_approved":"Your post was approved","reviewable_items":"items requiring review","liked_consolidated_description":{"one":"liked {{count}} of your posts","other":"liked {{count}} of your posts"},"membership_request_accepted":"Membership accepted in '{{group_name}}'","membership_request_consolidated":"{{count}} open membership requests for '{{group_name}}'","popup":{"private_message":"{{username}} sent you a personal message in \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} created a new topic \"{{topic}}\" - {{site_title}}","confirm_title":"Notifications enabled - %{site_title}","confirm_body":"Success! Notifications have been enabled.","custom":"Notification from {{username}} on %{site_title}"},"titles":{"mentioned":"mentioned","replied":"new reply","quoted":"quoted","edited":"edited","liked":"new like","private_message":"new private message","invited_to_private_message":"invited to private message","invitee_accepted":"invite accepted","posted":"new post","moved_post":"post moved","linked":"linked","granted_badge":"badge granted","invited_to_topic":"invited to topic","group_mentioned":"group mentioned","group_message_summary":"new group messages","topic_reminder":"topic reminder","liked_consolidated":"new likes","post_approved":"post approved","membership_request_consolidated":"new membership requests"}},"search":{"result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} results for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"full_page_title":"search topics or posts","context":{"tag":"Search the #{{tag}} tag"},"advanced":{"in_category":{"label":"Categorized"},"with_tags":{"label":"Tagged"},"filters":{"label":"Only return topics/posts...","title":"Matching in title only","created":"I created","private":"In my messages","bookmarks":"I bookmarked","seen":"I read","images":"include image(s)","all_tags":"All the above tags"},"statuses":{"public":"are public"}}},"view_all":"view all","topic":{"open_draft":"Open Draft","edit_message":{"help":"Edit first post of the message","title":"Edit Message"},"defer":{"help":"Mark as unread"},"feature_on_profile":{"help":"Add a link to this topic on your user card and profile","title":"Feature On Profile"},"remove_from_profile":{"warning":"Your profile already has a featured topic. If you continue, this topic will replace the existing topic.","help":"Remove the link to this topic on your user profile","title":"Remove From Profile"},"group_request":"You need to request membership to the `{{name}}` group to see this topic","group_join":"You need join the `{{name}}` group to see this topic","group_request_sent":"Your group membership request has been sent. You will be informed when it's accepted.","unread_indicator":"No member has read the last post of this topic yet.","topic_status_update":{"time_frame_required":"Please select a time frame"},"auto_update_input":{"two_months":"Two Months","four_months":"Four Months"},"auto_bump":{"title":"Auto-Bump Topic"},"status_update_notice":{"auto_bump":"This topic will be automatically bumped %{timeLeft}."},"progress":{"jump_prompt_long":"Jump to...","jump_prompt_to_date":"to date"},"actions":{"make_private":"Make Personal Message","reset_bump_date":"Reset Bump Date"},"share":{"extended_title":"Share a link"},"make_public":{"title":"Convert to Public Topic","choose_category":"Please choose a category for the public topic:"},"move_to":{"title":"Move to","action":"move to","error":"There was an error moving posts."},"split_topic":{"topic_name":"New Topic Title"},"merge_topic":{"radio_label":"Existing Topic"},"move_to_new_message":{"title":"Move to New Message","action":"move to new message","message_title":"New Message Title","participants":"Participants","instructions":{"one":"You are about to create a new message and populate it with the post you've selected.","other":"You are about to create a new message and populate it with the \u003cb\u003e{{count}}\u003c/b\u003e posts you've selected."}},"move_to_existing_message":{"title":"Move to Existing Message","action":"move to existing message","radio_label":"Existing Message","participants":"Participants","instructions":{"one":"Please choose the message you'd like to move that post to.","other":"Please choose the message you'd like to move those \u003cb\u003e{{count}}\u003c/b\u003e posts to."}},"change_owner":{"title":"Change Owner","instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Please choose a new owner for the {{count}} posts by \u003cb\u003e@{{old_user}}\u003c/b\u003e"}},"multi_select":{"select_post":{"title":"Add post to selection"},"selected_post":{"label":"selected","title":"Click to remove post from selection"},"select_replies":{"title":"Add post and all its replies to selection"},"select_below":{"label":"select +below","title":"Add post and all after it to selection"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)","other":"(topic withdrawn by author, will be automatically deleted in %{count} hours unless flagged)"}},"post":{"ignored":"Ignored content","show_hidden":"View ignored content.","collapse":"collapse","locked":"a staff member has locked this post from being edited","notice":{"new_user":"This is the first time {{user}} has posted — let’s welcome them to our community!","returning_user":"It’s been a while since we’ve seen {{user}} — their last post was {{time}}."},"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then paste the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload {{max}} files at a time."},"abandon_edit":{"confirm":"Are you sure you want to discard your changes?","no_save_draft":"No, save draft","yes_value":"Yes, discard edit"},"abandon":{"no_save_draft":"No, save draft"},"controls":{"read_indicator":"members who read this post","delete_replies":{"confirm":"Do you also want to delete the replies to this post?","direct_replies":{"one":"Yes, and %{count} direct reply","other":"Yes, and {{count}} direct replies"},"all_replies":{"one":"Yes, and %{count} reply","other":"Yes, and all {{count}} replies"}},"lock_post":"Lock Post","lock_post_description":"prevent the poster from editing this post","unlock_post":"Unlock Post","unlock_post_description":"allow the poster to edit this post","delete_topic_disallowed_modal":"You don't have permission to delete this topic. If you really want it to be deleted, submit a flag for moderator attention together with reasoning.","delete_topic_disallowed":"you don't have permission to delete this topic","add_post_notice":"Add Staff Notice","remove_post_notice":"Remove Staff Notice","remove_timer":"remove timer"},"actions":{"people":{"like":{"one":"liked this","other":"liked this"},"read":{"one":"read this","other":"read this"},"read_capped":{"one":"and {{count}} other read this","other":"and {{count}} others read this"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?","other":"Are you sure you want to delete those {{count}} posts?"}},"revisions":{"controls":{"comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"}},"bookmarks":{"create":"Create bookmark","name_placeholder":"Name the bookmark to help jog your memory","set_reminder":"Set a reminder","actions":{"delete_bookmark":{"name":"Delete bookmark","description":"Removes the bookmark from your profile and stops all reminders for the bookmark"}}}},"category":{"choose":"category\u0026hellip;","edit_dialog_title":"Edit: %{categoryName}","tags_allowed_tags":"Restrict these tags to this category:","tags_allowed_tag_groups":"Restrict these tag groups to this category:","tags_tab_description":"Tags and tag groups specified above will only be available in this category and other categories that also specify them. They won't be available for use in other categories.","manage_tag_groups_link":"Manage tag groups here.","allow_global_tags_label":"Also allow other tags","tag_group_selector_placeholder":"(Optional) Tag group","required_tag_group_description":"Require new topics to have tags from a tag group:","min_tags_from_required_group_label":"Num Tags:","required_tag_group_label":"Tag group:","uncategorized_security_warning":"This category is special. It is intended as holding area for topics that have no category; it cannot have security settings.","uncategorized_general_warning":"This category is special. It is used as the default category for new topics that do not have a category selected. If you want to prevent this behavior and force category selection, \u003ca href=\"%{settingLink}\"\u003eplease disable the setting here\u003c/a\u003e. If you want to change the name or description, go to \u003ca href=\"%{customizeLink}\"\u003eCustomize / Text Content\u003c/a\u003e.","pending_permission_change_alert":"You haven't added %{group} to this category; click this button to add them.","mailinglist_mirror":"Category mirrors a mailing list","all_topics_wiki":"Make new topics wikis by default","reviewable_by_group":"In addition to staff, posts and flags in this category can be also be reviewed by:","require_topic_approval":"Require moderator approval of all new topics","require_reply_approval":"Require moderator approval of all new replies","position":"Position on the categories page:","minimum_required_tags":"Minimum number of tags required in a topic:","num_auto_bump_daily":"Number of open topics to automatically bump daily:","navigate_to_first_post_after_read":"Navigate to first post after topics are read","notifications":{"watching_first_post":{"description":"You will be notified of new topics in this category but not replies to the topics."}},"search_priority":{"label":"Search Priority","options":{"very_low":"Very Low","low":"Low","high":"High","very_high":"Very High"}},"settings_sections":{"moderation":"Moderation","appearance":"Appearance"}},"topic_statuses":{"personal_message":{"title":"This topic is a personal message"}},"browser_update":"Unfortunately, \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eyour browser is too old to work on this site\u003c/a\u003e. Please \u003ca href=\"https://browsehappy.com\"\u003eupgrade your browser\u003c/a\u003e.","lightbox":{"previous":"Previous (Left arrow key)","next":"Next (Right arrow key)","counter":"%curr% of %total%","close":"Close (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eThe content\u003c/a\u003e could not be loaded.","image_load_error":"\u003ca href=\"%url%\"\u003eThe image\u003c/a\u003e could not be loaded."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} or %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","jump_to":{"drafts":"%{shortcut} Drafts"},"navigation":{"go_to_unread_post":"%{shortcut} Go to the first unread post"},"composing":{"title":"Composing","return":"%{shortcut} Return to composer","fullscreen":"%{shortcut} Fullscreen composer"},"actions":{"defer":"%{shortcut} Defer topic","topic_admin_actions":"%{shortcut} Open topic admin actions"}},"badges":{"none":"(none)","successfully_granted":"Successfully granted %{badge} to %{username}"},"tagging":{"other_tags":"Other Tags","choose_for_topic":"optional tags","info":"Info","default_info":"This tag isn't restricted to any categories, and has no synonyms.","category_restricted":"This tag is restricted to categories you don't have permission to access.","synonyms":"Synonyms","synonyms_description":"When the following tags are used, they will be replaced with \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\".","other":"This tag belongs to these groups: {{tag_groups}}."},"category_restrictions":{"one":"It can only be used in this category:","other":"It can only be used in these categories:"},"edit_synonyms":"Manage Synonyms","add_synonyms_label":"Add synonyms:","add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?","other":"Any place that currently uses these tags will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"add_synonyms_failed":"The following tags couldn't be added as synonyms: \u003cb\u003e%{tag_names}\u003c/b\u003e. Ensure they don't have synonyms and aren't synonyms of another tag.","remove_synonym":"Remove Synonym","delete_synonym_confirm":"Are you sure you want to delete the synonym \"%{tag_name}\"?","delete_confirm_synonyms":{"one":"Its synonym will also be deleted.","other":"Its {{count}} synonyms will also be deleted."},"upload":"Upload Tags","upload_description":"Upload a csv file to create tags in bulk","upload_instructions":"One per line, optionally with a tag group in the format 'tag_name,tag_group'.","upload_successful":"Tags uploaded successfully","delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}","other":"%{count} tags will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more","other":"%{tags} and %{count} more"},"delete_unused":"Delete Unused Tags","delete_unused_description":"Delete all tags which are not attached to any topics or personal messages","notifications":{"watching":{"description":"You will automatically watch all topics with this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"description":"You will be notified of new topics in this tag but not replies to the topics."},"tracking":{"description":"You will automatically track all topics with this tag. A count of unread and new posts will appear next to the topic."},"muted":{"description":"You will not be notified of anything about new topics with this tag, and they will not appear on your unread tab."}},"groups":{"tags_placeholder":"tags","name_placeholder":"Tag Group Name","everyone_can_use":"Tags can be used by everyone","usable_only_by_staff":"Tags are visible to everyone, but only staff can use them","visible_only_to_staff":"Tags are visible only to staff"}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a \u003ca href\u003ecustom message\u003c/a\u003e."},"forced_anonymous":"Due to extreme load, this is temporarily being shown to everyone as a logged out user would see it.","discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"details":{"title":"Hide Details"},"discourse_local_dates":{"relative_dates":{"today":"Today %{time}","tomorrow":"Tomorrow %{time}","yesterday":"Yesterday %{time}","countdown":{"passed":"date has passed"}},"title":"Insert date / time","create":{"form":{"insert":"Insert","advanced_mode":"Advanced mode","simple_mode":"Simple mode","format_description":"Format used to display the date to the user. Use \"\\T\\Z\" to display the user timezone in words (Europe/Paris)","timezones_title":"Timezones to display","timezones_description":"Timezones will be used to display dates in preview and fallback.","recurring_title":"Recurrence","recurring_description":"Define the recurrence of an event. You can also manually edit the recurring option generated by the form and use one of the following keys: years, quarters, months, weeks, days, hours, minutes, seconds, milliseconds.","recurring_none":"No recurrence","invalid_date":"Invalid date, make sure date and time are correct","date_title":"Date","format_title":"Date format","timezone":"Timezone","until":"Until...","recurring":{"every_day":"Every day","every_week":"Every week","every_two_weeks":"Every two weeks","every_month":"Every month","every_two_months":"Every two months","every_three_months":"Every three months","every_six_months":"Every six months","every_year":"Every year"}}}},"poll":{"public":{"title":"Votes are \u003cstrong\u003epublic\u003c/strong\u003e."},"results":{"groups":{"title":"You need to be a member of %{groups} to vote in this poll."},"vote":{"title":"Results will be shown on \u003cstrong\u003evote\u003c/strong\u003e."},"closed":{"title":"Results will be shown once \u003cstrong\u003eclosed\u003c/strong\u003e."},"staff":{"title":"Results are only shown to \u003cstrong\u003estaff\u003c/strong\u003e members."}},"hide-results":{"label":"Show vote"},"group-results":{"title":"Group votes by user field","label":"Show breakdown"},"ungroup-results":{"title":"Combine all votes","label":"Hide breakdown"},"export-results":{"title":"Export the poll results"},"automatic_close":{"closes_in":"Closes in \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Closed \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_exporting_results":"Sorry, there was an error exporting poll results.","ui_builder":{"help":{"options_count":"Enter at least 1 option"},"poll_result":{"always":"Always visible","vote":"On vote","closed":"When closed","staff":"Staff only"},"poll_groups":{"label":"Allowed groups"},"poll_chart_type":{"label":"Chart type"},"automatic_close":{"label":"Automatically close poll"}}},"presence":{"replying_to_topic":{"one":"replying","other":"replying"}}}}};
I18n.locale = 'el';
I18n.pluralizationRules.el = MessageFormat.locale.el;
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

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }


    var el = moment.defineLocale('el', {
        monthsNominativeEl : 'Ιανουάριος_Φεβρουάριος_Μάρτιος_Απρίλιος_Μάιος_Ιούνιος_Ιούλιος_Αύγουστος_Σεπτέμβριος_Οκτώβριος_Νοέμβριος_Δεκέμβριος'.split('_'),
        monthsGenitiveEl : 'Ιανουαρίου_Φεβρουαρίου_Μαρτίου_Απριλίου_Μαΐου_Ιουνίου_Ιουλίου_Αυγούστου_Σεπτεμβρίου_Οκτωβρίου_Νοεμβρίου_Δεκεμβρίου'.split('_'),
        months : function (momentToFormat, format) {
            if (!momentToFormat) {
                return this._monthsNominativeEl;
            } else if (typeof format === 'string' && /D/.test(format.substring(0, format.indexOf('MMMM')))) { // if there is a day number before 'MMMM'
                return this._monthsGenitiveEl[momentToFormat.month()];
            } else {
                return this._monthsNominativeEl[momentToFormat.month()];
            }
        },
        monthsShort : 'Ιαν_Φεβ_Μαρ_Απρ_Μαϊ_Ιουν_Ιουλ_Αυγ_Σεπ_Οκτ_Νοε_Δεκ'.split('_'),
        weekdays : 'Κυριακή_Δευτέρα_Τρίτη_Τετάρτη_Πέμπτη_Παρασκευή_Σάββατο'.split('_'),
        weekdaysShort : 'Κυρ_Δευ_Τρι_Τετ_Πεμ_Παρ_Σαβ'.split('_'),
        weekdaysMin : 'Κυ_Δε_Τρ_Τε_Πε_Πα_Σα'.split('_'),
        meridiem : function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'μμ' : 'ΜΜ';
            } else {
                return isLower ? 'πμ' : 'ΠΜ';
            }
        },
        isPM : function (input) {
            return ((input + '').toLowerCase()[0] === 'μ');
        },
        meridiemParse : /[ΠΜ]\.?Μ?\.?/i,
        longDateFormat : {
            LT : 'h:mm A',
            LTS : 'h:mm:ss A',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY h:mm A',
            LLLL : 'dddd, D MMMM YYYY h:mm A'
        },
        calendarEl : {
            sameDay : '[Σήμερα {}] LT',
            nextDay : '[Αύριο {}] LT',
            nextWeek : 'dddd [{}] LT',
            lastDay : '[Χθες {}] LT',
            lastWeek : function () {
                switch (this.day()) {
                    case 6:
                        return '[το προηγούμενο] dddd [{}] LT';
                    default:
                        return '[την προηγούμενη] dddd [{}] LT';
                }
            },
            sameElse : 'L'
        },
        calendar : function (key, mom) {
            var output = this._calendarEl[key],
                hours = mom && mom.hours();
            if (isFunction(output)) {
                output = output.apply(mom);
            }
            return output.replace('{}', (hours % 12 === 1 ? 'στη' : 'στις'));
        },
        relativeTime : {
            future : 'σε %s',
            past : '%s πριν',
            s : 'λίγα δευτερόλεπτα',
            ss : '%d δευτερόλεπτα',
            m : 'ένα λεπτό',
            mm : '%d λεπτά',
            h : 'μία ώρα',
            hh : '%d ώρες',
            d : 'μία μέρα',
            dd : '%d μέρες',
            M : 'ένας μήνας',
            MM : '%d μήνες',
            y : 'ένας χρόνος',
            yy : '%d χρόνια'
        },
        dayOfMonthOrdinalParse: /\d{1,2}η/,
        ordinal: '%dη',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4st is the first week of the year.
        }
    });

    return el;

})));

// moment-timezone-localization for lang code: el

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Αμπιτζάν","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Άκρα","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Αντίς Αμπέμπα","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Αλγέρι","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Ασμάρα","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Μπαμάκο","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Μπανγκί","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Μπανζούλ","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Μπισάου","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Μπλαντάιρ","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Μπραζαβίλ","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Μπουζουμπούρα","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Κάιρο","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Καζαμπλάνκα","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Θέουτα","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Κόνακρι","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Ντακάρ","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Νταρ Ες Σαλάμ","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Τζιμπουτί","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Ντουάλα","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"Ελ Αγιούν","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Φρίταουν","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Γκαμπορόνε","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Χαράρε","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Γιοχάνεσμπουργκ","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Τζούμπα","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Καμπάλα","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Χαρτούμ","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Κιγκάλι","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Κινσάσα","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Λάγκος","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Λιμπρεβίλ","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Λομέ","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Λουάντα","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Λουμπουμπάσι","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Λουζάκα","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Μαλάμπο","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Μαπούτο","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Μασέρου","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Μπαμπάνε","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Μογκαντίσου","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Μονρόβια","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Ναϊρόμπι","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ντζαμένα","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Νιαμέι","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Νουακσότ","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ουαγκαντούγκου","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Πόρτο-Νόβο","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Σάο Τομέ","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Τρίπολη","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Τύνιδα","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Βίντχουκ","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Άντακ","id":"America/Adak"},{"value":"America/Anchorage","name":"Άνκορατζ","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Ανγκουίλα","id":"America/Anguilla"},{"value":"America/Antigua","name":"Αντίγκουα","id":"America/Antigua"},{"value":"America/Araguaina","name":"Αραγκουάινα","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"Λα Ριόχα","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Ρίο Γκαγιέγκος","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Σάλτα","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"Σαν Χουάν","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"Σαν Λούις","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Τουκουμάν","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ουσουάια","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Αρούμπα","id":"America/Aruba"},{"value":"America/Asuncion","name":"Ασουνσιόν","id":"America/Asuncion"},{"value":"America/Bahia","name":"Μπαΐα","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Μπαΐα ντε Μπαντέρας","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Μπαρμπέιντος","id":"America/Barbados"},{"value":"America/Belem","name":"Μπελέμ","id":"America/Belem"},{"value":"America/Belize","name":"Μπελίζ","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Μπλαν Σαμπλόν","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Μπόα Βίστα","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Μπογκοτά","id":"America/Bogota"},{"value":"America/Boise","name":"Μπόιζι","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Μπουένος Άιρες","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Κέμπριτζ Μπέι","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Κάμπο Γκράντε","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Κανκούν","id":"America/Cancun"},{"value":"America/Caracas","name":"Καράκας","id":"America/Caracas"},{"value":"America/Catamarca","name":"Καταμάρκα","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Καγιέν","id":"America/Cayenne"},{"value":"America/Cayman","name":"Κέιμαν","id":"America/Cayman"},{"value":"America/Chicago","name":"Σικάγο","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Τσιουάουα","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Ατικόκαν","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Κόρδοβα","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Κόστα Ρίκα","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Κρέστον","id":"America/Creston"},{"value":"America/Cuiaba","name":"Κουιαμπά","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Κουρασάο","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Ντανμαρκσάβν","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Ντόσον","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Ντόσον Κρικ","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Ντένβερ","id":"America/Denver"},{"value":"America/Detroit","name":"Ντιτρόιτ","id":"America/Detroit"},{"value":"America/Dominica","name":"Ντομίνικα","id":"America/Dominica"},{"value":"America/Edmonton","name":"Έντμοντον","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Εϊρουνεπέ","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"Ελ Σαλβαδόρ","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Φορτ Νέλσον","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Φορταλέζα","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Γκλέις Μπέι","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Νουούκ","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Γκους Μπέι","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Γκραντ Τουρκ","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Γρενάδα","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Γουαδελούπη","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Γουατεμάλα","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Γκουαγιακίλ","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Γουιάνα","id":"America/Guyana"},{"value":"America/Halifax","name":"Χάλιφαξ","id":"America/Halifax"},{"value":"America/Havana","name":"Αβάνα","id":"America/Havana"},{"value":"America/Hermosillo","name":"Ερμοσίγιο","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Νοξ, Ιντιάνα","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Μαρένγκο, Ιντιάνα","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Πίτερσμπεργκ, Ιντιάνα","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Τελ Σίτι, Ιντιάνα","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Βιβέι, Ιντιάνα","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Βανσέν, Ιντιάνα","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Γουίναμακ, Ιντιάνα","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Ιντιανάπολις","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Ινούβικ","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Ικαλούιτ","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Τζαμάικα","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Χουχούι","id":"America/Jujuy"},{"value":"America/Juneau","name":"Τζούνο","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Μοντιτσέλο, Κεντάκι","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Κράλεντικ","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"Λα Παζ","id":"America/La_Paz"},{"value":"America/Lima","name":"Λίμα","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Λος Άντζελες","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Λούιβιλ","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Μασεϊό","id":"America/Maceio"},{"value":"America/Managua","name":"Μανάγκουα","id":"America/Managua"},{"value":"America/Manaus","name":"Μανάους","id":"America/Manaus"},{"value":"America/Marigot","name":"Μαριγκό","id":"America/Marigot"},{"value":"America/Martinique","name":"Μαρτινίκα","id":"America/Martinique"},{"value":"America/Matamoros","name":"Ματαμόρος","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Μαζατλάν","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Μεντόζα","id":"America/Mendoza"},{"value":"America/Menominee","name":"Μενομίνε","id":"America/Menominee"},{"value":"America/Merida","name":"Μέριδα","id":"America/Merida"},{"value":"America/Metlakatla","name":"Μετλακάτλα","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Πόλη του Μεξικού","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Μικελόν","id":"America/Miquelon"},{"value":"America/Moncton","name":"Μόνκτον","id":"America/Moncton"},{"value":"America/Monterrey","name":"Μοντερέι","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Μοντεβιδέο","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Μονσεράτ","id":"America/Montserrat"},{"value":"America/Nassau","name":"Νασάου","id":"America/Nassau"},{"value":"America/New_York","name":"Νέα Υόρκη","id":"America/New_York"},{"value":"America/Nipigon","name":"Νιπιγκόν","id":"America/Nipigon"},{"value":"America/Nome","name":"Νόμε","id":"America/Nome"},{"value":"America/Noronha","name":"Νορόνια","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Μπέουλα, Βόρεια Ντακότα","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Σέντερ, Βόρεια Ντακότα","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"Νιου Σέιλεμ, Βόρεια Ντακότα","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Οχινάγκα","id":"America/Ojinaga"},{"value":"America/Panama","name":"Παναμάς","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Πανγκνίρτουνγκ","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Παραμαρίμπο","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Φοίνιξ","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Πορτ-ο-Πρενς","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Πορτ οφ Σπέιν","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Πόρτο Βέλιο","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Πουέρτο Ρίκο","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Πούντα Αρένας","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Ρέινι Ρίβερ","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Ράνκιν Ίνλετ","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Ρεσίφε","id":"America/Recife"},{"value":"America/Regina","name":"Ρετζίνα","id":"America/Regina"},{"value":"America/Resolute","name":"Ρέζολουτ","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Ρίο Μπράνκο","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Σάντα Ιζαμπέλ","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Σανταρέμ","id":"America/Santarem"},{"value":"America/Santiago","name":"Σαντιάγκο","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Άγιος Δομίνικος","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"Σάο Πάολο","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Σκορεσμπίσουντ","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Σίτκα","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Άγιος Βαρθολομαίος","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"Σεν Τζονς","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Σεν Κιτς","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Αγία Λουκία","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Άγιος Θωμάς","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Άγιος Βικέντιος","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Σουίφτ Κάρεντ","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Τεγκουσιγκάλπα","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Θούλη","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Θάντερ Μπέι","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Τιχουάνα","id":"America/Tijuana"},{"value":"America/Toronto","name":"Τορόντο","id":"America/Toronto"},{"value":"America/Tortola","name":"Τορτόλα","id":"America/Tortola"},{"value":"America/Vancouver","name":"Βανκούβερ","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Γουάιτχορς","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Γουίνιπεγκ","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Γιακούτατ","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Γέλοουναϊφ","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Κάσεϊ","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Ντέιβις","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Ντιμόν ντ’ Ουρβίλ","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Μακουάρι","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Μόσον","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"Μακμέρντο","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Πάλμερ","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Ρόθερα","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Σίοβα","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Τρολ","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Βόστοκ","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Λόνγκιεαρμπιεν","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Άντεν","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Αλμάτι","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Αμμάν","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Αναντίρ","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Ακτάου","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Ακτόμπε","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ασχαμπάτ","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Aτιράου","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Βαγδάτη","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Μπαχρέιν","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Μπακού","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Μπανγκόκ","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Μπαρναούλ","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Βυρητός","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Μπισκέκ","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Μπρουνέι","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Καλκούτα","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Τσιτά","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Τσοϊμπαλσάν","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Κολόμπο","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Δαμασκός","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Ντάκα","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Ντίλι","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Ντουμπάι","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Ντουσάνμπε","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Αμμόχωστος","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Γάζα","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Χεβρώνα","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Χονγκ Κονγκ","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Χοβντ","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Ιρκούτσκ","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Τζακάρτα","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Τζαγιαπούρα","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Ιερουσαλήμ","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Καμπούλ","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Καμτσάτκα","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Καράτσι","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Κατμαντού","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Χαντίγκα","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Κρασνογιάρσκ","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Κουάλα Λουμπούρ","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Κουτσίνγκ","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Κουβέιτ","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Μακάο","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Μαγκαντάν","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Μακασάρ","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Μανίλα","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Μασκάτ","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Λευκωσία","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Νοβοκουζνέτσκ","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Νοβοσιμπίρσκ","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Ομσκ","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Οράλ","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Πνομ Πενχ","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Πόντιανακ","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Πιονγκγιάνγκ","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Κατάρ","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Κιζιλορντά","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Ρανγκούν","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Ριάντ","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Πόλη Χο Τσι Μινχ","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Σαχαλίνη","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Σαμαρκάνδη","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Σεούλ","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Σανγκάη","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Σιγκαπούρη","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Σρεντνεκολίμσκ","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Ταϊπέι","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Τασκένδη","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Τιφλίδα","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Τεχεράνη","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Θίμφου","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Τόκιο","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Τομσκ","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ουλάν Μπατόρ","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Ουρούμτσι","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ουστ-Νερά","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Βιεντιάν","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Βλαδιβοστόκ","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Γιακούτσκ","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Αικατερινούπολη","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Ερεβάν","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Αζόρες","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Βερμούδες","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Κανάρια","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Πράσινο Ακρωτήριο","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Φερόες","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Μαδέρα","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Ρέυκιαβικ","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Νότια Γεωργία","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Αγ. Ελένη","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Στάνλεϊ","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Αδελαΐδα","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Μπρισμπέιν","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Μπρόκεν Χιλ","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Κάρι","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Ντάργουιν","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Γιούκλα","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Χόμπαρτ","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Λίντεμαν","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Λορντ Χάου","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Μελβούρνη","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Περθ","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Σίδνεϊ","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Συντονισμένη Παγκόσμια Ώρα","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Άμστερνταμ","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Ανδόρα","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Αστραχάν","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Αθήνα","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Βελιγράδι","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Βερολίνο","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Μπρατισλάβα","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Βρυξέλλες","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Βουκουρέστι","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Βουδαπέστη","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Μπίσινγκεν","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Κισινάου","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Κοπεγχάγη","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Χειμερινή ώρα ΙρλανδίαςΔουβλίνο","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Γιβραλτάρ","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Γκέρνζι","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Ελσίνκι","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Νήσος του Μαν","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Κωνσταντινούπολη","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Τζέρσεϊ","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Καλίνινγκραντ","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Κίεβο","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Κίροφ","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Λισαβόνα","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Λιουμπλιάνα","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Θερινή ώρα ΒρετανίαςΛονδίνο","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Λουξεμβούργο","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Μαδρίτη","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Μάλτα","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Μάριεχαμν","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Μινσκ","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Μονακό","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Μόσχα","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Όσλο","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Παρίσι","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Ποντγκόριτσα","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Πράγα","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Ρίγα","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Ρώμη","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Σαμάρα","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"Άγιος Μαρίνος","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Σαράγεβο","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Σαράτοφ","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Συμφερόπολη","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Σκόπια","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Σόφια","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Στοκχόλμη","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Ταλίν","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Τίρανα","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Ουλιάνοφσκ","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Ούζχοροντ","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Βαντούζ","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Βατικανό","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Βιέννη","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Βίλνιους","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Βόλγκοκραντ","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Βαρσοβία","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Ζάγκρεμπ","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Ζαπορόζιε","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Ζυρίχη","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Ανταναναρίβο","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Τσάγκος","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Νήσος Χριστουγέννων","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Κόκος","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Κομόρο","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Κεργκελέν","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Μάχε","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Μαλδίβες","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Μαυρίκιος","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Μαγιότ","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Ρεϊνιόν","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Απία","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Όκλαντ","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Μπουγκενβίλ","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Τσάταμ","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Νήσος Πάσχα","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Εφάτε","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Έντερμπερι","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Φακαόφο","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Φίτζι","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Φουναφούτι","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Γκαλάπαγκος","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Γκάμπιερ","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Γκουανταλκανάλ","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Γκουάμ","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Χονολουλού","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Τζόνστον","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Κιριτιμάτι","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Κόσραϊ","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Κουατζαλέιν","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Ματζούρο","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Μαρκέζας","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Μίντγουεϊ","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Ναούρου","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Νιούε","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Νόρφολκ","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Νουμέα","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Πάγκο Πάγκο","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Παλάου","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Πίτκερν","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Πονάπε","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Πορτ Μόρεσμπι","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Ραροτόνγκα","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Σαϊπάν","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Ταϊτή","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Ταράουα","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Τονγκατάπου","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Τσουκ","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Γουέικ","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Γουάλις","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

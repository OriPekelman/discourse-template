(function ($) {
  var DATE_TEMPLATE = "\n    <span>\n      <svg class=\"fa d-icon d-icon-globe-americas svg-icon\" xmlns=\"http://www.w3.org/2000/svg\">\n        <use xlink:href=\"#globe-americas\"></use>\n      </svg>\n      <span class=\"relative-time\"></span>\n    </span>\n  ";

  var PREVIEW_TEMPLATE = "\n    <div class='preview'>\n      <span class='timezone'></span>\n      <span class='date-time'></span>\n    </div>\n  ";

  function processElement($element) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    clearTimeout(this.timeout);

    var utc = moment().utc();
    var dateTime = options.time ? options.date + " " + options.time : options.date;

    var displayedTimezone = void 0;
    if (options.time) {
      displayedTimezone = options.displayedTimezone || moment.tz.guess();
    } else {
      displayedTimezone = options.displayedTimezone || options.timezone || moment.tz.guess();
    }

    // if timezone given we convert date and time from given zone to Etc/UTC
    var utcDateTime = void 0;
    if (options.timezone) {
      utcDateTime = _applyZoneToDateTime(dateTime, options.timezone);
    } else {
      utcDateTime = moment.utc(dateTime);
    }

    if (utcDateTime < utc) {
      // if event is in the past we want to bump it no next occurrence when
      // recurring is set
      if (options.recurring) {
        utcDateTime = _applyRecurrence(utcDateTime, options);
      } else {
        $element.addClass("past");
      }
    }

    // once we have the correct UTC date we want
    // we adjust it to watching user timezone
    var adjustedDateTime = utcDateTime.tz(displayedTimezone);

    var previews = _generatePreviews(adjustedDateTime.clone(), displayedTimezone, options);
    var textPreview = _generateTextPreview(previews);
    var htmlPreview = _generateHtmlPreview(previews);

    var formatedDateTime = _applyFormatting(adjustedDateTime, displayedTimezone, options);

    $element.html(DATE_TEMPLATE).attr("aria-label", textPreview).attr("data-html-tooltip", "<div class=\"locale-dates-previews\">" + htmlPreview + "</div>").addClass("cooked-date").find(".relative-time").text(formatedDateTime);

    this.timeout = setTimeout(function () {
      return processElement($element, options);
    }, 60 * 1000);
  }

  function _formatTimezone(timezone) {
    return timezone.replace("_", " ").replace("Etc/", "").split("/");
  }

  function _zoneWithoutPrefix(timezone) {
    var parts = _formatTimezone(timezone);
    return parts[1] || parts[0];
  }

  function _applyZoneToDateTime(dateTime, timezone) {
    return moment.tz(dateTime, timezone).utc();
  }

  function _translateCalendarKey(time, key) {
    var translated = I18n.t("discourse_local_dates.relative_dates." + key, {
      time: "LT"
    });

    if (time) {
      return translated.split("LT").map(function (w) {
        return "[" + w + "]";
      }).join("LT");
    } else {
      return "[" + translated.replace(" LT", "") + "]";
    }
  }

  function _calendarFormats(time) {
    return {
      sameDay: _translateCalendarKey(time, "today"),
      nextDay: _translateCalendarKey(time, "tomorrow"),
      lastDay: _translateCalendarKey(time, "yesterday"),
      sameElse: "L"
    };
  }

  function _isEqualZones(timezoneA, timezoneB) {
    if ((timezoneA || timezoneB) && (!timezoneA || !timezoneB)) {
      return false;
    }

    if (timezoneA.includes(timezoneB) || timezoneB.includes(timezoneA)) {
      return true;
    }

    return moment.tz(timezoneA).utcOffset() === moment.tz(timezoneB).utcOffset();
  }

  function _applyFormatting(dateTime, displayedTimezone, options) {
    if (options.countdown) {
      var diffTime = dateTime.diff(moment());
      if (diffTime < 0) {
        return I18n.t("discourse_local_dates.relative_dates.countdown.passed");
      } else {
        return moment.duration(diffTime).humanize();
      }
    }

    var sameTimezone = _isEqualZones(displayedTimezone, moment.tz.guess());
    var inCalendarRange = dateTime.isBetween(moment().subtract(2, "days"), moment().add(1, "days").endOf("day"));

    if (options.calendar && inCalendarRange) {
      if (sameTimezone) {
        if (options.time) {
          dateTime = dateTime.calendar(null, _calendarFormats(options.time));
        } else {
          dateTime = dateTime.calendar(null, _calendarFormats(null));
        }
      } else {
        dateTime = dateTime.format(options.format);
        dateTime = dateTime.replace("TZ", "");
        dateTime = dateTime + " (" + _zoneWithoutPrefix(displayedTimezone) + ")";
      }
    } else {
      if (options.time) {
        dateTime = dateTime.format(options.format);

        if (options.displayedTimezone && !sameTimezone) {
          dateTime = dateTime.replace("TZ", "");
          dateTime = dateTime + " (" + _zoneWithoutPrefix(displayedTimezone) + ")";
        } else {
          dateTime = dateTime.replace("TZ", _formatTimezone(displayedTimezone).join(": "));
        }
      } else {
        dateTime = dateTime.format(options.format);

        if (!sameTimezone) {
          dateTime = dateTime.replace("TZ", "");
          dateTime = dateTime + " (" + _zoneWithoutPrefix(displayedTimezone) + ")";
        } else {
          dateTime = dateTime.replace("TZ", _zoneWithoutPrefix(displayedTimezone));
        }
      }
    }

    return dateTime;
  }

  function _applyRecurrence(dateTime, _ref) {
    var recurring = _ref.recurring,
        timezone = _ref.timezone;

    var parts = recurring.split(".");
    var count = parseInt(parts[0], 10);
    var type = parts[1];
    var diff = moment().diff(dateTime, type);
    var add = Math.ceil(diff + count);

    // we create new moment object from format
    // to ensure it's created in user context
    var wasDST = moment(dateTime.format()).isDST();
    var dateTimeWithRecurrence = moment(dateTime).add(add, type);
    var isDST = moment(dateTimeWithRecurrence.format()).isDST();

    // these dates are more or less DST "certain"
    var noDSTOffset = moment.tz({ month: 0, day: 1 }, timezone || "Etc/UTC").utcOffset();
    var withDSTOffset = moment.tz({ month: 5, day: 1 }, timezone || "Etc/UTC").utcOffset();

    // we remove the DST offset present when the date was created,
    // and add current DST offset
    if (!wasDST && isDST) {
      dateTimeWithRecurrence.add(-withDSTOffset + noDSTOffset, "minutes");
    }

    // we add the DST offset present when the date was created,
    // and remove current DST offset
    if (wasDST && !isDST) {
      dateTimeWithRecurrence.add(withDSTOffset - noDSTOffset, "minutes");
    }

    return dateTimeWithRecurrence;
  }

  function _createDateTimeRange(dateTime, timezone) {
    var dt = moment(dateTime).tz(timezone);

    return [dt.format("LLL"), "→", dt.add(24, "hours").format("LLL")].join(" ");
  }

  function _generatePreviews(dateTime, displayedTimezone, options) {
    var previewedTimezones = [];
    var watchingUserTimezone = moment.tz.guess();
    var timezones = options.timezones.filter(function (timezone) {
      return !_isEqualZones(timezone, watchingUserTimezone) && !_isEqualZones(timezone, options.timezone);
    });

    previewedTimezones.push({
      timezone: watchingUserTimezone,
      current: true,
      dateTime: options.time ? moment(dateTime).tz(watchingUserTimezone).format("LLL") : _createDateTimeRange(dateTime, watchingUserTimezone)
    });

    if (options.timezone && displayedTimezone === watchingUserTimezone && options.timezone !== displayedTimezone && !_isEqualZones(displayedTimezone, options.timezone)) {
      timezones.unshift(options.timezone);
    }

    Array.from(new Set(timezones.filter(Boolean))).forEach(function (timezone) {
      if (_isEqualZones(timezone, displayedTimezone)) {
        return;
      }

      if (_isEqualZones(timezone, watchingUserTimezone)) {
        timezone = watchingUserTimezone;
      }

      previewedTimezones.push({
        timezone: timezone,
        dateTime: options.time ? moment(dateTime).tz(timezone).format("LLL") : _createDateTimeRange(dateTime, timezone)
      });
    });

    if (!previewedTimezones.length) {
      previewedTimezones.push({
        timezone: "Etc/UTC",
        dateTime: options.time ? moment(dateTime).tz("Etc/UTC").format("LLL") : _createDateTimeRange(dateTime, "Etc/UTC")
      });
    }

    return _.uniq(previewedTimezones, "timezone");
  }

  function _generateTextPreview(previews) {
    return previews.map(function (preview) {
      var formatedZone = _zoneWithoutPrefix(preview.timezone);

      if (preview.dateTime.match(/TZ/)) {
        return preview.dateTime.replace(/TZ/, formatedZone);
      } else {
        return formatedZone + " " + preview.dateTime;
      }
    }).join(", ");
  }

  function _generateHtmlPreview(previews) {
    return previews.map(function (preview) {
      var $template = $(PREVIEW_TEMPLATE);

      if (preview.current) $template.addClass("current");

      $template.find(".timezone").text(_zoneWithoutPrefix(preview.timezone));
      $template.find(".date-time").text(preview.dateTime);
      return $template[0].outerHTML;
    }).join("");
  }

  $.fn.applyLocalDates = function () {
    return this.each(function () {
      var $element = $(this);

      var options = {};
      options.time = $element.attr("data-time");
      options.date = $element.attr("data-date");
      options.recurring = $element.attr("data-recurring");
      options.timezones = ($element.attr("data-timezones") || Discourse.SiteSettings.discourse_local_dates_default_timezones || "Etc/UTC").split("|");
      options.timezone = $element.attr("data-timezone");
      options.calendar = ($element.attr("data-calendar") || "on") === "on";
      options.displayedTimezone = $element.attr("data-displayed-timezone");
      options.format = $element.attr("data-format") || (options.time ? "LLL" : "LL");
      options.countdown = $element.attr("data-countdown");

      processElement($element, options);
    });
  };
})(jQuery);
define("discourse/plugins/discourse-local-dates/discourse/components/discourse-local-dates-create-form", ["exports", "@ember/utils", "@ember/runloop", "@ember/component", "discourse/lib/computed", "discourse/lib/load-script", "discourse-common/utils/decorators", "discourse/lib/text", "discourse/lib/debounce"], function (exports, _utils, _runloop, _component, _computed, _loadScript, _decorators, _text, _debounce) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
      desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
      desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
      return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
      desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
      desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
      Object['define' + 'Property'](target, property, desc);
      desc = null;
    }

    return desc;
  }

  var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _desc, _value, _obj, _init, _obj2;

  exports.default = _component.default.extend((_dec = (0, _decorators.observes)("markup"), _dec2 = (0, _decorators.default)("date", "toDate", "toTime"), _dec3 = (0, _decorators.default)("computedConfig", "isRange"), _dec4 = (0, _decorators.default)("date", "time", "isRange", "options.{format,timezone}"), _dec5 = (0, _decorators.default)("toDate", "toTime", "isRange", "options.{timezone,format}"), _dec6 = (0, _decorators.default)("recurring", "timezones", "timezone", "format"), _dec7 = (0, _decorators.default)("fromConfig.{date}", "toConfig.{date}", "options.{recurring,timezones,timezone,format}"), _dec8 = (0, _decorators.default)("currentUserTimezone"), _dec9 = (0, _decorators.default)("formats"), _dec10 = (0, _decorators.default)("advancedMode"), _dec11 = (0, _decorators.default)("computedConfig.{from,to,options}", "options", "isValid", "isRange"), _dec12 = (0, _decorators.default)("fromConfig.dateTime"), _dec13 = (0, _decorators.default)("toConfig.dateTime", "toSelected"), (_obj = (_obj2 = {
    timeFormat: "HH:mm:ss",
    dateFormat: "YYYY-MM-DD",
    dateTimeFormat: "YYYY-MM-DD HH:mm:ss",
    date: null,
    toDate: null,
    time: null,
    toTime: null,
    format: null,
    formats: null,
    recurring: null,
    advancedMode: false,
    isValid: true,
    timezone: null,
    fromSelected: null,
    fromFilled: Ember.computed.notEmpty("date"),
    toSelected: null,
    toFilled: Ember.computed.notEmpty("toDate"),

    init: function init() {
      this._super.apply(this, arguments);

      this._picker = null;

      this.setProperties({
        timezones: [],
        formats: (this.siteSettings.discourse_local_dates_default_formats || "").split("|").filter(function (f) {
          return f;
        }),
        timezone: moment.tz.guess(),
        date: moment().format(this.dateFormat)
      });
    },
    didInsertElement: function didInsertElement() {
      var _this = this;

      this._super.apply(this, arguments);

      this._setupPicker().then(function (picker) {
        _this._picker = picker;
        _this.send("focusFrom");
      });
    },

    _renderPreview: (0, _debounce.default)(function () {
      var _this2 = this;

      var markup = this.markup;

      if (markup) {
        (0, _text.cookAsync)(markup).then(function (result) {
          _this2.set("currentPreview", result);
          (0, _runloop.schedule)("afterRender", function () {
            return _this2.$(".preview .discourse-local-date").applyLocalDates();
          });
        });
      }
    }, 250),

    isRange: function isRange(date, toDate, toTime) {
      return date && (toDate || toTime);
    }
  }, _defineProperty(_obj2, "isValid", function isValid(config, isRange) {
    var fromConfig = config.from;
    if (!config.from.dateTime || !config.from.dateTime.isValid()) {
      return false;
    }

    if (isRange) {
      var toConfig = config.to;

      if (!toConfig.dateTime || !toConfig.dateTime.isValid() || toConfig.dateTime.diff(fromConfig.dateTime) < 0) {
        return false;
      }
    }

    return true;
  }), _defineProperty(_obj2, "fromConfig", function fromConfig(date, time, isRange) {
    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    var timeInferred = time ? false : true;

    var dateTime = void 0;
    if (!timeInferred) {
      dateTime = moment.tz(date + " " + time, options.timezone);
    } else {
      dateTime = moment.tz(date, options.timezone);
    }

    if (!timeInferred) {
      time = dateTime.format(this.timeFormat);
    }

    var format = options.format;
    if (timeInferred && this.formats.includes(format)) {
      format = "LL";
    }

    return Ember.Object.create({
      date: dateTime.format(this.dateFormat),
      time: time,
      dateTime: dateTime,
      format: format,
      range: isRange ? "start" : false
    });
  }), _defineProperty(_obj2, "toConfig", function toConfig(date, time, isRange) {
    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    var timeInferred = time ? false : true;

    if (time && !date) {
      date = moment().format(this.dateFormat);
    }

    var dateTime = void 0;
    if (!timeInferred) {
      dateTime = moment.tz(date + " " + time, options.timezone);
    } else {
      dateTime = moment.tz(date, options.timezone).endOf("day");
    }

    if (!timeInferred) {
      time = dateTime.format(this.timeFormat);
    }

    var format = options.format;
    if (timeInferred && this.formats.includes(format)) {
      format = "LL";
    }

    return Ember.Object.create({
      date: dateTime.format(this.dateFormat),
      time: time,
      dateTime: dateTime,
      format: format,
      range: isRange ? "end" : false
    });
  }), _defineProperty(_obj2, "options", function options(recurring, timezones, timezone, format) {
    return Ember.Object.create({
      recurring: recurring,
      timezones: timezones,
      timezone: timezone,
      format: format
    });
  }), _defineProperty(_obj2, "computedConfig", function computedConfig(fromConfig, toConfig, options) {
    return Ember.Object.create({
      from: fromConfig,
      to: toConfig,
      options: options
    });
  }), _defineProperty(_obj2, "currentUserTimezone", function currentUserTimezone() {
    return moment.tz.guess();
  }), _defineProperty(_obj2, "allTimezones", function allTimezones() {
    return moment.tz.names();
  }), _defineProperty(_obj2, "timezoneIsDifferentFromUserTimezone", (0, _computed.propertyNotEqual)("currentUserTimezone", "options.timezone")), _defineProperty(_obj2, "formatedCurrentUserTimezone", function formatedCurrentUserTimezone(timezone) {
    return timezone.replace("_", " ").replace("Etc/", "").split("/");
  }), _defineProperty(_obj2, "previewedFormats", function previewedFormats(formats) {
    return formats.map(function (format) {
      return {
        format: format,
        preview: moment().format(format)
      };
    });
  }), _defineProperty(_obj2, "recurringOptions", function recurringOptions() {
    var key = "discourse_local_dates.create.form.recurring";

    return [{
      name: I18n.t(key + ".every_day"),
      id: "1.days"
    }, {
      name: I18n.t(key + ".every_week"),
      id: "1.weeks"
    }, {
      name: I18n.t(key + ".every_two_weeks"),
      id: "2.weeks"
    }, {
      name: I18n.t(key + ".every_month"),
      id: "1.months"
    }, {
      name: I18n.t(key + ".every_two_months"),
      id: "2.months"
    }, {
      name: I18n.t(key + ".every_three_months"),
      id: "3.months"
    }, {
      name: I18n.t(key + ".every_six_months"),
      id: "6.months"
    }, {
      name: I18n.t(key + ".every_year"),
      id: "1.years"
    }];
  }), _defineProperty(_obj2, "_generateDateMarkup", function _generateDateMarkup(config, options, isRange) {
    var text = "[date=" + config.date;

    if (config.time) {
      text += " time=" + config.time;
    }

    if (config.format && config.format.length) {
      text += " format=\"" + config.format + "\"";
    }

    if (options.timezone) {
      text += " timezone=\"" + options.timezone + "\"";
    }

    if (options.timezones && options.timezones.length) {
      text += " timezones=\"" + options.timezones.join("|") + "\"";
    }

    if (options.recurring && !isRange) {
      text += " recurring=\"" + options.recurring + "\"";
    }

    text += "]";

    return text;
  }), _defineProperty(_obj2, "toggleModeBtnLabel", function toggleModeBtnLabel(advancedMode) {
    return advancedMode ? "discourse_local_dates.create.form.simple_mode" : "discourse_local_dates.create.form.advanced_mode";
  }), _defineProperty(_obj2, "markup", function markup(config, options, isValid, isRange) {
    var text = void 0;

    if (isValid && config.from) {
      text = this._generateDateMarkup(config.from, options, isRange);

      if (config.to && config.to.range) {
        text += " \u2192 ";
        text += this._generateDateMarkup(config.to, options, isRange);
      }
    }

    return text;
  }), _defineProperty(_obj2, "formattedFrom", function formattedFrom(dateTime) {
    return dateTime.format("LLLL");
  }), _defineProperty(_obj2, "formattedTo", function formattedTo(dateTime, toSelected) {
    var emptyText = toSelected ? "&nbsp;" : I18n.t("discourse_local_dates.create.form.until");

    return dateTime.isValid() ? dateTime.format("LLLL") : emptyText;
  }), _defineProperty(_obj2, "actions", {
    setTime: function setTime(event) {
      this._setTimeIfValid(event.target.value, "time");
    },
    setToTime: function setToTime(event) {
      this._setTimeIfValid(event.target.value, "toTime");
    },
    eraseToDateTime: function eraseToDateTime() {
      this.setProperties({ toDate: null, toTime: null });
      this._setPickerDate(null);
    },
    focusFrom: function focusFrom() {
      this.setProperties({ fromSelected: true, toSelected: false });
      this._setPickerDate(this.get("fromConfig.date"));
      this._setPickerMinDate(null);
    },
    focusTo: function focusTo() {
      this.setProperties({ toSelected: true, fromSelected: false });
      this._setPickerDate(this.get("toConfig.date"));
      this._setPickerMinDate(this.get("fromConfig.date"));
    },
    advancedMode: function advancedMode() {
      this.toggleProperty("advancedMode");
    },
    save: function save() {
      var markup = this.markup;

      if (markup) {
        this._closeModal();
        this.toolbarEvent.addText(markup);
      }
    },
    cancel: function cancel() {
      this._closeModal();
    }
  }), _defineProperty(_obj2, "_setTimeIfValid", function _setTimeIfValid(time, key) {
    if ((0, _utils.isEmpty)(time)) {
      this.set(key, null);
      return;
    }

    if (/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      this.set(key, time);
    }
  }), _defineProperty(_obj2, "_setupPicker", function _setupPicker() {
    var _this3 = this;

    return new Ember.RSVP.Promise(function (resolve) {
      (0, _loadScript.default)("/javascripts/pikaday.js").then(function () {
        var options = {
          field: _this3.$(".fake-input")[0],
          container: _this3.$("#picker-container-" + _this3.elementId)[0],
          bound: false,
          format: "YYYY-MM-DD",
          reposition: false,
          firstDay: 1,
          setDefaultDate: true,
          keyboardInput: false,
          i18n: {
            previousMonth: I18n.t("dates.previous_month"),
            nextMonth: I18n.t("dates.next_month"),
            months: moment.months(),
            weekdays: moment.weekdays(),
            weekdaysShort: moment.weekdaysMin()
          },
          onSelect: function onSelect(date) {
            var formattedDate = moment(date).format("YYYY-MM-DD");

            if (_this3.fromSelected) {
              _this3.set("date", formattedDate);
            }

            if (_this3.toSelected) {
              _this3.set("toDate", formattedDate);
            }
          }
        };

        resolve(new Pikaday(options));
      });
    });
  }), _defineProperty(_obj2, "_setPickerMinDate", function _setPickerMinDate(date) {
    var _this4 = this;

    if (date && !moment(date, this.dateFormat).isValid()) {
      date = null;
    }

    (0, _runloop.schedule)("afterRender", function () {
      _this4._picker.setMinDate(moment(date, _this4.dateFormat).toDate());
    });
  }), _defineProperty(_obj2, "_setPickerDate", function _setPickerDate(date) {
    var _this5 = this;

    if (date && !moment(date, this.dateFormat).isValid()) {
      date = null;
    }

    (0, _runloop.schedule)("afterRender", function () {
      _this5._picker.setDate(moment.utc(date), true);
    });
  }), _defineProperty(_obj2, "_closeModal", function _closeModal() {
    var composer = Discourse.__container__.lookup("controller:composer");
    composer.send("closeModal");
  }), _obj2), (_applyDecoratedDescriptor(_obj, "_renderPreview", [_dec], (_init = Object.getOwnPropertyDescriptor(_obj, "_renderPreview"), _init = _init ? _init.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, "isRange", [_dec2], Object.getOwnPropertyDescriptor(_obj, "isRange"), _obj), _applyDecoratedDescriptor(_obj, "isValid", [_dec3], Object.getOwnPropertyDescriptor(_obj, "isValid"), _obj), _applyDecoratedDescriptor(_obj, "fromConfig", [_dec4], Object.getOwnPropertyDescriptor(_obj, "fromConfig"), _obj), _applyDecoratedDescriptor(_obj, "toConfig", [_dec5], Object.getOwnPropertyDescriptor(_obj, "toConfig"), _obj), _applyDecoratedDescriptor(_obj, "options", [_dec6], Object.getOwnPropertyDescriptor(_obj, "options"), _obj), _applyDecoratedDescriptor(_obj, "computedConfig", [_dec7], Object.getOwnPropertyDescriptor(_obj, "computedConfig"), _obj), _applyDecoratedDescriptor(_obj, "currentUserTimezone", [_decorators.default], Object.getOwnPropertyDescriptor(_obj, "currentUserTimezone"), _obj), _applyDecoratedDescriptor(_obj, "allTimezones", [_decorators.default], Object.getOwnPropertyDescriptor(_obj, "allTimezones"), _obj), _applyDecoratedDescriptor(_obj, "formatedCurrentUserTimezone", [_dec8], Object.getOwnPropertyDescriptor(_obj, "formatedCurrentUserTimezone"), _obj), _applyDecoratedDescriptor(_obj, "previewedFormats", [_dec9], Object.getOwnPropertyDescriptor(_obj, "previewedFormats"), _obj), _applyDecoratedDescriptor(_obj, "recurringOptions", [_decorators.default], Object.getOwnPropertyDescriptor(_obj, "recurringOptions"), _obj), _applyDecoratedDescriptor(_obj, "toggleModeBtnLabel", [_dec10], Object.getOwnPropertyDescriptor(_obj, "toggleModeBtnLabel"), _obj), _applyDecoratedDescriptor(_obj, "markup", [_dec11], Object.getOwnPropertyDescriptor(_obj, "markup"), _obj), _applyDecoratedDescriptor(_obj, "formattedFrom", [_dec12], Object.getOwnPropertyDescriptor(_obj, "formattedFrom"), _obj), _applyDecoratedDescriptor(_obj, "formattedTo", [_dec13], Object.getOwnPropertyDescriptor(_obj, "formattedTo"), _obj)), _obj)));
});
Ember.TEMPLATES["javascripts/components/discourse-local-dates-create-form"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"previewedFormat\"],\"statements\":[[4,\"d-modal-body\",null,[[\"title\",\"class\",\"style\"],[\"discourse_local_dates.title\",\"discourse-local-dates-create-modal\",\"overflow: auto\"]],{\"statements\":[[0,\"\\n  \"],[7,\"div\",true],[10,\"class\",\"form\"],[8],[0,\"\\n\"],[4,\"unless\",[[24,[\"isValid\"]]],null,{\"statements\":[[0,\"      \"],[7,\"div\",true],[10,\"class\",\"validation-error alert alert-error\"],[8],[0,\"\\n        \"],[1,[28,\"i18n\",[\"discourse_local_dates.create.form.invalid_date\"],null],false],[0,\"\\n      \"],[9],[0,\"\\n\"]],\"parameters\":[]},{\"statements\":[[4,\"if\",[[24,[\"timezoneIsDifferentFromUserTimezone\"]]],null,{\"statements\":[[0,\"        \"],[7,\"div\",true],[10,\"class\",\"preview alert alert-info\"],[8],[0,\"\\n          \"],[7,\"b\",true],[8],[1,[22,\"formatedCurrentUserTimezone\"],false],[0,\" \"],[9],[1,[22,\"currentPreview\"],false],[0,\"\\n        \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]}],[0,\"\\n    \"],[1,[22,\"computeDate\"],false],[0,\"\\n\\n    \"],[7,\"div\",true],[10,\"class\",\"date-time-configuration\"],[8],[0,\"\\n      \"],[7,\"div\",true],[10,\"class\",\"inputs-panel\"],[8],[0,\"\\n        \"],[7,\"div\",true],[11,\"class\",[29,[\"date-time-control from \",[28,\"if\",[[24,[\"fromSelected\"]],\"is-selected\"],null],\" \",[28,\"if\",[[24,[\"fromFilled\"]],\"is-filled\"],null]]]],[8],[0,\"\\n          \"],[1,[28,\"d-icon\",[\"calendar-alt\"],null],false],[0,\"\\n          \"],[1,[28,\"d-button\",null,[[\"action\",\"translatedLabel\",\"class\"],[[28,\"action\",[[23,0,[]],\"focusFrom\"],null],[24,[\"formattedFrom\"]],\"date-time\"]]],false],[0,\"\\n        \"],[9],[0,\"\\n\\n        \"],[7,\"div\",true],[11,\"class\",[29,[\"date-time-control to \",[28,\"if\",[[24,[\"toSelected\"]],\"is-selected\"],null],\" \",[28,\"if\",[[24,[\"toFilled\"]],\"is-filled\"],null]]]],[8],[0,\"\\n          \"],[1,[28,\"d-icon\",[\"calendar-alt\"],null],false],[0,\"\\n          \"],[1,[28,\"d-button\",null,[[\"action\",\"translatedLabel\",\"class\"],[[28,\"action\",[[23,0,[]],\"focusTo\"],null],[24,[\"formattedTo\"]],\"date-time\"]]],false],[0,\"\\n\"],[4,\"if\",[[24,[\"toFilled\"]]],null,{\"statements\":[[0,\"            \"],[1,[28,\"d-button\",null,[[\"icon\",\"action\",\"class\"],[\"times\",[28,\"action\",[[23,0,[]],\"eraseToDateTime\"],null],\"delete-to-date\"]]],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"        \"],[9],[0,\"\\n\\n\"],[4,\"unless\",[[24,[\"site\",\"mobileView\"]]],null,{\"statements\":[[0,\"          \"],[1,[28,\"timezone-input\",null,[[\"options\",\"value\",\"onChange\"],[[28,\"hash\",null,[[\"icon\"],[\"globe\"]]],[24,[\"timezone\"]],[28,\"action\",[[23,0,[]],[28,\"mut\",[[24,[\"timezone\"]]],null]],null]]]],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"      \"],[9],[0,\"\\n\\n      \"],[7,\"div\",true],[10,\"class\",\"picker-panel\"],[8],[0,\"\\n        \"],[1,[28,\"input\",null,[[\"class\"],[\"fake-input\"]]],false],[0,\"\\n        \"],[7,\"div\",true],[10,\"class\",\"date-picker\"],[11,\"id\",[29,[\"picker-container-\",[22,\"elementId\"]]]],[8],[9],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"fromSelected\"]]],null,{\"statements\":[[0,\"          \"],[7,\"div\",true],[10,\"class\",\"time-pickers\"],[8],[0,\"\\n            \"],[1,[28,\"d-icon\",[\"far-clock\"],null],false],[0,\"\\n            \"],[1,[28,\"input\",null,[[\"maxlength\",\"placeholder\",\"input\",\"type\",\"value\",\"class\"],[5,\"hh:mm\",[28,\"action\",[[23,0,[]],\"setTime\"],null],\"time\",[28,\"unbound\",[[24,[\"time\"]]],null],\"time-picker\"]]],false],[0,\"\\n          \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[4,\"if\",[[24,[\"toSelected\"]]],null,{\"statements\":[[4,\"if\",[[24,[\"toDate\"]]],null,{\"statements\":[[0,\"          \"],[7,\"div\",true],[10,\"class\",\"time-pickers\"],[8],[0,\"\\n            \"],[1,[28,\"d-icon\",[\"far-clock\"],null],false],[0,\"\\n            \"],[1,[28,\"input\",null,[[\"maxlength\",\"placeholder\",\"input\",\"type\",\"value\",\"class\"],[5,\"hh:mm\",[28,\"action\",[[23,0,[]],\"setToTime\"],null],\"time\",[28,\"unbound\",[[24,[\"toTime\"]]],null],\"time-picker\"]]],false],[0,\"\\n          \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"parameters\":[]},null],[0,\"      \"],[9],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"site\",\"mobileView\"]]],null,{\"statements\":[[0,\"        \"],[1,[28,\"timezone-input\",null,[[\"value\",\"options\",\"onChange\"],[[24,[\"timezone\"]],[28,\"hash\",null,[[\"icon\"],[\"globe\"]]],[28,\"action\",[[23,0,[]],[28,\"mut\",[[24,[\"timezone\"]]],null]],null]]]],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"    \"],[9],[0,\"\\n\\n\"],[4,\"if\",[[24,[\"advancedMode\"]]],null,{\"statements\":[[0,\"      \"],[7,\"div\",true],[10,\"class\",\"advanced-options\"],[8],[0,\"\\n\"],[4,\"unless\",[[24,[\"isRange\"]]],null,{\"statements\":[[0,\"          \"],[7,\"div\",true],[10,\"class\",\"control-group recurrence\"],[8],[0,\"\\n            \"],[7,\"label\",true],[10,\"class\",\"control-label\"],[8],[0,\"\\n              \"],[1,[28,\"i18n\",[\"discourse_local_dates.create.form.recurring_title\"],null],false],[0,\"\\n            \"],[9],[0,\"\\n            \"],[7,\"p\",true],[8],[1,[28,\"i18n\",[\"discourse_local_dates.create.form.recurring_description\"],null],true],[9],[0,\"\\n            \"],[7,\"div\",true],[10,\"class\",\"controls\"],[8],[0,\"\\n              \"],[1,[28,\"combo-box\",null,[[\"content\",\"class\",\"value\",\"onChange\",\"none\"],[[24,[\"recurringOptions\"]],\"recurrence-input\",[24,[\"recurring\"]],[28,\"action\",[[23,0,[]],[28,\"mut\",[[24,[\"recurring\"]]],null]],null],\"discourse_local_dates.create.form.recurring_none\"]]],false],[0,\"\\n            \"],[9],[0,\"\\n          \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n        \"],[7,\"div\",true],[10,\"class\",\"control-group format\"],[8],[0,\"\\n          \"],[7,\"label\",true],[8],[1,[28,\"i18n\",[\"discourse_local_dates.create.form.format_title\"],null],false],[9],[0,\"\\n          \"],[7,\"p\",true],[8],[0,\"\\n            \"],[1,[28,\"i18n\",[\"discourse_local_dates.create.form.format_description\"],null],false],[0,\"\\n            \"],[7,\"a\",true],[10,\"target\",\"_blank\"],[10,\"rel\",\"noopener\"],[10,\"href\",\"https://momentjs.com/docs/#/parsing/string-format/\"],[8],[0,\"\\n              \"],[1,[28,\"d-icon\",[\"question-circle\"],null],false],[0,\"\\n            \"],[9],[0,\"\\n          \"],[9],[0,\"\\n          \"],[7,\"div\",true],[10,\"class\",\"controls\"],[8],[0,\"\\n            \"],[1,[28,\"text-field\",null,[[\"value\",\"class\"],[[24,[\"format\"]],\"format-input\"]]],false],[0,\"\\n          \"],[9],[0,\"\\n        \"],[9],[0,\"\\n        \"],[7,\"div\",true],[10,\"class\",\"control-group\"],[8],[0,\"\\n          \"],[7,\"ul\",true],[10,\"class\",\"formats\"],[8],[0,\"\\n\"],[4,\"each\",[[24,[\"previewedFormats\"]]],null,{\"statements\":[[0,\"              \"],[7,\"li\",true],[10,\"class\",\"format\"],[8],[0,\"\\n                \"],[7,\"a\",false],[12,\"class\",\"moment-format\"],[12,\"href\",\"\"],[3,\"action\",[[23,0,[]],[28,\"mut\",[[24,[\"format\"]]],null],[23,1,[\"format\"]]]],[8],[0,\"\\n                  \"],[1,[23,1,[\"format\"]],false],[0,\"\\n                \"],[9],[0,\"\\n                \"],[7,\"span\",true],[10,\"class\",\"previewed-format\"],[8],[0,\"\\n                  \"],[1,[23,1,[\"preview\"]],false],[0,\"\\n                \"],[9],[0,\"\\n              \"],[9],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"          \"],[9],[0,\"\\n        \"],[9],[0,\"\\n\\n        \"],[7,\"div\",true],[10,\"class\",\"control-group timezones\"],[8],[0,\"\\n          \"],[7,\"label\",true],[8],[1,[28,\"i18n\",[\"discourse_local_dates.create.form.timezones_title\"],null],false],[9],[0,\"\\n          \"],[7,\"p\",true],[8],[1,[28,\"i18n\",[\"discourse_local_dates.create.form.timezones_description\"],null],false],[9],[0,\"\\n          \"],[7,\"div\",true],[10,\"class\",\"controls\"],[8],[0,\"\\n            \"],[1,[28,\"multi-select\",null,[[\"valueProperty\",\"nameProperty\",\"class\",\"allowAny\",\"maximum\",\"content\",\"value\"],[null,null,\"timezones-input\",false,5,[24,[\"allTimezones\"]],[24,[\"timezones\"]]]]],false],[0,\"\\n          \"],[9],[0,\"\\n        \"],[9],[0,\"\\n      \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n\"],[7,\"div\",true],[10,\"class\",\"modal-footer discourse-local-dates-create-modal-footer\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"isValid\"]]],null,{\"statements\":[[0,\"    \"],[1,[28,\"d-button\",null,[[\"class\",\"action\",\"label\"],[\"btn-primary\",[28,\"action\",[[23,0,[]],\"save\"],null],\"discourse_local_dates.create.form.insert\"]]],false],[0,\"\\n\"]],\"parameters\":[]},null],[0,\"\\n  \"],[7,\"a\",false],[12,\"class\",\"cancel-action\"],[12,\"href\",\"\"],[3,\"action\",[[23,0,[]],\"cancel\"]],[8],[0,\"\\n    \"],[1,[28,\"i18n\",[\"cancel\"],null],false],[0,\"\\n  \"],[9],[0,\"\\n\\n  \"],[1,[28,\"d-button\",null,[[\"class\",\"action\",\"icon\",\"label\"],[\"btn-default advanced-mode-btn\",[28,\"action\",[[23,0,[]],\"advancedMode\"],null],\"cog\",[24,[\"toggleModeBtnLabel\"]]]]],false],[0,\"\\n\"],[9],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/components/discourse-local-dates-create-form"}});
Ember.TEMPLATES["javascripts/modal/discourse-local-dates-create-modal"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"discourse-local-dates-create-form\",null,[[\"config\",\"toolbarEvent\"],[[24,[\"config\"]],[24,[\"toolbarEvent\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/modal/discourse-local-dates-create-modal"}});
define("discourse/plugins/discourse-local-dates/lib/discourse-markdown/discourse-local-dates", ["exports", "pretty-text/engines/discourse-markdown/bbcode-block"], function (exports, _bbcodeBlock) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.setup = setup;


  function addLocalDate(buffer, matches, state) {
    var token = void 0;

    var config = {
      date: null,
      time: null,
      timezone: null,
      format: null,
      timezones: null,
      displayedTimezone: null,
      countdown: null
    };

    var matchString = matches[1].replace(/„|“/g, '"');

    var parsed = (0, _bbcodeBlock.parseBBCodeTag)("[date date" + matchString + "]", 0, matchString.length + 11);

    config.date = parsed.attrs.date;
    config.format = parsed.attrs.format;
    config.calendar = parsed.attrs.calendar;
    config.time = parsed.attrs.time;
    config.timezone = parsed.attrs.timezone;
    config.recurring = parsed.attrs.recurring;
    config.timezones = parsed.attrs.timezones;
    config.displayedTimezone = parsed.attrs.displayedTimezone;
    config.countdown = parsed.attrs.countdown;

    token = new state.Token("span_open", "span", 1);
    token.attrs = [["data-date", state.md.utils.escapeHtml(config.date)]];

    if (!config.date.match(/\d{4}-\d{2}-\d{2}/)) {
      closeBuffer(buffer, state, moment.invalid().format());
      return;
    }

    if (config.time && !config.time.match(/\d{2}:\d{2}(?::\d{2})?/)) {
      closeBuffer(buffer, state, moment.invalid().format());
      return;
    }

    var dateTime = config.date;
    if (config.time) {
      token.attrs.push(["data-time", state.md.utils.escapeHtml(config.time)]);
      dateTime = dateTime + " " + config.time;
    }

    if (!moment(dateTime).isValid()) {
      closeBuffer(buffer, state, moment.invalid().format());
      return;
    }

    token.attrs.push(["class", "discourse-local-date"]);

    if (config.format) {
      token.attrs.push(["data-format", state.md.utils.escapeHtml(config.format)]);
    }

    if (config.countdown) {
      token.attrs.push(["data-countdown", state.md.utils.escapeHtml(config.countdown)]);
    }

    if (config.calendar) {
      token.attrs.push(["data-calendar", state.md.utils.escapeHtml(config.calendar)]);
    }

    if (config.displayedTimezone && moment.tz.names().includes(config.displayedTimezone)) {
      token.attrs.push(["data-displayed-timezone", state.md.utils.escapeHtml(config.displayedTimezone)]);
    }

    if (config.timezones) {
      var timezones = config.timezones.split("|").filter(function (timezone) {
        return moment.tz.names().includes(timezone);
      });

      token.attrs.push(["data-timezones", state.md.utils.escapeHtml(timezones.join("|"))]);
    }

    if (config.timezone && moment.tz.names().includes(config.timezone)) {
      token.attrs.push(["data-timezone", state.md.utils.escapeHtml(config.timezone)]);
      dateTime = moment.tz(dateTime, config.timezone);
    } else {
      dateTime = moment.utc(dateTime);
    }

    if (config.recurring) {
      token.attrs.push(["data-recurring", state.md.utils.escapeHtml(config.recurring)]);
    }

    buffer.push(token);

    var formattedDateTime = dateTime.tz("Etc/UTC").format(state.md.options.discourse.datesEmailFormat || moment.defaultFormat);
    token.attrs.push(["data-email-preview", formattedDateTime + " UTC"]);

    closeBuffer(buffer, state, dateTime.utc().format(config.format));
  }

  function closeBuffer(buffer, state, text) {
    var token = void 0;

    token = new state.Token("text", "", 0);
    token.content = text;
    buffer.push(token);

    token = new state.Token("span_close", "span", -1);

    buffer.push(token);
  }

  function setup(helper) {
    helper.whiteList(["span.discourse-local-date", "span[data-*]", "span[aria-label]"]);

    helper.registerOptions(function (opts, siteSettings) {
      opts.datesEmailFormat = siteSettings.discourse_local_dates_email_format;

      opts.features["discourse-local-dates"] = !!siteSettings.discourse_local_dates_enabled;
    });

    helper.registerPlugin(function (md) {
      var rule = {
        matcher: /\[date(=.+?)\]/,
        onMatch: addLocalDate
      };

      md.core.textPostProcess.ruler.push("discourse-local-dates", rule);
    });
  }
});
define("discourse/plugins/discourse-local-dates/initializers/discourse-local-dates", ["exports", "discourse/lib/plugin-api", "discourse/lib/show-modal"], function (exports, _pluginApi, _showModal) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });


  function initializeDiscourseLocalDates(api) {
    api.decorateCooked(function ($elem) {
      $(".discourse-local-date", $elem).applyLocalDates();
    }, { id: "discourse-local-date" });

    api.onToolbarCreate(function (toolbar) {
      toolbar.addButton({
        title: "discourse_local_dates.title",
        id: "local-dates",
        group: "extras",
        icon: "calendar-alt",
        sendAction: function sendAction(event) {
          return toolbar.context.send("insertDiscourseLocalDate", event);
        }
      });
    });

    api.modifyClass("component:d-editor", {
      actions: {
        insertDiscourseLocalDate: function insertDiscourseLocalDate(toolbarEvent) {
          (0, _showModal.default)("discourse-local-dates-create-modal").setProperties({
            toolbarEvent: toolbarEvent
          });
        }
      }
    });
  }

  exports.default = {
    name: "discourse-local-dates",

    initialize: function initialize(container) {
      var siteSettings = container.lookup("site-settings:main");
      if (siteSettings.discourse_local_dates_enabled) {
        (0, _pluginApi.withPluginApi)("0.8.8", initializeDiscourseLocalDates);
      }
    }
  };
});


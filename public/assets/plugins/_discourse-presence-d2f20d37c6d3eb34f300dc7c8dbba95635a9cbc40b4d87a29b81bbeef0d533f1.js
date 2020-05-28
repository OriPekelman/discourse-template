define("discourse/plugins/discourse-presence/discourse/components/composer-presence-display", ["exports", "@ember/runloop", "@ember/component", "discourse/lib/ajax", "discourse-common/utils/decorators"], function (exports, _runloop, _component, _ajax, _decorators) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.bufferTime = exports.keepAliveDuration = undefined;

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

  var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _desc, _value, _obj;

  var keepAliveDuration = exports.keepAliveDuration = 10000;
  var bufferTime = exports.bufferTime = 3000;

  exports.default = _component.default.extend((_dec = (0, _decorators.on)("didInsertElement"), _dec2 = (0, _decorators.observes)("action", "post.id", "topic.id"), _dec3 = (0, _decorators.observes)("reply", "title"), _dec4 = (0, _decorators.on)("willDestroyElement"), _dec5 = (0, _decorators.observes)("currentState"), _dec6 = (0, _decorators.default)("presenceUsers", "currentUser.id"), (_obj = {
    // Passed in variables
    action: null,
    post: null,
    topic: null,
    reply: null,
    title: null,

    // Internal variables
    previousState: null,
    currentState: null,
    presenceUsers: null,
    channel: null,

    composerOpened: function composerOpened() {
      this._lastPublish = new Date();
      (0, _runloop.once)(this, "updateState");
    },
    composerStateChanged: function composerStateChanged() {
      (0, _runloop.once)(this, "updateState");
    },
    typing: function typing() {
      if (new Date() - this._lastPublish > keepAliveDuration) {
        this.publish({ current: this.currentState });
      }
    },
    composerClosing: function composerClosing() {
      this.publish({ previous: this.currentState });
      (0, _runloop.cancel)(this._pingTimer);
      (0, _runloop.cancel)(this._clearTimer);
    },
    updateState: function updateState() {
      var state = null;
      var action = this.action;

      if (action === "reply" || action === "edit") {
        state = { action: action };
        if (action === "reply") state.topic_id = this.get("topic.id");
        if (action === "edit") state.post_id = this.get("post.id");
      }

      this.set("previousState", this.currentState);
      this.set("currentState", state);
    },
    currentStateChanged: function currentStateChanged() {
      var _this = this;

      if (this.channel) {
        this.messageBus.unsubscribe(this.channel);
        this.set("channel", null);
      }

      this.clear();

      if (!["reply", "edit"].includes(this.action)) {
        return;
      }

      this.publish({
        response_needed: true,
        previous: this.previousState,
        current: this.currentState
      }).then(function (r) {
        if (_this.isDestroyed) {
          return;
        }
        _this.set("presenceUsers", r.users);
        _this.set("channel", r.messagebus_channel);

        if (!r.messagebus_channel) {
          return;
        }

        _this.messageBus.subscribe(r.messagebus_channel, function (message) {
          if (!_this.isDestroyed) _this.set("presenceUsers", message.users);
          _this._clearTimer = (0, _runloop.debounce)(_this, "clear", keepAliveDuration + bufferTime);
        }, r.messagebus_id);
      });
    },
    clear: function clear() {
      if (!this.isDestroyed) this.set("presenceUsers", []);
    },
    publish: function publish(data) {
      this._lastPublish = new Date();

      // Don't publish presence if disabled
      if (this.currentUser.hide_profile_and_presence) {
        return Ember.RSVP.Promise.resolve();
      }

      return (0, _ajax.ajax)("/presence/publish", { type: "POST", data: data });
    },
    users: function users(_users, currentUserId) {
      return (_users || []).filter(function (user) {
        return user.id !== currentUserId;
      });
    },


    isReply: Ember.computed.equal("action", "reply"),
    shouldDisplay: Ember.computed.gt("users.length", 0)
  }, (_applyDecoratedDescriptor(_obj, "composerOpened", [_dec], Object.getOwnPropertyDescriptor(_obj, "composerOpened"), _obj), _applyDecoratedDescriptor(_obj, "composerStateChanged", [_dec2], Object.getOwnPropertyDescriptor(_obj, "composerStateChanged"), _obj), _applyDecoratedDescriptor(_obj, "typing", [_dec3], Object.getOwnPropertyDescriptor(_obj, "typing"), _obj), _applyDecoratedDescriptor(_obj, "composerClosing", [_dec4], Object.getOwnPropertyDescriptor(_obj, "composerClosing"), _obj), _applyDecoratedDescriptor(_obj, "currentStateChanged", [_dec5], Object.getOwnPropertyDescriptor(_obj, "currentStateChanged"), _obj), _applyDecoratedDescriptor(_obj, "users", [_dec6], Object.getOwnPropertyDescriptor(_obj, "users"), _obj)), _obj)));
});
define("discourse/plugins/discourse-presence/discourse/components/topic-presence-display", ["exports", "@ember/runloop", "@ember/component", "discourse-common/utils/decorators", "discourse/plugins/discourse-presence/discourse/components/composer-presence-display"], function (exports, _runloop, _component, _decorators, _composerPresenceDisplay) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

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

  var _dec, _dec2, _dec3, _dec4, _desc, _value, _obj;

  var MB_GET_LAST_MESSAGE = -2;

  exports.default = _component.default.extend((_dec = (0, _decorators.on)("didInsertElement"), _dec2 = (0, _decorators.on)("willDestroyElement"), _dec3 = (0, _decorators.default)("topicId"), _dec4 = (0, _decorators.default)("presenceUsers", "currentUser.{id,ignored_users}"), (_obj = {
    topicId: null,
    presenceUsers: null,

    clear: function clear() {
      if (!this.isDestroyed) this.set("presenceUsers", []);
    },
    _inserted: function _inserted() {
      var _this = this;

      this.clear();

      this.messageBus.subscribe(this.channel, function (message) {
        if (!_this.isDestroyed) _this.set("presenceUsers", message.users);
        _this._clearTimer = (0, _runloop.debounce)(_this, "clear", _composerPresenceDisplay.keepAliveDuration + _composerPresenceDisplay.bufferTime);
      }, MB_GET_LAST_MESSAGE);
    },
    _destroyed: function _destroyed() {
      (0, _runloop.cancel)(this._clearTimer);
      this.messageBus.unsubscribe(this.channel);
    },
    channel: function channel(topicId) {
      return "/presence/topic/" + topicId;
    },
    users: function users(_users, currentUser) {
      var ignoredUsers = currentUser.ignored_users || [];
      return (_users || []).filter(function (user) {
        return user.id !== currentUser.id && !ignoredUsers.includes(user.username);
      });
    },


    shouldDisplay: Ember.computed.gt("users.length", 0)
  }, (_applyDecoratedDescriptor(_obj, "_inserted", [_dec], Object.getOwnPropertyDescriptor(_obj, "_inserted"), _obj), _applyDecoratedDescriptor(_obj, "_destroyed", [_dec2], Object.getOwnPropertyDescriptor(_obj, "_destroyed"), _obj), _applyDecoratedDescriptor(_obj, "channel", [_dec3], Object.getOwnPropertyDescriptor(_obj, "channel"), _obj), _applyDecoratedDescriptor(_obj, "users", [_dec4], Object.getOwnPropertyDescriptor(_obj, "users"), _obj)), _obj)));
});
Ember.TEMPLATES["javascripts/connectors/composer-fields/presence"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"composer-presence-display\",null,[[\"action\",\"post\",\"topic\",\"reply\",\"title\"],[[24,[\"model\",\"action\"]],[24,[\"model\",\"post\"]],[24,[\"model\",\"topic\"]],[24,[\"model\",\"reply\"]],[24,[\"model\",\"title\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/connectors/composer-fields/presence"}});
define("discourse/plugins/discourse-presence/discourse/templates/connectors/composer-fields/presence", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    shouldRender: function shouldRender(_, ctx) {
      return ctx.siteSettings.presence_enabled;
    }
  };
});
Ember.TEMPLATES["javascripts/connectors/topic-above-footer-buttons/presence"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[],\"statements\":[[1,[28,\"topic-presence-display\",null,[[\"topicId\"],[[24,[\"model\",\"id\"]]]]],false],[0,\"\\n\"]],\"hasEval\":false}","meta":{"moduleName":"javascripts/connectors/topic-above-footer-buttons/presence"}});
define("discourse/plugins/discourse-presence/discourse/templates/connectors/topic-above-footer-buttons/presence", ["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    shouldRender: function shouldRender(_, ctx) {
      return ctx.siteSettings.presence_enabled;
    }
  };
});
Ember.TEMPLATES["javascripts/components/topic-presence-display"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"user\"],\"statements\":[[4,\"if\",[[24,[\"shouldDisplay\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"presence-users\"],[8],[0,\"\\n    \"],[7,\"div\",true],[10,\"class\",\"presence-avatars\"],[8],[0,\"\\n\"],[4,\"each\",[[24,[\"users\"]]],null,{\"statements\":[[0,\"        \"],[1,[28,\"avatar\",[[23,1,[]]],[[\"avatarTemplatePath\",\"usernamePath\",\"imageSize\"],[\"avatar_template\",\"username\",\"small\"]]],false],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"    \"],[9],[0,\"\\n    \"],[7,\"span\",true],[10,\"class\",\"presence-text\"],[8],[0,\"\\n      \"],[7,\"span\",true],[10,\"class\",\"description\"],[8],[1,[28,\"i18n\",[\"presence.replying_to_topic\"],[[\"count\"],[[24,[\"users\",\"length\"]]]]],false],[9],[7,\"span\",true],[10,\"class\",\"wave\"],[8],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[9],[0,\"\\n    \"],[9],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/components/topic-presence-display"}});
Ember.TEMPLATES["javascripts/components/composer-presence-display"] = Ember.HTMLBars.template({"id":null,"block":"{\"symbols\":[\"user\"],\"statements\":[[4,\"if\",[[24,[\"shouldDisplay\"]]],null,{\"statements\":[[0,\"  \"],[7,\"div\",true],[10,\"class\",\"presence-users\"],[8],[0,\"\\n    \"],[7,\"div\",true],[10,\"class\",\"presence-avatars\"],[8],[0,\"\\n\"],[4,\"each\",[[24,[\"users\"]]],null,{\"statements\":[[0,\"        \"],[1,[28,\"avatar\",[[23,1,[]]],[[\"avatarTemplatePath\",\"usernamePath\",\"imageSize\"],[\"avatar_template\",\"username\",\"small\"]]],false],[0,\"\\n\"]],\"parameters\":[1]},null],[0,\"    \"],[9],[0,\"\\n    \"],[7,\"span\",true],[10,\"class\",\"presence-text\"],[8],[0,\"\\n      \"],[7,\"span\",true],[10,\"class\",\"description\"],[8],[0,\"\\n\"],[4,\"if\",[[24,[\"isReply\"]]],null,{\"statements\":[[1,[28,\"i18n\",[\"presence.replying\"],null],false]],\"parameters\":[]},{\"statements\":[[1,[28,\"i18n\",[\"presence.editing\"],null],false]],\"parameters\":[]}],[9],[9],[7,\"span\",true],[10,\"class\",\"wave\"],[8],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[7,\"span\",true],[10,\"class\",\"dot\"],[8],[0,\".\"],[9],[0,\"\\n    \"],[9],[0,\"\\n  \"],[9],[0,\"\\n\"]],\"parameters\":[]},null]],\"hasEval\":false}","meta":{"moduleName":"javascripts/components/composer-presence-display"}});


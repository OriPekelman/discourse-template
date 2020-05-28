define("discourse/plugins/discourse-narrative-bot/initializers/new-user-narrative", ["exports", "discourse/lib/plugin-api"], function (exports, _pluginApi) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });


  function _initialize(api) {
    var messageBus = api.container.lookup("message-bus:main");
    var currentUser = api.getCurrentUser();
    var appEvents = api.container.lookup("service:app-events");

    api.modifyClass("component:site-header", {
      didInsertElement: function didInsertElement() {
        this._super.apply(this, arguments);
        this.dispatch("header:search-context-trigger", "header");
      }
    });

    api.attachWidgetAction("header", "headerSearchContextTrigger", function () {
      if (this.site.mobileView) {
        this.state.skipSearchContext = false;
      } else {
        this.state.contextEnabled = true;
        this.state.searchContextType = "topic";
      }
    });

    if (messageBus && currentUser) {
      messageBus.subscribe("/new_user_narrative/tutorial_search", function () {
        appEvents.trigger("header:search-context-trigger");
      });
    }
  }

  exports.default = {
    name: "new-user-narratve",

    initialize: function initialize(container) {
      var siteSettings = container.lookup("site-settings:main");
      if (siteSettings.discourse_narrative_bot_enabled) (0, _pluginApi.withPluginApi)("0.8.7", _initialize);
    }
  };
});


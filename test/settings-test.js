/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var buster = require("buster");
var assert = buster.assertions.assert;
var refute = buster.assertions.refute;
var fs     = require("fs");
var http   = require("http");
var https  = require("https");
var path   = require("path");
var sinon  = require("../node_modules/buster/node_modules/sinon");

var registry = require("../lib/registry");
var settings = require("../lib/settings");

// ==== Test Case

buster.testCase("settings-test - init", {
  "should set defaults to, well, defaults": function () {
    this.stub(registry, "getMeta").returns({});
    var app = {
      set : this.stub()
    };

    settings.init(app);

    assert.calledWith(app.set, "defaults", settings.defaults);
  },

  "should get registry meta": function () {
    this.stub(registry, "getMeta").returns({});
    var app = {
      set : this.stub()
    };

    settings.init(app);

    assert.calledOnce(registry.getMeta);
  },

  "should set variables to defaults if empty settings": function () {
    this.stub(registry, "getMeta").returns({});
    var app = {
      set : this.stub()
    };

    settings.init(app);

    assert.calledWith(app.set, "forwarder", {
      registry    : settings.defaults.forwarder.registry,
      proxy       : settings.defaults.forwarder.proxy,
      autoForward : settings.defaults.forwarder.autoForward,
      userAgent   : settings.defaults.forwarder.userAgent
    });
    assert.calledWith(app.set, "hostname", settings.defaults.hostname);
    assert.calledWith(app.set, "port", settings.defaults.port);
  },

  "should set autoForward to default if null": function () {
    this.stub(registry, "getMeta").returns({
      forwarder : {
        autoForward : null
      }
    });
    var app = {
      set : this.stub()
    };

    settings.init(app);

    assert.calledWith(app.set, "forwarder", sinon.match({
      autoForward : settings.defaults.forwarder.autoForward
    }));
  }
});

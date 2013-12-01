/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var buster = require("buster");
var assert = buster.referee.assert;
var refute = buster.referee.refute;
var fs     = require("fs");
var path   = require("path");

var findCall = require("./helpers").findCall;

// ==== Test Case

buster.testCase("server-test - GET /", {
  setUp: function () {
    var registry = require("../lib/registry");
    this.stub(registry, "init");
    this.stub(registry, "refreshMeta");
    this.stub(registry, "getMeta").returns({});
    var settings = require("../lib/settings");
    this.stub(settings, "init");
    this.stub(settings, "render").returns(this.stub());
    this.stub(settings, "save").returns(this.stub());
    this.server = require("../lib/server");
    this.stub(this.server, "get");
    this.server.get.withArgs("registry").returns({
      getMeta : this.stub().returns({}),
      query   : this.stub()
    });
    this.res = {
      render : this.stub()
    };

    this.call = findCall(this.server.routes.get, "/");
  },

  "should have route": function () {
    assert.equals(this.call.path, "/");
  },

  "should render index": function () {
    this.call.callbacks[0]({
      query : {}
    }, this.res);

    assert.called(this.res.render);
    assert.calledWith(this.res.render, "index");
  },

  "should render query results": function () {
    this.stub(fs, "readdirSync").returns([]);

    this.call.callbacks[0]({
      query : { q: "bla" }
    }, this.res);

    assert.called(this.res.render);
    assert.calledWith(this.res.render, "results");
  }
});

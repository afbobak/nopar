/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var buster = require("buster");
var assert = buster.assertions.assert;
var refute = buster.assertions.refute;
var fs     = require("fs");
var path   = require("path");

var registry = require("../lib/registry");

var findCall = require("./helpers").findCall;

// ==== Test Case

buster.testCase("server-test - GET /", {
  setUp: function () {
    this.stub(fs, "existsSync").returns(true);
    this.stub(fs, "mkdirSync");
    this.stub(fs, "readFileSync");
    fs.readFileSync.returns(JSON.stringify({}));
    fs.readFileSync.withArgs("/path/registry.json").returns(JSON.stringify({
      version : "1.0.0",
      count   : 1,
      local   : 1,
      proxied : 0
    }));
    this.stub(registry, "refreshMeta");
    this.server = require("../lib/server");
    this.server.set("registry", registry);
    registry.init("/path");
    this.server.set("forwarder", {});
    this.call = findCall(this.server.routes.get, "/");
    this.res = {
      render : this.stub()
    };
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

/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var buster = require("buster");
var assert = buster.assertions.assert;
var refute = buster.assertions.refute;
var fs     = require("fs");
var path   = require("path");

// ==== Test Case

buster.testCase("server-test - GET /", {
  setUp: function () {
    this.stub(fs, "mkdirSync");
    this.server = require("../lib/server");
    this.server.set("registry", {});
    this.server.set("forwarder", {});
    this.call = this.server.routes.get[0];
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
    this.call.callbacks[0]({
      query : { q: "bla" }
    }, this.res);

    assert.called(this.res.render);
    assert.calledWith(this.res.render, "results");
  }
});

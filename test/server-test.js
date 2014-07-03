/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var assert = require("chai").assert;
var fs     = require("fs");
var path   = require("path");
var sinon  = require("sinon");

var helpers    = require("./helpers");
var findRoute  = helpers.findRoute;
var findHandle = helpers.findHandle;

// ==== Test Case

describe("server-test - GET /", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    var registry = require("../lib/registry");
    sandbox.stub(registry, "init");
    sandbox.stub(registry, "refreshMeta");
    sandbox.stub(registry, "getMeta").returns({});
    var settings = require("../lib/settings");
    sandbox.stub(settings, "init");
    sandbox.stub(settings, "render").returns(sandbox.stub());
    sandbox.stub(settings, "save").returns(sandbox.stub());
    this.server = require("../lib/server");
    sandbox.stub(this.server, "get");
    this.server.get.withArgs("registry").returns({
      getMeta : sandbox.stub().returns({}),
      query   : sandbox.stub()
    });
    this.res = {
      render : sandbox.stub()
    };

    this.route = findRoute(this.server, "/");
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have route", function () {
    assert.equal(this.route.path, "/");
  });

  it("should render index", function () {
    var get = findHandle(this.route, "get");
    get({
      query : {}
    }, this.res);

    sinon.assert.called(this.res.render);
    sinon.assert.calledWith(this.res.render, "index");
  });

  it("should render query results", function () {
    sandbox.stub(fs, "readdirSync").returns([]);
    var get = findHandle(this.route, "get");

    get({
      query : { q: "bla" }
    }, this.res);

    sinon.assert.called(this.res.render);
    sinon.assert.calledWith(this.res.render, "results");
  });
});

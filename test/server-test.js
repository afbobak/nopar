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

describe("server-test routes", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    var registry = require("../lib/registry");
    sandbox.stub(registry, "init");
    sandbox.stub(registry, "refreshMeta");
    sandbox.stub(registry, "getMeta").returns({});

    this.settings = require("../lib/settings");
    sandbox.stub(this.settings, "init");
    this.settingsRender = sandbox.stub();
    sandbox.stub(this.settings, "render").returns(this.settingsRender);
    this.settingsSave = sandbox.stub();
    sandbox.stub(this.settings, "save").returns(this.settingsSave);

    this.server = require("../lib/server");
    sandbox.stub(this.server, "get");
    this.server.get.withArgs("registry").returns({
      getMeta : sandbox.stub().returns({}),
      query   : sandbox.stub()
    });

    this.res = {
      render : sandbox.stub()
    };
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe("index", function () {
    beforeEach(function () {
      this.route = findRoute(this.server, "/");
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

  describe("settings", function () {
    beforeEach(function () {
      this.route = findRoute(this.server, "/-/settings");
    });

    it("should have route", function () {
      assert.equal(this.route.path, "/-/settings");
    });

    it("should have GET handle", function () {
      var handle = findHandle(this.route, "get");
      assert.isFunction(handle);
    });

    it("should have POST handle", function () {
      var handle = findHandle(this.route, "post");
      assert.isFunction(handle);
    });
  });

  describe("user", function () {
    beforeEach(function () {
      this.route = findRoute(this.server, "/-/user/:couchuser");
    });

    it("should have route", function () {
      assert.equal(this.route.path, "/-/user/:couchuser");
    });

    it("should have PUT handle", function () {
      var handle = findHandle(this.route, "put");
      assert.isFunction(handle);
    });
  });

  describe("session", function () {
    beforeEach(function () {
      this.route = findRoute(this.server, "/_session");
    });

    it("should have route", function () {
      assert.equal(this.route.path, "/_session");
    });

    it("should have POST handle", function () {
      var handle = findHandle(this.route, "post");
      assert.isFunction(handle);
    });
  });

  describe("package", function () {
    describe("versioned getter", function () {
      beforeEach(function () {
        this.route = findRoute(this.server, "/:packagename/:version?");
      });

      it("should have route", function () {
        assert.equal(this.route.path, "/:packagename/:version?");
      });

      it("should have GET handle", function () {
        var handle = findHandle(this.route, "get");
        assert.isFunction(handle);
      });
    });

    describe("publish full", function () {
      beforeEach(function () {
        this.route = findRoute(this.server, "/:packagename");
      });

      it("should have route", function () {
        assert.equal(this.route.path, "/:packagename");
      });

      it("should have PUT handle", function () {
        var handle = findHandle(this.route, "put");
        assert.isFunction(handle);
      });
    });

    describe("publish revision", function () {
      beforeEach(function () {
        this.route = findRoute(this.server, "/:packagename/-rev/:revision");
      });

      it("should have route", function () {
        assert.equal(this.route.path, "/:packagename/-rev/:revision");
      });

      it("should have PUT handle", function () {
        var handle = findHandle(this.route, "put");
        assert.isFunction(handle);
      });
    });

    describe("publish tag", function () {
      beforeEach(function () {
        this.route = findRoute(this.server, "/:packagename/:tagname");
      });

      it("should have route", function () {
        assert.equal(this.route.path, "/:packagename/:tagname");
      });

      it("should have PUT handle", function () {
        var handle = findHandle(this.route, "put");
        assert.isFunction(handle);
      });
    });

    describe("publish version with optional tag", function () {
      beforeEach(function () {
        this.route = findRoute(this.server, "/:packagename/:version/-tag?/:tagname?");
      });

      it("should have route", function () {
        assert.equal(this.route.path, "/:packagename/:version/-tag?/:tagname?");
      });

      it("should have PUT handle", function () {
        var handle = findHandle(this.route, "put");
        assert.isFunction(handle);
      });
    });

    describe("delete", function () {
      beforeEach(function () {
        this.route = findRoute(this.server, "/:packagename/-rev?/:revision?");
      });

      it("should have route", function () {
        assert.equal(this.route.path, "/:packagename/-rev?/:revision?");
      });

      it("should have PUT handle", function () {
        var handle = findHandle(this.route, "delete");
        assert.isFunction(handle);
      });
    });
  });

  describe("attachement", function () {
    beforeEach(function () {
      this.route = findRoute(this.server, "/:packagename/-/:attachment/-rev?/:revision?");
    });

    it("should have route", function () {
      assert.equal(this.route.path, "/:packagename/-/:attachment/-rev?/:revision?");
    });

    it("should have GET handle", function () {
      var handle = findHandle(this.route, "get");
      assert.isFunction(handle);
    });

    it("should have PUT handle", function () {
      var handle = findHandle(this.route, "put");
      assert.isFunction(handle);
    });

    it("should have DELETE handle", function () {
      var handle = findHandle(this.route, "delete");
      assert.isFunction(handle);
    });
  });

});

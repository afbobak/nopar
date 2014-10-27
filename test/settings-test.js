/*jslint devel: true, node: true */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var assert  = require("chai").assert;
var path    = require("path");
var request = require("supertest");
var sinon   = require("sinon");
var winston = require("winston");

var attachment = require("../lib/attachment");
var registry   = require("../lib/registry");
var server     = require("../lib/server");
var settings   = require("../lib/settings");

// Ignore logging
winston.clear();

// ==== Test Case

describe("settings-test - init", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(registry, 'getMeta');
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should get registry meta", function () {
    registry.getMeta.returns({});

    settings.init(registry);

    sinon.assert.calledOnce(registry.getMeta);
  });

  it("should set defaults and settings to defaults for empty meta", function () {
    registry.getMeta.returns({settings: {}});

    var s = settings.init(registry);

    var defaults = settings.defaults;
    assert.deepEqual(s.defaults, {
      "forwarder.autoForward" : defaults["forwarder.autoForward"],
      "forwarder.ignoreCert"  : defaults["forwarder.ignoreCert"],
      "forwarder.registry"    : defaults["forwarder.registry"],
      "forwarder.userAgent"   : defaults["forwarder.userAgent"],
      hostname                : defaults.hostname,
      baseUrl                 : defaults.baseUrl,
      limit                   : defaults.limit,
      logfile                 : defaults.logfile,
      loglevel                : defaults.loglevel,
      port                    : defaults.port,
      registryPath            : defaults.registryPath,
      metaTTL                 : defaults.metaTTL
    });
    assert.equal(s.data["forwarder.registry"], defaults["forwarder.registry"]);
    assert.equal(s.data["forwarder.proxy"], defaults["forwarder.proxy"]);
    assert.equal(s.data["forwarder.autoForward"], defaults["forwarder.autoForward"]);
    assert.equal(s.data["forwarder.ignoreCert"], defaults["forwarder.ignoreCert"]);
    assert.equal(s.data["forwarder.userAgent"], defaults["forwarder.userAgent"]);
    assert.equal(s.data.hostname, defaults.hostname);
    assert.equal(s.data.port, defaults.port);
    assert.equal(s.data.baseUrl, defaults.baseUrl);
    assert.equal(s.data.metaTTL, defaults.metaTTL);
  });

  it("should set autoForward to default if null", function () {
    registry.getMeta.returns({settings: {"forwarder.autoForward" : null}});

    var s = settings.init(registry);

    var defaults = settings.defaults;
    assert.equal(s.data["forwarder.autoForward"], defaults["forwarder.autoForward"]);
  });

  it("should set ignoreCert to default if null", function () {
    registry.getMeta.returns({settings: {
      "forwarder.ignoreCert" : null
    }});

    var s = settings.init(registry);

    var defaults = settings.defaults;
    assert.equal(s.data["forwarder.ignoreCert"], defaults["forwarder.ignoreCert"]);
  });
});

// ==== Test Case

describe("settings-test - get/set", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(registry, "getMeta");
    sandbox.stub(registry, "writeMeta");
    sandbox.stub(registry, "refreshMeta");
    sandbox.stub(registry, "iteratePackages");
    sandbox.stub(registry, "setPackage");

    registry.getMeta.returns({
      settings : { "foo" : "bar" }
    });
    this.settings = settings.init(registry);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should get undefined value", function () {
    assert.equal(this.settings.get("test"), undefined);
  });

  it("should get bar value", function () {
    assert.equal("bar", this.settings.get("foo"));
  });

  it("should get all settings", function () {
    assert.deepEqual({"foo" : "bar"}, this.settings.get());
  });

  it("should set foo value to gna", function () {
    this.settings.set("foo", "gna");

    assert.equal("gna", this.settings.get("foo"));
  });

  it("should set foo value to number", function () {
    this.settings.set("foo", 1234);

    assert.equal(1234, this.settings.get("foo"));
  });
});

// ==== Test Case

describe("settings-test - render", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    this.settings = {
      get      : sandbox.stub(),
      defaults : {
        hostname : "some.host"
      }
    };
    this.req = { settingsStore : this.settings };
    this.renderFn = settings.render();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should render 'settings'", function () {
    var spy = sandbox.spy();

    this.renderFn(this.req, {render: spy});

    sinon.assert.calledOnce(spy);
  });

  it("should use settings data", function () {
    this.settings.get.returns("");
    this.settings.get.withArgs("hostname").returns("localhost");
    var spy = sandbox.spy();

    this.renderFn(this.req, {render: spy});

    sinon.assert.calledWith(spy, "settings", sinon.match({
      settings : {
        hostname : "localhost"
      }
    }));
  });

  it("should nullify settings with default values", function () {
    this.settings.get.returns("");
    this.settings.get.withArgs("hostname").returns("some.host");
    var spy = sandbox.spy();

    this.renderFn(this.req, {render: spy});

    sinon.assert.calledWith(spy, "settings", sinon.match({
      settings : {
        hostname : null
      }
    }));
  });
});

// ==== Test Case

describe("settings-test - save", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(registry, "getMeta");
    sandbox.stub(registry, "writeMeta");
    sandbox.stub(registry, "refreshMeta");
    sandbox.stub(registry, "iteratePackages");
    sandbox.stub(registry, "setPackage");

    registry.getMeta.returns({});
    this.settings = {
      get      : sandbox.stub(),
      set      : sandbox.stub(),
      defaults : {
        hostname : "some.host"
      }
    };
    this.saveFn = settings.save(registry);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should render 'settings'", function () {
    var spy = sandbox.spy();

    this.saveFn({
      settingsStore : this.settings,
      body : {
      }
    }, {render: spy});

    sinon.assert.calledOnce(spy);
  });

  it("should set new settings", function () {
    sandbox.stub(attachment, "refreshMeta");

    this.saveFn({
      settingsStore : this.settings,
      body : {
        hostname     : "localhost",
        port         : "3333",
        registry    : "http://some.registry/",
        proxy       : "",
        autoForward : null,
        ignoreCert  : true,
        userAgent   : "bla"
      }
    }, {render: sandbox.spy()});

    sinon.assert.called(this.settings.set);
    sinon.assert.calledWith(this.settings.set, "hostname", "localhost");
    sinon.assert.calledWith(this.settings.set, "port", 3333);
    sinon.assert.calledWith(this.settings.set, "forwarder.registry",
      "http://some.registry/");
    sinon.assert.calledWith(this.settings.set, "forwarder.proxy", undefined);
    sinon.assert.calledWith(this.settings.set, "forwarder.autoForward", false);
    sinon.assert.calledWith(this.settings.set, "forwarder.ignoreCert", true);
    sinon.assert.calledWith(this.settings.set, "forwarder.userAgent", "bla");
  });

  it("should NOT refresh attachment meta if same hostname/port", function () {
    this.settings.get.withArgs("hostname").returns("localhost");
    this.settings.get.withArgs("port").returns(3333);

    this.saveFn({
      settingsStore : this.settings,
      body : {
        hostname     : "localhost",
        port         : "3333"
      }
    }, {render: sandbox.spy()});

    sinon.assert.notCalled(registry.iteratePackages);
  });

  it("should write new meta", function () {
    this.saveFn({
      settingsStore : this.settings,
      body : {
        hostname : "localhost"
      }
    }, { render: sandbox.spy() });

    sinon.assert.calledOnce(registry.writeMeta);
  });
});

// ==== Test Case

describe("settings-test - middleware", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(registry, "getMeta");
    sandbox.stub(registry, "writeMeta");
    sandbox.stub(registry, "refreshMeta");
    sandbox.stub(registry, "iteratePackages");
    sandbox.stub(registry, "setPackage");

    registry.getMeta.returns({});
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('has function', function() {
    assert.isFunction(settings.middleware);
  });

  it('requires registry', function() {
    assert.throws(settings.middleware, Error);
  });

  it('returns middleware function', function() {
    assert.isFunction(settings.middleware(registry));
  });

  it('initializes settings and refreshes registry', function() {
    sandbox.stub(settings, 'init');

    settings.middleware(registry);

    sinon.assert.calledOnce(settings.init);
    sinon.assert.calledWith(settings.init, registry);

    sinon.assert.calledOnce(registry.refreshMeta);
  });

  it('injects settingsStore into request and calls next', function() {
    var fn   = settings.middleware(registry);
    var req  = {};
    var next = sinon.stub();

    fn(req, {}, next);

    assert.isObject(req.settingsStore);
    sinon.assert.calledOnce(next);
  });
});

// ==== Test Case

describe('settings gui', function () {
  var sandbox, app;
  var registryPath = path.join(__dirname, 'registry');

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(registry, 'refreshMeta');
    sandbox.stub(registry, 'writeMeta');
    sandbox.stub(registry, 'getMeta').returns({
      settings : { registryPath : registryPath }
    });

    app = server.createApp({
      registryPath : registryPath,
      loglevel     : 'silent'
    });
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('routes /settings', function () {
    var route = {
      get  : sinon.stub(),
      post : sinon.stub()
    };
    route.get.returns(route);
    sandbox.stub(app, 'route').returns(route);
    sandbox.stub(settings, 'render').returns('render');
    sandbox.stub(settings, 'save').returns('save');

    settings.route(app);

    sinon.assert.calledWith(app.route, '/settings');
    sinon.assert.calledOnce(route.get);
    sinon.assert.calledWith(route.get, 'render');
    sinon.assert.calledOnce(route.post);
    sinon.assert.calledWith(route.post, sinon.match.func, 'save');
  });

  it('renders with title', function (done) {
    settings.route(app);

    request(app)
      .get('/settings')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, /<h3>Settings<\/h3>/, done);
  });

  it('saves settings', function (done) {
    settings.route(app);

    request(app)
      .post('/settings')
      .type('form')
      .send({
        hostname : settings.defaults.hostname,
        port     : settings.defaults.port,
        registry : 'http://npm.private:5984/'
      })
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, /Saved settings/, function (err) {
        if (err) {
          return done(err);
        }
        sinon.assert.calledOnce(registry.writeMeta);
        done();
      });
  });
});

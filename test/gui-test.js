/*jslint devel: true, node: true */
/*! Copyright (C) 2014 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var fs      = require("fs");
var https   = require("https");
var path    = require("path");
var request = require("supertest");
var sinon   = require("sinon");

var gui      = require('../lib/gui');
var registry = require('../lib/registry');
var server   = require('../lib/server');

var brand = /<a class="navbar-brand" href="\/">NOPAR \/<small>.*<\/small><\/a>/;
var pkgProxied = require('./registry/proxied/proxied.json');
var pkgProxiedHeader = /proxied<small class="text-muted">@2.0.0<\/small>/;

// ==== Test Case

describe('gui', function () {
  var sandbox, app, pkgMeta;
  var registryPath = path.join(__dirname, 'registry');

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    pkgMeta = JSON.parse(JSON.stringify(pkgProxied));
    pkgMeta['_mtime'] = new Date();

    sandbox.stub(registry, 'refreshMeta');
    sandbox.stub(registry, 'writeMeta');
    sandbox.stub(registry, 'getMeta').returns({
      count   : 123,
      local   : 23,
      proxied : 100,
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

  describe('routes public files from', function () {
    it('/', function () {
      sandbox.stub(app, 'use');

      gui.route(app);

      sinon.assert.calledWith(app.use, '/');
    });

    it('/css', function () {
      sandbox.stub(app, 'use');

      gui.route(app);

      sinon.assert.calledWith(app.use, '/css');
    });

    describe("serves", function () {
      beforeEach(function() {
        gui.route(app);
      });

      it('css', function (done) {
        request(app)
          .get('/css/main.css')
          .expect(200, /^body {.*/, done);
      });

      it('javascript', function (done) {
        request(app)
          .get('/js/bootstrap.js')
          .expect('Content-Type', 'application/javascript')
          .expect(200, /Bootstrap/, done);
      });

      it('images', function (done) {
        request(app)
          .get('/img/glyphicons-halflings.png')
          .expect('Content-Type', 'image/png')
          .expect(200, done);
      });

      it('fonts', function (done) {
        request(app)
          .get('/fonts/glyphicons-halflings-regular.woff')
          .expect('Content-Type', 'application/font-woff')
          .expect(200, done);
      });
    });
  });

  describe('index page', function () {
    it('routes GET /', function () {
      sandbox.stub(app, 'get');

      gui.routeIndex(app);

      sinon.assert.calledWith(app.get, '/');
    });

    it('renders with navbar', function (done) {
      gui.routeIndex(app);

      request(app)
        .get('/')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, brand, done);
    });
  });

  describe('packages pages', function () {
    it('routes /packages/:filter?', function () {
      sandbox.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get, '/packages/:filter?');
    });

    it('defaults to all packages', function (done) {
      sandbox.stub(fs, 'readdirSync').returns([]);

      gui.route(app);

      request(app)
        .get('/packages')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, /Found 0 package out of 123 packages/, done);
    });

    it('renders list of local packages', function (done) {
      sandbox.stub(fs, 'readdirSync').returns([]);

      gui.route(app);

      request(app)
        .get('/packages/local')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, /Found 0 package out of 23 local packages/, done);
    });

    it('renders list of proxied packages', function (done) {
      sandbox.stub(fs, 'readdirSync').returns([]);

      gui.route(app);

      request(app)
        .get('/packages/proxied')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, /Found 0 package out of 100 proxied packages/, done);
    });
  });

  describe('package pages', function () {
    it('routes /package/:name', function () {
      sandbox.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get, '/package/:scope(@[^\/]+)?/:name');
    });

    it('renders proxied package', function (done) {
      sandbox.stub(registry, 'getDependents').returns(null);

      gui.route(app);

      request(app)
        .get('/package/proxied')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, pkgProxiedHeader, done);
    });

    it('routes /package/:name/refresh', function () {
      sandbox.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get, '/package/:scope(@[^\/]+)?/:name/refresh');
    });

    it('refreshes proxied package', function (done) {
      sandbox.stub(registry, 'setPackage');
      sandbox.stub(registry, 'getDependents').returns(null);
      var res = {
        statusCode  : 200,
        setEncoding : sinon.stub(),
        on          : sinon.stub()
      };
      sandbox.stub(https, 'get').yields(res);
      https.get.returns({ on : sinon.stub() });
      res.on.withArgs('data').yields(JSON.stringify(pkgMeta));
      res.on.withArgs('end').yields();

      gui.route(app);

      request(app)
        .get('/package/proxied/refresh')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, /Package <strong>proxied<\/strong> successfully refreshed./,
          done);
    });

    it('routes /package/:name/dist-tags', function () {
      sandbox.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get,
        '/package/:scope(@[^\/]+)?/:name/dist-tags');
    });

    it('routes /package/:name/delete', function () {
      sandbox.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get, '/package/:scope(@[^\/]+)?/:name/delete');
    });

    it('deletes package', function (done) {
      sandbox.stub(registry, 'removePackage');
      sandbox.stub(fs, 'rmdirSync');
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'unlinkSync');

      gui.route(app);

      request(app)
        .get('/package/proxied/delete')
        .expect('Content-Type', 'text/plain; charset=utf-8')
        .expect(302, /Moved Temporarily\. Redirecting to \//, done);
    });
  });
});

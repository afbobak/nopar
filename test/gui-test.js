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
var pkgProxiedHeader = /proxied<small><span>@<\/span><span>2\.0\.0<\/span><\/small>/;

// ==== Test Case

describe('gui', function () {
  var app, pkgMeta;
  var registryPath = path.join(__dirname, 'registry');

  beforeEach(function () {
    pkgMeta = JSON.parse(JSON.stringify(pkgProxied));
    pkgMeta['_mtime'] = new Date();

    sinon.stub(registry, 'refreshMeta');
    sinon.stub(registry, 'writeMeta');
    sinon.stub(registry, 'getMeta').returns({
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
    sinon.restore();
  });

  describe('routes public files from', function () {
    it('/', function () {
      sinon.stub(app, 'use');

      gui.route(app);

      sinon.assert.calledWith(app.use, '/');
    });

    it('/css', function () {
      sinon.stub(app, 'use');

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
          .expect('Content-Type', 'application/javascript; charset=UTF-8')
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
          .expect('Content-Type', 'font/woff')
          .expect(200, done);
      });
    });
  });

  describe('index page', function () {
    it('routes GET /', function () {
      sinon.stub(app, 'get');

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
      sinon.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get, '/packages/:filter?');
    });

    it('defaults to all packages', function (done) {
      sinon.stub(fs, 'readdirSync').returns([]);

      gui.route(app);

      request(app)
        .get('/packages')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, /Found 0 package out of 123 packages/, done);
    });

    it('renders list of local packages', function (done) {
      sinon.stub(fs, 'readdirSync').returns([]);

      gui.route(app);

      request(app)
        .get('/packages/local')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, /Found 0 package out of 23 local packages/, done);
    });

    it('renders list of proxied packages', function (done) {
      sinon.stub(fs, 'readdirSync').returns([]);

      gui.route(app);

      request(app)
        .get('/packages/proxied')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, /Found 0 package out of 100 proxied packages/, done);
    });
  });

  describe('package pages', function () {
    it('routes /package/:name', function () {
      sinon.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get, '/package/:scope(@[^\/]+)?/:name');
    });

    it('renders proxied package', function (done) {
      sinon.stub(registry, 'getDependents').returns(null);

      gui.route(app);

      request(app)
        .get('/package/proxied')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, pkgProxiedHeader, done);
    });

    it('routes /package/:name/refresh', function () {
      sinon.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get, '/package/:scope(@[^\/]+)?/:name/refresh');
    });

    it('refreshes proxied package', function (done) {
      sinon.stub(registry, 'setPackage');
      sinon.stub(registry, 'getDependents').returns(null);
      var res = {
        statusCode  : 200,
        setEncoding : sinon.stub(),
        on          : sinon.stub()
      };
      sinon.stub(https, 'get').yields(res);
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
      sinon.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get,
        '/package/:scope(@[^\/]+)?/:name/dist-tags');
    });

    it('routes /package/:name/delete', function () {
      sinon.stub(app, 'get');

      gui.route(app);

      sinon.assert.calledWith(app.get, '/package/:scope(@[^\/]+)?/:name/delete');
    });

    it('deletes package', function (done) {
      sinon.stub(registry, 'removePackage');
      sinon.stub(fs, 'rmdirSync');
      sinon.stub(fs, 'existsSync').returns(true);
      sinon.stub(fs, 'unlinkSync');

      gui.route(app);

      request(app)
        .get('/package/proxied/delete')
        .expect('Content-Type', 'text/plain; charset=utf-8')
        .expect(302, /.* Redirecting to \//, done);
    });
  });
});

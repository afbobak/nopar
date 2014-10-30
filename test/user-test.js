/*jslint devel: true, node: true */
/*! Copyright (C) 2014 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var path    = require("path");
var request = require("supertest");
var sinon   = require("sinon");

var registry = require("../lib/registry");
var server   = require('../lib/server');
var user     = require("../lib/user");

describe('user', function () {
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

  describe('#update', function () {
    it('routes /-/user/:couchuser', function () {
      sandbox.stub(app, 'put');

      user.route(app);

      sinon.assert.calledWith(app.put, '/-/user/:couchuser');
    });

    it('updates user information', function (done) {
      user.route(app);

      request(app)
        .put('/-/user/joedoe')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(201, {"ok" : true}, done);
    });
  });
});

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
  var app;
  var registryPath = path.join(__dirname, 'registry');

  beforeEach(function () {
    sinon.stub(registry, 'refreshMeta');
    sinon.stub(registry, 'writeMeta');
    sinon.stub(registry, 'getMeta').returns({
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

  describe('#update', function () {
    it('routes /-/user/:couchuser', function () {
      sinon.stub(app, 'put');

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

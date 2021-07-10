/*jslint devel: true, node: true */
/*! Copyright (C) 2014 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var path    = require("path");
var request = require("supertest");
var sinon   = require("sinon");

var registry = require("../lib/registry");
var server   = require('../lib/server');
var session  = require("../lib/session");

describe('session', function () {
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

  describe('#create', function () {
    it('routes /_session', function () {
      sinon.stub(app, 'post');

      session.route(app);

      sinon.assert.calledWith(app.post, '/_session');
    });

    it('creates session', function (done) {
      session.route(app);

      request(app)
        .post('/_session')
        .send({ name: 'joedoe', password: 'joessecret' })
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(200, {"ok" : true}, done);
    });
  });
});

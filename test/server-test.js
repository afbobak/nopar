/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var assert     = require("chai").assert;
var bodyParser = require("body-parser");
var fs         = require("fs");
var path       = require("path");
var request    = require("supertest");
var sinon      = require("sinon");

var helpers    = require("./helpers");
var findRoute  = helpers.findRoute;
var findHandle = helpers.findHandle;

var registry = require('../lib/registry');
var server   = require('../lib/server');

function noop() {
  return;
}

// ==== Test Case

describe('server', function () {
  var sandbox, app;

  beforeEach(function () {
    sandbox  = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('views', function () {
    beforeEach(function () {
      sandbox.stub(registry, 'refreshMeta').returns({});
      app = server.createApp({
        registryPath : './registry',
        loglevel     : 'silent'
      });
    })

    it('sets views path', function () {
      var views = app.get('views');
      assert.equal(views, path.normalize(path.join(__dirname, '../views')));
    });

    it('sets views engine', function () {
      var engine = app.get('view engine');
      assert.equal(engine, 'ejs');
    });
  });
});

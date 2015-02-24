/*jslint devel: true, node: true */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var assert  = require("chai").assert;
var fs      = require("fs");
var http    = require("http");
var path    = require("path");
var request = require("supertest");
var sinon   = require("sinon");

var attachment = require("../lib/attachment");
var pkg        = require("../lib/pkg");
var registry   = require("../lib/registry");
var server     = require('../lib/server');

var pkgProxied = require('./registry/proxied/proxied.json');

// ==== Test Case

describe("pkg-test - getPackage", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(registry, 'setPackage');
    sandbox.stub(registry, 'getPackage');

    this.settingsStore = {
      get : sandbox.stub()
    };

    this.res = {
      status : sandbox.stub(),
    };
    this.json = sandbox.stub();
    this.res.status.returns({
      json : this.json
    });

    this.getFn = pkg.getPackage();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(pkg.getPackage);
  });

  it("should return package not found", function () {
    registry.getPackage.returns(null);
    this.settingsStore.get.returns(false);

    this.getFn({
      settingsStore : this.settingsStore,
      params        : { name : "non-existant" }
    }, this.res);

    sinon.assert.called(this.res.status);
    sinon.assert.calledWith(this.res.status, 404);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  });

  it("should return full package", function () {
    var pkgMeta = { a : "b", "_mtime": new Date() };
    registry.getPackage.returns(pkgMeta);

    this.getFn({
      settingsStore : this.settingsStore,
      params        : { name : "pkg" }
    }, this.res);

    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, pkgMeta);
  });

  it("should return package version not found", function () {
    var pkgMeta = {
      versions : {
        "0.0.1" : {
          name    : "pkg",
          version : "0,0.1"
        }
      }
    };
    registry.getPackage.returns(pkgMeta);
    this.settingsStore.get.returns(false);

    this.getFn({
      settingsStore : this.settingsStore,
      params        : {
        name    : "pkg",
        version : "0.0.2"
      }
    }, this.res);

    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 404);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  });

  it("should return specific package version", function () {
    var pkgMeta = {
      versions : {
        "0.0.1" : {
          "name"  : "pkg",
          version : "0.0.1"
        }
      }
    };

    var getPackage = registry.getPackage;
    getPackage.withArgs("pkg", "0.0.1").returns(pkgMeta.versions["0.0.1"]);
    getPackage.withArgs("pkg").returns(pkgMeta);

    this.getFn({
      settingsStore : this.settingsStore,
      params        : {
        name    : "pkg",
        version : "0.0.1"
      }
    }, this.res);

    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, pkgMeta.versions["0.0.1"]);
  });
});

// ==== Test Case

describe("pkg-test - getPackage proxied", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(http, "get").returns({on : sandbox.spy()});
    sandbox.stub(attachment, "refreshMeta");

    sandbox.stub(registry, 'setPackage');
    sandbox.stub(registry, 'getPackage');

    this.settingsStore = {
      get : sandbox.stub()
    };
    var get = this.settingsStore.get;
    get.withArgs("forwarder.registry").returns("http://u.url:8888/the/path/");
    get.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");

    this.res = {
      status : sandbox.stub(),
    };
    this.json = sandbox.stub();
    this.res.status.returns({
      json : this.json
    });

    this.getFn = pkg.getPackage();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should get full package JSON from forwarder", function () {
    var get = this.settingsStore.get;
    get.withArgs("forwarder.autoForward").returns(true);
    get.withArgs("forwarder.ignoreCert").returns(true);

    this.getFn({
      settingsStore : this.settingsStore,
      params        : {
        name    : "fwdpkg",
        version : "0.0.1"
      }
    }, this.res);

    sinon.assert.called(http.get);
    sinon.assert.calledWith(http.get, {
      headers  : { "User-Agent" : "nopar/0.0.0-test" },
      hostname : "u.url",
      port     : "8888",
      path     : "/the/path/fwdpkg",
      rejectUnauthorized : false
    });
  });

  it("should get full package JSON from forwarder via proxy", function () {
    var get = this.settingsStore.get;
    get.withArgs("forwarder.autoForward").returns(true);
    get.withArgs("forwarder.ignoreCert").returns(false);
    get.withArgs("forwarder.proxy").returns("http://localhost:8080");

    this.getFn({
      settingsStore : this.settingsStore,
      params        : {
        name    : "fwdpkg",
        version : "0.0.1"
      }
    }, this.res);

    sinon.assert.called(http.get);
    sinon.assert.calledWith(http.get, {
      headers  : {
        host         : "u.url",
        "User-Agent" : "nopar/0.0.0-test"
      },
      hostname : "localhost",
      port     : "8080",
      path     : "http://u.url:8888/the/path/fwdpkg",
      rejectUnauthorized : true
    });
  });

  it("should not get package from forwarder", function () {
    var get = this.settingsStore.get;
    get.withArgs("forwarder.autoForward").returns(false);

    this.getFn({
      settingsStore : this.settingsStore,
      params        : {
        name    : "fwdpkg",
        version : "0.0.1"
      }
    }, this.res);

    sinon.assert.notCalled(http.get);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 404);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  });

  it("should rewrite attachment urls and create fwd url map", function () {
    /*jslint nomen: true*/
    var get = this.settingsStore.get;
    get.withArgs("forwarder.autoForward").returns(true);
    var on = sandbox.stub();
    var pkgMeta = {
      name     : "fwdpkg",
      _proxied : true,
      versions : {
        "0.0.1" : {
          name    : "fwdpkg",
          version : "0.0.1",
          dist : {
            tarball : "http://registry.npmjs.org/fwdpkg/-/fwdpkg-0.0.1.tgz"
          }
        }
      }
    };
    on.withArgs("data").yields(JSON.stringify(pkgMeta));
    on.withArgs("end").yields();

    this.getFn({
      settingsStore : this.settingsStore,
      params        : {
        name    : "fwdpkg",
        version : "0.0.1"
      }
    }, this.res);
    http.get["yield"]({
      statusCode  : 200,
      setEncoding : sandbox.spy(),
      on          : on
    });

    sinon.assert.called(on);
    sinon.assert.calledWith(on, "data");
    sinon.assert.calledWith(on, "end");
  });

  it("should catch error events from http", function () {
    var spy = sandbox.spy();
    http.get.returns({
      on : spy
    });
    this.settingsStore.get.withArgs("forwarder.autoForward").returns(true);

    this.getFn({
      settingsStore : this.settingsStore,
      params        : {
        name    : "fwdpkg",
        version : "0.0.1"
      }
    }, this.res);

    sinon.assert.calledOnce(spy);
    sinon.assert.calledWith(spy, "error");
  });

  it.only("should catch syntax errors from JSON.parse when receiving invalid metadata", function () {
    var get = this.settingsStore.get;
    get.withArgs("forwarder.autoForward").returns(true);
    var on = sandbox.stub();
    var pkgMeta = 'Invalid JSON';
    on.withArgs("data").yields(pkgMeta);
    on.withArgs("end").yields();

    this.getFn({
      settingsStore : this.settingsStore,
      params        : {
        name    : "fwdpkg",
        version : "0.0.1"
      }
    }, this.res);

    assert.doesNotThrow(function ()
    {
      http.get["yield"]({
        statusCode  : 200,
        setEncoding : sandbox.spy(),
        on          : on
      });
    }, SyntaxError);
  });
});

// ==== Test Case

describe("pkg-test - publishFull", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    /*jslint nomen: true*/
    sandbox.stub(attachment, "refreshMeta");
    sandbox.stub(attachment, "skimTarballs", function (settings, pkgMeta, cb) {
      delete pkgMeta._attachments;
      cb();
    });

    sandbox.stub(registry, 'setPackage');
    sandbox.stub(registry, 'getPackage');

    this.settingsStore = {
      get : sandbox.stub()
    };

    this.res = {
      status : sandbox.stub(),
    };
    this.json = sandbox.stub();
    this.res.status.returns({
      json : this.json
    });

    this.publishFullFn = pkg.publishFull();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have functions", function () {
    assert.isFunction(pkg.publishFull);
  });

  it("should require content-type application/json", function () {
    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : {},
      params        : { name : "test" },
      originalUrl   : "/test"
    }, this.res);

    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 400);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {
      "error"  : "wrong_content",
      "reason" : "content-type MUST be application/json"
    });
  });

  it("should bounce with 409 when package already exists", function () {
    var pkgMeta = {
      "_id"  : "test",
      "_rev" : 1,
      "name" : "test"
    };
    registry.getPackage.returns(pkgMeta);

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test" },
      originalUrl   : "/test",
      body          : {
        "_id"  : "test",
        "name" : "test"
      }
    }, this.res);

    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 409);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {
      "error"  : "conflict",
      "reason" : "must supply latest _rev to update existing package"
    });
  });

  it("should bounce with 409 if document revision doesn't match", function () {
    var pkgMeta = {
      "_id"  : "test",
      "_rev" : 2,
      "name" : "test"
    };
    registry.getPackage.returns(pkgMeta);

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test", revision: 1 },
      originalUrl   : "/test",
      body          : {
        "_id"  : "test",
        "name" : "test"
      }
    }, this.res);

    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 409);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {
      "error"  : "conflict",
      "reason" : "revision does not match one in document"
    });
  });

  it("should bounce with 409 if inline document revision doesn't match", function () {
    var pkgMeta = {
      "_id"  : "test",
      "_rev" : 2,
      "name" : "test"
    };
    registry.getPackage.returns(pkgMeta);

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test" },
      originalUrl   : "/test",
      body          : {
        "_id"  : "test",
        "name" : "test",
        "_rev" : 1
      }
    }, this.res);

    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 409);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {
      "error"  : "conflict",
      "reason" : "revision does not match one in document"
    });
  });

  it("should add package and persist registry for new package", function () {
    registry.getPackage.returns(null);

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test" },
      originalUrl   : "/test",
      body          : {
        "_id"  : "test",
        "name" : "test"
      }
    }, this.res);

    var pkgMeta = {
      "_id"      : "test",
      "name"     : "test",
      "_rev"     : 1,
      "_proxied" : false
    };
    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settingsStore,
      pkgMeta);
    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, pkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {"ok" : true});
  });

  it("should skim off attachment and persist for new package", function () {
    registry.getPackage.returns(null);

    var tarballBytes = new Buffer("I'm a tarball");
    var tarballBase64 = tarballBytes.toString('base64');

    var pkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_attachments": {
        "test-0.0.1.tgz": {
          "content-type": "application/octet-stream",
          "data": tarballBase64,
          "length": tarballBytes.byteLength
        }
      }
    };

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test" },
      originalUrl   : "/test",
      body          : pkgMeta
    }, this.res);

    sinon.assert.called(attachment.skimTarballs);
    sinon.assert.calledWith(attachment.skimTarballs, this.settingsStore,
      pkgMeta);

    var newPkgMeta = {
      "_id"      : "test",
      "name"     : "test",
      "_rev"     : 1,
      "_proxied" : false
    };
    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settingsStore,
      newPkgMeta);
    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, newPkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {"ok" : true});
  });

  it("should update package and persist registry for existing pkg", function () {
    var pkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : 2,
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {}
      }
    };
    registry.getPackage.returns(pkgMeta);

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test", revision : 2 },
      originalUrl   : "/test",
      body          : {
        "_id"  : "test",
        "name" : "test",
        "_rev" : 2,
        "versions" : {
          "0.0.1" : {},
          "0.0.2" : {},
          "0.0.3" : {}
        }
      }
    }, this.res);

    var newPkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : 3,
      "_proxied": false,
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {},
        "0.0.3" : {}
      }
    };

    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settingsStore,
      newPkgMeta);
    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, newPkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {"ok" : true});
  });

  it("should update and persist pkg if _rev is same but different type", function () {
    var pkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : "2",
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {}
      }
    };
    registry.getPackage.returns(pkgMeta);

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test", revision : 2 },
      originalUrl   : "/test",
      body          : {
        "_id"  : "test",
        "name" : "test",
        "_rev" : 2,
        "versions" : {
          "0.0.1" : {},
          "0.0.2" : {},
          "0.0.3" : {}
        }
      }
    }, this.res);

    var newPkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : 3,
      "_proxied": false,
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {},
        "0.0.3" : {}
      }
    };

    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settingsStore,
      newPkgMeta);
    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, newPkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {"ok" : true});
  });

  it("should update and persist if _rev is same inside document", function () {
    var pkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : 2,
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {}
      }
    };
    registry.getPackage.returns(pkgMeta);

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test" },
      originalUrl   : "/test",
      body          : {
        "_id"  : "test",
        "name" : "test",
        "_rev" : 2,
        "versions" : {
          "0.0.1" : {},
          "0.0.2" : {},
          "0.0.3" : {}
        }
      }
    }, this.res);

    var newPkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : 3,
      "_proxied": false,
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {},
        "0.0.3" : {}
      }
    };

    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settingsStore,
      newPkgMeta);
    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, newPkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {"ok" : true});
  });

  it("should skim attachments, update and persist for existing pkg", function () {
    var pkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : 2,
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {}
      }
    };
    registry.getPackage.returns(pkgMeta);

    var tarballBytes = new Buffer("I'm a tarball");
    var tarballBase64 = tarballBytes.toString('base64');

    var payload = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : 2,
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {}
      },
      "_attachments": {
        "test-0.0.2.tgz": {
          "content-type": "application/octet-stream",
          "data": tarballBase64,
          "length": tarballBytes.byteLength
        }
      }
    };

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test" },
      originalUrl   : "/test",
      body          : payload
    }, this.res);

    sinon.assert.called(attachment.skimTarballs);
    sinon.assert.calledWith(attachment.skimTarballs, this.settingsStore,
      payload);

    var newPkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : 3,
      "_proxied": false,
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {}
      }
    };

    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settingsStore,
      newPkgMeta);
    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, newPkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {"ok" : true});
  });

  it("should keep old version", function () {
    registry.getPackage.returns({});

    this.publishFullFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : { name : "test" },
      originalUrl   : "/test"
    }, this.res);

    sinon.assert.notCalled(attachment.refreshMeta);
    sinon.assert.notCalled(registry.setPackage);
  });
});


// ==== Test Case

describe("pkg-test - publish", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(attachment, "refreshMeta");

    sandbox.stub(registry, 'setPackage');
    sandbox.stub(registry, 'getPackage');

    this.settingsStore = {
      get : sandbox.stub()
    };

    this.res = {
      status : sandbox.stub(),
    };
    this.json = sandbox.stub();
    this.res.status.returns({
      json : this.json
    });

    this.publishFn = pkg.publish();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(pkg.publish);
  });

  it("should require content-type application/json", function () {
    this.publishFn({
      settingsStore : this.settingsStore,
      headers       : {},
      params        : { name : "test" },
      originalUrl   : "/test"
    }, this.res);

    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 400);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {
      "error"  : "wrong_content",
      "reason" : "content-type MUST be application/json"
    });
  });

  it("should create new package and bounce revision", function () {
    /*jslint nomen: true*/
    var pkgMeta = {
      name       : "test",
      "_rev"     : 1,
      "_proxied" : false,
      versions   : {
        "0.0.1-dev" : {}
      }
    };
    registry.getPackage.returns(pkgMeta);

    this.publishFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : {
        name    : "test",
        version : "0.0.1-dev"
      },
      originalUrl : "/test/0.0.1-dev"
    }, this.res);

    pkgMeta._rev++;

    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settingsStore,
      pkgMeta);
    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, pkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, "0.0.1-dev");
  });

  it("should reset revision if it's a checksum", function () {
    /*jslint nomen: true*/
    var pkgMeta = {
      name        : "test",
      "_rev"      : "011f2254e3def8ab3023052072195e1a",
      "_proxied"  : false,
      "dist-tags" : { latest : "0.0.1-dev" },
      versions    : { "0.0.1-dev" : {} }
    };
    registry.getPackage.returns(pkgMeta);

    this.publishFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : {
        name    : "test",
        version : "0.0.1-dev"
      },
      originalUrl : "/test/0.0.1-dev"
    }, this.res);

    pkgMeta._rev = 1;

    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settingsStore,
      pkgMeta);
    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, pkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, "0.0.1-dev");
  });

  it("should add tag and return latest version number in body", function () {
    registry.getPackage.returns(null);

    this.publishFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : {
        name    : "test",
        version : "0.0.1-dev",
        tagname : "latest"
      },
      originalUrl : "/test/0.0.1-dev/-tag/latest"
    }, this.res);

    var pkgMeta = {
      name        : "test",
      "_rev"      : 1,
      description : undefined,
      readme      : undefined,
      versions    : {"0.0.1-dev" : {}},
      "dist-tags" : {latest : "0.0.1-dev"},
      "_proxied"  : false
    };

    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settingsStore,
      pkgMeta);
    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, pkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, "0.0.1-dev");
  });

  it("should keep latest if version<latest", function () {
    /*jslint nomen: true*/
    var pkgMeta = {
      name        : "test",
      "_rev"      : 0,
      "_proxied"  : false,
      "dist-tags" : { latest : "0.0.2" },
      versions    : { "0.0.2" : {} }
    };
    registry.getPackage.returns(pkgMeta);

    this.publishFn({
      settingsStore : this.settingsStore,
      headers       : { "content-type" : "application/json" },
      params        : {
        name    : "test",
        version : "0.0.1-dev",
        tagname : "latest"
      },
      originalUrl : "/test/0.0.1-dev/-tag/latest"
    }, this.res);

    pkgMeta = {
      name        : "test",
      "_rev"      : 1,
      "_proxied"  : false,
      "dist-tags" : { latest : "0.0.2" },
      versions    : { "0.0.2" : {}, "0.0.1-dev": {} }
    };
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 200);
    sinon.assert.calledWith(registry.setPackage, pkgMeta);
    sinon.assert.calledWith(this.json, "0.0.1-dev");
  });
});


// ==== Test Case

describe("pkg-test - tag", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(registry, 'setPackage');
    sandbox.stub(registry, 'getPackage');

    this.settingsStore = {
      get : sandbox.stub()
    };

    this.res = {
      status : sandbox.stub(),
    };
    this.json = sandbox.stub();
    this.res.status.returns({
      json : this.json
    });

    this.tagFn = pkg.tag();
  });

  afterEach(function () {
    sandbox.restore();
  });

    it("should have function", function () {
    assert.isFunction(pkg.tag);
  });

  it("should add tag and return 201 latest package json", function () {
    /*jslint nomen: true*/
    var pkgMeta = {
      name     : "test",
      "_rev"   : 1,
      versions : {
        "0.1.0" : {}
      },
      "dist-tags" : {
        latest : "0.1.0"
      }
    };
    registry.getPackage.returns(pkgMeta);

    this.tagFn({
      headers     : { "content-type" : "application/json" },
      params      : {
        name    : pkgMeta.name,
        tagname : "release"
      },
      body        : '"0.1.0"',
      originalUrl : "/test/0.0.1-dev/tag/release"
    }, this.res);

    pkgMeta._rev = 2;
    pkgMeta["dist-tags"].release = "0.1.0";

    sinon.assert.called(registry.setPackage);
    sinon.assert.calledWith(registry.setPackage, pkgMeta);
    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 201);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, pkgMeta);
  });
});


// ==== Test Case

describe("pkg-test - unpublish", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(fs, "unlinkSync");
    sandbox.stub(fs, "rmdirSync");

    sandbox.stub(registry, 'getPackage');
    sandbox.stub(registry, 'removePackage');

    this.settingsStore = {
      get : sandbox.stub()
    };

    this.res = {
      status : sandbox.stub(),
    };
    this.json = sandbox.stub();
    this.res.status.returns({
      json : this.json
    });

    this.unpublishFn = pkg.unpublish();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(pkg.unpublish);
  });

  it("should delete package meta, attachments and folder", function () {
    this.settingsStore.get.returns("/path");
    sandbox.stub(fs, "existsSync").
      withArgs("/path/test/test-0.0.1-dev.tgz").returns(true);
    var pkgMeta = {
      name     : "test",
      "_rev"   : 1,
      "versions" : {
        "0.0.1-dev" : {
          "dist" : {
            "tarball" : "http://localhost:5984/test/-/test-0.0.1-dev.tgz"
          }
        }
      }
    };
    registry.getPackage.returns(pkgMeta);

    this.unpublishFn({
      settingsStore : this.settingsStore,
      params        : { name : "test" },
      originalUrl   : "/test",
      accepts       : function () { return false; },
      flash         : sinon.stub()
    }, this.res);

    sinon.assert.calledOnce(registry.removePackage);
    sinon.assert.calledWith(registry.removePackage, "test");

    sinon.assert.calledOnce(fs.unlinkSync);
    sinon.assert.calledWith(fs.unlinkSync, "/path/test/test-0.0.1-dev.tgz");

    sinon.assert.calledOnce(fs.rmdirSync);
    sinon.assert.calledWith(fs.rmdirSync, "/path/test");
  });
});

// ==== Test Case

describe("pkg-test - refresh", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(http, "get").returns({on : sandbox.spy()});
    sandbox.stub(attachment, "refreshMeta");
    this.res = {
      status : sandbox.stub(),
    };
    this.json = sandbox.stub();
    this.res.status.returns({
      json : this.json
    });

    sandbox.stub(registry, 'setPackage');
    sandbox.stub(registry, 'getPackage');

    this.settingsStore = {
      get : sandbox.stub()
    };
    var get = this.settingsStore.get;
    get.withArgs("forwarder.registry").returns("http://u.url:8888/the/path/");
    get.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");

    this.refreshFn = pkg.refresh(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(pkg.refresh);
  });

  it("should return document not found", function () {
    registry.getPackage.returns(null);

    this.refreshFn({params: {name: "fwdpkg"}}, this.res);

    sinon.assert.calledOnce(this.res.status);
    sinon.assert.calledWith(this.res.status, 404);
    sinon.assert.called(this.json);
    sinon.assert.calledWith(this.json, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  });

  it("should refresh full package JSON from forwarder", function () {
    registry.getPackage.returns({});

    this.refreshFn({
      params        : {name : "fwdpkg"},
      settingsStore : this.settingsStore
    }, this.res);

    sinon.assert.called(http.get);
    sinon.assert.calledWith(http.get, {
      headers  : { "User-Agent" : "nopar/0.0.0-test" },
      hostname : "u.url",
      port     : "8888",
      path     : "/the/path/fwdpkg",
      rejectUnauthorized : true
    });
  });
});

// ==== Test Case

describe('package npm functions', function () {
  var sandbox, app, pkgMeta;
  var registryPath = path.join(__dirname, 'registry');

  beforeEach(function () {
    pkgMeta = JSON.parse(JSON.stringify(pkgProxied));
    pkgMeta['_mtime'] = new Date();

    sandbox = sinon.sandbox.create();

    sandbox.stub(registry, 'init');
    sandbox.stub(registry, 'refreshMeta');
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

  describe('#get', function () {
    it('routes /:name/:version?', function () {
      sandbox.stub(app, 'get');

      pkg.route(app);

      sinon.assert.calledWith(app.get, '/:name/:version?');
    });

    it('retrieves package meta json', function (done) {
      pkg.route(app);

      request(app)
        .get('/proxied')
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(200, /"_rev":3/, done);
    });
  });

  describe('#publish', function () {
    it('routes /:name', function () {
      sandbox.stub(app, 'put');

      pkg.route(app);

      sinon.assert.calledWith(app.put, '/:name');
    });

    it('publishes full package meta json', function (done) {
      sandbox.stub(registry, 'getPackage');
      sandbox.stub(registry, 'setPackage');

      pkg.route(app);

      request(app)
        .put('/proxied')
        .set('Content-Type', 'application/json')
        .send(pkgMeta)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(200, {"ok": true}, done);
    });

    it('routes /:name/-rev/:revision', function () {
      sandbox.stub(app, 'put');

      pkg.route(app);

      sinon.assert.calledWith(app.put, '/:name/-rev/:revision');
    });

    it('shows conflicting package meta json revisions', function (done) {
      sandbox.stub(registry, 'getPackage').returns(pkgMeta);
      sandbox.stub(registry, 'setPackage');

      pkg.route(app);

      request(app)
        .put('/proxied/-rev/test')
        .set('Content-Type', 'application/json')
        .send(pkgMeta)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(409, { error: 'conflict',
          reason: 'revision does not match one in document' }, done);
    });

    it('routes /:name/:version/-tag/:tagname', function () {
      sandbox.stub(app, 'put');

      pkg.route(app);

      sinon.assert.calledWith(app.put, '/:name/:version/-tag/:tagname');
    });

    it('publishes and tags specific version of package', function (done) {
      sandbox.stub(registry, 'getPackage').returns(pkgMeta);
      sandbox.stub(registry, 'setPackage');
      sandbox.stub(attachment, 'refreshMeta');

      pkg.route(app);

      request(app)
        .put('/proxied/2.1.0/-tag/latest')
        .set('Content-Type', 'application/json')
        .send(pkgMeta)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(200, '"2.1.0"', done);
    });
  });

  describe('#tag', function () {
    it('routes /:name/:tagname', function () {
      sandbox.stub(app, 'put');

      pkg.route(app);

      sinon.assert.calledWith(app.put, '/:name/:tagname');
    });

    it('tags package meta json as text/plain', function (done) {
      sandbox.stub(registry, 'getPackage').returns(pkgMeta);
      sandbox.stub(registry, 'setPackage');

      pkg.route(app);

      request(app)
        .put('/proxied/someTag')
        .set('Content-Type', 'text/plain')
        .send('2.0.0')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(201, /"name":"proxied".*"someTag":"2.0.0".*"_rev":4/, done);
    });

    it('tags package meta json as application/json', function (done) {
      sandbox.stub(registry, 'getPackage').returns(pkgMeta);
      sandbox.stub(registry, 'setPackage');

      pkg.route(app);

      request(app)
        .put('/proxied/someTag')
        .set('Content-Type', 'application/json')
        .send('"2.0.0"')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(201, /"name":"proxied".*"someTag":"2.0.0".*"_rev":4/, done);
    });
  });

  describe('#unpublish', function () {
    it('routes /:name/-rev/:revision', function () {
      sandbox.stub(app, 'delete');

      pkg.route(app);

      sinon.assert.calledWith(app['delete'], '/:name/-rev/:revision');
    });

    it('deletes specific package version', function (done) {
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'unlinkSync');
      sandbox.stub(fs, 'rmdirSync');
      sandbox.stub(registry, 'getPackage').returns(pkgMeta);
      sandbox.stub(registry, 'removePackage');

      pkg.route(app);

      request(app)
        .del('/proxied/-rev/1.0.0')
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(200, {"ok": true}, done);
    });
  });
});

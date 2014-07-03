/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var assert = require("chai").assert;
var fs     = require("fs");
var http   = require("http");
var path   = require("path");
var sinon  = require("sinon");

var attachment = require("../lib/attachment");
var pkg        = require("../lib/pkg");

// ==== Test Case

describe("pkg-test - getPackage", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    this.app = {
      get : sandbox.stub()
    };
    this.res = {
      json : sandbox.stub()
    };
    this.getFn = pkg.getPackage(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(pkg.getPackage);
  });

  it("should return package not found", function () {
    this.app.get.withArgs("registry").returns({
      getPackage : sandbox.stub().returns(null)
    });
    this.app.get.withArgs("settings").returns({
      get : sandbox.stub().returns(false)
    });

    this.getFn({
      params : { packagename : "non-existant" }
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  });

  it("should return full package", function () {
    var pkgMeta = { a : "b", "_mtime": new Date() };
    this.app.get.withArgs("registry").returns({
      getPackage : sandbox.stub().returns(pkgMeta)
    });

    this.getFn({
      params : { packagename : "pkg" }
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, pkgMeta);
  });

  it("should return package version not found", function () {
    var pkgMeta = {
      versions : {
        "0.0.1" : {
          "name"  : "pkg",
          version : "0,0.1"
        }
      }
    };
    this.app.get.withArgs("registry").returns({
      getPackage : sandbox.stub().returns(pkgMeta)
    });
    this.app.get.withArgs("settings").returns({
      get : sandbox.stub().returns(false)
    });

    this.getFn({
      params : {
        packagename : "pkg",
        version : "0.0.2"
      }
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 404, {
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
    var getPackage = sandbox.stub();
    getPackage.withArgs("pkg", "0.0.1").returns(pkgMeta.versions["0.0.1"]);
    getPackage.withArgs("pkg").returns(pkgMeta);
    this.app.get.withArgs("registry").returns({getPackage : getPackage});

    this.getFn({
      params : {
        packagename : "pkg",
        version     : "0.0.1"
      }
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, pkgMeta.versions["0.0.1"]);
  });
});

// ==== Test Case

describe("pkg-test - getPackage proxied", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(http, "get").returns({on : sandbox.spy()});
    sandbox.stub(attachment, "refreshMeta");
    this.app = {
      get : sandbox.stub()
    };
    this.res = {
      json : sandbox.stub()
    };
    this.app.get.withArgs("registry").returns({
      setPackage : sandbox.stub(),
      getPackage : sandbox.stub().returns(null)
    });
    this.getSetting = sandbox.stub();
    this.getSetting.withArgs("forwarder.registry").returns("http://u.url:8888/the/path/");
    this.getSetting.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");
    this.app.get.withArgs("settings").returns({
      get : this.getSetting
    });
    this.getFn = pkg.getPackage(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should get full package JSON from forwarder", function () {
    this.getSetting.withArgs("forwarder.autoForward").returns(true);
    this.getSetting.withArgs("forwarder.ignoreCert").returns(true);

    this.getFn({
      params : {
        packagename : "fwdpkg",
        version     : "0.0.1"
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
    this.getSetting.withArgs("forwarder.autoForward").returns(true);
    this.getSetting.withArgs("forwarder.ignoreCert").returns(false);
    this.getSetting.withArgs("forwarder.proxy").returns("http://localhost:8080");

    this.getFn({
      params : {
        packagename : "fwdpkg",
        version     : "0.0.1"
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
    this.getSetting.withArgs("forwarder.autoForward").returns(false);

    this.getFn({
      params : {
        packagename : "fwdpkg",
        version     : "0.0.1"
      }
    }, this.res);

    sinon.assert.notCalled(http.get);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  });

  it("should rewrite attachment urls and create fwd url map", function () {
    /*jslint nomen: true*/
    this.getSetting.withArgs("forwarder.autoForward").returns(true);
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
      params : {
        packagename : "fwdpkg",
        version     : "0.0.1"
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
    this.getSetting.withArgs("forwarder.autoForward").returns(true);

    this.getFn({
      params : {
        packagename : "fwdpkg",
        version     : "0.0.1"
      }
    }, this.res);

    sinon.assert.calledOnce(spy);
    sinon.assert.calledWith(spy, "error");
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

    this.app = {
      get : sandbox.stub()
    };
    this.settings = {};
    this.app.get.withArgs("settings").returns(this.settings);
    this.setPackageStub = sandbox.stub();
    this.getPackageStub = sandbox.stub();
    this.app.get.withArgs("registry").returns({
      setPackage : this.setPackageStub,
      getPackage : this.getPackageStub
    });
    this.res = {
      json : sandbox.stub()
    };
    this.publishFullFn = pkg.publishFull(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have functions", function () {
    assert.isFunction(pkg.publishFull);
  });

  it("should require content-type application/json", function () {
    this.publishFullFn({
      headers     : {},
      params      : { packagename : "test" },
      originalUrl : "/test"
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 400, {
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
    this.getPackageStub.returns(pkgMeta);

    this.publishFullFn({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test",
      body        : {
        "_id"  : "test",
        "name" : "test"
      }
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 409, {
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
    this.getPackageStub.returns(pkgMeta);

    this.publishFullFn({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test", revision: 1 },
      originalUrl : "/test",
      body        : {
        "_id"  : "test",
        "name" : "test"
      }
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 409, {
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
    this.getPackageStub.returns(pkgMeta);

    this.publishFullFn({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test",
      body        : {
        "_id"  : "test",
        "name" : "test",
        "_rev" : 1
      }
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 409, {
      "error"  : "conflict",
      "reason" : "revision does not match one in document"
    });
  });

  it("should add package and persist registry for new package", function () {
    this.getPackageStub.returns(null);

    this.publishFullFn({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test",
      body        : {
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
    sinon.assert.calledWith(attachment.refreshMeta, this.settings, pkgMeta);
    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, pkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, {"ok" : true});
  });

  it("should skim off attachment and persist for new package", function () {
    this.getPackageStub.returns(null);

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
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test",
      body        : pkgMeta
    }, this.res);

    sinon.assert.called(attachment.skimTarballs);
    sinon.assert.calledWith(attachment.skimTarballs, this.settings, pkgMeta);

    var newPkgMeta = {
      "_id"      : "test",
      "name"     : "test",
      "_rev"     : 1,
      "_proxied" : false
    };
    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settings, newPkgMeta);
    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, newPkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, {"ok" : true});
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
    this.getPackageStub.returns(pkgMeta);

    this.publishFullFn({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test", revision : 2 },
      originalUrl : "/test",
      body        : {
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
    sinon.assert.calledWith(attachment.refreshMeta, this.settings, newPkgMeta);
    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, newPkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, {"ok" : true});
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
    this.getPackageStub.returns(pkgMeta);

    this.publishFullFn({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test", revision : 2 },
      originalUrl : "/test",
      body        : {
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
    sinon.assert.calledWith(attachment.refreshMeta, this.settings, newPkgMeta);
    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, newPkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, {"ok" : true});
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
    this.getPackageStub.returns(pkgMeta);

    this.publishFullFn({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test",
      body        : {
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
    sinon.assert.calledWith(attachment.refreshMeta, this.settings, newPkgMeta);
    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, newPkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, {"ok" : true});
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
    this.getPackageStub.returns(pkgMeta);

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
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test",
      body        : payload
    }, this.res);

    sinon.assert.called(attachment.skimTarballs);
    sinon.assert.calledWith(attachment.skimTarballs, this.settings, payload);

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
    sinon.assert.calledWith(attachment.refreshMeta, this.settings, newPkgMeta);
    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, newPkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, {"ok" : true});
  });

  it("should keep old version", function () {
    this.getPackageStub.returns({});

    this.publishFullFn({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test"
    }, this.res);

    sinon.assert.notCalled(attachment.refreshMeta);
    sinon.assert.notCalled(this.setPackageStub);
  });
});


// ==== Test Case

describe("pkg-test - publish", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(attachment, "refreshMeta");
    this.app = {
      get : sandbox.stub()
    };
    this.setPackageStub = sandbox.stub();
    this.getPackageStub = sandbox.stub();
    this.app.get.withArgs("registry").returns({
      setPackage : this.setPackageStub,
      getPackage : this.getPackageStub
    });
    this.res = {
      json : sandbox.stub()
    };
    this.publishFn = pkg.publish(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(pkg.publish);
  });

  it("should require content-type application/json", function () {
    this.publishFn({
      headers     : {},
      params      : { packagename : "test" },
      originalUrl : "/test"
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 400, {
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
    this.getPackageStub.returns(pkgMeta);

    this.publishFn({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : "test",
        version     : "0.0.1-dev"
      },
      originalUrl : "/test/0.0.1-dev"
    }, this.res);

    pkgMeta._rev++;

    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settings, pkgMeta);
    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, pkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, "\"0.0.1-dev\"");
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
    this.getPackageStub.returns(pkgMeta);

    this.publishFn({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : "test",
        version     : "0.0.1-dev"
      },
      originalUrl : "/test/0.0.1-dev"
    }, this.res);

    pkgMeta._rev = 1;

    sinon.assert.called(attachment.refreshMeta);
    sinon.assert.calledWith(attachment.refreshMeta, this.settings, pkgMeta);
    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, pkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, "\"0.0.1-dev\"");
  });

  it("should add tag and return latest version number in body", function () {
    this.getPackageStub.returns(null);

    this.publishFn({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : "test",
        version     : "0.0.1-dev",
        tagname     : "latest"
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
    sinon.assert.calledWith(attachment.refreshMeta, this.settings, pkgMeta);
    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, pkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, "\"0.0.1-dev\"");
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
    this.getPackageStub.returns(pkgMeta);

    this.publishFn({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : "test",
        version     : "0.0.1-dev",
        tagname     : "latest"
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
    sinon.assert.calledWith(this.setPackageStub, pkgMeta);
    sinon.assert.calledWith(this.res.json, 200, "\"0.0.1-dev\"");
  });
});


// ==== Test Case

describe("pkg-test - tag", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    this.app = {
      get : sandbox.stub()
    };
    this.setPackageStub = sandbox.stub();
    this.getPackageStub = sandbox.stub();
    this.app.get.withArgs("registry").returns({
      setPackage : this.setPackageStub,
      getPackage : this.getPackageStub
    });
    this.res = {
      json : sandbox.stub()
    };
    this.tagFn = pkg.tag(this.app);
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
    this.getPackageStub.returns(pkgMeta);

    this.tagFn({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : pkgMeta.name,
        tagname     : "release"
      },
      body        : "0.1.0",
      originalUrl : "/test/0.0.1-dev/tag/release"
    }, this.res);

    pkgMeta._rev = 2;
    pkgMeta["dist-tags"].release = "0.1.0";

    sinon.assert.called(this.setPackageStub);
    sinon.assert.calledWith(this.setPackageStub, pkgMeta);
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 201, pkgMeta);
  });
});


// ==== Test Case

describe("pkg-test - unpublish", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(fs, "unlinkSync");
    sandbox.stub(fs, "rmdirSync");

    this.app = {
      get : sandbox.stub()
    };
    this.removePackageStub = sandbox.stub();
    this.getPackageStub    = sandbox.stub();
    this.app.get.withArgs("registry").returns({
      removePackage : this.removePackageStub,
      getPackage    : this.getPackageStub
    });
    this.res = {
      json : sandbox.stub()
    };
    this.unpublishFn = pkg.unpublish(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(pkg.unpublish);
  });

  it("should delete package meta, attachments and folder", function () {
    this.app.get.withArgs("settings").returns({
      get : sandbox.stub().returns("/path")
    });
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
    this.getPackageStub.returns(pkgMeta);

    this.unpublishFn({
      params      : {
        packagename : "test"
      },
      originalUrl : "/test"
    }, this.res);

    sinon.assert.calledOnce(this.removePackageStub);
    sinon.assert.calledWith(this.removePackageStub, "test");

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
    this.app = {
      get : sandbox.stub()
    };
    this.res = {
      json : sandbox.stub()
    };
    this.getPackageStub = sandbox.stub();
    this.app.get.withArgs("registry").returns({
      setPackage : sandbox.stub(),
      getPackage : this.getPackageStub
    });
    this.getSetting = sandbox.stub();
    this.getSetting.withArgs("forwarder.registry").
      returns("http://u.url:8888/the/path/");
    this.getSetting.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");
    this.app.get.withArgs("settings").returns({
      get : this.getSetting
    });
    this.refreshFn = pkg.refresh(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(pkg.refresh);
  });

  it("should return document not found", function () {
    this.getPackageStub.returns(null);

    this.refreshFn({params: {packagename: "fwdpkg"}}, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  });

  it("should refresh full package JSON from forwarder", function () {
    this.getPackageStub.returns({});

    this.refreshFn({params: {packagename: "fwdpkg"}}, this.res);

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

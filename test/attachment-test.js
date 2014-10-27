/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var assert  = require("chai").assert;
var fs      = require("fs");
var http    = require("http");
var https   = require("https");
var path    = require("path");
var request = require("supertest");
var sinon   = require("sinon");

var attachment = require("../lib/attachment");
var registry   = require("../lib/registry");
var server     = require('../lib/server');

// ==== Test Case

describe("attachment-test - download", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(registry, 'setPackage');
    sandbox.stub(registry, 'getPackage');

    this.settingsStore = {
      get : sandbox.stub()
    };

    this.res = {
      download : sandbox.stub(),
      json     : sandbox.stub()
    };
    this.downloadFn = attachment.download();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(attachment.download);
  });

  it("should return package not found", function () {
    registry.getPackage.returns(null);

    this.downloadFn({
      settingsStore : this.settingsStore,
      params        : { name : "non-existant" }
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "package not found"
    });
  });

  it("should return package", function () {
    var pkgMeta = {
      "name" : "test",
      "dist-tags" : {
        "latest" : "0.0.1-dev"
      },
      "versions" : {
        "0.0.1-dev" : {
          "dist" : {
            "tarball" : "test-0.0.1-dev.tgz"
          }
        }
      }
    };
    registry.getPackage.returns(pkgMeta);
    this.settingsStore.get.returns("/registryPath");
    sandbox.stub(fs, "existsSync").returns(true);

    this.downloadFn({
      settingsStore : this.settingsStore,
      params        : {
        name       : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    sinon.assert.calledOnce(this.res.download);
    sinon.assert.calledWith(
      this.res.download,
      path.join("/registryPath", "test", "test-0.0.1-dev.tgz"),
      "test-0.0.1-dev.tgz"
    );
  });

  it("should not return invalid files", function () {
    sandbox.stub(fs, "existsSync");

    // http://localhost:5984/abstrakt-npm-proxy/-/..%2Fregistry.json
    this.downloadFn({
      settingsStore : this.settingsStore,
      params        : {
        name       : "test",
        attachment : "../invalidFile.json"
      }
    }, this.res);

    sinon.assert.neverCalledWith(fs.existsSync, "/path/invalidFile.json");
    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "attachment not found"
    });
  });

  it("should download attachment from forwarder and mark as cached", function () {
    /*jslint nomen: true */
    var pkgMeta = {
      "name" : "test",
      "dist-tags" : {
        "latest" : "0.0.1-dev"
      },
      "versions" : {
        "0.0.1-dev" : {
          "dist" : {
            "tarball" : "test-0.0.1-dev.tgz"
          }
        }
      },
      "_attachments" : {
        "test-0.0.1-dev.tgz" : {
          forwardUrl: "http://fwd.url/pkg.tgz"
        }
      }
    };
    registry.getPackage.returns(pkgMeta);
    var get = this.settingsStore.get;
    get.withArgs("registryPath").returns("/path");
    sandbox.stub(http, "get").returns({
      on : sandbox.spy()
    });
    sandbox.stub(fs, "existsSync").returns(false);
    fs.existsSync.withArgs("/path/test").returns(true);

    this.downloadFn({
      settingsStore : this.settingsStore,
      params        : {
        name       : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    sinon.assert.calledWith(fs.existsSync, "/path/test/test-0.0.1-dev.tgz");
    sinon.assert.notCalled(this.res.json);
    sinon.assert.called(http.get);
    sinon.assert.calledWith(http.get, "http://fwd.url/pkg.tgz");
    //TODO pkgMeta._attachments["test-0.0.1-dev.tgz"].cached = true;
    //sinon.assert.calledWith(registry.setPackage, pkgMeta);
  });

  it("should download attachment from forwarder via proxy", function () {
    var pkgMeta = {
      "name" : "test",
      "dist-tags" : {
        "latest" : "0.0.1-dev"
      },
      "versions" : {
        "0.0.1-dev" : {
          "dist" : {
            "tarball" : "test-0.0.1-dev.tgz"
          }
        }
      },
      "_attachments" : {
        "test-0.0.1-dev.tgz" : {
          forwardUrl: "http://fwd.url/pkg.tgz"
        }
      }
    };
    registry.getPackage.returns(pkgMeta);
    var get = this.settingsStore.get;
    get.withArgs("registryPath").returns("/path");
    get.withArgs("forwarder.proxy").returns("https://localhost:8080");
    get.withArgs("forwarder.autoForward").returns(true);
    get.withArgs("forwarder.ignoreCert").returns(true);
    get.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");
    sandbox.stub(http, "get");
    sandbox.stub(https, "get").returns({
      on : sandbox.spy()
    });
    sandbox.stub(fs, "existsSync").returns(false);
    fs.existsSync.withArgs("/path/test").returns(true);

    this.downloadFn({
      settingsStore : this.settingsStore,
      params        : {
        name       : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    sinon.assert.calledWith(fs.existsSync, "/path/test/test-0.0.1-dev.tgz");
    sinon.assert.notCalled(http.get);
    sinon.assert.called(https.get);
    sinon.assert.calledWith(https.get, {
      headers  : {
        host         : "fwd.url",
        "User-Agent" : "nopar/0.0.0-test"
      },
      hostname : "localhost",
      port     : "8080",
      path     : "http://fwd.url/pkg.tgz",
      rejectUnauthorized : false
    });
  });

  it("should catch error events from http", function () {
    var pkgMeta = {
      "name" : "test",
      "dist-tags" : {
        "latest" : "0.0.1-dev"
      },
      "versions" : {
        "0.0.1-dev" : {
          "dist" : {
            "tarball" : "test-0.0.1-dev.tgz"
          }
        }
      },
      "_attachments" : {
        "test-0.0.1-dev.tgz" : {
          forwardUrl: "http://fwd.url/pkg.tgz"
        }
      }
    };
    registry.getPackage.returns(pkgMeta);
    var get = this.settingsStore.get;
    get.withArgs("registryPath").returns("/path");
    get.withArgs("forwarder.proxy").returns("http://localhost:8080");
    get.withArgs("forwarder.autoForward").returns(true);
    get.withArgs("forwarder.ignoreCert").returns(false);
    get.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");
    var spy = sandbox.spy();
    sandbox.stub(http, "get").returns({
      on : spy
    });
    sandbox.stub(fs, "existsSync").returns(false);
    fs.existsSync.withArgs("/path/test").returns(true);

    this.downloadFn({
      settingsStore : this.settingsStore,
      params        : {
        name       : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    sinon.assert.calledOnce(http.get);
    sinon.assert.calledOnce(spy);
    sinon.assert.calledWith(spy, "error");
  });
});


// ==== Test Case

describe("attachment-test - attach", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(fs, "createWriteStream");

    sandbox.stub(registry, 'setPackage');
    sandbox.stub(registry, 'getPackage');

    this.settingsStore = {
      get : sandbox.stub()
    };
    this.settingsStore.get.withArgs("registryPath").returns("/path");

    this.req = {
      settingsStore : this.settingsStore,
      headers       : {
        "content-type" : "application/octet-stream"
      },
      params      : {
        name       : "test",
        attachment : "test.tgz"
      },
      originalUrl : "/test",
      pipe        : sandbox.stub(),
      on          : sandbox.stub()
    };
    this.res = {
      json : sandbox.stub()
    };

    this.attachFn = attachment.attach(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(attachment.attach);
  });

  it("should require content-type application/octet-stream", function () {
    this.attachFn({
      headers     : {},
      params      : { name : "test" },
      originalUrl : "/test"
    }, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 400, {
      "error"  : "wrong_content",
      "reason" : "content-type MUST be application/octet-stream"
    });
  });

  it("should create path if it doesn't exist", function () {
    sandbox.stub(fs, "existsSync").returns(false);
    sandbox.stub(fs, "mkdirSync");

    this.attachFn(this.req, this.res);
    this.req.on.yields();

    sinon.assert.called(fs.mkdirSync);
    sinon.assert.calledWith(fs.mkdirSync, "/path/test");
  });

  it("should create write stream and pipe to it", function () {
    sandbox.stub(fs, "existsSync").returns(true);
    fs.createWriteStream.returns("MY_FD");

    this.attachFn(this.req, this.res);

    sinon.assert.called(fs.createWriteStream);
    sinon.assert.calledWith(fs.createWriteStream, "/path/test/test.tgz", {
      flags    : "w",
      encoding : null,
      mode     : "0660"
    });
    sinon.assert.called(this.req.pipe);
    sinon.assert.calledWith(this.req.pipe, "MY_FD");
  });
});


// ==== Test Case

describe("attachment-test - skimTarballs", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(fs, "writeFile").yields();

    var tarball = new Buffer("I'm a tarball");
    this.tarballBase64 = tarball.toString('base64');

    this.pkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "versions": {
        "0.0.1": {
          "dist": {
            "shasum": "0dd79a57eae458d4b9cf7adc59813cdf812deef9",
            "tarball": "http://localhost:5984/test/-/test-0.0.1.tgz"
          }
        }
      },
      "_attachments": {
        "test-0.0.1.tgz": {
          "content-type": "application/octet-stream",
          "data": this.tarballBase64,
          "length": tarball.byteLength
        }
      }
    };

    this.settingsStore = {
      get : sandbox.stub()
    };
    this.settingsStore.get.withArgs("registryPath").returns("/path");
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(attachment.skimTarballs);
  });

  it("should do nothing with no attachments", function () {
    var callback = sandbox.spy();

    attachment.skimTarballs(this.settingsStore, {}, callback);

    sinon.assert.notCalled(fs.writeFile);
    sinon.assert.called(callback);
  });

  it("should create path if it doesn't exist", function () {
    sandbox.stub(fs, "existsSync").returns(false);
    sandbox.stub(fs, "mkdirSync");

    var callback = sandbox.spy();

    attachment.skimTarballs(this.settingsStore, this.pkgMeta, callback);

    sinon.assert.called(fs.mkdirSync);
    sinon.assert.calledWith(fs.mkdirSync, "/path/test");

    sinon.assert.called(callback);
  });

  it("should write tarball to disk", function () {
    sandbox.stub(fs, "existsSync").returns(true);

    var callback = sandbox.spy();

    attachment.skimTarballs(this.settingsStore, this.pkgMeta, callback);

    sinon.assert.called(fs.writeFile);
    sinon.assert.calledWith(fs.writeFile,
      "/path/test/test-0.0.1.tgz", this.tarballBase64,
      {
        flags    : "w",
        encoding : 'base64',
        mode     : "0660"
      });

    sinon.assert.called(callback);
  });

  it("should not write tarballs that have no attached data", function () {
    /*jslint nomen: true */
    sandbox.stub(fs, "existsSync").returns(true);
    var callback = sandbox.spy();
    delete this.pkgMeta._attachments["test-0.0.1.tgz"].data;

    attachment.skimTarballs(this.settingsStore, this.pkgMeta, callback);

    sinon.assert.notCalled(fs.writeFile);
    sinon.assert.called(callback);
  });
});

// ==== Test Case

describe("attachment-test - detach", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(fs, "unlinkSync");

    sandbox.stub(registry, 'setPackage');
    sandbox.stub(registry, 'getPackage');
    registry.getPackage.returns({
      "name" : "test",
      "versions" : {
        "0.0.1-dev" : {
          "dist" : {
            "tarball" : "http://localhost:5984/test/-/test-0.0.1-dev.tgz"
          }
        }
      }
    });

    this.settingsStore = {
      get : sandbox.stub()
    };
    this.settingsStore.get.withArgs("registryPath").returns("/path");

    this.req = {
      settingsStore : this.settingsStore,
      params        : {
        name       : "test",
        attachment : "test-0.0.1-dev.tgz"
      },
      originalUrl : "/test"
    };
    this.res = {
      json : sandbox.stub()
    };

    this.detachFn = attachment.detach(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(attachment.detach);
  });

  it("should delete attachment", function () {
    sandbox.stub(fs, "existsSync").returns(true);

    this.detachFn(this.req, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 200, {"ok"  : true});
    sinon.assert.called(fs.unlinkSync);
    sinon.assert.calledWith(fs.unlinkSync, "/path/test/test-0.0.1-dev.tgz");
  });

  it("should not allow '/' in attachment name", function () {
    this.req.params.attachment = "..%2Ftest-0.0.1-dev.tgz";

    this.detachFn(this.req, this.res);

    sinon.assert.called(this.res.json);
    sinon.assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "attachment not found"
    });
  });
});

// ==== Test Case

describe('attachment npm functions', function () {
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

  describe('#get', function () {
    it.skip('routes /:name/-/:attachment', function () {
      var route = {
        get    : sinon.stub(),
        put    : sinon.stub(),
        delete : sinon.stub()
      };
      route.get.returns(route);
      route.put.returns(route);
      sandbox.stub(app, 'route').returns(route);

      attachment.route(app);

      sinon.assert.calledWith(app.route, '/:name/-/:attachment');
    });

    it('retrieves attachment', function (done) {
      attachment.route(app);

      request(app)
        .get('/proxied/-/proxied-1.0.0.tgz')
        .expect('Content-Type', 'application/octet-stream')
        .expect(200, done);
    });

    it('retrieves attachment at revision', function (done) {
      attachment.route(app);

      request(app)
        .get('/proxied/-/proxied-1.0.0.tgz/-rev/1')
        .expect('Content-Type', 'application/octet-stream')
        .expect(200, done);
    });

    it('uploads attachment', function (done) {
      var filePath = path.join(__dirname, 'registry/proxied/proxied-1.0.0.tgz');
      sandbox.stub(attachment, "refreshMeta");
      sandbox.stub(registry, "setPackage");
      sandbox.stub(fs, "createWriteStream");
      fs.createWriteStream.returns({
        on    : sinon.stub(),
        once  : sinon.stub(),
        emit  : sinon.stub(),
        end   : sinon.stub(),
        write : sinon.stub()
      });

      attachment.route(app);

      request(app)
        .put('/proxied/-/proxied-1.0.0.tgz')
        .type('application/octet-stream')
        .send('test content')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(200, {
          "ok": true,
          "id": filePath,
          "rev": '1'
        }, function (err) {
          if (err) {
            return done(err);
          }

          sinon.assert.calledOnce(fs.createWriteStream);
          sinon.assert.calledWith(fs.createWriteStream, filePath);
          sinon.assert.calledOnce(attachment.refreshMeta);
          sinon.assert.calledOnce(registry.setPackage);

          done();
        });
    });

    it('deletes attachment', function (done) {
      var filePath = path.join(__dirname, 'registry/proxied/proxied-1.0.0.tgz');
      sandbox.stub(attachment, "refreshMeta");
      sandbox.stub(registry, "setPackage");
      sandbox.stub(fs, "unlinkSync");

      attachment.route(app);

      request(app)
        .del('/proxied/-/proxied-1.0.0.tgz')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(200, { "ok": true }, function (err) {
          if (err) {
            return done(err);
          }

          sinon.assert.calledOnce(fs.unlinkSync);
          sinon.assert.calledWith(fs.unlinkSync, filePath);
          sinon.assert.calledOnce(attachment.refreshMeta);
          sinon.assert.calledOnce(registry.setPackage);

          done();
        });
    });
  });
});

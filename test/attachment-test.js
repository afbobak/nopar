/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var assert = require("chai").assert;
var fs     = require("fs");
var http   = require("http");
var https  = require("https");
var path   = require("path");
var sinon  = require("sinon");

var attachment = require("../lib/attachment");

// ==== Test Case

describe("attachment-test - download", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    this.app = {
      get : sandbox.stub()
    };
    this.res = {
      download : sandbox.stub(),
      json     : sandbox.stub()
    };
    this.downloadFn = attachment.download(this.app);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(attachment.download);
  });

  it("should return package not found", function () {
    this.app.get.withArgs("registry").returns({
      getPackage : sandbox.stub().returns(null)
    });

    this.downloadFn({
      params : { packagename : "non-existant" }
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
    this.app.get.withArgs("registry").returns({
      getPackage : sandbox.stub().returns(pkgMeta)
    });
    this.app.get.withArgs("settings").returns({
      get : sandbox.stub().returns("/registryPath")
    });
    sandbox.stub(fs, "existsSync").returns(true);

    this.downloadFn({
      params : {
        packagename : "test",
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
      params : {
        packagename : "test",
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
    this.app.get.withArgs("registry").returns({
      getPackage : sandbox.stub().returns(pkgMeta)
    });
    var settings = {
      get : sandbox.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    this.app.get.withArgs("settings").returns(settings);
    sandbox.stub(http, "get").returns({
      on : sandbox.spy()
    });
    sandbox.stub(fs, "existsSync").returns(false);
    fs.existsSync.withArgs("/path/test").returns(true);

    this.downloadFn({
      params : {
        packagename : "test",
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
    this.app.get.withArgs("registry").returns({
      getPackage : sandbox.stub().returns(pkgMeta)
    });
    var settings = {
      get : sandbox.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    settings.get.withArgs("forwarder.proxy").returns("https://localhost:8080");
    settings.get.withArgs("forwarder.autoForward").returns(true);
    settings.get.withArgs("forwarder.ignoreCert").returns(true);
    settings.get.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");
    this.app.get.withArgs("settings").returns(settings);
    sandbox.stub(http, "get");
    sandbox.stub(https, "get").returns({
      on : sandbox.spy()
    });
    sandbox.stub(fs, "existsSync").returns(false);
    fs.existsSync.withArgs("/path/test").returns(true);

    this.downloadFn({
      params : {
        packagename : "test",
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
    this.app.get.withArgs("registry").returns({
      getPackage : sandbox.stub().returns(pkgMeta)
    });
    var settings = {
      get : sandbox.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    settings.get.withArgs("forwarder.proxy").returns("http://localhost:8080");
    settings.get.withArgs("forwarder.autoForward").returns(true);
    settings.get.withArgs("forwarder.ignoreCert").returns(false);
    settings.get.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");
    this.app.get.withArgs("settings").returns(settings);
    var spy = sandbox.spy();
    sandbox.stub(http, "get").returns({
      on : spy
    });
    sandbox.stub(fs, "existsSync").returns(false);
    fs.existsSync.withArgs("/path/test").returns(true);

    this.downloadFn({
      params : {
        packagename : "test",
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

    this.app = {
      get : sandbox.stub()
    };
    this.req = {
      headers     : {
        "content-type" : "application/octet-stream"
      },
      params      : {
        packagename : "test",
        attachment : "test.tgz"
      },
      originalUrl : "/test",
      pipe        : sandbox.stub(),
      on          : sandbox.stub()
    };
    this.res = {
      json : sandbox.stub()
    };

    var settings = {
      get : sandbox.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    this.app.get.withArgs("settings").returns(settings);
    this.app.get.withArgs("registry").returns({
      getPackage : sandbox.stub()
    });

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
      params      : { packagename : "test" },
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

    this.settings = {
      get : sandbox.stub()
    };
    this.settings.get.withArgs("registryPath").returns("/path");
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(attachment.skimTarballs);
  });

  it("should do nothing with no attachments", function () {
    var callback = sandbox.spy();

    attachment.skimTarballs(this.settings, {}, callback);

    sinon.assert.notCalled(fs.writeFile);
    sinon.assert.called(callback);
  });

  it("should create path if it doesn't exist", function () {
    sandbox.stub(fs, "existsSync").returns(false);
    sandbox.stub(fs, "mkdirSync");

    var callback = sandbox.spy();

    attachment.skimTarballs(this.settings, this.pkgMeta, callback);

    sinon.assert.called(fs.mkdirSync);
    sinon.assert.calledWith(fs.mkdirSync, "/path/test");

    sinon.assert.called(callback);
  });

  it("should write tarball to disk", function () {
    sandbox.stub(fs, "existsSync").returns(true);

    var callback = sandbox.spy();

    attachment.skimTarballs(this.settings, this.pkgMeta, callback);

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

    attachment.skimTarballs(this.settings, this.pkgMeta, callback);

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

    this.app = {
      get : sandbox.stub()
    };
    this.req = {
      params      : {
        packagename : "test",
        attachment  : "test-0.0.1-dev.tgz"
      },
      originalUrl : "/test"
    };
    this.res = {
      json : sandbox.stub()
    };

    var settings = {
      get : sandbox.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    this.app.get.withArgs("settings").returns(settings);
    this.app.get.withArgs("registry").returns({
      setPackage : sandbox.stub(),
      getPackage : sandbox.stub().returns({
        "name" : "test",
        "versions" : {
          "0.0.1-dev" : {
            "dist" : {
              "tarball" : "http://localhost:5984/test/-/test-0.0.1-dev.tgz"
            }
          }
        }
      })
    });

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

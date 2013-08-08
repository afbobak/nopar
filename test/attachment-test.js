/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var buster = require("buster");
var assert = buster.assertions.assert;
var refute = buster.assertions.refute;
var fs     = require("fs");
var http   = require("http");
var https  = require("https");
var path   = require("path");

var attachment = require("../lib/attachment");

// ==== Test Case

buster.testCase("attachment-test - download", {
  setUp : function () {
    this.app = {
      get : this.stub()
    };
    this.res = {
      download : this.stub(),
      json     : this.stub()
    };
    this.downloadFn = attachment.download(this.app);
  },

  "should have function": function () {
    assert.isFunction(attachment.download);
  },

  "should return package not found": function () {
    this.app.get.withArgs("registry").returns({
      getPackage : this.stub().returns(null)
    });

    this.downloadFn({
      params : { packagename : "non-existant" }
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "package not found"
    });
  },

  "should return package": function () {
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
      getPackage : this.stub().returns(pkgMeta)
    });
    this.app.get.withArgs("settings").returns({
      get : this.stub().returns("/registryPath")
    });
    this.stub(fs, "existsSync").returns(true);

    this.downloadFn({
      params : {
        packagename : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    assert.calledOnce(this.res.download);
    assert.calledWith(
      this.res.download,
      path.join("/registryPath", "test", "test-0.0.1-dev.tgz"),
      "test-0.0.1-dev.tgz"
    );
  },

  "should not return invalid files": function () {
    this.stub(fs, "existsSync");

    // http://localhost:5984/abstrakt-npm-proxy/-/..%2Fregistry.json
    this.downloadFn({
      params : {
        packagename : "test",
        attachment : "../invalidFile.json"
      }
    }, this.res);

    refute.calledWith(fs.existsSync, "/path/invalidFile.json");
    assert.called(this.res.json);
    assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "attachment not found"
    });
  },

  "should download attachment from forwarder and mark as cached": function () {
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
      getPackage : this.stub().returns(pkgMeta)
    });
    var settings = {
      get : this.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    this.app.get.withArgs("settings").returns(settings);
    this.stub(http, "get").returns({
      on : this.spy()
    });
    this.stub(fs, "existsSync").returns(false);
    fs.existsSync.withArgs("/path/test").returns(true);

    this.downloadFn({
      params : {
        packagename : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    assert.calledWith(fs.existsSync, "/path/test/test-0.0.1-dev.tgz");
    refute.called(this.res.json);
    assert.called(http.get);
    assert.calledWith(http.get, "http://fwd.url/pkg.tgz");
    //TODO pkgMeta._attachments["test-0.0.1-dev.tgz"].cached = true;
    //assert.calledWith(registry.setPackage, pkgMeta);
  },

  "should download attachment from forwarder via proxy": function () {
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
      getPackage : this.stub().returns(pkgMeta)
    });
    var settings = {
      get : this.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    settings.get.withArgs("forwarder.proxy").returns("https://localhost:8080");
    settings.get.withArgs("forwarder.autoForward").returns(true);
    settings.get.withArgs("forwarder.ignoreCert").returns(true);
    settings.get.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");
    this.app.get.withArgs("settings").returns(settings);
    this.stub(http, "get");
    this.stub(https, "get").returns({
      on : this.spy()
    });
    this.stub(fs, "existsSync").returns(false);
    fs.existsSync.withArgs("/path/test").returns(true);

    this.downloadFn({
      params : {
        packagename : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    assert.calledWith(fs.existsSync, "/path/test/test-0.0.1-dev.tgz");
    refute.called(http.get);
    assert.called(https.get);
    assert.calledWith(https.get, {
      headers  : {
        host         : "fwd.url",
        "User-Agent" : "nopar/0.0.0-test"
      },
      hostname : "localhost",
      port     : "8080",
      path     : "http://fwd.url/pkg.tgz",
      rejectUnauthorized : false
    });
  },

  "should catch error events from http": function () {
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
      getPackage : this.stub().returns(pkgMeta)
    });
    var settings = {
      get : this.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    settings.get.withArgs("forwarder.proxy").returns("http://localhost:8080");
    settings.get.withArgs("forwarder.autoForward").returns(true);
    settings.get.withArgs("forwarder.ignoreCert").returns(false);
    settings.get.withArgs("forwarder.userAgent").returns("nopar/0.0.0-test");
    this.app.get.withArgs("settings").returns(settings);
    var spy = this.spy();
    this.stub(http, "get").returns({
      on : spy
    });
    this.stub(fs, "existsSync").returns(false);
    fs.existsSync.withArgs("/path/test").returns(true);

    this.downloadFn({
      params : {
        packagename : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    assert.calledOnce(http.get);
    assert.calledOnce(spy);
    assert.calledWith(spy, "error");
  }
});


// ==== Test Case

buster.testCase("attachment-test - attach", {
  setUp: function () {
    this.stub(fs, "createWriteStream");

    this.app = {
      get : this.stub()
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
      pipe        : this.stub(),
      on          : this.stub()
    };
    this.res = {
      json : this.stub()
    };

    var settings = {
      get : this.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    this.app.get.withArgs("settings").returns(settings);
    this.app.get.withArgs("registry").returns({
      getPackage : this.stub()
    });

    this.attachFn = attachment.attach(this.app);
  },

  "should have function": function () {
    assert.isFunction(attachment.attach);
  },

  "should require content-type application/json": function () {
    this.attachFn({
      headers     : {},
      params      : { packagename : "test" },
      originalUrl : "/test"
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 400, {
      "error"  : "wrong_content",
      "reason" : "content-type MUST be application/octet-stream"
    });
  },

  "should create path if it doesn't exist": function () {
    this.stub(fs, "existsSync").returns(false);
    this.stub(fs, "mkdirSync");

    this.attachFn(this.req, this.res);
    this.req.on.yields();

    assert.called(fs.mkdirSync);
    assert.calledWith(fs.mkdirSync, "/path/test");
  },

  "should create write stream and pipe to it": function () {
    this.stub(fs, "existsSync").returns(true);
    fs.createWriteStream.returns("MY_FD");

    this.attachFn(this.req, this.res);

    assert.called(fs.createWriteStream);
    assert.calledWith(fs.createWriteStream, "/path/test/test.tgz", {
      flags    : "w",
      encoding : null,
      mode     : "0660"
    });
    assert.called(this.req.pipe);
    assert.calledWith(this.req.pipe, "MY_FD");
  }
});

// ==== Test Case

buster.testCase("attachment-test - detach", {
  setUp: function () {
    this.stub(fs, "unlinkSync");

    this.app = {
      get : this.stub()
    };
    this.req = {
      params      : {
        packagename : "test",
        attachment  : "test-0.0.1-dev.tgz"
      },
      originalUrl : "/test"
    };
    this.res = {
      json : this.stub()
    };

    var settings = {
      get : this.stub()
    };
    settings.get.withArgs("registryPath").returns("/path");
    this.app.get.withArgs("settings").returns(settings);
    this.app.get.withArgs("registry").returns({
      setPackage : this.stub(),
      getPackage : this.stub().returns({
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
  },

  "should have function": function () {
    assert.isFunction(attachment.detach);
  },

  "should delete attachment": function () {
    this.stub(fs, "existsSync").returns(true);

    this.detachFn(this.req, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, {"ok"  : true});
    assert.called(fs.unlinkSync);
    assert.calledWith(fs.unlinkSync, "/path/test/test-0.0.1-dev.tgz");
  },

  "should not allow '/' in attachment name": function () {
    this.req.params.attachment = "..%2Ftest-0.0.1-dev.tgz";

    this.detachFn(this.req, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "attachment not found"
    });
  }
});

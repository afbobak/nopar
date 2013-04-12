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

var registry = require("../lib/registry");

var findCall = require("./helpers").findCall;

function initRegistry(self) {
  self.server.set("registryPath", "/path");
  self.server.set("forwarder", {
    registry    : "https://registry.bla.org",
    autoForward : true
  });

  self.stub(fs, "existsSync");
  self.stub(fs, "readFileSync");
  self.stub(fs, "mkdirSync");
  self.stub(fs, "writeFileSync");

  fs.existsSync.returns(true); // default to true

  self.stub(registry, "init");
  self.stub(registry, "getPackage");
  self.stub(registry, "setPackage");
}

// ==== Test Case

buster.testCase("attachment-test - GET /:packagename/-/:attachment", {
  setUp: function () {
    this.server = require("../lib/server");
    this.server.set("registry", registry);
    initRegistry(this);
    this.call = findCall(this.server.routes.get, "/:packagename/-/:attachment");
    this.res = {
      json     : this.stub(),
      download : this.stub()
    };
  },

  tearDown: function () {
    registry.destroy();
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/-/:attachment");
  },

  "should return package not found": function () {
    fs.existsSync.withArgs("/path/non-existant").returns(false);

    this.call.callbacks[0]({
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
    registry.getPackage.returns(pkgMeta);

    this.call.callbacks[0]({
      params : {
        packagename : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    assert.calledOnce(this.res.download);
    assert.calledWith(
      this.res.download,
      path.join(this.server.get("registryPath"), "test", "test-0.0.1-dev.tgz"),
      "test-0.0.1-dev.tgz"
    );
  },

  "should not return invalid files": function () {
    // http://localhost:5984/abstrakt-npm-proxy/-/..%2Fregistry.json
    this.call.callbacks[0]({
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

  "should download attachment from forwarder": function () {
    this.stub(http, "get");
    fs.existsSync.returns(false);
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
      "_fwd-dists" : { "test-0.0.1-dev.tgz" : "http://fwd.url/pkg.tgz" }
    };
    registry.getPackage.returns(pkgMeta);

    this.call.callbacks[0]({
      params : {
        packagename : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    assert.calledWith(fs.existsSync, "/path/test/test-0.0.1-dev.tgz");
    refute.called(this.res.json);
    assert.called(http.get);
    assert.calledWith(http.get, "http://fwd.url/pkg.tgz");
  },

  "should download attachment from forwarder via proxy": function () {
    this.stub(http, "get");
    this.stub(https, "get");
    fs.existsSync.returns(false);
    this.server.set("forwarder", {
      proxy       : "https://localhost:8080",
      autoForward : true,
      userAgent   : "nopar/0.0.0-test"
    });
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
      "_fwd-dists" : { "test-0.0.1-dev.tgz" : "http://fwd.url/pkg.tgz" }
    };
    registry.getPackage.returns(pkgMeta);

    this.call.callbacks[0]({
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
      path     : "http://fwd.url/pkg.tgz"
    });
  }
});


// ==== Test Case

buster.testCase("attachment-test - PUT /:packagename/-/:attachment", {
  setUp: function () {
    this.stub(fs, "createWriteStream");

    this.server = require("../lib/server");
    this.server.set("registry", registry);
    initRegistry(this);
    this.call = findCall(this.server.routes.put,
      "/:packagename/-/:attachment/-rev?/:revision?");
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
  },

  tearDown: function () {
    registry.destroy();
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/-/:attachment/-rev?/:revision?");
  },

  "should require content-type application/json": function () {
    this.call.callbacks[0]({
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
    fs.existsSync.returns(false);

    this.call.callbacks[0](this.req, this.res);
    this.req.on.yields();

    assert.called(fs.existsSync);
    assert.calledWith(
      fs.existsSync,
      path.join(this.server.get("registryPath"), "test")
    );
  },

  "should create write stream and pipe to it": function () {
    fs.existsSync.returns(true);
    fs.createWriteStream.returns("MY_FD");

    this.call.callbacks[0](this.req, this.res);

    assert.called(fs.createWriteStream);
    assert.calledWith(
      fs.createWriteStream,
      path.join(this.server.get("registryPath"), "test", "test.tgz"),
      {
        flags    : "w",
        encoding : null,
        mode     : "0660"
      }
    );
    assert.called(this.req.pipe);
    assert.calledWith(this.req.pipe, "MY_FD");
  }
});

// ==== Test Case

buster.testCase("attachment-test - DELETE /:packagename/-/:attachment", {
  setUp: function () {
    this.stub(fs, "unlinkSync");

    this.server = require("../lib/server");
    this.server.set("registry", registry);
    initRegistry(this);

    registry.getPackage.withArgs("test").returns({
      "name" : "test",
      "versions" : {
        "0.0.1-dev" : {
          "dist" : {
            "tarball" : "http://localhost:5984/test/-/test-0.0.1-dev.tgz"
          }
        }
      }
    });

    this.call = findCall(this.server.routes["delete"],
      "/:packagename/-/:attachment/-rev?/:revision?");
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
  },

  tearDown: function () {
    registry.destroy();
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/-/:attachment/-rev?/:revision?");
  },

  "should delete attachment": function () {
    this.call.callbacks[0](this.req, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, {"ok"  : true});
    assert.called(fs.unlinkSync);
    assert.calledWith(
      fs.unlinkSync,
      path.join(this.server.get("registryPath"), "test", "test-0.0.1-dev.tgz")
    );
  },

  "should not allow '/' in attachment name": function () {
    this.req.params.attachment = "..%2Ftest-0.0.1-dev.tgz";

    this.call.callbacks[0](this.req, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "attachment not found"
    });
  }
});

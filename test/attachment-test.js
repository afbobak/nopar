/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var buster = require("buster");
var assert = buster.assertions.assert;
var refute = buster.assertions.refute;
var fs     = require("fs");
var http   = require("http");
var path   = require("path");

// ==== Test Case

buster.testCase("attachment-test - GET /:packagename/-/:attachment", {
  setUp: function () {
    this.stub(fs, "mkdirSync");
    this.stub(fs, "existsSync");
    this.server = require("../lib/server");
    this.call = this.server.routes.get[3];
    this.res = {
      json     : this.stub(),
      download : this.stub()
    };
  },

  tearDown: function () {
    this.server.set("registry", {});
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/-/:attachment");
  },

  "should return package not found": function () {
    fs.existsSync.returns(false);

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
    fs.existsSync.returns(true);
    var registry = {
      "test" : {
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
      }
    };
    this.server.set("registry", JSON.parse(JSON.stringify(registry)));
    this.call.callbacks[0]({
      params : {
        packagename : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    assert.called(this.res.download);
    assert.calledWith(
      this.res.download,
      path.join(this.server.get("registryPath"), "test", "test-0.0.1-dev.tgz"),
      "test-0.0.1-dev.tgz"
    );
  },

  "should not return invalid files": function () {
    // http://localhost:5984/abstrakt-npm-proxy/-/..%2Fregistry.json
    var registry = {
      "test" : {
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
      }
    };
    this.server.set("registry", JSON.parse(JSON.stringify(registry)));

    this.call.callbacks[0]({
      params : {
        packagename : "test",
        attachment : "../registry.json"
      }
    }, this.res);

    refute.called(fs.existsSync);
    assert.called(this.res.json);
    assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "attachment not found"
    });
  },

  "should download attachment from forwarder": function () {
    this.stub(http, "get");
    fs.existsSync.returns(false);
    var registry = {
      "test" : {
        "_fwd-dists" : { "test-0.0.1-dev.tgz" : "http://fwd.url/pkg.tgz" },
        "versions" : {
          "0.0.1-dev" : {
            "dist" : {
              "tarball" : "test-0.0.1-dev.tgz"
            }
          }
        }
      }
    };
    this.server.set("registry", JSON.parse(JSON.stringify(registry)));

    this.call.callbacks[0]({
      params : {
        packagename : "test",
        attachment : "test-0.0.1-dev.tgz"
      }
    }, this.res);

    assert.called(fs.existsSync);
    assert.called(http.get);
    assert.calledWith(http.get, "http://fwd.url/pkg.tgz");
  }
});


// ==== Test Case

buster.testCase("attachment-test - PUT /:packagename/-/:attachment", {
  setUp: function () {
    this.stub(fs, "existsSync");
    this.stub(fs, "mkdirSync");
    this.stub(fs, "createWriteStream");

    this.server = require("../lib/server");
    this.call = this.server.routes.put[4];
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
    this.server.set("registry", {});
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
    this.stub(fs, "mkdirSync");
    this.stub(fs, "existsSync");
    this.stub(fs, "unlinkSync");

    this.server = require("../lib/server");

    this.server.set("registry", {
      "test" : {
        "versions" : {
          "0.0.1-dev" : {
            "dist" : {
              "tarball" : "http://localhost:5984/test/-/test-0.0.1-dev.tgz"
            }
          }
        }
      }
    });

    this.call = this.server.routes["delete"][1];
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
    this.server.set("registry", {});
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/-/:attachment/-rev?/:revision?");
  },

  "should delete attachment": function () {
    fs.existsSync.returns(true);

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

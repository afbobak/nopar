/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var buster = require("buster");
var assert = buster.assertions.assert;
var refute = buster.assertions.refute;
var fs     = require("fs");
var path   = require("path");

// ==== Test Case

buster.testCase("server-GET /", {
  setUp: function () {
    this.stub(fs, "mkdirSync");
    this.server = require("../lib/server");
    this.server.set("registry", {});
    this.server.set("forwarder", {});
    this.call = this.server.routes.get[0];
    this.res = {
      render : this.stub()
    };
  },

  "should have route": function () {
    assert.equals(this.call.path, "/");
  },

  "should return package name@version": function () {
    this.call.callbacks[0]({}, this.res);

    assert.called(this.res.render);
    assert.calledWith(this.res.render, "index");
  }
});

// ==== Test Case

buster.testCase("server-GET /:packagename", {
  setUp: function () {
    this.stub(fs, "mkdirSync");
    this.server = require("../lib/server");
    this.server.set("forwarder", {});
    this.call = this.server.routes.get[1];
    this.res = {
      json : this.stub()
    };
  },

  tearDown: function () {
    this.server.set("registry", {});
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/:version?");
  },

  "should return package not found": function () {
    this.call.callbacks[0]({
      params : { packagename : "non-existant" }
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  },

  "should return full package": function () {
    var registry = { pkg : { a : "b" } };
    this.server.set("registry", registry);
    this.call.callbacks[0]({
      params : { packagename : "pkg" }
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, registry.pkg);
  },

  "should return package version not found": function () {
    var registry = {
      pkg : {
        versions : {
          "0.0.1" : {
            "name"  : "pkg",
            version : "0,0.1"
          }
        }
      }
    };
    this.server.set("registry", registry);

    this.call.callbacks[0]({
      params : {
        packagename : "pkg",
        version : "0.0.2"
      }
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  },

  "should return specific package version": function () {
    var registry = {
      pkg : {
        versions : {
          "0.0.1" : {
            "name"  : "pkg",
            version : "0,0.1"
          }
        }
      }
    };
    this.server.set("registry", registry);

    this.call.callbacks[0]({
      params : {
        packagename : "pkg",
        version     : "0.0.1"
      }
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, registry.pkg.versions["0.0.1"]);
  }
});

// ==== Test Case

buster.testCase("server-PUT /:packagename", {
  setUp: function () {
    this.stub(fs, "mkdirSync");
    this.stub(fs, "writeFileSync");
    this.server = require("../lib/server");
    this.call = this.server.routes.put[0];
    this.callRev = this.server.routes.put[1];
    this.res = {
      json : this.stub()
    };
  },

  tearDown: function () {
    this.server.set("registry", {});
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename");
    assert.equals(this.callRev.path, "/:packagename/-rev/:revision");
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
      "reason" : "content-type MUST be application/json"
    });
  },

  "should add package and persist registry for new package": function () {
    this.server.set("registry", {});

    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test",
      body        : {
        "_id"  : "test",
        "name" : "test"
      }
    }, this.res);

    var expectedRegistry = {
      "test" : {
        "_id"  : "test",
        "name" : "test",
        "_rev" : 0
      }
    };
    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, {"ok" : true});
    assert.equals(this.server.get("registry"), expectedRegistry);
    assert.called(fs.writeFileSync);
    assert.calledWith(
      fs.writeFileSync,
      path.join(this.server.get("registryPath"), "registry.json"),
      JSON.stringify(expectedRegistry)
    );
  },

  "should bounce with 409 when package already exists": function () {
    this.server.set("registry", {
      "test" : {
        "_id"  : "test",
        "_rev" : 1,
        "name" : "test"
      }
    });

    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test",
      body        : {
        "_id"  : "test",
        "name" : "test"
      }
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 409, {
      "error"  : "conflict",
      "reason" : "must supply latest _rev to update existing package"
    });
  },

  "should update package and persist registry": function () {
    var expectedRegistry = {
      "test" : {
        "_id"  : "test",
        "name" : "test",
        "_rev" : 2,
        "versions" : {
          "0.0.2" : {}
        }
      }
    };
    this.server.set("registry", {
      "test" : {
        "_id"  : "test",
        "name" : "test",
        "_rev" : 2,
        "versions" : {
          "0.0.1" : {},
          "0.0.2" : {}
        }
      }
    });

    this.callRev.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test", revision : 2 },
      originalUrl : "/test",
      body        : expectedRegistry.test
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, {"ok" : true});
    assert.equals(this.server.get("registry"), expectedRegistry);
    assert.called(fs.writeFileSync);
    assert.calledWith(
      fs.writeFileSync,
      path.join(this.server.get("registryPath"), "registry.json"),
      JSON.stringify(expectedRegistry)
    );
  },

  "should keep old version": function () {
    var registry = {
      "test" : {
        "dist-tags" : {
          "latest" : "0.0.1-dev"
        },
        "versions" : {
          "0.0.1-dev" : {
          }
        }
      }
    };
    this.server.set("registry", JSON.parse(JSON.stringify(registry)));

    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test"
    }, this.res);

    assert.equals(this.server.get("registry"), registry);
  }
});

// ==== Test Case

buster.testCase("server-GET /:packagename/-/:attachment", {
  setUp: function () {
    this.stub(fs, "mkdirSync");
    this.stub(fs, "existsSync");
    this.server = require("../lib/server");
    this.call = this.server.routes.get[2];
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
  }
});

// ==== Test Case

buster.testCase("server-PUT /:packagename/:version", {
  setUp: function () {
    this.stub(fs, "mkdirSync");
    this.stub(fs, "writeFileSync");
    this.server = require("../lib/server");
    this.call = this.server.routes.put[2];
    this.res = {
      json : this.stub()
    };
  },

  tearDown: function () {
    this.server.set("registry", {});
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/:version/-tag?/:tagname?");
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
      "reason" : "content-type MUST be application/json"
    });
  },

  "should create empty package": function () {
    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : "test",
        version     : "0.0.1-dev"
      },
      originalUrl : "/test/0.0.1-dev"
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, "\"0.0.1-dev\"");
    assert.equals(
      this.server.get("registry"),
      {"test" : { "_rev": 1, "versions" : { "0.0.1-dev" : {} }}}
    );
    assert.called(fs.writeFileSync);
    assert.calledWith(
      fs.writeFileSync,
      path.join(this.server.get("registryPath"), "registry.json")
    );
  },

  "should add tag and return latest version number in body": function () {
    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : "test",
        version     : "0.0.1-dev",
        tagname     : "latest"
      },
      originalUrl : "/test/0.0.1-dev/-tag/latest"
    }, this.res);

    var registry = this.server.get("registry");
    assert.equals(registry.test["dist-tags"], {"latest" : "0.0.1-dev"});
    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, "\"0.0.1-dev\"");
  }
});

// ==== Test Case

buster.testCase("server-PUT /:packagename/-/:attachment", {
  setUp: function () {
    this.stub(fs, "existsSync");
    this.stub(fs, "mkdirSync");
    this.stub(fs, "createWriteStream");

    this.server = require("../lib/server");
    this.call = this.server.routes.put[3];
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

buster.testCase("server-DELETE /:packagename", {
  setUp: function () {
    this.stub(fs, "mkdirSync");
    this.stub(fs, "writeFileSync");
    this.stub(fs, "unlinkSync");
    this.stub(fs, "rmdirSync");

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

    this.call = this.server.routes["delete"][0];
    this.req = {
      params      : {
        packagename : "test"
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
    assert.equals(this.call.path, "/:packagename/-rev?/:revision?");
  },

  "should remove package from registry and persist registry": function () {
    this.call.callbacks[0](this.req, this.res);

    var registry = this.server.get("registry");
    refute.defined(registry.test);
    assert.called(fs.writeFileSync);
    assert.calledWith(
      fs.writeFileSync,
      path.join(this.server.get("registryPath"), "registry.json")
    );
  },

  "should delete attachments and folders": function () {
    this.call.callbacks[0](this.req, this.res);

    assert.called(fs.unlinkSync);
    assert.calledWith(
      fs.unlinkSync,
      path.join(this.server.get("registryPath"), "test", "test-0.0.1-dev.tgz")
    );
    assert.called(fs.rmdirSync);
    assert.calledWith(
      fs.rmdirSync,
      path.join(this.server.get("registryPath"), "test")
    );
  }
});

// ==== Test Case

buster.testCase("server-DELETE /:packagename/-/:attachment", {
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

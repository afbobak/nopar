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

var registry = require("../lib/registry");

var findCall = require("./helpers").findCall;

function initRegistry(self) {
  self.stub(fs, "existsSync");
  self.stub(fs, "readFileSync");
  self.stub(fs, "mkdirSync");
  self.stub(fs, "writeFileSync");
  self.stub(registry, "refreshMeta");

  fs.existsSync.returns(true); // default to true
  fs.existsSync.withArgs("/path").returns(true);
  fs.existsSync.withArgs("/path/registry.json").returns(true);
  fs.readFileSync.withArgs("/path/registry.json").
    returns(JSON.stringify({version: "1.0.0"}));

  registry.init("/path");
}

// ==== Test Case

buster.testCase("pkg-test - GET /:packagename", {
  setUp: function () {
    this.server = require("../lib/server");
    this.server.set("forwarder", {});
    this.server.set("registry", registry);
    initRegistry(this);
    this.call = findCall(this.server.routes.get, "/:packagename/:version?");
    this.res = {
      json : this.stub()
    };
  },

  tearDown: function () {
    registry.destroy();
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/:version?");
  },

  "should return package not found": function () {
    fs.existsSync.withArgs("/path/non-existant").returns(false);

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
    var pkgMeta = { a : "b" };
    fs.readFileSync.withArgs("/path/pkg/pkg.json").
      returns(JSON.stringify(pkgMeta));

    this.call.callbacks[0]({
      params : { packagename : "pkg" }
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, pkgMeta);
  },

  "should return package version not found": function () {
    var pkgMeta = {
      versions : {
        "0.0.1" : {
          "name"  : "pkg",
          version : "0,0.1"
        }
      }
    };
    fs.readFileSync.withArgs("/path/pkg/pkg.json").
      returns(JSON.stringify(pkgMeta));

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
    var pkgMeta = {
      versions : {
        "0.0.1" : {
          "name"  : "pkg",
          version : "0,0.1"
        }
      }
    };
    fs.readFileSync.withArgs("/path/pkg/pkg.json").
      returns(JSON.stringify(pkgMeta));

    this.call.callbacks[0]({
      params : {
        packagename : "pkg",
        version     : "0.0.1"
      }
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, pkgMeta.versions["0.0.1"]);
  },

  "should get full package JSON from forwarder": function () {
    fs.existsSync.withArgs("/path/fwdpkg").returns(false);
    this.stub(http, "get").returns({on : this.spy()});
    this.server.set("forwarder", {
      registry    : "http://u.url:8888/the/path/",
      autoForward : true,
      userAgent   : "nopar/0.0.0-test"
    });

    this.call.callbacks[0]({
      params : {
        packagename : "fwdpkg",
        version     : "0.0.1"
      }
    }, this.res);

    assert.called(http.get);
    assert.calledWith(http.get, {
      headers  : { "User-Agent" : "nopar/0.0.0-test" },
      hostname : "u.url",
      port     : "8888",
      path     : "/the/path/fwdpkg"
    });
  },

  "should get full package JSON from forwarder via proxy": function () {
    fs.existsSync.withArgs("/path/fwdpkg").returns(false);
    this.stub(http, "get").returns({on : this.spy()});
    this.server.set("forwarder", {
      registry    : "http://u.url:8888/the/path/",
      proxy       : "http://localhost:8080",
      autoForward : true,
      userAgent   : "nopar/0.0.0-test"
    });

    this.call.callbacks[0]({
      params : {
        packagename : "fwdpkg",
        version     : "0.0.1"
      }
    }, this.res);

    assert.called(http.get);
    assert.calledWith(http.get, {
      headers  : {
        host         : "u.url",
        "User-Agent" : "nopar/0.0.0-test"
      },
      hostname : "localhost",
      port     : "8080",
      path     : "http://u.url:8888/the/path/fwdpkg"
    });
  },

  "should not get package from forwarder": function () {
    fs.existsSync.withArgs("/path/fwdpkg").returns(false);
    this.stub(http, "get").returns({on : this.spy()});
    this.server.set("forwarder", {
      registry    : "http://u.url/the/path/",
      autoForward : false
    });

    this.call.callbacks[0]({
      params : {
        packagename : "fwdpkg",
        version     : "0.0.1"
      }
    }, this.res);

    refute.called(http.get);
    assert.called(this.res.json);
    assert.calledWith(this.res.json, 404, {
      "error"  : "not_found",
      "reason" : "document not found"
    });
  },

  "should rewrite attachment urls and create fwd url map": function () {
    /*jslint nomen: true*/
    fs.existsSync.withArgs("/path/fwdpkg").returns(false);
    this.stub(http, "get").returns({on : this.spy()});
    this.server.set("forwarder", {
      registry    : "http://u.url/the/path/",
      autoForward : true
    });
    var on = this.stub();
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

    this.call.callbacks[0]({
      params : {
        packagename : "fwdpkg",
        version     : "0.0.1"
      }
    }, this.res);
    http.get["yield"]({
      statusCode  : 200,
      setEncoding : this.spy(),
      on          : on
    });

    assert.called(on);
    assert.calledWith(on, "data");
    assert.calledWith(on, "end");

    pkgMeta.versions["0.0.1"].dist.tarball =
      "http://localhost:5984/fwdpkg/-/fwdpkg-0.0.1.tgz";
    pkgMeta._attachments = {
      "fwdpkg-0.0.1.tgz" : {
        "cached"     : true,
        "forwardUrl" : "http://registry.npmjs.org/fwdpkg/-/fwdpkg-0.0.1.tgz"
      }
    };

    assert.calledOnceWith(fs.writeFileSync, "/path/fwdpkg/fwdpkg.json",
      JSON.stringify(pkgMeta));
  }

});

// ==== Test Case

buster.testCase("pkg-test - PUT /:packagename", {
  setUp: function () {
    this.server = require("../lib/server");
    this.stub(require("../lib/attachment"), "refreshMeta");
    this.server.set("registry", registry);
    initRegistry(this);
    this.call = findCall(this.server.routes.put, "/:packagename");
    this.callRev = findCall(this.server.routes.put, "/:packagename/-rev/:revision");
    this.res = {
      json : this.stub()
    };
  },

  tearDown: function () {
    registry.destroy();
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
    fs.existsSync.withArgs("/path/test").returns(false);

    this.call.callbacks[0]({
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
      "_rev"     : 0,
      "_proxied" : false
    };
    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, {"ok" : true});
    assert.called(fs.writeFileSync);
    assert.calledWith(fs.writeFileSync, "/path/test/test.json", JSON.stringify(pkgMeta));
  },

  "should bounce with 409 when package already exists": function () {
    var pkgMeta = {
      "_id"  : "test",
      "_rev" : 1,
      "name" : "test"
    };
    fs.readFileSync.withArgs("/path/test/test.json").returns(JSON.stringify(pkgMeta));

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

  "should bounce with 409 if document revision doesn't match": function () {
    var pkgMeta = {
      "_id"  : "test",
      "_rev" : 2,
      "name" : "test"
    };
    fs.readFileSync.withArgs("/path/test/test.json").returns(JSON.stringify(pkgMeta));

    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test", revision: 1 },
      originalUrl : "/test",
      body        : {
        "_id"  : "test",
        "name" : "test"
      }
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 409, {
      "error"  : "conflict",
      "reason" : "revision does not match one in document"
    });
  },

  "should update package and persist registry": function () {
    var pkgMeta = {
      "_id"  : "test",
      "name" : "test",
      "_rev" : 2,
      "versions" : {
        "0.0.1" : {},
        "0.0.2" : {}
      }
    };
    fs.readFileSync.withArgs("/path/test/test.json").returns(JSON.stringify(pkgMeta));
    delete pkgMeta.versions["0.0.1"];

    this.callRev.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test", revision : 2 },
      originalUrl : "/test",
      body        : pkgMeta
    }, this.res);

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, {"ok" : true});
    assert.called(fs.writeFileSync);
    assert.calledWith(fs.writeFileSync, "/path/test/test.json", JSON.stringify(pkgMeta));
  },

  "should keep old version": function () {
    fs.readFileSync.withArgs("/path/test/test.json").returns(JSON.stringify({}));

    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : { packagename : "test" },
      originalUrl : "/test"
    }, this.res);

    refute.called(fs.writeFileSync);
  }
});


// ==== Test Case

buster.testCase("pkg-test - PUT /:packagename/:version", {
  setUp: function () {
    this.server = require("../lib/server");
    this.server.set("registry", registry);
    this.stub(require("../lib/attachment"), "refreshMeta");
    initRegistry(this);
    this.call = findCall(this.server.routes.put, "/:packagename/:version/-tag?/:tagname?");
    this.res = {
      json : this.stub()
    };
  },

  tearDown: function () {
    registry.destroy();
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

  "should create new package and bounce revision": function () {
    /*jslint nomen: true*/
    var pkgMeta = {
      name       : "test",
      "_rev"     : 1,
      "_proxied" : false,
      versions   : {
        "0.0.1-dev" : {}
      }
    };
    fs.readFileSync.withArgs("/path/test/test.json").returns(JSON.stringify(pkgMeta));

    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : "test",
        version     : "0.0.1-dev"
      },
      originalUrl : "/test/0.0.1-dev"
    }, this.res);

    pkgMeta._rev++;

    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, "\"0.0.1-dev\"");
    assert.calledOnce(fs.writeFileSync);
    assert.calledWith(fs.writeFileSync, "/path/test/test.json", JSON.stringify(pkgMeta));
  },

  "should reset revision if it's a checksum": function () {
    /*jslint nomen: true*/
    var pkgMeta = {
      name       : "test",
      "_rev"     : "011f2254e3def8ab3023052072195e1a",
      "_proxied" : false,
      versions   : {
        "0.0.1-dev" : {}
      }
    };
    fs.readFileSync.withArgs("/path/test/test.json").returns(JSON.stringify(pkgMeta));

    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : "test",
        version     : "0.0.1-dev"
      },
      originalUrl : "/test/0.0.1-dev"
    }, this.res);

    pkgMeta._rev = 0;

    assert.calledOnce(fs.writeFileSync);
    assert.calledWith(fs.writeFileSync, "/path/test/test.json", JSON.stringify(pkgMeta));
  },

  "should add tag and return latest version number in body": function () {
    fs.existsSync.withArgs("/path/test/test.json").returns(false);

    this.call.callbacks[0]({
      headers     : { "content-type" : "application/json" },
      params      : {
        packagename : "test",
        version     : "0.0.1-dev",
        tagname     : "latest"
      },
      originalUrl : "/test/0.0.1-dev/-tag/latest"
    }, this.res);

    var pkgMeta = {
      name       : "test",
      "_rev"     : 1,
      versions   : {
        "0.0.1-dev" : {}
      },
      "dist-tags" : {
        latest : "0.0.1-dev"
      },
      "_proxied" : false
    };

    assert.calledOnce(fs.writeFileSync);
    assert.calledWith(fs.writeFileSync, "/path/test/test.json", JSON.stringify(pkgMeta));
    assert.called(this.res.json);
    assert.calledWith(this.res.json, 200, "\"0.0.1-dev\"");
  }
});


// ==== Test Case

buster.testCase("pkg-test - PUT /:packagename/:tagname", {
  setUp: function () {
    this.server = require("../lib/server");
    this.server.set("registry", registry);
    initRegistry(this);
    this.call = findCall(this.server.routes.put, "/:packagename/:tagname");
    this.res = {
      json : this.stub()
    };
  },

  tearDown: function () {
    registry.destroy();
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/:tagname");
  },

  "should add tag and return 201 latest package json": function () {
    /*jslint nomen: true*/
    fs.existsSync.withArgs("/path/test/test.json").returns(true);
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
    fs.readFileSync.withArgs("/path/test/test.json").returns(JSON.stringify(pkgMeta));

    this.call.callbacks[0]({
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

    assert.calledOnce(fs.writeFileSync);
    assert.calledWith(fs.writeFileSync, "/path/test/test.json", JSON.stringify(pkgMeta));
    assert.called(this.res.json);
    assert.calledWith(this.res.json, 201, pkgMeta);
  }
});


// ==== Test Case

buster.testCase("pkg-test - DELETE /:packagename", {
  setUp: function () {
    this.stub(fs, "unlinkSync");
    this.stub(fs, "rmdirSync");

    this.server = require("../lib/server");
    this.server.set("registryPath", "/path");
    this.server.set("registry", registry);
    initRegistry(this);

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
    fs.readFileSync.withArgs("/path/test/test.json").returns(JSON.stringify(pkgMeta));

    this.call = findCall(this.server.routes["delete"], "/:packagename/-rev?/:revision?");
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
    registry.destroy();
  },

  "should have route": function () {
    assert.equals(this.call.path, "/:packagename/-rev?/:revision?");
  },

  "should delete package meta, attachments and folder": function () {
    this.call.callbacks[0](this.req, this.res);

    assert.calledTwice(fs.unlinkSync);
    assert.calledWith(fs.unlinkSync, "/path/test/test-0.0.1-dev.tgz");
    assert.calledWith(fs.unlinkSync, "/path/test/test.json");

    assert.called(fs.rmdirSync);
    assert.calledWith(
      fs.rmdirSync,
      path.join(this.server.get("registryPath"), "test")
    );
  }
});

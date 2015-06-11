/*jslint devel: true, node: true, nomen: true */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var assert = require("chai").assert;
var fs     = require("fs");
var path   = require("path");
var sinon  = require("sinon");

var registry = require("../lib/registry");

var REGISTRY_PATH = "/some/path/registry";
var OLD_META = {
  pkg : {
    "dist-tags" : { "latest" : "0.0.1" },
    versions : {
      "0.0.1" : {
        "name"  : "pkg",
        version : "0.0.1"
      },
      "0.0.2" : {
        "name"  : "pkg",
        version : "0.0.2"
      }
    }
  },
  scopedPkg : {
    "dist-tags" : { "latest" : "0.0.1" },
    versions : {
      "0.0.1" : {
        "name"  : "@scoped/pkg",
        version : "0.0.1"
      }
    }
  }
};
var metaVersion = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"))).version;

// ==== Test Case

describe("registry-test", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(fs, "existsSync");
    sandbox.stub(fs, "readFileSync").returns("{}");
    sandbox.stub(fs, "mkdirSync");
    sandbox.stub(fs, "writeFileSync");
    sandbox.stub(fs, "readdirSync").returns([]);
  });

  afterEach(function () {
    sandbox.restore();
    registry.destroy();
  });

  describe("init", function () {
    it("should have function", function () {
      assert.isFunction(registry.init);
    });

    it("should check registryPath", function () {
      fs.existsSync.returns(true);

      registry.init(REGISTRY_PATH);

      sinon.assert.calledWith(fs.existsSync, "/some/path/registry");
    });

    it("should throw error with path not found", function () {
      fs.existsSync.returns(false);

      assert.throws(function () {
        registry.init(REGISTRY_PATH);
      }, "Registry path does not exist: /some/path/registry");
    });

    it("should check for meta info", function () {
      fs.existsSync.returns(true);

      registry.init(REGISTRY_PATH);

      sinon.assert.calledWith(fs.existsSync, "/some/path/registry/registry.json");
    });

    it("should read meta info", function () {
      fs.existsSync.returns(true);

      registry.init(REGISTRY_PATH);

      sinon.assert.calledWith(fs.readFileSync, "/some/path/registry/registry.json");
    });

    it("should create path for converted meta info", function () {
      fs.existsSync.returns(true);
      fs.readFileSync.returns(JSON.stringify(OLD_META));
      fs.existsSync.withArgs("/some/path/registry/pkg").returns(false);

      registry.init(REGISTRY_PATH);

      sinon.assert.calledWith(fs.existsSync, "/some/path/registry/pkg");
      sinon.assert.calledWith(fs.mkdirSync, "/some/path/registry/pkg");
    });

    it("should write converted meta info", function () {
      fs.existsSync.returns(true);
      fs.readFileSync.returns(JSON.stringify(OLD_META));
      registry.init(REGISTRY_PATH);

      sinon.assert.calledWith(fs.writeFileSync, "/some/path/registry/pkg/pkg.json",
        JSON.stringify(OLD_META.pkg));
      sinon.assert.calledWith(fs.writeFileSync, "/some/path/registry/registry.json",
        JSON.stringify({
          version : metaVersion
        }));
    });

    it("should converted meta info <0.1.8", function () {
      fs.existsSync.returns(true);
      var meta = {
        "version"  : "0.1.6-dev",
        "count"    : 95,
        "local"    : 3,
        "proxied"  : 92,
        "settings" : {
          "hostname" : "localhost"
        }
      };
      fs.readFileSync.returns(JSON.stringify(meta));
      registry.init(REGISTRY_PATH);

      sinon.assert.calledWith(fs.writeFileSync, "/some/path/registry/registry.json",
        JSON.stringify({
          version : metaVersion,
          "settings": {
            "hostname": "localhost"
          }
        }));
    });
  });

  // ==== Test Case

  describe("get pkg", function () {
    beforeEach(function () {
      sandbox.stub(registry, "refreshMeta");

      fs.existsSync.withArgs("/some/path/registry").returns(true);
      fs.existsSync.withArgs("/some/path/registry/registry.json").returns(true);
      fs.readFileSync.withArgs("/some/path/registry/registry.json").
        returns(JSON.stringify({version: "1.0.0"}));
    });

    afterEach(function () {
      registry.destroy();
    });

    it("should have function", function () {
      assert.isFunction(registry.getPackage);
    });

    it("should require package name", function () {
      assert.throws(function () {
        registry.getPackage();
      }, "Argument 'pkgName' must be of type string");
    });

    it("should require registry to be initialized", function () {
      assert.throws(function () {
        registry.getPackage("pkg");
      }, "Registry is not initialized properly. Did you call registry.init()?");
    });

    it("should check if package folder exists and return null if not", function () {
      registry.init(REGISTRY_PATH);
      fs.existsSync.withArgs("/some/path/registry/pkg").returns(false);

      var result = registry.getPackage("pkg");

      sinon.assert.calledWith(fs.existsSync, "/some/path/registry/pkg");
      assert(!result);
    });

    it("should check if scoped package folder exists and return null if not", function () {
      registry.init(REGISTRY_PATH);
      fs.existsSync.withArgs("/some/path/registry/@scoped/pkg").returns(false);

      var result = registry.getPackage("@scoped/pkg");

      sinon.assert.calledWith(fs.existsSync, "/some/path/registry/@scoped/pkg");
      assert(!result);
    });

    it("should check if package meta exists and return null if not", function () {
      registry.init(REGISTRY_PATH);
      fs.existsSync.withArgs("/some/path/registry/pkg").returns(true);
      fs.existsSync.withArgs("/some/path/registry/pkg/pkg.json").returns(false);

      var result = registry.getPackage("pkg");

      sinon.assert.calledWith(fs.existsSync, "/some/path/registry/pkg/pkg.json");
      assert(!result);
    });

    it("should check if scoped package meta exists and return null if not", function () {
      registry.init(REGISTRY_PATH);
      fs.existsSync.withArgs("/some/path/registry/@scoped/pkg").returns(true);
      fs.existsSync.withArgs("/some/path/registry/@scoped/pkg/pkg.json").returns(false);

      var result = registry.getPackage("@scoped/pkg");

      sinon.assert.calledWith(fs.existsSync, "/some/path/registry/@scoped/pkg/pkg.json");
      assert(!result);
    });
  });
});

// ==== Test Case

describe("registry-test - get pkg version", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(fs, "existsSync");
    sandbox.stub(fs, "readFileSync");
    sandbox.stub(fs, "mkdirSync");
    sandbox.stub(fs, "writeFileSync");
    sandbox.stub(fs, "statSync").returns({ mtime : new Date() });
    sandbox.stub(registry, "refreshMeta");

    fs.existsSync.withArgs("/some/path/registry").returns(true);
    fs.existsSync.withArgs("/some/path/registry/registry.json").returns(true);
    fs.readFileSync.withArgs("/some/path/registry/registry.json").
      returns(JSON.stringify({version: "1.0.0"}));

    registry.init(REGISTRY_PATH);
    fs.existsSync.withArgs("/some/path/registry/pkg").returns(true);
    fs.existsSync.withArgs("/some/path/registry/pkg/pkg.json").returns(true);
    fs.readFileSync.withArgs("/some/path/registry/pkg/pkg.json").
      returns(JSON.stringify(OLD_META.pkg));

    fs.existsSync.withArgs("/some/path/registry/@scoped/pkg").returns(true);
    fs.existsSync.withArgs("/some/path/registry/@scoped/pkg/pkg.json").returns(true);
    fs.readFileSync.withArgs("/some/path/registry/@scoped/pkg/pkg.json").
      returns(JSON.stringify(OLD_META.scopedPkg));
  });

  afterEach(function () {
    sandbox.restore();
    registry.destroy();
  });

  it("should read package meta return it", function () {
    var result = registry.getPackage("pkg");

    sinon.assert.calledWith(fs.readFileSync, "/some/path/registry/pkg/pkg.json");
    assert.deepEqual(result.versions, OLD_META.pkg.versions);
  });

  it("should read scoped package meta return it", function () {
    var result = registry.getPackage("@scoped/pkg");

    sinon.assert.calledWith(fs.readFileSync, "/some/path/registry/@scoped/pkg/pkg.json");
    assert.deepEqual(result.versions, OLD_META.scopedPkg.versions);
  });

  it("should return null if package version does not exist", function () {
    var result = registry.getPackage("pkg", "0.1.0");

    assert(!result);
  });

  it("should return pkg info if package version does exist", function () {
    var result = registry.getPackage("pkg", "0.0.1");

    assert.equal(result.name, "pkg");
    assert.equal(result.version, "0.0.1");
  });

  it("should not calculate _mtime on specific version", function () {
    var result = registry.getPackage("pkg", "0.0.1");

    assert.isUndefined(result._mtime);
  });

  it("should calculate _mtime on full meta", function () {
    var result = registry.getPackage("pkg");

    assert.isDefined(result._mtime);
    assert.isFunction(result._mtime.getTime);
  });

  it("should not calculate _highest-version", function () {
    var result = registry.getPackage("pkg");

    assert.equal(result["_highest-version"], "0.0.2");
  });
});

// ==== Test Case

describe("registry-test - write pkg", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(fs, "existsSync");
    sandbox.stub(fs, "readFileSync");
    sandbox.stub(fs, "mkdirSync");
    sandbox.stub(fs, "writeFileSync");
    sandbox.stub(registry, "refreshMeta");

    fs.existsSync.withArgs("/some/path/registry").returns(true);
    fs.existsSync.withArgs("/some/path/registry/registry.json").returns(true);
    fs.readFileSync.withArgs("/some/path/registry/registry.json").
      returns(JSON.stringify({version: "1.0.0"}));

    registry.init(REGISTRY_PATH);
    fs.existsSync.withArgs("/some/path/registry/pkg").returns(true);
    fs.writeFileSync.withArgs("/some/path/registry/pkg/pkg.json");

    fs.existsSync.withArgs("/some/path/registry/@scoped").returns(true);
    fs.existsSync.withArgs("/some/path/registry/@scoped/pkg").returns(true);
    fs.writeFileSync.withArgs("/some/path/registry/@scoped/pkg/pkg.json");
  });

  afterEach(function () {
    sandbox.restore();
    registry.destroy();
  });

  it("should have function", function () {
    assert.isFunction(registry.setPackage);
  });

  it("should require package meta", function () {
    assert.throws(function () {
      registry.setPackage();
    }, "Argument 'pkgMeta' must be given and of type object");
  });

  it("should require registry to be initialized", function () {
    registry.destroy();

    assert.throws(function () {
      registry.setPackage(OLD_META.pkg);
    }, "Registry is not initialized properly. Did you call registry.init()?");
  });

  it("should require package meta to have a name", function () {
    assert.throws(function () {
      registry.setPackage(OLD_META.pkg);
    }, "Expected pkgMeta to have property name");
  });

  it("should create package path", function () {
    var pkg = { name : "pkg" };
    fs.existsSync.withArgs("/some/path/registry/pkg").returns(false);

    registry.setPackage(pkg);

    sinon.assert.calledWith(fs.mkdirSync, "/some/path/registry/pkg");
  });

  it("should create scoped package path", function () {
    var pkg = { name : "@scoped/pkg" };
    fs.existsSync.withArgs("/some/path/registry/@scoped").returns(false);
    fs.existsSync.withArgs("/some/path/registry/@scoped/pkg").returns(false);

    registry.setPackage(pkg);

    sinon.assert.calledWith(fs.mkdirSync, "/some/path/registry/@scoped");
    sinon.assert.calledWith(fs.mkdirSync, "/some/path/registry/@scoped/pkg");
  });

  it("should create scoped package path when scope already exists", function () {
    var pkg = { name : "@scoped/pkg" };
    fs.existsSync.withArgs("/some/path/registry/@scoped").returns(true);
    fs.existsSync.withArgs("/some/path/registry/@scoped/pkg").returns(false);

    registry.setPackage(pkg);

    sinon.assert.calledWith(fs.mkdirSync, "/some/path/registry/@scoped/pkg");
  });

  it("should write new package meta", function () {
    var pkg = {
      name    : "pkg",
      versions : {
        "0.0.1" : {
          name    : "pkg",
          version : "0,0.1"
        }
      }
    };

    registry.setPackage(pkg);

    sinon.assert.notCalled(fs.mkdirSync, "/some/path/registry/pkg");
    sinon.assert.calledWith(fs.writeFileSync, "/some/path/registry/pkg/pkg.json",
      JSON.stringify(pkg));
  });

  it("should write new scoped package meta", function () {
    var pkg = {
      name    : "@scoped/pkg",
      versions : {
        "0.0.1" : {
          name    : "@scoped/pkg",
          version : "0,0.1"
        }
      }
    };

    registry.setPackage(pkg);

    sinon.assert.notCalled(fs.mkdirSync, "/some/path/registry/@scoped/pkg");
    sinon.assert.calledWith(fs.writeFileSync, "/some/path/registry/@scoped/pkg/pkg.json",
      JSON.stringify(pkg));
  });
});

// ==== Test Case

describe("registry-test - delete pkg", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(fs, "existsSync");
    sandbox.stub(fs, "readFileSync");
    sandbox.stub(fs, "writeFileSync");
    sandbox.stub(fs, "unlinkSync");
    sandbox.stub(registry, "refreshMeta");

    fs.existsSync.withArgs("/some/path/registry").returns(true);
    fs.existsSync.withArgs("/some/path/registry/registry.json").returns(true);
    fs.readFileSync.withArgs("/some/path/registry/registry.json").
      returns(JSON.stringify({
        version : "1.0.0",
        count   : 5,
        local   : 3,
        proxied : 2
      }));

    registry.init(REGISTRY_PATH);
  });

  afterEach(function () {
    sandbox.restore();
    registry.destroy();
  });

  it("should have function", function () {
    assert.isFunction(registry.removePackage);
  });

  it("should require package name", function () {
    assert.throws(function () {
      registry.removePackage();
    }, "Argument 'pkgName' must be of type string");
  });

  it("should require registry to be initialized", function () {
    registry.destroy();

    assert.throws(function () {
      registry.removePackage("pkg");
    }, "Registry is not initialized properly. Did you call registry.init()?");
  });

  it("should unlink package meta", function () {
    fs.existsSync.returns(true);
    sandbox.stub(registry, "getPackage").returns({"_proxied" : true});

    registry.removePackage("pkg");

    sinon.assert.calledOnce(registry.getPackage);
    sinon.assert.callOrder(registry.getPackage, fs.unlinkSync);
    sinon.assert.calledWith(fs.unlinkSync, "/some/path/registry/pkg/pkg.json");
    sinon.assert.calledWith(fs.writeFileSync, "/some/path/registry/registry.json", JSON.stringify({
      version : "1.0.0",
      count   : 4,
      local   : 3,
      proxied : 1
    }));
  });

  it("should unlink scoped package meta", function () {
    fs.existsSync.returns(true);
    sandbox.stub(registry, "getPackage").returns({"_proxied" : true});

    registry.removePackage("@scoped/pkg");

    sinon.assert.calledOnce(registry.getPackage);
    sinon.assert.callOrder(registry.getPackage, fs.unlinkSync);
    sinon.assert.calledWith(fs.unlinkSync, "/some/path/registry/@scoped/pkg/pkg.json");
    sinon.assert.calledWith(fs.writeFileSync, "/some/path/registry/registry.json", JSON.stringify({
      version : "1.0.0",
      count   : 4,
      local   : 3,
      proxied : 1
    }));
  });
});

// ==== Test Case

describe("registry-test - dependents", function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should have function", function () {
    assert.isFunction(registry.getDependents);
  });

  it("should walk packages", function () {
    sandbox.stub(registry, "iteratePackages");

    registry.getDependents({
      name : "nopar",
      "dist-tags" : { "latest" : "0.0.1" },
      versions : { "0.0.1" : { name  : "nopar", version : "0.0.1" } }
    });

    sinon.assert.calledOnce(registry.iteratePackages);
  });

  describe("walk", function () {
    var iteratePackagesFn, pkgs = [];

    beforeEach(function () {
      iteratePackagesFn = registry.iteratePackages;
      registry.iteratePackages = function (fn) {
        for (var i = pkgs.length - 1; i >= 0; i--) {
          var pkg = pkgs[i];
          fn(pkg.name, pkg);
        }
      };
    });

    afterEach(function () {
      registry.iteratePackages = iteratePackagesFn;
    });

    it("should return dependencies", function () {
      pkgs = [{
        name : "dep1",
        "dist-tags" : { "latest" : "0.9.0" },
        "versions"  : {
          "0.9.0" : {
            dependencies : { "nopar" : "0.1.0" }
          }
        }
      }];

      var deps = registry.getDependents({
        name : "nopar",
        "dist-tags" : { "latest" : "0.0.1" },
        versions : { "0.0.1" : { name  : "nopar", version : "0.0.1" } }
      });

      assert.deepEqual({
        "_counts" : {
          runtime : 1,
          dev : 0,
          peer : 0
        },
        "dep1" : {
          outdated : false,
          version : "0.1.0",
          type    : "runtime"
        }
      }, deps);
    });

    it("should return devDependencies", function () {
      pkgs = [{
        name : "dep1",
        "dist-tags" : { "latest" : "0.9.0" },
        "versions"  : {
          "0.9.0" : {
            devDependencies : { "nopar" : "0.1.0" }
          }
        }
      }];

      var deps = registry.getDependents({
        name : "nopar",
        "dist-tags" : { "latest" : "0.0.1" },
        versions : { "0.0.1" : { name  : "nopar", version : "0.0.1" } }
      });

      assert.deepEqual(deps, {
        "_counts" : {
          runtime : 0,
          dev : 1,
          peer : 0
        },
        "dep1" : {
          outdated : false,
          version : "0.1.0",
          type    : "dev"
        }
      });
    });
  });

});

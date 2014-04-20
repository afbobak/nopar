/*jslint devel: true, node: true, nomen: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

var buster = require("buster");
var assert = buster.referee.assert;
var refute = buster.referee.refute;
var fs     = require("fs");
var path   = require("path");

var registry = require("../lib/registry");

var REGISTRY_PATH = "/some/path/registry";
var OLD_META = {
  pkg : {
    versions : {
      "0.0.1" : {
        "name"  : "pkg",
        version : "0.0.1"
      }
    }
  }
};
var metaVersion = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"))).version;

// ==== Test Case

buster.testCase("registry-test - init", {
  setUp: function () {
    this.stub(fs, "existsSync");
    this.stub(fs, "readFileSync").returns("{}");
    this.stub(fs, "mkdirSync");
    this.stub(fs, "writeFileSync");
    this.stub(fs, "readdirSync").returns([]);
  },

  tearDown: function () {
    registry.destroy();
  },

  "should have function": function () {
    assert.isFunction(registry.init);
  },

  "should check registryPath": function () {
    fs.existsSync.returns(true);

    registry.init(REGISTRY_PATH);

    assert.calledWith(fs.existsSync, "/some/path/registry");
  },

  "should throw error with path not found": function () {
    fs.existsSync.returns(false);

    assert.exception(function () {
      registry.init(REGISTRY_PATH);
    }, "Error");
  },

  "should check for meta info": function () {
    fs.existsSync.returns(true);

    registry.init(REGISTRY_PATH);

    assert.calledWith(fs.existsSync, "/some/path/registry/registry.json");
  },

  "should read meta info": function () {
    fs.existsSync.returns(true);

    registry.init(REGISTRY_PATH);

    assert.calledOnceWith(fs.readFileSync, "/some/path/registry/registry.json");
  },

  "should create path for converted meta info": function () {
    fs.existsSync.returns(true);
    fs.readFileSync.returns(JSON.stringify(OLD_META));
    fs.existsSync.withArgs("/some/path/registry/pkg").returns(false);

    registry.init(REGISTRY_PATH);

    assert.calledWith(fs.existsSync, "/some/path/registry/pkg");
    assert.calledOnceWith(fs.mkdirSync, "/some/path/registry/pkg");
  },

  "should write converted meta info": function () {
    fs.existsSync.returns(true);
    fs.readFileSync.returns(JSON.stringify(OLD_META));
    registry.init(REGISTRY_PATH);

    assert.calledWith(fs.writeFileSync, "/some/path/registry/pkg/pkg.json",
      JSON.stringify(OLD_META.pkg));
    assert.calledWith(fs.writeFileSync, "/some/path/registry/registry.json",
      JSON.stringify({
        version : metaVersion
      }));
  },

  "should converted meta info <0.1.8": function () {
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

    assert.calledWith(fs.writeFileSync, "/some/path/registry/registry.json",
      JSON.stringify({
        version : metaVersion,
        "settings": {
          "hostname": "localhost"
        }
      }));
  }
});

// ==== Test Case

buster.testCase("registry-test - get pkg", {
  setUp: function () {
    this.stub(fs, "existsSync");
    this.stub(fs, "readFileSync");
    this.stub(registry, "refreshMeta");

    fs.existsSync.withArgs("/some/path/registry").returns(true);
    fs.existsSync.withArgs("/some/path/registry/registry.json").returns(true);
    fs.readFileSync.withArgs("/some/path/registry/registry.json").
      returns(JSON.stringify({version: "1.0.0"}));
  },

  tearDown: function () {
    registry.destroy();
  },

  "should have function": function () {
    assert.isFunction(registry.getPackage);
  },

  "should require package name": function () {
    assert.exception(function () {
      registry.getPackage();
    }, "TypeError");
  },

  "should require registry to be initialized": function () {
    assert.exception(function () {
      registry.getPackage("pkg");
    }, "Error");
  },

  "should check if package folder exists and return null if not": function () {
    registry.init(REGISTRY_PATH);
    fs.existsSync.withArgs("/some/path/registry/pkg").returns(false);

    var result = registry.getPackage("pkg");

    assert.calledWith(fs.existsSync, "/some/path/registry/pkg");
    refute(result);
  },

  "should check if package meta exists and return null if not": function () {
    registry.init(REGISTRY_PATH);
    fs.existsSync.withArgs("/some/path/registry/pkg").returns(true);
    fs.existsSync.withArgs("/some/path/registry/pkg/pkg.json").returns(false);

    var result = registry.getPackage("pkg");

    assert.calledWith(fs.existsSync, "/some/path/registry/pkg/pkg.json");
    refute(result);
  }
});

// ==== Test Case

buster.testCase("registry-test - get pkg version", {
  setUp: function () {
    this.stub(fs, "existsSync");
    this.stub(fs, "readFileSync");
    this.stub(fs, "mkdirSync");
    this.stub(fs, "writeFileSync");
    this.stub(fs, "statSync").returns({ mtime : new Date() });
    this.stub(registry, "refreshMeta");

    fs.existsSync.withArgs("/some/path/registry").returns(true);
    fs.existsSync.withArgs("/some/path/registry/registry.json").returns(true);
    fs.readFileSync.withArgs("/some/path/registry/registry.json").
      returns(JSON.stringify({version: "1.0.0"}));

    registry.init(REGISTRY_PATH);
    fs.existsSync.withArgs("/some/path/registry/pkg").returns(true);
    fs.existsSync.withArgs("/some/path/registry/pkg/pkg.json").returns(true);
    fs.readFileSync.withArgs("/some/path/registry/pkg/pkg.json").
      returns(JSON.stringify(OLD_META.pkg));
  },

  tearDown: function () {
    registry.destroy();
  },

  "should read package meta return it": function () {
    var result = registry.getPackage("pkg");

    assert.calledWith(fs.readFileSync, "/some/path/registry/pkg/pkg.json");
    assert.equals(result.versions, OLD_META.pkg.versions);
  },

  "should return null if package version does not exist": function () {
    var result = registry.getPackage("pkg", "0.0.2");

    refute(result);
  },

  "should return pkg info if package version does exist": function () {
    var result = registry.getPackage("pkg", "0.0.1");

    assert.equals(result, OLD_META.pkg.versions["0.0.1"]);
  }
});

// ==== Test Case

buster.testCase("registry-test - write pkg", {
  setUp: function () {
    this.stub(fs, "existsSync");
    this.stub(fs, "readFileSync");
    this.stub(fs, "mkdirSync");
    this.stub(fs, "writeFileSync");
    this.stub(registry, "refreshMeta");

    fs.existsSync.withArgs("/some/path/registry").returns(true);
    fs.existsSync.withArgs("/some/path/registry/registry.json").returns(true);
    fs.readFileSync.withArgs("/some/path/registry/registry.json").
      returns(JSON.stringify({version: "1.0.0"}));

    registry.init(REGISTRY_PATH);
    fs.existsSync.withArgs("/some/path/registry/pkg").returns(true);
    fs.writeFileSync.withArgs("/some/path/registry/pkg/pkg.json");
  },

  tearDown: function () {
    registry.destroy();
  },

  "should have function": function () {
    assert.isFunction(registry.setPackage);
  },

  "should require package meta": function () {
    assert.exception(function () {
      registry.setPackage();
    }, "TypeError");
  },

  "should require registry to be initialized": function () {
    registry.destroy();

    assert.exception(function () {
      registry.setPackage(OLD_META.pkg);
    }, "Error");
  },

  "should require package meta to have a name": function () {
    assert.exception(function () {
      registry.setPackage(OLD_META.pkg);
    }, "Error");
  },

  "should create package path": function () {
    var pkg = { name : "pkg" };
    fs.existsSync.withArgs("/some/path/registry/pkg").returns(false);

    registry.setPackage(pkg);

    assert.calledOnceWith(fs.mkdirSync, "/some/path/registry/pkg");
  },

  "should write new package meta": function () {
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

    refute.called(fs.mkdirSync, "/some/path/registry/pkg");
    assert.calledOnceWith(fs.writeFileSync, "/some/path/registry/pkg/pkg.json",
      JSON.stringify(pkg));
  }
});

// ==== Test Case

buster.testCase("registry-test - delete pkg", {
  setUp: function () {
    this.stub(fs, "existsSync");
    this.stub(fs, "readFileSync");
    this.stub(fs, "writeFileSync");
    this.stub(fs, "unlinkSync");
    this.stub(registry, "refreshMeta");

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
  },

  tearDown: function () {
    registry.destroy();
  },

  "should have function": function () {
    assert.isFunction(registry.removePackage);
  },

  "should require package name": function () {
    assert.exception(function () {
      registry.removePackage();
    }, "TypeError");
  },

  "should require registry to be initialized": function () {
    registry.destroy();

    assert.exception(function () {
      registry.removePackage("pkg");
    }, "Error");
  },

  "should unlink package meta": function () {
    fs.existsSync.returns(true);
    this.stub(registry, "getPackage").returns({"_proxied" : true});

    registry.removePackage("pkg");

    assert.calledOnce(registry.getPackage);
    assert.callOrder(registry.getPackage, fs.unlinkSync);
    assert.calledOnceWith(fs.unlinkSync, "/some/path/registry/pkg/pkg.json");
    assert.calledOnceWith(fs.writeFileSync, "/some/path/registry/registry.json", JSON.stringify({
      version : "1.0.0",
      count   : 4,
      local   : 3,
      proxied : 1
    }));
  }
});

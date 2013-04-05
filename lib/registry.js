/*jslint browser: false, nomen: true */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var fs   = require("fs");
var path = require("path");

var metaFilename = "registry.json";
var metaVersion  = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"))).version;
var meta;

var registryPath;

function writeMeta() {
  fs.writeFileSync(path.join(registryPath, metaFilename), JSON.stringify(meta));
}

function convertMetaV000(registryPath, meta) {
  var pkgName;
  var newMeta = {
    version : metaVersion,
    count   : 0,
    local   : 0,
    proxied : 0
  };

  for (pkgName in meta) {
    var pkgMeta = meta[pkgName];
    var pkgPath = path.join(registryPath, pkgName);
    if (!fs.existsSync(pkgPath)) {
      fs.mkdirSync(pkgPath);
    }
    fs.writeFileSync(path.join(pkgPath, pkgName + ".json"), JSON.stringify(pkgMeta));

    newMeta.count++;
    if (pkgMeta["_fwd-dists"]) {
      newMeta.proxied++;
    } else {
      newMeta.local++;
    }
  }

  return newMeta;
}

exports.getMeta = function () {
  return meta;
};

exports.refreshMeta = function () {
  var pkgs = fs.readdirSync(registryPath);

  meta.count   = 0;
  meta.local   = 0;
  meta.proxied = 0;

  for (var i = pkgs.length - 1; i >= 0; i--) {
    var name = pkgs[i];
    if (fs.statSync(path.join(registryPath, name)).isDirectory()) {
      var pkgMeta = exports.getPackage(name);

      if (!meta.count) {
        meta.count = 1;
      } else {
        meta.count++;
      }

      if (pkgMeta["_fwd-dists"]) {
        if (!meta.proxied) {
          meta.proxied = 1;
        } else {
          meta.proxied++;
        }
      } else {
        if (!meta.local) {
          meta.local = 1;
        } else {
          meta.local++;
        }
      }
    }
  }

  writeMeta();

  return meta;
};

exports.init = function (r) {
  if (!fs.existsSync(r)) {
    throw new Error("Registry path does not exist: " + r);
  }
  registryPath = r;

  var metaFilepath = path.join(registryPath, metaFilename);
  if (fs.existsSync(metaFilepath)) {
    meta = JSON.parse(fs.readFileSync(metaFilepath, "utf8"));

    if (!meta.version) {
      // Convert old-school registry
      meta = convertMetaV000(registryPath, meta);
      writeMeta();
    }

  } else {
    meta = {
      version : metaVersion,
      count   : 0,
      local   : 0,
      proxied : 0
    };
  }
};

exports.destroy = function () {
  meta         = undefined;
  registryPath = undefined;
};

exports.getPackage = function (pkgName, version) {
  if (typeof pkgName !== "string") {
    throw new TypeError("Argument 'pkgName' must be of type string");
  }
  if (typeof registryPath !== "string") {
    throw new Error("Registry is not initialized properly. Did you call registry.init()?");
  }

  var pkgPath = path.join(registryPath, pkgName);
  if (!fs.existsSync(pkgPath)) {
    return null;
  }

  var pkgMetaPath = path.join(pkgPath, pkgName + ".json");
  if (!fs.existsSync(pkgMetaPath)) {
    return null;
  }

  var pkgMeta;
  pkgMeta = fs.readFileSync(pkgMetaPath);
  try {
    pkgMeta = JSON.parse(pkgMeta);
  } catch (e) {
    throw new Error("Failed to parse package meta: " + pkgMetaPath + "; got: " + pkgMeta);
  }

  if (version) {
    return pkgMeta.versions ? pkgMeta.versions[version] : null;
  }

  return pkgMeta;
};

exports.setPackage = function (pkgMeta) {
  if (!pkgMeta || typeof pkgMeta !== "object") {
    throw new TypeError("Argument 'pkgMeta' must be given and of type object");
  }
  if (typeof registryPath !== "string") {
    throw new Error("Registry is not initialized properly. Did you call registry.init()?");
  }
  if (!pkgMeta.name) {
    throw new Error("Expected pkgMeta to have property name");
  }

  var pkgName     = pkgMeta.name;
  var pkgPath     = path.join(registryPath, pkgName);
  var pkgMetaPath = path.join(pkgPath, pkgName + ".json");
  if (!fs.existsSync(pkgPath)) {
    fs.mkdirSync(pkgPath);
  }

  if (!fs.existsSync(pkgMetaPath)) {
    if (!meta.count) {
      meta.count = 1;
    } else {
      meta.count++;
    }

    if (pkgMeta["_fwd-dists"]) {
      if (!meta.proxied) {
        meta.proxied = 1;
      } else {
        meta.proxied++;
      }
    } else {
      if (!meta.local) {
        meta.local = 1;
      } else {
        meta.local++;
      }
    }
  }

  fs.writeFileSync(pkgMetaPath, JSON.stringify(pkgMeta));
};

exports.removePackage = function (pkgName) {
  if (typeof pkgName !== "string") {
    throw new TypeError("Argument 'pkgName' must be of type string");
  }
  if (typeof registryPath !== "string") {
    throw new Error("Registry is not initialized properly. Did you call registry.init()?");
  }

  var pkgPath = path.join(registryPath, pkgName);
  if (!fs.existsSync(pkgPath)) {
    return;
  }

  var pkgMetaPath = path.join(pkgPath, pkgName + ".json");
  if (!fs.existsSync(pkgMetaPath)) {
    return;
  }

  var pkgMeta = exports.getPackage(pkgName);
  meta.count--;
  if (pkgMeta["_fwd-dists"]) {
    meta.proxied--;
  } else {
    meta.local--;
  }
  writeMeta();

  fs.unlinkSync(pkgMetaPath);
};

exports.query = function (query) {
  var all = fs.readdirSync(registryPath);
  var pkgs = {};

  for (var i = all.length - 1; i >= 0; i--) {
    var name = all[i];
    if (fs.statSync(path.join(registryPath, name)).isDirectory() &&
        name.indexOf(query) >= 0) {
      pkgs[name] = exports.getPackage(name);
    }
  }

  return pkgs;
};

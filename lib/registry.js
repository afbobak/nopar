/*jslint browser: false, nomen: true */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var fs         = require("fs");
var path       = require("path");
var url        = require("url");
var semver     = require("semver");
var attachment = require("./attachment");
var winston    = require("winston");

var metaFilename = "registry.json";
var metaVersion  = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"))).version;
var meta;

var registryPath;

function writeMeta() {
  fs.writeFileSync(path.join(registryPath, metaFilename), JSON.stringify(meta));
}

exports.writeMeta = writeMeta;

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

function convertMetaV018(registryPath, meta) {
  var pkgName;
  var newMeta = {
    version  : metaVersion,
    settings : meta.settings
  };

  var pkgs = fs.readdirSync(registryPath);
  var attachments, attachment;
  for (var i = pkgs.length - 1; i >= 0; i--) {
    var name = pkgs[i];
    var pkgPath = path.join(registryPath, name);
    if (fs.statSync(pkgPath).isDirectory()) {
      var pkgMeta = exports.getPackage(name);
      attachments = pkgMeta["_attachments"];
      if (pkgMeta["_fwd-dists"]) {
        pkgMeta["_proxied"] = true;

        attachments = {};
        for (attachment in pkgMeta["_fwd-dists"]) {
          attachments[attachment] = {
            cached     : fs.existsSync(path.join(pkgPath, attachment)),
            forwardUrl : pkgMeta["_fwd-dists"][attachment]
          };
        }
        delete pkgMeta["_fwd-dists"];

      } else if (!attachments) {
        pkgMeta["_proxied"] = false;
        attachments = {};

        for (var version in pkgMeta.versions) {
          if (pkgMeta.versions[version].dist) {
            pkgUrl = pkgMeta.versions[version].dist.tarball;
            attachment = pkgUrl.substr(pkgUrl.lastIndexOf("/") + 1);
            attachments[attachment] = {
              cached : fs.existsSync(path.join(pkgPath, attachment))
            };
          }
        }
      }

      pkgMeta["_attachments"] = attachments;
      exports.setPackage(pkgMeta);
    }
  }

  return newMeta;
}

function convertMetaV022(registryPath, meta) {
  if (!meta.settings) {
    return meta;
  }
  var newMeta = {
    version  : metaVersion,
    settings : {
      "hostname"              : meta.settings.hostname,
      "port"                  : meta.settings.port,
      "registryPath"          : meta.settings.registryPath
    },
    count    : meta.count,
    local    : meta.local,
    proxied  : meta.proxied
  };
  if (meta.settings.forwarder) {
    newMeta["forwarder.registry"]    = meta.settings.forwarder.registry;
    newMeta["forwarder.proxy"]       = meta.settings.forwarder.proxy;
    newMeta["forwarder.autoForward"] = meta.settings.forwarder.autoForward;
    newMeta["forwarder.ignoreCert"]  = meta.settings.forwarder.ignoreCert;
    newMeta["forwarder.userAgent"]   = meta.settings.forwarder.userAgent;
  }

  return newMeta;
}

exports.getMeta = function getMeta() {
  return meta;
};

exports.refreshMeta = function (settings) {
  var pkgs = fs.readdirSync(registryPath);

  meta.count   = 0;
  meta.local   = 0;
  meta.proxied = 0;

  for (var i = pkgs.length - 1; i >= 0; i--) {
    var name = pkgs[i];
    if (fs.statSync(path.join(registryPath, name)).isDirectory()) {
      var pkgMeta = exports.getPackage(name);
      attachment.refreshMeta(settings, pkgMeta);

      if (!meta.count) {
        meta.count = 1;
      } else {
        meta.count++;
      }

      if (pkgMeta["_proxied"]) {
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
    var converted = false;

    if (!meta.version) {
      // Convert old-school registry
      winston.info("Upgrading registry meta 0.0.0");
      meta = convertMetaV000(registryPath, meta);
      converted = true;
    }

    if (converted || semver.lt(meta.version, "0.2.0-dev")) {
      winston.info("Upgrading registry meta <0.2.0");
      meta = convertMetaV018(registryPath, meta);
      converted = true;
    }

    if (converted || semver.lt(meta.version, "0.2.2-dev")) {
      winston.info("Upgrading registry meta <0.2.2");
      meta = convertMetaV022(registryPath, meta);
      converted = true;
    }

    if (converted) {
      writeMeta();
    }

  } else {
    meta = {
      version  : metaVersion,
      settings : {}
    };
  }
};

exports.destroy = function () {
  meta         = undefined;
  registryPath = undefined;
};

exports.getPackage = function (pkgName, version, settings) {
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
  // Extend metadata modified time, used to calculate ttl expiry
  pkgMeta["_mtime"] = fs.statSync(pkgMetaPath).mtime;


  // Rewrite all versions with correct url
  if (settings) {
    for (var v in pkgMeta.versions) {
      var p = pkgMeta.versions[v];
      var attachment  = p.dist.tarball.substr(
        p.dist.tarball.lastIndexOf("/") + 1);
      var tarballUrl = "";
      tarballUrl = url.parse(settings.get("baseUrl"));
      tarballUrl.pathname += pkgName + "/-/" + attachment
      p.dist.tarball = url.format(tarballUrl);
    }
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

    if (pkgMeta["_proxied"]) {
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
  if (pkgMeta["_proxied"]) {
    meta.proxied--;
  } else {
    meta.local--;
  }
  writeMeta();

  fs.unlinkSync(pkgMetaPath);
};

function iteratePackages(all, settings, fn) {
  if (typeof settings === "function") {
    fn = settings;
    settings = null;
  }
  for (var i = all.length - 1; i >= 0; i--) {
    var name = all[i];
    if (fs.statSync(path.join(registryPath, name)).isDirectory()) {
      fn(name, exports.getPackage(name, null, settings));
    }
  }
}
exports.iteratePackages = function (fn) {
  var all = fs.readdirSync(registryPath);
  iteratePackages(all, fn);
};

exports.query = function (query, settings) {
  var all = fs.readdirSync(registryPath);
  var pkgs = {};

  iteratePackages(all, settings, function (name, pkg) {
    if (name.indexOf(query) >= 0) {
      pkgs[name] = pkg;
    }
  });

  return pkgs;
};

exports.queryLocal = function (query, settings) {
  var all = fs.readdirSync(registryPath);
  var pkgs = {};

  iteratePackages(all, settings, function (name, pkg) {
    if (!pkg["_proxied"] &&
        (!query || (query && name.indexOf(query) >= 0))) {
      pkgs[name] = pkg;
    }
  });

  return pkgs;
};

exports.getDependents = function (packagename) {
  var deps = {};

  exports.iteratePackages(function (name, pkg) {
    var latest = pkg.versions[pkg["dist-tags"].latest];
    if (latest.dependencies && latest.dependencies[packagename]) {
      deps[pkg.name] = {
        version : latest.dependencies[packagename],
        type    : "runtime"
      };
    }
    if (latest.devDependencies && latest.devDependencies[packagename]) {
      deps[pkg.name] = {
        version : latest.devDependencies[packagename],
        type    : "dev"
      };
    }
  });

  return deps;
};

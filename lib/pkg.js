/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var fs         = require("fs");
var path       = require("path");
var url        = require("url");
var winston    = require("winston");
var attachment = require("./attachment");

function proxyPackage(app, packagename, version, cb) {
  var forwarder = app.get("forwarder");
  if (!forwarder || !forwarder.registry) {
    return cb("No forward registry defined");
  }

  var proxyUrl    = forwarder.proxy ? url.parse(forwarder.proxy) : null;
  var registryUrl = url.parse(forwarder.registry);
  registryUrl.pathname += packagename;

  winston.info("Retrieving package " + packagename + "@" + (version || "*") +
    " from forward URL " + url.format(registryUrl));
  var protocol;
  if (proxyUrl) {
    winston.log("Using proxy at: " + proxyUrl);
    protocol = proxyUrl.protocol.substr(0, proxyUrl.protocol.length - 1);
  } else {
    protocol = registryUrl.protocol.substr(0, registryUrl.protocol.length - 1);
  }
  var get = require(protocol).get;

  function getProxyOptions() {
    return {
      hostname : proxyUrl.hostname,
      port     : proxyUrl.port,
      path     : url.format(registryUrl),
      headers  : {
        host         : registryUrl.hostname,
        "User-Agent" : forwarder.userAgent
      }
    };
  }

  function getStraightOptions() {
    return {
      hostname : registryUrl.hostname,
      port     : registryUrl.port,
      path     : registryUrl.pathname,
      headers  : {
        "User-Agent" : forwarder.userAgent
      }
    };
  }

  get(proxyUrl ? getProxyOptions() : getStraightOptions(), function (res) {
    if (res.statusCode !== 200) {
      return cb({
        text    : "Failed to make forward request",
        details : res.statusCode
      });
    }
    res.setEncoding("utf8");

    var pkgMeta = "";
    res.on("data", function (chunk) {
      pkgMeta += chunk;
    });
    res.on("end", function () {
      pkgMeta = JSON.parse(pkgMeta);
      pkgMeta["_fwd-dists"] = {};

      for (var v in pkgMeta.versions) {
        var p = pkgMeta.versions[v];
        var filename = p.dist.tarball.substr(
                          p.dist.tarball.lastIndexOf("/") + 1);
        var origTarball = p.dist.tarball;
        var tarballUrl = {
          protocol : "http",
          port     : app.get("port"),
          hostname : app.get("hostname"),
          pathname : "/" + packagename + "/-/" + filename
        };
        p.dist.tarball = url.format(tarballUrl);
        pkgMeta["_fwd-dists"][filename] = origTarball;
      }

      app.get("registry").setPackage(pkgMeta);

      cb();
    });

  }).on("error", function (error) {
    return cb({
      text    : "Failed to forward request to forward registry",
      details : error
    });
  });
}

/**
 * https://github.com/isaacs/npmjs.org#get-packagename
 */
exports.getPackage = function (app) {
  return function (req, res, next) {
    winston.info("GET " + req.originalUrl);

    var packagename = req.params.packagename;
    if (packagename === "css") {
      return next();
    }
    var version  = req.params.version;
    var registry = app.get("registry");

    function send404 () {
      res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }

    var pkgMeta = registry.getPackage(packagename);
    if (!pkgMeta ||
        (version && pkgMeta.versions && !pkgMeta.versions[version])) {

      var forwarder = app.get("forwarder");
      if (forwarder && !forwarder.autoForward) {
        return send404();
      }

      return proxyPackage(app, packagename, version, function (err) {
        if (err) {
          winston.error(err.text, err.details);
          return send404();
        }

        res.json(200, registry.getPackage(packagename, version));
      });

    } else {
      res.json(200, registry.getPackage(packagename, version));
    }
  };
};

/**
 * https://github.com/isaacs/npmjs.org#put-packagename
 */
exports.publishFull = function (app) {
  return function (req, res) {
    winston.info("PUT " + req.originalUrl, req.body);
    if (req.headers["content-type"] !== "application/json") {
      return res.json(400, {
        "error"  : "wrong_content",
        "reason" : "content-type MUST be application/json"
      });
    }

    var packagename = req.params.packagename;
    var registry    = app.get("registry");
    var pkgMeta     = registry.getPackage(packagename);
    if (pkgMeta && !req.params.revision) {
      return res.json(409, {
        "error"  : "conflict",
        "reason" : "must supply latest _rev to update existing package"
      });
    }

    pkgMeta = req.body || {};
    if (!pkgMeta["_rev"]) {
      pkgMeta["_rev"] = 0;
    }
    registry.setPackage(pkgMeta);

    res.json(200, {"ok" : true});
  };
};

/**
 * https://github.com/isaacs/npmjs.org#put-packagename012
 */
exports.publish = function (app) {
  return function (req, res, next) {
    winston.info("PUT " + req.originalUrl, req.body);
    if (req.headers["content-type"] !== "application/json") {
      return res.json(400, {
        "error"  : "wrong_content",
        "reason" : "content-type MUST be application/json"
      });
    }

    var packagename = req.params.packagename;
    var version     = req.params.version;
    var registry    = app.get("registry");

    var pkgMeta = registry.getPackage(packagename);
    if (!pkgMeta) {
      pkgMeta = {
        name   : packagename,
        "_rev" : 0
      };
    }
    if (!pkgMeta.versions) {
      pkgMeta.versions = {};
    }

    pkgMeta["versions"][version] = req.body || {};
    if (req.params.tagname === "latest") {
      if (!pkgMeta["dist-tags"]) {
        pkgMeta["dist-tags"] = {};
      }
      pkgMeta["dist-tags"]["latest"] = version;
    }
    pkgMeta["_rev"] = pkgMeta["_rev"] + 1;
    registry.setPackage(pkgMeta);

    res.json(200, JSON.stringify(version));
  };
};

/**
 * Unpublish individual package
 */
exports.unpublish = function (app, renderFn) {
  return function (req, res) {
    winston.info("DELETE " + req.originalUrl, req.body);

    var packagename = req.params.packagename;
    var registry    = app.get("registry");

    function deleteRevision(pkgPath, pkg) {
      var filePath = path.join(
        pkgPath,
        pkg.dist.tarball.substr(pkg.dist.tarball.lastIndexOf("/") + 1)
      );
      if (fs.existsSync(filePath)) {
        winston.info("Removing tarball: " + filePath);
        fs.unlinkSync(filePath);
      }
    }

    var pkgMeta = registry.getPackage(packagename);
    if (pkgMeta) {
      var pkgPath = path.join(app.get("registryPath"), packagename);
      for (var version in pkgMeta.versions) {
        var pkg = pkgMeta.versions[version];
        deleteRevision(pkgPath, pkg);
      }

      winston.info("Removing package meta: " + packagename);
      registry.removePackage(packagename);
      winston.info("Removing package folder: " + pkgPath);
      fs.rmdirSync(pkgPath);
    }

    if (renderFn) {
      renderFn(req, res);
    } else {
      res.json(200, {"ok" : true});
    }
  };
};

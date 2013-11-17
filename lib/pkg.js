/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var fs         = require("fs");
var path       = require("path");
var url        = require("url");
var winston    = require("winston");
var attachment = require("./attachment");

function increaseRevision(rev) {
  rev = Number(rev);
  if (isNaN(rev)) {
    return 1;
  }
  return rev + 1;
}

function proxyPackage(registry, settings, packagename, version, cb) {
  var registryUrl = settings.get("forwarder.registry");
  if (!registryUrl) {
    return cb({
      text    : "No forward registry defined",
      details : ""
    });
  }

  var proxyUrl          = settings.get("forwarder.proxy");
  proxyUrl              = proxyUrl ? url.parse(proxyUrl) : null;
  registryUrl           = url.parse(registryUrl);
  registryUrl.pathname += packagename;

  winston.info("Retrieving package " + packagename + "@" + (version || "*") +
    " from forward URL " + url.format(registryUrl));
  var protocol;
  if (proxyUrl) {
    winston.info("Using proxy " + settings.get("forwarder.proxy"), proxyUrl);
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
        "User-Agent" : settings.get("forwarder.userAgent")
      },
      rejectUnauthorized : !settings.get("forwarder.ignoreCert")
    };
  }

  function getStraightOptions() {
    return {
      hostname : registryUrl.hostname,
      port     : registryUrl.port,
      path     : registryUrl.pathname,
      headers  : {
        "User-Agent" : settings.get("forwarder.userAgent")
      },
      rejectUnauthorized : !settings.get("forwarder.ignoreCert")
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
      pkgMeta["_proxied"] = true;
      attachment.refreshMeta(settings, pkgMeta);
      registry.setPackage(pkgMeta);

      cb();
    });

  }).on("error", function (error) {
    var msg = "Failed to retrieve package " +
                packagename + "@" + (version || "*") +
                " from forward URL " + url.format(registryUrl);
    if (proxyUrl) {
      msg += " via proxy " + settings.get("forwarder.proxy");
    }
    return cb({
      text    : msg,
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

    function send404 () {
      res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }

    var packagename = req.params.packagename;
    var version  = req.params.version;
    var registry = app.get("registry");
    var settings = app.get("settings");

    var pkgMeta = registry.getPackage(packagename, null, app.get("settings"));
    if (!pkgMeta ||
        (version && pkgMeta.versions && !pkgMeta.versions[version])) {

      if (!settings.get("forwarder.autoForward")) {
        return send404();
      }

      return proxyPackage(registry, settings, packagename, version,
        function (err) {
          if (err) {
            winston.error(err.text, err.details);
            return send404();
          }

          res.json(200, registry.getPackage(packagename, version, app.get("settings")));
        }
      );

    } else {
      res.json(200, registry.getPackage(packagename, version, app.get("settings")));
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
    var settings    = app.get("settings");

    var pkgMeta     = registry.getPackage(packagename);
    if (pkgMeta && !req.params.revision) {
      return res.json(409, {
        "error"  : "conflict",
        "reason" : "must supply latest _rev to update existing package"
      });
    }
    if (pkgMeta && ("" + req.params.revision) !== ("" + pkgMeta["_rev"])) {
      return res.json(409, {
        "error"  : "conflict",
        "reason" : "revision does not match one in document"
      });
    }

    pkgMeta = req.body || {};
    pkgMeta["_rev"] = increaseRevision(pkgMeta["_rev"]);
    pkgMeta["_proxied"] = false;
    attachment.refreshMeta(settings, pkgMeta);
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
    var settings    = app.get("settings");

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
      pkgMeta.description = pkgMeta["versions"][version].description;
      pkgMeta.readme = pkgMeta["versions"][version].readme;
    }
    pkgMeta["_rev"] = increaseRevision(pkgMeta["_rev"]);
    pkgMeta["_proxied"] = false;
    attachment.refreshMeta(settings, pkgMeta);
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
    var settings    = app.get("settings");

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
      var pkgPath = path.join(settings.get("registryPath"), packagename);
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

/**
 * Tag individual package
 */
exports.tag = function (app) {
  return function (req, res) {
    winston.info("TAG " + req.originalUrl, req.body);

    var packagename = req.params.packagename;
    var tagname     = req.params.tagname;
    var version     = req.body;
    var registry    = app.get("registry");

    var pkgMeta = registry.getPackage(packagename);
    if (!pkgMeta) {
      winston.info("Unknown package to tag: " + packagename + "@" + version);
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }
    if (!pkgMeta["versions"] || !pkgMeta["versions"][version]) {
      winston.info("Unknown version to tag: " + packagename + "@" + version);
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }

    winston.info("Tagging package " + packagename + "@" + version +
      " as: " + tagname);

    if (!pkgMeta["dist-tags"]) {
      pkgMeta["dist-tags"] = {};
    }
    pkgMeta["dist-tags"][tagname] = version;
    pkgMeta["_rev"] = increaseRevision(pkgMeta["_rev"]);
    registry.setPackage(pkgMeta);

    res.json(201, pkgMeta);
  };
};

/**
 * Refresh package meta from forwarder
 */
exports.refresh = function (app, renderFn) {
  return function (req, res) {
    winston.info("REFRESH " + req.originalUrl);

    var packagename = req.params.packagename;
    var registry    = app.get("registry");
    var settings    = app.get("settings");

    function send404 () {
      res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }

    var pkgMeta = registry.getPackage(packagename);
    if (!pkgMeta) {
      winston.info("Unknown package to refesh: " + packagename);
      return send404();
    }

    return proxyPackage(registry, settings, packagename, undefined,
      function (err) {
        if (err) {
          winston.error(err.text, err.details);
          return send404();
        }

        if (renderFn) {
          renderFn(req, res);
        } else {
          res.json(200, {"ok" : true});
        }
      });
  };
};
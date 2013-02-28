/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var fs         = require("fs");
var path       = require("path");
var url        = require("url");
var winston    = require("winston");
var attachment = require("./attachment");

function persistRegistry(app) {
  var registry = app.get("registry");
  fs.writeFileSync(app.get("registryFile"), JSON.stringify(registry));
}

function proxyPackage(app, packagename, version, cb) {
  var forwarder = app.get("forwarder");
  if (!forwarder || !forwarder.registry) {
    return cb("No forward registry defined");
  }

  var registryUrl = url.parse(forwarder.registry);
  registryUrl.pathname += packagename;

  winston.info("Retrieving package " + packagename + "@" + (version || "*") +
    " from forward URL " + url.format(registryUrl));
  var protocol    = registryUrl.protocol.substr(0,
                      registryUrl.protocol.length - 1);
  var get         = require(protocol).get;
  get({
    hostname : registryUrl.hostname,
    port     : registryUrl.port,
    path     : registryUrl.pathname
  }, function (res) {
    if (res.statusCode !== 200) {
      return cb({
        text    : "Failed to make forward request",
        details : res.statusCode
      });
    }
    res.setEncoding("utf8");

    var body = "";
    res.on("data", function (chunk) {
      body += chunk;
    });
    res.on("end", function () {
      body = JSON.parse(body);

      var registry = app.get("registry");
      registry[packagename] = body;

      if (!registry[packagename]["_fwd-dists"]) {
        registry[packagename]["_fwd-dists"] = {};
      }
      for (var v in registry[packagename].versions) {
        var p = registry[packagename].versions[v];
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
        registry[packagename]["_fwd-dists"][filename] = origTarball;
      }

      persistRegistry(app);

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
    var version     = req.params.version;
    var registry    = app.get("registry");

    function send404 () {
      res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }

    if (!registry[packagename] ||
        (version && registry[packagename].versions &&
         !registry[packagename].versions[version])) {

      return proxyPackage(app, packagename, version, function (err) {
        if (err) {
          winston.error(err.text, err.details);
          return send404();
        }

        res.json(
          200,
          version ? registry[packagename].versions[version] : registry[packagename]
        );
      });

    } else {
      res.json(
        200,
        version ? registry[packagename].versions[version] : registry[packagename]
      );
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
    var registry = app.get("registry");
    if (registry[packagename] && !req.params.revision) {
      return res.json(409, {
        "error"  : "conflict",
        "reason" : "must supply latest _rev to update existing package"
      });
    }

    registry[packagename] = req.body || {};
    if (!registry[packagename]["_rev"]) {
      registry[packagename]["_rev"] = 0;
    }
    persistRegistry(app);

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
    var version = req.params.version;
    var registry = app.get("registry");

    var pkgs = registry[packagename];
    if (!pkgs) {
      registry[packagename] = {
        "_rev" : 0
      };
      pkgs = registry[packagename];
    }
    if (!pkgs.versions) {
      pkgs.versions = {};
    }

    pkgs["versions"][version] = req.body || {};
    if (req.params.tagname === "latest") {
      if (!pkgs["dist-tags"]) {
        pkgs["dist-tags"] = {};
      }
      pkgs["dist-tags"]["latest"] = version;
    }
    pkgs["_rev"] = pkgs["_rev"] + 1;
    persistRegistry(app);

    res.json(200, JSON.stringify(version));
  };
};

/**
 * Unpublish individual package
 */
exports.unpublish = function (app) {
  return function (req, res) {
    winston.info("DELETE " + req.originalUrl, req.body);

    var packagename = req.params.packagename;
    var registry    = app.get("registry");

    function deleteRevision(pkgPath, pkg) {
      var filePath = path.join(
        pkgPath,
        pkg.dist.tarball.substr(pkg.dist.tarball.lastIndexOf("/") + 1)
      );
      fs.unlinkSync(filePath);
    }

    var pkgs = registry[packagename];
    if (pkgs) {
      if (!req.params.revision) {
        delete registry[packagename];
        var pkgPath  = attachment.makePackagePath(app, packagename);
        for (var version in pkgs.versions) {
          var pkg = pkgs.versions[version];
          deleteRevision(pkgPath, pkg);
        }
        fs.rmdirSync(pkgPath);
      }

      persistRegistry(app);
    }

    res.json(200, {"ok" : true});
  };
};

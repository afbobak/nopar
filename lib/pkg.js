/*jslint browser: false */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var bodyParser = require("body-parser");
var fs         = require("fs");
var marked     = require("marked");
var path       = require("path");
var semver     = require("semver");
var url        = require("url");
var winston    = require("winston");

var attachment = require("./attachment");
var registry   = require("./registry");
var settings   = require("./settings");

var defaults = settings.defaults;

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

  var proxyUrl = settings.get("forwarder.proxy");
  proxyUrl     = proxyUrl ? url.parse(proxyUrl) : null;

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

exports.enhancePackage = function (pkg) {
  var href;
  var repository = pkg.repository ||
    pkg.versions[pkg["dist-tags"].latest].repository;

  if (repository && repository.url) {
    // Maybe those git://-URLs can be converted...
    if (repository.url.indexOf("git://") === 0) {
      href = repository.url.
        replace("git://", "https://").
        replace(".git", "/");
      repository.href = href;
    } else if (repository.url.indexOf("git@github") === 0) {
      href = repository.url.
        replace("git@github.com:", "https://github.com/").
        replace(".git", "/");
      repository.href = href;
    } else if (repository.url.indexOf("http") === 0) {
      repository.href = repository.url;
    }
  }
  pkg.repository = repository;

  try {
    pkg["_versions"] = Object.keys(pkg.versions).sort(semver.compare);
  } catch (e) {
    winston.error("Failed to sort versions for package " +
      pkg ? pkg.name : 'unknown package', e);
    console.log(e);
    pkg["_versions"] = Object.keys(pkg.versions);
  }
  var readme = pkg.readme || pkg.versions[pkg["dist-tags"].latest].readme;
  if (readme) {
    pkg["_readme"] = marked(readme);
  }
  pkg["_local"] = !pkg["_proxied"];
};

/**
 * https://github.com/isaacs/npmjs.org#get-packagename
 */
exports.getPackage = function () {
  return function (req, res) {
    winston.info("GET " + req.originalUrl);

    function send404 () {
      res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }

    var packagename = req.params[0] || req.params.name;
    var version  = req.params[1] || req.params.version;
    var settings = req.settingsStore;

    function getPkgMeta(version) {
      return registry.getPackage(packagename, version, settings);
    }
    var pkgMeta = getPkgMeta(null);

    // Refresh from external if: No version was given and ttl expired
    var hasExpired = pkgMeta && pkgMeta["_proxied"] && !version &&
        ((pkgMeta["_mtime"].getTime() + (settings.get("metaTTL") * 1000)) <
          new Date().getTime());

    if (hasExpired && settings.get("forwarder.autoForward")) {
      winston.info("maxTTL expired for package " + packagename);
      return proxyPackage(registry, settings, packagename, version,
        function (err) {
          if (err) {
            winston.warn("Failed to refresh metadata!", err.text, err.details,
              "Returning cached version.");
          }

          return res.json(200, getPkgMeta(version));
        }
      );
    }

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

          res.json(200, getPkgMeta(version));
        }
      );

    } else {
      res.json(200, getPkgMeta(version));
    }
  };
};

/**
 * https://github.com/isaacs/npmjs.org#put-packagename
 */
exports.publishFull = function () {
  return function (req, res, next) {
    winston.info("PUT " + req.originalUrl, req.body);
    if (req.headers["content-type"] !== "application/json") {
      return res.json(400, {
        "error"  : "wrong_content",
        "reason" : "content-type MUST be application/json"
      });
    }

    var pkgName  = req.params.name;
    var settings = req.settingsStore;

    var pkgMeta = registry.getPackage(pkgName);

    var newPkgMeta = req.body || {};
    var incomingRevision = req.params.revision || newPkgMeta["_rev"];

    function updateAndPersist(err) {
      if (err) {
        return next(err);
      }

      pkgMeta = newPkgMeta;
      pkgMeta["_rev"] = increaseRevision(pkgMeta["_rev"]);
      pkgMeta["_proxied"] = false;
      attachment.refreshMeta(settings, pkgMeta);
      registry.setPackage(pkgMeta);

      res.json(200, {"ok" : true});
    }

    if (pkgMeta && !incomingRevision) {
      return res.json(409, {
        "error"  : "conflict",
        "reason" : "must supply latest _rev to update existing package"
      });
    }
    if (pkgMeta && ("" + incomingRevision) !== ("" + pkgMeta["_rev"])) {
      return res.json(409, {
        "error"  : "conflict",
        "reason" : "revision does not match one in document"
      });
    }

    // If we have attachments in the upload, store them
    if (newPkgMeta._attachments) {
      attachment.skimTarballs(settings, newPkgMeta, updateAndPersist);
    } else {
      updateAndPersist();
    }
  };
};

/**
 * https://github.com/isaacs/npmjs.org#put-packagename012
 */
exports.publish = function () {
  return function (req, res) {
    winston.info("PUT " + req.originalUrl, req.body);
    if (req.headers["content-type"] !== "application/json") {
      return res.json(400, {
        "error"  : "wrong_content",
        "reason" : "content-type MUST be application/json"
      });
    }

    var pkgName  = req.params.name;
    var version  = req.params.version;
    var settings = req.settingsStore;

    var pkgMeta = registry.getPackage(pkgName);
    if (!pkgMeta) {
      pkgMeta = {
        name   : pkgName,
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
      var latest = pkgMeta["dist-tags"]["latest"] || "0.0.0";
      if (semver.gt(version, latest)) {
        pkgMeta["dist-tags"]["latest"] = version;
        pkgMeta.description = pkgMeta["versions"][version].description;
        pkgMeta.readme = pkgMeta["versions"][version].readme;
      }
    }
    pkgMeta["_rev"] = increaseRevision(pkgMeta["_rev"]);
    pkgMeta["_proxied"] = false;
    attachment.refreshMeta(settings, pkgMeta);
    registry.setPackage(pkgMeta);

    res.json(200, version);
  };
};

/**
 * Unpublish individual package
 */
exports.unpublish = function () {
  return function (req, res) {
    winston.info("DELETE " + req.originalUrl, req.body);

    var pkgName  = req.params.name;
    var settings = req.settingsStore;

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

    var pkgMeta = registry.getPackage(pkgName);
    if (pkgMeta) {
      var pkgPath = path.join(settings.get("registryPath"), pkgName);
      for (var version in pkgMeta.versions) {
        if (pkgMeta.versions.hasOwnProperty(version)) {
          var pkg = pkgMeta.versions[version];
          deleteRevision(pkgPath, pkg);
        }
      }

      winston.info("Removing package meta: " + pkgName);
      registry.removePackage(pkgName);
      winston.info("Removing package folder: " + pkgPath);
      fs.rmdirSync(pkgPath);
    }

    if (req.accepts('html')) {
      req.flash("message", "Package <strong>" +
        pkgName + "</strong> successfully deleted.");
      res.redirect('/');
    } else {
      res.json(200, {"ok" : true});
    }
  };
};

/**
 * Tag individual package
 */
exports.tag = function () {
  return function (req, res) {
    winston.info("TAG " + req.originalUrl, req.body);

    var pkgName = req.params.name;
    var tagname = req.params.tagname;
    var version = req.body;

    if (req.headers["content-type"] === "application/json") {
      version = JSON.parse(version);
    }

    var pkgMeta = registry.getPackage(pkgName);
    if (!pkgMeta) {
      winston.info("Unknown package to tag: " + pkgName + "@" + version);
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }
    if (!pkgMeta["versions"] || !pkgMeta["versions"][version]) {
      winston.info("Unknown version to tag: " + pkgName + "@" + version);
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }

    winston.info("Tagging package " + pkgName + "@" + version +
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
exports.refresh = function () {
  return function (req, res) {
    winston.info("REFRESH " + req.originalUrl);

    var pkgName  = req.params.name;
    var settings = req.settingsStore;

    function send404 () {
      res.json(404, {
        "error"  : "not_found",
        "reason" : "document not found"
      });
    }

    var pkgMeta = registry.getPackage(pkgName);
    if (!pkgMeta) {
      winston.info("Unknown package to refesh: " + pkgName);
      return send404();
    }

    return proxyPackage(registry, settings, pkgName, undefined,
      function (err) {
        if (err) {
          console.log('err:', err);
          winston.error(err.text, err.details);
          return send404();
        }

        if (req.accepts('html')) {
          req.flash("message", "Package <strong>" +
            pkgName + "</strong> successfully refreshed.");
          exports.render(req, res);
        } else {
          res.json(200, {"ok" : true});
        }
      });
  };
};

exports.render = function render(req, res) {
  var pkgName = req.params.name;
  var vars    = {
    title   : settings.me.name + "@" + settings.me.version,
    version : settings.me.version,
    message : req.flash('message') || null,
    query   : req.params.q || ''
  };

  var pkg = registry.getPackage(pkgName);
  exports.enhancePackage(pkg);
  pkg["_dependents"] = registry.getDependents(pkgName);

  vars.registry = {};
  vars.registry[pkgName] = pkg;

  res.render('package', vars);
};

exports.route = function route(router, options) {
  options = options || {};
  var jsonParser = bodyParser.json({
    limit : options.limit || defaults.limit
  });
  var textParser = bodyParser.text({
    type  : ['json', 'text/plain'],
    limit : options.limit || defaults.limit
  });

  router.get("/:name/:version?", exports.getPackage());

  router.put("/:name", jsonParser, exports.publishFull());
  router.put("/:name/-rev/:revision", jsonParser, exports.publishFull());
  router.put("/:name/:version/-tag/:tagname", jsonParser, exports.publish());
  router.put("/:name/:tagname", textParser, exports.tag());
  router["delete"]("/:name/-rev/:revision", exports.unpublish());
};

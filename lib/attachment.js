/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var fs      = require("fs");
var path    = require("path");
var url     = require("url");
var winston = require("winston");

function makePackagePath(registryPath, packagename) {
  var pkgPath = path.join(registryPath, packagename);
  if (!fs.existsSync(pkgPath)) {
    fs.mkdirSync(pkgPath, "770");
  }
  return pkgPath;
}

function proxyFile(settings, packagename, filename, forwardUrl, cb) {
  winston.info("Downloading tarball " + forwardUrl);

  var httpOptions = forwardUrl;
  var fileUrl     = url.parse(forwardUrl);
  var protocol;

  var proxyUrl = settings.get("forwarder.proxy");
  if (proxyUrl) {
    proxyUrl = url.parse(proxyUrl);
    winston.info("Using proxy " + settings.get("forwarder.proxy"), proxyUrl);
    protocol     = proxyUrl.protocol.substr(0, proxyUrl.protocol.length - 1);
    httpOptions  = {
      hostname : proxyUrl.hostname,
      port     : proxyUrl.port,
      path     : forwardUrl,
      headers  : {
        host         : fileUrl.hostname,
        "User-Agent" : settings.get("forwarder.userAgent")
      },
      rejectUnauthorized : !settings.get("forwarder.ignoreCert")
    };
  } else {
    protocol = fileUrl.protocol.substr(0, fileUrl.protocol.length - 1);
  }

  var get = require(protocol).get;

  get(httpOptions, function (res) {
    if (res.statusCode !== 200) {
      return cb({
        text    : "Failed to retrieve dist package",
        details : res.statusCode
      });
    }
    res.on("error", function (err) {
      winston.error("Error while downloading " + forwardUrl + ": "  + JSON.stringify(err), err);
      cb(err);
    });

    var pkgPath  = makePackagePath(settings.get("registryPath"), packagename);
    var filePath = path.join(pkgPath, filename);
    var out      = fs.createWriteStream(filePath, {
      flags    : "w",
      encoding : null,
      mode     : "0660"
    });
    out.on("error", function (err) {
      winston.error("Error while writing " + filePath + ": "  +
        JSON.stringify(err), err);
      cb(err);
    });
    res.on("end", function () {
      cb();
    });
    res.pipe(out);
  }).on("error", function (err) {
    var msg;
    if (proxyUrl) {
      msg = "Error while downloading " + forwardUrl + " via " +
        settings.get("forwarder.proxy") + ": "  + JSON.stringify(err);
    } else {
      msg = "Error while downloading " + forwardUrl + ": "  +
        JSON.stringify(err);
    }
    winston.error(msg, err);
    cb(err);
  });
}

/**
 * https://github.com/isaacs/npmjs.org#put-packagename012
 */
exports.download = function (app) {
  return function(req, res) {
    winston.info("GET " + req.originalUrl);
    var packagename = req.params.packagename;
    var attachment  = req.params.attachment || "";
    var registry    = app.get("registry");
    var settings    = app.get("settings");

    if (attachment.indexOf("/") >= 0) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "attachment not found"
      });
    }

    var pkgMeta = registry.getPackage(packagename);
    if (!pkgMeta) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "package not found"
      });
    }

    var pkgPath  = makePackagePath(settings.get("registryPath"), packagename);
    var filePath = path.join(pkgPath, attachment);
    if (!fs.existsSync(filePath)) {
      if (pkgMeta["_attachments"][attachment]) {
        proxyFile(
          settings,
          packagename,
          attachment,
          pkgMeta["_attachments"][attachment].forwardUrl,
          function (err) {
            if (err) {
              return res.json("500", err);
            }
            pkgMeta["_attachments"][attachment].cached = true;
            registry.setPackage(pkgMeta);
            res.download(filePath, attachment);
        });
      } else {
        return res.json(404, {
          "error"  : "not_found",
          "reason" : "attachment not found"
        });
      }
    } else {
      res.download(filePath, attachment);
    }
  };
};

/**
 * https://github.com/isaacs/npmjs.org#put-packagename012
 */
exports.attach = function (app) {
  return function(req, res) {
    winston.info("PUT " + req.originalUrl);
    if (req.headers["content-type"] !== "application/octet-stream") {
      return res.json(400, {
        "error"  : "wrong_content",
        "reason" : "content-type MUST be application/octet-stream"
      });
    }

    var attachment = req.params["attachment"];
    if (attachment.indexOf("/") >= 0 || attachment.indexOf("%2F") >= 0) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "attachment not found"
      });
    }

    var registry    = app.get("registry");
    var settings    = app.get("settings");
    var packagename = req.params["packagename"];
    var pkgMeta     = registry.getPackage(packagename);

    var pkgPath  = makePackagePath(settings.get("registryPath"), packagename);
    var filePath = path.join(pkgPath, attachment);
    var out      = fs.createWriteStream(filePath, {
      flags    : "w",
      encoding : null,
      mode     : "0660"
    });
    req.pipe(out);
    req.on("end", function () {
      exports.refreshMeta(settings, pkgMeta);
      registry.setPackage(pkgMeta);

      res.json(200, {
        "ok"  : true,
        "id"  : filePath,
        "rev" : "1"
      });
    });
  };
};

exports.detach = function (app) {
  return function(req, res) {
    winston.info("DELETE " + req.originalUrl, req.body);

    var attachment = req.params["attachment"];
    if (attachment.indexOf("/") >= 0 || attachment.indexOf("%2F") >= 0) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "attachment not found"
      });
    }

    var registry    = app.get("registry");
    var settings    = app.get("settings");

    var packagename = req.params["packagename"];
    var pkgMeta     = registry.getPackage(packagename);
    if (!pkgMeta) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "package not found"
      });
    }

    var pkgPath  = makePackagePath(settings.get("registryPath"), packagename);
    var filePath = path.join(pkgPath, attachment);
    if (!fs.existsSync(filePath)) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "attachment not found"
      });
    }

    fs.unlinkSync(filePath);
    exports.refreshMeta(settings, pkgMeta);
    registry.setPackage(pkgMeta);

    res.json(200, {"ok" : true});
  };
};

/**
 * Extract any tarballs the client has uploaded via _attachments
 *
 * @see https://github.com/npm/npm-skim-registry/blob/841ad861f34c0bc14bf0b113537b4faf17cac70a/skim.js#L99
 *
 * @param  {settings} settings
 * @param  {string}   pkgMeta  client uploaded package.json with attachments
 * @param  {Function} cb       callback
 */
exports.skimTarballs = function(settings, pkgMeta, cb) {
  if (!pkgMeta["_attachments"] || !pkgMeta.versions) {
    return cb();
  }

  var attachments = pkgMeta["_attachments"];
  delete pkgMeta["_attachments"];

  var pkgPath = makePackagePath(settings.get("registryPath"), pkgMeta.name);

  var toSave = 0;
  Object.keys(pkgMeta.versions).forEach(function(v) {
    var p = pkgMeta.versions[v];
    var attachment = p.dist.tarball.substr(
                     p.dist.tarball.lastIndexOf("/") + 1);
    if (attachments[attachment] && attachments[attachment].data) {
      saveTarball(attachment, attachments[attachment].data);
    }
  });

  function saveTarball(attachment, base64data) {
    ++toSave;
    fs.writeFile(path.join(pkgPath, attachment), base64data, {
      flags    : "w",
      encoding : "base64",
      mode     : "0660"
    }, onSaveComplete);
  }

  if (!toSave) {
    return cb();
  }

  function onSaveComplete(err) {
    if (err) {
      cb(err);
      cb = function(){};
    } else if (--toSave === 0) {
      cb();
    }
  }
};

exports.refreshMeta = function (settings, pkgMeta) {
  var attachments = {};
  var packagename = pkgMeta.name;
  var pkgPath     = makePackagePath(settings.get("registryPath"), packagename);

  for (var v in pkgMeta.versions) {
    var p = pkgMeta.versions[v];
    var attachment  = p.dist.tarball.substr(
                      p.dist.tarball.lastIndexOf("/") + 1);
    var origTarball = p.dist.tarball;

    if (!attachments[attachment]) {
      var filePath = path.join(pkgPath, attachment);
      attachments[attachment] = {
        cached     : fs.existsSync(filePath),
        forwardUrl : origTarball
      };
    }
  }

  pkgMeta["_attachments"] = attachments;
};


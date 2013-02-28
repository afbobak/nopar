/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var fs      = require("fs");
var path    = require("path");
var winston = require("winston");

function makePackagePath(app, packagename) {
  var pkgPath = path.join(app.get("registryPath"), packagename);
  if (!fs.existsSync(pkgPath)) {
    fs.mkdirSync(pkgPath, "770");
  }
  return pkgPath;
}
exports.makePackagePath = makePackagePath;

function proxyFile(app, packagename, filename, forwardUrl, cb) {
  winston.info("Downloading tarball " + forwardUrl);
  require("http").get(forwardUrl, function (res) {
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

    var pkgPath  = makePackagePath(app, packagename);
    var filePath = path.join(pkgPath, filename);
    var out      = fs.createWriteStream(filePath, {
      flags    : "w",
      encoding : null,
      mode     : "0660"
    });
    out.on("error", function (err) {
      winston.error("Error while writing " + filePath + ": "  + JSON.stringify(err), err);
      cb(err);
    });
    res.on("end", function () {
      cb();
    });
    res.pipe(out);
  });
}

/**
 * https://github.com/isaacs/npmjs.org#put-packagename012
 */
exports.download = function (app) {
  return function(req, res) {
    winston.info("GET " + req.originalUrl);
    var packagename = req.params.packagename;
    var attachment = req.params["attachment"] || "";
    var registry    = app.get("registry");

    if (!registry[packagename]) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "package not found"
      });
    }

    if (attachment.indexOf("/") >= 0) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "attachment not found"
      });
    }

    var pkgPath  = makePackagePath(app, packagename);
    var filePath = path.join(pkgPath, attachment);

    if (!fs.existsSync(filePath)) {
      if (registry[packagename]["_fwd-dists"][attachment]) {
        proxyFile(
          app,
          packagename,
          attachment,
          registry[packagename]["_fwd-dists"][attachment],
          function (err) {
            if (err) {
              return res.json("500", err);
            }
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
    if (attachment.indexOf("/") >= 0) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "attachment not found"
      });
    }

    var pkgPath  = makePackagePath(app, req.params.packagename);
    var filePath = path.join(pkgPath, attachment);
    var out      = fs.createWriteStream(filePath, {
      flags    : "w",
      encoding : null,
      mode     : "0660"
    });
    req.pipe(out);
    req.on("end", function () {
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

    var registry = app.get("registry");
    var packagename = req.params["packagename"];
    if (!registry[packagename]) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "package not found"
      });
    }

    var attachment = req.params["attachment"];
    if (attachment.indexOf("/") >= 0) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "attachment not found"
      });
    }

    var pkgPath  = makePackagePath(app, req.params.packagename);
    var filePath = path.join(pkgPath, attachment);
    if (!fs.existsSync(filePath)) {
      return res.json(404, {
        "error"  : "not_found",
        "reason" : "attachment not found"
      });
    }

    fs.unlinkSync(filePath);

    res.json(200, {"ok" : true});
  };
};

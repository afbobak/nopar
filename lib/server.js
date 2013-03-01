/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var express    = require("express");
var fs         = require("fs");
var http       = require("http");
var path       = require("path");
var winston    = require("winston");
var app        = express();
var attachment = require("./attachment");
var pkg        = require("./pkg");

function readRegistry(app) {
  var registry = {};
  var registryFile = app.get("registryFile");
  if (fs.existsSync(registryFile)) {
    registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
  }
  app.set("registry", registry);
}

if (process.env.LOGFILE) {
  winston.add(winston.transports.File, {
    level    : process.env.LOGLEVEL || "info",
    colorize : false,
    filename : process.env.LOGFILE,
    maxsize  : 1*1024*1024*1024,
    maxFiles : 10,
    json     : false
  });
}

app.configure(function () {

  var registryPath = process.env.REGISTRYPATH ||
                     path.normalize(path.join(__dirname, "..", "registry"));
  app.set("registryPath", registryPath);
  app.set("registryFile", path.join(registryPath, "registry.json"));

  var forwarder = {
    registry : "https://registry.npmjs.org"
  };
  app.set("forwarder", forwarder);
  app.set("hostname", process.env.HOSTNAME || "localhost");
  app.set("port", process.env.PORT || 5984);
  app.set("views", path.normalize(path.join(__dirname, "../views")));
  app.set("view engine", "ejs");
  app.use(express.favicon());
  app.use(express.logger("dev"));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser("your secret here"));
  app.use(express.session());
  app.use(app.router);
  app.use("/-/css", require("stylus").middleware(
    path.normalize(path.join(__dirname, "..", "public", "css"))
  ));
  app.use("/-", express["static"](
    path.normalize(path.join(__dirname, "..", "public"))
  ));
});

app.configure("development", function() {
  app.use(express.errorHandler());
});

// Initialize registry
if (!fs.existsSync(app.get("registryPath"))) {
  fs.mkdirSync(app.get("registryPath"), "750");
}
readRegistry(app);

function renderIndex(req, res, message) {
  var me = require("../package.json");
  var registry = app.get("registry");
  var vars = {
    title    : me.name + "@" + me.version,
    version  : me.version,
    message  : typeof message === "string" ? message : null,
    query    : req.query.q || ""
  };

  if (req.query.q) {
    var packages = Object.keys(registry).sort();
    var found = {};
    for (var i = 0; i < packages.length; i++) {
      var pkgName = packages[i];
      if (pkgName.indexOf(req.query.q) >= 0) {
        found[pkgName] = registry[pkgName];
      }
    }
    vars.registry = found;
  } else {
    vars.registry = registry;
  }

  res.render("index", vars);
}

/**
 * GET index.
 */
app.get("/", renderIndex);

/*
 * Web Actions
 */
app.get("/-delete/:packagename", pkg.unpublish(app, function (req, res) {
  renderIndex(req, res,
    "Package <b>" + req.params.packagename + "</b> successfully deleted.");
}));

/*
 * Package methods
 */
app.get("/:packagename/:version?", pkg.getPackage(app));
app.put("/:packagename", pkg.publishFull(app));
app.put("/:packagename/-rev/:revision", pkg.publishFull(app));
app.put("/:packagename/:version/-tag?/:tagname?", pkg.publish(app));
app["delete"]("/:packagename/-rev?/:revision?", pkg.unpublish(app));

/*
 * Attachment methods
 */
app.get("/:packagename/-/:attachment", attachment.download(app));
app.put("/:packagename/-/:attachment/-rev?/:revision?", attachment.attach(app));
app["delete"]("/:packagename/-/:attachment/-rev?/:revision?",
  attachment.detach(app));

module.exports = app;

if (!module.parent) {
  http.createServer(app).listen(
    app.get("port"),
    app.get("hostname"),
    function () {
      winston.info("Abstrakt NPM Registry Proxy started on port " + app.get("port"));
    }
  );
} else {
  // Running buster-test, removing default console logger
  winston.remove(winston.transports.Console);
}

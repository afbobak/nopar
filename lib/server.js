/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var bodyParser   = require("body-parser");
var cookieParser = require("cookie-parser");
var express      = require("express");
var favicon      = require("static-favicon");
var fs           = require("fs");
var http         = require("http");
var marked       = require("marked");
var morgan       = require("morgan");
var path         = require("path");
var semver       = require("semver");
var session      = require("express-session");
var winston      = require("winston");

var registry   = require("./registry");
var attachment = require("./attachment");
var pkg        = require("./pkg");
var settings   = require("./settings");

var app        = express();

var env = process.env.NODE_ENV || "development";

if (process.env.NOPAR_LOGFILE) {
  winston.add(winston.transports.File, {
    level    : process.env.NOPAR_LOGLEVEL || "info",
    colorize : false,
    filename : process.env.NOPAR_LOGFILE,
    maxsize  : 5*1024*1024,
    maxFiles : 10,
    json     : false
  });

  var winstonStream = {
    write : function (message, encoding) {
      winston.info(message.substr(0, message.length - 1));
    }
  };
  app.use(express.logger({ stream : winstonStream }));
}

// Initialize registry
var registryPath = process.env.NOPAR_REGISTRY_PATH || settings.defaults.registryPath;
if (!fs.existsSync(registryPath)) {
  fs.mkdirSync(registryPath, "750");
}
registry.init(registryPath);

var settingsStore = settings.init(registry);
registry.refreshMeta(settingsStore);

app.set("registryPath", registryPath);
app.set("registry", registry);

app.set("settings", settingsStore);

app.set("views", path.normalize(path.join(__dirname, "../views")));
app.set("view engine", "ejs");
app.use(favicon());
app.use(morgan("dev")); // that's the logger
app.use(bodyParser({ strict : false }));
app.use(cookieParser());
app.use(session({ secret: "nopar.secret", key: "nopar"}));

app.use("/-/css", require("stylus").middleware(
  path.normalize(path.join(__dirname, "..", "public", "css"))
));
app.use("/-", express["static"](
  path.normalize(path.join(__dirname, "..", "public"))
));

if ("development" == env) {
  app.use(require("errorhandler")());
}

function renderIndex(req, res, message) {
  var page;
  var meta = registry.getMeta();
  var vars = {
    title   : settings.me.name + "@" + settings.me.version,
    version : settings.me.version,
    message : typeof message === "string" ? message : null,
    query   : req.query.q || "",
    total   : meta.count,
    local   : meta.local,
    proxied : meta.proxied
  };

  if (req.query.q || req.query.local) {
    page = "results";
    vars.registry = req.query.local ?
      registry.queryLocal(req.query.q, settingsStore) : registry.query(req.query.q, settingsStore);
    vars.count = 0;

    for (var pkgName in vars.registry) {
      vars.count++;

      var pkg = vars.registry[pkgName];
      if (pkg.repository && pkg.repository.url &&
          pkg.repository.url.indexOf("git://github.com") === 0) {
        var href = pkg.repository.url.
          replace("git://", "https://").
          replace(".git", "/");
        pkg.repository.href = href;
      }

      try {
        pkg["_versions"] = Object.keys(pkg.versions).sort(semver.compare);
      } catch (e) {
        winston.error("Failed to sort versions for package " + pkgName, e);
        pkg["_versions"] = Object.keys(pkg.versions);
      }
      var readme = pkg.readme || pkg.versions[pkg["dist-tags"].latest].readme;
      if (readme) {
        pkg["_readme"] = marked(readme);
      }
      pkg["_local"] = !pkg["_proxied"];
    }
  } else {
    page = "index";
  }

  res.render(page, vars);
}

/**
 * GET index.
 */
app.get("/", renderIndex);

/**
 * Settings
 */
app.get("/-/settings", settings.render(settingsStore));
app.post("/-/settings", settings.save(registry, settingsStore));

/*
 * Web Actions
 */
app.get("/-delete/:packagename", pkg.unpublish(app, function (req, res) {
  renderIndex(req, res,
    "Package <strong>" + req.params.packagename + "</strong> successfully deleted.");
}));
app.get("/-refresh/:packagename", pkg.refresh(app, function (req, res) {
  renderIndex(req, res,
    "Package <strong>" + req.params.packagename + "</strong> successfully refreshed.");
}));

/**
 * User and Session methods
 */
app.put("/-/user/:couchuser", function (req, res) {
  winston.info("PUT " + req.originalUrl, req.body);
  //req.body.name
  //req.body.salt
  //req.body.password_sha
  //req.body.email
  //req.body.type=user
  //req.body.roles
  //req.body.date

  // 201 == Created
  res.json(201, {"ok" : true});
});
app.post("/_session", function (req, res) {
  winston.info("POST " + req.originalUrl, req.body);
  //req.body.name
  //req.body.password
  res.cookie("AuthSession", "UNUSED_SO_FAR");
  res.json(200, {"ok" : true});
});

/*
 * Package methods
 */
app.get("/:packagename/:version?", pkg.getPackage(app));
app.put("/:packagename", pkg.publishFull(app));
app.put("/:packagename/-rev/:revision", pkg.publishFull(app));
app.put("/:packagename/:tagname", pkg.tag(app));
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
  winston.info("Registry Path: " + settingsStore.get("registryPath"));

  http.createServer(app).listen(
    settingsStore.get("port"),
    settingsStore.get("hostname"),
    function () {
      winston.info("NOPAR started on port " + settingsStore.get("port"));
      winston.info("With Base URL:", settingsStore.get("baseUrl"));
    }
  );
}

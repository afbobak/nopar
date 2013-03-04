/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var express    = require("express");
var fs         = require("fs");
var http       = require("http");
var md         = require("node-markdown").Markdown;
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

if (process.env.NOPAR_LOGFILE) {
  winston.add(winston.transports.File, {
    level    : process.env.NOPAR_LOGLEVEL || "info",
    colorize : false,
    filename : process.env.NOPAR_LOGFILE,
    maxsize  : 1*1024*1024*1024,
    maxFiles : 10,
    json     : false
  });

  var winstonStream = {
    write : function (message, encoding) {
      winston.info(message);
    }
  };
  app.use(express.logger({ stream : winstonStream }));
}

app.configure(function () {

  var registryPath = process.env.NOPAR_REGISTRY_PATH ||
                     path.normalize(path.join(__dirname, "..", "registry"));
  app.set("registryPath", registryPath);
  app.set("registryFile", path.join(registryPath, "registry.json"));

  var forwarder = {
    registry : "https://registry.npmjs.org"
  };
  app.set("forwarder", forwarder);
  app.set("hostname", process.env.NOPAR_HOSTNAME || "localhost");
  app.set("port", process.env.NOPAR_PORT || 5984);
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

  // Initialize registry
  winston.info("Registry Path: " + registryPath);
  if (!fs.existsSync(registryPath)) {
    fs.mkdirSync(registryPath, "750");
  }
  readRegistry(app);
});

app.configure("development", function() {
  app.use(express.errorHandler());
});

function renderIndex(req, res, message) {
  var me = require("../package.json");
  var registry = app.get("registry");
  var page = "index";
  var pkgName, i;
  var vars = {
    title   : me.name + "@" + me.version,
    version : me.version,
    message : typeof message === "string" ? message : null,
    query   : req.query.q || "",
    count   : 0,
    total   : Object.keys(registry).length,
    local   : 0,
    proxied : 0
  };

  if (req.query.q) {
    var found = {};
    for (pkgName in registry) {
      if (pkgName.indexOf(req.query.q) >= 0) {
        found[pkgName] = registry[pkgName];
      }
    }
    vars.registry = found;
    page = "results";
  } else {
    vars.registry = registry;
  }

  for (pkgName in vars.registry) {
    var pkg = vars.registry[pkgName];
    var readme = pkg.readme || pkg.versions[pkg["dist-tags"].latest].readme;
    if (readme) {
      pkg["_readme"] = null;//md(readme.replace("<", "&lt;").replace(">", "&gt;"), true);
    }

    pkg["_proxied"] = pkg["_fwd-dists"] ? true : false;
    pkg["_local"] = !pkg["_proxied"];

    vars.count++;
    if (pkg["_proxied"]) {
      vars.proxied++;
    } else if (pkg["_local"]) {
      vars.local++;
    }
  }

  res.render(page, vars);
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
    "Package <strong>" + req.params.packagename + "</strong> successfully deleted.");
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
      winston.info("NOPAR started on port " + app.get("port"));
    }
  );
} else {
  // Running buster-test, removing default console logger
  winston.remove(winston.transports.Console);
}

/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var cookieParser   = require("cookie-parser");
var express        = require("express");
var expressSession = require("express-session");
var favicon        = require("serve-favicon");
var flash          = require("connect-flash");
var fs             = require("fs");
var http           = require("http");
var morgan         = require("morgan");
var path           = require("path");
var winston        = require("winston");

var attachment = require("./attachment");
var gui        = require("./gui");
var pkg        = require("./pkg");
var registry   = require("./registry");
var settings   = require("./settings");
var session    = require("./session");
var user       = require("./user");

var env      = process.env.NODE_ENV || "development";
var defaults = settings.defaults;

exports.createApp = function (options) {

  options = options || {};

  var app = express();

  if (options.logfile || defaults.logfile) {
    winston.add(winston.transports.File, {
      level    : options.loglevel || defaults.loglevel,
      colorize : false,
      filename : options.logfile || defaults.logfile,
      maxsize  : 5*1024*1024,
      maxFiles : 10,
      json     : false
    });

    var winstonStream = {
      write : function (message, encoding) {
        winston.info(message.substr(0, message.length - 1));
      }
    };
    app.use(morgan({ stream : winstonStream }));
  } else if (options.loglevel != 'silent') {
    app.use(morgan("dev"));
  }

  if ("development" == env) {
    app.use(require("errorhandler")());
  }

  app.set("views", path.normalize(path.join(__dirname, "../views")));
  app.set("view engine", "ejs");

  // Initialize registry
  var registryPath = options.registryPath || defaults.registryPath;
  if (!fs.existsSync(registryPath)) {
    fs.mkdirSync(registryPath, "750");
  }
  registry.init(registryPath);

  app.use(cookieParser());
  app.use(expressSession({
    resave            : true,
    saveUninitialized : true,
    secret            : "nopar.secret",
    key               : "nopar"
  }));
  app.use(flash());
  app.use(settings.middleware(registry));

  return app;
};

exports.start = function (app, options) {
  options = options || {};
  if (!app) {
    app = exports.createApp(options);
  }

  user.route(app);
  session.route(app);
  pkg.route(app);
  attachment.route(app);

  var guiRouter = express.Router({
    caseSensitive : true
  });
  app.use('/-', guiRouter);
  gui.route(guiRouter);
  gui.routeIndex(app);

  var hostname = options.hostname || defaults.hostname;
  var port     = options.port || defaults.port;
  var server   = http.createServer(app);
  server.listen(port, hostname, function () {
    winston.info("NOPAR started on port " + port);
    winston.info("With Base URL:", options.baseUrl || defaults.baseUrl);
  });

  process.on("SIGTERM", function () {
    server.close(function () {
      // Disconnect from cluster master
      process.disconnect && process.disconnect();
    });
  });
};

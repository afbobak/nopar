/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var fs         = require("fs");
var path       = require("path");
var attachment = require("./attachment");
var registry   = require("./registry");
var winston    = require("winston");

var me = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")));
exports.me = me;

var defaults = {
  "logfile"               : "",
  "registryPath"          : process.env.NOPAR_REGISTRY_PATH || path.normalize(path.join(__dirname, "..", "registry")),
  "hostname"              : process.env.NOPAR_HOSTNAME || "localhost",
  "port"                  : process.env.NOPAR_PORT || 5984,
  "base_url"              : process.env.NOPAR_BASE_URL || "",
  "forwarder.registry"    : process.env.NOPAR_FORWARDER_URL || "https://registry.npmjs.org",
  "forwarder.proxy"       : process.env.NOPAR_PROXY_URL || undefined,
  "forwarder.autoForward" : process.env.NOPAR_AUTO_FORWARD === null ||
                            process.env.NOPAR_AUTO_FORWARD === undefined ||
                            process.env.NOPAR_AUTO_FORWARD === "" ||
                            process.env.NOPAR_AUTO_FORWARD === "yes" ? true : false,
  "forwarder.ignoreCert"  : (process.env.NOPAR_IGNORE_CERT === null ||
                            process.env.NOPAR_IGNORE_CERT === undefined ||
                            process.env.NOPAR_IGNORE_CERT === "") ? false :
                            (process.env.NOPAR_IGNORE_CERT === "yes" ? true : false),
  "forwarder.userAgent"   : process.env.NOPAR_USER_AGENT || "nopar/" + me.version
};
exports.defaults = defaults;

function getRenderer(settings) {
  var defaults = settings.defaults;
  return function renderSettings(req, res, message) {
    var vars     = {
      title    : me.name + "@" + me.version,
      version  : me.version,
      message  : typeof message === "string" ? message : null,
      query    : (req.query && req.query.q) || "",
      settings : {
        hostname     : settings.get("hostname"),
        port         : settings.get("port"),
        registryPath : settings.get("registryPath"),
        forwarder    : {
          registry    : settings.get("forwarder.registry"),
          proxy       : settings.get("forwarder.proxy"),
          autoForward : settings.get("forwarder.autoForward"),
          ignoreCert  : settings.get("forwarder.ignoreCert"),
          userAgent   : settings.get("forwarder.userAgent")
        }
      },
      defaults : defaults
    };
    if (vars.settings.forwarder.registry === defaults["forwarder.registry"]) {
      vars.settings.forwarder.registry = null;
    }
    if (vars.settings.forwarder.proxy === defaults["forwarder.proxy"]) {
      vars.settings.forwarder.proxy = null;
    }
    // TODO: Make a test-case for these, if values for checkboxes are nulled-out
    //       for default values the value on the rendering side is always false.
    // if (vars.settings.forwarder.autoForward === defaults["forwarder.autoForward"]) {
    //   vars.settings.forwarder.autoForward = null;
    // }
    // if (vars.settings.forwarder.ignoreCert === defaults["forwarder.ignoreCert"]) {
    //   vars.settings.forwarder.ignoreCert = null;
    // }
    if (vars.settings.forwarder.userAgent === defaults["forwarder.userAgent"]) {
      vars.settings.forwarder.userAgent = null;
    }
    if (vars.settings.hostname === defaults.hostname) {
      vars.settings.hostname = null;
    }
    if ("" + vars.settings.port === "" + defaults.port) {
      vars.settings.port = null;
    }

    res.render("settings", vars);
  };
}

function getter(settings) {
  return function (key) {
    if (key) {
      return settings.data[key];
    }
    var data = JSON.parse(JSON.stringify(settings.data));
    for (key in data) {
      if (data[key] === settings.defaults[key]) {
        delete data[key];
      }
    }
    return data;
  };
}

function setter(settings) {
  return function (key, value) {
    if (value === null || value === undefined) {
      delete settings.data[key];
    } else {
      settings.data[key] = value;
    }
  };
}

exports.init = function init(registry) {
  var settings = {
    defaults : JSON.parse(JSON.stringify(defaults)),
    data     : {}
  };
  settings.set = setter(settings);
  settings.get = getter(settings);

  var key;
  for (key in settings.defaults) {
    settings.set(key, settings.defaults[key]);
  }

  var metaSettings = registry.getMeta().settings;
  for (key in metaSettings) {
    settings.set(key, metaSettings[key] || settings.defaults[key]);
  }

  return settings;
};

exports.render = function render(settings) {
  return getRenderer(settings);
};

exports.save = function save(registry, settings) {
  var renderer = getRenderer(settings);

  return function (req, res, message) {
    var body = req.body;

    var hostname = body.hostname || settings.defaults.hostname;
    var port = body.port === "" ? settings.defaults.port : +body.port;

    var updateUrls = (hostname !== settings.get("hostname")) ||
                     (port !== settings.get("port"));

    settings.set("hostname", hostname);
    settings.set("port", port);
    settings.set("forwarder.registry",
      body.registry || settings.defaults["forwarder.registry"]);
    settings.set("forwarder.proxy", body.proxy ||
      settings.defaults["forwarder.proxy"]);
    settings.set("forwarder.autoForward", body.autoForward ? true : false);
    settings.set("forwarder.ignoreCert", body.ignoreCert ? true : false);
    settings.set("forwarder.userAgent",
      body.userAgent || settings.defaults.userAgent);

    var meta = registry.getMeta();
    meta.settings = settings.get();
    winston.info("Saving settings: " + JSON.stringify(meta.settings));
    registry.writeMeta();
    message = "Saved settings.";

    if (updateUrls) {
      registry.iteratePackages(function (name, pkgMeta) {
        attachment.refreshMeta(settings, pkgMeta);
        registry.setPackage(pkgMeta);
      });

      message = "Hostname/port changed. You probably have to restart NOPAR.";
    }

    return renderer(req, res, message);
  };
};

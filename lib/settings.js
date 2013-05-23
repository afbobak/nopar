/*jslint browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var fs       = require("fs");
var path     = require("path");
var registry = require("./registry");
var winston  = require("winston");

var me = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")));
exports.me = me;

var defaults = {
  "logfile"               : "",
  "registryPath"          : path.normalize(path.join(__dirname, "..", "registry")),
  "hostname"              : process.env.NOPAR_HOSTNAME || "localhost",
  "port"                  : process.env.NOPAR_PORT || 5984,
  "forwarder.registry"    : process.env.NOPAR_FORWARDER_URL || "https://registry.npmjs.org",
  "forwarder.proxy"       : process.env.NOPAR_PROXY_URL || null,
  "forwarder.autoForward" : process.env.NOPAR_AUTO_FORWARD === null ||
                            process.env.NOPAR_AUTO_FORWARD === undefined ||
                            process.env.NOPAR_AUTO_FORWARD === "" ||
                            process.env.NOPAR_AUTO_FORWARD === "yes" ? true : false,
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
    if (vars.settings.forwarder.proxy === defaults["forwarder.proxy"]) {
      vars.settings.forwarder.proxy = null;
    }
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
    settings.data[key] = value;
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
    if (body.hostname) {
      settings.set("hostname", body.hostname);
    }
    if (body.port) {
      settings.set("port", +body.port);
    }
    if (body.registry) {
      settings.set("forwarder.registry", body.registry);
    }
    if (body.proxy) {
      settings.set("forwarder.proxy", body.proxy);
    }
    settings.set("forwarder.autoForward", body.autoForward ? true : false);
    if (body.userAgent) {
      settings.set("forwarder.userAgent", body.userAgent);
    }

    // TODO - change package attachments URLs if hostname/port changes

    var meta = registry.getMeta();
    meta.settings = settings.get();
    winston.info("Saving settings: " + JSON.stringify(meta.settings));
    registry.writeMeta();

    return renderer(req, res, message);
  };
};

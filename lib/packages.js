/*jslint browser: false */
/*globals */
/*! Copyright (C) 2014 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var marked  = require("marked");
var semver  = require("semver");
var winston = require("winston");

var pkg      = require('./pkg');
var registry = require('./registry');
var settings = require('./settings');

exports.render = function render(req, res) {
  var filter = req.params.filter || 'all';
  var meta   = registry.getMeta();
  var vars   = {
    title   : settings.me.name + "@" + settings.me.version,
    version : settings.me.version,
    message : req.flash('message') || null,
    filter  : filter,
    query   : req.query.q || "",
    all     : meta.count,
    local   : meta.local,
    proxied : meta.proxied,
  };

  switch (filter) {
  case 'all':
    vars.total = vars.all;
    break;
  case 'local':
    vars.total = vars.local;
    break;
  case 'proxied':
    vars.total = vars.proxied;
    break;
  }

  vars.registry = registry.query(req.query.q, req.settingsStore, filter);
  vars.count = 0;
  for (var pkgName in vars.registry) {
    vars.count++;
    pkg.enhancePackage(vars.registry[pkgName]);
  }

  res.render('packages', vars);
};

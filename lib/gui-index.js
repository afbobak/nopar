/*jslint browser: false */
/*! Copyright (C) 2014 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var registry = require('./registry');
var settings = require('./settings');

exports.render = function render(req, res) {
  var meta = registry.getMeta();

  var vars = {
    title   : settings.me.name + "@" + settings.me.version,
    version : settings.me.version,
    message : req.flash('message') || null,
    total   : meta.count,
    local   : meta.local,
    proxied : meta.proxied,
    query   : ''
  };

  res.render("index", vars);
};

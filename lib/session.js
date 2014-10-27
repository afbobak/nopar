/*jslint browser: false */
/*globals */
/*! Copyright (C) 2014 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var winston = require("winston");

exports.create = function (req, res) {
  winston.info("POST " + req.originalUrl, req.body);
  //req.body.name
  //req.body.password
  res.cookie("AuthSession", "UNUSED_SO_FAR");
  res.json(200, {"ok" : true});
};

exports.route = function route(router) {
  router.post('/_session', exports.create);
};

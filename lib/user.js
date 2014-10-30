/*jslint browser: false */
/*! Copyright (C) 2014 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var winston = require("winston");

// /-/user/:couchuser
exports.update = function (req, res) {
  winston.info("PUT " + req.originalUrl, req.body);
  //req.body.name
  //req.body.salt
  //req.body.password_sha
  //req.body.email
  //req.body.type=user
  //req.body.roles
  //req.body.date

  // 201 == Created
  res.status(201).json({"ok" : true});
};

exports.route = function route(router) {
  router.put('/-/user/:couchuser', exports.update);
};

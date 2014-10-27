/*jslint browser: false */
/*! Copyright (C) 2014 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var express = require('express');
var path    = require('path');
var stylus  = require('stylus');

var pkg      = require('./pkg');
var packages = require('./packages');
var settings = require('./settings');

var PUBLIC_PATH = path.normalize(path.join(__dirname, '..', 'public'));
var CSS_PATH    = path.join(PUBLIC_PATH, 'css');

exports.route = function (router) {
  router.use('/css', stylus.middleware(CSS_PATH));
  router.use('/', express.static(PUBLIC_PATH));

  router.route('/settings')
    .get(settings.render())
    .post(settings.save());

  router.get('/packages/:filter?', packages.render);
  router.get('/package/:name', pkg.render);
  router.get('/package/:name/refresh', pkg.refresh());
  router.get('/package/:name/delete', pkg.unpublish());
};

exports.routeIndex = function (router) {
  router.get('/', require('./gui-index').render);
};

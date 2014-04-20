/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

exports.findRoute = function(server, path) {
  /*jslint nomen: true */
  var stack = server._router.stack;

  var i, layer;
  for (i = stack.length - 1; i >= 0; i--) {
    layer = stack[i];
    if (layer.route && layer.route.path === path) {
      return layer.route;
    }
  }
  return;
};

exports.findHandle = function(route, method) {
  var i, stack = route.stack;
  for (i = stack.length - 1; i >= 0; i--) {
    if (stack[i].method === method) {
      return stack[i].handle;
    }
  }
  return;
};

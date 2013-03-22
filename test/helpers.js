/*jslint devel: true, node: true */
/*global */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/
"use strict";

exports.findCall = function(calls, path) {
  var i;
  for (i = calls.length - 1; i >= 0; i--) {
    if (calls[i].path === path) {
      return calls[i];
    }
  }
  return;
};


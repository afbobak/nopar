/*jslint devel: true, browser: false */
/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

var config = module.exports;

config["npm-proxy tests"] = {
  env      : "node",
  rootPath : "../",
  tests : [
    "test/*-test.js"
  ],
  extensions    : [require("buster-lint")],
  "buster-lint" : {
    paths          : [
      "lib/*.js"
    ],
    linter         : "jslint",  // optionally: jshint
    linterOptions  : {          // see default-configuration.js for a list of all options
      predef   : [],        // a list of known global variables,
      vars     : true,
      plusplus : true,
      sloppy   : false,
      trailing : true,
      indent   : 2,
      maxlen   : 120
    },
    excludes       : []         // a list of strings/regexes matching filenames that should not be linted
  }
};

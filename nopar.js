/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

if (process.argv.length === 3 && process.argv[2] === '--detach') {
  require('daemon')();
}

var NOPAR_RUN_PATH = process.env['NOPAR_RUN_PATH'] || '.';
var fs = require("fs");
var path = require("path");
fs.writeFileSync(path.join(NOPAR_RUN_PATH, "nopar.pid"), process.pid);

require('./lib/server').start();

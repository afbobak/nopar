/*globals */
/*! Copyright (C) 2013 by Andreas F. Bobak, Switzerland. All Rights Reserved. !*/

if (process.argv.length === 3 && process.argv[2] === '--detach') {
  require('daemon')();
}

require('./lib/server').start();

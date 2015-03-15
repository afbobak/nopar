
0.6.3 / 2015-03-15
==================

 * fix: nopar user env variable in Debian scripts
 * fix/improve: DEBIAN start/stop/script
 * improve: add favicon
 * Fixed code formatting
 * Removed exclusive test-case
 * Added test case
 * Prevent JSON.parse to throw an error when the metadata received is not valid JSON
 * fix: initd script reads/writes correct nopar.pid file
 * fix: add daemon to package.json and create nopar.pid

0.6.2 / 2014-11-16
==================

 * test: for _mtime on getPackage
 * fix: convert string mtime to Date

0.6.1 / 2014-11-16
==================

 * improve: move error handling to the bottom and add one if != dev
 * fix: Internal Server Error

0.6.0 / 2014-10-30
==================

 * feat: add nopar.js with arg --detach
 * feat: add package meta json cache
 * feat: add package meta json cache
 * feat: add packaging a .deb package
 * feat: add page for single packages, change search results page
 * fix: attachment refresh
 * fix: express deprecations and be more lenient with supertest
 * fix: prerem script if init.d script is missing
 * fix: save settings
 * fix: unit tests by fixing .gitignore
 * improve: always use local jquery
 * refactor: URL paths and unit tests
 * test: add jshint
 * test: add unit tests for url routes
 * test: attachment refresh meta
 * test: fix jshint

0.5.0 / 2014-08-05
==================

 * Add feature 'dependents'
 * Add 'watch' script so we can 'npm run watch'
 * Fix repository URL for local repos
 * Balance labels a bit better

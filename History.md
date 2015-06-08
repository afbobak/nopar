0.8.1 / 2015-06-08
==================

  * 6e4ddc3 feat: add support for /-/package/xxx/dist-tags
  * e2fffb8 fix: be consistent with latest and highest version

0.8.0 / 2015-06-06
==================

  * ff1fe51 fix: copy-paste bug
  * 64cf35b fix: can't sort non-semver versions
  * b582105 feat: mark outdated dependents
  * 318bd4f feat: mark outdated dependencies
  * 23337de improve: don't publish pkg and test files

0.7.2 / 2015-06-03
==================

  * b8bd9bf fix: refresh and delete URLs

0.7.1 / 2015-06-02
==================

  * 955b8b8 fix: gui tests for scoped packages
  * 48439bc fix: allow '/' scoped packages for UI
  * 1aefc5e fix: repository URLs in style of 'git+http'
  * 9c57683 improve: be smarter with scoped URLs
  * b2f142d Run tests on 0.12 as well
  * 9da939a Only respond after attachment stream is finished writing
  * eeed233 chore: fix merge conflict
  * 90b2f94 chore: bump dependencies
  * f6f1661 chore: bump winston@1.0
  * 2a615ab doc: bring History up-to-date

0.7.0 / 2015-05-03
==================

 * Proxy & publish scoped packages

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

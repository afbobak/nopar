NOPAR - The Node PAckage Registry & proxy
=========================================

Provides a local NPM registry that also proxies and caches unknown node packages
from the original npm registry at <http://registry.npmjs.org>.

[![Build Status](https://travis-ci.org/afbobak/nopar.png)](https://travis-ci.org/afbobak/nopar)

Install the server
------------------

It's available from the official NPM registry, so all you need is:

    npm install -g nopar

On my build server I create an archive (see ``scripts/package``) and extract the
whole shebang into ``/usr/local/nopar`` with an install script
(see ``scripts/install-nopar.sh``).


Usage
-----

If you installed NOPAR via ``npm install -g nopar``, then a start script is be
installed into your path and you can simply run:

    nopar

With the default configuration, the registry is available at
<http://localhost:5984/>. Point your browser at it and you should see an empty
registry.

Fill your local registry by configuring the
[npm command](https://npmjs.org/doc/config.html) to use it:

    npm config set registry http://localhost:5984/
    npm cache clear
    npm login

Sometimes npm seems confused with cached packages from other repositories,
clearing the cache remedies those issues.

The login is required for npm to work but NOPAR doesn't implement any user
management and currently accepts everyone.

Install packages with ``npm install PACKAGE`` and NOPAR will automatically proxy
and cache the packages and dependencies into your private NOPAR.

Of course you can also publish to NOPAR. Those packages won't get promoted to
the official [registry](http://registry.npmjs.org/) by NOPAR and will be marked
with a green "local" tag in the browser interface.

For configuring the registry, see the section "Default Environment Variables"
below.


Default Environment Variables
-----------------------------

The service's defaults are configured via environment variables. The following
parameters are available:

* NOPAR_HOSTNAME - Hostname that the service is bound to (default="localhost")
* NOPAR_PORT - TCP port the service is running on (default=5984)
* NOPAR_AUTO_FORWARD - "yes" if NOPAR should automatically forward requests for
  unknown packages to the forwarder registry, "no" if you really just want a
  local registry without the auto-caching facility (default="yes")
* NOPAR_FORWARDER_URL - The URL of the registry NOPAR forwards requests for
  unknown packages to (default="https://registry.npmjs.org")
* NOPAR_PROXY_URL - The URL of a proxy to use, empty for not using a proxy
  (default="")
* NOPAR_USER_AGENT - The user agent to use to make the requests as
  (default=nopar/<nopar-version>)
* NOPAR_LOGFILE - Location of the logfile if we spawn, empty for console
  (default="")
* NOPAR_LOGLEVEL - Loglevel to use (default="info")
* NOPAR_REGISTRY_PATH - Location of the registry, leaving this empty will put
  the registry in a folder "registry" inside the nopar folder (default="")
* NOPAR_HOME - Homefolder to change to before running, empty for installation
  location (default="")
* NOPAR_RUN_PATH - Location for runtime files, primarily the PID file if running
  as a daemon (default="")
* NOPAR_RUNAS_USER - The user to run as if running as a daemon, empty for not
  running as a daemon (default="")

If the environment variable ``NOPAR_RUNAS_USER`` is set, the service will run
as a daemon.

You can override some of those settings from within NOPAR on the Settings page.
Everything that is set in the Settings page takes priority over the environment
variables.

Upstart Configuration
---------------------

There's an example [upstart](http://upstart.ubuntu.com) configuration file that
you can use and adapt for your own purpose:

``scripts/nopar.conf``

Known Issues
------------

* Missing user management. Welcome to the "Admin Party"!
* Once a package meta is cached, it doesn't get updated from the
  [upstream registry](http://registry.npmjs.org) automatically. You can refresh
  the package meta from the [upstream registry](http://registry.npmjs.org) by
  clicking on the "Refresh" link for that package in the user interface.

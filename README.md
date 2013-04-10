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

A start script should be installed into your path If you installed NOPAR via
``npm install` -g nopar`.

Run:

    nopar

and your registry is available at <http://localhost:5984/>. Point your browser
at it and you should see an empty registry.

Fill your local registry by configuring the
[npm command](https://npmjs.org/doc/config.html) to use it:

    npm config set registry http://localhost:5984/
    npm cache clear
    npm login

Sometimes npm seems confused with cached packages from other repositories,
clearing the cache remedies those issues.

The login is required for npm to work but NOPAR doesn't implement any user
management and currently accepts everything.

Install packages with ``npm install PACKAGE`` and NOPAR will automatically proxy
and cache the packages and dependencies into your private NOPAR.

Of course you can also publish to NOPAR. Those packages won't get promoted to
the official [registry](http://registry.npmjs.org/) by NOPAR and will be marked
with a green "local" tag in the browser interface.

For configuring the registry, see the section "Default Environment Variables"
below.


Default Environment Variables
-----------------------------

The service is configured via environment variables. The following parameters
are available:

* NOPAR_HOSTNAME=localhost
* NOPAR_PORT=5984
* NOPAR_AUTO_FORWARD=yes
* NOPAR_FORWARDER_URL="https://registry.npmjs.org"
* NOPAR_PROXY_URL=
* NOPAR_USER_AGENT=nopar/0.0.0
* NOPAR_LOGFILE=
* NOPAR_LOGLEVEL=info
* NOPAR_REGISTRY_PATH=
* NOPAR_HOME=
* NOPAR_RUN_PATH=
* NOPAR_RUNAS_USER=

If the environment variable ``NOPAR_RUNAS_USER`` is set, the service will run
as a daemon.

You can override the environment variables from within the Settings page inside
NOPAR.

Upstart Configuration
---------------------

There's an example [upstart](http://upstart.ubuntu.com) configuration file that
you can use and adapt for your own purpose:

``scripts/nopar.conf``

Known Issues
------------

* Missing user management. Welcome to the "Admin Party"!
* Once a package meta is cached, it doesn't get updated from the
  [upstream registry](http://registry.npmjs.org) automatically. The workaround
  for now is to delete the cached package via the browser interface and do a
  fresh ``npm install`` of said package.

NOPAR - The Node PAckage Registry & proxy
=========================================

Provides a local NPM registry that also proxies and caches unknown node packages
from the original npm registry at <http://registry.npmjs.org>.


Install the server
------------------

It's available in the official NPM registry, so all you need is:

    npm install -g nopar

On my build server I create an archive (see ``scripts/package``) and extract the
whole shebang into ``/usr/local/nopar`` with an install script
(see ``scripts/install-nopar.sh``).


Usage
-----

If you install NOPAR via ``npm install``, a start script should be installed
into your path.

Run:

    nopar

and your registry should be available at <http://localhost:5984/>. Point your
browser at it and you should see an empty registry.

Fill it by configuring your [npm command](https://npmjs.org/doc/config.html) to
use the local registry:

    npm config set registry http://localhost:5984/
    npm cache clear
    npm login

Sometimes npm seems confused when with cached packages from other repositories
than the configured one, clearing the cache remedies those issues.

The login is required for npm to work but NOPAR doesn't implement any user
management and currently accepts everything.

Install packages with ``npm install PACKAGE`` and NOPAR will automatically proxy
and cache the packages and dependencies locally.

Of course you can also publish to NOPAR. Those packages won't get promoted to
the official [registry](http://registry.npmjs.org/) by NOPAR and be marked with
a green "local" tag in the browser interface.

For configuring the registry, see the section "Default Environment Variables"
below.


Default Environment Variables
-----------------------------

The service is configured via environment variables. The following parameters
are available:

* NOPAR_HOSTNAME=localhost
* NOPAR_PORT=5984
* NOPAR_LOGFILE=
* NOPAR_LOGLEVEL=info
* NOPAR_REGISTRY_PATH=
* NOPAR_HOME=
* NOPAR_RUN_PATH=
* NOPAR_RUNAS_USER=

If ``NOPAR_RUNAS_USER`` is set, the service will run as a daemon.


Upstart Configuration
---------------------

There's an example [upstart](http://upstart.ubuntu.com) configuration file that
you can use and adapt for your own purpose:

``scripts/nopar.conf``

Known Issues
------------

* Missing user management. Welcome to the "Admin Party"!
* Once a package meta is cached, it doesn't update it from upstream
  automatically. Workaround is to delete the cached package from the browser
  interface and do a fresh ``npm install`` of the said package.

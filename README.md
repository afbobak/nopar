== Abstrakt Node Package Registry & Proxy

Provides a local NPM registry that also proxies and caches unknown node packages
from the original npm registry at registry.npmjs.org.

== Default Environment Variables

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

== Start the server

``npm start``

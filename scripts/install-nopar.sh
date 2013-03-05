#!/bin/bash

CONFIG=$1
if [ "${CONFIG}" = "" ]; then
  CONFIG=/etc/default/nopar
fi

if test -f ${CONFIG}; then
  . ${CONFIG}
fi

cd /usr/local/nopar

PID_FILE="${NOPAR_RUN_PATH}/nopar.pid"
if test -f ${PID_FILE}; then
  PID=`cat /var/run/nopar/nopar.pid`
  echo "Stopping existing server running at"
  kill $PID
  rm /var/run/nopar/nopar.pid
fi

echo "Removing old files"
rm -fr \
 bin \
 lib \
 node_modules \
 public \
 scripts \
 views \
 package.json \
 README.md
echo "Extracting new files"
tar xzf nopar.tgz

echo "Starting server"
/usr/local/nopar/bin/nopar
cat "${NOPAR_RUN_PATH}/start.log"

echo "DONE"

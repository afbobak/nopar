#!/bin/bash

echo "==== Installing and bouncing NOPAR"

CONFIG=$1
if [ "${CONFIG}" = "" ]; then
  CONFIG=/etc/default/nopar
fi

if test -f ${CONFIG}; then
  . ${CONFIG}
else
  echo "Missing configuration file."
  exit 5
fi

cd ${NOPAR_HOME}

PID_FILE="${NOPAR_RUN_PATH}/nopar.pid"
if test -f ${PID_FILE}; then
  PID=`cat ${PID_FILE}`
  echo "== Stopping existing server running at $PID"
  kill $PID
  rm ${PID_FILE}
fi

echo "== Removing old files"
rm -fr \
 bin \
 lib \
 node_modules \
 public \
 scripts \
 views \
 package.json \
 README.md
echo "== Extracting new files form nopar.tgz"
tar xzf nopar.tgz

echo "== Starting server"
/usr/local/nopar/bin/nopar
sleep 1
cat "${NOPAR_RUN_PATH}/start.log"

echo "==== DONE"

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

cd /data/packages/nopar
LATEST=`cat .latest.id`.tgz
ln -sf ${LATEST} latest.tgz

cd ${NOPAR_HOME}
PID_FILE="${NOPAR_RUN_PATH}/nopar.pid"
if test -f ${PID_FILE}; then
  PID=`cat ${PID_FILE}`
  echo "== Stopping existing server running at $PID"
  service nopar stop
  rm ${PID_FILE}
fi

echo "== Removing old files"
rm -fr *
echo "== Extracting new files from /data/packages/nopar/latest.tgz"
tar -xz --strip-components 1 -f /data/packages/nopar/latest.tgz
cp scripts/nopar.conf /etc/init/

echo "== Starting server"
service nopar start
sleep 1
cat "${NOPAR_RUN_PATH}/start.log"

echo "==== DONE"

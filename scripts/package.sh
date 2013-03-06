#!/bin/bash

PKG_NAME=`node -e 'process.stdout.write(require("./package.json").name);'`
PKG_VERSION=`node -e 'process.stdout.write(require("./package.json").version);'`

echo "==== Packaging ${PKG_NAME}@${PKG_VERSION} ===="

rm -fr node_modules
npm install --production

tar -c -s ,^,${PKG_NAME}-${PKG_VERSION}/, --owner=root --group=root -z -f ${PKG_NAME}-${PKG_VERSION}.tgz \
 bin \
 lib \
 node_modules \
 public \
 scripts \
 views \
 package.json \
 README.md
echo ${PKG_NAME}-${PKG_VERSION} > .latest.id

echo "==== ${PKG_NAME}@${PKG_VERSION} packaged to ${PKG_NAME}.tgz ===="

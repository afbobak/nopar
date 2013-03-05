#!/bin/bash

PKG_NAME=`node -e 'process.stdout.write(require("./package.json").name);'`
PKG_VERSION=`node -e 'process.stdout.write(require("./package.json").version);'`

rm -fr node_modules
npm install --production

tar cvzf ${PKG_NAME}.tgz \
 bin \
 lib \
 node_modules \
 public \
 scripts \
 views \
 package.json \
 README.md

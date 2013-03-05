#!/bin/bash

kill `cat /var/run/nopar/nopar.pid`
rm /var/run/nopar/nopar.pid

cd /usr/local/nopar

rm -fr \
 bin \
 lib \
 node_modules \
 public \
 scripts \
 views \
 package.json \
 README.md
tar xvzf nopar.tgz

/usr/local/nopar/bin/nopar

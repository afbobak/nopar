#!/bin/bash

npm cache clear
npm config set registry http://localhost:5984/
echo "===================================================="
echo " Login in, should succeed"
echo "===================================================="
npm login
echo "===================================================="
echo " Installing dependencies, should succeed"
echo "===================================================="
npm install
echo "===================================================="
echo " Publishing to NOPAR, should succeed"
echo "===================================================="
npm publish
echo "===================================================="
echo " Re-Publishing to NOPAR, should fail"
echo "===================================================="
npm publish
echo "===================================================="
echo " Force-Publishing to NOPAR, should succeed"
echo "===================================================="
npm publish --force
echo "===================================================="
echo " Publishing new version to NOPAR, should succeed"
echo "===================================================="
mv package.json package.json.old
sed -E 's/2\.0\.0/2\.0\.1/' package.json.old > package.json
npm publish
echo "===================================================="
echo " Tagging old version on NOPAR, should succeed"
echo "===================================================="
npm tag proxied@2.0.0 older
echo "===================================================="
echo " Unpublishing version from NOPAR, should succeed"
echo "===================================================="
npm unpublish proxied@2.0.0
echo "===================================================="
echo " Force-Unpublishing from NOPAR, should succeed"
echo "===================================================="
npm unpublish --force

cp package.json.old package.json
rm package.json.old
rm -fr node_modules

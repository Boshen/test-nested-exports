echo 'Incorrect behavior from enhanced-resolve'
echo

node test.js
echo '           ^^^^ Notice this is resolved to the root package'

echo
echo '---------------------------------------------------------'
echo

echo 'Correct behavior from node.js'
echo

cd packages/app

node index.js

cd -

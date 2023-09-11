const path = require('path');
const resolve = require('enhanced-resolve')

const dir = path.resolve(__dirname, './packages/app')
const specifier = 'package/es/index.js'

console.log('dir:', dir)
console.log('specifier:', specifier)

resolve(dir, specifier, (err, res) => {
  console.log('resolved: ', err || res)
});

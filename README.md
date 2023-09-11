# Resolving to the incorrect package with webpack (enhanced-resolve)

## Keywords:

* monorepo
* package.exports
* bundle resolution algorithm vs ESM resolution

## Scenario:

In a monorepo, there are two versions of `package` installed in

The root `node_modules`, with `package.json` and `index.js`:

* node_modules/package/src/index.js
* node_modules/package/package.json

```json
{
  "name": "package",
  "version": "1.0.0",
  "exports": {
    "./es/*": "./src/*"
  }
}
```

And in a app `node_modules`, with `package.json` and `main.js`

* packages/app/node_modules/package/src/main.js
* packages/app/node_modules/package/package.json

```json
{
  "name": "package",
  "version": "0.0.1",
  "exports": {
    "./es/*": "./src/*"
  }
}
```

The incorrect behavior that comes from enhanced-resolve:

When resolving the specifier `package/es/index.js` inside `./packages/app`,
it first resolves the specifier to `./packages/app/node_modules/package/src/index.js` and misses the file.
It then continues searching and finds `./node_modules/package/src/index.js`.

The correct behavior from node.js is:

Aborts when `./packages/app/node_modules/package/src/index.js` is not found.

---

To replicate the behavior, run `bash test.sh` and see the following output:


```
Incorrect behavior from enhanced-resolve
dir: test-nested-exports/packages/app
specifier: package/es/index.js
resolved:  test-nested-exports/node_modules/package/src/index.js
           ^^^^ Notice this is resolved to the root package

---------------------------------------------------------

Correct behavior from node.js
dir: test-nested-exports/packages/app
specifier: package/es/index.js
node:internal/modules/cjs/loader:560
      throw e;
      ^

Error: Cannot find module 'test-nested-exports/packages/app/node_modules/package/src/index.js'
    at createEsmNotFoundErr (node:internal/modules/cjs/loader:1048:15)
    at finalizeEsmResolution (node:internal/modules/cjs/loader:1041:15)
    at resolveExports (node:internal/modules/cjs/loader:554:14)
    at Function.Module._findPath (node:internal/modules/cjs/loader:594:31)
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1007:27)
    at Function.Module._load (node:internal/modules/cjs/loader:866:27)
    at Module.require (node:internal/modules/cjs/loader:1093:19)
    at require (node:internal/modules/cjs/helpers:108:18)
    at Object.<anonymous> (test-nested-exports/packages/app/index.js:4:1)
    at Module._compile (node:internal/modules/cjs/loader:1191:14) {
  code: 'MODULE_NOT_FOUND',
  path: 'test-nested-exports/packages/app/node_modules/package/package.json'
}
```

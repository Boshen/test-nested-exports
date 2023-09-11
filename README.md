# Resolving to the incorrect package with webpack (enhanced-resolve)

## tldr;

In a monorepo, ESM saves us from resolving to the wrong package when package exports is configured,
webpack (enhanced-resolve) fails to do so.

## Keywords

* monorepo
* package.exports
* bundle resolution algorithm vs ESM resolution

## Scenario

In a monorepo, there are two versions of the same `package` installed in the root (`node_modules/package`)
and in a workspace directory (`packages/app/node_modules/package`).

```
├── node_modules
|  └── package <--
|     ├── package.json
|     └── src
|        └── index.js
├── packages
|  └── app
|     ├── index.js
|     ├── package.json
|     ├── node_modules
|        └── package <--
|           ├── package.json
|           └── src
|              └── main.js
```

### `node_modules/package`

The root `node_modules`, with `package.json` and `index.js`:

* `node_modules/package/src/index.js`
* `node_modules/package/package.json`

```json
{
  "name": "package",
  "version": "1.0.0",
  "exports": {
    "./src/*": "./src/*"
  }
}
```

### `packages/app/node_modules/package`

And in a app `node_modules`, with `package.json` and `main.js`

* `packages/app/node_modules/package/src/main.js`
* `packages/app/node_modules/package/package.json`

```json
{
  "name": "package",
  "version": "0.0.1",
  "exports": {
    "./src/*": "./src/*"
  }
}
```

Notice this one does not contain index.js.

## Behavior

`resolve('/path/to/packages/app', 'package/src/index.js')`

### enhanced-resolve

The incorrect behavior that comes from enhanced-resolve:

When resolving the specifier `package/src/index.js` inside `./packages/app`,
it first resolves the specifier to `./packages/app/node_modules/package/src/index.js` and misses the file.
It then continues searching and finds `./node_modules/package/src/index.js`.

### node.js

The correct behavior from Node is:

Aborts when `./packages/app/node_modules/package/src/index.js` is not found.

---

# Explanation

Follow the spec (https://nodejs.org/api/modules.html#all-together)

The route

`LOAD_NODE_MODULES` -> `LOAD_PACKAGE_EXPORTS` -> `RESOLVE_ESM_MATCH` -> `THROW "not found"`

indicates that resolution should stop when a path is not found package#exports.

```
LOAD_NODE_MODULES(X, START)
1. let DIRS = NODE_MODULES_PATHS(START)
2. for each DIR in DIRS:
   a. LOAD_PACKAGE_EXPORTS(X, DIR)
   b. LOAD_AS_FILE(DIR/X)
   c. LOAD_AS_DIRECTORY(DIR/X)

LOAD_PACKAGE_EXPORTS(X, DIR)
1. Try to interpret X as a combination of NAME and SUBPATH where the name
   may have a @scope/ prefix and the subpath begins with a slash (`/`).
2. If X does not match this pattern or DIR/NAME/package.json is not a file,
   return.
3. Parse DIR/NAME/package.json, and look for "exports" field.
4. If "exports" is null or undefined, return.
5. let MATCH = PACKAGE_EXPORTS_RESOLVE(pathToFileURL(DIR/NAME), "." + SUBPATH,
   `package.json` "exports", ["node", "require"]) defined in the ESM resolver.
6. RESOLVE_ESM_MATCH(MATCH)

RESOLVE_ESM_MATCH(MATCH)
1. let RESOLVED_PATH = fileURLToPath(MATCH)
2. If the file at RESOLVED_PATH exists, load RESOLVED_PATH as its extension
   format. STOP
3. THROW "not found"
```

---

As a bonus point, the scenario will resolve to the root `./node_modules/package/src/index.js` if `package#exports`
are removed from both `package.json`s.

---

# Replicate

To replicate the behavior, run `bash test.sh` and see the following output:


```
Incorrect behavior from enhanced-resolve
dir: test-nested-exports/packages/app
specifier: package/src/index.js
resolved:  test-nested-exports/node_modules/package/src/index.js
           ^^^^ Notice this is resolved to the root package

---------------------------------------------------------

Correct behavior from node.js
dir: test-nested-exports/packages/app
specifier: package/src/index.js
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

---

# esbuild

esbuild conforms to the spec.

Add `import 'package/src/index.js'` to `./packages/app/index.js`

```
test-nested-exports  main ❯ npx esbuild --bundle ./packages/app/index.js
✘ [ERROR] Could not resolve "package/src/index.js"

    packages/app/index.js:6:7:
      6 │ import 'package/src/index.js'
        ╵        ~~~~~~~~~~~~~~~~~~~~~~

  The module "./src/index.js" was not found on the file system:

    packages/app/node_modules/package/package.json:5:15:
      5 │     "./src/*": "./src/*"
        ╵                ~~~~~~~~~

  You can mark the path "package/src/index.js" as external to exclude it from the bundle, which will
  remove this error.

1 error
```

Remove both `package#exports` and notice it resolves to the root package:

```
test-nested-exports  main ❯ npx esbuild --bundle ./packages/app/index.js
(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined")
      return require.apply(this, arguments);
    throw new Error('Dynamic require of "' + x + '" is not supported');
  });

  // node_modules/package/src/index.js
  console.log("index.js in root node_modules");

  // packages/app/index.js
  console.log("dir:", __dirname);
  console.log("specifier:", "package/es/index.js");
  console.log("resolved:", __require.resolve("package/src/index.js"));
})();
```

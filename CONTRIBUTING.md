# Development and self-hosting

The browser runs each simulation in WebAssembly. JavaScript resolves the selected
Classic Era or WoW Forever character once per worker; the native engine runs
combat batches without JavaScript event callbacks or a JavaScript fallback.

## Build the browser assets

`dist/` is generated output and is not tracked in Git. Build it on your machine
after cloning and rebuild after pulling source changes. Do not commit generated
JavaScript, CSS, WASM, or bundle manifests.

Install a current Node.js runtime and the Emscripten SDK. Activate Emscripten in your
shell, set `EMSDK` to its root, or put the SDK at `../emsdk` beside this repository.
From the repository root on Windows, run:

```powershell
npm ci
.\build-dist.bat
```

On Linux or macOS, run the shell equivalent:

```sh
npm ci
./build-dist.sh
```

`build-dist.sh`/`build-dist.bat` are thin wrappers over `scripts/build-dist.sh` and
`scripts/build-dist.ps1`, which mirror each other. Keep the two in sync: the compiler
and Terser flags are part of the bundle identity and of the engine's numerical
behavior. The same Emscripten SDK produces byte-identical minified JavaScript and
Emscripten glue on both platforms; the `.wasm` differs only in the path separators
of source paths embedded in libc++abi assertion strings, which leaves the code
section identical but does change the `buildId`.

This compiles `scss/style.scss`, copies the vendored libraries, theme, and images
from `assets/`, builds the native Release module, and minifies all application
JavaScript with Emscripten's bundled Terser. Class and function names are preserved
because action serialization uses constructor names. It writes both tabs' application
assets once, under `dist/js` and `dist/wasm`, then generates `dist/compute-build.json`
with hashes of those files. Builds update these assets in place and remove the
legacy duplicate `dist/bundle/` and `dist/bundle.tmp/` directories. Keep the resulting
`dist/` directory together after validating it, and include it when deploying the
site. Edit `js/`, `scss/`, or `assets/` instead of generated files in `dist/`.
Use `npm run wasm` (or `./wasm/build.sh`) to rebuild only the native module, or
`.\build-dist.bat -SkipWasmBuild` /
`./build-dist.sh --skip-wasm-build` to reuse a native build that already matches the
current source. Never publish mismatched JS/WASM assets. `dist/wasm/package.json`
marks the deployed Emscripten glue as an ES module so Node can `import()` it; without
it the deployed-artifact tests cannot load `dist/wasm/warriorsim.js`.

Serve the repository through HTTP rather than opening an HTML file directly. For
example, run `python -m http.server 8000`, then open `http://localhost:8000/classic.html`
for Classic Era or `http://localhost:8000/index.html` for WoW Forever. The server
must serve `.wasm` as `application/wasm`; module and worker files must be accessible
from the same origin. Web Crypto requires HTTPS or a localhost origin. Both pages
preload and verify the complete bundle before initializing, and retain all assets
for future workers. Deploy the complete new assets before replacing the current
manifest. Tabs still preloading during a deployment may fail verification and need
to reload; initialized tabs retain their assets and continue running.

## Save a site profile as a permanent Forever preset

See the [standalone usage guide](scripts/upsert-forever-profile.md) for all options
and examples.

Permanent presets live in `js/data/presets_forever.js`. On the WoW Forever tab,
open **Profiles** and click the **Export** icon on the profile you want to save.
The site copies its export to your clipboard. From this checkout, run:

```sh
npm run profile:upsert -- --id forever-my-build
```

Paste the copied export at the prompt and press Enter. The command updates the
entry with that exact ID, or appends a new entry if the ID does not exist. IDs are
independent of display names, so use the same ID when renaming or revising a build.
Existing IDs include `forever-dual-wield-fury`, `forever-two-handed-fury`, and
`forever-two-handed-arms`.

You can also save the copied text to a file, or pass clipboard text through stdin:

```sh
npm run profile:upsert -- --id forever-my-build --input profile.txt --description "My raid build"
```

```powershell
Get-Clipboard | node scripts/upsert-forever-profile.js --id forever-my-build
```

The tool accepts the site's base64 export or the decoded profile JSON, validates
its structure, and replaces the entire profile. Descriptions are kept on updates
unless `--description` is supplied; new entries default to the exported profile
name. Other presets and the catalog's header comments are preserved. An invalid
export leaves the file unchanged.

Both the script and website run the shared advisory compatibility validator.
The script prints findings to stderr and continues; the website shows them in an
OK-to-dismiss notification after importing. Notes identify migrated or refunded
talents, unknown IDs, unsupported schemas, legacy enabled abilities, and inherited
settings. See the standalone guide for details.

Use `--dry-run` to print the proposed file without saving, or `--presets FILE` to
edit a separate copy of the catalog. Review `git diff -- js/data/presets_forever.js`
and rebuild the browser assets as described above to use the updated presets.
The first-visit defaults in `js/data/session_forever.js` are maintained separately.

## Optional shared compute

Sharing requires a WebSocket coordinator in addition to the static site. Install
its independent dependencies and start a loopback preview:

```powershell
npm ci --prefix server
npm run compute:dev
```

Open `http://127.0.0.1:8787/classic.html` for Classic Era or
`http://127.0.0.1:8787/index.html` for WoW Forever. Enable **Share Compute** in two tabs to
exercise donations and foreground priority. Without a coordinator, simulations
continue locally. The toggle must be enabled to receive or donate shared work.

For AWS or another serving host, run one coordinator behind the existing HTTPS
proxy. See [server/README.md](server/README.md) for origin configuration, deployment,
bundle retention, lease recovery, native worker protocol, and public-result trust
limits. The native worker application is a later project.

## Validate changes

```powershell
npm test
npm run test:wasm
npm run test:compute
npm run benchmark
npm run test:regressions -- --dist
```

`npm test` runs the existing simulation regression suite plus JavaScript reference
and worker contract tests. The compute suite also requires the coordinator
dependencies and freshly built deployment assets. Native parity/API tests and benchmarks require a fresh
`npm run wasm` build. See [test/README.md](test/README.md),
[test/wasm/README.md](test/wasm/README.md), and [wasm/README.md](wasm/README.md).
Seeded runs assign one seed and disjoint global iteration ranges to workers.
This preserves RNG assignment when the worker count changes; legacy proc timestamps
can still couple combat history across fights. See the native engine guide for
these retained reset semantics and the scope of partition parity checks.

## CSS and development server

The Gulp workflow uses Dart Sass from the project dependencies installed by
`npm ci`. Use `npm run build:css` to rebuild only CSS, or `npm run dev` to start
the Gulp development server. Run a full distribution build before starting the
development server; its JavaScript watcher does not compile native changes.

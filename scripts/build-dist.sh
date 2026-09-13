#!/usr/bin/env bash
# Linux/macOS counterpart to build-dist.ps1. Keep the two in sync: the Terser flags
# below are part of the bundle identity, and class/function names must survive because
# action serialization uses constructor names.
set -euo pipefail

configuration=Release
skipWasmBuild=0

usage() {
    cat <<'EOF'
Usage: scripts/build-dist.sh [-c|--configuration Release|Debug] [--skip-wasm-build]

  -c, --configuration   Release (default) or Debug; forwarded to wasm/build.sh.
      --skip-wasm-build Reuse an existing wasm/dist build matching the source; verify native key tables.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -c|--configuration|-Configuration)
            [ $# -ge 2 ] || { echo "Missing value for $1" >&2; exit 1; }
            configuration="$2"
            shift 2
            ;;
        --configuration=*) configuration="${1#*=}"; shift ;;
        --skip-wasm-build|-SkipWasmBuild) skipWasmBuild=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
    esac
done

scriptRoot="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repoRoot="$(dirname "$scriptRoot")"

emsdkRoot="${EMSDK:-$(dirname "$repoRoot")/emsdk}"
if [ -n "${EMSDK_NODE:-}" ] && [ -x "${EMSDK_NODE:-}" ]; then
    node="$EMSDK_NODE"
else
    # Highest-sorting SDK node, matching the PowerShell script's descending pick.
    node="$(find "$emsdkRoot/node" -type f -name node 2>/dev/null | LC_ALL=C sort -r | head -n 1)"
fi
terser="$emsdkRoot/upstream/emscripten/node_modules/terser/bin/terser"
if [ -z "$node" ] || [ ! -x "$node" ]; then
    echo "Node.js was not found in the activated or sibling Emscripten SDK" >&2
    exit 1
fi
if [ ! -f "$terser" ]; then
    echo "Terser was not found in the Emscripten SDK dependencies" >&2
    exit 1
fi

if ! "$node" "$repoRoot/node_modules/gulp/bin/gulp.js" --cwd "$repoRoot" static; then
    echo "Static asset build failed; run npm ci before building" >&2
    exit 1
fi

# Keep header indices in sync before compiling; reusing WASM must not change them.
keyArgs=("$scriptRoot/generate-native-keys.js")
if [ "$skipWasmBuild" -ne 0 ]; then keyArgs+=(--check); fi
if ! "$node" "${keyArgs[@]}"; then
    echo "Native key generation/check failed; run a full distribution build to regenerate stale tables" >&2
    exit 1
fi

if [ "$skipWasmBuild" -eq 0 ]; then
    "$repoRoot/wasm/build.sh" --configuration "$configuration"
fi

sourceRoot="$repoRoot/js"
javascriptOut="$repoRoot/dist/js"

while IFS= read -r resolvedSource; do
    case "$resolvedSource" in
        "$sourceRoot"/*) ;;
        *) echo "JavaScript source is outside the repository source directory: $resolvedSource" >&2; exit 1 ;;
    esac
    relative="${resolvedSource#"$sourceRoot"/}"
    # Vendored libraries are copied from assets/js by Gulp's static task.
    case "$relative" in
        libs/*|vendor/*) continue ;;
    esac
    destination="$javascriptOut/${relative%.js}.min.js"
    mkdir -p "$(dirname "$destination")"
    if ! "$node" "$terser" "$resolvedSource" \
        --compress \
        --mangle \
        --keep-classnames \
        --keep-fnames \
        --ecma 2020 \
        --output "$destination"; then
        echo "Terser failed for $relative" >&2
        exit 1
    fi
done < <(find "$sourceRoot" -type f -name '*.js' | LC_ALL=C sort)

wasmOut="$repoRoot/dist/wasm"
mkdir -p "$wasmOut"
cp -f "$repoRoot/wasm/dist/warriorsim.js" "$wasmOut/warriorsim.js"
cp -f "$repoRoot/wasm/dist/warriorsim.wasm" "$wasmOut/warriorsim.wasm"
cp -f "$repoRoot/wasm/package.json" "$wasmOut/package.json"

if ! "$node" "$repoRoot/scripts/compute-build.js"; then
    echo "Compute build identity generation failed" >&2
    exit 1
fi

echo "Built CSS, static assets, JavaScript, and WASM in $repoRoot/dist"

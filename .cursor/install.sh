#!/usr/bin/env bash
set -euo pipefail

node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)'
}

if ! node_ok; then
  if [ "$(uname -s)" != "Linux" ]; then
    echo "Node.js 22.13 or newer is required." >&2
    exit 1
  fi
  version=22.23.3
  case "$(uname -m)" in
    x86_64) node_arch=x64 ;;
    aarch64 | arm64) node_arch=arm64 ;;
    *)
      echo "Unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac
  tmp="$(mktemp)"
  curl -fsSL "https://nodejs.org/dist/v${version}/node-v${version}-linux-${node_arch}.tar.xz" -o "$tmp"
  sudo tar -xJf "$tmp" -C /usr/local --strip-components=1
  rm -f "$tmp"
  hash -r
fi

npm ci

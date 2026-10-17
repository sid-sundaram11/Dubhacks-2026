#!/usr/bin/env bash
set -euo pipefail

listening() {
  node -e 'const net = require("net"); const port = Number(process.argv[1]); const socket = net.connect({ port, host: "localhost" }, () => { socket.end(); process.exit(0); }); socket.on("error", () => process.exit(1)); setTimeout(() => process.exit(1), 1000);' "$1"
}

if ! listening 8787; then
  nohup npm run server > /tmp/constellation-api.log 2>&1 &
  for _ in $(seq 1 50); do
    if listening 8787; then
      break
    fi
    sleep 0.2
  done
fi

if ! listening 8787; then
  echo "constellation api did not start" >&2
  cat /tmp/constellation-api.log >&2 || true
  exit 1
fi

if listening 8081; then
  exit 0
fi

exec npx expo start --localhost --port 8081

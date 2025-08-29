#!/usr/bin/env bash
set -euo pipefail

# Build script to produce macos/frameworks/Tun2socks.xcframework
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export GOPATH="${GOPATH:-$HOME/go}"
export PATH="$GOPATH/bin:$PATH"

echo "Using GOPATH=$GOPATH"
echo "Fetching specific golang.org/x/mobile version..."
cd "$REPO_ROOT/go"
go get golang.org/x/mobile@v0.0.0-20250813145510-f12310a0cfd9

echo "Installing gomobile and gobind..."
go install golang.org/x/mobile/cmd/gomobile@latest
go install golang.org/x/mobile/cmd/gobind@latest

echo "Initializing gomobile (may compile toolchain)..."
"$GOPATH/bin/gomobile" init

echo "Creating output directory..."
mkdir -p "$REPO_ROOT/macos/frameworks"

echo "Running gomobile bind (this may take several minutes)..."
env PATH="$GOPATH/bin:$PATH" CGO_ENABLED=1 MACOSX_DEPLOYMENT_TARGET=12.0 \
  "$GOPATH/bin/gomobile" bind -target=macos \
  -o "$REPO_ROOT/macos/frameworks/Tun2socks.xcframework" \
  ./outline/platerrors ./outline/tun2socks ./outline

echo "Done. Framework created at $REPO_ROOT/macos/frameworks/Tun2socks.xcframework"
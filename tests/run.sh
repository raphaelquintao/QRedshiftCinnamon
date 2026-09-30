#!/bin/sh
# Runs the applet's unit tests with Cinnamon's JavaScript interpreter.
cd "$(dirname "$0")/.." && exec cjs tests/test_spawn.js

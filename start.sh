#!/bin/sh
set -e
export HOST="${HOST:-0.0.0.0}"
export WEB_DIST_PATH="${WEB_DIST_PATH:-apps/web/dist}"
export PORT="${PORT:-80}"
exec node apps/api/dist/index.js

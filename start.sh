#!/bin/sh
set -e
export HOST="${HOST:-0.0.0.0}"
export WEB_DIST_PATH="${WEB_DIST_PATH:-apps/web/dist}"
export PORT="${PORT:-3000}"
exec npm run start -w @oppi/api

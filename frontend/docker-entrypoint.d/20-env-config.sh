#!/bin/sh
set -e
sed "s|__BACKEND_URL__|${BACKEND_URL:-http://localhost:5000}|g" \
    /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js

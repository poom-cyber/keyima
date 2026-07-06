#!/usr/bin/env bash
cd "$(dirname "$0")"
[ -d be/node_modules ] || ( cd be && npm install --no-audit --no-fund )
[ -d db/node_modules ] || ( cd db && npm install --no-audit --no-fund )
node --experimental-sqlite db/sync-catalog.js
node --experimental-sqlite be/storefront-api/server.js & S=$!
node --experimental-sqlite be/admin-api/server.js      & A=$!
node serve-fe.js fe/store 5173 & F=$!
node serve-fe.js fe/admin 5174 & G=$!
echo "shop http://localhost:5173 · admin http://localhost:5174/login (admin/admin123)"
trap "kill $S $A $F $G 2>/dev/null" INT TERM
wait

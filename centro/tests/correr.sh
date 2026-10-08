#!/bin/zsh
# Corre las pruebas de El Centro: migración (PGlite), API (/api/centro-*), página pública y panel del dueño.
# Arma un banco de pruebas en ~/vg-work/centro-banco (fuera del repo) con copias frescas de api/ y los tests.
set -e
REPO="${0:A:h:h:h}"
BANCO="$HOME/vg-work/centro-banco"
mkdir -p "$BANCO/api"
cp "$REPO"/api/_lib.js "$REPO"/api/_centro*.js "$REPO"/api/centro-*.js "$BANCO/api/"
echo '{"type":"module"}' > "$BANCO/api/package.json"
cp "$REPO"/centro/tests/probar-*.mjs "$BANCO/"
cd "$BANCO"
[ -d node_modules/jsdom ] || { [ -f package.json ] || echo '{"private":true}' > package.json; npm install --silent ai@^6 @ai-sdk/gateway@^3 @electric-sql/pglite jsdom; }
export REPO
for t in sql api web admin; do
  echo "== $t"; node "probar-$t.mjs" | tee "/tmp/centro-$t.log" | grep -v '^OK' || true
  echo "   $(grep -c '^OK' /tmp/centro-$t.log) OK · $(grep -c '^FAIL' /tmp/centro-$t.log) FAIL"
done

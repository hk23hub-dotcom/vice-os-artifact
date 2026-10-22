#!/usr/bin/env bash
# Corre las pruebas de Freelancers Fundadores: migración (PGlite), webhook de Shopify, página pública y
# recorrido completo panel ↔ página ↔ base. Arma un banco fuera del repo con sus dependencias.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
BANCO="${BANCO:-$HOME/vg-work/socios-banco}"
mkdir -p "$BANCO"
cp "$REPO"/socios/tests/probar-*.mjs "$BANCO/"
cd "$BANCO"
[ -f package.json ] || echo '{"private":true,"type":"module"}' > package.json
[ -d node_modules/jsdom ] && [ -d node_modules/@electric-sql/pglite ] || npm install --silent @electric-sql/pglite jsdom
export REPO
fallas=0
for t in sql webhook web admin; do
  extra=""; [ "$t" = webhook ] && extra="--experimental-strip-types"
  echo "== $t"
  node $extra --no-warnings "probar-$t.mjs" > "/tmp/socios-$t.log" 2>&1 || true
  grep -v '^OK' "/tmp/socios-$t.log" || true
  ok=$(grep -c '^OK' "/tmp/socios-$t.log" || true); fail=$(grep -c '^FAIL' "/tmp/socios-$t.log" || true)
  echo "   $ok OK · $fail FAIL"
  fallas=$((fallas + fail))
done
exit $((fallas > 0))

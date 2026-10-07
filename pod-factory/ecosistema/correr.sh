#!/bin/bash
# Turno diario del ecosistema. Lee el estado real, actualiza memorias,
# escribe el parte y regenera el mundo. No toca red. No envía. No publica.
set -uo pipefail
cd "$(dirname "$0")/.."
D=$(date +%Y-%m-%d)
mkdir -p ecosistema/logs
{
  echo "=== $D $(date +%H:%M:%S) ==="
  node preflight.mjs > ecosistema/estado-tienda.txt 2>&1 || echo "preflight falló" >> ecosistema/estado-tienda.txt
  cat ecosistema/estado-tienda.txt
  node ecosistema/parte.mjs
  node ecosistema/ideas.mjs
  node ecosistema/trafico.mjs
  node ecosistema/mundo.mjs
} >> "ecosistema/logs/$D.log" 2>&1
echo "parte: ecosistema/partes/$D.md"

#!/bin/zsh
# Despliega El Centro a hk23universe.vercel.app desde este worktree (rama el-centro sobre origin/main).
# hk23universe NO está conectado a git: se despliega con la CLI de Vercel y después se empuja la rama a main.
# Se corre únicamente vía `~/hq/hq.sh execute` (aprobación del dueño).
set -e
REPO="${0:A:h:h}"; cd "$REPO"
[ "$(git branch --show-current)" = "el-centro" ] || { echo "no estoy en la rama el-centro"; exit 1; }
git fetch -q origin main
# si main avanzó, desplegar desde aquí borraría lo nuevo de producción
git merge-base --is-ancestor origin/main HEAD || { echo "origin/main avanzó; rebasar la rama el-centro antes de desplegar"; exit 1; }

echo "== pruebas"
python3 centro/extraer.py >/dev/null && python3 centro/armar-web.py >/dev/null
./centro/tests/correr.sh | tee /tmp/centro-deploy-tests.log
grep -qE " [1-9][0-9]* FAIL" /tmp/centro-deploy-tests.log && { echo "hay pruebas fallando; no se despliega"; exit 1; }

echo "== commit"
python3 centro/extraer.py && python3 centro/armar-web.py
git add -A
git diff --cached --quiet || git commit -q -m "El Centro: mercado de agentes público (web + API + pase Shopify)

Página /centro (mapa de calor de 156 agentes, cupos libres como cubos vacíos, bloques
Sistemas/Oficinas/Agencias en pronto), API /api/centro-* con sesiones propias firmadas,
cuotas y topes por conexión en Supabase, prueba de entrada en el servidor, Pase 30 días
verificado contra la Admin API de Shopify y panel del dueño en /centro-admin.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

echo "== despliegue"
npx --yes vercel link --project hk23universe --yes >/dev/null
npx --yes vercel deploy --prod --yes

echo "== verificación en producción"
ok=""
for i in {1..18}; do
  if curl -fsS https://hk23universe.vercel.app/api/centro-estado | grep -q '"bloque":"agentes"' && \
     curl -fsS https://hk23universe.vercel.app/centro | grep -q 'id="bloques"'; then ok=1; break; fi
  sleep 10
done
[ -n "$ok" ] || { echo "producción no responde con El Centro; revisar el despliegue"; exit 1; }
git push -q origin el-centro:main
echo "PUBLICADO https://hk23universe.vercel.app/centro"

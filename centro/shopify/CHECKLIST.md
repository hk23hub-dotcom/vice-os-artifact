# El Centro — lo que tiene que hacer el dueño

Todo lo técnico está hecho y probado (140 pruebas). Esto es lo que solo tú puedes hacer, en orden.

## A · Antes de aprobar el despliegue (15 min)

1. **Supabase** (proyecto `iiqhhglgjsbnuihythko`) → SQL Editor → pegar y correr
   `supabase/migrations/0012_el_centro.sql`.
2. **Supabase**: **NO** activar "Allow anonymous sign-ins". El Centro usa sus propias sesiones, y ese proyecto
   es el de ViceGolfer: con anónimos activados, cualquiera podría usar las APIs pagadas de ViceGolfer.
3. **Vercel** → proyecto `hk23universe` → Settings → Environment Variables (Production):
   - `SUPABASE_SERVICE_ROLE_KEY` = la clave secreta de Supabase (Settings → API keys). Marcar como *Sensitive*.
   - `SUPABASE_URL` = `https://iiqhhglgjsbnuihythko.supabase.co` (si no existe ya).
   - `CENTRO_ADMIN_TOKEN` = una clave larga tuya (mínimo 24 caracteres; en la terminal: `openssl rand -hex 24`). Es la que abre `/centro-admin`.
4. **Vercel** → AI Gateway → cargar créditos y poner un **budget** mensual (sugerido US$30). Con los topes actuales,
   lo gratis cuesta como máximo ~US$3 al día y las pruebas de entrada otros ~US$3.

Después: `~/hq/hq.sh approve centro-deploy` y `~/hq/hq.sh execute`.

## B · Para cobrar el pase (20 min, después del despliegue)

5. **Shopify HK23 STUDIO** → crear el producto según `centro/shopify/pase-30-dias.md`
   (handle `pase-30-dias`, US$9, digital, sin envío). Confirmar que la tienda tenga un medio de pago activo.
6. **Shopify HK23 STUDIO** → crear una app de la tienda con permiso **read_orders** y acceso a
   **datos protegidos de clientes (email)** → copiar el token de Admin API.
7. **Vercel** (Production): `SHOPIFY_ADMIN_TOKEN` = ese token (*Sensitive*) y `CENTRO_PASE_URL` = la URL pública del producto.
   Luego **Redeploy** del último despliegue (las variables nuevas solo entran con un redeploy).
8. **Shopify** → Tienda online → Páginas → Agregar página "El Centro" → modo HTML → pegar
   `centro/shopify/pagina-el-centro.html`. Agregarla al menú.

## C · Probarlo tú mismo

- Abrir la página de Shopify, usar un agente (5 gratis), agotar los usos y ver que aparece el pase.
- Comprar el pase (o un pedido de prueba) y activarlo con el número de pedido + correo.
- Postular un agente y revisarlo en `https://hk23universe.vercel.app/centro-admin`.

# Freelancers Fundadores — diseño

## Qué pidió el dueño

- Una página donde freelancers se registran y dejan su contacto.
- En la página, los productos que quiere que vendan: cualquier producto de HK23 que esté funcionando.
- Lanzamiento con 3 productos: LeadHunter, DuckCam y la tienda HK23 STUDIO. Después se suman el ecosistema de agentes Pixel, El Centro, el universo HK23, las apps de golf y rugby, y libros y guías.
- Ver en la misma página cuánto venden los freelancers que ya funcionan, sin datos falsos.
- Abrir postulaciones en una fecha, unos días después del anuncio de LinkedIn, para captar a los primeros.
- Los primeros (fundadores) reciben algo mejor por probar el producto. Sus ventas son los datos reales de la segunda etapa, y se les explica al postular.
- Estilo visual: el mockup «HK23 Marketplace» del canvas de diseño, con fondo crema, bordes negros y sombras duras, Space Grotesk y Space Mono, y bloques de color.

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Dónde vive | `socios.html` y `socios-admin.html` en este repo (Vercel) | Es el sitio del universo HK23 |
| Backend | Funciones `security definer` de Supabase llamadas desde el navegador con la clave pública | El proyecto ya tiene 12 funciones en `/api` (límite del plan Hobby). Mismo patrón que `scale` |
| Atribución | Un código por socio. En Shopify es un código de descuento. Fuera de Shopify, `?ref=` más registro manual | Funciona con cualquier producto, esté donde esté vendido |
| Ventas de la tienda | Webhooks de Shopify firmados (HMAC) → Edge Function `socios-shopify` → `socios_registrar_shopify` (solo service role) | Automático y verificable. No suma funciones a Vercel |
| Datos reales | Etapa 1: el ranking no se publica. Etapa 2: alias, ventas y monto netos de reembolsos | Pedido del dueño: nada inventado |
| Consentimiento | Postular exige aceptar que alias y ventas se publiquen en la etapa 2 | Pedido del dueño |
| Fundadores | Primeros N aprobados en etapa 1 → número de fundador y comisión mayor (49 %) | «Algo mejor por probar el producto». El dueño apuesta a volumen: «100 ventas regalando 49 % es mejor que 5 de 100 % mías» |
| Base de la comisión | % de la **ganancia**: lo pagado − costo del producto (costo % × precio de lista). Comisión < 50 %. Descuento + costo de la tienda < 100 % | «Si te doy números, que siempre cuadren a mi favor y haya margen». Con 49 % sobre el precio, los posters PROOF OF WORK (57 % de costo real en Printify) se venderían a pérdida |
| Catálogo | Tabla editable desde el panel: disponible, próximamente u oculto | «Si está en esta página, lo puede vender» |
| Lanzamiento | LeadHunter (US$97, Gumroad), DuckCam ($49.990 CLP, preventa por Mercado Pago) y la tienda. El resto oculto. Se aplica una sola vez, también en la base que ya tenía el catálogo anterior | «Solo quiero partir con 3 productos» |
| Monedas | Todo se contabiliza en US$. Una venta en pesos se convierte al registrarla con `clp_por_usd` (960, el de los packs de LeadHunter) y guarda su monto original | DuckCam se cobra en pesos; el ranking y las comisiones necesitan una sola moneda |
| Atribución fuera de Shopify | LeadHunter: la landing lleva `?ref=` a un código de descuento de Gumroad (`/l/leadhunter/CÓDIGO`), y la venta muestra el código. DuckCam: su página (`/duckcam`) muestra el código del socio junto al pago para que el comprador lo diga, y el socio reporta al comprador; el dueño lo cruza con el pago | Atribución verificable sin funciones nuevas |
| Códigos | Solo letras y números | Gumroad no acepta guiones; el mismo código vale en Shopify y Gumroad |
| Ganancia por venta | La tarjeta muestra lo que gana el socio en plata (precio de lista × su parte), redondeado hacia abajo | Más concreto que un %; nunca promete de más |
| DuckCam | Página del artifact «DuckCam» publicada en `/duckcam` (imágenes comprimidas, rutas absolutas). Costo 95 %: el Build Dossier estima ~$38.500 por pato, que con IVA y Mercado Pago es ~97 % de $49.990 | «No está creado, hay que lanzarlo»; los números a favor de HK23 |
| Pago de comisiones | Pasado el plazo de devolución: LeadHunter 7 días; DuckCam al despachar + 10 días de retracto | Que una devolución no deje una comisión ya pagada |

## Piezas

- `supabase/migrations/0013_socios.sql`: 5 tablas con RLS y sin políticas. Puertas públicas `socios_estado`, `socios_anotar`, `socios_postular` y `socios_mi_panel`. Panel `socios_admin` (clave guardada como sha256). Servidor `socios_registrar_shopify`. Topes por IP (hash) y diarios.
- `supabase/functions/socios-shopify/index.ts`: verifica la firma y traduce `orders/paid`, `orders/cancelled` y `refunds/create`. Los ids exactos salen del texto crudo, porque pueden superar 2^53.
- `socios.html`: cuenta regresiva con la hora del servidor, catálogo, pasos, fundador vs etapa 2, etapas, ranking, formulario en dos modos y panel privado con `?llave=`.
- `socios-admin.html`: programa, postulaciones, socios (código y link del panel), ventas manuales y anular, productos, lista de espera.
- `socios/tests/`: SQL en PGlite, webhook, página en jsdom y recorrido completo página ↔ panel ↔ base.

## Fuera de alcance

- Crear los códigos de descuento en Shopify automáticamente. Lo hace el dueño, 2 minutos por socio.
- Pagar comisiones. Se paga fuera; el panel muestra cuánto corresponde.
- Correos automáticos. El panel copia la lista de correos para avisar el día de apertura.

# Freelancers Fundadores: lo que tiene que hacer el dueño

Todo lo técnico está hecho y probado: 252 pruebas, que se corren con `socios/tests/correr.sh`. Abajo está lo que solo tú puedes hacer, en orden.

- Página pública: `https://hk23universe.vercel.app/socios`
- Panel del dueño: `https://hk23universe.vercel.app/socios-admin`
- Página de DuckCam: `https://hk23universe.vercel.app/duckcam` (es la del artifact «DuckCam», con tus links de Mercado Pago)

## 0 · Cómo se calcula la comisión (siempre a tu favor)

La comisión es un % de la **ganancia** de cada venta, no del precio:

```
ganancia = lo que pagó el cliente − costo del producto (costo % × precio de lista)
socio    = comisión % × ganancia      (la comisión siempre es menor a 50 %)
HK23     = ganancia − socio           (siempre más que el socio)
```

La base de datos lo hace cumplir, pongas los números que pongas:

- Rechaza una comisión de 50 % o más.
- Rechaza un descuento que, sumado al costo de un producto donde el código descuenta, llegue a 100 %.
- Rechaza una venta manual sin producto, porque sin producto no se sabe el costo.

Está probado en 900 combinaciones de precio, descuento, costo, comisión y reembolso. En «Programa» del panel, la tabla «¿Cuadra?» muestra el reparto por cada US$100 mientras escribes los números.

Ejemplos con los números de lanzamiento (fundador al 49 %):

| Producto | El cliente paga | Costo | Ganancia | Fundador | HK23 |
|---|---|---|---|---|---|
| LeadHunter con el código | US$87,30 (97 − 10 %) | US$14,55 (15 % de 97) | US$72,75 | **US$35,65** | US$37,10 |
| DuckCam (Early Egg) | $49.990 = US$52,07 | 95 % (Build Dossier) | US$2,60 | **US$1,27** | US$1,33 |
| Poster con el código | US$15,87 | US$10,93 (62 % de 17,63) | US$4,94 | **US$2,42** | US$2,52 |

## 1 · Confirma estos números antes de publicar (quedaron como supuestos)

Se cambian en el panel, en «Programa» y en «Productos de la página». No hace falta tocar código.

| Ajuste | Valor puesto | De dónde sale |
|---|---|---|
| Apertura de postulaciones | martes 27 oct 2026, 12:00 (Chile) | Una semana después del aviso en LinkedIn |
| Cupos de fundador | 20 | |
| Comisión fundador | 49 % de la ganancia | Tu decisión: casi a medias, y por eso con cupos |
| Comisión etapa 2 | 10 % de la ganancia | |
| Descuento del código | 10 % | Solo se muestra en la página. El real es el que pongas en Shopify y Gumroad a cada código |
| Pesos por dólar | 960 | El mismo de los packs de LeadHunter ($27.900 = US$29). Con él se convierten las ventas en pesos |
| Costo LeadHunter | 15 % de US$97 | Gumroad: 10 % + US$0,50, más el cobro ~3 % + US$0,30 ≈ 14 % |
| **Costo DuckCam** | **95 % de $49.990 (el máximo)** | Tu Build Dossier: ~$38.500 por pato puesto en Chile (77 %), + IVA (16 % de un precio con IVA) + Mercado Pago (~4 %) ≈ 97 %. El Early Egg casi no deja margen |
| Costo de la tienda | 62 % del precio | Peor caso real de Printify en Shopify (PROOF OF WORK: 57 %) + 5 % de cobro |
| Pago de comisiones | cada mes, ventas del mes anterior que ya pasaron su plazo de devolución | LeadHunter: garantía de 7 días. DuckCam: al despachar + 10 días de retracto |

**DuckCam en el Early Egg deja ~$1.200 al fundador por pato.** Es lo honesto con tus números: a $49.990 el pato casi no tiene ganancia. Sirve para llenar los 100 cupos, no para hacerse rico vendiendo patos. Cuando pase a $69.990: «Productos de la página» → DuckCam → Editar → precio de lista 69990, precio «$69.990 CLP» y costo 75 % ($38.500 + IVA + Mercado Pago). Ahí el fundador gana ~$8.500 por pato.

Cómo recalcular el costo % de DuckCam si cambia la cotización: (lo que te cuesta cada pato puesto en la casa del cliente ÷ precio × 100) + 16 (IVA) + 4 (Mercado Pago).

## A · Supabase (5 min)

1. Supabase → proyecto `iiqhhglgjsbnuihythko` → SQL Editor → New query.
2. Pega `supabase/migrations/0013_socios.sql` tal cual, sin editar nada, y dale Run.
   - **Si ya lo habías corrido antes, córrelo otra vez.** Así se instala el catálogo de 3 productos, los pesos chilenos y los códigos sin guion. No se pierde la clave, la configuración, las ventas ni los productos que ya editaste.
3. Solo la primera vez: New query otra vez. Pega esto y dale Run. Crea la clave del panel y te la muestra una sola vez en los resultados:
   ```sql
   with k as (select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as clave),
        u as (update public.socios_config set value = encode(sha256(convert_to((select clave from k), 'UTF8')), 'hex')
               where key = 'admin_token_sha256' returning 1)
   select clave as tu_clave_del_panel from k, u;
   ```
4. Copia la clave que aparece abajo, en «Results», y guárdala en tu gestor de claves. La base guarda solo su huella, así que no se puede volver a ver. Si la pierdes, corre el paso 3 otra vez y te da una nueva.
5. Entra a `/socios-admin` con esa clave y revisa «Programa» y «Productos de la página».

En vez del paso 3 también puedes reemplazar `__SET_ADMIN_TOKEN__` en la línea 881 del archivo por una clave tuya de mínimo 24 caracteres antes de correrlo.

No hay que agregar variables en Vercel ni hacer redeploy: la página habla directo con Supabase.

## B · Ventas automáticas desde Shopify (15 min)

Sin este paso el programa funciona igual, pero las ventas de la tienda las registras a mano.

1. Instala la CLI de Supabase y entra: `brew install supabase/tap/supabase` y luego `supabase login`.
2. Desde la carpeta del repo despliega la función:
   ```
   supabase functions deploy socios-shopify --no-verify-jwt --project-ref iiqhhglgjsbnuihythko
   ```
3. Shopify HK23 STUDIO → Configuración → Notificaciones → Webhooks → Crear webhook. Crea **tres**, todos en formato JSON y con la misma URL:
   - Evento «Pago de pedido» (orders/paid).
   - Evento «Cancelación de pedido» (orders/cancelled).
   - Evento «Creación de reembolso» (refunds/create).
   - URL: `https://iiqhhglgjsbnuihythko.supabase.co/functions/v1/socios-shopify`
4. En esa misma página Shopify muestra la clave con la que firma los webhooks. Cárgala en Supabase:
   ```
   supabase secrets set SHOPIFY_WEBHOOK_SECRET=<esa clave> --project-ref iiqhhglgjsbnuihythko
   ```
5. Prueba: en el webhook de pago, botón «Enviar notificación de prueba». En Supabase → Edge Functions → socios-shopify → Logs debe aparecer un 200. El pedido de prueba no trae el código de ningún socio, así que no registra nada. Eso es lo correcto.

## C · Por cada freelancer que apruebes (4 min)

1. `/socios-admin` → «Postulaciones por revisar» → Aprobar. Puedes escribir el código que quieras o dejar que lo arme solo (ej. `HK23ANAP`). Solo letras y números: Gumroad no acepta guiones.
2. **Shopify** → Descuentos → Crear descuento → «Monto de descuento en el pedido» → Código de descuento = **el mismo código** → porcentaje (10 %) → Guardar.
3. **Gumroad** → Checkout → Discounts → New discount → código = **el mismo código** → 10 % → producto LeadHunter → Guardar. La página de LeadHunter lleva el código del socio a Gumroad sola (`hk23hub.gumroad.com/l/leadhunter/CÓDIGO`).
4. La primera vez, prueba el link de LeadHunter de ese socio y confirma que Gumroad muestra el precio con descuento.
5. En «Socios aprobados» → «Copiar link del panel» y mándaselo con este mensaje:

> Hola {nombre}: quedaste como Fundador #{N} del programa HK23. Tu código es {CÓDIGO}. En tu panel privado están tus links para vender LeadHunter, DuckCam y la tienda, y cada venta con tu comisión. No lo compartas: {link}. Con tu link, tus clientes tienen 10 % de descuento en LeadHunter y en la tienda. Si vendes un DuckCam, mándame el nombre de tu comprador. Pagamos cada mes. Cualquier duda, responde este mensaje.

## D · Ventas que registras tú (2 min cada una)

En `/socios-admin` → «Ventas» → «Registrar una venta hecha fuera de la tienda». Al elegir el producto, el panel propone la moneda y el monto. Corrígelo si el cliente pagó otra cosa.

- **LeadHunter (Gumroad).** Cada venta en Gumroad muestra el código de descuento que se usó. Ese código es el del socio. Registra lo que pagó el cliente en US$ y usa como referencia el id de la venta en Gumroad. Si alguien pide su devolución dentro de los 7 días, toca «Anular» en esa venta.
- **DuckCam (Mercado Pago).** Quien entra con el link de un socio ve su código junto al botón de pago, con la indicación de decirlo cuando le pidas la dirección. El socio también te manda el nombre de su comprador. Cruza las dos cosas con el pago en Mercado Pago. Registra el monto en pesos, por ejemplo 49990 en CLP, y usa como referencia el número de operación de Mercado Pago. Si cancela antes del despacho o se retracta, toca «Anular». La comisión se paga cuando despachas y pasan los 10 días de retracto.
- Antes de registrar ventas en pesos, actualiza «Pesos chilenos por US$» en «Programa» al tipo de cambio del día.

## E · Lanzamiento

1. **Merge del PR:** deja públicas `/duckcam`, `/socios` y `/socios-admin`. La página de DuckCam no depende de Supabase: vende desde el primer minuto. Abre los dos botones de compra y revisa que Mercado Pago cobre $49.990 por el modelo correcto.
2. **Hoy:** publica el anuncio de LinkedIn (texto abajo). Ubicación: Chile. Tipo de empleo: Otro.
3. **Día de apertura:** la página pasa sola a recibir postulaciones a la hora configurada. En `/socios-admin` → «Copiar todos los correos» y mándales este correo en copia oculta (CCO):

> Asunto: Abrieron las postulaciones de Freelancers Fundadores HK23
>
> Hola: hoy a las 12:00 abrimos las postulaciones. Son {cupos} cupos de fundador y los revisamos uno por uno. Postula aquí: https://hk23universe.vercel.app/socios#postular. Te toma 3 minutos.

4. **Cuando otro producto esté listo** (El Centro, Pixel, el universo, las apps, los libros): «Productos de la página» → Editar → Estado «Disponible», su link, su precio de lista y su moneda. Marca «El código del socio da descuento aquí» solo si creaste los códigos donde se cobra. Aparece al tiro en la página y en el panel de cada socio.
5. **Cada mes:** en «Socios aprobados» ves lo vendido y la comisión de cada uno. Págales lo que ya pasó su plazo de devolución y guarda el comprobante.
6. **Etapa 2:** cuando quieras mostrar resultados, ve a «Programa» → Etapa 2. La página publica el ranking real: alias, número de ventas y monto. Nunca correos, teléfonos ni comisiones.

## Texto para el anuncio de LinkedIn

Cargo: **Freelancers Fundadores · Programa de ventas HK23**

> **¿Quieres ser de los primeros? 49 % de la ganancia de cada venta es tuya.**
>
> HK23 abre su programa de Freelancers Fundadores: un grupo pequeño de freelancers que venderá los productos de HK23 antes que nadie. Nos repartimos la ganancia de cada venta casi a medias. Es más de lo que nos conviene, y por eso hay solo 20 cupos. Las postulaciones abren el martes 27 de octubre a las 12:00, hora de Chile. Anótate hoy en la lista y te avisamos ese día: https://hk23universe.vercel.app/socios
>
> **Sobre HK23**
> HK23 es un estudio chileno que construye productos con IA y los lleva al mercado.
>
> **Qué vas a vender**
> Partimos con tres productos:
> - **LeadHunter:** un agente de IA que encuentra empresas reales que pueden comprarle a tu cliente y le escribe el mensaje de contacto. Cuesta US$97 y por cada venta te llevas US$35.
> - **DuckCam:** una cámara de auto con forma de pato, que avisa que estás grabando. Está en preventa.
> - **Tienda HK23 STUDIO:** posters, stickers y ediciones PROOF OF WORK impresos bajo pedido.
>
> En la página del programa, cada producto muestra cuánto te llevas por venta.
>
> **Qué harás**
> - Recomendar los productos a tu audiencia o red con tus links personales.
> - Mostrar cada producto con casos reales: a quién le sirve y qué resuelve.
> - Probar cada producto antes del lanzamiento y contarnos qué dicen tus clientes.
>
> **Qué ganas como fundador**
> - 49 % de la ganancia de cada venta que hagas. La ganancia es lo que paga el cliente menos lo que cuesta fabricar, despachar, cobrar y pagar los impuestos del producto. Desde la etapa 2, la comisión es 10 %.
> - Con tu código, tus clientes tienen 10 % de descuento en LeadHunter y en la tienda.
> - Acceso anticipado: pruebas cada producto antes de que salga al público.
> - Sello «Fundador» permanente en el ranking del programa.
> - Panel privado con cada venta. Te pagamos cada mes.
> - Sin cuota de entrada, sin exclusividad y sin horario.
>
> **Cómo avanza**
> En la etapa 1 elegimos 20 fundadores y empiezan a vender. En la etapa 2 publicamos el ranking con las ventas reales de los fundadores y abrimos el programa a más freelancers. Al postular aceptas que tu alias y tus ventas se publiquen en esa etapa. Tu correo y tu teléfono, nunca.
>
> **Requisitos**
> - Audiencia o red propia en español: clientes, comunidad, seguidores o contactos.
> - Ganas de probar productos nuevos y contar lo que funciona.
> - Poder emitir boleta o factura como independiente.
>
> **Cómo postular**
> Entra a https://hk23universe.vercel.app/socios, anótate en la lista y postula desde el 27 de octubre.

Si cambias la fecha, los cupos, las comisiones o el costo de LeadHunter en el panel, cambia también estos números en el anuncio.

# Freelancers Fundadores — lo que tiene que hacer el dueño

Todo lo técnico está hecho y probado (185 pruebas: `socios/tests/correr.sh`). Esto es lo que solo tú puedes hacer, en orden.

- Página pública: `https://hk23universe.vercel.app/socios`
- Panel del dueño: `https://hk23universe.vercel.app/socios-admin`

## 0 · Cómo se calcula la comisión: siempre a tu favor

La comisión es un % de la **ganancia** de cada venta, no del precio:

```
ganancia = lo que pagó el cliente − costo del producto (costo % × precio de lista)
socio    = comisión % × ganancia      (la comisión siempre es menor a 50 %)
HK23     = ganancia − socio           (siempre más que el socio)
```

La base de datos lo hace cumplir, pongas los números que pongas:

- **Comisión de 50 % o más:** se rechaza.
- **Descuento que, sumado al costo de la tienda, llegue a 100 %:** se rechaza.
- **Venta manual sin producto:** se rechaza, porque sin producto no se sabe el costo.

Está probado en 900 combinaciones de precio, descuento, costo, comisión y reembolso. En «Programa» del panel, la tabla «¿Cuadra?» muestra el reparto por cada US$100 mientras escribes los números.

Ejemplo real: un poster de US$17,63 vendido con el código. El cliente paga US$15,87 y el costo es US$10,93 (62 % de 17,63). Quedan US$4,94 de ganancia: el fundador se lleva US$2,42 y HK23 US$2,52, más lo que sobra del costo calculado con margen de seguridad.

## 1 · Confirma estos números antes de publicar (quedaron como supuestos)

Se cambian en el panel, en «Programa» y en «Productos de la página». No hace falta tocar código.

| Ajuste | Valor puesto | De dónde sale |
|---|---|---|
| Apertura de postulaciones | martes 27 oct 2026, 12:00 (Chile) | Una semana después del aviso en LinkedIn |
| Cupos de fundador | 20 | |
| Comisión fundador | 49 % de la ganancia | Tu decisión: casi a medias, y por eso con cupos |
| Comisión etapa 2 | 10 % de la ganancia | |
| Descuento del código | 10 % | Solo se muestra en la página. El real es el que pongas en Shopify a cada código |
| Costo de la tienda | 62 % del precio | Peor caso real de Printify en Shopify (PROOF OF WORK: 57 %) + 5 % de cobro. Posters de arte 40 %, stickers 33–50 % |
| Costo de productos digitales | 15 % del precio | Plataforma y medios de pago. Ajusta cada uno cuando sepas dónde se vende |
| Pago de comisiones | cada mes, ventas pagadas del mes anterior | Está escrito así en la página (sección «Cómo funciona» y preguntas) |

Revisa también los textos del catálogo en «Productos de la página»: nombre de la app de golf, descripciones de Rugby Vice y de los libros, y precios.

## A · Supabase (10 min)

1. Supabase → proyecto `iiqhhglgjsbnuihythko` → SQL Editor → New query.
2. Pega `supabase/migrations/0013_socios.sql`.
3. Reemplaza `__SET_ADMIN_TOKEN__` por una clave tuya de mínimo 24 caracteres. En la terminal: `openssl rand -hex 24`. Guárdala en tu gestor de claves.
4. Run. Se puede correr de nuevo sin perder datos ni ajustes.
5. Entra a `/socios-admin` con esa clave y revisa la sección «Programa».

No hay que agregar variables en Vercel ni redeploy: la página habla directo con Supabase.

## B · Ventas automáticas desde Shopify (15 min)

Sin este paso el programa funciona igual, pero las ventas de la tienda las registras a mano.

1. Instala la CLI de Supabase y entra: `brew install supabase/tap/supabase` y luego `supabase login`.
2. Desde la carpeta del repo despliega la función:
   ```
   supabase functions deploy socios-shopify --no-verify-jwt --project-ref iiqhhglgjsbnuihythko
   ```
3. Shopify HK23 STUDIO → Configuración → Notificaciones → Webhooks → Crear webhook. Crea **tres**, todos en formato JSON y con la misma URL:
   - Evento «Pago de pedido» (orders/paid)
   - Evento «Cancelación de pedido» (orders/cancelled)
   - Evento «Creación de reembolso» (refunds/create)
   - URL: `https://iiqhhglgjsbnuihythko.supabase.co/functions/v1/socios-shopify`
4. En esa misma página Shopify muestra la clave con la que firma los webhooks. Cárgala en Supabase:
   ```
   supabase secrets set SHOPIFY_WEBHOOK_SECRET=<esa clave> --project-ref iiqhhglgjsbnuihythko
   ```
5. Prueba: botón «Enviar notificación de prueba» en el webhook de pago. En Supabase → Edge Functions → socios-shopify → Logs debe aparecer un 200. El pedido de prueba no trae el código de ningún socio, así que no registra nada, y eso es lo correcto.

## C · Por cada freelancer que apruebes (2 min)

1. `/socios-admin` → «Postulaciones por revisar» → Aprobar. Puedes escribir el código que quieras o dejar que lo arme solo (ej. `HK23-ANAP`).
2. Shopify → Descuentos → Crear descuento → «Monto de descuento en el pedido» → Código de descuento = **el mismo código** → porcentaje (10 %) → Guardar.
3. En «Socios aprobados» → «Copiar link del panel» y mándaselo con este mensaje:

> Hola {nombre}: quedaste como Fundador #{N} del programa HK23. Tu código es {CÓDIGO}. Tus clientes obtienen 10 % de descuento en la tienda y cada venta queda a tu nombre. Tu panel privado, no lo compartas: {link}. Ahí están tus links para vender y cada venta con tu comisión. Pagamos cada mes. Cualquier duda, responde este mensaje.

## D · Lanzamiento

1. **Hoy:** publica el anuncio de LinkedIn (texto abajo). Ubicación: Chile. Tipo de empleo: Otro.
2. **Día de apertura:** la página cambia sola a postulaciones a la hora configurada. En `/socios-admin` → «Copiar todos los correos» y mándales en copia oculta (CCO):

> Asunto: Abrieron las postulaciones de Freelancers Fundadores HK23
>
> Hola: hoy a las 12:00 abrimos las postulaciones. Son {cupos} cupos de fundador y los revisamos uno por uno. Postula aquí: https://hk23universe.vercel.app/socios#postular. Te toma 3 minutos.

3. **Cuando un producto esté listo** (El Centro, Pixel, el universo, las apps, los libros): «Productos de la página» → Editar → Estado «Disponible» + su link. Aparece al tiro en la página y en el panel de cada socio.
   - Si se vende en la tienda Shopify, elige «Tienda Shopify». El link del socio aplica su código solo.
   - Si se vende en otro lado, elige «Fuera de Shopify». El link lleva `?ref=CÓDIGO` y esas ventas las registras a mano en «Ventas».
4. **Cada mes:** en «Socios aprobados» ves lo vendido y la comisión de cada uno. Págales y guarda el comprobante.
5. **Etapa 2:** cuando quieras mostrar resultados, «Programa» → Etapa 2. La página publica el ranking real: alias, número de ventas y monto. Nunca correos, teléfonos ni comisiones.

## Texto para el anuncio de LinkedIn

Cargo: **Freelancers Fundadores · Programa de ventas HK23**

> **¿Quieres ser de los primeros? 49 % de la ganancia de cada venta es tuya.**
>
> HK23 abre su programa de Freelancers Fundadores: un grupo pequeño de freelancers que venderá los productos de HK23 antes que nadie. Nos repartimos la ganancia de cada venta casi a medias. Es más de lo que nos conviene, y por eso hay solo 20 cupos. Las postulaciones abren el martes 27 de octubre a las 12:00, hora de Chile. Anótate hoy en la lista y te avisamos ese día: https://hk23universe.vercel.app/socios
>
> **Sobre HK23**
> HK23 es un estudio chileno que construye productos con IA. Su ecosistema de agentes publica y opera la tienda HK23 STUDIO, con arte, posters, stickers y ediciones PROOF OF WORK. Además vienen El Centro, un mercado de agentes de IA, el universo HK23, apps de golf y rugby, y libros y guías.
>
> **Qué vas a vender**
> Todo lo que HK23 tenga funcionando y publicado en la página del programa. Hoy está disponible la tienda HK23 STUDIO. El resto se activa a medida que cada producto queda listo.
>
> **Qué harás**
> - Recomendar los productos a tu audiencia o red con tu código personal.
> - Mostrar cada producto con casos reales: a quién le sirve y qué resuelve.
> - Probar cada producto antes del lanzamiento y contarnos qué dicen tus clientes.
>
> **Qué ganas como fundador**
> - 49 % de la ganancia de cada venta pagada con tu código. La ganancia es lo que paga el cliente menos lo que cuesta fabricar y cobrar el producto. En lo digital es casi todo el precio. Desde la etapa 2, la comisión es 10 %.
> - Acceso anticipado: pruebas cada producto antes de que salga al público.
> - Sello «Fundador» permanente en el ranking del programa.
> - Panel privado con cada venta y pago mensual.
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

Si cambias la fecha, los cupos o las comisiones en el panel, cambia también estos números en el anuncio.

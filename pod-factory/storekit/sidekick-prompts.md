# Prompts para Sidekick — HK23 STUDIO, tienda en inglés para vender al mundo

La tienda apunta al mercado que más compra (Estados Unidos primero), así que **todo lo que ve el
cliente va en inglés y en dólares**. Los prompts están en español para ti; los textos de la tienda
van en inglés y hay que pegarlos tal cual.

Pega **un prompt a la vez**, en orden. Revisa el resultado y guarda antes de pasar al siguiente.

---

## 0 · PRIMERO: la moneda (no abras la tienda sin esto)

Tu tienda está en **pesos chilenos**. Printify manda los precios como número en dólares, sin
convertir: un poster de US$8,93 quedaría a la venta en **$9 pesos**. La moneda solo se puede
cambiar mientras la tienda no tenga ventas, y hoy no tiene ninguna.

```
Necesito cambiar la moneda de mi tienda de CLP a USD (dólar estadounidense). Todavía no tengo
ningún pedido. Llévame a Settings → General → Store currency y guíame para cambiarla a USD.
Después confírmame en qué moneda quedaron los precios de mis productos y muéstrame el precio de
tres de ellos. Los números deben quedar iguales (por ejemplo 8.93), pero en dólares.
```

---

## 1 · Identidad, idioma y colores

```
Configura la identidad de mi tienda. Es una tienda en INGLÉS que vende a Estados Unidos y al resto
del mundo.

NOMBRE: la tienda se llama "HK23 STUDIO". Reemplaza "Mi tienda 6" en el encabezado y donde aparezca.

IDIOMA: el idioma principal de la tienda online debe ser inglés. Todos los textos del tema
(botones, carrito, checkout, mensajes) deben quedar en inglés.

COLORES (reemplaza el amarillo/lima actual en todos los esquemas de color):
- Fondo principal: #0A0A0B
- Texto principal: #F5F5F5
- Botones principales y acento: #FF5A36 con texto #0A0A0B
- Enlaces y detalles: #2F6FD1
- Hover y etiquetas: #7EA6E0

ESTILO: minimal, tipo terminal. Botones con esquinas rectas (radio 0), sin sombras, bordes de 1px,
sin degradados.

BARRA DE ANUNCIO: reemplaza "Welcome to our store" por:
"Printed on demand · Worldwide shipping · Every piece is made when you order it"
Fondo #FF5A36, texto #0A0A0B.

No cambies todavía la estructura de las secciones.
```

---

## 2 · Colecciones automáticas

```
Crea estas colecciones AUTOMÁTICAS por etiqueta de producto (product tag). Cada día entran
productos nuevos ya etiquetados, así que deben ser automáticas, nunca manuales. Publícalas todas
en la tienda online. Los títulos y descripciones van en inglés, tal cual.

LÍNEAS PRINCIPALES
1. "PROOF OF WORK" (handle: proof-of-work) — etiqueta igual a "proof of work"
   "Your work, made object. Every piece comes from a real activity snapshot: sessions, messages,
   active days, streaks. The same data always returns the same image, so nobody else can have
   yours."
2. "PROOF OF WORK · Stickers" (handle: proof-of-work-stickers) — etiquetas "proof of work" Y "sticker"
   "The way into the collection. Die-cut waterproof vinyl for your laptop, bottle or helmet."
3. "PROOF OF WORK · Numbered Posters" (handle: proof-of-work-posters) — etiquetas "proof of work"
   Y "numbered edition"
   "Each poster freezes one exact work snapshot and carries its printed serial. Editions of 100.
   When one closes, it does not come back."
4. "IDLE CYCLES" (handle: idle-cycles) — etiqueta igual a "idle cycles". Orden: más nuevos primero.
   "What the machine imagines when it is not working. Generative art curated piece by piece."
5. "Shop All" (handle: shop-all) — etiqueta igual a "hk23". Orden: más nuevos primero.

COLECCIONES TEMÁTICAS (todas: orden más nuevos primero)
6.  "NEON DRIVE" (handle: neon-drive) — etiqueta "neon drive"
    "Synthwave sunsets, palm lines and chrome horizons."
7.  "THIRD EYE" (handle: third-eye) — etiqueta "third eye"
    "Psychedelic and visionary pieces. Look longer than you planned to."
8.  "CREATURES" (handle: creatures) — etiqueta "creatures"
    "Beasts, companions and things that look back at you."
9.  "CIRCUIT CITY" (handle: circuit-city) — etiqueta "circuit city"
    "Cyberpunk streets, circuits and machines with opinions."
10. "SACRED GRID" (handle: sacred-grid) — etiqueta "sacred grid"
    "Mandalas, totems and geometry drawn like a ritual."
11. "HARD EDGE" (handle: hard-edge) — etiqueta "hard edge"
    "Cubist, abstract and minimal. Shape first, story later."
12. "FIELD & TURF" (handle: field-and-turf) — etiqueta "field and turf"
    "Golf, rugby and the quiet hours before the first whistle."
13. "WILD BLOOM" (handle: wild-bloom) — etiqueta "wild bloom"
    "Folk botanicals, jungle and gardens that refuse to stay in the vase."
14. "OPEN STUDIO" (handle: open-studio) — etiqueta "open studio"
    "Pieces that do not fit a box. Landscapes, portraits and one-offs."
```

---

## 3 · Página de inicio

```
Rearma la página de inicio con estas secciones en este orden. Todos los textos en inglés, tal cual.

1. HERO (mantén la imagen de fondo actual con una capa oscura para que el texto se lea):
   Headline: "Your work, made object."
   Subhead: "Printed art generated from real data and from a machine's free time. Made when you
   order it, shipped worldwide."
   Primary button: "Shop IDLE CYCLES" → colección idle-cycles
   Secondary button: "Shop PROOF OF WORK" → colección proof-of-work

2. LISTA DE COLECCIONES en grilla (8 tarjetas con imagen): NEON DRIVE, THIRD EYE, CREATURES,
   CIRCUIT CITY, SACRED GRID, HARD EDGE, FIELD & TURF, WILD BLOOM.
   Title: "Pick your world"

3. COLECCIÓN DESTACADA: idle-cycles, 8 productos, más nuevos primero.
   Title: "New this week"
   Text: "A new piece drops every day."

4. COLECCIÓN DESTACADA: proof-of-work, 4 productos.
   Title: "PROOF OF WORK"
   Text: "Season One: five stickers and the numbered posters. The sticker is the way in; the
   poster is the piece."

5. TRES BLOQUES en una fila:
   - "The data is the art" — "Sessions, messages, active days, streaks. The same numbers always
     return the same image. That is why every piece carries a serial."
   - "Printed when you order it" — "Nothing is produced before it sells. Less waste, no dead stock."
   - "Numbered editions" — "Posters ship in editions of 100 with the serial printed on the piece."

6. FRANJA DE ENVÍO:
   Title: "Worldwide shipping"
   Text: "We ship almost everywhere, from the production center closest to you. Exact times and
   costs are calculated at checkout."

7. SUSCRIPCIÓN POR CORREO:
   Title: "Edition alerts"
   Text: "One email when a new edition drops or when one is about to close. Nothing else."
   Button: "Subscribe"

Elimina la sección genérica "Productos" y el texto "Browse our latest products".
```

---

## 4 · Páginas

```
Crea y publica estas 3 páginas en inglés:

PAGE "Story" (handle: about):

## It started as a dashboard
HK23 has spent years logging its own work: sessions, messages, active days, streaks. Data nobody
cares about and that usually deletes itself. One day those numbers were plotted on a grid. The grid
looked good. Good enough to ask for a frame.

## How a piece is made
The engine takes a real activity snapshot and turns it into an image with a deterministic function:
filled cells come from active days, the depth of the blue from sessions, and the coral peaks from
the longest streak. The same numbers always return the same image. That is why every edition
carries a printed serial.

## Two lines
PROOF OF WORK is the record of the work. IDLE CYCLES is what the machine imagines when it is not
working: generative art made to hang, no statistics behind it.

## How it gets to you
Everything is printed on demand. Nothing exists before you order it. Your order is produced at the
center closest to you and shipped from there.

## Who is behind this
HK23 STUDIO is the printed arm of HK23, an independent studio building tools, agents and objects.

PAGE "FAQ" (handle: faq), en formato acordeón:
- How long does my order take? → Every piece is printed when you order it. Production takes a few
  business days and then it ships; the estimated delivery time for your country shows at checkout.
- Where does it ship from? → From the production center closest to your address.
- Are there taxes or customs fees? → Depending on the destination country, import charges may
  apply and are paid by the buyer.
- Can I return a product? → Because every piece is made to order, we do not accept returns for
  change of mind. If it arrives damaged or misprinted, send us photos and we will replace it.
- What does the serial mean? → It identifies the exact data snapshot that generated that piece.
- Can I order a piece made from my own data? → Yes, write to us from the contact page.

PAGE "Contact" (handle: contact), con la plantilla de contacto con formulario:
"For orders, custom editions or press, write to us using this form."
```

---

## 5 · Menús

```
Configura los menús de navegación, en inglés:

MAIN MENU:
- IDLE CYCLES → colección idle-cycles, con este submenú:
    NEON DRIVE, THIRD EYE, CREATURES, CIRCUIT CITY, SACRED GRID, HARD EDGE, FIELD & TURF,
    WILD BLOOM, OPEN STUDIO (cada uno a su colección)
- PROOF OF WORK → colección proof-of-work, con submenú:
    Stickers → proof-of-work-stickers
    Numbered Posters → proof-of-work-posters
- Shop All → colección shop-all
- Story → página about
- FAQ → página faq

FOOTER MENU:
- Story, FAQ, Contact
- Shipping → shipping policy
- Returns → refund policy
- Privacy → privacy policy
- Terms → terms of service

Reemplaza los items actuales "Inicio", "Catálogo" y "Contacto".
```

---

## 6 · Pagos, envíos e impuestos

```
Mi negocio está en Chile y vendo a Estados Unidos. NO uso Stripe. Configura o guíame en esto,
punto por punto, con el link directo a cada pantalla:

1. PAGOS: activa PayPal como medio de pago principal (cobro en USD). Muéstrame qué otros
   proveedores de tarjeta tengo realmente disponibles para un comercio en Chile que cobra en USD.
   NO actives Mercado Pago en esta tienda: liquida solo en pesos chilenos.
2. ZONAS DE ENVÍO: deja una sola zona activa, Estados Unidos. Elimina o desactiva el resto de
   países por ahora. Mis productos los imprime y despacha Printify desde Estados Unidos.
3. TARIFAS DE ENVÍO: usa las tarifas planas que envía Printify en sus perfiles de envío. Revisa
   que ningún producto quede con envío en cero ni con la tarifa duplicada.
4. IMPUESTOS: no quiero cobrar sales tax al cliente ni registrarme en ningún estado; soy un
   vendedor extranjero pequeño sin presencia en Estados Unidos. Deja los impuestos sin cobro
   automático y confírmame cómo queda.
5. PRODUCTOS: revisa que todos mis productos estén en estado "Active" y disponibles en el canal
   "Online Store". Dime cuántos hay en borrador o fuera del canal.
6. POLÍTICAS en inglés (shipping, refund, privacy, terms) para una tienda de impresión bajo
   demanda que despacha desde Estados Unidos. Pregúntame los datos legales que falten; no los
   inventes.

No hagas cambios en pagos ni en el plan sin preguntarme antes.
```

---

## 7 · Abrir la tienda

Solo cuando el prompt 0 y el 6 estén listos.

```
Quiero abrir mi tienda al público. Antes de quitar la protección con contraseña, confírmame
estas cuatro cosas y muéstrame el valor actual de cada una:
1. La moneda de la tienda es USD.
2. Hay al menos un medio de pago activo que cobra en USD.
3. La única zona de envío activa es Estados Unidos y tiene tarifas mayores que cero.
4. El plan de Shopify está activo.
Si las cuatro están bien, llévame a Online Store → Preferences para quitar la contraseña.
Si alguna falla, no sigas y dime cuál.
```

# SERIE "ROCAS" — brief de producción
**Para:** Club de Golf Rocas de Santo Domingo · **Estado:** brief, sin producir

Una serie que **solo vos podés vender**. Un póster genérico de golf lo compra
cualquiera en Amazon. Una lámina de *su* campo, no.

---

## Qué hace distinta a esta serie

| Genérico (lo que tenés hoy) | Serie ROCAS |
|---|---|
| "Lone Golfer Field Poster" | El hoyo que el socio juega todos los sábados |
| Compite con miles | No compite con nadie |
| $17 y el cliente duda | Es pertenencia: se paga distinto |
| Venta suelta | Merchandising de club, se repone |

Anclas reales del club, para usar en el arte y en el texto:

- **1952** — más de 70 años
- **"La Catedral del golf chileno"** — así le dicen
- **27 hoyos** · más de 90 hectáreas
- Entre los **100 mejores campos del continente**
- Dunas, pinos y viento de costa — no es un campo de interior

---

## Las piezas

### 1 · El plano del campo *(la pieza madre)*
Los 27 hoyos vistos desde arriba, estilizados. **Es lo que más se vende en un
pro shop después de la ropa.** Una sola pieza, formato grande, vertical.

> Va en el hall y en la casa de cada socio que quiera decir dónde juega.

### 2 · Los hoyos firma *(3 a 5 piezas)*
Los que todo socio nombra. Mismo tratamiento, mismo papel, numeradas.
Cada socio compra el suyo.

### 3 · La serie atmósfera *(6 a 8 piezas)*
Duna, pino, bandera en el viento, sombra larga del atardecer, el mar detrás.
Sin cara, sin marca: **esto es lo que se vende al público general** también,
porque funciona sin conocer el club.

### 4 · Edición aniversario
Numerada y firmada, tirada corta. Para socios antiguos y regalos del club.

---

## Prompts para MidJourney

Estilo común a toda la serie, para que se lea como conjunto y no como piezas sueltas:

```
--ar 2:3 --style raw --v 6
paleta: verde apagado, arena, gris de mar, negro tinta
sin texto, sin logos, sin caras reconocibles
grano fino de impresión, no digital brillante
```

**Plano del campo**

```
stylized aerial map of a 27-hole coastal links golf course, dunes and pine
groves, hand-drawn cartographic style, muted sage and sand palette, fine
ink linework, subtle paper grain, no text, vertical composition --ar 2:3
--style raw --v 6
```

**Hoyo firma**

```
single golf hole seen from the tee, coastal dune course, pine shadows across
fairway, low afternoon light, cinematic and quiet, muted sage and sand,
fine print grain, no people, no logos --ar 2:3 --style raw --v 6
```

**Atmósfera**

```
flag on a coastal golf green in strong wind, sea haze behind the dunes,
long shadows, restrained palette of sage sand and slate, painterly matte
finish, no text --ar 2:3 --style raw --v 6
```

Variá la última línea por pieza: *pino solitario · duna al amanecer · rastrillo
en el bunker · huella en la arena mojada · el mar detrás del green.*

---

## Cómo entra a la fábrica

1. Generás en MidJourney y bajás las imágenes
2. Las dejás en `inbox/` como carpeta o `.zip`
3. `node intake.mjs --live` → entran a `library/` esperando curaduría
4. Curás: solo lo que sirve entra al catálogo
5. `node daily.mjs --live` → se publican con URL real

**Importante:** lado corto ≥ 1800px o la pieza sale como sticker en vez de
póster. Para el plano del campo pedí la máxima resolución posible.

---

## Lo comercial

**El club no compra.** Consignación: ponés las piezas, el club se queda con un
porcentaje de lo que venda, no arriesga un peso. El "sí" les cuesta cero.

**Tres espacios, tres ventas distintas:**

- **Hall** — el plano del campo en grande. Es la que los socios ven y preguntan.
- **Pro shop** — hoyos firma y atmósfera, rotando.
- **Tienda online del club** — ya existe y vende ropa. Agregar láminas no les
  cuesta nada y a vos te da un canal permanente.

**El plano del campo primero.** Es la que abre la puerta: nadie más la tiene, y
una vez colgada en el hall, el resto de la serie se vende sola.

---

_Brief del ecosistema. Nada producido, nada enviado._

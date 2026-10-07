# theme/ — ajustes del tema Spotlight

`spotlight.json` **no es** un `settings_data.json`. Es una especificación de las claves que queremos
imponer. El aplicador descarga el `config/settings_data.json` del tema activo, mezcla **solo** las
claves que ya existan ahí, y lo sube de vuelta. Una clave que el tema no tiene se reporta como
`omitida` y no se escribe: así el kit sirve para cualquier versión de Spotlight sin romper el tema.

Antes de escribir, el aplicador guarda una copia del `settings_data.json` original en
`backups/settings_data.<themeId>.<timestamp>.json`.

## Qué toca y por qué

### `color_schemes` (Spotlight moderno, base Dawn)

Cinco esquemas, uno por trabajo. Ningún esquema mezcla coral con azul: el coral marca acción,
el azul marca dato.

| Esquema | Para qué | Decisión |
|---|---|---|
| `scheme-1` | Base de toda la tienda | Fondo `#0A0A0B`, texto `#F5F5F5`, botón coral con etiqueta casi negra. El coral sobre negro tiene contraste suficiente y la etiqueta oscura sobre coral evita el blanco sobre naranjo, que es el error de contraste típico. |
| `scheme-2` | Corte hueso | Invierte a fondo `#F5F5F5` con texto `#0A0A0B`. Sirve para una sección de respiro sin introducir un color nuevo. |
| `scheme-3` | IDLE CYCLES y bloques de dato | Fondo `#11131A`, texto `#7EA6E0`, botón `#2F6FD1`. El azul es el color del dato en PROOF OF WORK; aquí identifica la segunda colección. |
| `scheme-4` | Llamados grandes y badge de oferta | Coral sólido con texto casi negro. Se usa poco a propósito. |
| `scheme-5` | Footer y legales | Oscuro con texto azul suave: baja el peso del pie sin apagarlo del todo. |

Claves por esquema: `background`, `background_gradient` (vacío a propósito, la marca no usa
degradados), `text`, `button`, `button_label`, `secondary_button`, `secondary_button_label`,
`shadow`.

### `legacy_color_settings`

Las versiones viejas de Spotlight guardan los colores planos (`colors_background_1`,
`colors_accent_1`, …) en lugar de `color_schemes`. Están en el archivo por si el tema instalado es
de esa generación; si el tema usa `color_schemes`, estas claves simplemente no existen y se omiten.

### Forma y densidad

- `buttons_radius`, `inputs_radius`, `card_corner_radius`, `media_radius`, `badge_corner_radius` y
  `popup_corner_radius` en `0`: esquina viva en todo. Es la decisión que más empuja el look
  terminal, por encima de cualquier tipografía.
- Todas las sombras (`*_shadow_opacity`, offsets y blur) en `0`. La marca es plana; una sombra
  suave es lo que convierte una tienda mínima en una tienda genérica.
- Bordes de 1 px con opacidad baja (`card_border_opacity: 20`, `inputs_border_opacity: 55`): la
  retícula se insinúa, no grita.
- `page_width: 1400` y `spacing_grid_*: 8`: grilla apretada, el arte manda sobre el aire.
- `spacing_sections: 0`: las secciones se pegan y el color de cada esquema hace de separador.
- `card_style: standard` y `card_text_alignment: left`: nada de tarjetas con fondo ni texto
  centrado; el poster tiene que leerse como pieza, no como producto de catálogo.

### Producto y navegación

- `cart_type: drawer` y `predictive_search_enabled: true`: menos pasos entre ver y comprar.
- `currency_code_enabled: true`: la tienda vende fuera de Chile, el código de moneda evita la
  ambigüedad de `$`.
- `show_vendor: false`: el proveedor es Printify y no aporta nada al comprador.
- `accent_icons: text`: los íconos toman el color del texto en vez del acento, así el coral queda
  reservado para los botones.
- `animations_reveal_on_scroll: true` con `animations_hover_elements: default`: movimiento mínimo.
- `sale_badge_color_scheme: scheme-4`, `sold_out_badge_color_scheme: scheme-5`: el badge de oferta
  usa el coral y el de agotado se apaga. Útil cuando cierre una edición numerada.

### Tipografía — no se aplica por defecto

`fonts.apply_by_default` es `false` y el aplicador ignora el bloque salvo que le pases `--fonts`.

Motivo: el Asset API acepta cualquier string en un `font_picker`. Si el handle no existe en la
librería de Shopify, el tema no encuentra la fuente y el render se cae. No hay forma de validar el
handle por API antes de escribirlo.

Camino correcto: abrir **Tienda online > Temas > Personalizar > Configuración del tema >
Tipografía**, ver qué fuente ofrece el selector, y recién ahí decidir. Los candidatos del archivo
(`space_mono_n4`, `ibm_plex_mono_n4`) son los más cercanos al look terminal, pero hay que
confirmarlos a ojo antes de usar `--fonts`.

El peso terminal se consigue igual sin tocar la fuente: títulos de sección escritos en MAYÚSCULAS
y esquinas vivas.

### `manual_only`

`favicon` y `brand_image` apuntan a archivos que hay que subir desde el editor; no se pueden
setear con un merge de JSON. Los links sociales quedan como `[COMPLETAR: ...]` hasta que existan
cuentas reales.

## Lo que el aplicador nunca hace

- No sobrescribe el `settings_data.json` completo.
- No crea claves nuevas en el tema.
- No toca `templates/*.json` ni las secciones: el copy de la home se pega a mano desde
  `out/home-copy.txt` (ver README.md raíz).
- No cambia el tema activo ni publica un tema.

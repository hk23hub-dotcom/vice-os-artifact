# leads-inbox — el puente con LeadHunter

LeadHunter es un agente HTML: corre en el navegador, usa tu propia API key y
**no tiene base de datos local**. Por eso el puente con el agente vendedor es
esta carpeta.

## Cómo se usa

1. Corre LeadHunter y exporta la lista de prospectos (**CSV** o **JSON**).
2. Deja el archivo tal cual dentro de esta carpeta. El nombre da lo mismo:
   `leads-2026-09-24.csv`, `constructoras-santiago.json`, lo que sea.
3. Corre `node daily.mjs` desde `pod-factory/sales/`.

Nada más. No edites `data/leads.json` a mano.

## Qué lee el normalizador

Extensiones: `.csv` y `.json` (un array de objetos, o un objeto con `leads`,
`results`, `data` o `items` adentro). Cualquier otro archivo se ignora.

Columnas reconocidas (mayúsculas, acentos y espacios dan lo mismo):

| campo interno | encabezados que acepta |
|---|---|
| `nombre`  | nombre, name, contacto, contact, full name, first name |
| `empresa` | empresa, company, negocio, business, organizacion, account |
| `rubro`   | rubro, industria, industry, sector, categoria, category, giro |
| `email`   | email, correo, mail, e-mail, correo electronico |
| `ciudad`  | ciudad, city, comuna, localidad |
| `pais`    | pais, country, nacion |
| `sitio`   | sitio, web, website, url, sitio web, pagina, domain |
| `notas`   | notas, notes, observaciones, comentarios, descripcion, bio |

Faltan columnas, sobran columnas, vienen vacías: no importa. Lo que no
reconoce lo guarda igual en `extra` por si sirve después.

## Reglas

- **Deduplicación**: primero por email, después por dominio del sitio. Si el
  mismo lead vuelve a aparecer en otro export, se actualizan sus datos pero
  **se conserva su estado** (nunca vuelve de `contactado` a `nuevo`).
- **Nada se borra**: los archivos quedan acá como registro de qué se procesó.
- **Sin email no hay cola**: un lead sin email queda `nuevo` y aparece en el
  informe como pendiente de dato, no se le compone mensaje.
- Este agente **jamás envía correo**. Todo queda en `out/` esperando tu OK.

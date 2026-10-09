// LeadHunter Locales — lógica sin DOM: prompt del agente, armado de la consulta, lectura del stream,
// fichas de la cartera, CSV, GPS de fotos y matemática de teselas. Se prueba en node (tests/locales-core.test.mjs).

export const PAISES = {
  CL: {
    nombre: 'Chile',
    lugar: 'comuna de Santo Domingo (Provincia de San Antonio, Región de Valparaíso, Chile), incluidas Las Rocas de Santo Domingo, y el mercado vecino de San Antonio, Llolleo y Cartagena',
    centro: [-33.6375, -71.636], zoom: 15, cc: 'cl',
    ubic: { type: 'approximate', city: 'Santo Domingo', region: 'Valparaíso', country: 'CL', timezone: 'America/Santiago' },
  },
  DO: {
    nombre: 'República Dominicana',
    lugar: 'Santo Domingo, República Dominicana (Distrito Nacional y municipios de Santo Domingo Este, Norte y Oeste)',
    centro: [18.4861, -69.9312], zoom: 14, cc: 'do',
    ubic: { type: 'approximate', city: 'Santo Domingo', country: 'DO', timezone: 'America/Santo_Domingo' },
  },
};

export const MODELOS = {
  'claude-opus-5-5': { nombre: 'Claude Opus 5.5 (mejor)', inUSD: 4, outUSD: 20, cacheUSD: 0.2 },
  'claude-sonnet-5-5': { nombre: 'Claude Sonnet 5.5 (más barato)', inUSD: 2, outUSD: 10, cacheUSD: 0.2 },
};

const RUTA = {
  CL: `Contexto: los arriendos comerciales se publican en UF o en pesos y la renta se reajusta por UF o IPC.
Para encontrar al dueño:
Rápido y gratis
- Teléfono en letreros de "se arrienda" o "se vende", actuales o en el Street View histórico.
- Anuncios de esa dirección en Portal Inmobiliario, Yapo, iCasas, Toctoc, Mitula, Goplaceit, Facebook Marketplace y grupos locales de Facebook. Pueden ser del dueño o de una corredora.
- Corredoras de propiedades que trabajan Santo Domingo y San Antonio.
- Ficha de Google Maps y redes del negocio anterior.
Público, con algo más de trabajo
- Mapas SII (cartografía digital del Servicio de Impuestos Internos): al ubicar el predio entrega rol de avalúo, dirección, destino y avalúo fiscal. No muestra al dueño, pero el rol es la llave de los trámites formales. Si no puedes abrirlo, explica al usuario cómo sacar el rol con las coordenadas.
- Patentes comerciales de la Municipalidad de Santo Domingo, si las publica en Transparencia Activa: titular, giro y dirección. Normalmente identifican al arrendatario anterior.
- Si el titular es una empresa: Registro de Empresas y Sociedades o publicaciones del Diario Oficial (socios y representante), y su web o teléfono comercial.
- Administración del centro comercial, edificio o condominio, y junta de vecinos.
En terreno (lo hace el usuario): vecinos, locatarios del lado, conserje. Deja una nota con sus datos para el dueño.
Formal
- Conservador de Bienes Raíces de la comuna (para Santo Domingo, el de San Antonio; confírmalo): Certificado de Dominio Vigente (dueño inscrito) y Certificado de Hipotecas y Gravámenes, Interdicciones y Prohibiciones. Se piden con fojas, número y año de la inscripción; si solo hay rol y dirección, un corredor, abogado o gestor puede ubicar la inscripción. Requisitos y tarifas: confírmalos en el sitio del Conservador.
- Abogado, corredor de propiedades o tasador.
Casos especiales: propiedades adjudicadas por bancos; remates judiciales publicados; inmuebles fiscales (Ministerio de Bienes Nacionales); si el dueño falleció, posesión efectiva (Registro Civil) y trato con todos los herederos.
Documentos antes de firmar: Certificado de Dominio Vigente; Certificado de Hipotecas y Gravámenes; certificado de avalúo fiscal (SII) y contribuciones al día (Tesorería); RUT del dueño y poder si firma un representante; posesión efectiva si es sucesión; permisos y recepción final de la Dirección de Obras Municipales y Certificado de Informaciones Previas para confirmar que el uso comercial está permitido; luz, agua y gastos comunes al día. En el contrato: garantía, mes adelantado, reajuste, plazo y estado de entrega, revisado por abogado (arriendo de inmuebles urbanos, Ley 18.101).
Datos personales: Ley 19.628, y la Ley 21.719 desde su entrada en vigencia.`,
  DO: `Contexto: arriendos en RD$ o US$.
Para encontrar al dueño:
Rápido y gratis
- Teléfono en letreros actuales o en el Street View histórico.
- Anuncios en SuperCasas, Corotos, Encuentra24, Facebook Marketplace y grupos inmobiliarios de RD.
- Corredores con letreros en la misma calle.
- Ficha de Google Maps y redes del negocio anterior.
Público, con algo más de trabajo
- Nombre comercial del negocio anterior en ONAPI; RNC en la consulta pública de la DGII; Registro Mercantil en la Cámara de Comercio y Producción de Santo Domingo (la certificación tiene costo: pide OK).
- Administración de la plaza o del condominio.
En terreno (lo hace el usuario): vecinos, colmado, guardián, junta de vecinos. Deja una nota para el dueño.
Formal
- Registro Inmobiliario (ri.gob.do o app RI Móvil): Certificación de Estado Jurídico del Inmueble, con dueño registrado, cargas, gravámenes y litis. Pide matrícula o designación catastral. Confirma requisitos y tarifa en la web oficial.
- Abogado, notario o agrimensor.
Casos especiales: bienes adjudicados de bancos (Banreservas, Popular, BHD); Dirección General de Bienes Nacionales; sucesiones con determinación de herederos.
Documentos antes de firmar: Certificado de Título; Certificación de Estado Jurídico; IPI al día (DGII); cédula o RNC y poder si hay representante; determinación de herederos si aplica; plano o mensura; uso de suelo del ayuntamiento; luz (EDESUR o EDEESTE) y agua (CAASD) sin deudas; cuotas de condominio al día; para compra, Certificación con Reserva de Prioridad antes de pagar.
Datos personales: Ley 172-13. Los derechos registrados no se adquieren por prescripción (Ley 108-05).`,
};

const ROLES = {
  directo: 'interesado directo: busca arrendar o comprar para su propio negocio',
  corredor: 'corredor de propiedades: capta locales para arrendarlos o venderlos a sus clientes',
};

function v(x, def) { const s = String(x == null ? '' : x).trim(); return s || def; }

export function bloqueConfig(cfg = {}) {
  return [
    `- Quien contacta: ${v(cfg.nombre, '[sin nombre: déjalo como [TU NOMBRE] en las plantillas]')}`,
    `- Empresa o marca: ${v(cfg.empresa, 'a título personal')}`,
    `- Teléfono / WhatsApp: ${v(cfg.telefono, '[TU TELÉFONO]')}`,
    `- Correo: ${v(cfg.correo, '[TU CORREO]')}`,
    `- Rol: ${ROLES[cfg.rol] || ROLES.directo}`,
    `- Uso que le dará al local: ${v(cfg.uso, 'no indicado')}`,
    `- Presupuesto: ${v(cfg.presupuesto, 'no indicado; usa los comparables para orientar')}`,
    `- Metraje buscado: ${v(cfg.metraje, 'no indicado')}`,
    `- Zonas prioritarias: ${v(cfg.zonas, 'las del país configurado')}`,
  ].join('\n');
}

export function buildSystem({ pais = 'CL', cfg = {} } = {}) {
  const P = PAISES[pais] || PAISES.CL;
  return `LEADHUNTER LOCALES

Eres LeadHunter Locales: conviertes un local comercial cerrado o disponible en un trato. Trabajas dentro de un dashboard. El usuario marca propiedades en un mapa satelital o sube fotos y capturas (de Google Earth, Street View o su teléfono), y tú averiguas qué es cada propiedad, quién es el dueño o quién la administra, cómo se negocia y cómo llegar a esa persona.

DÓNDE TRABAJAS
${P.lugar}. Hay más de un lugar llamado Santo Domingo, así que todas tus búsquedas incluyen la comuna o ciudad y el país (${P.nombre}), y descartas resultados de otro país.

CONFIGURACIÓN DEL USUARIO
${bloqueConfig(cfg)}

QUÉ RECIBES
- Por cada MARCA del mapa: coordenadas exactas, la dirección aproximada de OpenStreetMap y, si se pudieron generar, dos capturas satelitales (detalle y contexto con nombres de calles) con la marca numerada al centro. Las coordenadas son el dato de ubicación más confiable; la dirección de OpenStreetMap puede estar corrida.
- FOTOS que sube el usuario: fachadas, letreros, capturas de Google Earth o Street View. Si una foto trae coordenadas GPS, vienen indicadas.
- Notas del usuario, objetivo y modo.

MODOS
EXPEDIENTE: una propiedad; ficha completa y plan.
BARRIDO: varias marcas o fotos; primero un resumen ordenado por puntaje y después el expediente completo de las 3 mejores.
SEGUIMIENTO: el usuario vuelve sobre una propiedad ya analizada con una respuesta o una pregunta; respondes eso, redactas lo que pida y propones el siguiente paso.

CÓMO TRABAJAS UNA PROPIEDAD
1. Ubicar. Confirma dirección, sector y comuna cruzando las coordenadas con lo que se ve (calles, rótulos, negocios vecinos, forma de la manzana) y con búsquedas. Da la confianza: ALTA, MEDIA o BAJA. Si es BAJA, dilo, explica qué falta y no armes el resto sobre una ubicación dudosa.
2. Leer la propiedad. Lo observable: cortinas o puertas cerradas, letreros viejos, deterioro, vegetación, carteles de arriendo o venta con teléfono, nombre del negocio anterior. Busca el negocio que operaba ahí (fichas de Google Maps aunque digan "cerrado permanentemente", redes sociales) y anuncios de esa dirección. Separa HECHO de SUPOSICIÓN: una foto nunca prueba que algo esté abandonado en sentido legal. Estima tipo de local y metraje, marcados como estimados.
3. Hipótesis de por qué está cerrado o disponible: dueño que vive lejos, sucesión sin resolver, litigio o embargo, dueño esperando mejor precio, banco, propiedad fiscal, necesita mucha inversión, o el arrendatario se fue y nadie lo promociona. Cada una cambia la estrategia.
4. Encontrar al dueño o a quien administra, siguiendo la ruta de fuentes del país (al final), de lo más rápido y barato a lo más formal. El negocio que operaba ahí casi siempre era arrendatario: úsalo como puente hacia el dueño, no lo confundas con él. Las búsquedas web las haces tú; las visitas, llamadas, certificados y trámites los hace el usuario, y tú se los dejas preparados.
5. Puntaje de oportunidad de 0 a 100, con desglose: ubicación y flujo (25), visibilidad (15), encaje con el uso y metraje del usuario (15), estado físico (15), facilidad para llegar al dueño (15), riesgo legal (15). 75 o más: ATACAR YA; de 50 a 74: EN COLA; menos de 50: DESCARTAR.
6. Estrategia. Elige una y di por qué en dos líneas: arriendo simple; arriendo con meses de gracia a cambio de que el usuario pague la adecuación (el gancho más fuerte con un local deteriorado); arriendo con opción a compra; compra directa; compra a herederos solo con la sucesión resuelta o con abogado; arriendo largo con permiso escrito para subarrendar. Ajusta el ángulo a la hipótesis: al dueño que vive lejos, "te quito el problema"; a los herederos, una misma propuesta para todos y sin presionar a nadie; al que espera mejor precio, ingreso seguro ya con cláusula de salida; al local deteriorado, inversión del usuario a cambio de meses de gracia.
   Precio de referencia: comparables de la misma zona con fuente, fecha, precio y metraje. Si no hay al menos 3, dilo y no inventes un precio.
7. Setup listo para copiar, solo lo que aplica al caso: WhatsApp de primer contacto (4 líneas), guion de llamada de 30 segundos con respuestas a "¿de dónde sacó mi número?", "no está disponible" y "¿cuánto ofrece?", nota para dejar con un vecino o encargado, mensaje para un familiar o intermediario, carta de intención (no vinculante; el contrato lo revisa un abogado), documentos que se piden en este país, checklist de visita y preguntas de negociación (renta y reajuste, plazo, garantía, meses de gracia, quién paga mejoras y si quedan, mantenimiento, subarriendo, opción a compra).

CÓMO ESCRIBES LOS MENSAJES
Según el rol del usuario: si busca para sí, escribes como interesado directo; si es corredor, como corredor que capta la propiedad. En ambos casos dices quién escribe y por qué, y no afirmas nada que el usuario no te haya dado como hecho: nada de "tengo un cliente listo" ni urgencias inventadas. Máximo 3 intentos por canal sin respuesta; si alguien pide no ser contactado, se respeta.

REGLAS
- No inventas dueños, teléfonos, roles de avalúo, inscripciones, precios, metrajes, fuentes ni enlaces. Lo que no encontraste se escribe "no encontrado". Cada dato del dueño va etiquetado CONFIRMADO (con fuente), PROBABLE (con razón) o SUPOSICIÓN.
- Solo fuentes públicas y legítimas: nada de bases filtradas o compradas, pretextos ni suplantación (nunca te haces pasar por abogado, banco, autoridad, empresa de servicios o familiar). Datos de contacto: los que publican el negocio, el anuncio o la administración; no buscas celulares personales ni domicilios particulares.
- Nadie entra a la propiedad sin autorización del dueño; no se ocupa ni se interviene, y no sugieres vías para apropiarse de un inmueble ajeno.
- Trato cuidadoso con personas mayores, en duelo o en conflicto familiar.
- No das asesoría legal, tributaria ni de inversión personalizada; para eso, abogado, notario, corredor o contador.
- Español claro y directo, sin relleno.

FORMATO DE SALIDA
Texto plano sin markdown (sin asteriscos ni #). En EXPEDIENTE, estas secciones con el título en mayúsculas en su propia línea:
1. UBICACIÓN
2. OBSERVACIONES
3. HIPÓTESIS
4. DUEÑO O ADMINISTRADOR
5. PUNTAJE
6. ESTRATEGIA
7. SETUP
8. PLAN DE EJECUCIÓN (acciones numeradas; marca cuáles hace el usuario)
9. SIGUIENTE ACCIÓN (una sola, para hoy)
En BARRIDO, antes de los expedientes, la sección 0. RESUMEN con una línea por propiedad.
Al final, una línea FICHA por propiedad analizada, exactamente con este formato (el dashboard la usa para la cartera):
FICHA #n | puntaje: NN | prioridad: ATACAR YA, EN COLA o DESCARTAR | dirección: ... | dueño: nombre o no encontrado | estatus: confirmado, probable o desconocido | contacto: dato y canal o no encontrado | siguiente paso: ...
En SEGUIMIENTO no hace falta la estructura completa; agrega líneas FICHA solo si cambió algún dato.

RUTA DE FUENTES Y DOCUMENTOS (${P.nombre})
${RUTA[pais] || RUTA.CL}`;
}

/* ---------- consulta ---------- */

export function textoMarca(m) {
  const dir = m.dir ? `dirección aproximada (OpenStreetMap): ${m.dir}` : 'sin dirección de OpenStreetMap';
  return `MARCA #${m.n} — coordenadas ${m.lat.toFixed(6)}, ${m.lon.toFixed(6)} — ${dir}${m.imgs && m.imgs.length ? '. Capturas a continuación (detalle y contexto).' : '. Sin captura satelital.'}`;
}

export function textoFoto(f) {
  const gps = f.gps ? ` — GPS de la foto: ${f.gps.lat.toFixed(6)}, ${f.gps.lon.toFixed(6)}` : '';
  return `FOTO #${f.n} subida por el usuario${f.nombre ? ` (${f.nombre})` : ''}${gps}`;
}

export function textoPedido({ modo, objetivo, notas, pais = 'CL', marcas = [], fotos = [] }) {
  const P = PAISES[pais] || PAISES.CL;
  const total = marcas.length + fotos.length;
  const m = modo || (total > 1 ? 'BARRIDO' : 'EXPEDIENTE');
  return [
    `MODO: ${m}`,
    `PAÍS: ${P.nombre}`,
    `OBJETIVO: ${v(objetivo, 'cualquiera')}`,
    `PROPIEDADES: ${marcas.length} marca(s) del mapa y ${fotos.length} foto(s).`,
    `NOTAS DEL USUARIO: ${v(notas, 'ninguna')}`,
    '',
    'Analiza y entrega en el formato acordado, cerrando con las líneas FICHA.',
    total > 1 ? `Numera las FICHA así: primero las marcas en su orden (#1 a #${marcas.length || 0}) y después las fotos (#${marcas.length + 1} en adelante). Si una foto muestra la misma propiedad que una marca, usa una sola ficha con el número de la marca.` : 'Usa FICHA #1.',
  ].join('\n');
}

const img = (b64, mt) => ({ type: 'image', source: { type: 'base64', media_type: mt || 'image/jpeg', data: b64 } });

/* contenido del primer mensaje: por cada marca y foto, su texto y luego sus imágenes; al final el pedido */
export function buildUserContent(p) {
  const out = [];
  for (const m of p.marcas || []) {
    out.push({ type: 'text', text: textoMarca(m) });
    for (const i of m.imgs || []) out.push(img(i.b64, i.mt));
  }
  for (const f of p.fotos || []) {
    out.push({ type: 'text', text: textoFoto(f) });
    if (f.b64) out.push(img(f.b64, f.mt));
  }
  out.push({ type: 'text', text: textoPedido(p) });
  return out;
}

/* versión solo texto del primer mensaje, para retomar una propiedad sin reenviar imágenes */
export function resumenTexto(p) {
  const l = (p.marcas || []).map(textoMarca).concat((p.fotos || []).map(textoFoto));
  return l.join('\n') + '\n(Las imágenes ya se analizaron en el primer mensaje.)\n\n' + textoPedido(p);
}

export function buildRequest({ model, effort, pais, cfg, messages, fallbacks = true, maxSearch = 12, maxFetch = 8 }) {
  const P = PAISES[pais] || PAISES.CL;
  const body = {
    model,
    max_tokens: 32000,
    stream: true,
    cache_control: { type: 'ephemeral' },
    system: buildSystem({ pais, cfg }),
    messages,
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: maxSearch, user_location: P.ubic },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: maxFetch },
    ],
    output_config: { effort: effort || 'medium' },
  };
  const headers = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (fallbacks) { body.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }
  return { body, headers };
}

/* ---------- lectura del stream (SSE) ---------- */

export function parseSSE(buffer) {
  // devuelve { eventos, resto }: cada evento es el JSON de su línea data:
  const eventos = [];
  const partes = buffer.split(/\r?\n\r?\n/);
  const resto = partes.pop();
  for (const p of partes) {
    const data = p.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
    if (!data) continue;
    try { eventos.push(JSON.parse(data)); } catch (_) { /* evento incompleto o ajeno */ }
  }
  return { eventos, resto };
}

/* arma el mensaje completo a partir de los eventos, igual que lo devolvería la API sin stream */
export class Acumulador {
  constructor() { this.content = []; this.stopReason = null; this.usage = {}; this.error = null; this.model = null; this._json = {}; }
  push(e, on = {}) {
    switch (e.type) {
      case 'message_start':
        this.model = e.message && e.message.model;
        Object.assign(this.usage, (e.message && e.message.usage) || {});
        break;
      case 'content_block_start': {
        const b = JSON.parse(JSON.stringify(e.content_block));
        if (b.type === 'server_tool_use' || b.type === 'tool_use') { this._json[e.index] = ''; }
        if (b.type === 'text' && !b.text) b.text = '';
        this.content[e.index] = b;
        if (on.bloque) on.bloque(b, 'start');
        break;
      }
      case 'content_block_delta': {
        const b = this.content[e.index]; const d = e.delta || {};
        if (!b) break;
        if (d.type === 'text_delta') { b.text = (b.text || '') + d.text; if (on.texto) on.texto(d.text); }
        else if (d.type === 'input_json_delta') { this._json[e.index] = (this._json[e.index] || '') + (d.partial_json || ''); }
        else if (d.type === 'thinking_delta') { b.thinking = (b.thinking || '') + (d.thinking || ''); }
        else if (d.type === 'signature_delta') { b.signature = (b.signature || '') + (d.signature || ''); }
        else if (d.type === 'citations_delta') { (b.citations = b.citations || []).push(d.citation); }
        break;
      }
      case 'content_block_stop': {
        const b = this.content[e.index];
        if (b && e.index in this._json) {
          const raw = this._json[e.index];
          try { b.input = raw ? JSON.parse(raw) : (b.input || {}); } catch (_) { b.input = b.input || {}; }
          delete this._json[e.index];
        }
        if (b && on.bloque) on.bloque(b, 'stop');
        break;
      }
      case 'message_delta':
        if (e.delta && e.delta.stop_reason) this.stopReason = e.delta.stop_reason;
        if (e.delta && e.delta.stop_details) this.stopDetails = e.delta.stop_details;
        Object.assign(this.usage, e.usage || {});
        break;
      case 'error':
        this.error = e.error || { message: 'error en el stream' };
        break;
      default: break;
    }
  }
  get texto() { return this.content.filter(b => b && b.type === 'text').map(b => b.text).join(''); }
  get bloques() { return this.content.filter(Boolean); }
}

/* fuentes: primero las citadas en el texto, después los resultados de búsqueda */
export function fuentes(content) {
  const vistas = new Map();
  const add = (url, titulo, citada) => {
    if (!url || !/^https?:\/\//i.test(url)) return;
    const prev = vistas.get(url);
    if (!prev) vistas.set(url, { url, titulo: titulo || url, citada });
    else if (citada) prev.citada = true;
  };
  for (const b of content || []) {
    if (!b) continue;
    if (b.type === 'text') for (const c of b.citations || []) add(c.url, c.title, true);
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) add(r.url, r.title, false);
    if (b.type === 'web_fetch_tool_result' && b.content && b.content.url) add(b.content.url, b.content.url, false);
  }
  return [...vistas.values()].sort((a, b) => (b.citada ? 1 : 0) - (a.citada ? 1 : 0));
}

export function costoAprox(model, usage = {}) {
  const M = MODELOS[model] || MODELOS['claude-opus-5-5'];
  const inp = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25;
  const cache = usage.cache_read_input_tokens || 0;
  const out = usage.output_tokens || 0;
  const busq = (usage.server_tool_use && usage.server_tool_use.web_search_requests) || 0;
  return (inp * M.inUSD + cache * M.cacheUSD + out * M.outUSD) / 1e6 + busq * 0.01;
}

/* ---------- salida: secciones y fichas ---------- */

const RE_FICHA = /^\s*FICHA\s*#?\s*(\d+)\s*\|(.*)$/i;

function clave(k) {
  return k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();
}

export function parseFichas(texto) {
  const out = [];
  for (const linea of String(texto || '').split(/\r?\n/)) {
    const m = linea.match(RE_FICHA);
    if (!m) continue;
    const f = { n: Number(m[1]), puntaje: null, prioridad: '', direccion: '', dueno: '', estatus: '', contacto: '', siguiente: '' };
    for (const parte of m[2].split('|')) {
      const i = parte.indexOf(':');
      if (i < 0) continue;
      const k = clave(parte.slice(0, i)); const val = parte.slice(i + 1).trim();
      if (k === 'puntaje') { const n = parseInt(val, 10); f.puntaje = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null; }
      else if (k === 'prioridad') f.prioridad = val.toUpperCase();
      else if (k === 'direccion') f.direccion = val;
      else if (k === 'dueno') f.dueno = val;
      else if (k === 'estatus') f.estatus = val.toLowerCase();
      else if (k === 'contacto') f.contacto = val;
      else if (k === 'siguiente paso') f.siguiente = val;
    }
    out.push(f);
  }
  return out;
}

export function sinFichas(texto) {
  return String(texto || '').split(/\r?\n/).filter(l => !RE_FICHA.test(l)).join('\n').replace(/\n{3,}$/,'\n').trimEnd();
}

const RE_SECCION = /^\s*(\d{1,2})\.\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ ,\/]{3,50}?)\s*(\([^)]*\))?\s*:?\s*$/;

export function secciones(texto) {
  const lineas = String(texto || '').split(/\r?\n/);
  const out = []; let cur = null;
  for (const l of lineas) {
    const m = l.match(RE_SECCION);
    if (m) { cur = { titulo: `${m[1]}. ${m[2].trim()}`, cuerpo: [] }; out.push(cur); continue; }
    if (!cur) { cur = { titulo: '', cuerpo: [] }; out.push(cur); }
    cur.cuerpo.push(l);
  }
  return out.map(s => ({ titulo: s.titulo, cuerpo: s.cuerpo.join('\n').trim() })).filter(s => s.titulo || s.cuerpo);
}

export function prioridadDe(puntaje, texto) {
  const t = String(texto || '').toUpperCase();
  if (/ATACAR/.test(t)) return 'ATACAR YA';
  if (/EN COLA/.test(t)) return 'EN COLA';
  if (/DESCARTAR/.test(t)) return 'DESCARTAR';
  if (puntaje == null) return '';
  return puntaje >= 75 ? 'ATACAR YA' : puntaje >= 50 ? 'EN COLA' : 'DESCARTAR';
}

/* ---------- CSV ---------- */

export function parseCSV(text) {
  const rows = []; let row = []; let campo = ''; let q = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { campo += '"'; i++; } else q = false; }
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(campo); campo = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else campo += c;
  }
  if (campo !== '' || row.length) { row.push(campo); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

export function toCSV(filas, columnas) {
  const esc = x => { const t = String(x == null ? '' : x); return /[",\n\r;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  return '﻿' + [columnas.map(c => esc(c.titulo)).join(','), ...filas.map(f => columnas.map(c => esc(c.valor(f))).join(','))].join('\r\n');
}

/* filas exportadas por la app LeadHunter (Puntaje, Veredicto, Prospecto, Contacto, Fuente, Mensaje, ...) */
export function leadsDesdeLeadHunter(rows) {
  if (!rows.length) return [];
  const cab = rows[0].map(clave);
  const col = n => cab.indexOf(clave(n));
  const get = (r, n) => { const i = col(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  if (col('Prospecto') < 0) return [];
  return rows.slice(1).filter(r => get(r, 'Prospecto')).map(r => {
    const p = parseInt(get(r, 'Puntaje'), 10);
    const puntaje = Number.isFinite(p) ? p : null;
    const contacto = [get(r, 'Contacto'), get(r, 'WhatsApp'), get(r, 'Email')].filter(Boolean).join(' · ');
    return {
      titulo: get(r, 'Prospecto'), puntaje, prioridad: prioridadDe(puntaje, ''),
      dueno: get(r, 'Para quién'), estatus: 'probable', contacto, fuente: get(r, 'Fuente'),
      siguiente: 'Contactar con el mensaje importado', origen: 'LeadHunter CSV',
      analisis: [
        get(r, 'Datos') && 'DATOS\n' + get(r, 'Datos'),
        get(r, 'Señal') && 'SEÑAL\n' + get(r, 'Señal'),
        get(r, 'Por qué encaja') && 'POR QUÉ ENCAJA\n' + get(r, 'Por qué encaja'),
        get(r, 'Mensaje') && 'MENSAJE\n' + get(r, 'Mensaje'),
        get(r, 'Objeción') && 'OBJECIÓN\n' + get(r, 'Objeción'),
        get(r, 'Seguimiento (día 3)') && 'SEGUIMIENTO\n' + get(r, 'Seguimiento (día 3)'),
        get(r, 'Fuente') && 'FUENTE\n' + get(r, 'Fuente'),
      ].filter(Boolean).join('\n\n'),
    };
  });
}

/* ---------- GPS de fotos JPEG (EXIF) ---------- */

export function gpsDeJpeg(buf) {
  const dv = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer);
  if (dv.byteLength < 4 || dv.getUint16(0) !== 0xFFD8) return null;
  let off = 2;
  while (off + 4 <= dv.byteLength) {
    const marker = dv.getUint16(off); const len = dv.getUint16(off + 2);
    if ((marker & 0xFF00) !== 0xFF00) return null;
    if (marker === 0xFFE1 && off + 10 <= dv.byteLength &&
        dv.getUint32(off + 4) === 0x45786966 && dv.getUint16(off + 8) === 0) {
      return gpsDeTiff(dv, off + 10);
    }
    if (marker === 0xFFDA) return null;
    off += 2 + len;
  }
  return null;
}

function gpsDeTiff(dv, t) {
  try {
    const le = dv.getUint16(t) === 0x4949;
    const u16 = o => dv.getUint16(t + o, le); const u32 = o => dv.getUint32(t + o, le);
    if (u16(2) !== 42) return null;
    const ifd0 = u32(4); const n0 = u16(ifd0);
    let gpsOff = null;
    for (let i = 0; i < n0; i++) { const e = ifd0 + 2 + i * 12; if (u16(e) === 0x8825) gpsOff = u32(e + 8); }
    if (gpsOff == null) return null;
    const n = u16(gpsOff); const tags = {};
    for (let i = 0; i < n; i++) {
      const e = gpsOff + 2 + i * 12; const tag = u16(e); const tipo = u16(e + 2); const cnt = u32(e + 4);
      if (tipo === 2) tags[tag] = String.fromCharCode(dv.getUint8(t + e + 8));
      else if (tipo === 5 && cnt === 3) {
        const p = u32(e + 8); const r = k => { const a = u32(p + k * 8), b = u32(p + k * 8 + 4); return b ? a / b : 0; };
        tags[tag] = r(0) + r(1) / 60 + r(2) / 3600;
      }
    }
    if (typeof tags[2] !== 'number' || typeof tags[4] !== 'number') return null;
    const lat = tags[2] * (tags[1] === 'S' ? -1 : 1); const lon = tags[4] * (tags[3] === 'W' ? -1 : 1);
    if (!lat && !lon) return null;
    return { lat, lon };
  } catch (_) { return null; }
}

/* ---------- teselas (Web Mercator, 256 px) ---------- */

export function aPixel(lat, lon, z) {
  const n = 256 * Math.pow(2, z);
  const s = Math.sin(lat * Math.PI / 180);
  return { x: (lon + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

export function teselasPara(lat, lon, z, ancho, alto) {
  const c = aPixel(lat, lon, z);
  const x0 = c.x - ancho / 2, y0 = c.y - alto / 2;
  const out = [];
  for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + ancho - 1) / 256); tx++) {
    for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + alto - 1) / 256); ty++) {
      out.push({ x: tx, y: ty, z, dx: Math.round(tx * 256 - x0), dy: Math.round(ty * 256 - y0) });
    }
  }
  return out;
}

export function enlaces(lat, lon) {
  const ll = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  return {
    maps: `https://www.google.com/maps/search/?api=1&query=${ll}`,
    streetview: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll}`,
    earth: `https://earth.google.com/web/@${lat.toFixed(6)},${lon.toFixed(6)},60a,300d,35y,0h,45t,0r`,
  };
}

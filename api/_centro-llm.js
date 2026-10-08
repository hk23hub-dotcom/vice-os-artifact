// El Centro — llamadas a Claude por el Vercel AI Gateway (OIDC del despliegue, sin llave aparte).
// Modelos del catálogo vivo del gateway: acompañantes en Haiku 4.5; cazadores, hacedores y el jurado
// en Sonnet 5 con el razonamiento APAGADO (si queda encendido, el costo por uso casi se duplica).
import { generateText } from 'ai';

export const MODELOS = { rapido: 'anthropic/claude-haiku-4.5', normal: 'anthropic/claude-sonnet-5' };

let reemplazo = null; // solo para pruebas: setLLM(fn) evita llamar al gateway
export function setLLM(fn) { reemplazo = fn; }

export async function llm({ nivel, system, messages, prompt, maxOutputTokens, timeoutMs }) {
  if (reemplazo) return reemplazo({ nivel, system, messages, prompt, maxOutputTokens });
  const model = MODELOS[nivel] || MODELOS.normal;
  // con tope de tiempo: si el modelo se cuelga, el uso se devuelve antes de que Vercel corte la función
  const opts = { model, maxOutputTokens: maxOutputTokens || 1200, maxRetries: 1, abortSignal: AbortSignal.timeout(timeoutMs || 40000) };
  if (system) opts.system = system;
  if (messages) opts.messages = messages; else opts.prompt = prompt;
  if (model === MODELOS.normal) opts.providerOptions = { anthropic: { thinking: { type: 'disabled' } } };
  const r = await generateText(opts);
  return { texto: r.text || '' };
}

/* pide JSON y lo lee con tolerancia: el texto entero, un bloque ``` o del primer { al último } */
export async function llmJSON({ nivel, prompt, maxOutputTokens }) {
  const { texto } = await llm({ nivel, prompt, maxOutputTokens: maxOutputTokens || 800 });
  const t = String(texto || '').trim();
  const intentos = [t];
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) intentos.push(f[1]);
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) intentos.push(t.slice(a, b + 1));
  for (const s of intentos) { try { return JSON.parse(s); } catch (_) { /* siguiente */ } }
  const e = new Error('respuesta sin JSON'); e.code = 'invalid_json'; throw e;
}

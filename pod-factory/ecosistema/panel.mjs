#!/usr/bin/env node
/**
 * PANEL · POD FACTORY
 * El mundo de la fábrica, pero operable: cada cosa que hay que arreglar
 * tiene su botón y corre de verdad, acá en tu máquina.
 *
 *   node ecosistema/panel.mjs      → http://localhost:4173
 *
 * Solo escucha en 127.0.0.1 y solo ejecuta acciones de una lista cerrada.
 * Nada que salga hacia afuera corre sin que lo confirmes dos veces.
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { estado as credEstado, guardar as guardarCred } from './credenciales.mjs';
import { readFileSync as _rf, writeFileSync as _wf } from 'node:fs';

const ECO  = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(ECO);
const PORT = Number(process.env.PANEL_PORT || 4173);

// Lista cerrada. No se ejecuta nada que no esté acá.
const ACCIONES = {
  turno:        { t:'Correr el turno',        d:'Preflight + parte + mundo. No toca la tienda.',        cmd:['bash', ['ecosistema/correr.sh']] },
  preflight:    { t:'Revisar la tienda',      d:'Pregunta a Shopify si está abierta y qué despacha.',   cmd:['node', ['preflight.mjs']] },
  parte:        { t:'Regenerar el parte',     d:'Relee todo y reescribe el parte del día.',             cmd:['node', ['ecosistema/parte.mjs']] },
  intake:       { t:'Revisar el inbox',       d:'Informe de lo que hay para ingresar. No ingresa.',     cmd:['node', ['intake.mjs']] },
  olaPlan:      { t:'Simular la ola',         d:'Muestra qué publicaría hoy. No toca red.',             cmd:['node', ['daily.mjs']] },
  reprecioPlan: { t:'Simular re-precio',      d:'Qué precios quedarían con el markup vigente.',         cmd:['node', ['ecosistema/reprecio.mjs']] },
  colaPlan:     { t:'Armar cola de venta',    d:'Escribe la cola. Nunca envía.',                        cmd:['node', ['sales/daily.mjs']] },
  trafico:      { t:'Escribir difusión',      d:'Piezas para Pinterest, TikTok, IG y X con URL real. No publica.', cmd:['node', ['ecosistema/trafico.mjs']] },
  centro:       { t:'Difusión de El Centro',  d:'14 piezas desde los 133 agentes del Centro. No publica.', cmd:['node', ['ecosistema/centro/difusion.mjs','--n','14']] },
  ideas:        { t:'Pensar mejoras',         d:'El laboratorio relee la fábrica y propone qué cambiar.', cmd:['node', ['ecosistema/ideas.mjs']] },

  // estas sí tocan la tienda: piden confirmación explícita
  olaLive:      { t:'Publicar la ola',        d:'Crea y publica productos de verdad en la tienda.',     cmd:['node', ['daily.mjs','--live']],               peligro:true },
  reprecioLive: { t:'Aplicar el re-precio',   d:'Cambia los precios de los productos ya publicados.',   cmd:['node', ['ecosistema/reprecio.mjs','--live']], peligro:true },
};

const correr = (cmd, args) => new Promise(res => {
  execFile(cmd, args, { cwd: ROOT, timeout: 15 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 },
    (err, stdout, stderr) => res({ ok: !err, salida: (stdout || '') + (stderr || ''), error: err ? err.message : null }));
});

const IDEAS_FILE = join(ECO, 'ideas', 'ideas.json');
const leerIdeas = () => { try { return JSON.parse(_rf(IDEAS_FILE,'utf8')); } catch { return {}; } };

const LAB = `
<section class="consola lab">
  <div class="chd">
    <h2>Laboratorio</h2>
    <p>Ideas que se pueden implementar. Cada una nombra qué archivo o comando toca — sin eso, Factibilidad la descarta.</p>
  </div>
  <div class="ideas" id="ideas"></div>
</section>
<style>
  .ideas{padding:14px 16px; display:flex; flex-direction:column; gap:9px}
  .idea{border:1px solid var(--line); padding:11px 12px; display:flex; flex-direction:column; gap:5px}
  .idea.aprobada{border-color:var(--ok)}
  .idea.descartada{opacity:.5}
  .idea .top{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
  .idea .t{font-weight:600; font-size:13.5px}
  .idea .tag{font-family:var(--mono); font-size:9.5px; letter-spacing:.09em; text-transform:uppercase; border:1px solid var(--line-strong); padding:2px 6px; color:var(--ink-muted)}
  .idea .tag.alto{border-color:var(--accent); color:var(--accent)}
  .idea .tag.est{border-color:var(--ok); color:var(--ok)}
  .idea .porque{font-size:12px; color:var(--ink-2); line-height:1.45}
  .idea .toca{font-family:var(--mono); font-size:11px; color:var(--ink-muted); word-break:break-word}
  .idea .bts{display:flex; gap:6px; margin-top:3px}
  .idea .bts button{border:1px solid var(--line-strong); background:var(--surface-2); color:var(--ink); padding:5px 11px; font-size:12.5px}
  .idea .bts button.si{border-color:var(--ok); color:var(--ok)}
  .idea .bts button.no{border-color:var(--alarm); color:var(--alarm)}
</style>
<script>
(function(){
  var I = __IDEAS__, cont = document.getElementById('ideas');
  var orden = { aprobada:0, factible:1, propuesta:2, implementada:3, resuelta:4, descartada:5 };
  I.sort(function(a,b){
    var d = (orden[a.estado]??9) - (orden[b.estado]??9); if(d) return d;
    return (b.impacto==='alto') - (a.impacto==='alto');
  });
  I.forEach(function(x){
    var d = document.createElement('div');
    d.className = 'idea ' + x.estado;
    d.innerHTML =
      '<div class="top"><span class="t">' + x.t + '</span>' +
      '<span class="tag ' + (x.impacto==='alto'?'alto':'') + '">impacto ' + x.impacto + '</span>' +
      '<span class="tag">esfuerzo ' + x.esfuerzo + '</span>' +
      '<span class="tag est">' + x.estado + '</span></div>' +
      '<div class="porque">' + x.porque + '</div>' +
      '<div class="toca">toca: ' + x.toca + '</div>' +
      '<div class="bts"></div>';
    var bts = d.querySelector('.bts');
    [['aprobada','Aprobar','si'],['implementada','Marcar hecha',''],['descartada','Descartar','no']].forEach(function(o){
      if(x.estado === o[0]) return;
      var b = document.createElement('button');
      b.className = o[2]; b.textContent = o[1];
      b.addEventListener('click', function(){
        fetch('/api/idea', { method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ id:x.id, estado:o[0] }) })
          .then(function(r){ return r.json(); })
          .then(function(){ location.reload(); });
      });
      bts.appendChild(b);
    });
    cont.appendChild(d);
  });
})();
</script>`;

const LLAVES = `
<section class="consola llaves">
  <div class="chd">
    <h2>Llaves</h2>
    <p>Lo que el sistema necesita para trabajar. Lo que pegues acá se guarda en tu disco con permisos 600 y nunca se muestra de vuelta.</p>
  </div>
  <div class="creds" id="creds"></div>
</section>
<style>
  .creds{padding:14px 16px; display:flex; flex-direction:column; gap:10px}
  .cred{border:1px solid var(--line); padding:11px 12px; display:flex; flex-direction:column; gap:6px}
  .cred.falta{border-color:var(--alarm)}
  .cred .top{display:flex; align-items:center; gap:8px; flex-wrap:wrap}
  .cred .nm{font-weight:600; font-size:13.5px}
  .cred .badge{font-family:var(--mono); font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; padding:2px 6px; border:1px solid var(--line-strong); color:var(--ink-muted)}
  .cred .badge.ok{border-color:var(--ok); color:var(--ok)}
  .cred .badge.no{border-color:var(--alarm); color:var(--alarm)}
  .cred .porque{font-size:12px; color:var(--ink-2); line-height:1.45}
  .cred .meta{font-family:var(--mono); font-size:10.5px; color:var(--ink-muted)}
  .cred .meta a{color:var(--accent)}
  .cred form{display:flex; gap:6px; flex-wrap:wrap}
  .cred input{flex:1; min-width:180px; font-family:var(--mono); font-size:12px; padding:7px 9px;
    border:1px solid var(--line-strong); background:var(--surface-2); color:var(--ink)}
  .cred button{border:1px solid var(--ink); background:var(--ink); color:var(--ground); padding:7px 14px; font-size:13px; font-weight:500}
  .cred .msg{font-size:12px; color:var(--ok)}
  .cred .msg.mal{color:var(--alarm)}
</style>
<script>
(function(){
  var C = __CREDS__, cont = document.getElementById('creds');
  function pinta(){
    cont.innerHTML = '';
    C.forEach(function(c){
      var d = document.createElement('div');
      d.className = 'cred' + (c.presente ? '' : (c.requerida ? ' falta' : ''));
      d.innerHTML =
        '<div class="top"><span class="nm">' + c.label + '</span>' +
        '<span class="badge ' + (c.presente ? 'ok' : 'no') + '">' +
          (c.presente ? 'guardada · ' + c.largo + ' chars' : (c.requerida ? 'falta' : 'opcional')) + '</span></div>' +
        '<div class="porque">' + c.porque + '</div>' +
        '<div class="meta">vive en ' + c.archivo + ' · sacala en <a href="' + c.donde + '" target="_blank" rel="noopener">' + c.donde + '</a></div>' +
        '<form><input type="password" placeholder="' + (c.presente ? 'pegá una nueva para reemplazarla' : 'pegá la llave acá') + '" autocomplete="off"><button type="submit">Guardar</button><span class="msg"></span></form>';
      var f = d.querySelector('form'), i = d.querySelector('input'), m = d.querySelector('.msg');
      f.addEventListener('submit', function(ev){
        ev.preventDefault();
        if(!i.value.trim()){ m.className='msg mal'; m.textContent='vacío'; return; }
        m.className='msg'; m.textContent='guardando…';
        fetch('/api/credencial', { method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ id: c.id, valor: i.value }) })
          .then(function(r){ return r.json(); })
          .then(function(r){
            i.value = '';
            if(r.ok){ m.className='msg'; m.textContent='✓ guardada (' + r.largo + ' chars)'; setTimeout(function(){ location.reload(); }, 1200); }
            else { m.className='msg mal'; m.textContent='✗ ' + r.error; }
          })
          .catch(function(e){ m.className='msg mal'; m.textContent='✗ ' + e.message; });
      });
      cont.appendChild(d);
    });
  }
  pinta();
})();
</script>`;

const CONSOLA = `
<section class="consola">
  <div class="chd">
    <h2>Consola</h2>
    <p>Cada botón corre de verdad, en tu máquina. Los rojos tocan la tienda y piden confirmación.</p>
  </div>
  <div class="acts" id="acts"></div>
  <pre class="salida" id="salida">Listo. Elegí una acción.</pre>
</section>
<style>
  .consola{margin-top:22px; background:var(--surface); border:1px solid var(--line-strong); box-shadow:var(--shadow)}
  .chd{padding:14px 16px; border-bottom:1px solid var(--line)}
  .chd h2{font-size:17px}
  .chd p{font-size:13px; color:var(--ink-muted); margin-top:3px}
  .acts{display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:8px; padding:14px 16px}
  .act{text-align:left; border:1px solid var(--line-strong); background:var(--surface-2); padding:10px 11px; cursor:pointer; display:flex; flex-direction:column; gap:3px}
  .act:hover:not(:disabled){background:var(--surface-3)}
  .act:disabled{opacity:.5; cursor:progress}
  .act .n{font-weight:600; font-size:13.5px}
  .act .d{font-size:11.5px; color:var(--ink-muted); line-height:1.35}
  .act.peligro{border-color:var(--alarm)}
  .act.peligro .n{color:var(--alarm)}
  .salida{margin:0; padding:13px 16px; border-top:1px solid var(--line); background:var(--surface-2);
    font-family:var(--mono); font-size:11.5px; line-height:1.55; white-space:pre-wrap; max-height:420px; overflow:auto; color:var(--ink)}
</style>
<script>
(function(){
  var A = __ACCIONES__;
  var acts = document.getElementById('acts'), out = document.getElementById('salida');
  Object.keys(A).forEach(function(id){
    var a = A[id], b = document.createElement('button');
    b.className = 'act' + (a.peligro ? ' peligro' : '');
    b.innerHTML = '<span class="n">' + a.t + '</span><span class="d">' + a.d + '</span>';
    b.addEventListener('click', function(){
      if(a.peligro && !confirm(a.t + '\\n\\n' + a.d + '\\n\\nEsto modifica la tienda de verdad. ¿Seguro?')) return;
      var todos = acts.querySelectorAll('button');
      todos.forEach(function(x){ x.disabled = true; });
      out.textContent = '▸ ' + a.t + '…\\n';
      fetch('/api/accion', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ id: id }) })
        .then(function(r){ return r.json(); })
        .then(function(r){
          out.textContent = r.salida || '(sin salida)';
          if(r.error) out.textContent += '\\n\\n✗ ' + r.error;
          out.textContent += '\\n\\n— recargando el mundo con el estado nuevo —';
          setTimeout(function(){ location.reload(); }, 1400);
        })
        .catch(function(e){ out.textContent = '✗ ' + e.message; todos.forEach(function(x){ x.disabled = false; }); });
    });
    acts.appendChild(b);
  });
})();
</script>`;

const srv = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/accion') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on('end', async () => {
      let id; try { id = JSON.parse(body).id; } catch { id = null; }
      const a = ACCIONES[id];
      if (!a) { res.writeHead(400, {'content-type':'application/json'}); return res.end(JSON.stringify({ ok:false, error:'acción desconocida' })); }
      const r = await correr(a.cmd[0], a.cmd[1]);
      // después de cualquier acción, dejar el parte y el mundo al día
      await correr('bash', ['ecosistema/correr.sh']);
      res.writeHead(200, {'content-type':'application/json; charset=utf-8'});
      res.end(JSON.stringify(r));
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/idea') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => {
      let id, estado; try { ({ id, estado } = JSON.parse(body)); } catch { id = null; }
      const VALIDOS = ['factible','aprobada','implementada','descartada'];
      const ideas = leerIdeas();
      if (!id || !ideas[id] || !VALIDOS.includes(estado)) {
        res.writeHead(400, {'content-type':'application/json'});
        return res.end(JSON.stringify({ ok:false, error:'idea o estado inválido' }));
      }
      ideas[id].estado = estado;
      ideas[id].historia = [...(ideas[id].historia || []), `${new Date().toISOString().slice(0,10)} · ${estado} desde el panel`].slice(-12);
      _wf(IDEAS_FILE, JSON.stringify(ideas, null, 2) + '\n');
      res.writeHead(200, {'content-type':'application/json'});
      res.end(JSON.stringify({ ok:true, id, estado }));
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/credencial') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let id, valor; try { ({ id, valor } = JSON.parse(body)); } catch { id = null; }
      const r = guardarCred(id, valor);   // nunca devuelve el valor
      res.writeHead(r.ok ? 200 : 400, {'content-type':'application/json; charset=utf-8'});
      res.end(JSON.stringify(r));
    });
    return;
  }

  const f = join(ECO, 'mundo', 'fabrica.html');
  if (!existsSync(f)) { res.writeHead(503); return res.end('Falta el mundo. Corré: ./ecosistema/correr.sh'); }
  const publico = {};
  for (const [k, v] of Object.entries(ACCIONES)) publico[k] = { t:v.t, d:v.d, peligro: !!v.peligro };
  const html = readFileSync(f, 'utf8')
    + CONSOLA.replace('__ACCIONES__', JSON.stringify(publico))
    + LAB.replace('__IDEAS__', JSON.stringify(Object.values(leerIdeas())))
    + LLAVES.replace('__CREDS__', JSON.stringify(Object.values(credEstado())));
  res.writeHead(200, {'content-type':'text/html; charset=utf-8'});
  res.end(html);
});

srv.listen(PORT, '127.0.0.1', () => {
  console.log(`\nPANEL · POD FACTORY  →  http://localhost:${PORT}`);
  const cr = Object.values(credEstado());
  console.log(`  ${Object.keys(ACCIONES).length} acciones · ${Object.values(ACCIONES).filter(a=>a.peligro).length} tocan la tienda`);
  console.log(`  llaves: ${cr.filter(c=>c.presente).length}/${cr.length} guardadas`);
  console.log('  ctrl+C para cerrar\n');
});

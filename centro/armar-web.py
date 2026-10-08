#!/usr/bin/env python3
"""Arma centro.html (la versión pública de El Centro en hk23universe.vercel.app/centro)
desde la página fuente ~/el-centro/centro-src.html.

Se reutilizan tal cual el mapa de calor, las firmas, los sellos, la puerta de las apps, la forja
y la tarjeta. Se reemplaza el motor: los agentes corren en /api/centro-correr (IA de El Centro con
cuota por persona), la prueba de entrada corre en /api/centro-postular y el pase se activa en
/api/centro-pase. La sección del dueño sale de la página pública (queda en /centro-admin).

    python3 centro/armar-web.py
"""
import os, re

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.expanduser("~/el-centro/centro-src.html")
FONTS = os.path.expanduser("~/el-centro/fonts.css")
DST = os.path.join(AQUI, "..", "centro.html")

s = open(SRC, encoding="utf-8").read()


def cut(a, b, keep_b=True):
    """quita desde el marcador a hasta el marcador b (b se conserva)"""
    global s
    i = s.index(a); j = s.index(b, i)
    s = s[:i] + (s[j:] if keep_b else s[j + len(b):])


def rep(old, new):
    global s
    assert s.count(old) == 1, ("no único", old[:80])
    s = s.replace(old, new)


# ---------------- HTML ----------------
rep('<title>El Centro</title>', '<title>El Centro · HK23</title>\n<meta name="description" content="El Centro: un mercado de agentes de IA vivos. Úsalos, o postula el tuyo gratis.">')

# secciones del dueño: salen de la página pública
cut('  <section class="blk" id="casaSec" hidden>', '</main>')
s = s.replace('\n</main>', '\n</main>', 1)

# menú de bloques (Agentes activo; los demás vienen)
rep('    <div class="eyebrow">HK23 · Centro de agentes</div>',
    '''    <nav class="bloques" id="bloques" aria-label="Bloques de El Centro">
      <span class="bq on" aria-current="page">Agentes</span>
      <span class="bq off">Sistemas <i>pronto</i></span>
      <span class="bq off">Oficinas <i>pronto</i></span>
      <span class="bq off">Agencias autónomas <i>pronto</i></span>
    </nav>
    <div class="eyebrow">HK23 · Centro de agentes</div>''')

# plan de la persona, al lado del motor
rep('''    <span class="pill" id="pill"><i></i><span id="pillT">Conectando motor</span></span>''',
    '''    <div class="pills"><span class="pill" id="pill"><i></i><span id="pillT">Conectando motor</span></span>
      <button class="pill plan" id="plan" type="button">5 usos gratis para probar</button></div>''')

# botón del pase en la barra
rep('''    <a class="cta" href="#postular">Postular un agente</a>''',
    '''    <button class="fb paseb" id="paseBtn" type="button">Pase El Centro</button>
    <a class="cta" href="#postular">Postular un agente</a>''')

# textos que hablaban de la cuenta de Claude del visitante
rep('Postular no cuesta plata. Tu agente rinde una prueba de entrada: dura cerca de un minuto y corre con tu cuenta de Claude. Si pasa, lo reviso y, si queda, el bloque lleva tu firma. Una postulación a la vez: enviar otra reemplaza la anterior.',
    'Postular no cuesta plata. Tu agente rinde una prueba de entrada que dura cerca de un minuto. Si pasa, lo reviso y, si queda, su bloque lleva tu firma, y tú usas El Centro gratis mientras tu agente siga vivo.')
rep('<span class="r-hint" id="rHint">Corre con tu cuenta de Claude. La primera vez te pide permiso.</span>',
    '<span class="r-hint" id="rHint">Cada respuesta usa uno de tus usos.</span>')

# ventana del pase
rep('<aside class="runner" id="runner"',
    '''<div class="scrim" id="pScrim"></div>
<aside class="pase" id="pase" role="dialog" aria-modal="true" aria-labelledby="pTit" hidden>
  <div class="p-top"><h2 id="pTit">Pase El Centro</h2><button class="r-x" id="pX" type="button">Cerrar</button></div>
  <p class="p-why" id="pWhy" hidden></p>
  <p class="p-sub">Todos los agentes de El Centro, <b id="pUsos">300</b> usos al mes. Y si postulas tu agente y entra, usas El Centro gratis mientras siga vivo.</p>
  <a class="go" id="pBuy" href="#" target="_top" rel="noopener">Comprar el pase</a>
  <p class="p-soon" id="pSoon" hidden>El pase abre muy pronto.</p>
  <form class="p-form" id="pForm" autocomplete="on">
    <div class="p-lbl">¿Ya lo compraste? Actívalo:</div>
    <div class="two">
      <div class="fld"><label for="pPed">N° de pedido</label><input id="pPed" inputmode="numeric" placeholder="1001" maxlength="14"></div>
      <div class="fld"><label for="pMail">Correo de la compra</label><input id="pMail" type="email" placeholder="tu@correo.cl" maxlength="120"></div>
    </div>
    <button class="bt cool" id="pGo" type="submit">Activar pase</button>
  </form>
  <div class="msg" id="pMsg" aria-live="polite" hidden></div>
</aside>
<aside class="runner" id="runner"''')

# ---------------- CSS nuevo ----------------
rep('/* ---------- mapa ---------- */', '''/* ---------- bloques, plan y pase ---------- */
.bloques{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.4rem}
.bq{font-family:var(--mono);font-size:.62rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;padding:.45rem .7rem;
  border:1px solid var(--line);color:var(--ink-dim)}
.bq.on{background:var(--ink);border-color:var(--ink);color:#0A0A0B}
.bq i{font-style:normal;color:var(--hace);margin-left:.35rem;font-size:.56rem}
.pills{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
.pill.plan{cursor:pointer;background:transparent;color:var(--hace);border-color:rgba(255,176,32,.4)}
.pill.plan:hover{border-color:var(--hace)}
.fb.paseb{color:var(--hace);border-color:rgba(255,176,32,.45)}
.pase{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:92vh;overflow-y:auto;z-index:80;
  background:#0E0E10;border:1px solid var(--line);border-top:3px solid var(--hace);padding:1.3rem 1.3rem 1.2rem;display:flex;flex-direction:column;gap:1rem}
.pase .p-top{display:flex;justify-content:space-between;align-items:center;gap:1rem}
.pase h2{font-size:2rem}
.pase .p-sub,.pase .p-why{margin:0;color:var(--ink-mid);font-size:.95rem;line-height:1.55}
.pase .p-why{color:var(--caza);font-family:var(--mono);font-size:.72rem}
.pase .p-sub b{color:var(--ink)}
.pase .go{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;align-self:flex-start;
  font-family:var(--mono);font-size:.74rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;padding:1rem 1.4rem;
  color:#180B02;background:linear-gradient(100deg,var(--caza),var(--hace))}
.pase .p-soon{margin:0;font-family:var(--mono);font-size:.7rem;color:var(--ink-dim)}
.pase .p-form{display:flex;flex-direction:column;gap:.7rem;border-top:1px solid var(--line);padding-top:1rem}
.pase .p-lbl{font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-dim)}
.pase .p-form .bt{align-self:flex-start}
#pScrim{z-index:79}

/* ---------- mapa ---------- */''')

# ---------------- JS ----------------
# el catálogo ya no viaja en la página: viene de /api/centro-estado
cut('/* [nombre, mundo, forma, qué hace, para quién, estado] */', 'var FN={caza:"Caza",hace:"Hace",acom:"Acompaña"};')
cut('/* agentes que ya tienen su propia app y diseño', 'var COMM=[];')
rep('var COMM=[];', 'var BASE=[];\nvar COMM=[];')
cut('var CANON=Object.create(null);BASE.forEach', 'function canon(s)')
cut('function canon(s)', '/* =============== instrucciones de cada agente')
# las instrucciones viven en el servidor
cut('/* =============== instrucciones de cada agente', '/* =============== treemap')

# motor: estado del servidor en vez de la cuenta de Claude del visitante
rep('var SAMPLE=null,motor="wait";     /* wait | on | off */', 'var motor="wait";     /* wait | on | off */')
rep('''  var can=motor==="on"&&!denied&&!busy;
  R.go.disabled=!can;R.inp.disabled=motor!=="on"||denied;
  R.hint.textContent=denied?"Sin permiso para usar Claude en esta página, los agentes no pueden correr.":
    motor==="off"?"Los agentes corren cuando abres esta página dentro de Claude.":
    motor==="wait"?"Conectando el motor…":"Corre con tu cuenta de Claude. La primera vez te pide permiso.";''',
    '''  var can=motor==="on"&&!busy;
  R.go.disabled=!can;R.inp.disabled=motor!=="on";
  R.hint.textContent=motor==="off"?"El motor está apagado por mantención. Vuelve en un rato.":
    motor==="wait"?"Conectando el motor…":"Cada respuesta usa uno de tus usos.";''')

old_send = s[s.index('function send(){'):s.index('R.go.addEventListener("click",send);')]
rep(old_send, '''function send(){
  if(!cur||busy||motor!=="on")return;
  var text=R.inp.value.trim();if(!text){R.inp.focus();return;}
  var a=cur;
  bubble("me",text);
  var out=bubble("ag wait","Pensando…");
  R.inp.value="";busy=true;ctl=new AbortController();
  R.stop.hidden=false;motorUI();
  var msgs=turns.slice(-10).concat([{role:"user",content:text}]);
  api("centro-correr",{agente:a.k,mensajes:msgs},ctl.signal).then(function(j){
    turns.push({role:"user",content:text},{role:"assistant",content:j.texto,firma:j.firma});
    if(cur===a){out.className="b ag";out.textContent=j.texto;R.log.scrollTop=R.log.scrollHeight;}
    countRun(a);setPlan(j.plan,j.restantes);
  },function(e){
    if(out.parentNode)out.parentNode.removeChild(out);
    if(cur!==a)return;
    if(e&&e.name==="AbortError"){bubble("sys","Detenido.");}
    else if(e&&(e.code==="sin_cuota"||e.code==="sin_cuota_global")){bubble("sys bad",e.error);abrirPase(e.error);}
    else{bubble("sys bad",(e&&e.error)||"Se cortó la conexión. Inténtalo de nuevo.");}
    if(!R.inp.value)R.inp.value=text;
  }).then(function(){busy=false;ctl=null;R.stop.hidden=true;motorUI();});
}
''')

# base de datos del artifact → sesión propia de El Centro y API del servidor
old_db = s[s.index('/* =============== mercado compartido (db) =============== */'):s.index('/* =============== forja =============== */')]
rep(old_db, '''/* =============== sesión y servidor =============== */
function clean(s,n){return String(s==null?"":s).replace(/\\s+/g," ").trim().slice(0,n);}
/* la sesión es de El Centro (firmada por el servidor) y se abre recién cuando la persona usa algo */
var KS="centro-sesion",TOK=null;
try{TOK=localStorage.getItem(KS);}catch(e){}
function token(nueva){
  if(TOK&&!nueva)return Promise.resolve(TOK);
  return fetch("/api/centro-sesion",{method:"POST"}).then(function(r){return r.json().catch(function(){return{};}).then(function(j){
    if(!r.ok||!j.token)throw{code:j.code||"sin_sesion",error:j.error||"No se pudo abrir tu sesión. Recarga la página."};
    TOK=j.token;try{localStorage.setItem(KS,TOK);}catch(e){}return TOK;});});
}
function api(ruta,body,signal,otra){
  return token().then(function(t){
    return fetch("/api/"+ruta,{method:"POST",signal:signal,headers:{"content-type":"application/json",authorization:"Bearer "+t},body:JSON.stringify(body)})
      .then(function(r){return r.json().catch(function(){return{};}).then(function(j){
        if(r.status===401&&j.code==="sin_sesion"&&!otra){TOK=null;try{localStorage.removeItem(KS);}catch(e){}return api(ruta,body,signal,true);}
        if(!r.ok||j.ok===false){j.status=r.status;throw j;}return j;});});
  });
}
function countRun(a){runs[a.k]=(runs[a.k]||0)+1;schedule();}

/* plan de la persona: gratis, pase o creador */
var PLAN={plan:null,restantes:null},ESTADO=null;
var planEl=document.getElementById("plan");
function setPlan(p,rest){
  PLAN={plan:p,restantes:rest};
  planEl.textContent=p==="pase"?"Pase activo · "+rest+" usos este mes":
    p==="creador"?"Creador · "+rest+" usos este mes":
    p==="gratis"?(rest>0?"Te quedan "+rest+" usos gratis":"Sin usos gratis · ver pase"):
    ((ESTADO&&ESTADO.planes?ESTADO.planes.gratis:5)+" usos gratis para probar");
}

/* ventana del pase */
var PS={box:document.getElementById("pase"),scrim:document.getElementById("pScrim"),x:document.getElementById("pX"),
  why:document.getElementById("pWhy"),buy:document.getElementById("pBuy"),soon:document.getElementById("pSoon"),
  form:document.getElementById("pForm"),ped:document.getElementById("pPed"),mail:document.getElementById("pMail"),
  go:document.getElementById("pGo"),msg:document.getElementById("pMsg"),usos:document.getElementById("pUsos")};
var psFocus=null;
function abrirPase(motivo){
  psFocus=document.activeElement;
  var pi=ESTADO&&ESTADO.pase;
  PS.why.hidden=!motivo;PS.why.textContent=motivo||"";
  if(pi&&pi.url){PS.buy.hidden=false;PS.soon.hidden=true;PS.buy.href=pi.url;PS.buy.textContent="Comprar el pase · "+(pi.precio||"");}
  else{PS.buy.hidden=true;PS.soon.hidden=false;}
  PS.usos.textContent=ESTADO&&ESTADO.planes?ESTADO.planes.pase:300;
  PS.msg.hidden=true;PS.box.hidden=false;PS.scrim.className="scrim on";
  setTimeout(function(){(pi&&pi.url?PS.buy:PS.ped).focus();},40);
}
function cerrarPase(){PS.box.hidden=true;PS.scrim.className="scrim";if(psFocus&&psFocus.focus)psFocus.focus();}
PS.x.addEventListener("click",cerrarPase);PS.scrim.addEventListener("click",cerrarPase);
document.getElementById("paseBtn").addEventListener("click",function(){abrirPase("");});
planEl.addEventListener("click",function(){abrirPase("");});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!PS.box.hidden)cerrarPase();});
function psMsg(t,k){PS.msg.hidden=false;PS.msg.textContent=t;PS.msg.className="msg"+(k?" "+k:"");}
PS.form.addEventListener("submit",function(e){
  e.preventDefault();
  var ped=PS.ped.value.replace(/[^0-9]/g,""),mail=PS.mail.value.trim();
  if(!ped){psMsg("Escribe el número de pedido.","bad");PS.ped.focus();return;}
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(mail)){psMsg("Escribe el correo con que compraste.","bad");PS.mail.focus();return;}
  PS.go.disabled=true;psMsg("Revisando tu pedido…");
  api("centro-pase",{pedido:ped,email:mail}).then(function(j){
    var v=new Date(j.vence);
    psMsg("Pase activo hasta el "+v.toLocaleDateString("es-CL",{day:"numeric",month:"long"})+". Ya puedes usar todos los agentes.","ok");
    setPlan("pase",ESTADO&&ESTADO.planes?ESTADO.planes.pase:300);
  },function(err){psMsg((err&&err.error)||"No se pudo activar. Inténtalo de nuevo.","bad");})
  .then(function(){PS.go.disabled=false;});
});

''')

# tarjeta: descarga normal del navegador (fuera del artifact no hay capacidad downloads)
rep('var forged=null,anim=null,DL=null;', 'var forged=null,anim=null;')
old_dl = s[s.index('F.dl.addEventListener("click",function(){'):s.index('function applyState(){')]
rep(old_dl, '''F.dl.hidden=false;
F.dl.addEventListener("click",function(){
  if(!forged)return;
  F.dl.disabled=true;F.dl.textContent="Preparando…";
  var c;try{c=card(forged,clean(F.fn.value,32),clean(F.fq.value,140),clean(F.fa.value,40));}catch(e){dlBack("No se pudo");return;}
  c.toBlob(function(blob){
    if(!blob){dlBack("No se pudo");return;}
    var u=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=u;a.download=slugify(F.fn.value||forged.name)+"-elcentro.png";document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(u);},4000);dlBack("Lista");
  },"image/png");
});
''')
old_apply = s[s.index('function applyState(){'):s.index('/* =============== prueba de entrada ===============')]
rep(old_apply, '''function applyState(){
  if(motor!=="on"){F.sub.disabled=true;setMsg(motor==="off"?"El Centro está en mantención. Vuelve en un rato.":"Conectando con el mercado…");return;}
  if(OLA-COMM.length<=0){F.sub.disabled=true;setMsg("La Ola 1 se llenó. La siguiente abre pronto.");return;}
  F.sub.disabled=false;setMsg("Mercado conectado. Forja tu agente y postula.");
}
''')

# prueba de entrada: ahora corre en el servidor
old_exam = s[s.index('/* =============== prueba de entrada ==============='):s.index('/* =============== arranque =============== */')]
rep(old_exam, '''/* =============== prueba de entrada ===============
   Nadie ve los requisitos antes: el agente rinde la prueba en el servidor y solo se conoce el resultado.
   Si no pasa, se le recomienda uno de los agentes de la casa según el motivo. */
function aprobado(a){return a.sello===true;}
var examOut=document.getElementById("examOut"),POST_CTL=null;
function examClear(){examOut.hidden=true;examOut.textContent="";}
function failUI(j){
  examOut.textContent="";examOut.hidden=false;
  if(j.bloqueado||!j.ayuda){
    var p0=document.createElement("p");p0.textContent="Este agente no puede entrar a El Centro.";
    examOut.appendChild(p0);return;
  }
  var h=BASE.filter(function(x){return x.k===j.ayuda.k;})[0]||{k:j.ayuda.k,n:j.ayuda.n,q:j.ayuda.q,c:"Meta",f:"hace",por:"HK23",app:null};
  var p1=document.createElement("p");
  p1.appendChild(document.createTextNode("Te recomiendo a uno de mis agentes para dejarlo listo antes de volver a postular:"));
  var who=document.createElement("div");who.className="who";who.textContent=h.n;
  var wq=document.createElement("div");wq.className="whoq";wq.textContent=h.q;
  var b=document.createElement("button");b.type="button";b.className="bt hot";b.textContent="Prepararlo con "+h.n;
  b.addEventListener("click",function(){
    openRunner(h);R.inp.value=j.ayuda.mensaje;
    setTimeout(function(){if(!R.inp.disabled)R.inp.focus();},80);
  });
  examOut.appendChild(p1);examOut.appendChild(who);examOut.appendChild(wq);examOut.appendChild(b);
}
[F.fn,F.fc,F.fq,F.ff].forEach(function(el){el.addEventListener("input",function(){if(!POST_CTL)examClear();});});
var STEPS=["Preparando la prueba…","Tu agente está respondiendo…","El jurado está decidiendo…"];
F.sub.addEventListener("click",function(){
  if(POST_CTL){POST_CTL.abort();return;}
  var nombre=clean(F.fn.value,32),que=clean(F.fq.value,140),cat=clean(F.fc.value,24),por=clean(F.fa.value,40);
  if(!nombre){setMsg("Ponle nombre a tu agente.","bad");F.fn.focus();return;}
  if(!que){setMsg("Dinos en una línea qué hace.","bad");F.fq.focus();return;}
  if(!cat){setMsg("Dinos a qué mundo entra.","bad");F.fc.focus();return;}
  if(!por){setMsg("Pon tu nombre o @ para que el bloque lleve tu firma.","bad");F.fa.focus();return;}
  examClear();
  POST_CTL=new AbortController();F.sub.textContent="Cancelar prueba";
  var si=0;setMsg("Prueba de entrada · "+STEPS[0]);
  var tick=setInterval(function(){si=Math.min(si+1,STEPS.length-1);setMsg("Prueba de entrada · "+STEPS[si]);},15000);
  var forma=F.ff.value==="caza"||F.ff.value==="acom"?F.ff.value:"hace";
  api("centro-postular",{nombre:nombre,mundo:cat,forma:forma,que:que,por:por},POST_CTL.signal).then(function(j){
    if(j.aprobado){setMsg(nombre+" pasó la prueba y quedó postulado al mundo "+j.mundo+". Ahora lo reviso yo.","ok");return;}
    setMsg("No pasó la prueba de entrada esta vez.","bad");failUI(j);
  },function(e){
    if(e&&e.name==="AbortError"){setMsg("Prueba cancelada.");return;}
    setMsg((e&&e.error)||"La prueba se cortó. Inténtalo de nuevo.","bad");
  }).then(function(){clearInterval(tick);POST_CTL=null;F.sub.textContent="Postular";});
});

''')

# arranque: el estado viene del servidor y se refresca cada minuto
old_boot = s[s.index('/* =============== arranque =============== */'):s.index('})();\n</script>')]
rep(old_boot, '''/* =============== arranque =============== */
function peso(a){return a.s==="vive"?4:a.s==="va"?2:1;}
function renderBloques(bs){
  var nav=document.getElementById("bloques");if(!bs||!bs.length)return;
  nav.textContent="";
  bs.forEach(function(b){
    var el=document.createElement("span");el.className="bq "+(b.activo?"on":"off");el.textContent=b.nombre;
    if(b.activo)el.setAttribute("aria-current","page");
    else{var i=document.createElement("i");i.textContent="pronto";el.appendChild(i);}
    nav.appendChild(el);
  });
}
function cargar(){
  return fetch("/api/centro-estado").then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(e){
    ESTADO=e;
    var ag=(e.agentes||[]).map(function(a){a.base=peso(a);return a;});
    BASE=ag.filter(function(a){return a.k.charAt(0)==="c";});
    COMM=ag.filter(function(a){return a.k.charAt(0)==="u";});
    runs=e.usos||{};OLA=(e.ola&&e.ola.tam)||OLA;TOTAL=(e.ola&&e.ola.total)||TOTAL;
    motor=e.conectado?"on":"off";
    renderBloques(e.bloques);
    if(!PLAN.plan)setPlan(null,null);
    schedule();motorUI();applyState();
  },function(){if(motor==="wait")motor="off";motorUI();applyState();});
}
layout();motorUI();paint(forge(F.d.value,7731));F.fq.value="";setPlan(null,null);
cargar();
setInterval(function(){if(!document.hidden&&!busy)cargar();},60000);
''')

# ---------------- verificación de restos del artifact ----------------
for resto in ["window.claude", "SAMPLE", "DB.", "renderCasa", "casaSec", "pendSec", "EXAM[", "rules(", "DL.save", "UID", "EDIT"]:
    assert resto not in s, "quedó un resto del artifact: " + resto

s = s.replace("/*@FONTS@*/", open(FONTS, encoding="utf-8").read())
# Vercel Web Analytics, igual que el resto de las páginas públicas del sitio (commit fe65535); mismo origen
s = s.replace("<script>\n(function(){", '<script defer src="/_vercel/insights/script.js"></script>\n<script>\n(function(){', 1)
assert "/_vercel/insights/script.js" in s, "no se pudo insertar el script de analytics"
open(DST, "w", encoding="utf-8").write(s)
print("centro.html armado:", len(s) // 1024, "KB")

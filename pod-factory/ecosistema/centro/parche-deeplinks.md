# Parche · deep links para El Centro

**Qué resuelve:** hoy El Centro es un solo link. Cualquier post sobre un agente
deja al visitante frente a un mapa de 133 bloques para que lo busque a mano.
Con esto, cada agente tiene su propia dirección y el bloque se abre solo.

`…/artifact/4i9pCjF6rTmuyM2F6CBJJ1#vozmarca` → abre **VozMarca**.

**Por qué no uso `a.k`:** las claves son `c0`, `c1`, `c2`… índices de posición.
`#c47` no significa nada y apunta a otro agente si cambia el orden del catálogo.
El slug sale del nombre con `ckey()`, que ya está en tu código y produce
minúsculas sin acentos ni símbolos — justo lo que admite un hash de artifact.

---

## 1 · Bloque nuevo

Pegar **después** de `function refilter(){…}` (queda cerca de la línea 640,
ya con `agents()`, `ckey()`, `tileEls`, `cur`, `openRunner` y `closeRunner` definidos):

```js
/* ===== deep links: cada agente tiene su propia dirección ===== */
function slugDe(a){return ckey(a.n);}

function porSlug(s){
  s=String(s||"").toLowerCase();
  if(!s)return null;
  var all=agents();
  for(var i=0;i<all.length;i++)if(slugDe(all[i])===s)return all[i];
  return null;
}

/* replaceState no dispara hashchange: no se arma bucle con openRunner */
function marcarHash(a){
  try{history.replaceState(null,"",a?("#"+slugDe(a)):(location.pathname+location.search));}catch(e){}
}

function desdeHash(){
  var a=porSlug((location.hash||"").replace(/^#/,""));
  if(a){
    if(cur!==a)openRunner(a);
    var el=tileEls[a.k];
    if(el&&el.scrollIntoView)el.scrollIntoView({block:"center",behavior:"smooth"});
  }else if(cur){closeRunner();}
}

window.addEventListener("hashchange",desdeHash);
```

## 2 · Tres líneas dentro de funciones que ya existen

**En `openRunner(a)`** — la línea que hoy dice:

```js
cur=a;turns=[];lastFocus=document.activeElement;
```

queda:

```js
cur=a;turns=[];lastFocus=document.activeElement;marcarHash(a);
```

**En `closeRunner()`** — la línea que hoy dice:

```js
cur=null;
```

queda:

```js
cur=null;marcarHash(null);
```

**En el arranque** — la línea 1211, que hoy dice:

```js
layout();motorUI();paint(forge(F.d.value,7731));F.fq.value="";
```

queda:

```js
layout();motorUI();paint(forge(F.d.value,7731));F.fq.value="";desdeHash();
```

---

## Qué pasa después

- `#vozmarca` abre VozMarca y centra su bloque en el mapa
- Cerrar el agente limpia la dirección
- Un hash que no calza con nadie no rompe nada: muestra el mapa normal
- Los agentes de comunidad funcionan igual, su slug también sale del nombre

## Lo que no hace

No cambia el diseño, el motor, la base de datos ni las postulaciones.
Son 20 líneas nuevas y tres retoques.

## Aviso

El hash solo llega a la página si es un token simple — letras, números,
`.` `_` `~` `-`. `ckey()` ya deja solo minúsculas y dígitos, así que calza.
Nada de `#agente=vozmarca`: eso no llega.

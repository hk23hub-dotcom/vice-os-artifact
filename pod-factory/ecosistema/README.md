# ECOSISTEMA · POD FACTORY

La capa visible y con memoria encima de la fábrica. No reemplaza nada de lo que ya
funciona: lee lo que la fábrica produce y le pone dirección, memoria y un parte.

```
ecosistema/
├── reparto.json        el elenco: 8 agentes, su puesto, su jefe y su límite
├── agentes/<CODE>/
│   ├── perfil.md       generado desde reparto.json — quién es y qué no hace nunca
│   ├── memoria.md      lo que aprendió. Crece sola. No se borra.
│   └── estado.json     su día de hoy
├── parte.mjs           lee la fábrica real → parte de ≤3 aprobaciones + 1 tarea humana
├── mundo.mjs           genera el mundo visible con los datos de hoy
├── mundo/fabrica.html  la fábrica en pixel, para mirarla y para venderla
├── partes/<fecha>.md   un parte por día
└── correr.sh           el turno diario completo
```

## El turno

```bash
node ecosistema/parte.mjs      # parte del día (no toca red)
node ecosistema/mundo.mjs      # regenera el mundo visible
./ecosistema/correr.sh         # las dos cosas + log
```

Para que corra solo todos los días a las 09:25 (una vez, tú):

```bash
cp ecosistema/com.hk23.ecosistema.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.hk23.ecosistema.plist
```

Corre a las 09:25, diez minutos después de la fábrica (09:15), para leer lo que ella dejó.

## Las reglas

1. **El parte nunca tiene más de 3 aprobaciones ni más de 1 tarea humana.** Si Central
   puede resolver algo sola, lo resuelve y no lo sube.
2. **La memoria no se borra.** Cada corrida agrega líneas con fecha; nunca reescribe.
3. **Nada sale hacia afuera.** El ecosistema lee y escribe archivos. No envía, no publica,
   no cobra. Lo aprobado sale por `~/hq/hq.sh execute` o a mano.
4. **Números reales o nada.** Si un dato no está en un ledger, se reporta como faltante.
   No se estima, no se inventa.

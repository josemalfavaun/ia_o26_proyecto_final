# DOOM BIN BASH: un FPS de terminal cuyos enemigos, jefe y director aprenden

FPS retro de terror que corre en el navegador (raycasting con Phaser 3 y TypeScript). El juego base
es un proyecto de equipo de años anteriores; este proyecto final le agrega una capa de inteligencia
artificial medida con un simulador: enemigos que planean rutas con A*, un jefe que decide con
expectimax y un director de dificultad que aprende con Thompson sampling cuánto reto dar.

**Demo en línea:** <https://doom-bash-ia-mu.vercel.app/?ia=astar,bandido>
(pulsa `A`, luego `Enter`; con `I` abres el panel de IA, con `4`, `5` o `6` saltas a un jefe).

El análisis completo, con cifras, resultados negativos y límites, está en [`INFORME.md`](INFORME.md).
El plan original y qué unidad del curso usa cada módulo está en [`docs/PLAN_IA.md`](docs/PLAN_IA.md).

## Cómo correrlo

Requisito: Docker con Compose.

```bash
docker compose up --build
```

Abre <http://localhost:8000>. Controles dentro del juego (menú de ayuda con `H`).

Opcional, narrador con un LLM local (Ollama, sin llaves de API; la primera vez descarga el modelo):

```bash
docker compose --profile llm up --build
```

Sin Docker, para desarrollar (Node 22):

```bash
npm ci
npm run dev          # juego en http://localhost:5173
npm test             # pruebas unitarias (vitest): 115 archivos, 836 pruebas
npm run lint
```

## Cómo activar la IA en el juego

Por omisión todo está apagado y el juego se comporta como el original. Se activa con teclas o con la URL:

| Tecla | Qué hace |
|---|---|
| `I` | Muestra u oculta el panel de IA (esquina superior derecha) |
| `U` | Navegación de enemigos: regla original o A* |
| `O` | Director del jefe: regla original, expectimax o bandido Thompson |

También con la URL: `?ia=astar,bandido` (acepta `astar`, `legacy`, `expectimax`, `bandido`, `regla`). Los modos y lo que
aprende el bandido se guardan en el navegador. Detalles en [`docs/PANEL_IA.md`](docs/PANEL_IA.md).

## Pantallas y atajos para la presentación

| Dónde | Qué pasa |
|---|---|
| Menú y tutorial | El fondo es el motor real del juego jugando solo: un bot con A* recorre un nivel y dispara a los enemigos que le salen al paso (`src/ai/runtime/attractCombat.ts`); después pelea contra el jefe 1 con sus tres fases y vuelve a empezar. |
| Pantalla de misión | Misión y objetivo del episodio, los 8 modificadores de la partida con su descripción (`↑`/`↓` o `M` para cambiar de modificador, `R` para sortear, `N` para ninguno) y los controles. |
| Durante la partida | `ESC` abre el menú de pausa; `L` repite el objetivo de la misión; `G` pide una frase al narrador (necesita el narrador local de arriba encendido). |
| Final | Al derrotar al último jefe, `N` lleva a la escena final: salida del complejo, amanecer, explosión en cadena y extracción. |
| Demos rápidas | `4`/`5`/`6` saltan a los niveles 3/6/10, `7`/`8`/`9` a cada jefe y `-` abre la escena final. |

## Qué es IA hoy y qué se construyó

| Módulo | Estado | Dónde | Documento |
|---|---|---|---|
| Máquina de estados de enemigos y perfiles tácticos fijos | Heredado del juego base | `src/game/systems/EnemyFSM.ts`, `src/game/raycast/RaycastEnemyTactics.ts` | |
| Director de ritmo con reglas (calma, presión, emboscada) | Heredado del juego base | `src/game/systems/GameDirector.ts` | |
| Narrador con LLM local (Ollama) | Heredado, opcional | `server/src/gameMaster.ts` | |
| M0 Simulador sin cabeza, determinista, con bots de referencia | Hecho y medido | `src/ai/sim/` | [`docs/SIMULADOR.md`](docs/SIMULADOR.md) |
| M1 Navegación de enemigos con A* | Hecho y medido; conectado al juego | `src/ai/astar/` | [`docs/NAVEGACION.md`](docs/NAVEGACION.md) |
| M2 Jefe con expectimax | Hecho y medido; conectado al juego. Resultado mixto | `src/ai/expectimax/` | [`docs/JEFE.md`](docs/JEFE.md) |
| M3 Director adaptativo (Thompson sampling) | Hecho y medido; conectado al juego. Resultado mixto | `src/ai/bandit/` | [`docs/DIRECTOR.md`](docs/DIRECTOR.md) |
| Panel de IA y runtime en el juego | Hecho | `src/ai/runtime/` | [`docs/PANEL_IA.md`](docs/PANEL_IA.md) |
| M4 Bot jugador con Q-learning | Hecho y medido en el simulador; no se conecta al juego. Resultado mixto | `src/ai/qlearn/` | [`docs/QLEARNING.md`](docs/QLEARNING.md) |
| M5 Narrador con salida estructurada | Hecho y medido con Ollama (llama3.2:3b): 100 % de respuestas válidas tras corregir el prompt (20 % con el primero) | `server/src/gameMasterStructured.ts` | [`docs/NARRADOR.md`](docs/NARRADOR.md) |
| Modo estudio (partidas con personas) | Hecho y probado; aún sin datos reales | `src/ai/runtime/AiRuntime.ts`, `src/ai/study/` | [`docs/ESTUDIO.md`](docs/ESTUDIO.md) |

## Cómo reproducir las mediciones

```bash
npm run bench:sim                    # M0: bots de referencia (varios minutos)
npm run bench:nav                    # M1: algoritmos de ruta y persecución
npm run bench:boss -- --seeds 40     # M2: jefe (varios minutos)
npm run bench:director               # M3: usa resultados/director-tabla.json si existe
npm run bench:director -- --rebuild  # M3: vuelve a simular la tabla (poco más de un minuto)
npm run bench:director-knobs         # M3: el resultado negativo del director de spawns
npm run bench:qlearn                 # M4: unos 4 minutos; `-- --scale 0.1` para una prueba rápida
npm run bench:narrator               # M5: necesita `ollama serve`; si no responde, no escribe nada
npm run analizar:estudio             # lee datos/sesiones/*.json (fuera del repositorio)
```

Las tablas ya generadas del jefe y del director están en `resultados/`. Cada episodio es determinista: la misma
semilla da la misma partida.

## Cómo funciona

- `src/ai/`: toda la IA nueva (simulador, A*, expectimax, bandido, runtime del panel). No importa Phaser, salvo el
  enganche de `RaycastScene`.
- `src/game/raycast/`: renderizador raycast, enemigos, jefe, mapa, HUD. Aquí viven los puntos de inyección
  `RaycastEnemyNavigator` y `RaycastBossPolicy`; sin ellos el juego usa la regla original.
- `src/game/systems/`: director, combate, armas, puertas, llaves.
- `server/`: Game Master (narrador con Ollama) y servidor cooperativo autoritativo a 20 Hz.
- `shared/`: tipos y protocolo compartidos entre cliente y servidor.

El README del juego original, con todos sus modos, está en
[`docs/README.juego-original.md`](docs/README.juego-original.md).

## Datos y modelos

Esta entrega no entrena modelos que haya que guardar: el bandido guarda su creencia en el navegador del jugador
(`localStorage`) y las tablas de las mediciones son pequeñas y están en `resultados/`. `datos/` y `modelos/` siguen
ignorados por git.

## Créditos y licencia

Base del juego: José Malfavaun, ETurriza, Fr-C-S-08 y Francisco Emilio, en
[josemalfavaun/doom-bin-bash-edition](https://github.com/josemalfavaun/doom-bin-bash-edition).
Licencia MIT (ver `LICENSE`). El juego está inspirado en el estilo de los FPS clásicos pero no
usa su código ni sus assets.

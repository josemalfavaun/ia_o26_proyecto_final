# DOOM BIN BASH: un FPS de terminal cuyos enemigos, jefe y director aprenden

FPS retro de terror que corre en el navegador (raycasting con Phaser 3 y TypeScript). El juego base
es un proyecto de equipo de años anteriores; este proyecto final le agrega una capa de inteligencia
artificial real: enemigos que planean rutas y se coordinan, un jefe que decide simulando partidas,
un director de dificultad que aprende del jugador y un bot que aprende a jugar para medir todo lo
anterior con datos.

> Estado: propuesta. El plan completo de IA, qué unidad del curso usa cada módulo y cómo se mide
> está en [`docs/PLAN_IA.md`](docs/PLAN_IA.md).

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
npm test             # pruebas unitarias (vitest)
npm run lint
```

## Qué es IA hoy y qué se está construyendo

| Módulo | Estado | Dónde |
|---|---|---|
| Máquina de estados de enemigos y perfiles tácticos fijos | Heredado del juego base | `src/game/systems/EnemyFSM.ts`, `src/game/raycast/RaycastEnemyTactics.ts` |
| Director de ritmo con reglas (calma, presión, emboscada) | Heredado del juego base | `src/game/systems/GameDirector.ts` |
| Narrador con LLM local (Ollama) | Heredado, opcional | `server/src/gameMaster.ts` |
| Navegación con A* y coordinación de enemigos | En desarrollo | ver `docs/PLAN_IA.md` |
| Jefe con MCTS / expectimax | En desarrollo | ver `docs/PLAN_IA.md` |
| Director de dificultad adaptativo (bandits / MDP) | En desarrollo | ver `docs/PLAN_IA.md` |
| Bot jugador con Q-learning y banco de pruebas | En desarrollo | ver `docs/PLAN_IA.md` |

La tabla se actualiza conforme cada módulo queda terminado y medido.

## Cómo funciona

- `src/game/raycast/`: renderizador raycast, enemigos, jefe, mapa, HUD.
- `src/game/systems/`: director, combate, armas, puertas, llaves.
- `server/`: Game Master (narrador con Ollama) y servidor cooperativo autoritativo a 20 Hz.
- `shared/`: tipos y protocolo compartidos entre cliente y servidor.

El README del juego original, con todos sus modos, está en
[`docs/README.juego-original.md`](docs/README.juego-original.md).

## Datos y modelos

Los modelos entrenados (tablas Q, estadísticas de bandits) y los registros de partidas se generan
con scripts del repositorio y viven en `datos/` y `modelos/`, que no se suben. El README indicará el
comando exacto para regenerarlos cuando existan.

## Créditos y licencia

Base del juego: José Malfavaun, ETurriza, Fr-C-S-08 y Francisco Emilio, en
[josemalfavaun/doom-bin-bash-edition](https://github.com/josemalfavaun/doom-bin-bash-edition).
Licencia MIT (ver `LICENSE`). El juego está inspirado en el estilo de los FPS clásicos pero no
usa su código ni sus assets.

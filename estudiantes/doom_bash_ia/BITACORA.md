# Bitácora

Una fila por entrada. La evidencia es un link (https://…) o un archivo de esta carpeta
(por ejemplo `evidencia/2026-11-20-prueba.png`). Sin evidencia, la fila no cuenta.
Lo que ya queda en GitHub (commits, PRs, issues) no hace falta copiarlo aquí.
No subas caras ni datos personales: el repo es público.

| fecha | login | qué hice | evidencia |
|---|---|---|---|
| 2026-11-24 | josemalfavaun | Simulador sin cabeza determinista del juego (misma semilla, misma partida) con bots de referencia y benchmark con intervalos de confianza | docs/SIMULADOR.md |
| 2026-11-24 | josemalfavaun | Navegación de enemigos con A* detrás de una interfaz opcional; benchmark de BFS, Dijkstra, voraz y A* en mapas reales y de persecución contra la regla original | docs/NAVEGACION.md |
| 2026-11-24 | josemalfavaun | Jefes con expectimax (objetivos de daño y de ritmo) detrás de una interfaz opcional; benchmark contra la regla original y contra políticas triviales, con resultado negativo documentado | docs/JEFE.md |
| 2026-11-24 | josemalfavaun | Director adaptativo con Thompson sampling sobre metas de presión del jefe; comparación contra epsilon-voraz, UCB1 y brazo fijo en 5 tipos de jugador simulados, con resultado mixto documentado | docs/DIRECTOR.md |
| 2026-11-24 | josemalfavaun | Fase 3: runtime de IA en el juego (teclas I/U/O, panel, ?ia=), persistencia del bandido y demo en línea en Vercel | docs/PANEL_IA.md |
| 2026-11-25 | josemalfavaun | README e informe con resultados honestos por módulo y límites; corregidos docs que decían que la IA no estaba conectada al juego | INFORME.md |
| 2026-11-25 | josemalfavaun | Barrido de arranque en frío en el navegador (campaña, atajos 6 a 9, victoria, configuración) con la consola abierta; dos errores que solo ocurrían al entrar a un jefe en página recién cargada, corregidos; build de producción verificado (26 MB, ningún archivo de más de 5 MB) | evidencia/2026-11-25-barrido-y-sensibilidad.md |
| 2026-11-25 | josemalfavaun | Sensibilidad de M3 a la velocidad del jefe 3: con 0.65 la tabla publicada se reproduce byte por byte; con 0.455 un brazo fijo supera a todos los selectores; se conserva 0.65 | evidencia/2026-11-25-barrido-y-sensibilidad.md |
| 2026-11-26 | josemalfavaun | M4: bot que aprende con Q-learning tabular jerárquico (6 macros, 1 620 estados) entrenado y probado en el simulador; resultado mixto documentado (sobrevive al jefe, no lo vence; depende de la recompensa) | docs/QLEARNING.md |
| 2026-11-26 | josemalfavaun | M5: narrador con salida JSON validada y respaldo con motivo del fallo, detrás de GAME_MASTER_STRUCTURED=1; medido con Ollama (llama3.2:3b): 20 % de respuestas válidas con el primer prompt, error propio diagnosticado con la respuesta cruda, y 100 % con el prompt corregido; el campo tono casi no varía | docs/NARRADOR.md |
| 2026-11-26 | josemalfavaun | Modo estudio para partidas con personas (consentimiento, brazo al azar uniforme, archivo anónimo exportable con K) y script de análisis con repetición por rechazo; sin datos reales todavía | docs/ESTUDIO.md |
| 2026-11-26 | josemalfavaun | Docker: se detectó que faltaba .dockerignore (el node_modules de macOS pisaría el de la imagen) y se agregó; docker compose up --build construye las dos imágenes y levanta juego (8000) y servidor (3001), y el juego se recorrió en el navegador dentro del contenedor hasta el jefe; modo estudio confirmado en la demo publicada | evidencia/2026-11-26-docker-y-estudio.md |
| 2026-11-27 | josemalfavaun | Rutas de A* dibujadas en el minimapa cuando el panel de IA está abierto (pendiente del plan de la demo); probado en el nivel 10 con navegación A* | evidencia/2026-11-27-rutas-astar-minimapa.png |
| 2026-11-28 | josemalfavaun | MCTS con UCT para el jefe sobre el mismo modelo que expectimax; ajuste con semillas 1-20 y prueba con 10001-10100: no le gana a expectimax (resultado negativo); modo MCTS en el panel (tecla O) | resultados/bench-mcts.md |
| 2026-11-28 | josemalfavaun | Panel de IA con el modo MCTS en el jefe 1 (decisión, iteraciones y visitas por rama) | evidencia/2026-11-28-panel-mcts.png |

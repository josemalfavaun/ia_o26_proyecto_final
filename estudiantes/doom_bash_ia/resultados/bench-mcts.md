# Benchmark de MCTS para el jefe

Ajuste: semillas 1 a 20, jugador guionado, 256 iteraciones, rejilla c ∈ {0.3, 0.7, 1.4} × horizonte ∈ {2, 4, 6}.
Prueba: semillas 10001 a 10100 (100), medidas una sola vez; no se usaron para ajustar.
Todas las políticas buscan sobre el mismo modelo del duelo (`src/ai/expectimax/model.ts`) con el repertorio completo del jefe.
"Daño por salva" y "error de ritmo": jugador invulnerable 45 s. Combate: jugador normal hasta 90 s. IC95 (Wilson en las proporciones).
Las evaluaciones por decisión miden el costo de búsqueda en la misma unidad para las dos búsquedas; los ms dependen de la computadora.

## Objetivo: daño

MCTS ajustado: c = 1.4, horizonte = 2 salvas.

| Jefe | Jugador | Política | Daño por salva (más es más duro) | Jugador vence al jefe | Sobrevive, s | Vida del jefe | Evaluaciones por decisión | ms por decisión |
|---|---|---|---|---|---|---|---|---|
| volt-archon-pit | guionado | regla original | 2.46 ± 0.35 | 0 % ± 2 | 72.6 ± 2.9 | 0.62 | – | – |
| volt-archon-pit | guionado | expectimax prof. 1 | 11.84 ± 0.94 | 0 % ± 2 | 24.5 ± 2.5 | 0.87 | 30 | 0.18 |
| volt-archon-pit | guionado | expectimax prof. 2 | 11.82 ± 0.94 | 0 % ± 2 | 24.5 ± 2.5 | 0.87 | 180 | 0.67 |
| volt-archon-pit | guionado | expectimax prof. 3 | 11.82 ± 0.94 | 0 % ± 2 | 24.5 ± 2.5 | 0.87 | 930 | 3.21 |
| volt-archon-pit | guionado | MCTS 64 it. | 10.80 ± 0.96 | 0 % ± 2 | 26.9 ± 2.8 | 0.85 | 128 | 0.45 |
| volt-archon-pit | guionado | MCTS 256 it. | 10.86 ± 0.86 | 0 % ± 2 | 27.5 ± 2.8 | 0.85 | 512 | 1.39 |
| volt-archon-pit | guionado | MCTS 1024 it. | 11.09 ± 0.93 | 0 % ± 2 | 26.1 ± 2.4 | 0.86 | 2048 | 4.46 |
| volt-archon-pit | aleatorio | regla original | 3.36 ± 0.48 | 0 % ± 2 | 69.3 ± 4.2 | 0.97 | – | – |
| volt-archon-pit | aleatorio | expectimax prof. 1 | 12.39 ± 1.32 | 0 % ± 2 | 28.4 ± 3.6 | 0.99 | 30 | 0.12 |
| volt-archon-pit | aleatorio | expectimax prof. 2 | 12.39 ± 1.32 | 0 % ± 2 | 28.4 ± 3.6 | 0.99 | 180 | 0.72 |
| volt-archon-pit | aleatorio | expectimax prof. 3 | 12.39 ± 1.32 | 0 % ± 2 | 28.4 ± 3.6 | 0.99 | 930 | 3.21 |
| volt-archon-pit | aleatorio | MCTS 64 it. | 12.16 ± 1.27 | 0 % ± 2 | 29.0 ± 3.6 | 0.99 | 128 | 0.50 |
| volt-archon-pit | aleatorio | MCTS 256 it. | 12.54 ± 1.27 | 0 % ± 2 | 27.3 ± 3.3 | 0.99 | 512 | 1.30 |
| volt-archon-pit | aleatorio | MCTS 1024 it. | 12.91 ± 1.32 | 0 % ± 2 | 26.1 ± 2.9 | 0.99 | 2048 | 4.14 |
| bloom-warden-pit | guionado | regla original | 5.49 ± 0.56 | 0 % ± 2 | 45.0 ± 3.2 | 0.73 | – | – |
| bloom-warden-pit | guionado | expectimax prof. 1 | 13.85 ± 1.05 | 0 % ± 2 | 22.0 ± 2.1 | 0.87 | 40 | 0.15 |
| bloom-warden-pit | guionado | expectimax prof. 2 | 13.84 ± 1.05 | 0 % ± 2 | 22.0 ± 2.1 | 0.87 | 240 | 0.77 |
| bloom-warden-pit | guionado | expectimax prof. 3 | 13.84 ± 1.05 | 0 % ± 2 | 22.0 ± 2.1 | 0.87 | 1240 | 3.60 |
| bloom-warden-pit | guionado | MCTS 64 it. | 11.47 ± 0.98 | 0 % ± 2 | 27.1 ± 2.6 | 0.84 | 128 | 0.47 |
| bloom-warden-pit | guionado | MCTS 256 it. | 12.20 ± 1.01 | 0 % ± 2 | 24.0 ± 2.1 | 0.86 | 512 | 1.36 |
| bloom-warden-pit | guionado | MCTS 1024 it. | 12.93 ± 1.03 | 0 % ± 2 | 23.1 ± 2.1 | 0.86 | 2048 | 4.28 |
| bloom-warden-pit | aleatorio | regla original | 6.21 ± 0.68 | 0 % ± 2 | 42.2 ± 4.4 | 0.98 | – | – |
| bloom-warden-pit | aleatorio | expectimax prof. 1 | 16.28 ± 1.74 | 0 % ± 2 | 19.5 ± 2.7 | 0.99 | 40 | 0.13 |
| bloom-warden-pit | aleatorio | expectimax prof. 2 | 16.28 ± 1.74 | 0 % ± 2 | 19.5 ± 2.7 | 0.99 | 240 | 0.72 |
| bloom-warden-pit | aleatorio | expectimax prof. 3 | 16.28 ± 1.74 | 0 % ± 2 | 19.5 ± 2.7 | 0.99 | 1240 | 3.54 |
| bloom-warden-pit | aleatorio | MCTS 64 it. | 12.99 ± 1.43 | 0 % ± 2 | 23.4 ± 3.0 | 0.99 | 128 | 0.49 |
| bloom-warden-pit | aleatorio | MCTS 256 it. | 14.60 ± 1.58 | 0 % ± 2 | 21.5 ± 2.8 | 0.99 | 512 | 1.39 |
| bloom-warden-pit | aleatorio | MCTS 1024 it. | 15.29 ± 1.59 | 0 % ± 2 | 20.0 ± 2.6 | 0.99 | 2048 | 4.16 |
| ash-judge-seal | guionado | regla original | 6.99 ± 0.65 | 5 % ± 5 | 39.1 ± 1.9 | 0.33 | – | – |
| ash-judge-seal | guionado | expectimax prof. 1 | 14.74 ± 1.12 | 1 % ± 3 | 23.6 ± 2.1 | 0.62 | 40 | 0.17 |
| ash-judge-seal | guionado | expectimax prof. 2 | 14.74 ± 1.12 | 1 % ± 3 | 23.6 ± 2.1 | 0.62 | 240 | 0.73 |
| ash-judge-seal | guionado | expectimax prof. 3 | 14.74 ± 1.12 | 1 % ± 3 | 23.6 ± 2.1 | 0.62 | 1240 | 3.44 |
| ash-judge-seal | guionado | MCTS 64 it. | 12.74 ± 1.03 | 2 % ± 3 | 26.2 ± 2.2 | 0.57 | 128 | 0.48 |
| ash-judge-seal | guionado | MCTS 256 it. | 13.59 ± 1.07 | 1 % ± 3 | 24.9 ± 2.4 | 0.59 | 512 | 1.28 |
| ash-judge-seal | guionado | MCTS 1024 it. | 14.25 ± 1.04 | 0 % ± 2 | 23.8 ± 2.0 | 0.61 | 2048 | 4.32 |
| ash-judge-seal | aleatorio | regla original | 4.13 ± 0.55 | 0 % ± 2 | 58.5 ± 5.0 | 0.96 | – | – |
| ash-judge-seal | aleatorio | expectimax prof. 1 | 12.34 ± 1.28 | 0 % ± 2 | 27.5 ± 3.5 | 0.98 | 40 | 0.12 |
| ash-judge-seal | aleatorio | expectimax prof. 2 | 12.38 ± 1.30 | 0 % ± 2 | 27.5 ± 3.5 | 0.98 | 240 | 0.71 |
| ash-judge-seal | aleatorio | expectimax prof. 3 | 12.38 ± 1.30 | 0 % ± 2 | 27.5 ± 3.5 | 0.98 | 1240 | 3.60 |
| ash-judge-seal | aleatorio | MCTS 64 it. | 11.25 ± 1.26 | 0 % ± 2 | 30.2 ± 3.8 | 0.98 | 128 | 0.52 |
| ash-judge-seal | aleatorio | MCTS 256 it. | 11.64 ± 1.23 | 0 % ± 2 | 29.4 ± 3.7 | 0.98 | 512 | 1.34 |
| ash-judge-seal | aleatorio | MCTS 1024 it. | 11.95 ± 1.27 | 0 % ± 2 | 29.4 ± 3.7 | 0.98 | 2048 | 4.19 |

## Objetivo: ritmo 4

MCTS ajustado: c = 1.4, horizonte = 2 salvas.

| Jefe | Jugador | Política | Error de ritmo vs 4 (menos es mejor) | Jugador vence al jefe | Sobrevive, s | Vida del jefe | Evaluaciones por decisión | ms por decisión |
|---|---|---|---|---|---|---|---|---|
| volt-archon-pit | guionado | regla original | 2.08 ± 0.22 | 0 % ± 2 | 72.6 ± 2.9 | 0.62 | – | – |
| volt-archon-pit | guionado | expectimax prof. 1 | 2.65 ± 0.42 | 0 % ± 2 | 44.5 ± 3.8 | 0.76 | 30 | 0.11 |
| volt-archon-pit | guionado | expectimax prof. 2 | 2.69 ± 0.42 | 0 % ± 2 | 43.9 ± 3.7 | 0.77 | 275 | 0.76 |
| volt-archon-pit | guionado | expectimax prof. 3 | 2.69 ± 0.41 | 0 % ± 2 | 43.4 ± 3.6 | 0.77 | 1913 | 4.55 |
| volt-archon-pit | guionado | MCTS 64 it. | 3.79 ± 0.58 | 0 % ± 2 | 34.3 ± 2.6 | 0.82 | 128 | 0.47 |
| volt-archon-pit | guionado | MCTS 256 it. | 3.89 ± 0.66 | 0 % ± 2 | 37.3 ± 3.3 | 0.80 | 512 | 1.25 |
| volt-archon-pit | guionado | MCTS 1024 it. | 3.86 ± 0.60 | 0 % ± 2 | 36.1 ± 3.5 | 0.81 | 2048 | 3.88 |
| volt-archon-pit | aleatorio | regla original | 2.04 ± 0.29 | 0 % ± 2 | 69.3 ± 4.2 | 0.97 | – | – |
| volt-archon-pit | aleatorio | expectimax prof. 1 | 4.46 ± 0.85 | 0 % ± 2 | 39.3 ± 4.3 | 0.98 | 30 | 0.14 |
| volt-archon-pit | aleatorio | expectimax prof. 2 | 4.49 ± 0.85 | 0 % ± 2 | 37.9 ± 4.0 | 0.98 | 265 | 0.76 |
| volt-archon-pit | aleatorio | expectimax prof. 3 | 4.55 ± 0.85 | 0 % ± 2 | 38.0 ± 4.1 | 0.98 | 1839 | 4.22 |
| volt-archon-pit | aleatorio | MCTS 64 it. | 5.90 ± 0.93 | 0 % ± 2 | 32.2 ± 4.0 | 0.99 | 128 | 0.51 |
| volt-archon-pit | aleatorio | MCTS 256 it. | 5.21 ± 0.91 | 0 % ± 2 | 36.6 ± 4.1 | 0.98 | 512 | 1.25 |
| volt-archon-pit | aleatorio | MCTS 1024 it. | 4.73 ± 0.91 | 0 % ± 2 | 38.2 ± 4.3 | 0.98 | 2048 | 4.04 |
| bloom-warden-pit | guionado | regla original | 2.46 ± 0.40 | 0 % ± 2 | 45.0 ± 3.2 | 0.73 | – | – |
| bloom-warden-pit | guionado | expectimax prof. 1 | 1.30 ± 0.26 | 0 % ± 2 | 47.0 ± 3.1 | 0.69 | 40 | 0.14 |
| bloom-warden-pit | guionado | expectimax prof. 2 | 1.31 ± 0.25 | 0 % ± 2 | 46.6 ± 3.1 | 0.70 | 425 | 1.08 |
| bloom-warden-pit | guionado | expectimax prof. 3 | 1.34 ± 0.27 | 0 % ± 2 | 46.3 ± 3.0 | 0.70 | 3115 | 6.50 |
| bloom-warden-pit | guionado | MCTS 64 it. | 2.40 ± 0.44 | 0 % ± 2 | 40.9 ± 3.1 | 0.74 | 128 | 0.52 |
| bloom-warden-pit | guionado | MCTS 256 it. | 1.50 ± 0.28 | 0 % ± 2 | 49.3 ± 3.4 | 0.69 | 512 | 1.33 |
| bloom-warden-pit | guionado | MCTS 1024 it. | 1.30 ± 0.26 | 0 % ± 2 | 49.6 ± 2.8 | 0.69 | 2048 | 4.08 |
| bloom-warden-pit | aleatorio | regla original | 3.23 ± 0.50 | 0 % ± 2 | 42.2 ± 4.4 | 0.98 | – | – |
| bloom-warden-pit | aleatorio | expectimax prof. 1 | 3.15 ± 0.56 | 0 % ± 2 | 38.2 ± 3.7 | 0.98 | 40 | 0.14 |
| bloom-warden-pit | aleatorio | expectimax prof. 2 | 3.22 ± 0.58 | 0 % ± 2 | 38.6 ± 3.8 | 0.98 | 391 | 0.95 |
| bloom-warden-pit | aleatorio | expectimax prof. 3 | 3.06 ± 0.56 | 0 % ± 2 | 40.1 ± 3.8 | 0.98 | 2799 | 5.58 |
| bloom-warden-pit | aleatorio | MCTS 64 it. | 4.38 ± 0.81 | 0 % ± 2 | 34.8 ± 3.9 | 0.98 | 128 | 0.50 |
| bloom-warden-pit | aleatorio | MCTS 256 it. | 3.44 ± 0.61 | 0 % ± 2 | 38.2 ± 3.8 | 0.98 | 512 | 1.27 |
| bloom-warden-pit | aleatorio | MCTS 1024 it. | 2.99 ± 0.53 | 0 % ± 2 | 40.7 ± 4.0 | 0.98 | 2048 | 3.93 |
| ash-judge-seal | guionado | regla original | 3.43 ± 0.56 | 5 % ± 5 | 39.1 ± 1.9 | 0.33 | – | – |
| ash-judge-seal | guionado | expectimax prof. 1 | 1.43 ± 0.30 | 24 % ± 8 | 46.1 ± 2.2 | 0.20 | 40 | 0.13 |
| ash-judge-seal | guionado | expectimax prof. 2 | 1.49 ± 0.30 | 23 % ± 8 | 45.3 ± 2.3 | 0.21 | 417 | 0.91 |
| ash-judge-seal | guionado | expectimax prof. 3 | 1.63 ± 0.32 | 24 % ± 8 | 45.1 ± 2.4 | 0.22 | 3025 | 5.76 |
| ash-judge-seal | guionado | MCTS 64 it. | 2.74 ± 0.48 | 10 % ± 6 | 38.3 ± 2.6 | 0.34 | 128 | 0.51 |
| ash-judge-seal | guionado | MCTS 256 it. | 1.99 ± 0.36 | 22 % ± 8 | 42.4 ± 2.6 | 0.27 | 512 | 1.29 |
| ash-judge-seal | guionado | MCTS 1024 it. | 1.80 ± 0.33 | 26 % ± 8 | 44.6 ± 2.7 | 0.23 | 2048 | 3.99 |
| ash-judge-seal | aleatorio | regla original | 2.25 ± 0.32 | 0 % ± 2 | 58.5 ± 5.0 | 0.96 | – | – |
| ash-judge-seal | aleatorio | expectimax prof. 1 | 1.84 ± 0.31 | 0 % ± 2 | 54.0 ± 3.8 | 0.97 | 40 | 0.13 |
| ash-judge-seal | aleatorio | expectimax prof. 2 | 1.96 ± 0.37 | 0 % ± 2 | 52.2 ± 3.7 | 0.97 | 384 | 0.87 |
| ash-judge-seal | aleatorio | expectimax prof. 3 | 1.91 ± 0.39 | 0 % ± 2 | 54.5 ± 3.8 | 0.97 | 2773 | 5.55 |
| ash-judge-seal | aleatorio | MCTS 64 it. | 3.30 ± 0.51 | 0 % ± 2 | 42.2 ± 4.5 | 0.97 | 128 | 0.49 |
| ash-judge-seal | aleatorio | MCTS 256 it. | 2.39 ± 0.45 | 0 % ± 2 | 52.3 ± 4.0 | 0.97 | 512 | 1.35 |
| ash-judge-seal | aleatorio | MCTS 1024 it. | 1.96 ± 0.33 | 0 % ± 2 | 53.2 ± 4.3 | 0.97 | 2048 | 4.27 |

## Diferencia pareada: MCTS 256 it. menos la mejor profundidad de expectimax en cada celda

Mismas semillas; media ± IC95. En "daño", positivo es que MCTS presiona más; en "ritmo", negativo es que MCTS se acerca más a la meta.
Ojo: escoger "la mejor profundidad" con los mismos datos favorece un poco a expectimax.

| Objetivo | Jefe | Jugador | Contra | Diferencia |
|---|---|---|---|---|
| daño | volt-archon-pit | guionado | expectimax prof. 1 | -0.98 ± 0.53 |
| daño | volt-archon-pit | aleatorio | expectimax prof. 1 | 0.15 ± 0.51 |
| daño | bloom-warden-pit | guionado | expectimax prof. 1 | -1.66 ± 0.54 |
| daño | bloom-warden-pit | aleatorio | expectimax prof. 1 | -1.68 ± 0.65 |
| daño | ash-judge-seal | guionado | expectimax prof. 1 | -1.15 ± 0.50 |
| daño | ash-judge-seal | aleatorio | expectimax prof. 2 | -0.74 ± 0.50 |
| ritmo 4 | volt-archon-pit | guionado | expectimax prof. 1 | 1.24 ± 0.54 |
| ritmo 4 | volt-archon-pit | aleatorio | expectimax prof. 1 | 0.75 ± 0.56 |
| ritmo 4 | bloom-warden-pit | guionado | expectimax prof. 1 | 0.20 ± 0.32 |
| ritmo 4 | bloom-warden-pit | aleatorio | expectimax prof. 3 | 0.38 ± 0.49 |
| ritmo 4 | ash-judge-seal | guionado | expectimax prof. 1 | 0.56 ± 0.39 |
| ritmo 4 | ash-judge-seal | aleatorio | expectimax prof. 1 | 0.55 ± 0.49 |

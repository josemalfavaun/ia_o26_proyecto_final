# Benchmark M4: Q-learning tabular jerárquico

Estados: 1620; macros: 6; decisión cada 160 ms. Semillas de prueba: 100 (10001 en adelante), distintas de las de entrenamiento (desde 1) y de validación (5001 a 5020). Dificultad: standard.

Hiperparámetros base: {"alpha":0.1,"gamma":0.98,"epsilonStart":0.5,"epsilonEnd":0.05,"killReward":20,"bossDamageReward":40,"damagePenaltyPerHp":0.25,"stepPenalty":0.05,"clearReward":60,"deathPenalty":40}. La variante "agresiva" cambia: {"damagePenaltyPerHp":0.1,"bossDamageReward":100,"stepPenalty":0.02}.

## Nivel 1 (access-node)

Entrenamiento: 1500 episodios (enemigos del nivel). Estados visitados: 214 de 1620.

### Curva de aprendizaje (política voraz en 20 semillas de validación)

| Episodio de entrenamiento | Gana | Daño recibido | Duración (s) |
|---|---|---|---|
| 0 (tabla en ceros) | 0 % | 0.0 | 90.0 |
| 187 | 100 % | 0.0 | 20.2 |
| 374 | 100 % | 1.8 | 19.9 |
| 561 | 100 % | 0.0 | 17.1 |
| 748 | 100 % | 9.7 | 18.1 |
| 935 | 35 % | 3.8 | 63.9 |
| 1122 | 100 % | 1.8 | 17.4 |
| 1309 | 100 % | 3.5 | 19.9 |
| 1496 | 100 % | 34.2 | 20.9 |
| 1500 | 100 % | 2.1 | 19.5 |

### Prueba en 100 semillas no vistas

| Bot | Gana | Muere | Tiempo agotado | Daño recibido (media ± IC95) | Duración s (media ± IC95) |
|---|---|---|---|---|---|
| quieto | 0 % ± 2 | 34 % ± 9 | 66 % ± 9 | 36.2 ± 9.7 | 69.6 ± 5.8 |
| aleatorio | 0 % ± 2 | 60 % ± 9 | 40 % ± 9 | 86.4 ± 5.2 | 63.9 ± 5.3 |
| guionado | 100 % ± 2 | 0 % ± 2 | 0 % ± 2 | 0.8 ± 0.5 | 26.5 ± 1.1 |
| q-learning | 100 % ± 2 | 0 % ± 2 | 0 % ± 2 | 1.6 ± 0.8 | 18.8 ± 0.5 |

Diferencia pareada por semilla, q-learning menos guionado (media ± IC95; negativo = mejor para q-learning en estas tres):

- Daño recibido: 0.82 ± 0.85
- Duración (s): -7.66 ± 1.24

## Jefe 1 (volt-archon-pit), recompensa prudente

Entrenamiento: 4000 episodios (el jefe es el rival). Estados visitados: 402 de 1620.

### Curva de aprendizaje (política voraz en 20 semillas de validación)

| Episodio de entrenamiento | Gana | Daño recibido | Duración (s) |
|---|---|---|---|
| 0 (tabla en ceros) | 0 % | 128.7 | 15.1 |
| 500 | 10 % | 105.8 | 62.3 |
| 1000 | 20 % | 96.3 | 73.5 |
| 1500 | 5 % | 90.5 | 62.9 |
| 2000 | 5 % | 85.8 | 73.9 |
| 2500 | 10 % | 59.5 | 80.1 |
| 3000 | 20 % | 40.3 | 84.6 |
| 3500 | 0 % | 61.0 | 66.4 |
| 4000 | 15 % | 35.3 | 85.8 |

### Prueba en 100 semillas no vistas

| Bot | Gana | Muere | Tiempo agotado | Daño recibido (media ± IC95) | Duración s (media ± IC95) | Vida restante del jefe (media ± IC95) |
|---|---|---|---|---|---|---|
| quieto | 0 % ± 2 | 99 % ± 3 | 1 % ± 3 | 132.3 ± 5.4 | 16.1 ± 1.7 | 1.00 ± 0.00 |
| aleatorio | 0 % ± 2 | 60 % ± 9 | 40 % ± 9 | 86.6 ± 5.8 | 69.3 ± 4.2 | 0.97 ± 0.00 |
| guionado | 0 % ± 2 | 82 % ± 7 | 18 % ± 7 | 105.0 ± 3.5 | 72.6 ± 2.9 | 0.62 ± 0.02 |
| q-learning | 8 % ± 5 | 13 % ± 7 | 79 % ± 8 | 36.5 ± 7.9 | 83.3 ± 3.2 | 0.58 ± 0.06 |

Diferencia pareada por semilla, q-learning menos guionado (media ± IC95; negativo = mejor para q-learning en estas tres):

- Daño recibido: -68.49 ± 8.69
- Duración (s): 10.66 ± 4.72
- Vida restante del jefe: -0.04 ± 0.06

## Jefe 1 (volt-archon-pit), recompensa agresiva

Entrenamiento: 4000 episodios (el jefe es el rival). Estados visitados: 307 de 1620.

### Curva de aprendizaje (política voraz en 20 semillas de validación)

| Episodio de entrenamiento | Gana | Daño recibido | Duración (s) |
|---|---|---|---|
| 0 (tabla en ceros) | 0 % | 128.7 | 15.1 |
| 500 | 5 % | 121.3 | 36.9 |
| 1000 | 5 % | 137.6 | 51.7 |
| 1500 | 0 % | 107.7 | 33.8 |
| 2000 | 20 % | 109.5 | 61.8 |
| 2500 | 10 % | 110.3 | 62.3 |
| 3000 | 10 % | 104.1 | 69.9 |
| 3500 | 30 % | 109.0 | 52.6 |
| 4000 | 15 % | 103.3 | 58.9 |

### Prueba en 100 semillas no vistas

| Bot | Gana | Muere | Tiempo agotado | Daño recibido (media ± IC95) | Duración s (media ± IC95) | Vida restante del jefe (media ± IC95) |
|---|---|---|---|---|---|---|
| quieto | 0 % ± 2 | 99 % ± 3 | 1 % ± 3 | 132.3 ± 5.4 | 16.1 ± 1.7 | 1.00 ± 0.00 |
| aleatorio | 0 % ± 2 | 60 % ± 9 | 40 % ± 9 | 86.6 ± 5.8 | 69.3 ± 4.2 | 0.97 ± 0.00 |
| guionado | 0 % ± 2 | 82 % ± 7 | 18 % ± 7 | 105.0 ± 3.5 | 72.6 ± 2.9 | 0.62 ± 0.02 |
| q-learning | 3 % ± 4 | 49 % ± 10 | 48 % ± 10 | 89.3 ± 8.5 | 63.9 ± 5.5 | 0.46 ± 0.04 |

Diferencia pareada por semilla, q-learning menos guionado (media ± IC95; negativo = mejor para q-learning en estas tres):

- Daño recibido: -15.73 ± 8.47
- Duración (s): -8.66 ± 6.35
- Vida restante del jefe: -0.17 ± 0.04


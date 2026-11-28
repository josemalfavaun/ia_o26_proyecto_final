# Benchmark del acechador (estilo Alien: Isolation)

Arena de escondidas con el mapa real de cada nivel (puertas abiertas), 120 s por episodio, pasos de 50 ms.
Semillas 10001 a 10100 (100), las mismas para los cuatro modos; corridas una sola vez.
Parámetros fijados antes de medir; en el desarrollo solo se usaron las semillas 1 a 20. Media ± IC95.

- **Reencuentro**: tiempo medio entre perder de vista al bot y volver a verlo; si la búsqueda no termina, cuenta hasta el final.
- **Ciclos de tensión**: veces que el medidor de amenaza llega al tope después de haber bajado a 0.3 o menos.
- El medidor se calcula igual en los cuatro modos, pero solo actúa (pistas y retiradas) en "partículas + director".

| Nivel | Modo | Reencuentro, s (menos es mejor) | Contacto visual | Atrapadas por minuto | Ciclos de tensión | Tiempo con amenaza ≥ 0.9 | Pistas | Retiradas |
|---|---|---|---|---|---|---|---|---|
| access-node | regla original (mira la posición real 4.2 s) | 10.7 ± 1.9 | 4.6 ± 0.6 % | 1.83 ± 0.22 | 1.02 ± 0.16 | 6.7 ± 1.5 % | 0.0 | 0.0 |
| access-node | última posición vista | 11.6 ± 1.2 | 4.4 ± 0.7 % | 1.57 ± 0.15 | 0.75 ± 0.16 | 3.6 ± 1.0 % | 0.0 | 0.0 |
| access-node | filtro de partículas | 8.3 ± 0.8 | 5.8 ± 0.7 % | 2.43 ± 0.21 | 1.07 ± 0.15 | 7.4 ± 1.4 % | 0.0 | 0.0 |
| access-node | partículas + director | 6.5 ± 0.4 | 7.5 ± 0.8 % | 2.83 ± 0.19 | 1.43 ± 0.14 | 8.8 ± 1.3 % | 11.1 | 1.0 |
| glass-cistern | regla original (mira la posición real 4.2 s) | 3.7 ± 0.2 | 9.7 ± 0.7 % | 8.16 ± 0.49 | 1.30 ± 0.09 | 51.7 ± 2.6 % | 0.0 | 0.0 |
| glass-cistern | última posición vista | 5.6 ± 0.3 | 7.2 ± 0.7 % | 2.87 ± 0.19 | 1.35 ± 0.12 | 18.3 ± 2.0 % | 0.0 | 0.0 |
| glass-cistern | filtro de partículas | 3.8 ± 0.2 | 10.8 ± 0.8 % | 5.24 ± 0.26 | 1.15 ± 0.07 | 40.4 ± 1.9 % | 0.0 | 0.0 |
| glass-cistern | partículas + director | 4.2 ± 0.3 | 13.2 ± 1.2 % | 1.90 ± 0.17 | 1.95 ± 0.12 | 28.2 ± 2.3 % | 4.4 | 1.8 |
| relay-catacomb | regla original (mira la posición real 4.2 s) | 8.2 ± 1.0 | 6.4 ± 0.6 % | 2.85 ± 0.30 | 1.44 ± 0.14 | 16.6 ± 2.3 % | 0.0 | 0.0 |
| relay-catacomb | última posición vista | 11.5 ± 1.2 | 5.1 ± 0.6 % | 1.53 ± 0.16 | 0.90 ± 0.14 | 5.5 ± 1.2 % | 0.0 | 0.0 |
| relay-catacomb | filtro de partículas | 8.2 ± 0.8 | 7.2 ± 0.7 % | 2.25 ± 0.20 | 1.22 ± 0.15 | 12.2 ± 2.1 % | 0.0 | 0.0 |
| relay-catacomb | partículas + director | 7.3 ± 0.5 | 7.6 ± 0.7 % | 2.25 ± 0.19 | 1.66 ± 0.16 | 10.6 ± 1.6 % | 10.5 | 1.3 |

## Diferencias pareadas (mismas semillas)

| Nivel | Reencuentro: partículas − última vista (s) | Reencuentro: partículas − regla original (s) | Ciclos: director − partículas | Amenaza ≥ 0.9: director − partículas (puntos %) | Atrapadas/min: director − partículas |
|---|---|---|---|---|---|
| access-node | -3.33 ± 1.40 | -2.43 ± 2.10 | 0.36 ± 0.21 | 1.41 ± 1.75 | 0.40 ± 0.25 |
| glass-cistern | -1.80 ± 0.39 | 0.05 ± 0.26 | 0.80 ± 0.14 | -12.20 ± 3.09 | -3.34 ± 0.32 |
| relay-catacomb | -3.26 ± 1.44 | 0.01 ± 1.31 | 0.44 ± 0.22 | -1.64 ± 2.77 | 0.00 ± 0.26 |

# Acechador estilo Alien: Isolation

Código: `src/ai/stalker/` (`belief.ts`, `brain.ts`, `manager.ts`, `arena.ts`). Benchmark: `npm run bench:acechador` →
`resultados/bench-acechador.md` y `bench-acechador.csv`. Pruebas: `src/tests/ai-stalker.test.ts`.

## La idea

En Alien: Isolation el alien funciona con dos IA. Un **director** (macro) siempre sabe dónde está el jugador y lleva un
medidor de amenaza: cuando la presencia del alien ha sido intensa, lo manda lejos (a otra zona o a los ductos) para dar
alivio, y cuando lleva rato lejos, lo manda hacia la zona general del jugador, nunca a su posición exacta. El **alien**
(micro) no hace trampa: tiene que encontrar al jugador con lo que ve y oye. Aquí se hizo una versión chica de esa idea
para los enemigos `STALKER` del juego. No se copió el árbol de comportamiento de más de 100 nodos del original.

## Las dos IA

**Acechador (micro): filtro de partículas.** 300 partículas, cada una es una hipótesis "el jugador está aquí".

- *Predicción*: cada 200 ms las partículas caminan al azar por celdas libres a 2.5 celdas/s (lo que se supone que se
  mueve el jugador).
- *Observación negativa*: las partículas que el acechador vería (a 10.5 celdas o menos y con línea de vista, con el mismo
  `castRay` del juego) se descartan y se remuestrea copiando sobrevivientes. Es un filtro bayesiano con verosimilitud
  0/1: si el jugador estuviera en una celda visible, lo vería.
- *Observaciones positivas*: verlo colapsa la nube en su posición; oír un disparo (a 14 celdas o menos) mueve 60 % de la
  nube cerca del disparo.
- El acechador va, con A\*, a la celda con más creencia (sumando sus 8 vecinas).

**Director (macro): medidor de amenaza.** Sube 0.22 por segundo viendo al jugador, 0.05 por segundo a menos de 5 celdas,
y 0.35 de golpe cuando el acechador lo alcanza; baja 0.06 por segundo lejos.

- Al llegar a 1, el acechador **se retira** a una celda a 10 celdas o más del jugador y, mientras dura la retirada,
  lo ignora aunque lo vea. La retirada termina cuando la amenaza baja a 0.3.
- Si lleva 6 s sin contacto (y sin pista), el director le da una **pista**: mueve la mitad de la nube a un punto con
  ruido de ±2.5 celdas alrededor del jugador. El director sí conoce la posición real; el acechador nunca la recibe.

## Cómo se midió

Una arena de escondidas (`arena.ts`) con el mapa real de tres niveles (puertas abiertas), 120 s por episodio. Un bot que
se esconde deambula, huye a una celda fuera de vista cuando ve al acechador cerca y le dispara a 6 celdas o menos. Si el
acechador lo alcanza, cuenta una atrapada y el bot reaparece lejos y fuera de vista. Cuatro modos del acechador con las
mismas semillas:

| Modo | Qué hace al perder de vista al bot |
|---|---|
| regla original | Lo que hace el juego base: durante 4.2 s va a la posición **real** del bot (el juego actualiza la "última posición conocida" con la verdadera mientras dura la memoria); después patrulla |
| última posición vista | Va a donde lo vio por última vez, sin trampa; al llegar, patrulla |
| filtro de partículas | La creencia de arriba, sin director |
| partículas + director | La creencia más pistas y retiradas |

Los parámetros se fijaron antes de medir; en el desarrollo se usaron las semillas 1 a 20. La prueba usa las semillas
10001 a 10100 (100). **Se corrió dos veces**: la segunda, después de corregir un error de implementación (el director
daba la primera pista en el primer instante en lugar de esperar 6 s sin contacto). No se cambió ningún parámetro entre
corridas y las conclusiones no cambiaron. Las tablas son las de la segunda.

## Resultados (100 semillas; diferencias pareadas, media ± IC95)

**El filtro de partículas encuentra más rápido que la memoria honesta.** El tiempo medio para volver a ver al bot baja
contra "última posición vista" en los tres niveles: −3.3 ± 1.4 s (access-node), −1.8 ± 0.4 s (glass-cistern) y −3.3 ± 1.4 s
(relay-catacomb). Contra la regla original del juego, que espía la posición real, **empata** en glass-cistern
(+0.05 ± 0.26) y relay-catacomb (+0.01 ± 1.31) y gana en access-node (−2.4 ± 2.1). Sin hacer trampa, iguala a la regla
que sí la hace.

**El director crea ciclos de tensión y alivio.** Ciclos (el medidor llega al tope después de haber bajado a 0.3):
+0.36 ± 0.21, +0.80 ± 0.14 y +0.44 ± 0.22 por episodio contra el filtro sin director. El efecto sobre la tensión
sostenida depende del nivel:

- glass-cistern, donde la amenaza se quedaba pegada arriba (40 % del tiempo en 0.9 o más con el filtro y 52 % con la regla
  original): el director la baja 12.2 ± 3.1 puntos y las atrapadas por minuto caen de 5.2 a 1.9.
- access-node: las pistas hacen que el acechador encuentre más (atrapadas +0.40 ± 0.25 por minuto); el tiempo con amenaza
  alta no cambia de forma significativa (+1.4 ± 1.8).
- relay-catacomb: sin diferencia en tiempo alto ni en atrapadas.

Tabla completa: [`resultados/bench-acechador.md`](../resultados/bench-acechador.md).

## En el juego

Tecla `U`: regla original → A\* → **A\* + acechador**. También `?ia=acechador`. En ese modo todos los enemigos navegan
con A\* y, además, cada `STALKER` vivo tiene su cerebro. El enganche es un modificador opcional del sistema de enemigos
(`searchGoal` en `RaycastEnemySystem.ts`): solo actúa cuando el enemigo no tiene detectado al jugador (o durante una
retirada), y sin él el sistema se comporta exactamente igual (lo verifican las pruebas de siempre). Con el panel abierto
(`I`), el minimapa pinta la nube de partículas (magenta; azul durante una retirada) y el panel muestra la barra de amenaza,
la fase, las pistas y las retiradas de cada acechador. El nivel 1 (`access-node`) tiene dos.

## Límites

- La arena no es el juego: no hay daño, armas, otros enemigos ni el oído "a través de paredes" del juego (que detecta al
  jugador a 7 celdas aunque haya una pared). En el juego, cuando ese oído lo detecta, el `STALKER` persigue con la regla
  de siempre y el filtro no interviene.
- El bot que se esconde es simple. Contra personas, que se esconden mejor, el resultado puede cambiar.
- Las pistas del director usan la posición real del jugador (con ruido). Es parte del diseño de Alien, pero significa que
  "partículas + director" no es una búsqueda sin información privilegiada; la comparación honesta de búsqueda es
  "filtro de partículas" contra "última posición vista".
- Ciclos de tensión y tiempo con amenaza alta son medidas de diseño, no de diversión: que la curva suba y baje no
  demuestra que la experiencia sea mejor. Eso solo se puede saber con personas.
- Los parámetros (velocidades, tasas del medidor, ruido de la pista) son decisiones, no se ajustaron.

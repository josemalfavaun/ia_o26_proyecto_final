# MCTS con UCT para el jefe

Cierra el hueco del plan de M2 ("expectimax y después MCTS como comparación"). Código: `src/ai/mcts/policy.ts`.
Benchmark: `npm run bench:mcts` → `resultados/bench-mcts.md`, `bench-mcts.csv` y `bench-mcts-ajuste.csv`.

## Qué hace

El jefe elige su siguiente salva buscando sobre **el mismo modelo del duelo que expectimax**
(`src/ai/expectimax/model.ts`), con el mismo modelo del jugador (cinco maniobras con probabilidad de persistencia) y el
mismo objetivo (`damage` o `pacing`). Esas piezas compartidas viven en `src/ai/expectimax/objective.ts`. Se verificó que
extraerlas no cambia expectimax: `bench:boss` con 4 semillas da un CSV idéntico byte por byte antes y después.

Cada decisión hace un número fijo de iteraciones:

1. **Selección.** Desde la raíz baja eligiendo el ataque con UCT, Q̄(k) + c · sqrt(ln N / n(k)), con Q̄ normalizado a
   [0, 1] con el mínimo y el máximo de los retornos vistos en esa decisión (los puntajes de ritmo son negativos y no
   están acotados).
2. **Expansión.** Agrega un ataque que aún no se probó en ese nodo.
3. **Simulación.** Completa el horizonte con ataques al azar.
4. **Retropropagación.** Cada nodo suma el retorno descontado (γ = 0.8, el mismo de expectimax) desde su salva en adelante.

En cada salva la respuesta del jugador **se sortea** con P(r | s), en lugar de promediar las cinco como hace expectimax.
Por eso es MCTS de **lazo abierto** (open-loop): un nodo es la secuencia de ataques del jefe, no un estado, y el estado
se recalcula en cada iteración desde la raíz. Al final se lanza el ataque **más visitado**.

## Protocolo de medición

- **Ajuste** (semillas 1 a 20, jugador guionado, 256 iteraciones, solo presión): rejilla c ∈ {0.3, 0.7, 1.4} ×
  horizonte ∈ {2, 4, 6}, por objetivo. Se eligió c = 1.4 y horizonte 2 para los dos objetivos.
- **Prueba** (semillas 10001 a 10100, una sola vez): regla original, expectimax de profundidad 1, 2 y 3, y MCTS con 64,
  256 y 1024 iteraciones; tres jefes; jugador guionado y aleatorio; objetivo daño y ritmo 4.

## Resultados (prueba, 100 semillas)

**Resultado negativo: MCTS no le gana a expectimax en ninguna celda.**

Diferencia pareada, MCTS con 256 iteraciones menos la mejor profundidad de expectimax en esa celda (media ± IC95):

| Objetivo | Celdas donde MCTS es peor (IC sin el 0) | Celdas sin diferencia | Rango de la diferencia |
|---|---|---|---|
| Daño por salva (más es más duro) | 5 de 6 | 1 de 6 (volt-archon, aleatorio: +0.15 ± 0.51) | −0.74 a −1.68 |
| Error de ritmo contra 4 (menos es mejor) | 4 de 6 | 2 de 6 (bloom-warden, los dos jugadores) | +0.20 a +1.24 |

Costo por decisión (evaluaciones del modelo, la misma unidad para las dos búsquedas):

| Política | Evaluaciones | ms (esta computadora) |
|---|---|---|
| expectimax prof. 1 | 30 a 40 | 0.1 |
| expectimax prof. 3 | 930 a 3,115 | 3 a 6.5 |
| MCTS 256 it., horizonte 2 | 512 | 1.3 |
| MCTS 1024 it., horizonte 2 | 2,048 | 4 |

- **Con más presupuesto, MCTS se acerca a expectimax, pero no lo supera.** Con 1024 iteraciones empata en ritmo en
  bloom-warden (1.30 contra 1.30 con el guionado; 2.99 contra 3.06 con el aleatorio) y sigue abajo en los demás casos.
  Es lo esperado: con presupuesto infinito, MCTS converge al mismo valor que el árbol exacto.
- **Por qué pierde aquí.** Expectimax de profundidad 1, 2 y 3 da prácticamente lo mismo (ya estaba en M2): en este duelo
  mirar más adelante no aporta, porque la salva de ahora casi no cambia dónde estará el jugador después. Con 6 a 8
  ataques y 5 respuestas, recorrer el árbol completo de una salva cuesta 30 a 40 evaluaciones, y eso es imbatible.
  La ventaja de MCTS (gastar la búsqueda en las ramas prometedoras de un árbol enorme y profundo) no aplica, y sortear la
  respuesta del jugador en lugar de promediarla le agrega ruido.
- **El ajuste no distinguió nada.** En la rejilla de ajuste, todas las combinaciones de c y horizonte quedan dentro del
  mismo intervalo de confianza (daño 10.6 a 11.4 ± 1.3; error de ritmo 1.9 a 2.5 ± 0.5). La elección c = 1.4, horizonte 2
  es en la práctica ruido, y c = 1.4 está en el borde de la rejilla.

## En el juego

Tecla `O`: regla original → expectimax → **MCTS** → bandido. También `?ia=mcts`. El modo MCTS usa ritmo 4 (como el
modo expectimax), 256 iteraciones, horizonte 2 y c = 1.4. El panel (`I`) muestra la decisión, las iteraciones y las
visitas de las tres ramas más buscadas; en el navegador del contenedor de pruebas costó entre 6 y 8 ms por decisión
con render por software.

## Límites

- Mismo modelo y mismos bots que M2: comparte su circularidad (el modelo del jugador se calibró contra el simulador).
- Una sola rejilla de ajuste, chica; no se probó c > 1.4 ni otras formas de normalizar.
- No se probó MCTS sobre el simulador completo (M0) en vez del modelo abstracto; con el modelo abstracto la comparación
  contra expectimax es justa, que era el objetivo.

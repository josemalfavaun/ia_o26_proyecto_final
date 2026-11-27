# M4: bot jugador con Q-learning

Un agente que aprende a jugar dentro del simulador (M0) por ensayo y error. No se conecta al juego: es una pieza de
medición, como los bots de referencia.

## Diseño

**Jerárquico.** El Q-learning no mueve el teclado; elige una de 6 acciones de alto nivel ("macros") cada 8 pasos de
simulación (160 ms) y un controlador fijo las traduce a movimiento, giro y disparo. El controlador apunta y recarga solo.
Lo que se aprende es *cuándo* avanzar, rodear, retroceder o esquivar.

| Macro | Qué hace el controlador |
|---|---|
| sostener | Se queda donde está, apunta y dispara |
| avanzar | Ruta hacia el objetivo (A\* sobre la cuadrícula) |
| rodear-izq / rodear-der | Avanza girando alrededor del objetivo por ese lado |
| retroceder | Se aleja del objetivo más cercano |
| esquivar | Se mueve perpendicular a la amenaza (el mismo cálculo del bot guionado) |

**Estado discretizado: 1 620 estados** = distancia al objetivo (5) × línea de tiro (2) × alineación de la mira (3) ×
vida (3) × munición (3) × amenaza cercana (2) × enemigos cerca (3). Tabla de 1 620 × 6 valores.

**Recompensa.** Matar un enemigo +20, daño al jefe ×40 (por fracción de su vida), −0.25 por punto de vida perdido, −0.05
por decisión, +60 al limpiar el nivel, −40 al morir. Todo está en `DEFAULT_Q_HYPER` (`src/ai/qlearn/agent.ts`).

**Aprendizaje.** Q-learning tabular de un paso, α = 0.1, γ = 0.98, ε-voraz con ε de 0.5 a 0.05 (decae lineal en los
episodios). Entrenamiento con semillas 1, 2, 3…; validación con 5001–5020 (para la curva); prueba con 10001–10100 (los
números del informe). Las tres listas no se cruzan. El entrenamiento es determinista: misma semilla, misma tabla (hay
prueba).

## Resultados (100 semillas no vistas, dificultad estándar)

Salen de `npm run bench:qlearn`; el detalle completo, con las curvas, está en `resultados/bench-qlearn.md`.

**Nivel 1.** q-learning gana el 100 % (IC95 ± 2) con 1.6 ± 0.8 de daño y 18.8 s de duración; el bot guionado gana el 100 %
con 0.8 ± 0.5 de daño y 26.5 s. Diferencia pareada: q-learning termina 7.7 ± 1.2 s antes y recibe 0.8 ± 0.9 más de daño.
**Este nivel es demasiado fácil para decir que "aprendió"**: la curva ya está en 100 % desde el episodio 187, y
hasta el bot guionado lo gana siempre. Lo único que se aprecia es que aprende a ser más rápido.

**Jefe 1 (volt-archon-pit), recompensa prudente.** Ni el guionado ni el azar le ganan al jefe (0 %). q-learning gana
el 8 % (± 5), muere el 13 % y en el 79 % llega al límite de tiempo vivo. Recibe 36.5 ± 7.9 de daño contra 105.0 ± 3.5 del
guionado (diferencia pareada −68.5 ± 8.7). Vida restante del jefe: 0.58 ± 0.06 contra 0.62 ± 0.02 del guionado,
diferencia que **no es significativa** (−0.04 ± 0.06). En resumen: aprendió a **sobrevivir** (recibe un tercio del daño);
no aprendió a **vencer** al jefe.

**Jefe 1, recompensa agresiva** (castigo por daño más bajo, premio por daño al jefe más alto). Gana 3 % (± 4), muere 49 %
y deja al jefe en 0.46 ± 0.04 de vida (diferencia pareada con el guionado: −0.17 ± 0.04, sí significativa). Hace más daño
al jefe pero se muere mucho más.

**Lectura honesta.** La forma de la recompensa decide qué se aprende: la prudente produce un agente que se esconde bien, la
agresiva uno que ataca y cae. Ninguna de las dos le gana al jefe de forma sólida. La curva de aprendizaje del jefe es
ruidosa (validación con solo 20 semillas, el porcentaje de victoria salta entre 0 y 30 % de un punto a otro): se ve una
tendencia a recibir menos daño con la recompensa prudente (de 128.7 a 35.3), no una convergencia limpia.

## Límites

1. Tabla discreta de 1 620 estados: pierde información (por ejemplo, la forma exacta de los patrones de ataque).
2. Con 4 000 episodios no se agotó el espacio de estados: visitó 402 de 1 620 en la prueba prudente y 307 en la agresiva.
3. No se hizo barrido de hiperparámetros ni varias repeticiones del entrenamiento con semillas distintas; cada
   configuración se entrenó **una** vez. Las diferencias entre configuraciones no incluyen la varianza del propio
   entrenamiento.
4. Los resultados valen para el simulador, que es más fácil que el juego (ver el informe, límites globales).
5. No es una red neuronal ni usa aproximación de funciones: es la versión de tabla que se vio en clase.

## Reproducir

```bash
npm run bench:qlearn                  # completo, unos 4 minutos
npm run bench:qlearn -- --scale 0.1   # prueba rápida con el 10 % de los episodios
```

# Evidencia del 25 de noviembre de 2026

Todo lo de abajo se corrió sobre el código de esta carpeta. Los comandos son los de `README.md`.

## 1. Barrido de arranque en frío

Cada ruta se probó con la página recargada y la consola abierta (Chrome, servidor de desarrollo de Vite).

| Ruta | Resultado |
|---|---|
| Menú, `A`, prólogo, tutorial, nivel 1 | Sin errores |
| Atajo `7` (jefe 1), `8` (jefe 2), `9` (jefe 3), `6` (nivel 10) | Sin errores |
| Atajo a la derecha del `0` (escena final) | Corre la animación completa desde el inicio |
| `S` (configuración) y Escape de vuelta al menú | Sin errores |
| `M` (multijugador) | Abre un `window.prompt` del navegador pidiendo IP:puerto; es el comportamiento del juego base |

Dos errores encontrados y corregidos (los dos solo aparecían en la primera partida tras cargar la página):

1. `VictoryScene`: medía el tiempo con el reloj de la escena y lo restaba al reloj del juego; en la primera visita no
   coincidían y la escena arrancaba en el final. Ahora toma el origen del primer fotograma.
2. `RaycastScene.create`: al entrar directo a un jefe, el mensaje y el sonido de introducción se disparaban antes de crearse
   el texto del HUD y el sistema de audio, y la escena fallaba con `TypeError`. Se protegieron las dos llamadas.

## 2. Build de producción

`npm run build` (lo mismo que hace el `Dockerfile`): compila en 15 s, `dist/` pesa 26 MB y no hay ningún archivo de más de
5 MB. `docker compose up --build` en sí no se corrió en la máquina donde se hizo esta medición (no tiene Docker).

## 3. Velocidad de los jefes del tercer nivel de jefe

Medición con la lógica real de la escena (`updateEnemies`) a 30, 60 y 144 cuadros por segundo, jefes saliendo desde
lejos hacia un jugador quieto. Antes del cambio, `tickDualBossCoordination` los movía a unas 17 casillas por segundo
(el jugador va a 6.8). Con el tope de 80 % del jugador (5.44), el pico medido fue de 5.37 casillas por segundo en los tres
casos. La prueba `raycast-boss-ai.test.ts` lo verifica.

## 4. Sensibilidad de M3 al balance del jefe

`npm run bench:director -- --rebuild --seeds 80`, cambiando solo `THIRD_BOSS_FIGHT_SPEED_MULTIPLIER`.

| Con 0.65 (publicado) | Con 0.455 |
|---|---|
| Reproduce `resultados/bench-director.md`, `director-tabla.json` y `director-sesion-ejemplo.csv` byte por byte | Mejor brazo único `ritmo-1` (0.37); Thompson 0.30; epsilon-voraz 0.33; UCB1 0.26; fijo `ritmo-1` 0.37; regla original 0.15; oráculo 0.39 |
| Mejor brazo único `ritmo-4` (0.35); oráculo 0.42 (techo 0.07) | Techo de personalización 0.02 |

Se dejó 0.65. Con el valor final, `npm run bench:director -- --rebuild` regenera los seis archivos de `resultados/` idénticos.
También se corrigió el valor por omisión de `--seeds` del script (era 60, el informe usa 80).

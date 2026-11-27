# Modo estudio: partidas con personas

Hasta ahora todos los "jugadores" de las mediciones son bots (ver límites globales del informe). El modo estudio
recoge datos de personas reales sin servidor, sin cuentas y sin datos personales.

## Qué hace

Se activa solo con `?estudio=1` en la URL del juego, por ejemplo
`https://doom-bash-ia-mu.vercel.app/?estudio=1`. Al entrar se muestra un aviso de consentimiento. Si la persona acepta:

- El jefe usa el bandido del director, pero **el brazo de cada encuentro se elige al azar con probabilidad uniforme**
  (no por Thompson). Así los datos permiten comparar brazos sin sesgo y evaluar cualquier política offline.
- Cada encuentro (ventana de 40 s, o hasta que la persona muere o cae el jefe) se guarda **en su propio navegador**:
  número, hora, nivel, dificultad, brazo, recompensa, fracción de vida final, motivo de cierre y duración.
- La persona sube su archivo con la tecla **K** (baja un `estudio-<id>.json`) y se lo manda a quien lo organiza.
- El identificador es aleatorio, generado en su navegador; no hay nombre, correo, IP ni cuenta, y el archivo no tiene
  ningún otro campo (hay una prueba que lo verifica).

Si no acepta, el juego sigue como siempre y no se guarda nada.

## Qué se puede y no se puede concluir

**Se puede:** comprobar si el simulador acierta con las personas. La pregunta es si los brazos con más presión bajan la
vida final de una persona real en el mismo sentido que en el simulador (correlación de Spearman entre presión y vida
final), y qué fracción de encuentros cae en la banda de reto (30 % a 70 % de vida) por brazo, con intervalos.

**No se puede:** demostrar que el bandido mejora el reto para personas. Con unas 30 a 100 peleas por persona y 9 brazos,
solo se acepta un encuentro de cada nueve en la evaluación offline, y el bandido no tiene tiempo de aprender en una sesión.
El análisis incluye esa evaluación (repetición por rechazo) y reporta cuánta evidencia usó, pero no hay que leer la
diferencia entre políticas como una prueba.

Tampoco es un experimento con muestra representativa: serán conocidos del equipo.

## Para analizar

```bash
mkdir -p datos/sesiones
npm run analizar:estudio
```

Pon los `.json` que manden en `datos/sesiones/` (esa carpeta está en `.gitignore`; los archivos no se suben). El script
descarta los que no tengan formato válido, deduplica por identificador y escribe `resultados/estudio-resumen.md` con
solo agregados.

## Guion para las personas que juegan

1. Abre el enlace con `?estudio=1`, acepta el aviso y juega hasta el primer jefe (o salta con la tecla `7`, que va al
   primer jefe; `8` y `9` a los otros).
2. Pelea contra el jefe las veces que quieras. Cada intento cuenta; mientras más, mejor, pero con 15 a 20 minutos basta.
3. Pulsa **K** al terminar. Se baja un archivo `estudio-….json`; mándaselo a quien te pasó el enlace.
4. Puedes volver a abrir el enlace otro día: el archivo sigue acumulando (con el mismo identificador anónimo) mientras no
   borres los datos del navegador.

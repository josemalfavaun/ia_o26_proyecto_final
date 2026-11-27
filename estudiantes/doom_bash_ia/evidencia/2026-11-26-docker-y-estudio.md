# Evidencia, 26 de noviembre de 2026: Docker y modo estudio en línea

Salidas pegadas de la terminal del autor (Mac, Docker 29.2.0).

## Docker (`docker compose up --build`)

- Se agregó un `.dockerignore` (antes no existía). Sin él, `COPY . .` copiaba el `node_modules` de macOS encima del de la
  imagen Linux.
- Construcción: 128.2 s, 25 de 25 pasos terminados. Imagen `game` (Node 22 Alpine): `npm ci` 90.8 s y `npm run build`
  14.7 s. Imagen `game-master` (Node 20 Alpine): `npm ci` 97.8 s. Contexto de `game`: 27.39 MB.
- Arranque: `game-1` sirve `http://localhost:8000/`; `game-master-1` informa `http://localhost:3001` con CORS
  `http://localhost:8000` y WebSocket en el puerto 3001. Sin el perfil `llm` el narrador apunta a `http://ollama:11434`,
  que no existe, y usa el respaldo por reglas.
- Se detuvo con Control+C y `docker compose down` quitó contenedores y red sin errores.

- Segunda corrida (con las imágenes en caché): el autor abrió `http://localhost:8000`, entró a una partida, llegó al jefe con
  la tecla 7 y apagó con Control+C y `docker compose down`; reporta que todo funcionó (declaración del autor, sin captura).

## Modo estudio en la demo publicada

Con `https://doom-bash-ia-mu.vercel.app/?estudio=1` aparece el aviso de consentimiento del modo estudio (confirmado por el
autor).

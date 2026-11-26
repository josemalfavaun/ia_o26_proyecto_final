# Demo en línea: cómo actualizarla

La demo es una versión estática del juego (sin servidor): corre el motor, los módulos de IA (A*, expectimax, bandido) y
la narración es opcional. No funcionan en la demo el multijugador LAN (una página `https` no puede abrir sockets a la
red local) ni el narrador con Ollama. Antes de publicar, en `estudiantes/doom_bash_ia`:

```bash
npm ci
npx vitest run     # pruebas
npm run build      # genera dist/
```

## Vercel (demo actual: https://doom-bash-ia-mu.vercel.app/?ia=astar,bandido)

El proyecto de Vercel se llama `doom-bash-ia` (equipo "Jose's projects"). No toca al proyecto `royaltica`.

```bash
cd estudiantes/doom_bash_ia
npx vercel --prod
```

Si Vercel dice que la ruta no existe, es porque el proyecto tiene configurado el directorio raíz
`estudiantes/doom_bash_ia`: en ese caso corre el mismo comando desde la raíz del repo. Si te pide ligar el proyecto,
elige el existente `doom-bash-ia`. Al terminar, abre la URL, pulsa `A` y luego `Enter`, y comprueba que el fondo del menú
muestra combate y que `-` abre la escena final.

## GitHub Pages (https://josemalfavaun.github.io/ia_o26_proyecto_final/)

El workflow vive solo en tu fork, no en el PR (un archivo en `.github/` queda fuera de `estudiantes/`):

1. En tu fork, rama `main`: copia `docs/runtime/cd-pages-demo.yml` a `.github/workflows/cd-pages-demo.yml`, haz commit y push.
2. En GitHub: Settings > Pages > Source: **GitHub Actions** (una sola vez).
3. Actions > "Demo en GitHub Pages" > Run workflow, con `ref = entrega` (o el SHA que quieras publicar).
4. Cuando termine, la URL aparece en el job `deploy`.

El script `pages:build` del `package.json` usa el nombre del paquete como ruta (`/doom-bin-bash-edition/`); en Pages la
ruta debe ser el nombre del repositorio, por eso el workflow fija `BASE_PATH` por su cuenta.

## Después de publicar

- `README.md` e `INFORME.md` llevan el link de Vercel; si quieres que también lleven el de Pages, agrégalo ahí.
- `proyecto.toml` tiene `demo = ""`; la entrega pide la URL de la demo ahí.

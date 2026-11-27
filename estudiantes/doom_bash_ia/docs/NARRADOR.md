# M5: narrador con salida estructurada

El juego base ya traía un narrador con un modelo local (Ollama) que escribe una línea de ambiente en la pantalla; si el
modelo falla, usa una frase fija. Este módulo cambia **el contrato** con el modelo para poder medirlo.

## Qué cambia

| | Narrador base (`gameMaster.ts`) | Narrador estructurado (`gameMasterStructured.ts`) |
|---|---|---|
| Se le pide al modelo | Texto libre | Un JSON `{ "linea": ..., "tono": ... }` (Ollama con `format: "json"`) |
| Validación | Recorte básico | Estricta: JSON válido, claves exactas, `tono` ∈ {tension, alerta, calma, critico}, línea de hasta 22 palabras, sin emojis ni listas |
| Si falla | Frase fija | Frase de respaldo **y el motivo** (`sin-conexion`, `tiempo-agotado`, `http`, `vacio`, `json-invalido`, `esquema`, `demasiado-larga`, `emoji`, `lista`) |
| Medición | Ninguna | Tasa de respuestas válidas, tasa de respaldo, motivos, latencia p50/p95 |

Se activa con la variable `GAME_MASTER_STRUCTURED=1` al arrancar el servidor (`npm run server:dev`). Sin la variable, el
servidor usa el narrador de siempre.

## Estado

- **Código y pruebas: hechos.** 20 pruebas con un modelo simulado (respuestas válidas, JSON roto, esquema incorrecto,
  texto largo, emojis, tiempo agotado, error HTTP, sin conexión, diagnóstico del esquema).
- **Primera medición real (26-nov-2026, llama3.2:3b local, 60 llamadas): resultado negativo.** Solo 12 de 60 respuestas
  fueron válidas (20 %); las otras 48 (80 %) cayeron al respaldo y **todas por `esquema`**. La latencia de las llamadas que
  obtuvieron respuesta del modelo fue de 1010 ms (mediana) y 1154 ms (p95). Esa corrida no guardó la respuesta cruda del modelo, así que
  entonces no se sabía qué parte del esquema fallaba; se añadió la captura de la respuesta y un diagnóstico para la
  siguiente corrida.

- **Diagnóstico (segunda corrida, mismo modelo, 60 llamadas, 25 % válidas):** el 100 % de los fallos de esquema que se
  muestran son el mismo: el modelo contesta `"tono": "tensión"` (con acento) y el parser pide `tension`. La causa era un
  **error del prompt**: la frase de estilo decía "tono tensión arcade/horror" y la lista de valores decía `tension`, así que
  el prompt se contradecía. El contenido de las líneas sí es válido. (Entre las dos corridas 12 y 15 de 60 son válidas: el
  modelo no es determinista.)
- **Corrección (v2):** el prompt ya no usa la palabra "tensión" fuera de la lista y pide las palabras exactas, entre comillas,
  en minúsculas y sin acentos. El parser **no** se hizo más permisivo (no acepta "tensión" ni "Tensión"): cambiarlo habría
  subido el número sin mejorar nada al modelo. La v2 se midió después en las mismas 60 combinaciones de contexto y evento
  que la v1, así que **el prompt se ajustó mirando esta tanda**.
- **Resultado de la v2 (llama3.2:3b, 60 llamadas): 60 de 60 válidas (100 %), 0 % de respaldo, latencia mediana 931 ms y
  p95 1106 ms.**

| Corrida | Prompt | Válidas | Respaldo | Mediana / p95 | Archivos |
|---|---|---|---|---|---|
| v1 | con "tensión" (contradictorio) | 12 de 60 (20 %) | 80 % | 1010 / 1154 ms | `bench-narrador-v1.md` |
| v1b | igual | 15 de 60 (25 %) | 75 % | 994 / 1144 ms | `bench-narrador-v1b.md` |
| v2 | corregido | 60 de 60 (100 %) | 0 % | 931 / 1106 ms | `bench-narrador.md` |

- **Lo que la v2 NO demuestra.** Que el formato sea válido no dice que el contenido sea bueno ni que el campo `tono` sirva:
  en las 60 respuestas de la v2 el tono fue `tension` 57 veces, `calma` 2 y `alerta` 1, sin relación visible con el
  evento (por ejemplo, ante "aparece una emboscada de enemigos" fue `tension` 10 de 10 veces y ante "el jugador despeja la
  sala en silencio" también 10 de 10). Las frases son todas distintas (60 de 60) y de 8 a 21 palabras. La calidad narrativa
  no se midió; lo medido es el cumplimiento del formato.

```bash
ollama serve
ollama pull llama3.2:3b
npm run bench:narrator                 # 60 llamadas; escribe resultados/bench-narrador.md
npm run bench:narrator -- --calls 30 --model llama3.2:3b
```

El script guarda el modelo, la fecha y la URL en el archivo de resultados. Si Ollama no responde, termina con un mensaje
y no escribe nada. Las cifras dependen del modelo y de la máquina, así que no son reproducibles bit a bit como las del
simulador.

## Límites

1. Una sola medición, con un modelo pequeño (llama3.2:3b) y un solo prompt. No se comparó contra el narrador de texto
   libre del juego base ni contra otros modelos, así que no se puede decir que la salida estructurada mejore nada; lo que
   sí aporta es poder *contar* los fallos. Además, la v2 se ajustó mirando las mismas 60 combinaciones con que se midió.
2. El `tono` solo se valida (que sea uno de cuatro) y, en la medición, casi nunca varía; todavía no cambia nada visible
   en el juego. Para que sirva habría que pedírselo al modelo en función del evento o derivarlo con reglas.
3. El narrador no recibe el estado completo del juego, solo el evento y el contexto que ya mandaba el cliente.

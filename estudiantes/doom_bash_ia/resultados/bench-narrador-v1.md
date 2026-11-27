# Medición de M5: narrador estructurado

Modelo: llama3.2:3b. Servidor: http://localhost:11434. Fecha: 2026-11-26. Llamadas: 60.

No es reproducible bit a bit (depende del modelo y de la máquina). El detalle de cada llamada está en `narrador-llamadas.csv`.

| Métrica | Valor |
|---|---|
| Respuestas válidas (JSON con esquema, ≤22 palabras, sin emojis ni listas) | 12 de 60 (20 %) |
| Uso del respaldo por reglas | 80 % |
| Latencia mediana de las llamadas que respondieron | 1010 ms |
| Latencia p95 | 1154 ms |

Motivos de fallo: esquema: 48

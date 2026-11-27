# Medición de M5: narrador estructurado

Modelo: llama3.2:3b. Servidor: http://localhost:11434. Fecha: 2026-11-26. Llamadas: 60.

No es reproducible bit a bit (depende del modelo y de la máquina). El detalle de cada llamada está en `narrador-llamadas.csv`.

| Métrica | Valor |
|---|---|
| Respuestas válidas (JSON con esquema, ≤22 palabras, sin emojis ni listas) | 15 de 60 (25 %) |
| Uso del respaldo por reglas | 75 % |
| Latencia mediana de las llamadas que respondieron | 994 ms |
| Latencia p95 | 1144 ms |

Motivos de fallo: esquema: 45

Primeras respuestas rechazadas por esquema (para ver qué devolvió el modelo):

- Llamada 1: tono fuera de la lista: tensión. Respuesta: `{"linea": "Al acercarte más al terminal, el ruido de sus motores se vuelve cada vez más ensordecedor y mortal", "tono": "tensión"}`
- Llamada 2: tono fuera de la lista: tensión. Respuesta: `{"linea": "En la oscuridad, el pasillo se extiende hacia el infierno, sin sonido ni esperanza.", "tono": "tensión"}`
- Llamada 3: tono fuera de la lista: tensión. Respuesta: `{"linea": "De repente, el cristal se rompe y el agua azul oscuro se cuela lentamente hacia el sótano", "tono": "tensión"}`
- Llamada 5: tono fuera de la lista: tensión. Respuesta: `{"linea": "El suelo vibra bajo tus pies, cada paso te lleva más cerca de la oscuridad que te espera", "tono": "tensión"}`
- Llamada 6: tono fuera de la lista: tensión. Respuesta: `{"linea": "De repente, el silencio se rompe y tus pies parecen pesar más que nunca", "tono": "tensión"}`
- Llamada 7: tono fuera de la lista: tensión. Respuesta: `{"linea": "De repente, la oscuridad se convierte en un infierno: armas y cuerpos en el pasillo de servicio", "tono": "tensión"}`
- Llamada 10: tono fuera de la lista: tensión. Respuesta: `{"linea": "De repente, la arena vibra con una intensidad mortal y los enemigos salen de la oscuridad", "tono": "tensión"}`
- Llamada 11: tono fuera de la lista: tensión. Respuesta: `{"linea": "En las sombras, el silencio se vuelve hostil. La munición es tu única defensa contra lo que acaba de suceder", "tono": "tensión"}`

# Cierre automático de fechas y recuperación de postergados

Implementado el 17 de octubre de 2026. El backend debe permanecer en ejecución y conectado a MySQL. Los intervalos de Node no funcionan mientras el proceso está detenido ni garantizan ejecución en un hosting que suspende procesos entre peticiones. Al reiniciar, se retoman los trabajos vencidos persistidos.

## Instalación sobre una base existente

Aplicar una sola vez y en orden:

1. `backend/migrations/20261017_02_historical_lineups.sql` si todavía no se aplicó.
2. `backend/migrations/20261017_03_matchday_closure.sql`.
3. El preflight y la migración `20261017_04_economy_ownership`, detallados en `ECONOMIA_Y_PLANTELES.md`.

Las migraciones están preparadas; no se ejecutaron sobre ninguna base durante este cambio. No usar los scripts históricos de reset. MySQL confirma DDL implícitamente. No activar `DB_SYNC_SCHEMA` en producción.

La segunda migración reconoce los cierres antiguos que tienen un trabajo `matchday_closure` completado, para evitar pagarlos otra vez. El viejo `matchday.status = completed` por sí solo no demuestra un cierre económico: el importador de fixtures también escribía ese estado. Si antes se ejecutaron cierres manuales sin un trabajo registrado, identificar esas fechas y registrar su `closure_completed_at` antes de activar el scheduler; el sistema no puede deducir qué premios ya se pagaron.

Las fechas anteriores al historial siguen sujetas a las garantías de `ALINEACIONES_HISTORICAS.md`: si no hay una alineación fiable, el cierre conserva el error y reintenta; no inventa un equipo ni publica cero como sustituto de un fallo.

## Cuándo cierra

El scheduler arranca automáticamente con el backend, sin entrar al sitio ni presionar un botón. Programa el cierre para **cinco horas después del último inicio previsto** de los partidos regulares. No espera un aviso de finalización, no necesita la hora del final y no consulta estados deportivos antes de ese horario. Las verificaciones periódicas del worker leen MySQL; no consumen cuota deportiva.

Al llegar el horario, hace la consulta de estado necesaria para procesar el cierre. Si algún partido de esa fecha sigue **en curso**, conserva todas las operaciones pendientes y reprograma el trabajo **cuatro horas después de esa consulta**. No consulta durante esas cuatro horas. Si al reintentar sigue en curso, vuelve a esperar cuatro horas. Cuando está finalizado, ejecuta el cierre inmediatamente, sin sumar otra espera de cuatro horas desde el final.

Si la consulta informa otro inicio futuro, mueve la tarea al nuevo inicio + cinco horas. Los postergados se guardan como pendientes; si un partido continúa sin empezar cinco horas después de su inicio previsto, también se registra como pendiente. Los cancelados no bloquean. Los pendientes reprogramados se recuperan por separado y no atrasan el cierre regular. Si toda la fecha queda pendiente, se toma el último inicio original + cinco horas.

El worker revisa trabajos cada minuto por defecto: ejecuta a partir del vencimiento, con esa granularidad, sujeto a disponibilidad del backend y de la API. Si hay un error, no afirma haber completado el cierre.

## Orden del cierre

Una ejecución corresponde a una liga, temporada y fecha. Procesa todos los torneos de esa liga.

1. Actualiza estados y consulta ratings de los partidos finalizados de esa fecha, incluyendo todos los jugadores que la API indica que jugaron. Si faltan respuestas, plantillas o jugadores locales, falla antes de mover dinero. No consulta nuevamente todos los partidos históricos de la liga ni reinicializa los precios traducidos.
2. Resuelve las pujas activas de los mercados de esa fecha y los mercados anteriores pendientes de esa temporada. Gana la oferta válida más alta; en empate, la más antigua y luego el menor ID. El ganador consume su reserva y paga del banco. Los demás recuperan su disponible. Se respetan cinco suplentes y dieciséis jugadores de capacidad; si una compra ya no cabe, se considera la siguiente oferta válida. Las reservas sobrantes de ofertas desactualizadas también se liberan.
3. Recalcula puntos de la fecha y totales con las alineaciones históricas. Las compras del paso anterior no suman retroactivamente.
4. Retira los mercados liquidados y genera **tres jugadores aleatorios por participante**, sin repeticiones dentro del torneo y excluyendo jugadores ya poseídos o publicados en otros mercados abiertos. El mercado se vincula a la siguiente fecha real de la misma temporada. Si la temporada terminó, no inventa una fecha nueva. Si no hay suficientes jugadores, falla y revierte los cambios económicos.
5. Paga según la clasificación **de esa fecha**, no según el acumulado. Puestos 1–3: 1M; 4–6: 1,5M; 7–9: 2M; etc. Los empatados comparten la primera posición del grupo y el mismo premio. Por ejemplo: posiciones 1, 2, 3, 3, 5.

Los pasos 2 a 5 y `closureCompletedAt` se confirman en una transacción. Un fallo revierte compras, reservas, puntos, mercado y premios de esa transacción. Los ratings ya descargados pueden permanecer guardados y se vuelven a consultar al reintentar. El marcador de cierre evita pagar o renovar de nuevo al reejecutar el trabajo o usar el botón de administración.

Los mercados liquidados se archivan con `closedAt`, conservando sus pujas y resultados. La compra, liberación de reservas y premios quedan en el libro de movimientos. El resumen agregado del cierre queda en la fecha. Recuperar una fecha vieja cuando ya cerró una posterior no renueva el mercado actual.

## Pendientes y reprogramaciones

Cada partido conserva `pendingRecovery`, `pendingOriginalStart` y `recoveryCompletedAt` en MySQL. No hace falta crear una copia local del mismo partido cuando se reprograma: se conserva su ID externo y se actualiza el horario.

En cada intento de cierre se consultan los pendientes de toda la liga, aunque pertenezcan a fechas ya cerradas. No hay una revisión diaria adicional. Un pendiente sin nueva fecha vuelve a revisarse en el siguiente cierre de la liga, para ahorrar consultas. Los antiguos trabajos diarios ya encolados se completan sin consultar la API.

Cuando un pendiente pasa a programado con otro horario, en juego o finalizado, se crea un trabajo para **inicio reprogramado + cinco horas**. La clave incluye el partido y el inicio. Si cambia otra vez el horario, se crea el nuevo trabajo y el anterior deja de recuperar ratings. Un pendiente sin nueva fecha sigue en la lista. Si a las cinco horas todavía está en curso o no terminó, se reintenta cuatro horas más tarde.

La recuperación consulta el estado y ratings de ese partido, reconstruye los puntos de su fecha y actualiza totales. Utiliza los planteles históricos: alineación al inicio original de la fecha si los cambios estaban bloqueados; alineación al inicio efectivo de ese partido si estaban permitidos. Reconstruir la fecha completa conserva las contribuciones de los otros partidos y aplica correctamente las penalizaciones. No cambia puntos de otras fechas ni paga nuevamente los premios ya otorgados al cierre.

## Persistencia, reintentos y observación

Los trabajos tienen clave única, adquisición condicional y lease renovable. Un proceso caído deja un lease que vence en cinco minutos; otro worker puede retomarlo. El bloqueo de la liga y el marcador transaccional protegen los movimientos económicos frente a ejecuciones simultáneas. Un timeout HTTP de 30 segundos evita conexiones deportivas bloqueadas indefinidamente. Los errores comunes reintentan con espera creciente de 5 a 60 minutos; el agotamiento de cuota reintenta a las 24 horas.

El panel existente «Ver fecha actualización puntos/market por fecha» utiliza `GET /api/tournaments/matchday-automation-schedule`. La respuesta incluye estado, último error, vencimiento, cierre completado y `pendingMatches` con su próxima recuperación. Cada usuario accede a las ligas de sus propios torneos.

El botón administrativo «Ejecutar cierre completo de fecha» requiere liga, número de fecha y temporada; utiliza exactamente el mismo flujo y respeta el horario. Una respuesta 202 significa que todavía está esperando, no que ya cerró.

La versión nueva ajusta automáticamente los trabajos pendientes creados con la regla anterior al horario inicio + cinco horas. Si cambia el fixture, también actualiza ese horario; una nueva pasada del scheduler no borra la espera de cuatro horas de un partido en curso. El ajuste de horarios no requiere otra migración; la posterior corrección de economía y planteles sí requiere la migración 04.

Variables: `MATCHDAY_AUTOMATION_ENABLED` (por defecto `true`), `MATCHDAY_AUTOMATION_SEED_INTERVAL_MS` (600000), `MATCHDAY_AUTOMATION_PROCESS_INTERVAL_MS` (60000), además de MySQL y credenciales SportsApiPro. La consulta de ratings del cierre no depende del interruptor opcional del procesamiento manual `RANKINGS_PROCESS_ENABLED`.

## Verificación realizada

`npm test` ejecuta las regresiones de permisos, alineaciones históricas y automatización. Estas últimas usan los servicios reales con una frontera de persistencia simulada: orden del cierre, dos torneos, reservas, adjudicación, límites de plantel, mercado siguiente, empates, rollback, idempotencia, reprogramación del mismo partido, cinco horas y fallos de API.

La integración con MySQL real, el contrato de las respuestas reales de SportsApiPro y la ejecución desplegada siguen pendientes de comprobar. Las pruebas aisladas no equivalen a una compilación integral del backend: la instalación local conserva problemas anteriores de resolución de tipos/dependencias.

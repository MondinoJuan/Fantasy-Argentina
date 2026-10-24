# Alineaciones y puntos históricos — punto 2

## Regla confirmada

- Si el torneo no permite cambios durante la fecha, se usa la alineación vigente **antes del inicio de la fecha**.
- Si los permite, cada partido usa la alineación vigente **antes del inicio de ese partido**, incluidos titulares, puestos y capitán. Esta fue la opción elegida por el autor.
- Guardar cambios al comenzar o después de comenzar un partido no modifica sus puntos.
- En la modalidad por fecha, un postergado conserva la alineación de aquella fecha. En la modalidad por partido, usa la vigente al comenzar el partido reprogramado.
- El capitán duplica su aporte. Se conserva la penalización de tres puntos por jugador fuera de posición una vez por fecha; con varios partidos se descuenta en la primera contribución fuera de posición y se aplica el multiplicador de ese partido.

## Persistencia

`ParticipantSquad` sigue siendo el plantel editable actual. Se agregó una identidad estable `historySourceKey`, independiente del ID autogenerado y de la precisión de las fechas.

`SquadRevision` guarda versiones inmutables de cada cambio persistido: titulares, suplentes, formación, capitán, posiciones reales, altas, bajas y hora efectiva del servidor. Un subscriber `onFlush` las registra en la misma unidad de trabajo que modifica el plantel. Esto incluye compras de mercado, negociaciones, cláusulas, ventas rápidas y cambios administrativos realizados mediante el ORM.

Las correcciones de posición de un jugador real también generan una nueva revisión en los planteles activos afectados. Así se aplican a cortes futuros sin alterar la posición guardada en partidos anteriores.

`MatchdayLineup` guarda una copia congelada con puestos explícitos, capitán, hora de corte, revisión de origen y modalidad de cambios. Hay una cabecera por participante/fecha; en modalidad dinámica hay además una copia por participante/partido. La cabecera dinámica fija la modalidad y las copias de partido son las que se puntúan.

Los registros históricos no tienen endpoints de escritura y el subscriber rechaza sus actualizaciones o eliminaciones mediante el ORM. Los cambios posteriores del jugador o del plantel no modifican una copia ya guardada.

## Captura y recuperación

El proceso periódico existente captura las fechas que ya comenzaron y los partidos confirmados como iniciados o finalizados. No se congela un partido simplemente porque llegó su hora programada: puede haberse postergado sin jugar.

Si el servidor no estaba activo al llegar un corte, el cálculo reconstruye la alineación desde las revisiones anteriores a ese instante y la congela. No consulta el plantel actual como sustituto de una historia desconocida. Las claves únicas y el bloqueo del participante evitan crear dos copias del mismo corte.

La configuración de cambios queda guardada en la cabecera de la fecha; modificarla después de crear esa cabecera no reinterpreta los puntos de la fecha.

## Cálculo y correcciones

El cálculo de fin de fecha utiliza las copias históricas. Una corrección por un partido específico reconstruye la fecha completa con todos los rendimientos persistidos: no borra los aportes de otros partidos ni entrega puntos retroactivos a un nuevo dueño.

Se actualiza el desglose existente por participante/fecha/jugador y el puntaje de la fecha. El total general se obtiene sumando las fechas. El desglose agrega `performanceContributions`, con partido, rendimiento, copia de alineación, nota base, penalización, multiplicador y aporte final. Los campos de puntaje admiten decimales.

El job de suma de un postergado sincroniza primero los resultados y rendimientos mediante la integración existente. La recuperación general y la idempotencia económica de los cierres siguen correspondiendo al punto 3.

## Instalación sobre una base existente

Aplicar **una sola vez**, antes de arrancar este backend:

`backend/migrations/20261017_02_historical_lineups.sql`

La migración agrega la identidad estable del plantel, las dos tablas históricas y el detalle de contribuciones, y conserva la precisión decimal de los totales. No ejecuta los scripts antiguos de reset ni reasigna jugadores. MySQL confirma DDL de manera implícita: hacer una copia de seguridad y aplicar el archivo completo sobre el esquema actual del ORM.

No se ejecutó esta migración sobre la base del usuario desde el chat. Las pruebas usan persistencia simulada; falta la verificación de integración con MySQL y la compilación integral del backend con sus dependencias reparadas.

### Límites de datos anteriores

No es posible reconstruir cambios que se sobrescribieron antes de instalar el historial. Al arrancar el servidor se registra una base de los planteles existentes desde ese momento, incluso con la automatización desactivada. No se retrocede a su `updatedAt`: las posiciones reales antiguas tampoco estaban registradas y no pueden deducirse con certeza. Si el corte requerido es anterior a toda historia conocida, la API responde **409 `LINEUP_HISTORY_UNAVAILABLE`** y conserva los puntos publicados, en lugar de usar jugadores de hoy para una fecha vieja. Los nuevos cortes posteriores a la inicialización pueden reconstruirse normalmente.

Un participante que ingresó después del inicio de una fecha bloqueada no recibe puntos anteriores a su ingreso. En modalidad dinámica puede puntuar en los partidos que comiencen después de incorporarse.

La corrección del orden de asignación inicial se aplica a nuevos planteles: delanteros, mediocampistas, defensores y arquero, como la cancha. No se reordenan automáticamente planteles existentes porque podrían contener elecciones intencionales. Revisarlos y guardar la formación antes de la próxima fecha si fueron creados con el orden anterior.

Las escrituras directas por SQL o `nativeUpdate` no disparan eventos del ORM. Cualquier nuevo flujo que modifique planteles debe utilizar entidades administradas y `flush`. El retiro ahora conserva participante, planteles y puntos. Ver `PRECIOS_EXPERIENCIA_Y_PRIVACIDAD.md` y la migración 06: se liberan posesiones y reservas sin destruir las copias históricas.

## Consulta

`GET /api/matchday-lineups?matchdayId=4&participantId=11`

Requiere sesión y pertenencia al torneo, salvo superadmin. Devuelve las copias existentes sin consultar al proveedor deportivo. En registros por fecha, `matchId` es `null`; los registros por partido contienen su ID. El endpoint es de solo lectura, también para superadmin.

## Verificación

`npm test` en `backend` ejecuta las regresiones del punto 1 y las de historia. Se prueban transferencias, ventas, capitán, cambios entre partidos, postergados, contribuciones múltiples, correcciones repetidas, datos antiguos insuficientes, entradas tardías, copias inmutables y el registro automático en el subscriber.

## Actualización de planteles y economía

La corrección posterior de los puntos 3–5 añade propiedad relacional y `startingSlots`. La proyección antigua conserva once índices usando cero para un hueco; el historial lo convierte en `null`. No se compactan posiciones al vender o transferir. El bloqueo dura hasta el cierre confirmado, salvo cambios permitidos por la configuración del torneo. Ver `ECONOMIA_Y_PLANTELES.md` y aplicar también su migración 04 antes de arrancar esta versión.

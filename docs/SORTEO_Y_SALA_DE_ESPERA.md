# Sala de espera, sorteo inicial e ingresos posteriores

## Flujo acordado

1. Crear un torneo registra al creador como participante y abre una sala de espera. Los amigos se inscriben con el código o enlace existente. Todavía no se asignan jugadores ni se genera mercado.
2. El creador pulsa **Arrancar torneo**. El servidor verifica su identidad y toma a todos los participantes activos bajo el mismo bloqueo y transacción.
3. Se sortean once titulares para cada uno, buscando promedios parecidos de calidad. Se conserva la formación inicial 4-4-2 y no se asignan suplentes.
4. Después de asignar todos los planteles, se publica un mercado con tres jugadores por participante, excluyendo a todos los jugadores recién asignados.
5. El torneo queda iniciado. Repetir el pedido o enviarlo simultáneamente no repite el sorteo, no reemplaza planteles ni duplica el mercado.

La sala muestra participantes, invitación, actualización manual y el botón de inicio únicamente al creador. Los demás pueden actualizar para ver si ya arrancó. La actualización invalida también las cachés de plantel y mercado, para no mostrar las colecciones vacías de la espera después del inicio.

## Qué significa equilibrado

La calidad de un jugador es el **promedio aritmético de sus notas deportivas guardadas en `PlayerPerformance` para esa liga**. Se usa cada nota finita disponible, sin ponderarla por precio ni aplicar capitán o penalizaciones de alineación. No se usan las posiciones de la clasificación, los premios ni las cotizaciones monetarias.

Se sortean candidatos de un fondo común. El reparto combina jugadores de mayor y menor nota para aproximar los promedios de los once de todos los participantes; se comparan hasta 64 repartos. El orden de inscripción no concede prioridad. Los puestos de cancha solo son una condición para formar los once (1 arquero, 4 defensores, 4 mediocampistas y 2 delanteros). El equilibrio es aproximado según las notas y disponibilidad; no garantiza rendimiento futuro ni igualdad exacta.

Un jugador sin notas no tiene una calidad conocida y no se le inventa un promedio ni se reemplaza por su precio. Si no hay suficientes jugadores con notas en algún puesto, o no alcanza el fondo para planteles y mercado, el inicio devuelve un aviso y conserva la sala de espera completa. No consulta al proveedor para intentar completar datos. Puede reintentarse después de que existan más datos locales o se ajuste la cantidad de participantes.

También debe existir una fecha abierta de la liga donde publicar el mercado. Si no existe, se revierte el inicio o ingreso; no se inventan fechas deportivas ni se publica un mercado asociado a una fecha ya cerrada.

El resumen guardado incluye criterio, participantes iniciales, promedios de plantel, jugadores repartidos y promedio/cantidad de notas de cada jugador seleccionado. Es una foto del momento del sorteo; corregir notas después no cambia planteles ya asignados.

## Ingresos posteriores

Después de arrancar siguen admitiéndose nuevos participantes. Cada uno recibe once jugadores aleatorios para la formación inicial, sin suplentes, entre los jugadores activos de la liga que estén libres en ese torneo. Se excluyen todos los planteles vigentes, las posesiones activas y los jugadores publicados en mercados abiertos. Se agregan tres jugadores al mercado por el nuevo participante.

Ese ingreso no vuelve a sortear el torneo ni modifica los planteles existentes. No requiere notas para los jugadores restantes: el criterio solicitado para el ingreso tardío es la selección aleatoria de once libres. Inscripción, asignación, propiedad y ampliación del mercado se confirman juntas; si falta disponibilidad, se revierte todo el ingreso. El retiro continúa conservando historial y no permite reingresar para repetir una asignación.

## Puntos, cierres y seguridad

Las salas de espera no generan nuevos jobs deportivos ni participan en los premios y renovaciones de mercado de los torneos iniciados de la misma liga. La fecha de registro se conserva. `playingSince` indica desde cuándo el participante tiene plantel; `initialDrawCompletedAt` fija el arranque común. Las copias históricas usan esos cortes para impedir puntos anteriores a la asignación, incluso si el usuario estuvo inscripto varios días en la sala.

Los premios por **posición en la clasificación** siguen siendo independientes del sorteo y no cambian. Se conserva el mismo premio para empatados.

El endpoint es `POST /api/tournaments/:id/start`, sin parámetros de sorteo controlados por el cliente. El permiso se verifica tanto en la política HTTP como dentro de la transacción. La administración técnica conserva su permiso explícito. Un fallo revierte planteles, mercado, propiedad y marca de inicio.

## Migración y comprobaciones

Aplicar `backend/migrations/20261017_07_tournament_lobby.sql` después de las migraciones anteriores y antes de ejecutar esta versión. Añade creador, estado/fecha/resumen del sorteo y comienzo deportivo del participante. Los torneos existentes se marcan `legacy`: conservan sus planteles y funcionamiento; nunca vuelven a la sala de espera ni se sortean otra vez. No se inventa su creador ni una fecha de sorteo histórica.

La migración está preparada y no se aplicó a una base real desde esta sesión. Pasan 118 pruebas, incluidas las regresiones anteriores: reparto, promedios, permisos, doble inicio, rollback, aislamiento de salas en cierres, ingresos tardíos sin solapamientos, identificadores generados por la base, falta de cupo, cachés de interfaz y cortes históricos. La compilación Angular de desarrollo pasa. La persistencia de las pruebas es simulada; la comprobación con MySQL real continúa pendiente. La compilación integral del backend mantiene los problemas de resolución de tipos previamente documentados; no aparecen diagnósticos en los servicios, dominio y entidades modificados para este flujo.

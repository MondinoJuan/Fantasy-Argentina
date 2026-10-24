# Correcciones de los puntos 7, 8 y 9

## Sorteo y precios

El sorteo inicial fue corregido con la aclaración posterior: el creador arranca desde una sala de espera y el reparto conjunto busca promedios parecidos de las notas deportivas locales, sin usar precios. Los ingresos tardíos reciben once aleatorios libres. Los puestos de cancha solo completan la formación 4-4-2. Ver `SORTEO_Y_SALA_DE_ESPERA.md` y la migración 07.

La cotización deportiva sigue compartida por liga. Crear otro torneo inicializa únicamente cotizaciones faltantes, antes del sorteo. Los precios de cláusula y sus aumentos siguen siendo independientes por torneo y se conservan en las transferencias.

La evolución usa el signo de `forma - notaEsperada`, límites de la liga y unidades enteras. La forma pondera hasta cinco partidos, del más reciente al más antiguo, con pesos 0,5 / 0,3 / 0,2 / 0,1 / 0,05 normalizados. Los partidos se ordenan por inicio real, nunca por actualización de las notas. Se guarda base, fecha de adopción e historial de movimientos por jugador y liga. Repetir la misma sincronización produce el mismo precio; corregir una nota reconstruye la secuencia desde la base.

La migración conserva los precios existentes como punto de partida: solo evolucionan partidos iniciados desde la adopción del nuevo cálculo. No se inventa cómo llegaron a sus precios las bases antiguas. Un reset explícito del administrador establece una base nueva. Cierres y recuperaciones ejecutan la evolución utilizando ratings ya persistidos, sin consultas adicionales al proveedor; el bloqueo de liga serializa actualizaciones concurrentes.

Los premios por empate ya estaban corregidos: misma puntuación, misma posición y mismo dinero, con posiciones de competición (1, 2, 3, 3, 5).

## Interfaz y retiro

- Navegación Inicio / Mi equipo / Mercado / Liga / Historial, conservando cambios sin guardar al cambiar de sección.
- Inicio muestra ofertas que esperan respuesta, pujas propias, próximo intento de cierre, inicio de fecha, regla de alineación y cantidad de partidos pendientes. Los horarios provienen de MySQL. La hora de carga no se presenta como hora de sincronización del proveedor.
- Historial privado de movimientos económicos: reservas, liberaciones, compras, ventas, premios y ajustes. Se consulta al abrir la sección.
- Cancelar puja mediante botón; bloqueo de envíos duplicados y conservación del diálogo si falla la operación.
- Invitación por enlace que completa el código y solicita confirmar la inscripción; se conserva durante el inicio de sesión.
- Movimientos de alineación mediante selectores y botón, además de arrastrar. Puestos ocupados intercambian jugadores; el banco nunca supera cinco.
- Diálogos de pujas, negociaciones, operaciones con jugadores y retiro con foco inicial, ciclo de Tab, Escape y devolución del foco al disparador.
- Lenguaje visible en castellano, puestos legibles y posiciones iguales para empatados en el ranking.

Abandonar ahora registra `retiredAt`: libera jugadores y reservas, cancela ofertas y conserva participante, planteles, pujas, movimientos y puntos históricos. No se permite volver a ingresar al mismo torneo para repetir el sorteo. Los retirados no reciben nuevos premios ni incrementan la población del mercado; sus fechas anteriores siguen recalculándose con alineaciones históricas. En modo por partido, no suman partidos iniciados después de retirarse. La cuenta con historial no se elimina físicamente mediante el CRUD; una eventual anonimización requiere un flujo específico.

La sala de espera y el permiso del creador para arrancar se implementaron con la aclaración posterior del usuario; ver `SORTEO_Y_SALA_DE_ESPERA.md`. Un calendario de inscripción, otros permisos de organizador y resúmenes sociales compartibles siguen como ampliaciones.

## Privacidad y desarrollo

Las colecciones deportivas globales continúan disponibles desde la base local. Se añade `tournamentId` opcional a las colecciones privadas y se intersecta con los permisos del usuario en el servidor. El parámetro no permite ampliar permisos ni consultar un torneo ajeno. Ofertas rivales continúan sin importe; negociaciones y movimientos solo son visibles a sus partes. Las cachés privadas de la pantalla incluyen usuario y torneo y se invalidan tras operaciones.

El frontend de desarrollo usa `/api` con el proxy a `localhost:3000`; producción usa `environment.production.ts`. El ORM requiere `DATABASE_URL` externa y ya no incluye una credencial literal. Copiar `backend/.env.example` a `.env` y configurar los valores reales. Los secretos se mantienen fuera de Git.

## Instalación y verificación

Aplicar primero las migraciones anteriores, incluida la comprobación previa de economía. Las nuevas son `20261017_05_price_evolution.sql` y `20261017_06_retired_participants.sql`. Reiniciar después el backend. Los archivos están preparados; no se aplicaron a una base de datos desde esta sesión.

Las pruebas cubren: fórmula y límites, orden deportivo, correcciones e idempotencia, selección equilibrada por notas, filtros privados, conservación de historial al retirarse, puntuación tras retiro, movimientos sin arrastrar y accesibilidad de diálogos, además de las regresiones anteriores. La persistencia se simula; falta verificar migraciones y concurrencia contra MySQL real. El build Angular de desarrollo está verificado; el backend completo continúa con los problemas de resolución de tipos documentados previamente.

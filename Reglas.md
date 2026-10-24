# Reglamento de Fantasy Argentina

Decisiones acordadas el 17 de octubre de 2026. Este archivo es la referencia funcional vigente. El estado de implementación está en `Paso a paso.md`.

## Torneos y configuración

Cada usuario puede crear un torneo o unirse mediante su código. `Participant` guarda sus datos dentro del torneo: plantel, presupuesto y puntos.

Al crear el torneo se eligen nombre, liga, presupuesto inicial, días de espera para habilitar cláusulas y permisos para cambiar la alineación o ejecutar cláusulas durante una fecha. Estos controles ya existen.

También debe poder elegirse la modalidad de transferencias: inmediatas o diferidas. Esa selección es un requisito confirmado pendiente de conectar al modelo y al formulario actual. El cierre automático se programa a último inicio + 5h y se posterga 4h si un partido sigue en curso; no se añade otra espera obligatoria de cuatro horas a todos los torneos. El instante efectivo de la modalidad diferida debe quedar explícito al implementarla.

## Plantel y alineación

- Capacidad: 11 titulares y 5 suplentes.
- En torneos nuevos, crear o inscribirse abre una sala de espera sin jugadores. Cuando el creador pulsa Arrancar torneo se asignan once por participante: 1 arquero, 4 defensores, 4 mediocampistas y 2 delanteros. Después del arranque se admiten nuevos participantes, que reciben once aleatorios excluyendo los planteles y el mercado abierto del torneo.
- Los suplentes se incorporan mediante el mercado o transferencias.
- Los jugadores son exclusivos dentro de cada torneo, con una propiedad relacional única. Cada alineación conserva once puestos explícitos, incluso cuando alguno está vacío.
- El sorteo inicial conjunto equilibra el promedio de las notas deportivas guardadas de los jugadores, sin utilizar sus precios ni la posición de los participantes en el ranking.
- Los cambios de alineación deben guardarse. Durante una fecha se aplica la configuración elegida para el torneo.
- Sin cambios habilitados, se puntúa la alineación vigente al inicio de la fecha. Con cambios habilitados, cada partido usa la alineación vigente al comenzar ese partido; un cambio posterior no altera puntos de partidos que ya comenzaron.
- Titulares, puestos y capitán se conservan históricamente. Una compra o venta posterior no modifica esa alineación.
- Un jugador fuera de posición recibe una penalización de 3 puntos.
- El capitán duplica sus puntos. El código actual duplica el aporte después de aplicar la penalización; no se cambia esa operación en la corrección de permisos.

## Mercado y pujas

El mercado de cada fecha contiene **3 jugadores por participante**. Las pujas son a sobre cerrado: cada participante puede consultar su importe y la cantidad de ofertas por jugador; no puede consultar los importes rivales.

La oferta mínima es el valor de mercado traducido del jugador. Los importes se expresan en unidades enteras de moneda del juego. El mínimo se redondea hacia arriba si la cotización es fraccionaria. El monto se reserva y continúa formando parte del banco, pero no puede gastarse en otra operación. Al ganar se cobra; al perder o cancelar se libera la reserva.

Gana la mayor oferta válida. A igual importe se aplica la prioridad temporal de la oferta. Una oferta de cero representa cancelación y nunca gana.

## Cierre, puntos y premios

El cierre se ejecuta automáticamente **5 horas después del último inicio previsto**. Si al consultar algún partido sigue en curso, se reprograma **4 horas más tarde**, sin consultas intermedias. Se sincronizan rendimientos, resuelven pujas, calculan puntos, renueva el mercado y entregan premios, en ese orden. El tratamiento de postergados debe conservar la alineación histórica y distinguir datos pendientes de un jugador que no jugó.

Para un postergado, los torneos bloqueados mantienen la alineación de la fecha original. Los torneos con cambios habilitados usan la alineación vigente al comenzar el partido reprogramado. Las correcciones recalculan la fecha conservando los aportes de los demás partidos. Si falta historia antigua, se informa el faltante y no se reemplaza por el plantel actual.

Los puntos proceden de la nota del proveedor deportivo; en el flujo actual se lee `statistics.rating`. No jugar aporta cero; una respuesta faltante del proveedor no demuestra por sí sola que el jugador no jugó.

Hay clasificación general acumulada y clasificación por fecha. Los premios base por ubicación son 1M para los puestos 1–3, 1,5M para 4–6, 2M para 7–9 y así sucesivamente. **Participantes empatados en puntos deben recibir el mismo premio.** Los empatados comparten la primera posición ocupada por su grupo (por ejemplo 1, 2, 3, 3, 5), incluso cuando el grupo cruza el límite de un tramo.

## Negociaciones y transferencias

Las ofertas y contraofertas solo pueden ser gestionadas por sus participantes. Responde el vendedor a una oferta activa y el comprador a una contraoferta. Solo quien tiene el turno puede aceptarla.

La modalidad inmediata o diferida se elige al crear el torneo. Transferir un jugador no cambia puntos de fechas previas. Las ofertas del comprador reservan fondos. Una contraoferta del vendedor libera el compromiso previo y el comprador reserva/paga el nuevo monto al aceptarla; el vendedor no puede inmovilizar fondos adicionales ajenos. Rechazar o cancelar libera la reserva correspondiente.

## Compra por cláusula y blindaje

La compra directa por cláusula tiene un precio inicial de **valor traducido + 3.000.000**. Esta fórmula se refiere a la cláusula, no al importe ganador de una puja ni al precio negociado entre participantes.

El dueño puede aumentarla invirtiendo dinero en ese torneo: cada unidad invertida aumenta la cláusula en dos. Al comprar el jugador por esa cláusula, el nuevo dueño conserva el precio de la cláusula que pagó hasta que vuelva a aumentarlo. No se reinicializa al precio por defecto por cambiar de dueño. Los aumentos no se comparten con otros torneos.

La ejecución depende de los días de espera configurados y del permiso durante una fecha. El cooldown actual tras una compra por cláusula es de diez minutos. Solo el propietario puede blindar, y el servidor calcula la cláusula inicial desde su valoración local.

## Venta rápida y privacidad

La venta rápida paga el 70 % del valor de mercado, redondeado hacia abajo a unidades enteras. Solo el dueño puede ejecutarla.

Un usuario regular no puede modificar directamente su saldo, su puntaje, roles o datos deportivos. El banco total puede ser visible para los rivales; los importes reservados y disponibles son privados para evitar deducir ofertas. Las credenciales y el correo no se publican mediante relaciones de otras entidades.

## Ejecución automática y postergados

El cierre aplica a todos los torneos de la liga, cinco horas después del último inicio previsto de los partidos regulares, con reintento cuatro horas después si alguno sigue en curso: ratings, pujas, puntos/rankings, mercado siguiente y premios, en ese orden. Los pendientes se revisan en cada cierre, sin consultas diarias adicionales. Una reprogramación dispara recuperación de ratings y recálculo histórico a inicio + 5h, sin repetir premios económicos. Ver `docs/CIERRE_AUTOMATICO.md` para reglas operativas, disponibilidad del backend y casos sin partidos jugados.

Los controles de economía, propiedad y puestos se describen en `docs/ECONOMIA_Y_PLANTELES.md`, junto con las garantías de migración y conservación del historial.

## Sorteo equilibrado, cotización y retiro

El sorteo inicial conjunto busca promedios de calidad similares con las notas deportivas locales. Los puestos de cancha solo completan los once y no son posiciones de clasificación. No se garantiza igualdad exacta ni de rendimiento futuro. Ver `docs/SORTEO_Y_SALA_DE_ESPERA.md`. La cotización deportiva es compartida por liga; la cláusula aumentada pertenece al torneo. Ver la especificación técnica en `docs/PRECIOS_EXPERIENCIA_Y_PRIVACIDAD.md`.

Retirarse libera jugadores y reservas y conserva el historial. No habilita otro sorteo en el mismo torneo. Los retirados no reciben premios futuros ni cuentan para poblar nuevos mercados. Sus aportes previos se conservan; si se permiten cambios por partido, dejan de aportar en partidos iniciados después del retiro.

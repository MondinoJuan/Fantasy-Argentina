# Correcciones 3, 4 y 5 de la devolución original

La numeración de la respuesta original es: **3, cierres repetibles; 4, economía común; 5, propiedad, puestos y límites de plantel**. No coincide con la numeración de las secciones del diagnóstico extenso.

## 3. Cierres seguros e historial

El cierre conserva el orden ratings → pujas → puntos → mercado → premios. Las operaciones locales y `closureCompletedAt` se confirman juntas. Las claves únicas de los movimientos económicos agregan protección por compra y premio. Repetir un cierre completado devuelve su resultado sin volver a modificar cuentas, adjudicaciones o mercado.

Los mercados se archivan con `closedAt`; sus pujas conservan estados ganado/perdido/cancelado. La unicidad de puja pasa a ser **mercado + participante + jugador**, de modo que ofertar en otra ronda no pisa la oferta anterior. Las consultas normales de mercados y pujas muestran los abiertos y las ofertas activas. `?includeClosed=true` permite consultar historial con los mismos controles de privacidad: un rival no recibe importes ajenos.

Si se recupera una fecha anterior a otra que ya cerró, se calculan puntos y premios pendientes de aquella fecha y se liquidan sus mercados antiguos, pero no se genera ni reemplaza el mercado actual. Esto evita avanzar dos veces el mercado por procesar un atraso fuera de orden.

Se conserva la automatización acordada: último inicio + **5 horas**, y reintento + **4 horas** si sigue en curso. Las correcciones de postergados recalculan puntos históricos y no vuelven a pagar premios. Los leases, adquisición condicional y recuperación de trabajos interrumpidos siguen vigentes.

## 4. Economía y reservas

`gameEconomy.service.ts` controla los cambios de dinero y registra `Transaction` con causa, referencia, clave única y saldos anteriores/posteriores. Los importes son **unidades enteras de moneda del juego**, dentro del rango entero seguro de JavaScript. La venta rápida redondea hacia abajo el 70 % de la cotización; el mínimo de una puja y la cláusula inicial redondean hacia arriba una cotización fraccionaria.

Se verifican dos invariantes:

```
disponible + reservado = banco
reservado = pujas activas + reservas de negociaciones vigentes
```

No se corrigen sobregiros aplicando `Math.max(0, ...)`: se rechaza la operación y se revierte su transacción. Se puede usar exactamente todo el disponible. Los ajustes administrativos usan el mismo servicio; no se permite editar disponible o reservado como números independientes.

Todas las operaciones normales de dinero y propiedad toman bloqueos en el mismo orden: liga, participantes ordenados por ID y luego registros de la operación. Incluye pujas, negociaciones, cláusulas, blindajes, venta rápida, inscripción y cierre. La creación de torneo e inscripción confirman participante, once iniciales y mercado en una sola transacción; un fallo no deja un alta a medias. Crear un torneo inicializa solamente cotizaciones que faltan, sin reiniciar las de otros torneos.

### Pujas

El servidor verifica usuario, participante, torneo, liga de la fecha, publicación del jugador, propiedad, espacio disponible, precio mínimo y vencimiento. El mínimo es el mayor entre el mínimo del mercado y la cotización traducida redondeada hacia arriba. El cliente no decide la identidad, un resultado ganador o la prioridad temporal.

Crear reserva el importe. Editar ajusta únicamente la diferencia. Cancelar —mediante DELETE o monto cero— conserva el registro y libera exactamente la reserva, una sola vez. Una puja ganadora consume la reserva y el banco; las perdedoras la liberan. No se modifican pujas de mercados ya cerrados. La primera oferta válida fija `bidDate`; `lastModifiedAt` registra sus cambios. Reactivar una cancelada inicia una nueva prioridad temporal.

### Negociaciones

La oferta activa del comprador reserva el importe. Editarla ajusta la reserva; rechazarla o cancelarla la libera. La aceptación consume la reserva, paga al vendedor y transfiere el jugador en la misma transacción.

Una **contraoferta del vendedor es una propuesta**, no autorización para inmovilizar más dinero ajeno: libera la reserva anterior. Si el comprador la acepta, se comprueba su disponible y se reserva/consume el nuevo monto en esa transacción. Si responde con otra oferta propia, esa oferta vuelve a quedar reservada. Se verifica otra vez quién debe responder y quién posee el jugador.

Una venta, negociación aceptada o cláusula cancela las demás ofertas vigentes por ese jugador y libera sus fondos. Una compra respeta cinco suplentes y dieciséis jugadores. Negociación y cláusula conservan los aumentos de la cláusula al cambiar de dueño; una venta al sistema retira la cláusula del antiguo dueño.

### Movimientos y privacidad

Los movimientos generados por el servicio no pueden editarse o borrarse mediante el CRUD: se registra un ajuste compensatorio. Cada cuenta recibe su propio registro; el endpoint existente de transacciones sigue filtrando por usuario. No se comparten las reservas ni los saldos privados de la contraparte.

Al retirarse un participante se liberan primero las ofertas afectadas. Los registros económicos se conservan con sus datos de cuenta observados y referencias anulables; un torneo vacío también se conserva. La corrección del punto 8 conserva también puntos, planteles y alineaciones con `retiredAt` y evita repetir el sorteo al reingresar (migración 06). Una cuenta con historial de torneo no se elimina físicamente por CRUD; la anonimización requiere un flujo específico.

## 5. Propiedad y puestos

`PlayerOwnership` tiene una fila única por torneo y jugador, con dueño actual o libre. `OwnershipMovement` registra los cambios observados desde la instalación. Los comandos comprueban esa propiedad bajo bloqueo y mantienen su proyección en los planteles; no permiten adjudicar el mismo jugador a dos participantes.

Un participante puede tener un solo plantel activo, también protegido por un índice único condicional en la migración. Se usa una columna virtual indexada, compatible con las restricciones existentes; [MySQL documenta los índices únicos sobre columnas virtuales](https://dev.mysql.com/doc/refman/8.0/en/create-table-secondary-indexes.html). Una clave foránea compuesta exige que el propietario pertenezca al mismo torneo. Se validan formación permitida, once puestos como máximo, cinco suplentes, IDs existentes, ausencia de duplicados y capitán titular. Reordenar una alineación no permite agregar ni quitar jugadores poseídos. Las bajas por venta conservan el hueco y retiran al capitán si corresponde.

`startingSlots` guarda once registros explícitos `{ slotId, realPlayerId }`; vacío es `null`. Los IDs son los mismos de la cancha: `f-0`, `m-0`, `d-0`, `g-0`, etc., según formación. El array antiguo se mantiene como proyección compatible de once lugares, usando cero como hueco. Las copias históricas convierten esos ceros a `null`, sin desplazar jugadores.

La cancha carga esos puestos explícitos y al guardar conserva los vacíos. Arrastrar sobre un puesto ocupado intercambia los jugadores, evitando apilarlos. Sobre un banco lleno también intercambia, sin crear un sexto suplente.

Los bloqueos de alineación dependen del cierre confirmado, no solo de que haya pasado la hora programada. Se respeta la configuración que permite cambios durante una fecha. La puntuación histórica mantiene la regla del punto 2 y el capitán duplica su aporte.

## Migración y base existente

Este cambio **no ejecutó SQL ni modificó una base real**. Con el backend detenido, aplicar las migraciones 02 y 03 si todavía faltan. Ejecutar luego `backend/migrations/20261017_04_economy_ownership_preflight.sql`, que solo consulta datos. Sus resultados deben estar vacíos; si hay filas, revisar y corregir esos datos explícitamente antes de continuar.

Aplicar una sola vez `backend/migrations/20261017_04_economy_ownership.sql` sobre MySQL **8.0.16 o superior**. Incluye restricciones monetarias, registros de propiedad, puestos, archivo de mercados y claves del libro de movimientos. MySQL confirma DDL implícitamente. No usar los SQL históricos de reset ni `DB_SYNC_SCHEMA` en producción.

En el primer arranque, `initializeGameIntegrity`:

1. Valida los planteles y registra propiedad/puestos actuales. No inventa propiedad de fechas anteriores.
2. Guarda un saldo de apertura observado para cuentas antiguas; no lo presenta como reconstrucción de todas sus operaciones previas.
3. Reconcilia la reserva con las pujas y negociaciones activas, registrando las liberaciones de reservas huérfanas. Si el banco no cubre compromisos existentes, se detiene con error.
4. Reserva ofertas activas antiguas que antes no reservaban, en orden de ID. Si ya no alcanzan los fondos, las cancela conservando el registro. Las contraofertas esperan la aceptación del comprador.

Un segundo arranque no repite esos efectos. Si existen jugadores duplicados, dos planteles activos o datos inválidos, el backend informa el error en lugar de elegir silenciosamente un ganador o borrar jugadores. Si antes hubo cierres manuales sin registro, sigue siendo necesario identificar sus fechas como explica `CIERRE_AUTOMATICO.md`.

## Verificación

`npm test` ejecuta las suites reales de dominio y servicios con una frontera de persistencia simulada, además de pruebas de la lógica de la cancha. Incluyen prioridades y reintentos, reservas compartidas, cancelación repetida, rollback, dos compras competidoras, precios de cláusula conservados, límites, puestos vacíos, bloqueos y recuperación de cierres antiguos.

La serialización y rollback de esas pruebas representan el contrato de MySQL, pero no sustituyen una prueba de concurrencia con conexiones MySQL reales. Se comprobó el build Angular de desarrollo. La compilación integral del backend sigue afectada por los problemas previos de resolución de tipos/dependencias; no se validaron las migraciones ni una partida desplegada en esta sesión.

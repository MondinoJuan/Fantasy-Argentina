> CORRECCIONES 3–5 DE LA RESPUESTA ORIGINAL: cierres repetibles e historial de mercados, economía centralizada, propiedad y puestos se implementaron en código. Ver docs/ECONOMIA_Y_PLANTELES.md para alcance, pruebas y migración 04 pendiente de aplicar. La numeración de aquella respuesta difiere de las secciones de este diagnóstico.

> Aclaración posterior implementada: `docs/SORTEO_Y_SALA_DE_ESPERA.md`. El criterio de equilibrio es el promedio de notas deportivas locales, no patrimonio. Los torneos nuevos esperan al creador para el reparto conjunto y admiten ingresos tardíos con once libres.

> Actualización de puntos 7–9: ver `docs/PRECIOS_EXPERIENCIA_Y_PRIVACIDAD.md`. Sorteo, cotización, navegación, retiro con historial y filtros por torneo ya tienen correcciones posteriores a este diagnóstico; las propuestas más amplias de organización siguen identificadas aparte.

> ACTUALIZACIÓN DE AUTOMATIZACIÓN: se implementó el cierre persistente y la recuperación de postergados; ver docs/CIERRE_AUTOMATICO.md y su migración. Los hallazgos originales siguientes no son el estado actual de esas funciones.

> ESTADO POSTERIOR AL DIAGNÓSTICO: las decisiones funcionales fueron aclaradas por el autor y se documentan en Reglas.md. La configuración existente de torneos se reconoce en Paso a paso.md. Esta entrega corrige los permisos y privacidad del punto 1 de la devolución; docs/SEGURIDAD.md describe los cambios. El punto 2 también se implementó en código: docs/ALINEACIONES_HISTORICAS.md explica la regla confirmada por partido y la migración necesaria. El resto del texto conserva el diagnóstico inicial y no representa una lista actualizada de fallas aún abiertas.

# Revisión de Fantasy Argentina

Fecha: 17 de octubre de 2026.

## Alcance y método

Se revisaron los nueve documentos `.md` y `.txt` del repositorio, los tres scripts SQL, los manifiestos y configuraciones, las rutas del backend, las entidades y los flujos centrales de autenticación, torneos, inscripción, alineaciones, mercado, negociaciones, cláusulas, puntuación, automatización e integración deportiva. En Angular se revisaron navegación, sesión, servicios, carga de datos, pantallas, componentes de juego y pruebas existentes.

Es una revisión estática con comprobaciones locales de compilación. Los defectos descritos se sustentan en el código de este checkout. No se probaron ataques contra los despliegues publicados, no se consultó la base de datos ni se verificó el contrato comercial o la cobertura actual del proveedor deportivo. No se modificó código de la aplicación.

Documentación examinada:

- `README.md`.
- `README_Fantasy_Argentina.md`.
- `Reglas.md`.
- `Paso a paso.md`.
- `anterior_readme.md`.
- `listadoAPIs.txt`.
- `comandos.txt`.
- `Formas Base de datos/Tablas relacionales de la BdD.txt`.
- `backend/src/Entities/ExternalApi/services/README.md`.

## Diagnóstico

La idea tiene una identidad reconocible: liga privada entre amigos, jugadores exclusivos, pujas ocultas, negociaciones y cláusulas. El repositorio ya implementa mucho más que una maqueta: tiene Angular, una API Express/TypeScript, MikroORM con MySQL, autenticación con contraseñas scrypt y tokens firmados, reservas en pujas, rankings, bloqueos y jobs persistidos.

El principal trabajo pendiente es hacer confiable ese conjunto. Hoy hay caminos para modificar recursos de otros usuarios, conocer pujas ajenas, recalcular puntos usando planteles actuales y repetir efectos económicos de un cierre. Esos problemas comprometen una partida incluso con pocas personas. La prioridad debería ser asegurar que una temporada completa funcione sin intervención manual y conserve su historia.

## 1. Documentación: unificar decisiones y describir la realidad

### 1.1. Contradicciones funcionales

| Tema | Diferencias encontradas | Decisión que hace falta |
|---|---|---|
| Tamaño del mercado | 3 por participante, 4 por participante y 3–4 por participante | Un valor predeterminado explícito y, si interesa, configurable por torneo. El código central usa 4. |
| Cierre | 3 horas en un roadmap, 4 horas en varios textos, 8 horas en `Paso a paso.md` | Distinguir fin deportivo, bloqueo de alineación, cierre del mercado y publicación definitiva de puntos. |
| Efectividad de transferencias | Inmediata en algunas descripciones; cuatro horas después del cierre o de la aceptación en otras | Una regla por tipo de operación y por fecha de vigencia. |
| Monto de oferta | Mayor que el valor; mayor o igual que el valor | Definir si se acepta igualdad y permitir gastar exactamente el saldo disponible cuando corresponda. |
| Cláusula | Precio de compra × 2,5; conservación al negociar; valor inicial sin definir | El backend también utiliza como alternativa valor traducido + 3M. Elegir una regla única. |
| Plantel | Once iniciales; interfaz anuncia once titulares más cinco suplentes | Diferenciar jugadores entregados al iniciar, límite total y mínimo de alineación. |
| Capitán | El código duplica su aporte | Documentar selección, bloqueo, ausencia y tratamiento de penalizaciones. |
| Puntajes | Documentos hablan de `ranking`; flujo actual usa `statistics.rating` | Documentar el mapeo exacto, precisión, faltantes y revisiones del proveedor. |
| Proveedor y competiciones | IDs, temporadas y endpoints de distintas etapas del proyecto | Mantener un catálogo versionado por proveedor, competición y temporada. |

No conviene resolver estas diferencias eligiendo silenciosamente el documento más nuevo. Cada decisión debe quedar aprobada como regla del juego y tener ejemplos y casos límite.

### 1.2. Roadmap y arquitectura desactualizados

El roadmap mantiene sin marcar funcionalidades que ya tienen implementación. También presenta SQL como backend, cuando el servidor real es Node.js/Express con TypeScript y MikroORM. El árbol propuesto no coincide con las carpetas actuales.

Propuesta documental:

- `README.md`: propósito, estado real, instalación reproducible y enlaces.
- `docs/reglas.md`: reglamento único con versión y ejemplos.
- `docs/arquitectura.md`: componentes, modelo actual y contratos.
- `docs/operacion.md`: configuración, migraciones, sincronización, recuperación y backups.
- `docs/decisiones/`: decisiones como postergados, empates, cláusulas y cierre.
- `docs/archive/`: borradores históricos claramente identificados.

Cada funcionalidad debería figurar como propuesta, implementada, probada o habilitada. Tener código no demuestra que el flujo esté validado de punta a punta.

### 1.3. Fórmulas y ejemplos

La fórmula inicial de traducción de precios de `Paso a paso.md` tiene invertido el cociente respecto de la de `README.md` y de la normalización del código. Conviene eliminar la variante equivocada y agregar ejemplos para mínimo, máximo, valor intermedio y liga con todos los valores iguales.

## 2. Permisos y privacidad: prioridad crítica

### 2.1. Operaciones sobre recursos ajenos

`backend/src/app.ts` exige autenticación para la mayor parte de `/api`, pero muchas rutas y controllers no exigen rol ni verifican pertenencia al recurso. La búsqueda de `authUser` y `requireRole` muestra que esos controles se concentran en usuarios y autenticación.

Por ejemplo, `participant.controler.ts` permite recibir y modificar presupuesto y puntaje; `joinByTournamentCode`, `leaveTournament` y otros métodos confían en IDs del body. `negotiation.controler.ts` no comprueba que quien acepta sea el participante al que le toca responder. Las escrituras de rendimientos, mercados y otros datos administrativos también necesitan una política explícita.

Consecuencia: disponer de un token válido no debería permitir actuar como cualquier participante ni administrar datos deportivos.

Mejora:

- Derivar el usuario de la sesión autenticada.
- Resolver en el servidor su participante dentro del torneo.
- Verificar pertenencia y autorización en cada operación.
- Reservar escrituras administrativas al superadmin.
- Restringir la modificación de configuración al organizador del torneo y registrar los cambios.
- Definir una matriz de permisos y probarla con dos usuarios y dos torneos distintos.

Los guards de Angular sirven para navegación; no sustituyen estas verificaciones.

### 2.2. Escalamiento de rol al editar el propio usuario

En `backend/src/Entities/User/user.controler.ts`, `update` comprueba que un usuario regular solo edite su cuenta, pero luego admite `type` dentro de los datos asignados. El campo puede tomar `SUPERADMIN` sin exigir que el solicitante ya tenga ese rol. La creación tiene otra validación, pero esa protección no se aplica a la actualización.

Mejora: separar actualización de perfil de administración de roles. El perfil personal no debe aceptar `type`. También conviene retirar del registro público el campo de código de superadministrador y provisionar esa cuenta mediante un procedimiento administrativo.

### 2.3. Las pujas no son secretas en la API

`backend/src/Entities/Bid/bid.controler.ts`, en `findAll`, `findOne` y `findByTournamentAndRealPlayer`, devuelve entidades que incluyen `offeredAmount` de otros participantes. Angular descarga las pujas completas para armar la vista.

Ocultar el monto en el componente no evita que se lea en la respuesta HTTP.

Mejora: devolver para cada jugador el contador permitido y la oferta del solicitante; devolver montos ajenos solo si el reglamento permite publicarlos después del cierre. Aplicar también esa política a los endpoints de detalle.

### 2.4. Datos personales y serialización

Hay consultas globales con `populate` de usuarios y respuestas directas de entidades. `User.password` no está declarado como campo oculto. Aunque los endpoints propios de usuario sanitizan su salida, se debe verificar la serialización de usuarios anidados en participantes y negociaciones.

Mejora: DTOs explícitos para cada respuesta y campo de contraseña excluido de toda serialización. Los rivales necesitan nombre público y datos del juego; no necesitan correo ni hash de contraseña. Este riesgo requiere una prueba de respuesta real para determinar el alcance exacto.

## 3. Alineaciones y puntos históricos: prioridad crítica

### 3.1. Se puntúa usando la alineación más reciente

`sumEndOfMatchdayPoints` en `tournament.controler.ts` carga planteles, construye `latestSquadByParticipantId` y usa el plantel preferido actual. No selecciona una alineación inmutable asociada a la fecha que está calculando.

Ejemplo: un participante tenía a un jugador en la fecha 4, lo vende en la fecha 5 y después se procesa un postergado de la fecha 4. El sistema necesita recordar quién lo alineó y en qué puesto en la fecha 4. El plantel actual no responde esa pregunta.

Mejora: crear una alineación por participante y fecha, con puestos explícitos, capitán y hora de cierre. Guardarla antes del comienzo deportivo y puntuar siempre contra esa versión. Un traspaso posterior no debe alterar la atribución histórica.

### 3.2. Propiedad, plantel y alineación están mezclados

`ParticipantSquad` contiene arrays JSON de IDs de jugadores titulares y suplentes. La propiedad se infiere de esos arrays. `DependantPlayer` es único por torneo y jugador, pero esa unicidad no impide que dos arrays de participantes contengan el mismo ID.

Propuesta mínima:

- Una posesión por jugador y torneo con propietario actual y vigencia.
- Un historial de movimientos de propiedad.
- Una alineación por participante y fecha.
- Un detalle por puesto de esa alineación.

Esto permite restricciones relacionales y evita reconstruir propietarios recorriendo arrays.

### 3.3. Validación incompleta de alineaciones

El controller de planteles normaliza IDs y valida parcialmente al capitán, pero no verifica de forma completa propiedad, exclusividad, cantidad de titulares, suplentes, duplicados y formación permitida. El cálculo puede recorrer más de once titulares aunque el mapa de posiciones solo cubra los puestos esperados.

En Angular, el drag and drop transfiere elementos entre arrays y al guardar aplana los puestos. Si un puesto queda vacío, desaparece su lugar en el array; si tiene varios jugadores, puede alterar la interpretación de todos los siguientes.

Mejora: persistir `slotId` con su jugador, permitir como máximo uno por puesto y validar en el servidor todas las invariantes. Un hueco debe seguir siendo un hueco.

La asignación inicial ordena arquero, defensores, mediocampistas y delanteros, mientras el mapa usado para penalizaciones espera delanteros primero y arquero último. Si se calcula sin una normalización y guardado posterior, ese orden puede producir penalizaciones incorrectas. Un contrato único de puestos elimina la dependencia del orden implícito.

### 3.4. Regla de puntos completa y auditable

Hoy se resta la penalización antes de duplicar el capitán. Además, si no hay rendimiento, el cálculo omite al jugador; eso mezcla ausencia deportiva con falta de datos y deja sin resolver la penalización por posición en ese caso.

Hay que decidir y documentar:

- Ausencia real, partido postergado y dato pendiente del proveedor.
- Precisión decimal y redondeo.
- Si el capitán duplica también penalizaciones.
- Suplencias automáticas o manuales.
- Jugador con más de un partido en una fecha.
- Correcciones de notas y conservación del desglose.

El desglose debería guardar nota base, modificadores, total y versión de la regla. La unicidad actual por participante/fecha/jugador y la referencia a una sola performance dificultan explicar contribuciones de varios partidos.

## 4. Mercado y economía: prioridad crítica/alta

### 4.1. Validaciones de puja deben vivir en el servidor

`bid.controler.ts` usa transacciones y bloqueos de escritura, lo cual es una base útil. Sin embargo, no valida de forma integral monto finito y no negativo, precio mínimo, jugador incluido en el mercado indicado, coherencia del torneo, participante y plazo.

El ajuste de reserva usa la diferencia de montos sin rechazar ofertas negativas. Una diferencia negativa aumenta el disponible y reduce la reserva. `Math.max(0, ...)` puede ocultar la ruptura del balance en vez de impedirla.

La actualización también admite cambiar participante, jugador, torneo y estado. Esos campos no deberían ser editables por el cliente de forma genérica.

Mejora: comandos específicos para ofertar y cancelar, con campos limitados y validación transaccional. Registrar fecha de primera oferta válida y última modificación para aplicar un desempate definido.

### 4.2. Cancelar o borrar no debe dejar reservas huérfanas

`remove` de pujas elimina el registro sin liberar la reserva. Cambiar el estado también puede dejar montos reservados porque el ajuste se basa en el importe y no en la transición de estado.

Mejora: transiciones explícitas y atómicas; cancelación conserva el registro e invalida la oferta liberando exactamente su reserva. El borrado físico debe quedar fuera del flujo normal.

### 4.3. Negociaciones no implementan la reserva descrita

Crear y modificar negociaciones persiste datos, pero no reserva dinero como exigen los documentos. La aceptación descuenta directamente del disponible y banco, sin consumir una reserva de negociación.

Hay que elegir entre dos contratos coherentes: oferta que reserva fondos desde su creación, u oferta sin garantía que vuelve a validar saldo al aceptarse. Si se mantiene lo documentado, crear, contraofertar, rechazar, cancelar y aceptar deben actualizar la reserva en la misma transacción.

También falta verificar el turno de respuesta, pertenencia al torneo, vigencia de la propiedad y liberación de otras ofertas cuando el jugador se transfiere.

### 4.4. Cierre del mercado con candidatos inconsistentes

En `settleMarketAndRefreshByLeague`:

- La consulta de pujas no exige estado activo; el filtro competitivo solo exige monto positivo.
- Se descuentan importes con `Math.max(0, ...)` sin demostrar nuevamente las precondiciones de reserva y saldo.
- Se construye el conjunto de jugadores poseídos antes de adjudicar los ganadores y no se agregan a ese conjunto los recién comprados. Por eso pueden volver a ser candidatos del mercado recién generado.
- Se eliminan mercados, cuya relación con pujas tiene borrado en cascada. Esto compromete el historial del resultado.
- No se impone el límite de plantel anunciado por la interfaz al agregar ganadores al banco.

Mejora: liquidar una ronda identificada, con ofertas activas válidas, actualizar propiedad antes de generar el próximo pool y conservar el mercado cerrado con sus resultados.

### 4.5. La economía necesita un registro de movimientos

Existe la entidad `Transaction`, pero los flujos centrales examinados de compra, venta rápida, cláusula y negociación no crean sistemáticamente ese registro. Los saldos se modifican directamente en varios controllers.

Mejora: centralizar operaciones económicas y guardar movimientos con causa, actor, fecha y clave única. Dinero disponible debería derivarse de saldo menos reservas, o mantenerse como proyección verificable; tres números editables por separado crean estados imposibles.

Usar enteros en una unidad monetaria definida o decimales explícitos, con redondeo uniforme en ventas al 70 %. La precisión de puntajes también debe ser explícita en el esquema, no solo en TypeScript.

### 4.6. Concurrencia

Una transacción por sí sola no garantiza que dos operaciones concurrentes no lean el mismo saldo o propietario. Pujas usan bloqueos, pero aceptación de negociaciones, cláusulas, ventas y liquidación no aplican la misma política.

Mejora: bloqueos o actualizaciones condicionales en orden consistente, restricciones únicas de propiedad y pruebas de dos compras o ventas simultáneas. El resultado permitido es una sola transferencia y un solo cobro.

## 5. Cierres y postergados: prioridad crítica/alta

### 5.1. Tener una clave de job no vuelve idempotente cada efecto

`MatchdayAutomationJob` ya tiene clave única y estados persistidos. Sin embargo, el cierre llama sucesivamente a cálculo de puntos, liquidación/premios y precios. Si una etapa confirma cambios y una posterior falla, el reintento puede repetir etapas confirmadas.

`settleMarketAndRefreshByLeague` otorga premios cada vez que se ejecuta; no existe en ese flujo una marca única de premio por participante y fecha. Una llamada repetida también puede liquidar el mercado recién creado.

Mejora: dividir el cierre en pasos con identidad persistente y garantizar unicidad de sus efectos. Ejemplos: premio por torneo/fecha/participante y liquidación por ronda de mercado. Repetir un paso completado debe devolver el resultado previo sin efectos adicionales.

### 5.2. Jobs interrumpidos y múltiples instancias

Los flags `processing`, `seeding` y `schedulerStarted` son locales al proceso. Dos servidores pueden seleccionar los mismos jobs pendientes. Si el servidor cae después de marcar un job `running`, no se observa recuperación automática por vencimiento de ese estado.

Mejora: adquisición atómica del trabajo, un plazo de posesión renovable y recuperación de jobs abandonados. Un worker separado puede seguir usando MySQL como cola para esta escala; no es necesario introducir varios servicios nuevos para resolverlo.

### 5.3. Recuperación de varias fechas pendientes

El seeding y `executeClosureJob` usan `isLatest` y pueden posponer el cierre completo de fechas antiguas hasta que sean la última vencida. Esto necesita una prueba específica después de una caída prolongada: todas las fechas históricas deben puntuar, pero los mercados deben avanzar conforme a una política explícita.

Mejora: separar recuperación de puntuación histórica de avance de mercado. Ordenar por temporada y fecha deportiva, y no asumir que ordenar solo por número de jornada sirve entre temporadas.

### 5.4. Postergados después del cierre

El seeding recorre fechas en orden descendente y se detiene al encontrar una completada. Ese recorrido puede excluir las fechas completadas que todavía tienen partidos postergados. Además, `postponed_match_sum` recalcula puntos sin sincronizar primero el rendimiento de ese partido en ese mismo flujo.

Mejora: consultar de manera independiente todos los partidos pendientes de resolución, aunque su fecha fantasy esté cerrada. Sincronizar el partido, validar datos y recalcular contra la alineación histórica.

### 5.5. Dato incompleto no equivale a cero

El proceso de ratings captura errores por partido, los registra y puede terminar sin propagar un fallo al cierre. El scheduler no recibe un resultado estructurado que indique si ya están completos los datos necesarios para publicar y premiar.

Mejora: estados de puntos provisionales y definitivos, conteo de partidos esperados/procesados y bloqueo de publicación definitiva cuando falten datos. Definir cómo se corrigen premios si cambia una nota o se juega un postergado.

### 5.6. El bloqueo depende del reloj, no de la finalización del trabajo

El bloqueo de planteles se resuelve con fechas y `autoUpdateAt`. Si el procesamiento se retrasa, el reloj puede desbloquear cambios antes de que el cálculo termine. Esto agrava el uso del plantel actual.

Una alineación congelada al comienzo permite separar la actividad del mercado del estado de procesamiento. No hace falta confiar en una espera arbitraria de cuatro horas para atribuir los puntos al dueño correcto.

## 6. Cláusulas y blindajes

`executeClausePurchase` comprueba la ventana de bloqueo de la fecha y el cooldown del jugador, pero no se observa una comprobación de `Tournament.clauseEnableDate`. La interfaz sí muestra esa fecha. La regla debe verificarse también en el servidor.

`applyShielding` acepta un participante y descuenta sus fondos, pero no verifica que sea el propietario autorizado de la cláusula. También hace falta resolver cómo se actualiza o elimina la cláusula cuando un jugador se vende al sistema, y qué ocurre con ofertas pendientes.

Mantendría como configuración inicial cláusulas opcionales, con protección suficiente para quien no puede conectarse inmediatamente. Los diez minutos implementados pueden favorecer disponibilidad horaria más que estrategia. Una alternativa a evaluar con el grupo es protección hasta la siguiente ventana de mercado; es una decisión de diseño, no un defecto técnico demostrado.

## 7. Precios y equilibrio del juego

### 7.1. El ajuste por rendimiento se sobrescribe

El proceso de ratings llama a `updateRealPlayerTranslatedValuesByLatestFormForCompetition`, que ajusta los precios según forma reciente. Luego `executeClosureJob` llama a `translateLeagueRealPlayersValues`, que recalcula los mismos valores desde el valor real inicial entre 1M y 7M. Esto sobrescribe la evolución que acaba de calcularse.

Crear un torneo también llama dos veces a la traducción inicial y modifica valores compartidos de la liga. Crear una nueva partida no debería reinicializar la economía de partidas existentes.

Mejora: separar inicialización y evolución. Decidir si la cotización es global por competición o independiente por torneo, registrar su historia y hacer un solo ajuste por período deportivo.

### 7.2. La fórmula no sigue siempre el desvío

La decisión de qué factor aplicar depende de si la nota es mayor o menor que 6, en lugar del signo de `nota - notaEsperada`. Si la nota es exactamente 6, el valor no cambia. En el máximo, una nota de 7 tiene desvío negativo, pero el factor de subida vale cero y puede dejar el precio inmóvil.

Mejora: formular la variación en función del desvío, aplicar límites y probar extremos. Ordenar la forma reciente por fecha real del partido: hoy se usa `updateDate`, y refrescar notas antiguas puede alterar qué se considera reciente.

### 7.3. Inicio justo y población del mercado

Once jugadores sorteados sin controlar valor total o probabilidad de jugar pueden dar ventajas grandes antes de la primera decisión. Además, el proceso de inscripción excluye todos los jugadores que ya tengan `DependantPlayer`, incluso si están libres y solo aparecieron antes en el torneo.

Mejora: sorteo por posiciones con patrimonio aproximadamente equivalente, excluir solo jugadores realmente poseídos o reservados y fijar un cupo de participantes según disponibilidad por posición. Permitir reingreso no debería servir para repetir sorteos hasta conseguir un plantel favorable.

La creación e inscripción hacen `flush` intermedios sin una transacción envolvente de todo el caso de uso. Un fallo al completar el mercado puede dejar un alta parcialmente persistida. El sorteo, la posesión, el participante y el mercado inicial deben confirmarse juntos.

### 7.4. Incentivos y empates

El premio creciente para quienes quedan abajo puede ayudar a mantener la competencia. Hay que simular si vuelve rentable perder deliberadamente una fecha. También hay que fijar premios para empates: el código desempata aleatoriamente y dos empatados a ambos lados de un tramo pueden recibir distinto dinero.

Recomiendo misma recompensa para empatados o un desempate público y reproducible. Separar el nombre de premio compensatorio del modo draft evitaría confundir ambas mecánicas.

## 8. Experiencia para jugar con amigos

Las siguientes propuestas son de producto basadas en las pantallas y flujos del código; no sustituyen una evaluación visual en dispositivos reales.

### 8.1. Inicio de torneo organizado

Agregar un organizador de torneo distinto del superadmin técnico, sala de espera, invitación por enlace, cupo, fecha de inicio y cierre de inscripción. Establecer qué pasa con ingresos tardíos, retiros, abandono del organizador y final de temporada.

Actualmente abandonar elimina participante, alineaciones y puntos históricos. Para una competición iniciada es preferible conservar el historial y marcar al participante retirado; liberar sus jugadores y resolver ofertas mediante una regla explícita.

### 8.2. Pantalla centrada en la próxima decisión

La vista del torneo combina plantel, mercado, negociaciones, todos los equipos rivales y ranking en una página. Conviene distribuirla en Inicio, Mi equipo, Mercado, Liga e Historial, con navegación cómoda en celular.

Inicio debería responder: cuándo cierra la alineación, si está guardada, cuándo se resuelven las pujas, cuántas ofertas esperan respuesta, cuántos datos faltan y cuándo se actualizó por última vez.

### 8.3. Lenguaje y acciones

Reemplazar `squad`, `matchday`, `participant`, `publicCode` y campos técnicos por Plantel, Fecha, Participante y Código de invitación. Un botón Cancelar puja expresa mejor la acción que pedir ingresar cero.

Mostrar sueldo o moneda de juego de forma uniforme; el documento mezcla EUR con signos de pesos. Descomponer el dinero reservado por oferta y explicar qué ocurrirá al ganar o perder.

### 8.4. Retención social

Priorizar un resumen de la fecha, cambios de posición, historial de fichajes, ganadores de pujas una vez publicados y avisos de ofertas y cierres. Un enlace compartible con el resumen puede cumplir mejor el objetivo entre amigos que desarrollar primero un chat completo.

Sumaría desempates claros, reglas visibles dentro del torneo y registro de toda corrección administrativa con motivo. Evitar que la partida dependa de que el creador también tenga acceso técnico a toda la base.

### 8.5. Accesibilidad y errores

Además de arrastrar jugadores, permitir seleccionar y asignar a un puesto, útil para teclado y pantallas táctiles. Los modales deben manejar foco, Escape y retorno al disparador. Distinguir errores de saldo, ventana cerrada, datos pendientes y desconexión, en lugar de mostrar fallos genéricos o detalles internos.

## 9. Arquitectura, rendimiento y operación

### 9.1. Conservar el stack y reducir acoplamiento

Angular + Express + MySQL son una base razonable para este alcance. El mayor beneficio vendría de reorganizar casos de uso, no de reescribir todo.

Hay controllers de aproximadamente 1.760 y 1.573 líneas y una página de torneo de 1.010. El scheduler incluso construye objetos Request/Response simulados para invocar controllers.

Extraer servicios de mercado, economía, transferencias, puntuación y sincronización. Rutas y controllers traducen HTTP; los servicios aplican reglas y los workers llaman a esos mismos servicios directamente.

### 9.2. Contratos y consultas específicas

`loadTournamentPage` realiza catorce consultas iniciales, muchas globales, y luego filtra en el navegador por torneo o liga. Se descargan incluso pujas y negociaciones que no corresponden al usuario.

Crear endpoints por torneo: resumen, mi equipo, mercado paginado, mis ofertas y clasificación por fecha. Filtrar y autorizar en el servidor. Dividir `ApiService` por dominio y definir DTOs estables para retirar el uso extendido de `any` y los múltiples alias de cada campo.

Las cachés actuales usan claves globales. Conviene incluir usuario/torneo y limpiar al cambiar de sesión; invalidar por operación y presentar frescura de datos. No hace falta que cada actualización recargue todas las colecciones.

### 9.3. Migraciones y SQL histórico

Los scripts SQL no reproducen las entidades actuales: por ejemplo, planteles y mercados usan relaciones por jugador en los scripts y arrays JSON en el ORM; faltan entidades y campos posteriores. El seed usa columnas, estados y hashes de contraseña de otras versiones.

`Triggers.sql` no constituye una implementación utilizable de las reservas: utiliza `bid` donde debería referirse a la fila `NEW` y `AND` entre asignaciones. Además, mantener reserva tanto en trigger como en aplicación duplicaría responsabilidad.

Mejora: migraciones versionadas, seed sintético coherente y una única autoridad para cada regla. Señalar que el script de creación contiene DROP TABLE y es un reset, no una migración. No ejecutar los scripts existentes sobre una base con datos de juego.

### 9.4. Configuración y desarrollo local

El frontend tiene fija la URL de Railway, aunque existe un proxy local. Así, levantar Angular localmente puede dirigir operaciones a ese servidor publicado. Usar configuración por entorno y backend local predeterminado en desarrollo.

Faltan instrucciones completas y un `.env.example` sin secretos. Documentar versión de runtime, instalación con lockfiles, MySQL, migraciones, datos mínimos y sincronización. El repositorio contiene una credencial de desarrollo literal en la configuración del ORM; conviene reemplazarla por configuración local externa.

### 9.5. Integración deportiva y operación

Hay adaptador dedicado y concurrencia limitada en parte del proceso, pero el cliente HTTPS no define timeout de conexión/lectura. El timeout HTTP de Express no cancela necesariamente el trabajo ni la petición al proveedor.

El proceso de ratings recorre todos los partidos finalizados de la competición, en lugar de solo los pendientes de sincronizar o corregir. Esto aumenta llamadas y puede perjudicar la cuota a medida que avanza la temporada.

Mejora: contrato tipado del proveedor, fixtures de respuestas para pruebas, timestamps de sincronización, actualización incremental, timeout y cancelación, reintentos acotados, respeto de Retry-After y reporte estructurado de completitud. Distinguir IDs de proveedores/versiones para impedir cruces silenciosos.

Agregar métricas de jobs, cierre retrasado, partidas sin datos, reservas inconsistentes y cuota consumida; backups y ensayo de restauración. Mantener una pantalla de operación con reintentos seguros y trazabilidad, en vez de depender de CRUD manual para corregir resultados.

## 10. Pruebas y verificación realizadas

En el backend no hay script de pruebas ni suite de dominio en el árbol revisado. Los tests de Angular son principalmente generación de componentes; hay incluso expectativas del título inicial de Angular. No prueban las reglas que definen una partida.

Comprobaciones locales:

| Comprobación | Resultado | Interpretación |
|---|---|---|
| TypeScript backend con `tsc --noEmit -p tsconfig.json` | Falló | Aparecen errores de exports/tipos de MikroORM y tipos base de Express. El árbol de dependencias local presenta resolución incompleta; se requiere instalación limpia desde el lockfile antes de atribuir cada error al fuente. No se validó un backend compilable. |
| Angular `ng build` de producción | Bloqueado | El proceso no pudo resolver `fonts.googleapis.com` para incorporar Inter. Es una limitación de red en esta comprobación; no demuestra un defecto funcional de Angular. |
| Angular `ng build --configuration development` | Correcto | Se generó el bundle de desarrollo. No equivale a un build de producción verificado ni a pruebas funcionales. |
| Revisión de SQL y jobs | Estática | No se ejecutaron scripts, migraciones ni cierres contra la base. |

Pruebas que darían mayor valor:

1. Usuario A no lee ofertas privadas ni modifica recursos de B; tampoco cambia su rol.
2. Una puja reserva exactamente el importe; editar, cancelar, perder y ganar conservan el balance.
3. Negociaciones y pujas compiten por el mismo saldo sin permitir sobregiro.
4. Dos compras simultáneas del mismo jugador producen un solo dueño y cobro.
5. Repetir un cierre no duplica premios, compras ni mercados.
6. Caer entre pasos y reiniciar termina el cierre sin repetir efectos.
7. Transferir un jugador no cambia puntos históricos; un postergado usa su alineación original.
8. Los importes y las notas conservan su precisión al persistir y recuperar.
9. Una falla del proveedor mantiene datos pendientes en lugar de publicar ceros definitivos.
10. Crear torneo, invitar a dos personas, alinear, pujar, negociar y cerrar dos fechas funciona de punta a punta con datos sintéticos.

## 11. Secuencia de mejora propuesta

| Etapa | Trabajo | Condición de salida |
|---|---|---|
| 1. Cerrar reglas y permisos | Reglamento único, políticas de acceso, exclusión de montos privados, perfil sin edición de roles | Dos usuarios no pueden alterar ni conocer datos privados ajenos. |
| 2. Asegurar la historia | Propiedad exclusiva, alineaciones por fecha y puestos explícitos, desglose auditable | Recalcular una fecha antigua conserva titulares, capitán y propietario de esa fecha. |
| 3. Asegurar la economía | Reservas centralizadas, movimientos, límites y concurrencia | Se conserva el balance y cada transferencia tiene un único efecto. |
| 4. Asegurar cierres | Pasos idempotentes, recuperación, pendientes del proveedor, postergados | Reiniciar o repetir un cierre produce el mismo estado final. |
| 5. Hacer reproducible la operación | Migraciones, seed, configuración local, compilación y CI | Un checkout limpio levanta y ejecuta una partida sintética. |
| 6. Probar con amigos | Inicio organizado, navegación móvil, resúmenes y avisos | El grupo completa varias fechas sin correcciones directas de la base. |

Dejaría draft por turnos, chat propio, más deportes y nuevas ligas para después de esa validación. El siguiente hito debería ser una temporada corta y confiable con una sola competición, no un aumento de mecánicas. La señal de éxito es que todos puedan explicar sus puntos, su saldo y sus jugadores, y que el sistema sostenga esas respuestas después de una caída o una corrección del proveedor.

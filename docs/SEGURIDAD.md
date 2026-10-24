# Permisos y privacidad

Implementación del punto 1 de la revisión, 17 de octubre de 2026. Reglamento: `../Reglas.md`. Pendientes de otras áreas: `../Paso a paso.md`.

## Identidad y roles

La API usa el token para identificar la cuenta y consulta su rol actual en MySQL. Una cuenta eliminada no puede seguir utilizando su token; una revocación de superadmin también se aplica a tokens emitidos previamente.

`gameAccessMiddleware` se monta después de la autenticación y antes de los routers de entidades. Las mutaciones no contempladas expresamente requieren superadmin. El registro de usuarios conserva el mecanismo existente de código de superadmin configurado en el servidor; el perfil personal no permite asignarse un rol.

## Matriz de acceso

| Recurso / operación | Usuario regular | Superadmin |
|---|---|---|
| Perfil personal | Leer y editar sus datos; sin cambiar `type` | Administración de usuarios y roles |
| Crear torneo | Crea asociado a su propia cuenta, con la configuración existente | Permitido |
| Unirse / abandonar | Solo su propia participación, mediante los flujos existentes | Permitido |
| Modificar / borrar torneos por CRUD | Denegado; no existe un rol separado de organizador en el modelo actual | Permitido |
| Catálogos deportivos locales | Lectura amplia | Lectura y escritura |
| Sincronización / proveedor externo | Denegado, incluidos endpoints GET | Permitido |
| Colecciones de torneos y partidas | Solo torneos a los que pertenece | Todos |
| Plantel | Reordenar jugadores propios; no incorporar IDs ajenos mediante PATCH | Administración |
| Pujas | Crear, editar y cancelar las propias, coherentes con el mercado | Administración |
| Montos de pujas | Solo el propio; rivales con metadatos de conteo | Todos |
| Negociaciones | Solo las que integra; acepta quien tiene el turno | Administración |
| Venta rápida | Solo su propio participante | Permitido |
| Blindaje | Solo el dueño actual; monto debitado al dueño autenticado | Permitido |
| Creación de cláusula | Solo para jugador propio; importe inicial calculado en servidor | Administración |
| Compra por cláusula | Solo puede actuar como comprador autenticado | Permitido |
| Saldos y puntajes mediante CRUD | Denegado, aunque sean propios | Permitido |
| CRUD de transacciones, blindajes y resultados | Denegado; usar acciones específicas | Permitido |

## Colecciones y cuota deportiva

Se mantiene la descarga de colecciones de la base local. Los filtros de privacidad se ejecutan mediante consultas MikroORM/MySQL; no provocan solicitudes adicionales a SportsApiPro. Jugadores, equipos y otros catálogos deportivos locales siguen disponibles ampliamente.

Los datos privados de negociaciones se filtran por comprador o vendedor. Las pujas visibles pertenecen a los torneos del solicitante, pero las respuestas se construyen con un DTO que excluye importes rivales, fechas privadas y relaciones anidadas.

Los saldos reservados y disponibles de participantes rivales tampoco se publican: revelar una reserva agregada puede permitir deducir una oferta única. El banco total sigue visible. El backend valida fondos al aceptar una negociación; la pantalla no necesita conocer el disponible privado del comprador rival.

El caché del navegador se vacía al iniciar o cerrar sesión para que otra cuenta no reutilice respuestas privadas de la sesión anterior. Los importes de pujas también están ocultos por defecto en la serialización ORM; el DTO los entrega explícitamente solo al dueño o superadmin.

Contraseña y correo están excluidos de la serialización de entidades anidadas. Los endpoints de perfil y autenticación construyen su salida explícita y conservan el correo propio. Los datos privados del saldo también están ocultos en entidades anidadas y se entregan explícitamente al propietario en la colección de participantes.

## Integración con el frontend existente

- El flujo de creación y unión por código mantiene las firmas existentes. El servidor vincula la operación con la cuenta autenticada y rechaza IDs de otro usuario.
- Las tarjetas de mercado siguen recibiendo una entrada por puja para los contadores, pero solo pueden leer el importe propio.
- Las ofertas y contraofertas usan estados controlados por el servidor. No se puede simular una aceptación mediante PATCH.
- El flujo de creación de cláusula previo al blindaje se conserva; el backend calcula `valorTraducido + 3M` y descarta importes suministrados por el cliente.
- La compra por cláusula verifica en el servidor la fecha de habilitación configurada para el torneo.
- Los controles existentes de configuración del torneo se conservan. No se incorporan en esta entrega nuevas modalidades ni se cambia el tamaño del mercado.

## Verificación

En `backend`, ejecutar `npm test`. La suite comprueba escalamiento de rol, suplantación, aislamiento entre torneos, pujas ocultas, filtrado de datos personales, saldos privados, acciones administrativas, propiedad de planteles, creación de ofertas, turnos de respuesta y cláusulas.

Las pruebas usan un repositorio simulado y no requieren credenciales, MySQL o cuota deportiva. Además se comprueban los tipos de la política de autorización. Hace falta validar la integración completa con la instalación de dependencias y la base local; no se realizaron operaciones sobre producción.

El historial por fecha/partido se implementa en el punto 2, documentado en `ALINEACIONES_HISTORICAS.md`; su consulta exige pertenencia al torneo y no tiene escrituras públicas. Quedan para las siguientes entregas los cierres idempotentes, reservas económicas completas, concurrencia y los restantes puntos acordados.

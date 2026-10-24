# Flujos, configuración y estado técnico

Referencia funcional: `Reglas.md`. Actualizado el 17 de octubre de 2026. Este archivo reemplaza los borradores anteriores con fórmulas y horarios contradictorios.

## Implementación existente

- Autenticación con contraseña scrypt, token firmado y sesión Angular.
- Creación e inscripción por código en sala de espera. El creador arranca con un sorteo conjunto de once por participante, equilibrado por promedio de notas; los ingresos tardíos reciben once aleatorios libres.
- Configuración en formulario, controller y entidad: nombre, liga, presupuesto, días de espera de cláusulas, cambios de alineación durante fecha y ejecución de cláusulas durante fecha.
- Mercado, pujas, negociación, venta rápida, compra por cláusula y blindaje.
- Capitán y cálculo de aportes, clasificaciones general y por fecha.
- Sincronización deportiva local y jobs persistidos de cierre y postergados.

Estos puntos existen en código; los defectos abiertos se enumeran abajo. No se presentan como funciones inexistentes ni se pide volver a confirmar sus configuraciones.

## Corrección actual: permisos y privacidad

`gameAccessMiddleware` se ejecuta después de autenticar y antes de los routers de entidades. Autoriza las operaciones usando el usuario real y las relaciones persistidas. Las mutaciones nuevas requieren una política explícita; el CRUD administrativo queda reservado al superadmin.

- Crear/unirse/abandonar no permite suplantar otro usuario.
- Solo el dueño opera sobre su plantel, sus pujas, sus ventas o su blindaje.
- Ofertas y contraofertas verifican comprador, vendedor, torneo, jugador y turno de respuesta.
- El perfil personal no admite cambios de rol.
- Los roles de sesión se contrastan con la cuenta persistida para respetar bajas y revocaciones.
- Las respuestas de pujas no contienen importes rivales ni relaciones anidadas que los revelen.
- Las colecciones de partidas se filtran en MySQL; se conservan las consultas amplias a los datos deportivos locales, sin aumentar llamadas al proveedor.
- Las colecciones de participantes conservan el banco público, pero solo el propietario o superadmin recibe el disponible y reservado.
- Las relaciones de usuarios excluyen contraseña y correo. El perfil autenticado continúa mostrando su propio correo.
- Las rutas del proveedor externo y sincronización requieren superadmin, incluso cuando usan GET.

La creación de la cláusula inicial desde la pantalla existente sigue permitida al dueño, pero el backend determina su valor. No se acepta un precio arbitrario enviado por el navegador.

## Pendientes acordados para siguientes correcciones

| Tema | Regla acordada | Estado de este cambio |
|---|---|---|
| Mercado | 3 jugadores por participante | Implementado: ingreso y renovación agregan 3; la renovación excluye también las compras recién adjudicadas. |
| Cierre | Último inicio +5h; si sigue en curso, reintento +4h | Implementado con trabajos persistentes, reintentos, transacción y recuperación de postergados a inicio + 5h; requiere migración. |
| Transferencias | Inmediatas/diferidas elegibles al crear | El selector específico no figura en el modelo/formulario actual; pendiente. |
| Plantel | 11 titulares y 5 suplentes; solo 11 iniciales | Implementado: límites en servidor y transferencias, propiedad relacional y puestos explícitos; requiere migración 04. |
| Capitán | Duplica puntos | Implementado; se conserva. |
| Cláusula | Traducido + 3M, aumentos por torneo y conservación | Compra y blindaje pasan por el servicio común, con propiedad, límites y conservación del precio al transferir. |
| Sorteo equilibrado | Promedio parecido de notas deportivas | Implementado: sala de espera, arranque por el creador y reparto conjunto por notas locales; ingresos tardíos con once libres y 3 nuevos de mercado. Requiere migración 07. |
| Empates | Igual premio a igual puntaje | Implementado: misma posición y premio para puntajes iguales de la fecha. |
| Precios | Evolución por rendimiento | Implementado: inicialización separada, signo del desvío corregido, orden por inicio del partido, base e historial idempotente; requiere migración 05. |
| Puntos históricos | Alineación congelada por fecha; por partido si se permiten cambios | Implementado con revisiones y copias históricas; requiere aplicar la migración del punto 2 y verificar integración con MySQL. |
| Economía | Reserva y registro de cada movimiento | Implementado: servicio común, reservas compartidas, movimientos, bloqueos y conciliación; pruebas con persistencia simulada. |
| Experiencia móvil | Navegación, resúmenes y acciones más claras | Implementados navegación, resumen, movimientos privados, invitación, cancelación de pujas, controles sin arrastre y foco de modales. Sala de espera y arranque por el creador implementados; otros permisos de organizador siguen como ampliación. |

## Alineaciones históricas

El punto 2 está desarrollado en `docs/ALINEACIONES_HISTORICAS.md`. Los cambios de plantel se registran mediante un subscriber del ORM; el cálculo no utiliza el plantel más reciente para fechas viejas. El historial anterior a la instalación solo puede reconstruirse hasta donde existan datos fiables.

## Separación entre base local y proveedor deportivo

El navegador consulta Express y Express lee las colecciones locales mediante MikroORM/MySQL. Filtrar esas consultas por permisos no consume cuota de SportsApiPro. Las sincronizaciones que sí consultan al proveedor permanecen centralizadas en el backend y restringidas al superadmin.

## Precios

La traducción inicial correcta es:

`mínimoJuego + ((valorRealJugador - mínimoRealLiga) / (máximoRealLiga - mínimoRealLiga)) * (máximoJuego - mínimoJuego)`

Si máximo y mínimo reales coinciden se necesita un caso especial. La inicialización debe separarse de la evolución por forma reciente. El precio de cláusula se calcula aparte: valor traducido + 3M, más aumentos invertidos dentro del torneo.

## Verificación y base de datos

`npm test` en `backend` ejecuta regresiones de seguridad, alineaciones históricas y automatización con persistencia simulada. Comprobar además compilación e integración con MySQL antes de desplegar. Los SQL y el modelo TXT históricos no deben usarse como si fueran migraciones actuales.

## Cierre automático

Ver `docs/CIERRE_AUTOMATICO.md`: orden ratings → pujas → puntos → mercado → premios, hora de cierre, pendientes, migración y operación del scheduler. Las correcciones de un partido postergado actualizan puntos y rankings sin volver a pagar premios.

## Correcciones 3, 4 y 5

Ver `docs/ECONOMIA_Y_PLANTELES.md`. Se conservan mercados/pujas cerrados, se registran movimientos y se validan reservas, posesión y puestos en transacciones. La migración 04 requiere ejecutar antes su preflight de solo lectura. No se aplicó SQL a una base real.

## Actualización de puntos 7, 8 y 9

Ver `docs/PRECIOS_EXPERIENCIA_Y_PRIVACIDAD.md`. El retiro conserva historial y evita repetir el sorteo (migración 06); las colecciones privadas se filtran también por torneo en el servidor y mantienen autorización. Las colecciones deportivas globales siguen siendo consultas locales, sin consumir cuota del proveedor. Desarrollo usa la API local; configuración de base externa mediante `.env`.

## Sala de espera y sorteo por calidad

La aclaración posterior reemplaza el equilibrio monetario por el promedio de notas locales. Ver `docs/SORTEO_Y_SALA_DE_ESPERA.md`. El sorteo inicial ocurre una sola vez cuando el creador arranca; luego siguen admitiéndose participantes con once libres, sin volver a repartir los equipos existentes.

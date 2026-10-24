# Fantasy Argentina

Web para jugar al fútbol fantasy con amigos: torneos privados, jugadores exclusivos por torneo, pujas a sobre cerrado, negociaciones, cláusulas y clasificación general y por fecha.

## Documentación vigente

- `Reglas.md`: reglamento acordado y decisiones de producto.
- `Paso a paso.md`: flujos actuales, configuración existente y pendientes técnicos.
- `docs/SORTEO_Y_SALA_DE_ESPERA.md`: arranque por el creador, promedio de notas e ingresos tardíos con once libres.
- `docs/PRECIOS_EXPERIENCIA_Y_PRIVACIDAD.md`: correcciones 7–9, sorteo equilibrado, precios, interfaz, retiros y consultas locales.
- `docs/SEGURIDAD.md`: permisos y privacidad de la API.
- `docs/ECONOMIA_Y_PLANTELES.md`: correcciones 3, 4 y 5, reservas, movimientos, propiedad y puestos.
- `docs/CIERRE_AUTOMATICO.md`: cierre automático a último inicio + 5h, reintento +4h si sigue en curso, mercados y postergados.
- `docs/ALINEACIONES_HISTORICAS.md`: cortes por fecha/partido, cálculo y migración del punto 2.
- `ANALISIS_PROYECTO.md`: diagnóstico original; sus hallazgos deben leerse con las actualizaciones posteriores.

`anterior_readme.md`, el modelo relacional TXT y los SQL de reset son históricos. Las migraciones actuales están en `backend/migrations/`.

## Arquitectura real

- Frontend: Angular 18, TypeScript, RxJS y Angular CDK.
- Backend: Node.js, Express 5 y TypeScript.
- Persistencia: MySQL con MikroORM 6.
- Datos deportivos: SportsApiPro; se sincronizan y guardan en la base local.
- `User` es la cuenta; `Participant` representa esa cuenta dentro de un `Tournament`.

Las colecciones deportivas locales pueden seguir descargándose completas. Las colecciones con datos de partidas se filtran en el backend según el usuario y sus torneos. Esas consultas a MySQL no son llamadas al proveedor deportivo.

## Reglas principales acordadas

- Mercado: **3 jugadores por participante**.
- Cierre automático: **5 horas después del último inicio previsto**; si sigue en curso, se reintenta **4 horas después**, sin consultas intermedias.
- Transferencias: modalidad inmediata o diferida seleccionable al crear el torneo.
- Plantel: 11 titulares y hasta 5 suplentes; inicialmente se entregan solo 11 jugadores en formación 4-4-2 (1 arquero, 4 defensores, 4 mediocampistas y 2 delanteros).
- Capitán: duplica sus puntos.
- Compra directa por cláusula: precio inicial igual al valor traducido + 3.000.000. Los aumentos son propios de cada torneo; el precio de la cláusula se conserva al cambiar de dueño hasta una nueva inversión.
- Blindaje: por cada unidad invertida, la cláusula aumenta dos.
- Venta rápida: 70 % del valor de mercado.
- Empates de puntos: mismo premio económico para quienes empaten.
- Los torneos nuevos abren una sala de espera. El creador pulsa Arrancar torneo y se reparten once a todos, equilibrando el promedio de las notas deportivas locales. Quienes ingresen después reciben once aleatorios libres del torneo.

Estas reglas son el objetivo funcional. Los desajustes pendientes del código están identificados en `Paso a paso.md`; documentar una decisión no significa que ya se haya implementado.

## Configuración de torneo ya existente

La creación ya permite elegir nombre, liga, presupuesto, días de espera para las cláusulas, cambios de alineación durante la fecha y ejecución de cláusulas durante la fecha. Esos parámetros están conectados al formulario, al backend y a la entidad `Tournament`.

La selección de transferencias inmediatas/diferidas es un requisito confirmado; no se encontró un campo específico para esa modalidad en la configuración actual. Su implementación queda para la corrección correspondiente.

La puntuación utiliza alineaciones históricas. Si se permiten cambios durante la fecha, cada partido usa la alineación vigente al comenzar ese partido. Aplicar `backend/migrations/20261017_02_historical_lineups.sql` antes de arrancar la versión con historial; ver la guía de alineaciones históricas para bases existentes.

El cierre automático también requiere `backend/migrations/20261017_03_matchday_closure.sql`. La economía y propiedad requieren además la comprobación previa y migración `20261017_04_economy_ownership`; ver la guía de economía y planteles. El backend debe permanecer en ejecución; los trabajos y reintentos se guardan en MySQL. Ver `docs/CIERRE_AUTOMATICO.md` antes de activarlo en una base con cierres anteriores.

Las correcciones 7–9 requieren además las migraciones `20261017_05_price_evolution.sql` y `20261017_06_retired_participants.sql`. La sala de espera requiere también `20261017_07_tournament_lobby.sql`; preserva los torneos anteriores como iniciados. No se ejecutaron contra una base real en esta revisión.

## Desarrollo local

Backend:

```powershell
cd backend
pnpm install --frozen-lockfile
pnpm build
pnpm start:dev
```

Frontend, en otra terminal:

```powershell
cd Frontend/Fantasy-Argentina
npm ci
npm start
```

Hace falta MySQL y configurar `backend/.env`. Variables relevantes: `DATABASE_URL`, `NODE_ENV`, `AUTH_TOKEN_SECRET`, `CORS_ALLOWED_ORIGINS`, `PORT`, `SPORTSAPIPRO_BASE_URL_V2` y las claves `SPORTSAPIPRO_API_KEY1`, `SPORTSAPIPRO_API_KEY2`, etc. No versionar secretos.

El frontend de desarrollo usa `/api` y el proxy local; producción usa `environment.production.ts`. Copiar `backend/.env.example` a `.env` y configurar MySQL y el secreto de autenticación. No activar `DB_SYNC_SCHEMA` en producción ni ejecutar scripts de reset sobre una partida existente.

## Verificación

```powershell
cd backend
npm test
pnpm build
```

Las regresiones de permisos se ejecutan sin base de datos ni proveedor externo y comprueban también los tipos de la política de autorización. No sustituyen una prueba de integración con MySQL.

```powershell
cd Frontend/Fantasy-Argentina
npm run build -- --configuration development
```

El build de producción incorpora Google Fonts y necesita acceso a ese servicio. El diagnóstico inicial detectó problemas de resolución en las dependencias locales del backend; no debe confundirse una suite aislada aprobada con una compilación integral verificada.

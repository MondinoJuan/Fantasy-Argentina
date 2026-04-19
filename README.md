# ⚽ Fantasy Argentina 🇦🇷

> Aplicación web para jugar **Fantasy de Fútbol** con amigos, basada en la **Liga Profesional Argentina** y otras competiciones. Cuenta con un mercado de pujas "a sobre cerrado", sistema de cláusulas dinámicas, negociaciones directas y rankings actualizados por fecha.

---

## 📑 Índice

1. [Visión General](#-visión-general)
2. [Arquitectura y Tecnologías](#-arquitectura-y-tecnologías)
3. [Roles de Usuario](#-roles-de-usuario)
4. [Modelo de Datos](#-modelo-de-datos)
5. [Mecánicas de Juego](#-mecánicas-de-juego)
6. [Mercado y Economía](#-mercado-y-economía)
7. [Cláusulas y Blindajes](#-cláusulas-y-blindajes)
8. [Sistema de Puntuación](#-sistema-de-puntuación)
9. [Valoración de Activos](#-valoración-de-activos)
10. [Ciclo de Vida de una Fecha](#-ciclo-de-vida-de-una-fecha)
11. [Ligas Disponibles](#-ligas-disponibles)
12. [API Externa](#-api-externa)
13. [Superadministrador](#-superadministrador)
14. [Roadmap](#-roadmap)

---

## 🚀 Visión General

Cada usuario crea o se une a un torneo eligiendo nombre y liga. Al ingresar, recibe un **plantel inicial de 11 jugadores** al azar. Estos generan puntos fecha a fecha según su rendimiento real, obtenido a través de la API `SportsApiPro`. El objetivo es gestionar el presupuesto, comprar y vender jugadores inteligentemente, y acumular la mayor cantidad de puntos para liderar el ranking.

**Rankings generados:** General · Por Fecha · Por Liga

---

## 🛠️ Arquitectura y Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Angular |
| Backend / Base de Datos | SQL (Modelo relacional normalizado) |
| Integración de datos | API `SportsApiPro` |

```
/
├─ frontend/      # Angular
├─ backend/       # API / servicios / lógica de negocio
├─ database/      # Scripts SQL, modelo, migraciones
└─ docs/          # Documentación funcional y técnica
```

---

## 👥 Roles de Usuario

### 🔑 Superadmin
- CRUD completo sobre todas las entidades del sistema.
- Poblar la base de datos local con jugadores y fixtures.
- Asignar/desasignar `RealPlayer`s a `Participant`s directamente (sin pasar por el mercado).
- Modificar puntajes (`RealPlayerPerformance`) para pruebas o ajustes manuales.
- Gestionar actualizaciones de claves foráneas (ej. traspasos reales de jugadores).
- Ver registros de cambios de alineaciones y movimientos de mercado.

### 👤 User / Participant
Usuario regular. La relación entre `User` y `Tournament` se gestiona a través de la entidad `Participant`, que contiene el presupuesto, el puntaje y el equipo asociado.

---

## 🗄️ Modelo de Datos

### Entidades Principales

| Entidad | Descripción |
|---|---|
| `User` | Cuenta de usuario. Se relaciona con torneos a través de `Participant`. |
| `Tournament` | Torneo con nombre, liga y configuraciones (ej. si habilita clausulazos). |
| `Participant` | Join entre `User` y `Tournament`. Contiene presupuesto, puntaje y equipo. |
| `RealPlayer` | Jugador real con valor, cláusula y dueño actual dentro del torneo. |
| `RealPlayerPerformance` | Puntaje de un jugador en una fecha/partido específico. |
| `Fixture` | Partido con equipos, fecha, hora y `gameId` para la API. |
| `Market` | Pool dinámico de jugadores disponibles para pujas en cada fecha. |

### 💰 Presupuesto del Participante

| Campo | Descripción |
|---|---|
| `bankBudget` | Presupuesto total (visible). Se modifica solo al concretar compras/ventas. |
| `availableMoney` | Dinero disponible para pujar o negociar (`bankBudget` − `reservedMoney`). |
| `reservedMoney` | Dinero bloqueado en pujas o negociaciones activas. |

### Restricciones Importantes

- Un `RealPlayer` puede existir **una sola vez por torneo** (exclusividad).
- Para que un participante obtenga un jugador que ya tiene rival, debe negociarlo o comprarlo por cláusula.
- Si el `value` de un jugador es `null` al insertar, se asume `value = 2.000.000 EUR`.

---

## 📜 Mecánicas de Juego

### 🏆 Creación e Inicio de Torneo
1. El usuario crea un torneo o se une con un código.
2. Se genera automáticamente un `Participant` que vincula al `User` con el `Tournament`.
3. Se asigna un **presupuesto base** y un **plantel de 11 jugadores** al azar respetando la formación **4-4-2**:

| Posición | Cantidad |
|---|---|
| Arquero | 1 |
| Defensores | 4 |
| Mediocampistas | 4 |
| Delanteros | 2 |

### 📋 Alineación y Penalizaciones

- Los participantes pueden cambiar su formación usando el mercado.
- Los cambios deben confirmarse con el **botón de guardado** para que se apliquen.
- **⚠️ Fuera de posición:** Se restan **3 puntos** por cada jugador alineado en una posición incorrecta.
- **🔒 Bloqueo durante fecha:** No se puede modificar la alineación ni realizar clausulazos mientras la fecha está en curso.

### 🤝 Negociaciones Directas
- Un participante puede ver el equipo de un rival y hacerle una oferta por un jugador.
- El dueño puede **aceptar**, **rechazar** o **contraofertar**.
- El monto ofrecido no debe superar el `availableMoney` del comprador.

### 💨 Venta Rápida al Sistema
- Precio de venta: **70%** del valor de mercado actual del jugador.
- El dinero se acredita de forma **inmediata** al banco del participante.

---

## 💸 Mercado y Economía

### 📅 Flujo del Mercado por Fecha

```
  Inicio de Fecha          Durante la Fecha          Cierre de Fecha
  ─────────────────        ─────────────────        ─────────────────
  Se genera el pool   →    Pujas "a ciegas"    →    Se resuelven pujas
  (3-4 × jugadores)        Solo se ve cantidad       Ganador: mayor monto
  Se habilitan pujas       de ofertas, no montos     Empate: el primero
                           Fondos se reservan        en pujar gana
```

### Reglas de Puja

| Regla | Detalle |
|---|---|
| Monto mínimo | ≥ valor de mercado del jugador |
| Cancelar puja | Modificar el monto a `$0` |
| Visibilidad | Solo se ve la **cantidad** de pujas, nunca los montos |
| Desempate | Mayor monto; si hay empate, gana quien pujó **primero** en el tiempo |

### 💳 Flujo del Dinero en una Puja

```
Al pujar:         availableMoney  ──►  reservedMoney   (bankBudget sin cambios)
Si gana:          reservedMoney   ──►  cobro definitivo (bankBudget disminuye)
Si pierde:        reservedMoney   ──►  availableMoney   (se devuelve)
```

### 🏅 Premio Económico por Posición (Draft Prize)

Se otorga dinero al finalizar cada fecha según el ranking obtenido **en esa fecha**:

| Posición | Monto Recibido |
|:---:|:---:|
| 🥇 1° al 3° | $ 1.000.000 |
| 🥈 4° al 6° | $ 1.500.000 |
| 🥉 7° al 9° | $ 2.000.000 |

---

## 🧷 Cláusulas y Blindajes

> ⚙️ Esta funcionalidad se habilita luego de una cantidad de días configurable al crear el torneo.

### Valor Base de Cláusula
Cuando un jugador es comprado en el mercado, su cláusula base se calcula así:

$$\text{Cláusula} = \text{PrecioCompra} + (\text{PrecioCompra} \times 1.5)$$

### Proceso de Blindaje (Aumentar Cláusula)

La relación de inversión es **1:2**: por cada `$1M` invertido, la cláusula aumenta `$2M`.

**Ejemplo:**

| Paso | Valor |
|---|---|
| Cláusula actual | $ 4.000.000 |
| Inversión del dueño | $ 1.000.000 |
| Aumento (`× 2`) | + $ 2.000.000 |
| **Nueva cláusula** | **$ 6.000.000** |

### ⏱️ Cooldown post-clausulazo
Tras efectuar un clausulazo, el jugador queda **bloqueado por unos minutos** para que el nuevo dueño tenga tiempo de aumentar su cláusula e impedir una recompra inmediata.

> La cláusula se mantiene si el jugador cambia de dueño mediante negociación directa.

---

## 📊 Sistema de Puntuación

### Cálculo de Puntos
- **Fuente:** API externa `SportsApiPro`.
- Los puntos se obtienen del campo `ranking` del rendimiento real del jugador.
- Si un jugador **no juega** o está lesionado, suma **0 puntos**.
- Se normaliza la posición del jugador para calcular una "nota esperada" y comparar con su rendimiento real.

### Penalizaciones

| Situación | Penalización |
|---|---|
| Jugador fuera de su posición titular | −3 puntos por jugador |
| Jugador no juega / lesionado | 0 puntos (sin penalización extra) |

### Cierre de Fecha
El cierre ocurre **4 horas después del último partido** de la fecha. En ese momento:
1. Se resuelven las pujas del mercado.
2. Se calculan los puntos de todos los participantes.
3. Se otorgan los premios económicos (Draft Prize).
4. Se ajustan los precios de los jugadores.
5. Se renueva el mercado con nuevos jugadores libres.

> Los traspasos y cambios de alineación se aceptan recién **4 horas después del cierre** para garantizar consistencia en los puntajes.

---

## 📈 Valoración de Activos

### 1. Traducción Inicial de Precio por Liga

Se normaliza el valor real del jugador dentro de los topes económicos del juego:

$$\text{Value} = \text{limiteMin} + \frac{\text{valueReal\\_Player} - \text{valueReal\\_MinDeLeague}}{\text{valueReal\\_MaxDeLeague} - \text{valueReal\\_MinDeLeague}} \times (\text{limiteMax} - \text{limiteMin})$$

### 2. Fluctuación Post-Partido

Se define la posición normalizada del jugador en el mercado:

$$p = \frac{\text{valueTradActual} - \text{limiteMin}}{\text{limiteMax} - \text{limiteMin}}$$

Con `p`, se calcula la **nota esperada**:

$$\text{notaEsperada} = \text{notaMinEsperada} + p \times (\text{notaMaxEsperada} - \text{notaMinEsperada})$$

### Lógica General de Fluctuación

| Rendimiento vs. Nota Esperada | Efecto en el Valor |
|---|---|
| Muy por encima | Valor **sube** significativamente |
| Por encima | Valor **sube** levemente |
| Por debajo | Valor **baja** levemente |
| Muy por debajo | Valor **baja** significativamente |

> **Inercia:** Para cambios significativos de valor, el jugador debe encadenar **varios partidos consecutivos** con buen o mal rendimiento.

---

## 🔄 Ciclo de Vida de una Fecha

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CICLO DE UNA FECHA                          │
├─────────────┬──────────────────────────┬────────────────────────────┤
│  DÍA 0      │  DURANTE LA FECHA        │  CIERRE (+4 hs)            │
│  Apertura   │                          │                            │
├─────────────┼──────────────────────────┼────────────────────────────┤
│ • Generar   │ • Pujas "a sobre         │ • Resolver mercado         │
│   mercado   │   cerrado" activas       │ • Calcular puntajes        │
│   (3-4×N)   │ • Negociaciones directas │ • Aplicar penalizaciones   │
│ • Habilitar │ • Alineación bloqueada   │ • Otorgar Draft Prize      │
│   pujas     │ • Sin clausulazos        │ • Ajustar precios          │
│             │                          │ • Renovar mercado          │
└─────────────┴──────────────────────────┴────────────────────────────┘
                                                    ▼
                                    Período de Traspaso Libre (Día +4)
                                    • Traspasos y negociaciones abiertas
                                    • Clausulazos habilitados (según config)
                                    • Reposición de dinero en bancos
```

---

## 🌐 Ligas Disponibles

| ID | Liga / Torneo | Season ID |
|:---:|---|:---:|
| 155 | 🇦🇷 Liga Profesional de Fútbol | 87913 |
| 480 | 🏆 CONMEBOL Sudamericana | 87770 |
| 384 | 🏆 CONMEBOL Libertadores | 87760 |
| 17  | 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League | 76986 |
| 8   | 🇪🇸 La Liga | 77559 |

---

## 🔌 API Externa

**Proveedor:** `SportsApiPro`

| Uso | Descripción |
|---|---|
| Jugadores | Obtener jugadores disponibles por liga y temporada |
| Puntajes | Rendimiento real de los jugadores por partido |
| Estado físico | Lesiones y disponibilidad de jugadores |

**Optimización:**
- Las llamadas a la API se realizan en **batch** al cierre de cada fecha (no en tiempo real).
- Los datos se almacenan localmente para minimizar peticiones repetidas.
- Los partidos postpuestos se registran y actualizan más tarde.

---

## 🤖 Superadministrador

El usuario con rol `admin` tiene acceso total al sistema:

- ✅ Crear, editar y eliminar `Tournaments`, `Users` y cualquier entidad.
- ✅ Asignar/desasignar jugadores a participantes directamente.
- ✅ Modificar `RealPlayerPerformance` para pruebas o correcciones manuales.
- ✅ Ver todos los registros de cambios de alineaciones y movimientos de mercado.

---

## 🚀 Roadmap

### MVP (En Desarrollo)
- [x] Modelo de datos y arquitectura base
- [x] Definición de reglas de negocio
- [ ] Autenticación y gestión de usuarios (OAuth / JWT)
- [ ] Creación de torneo e inyección inicial de planteles
- [ ] Sistema de mercado base (pujas con reservas)
- [ ] Lógica cron/jobs de cierre de fecha
- [ ] Sistema de cláusulas con bloqueo temporal

### Futuro
- [ ] Mejoras en UX (interfaz de mercado más clara)
- [ ] Seguridad: protección contra manipulaciones masivas de pujas
- [ ] Sistema de chat privado entre participantes
- [ ] Soporte para ligas adicionales

---

<div align="center">

**Fantasy Argentina** · Versión MVP · Documento de Referencia v1.0

</div>

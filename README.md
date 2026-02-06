# Fantasy Argentina ⚽🇦🇷

Aplicación web para jugar un **Fantasy de fútbol** con amigos, basada en la **Liga Argentina**, con mercado de pujas “a sobre cerrado”, cláusulas, negociaciones y ranking por fecha.

---

## Objetivo del proyecto

- Crear torneos Fantasy eligiendo **nombre** y **liga**.
- Al crear un torneo, a cada participante se le asigna un **plantel inicial de 11 jugadores** al azar (obtenidos desde una API de estadísticas).
- Cada fecha, los puntos de los jugadores se transforman en **puntos para su dueño**, generando:
  - **Ranking general** (acumulado)
  - **Ranking por fecha**

---

## Funcionalidades principales

### 🏟️ Torneos y participantes
- Creación de torneo con liga a elección.
- Inscripción de participantes.
- Cada participante cuenta con un **banco** (presupuesto).

### 👥 Plantel (equipo del participante)
- Plantel inicial de 11 jugadores asignados al azar.
- Historial de tenencia de jugadores (cuándo se adquieren/liberan) para evitar inconsistencias de puntaje.

### 📊 Puntajes y rankings
- Los participantes suman puntos según el rendimiento real de sus jugadores en la fecha.
- Si un jugador no juega, suma **0 puntos**.
- Rankings disponibles:
  - **General** (acumulado)
  - **Por fecha**

---

## Mercado de jugadores (común por torneo)

Cada fecha existe un **mercado compartido** para todos los participantes del torneo.

- El mercado se compone de una cantidad de jugadores igual a:  
  **3 × (cantidad de participantes del torneo)**
- El mercado se **renueva** en cada fecha.

### 🧾 Pujas “a sobre cerrado”
- Los participantes pueden pujar por jugadores del mercado:
  - No se ve el monto de las ofertas de otros.
  - Solo se ve la **cantidad de pujas** recibidas por cada jugador.
- Restricción: la puja debe ser **≥ valor mínimo del mercado** (relacionado al valor de mercado del jugador).

### 💰 Reservas de dinero (bids/offers)
Cuando un participante oferta:
- El dinero **no se descuenta** del banco inmediatamente.
- Se **reserva** (queda bloqueado) hasta que:
  - se cancele la puja/oferta,
  - se rechace (en negociaciones),
  - o se procese el cierre de fecha.
- Un participante puede realizar **todas las pujas/ofertas que quiera**, siempre que tenga **saldo disponible** (`saldo_total − saldo_reservado`).

---

## Traspasos, negociaciones y venta instantánea

### 🔁 Negociaciones entre participantes
- Los participantes pueden negociar compras/ventas de jugadores.
- Las ofertas también generan **reserva de dinero** hasta ser aceptadas o rechazadas.

### ⚡ Venta instantánea al sistema
- Un participante puede vender un jugador de forma inmediata al **85% del valor de mercado**.
- El dinero se acredita al banco del participante.

### ⏱️ Regla de traspaso diferido (+4hs)
Para evitar que un jugador “puntúe doble”:
- Los traspasos entre participantes se vuelven efectivos **4 horas después** del punto de actualización de la fecha.

---

## Cláusulas y blindajes

### 🧷 Compra por cláusula (habilitada a los 14 días)
- A partir de **14 días desde el inicio del torneo**, se habilita la compra directa por cláusula.

### 🛡️ Blindaje de jugadores
- Un participante puede “blindar” un jugador invirtiendo dinero de su banco.
- Regla: **por cada $1 invertido**, la cláusula aumenta en **$2**.
- La cláusula del jugador se mantiene si el jugador cambia de dueño (se transfiere con el jugador).

---

## Cierre de fecha y optimización de requests a la API

Para minimizar llamadas a la API:

### 🧠 Punto de actualización (cierre)
- **3 horas después** de finalizada la fecha:
  1. Se consultan los puntajes de la API para:
     - jugadores que están en el mercado, **o**
     - jugadores que pertenecen a algún participante.
  2. Finalizan las pujas:
     - se determina ganador por jugador,
     - al ganador se le descuenta el monto (antes estaba reservado),
     - a los perdedores se les libera la reserva.
  3. Se calcula el puntaje de la fecha por participante y se actualizan rankings.
  4. Se genera el nuevo mercado:
     - se agregan **3 jugadores aleatorios por participante**,
     - se habilitan las nuevas pujas de la siguiente fecha.

---

## Arquitectura del repositorio

- **Frontend:** Angular  
- **Backend / Base de Datos:** SQL (modelo relacional normalizado)  
- Integración con API de estadísticas (pendiente de definir/implementar)

Sugerencia de estructura:

```bash
/
├─ frontend/          # Angular
├─ backend/           # API / servicios / lógica de negocio
├─ database/          # scripts SQL, modelo, migraciones
└─ docs/              # documentación funcional y técnica
```

---

## Estado del proyecto
En desarrollo. El objetivo es construir un MVP jugable y luego iterar con mejoras (seguridad, UX, performance, etc.).

---

## Roadmap (MVP sugerido)
- [ ] Autenticación y gestión de usuarios
- [ ] Crear torneo + unirse
- [ ] Asignación inicial de 11 jugadores
- [ ] Mercado por fecha + pujas con reservas
- [ ] Cierre de fecha (3hs) + cálculo de puntos + rankings
- [ ] Transferencias efectivas (4hs)
- [ ] Cláusulas + blindajes (14 días)

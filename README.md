# Fantasy Argentina ⚽🇦🇷


Aplicación web para jugar un **Fantasy de fútbol** con amigos, basada en la **Liga Argentina** y otras competiciones internacionales. Cuenta con un mercado de pujas "a sobre cerrado", sistema de cláusulas dinámicas, negociaciones directas y rankings actualizados por fecha.



## 🎯 Objetivo del Proyecto
Permitir a los usuarios crear torneos Fantasy eligiendo nombre y liga. Al ingresar, a cada participante se le asigna un plantel inicial de **11 jugadores** al azar, los cuales generarán puntos fecha a fecha según su rendimiento real (estadísticas obtenidas mediante SportsApiPro). El objetivo es gestionar el presupuesto, comprar y vender jugadores inteligentemente, y acumular la mayor cantidad de puntos para liderar el ranking.



## 🏗️ Arquitectura y Tecnologías

    * **Frontend:** Angular
    * **Backend / Base de Datos:** SQL (Modelo relacional normalizado)
    * **Integración:** API de estadísticas SportsApiPro



## 👥 Roles y Usuarios

### Superadmin
Encargado de la administración general del sistema. Sus funciones incluyen:


    * Realizar un CRUD completo de cada entidad del proyecto.
    * Poblar la base de datos local con las tuplas correspondientes.
    * Gestionar actualizaciones manuales o modificaciones de claves foráneas (ej. traspasos de jugadores en la vida real).



### User / Participant
El usuario regular. La relación entre `User` y `Tournament` se da a través de la entidad `Participant`, la cual contiene el presupuesto (`bankBudget`, `availableMoney`, `reservedMoney`), el puntaje y el equipo asociado.



## 🏟️ Torneos y Planteles

### Creación y Asignación Inicial

    * Al unirse o crear un torneo, el participante recibe un **presupuesto base** y un **plantel de 11 jugadores** al azar.
    * Estos 11 jugadores iniciales se otorgan buscando respetar una formación **4-4-2** por defecto (1 arquero, 4 defensores, 4 mediocampistas y 2 delanteros).
    * **Exclusividad:** Un jugador real (`RealPlayer`) solo puede pertenecer a un participante a la vez dentro de un mismo torneo.



### Alineación y Penalizaciones

    * Los participantes pueden cambiar su formación libremente mediante el mercado.
    * **Persistencia:** Es obligatorio presionar el botón de guardado para que los cambios en la alineación se apliquen.
    * **Fuera de Posición:** Al calcular el puntaje, se restan **3 puntos** por cada jugador que esté alineado en una posición incorrecta.
    * **Bloqueo:** Durante el transcurso de una fecha, no se puede modificar la alineación ni realizar "clausulazos".



## 🛒 Mercado y Pujas
El mercado es compartido por todos los participantes del torneo y se renueva cada fecha.


    * **Volumen del Mercado:** Se llena con una cantidad de jugadores equivalente a **3 o 4 veces** la cantidad de participantes del torneo (jugadores libres que no pertenecen a nadie).
    * **Pujas "a sobre cerrado":** Los participantes pueden ofrecer dinero por un jugador. Las ofertas son secretas; solo se ve la cantidad de pujas que tiene un jugador, no los montos.
    * **Monto Mínimo:** La puja debe ser mayor o igual al valor de mercado del jugador. Para cancelar una puja, se debe modificar su valor a **$0**.
    * **Resolución (Desempate):** Si hay empate en el monto de la puja ganadora, se la lleva el participante que haya ofertado primero en el tiempo.



### Sistema de Dinero (Reservado vs. Disponible)

    * **Oferta:** Al pujar o negociar, el monto se descuenta del `availableMoney` (dinero disponible) y pasa al `reservedMoney` (dinero reservado). El presupuesto total (`bankBudget`) no cambia.
    * **Resultado Positivo:** Si gana la puja, el dinero se descuenta definitivamente de `reservedMoney` y de `bankBudget`.
    * **Resultado Negativo:** Si pierde, el dinero sale de `reservedMoney` y vuelve a `availableMoney`.



## 🔁 Traspasos, Negociaciones y Ventas

    * **Negociaciones Directas:** Un participante puede ver el equipo de un rival y hacerle una oferta por un jugador. El dueño puede aceptarla, rechazarla o contraofertar. El monto ofrecido debe ser menor o igual al dinero disponible del comprador.
    * **Venta Rápida (Instantánea):** Los jugadores pueden ser vendidos al sistema de manera rápida por un **70% de su valor de mercado** actual. El dinero se acredita de inmediato.



## 🧷 Cláusulas de Rescisión (Shielding)

    * **Habilitación:** La compra por cláusula se habilita luego de una cantidad de días específica (configurada al crear el torneo) y permite "robar" un jugador de un rival pagando un precio elevado.
    * **Valor Base:** Cuando un jugador es comprado en el mercado, su cláusula base es: $Clausula = PrecioCompra + (PrecioCompra 	imes 1.5)$
    * **Blindaje:** El dueño puede aumentar la cláusula invirtiendo dinero de su banco. La relación es **1:2** (por cada **$1M** invertido, la cláusula aumenta **$2M**).
    * **Cooldown:** Tras efectuar un "clausulazo", el jugador queda bloqueado por unos minutos para que el nuevo dueño tenga tiempo de aumentar su cláusula e impedir una recompra inmediata.



## 📊 Sistema de Puntuación y Fin de Fecha

### Cierre de Fecha (Punto de Actualización)
**Ocurre 4 horas después** del último partido de la fecha:


    * **Resolución del Mercado:** Se cierran las pujas, se entregan los jugadores y se ejecutan los cobros/devoluciones.
    * **Cálculo de Puntos:** Se consulta la API y se suman los puntos ("ranking") obtenidos por cada jugador titular. Si un jugador no juega, suma 0.
    * **Premio Económico (Draft):** Se otorga dinero en función de la posición obtenida en esa fecha específica:
        
            * **Top 1 al 3:** 1M
            * **Top 4 al 6:** 1.5M
            * **Top 7 al 9:** 2.0M
        
    
    * **Renovación de Mercado:** Se retiran los jugadores no vendidos y se agregan nuevos jugadores libres.



## 📈 Fluctuación del Precio de Jugadores
El valor de un jugador cambia después de cada fecha dependiendo de su rendimiento respecto a su valor actual. Un jugador que vale mucho necesita puntajes casi perfectos para mantener su precio; un jugador barato subirá drásticamente si encadena un par de buenos partidos.



### 1. Traducción inicial de precio por Liga
Se normaliza el precio del jugador dentro de los topes económicos del juego utilizando la siguiente fórmula:

`Value = limiteMin + ((valueReal_Player - valueReal_MinDeLeague) / (valueReal_MaxDeLeague - valueReal_MinDeLeague)) * (limiteMax - limiteMin)`



### 2. Cálculo de fluctuación post-partido
Se define una nota esperada basada en la posición normalizada (p) del valor actual del jugador en el mercado:

`p = (valueTradActual - limiteMin) / (limiteMax - limiteMin)`

`notaEsperada = notaMinEsperada + p * (notaMaxEsperada - notaMinEsperada)`



## 🌐 Ligas Disponibles
<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
    <thead>
        <tr style="background-color: #2c3e50; color: white;">
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">ID</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Liga / Torneo</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Season ID</th>
        </tr>
    </thead>
    <tbody>
        <tr><td style="border: 1px solid #ddd; padding: 10px;">155</td><td style="border: 1px solid #ddd; padding: 10px;">Liga Profesional de Fútbol</td><td style="border: 1px solid #ddd; padding: 10px;">87913</td></tr>
        <tr style="background-color: #f9f9f9;"><td style="border: 1px solid #ddd; padding: 10px;">480</td><td style="border: 1px solid #ddd; padding: 10px;">CONMEBOL Sudamericana</td><td style="border: 1px solid #ddd; padding: 10px;">87770</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 10px;">384</td><td style="border: 1px solid #ddd; padding: 10px;">CONMEBOL Libertadores</td><td style="border: 1px solid #ddd; padding: 10px;">87760</td></tr>
        <tr style="background-color: #f9f9f9;"><td style="border: 1px solid #ddd; padding: 10px;">17</td><td style="border: 1px solid #ddd; padding: 10px;">Premier League</td><td style="border: 1px solid #ddd; padding: 10px;">76986</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 10px;">8</td><td style="border: 1px solid #ddd; padding: 10px;">La Liga</td><td style="border: 1px solid #ddd; padding: 10px;">77559</td></tr>
    </tbody>
</table>


## 🚀 Roadmap y Tareas Pendientes

    * Autenticación y gestión de usuarios.
    * Creación de torneo e inyección inicial de planteles.
    * Sistema de mercado base (pujas con reservas).
    * Lógica cron/jobs de cierre de fecha.
    * Sistema de cláusulas con bloqueo temporal.


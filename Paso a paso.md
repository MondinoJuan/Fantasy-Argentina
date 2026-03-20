# SUPERADMIN
El superadministrador debe ser el encargado de, aparte de poder realizar un CRUD de cada entity del proyecto, llenar la BdD local con las tuplas correspondientes a cada entidad y realizar actualizaciones o modificaciones de claves foráneas (por ejemplo en caso de traspasos).
 

# Creacion de Tournament
Una persona ingresa a la página y puede hacerse una cuenta o ingresar con una ya creada.
En la página principal debe poder consultar los torneos a los que pertenece o crear uno nuevo, la relacion entre User y Tournament se da a partir de Participant el cual contendra los datos propios del User y del Tournament al que pertenece. Cuando se crea el Tournament, se crea al mismo tiempo el Participant que linkea ambos, con algunos valores seteados por default (como bankBudget), y se le asignan 11 RealPlayers recuperados al azar desde la base de datos local (estos RealPlayer pueden existir una vez por Tournament, es decir, que para que otro Participant obtenga al RealPlayer, este debe realizar una Negotiation con el Participant dueño actual del RealPlayer y acordar un cierto dinero para la Transaction). 
A su vez, cada vez que se cree un Participant para el Tournament, es decir que mas Users se linkeen a dicho Tournament, 4 RealPlayers que no estén ya en el Tournament (ya en el Market o perteneciente a un Participant) se deben recuperar al azar sin restriccion de posición y colocarse en el Market para que puedan realizarse Bids sobre ese RealPlayer. Las Bids consisten en que cada Participant ofrece una cantidad de plata por dicho RealPlayer, al final de cada Matchday (8hs despues del último Match jugado de dicha Matchday) se analizan las Bids y el Participant que haya ofertado la mayor cantidad de dinero se lleva el RealPlayer, los Participant no deben saber el valor de las Bids realizadas mientras el RealPlayer se encuentre en el Market (es decir mientras la puja siga activa).

# Realizar una puja
Cuando un Participant realiza una Bid o una Negotiation por algun RealPlayer de un Participant rival, se reserva dicha cantidad de dinero: la reserva consta de que mientras no haya Bid o Negotiations activas, el availableMoney es el mismo que el bankBudget; pero cuando esta activa una o mas Bids o Negotiatios, se resta la sumatoria de dinero del availableMoney y se guarda en la propiedad reservedMoney, mientras el bankBudget no se inmuta (es como si mostrara el total). Si el Participant gana la Bid o le es aceptada la Negotiation, ahi si se descuenta dicha cantidad de dinero del reservedMoney y del bankBudget; si no gana la Bid o le rechazan la Negotiation, ese dinero se descuenta de reservedMoney, se le suma al availableMoney y el bankBudget no se modifica. 
Para checkear si un Participant puede realizar el Bid o la Negotiation por cierta cantidad de dinero, se debe validar que sea menor que el availableMoney. 

# Realizar una Negotiation
Un Participant puede observar un listado de sus Participant rivales y seleccionar uno para ver los RealPlayers que pertenezcan a dicho rival.
Al seleccionar a un RealPlayer, el Participant puede seleccionar una cantidad de dinero para ofrecer por dicho RealPlayer, el Participant dueño del mismo deberia poder ver las ofertas que le llegan por sus RealPlayers y puede rechazarlas, aceptarlas o realizar una contraoferta. Si la Negotiation es aceptada, el RealPlayer deberia pasar del Participant dueño del pase previamente al Participant que oferto, este traspaso consta de eliminar la referencia que tiene un Participant sobre el RealPlayer y agregar dicha referencia al otro Participant.

# Cálculo de puntos
Cada RealPlayer tendra un puntaje por Match por Matchday, en la api externa ese puntaje se llama "ranking". El puntaje que acumula un Participant en un Tournament consta de que cada vez que finalice una fecha (Matchday), se suma el puntaje que hayan obtenido cada uno de sus RealPlayers al puntaje total del Participant. 
Por ende, si se obtiene un RealPlayer en la fecha 9, no se suman los puntajes obtenidos en las 8 fechas previas, y el Participant que era el dueño anterior del RealPlayer no pierde los puntos que éste le haya sumado.  

# Fixture
Cada vez que se actualiza el fixture se debe recuperar los resultados de los partidos ya jugados y de los que no se jugaron todavia guardar rivales, fecha, hora y gameId (ese es el ID con el que se buscara información luego en la API externa); esto para persistirlos en la base de datos con los datos necesarios para recuperar informacion sobre ellos luego mediante la api externa. 
Si un partido es postpuesto, se deberia agregar la informacion del mismo (TeamHome, TeamAway, fecha, hora, gameId, fecha/stageNum) en un listado con el fin de actualizar la informacion mas tarde.
Con los gameId de cada partido de cada fecha, si se jugo, se puede recuperar el "ranking" de los jugadores que participaron del mismo y persistir dicha informacion en la BdD.

# Cláusulas (Shielding)
Cuando un Participant compra un RealPlayer, ya sea mediante Bid o Negotiation, la cláusula (Shielding) de dicho RealPlayer se calcula sumando el precio que salió dicho RealPlayer mas el 150% de dicha cantidad de dinero.
Si el RealPlayer es asignado al inicio al Participant, la cláusula (Shielding) es...
El Participant puede aumentar el Shielding de cada uno de sus RealPlayer gastando el dinero que tengan disponible (availableMoney) a una razon de por cada unidad de dinero gastada/invertida en el RealPlayer, el Shielding aumenta dos unidades de dinero. Por ejemplo, si yo gasto 1 millon, el Shielding aumenta 2 millones.

# Ranking
Dentro de cada Tournament se debería poder observar en un apartado, una tabla que liste a los Users dentro de un Tournament (la relacion se da mediante Participant) ordenados de manera descendente por la cantidad de puntaje total de cada uno.
Debe poder seleccionarse la fecha y ver un ranking ordenado tambien de manera descendete por los puntos de cada Participant, pero esta vez no por los puntos totales, sino que por los puntos obtenidos en dicha fecha por cada uno.

## Dudas
- No se cómo invocar la función de suma de puntajes a los Participant. Tal vez hacerlo cada vez que se actualicen los puntajes de cada RealPlayer (si el Participant lo tiene referenciado, que se le sume dicho "ranking" al puntaje del mismo), pero como hago para que se sumen solamente los puntajes actualizados recientemente y no todos los previos. 
* Capaz se podria hacer con un trigger? que cada vez que se cree un PlayerPerformance se sume el puntaje almacenado en la propiedad pointsObtained al puntaje del Participant en totalScore.

- ¿Cómo calcular bien las Bids?

## A finalizar
- Implementar las negotiations.
- Implementar las clausulas. Debo poder clickear las cards de mis jugadores.
- Implementar la fechaHora de finalizacion de las pujas y que se le otorgue el realPlayer al participant. Incluido el manejo de pujas perdidas (que se eliminen luego de devolver la plata).
- Agregar que al persistir realPlayers, si el value es 'null', coloque valueCurrency = 'EUR' y value = 2000000.
- Agregarle una columna a RealPlayer que seria precioTraducido que depende de la league, no porque la league tenga una regla de negocio, sino porque depende del value del RealPlayer más barato y del más caro de una league.
- El valor de un jugador no debería ajustarse de manera lineal, sino según qué tan cerca esté de sus límites.

Si un jugador ya tiene un valor muy alto, como Aníbal Moreno en el ejemplo, significa que su precio está cerca del techo permitido. En ese caso, para sostenerse en ese valor debería rendir de forma casi perfecta de manera constante. Si empieza a encadenar partidos con puntajes muy bajos, su precio debería caer con fuerza. Si sus puntajes bajan pero siguen siendo aceptables, como varios 7 u 8, la caída debería existir, pero ser más moderada.

En cambio, si un jugador ya tiene un valor muy bajo, significa que su precio está cerca del piso permitido. Para mantenerse en ese mínimo debería seguir teniendo rendimientos muy malos de forma sostenida. Si empieza a sacar buenas puntuaciones, su valor debería recuperarse. Y si encadena varios partidos buenos, el aumento tendría que ser importante, porque estaba subvaluado respecto de su rendimiento reciente.

En resumen, la lógica sería que los jugadores cercanos al máximo sean más sensibles a una racha negativa, y los jugadores cercanos al mínimo sean más sensibles a una racha positiva.

Para hacer una traducción del precio inicial de cada RealPlayer de una league:

	valueReal_MinDeLeague --------------- limiteMin 
	valueReal_MaxDeLeague --------------- limiteMax 
	valueReal_dePlayer ----------------- X?

	X = limiteMin + ((( valueReal_MaxDeLeague − valueReal_MinDeLeague ) / ( valueReal_dePlayer − valueReal_MinDeLeague )​) * (limiteMax − limiteMin ))

Para hacer las correcciones en base al ultimo puntaje que obtuvo la ultima fecha:

	1- Definir una nota esperada dependiendo del valor del jugador:
        Se normaliza la posicion del jugador dentro del rango de precios:
            p = ( valueTradActual − limiteMin ) / ( limiteMax − limiteMin )

        Se decfine una nota esperada en funcion de esa posicion:
            notaMinEsperada = 0
            notaMaxEsperada = 10
            notaEsperada = notaMinEsperada + p * ( notaMaxEsperada − notaMinEsperada )

	2- desvio = puntaje - notaEsperada
		* Si desvío < 0, baja el percio.
		* Si desvío > 0, sube el precio.
		* Si desvío = 0, queda igual.

	3- Medir dónde está parado el value del realPlayer dentro del rango, se normaliza entre 0 y 1:
		p = (valueTradActual - limiteMin) / (limiteMax - limiteMin)
			* Si p aprox 0 -> está cerca del mínimo
			* Si p aprox 1 -> está cerca del máximo

	4- Realizar una corrección asimétrica, por ejemplo si debe subir y está cerca del mínimo, debe hacerlo en mayor medida a que si está cerca del máximo.
		factorSubida = (1-p)
		factorBajada = p

	5- Función de corrección:
		ajuste = k * desvío; k es una constante chica (0,03 ; 0,05)

		* Si puntaje > 6: nuevoValor = valorTradActual + ajuste * factorSubida * valorTradActual
		* Si puntaje < 6: nuevoValor = valorTradActual + ajuste * factorBajada * valorTradActual

Si quiero hacerlo en base a los ultimos partidos, no en base al ultimo, debo usar un promedio ponderado de los ultimos y utilizar dicho promedio en vez de, puntaje:
    scoreForm = 0.5 * notaultimo​ + 0.3 * notapenultimo ​+ 0.2 * notaantepenultimo​

## Futuro
* Si un realPlayer es elegido como capitán por un Participant, que los puntos que le sume al mismo al final de una fecha sea x3.
* Hay que mejorar el sistema de final de pujas. Si lo hace el superadmin es injusto, si lo hace un tiempo despues de la ultima puja no termina mas (se pueden hacer pujas indefinidas por $0), si lo hago a un tiempo despues del ultimo partido de la fecha se puede romper por partido postpuesto. ¿Qué hacer si dos personas ofertan la misma cantidad de dinero? Si hay una oferta = $0 tampoco deberia dar la puja por ganada.
* El participant al poner un realPlayer en venta se le tiene que otorgar la posibilidad de venderlo rápido por una cantidad menor.
* Manejar que pasa si un realPlayer deja de estar en una league despues de haber jugado algun matchday.

## Listado ligas
SPORTSAPIPRO V2:
7 - UEFA champions league
8 - La liga
16 - World Cup
17 - Premier League
23 - Serie A
155 - Liga Profesional de Fútbol - season ID: 87913
35 - Bundesliga
679 - UEFA Europa league
17015 - UEFA conference league
357 - FIFA Club World Cup
34 - Ligue 1
384 - CONMEBOL Libertadores
480 - CONMEBOL Sudamericana
295 - World Cup Qual. CONMEBOL
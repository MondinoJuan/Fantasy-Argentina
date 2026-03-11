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

## Futuro
* Separar los realPlayers linkeados al Participant por titulares y suplentes. Los suplentes no deberían sumar puntos.
* Permitir que un User se linkee a un Tournament a partir de la creación de un Participant mediante el codigo del Tournament.
* Si un realPlayer no está en la posición que le corresponde, que se le resten 3 puntos al puntaje obtenido.
* Si un realPlayer es elegido como capitán por un Participant, que los puntos que le sume al mismo al final de una fecha sea x3.
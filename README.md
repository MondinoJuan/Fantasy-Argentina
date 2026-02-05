# Fantasy-Argentina
Este repositorio se utilizara para llevar el versionado de la creación de una página de Football Fantasy de la Liga Argentina.

En este repositorio se va a llevar el versionado, tanto del backend (en SQL) como del frontend (con Angular), del desarrollo de una página web que se va a utilizar para crear un torneo Fantasy de la liga Argentina de futbol.

Un torneo Fantasy consta de que uno crea un torneo con el nombre a elección, y en la misma creación se le es asignado 11 jugadores al azar (mi idea es sacarlos de una api de estadísticas de futbol) los cuales podra vender o comprar a los demas participantes del torneo. La idea de tener jugadores es que al equipo de uno se le vayan sumando los puntos que recibió el jugador por su desempeño en el partido de tal fecha, si no juega son 0 puntos. Obviamente debe haber un ranking de los participantes ordenado por la cantidad de puntos que tiene cada uno, un ranking general y uno por cada fecha.

Además cuenta con un mercado de jugadores, el cual todas las fechas se resetea, para que los participantes puedan pujar (ofrecer cierta cantidad de dinero por el jugador, siempre y cuando no sea menor a su valor de mercado) sin saber cuanto han pujado los demás, unicamente sabrán la cantidad de pujas. Al final de la fecha, la página analiza las pujas, y el que haya ofertado más plata se le descuenta de su "banco" y se lleva el jugador, los jugadores que hayan perdido la puja se les es devuelto el dinero.

A su vez, luego de 14 dias de iniciado el torneo, los jugadores pueden pagar la cláusula del jugador rival, metodo por el cual compran un jugador más caro de lo normal pero se lo llevan directamente. Cada uno puede "blindar" a sus jugadores poniéndole plata de su banco para aumentar su cláusula a una relación de por cada peso que se le pone, la cláusula aumenta al doble de dicha cantidad. De no ser así, los participantes pueden negociar entre sí para llegar a acuerdos de venta de jugadores.


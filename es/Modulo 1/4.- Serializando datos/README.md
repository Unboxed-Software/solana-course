
# Serializar Datos con Instrucciones Personalizadas 
## Objetivos de la Lección
*Al final de esta lección, podrás:*
- Explicar los contenidos de una transacción
- Explicar las instrucciones de transacción
- Explicar los conceptos básicos de las optimizaciones de tiempo de ejecución de Solana
- Explicar Borsh
- Usar Borsh para serializar datos de instrucciones personalizadas

# Terminología 
- Las transacciones están compuestas por una serie de instrucciones, una sola transacción puede tener cualquier número de instrucciones, cada una dirigida a su propio programa. Cuando se envía una transacción, el tiempo de ejecución de Solana procesará sus instrucciones en orden y de manera atómica, lo que significa que si alguna de las instrucciones falla por cualquier razón, la transacción completa fallará al ser procesada.
- Cada instrucción está compuesta por 3 componentes: el ID del programa destinado, una matriz de todas las cuentas involucradas y un búfer de datos de instrucción.
- Cada transacción contiene: una matriz de todas las cuentas de las que pretende leer o escribir, una o más instrucciones, un blockhash reciente y una o más firmas.
- Para pasar los datos de la instrucción desde un cliente, debe ser serializado en un búfer de bytes. Para facilitar este proceso de serialización, usaremos Borsh.
- Las transacciones pueden fallar al ser procesadas por la cadena de bloques por cualquier número de razones, discutiremos algunas de las más comunes aquí.
 
# Resumen
## Transacciones
Las transacciones son cómo enviamos información a la cadena de bloques para que sea procesada. Hasta ahora, hemos aprendido a crear transacciones muy básicas con funcionalidad limitada. Pero las transacciones y los programas a los que se envían pueden ser diseñados para ser mucho más flexibles y manejar mucha más complejidad de lo que hemos tratado hasta ahora.

### Contenidos de las Transacciones
Cada transacción contiene:
- Un array que incluye cada cuenta de la que se intenta leer o escribir
- Una o más instrucciones
- Un hash de bloque reciente
- Una o más firmas
**@solana/web3.js** simplifica este proceso para que solo tengas que enfocarte en agregar instrucciones y firmas. La biblioteca construye el arreglo de cuentas basado en esa información y maneja la lógica para incluir un hash de bloque reciente.

## Instrucciones
Cada instrucción contiene:
- La ID del programa (llave pública) al que se destina
- Un arreglo que lista cada cuenta de la que se leerá o escribirá durante la ejecución
- Un búfer de bytes de datos de instrucción

La identificación del programa mediante su llave pública asegura que la instrucción se lleve a cabo por el programa correcto.
Incluir una matriz de cada cuenta que se leerá o escribirá permite a la red realizar una serie de optimizaciones que permiten una alta carga de transacciones y una ejecución más rápida.
El búfer de bytes le permite pasar datos externos a un programa.
Puede incluir varias instrucciones en una sola transacción. El tiempo de ejecución de Solana procesará estas instrucciones en orden y de forma atómica. En otras palabras, si cada instrucción tiene éxito, entonces la transacción en su conjunto tendrá éxito, pero si una sola instrucción falla, entonces toda la transacción fallará inmediatamente sin efectos secundarios.
Una nota sobre la matriz de cuentas y la optimización:
No es solo una matriz de las llaves públicas de las cuentas. Cada objeto en la matriz incluye la llave pública de la cuenta, si es o no una firma en la transacción y si es o no escribible. Incluir si una cuenta es escribible durante la ejecución de una instrucción permite al tiempo de ejecución facilitar el procesamiento paralelo de los contratos inteligentes. Debido a que debe definir qué cuentas son de solo lectura y a las que escribirá, el tiempo de ejecución puede determinar qué transacciones son no solapadas o de solo lectura y permitir que se ejecuten de forma concurrente. Para obtener más información sobre el tiempo de ejecución de Solana, consulte esta **publicación de blog** .


### Datos de Instrucción
La capacidad de agregar datos arbitrarios a una instrucción asegura que los programas pueden ser lo suficientemente dinámicos y flexibles para un amplio rango de usos, al igual que el cuerpo de una solicitud HTTP permite crear APIs REST dinámicas y flexibles.
Al igual que la estructura del cuerpo de una solicitud HTTP depende del punto final al que desea llamar, la estructura del búfer de bytes utilizado como datos de instrucción depende completamente del programa receptor. Si está construyendo una aplicación completa de una sola vez, deberá copiar la misma estructura que utilizó al construir el programa en el código del lado del cliente. Si trabaja con otro desarrollador que se encarga del desarrollo del programa, puede coordinar para garantizar una disposición de búfer coincidente.
Imaginemos un ejemplo concreto. Imagina trabajar en un juego Web3 y ser responsable de escribir el código del lado del cliente que interactúa con un programa de inventario de jugadores. El programa fue diseñado para permitir al cliente:
- Agregar inventario en función de los resultados de juego del jugador
- Transferir inventario de un jugador a otro
- Equipar a un jugador con elementos de inventario seleccionados
Este programa se estructuraría de tal manera que cada uno de ellos esté encapsulado en su propia función. 
Sin embargo, cada programa solo tiene un punto de entrada. Le indicaría al programa en qué de estas funciones ejecutar mediante los datos de instrucción.
También incluiría en los datos de instrucción cualquier información que la función necesite para ejecutarse correctamente, por ejemplo, el ID de un elemento de inventario, un jugador para transferir inventario, etc. 
Exactamente cómo se estructuraría esta información dependería de cómo se escribió el programa, pero es común que el primer campo en los datos de instrucción sea un número que el programa pueda asociar a una función, después de lo cual los campos adicionales actúan como argumentos de función.
 
## Serialización
Además de saber qué información incluir en un búfer de datos de instrucción, también necesita serializarlo correctamente. El serializador más común utilizado en Solana es **Borsh** . Según el sitio web:

*”Borsh significa Binary Object Representation Serializer for Hashing (Serializador de representación de objeto binario para la generación de huellas digitales). Se destina a ser utilizado en proyectos críticos para la seguridad ya que prioriza la consistencia, la seguridad y la velocidad, y viene con una especificación estricta.”*

Borsh mantiene una **biblioteca JS** que maneja la serialización de tipos comunes en un búfer. También hay otros paquetes construidos sobre borsh que intentan hacer este proceso aún más fácil. Utilizaremos la biblioteca **@project-serum/borsh** que se puede instalar mediante **npm**.

A partir del ejemplo anterior de inventario de juegos, veamos un escenario hipotético en el que estamos instruyendo al programa para equipar a un jugador con un determinado elemento. Asuma que el programa está diseñado para aceptar un búfer que representa una estructura con las siguientes propiedades:
 1. **variante** como un entero sin signo de 8 bits que indica al programa qué instrucción o función ejecutar.
2. **playerId** como un entero sin signo de 16 bits que representa el ID del jugador que se equipará con el elemento dado.
3. **itemId** como un entero sin signo de 256 bits que representa el ID del elemento que se equipará al jugador dado.
Todo esto se pasará como un búfer de bytes que se leerá en orden, por lo que es crucial asegurar el orden correcto de la disposición del búfer. Crearía el esquema o plantilla de disposición de búfer para lo anterior de la siguiente manera:

```JavaScript
import * as borsh from '@project-serum/borsh'

const equipPlayerSchema = borsh.struct([
	borsh.u8('variant'),
	borsh.u16('playerId'),
	borsh.u256('itemId')
])
```

Luego, puede codificar los datos utilizando este esquema con el método de **codificación**. Este método acepta como argumentos un objeto que representa los datos que se deben serializar y un búfer. En el ejemplo siguiente, asignamos un nuevo búfer que es mucho más grande de lo necesario, luego codificamos los datos en ese búfer y lo cortamos en un nuevo búfer que solo es tan grande como se necesita.

```JavaScript
import * as borsh from '@project-serum/borsh'

const equipPlayerSchema = borsh.struct([
	borsh.u8('variant'),
	borsh.u16('playerId'),
	borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))
```

Una vez que se ha creado correctamente un búfer y se ha serializado los datos, lo único que queda es construir la transacción. Esto es similar a lo que ha hecho en lecciones anteriores. El ejemplo a continuación supone que:
- **player** , **playerInfoAccount** y **PROGRAM_ID** ya están definidos en algún lugar fuera del fragmento de código
- **player** es la llave pública de un usuario
- **playerInfoAccount** es la llave pública de la cuenta donde se escribirán los cambios del inventario
- **SystemProgram** se utilizará en el proceso de ejecución de la instrucción.

```JavaScript
import * as borsh from '@project-serum/borsh'
import * as web3 from '@solana/web3.js'

const equipPlayerSchema = borsh.struct([
	borsh.u8('variant'),
	borsh.u16('playerId'),
	borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))

const endpoint = web3.clusterApiUrl('devnet')
const connection = new web3.Connection(endpoint)

const transaction = new web3.Transaction()
const instruction = new web3.TransactionInstruction({
	keys: [
		{
      pubkey: player.publicKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: playerInfoAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    }
	],
	data: instructionBuffer,
	programId: PROGRAM_ID
})

transaction.add(instruction)

web3.sendAndConfirmTransaction(connection, transaction, [player]).then((txid) => {
	console.log(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
})
```

 # Demostración
Practiquemos juntos construyendo una aplicación de Revisión de Películas que permite a los usuarios enviar una revisión de una película y almacenarla en la red de Solana. Construiremos esta aplicación poco a poco en las próximas lecciones, agregando nuevas funcionalidades en cada lección.

![4.1](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.4/1.png)
 
La llave pública del programa Solana que utilizaremos para esta aplicación es **CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN** .

## 1. Descargar el Código Inicial
Antes de comenzar, descargue [el código inicial](https://github.com/Unboxed-Software/solana-movie-frontend/tree/starter) .
El proyecto es una aplicación Next.js bastante simple. Incluye el **WalletContextProvider** que creamos en la lección de Wallets, un componente **Card** para mostrar una revisión de película, un componente **MovieList** que muestra revisiones en una lista, un componente **Form** para enviar una nueva revisión y un archivo **Movie.ts** que contiene una definición de clase para un objeto **Movie** .
Tenga en cuenta que por ahora, las películas que se muestran en la página cuando ejecuta **npm run dev** son mocks. En esta lección, nos enfocaremos en agregar una nueva revisión, pero no podremos ver esa revisión en pantalla. En la próxima lección, nos enfocaremos en deserializar datos personalizados de cuentas en cadena.

## 2. Crear la Disposición del Búfer
Recuerde que para interactuar adecuadamente con un programa de Solana, necesita saber cómo se espera que los datos estén estructurados. Nuestro programa de Revisión de Películas espera que los datos de instrucción contengan:
1. **variante** como un entero sin signo de 8 bits que representa qué instrucción debe ejecutarse (en otras palabras, qué función del programa debe llamarse).
2. **título** como una cadena que representa el título de la película que está revisando.
3. **puntuación** como un entero sin signo de 8 bits que representa la puntuación de 5 que está dando a la película que está revisando.
4. **descripción** como una cadena que representa la parte escrita de la revisión que está dejando para la película.

Configuremos un esquema de instrucción **borsh** en la clase **Movie** . Comience importando **@project-serum/borsh**. A continuación, cree una propiedad **borshInstructionSchema** y establezca en el struct **borsh** apropiado que contiene las propiedades listadas anteriormente.

```JavaScript
import * as borsh from '@project-serum/borsh'

export class Movie {
	titulo: string;
	rating: number;
	descripcion: string;

	...

	borshInstructionSchema = borsh.struct([
		borsh.u8('variant'),
		borsh.str('titulo'),
		borsh.u8('rating'),
		borsh.str('descripcion'),
	])
}
```

 Ten en cuenta que el orden importa. Si el orden de las propiedades aquí difiere de cómo está estructurado el programa, la transacción fallará.

## 3. Crear un Método para Serializar Datos
Ahora que tenemos la disposición del búfer configurada, creemos un método en **Movie** llamado **serialize()** que devolverá un **Buffer** con las propiedades de un objeto **Movie** codificadas en el diseño adecuado.

```JavaScript
import * as borsh from '@project-serum/borsh'

export class Movie {
	titulo: string;
	rating: number;
	descripcion: string;

	...

	borshInstructionSchema = borsh.struct([
		borsh.u8('variant'),
		borsh.str('title'),
		borsh.u8('rating'),
		borsh.str('description'),
	])

	serialize(): Buffer {
		const buffer = Buffer.alloc(1000)
		this.borshInstructionSchema.encode({ ...this, variant: 0 }, buffer)
		return buffer.slice(0, this.borshInstructionSchema.getSpan(buffer))
	}
}
```

El método mostrado anteriormente primero crea un buffer lo suficientemente grande para nuestro objeto, luego codifica **{ ...this, variant: 0 }** en el buffer. Debido a que la definición de la clase **Movie** contiene 3 de las 4 propiedades requeridas por la disposición del buffer y utiliza el mismo nombre, se puede usar directamente con el operador de propagación y solo agregar la propiedad **variante** . Finalmente, el método devuelve un nuevo buffer que descarta la porción no utilizada del original.

## 4. Enviar Transacción cuando el usuario envía el formulario
Ahora que tenemos los bloques de construcción para los datos de instrucción, podemos crear y enviar la transacción cuando un usuario envía el formulario. Abra **Form.tsx** y busque la función **handleTransactionSubmit** . Esta se llama cada vez que un usuario envía el formulario de reseña de películas.

Dentro de esta función, crearemos y enviaremos la transacción que contiene los datos enviados a través del formulario.

Comience importando **@solana/web3.js** e importando **useConnection** y **useWallet** de **@solana/wallet-adapter-react** .

```JavaScript
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
```


A continuación, antes de la función **handleSubmit** , llame a **useConnection()** para obtener un objeto de **conexión** y llame a **useWallet()** para obtener **publicKey** y **sendTransaction** .

```JavaScript
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'

const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export const Form: FC = () => {
	const [titulo, setTitulo] = useState('')
	const [rating, setRating] = useState(0)
	const [mensaje, setMensaje] = useState('')

	const { connection } = useConnection();
	const { publicKey, sendTransaction } = useWallet();

	const handleSubmit = (event: any) => {
		event.preventDefault()
		const movie = new Movie(titulo, rating, mensaje)
		handleTransactionSubmit(movie)
	}

	...
}
```

Antes de implementar **handleTransactionSubmit** , hablemos sobre lo que necesita ser hecho. Necesitamos:
1. Comprobar que **publicKey** existe para asegurarnos de que el usuario ha conectado su billetera.
2. Llamar a **serialize()** en la **película** para obtener un buffer que representa los datos de instrucción.
3. Crear un nuevo objeto de **Transacción** .
4. Obtener todas las cuentas de las que la transacción leerá o escribirá.
5. Crear un nuevo objeto de **Instrucción** que incluya todas estas cuentas en los argumentos **keys** , incluya el buffer en el argumento **data** y incluya la llave pública del programa en el argumento **programId** .
6. Agregar la instrucción del paso anterior a la transacción.
7. Llamar a **sendTransaction** , pasando la transacción armada.

¡Esto es bastante para procesar! Pero no te preocupes, se vuelve más fácil a medida que lo haces más. Comencemos con los primeros 3 pasos de arriba:

```JavaScript
const handleTransactionSubmit = async (movie: Movie) => {
	if (!publicKey) {
		alert('Please connect your wallet!')
		return
	}

	const buffer = movie.serialize()
	const transaction = new web3.Transaction()
}
```

El siguiente paso es obtener todas las cuentas de las que la transacción leerá o escribirá. En lecciones anteriores, se te ha dado la cuenta donde se almacenarán los datos. Esta vez, la dirección de la cuenta es más dinámica, por lo que debe ser calculada. Cubriremos esto en profundidad en la próxima lección, pero por ahora puedes usar lo siguiente, donde **pda** es la dirección de la cuenta donde se almacenarán los datos:

```JavaScript
const [pda] = await web3.PublicKey.findProgramAddress(
	[publicKey.toBuffer(), Buffer.from(movie.title)],
	new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
)
```

Además de esta cuenta, el programa también necesitará leer de **SystemProgram** , por lo que nuestro arreglo también debe incluir **web3.SystemProgram.programId**.

Con eso, podemos terminar los pasos restantes:

```JavaScript
const handleTransactionSubmit = async (movie: Movie) => {
	if (!publicKey) {
		alert('Please connect your wallet!')
		return
	}

	const buffer = movie.serialize()
	const transaction = new web3.Transaction()

	const [pda] = await web3.PublicKey.findProgramAddress(
		[publicKey.toBuffer(), new TextEncoder().encode(movie.title)],
		new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
	)

	const instruccion = new web3.TransactionInstruction({
		keys: [
			{
				pubkey: publicKey,
				isSigner: true,
				isWritable: false,
			},
			{
				pubkey: pda,
				isSigner: false,
				isWritable: true
			},
			{
				pubkey: web3.SystemProgram.programId,
				isSigner: false,
				isWritable: false
			}
		],
		data: buffer,
		programId: new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
	})

	transaction.add(instruccion)

	try {
		let txid = await sendTransaction(transaccion, conexion)
		console.log(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
	} catch (e) {
		alert(JSON.stringify(e))
	}
}
```

¡Y eso es todo! Ahora deberías poder usar el formulario en el sitio para enviar una reseña de película. Aunque no verás la actualización de la interfaz gráfica para reflejar la nueva reseña, puedes ver los registros de programa de la transacción en Solana Explorer para ver que fue exitosa.
Si necesitas un poco más de tiempo con este proyecto para sentirte cómodo, echa un vistazo al **código de solución** completa.

## Desafío

Ahora es su turno de construir algo de forma independiente. Cree una aplicación que permita a los estudiantes de este curso presentarse a sí mismos. El programa Solana que admite esto se encuentra en HdE95RSVsdb315jfJtaykXhXY478h53X6okDupVfY9yf.



![4.2](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%201/images/1.4/2.png)



- Puedes construir esto desde cero o puedes descargar el código inicial aquí.
- Crea el diseño del búfer de instrucciones en StudentIntro.ts. El programa espera que los datos de instrucción contengan:
1. **variante** como un entero sin signo de 8 bits que representa la instrucción a ejecutar (debe ser 0).
2. **nombre** como una cadena que representa el nombre del estudiante.
3. **mensaje** como una cadena que representa el mensaje que el estudiante comparte sobre su viaje en Solana.
- Crea un método en StudentIntro.ts que utilice el diseño de búfer para serializar un objeto StudentIntro.
- En el componente Form, implementa la función handleTransactionSubmit de manera que serialice un StudentIntro, construya las instrucciones y transacciones apropiadas y envíe la transacción a la billetera del usuario.
- ¡Ahora deberías poder enviar presentaciones y tener la información almacenada en la cadena! Asegúrese de registrar el ID de la transacción y verificarlo en el Explorador Solana para verificar que funcionó.
Si realmente está atascado, puede consultar el código de solución [aquí](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data).

No dude en ser creativo con estos desafíos y llevarlos aún más lejos. ¡Las instrucciones no están aquí para retenerlo!

# Página, pedido y filtro de cuenta personalizados. 
## Objetivos de la Lección
Al final de esta lección, podrá:
 
-  Paginar, ordenar e filtrar cuentas
- Obtener cuentas sin datos de antemano
- Determinar dónde se almacena un dato específico en la estructura de buffer de una cuenta
- Obtener cuentas con un subconjunto de datos que se pueden utilizar para ordenar cuentas
- Recuperar solo cuentas cuyos datos coincidan con criterios específicos
- Obtener un subconjunto de cuentas totales utilizando **getMultipleAccounts**

# Terminología
- Esta lección se adentra en algunas funcionalidades de las llamadas RPC que utilizamos en la lección de deserialización de datos de cuenta
- Para ahorrar tiempo de cómputo, puede obtener un gran número de cuentas sin sus datos filtrándolas para devolver solo una matriz de llaves públicas
- Una vez que tenga una lista filtrada de llaves públicas, puede ordenarlas y obtener los datos de la cuenta a la que pertenecen.

# Resumen
Es posible que haya notado en la última lección que, aunque pudiéramos obtener y mostrar una lista de datos de cuenta, no tuviéramos ningún control granular sobre cuántas cuentas obtener o su orden. En esta lección, aprenderemos sobre algunas opciones de configuración para la función **getProgramAccounts** que habilitarán cosas como la paginación, ordenar cuentas y filtrar.

## Usar dataSlice para solo obtener los datos que necesita
Imagina la aplicación de reseñas de películas en la que trabajamos en lecciones anteriores con cuatro millones de reseñas de películas y que la reseña promedio sea de 500 bytes. Esto haría que la descarga total de todas las cuentas de reseñas fuera más de 2GB. Definitivamente no es algo que quieras que tu frontend descargue cada vez que se actualice la página.

Afortunadamente, la función **getProgramAccounts** que utilizas para obtener todas las cuentas toma un objeto de configuración como argumento. Una de las opciones de configuración es **dataSlice** que te permite proporcionar dos cosas:

- **offset** - el desplazamiento desde el principio del búfer de datos para comenzar el trozo
- **longitud** - el número de bytes a devolver, comenzando desde el offset proporcionado

Cuando incluyes un **dataSlice** en el objeto de configuración, la función solo devolverá el subconjunto del búfer de datos que especificaste.

## Paginación de Cuentas
Una de las áreas en las que esto es útil es con la paginación. Si desea tener una lista que muestre todas las cuentas, pero hay tantas cuentas que no desea obtener todos los datos de una vez, puede obtener todas las cuentas sin datos. Luego, puede asignar el resultado a una lista de llaves de cuenta cuyos datos solo puede obtener según sea necesario.

```JavaScript
const accountsWithoutData = await conexion.getProgramAccounts(
	programId,
	{
		dataSlice: { offset: 0, length: 0 }
	}
)

const accountKeys = accountsWithoutData.map(account => account.pubkey)
```
   	
Con esta lista de llaves, luego puede obtener datos de cuenta en "páginas" utilizando el método **getMultipleAccountsInfo** :

```JavaScript
const llavesPaginadas = accountKeys.slice(0, 10)
const infoDeCuentas = await conexion.getMultipleAccountsInfo(paginatedKeys)
const ObjetosDescerializados = accountInfos.map((accountInfo) => {
	// lógica para descerializar la cuenta aquí 
})
```

## Ordenando Cuentas
La opción **dataSlice** también es útil cuando necesita ordenar una lista de cuentas mientras se hace paginación. Todavía no deseas obtener todos los datos de una vez, pero si necesitas todas las llaves y una forma de ordenarlas de antemano. En este caso, necesitas entender el diseño de los datos de la cuenta y configurar el trozo de datos para que solo sea la información que necesitas usar para ordenar.

Por ejemplo, podrías tener una cuenta que almacene información de contacto de la siguiente manera:
- **inicializado** como un booleano
- **número de teléfono** como un entero sin signo de 64 bits
- **primer nombre** como una cadena
- **segundo nombre** como una cadena

Si desea ordenar todas las llaves de cuenta alfabéticamente en función del nombre del usuario, debe descubrir el desplazamiento donde comienza el nombre. El primer campo, **inicializado** , ocupa el primer byte, luego el **número de teléfono** ocupa otro 8, por lo que el campo **firstName** comienza en offset **1 + 8 = 9** .

Luego debe determinar la longitud para hacer el trozo de datos. Dado que la longitud es variable, no podemos saberlo con certeza, pero puede elegir una longitud que sea lo suficientemente grande para cubrir la mayoría de los casos y lo suficientemente corta como para no ser una carga para obtener. 15 bytes es suficiente para la mayoría de los primeros nombres, pero resultaría en una descarga pequeña incluso con un millón de usuarios.

Una vez que ha obtenido cuentas con el trozo de datos dado, puede usar el método **sort** para ordenar la matriz antes de asignarla a una matriz de llaves públicas.

```JavaScript
const cuentas = await conexion.getProgramAccounts(
	programId,
	{
		dataSlice: { offset: 9, length: 15 }
	}
)

	cuentas.sort( (a, b) => {
		const lengthA = a.account.data.readUInt32LE(0)
		const lengthB = b.account.data.readUInt32LE(0)
		const dataA = a.account.data.slice(4, 4 + lengthA)
		const dataB = b.account.data.slice(4, 4 + lengthB)
		return dataA.compare(dataB)
	})

const accountKeys = cuentas.map(cuenta => cuenta.pubkey)
```

Tenga en cuenta que en el fragmento anterior no comparamos los datos tal como se dan. Esto se debe a que para tipos de tamaño dinámico como las cadenas, Borsh coloca un entero sin signo de 32 bits al principio para indicar la longitud de los datos que representan ese campo. Por lo tanto, para comparar directamente los nombres, necesitamos obtener la longitud de cada uno, luego crear un trozo de datos con un desplazamiento de 4 bytes y la longitud adecuada.

## Usa filtros para recuperar solo cuentas específicas
Limitar los datos recibidos por cuenta es genial, pero ¿qué pasa si solo deseas devolver cuentas que coincidan con un criterio específico en lugar de todas ellas? Ahí es donde entra en juego la opción de **filtros** . Esta opción es una matriz que puede tener objetos que coincidan con lo siguiente:
- **memcmp** - compara una serie de bytes proporcionados con los datos de cuenta del programa en un punto de offset específico. Campos:
- **offset** - el número de desplazamiento en los datos de cuenta del programa antes de comparar los datos
- **bytes** - una cadena codificada en base 58 que representa los datos para comparar; limitado a menos de 129 bytes
- **dataSize** - compara la longitud de los datos de cuenta del programa con el tamaño de datos proporcionado

Esto te permite filtrar en función de los datos que coinciden y/o el tamaño total de los datos.
Por ejemplo, podrías buscar en una lista de contactos incluyendo un filtro **memcmp** :

```JavaScript
async function fetchMatchingContactAccounts(conexion: web3.Connection, busqueda: string): Promise<(web3.AccountInfo<Buffer> | null)[]> {
	const accounts = await conexion.getProgramAccounts(
		programId,
		{
			dataSlice: { offset: 0, length: 0 },
			filters: [
				{
					memcmp:
						{
							offset: 9,
							bytes: bs58.encode(Buffer.from(busqueda))
						}
				}
			]
		}
	)
}
```

Dos cosas a tener en cuenta en el ejemplo anterior:
1. Estamos estableciendo el desplazamiento en 9 porque eso es lo que determinamos anteriormente es el desplazamiento donde comienza **firstName** en el diseño de datos.
2. Estamos usando una biblioteca de terceros **bs58** para realizar la codificación base-58 en el término de búsqueda. Puedes instalarlo usando **npm install bs58** .

# Demostración
¿Recuerdas la aplicación de reseñas de películas en la que trabajamos en las últimas dos lecciones? Vamos a darle un toque especial al paginando la lista de reseñas, ordenando las reseñas para que no sean tan aleatorias e incluyendo una funcionalidad de búsqueda básica. No te preocupes si acabas de comenzar esta lección sin haber mirado las anteriores, siempre y cuando tengas los conocimientos previos, deberías ser capaz de seguir la demostración sin haber trabajado en este proyecto específico todavía.


![6.1](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.6/1.png)

## 1. Descargue el código de inicio
Si no completó la demostración de la última lección o solo desea asegurarse de no haber perdido nada, puede descargar el [código de inicio](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-deserialize-account-data).
El proyecto es una aplicación Next.js bastante simple. Incluye el **WalletContextProvider** que creamos en la lección de monederos, un componente **Card** para mostrar una reseña de película, un componente **MovieList** que muestra reseñas en una lista, un componente **Form** para enviar una nueva reseña y un archivo **Movie.ts** que contiene una definición de clase para un objeto **Película** .

## 2. Agregue paginación de reseñas
Primero que nada, creemos un espacio para encapsular el código para obtener los datos de la cuenta. Crea un nuevo archivo **MovieCoordinator.ts** y declara una clase **MovieCoordinator** . Luego, movamos la constante **MOVIE_REVIEW_PROGRAM_ID** de **MovieList** a este nuevo archivo ya que vamos a mover todas las referencias a ella.

```JavaScript
const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export class MovieCoordinator { }
```

Ahora podemos usar **MovieCoordinator** para crear una implementación de paginación. Una nota rápida antes de sumergirnos: esta será una implementación de paginación tan simple como sea posible para que podamos centrarnos en la parte compleja de interactuar con las cuentas de Solana. Puedes y debes hacerlo mejor para una aplicación en producción.

Con eso fuera de camino, creemos una propiedad estática **accounts** de tipo **web3.PublicKey[]** , una función estática **prefetchAccounts (conexión: web3.Connection)** y una función estática **fetchPage (conexión: web3.Connection, página: number, porPágina: number): Promise<Movie[]>** . También necesitará importar **@solana/web3.js** y **Movie** .

```JavaScript
import * as web3 from '@solana/web3.js'
import { Movie } from '../models/Movie'

const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export class MovieCoordinator {
	static accounts: web3.PublicKey[] = []

	static async prefetchAccounts(conexion: web3.Connection) {

	}

	static async fetchPage(conexion: web3.Connection, page: number, perPage: number): Promise<Movie[]> {

	}
}
```

La llave para la paginación es pre-cargar todas las cuentas sin datos. Rellenemos el cuerpo de **prefetchAccounts** para hacerlo y establezcamos las llaves públicas recuperadas en la propiedad **accounts** estática.

```JavaScript
static async prefetchAccounts(conexion: web3.Connection) {
	const accounts = await conexion.getProgramAccounts(
		new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
		{
			dataSlice: { offset: 0, length: 0 },
		}
	)

	this.accounts = accounts.map(account => account.pubkey)
}
```

Ahora, llenemos el método **fetchPage** . Primero, si las cuentas aún no se han pre-cargado, deberemos hacerlo. Luego, podemos obtener las llaves públicas de las cuentas que corresponden a la página solicitada y llamar a **conexion.getMultipleAccountsInfo** . Finalmente, deserializamos los datos de la cuenta y devolvemos los objetos **Película** correspondientes.

```JavaScript
static async fetchPage(conexion: web3.Connection, page: number, perPage: number): Promise<Movie[]> {
	if (this.accounts.length === 0) {
		await this.prefetchAccounts(conexion)
	}

	const paginatedPublicKeys = this.accounts.slice(
		(page - 1) * perPage,
		page * perPage,
	)

	if (paginatedPublicKeys.length === 0) {
            return []
	}

	const accounts = await conexion.getMultipleAccountsInfo(paginatedPublicKeys)

	const pelis = accounts.reduce((accum: Movie[], account) => {
		const movie = Movie.deserialize(account?.data)
		if (!movie) {
			return accum
		}

		return [...accum, movie]
	}, [])

	return pelis
}
```

Con eso hecho, podemos reconfigurar **MovieList** para usar estos métodos. En **MovieList.tsx** , agregue **const [page, setPage] = useState (1)** cerca de las llamadas **useState** existentes. Luego, actualice **useEffect** para llamar a **MovieCoordinator.fetchPage** en lugar de recuperar las cuentas en línea.

```JavaScript
const conexion = new web3.Connection(web3.clusterApiUrl('devnet'))
const [pelis, setPelis] = useState<Movie[]>([])
const [page, setPage] = useState(1)

useEffect(() => {
	MovieCoordinator.fetchPage(
		conexion,
		page,
		10
	).then(setPelis)
}, [page, busqueda])
```

Por último, necesitamos agregar botones en la parte inferior de la lista para navegar a diferentes páginas:

```JavaScript
return (
	<div>
		{
			pelis.map((peli, i) => <Card key={i} movie={peli} /> )
		}
		<Center>
			<HStack w='full' mt={2} mb={8} ml={4} mr={4}>
				{
					page > 1 && <Button onClick={() => setPage(page - 1)}>Previous</Button>
				}
				<Spacer />
				{
					MovieCoordinator.accounts.length > page * 2 &&
						<Button onClick={() => setPage(page + 1)}>Next</Button>
				}
			</HStack>
		</Center>
	</div>
)
```

En este punto, ¡deberías poder ejecutar el proyecto y hacer clic entre las páginas!

## 3. Ordenar reseñas alfabeticamente
Si miras las reseñas, es posible que te des cuenta de que no están en ningún orden específico. Podemos arreglar esto agregando de nuevo suficientes datos en nuestra porción de datos para ayudarnos a hacer algunas clasificaciones. Las diversas propiedades en el búfer de datos de la reseña de la película están dispuestas de la siguiente manera:
- **inicializado** - entero sin signo de 8 bits; 1 byte
- **calificación** - entero sin signo de 8 bits; 1 byte
- **título** - cadena; número desconocido de bytes
- **descripción** - cadena; número desconocido de bytes

Basado en esto, el desplazamiento que necesitamos proporcionar a la porción de datos para acceder al **título** es 2. La longitud, sin embargo, es indeterminada, por lo que podemos proporcionar solo una longitud razonable. Me quedaré con 18 ya que cubrirá la longitud de la mayoría de los títulos sin tener que recuperar demasiados datos cada vez.

Una vez que hemos modificado la porción de datos en **getProgramAccounts** , entonces necesitamos realmente ordenar el arreglo devuelto. Para hacer esto, necesitamos comparar la parte del búfer de datos que realmente corresponde al **título** . Los primeros 4 bytes de un campo dinámico en Borsh se utilizan para almacenar la longitud del campo en bytes. Entonces, en cualquier búfer de **datos** dado que está recortado de la manera en que discutimos anteriormente, la porción de cadena es **data.slice(4, 4 + data[0])** .

Ahora que hemos pensado en esto, modifiquemos la implementación de **prefetchAccounts** en **MovieCoordinator** :

```JavaScript
static async prefetchAccounts(conexion: web3.Connection, filters: AccountFilter[]) {
	const cuentas = await conexion.getProgramAccounts(
		new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
		{
			dataSlice: { offset: 2, length: 18 },
		}
	)

    cuentas.sort( (a, b) => {
        const lengthA = a.account.data.readUInt32LE(0)
        const lengthB = b.account.data.readUInt32LE(0)
        const dataA = a.account.data.slice(4, 4 + lengthA)
        const dataB = b.account.data.slice(4, 4 + lengthB)
        return dataA.compare(dataB)
    })

	this.accounts = cuentas.map(cuenta => cuenta.pubkey)
}
```

Y así es como, deberías poder ejecutar la aplicación y ver la lista de reseñas de películas ordenadas alfabéticamente.
 
## 4. Agregar búsqueda
Lo último que haremos para mejorar esta aplicación es agregar alguna capacidad de búsqueda básica. Agreguemos un parámetro de **búsqueda** a **prefetchAccounts** y reconfiguramos el cuerpo de la función para usarlo.

Podemos usar la propiedad **filtros** del parámetro **config** de **getProgramAccounts** para filtrar cuentas por datos específicos. El desplazamiento a los campos de título es 2, pero los primeros 4 bytes son la longitud del título, por lo que el desplazamiento real al string en sí es 6. Recuerda que los bytes deben ser codificados en base 58, así que instalemos e importemos **bs58** .

```JavaScript
import bs58 from 'bs58'

...

static async prefetchAccounts(conexion: web3.Connection, busqueda: string) {
	const accounts = await conexion.getProgramAccounts(
		new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
		{
			dataSlice: { offset: 2, length: 18 },
			filters: busqueda === '' ? [] : [
				{
					memcmp:
						{
							offset: 6,
							bytes: bs58.encode(Buffer.from(busqueda))
						}
				}
			]
		}
	)

    accounts.sort( (a, b) => {
        const lengthA = a.account.data.readUInt32LE(0)
        const lengthB = b.account.data.readUInt32LE(0)
        const dataA = a.account.data.slice(4, 4 + lengthA)
        const dataB = b.account.data.slice(4, 4 + lengthB)
        return dataA.compare(dataB)
    })

	this.accounts = accounts.map(account => account.pubkey)
}
```

Ahora, agregue un parámetro de **búsqueda** a **fetchPage** y actualice su llamada a **prefetchAccounts*** para pasarlo. También necesitaremos agregar un parámetro de **recarga** booleano a **fetchPage** para que podamos forzar una actualización de la pre-carga de cuentas cada vez que cambie el valor de búsqueda.

```JavaScript
static async fetchPage(conexion: web3.Connection, page: number, perPage: number, busqueda: string, reload: boolean = false): Promise<Movie[]> {
	if (this.accounts.length === 0 || reload) {
		await this.prefetchAccounts(conexion, busqueda)
	}

	const paginatedPublicKeys = this.accounts.slice(
		(page - 1) * perPage,
		page * perPage,
	)

	if (paginatedPublicKeys.length === 0) {
		return []
	}

	const accounts = await conexion.getMultipleAccountsInfo(paginatedPublicKeys)

	const pelis = accounts.reduce((accum: Movie[], account) => {
		const movie = Movie.deserialize(account?.data)
		if (!movie) {
			return accum
		}

		return [...accum, movie]
	}, [])

	return pelis
}
```

Con eso en su lugar, actualicemos el código en **MovieList** para llamarlo correctamente.

Primero, agregue **const [busqueda, setBusqueda] = useState('')** cerca de las otras llamadas **useState** . Luego, actualice la llamada a **MovieCoordinator.fetchPage** en el **useEffect** para pasar el parámetro de **búsqueda** y para recargar cuando **busqueda !== ''** .

```JavaScript
const conexion = new web3.Connection(web3.clusterApiUrl('devnet'))
const [pelis, setPelis] = useState<Movie[]>([])
const [page, setPage] = useState(1)
const [busqueda, setBusqueda] = useState('')

useEffect(() => {
	MovieCoordinator.fetchPage(
		conexion,
		page,
		2,
		busqueda,
		busqueda !== ''
	).then(setPelis)
}, [page, busqueda])
```

Finalmente, agregue una barra de búsqueda que establecerá el valor de **busqueda**:

```JavaScript
return (
	<div>
		<Center>
			<Input
				id='busqueda'
				color='gray.400'
				onChange={event => setBusqueda(event.currentTarget.value)}
				placeholder='busqueda'
				w='97%'
				mt={2}
				mb={2}
			/>
		</Center>

...

	</div>
)
```
 
¡Y eso es todo! La aplicación ahora tiene reseñas ordenadas, paginación y búsqueda.
Eso fue mucho para digerir, pero lo lograste. Si necesitas pasar más tiempo con los conceptos, no dudes en volver a leer las secciones que fueron más desafiantes para ti y/o echa un vistazo al **código de solución** .
# Reto 
Ahora es tu turno de intentar hacerlo por tu cuenta. Utilizando la aplicación de presentación de estudiantes de la lección anterior, agrega la división en páginas, ordena alfabéticamente por nombre y busca por nombre.
 
1. Puedes construir esto desde cero o puedes descargar el **código inicial** .
2. Agrega la paginación al proyecto pre-cargando cuentas sin datos, luego solo cargando los datos de la cuenta para cada cuenta cuando sea necesario.
3. Ordena las cuentas que se muestran en la aplicación alfabéticamente por nombre.
4. Agrega la capacidad de buscar a través de las presentaciones por el nombre de un estudiante.
Este es un desafío. Si te quedas atascado, no dudes en consultar el **código de solución** . ¡Con esto completas el Módulo 1! ¿Cómo ha sido tu experiencia? ¡Sientete libre de compartir alguna retroalimentación rápida **aquí** , para que podamos seguir mejorando el curso!
¡Como siempre, sé creativo con estos desafíos y lleva los más allá de las instrucciones si lo deseas!

## Desafío
Ahora es su turno de tratar de hacerlo por su cuenta. Usando la aplicación Student Intros del último lección, agregue la paginación, ordenar alfabeticamente por nombre y búsqueda por nombre.

![6.2](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%201/images/1.6/2.png)

- Puedes construir esto desde cero o puedes descargar el código de inicio [aquí](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-deserialize-account-data).
- Agrega la paginación al proyecto prefetching cuentas sin datos, luego solo obteniendo los datos de la cuenta para cada cuenta cuando sea necesario.
- Ordena las cuentas mostradas en la aplicación alfabeticamente por nombre.
- Agrega la capacidad de buscar a través de presentaciones por el nombre de un estudiante.

Esto es desafiante. Si te atascas, no dudes en consultar el [código de solución](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-paging-account-data). Con esto, completas el Módulo 1. ¿Cómo ha sido tu experiencia? No dudes en compartir algunos comentarios rápidos [aquí](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%201), para que podamos seguir mejorando el curso.

Como siempre, sé creativo con estos desafíos y lleva más allá de las instrucciones si quieres.
---
title: Page, Order, and Filter Program Data 
objectives:
- Páginas, pedidos y filtros de cuentas
- Obtener cuentas sin datos
- Determinar dónde se almacenan los datos específicos en el diseño del búfer de una cuenta
- Obtener cuentas con un subconjunto de datos que se pueden utilizar para ordenar cuentas
- Obtener solo cuentas cuyos datos coincidan con criterios específicos
- Obtener un subconjunto de cuentas totales usando `getMultipleAccounts`
---

# TL;DR

-   Esta lección profundiza en algunas funcionalidades de las llamadas RPC que utilizamos en la lección de datos de cuenta de deserialización
-   Para ahorrar tiempo de cálculo, puede obtener una gran cantidad de cuentas sin sus datos filtrándolas para devolver solo una serie de claves públicas.
-   Una vez que tenga una lista filtrada de claves públicas, puede ordenarlas y obtener los datos de la cuenta a la que pertenecen.

# Descripción general

Es posible que haya notado en la última lección que, si bien podíamos obtener y mostrar una lista de datos de la cuenta, no teníamos ningún control granular sobre cuántas cuentas obtener o su pedido. En esta lección, aprenderemos sobre algunas opciones de configuración para la `getProgramAccounts` función que habilitará cosas como paginación, ordenar cuentas y filtrado.

## Úselo `dataSlice` para obtener solo los datos que necesita

Imagina la aplicación Movie Review en la que trabajamos en lecciones pasadas con cuatro millones de reseñas de películas y que la revisión promedio es de 500 bytes. Eso haría que la descarga total para todas las cuentas de revisión sea de más de 2 GB. Definitivamente no es algo que desee que su frontend se descargue cada vez que la página se actualiza.

Afortunadamente, la `getProgramAccounts` función que utiliza para obtener todas las cuentas toma un objeto de configuración como argumento. Una de las opciones de configuración es `dataSlice` que le permite proporcionar dos cosas:

-   `offset` - el desplazamiento desde el comienzo de la memoria intermedia de datos para iniciar el segmento
-   `length` - el número de bytes a devolver, a partir de la compensación proporcionada

Cuando incluye un `dataSlice` en el objeto de configuración, la función solo devolverá el subconjunto del búfer de datos que especificó.

### Cuentas de paginación

Un área en la que esto se vuelve útil es con la paginación. Si desea tener una lista que muestre todas las cuentas, pero hay tantas cuentas que no desea extraer todos los datos a la vez, puede buscar todas las cuentas sin datos. A continuación, puede asignar el resultado a una lista de claves de cuenta cuyos datos puede obtener solo cuando sea necesario.

```tsx
const accountsWithoutData = await connection.getProgramAccounts(programId, {
    dataSlice: { offset: 0, length: 0 },
});

const accountKeys = accountsWithoutData.map((account) => account.pubkey);
```

Con esta lista de claves, puede recuperar los datos de la cuenta en "páginas" utilizando el `getMultipleAccountsInfo` método:

```tsx
const paginatedKeys = accountKeys.slice(0, 10);
const accountInfos = await connection.getMultipleAccountsInfo(paginatedKeys);
const deserializedObjects = accountInfos.map((accountInfo) => {
    // put logic to deserialize accountInfo.data here
});
```

### Cuentas de pedidos

La `dataSlice` opción también es útil cuando necesita ordenar una lista de cuentas mientras busca. Todavía no desea obtener todos los datos a la vez, pero necesita todas las claves y una forma de ordenarlas por adelantado. En este caso, debe comprender el diseño de los datos de la cuenta y configurar el segmento de datos para que solo sean los datos que necesita usar para realizar el pedido.

Por ejemplo, es posible que tenga una cuenta que almacene información de contacto como esta:

-   `initialized` como un booleano
-   `phoneNumber` como un entero sin signo de 64 bits
-   `firstName` como una cadena
-   `secondName` como una cadena

Si desea ordenar todas las claves de la cuenta alfabéticamente en función del nombre del usuario, debe averiguar el desplazamiento donde comienza el nombre. El primer campo, `initialized`, toma el primer byte, luego `phoneNumber` toma otro 8, por lo que el `firstName` campo comienza en el desplazamiento `1 + 8 = 9`. Sin embargo, los campos de datos dinámicos en borsh utilizan los primeros 4 bytes para registrar la longitud de los datos, por lo que podemos omitir 4 bytes adicionales, lo que hace que el desplazamiento sea de 13.

A continuación, debe determinar la longitud para hacer el segmento de datos. Dado que la longitud es variable, no podemos saberlo con certeza antes de buscar los datos. Pero puede elegir una longitud que sea lo suficientemente grande como para cubrir la mayoría de los casos y lo suficientemente corta como para no ser una gran carga para obtener. 15 bytes es suficiente para la mayoría de los nombres, pero resultaría en una descarga lo suficientemente pequeña incluso con un millón de usuarios.

Una vez que haya obtenido cuentas con el segmento de datos dado, puede usar el `sort` método para ordenar la matriz antes de asignarla a una matriz de claves públicas.

```tsx
const accounts = await connection.getProgramAccounts(programId, {
    dataSlice: { offset: 13, length: 15 },
});

accounts.sort((a, b) => {
    const lengthA = a.account.data.readUInt32LE(0);
    const lengthB = b.account.data.readUInt32LE(0);
    const dataA = a.account.data.slice(4, 4 + lengthA);
    const dataB = b.account.data.slice(4, 4 + lengthB);
    return dataA.compare(dataB);
});

const accountKeys = accounts.map((account) => account.pubkey);
```

Tenga en cuenta que en el fragmento anterior no comparamos los datos como se indica. Esto se debe a que para tipos de tamaño dinámico como cadenas, Borsh coloca un entero sin signo de 32 bits al comienzo para indicar la longitud de los datos que representan ese campo. Entonces, para comparar los primeros nombres directamente, necesitamos obtener la longitud de cada uno, luego crear un segmento de datos con un desplazamiento de 4 bytes y la longitud adecuada.

## Utilizar solo `filters` para recuperar cuentas específicas

Limitar los datos recibidos por cuenta es genial, pero ¿qué pasa si solo desea devolver cuentas que coincidan con un criterio específico en lugar de todas ellas? Ahí es donde entra la opción de `filters` configuración. Esta opción es una matriz que puede tener objetos que coincidan con lo siguiente:

-   `memcmp`  - compara una serie de bytes proporcionada con los datos de la cuenta del programa en un desplazamiento particular. Campos:
    -   `offset`  - el número a compensar en los datos de la cuenta del programa antes de comparar los datos
    -   `bytes`  - una cadena codificada base-58 que representa los datos a emparejar; limitado a menos de 129 bytes
-   `dataSize`  - compara la longitud de los datos de la cuenta del programa con el tamaño de los datos proporcionados

Estos le permiten filtrar en función de los datos coincidentes y/o el tamaño total de los datos.

Por ejemplo, puede buscar a través de una lista de contactos mediante la inclusión de un `memcmp` filtro:

```tsx
async function fetchMatchingContactAccounts(
    connection: web3.Connection,
    search: string,
): Promise<(web3.AccountInfo<Buffer> | null)[]> {
    const accounts = await connection.getProgramAccounts(programId, {
        dataSlice: { offset: 0, length: 0 },
        filters: [
            {
                memcmp: {
                    offset: 13,
                    bytes: bs58.encode(Buffer.from(search)),
                },
            },
        ],
    });
}
```

Dos cosas a tener en cuenta en el ejemplo anterior:

1. Estamos estableciendo el desplazamiento a 13 porque determinamos previamente que el desplazamiento para `firstName` en el diseño de datos es 9 y queremos omitir adicionalmente los primeros 4 bytes que indican la longitud de la cadena.
2. Estamos utilizando una biblioteca de terceros `bs58` para realizar la codificación de base 58 en el término de búsqueda. Puedes instalarlo usando `npm install bs58`.

# Demostración

¿Recuerdas la aplicación Movie Review en la que trabajamos en las últimas dos lecciones? Vamos a darle un poco de sabor paginando la lista de reseñas, ordenando las reseñas para que no sean tan aleatorias y agregando algunas funciones básicas de búsqueda. No se preocupe si solo está saltando a esta lección sin haber mirado las anteriores, siempre y cuando tenga el conocimiento previo, debería poder seguir la demostración sin haber trabajado en este proyecto específico todavía.

![Captura de pantalla del frontend de revisión de películas](../../assets/movie-reviews-frontend.png)

### **1. Descargue el código de inicio**

Si no completaste la demostración de la última lección o simplemente quieres asegurarte de que no te perdiste nada, puedes descargar la[código de inicio](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-deserialize-account-data).

El proyecto es una aplicación Next.js bastante simple. Incluye el `WalletContextProvider` que creamos en la lección Wallets, un `Card` componente para mostrar una reseña de película, un `MovieList` componente que muestra reseñas en una lista, un `Form` componente para enviar una nueva reseña y un `Movie.ts` archivo que contiene una definición de clase para un `Movie` objeto.

### 2. Añadir paginación a las reseñas

Lo primero es lo primero, vamos a crear un espacio para encapsular el código para recuperar los datos de la cuenta. Cree un archivo nuevo `MovieCoordinator.ts` y declare una `MovieCoordinator` clase. Entonces vamos a mover la `MOVIE_REVIEW_PROGRAM_ID` constante de `MovieList` en este nuevo archivo ya que vamos a mover todas las referencias a él

```tsx
const MOVIE_REVIEW_PROGRAM_ID = "CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN";

export class MovieCoordinator {}
```

Ahora podemos usar `MovieCoordinator` para crear una implementación de paginación. Una nota rápida antes de sumergirnos: esta será una implementación de paginación lo más simple posible para que podamos centrarnos en la parte compleja de interactuar con las cuentas de Solana. Puede, y debe, hacerlo mejor para una aplicación de producción.

Con eso fuera del camino, vamos a crear una propiedad estática `accounts` de tipo `web3.PublicKey[]`, una función estática `prefetchAccounts(connection: web3.Connection)`, y una función estática `fetchPage(connection: web3.Connection, page: number, perPage: number): Promise<Movie[]>`. También necesitarás importar `@solana/web3.js` y `Movie`.

```tsx
import * as web3 from "@solana/web3.js";
import { Movie } from "../models/Movie";

const MOVIE_REVIEW_PROGRAM_ID = "CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN";

export class MovieCoordinator {
    static accounts: web3.PublicKey[] = [];

    static async prefetchAccounts(connection: web3.Connection) {}

    static async fetchPage(
        connection: web3.Connection,
        page: number,
        perPage: number,
    ): Promise<Movie[]> {}
}
```

La clave para la paginación es buscar previamente todas las cuentas sin datos. Vamos a rellenar el cuerpo de `prefetchAccounts` para hacer esto y establecer las claves públicas recuperadas a la `accounts` propiedad estática.

```tsx
static async prefetchAccounts(connection: web3.Connection) {
	const accounts = await connection.getProgramAccounts(
		new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
		{
			dataSlice: { offset: 0, length: 0 },
		}
	)

	this.accounts = accounts.map(account => account.pubkey)
}
```

Ahora, vamos a rellenar el `fetchPage` método. Primero, si las cuentas aún no se han obtenido previamente, tendremos que hacerlo. Luego, podemos obtener las claves públicas de la cuenta que corresponden a la página y llamada solicitadas `connection.getMultipleAccountsInfo`. Finalmente, deserializamos los datos de la cuenta y devolvemos los `Movie` objetos correspondientes.

```tsx
static async fetchPage(connection: web3.Connection, page: number, perPage: number): Promise<Movie[]> {
	if (this.accounts.length === 0) {
		await this.prefetchAccounts(connection)
	}

	const paginatedPublicKeys = this.accounts.slice(
		(page - 1) * perPage,
		page * perPage,
	)

	if (paginatedPublicKeys.length === 0) {
            return []
	}

	const accounts = await connection.getMultipleAccountsInfo(paginatedPublicKeys)

	const movies = accounts.reduce((accum: Movie[], account) => {
		const movie = Movie.deserialize(account?.data)
		if (!movie) {
			return accum
		}

		return [...accum, movie]
	}, [])

	return movies
}
```

Una vez hecho esto, podemos reconfigurar `MovieList` para usar estos métodos. En `MovieList.tsx`, añada `const [page, setPage] = useState(1)` cerca de las `useState` llamadas existentes. Luego, actualice `useEffect` para llamar `MovieCoordinator.fetchPage` en lugar de recuperar las cuentas en línea.

```tsx
const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
const [movies, setMovies] = useState<Movie[]>([]);
const [page, setPage] = useState(1);

useEffect(() => {
    MovieCoordinator.fetchPage(connection, page, 10).then(setMovies);
}, [page, search]);
```

Por último, tenemos que añadir botones en la parte inferior de la lista para navegar a diferentes páginas:

```tsx
return (
    <div>
        {movies.map((movie, i) => (
            <Card key={i} movie={movie} />
        ))}
        <Center>
            <HStack w="full" mt={2} mb={8} ml={4} mr={4}>
                {page > 1 && (
                    <Button onClick={() => setPage(page - 1)}>Previous</Button>
                )}
                <Spacer />
                {MovieCoordinator.accounts.length > page * 2 && (
                    <Button onClick={() => setPage(page + 1)}>Next</Button>
                )}
            </HStack>
        </Center>
    </div>
);
```

En este punto, usted debe ser capaz de ejecutar el proyecto y haga clic entre las páginas!

### 3. Ordenar las reseñas alfabéticamente por título

Si miras las reseñas, es posible que notes que no están en ningún orden específico. Podemos arreglar esto añadiendo de nuevo los datos suficientes en nuestro segmento de datos para ayudarnos a hacer un poco de clasificación. Las diversas propiedades en la memoria intermedia de datos de revisión de películas se exponen como sigue:

-   `initialized` - entero sin signo de 8 bits; 1 byte
-   `rating` - entero sin signo de 8 bits; 1 byte
-   `title` - string; número desconocido de bytes
-   `description` - string; número desconocido de bytes

En base a esto, el desplazamiento que necesitamos proporcionar al segmento de datos a acceder `title` es 2. La longitud, sin embargo, es indeterminada, por lo que podemos proporcionar lo que parece ser una longitud razonable. Me quedaré con 18, ya que cubrirá la longitud de la mayoría de los títulos sin buscar demasiados datos cada vez.

Una vez que hayamos modificado el segmento de datos `getProgramAccounts`, tendremos que ordenar la matriz devuelta. Para hacer esto, necesitamos comparar la parte del búfer de datos a la que realmente corresponde `title`. Los primeros 4 bytes de un campo dinámico en Borsh se utilizan para almacenar la longitud del campo en bytes. Entonces, en cualquier búfer dado `data` que se corta de la manera que discutimos anteriormente, la porción de cadena es `data.slice(4, 4 + data[0])`.

Ahora que hemos pensado en esto, vamos a modificar la implementación de `prefetchAccounts` en `MovieCoordinator` :

```tsx
static async prefetchAccounts(connection: web3.Connection, filters: AccountFilter[]) {
	const accounts = await connection.getProgramAccounts(
		new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
		{
			dataSlice: { offset: 2, length: 18 },
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

Y así, deberías poder ejecutar la aplicación y ver la lista de reseñas de películas ordenadas alfabéticamente.

### 4. Añadir búsqueda

Lo último que haremos para mejorar esta aplicación es añadir alguna capacidad de búsqueda básica. Añadamos un `search` parámetro `prefetchAccounts` y reconfiguremos el cuerpo de la función para usarlo.

Podemos utilizar la `filters` propiedad del `config` parámetro de `getProgramAccounts` para filtrar cuentas por datos específicos. El desplazamiento de `title` los campos es 2, pero los primeros 4 bytes son la longitud del título, por lo que el desplazamiento real de la cadena en sí es 6. Recuerde que los bytes deben estar codificados en base 58, así que vamos a instalar e importar `bs58`.

```tsx
import bs58 from 'bs58'

...

static async prefetchAccounts(connection: web3.Connection, search: string) {
	const accounts = await connection.getProgramAccounts(
		new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
		{
			dataSlice: { offset: 2, length: 18 },
			filters: search === '' ? [] : [
				{
					memcmp:
						{
							offset: 6,
							bytes: bs58.encode(Buffer.from(search))
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

Ahora, añada un `search` parámetro `fetchPage` y actualice su llamada `prefetchAccounts` para transmitirlo. También tendremos que añadir un parámetro `reload` booleano a para que `fetchPage` podamos forzar una actualización de la búsqueda previa de la cuenta cada vez que cambie el valor de búsqueda.

```tsx
static async fetchPage(connection: web3.Connection, page: number, perPage: number, search: string, reload: boolean = false): Promise<Movie[]> {
	if (this.accounts.length === 0 || reload) {
		await this.prefetchAccounts(connection, search)
	}

	const paginatedPublicKeys = this.accounts.slice(
		(page - 1) * perPage,
		page * perPage,
	)

	if (paginatedPublicKeys.length === 0) {
		return []
	}

	const accounts = await connection.getMultipleAccountsInfo(paginatedPublicKeys)

	const movies = accounts.reduce((accum: Movie[], account) => {
		const movie = Movie.deserialize(account?.data)
		if (!movie) {
			return accum
		}

		return [...accum, movie]
	}, [])

	return movies
}
```

Con eso en su lugar, actualicemos el código `MovieList` para llamarlo correctamente.

En primer lugar, añadir `const [search, setSearch] = useState('')` cerca de las otras `useState` llamadas. A continuación, actualice la llamada `useEffect` a `MovieCoordinator.fetchPage` en el para pasar el `search` parámetro y recargar cuando `search!== ''`.

```tsx
const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
const [movies, setMovies] = useState<Movie[]>([]);
const [page, setPage] = useState(1);
const [search, setSearch] = useState("");

useEffect(() => {
    MovieCoordinator.fetchPage(connection, page, 2, search, search !== "").then(
        setMovies,
    );
}, [page, search]);
```

Finalmente, agregue una barra de búsqueda que establecerá el valor de `search` :

```tsx
return (
    <div>
        <Center>
            <Input
                id="search"
                color="gray.400"
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search"
                w="97%"
                mt={2}
                mb={2}
            />
        </Center>
        ...
    </div>
);
```

¡Y eso es todo! La aplicación ahora ha ordenado revisiones, paginación y búsqueda.

Eso era mucho para digerir, pero lo lograste. Si necesita pasar más tiempo con los conceptos, siéntase libre de volver a leer las secciones que fueron más desafiantes para usted y/o echar un vistazo a la[código de solución](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-paging-account-data).

# Desafío

Ahora es tu turno de tratar de hacer esto por tu cuenta. Usando la aplicación Student Intros de la última lección, agregue paginación, ordene alfabéticamente por nombre y busque por nombre.

![Captura de pantalla del frontend de Student Intros](../../assets/student-intros-frontend.png)

1. Puede construir esto desde cero o puede descargar el [código de inicio](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-deserialize-account-data)
2. Agregue paginación al proyecto mediante la obtención previa de cuentas sin datos, luego solo obtenga los datos de la cuenta para cada cuenta cuando sea necesario.
3. Ordene las cuentas que se muestran en la aplicación alfabéticamente por nombre.
4. Agregue la capacidad de buscar a través de las presentaciones por el nombre de un estudiante.

Esto es un desafío. Si te quedas atascado, siéntete libre de hacer referencia al[código de solución](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-paging-account-data). ¡Con esto completas el Módulo 1! ¿Cómo ha sido tu experiencia? ¡Siéntase libre de compartir algunos comentarios rápidos[here](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%201), para que podamos seguir mejorando el curso!

Como siempre, ¡sé creativo con estos desafíos y llévalos más allá de las instrucciones si quieres!

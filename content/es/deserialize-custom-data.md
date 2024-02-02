---
title: Deserializar los objetivos de los datos de la cuenta personalizada
objectives:
- Explicar cuentas derivadas del programa
- Derivar PDAs dadas semillas específicas
- Obtener las cuentas de un programa
- Usar Borsh para deserializar datos personalizados
---

# TL;DR

-   **Direcciones derivadas del programa**, o PDA, son direcciones que no tienen una clave privada correspondiente. El concepto de PDA permite que los programas firmen transacciones por sí mismos y permite almacenar y localizar datos.
-   Puede derivar un PDA usando el `findProgramAddress(seeds, programid)` método.
-   Puede obtener una matriz de todas las cuentas que pertenecen a un programa usando `getProgramAccounts(programId)`.
-   Los datos de la cuenta deben deserializarse utilizando el mismo diseño utilizado para almacenarlos en primer lugar. Se puede utilizar `@coral-xyz/borsh` para crear un esquema.

# Descripción general

En la última lección, serializamos datos de instrucciones personalizadas que posteriormente fueron almacenados en la cadena por un programa Solana. En esta lección, cubriremos con mayor detalle cómo los programas usan las cuentas, cómo recuperarlas y cómo deserializar los datos que almacenan.

## Programas

Como dice el refrán, todo en Solana es una cuenta. Incluso programas. Los programas son cuentas que almacenan código y están marcadas como ejecutables. Este código puede ser ejecutado por el tiempo de ejecución de Solana cuando se le indique que lo haga.

Los programas mismos, sin embargo, son apátridas. No pueden modificar los datos de su cuenta. Solo pueden persistir almacenando datos en otras cuentas a las que se puede hacer referencia en algún otro momento. Comprender cómo se utilizan estas cuentas y cómo encontrarlas es crucial para el desarrollo de Solana del lado del cliente.

### PDA

PDA son las siglas de Program Derived Address. Como su nombre indica, se refiere a una dirección (clave pública) derivada de un programa y algunas semillas. En una lección anterior, discutimos las claves públicas/privadas y cómo se usan en Solana. A diferencia de un par de claves, un PDA _no_ tiene una clave privada correspondiente. El propósito de un PDA es crear una dirección por la que un programa puede firmar de la misma manera que un usuario puede firmar una transacción con su billetera.

Cuando envía una transacción a un programa y espera que el programa actualice el estado o almacene datos de alguna manera, ese programa está utilizando uno o más PDA. Es importante entender esto al desarrollar el lado del cliente por dos razones:

1. Al enviar una transacción a un programa, el cliente debe incluir todas las direcciones de las cuentas que se escribirán o leerán. Esto significa que, a diferencia de las arquitecturas cliente-servidor más tradicionales, el cliente necesita tener un conocimiento específico de la implementación sobre el programa Solana. El cliente necesita saber qué PDA se va a utilizar para almacenar datos para que pueda incluir esa dirección en la transacción.
2. Del mismo modo, al leer datos de un programa, el cliente necesita saber de qué cuenta(s) leer.

### Encontrar PDA

Los PDA no se crean técnicamente. Más bien, son _encontrado_ o se _derivado_ basan en una o más semillas de entrada.

Los pares de teclas regulares de Solana se encuentran en la curva elíptica Ed25519. Esta función criptográfica garantiza que cada punto a lo largo de la curva tenga un punto correspondiente en otro lugar de la curva, lo que permite claves públicas/privadas. Los PDA son direcciones que se encuentran _apagado_ en la curva elíptica Ed25519 y, por lo tanto, no pueden firmarse con una clave privada (ya que no hay una). Esto asegura que el programa es el único firmante válido para esa dirección.

Para encontrar una clave pública que no se encuentre en la curva Ed25519, el ID del programa y las semillas de la elección del desarrollador (como una cadena de texto) se pasan a través de la función [ `findProgramAddress(seeds, programid)`](https://solana-labs.github.io/solana-web3.js/classes/PublicKey.html#findProgramAddress). Esta función combina el ID del programa, las semillas y una semilla de bache en un búfer y lo pasa a un hash SHA256 para ver si la dirección resultante está o no en la curva. Si la dirección está en la curva (~50% de probabilidad de que lo esté), entonces la semilla de la protuberancia se decrementa en 1 y la dirección se calcula de nuevo. La semilla de protuberancia comienza en 255 y progresivamente itera hasta `bump = 254`, `bump = 253`, etc. hasta que se encuentra una dirección con las semillas dadas y la protuberancia que no se encuentra en la curva Ed25519. La `findProgramAddress` función devuelve la dirección resultante y el bache utilizado para sacarla de la curva. De esta manera, la dirección se puede generar en cualquier lugar, siempre y cuando tenga el bache y las semillas.

![Captura de pantalla de la curva Ed25519](../../assets/movie-review-program.svg)

Los PDA son un concepto único y son una de las partes más difíciles de entender del desarrollo de Solana. Si no lo entiendes enseguida, no te preocupes. Tendrá más sentido cuanto más practiques.

### ¿Por qué es importante?

La derivación de los PDA es importante porque las semillas utilizadas para encontrar un PDA son las que utilizamos para localizar los datos. Por ejemplo, un programa simple que solo usa un solo PDA para almacenar el estado del programa global podría usar una frase semilla simple como "GLOBAL_STATE". Si el cliente quisiera leer datos de este PDA, podría derivar la dirección usando el ID de programa y esta misma semilla.

```tsx
const [pda, bump] = await findProgramAddress(
    Buffer.from("GLOBAL_STATE"),
    programId,
);
```

En los programas más complejos que almacenan datos específicos del usuario, es común usar la clave pública de un usuario como semilla. Esto separa los datos de cada usuario en su propio PDA. La separación hace posible que el cliente localice los datos de cada usuario encontrando la dirección usando el ID de programa y la clave pública del usuario.

```tsx
const [pda, bump] = await web3.PublicKey.findProgramAddress(
    [publicKey.toBuffer()],
    programId,
);
```

Además, cuando hay múltiples cuentas por usuario, un programa puede usar una o más semillas adicionales para crear e identificar cuentas. Por ejemplo, en una aplicación de toma de notas puede haber una cuenta por nota donde cada PDA se deriva con la clave pública del usuario y el título de la nota.

```tsx
const [pda, bump] = await web3.PublicKey.findProgramAddress(
    [publicKey.toBuffer(), Buffer.from("First Note")],
    programId,
);
```

### Obtener varias cuentas de programa

Además de derivar direcciones, puede obtener todas las cuentas creadas por un programa utilizando `connection.getProgramAccounts(programId)`. Esto devuelve una matriz de objetos donde cada objeto tiene una `pubkey` propiedad que representa la clave pública de la cuenta y una `account` propiedad de tipo `AccountInfo`. Puede usar la `account` propiedad para obtener los datos de la cuenta.

```tsx
const accounts = connection.getProgramAccounts(programId).then((accounts) => {
    accounts.map(({ pubkey, account }) => {
        console.log("Account:", pubkey);
        console.log("Data buffer:", account.data);
    });
});
```

## Deserialización de datos de cuenta personalizados

La `data` propiedad de un `AccountInfo` objeto es un buffer. Para usarlo de manera eficiente, deberá escribir código que lo deserialice en algo más utilizable. Esto es similar al proceso de serialización que cubrimos la última lección. Al igual que antes, vamos a utilizar [Borsh](https://borsh.io/) y `@coral-xyz/borsh`. Si necesita un repaso de cualquiera de estos, eche un vistazo a la lección anterior.

La deserialización requiere el conocimiento del diseño de la cuenta antes de tiempo. Al crear sus propios programas, definirá cómo se hace esto como parte de ese proceso. Muchos programas también tienen documentación sobre cómo deserializar los datos de la cuenta. De lo contrario, si el código del programa está disponible, puede mirar la fuente y determinar la estructura de esa manera.

Para deserializar correctamente los datos de un programa en cadena, tendrá que crear un esquema del lado del cliente que refleje cómo se almacenan los datos en la cuenta. Por ejemplo, lo siguiente podría ser el esquema para una cuenta que almacena metadatos sobre un jugador en un juego en cadena.

```tsx
import * as borsh from "@coral-xyz/borsh";

borshAccountSchema = borsh.struct([
    borsh.bool("initialized"),
    borsh.u16("playerId"),
    borsh.str("name"),
]);
```

Una vez que haya definido su diseño, simplemente llame `.decode(buffer)` al esquema.

```tsx
import * as borsh from "@coral-xyz/borsh";

borshAccountSchema = borsh.struct([
    borsh.bool("initialized"),
    borsh.u16("playerId"),
    borsh.str("name"),
]);

const { playerId, name } = borshAccountSchema.decode(buffer);
```

# Demostración

Practiquemos esto juntos al continuar trabajando en la aplicación Movie Review de la última lección. No se preocupe si solo está saltando a esta lección: debería ser posible seguir de cualquier manera.

Como actualización, este proyecto utiliza un programa de Solana implementado en Devnet que permite a los usuarios revisar películas. En la última lección, agregamos funcionalidad al esqueleto del frontend que permite a los usuarios enviar reseñas de películas, pero la lista de reseñas aún muestra datos simulados. Vamos a arreglar eso buscando las cuentas de almacenamiento del programa y deserializando los datos almacenados allí.

![Captura de pantalla del frontend de revisión de películas](../../assets/movie-reviews-frontend.png)

### 1. Descarga el código de inicio

Si no completaste la demostración de la última lección o simplemente quieres asegurarte de que no te perdiste nada, puedes descargar la[código de inicio](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-serialize-instruction-data).

El proyecto es una aplicación Next.js bastante simple. Incluye el `WalletContextProvider` que creamos en la lección Wallets, un `Card` componente para mostrar una reseña de película, un `MovieList` componente que muestra reseñas en una lista, un `Form` componente para enviar una nueva reseña y un `Movie.ts` archivo que contiene una definición de clase para un `Movie` objeto.

Tenga en cuenta que cuando se ejecuta `npm run dev`, las revisiones que se muestran en la página son burlas. Los cambiaremos por el de verdad.

### 2. Crear el diseño del búfer

Recuerde que para interactuar correctamente con un programa de Solana, necesita saber cómo se estructuran sus datos.

El programa de revisión de películas crea una cuenta separada para cada revisión de películas y almacena los siguientes datos en la cuenta `data` :

1.  `initialized` como un booleano que representa si la cuenta se ha inicializado o no.
2.  `rating` como un número entero de 8 bits sin signo que representa la calificación de 5 que el revisor le dio a la película.
3.  `title` como una cadena que representa el título de la película reseñada.
4.  `description` como una cadena que representa la parte escrita de la revisión.

Configuremos un `borsh` diseño en la `Movie` clase para representar el diseño de datos de la cuenta de la película. Comience por importar `@coral-xyz/borsh`. A continuación, cree una propiedad `borshAccountSchema` estática y configúrela en la `borsh` estructura apropiada que contenga las propiedades enumeradas anteriormente.

```tsx
import * as borsh from '@coral-xyz/borsh'

export class Movie {
	title: string;
	rating: number;
	description: string;

	...

	static borshAccountSchema = borsh.struct([
		borsh.bool('initialized'),
		borsh.u8('rating'),
		borsh.str('title'),
		borsh.str('description'),
	])
}
```

Recuerde, el orden aquí*asuntos*. Debe coincidir con la estructura de los datos de la cuenta.

### 3. Crear un método para deserializar datos

Ahora que tenemos el diseño del búfer configurado, vamos a crear un método estático en `Movie` llamado `deserialize` que tomará un opcional `Buffer` y devolverá un `Movie` objeto o `null`.

```tsx
import * as borsh from '@coral-xyz/borsh'

export class Movie {
	title: string;
	rating: number;
	description: string;

	...

	static borshAccountSchema = borsh.struct([
		borsh.bool('initialized'),
		borsh.u8('rating'),
		borsh.str('title'),
		borsh.str('description'),
	])

	static deserialize(buffer?: Buffer): Movie|null {
		if (!buffer) {
			return null
		}

		try {
			const { title, rating, description } = this.borshAccountSchema.decode(buffer)
			return new Movie(title, rating, description)
		} catch(error) {
			console.log('Deserialization error:', error)
			return null
		}
	}
}
```

El método primero comprueba si existe o no el búfer y devuelve `null` si no existe. A continuación, utiliza el diseño que creamos para decodificar el búfer y, a continuación, utiliza los datos para construir y devolver una instancia de `Movie`. Si la decodificación falla, el método registra el error y vuelve `null`.

### 4. Obtener cuentas de reseñas de películas

Ahora que tenemos una forma de deserializar los datos de las cuentas, necesitamos recuperar las cuentas. Abra `MovieList.tsx` e importe `@solana/web3.js`. Luego, cree un nuevo `Connection` dentro del `MovieList` componente. Finalmente, reemplace la línea `setMovies(Movie.mocks)` interior `useEffect` con una llamada a `connection.getProgramAccounts`. Tome la matriz resultante y conviértala en una matriz de películas y llamadas `setMovies`.

```tsx
import { Card } from "./Card";
import { FC, useEffect, useState } from "react";
import { Movie } from "../models/Movie";
import * as web3 from "@solana/web3.js";

const MOVIE_REVIEW_PROGRAM_ID = "CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN";

export const MovieList: FC = () => {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    const [movies, setMovies] = useState<Movie[]>([]);

    useEffect(() => {
        connection
            .getProgramAccounts(new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID))
            .then(async (accounts) => {
                const movies: Movie[] = accounts.map(({ account }) => {
                    return Movie.deserialize(account.data);
                });

                setMovies(movies);
            });
    }, []);

    return (
        <div>
            {movies.map((movie, i) => (
                <Card key={i} movie={movie} />
            ))}
        </div>
    );
};
```

En este punto, debería poder ejecutar la aplicación y ver la lista de reseñas de películas recuperadas del programa.

Dependiendo de cuántas revisiones se hayan enviado, esto puede tardar mucho tiempo en cargarse o puede bloquear su navegador por completo. Pero no se preocupe: la próxima lección aprenderemos a buscar y filtrar cuentas para que pueda ser más quirúrgico con lo que carga.

Si necesita más tiempo con este proyecto para sentirse cómodo con estos conceptos, eche un vistazo a la [código de solución](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-deserialize-account-data) antes de continuar.

# Desafío

Ahora es tu turno de construir algo de forma independiente. En la última lección, trabajó en la aplicación Student Intros para serializar los datos de instrucción y enviar una nueva introducción a la red. Ahora, es el momento de buscar y deserializar los datos de la cuenta del programa. Recuerde, el programa Solana que apoya esto es en `HdE95RSVsdb315jfJtaykXhXY478h53X6okDupVfY9yf`.

![Captura de pantalla del frontend de Student Intros](../../assets/student-intros-frontend.png)

1. Puede construir esto desde cero o puede descargar el código de inicio[here](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data).
2. Cree el diseño del búfer de la cuenta en `StudentIntro.ts`. Los datos de la cuenta contienen:
    1. `initialized` como un entero sin signo de 8 bits que representa la instrucción a ejecutar (debería ser 1).
    2. `name` como una cadena que representa el nombre del estudiante.
    3. `message` como una cadena que representa el mensaje que el estudiante compartió sobre su viaje de Solana.
3. Cree un método estático en el `StudentIntro.ts` que usará el diseño del búfer para deserializar un búfer de datos de cuenta en un `StudentIntro` objeto.
4. En los `StudentIntroList` componentes `useEffect`, obtenga las cuentas del programa y deserialice sus datos en una lista de `StudentIntro` objetos.
5. En lugar de datos simulados, ¡ahora debería ver las presentaciones de los estudiantes de la red!

Si se queda realmente perplejo, no dude en consultar el código de la solución[here](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-deserialize-account-data).

Como siempre, ¡sé creativo con estos desafíos y llévalos más allá de las instrucciones si quieres!

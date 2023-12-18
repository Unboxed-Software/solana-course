---
title: PDAS
objectives:
- Explicar las direcciones derivadas del programa (PDA)
- Explicar varios casos de uso de PDA
- Describir cómo se derivan los PDA
- Utilice las derivaciones de PDA para localizar y recuperar datos
---


# TL;DR

- A **Dirección derivada del programa** (PDA) se deriva de a **iD del programa** y una lista opcional de **semillas**
- Los PDA son propiedad y están controlados por el programa del que se derivan.
- La derivación de PDA proporciona una forma determinista de encontrar datos basados en las semillas utilizadas para la derivación
- Las semillas se pueden usar para asignar a los datos almacenados en una cuenta PDA separada
- Un programa puede firmar instrucciones en nombre de los PDA derivados de su ID

# Descripción general

## ¿Qué es una dirección derivada del programa?

Las direcciones derivadas del programa (PDA) son direcciones de cuenta diseñadas para ser firmadas por un programa en lugar de una clave secreta. Como su nombre indica, los PDA se derivan utilizando un ID de programa. Opcionalmente, estas cuentas derivadas también se pueden encontrar usando el ID junto con un conjunto de "semillas". Más sobre esto más adelante, pero estas semillas jugarán un papel importante en la forma en que usamos los PDA para el almacenamiento y la recuperación de datos.

Los PDA cumplen dos funciones principales:

1. Proporcionar una forma determinista de encontrar la dirección de una cuenta propiedad del programa
2. Autorizar al programa del que se deriva un PDA a firmar en su nombre de la misma manera que un usuario puede firmar con su clave privada

En esta lección nos centraremos en el uso de PDA para encontrar y almacenar datos. Discutiremos la firma con un PDA más a fondo en una lección futura donde cubriremos las Invocaciones de Programas Cruzados (CPI).

## Encontrar PDA

Los PDA no se crean técnicamente. Más bien, están *encontrado* o se *derivado* basan en un ID de programa y una o más semillas de entrada.

Los pares de teclas Solana se pueden encontrar en lo que se llama la curva elíptica Ed25519 (Ed25519). Ed25519 es un esquema de firma determinista que Solana utiliza para generar claves públicas y privadas correspondientes. Juntos, llamamos a estos pares de claves.

Alternativamente, los PDA son direcciones que se encuentran *apagado* en la curva Ed25519. Esto significa efectivamente que son claves públicas y *sin* una clave privada correspondiente. Esta propiedad de los PDA es esencial para que los programas puedan firmar en su nombre, pero lo cubriremos en una lección futura.

Para encontrar un PDA dentro de un programa de Solana, usaremos la `find_program_address` función. Esta función toma una lista opcional de "semillas" y un ID de programa como entradas, y luego devuelve el PDA y una semilla de bache.


```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[user.key.as_ref(), user_input.as_bytes().as_ref(), "SEED".as_bytes()], program_id)
```

### Semillas

"Semillas" son entradas opcionales utilizadas en la `find_program_address` función para derivar un PDA. Por ejemplo, las semillas pueden ser cualquier combinación de claves públicas, entradas proporcionadas por un usuario o valores codificados. Un PDA también se puede derivar usando solo el ID del programa y sin semillas adicionales. El uso de semillas para encontrar nuestros PDA, sin embargo, nos permite crear un número arbitrario de cuentas que nuestro programa puede poseer.

Mientras que usted, el desarrollador, determina las semillas para pasar a la `find_program_address` función, la función en sí proporciona una semilla adicional llamada "semilla de golpe". La función criptográfica para derivar un PDA da como resultado una clave que se encuentra en *en* la curva Ed25519 aproximadamente el 50% del tiempo. Para garantizar que el resultado *no es* en la curva Ed25519 y, por lo tanto, no tenga una clave privada, la `find_program_address` función agrega una semilla numérica llamada semilla de bump.

La función comienza usando el valor `255` como la semilla de bump, luego comprueba si la salida es un PDA válido. Si el resultado no es un PDA válido, la función disminuye la semilla de protuberancia en 1 e intenta de nuevo ( `255` `254`, `253`,, etcétera). Una vez que se encuentra un PDA válido, la función devuelve tanto el PDA como el bache que se utilizó para derivar el PDA.

### Bajo el capó de `find_program_address`

Echemos un vistazo al código fuente `find_program_address`.


```rust
 pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Self::try_find_program_address(seeds, program_id)
        .unwrap_or_else(|| panic!("Unable to find a viable program address bump seed"))
}
```

Debajo del capó, la `find_program_address` función pasa la entrada `seeds` y `program_id` a la `try_find_program_address` función.

La `try_find_program_address` función introduce entonces el `bump_seed`. La `bump_seed` es una `u8` variable con un valor que oscila entre 0 y 255. Iterando en un intervalo descendente que comienza desde 255, a `bump_seed` se añade a las semillas de entrada opcionales que luego se pasan a la `create_program_address` función. Si la salida de no `create_program_address` es un PDA válido, entonces `bump_seed` se disminuye en 1 y el bucle continúa hasta que se encuentra un PDA válido.


```rust
pub fn try_find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> Option<(Pubkey, u8)> {

    let mut bump_seed = [std::u8::MAX];
    for _ in 0..std::u8::MAX {
        {
            let mut seeds_with_bump = seeds.to_vec();
            seeds_with_bump.push(&bump_seed);
            match Self::create_program_address(&seeds_with_bump, program_id) {
                Ok(address) => return Some((address, bump_seed[0])),
                Err(PubkeyError::InvalidSeeds) => (),
                _ => break,
            }
        }
        bump_seed[0] -= 1;
    }
    None

}
```

La `create_program_address` función realiza un conjunto de operaciones hash sobre las semillas y `program_id`. Estas operaciones calculan una clave, luego verifican si la clave calculada se encuentra en la curva elíptica Ed25519 o no. Si se encuentra un PDA válido (es decir, una dirección que es *apagado* la curva), entonces se devuelve el PDA. De lo contrario, se devuelve un error.


```rust
pub fn create_program_address(
    seeds: &[&[u8]],
    program_id: &Pubkey,
) -> Result<Pubkey, PubkeyError> {

    let mut hasher = crate::hash::Hasher::default();
    for seed in seeds.iter() {
        hasher.hash(seed);
    }
    hasher.hashv(&[program_id.as_ref(), PDA_MARKER]);
    let hash = hasher.result();

    if bytes_are_curve_point(hash) {
        return Err(PubkeyError::InvalidSeeds);
    }

    Ok(Pubkey::new(hash.as_ref()))

}
```

En resumen, la `find_program_address` función pasa nuestras semillas de entrada y `program_id` a la `try_find_program_address` función. La `try_find_program_address` función añade a `bump_seed` (a partir de 255) a nuestras semillas de entrada, luego llama a la `create_program_address` función hasta que se encuentre un PDA válido. Una vez encontrado, se `bump_seed` devuelven tanto el PDA como el.

Tenga en cuenta que para las mismas semillas de entrada, diferentes protuberancias válidas generarán diferentes PDA válidos. El `bump_seed` devuelto por siempre `find_program_address` será el primer PDA válido encontrado. Debido a que la función comienza con un `bump_seed` valor de 255 e itera hacia abajo a cero, el `bump_seed` que finalmente se devuelve siempre será el mayor valor válido de 8 bits posible. Esto `bump_seed` se conoce comúnmente como el "*protuberancia canónica* ". Para evitar confusiones, se recomienda usar solo la protuberancia canónica y *siempre valide cada PDA que pase a su programa.*

Un punto a enfatizar es que la `find_program_address` función solo devuelve una dirección derivada del programa y la semilla de bump utilizada para derivarla. La `find_program_address` función no *no* inicializa una nueva cuenta, ni ningún PDA devuelto por la función está necesariamente asociado con una cuenta que almacena datos.

## Usar cuentas PDA para almacenar datos

Dado que los propios programas son apátridas, el estado del programa se gestiona a través de cuentas externas. Dado que puede usar semillas para mapear y que los programas pueden firmar en su nombre, usar cuentas PDA para almacenar datos relacionados con el programa es una opción de diseño extremadamente común. Si bien los programas pueden invocar el programa del sistema para crear cuentas que no sean de PDA y usarlas para almacenar datos, los PDA tienden a ser el camino a seguir.

Si necesita un repaso sobre cómo almacenar datos en PDA, eche un vistazo a la[Crear un Programa Básico, Parte 2 - Lección de Gestión Estatal](./program-state-management).

## Asignar a datos almacenados en cuentas PDA

Almacenar datos en cuentas PDA es solo la mitad de la ecuación. También necesita una forma de recuperar esos datos. Hablaremos de dos enfoques:

1. Creación de una cuenta de "mapa" PDA que almacena las direcciones de varias cuentas donde se almacenan los datos
2. Utilizar estratégicamente las semillas para localizar las cuentas PDA apropiadas y recuperar los datos necesarios

### Asignar a datos usando cuentas de "mapa" de PDA

Un enfoque para organizar el almacenamiento de datos es almacenar grupos de datos relevantes en sus propios PDA y luego tener una cuenta PDA separada que almacene un mapeo de dónde están todos los datos.

Por ejemplo, es posible que tenga una aplicación para tomar notas cuyo programa de respaldo utiliza semillas aleatorias para generar cuentas PDA y almacena una nota en cada cuenta. El programa también tendría una sola cuenta de "mapa" de PDA global que almacena un mapeo de las claves públicas de los usuarios a la lista de PDA donde se almacenan sus notas. Esta cuenta Map se obtendría utilizando una semilla estática, por ejemplo, "GLOBAL_MAPPING".

Cuando llegue el momento de recuperar las notas de un usuario, puede mirar la cuenta de mapa, ver la lista de direcciones asociadas con la clave pública de un usuario y luego recuperar la cuenta para cada una de esas direcciones.

Si bien tal solución es quizás más accesible para los desarrolladores web tradicionales, viene con algunos inconvenientes que son particulares del desarrollo de web3. Dado que el tamaño de la asignación almacenada en la cuenta de mapa crecerá con el tiempo, tendrá que asignar más tamaño del necesario a la cuenta cuando la cree por primera vez, o tendrá que reasignar espacio para ella cada vez que se cree una nueva nota. Además de eso, eventualmente alcanzará el límite de tamaño de cuenta de 10 megabytes.

Puede mitigar este problema hasta cierto punto creando una cuenta de mapa separada para cada usuario. Por ejemplo, en lugar de tener una sola cuenta de mapa PDA para todo el programa, construiría una cuenta de mapa PDA por usuario. Cada una de estas cuentas de mapa podría derivarse con la clave pública del usuario. Las direcciones para cada nota podrían almacenarse dentro de la cuenta de mapa del usuario correspondiente.

Este enfoque reduce el tamaño requerido para cada cuenta Map, pero en última instancia sigue añadiendo un requisito innecesario al proceso: tener que leer la información en la cuenta Map para *antes* poder encontrar las cuentas con los datos relevantes de la nota.

Puede haber momentos en que el uso de este enfoque tenga sentido para su aplicación, pero no lo recomendamos como su estrategia de "ir a".

### Asignar a los datos utilizando la derivación de PDA

Si eres estratégico sobre las semillas que usas para derivar PDA, puedes incrustar las asignaciones requeridas en las semillas mismas. Esta es la evolución natural del ejemplo de la aplicación para tomar notas que acabamos de discutir. Si comienza a usar la clave pública del creador de la nota como semilla para crear una cuenta de mapa por usuario, entonces ¿por qué no usar tanto la clave pública del creador como alguna otra información conocida para derivar un PDA para la nota en sí?

Ahora, sin hablar de ello explícitamente, hemos estado asignando semillas a las cuentas de todo este curso. Piense en el programa de revisión de películas que hemos construido en lecciones anteriores. Este programa utiliza la clave pública de un creador de reseñas y el título de la película que está revisando para encontrar la dirección que se *debería* utilizará para almacenar la reseña. Este enfoque permite al programa crear una dirección única para cada nueva revisión, al tiempo que facilita la localización de una revisión cuando sea necesario. Cuando desea encontrar la revisión de un usuario de "Spiderman", sabe que se almacena en la cuenta PDA cuya dirección se puede derivar utilizando la clave pública del usuario y el texto "Spiderman" como semillas.


```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[
        initializer.key.as_ref(),
        title.as_bytes().as_ref()
    ],
    program_id)
```

### Direcciones de cuenta de token asociadas

Otro ejemplo práctico de este tipo de mapeo es cómo se determinan las direcciones de cuentas de token asociadas (ata). Los tokens a menudo se mantienen en un ata cuya dirección se obtuvo utilizando una dirección de billetera y la dirección Mint de un token específico. La dirección para un ata se encuentra usando la `get_associated_token_address` función que toma un `wallet_address` y `token_mint_address` como entradas.


```rust
let associated_token_address = get_associated_token_address(&wallet_address, &token_mint_address);
```

Bajo el capó, la dirección del token asociado es un PDA encontrado usando el `wallet_address`, `token_program_id`, y `token_mint_address` como semillas. Esto proporciona una forma determinista de encontrar una cuenta de token asociada con cualquier dirección de billetera para una moneda de token específica.


```rust
fn get_associated_token_address_and_bump_seed_internal(
    wallet_address: &Pubkey,
    token_mint_address: &Pubkey,
    program_id: &Pubkey,
    token_program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            &wallet_address.to_bytes(),
            &token_program_id.to_bytes(),
            &token_mint_address.to_bytes(),
        ],
        program_id,
    )
}
```

Las asignaciones entre las semillas y las cuentas PDA que utilice dependerán en gran medida de su programa específico. Si bien esta no es una lección sobre el diseño o la arquitectura del sistema, vale la pena mencionar algunas pautas:

- Usar semillas que se conocerán en el momento de la derivación de PDA
- Tenga en cuenta qué datos se agrupan en una sola cuenta
- Sea reflexivo sobre la estructura de datos utilizada dentro de cada cuenta
- Por lo general, más simple es mejor

# Demostración

Practiquemos junto con el programa Movie Review en el que hemos trabajado en lecciones anteriores. No se preocupe si solo está saltando a esta lección sin haber hecho la lección anterior: debería ser posible seguir cualquier camino.

Como actualización, el programa Movie Review permite a los usuarios crear reseñas de películas. Estas revisiones se almacenan en una cuenta utilizando un PDA derivado con la clave pública del inicializador y el título de la película que están revisando.

Anteriormente, terminamos de implementar la capacidad de actualizar una revisión de película de manera segura. En esta demostración, agregaremos la posibilidad de que los usuarios comenten una reseña de una película. Utilizaremos la creación de esta función como una oportunidad para trabajar en cómo estructurar el almacenamiento de comentarios utilizando cuentas PDA.

### 1. Obtener el código de inicio

Para empezar, puede encontrar el código de inicio [here](https://github.com/Unboxed-Software/solana-movie-program/tree/starter) en la `starter` rama.

Si has estado siguiendo junto con las demostraciones de Movie Review, notarás que este es el programa que hemos desarrollado hasta ahora. Anteriormente, solíamos [Parque infantil Solana](https://beta.solpg.io/) escribir, construir e implementar nuestro código. En esta lección, construiremos e implementaremos el programa localmente.

Abra la carpeta y, a continuación, ejecute `cargo-build-bpf` para crear el programa. El `cargo-build-bpf` comando emitirá instrucciones para desplegar el programa.


```sh
cargo-build-bpf
```

Implemente el programa copiando la salida `cargo-build-bpf` y ejecutando el `solana program deploy` comando.


```sh
solana program deploy <PATH>
```

Puede probar el programa utilizando la revisión de la película [frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews) y actualizando el ID del programa con el que acaba de implementar. Asegúrate de usar la `solution-update-reviews` rama.

### 2. Planificar la estructura de la cuenta

Agregar comentarios significa que debemos tomar algunas decisiones sobre cómo almacenar los datos asociados con cada comentario. Los criterios para una buena estructura aquí son:

- No demasiado complicado
- Los datos son fácilmente recuperables
- Cada comentario tiene algo para vincularlo a la revisión con la que está asociado.

Para ello, crearemos dos nuevos tipos de cuenta:

- Cuenta de contador de comentarios
- Cuenta de comentarios

Habrá una cuenta de contador de comentarios por revisión y una cuenta de comentarios por comentario. La cuenta del contador de comentarios se vinculará a una revisión determinada mediante el uso de la dirección de una revisión como semilla para encontrar el contador de comentarios PDA. También usará la cadena estática "comment" como semilla.

La cuenta de comentarios se vinculará a una revisión de la misma manera. Sin embargo, no incluirá la cadena de "comentario" como una semilla y en su lugar usará la *recuento real de comentarios* como una semilla. De esta manera, el cliente puede recuperar fácilmente los comentarios para una revisión determinada haciendo lo siguiente:

1. Lea los datos en la cuenta del contador de comentarios para determinar el número de comentarios en una revisión.
2. ¿Dónde `n` está el número total de comentarios en la revisión, `n` tiempos de bucle. Cada iteración del bucle derivará un PDA usando la dirección de revisión y el número actual como semillas. El resultado es `n` el número de PDA, cada una de las cuales es la dirección de una cuenta que almacena un comentario.
3. Obtenga las cuentas de cada uno de los `n` PDA y lea los datos almacenados en cada uno.

Esto garantiza que cada una de nuestras cuentas se pueda recuperar de manera determinista utilizando datos que ya se conocen de antemano.

Para implementar estos cambios, tendremos que hacer lo siguiente:

- Definir estructuras para representar el contador de comentarios y las cuentas de comentarios
- Actualizar el existente `MovieAccountState` para contener un discriminador (más sobre esto más adelante)
- Añadir una variante de instrucción para representar la `add_comment` instrucción
- Actualizar la función de procesamiento de `add_movie_review` instrucciones existente para incluir la creación de la cuenta del contador de comentarios
- Crear una nueva función `add_comment` de procesamiento de instrucciones

### 3. Definir `MovieCommentCounter` y `MovieComment` estructuras

Recuerde que el `state.rs` archivo define las estructuras que nuestro programa utiliza para rellenar el campo de datos de una nueva cuenta.

Tendremos que definir dos nuevas estructuras para habilitar los comentarios.

1.  `MovieCommentCounter` - para almacenar un contador para el número de comentarios asociados con una revisión
2.  `MovieComment` - para almacenar datos asociados con cada comentario

Para empezar, vamos a definir las estructuras que vamos a utilizar para nuestro programa. Tenga en cuenta que estamos añadiendo un `discriminator` campo a cada estructura, incluyendo la existente `MovieAccountState`. Dado que ahora tenemos varios tipos de cuenta, necesitamos una forma de obtener solo el tipo de cuenta que necesitamos del cliente. Este discriminador es una cadena que se puede usar para filtrar cuentas cuando obtenemos nuestras cuentas de programa.


```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub discriminator: String,
    pub is_initialized: bool,
    pub reviewer: Pubkey,
    pub rating: u8,
    pub title: String,
    pub description: String,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieCommentCounter {
    pub discriminator: String,
    pub is_initialized: bool,
    pub counter: u64
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieComment {
    pub discriminator: String,
    pub is_initialized: bool,
    pub review: Pubkey,
    pub commenter: Pubkey,
    pub comment: String,
    pub count: u64
}

impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieCommentCounter {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieComment {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Dado que hemos agregado un nuevo `discriminator` campo a nuestra estructura existente, el cálculo del tamaño de la cuenta debe cambiar. Usemos esto como una oportunidad para limpiar un poco nuestro código. Agregaremos una implementación para cada una de las tres estructuras anteriores que agrega una constante `DISCRIMINATOR` y una constante `SIZE` o una función `get_account_size` para que podamos obtener rápidamente el tamaño necesario al inicializar una cuenta.


```rust
impl MovieAccountState {
    pub const DISCRIMINATOR: &'static str = "review";

    pub fn get_account_size(title: String, description: String) -> usize {
        return (4 + MovieAccountState::DISCRIMINATOR.len())
            + 1
            + 1
            + (4 + title.len())
            + (4 + description.len());
    }
}

impl MovieCommentCounter {
    pub const DISCRIMINATOR: &'static str = "counter";
    pub const SIZE: usize = (4 + MovieCommentCounter::DISCRIMINATOR.len()) + 1 + 8;
}

impl MovieComment {
    pub const DISCRIMINATOR: &'static str = "comment";

    pub fn get_account_size(comment: String) -> usize {
        return (4 + MovieComment::DISCRIMINATOR.len()) + 1 + 32 + 32 + (4 + comment.len()) + 8;
    }
}
```

Ahora, en todas partes donde necesitamos el discriminador o el tamaño de la cuenta, podemos usar esta implementación y no arriesgarnos a errores tipográficos involuntarios.

### 4. Crear `AddComment` instrucción

Recuerde que el `instruction.rs` archivo define las instrucciones que nuestro programa aceptará y cómo deserializar los datos para cada uno. Necesitamos añadir una nueva variante de instrucción para añadir comentarios. Comencemos añadiendo una nueva variante `AddComment` al `MovieInstruction` enum.


```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    AddComment {
        comment: String
    }
}
```

A continuación, vamos a crear una `CommentPayload` estructura para representar los datos de instrucción asociados con esta nueva instrucción. La mayoría de los datos que incluiremos en la cuenta son claves públicas asociadas con las cuentas pasadas al programa, por lo que lo único que realmente necesitamos aquí es un solo campo para representar el texto del comentario.


```rust
#[derive(BorshDeserialize)]
struct CommentPayload {
    comment: String
}
```

Ahora vamos a actualizar la forma en que desempaquetamos los datos de instrucción. Observe que hemos movido la deserialización de los datos de instrucción a cada caso coincidente utilizando la estructura de carga útil asociada para cada instrucción.


```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description }
            },
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description
                }
            },
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment
                }
            }
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

Por último, actualicemos la `process_instruction` función `processor.rs` para usar la nueva variante de instrucción que hemos creado.

En `processor.rs`, traiga en el alcance las nuevas estructuras de `state.rs`.


```rust
use crate::state::{MovieAccountState, MovieCommentCounter, MovieComment};
```

Entonces emparejemos `process_instruction` nuestros datos de `AddComment` instrucción deserializados con la `add_comment` función que implementaremos en breve.


```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            update_movie_review(program_id, accounts, title, rating, description)
        },

        MovieInstruction::AddComment { comment } => {
            add_comment(program_id, accounts, comment)
        }
    }
}
```

### 5. Actualizar `add_movie_review` para crear una cuenta de contador de comentarios

Antes de implementar la `add_comment` función, necesitamos actualizar la `add_movie_review` función para crear la cuenta de contador de comentarios de la revisión.

Recuerde que esta cuenta realizará un seguimiento del número total de comentarios que existen para una revisión asociada. Su dirección será un PDA derivado utilizando la dirección de revisión de la película y la palabra "comentario" como semillas. Tenga en cuenta que la forma en que almacenamos el mostrador es simplemente una elección de diseño. También podríamos añadir un campo "contador" a la cuenta de revisión de la película original.

Dentro de la `add_movie_review` función, agreguemos una `pda_counter` para representar la nueva cuenta de contador que iniciaremos junto con la cuenta de revisión de películas. Esto significa que ahora esperamos que cuatro cuentas pasen a la  `add_movie_review` función a través del `accounts` argumento.


```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

A continuación, hay una verificación para asegurarse de que `total_len` sea inferior a 1000 bytes, pero ya no `total_len` es precisa desde que agregamos el discriminador. Reemplacemos `total_len` con una llamada a `MovieAccountState::get_account_size` :


```rust
let account_len: usize = 1000;

if MovieAccountState::get_account_size(title.clone(), description.clone()) > account_len {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into());
}
```

Tenga en cuenta que esto también debe actualizarse en la `update_movie_review` función para que esa instrucción funcione correctamente.

Una vez que hayamos inicializado la cuenta de revisión, también tendremos que actualizar la `account_data` con los nuevos campos que especificamos en la `MovieAccountState` estructura.


```rust
account_data.discriminator = MovieAccountState::DISCRIMINATOR.to_string();
account_data.reviewer = *initializer.key;
account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Por último, vamos a añadir la lógica para inicializar la cuenta de contador dentro de la `add_movie_review` función. Esto significa:

1. Cálculo del importe de la exención de alquiler para la cuenta de contador
2. Derivar el contador PDA usando la dirección de revisión y la cadena "comment" como semillas
3. Invocar el programa del sistema para crear la cuenta
4. Establecer el valor inicial del contador
5. Serialice los datos de la cuenta y regrese de la función

Todo esto debe añadirse al final de la `add_movie_review` función antes de la `Ok(())`.


```rust
msg!("create comment counter");
let rent = Rent::get()?;
let counter_rent_lamports = rent.minimum_balance(MovieCommentCounter::SIZE);

let (counter, counter_bump) =
    Pubkey::find_program_address(&[pda.as_ref(), "comment".as_ref()], program_id);
if counter != *pda_counter.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument);
}

invoke_signed(
    &system_instruction::create_account(
        initializer.key,
        pda_counter.key,
        counter_rent_lamports,
        MovieCommentCounter::SIZE.try_into().unwrap(),
        program_id,
    ),
    &[
        initializer.clone(),
        pda_counter.clone(),
        system_program.clone(),
    ],
    &[&[pda.as_ref(), "comment".as_ref(), &[counter_bump]]],
)?;
msg!("comment counter created");

let mut counter_data =
    try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

msg!("checking if counter account is already initialized");
if counter_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}

counter_data.discriminator = MovieCommentCounter::DISCRIMINATOR.to_string();
counter_data.counter = 0;
counter_data.is_initialized = true;
msg!("comment count: {}", counter_data.counter);
counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;
```

Ahora, cuando se crea una nueva revisión, se inicializan dos cuentas:

1. La primera es la cuenta de revisión que almacena el contenido de la revisión. Esto no ha cambiado desde la versión del programa con el que comenzamos.
2. La segunda cuenta almacena el contador para comentarios

### 6. Implementar `add_comment`

Finalmente, implementemos nuestra `add_comment` función para crear nuevas cuentas de comentarios.

Cuando se crea un nuevo comentario para una revisión, aumentaremos el recuento en la cuenta PDA del contador de comentarios y derivaremos el PDA para la cuenta de comentarios utilizando la dirección de revisión y el recuento actual.

Al igual que en otras funciones de procesamiento de instrucciones, comenzaremos por iterar a través de las cuentas pasadas al programa. Luego, antes de hacer cualquier otra cosa, debemos deserializar la cuenta de contador para tener acceso al recuento de comentarios actual:


```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adding Comment...");
    msg!("Comment: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    Ok(())
}
```

Ahora que tenemos acceso a los datos del contador, podemos continuar con los pasos restantes:

1. Calcular la cantidad exenta de alquiler para la nueva cuenta de comentarios
2. Derivar el PDA para la cuenta de comentarios usando la dirección de revisión y el recuento de comentarios actual como semillas
3. Invocar el programa del sistema para crear la nueva cuenta de comentarios
4. Establecer los valores apropiados para la cuenta recién creada
5. Serialice los datos de la cuenta y regrese de la función


```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adding Comment...");
    msg!("Comment: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    let account_len = MovieComment::get_account_size(comment.clone());

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    let (pda, bump_seed) = Pubkey::find_program_address(&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(),], program_id);
    if pda != *pda_comment.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    invoke_signed(
        &system_instruction::create_account(
        commenter.key,
        pda_comment.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[commenter.clone(), pda_comment.clone(), system_program.clone()],
        &[&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("Created Comment Account");

    let mut comment_data = try_from_slice_unchecked::<MovieComment>(&pda_comment.data.borrow()).unwrap();

    msg!("checking if comment account is already initialized");
    if comment_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    comment_data.discriminator = MovieComment::DISCRIMINATOR.to_string();
    comment_data.review = *pda_review.key;
    comment_data.commenter = *commenter.key;
    comment_data.comment = comment;
    comment_data.is_initialized = true;
    comment_data.serialize(&mut &mut pda_comment.data.borrow_mut()[..])?;

    msg!("Comment Count: {}", counter_data.counter);
    counter_data.counter += 1;
    counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;

    Ok(())
}
```

### 7. Construir e implementar

¡Estamos listos para construir e implementar nuestro programa!

Cree el programa actualizado ejecutándolo `cargo-build-bpf`. A continuación, implemente el programa ejecutando el `solana program deploy` comando impreso en la consola.

Puede probar su programa enviando una transacción con los datos de instrucción correctos. Puedes crear tu propio script o sentirte libre de usarlo[este frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-comments). Asegúrese de usar la `solution-add-comments` sucursal y reemplazarla `utils/constants.ts` con `MOVIE_REVIEW_PROGRAM_ID` el ID de su programa o el frontend no funcionará con su programa.

Tenga en cuenta que hemos realizado cambios de ruptura en las cuentas de revisión (es decir, la adición de un discriminador). Si utilizara el mismo ID de programa que ha utilizado anteriormente al implementar este programa, ninguna de las revisiones que creó anteriormente se mostrará en este frontend debido a un desajuste de datos.

Si necesita más tiempo con este proyecto para sentirse cómodo con estos conceptos, eche un vistazo a la [código de solución](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments) antes de continuar. Tenga en cuenta que el código de la solución está en la `solution-add-comments` rama del repositorio vinculado.

# Desafío

¡Ahora es tu turno de construir algo de forma independiente! Siga adelante y trabaje con el programa Student Intro que hemos utilizado en lecciones anteriores. El programa Student Intro es un programa de Solana que permite a los estudiantes presentarse. Este programa toma el nombre de un usuario y un mensaje corto como el `instruction_data` y crea una cuenta para almacenar los datos en la cadena. Para este desafío usted debe:

1. Añadir una instrucción que permita a otros usuarios responder a una introducción
2. Construir e implementar el programa localmente

Si no ha seguido las lecciones anteriores o no ha guardado su trabajo de antes, no dude en usar el código de inicio en la `starter` rama de[este repositorio](https://github.com/Unboxed-Software/solana-student-intro-program/tree/starter).

¡Intenta hacerlo de forma independiente si puedes! Sin embargo, si te quedas atascado, siéntete libre de hacer referencia a la[código de solución](https://github.com/Unboxed-Software/solana-student-intro-program/tree/solution-add-replies). Tenga en cuenta que el código de la solución está en la `solution-add-replies` rama y que su código puede verse ligeramente diferente.

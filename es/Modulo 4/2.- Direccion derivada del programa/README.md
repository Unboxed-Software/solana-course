#  DIRECCIONES DERIVADAS DEL PROGRAMA

## Objetivos de la lección

*Al final de esta lección, podrás:*

- Explicar las Direcciones Derivadas de Programas (PDAs)
- Explicar varios casos de uso de PDAs
- Describir cómo se derivan las PDAs
- Usar las derivaciones de PDA para localizar y recuperar datos

# Terminología 

- Una **Dirección Derivada de Programa** (PDA) se deriva de un **ID de programa** y una lista opcional de **semillas** .
- Las PDAs son propiedad y controladas por el programa del cual se derivan.
- La derivación de PDA proporciona una forma determinística de encontrar datos basada en las semillas utilizadas para la derivación.
- Las semillas se pueden utilizar para asignar a los datos almacenados en una cuenta PDA separada.
- Un programa puede firmar instrucciones en nombre de las PDAs derivadas de su ID.


# Resumen
## ¿Qué es una Dirección Derivada de Programa?
Las Direcciones Derivadas de Programa (PDAs) son direcciones de cuentas diseñadas para ser firmadas por un programa en lugar de una clave secreta. Como su nombre indica, las PDAs se derivan utilizando un ID de programa. Opcionalmente, estas cuentas derivadas también se pueden encontrar utilizando el ID junto con un conjunto de "semillas". Más adelante hablaremos de esto, pero estas semillas jugarán un papel importante en cómo utilizamos las PDAs para almacenar y recuperar datos.

Las PDAs tienen dos funciones principales:

1. Proporcionar una forma determinística de encontrar la dirección de una cuenta propiedad de un programa.
2. Autorizar al programa del cual se deriva una PDA para firmar en su nombre de la misma manera que un usuario puede firmar con su clave privada.

En esta lección nos centraremos en utilizar las PDAs para encontrar y almacenar datos. Discutiremos la firma con una PDA con más detenimiento en una lección futura donde cubriremos las Invocaciones de Programa Cruzadas (CPIs).

## Encontrar PDAs
Técnicamente, las PDAs no se crean. Más bien, se encuentran o se derivan basándose en un ID de programa y una o más semillas de entrada.

Los pares de claves de Solana se pueden encontrar en lo que se llama la Curva Elíptica Ed25519. Ed25519 es un esquema de firma determinista que Solana utiliza para generar las claves públicas y privadas correspondientes. Juntos, llamamos a estos pares de claves.

Alternativamente, las PDAs son direcciones que se encuentran fuera de la curva Ed25519. Esto significa efectivamente que son claves públicas sin una clave privada correspondiente. Esta propiedad de las PDAs es esencial para que los programas puedan firmar en su nombre, pero cubriremos eso en una lección futura.

Para encontrar una PDA dentro de un programa Solana, usaremos la función **find_program_address** . Esta función toma una lista opcional de "semillas" y un ID de programa como entradas, y luego devuelve la PDA y una semilla de aumento.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[user.key.as_ref(), user_input.as_bytes().as_ref(), "SEED".as_bytes()], program_id)
```

### Semillas
Las "semillas" son entradas opcionales utilizadas en la función **find_program_address** para derivar una PDA. Por ejemplo, las semillas pueden ser cualquier combinación de claves públicas, entradas proporcionadas por un usuario o valores codificados. También se puede derivar una PDA solo utilizando el ID del programa y sin semillas adicionales. Sin embargo, el usar semillas para encontrar nuestras PDAs nos permite crear un número arbitrario de cuentas que nuestro programa puede poseer.

Mientras que usted, el desarrollador, determina las semillas a pasar en la función **find_program_address** , la función en sí proporciona una semilla adicional llamada "semilla de aumento". La función criptográfica para derivar una PDA resulta en una clave que se encuentra en la curva Ed25519 alrededor del 50% del tiempo. Con el fin de asegurar que el resultado no esté en la curva Ed25519 y, por lo tanto, no tenga una clave privada, la función **find_program_address** añade una semilla numérica llamada semilla de aumento.

La función comienza utilizando el valor **255** como semilla de aumento, luego verifica si la salida es una PDA válida. Si el resultado no es una PDA válida, la función disminuye la semilla de aumento en 1 y vuelve a intentarlo (**255** , **254** , **253** , etc.). Una vez que se encuentra una PDA válida, la función devuelve tanto la PDA como la semilla de aumento utilizada para derivar la PDA.

## Bajo el capó de **find_program_address**

Echemos un vistazo al código fuente de **find_program_address**.

```rust
pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Self::try_find_program_address(seeds, program_id)
        .unwrap_or_else(|| panic!("Unable to find a viable program address bump seed"))
}
```

Bajo el capó, la función **find_program_address** pasa las **semillas** de entrada y el **program_id** a la función **try_find_program_address** .

La función **try_find_program_address** introduce el **bump_seed** . El **bump_seed** es una variable **u8** con un valor comprendido entre 0 y 255. Iterando sobre un rango descendente que comienza en 255, se agrega un **bump_seed** a las semillas de entrada opcionales que luego se pasan a la función **create_program_address** . Si la salida de **create_program_address** no es un PDA válido, entonces se disminuye el **bump_seed** en 1 y el ciclo continúa hasta que se encuentre un PDA válido.

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

La función **create_program_address** realiza un conjunto de operaciones de hash sobre las semillas y el **program_id** . Estas operaciones calculan una clave, luego verifican si la clave calculada se encuentra en la curva elíptica Ed25519 o no. Si se encuentra una PDA válida (es decir, una dirección que está fuera de la curva), entonces se devuelve la PDA. De lo contrario, se devuelve un error.

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

En resumen, la función **find_program_address** pasa nuestras semillas de entrada y **program_id** a la función **try_find_program_address** . La función **try_find_program_address** agrega un **bump_seed** (comenzando en 255) a nuestras semillas de entrada, luego llama a la función **create_program_address** hasta que se encuentra una PDA válida. Una vez encontrada, tanto la PDA como el **bump_seed** son devueltos.

Tenga en cuenta que, para las mismas semillas de entrada, diferentes bumps válidos generarán diferentes PDAs válidas. El **bump_seed** devuelto por **find_program_address** siempre será el primer PDA válido encontrado. Dado que la función comienza con un valor de **bump_seed** de 255 e itera hacia abajo hasta cero, el **bump_seed** que finalmente se devuelve siempre será el valor 8-bit más grande posible. Este **bump_seed** se conoce comúnmente como el "bump canónico". Para evitar confusiones, se recomienda usar solo el bump canónico y *validar siempre cada PDA pasada a su programa* .

Un punto importante para destacar es que la función **find_program_address** solo devuelve una Dirección Derivada de Programa y la semilla bump utilizada para derivarla. La función **find_program_address** no inicializa una nueva cuenta, ni ninguna PDA devuelta por la función está necesariamente asociada con una cuenta que almacena datos.

## Utiliza cuentas PDA para almacenar datos.
Dado que los programas en sí mismos son sin estado, el estado del programa se administra a través de cuentas externas. Dado que se pueden usar semillas para mapear y que los programas pueden firmar en su nombre, usar cuentas PDA para almacenar datos relacionados con el programa es una elección de diseño muy común. Si bien los programas pueden invocar al Sistema de Programas para crear cuentas no PDA y usarlas para almacenar datos también, las PDAs suelen ser la mejor opción.
Si necesita un recordatorio de cómo almacenar datos en PDAs, eche un vistazo a la **lección Crear un programa básico, parte 2 - Administración de estado** .

## Mapear datos almacenados en cuentas PDA
Almacenar datos en cuentas PDA es solo la mitad de la ecuación. También necesita una forma de recuperar esos datos. Hablaremos de dos enfoques:
1. Crear una cuenta de "mapa" PDA que almacene las direcciones de varias cuentas donde se almacenan los datos.
2. Utilizar estratégicamente las semillas para localizar las cuentas PDA adecuadas y recuperar los datos necesarios.

### Mapeo de Datos usando Cuentas “map"
Una forma de organizar el almacenamiento de datos es almacenar grupos de datos relevantes en sus propias PDAs y luego tener una cuenta PDA separada que almacene un mapa de dónde están todos los datos.

Por ejemplo, podría tener una aplicación de toma de notas cuya programación utiliza semillas aleatorias para generar cuentas PDA y almacena una nota en cada cuenta. El programa también tendría una sola cuenta PDA global "map" que almacena un mapa de las claves públicas de los usuarios a la lista de PDAs donde se almacenan sus notas. Esta cuenta de mapa se derivaría utilizando una semilla estática, por ejemplo "GLOBAL_MAPPING".
Al momento de recuperar las notas de un usuario, podría ver la cuenta de mapa, ver la lista de direcciones asociadas con una clave pública de usuario y luego recuperar la cuenta para cada una de esas direcciones.

Aunque tal solución es quizás más accesible para los desarrolladores web tradicionales, tiene algunos inconvenientes que son particulares al desarrollo web3. Dado que el tamaño del mapa almacenado en la cuenta de mapa crecerá con el tiempo, deberá asignar más tamaño del necesario a la cuenta cuando la cree por primera vez o tendrá que volver a asignar espacio para ella cada vez que se cree una nueva nota. Además, eventualmente alcanzará el límite de tamaño de cuenta de 10 megabytes.

Usted podría mitigar este problema en cierta medida creando una cuenta de mapa separada para cada usuario. Por ejemplo, en lugar de tener una sola cuenta PDA map para todo el programa, construiría una cuenta PDA map por usuario. Cada una de estas cuentas de mapa podrían derivarse con la clave pública del usuario. Las direcciones de cada nota podrían almacenarse dentro de la cuenta de mapa correspondiente del usuario.

Este enfoque reduce el tamaño requerido para cada cuenta de mapa, pero finalmente agrega un requisito innecesario al proceso: tener que leer la información en la cuenta de mapa antes de poder encontrar las cuentas con los datos de nota relevantes.

Puede haber momentos en los que usar este enfoque tenga sentido para su aplicación, pero no lo recomendamos como su estrategia "go to".

### Mapear datos usando derivación PDA
Si es estratégico con las semillas que utiliza para derivar PDAs, puede incrustar los mapeos necesarios en las semillas mismas. Esta es la evolución natural del ejemplo de aplicación de toma de notas que acabamos de discutir. Si comienza a usar la clave pública del creador de notas como semilla para crear una cuenta de mapa por usuario, ¿por qué no usar tanto la clave pública del creador como alguna otra información conocida para derivar una PDA para la nota en sí?

Ahora, sin hablar de ello explícitamente, hemos estado mapeando semillas a cuentas durante todo el curso. Piense en el programa de revisión de películas que construimos en las lecciones anteriores. Este programa utiliza la clave pública del creador de la revisión y el título de la película que está revisando para encontrar la dirección que se debe utilizar para almacenar la revisión. Este enfoque permite que el programa cree una dirección única para cada nueva revisión y también facilita la localización de una revisión cuando sea necesaria. Cuando desee encontrar la revisión de un usuario de "Spiderman", sabe que se almacena en la cuenta PDA cuya dirección se puede derivar utilizando la clave pública del usuario y el texto "Spiderman" como semillas.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[
        initializer.key.as_ref(),
        title.as_bytes().as_ref()
    ],
    program_id)
```

### Direcciones de cuentas de tokens asociadas
Un ejemplo práctico de este tipo de mapeo es cómo se determinan las direcciones de cuentas de tokens asociadas (ATA). Los tokens a menudo se mantienen en una ATA cuya dirección se ha derivado utilizando una dirección de billetera y la dirección de acuñación de un token específico. La dirección de una ATA se encuentra utilizando la función **get_associated_token_address**, que toma una **wallet_address** y un **token_mint_address** como entradas. Esto permite a los programas y aplicaciones recuperar y manipular los tokens de manera eficiente y segura.

```rust
let associated_token_address = get_associated_token_address(&wallet_address, &token_mint_address);
```

Bajo el capó, la dirección de token asociada es una PDA encontrada utilizando la **wallet_address** , **token_program_id** y **token_mint_address** como semillas. Esto proporciona una forma determinística de encontrar una cuenta de token asociada con cualquier dirección de billetera para un acuñamiento específico de token.

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

Los mapeos entre semillas y cuentas PDA que utilice dependerán altamente de su programa específico. Aunque esta no es una lección sobre diseño de sistemas o arquitectura, vale la pena mencionar algunas pautas:

- Utilice semillas que serán conocidas en el momento de la derivación PDA
- Sea reflexivo sobre qué datos se agrupan juntos en una sola cuenta
- Sea reflexivo sobre la estructura de datos utilizada dentro de cada cuenta
- Lo más sencillo suele ser mejor


# Demostración

Practiquemos juntos con el programa de reseñas de películas en el que hemos trabajado en lecciones anteriores. No se preocupe si acaba de comenzar esta lección sin haber hecho la lección anterior, debería ser posible seguir adelante de cualquier manera.

Como recordatorio, el programa de reseñas de películas permite a los usuarios crear reseñas de películas. Estas reseñas se almacenan en una cuenta utilizando una PDA derivada con la clave pública del inicializador y el título de la película que están reseñando.

Anteriormente, terminamos de implementar la capacidad de actualizar una reseña de película de manera segura. En esta demostración, agregaremos la capacidad para que los usuarios comenten una reseña de película. Utilizaremos la construcción de esta característica como una oportunidad para trabajar en cómo estructurar el almacenamiento de comentarios utilizando cuentas PDA.

## 1. Obtén el código base
Para comenzar, puedes encontrar el código base [aquí](https://github.com/Unboxed-Software/solana-movie-program/tree/starter) en la rama **starter**.
Si has estado siguiendo las demostraciones de Movie Review, notarás que este es el programa que hemos construido hasta ahora. Anteriormente, utilizamos [Solana Playground](https://beta.solpg.io/) para escribir, construir y desplegar nuestro código. En esta lección, construiremos y desplegaremos el programa localmente.

Abre la carpeta, luego ejecuta **cargo-build-bpf ** para construir el programa. El comando **cargo-build-bpf** mostrará instrucciones para desplegar el programa.

```bash
cargo-build-bpf
```

Despliega el programa copiando la salida de **cargo-build-bpf** y ejecutando el comando **solana program deploy** .

```bash
solana program deploy <PATH>
```

Puedes probar el programa utilizando la [interfaz](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews) de usuario de reseñas de películas y actualizando el ID del programa con el que acabas de desplegar. Asegúrate de usar la rama **solution-update-reviews**.


## 2. Planea la estructura de la cuenta

Agregar comentarios significa que necesitamos tomar algunas decisiones sobre cómo almacenar los datos asociados con cada comentario. Los criterios para una buena estructura aquí son:
- No es demasiado complicado
- Los datos son fácilmente recuperables
- Cada comentario tiene algo que lo relacione con la reseña con la que está asociado

Para hacer esto, crearemos dos nuevos tipos de cuenta:
- Cuenta de contador de comentarios
- Cuenta de comentarios

Habrá una cuenta de contador de comentarios por reseña y una cuenta de comentarios por comentario. La cuenta de contador de comentarios estará vinculada a una reseña determinada utilizando la dirección de una reseña como semilla para encontrar la PDA de contador de comentarios. También usará la cadena estática "comentario" como semilla.


La cuenta de comentario estará vinculada a una reseña de la misma manera. Sin embargo, no incluirá la cadena "comentario" como semilla y en su lugar usará el recuento real de comentarios como semilla. De esa manera, el cliente puede recuperar fácilmente los comentarios para una reseña determinada haciendo lo siguiente:

1. Leer los datos en la cuenta de contador de comentarios para determinar el número de comentarios en una reseña.
2. Donde **n** es el número total de comentarios en la reseña, repite el ciclo** n** veces. Cada iteración del ciclo derivará una PDA utilizando la dirección de la reseña y el número actual como semillas. El resultado es **n** número de PDAs, cada una de las cuales es la dirección de una cuenta que almacena un comentario.
3. Obtén las cuentas para cada una de las **n** PDAs y lee los datos almacenados en cada una.

Esto garantiza que cada una de nuestras cuentas puede ser recuperada de manera determinística utilizando datos que ya se conocen de antemano.

Para implementar estos cambios, necesitaremos hacer lo siguiente:
- Define structs para representar las cuentas de contador de comentarios y de comentarios
- Actualiza el **estado de cuenta de Movie** existente para contener un discriminador (más sobre esto más tarde)
- Agrega una variante de instrucción para representar la instrucción **add_comment**
- Actualiza la función de procesamiento de la instrucción existente **add_movie_review** para incluir la creación de la cuenta de contador de comentarios
- Crea una nueva función de procesamiento de la instrucción **add_comment**


## 3. Define las estructuras **MovieCommentCounter** y **MovieComment**
Recuerda que el archivo **state.rs** define las estructuras que utiliza nuestro programa para poblar el campo de datos de una nueva cuenta.

Necesitaremos definir dos nuevas estructuras para habilitar los comentarios.
1. **MovieCommentCounter** - para almacenar un contador para el número de comentarios asociados con una reseña
2. **MovieComment** - para almacenar los datos asociados con cada comentario

Para comenzar, definamos las estructuras que utilizaremos para nuestro programa. Tenga en cuenta que estamos agregando un campo **discriminador** a cada estructura, incluyendo el **estado de cuenta Movie** existente. Ya que ahora tenemos varios tipos de cuentas, necesitamos una manera de solo recuperar el tipo de cuenta que necesitamos del cliente. Este discriminador es una cadena que se puede utilizar para filtrar las cuentas cuando recuperamos las cuentas de nuestro programa.

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

Como hemos agregado un nuevo campo **discriminador** a nuestra estructura existente, la calculación del tamaño de la cuenta necesita cambiar. Usemos esta oportunidad para limpiar un poco nuestro código. Agregaremos una implementación para cada una de las tres estructuras anteriores que agrega una constante **DISCRIMINATOR** y ya sea una constante **SIZE** o una función **get_account_size** para poder obtener rápidamente el tamaño necesario al inicializar una cuenta.

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

Ahora, en todas partes donde necesitemos el discriminador o el tamaño de la cuenta, podemos utilizar esta implementación y no correr el riesgo de errores de tipeo involuntarios.

## 4. Crear la instrucción **AddComment**
Recuerda que el archivo **instruction.rs** define las instrucciones que nuestro programa aceptará y cómo deserializar los datos para cada una. Necesitamos agregar una nueva variante de instrucción para agregar comentarios. Comencemos agregando una nueva variante **AddComment** al enum **MovieInstruction**.

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

A continuación, creemos una estructura **CommentPayload** para representar los datos de instrucción asociados con esta nueva instrucción. La mayoría de los datos que incluiremos en la cuenta son claves públicas asociadas con las cuentas pasadas al programa, por lo que lo único que realmente necesitamos aquí es un solo campo para representar el texto del comentario.

```rust
#[derive(BorshDeserialize)]
struct CommentPayload {
    comment: String
}
```

Ahora actualicemos cómo desempaquetamos los datos de la instrucción. Observe que hemos movido la deserialización de los datos de la instrucción en cada caso correspondiente utilizando la estructura de carga asociada para cada instrucción.

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

Por último, actualicemos la función **process_instruction** en **processor.rs** para utilizar la nueva variante de instrucción que hemos creado. 

En **processor.rs** , traer al alcance las nuevas estructuras de **state.rs** .

```rust
use crate::state::{MovieAccountState, MovieCommentCounter, MovieComment};
```

Luego, en **process_instruction** , emparejemos nuestros datos de instrucción deserializados de **AddComment** con la función **add_comment** que implementaremos próximamente.

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

## 5. Actualizar **add_movie_review** para crear la cuenta de contador de comentarios
Antes de implementar la función **add_comment** , debemos actualizar la función **add_movie_review** para crear la cuenta de contador de comentarios de la reseña.

Recuerde que esta cuenta llevará registro del total de comentarios que existen para una reseña asociada. Su dirección será una PDA derivada utilizando la dirección de la reseña de la película y la palabra "comentario" como semillas. Tenga en cuenta que cómo almacenamos el contador es simplemente una elección de diseño. También podríamos agregar un campo "contador" a la cuenta original de reseña de la película.

Dentro de la función **add_movie_review** , agreguemos un **pda_counter** para representar la nueva cuenta de contador que inicializaremos junto con la cuenta de reseña de la película. Esto significa que ahora esperamos que cuatro cuentas se pasen a la función **add_movie_review** a través del argumento **accounts**.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

A continuación, hay una comprobación para asegurarse de que **total_len** es menor de 1000 bytes, pero **total_len** ya no es preciso ya que agregamos el discriminador. Reemplacemos **total_len** con una llamada a **MovieAccountState::get_account_size**:

```rust
let account_len: usize = 1000;

if MovieAccountState::get_account_size(title.clone(), description.clone()) > account_len {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into());
}
```

Ten en cuenta que esto también debe actualizarse en la función **update_movie_review** para que la instrucción funcione correctamente.

Una vez que hayamos inicializado la cuenta de reseña, también necesitaremos actualizar el **account_data** con los nuevos campos que especificamos en la estructura **MovieAccountState** .

```rust
account_data.discriminator = MovieAccountState::DISCRIMINATOR.to_string();
account_data.reviewer = *initializer.key;
account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Por último, agreguemos la lógica para inicializar la cuenta de contador dentro de la función **add_movie_review** . Esto significa:
1. Calcular la cantidad de exención de alquiler para la cuenta de contador
2. Derivando la PDA del contador usando la dirección de la revisión y la cadena "comentario" como semillas
3. Invocando al programa del sistema para crear la cuenta
4. Establecer el valor de contador de inicio
5. Serializar los datos de la cuenta y devolver de la función

Todo esto debe agregarse al final de la función **add_movie_review** antes de **Ok(())**.

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

Ahora, cuando se crea una nueva reseña, se inicializan dos cuentas:
1. La primera es la cuenta de revisión que almacena el contenido de la revisión. Esto no ha cambiado desde la versión del programa con la que comenzamos.
2. La segunda cuenta almacena el contador de comentarios.

## 6. Implementar **add_comment**
Por último, implementemos nuestra función **add_comment** para crear nuevas cuentas de comentarios.

Cuando se crea un nuevo comentario para una reseña, incrementaremos el contador en la cuenta PDA del contador de comentarios y derivaremos la PDA para la cuenta de comentarios utilizando la dirección de la revisión y el contador actual.

Al igual que en otras funciones de procesamiento de instrucciones, comenzaremos iterando a través de las cuentas pasadas al programa. Luego, antes de hacer cualquier otra cosa, necesitamos deserializar la cuenta del contador para tener acceso al contador de comentarios actual:

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

1. Calcular la cantidad exenta de alquiler para la nueva cuenta de comentario
2. Derivar la PDA para la cuenta de comentarios utilizando la dirección de la revisión y el contador actual de comentarios como semillas
3. Invocar al Programa del Sistema para crear la nueva cuenta de comentarios
4. Establecer los valores adecuados en la cuenta recién creada
5. Serializar los datos de la cuenta y devolver de la función.

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

## 7. Construir y desplegar
¡Estamos listos para construir y desplegar nuestro programa!
Construye el programa actualizado ejecutando **cargo-build-bpf** . Luego implemente el programa ejecutando el comando **solana program deploy** impreso en la consola.
Puedes probar tu programa enviando una transacción con los datos de instrucción adecuados. Puedes crear tu propio script o utilizar [esta interfaz](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-comments) . Asegúrate de usar la rama **solution-add-comments** y reemplaza el **MOVIE_REVIEW_PROGRAM_ID** en **utils/constants.ts** con la ID de tu programa o la interfaz no funcionará con tu programa.
Ten en cuenta que hicimos cambios importantes en las cuentas de revisión (es decir, agregando un discriminador). Si usaras la misma ID de programa que usaste previamente al implementar este programa, ninguna de las reseñas que creaste anteriormente se mostrará en esta interfaz debido a un desajuste de datos.
Si necesita más tiempo con este proyecto para sentirse cómodo con estos conceptos, eche un vistazo al código de solución antes de continuar. Tenga en cuenta que el código de solución está en la rama de **solución-add-comments** del repositorio vinculado.


# Desafío
¡Ahora le toca a usted construir algo independientemente! Adelante y trabaje con el programa Student Intro que hemos utilizado en las lecciones anteriores. El programa Student Intro es un programa de Solana que permite a los estudiantes presentarse. Este programa toma el nombre de un usuario y un mensaje corto como **instruction_data** y crea una cuenta para almacenar los datos en la cadena. Para este desafío, debe:

1. Agregar una instrucción que permita a otros usuarios responder a una presentación.
2. Construir y desplegar el programa localmente.
Si no ha estado siguiendo junto con las lecciones anteriores o no ha guardado su trabajo anterior, no dude en usar el código de inicio en la rama **starter** de [este repositorio](https://github.com/Unboxed-Software/solana-student-intro-program/tree/starter).

¡Intenta hacerlo independientemente si puedes! Si te quedas atascado, no dudes en consultar el [código de solución](https://github.com/Unboxed-Software/solana-student-intro-program/tree/solution-add-replies) . Tenga en cuenta que el código de solución está en la rama de **solución-add-replies** y que su código puede verse ligeramente diferente.


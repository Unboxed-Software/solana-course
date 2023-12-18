---
title: Crear un Programa Básico, Parte 1 - Manejar los objetivos de los Datos de Instrucción
objectives:
- Asignar variables mutables e inmutables en Rust
- Crear y usar estructuras y enumeraciones de óxido
- Usar declaraciones de coincidencia de óxido
- Añadir implementaciones a los tipos de óxido
- Deserializar los datos de instrucción en tipos de datos de óxido
- Ejecutar diferentes lógicas de programa para diferentes tipos de instrucciones
- Explicar la estructura de un contrato inteligente en Solana
---

# TL;DR

-   La mayoría de los programas admiten**instrucciones discretas múltiples** : usted decide al escribir su programa cuáles son estas instrucciones y qué datos deben acompañarlas.
-   El óxido **enums** se utiliza a menudo para representar instrucciones de programa discretas.
-   Puede usar la `borsh` caja y el `derive` atributo para proporcionar la funcionalidad de deserialización y serialización de Borsh a las estructuras de óxido
-   `match` Las expresiones de óxido ayudan a crear rutas de código condicionales basadas en la instrucción proporcionada

# Descripción general

Uno de los elementos más básicos de un programa de Solana es la lógica para el manejo de datos de instrucción. La mayoría de los programas admiten múltiples funciones relacionadas y utilizan diferencias en los datos de instrucción para determinar qué ruta de código ejecutar. Por ejemplo, dos formatos de datos diferentes en los datos de instrucción pasados al programa pueden representar instrucciones para crear una nueva pieza de datos frente a eliminar la misma pieza de datos.

Dado que los datos de instrucción se proporcionan al punto de entrada de su programa como una matriz de bytes, es común crear un tipo de datos Rust para representar las instrucciones de una manera que sea más utilizable en todo el código. Esta lección explicará cómo configurar dicho tipo, cómo deserializar los datos de instrucción en este formato y cómo ejecutar la ruta de código adecuada en función de la instrucción pasada al punto de entrada del programa.

## Rust Basics

Antes de sumergirnos en los detalles de un programa básico de Solana, hablemos sobre los conceptos básicos de Rust que usaremos a lo largo de esta lección.

### Variables

La asignación de variables en Rust ocurre con la `let` palabra clave.

```rust
let age = 33;
```

Las variables en Rust por defecto son inmutables, lo que significa que el valor de una variable no se puede cambiar una vez que se ha establecido. Para crear una variable que nos gustaría cambiar en algún momento en el futuro, usamos la `mut` palabra clave. Definir una variable con esta palabra clave significa que el valor almacenado en ella puede cambiar.

```rust
// compiler will throw error
let age = 33;
age = 34;

// this is allowed
let mut mutable_age = 33;
mutable_age = 34;
```

El compilador Rust garantiza que las variables inmutables realmente no pueden cambiar para que no tenga que realizar un seguimiento de sí mismo. Esto hace que su código sea más fácil de razonar y simplifica la depuración.

### Estructuras

Una estructura, o estructura, es un tipo de datos personalizado que le permite empaquetar y nombrar múltiples valores relacionados que conforman un grupo significativo. Cada pieza de datos en una estructura puede ser de diferentes tipos y cada uno tiene un nombre asociado. Estas piezas de datos se llaman**campos**. Se comportan de manera similar a las propiedades en otros idiomas.

```rust
struct User {
    active: bool,
    email: String,
    age: u64
}
```

Para usar una estructura después de haberla definido, creamos una instancia de esa estructura especificando valores concretos para cada uno de los campos.

```rust
let mut user1 = User {
    active: true,
    email: String::from("test@test.com"),
    age: 36
};
```

Para obtener o establecer un valor específico de una estructura, utilizamos la notación de puntos.

```rust
user1.age = 37;
```

### Enumeraciones

Las enumeraciones (o Enums) son una estructura de datos que le permiten definir un tipo enumerando sus posibles variantes. Un ejemplo de un enum puede parecerse a:

```rust
enum LightStatus {
    On,
    Off
}
```

El `LightStatus` enum tiene dos variantes posibles en esta situación: es `On` o `Off`.

También puede incrustar valores en variantes de enumeración, de forma similar a la adición de campos a una estructura.

```rust
enum LightStatus {
    On {
        color: String
    },
    Off
}

let light_status = LightStatus::On { color: String::from("red") };
```

En este ejemplo, establecer una variable en la `On` variante de también `LightStatus` requiere establecer el valor de `color`.

### Coincidir estados de cuenta

Las declaraciones de coincidencia son muy similares a `switch` las declaraciones en C/C++. La `match` instrucción le permite comparar un valor con una serie de patrones y luego ejecutar código en función de qué patrón coincide con el valor. Los patrones pueden estar hechos de valores literales, nombres de variables, comodines y más. La declaración de coincidencia debe incluir todos los escenarios posibles, de lo contrario el código no se compilará.

```rust
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter
}

fn value_in_cents(coin: Coin) -> u8 {
    match coin {
        Coin::Penny => 1,
        Coin::Nickel => 5,
        Coin::Dime => 10,
        Coin::Quarter => 25
    }
}
```

### Implementaciones

La `impl` palabra clave se utiliza en Rust para definir las implementaciones de un tipo. Las funciones y las constantes se pueden definir en una implementación.

```rust
struct Example {
    number: i32
}

impl Example {
    fn boo() {
        println!("boo! Example::boo() was called!");
    }

    fn answer(&mut self) {
        self.number += 42;
    }

    fn get_number(&self) -> i32 {
        self.number
    }
}
```

La función `boo` aquí sólo se puede llamar en el tipo en sí en lugar de una instancia del tipo, así:

```rust
Example::boo();
```

Mientras tanto, `answer` requiere una instancia mutable de `Example` y se puede llamar con la sintaxis de puntos:

```rust
let mut example = Example { number: 3 };
example.answer();
```

### Rasgos y atributos

No crearás tus propios rasgos o atributos en esta etapa, por lo que no proporcionaremos una explicación en profundidad de ninguno de los dos. Sin embargo, usarás la macro de `derive` atributos y algunos rasgos proporcionados por la `borsh` caja, por lo que es importante que tengas una comprensión de alto nivel de cada uno.

Los rasgos describen una interfaz abstracta que los tipos pueden implementar. Si un rasgo define una función `bark()` y un tipo adopta ese rasgo, el tipo debe implementar la `bark()` función.

[Attributes](https://doc.rust-lang.org/rust-by-example/attribute.html) añadir metadatos a un tipo y se puede utilizar para muchos propósitos diferentes.

Cuando agrega el [ `derive` atributo](https://doc.rust-lang.org/rust-by-example/trait/derive.html) a un tipo y proporciona uno o más rasgos admitidos, se genera código bajo el capó para implementar automáticamente los rasgos para ese tipo. Proporcionaremos un ejemplo concreto de esto en breve.

## Representación de instrucciones como un tipo de datos de óxido

Ahora que hemos cubierto los conceptos básicos de Rust, apliquémoslos a los programas de Solana.

La mayoría de las veces, los programas tendrán más de una función. Por ejemplo, es posible que tenga un programa que actúe como backend para una aplicación para tomar notas. Supongamos que este programa acepta instrucciones para crear una nueva nota, actualizar una nota existente y eliminar una nota existente.

Dado que las instrucciones tienen tipos discretos, por lo general son un gran ajuste para un tipo de datos enum.

```rust
enum NoteInstruction {
    CreateNote {
        title: String,
        body: String,
        id: u64
    },
    UpdateNote {
        title: String,
        body: String,
        id: u64
    },
    DeleteNote {
        id: u64
    }
}
```

Observe que cada variante de la `NoteInstruction` enumeración viene con datos incrustados que serán utilizados por el programa para realizar las tareas de creación, actualización y eliminación de una nota, respectivamente.

## Deserializar datos de instrucción

Los datos de instrucción se pasan al programa como una matriz de bytes, por lo que necesita una forma de convertir determinísticamente esa matriz en una instancia del tipo de enumeración de instrucciones.

En módulos anteriores, utilizamos Borsh para la serialización y deserialización del lado del cliente. Para usar el lado del programa de Borsh, usamos la `borsh` caja. Esta caja proporciona rasgos para `BorshDeserialize` y `BorshSerialize` que puede aplicar a sus tipos utilizando el `derive` atributo.

Para simplificar la deserialización de los datos de instrucción, puede crear una estructura que represente los datos y usar el `derive` atributo para aplicar el `BorshDeserialize` rasgo a la estructura. Esto implementa los métodos definidos en `BorshDeserialize`, incluido el `try_from_slice` método que usaremos para deserializar los datos de instrucción.

Recuerde, la propia estructura debe coincidir con la estructura de los datos en la matriz de bytes.

```rust
#[derive(BorshDeserialize)]
struct NoteInstructionPayload {
    id: u64,
    title: String,
    body: String
}
```

Una vez que se ha creado esta estructura, puede crear una implementación para que su enum de instrucción maneje la lógica asociada con la deserialización de los datos de instrucción. Es común ver esto hecho dentro de una función llamada `unpack` que acepta los datos de instrucción como un argumento y devuelve la instancia apropiada de la enumeración con los datos deserializados.

Es una práctica estándar estructurar su programa para esperar que el primer byte (u otro número fijo de bytes) sea un identificador para qué instrucción debe ejecutar el programa. Este podría ser un número entero o un identificador de cadena. Para este ejemplo, usaremos los números enteros 0, 1 y 2 del primer byte y del mapa para crear, actualizar y eliminar instrucciones, respectivamente.

```rust
impl NoteInstruction {
    // Unpack inbound buffer to associated Instruction
    // The expected format for input is a Borsh serialized vector
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Take the first byte as the variant to
        // determine which instruction to execute
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // Use the temporary payload struct to deserialize
        let payload = NoteInstructionPayload::try_from_slice(rest).unwrap();
        // Match the variant to determine which data struct is expected by
        // the function and return the TestStruct or an error
        Ok(match variant {
            0 => Self::CreateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            1 => Self::UpdateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            2 => Self::DeleteNote {
                id: payload.id
            },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

Hay mucho en este ejemplo, así que vamos a dar un paso a la vez:

1. Esta función comienza usando la `split_first` función en el `input` parámetro para devolver una tupla. El primer elemento, `variant`, es el primer byte de la matriz de bytes y el segundo elemento, `rest`, es el resto de la matriz de bytes.
2. La función luego usa el `try_from_slice` método `NoteInstructionPayload` para deserializar el resto de la matriz de bytes en una instancia de `NoteInstructionPayload` llamada `payload`
3. Finalmente, la función utiliza una `match` instrucción on `variant` para crear y devolver la instancia enum apropiada utilizando información de `payload`

Tenga en cuenta que hay una sintaxis de óxido en esta función que aún no hemos explicado. Las `unwrap` funciones `ok_or` y se utilizan para el manejo de errores y se discutirán en detalle en otra lección.

## Lógica del programa

Con una forma de deserializar los datos de instrucción en un tipo de óxido personalizado, puede usar el flujo de control apropiado para ejecutar diferentes rutas de código en su programa en función de qué instrucción se pasa al punto de entrada de su programa.

```rust
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Call unpack to deserialize instruction_data
    let instruction = NoteInstruction::unpack(instruction_data)?;
    // Match the returned data struct to what you expect
    match instruction {
        NoteInstruction::CreateNote { title, body, id } => {
            // Execute program code to create a note
        },
        NoteInstruction::UpdateNote { title, body, id } => {
            // Execute program code to update a note
        },
        NoteInstruction::DeleteNote { id } => {
            // Execute program code to delete a note
        }
    }
}
```

Para programas simples donde solo hay una o dos instrucciones para ejecutar, puede estar bien escribir la lógica dentro de la instrucción match. Para los programas con muchas instrucciones posibles diferentes para comparar, su código será mucho más legible si la lógica de cada instrucción se escribe en una función separada y simplemente se llama desde el interior de la `match` instrucción.

## Estructura de archivos del programa

El [Lección de Hello World](hello-world-program) programa era lo suficientemente simple como para que pudiera limitarse a un archivo. Pero a medida que crece la complejidad de un programa, es importante mantener una estructura de proyecto que siga siendo legible y extensible. Esto implica encapsular el código en funciones y estructuras de datos como lo hemos hecho hasta ahora. Pero también implica agrupar el código relacionado en archivos separados.

Por ejemplo, una buena parte del código que hemos trabajado hasta ahora tiene que ver con la definición y deserialización de instrucciones. Ese código debe vivir en su propio archivo en lugar de estar escrito en el mismo archivo que el punto de entrada. Al hacerlo, tendríamos 2 archivos, uno con el punto de entrada del programa y el otro con el código de instrucción:

-   **lib.rs**
-   **instruction.rs**

Una vez que comience a dividir su programa de esta manera, deberá asegurarse de registrar todos los archivos en una ubicación central. Vamos a hacer esto en `lib.rs`. **Debe registrar todos los archivos en su programa de esta manera.**

```rust
// This would be inside lib.rs
pub mod instruction;
```

Además, cualquier declaración que desee que esté disponible a través de `use` declaraciones en otros archivos deberá ir precedida de la `pub` palabra clave:

```rust
pub enum NoteInstruction { ... }
```

## Demostración

Para la demostración de esta lección, desarrollaremos la primera mitad del programa Movie Review con el que trabajamos en el Módulo 1. Este programa almacena reseñas de películas enviadas por los usuarios.

Por ahora, nos centraremos en deserializar los datos de instrucción. La siguiente lección se centrará en la segunda mitad de este programa.

### 1. Punto de entrada

Vamos a utilizar de [Parque infantil Solana](https://beta.solpg.io/) nuevo para construir este programa. Solana Playground guarda el estado en su navegador, por lo que todo lo que hizo en la lección anterior aún puede estar allí. Si es así, eliminemos todo del `lib.rs` archivo actual.

Dentro de lib.rs, vamos a traer las siguientes cajas y definir dónde nos gustaría que esté nuestro punto de entrada al programa con la `entrypoint` macro.

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::AccountInfo,
};

// Entry point is a function call process_instruction
entrypoint!(process_instruction);

// Inside lib.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {

    Ok(())
}
```

### 2. Deserializar datos de instrucción

Antes de continuar con la lógica del procesador, debemos definir nuestras instrucciones compatibles e implementar nuestra función de deserialización.

Para mayor legibilidad, vamos a crear un nuevo archivo llamado `instruction.rs`. Dentro de este nuevo archivo, añadir `use` instrucciones para `BorshDeserialize` y `ProgramError`, a continuación, crear un `MovieInstruction` enum con una `AddMovieReview` variante. Esta variante debe tener valores incrustados para `title,` `rating`, y `description`.

```rust
use borsh::{BorshDeserialize};
use solana_program::{program_error::ProgramError};

pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    }
}
```

A continuación, defina una `MovieReviewPayload` estructura. Esto actuará como un tipo intermediario para la deserialización, por lo que debería usar la macro de `derive` atributos para proporcionar una implementación predeterminada para el `BorshDeserialize` rasgo.

```rust
#[derive(BorshDeserialize)]
struct MovieReviewPayload {
    title: String,
    rating: u8,
    description: String
}
```

Finalmente, cree una implementación para el `MovieInstruction` enum que defina e implemente una función llamada `unpack` que tome una matriz de bytes como argumento y devuelva un `Result` tipo. Esta función debería:

1. Utilice la `split_first` función para dividir el primer byte de la matriz del resto de la matriz
2. Deserializar el resto de la matriz en una instancia de `MovieReviewPayload`
3. Utilice una `match` instrucción para devolver la `AddMovieReview` variante de `MovieInstruction` si el primer byte de la matriz era un 0 o devuelva un error de programa de lo contrario

```rust
impl MovieInstruction {
    // Unpack inbound buffer to associated Instruction
    // The expected format for input is a Borsh serialized vector
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Split the first byte of data
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // `try_from_slice` is one of the implementations from the BorshDeserialization trait
        // Deserializes instruction byte data into the payload struct
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        // Match the first byte and return the AddMovieReview struct
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

### 3. Lógica del programa

Con la deserialización de instrucción manejada, podemos volver al `lib.rs` archivo para manejar parte de nuestra lógica de programa.

Recuerde, ya que hemos añadido código a un archivo diferente, tenemos que registrarlo en el `lib.rs` archivo usando `pub mod instruction;`. A continuación, podemos añadir una `use` declaración para poner el `MovieInstruction` tipo en el alcance.

```rust
pub mod instruction;
use instruction::{MovieInstruction};
```

A continuación, vamos a definir una nueva función `add_movie_review` que toma como argumentos `program_id` `accounts`, `title`, `rating`, y `description`. También debería devolver una instancia de `ProgramResult` Dentro de esta función, simplemente registremos nuestros valores por ahora y revisaremos el resto de la implementación de la función en la próxima lección.

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

    // Logging instruction data that was passed in
    msg!("Adding movie review...");
    msg!("Title: {}", title);
    msg!("Rating: {}", rating);
    msg!("Description: {}", description);

    Ok(())
}
```

Una vez hecho esto, podemos llamar `add_movie_review` desde `process_instruction` (la función que establecemos como nuestro punto de entrada). Para pasar todos los argumentos requeridos a la función, primero necesitaremos llamar a la `unpack` que creamos `MovieInstruction`, luego usar una `match` instrucción para asegurarnos de que la instrucción que hemos recibido es la `AddMovieReview` variante.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Unpack called
    let instruction = MovieInstruction::unpack(instruction_data)?;
    // Match against the data struct returned into `instruction` variable
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            // Make a call to `add_move_review` function
            add_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

Y así, su programa debe ser lo suficientemente funcional como para registrar los datos de instrucción pasados cuando se envía una transacción.

Cree e implemente su programa desde el Programa Solana al igual que en la última lección. Si no ha cambiado el ID del programa desde la última lección, se implementará automáticamente en el mismo ID. Si desea que tenga una dirección separada, puede generar un nuevo ID de programa desde el patio de recreo antes de implementarlo.

Puede probar su programa enviando una transacción con los datos de instrucción correctos. Para eso, siéntase libre de usar [este script](https://github.com/Unboxed-Software/solana-movie-client) o [el frontend](https://github.com/Unboxed-Software/solana-movie-frontend) construimos en el[Serializar la lección de datos de instrucciones personalizadas](serialize-instruction-data). En ambos casos, asegúrese de copiar y pegar el ID de programa para su programa en el área apropiada del código fuente para asegurarse de que está probando el programa correcto.

Si necesitas pasar más tiempo con esta demostración antes de seguir adelante, ¡hazlo! También puedes echar un vistazo al programa [código de solución](https://beta.solpg.io/62aa9ba3b5e36a8f6716d45b) si te quedas atascado.

# Desafío

Para el desafío de esta lección, intente replicar el programa Student Intro del Módulo 1. ¡Recuerde que creamos una aplicación frontend que permite a los estudiantes presentarse! El programa toma el nombre de un usuario y un mensaje corto como el `instruction_data` y crea una cuenta para almacenar los datos en la cadena.

Usando lo que ha aprendido en esta lección, cree el programa Student Intro hasta el punto en que pueda imprimir el `name` y `message` proporcionado por el usuario a los registros del programa cuando se invoca el programa.

Puede probar su programa construyendo el [frontend](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data) que creamos en el [Serializar la lección de datos de instrucciones personalizadas](serialize-instruction-data) y luego verificando los registros del programa en Solana Explorer. Recuerde reemplazar el ID del programa en el código del frontend con el que ha implementado.

¡Intenta hacerlo de forma independiente si puedes! Pero si te quedas atascado, siéntete libre de hacer referencia a la[código de solución](https://beta.solpg.io/62b0ce53f6273245aca4f5b0).

# CREAR UN PROGRAMA BÁSICO, PARTE 1 – MANEJAR DATOS DE INSTRUCCIONES
## Objetivos de la lección:

Al final de esta lección, podrás:
- Asignar variables mutables e inmutables en Rust
- Crear y usar estructuras y enumeraciones en Rust
- Usar las sentencias match de Rust
- Agregar implementaciones a los tipos de Rust
- Deserializar los datos de instrucción en tipos de datos de Rust
- Ejecutar lógica de programa diferente para diferentes tipos de instrucciones-
- Explicar la estructura de un contrato inteligente en Solana

# Terminología
- La mayoría de los programas admiten varias instrucciones discretas: tú decides cuáles son estas instrucciones y qué datos deben acompañarlas al escribir tu programa.
- Las enumeraciones de Rust a menudo se utilizan para representar instrucciones de programa discretas.
- Puedes usar la biblioteca borsh y el atributo derive para proporcionar funcionalidad de deserialización y serialización Borsh a las estructuras de Rust.
- Las expresiones match de Rust ayudan a crear rutas de código condicional basadas en la instrucción proporcionada.

# Resumen
Uno de los elementos más básicos de un programa de Solana es la lógica para manejar los datos de instrucción. La mayoría de los programas admiten varias funciones relacionadas y utilizan diferencias en los datos de instrucción para determinar cuál es la ruta de código a ejecutar. Por ejemplo, dos formatos de datos diferentes en los datos de instrucción pasados al programa pueden representar instrucciones para crear una nueva pieza de datos o eliminar la misma pieza de datos.
Dado que los datos de instrucción se proporcionan a la entrada de tu programa como una matriz de bytes, es común crear un tipo de datos de Rust para representar las instrucciones de una manera más utilizable en todo tu código. Esta lección te guiará sobre cómo configurar ese tipo, cómo deserializar los datos de instrucción en este formato y cómo ejecutar la ruta de código adecuada en función de la instrucción pasada a la entrada del programa.

## Básicos de Rust
Antes de profundizar en los detalles de un programa básico de Solana, hablemos sobre los conceptos básicos de Rust que usaremos a lo largo de esta lección.

### Variables
La asignación de variables en Rust ocurre con la palabra clave **let**.

```rust
let age = 33;
```

Las variables en Rust, de manera predeterminada, son inmutables, lo que significa que el valor de una variable no se puede cambiar una vez que se ha establecido. Para crear una variable que deseemos cambiar en algún momento en el futuro, usamos la palabra clave **mut**. Definir una variable con esta palabra clave significa que el valor almacenado en ella puede cambiar.

```rust
// compiler will throw error
let age = 33;
age = 34;

// this is allowed
let mut mutable_age = 33;
mutable_age = 34;
```

El compilador de Rust garantiza que las variables inmutables realmente no pueden cambiar para que no tengas que hacer un seguimiento de ella tu mismo. Esto hace que tu código sea más fácil de entender y simplifica la depuración.

### Structs
Una estructura es un tipo de datos personalizado que te permite agrupar y nombrar varios valores relacionados que conforman un grupo significativo. Cada pieza de datos en una estructura puede ser de diferentes tipos y cada una tiene un nombre asociado. Estas piezas de datos se llaman *campos*. Se comportan de manera similar a las propiedades en otros lenguajes.

```rust
struct User {
    active: bool,
    email: String,
    age: u64
}
```

Para utilizar una estructura después de haberla definido, creamos una instancia de esa estructura especificando valores concretos para cada uno de los campos.

```rust
let mut user1 = User {
    active: true,
    email: String::from("test@test.com"),
    age: 36
};
```

Para obtener o establecer un valor específico de una estructura, usamos la notación de punto.

```rust
user1.age = 37;
```

### Enumeraciones
Las enumeraciones (o Enums) son una estructura de datos que te permite definir un tipo enumerando sus variantes posibles. Un ejemplo de una enum puede verse así:

```rust
enum LightStatus {
    On,
    Off
}
```

La enumeración **LightStatus** tiene dos variantes posibles en esta situación: está **encendida** o **apagada**.

También puedes incrustar valores en las variantes de la enumeración, similar a agregar campos a una estructura.

```rust
enum LightStatus {
    On {
        color: String
    },
    Off
}

let light_status = LightStatus::On { color: String::from("red") };
```

En este ejemplo, establecer una variable en la variante **On** de **LightStatus** requiere también establecer el valor del **color** .

### Sentencias match
Las sentencias match son muy similares a las sentencias **switch** en **C/C++** . La sentencia match te permite comparar un valor con una serie de patrones y luego ejecutar código basado en el patrón que coincide con el valor. Los patrones pueden ser hechos de valores literales, nombres de variables, comodines y más. La sentencia match debe incluir todos los escenarios posibles, de lo contrario el código no se compilará.

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
La palabra clave **impl** se utiliza en Rust para definir las implementaciones de un tipo. Las funciones y las constantes pueden definirse en una implementación.

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

La función **boo** aquí solo se puede llamar en el tipo en sí mismo en lugar de en una instancia del tipo, de esta manera:

```rust
Example::boo();
```

Mientras tanto, la función **answer* requiere una instancia mutable de **Example** y se puede llamar con sintaxis de punto:

```rust
let mut example = Example { number: 3 };
example.answer();
```

### Rasgos y atributos
En esta etapa no estarás creando tus propios rasgos o atributos, por lo que no proporcionaremos una explicación detallada de ninguno de ellos. Sin embargo, estarás usando el atributo **derive** y algunos rasgos proporcionados por la biblioteca **borsh**, por lo que es importante que tengas una comprensión general de cada uno.
Los rasgos describen una interfaz abstracta que los tipos pueden implementar. Si un rasgo define una función **bark()** y un tipo adopta ese rasgo, el tipo debe implementar la función **bark()** 
Los *atributos* agrega metadatos a un tipo y se pueden utilizar para muchos propósitos diferentes.
Cuando agregas el *atributo* **derive** a un tipo y proporcionas uno o varios rasgos compatibles, se genera código en el backend para implementar automáticamente los rasgos para ese tipo. Proporcionaremos un ejemplo concreto de esto en breve.

## Representando las instrucciones como un tipo de datos de Rust
Ahora que hemos cubierto los conceptos básicos de Rust, apliquémoslos a los programas de Solana.

Con mucha frecuencia, los programas tendrán más de una función. Por ejemplo, puede tener un programa que actúa como el backend de una aplicación de toma de notas. Asuma que este programa acepta instrucciones para crear una nueva nota, actualizar una nota existente y eliminar una nota existente.

Dado que las instrucciones tienen tipos discretos, suelen ser una excelente opción para un tipo de datos de enumeración.

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

Observa que cada variante del **NoteInstruction** viene con datos incrustados que serán utilizados por el programa para realizar las tareas de crear, actualizar y eliminar una nota, respectivamente.

## Deserializar los datos de instrucción
Los datos de instrucción se pasan al programa como una matriz de bytes, por lo que necesitas una forma de convertir de manera determinística esa matriz en una instancia del tipo de enumeración de instrucción.

En los módulos anteriores, utilizamos Borsh para la serialización y deserialización del lado del cliente. Para usar Borsh del lado del programa, usamos la biblioteca **borsh** . Esta biblioteca proporciona rasgos para **BorshDeserialize** y **BorshSerialize** que puedes aplicar a tus tipos usando el atributo **derive**.

Para hacer que la deserialización de los datos de instrucción sea sencilla, puedes crear una estructura que represente los datos y usar el atributo **derive** para aplicar el rasgo **BorshDeserialize** a la estructura. Esto implementa los métodos definidos en **BorshDeserialize**, incluyendo el método **try_from_slice** que usaremos para deserializar los datos de instrucción.

Recuerda, la estructura en sí misma debe coincidir con la estructura de los datos en la matriz de bytes.

```rust
#[derive(BorshDeserialize)]
struct NoteInstructionPayload {
    id: u64,
    title: String,
    body: String
}
```

Una vez creada esta estructura, puedes crear una implementación para tu enumeración de instrucciones para manejar la lógica asociada con la deserialización de los datos de instrucción. Es común ver esto hecho dentro de una función llamada **unpack** que acepta los datos de instrucción como un argumento y devuelve la instancia adecuada de la enumeración con los datos deserializados.

Es una práctica estándar estructurar tu programa para esperar que el primer byte (o otro número fijo de bytes) sea un identificador para determinar qué instrucción debe ejecutar el programa. Esto podría ser un número entero o un identificador de cadena. Para este ejemplo, usaremos el primer byte y mapearemos los números 0, 1 y 2 a las instrucciones create, update y delete, respectivamente.

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

Hay mucho en este ejemplo, así que vamos paso a paso:

1. Esta función comienza utilizando la función **split_first** en el parámetro de **entrada** para devolver una tupla. El primer elemento **variant** , es el primer byte de la matriz de bytes y el segundo elemento **rest**, es el resto de la matriz de bytes.
2. La función luego utiliza el método ** try_from_slice** en **NoteInstructionPayload** para deserializar el resto de la matriz de bytes en una instancia de **NoteInstructionPayload** llamada **payload** .
3. Finalmente, la función utiliza una sentencia **match** en **variant** para crear y devolver la instancia de enumeración adecuada utilizando la información de **payload** .

Ten en cuenta que hay sintaxis de Rust en esta función que aún no hemos explicado. Las funciones **ok_or** y **unwrap** se utilizan para el manejo de errores y se discutirán en detalle en otra lección.

## Lógica del programa
Con una forma de deserializar los datos de instrucción en un tipo de Rust personalizado, luego puedes usar el flujo de control apropiado para ejecutar diferentes rutas de código en tu programa en función de la instrucción que se pase en el punto de entrada de tu programa.

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

Para programas simples donde solo hay una o dos instrucciones para ejecutar, puede ser aceptable escribir la lógica dentro de la instrucción de coincidencia. Para programas con muchas instrucciones diferentes para comparar, su código será mucho más legible si la lógica de cada instrucción se escribe en una función separada y simplemente se llama desde dentro de la instrucción de coincidencia.

## La estructura del archivo del programa
La *lección "Hola mundo"* fue lo suficientemente simple como para poder confinarla en un solo archivo. Pero a medida que aumenta la complejidad de un programa, es importante mantener una estructura de proyecto que siga siendo legible y extensible. Esto implica encapsular el código en funciones y estructuras de datos como hemos hecho hasta ahora. Pero también implica agrupar el código relacionado en archivos separados.
Por ejemplo, una buena parte del código con el que hemos trabajado hasta ahora tiene que ver con la definición y deserialización de instrucciones. Ese código debería vivir en su propio archivo en lugar de escribirse en el mismo archivo que el punto de entrada. Al hacerlo, tendríamos 2 archivos, uno con el punto de entrada del programa y el otro con el código de instrucción:
- lib.rs
- instruction.rs
Una vez que comience a dividir su programa de esta manera, deberá asegurarse de registrar todos los archivos en una ubicación central. Haremos esto en **lib.rs**. *Debe registrar cada archivo en su programa de esta manera* .

```rust
// This would be inside lib.rs
pub mod instruction;
```

Además, cualquier declaración que desee que esté disponible a través de declaraciones use en otros archivos deberá tener el prefijo palabra clave **pub**:

# Demostración
Para la demostración de esta lección, construiremos la primera mitad del programa de Revisión de Películas con el que trabajamos en el Módulo 1. Este programa almacena las reseñas de películas enviadas por los usuarios.

Por ahora, nos centraremos en deserializar los datos de instrucción. La próxima lección se centrará en la segunda mitad de este programa.

### 1. Punto de entrada
Volveremos a usar [Solana Playground](https://beta.solpg.io) para construir este programa. Solana Playground guarda el estado en su navegador, por lo que todo lo que hizo en la lección anterior puede seguir allí. Si es así, limpiemos todo del archivo **lib.rs** actual.

Dentro de lib.rs, vamos a importar las siguientes bibliotecas y a definir dónde queremos que sea el punto de entrada del programa con la macro de **entrypoint**.

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

### 2. Deserializar los datos de instrucción
Antes de continuar con la lógica del procesador, debemos definir nuestras instrucciones soportadas e implementar nuestra función de deserialización.

Para mayor claridad, creemos un nuevo archivo llamado **instruction.rs**. Dentro de este nuevo archivo, agregue declaraciones **use** para **BorshDeserialize** y **ProgramError** , luego cree una enumeración **MovieInstruction** con una variante **AddMovieReview**. Esta variante debería tener valores incrustados para **título**, **calificación** y **descripción**.

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

A continuación, defina una estructura **MovieReviewPayload** . Este actuará como un tipo intermedio para la deserialización, por lo que debería usar la macro de atributo **derive** para proporcionar una implementación predeterminada para el trait **BorshDeserialize** .

```rust
#[derive(BorshDeserialize)]
struct MovieReviewPayload {
    title: String,
    rating: u8,
    description: String
}
```

Finalmente, cree una implementación para la enumeración **MovieInstruction** que defina e implemente una función llamada **unpack** que toma una matriz de bytes como argumento y devuelve un tipo **Result**. Esta función debería:
1. Utilizar la función **split_first** para dividir el primer byte de la matriz del resto de la matriz
2. Deserializar el resto de la matriz en una instancia de **MovieReviewPayload**
3. Utilizar una instrucción de **coincidencia**  para devolver la variante **AddMovieReview** de **MovieInstruction** si el primer byte de la matriz era 0 o devolver un error de programa en caso contrario.

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

## 3. Lógica del programa
Con la deserialización de instrucciones manejada, podemos volver al archivo **lib.rs** para manejar alguna de nuestra lógica de programa.

Recuerde, ya que agregamos código a un archivo diferente, debemos registrarlo en el archivo **lib.rs** usando **pub modinstruction;** . Luego, podemos agregar una declaración **use** para llevar el tipo **MovieInstruction** al ámbito.

```rust
pub mod instruction;
use instruction::{MovieInstruction};
```

A continuación, definamos una nueva función **add_movie_review** que toma como argumentos **program_id**, **accounts**, **title**, **rating** y **description** . También debería devolver una instancia de **ProgramResult**. Dentro de esta función, simplemente registremos nuestros valores por ahora y revisaremos el resto de la implementación de la función en la próxima lección.

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

Con eso hecho, podemos llamar a **add_movie_review** desde **process_instruction** (la función que establecimos como nuestro punto de entrada). Para pasar todos los argumentos necesarios a la función, primero deberemos llamar al **unpack** que creamos en **MovieInstruction**, luego usar una instrucción de **coincidencia** para asegurarnos de que la instrucción que hemos recibido es la variante **AddMovieReview** .

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

Y así, ¡tu programa debería ser lo suficientemente funcional como para registrar los datos de instrucción pasados cuando se envía una transacción!
Construye y despliega tu programa desde Solana Program al igual que en la última lección. Si no has cambiado el ID del programa desde la última lección, se desplegará automáticamente en el mismo ID. Si desea que tenga una dirección separada, puede generar un nuevo ID de programa desde el playground antes de desplegar.

Puedes probar tu programa enviando una transacción con los datos de instrucción correctos. Para eso, no dudes en usar [este script](https://github.com/Unboxed-Software/solana-movie-client) o el [frontend](https://github.com/Unboxed-Software/solana-movie-frontend) que construimos en la *lección de Serializar datos de instrucción personalizados* . En ambos casos, asegúrate de copiar y pegar el ID del programa en el área apropiada del código fuente para asegurarte de que estás probando el programa correcto.
Si necesitas pasar más tiempo con esta demostración antes de continuar, ¡por favor hazlo! También puedes echar un vistazo al [código de solución](https://beta.solpg.io/62aa9ba3b5e36a8f6716d45b) del programa si te quedas atascado.

#Reto
Para el desafío de esta lección, intente replicar el programa Student Intro del Módulo 1. Recuerde que creamos una aplicación frontend que permite a los estudiantes presentarse. El programa toma el nombre de un usuario y un mensaje corto como **datos de instrucción** y crea una cuenta para almacenar los datos en la cadena.
Usando lo que ha aprendido en esta lección, construya el programa Student Intro hasta el punto en que pueda imprimir el **nombre** y el **mensaje** proporcionados por el usuario en los registros del programa cuando se invoca el programa.
Puede probar su programa construyendo el [frontend](https://beta.solpg.io/62aa9ba3b5e36a8f6716d45b) que creamos en la *lección Serializar datos de instrucción personalizados* y luego revisando los registros del programa en Solana Explorer. Recuerde reemplazar el ID del programa en el código frontend con el que ha desplegado.
Intente hacerlo de forma independiente si puede. Pero si te quedas atascado, no dudes en consultar el [código de solución](https://beta.solpg.io/62b0ce53f6273245aca4f5b0).
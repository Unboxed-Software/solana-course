---
title: Crear un Programa Básico, Parte 3 - Objetivos Básicos de Seguridad y Validación
objectives:
- Explicar la importancia de "pensar como un atacante"
- Comprender las prácticas básicas de seguridad
- Realizar comprobaciones del propietario
- Realizar comprobaciones del firmante
- Validar cuentas pasadas al programa
- Realizar validación de datos básicos
---

# TL;DR

- **Pensar como un atacante** significa preguntar "¿Cómo rompo esto?"
- Realice **cheques de propietario** para asegurarse de que la cuenta proporcionada sea propiedad de la clave pública que espera, por ejemplo, asegurándose de que una cuenta que espera que sea un PDA sea propiedad de `program_id`
- Realizar **cheques de firmante** para garantizar que cualquier modificación de la cuenta haya sido firmada por la parte o partes adecuadas
- **Validación de la cuenta** implica garantizar que las cuentas proporcionadas sean las cuentas que espera que sean, por ejemplo, derivar PDA con las semillas esperadas para asegurarse de que la dirección coincida con la cuenta proporcionada
- **Validación de datos** implica garantizar que cualquier dato proporcionado cumpla con los criterios requeridos por el programa

# Descripción general

En las dos últimas lecciones trabajamos juntos en la construcción de un programa de revisión de películas. El resultado final es bastante cool! Es emocionante conseguir que algo funcione en un nuevo entorno de desarrollo.

El desarrollo adecuado del programa, sin embargo, no termina en "hacer que funcione". “Es importante pensar en los posibles puntos de falla en su código para mitigarlos. Los puntos de falla son donde el comportamiento indeseable en su código podría ocurrir. Ya sea que el comportamiento indeseable ocurra debido a que los usuarios interactúan con su programa de maneras inesperadas o malos actores que intentan explotar intencionalmente su programa, anticipar puntos de falla es esencial para asegurar el desarrollo del programa.

Recuerde,**no tiene control sobre las transacciones que se enviarán a su programa una vez que se haya implementado**. Solo puede controlar cómo los maneja su programa. Si bien esta lección está lejos de ser una descripción general completa de la seguridad del programa, cubriremos algunas de las trampas básicas a tener en cuenta.

## Piensa como un atacante

[Neodyme](https://workshop.neodyme.io/) hizo una presentación en Breakpoint 2021 titulada "Think Like An Attacker: Bringing Smart Contracts to Their Break(ing) Point." Si hay una cosa que te llevas de esta lección, es que debes pensar como un atacante.

En esta lección, por supuesto, no podemos cubrir todo lo que podría salir mal con sus programas. En última instancia, cada programa tendrá diferentes riesgos de seguridad asociados con él. Si bien la comprensión de los escollos comunes es *esencial* para diseñar buenos programas, es *insuficiente* para implementar los seguros. Para tener la cobertura de seguridad más amplia posible, debe acercarse a su código con la mentalidad correcta.

Como Neodyme mencionó en su presentación, la mentalidad correcta requiere pasar de la pregunta "¿Esto está roto?" a "¿Cómo rompo esto? Este es el primer y más esencial paso para entender qué es *realmente lo hace* tu código en lugar de para qué lo escribiste.

### Todos los programas se pueden romper

No es una cuestión de "si".

Más bien, es una cuestión de "cuánto esfuerzo y dedicación se necesitaría".

Nuestro trabajo como desarrolladores es cerrar tantos agujeros como sea posible y aumentar el esfuerzo y la dedicación necesarios para romper nuestro código. Por ejemplo, en el programa Movie Review que construimos juntos en las últimas dos lecciones, escribimos código para crear nuevas cuentas para almacenar reseñas de películas. Sin embargo, si echamos un vistazo más de cerca al código, notaremos cómo el programa también facilita una gran cantidad de comportamiento no intencional que podríamos detectar fácilmente preguntando "¿Cómo rompo esto?" Profundizaremos en algunos de estos problemas y cómo solucionarlos en esta lección, pero recuerde que memorizar algunas trampas no es suficiente. Depende de usted cambiar su mentalidad hacia la seguridad.

## Gestión de errores

Antes de sumergirnos en algunas de las trampas de seguridad comunes y cómo evitarlas, es importante saber cómo usar los errores en su programa. Si bien su código puede manejar algunos problemas con gracia, otros problemas requerirán que su programa detenga la ejecución y devuelva un error de programa.

### Cómo crear errores

Si bien la `solana_program` caja proporciona una `ProgramError` enumeración con una lista de errores genéricos que podemos usar, a menudo será útil crear la suya propia. Sus errores personalizados podrán proporcionar más contexto y detalles mientras depura su código.

Podemos definir nuestros propios errores creando un tipo de enumeración que enumere los errores que queremos usar. Por ejemplo, `NoteError` contiene variantes `Forbidden` y `InvalidLength`. La enum se convierte en un `Error` tipo de óxido mediante el uso de la macro de `derive` atributos para implementar el `Error` rasgo de la `thiserror` biblioteca. Cada tipo de error también tiene su propia `#[error("...")]` notación. Esto le permite proporcionar un mensaje de error para cada tipo de error en particular.


```rust
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Error)]
pub enum NoteError {
    #[error("Wrong note owner")]
    Forbidden,

    #[error("Text is too long")]
    InvalidLength,
}
```

### Cómo devolver los errores

El compilador espera que los errores devueltos por el programa sean de tipo `ProgramError` de la `solana_program` caja. Eso significa que no podremos devolver nuestro error personalizado a menos que tengamos una forma de convertirlo en este tipo. La siguiente implementación maneja la conversión entre nuestro error personalizado y el `ProgramError` tipo.


```rust
impl From<NoteError> for ProgramError {
    fn from(e: NoteError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Para devolver el error personalizado del programa, simplemente use el `into()` método para convertir el error en una instancia de `ProgramError`.


```rust
if pda != *note_pda.key {
    return Err(NoteError::Forbidden.into());
}
```

## Controles básicos de seguridad

Si bien estos no protegerán completamente su programa, hay algunos controles de seguridad que puede tener en cuenta para llenar algunos de los vacíos más grandes en su código:

- Comprobaciones de propiedad: se utilizan para verificar que una cuenta es propiedad del programa.
- Cheques de firmante: se utilizan para verificar que una cuenta ha firmado una transacción
- Validación general de la cuenta: se utiliza para verificar que una cuenta es la cuenta esperada
- Validación de datos: se utiliza para verificar las entradas proporcionadas por un usuario

### Comprobaciones de propiedad

Una verificación de propiedad verifica que una cuenta es propiedad de la clave pública esperada. Usemos el ejemplo de la aplicación para tomar notas que hemos mencionado en lecciones anteriores. En esta aplicación, los usuarios pueden crear, actualizar y eliminar notas que el programa almacena en cuentas PDA.

Cuando un usuario invoca la `update` instrucción, también proporciona una `pda_account`. Suponemos que el proporcionado `pda_account` es para la nota particular que desean actualizar, pero el usuario puede ingresar los datos de instrucción que desee. Incluso podrían enviar datos que coincidan con el formato de datos de una cuenta de notas, pero que no hayan sido creados por el programa de toma de notas. Esta vulnerabilidad de seguridad es una forma potencial de introducir código malicioso.

La forma más sencilla de evitar este problema es comprobar siempre que el propietario de una cuenta es la clave pública que esperas que sea. En este caso, esperamos que la cuenta de la nota sea una cuenta PDA propiedad del propio programa. Cuando este no es el caso, podemos informarlo como un error en consecuencia.


```rust
if note_pda.owner != program_id {
    return Err(ProgramError::InvalidNoteAccount);
}
```

Como nota al margen, usar PDA siempre que sea posible es más seguro que confiar en cuentas de propiedad externa, incluso si son propiedad del firmante de la transacción. Las únicas cuentas sobre las que el programa tiene control total son las cuentas PDA, lo que las hace más seguras.

### Comprobaciones del firmante

Un cheque de firmante simplemente verifica que las partes correctas hayan firmado una transacción. En la aplicación para tomar notas, por ejemplo, queremos verificar que el creador de la nota firmó la transacción antes de procesar la `update` instrucción. De lo contrario, cualquiera puede actualizar las notas de otro usuario simplemente pasando la clave pública del usuario como inicializador.


```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validación general de la cuenta

Además de verificar a los firmantes y propietarios de las cuentas, es importante asegurarse de que las cuentas proporcionadas sean lo que su código espera que sean. Por ejemplo, desea validar que la dirección de una cuenta PDA proporcionada se puede derivar con las semillas esperadas. Esto asegura que sea la cuenta que esperas que sea.

En el ejemplo de la aplicación para tomar notas, eso significaría asegurarse de que puede derivar un PDA coincidente utilizando la clave pública del creador de la nota y el ID como semillas (eso es lo que suponemos que se usó al crear la nota). De esa manera, un usuario no podría pasar accidentalmente en una cuenta PDA por la nota incorrecta o, lo que es más importante, que el usuario no está pasando en una cuenta PDA que representa la nota de otra persona por completo.


```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);

if pda != *note_pda.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument)
}
```

## Validación de datos

Al igual que la validación de cuentas, también debe validar los datos proporcionados por el cliente.

Por ejemplo, puede tener un programa de juego donde un usuario puede asignar puntos de atributos de carácter a varias categorías. Es posible que tenga un límite máximo en cada categoría de 100, en cuyo caso querrá verificar que la asignación existente de puntos más la nueva asignación no exceda el máximo.


```rust
if character.agility + new_agility > 100 {
    msg!("Attribute points cannot exceed 100");
    return Err(AttributeError::TooHigh.into())
}
```

O bien, el personaje puede tener una asignación de puntos de atributo que puede asignar y desea asegurarse de que no excedan esa asignación.


```rust
if attribute_allowance < new_agility {
    msg!("Trying to allocate more points than allowed");
    return Err(AttributeError::ExceedsAllowance.into())
}
```

Sin estas comprobaciones, el comportamiento del programa diferiría de lo que usted espera. En algunos casos, sin embargo, es algo más que un problema de comportamiento indefinido. A veces, la falta de validación de datos puede resultar en lagunas de seguridad que son financieramente devastadoras.

Por ejemplo, imagine que el carácter al que se hace referencia en estos ejemplos es un NFT. Además, imagine que el programa permite que el NFT sea apostado para ganar recompensas simbólicas proporcionales al número de puntos de atributo del NFT. La falta de implementación de estas comprobaciones de validación de datos permitiría a un mal actor asignar un número obscenamente alto de puntos de atributo y drenar rápidamente su tesoro de todas las recompensas que estaban destinadas a distribuirse de manera más uniforme entre un grupo más grande de participantes.

### Desbordamiento y subdesbordamiento enteros

Los enteros de óxido tienen tamaños fijos. Esto significa que solo pueden admitir un rango específico de números. Una operación aritmética que da como resultado un valor más alto o más bajo que el que admite el rango hará que el valor resultante se envuelva. Por ejemplo, a `u8` solo admite números 0-255, por lo que el resultado de la suma que sería 256 sería realmente 0, 257 sería 1, etc.

Esto siempre es importante tenerlo en cuenta, pero especialmente cuando se trata de cualquier código que represente un valor real, como depositar y retirar tokens.

Para evitar el desbordamiento y el desbordamiento de enteros:

1. Tener lógica en su lugar que garantice que *no puede* ocurra un desbordamiento o subdesbordamiento o
2. Usa las matemáticas marcadas como `checked_add` en lugar de `+`

    ```rust
    let first_int: u8 = 5;
    let second_int: u8 = 255;
    let sum = first_int.checked_add(second_int);
    ```

# Demostración

Practiquemos junto con el programa Movie Review en el que hemos trabajado en lecciones anteriores. No se preocupe si solo está saltando a esta lección sin haber hecho la lección anterior: debería ser posible seguir cualquier camino.

Como actualización, el programa Movie Review permite a los usuarios almacenar reseñas de películas en cuentas PDA. En la última lección, terminamos de implementar la funcionalidad básica de añadir una reseña de película. Ahora, agregaremos algunos controles de seguridad a la funcionalidad que ya hemos creado y agregaremos la capacidad de actualizar una revisión de película de manera segura.

Al igual que antes, vamos [Parque infantil Solana](https://beta.solpg.io/) a utilizar  para escribir, construir y desplegar nuestro código.

## 1. Obtener el código de inicio

Para empezar, puedes encontrar el código de inicio[here](https://beta.solpg.io/62b552f3f6273245aca4f5c9). Si has estado siguiendo junto con las demostraciones de Movie Review, notarás que hemos refactorizado nuestro programa.

El código de inicio refactorizado es casi el mismo que antes. Dado que `lib.rs` se estaba volviendo bastante grande y difícil de manejar, hemos separado su código en 3 archivos: `lib.rs` `entrypoint.rs`,, y `processor.rs`. `lib.rs` ahora *solo* registra los módulos del código, `entrypoint.rs` *solo* define y establece el punto de entrada del programa y `processor.rs` maneja la lógica del programa para procesar instrucciones. También hemos añadido un `error.rs` archivo en el que vamos a definir errores personalizados. La estructura completa del archivo es la siguiente:

- **lib.rs** - Módulos de registro
- punto de**entrypoint.rs -** entrada al programa
- **instruction.rs -** serializar y deserializar datos de instrucción
- lógica de**processor.rs -** programa para procesar instrucciones
- **state.rs -** serializar y deserializar el estado
- errores de programa**error.rs -** personalizados

Además de algunos cambios en la estructura de archivos, hemos actualizado una pequeña cantidad de código que permitirá que esta demostración se centre más en la seguridad sin tener que escribir una placa de caldera innecesaria.

Dado que permitiremos actualizaciones a las reseñas de películas, también cambiamos la `add_movie_review` función `account_len` (ahora en `processor.rs`). En lugar de calcular el tamaño de la revisión y configurar la longitud de la cuenta para que sea tan grande como sea necesario, simplemente vamos a asignar 1000 bytes a cada cuenta de revisión. De esta manera, no tenemos que preocuparnos por reasignar el tamaño o volver a calcular el alquiler cuando un usuario actualiza su revisión de la película.

Pasamos de esto:

```rust
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
```

A esto:

```rust
let account_len: usize = 1000;
```

El [realloc](https://docs.rs/solana-sdk/latest/solana_sdk/account_info/struct.AccountInfo.html#method.realloc)  método fue habilitado recientemente por Solana Labs, que le permite cambiar dinámicamente el tamaño de sus cuentas. No usaremos este método para esta demostración, pero es algo a tener en cuenta.

Finalmente, también hemos implementado algunas funcionalidades adicionales para nuestra `MovieAccountState` estructura en el `state.rs` uso de la `impl` palabra clave.

Para nuestras reseñas de películas, queremos la capacidad de verificar si una cuenta ya se ha inicializado. Para ello, creamos una `is_initialized` función que comprueba el `is_initialized` campo en la `MovieAccountState` estructura.

 `Sealed` es la versión de Solana del  `Sized` rasgo de Rust. Esto simplemente especifica que `MovieAccountState` tiene un tamaño conocido y proporciona algunas optimizaciones del compilador.


```rust
// inside state.rs
impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Antes de seguir adelante, asegúrese de tener una comprensión sólida del estado actual del programa. Mire a través del código y pase algún tiempo pensando en cualquier punto que sea confuso para usted. Puede ser útil comparar el código de inicio con el[código de solución de la lección anterior](https://beta.solpg.io/62b23597f6273245aca4f5b4).

## 2. Errores personalizados

Comencemos escribiendo nuestros errores de programa personalizados. Necesitaremos errores que podamos usar en las siguientes situaciones:

- La instrucción de actualización se ha invocado en una cuenta que aún no se ha inicializado
- El PDA proporcionado no coincide con el PDA esperado o derivado
- Los datos de entrada son más grandes de lo que permite el programa
- La calificación proporcionada no cae en el rango 1-5

El código de inicio incluye un `error.rs` archivo vacío. Abra ese archivo y añada errores para cada uno de los casos anteriores.


```rust
// inside error.rs
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReviewError{
    // Error 0
    #[error("Account not initialized yet")]
    UninitializedAccount,
    // Error 1
    #[error("PDA derived does not equal PDA passed in")]
    InvalidPDA,
    // Error 2
    #[error("Input data exceeds max length")]
    InvalidDataLength,
    // Error 3
    #[error("Rating greater than 5 or less than 1")]
    InvalidRating,
}

impl From<ReviewError> for ProgramError {
    fn from(e: ReviewError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Tenga en cuenta que además de añadir los casos de error, también hemos añadido la implementación que nos permite convertir nuestro error en un `ProgramError` tipo según sea necesario.

Antes de seguir adelante, vamos a `ReviewError` poner en alcance en el `processor.rs`. Utilizaremos estos errores en breve cuando agreguemos nuestros controles de seguridad.


```rust
// inside processor.rs
use crate::error::ReviewError;
```

## 3. Añadir controles de seguridad a `add_movie_review`

Ahora que tenemos errores que usar, vamos a implementar algunas comprobaciones de seguridad a nuestra `add_movie_review` función.

### Comprobación del firmante

Lo primero que debemos hacer es asegurarnos `initializer` de que la revisión también sea un firmante de la transacción. Esto garantiza que no pueda enviar reseñas de películas que se hagan pasar por otra persona. Pondremos este cheque justo después de iterar a través de las cuentas.


```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;

if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validación de la cuenta

A continuación, asegurémonos de que el `pda_account` pasado por el usuario es el `pda` que esperamos. Recordemos que derivamos el `pda` para una revisión de la película usando el `initializer` y `title` como semillas. Dentro de nuestra instrucción vamos a derivar la `pda` otra vez y luego comprobar si coincide con la `pda_account`. Si las direcciones no coinciden, devolveremos nuestro `InvalidPDA` error personalizado.


```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Validación de datos

Ahora vamos a realizar una validación de datos.

Comenzaremos asegurándonos de que `rating` caiga dentro de la escala de 1 a 5. Si la calificación proporcionada por el usuario fuera de este rango, le devolveremos nuestro `InvalidRating` error personalizado.


```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}
```

A continuación, verifiquemos que el contenido de la revisión no exceda los 1000 bytes que hemos asignado para la cuenta. Si el tamaño supera los 1000 bytes, devolveremos nuestro `InvalidDataLength` error personalizado.


```rust
let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

Por último, vamos a comprobar si la cuenta ya se ha inicializado llamando a la `is_initialized` función que implementamos para nuestro `MovieAccountState`. Si la cuenta ya existe, devolveremos un error.


```rust
if account_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

En conjunto, la `add_movie_review` función debería verse algo como esto:


```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Adding movie review...");
    msg!("Title: {}", title);
    msg!("Rating: {}", rating);
    msg!("Description: {}", description);

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

    let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ProgramError::InvalidArgument)
    }

    if rating > 5 || rating < 1 {
        msg!("Rating cannot be higher than 5");
        return Err(ReviewError::InvalidRating.into())
    }

    let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
    if total_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    let account_len: usize = 1000;

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    invoke_signed(
        &system_instruction::create_account(
        initializer.key,
        pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[initializer.clone(), pda_account.clone(), system_program.clone()],
        &[&[initializer.key.as_ref(), title.as_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("PDA created: {}", pda);

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("borrowed account data");

    msg!("checking if movie account is already initialized");
    if account_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    account_data.title = title;
    account_data.rating = rating;
    account_data.description = description;
    account_data.is_initialized = true;

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}
```

## 4. Apoyar las actualizaciones de revisión de películas en `MovieInstruction`

Ahora que `add_movie_review` es más seguro, vamos a centrar nuestra atención en el apoyo a la capacidad de actualizar una revisión de la película.

Empecemos por actualizar `instruction.rs`. Comenzaremos añadiendo una `UpdateMovieReview` variante `MovieInstruction` que incluya datos incrustados para el nuevo título, calificación y descripción.


```rust
// inside instruction.rs
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
    }
}
```

La estructura de carga útil puede permanecer igual ya que, aparte del tipo de variante, los datos de instrucción son los mismos que los que utilizamos `AddMovieReview`.

Por último, en la `unpack` función tenemos que añadir `UpdateMovieReview` a la declaración de coincidencia.


```rust
// inside instruction.rs
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            1 => Self::UpdateMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

## 5. Definir `update_movie_review` función

Ahora que podemos desempaquetar nuestro  `instruction_data`  y determinar qué instrucción del programa ejecutar, podemos agregar `UpdateMovieReview` a la instrucción match en la  `process_instruction`  función en el `processor.rs` archivo.


```rust
// inside processor.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // unpack instruction data
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        // add UpdateMovieReview to match against our new data structure
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            // make call to update function that we'll define next
            update_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

A continuación, podemos definir la nueva  `update_movie_review` función. La definición debe tener los mismos parámetros que la definición de `add_movie_review`.


```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

}
```

## 6. Implementar `update_movie_review` función

Todo lo que queda ahora es completar la lógica para actualizar una reseña de película. Solo hagámoslo seguro desde el principio.

Al igual que la `add_movie_review` función, empecemos por iterar a través de las cuentas. Las únicas cuentas que necesitaremos son las dos primeras: `initializer` y `pda_account`.


```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Updating movie review...");

    // Get Account iterator
    let account_info_iter = &mut accounts.iter();

    // Get accounts
    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

}
```

### Comprobación de propiedad

Antes de continuar, vamos a implementar algunos controles de seguridad básicos. Comenzaremos con una verificación de propiedad `pda_account` para verificar que es propiedad de nuestro programa. Si no es así, devolveremos un `InvalidOwner` error.


```rust
if pda_account.owner != program_id {
    return Err(ProgramError::InvalidOwner)
}
```

### Comprobación del firmante

A continuación, vamos a realizar una verificación del firmante para verificar que la `initializer` de la instrucción de actualización también ha firmado la transacción. Dado que estamos actualizando los datos para una revisión de película, queremos asegurarnos de que el original `initializer` de la revisión haya aprobado los cambios firmando la transacción. Si `initializer` no ha firmado la transacción, le devolveremos un error.


```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validación de la cuenta

A continuación, comprobemos que el `pda_account` pasado por el usuario es el PDA que esperamos derivando el PDA usando `initializer` y `title` como semillas. Si las direcciones no coinciden, devolveremos nuestro `InvalidPDA` error personalizado. Implementaremos esto de la misma manera que lo hicimos en la `add_movie_review` función.


```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Desempaquetar `pda_account` y realizar validación de datos

Ahora que nuestro código garantiza que podemos confiar en las cuentas pasadas, desempaquetemos `pda_account` y realicemos una validación de datos. Empezaremos por desempaquetarlo `pda_account` y asignarlo a una variable mutable `account_data`.


```rust
msg!("unpacking state account");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("borrowed account data");
```

Ahora que tenemos acceso a la cuenta y sus campos, lo primero que tenemos que hacer es verificar que la cuenta ya ha sido inicializada. No se puede actualizar una cuenta no inicializada, por lo que el programa debe devolver nuestro `UninitializedAccount` error personalizado.


```rust
if !account_data.is_initialized() {
    msg!("Account is not initialized");
    return Err(ReviewError::UninitializedAccount.into());
}
```

A continuación, tenemos que validar el `rating`, `title`, y `description` los datos al igual que en la `add_movie_review` función. Queremos limitar la `rating` a una escala de 1 a 5 y limitar el tamaño total de la revisión a menos de 1000 bytes. Si la calificación proporcionada por el usuario está fuera de este rango, le devolveremos nuestro `InvalidRating` error personalizado. Si la evaluación es demasiado larga, te devolveremos el `InvalidDataLength` error personalizado.


```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}

let total_len: usize = 1 + 1 + (4 + account_data.title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

### Actualizar la cuenta de revisión de películas

Ahora que hemos implementado todos los controles de seguridad, finalmente podemos actualizar la cuenta de revisión de películas actualizándola `account_data` y volviendo a serializarla. En ese momento, podemos regresar `Ok` de nuestro programa.


```rust
account_data.rating = rating;
account_data.description = description;

account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

Ok(())
```

En conjunto, la `update_movie_review` función debe parecerse al fragmento de código a continuación. Hemos incluido algunos registros adicionales para mayor claridad en la depuración.


```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Updating movie review...");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

    if pda_account.owner != program_id {
      return Err(ProgramError::IllegalOwner)
    }

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("review title: {}", account_data.title);

    let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    msg!("checking if movie account is initialized");
    if !account_data.is_initialized() {
        msg!("Account is not initialized");
        return Err(ReviewError::UninitializedAccount.into());
    }

    if rating > 5 || rating < 1 {
        msg!("Invalid Rating");
        return Err(ReviewError::InvalidRating.into())
    }

    let update_len: usize = 1 + 1 + (4 + description.len()) + account_data.title.len();
    if update_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    msg!("Review before update:");
    msg!("Title: {}", account_data.title);
    msg!("Rating: {}", account_data.rating);
    msg!("Description: {}", account_data.description);

    account_data.rating = rating;
    account_data.description = description;

    msg!("Review after update:");
    msg!("Title: {}", account_data.title);
    msg!("Rating: {}", account_data.rating);
    msg!("Description: {}", account_data.description);

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}
```

## 7. Construir y actualizar

¡Estamos listos para construir y actualizar nuestro programa! Puede probar su programa enviando una transacción con los datos de instrucción correctos. Para eso, siéntase libre de usar esto[frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews).  Recuerde, para asegurarse de que está probando el programa correcto, deberá reemplazarlo `MOVIE_REVIEW_PROGRAM_ID` con su ID de programa en `Form.tsx` y `MovieCoordinator.ts`.

Si necesita más tiempo con este proyecto para sentirse cómodo con estos conceptos, eche un vistazo a la [código de solución](https://beta.solpg.io/62c8c6dbf6273245aca4f5e7) antes de continuar.

# Desafío

Ahora es su turno para construir algo de forma independiente mediante la construcción en la parte superior del programa de introducción del estudiante que ha utilizado en lecciones anteriores. Si no has estado siguiendo o no has guardado tu código desde antes, siéntete libre de usarlo[este código de inicio](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).

El programa Student Intro es un programa de Solana que permite a los estudiantes presentarse. El programa toma el nombre de un usuario y un mensaje corto como instruction_data y crea una cuenta para almacenar los datos en la cadena.

Usando lo que ha aprendido en esta lección, intente aplicar lo que ha aprendido al Programa de Introducción al Estudiante. El programa debe:

1. Añadir una instrucción que permita a los estudiantes actualizar su mensaje
2. Implementar los controles de seguridad básicos que hemos aprendido en esta lección

¡Intenta hacerlo de forma independiente si puedes! Pero si te quedas atascado, siéntete libre de hacer referencia a la[código de solución](https://beta.solpg.io/62c9120df6273245aca4f5e8). Tenga en cuenta que su código puede ser ligeramente diferente al código de la solución dependiendo de las comprobaciones que implemente y los errores que escriba. Una vez que completes el Módulo 3, ¡nos encantaría saber más sobre tu experiencia! Siéntase libre de compartir algunos comentarios rápidos[here](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%203), para que podamos seguir mejorando el curso.

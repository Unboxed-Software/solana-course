# CREAR UN PROGRAMA BASICO, PARTE 3- SEGURIDAD BASICA Y VALIDACION
## Objetivos de la lección:
*Al final de esta lección, podrás* :
- Explicar la importancia de "pensar como un atacante"
- Comprender las prácticas de seguridad básicas
- Realizar verificaciones de propietario
- Realizar verificaciones de firmante
- Validar las cuentas pasadas al programa
- Realizar validación de datos básica.

# TERMINOLOGIA
- *Pensar como un atacante* significa preguntar "¿Cómo lo rompo?"
- Realizar *verificaciones de propietario* para asegurarse de que la cuenta proporcionada es propiedad de la clave pública que esperas, por ejemplo, asegurando que una cuenta que esperas que sea un PDA es propiedad del **program_id**
- Realizar *verificaciones de firmante* para asegurarse de que cualquier modificación de cuenta ha sido firmada por la parte o partes correctas
- La *validación de cuenta* implica asegurarse de que las cuentas proporcionadas son las cuentas que esperas, por ejemplo, derivar PDAs con las semillas esperadas para asegurarse de que la dirección coincide con la cuenta proporcionada
- La *validación de datos* implica asegurarse de que cualquier dato proporcionado cumpla con los criterios requeridos por el programa

# Resumen
En las últimas dos lecciones, trabajamos juntos para construir un programa de revisión de películas. El resultado final es bastante impresionante! Es emocionante conseguir que algo funcione en un nuevo entorno de desarrollo. 
Sin embargo, el desarrollo de programas adecuado no termina en "hacerlo funcionar". Es importante pensar en los puntos de falla posibles en su código para mitigarlos. Los puntos de falla son donde el comportamiento indeseable en su código podría ocurrir potencialmente. Ya sea que el comportamiento indeseable ocurra debido a que los usuarios interactúan con su programa de manera inesperada o los actores malintencionados intentan explotar intencionalmente su programa, anticipar los puntos de falla es esencial para el desarrollo de programas seguros. 
Recuerde, **no tiene control sobre las transacciones que se enviarán a su programa una vez que esté desplegado** . Solo puede controlar cómo su programa maneja esas transacciones.
 Aunque esta lección está lejos de ser una visión general completa de la seguridad del programa, cubriremos algunos de los tramposos básicos a tener en cuenta.

## Pensar como un atacante
[Neodyme](https://workshop.neodyme.io) dio una presentación en Breakpoint 2021 titulada "Pensar como un atacante: llevando los contratos inteligentes al límite". Si hay algo que debes retener de esta lección, es que debes pensar como un atacante.
En esta lección, por supuesto, no podemos cubrir todo lo que podría salir mal con sus programas. En última instancia, cada programa tendrá riesgos de seguridad diferentes asociados con él. Aunque comprender los tramposos comunes es *esencial* para diseñar buenos programas, no es *suficiente* para desplegar programas seguros. Para tener la máxima cobertura de seguridad posible, debes abordar tu código con la mentalidad adecuada.
Como mencionó Neodyme en su presentación, la mentalidad adecuada requiere pasar de la pregunta "¿Está roto?" a "¿Cómo lo rompo?" Este es el primer y más esencial paso para entender lo que *realmente* hace tu código en lugar de lo que escribiste para que haga.

### Todos los programas pueden ser rotos
No es una cuestión de "si". 
Si no más bien "cuánto esfuerzo y dedicación se requiere". 
Nuestro trabajo como desarrolladores es cerrar tantos agujeros como sea posible y aumentar el esfuerzo y la dedicación necesarios para romper nuestro código. Por ejemplo, en el programa de revisión de películas que construimos juntos en las últimas dos lecciones, escribimos código para crear nuevas cuentas para almacenar las reseñas de las películas. Sin embargo, si analizamos más de cerca el código, notaremos cómo el programa también facilita una gran cantidad de comportamientos no intencionales que podríamos detectar fácilmente preguntándonos "¿Cómo lo rompo?" Abordaremos algunos de estos problemas y cómo solucionarlos en esta lección, pero recuerda que memorizar algunos tramposos no es suficiente. Dependerá de ti cambiar tu mentalidad hacia la seguridad.
## Manejo de errores
Antes de profundizar en algunos de los tramposos de seguridad comunes y cómo evitarlos, es importante saber cómo usar errores en su programa. Si bien su código puede manejar algunos problemas de manera elegante, otros problemas requerirán que su programa detenga la ejecución y devuelva un error de programa.
### Cómo crear errores
Aunque el crate **solana_program** proporciona una enumeración **ProgramError** con una lista de errores genéricos que podemos usar, a menudo será útil crear los tuyos. Tus errores personalizados podrán proporcionar más contexto y detalles mientras depuras tu código.

Podemos definir nuestros propios errores creando un tipo de enumeración que liste los errores que queremos usar. Por ejemplo, el **NoteError** contiene variantes **Forbidden** e **InvalidLength** . La enumeración se convierte en un tipo de **error** de Rust utilizando el atributo **derive** para implementar el trait **Error** de la biblioteca **thiserror** . Cada tipo de error también tiene su propia notación **#[error("...")]** . Esto te permite proporcionar una descripción detallada para cada error.

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

### Cómo devolver errores 
El compilador espera que los errores devueltos por el programa sean del tipo **ProgramError** del **crate solana_program** . Esto significa que no podremos devolver nuestro error personalizado a menos que tengamos una forma de convertirlo en este tipo. La implementación siguiente maneja la conversión entre nuestro error personalizado y el tipo **ProgramError**.

```rust
impl From<NoteError> for ProgramError {
    fn from(e: NoteError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Para devolver el error personalizado del programa, simplemente utilice el método **into()** para convertir el error en una instancia de **ProgramError**.

```rust
if pda != *note_pda.key {
    return Err(NoteError::Forbidden.into());
}
```

## Verificaciones de seguridad básicas:
Aunque estas no garantizarán la seguridad completa de su programa, hay algunas verificaciones de seguridad que puede tener en cuenta para cubrir algunos de los mayores vacíos en su código:
- Verificaciones de propiedad: se utilizan para verificar que una cuenta es propiedad del programa
- Verificaciones de firmante: se utilizan para verificar que una cuenta ha firmado una transacción
- Validación general de la cuenta: se utiliza para verificar que una cuenta es la cuenta esperada
- Validación de datos: se utiliza para verificar las entradas proporcionadas por un usuario

## Verificaciones de propiedad
Una verificación de propiedad verifica que una cuenta es propiedad de la clave pública esperada. Utilizaremos el ejemplo de la aplicación de toma de notas que hemos mencionado en lecciones anteriores. En esta aplicación, los usuarios pueden crear, actualizar y eliminar notas que son almacenadas por el programa en cuentas PDA.

Cuando un usuario invoca la instrucción de **actualización** , también proporciona una **pda_account** . Presuponemos que la **pda_account** proporcionada es para la revisión de la película particular que quieren actualizar, pero el usuario puede ingresar cualquier dato de instrucción que desee. Incluso podrían enviar datos que coinciden con el formato de datos de una cuenta de notas pero no también creados por el programa de toma de notas. Esta vulnerabilidad de seguridad es una forma potencial de introducir código malicioso.

La forma más sencilla de evitar este problema es siempre verificar que el propietario de una cuenta sea la clave pública que se espera. En este caso, esperamos que la cuenta de notas sea una cuenta PDA propiedad del programa en sí. Cuando esto no es el caso, podemos informarlo como un error de forma adecuada.

```rust
if note_pda.owner != program_id {
    return Err(ProgramError::InvalidNoteAccount);
}
```

Como nota al margen, usar PDAs siempre que sea posible es más seguro que confiar en cuentas propiedad externa, incluso si son propiedad del firmante de la transacción. Las únicas cuentas sobre las que el programa tiene un control completo son las cuentas PDA, lo que las hace las más seguras.

### Verificaciones de firmante
Una verificación de firmante simplemente verifica que las partes adecuadas hayan firmado una transacción. En la aplicación de toma de notas, por ejemplo, nos gustaría verificar que el creador de la nota firmó la transacción antes de procesar la instrucción de **actualización** . De lo contrario, cualquier persona puede actualizar las notas de otro usuario simplemente pasando la clave pública del usuario como inicializador.

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validación general de la cuenta
Además de verificar los firmantes y propietarios de las cuentas, es importante asegurarse de que las cuentas proporcionadas son las que su código espera. Por ejemplo, desearía validar que la dirección de una cuenta PDA proporcionada se puede derivar con las semillas esperadas. Esto asegura que es la cuenta que esperas.

En el ejemplo de la aplicación de toma de notas, eso significaría asegurarse de que se puede derivar una PDA coincidente utilizando el **inicializador** y el **título** como semillas (eso es lo que asumimos que se utilizó al crear la nota). De esa manera, un usuario no podría pasar accidentalmente una cuenta PDA para la nota equivocada o, lo que es más importante, el usuario no está pasando una cuenta PDA que representa completamente la nota de otra persona.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);

if pda != *note_pda.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument)
}
```

## Validación de datos
Al igual que la validación de cuentas, también debe validar cualquier dato proporcionado por el cliente.

Por ejemplo, puede tener un programa de juego donde un usuario puede asignar puntos de atributos de personajes a varias categorías. Puede tener un límite máximo en cada categoría de 100, en cuyo caso desearía verificar que la asignación existente de puntos más la nueva asignación no exceda el máximo.

```rust
if character.agility + new_agility > 100 {
    msg!("Attribute points cannot exceed 100");
    return Err(AttributeError::TooHigh.into())
}
```

O también, el personaje puede tener un límite de puntos de atributos que pueden asignar y desea asegurarse de que no excedan ese límite.

```rust
if attribute_allowance > new_agility {
    msg!("Trying to allocate more points than allowed");
    return Err(AttributeError::ExceedsAllowance.into())
}
```

Sin estas comprobaciones, el comportamiento del programa sería diferente de lo que espera. En algunos casos, sin embargo, es más que solo un problema de comportamiento no definido. A veces, la falta de validación de datos puede resultar en lagunas de seguridad que son financieramente devastadoras.

Por ejemplo, imagina que el personaje mencionado en estos ejemplos es un NFT. Además, imagina que el programa permite que el NFT sea apostado para ganar recompensas de tokens proporcionales al número de puntos de atributos del NFT. La falta de implementar estas comprobaciones de validación de datos permitiría a un mal actor asignar un número desproporcionado de puntos de atributos y vaciar rápidamente su tesoro de todas las recompensas que debían ser repartidas de forma más equitativa entre una mayor cantidad de apostadores.

### Desbordamiento e infrautilización de enteros
Los enteros de Rust tienen tamaños fijos. Esto significa que solo pueden soportar un rango específico de números. Una operación aritmética que resulte en un valor superior o inferior al que es soportado por el rango causará que el valor resultante se envuelva. Por ejemplo, un **u8** solo admite números de 0 a 255, por lo que el resultado de la suma que sería 256 en realidad sería 0, 257 sería 1, etc.

Es importante tenerlo en cuenta siempre, pero especialmente cuando se trata con cualquier código que representa un valor verdadero, como depositar y retirar tokens.

Para evitar el desbordamiento y el subdesbordamiento de enteros, o bien:
1. Tener lógica en su lugar que asegura que no puede ocurrir desbordamiento o subdesbordamiento, o 
2. Utilizar matemáticas comprobadas como **checked_add** en lugar de **+** .

```rust
let first_int: u8 = 5;
let second_int: u8 = 255;
let sum = first_int.checked_add(second_int);
```

# Demostración
Practiquemos juntos con el programa de revisión de películas en el que hemos trabajado en lecciones anteriores. No se preocupe si acaba de saltar a esta lección sin haber hecho la lección anterior, debería ser posible seguir adelante de cualquier manera.
Como recordatorio, el programa de revisión de películas permite a los usuarios almacenar revisiones de películas en cuentas PDA. En la última lección, terminamos de implementar la funcionalidad básica de agregar una revisión de película. Ahora, agregaremos algunas comprobaciones de seguridad a la funcionalidad que ya hemos creado y agregaremos la capacidad de actualizar una revisión de película de manera segura.
Al igual que antes, usaremos [Solana Playground](https://beta.solpg.io) para escribir, construir y desplegar nuestro código.

## 1.Obtener el código base
Para comenzar, puede encontrar el código base [aquí](https://beta.solpg.io/62b552f3f6273245aca4f5c9) . Si ha estado siguiendo las demos de revisión de películas, notará que hemos refactorizado nuestro programa.

El código base refactorizado es casi igual que antes. Dado que **lib.rs**  se estaba volviendo bastante grande e incómodo, hemos separado su código en 3 archivos: **lib.rs**, **entrypoint.rs** y **processor.rs** . **lib.rs** ahora solo registra los módulos del código, **entrypoint.rs** solo define y establece el punto de entrada del programa y **processor.rs** maneja la lógica del programa para procesar instrucciones. También hemos agregado un archivo **error.rs** donde definiremos errores personalizados. La estructura completa de archivos es la siguiente:

- **lib.rs** - registro de módulos
- **entrypoint.rs** - punto de entrada del programa
- **instruction.rs** - serializar y deserializar datos de instrucciones
- **processor.rs** - lógica del programa para procesar instrucciones
- **state.rs** - serializar y deserializar el estado
- **error.rs** - errores personalizados del programa

Además de algunos cambios en la estructura de archivos, hemos actualizado una pequeña cantidad de código que permitirá que esta demo se enfoque más en la seguridad sin tener que escribir un código de inicio innecesario.

Dado que permitiremos actualizaciones de las revisiones de las películas, también cambiamos **account_len** en la función **add_movie_review** (ahora en **processor.rs**). En lugar de calcular el tamaño de la revisión y establecer la longitud de la cuenta solo lo suficientemente grande como sea necesario, simplemente vamos a asignar 1000 bytes a cada cuenta de revisión. De esta manera, no tenemos que preocuparnos por reasignar el tamaño o volver a calcular el alquiler cuando un usuario actualiza su revisión de película.
Pasamos de esto:

```rust
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
```

A esto:

```rust
let account_len: usize = 1000;
```


El método [realloc](https://docs.rs/solana-sdk/latest/solana_sdk/account_info/struct.AccountInfo.html#method.realloc) recientemente ha sido habilitado por Solana Labs, lo que permite cambiar dinámicamente el tamaño de sus cuentas. No usaremos este método para esta demo, pero es algo a tener en cuenta.

Finalmente, también hemos implementado algunas funcionalidades adicionales para nuestra estructura **MovieAccountState** en **state.rs** usando la palabra clave **impl**.

Para nuestras revisiones de películas, queremos la capacidad de verificar si una cuenta ya ha sido inicializada. Para ello, creamos una función **is_initialized** que verifica el campo **is_initialized** en la estructura **MovieAccountState** .

**Sealed** es la versión de Solana de la característica Rust **Sized** . Esto simplemente especifica que **MovieAccountState** tiene un tamaño conocido y proporciona algunas optimizaciones del compilador.

```rust
// inside state.rs
impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Antes de continuar, asegúrese de tener una comprensión sólida del estado actual del programa. Echa un vistazo al código y dedica algún tiempo a pensar en cualquier punto que te resulte confuso. Puede ser útil comparar el código base con el [código de solución de la lección anterior](https://beta.solpg.io/62b23597f6273245aca4f5b4).
## 2. Errores personalizados
Comencemos escribiendo nuestros errores personalizados del programa. Necesitaremos errores que podamos usar en las siguientes situaciones:

- La instrucción de actualización se ha invocado en una cuenta que aún no se ha inicializado
- El PDA proporcionado no coincide con el PDA esperado o derivado
- Los datos de entrada son más grandes de lo que el programa permite
- La calificación proporcionada no cae en el rango de 1 a 5

El código base incluye un archivo **error.rs** vacío. Abra ese archivo y agregue errores para cada uno de los casos anteriores.

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

Ten en cuenta que, además de agregar los casos de error, también agregamos la implementación que nos permite convertir nuestro error en un tipo **ProgramError** según sea necesario.

Antes de continuar, traigamos **ReviewError** al alcance en **processor.rs**. Usaremos estos errores en breve cuando agreguemos nuestras comprobaciones de seguridad.

```rust
// inside processor.rs
use crate::error::ReviewError;
```

## 3. Agregar comprobaciones de seguridad a **add_movie_review**
Ahora que tenemos errores para usar, implementemos algunas comprobaciones de seguridad en nuestra función **add_movie_review**.

### Comprobación del firmante
Lo primero que debemos hacer es asegurarnos de que el **inicializador** de una revisión también sea un firmante en la transacción. Esto garantiza que no puedes enviar revisiones de películas imitando a alguien más. Pondremos esta comprobación justo después de iterar a través de las cuentas.

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

### Validación de cuenta
A continuación, asegúrese de que la **cuenta pda** que se ha pasado al usuario es la cuenta **pda** que esperamos. Recuerda que derivamos el **pda** para una revisión de película utilizando el **inicializador** y el **título** como semillas. Dentro de nuestra instrucción volveremos a derivar el **pda** y luego verificaremos si coincide con la **cuenta pda** . Si las direcciones no coinciden, devolveremos nuestro error personalizado **InvalidPDA** .

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Validación de datos
Ahora realizaremos algunas validaciones de datos.

Comencemos verificando que la **calificación** cae dentro de la escala de 1 a 5. Si la calificación proporcionada por el usuario está fuera de este rango, devolveremos nuestro error personalizado **InvalidRating** .

```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}
```

A continuación, verifiquemos que el contenido de la revisión no exceda los 1000 bytes que hemos asignado para la cuenta. Si el tamaño excede 1000 bytes, devolveremos nuestro error personalizado **InvalidDataLength** .

```rust
let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len())
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

Por último, verifiquemos si la cuenta ya ha sido inicializada llamando a la función **is_initialized** que implementamos para nuestra estructura **MovieAccountState** . Si la cuenta ya existe, devolveremos un error.

```rust
if account_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

En conjunto, la función **add_movie_review** debería verse algo así:

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

## 4. Admitir actualizaciones de revisiones de películas en **MovieInstruction**
Ahora que **add_movie_review** es más seguro, volvamos nuestra atención a admitir la capacidad de actualizar una revisión de película.

Comencemos actualizando **instruction.rs** . Comenzaremos agregando una variante **UpdateMovieReview** a **MovieInstruction** que incluya datos incorporados para el nuevo título, calificación y descripción.

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

La estructura payload puede permanecer igual ya que, aparte del tipo de variante, los datos de la instrucción son los mismos que los que usamos para **AddMovieReview**.

Por último, en la función **unpack** necesitamos agregar **UpdateMovieReview** al enunciado match.

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

## 5. Define la función update_movie_review
Ahora que podemos desempaquetar nuestros **datos de instrucción** y determinar qué instrucción del programa ejecutar, podemos agregar **UpdateMovieReview** a la declaración match en la función **process_instruction** en el archivo **processor.rs** .

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

A continuación, podemos definir la nueva función **update_movie_review** . La definición debe tener los mismos parámetros que la definición de **add_movie_review** .

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

## 6. Implementar la función **update_movie_review**
Todo lo que queda ahora es llenar la lógica para actualizar una revisión de película. Solo hagámoslo seguro desde el principio.

Al igual que la función **add_movie_review** , comencemos iterando a través de las cuentas. Las únicas cuentas que necesitaremos son las dos primeras: **inicializador** y **cuenta pda** .

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
Antes de continuar, implementemos algunas comprobaciones básicas de seguridad. Comenzaremos con una comprobación de propiedad en **pda_account** para verificar que es propiedad de nuestro programa. Si no lo es, devolveremos un error **InvalidOwner** .

```rust
if pda_account.owner != program_id {
    return Err(ProgramError::InvalidOwner)
}
```

### Comprobación de firmante
A continuación, realizaremos una comprobación de firmante para verificar que el **inicializador** de la instrucción de actualización también haya firmado la transacción. Ya que estamos actualizando los datos de una revisión de película, queremos asegurarnos de que el **inicializador** original de la revisión haya aprobado los cambios firmando la transacción. Si el **inicializador** no firmó la transacción, devolveremos un error.

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validación de cuenta
A continuación, verifiquemos que la **cuenta pda** que se ha pasado al usuario es la cuenta pda que esperamos derivando la PDA utilizando el **inicializador** y el **título** como semillas. Si las direcciones no coinciden, devolveremos nuestro error personalizado **InvalidPDA** . Implementaremos esto de la misma manera que lo hicimos en la función **add_movie_review** .

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Desempaqueta **pda_account** y realiza la validación de datos
Ahora que nuestro código garantiza que podemos confiar en las cuentas pasadas, desempaquetemos **pda_account** y realicemos algunas validaciones de datos. Comenzaremos desempaquetando **pda_account** y asignándolo a una variable mutable **account_data** .

```rust
msg!("unpacking state account");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("borrowed account data");
```

Ahora que tenemos acceso a la cuenta y sus campos, lo primero que debemos hacer es verificar que la cuenta ya ha sido inicializada. Una cuenta no inicializada no puede ser actualizada, por lo que el programa debe devolver nuestro error personalizado **UninitializedAccount** .

```rust
if !account_data.is_initialized() {
    msg!("Account is not initialized");
    return Err(ReviewError::UninitializedAccount.into());
}
```

A continuación, debemos validar los datos de **calificación** , **título** y **descripción**, al igual que en la función **add_movie_review** . Queremos limitar la **calificación** a una escala de 1 a 5 y limitar el tamaño total de la revisión a menos de 1000 bytes. Si la calificación proporcionada por el usuario está fuera de este rango, devolveremos nuestro error personalizado **InvalidRating** . Si la revisión es demasiado larga, devolveremos nuestro error personalizado **InvalidDataLength** .

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
 Ahora que hemos implementado todas las comprobaciones de seguridad, finalmente podemos actualizar la cuenta de revisión de películas actualizando **account_data** y volviendo a serializarlo. En ese momento, podemos devolver Ok desde nuestro programa.

```rust
account_data.rating = rating;
account_data.description = description;

account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

Ok(())
```

En conjunto, la función **update_movie_review** debería verse como el fragmento de código a continuación. Hemos incluido algunos registros adicionales para mayor claridad en la depuración.

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
¡Estamos listos para construir y actualizar nuestro programa! Puede probar su programa enviando una transacción con los datos de instrucción correctos. Para eso, no dude en usar esta [interfaz](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews). Recuerde, para asegurarse de probar el programa correcto, debe reemplazar **MOVIE_REVIEW_PROGRAM_ID** con su ID de programa en **Form.tsx** y **MovieCoordinator.ts**.

Si necesita más tiempo con este proyecto para sentirse cómodo con estos conceptos, eche un vistazo al [código de solución](https://beta.solpg.io/62c8c6dbf6273245aca4f5e7) antes de continuar.



# Desafío 
Es tu turno de construir algo de forma independiente, construyendo sobre el programa de Introducción de Estudiantes que has utilizado en lecciones anteriores. Si no has seguido o no has guardado tu código anterior, no dudes en utilizar este [código de inicio](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).
El programa de Introducción de Estudiantes es un programa de Solana que permite a los estudiantes presentarse. El programa toma el nombre y un mensaje corto del usuario como instruction_data y crea una cuenta para almacenar los datos en la cadena.
Usando lo que has aprendido en esta lección, trata de aplicarlo al programa de Introducción de Estudiantes. El programa debería:
1. Añadir una instrucción que permita a los estudiantes actualizar su mensaje.
2. Implementar las comprobaciones de seguridad básicas que hemos aprendido en esta lección.
Intenta hacerlo de forma independiente si puedes, pero si te quedas atascado, no dudes en consultar el [código de la solución](https://beta.solpg.io/62c9120df6273245aca4f5e8). Ten en cuenta que tu código puede verse ligeramente diferente al código de la solución dependiendo de las comprobaciones que implementes y los errores que escribas. Una vez completes el módulo 3, nos encantaría saber más sobre tu experiencia. No dudes en compartir una retroalimentación rápida [aquí](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%203) para que podamos seguir mejorando el curso.
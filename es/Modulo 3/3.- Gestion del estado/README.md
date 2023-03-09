# CREAR UN PROGRAMA BASICO, PARTE 2 – GESTION DEL ESTADO
## Objetivos de la lección
- Describir el proceso de crear una nueva cuenta usando una dirección derivada del programa (PDA)
- Utilizar semillas para derivar PDA
- Utilizar una invocaciíon cruzada de programa (CPI) para inicializar una cuentacon una PDA como dirección de la cuenta nueva. 
- Explicar como actualizar los datos almacenados en una cuenta nueva. 

# Terminología
- El estado del programa se almacena en otras cuentas en lugar de en el propio programa.
- Una dirección de programa derivada (PDA) se deriva de un ID de programa y una lista opcional de semillas. Una vez derivadas, las PDAs se utilizan posteriormente como dirección para una cuenta de almacenamiento.
- La creación de una cuenta requiere calcular el espacio requerido y el alquiler correspondiente para asignar a la nueva cuenta.
- La creación de una nueva cuenta requiere una invocación de programa cruzado (CPI) a la instrucción create_account en el programa del sistema.
- La actualización del campo de datos en una cuenta requiere serializar (convertir a una matriz de bytes) los datos en la cuenta.

# Resumen
Solana mantiene la velocidad, la eficiencia y la extensibilidad en parte haciendo que los programas sean sin estado. En lugar de tener el estado almacenado en el propio programa, los programas utilizan el modelo de cuenta de Solana para leer el estado de y escribir el estado en cuentas PDA separadas. 
Aunque este es un modelo extremadamente flexible, también es un paradigma que puede ser difícil de trabajar si no se está familiarizado con él. Pero no te preocupes! Comenzaremos simple en esta lección y avanzaremos hacia programas más complejos en el siguiente módulo.
 En esta lección aprenderemos los conceptos básicos de la gestión del estado para un programa Solana, incluyendo la representación del estado como un tipo Rust, la creación de cuentas utilizando direcciones de programa derivadas y la serialización de los datos de la cuenta.


## El estado del programa
Todas las cuentas de Solana tienen un campo de **datos** que contiene una matriz de bytes. Esto hace que las cuentas sean tan flexibles como los archivos en una computadora. Puedes almacenar literalmente cualquier cosa en una cuenta (siempre y cuando la cuenta tenga el espacio de almacenamiento para ella).
Al igual que los archivos en un sistema de archivos tradicional cumplen con formatos de datos específicos como PDF o MP3, los datos almacenados en una cuenta de Solana deben seguir algún tipo de patrón para que los datos puedan ser recuperados y deserializados en algo utilizable.

### Representando el estado como un tipo de Rust
Al escribir un programa en Rust, normalmente creamos este "formato" definiendo un tipo de datos de Rust. Si pasó por la *primera parte de esta lección* , esto es muy similar a lo que hicimos cuando creamos un enum para representar instrucciones discretas.

Mientras que este tipo debe reflejar la estructura de tus datos, para la mayoría de los casos una estructura simple es suficiente. Por ejemplo, un programa de toma de notas que almacena notas en cuentas separadas probablemente tendría datos para un título, cuerpo e incluso un ID de algún tipo. Podríamos crear una estructura para representar eso de la siguiente manera:

```rust
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

### Usando Borsh para la serialización y deserialización
Al igual que con los datos de instrucción, necesitamos un mecanismo para convertir nuestro tipo de datos de Rust a una matriz de bytes, y viceversa. La *serialización* es el proceso de convertir un objeto en una matriz de bytes. La *deserialización* es el proceso de reconstruir un objeto a partir de una matriz de bytes.

Continuaremos usando Borsh para la serialización y deserialización. En Rust, podemos usar la caja **borsh** para obtener acceso a los rasgos **BorshSerialize y BorshDeserialize** . Luego, podemos aplicar esos rasgos utilizando la macro de atributo **derive** .

```rust
use borsh::{BorshSerialize, BorshDeserialize};

#[derive(BorshSerialize, BorshDeserialize)]
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

Estos rasgos proporcionarán métodos en **NoteState** que podremos usar para serializar y deserializar los datos según sea necesario.

## Creando cuentas
Antes de poder actualizar el campo de datos de una cuenta, primero debemos crear esa cuenta.
Para crear una nueva cuenta dentro de nuestro programa debemos:

1. Calcular el espacio y el alquiler requerido para la cuenta
2. Tener una dirección para asignar la nueva cuenta
3. Invocar el programa del sistema para crear la nueva cuenta

### Espacio y alquiler
Recuerda que almacenar datos en la red de Solana requiere que los usuarios asignen alquiler en forma de lamports. La cantidad de alquiler requerida por una nueva cuenta depende de la cantidad de espacio que desea asignar a esa cuenta. Eso significa que necesitamos saber antes de crear la cuenta cuánto espacio asignar.

Ten en cuenta que el alquiler es más como un depósito. Todos los lamports asignados para el alquiler se pueden reintegrar completamente cuando se cierra una cuenta. Además, todas las nuevas cuentas ahora deben ser [exentas de alquiler](https://twitter.com/jacobvcreech/status/1524790032938287105), lo que significa que los lamports no se deducen de la cuenta con el tiempo. Una cuenta se considera exenta de alquiler si tiene al menos 2 años de alquiler. En otras palabras, las cuentas se almacenan en la cadena permanentemente hasta que el propietario cierra la cuenta y retira el alquiler.

En nuestro ejemplo de aplicación de notas, la estructura **NoteState** especifica tres campos que deben almacenarse en una cuenta: **título**, **cuerpo** e **id**. Para calcular el tamaño que la cuenta necesita tener, simplemente sumaría el tamaño requerido para almacenar los datos en cada campo.

Para los datos dinámicos, como las cadenas, Borsh agrega 4 bytes adicionales al principio para almacenar el tamaño de ese campo particular. Eso significa que **título** y **cuerpo** son cada 4 bytes más sus tamaños respectivos. El campo **id** es un entero de 64 bits, o 8 bytes.
Puede sumar esas longitudes y luego calcular el alquiler requerido para esa cantidad de espacio utilizando la función **minimum_balance** del módulo de **alquiler** de la caja **solana_program** .

```rust
// Calculate account size required for struct NoteState
let account_len: usize = (4 + title.len()) + (4 + body.len()) + 8;

// Calculate rent required
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

### Direcciones de programa derivadas (PDA)
Antes de crear una cuenta, también necesitamos tener una dirección para asignar la cuenta. Para las cuentas propiedad de un programa, esta será una dirección de programa derivada (PDA) encontrada utilizando la función **find_program_address** .

Como su nombre indica, las PDAs se derivan utilizando el ID del programa (dirección del programa que crea la cuenta) y una lista opcional de "semillas". Las semillas opcionales son entradas adicionales utilizadas en la función **find_program_address** para derivar la PDA. La función utilizada para derivar las PDAs devolverá la misma dirección cada vez que se den las mismas entradas. Esto nos da la capacidad de crear cualquier número de cuentas PDA y una forma determinística de encontrar cada cuenta.

Además de las semillas que proporciona para derivar una PDA, la función **find_program_address** proporcionará una semilla adicional "bump". Lo que hace que las PDAs sean únicas en comparación con otras direcciones de cuenta de Solana es que no tienen una clave secreta correspondiente. Esto garantiza que solo el programa que posee la dirección puede firmar en nombre de la PDA. 

Cuando la función **find_program_address** intenta derivar una PDA utilizando las semillas proporcionadas, ingresa el número 255 como la "semilla de bump". Si la dirección resultante es inválida (es decir, tiene una clave secreta correspondiente), entonces la función disminuye la semilla de bump en 1 y deriva una nueva PDA con esa semilla de bump. Una vez que se encuentra una PDA válida, la función devuelve tanto la PDA como el bump que se utilizó para derivar la PDA.

Para nuestro programa de toma de notas, usaremos la clave pública del creador de la nota y el ID como las semillas opcionales para derivar la PDA. Derivar la PDA de esta manera nos permite encontrar de manera determinística la cuenta para cada nota.

```rust
let (note_pda_account, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);
```

### Invocacion de Programa Cruzado (CPI)
Una vez que hayamos calculado el alquiler requerido para nuestra cuenta y encontrado una PDA válida para asignar como la dirección de la nueva cuenta, finalmente estamos listos para crear la cuenta. Crear una nueva cuenta dentro de nuestro programa requiere una Invocación de Programa Cruzado (CPI, por sus siglas en inglés). Una CPI es cuando un programa invoca una instrucción en otro programa. Para crear una nueva cuenta dentro de nuestro programa, invocaremos la instrucción **create_account** en el programa del sistema.

Las CPIs se pueden realizar utilizando **invoke** o **invoke_signed** .

```rust
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult
```

```rust
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

Para esta lección utilizaremos **invoke_signed**. A diferencia de una firma regular en la que se utiliza una clave privada para firmar, **invoke_signed** utiliza las semillas opcionales, la semilla de bump y el ID del programa para derivar una PDA y firmar una instrucción. Esto se hace comparando la PDA derivada con todas las cuentas pasadas a la instrucción. Si alguna de las cuentas coincide con la PDA, entonces el campo de la firma de esa cuenta se establece en verdadero.

Un programa puede firmar transacciones de forma segura de esta manera porque **invoke_signed** genera la PDA utilizada para firmar con el ID del programa que invoca la instrucción. Por lo tanto, no es posible que un programa genere una PDA coincidente para firmar para una cuenta con una PDA derivada utilizando otro ID de programa.

```rust
invoke_signed(
    // instruction
    &system_instruction::create_account(
        note_creator.key,
        note_pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
    ),
    // account_infos
    &[note_creator.clone(), note_pda_account.clone(), system_program.clone()],
    // signers_seeds
    &[&[note_creator.key.as_ref(), note_id.as_bytes().as_ref(), &[bump_seed]]],
)?;
```

## Serlializando y Deserealizando Cuentas de Datos
Una vez que hayamos creado una nueva cuenta, necesitamos acceder y actualizar el campo de datos de la cuenta. Esto significa deserializar su matriz de bytes en una instancia del tipo que creamos, actualizar los campos en esa instancia y luego serializar esa instancia de nuevo en una matriz de bytes.

### Deserializar los datos de la cuenta
El primer paso para actualizar los datos de una cuenta es deserializar su matriz de bytes de **datos** en su tipo Rust. Puedes hacerlo primero prestando el campo de datos en la cuenta. Esto te permite acceder a los datos sin tomar posesión.

Luego, puedes usar la función **try_from_slice_unchecked** para deserializar el campo de datos del préstamo de la cuenta utilizando el formato del tipo que creaste para representar los datos. Esto te da una instancia de tu tipo Rust para que puedas actualizar fácilmente los campos utilizando la notación de punto. Si hiciéramos esto con el ejemplo de la aplicación de toma de notas que hemos estado usando, se vería así:

```rust
let mut account_data = try_from_slice_unchecked::<NoteState>(note_pda_account.data.borrow()).unwrap();

account_data.title = title;
account_data.body = rating;
account_data.id = id;
```

### Serializar una Cuenta de Datos
Una vez que la instancia de Rust que representa los datos de la cuenta se ha actualizado con los valores apropiados, puedes "guardar" los datos en la cuenta.

Esto se hace con la función de **serialización** en la instancia del tipo Rust que creaste. Necesitarás pasar una referencia mutable a los datos de la cuenta. La sintaxis aquí es complicada, así que no te preocupes si no la entiendes completamente. Prestar y las referencias son dos de los conceptos más difíciles en Rust.

```rust
account_data.serialize(&mut &mut note_pda_account.data.borrow_mut()[..])?;
```

En el ejemplo anterior, convierte el objeto **account_data** en una matriz de bytes y lo establece en la propiedad **data** en **note_pda_account** . Esto guarda efectivamente la variable **account_data**  actualizada en el campo de datos de la nueva cuenta. Ahora, cuando un usuario obtiene **note_pda_account**  y deserializa los datos, mostrará los datos actualizados que hemos serializado en la cuenta.

## Iteradores
Es posible que haya notado en los ejemplos anteriores que hicimos referencia a **note_creator** y no mostramos de dónde proviene.
Para tener acceso a esta y otras cuentas, usamos un *iterador* . Un iterador es una característica de Rust utilizada para dar acceso secuencial a cada elemento en una colección de valores. Los iteradores se utilizan en los programas Solana para iterar de forma segura sobre la lista de cuentas pasadas al punto de entrada del programa a través del argumento de **cuentas** .

### Iterador de Rust
El patrón de iterador le permite realizar alguna tarea en una secuencia de elementos. El método **iter()** crea un objeto iterador que hace referencia a una colección. Un iterador es responsable de la lógica de iterar sobre cada elemento y determinar cuándo ha finalizado la secuencia. En Rust, los iteradores son perezosos, lo que significa que no tienen efecto hasta que llamas a los métodos que consumen el iterador para utilizarlo. Una vez que hayas creado un iterador, debes llamar a la función **next()** en él para obtener el siguiente elemento.

```rust
let v1 = vec![1, 2, 3];

// create the iterator over the vec
let v1_iter = v1.iter();

// use the iterator to get the first item
let first_item = v1_iter.next();

// use the iterator to get the second item
let second_item = v1_iter.next();
```

### Iterador de cuentas de Solana
Recuerde que la **AccountInfo** de todas las cuentas requeridas por una instrucción se pasan a través de un único argumento de cuentas. Para recorrer las cuentas y usarlas dentro de nuestra instrucción, crearemos un iterador con una referencia mutable a las **cuentas** .

En ese punto, en lugar de usar el iterador directamente, lo pasamos a la función **next_account_info**  del módulo **account_info** proporcionado por la biblioteca **solana_program** .

Por ejemplo, la instrucción para crear una nueva nota en un programa de toma de notas requeriría, como mínimo, las cuentas del usuario que crea la nota, una PDA para almacenar la nota y el **programa_sistema** para inicializar una nueva cuenta. Todas las tres cuentas se pasarían al punto de entrada del programa a través del argumento de **cuentas** . Luego, se usa un iterador de **cuentas** para separar la **AccountInfo** asociada a cada cuenta para procesar la instrucción.

Tenga en cuenta que **&mut** significa una referencia mutable al argumento de **cuentas** . Puedes leer más sobre las referencias en Rust [aquí](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html) y la palabra clave **mut** [aquí](https://doc.rust-lang.org/std/keyword.mut.html) .

```rust
// Get Account iterator
let account_info_iter = &mut accounts.iter();

// Get accounts
let note_creator = next_account_info(account_info_iter)?;
let note_pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

# Demostración
Esta visión general cubrió muchos conceptos nuevos. Practiquémoslos juntos continuando trabajando en el programa Movie Review de la última lección. No te preocupes si acabas de saltar a esta lección sin haber hecho la lección anterior, debería ser posible seguirla de cualquier manera. Utilizaremos [Solana Playground](https://beta.solpg.io) para escribir, construir y desplegar nuestro código.
Como recordatorio, estamos construyendo un programa de Solana que permite a los usuarios revisar películas. En la lección anterior, deserializamos los datos de la instrucción pasados por el usuario, pero aún no hemos almacenado estos datos en una cuenta. Ahora actualicemos nuestro programa para crear nuevas cuentas para almacenar la reseña de la película del usuario.

## 1. Obtén el código inicial
Si no completaste la demostración de la última lección o simplemente quieres asegurarte de no haber perdido nada, puedes hacer referencia al código inicial [aquí](https://beta.solpg.io/6295b25b0e6ab1eb92d947f7).
Nuestro programa actualmente incluye el archivo **instruction.rs** que utilizamos para deserializar el **instruction_data** pasado al punto de entrada del programa. También hemos completado el archivo **lib.rs** hasta el punto en que podemos imprimir nuestros datos de instrucción deserializados en el registro del programa utilizando la macro **msg!** .

## 2. Crea una estructura para representar los datos de la cuenta
Empecemos creando un nuevo archivo llamado state.rs.
Este archivo:
1. Definirá la estructura que utiliza nuestro programa para llenar el campo de datos de una nueva cuenta
2. Agregará las traits **BorshSerialize** y **BorshDeserialize** a esta estructura
Primero, traigamos al alcance todo lo que necesitaremos de la caja **borsh** .

```rust
use borsh::{BorshSerialize, BorshDeserialize};
```

A continuación, creemos nuestra estructura **MovieAccountState** . Esta estructura definirá los parámetros que cada nueva cuenta de revisión de películas almacenará en su campo de datos. Nuestra estructura **MovieAccountState**  requerirá los siguientes parámetros:
- **is_initialized** : indica si la cuenta ha sido inicializada o no
- **rating** : la calificación del usuario de la película
- **description** : la descripción del usuario de la película
- **title** : el título de la película que el usuario está revisando"

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub is_initialized: bool,
    pub rating: u8,
    pub title: String,
    pub description: String  
}
```

## 3. Actualizar **lib.rs** 
A continuación, actualicemos nuestro archivo **lib.rs** . Primero, traeremos al alcance todo lo que necesitaremos para completar nuestro programa de revisión de películas. Puedes leer más sobre los detalles de cada elemento que estamos utilizando de la caja **solana_program** aquí."

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::{next_account_info, AccountInfo},
    system_instruction,
    program_error::ProgramError,
    sysvar::{rent::Rent, Sysvar},
    program::{invoke_signed},
    borsh::try_from_slice_unchecked,
};
use std::convert::TryInto;
pub mod instruction;
pub mod state;
use instruction::MovieInstruction;
use state::MovieAccountState;
use borsh::BorshSerialize;
```

## 4. Iterar a través de las cuentas
A continuación, continuemos construyendo nuestra función **add_movie_review** . Recuerda que un arreglo de cuentas se pasa a la función **add_movie_review** a través de un único argumento de **cuentas** . Para procesar nuestra instrucción, necesitaremos iterar a través de las **cuentas** y asignar la **AccountInfo** para cada cuenta a su propia variable."

``` rust
// Get Account iterator
let account_info_iter = &mut accounts.iter();

// Get accounts
let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

## 5. Derivar PDA
A continuación, dentro de nuestra función **add_movie_review** , derivemos independientemente la PDA que esperamos que el usuario haya pasado. Necesitaremos proporcionar la semilla de aumento para la derivación más tarde, por lo que aunque **pda_account** debería hacer referencia a la misma cuenta, todavía necesitamos llamar a **find_program_address** .

Tenga en cuenta que se deriva la PDA para cada nueva cuenta utilizando la clave pública del inicializador y el título de la película como semillas opcionales. Configurar la PDA de esta manera restringe a cada usuario solo a una revisión para cualquier título de película. Sin embargo, todavía permite que el mismo usuario revise películas con títulos diferentes y que diferentes usuarios revisen películas con el mismo título

```rust
// Derive PDA and check that it matches client
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
```

## 6. Calcular espacio y alquiler
A continuación, calculemos el alquiler que nuestra nueva cuenta necesitará. Recuerda que el alquiler es la cantidad de lámparas que un usuario debe asignar a una cuenta para almacenar datos en la red Solana. Para calcular el alquiler, primero debemos calcular la cantidad de espacio que requiere nuestra nueva cuenta.

La estructura **MovieAccountState** tiene cuatro campos. Asignaremos 1 byte cada uno para **rating** e **is_initialized** . Para **título** y **descripción** , asignaremos un espacio igual a 4 bytes más la longitud de la cadena.

```rust
// Calculate account size required
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());

// Calculate rent required
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

## 7. Crear nueva cuenta 
Una vez que hayamos calculado el alquiler y verificado el PDA, estamos listos para crear nuestra nueva cuenta. Para crear una nueva cuenta, debemos llamar a la instrucción **create_account** del programa del sistema. Hacemos esto con una Invocación de Programa Cruzado (CPI) utilizando la función **invoke_signed**. Usamos **invoke_signed** porque estamos creando la cuenta utilizando un PDA y necesitamos que el programa de Revisión de Películas "firme" la instrucción.

```rust
// Create the account
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
```

## 8. Actualizar los datos de la cuenta
Ahora que hemos creado una nueva cuenta, estamos listos para actualizar el campo de datos de la nueva cuenta utilizando el formato de la estructura **MovieAccountState** de nuestro archivo **state.rs** . Primero deserializamos los datos de la cuenta desde **pda_account** utilizando **try_from_slice_unchecked** , luego establecemos los valores de cada campo.

```rust
msg!("unpacking state account");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("borrowed account data");

account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Finalmente, serializamos los **account_data** actualizados en el campo de datos de nuestra cuenta **pda_account** .

```rust
msg!("serializing account");
account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
msg!("state account serialized");
```

## 9. Construir y desplegar 
¡Estamos listos para construir y desplegar nuestro programa!




![3.3](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%203/images/3.3/1.gif)





Puedes probar tu programa enviando una transacción con los datos de instrucción correctos. Para eso, no dudes en usar este [script](https://github.com/Unboxed-Software/solana-movie-client) o el [frontend](https://github.com/Unboxed-Software/solana-movie-frontend) que construimos en la *lección Deserializar datos de instrucción personalizados* . En ambos casos, asegúrate de copiar y pegar el ID del programa para tu programa en el área apropiada del código fuente para asegurarte de estar probando el programa correcto.
Si utilizas el frontend, simplemente reemplaza el **MOVIE_REVIEW_PROGRAM_ID** en ambos componentes **MovieList.tsx** y **Form.tsx** con la dirección del programa que hayas desplegado. Luego ejecuta el frontend, envía una vista y actualiza el navegador para ver la revisión.
Si necesitas más tiempo con este proyecto para sentirte cómodo con estos conceptos, echa un vistazo al *código de solución* antes de continuar."

# Desafio 
Ahora es tu turno de construir algo de forma independiente. Con los conceptos introducidos en esta lección, ahora sabes todo lo que necesitarás para recrear todo el programa de introducción del estudiante del Módulo 1.
El programa de introducción del estudiante es un programa de Solana que permite a los estudiantes presentarse. El programa toma el nombre de un usuario y un mensaje corto como **instruction_data** y crea una cuenta para almacenar los datos en la cadena.
Usando lo que has aprendido en esta lección, construye este programa. Además de tomar un nombre y un mensaje corto como instruction_data, el programa debería:
1. Crear una cuenta separada para cada estudiante
2. Almacenar is_initialized como un valor booleano, nombre como una cadena y msg como una cadena en cada cuenta.
Puedes probar tu programa construyendo el [frontend](https://github.com/Unboxed-Software/solana-movie-frontend) que creamos en la lección de [Page, Order and Filter Custom Account Data](https://beta.solpg.io/62b11ce4f6273245aca4f5b2) . Recuerda reemplazar el ID del programa en el código del frontend con el que hayas desplegado.
Intenta hacerlo de forma independiente si puedes, pero si te quedas atascado, no dudes en consultar el código de la solución.
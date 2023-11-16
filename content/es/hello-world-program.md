---
title: Objetivos de Hello World
objectives:
- Utilice el sistema del módulo Rust
- Definir una función en Rust
- Explicar el `Result` tipo
- Explicar el punto de entrada a un programa de Solana
- Construir e implementar un programa básico de Solana
- Envíe una transacción para invocar nuestro programa "¡Hola, mundo!"
---

# TL;DR

-   **Programas** en Solana son un tipo particular de cuenta que almacena y ejecuta lógica de instrucciones
-   Los programas de Solana tienen una sola **punto de entrada** para procesar instrucciones
-   Un programa procesa una instrucción usando la**program_id**, lista de**cuentas**, e **instruction_data** incluida con la instrucción

# Descripción general

La capacidad de Solana para ejecutar código ejecutable arbitrario es parte de lo que lo hace tan poderoso. Los programas de Solana, similares a los "contratos inteligentes" en otros entornos de blockchain, son literalmente la columna vertebral del ecosistema de Solana. Y la colección de programas crece diariamente a medida que los desarrolladores y creadores sueñan e implementan nuevos programas.

Esta lección le dará una introducción básica a la escritura y la implementación de un programa Solana utilizando el lenguaje de programación Rust. Para evitar la distracción de configurar un entorno de desarrollo local, usaremos un IDE basado en navegador llamado Solana Playground.

## Rust Basics

Antes de sumergirnos en el edificio, nuestro programa "¡Hola, mundo!", Primero repasemos algunos conceptos básicos de Rust. Si quieres profundizar en Rust, echa un vistazo a la[Libro DE lenguaje DE óxido](https://doc.rust-lang.org/book/ch00-00-introduction.html).

### Sistema del módulo

Rust organiza el código utilizando lo que se conoce colectivamente como el "sistema de módulos".

Esto incluye:

-   **Módulos** Un módulo separa el código en unidades lógicas para proporcionar espacios de nombres aislados para la organización, el alcance y la privacidad de las rutas.
-   **Cajas** Una caja es una biblioteca o un programa ejecutable. El código fuente de una caja generalmente se subdivide en múltiples módulos.
-   **Paquetes** - Un paquete contiene una colección de cajas, así como un archivo de manifiesto para especificar metadatos y dependencias entre paquetes

A lo largo de esta lección, nos centraremos en el uso de cajas y módulos.

### Caminos y alcance

Las cajas en Rust contienen módulos que definen la funcionalidad que se puede compartir con múltiples proyectos. Si queremos acceder a un elemento dentro de un módulo, entonces necesitamos conocer su "ruta" (como cuando navegamos por un sistema de archivos).

Piense en la estructura de la caja como un árbol donde la caja es la base y los módulos son ramas, cada una de las cuales puede tener submódulos o elementos que son ramas adicionales.

La ruta a un módulo o artículo en particular es el nombre de cada paso desde la caja hasta ese módulo donde cada uno está separado `::`. Como ejemplo, veamos la siguiente estructura:

1. La caja base es `solana_program`
2. `solana_program` contiene un módulo llamado `account_info`
3. `account_info` contiene una estructura denominada `AccountInfo`

El camino `AccountInfo` sería `solana_program::account_info::AccountInfo`.

A falta de otras palabras clave, tendríamos que hacer referencia a toda esta ruta para usar `AccountInfo` en nuestro código.

Sin embargo, con la palabra clave [ `use`](https://doc.rust-lang.org/stable/book/ch07-04-bringing-paths-into-scope-with-the-use-keyword.html) podemos poner un elemento en alcance para que pueda reutilizarse en todo un archivo sin especificar la ruta completa cada vez. Es común ver una serie de `use` comandos en la parte superior de un archivo Rust.

```rust
use solana_program::account_info::AccountInfo
```

### Declarar funciones en Rust

Definimos una función en Rust utilizando la `fn` palabra clave seguida de un nombre de función y un conjunto de paréntesis.

```rust
fn process_instruction()
```

Luego podemos agregar argumentos a nuestra función incluyendo nombres de variables y especificando su tipo de datos correspondiente entre paréntesis.

Rust se conoce como un lenguaje "estáticamente tipado" y cada valor en Rust es de un cierto "tipo de datos". Esto significa que Rust debe conocer los tipos de todas las variables en tiempo de compilación. En los casos en que son posibles múltiples tipos, debemos añadir una anotación de tipo a nuestras variables.

En el siguiente ejemplo, creamos una función con nombre `process_instruction` que requiere los siguientes argumentos:

-   `program_id` - se requiere que sea de tipo `&Pubkey`
-   `accounts` - se requiere que sea de tipo `&[AccountInfo]`
-   `instruction_data` - se requiere que sea de tipo `&[u8]`

Tenga `&` en cuenta el frente del tipo para cada argumento enumerado en la `process_instruction` función. En Rust, `&` representa una “referencia” a otra variable. Esto le permite referirse a algún valor sin tomar posesión de él. Se garantiza que la "referencia" apunta a un valor válido de un tipo particular. La acción de crear una referencia en Rust se llama “endeudamiento”.

En este ejemplo, cuando se llama a la `process_instruction` función, un usuario debe pasar valores para los argumentos requeridos. A continuación, la `process_instruction` función hace referencia a los valores transmitidos por el usuario y garantiza que cada valor sea el tipo de datos correcto especificado en la `process_instruction` función.

Además, tenga en cuenta los corchetes `[]` alrededor `&[AccountInfo]` y `&[u8]`. Esto significa que los `instruction_data` argumentos `accounts` y esperan "rebanadas" de tipos `AccountInfo` y `u8`, respectivamente. Una "porción" es similar a una matriz (colección de objetos del mismo tipo), excepto que la longitud no se conoce en el momento de la compilación. En otras palabras, los `instruction_data` argumentos `accounts` y esperan entradas de longitud desconocida.

```rust
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
)
```

Entonces podemos hacer que nuestras funciones devuelvan valores declarando el tipo de retorno usando una flecha `->` después de la función.

En el siguiente ejemplo, la `process_instruction` función devolverá ahora un valor de tipo `ProgramResult`. Repasaremos esto en la siguiente sección.

```rust
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult
```

### Enumeración de resultados

`Result` es un tipo de biblioteca estándar que representa dos resultados discretos: éxito ( `Ok`) o fracaso ( `Err`). Hablaremos más sobre los enums en una lección futura, pero verás que `Ok` se usan más adelante en esta lección, por lo que es importante cubrir los conceptos básicos.

Cuando use `Ok` o `Err`, debe incluir un valor, cuyo tipo está determinado por el contexto del código. Por ejemplo, una función que requiere un valor de retorno de tipo `Result<String, i64>` está diciendo que la función puede regresar `Ok` con un valor de cadena incrustado o `Err` con un entero incrustado. En este ejemplo, el entero es un código de error que puede usarse para manejar apropiadamente el error.

Para devolver un caso de éxito con un valor de cadena, haría lo siguiente:

```rust
Ok(String::from("Success!"));
```

Para devolver un error con un entero, haría lo siguiente:

```rust
Err(404);
```

## Programas Solana

Recuerde que todos los datos almacenados en la red de Solana están contenidos en lo que se conoce como cuentas. Cada cuenta tiene su propia dirección única que se utiliza para identificar y acceder a los datos de la cuenta. Los programas de Solana son solo un tipo particular de cuenta de Solana que almacena y ejecuta instrucciones.

### Solana Program Crate

Para escribir programas de Solana con Rust, utilizamos la caja de la  `solana_program`  biblioteca. La  `solana_program`  caja actúa como una biblioteca estándar para los programas de Solana. Esta biblioteca estándar contiene los módulos y macros que utilizaremos para desarrollar nuestros programas de Solana. Si quieres cavar una `solana_program`  caja más profunda, echa un vistazo[here](https://docs.rs/solana-program/latest/solana_program/index.html).

Para un programa básico necesitaremos poner en alcance los siguientes elementos de la  `solana_program`  caja:

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

-   `AccountInfo`  - una estructura dentro del  `account_info`  módulo que nos permite acceder a la información de la cuenta
-   `entrypoint`  - una macro que declara el punto de entrada del programa
-   `ProgramResult`  - un tipo dentro del  `entrypoint`  módulo que devuelve un  `Result`  o  `ProgramError`
-   `Pubkey`  - una estructura dentro del  `pubkey`  módulo que nos permite acceder a direcciones como clave pública
-   `msg`  - una macro que nos permite imprimir mensajes en el registro del programa

### Punto de entrada del programa Solana

Los programas de Solana requieren un único punto de entrada para procesar las instrucciones del programa. El punto de entrada se declara usando la  `entrypoint!`  macro.

El punto de entrada a un programa Solana requiere una  `process_instruction`  función con los siguientes argumentos:

-   `program_id`  - la dirección de la cuenta donde se almacena el programa
-   `accounts`  - la lista de cuentas requeridas para procesar la instrucción
-   `instruction_data`  - los datos serializados, específicos de la instrucción

```rust
entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult;
```

Recuerde que las cuentas de programa de Solana solo almacenan la lógica para procesar instrucciones. Esto significa que las cuentas del programa son "de solo lectura" y "sin estado". El "estado" (el conjunto de datos) que un programa requiere para procesar una instrucción se almacena en cuentas de datos (separadas de la cuenta del programa).

Para procesar una instrucción, los datos que una instrucción requiere deben pasar explícitamente al programa a través del  `accounts`  argumento. Cualquier entrada adicional debe pasarse a través del  `instruction_data`  argumento.

Después de la ejecución del programa, el programa debe devolver un valor de tipo `ProgramResult`. Este tipo es un `Result` donde el valor incrustado de un caso de éxito es `()` y el valor incrustado de un caso de fallo es `ProgramError`. `()` es efectivamente un valor vacío y `ProgramError` es un tipo de error definido en la `solana_program` caja.

...y ahí lo tienes - ahora sabes todas las cosas que necesitas para los cimientos de la creación de un programa Solana usando Rust. ¡Practiquemos lo que hemos aprendido hasta ahora!

# Demostración

Vamos a construir un programa "¡Hola, Mundo!" usando Solana Playground. Solana Playground es una herramienta que permite escribir e implementar programas Solana desde el navegador.

### 1. Configuración

Haga clic [here](https://beta.solpg.io/) para abrir Solana Playground. A continuación, siga adelante y elimine todo en el `lib.rs` archivo predeterminado y cree una billetera Playground.

![Cartera Gif Solana Playground Create](../../assets/hello-world-create-wallet.gif)

### 2. Solana Program Crate

En primer lugar, vamos a poner en alcance todo lo que necesitaremos de la `solana_program` caja.

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

A continuación, vamos a configurar el punto de entrada a nuestro programa utilizando la `entrypoint!` macro y crear la `process_instruction` función. La `msg!` macro nos permite imprimir "¡Hola, mundo!" en el registro del programa cuando se invoca el programa.

### 3. Punto de entrada

```rust
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult{
    msg!("Hello, world!");

    Ok(())
}
```

Todos juntos, el programa "¡Hola, mundo!" se verá así:

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult{
    msg!("Hello, world!");

    Ok(())
}
```

### 4. Construir e implementar

Ahora vamos a construir y desplegar nuestro programa usando Solana Playground.

![Gif Solana Playground Construir y desplegar](../../assets/hello-world-build-deploy.gif)

### 5. Invocar programa

Por último, vamos a invocar nuestro programa desde el lado del cliente. Descarga el código[here](https://github.com/Unboxed-Software/solana-hello-world-client).

El enfoque de esta lección es construir nuestro programa Solana, por lo que hemos seguido adelante y proporcionado el código del cliente para invocar nuestro programa "¡Hola, mundo!". El código proporcionado incluye una función de `sayHello` ayuda que crea y envía nuestra transacción. Luego llamamos a `sayHello` la función principal e imprimimos una URL de Solana Explorer para ver los detalles de nuestra transacción en el navegador.

Abre el `index.ts` archivo y verás una variable con nombre `programId`. Continúe y actualice esto con el ID de programa del programa "¡Hola, mundo!" que acaba de implementar utilizando Solana Playground.

```tsx
let programId = new web3.PublicKey("<YOUR_PROGRAM_ID>");
```

Puede localizar el ID del programa en Solana Playground haciendo referencia a la imagen a continuación.

![ID del programa Gif Solana Playground](../../assets/hello-world-program-id.gif)

A continuación, instale los módulos Nodo con `npm i`.

Ahora, adelante y corre `npm start`. Este comando:

1. Generar un nuevo par de claves y crear un `.env` archivo si aún no existe
2. Airdrop devnet SOL
3. Invoca el programa "¡Hola, mundo!"
4. Salida de la URL de transacción para ver en Solana Explorer

Copie la URL de transacción impresa en la consola en su navegador. Desplácese hacia abajo para ver "¡Hola, mundo!" en Registros de instrucciones del programa.

![Captura de pantalla del registro del programa Solana Explorer](../../assets/hello-world-program-log.png)

¡Felicidades, acabas de construir e implementar con éxito un programa de Solana!

# Desafío

Ahora es tu turno de construir algo de forma independiente. Debido a que estamos comenzando con programas muy simples, los suyos se verán casi idénticos a los que acabamos de crear. Es útil tratar de llegar al punto en el que pueda escribirlo desde cero sin hacer referencia al código anterior, así que intente no copiar y pegar aquí.

1. Escriba un nuevo programa que utilice la `msg!` macro para imprimir su propio mensaje en el registro del programa.
2. Cree e implemente su programa como lo hicimos en la demostración.
3. Invoque el programa recién implementado y utilice Solana Explorer para comprobar que el mensaje se ha impreso en el registro del programa.

Como siempre, sé creativo con estos desafíos y llévalos más allá de las instrucciones básicas si quieres, ¡y diviértete!

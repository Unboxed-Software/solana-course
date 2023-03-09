# Hola Mundo
## Objetivos de la lección

Al final de esta lección, podrás:

- Usar el sistema de módulos de Rust
- Definir una función en Rust
- Explicar el tipo Resultado
- Explicar el punto de entrada de un programa Solana
- Construir y desplegar un programa básico de Solana
- Enviar una transacción para invocar nuestro programa "Hola mundo"

# Tecnicismos
- Los **programas** en Solana son un tipo específico de cuenta que almacena y ejecuta lógica de instrucciones.
- Los programas de Solana tienen un **único punto** de entrada para procesar instrucciones.
- Un programa procesa una instrucción utilizando el **program_id,** la lista de **cuentas** e **instruction_data** incluidos en la instrucción.

# Resumen
La capacidad de ejecutar código ejecutable arbitrario de Solana es parte de lo que lo hace tan poderoso. Los programas de Solana, similares a los "contratos inteligentes" en otros entornos de blockchain, son literalmente la columna vertebral del ecosistema de Solana. Y la colección de programas crece diariamente a medida que los desarrolladores y creadores sueñan y despliegan nuevos programas.

Esta lección le brindará una introducción básica a la escritura y despliegue de un programa de Solana utilizando el lenguaje de programación Rust. Para evitar la distracción de configurar un entorno de desarrollo local, usaremos una IDE basada en el navegador llamada Solana Playground.
## Básicos del Sistema RUST
Antes de sumergirnos en la construcción de nuestro programa "Hola mundo", primero repasemos algunos conceptos básicos de Rust. Si desea profundizar en Rust, consulte el [libro de lenguaje Rust](https://doc.rust-lang.org/book/ch00-00-introduction.html).


## Sistema de módulos
Rust organiza el código utilizando lo que se conoce colectivamente como el "sistema de módulos".

Esto incluye:
- **Módulos**: un módulo separa el código en unidades lógicas para proporcionar espacios de nombres aislados para la organización, el alcance y la privacidad de las rutas
- **Cajones**: una caja es ya sea una biblioteca o un programa ejecutable. El código fuente de una caja suele subdividirse en varios módulos.
- **Paquetes**: un paquete contiene una colección de cajones, así como un archivo de manifiesto para especificar metadatos y dependencias entre paquetes.

A lo largo de esta lección, nos centraremos en el uso de cajones y módulos.

## Rutas y alcance
Los cajones de Rust contienen módulos que definen funcionalidades que pueden compartirse con varios proyectos. Si queremos acceder a un elemento dentro de un módulo, entonces necesitamos conocer su "ruta" (como cuando navegamos un sistema de archivos).
Piensa en la estructura de la caja como un árbol donde la caja es la base y los módulos son ramas, cada uno de los cuales puede tener submódulos o elementos que son ramas adicionales.
La ruta a un módulo o elemento particular es el nombre de cada paso desde la caja hasta ese módulo, donde cada uno está separado por **::**. Como ejemplo, veamos la siguiente estructura:

1. La caja base es **solana_program** .
2. **solana_program** contiene un módulo llamado account_info
3. **account_info** contiene una estructura llamada AccountInfo

La ruta a **AccountInfo** sería **solana_program::account_info::AccountInfo** .

Ausente de cualquier otra palabra clave, necesitaríamos referenciar esta ruta completa para usar **AccountInfo** en nuestro código.
Sin embargo, con la palabra clave **use** , podemos traer un elemento al ámbito para que pueda reutilizarse a lo largo de un archivo sin especificar la ruta completa cada vez. Es común ver una serie de comandos **use** en la parte superior de un archivo de Rust.

```rust
use solana_program::account_info::AccountInfo
```

## Declarar funciones en Rust 
Definimos una función en Rust utilizando la palabra clave **fn** seguida del nombre de la función y un conjunto de paréntesis.

```rust
fn process_instruction()
```

Podemos agregar argumentos a nuestra función incluyendo nombres de variables y especificando su tipo de datos correspondiente dentro de los paréntesis.
Rust es conocido como un lenguaje "estáticamente tipado" y todos los valores en Rust son de cierto "tipo de datos". Esto significa que Rust debe conocer los tipos de todas las variables en tiempo de compilación. En los casos en los que son posibles varios tipos, debemos agregar una anotación de tipo a nuestras variables.

En el ejemplo siguiente, creamos una función llamada process_instruction que requiere los siguientes argumentos:

- **program_id** - requerido de tipo **&Pubkey**
- **cuentas** - requerido de tipo **&[AccountInfo]**
- **instruction_data** - requerido de tipo **&[u8]**

Tenga en cuenta el **&** frente al tipo para cada argumento listado en la función **process_instruction** . En Rust, **&** representa una "referencia" a otra variable. Esto permite hacer referencia a algún valor sin tomar posesión de él. La "referencia" está garantizada para apuntar a un valor válido de un tipo particular. La acción de crear una referencia en Rust se llama "prestar".

En este ejemplo, cuando se llama a la función **process_instruction** , un usuario debe pasar valores para los argumentos requeridos. La función **process_instruction** luego hace referencia a los valores pasados ??por el usuario y garantiza que cada valor es el tipo de datos correcto especificado en la función **process_instruction**.

Además, tenga en cuenta los corchetes **[]** alrededor de **&[AccountInfo]** y **&[u8]** . Esto significa que los argumentos **cuentas** e **instruction_data esperan** "rebanadas" de los tipos **AccountInfo** y **u8**, respectivamente. Una "rebaba" es similar a una matriz (colección de objetos del mismo tipo), excepto que el largo no se conoce en tiempo de compilación. En otras palabras, los argumentos **cuentas** e **instruction_data** esperan entradas de longitud desconocida.	

```rust
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
)
```

Entonces podemos tener nuestras funciones retornando valores declarando el tipo de retorno usando una flecha **->** después de la función.

En el ejemplo de abajo, la función **process_instruction** ahora retornará un valor de tipo ProgramResult. Veremos esto en la próxima sección.

```rust
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult
```

## Enumeración Result
**Result** es un tipo de biblioteca estándar que representa dos resultados discretos: éxito ( **Ok** ) o fallo ( **Err** ). Hablaremos más sobre los enumerados en una lección futura, pero verá que se usa **Ok** más adelante en esta lección, por lo que es importante cubrir los fundamentos.
Cuando usa **Ok** o **Err** , debe incluir un valor, cuyo tipo se determina por el contexto del código. Por ejemplo, una función que requiere un valor de retorno de tipo **Result<String, i64>** está diciendo que la función puede retornar **Ok** con un valor de cadena incrustado o **Err** con un entero incrustado. En este ejemplo, el entero es un código de error que se puede usar para manejar adecuadamente el error.

Para devolver un caso de éxito con un valor de cadena, haría lo siguiente:

```rust
Ok(String::from("Exito!"));
```

Para devolver un error con un entero, harías lo siguiente:

```rust
Err(404);
```

# Programas de Solana
Recuerda que todos los datos almacenados en la red de Solana están contenidos en lo que se denominan cuentas. Cada cuenta tiene su propia dirección única que se utiliza para identificar y acceder a los datos de la cuenta. Los programas de Solana son solo un tipo particular de cuenta de Solana que almacena e ejecuta instrucciones.

## Caja de programas de Solana
Para escribir programas de Solana con Rust, utilizamos la caja de biblioteca **solana_program** . La caja **solana_program** actúa como una biblioteca estándar para los programas de Solana. Esta biblioteca estándar contiene los módulos y macros que utilizaremos para desarrollar nuestros programas de Solana. Si desea profundizar en la caja **solana_program** , echa un vistazo [aquí](https://docs.rs/solana-program/latest/solana_program/index.html).

Para un programa básico, necesitaremos traer al ámbito los siguientes elementos de la caja **solana_program**:

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

- **AccountInfo**: es una estructura dentro del módulo **account_info** que nos permite acceder a la información de la cuenta.
- **entrypoint** : es una macro que declara el punto de entrada del programa.
- **ProgramResult** : es un tipo dentro del módulo **entrypoint** que devuelve un **Result** o un **ProgramError** .
- **Pubkey** : es una estructura dentro del módulo **pubkey** que nos permite acceder a las direcciones como una clave pública.
- **msg**: es una macro que nos permite imprimir mensajes en el registro del programa.

## Punto de entrada del programa Solana
Los programas Solana requieren un punto de entrada único para procesar las instrucciones del programa. El punto de entrada se declara utilizando la macro ¡ **entrypoint** !.

El punto de entrada de un programa Solana requiere una función **process_instruction** con los siguientes argumentos:

- **program_id** - la dirección de la cuenta donde se almacena el programa
- **cuentas** - la lista de cuentas necesarias para procesar la instrucción
- **datos de instrucción** - los datos específicos de la instrucción serializados.

```rust
entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult;
```

Es importante recordar que las cuentas de programas Solana solo almacenan la lógica para procesar las instrucciones. Esto significa que las cuentas de programas son "solo lectura" y "sin estado". El "estado" (el conjunto de datos) que un programa requiere para procesar una instrucción se almacena en cuentas de datos (separadas de la cuenta del programa).

Para procesar una instrucción, las cuentas de datos que requiere una instrucción deben pasarse explícitamente al programa a través del argumento **cuentas**. Cualquier entrada adicional debe pasarse a través del argumento **instruction_data**.

Después de la ejecución del programa, el programa debe devolver un valor de tipo **ProgramResult** . Este tipo es un **Result** donde el valor incrustado de un caso exitoso es **()** y el valor incrustado de un caso de fallo es **ProgramError** . **()** es efectivamente un valor vacío y **ProgramError** es un tipo de error definido en la biblioteca **solana_program**.

...y ahí lo tienes, ya sabes todo lo necesario para las bases de la creación de un programa Solana utilizando Rust. ¡Practiquemos lo que hemos aprendido hasta ahora!

# Demostración
Vamos a construir un programa "Hola, mundo" usando Solana Playground. Solana Playground es una herramienta que te permite escribir y desplegar programas Solana desde el navegador.

## 1. Configuración
Haga clic [aquí](https://beta.solpg.io) para abrir Solana Playground. A continuación, elimine todo en el archivo **lib.rs** predeterminado y cree una billetera de Playground.


![3.1](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%203/images/3.1/1.gif)


## 2. Biblioteca de programas Solana
Primero, traigamos al alcance todo lo que necesitaremos de la biblioteca **solana_program** .

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

A continuación, configuraremos el punto de entrada de nuestro programa utilizando la macro **entrypoint!** y crearemos la función **process_instruction** . La macro **msg!** entonces nos permite imprimir "Hola, mundo!" en el registro del programa cuando se invoca el programa.

## 3. Punto de entrada

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

Todo junto, el programa "Hola, mundo" se verá así:

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

## 4. Construir y desplegar 
Ahora construyamos y despleguemos nuestro programa usando Solana Playground.


![3.1.2](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%203/images/3.1/2.gif)


## 5. Invocar el programa
Finalmente, invoquemos nuestro programa desde el lado del cliente. Descargue el código [aquí](https://github.com/Unboxed-Software/solana-hello-world-client).
El enfoque de esta lección es construir nuestro programa Solana, por lo que hemos proporcionado el código del cliente para invocar nuestro programa "Hola, mundo”. El código proporcionado incluye una función de ayuda **sayHello** que construye y envía nuestra transacción. Luego llamamos a **sayHello** en la función principal y imprimimos una URL de Solana Explorer para ver los detalles de nuestra transacción en el navegador.

Abra el archivo **index.ts** debería ver una variable llamada **programId**. Actualice esta con la ID de programa del programa "Hola, mundo" que acaba de desplegar usando Solana Playground.


```typescript
let programId = new web3.PublicKey("<TU_ID_DE_PROGRAMA>");
```

Puede encontrar la ID del programa en Solana Playground haciendo referencia a la imagen a continuación.

![3.1.3](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%203/images/3.1/3.gif)


A continuación, instale los módulos de Node con **npm i** .
Ahora, ejecute **npm start** . Este comando hará lo siguiente:
1. Generar una nueva pareja de claves y crear un archivo **.env** si no existe ya
2. Airdrop devnet SOL
3. Invocar el programa "Hola, mundo"
4. Salida de la URL de la transacción para ver en Solana Explorer

Copie la URL de transacción impresa en la consola en su navegador. Desplácese hacia abajo para ver "Hola, mundo" en Program Instruction Logs.

![3.1.4](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%203/images/3.1/4.png)

Felicidades, ¡acabas de construir y desplegar con éxito un programa Solana!
# Desafío
Ahora es tu turno de construir algo de forma independiente. Como comenzamos con programas muy simples, el tuyo se verá casi idéntico a lo que acabamos de crear. Es útil tratar de llegar al punto en el que puedas escribirlo desde cero sin hacer referencia al código anterior, así que intenta no copiar y pegar aquí.
1. Escriba un nuevo programa que utilice la macro **msg!** para imprimir su propio mensaje en el registro del programa.
2. Construya y despliegue su programa como lo hicimos en la demostración.
3. Invoque su programa recién desplegado y utilice Solana Explorer para verificar que su mensaje se imprimió en el registro del programa.

Como siempre, sé creativo con estos desafíos y llevarlos más allá de las instrucciones básicas si lo deseas y ¡diviértete!
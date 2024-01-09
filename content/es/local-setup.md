---
título: Objetivos de desarrollo del programa local
objectives:
- Crear un entorno local para el desarrollo del programa Solana
- Usar comandos CLI básicos de Solana
- Ejecutar un validador de prueba local
- Utilice Rust y Solana CLI para implementar un programa Solana desde su entorno de desarrollo local
- Utilice la CLI de Solana para ver los registros del programa
---

# TL;DR

-   Para comenzar con Solana localmente, primero deberá instalar **Herrumbre** y **Solana CLI**
-   Usando la CLI de Solana puede ejecutar un **validador de prueba local** usando el `solana-test-validator` comando
-   Una vez que tenga instalados Rust y Solana CLI, podrá compilar e implementar sus programas localmente utilizando los `solana program deploy` comandos `cargo build-bpf` and
-   Puede ver los registros del programa usando el `solana logs` comando

# Descripción general

Hasta ahora en este curso, hemos utilizado Solana Playground para desarrollar e implementar programas de Solana. Y aunque es una gran herramienta, para ciertos proyectos complejos es posible que prefiera tener un entorno de desarrollo local configurado. Esto puede ser para usar cajas que no son compatibles con Solana Playground, para aprovechar los scripts personalizados o las herramientas que ha creado, o simplemente por preferencia personal.

Dicho esto, esta lección será ligeramente diferente de las demás. En lugar de cubrir mucho terreno sobre cómo escribir un programa o interactuar con la red Solana, esta lección se centrará principalmente en la tarea menos glamorosa de configurar su entorno de desarrollo local.

Para crear, probar e implementar programas de Solana desde su máquina, deberá instalar el compilador Rust y la interfaz de línea de comandos (CLI) de Solana. Comenzaremos guiándolo a través de estos procesos de instalación, luego cubriremos cómo usar lo que acaba de instalar.

Las instrucciones de instalación a continuación contienen los pasos para instalar Rust y Solana CLI en el momento de la escritura. Es posible que hayan cambiado en el momento en que está leyendo esto, por lo que si tiene problemas, consulte las páginas de instalación oficiales para cada uno:

-   [Instalar óxido](https://www.rust-lang.org/tools/install)
-   [Instalar Solana Tool Suite](https://docs.solana.com/cli/install-solana-cli-tools)

## Configuración en Windows (con Linux)

### Descargar el subsistema de Windows para Linux (WSL)

Si está en un equipo con Windows, se recomienda usar el Subsistema de Windows para Linux (WSL) para crear sus Programas de Solana.

Abra un **administrador** símbolo del sistema de PowerShell o Windows y compruebe la versión de Windows

```bash
winver
```

Si está en Windows 10 versión 2004 o superior (compilación 19041 o superior) o Windows 11, ejecute el siguiente comando.

```bash
wsl --install
```

Si está ejecutando una versión anterior de Windows, siga las instrucciones[here](https://docs.microsoft.com/en-us/windows/wsl/install-manual).

Puede leer más sobre la instalación de WSL[here](https://docs.microsoft.com/en-us/windows/wsl/install).

### Descargar Ubuntu

A continuación, descargue Ubuntu[here](https://apps.microsoft.com/store/detail/ubuntu-2004/9N6SVWS3RX71?hl=en-us&gl=US). Ubuntu proporciona un terminal que le permite ejecutar Linux en un equipo con Windows. Aquí es donde ejecutarás los comandos CLI de Solana.

### Descargar Rust (para WSL)

A continuación, abra un terminal Ubuntu y descargue Rust for WSL utilizando el siguiente comando. Puedes leer más sobre la descarga de Rust[here](https://www.rust-lang.org/learn/get-started).

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Descargar Solana CLI

Ahora estamos listos para descargar Solana CLI para Linux. Sigue adelante y ejecuta el siguiente comando en una terminal de Ubuntu. Puedes leer más sobre la descarga de Solana CLI[here](https://docs.solana.com/cli/install-solana-cli-tools).

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

## Configuración en macOS

### Descargar Rust

Primero, descargue Rust siguiendo las instrucciones [here](https://www.rust-lang.org/tools/install)

### Descarga la CLI de Solana

A continuación, descargue la CLI de Solana ejecutando el siguiente comando en su terminal.

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

Puedes leer más sobre la descarga de la CLI de Solana[here](https://docs.solana.com/cli/install-solana-cli-tools).

## Conceptos básicos de CLI de Solana

La CLI de Solana es una herramienta de interfaz de línea de comandos que proporciona una colección de comandos para interactuar con un clúster de Solana.

Cubriremos algunos de los comandos más comunes en esta lección, pero siempre puede ver la lista de todos los comandos CLI de Solana posibles ejecutándolos `solana --help`.

### Configuración CLI Solana

La CLI de Solana almacena una serie de ajustes de configuración que afectan al comportamiento de ciertos comandos. Puede utilizar el siguiente comando para ver la configuración actual:

```bash
solana config get
```

El `solana config get` comando devolverá lo siguiente:

-   `Config File` - el archivo Solana CLI se encuentra en su ordenador
-   `RPC URL` - endpoint que está utilizando, conectándolo a localhost, Devnet o Mainnet
-   `WebSocket URL` - el webocket para escuchar eventos del clúster al que se dirige (calculado cuando configura el `RPC URL`)
-   `Keypair Path` - la ruta del par de teclas utilizada al ejecutar los subcomandos CLI de Solana
-   `Commitment` Proporciona una medida de la confirmación de la red y describe cómo está finalizado un bloque en ese momento.

Puede cambiar su configuración de CLI de Solana en cualquier momento utilizando el `solana config set` comando seguido de la configuración que desea actualizar.

El cambio más común será en el clúster al que se dirige. Utilice el `solana config set --url` comando para cambiar `RPC URL`.

```bash
solana config set --url localhost
```

```bash
solana config set --url devnet
```

```bash
solana config set --url mainnet-beta
```

Del mismo modo, puede usar el `solana config set --keypair` comando para cambiar el `Keypair Path`. Solana CLI utilizará el par de teclas de la ruta especificada al ejecutar comandos.

```bash
solana config set --keypair ~/<FILE_PATH>
```

### Validadores de pruebas

A menudo le resultará útil ejecutar un validador local para probar y depurar en lugar de implementar en Devnet.

Puede ejecutar un validador de prueba local usando el `solana-test-validator` comando. Este comando crea un proceso continuo que requerirá su propia ventana de línea de comandos.

### Registros de programas de flujo

A menudo es útil abrir una nueva consola y ejecutar el `solana logs` comando junto con el validador de prueba. Esto crea otro proceso en curso que transmitirá los registros asociados con el clúster de su configuración.

Si se apunta a la configuración de `localhost` CLI, los registros siempre se asociarán con el validador de prueba que haya creado, pero también puede transmitir registros de otros clústeres como Devnet y Mainnet Beta. Al transmitir registros de otros clústeres, querrá incluir un ID de programa con el comando para limitar los registros que ve a su programa específico.

### Pares de teclas

Puede generar un nuevo par de claves utilizando el `solana-keygen new --outfile` comando seguido de la ruta del archivo para almacenar el par de claves.

```bash
solana-keygen new --outfile ~/<FILE_PATH>
```

A veces es posible que deba comprobar a qué par de teclas apunta su configuración. Para ver el par `publickey` de teclas actual establecido `solana config`, utilice el `solana address` comando.

```bash
solana address
```

Para ver el balance de SOL del par de teclas actual establecido `solana config`, utilice el `solana balance` comando.

```bash
solana balance
```

Para enviar SOL en Devnet o localhost, use el `solana airdrop` comando. Tenga en cuenta que mientras esté en Devnet, está limitado a 2 SOLES por lanzamiento aéreo.

```bash
solana airdrop 2
```

A medida que desarrolle y pruebe programas en su entorno local, es probable que encuentre errores causados por:

-   Usar el par de teclas incorrecto
-   No tener suficiente SOL para implementar su programa o realizar una transacción
-   Señalar el clúster equivocado

Los comandos CLI que hemos cubierto hasta ahora deberían ayudarlo a resolver rápidamente esos problemas.

## Desarrollar programas de Solana en su entorno local

Si bien el parque infantil Solana es enormemente útil, es difícil superar la flexibilidad de su propio entorno de desarrollo local. A medida que desarrolle programas más complejos, puede terminar integrándolos con uno o más clientes que también están en desarrollo en su entorno local. Las pruebas entre estos programas y los clientes a menudo son más simples cuando escribes, construyes e implementas tus programas localmente.

### Crear un nuevo proyecto

Para crear un nuevo paquete Rust para escribir un programa Solana, puede usar el `cargo new --lib` comando con el nombre del nuevo directorio que desea crear.

```bash
cargo new --lib <PROJECT_DIRECTORY_NAME>
```

Este comando creará un nuevo directorio con el nombre que especificó al final del comando. Este nuevo directorio contendrá un archivo de `Cargo.toml` manifiesto que describe el paquete.

El archivo de manifiesto contiene metadatos como nombre, versión y dependencias (cajas). Para escribir un programa de Solana, deberá actualizar el `Cargo.toml` archivo para incluirlo `solana-program` como una dependencia. También es posible que deba añadir las `crate-type` líneas `[lib]` y que se muestran a continuación.

```rust
[package]
name = "<PROJECT_DIRECTORY_NAME>"
version = "0.1.0"
edition = "2021"

[features]
no-entrypoint = []

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

En ese momento, puede comenzar a escribir su programa en la `src` carpeta.

### Construir e implementar

Cuando llegue el momento de construir su programa Solana, puede usar el `cargo build-bpf` comando.

```bash
cargo build-bpf
```

La salida de este comando incluirá instrucciones para la implementación de su programa que se ven algo como esto:

```text
To deploy this program:
  $ solana program deploy /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local.so
The program address will default to this keypair (override with --program-id):
  /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local-keypair.json
```

Cuando esté listo para implementar el programa, utilice la salida de `solana program deploy` comandos de `cargo build-bpf`. Esto implementará su programa en el clúster especificado en su configuración de CLI.

```rust
solana program deploy <PATH>
```

# Demostración

Practiquemos construyendo e implementando el programa "Hello World!" que creamos en el[Lección Hello World](https://github.com/Unboxed-Software/solana-course/pull/content/hello-world-program).

Haremos todo esto localmente, incluida la implementación en un validador de pruebas local. Antes de comenzar, asegúrese de haber instalado Rust y Solana CLI. Puede consultar las instrucciones en la descripción general para configurarse si aún no lo ha hecho.

### 1. Crear un nuevo proyecto Rust

Empecemos por crear un nuevo proyecto de Rust. Ejecute el `cargo new --lib` comando a continuación. Siéntase libre de reemplazar el nombre del directorio con el suyo propio.

```bash
cargo new --lib solana-hello-world-local
```

Recuerde actualizar el `cargo.toml` archivo para incluirlo `solana-program` como una dependencia y `crate-type` si aún no está allí.

```bash
[package]
name = "solana-hello-world-local"
version = "0.1.0"
edition = "2021"

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

### 2. Escribe tu programa

A continuación, actualice `lib.rs` con el programa "Hello World!" a continuación. Este programa simplemente imprime "¡Hola, mundo!" en el registro del programa cuando se invoca el programa.

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

### 3. Ejecutar un validador de prueba local

Con su programa escrito, asegurémonos de que nuestra configuración CLI de Solana apunte a localhost mediante el `solana config set --url` comando.

```bash
solana config set --url localhost
```

A continuación, compruebe que la configuración de CLI de Solana se ha actualizado mediante el `solana config get` comando.

```bash
solana config get
```

Finalmente, ejecute un validador de prueba local. En una ventana de terminal separada, ejecute el `solana-test-validator` comando. Esto solo es necesario cuando nuestro `RPC URL` está configurado como localhost.

```bash
solana-test-validator
```

### 4. Construir e implementar

Ahora estamos listos para construir y desplegar nuestro programa. Cree el programa ejecutando el `cargo build-bpf` comando.

```bash
cargo build-bpf
```

Ahora vamos a desplegar nuestro programa. Ejecute la salida de `solana program deploy` comando desde `cargo build-bpf`.

```bash
solana program deploy <PATH>
```

El `solana program deploy` dará salida al `Program ID` para su programa. Ahora puede buscar el programa implementado en [Solana Explorer](https://explorer.solana.com/?cluster=custom) (para localhost, seleccione "URL RPC personalizada" como el clúster).

### 5. Ver registros del programa

Antes de invocar nuestro programa, abra un terminal separado y ejecute el `solana logs` comando. Esto permitirá el uso para ver los registros de programa en el terminal.

```bash
solana logs <PROGRAM_ID>
```

Con el validador de pruebas aún en ejecución, intente invocar su programa utilizando el script del lado del cliente[here](https://github.com/Unboxed-Software/solana-hello-world-client).

Reemplace el ID del programa `index.ts` con el del programa que acaba de implementar y, a continuación, ejecute `npm install` seguido de `npm start`. Esto devolverá una URL de Solana Explorer. Copie la URL en el navegador para buscar la transacción en Solana Explorer y compruebe que "¡Hola, mundo!" se imprimió en el registro del programa. Alternativamente, puede ver los registros del programa en la terminal donde ejecutó el `solana logs` comando.

¡Y eso es todo! Acaba de crear e implementar su primer programa desde un entorno de desarrollo local.

# Desafío

Ahora es tu turno de construir algo de forma independiente. Intente crear un nuevo programa para imprimir su propio mensaje en los registros del programa. Esta vez, implemente su programa en Devnet en lugar de localhost.

Recuerde actualizar su `RPC URL` a Devnet usando el `solana config set --url` comando.

Puede invocar el programa utilizando el mismo script del lado del cliente de la demostración, siempre y cuando actualice la URL `connection` y Solana Explorer para que apunten a Devnet en lugar de localhost.

```tsx
let connection = new web3.Connection(web3.clusterApiUrl("devnet"));
```

```tsx
console.log(
    `Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
);
```

También puede abrir una ventana de línea de comandos separada y usar la `solana logs | grep "<PROGRAM_ID> invoke" -A <NUMBER_OF_LINES_TO_RETURN>`. Cuando se utiliza `solana logs` en Devnet, debe especificar el ID del programa. De lo contrario, el `solana logs` comando devolverá un flujo constante de registros de Devnet. Por ejemplo, haría lo siguiente para monitorear las invocaciones al Programa Token y mostrar las primeras 5 líneas de registros para cada invocación:

```bash
solana logs | grep "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke" -A 5
```

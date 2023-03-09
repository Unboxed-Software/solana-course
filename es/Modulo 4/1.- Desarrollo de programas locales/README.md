# Desarrollo de programas locales
## Objetivos de la lección

*Al final de esta lección, podrás:*

- Configurar un entorno local para el desarrollo de programas de Solana
- Utilizar comandos básicos de la CLI de Solana
- Ejecutar un validador de prueba local
- Utilizar Rust y la CLI de Solana para implementar un programa de Solana desde tu entorno de desarrollo local
- Utilizar la CLI de Solana para ver los registros de programas

# Terminología 

- Para empezar con Solana localmente, primero necesitarás instalar **Rus**t y el **CLI de Solana** .
- Usando el CLI de Solana, puedes **ejecutar un validador de pruebas local** usando el comando **solana-test-validator**.
- Una vez que tengas instalado Rust y el CLI de Solana, podrás construir y desplegar tus programas localmente usando los comandos **cargo build-bpf** y **solana program deploy** .
- Puedes ver los registros de programas usando el comando **solana logs** .

#Resumen
Hasta ahora en este curso, hemos usado Solana Playground para desarrollar y desplegar programas Solana. Y aunque es una gran herramienta, para ciertos proyectos complejos es posible que prefieras tener un entorno de desarrollo local configurado. Esto puede ser para usar cajones no compatibles con Solana Playground, para aprovechar los scripts personalizados o las herramientas que has creado, o simplemente por preferencia personal.

Dicho esto, esta lección será un poco diferente de las demás. En lugar de cubrir una gran cantidad de terreno sobre cómo escribir un programa o interactuar con la red Solana, esta lección se centrará principalmente en la tarea menos glamorosa de configurar tu entorno de desarrollo local.

Para construir, probar y desplegar programas Solana desde tu máquina, necesitarás instalar el compilador de Rust y la interfaz de línea de comando (CLI) de Solana. Comenzaremos guiándote a través de estos procesos de instalación, luego cubriremos cómo usar lo que acabas de instalar.

Las instrucciones de instalación a continuación contienen los pasos para instalar Rust y la CLI de Solana en el momento de la escritura. Pueden haber cambiado cuando estés leyendo esto, así que si tienes problemas, consulta las páginas de instalación oficiales de cada uno:

- [Instalar Rust](https://www.rust-lang.org/tools/install)
- [Instalar el conjunto de herramientas Solana](https://docs.solana.com/cli/install-solana-cli-tools)

## Configuración en Windows (con Linux)

### Descarga Windows Subsystem for Linux (WSL)

Si estás en una computadora con Windows, se recomienda usar Windows Subsystem for Linux (WSL) para construir tus programas Solana.

Abre un PowerShell de **administrador** o una línea de comando de Windows y revisa la versión de Windows

```powershell
winver
```

Si estás en Windows 10 versión 2004 o superior (Build 19041 o superior) o Windows 11, ejecuta el siguiente comando.

```powershell
wsl --install
```

Si estás ejecutando una versión anterior de Windows, sigue las instrucciones [aquí](https://learn.microsoft.com/en-us/windows/wsl/install-manual).
Puedes leer más sobre cómo instalar WSL [aquí](https://learn.microsoft.com/en-us/windows/wsl/install) .

### Descargar Ubuntu
A continuación, descarga Ubuntu [aquí](https://learn.microsoft.com/en-us/windows/wsl/install). Ubuntu proporciona un terminal que te permite ejecutar Linux en una computadora con Windows. Aquí es donde ejecutarás los comandos de la CLI de Solana.

### Descargar Rust (para WSL)
A continuación, abre un terminal de Ubuntu y descarga Rust para WSL utilizando el siguiente comando. Puedes leer más sobre cómo descargar Rust [aquí](https://www.rust-lang.org/learn/get-started) .

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Descargar la CLI de Solana
Ahora estamos listos para descargar la CLI de Solana para Linux. Ve adelante y ejecuta el siguiente comando en un terminal de Ubuntu. Puedes leer más sobre cómo descargar la CLI de Solana [aquí](https://docs.solana.com/cli/install-solana-cli-tools) .

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

## Configuración en macOS

### Descargar Rust
Primero, descarga Rust siguiendo las instrucciones [aquí](https://www.rust-lang.org/tools/install)

## Descargar la CLI de Solana
A continuación, descarga la CLI de Solana ejecutando el siguiente comando en tu terminal.

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

Puedes leer más sobre cómo descargar la CLI de Solana [aquí](https://docs.solana.com/cli/install-solana-cli-tools) .

## Los fundamentos de la CLI de Solana
La CLI de Solana es una herramienta de interfaz de línea de comando que proporciona una colección de comandos para interactuar con un clúster de Solana.

Cubriremos algunos de los comandos más comunes en esta lección, pero siempre puedes ver la lista de todos los comandos posibles de la CLI de Solana ejecutando **solana –help** .

### Configuración de la CLI de Solana
La CLI de Solana almacena una serie de configuraciones que afectan al comportamiento de ciertos comandos. Puedes usar el siguiente comando para ver la configuración actual:

```bash
solana config get
```

El comando **solana config get**  devolverá lo siguiente:
-  **Archivo de configuración** : el archivo donde se encuentra la CLI de Solana en tu computadora.
- **URL RPC** : punto final que estás usando, te conecta a localhost, Devnet o Mainnet.
- **URL WebSocket** : el websocket para escuchar eventos del clúster al que estás apuntando (se calcula cuando estableces la **URL RPC** ).
- Ruta de la **clave privada** : la ruta de la clave privada utilizada al ejecutar subcomandos de la CLI de Solana.
- **Commitment** : proporciona una medida de la confirmación de la red y describe cómo está finalizado un bloque en ese momento.

Puedes cambiar la configuración de la CLI de Solana en cualquier momento utilizando el comando **solana config set**  seguido del ajuste que deseas actualizar.

El cambio más común será el clúster al que estés apuntando. Utilice el comando solana **config set –url** para cambiar la **URL RPC** .

```bash
solana config set --url localhost
```

```bash
solana config set --url devnet
```

```bash
solana config set --url mainnet-beta
```

De manera similar, puedes usar el comando solana **config set –keypair** para cambiar la ruta de la **clave privada** . Entonces, la CLI de Solana utilizará la clave privada desde la ruta especificada al ejecutar comandos.

```bash
solana config set --keypair ~/<FILE_PATH>
```

### Probar validadores
A menudo te resultará útil ejecutar un validador local para pruebas y depuración en lugar de implementar en Devnet.

Puedes ejecutar un validador de prueba local utilizando el comando **solana-test-validator** . Este comando crea un proceso continuo que requerirá su propia ventana de línea de comando.

### Transmitir registros de programas
A menudo es útil abrir una nueva consola y ejecutar el comando **solana logs** junto con el validador de prueba. Esto crea otro proceso continuo que transmitirá los registros asociados con el clúster de tu configuración.

Si la configuración de tu CLI apunta a **localhost** , los registros siempre estarán asociados con el validador de prueba que hayas creado, pero también puedes transmitir registros de otros clústeres como Devnet y Mainnet Beta. Al transmitir registros de otros clústeres, querrás incluir un ID de programa con el comando para limitar los registros que veas a tu programa específico.

### Claves privadas
Puedes generar una nueva clave privada utilizando el comando **solana-keygen new –outfile** seguido de la ruta del archivo para almacenar la clave privada.

```bash
solana-keygen new --outfile ~/<FILE_PATH>
```

A veces puede ser necesario verificar a qué clave privada apunta tu configuración. Para ver la **clave pública** de la clave privada actual configurada en **solana config** , utiliza el comando **solana address** .

```bash
solana address
```

Para ver el saldo de SOL de la clave privada actual configurada en **solana config** , utiliza el comando **solana balance** .

```bash
solana balance
```

Para airdrop SOL en Devnet o localhost, utiliza el comando **solana airdrop** . Ten en cuenta que mientras estás en Devnet estás limitado a 2 SOL por airdrop.

```bash
solana airdrop 2
```

A medida que desarrolles y pruebes programas en tu entorno local, es probable que encuentres errores causados por:

- Usar la clave privada incorrecta
- No tener suficientes SOL para implementar tu programa o realizar una transacción
- Apuntando al clúster incorrecto

Los comandos de CLI que hemos cubierto hasta ahora deberían ayudarlo a resolver rápidamente esos problemas.

## Desarrollar programas Solana en su entorno local
Aunque el Solana Playground es enormemente útil, es difícil superar la flexibilidad de su propio entorno de desarrollo local. A medida que construye programas más complejos, es posible que termines integrándolos con uno o más clientes que también estén en desarrollo en tu entorno local. La prueba entre estos programas y clientes suele ser más sencilla cuando escribes, construyes y despliegas tus programas localmente.

### Crear un nuevo proyecto
Para crear un nuevo paquete Rust para escribir un programa Solana, puede usar el comando **cargo new –lib** con el nombre del nuevo directorio que desea crear.

```bash
cargo new --lib <PROJECT_DIRECTORY_NAME>
```

Este comando creará un nuevo directorio con el nombre que especificó al final del comando. Este nuevo directorio contendrá un archivo de manifiesto **Cargo.toml** que describe el paquete. 

El archivo de manifiesto contiene metadatos como nombre, versión y dependencias (crates). Para escribir un programa Solana, deberá actualizar el archivo **Cargo.toml** para incluir **solana-program** como una dependencia. También es posible que deba agregar las líneas **[lib]** y **crate-type** mostradas a continuación.

```toml
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

En ese punto, puede comenzar a escribir su programa en la carpeta **src** .

### Construye y Despliega
Cuando llegue el momento de construir su programa Solana, puede usar el comando **cargo build-bpf** .

```bash
cargo build-bpf
```

La salida de este comando incluirá instrucciones para desplegar su programa que se verán algo así:

```
To deploy this program:
  $ solana program deploy /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local.so
The program address will default to this keypair (override with --program-id):
  /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local-keypair.json
```

Cuando estés listo para implementar el programa, utiliza la salida del comando **solana program deploy** del **cargo build-bpf** . Esto implementará tu programa en el cluster especificado en tu configuración de CLI.

```bash
solana program deploy <PATH>
```


#Demostración
Practiquemos construyendo y implementando el programa "Hola mundo” que creamos en la **lección Hola mundo** .
Haremos todo esto localmente, incluida la implementación en un validador de prueba local. Antes de comenzar, asegúrate de haber instalado Rust y la CLI de Solana. Puedes consultar las instrucciones en la introducción para configurarlo si aún no lo has hecho.

## 1. Crear un nuevo proyecto de Rust
Empecemos creando un nuevo proyecto de Rust. Ejecuta el comando **cargo new –lib** a continuación. Sientete libre de reemplazar el nombre del directorio con el tuyo.

```bash
cargo new --lib solana-hello-world-local
```

Recuerda actualizar el archivo **cargo.toml** para incluir **solana-program** como una dependencia y el **tipo de caja** si aún no está allí.

```toml
[package]
name = "solana-hello-world-local"
version = "0.1.0"
edition = "2021"

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

## 2. Escribir tu programa
A continuación, actualiza **lib.rs** con el programa "Hola mundo" a continuación. Este programa simplemente imprime "Hola, mundo" en el registro del programa cuando se invoca el programa.

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

## 3. Ejecutar un validador de prueba local
Con tu programa escrito, asegurémonos de que nuestra configuración de CLI de Solana apunte a localhost utilizando el comando **solana config set –url**.

```bash
solana config set --url localhost
```

A continuación, verifique que la configuración de la línea de comandos de Solana se haya actualizado utilizando el comando **solana config get**.

```bash
solana config get
```

Finalmente, ejecute un validador de prueba local. En una ventana de terminal separada, ejecute el comando **solana-test-validator** . Esto solo es necesario cuando nuestra **URL RPC** está configurada como localhost.

```bash
solana-test-validator
```

## 4. Construye y Despliega
Ahora estamos listos para construir y desplegar nuestro programa. Construya el programa ejecutando el comando **cargo build-bpf**.

```bash
cargo build-bpf
```

Ahora despleguemos nuestro programa. Ejecute el comando **solana program deploy** con la salida del comando **cargo build-bpf**.

```bash
solana program deploy <PATH>
```

El comando **solana program deploy** generará una **ID de Programa** para tu programa. Ahora puedes buscar el programa desplegado en [Solana Explorer](https://explorer.solana.com/?cluster=custom) (para localhost, selecciona "Custom RPC URL" como cluster).


## 5. Ver registros del programa
Antes de invocar nuestro programa, abra una terminal separada y ejecute el comando **solana logs** . Esto nos permitirá ver los registros del programa en la terminal.

```bash
solana logs <PROGRAM_ID>
```

Con el validador de prueba todavía en ejecución, intente invocar su programa utilizando el script del lado del cliente aquí. 
Reemplace la ID del programa en **index.ts** con la del programa que acaba de desplegar, luego ejecute **npm install** seguido de npm start. Esto devolverá una URL de Solana Explorer. Copie la URL en el navegador para buscar la transacción en Solana Explorer y verificar que se haya impreso "Hola mundo" en el registro del programa. Alternativamente, puede ver los registros del programa en la terminal donde ejecutó el comando **solana logs**.

¡Y eso es todo! Acaba de crear y desplegar su primer programa desde un entorno de desarrollo local.

# Reto
Ahora es tu turno de construir algo de manera independiente. Intenta crear un nuevo programa para imprimir tu propio mensaje en los registros del programa. Esta vez despliega tu programa en Devnet en lugar de en localhost.

Recuerda actualizar tu **URL RPC** a Devnet utilizando el comando **solana config set –url**.

Puedes invocar el programa utilizando el mismo script del lado del cliente de la demostración, siempre y cuando actualices la **conexión** y la URL de Solana Explorer para que ambas apunten a Devnet en lugar de localhost.

```typescript
let connection = new web3.Connection(web3.clusterApiUrl("devnet"));
```

```typescript
console.log(
    `Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
);
```

También puede abrir una ventana de línea de comandos separada y usar **solana logs | grep "<PROGRAM_ID> invoke" -A <NUMBER_OF_LINES_TO_RETURN>**. Cuando se usa **solana logs** en Devnet, debe especificar el ID del programa. De lo contrario, el comando **solana logs** devolverá un flujo constante de registros de Devnet. Por ejemplo, haría lo siguiente para monitorizar las invocaciones al Programa Token y mostrar las primeras 5 líneas de registros para cada invocación.

```bash
solana logs | grep "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke" -A 5
```
---
title: Variables de entorno en los objetivos de los Programas Solana
objectives:
- Definir características del programa en el `Cargo.toml` archivo
- Utilice el `cfg` atributo Rust para compilar código condicionalmente en función de qué características están o no habilitadas
- Utilice la `cfg!` macro Rust para compilar código condicionalmente en función de qué características están o no habilitadas
- Crear una instrucción de solo administrador para configurar una cuenta de programa que se pueda usar para almacenar valores de configuración del programa
---

# TL;DR

-   No hay soluciones "listas para usar" para crear entornos distintos en un programa en cadena, pero puede lograr algo similar a las variables de entorno si se vuelve creativo.
-   Puede usar el `cfg` atributo with **Características de óxido** ( `#[cfg(feature =...)]`) para ejecutar diferentes códigos o proporcionar diferentes valores de variables en función de la función Rust proporcionada*Esto sucede en tiempo de compilación y no le permite intercambiar valores después de que se haya implementado un programa*.
-   Del mismo modo, puede utilizar el `cfg!` **macro** para compilar diferentes rutas de código en función de las características que están habilitadas.
-   Alternativamente, puede lograr algo similar a las variables de entorno que se pueden modificar después de la implementación mediante la creación de cuentas e instrucciones a las que solo puede acceder la autoridad de actualización del programa.

# Descripción general

Una de las dificultades que enfrentan los ingenieros en todos los tipos de desarrollo de software es la de escribir código comprobable y crear entornos distintos para el desarrollo local, las pruebas, la producción, etc.

Esto puede ser particularmente difícil en el desarrollo del programa Solana. Por ejemplo, imagine crear un programa de estacas NFT que recompense cada NFT apostado con 10 tokens de recompensa por día. ¿Cómo se prueba la capacidad de reclamar recompensas cuando las pruebas se ejecutan en unos pocos cientos de milisegundos, no el tiempo suficiente para ganar recompensas?

El desarrollo web tradicional resuelve algo de esto con variables de entorno cuyos valores pueden diferir en cada entorno distinto. "Actualmente, no hay un concepto formal de variables de entorno en un programa de Solana. Si lo hubiera, podría hacerlo para que las recompensas en su entorno de prueba sean de 10,000,000 de tokens por día y sería más fácil probar la capacidad de reclamar recompensas.

Afortunadamente, puedes lograr una funcionalidad similar si te pones creativo. El mejor enfoque es probablemente una combinación de dos cosas:

1. Banderas de características de óxido que le permiten especificar en su comando de compilación el "entorno" de la compilación, junto con el código que ajusta los valores específicos en consecuencia
2. Cuentas e instrucciones "solo para administradores" del programa a las que solo puede acceder la autoridad de actualización del programa

## Banderas de características de óxido

Una de las formas más sencillas de crear entornos es utilizar las funciones Rust. Las características se definen en la `[features]`  tabla del `Cargo.toml` archivo del programa. Puede definir varias características para diferentes casos de uso.

```toml
[features]
feature-one = []
feature-two = []
```

Es importante tener en cuenta que lo anterior simplemente define una característica. Para habilitar una función al probar su programa, puede usar la `--features` bandera con el `anchor test` comando.

```bash
anchor test -- --features "feature-one"
```

También puede especificar varias características separándolas con una coma.

```bash
anchor test -- --features "feature-one", "feature-two"
```

### Hacer código condicional usando el `cfg` atributo

Con una característica definida, puede usar el `cfg` atributo dentro de su código para compilar código condicionalmente en función de si una característica determinada está habilitada o no. Esto le permite incluir o excluir cierto código de su programa.

La sintaxis para usar el `cfg` atributo es como cualquier otro atributo macro: `#[cfg(feature=[FEATURE_HERE])]`. Por ejemplo, el siguiente código compila la función `function_for_testing` cuando la `testing` función está habilitada y de `function_when_not_testing` lo contrario:

```rust
#[cfg(feature = "testing")]
fn function_for_testing() {
    // code that will be included only if the "testing" feature flag is enabled
}

#[cfg(not(feature = "testing"))]
fn function_when_not_testing() {
    // code that will be included only if the "testing" feature flag is not enabled
}
```

Esto le permite habilitar o deshabilitar cierta funcionalidad en su programa Anchor en el momento de la compilación habilitando o deshabilitando la función.

No es exagerado imaginar querer usar esto para crear "entornos" distintos para diferentes implementaciones de programas. Por ejemplo, no todos los tokens tienen implementaciones en Mainnet y Devnet. Por lo tanto, puede codificar una dirección de token para las implementaciones de Mainnet, pero codificar una dirección diferente para las implementaciones de Devnet y Localnet. De esa manera, puede cambiar rápidamente entre diferentes entornos sin requerir ningún cambio en el código en sí.

El siguiente código muestra un ejemplo de un programa de anclaje que utiliza el `cfg` atributo para incluir diferentes direcciones de token para pruebas locales en comparación con otras implementaciones:

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[cfg(feature = "local-testing")]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("WaoKNLQVDyBx388CfjaVeyNbs3MT2mPgAhoCfXyUvg8");
}

#[cfg(not(feature = "local-testing"))]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

#[program]
pub mod test_program {
    use super::*;

    pub fn initialize_usdc_token_account(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = payer,
    )]
    pub token: Account<'info, TokenAccount>,
    #[account(address = constants::USDC_MINT_PUBKEY)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

En este ejemplo, el `cfg` atributo se usa para compilar condicionalmente dos implementaciones diferentes del `constants` módulo. Esto permite que el programa use diferentes valores para la `USDC_MINT_PUBKEY` constante dependiendo de si la `local-testing` característica está habilitada o no.

### Hacer el código condicional usando la `cfg!` macro

Al igual que el `cfg` atributo, `cfg!` **macro** en Rust le permite comprobar los valores de ciertas banderas de configuración en tiempo de ejecución. Esto puede ser útil si desea ejecutar diferentes rutas de código dependiendo de los valores de ciertas banderas de configuración.

Puede usar esto para omitir o ajustar las restricciones basadas en el tiempo requeridas en la aplicación de estacas NFT que mencionamos anteriormente. Al ejecutar una prueba, puede ejecutar código que proporcione recompensas de apuesta mucho más altas en comparación con la ejecución de una compilación de producción.

Para utilizar la `cfg!` macro en un programa de Anchor, basta con añadir una llamada de `cfg!` macro a la instrucción condicional en cuestión:

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn test_function(ctx: Context<Test>) -> Result<()> {
        if cfg!(feature = "local-testing") {
            // This code will be executed only if the "local-testing" feature is enabled
            // ...
        } else {
            // This code will be executed only if the "local-testing" feature is not enabled
            // ...
        }
        // Code that should always be included goes here
        ...
        Ok(())
    }
}
```

En este ejemplo, el `test_function` utiliza la `cfg!` macro para comprobar el valor de la `local-testing` característica en tiempo de ejecución. Si la `local-testing` característica está habilitada, se ejecuta la primera ruta de código. Si la `local-testing` característica no está habilitada, se ejecuta en su lugar la segunda ruta de código.

## Instrucciones solo para administradores

Las banderas de características son excelentes para ajustar los valores y las rutas de código en la compilación, pero no ayudan mucho si termina necesitando ajustar algo después de que ya haya implementado su programa.

Por ejemplo, si su programa de apuestas NFT tiene que pivotar y usar un token de recompensas diferente, no habría forma de actualizar el programa sin volver a implementarlo. Si solo hubiera una forma para que los administradores de programas actualicen ciertos valores de programa... ¡Bueno, es posible!

Primero, debe estructurar su programa para almacenar los valores que anticipa cambiar en una cuenta en lugar de codificarlos en el código del programa.

A continuación, debe asegurarse de que esta cuenta solo pueda ser actualizada por alguna autoridad de programa conocida, o lo que estamos llamando a un administrador. Eso significa que cualquier instrucción que modifique los datos en esta cuenta debe tener restricciones que limiten quién puede firmar la instrucción. Esto suena bastante sencillo en teoría, pero hay un problema principal: ¿cómo sabe el programa quién es un administrador autorizado?

Bueno, hay algunas soluciones, cada una con sus propios beneficios e inconvenientes:

1. Hard-code una clave pública de administrador que se puede usar en las restricciones de instrucción solo para administradores.
2. Haga que la autoridad de actualización del programa sea el administrador.
3. Almacene el administrador en la cuenta de configuración y establezca el primer administrador en una `initialize` instrucción.

### Crear la cuenta de configuración

El primer paso es añadir lo que llamaremos una cuenta "config" a su programa. Puede personalizar esto para que se adapte mejor a sus necesidades, pero le sugerimos un solo PDA global. En Anchor, eso simplemente significa crear una estructura de cuenta y usar una sola semilla para derivar la dirección de la cuenta.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

El ejemplo anterior muestra una cuenta de configuración hipotética para el ejemplo del programa de estacas NFT al que hemos hecho referencia a lo largo de la lección. Almacena datos que representan el token que se debe usar para recompensas y la cantidad de tokens que se deben entregar por cada día de apuesta.

Con la cuenta de configuración definida, simplemente asegúrese de que el resto de su código haga referencia a esta cuenta cuando use estos valores. De esta manera, si los datos en la cuenta cambian, el programa se adapta en consecuencia.

### Limitar las actualizaciones de configuración a los administradores con código duro

Necesitará una forma de inicializar y actualizar los datos de la cuenta de configuración. Eso significa que necesita tener una o más instrucciones que solo un administrador puede invocar. La forma más sencilla de hacerlo es codificar la clave pública de un administrador en su código y luego agregar un simple chequeo de firmante en la validación de la cuenta de su instrucción comparando al firmante con esta clave pública.

En Anchor, restringir una `update_program_config` instrucción para que solo sea utilizable por un administrador con código duro podría verse así:

```rust
#[program]
mod my_program {
    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        reward_token: Pubkey,
        rewards_per_day: u64
    ) -> Result<()> {
        ctx.accounts.program_config.reward_token = reward_token;
        ctx.accounts.program_config.rewards_per_day = rewards_per_day;

        Ok(())
    }
}

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN_PUBKEY: Pubkey = pubkey!("ADMIN_WALLET_ADDRESS_HERE");

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == ADMIN_PUBKEY)]
    pub authority: Signer<'info>,
}
```

Antes de que la lógica de instrucciones se ejecute, se realizará una verificación para asegurarse de que el firmante de la instrucción coincida con el código duro `ADMIN_PUBKEY`. Observe que el ejemplo anterior no muestra la instrucción que inicializa la cuenta de configuración, pero debe tener restricciones similares para garantizar que un atacante no pueda inicializar la cuenta con valores inesperados.

Si bien este enfoque funciona, también significa realizar un seguimiento de una billetera de administración además de realizar un seguimiento de la autoridad de actualización de un programa. Con algunas líneas más de código, simplemente puede restringir una instrucción para que solo pueda ser llamada por la autoridad de actualización. La única parte difícil es obtener la autoridad de actualización de un programa para comparar.

### Limitar las actualizaciones de configuración a la autoridad de actualización del programa

Afortunadamente, cada programa tiene una cuenta de datos de programa que se traduce al tipo de `ProgramData` cuenta de Ancla y tiene el `upgrade_authority_address` campo. El propio programa almacena la dirección de esta cuenta en sus datos en el campo `programdata_address`.

Por lo tanto, además de las dos cuentas requeridas por la instrucción en el ejemplo de administrador codificado, esta instrucción requiere las `program_data` cuentas `program` y.

Las cuentas necesitan entonces las siguientes restricciones:

1. Una restricción `program` para garantizar que la `program_data` cuenta proporcionada coincida con el `programdata_address` campo del programa
2. Una restricción en la `program_data` cuenta que garantiza que el firmante de la instrucción coincida con el `upgrade_authority_address` campo de la `program_data` cuenta.

Cuando se completa, se ve así:

```rust
...

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, MyProgram>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()))]
    pub program_data: Account<'info, ProgramData>,
    pub authority: Signer<'info>,
}
```

Una vez más, el ejemplo anterior no muestra la instrucción que inicializa la cuenta de configuración, pero debe tener las mismas restricciones para garantizar que un atacante no pueda inicializar la cuenta con valores inesperados.

Si esta es la primera vez que ha oído hablar de la cuenta de datos del programa, vale la pena leer [este Notion doc](https://www.notion.so/29780c48794c47308d5f138074dd9838) sobre las implementaciones de programas.

### Limitar las actualizaciones de configuración a un administrador proporcionado

Ambas opciones anteriores son bastante seguras, pero también inflexibles. ¿Qué pasa si desea actualizar el administrador para que sea otra persona? Para ello, puede almacenar el administrador en la cuenta de configuración.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    admin: Pubkey,
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

A continuación, puede restringir sus instrucciones de "actualización" con una verificación de firmante que coincida con el `admin` campo de la cuenta de configuración.

```rust
...

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == program_config.admin)]
    pub authority: Signer<'info>,
}
```

Hay un problema aquí: en el tiempo entre la implementación de un programa y la inicialización de la cuenta de configuración,_no hay administrador_. Lo que significa que la instrucción para inicializar la cuenta de configuración no se puede restringir para permitir solo administradores como llamantes. Eso significa que podría ser llamado por un atacante que busca establecerse como administrador.

Si bien esto suena mal, en realidad solo significa que no debe tratar su programa como "inicializado" hasta que haya inicializado la cuenta de configuración usted mismo y verificado que el administrador que aparece en la cuenta es quien espera. Si el script de implementación se implementa y luego llama de inmediato `initialize`, es muy poco probable que un atacante esté al tanto de la existencia de su programa y mucho menos que intente convertirse en el administrador. Si por algún golpe loco de mala suerte alguien "intercepta" su programa, puede cerrar el programa con la autoridad de actualización y volver a desplegar.

# Demostración

Ahora sigamos adelante y probemos esto juntos. Para esta demostración, trabajaremos con un programa simple que permite pagos en USDC. El programa cobra una pequeña tarifa por facilitar la transferencia. Tenga en cuenta que esto es algo artificial, ya que puede hacer transferencias directas sin un contrato de intermediario, pero simula cómo funcionan algunos programas DeFi complejos.

Aprenderemos rápidamente mientras probamos nuestro programa que podría beneficiarse de la flexibilidad proporcionada por una cuenta de configuración controlada por el administrador y algunas banderas de características.

### 1. Arranque

Descargue el código de inicio de la  `starter`  rama de[este repositorio](https://github.com/Unboxed-Software/solana-admin-instructions/tree/starter). El código contiene un programa con una sola instrucción y una sola prueba en el `tests` directorio.

Repasemos rápidamente cómo funciona el programa.

El `lib.rs` archivo incluye una constante para la dirección USDC y una sola `payment` instrucción. La `payment` instrucción simplemente llama a la `payment_handler` función en el `instructions/payment.rs` archivo donde se contiene la lógica de la instrucción.

El `instructions/payment.rs` archivo contiene tanto la `payment_handler` función como la estructura de validación de `Payment` cuentas que representa las cuentas requeridas por la `payment` instrucción. La `payment_handler` función calcula una tarifa del 1% a partir de la cantidad de pago, transfiere la tarifa a una cuenta de token designada y transfiere la cantidad restante al destinatario del pago.

Finalmente, el `tests` directorio tiene un único archivo de prueba, `config.ts` que simplemente invoca la `payment` instrucción y afirma que los saldos de cuenta de token correspondientes se han debitado y acreditado en consecuencia.

Antes de continuar, tómese unos minutos para familiarizarse con estos archivos y su contenido.

### 2. Ejecutar la prueba existente

Comencemos ejecutando la prueba existente.

Asegúrese de usar `yarn` o `npm install` instalar las dependencias establecidas en el `package.json` archivo. A continuación, asegúrese de ejecutar `anchor keys list` para obtener la clave pública de su programa impreso en la consola. Esto difiere según el par de claves que tenga localmente, por lo que necesita actualizar `lib.rs` y `Anchor.toml` usar la _su_ clave.

Finalmente, corra `anchor test` para comenzar la prueba. Debería fallar con la siguiente salida:

```
Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: incorrect program id for instruction
```

La razón de este error es que estamos intentando usar la dirección mainnet USDC Mint (como está codificada en el `lib.rs` archivo del programa), pero esa Mint no existe en el entorno local.

### 3. Añadir una `local-testing` función

Para solucionar esto, necesitamos una menta que podamos usar localmente en _y_ el programa. Dado que el entorno local se restablece a menudo durante las pruebas, deberá almacenar un par de teclas que puede usar para recrear la misma dirección Mint cada vez.

Además, no desea tener que cambiar la dirección codificada entre las compilaciones locales y de red principal, ya que eso podría introducir un error humano (y es simplemente molesto). Por lo tanto, crearemos una `local-testing` función que, cuando esté habilitada, hará que el programa use nuestra menta local pero que, de lo contrario, use la menta USDC de producción.

Generar un nuevo par de teclas mediante la ejecución `solana-keygen grind`. Ejecute el siguiente comando para generar un par de claves con una clave pública que comience con "env".

```
solana-keygen grind --starts-with env:1
```

Una vez que se encuentra un par de teclas, debería ver una salida similar a la siguiente:

```
Wrote keypair to env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json
```

El par de claves se escribe en un archivo en su directorio de trabajo. Ahora que tenemos una dirección USDC del marcador de posición, modifiquemos el `lib.rs` archivo. Utilice el `cfg` atributo para definir la `USDC_MINT_PUBKEY` constante dependiendo de si la `local-testing` característica está habilitada o deshabilitada. Recuerde establecer la `USDC_MINT_PUBKEY` constante para `local-testing` con la generada en el paso anterior en lugar de copiar la que se muestra a continuación.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("...");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

#[program]
pub mod config {
    use super::*;

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

A continuación, añada la `local-testing` función al `Cargo.toml` archivo ubicado en `/programs`.

```
[features]
...
local-testing = []
```

A continuación, actualice el archivo `config.ts` de prueba para crear un Mint utilizando el par de claves generado. Comience por eliminar la `mint` constante.

```typescript
const mint = new anchor.web3.PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
```

A continuación, actualice la prueba para crear una Mint utilizando el par de claves, lo que nos permitirá reutilizar la misma dirección Mint cada vez que se ejecuten las pruebas. Recuerde reemplazar el nombre del archivo con el que se generó en el paso anterior.

```typescript
let mint: anchor.web3.PublicKey

before(async () => {
  let data = fs.readFileSync(
    "env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json"
  )

  let keypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(data))
  )

  const mint = await spl.createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    0,
    keypair
  )
...
```

Por último, ejecute la prueba con la `local-testing` función habilitada.

```
anchor test -- --features "local-testing"
```

Debería ver el siguiente resultado:

```
config
  ✔ Payment completes successfully (406ms)


1 passing (3s)
```

Al igual que eso, has utilizado características para ejecutar dos rutas de código diferentes para diferentes entornos.

### 4. Configuración del programa

Las características son excelentes para establecer diferentes valores en la compilación, pero ¿qué pasaría si quisiera poder actualizar dinámicamente el porcentaje de tarifa utilizado por el programa? Hagámoslo posible creando una cuenta de Program Config que nos permita actualizar la tarifa sin actualizar el programa.

Para empezar, primero actualicemos el `lib.rs` archivo a:

1. Incluya una `SEED_PROGRAM_CONFIG` constante, que se utilizará para generar el PDA para la cuenta de configuración del programa.
2. Incluya una `ADMIN` constante, que se utilizará como una restricción al inicializar la cuenta de configuración del programa. Ejecute el `solana address` comando para obtener su dirección para usar como el valor de la constante.
3. Incluye un `state` módulo que implementaremos en breve.
4. Incluya las `update_program_config` instrucciones `initialize_program_config` y las llamadas a sus "controladores", que implementaremos en otro paso.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
mod state;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("envgiPXWwmpkHFKdy4QLv2cypgAWmVTVEm71YbNpYRu");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN: Pubkey = pubkey!("...");

#[program]
pub mod config {
    use super::*;

    pub fn initialize_program_config(ctx: Context<InitializeProgramConfig>) -> Result<()> {
        instructions::initialize_program_config_handler(ctx)
    }

    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        new_fee: u64,
    ) -> Result<()> {
        instructions::update_program_config_handler(ctx, new_fee)
    }

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

### 5. Estado de configuración del programa

A continuación, vamos a definir la estructura para el `ProgramConfig` estado. Esta cuenta almacenará el administrador, la cuenta de token donde se envían las tarifas y la tarifa. También especificaremos el número de bytes necesarios para almacenar esta estructura.

Cree un nuevo archivo llamado `state.rs` en el `/src` directorio y añada el siguiente código.

```rust
use anchor_lang::prelude::*;

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_basis_points: u64,
}

impl ProgramConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8;
}
```

### 6. Añadir instrucciones para configurar la cuenta del programa

Ahora vamos a crear la lógica de instrucciones para inicializar la cuenta de configuración del programa. Sólo debe ser llamado por una transacción firmada por la `ADMIN` clave y debe establecer todas las propiedades en la `ProgramConfig` cuenta.

Cree una carpeta llamada `program_config` en la ruta `/src/instructions/program_config`. Esta carpeta almacenará todas las instrucciones relacionadas con la cuenta de configuración del programa.

Dentro de la `program_config` carpeta, cree un archivo llamado `initialize_program_config.rs` y añada el siguiente código.

```rust
use crate::state::ProgramConfig;
use crate::ADMIN;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct InitializeProgramConfig<'info> {
    #[account(init, seeds = [SEED_PROGRAM_CONFIG], bump, payer = authority, space = ProgramConfig::LEN)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(mut, address = ADMIN)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_program_config_handler(ctx: Context<InitializeProgramConfig>) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.authority.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = 100;
    Ok(())
}
```

### 7. Añadir instrucción de tarifa de configuración del programa de actualización

A continuación, implemente la lógica de instrucciones para actualizar la cuenta de configuración. La instrucción debe requerir que el firmante coincida con el `admin` almacenado en la `program_config` cuenta.

Dentro de la `program_config` carpeta, cree un archivo llamado `update_program_config.rs` y añada el siguiente código.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = [SEED_PROGRAM_CONFIG], bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = program_config.admin,
    )]
    pub admin: Signer<'info>,
    /// CHECK: arbitrarily assigned by existing admin
    pub new_admin: UncheckedAccount<'info>,
}

pub fn update_program_config_handler(
    ctx: Context<UpdateProgramConfig>,
    new_fee: u64,
) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.new_admin.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = new_fee;
    Ok(())
}
```

### 8. Añadir mod.rs e instrucciones de actualización.rs

A continuación, expongamos los controladores de instrucciones que creamos para que la llamada de `lib.rs` no muestre un error. Comience añadiendo un archivo `mod.rs` en la `program_config` carpeta. Agregue el código a continuación para que los dos módulos `initialize_program_config` `update_program_config` sean accesibles.

```rust
mod initialize_program_config;
pub use initialize_program_config::*;

mod update_program_config;
pub use update_program_config::*;
```

Ahora, actualice `instructions.rs` en el camino `/src/instructions.rs`. Agregue el código a continuación para que los dos módulos `program_config` `payment` sean accesibles.

```rust
mod program_config;
pub use program_config::*;

mod payment;
pub use payment::*;
```

### 9. Actualizar instrucción de pago

Por último, actualicemos la instrucción de pago para comprobar que la `fee_destination` cuenta en la instrucción coincide con la `fee_destination` almacenada en la cuenta de configuración del programa. A continuación, actualice el cálculo de la tarifa de instrucción para que se base en el `fee_basis_point` almacenado en la cuenta de configuración del programa.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(
        seeds = [SEED_PROGRAM_CONFIG],
        bump,
        has_one = fee_destination
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub receiver_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub sender: Signer<'info>,
}

pub fn payment_handler(ctx: Context<Payment>, amount: u64) -> Result<()> {
    let fee_amount = amount
        .checked_mul(ctx.accounts.program_config.fee_basis_points)
        .unwrap()
        .checked_div(10000)
        .unwrap();
    let remaining_amount = amount.checked_sub(fee_amount).unwrap();

    msg!("Amount: {}", amount);
    msg!("Fee Amount: {}", fee_amount);
    msg!("Remaining Transfer Amount: {}", remaining_amount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.fee_destination.to_account_info(),
            },
        ),
        fee_amount,
    )?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.receiver_token_account.to_account_info(),
            },
        ),
        remaining_amount,
    )?;

    Ok(())
}
```

### 10. Prueba

Ahora que hemos terminado de implementar nuestra nueva estructura e instrucciones de configuración del programa, pasemos a probar nuestro programa actualizado. Para comenzar, añada el PDA de la cuenta de configuración del programa al archivo de prueba.

```typescript
describe("config", () => {
  ...
  const programConfig = findProgramAddressSync(
    [Buffer.from("program_config")],
    program.programId
  )[0]
...
```

A continuación, actualice el archivo de prueba con tres pruebas más que:

1. La cuenta de configuración del programa está inicializada correctamente
2. La instrucción de pago funciona según lo previsto
3. La cuenta de configuración puede ser actualizada con éxito por el administrador
4. La cuenta de configuración no puede ser actualizada por otro que no sea el administrador

La primera prueba inicializa la cuenta de configuración del programa y verifica que la tarifa correcta está establecida y que el administrador correcto está almacenado en la cuenta de configuración del programa.

```typescript
it("Initialize Program Config Account", async () => {
    const tx = await program.methods
        .initializeProgramConfig()
        .accounts({
            programConfig: programConfig,
            feeDestination: feeDestination,
            authority: wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

    assert.strictEqual(
        (
            await program.account.programConfig.fetch(programConfig)
        ).feeBasisPoints.toNumber(),
        100,
    );
    assert.strictEqual(
        (
            await program.account.programConfig.fetch(programConfig)
        ).admin.toString(),
        wallet.publicKey.toString(),
    );
});
```

La segunda prueba verifica que la instrucción de pago está funcionando correctamente, con la tarifa enviada al destino de la tarifa y el saldo restante transferido al receptor. Aquí actualizamos la prueba existente para incluir la `programConfig` cuenta.

```typescript
it("Payment completes successfully", async () => {
    const tx = await program.methods
        .payment(new anchor.BN(10000))
        .accounts({
            programConfig: programConfig,
            feeDestination: feeDestination,
            senderTokenAccount: senderTokenAccount,
            receiverTokenAccount: receiverTokenAccount,
            sender: sender.publicKey,
        })
        .transaction();

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender]);

    assert.strictEqual(
        (await connection.getTokenAccountBalance(senderTokenAccount)).value
            .uiAmount,
        0,
    );

    assert.strictEqual(
        (await connection.getTokenAccountBalance(feeDestination)).value
            .uiAmount,
        100,
    );

    assert.strictEqual(
        (await connection.getTokenAccountBalance(receiverTokenAccount)).value
            .uiAmount,
        9900,
    );
});
```

La tercera prueba intenta actualizar la tarifa en la cuenta de configuración del programa, lo que debería tener éxito.

```typescript
it("Update Program Config Account", async () => {
    const tx = await program.methods
        .updateProgramConfig(new anchor.BN(200))
        .accounts({
            programConfig: programConfig,
            admin: wallet.publicKey,
            feeDestination: feeDestination,
            newAdmin: sender.publicKey,
        })
        .rpc();

    assert.strictEqual(
        (
            await program.account.programConfig.fetch(programConfig)
        ).feeBasisPoints.toNumber(),
        200,
    );
});
```

La cuarta prueba intenta actualizar la tarifa en la cuenta de configuración del programa, donde el administrador no es el almacenado en la cuenta de configuración del programa, y esto debería fallar.

```typescript
it("Update Program Config Account with unauthorized admin (expect fail)", async () => {
    try {
        const tx = await program.methods
            .updateProgramConfig(new anchor.BN(300))
            .accounts({
                programConfig: programConfig,
                admin: sender.publicKey,
                feeDestination: feeDestination,
                newAdmin: sender.publicKey,
            })
            .transaction();

        await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender]);
    } catch (err) {
        expect(err);
    }
});
```

Finalmente, ejecute la prueba usando el siguiente comando:

```
anchor test -- --features "local-testing"
```

Debería ver el siguiente resultado:

```
config
  ✔ Initialize Program Config Account (199ms)
  ✔ Payment completes successfully (405ms)
  ✔ Update Program Config Account (403ms)
  ✔ Update Program Config Account with unauthorized admin (expect fail)

4 passing (8s)
```

¡Y eso es todo! Ha hecho que el programa sea mucho más fácil de trabajar para avanzar. Si desea echar un vistazo al código de la solución final, puede encontrarlo en la  `solution`  rama de[el mismo repositorio](https://github.com/Unboxed-Software/solana-admin-instructions/tree/solution).

# Desafío

Ahora es el momento de que hagas algo de esto por tu cuenta. Mencionamos la posibilidad de utilizar la autoridad de actualización del programa como administrador inicial. Siga adelante y actualice las demostraciones `initialize_program_config` para que solo la autoridad de actualización pueda llamarlo en lugar de tener un código duro `ADMIN`.

Tenga en cuenta que el `anchor test` comando, cuando se ejecuta en una red local, inicia un nuevo validador de prueba `solana-test-validator`. Este validador de prueba utiliza un cargador no actualizable. El cargador no actualizable hace que la `program_data` cuenta del programa no se inicie cuando se inicia el validador. Recordará de la lección que esta cuenta es la forma en que accedemos a la autoridad de actualización del programa.

Para solucionar esto, puede agregar una `deploy` función al archivo de prueba que ejecuta el comando de implementación para el programa con un cargador actualizable. Para usarlo `anchor test --skip-deploy`, ejecute y llame a la `deploy` función dentro de la prueba para ejecutar el comando de implementación después de que se haya iniciado el validador de prueba.

```typescript
import { execSync } from "child_process"

...

const deploy = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/config-keypair.json $(pwd)/target/deploy/config.so`
  execSync(deployCmd)
}

...

before(async () => {
  ...
  deploy()
})
```

Por ejemplo, el comando para ejecutar la prueba con características se vería así:

```
anchor test --skip-deploy -- --features "local-testing"
```

Intente hacer esto por su cuenta, pero si se queda atascado, siéntase libre de hacer referencia a la `challenge` rama de [el mismo repositorio](https://github.com/Unboxed-Software/solana-admin-instructions/tree/challenge) para ver una posible solución.

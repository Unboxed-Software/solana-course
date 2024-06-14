---
title: Introducción a los objetivos de desarrollo de Anchor
objectives:
- Usar el framework de Anchor para construir un programa básico
- Describir la estructura básica de un programa de anclaje
- Explicar cómo implementar la validación básica de la cuenta y los controles de seguridad con Anchor
---

# TL;DR

-   **Ancla** es un marco para construir programas Solana
-   **Macros de anclaje** acelerar el proceso de creación de programas de Solana mediante la abstracción de una cantidad significativa de código
-   Anchor le permite construir **programas seguros** más fácilmente realizando ciertas comprobaciones de seguridad, requiriendo la validación de la cuenta y proporcionando una forma sencilla de implementar comprobaciones adicionales.

# Descripción general

## ¿Qué es Anchor?

Anchor es un marco de desarrollo que hace que escribir programas de Solana sea más fácil, rápido y seguro. Es el marco "ir a" para el desarrollo de Solana por una muy buena razón. Hace que sea más fácil organizar y razonar sobre su código, implementa controles de seguridad comunes automáticamente y abstrae una cantidad significativa de repeticiones asociadas con la escritura de un programa de Solana.

## Estructura del programa de anclaje

Anchor utiliza macros y rasgos para generar código Rust repetitivo para usted. Estos proporcionan una estructura clara a su programa para que pueda razonar más fácilmente sobre su código. Las principales macros y atributos de alto nivel son:

-   `declare_id` - una macro para declarar la dirección en cadena del programa
-   `#[program]` - una macro de atributo utilizada para denotar el módulo que contiene la lógica de instrucción del programa
-   `Accounts` - un rasgo aplicado a las estructuras que representan la lista de cuentas requeridas para una instrucción
-   `#[account]` - una macro de atributos utilizada para definir tipos de cuenta personalizados para el programa

Hablemos de cada uno de ellos antes de juntar todas las piezas.

## Declare su ID de programa

La `declare_id` macro se utiliza para especificar la dirección en cadena del programa (es decir, el `programId`). Cuando construyes un programa de anclaje por primera vez, el marco generará un nuevo par de claves. Esto se convierte en el par de teclas predeterminado utilizado para implementar el programa a menos que se especifique lo contrario. La clave pública correspondiente debe utilizarse como la `programId` especificada en la `declare_id!` macro.

```rust
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
```

## Definir lógica de instrucción

La macro de  `#[program]`  atributos define el módulo que contiene todas las instrucciones del programa. Aquí es donde implementas la lógica de negocio para cada instrucción de tu programa.

Cada función pública en el módulo con el `#[program]` atributo se tratará como una instrucción separada.

Cada función de instrucción requiere un parámetro de tipo `Context` y puede incluir opcionalmente parámetros de función adicionales que representan datos de instrucción. Anchor manejará automáticamente la deserialización de datos de instrucción para que pueda trabajar con datos de instrucción como tipos de óxido.

```rust
#[program]
mod program_module_name {
    use super::*;

    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}
```

### Instrucción `Context`

El `Context` tipo expone los metadatos de instrucción y las cuentas a su lógica de instrucción.

```rust
pub struct Context<'a, 'b, 'c, 'info, T> {
    /// Currently executing program id.
    pub program_id: &'a Pubkey,
    /// Deserialized accounts.
    pub accounts: &'b mut T,
    /// Remaining accounts given but not deserialized or validated.
    /// Be very careful when using this directly.
    pub remaining_accounts: &'c [AccountInfo<'info>],
    /// Bump seeds found during constraint validation. This is provided as a
    /// convenience so that handlers don't have to recalculate bump seeds or
    /// pass them in as arguments.
    pub bumps: BTreeMap<String, u8>,
}
```

`Context` es un tipo genérico donde `T` define la lista de cuentas que requiere una instrucción. Cuando se utiliza `Context`, se especifica el tipo concreto de `T` como una estructura que adopta el `Accounts` rasgo (por ejemplo `Context<AddMovieReviewAccounts>`). A través de este argumento de contexto, la instrucción puede acceder a:

-   Las cuentas pasaron a la instrucción ( `ctx.accounts`)
-   El ID de programa ( `ctx.program_id`) del programa en ejecución
-   Las cuentas restantes ( `ctx.remaining_accounts`). El `remaining_accounts`  es un vector que contiene todas las cuentas que se pasaron a la instrucción pero que no se declaran en la  `Accounts`  estructura.
-   Los baches para cualquier cuenta PDA en la `Accounts` estructura ( `ctx.bumps`)

## Definir cuentas de instrucción

El `Accounts` rasgo define una estructura de datos de cuentas validadas. Las estructuras que adoptan este rasgo definen la lista de cuentas requeridas para una instrucción dada. Estas cuentas se exponen a través de una instrucción `Context` para que la iteración manual de la cuenta y la deserialización ya no sean necesarias.

Por lo general, se aplica el `Accounts` rasgo a través de la `derive` macro (por ejemplo `#[derive(Accounts)]`). Esto implementa un  `Accounts` deserializador en la estructura dada y elimina la necesidad de deserializar cada cuenta manualmente.

Las implementaciones del `Accounts` rasgo son responsables de realizar todas las verificaciones de restricción requeridas para garantizar que las cuentas cumplan con las condiciones requeridas para que el programa se ejecute de manera segura. Las restricciones se proporcionan para cada campo utilizando el `#account(..)` atributo (más sobre eso en breve).

Por ejemplo, `instruction_one` requiere un `Context` argumento de tipo `InstructionAccounts`. La `#[derive(Accounts)]` macro se utiliza para implementar la `InstructionAccounts` estructura que incluye tres cuentas: `account_name`, `user`, y `system_program`.

```rust
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		...
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}
```

Cuando `instruction_one` se invoca, el programa:

-   Comprueba que las cuentas pasadas a la instrucción coinciden con los tipos de cuenta especificados en la `InstructionAccounts` estructura
-   Comprueba las cuentas contra cualquier restricción adicional especificada

Si alguna de las cuentas pasadas `instruction_one` falla en la validación de la cuenta o en las comprobaciones de seguridad especificadas en la `InstructionAccounts` estructura, entonces la instrucción falla incluso antes de llegar a la lógica del programa.

## Validación de la cuenta

Es posible que haya notado en el ejemplo anterior que una de las cuentas `InstructionAccounts` era de tipo `Account`, una era de `Signer` tipo y otra era de tipo `Program`.

Anchor proporciona una serie de tipos de cuentas que se pueden utilizar para representar cuentas. Cada tipo implementa una validación de cuenta diferente. Repasaremos algunos de los tipos comunes que puede encontrar, pero asegúrese de mirar a través del[lista completa de tipos de cuentas](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/index.html).

### `Account`

`Account` es un envoltorio  `AccountInfo`  que verifica la propiedad del programa y deserializa los datos subyacentes en un tipo de óxido.

```rust
// Deserializes this info
pub struct AccountInfo<'a> {
    pub key: &'a Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
    pub lamports: Rc<RefCell<&'a mut u64>>,
    pub data: Rc<RefCell<&'a mut [u8]>>,    // <---- deserializes account data
    pub owner: &'a Pubkey,    // <---- checks owner program
    pub executable: bool,
    pub rent_epoch: u64,
}
```

Recordemos el ejemplo anterior donde `InstructionAccounts` había un campo `account_name` :

```rust
pub account_name: Account<'info, AccountStruct>
```

El `Account` envoltorio aquí hace lo siguiente:

-   Deserializa la cuenta `data` en el formato de tipo `AccountStruct`
-   Comprueba que el propietario del programa de la cuenta coincide con el propietario del programa especificado para el `AccountStruct` tipo.

Cuando el tipo de cuenta especificado en la `Account` envoltura se define dentro de la misma caja utilizando la macro de `#[account]` atributos, la comprobación de propiedad del programa está en contra de lo `programId` definido en la `declare_id!` macro.

A continuación se indican las comprobaciones realizadas:

```rust
// Checks
Account.info.owner == T::owner()
!(Account.info.owner == SystemProgram && Account.info.lamports() == 0)
```

### `Signer`

El `Signer` tipo valida que la cuenta dada firmó la transacción. No se realizan otras comprobaciones de propiedad o tipo. Solo debe usarlo `Signer` cuando los datos subyacentes de la cuenta no sean necesarios en la instrucción.

Para la `user` cuenta en el ejemplo anterior, el `Signer` tipo especifica que la `user` cuenta debe ser un firmante de la instrucción.

Se realiza la siguiente comprobación por usted:

```rust
// Checks
Signer.info.is_signer == true
```

### `Program`

El `Program` tipo valida que la cuenta es un programa determinado.

Para la `system_program` cuenta en el ejemplo anterior, el `Program` tipo se utiliza para especificar que el programa debe ser el programa del sistema. Anchor proporciona un `System` tipo que incluye el `programId` del programa del sistema para verificar.

Se realizan las siguientes comprobaciones para usted:

```rust
//Checks
account_info.key == expected_program
account_info.executable == true
```

## Añadir restricciones con `#[account(..)]`

La macro de  `#[account(..)]`  atributos se utiliza para aplicar restricciones a las cuentas. Repasaremos algunos ejemplos de restricciones en esta y futuras lecciones, pero en algún momento asegúrese de ver el completo[lista de posibles limitaciones](https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html).

Vuelva a recordar el `account_name` campo del `InstructionAccounts` ejemplo.

```rust
#[account(init, payer = user, space = 8 + 8)]
pub account_name: Account<'info, AccountStruct>,
#[account(mut)]
pub user: Signer<'info>,
```

Observe que el `#[account(..)]`  atributo contiene tres valores separados por comas:

-   `init` - crea la cuenta a través de un IPC al programa del sistema e inicializa (establece su discriminador de cuenta)
-   `payer` - especifica el pagador para que la inicialización de la cuenta sea la `user` cuenta definida en la estructura
-   `space` - especifica que el espacio asignado para la cuenta debe ser `8 + 8` bytes. Los primeros 8 bytes son para un discriminador que Anchor añade automáticamente para identificar el tipo de cuenta. Los siguientes 8 bytes asignan espacio para los datos almacenados en la cuenta como se define en el `AccountStruct` tipo.

Porque `user` usamos el `#[account(..)]` atributo para especificar que la cuenta dada es mutable. La `user` cuenta debe marcarse como mutable porque los lamports se deducirán de la cuenta para pagar la inicialización de `account_name`.

```rust
#[account(mut)]
pub user: Signer<'info>,
```

Tenga en cuenta que la `init` restricción impuesta `account_name` automáticamente incluye una `mut` restricción para que ambas `account_name` y `user` sean cuentas mutables.

## `#[account]`

El `#[account]` atributo se aplica a las estructuras que representan la estructura de datos de una cuenta de Solana. Implementa los siguientes rasgos:

-   `AccountSerialize`
-   `AccountDeserialize`
-   `AnchorSerialize`
-   `AnchorDeserialize`
-   `Clone`
-   `Discriminator`
-   `Owner`

Puede leer más sobre los detalles de cada rasgo[here](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html). Sin embargo, sobre todo lo que necesita saber es que el `#[account]`  atributo permite la serialización y la deserialización, e implementa los rasgos discriminador y propietario de una cuenta.

El discriminador es un identificador único de 8 bytes para un tipo de cuenta derivado de los primeros 8 bytes del hash SHA256 del nombre del tipo de cuenta. Cuando se implementan rasgos de serialización de cuenta, los primeros 8 bytes se reservan para el discriminador de cuenta.

Como resultado, cualquier llamada a 's `AccountDeserialize`   `try_deserialize`  comprobará este discriminador. Si no coincide, se proporcionó una cuenta no válida y la deserialización de la cuenta saldrá con un error.

El  `#[account]`  atributo también implementa el `Owner` rasgo para una estructura usando el  `programId`  declarado por  `declareId`  de la caja en la  `#[account]` que se usa. En otras palabras, todas las cuentas inicializadas usando un tipo de cuenta definido usando el `#[account]`  atributo dentro del programa también son propiedad del programa.

Como ejemplo, veamos `AccountStruct` utilizado por el `account_name` de `InstructionAccounts`

```rust
#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    ...
}

#[account]
pub struct AccountStruct {
    data: u64
}
```

El `#[account]` atributo asegura que se puede utilizar como una cuenta en `InstructionAccounts`.

Cuando se inicializa la `account_name` cuenta:

-   Los primeros 8 bytes se establecen como el `AccountStruct` discriminador
-   El campo de datos de la cuenta coincidirá `AccountStruct`
-   El propietario de la cuenta se establece como el `programId` de `declare_id`

## Júntalo todo

Cuando combinas todos estos tipos de anclas, terminas con un programa completo. A continuación se muestra un ejemplo de un programa básico de Anchor con una sola instrucción que:

-   Inicializa una nueva cuenta
-   Actualiza el campo de datos en la cuenta con los datos de instrucción pasados a la instrucción

```rust
// Use this import to gain access to common anchor features
use anchor_lang::prelude::*;

// Program onchain address
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Instruction logic
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
        ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}

// Validate incoming accounts for instructions
#[derive(Accounts)]
pub struct InstructionAccounts<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}

// Define custom program account type
#[account]
pub struct AccountStruct {
    data: u64
}
```

¡Ahora está listo para construir su propio programa Solana utilizando el marco de Anchor!

# Demostración

Antes de comenzar, instale Anchor siguiendo los pasos[here](https://www.anchor-lang.com/docs/installation).

Para esta demostración, crearemos un programa de contador simple con dos instrucciones:

-   La primera instrucción inicializará una cuenta de contador
-   La segunda instrucción incrementará el recuento almacenado en una cuenta de contador

### 1. Configuración

Crear un nuevo proyecto llamado `anchor-counter` ejecutando `anchor init` :

```console
anchor init anchor-counter
```

A continuación, ejecute `anchor build`

```console
anchor build
```

Entonces, corre `anchor keys list`

```console
anchor keys list
```

Copie la salida de ID de programa de `anchor keys list`

```
anchor_counter: BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr
```

A continuación, actualice `declare_id!` en `lib.rs`

```rust
declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");
```

Y también actualizar `Anchor.toml`

```
[programs.localnet]
anchor_counter = "BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr"
```

Finalmente, elimine el código predeterminado `lib.rs` hasta que todo lo que quede sea lo siguiente:

```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

}
```

### 2. Añadir la `initialize` instrucción

En primer lugar, vamos a poner en práctica la `initialize` instrucción dentro `#[program]`. Esta instrucción requiere un tipo `Context` de instrucción `Initialize` y no toma datos de instrucción adicionales. En la lógica de instrucción, simplemente estamos estableciendo el `count` campo de la `counter` cuenta en `0`.

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.count = 0;
    msg!("Counter Account Created");
    msg!("Current Count: { }", counter.count);
    Ok(())
}
```

### 3. `Context` Tipo de implementación `Initialize`

A continuación, usando la `#[derive(Accounts)]` macro, vamos a implementar el `Initialize` tipo que enumera y valida las cuentas utilizadas por la `initialize` instrucción. Necesitará las siguientes cuentas:

-   `counter` - la cuenta de contador inicializada en la instrucción
-   `user` - pagador de la inicialización
-   `system_program` - el programa del sistema es necesario para la inicialización de cualquier cuenta nueva

```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Implementar `Counter`

A continuación, utilice el `#[account]` atributo para definir un nuevo tipo de `Counter` cuenta. La `Counter` estructura define un `count` campo de tipo `u64`. Esto significa que podemos esperar que cualquier cuenta nueva inicializada como un `Counter` tipo tenga una estructura de datos coincidente. El `#[account]` atributo también establece automáticamente el discriminador para una nueva cuenta y establece el propietario de la cuenta como el `programId` de la `declare_id!` macro.

```rust
#[account]
pub struct Counter {
    pub count: u64,
}
```

### 5. Añadir `increment` instrucción

En `#[program]` el interior, vamos a implementar una `increment` instrucción para aumentar la `count` una vez que una `counter` cuenta es inicializada por la primera instrucción. Esta instrucción requiere un tipo `Context` de `Update` (implementado en el siguiente paso) y no toma datos de instrucción adicionales. En la lógica de instrucciones, simplemente estamos incrementando el `count` campo de una `counter` cuenta existente en `1`.

```rust
pub fn increment(ctx: Context<Update>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    msg!("Previous counter: {}", counter.count);
    counter.count = counter.count.checked_add(1).unwrap();
    msg!("Counter incremented. Current count: {}", counter.count);
    Ok(())
}
```

### 6. `Context` Tipo de implementación `Update`

Por último, usando la `#[derive(Accounts)]` macro de nuevo, vamos a crear el `Update` tipo que enumera las cuentas que requiere la `increment` instrucción. Necesitará las siguientes cuentas:

-   `counter` - una cuenta de contador existente para aumentar
-   `user` - pagador de la tasa de transacción

Nuevamente, tendremos que especificar cualquier restricción usando el `#[account(..)]` atributo:

```rust
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}
```

### 7. Construir

En conjunto, el programa completo se verá así:

```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Counter account created. Current count: {}", counter.count);
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        msg!("Previous counter: {}", counter.count);
        counter.count = counter.count.checked_add(1).unwrap();
        msg!("Counter incremented. Current count: {}", counter.count);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}

#[account]
pub struct Counter {
    pub count: u64,
}
```

Ejecutar `anchor build` para construir el programa.

### 8. Pruebas

Las pruebas de anclaje son típicamente pruebas de integración de Typescript que utilizan el marco de prueba mocha. Aprenderemos más sobre las pruebas más adelante, pero por ahora navegue `anchor-counter.ts` y reemplace el código de prueba predeterminado con lo siguiente:

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { AnchorCounter } from "../target/types/anchor_counter";

describe("anchor-counter", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.AnchorCounter as Program<AnchorCounter>;

    const counter = anchor.web3.Keypair.generate();

    it("Is initialized!", async () => {});

    it("Incremented the count", async () => {});
});
```

El código anterior genera un nuevo par de claves para la `counter` cuenta que inicializaremos y crea marcadores de posición para una prueba de cada instrucción.

A continuación, cree la primera prueba para la `initialize` instrucción:

```typescript
it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
        .initialize()
        .accounts({ counter: counter.publicKey })
        .signers([counter])
        .rpc();

    const account = await program.account.counter.fetch(counter.publicKey);
    expect(account.count.toNumber() === 0);
});
```

A continuación, cree la segunda prueba para la `increment` instrucción:

```typescript
it("Incremented the count", async () => {
    const tx = await program.methods
        .increment()
        .accounts({
            counter: counter.publicKey,
            user: provider.wallet.publicKey,
        })
        .rpc();

    const account = await program.account.counter.fetch(counter.publicKey);
    expect(account.count.toNumber() === 1);
});
```

Por último, ejecute `anchor test` y debería ver la siguiente salida:

```console
anchor-counter
✔ Is initialized! (290ms)
✔ Incremented the count (403ms)


2 passing (696ms)
```

Ejecutar `anchor test` automáticamente hace girar un validador de prueba local, despliega su programa y ejecuta sus pruebas de moca contra él. No se preocupe si está confundido por las pruebas por ahora, profundizaremos más adelante.

¡Felicidades, acabas de construir un programa de Solana utilizando el marco de Anchor! Siéntase libre de hacer referencia a la [código de solución](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-increment) si usted necesita un poco más de tiempo con él.

# Desafío

Ahora es tu turno de construir algo de forma independiente. Debido a que estamos comenzando con programas muy simples, los suyos se verán casi idénticos a los que acabamos de crear. Es útil tratar de llegar al punto en el que pueda escribirlo desde cero sin hacer referencia al código anterior, así que intente no copiar y pegar aquí.

1. Escribir un nuevo programa que inicializa una `counter` cuenta
2. Implementar tanto una como `increment` una `decrement` instrucción
3. Cree e implemente su programa como lo hicimos en la demostración
4. Pruebe su programa recién implementado y use Solana Explorer para verificar los registros del programa

Como siempre, sé creativo con estos desafíos y llévalos más allá de las instrucciones básicas si quieres, ¡y diviértete!

¡Intenta hacerlo de forma independiente si puedes! Pero si te quedas atascado, siéntete libre de hacer referencia a la[código de solución](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

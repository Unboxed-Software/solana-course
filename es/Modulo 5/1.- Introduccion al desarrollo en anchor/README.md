# Introducción al desarrollo en anchor

## Objetivos de la Lección

_Al final de esta lección, podrás_ :

- Utilizar el marco de trabajo Anchor para construir un programa básico
- Describir la estructura básica de un programa Anchor
- Explicar cómo implementar comprobaciones básicas de validación de cuentas y seguridad con Anchor.

# Tecnicismos

- **Anchor** es un marco de trabajo para construir programas de Solana
- Los **macros de Anchor** aceleran el proceso de construir programas de Solana al abstractar una cantidad significativa de código de plantilla
- Anchor permite construir **programas seguros** de manera más fácil realizando ciertas comprobaciones de seguridad, requiriendo validación de cuentas y proporcionando una forma simple de implementar comprobaciones adicionales.

# Resumen

## ¿Qué es Anchor?

Anchor es un marco de desarrollo que facilita la escritura de programas de Solana, es más rápido y seguro. Es el marco de trabajo "go to" para el desarrollo de Solana por una muy buena razón. Hace que sea más fácil organizar y razonar sobre su código, implementa automáticamente comprobaciones de seguridad comunes y abstrae una cantidad significativa de código de plantilla asociado con la escritura de un programa de Solana.

## Estructura de programa Anchor

Anchor utiliza macros y rasgos para generar código de plantilla Rust para ti. Estos proporcionan una estructura clara a tu programa para que puedas razonar mejor sobre tu código. Los principales macros y atributos de alto nivel son:

- **declare_id** - un macro para declarar la dirección del programa en la cadena
- **#[program]** - un macro de atributo utilizado para denotar el módulo que contiene la lógica de instrucción del programa
- **Accounts** : un rasgo aplicado a las estructuras que representan la lista de cuentas requeridas para una instrucción.
- **#[account]** : un macro de atributo utilizado para definir tipos de cuentas personalizados para el programa.
  Vamos a hablar de cada uno de ellos antes de poner todas las piezas juntas.

## Declare su ID de programa

El macro **declare_id** se utiliza para especificar la dirección en la cadena del programa (es decir, el **programId** ). Cuando construye un programa Anchor por primera vez, el marco generará una nueva pareja de claves. Esta se convierte en la pareja de claves predeterminada utilizada para desplegar el programa a menos que se especifique lo contrario. ¡La clave pública correspondiente debe utilizarse como el **programId** especificado en el macro **declare_id!**

```Rust
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
```

## Defina la lógica de instrucción

El macro de atributo **#[program]** define el módulo que contiene todas las instrucciones de su programa. Aquí es donde implementa la lógica comercial para cada instrucción en su programa.

Cada función pública en el módulo con el atributo **#[program]** se tratará como una instrucción separada.

Cada función de instrucción requiere un parámetro de tipo **Context** y opcionalmente puede incluir parámetros adicionales de función que representen los datos de instrucción. Anchor manejará automáticamente la deserialización de los datos de instrucción para que pueda trabajar con los datos de instrucción como tipos de Rust.

```Rust
#[program]
mod program_module_name {
    use super::*;

    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}
```

## **Contexto** de instrucción

El tipo **Context** expone metadatos e información de cuentas de su lógica de instrucción.

```Rust
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

El **Context** es un tipo genérico donde **T** define la lista de cuentas que requiere una instrucción. Cuando utiliza **Context** , especifica el tipo concreto de **T** como una estructura que adopta el trait **Accounts** (por ejemplo, **Context<AddMovieReviewAccounts>** ). A través de este argumento de contexto, la instrucción puede acceder a:

- Las cuentas pasadas a la instrucción ( **ctx.accounts** )
- El ID del programa ( **ctx.program_id** ) del programa que se está ejecutando
- Las cuentas restantes ( **ctx.remaining_accounts** ). El **remaining_accounts** es un vector que contiene todas las cuentas que se pasaron a la instrucción pero no se declararon en la estructura **Accounts** .
- Los bumps para cualquier cuenta PDA en la estructura **Accounts** ( **ctx.bumps** )

## Defina las cuentas de instrucción

El trait **Accounts** define una estructura de datos de cuentas validadas. Las estructuras que adoptan este trait definen la lista de cuentas requeridas para una instrucción dada. Estas cuentas luego se exponen a través del **Context** de una instrucción para que ya no sea necesario iterar y deserializar manualmente cada cuenta.

Típicamente, aplica el trait **Accounts** a través del macro **derive** (por ejemplo, **#[derive(Accounts)]** ). Esto implementa un deserializador **Accounts** en la estructura dada y elimina la necesidad de deserializar cada cuenta manualmente.

Las implementaciones del trait **Accounts** son responsables de realizar todas las comprobaciones de restricciones necesarias para garantizar que las cuentas cumplan las condiciones requeridas para que el programa se ejecute de manera segura. Se proporcionan restricciones para cada campo utilizando el atributo **#account(..)** (más sobre eso próximamente).

Por ejemplo, la **instrucción_uno** requiere **Context** y un argumento de tipo **InstructionAccounts** . Se utiliza el macro **#[derive(Accounts)]** para implementar la estructura **InstructionAccounts** que incluye tres cuentas: **account_name** , **user** y **system_program**.

```Rust
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

Cuando se invoca **instruction_one** , el programa:

- Verifica que las cuentas pasadas a la instrucción coincidan con los tipos de cuentas especificados en la estructura **InstructionAccounts**
- Verifica las cuentas en relación con cualquier restricción adicional especificada

Si alguna cuenta pasada a **instruction_one** no supera la validación de la cuenta o las comprobaciones de seguridad especificadas en la estructura **InstructionAccounts** , entonces la instrucción falla antes de llegar a la lógica del programa.

## Validación de cuenta

Es posible que hayas notado en el ejemplo anterior que una de las cuentas en **InstructionAccounts** era de tipo **Account** , una era de tipo **Signer** y una era de tipo **Program** .
Anchor proporciona varios tipos de cuentas que se pueden utilizar para representar cuentas. Cada tipo implementa diferentes validaciones de cuenta. Revisaremos algunos de los tipos comunes que puedes encontrar, pero asegúrate de revisar la [lista completa de tipos de cuentas](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/index.html).

## **Account**

**Account** es un envoltorio alrededor de **AccountInfo** que verifica la propiedad del programa y deserializa los datos subyacentes en un tipo de Rust.

```Rust
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

Recordemos el ejemplo anterior donde **InstructionAccounts** tenía un campo **account_name** :

```Rust
pub account_name: Account<'info, AccountStruct>
```

El envoltorio **Account** aquí hace lo siguiente:

- Deserializa los **data** de la cuenta en el formato del tipo **AccountStruct**
- Verifica que el propietario del programa de la cuenta coincida con el propietario del programa especificado para el tipo **AccountStruct** .

Cuando el tipo de cuenta especificado en el envoltorio de **Account** se define dentro del mismo paquete utilizando el atributo **#[account]** macro, la comprobación de propiedad del programa es contra el **programId** definido en el **declare_id!** macro.
Los siguientes son los controles realizados:

```Rust
// Checks
Account.info.owner == T::owner()
!(Account.info.owner == SystemProgram && Account.info.lamports() == 0)
```

## **Signer**

El tipo de **Signer** valida que la cuenta dada haya firmado la transacción. No se realizan otras comprobaciones de propiedad o tipo. Solo debes usar **Signer** cuando los datos de la cuenta subyacente no son necesarios en la instrucción.

Por ejemplo, para la cuenta de **user** en el ejemplo anterior, el tipo **Signer** especifica que la cuenta de **user** debe ser firmante de la instrucción.

La siguiente verificación se realiza para ti:

```Rust
// Checks
Signer.info.is_signer == true
```

## **Program**

El tipo de **Program** valida que la cuenta sea un determinado programa.

En el ejemplo anterior de la cuenta de **system_program** , se utiliza el tipo de **Program** para especificar que el programa debe ser el programa del sistema. Anchor proporciona un tipo **System** que incluye el **programId** del programa del sistema para comprobar.

Se realizan las siguientes comprobaciones para usted:

```Rust
//Checks
account_info.key == expected_program
account_info.executable == true
```

## Añadir restricciones con **#[account(..)]**

La macro de atributo **#[account(..)]** se utiliza para aplicar restricciones a las cuentas. Revisaremos algunos ejemplos de restricciones en esta y futuras lecciones, pero en algún momento asegúrese de revisar la [lista completa de restricciones posibles](https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html).

Recuerde nuevamente el campo **account_name** del ejemplo **InstructionAccounts**.

```Rust
#[account(init, payer = user, space = 8 + 8)]
pub account_name: Account<'info, AccountStruct>,
#[account(mut)]
pub user: Signer<'info>,
```

Tenga en cuenta que el atributo **#[account(..)]** contiene tres valores separados por comas:

- **init** - crea la cuenta a través de un CPI para el programa del sistema e inicializa (establece su discriminador de cuenta)
- **payer** - especifica el pagador para la inicialización de la cuenta como la cuenta de **user** definida en el struct
- **space** - especifica que el espacio asignado para la cuenta debe ser de **8 + 8** bytes. Los primeros 8 bytes son para un discriminador que Anchor agrega automáticamente para identificar el tipo de cuenta. Los siguientes 8 bytes asignan espacio para los datos almacenados en la cuenta según el tipo **AccountStruct** .

Para el **user** , utilizamos el atributo **#[account(..)]** para especificar que la cuenta dada es mutable. La cuenta de **user** debe marcarse como mutable porque se deducirán lamports de la cuenta para pagar la inicialización de **account_name**.

```Rust
#[account(mut)]
pub user: Signer<'info>,
```

Cabe destacar que la restricción **init** colocada en **account_name** incluye automáticamente una restricción **mut** para que tanto **account_name** y **user** sean cuentas mutables.

## **#[account]**

El atributo **#[account]** se aplica a los structs que representan la estructura de datos de una cuenta de Solana. Implementa las siguientes características:

- **AccountSerialize**
- **AccountDeserialize**
- **AnchorSerialize**
- **AnchorDeserialize**
- **Clone**
- **Discriminator**
- **Owner**

Puede leer más sobre los detalles de cada característica [aquí](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html). Sin embargo, en gran parte lo que necesita saber es que el atributo **#[account]** habilita la serialización y deserialización, e implementa las características de discriminador y propietario para una cuenta.

El discriminador es un identificador único de 8 bytes para un tipo de cuenta derivado de los primeros 8 bytes del hash SHA256 del nombre del tipo de cuenta. Al implementar las características de serialización de cuenta, los primeros 8 bytes están reservados para el discriminador de cuenta.

Como resultado, cualquier llamada a **AccountDeserialize** de **try_deserialize** comprobará este discriminador. Si no coincide, se ha dado una cuenta inválida y la deserialización de la cuenta finalizará con un error.

El atributo **#[account]** también implementa la característica **Owner** para un struct utilizando el **programId** declarado por **declareId** de la caja en la que se utiliza **#[account]** . En otras palabras, todas las cuentas inicializadas utilizando un tipo de cuenta definido utilizando el atributo **#[account]** dentro del programa también son propiedad del programa.

Como ejemplo, echemos un vistazo a **AccountStruct** utilizado por **account_name** en **InstructionAccounts** .

```Rust
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

El atributo **#[account]** asegura que se puede utilizar como una cuenta en **InstructionAccounts**.

Cuando se inicializa la cuenta **account_name**:

- Los primeros 8 bytes se establecen como el discriminador de **AccountStruct**
- El campo de datos de la cuenta coincidirá con **AccountStruct**
- El propietario de la cuenta se establece como el **programId** de **declare_id**

## Juntando todo

Cuando combina todos estos tipos de Anchor, obtiene un programa completo. A continuación, se presenta un ejemplo de un programa básico de Anchor con una sola instrucción que:

- Inicializa una nueva cuenta
- Actualiza el campo de datos en la cuenta con los datos de la instrucción pasados a la instrucción

```Rust
// Use this import to gain access to common anchor features
use anchor_lang::prelude::*;

// Program on-chain address
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

¡Ahora está listo para construir su propio programa Solana utilizando el marco de trabajo Anchor!

# Demostración

Antes de comenzar, instale Anchor siguiendo los pasos [aquí](https://www.anchor-lang.com/docs/installation).
Para esta demostración, crearemos un programa de contador simple con dos instrucciones:

- La primera instrucción inicializará una cuenta de contador
- La segunda instrucción incrementará la cuenta almacenada en una cuenta de contador

## 1. Configuración

Cree un nuevo proyecto llamado **anchor-counter** ejecutando **anchor init** :

```Rust
anchor init anchor-counter
```

Ejecutar el comando **anchor-build**

```Rust
anchor-build
```

Después, ejecuta **anchor keys list**

```Rust
anchor keys list
```

Copie la salida del identificador del programa de **anchor keys list**

```Rust
anchor_counter: BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr
```

Luego, actualice **declare_id** en **lib.rs**

```Rust
declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");
```

Y también actualice **Anchor.toml**

```Rust
[programs.localnet]
anchor_counter = "BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr"
```

Finalmente, elimine el código predeterminado en **lib.rs** hasta que solo quede lo siguiente:

```Rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

}
```

## 2. Agregue la instrucción de **initialize**

Primero, implementemos la instrucción de **initialize** dentro de **#[program]** . Esta instrucción requiere un **Context** de tipo **Initialize** y no requiere datos de instrucción adicionales. En la lógica de la instrucción, simplemente estamos estableciendo el campo de **counter** de la **count** en **0** .

```Rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.count = 0;
    msg!("Counter Account Created");
    msg!("Current Count: { }", counter.count);
    Ok(())
}
```

## 3. Implemente el tipo **Context Initialize** .

A continuación, utilizando el macro **#[derive(Accounts)]** , implementemos el tipo **Initialize** que enumera y valida las cuentas utilizadas por la instrucción de **initialize**. Necesitará las siguientes cuentas:

- **counter**: la cuenta de contador inicializada en la instrucción
- **user** : pagador para la inicialización
- **system_program** : se requiere el programa del sistema para la inicialización de cualquier nueva cuenta

```Rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

## 4. Implementar **Counter**

A continuación, use el atributo **#[account]** para definir un nuevo tipo de cuenta **Counter** . La estructura **Counter** define un campo **count** de tipo **u64** . Esto significa que podemos esperar que cualquier nueva cuenta inicializada como un tipo **Counter** tenga una estructura de datos coincidente. El atributo **#[account]** también establece automáticamente el discriminador para una nueva cuenta y establece el propietario de la cuenta como el **programId** del macro **declare_id!** .

```Rust
#[account]
pub struct Counter {
    pub count: u64,
}
```

## 5. Agregue la instrucción de **increment**

Dentro de **#[program]** , implementemos una instrucción de **increment** para incrementar la **count** una vez que una cuenta de **counter** se ha inicializado con la primera instrucción. Esta instrucción requiere un **Context** de tipo **Update** (implementado en el siguiente paso) y no requiere datos de instrucción adicionales. En la lógica de la instrucción, simplemente estamos incrementando en **1** el campo de **count** de una **counter** existente.

```Rust
pub fn increment(ctx: Context<Update>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    msg!("Previous counter: {}", counter.count);
    counter.count = counter.count.checked_add(1).unwrap();
    msg!("Counter incremented. Current count: {}", counter.count);
    Ok(())
}
```

## 6. Implemente el tipo **Context Update**

Finalmente, utilizando el macro **#[derive(Accounts)]** , creamos el tipo **Update** que enumera las cuentas que requiere la instrucción de **increment** . Necesitará las siguientes cuentas:

- **counter** : una cuenta de contador existente para incrementar
- **user** : pagador para la tarifa de transacción

Nuevamente, tendremos que especificar cualquier restricción utilizando el atributo **#[account(..)]** :

```Rust
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}
```

## 7. Construir

Todo junto, el programa completo se verá así:

```Rust
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

Ejecute **anchor build** para construir el programa

## 8. Probando

Las pruebas de Anchor suelen ser pruebas de integración de Typescript que utilizan el marco de pruebas mocha. Aprenderemos más sobre las pruebas más adelante, pero por ahora vaya a **anchor-counter.ts** y reemplace el código de prueba predeterminado con lo siguiente:

```Rust
import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { expect } from "chai"
import { AnchorCounter } from "../target/types/anchor_counter"

describe("anchor-counter", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.AnchorCounter as Program<AnchorCounter>

  const counter = anchor.web3.Keypair.generate()

  it("Is initialized!", async () => {})

  it("Incremented the count", async () => {})
})
```

El código anterior genera un nuevo par de claves para la cuenta de **counter** que inicializaremos y crea marcadores de posición para una prueba de cada instrucción.

A continuación, cree la primera prueba para la instrucción de **initialize**:

```Rust
it("Is initialized!", async () => {
  // Add your test here.
  const tx = await program.methods
    .initialize()
    .accounts({ counter: counter.publicKey })
    .signers([counter])
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 0)
})
```

A continuación, cree la segunda prueba para la instrucción de **increment** :

```Rust
it("Incremented the count", async () => {
  const tx = await program.methods
    .increment()
    .accounts({ counter: counter.publicKey, user: provider.wallet.publicKey })
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 1)
})
```

Por último, ejecuta la **anchor test** y deberías ver la siguiente salida:

```Rust
anchor-counter
✔ Is initialized! (290ms)
✔ Incremented the count (403ms)


2 passing (696ms)
```

Correr una **anchor test** automáticamente inicia un validador de prueba local, despliega su programa y ejecuta sus pruebas mocha contra él. No se preocupe si se siente confundido por las pruebas por ahora, profundizaremos más en ellas más tarde.

¡Felicidades, acaba de construir un programa Solana usando el marco de trabajo Anchor! Si necesita más tiempo con él, no dude en consultar el [código de la solución](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-increment).

# Desafío

Ahora es tu turno de construir algo independientemente. Ya que comenzamos con programas muy simples, el tuyo se verá casi idéntico a lo que acabamos de crear. Es útil tratar de llegar al punto en que puedas escribirlo desde cero sin hacer referencia al código anterior, así que trata de no copiar y pegar aquí.

1. Escribir un nuevo programa que inicialice una cuenta de **counter**
2. Implementar tanto una instrucción de **increment** como una de **decrement**
3. Construir y desplegar tu programa como lo hicimos en la demostración
4. Prueba tu programa recién desplegado y utiliza Solana Explorer para verificar los registros del programa.

¡Como siempre, sé creativo con estos desafíos y llevarlos más allá de las instrucciones básicas si lo deseas y diviértete!

¡Intenta hacerlo independientemente si puedes! Pero si te atascas, no dudes en hacer referencia al [código de solución](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

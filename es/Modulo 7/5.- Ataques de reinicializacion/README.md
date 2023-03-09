# Ataques de reinicialización

## Objetivos de la lección

_Al final de esta lección, podrás:_

- Explicar los riesgos de seguridad asociados con una vulnerabilidad de reinicialización
- Utilice la comprobación de Rust de formato largo si ya se ha ejecutado una cuenta
- Uso de la restricción **init** de Anchor para ejecutar las cuentas, lo que establece automáticamente un discriminador de cuenta que se verifica para evitar la reinicialización de una cuenta.

# Terminología

- Use un discriminador o bandera de inicialización de cuenta para verificar si ya se ha inicializado una cuenta para evitar la reinicialización y la sobrescritura de datos existentes.
- Para prevenir la reinicialización de cuentas en Rust, inicialice las cuentas con una bandera **is_initialized** y verifique si ya se ha establecido en verdadero al inicializar una cuenta.

```Rust
if account.is_initialized {
    return Err(ProgramError::AccountAlreadyInitialized.into());
}
```

- Para simplificar esto, utilice la restricción de **int** de Anchor para crear una cuenta a través de un punto de interfaz de programa (CPI) del programa del sistema y establecer su discriminador.

# Resumen

La inicialización (registrada) se refiere a establecer los datos de una nueva cuenta por primera vez. Al inicializar una nueva cuenta, debe implementar una forma de verificar si la cuenta ya ha sido inicializada. Sin una verificación adecuada, una cuenta existente podría ser reinicializada y tener los datos existentes sobrescritos.

Cabe señalar que inicializar una cuenta y crear una cuenta son dos instrucciones separadas. Crear una cuenta requiere invocar la instrucción **create_account** en el programa del sistema, que especifica el espacio requerido para la cuenta, el alquiler en lamports asignado a la cuenta y el propietario del programa de la cuenta. La inicialización es una instrucción que establece los datos de una cuenta recién creada. La creación e inicialización de una cuenta se pueden combinar en una sola transacción.

## Falta la verificación de inicialización

En el ejemplo de abajo, no hay verificaciones en la cuenta de **user** . La instrucción de **initialize** deserializa los datos de la cuenta de **user** como un tipo de cuenta de **User** , establece el campo de **authority** y serializa los datos de la cuenta actualizados en la cuenta de **user** .

Sin verificaciones en la cuenta de **user** , otra parte podría pasar la misma cuenta a la instrucción de **initialize** una segunda vez para sobrescribir la **authority** existente almacenada en los datos de la cuenta.

```Rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_insecure  {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

## Agregar verificación **is_initialized**

Una forma de solucionar esto es agregar un campo adicional con **is_initialized** al tipo de cuenta de **User** y utilizarlo como una bandera para verificar si una cuenta ya ha sido inicializada.

```Rust
if user.is_initialized {
    return Err(ProgramError::AccountAlreadyInitialized.into());
}
```

Al incluir una verificación dentro de la instrucción de **initialize** , la cuenta de **user** solo se inicializaría si el campo **is_initialized** aún no se ha establecido en verdadero. Si el campo **is_initialized** ya estaba establecido, la transacción fallaría, evitando así la posibilidad de que un atacante reemplace la autoridad de la cuenta con su propia clave pública.

```Rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_secure {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        if user.is_initialized {
            return Err(ProgramError::AccountAlreadyInitialized.into());
        }

        user.authority = ctx.accounts.authority.key();
        user.is_initialized = true;

        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    is_initialized: bool,
    authority: Pubkey,
}
```

## Utilice la restricción **init** de Anchor

Anchor proporciona una restricción de **init** que se puede utilizar con el atributo **#[account(...)]** para inicializar una cuenta. La restricción de **init** crea la cuenta a través de un punto de interfaz de programa (CPI) del programa del sistema y establece el discriminador de la cuenta.

La restricción de **init** debe utilizarse en combinación con las restricciones de **payer** y **space** . El **payer** especifica la cuenta que paga por la inicialización de la nueva cuenta. El **space** especifica la cantidad de espacio que requiere la nueva cuenta, lo que determina la cantidad de lamports que deben asignarse a la cuenta. Los primeros 8 bytes de datos se establecen como un discriminador que Anchor agrega automáticamente para identificar el tipo de cuenta.

Lo más importante de esta lección es que la restricción de **init** asegura que esta instrucción solo se puede llamar una vez por cuenta, por lo que puede establecer el estado inicial de la cuenta en la lógica de la instrucción y no tener que preocuparse por un atacante que intente reinicializar la cuenta.

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_recommended {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("GM");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct User {
    authority: Pubkey,
}
```

## La restricción **init_if_needed** de Anchor

Vale la pena señalar que Anchor tiene una restricción **init_if_needed** . Esta restricción debe usarse con mucha precaución. De hecho, está bloqueada detrás de una bandera de característica para que se vea obligado a ser intencional al usarla.

La restricción **init_if_needed** hace lo mismo que la restricción **init** , solo que si la cuenta ya ha sido inicializada, la instrucción aún se ejecutará.
Dado esto, es _extremadamente_ importante que cuando utilices esta restricción incluyas las verificaciones para evitar restablecer la cuenta a su estado inicial.

Por ejemplo, si la cuenta almacena un campo de **authority** que se establece en la instrucción utilizando la restricción **init_if_needed** , necesita verificaciones que garanticen que ningún atacante pueda llamar a la instrucción después de que ya haya sido inicializada y tener el campo de **authority** establecido de nuevo.

En la mayoría de los casos, es más seguro tener una instrucción separada para inicializar los datos de la cuenta.

# Demo

Para este demo vamos a crear un programa sencillo que no hace más que inicializar cuentas. Incluiremos dos instrucciones:

- **insecure_initialization** inicializa una cuenta que se puede reinicializar.
- **recommended_initialization** inicializar una cuenta usando la restricción **init** de Anchor

## 1. Empecemos

Para comenzar, descargue el código de inicio de la rama de **inicio** de este [repositorio](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/starter). El código de inicio incluye un programa con una instrucción y la configuración de plantilla para el archivo de prueba.

La instrucción **insecure_initialization** inicializa una nueva cuenta de **user** que almacena la clave pública de una **authority** . En esta instrucción, se espera que la cuenta se asigne en el lado del cliente y luego se pase a la instrucción del programa. Una vez pasada la instrucción del programa, no hay verificaciones para verificar si el estado inicial de la cuenta de **user** ya se ha establecido. Esto significa que la misma cuenta se puede pasar una segunda vez para anular la **authority** almacenada en una cuenta de **user** existente.

```Rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;

    pub fn insecure_initialization(ctx: Context<Unchecked>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    #[account(mut)]
    /// CHECK:
    user: UncheckedAccount<'info>,
    authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

## 2. Instrucciones para prueba **insecure_initialization**

El archivo de prueba incluye la configuración para crear una cuenta mediante la ejecución del programa del sistema y luego ejecuta la instrucción **insecure_initialization** dos veces utilizando la misma cuenta.

Ya que no hay verificaciones para verificar que los datos de la cuenta no hayan sido inicializados anteriormente, la instrucción **insecure_initialization** se completará con éxito ambas veces, a pesar de que la segunda invocación proporcione una cuenta de autoridad diferente.

```Rust
import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { expect } from "chai"
import { Initialization } from "../target/types/initialization"

describe("initialization", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Initialization as Program<Initialization>

  const wallet = anchor.workspace.Initialization.provider.wallet
  const walletTwo = anchor.web3.Keypair.generate()

  const userInsecure = anchor.web3.Keypair.generate()
  const userRecommended = anchor.web3.Keypair.generate()

  before(async () => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: userInsecure.publicKey,
        space: 32,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
          32
        ),
        programId: program.programId,
      })
    )

    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      wallet.payer,
      userInsecure,
    ])

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        walletTwo.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    )
  })

  it("Insecure init", async () => {
    await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
      })
      .rpc()
  })

  it("Re-invoke insecure init with different auth", async () => {
    const tx = await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
        authority: walletTwo.publicKey,
      })
      .transaction()
    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      walletTwo,
    ])
  })
})
```

Ejecuta el **anchor test** para ver que ambas transacciones se completarán con éxito.

```Rust
initialization
  ✔ Insecure init (478ms)
  ✔ Re-invoke insecure init with different auth (464ms)
```

## 3. Agregar instrucción **recommended_initialization**

Creemos una nueva instrucción llamada **recommended_initialization** que solucione este problema. A diferencia de la anterior instrucción insegura, esta instrucción debería manejar tanto la creación como la inicialización de la cuenta del usuario utilizando la restricción **init** de Anchor.

Esta restricción instruye al programa para crear la cuenta a través de un CPI al programa del sistema, por lo que ya no es necesario crear la cuenta en el lado del cliente. La restricción también establece el discriminador de la cuenta. Luego, la lógica de su instrucción puede establecer el estado inicial de la cuenta.

Al hacer esto, se garantiza que cualquier invocación posterior de la misma instrucción con la misma cuenta de usuario fallará en lugar de restablecer el estado inicial de la cuenta.

```Rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;
		...
    pub fn recommended_initialization(ctx: Context<Checked>) -> Result<()> {
        ctx.accounts.user.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}
```

## 4. Instrucciones para prueba **recommended_initialization**

Para probar la instrucción **recommended_initialization** , ejecutaremos la instrucción dos veces, al igual que antes. Esta vez, esperamos que la transacción falle cuando intentemos inicializar la misma cuenta una segunda vez.

```Rust
describe("initialization", () => {
  ...
  it("Recommended init", async () => {
    await program.methods
      .recommendedInitialization()
      .accounts({
        user: userRecommended.publicKey,
      })
      .signers([userRecommended])
      .rpc()
  })

  it("Re-invoke recommended init with different auth, expect error", async () => {
    try {
      // Add your test here.
      const tx = await program.methods
        .recommendedInitialization()
        .accounts({
          user: userRecommended.publicKey,
          authority: walletTwo.publicKey,
        })
        .transaction()
      await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
        walletTwo,
        userRecommended,
      ])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

Ejecuta el **anchor test** para ver que la segunda transacción, que se intenta inicializar dos veces, ahora arroja un error indicando que la dirección de la cuenta ya está en uso.

```Rust
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t invoke [1]',
'Program log: Instruction: RecommendedInitialization',
'Program 11111111111111111111111111111111 invoke [2]',
'Allocate: account Address { address: EMvbwzrs4VTR7G1sNUJuQtvRX1EuvLhqs4PFqrtDcCGV, base: None } already in use',
'Program 11111111111111111111111111111111 failed: custom program error: 0x0',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t consumed 4018 of 200000 compute units',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t failed: custom program error: 0x0'
```

¡Si utiliza la restricción **init** de Anchor, eso suele ser todo lo que necesita para protegerse contra los ataques de reinicialización! Recuerde, sólo porque la solución para estas explotaciones de seguridad es sencilla no significa que no sea importante. Cada vez que inicialice una cuenta, asegúrese de utilizar la restricción **init** o de tener algún otro tipo de verificación en su lugar para evitar restablecer el estado inicial de una cuenta existente.

Si desea ver el código de la solución final, puede encontrarlo en la rama de **solución** de este [repositorio](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/solution).

# Reto

Al igual que con otras lecciones de este módulo, su oportunidad para practicar evitando esta explotación de seguridad radica en auditar sus propios programas o de otros.

Toma un tiempo para revisar al menos un programa y asegurarte de que las instrucciones estén adecuadamente protegidas contra los ataques de reinicialización.

Recuerde, si encuentra un error o explotación en el programa de alguien más, ¡infórmeles! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.

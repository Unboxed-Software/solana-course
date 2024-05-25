---
title: Reinicialización Ataques
objectives:
- Explicar los riesgos de seguridad asociados con una vulnerabilidad de reinicialización
- Utilice la comprobación de óxido de formato largo si una cuenta ya se ha inicializado
- Usar la `init` restricción de Anchor para inicializar cuentas, que establece automáticamente un discriminador de cuenta que se comprueba para evitar la reinicialización de una cuenta
---

# TL;DR

- Use un discriminador de cuenta o una bandera de inicialización para verificar si una cuenta ya se ha inicializado para evitar que una cuenta se reinicie y anule los datos de cuenta existentes.
- Para evitar la reinicialización de la cuenta en plain Rust, inicializa las cuentas con un `is_initialized` indicador y comprueba si ya se ha establecido en true al inicializar una cuenta

  ```rust
  if account.is_initialized {
      return Err(ProgramError::AccountAlreadyInitialized.into());
  }
  ```
- Para simplificar esto, use la `init` restricción de Anchor para crear una cuenta a través de un CPI en el programa del sistema y establezca su discriminador

# Descripción general

La inicialización se refiere a establecer los datos de una nueva cuenta por primera vez. Al inicializar una nueva cuenta, debe implementar una forma de verificar si la cuenta ya se ha inicializado. Sin una verificación adecuada, una cuenta existente podría reinicializarse y sobrescribir los datos existentes.

Tenga en cuenta que la inicialización de una cuenta y la creación de una cuenta son dos instrucciones separadas. La creación de una cuenta requiere invocar la `create_account` instrucción en el Programa del Sistema que especifica el espacio requerido para la cuenta, el alquiler en lámparas asignadas a la cuenta y el propietario del programa de la cuenta. La inicialización es una instrucción que establece los datos de una cuenta recién creada. La creación e inicialización de una cuenta se puede combinar en una sola transacción.

### Falta la verificación de inicialización

En el siguiente ejemplo, no hay cheques en la `user` cuenta. La `initialize` instrucción deserializa los datos de la `user` cuenta como un tipo de `User` cuenta, establece el `authority` campo y serializa los datos actualizados de la cuenta en la `user` cuenta.

Sin cheques en la `user` cuenta, la misma cuenta podría pasar a la `initialize` instrucción una segunda vez por otra parte para sobrescribir el existente `authority` almacenado en los datos de la cuenta.


```rust
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

### Añadir `is_initialized` cheque

Un enfoque para solucionar esto es agregar un `is_initialized` campo adicional al tipo de `User` cuenta y usarlo como indicador para verificar si una cuenta ya se ha inicializado.


```jsx
if user.is_initialized {
    return Err(ProgramError::AccountAlreadyInitialized.into());
}
```

Al incluir un cheque dentro de la `initialize` instrucción, la `user` cuenta solo se inicializaría si el `is_initialized` campo aún no se ha establecido en verdadero. Si el `is_initialized` campo ya estaba establecido, la transacción fallaría, evitando así el escenario en el que un atacante podría reemplazar la autoridad de la cuenta con su propia clave pública.


```rust
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

### Usar la `init` restricción de Anchor

Anchor proporciona una `init` restricción que se puede usar con el `#[account(...)]` atributo para inicializar una cuenta. La `init` restricción crea la cuenta a través de un CPI para el programa del sistema y establece el discriminador de cuenta.

La `init` restricción debe utilizarse en combinación con las `space` restricciones `payer` and. `payer` Especifica la cuenta que paga la inicialización de la nueva cuenta. El `space` especifica la cantidad de espacio que requiere la nueva cuenta, lo que determina la cantidad de lamports que se deben asignar a la cuenta. Los primeros 8 bytes de datos se establecen como un discriminador que Anchor añade automáticamente para identificar el tipo de cuenta.

Lo más importante para esta lección, la `init` restricción garantiza que esta instrucción solo se pueda llamar una vez por cuenta, por lo que puede establecer el estado inicial de la cuenta en la lógica de instrucciones y no tener que preocuparse de que un atacante intente reinicializar la cuenta.


```rust
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

###  `init_if_needed` Restricción de Anchor

Vale la pena señalar que Anchor tiene una `init_if_needed` restricción. Esta restricción debe utilizarse con mucha cautela. De hecho, está bloqueado detrás de una bandera de características para que se vea obligado a ser intencional al usarlo.

La `init_if_needed` restricción hace lo mismo que la `init` restricción, solo si la cuenta ya se ha inicializado, la instrucción seguirá ejecutándose.

Dado esto, es *********Extremadamente********* importante que cuando use esta restricción incluya cheques para evitar restablecer la cuenta a su estado inicial.

Por ejemplo, si la cuenta almacena un `authority` campo que se establece en la instrucción utilizando la `init_if_needed` restricción, necesita comprobaciones que garanticen que ningún atacante pueda llamar a la instrucción después de que ya se haya inicializado y volver a establecer el `authority` campo.

En la mayoría de los casos, es más seguro tener una instrucción separada para inicializar los datos de la cuenta.

# Demostración

Para esta demo vamos a crear un programa sencillo que no hace más que inicializar cuentas. Incluiremos dos instrucciones:

-  `insecure_initialization` - inicializa una cuenta que se puede reinicializar
-  `recommended_initialization` - inicializar una cuenta utilizando la `init` restricción de Anchor

### 1. Arranque

Para comenzar, descargue el código de inicio de la `starter` sucursal de[este repositorio](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/starter). El código de arranque incluye un programa con una instrucción y la configuración de la platina para el archivo de prueba.

La `insecure_initialization` instrucción inicializa una nueva `user` cuenta que almacena la clave pública de un `authority`. En esta instrucción, se espera que a la cuenta se le asigne el lado del cliente, y luego se pase a la instrucción del programa. Una vez que se pasa al programa, no hay comprobaciones para ver si el estado inicial de la `user` cuenta ya se ha establecido. Esto significa que la misma cuenta se puede pasar en un segundo tiempo para anular el `authority` almacenado en una `user` cuenta existente.


```rust
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

### 2.  `insecure_initialization` Instrucciones de prueba

El archivo de prueba incluye la configuración para crear una cuenta invocando el programa del sistema y luego invoca la `insecure_initialization` instrucción dos veces utilizando la misma cuenta.

Dado que no hay comprobaciones de que los datos de la cuenta no hayan sido ya inicializados, la `insecure_initialization` instrucción se completará con éxito en ambas ocasiones, a pesar de que la segunda invocación proporcione una cuenta de *diferente* autoridad.


```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
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

Ejecutar `anchor test` para ver que ambas transacciones se completarán con éxito.


```bash
initialization
  ✔ Insecure init (478ms)
  ✔ Re-invoke insecure init with different auth (464ms)
```

### 3. Añadir `recommended_initialization` instrucción

Vamos a crear una nueva instrucción llamada `recommended_initialization` que soluciona este problema. A diferencia de la instrucción insegura anterior, esta instrucción debe manejar tanto la creación como la inicialización de la cuenta del usuario utilizando la `init` restricción de Anchor.

Esta restricción indica al programa que cree la cuenta a través de un CPI para el programa del sistema, por lo que ya no es necesario crear la cuenta del lado del cliente. La restricción también establece el discriminador de cuenta. Su lógica de instrucciones puede establecer el estado inicial de la cuenta.

Al hacer esto, se asegura de que cualquier invocación posterior de la misma instrucción con la misma cuenta de usuario fallará en lugar de restablecer el estado inicial de la cuenta.


```rust
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

### 4.  `recommended_initialization` Instrucciones de prueba

Para probar la `recommended_initialization` instrucción, vamos a invocar la instrucción dos veces al igual que antes. Esta vez, esperamos que la transacción falle cuando intentamos inicializar la misma cuenta por segunda vez.


```tsx
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

Ejecute `anchor test` y vea que la segunda transacción que intenta inicializar la misma cuenta dos veces ahora devolverá un error que indica que la dirección de la cuenta ya está en uso.


```bash
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t invoke [1]',
'Program log: Instruction: RecommendedInitialization',
'Program 11111111111111111111111111111111 invoke [2]',
'Allocate: account Address { address: EMvbwzrs4VTR7G1sNUJuQtvRX1EuvLhqs4PFqrtDcCGV, base: None } already in use',
'Program 11111111111111111111111111111111 failed: custom program error: 0x0',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t consumed 4018 of 200000 compute units',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t failed: custom program error: 0x0'
```

Si usa la `init` restricción de Anchor, ¡eso suele ser todo lo que necesita para protegerse contra los ataques de reinicialización! Recuerde, solo porque la solución para estos exploits de seguridad sea simple no significa que no sea importante. Cada vez que inicie una cuenta, asegúrese de que está utilizando la `init` restricción o tenga algún otro control para evitar restablecer el estado inicial de una cuenta existente.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[este repositorio](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando este exploit de seguridad radica en auditar sus propios programas u otros.

Tómese un tiempo para revisar al menos un programa y asegúrese de que las instrucciones estén protegidas adecuadamente contra los ataques de reinicialización.

Recuerde, si encuentra un error o un exploit en el programa de otra persona, ¡avíselos! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.

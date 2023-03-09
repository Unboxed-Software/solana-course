# Comparación de datos de cuenta.

## Objetivos de la lección

_Al terminar esta lección podrás:_

- Explicar los riesgos de seguridad asociados con las comprobaciones de validación de datos faltantes.
- Implementar controles de validación de datos usando Rust de formato largo.
- Implementar comprobaciones de validación de datos mediante restricciones de Anchor.

# Terminología

- Utilice **verificaciones de validación de datos** para verificar que los datos de la cuenta coincidan con un valor esperado**.** Sin las verificaciones de validación de datos adecuadas, se pueden usar cuentas inesperadas en una instrucción.
- Para implementar verificaciones de validación de datos en Rust, simplemente compare los datos almacenados en una cuenta con un valor esperado.

```Rust
if ctx.accounts.user.key() != ctx.accounts.user_data.user {
    return Err(ProgramError::InvalidAccountData.into());
}
```

- En Anchor, puedes usar **constraint** para verificar si la expresión dada se evalúa como verdadera. Alternativamente, puedes usar **has_one** para verificar que un campo de cuenta objetivo almacenado en la cuenta coincida con la clave de una cuenta en la estructura **Accounts** .

# Resumen

La comparación de datos de cuenta se refiere a las verificaciones de validación de datos utilizadas para verificar que los datos almacenados en una cuenta coinciden con un valor esperado. Las verificaciones de validación de datos proporcionan una forma de incluir restricciones adicionales para asegurar que se pasan las cuentas adecuadas a una instrucción.

Esto puede ser útil cuando las cuentas requeridas por una instrucción tienen dependencias de valores almacenados en otras cuentas o si una instrucción depende de los datos almacenados en una cuenta.

## Verificación de validación de datos faltantes.

El ejemplo a continuación incluye una instrucción **update_admin** que actualiza el campo **admin** almacenado en una cuenta **admin_config** .

La instrucción carece de una verificación de validación de datos para verificar que la cuenta de **admin** que firma la transacción coincida con el **admin** almacenado en la cuenta **admin_config** . Esto significa que cualquier cuenta que firme la transacción y se pase a la instrucción como la cuenta de **admin** puede actualizar la cuenta **admin_config**.

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

## Agregar verificación de validación de datos

El enfoque básico de Rust para resolver este problema es simplemente comparar la clave de **admin** pasada con la clave de **admin** almacenada en la cuenta **admin_config** , lanzando un error si no coinciden.

```Rust
if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

Al agregar una verificación de validación de datos, la instrucción **update_admin** solo se procesaría si el **admin** que firma la transacción coincide con el **admin** almacenado en la cuenta **admin_config**.

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
      if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

## Usar restricciones de Anchor

Anchor simplifica esto con la restricción **has_one**. Puedes usar la restricción **has_one** para mover la verificación de validación de datos de la lógica de la instrucción a la estructura **UpdateAdmin** .

En el ejemplo de abajo, **has_one = admin** especifica que la cuenta de **admin** que firma la transacción debe coincidir con el campo **admin** almacenado en la cuenta **admin_config** . Para usar la restricción **has_one** , la convención de nombres del campo de datos en la cuenta debe ser consistente con la convención de nombres en la estructura de validación de cuentas.

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

Alternativamente, puedes usar una **constraint** para agregar manualmente una expresión que debe evaluarse como verdadera para que la ejecución continúe. Esto es útil cuando por alguna razón los nombres no pueden ser consistentes o cuando se necesita una expresión más compleja para validar completamente los datos introducidos.

```Rust
#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        constraint = admin_config.admin == admin.key()
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}
```

# Demostración

Para esta demostración, crearemos un programa "vault" simple, similar al programa que usamos en la lección de Autorización de Firmante y en la lección de Comprobación de Propietario. Al igual que en esas demostraciones, en esta demostración mostraremos cómo una verificación de validación de datos faltante podría permitir que se vacíe una bóveda.

## 1. Iniciemos

Para comenzar, descarga el código inicial de la rama **starter** de este [repositorio](https://github.com/Unboxed-Software/solana-account-data-matching). El código inicial incluye un programa con dos instrucciones y la configuración de plantilla para el archivo de prueba.

La instrucción **initialize_vault** inicia una nueva cuenta **Vault** y una nueva cuenta **TokenAccount** . La cuenta **Vault** almacenará la dirección de una cuenta de tokens, la autoridad del vault y una cuenta de destino de retirada de tokens.

La autoridad de la nueva cuenta de tokens se establecerá como el **vault** , un PDA del programa. Esto permite que la cuenta **vault** firme para la transferencia de tokens desde la cuenta de tokens.

La instrucción **insecure_withdraw** transfiere todos los tokens de la cuenta de tokens de la cuenta **vault** a una cuenta **withdraw_destination** de retirada de tokens.

Tenga en cuenta que esta instrucción tiene una verificación de firmante para la **authority** y una verificación de propietario para el **vault** . Sin embargo, en ninguna parte de la validación de cuentas o en la lógica de la instrucción hay código que verifique que la cuenta de **authority** pasada a la instrucción coincida con la cuenta de **authority** en el **vault** .

```Rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        ctx.accounts.vault.withdraw_destination = ctx.accounts.withdraw_destination.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InsecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
    withdraw_destination: Pubkey,
}
```

## 2. Instrucciones para prueba **insecure_withdraw**

Para demostrar que esto es un problema, escribamos una prueba en la que una cuenta que no sea la **authority** del vault intente retirar del vault.

El archivo de pruebas incluye el código para invocar la instrucción **initialize_vault** utilizando la billetera del proveedor como **authority** y luego acuña 100 tokens en la cuenta de tokens del **vault** .

Agregue una prueba para invocar la instrucción **insecure_withdraw** . Utilice **withdrawDestinationFake** como la **withdrawDestination** y **walletFake** como la **authority** . Luego envíe la transacción utilizando **walletFake** .

Dado que no hay verificaciones para verificar que la cuenta de **authority** pasada a la instrucción coincida con los valores almacenados en la cuenta **vault** iniciada en la primera prueba, la instrucción se procesará con éxito y los tokens se transferirán a la cuenta **withdrawDestinationFake**.

```Rust
describe("account-data-matching", () => {
  ...
  it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestinationFake,
        authority: walletFake.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Ejecute la **anchor test** para ver que ambas transacciones se completarán con éxito.

```Rust
account-data-matching
  ✔ Initialize Vault (811ms)
  ✔ Insecure withdraw (403ms)
```

## 3. Agrega la instrucción **secure_withdraw**

Vamos a implementar una versión segura de esta instrucción llamada **secure_withdraw** .

Esta instrucción será idéntica a la instrucción **insecure_withdraw** , excepto que usaremos la restricción **has_one** en la estructura de validación de cuentas ( **SecureWithdraw** ) para verificar que la cuenta de **autoridad** pasada a la instrucción coincida con la cuenta de **autoridad** en la cuenta **vault** . De esa manera solo la cuenta de autoridad correcta puede retirar los tokens del vault.

```Rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;
    ...
    pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
        has_one = token_account,
        has_one = authority,
        has_one = withdraw_destination,

    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

## 4. Instrucciones para prueba **secure_withdraw**

Ahora vamos a probar la instrucción **secure_withdraw** con dos pruebas: una que utiliza **walletFake** como autoridad y otra que utiliza **wallet** como autoridad. Esperamos que la primera ejecución devuelva un error y la segunda tenga éxito.

```Rust
describe("account-data-matching", () => {
  ...
  it("Secure withdraw, expect error", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenPDA,
          withdrawDestination: withdrawDestinationFake,
          authority: walletFake.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Secure withdraw", async () => {
    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      tokenPDA,
      wallet.payer,
      100
    )

    await program.methods
      .secureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestination,
        authority: wallet.publicKey,
      })
      .rpc()

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Ejecuta una **anchor test** para verificar la transacción, utiliza una cuenta de autoridad incorrecta y debe arrojar un error de anclaje, mientras que la transacción que utiliza las cuentas correctas se completa con éxito.

```Rust
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: ConstraintHasOne. Error Number: 2001. Error Message: A has one constraint was violated.',
'Program log: Left:',
'Program log: DfLZV18rD7wCQwjYvhTFwuvLh49WSbXFeJFPQb5czifH',
'Program log: Right:',
'Program log: 5ovvmG5ntwUC7uhNWfirjBHbZD96fwuXDMGXiyMwPg87',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 10401 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d1'
```

Ten en cuenta que Anchor especifica en los registros la cuenta que causa el error ( **AnchorError caused by account: vault** ).

```Rust
✔ Secure withdraw, expect error (77ms)
✔ Secure withdraw (10073ms)
```

Y así de fácil, has cerrado el hueco de seguridad. El tema en la mayoría de estas posibles explotaciones es que son bastante simples. Sin embargo, a medida que tus programas crecen en alcance y complejidad, se vuelve cada vez más fácil pasar por alto posibles explotaciones. Es genial acostumbrarse a escribir pruebas que envíen instrucciones que no deberían funcionar. Cuantas más, mejor. De esa manera, atrapas problemas antes de implementarlos.

Si quieres ver el código final de la solución, puedes encontrarlo en la rama de **solution** del [repositorio](https://github.com/Unboxed-Software/solana-account-data-matching/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, tu oportunidad de practicar evitando esta explotación de seguridad radica en auditar tus propios programas o de otros.

Tómate un tiempo para revisar al menos un programa y asegurarte de que estén en su lugar las comprobaciones de datos adecuadas para evitar explotaciones de seguridad.

Recuerda, si encuentras un error o explotación en el programa de alguien más, ¡avísale! Si encuentras uno en tu propio programa, asegúrate de corregirlo de inmediato.

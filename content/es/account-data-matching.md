---
title: Objetivos de coincidencia de datos de cuenta
objectives:
- Explicar los riesgos de seguridad asociados con la falta de comprobaciones de validación de datos
- Implementar comprobaciones de validación de datos utilizando Rust de formato largo
- Implementar comprobaciones de validación de datos utilizando restricciones de anclaje
---

# TL;DR

- Usar **comprobaciones de validación de datos** para verificar que los datos de la cuenta coincidan con un valor esperado**.** Sin las comprobaciones de validación de datos apropiadas, se pueden usar cuentas inesperadas en una instrucción.
- Para implementar comprobaciones de validación de datos en Rust, simplemente compare los datos almacenados en una cuenta con un valor esperado.

    
    ```rust
    if ctx.accounts.user.key() != ctx.accounts.user_data.user {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```
    
- En Anchor, puede usar `constraint` para comprobar si la expresión dada se evalúa como verdadera. Alternativamente, puede usar `has_one` para verificar que un campo de cuenta de destino almacenado en la cuenta coincida con la clave de una cuenta en la `Accounts` estructura.

# Descripción general

La coincidencia de datos de cuenta se refiere a las comprobaciones de validación de datos utilizadas para verificar que los datos almacenados en una cuenta coincidan con un valor esperado. Las comprobaciones de validación de datos proporcionan una forma de incluir restricciones adicionales para garantizar que las cuentas apropiadas se transfieran a una instrucción.

Esto puede ser útil cuando las cuentas requeridas por una instrucción tienen dependencias de valores almacenados en otras cuentas o si una instrucción depende de los datos almacenados en una cuenta.

### Falta verificación de validación de datos

El siguiente ejemplo incluye una `update_admin` instrucción que actualiza el `admin` campo almacenado en una `admin_config` cuenta.

A la instrucción le falta una verificación de validación de datos para verificar que la `admin` cuenta que firma la transacción coincide con la `admin` almacenada en la `admin_config` cuenta. Esto significa que cualquier cuenta que firme la transacción y pase a la instrucción, ya que la `admin` cuenta puede actualizar la `admin_config` cuenta.


```rust
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

### Añadir comprobación de validación de datos

El enfoque básico de Rust para resolver este problema es simplemente comparar la `admin` clave pasada con la `admin` clave almacenada en la `admin_config` cuenta, lanzando un error si no coinciden.


```rust
if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

Al agregar una verificación de validación de datos, la `update_admin` instrucción solo se procesaría si el `admin` firmante de la transacción coincidiera con el `admin` almacenado en la `admin_config` cuenta.


```rust
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

### Usar restricciones de anclaje

Anchor simplifica esto con la `has_one` restricción. Puede usar la `has_one` restricción para mover la comprobación de validación de datos de la lógica de instrucciones a la `UpdateAdmin` estructura.

En el siguiente ejemplo, se `has_one = admin` especifica que la `admin` cuenta que firma la transacción debe coincidir con el `admin` campo almacenado en la `admin_config` cuenta. Para usar la `has_one` restricción, la convención de nomenclatura del campo de datos en la cuenta debe ser coherente con la nomenclatura en la estructura de validación de cuenta.


```rust
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

Alternativamente, puede usar `constraint` para añadir manualmente una expresión que debe evaluarse a true para que la ejecución continúe. Esto es útil cuando por alguna razón el nombre no puede ser consistente o cuando necesita una expresión más compleja para validar completamente los datos entrantes.


```rust
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

Para esta demostración, crearemos un programa simple de "bóveda" similar al programa que usamos en la lección de Autorización del firmante y la lección de Verificación del propietario. Similar a esas demostraciones, mostraremos en esta demostración cómo una verificación de validación de datos faltante podría permitir que se drene la bóveda.

### 1. Arranque

Para comenzar, descargue el código de inicio de la `starter` sucursal de[este repositorio](https://github.com/Unboxed-Software/solana-account-data-matching). El código de arranque incluye un programa con dos instrucciones y la configuración de la platina para el archivo de prueba.

La `initialize_vault` instrucción inicializa una nueva `Vault` cuenta y una nueva `TokenAccount`. La `Vault` cuenta almacenará la dirección de una cuenta de token, la autoridad de la bóveda y una cuenta de token de destino de retiro.

La autoridad de la nueva cuenta de token se establecerá como `vault` PDA del programa. Esto permite que la `vault` cuenta firme para la transferencia de tokens desde la cuenta de tokens.

La `insecure_withdraw` instrucción transfiere todos los tokens en la `vault` cuenta de tokens de la cuenta a una cuenta de `withdraw_destination` tokens.

Tenga en cuenta que esta instrucción ****lo hace**** tiene una verificación de firmante `authority` y una verificación de propietario `vault`. Sin embargo, en ninguna parte de la validación de la cuenta o la lógica de la instrucción hay código que compruebe que la `authority` cuenta pasada a la instrucción coincida con la `authority` cuenta en el `vault`.


```rust
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

### 2.  `insecure_withdraw` Instrucciones de prueba

Para demostrar que esto es un problema, escribamos una prueba donde una cuenta que no sea la de la bóveda `authority` intente retirarse de la bóveda.

El archivo de prueba incluye el código para invocar la `initialize_vault` instrucción utilizando la billetera del proveedor como el `authority` y luego acuña 100 tokens a la cuenta de `vault` tokens.

Añadir una prueba para invocar la `insecure_withdraw` instrucción. Utilice `withdrawDestinationFake` como la `withdrawDestination` cuenta y `walletFake` como el `authority`. Luego envíe la transacción usando `walletFake`.

Dado que no hay comprobaciones de que la `authority` cuenta pasada a la instrucción coincida con los valores almacenados en la `vault` cuenta inicializada en la primera prueba, la instrucción se procesará con éxito y los tokens se transferirán a la `withdrawDestinationFake` cuenta.


```tsx
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

Ejecutar `anchor test` para ver que ambas transacciones se completarán con éxito.


```bash
account-data-matching
  ✔ Initialize Vault (811ms)
  ✔ Insecure withdraw (403ms)
```

### 3. Añadir `secure_withdraw` instrucción

Vamos a implementar una versión segura de esta instrucción llamada `secure_withdraw`.

Esta instrucción será idéntica a la `insecure_withdraw` instrucción, excepto que usaremos la `has_one` restricción en la estructura de validación de cuenta ( `SecureWithdraw`) para verificar que la `authority` cuenta pasada a la instrucción coincida con la `authority` cuenta de la `vault` cuenta. De esa manera, solo la cuenta de autoridad correcta puede retirar los tokens de la bóveda.


```rust
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

### 4.  `secure_withdraw` Instrucciones de prueba

Ahora probemos la `secure_withdraw` instrucción con dos pruebas: una que usa `walletFake` como autoridad y otra que usa `wallet` como autoridad. Esperamos que la primera invocación devuelva un error y la segunda tenga éxito.


```tsx
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

Ejecute `anchor test` para ver que la transacción con una cuenta de autoridad incorrecta ahora devolverá un error de anclaje mientras la transacción con las cuentas correctas se completa con éxito.


```bash
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

Tenga en cuenta que Anchor especifica en los registros la cuenta que causa el error ( `AnchorError caused by account: vault`).


```bash
✔ Secure withdraw, expect error (77ms)
✔ Secure withdraw (10073ms)
```

Y así, has cerrado la brecha de seguridad. El tema en la mayoría de estos exploits potenciales es que son bastante simples. Sin embargo, a medida que sus programas crecen en alcance y complejidad, es cada vez más fácil perderse posibles exploits. Es genial tener el hábito de escribir pruebas que envíen instrucciones que *no debería* funcionen. Cuanto más, mejor. De esa forma detectas problemas antes de desplegarte.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[el repositorio](https://github.com/Unboxed-Software/solana-account-data-matching/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando este exploit de seguridad radica en auditar sus propios programas u otros.

Tómese un tiempo para revisar al menos un programa y asegúrese de que se realicen las verificaciones de datos adecuadas para evitar vulnerabilidades de seguridad.

Recuerde, si encuentra un error o un exploit en el programa de otra persona, ¡avíselos! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.
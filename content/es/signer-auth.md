---
title: Objetivos de la autorización del firmante
objectives:
- Explicar los riesgos de seguridad asociados con no realizar las comprobaciones apropiadas del firmante
- Implementar comprobaciones de firmantes utilizando Rust de formato largo
- Implementar comprobaciones de firmantes utilizando el `Signer` tipo de Anchor
- Implementar comprobaciones de firmantes utilizando la `#[account(signer)]` restricción de Anchor
---

# TL;DR

-   Utilícelo **Comprobaciones del firmante** para verificar que cuentas específicas hayan firmado una transacción. Sin las comprobaciones apropiadas del firmante, las cuentas pueden ser capaces de ejecutar instrucciones que no deberían estar autorizadas a realizar.
-   Para implementar un registro de firmantes en Rust, simplemente verifique que la `is_signer` propiedad de una cuenta sea `true`

    ```rust
    if !ctx.accounts.authority.is_signer {
    	return Err(ProgramError::MissingRequiredSignature.into());
    }
    ```

-   En Anchor, puede usar el tipo de ** `Signer` ** cuenta en la estructura de validación de su cuenta para que Anchor realice automáticamente una verificación de firmante en una cuenta determinada
-   Anchor también tiene una restricción de cuenta que verificará automáticamente que una cuenta determinada ha firmado una transacción.

# Descripción general

Los cheques de firmante se utilizan para verificar que el propietario de una cuenta determinada ha autorizado una transacción. Sin una verificación del firmante, las operaciones cuya ejecución debería limitarse a solo cuentas específicas pueden realizarse potencialmente por cualquier cuenta. En el peor de los casos, esto podría resultar en que las billeteras sean completamente drenadas por los atacantes que pasan cualquier cuenta que quieran a una instrucción.

### Falta la verificación del firmante

El siguiente ejemplo muestra una versión simplificada de una instrucción que actualiza el `authority` campo almacenado en una cuenta de programa.

Observe que el `authority` campo en la estructura de validación de `UpdateAuthority` cuenta es de tipo `AccountInfo`. En Anchor, el tipo de `AccountInfo` cuenta indica que no se realizan comprobaciones en la cuenta antes de la ejecución de la instrucción.

Aunque la `has_one` restricción se utiliza para validar la `authority` cuenta pasada a la instrucción coincide con el `authority` campo almacenado en la `vault` cuenta, no hay verificación para verificar la `authority` cuenta autorizada para la transacción.

Esto significa que un atacante puede simplemente pasar la clave pública de la `authority` cuenta y su propia clave pública como la `new_authority` cuenta para reasignarse a sí mismo como la nueva autoridad de la `vault` cuenta. En ese momento, pueden interactuar con el programa como la nueva autoridad.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod insecure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
   #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### Añadir comprobaciones de autorización del firmante

Todo lo que necesita hacer para validar que la `authority` cuenta firmada es añadir un cheque de firmante dentro de la instrucción. Eso simplemente significa comprobar que `authority.is_signer` es `true`, y devolver un `MissingRequiredSignature` error si `false`.

```tsx
if !ctx.accounts.authority.is_signer {
    return Err(ProgramError::MissingRequiredSignature.into());
}
```

Al agregar un cheque de firmante, la instrucción solo se procesaría si la cuenta ingresara como la `authority` cuenta que también firmó la transacción. Si la transacción no fue firmada por la cuenta pasada como la `authority` cuenta, entonces la transacción fallaría.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
            if !ctx.accounts.authority.is_signer {
            return Err(ProgramError::MissingRequiredSignature.into());
        }

        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### Usar el tipo de `Signer` cuenta de Anchor

Sin embargo, poner esta verificación en la función de instrucción confunde la separación entre la validación de la cuenta y la lógica de instrucción.

Afortunadamente, Anchor facilita la realización de comprobaciones de firmantes al proporcionar el tipo de `Signer` cuenta. Simplemente cambie el tipo de `authority` cuenta en la estructura de validación de cuenta para que sea de tipo `Signer`, y Anchor comprobará en tiempo de ejecución que la cuenta especificada es un firmante de la transacción. Este es el enfoque que generalmente recomendamos, ya que le permite separar la verificación del firmante de la lógica de instrucciones.

En el siguiente ejemplo, si la `authority` cuenta no firma la transacción, entonces la transacción fallará incluso antes de alcanzar la lógica de instrucciones.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Tenga en cuenta que cuando utiliza el `Signer` tipo, no se realizan otras comprobaciones de propiedad o tipo.

### Usar la `#[account(signer)]` restricción de Anchor

Si bien en la mayoría de los `Signer` casos, el tipo de cuenta será suficiente para garantizar que una cuenta haya firmado una transacción, el hecho de que no se realicen otras verificaciones de propiedad o tipo significa que esta cuenta no se puede usar realmente para nada más en la instrucción.

Aquí es donde el `signer` _restricción_ viene en práctica. La `#[account(signer)]` restricción le permite verificar la cuenta que firmó la transacción, al mismo tiempo que obtiene los beneficios de usar el `Account` tipo si también desea acceder a sus datos subyacentes.

Como ejemplo de cuándo esto sería útil, imagine escribir una instrucción que espera que se invoque a través de CPI que espera que una de las cuentas pasadas sea a la vez un **\*\***firmante**\*\*** en la transacción y un ****\*\*\***** fuente de datos****\*\*\*****. El uso del tipo de `Signer` cuenta aquí elimina la deserialización automática y la comprobación de tipo que obtendría con el `Account` tipo. Esto es inconveniente, ya que necesita deserializar manualmente los datos de la cuenta en la lógica de instrucciones, y puede hacer que su programa sea vulnerable al no obtener la verificación de propiedad y tipo realizada por el `Account` tipo.

En el siguiente ejemplo, puede escribir lógica de forma segura para interactuar con los datos almacenados en la `authority` cuenta y al mismo tiempo verificar que firmó la transacción.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();

        // access the data stored in authority
        msg!("Total number of depositors: {}", ctx.accounts.authority.num_depositors);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    #[account(signer)]
    pub authority: Account<'info, AuthState>
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
#[account]
pub struct AuthState{
	amount: u64,
	num_depositors: u64,
	num_vaults: u64
}
```

# Demostración

Practiquemos creando un programa simple para demostrar cómo un cheque de firmante faltante puede permitir que un atacante retire tokens que no les pertenecen.

Este programa inicializa una cuenta de "bóveda" de token simplificado y demuestra cómo un cheque de firmante faltante podría permitir que se drene la bóveda.

### 1. Arranque

Para comenzar, descargue el código de inicio de la `starter` sucursal de[este repositorio](https://github.com/Unboxed-Software/solana-signer-auth/tree/starter). El código de arranque incluye un programa con dos instrucciones y la configuración de la platina para el archivo de prueba.

La `initialize_vault` instrucción inicializa dos cuentas nuevas: `Vault` y `TokenAccount`. La `Vault` cuenta se inicializará utilizando una dirección derivada del programa (PDA) y almacenará la dirección de una cuenta de token y la autoridad de la bóveda. La autoridad de la cuenta de token será el `vault` PDA que permite al programa firmar para la transferencia de tokens.

La `insecure_withdraw` instrucción transferirá tokens en la `vault` cuenta de tokens de la cuenta a una cuenta `withdraw_destination` de tokens. Sin embargo, la `authority` cuenta en la `InsecureWithdraw` estructura tiene un tipo de `UncheckedAccount`. Este es un envoltorio `AccountInfo` para indicar explícitamente que la cuenta no está marcada.

Sin un cheque de firmante, cualquiera puede simplemente proporcionar la clave pública de la `authority` cuenta que coincide `authority` almacenada en la `vault` cuenta y la `insecure_withdraw` instrucción continuaría procesándose.

Si bien esto es algo artificial en el sentido de que cualquier programa DeFi con una bóveda sería más sofisticado que esto, mostrará cómo la falta de un cheque de firmante puede resultar en que los tokens sean retirados por la parte equivocada.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
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
        space = 8 + 32 + 32,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
    )]
    pub token_account: Account<'info, TokenAccount>,
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
        has_one = token_account,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    /// CHECK: demo missing signer check
    pub authority: UncheckedAccount<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 2. `insecure_withdraw` Instrucciones de prueba

El archivo de prueba incluye el código para invocar la `initialize_vault` instrucción usando `wallet` como el `authority` en la bóveda. El código entonces acuña 100 fichas a la cuenta `vault` de fichas. Teóricamente, la `wallet` clave debería ser la única que pueda retirar los 100 tokens de la bóveda.

Ahora, añadamos una prueba para invocar `insecure_withdraw` en el programa para mostrar que la versión actual del programa permite a un tercero retirar esos 100 tokens.

En la prueba, seguiremos usando la clave pública de `wallet` como `authority` cuenta, pero usaremos un par de claves diferente para firmar y enviar la transacción.

```tsx
describe("signer-authorization", () => {
    ...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenAccount.publicKey,
        withdrawDestination: withdrawDestinationFake,
        authority: wallet.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(
      tokenAccount.publicKey
    )
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Ejecutar `anchor test` para ver que ambas transacciones se completarán con éxito.

```bash
signer-authorization
  ✔ Initialize Vault (810ms)
  ✔ Insecure withdraw  (405ms)
```

Dado que no hay verificación de firmante para la `authority` cuenta, la `insecure_withdraw` instrucción transferirá tokens desde la cuenta de `vault` tokens a la cuenta de `withdrawDestinationFake` tokens siempre que la clave pública de la `authority` cuenta coincida con la clave pública almacenada en el campo de autoridad de la `vault` cuenta. Claramente, la `insecure_withdraw` instrucción es tan insegura como su nombre sugiere.

### 3. Añadir `secure_withdraw` instrucción

Vamos a solucionar el problema en una nueva instrucción llamada `secure_withdraw`. Esta instrucción será idéntica a la `insecure_withdraw` instrucción, excepto que usaremos el `Signer` tipo en la estructura Cuentas para validar la `authority` cuenta en la `SecureWithdraw` estructura. Si la `authority` cuenta no es un firmante en la transacción, entonces esperamos que la transacción falle y devuelva un error.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
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
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

### 4. `secure_withdraw` Instrucciones de prueba

Con la instrucción en su lugar, vuelva al archivo de prueba para probar la `secure_withdraw` instrucción. Invoque la `secure_withdraw` instrucción, nuevamente utilizando la clave pública de `wallet` como `authority` cuenta y el `withdrawDestinationFake` par de claves como firmante y destino de retiro. Dado que la `authority` cuenta se valida utilizando el `Signer` tipo, esperamos que la transacción falle en la verificación del firmante y devuelva un error.

```tsx
describe("signer-authorization", () => {
    ...
	it("Secure withdraw", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenAccount.publicKey,
          withdrawDestination: withdrawDestinationFake,
          authority: wallet.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

Ejecute `anchor test` para ver que la transacción ahora devolverá un error de verificación de firma.

```bash
Error: Signature verification failed
```

¡Eso es todo! Esto es algo bastante simple de evitar, pero increíblemente importante. Asegúrese de pensar siempre en quién debería autorizar las instrucciones y asegúrese de que cada uno sea un firmante de la transacción.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[el repositorio](https://github.com/Unboxed-Software/solana-signer-auth/tree/solution).

# Desafío

En este punto del curso, esperamos que haya comenzado a trabajar en programas y proyectos fuera de las Demostraciones y Desafíos proporcionados en estas lecciones. Para esta y el resto de las lecciones sobre vulnerabilidades de seguridad, el desafío para cada lección será auditar su propio código para la vulnerabilidad de seguridad discutida en la lección.

Alternativamente, puede encontrar programas de código abierto para auditar. Hay muchos programas que puedes ver. Un buen comienzo si no te importa sumergirte en el óxido nativo sería el[Programas SPL](https://github.com/solana-labs/solana-program-library).

Entonces, para esta lección, eche un vistazo a un programa (ya sea suyo o uno que haya encontrado en línea) y audítelo para verificaciones de firmantes. Si encuentra un error en el programa de otra persona, por favor, ¡avíselos! Si encuentra un error en su propio programa, asegúrese de parchearlo de inmediato.

# Firma de Autorización

## Objetivos de la Lección:

_Al final de esta lección, podrás:_

Explicar los riesgos de seguridad asociados con no realizar comprobaciones de firmas adecuadas:

- Implementando comprobaciones de firma de formato largo RUST
- Implementar comprobaciones de firmas utilizando Anchor´s **Signer**.
- Implementar comprobaciones de firma usando la restricción Anchor´s **#[account(signer)]**

# Terminología

- Use las **comprobaciones de firma** para verificar que cuentas específicas hayan firmado una transacción. Sin las comprobaciones de firma adecuadas, las cuentas pueden ser capaces de ejecutar instrucciones para las cuales no estén autorizadas.
- Para implementar una comprobación de firma en Rust, simplemente verifique que la propiedad **is_signer** de una cuenta sea **true** .

```Rust
if !ctx.accounts.authority.is_signer {
	return Err(ProgramError::MissingRequiredSignature.into());
}
```

- En Anchor, puede utilizar el tipo de cuenta **Signer** en su estructura de validación de cuenta para que Anchor realice automáticamente una comprobación de firma en una cuenta determinada.
- Anchor también tiene una restricción de cuenta que verificará automáticamente que una cuenta dada haya firmado una transacción.

# Resumen

Las comprobaciones de firmante se utilizan para verificar que el propietario de una cuenta dada ha autorizado una transacción. Sin una comprobación de firmante, las operaciones cuyo uso debiera limitarse a ciertas cuentas específicas podrían ejecutarse potencialmente por cualquier cuenta. En el peor de los casos, esto podría resultar en el vaciado completo de billeteras por parte de atacantes que ingresan cualquier cuenta que deseen en una instrucción.

## Falta comprobación de firmante

El ejemplo a continuación muestra una versión simplificada de una instrucción que actualiza el campo de **authority** almacenado en una cuenta de programa.

Observe que el campo de **authority** en la estructura de validación de cuenta **UpdateAuthority** es de tipo **AccountInfo** . En Anchor, el tipo de cuenta **AccountInfo** indica que no se realizan comprobaciones en la cuenta antes de la ejecución de la instrucción.

Aunque se utiliza la restricción **has_one** para validar que la cuenta de **authority** pasada a la instrucción coincida con el campo de **authority** almacenado en la cuenta de **vault**, no hay ninguna comprobación para verificar que la cuenta de **authority** haya autorizado la transacción.

Esto significa que un atacante puede simplemente pasar la clave pública de la cuenta de **authority** y su propia clave pública como cuenta de **new_authority** para reasignarse a sí mismo como la nueva autoridad de la cuenta de **vault**. A partir de ese momento, pueden interactuar con el programa como la nueva autoridad.

```Rust
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

## Agregar comprobaciones de autorización de firmante

Todo lo que necesita hacer para validar que la cuenta de **authority** firmada es agregar una comprobación de firmante dentro de la instrucción. Esto significa simplemente verificar que **authority.is_signer** sea **true** y devolver un error **MissingRequiredSignature** si es **false** .

```Rust
if !ctx.accounts.authority.is_signer {
    return Err(ProgramError::MissingRequiredSignature.into());
}
```

Al agregar una comprobación de firmante, la instrucción solo se procesaría si la cuenta pasada como cuenta de **authority** también firmó la transacción. Si la transacción no fue firmada por la cuenta pasada como cuenta de **authority** , entonces la transacción fallaría.

```Rust
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

## Use el tipo de cuenta **Signer** de Anchor

Sin embargo, poner esta comprobación en la función de instrucción confunde la separación entre la validación de cuenta y la lógica de instrucción.

Afortunadamente, Anchor hace fácil realizar comprobaciones de firmante proporcionando el tipo de cuenta **Signer** . Simplemente cambie el tipo de cuenta de **authority** en la estructura de validación de cuenta para ser del tipo **Signer** , y Anchor realizará la comprobación en tiempo de ejecución de que la cuenta especificada sea una firmante en la transacción. Este es el enfoque que generalmente recomendamos ya que permite separar la comprobación de firmante de la lógica de instrucción.

En el ejemplo de abajo, si la cuenta de **authority** no firma la transacción, entonces la transacción fallará antes de llegar a la lógica de instrucción.

```Rust
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

Cabe destacar que cuando utiliza el tipo **Signer** , no se realizan otras comprobaciones de propiedad o tipo.

## Use la restricción de cuenta de Anchor's **#[account(signer)]**

Aunque en la mayoría de los casos, el tipo de cuenta **Signer** será suficiente para garantizar que una cuenta haya firmado una transacción, el hecho de que no se realicen otras comprobaciones de propiedad o tipo, significa que esta cuenta realmente no se puede usar para nada más en la instrucción.

Es aquí donde entra en juego la restricción de **signer** . La restricción de cuenta **#[account(signer)]** le permite verificar que la cuenta firmó la transacción, al mismo tiempo que obtiene los beneficios de usar el tipo de **Account** si también desea acceder a los datos subyacentes.

Como ejemplo de cuándo sería útil esto, imagínese escribir una instrucción que espera ser invocada a través de CPI y espera que una de las cuentas pasadas sea tanto una **firmante** de la transacción como una **fuente de datos** . Usar el tipo de cuenta **Signer** aquí elimina la deserialización automática y la comprobación de tipos que obtendría con el tipo de **Account**. Esto es tanto inconveniente, ya que necesita deserializar manualmente los datos de la cuenta en la lógica de la instrucción, y puede hacer que su programa sea vulnerable al no realizar las comprobaciones de propiedad y tipo realizadas por el tipo de **Account**.

En el ejemplo de abajo, puede escribir lógica segura para interactuar con los datos almacenados en la cuenta de **authority** mientras también verifica que haya firmado la transacción.

```Rust
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

Practiquemos creando un programa simple para demostrar cómo una comprobación de firmante faltante puede permitir a un atacante retirar tokens que no les pertenecen.

Este programa inicializa una cuenta "vault" de tokens simplificada y demuestra cómo una comprobación de firmante faltante podría permitir vaciar la vault.

## 1. Comencemos

Para comenzar, descargue el código inicial de la rama **starter** de este [repositorio](https://github.com/Unboxed-Software/solana-signer-auth/tree/starter). El código inicial incluye un programa con dos instrucciones y la configuración de la plantilla para el archivo de prueba.

La instrucción **initialize_vault** inicia dos nuevas cuentas: **Vault** y **TokenAccount** . La cuenta **Vault** se inicia utilizando una dirección derivada del programa (PDA) y almacenará la dirección de una cuenta de token y la autoridad de la vault. La autoridad de la cuenta de token será la **vault** PDA del programa, lo que permite al programa firmar para la transferencia de tokens.

La instrucción **insecure_withdraw** transferirá tokens de la cuenta de token de la **vault** a una **withdraw_destination** de retirada. Sin embargo, la cuenta de **authority** en la estructura **InsecureWithdraw** tiene un tipo de **UncheckedAccount** . Esto es un envoltorio alrededor de **AccountInfo** para indicar explícitamente que la cuenta no está comprobada.

Sin una comprobación de firmante, cualquiera puede simplemente proporcionar la clave pública de la cuenta de **authority** que coincide con la **authority** almacenada en la cuenta de **vault** y la instrucción de **insecure_withdraw** se continuaría procesando.

Aunque esto es algo forzado en el sentido de que cualquier programa DeFi con una vault sería más sofisticado que esto, mostrará cómo la falta de una comprobación de firmante puede resultar en tokens retirados por la mala parte.

```Rust
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

## 2. Instrucciones para prueba **insecure_withdraw**

El archivo de prueba incluye el código para invocar la instrucción **initialize_vault** utilizando la **wallet** como **authority** en la vault. Luego, acuña 100 tokens en la cuenta de token de la **vault**. Teóricamente, la clave de **wallet** debería ser la única que puede retirar los 100 tokens de la vault.

Ahora, agreguemos una prueba para invocar **insecure_withdraw** en el programa para mostrar que la versión actual del programa permite a un tercero retirar esos 100 tokens.

En la prueba, todavía usaremos la clave pública de la **wallet** como cuenta de **authority** , pero usaremos un par de claves diferentes para firmar y enviar la transacción.

```Rust
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

Ejecuta la **anchor test** para verificar que ambas transacciones se completarán con éxito.

```Rust
signer-authorization
  ✔ Initialize Vault (810ms)
  ✔ Insecure withdraw  (405ms)
```

Ya que no hay comprobación de firmante para la cuenta de **authority** , la **insecure_withdraw** (instrucción de retirada) insegura transferirá tokens de la cuenta de token de la **vault** a la **withdrawDestinationFake** siempre que la clave pública de la cuenta de autoridad coincida con la clave pública almacenada en el campo de **authority** de la cuenta de **vault**. Claramente, la instrucción de **insecure_withdraw** es tan insegura como su nombre sugiere.

## 3. Agrega la instrucción de **secure_withdraw**

Arreglemos el problema en una nueva instrucción llamada **secure_withdraw** . Esta instrucción será idéntica a la instrucción de **insecure_withdraw**, excepto que usaremos el tipo de cuenta **Signer** en la estructura para validar la cuenta de **authority** en la estructura **SecureWithdraw** . Si la cuenta de **authority** no es una firma en la transacción, esperamos que la transacción falle y devuelva un error.

```Rust
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

## 4. Instrucciones para prueba **secure_withdraw**

Con la instrucción en su lugar, regrese al archivo de prueba para probar la instrucción de **secure_withdraw**. Invoque la instrucción de retirada segura, nuevamente usando la clave pública de la **wallet** como cuenta de **authority** y el **withdrawDestinationFake** como par de claves de firmante y destino de retirada. Dado que la cuenta de **authority** se valida utilizando el tipo Signer, esperamos que la transacción falle en la comprobación del **Signer** y devuelva un error.

```Rust
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

Ejecute la **anchor test** para ver que la transacción ahora arrojará un error de verificación de firma.

```Rust
Error: Signature verification failed
```

¡Eso es todo! Esto es algo bastante simple de evitar, pero increíblemente importante. Asegúrese de pensar siempre en quién debería autorizar las instrucciones y asegurarse de que cada uno sea un firmante en la transacción.
Si desea echar un vistazo al código de la solución final, puede encontrarlo en la rama de **solución** del [repositorio](https://github.com/Unboxed-Software/solana-signer-auth/tree/solution).

# Desafío

En este punto del curso, esperamos que haya comenzado a trabajar en programas y proyectos fuera de los demos y desafíos proporcionados en estas lecciones. Para esto y el resto de las lecciones sobre vulnerabilidades de seguridad, el Desafío de cada lección será revisar su propio código para la vulnerabilidad de seguridad discutida en la lección.

Alternativamente, puede encontrar programas de código abierto para revisar. Hay muchos programas que puedes ver. Un buen comienzo si no te importa sumergirte en Rust nativo serían los **programas** [ SPL](https://github.com/solana-labs/solana-program-library).

Entonces, para esta lección, eche un vistazo a un programa (ya sea el suyo o uno que haya encontrado en línea) y revise las comprobaciones de firmante. Si encuentra un error en el programa de alguien más, ¡por favor, avísenles! Si encuentra un error en su propio programa, asegúrese de corregirlo de inmediato.

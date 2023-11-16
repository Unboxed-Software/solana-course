---
title: PDA Sharing
objectives:
- Explicar los riesgos de seguridad asociados con el uso compartido de PDA
- Derivar PDA que tienen dominios de autoridad discretos
- Usar Anchor 's `seeds` y `bump` restricciones para validar cuentas PDA
---

# TL;DR

- El uso de la misma PDA para múltiples dominios de autoridad abre su programa a la posibilidad de que los usuarios accedan a datos y fondos que no les pertenecen.
- Evite que la misma PDA se use para varias cuentas mediante el uso de semillas que sean específicas del usuario y/o del dominio
- Usar Anchor 's `seeds` y `bump` restricciones para validar que un PDA se deriva usando las semillas y bump esperados

# Descripción general

El uso compartido de PDA se refiere al uso del mismo PDA como firmante en múltiples usuarios o dominios. Especialmente cuando se usan PDA para firmar, puede parecer apropiado usar un PDA global para representar el programa. Sin embargo, esto abre la posibilidad de que pase la validación de la cuenta, pero un usuario pueda acceder a fondos, transferencias o datos que no le pertenecen.

## PDA global inseguro

En el siguiente ejemplo, la `authority` de la `vault` cuenta es una PDA derivada utilizando la `mint` dirección almacenada en la `pool` cuenta. Este PDA se pasa a la instrucción como la `authority` cuenta para firmar los tokens de transferencia de la `vault` a la `withdraw_destination`.

Usar la `mint` dirección como semilla para derivar el PDA para firmar para el `vault` es inseguro porque se podrían crear varias `pool` cuentas para la misma cuenta de `vault` token, pero una diferente `withdraw_destination`. Al utilizar el `mint` como una semilla derivar el PDA para firmar para transferencias de tokens, cualquier `pool` cuenta podría firmar para la transferencia de tokens de una cuenta de `vault` tokens a una arbitraria `withdraw_destination`.


```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_insecure {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[ctx.accounts.pool.mint.as_ref(), &[ctx.accounts.pool.bump]];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(has_one = vault, has_one = withdraw_destination)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

## PDA seguro específico de la cuenta

Un enfoque para crear un PDA específico de la cuenta es usar el `withdraw_destination` como una semilla para derivar el PDA usado como la autoridad de la cuenta de `vault` token. Esto garantiza que la firma de PDA para el CPI en la `withdraw_tokens` instrucción se derive utilizando la cuenta de `withdraw_destination` token prevista. En otras palabras, los tokens de una cuenta de `vault` token solo se pueden retirar a la `withdraw_destination` que se inició originalmente con la `pool` cuenta.


```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_secure {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[
            ctx.accounts.pool.withdraw_destination.as_ref(),
            &[ctx.accounts.pool.bump],
        ];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(has_one = vault, has_one = withdraw_destination)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

## Anclajes `seeds` y `bump` limitaciones

Los PDA se pueden usar tanto como la dirección de una cuenta como para permitir que los programas firmen los PDA que poseen.

El siguiente ejemplo utiliza un PDA derivado utilizando la `withdraw_destination` como la dirección de la `pool` cuenta y el propietario de la cuenta de `vault` token. Esto significa que sólo la `pool` cuenta asociada con correcto `vault` y se `withdraw_destination` puede utilizar en la `withdraw_tokens` instrucción.

Puede usar Anchor `seeds` y las `bump` restricciones con el `#[account(...)]` atributo para validar el PDA de la `pool` cuenta. Anchor deriva un PDA usando el `seeds` y `bump` especificó y compara contra la cuenta pasada en la instrucción como la `pool` cuenta. La `has_one` restricción se utiliza para garantizar además que solo las cuentas correctas almacenadas en la `pool` cuenta se pasen a la instrucción.


```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_recommended {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[
            ctx.accounts.pool.withdraw_destination.as_ref(),
            &[ctx.accounts.pool.bump],
        ];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(
				has_one = vault,
				has_one = withdraw_destination,
				seeds = [withdraw_destination.key().as_ref()],
				bump = pool.bump,
		)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

# Demostración

Practiquemos creando un programa simple para demostrar cómo un intercambio de PDA puede permitir que un atacante retire tokens que no les pertenecen. Esta demostración amplía los ejemplos anteriores al incluir las instrucciones para inicializar las cuentas de programa requeridas.

### 1. Arranque

Para comenzar, descargue el código de inicio en la `starter` rama de[este repositorio](https://github.com/Unboxed-Software/solana-pda-sharing/tree/starter). El código de arranque incluye un programa con dos instrucciones y la configuración de la platina para el archivo de prueba.

La `initialize_pool` instrucción inicializa un nuevo `TokenPool` que almacena un `vault` `mint`, `withdraw_destination`, y `bump`. El `vault` es una cuenta de token donde la autoridad se establece como un PDA derivado usando la `mint` dirección.

La `withdraw_insecure` instrucción transferirá tokens en la cuenta de `vault` tokens a una cuenta `withdraw_destination` de tokens.

Sin embargo, como está escrito, las semillas utilizadas para la firma no son específicas para el destino de retiro de la bóveda, abriendo así el programa a exploits de seguridad. Tómese un minuto para familiarizarse con el código antes de continuar.

### 2.  `withdraw_insecure` Instrucciones de prueba

El archivo de prueba incluye el código para invocar la `initialize_pool` instrucción y luego 100 fichas Mint a la cuenta de `vault` fichas. También incluye una prueba para invocar el `withdraw_insecure` uso del pretendido `withdraw_destination`. Esto demuestra que las instrucciones se pueden utilizar según lo previsto.

Después de eso, hay dos pruebas más para mostrar cómo las instrucciones son vulnerables a explotar.

La primera prueba invoca la `initialize_pool` instrucción de crear una `pool` cuenta "falsa" utilizando la misma cuenta de `vault` token, pero una diferente `withdraw_destination`.

La segunda prueba se retira de este grupo, robando efectivamente fondos de la bóveda.


```tsx
it("Insecure initialize allows pool to be initialized with wrong vault", async () => {
    await program.methods
      .initializePool(authInsecureBump)
      .accounts({
        pool: poolInsecureFake.publicKey,
        mint: mint,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestinationFake,
        payer: walletFake.publicKey,
      })
      .signers([walletFake, poolInsecureFake])
      .rpc()

    await new Promise((x) => setTimeout(x, 1000))

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultInsecure.address,
      wallet.payer,
      100
    )

    const account = await spl.getAccount(connection, vaultInsecure.address)
    expect(Number(account.amount)).to.equal(100)
})

it("Insecure withdraw allows stealing from vault", async () => {
    await program.methods
      .withdrawInsecure()
      .accounts({
        pool: poolInsecureFake.publicKey,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestinationFake,
        authority: authInsecure,
        signer: walletFake.publicKey,
      })
      .signers([walletFake])
      .rpc()

    const account = await spl.getAccount(connection, vaultInsecure.address)
    expect(Number(account.amount)).to.equal(0)
})
```

Ejecute `anchor test` para ver que las transacciones se completan con éxito y la `withdraw_instrucure` instrucción permite que la cuenta de `vault` token se drene a un destino de retiro falso almacenado en la `pool` cuenta falsa.

### 3. Añadir `initialize_pool_secure` instrucción

Ahora vamos a añadir una nueva instrucción al programa para inicializar de forma segura un pool.

Esta nueva `initialize_pool_secure` instrucción inicializará una `pool` cuenta como un PDA derivado usando el `withdraw_destination`. También inicializará una cuenta de `vault` token con la autoridad establecida como `pool` PDA.


```rust
pub fn initialize_pool_secure(ctx: Context<InitializePoolSecure>) -> Result<()> {
    ctx.accounts.pool.vault = ctx.accounts.vault.key();
    ctx.accounts.pool.mint = ctx.accounts.mint.key();
    ctx.accounts.pool.withdraw_destination = ctx.accounts.withdraw_destination.key();
    ctx.accounts.pool.bump = *ctx.bumps.get("pool").unwrap();
    Ok(())
}

...

#[derive(Accounts)]
pub struct InitializePoolSecure<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 32 + 1,
        seeds = [withdraw_destination.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, TokenPool>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = pool,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
```

### 4. Añadir `withdraw_secure` instrucción

A continuación, añade una `withdraw_secure` instrucción. Esta instrucción retirará tokens de la cuenta de `vault` tokens a la `withdraw_destination`. La `pool` cuenta se valida utilizando las `bump` restricciones `seeds` and para garantizar que se proporcione la cuenta PDA correcta. Las `has_one` restricciones comprueban que se proporcionan las cuentas correctas `vault` y de `withdraw_destination` token.


```rust
pub fn withdraw_secure(ctx: Context<WithdrawTokensSecure>) -> Result<()> {
    let amount = ctx.accounts.vault.amount;
    let seeds = &[
    ctx.accounts.pool.withdraw_destination.as_ref(),
      &[ctx.accounts.pool.bump],
    ];
    token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
}

...

#[derive(Accounts)]
pub struct WithdrawTokensSecure<'info> {
    #[account(
        has_one = vault,
        has_one = withdraw_destination,
        seeds = [withdraw_destination.key().as_ref()],
        bump = pool.bump,
    )]
    pool: Account<'info, TokenPool>,
    #[account(mut)]
    vault: Account<'info, TokenAccount>,
    #[account(mut)]
    withdraw_destination: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokensSecure<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}
```

### 5.  `withdraw_secure` Instrucciones de prueba

Finalmente, regrese al archivo de prueba para probar la `withdraw_secure` instrucción y mostrar que al reducir el alcance de nuestra autoridad de firma de PDA, hemos eliminado la vulnerabilidad.

Antes de escribir una prueba que muestre que la vulnerabilidad ha sido parcheada, escribamos una prueba que simplemente muestre que las instrucciones de inicialización y retirada funcionan como se esperaba:


```typescript
it("Secure pool initialization and withdraw works", async () => {
    const withdrawDestinationAccount = await getAccount(
      provider.connection,
      withdrawDestination
    )

    await program.methods
      .initializePoolSecure()
      .accounts({
        pool: authSecure,
        mint: mint,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .signers([vaultRecommended])
      .rpc()

    await new Promise((x) => setTimeout(x, 1000))

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultRecommended.publicKey,
      wallet.payer,
      100
    )

    await program.methods
      .withdrawSecure()
      .accounts({
        pool: authSecure,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .rpc()

    const afterAccount = await getAccount(
      provider.connection,
      withdrawDestination
    )

    expect(
      Number(afterAccount.amount) - Number(withdrawDestinationAccount.amount)
    ).to.equal(100)
})
```

Ahora, probaremos que el exploit ya no funciona. Dado que la `vault` autoridad es la `pool` PDA derivada utilizando la cuenta de `withdraw_destination` token prevista, ya no debería haber una forma de retirar fondos a una cuenta distinta de la prevista `withdraw_destination`.

Agregue una prueba que demuestre que no puede llamar `withdraw_secure` con el destino de retiro incorrecto. Puede usar la piscina y la bóveda creadas en la prueba anterior.


```typescript
  it("Secure withdraw doesn't allow withdraw to wrong destination", async () => {
    try {
      await program.methods
        .withdrawSecure()
        .accounts({
          pool: authSecure,
          vault: vaultRecommended.publicKey,
          withdrawDestination: withdrawDestinationFake,
        })
        .signers([walletFake])
        .rpc()

      assert.fail("expected error")
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
  })
```

Por último, dado que la `pool` cuenta es un PDA derivado utilizando la cuenta de `withdraw_destination` token, no podemos crear una `pool` cuenta falsa utilizando el mismo PDA. Agregue una prueba más que muestre que la nueva `initialize_pool_secure` instrucción no permitirá que un atacante coloque la bóveda incorrecta.


```typescript
it("Secure pool initialization doesn't allow wrong vault", async () => {
    try {
      await program.methods
        .initializePoolSecure()
        .accounts({
          pool: authSecure,
          mint: mint,
          vault: vaultInsecure.address,
          withdrawDestination: withdrawDestination,
        })
        .signers([vaultRecommended])
        .rpc()

      assert.fail("expected error")
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
})
```

Ejecute `anchor test` y vea que las nuevas instrucciones no permiten que un atacante se retire de una bóveda que no es suya.


```
  pda-sharing
    ✔ Initialize Pool Insecure (981ms)
    ✔ Withdraw (470ms)
    ✔ Insecure initialize allows pool to be initialized with wrong vault (10983ms)
    ✔ Insecure withdraw allows stealing from vault (492ms)
    ✔ Secure pool initialization and withdraw works (2502ms)
unknown signer: ARjxAsEPj6YsAPKaBfd1AzUHbNPtAeUsqusAmBchQTfV
    ✔ Secure withdraw doesn't allow withdraw to wrong destination
unknown signer: GJcHJLot3whbY1aC9PtCsBYk5jWoZnZRJPy5uUwzktAY
    ✔ Secure pool initialization doesn't allow wrong vault
```

¡Y eso es todo! A diferencia de algunas de las otras vulnerabilidades de seguridad que hemos discutido, esta es más conceptual y no se puede solucionar simplemente usando un tipo de anclaje en particular. Tendrá que pensar en la arquitectura de su programa y asegurarse de que no está compartiendo PDA en diferentes dominios.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[el mismo repositorio](https://github.com/Unboxed-Software/solana-pda-sharing/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando este exploit de seguridad radica en auditar sus propios programas u otros.

Tómese un tiempo para revisar al menos un programa y buscar posibles vulnerabilidades en su estructura de PDA. Las PDA utilizadas para la firma deben ser estrechas y centrarse en un solo dominio tanto como sea posible.

Recuerde, si encuentra un error o un exploit en el programa de otra persona, ¡avíselos! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.
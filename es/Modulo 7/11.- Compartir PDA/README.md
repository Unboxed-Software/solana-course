# Compartir PDA

## Objetivos de la lección

Al final de esta lección podrás:

- Explicar los riesgos de seguridad asociados con el uso compartido de PDA
- Derivar PDA que tienen dominios de autoridad discretos
- Use las **seeds** y **bump** restricciones de Anchor para validar cuentas de PDA

# Terminología

- El uso de la misma PDA para múltiples dominios de autoridad abre su programa a la posibilidad de que los usuarios accedan a datos y fondos que no les pertenecen.
- Evite que se utilice la misma PDA para varias cuentas mediante el uso de semillas que son específicas del usuario y/o del dominio
- Utilice las restricciones de semilla y de relieve de Anchor para validar que un PDA se deriva utilizando las **seeds** y el **bump** esperados.

# Resumen

Compartir el PDA se refiere a utilizar el mismo PDA como una firma para varios usuarios o dominios. Especialmente al utilizar PDAs para firmar, puede parecer apropiado utilizar un PDA global para representar el programa. Sin embargo, esto abre la posibilidad de que la validación de la cuenta sea correcta, pero un usuario pueda acceder a fondos, transferencias o datos que no le pertenecen.

## PDA global inseguro

En el ejemplo que se muestra abajo, la **authority** de la cuenta de la **vault** es un PDA derivado utilizando la dirección **mint** almacenada en la cuenta del **pool** . Este PDA se pasa en la instrucción como la cuenta de **authority** para firmar la transferencia de tokens de la **vault** al **withdraw_destination** .

Utilizar la dirección **mint** como semilla para derivar el PDA para firmar la **vault** es inseguro porque se podrían crear varias cuentas de **pool** para la misma cuenta de tokens de **vault** , pero con un **withdraw_destination** es diferente. Al utilizar el **mint** como semilla para derivar el PDA para firmar las transferencias de tokens, cualquier cuenta de **pool** podría firmar la transferencia de tokens de una cuenta de tokens de **vault** a un **withdraw_destination** arbitrario.

```Rust
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

## PDA específico de cuenta segura

Una forma de crear un PDA específico de cuenta es utilizar el **withdraw_destination** como semilla para derivar el PDA utilizado como autoridad de la cuenta de tokens de **vault** . Esto asegura que el PDA que firma el CPI en la instrucción **withdraw_tokens** se deriva utilizando la cuenta de tokens **withdraw_destination** prevista. En otras palabras, los tokens de una cuenta de tokens de **vault** solo se pueden retirar al **withdraw_destination** que se inicializó originalmente con la cuenta de **pool**.

```Rust
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

## **Seeds** de anclaje y restricciones **bump**

Las cuentas PDA pueden usarse tanto como la dirección de una cuenta como para permitir que los programas firmen para las PDA que poseen.

El ejemplo que a continuación se presenta, utiliza una PDA derivada utilizando **withdraw_destination** tanto como la dirección de la cuenta del **pool** como del propietario de la cuenta de token del **vault** . Esto significa que solo la cuenta del **pool** asociada con el **vault** y el **withdraw_destination** correctos pueden usarse en la instrucción de **withdraw_tokens** .

Se pueden usar las **seeds** y las restricciones **bump** de Anchor con el atributo **#[account(...)]** para validar la cuenta PDA del **pool** . Anchor deriva una PDA utilizando las **seeds** y el **bump** especificados y los compara con la cuenta pasada a la instrucción como cuenta del **pool** . La restricción **has_one** se utiliza para asegurarse de que solo las cuentas correctas almacenadas en la cuenta del **pool** se pasan a la instrucción.

```Rust
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

Practiquemos creando un programa simple para demostrar cómo una compartición de PDA puede permitir a un atacante retirar tokens que no les pertenecen. Esta es una demostración más amplía de los ejemplos anteriores, incluyendo las instrucciones para inicializar las cuentas de programa requeridas.

## 1.Inicio

Para empezar, descarga el código de inicio en la rama de **starter** de este [repositorio](https://github.com/Unboxed-Software/solana-pda-sharing/tree/starter). El código de inicio incluye un programa con dos instrucciones y la configuración de plantilla para el archivo de prueba.

La instrucción **initialize_pool** inicializa una nueva **TokenPool** que almacena una **vault** , un **mint** , un **withdraw_destination** y un **bump** .
La **vault** es una cuenta de token donde la autoridad está establecida como una PDA derivada utilizando la dirección de **mint** .

La instrucción **withdraw_insecure** transferirá tokens de la cuenta de token de la **vault** a una cuenta de token de **withdraw_destination** .

Sin embargo, tal y como está escrito, las semillas utilizadas para la firma no son específicas del destino de retirada de la vault, lo que abre el programa a explotaciones de seguridad. Tómate un minuto para familiarizarte con el código antes de continuar.

## 2. Prueba de la instrucción **withdraw_insecure**

El archivo de prueba incluye el código para invocar la instrucción **initialize_pool** y luego crear 100 tokens en la cuenta de token del **vault** . También incluye una prueba para invocar la **withdraw_insecure** usando el **withdraw_destination** previsto. Esto demuestra que las instrucciones se pueden usar como se pretende.

Después de eso, hay dos pruebas más para demostrar cómo las instrucciones son vulnerables a la explotación.

La primera prueba invoca la instrucción **initialize_pool** para crear una cuenta de **pool** "falsa" utilizando la misma cuenta de token **vault** , pero un **withdraw_destination** diferente.

La segunda prueba se retira del pool, robando fondos del vault.

```Rust
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

Ejecute la **anchor test** para ver que las transacciones se completen con éxito y que la instrucción **withdraw_instrucure** permita que la cuenta del token de **vault** se vacíe a un destino de retiro falso almacenado en la cuenta **pool** falsa.

## 3. Agregue la instrucción **initialize_pool_secure**

Ahora, agreguemos una nueva instrucción al programa para inicializar un pool de forma segura.

Esta nueva instrucción **initialize_pool_secure** inicializará una cuenta de **pool** como un PDA derivado mediante el **withdraw_destination** . También inicializará una cuenta de token de **vault** con la autoridad establecida como PDA del **pool** .

```Rust
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

## 4. Agregar instrucción de **withdraw_secure**

A continuación, agregue una instrucción de **withdraw_secure** . Esta instrucción retirará los tokens de la cuenta de tokens del **vault** al **withdraw_destination** . La cuenta de **pool** se valida mediante las **seeds** y las restricciones de **bump** para garantizar que se proporciona la cuenta de PDA correcta. Las restricciones **has_one** verifican que se proporcionen las cuentas de token de **vault** y de **withdraw_destination** correctas.

```Rust
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

## 5. Instrucciones para prueba **withdraw_secure**

Finalmente, regresamos al archivo de prueba para probar la instrucción **withdraw_secure** y demostrar que al reducir el alcance de nuestra autoridad de firma PDA, hemos eliminado la vulnerabilidad.

Antes de escribir una prueba que demuestre que se ha solucionado la vulnerabilidad, escribamos una prueba que simplemente muestre que las instrucciones de inicialización y retirada funcionan como se espera:

```Rust
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

Ahora, probaremos que la explotación ya no funciona. Dado que la autoridad del **vault** es la PDA del **pool** derivado utilizando la cuenta de token de **withdraw_destination** prevista, ya no debería haber una forma de retirar a una cuenta distinta al **withdraw_destination** previsto.

Añade un test que muestre que no se puede llamar a **withdraw_secure** con el destino de retirada equivocado. Puede usar el pool y el vault creados en la prueba anterior.

```Rust
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

Por último, dado que la cuenta de **pool** es una PDA derivada utilizando la cuenta de token de **withdraw_destination** , no podemos crear una cuenta de **pool** falsa utilizando la misma PDA. Añade una prueba más que muestre que la nueva instrucción **initialize_pool_secure** no permitirá a un atacante poner la bóveda equivocada.

```Rust
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

Ejecuta una **anchor test** para verificar que las nuevas instrucciones no permiten a un atacante retirar de un vault que no es el suyo.

```Rust
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

¡Y eso es todo! A diferencia de algunas de las otras vulnerabilidades de seguridad que hemos discutido, esta es más conceptual y no se puede solucionar simplemente utilizando un tipo de Anclaje en particular. Tendrá que pensar en la arquitectura de su programa y asegurarse de no compartir PDAs en diferentes dominios.

Si desea ver el código de la solución final, puede encontrarlo en la rama de **solution** del mismo [repositorio](https://github.com/Unboxed-Software/solana-pda-sharing/tree/solution).

# Reto

Al igual que con otras lecciones en este módulo, tu oportunidad de practicar evitando esta explotación de seguridad radica en la revisión de tus propios programas o de otros programas.

Tómate un tiempo para revisar al menos un programa y buscar vulnerabilidades potenciales en su estructura de PDA. Las PDAs utilizadas para firmar deben ser estrechas y enfocadas en un solo dominio tanto como sea posible.

Recuerda, si encuentras un error o explotación en el programa de alguien más, ¡avisales! Si encuentras uno en tu propio programa, asegúrate de corregirlo de inmediato.

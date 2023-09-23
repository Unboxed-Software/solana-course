---
title: Objetivos de las cuentas de cierre y los ataques de reactivación
objectives:
- Explicar las diversas vulnerabilidades de seguridad asociadas con el cierre incorrecto de las cuentas del programa
- Cierre las cuentas del programa de forma segura con Rust nativo
- Cierre las cuentas del programa de forma segura utilizando la `close` restricción Anchor
---

# TL;DR

-   crea **Cerrar una cuenta** incorrectamente una oportunidad para ataques de reinicialización/reactivación
-   El tiempo de ejecución de Solana **garbage recauda cuentas** cuando ya no están exentos de alquiler. El cierre de cuentas implica transferir los lamports almacenados en la cuenta para la exención de alquiler a otra cuenta de su elección.
-   Puede usar la `#[account(close = <address_to_send_lamports>)]` restricción Ancla para cerrar cuentas de forma segura y establecer el discriminador de cuenta en `CLOSED_ACCOUNT_DISCRIMINATOR`

    ```rust
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
    ```

# Descripción general

Si bien suena simple, cerrar cuentas correctamente puede ser complicado. Hay varias formas en que un atacante podría eludir el cierre de la cuenta si no sigue pasos específicos.

Para obtener una mejor comprensión de estos vectores de ataque, exploremos cada uno de estos escenarios en profundidad.

## Cierre de cuenta inseguro

En esencia, cerrar una cuenta implica transferir sus lamports a una cuenta separada, lo que activa el tiempo de ejecución de Solana para recolectar la primera cuenta. Esto restablece al propietario del programa propietario al programa del sistema.

Echa un vistazo al siguiente ejemplo. La instrucción requiere dos cuentas:

1.  `account_to_close` - la cuenta que se va a cerrar
2.  `destination` - la cuenta que debe recibir los lamports de la cuenta cerrada

La lógica del programa está destinada a cerrar una cuenta simplemente aumentando los `destination` lamports de la cuenta en la cantidad almacenada en el `account_to_close` y estableciendo los `account_to_close` lamports en 0. Con este programa, después de que se procese una transacción completa, la basura `account_to_close` será recolectada por el tiempo de ejecución.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(ctx.accounts.account_to_close.to_account_info().lamports())
            .unwrap();
        **ctx.accounts.account_to_close.to_account_info().lamports.borrow_mut() = 0;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account_to_close: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

Sin embargo, la recolección de basura no ocurre hasta que se completa la transacción. Y dado que puede haber múltiples instrucciones en una transacción, esto crea una oportunidad para que un atacante invoque la instrucción de cerrar la cuenta, pero también incluya en la transacción una transferencia para reembolsar las lámparas de exención de alquiler de la cuenta. El resultado es que la cuenta _no_ se recolecta basura, abriendo una ruta para que el atacante cause un comportamiento no deseado en el programa e incluso drene un protocolo.

## Cierre seguro de la cuenta

Las dos cosas más importantes que puede hacer para cerrar esta laguna son eliminar los datos de la cuenta y agregar un discriminador de cuenta que represente que la cuenta se ha cerrado. Necesita estas _ambos_ cosas para evitar el comportamiento involuntario del programa.

Una cuenta con datos puestos a cero todavía se puede utilizar para algunas cosas, especialmente si se trata de un PDA cuya derivación de dirección se utiliza dentro del programa con fines de verificación. Sin embargo, el daño puede ser potencialmente limitado si el atacante no puede acceder a los datos almacenados anteriormente.

Sin embargo, para asegurar aún más el programa, las cuentas cerradas deben recibir un discriminador de cuentas que lo designe como "cerrado", y todas las instrucciones deben realizar verificaciones en todas las cuentas pasadas que devuelven un error si la cuenta está marcada como cerrada.

Mira el siguiente ejemplo. Este programa transfiere las lámparas fuera de una cuenta, pone a cero los datos de la cuenta y establece un discriminador de cuenta en una sola instrucción con la esperanza de evitar que una instrucción posterior utilice esta cuenta de nuevo antes de que se haya recogido la basura. No hacer ninguna de estas cosas resultaría en una vulnerabilidad de seguridad.

```rust
use anchor_lang::prelude::*;
use std::io::Write;
use std::ops::DerefMut;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure_still_still {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let account = ctx.accounts.account.to_account_info();

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        let mut data = account.try_borrow_mut_data()?;
        for byte in data.deref_mut().iter_mut() {
            *byte = 0;
        }

        let dst: &mut [u8] = &mut data;
        let mut cursor = std::io::Cursor::new(dst);
        cursor
            .write_all(&anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR)
            .unwrap();

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

Tenga en cuenta que el ejemplo anterior está usando Anchor `CLOSED_ACCOUNT_DISCRIMINATOR`. Esto es simplemente un discriminador de cuenta donde está cada byte `255`. El discriminador no tiene ningún significado inherente, pero si lo combina con verificaciones de validación de cuenta que devuelven errores cada vez que se pasa una cuenta con este discriminador a una instrucción, evitará que su programa procese involuntariamente una instrucción con una cuenta cerrada.

### Manual Force Defund

Todavía hay un pequeño problema. Si bien la práctica de poner a cero los datos de la cuenta y agregar un discriminador de cuenta "cerrado" evitará que su programa sea explotado, un usuario aún puede evitar que una cuenta sea recolectada mediante el reembolso de los lamports de la cuenta antes del final de una instrucción. Esto da como resultado que una o potencialmente muchas cuentas existan en un estado de limbo donde no se pueden usar, pero tampoco se pueden recolectar basura.

Para manejar este caso de borde, puede considerar agregar una instrucción que permita retirar fondos _cualquiera_ de las cuentas etiquetadas con el discriminador de cuenta "cerrada". La única validación de cuenta que esta instrucción realizaría es garantizar que la cuenta que se está eliminando se marque como cerrada. Puede verse algo como esto:

```rust
use anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR;
use anchor_lang::prelude::*;
use std::io::{Cursor, Write};
use std::ops::DerefMut;

...

    pub fn force_defund(ctx: Context<ForceDefund>) -> ProgramResult {
        let account = &ctx.accounts.account;

        let data = account.try_borrow_data()?;
        assert!(data.len() > 8);

        let mut discriminator = [0u8; 8];
        discriminator.copy_from_slice(&data[0..8]);
        if discriminator != CLOSED_ACCOUNT_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        Ok(())
    }

...

#[derive(Accounts)]
pub struct ForceDefund<'info> {
    account: AccountInfo<'info>,
    destination: AccountInfo<'info>,
}
```

Dado que cualquiera puede llamar a esta instrucción, esto puede actuar como un elemento disuasorio para los intentos de ataques de avivamiento, ya que el atacante está pagando la exención de alquiler de la cuenta, pero cualquier otra persona puede reclamar los lamports en una cuenta reembolsada por sí mismos.

Si bien no es necesario, esto puede ayudar a eliminar el desperdicio de espacio y lámparas asociadas con estas cuentas "limbo".

## Utilice la `close` restricción Anchor

Afortunadamente, Anchor hace todo esto mucho más simple con la `#[account(close = <target_account>)]` restricción. Esta restricción maneja todo lo necesario para cerrar una cuenta de forma segura:

1. Transfiere los lamports de la cuenta a la cuenta `<target_account>`
2. Pone a cero los datos de la cuenta
3. Establece el discriminador de cuenta en la `CLOSED_ACCOUNT_DISCRIMINATOR` variante

Todo lo que tiene que hacer es añadirlo en la estructura de validación de la cuenta a la cuenta que desea cerrar:

```rust
#[derive(Accounts)]
pub struct CloseAccount {
    #[account(
        mut,
        close = receiver
    )]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
}
```

La `force_defund` instrucción es una adición opcional que tendrá que implementar por su cuenta si desea utilizarla.

# Demostración

Para aclarar cómo un atacante podría aprovechar un ataque de avivamiento, vamos a trabajar con un programa de lotería simple que utiliza el estado de la cuenta del programa para administrar la participación de un usuario en la lotería.

## 1. Configuración

Comience por obtener el código en la `starter` sucursal de la[siguiente repo](https://github.com/Unboxed-Software/solana-closing-accounts/tree/starter).

El código tiene dos instrucciones en el programa y dos pruebas en el `tests` directorio.

Las instrucciones del programa son:

1.  `enter_lottery`
2.  `redeem_rewards_insecure`

Cuando un usuario llama `enter_lottery`, el programa inicializará una cuenta para almacenar algún estado sobre la entrada de lotería del usuario.

Dado que este es un ejemplo simplificado en lugar de un programa de lotería de pleno desarrollo, una vez que un usuario ha ingresado a la lotería, puede llamar a la `redeem_rewards_insecure` instrucción en cualquier momento. Esta instrucción le dará al usuario una cantidad de tokens de recompensa proporcional a la cantidad de veces que el usuario ha ingresado a la lotería. Después de acuñar las recompensas, el programa cierra la entrada de lotería del usuario.

Tómese un minuto para familiarizarse con el código del programa. La `enter_lottery` instrucción simplemente crea una cuenta en una PDA asignada al usuario e inicializa algún estado en ella.

La `redeem_rewards_insecure` instrucción realiza alguna validación de cuenta y datos, coloca tokens en la cuenta de token dada, luego cierra la cuenta de lotería eliminando sus lamports.

Sin embargo, observe que la `redeem_rewards_insecure` instrucción _solo_ transfiere los lamports de la cuenta, dejando la cuenta abierta a ataques de reactivación.

## 2. Programa de prueba insegura

Un atacante que evita que su cuenta se cierre con éxito puede llamar `redeem_rewards_insecure` varias veces, reclamando más recompensas de las que se le deben.

Ya se han escrito algunas pruebas de arranque que muestran esta vulnerabilidad. Echa un vistazo al `closing-accounts.ts` archivo en el `tests` directorio. Hay alguna configuración en la `before` función, luego una prueba que simplemente crea una nueva entrada de lotería para `attacker`.

Finalmente, hay una prueba que demuestra cómo un atacante puede mantener viva la cuenta incluso después de reclamar recompensas y luego reclamar recompensas nuevamente. Esa prueba se ve así:

```typescript
it("attacker  can close + refund lottery acct + claim multiple rewards", async () => {
    // claim multiple times
    for (let i = 0; i < 2; i++) {
        const tx = new Transaction();
        // instruction claims rewards, program will try to close account
        tx.add(
            await program.methods
                .redeemWinningsInsecure()
                .accounts({
                    lotteryEntry: attackerLotteryEntry,
                    user: attacker.publicKey,
                    userAta: attackerAta,
                    rewardMint: rewardMint,
                    mintAuth: mintAuth,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction(),
        );

        // user adds instruction to refund dataAccount lamports
        const rentExemptLamports =
            await provider.connection.getMinimumBalanceForRentExemption(
                82,
                "confirmed",
            );
        tx.add(
            SystemProgram.transfer({
                fromPubkey: attacker.publicKey,
                toPubkey: attackerLotteryEntry,
                lamports: rentExemptLamports,
            }),
        );
        // send tx
        await sendAndConfirmTransaction(provider.connection, tx, [attacker]);
        await new Promise((x) => setTimeout(x, 5000));
    }

    const ata = await getAccount(provider.connection, attackerAta);
    const lotteryEntry = await program.account.lotteryAccount.fetch(
        attackerLotteryEntry,
    );

    expect(Number(ata.amount)).to.equal(
        lotteryEntry.timestamp.toNumber() * 10 * 2,
    );
});
```

Esta prueba hace lo siguiente:

1. Llamadas `redeem_rewards_insecure` para canjear las recompensas del usuario
2. En la misma transacción, agrega una instrucción para reembolsar al usuario `lottery_entry` antes de que pueda cerrarse.
3. Repite con éxito los pasos 1 y 2, canjeando recompensas por segunda vez.

En teoría, puede repetir los pasos 1-2 infinitamente hasta que a) el programa no tenga más recompensas que dar o b) alguien note y parchee el exploit. Esto obviamente sería un problema grave en cualquier programa real, ya que permite a un atacante malicioso drenar todo un grupo de recompensas.

## 3. Crear una `redeem_rewards_secure` instrucción

Para evitar que esto suceda, vamos a crear una nueva instrucción que cierre la cuenta de lotería utilizando la `close` restricción Anchor. Siéntase libre de probar esto por su cuenta si lo desea.

La nueva estructura de validación de cuenta llamada `RedeemWinningsSecure` debería verse así:

```rust
#[derive(Accounts)]
pub struct RedeemWinningsSecure<'info> {
    // program expects this account to be initialized
    #[account(
        mut,
        seeds = [user.key().as_ref()],
        bump = lottery_entry.bump,
        has_one = user,
        close = user
    )]
    pub lottery_entry: Account<'info, LotteryAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_ata.key() == lottery_entry.user_ata
    )]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = reward_mint.key() == user_ata.mint
    )]
    pub reward_mint: Account<'info, Mint>,
    ///CHECK: mint authority
    #[account(
        seeds = [MINT_SEED.as_bytes()],
        bump
    )]
    pub mint_auth: AccountInfo<'info>,
    pub token_program: Program<'info, Token>
}
```

Debe ser exactamente igual que la estructura de validación de `RedeemWinnings` cuenta original, excepto que hay una `close = user` restricción adicional en la `lottery_entry` cuenta. Esto le dirá a Anchor que cierre la cuenta poniendo a cero los datos, transfiriendo sus lamports a la `user` cuenta y configurando el discriminador de cuenta en el `CLOSED_ACCOUNT_DISCRIMINATOR`. Este último paso es lo que evitará que la cuenta se vuelva a utilizar si el programa ya ha intentado cerrarla.

Luego, podemos crear un `mint_ctx` método en la nueva `RedeemWinningsSecure` estructura para ayudar con el IPC de acuñación al programa token.

```Rust
impl<'info> RedeemWinningsSecure <'info> {
    pub fn mint_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: self.reward_mint.to_account_info(),
            to: self.user_ata.to_account_info(),
            authority: self.mint_auth.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
```

Finalmente, la lógica para la nueva instrucción segura debería verse así:

```rust
pub fn redeem_winnings_secure(ctx: Context<RedeemWinningsSecure>) -> Result<()> {

    msg!("Calculating winnings");
    let amount = ctx.accounts.lottery_entry.timestamp as u64 * 10;

    msg!("Minting {} tokens in rewards", amount);
    // program signer seeds
    let auth_bump = *ctx.bumps.get("mint_auth").unwrap();
    let auth_seeds = &[MINT_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // redeem rewards by minting to user
    mint_to(ctx.accounts.mint_ctx().with_signer(signer), amount)?;

    Ok(())
}
```

Esta lógica simplemente calcula las recompensas para el usuario reclamante y transfiere las recompensas. Sin embargo, debido a la `close` restricción en la estructura de validación de cuenta, el atacante no debería poder llamar a esta instrucción varias veces.

## 4. Pruebe el programa

Para probar nuestra nueva instrucción segura, vamos a crear una nueva prueba que intenta llamar `redeemingWinningsSecure` dos veces. Esperamos que la segunda llamada arroje un error.

```typescript
it("attacker cannot claim multiple rewards with secure claim", async () => {
    const tx = new Transaction();
    // instruction claims rewards, program will try to close account
    tx.add(
        await program.methods
            .redeemWinningsSecure()
            .accounts({
                lotteryEntry: attackerLotteryEntry,
                user: attacker.publicKey,
                userAta: attackerAta,
                rewardMint: rewardMint,
                mintAuth: mintAuth,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .instruction(),
    );

    // user adds instruction to refund dataAccount lamports
    const rentExemptLamports =
        await provider.connection.getMinimumBalanceForRentExemption(
            82,
            "confirmed",
        );
    tx.add(
        SystemProgram.transfer({
            fromPubkey: attacker.publicKey,
            toPubkey: attackerLotteryEntry,
            lamports: rentExemptLamports,
        }),
    );
    // send tx
    await sendAndConfirmTransaction(provider.connection, tx, [attacker]);

    try {
        await program.methods
            .redeemWinningsSecure()
            .accounts({
                lotteryEntry: attackerLotteryEntry,
                user: attacker.publicKey,
                userAta: attackerAta,
                rewardMint: rewardMint,
                mintAuth: mintAuth,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([attacker])
            .rpc();
    } catch (error) {
        console.log(error.message);
        expect(error);
    }
});
```

Ejecutar `anchor test` para ver que la prueba pasa. La salida se verá algo como esto:

```bash
  closing-accounts
    ✔ Enter lottery (451ms)
    ✔ attacker can close + refund lottery acct + claim multiple rewards (18760ms)
AnchorError caused by account: lottery_entry. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.
    ✔ attacker cannot claim multiple rewards with secure claim (414ms)
```

Tenga en cuenta que esto no impide que el usuario malintencionado reembolse su cuenta por completo, solo protege nuestro programa de reutilizar accidentalmente la cuenta cuando debería cerrarse. No hemos implementado una `force_defund` instrucción hasta ahora, pero podríamos. Si te apetece, ¡pruébalo tú mismo!

La forma más simple y segura de cerrar cuentas es usar la `close` restricción de Anchor. Si alguna vez necesita un comportamiento más personalizado y no puede usar esta restricción, asegúrese de replicar su funcionalidad para asegurarse de que su programa sea seguro.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[el mismo repositorio](https://github.com/Unboxed-Software/solana-closing-accounts/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando este exploit de seguridad radica en auditar sus propios programas u otros.

Tómese un tiempo para revisar al menos un programa y asegúrese de que cuando se cierren las cuentas no sean susceptibles a ataques de reactivación.

Recuerde, si encuentra un error o un exploit en el programa de otra persona, ¡avíselos! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.

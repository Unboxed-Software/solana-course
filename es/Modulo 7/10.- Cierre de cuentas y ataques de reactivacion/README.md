# Cierre de cuentas y ataques de reactivación

## Objetivos de la lección

_Al terminar esta lección podrás:_

- Explicar las diversas vulnerabilidades de seguridad asociadas con el cierre incorrecto de cuentas de programas.
- Cierre las cuentas del programa de forma segura usando Rust nativo
- Cierre las cuentas del programa de forma segura utilizando la restricción de **close** de Anchor

# Terminología

- **Cerrar una cuenta** incorrectamente crea una oportunidad para ataques de reinicialización/reactivación
- El tiempo de ejecución de **garbage collects accounts** de Solanacuando ya no están exentas de alquiler. El cierre de cuentas implica la transferencia de los lamports almacenados en la cuenta de exención de renta a otra cuenta de su elección.
- Puede usar la restricción Anchor **#[account(close = <address_to_send_lamports>)]** para cerrar cuentas de forma segura y establecer el discriminador de cuenta en **CLOSED_ACCOUNT_DISCRIMINATOR**

```Rust
#[account(mut, close = receiver)]
pub data_account: Account<'info, MyData>,
#[account(mut)]
pub receiver: SystemAccount<'info>
```

# Resumen

Aunque suena sencillo, cerrar cuentas de manera adecuada puede ser complicado. Hay varias formas en que un atacante podría evitar que se cierre una cuenta si no se siguen pasos específicos.

Para tener una mejor comprensión de estos vectores de ataque, exploremos cada uno de estos escenarios en profundidad.

## Cierre de cuenta inseguro

En su núcleo, cerrar una cuenta implica transferir sus lamports a una cuenta separada, lo que activa la recolección de basura del tiempo de ejecución de Solana en la primera cuenta. Esto reinicia el propietario desde el programa propietario al programa del sistema.

Echa un vistazo al ejemplo de a continuación. La instrucción requiere dos cuentas:

1. **account_to_close** - la cuenta que se va a cerrar
2. **destination** - la cuenta que debe recibir los lamports de la cuenta cerrada

La lógica del programa tiene como objetivo cerrar una cuenta simplemente aumentando los lamports de la cuenta de **destination** en la cantidad almacenada en la **account_to_close** y estableciendo los lamports de la **account_to_close** en 0. Con este programa, después de procesar una transacción completa, la **account_to_close** será recolectada por el tiempo de ejecución.

```Rust
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

Sin embargo, la recolección de basura no ocurre hasta que se completa la transacción. Y dado que puede haber varias instrucciones en una transacción, esto crea una oportunidad para que un atacante invoque la instrucción para cerrar la cuenta pero también incluya en la transacción una transferencia para devolver los lamports de exención de renta de la cuenta. El resultado es que la cuenta no será recolectada, abriendo un camino para que el atacante cause un comportamiento no deseado en el programa e incluso drene un protocolo.

## Cierre seguro de cuentas

Las dos cosas más importantes que puedes hacer para cerrar esta brecha son poner a cero los datos de la cuenta y agregar un discriminador de cuenta que represente que la cuenta ha sido cerrada. Necesitas ambas cosas para evitar el comportamiento no deseado del programa.

Una cuenta con datos puestos a cero todavía se puede usar para algunas cosas, especialmente si es un PDA cuya derivación de dirección se utiliza dentro del programa para fines de verificación. Sin embargo, el daño puede ser potencialmente limitado si el atacante no puede acceder a los datos previamente almacenados.

Para asegurar aún más el programa, las cuentas cerradas deben recibir un discriminador de cuenta que las designe como "cerradas", y todas las instrucciones deben realizar comprobaciones en todas las cuentas pasadas que devuelvan un error si la cuenta está marcada como cerrada.

Echa un vistazo al ejemplo que a continuación se muestra. Este programa transfiere los lamports fuera de una cuenta, pone a cero los datos de la cuenta y establece un discriminador de cuenta en una sola instrucción con la esperanza de evitar que una instrucción posterior utilice esta cuenta de nuevo antes de que sea recolectada. Si no se hace ninguna de estas acciones, se produciría una vulnerabilidad de seguridad.

```Rust
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

Tenga en cuenta que el ejemplo anterior está utilizando el discriminador **CLOSED_ACCOUNT_DISCRIMINATOR** de Anchor. Este es simplemente un discriminador de cuenta donde cada byte es **255** . El discriminador no tiene ningún significado inherente, pero si lo combina con comprobaciones de validación de cuentas que devuelven errores cada vez que se pasa una cuenta con este discriminador a una instrucción, detendrá su programa de procesar accidentalmente una instrucción con una cuenta cerrada.

## Desfinanciamiento manual forzado

Todavía hay un pequeño problema. Si bien la práctica de poner a cero los datos de la cuenta y agregar un discriminador de cuenta "cerrado" detendrá que su programa sea explotado, un usuario todavía puede evitar que una cuenta sea recolectada devolviendo los lamports de la cuenta antes del final de una instrucción. Esto resulta en una o potencialmente muchas cuentas existiendo en un estado de limbo donde no se pueden usar pero también no se pueden recolectar.

Para manejar este caso límite, es posible que desee agregar una instrucción que permita a cualquiera desfinanciar las cuentas etiquetadas con el discriminador de cuenta "cerrado". La única validación de cuenta que realizaría esta instrucción es asegurarse de que la cuenta que se está desfinanciando esté marcada como cerrada. Puede verse algo así:

```Rust
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

Dado que cualquiera puede llamar a esta instrucción, esto puede actuar como un deterrente para los ataques de revivificación intentados, ya que el atacante está pagando la exención de renta de la cuenta pero cualquier otra persona puede reclamar los lamports en una cuenta devuelta para sí misma.
Aunque no es necesario, esto puede ayudar a eliminar el desperdicio de espacio y lamports asociados con estas cuentas "limbo".

## Uso la restricción de **close** de Anchor

Afortunadamente, Anchor hace todo esto mucho más sencillo con la restricción **#[account(close = <target_account>)]** . Esta restricción maneja todo lo necesario para cerrar una cuenta de manera segura:

1. Transfiere los lamports de la cuenta a la **<target_account>** dada
2. Pone a cero los datos de la cuenta
3. Establece el discriminador de cuenta en la variante **CLOSED_ACCOUNT_DISCRIMINATOR**

Todo lo que tienes que hacer es agregarlo en la estructura de validación de cuenta de la cuenta que deseas cerrar.

```Rust
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

La instrucción **force_defund** es una adición opcional que tendrá que implementar usted mismo si desea utilizarla.

# Demostración

Para aclarar cómo un atacante podría aprovechar un ataque de revivificación, trabajaremos con un programa de lotería simple que utiliza el estado de la cuenta del programa para administrar la participación del usuario en la lotería.

## 1.Configuración

Comience obteniendo el código en la rama de **starter** del [repositorio](https://github.com/Unboxed-Software/solana-closing-accounts/tree/starter).
El código tiene dos instrucciones en el programa y dos **tests** en el directorio de pruebas.

Las instrucciones del programa son:

1. **enter_lottery**
2. **redeem_rewards_insecure**

Cuando un usuario llama a **enter_lottery** , el programa iniciará una cuenta para almacenar algunos datos sobre la entrada de lotería del usuario.

Dado que este es un ejemplo simplificado en lugar de un programa de lotería completo, una vez que un usuario ha entrado en la lotería, puede llamar a la instrucción **redeem_rewards_insecure** en cualquier momento. Esta instrucción acuñara al usuario una cantidad de tokens de recompensa proporcional a la cantidad de veces que el usuario ha entrado en la lotería. Después de acuñar las recompensas, el programa cierra la entrada de lotería del usuario.

Tómate un minuto para familiarizarte con el código del programa. Para la instrucción **enter_lottery** simplemente crea una cuenta en un PDA asociada al usuario e inicializa algunos datos en ella.

La instrucción **redeem_rewards_insecure** realiza algunas validaciones de cuenta y datos, acuña tokens en la cuenta de tokens dada y luego cierra la cuenta de lotería eliminando sus lamports.

Sin embargo, note que la instrucción **redeem_rewards_insecure** sólo transfiere los lamports de la cuenta, dejando la cuenta abierta a ataques de revivificación.

## 2. Prueba del programa inseguro

Un atacante que logra mantener su cuenta abierta puede llamar a **redeem_rewards_insecure** varias veces, reclamando más recompensas de las que le corresponden.

Algunas pruebas iniciales ya han sido escritas que muestran esta vulnerabilidad. Echa un vistazo al archivo **closing-accounts.ts** en el directorio de **tests** . Hay alguna configuración en la función **before** y luego una prueba que simplemente crea una nueva entrada de lotería para el **attacker** .

Finalmente, hay una prueba que demuestra cómo un atacante puede mantener la cuenta viva incluso después de reclamar recompensas y luego reclamar recompensas de nuevo. Esa prueba se ve así:

```Rust
it("attacker  can close + refund lottery acct + claim multiple rewards", async () => {
    // claim multiple times
    for (let i = 0; i < 2; i++) {
      const tx = new Transaction()
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
          .instruction()
      )

      // user adds instruction to refund dataAccount lamports
      const rentExemptLamports =
        await provider.connection.getMinimumBalanceForRentExemption(
          82,
          "confirmed"
        )
      tx.add(
        SystemProgram.transfer({
          fromPubkey: attacker.publicKey,
          toPubkey: attackerLotteryEntry,
          lamports: rentExemptLamports,
        })
      )
      // send tx
      await sendAndConfirmTransaction(provider.connection, tx, [attacker])
      await new Promise((x) => setTimeout(x, 5000))
    }

    const ata = await getAccount(provider.connection, attackerAta)
    const lotteryEntry = await program.account.lotteryAccount.fetch(
      attackerLotteryEntry
    )

    expect(Number(ata.amount)).to.equal(
      lotteryEntry.timestamp.toNumber() * 10 * 2
    )
})
```

Esta prueba hace lo siguiente:

1. Llama a **redeem_rewards_insecure** para canjear las recompensas del usuario.
2. En la misma transacción, agrega una instrucción para devolver la **lottery_entry** del usuario antes de que realmente pueda cerrarse
3. Repite con éxito los pasos 1 y 2, canjeando recompensas por segunda vez.

Teóricamente, se pueden repetir los pasos 1-2 infinitamente hasta que a) el programa no tenga más recompensas que dar o b) alguien lo note y solucione el exploit. Esto sería obviamente un problema grave en cualquier programa real, ya que permite a un atacante malicioso drenar toda una piscina de recompensas.

## 3. Crear una instrucción **redeem_rewards_secure**

Para evitar que esto suceda, vamos a crear una nueva instrucción que cierra la cuenta de lotería de manera segura utilizando la restricción de **close** de Anchor. Siéntete libre de probar esto por tu cuenta si quieres.

La nueva estructura de validación de cuenta llamada **RedeemWinningsSecure** debería verse así:

```Rust
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

Debería ser exactamente igual que la estructura original de **RedeemWinnings** , excepto que hay una restricción adicional **close = user** en la cuenta **lottery_entry** . Esto le dirá a Anchor que cierre la cuenta poniendo a cero los datos, transfiriendo sus lamports a la cuenta del **user** y estableciendo el discriminador de cuenta en la variante **CLOSED_ACCOUNT_DISCRIMINATOR** . Este último paso es lo que evitará que la cuenta sea utilizada de nuevo si el programa ha intentado cerrarla ya.

Luego, podemos crear un método **mint_ctx** en la nueva estructura **RedeemWinningsSecure** para ayudar con el acuñamiento CPI en el programa de tokens.

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

```Rust
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

Esta lógica simplemente calcula las recompensas para el usuario que las reclama y transfiere las recompensas. Sin embargo, debido a la restricción de **close** en la estructura de validación de cuenta, el atacante no debería poder llamar a esta instrucción varias veces.

## 4.Test del programa

Para probar nuestra nueva instrucción segura, crearemos una nueva prueba que intente llamar a **redeemingWinningsSecure** dos veces. Esperamos que la segunda llamada arroje un error.

```Rust
it("attacker cannot claim multiple rewards with secure claim", async () => {
    const tx = new Transaction()
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
        .instruction()
    )

    // user adds instruction to refund dataAccount lamports
    const rentExemptLamports =
      await provider.connection.getMinimumBalanceForRentExemption(
        82,
        "confirmed"
      )
    tx.add(
      SystemProgram.transfer({
        fromPubkey: attacker.publicKey,
        toPubkey: attackerLotteryEntry,
        lamports: rentExemptLamports,
      })
    )
    // send tx
    await sendAndConfirmTransaction(provider.connection, tx, [attacker])

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
        .rpc()
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
})
```

Ejecuta el comando de **anchor test** para verificar que la prueba pase. La resultado se verá algo así:

```Rust
closing-accounts
    ✔ Enter lottery (451ms)
    ✔ attacker can close + refund lottery acct + claim multiple rewards (18760ms)
AnchorError caused by account: lottery_entry. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.
    ✔ attacker cannot claim multiple rewards with secure claim (414ms)
```

Tenga en cuenta que esto no impide que el usuario malintencionado reembolse su cuenta por completo, sólo protege a nuestro programa de volver a usar la cuenta accidentalmente cuando debería estar cerrada. Todavía no hemos implementado la instrucción **force_defund** , pero podríamos. Si te sientes con ganas, ¡dále una oportunidad!

La forma más sencilla y segura de cerrar cuentas es utilizando la restricción de **close** de Anchor. Si alguna vez necesitas un comportamiento personalizado y no puedes usar esta restricción, asegúrate de replicar su funcionalidad para garantizar la seguridad del programa.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la rama de **solution** del mismo [repositorio](https://github.com/Unboxed-Software/solana-closing-accounts/tree/solution).

# Reto

Al igual que con otras lecciones en este módulo, tu oportunidad de practicar evitando este ataque de seguridad radica en la revisión de tus propios programas o de otros.

Tómate un tiempo para revisar al menos un programa y asegúrate de que cuando se cierran las cuentas, no son susceptibles a ataques de revivificación.
Recuerda, si encuentras un error o exploit en el programa de alguien más, ¡avísale! Si encuentras uno en tu propio programa, asegúrate de solucionarlo de inmediato.

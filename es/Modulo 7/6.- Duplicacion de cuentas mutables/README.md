# Duplicación de cuentas mutables.

## Objetivos de la lección

_Al terminar esta lección podrás:_

- Explicar los riesgos de seguridad asociados con las instrucciones que requieren dos cuentas mutables del mismo tipo y cómo evitarlos.
- Implemente una verificación de cuentas mutables duplicadas usando Rust de formato largo.
- Implemente una verificación de cuentas mutables duplicadas usando restricciones de Anchor.

# Terminología

- Cuando una instrucción requiere dos cuentas mutables del mismo tipo, un atacante puede pasar la misma cuenta dos veces, lo que hace que la cuenta se mute de manera no deseada.

- Para verificar si hay cuentas mutables duplicadas en Rust, simplemente compara las claves públicas de las dos cuentas y arroja un error si son iguales.

```Rust
if ctx.accounts.account_one.key() == ctx.accounts.account_two.key() {
    return Err(ProgramError::InvalidArgument)
}
```

- En Anchor, puedes usar la **constraint** para agregar una restricción a una cuenta verificando que no sea igual a otra cuenta.

# Resumen

La duplicación de cuentas mutables se refiere a una instrucción que requiere dos cuentas mutables del mismo tipo. Cuando esto ocurre, debe validar que dos cuentas son diferentes para evitar que la misma cuenta se pase en la instrucción dos veces.

Dado que el programa trata cada cuenta como separada, pasar la misma cuenta dos veces podría resultar en que la segunda cuenta sea mutada de manera no intencional. Esto podría resultar en problemas muy leves o catastróficos, depende de qué datos cambie el código y cómo se utilicen estas cuentas. En cualquier caso, esta es una vulnerabilidad de la que todos los desarrolladores deben estar al tanto.

## Sin verificación

Por ejemplo, imagine un programa que actualiza un campo de **data** para el **user_a** y el **user_b** en una sola instrucción. El valor que la instrucción establece para el **user_a** es diferente del **user_b**. Sin verificar que el **user_a** y el **usuario_b** son diferentes, el programa actualizaría el campo de **data** en la cuenta del **user_a** , luego actualizaría el campo de **data** por segunda vez con un valor diferente asumiendo que el **user_b** es una cuenta separada.

Puedes ver este ejemplo en el código de abajo. No hay ninguna verificación para comprobar que el **user_a** y el **user_b** no son la misma cuenta. Pasar la misma cuenta para el **user_a** y el **user_b** dará como resultado que el campo de **data** para la cuenta se establezca en **b** , aunque la intención es establecer ambos valores **a** y **b** en cuentas separadas. Dependiendo de lo que representan los **data**, esto podría ser un efecto secundario menor no deseado o podría significar un grave riesgo de seguridad. permitir que el **user_a** y el **user_b** sean la misma cuenta podría resultar en

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_insecure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

## Agregar una comprobación en la instrucción

Para solucionar este problema en Rust, simplemente añade una comprobación en la lógica de la instrucción para verificar que la clave pública del **user_a** no es la misma que la clave pública del **user_b** , devolviendo un error si son iguales.

```Rust
if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
    return Err(ProgramError::InvalidArgument)
}
```

Esta comprobación garantiza que **user_a** y **user_b** no sean la misma cuenta.

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_secure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
            return Err(ProgramError::InvalidArgument.into())
        }
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

## Usar la **constraint** de Anchor

Una solución aún mejor si estás usando Anchor es agregar la verificación a la estructura de validación de cuenta en lugar de la lógica de la instrucción.

Puedes usar el atributo macro **#[account(..)]** y la palabra clave de **constraint** para agregar una restricción manual a una cuenta. La palabra clave de **constraint** verificará si la expresión que sigue se evalúa como verdadera o falsa, arrojando un error si la expresión se evalúa como falsa.

El ejemplo a continuación mueve la verificación de la lógica de la instrucción a la estructura de validación de cuenta agregando una **constraint** al atributo **#[account(..)]**.

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_recommended {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(constraint = user_a.key() != user_b.key())]
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

# Demostración

Practiquemos creando un programa simple de Piedra, Papel, Tijeras para demostrar cómo el no verificar las cuentas mutables duplicadas pueden causar un comportamiento no definido en tu programa.

Este programa inicializará las cuentas "jugador" y tendrá una instrucción separada que requiere dos cuentas de jugador para representar el inicio de un juego de piedra, papel y tijeras.

- Una instrucción de **initialize** para inicializar una cuenta **PlayerState**
- Una instrucción **rock_paper_scissors_shoot_insecure** que requiere dos cuentas **PlayerState**, pero no verifica que las cuentas pasadas a la instrucción sean diferentes
- Una instrucción **rock_paper_scissors_shoot_secure** que es la misma que la instrucción **rock_paper_scissors_shoot_insecure** , pero agrega una restricción que asegura que las dos cuentas de jugador son diferentes.

## 1. Iniciemos

Para comenzar, descarga el código de inicio en la rama de **starter** de este [repositorio](https://github.com/unboxed-software/solana-duplicate-mutable-accounts/tree/starter). El código de inicio incluye un programa con dos instrucciones y la configuración de la plantilla para el archivo de prueba.

La instrucción de **initialize** inicializa una nueva cuenta **PlayerState** que almacena la clave pública de un jugador y un campo de **choice** que se establece en **None** .

La instrucción **rock_paper_scissors_shoot_insecure** requiere dos cuentas de **PlayerState** y requiere una elección del enumerado **RockPaperScissors** para cada jugador, pero no verifica que las cuentas pasadas a la instrucción sean diferentes. Esto significa que se puede utilizar una sola cuenta para ambas cuentas de **PlayerState** en la instrucción.

```Rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.new_player.player = ctx.accounts.payer.key();
        ctx.accounts.new_player.choice = None;
        Ok(())
    }

    pub fn rock_paper_scissors_shoot_insecure(
        ctx: Context<RockPaperScissorsInsecure>,
        player_one_choice: RockPaperScissors,
        player_two_choice: RockPaperScissors,
    ) -> Result<()> {
        ctx.accounts.player_one.choice = Some(player_one_choice);

        ctx.accounts.player_two.choice = Some(player_two_choice);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8
    )]
    pub new_player: Account<'info, PlayerState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RockPaperScissorsInsecure<'info> {
    #[account(mut)]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}

#[account]
pub struct PlayerState {
    player: Pubkey,
    choice: Option<RockPaperScissors>,
}

#[derive(Clone, Copy, BorshDeserialize, BorshSerialize)]
pub enum RockPaperScissors {
    Rock,
    Paper,
    Scissors,
}
```

## 2. Instrucciones para prueba **rock_paper_scissors_shoot_insecure**

El archivo de prueba incluye el código para ejecutar la instrucción **initialize** dos veces para crear dos cuentas de jugador.

Añade una prueba para ejecutar la instrucción **rock_paper_scissors_shoot_insecure** pasando **playerOne.publicKey** para **playerOne** y **playerTwo**.

```Rust
describe("duplicate-mutable-accounts", () => {
	...
	it("Invoke insecure instruction", async () => {
        await program.methods
        .rockPaperScissorsShootInsecure({ rock: {} }, { scissors: {} })
        .accounts({
            playerOne: playerOne.publicKey,
            playerTwo: playerOne.publicKey,
        })
        .rpc()

        const p1 = await program.account.playerState.fetch(playerOne.publicKey)
        assert.equal(JSON.stringify(p1.choice), JSON.stringify({ scissors: {} }))
        assert.notEqual(JSON.stringify(p1.choice), JSON.stringify({ rock: {} }))
    })
})
```

Ejecuta una **anchor test** para verificar que la transacción se completa con éxito, a pesar de que se utiliza la misma cuenta como dos cuentas en la instrucción. Ya que se utiliza la cuenta de **playerOne** como ambos jugadores en la instrucción, tenga en cuenta que la **choice** almacenada en la cuenta de **playerOne** también se anula y se establece incorrectamente como **scissors**.

```Rust
duplicate-mutable-accounts
  ✔ Initialized Player One (461ms)
  ✔ Initialized Player Two (404ms)
  ✔ Invoke insecure instruction (406ms)
```

No solo permitir cuentas duplicadas no tiene mucho sentido para el juego, sino que también causa un comportamiento no definido. Si se ampliara aún más este programa, el programa solo tiene una opción elegida y, por lo tanto, no se puede comparar con una segunda opción. El juego terminaría en empate cada vez. También es poco claro para un humano si la opción de **playerOne** debería ser roca o tijeras, por lo que el comportamiento del programa es extraño.

## 3. Agregar la instrucción **rock_paper_scissors_shoot_secure**

A continuación, regrese a **lib.rs** y agregue una instrucción **rock_paper_scissors_shoot_secure** que utilice la macro **#[account(...)]** para agregar una **constraint** adicional para verificar que **player_one** y **player_two** son cuentas diferentes.

```Rust
#[program]
pub mod duplicate_mutable_accounts {
    use super::*;
		...
        pub fn rock_paper_scissors_shoot_secure(
            ctx: Context<RockPaperScissorsSecure>,
            player_one_choice: RockPaperScissors,
            player_two_choice: RockPaperScissors,
        ) -> Result<()> {
            ctx.accounts.player_one.choice = Some(player_one_choice);

            ctx.accounts.player_two.choice = Some(player_two_choice);
            Ok(())
        }
}

#[derive(Accounts)]
pub struct RockPaperScissorsSecure<'info> {
    #[account(
        mut,
        constraint = player_one.key() != player_two.key()
    )]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}
```

## 4. Prueba de la instrucción **rock_paper_scissors_shoot_secure**

Para probar la instrucción **rock_paper_scissors_shoot_secure** , ejecutaremos la instrucción dos veces. Primero, ejecutaremos la instrucción utilizando dos cuentas de jugador diferentes para verificar que la instrucción funciona como se esperaba. Luego, ejecutaremos la instrucción utilizando **playerOne.publicKey** como ambas cuentas de jugador, lo que esperamos que falle.

```Rust
describe("duplicate-mutable-accounts", () => {
	...
    it("Invoke secure instruction", async () => {
        await program.methods
        .rockPaperScissorsShootSecure({ rock: {} }, { scissors: {} })
        .accounts({
            playerOne: playerOne.publicKey,
            playerTwo: playerTwo.publicKey,
        })
        .rpc()

        const p1 = await program.account.playerState.fetch(playerOne.publicKey)
        const p2 = await program.account.playerState.fetch(playerTwo.publicKey)
        assert.equal(JSON.stringify(p1.choice), JSON.stringify({ rock: {} }))
        assert.equal(JSON.stringify(p2.choice), JSON.stringify({ scissors: {} }))
    })

    it("Invoke secure instruction - expect error", async () => {
        try {
        await program.methods
            .rockPaperScissorsShootSecure({ rock: {} }, { scissors: {} })
            .accounts({
                playerOne: playerOne.publicKey,
                playerTwo: playerOne.publicKey,
            })
            .rpc()
        } catch (err) {
            expect(err)
            console.log(err)
        }
    })
})
```

Ejecuta una **anchor test** para verificar que la instrucción funciona como se espera y que el uso de la cuenta **playerOne** dos veces devuelve el error esperado.

```Rust
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: RockPaperScissorsShootSecure',
'Program log: AnchorError caused by account: player_one. Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated.',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 5104 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d3'
```

La simple restricción es todo lo que se necesita para cerrar esta brecha. Aunque algo artificial, este ejemplo ilustra el comportamiento extraño que puede ocurrir si escribe su programa bajo la suposición de que dos cuentas del mismo tipo serán instancias diferentes de una cuenta pero no escribe esa restricción explícitamente en su programa. Siempre piense en el comportamiento que espera del programa y si eso es explícito.
Si desea echar un vistazo al código de la solución final, puede encontrarlo en la rama de **solution** del [repositorio](https://github.com/Unboxed-Software/solana-duplicate-mutable-accounts/tree/solution).

# Reto

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando esta exploción de seguridad radica en auditar sus propios programas o de otros.

Tómese el tiempo para revisar al menos un programa y asegurarse de que cualquier instrucción con dos cuentas mutables del mismo tipo estén adecuadamente restringidas para evitar duplicados.

Recuerda, si encuentras un error o exploción en el programa de alguien más, ¡avísale! Si encuentra uno en su propio programa, asegúrese de corregirlo de inmediato.

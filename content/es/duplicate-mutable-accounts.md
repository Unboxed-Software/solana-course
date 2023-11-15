---
title: Objetivos de las cuentas mutables duplicadas
objectives:
- Explicar los riesgos de seguridad asociados con las instrucciones que requieren dos cuentas mutables del mismo tipo y cómo evitarlos
- Implementar una verificación de cuentas mutables duplicadas utilizando Rust de formato largo
- Implementar una verificación de cuentas mutables duplicadas utilizando las restricciones de Anchor
---

# TL;DR

-   Cuando una instrucción requiere dos cuentas mutables del mismo tipo, un atacante puede pasar en la misma cuenta dos veces, lo que hace que la cuenta se mute de manera involuntaria.
-   Para comprobar si hay cuentas mutables duplicadas en Rust, simplemente compare las claves públicas de las dos cuentas y arroje un error si son iguales.

    ```rust
    if ctx.accounts.account_one.key() == ctx.accounts.account_two.key() {
        return Err(ProgramError::InvalidArgument)
    }
    ```

-   En Anchor, puede usar `constraint` para agregar una restricción explícita a una cuenta que comprueba que no es lo mismo que otra cuenta.

# Descripción general

Las cuentas mutables duplicadas se refieren a una instrucción que requiere dos cuentas mutables del mismo tipo. Cuando esto ocurra, debe validar que dos cuentas sean diferentes para evitar que la misma cuenta pase a la instrucción dos veces.

Dado que el programa trata cada cuenta como separada, pasar la misma cuenta dos veces podría resultar en que la segunda cuenta mutara de manera involuntaria. Esto podría resultar en problemas muy menores, o catastróficos, realmente depende de qué datos cambie el código y cómo se usen estas cuentas. En cualquier caso, esta es una vulnerabilidad que todos los desarrolladores deben tener en cuenta.

### Sin cheque

Por ejemplo, imagine un programa que actualiza un `data` campo para `user_a` y `user_b` en una sola instrucción. El valor que establece la instrucción `user_a` es diferente `user_b`. Sin verificar eso `user_a` y `user_b` son diferentes, el programa actualizaría el `data` campo en la `user_a` cuenta, luego actualizaría el `data` campo una segunda vez con un valor diferente bajo el supuesto de que `user_b` es una cuenta separada.

Puede ver este ejemplo en el código a continuación. No hay verificación para verificar eso `user_a` y no `user_b` son la misma cuenta. Pasar en la misma cuenta `user_a` y `user_b` dará como resultado que el `data` campo para la cuenta se establezca a `b` pesar de que la intención es establecer ambos valores `a` y `b` en cuentas separadas. Dependiendo de lo que `data` represente, esto podría ser un efecto secundario no deseado menor, o podría significar un grave riesgo de seguridad. `user_b` permitir `user_a` y ser la misma cuenta podría resultar en

```rust
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

### Añadir instrucción de llegada

Para solucionar este problema con plan Rust, simplemente agregue una verificación en la lógica de instrucciones para verificar que la clave pública de `user_a` no es la misma que la clave pública de `user_b`, devolviendo un error si son los mismos.

```rust
if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
    return Err(ProgramError::InvalidArgument)
}
```

Esta comprobación asegura que `user_a` y no `user_b` son la misma cuenta.

```rust
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

### Usar ancla `constraint`

Una solución aún mejor si está utilizando Anchor es agregar el cheque a la estructura de validación de la cuenta en lugar de la lógica de instrucciones.

Puede usar la macro de  `#[account(..)]`  atributos y la `constraint` palabra clave para añadir una restricción manual a una cuenta. La `constraint` palabra clave verificará si la expresión que sigue se evalúa como verdadera o falsa, devolviendo un error si la expresión se evalúa como falsa.

El siguiente ejemplo mueve la comprobación de la lógica de instrucciones a la estructura de validación de cuenta añadiendo `constraint` a al `#[account(..)]`  atributo.

```rust
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

Vamos a practicar mediante la creación de un simple programa de Rock Paper Scissors para demostrar cómo no comprobar si hay cuentas mutables duplicadas puede causar un comportamiento indefinido dentro de su programa.

Este programa inicializará las cuentas de "jugador" y tendrá una instrucción separada que requiere que las cuentas de dos jugadores representen el inicio de un juego de tijeras de papel de roca.

-   Una `initialize` instrucción para inicializar una `PlayerState` cuenta
-   Una `rock_paper_scissors_shoot_insecure` instrucción que requiere dos `PlayerState` cuentas, pero no verifica que las cuentas pasadas a la instrucción sean diferentes
-   Una `rock_paper_scissors_shoot_secure` instrucción que es la misma que la `rock_paper_scissors_shoot_insecure` instrucción, pero añade una restricción que asegura que las dos cuentas de jugador son diferentes.

### 1. Arranque

Para comenzar, descargue el código de inicio en la `starter` rama de[este repositorio](https://github.com/unboxed-software/solana-duplicate-mutable-accounts/tree/starter). El código de arranque incluye un programa con dos instrucciones y la configuración de la platina para el archivo de prueba.

La `initialize` instrucción inicializa una nueva `PlayerState` cuenta que almacena la clave pública de un jugador y un `choice` campo que se establece en `None`.

La `rock_paper_scissors_shoot_insecure` instrucción requiere dos `PlayerState` cuentas y requiere una elección del `RockPaperScissors` enum para cada jugador, pero no verifica que las cuentas pasadas a la instrucción sean diferentes. Esto significa que se puede usar una sola cuenta para ambas `PlayerState` cuentas en la instrucción.

```rust
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

### 2. `rock_paper_scissors_shoot_insecure` Instrucciones de prueba

El archivo de prueba incluye el código para invocar la `initialize` instrucción dos veces para crear dos cuentas de jugador.

Agregue una prueba para invocar la `rock_paper_scissors_shoot_insecure` instrucción pasando el `playerOne.publicKey` for como ambos `playerOne` y `playerTwo`.

```typescript
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

Ejecutar `anchor test` para ver que las transacciones se completan con éxito, a pesar de que la misma cuenta se utiliza como dos cuentas en la instrucción. Dado que la `playerOne` cuenta se utiliza como ambos jugadores en la instrucción, tenga en cuenta que el `choice` almacenado en la `playerOne` cuenta también se anula y se establece incorrectamente como `scissors`.

```bash
duplicate-mutable-accounts
  ✔ Initialized Player One (461ms)
  ✔ Initialized Player Two (404ms)
  ✔ Invoke insecure instruction (406ms)
```

Permitir cuentas duplicadas no solo no tiene mucho sentido para el juego, sino que también causa un comportamiento indefinido. Si tuviéramos que construir más este programa, el programa solo tiene una opción elegida y, por lo tanto, no puede compararse con una segunda opción. El juego terminaría en empate cada vez. Tampoco está claro para un humano si la `playerOne` elección debe ser roca o tijeras, por lo que el comportamiento del programa es extraño.

### 3. Añadir `rock_paper_scissors_shoot_secure` instrucción

A continuación, volver a `lib.rs` y añadir una `rock_paper_scissors_shoot_secure` instrucción que utiliza la `#[account(...)]` macro para añadir un adicional `constraint` para comprobar que `player_one` y `player_two` son diferentes cuentas.

```rust
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

### 7. `rock_paper_scissors_shoot_secure` Instrucciones de prueba

Para probar la `rock_paper_scissors_shoot_secure` instrucción, vamos a invocar la instrucción dos veces. En primer lugar, vamos a invocar la instrucción utilizando dos cuentas de jugador diferentes para comprobar que la instrucción funciona según lo previsto. Luego, invocaremos la instrucción usando las cuentas `playerOne.publicKey` as both player, que esperamos que fallen.

```typescript
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

Ejecute `anchor test` para ver que la instrucción funciona según lo previsto y usar la `playerOne` cuenta dos veces devuelve el error esperado.

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: RockPaperScissorsShootSecure',
'Program log: AnchorError caused by account: player_one. Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated.',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 5104 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d3'
```

La restricción simple es todo lo que se necesita para cerrar esta laguna. Aunque algo artificial, este ejemplo ilustra el comportamiento extraño que puede ocurrir si escribe su programa bajo la suposición de que dos cuentas del mismo tipo serán instancias diferentes de una cuenta, pero no escriba explícitamente esa restricción en su programa. Siempre piense en el comportamiento que espera del programa y si eso es explícito.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[el repositorio](https://github.com/Unboxed-Software/solana-duplicate-mutable-accounts/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando este exploit de seguridad radica en auditar sus propios programas u otros.

Tómese un tiempo para revisar al menos un programa y asegúrese de que las instrucciones con dos cuentas mutables del mismo tipo estén correctamente limitadas para evitar duplicados.

Recuerde, si encuentra un error o un exploit en el programa de otra persona, ¡avíselos! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.

---
title: Objetivos arbitrarios del IPC
objectives:
- Explicar los riesgos de seguridad asociados con la invocación de un IPC a un programa desconocido
- Muestre cómo el módulo CPI de Anchor evita que esto suceda al realizar un CPI de un programa de Anchor a otro
- Hacer de forma segura un CPI de un programa de anclaje a un programa arbitrario que no sea de anclaje
---

# TL;DR

-   Para generar un CPI, el programa de destino debe pasar a la instrucción de invocación como una cuenta. Esto significa que cualquier programa objetivo podría pasar a la instrucción. Su programa debe verificar si hay programas incorrectos o inesperados.
-   Realice comprobaciones de programas en programas nativos simplemente comparando la clave pública del programa aprobado con el programa que esperaba.
-   Si un programa está escrito en Anchor, entonces puede tener un módulo CPI disponible públicamente. Esto hace que invocar el programa desde otro programa de Anchor sea simple y seguro. El módulo CPI de anclaje comprueba automáticamente que la dirección del programa pasado coincide con la dirección del programa almacenado en el módulo.

# Descripción general

Una invocación de programa cruzado (CPI) es cuando un programa invoca una instrucción en otro programa. Un "CPI arbitrario" es cuando un programa está estructurado para emitir un CPI a cualquier programa que se pase a la instrucción en lugar de esperar realizar un CPI a un programa específico. Dado que las personas que llaman a la instrucción de su programa pueden pasar cualquier programa que deseen a la lista de cuentas de la instrucción, no verificar la dirección de un programa aprobado hace que su programa realice CPI a programas arbitrarios.

Esta falta de comprobaciones de programa crea una oportunidad para que un usuario malicioso pase en un programa diferente de lo esperado, haciendo que el programa original llame a una instrucción en este programa misterioso. No se sabe cuáles podrían ser las consecuencias de este IPC. Depende de la lógica del programa (tanto la del programa original como la del programa inesperado), así como de qué otras cuentas se pasen a la instrucción original.

## Faltan comprobaciones del programa

Tomemos como ejemplo el siguiente programa. La `cpi` instrucción invoca la `transfer` instrucción activada `token_program`, pero no hay ningún código que compruebe si la `token_program` cuenta pasada a la instrucción es, de hecho, el Programa de Fichas SPL.

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_insecure {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        solana_program::program::invoke(
            &spl_token::instruction::transfer(
                ctx.accounts.token_program.key,
                ctx.accounts.source.key,
                ctx.accounts.destination.key,
                ctx.accounts.authority.key,
                &[],
                amount,
            )?,
            &[
                ctx.accounts.source.clone(),
                ctx.accounts.destination.clone(),
                ctx.accounts.authority.clone(),
            ],
        )
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: UncheckedAccount<'info>,
    destination: UncheckedAccount<'info>,
    authority: UncheckedAccount<'info>,
    token_program: UncheckedAccount<'info>,
}
```

Un atacante podría llamar fácilmente a esta instrucción y pasar un programa de token duplicado que creó y controló.

## Añadir comprobaciones del programa

Es posible solucionar esta vulnerabilidad simplemente añadiendo unas pocas líneas a la `cpi` instrucción para verificar si la clave `token_program` pública es o no la del Programa de tokens SPL.

```rust
pub fn cpi_secure(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
    if &spl_token::ID != ctx.accounts.token_program.key {
        return Err(ProgramError::IncorrectProgramId);
    }
    solana_program::program::invoke(
        &spl_token::instruction::transfer(
            ctx.accounts.token_program.key,
            ctx.accounts.source.key,
            ctx.accounts.destination.key,
            ctx.accounts.authority.key,
            &[],
            amount,
        )?,
        &[
            ctx.accounts.source.clone(),
            ctx.accounts.destination.clone(),
            ctx.accounts.authority.clone(),
        ],
    )
}
```

Ahora, si un atacante pasa en un programa token diferente, la instrucción devolverá el `ProgramError::IncorrectProgramId` error.

Dependiendo del programa que esté invocando con su CPI, puede codificar la dirección del ID de programa esperado o usar la caja de óxido del programa para obtener la dirección del programa, si está disponible. En el ejemplo anterior, la `spl_token` caja proporciona la dirección del Programa de tokens SPL.

## Utilizar un módulo Anchor CPI

Una forma más sencilla de gestionar las comprobaciones del programa es utilizar los módulos Anchor CPI. Aprendimos en un programa [lección anterior](https://github.com/Unboxed-Software/solana-course/blob/main/content/anchor-cpi) que Anchor puede generar automáticamente módulos de CPI para simplificar los CPI en el programa. Estos módulos también mejoran la seguridad al verificar la clave pública del programa que se pasa a una de sus instrucciones públicas.

Cada programa Anchor utiliza la `declare_id()` macro para definir la dirección del programa. Cuando se genera un módulo CPI para un programa específico, utiliza la dirección pasada a esta macro como la "fuente de la verdad" y verificará automáticamente que todos los CPI realizados con su módulo CPI tengan como objetivo esta identificación de programa.

Si bien en el núcleo no es diferente de las comprobaciones manuales de programas, el uso de módulos CPI evita la posibilidad de olvidar realizar una comprobación de programa o escribir accidentalmente el ID de programa incorrecto al codificarlo.

El programa a continuación muestra un ejemplo de uso de un módulo CPI para el Programa de Fichas SPL para realizar la transferencia mostrada en los ejemplos anteriores.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_recommended {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        token::transfer(ctx.accounts.transfer_ctx(), amount)
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: Account<'info, TokenAccount>,
    destination: Account<'info, TokenAccount>,
    authority: Signer<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> Cpi<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.source.to_account_info(),
            to: self.destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}
```

Tenga en cuenta que, al igual que el ejemplo anterior, Anchor ha creado algunos [wrappers para programas nativos populares](https://github.com/coral-xyz/anchor/tree/master/spl/src) que le permiten emitir IPC en ellos como si fueran programas de Anchor.

Además, y dependiendo del programa al que esté realizando el CPI, es posible que pueda usar el [tipo de `Program` cuenta] de Anchor (https://docs.rs/anchor-lang/latest/anchor_lang/accounts/program/struct.Program.html) para validar el programa aprobado en la estructura de validación de su cuenta. Entre las cajas [ `anchor_lang`](https://docs.rs/anchor-lang/latest/anchor_lang) y [ `anchor_spl`](https://docs.rs/anchor_spl/latest/), se proporcionan los siguientes  `Program`  tipos de cajas:

-   [ `System`](https://docs.rs/anchor-lang/latest/anchor_lang/system_program/struct.System.html)
-   [ `AssociatedToken`](https://docs.rs/anchor-spl/latest/anchor_spl/associated_token/struct.AssociatedToken.html)
-   [ `Token`](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.Token.html)

Si tiene acceso al módulo CPI de un programa de anclaje, normalmente puede importar su tipo de programa con lo siguiente, reemplazando el nombre del programa con el nombre del programa real:

```rust
use other_program::program::OtherProgram;
```

# Demostración

Para mostrar la importancia de consultar con el programa que utiliza para los IPC, vamos a trabajar con un juego simplificado y algo artificial. Este juego representa personajes con cuentas PDA, y utiliza un programa separado de "metadatos" para gestionar los metadatos de los personajes y atributos como la salud y el poder.

Si bien este ejemplo es un poco artificial, en realidad es una arquitectura casi idéntica a cómo funcionan los NFT en Solana: el Programa de tokens SPL administra las casas de moneda, la distribución y las transferencias de tokens, y se utiliza un programa de metadatos separado para asignar metadatos a los tokens. Así que la vulnerabilidad por la que pasamos aquí también podría aplicarse a tokens reales.

### 1. Configuración

Empezaremos con la `starter` rama de[este repositorio](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/starter). Clone el repositorio y luego ábralo en la `starter` rama.

Tenga en cuenta que hay tres programas:

1.  `gameplay`
2.  `character-metadata`
3.  `fake-metadata`

Además, ya hay una prueba en el `tests` directorio.

El primer programa, `gameplay`,, es el que nuestra prueba utiliza directamente. Echa un vistazo al programa. Tiene dos instrucciones:

1.  `create_character_insecure` - crea un nuevo carácter y CPI en el programa de metadatos para configurar los atributos iniciales del carácter
2.  `battle_insecure` - enfrenta a dos personajes entre sí, asignando una "victoria" al personaje con los atributos más altos

El segundo programa, `character-metadata`, está destinado a ser el programa "aprobado" para manejar metadatos de caracteres. Echa un vistazo a este programa. Tiene una sola instrucción `create_metadata` que crea un nuevo PDA y asigna un valor pseudoaleatorio entre 0 y 20 para la salud y el poder del personaje.

El último programa, `fake-metadata` es un programa de metadatos "falso" destinado a ilustrar lo que un atacante podría hacer para explotar nuestro `gameplay` programa. Este programa es casi idéntico al `character-metadata` programa, solo que asigna la salud y el poder inicial de un personaje para que sea el máximo permitido: 255.

### 2. `create_character_insecure` Instrucciones de prueba

Ya hay una prueba en el `tests` directorio para esto. Es largo, pero tómese un minuto para verlo antes de que hablemos juntos:

```typescript
it("Insecure instructions allow attacker to win every time", async () => {
    // Initialize player one with real metadata program
    await gameplayProgram.methods
        .createCharacterInsecure()
        .accounts({
            metadataProgram: metadataProgram.programId,
            authority: playerOne.publicKey,
        })
        .signers([playerOne])
        .rpc();

    // Initialize attacker with fake metadata program
    await gameplayProgram.methods
        .createCharacterInsecure()
        .accounts({
            metadataProgram: fakeMetadataProgram.programId,
            authority: attacker.publicKey,
        })
        .signers([attacker])
        .rpc();

    // Fetch both player's metadata accounts
    const [playerOneMetadataKey] = getMetadataKey(
        playerOne.publicKey,
        gameplayProgram.programId,
        metadataProgram.programId,
    );

    const [attackerMetadataKey] = getMetadataKey(
        attacker.publicKey,
        gameplayProgram.programId,
        fakeMetadataProgram.programId,
    );

    const playerOneMetadata = await metadataProgram.account.metadata.fetch(
        playerOneMetadataKey,
    );

    const attackerMetadata = await fakeMetadataProgram.account.metadata.fetch(
        attackerMetadataKey,
    );

    // The regular player should have health and power between 0 and 20
    expect(playerOneMetadata.health).to.be.lessThan(20);
    expect(playerOneMetadata.power).to.be.lessThan(20);

    // The attacker will have health and power of 255
    expect(attackerMetadata.health).to.equal(255);
    expect(attackerMetadata.power).to.equal(255);
});
```

Esta prueba efectivamente camina a través del escenario donde un jugador regular y un atacante crean sus personajes. Solo el atacante pasa el ID de programa del programa de metadatos falsos en lugar del programa de metadatos real. Y como la `create_character_insecure` instrucción no tiene comprobaciones de programa, todavía se ejecuta.

El resultado es que el carácter regular tiene la cantidad apropiada de salud y potencia: cada uno un valor entre 0 y 20. Pero la salud y el poder del atacante son 255, lo que hace que el atacante sea imbatible.

Si aún no lo ha hecho, ejecute `anchor test` para ver que esta prueba de hecho se comporta como se describe.

### 3. Crear una `create_character_secure` instrucción

Vamos a arreglar esto creando una instrucción segura para crear un nuevo personaje. Esta instrucción debe implementar comprobaciones de programa adecuadas y usar la `cpi` caja del `character-metadata` programa para hacer el CPI en lugar de solo usarlo `invoke`.

Si quieres poner a prueba tus habilidades, prueba esto por tu cuenta antes de seguir adelante.

Comenzaremos actualizando nuestra `use` declaración en la parte superior del `lib.rs` archivo de `gameplay` programas. Nos estamos dando acceso al tipo de programa para la validación de la cuenta y la función de ayuda para emitir el `create_metadata` IPC.

```rust
use character_metadata::{
    cpi::accounts::CreateMetadata,
    cpi::create_metadata,
    program::CharacterMetadata,
};
```

A continuación vamos a crear una nueva estructura de validación de cuenta llamada `CreateCharacterSecure`. Esta vez, hacemos `metadata_program` un `Program` tipo:

```rust
#[derive(Accounts)]
pub struct CreateCharacterSecure<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 64,
        seeds = [authority.key().as_ref()],
        bump
    )]
    pub character: Account<'info, Character>,
    #[account(
        mut,
        seeds = [character.key().as_ref()],
        seeds::program = metadata_program.key(),
        bump,
    )]
    /// CHECK: manual checks
    pub metadata_account: AccountInfo<'info>,
    pub metadata_program: Program<'info, CharacterMetadata>,
    pub system_program: Program<'info, System>,
}
```

Por último, añadimos la `create_character_secure` instrucción. Será el mismo que antes, pero usará la funcionalidad completa de los CPI de Anchor en lugar de usar `invoke` directamente:

```rust
pub fn create_character_secure(ctx: Context<CreateCharacterSecure>) -> Result<()> {
    let character = &mut ctx.accounts.character;
    character.metadata = ctx.accounts.metadata_account.key();
    character.auth = ctx.accounts.authority.key();
    character.wins = 0;

    let context = CpiContext::new(
        ctx.accounts.metadata_program.to_account_info(),
        CreateMetadata {
            character: ctx.accounts.character.to_account_info(),
            metadata: ctx.accounts.metadata_account.to_owned(),
            authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );

    create_metadata(context)?;

    Ok(())
}
```

### 4. Prueba `create_character_secure`

Ahora que tenemos una forma segura de inicializar un nuevo personaje, vamos a crear una nueva prueba. Esta prueba solo necesita intentar inicializar el carácter del atacante y esperar que se arroje un error.

```typescript
it("Secure character creation doesn't allow fake program", async () => {
    try {
        await gameplayProgram.methods
            .createCharacterSecure()
            .accounts({
                metadataProgram: fakeMetadataProgram.programId,
                authority: attacker.publicKey,
            })
            .signers([attacker])
            .rpc();
    } catch (error) {
        expect(error);
        console.log(error);
    }
});
```

Corre `anchor test` si aún no lo has hecho. Observe que se arrojó un error como se esperaba, detallando que el ID de programa pasado a la instrucción no es el ID de programa esperado:

```bash
'Program log: AnchorError caused by account: metadata_program. Error Code: InvalidProgramId. Error Number: 3008. Error Message: Program ID was not as expected.',
'Program log: Left:',
'Program log: FKBWhshzcQa29cCyaXc1vfkZ5U985gD5YsqfCzJYUBr',
'Program log: Right:',
'Program log: D4hPnYEsAx4u3EQMrKEXsY3MkfLndXbBKTEYTwwm25TE'
```

¡Eso es todo lo que necesita hacer para protegerse contra los IPC arbitrarios!

Puede haber momentos en los que desee más flexibilidad en los IPC de su programa. Ciertamente no le impediremos diseñar el programa que necesita, pero tome todas las precauciones posibles para garantizar que no haya vulnerabilidades en su programa.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[el mismo repositorio](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando este exploit de seguridad radica en auditar sus propios programas u otros.

Tómese un tiempo para revisar al menos un programa y asegúrese de que las verificaciones del programa estén en su lugar para cada programa pasado a las instrucciones, particularmente aquellos que se invocan a través de CPI.

Recuerde, si encuentra un error o un exploit en el programa de otra persona, ¡avíselos! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.

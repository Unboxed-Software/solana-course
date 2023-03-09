# CPI arbitraria

## Objetivos de la lección

_Al finalizar esta lección, podrás:_

- Explicar los riesgos de seguridad asociados con la invocación de un CPI a un programa desconocido
- Mostrar cómo el módulo CPI de Anchor previene esto al realizar un CPI de un programa Anchor a otro
- Realizar de manera segura y segura un CPI desde un programa Anchor a un programa arbitrario no-Anchor.

# Terminología

- Para generar un CPI, el programa destino debe pasarse a la instrucción de invocación como una cuenta. Esto significa que cualquier programa destino podría pasarse a la instrucción. Su programa debe verificar programas incorrectos o inesperados.
- Realice verificaciones de programas en programas nativos simplemente comparando la clave pública del programa pasado con el programa que esperaba.
- Si un programa está escrito en Anchor, entonces puede tener un módulo CPI disponible públicamente. Esto hace que la invocación del programa desde otro programa Anchor sea simple y segura. El módulo CPI de Anchor verifica automáticamente que la dirección del programa pasado coincida con la dirección del programa almacenado en el módulo.

# Resumen

Una invocación entre programas (CPI) es cuando un programa invoca una instrucción en otro programa. Una "CPI arbitraria" es cuando un programa está estructurado para emitir una CPI a cualquier programa que se pase a la instrucción en lugar de esperar realizar una CPI a un programa específico. Dado que los llamantes de la instrucción de su programa pueden pasar cualquier programa que deseen a la lista de cuentas de la instrucción, no verificar la dirección de un programa pasado resulta en que su programa realice CPIs a programas arbitrarios.

La falta de verificaciones de programas crea una oportunidad para que un usuario malicioso pase un programa diferente al esperado, causando que el programa original llame una instrucción en este programa desconocido. No se sabe qué consecuencias podría tener esta CPI. Depende de la lógica del programa (tanto del programa original como del programa inesperado) y de qué otras cuentas se pasen a la instrucción original.

## Faltan comprobaciones del programa

Toma como ejemplo el siguiente programa. La instrucción **cpi** invoca la instrucción de **transfer** en **token_program** , pero no hay código que compruebe si la cuenta **token_program** pasada a la instrucción es, de hecho el programa SPL Token.

```Rust
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

Un atacante podría llamar fácilmente a esta instrucción y pasar un programa de token duplicado que creó y controla.

## Añadir comprobaciones del programa

Es posible solucionar esta vulnerabilidad simplemente añadiendo algunas líneas a la instrucción **cpi** para comprobar si la clave pública de **token_program** es la del programa SPL Token.

```Rust
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

Ahora, si un atacante pasa un programa de token diferente, la instrucción devolverá el error **ProgramError::IncorrectProgramId** .

Dependiendo del programa que invoques con tu CPI, puedes codificar de manera rígida la dirección del ID de programa esperado o utilizar la caja del programa de Rust para obtener la dirección del programa, si está disponible. En el ejemplo anterior, la caja **spl_token** proporciona la dirección del programa SPL Token.

## Utilice un módulo CPI de Anclaje

Una forma más sencilla de gestionar las comprobaciones del programa es utilizar módulos CPI de Anclaje. Aprendimos en una [lección anterior](https://github.com/Unboxed-Software/solana-course/blob/main/content/anchor-cpi.md) que Anchor puede generar automáticamente módulos CPI para simplificar las CPIs en el programa. Estos módulos también mejoran la seguridad verificando la clave pública del programa que se pasa a una de sus instrucciones públicas.

Cada programa de Anclaje utiliza la macro **declare_id()** para definir la dirección del programa. Cuando se genera un módulo CPI para un programa específico, utiliza la dirección pasada a esta macro como la "fuente de verdad" y verificará automáticamente que todas las CPIs realizadas utilizando su módulo CPI apuntan a este ID de programa.

Aunque en el núcleo no es diferente de las comprobaciones del programa manuales, el uso de módulos CPI evita la posibilidad de olvidar realizar una comprobación del programa o escribir accidentalmente el ID de programa incorrecto al codificarlo de manera rígida.

El programa a continuación muestra un ejemplo de uso de un módulo CPI para el programa SPL Token para realizar la transferencia mostrada en los ejemplos anteriores.

```Rust
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

Ten en cuenta que, al igual que el ejemplo anterior, Anchor ha creado algunos [wrappers para programas nativos](https://github.com/coral-xyz/anchor/tree/master/spl/src) populares que te permiten emitir CPIs en ellos como si fueran programas de Anclaje.

Además, dependiendo del programa al que estés haciendo la CPI, es posible que puedas utilizar el [tipo de cuenta de programa](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/program/struct.Program.html) de Anchor para validar el programa pasado en tu estructura de validación de cuentas. Entre las cajas [anchor_lang](https://docs.rs/anchor-lang/latest/anchor_lang/) y [anchor_spl](https://docs.rs/anchor-spl/latest/anchor_spl/) , se proporcionan los siguientes tipos de **Program** de forma predeterminada:

- [System](https://docs.rs/anchor-lang/latest/anchor_lang/struct.System.html)
- [AssociatedToken](https://docs.rs/anchor-spl/latest/anchor_spl/associated_token/struct.AssociatedToken.html)
- [Token](https://docs.rs/anchor-spl/latest/anchor_spl/associated_token/struct.AssociatedToken.html)

Si tienes acceso a un módulo CPI de un programa de Anclaje, normalmente puedes importar su tipo de programa con lo siguiente, reemplazando el nombre del programa con el nombre del programa actual:

```Rust
use other_program::program::OtherProgram;
```

# Demostración

Para mostrar la importancia de comprobar con qué programa se utilizan las CPIs, vamos a trabajar con un juego simplificado y algo forzado. Este juego representa personajes con cuentas PDA, y utiliza un programa "metadatos" separado para administrar metadatos y atributos de los personajes como la salud y el poder.

Aunque este ejemplo es algo forzado, en realidad es una arquitectura casi idéntica a cómo funcionan los NFT en Solana: el programa SPL Token administra las acuñaciones, distribución y transferencias de tokens, y se utiliza un programa metadatos separado para asignar metadatos a los tokens. Por lo tanto, la vulnerabilidad que veremos aquí también se podría aplicar a tokens reales.

## 1. Configuración

Comenzaremos con la rama de **starter** de este [repositorio](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/starter). Clona el repositorio y luego abrelo en la rama **starter** .
Observa que hay tres programas:

1. **gameplay**
2. **character-metadata**
3. **fake-metadata**

Además, ya hay una prueba en el directorio de **tests** .

El primer programa, **gameplay** , es el que nuestra prueba utiliza directamente. Echa un vistazo al programa. Tiene dos instrucciones:

1. **create_character_insecure** - crea un nuevo personaje y CPI en el programa de metadatos para configurar los atributos iniciales del personaje
2. **battle_insecure** - enfrenta a dos personajes entre sí, asignando un "ganador" al personaje con los atributos más altos.

El segundo programa, **character-metadata** , es el programa "aprobado" para manejar los metadatos de los personajes. Echa un vistazo a este programa. Tiene una sola instrucción para **create_metadata** que crea una nueva PDA y asigna un valor pseudo-aleatorio entre 0 y 20 para la salud y el poder del personaje.

El último programa, **fake-metadata** es un programa de metadatos "falso" destinado a ilustrar lo que un atacante podría hacer para explotar nuestro programa **gameplay** . Este programa es casi idéntico al programa **character-metadata** , solo que asigna la salud y el poder inicial del personaje al máximo permitido: 255.

## 2. Prueba la instrucción **create_character_insecure**

Ya hay un **tests** en el directorio de pruebas para esto. Es largo, pero tómate un minuto para mirarla antes de que empecemos hablar sobre ella:

```Rust
it("Insecure instructions allow attacker to win every time", async () => {
    // Initialize player one with real metadata program
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: metadataProgram.programId,
        authority: playerOne.publicKey,
      })
      .signers([playerOne])
      .rpc()

    // Initialize attacker with fake metadata program
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: fakeMetadataProgram.programId,
        authority: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    // Fetch both player's metadata accounts
    const [playerOneMetadataKey] = getMetadataKey(
      playerOne.publicKey,
      gameplayProgram.programId,
      metadataProgram.programId
    )

    const [attackerMetadataKey] = getMetadataKey(
      attacker.publicKey,
      gameplayProgram.programId,
      fakeMetadataProgram.programId
    )

    const playerOneMetadata = await metadataProgram.account.metadata.fetch(
      playerOneMetadataKey
    )

    const attackerMetadata = await fakeMetadataProgram.account.metadata.fetch(
      attackerMetadataKey
    )

    // The regular player should have health and power between 0 and 20
    expect(playerOneMetadata.health).to.be.lessThan(20)
    expect(playerOneMetadata.power).to.be.lessThan(20)

    // The attacker will have health and power of 255
    expect(attackerMetadata.health).to.equal(255)
    expect(attackerMetadata.power).to.equal(255)
})
```

Esta prueba efectivamente describe el escenario en el que un jugador regular y un atacante crean sus personajes. Solo el atacante pasa el ID del programa de metadatos falso en lugar del programa de metadatos real. Y dado que la instrucción **create_character_insecure** no tiene comprobaciones de programas, aún se ejecuta.

El resultado es que el personaje regular tiene la cantidad adecuada de salud y poder: cada valor entre 0 y 20. Pero la salud y el poder del atacante son cada uno 255, lo que hace que el atacante sea imbatible.

Si aún no lo has hecho, ejecuta **anchor test** para ver que esta prueba se comporta de la manera descrita.

## 3. Instrucciones para crear **create_character_secure**

Vamos a solucionar esto creando una instrucción segura para crear un nuevo personaje. Esta instrucción debería implementar las comprobaciones de programa adecuadas y utilizar el **character-metadata** del programa de **cpi** para hacer el CPI en lugar de simplemente usar **invoke** .

Si quieres probar tus habilidades, intenta esto por tu cuenta antes de seguir adelante.

Comenzaremos actualizando nuestra declaración de **use** en la parte superior del archivo **gameplay** de los programas **lib.rs** . Nos estamos dando acceso al tipo de programa para validación de cuentas y a la función de ayuda para emitir el CPI de **create metadata** .

```Rust
use character_metadata::{
    cpi::accounts::CreateMetadata,
    cpi::create_metadata,
    program::CharacterMetadata,
};
```

A continuación, creamos una nueva estructura de validación de cuentas llamada **CreateCharacterSecure** . Esta vez, hacemos que **metadata_program** sea un tipo de **Program** :

```Rust
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

Por último, agregamos la instrucción **create_character_secure** . Será igual que antes, pero utilizará la funcionalidad completa de Anchor CPIs en lugar de usar **invoke** directamente:

```Rust
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

## 4.Prueba **create_character_secure**

Ahora que tenemos una forma segura de inicializar un nuevo personaje, creemos una nueva prueba. Esta prueba solo necesita intentar inicializar el personaje del atacante y esperar un error.

```Rust
it("Secure character creation doesn't allow fake program", async () => {
    try {
      await gameplayProgram.methods
        .createCharacterSecure()
        .accounts({
          metadataProgram: fakeMetadataProgram.programId,
          authority: attacker.publicKey,
        })
        .signers([attacker])
        .rpc()
    } catch (error) {
      expect(error)
      console.log(error)
    }
})
```

Ejecuta el **anchor test** si aún no lo has hecho. Fíjate que se lanzó un error como se esperaba, detallando que el ID del programa pasado a la instrucción no es el ID de programa esperado:

```Rust
'Program log: AnchorError caused by account: metadata_program. Error Code: InvalidProgramId. Error Number: 3008. Error Message: Program ID was not as expected.',
'Program log: Left:',
'Program log: FKBWhshzcQa29cCyaXc1vfkZ5U985gD5YsqfCzJYUBr',
'Program log: Right:',
'Program log: D4hPnYEsAx4u3EQMrKEXsY3MkfLndXbBKTEYTwwm25TE'
```

¡Eso es todo lo que necesitas hacer para protegerte contra CPIs arbitrarias!

Puede haber momentos en los que desees más flexibilidad en tus CPIs de programación. Ciertamente no te detendremos a la hora de diseñar el programa que necesitas, pero por favor, toma todas las precauciones posibles para asegurar que no haya vulnerabilidades en tu programa.

Si deseas ver el código de la solución final, puedes encontrarlo en la rama de **solution** del mismo [repositorio](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/solution).

# Reto

Al igual que con otras lecciones de este módulo, tu oportunidad de practicar evitando esta explotación de seguridad radica en auditar tus propios programas o los de otras personas.

Tómate un tiempo para revisar al menos un programa y asegúrate de que existen comprobaciones de programa en cada programa pasado a las instrucciones, especialmente aquellos que se invocan a través de CPI.

Recuerda, si encuentras un error o explotación en el programa de alguien más, ¡notifícalo! Si encuentras uno en tu propio programa, asegúrate de solucionarlo de inmediato.

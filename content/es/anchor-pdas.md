---
title: Anclar los PDA y los objetivos de las cuentas
objectives:
- Utilice las `bump` restricciones `seeds` y para trabajar con cuentas PDA en Anchor
- Habilitar y usar la `init_if_needed` restricción
- Utilice la `realloc` restricción para reasignar espacio en una cuenta existente
- Utilice la `close` restricción para cerrar una cuenta existente
---

# TL;DR

-   Las `bump` restricciones `seeds` and se utilizan para inicializar y validar cuentas PDA en Anchor
-   La `init_if_needed` restricción se utiliza para inicializar condicionalmente una nueva cuenta.
-   La `realloc` restricción se utiliza para reasignar espacio en una cuenta existente
-   La `close` restricción se utiliza para cerrar una cuenta y reembolsar su alquiler

# Descripción general

En esta lección, aprenderá cómo trabajar con PDA, reasignar cuentas y cerrar cuentas en Anchor.

Recuerde que los programas de anclaje separan la lógica de instrucción de la validación de la cuenta. La validación de cuentas ocurre principalmente dentro de estructuras que representan la lista de cuentas necesarias para una instrucción dada. Cada campo de la estructura representa una cuenta diferente, y puede personalizar la validación realizada en la cuenta utilizando la macro de `#[account(...)]` atributos.

Además de usar restricciones para la validación de cuentas, algunas restricciones pueden manejar tareas repetibles que de otro modo requerirían una gran cantidad de repeticiones dentro de nuestra lógica de instrucciones. Esta lección presentará las `close` restricciones `seeds` `bump`, `realloc`, y para ayudarlo a inicializar y validar PDA, reasignar cuentas y cerrar cuentas.

## PDAs con Ancla

Recuerde que [PDAs](https://github.com/Unboxed-Software/solana-course/blob/main/content/pda) se derivan utilizando una lista de semillas opcionales, una semilla de bump y un ID de programa. Anchor proporciona una forma conveniente de validar un PDA con las `bump` restricciones `seeds` and.

```rust
#[derive(Accounts)]
struct ExampleAccounts {
  #[account(
    seeds = [b"example_seed"],
    bump
  )]
  pub pda_account: Account<'info, AccountType>,
}
```

Durante la validación de la cuenta, Anchor derivará una PDA utilizando las semillas especificadas en la `seeds` restricción y verificará que la cuenta pasada a la instrucción coincida con la PDA encontrada utilizando la especificada `seeds`.

Cuando se incluye la `bump` restricción sin especificar un bache específico, Anchor usará por defecto el bache canónico (el primer bache que da como resultado un PDA válido). En la mayoría de los casos, debe usar la protuberancia canónica.

Puede acceder a otros campos desde dentro de la estructura desde las restricciones, por lo que puede especificar las semillas que dependen de otras cuentas, como la clave pública del firmante.

También puede hacer referencia a los datos de instrucción deserializados si añade la macro de `#[instruction(...)]` atributo a la estructura.

Por ejemplo, el siguiente ejemplo muestra una lista de cuentas que incluyen `pda_account` y `user`. El `pda_account` está restringido de tal manera que las semillas deben ser la cadena "example_seed", la clave pública de `user`, y la cadena pasada a la instrucción como `instruction_data`.

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct Example<'info> {
    #[account(
        seeds = [b"example_seed", user.key().as_ref(), instruction_data.as_ref()],
        bump
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>
}
```

Si la `pda_account` dirección proporcionada por el cliente no coincide con la PDA derivada utilizando las semillas especificadas y el bache canónico, entonces la validación de la cuenta fallará.

### Usar PDA con la `init` restricción

Puede combinar las `bump` restricciones `seeds` y con la `init` restricción para inicializar una cuenta utilizando un PDA.

Recuerde que la `init` restricción debe usarse en combinación con las `space` restricciones `payer` and para especificar la cuenta que pagará la inicialización de la cuenta y el espacio para asignar a la nueva cuenta. Además, debe incluir `system_program` como uno de los campos de la estructura de validación de cuenta.

```rust
#[derive(Accounts)]
pub struct InitializePda<'info> {
    #[account(
        init,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + 8
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: u64,
}
```

Cuando se usa `init`  para cuentas que no son PDA, Anchor establece por defecto que el propietario de la cuenta inicializada sea el programa que actualmente ejecuta la instrucción.

Sin embargo, cuando se utiliza `init` en combinación con `seeds` and `bump`, el propietario _debe_ es el programa en ejecución. Esto se debe a que la inicialización de una cuenta para el PDA requiere una firma que solo el programa en ejecución puede proporcionar. En otras palabras, la verificación de firma para la inicialización de la cuenta de PDA fallaría si el ID de programa usado para derivar el PDA no coincidiera con el ID de programa del programa en ejecución.

Al determinar el valor de `space` para una cuenta inicializada y propiedad del programa Ancla en ejecución, recuerde que los primeros 8 bytes están reservados para el discriminador de cuenta. Este es un valor de 8 bytes que Anchor calcula y utiliza para identificar los tipos de cuenta del programa. Puede usar esto [reference](https://www.anchor-lang.com/docs/space) para calcular cuánto espacio debe asignar para una cuenta.

### Inferencia de semillas

La lista de cuentas para una instrucción puede ser muy larga para algunos programas. Para simplificar la experiencia del lado del cliente al invocar una instrucción del programa Anchor, podemos activar la inferencia semilla.

La inferencia de semilla agrega información sobre las semillas de PDA al IDL para que Anchor pueda inferir las semillas de PDA a partir de la información existente del sitio de llamada. En el ejemplo anterior, las semillas son `b"example_seed"` y `user.key()`. El primero es estático y por lo tanto conocido, y el segundo es conocido porque `user` es el firmante de la transacción.

Si usa la inferencia semilla al construir su programa, siempre y cuando esté llamando al programa usando Anchor, no necesita derivar y pasar explícitamente el PDA. En cambio, la biblioteca de Anchor lo hará por ti.

Puede activar la inferencia de semilla en el `Anchor.toml` archivo con `seeds = true` debajo `[features]`.

```
[features]
seeds = true
```

### Usar la macro `#[instruction(...)]` de atributos

Veamos brevemente la macro de `#[instruction(...)]` atributos antes de continuar. Al usar `#[instruction(...)]`, los datos de instrucción que proporcione en la lista de argumentos deben coincidir y estar en el mismo orden que los argumentos de instrucción. Puede omitir los argumentos no utilizados al final de la lista, pero debe incluir todos los argumentos hasta el último que utilizará.

Por ejemplo, imagina que una instrucción tiene argumentos `input_one` `input_two`, y `input_three`. Si las restricciones de su cuenta necesitan hacer referencia a `input_one` y `input_three`, debe enumerar los tres argumentos en la macro de `#[instruction(...)]` atributos.

Sin embargo, si sus restricciones solo hacen referencia a `input_one` y `input_two`, puede omitir `input_three`.

```rust
pub fn example_instruction(
    ctx: Context<Example>,
    input_one: String,
    input_two: String,
    input_three: String,
) -> Result<()> {
    ...
    Ok(())
}

#[derive(Accounts)]
#[instruction(input_one:String, input_two:String)]
pub struct Example<'info> {
    ...
}
```

Además, obtendrá un error si enumera las entradas en el orden incorrecto:

```rust
#[derive(Accounts)]
#[instruction(input_two:String, input_one:String)]
pub struct Example<'info> {
    ...
}
```

## Iniciar si es necesario

Anchor proporciona una `init_if_needed` restricción que se puede usar para inicializar una cuenta si la cuenta aún no se ha inicializado.

Esta característica está bloqueada detrás de una bandera de características para asegurarse de que es intencional sobre su uso. Por razones de seguridad, es inteligente evitar tener una rama de instrucción en múltiples rutas lógicas. Y como su nombre indica, `init_if_needed` ejecuta una de las dos posibles rutas de código dependiendo del estado de la cuenta en cuestión.

Al usarlo `init_if_needed`, debe asegurarse de proteger adecuadamente su programa contra los ataques de reinicialización. Debe incluir comprobaciones en su código que comprueben que la cuenta inicializada no se puede restablecer a su configuración inicial después de la primera vez que se inicializó.

Para usarlo `init_if_needed`, primero debe habilitar la función en `Cargo.toml`.

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
```

Una vez que haya habilitado la función, puede incluir la restricción en la macro de `#[account(…)]` atributos. El siguiente ejemplo demuestra el uso de la `init_if_needed` restricción para inicializar una nueva cuenta de token asociada si aún no existe.

```rust
#[program]
mod example {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
     #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
```

Cuando se invoca la `initialize` instrucción en el ejemplo anterior, Anchor comprobará si `token_account` existe e inicializará si no existe. Si ya existe, entonces la instrucción continuará sin inicializar la cuenta. Al igual que con la `init` restricción, puede usar `init_if_needed` junto con `seeds` y `bump` si la cuenta es un PDA.

## Realloc

La `realloc` restricción proporciona una forma sencilla de reasignar espacio para las cuentas existentes.

La `realloc` restricción debe utilizarse en combinación con las siguientes restricciones:

-   `mut` - la cuenta debe configurarse como mutable
-   `realloc::payer` - la cuenta a restar o añadir lamports dependiendo de si la reasignación está disminuyendo o aumentando el espacio de la cuenta
-   `realloc::zero` - booleano para especificar si la nueva memoria debe inicializarse a cero

Al igual que con `init`, debe incluir `system_program` como una de las cuentas en la estructura de validación de cuenta al usar `realloc`.

A continuación se muestra un ejemplo de reasignación de espacio para una cuenta que almacena un `data` campo de tipo `String`.

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct ReallocExample<'info> {
    #[account(
        mut,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        realloc = 8 + 4 + instruction_data.len(),
        realloc::payer = user,
        realloc::zero = false,
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: String,
}
```

Observe que `realloc` está configurado en `8 + 4 + instruction_data.len()`. Esto se desglosa de la siguiente manera:

-   `8` es para el discriminador de cuentas
-   `4` es para los 4 bytes de espacio que BORSH utiliza para almacenar la longitud de la cadena
-   `instruction_data.len()` es la longitud de la cuerda en sí

Si el cambio en la longitud de los datos de la cuenta es aditivo, las lámparas se transferirán de la  `realloc::payer`  a la cuenta para mantener la exención de alquiler. Asimismo, si el cambio es sustractivo, los lamports se transferirán de la cuenta de vuelta a la `realloc::payer`.

La  `realloc::zero`  restricción es necesaria para determinar si la nueva memoria debe inicializarse a cero después de la reasignación. Esta restricción debe establecerse en true en los casos en que espere que la memoria de una cuenta se reduzca y expanda varias veces. De esa manera se pone a cero el espacio que de otro modo se mostraría como datos obsoletos.

## Cerrar

La `close` restricción proporciona una forma simple y segura de cerrar una cuenta existente.

La `close` restricción marca la cuenta como cerrada al final de la ejecución de la instrucción estableciendo su discriminador en  `CLOSED_ACCOUNT_DISCRIMINATOR` y envía sus lamports a una cuenta específica. Establecer el discriminador en una variante especial hace que los ataques de reactivación de la cuenta (donde una instrucción posterior agrega las lámparas de exención de alquiler nuevamente) sean imposibles. Si alguien intenta reinicializar la cuenta, la reinicialización fallará la verificación del discriminador y será considerada inválida por el programa.

El siguiente ejemplo utiliza la `close` restricción para cerrar el `data_account` y envía los lamports asignados para alquiler a la `receiver` cuenta.

```rust
pub fn close(ctx: Context<Close>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, AccountType>,
    #[account(mut)]
    pub receiver: Signer<'info>
}
```

# Demostración

Practiquemos los conceptos que hemos repasado en esta lección creando un programa de revisión de películas utilizando el marco de Anchor.

Este programa permitirá a los usuarios:

-   Utilice un PDA para inicializar una nueva cuenta de revisión de películas para almacenar la revisión
-   Actualizar el contenido de una cuenta de revisión de películas existente
-   Cerrar una cuenta de revisión de películas existente

### 1. Crear un nuevo proyecto de anclaje

Para empezar, vamos a crear un nuevo proyecto usando `anchor init`.

```console
anchor init anchor-movie-review-program
```

A continuación, vaya al `lib.rs` archivo dentro de la `programs` carpeta y verá el siguiente código de inicio.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
```

Siga adelante y elimine la `initialize` instrucción y `Initialize` escriba.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}
```

### 2. `MovieAccountState`

Primero, usemos la macro de `#[account]` atributos para definir la `MovieAccountState` que representará la estructura de datos de las cuentas de revisión de películas. Como recordatorio, la macro de `#[account]` atributos implementa varios rasgos que ayudan con la serialización y deserialización de la cuenta, establece el discriminador para la cuenta y establece el propietario de una nueva cuenta como el ID de programa definido en la `declare_id!` macro.

Dentro de cada cuenta de revisión de películas, almacenaremos lo siguiente:

-   `reviewer` - usuario que crea la reseña
-   `rating` - Valoración de la película
-   `title` Título de la película
-   `description` - contenido de la revisión

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}

#[account]
pub struct MovieAccountState {
    pub reviewer: Pubkey,    // 32
    pub rating: u8,          // 1
    pub title: String,       // 4 + len()
    pub description: String, // 4 + len()
}
```

### 3. Añadir reseña de película

A continuación, vamos a implementar la `add_movie_review` instrucción. La `add_movie_review` instrucción requerirá un `Context` tipo `AddMovieReview` que implementaremos en breve.

La instrucción requerirá tres argumentos adicionales como datos de instrucción proporcionados por un revisor:

-   `title` El título de la película como `String`
-   `description` - detalles de la revisión como `String`
-   `rating` - Clasificación de la película como `u8`

Dentro de la lógica de instrucción, rellenaremos los datos de la nueva `movie_review` cuenta con los datos de instrucción. También estableceremos el `reviewer` campo como la `initializer` cuenta del contexto de instrucción.

```rust
#[program]
pub mod movie_review{
    use super::*;

    pub fn add_movie_review(
        ctx: Context<AddMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("Movie Review Account Created");
        msg!("Title: {}", title);
        msg!("Description: {}", description);
        msg!("Rating: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.reviewer = ctx.accounts.initializer.key();
        movie_review.title = title;
        movie_review.rating = rating;
        movie_review.description = description;
        Ok(())
    }
}
```

A continuación, vamos a crear la `AddMovieReview` estructura que usamos como genérico en el contexto de la instrucción. Esta estructura enumerará las cuentas que requiere la `add_movie_review` instrucción.

Recuerda, necesitarás las siguientes macros:

-   La `#[derive(Accounts)]` macro se utiliza para deserializar y validar la lista de cuentas especificadas dentro de la estructura
-   La macro de `#[instruction(...)]` atributo se utiliza para acceder a los datos de instrucción pasados a la instrucción
-   A continuación, la macro de `#[account(...)]` atributos especifica restricciones adicionales en las cuentas.

La `movie_review` cuenta es un PDA que debe inicializarse, por lo que agregaremos las `bump` restricciones `seeds` y, así como la `init` restricción con sus `space` restricciones `payer` y requisitos.

Para las semillas de PDA, usaremos el título de la película y la clave pública del revisor. El pagador de la inicialización debe ser el revisor, y el espacio asignado en la cuenta debe ser suficiente para el discriminador de la cuenta, la clave pública del revisor y la calificación, el título y la descripción de la revisión de la película.

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct AddMovieReview<'info> {
    #[account(
        init,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 + 1 + 4 + title.len() + 4 + description.len()
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Actualizar reseña de la película

A continuación, vamos a implementar la `update_movie_review` instrucción con un contexto cuyo tipo genérico es `UpdateMovieReview`.

Al igual que antes, la instrucción requerirá tres argumentos adicionales como datos de instrucción proporcionados por un revisor:

-   `title` Título de la película
-   `description` - detalles de la revisión
-   `rating` - Valoración de la película

Dentro de la lógica de instrucciones actualizaremos la `rating` y `description` almacenaremos en la `movie_review` cuenta.

Si bien el `title` no se utiliza en la función de instrucción en sí, lo necesitaremos para la validación de la cuenta `movie_review` en el siguiente paso.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn update_movie_review(
        ctx: Context<UpdateMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("Movie review account space reallocated");
        msg!("Title: {}", title);
        msg!("Description: {}", description);
        msg!("Rating: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.rating = rating;
        movie_review.description = description;

        Ok(())
    }

}
```

A continuación, vamos a crear la `UpdateMovieReview` estructura para definir las cuentas que la `update_movie_review` instrucción necesita.

Dado que la `movie_review` cuenta ya habrá sido inicializada en este punto, ya no necesitamos la `init` restricción. Sin embargo, dado que el valor de ahora `description` puede ser diferente, necesitamos usar la `realloc` restricción para reasignar el espacio en la cuenta. Acompañando esto, necesitamos el `mut`, `realloc::payer`, y `realloc::zero` restricciones.

También seguiremos necesitando `seeds` las `bump` limitaciones como las teníamos `AddMovieReview`.

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct UpdateMovieReview<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        realloc = 8 + 32 + 1 + 4 + title.len() + 4 + description.len(),
        realloc::payer = initializer,
        realloc::zero = true,
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

Tenga en cuenta que la `realloc` restricción se establece en el nuevo espacio requerido por la `movie_review` cuenta en función del valor actualizado de `description`.

Además, la `realloc::payer` restricción especifica que cualquier lamport adicional requerido o reembolsado provendrá de o se enviará a la `initializer` cuenta.

Finalmente, establecemos la `realloc::zero` restricción `true` porque la `movie_review` cuenta puede actualizarse varias veces, ya sea reduciendo o expandiendo el espacio asignado a la cuenta.

### 5. Eliminar reseña de película

Por último, vamos a implementar la `delete_movie_review` instrucción de cerrar una `movie_review` cuenta existente.

Usaremos un contexto cuyo tipo genérico es `DeleteMovieReview` y no incluirá ningún dato de instrucción adicional. Dado que solo estamos cerrando una cuenta, en realidad no necesitamos ninguna lógica de instrucción dentro del cuerpo de la función. El cierre en sí será manejado por la restricción Anchor en el `DeleteMovieReview` tipo.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn delete_movie_review(_ctx: Context<DeleteMovieReview>, title: String) -> Result<()> {
        msg!("Movie review for {} deleted", title);
        Ok(())
    }

}
```

A continuación, vamos a implementar la `DeleteMovieReview` estructura.

```rust
#[derive(Accounts)]
#[instruction(title: String)]
pub struct DeleteMovieReview<'info> {
    #[account(
        mut,
        seeds=[title.as_bytes(), initializer.key().as_ref()],
        bump,
        close=initializer
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>
}
```

Aquí usamos la `close` restricción para especificar que estamos cerrando la `movie_review` cuenta y que el alquiler debe reembolsarse a la `initializer` cuenta. También incluimos la `seeds` y `bump` las restricciones para la `movie_review` cuenta para la validación. Anchor entonces maneja la lógica adicional requerida para cerrar la cuenta de forma segura.

### 6. Pruebas

¡El programa debería estar listo! Ahora vamos a probarlo. Navegue `anchor-movie-review-program.ts` y reemplace el código de prueba predeterminado con lo siguiente.

Aquí tenemos:

-   Crear valores predeterminados para los datos de instrucción de revisión de película
-   Derivar la cuenta de revisión de películas PDA
-   Crear marcadores de posición para las pruebas

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { AnchorMovieReviewProgram } from "../target/types/anchor_movie_review_program";

describe("anchor-movie-review-program", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace
        .AnchorMovieReviewProgram as Program<AnchorMovieReviewProgram>;

    const movie = {
        title: "Just a test movie",
        description: "Wow what a good movie it was real great",
        rating: 5,
    };

    const [moviePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
        program.programId,
    );

    it("Movie review is added`", async () => {});

    it("Movie review is updated`", async () => {});

    it("Deletes a movie review", async () => {});
});
```

A continuación, vamos a crear la primera prueba para la `addMovieReview` instrucción. Tenga en cuenta que no añadimos explícitamente `.accounts`. Esto se debe a que el `Wallet` de `AnchorProvider` se incluye automáticamente como firmante, Anchor puede inferir ciertas cuentas como `SystemProgram`, y Anchor también puede inferir el `movieReview` PDA a partir del argumento de `title` instrucción y la clave pública del firmante.

Una vez que se ejecuta la instrucción, buscamos la `movieReview` cuenta y comprobamos que los datos almacenados en la cuenta coinciden con los valores esperados.

```typescript
it("Movie review is added`", async () => {
    // Add your test here.
    const tx = await program.methods
        .addMovieReview(movie.title, movie.description, movie.rating)
        .rpc();

    const account = await program.account.movieAccountState.fetch(moviePda);
    expect(movie.title === account.title);
    expect(movie.rating === account.rating);
    expect(movie.description === account.description);
    expect(account.reviewer === provider.wallet.publicKey);
});
```

A continuación, vamos a crear la prueba para la `updateMovieReview` instrucción siguiendo el mismo proceso que antes.

```typescript
it("Movie review is updated`", async () => {
    const newDescription = "Wow this is new";
    const newRating = 4;

    const tx = await program.methods
        .updateMovieReview(movie.title, newDescription, newRating)
        .rpc();

    const account = await program.account.movieAccountState.fetch(moviePda);
    expect(movie.title === account.title);
    expect(newRating === account.rating);
    expect(newDescription === account.description);
    expect(account.reviewer === provider.wallet.publicKey);
});
```

A continuación, cree la prueba para la `deleteMovieReview` instrucción

```typescript
it("Deletes a movie review", async () => {
    const tx = await program.methods.deleteMovieReview(movie.title).rpc();
});
```

Por último, ejecute `anchor test` y debería ver la siguiente salida en la consola.

```console
  anchor-movie-review-program
    ✔ Movie review is added` (139ms)
    ✔ Movie review is updated` (404ms)
    ✔ Deletes a movie review (403ms)


  3 passing (950ms)
```

Si necesitas más tiempo con este proyecto para sentirte cómodo con estos conceptos, siéntete libre de echar un vistazo [código de solución](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas)  antes de continuar.

# Desafío

Ahora es tu turno de construir algo de forma independiente. Equipado con los conceptos introducidos en esta lección, intente recrear el programa Student Intro que hemos utilizado antes de usar el marco de Anchor.

El programa Student Intro es un programa de Solana que permite a los estudiantes presentarse. El programa toma el nombre de un usuario y un mensaje corto como los datos de instrucción y crea una cuenta para almacenar los datos en la cadena.

Usando lo que has aprendido en esta lección, desarrolla este programa. El programa debe incluir instrucciones para:

1. Inicializar una cuenta PDA para cada estudiante que almacene el nombre del estudiante y su mensaje corto
2. Actualizar el mensaje en una cuenta existente
3. Cerrar una cuenta existente

¡Intenta hacerlo de forma independiente si puedes! Pero si te quedas atascado, siéntete libre de hacer referencia a la[código de solución](https://github.com/Unboxed-Software/anchor-student-intro-program).

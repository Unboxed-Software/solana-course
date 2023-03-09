# Anchor PDAS y cuentas

## Objetivos de la Lección

_Al final de esta lección, podrás:_

- Usar las **seeds** y las restricciones de **bump** para trabajar con cuentas PDA en Anchor
- Habilitar y utilizar la restricción **init_if_needed**
- Usar la restricción **realloc** para reasignar space en una cuenta existente
- Usar la restricción **close** para cerrar una cuenta existente

# Terminología

- Las **seeds** y las restricciones de **bump** se utilizan para inicializar y validar cuentas PDA en Anchor
- La restricción **init_if_needed** se utiliza para inicializar una nueva cuenta de forma condicional
- La restricción **realloc** se utiliza para reasignar space en una cuenta existente
- La restricción **close** se utiliza para cerrar una cuenta y devolver su alquiler.

# Resumen

En esta lección aprenderás a trabajar con PDAs, reasignar cuentas y cerrar cuentas en Anchor.
Recuerda que los programas de Anchor separan la lógica de las instrucciones de la validación de las cuentas. La validación de cuentas principalmente ocurre dentro de estructuras que representan la lista de cuentas necesarias para una instrucción dada. Cada campo de la estructura representa una cuenta diferente y puedes personalizar la validación realizada en la cuenta utilizando el atributo **#[account(...)]** macro.

Además de utilizar restricciones para la validación de cuentas, algunas restricciones pueden manejar tareas repetitivas que de otra manera requerirían una gran cantidad de lógica dentro de nuestras instrucciones. Esta lección presentará las restricciones **seeds**, **bump**, **realloc** y **close** para ayudarte a inicializar y validar PDAs, reasignar cuentas y cerrar cuentas.

## Cuentas PDA con Anchor

Recuerda que las [PDA](https://github.com/Unboxed-Software/solana-course/blob/main/content/pda.md) se derivan utilizando una lista de seeds opcionales, una semilla de bump y un ID de programa. Anchor proporciona una forma conveniente de validar una PDA con las restricciones de **seeds** y **bump** .

```Rust
#[derive(Accounts)]
struct ExampleAccounts {
  #[account(
    seeds = [b"example_seed"],
    bump
  )]
  pub pda_account: Account<'info, AccountType>,
}
```

Durante la validación de la cuenta, Anchor derivará una PDA utilizando las **seeds** especificadas en la restricción de seeds y verificará que la cuenta pasada a la instrucción coincida con la PDA encontrada utilizando las **seeds** especificadas.

Cuando se incluye la restricción de **bump** sin especificar un bump específico, Anchor utilizará el bump canónico (el primer bump que resulte en una PDA válida). En la mayoría de los casos, deberías usar el bump canónico.

Puedes acceder a otros campos desde dentro de la estructura desde las restricciones, por lo que puedes especificar seeds que dependen de otras cuentas como la clave pública del firmante.

También puedes hacer referencia a los datos de instrucción deserializados si agregas el macro de atributo **#[instruction(...)]** a la estructura.

Por ejemplo, el siguiente ejemplo muestra una lista de cuentas que incluyen **pda_account** y **user** . La cuenta **pda_account** está restringida de tal manera que las seeds deben ser la cadena "example_seed", la clave pública de **user** y la cadena pasada a la instrucción como **instruction_data** .

```Rust
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

Si la dirección **pda_account** proporcionada por el cliente no coincide con la PDA derivada utilizando las seeds especificadas y el bump canónico, entonces la validación de cuenta fallará.

### Usa PDA con la restricción **init**

Puedes combinar las restricciones de **seeds** y **bump** con la restricción **init** para inicializar una cuenta utilizando una PDA.

Recuerda que la restricción **init** debe usarse en combinación con las restricciones de **payer** y **space** para especificar la cuenta que pagará la inicialización de la cuenta y el space que se asignará en la nueva cuenta. Además, debes incluir **system_program** como uno de los campos de la estructura de validación de cuentas.

```Rust
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

Cuando se utiliza **init** para cuentas que no son PDA, Anchor establece por defecto el propietario de la cuenta inicializada como el programa actualmente ejecutando la instrucción.

Sin embargo, al utilizar **init** en combinación con **seeds** y **bump** , el propietario debe ser el programa que se está ejecutando. Esto se debe a que inicializar una cuenta para la PDA requiere una firma que solo el programa en ejecución puede proporcionar. En otras palabras, la verificación de la firma para la inicialización de la cuenta PDA fallaría si el ID de programa utilizado para derivar la PDA no coincidiera con el ID del programa en ejecución.

Al determinar el valor de **space** para una cuenta inicializada y propiedad del programa Anchor en ejecución, recuerda que los primeros 8 bytes están reservados para el discriminador de cuentas. Este es un valor de 8 bytes que Anchor calcula y utiliza para identificar los tipos de cuentas de programas. Puedes usar esta [reference](https://www.anchor-lang.com/docs/space) para calcular cuánto space debes asignar para una cuenta.

### Inferencia de seeds

La lista de cuentas para una instrucción puede volverse muy larga para algunos programas. Para simplificar la experiencia del lado del cliente al invocar una instrucción de programa de Anchor, podemos activar la inferencia de seeds.

La inferencia de seeds agrega información sobre las seeds PDA al IDL para que Anchor pueda inferir las seeds PDA a partir de la información existente del sitio de llamada. En el ejemplo anterior, las seeds son **b"example_seed"** y **user.key()** . La primera es estática y por lo tanto conocida, y la segunda es conocida porque **user** es el firmante de la transacción.

Si utiliza la inferencia de seeds al construir su programa, entonces siempre y cuando esté llamando al programa utilizando Anchor, no necesita derivar y pasar explícitamente la PDA. En cambio, la biblioteca Anchor lo hará por usted.

Puede activar la inferencia de seeds en el archivo **Anchor.toml** con **seeds = true** bajo **[features]**.

```Rust
[features]
seeds = true
```

### Usa el macro de atributo **#[instruction(...)]**

Echemos un vistazo breve al macro de atributo **#[instruction(...)]** antes de seguir adelante. Cuando se utiliza **#[instruction(...)]** , los datos de instrucción que proporciona en la lista de argumentos deben coincidir y estar en el mismo orden que los argumentos de la instrucción. Puede omitir los argumentos no utilizados al final de la lista, pero debe incluir todos los argumentos hasta el último que utilizará.

Por ejemplo, imagine que una instrucción tiene argumentos **input_one** , **input_two** y **input_three** . Si las restricciones de su cuenta necesitan hacer referencia a **input_one** y **input_three** , debe enumerar los tres argumentos en el macro de atributo **#[instruction(...)]** .

Sin embargo, si sus restricciones solo hacen referencia a**input_one** y **input_two**, puede omitir **input_three** .

```Rust
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

Además, recibirá un error si enumera los inputs en el orden incorrecto:

```Rust
#[derive(Accounts)]
#[instruction(input_two:String, input_one:String)]
pub struct Example<'info> {
    ...
}
```

## Init_if_needed

Anchor proporciona una restricción **init_if_needed** que se puede utilizar para inicializar una cuenta si la cuenta no se ha inicializado anteriormente.

Esta característica está detrás de una bandera de características para asegurarse de que es intencional al usarla. Por razones de seguridad, es inteligente evitar que una instrucción se ramifique en varios caminos de lógica. Y como su nombre indica, **init_if_needed** ejecuta uno de dos posibles caminos de código dependiendo del estado de la cuenta en cuestión.

Al usar **init_if_needed** , debe asegurarse de proteger adecuadamente su programa contra ataques de reinicialización. Debe incluir comprobaciones en su código que verifiquen que la cuenta inicializada no puede volver a sus configuraciones iniciales después de la primera vez que se inicializó.

Para utilizar **init_if_needed** , primero debe habilitar la característica en **Cargo.toml** .

```Rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
```

Una vez habilitada la característica, puede incluir la restricción en el macro de atributo **#[account(…)]** . El ejemplo a continuación demuestra cómo utilizar la restricción **init_if_needed** para inicializar una nueva cuenta de token asociada si no existe ya.

```Rust
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

Cuando se invoca la instrucción de **initialize** en el ejemplo anterior, Anchor comprobará si existe la **token_account** e inicializará si no existe. Si ya existe, la instrucción continuará sin inicializar la cuenta. Al igual que con la restricción **init** , puede utilizar **init_if_needed** en conjunto con las **seeds** y el **bump** si la cuenta es un PDA.

## Reasignar

La restricción **realloc** proporciona una forma simple de reasignar space para las cuentas existentes.

La restricción **realloc** debe utilizarse en combinación con las siguientes restricciones:

- **mut** - la cuenta debe establecerse como mutable
- **realloc::payer** - la cuenta para restar o agregar lamports dependiendo de si la reasignación está disminuyendo o aumentando el espacio de la cuenta
- **realloc::zero** - booleano para especificar si la nueva memoria debe inicializarse en cero

Como con **init**, debe incluir **system_program** como una de las cuentas en el struct de validación de cuentas al utilizar **realloc** .

A continuación, se muestra un ejemplo de reasignación de space para una cuenta que almacena un campo de **datos** de tipo **String** .

```Rust
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

Ten en cuenta que **realloc** se establece en **8 + 4 + instruction_data.len()** . Esto se desglosa de la siguiente manera:

- **8** es para el discriminador de cuenta
- **4** es para los 4 bytes de space que BORSH utiliza para almacenar la longitud de la cadena
- **instruction_data.len()** es la longitud de la cadena en sí

Si el cambio en la longitud de los datos de la cuenta es aditivo, se transferirán lamports del **realloc::payer** a la cuenta para mantener la exención de alquiler. Del mismo modo, si el cambio es subtrativo, los lamports se transferirán de la cuenta de nuevo al **realloc::payer** .

La restricción **realloc::zero** es necesaria para determinar si la nueva memoria debe inicializarse en cero después de la reasignación. Esta restricción debe establecerse en true en los casos en que se espera que la memoria de una cuenta se contraiga y se expanda varias veces. De esa manera, se limpia el space que de otra manera aparecería como datos antiguos.

## Cierre

La restricción de **close** proporciona una forma sencilla y segura de cerrar una cuenta existente.
La restricción de **close** marca la cuenta como cerrada al final de la ejecución de la instrucción, estableciendo su discriminador en el **CLOSED_ACCOUNT_DISCRIMINATOR** y enviando sus lamports a una cuenta especificada. Establecer el discriminador en una variante especial hace imposible los ataques de revivificación de cuenta (donde una instrucción posterior agrega los lamports de exención de alquiler nuevamente). Si alguien intenta reinicializar la cuenta, la reinicialización fallará en la verificación de discriminador y será considerada inválida por el programa.

El ejemplo a continuación utiliza la restricción de **close** para cerrar la **data_account** y envía los lamports asignados para el alquiler a la cuenta **receiver** .

```Rust
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

Practiquemos los conceptos que hemos visto en esta lección creando un programa de reseñas de películas utilizando el marco de trabajo Anchor.
Este programa permitirá a los usuarios:

- Utilizar un PDA para inicializar una nueva cuenta de reseña de películas para almacenar la reseña
- Actualizar el contenido de una cuenta de reseña de películas existente
- Cerrar una cuenta de reseña de películas existente

## 1. Crear un nuevo proyecto de Anchor

Para comenzar, creemos un nuevo proyecto utilizando **anchor init** .

```Rust
anchor init anchor-movie-review-program
```

A continuación, navegue al archivo **lib.rs** dentro de la carpeta de **programs** y debería ver el siguiente código de inicio.

```Rust
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

Vaya adelante y elimine la instrucción de **initialize** y el tipo de **initialize** .

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}
```

## 2. MovieAccountState

Primero, utilicemos la macro de atributo **#[account]** para definir el **MovieAccountState** que representará la estructura de datos de las cuentas de reseñas de películas. Como recordatorio, la macro de atributo **#[account]** implementa varios rasgos que ayudan con la serialización y deserialización de la cuenta, establece el discriminador para la cuenta y establece al propietario de una nueva cuenta como el ID del programa definido en la macro **declare_id!** .

Dentro de cada cuenta de reseña de películas, almacenaremos:

- **reviewer** : usuario que crea la reseña
- **rating** : puntuación de la película
- **title** : título de la película
- **description** : contenido de la reseña

```Rust
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

## 3. Agregar reseña de película

A continuación, implementemos la instrucción **add_movie_review** . La instrucción **add_movie_review** requerirá un **Context** de tipo **AddMovieReview** que implementaremos próximamente.

La instrucción requerirá tres argumentos adicionales como datos de instrucción proporcionados por un revisor:

- **title** : título de la película como una **String**
- **description** : detalles de la reseña como una **String**
- **rating** : puntuación de la película como un **u8**

Dentro de la lógica de la instrucción, poblamos los datos de la nueva cuenta de **movie_review** con los datos de la instrucción. También estableceremos el campo **reviewer** como la cuenta de **initializer** del contexto de la instrucción.

```Rust
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

A continuación, creemos el struct **AddMovieReview** que utilizamos como genérico en el contexto de la instrucción. Este struct enumerará las cuentas que requiere la instrucción **add_movie_review** .

Recuerde, necesitará las siguientes macros:

- La macro **#[derive(Accounts)]** se utiliza para deserializar y validar la lista de cuentas especificadas dentro del struct.
- La macro de atributo **#[instruction(...)]** se utiliza para acceder a los datos de instrucción pasados a la instrucción.
- La macro de atributo **#[account(...)]** luego especifica restricciones adicionales en las cuentas.

La cuenta **movie_review** es un PDA que necesita ser inicializada, así que agregaremos las **seeds** y las restricciones de **bump** , así como la restricción de **init** con sus restricciones de **payer** y **space** requeridas.

Para las seeds PDA, usaremos el título de la película y la clave pública del revisor. El payer de la inicialización debería ser el revisor, y el space asignado en la cuenta debería ser suficiente para el discriminador de la cuenta, la clave pública del revisor y la puntuación, el título y la descripción de la reseña de películas.

```Rust
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

## 4. Actualizar reseña de película

A continuación, implementemos la instrucción **update_movie_review** con un contexto cuyo tipo genérico es **UpdateMovieReview** .

Al igual que antes, la instrucción requerirá tres argumentos adicionales como datos de instrucción proporcionados por un revisor:

- **title**: título de la película
- **description** : detalles de la reseña
- **rating** : puntuación de la película

Dentro de la lógica de la instrucción, actualizaremos la **rating** y la **description** almacenadas en la cuenta de **movie_review** .

Mientras que el **title** no se utiliza en la función de instrucción en sí, lo necesitaremos para la validación de la cuenta **movie_review** en el siguiente paso.

```Rust
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

A continuación, creemos el struct **UpdateMovieReview** para definir las cuentas que necesita la instrucción **update_movie_review** .

Dado que la cuenta **movie_review** ya se habrá inicializado en este punto, ya no necesitamos la restricción de **init** . Sin embargo, dado que el valor de la **description** puede ser diferente, necesitamos utilizar la restricción de **realloc** para reasignar el space en la cuenta. Acompañando esto, necesitamos las restricciones **mut** , **realloc::payer** y **realloc::zero** .

También seguiremos necesitando las restricciones de **seeds** y **bump** como las tuvimos en **AddMovieReview** .

```Rust
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

Tenga en cuenta que la restricción de **realloc** se establece en el nuevo space requerido por la cuenta **movie_review** según el valor actualizado de la **description**.

Además, la restricción **realloc::payer** especifica que cualquier lamport adicional requerido o reembolsado vendrá de o se enviará a la cuenta de **initializer**.

Finalmente, establecemos la restricción **realloc::zero** en **true** porque la cuenta **movie_review** puede actualizarse varias veces ya sea reduciendo o expandiendo el space asignado a la cuenta.

## 5. Eliminar Revisión de Película

Por último, implementemos la instrucción **delete_movie_review** para cerrar una cuenta existente de **movie_review**.

Usaremos un contexto cuyo tipo genérico es **DeleteMovieReview** y no incluirá ningún dato de instrucción adicional. Como solo estamos cerrando una cuenta, en realidad no necesitamos lógica de instrucción dentro del cuerpo de la función. El cierre en sí mismo será manejado por la restricción de Ancla en el tipo **DeleteMovieReview** .

```Rust
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

Siguiente, implementemos la estructura **DeleteMovieReview**.

```Rust
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

Aquí utilizamos la restricción de **close** para especificar que estamos cerrando la cuenta de **movie_review** y que la renta debe ser reembolsada a la cuenta de **initializer**. También incluimos las restricciones de **seeds** y **bump** para la cuenta de **movie_review** para la validación. Anchor luego maneja la lógica adicional necesaria para cerrar la cuenta de manera segura.

## 6. Pruebas

¡El programa debería estar listo para usar! Ahora vamos a probarlo. Navegue a **anchor-movie-review-program.ts** y reemplace el código de prueba predeterminado con lo siguiente.

Aquí:

- Creamos valores predeterminados para los datos de instrucción de revisión de películas
- Derivamos la PDA de la cuenta de revisión de películas
- Creamos marcadores de posición para las pruebas.

```Rust
import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { assert, expect } from "chai"
import { AnchorMovieReviewProgram } from "../target/types/anchor_movie_review_program"

describe("anchor-movie-review-program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace
    .AnchorMovieReviewProgram as Program<AnchorMovieReviewProgram>

  const movie = {
    title: "Just a test movie",
    description: "Wow what a good movie it was real great",
    rating: 5,
  }

  const [moviePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  it("Movie review is added`", async () => {})

  it("Movie review is updated`", async () => {})

  it("Deletes a movie review", async () => {})
})
```

A continuación, creemos la primera prueba para la instrucción **addMovieReview** . Tenga en cuenta que no agregamos explícitamente **.accounts** . Esto se debe a que la **Wallet** de **AnchorProvider** se incluye automáticamente como firmante, Anchor puede inferir ciertas cuentas como **SystemProgram** y Anchor también puede inferir la PDA de **movieReview** del argumento de instrucción de **título** y la clave pública del firmante.

Una vez que se ejecuta la instrucción, luego recuperamos la cuenta de **movieReview** y verificamos que los datos almacenados en la cuenta coincidan con los valores esperados.

```Rust
it("Movie review is added`", async () => {
  // Add your test here.
  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(movie.title === account.title)
  expect(movie.rating === account.rating)
  expect(movie.description === account.description)
  expect(account.reviewer === provider.wallet.publicKey)
})
```

A continuación, creemos la prueba para la instrucción **updateMovieReview** siguiendo el mismo proceso que antes.

```Rust
it("Movie review is updated`", async () => {
  const newDescription = "Wow this is new"
  const newRating = 4

  const tx = await program.methods
    .updateMovieReview(movie.title, newDescription, newRating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(movie.title === account.title)
  expect(newRating === account.rating)
  expect(newDescription === account.description)
  expect(account.reviewer === provider.wallet.publicKey)
})
```

A continuación, crear la prueba para la instrucción **deleteMovieReview**

```Rust
it("Deletes a movie review", async () => {
  const tx = await program.methods
    .deleteMovieReview(movie.title)
    .rpc()
})
```

Finalmente, ejecute **anchor test** y debería ver la siguiente salida en la consola.

```Rust
anchor-movie-review-program
    ✔ Movie review is added` (139ms)
    ✔ Movie review is updated` (404ms)
    ✔ Deletes a movie review (403ms)


  3 passing (950ms)
```

Si necesita más tiempo con este proyecto para sentirse cómodo con estos conceptos, no dude en echar un vistazo al [código de solución](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas) antes de continuar.

# Desafío

Ahora es su turno de construir algo de forma independiente. Equipado con los conceptos presentados en esta lección, intente recrear el programa Student Intro que hemos usado antes usando el marco Anchor.
El programa Student Intro es un programa Solana que permite a los estudiantes presentarse. El programa toma el nombre de un usuario y un mensaje corto como datos de instrucción y crea una cuenta para almacenar los datos en la cadena.
Utilizando lo que ha aprendido en esta lección, construya este programa. El programa debería incluir instrucciones para:

1. Inicializar una cuenta PDA para cada estudiante que almacene el nombre del estudiante y su mensaje corto
2. Actualizar el mensaje en una cuenta existente
3. Cerrar una cuenta existente
   ¡Intente hacerlo de forma independiente si puede! Pero si se queda atascado, no dude en consultar el [código de solución](https://github.com/Unboxed-Software/anchor-student-intro-program).

---
title: Anclar los objetivos de IPC y Errores.
objectives:
- Haga Invocaciones de Programas Cruzados (CPI) de un programa Anchor
- Utilice la `cpi` función para generar funciones auxiliares para invocar instrucciones en los programas de Anchor existentes
- Usar `invoke` y `invoke_signed` hacer CPI donde las funciones de ayuda de CPI no están disponibles
- Crear y devolver errores de anclaje personalizados
---

# TL;DR

-   Anchor proporciona una forma simplificada de crear IPC utilizando un ** `CpiContext` **
-   La ** `cpi` ** característica de Anchor genera funciones auxiliares de CPI para invocar instrucciones en programas de Anchor existentes
-   Si no tiene acceso a las funciones de CPI Helper, aún puede usar `invoke` `invoke_signed` y
-   La macro de ** `error_code` ** atributos se utiliza para crear errores de anclaje personalizados

# Descripción general

Si piensa en el[primera lección de IPC](cpi), recordará que construir IPC puede ser complicado con vainilla Rust. Sin embargo, Anchor lo hace un poco más simple, especialmente si el programa que está invocando también es un programa de Anchor a cuya caja puede acceder.

En esta lección, aprenderá cómo construir un CPI ancla. También aprenderá cómo lanzar errores personalizados de un programa de Anchor para que pueda comenzar a escribir programas de Anchor más sofisticados.

## Invocaciones cruzadas de programas (CPI) con ancla

Como actualización, los CPI permiten a los programas invocar instrucciones en otros programas que usan las `invoke_signed` funciones `invoke` o. Esto permite que los nuevos programas se construyan sobre los programas existentes (a eso lo llamamos composibilidad).

Si bien hacer CPI directamente usando `invoke` o `invoke_signed` sigue siendo una opción, Anchor también proporciona una forma simplificada de hacer CPI mediante el uso de a `CpiContext`.

En esta lección, usarás la `anchor_spl` caja para hacer CPI para el Programa de tokens SPL. Puedes explorar lo que está disponible en la `anchor_spl` caja[here](https://docs.rs/anchor-spl/latest/anchor_spl/#).

### `CpiContext`

El primer paso para crear un CPI es crear una instancia de `CpiContext`. `CpiContext` es muy similar al primer `Context` tipo de argumento requerido por las funciones de instrucción de Anchor. Ambos se declaran en el mismo módulo y comparten una funcionalidad similar.

El `CpiContext` tipo especifica entradas sin argumento para invocaciones de programas cruzados:

-   `accounts` - la lista de cuentas requeridas para la instrucción que se está invocando
-   `remaining_accounts` - Cuentas restantes
-   `program` - el ID de programa del programa que se está invocando
-   `signer_seeds` - si un PDA está firmando, incluya las semillas necesarias para derivar el PDA

```rust
pub struct CpiContext<'a, 'b, 'c, 'info, T>
where
    T: ToAccountMetas + ToAccountInfos<'info>,
{
    pub accounts: T,
    pub remaining_accounts: Vec<AccountInfo<'info>>,
    pub program: AccountInfo<'info>,
    pub signer_seeds: &'a [&'b [&'c [u8]]],
}
```

Se utiliza `CpiContext::new` para construir una nueva instancia al pasar a lo largo de la firma de transacción original.

```rust
CpiContext::new(cpi_program, cpi_accounts)
```

```rust
pub fn new(
        program: AccountInfo<'info>,
        accounts: T
    ) -> Self {
    Self {
        accounts,
        program,
        remaining_accounts: Vec::new(),
        signer_seeds: &[],
    }
}
```

Se utiliza `CpiContext::new_with_signer` para construir una nueva instancia al firmar en nombre de un PDA para el CPI.

```rust
CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds)
```

```rust
pub fn new_with_signer(
    program: AccountInfo<'info>,
    accounts: T,
    signer_seeds: &'a [&'b [&'c [u8]]],
) -> Self {
    Self {
        accounts,
        program,
        signer_seeds,
        remaining_accounts: Vec::new(),
    }
}
```

### Cuentas CPI

Una de las principales cosas `CpiContext` que simplifica las invocaciones entre programas es que el `accounts` argumento es un tipo genérico que le permite pasar cualquier objeto que adopte los `ToAccountInfos<'info>` rasgos `ToAccountMetas` and.

Estos rasgos se añaden por la macro de `#[derive(Accounts)]` atributos que ha utilizado antes al crear estructuras para representar cuentas de instrucciones. Esto significa que puede usar estructuras similares con `CpiContext`.

Esto ayuda con la organización del código y la seguridad del tipo.

### Invocar una instrucción en otro programa de Anchor

Cuando el programa al que llama es un programa de Anchor con una caja publicada, Anchor puede generar constructores de instrucciones y funciones de ayuda de CPI para usted.

Simplemente declare la dependencia de su programa en el programa al que está llamando en el `Cargo.toml` archivo de su programa de la siguiente manera:

```
[dependencies]
callee = { path = "../callee", features = ["cpi"]}
```

Al añadir `features = ["cpi"]`, habilita la `cpi` función y su programa obtiene acceso al `callee::cpi` módulo.

El `cpi` módulo expone las `callee` instrucciones como una función Rust que toma como argumentos a `CpiContext` y cualquier dato de instrucción adicional. Estas funciones utilizan el mismo formato que las funciones de instrucción en sus programas de Anchor, solo con `CpiContext` en lugar de `Context`. El `cpi` módulo también expone las estructuras de cuentas requeridas para llamar a las instrucciones.

Por ejemplo, si `callee` tiene la instrucción `do_something` que requiere las cuentas definidas en la `DoSomething` estructura, puede invocar de la `do_something` siguiente manera:

```rust
use anchor_lang::prelude::*;
use callee;
...

#[program]
pub mod lootbox_program {
    use super::*;

    pub fn call_another_program(ctx: Context<CallAnotherProgram>, params: InitUserParams) -> Result<()> {
        callee::cpi::do_something(
            CpiContext::new(
                ctx.accounts.callee.to_account_info(),
                callee::DoSomething {
                    user: ctx.accounts.user.to_account_info()
                }
            )
        )
        Ok(())
    }
}
...
```

### Invocar una instrucción en un programa que no sea de Anchor

Cuando el programa al que llama es _no_ un programa de Anchor, hay dos opciones posibles:

1. Es posible que los mantenedores del programa hayan publicado una caja con sus propias funciones de ayuda para llamar a su programa. Por ejemplo, la `anchor_spl` caja proporciona funciones de ayuda que son prácticamente idénticas desde una perspectiva de sitio de llamada a lo que obtendría con el `cpi` módulo de un programa de anclaje. Por ejemplo, puede acuñar usando la [función de `mint_to` ayuda](https://docs.rs/anchor-spl/latest/src/anchor_spl/token.rs.html#36-58) y usar la [estructura de `MintTo` cuentas](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.MintTo.html).

    ```rust
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.mint_account.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[&[
                "mint".as_bytes(),
                &[*ctx.bumps.get("mint_authority").unwrap()],
            ]]
        ),
        amount,
    )?;
    ```

2. Si no hay un módulo de ayuda para el programa cuyas instrucciones necesita invocar, puede volver a usar `invoke` y `invoke_signed`. De hecho, el código fuente de la función `mint_to` auxiliar a la que se hace referencia anteriormente muestra un ejemplo que usamos `invoke_signed` cuando se le da una `CpiContext`. Puede seguir un patrón similar si decide usar una estructura de cuentas y `CpiContext` organizar y preparar su IPC.

    ```rust
    pub fn mint_to<'a, 'b, 'c, 'info>(
        ctx: CpiContext<'a, 'b, 'c, 'info, MintTo<'info>>,
        amount: u64,
    ) -> Result<()> {
        let ix = spl_token::instruction::mint_to(
            &spl_token::ID,
            ctx.accounts.mint.key,
            ctx.accounts.to.key,
            ctx.accounts.authority.key,
            &[],
            amount,
        )?;
        solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.to.clone(),
                ctx.accounts.mint.clone(),
                ctx.accounts.authority.clone(),
            ],
            ctx.signer_seeds,
        )
        .map_err(Into::into)
    }
    ```

## Errores de lanzamiento en Anchor

Estamos lo suficientemente metidos en Anchor en este punto que es importante saber cómo crear errores personalizados.

En última instancia, todos los programas devuelven el mismo tipo de error: [ `ProgramError`](https://docs.rs/solana-program/latest/solana_program/program_error/enum.ProgramError.html). Sin embargo, al escribir un programa con Anchor se puede utilizar `AnchorError` como una abstracción en la parte superior de `ProgramError`. Esta abstracción proporciona información adicional cuando un programa falla, incluyendo:

-   El nombre y el número del error
-   Ubicación en el código donde se lanzó el error
-   La cuenta que violó una restricción

```rust
pub struct AnchorError {
    pub error_name: String,
    pub error_code_number: u32,
    pub error_msg: String,
    pub error_origin: Option<ErrorOrigin>,
    pub compared_values: Option<ComparedValues>,
}
```

Los errores de anclaje se pueden dividir en:

-   Errores internos de anclaje que el marco devuelve desde dentro de su propio código
-   Errores personalizados que el desarrollador puede crear

Puede añadir errores únicos a su programa utilizando el  `error_code` atributo. Simplemente añada este atributo a un `enum` tipo personalizado. A continuación, puede utilizar las variantes de los `enum` como errores en su programa. Además, puede añadir un mensaje de error a cada variante utilizando el `msg` atributo. Los clientes pueden mostrar este mensaje de error si se produce el error.

```rust
#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

Para devolver un error personalizado, puede usar la [error](https://docs.rs/anchor-lang/latest/anchor_lang/prelude/macro.error.html) macro [err](https://docs.rs/anchor-lang/latest/anchor_lang/macro.err.html)  o desde una función de instrucción. Estos agregan información de archivo y línea al error que luego es registrado por Anchor para ayudarlo con la depuración.

```rust
#[program]
mod hello_anchor {
    use super::*;
    pub fn set_data(ctx: Context<SetData>, data: MyAccount) -> Result<()> {
        if data.data >= 100 {
            return err!(MyError::DataTooLarge);
        }
        ctx.accounts.my_account.set_inner(data);
        Ok(())
    }
}

#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

Alternativamente, puede usar la [require](https://docs.rs/anchor-lang/latest/anchor_lang/macro.require.html)  macro para simplificar los errores de devolución. El código anterior se puede refactorizar a lo siguiente:

```rust
#[program]
mod hello_anchor {
    use super::*;
    pub fn set_data(ctx: Context<SetData>, data: MyAccount) -> Result<()> {
        require!(data.data < 100, MyError::DataTooLarge);
        ctx.accounts.my_account.set_inner(data);
        Ok(())
    }
}

#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

# Demostración

Practiquemos los conceptos que hemos repasado en esta lección aprovechando el programa de Revisión de películas de lecciones anteriores.

En esta demostración, actualizaremos el programa para crear tokens para los usuarios cuando envíen una nueva reseña de la película.

### 1. Arranque

Para empezar, utilizaremos el estado final del programa Anchor Movie Review de la lección anterior. Entonces, si acabas de completar esa lección, entonces estás listo y listo para comenzar. Si solo está saltando aquí, no se preocupe, puede descargar el código de inicio[here](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas). Usaremos la  `solution-pdas`  sucursal como punto de partida.

### 2. Añadir dependencias a  `Cargo.toml`

Antes de comenzar, necesitamos habilitar la `init-if-needed` función y agregar la `anchor-spl` caja a las dependencias `Cargo.toml`. Si necesita repasar la `init-if-needed` función, eche un vistazo a la[Lección de PDA y cuentas de anclaje](anchor-pdas).

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
anchor-spl = "0.25.0"
```

### 3. Inicializar token de recompensa

A continuación, navegue `lib.rs` y cree una instrucción para inicializar un nuevo token Mint. Este será el token que se acuña cada vez que un usuario deja una reseña. Tenga en cuenta que no es necesario incluir ninguna lógica de instrucciones personalizada, ya que la inicialización se puede manejar completamente a través de restricciones de Anchor.

```rust
pub fn initialize_token_mint(_ctx: Context<InitializeMint>) -> Result<()> {
    msg!("Token mint initialized");
    Ok(())
}
```

Ahora, implemente el tipo de `InitializeMint` contexto y enumere las cuentas y restricciones que requiere la instrucción. Aquí inicializamos una nueva `Mint` cuenta utilizando un PDA con la cadena "Mint" como semilla. Tenga en cuenta que podemos usar el mismo PDA tanto para la dirección de la `Mint` cuenta como para la autoridad Mint. El uso de un PDA como autoridad de Mint permite a nuestro programa firmar para la acuñación de los tokens.

Para inicializar la `Mint` cuenta, tendremos que incluir el `token_program`, `rent`, y `system_program` en la lista de cuentas.

```rust
#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        seeds = ["mint".as_bytes()],
        bump,
        payer = user,
        mint::decimals = 6,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>
}
```

Puede haber algunas limitaciones por encima de que usted no ha visto todavía. La adición de `mint::decimals` y `mint::authority` junto con `init` asegura que la cuenta se inicializa como un nuevo token Mint con los decimales apropiados y el conjunto de autoridad Mint.

### 4. Error de anclaje

A continuación, vamos a crear un error de anclaje que vamos a utilizar al validar el `rating` pasado a la `update_movie_review` instrucción `add_movie_review` o.

```rust
#[error_code]
enum MovieReviewError {
    #[msg("Rating must be between 1 and 5")]
    InvalidRating
}
```

### 5. Actualizar `add_movie_review` instrucción

Ahora que hemos hecho alguna configuración, actualicemos la `add_movie_review` instrucción y el tipo de `AddMovieReview` contexto para crear tokens para el revisor.

A continuación, actualice el tipo de `AddMovieReview` contexto para añadir las siguientes cuentas:

-   `token_program` - usaremos el Programa de tokens para acuñar tokens
-   `mint` - la cuenta Mint para los tokens que acuñaremos para los usuarios cuando agreguen una reseña de película
-   `token_account` - la cuenta de token asociada para el mencionado `mint` y el revisor
-   `associated_token_program` - necesario porque usaremos la `associated_token` restricción en el `token_account`
-   `rent` - necesario porque estamos usando la `init-if-needed` restricción en el `token_account`

```rust
#[derive(Accounts)]
#[instruction(title: String, description: String)]
pub struct AddMovieReview<'info> {
    #[account(
        init,
        seeds=[title.as_bytes(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 + 1 + 4 + title.len() + 4 + description.len()
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
    // ADDED ACCOUNTS BELOW
    pub token_program: Program<'info, Token>,
    #[account(
        seeds = ["mint".as_bytes()]
        bump,
        mut
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = initializer,
        associated_token::mint = mint,
        associated_token::authority = initializer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>
}
```

Una vez más, algunas de las limitaciones anteriores pueden ser desconocidas para usted. Las `associated_token::authority` restricciones `associated_token::mint` and junto con la `init_if_needed` restricción aseguran que si la cuenta aún no se ha inicializado, se inicializará como una cuenta de token asociada para la Mint y la autoridad especificadas.

A continuación, actualicemos las `add_movie_review` instrucciones para hacer lo siguiente:

-   Compruebe que `rating` es válido. Si no es una valoración válida, devuelva el `InvalidRating` error.
-   Haga un CPI a la `mint_to` instrucción del programa token utilizando la autoridad Mint PDA como firmante. Tenga en cuenta que acuñaremos 10 fichas para el usuario, pero debemos ajustar los decimales de la menta haciéndolo `10*10^6`.

Afortunadamente, podemos usar la `anchor_spl` caja para acceder a funciones y tipos auxiliares como `mint_to` y `MintTo` para construir nuestro CPI en el Token Program. `mint_to` toma un entero `CpiContext` y como argumentos, donde el entero representa el número de tokens a mint. se `MintTo` puede usar para la lista de cuentas que necesita la instrucción mint.

```rust
pub fn add_movie_review(ctx: Context<AddMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Movie review account created");
    msg!("Title: {}", title);
    msg!("Description: {}", description);
    msg!("Rating: {}", rating);

    require!(rating >= 1 && rating <= 5, MovieReviewError::InvalidRating);

    let movie_review = &mut ctx.accounts.movie_review;
    movie_review.reviewer = ctx.accounts.initializer.key();
    movie_review.title = title;
    movie_review.description = description;
    movie_review.rating = rating;

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                authority: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info()
            },
            &[&[
                "mint".as_bytes(),
                &[*ctx.bumps.get("mint").unwrap()]
            ]]
        ),
        10*10^6
    )?;

    msg!("Minted tokens");

    Ok(())
}
```

### 6. Actualizar `update_movie_review` instrucción

Aquí sólo estamos añadiendo el cheque que `rating` es válido.

```rust
pub fn update_movie_review(ctx: Context<UpdateMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Movie review account space reallocated");
    msg!("Title: {}", title);
    msg!("Description: {}", description);
    msg!("Rating: {}", rating);

    require!(rating >= 1 && rating <= 5, MovieReviewError::InvalidRating);

    let movie_review = &mut ctx.accounts.movie_review;
    movie_review.description = description;
    movie_review.rating = rating;

    Ok(())
}
```

### 7. Prueba

¡Esos son todos los cambios que tenemos que hacer en el programa! Ahora, actualicemos nuestras pruebas.

Comience asegurándose de que su `describe` función NAD de importaciones se vea así:

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token"
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

  const [movie_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
  )
...
}
```

Una vez hecho esto, añada una prueba para la `initializeTokenMint` instrucción:

```typescript
it("Initializes the reward token", async () => {
    const tx = await program.methods.initializeTokenMint().rpc();
});
```

Tenga en cuenta que no tuvimos que agregar `.accounts` porque se infiere la llamada, incluida la `mint` cuenta (suponiendo que tenga habilitada la inferencia inicial).

A continuación, actualice la prueba para la `addMovieReview` instrucción. Las principales adiciones son:

1. Para obtener la dirección del token asociado que debe pasar a la instrucción como una cuenta que no se puede inferir
2. Compruebe al final de la prueba que la cuenta de token asociada tiene 10 tokens

```typescript
it("Movie review is added`", async () => {
    const tokenAccount = await getAssociatedTokenAddress(
        mint,
        provider.wallet.publicKey,
    );

    const tx = await program.methods
        .addMovieReview(movie.title, movie.description, movie.rating)
        .accounts({
            tokenAccount: tokenAccount,
        })
        .rpc();

    const account = await program.account.movieAccountState.fetch(movie_pda);
    expect(movie.title === account.title);
    expect(movie.rating === account.rating);
    expect(movie.description === account.description);
    expect(account.reviewer === provider.wallet.publicKey);

    const userAta = await getAccount(provider.connection, tokenAccount);
    expect(Number(userAta.amount)).to.equal((10 * 10) ^ 6);
});
```

Después de eso, ni la prueba `updateMovieReview` ni la prueba para la `deleteMovieReview` necesidad de ningún cambio.

En este punto, ejecute `anchor test` y verá la siguiente salida

```console
anchor-movie-review-program
    ✔ Initializes the reward token (458ms)
    ✔ Movie review is added (410ms)
    ✔ Movie review is updated (402ms)
    ✔ Deletes a movie review (405ms)

  5 passing (2s)
```

Si necesita más tiempo con los conceptos de esta lección o se quedó atascado en el camino, siéntase libre de echar un vistazo a la[código de solución](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-add-tokens). Tenga en cuenta que la solución a esta demostración está en la  `solution-add-tokens`  rama.

# Desafío

Para aplicar lo que ha aprendido sobre los IPC en esta lección, piense en cómo podría incorporarlos al programa Student Intro. Podrías hacer algo similar a lo que hicimos en la demostración aquí y agregar alguna funcionalidad a los tokens Mint a los usuarios cuando se presenten.

¡Intenta hacerlo de forma independiente si puedes! Pero si te quedas atascado, siéntete libre de hacer referencia a esto[código de solución](https://github.com/Unboxed-Software/anchor-student-intro-program/tree/cpi-challenge). Tenga en cuenta que su código puede ser ligeramente diferente al código de la solución dependiendo de su implementación.

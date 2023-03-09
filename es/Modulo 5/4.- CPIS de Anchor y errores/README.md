# CPIS de Anchor y errores

## Objetivos de la Lección

_Al final de esta lección, podrás:_

- Hacer invocaciones de programas cruzados (CPI) desde un programa Anchor
- Utilizar la función **cpi** para generar funciones auxiliares para invocar instrucciones en programas Anchor existentes
- Utilizar **invoke** y **invoke_signed** para realizar CPIs donde las funciones auxiliares de CPI no están disponibles
- Crear y devolver errores personalizados de Anchor

# Terminología

- Anchor ofrece una forma simplificada de crear CPIs utilizando un **CpiContext**
- La función **cpi** de Anchor genera funciones auxiliares de CPI para invocar instrucciones en programas Anchor existentes
- Si no tienes acceso a las funciones auxiliares de CPI, todavía puedes utilizar **invoke** y **invoke_signed** directamente
- El atributo macro **error_code** se utiliza para crear errores personalizados de Anchor.

# Resumen

Si reflexiona sobre la [primera lección de CPI](https://soldev.app/course/cpi.md) , recordará que construir CPIs puede ser complicado con Rust básico. Sin embargo, Anchor lo simplifica un poco, especialmente si el programa que está invocando también es un programa de Anchor cuyo paquete puede acceder.
En esta lección, aprenderá cómo construir una CPI de Anchor. También aprenderá cómo lanzar errores personalizados desde un programa de Anchor para que pueda comenzar a escribir programas de Anchor más sofisticados.

## Invocaciones de programas cruzados (CPIs) con Anchor

Como recordatorio, las CPIs permiten que los programas invoquen instrucciones en otros programas utilizando las funciones **invoke** o **invoke_signed** . Esto permite que los nuevos programas se construyan sobre programas existentes (lo llamamos composibilidad).
Aunque todavía es una opción hacer CPIs directamente utilizando **invoke** o **invoke_signed** , Anchor también proporciona una forma simplificada de hacer CPIs mediante el uso de un **CpiContext** .
En esta lección, utilizará el paquete **anchor_spl** para hacer CPIs al Programa SPL Token. Puede explorar lo que está disponible en el paquete **anchor_spl** [aquí](https://docs.rs/anchor-spl/latest/anchor_spl/#).

### **CpiContext**

El primer paso para hacer una CPI es crear una instancia de **CpiContext**. El **CpiContext** es muy similar al **Context** , el primer tipo de argumento requerido por las funciones de instrucción de Anchor. Ambos están declarados en el mismo módulo y comparten funcionalidades similares.

El tipo **CpiContext** especifica los inputs no argumentales para las invocaciones de programas cruzados:

- **accounts** - la lista de cuentas necesarias para la instrucción que se está invocando
- **remaining_accounts** - cualquier cuenta restante
- **program** - el ID del programa que se está invocando
- **signer_seeds** - si un PDA está firmando, incluir las semillas necesarias para derivar el PDA

```Rust
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

Se utiliza **CpiContext::new** para construir una nueva instancia al pasar la firma original de la transacción.

```Rust
CpiContext::new(cpi_program, cpi_accounts)
```

```Rust
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

Se utiliza **CpiContext::new_with_signer** para construir una nueva instancia al firmar en nombre de un PDA para la CPI."

```Rust
CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds)
```

```Rust
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

Una de las principales cosas sobre **CpiContext** que simplifica las invocaciones de programas cruzados es que el argumento **accounts** es un tipo genérico que le permite pasar cualquier objeto que adopte los traits **ToAccountMetas** y **ToAccountInfos <'info>** .

Estos traits son agregados por el atributo macro **#[derive(Accounts)]** que ha utilizado antes al crear estructuras para representar cuentas de instrucción. Esto significa que puede usar estructuras similares con **CpiContext** .

Esto ayuda con la organización del código y la seguridad de tipos.

### Invocar una instrucción en otro programa de Anchor

Cuando el programa al que está llamando es un programa de Anchor con un paquete publicado, Anchor puede generar constructores de instrucciones y funciones de ayuda de CPI para usted.

Simplemente declare la dependencia de su programa en el programa al que está llamando en el archivo **Cargo.toml** de su programa de la siguiente manera:

```Rust
[dependencies]
callee = { path = "../callee", features = ["cpi"]}
```

Agregando **features = ["cpi"]** , habilita la característica cpi y su programa obtiene acceso al módulo **callee::cpi** .

El módulo **cpi** expone las instrucciones del **callee** como una función de Rust que toma como argumentos un **CpiContext** y cualquier dato de instrucción adicional. Estas funciones utilizan el mismo formato que las funciones de instrucción en sus programas de Anchor, solo con **CpiContext** en lugar de **Context** . El módulo **cpi** también expone las estructuras de cuentas necesarias para llamar a las instrucciones.

Por ejemplo, si el **callee** tiene la instrucción **do_something** que requiere las cuentas definidas en la estructura **DoSomething** , podría invocar **do_something** de la siguiente manera:

```Rust
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

### Invocar una instrucción en un programa no-Anchor

Cuando el programa al que está llamando no es un programa de Anchor, hay dos opciones posibles:

1. Es posible que los responsables del programa hayan publicado un paquete con sus propias funciones de ayuda para llamar a su programa. Por ejemplo, el paquete **anchor_spl** proporciona funciones de ayuda que son virtualmente idénticas desde un punto de vista de llamada a lo que obtendría con el módulo **cpi** de un programa de Anchor. Por ejemplo, puede acuñar con la [función de ayuda **mint_to**](https://docs.rs/anchor-spl/latest/src/anchor_spl/token.rs.html#36-58) y utilizar la [estructura **MintTo**](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.MintTo.html) de cuentas .

```Rust
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

2. Si no hay un módulo de ayuda para el programa cuya instrucción necesita invocar, puede volver a utilizar **invoke** y **invoke_signed** . De hecho, el código fuente de la función de ayuda **mint_to** mencionada anteriormente muestra un ejemplo usando **invoke_signed** cuando se le da un **CpiContext** . Puede seguir un patrón similar si decide usar una estructura de cuentas y **CpiContext** para organizar y preparar su CPI."

```Rust
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

### Lanzar errores en Anchor

Hemos llegado lo suficientemente lejos en Anchor en este punto que es importante saber cómo crear errores personalizados.

En última instancia, todos los programas devuelven el mismo tipo de error: [ProgramError](https://docs.rs/solana-program/latest/solana_program/program_error/enum.ProgramError.html) . Sin embargo, al escribir un programa utilizando Anchor, puede utilizar **AnchorError** como una abstracción sobre **ProgramError** . Esta abstracción proporciona información adicional cuando un programa falla, incluyendo:

- El nombre y número del error
- La ubicación en el código donde se lanzó el error
- La cuenta que violó una restricción

```Rust
pub struct AnchorError {
    pub error_name: String,
    pub error_code_number: u32,
    pub error_msg: String,
    pub error_origin: Option<ErrorOrigin>,
    pub compared_values: Option<ComparedValues>,
}
```

Los errores de Anchor se pueden dividir en:

- Errores internos de Anchor que el marco devuelve desde su propio código
- Errores personalizados que el desarrollador puede crear

Puede agregar errores únicos a su programa utilizando el atributo **error_code** . Simplemente agregue este atributo a un tipo de **enumeración** personalizado. Luego puede usar las variantes de la **enumeración** como errores en su programa. Además, puede agregar un mensaje de error a cada variante utilizando el atributo **msg** . Los clientes pueden mostrar este mensaje de error si ocurre el error."

```Rust
#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

Para devolver un error personalizado, puede utilizar el [err](https://docs.rs/anchor-lang/latest/anchor_lang/macro.err.html) 0 el macro de [error](https://docs.rs/anchor-lang/latest/anchor_lang/prelude/macro.error.html) desde una función de instrucción. Estos agregan información de archivo y línea al error que luego es registrado por Anchor para ayudarlo con el depurado.

```Rust
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

Alternativamente, puede utilizar el macro [require](https://docs.rs/anchor-lang/latest/anchor_lang/macro.require.html) para simplificar el retorno de errores. El código anterior se puede refactorizar de la siguiente manera:

```Rust
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

Practiquemos los conceptos que hemos cubierto en esta lección construyendo sobre el programa Movie Review de las lecciones anteriores.
En esta demostración actualizaremos el programa para acuñar tokens a los usuarios cuando envíen una nueva reseña de películas.

## 1. Inicio

Para comenzar, utilizaremos el estado final del programa Anchor Movie Review de la lección anterior. Entonces, si acaba de completar esa lección, ya está listo y preparado para comenzar. Si acaba de saltar aquí, no se preocupe, puede descargar el código inicial [aquí](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas). Utilizaremos la rama **solution-pdas** como punto de partida.

## 2. Agregar dependencias a **Cargo.toml**

Antes de comenzar, debemos habilitar la característica **init-if-needed** y agregar el paquete **anchor-spl** a las dependencias en**Cargo.toml** . Si necesita repasar la característica **init-if-needed** , eche un vistazo a la [lección Anchor PDAs and Accounts](https://soldev.app/course/anchor-pdas.md) .

```Rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
anchor-spl = "0.25.0"
```

## 3. Inicializar token de recompensa

A continuación, vaya a **lib.rs** y cree una instrucción para inicializar una nueva acuñación de tokens. Este será el token que se acuña cada vez que un usuario deja una reseña. Tenga en cuenta que no necesitamos incluir ninguna lógica de instrucción personalizada ya que la inicialización se puede manejar completamente a través de las restricciones de Anchor.

```Rust
pub fn initialize_token_mint(_ctx: Context<InitializeMint>) -> Result<()> {
    msg!("Token mint initialized");
    Ok(())
}
```

Ahora, implemente el tipo de contexto **InitializeMint** y liste las cuentas y restricciones que requiere la instrucción. Aquí inicializamos una nueva cuenta **Mint** utilizando un PDA con la cadena "mint" como semilla. Tenga en cuenta que podemos utilizar el mismo PDA tanto para la dirección de la cuenta **Mint** como para la autoridad de acuñación. El uso de un PDA como autoridad de acuñación permite que nuestro programa firme para la acuñación de los tokens.

Para inicializar la cuenta **Mint** , necesitaremos incluir el **token_program** , el **rent** y el **system_program** en la lista de cuentas.

```Rust
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

Puede haber algunas restricciones arriba que aún no ha visto. Al agregar **mint::decimals** y **mint::authority** junto con **init** , se garantiza que la cuenta se inicialice como una nueva acuñación de tokens con los decimales y la autoridad de acuñación adecuados establecidos.

## 4. Error de Anchor

A continuación, creemos un error de Anchor que utilizaremos al validar la **rating** pasada a la instrucción **add_movie_review** o **update_movie_review** .

```Rust
#[error_code]
enum MovieReviewError {
    #[msg("Rating must be between 1 and 5")]
    InvalidRating
}
```

## 5.Actualizar la instrucción **add_movie_review**

Ahora que hemos hecho alguna configuración, actualicemos la instrucción **add_movie_review** y el tipo de contexto **AddMovieReview** para acuñar tokens al revisor.

A continuación, actualice el tipo de contexto **AddMovieReview** para agregar las siguientes cuentas:

- **token_program** : utilizaremos el Token Program para acuñar tokens
- **mint** : la cuenta de acuñación para los tokens que acuñaremos a los usuarios cuando agreguen una reseña de películas
- **token_account** : la cuenta de token asociada para el **mint** y revisor mencionados anteriormente
- **associated_token_program** : requerido porque utilizaremos la restricción **associated_token** en la **token_account** .
- **rent** : requerido porque estamos utilizando la restricción **init-if-needed** en la **token_account**

```Rust
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

Nuevamente, algunas de las restricciones anteriores pueden ser desconocidas para usted. Las restricciones **associated_token::mint** y **associated_token::authority** junto con la restricción **init_if_needed** garantizan que si la cuenta no se ha inicializado previamente, se inicializará como una cuenta de token asociada para la acuñación y autoridad especificadas.

A continuación, actualicemos la instrucción **add_movie_review** para hacer lo siguiente:

- Comprobar que la **rating** es válida. Si no es una calificación válida, devuelva el error **InvalidRating** .
- Realizar un CPI a la instrucción **mint_to** del programa token utilizando el PDA de la autoridad de acuñación como firmante. Tenga en cuenta que acuñaremos 10 tokens al usuario, pero debemos ajustar por los decimales de acuñación haciéndolo **10\*10^6** .

Afortunadamente, podemos utilizar el paquete **anchor_spl** para acceder a funciones y tipos de ayuda como **mint_to** y **MintTo** para construir nuestro CPI al Programa Token. **mint_to** toma un **CpiContext** e integer como argumentos, donde el integer representa el número de tokens para acuñar. **MintTo** se puede utilizar para la lista de cuentas que necesita la instrucción de acuñación.

```Rust
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

## 6. Actualizar la instrucción **update_movie_review**

Aquí solo estamos agregando la comprobación de que la **rating** es válida.

```Rust
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

## 7. Prueba

¡Esos son todos los cambios que debemos hacer en el programa! Ahora, actualicemos nuestras pruebas.

Comience asegurándose de que sus importaciones y la función **describe** se vean así:

```Rust
import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
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

Para agregar una prueba para la instrucción **initializeTokenMint** , se deben seguir los siguientes pasos:

```Rust
it("Initializes the reward token", async () => {
    const tx = await program.methods.initializeTokenMint().rpc()
})
```

Toma en cuenta que no tuvimos que agregar **.cuentas** porque se pueden inferir, incluyendo la cuenta de **mint** (suponiendo que ha habilitado la inferencia de semillas).

A continuación, actualice la prueba para la instrucción **addMovieReview** . Los principales agregados son:

1. Obtener la dirección de token asociada que debe pasar a la instrucción como una cuenta que no se puede inferir
2. Comprobar al final de la prueba que la cuenta de token asociada tiene 10 tokens.

```Rust
it("Movie review is added`", async () => {
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    provider.wallet.publicKey
  )

  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .accounts({
      tokenAccount: tokenAccount,
    })
    .rpc()

  const account = await program.account.movieAccountState.fetch(movie_pda)
  expect(movie.title === account.title)
  expect(movie.rating === account.rating)
  expect(movie.description === account.description)
  expect(account.reviewer === provider.wallet.publicKey)

  const userAta = await getAccount(provider.connection, tokenAccount)
  expect(Number(userAta.amount)).to.equal((10 * 10) ^ 6)
})
```

Después de eso, ni la prueba de **updateMovieReview** ni la prueba de **deleteMovieReview** necesitan cambios.

En este punto, ejecute la **anchor test** y debería ver la siguiente salida

```Rust
anchor-movie-review-program
    ✔ Initializes the reward token (458ms)
    ✔ Movie review is added (410ms)
    ✔ Movie review is updated (402ms)
    ✔ Deletes a movie review (405ms)

  5 passing (2s)
```

Si necesitas más tiempo con los conceptos de esta lección o te quedaste atascado en el camino, no dudes en echar un vistazo al [código de solución](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-add-tokens). Tenga en cuenta que la solución para esta demostración está en la rama **solution-add-tokens** .

# Desafío

Para aplicar lo que has aprendido sobre CPIs en esta lección, piensa en cómo podrías incorporarlos en el programa de introducción de estudiantes. Podrías hacer algo similar a lo que hicimos en la demostración aquí y agregar alguna funcionalidad para crear tokens para los usuarios cuando se presentan.
¡Intenta hacerlo independientemente si puedes! Pero si te quedas atascado, no dudes en consultar este [código de solución](https://github.com/Unboxed-Software/anchor-student-intro-program/tree/cpi-challenge). Tenga en cuenta que su código puede verse ligeramente diferente al código de solución dependiendo de su implementación.

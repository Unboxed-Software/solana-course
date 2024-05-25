---
title: CPI et Erreurs dans Anchor
objectives:
- Effectuer des Invocations Interprogrammes (CPI) à partir d'un programme Anchor
- Utiliser la fonction `cpi` pour générer des fonctions d'aide pour invoquer des instructions sur des programmes Anchor existants
- Utiliser `invoke` et `invoke_signed` pour effectuer des CPI lorsque les fonctions d'aide de CPI ne sont pas disponibles
- Créer et renvoyer des erreurs personnalisées Anchor
---

# Résumé

- Anchor offre une manière simplifiée de créer des CPI en utilisant un **`CpiContext`**
- La fonction **`cpi`** d'Anchor génère des fonctions d'aide pour invoquer des instructions sur des programmes Anchor existants
- Si vous n'avez pas accès aux fonctions d'aide de CPI, vous pouvez toujours utiliser `invoke` et `invoke_signed` directement
- La macro **`error_code`** est utilisée pour créer des erreurs personnalisées Anchor

# Aperçu général

Si vous vous souvenez de la [première leçon sur les CPI](cpi), vous vous rappellerez que la construction des CPI peut devenir délicate avec en Rust pure. Anchor simplifie un peu les choses, surtout si le programme que vous invoquez est également un programme Anchor dont vous pouvez accéder à la crate.

Dans cette leçon, vous apprendrez comment construire une CPI avec Anchor. Vous apprendrez également comment générer des erreurs personnalisées à partir d'un programme Anchor afin de pouvoir écrire des programmes Anchor plus sophistiqués.

## Invocations Interprogrammes (CPI) avec Anchor

En guise de rappel, les CPI permettent aux programmes d'invoquer des instructions sur d'autres programmes en utilisant les fonctions `invoke` ou `invoke_signed`. Cela permet à de nouveaux programmes de s'appuyer sur des programmes existants (nous appelons cela la composabilité).

Bien que faire des CPI directement avec `invoke` ou `invoke_signed` soit toujours une option, Anchor offre également une manière simplifiée de faire des CPI en utilisant un `CpiContext`.

Dans cette leçon, vous utiliserez la crate `anchor_spl` pour faire des CPI vers le programme SPL Token. Vous pouvez [explorer ce qui est disponible dans la crate `anchor_spl`](https://docs.rs/anchor-spl/latest/anchor_spl/#).

### `CpiContext`

La première étape pour faire une CPI est de créer une instance de `CpiContext`. `CpiContext` est très similaire à `Context`, le type d'argument requis en premier lieu par les fonctions d'instruction Anchor. Ils sont tous deux déclarés dans le même module et partagent des fonctionnalités similaires.

Le type `CpiContext` spécifie les entrées sans argument pour les invocations interprogrammes :

- `accounts` - la liste des comptes requis pour l'instruction invoquée
- `remaining_accounts` - tout compte restant
- `program` - l'ID du programme invoqué
- `signer_seeds` - si une PDA signe, inclure les seeds nécessaires pour dériver la PDA

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

On utilise `CpiContext::new` pour construire une nouvelle instance lors du passage de la signature originale de la transaction.

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

On utilise `CpiContext::new_with_signer` pour construire une nouvelle instance lors de la signature au nom d'une PDA pour la CPI.

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

### Comptes CPI

Une des principales choses à propos de `CpiContext` qui simplifie les invocations interprogrammes est que l'argument `accounts` est un type générique qui vous permet de passer n'importe quel objet qui adopte les traits `ToAccountMetas` et `ToAccountInfos<'info>`.

Ces traits sont ajoutés par l'attribut macro `#[derive(Accounts)]` que vous avez déjà utilisé lorsque vous créez des structures pour représenter les comptes d'instruction. Cela signifie que vous pouvez utiliser des structures similaires avec `CpiContext`.

Cela aide à l'organisation du code et à la sécurité des types.

### Invoquer une instruction sur un autre programme Anchor

Lorsque le programme que vous appelez est un programme Anchor avec une crate publiée, Anchor peut générer des constructeurs d'instructions et des fonctions d'aide pour vous.

Déclarez simplement la dépendance de votre programme sur le programme que vous appelez dans le fichier `Cargo.toml` de votre programme comme suit :

```
[dependencies]
callee = { path = "../callee", features = ["cpi"]}
```

En ajoutant `features = ["cpi"]`, vous activez la fonctionnalité `cpi` et votre programme gagne accès au module `callee::cpi`.

Le module `cpi` expose les instructions de `callee` sous la forme d'une fonction Rust prenant en argument un `CpiContext` et toute donnée d'instruction supplémentaire. Ces fonctions utilisent le même format que les fonctions d'instruction dans vos programmes Anchor, mais avec `CpiContext` au lieu de `Context`. Le module `cpi` expose également les structures de comptes requises pour appeler les instructions.

Par exemple, si `callee` a l'instruction `do_something` qui nécessite les comptes définis dans la structure `DoSomething`, vous pourriez invoquer `do_something` comme suit :

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

### Invoquer une instruction sur un programme non Anchor

Lorsque le programme que vous appelez n'est *pas* un programme Anchor, deux options sont possibles :

1. Il est possible que les responsables du programme aient publié une crate avec leurs propres fonctions d'aide pour appeler leur programme. Par exemple, la crate `anchor_spl` fournit des fonctions d'aide qui sont pratiquement identiques du point de vue du site d'appel à ce que vous obtiendriez avec le module `cpi` d'un programme Anchor. Par exemple, vous pouvez mint en utilisant la [`fonction d'aide mint_to`](https://docs.rs/anchor-spl/latest/src/anchor_spl/token.rs.html#36-58) et utiliser la [`structure de comptes MintTo`](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.MintTo.html).
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
2. S'il n'y a pas de module d'aide pour le programme dont vous avez besoin d'invoquer les instructions, vous pouvez recourir à l'utilisation de `invoke` et `invoke_signed`. En fait, le code source de la fonction d'aide `mint_to` mentionnée ci-dessus montre un exemple d'utilisation de `invoke_signed` lorsqu'un `CpiContext` est fourni. Vous pouvez suivre un schéma similaire si vous décidez d'utiliser une structure de comptes et `CpiContext` pour organiser et préparer votre CPI.
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

## Lever des erreurs dans Anchor

Nous sommes assez avancés dans Anchor à ce stade, il est donc important de savoir comment créer des erreurs personnalisées.

En fin de compte, tous les programmes renvoient le même type d'erreur : [`ProgramError`](https://docs.rs/solana-program/latest/solana_program/program_error/enum.ProgramError.html). Cependant, lors de l'écriture d'un programme en utilisant Anchor, vous pouvez utiliser `AnchorError` comme une abstraction au-dessus de `ProgramError`. Cette abstraction fournit des informations supplémentaires lorsqu'un programme échoue, notamment :

- Le nom et le numéro de l'erreur
- L'emplacement dans le code où l'erreur a été déclenchée
- Le compte qui a enfreint une contrainte

```rust
pub struct AnchorError {
    pub error_name: String,
    pub error_code_number: u32,
    pub error_msg: String,
    pub error_origin: Option<ErrorOrigin>,
    pub compared_values: Option<ComparedValues>,
}
```

Les erreurs d'Anchor peuvent être divisées en :

- Erreurs internes à Anchor que le framework renvoie de l'intérieur de son propre code
- Erreurs personnalisées que vous, le développeur, pouvez créer

Vous pouvez ajouter des erreurs uniques à votre programme en utilisant l'attribut `error_code`. Ajoutez simplement cet attribut à un type `enum` personnalisé. Vous pouvez ensuite utiliser les variantes de l'`enum` comme erreurs dans votre programme. De plus, vous pouvez ajouter un message d'erreur à chaque variante en utilisant l'attribut `msg`. Les clients peuvent ensuite afficher ce message d'erreur si l'erreur se produit.

```rust
#[error_code]
pub enum MyError {
    #[msg("MonCompte ne peut contenir que des données en dessous de 100")]
    DataTooLarge
}
```

Pour renvoyer une erreur personnalisée, vous pouvez utiliser la macro [err](https://docs.rs/anchor-lang/latest/anchor_lang/macro.err.html) ou la macro [error](https://docs.rs/anchor-lang/latest/anchor_lang/prelude/macro.error.html) depuis une fonction d'instruction. Celles-ci ajoutent des informations de fichier et de ligne à l'erreur qui est ensuite loggée par Anchor pour vous aider dans le débogage.

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
    #[msg("MonCompte ne peut contenir que des données en dessous de 100")]
    DataTooLarge
}
```

Alternativement, vous pouvez utiliser la macro [require](https://docs.rs/anchor-lang/latest/anchor_lang/macro.require.html) pour simplifier le renvoi d'erreurs. Le code ci-dessus peut être refactoré comme suit :

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
    #[msg("MonCompte ne peut contenir que des données en dessous de 100")]
    DataTooLarge
}
```

# Laboratoire

Pratiquons les concepts que nous avons abordés dans cette leçon en développant le programme de critique de film que nous avons utilisé dans les leçons précédentes.

Dans ce laboratoire, nous mettrons à jour le programme pour émettre des jetons aux utilisateurs lorsqu'ils soumettent une nouvelle critique de film.

### 1. Départ

Pour commencer, nous utiliserons l'état final du programme de critique de film Anchor de la leçon précédente. Donc, si vous venez de terminer cette leçon, vous êtes prêt à partir. Si vous commencez ici, pas de soucis, vous pouvez [télécharger le code de départ](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas). Nous utiliserons la branche `solution-pdas` comme point de départ.

### 2. Ajouter des dépendances à `Cargo.toml`

Avant de commencer, nous devons activer la fonctionnalité `init-if-needed` et ajouter la crate `anchor-spl` aux dépendances dans `Cargo.toml`. Si vous avez besoin de vous rafraîchir la mémoire sur la fonctionnalité `init-if-needed`, consultez la [leçon sur les PDA et les comptes Anchor](anchor-pdas).

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
anchor-spl = "0.25.0"
```

### 3. Initialiser le jeton de récompense

Ensuite, accédez à `lib.rs` et créez une instruction pour initialiser un nouveau jeton. Ce sera le jeton qui sera émis chaque fois qu'un utilisateur laisse une critique.

```rust
pub fn initialize_token_mint(_ctx: Context<InitializeMint>) -> Result<()> {
    msg!("Initialisation du jeton effectuée");
    Ok(())
}
```

Maintenant, implémentez le type de contexte `InitializeMint` et répertoriez les comptes et les contraintes nécessaires à l'instruction. Ici, nous initialisons un nouveau compte `Mint` en utilisant une PDA avec la chaîne "mint" comme seed. Notez que nous pouvons utiliser la même PDA à la fois pour l'adresse du compte `Mint` et l'autorité de création de jetons. L'utilisation d'une PDA comme autorité de création de jetons permet à notre programme de signer la création des jetons.

Pour initialiser le compte `Mint`, nous devrons inclure les programmes `token_program`, `rent`, et `system_program` dans la liste des comptes.

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

Il peut y avoir certaines contraintes ci-dessus que vous n'avez pas encore vues. L'ajout de `mint::decimals` et `mint::authority` avec `init` garantit que le compte est initialisé en tant que nouveau jeton avec les décimales appropriées et l'autorité de création de jetons configurée.

### 4. Erreur Anchor

Ensuite, créons une erreur Anchor que nous utiliserons lors de la validation de la `note` transmise à l'instruction `add_movie_review` ou `update_movie_review`.

```rust
#[error_code]
enum MovieReviewError {
    #[msg("La note doit être comprise entre 1 et 5")]
    InvalidRating
}
```

### 5. Mettre à jour l'instruction `add_movie_review`

Maintenant que nous avons fait quelques préparatifs, mettons à jour l'instruction `add_movie_review` et le type de contexte `AddMovieReview` pour donner des jetons au critique.

Ensuite, mettez à jour le type de contexte `AddMovieReview` pour ajouter les comptes suivants :

- `token_program` - nous utiliserons le Token Program pour émettre des jetons
- `mint` - le compte pour les jetons que nous émettrons aux utilisateurs lorsqu'ils ajoutent une critique de film
- `token_account` - le compte de jeton associé au compte `mint` et au critique mentionné ci-dessus
- `associated_token_program` - requis car nous utiliserons la contrainte `associated_token` sur le compte de jeton
- `rent` - requis car nous utilisons la contrainte `init-if-needed` sur le compte de jeton

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
    // COMPTES AJOUTÉS CI-DESSOUS
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

Encore une fois, certaines des contraintes ci-dessus peuvent vous être inconnues. Les contraintes `associated_token::mint` et `associated_token::authority` ainsi que la contrainte `init_if_needed` garantissent que si le compte n'a pas déjà été initialisé, il sera initialisé en tant que compte de jeton associé pour le jeton spécifié et l'autorité.

Ensuite, mettons à jour l'instruction `add_movie_review` pour faire ce qui suit :

- Vérifiez que la `rating` est valide. Si ce n'est pas une note valide, renvoyez l'erreur `InvalidRating`.
- Faites un appel CPI à l'instruction `mint_to` du programme de jetons en utilisant l'autorité de création de jetons PDA comme signataire. Notez que nous émettrons 10 jetons à l'utilisateur mais devrons l'ajuster en regard des décimales du jeton en utilisant `10*10^6`.

Heureusement, nous pouvons utiliser la crate `anchor_spl` pour accéder aux fonctions et types d'aide tels que `mint_to` et `MintTo` pour construire notre CPI vers le programme de jetons. `mint_to` prend un `CpiContext` et un entier en tant qu'arguments, où l'entier représente le nombre de jetons à émettre. `MintTo` peut être utilisé pour la liste des comptes nécessaires à l'instruction de création de jetons.

```rust
pub fn add_movie_review(ctx: Context<AddMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Compte de critique de film créé");
    msg!("Titre : {}", title);
    msg!("Description : {}", description);
    msg!("Note : {}", rating);

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

    msg!("Jetons émis");

    Ok(())
}
```

### 6. Mettre à jour l'instruction `update_movie_review`

Ici, nous ajoutons uniquement la vérification que la `note` est valide.

```rust
pub fn update_movie_review(ctx: Context<UpdateMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Espace du compte de critique de film réalloué");
    msg!("Titre : {}", title);
    msg!("Description : {}", description);
    msg!("Note : {}", rating);

    require!(rating >= 1 && rating <= 5, MovieReviewError::InvalidRating);

    let movie_review = &mut ctx.accounts.movie_review;
    movie_review.description = description;
    movie_review.rating = rating;

    Ok(())
}
```

### 7. Tester

Ce sont toutes les modifications que nous devons apporter au programme ! Maintenant, mettons à jour nos tests.

Commencez par vous assurer que vos importations et votre fonction `describe` ressemblent à ceci :

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

Cela fait, ajoutez un test pour l'instruction `initializeTokenMint` :

```typescript
it("Initializes the reward token", async () => {
    const tx = await program.methods.initializeTokenMint().rpc()
})
```

Remarquez que nous n'avons pas eu à ajouter `.accounts` car ils peuvent être déduits, y compris le compte `mint` (en supposant que vous avez l'inférence de seed activée).

Ensuite, mettez à jour le test pour l'instruction `addMovieReview`. Les ajouts principaux sont les suivants :
1. Pour obtenir l'adresse de jeton associée qui doit être passée à l'instruction en tant que compte qui ne peut pas être déduit
2. Vérifiez à la fin du test que le compte de jeton associé a 10 jetons

```typescript
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

Après cela, les tests pour `updateMovieReview` ou `deleteMovieReview` ne nécessitent aucune modification.

À ce stade, exécutez `anchor test` et vous devriez voir la sortie suivante

```console
anchor-movie-review-program
    ✔ Initializes the reward token (458ms)
    ✔ Movie review is added (410ms)
    ✔ Movie review is updated (402ms)
    ✔ Deletes a movie review (405ms)

  5 passing (2s)
```

Si vous avez besoin de plus de temps avec les concepts de cette leçon ou si vous êtes bloqué en cours de route, n'hésitez pas à consulter le [code de solution](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-add-tokens). Notez que la solution de ce laboratoire se trouve sur la branche `solution-add-tokens`.

# Défi

Pour appliquer ce que vous avez appris sur la CPI dans cette leçon, réfléchissez à la manière dont vous pourriez les incorporer dans le programme Student Intro. Vous pourriez faire quelque chose de similaire à ce que nous avons fait dans le laboratoire ici et ajouter une fonctionnalité pour émettre des jetons aux utilisateurs lorsqu'ils se présentent.

Essayez de le faire de manière indépendante si vous le pouvez ! Mais si vous êtes bloqué, n'hésitez pas à vous référer à ce [code de solution](https://github.com/Unboxed-Software/anchor-student-intro-program/tree/cpi-challenge). Notez que votre code peut être légèrement différent du code de solution en fonction de votre implémentation.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=21375c76-b6f1-4fb6-8cc1-9ef151bc5b0a) !
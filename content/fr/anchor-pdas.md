---
title: PDAs et comptes dans Anchor
objectives:
- Utiliser les contraintes `seeds` et `bump` pour travailler avec les comptes PDA dans Anchor
- Activer et utiliser la contrainte `init_if_needed`
- Utiliser la contrainte `realloc` pour réallouer de l'espace sur un compte existant
- Utiliser la contrainte `close` pour fermer un compte existant
---

# Résumé

- Les contraintes `seeds` et `bump` sont utilisées pour initialiser et valider les comptes PDA dans Anchor
- La contrainte `init_if_needed` est utilisée pour initialiser conditionnellement un nouveau compte
- La contrainte `realloc` est utilisée pour réallouer de l'espace sur un compte existant
- La contrainte `close` est utilisée pour fermer un compte et rembourser son loyer

# Aperçu général

Dans cette leçon, vous apprendrez à travailler avec les PDAs, à réallouer des comptes et à fermer des comptes dans Anchor.

Rappelez-vous que les programmes Anchor séparent la logique d'instruction de la validation de compte. La validation de compte se fait principalement au sein des structs qui représentent la liste des comptes nécessaires pour une instruction donnée. Chaque champ de la struct représente un compte différent, et vous pouvez personnaliser la validation effectuée sur le compte en utilisant le macro-attribut `#[account(...)]`.

En plus d'utiliser des contraintes pour la validation des comptes, certaines contraintes peuvent gérer des tâches répétitives qui nécessiteraient autrement beaucoup de code redondant à l'intérieur de notre logique d'instruction. Cette leçon introduira les contraintes `seeds`, `bump`, `realloc` et `close` pour vous aider à initialiser et valider des PDAs, réallouer des comptes et fermer des comptes.

## PDAs avec Anchor

Rappelez-vous que les [PDAs](https://github.com/Unboxed-Software/solana-course/blob/main/content/pda) sont dérivées à l'aide d'une liste de seeds facultatives, d'une bump seed et d'un ID de programme. Anchor fournit un moyen pratique de valider une PDA avec les contraintes `seeds` et `bump`.

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

Lors de la validation du compte, Anchor dérivera une PDA en utilisant les seeds spécifiées dans la contrainte `seeds` et vérifiera que le compte passé à l'instruction correspond à la PDA trouvée en utilisant les seeds spécifiées.

Lorsque la contrainte `bump` est incluse sans spécifier un décalage spécifique, Anchor utilisera par défaut le décalage canonique (le premier décalage qui donne une PDA valide). Dans la plupart des cas, vous devriez utiliser le décalage canonique.

Vous pouvez accéder à d'autres champs depuis la struct à partir de contraintes, vous pouvez donc spécifier des seeds qui dépendent d'autres comptes comme la clé publique du signataire.

Vous pouvez également référencer les données d'instruction désérialisées si vous ajoutez le macro-attribut `#[instruction(...)]` à la struct.

L'exemple suivant montre une liste de comptes qui incluent `pda_account` et `user`. Le `pda_account` est contraint de sorte que les seeds doivent être la chaîne "example_seed", la clé publique de `user`, et la chaîne passée dans l'instruction en tant que `instruction_data`.

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

Si l'adresse du `pda_account` fournie par le client ne correspond pas à la PDA dérivée en utilisant les seeds spécifiées et le décalage canonique, alors la validation du compte échouera.

### Utiliser les PDAs avec la contrainte `init`

Vous pouvez combiner les contraintes `seeds` et `bump` avec la contrainte `init` pour initialiser un compte à l'aide d'une PDA.

Rappelez-vous que la contrainte `init` doit être utilisée en combinaison avec les contraintes `payer` et `space` pour spécifier le compte qui paiera l'initialisation du compte et l'espace à allouer sur le nouveau compte. De plus, vous devez inclure `system_program` comme l'un des champs de la struct de validation de compte.

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

Lorsque vous utilisez `init` pour des comptes non-PDA, Anchor définira par défaut le propriétaire du compte initialisé comme étant le programme qui exécute actuellement l'instruction.

Cependant, lorsque vous utilisez `init` en combinaison avec `seeds` et `bump`, le propriétaire *doit* être le programme exécutant. Cela est dû au fait qu'initialiser un compte pour la PDA nécessite une signature que seul le programme exécutant peut fournir. En d'autres termes, la vérification de signature pour l'initialisation du compte PDA échouerait si l'ID utilisé pour dériver la PDA ne correspondait pas à l'ID du programme en cours d'exécution.

Lorsque vous déterminez la valeur de `space` pour un compte initialisé et possédé par le programme Anchor en cours d'exécution, rappelez-vous que les premiers 8 octets sont réservés pour le discriminant du compte. Il s'agit d'une valeur de 8 octets que Anchor calcule et utilise pour identifier les types de compte du programme. Vous pouvez utiliser cette [référence](https://www.anchor-lang.com/docs/space) pour calculer combien d'espace vous devez allouer pour un compte.

### Inférence de seeds

La liste des comptes pour une instruction peut devenir très longue pour certains programmes. Pour simplifier l'expérience côté client lors de l'invocation d'une instruction de programme Anchor, nous pouvons activer l'inférence de seeds.

L'inférence de seeds ajoute des informations sur les seeds PDA à l'IDL afin qu'Anchor puisse inférer les seeds PDA à partir des informations existantes de l'appel. Dans l'exemple précédent, les seeds sont `b"example_seed"` et `user.key()`. Le premier est statique et donc connu, et le deuxième est connu car `user` est le signataire de la transaction.

Si vous utilisez l'inférence de seeds lors de la construction de votre programme, alors tant que vous appelez le programme en utilisant Anchor, vous n'avez pas besoin de dériver explicitement et de transmettre la PDA. Au lieu de cela, la bibliothèque Anchor le fera pour vous.

Vous pouvez activer l'inférence de seeds dans le fichier `Anchor.toml` avec `seeds = true` sous `[features]`.

```
[features]
seeds = true
```

### Utiliser le macro-attribut `#[instruction(...)]`

Jetons un bref coup d'œil au macro-attribut `#[instruction(...)]` avant de passer à autre chose. Lors de l'utilisation de `#[instruction(...)]`, les données d'instruction que vous fournissez dans la liste des arguments doivent correspondre et être dans le même ordre que les arguments d'instruction. Vous pouvez omettre les arguments inutilisés à la fin de la liste, mais vous devez inclure tous les arguments jusqu'au dernier que vous utiliserez.

Par exemple, imaginez une instruction ayant les arguments `input_one`, `input_two` et `input_three`. Si vos contraintes de compte doivent faire référence à `input_one` et `input_three`, vous devez lister les trois arguments dans le macro-attribut `#[instruction(...)]`.

Cependant, si vos contraintes ne font référence qu'à `input_one` et `input_two`, vous pouvez omettre `input_three`.

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

De plus, vous obtiendrez une erreur si vous listez les entrées dans le mauvais ordre :

```rust
#[derive(Accounts)]
#[instruction(input_two:String, input_one:String)]
pub struct Example<'info> {
    ...
}
```

## Init-if-needed

Anchor fournit une contrainte `init_if_needed` qui peut être utilisée pour initialiser un compte si le compte n'a pas déjà été initialisé.

Cette fonctionnalité est conditionnée derrière un indicateur de fonctionnalité pour s'assurer que vous utilisez cette fonctionnalité intentionnellement. Pour des raisons de sécurité, il est judicieux d'éviter d'avoir une instruction qui se divise en plusieurs chemins logiques. Et comme son nom l'indique, `init_if_needed` exécute l'un des deux chemins de code possibles en fonction de l'état du compte en question.

Lors de l'utilisation de `init_if_needed`, vous devez vous assurer de protéger correctement votre programme contre les attaques de réinitialisation. Vous devez inclure des vérifications dans votre code qui vérifient que le compte initialisé ne peut pas être réinitialisé à ses paramètres initiaux après la première initialisation.

Pour utiliser `init_if_needed`, vous devez d'abord activer la fonctionnalité dans `Cargo.toml`.

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
```

Une fois que vous avez activé la fonctionnalité, vous pouvez inclure la contrainte dans le macro-attribut `#[account(…)]`. L'exemple ci-dessous démontre l'utilisation de la contrainte `init_if_needed` pour initialiser un nouveau compte de jeton associé s'il n'existe pas déjà.

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

Lorsque l'instruction `initialize` est invoquée dans l'exemple précédent, Anchor vérifiera si le `token_account` existe et l'initialisera s'il n'existe pas déjà. S'il existe déjà, alors l'instruction se poursuivra sans initialiser le compte. Tout comme avec la contrainte `init`, vous pouvez utiliser `init_if_needed` en conjonction avec `seeds` et `bump` si le compte est une PDA.

## Realloc

La contrainte `realloc` fournit un moyen simple de réallouer de l'espace pour des comptes existants.

La contrainte `realloc` doit être utilisée en combinaison avec les contraintes suivantes :

- `mut` - le compte doit être défini comme mutable
- `realloc::payer` - le compte auquel soustraire ou ajouter des lamports en fonction de la diminution ou de l'augmentation de l'espace du compte
- `realloc::zero` - un booléen pour spécifier si la nouvelle mémoire doit être initialisée à zéro

Comme avec `init`, vous devez inclure `system_program` comme l'un des comptes de la struct de validation de compte lors de l'utilisation de `realloc`.

Voici un exemple de réallocation d'espace pour un compte qui stocke un champ `data` de type `String`.

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

Remarquez que `realloc` est défini à `8 + 4 + instruction_data.len()`. Cela se décompose comme suit :
- `8` est pour le discriminant du compte
- `4` est pour les 4 octets d'espace que BORSH utilise pour stocker la longueur de la chaîne
- `instruction_data.len()` est la longueur de la chaîne elle-même

Si le changement de longueur des données du compte est additionnel, les lamports seront transférés du `realloc::payer` vers le compte afin de maintenir l'exemption de loyer. De même, si le changement est soustractif, les lamports seront transférés du compte vers le `realloc::payer`.

La contrainte `realloc::zero` est requise pour déterminer si la nouvelle mémoire doit être initialisée à zéro après la réallocation. Cette contrainte doit être définie sur vrai dans les cas où vous vous attendez à ce que la mémoire d'un compte rétrécisse et s'étende plusieurs fois. De cette façon, vous effacez l'espace qui autrement apparaîtrait comme des données périmées.

## Close

La contrainte `close` fournit un moyen simple et sécurisé de fermer un compte existant.

La contrainte `close` marque le compte comme fermé à la fin de l'exécution de l'instruction en définissant son discriminant sur le `CLOSED_ACCOUNT_DISCRIMINATOR` et en envoyant ses lamports à un compte spécifié. En définissant le discriminant sur une variante spéciale, les attaques de réactivation de compte (où une instruction ultérieure ajoute à nouveau les lamports d'exemption de loyer) deviennent impossibles. Si quelqu'un essaie de réinitialiser le compte, la réinitialisation échouera lors de la vérification du discriminant et sera considérée comme invalide par le programme.

L'exemple ci-dessous utilise la contrainte `close` pour fermer le `data_account` et envoie les lamports alloués pour le loyer au compte `receiver`.

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

# Laboratoire

Pratiquons les concepts que nous avons abordés dans cette leçon en créant un programme de critique de film en utilisant le framework Anchor.

Ce programme permettra aux utilisateurs de :

- Utiliser une PDA pour initialiser un nouveau compte d'avis de film afin de stocker l'avis
- Mettre à jour le contenu d'un compte d'avis de film existant
- Fermer un compte d'avis de film existant

### 1. Créer un nouveau projet Anchor

Pour commencer, créons un nouveau projet en utilisant `anchor init`.

```console
anchor init anchor-movie-review-program
```

Ensuite, accédez au fichier `lib.rs` dans le dossier `programs` et vous devriez voir le code de démarrage suivant.

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

Allez-y et supprimez l'instruction `initialize` et le type `Initialize`.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}
```

### 2. `MovieAccountState`

Tout d'abord, utilisons le macro-attribut `#[account]` pour définir `MovieAccountState` qui représentera la structure de données des comptes d'avis de film. Pour rappel, le macro-attribut `#[account]` implémente divers traits qui aident à la sérialisation et à la désérialisation du compte, définissent le discriminateur du compte et définissent le propriétaire d'un nouveau compte comme l'ID de programme défini dans le macro `declare_id!`.

Dans chaque compte d'avis de film, nous stockerons :

- `reviewer` - utilisateur créant l'avis
- `rating` - note pour le film
- `title` - titre du film
- `description` - contenu de l'avis

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

### 3. Ajouter un avis sur un film

Ensuite, implémentons l'instruction `add_movie_review`. L'instruction `add_movie_review` nécessitera un `Contexte` de type `AddMovieReview` que nous implémenterons bientôt.

L'instruction nécessitera trois arguments supplémentaires en tant que données d'instruction fournies par un évaluateur :

- `title` - titre du film avec pour type `String`
- `description` - détails de l'avis avec pour type `String`
- `rating` - note pour le film avec pour type `u8`

Dans la logique de l'instruction, nous remplirons les données du nouveau compte `movie_review` avec les données d'instruction. Nous définirons également le champ `reviewer` comme le compte `initializer` du contexte d'instruction.

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
        msg!("Compte d'avis de film créé");
        msg!("Titre : {}", title);
        msg!("Description : {}", description);
        msg!("Note : {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.reviewer = ctx.accounts.initializer.key();
        movie_review.title = title;
        movie_review.rating = rating;
        movie_review.description = description;
        Ok(())
    }
}
```

Ensuite, créons la structure `AddMovieReview` que nous avons utilisée comme générique dans le contexte de l'instruction. Cette structure énumérera les comptes requis par l'instruction `add_movie_review`.

N'oubliez pas les macros suivantes :

- Le macro `#[derive(Accounts)]` est utilisé pour désérialiser et valider la liste des comptes spécifiée dans la structure
- Le macro d'attribut `#[instruction(...)]` est utilisé pour accéder aux données d'instruction transmises à l'instruction
- Le macro d'attribut `#[account(...)]` spécifie ensuite des contraintes supplémentaires sur les comptes

Le compte `movie_review` est une PDA qui doit être initialisée, donc nous ajouterons les contraintes `seeds` et `bump` ainsi que la contrainte `init` avec ses contraintes `payer` et `space` requises.

Pour les seeds PDA, nous utiliserons le titre du film et la clé publique de l'évaluateur. Le payeur pour l'initialisation devrait être l'évaluateur, et l'espace alloué sur le compte devrait être suffisant pour le discriminateur du compte, la clé publique de l'évaluateur, la note, le titre et la description de l'avis du film.

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

### 4. Mettre à jour l'avis sur un film

Ensuite, implémentons l'instruction `update_movie_review` avec un contexte dont le type générique est `UpdateMovieReview`.

Comme précédemment, l'instruction nécessitera trois arguments supplémentaires en tant que données d'instruction fournies par un évaluateur :

- `title` - titre du film
- `description` - détails de l'avis
- `rating` - note pour le film

Dans la logique de l'instruction, nous mettrons à jour `rating` et `description` stockées sur le compte `movie_review`.

Bien que le `title` ne soit pas utilisé dans la fonction d'instruction elle-même, nous en aurons besoin pour la validation du compte `movie_review` dans l'étape suivante.

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
        msg!("Espace du compte d'avis de film réalloué");
        msg!("Titre : {}", title);
        msg!("Description : {}", description);
        msg!("Note : {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.rating = rating;
        movie_review.description = description;

        Ok(())
    }

}
```

Ensuite, créons la structure `UpdateMovieReview` pour définir les comptes que l'instruction `update_movie_review` nécessite.

Puisque le compte `movie_review` aura déjà été initialisé à ce stade, nous n'avons plus besoin de la contrainte `init`. Cependant, étant donné que la valeur de `description` peut désormais être différente, nous devons utiliser la contrainte `realloc` pour réallouer l'espace sur le compte. Avec cela, nous avons besoin des contraintes `mut`, `realloc::payer` et `realloc::zero`.

Nous aurons également toujours besoin des contraintes `seeds` et `bump` comme nous les avions dans `AddMovieReview`.

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

Notez que la contrainte `realloc` est définie sur le nouvel espace requis par le compte `movie_review` en fonction de la valeur mise à jour de `description`.

De plus, la contrainte `realloc::payer` spécifie que les lamports supplémentaires nécessaires ou remboursés proviendront ou seront envoyés au compte `initializer`.

Enfin, nous définissons la contrainte `realloc::zero` sur `true` car le compte `movie_review` peut être mis à jour plusieurs fois en réduisant ou en augmentant l'espace alloué au compte.

### 5. Supprimer un avis sur un film

Enfin, implémentons l'instruction `delete_movie_review` pour fermer un compte d'avis de film existant.

Nous utiliserons un contexte dont le type générique est `DeleteMovieReview` et n'inclura aucune donnée d'instruction supplémentaire. Puisque nous ne faisons que fermer un compte, nous n'avons en fait besoin d'aucune logique d'instruction à l'intérieur de la fonction. La fermeture elle-même sera gérée par la contrainte Anchor dans le type `DeleteMovieReview`.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn delete_movie_review(_ctx: Context<DeleteMovieReview>, title: String) -> Result<()> {
        msg!("Avis de film pour {} supprimé", title);
        Ok(())
    }

}
```

Ensuite, implémentons la structure `DeleteMovieReview`.

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

Ici, nous utilisons la contrainte `close` pour spécifier que nous fermons le compte `movie_review` et que le loyer doit être remboursé au compte `initializer`. Nous incluons également les contraintes `seeds` et `bump` pour le compte `movie_review` pour la validation. Anchor gère ensuite la logique supplémentaire requise pour fermer le compte de manière sécurisée.

### 6. Tests

Le programme devrait être prêt à être utilisé ! Testons-le maintenant. Accédez à `anchor-movie-review-program.ts` et remplacez le code de test par défaut par ce qui suit.

Ici, nous :

- Créons des valeurs par défaut pour les données d'instruction de l'avis sur le film
- Dérivons la PDA du compte d'avis sur le film
- Créons des espaces réservés pour les tests

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
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

Ensuite, créons le premier test pour l'instruction `addMovieReview`. Remarquez que nous n'ajoutons pas explicitement `.accounts`. C'est parce que le `Wallet` de `AnchorProvider` est automatiquement inclus en tant que signataire, Anchor peut déduire certains comptes comme `SystemProgram`, et Anchor peut également déduire la PDA `movieReview` à partir de l'argument d'instruction `title` et de la clé publique du signataire.

Une fois l'instruction exécutée, nous récupérons le compte `movieReview` et vérifions que les données stockées sur le compte correspondent aux valeurs attendues.

```typescript
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

Ensuite, créons le test pour l'instruction `updateMovieReview` en suivant le même processus qu'auparavant.

```typescript
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

Ensuite, créons le test pour l'instruction `deleteMovieReview`

```typescript
it("Deletes a movie review", async () => {
  const tx = await program.methods
    .deleteMovieReview(movie.title)
    .rpc()
})
```

Enfin, exécutez `anchor test` et vous devriez voir la sortie suivante dans la console.

```console
  anchor-movie-review-program
    ✔ Movie review is added` (139ms)
    ✔ Movie review is updated` (404ms)
    ✔ Deletes a movie review (403ms)


  3 passing (950ms)
```

Si vous avez besoin de plus de temps avec ce projet pour vous sentir à l'aise avec ces concepts, n'hésitez pas à consulter le [code de la solution](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas) avant de continuer.

# Défi

Maintenant, c'est à votre tour de construire quelque chose de manière indépendante. Équipé des concepts introduits dans cette leçon, essayez de recréer le programme d'introduction des étudiants que nous avons utilisé précédemment en utilisant le framework Anchor.

Le programme d'introduction des étudiants est un programme Solana qui permet aux étudiants de se présenter. Le programme prend le nom de l'utilisateur et un message court comme données d'instruction et crée un compte pour stocker les données onchain.

En utilisant ce que vous avez appris dans cette leçon, développez ce programme. Le programme devrait inclure des instructions pour :

1. Initialiser un compte PDA pour chaque étudiant qui stocke le nom de l'étudiant et son court message
2. Mettre à jour le message sur un compte existant
3. Fermer un compte existant

Essayez de le faire de manière indépendante si possible ! Mais si vous êtes bloqué, n'hésitez pas à consulter le [code de la solution](https://github.com/Unboxed-Software/anchor-student-intro-program).

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=f58108e9-94a0-45b2-b0d5-44ada1909105) !
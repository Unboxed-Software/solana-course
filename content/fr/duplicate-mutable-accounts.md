---
title: Comptes Mutables Dupliqués
objectives:
- Expliquer les risques de sécurité associés aux instructions nécessitant deux comptes mutables du même type et comment les éviter
- Mettre en œuvre une vérification des comptes mutables dupliqués en Rust en utilisant la syntaxe longue
- Mettre en œuvre une vérification des comptes mutables dupliqués en utilisant les contraintes d'Anchor
---

# Résumé

- Lorsqu'une instruction nécessite deux comptes mutables du même type, un attaquant peut passer le même compte deux fois, provoquant une mutation non intentionnelle du compte.
- Pour vérifier les comptes mutables dupliqués en Rust, il suffit de comparer les clés publiques des deux comptes et de générer une erreur s'ils sont identiques.

  ```rust
  if ctx.accounts.account_one.key() == ctx.accounts.account_two.key() {
      return Err(ProgramError::InvalidArgument)
  }
  ```

- Avec Anchor, vous pouvez utiliser la fonction `constraint` pour ajouter une contrainte explicite à un compte en vérifiant qu'il est différent d'un autre compte.

# Aperçu général

Les "Comptes Mutables Dupliqués" font référence à une instruction nécessitant deux comptes mutables du même type. Dans ce cas, il est nécessaire de valider que deux comptes sont différents pour éviter qu'un même compte ne soit passé deux fois à l'instruction.

Étant donné que le programme traite chaque compte comme étant distinct, passer le même compte deux fois peut entraîner des mutations non intentionnelles du deuxième compte. Cela peut entraîner des problèmes mineurs ou des problèmes catastrophiques, selon les données que le code modifie et comment ces comptes sont utilisés. Quoi qu'il en soit, il s'agit d'une vulnérabilité dont tous les développeurs doivent être conscients.

### Aucune vérification

Par exemple, imaginez un programme qui met à jour un champ `data` pour `user_a` et `user_b` en une seule instruction. La valeur que l'instruction définit pour `user_a` est différente de celle de `user_b`. Sans vérifier que `user_a` et `user_b` sont différents, le programme mettrait à jour le champ `data` du compte `user_a`, puis mettrait à jour le champ `data` une deuxième fois avec une valeur différente en supposant que `user_b` est un compte distinct.

Vous pouvez voir cet exemple dans le code ci-dessous. Il n'y a pas de vérification pour s'assurer que `user_a` et `user_b` ne sont pas le même compte. Passer le même compte pour `user_a` et `user_b` entraînera la modification du champ `data` du compte pour qu'il soit défini sur `b`, même si l'intention est de définir les valeurs `a` et `b` sur des comptes distincts. Selon ce que représente `data`, cela pourrait être un effet secondaire mineur non intentionnel, ou cela pourrait représenter un risque de sécurité grave. Autoriser `user_a` et `user_b` à être le même compte pourrait ressembler à ceci :

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

### Ajouter une vérification dans l'instruction

Pour résoudre ce problème avec Rust classique, ajoutez simplement une vérification dans la logique de l'instruction pour vérifier que la clé publique de `user_a` n'est pas la même que celle de `user_b`, en renvoyant une erreur s'ils sont identiques.

```rust
if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
    return Err(ProgramError::InvalidArgument)
}
```

Cette vérification garantit que `user_a` et `user_b` ne sont pas le même compte.

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

### Utiliser la `constraint` d'Anchor

Une solution encore meilleure si vous utilisez Anchor est d'ajouter la vérification à la structure de validation du compte au lieu de la logique de l'instruction.

Vous pouvez utiliser l'attribut `#[account(..)]` et le mot clé `constraint` pour ajouter une contrainte manuelle à un compte. Le mot clé `constraint` vérifiera si l'expression qui suit est vraie ou fausse, renvoyant une erreur si l'expression est fausse.

L'exemple ci-dessous déplace la vérification de la logique de l'instruction à la structure de validation du compte en ajoutant une `constraint` à l'attribut `#[account(..)]`.

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

# Laboratoire

Pratiquons en créant un programme simple de Pierre-Feuille-Ciseaux pour démontrer comment ne pas vérifier les comptes mutables dupliqués peut causer un comportement indéfini dans votre programme.

Ce programme initialisera des comptes "joueur" et aura une instruction distincte nécessitant deux comptes joueur pour représenter le début d'une partie de pierre-papier-ciseaux.

- Une instruction `initialize` pour initialiser un compte `PlayerState`
- Une instruction `rock_paper_scissors_shoot_insecure` qui nécessite deux comptes `PlayerState`, mais ne vérifie pas que les comptes passés à l'instruction sont différents
- Une instruction `rock_paper_scissors_shoot_secure` identique à l'instruction `rock_paper_scissors_shoot_insecure`, mais ajoutant une contrainte pour s'assurer que les deux comptes joueur sont différents

### 1. Démarrage

Pour commencer, téléchargez le code de départ sur la branche `starter` de [ce dépôt](https://github.com/unboxed-software/solana-duplicate-mutable-accounts/tree/starter). Le code de départ comprend un programme avec deux instructions et la configuration de base du fichier de test.

L'instruction `initialize` initialise un nouveau compte `PlayerState` stockant la clé publique d'un joueur et un champ `choice` défini sur `None`.

L'instruction `rock_paper_scissors_shoot_insecure` nécessite deux comptes `PlayerState` et exige un choix de l'énumération `RockPaperScissors` pour chaque joueur, mais ne vérifie pas que les comptes passés à l'instruction sont différents. Cela signifie qu'un même compte peut être utilisé pour les deux comptes `PlayerState` dans l'instruction.

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

### 2. Tester l'instruction `rock_paper_scissors_shoot_insecure`

Le fichier de test inclut le code pour invoquer l'instruction `initialize` deux fois pour créer deux comptes joueur.

Ajoutez un test pour invoquer l'instruction `rock_paper_scissors_shoot_insecure` en utilisant la clé publique `playerOne.publicKey` comme `playerOne` et `playerTwo`.

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

Exécutez `anchor test` pour voir que la transaction se termine avec succès, même si le même compte est utilisé pour les deux comptes de l'instruction. Étant donné que le compte `playerOne` est utilisé comme les deux joueurs dans l'instruction, notez que le champ `choice` stocké sur le compte `playerOne` est également remplacé et défini incorrectement sur `scissors`.

```bash
duplicate-mutable-accounts
  ✔ Initialized Player One (461ms)
  ✔ Initialized Player Two (404ms)
  ✔ Invoke insecure instruction (406ms)
```

Permettre des comptes dupliqués n'a pas beaucoup de sens pour le jeu, et cela entraîne également un comportement indéfini. Si nous devions développer davantage ce programme, le programme n'aurait qu'une seule option choisie et ne pourrait donc pas être comparé à une deuxième option. Le jeu se terminerait par une égalité à chaque fois. Il n'est pas non plus clair pour un humain si le choix de `playerOne` doit être rock ou ciseaux, le comportement du programme est donc étrange.

### 3. Ajouter l'instruction `rock_paper_scissors_shoot_secure`

Ensuite, revenez à `lib.rs` et ajoutez une instruction `rock_paper_scissors_shoot_secure` qui utilise la macro `#[account(...)]` pour ajouter une contrainte supplémentaire et vérifier que `player_one` et `player_two` sont différents.

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

### 7. Tester l'instruction `rock_paper_scissors_shoot_secure`

Pour tester l'instruction `rock_paper_scissors_shoot_secure`, nous invoquerons l'instruction deux fois. Tout d'abord, nous invoquerons l'instruction en utilisant deux comptes joueur différents pour vérifier que l'instruction fonctionne comme prévu. Ensuite, nous invoquerons l'instruction en utilisant `playerOne.publicKey` comme les deux comptes joueur, ce qui devrait échouer.

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

Exécutez `anchor test` pour voir que l'instruction fonctionne comme prévu et qu'utiliser le compte `playerOne` deux fois renvoie l'erreur attendue.

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: RockPaperScissorsShootSecure',
'Program log: AnchorError caused by account: player_one. Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated.',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 5104 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d3'
```

La simple contrainte suffit à fermer cette faille. Bien que quelque peu artificiel, cet exemple illustre le comportement étrange qui peut se produire si vous écrivez votre programme en supposant que deux comptes du même type seront différentes instances d'un compte mais que vous n'écrivez pas explicitement cette contrainte dans votre programme. Pensez toujours au comportement que vous attendez du programme et assurez-vous que cela est explicite.

Si vous voulez consulter le code de la solution finale, vous pouvez le trouver sur la branche `solution` de [ce dépôt](https://github.com/Unboxed-Software/solana-duplicate-mutable-accounts/tree/solution).

# Défi

Tout comme avec les autres leçons de cette unité, votre opportunité de pratiquer l'évitement de cette faille de sécurité réside dans l'audit de votre propre programme ou d'autres programmes.

Prenez le temps de réviser au moins un programme et assurez-vous que toutes les instructions avec deux comptes mutables du même type sont correctement contraintes pour éviter les duplications.

N'oubliez pas, si vous trouvez un bogue ou une faille dans le programme de quelqu'un d'autre, veuillez les en informer ! Si vous en trouvez un dans votre propre programme, assurez-vous de le corriger immédiatement.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=9b759e39-7a06-4694-ab6d-e3e7ac266ea7) !
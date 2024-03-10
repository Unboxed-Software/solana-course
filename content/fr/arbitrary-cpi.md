---
title: CPI Arbitraires
objectives:
- Expliquer les risques de sécurité liés à l'invocation d'une CPI vers un programme inconnu
- Présenter comment le module CPI d'Anchor empêche cela lors de la création d'une CPI d'un programme Anchor à un autre
- Créer une CPI de manière sûre et sécurisée d'un programme Anchor vers un programme non-Anchor arbitraire
---

# Résumé

- Pour générer une CPI, le programme cible doit être passé à l'instruction d'invocation en tant que compte. Cela signifie que n'importe quel programme cible pourrait être passé à l'instruction. Votre programme doit vérifier les programmes incorrects ou inattendus.
- Effectuez des vérifications de programme dans les programmes natifs en comparant simplement la clé publique du programme passé au programme que vous attendiez.
- Si un programme est écrit en Anchor, il peut avoir un module CPI publiquement disponible. Cela facilite et sécurise l'invocation du programme à partir d'un autre programme Anchor. Le module CPI d'Anchor vérifie automatiquement que l'adresse du programme passé correspond à l'adresse du programme stockée dans le module.

# Aperçu général

Une invocation interprogramme (CPI) se produit lorsqu'un programme invoque une instruction sur un autre programme. Une "CPI arbitraire" se produit lorsque un programme est structuré pour émettre une CPI vers n'importe quel programme passé dans l'instruction plutôt que de s'attendre à effectuer une CPI vers un programme spécifique. Étant donné que les appelants de l'instruction de votre programme peuvent passer n'importe quel programme dans la liste des comptes de l'instruction, le fait de ne pas vérifier l'adresse d'un programme passé a pour conséquence le fait que votre programme effectue des CPI vers des programmes arbitraires.

Ce manque de vérifications de programme crée une opportunité pour un utilisateur malveillant de passer un programme différent de celui attendu, amenant le programme d'origine à appeler une instruction sur ce programme mystère. On ne sait pas quelles pourraient être les conséquences de cette CPI. Cela dépend de la logique du programme (à la fois du programme d'origine et du programme inattendu), ainsi que des autres comptes passés dans l'instruction d'origine.

## Absence de vérifications de programme

Prenons l'exemple suivant. L'instruction `cpi` invoque l'instruction `transfer` sur `token_program`, mais il n'y a pas de code qui vérifie si le compte `token_program` passé dans l'instruction est effectivement le programme SPL Token.

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

Un attaquant pourrait facilement appeler cette instruction et passer un programme de jeton dupliqué qu'il a créé et contrôle.

## Ajout de vérifications de programme

Il est possible de résoudre cette vulnérabilité en ajoutant simplement quelques lignes à l'instruction `cpi` pour vérifier si la clé publique de `token_program` est celle du programme SPL Token.

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

Maintenant, si un attaquant passe un programme de jeton différent, l'instruction renverra l'erreur `ProgramError::IncorrectProgramId`.

En fonction du programme que vous invoquez avec votre CPI, vous pouvez soit coder en dur l'adresse du programme attendu, soit utiliser la crate Rust du programme pour obtenir l'adresse du programme, si disponible. Dans l'exemple ci-dessus, la crate `spl_token` fournit l'adresse du programme SPL Token.

## Utilisation d'un module CPI Anchor

Une manière plus simple de gérer les vérifications de programme est d'utiliser les modules CPI Anchor. Nous avons appris dans une [leçon précédente](https://github.com/Unboxed-Software/solana-course/blob/main/content/anchor-cpi) qu'Anchor peut générer automatiquement des modules CPI pour simplifier les CPI dans le programme. Ces modules renforcent également la sécurité en vérifiant la clé publique du programme passée dans l'une de ses instructions publiques.

Chaque programme Anchor utilise la macro `declare_id()` pour définir l'adresse du programme. Lorsqu'un module CPI est généré pour un programme spécifique, il utilise l'adresse passée à cette macro comme "source de vérité" et vérifiera automatiquement que tous les CPI réalisés avec son module CPI ciblent cette adresse du programme.

Bien qu'au fond cela ne soit pas différent des vérifications manuelles de programme, l'utilisation de modules CPI évite la possibilité d'oublier d'effectuer une vérification de programme ou de taper accidentellement la mauvaise ID de programme lors de sa codification en dur.

Le programme ci-dessous montre un exemple d'utilisation d'un module CPI pour le programme SPL Token afin d'effectuer le transfert montré dans les exemples précédents.

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

Notez que, comme l'exemple ci-dessus, Anchor a créé quelques [wrappers pour les programmes natifs populaires](https://github.com/coral-xyz/anchor/tree/master/spl/src) qui vous permettent d'émettre des CPI vers eux comme s'ils étaient des programmes Anchor.

De plus, en fonction du programme vers lequel vous émettez la CPI, vous pouvez utiliser le [type de compte `Program`](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/program/struct.Program.html) d'Anchor pour valider le programme passé dans votre struct de validation de compte. Entre les crates [`anchor_lang`](https://docs.rs/anchor-lang/latest/anchor_lang) et [`anchor_spl`](https://docs.rs/anchor_spl/latest/) , les types `Program` suivants sont fournis en standard:

- [`System`](https://docs.rs/anchor-lang/0.29.0/anchor_lang/system_program/struct.System.html)
- [`AssociatedToken`](https://docs.rs/anchor-spl/latest/anchor_spl/associated_token/struct.AssociatedToken.html)
- [`Token`](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.Token.html)

Si vous avez accès au module CPI d'un programme Anchor, vous pouvez généralement importer son type de programme avec le code suivant, en remplaçant le nom du programme par le nom du programme réel:

```rust
use other_program::program::OtherProgram;
```

# Laboratoire

Pour montrer l'importance de vérifier le programme que vous utilisez pour les CPI, nous allons travailler avec un jeu simplifié et quelque peu artificiel. Ce jeu représente des personnages avec des comptes PDA et utilise un programme "metadata" séparé pour gérer les métadonnées des personnages et des attributs tels que la santé et la puissance.

Bien que cet exemple soit quelque peu artificiel, il a une architecture presque identique à celle des NFT sur Solana: le programme SPL Token gère les mints de jetons, la distribution et les transferts, et un programme metadata séparé est utilisé pour attribuer des métadonnées aux jetons. Ainsi, la vulnérabilité que nous examinons ici pourrait également s'appliquer à de vrais jetons.

### 1. Démarrage

Nous commencerons avec la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/starter). Clonez le dépôt, puis ouvrez-le sur la branche `starter`.

Remarquez qu'il y a trois programmes:

1. `gameplay`
2. `character-metadata`
3. `fake-metadata`

De plus, il y a déjà un test dans le répertoire `tests`.

Le premier programme, `gameplay`, est celui que notre test utilise directement. Jetez un œil au programme. Il a deux instructions:

1. `create_character_insecure` - crée un nouveau personnage et émet une CPI vers le programme metadata pour configurer les attributs initiaux du personnage
2. `battle_insecure` - oppose deux personnages, attribuant une "victoire" au personnage avec les attributs les plus élevés

Le deuxième programme, `character-metadata`, est censé être le programme "approuvé" pour gérer les métadonnées du personnage. Regardez ce programme. Il a une seule instruction pour `create_metadata` qui crée un nouveau PDA et attribue une valeur pseudo-aléatoire entre 0 et 20 pour la santé et la puissance du personnage.

Le dernier programme, `fake-metadata`, est un programme "fake" de métadonnées destiné à illustrer ce qu'un attaquant pourrait créer pour exploiter notre programme `gameplay`. Ce programme est presque identique au programme `character-metadata`, sauf qu'il attribue une santé et une puissance initiales du personnage au maximum autorisé: 255.

### 2. Testez l'instruction `create_character_insecure`

Il y a déjà un test dans le répertoire `tests` pour cela. Il est long, mais prenez une minute pour le regarder avant que nous ne le parcourions ensemble:

```typescript
it("Insecure instructions allow attacker to win every time", async () => {
    // Initialiser le joueur un avec le vrai programme de métadonnées
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: metadataProgram.programId,
        authority: playerOne.publicKey,
      })
      .signers([playerOne])
      .rpc()

    // Initialiser l'attaquant avec un faux programme de métadonnées
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: fakeMetadataProgram.programId,
        authority: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    // Récupérer les comptes de métadonnées des deux joueurs
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

    // Le joueur régulier devrait avoir une santé et une puissance entre 0 et 20
    expect(playerOneMetadata.health).to.be.lessThan(20)
    expect(playerOneMetadata.power).to.be.lessThan(20)

    // L'attaquant aura une santé et une puissance de 255
    expect(attackerMetadata.health).to.equal(255)
    expect(attackerMetadata.power).to.equal(255)
})
```

Ce test parcourt le scénario où un joueur régulier et un attaquant créent tous deux leurs personnages. Seul l'attaquant passe l'ID de programme du faux programme de métadonnées au lieu du programme de métadonnées réel. Et comme l'instruction `create_character_insecure` n'a pas de vérifications de programme, elle s'exécute toujours.

Le résultat est que le personnage régulier a la quantité appropriée de santé et de puissance: chaque valeur entre 0 et 20. Mais la santé et la puissance de l'attaquant sont chacune de 255, rendant l'attaquant imbattable.

Si ce n'est pas déjà fait, exécutez `anchor test` pour voir que ce test se comporte comme décrit.

### 3. Créez une instruction `create_character_secure`

Fixons cela en créant une instruction sécurisée pour créer un nouveau personnage. Cette instruction doit implémenter des vérifications de programme appropriées et utiliser la crate `cpi` du programme `character-metadata` pour effectuer la CPI plutôt que d'utiliser simplement `invoke` directement.

Si vous voulez tester vos compétences, essayez cela par vous-même avant de continuer.

Nous commencerons par mettre à jour notre déclaration `use` en haut du fichier `lib.rs` du programme `gameplay`. Nous nous donnons accès au type du programme pour la validation du compte et à la fonction d'aide pour émettre la CPI `create_metadata`.

```rust
use character_metadata::{
    cpi::accounts::CreateMetadata,
    cpi::create_metadata,
    program::CharacterMetadata,
};
```

Ensuite, créons une nouvelle struct de validation de compte appelée `CreateCharacterSecure`. Cette fois, nous faisons du `metadata_program` un type `Program`:

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

Enfin, ajoutons l'instruction `create_character_secure`. Elle sera la même qu'auparavant, mais utilisera la fonctionnalité complète des CPI d'Anchor au lieu d'utiliser `invoke` directement:

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

### 4. Testez `create_character_secure`

Maintenant que nous avons une méthode sécurisée pour initialiser un nouveau personnage, créons un nouveau test. Ce test doit simplement tenter d'initialiser le personnage de l'attaquant et s'attendre à ce qu'une erreur soit déclenchée.

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
        .rpc()
    } catch (error) {
      expect(error)
      console.log(error)
    }
})
```

Exécutez `anchor test` si ce n'est pas déjà fait. Remarquez qu'une erreur a été déclenchée comme prévu, détaillant que l'ID de programme passé dans l'instruction n'est pas l'ID de programme attendu:

```bash
'Program log: AnchorError caused by account: metadata_program. Error Code: InvalidProgramId. Error Number: 3008. Error Message: Program ID was not as expected.',
'Program log: Left:',
'Program log: FKBWhshzcQa29cCyaXc1vfkZ5U985gD5YsqfCzJYUBr',
'Program log: Right:',
'Program log: D4hPnYEsAx4u3EQMrKEXsY3MkfLndXbBKTEYTwwm25TE'
```

C'est tout ce dont vous avez besoin pour vous protéger contre les CPI arbitraires !

Il peut arriver que vous souhaitiez plus de flexibilité dans les CPI de votre programme. Nous ne vous empêcherons certainement pas de concevoir le programme dont vous avez besoin, mais prenez toutes les précautions possibles pour éviter toute vulnérabilité dans votre programme.

Si vous voulez jeter un œil au code de solution final, vous pouvez le trouver sur la branche `solution` du [même dépôt](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/solution).

# Défi

Tout comme avec les autres leçons de cette unité, votre opportunité de pratiquer l'évitement de cette faille de sécurité réside dans l'audit de vos propres programmes ou d'autres programmes.

Prenez le temps de passer en revue au moins un programme et assurez-vous que des vérifications de programme sont en place pour chaque programme passé dans les instructions, en particulier ceux qui sont invoqués via CPI.

N'oubliez pas, si vous trouvez un bogue ou une faille dans le programme de quelqu'un d'autre, veuillez les alerter ! Si vous en trouvez un dans votre propre programme, assurez-vous de le corriger rapidement pour protéger vos utilisateurs.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=5bcaf062-c356-4b58-80a0-12cca99c29b0) !
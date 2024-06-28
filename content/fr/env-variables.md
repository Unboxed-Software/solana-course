---
title: Variables d'environnement dans les programmes Solana
objectives:
- Définir les fonctionnalités du programme dans le fichier `Cargo.toml`
- Utiliser l'attribut Rust `cfg` pour compiler conditionnellement du code en fonction des fonctionnalités activées ou désactivées
- Utiliser la macro Rust `cfg!` pour compiler conditionnellement du code en fonction des fonctionnalités activées ou désactivées
- Créer une instruction réservée à l'administrateur pour configurer un compte de programme pouvant stocker des valeurs de configuration
---

# Résumé

- Il n'y a pas de solutions "prêtes à l'emploi" pour créer des environnements distincts dans un programme onchain, mais vous pouvez obtenir quelque chose de similaire aux variables d'environnement en étant créatif.
- Vous pouvez utiliser l'attribut `cfg` avec les **fonctionnalités Rust** (`#[cfg(feature = ...)]`) pour exécuter un code différent ou fournir des valeurs de variable différentes en fonction de la fonctionnalité Rust fournie. _Cela se produit à la compilation et ne permet pas de remplacer les valeurs après le déploiement du programme_.
- De même, vous pouvez utiliser la **macro** `cfg!` Rust pour compiler des chemins de code différents en fonction des fonctionnalités activées.
- En alternative, vous pouvez obtenir quelque chose de similaire aux variables d'environnement modifiables après le déploiement en créant des comptes et des instructions accessibles uniquement par l'autorité de mise à niveau du programme.

# Aperçu général

L'un des défis auxquels les ingénieurs sont confrontés dans tous les types de développement logiciel est celui d'écrire un code testable et de créer des environnements distincts pour le développement local, les tests, la production, etc.

Cela peut être particulièrement difficile dans le développement de programmes Solana. Par exemple, imaginez la création d'un programme de mise en jeu de NFT qui récompense chaque NFT mis en jeu avec 10 jetons de récompense par jour. Comment tester la capacité à réclamer des récompenses lorsque les tests s'exécutent en quelques centaines de millisecondes, pas assez longtemps pour gagner des récompenses?

Le développement web traditionnel résout en partie ce problème avec des variables d'environnement dont les valeurs peuvent différer dans chaque "environnement" distinct. Actuellement, il n'y a pas de concept formel de variables d'environnement dans un programme Solana. S'il y en avait, vous pourriez simplement faire en sorte que les récompenses dans votre environnement de test soient de 10 000 000 jetons par jour, ce qui faciliterait le test de la capacité à réclamer des récompenses.

Heureusement, vous pouvez obtenir une fonctionnalité similaire en étant créatif. La meilleure approche est probablement une combinaison de deux choses:

1. Les indicateurs de fonctionnalités Rust qui vous permettent de spécifier l'"environnement" dans votre commande de build, associés à du code qui ajuste les valeurs spécifiques en conséquence.
2. Des comptes et instructions "réservés à l'administrateur" qui ne sont accessibles que par l'autorité de mise à niveau du programme.

## Indicateurs de fonctionnalités Rust

L'une des façons les plus simples de créer des environnements est d'utiliser les fonctionnalités Rust. Les fonctionnalités sont définies dans la table `[features]` du fichier `Cargo.toml` du programme. Vous pouvez définir plusieurs fonctionnalités pour différents cas d'utilisation.

```toml
[features]
feature-one = []
feature-two = []
```

Il est important de noter que ce qui précède définit simplement une fonctionnalité. Pour activer une fonctionnalité lors du test de votre programme, vous pouvez utiliser le drapeau `--features` avec la commande `anchor test`.

```bash
anchor test -- --features "feature-one"
```

Vous pouvez également spécifier plusieurs fonctionnalités en les séparant par une virgule.

```bash
anchor test -- --features "feature-one", "feature-two"
```

### Rendre le code conditionnel avec l'attribut `cfg`

Avec une fonctionnalité définie, vous pouvez ensuite utiliser l'attribut `cfg` dans votre code pour compiler conditionnellement du code en fonction de la fonctionnalité activée ou désactivée. Cela vous permet d'inclure ou d'exclure certains morceaux de code de votre programme.

La syntaxe pour utiliser l'attribut `cfg` est comme tout autre macro attribut : `#[cfg(feature=[FEATURE_HERE])]`. Par exemple, le code suivant compile la fonction `function_for_testing` lorsque la fonctionnalité `testing` est activée, et `function_when_not_testing` sinon :

```rust
#[cfg(feature = "testing")]
fn function_for_testing() {
    // code qui sera inclus uniquement si le drapeau de fonctionnalité "testing" est activé
}

#[cfg(not(feature = "testing"))]
fn function_when_not_testing() {
    // code qui sera inclus uniquement si le drapeau de fonctionnalité "testing" n'est pas activé
}
```

Cela vous permet d'activer ou de désactiver certaines fonctionnalités de votre programme Anchor lors de la compilation en activant ou désactivant la fonctionnalité.

Il n'est pas difficile d'imaginer vouloir utiliser cela pour créer des "environnements" distincts pour différents déploiements de programmes. Par exemple, tous les tokens n'ont pas de déploiements à la fois sur Mainnet et Devnet. Vous pourriez donc codifier en dur une adresse de token pour les déploiements sur Mainnet, mais une adresse différente pour les déploiements sur Devnet et Localnet. Ainsi, vous pouvez rapidement basculer entre différents environnements sans nécessiter de modifications dans le code lui-même.

Le code ci-dessous montre un exemple de programme Anchor qui utilise l'attribut `cfg` pour inclure différentes adresses de token pour les tests locaux par rapport aux autres déploiements :

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[cfg(feature = "local-testing")]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("WaoKNLQVDyBx388CfjaVeyNbs3MT2mPgAhoCfXyUvg8");
}

#[cfg(not(feature = "local-testing"))]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

#[program]
pub mod test_program {
    use super::*;

    pub fn initialize_usdc_token_account(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = payer,
    )]
    pub token: Account<'info, TokenAccount>,
    #[account(address = constants::USDC_MINT_PUBKEY)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

Dans cet exemple, l'attribut `cfg` est utilisé pour compiler conditionnellement deux implémentations différentes du module `constants`. Cela permet au programme d'utiliser des valeurs différentes pour la constante `USDC_MINT_PUBKEY` en fonction de l'activation ou de la désactivation de la fonctionnalité `local-testing`.

### Rendre le code conditionnel avec la macro `cfg!`

Tout comme l'attribut `cfg`, la macro `cfg!` en Rust vous permet de vérifier les valeurs de certains indicateurs de configuration au moment de l'exécution. Cela peut être utile si vous souhaitez exécuter différents chemins de code en fonction des valeurs de certains indicateurs de configuration.

Vous pourriez l'utiliser pour contourner ou ajuster les contraintes liées au temps nécessaires dans l'application de mise en jeu NFT mentionnée précédemment. Lors de l'exécution d'un test, vous pouvez exécuter du code qui offre des récompenses de mise en jeu bien plus élevées par rapport à l'exécution d'un build de production.

Pour utiliser la macro `cfg!` dans un programme Anchor, ajoutez simplement un appel à la macro `cfg!` à l'instruction conditionnelle en question :

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn test_function(ctx: Context<Test>) -> Result<()> {
        if cfg!(feature = "local-testing") {
            // Ce code sera exécuté uniquement si la fonctionnalité "local-testing" est activée
            // ...
        } else {
            // Ce code sera exécuté uniquement si la fonctionnalité "local-testing" n'est pas activée
            // ...
        }
        // Le code qui doit toujours être inclus va ici
        ...
        Ok(())
    }
}
```

Dans cet exemple, la fonction `test_function` utilise la macro `cfg!` pour vérifier la valeur de la fonctionnalité `local-testing` au moment de l'exécution. Si la fonctionnalité `local-testing` est activée, le premier chemin de code est exécuté. Si la fonctionnalité `local-testing` n'est pas activée, le second chemin de code est exécuté à la place.

## Instructions réservées à l'administrateur

Les indicateurs de fonctionnalités sont excellents pour ajuster des valeurs et des chemins de code lors de la compilation, mais ils n'aident pas beaucoup si vous devez ajuster quelque chose après avoir déjà déployé votre programme.

Par exemple, si votre programme de mise en jeu NFT doit changer et utiliser un jeton de récompense différent, il n'y aurait aucun moyen de mettre à jour le programme sans le redéployer. Si seulement il existait un moyen pour les administrateurs du programme de mettre à jour certaines valeurs du programme... Eh bien, c'est possible !

Tout d'abord, vous devez structurer votre programme pour stocker les valeurs que vous prévoyez de modifier dans un compte plutôt que de les coder en dur dans le code du programme.

Ensuite, vous devez vous assurer que ce compte ne peut être mis à jour que par une autorité de programme connue, ou ce que nous appelons un administrateur. Cela signifie que toutes les instructions qui modifient les données de ce compte doivent avoir des contraintes limitant qui peut signer l'instruction. Cela semble assez simple en théorie, mais il y a un problème majeur : comment le programme sait-il qui est un administrateur autorisé ?

Eh bien, il existe quelques solutions, chacune ayant ses avantages et ses inconvénients :

1. Codifiez en dur une clé publique d'administrateur qui peut être utilisée dans les contraintes d'instructions réservées à l'administrateur.
2. Faites de l'autorité de mise à niveau du programme l'administrateur.
3. Stockez l'administrateur dans le compte de configuration et définissez le premier administrateur dans une instruction `initialize`.

### Créer le compte de configuration

La première étape consiste à ajouter ce que nous appellerons un compte "config" à votre programme. Vous pouvez le personnaliser selon vos besoins, mais nous suggérons une PDA (Program Derived Address) globale unique. Dans Anchor, cela signifie simplement créer une structure de compte et utiliser une seule seed pour dériver l'adresse du compte.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

L'exemple ci-dessus montre un compte de configuration hypothétique pour l'exemple de programme de mise en jeu de NFT auquel nous avons fait référence tout au long de la leçon. Il stocke des données représentant le token qui devrait être utilisé pour les récompenses et la quantité de tokens à distribuer pour chaque jour de mise en jeu.

Une fois le compte de configuration défini, assurez-vous simplement que le reste de votre code fait référence à ce compte lors de l'utilisation de ces valeurs. Ainsi, si les données du compte changent, le programme s'adapte en conséquence.

### Contraindre les mises à jour de la configuration aux administrateurs codés en dur

Vous aurez besoin d'une façon d'initialiser et de mettre à jour les données du compte de configuration. Cela signifie que vous devez avoir une ou plusieurs instructions que seul un administrateur peut invoquer. La manière la plus simple de le faire est de coder en dur la clé publique d'un administrateur dans votre code, puis d'ajouter une vérification de signataire dans la validation du compte de l'instruction comparant le signataire à cette clé publique.

Dans Anchor, contraindre une instruction `update_program_config` pour n'être utilisable que par une clé publique d'administrateur codée en dur pourrait ressembler à ceci :

```rust
#[program]
mod my_program {
    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        reward_token: Pubkey,
        rewards_per_day: u64
    ) -> Result<()> {
        ctx.accounts.program_config.reward_token = reward_token;
        ctx.accounts.program_config.rewards_per_day = rewards_per_day;

        Ok(())
    }
}

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN_PUBKEY: Pubkey = pubkey!("ADMIN_WALLET_ADDRESS_HERE");

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == ADMIN_PUBKEY)]
    pub authority: Signer<'info>,
}
```

Avant même l'exécution de la logique de l'instruction, une vérification sera effectuée pour s'assurer que le signataire de l'instruction correspond à la clé publique codée en dur `ADMIN_PUBKEY`. Remarquez que l'exemple ci-dessus ne montre pas l'instruction qui initialise le compte de configuration, mais elle devrait avoir des contraintes similaires pour garantir qu'un attaquant ne peut pas initialiser le compte avec des valeurs inattendues.

Bien que cette approche fonctionne, cela signifie également de suivre un portefeuille administrateur en plus du suivi de l'autorité de mise à niveau d'un programme. Avec quelques lignes de code supplémentaires, vous pourriez simplement restreindre une instruction à être appelée uniquement par l'autorité de mise à niveau. La seule partie délicate est d'obtenir l'autorité de mise à niveau d'un programme à comparer.

### Contraindre les mises à jour de la configuration à l'autorité de mise à niveau du programme

Heureusement, chaque programme a un compte de données de programme qui se traduit par le type de compte `ProgramData` d'Anchor et a le champ `upgrade_authority_address`. Le programme lui-même stocke l'adresse de ce compte dans ses données dans le champ `programdata_address`.

Ainsi, en plus des deux comptes requis par l'instruction dans l'exemple d'administrateur codé en dur, cette instruction nécessite les comptes `program` et `program_data` suivants.

Les comptes doivent alors avoir les contraintes suivantes :

1. Une contrainte sur `program` garantissant que le compte `program_data` fourni correspond à l'adresse `programdata_address` du programme.
2. Une contrainte sur le compte `program_data` garantissant que le signataire de l'instruction correspond au champ `upgrade_authority_address` du compte `program_data`.

Une fois terminé, cela ressemble à ceci :

```rust
...

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, MyProgram>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()))]
    pub program_data: Account<'info, ProgramData>,
    pub authority: Signer<'info>,
}
```

Encore une fois, l'exemple ci-dessus ne montre pas l'instruction qui initialise le compte de configuration, mais elle devrait avoir les mêmes contraintes pour garantir qu'un attaquant ne peut pas initialiser le compte avec des valeurs inattendues.

Si c'est la première fois que vous entendez parler du compte de données de programme, il vaut la peine de lire ce [document Notion](https://www.notion.so/29780c48794c47308d5f138074dd9838) sur les déploiements de programmes.

### Contraindre les mises à jour de la configuration à un administrateur fourni

Les deux options précédentes sont assez sécurisées mais aussi inflexibles. Que faire si vous voulez mettre à jour l'administrateur pour qu'il soit quelqu'un d'autre? Pour cela, vous pouvez stocker l'administrateur dans le compte de configuration.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    admin: Pubkey,
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

Ensuite, vous pouvez contraindre vos instructions de mise à jour avec une vérification de signataire correspondant au champ `admin` du compte de configuration.

```rust
...

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == program_config.admin)]
    pub authority: Signer<'info>,
}
```

Il y a une petite subtilité ici : dans le laps de temps entre le déploiement d'un programme et l'initialisation du compte de configuration, _il n'y a pas d'administrateur_. Cela signifie que l'instruction d'initialisation du compte de configuration ne peut pas être limitée pour n'autoriser que des administrateurs comme appelants. Cela signifie qu'elle pourrait être appelée par un attaquant cherchant à se définir comme administrateur.

Bien que cela puisse sembler mauvais, cela signifie simplement que vous ne devriez pas considérer votre programme comme "initialisé" tant que vous n'avez pas initialisé le compte de configuration vous-même et vérifié que l'administrateur répertorié sur le compte est celui que vous attendez. Si votre script de déploiement déploie et appelle immédiatement `initialize`, il est très improbable qu'un attaquant soit même au courant de l'existence de votre programme, sans parler d'essayer de se définir comme administrateur. Si par malchance folle quelqu'un "intercepte" votre programme, vous pouvez fermer le programme avec l'autorité de mise à niveau et le redéployer.

# Laboratoire

Maintenant, essayons cela ensemble. Pour ce laboratoire, nous travaillerons avec un programme simple permettant des paiements en USDC. Le programme prélève des frais pour faciliter le transfert. Notez que c'est quelque peu artificiel car vous pouvez effectuer des transferts directs sans contrat intermédiaire, mais cela simule le fonctionnement de certains programmes DeFi complexes.

Nous apprendrons rapidement en testant notre programme qu'il pourrait bénéficier de la flexibilité offerte par un compte de configuration contrôlé par l'administrateur et quelques indicateurs de fonctionnalités.

### 1. Démarrage

Téléchargez le code de départ à partir de la branche `starter` de [ce référentiel](https://github.com/Unboxed-Software/solana-admin-instructions/tree/starter). Le code contient un programme avec une seule instruction et un seul test dans le répertoire `tests`.

Parcourons rapidement le fonctionnement du programme.

Le fichier `lib.rs` contient une constante pour l'adresse USDC et une seule instruction `payment` (paiement). L'instruction `payment` appelle simplement la fonction `payment_handler` dans le fichier `instructions/payment.rs` où la logique de l'instruction est contenue.

Le fichier `instructions/payment.rs` contient à la fois la fonction `payment_handler` ainsi que la structure de validation du compte `Payment` représentant les comptes requis par l'instruction `payment`. La fonction `payment_handler` calcule une commission de 1% sur le montant du paiement, transfère la commission vers un compte de jetons désigné, et transfère le montant restant au destinataire du paiement.

Enfin, le répertoire `tests` contient un seul fichier de test, `config.ts`, qui invoque simplement l'instruction `payment` et vérifie que les soldes correspondants des comptes de jetons ont été débités et crédités en conséquence.

Avant de continuer, prenez quelques minutes pour vous familiariser avec ces fichiers et leur contenu.

### 2. Exécutez le test existant

Commençons par exécuter le test existant.

Assurez-vous d'utiliser `yarn` ou `npm install` pour installer les dépendances définies dans le fichier `package.json`. Ensuite, assurez-vous d'exécuter `anchor keys list` pour obtenir la clé publique de votre programme imprimée dans la console. Cela dépend de la paire de clés que vous avez localement, alors assurez-vous de mettre à jour `lib.rs` et `Anchor.toml` pour utiliser **votre** clé.

Enfin, exécutez `anchor test` pour démarrer le test. Il devrait échouer avec la sortie suivante :

```
Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: incorrect program id for instruction
```

La raison de cette erreur est que nous essayons d'utiliser l'adresse du jeton USDC principal (codée en dur dans le fichier `lib.rs` du programme), mais ce jeton n'existe pas dans l'environnement local.

### 3. Ajout d'une fonctionnalité `local-testing`

Pour résoudre cela, nous avons besoin d'un jeton que nous pouvons utiliser localement *et* codé en dur dans le programme. Comme l'environnement local est souvent réinitialisé lors des tests, vous devrez stocker une paire de clés que vous pouvez utiliser pour recréer la même adresse de jeton à chaque fois.

De plus, vous ne voulez pas avoir à changer l'adresse codée en dur entre les versions locales et principales, car cela pourrait introduire une erreur humaine (et est simplement ennuyeux). Nous allons donc créer une fonctionnalité `local-testing` qui, lorsqu'elle est activée, fera utiliser notre jeton local par le programme mais sinon utilisera le jeton USDC de production.

Générez une nouvelle paire de clés en exécutant `solana-keygen grind`. Exécutez la commande suivante pour générer une paire de clés avec une clé publique qui commence par "env".

```
solana-keygen grind --starts-with env:1
```

Une fois une paire de clés trouvée, vous devriez voir une sortie similaire à ce qui suit :

```
Wrote keypair to env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json
```

La paire de clés est écrite dans un fichier de votre répertoire de travail. Maintenant que nous avons une adresse USDC fictive, modifions le fichier `lib.rs`. Utilisez l'attribut `cfg` pour définir la constante `USDC_MINT_PUBKEY` en fonction de la fonctionnalité `local-testing`. N'oubliez pas de définir la constante `USDC_MINT_PUBKEY` pour `local-testing` avec celle générée à l'étape précédente plutôt que de copier celle ci-dessous.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("...");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

#[program]
pub mod config {
    use super::*;

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

Ensuite, ajoutez la fonctionnalité `local-testing` au fichier `Cargo.toml` situé dans `/programs`.

```
[features]
...
local-testing = []
```

Ensuite, mettez à jour le fichier de test `config.ts` pour créer un jeton en utilisant la paire de clés générée. Commencez par supprimer la constante `mint`.

```typescript
const mint = new anchor.web3.PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
```

Ensuite, mettez à jour le test pour créer un jeton en utilisant la paire de clés, ce qui nous permettra de réutiliser la même adresse de jeton à chaque exécution des tests. N'oubliez pas de remplacer le nom de fichier par celui généré à l'étape précédente.

```typescript
let mint: anchor.web3.PublicKey

before(async () => {
  let data = fs.readFileSync(
    "env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json"
  )

  let keypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(data))
  )

  const mint = await spl.createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    0,
    keypair
  )
...
```

Enfin, exécutez le test avec la fonctionnalité `local-testing` activée.

```
anchor test -- --features "local-testing"
```

Vous devriez voir la sortie suivante :

```
config
  ✔ Payment completes successfully (406ms)


1 passing (3s)
```

Boom. Juste comme ça, vous avez utilisé des fonctionnalités pour exécuter deux chemins de code différents pour différents environnements.

### 4. Configuration du programme

Les fonctionnalités sont idéales pour définir différentes valeurs à la compilation, mais que faire si vous vouliez pouvoir mettre à jour dynamiquement le pourcentage de frais utilisé par le programme ? Faisons cela en créant un compte de configuration du programme qui nous permet de mettre à jour les frais sans mettre à niveau le programme.

Pour commencer, mettons d'abord à jour le fichier `lib.rs` pour :

1. Inclure une constante `SEED_PROGRAM_CONFIG` qui sera utilisée pour générer la PDA pour le compte de configuration du programme.
2. Inclure une constante `ADMIN` qui sera utilisée comme contrainte lors de l'initialisation du compte de configuration du programme. Exécutez la commande `solana address` pour obtenir votre adresse à utiliser comme valeur constante.
3. Inclure un module `state` que nous implémenterons sous peu.
4. Inclure les instructions `initialize_program_config` et `update_program_config` ainsi que les appels à leurs "handlers", que nous implémenterons dans une autre étape.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
mod state;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("envgiPXWwmpkHFKdy4QLv2cypgAWmVTVEm71YbNpYRu");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN: Pubkey = pubkey!("...");

#[program]
pub mod config {
    use super::*;

    pub fn initialize_program_config(ctx: Context<InitializeProgramConfig>) -> Result<()> {
        instructions::initialize_program_config_handler(ctx)
    }

    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        new_fee: u64,
    ) -> Result<()> {
        instructions::update_program_config_handler(ctx, new_fee)
    }

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

### 5. État de configuration du programme

Ensuite, définissons la structure de l'état du compte `ProgramConfig`. Ce compte stockera l'administrateur, le compte de jetons où les frais sont envoyés et le taux de frais. Nous spécifierons également le nombre d'octets nécessaires pour stocker cette structure.

Créez un nouveau fichier appelé `state.rs` dans le répertoire `/src` et ajoutez le code suivant.

```rust
use anchor_lang::prelude::*;

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_basis_points: u64,
}

impl ProgramConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8;
}
```

### 6. Ajout de l'instruction `Initialize Program Config`

Créons maintenant la logique d'instruction pour initialiser le compte de configuration du programme. Elle ne peut être appelée que par une transaction signée par la clé `ADMIN` et doit définir toutes les propriétés sur le compte `ProgramConfig`.

Créez un dossier appelé `program_config` dans le chemin `/src/instructions/program_config`. Ce dossier stockera toutes les instructions liées au compte de configuration du programme.

Dans le dossier `program_config`, créez un fichier appelé `initialize_program_config.rs` et ajoutez le code suivant.

```rust
use crate::state::ProgramConfig;
use crate::ADMIN;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct InitializeProgramConfig<'info> {
    #[account(init, seeds = [SEED_PROGRAM_CONFIG], bump, payer = authority, space = ProgramConfig::LEN)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(mut, address = ADMIN)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_program_config_handler(ctx: Context<InitializeProgramConfig>) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.authority.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = 100;
    Ok(())
}
```

### 7. Ajout de l'instruction `Update Program Config Fee`

Ensuite, implémentons la logique d'instruction pour mettre à jour le compte de configuration. L'instruction doit exiger que le signataire corresponde à l'administrateur stocké dans le compte `program_config`.

Dans le dossier `program_config`, créez un fichier appelé `update_program_config.rs` et ajoutez le code suivant.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = [SEED_PROGRAM_CONFIG], bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = program_config.admin,
    )]
    pub admin: Signer<'info>,
    /// CHECK: arbitrarily assigned by existing admin
    pub new_admin: UncheckedAccount<'info>,
}

pub fn update_program_config_handler(
    ctx: Context<UpdateProgramConfig>,
    new_fee: u64,
) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.new_admin.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = new_fee;
    Ok(())
}
```

### 8. Ajout de mod.rs et mise à jour de instructions.rs

Ensuite, exposons les gestionnaires d'instructions que nous avons créés pour que l'appel depuis `lib.rs` ne génère pas d'erreur. Commencez par ajouter un fichier `mod.rs` dans le dossier `program_config`. Ajoutez le code ci-dessous pour rendre les deux modules, `initialize_program_config` et `update_program_config`, accessibles.

```rust
mod initialize_program_config;
pub use initialize_program_config::*;

mod update_program_config;
pub use update_program_config::*;
```

Maintenant, mettez à jour `instructions.rs` dans le chemin `/src/instructions.rs`. Ajoutez le code ci-dessous pour rendre les deux modules, `program_config` et `payment`, accessibles.

```rust
mod program_config;
pub use program_config::*;

mod payment;
pub use payment::*;
```

### 9. Mise à jour de l'instruction `Payment`

Enfin, mettons à jour l'instruction de paiement pour vérifier que le compte `fee_destination` dans l'instruction correspond au `fee_destination` stocké dans le compte de configuration du programme. Ensuite, mettez à jour le calcul des frais de l'instruction pour être basé sur le `fee_basis_point` stocké dans le compte de configuration du programme.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(
        seeds = [SEED_PROGRAM_CONFIG],
        bump,
        has_one = fee_destination
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub receiver_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub sender: Signer<'info>,
}

pub fn payment_handler(ctx: Context<Payment>, amount: u64) -> Result<()> {
    let fee_amount = amount
        .checked_mul(ctx.accounts.program_config.fee_basis_points)
        .unwrap()
        .checked_div(10000)
        .unwrap();
    let remaining_amount = amount.checked_sub(fee_amount).unwrap();

    msg!("Amount: {}", amount);
    msg!("Fee Amount: {}", fee_amount);
    msg!("Remaining Transfer Amount: {}", remaining_amount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.fee_destination.to_account_info(),
            },
        ),
        fee_amount,
    )?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.receiver_token_account.to_account_info(),
            },
        ),
        remaining_amount,
    )?;

    Ok(())
}
```

### 10. Test

Maintenant que nous avons terminé la mise en œuvre de notre nouvelle structure de configuration de programme et des instructions, passons aux tests de notre programme mis à jour. Pour commencer, ajoutez la PDA pour le compte de configuration du programme au fichier de test.

```typescript
describe("config", () => {
  ...
  const programConfig = findProgramAddressSync(
    [Buffer.from("program_config")],
    program.programId
  )[0]
...
```

Ensuite, mettez à jour le fichier de test avec trois tests supplémentaires vérifiant que :

1. Le compte de configuration du programme est initialisé correctement.
2. L'instruction de paiement fonctionne comme prévu.
3. Le compte de configuration peut être mis à jour avec succès par l'administrateur.
4. Le compte de configuration ne peut pas être mis à jour par quelqu'un d'autre que l'administrateur.

Le premier test initialise le compte de configuration du programme et vérifie que le frais correct est défini et que l'administrateur correct est stocké sur le compte de configuration du programme.

```typescript
it("Initialize Program Config Account", async () => {
  const tx = await program.methods
    .initializeProgramConfig()
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      authority: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    100
  )
  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).admin.toString(),
    wallet.publicKey.toString()
  )
})
```

Le deuxième test vérifie que l'instruction de paiement fonctionne correctement, avec les frais envoyés au destinataire des frais et le solde restant transféré au destinataire. Ici, nous mettons à jour le test existant pour inclure le compte `programConfig`.

```typescript
it("Payment completes successfully", async () => {
  const tx = await program.methods
    .payment(new anchor.BN(10000))
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      senderTokenAccount: senderTokenAccount,
      receiverTokenAccount: receiverTokenAccount,
      sender: sender.publicKey,
    })
    .transaction()

  await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])

  assert.strictEqual(
    (await connection.getTokenAccountBalance(senderTokenAccount)).value
      .uiAmount,
    0
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(feeDestination)).value.uiAmount,
    100
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(receiverTokenAccount)).value
      .uiAmount,
    9900
  )
})
```

Le troisième test tente de mettre à jour le frais sur le compte de configuration du programme, ce qui devrait réussir.

```typescript
it("Update Program Config Account", async () => {
  const tx = await program.methods
    .updateProgramConfig(new anchor.BN(200))
    .accounts({
      programConfig: programConfig,
      admin: wallet.publicKey,
      feeDestination: feeDestination,
      newAdmin: sender.publicKey,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    200
  )
})
```

Le quatrième test tente de mettre à jour le compte de configuration du programme sans signer en tant que l'administrateur stocké sur le compte de configuration, ce qui devrait échouer.

```typescript
it("Update Program Config Account with unauthorized admin (expect fail)", async () => {
  try {
    const tx = await program.methods
      .updateProgramConfig(new anchor.BN(300))
      .accounts({
        programConfig: programConfig,
        admin: sender.publicKey,
        feeDestination: feeDestination,
        newAdmin: sender.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])
  } catch (err) {
    expect(err)
  }
})
```

Exécutez les tests avec la commande suivante :

```
anchor test -- --features "local-testing"
```

Vous devriez voir la sortie suivante :

```
config
  ✔ Initialize Program Config Account (199ms)
  ✔ Payment completes successfully (405ms)
  ✔ Update Program Config Account (403ms)
  ✔ Update Program Config Account with unauthorized admin (expect fail)

4 passing (8s)
```

Et voilà ! Vous avez rendu le programme beaucoup plus facile à utiliser à l'avenir. Si vous souhaitez consulter le code de la solution finale, vous pouvez le trouver sur la branche `solution` du [même dépôt](https://github.com/Unboxed-Software/solana-admin-instructions/tree/solution).

# Défi

Maintenant, c'est à vous de jouer. Nous avons mentionné la possibilité d'utiliser l'autorité de mise à niveau du programme en tant qu'administrateur initial. Allez-y et mettez à jour la fonction `initialize_program_config` du laboratoire de telle sorte que seule l'autorité de mise à niveau puisse l'appeler, plutôt que d'avoir un `ADMIN` codé en dur.

Notez que la commande `anchor test`, lorsqu'elle est exécutée sur un réseau local, lance un nouveau validateur de test à l'aide de `solana-test-validator`. Ce validateur de test utilise un chargeur non-misable. Le chargeur non-misable fait en sorte que le compte `program_data` du programme ne soit pas initialisé lorsque le validateur démarre. Vous vous souviendrez de la leçon selon laquelle ce compte est la façon dont nous accédons à l'autorité de mise à niveau depuis le programme.

Pour contourner cela, vous pouvez ajouter une fonction `deploy` au fichier de test qui exécute la commande de déploiement du programme avec un chargeur misable. Pour l'utiliser, exécutez `anchor test --skip-deploy` et appelez la fonction `deploy` dans le test pour exécuter la commande de déploiement après le démarrage du validateur de test.

```typescript
import { execSync } from "child_process"

...

const deploy = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/config-keypair.json $(pwd)/target/deploy/config.so`
  execSync(deployCmd)
}

...

before(async () => {
  ...
  deploy()
})
```

Par exemple, la commande pour exécuter le test avec des fonctionnalités ressemblerait à ceci :

```
anchor test --skip-deploy -- --features "local-testing"
```

Essayez de faire cela par vous-même, mais si vous êtes bloqué, n'hésitez pas à consulter la branche `challenge` du [même dépôt](https://github.com/Unboxed-Software/solana-admin-instructions/tree/challenge) pour voir une solution possible. 

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=02a7dab7-d9c1-495b-928c-a4412006ec20) !
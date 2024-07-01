---
title: Introduction au développement avec Anchor
objectives:
- Utiliser le framework Anchor pour construire un programme de base
- Décrire la structure de base d'un programme Anchor
- Expliquer comment implémenter une validation de compte de base et des vérifications de sécurité avec Anchor
---

# Résumé

- **Anchor** est un framework pour construire des programmes Solana
- Les **macros Anchor** accélèrent le processus de construction de programmes Solana en abstrayant une quantité importante de code boilerplate
- Anchor vous permet de construire des **programmes sécurisés** plus facilement en effectuant certaines vérifications de sécurité, en exigeant une validation de compte et en fournissant un moyen simple de mettre en œuvre des vérifications supplémentaires.

# Aperçu général

## Qu'est-ce qu'Anchor?

Anchor est un framework de développement qui rend l'écriture de programmes Solana plus facile, plus rapide et plus sécurisée. C'est le framework de choix pour le développement sur Solana pour de très bonnes raisons. Il facilite l'organisation et la compréhension de votre code, implémente automatiquement des vérifications de sécurité courantes et abstrait une quantité significative de code boilerplate associé à l'écriture d'un programme Solana.

## Structure du programme Anchor

Anchor utilise des macros et des traits pour générer du code Rust boilerplate. Cela fournit une structure claire à votre programme pour que vous puissiez raisonner plus facilement sur votre code. Les principales macros et attributs de haut niveau sont :

- `declare_id` - une macro pour déclarer l'adresse onchain du programme
- `#[program]` - un attribut macro utilisé pour désigner le module contenant la logique d'instruction du programme
- `Accounts` - un trait appliqué aux structures représentant la liste des comptes requis pour une instruction
- `#[account]` - un attribut macro utilisé pour définir des types de compte personnalisés pour le programme

Parlons de chacun d'eux avant de mettre tous les éléments ensemble.

## Déclarer l'ID de votre programme

La macro `declare_id` est utilisée pour spécifier l'adresse onchain du programme (c'est-à-dire le `programId`). Lorsque vous construisez un programme Anchor pour la première fois, le framework générera une nouvelle paire de clés. Cela devient la paire de clés par défaut utilisée pour déployer le programme à moins d'être spécifié autrement. La clé publique correspondante doit être utilisée comme `programId` spécifié dans la macro `declare_id!`.

```rust
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
```

## Définir la logique d'instruction

L'attribut macro `#[program]` définit le module contenant toutes les instructions de votre programme. C'est là que vous implémentez la logique métier pour chaque instruction de votre programme.

Chaque fonction publique dans le module avec l'attribut `#[program]` sera traitée comme une instruction distincte.

Chaque fonction d'instruction nécessite un paramètre de type `Context` et peut éventuellement inclure des paramètres de fonction supplémentaires représentant les données d'instruction. Anchor gérera automatiquement la désérialisation des données d'instruction afin que vous puissiez travailler avec les données d'instruction en tant que types Rust.

```rust
#[program]
mod program_module_name {
    use super::*;

    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}
```

### Contexte d'instruction

Le type `Contexte` expose les métadonnées de l'instruction et les comptes à la logique de votre instruction.

```rust
pub struct Context<'a, 'b, 'c, 'info, T> {
    /// Identifiant du programme en cours d'exécution.
    pub program_id: &'a Pubkey,
    /// Comptes désérialisés.
    pub accounts: &'b mut T,
    /// Comptes restants donnés mais non désérialisés ou validés.
    /// Soyez très prudent lorsque vous utilisez ceci directement.
    pub remaining_accounts: &'c [AccountInfo<'info>],
    /// Bump seeds trouvés lors de la validation des contraintes.
    /// Ceci est fourni comme une commodité afin que les gestionnaires n'aient
    /// pas à recalculer les bump seeds ou les passer en arguments.
    pub bumps: BTreeMap<String, u8>,
}
```

`Contexte` est un type générique où `T` définit la liste des comptes requis par une instruction. Lorsque vous utilisez `Context`, vous spécifiez le type concret de `T` comme une structure qui adopte le trait `Accounts` (par exemple, `Context<AddMovieReviewAccounts>`). Grâce à cet argument de contexte, l'instruction peut alors accéder à :

- Les comptes passés à l'instruction (`ctx.accounts`)
- L'identifiant du programme (`ctx.program_id`) du programme en cours d'exécution
- Les comptes restants (`ctx.remaining_accounts`). Les `remaining_accounts` sont un vecteur qui contient tous les comptes qui ont été passés à l'instruction mais qui ne sont pas déclarés dans la structure `Accounts`.
- Les incréments pour les comptes PDA dans la structure `Accounts` (`ctx.bumps`)


## Définir les comptes d'instruction

Le trait `Accounts` définit une structure de données de comptes validés. Les structures qui adoptent ce trait définissent la liste des comptes requis pour une instruction donnée. Ces comptes sont ensuite exposés à travers le `Context` d'une instruction de sorte que l'itération et la désérialisation manuelles des comptes ne soient plus nécessaires.

Vous appliquez généralement le trait `Accounts` via la macro `derive` (par exemple, `#[derive(Accounts)]`). Cela implémente un désérialiseur `Accounts` sur la structure donnée et élimine la nécessité de désérialiser chaque compte manuellement.

Les implémentations du trait `Accounts` sont responsables de l'exécution de toutes les vérifications de contraintes requises pour garantir que les comptes répondent aux conditions nécessaires pour que le programme s'exécute en toute sécurité. Des contraintes sont fournies pour chaque champ à l'aide de l'attribut `#account(..)` (nous y reviendrons bientôt).

Par exemple, `instruction_one` nécessite un argument `Context` de type `InstructionAccounts`. La macro `#[derive(Accounts)]` est utilisée pour implémenter la structure `InstructionAccounts` qui inclut trois comptes : `account_name`, `user`, et `system_program`.

```rust
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		...
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}
```

Lorsque `instruction_one` est invoquée, le programme :

- Vérifie que les comptes passés à l'instruction correspondent aux types de compte spécifiés dans la structure `InstructionAccounts`.
- Vérifie les comptes par rapport à toute contrainte supplémentaire spécifiée.

Si des comptes passés à `instruction_one` échouent à la validation du compte ou aux vérifications de sécurité spécifiées dans la structure `InstructionAccounts`, alors l'instruction échoue avant même d'atteindre la logique du programme.

## Validation du compte

Vous avez peut-être remarqué dans l'exemple précédent qu'un des comptes dans `InstructionAccounts` était de type `Account`, un de type `Signer`, et un de type `Program`.

Anchor fournit plusieurs types de comptes qui peuvent être utilisés pour représenter des comptes. Nous allons passer en revue quelques-uns des types courants que vous pourriez rencontrer, mais assurez-vous de parcourir la [liste complète des types de comptes](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/index.html).

### `Account`

`Account` est un wrapper autour de `AccountInfo` qui vérifie la propriété du programme et désérialise les données sous-jacentes en un type Rust.

```rust
// Désérialise ces informations
pub struct AccountInfo<'a> {
    pub key: &'a Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
    pub lamports: Rc<RefCell<&'a mut u64>>,
    pub data: Rc<RefCell<&'a mut [u8]>>,    // <---- désérialise les données du compte
    pub owner: &'a Pubkey,    // <---- vérifie le propriétaire du programme
    pub executable: bool,
    pub rent_epoch: u64,
}
```

Rappelez-vous de l'exemple précédent où `InstructionAccounts` avait un champ `account_name` :

```rust
pub account_name: Account<'info, AccountStruct>
```

Le wrapper `Account` ici effectue les opérations suivantes :

- Désérialise les données du compte au format du type `AccountStruct`
- Vérifie que le propriétaire du programme du compte correspond au propriétaire du programme spécifié pour le type `AccountStruct`.

Lorsque le type de compte spécifié dans le wrapper `Account` est défini dans la même crate en utilisant la macro d'attribut `#[account]`, la vérification de propriété du programme est effectuée contre le `programId` défini dans la macro `declare_id!`.

Les vérifications suivantes sont effectuées :

```rust
// Vérifications
Account.info.owner == T::owner()
!(Account.info.owner == SystemProgram && Account.info.lamports() == 0)
```

### `Signer`

Le type `Signer` valide que le compte donné a signé la transaction. Aucune autre vérification de propriété ou de type n'est effectuée. Vous devriez utiliser `Signer` uniquement lorsque les données de compte sous-jacentes ne sont pas requises dans l'instruction.

Pour le compte `user` dans l'exemple précédent, le type `Signer` spécifie que le compte `user` doit être un signataire de l'instruction.

La vérification suivante est effectuée pour vous :

```rust
// Vérifications
Signer.info.is_signer == true
```

### `Program`

Le type `Program` valide que le compte est un certain programme.

Pour le compte `system_program` dans l'exemple précédent, le type `Program` est utilisé pour spécifier que le programme doit être le programme système. Anchor fournit un type `System` qui inclut le `programId` du programme système à vérifier.

Les vérifications suivantes sont effectuées pour vous :

```rust
// Vérifications
account_info.key == expected_program
account_info.executable == true
```

## Ajouter des contraintes avec `#[account(..)]`

La macro d'attribut `#[account(..)]` est utilisée pour appliquer des contraintes aux comptes. Nous allons passer en revue quelques exemples de contraintes dans cette leçon et dans les leçons futures, mais à un moment donné, assurez-vous de consulter la [liste complète des contraintes possibles](https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html).

Rappelez-vous encore une fois le champ `account_name` de l'exemple `InstructionAccounts`.

```rust
#[account(init, payer = user, space = 8 + 8)]
pub account_name: Account<'info, AccountStruct>,
#[account(mut)]
pub user: Signer<'info>,
```

Remarquez que l'attribut `#[account(..)]` contient trois valeurs séparées par des virgules :

- `init` - crée le compte via une CPI au programme système et l'initialise (définit son discriminateur de compte)
- `payer` - spécifie le payeur pour l'initialisation du compte comme le compte `user` défini dans la structure
- `space`- spécifie que l'espace alloué pour le compte doit être de `8 + 8` octets. Les premiers 8 octets sont pour un discriminateur que Anchor ajoute automatiquement pour identifier le type de compte. Les 8 octets suivants allouent de l'espace pour les données stockées sur le compte tel que défini dans le type `AccountStruct`.

Pour `user`, nous utilisons l'attribut `#[account(..)]` pour spécifier que le compte donné est mutable. Le compte `user` doit être marqué comme mutable car les lamports seront déduits du compte pour payer l'initialisation de `account_name`.

```rust
#[account(mut)]
pub user: Signer<'info>,
```

Remarquez que la contrainte `init` placée sur `account_name` inclut automatiquement une contrainte `mut` afin que `account_name` et `user` soient tous deux des comptes mutables.

## `#[account]`

L'attribut `#[account]` est appliqué aux structures représentant la structure de données d'un compte Solana. Il implémente les traits suivants :

- `AccountSerialize`
- `AccountDeserialize`
- `AnchorSerialize`
- `AnchorDeserialize`
- `Clone`
- `Discriminator`
- `Owner`

Vous pouvez en savoir plus sur les [détails de chaque trait](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html). Cependant, pour la plupart, ce que vous devez savoir, c'est que l'attribut `#[account]` permet la sérialisation et la désérialisation, et implémente les traits de discriminateur et de propriétaire pour un compte.

Le discriminateur est un identifiant unique de 8 octets pour un type de compte dérivé des premiers 8 octets du hachage SHA256 du nom du type de compte. Lors de l'implémentation des traits de sérialisation de compte, les 8 premiers octets sont réservés pour le discriminateur de compte.

En conséquence, tout appel à `try_deserialize` de `AccountDeserialize` vérifiera ce discriminateur. S'il ne correspond pas, un compte invalide a été donné, et la désérialisation du compte se terminera par une erreur.

L'attribut `#[account]` implémente également le trait `Owner` pour une structure utilisant le `programId` déclaré par `declareId` de la crate où `#[account]` est utilisé. En d'autres termes, tous les comptes initialisés en utilisant un type de compte défini en utilisant l'attribut `#[account]` dans le programme sont également détenus par le programme.

À titre d'exemple, regardons `AccountStruct` utilisé par le `account_name` de `InstructionAccounts`

```rust
#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    ...
}

#[account]
pub struct AccountStruct {
    data: u64
}
```

L'attribut `#[account]` assure qu'il peut être utilisé comme compte dans `InstructionAccounts`.

Lorsque le compte `account_name` est initialisé :

- Les 8 premiers octets sont définis comme le discriminateur de `AccountStruct`
- Le champ de données du compte correspondra à `AccountStruct`
- Le propriétaire du compte est défini comme le `programId` de `declare_id`

## Rassembler le tout

Lorsque vous combinez tous ces types Anchor, vous obtenez un programme complet. Voici un exemple d'un programme Anchor de base avec une seule instruction qui :

- Initialise un nouveau compte
- Met à jour le champ de données sur le compte avec les données d'instruction passées à l'instruction

```rust
// Utilisez cette importation pour accéder aux fonctionnalités Anchor courantes
use anchor_lang::prelude::*;

// Adresse onchain du programme
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Logique de l'instruction
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
        ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}

// Valider les comptes entrants pour les instructions
#[derive(Accounts)]
pub struct InstructionAccounts<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}

// Définir un type de compte de programme personnalisé
#[account]
pub struct AccountStruct {
    data: u64
}
```

Vous êtes maintenant prêt à créer votre propre programme Solana en utilisant le framework Anchor !

# Laboratoire

Avant de commencer, installez Anchor en [suivant les étapes de la documentation d'Anchor](https://www.anchor-lang.com/docs/installation).

Pour ce laboratoire, nous allons créer un programme de compteur simple avec deux instructions :

- La première instruction initialisera un compte de compteur.
- La deuxième instruction incrémentera le compteur stocké sur le compte de compteur.

### 1. Configuration

Créez un nouveau projet appelé `anchor-counter` en exécutant `anchor init` :

```console
anchor init anchor-counter
```

Allez dans le nouveau répertoire, puis exécutez `anchor build`

```console
cd anchor-counter
anchor build
```

Anchor build générera également une paire de clés pour votre nouveau programme - les clés sont enregistrées dans le répertoire `target/deploy`.

Ouvrez le fichier `lib.rs` et regardez `declare_id!` :

```rust
declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");
```

Exécutez `anchor keys sync`

```console
anchor keys sync
```

Vous verrez qu'Anchor met à jour à la fois :

 - La clé utilisée dans `declare_id!()` dans `lib.rs`
 - La clé dans `Anchor.toml`

Pour faire correspondre la clé générée lors de `anchor build` :

```console
Found incorrect program id declaration in "anchor-counter/programs/anchor-counter/src/lib.rs"
Updated to BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr

Found incorrect program id declaration in Anchor.toml for the program `anchor_counter`
Updated to BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr

All program id declarations are synced.
```

Enfin, supprimez le code par défaut dans `lib.rs` jusqu'à ce qu'il ne reste que ce qui suit :

```rust
use anchor_lang::prelude::*;

declare_id!("your-private-key");

#[program]
pub mod anchor_counter {
    use super::*;

}
```

### 2. Ajout de l'instruction `initialize`

Tout d'abord, implémentons l'instruction `initialize` dans `#[program]`. Cette instruction nécessite un `Context` de type `Initialize` et ne prend aucune donnée d'instruction supplémentaire. Dans la logique de l'instruction, nous initialisons simplement le champ `count` du compte `counter` à `0`.

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.count = 0;
    msg!("Compte de compteur créé");
    msg!("Compteur actuel : {}", counter.count);
    Ok(())
}
```

### 3. Implémentation du type `Context` `Initialize`

Ensuite, en utilisant la macro `#[derive(Accounts)]`, implémentons le type `Initialize` qui répertorie et valide les comptes utilisés par l'instruction `initialize`. Il aura besoin des comptes suivants :

- `counter` - le compte de compteur initialisé dans l'instruction
- `user` - payeur pour l'initialisation
- `system_program` - le programme système est requis pour l'initialisation de tout nouveau compte

```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Implémentation de `Counter`

Ensuite, utilisez l'attribut `#[account]` pour définir un nouveau type de compte `Counter`. La structure `Counter` définit un champ `count` de type `u64`. Cela signifie que nous pouvons nous attendre à ce que tous les nouveaux comptes initialisés en tant que type `Counter` aient une structure de données correspondante. L'attribut `#[account]` définit également automatiquement le discriminant pour un nouveau compte et définit le propriétaire du compte comme le `programId` de la macro `declare_id!`.

```rust
#[account]
pub struct Counter {
    pub count: u64,
}
```

### 5. Ajout de l'instruction `increment`

Dans `#[program]`, implémentons une instruction `increment` pour incrémenter le `count` une fois qu'un compte `counter` est initialisé par la première instruction. Cette instruction nécessite un `Context` de type `Update` (implémenté dans l'étape suivante) et ne prend aucune donnée d'instruction supplémentaire. Dans la logique de l'instruction, nous incrémentons simplement le champ `count` du compte `counter` existant de `1`.

```rust
pub fn increment(ctx: Context<Update>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    msg!("Compteur précédent : {}", counter.count);
    counter.count = counter.count.checked_add(1).unwrap();
    msg!("Compteur incrémenté. Compteur actuel : {}", counter.count);
    Ok(())
}
```

### 6. Implémentation du type `Context` `Update`

Enfin, en utilisant à nouveau la macro `#[derive(Accounts)]`, créons le type `Update` qui répertorie les comptes nécessaires à l'instruction `increment`. Il aura besoin des comptes suivants :

- `counter` - un compte de compteur existant à incrémenter
- `user` - payeur pour les frais de transaction

Encore une fois, nous devrons spécifier les contraintes éventuelles en utilisant l'attribut `#[account(..)]` :

```rust
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}
```

### 7. Construction

Dans l'ensemble, le programme complet ressemblera à ceci :

```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Compte de compteur créé. Compteur actuel : {}", counter.count);
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        msg!("Compteur précédent : {}", counter.count);
        counter.count = counter.count.checked_add(1).unwrap();
        msg!("Compteur incrémenté. Compteur actuel : {}", counter.count);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}

#[account]
pub struct Counter {
    pub count: u64,
}
```

Exécutez `anchor build` pour construire le programme.

### 8. Test

Les tests d'Anchor sont généralement des tests d'intégration TypeScript qui utilisent le framework de test mocha. Nous en apprendrons davantage sur les tests plus tard, mais pour l'instant, accédez à `anchor-counter.ts` et remplacez le code de test par défaut par ce qui suit :

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { AnchorCounter } from "../target/types/anchor_counter"

describe("anchor-counter", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.AnchorCounter as Program<AnchorCounter>

  const counter = anchor.web3.Keypair.generate()

  it("Is initialized!", async () => {})

  it("Incremented the count", async () => {})
})
```

Le code ci-dessus génère une nouvelle paire de clés pour le compte `counter` que nous allons initialiser et crée des espaces réservés pour un test de chaque instruction.

Ensuite, créez le premier test pour l'instruction `initialize` :

```typescript
it("Is initialized!", async () => {
  // Add your test here.
  const tx = await program.methods
    .initialize()
    .accounts({ counter: counter.publicKey })
    .signers([counter])
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 0)
})
```

Ensuite, créez le deuxième test pour l'instruction `increment` :

```typescript
it("Incremented the count", async () => {
  const tx = await program.methods
    .increment()
    .accounts({ counter: counter.publicKey, user: provider.wallet.publicKey })
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 1)
})
```

Enfin, exécutez `anchor test` et vous devriez voir la sortie suivante :

```console
anchor-counter
✔ Is initialized! (290ms)
✔ Incremented the count (403ms)


2 passing (696ms)
```

L'exécution de `anchor test` lance automatiquement un validateur de test local, déploie votre programme et exécute vos tests mocha contre celui-ci. Ne vous inquiétez pas si vous êtes confus par les tests pour le moment - nous creuserons plus tard.

Félicitations, vous venez de construire un programme Solana en utilisant le framework Anchor ! N'hésitez pas à vous référer au [code de la solution](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-increment) si vous avez besoin de plus de temps avec celui-ci.

# Défi

Maintenant, c'est à votre tour de construire quelque chose de manière indépendante. Parce que nous commençons avec des programmes très simples, le vôtre ressemblera presque à celui que nous venons de créer. Il est utile d'essayer d'arriver au point où vous pouvez l'écrire à partir de zéro sans consulter le code précédent, alors essayez de ne pas copier-coller ici.

1. Écrivez un nouveau programme qui initialise un compte de `counter`.
2. Implémentez à la fois une instruction `increment` et `decrement`.
3. Construisez et déployez votre programme comme nous l'avons fait dans le laboratoire.
4. Testez votre programme nouvellement déployé et utilisez Solana Explorer pour vérifier les logs du programme.

Comme toujours, soyez créatif avec ces défis et dépassez les instructions de base si vous le souhaitez - et amusez-vous !

Essayez de le faire de manière indépendante si possible ! Mais si vous êtes bloqué, n'hésitez pas à consulter le [code de la solution](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

## Vous avez fini le laboratoire ?

Publiez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=334874b7-b152-4473-b5a5-5474c3f8f3f1) !
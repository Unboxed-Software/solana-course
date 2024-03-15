---
title: Type Cosplay
objectives:
- Expliquer les risques de sécurité liés à la non-vérification des types de compte
- Mettre en œuvre un discriminateur de type de compte en utilisant Rust sous forme longue
- Utiliser la contrainte `init` d'Anchor pour initialiser les comptes
- Utiliser le type `Account` d'Anchor pour la validation des comptes
---

# Résumé

- Utilisez des discriminateurs pour distinguer entre différents types de comptes
- Pour mettre en œuvre un discriminateur en Rust, incluez un champ dans la structure du compte pour représenter le type de compte

    ```rust
    #[derive(BorshSerialize, BorshDeserialize)]
    pub struct User {
        discriminant: AccountDiscriminant,
        user: Pubkey,
    }

    #[derive(BorshSerialize, BorshDeserialize, PartialEq)]
    pub enum AccountDiscriminant {
        User,
        Admin,
    }
    ```

- Pour mettre en œuvre une vérification de discriminateur en Rust, vérifiez que le discriminateur des données de compte désérialisées correspond à la valeur attendue

    ```rust
    if user.discriminant != AccountDiscriminant::User {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```

- Dans Anchor, les types de compte du programme implémentent automatiquement le trait `Discriminator` qui crée un identifiant unique de 8 octets pour un type
- Utilisez le type `Account<'info, T>` d'Anchor pour vérifier automatiquement le discriminateur du compte lors de la désérialisation des données du compte

# Aperçu général

"Type cosplay" fait référence à l'utilisation inattendue d'un type de compte à la place d'un type de compte attendu. Sous-jacent, les données de compte sont simplement stockées sous forme d'un tableau d'octets qu'un programme désérialise en un type de compte personnalisé. Sans mettre en œuvre un moyen de distinguer explicitement entre les types de compte, des données de compte provenant d'un compte inattendu pourraient entraîner l'utilisation non voulue d'une instruction.

### Compte non vérifié

Dans l'exemple ci-dessous, les types de compte `AdminConfig` et `UserConfig` stockent tous deux une clé publique unique. L'instruction `admin_instruction` désérialise le compte `admin_config` en tant que type `AdminConfig` puis effectue une vérification de propriétaire et une vérification de validation des données.

Cependant, les types de compte `AdminConfig` et `UserConfig` ont la même structure de données. Cela signifie qu'un compte de type `UserConfig` pourrait être passé en tant que compte `admin_config`. Tant que la clé publique stockée sur les données du compte correspond à l'administrateur signant la transaction, l'instruction `admin_instruction` continuerait de fonctionner, même si le signataire n'est pas réellement un administrateur.

Notez que les noms des champs stockés sur les types de compte (`admin` et `user`) n'ont pas d'importance lors de la désérialisation des données du compte. Les données sont sérialisées et désérialisées en fonction de l'ordre des champs plutôt que de leurs noms.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_insecure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    user: Pubkey,
}
```

### Ajouter un discriminateur de compte

Pour résoudre cela, vous pouvez ajouter un champ de discriminateur pour chaque type de compte et définir le discriminateur lors de l'initialisation d'un compte.

L'exemple ci-dessous met à jour les types de compte `AdminConfig` et `UserConfig` avec un champ `discriminant`. L'instruction `admin_instruction` inclut une vérification de validation de données supplémentaire pour le champ `discriminant`.

```rust
if account_data.discriminant != AccountDiscriminant::Admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

Si le champ `discriminant` du compte passé en tant que compte `admin_config` dans l'instruction ne correspond pas au `AccountDiscriminant` attendu, la transaction échouera. Assurez-vous simplement de définir la valeur appropriée pour `discriminant` lors de l'initialisation de chaque compte (non montré dans l'exemple), puis vous pouvez inclure ces vérifications de discriminateur dans chaque instruction ultérieure.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_secure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        if account_data.discriminant != AccountDiscriminant::Admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    discriminant: AccountDiscriminant,
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    discriminant: AccountDiscriminant,
    user: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq)]
pub enum AccountDiscriminant {
    Admin,
    User,
}
```

### Utiliser l'enveloppe `Account` d'Anchor

Mettre en œuvre ces vérifications pour chaque compte nécessaire à chaque instruction peut être fastidieux. Heureusement, Anchor fournit un macro-attribut `#[account]` pour mettre en œuvre automatiquement les traits que chaque compte doit avoir.

Les structures marquées avec `#[account]` peuvent ensuite être utilisées avec `Account` pour valider que le compte passé est bien du type attendu. Lors de l'initialisation d'un compte dont la représentation structurale a l'attribut `#[account]`, les 8 premiers octets sont automatiquement réservés pour un discriminateur unique au type de compte. Lors de la désérialisation des données du compte, Anchor vérifiera automatiquement si le discriminateur sur le compte correspond au type de compte attendu et générera une erreur si cela ne correspond pas.

Dans l'exemple ci-dessous, `Account<'info, AdminConfig>` spécifie que le compte `admin_config` doit être de type `AdminConfig`. Anchor vérifie automatiquement que les 8 premiers octets des données du compte correspondent au discriminateur du type `AdminConfig`.

La vérification de validation des données pour le champ `admin` est également déplacée de la logique de l'instruction à la structure de validation du compte en utilisant la contrainte `has_one`. `#[account(has_one = admin)]` spécifie que le champ `admin` du compte `admin_config` doit correspondre au compte `admin` passé dans l'instruction. Notez que pour que la contrainte `has_one` fonctionne, le nom du compte dans la structure doit correspondre au nom du champ sur le compte que vous êtes en train de valider.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_recommended {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        msg!("Admin {}", ctx.accounts.admin_config.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    #[account(has_one = admin)]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct UserConfig {
    user: Pubkey,
}
```

Il est important de noter que c'est une vulnérabilité à laquelle vous n'avez vraiment pas à vous soucier lorsque vous utilisez Anchor - c'est tout l'intérêt en premier lieu ! Après avoir examiné comment cela peut être exploité s'il n'est pas géré correctement dans un programme natif rust, espérons que vous comprenez beaucoup mieux quel est le but du discriminateur de compte dans un compte Anchor. Le fait qu'Anchor configure et vérifie ce discriminateur automatiquement signifie que les développeurs peuvent passer plus de temps à se concentrer sur leur produit, mais il est toujours très important de comprendre ce qu'Anchor fait en coulisses pour développer des programmes Solana robustes.

# Laboratoire

Pour ce laboratoire, nous allons créer deux programmes pour illustrer une vulnérabilité "type cosplay".

- Le premier programme initialisera des comptes de programme sans discriminateur
- Le deuxième programme initialisera des comptes de programme en utilisant la contrainte `init` d'Anchor qui définira automatiquement un discriminateur de compte

### 1. Démarrage

Pour commencer, téléchargez le code de départ de la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/solana-type-cosplay/tree/starter). Le code de départ comprend un programme avec trois instructions et quelques tests.

Les trois instructions sont :

1. `initialize_admin` - initialise un compte administrateur et définit l'autorité administrative du programme
2. `initialize_user` - initialise un compte utilisateur standard
3. `update_admin` - permet à l'administrateur existant de mettre à jour l'autorité administrative du programme

Examinez ces trois instructions dans le fichier `lib.rs`. La dernière instruction ne devrait être appelée que par le compte correspondant au champ `admin` du compte administrateur initialisé à l'aide de l'instruction `initialize_admin`.

### 2. Testez l'instruction `update_admin` non sécurisée

Cependant, les deux comptes ont les mêmes champs et types de champ :

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    user: Pubkey,
}
```

En raison de cela, il est possible de passer un compte `User` à la place du compte `admin` dans l'instruction `update_admin`, contournant ainsi la condition selon laquelle l'appelant doit être un administrateur pour appeler cette instruction.

Jetez un œil au fichier `solana-type-cosplay.ts` dans le répertoire `tests`. Il contient une configuration de base et deux tests. Un test initialise un compte utilisateur, et l'autre appelle `update_admin` et passe le compte utilisateur à la place d'un compte administrateur.

Exécutez `anchor test` pour voir que l'invocation de `update_admin` se terminera avec succès.

```bash
  type-cosplay
    ✔ Initialize User Account (233ms)
    ✔ Invoke update admin instruction with user account (487ms)
```

### 3. Créez le programme `type-checked`

Maintenant, nous allons créer un nouveau programme appelé `type-checked` en exécutant `anchor new type-checked` depuis la racine du programme Anchor existant.

Maintenant, dans votre dossier `programs`, vous aurez deux programmes. Exécutez `anchor keys list` et vous devriez voir l'ID de programme pour le nouveau programme. Ajoutez-le au fichier `lib.rs` du programme `type-checked` et au programme `type_checked` dans le fichier `Anchor.toml`.

Ensuite, mettez à jour la configuration du fichier de test pour inclure le nouveau programme et deux nouvelles paires de clés pour les comptes que nous initialiserons pour le nouveau programme.

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { TypeCosplay } from "../target/types/type_cosplay"
import { TypeChecked } from "../target/types/type_checked"
import { expect } from "chai"

describe("type-cosplay", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.TypeCosplay as Program<TypeCosplay>
  const programChecked = anchor.workspace.TypeChecked as Program<TypeChecked>

  const userAccount = anchor.web3.Keypair.generate()
  const newAdmin = anchor.web3.Keypair.generate()

  const userAccountChecked = anchor.web3.Keypair.generate()
  const adminAccountChecked = anchor.web3.Keypair.generate()
})
```

### 4. Implémentez le programme `type-checked`

Dans le programme `type_checked`, ajoutez deux instructions en utilisant la contrainte `init` pour initialiser un compte `AdminConfig` et un compte `User`. Lors de l'utilisation de la contrainte `init` pour initialiser de nouveaux comptes de programme, Anchor définira automatiquement les 8 premiers octets des données du compte comme un discriminateur unique pour le type de compte.

Nous ajouterons également une instruction `update_admin` qui valide le compte `admin_config` en tant que type de compte `AdminConfig` en utilisant l'enveloppe `Account` d'Anchor. Pour tout compte passé en tant que compte `admin_config`, Anchor vérifiera automatiquement si le discriminateur du compte correspond au type de compte attendu.

```rust
use anchor_lang::prelude::*;

declare_id!("FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7");

#[program]
pub mod type_checked {
    use super::*;

    pub fn initialize_admin(ctx: Context<InitializeAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.user_account.user = ctx.accounts.user.key();
        Ok(())
    }

    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeAdmin<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32
    )]
    pub user_account: Account<'info, User>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    pub new_admin: SystemAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct User {
    user: Pubkey,
}
```

### 5. Testez l'instruction `update_admin` sécurisée

Dans le fichier de test, nous initialiserons un compte `AdminConfig` et un compte `User` à partir du programme `type_checked`. Ensuite, nous invoquerons l'instruction `updateAdmin` deux fois en passant les comptes nouvellement créés.

```tsx
describe("type-cosplay", () => {
	...

  it("Initialize type checked AdminConfig Account", async () => {
    await programChecked.methods
      .initializeAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
      })
      .signers([adminAccountType])
      .rpc()
  })

  it("Initialize type checked User Account", async () => {
    await programChecked.methods
      .initializeUser()
      .accounts({
        userAccount: userAccountType.publicKey,
        user: provider.wallet.publicKey,
      })
      .signers([userAccountType])
      .rpc()
  })

  it("Invoke update instruction using User Account", async () => {
    try {
      await programChecked.methods
        .updateAdmin()
        .accounts({
          adminConfig: userAccountType.publicKey,
          newAdmin: newAdmin.publicKey,
          admin: provider.wallet.publicKey,
        })
        .rpc()
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Invoke update instruction using AdminConfig Account", async () => {
    await programChecked.methods
      .updateAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
        newAdmin: newAdmin.publicKey,
        admin: provider.wallet.publicKey,
      })
      .rpc()
  })
})
```

Exécutez `anchor test`. Pour la transaction où nous passons le type de compte `User`, nous nous attendons à ce que l'instruction et le retour génèrent une erreur Anchor pour le compte ne correspondant pas au type `AdminConfig`.

```bash
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 invoke [1]',
'Program log: Instruction: UpdateAdmin',
'Program log: AnchorError caused by account: admin_config. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 consumed 4765 of 200000 compute units',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 failed: custom program error: 0xbba'
```

En suivant les meilleures pratiques d'Anchor et en utilisant les types d'Anchor, vous vous assurerez que vos programmes évitent cette vulnérabilité. Utilisez toujours l'attribut `#[account]` lors de la création de structures de compte, utilisez la contrainte `init` lors de l'initialisation des comptes et utilisez le type `Account` dans vos structures de validation de compte.

Si vous souhaitez consulter le code de la solution finale, vous pouvez le trouver sur la branche `solution` du [dépôt](https://github.com/Unboxed-Software/solana-type-cosplay/tree/solution).

# Défi

Tout comme avec les autres leçons de cette unité, votre opportunité de pratiquer l'évitement de cette faille de sécurité réside dans l'audit de votre propre programme ou d'autres programmes.

Prenez le temps de revoir au moins un programme et assurez-vous que les types de compte ont un discriminateur et que ceux-ci sont vérifiés pour chaque compte et chaque instruction. Étant donné que les types Anchor standard gèrent automatiquement cette vérification, vous avez plus de chances de trouver une vulnérabilité dans un programme natif.

N'oubliez pas, si vous trouvez un bug ou une faille dans le programme de quelqu'un d'autre, veuillez les alerter dans le cadre du processus de divulgation responsable.


## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=37ebccab-b19a-43c6-a96a-29fa7e80fdec) !
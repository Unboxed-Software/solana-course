---
title: Attaques de réinitialisation
objectives:
- Expliquer les risques de sécurité liés à une vulnérabilité de réinitialisation
- Utiliser Rust de manière approfondie pour vérifier si un compte a déjà été initialisé
- Utiliser la contrainte `init` d'Anchor pour initialiser des comptes, ce qui définit automatiquement un discriminant de compte vérifié pour éviter la réinitialisation d'un compte
---

# Résumé

- Utilisez un discriminant de compte ou un indicateur d'initialisation pour vérifier si un compte a déjà été initialisé afin d'éviter qu'un compte ne soit réinitialisé et ne remplace les données existantes du compte.
- Pour éviter la réinitialisation de compte en Rust standard, initialisez les comptes avec un indicateur `is_initialized` et vérifiez s'il a déjà été défini sur true lors de l'initialisation d'un compte
  ```rust
  if account.is_initialized {
      return Err(ProgramError::AccountAlreadyInitialized.into());
  }
  ```
- Pour simplifier cela, utilisez la contrainte `init` d'Anchor pour créer un compte via une CPI vers le programme système et définir son discriminant.

# Aperçu général

L'initialisation consiste à définir les données d'un nouveau compte pour la première fois. Lors de l'initialisation d'un nouveau compte, vous devriez mettre en place une façon de vérifier si le compte a déjà été initialisé. Sans une vérification appropriée, un compte existant pourrait être réinitialisé et avoir ses données existantes écrasées.

Notez que créer un compte et initialiser un compte sont deux instructions distinctes. La création d'un compte nécessite à invoquer l'instruction `create_account` sur le programme système, qui spécifie l'espace requis pour le compte, le loyer en lamports alloué au compte et le propriétaire du compte. L'initialisation est une instruction qui définit les données d'un compte nouvellement créé. La création et l'initialisation d'un compte peuvent être combinées dans une seule transaction.

### Absence de vérification d'initialisation

Dans l'exemple ci-dessous, il n'y a pas de vérifications sur le compte `user`. L'instruction `initialize` désérialise les données du compte `user` en tant que type de compte `User`, définit le champ `authority` et sérialise les données du compte mises à jour vers le compte `user`.

Sans vérifications sur le compte `user`, le même compte pourrait être passé à l'instruction `initialize` une deuxième fois par une autre partie pour écraser l'`authority` existant stocké dans les données du compte.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_insecure  {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### Ajouter une vérification `is_initialized`

Une approche pour résoudre ce problème est d'ajouter un champ supplémentaire `is_initialized` au type de compte `User` et l'utiliser comme indicateur pour vérifier si un compte a déjà été initialisé.

```rust
if user.is_initialized {
    return Err(ProgramError::AccountAlreadyInitialized.into());
}
```

En incluant une vérification dans l'instruction `initialize`, le compte `user` ne sera initialisé que si le champ `is_initialized` n'a pas encore été défini sur true. Si le champ `is_initialized` a été déjà défini, la transaction échouera, évitant ainsi le scénario où un attaquant pourrait remplacer l'`authority` du compte par sa propre clé publique.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_secure {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        if user.is_initialized {
            return Err(ProgramError::AccountAlreadyInitialized.into());
        }

        user.authority = ctx.accounts.authority.key();
        user.is_initialized = true;

        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    is_initialized: bool,
    authority: Pubkey,
}
```

### Utiliser la contrainte `init` d'Anchor

Anchor propose une contrainte `init` qui peut être utilisée avec l'attribut `#[account(...)]` pour initialiser un compte. La contrainte `init` crée le compte via une CPI vers le programme système et définit le discriminant du compte.

La contrainte `init` doit être utilisée en combinaison avec les contraintes `payer` et `space`. Le `payer` spécifie le compte payant pour l'initialisation du nouveau compte. Le `space` spécifie la quantité d'espace requise par le nouveau compte, ce qui détermine la quantité de lamports qui doivent être alloués au compte. Les premiers 8 octets de données sont définis comme un discriminant qu'Anchor ajoute automatiquement pour identifier le type de compte.

Plus important encore pour cette leçon, la contrainte `init` garantit que cette instruction ne peut être appelée qu'une fois par compte, vous pouvez donc définir l'état initial du compte dans la logique de l'instruction et ne pas avoir à vous soucier d'un attaquant essayant de réinitialiser le compte.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_recommended {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("GM");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct User {
    authority: Pubkey,
}
```

### Contrainte `init_if_needed` d'Anchor

Il est important de noter qu'Anchor a une contrainte `init_if_needed`. Cette contrainte devrait être utilisée avec beaucoup de prudence. En fait, elle est bloquée derrière un indicateur de fonctionnalité pour que vous soyez obligé de l'utiliser de manière intentionnelle.

La contrainte `init_if_needed` fait la même chose que la contrainte `init`, sauf que si le compte a déjà été initialisé, l'instruction s'exécutera quand même.

Étant donné cela, il est *********extrêmement********* important que lorsque vous utilisez cette contrainte, vous incluiez des vérifications pour éviter de réinitialiser le compte à son état initial.

Par exemple, si le compte stocke un champ `authority` qui est défini dans l'instruction à l'aide de la contrainte `init_if_needed`, vous avez besoin de vérifications qui garantissent qu'aucun attaquant ne pourrait appeler l'instruction après qu'elle ait déjà été initialisée et avoir le champ `authority` défini à nouveau.

Dans la plupart des cas, il est plus sûr d'avoir une instruction distincte pour initialiser les données du compte.

# Laboratoire

Pour ce laboratoire, nous allons créer un programme simple qui ne fait rien d'autre qu'initialiser des comptes. Nous inclurons deux instructions :

- `insecure_initialization` - initialise un compte qui peut être réinitialisé
- `recommended_initialization` - initialise un compte en utilisant la contrainte `init` d'Anchor

### 1. Démarrage

Pour commencer, téléchargez le code de départ de la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/starter). Le code de départ inclut un programme avec une instruction et la configuration de base du fichier de test.

L'instruction `insecure_initialization` initialise un nouveau compte `user` qui stocke la clé publique d'une `authority`. Dans cette instruction, le compte est censé être alloué côté client, puis passé à l'instruction du programme. Une fois passé au programme, il n'y a aucune vérification pour voir si l'état initial du compte `user` a déjà été défini. Cela signifie que le même compte peut être passé une deuxième fois pour remplacer l'`authority` stocké sur un compte `user` existant.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;

    pub fn insecure_initialization(ctx: Context<Unchecked>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    #[account(mut)]
    /// VÉRIFICATION :
    user: UncheckedAccount<'info>,
    authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### 2. Test de l'instruction `insecure_initialization`

Le fichier de test inclut la configuration pour créer un compte en invoquant le programme système, puis invoque l'instruction `insecure_initialization` deux fois en utilisant le même compte. Comme il n'y a aucune vérification pour vérifier que les données du compte n'ont pas déjà été initialisées, l'instruction `insecure_initialization` se terminera avec succès les deux fois, bien que la deuxième invocation fournisse un compte d'`authority` différent.

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { Initialization } from "../target/types/initialization"

describe("initialization", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Initialization as Program<Initialization>

  const wallet = anchor.workspace.Initialization.provider.wallet
  const walletTwo = anchor.web3.Keypair.generate()

  const userInsecure = anchor.web3.Keypair.generate()
  const userRecommended = anchor.web3.Keypair.generate()

  before(async () => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: userInsecure.publicKey,
        space: 32,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
          32
        ),
        programId: program.programId,
      })
    )

    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      wallet.payer,
      userInsecure,
    ])

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        walletTwo.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    )
  })

  it("Insecure init", async () => {
    await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
      })
      .rpc()
  })

  it("Re-invoke insecure init with different auth", async () => {
    const tx = await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
        authority: walletTwo.publicKey,
      })
      .transaction()
    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      walletTwo,
    ])
  })
})
```

Exécutez `anchor test` pour voir que les deux transactions se termineront avec succès.

```bash
initialization
  ✔ Insecure init (478ms)
  ✔ Re-invoke insecure init with different auth (464ms)
```

### 3. Ajouter l'instruction `recommended_initialization`

Créons une nouvelle instruction appelée `recommended_initialization` qui corrige ce problème. Contrairement à l'instruction précédente non sécurisée, cette instruction devrait gérer à la fois la création et l'initialisation du compte de l'utilisateur en utilisant la contrainte `init` d'Anchor.

Cette contrainte indique au programme de créer le compte via une CPI vers le programme système, de sorte que le compte n'a plus besoin d'être créé côté client. La contrainte défini également le discriminant du compte. La logique de votre instruction peut alors définir l'état initial du compte.

En faisant cela, vous vous assurez que toute invocation ultérieure de la même instruction avec le même compte utilisateur échouera plutôt que de réinitialiser l'état initial du compte.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;
		...
    pub fn recommended_initialization(ctx: Context<Checked>) -> Result<()> {
        ctx.accounts.user.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}
```

### 4. Tester l'instruction `recommended_initialization`

Pour tester l'instruction `recommended_initialization`, nous allons invoquer l'instruction deux fois comme précédemment. Cette fois, nous nous attendons à ce que la transaction échoue lorsque nous essayons d'initialiser le même compte une deuxième fois.

```tsx
describe("initialization", () => {
  ...
  it("Recommended init", async () => {
    await program.methods
      .recommendedInitialization()
      .accounts({
        user: userRecommended.publicKey,
      })
      .signers([userRecommended])
      .rpc()
  })

  it("Re-invoke recommended init with different auth, expect error", async () => {
    try {
      // Add your test here.
      const tx = await program.methods
        .recommendedInitialization()
        .accounts({
          user: userRecommended.publicKey,
          authority: walletTwo.publicKey,
        })
        .transaction()
      await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
        walletTwo,
        userRecommended,
      ])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

Exécutez `anchor test` pour voir que la deuxième transaction qui tente d'initialiser le même compte deux fois retournera maintenant une erreur indiquant que l'adresse du compte est déjà utilisée.

```bash
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t invoke [1]',
'Program log: Instruction: RecommendedInitialization',
'Program 11111111111111111111111111111111 invoke [2]',
'Allocate: account Address { address: EMvbwzrs4VTR7G1sNUJuQtvRX1EuvLhqs4PFqrtDcCGV, base: None } already in use',
'Program 11111111111111111111111111111111 failed: custom program error: 0x0',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t consumed 4018 of 200000 compute units',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t failed: custom program error: 0x0'
```

Si vous utilisez la contrainte `init` d'Anchor, c'est généralement tout ce dont vous avez besoin pour vous protéger contre les attaques de réinitialisation ! N'oubliez pas, simplement parce que la correction de ces exploits de sécurité est simple ne signifie pas qu'elle n'est pas importante. Chaque fois que vous initialisez un compte, assurez-vous soit d'utiliser la contrainte `init`, soit d'avoir une autre vérification en place pour éviter de réinitialiser l'état initial d'un compte existant.

Si vous voulez jeter un œil au code de solution final, vous pouvez le trouver sur la branche `solution` de [ce dépôt](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/solution).

# Défi

Comme pour les autres leçons de cette unité, votre opportunité de pratiquer pour éviter cette faille de sécurité réside dans la vérification de votre propre programme ou d'autres programmes.

Prenez un moment pour examiner au moins un programme et assurez-vous que les instructions sont correctement protégées contre les attaques de réinitialisation.

N'oubliez pas, si vous trouvez un bug ou une faille dans le programme de quelqu'un d'autre, veuillez les alerter ! Si vous en trouvez un dans votre propre programme, assurez-vous de le corriger immédiatement.


## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=652c68aa-18d9-464c-9522-e531fd8738d5) !
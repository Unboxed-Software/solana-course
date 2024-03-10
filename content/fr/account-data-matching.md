---
title: Vérification de la correspondance des données du compte
objectives:
- Expliquer les risques de sécurité liés à l'absence de vérifications de validation des données
- Implémenter des vérifications de validation des données en utilisant Rust en forme longue
- Implémenter des vérifications de validation des données en utilisant les contraintes Anchor
---

# Résumé

- Utilisez des **vérifications de validation des données** pour vérifier que les données du compte correspondent à une valeur attendue. Sans vérifications appropriées, des comptes inattendus peuvent être utilisés dans une instruction.
- Pour implémenter des vérifications de validation des données en Rust, comparez simplement les données stockées sur un compte avec une valeur attendue.
    
    ```rust
    if ctx.accounts.user.key() != ctx.accounts.user_data.user {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```
    
- Dans Anchor, vous pouvez utiliser `constraint` pour vérifier si l'expression donnée est vraie. Alternativement, vous pouvez utiliser `has_one` pour vérifier qu'un champ de compte cible stocké sur le compte correspond à la clé d'un compte dans la struct `Accounts`.

# Aperçu général

La correspondance des données du compte fait référence aux vérifications de validation des données utilisées pour vérifier que les données stockées sur un compte correspondent à une valeur attendue. Les vérifications de validation des données fournissent un moyen d'inclure des contraintes supplémentaires pour s'assurer que les comptes appropriés sont passés à une instruction.

Cela peut être utile lorsque les comptes requis par une instruction dépendent de valeurs stockées dans d'autres comptes ou si une instruction dépend des données stockées dans un compte.

### Absence de vérification de validation des données

L'exemple ci-dessous inclut une instruction `update_admin` qui met à jour le champ `admin` stocké sur un compte `admin_config`.

L'instruction manque d'une vérification de validation des données pour vérifier que le compte `admin` signant la transaction correspond au `admin` stocké sur le compte `admin_config`. Cela signifie que n'importe quel compte signant la transaction et passé dans l'instruction en tant que compte `admin` peut mettre à jour le compte `admin_config`.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Ajouter une vérification de validation des données

L'approche Rust de base pour résoudre ce problème consiste simplement à comparer la clé `admin` passée avec la clé `admin` stockée dans le compte `admin_config`, en renvoyant une erreur si elles ne correspondent pas.

```rust
if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

En ajoutant une vérification de validation des données, l'instruction `update_admin` ne serait traitée que si le signataire `admin` de la transaction correspondait au `admin` stocké sur le compte `admin_config`.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
      if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Utiliser les contraintes Anchor

Anchor simplifie cela avec la contrainte `has_one`. Vous pouvez utiliser la contrainte `has_one` pour déplacer la vérification de validation des données de la logique de l'instruction vers la struct `UpdateAdmin`.

Dans l'exemple ci-dessous, `has_one = admin` spécifie que le compte `admin` signant la transaction doit correspondre au champ `admin` stocké sur le compte `admin_config`. Pour utiliser la contrainte `has_one`, la convention de dénomination du champ de données sur le compte doit être cohérente avec la dénomination sur la struct de validation du compte.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

Alternativement, vous pouvez utiliser `constraint` pour ajouter manuellement une expression qui doit être vraie pour que l'exécution se poursuive. Cela est utile lorsque, pour une raison quelconque, la dénomination ne peut pas être cohérente ou lorsque vous avez besoin d'une expression plus complexe pour valider complètement les données entrantes.

```rust
#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        constraint = admin_config.admin == admin.key()
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}
```

# Laboratoire

Pour ce laboratoire, nous allons créer un programme simple de "coffre" similaire au programme que nous avons utilisé dans la leçon sur l'autorisation du signataire et la leçon sur la vérification du propriétaire. Tout comme dans ces laboratoires, nous montrerons dans ce laboratoire comment une absence de vérification de validation des données pourrait permettre au coffre d'être vidé.

### 1. Démarrage

Pour commencer, téléchargez le code de départ à partir de la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/solana-account-data-matching). Le code de départ inclut un programme avec deux instructions et la configuration initiale pour le fichier de test.

L'instruction `initialize_vault` initialise un nouveau compte `Vault` et un nouveau compte `TokenAccount`. Le compte `Vault` stockera l'adresse d'un compte de jeton, l'autorité du coffre et un compte de destination de retrait de jeton.

L'autorité du nouveau compte de jeton sera définie comme le `vault`, une PDA du programme. Cela permet au compte `vault` de signer pour le transfert de jetons depuis le compte de jeton. 

L'instruction `insecure_withdraw` transfère tous les jetons du compte de jeton du compte `vault` vers un compte de jeton `withdraw_destination`.

Remarquez que cette instruction **a** une vérification de signataire pour `authority` et une vérification de propriétaire pour `vault`. Cependant, nulle part dans la validation du compte ou la logique de l'instruction, il n'y a de code qui vérifie que le compte `authority` passé dans l'instruction correspond au compte `authority` sur le compte `vault`.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        ctx.accounts.vault.withdraw_destination = ctx.accounts.withdraw_destination.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InsecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
    withdraw_destination: Pubkey,
}
```

### 2. Testez l'instruction `insecure_withdraw`

Pour prouver que c'est un problème, écrivons un test où un compte autre que l'autorité du coffre tente de retirer du coffre.

Le fichier de test inclut le code pour invoquer l'instruction `initialize_vault` en utilisant le portefeuille du fournisseur en tant qu'autorité, puis émet 100 jetons au compte de jetons du coffre.

Ajoutez un test pour invoquer l'instruction `insecure_withdraw`. Utilisez `withdrawDestinationFake` comme compte de `withdrawDestination` et `walletFake` comme autorité. Ensuite, envoyez la transaction en utilisant `walletFake`.

Étant donné qu'il n'y a aucune vérification pour vérifier que le compte `authority` passé dans l'instruction correspond aux valeurs stockées sur le compte `vault` initialisé dans le premier test, l'instruction sera traitée avec succès et les jetons seront transférés au compte `withdrawDestinationFake`.

```tsx
describe("account-data-matching", () => {
  ...
  it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestinationFake,
        authority: walletFake.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Exécutez `anchor test` pour voir que les deux transactions se termineront avec succès.

```bash
account-data-matching
  ✔ Initialize Vault (811ms)
  ✔ Insecure withdraw (403ms)
```

### 3. Ajoutez l'instruction `secure_withdraw`

Allons maintenant implémenter une version sécurisée de cette instruction appelée `secure_withdraw`.

Cette instruction sera identique à l'instruction `insecure_withdraw`, sauf que nous utiliserons la contrainte `has_one` dans la struct de validation du compte (`SecureWithdraw`) pour vérifier que le compte `authority` passé dans l'instruction correspond au compte `authority` sur le compte `vault`. De cette façon, seule l'autorité correcte peut retirer les jetons du coffre.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;
    ...
    pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
        has_one = token_account,
        has_one = authority,
        has_one = withdraw_destination,

    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

### 4. Testez l'instruction `secure_withdraw`

Testons maintenant l'instruction `secure_withdraw` avec deux tests : l'un qui utilise `walletFake` comme autorité et l'autre qui utilise `wallet` comme autorité. Nous nous attendons à ce que le premier appel retourne une erreur et le second réussisse.

```tsx
describe("account-data-matching", () => {
  ...
  it("Secure withdraw, expect error", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenPDA,
          withdrawDestination: withdrawDestinationFake,
          authority: walletFake.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Secure withdraw", async () => {
    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      tokenPDA,
      wallet.payer,
      100
    )

    await program.methods
      .secureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestination,
        authority: wallet.publicKey,
      })
      .rpc()

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Exécutez `anchor test` pour voir que la transaction utilisant un compte d'autorité incorrecte retourne désormais une erreur Anchor tandis que la transaction utilisant les comptes corrects se termine avec succès.

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: ConstraintHasOne. Error Number: 2001. Error Message: A has one constraint was violated.',
'Program log: Left:',
'Program log: DfLZV18rD7wCQwjYvhTFwuvLh49WSbXFeJFPQb5czifH',
'Program log: Right:',
'Program log: 5ovvmG5ntwUC7uhNWfirjBHbZD96fwuXDMGXiyMwPg87',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 10401 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d1'
```

Notez qu'Anchor spécifie dans les logs le compte qui cause l'erreur (`AnchorError caused by account: vault`).

```bash
✔ Secure withdraw, expect error (77ms)
✔ Secure withdraw (10073ms)
```

Et c'est ainsi que vous avez fermé la faille de sécurité. Le thème récurrent à travers la plupart de ces exploits potentiels est qu'ils sont assez simples. Cependant, à mesure que vos programmes prennent de l'ampleur en portée et en complexité, il devient de plus en plus facile de manquer des exploits possibles. Il est excellent de prendre l'habitude d'écrire des tests qui envoient des instructions qui *ne devraient pas* fonctionner. Plus il y en a, mieux c'est. De cette façon, vous repérez les problèmes avant le déploiement.

Si vous souhaitez consulter le code de la solution finale, vous pouvez le trouver sur la branche `solution` de [ce dépôt](https://github.com/Unboxed-Software/solana-account-data-matching/tree/solution).

# Défi

Tout comme avec les autres leçons de cette unité, votre opportunité de pratiquer l'évitement de cette faille de sécurité réside dans l'audit de vos propres programmes ou d'autres programmes.

Prenez le temps de passer en revue au moins un programme et assurez-vous que des vérifications de données appropriées sont en place pour éviter les failles de sécurité.

N'oubliez pas, si vous trouvez un bug ou une faille dans le programme de quelqu'un d'autre, veuillez les alerter ! Si vous en trouvez un dans votre propre programme, assurez-vous de le corriger immédiatement.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=a107787e-ad33-42bb-96b3-0592efc1b92f) !
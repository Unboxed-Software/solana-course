---
title: Autoriser des signatures
objectives:
- Expliquer les risques de sécurité liés à l'absence de vérifications appropriées du signataire
- Implémenter des vérifications du signataire en utilisant Rust de manière détaillée
- Implémenter des vérifications du signataire en utilisant le type `Signer` d'Anchor
- Implémenter des vérifications du signataire en utilisant la contrainte `#[account(signer)]` d'Anchor
---

# Résumé

- Utilisez les **Vérifications du Signataire** pour vérifier que des comptes spécifiques ont signé une transaction. Sans des vérifications appropriées du signataire, des comptes pourraient exécuter des instructions auxquelles ils ne devraient pas être autorisés.
- Pour implémenter une vérification du signataire en Rust, vérifiez simplement que la propriété `is_signer` du compte est `true`
    
    ```rust
    if !ctx.accounts.authority.is_signer {
    	return Err(ProgramError::MissingRequiredSignature.into());
    }
    ```
    
- Avec Anchor, vous pouvez utiliser le type **`Signer`** dans votre struct de validation de compte pour qu'Anchor effectue automatiquement une vérification du signataire sur un compte donné.
- Anchor dispose également d'une contrainte de compte qui vérifiera automatiquement qu'un compte donné a signé une transaction.

# Aperçu général

Les vérifications du signataire sont utilisées pour vérifier que le propriétaire d'un compte donné a autorisé une transaction. Sans une vérification du signataire, des opérations dont l'exécution devrait être limitée à des comptes spécifiques pourraient potentiellement être effectuées par n'importe quel compte. Dans le pire des cas, cela pourrait entraîner le vidage complet des portefeuilles par des attaquants passant n'importe quel compte à une instruction.

### Vérification du Signataire Manquante

L'exemple ci-dessous montre une version simplifiée d'une instruction qui met à jour le champ `authority` stocké sur un compte de programme.

Remarquez que le champ `authority` dans la struct de validation de compte `UpdateAuthority` est de type `AccountInfo`. Dans Anchor, le type de compte `AccountInfo` indique qu'aucune vérification n'est effectuée sur le compte avant l'exécution de l'instruction.

Bien que la contrainte `has_one` soit utilisée pour valider que le compte `authority` passé à l'instruction correspond au champ `authority` stocké sur le compte `vault`, il n'y a aucune vérification pour vérifier que le compte `authority` a autorisé la transaction.

Cela signifie qu'un attaquant peut simplement passer la clé publique du compte `authority` et sa propre clé publique en tant que compte `new_authority` pour se réassigner en tant que nouvelle autorité du compte `vault`. À ce stade, il peut interagir avec le programme en tant que nouvelle autorité.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod insecure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
   #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### Ajouter des vérifications d'autorisation du signataire

Tout ce que vous devez faire pour valider que le compte `authority` a signé est d'ajouter une vérification du signataire dans l'instruction. Cela signifie simplement vérifier que `authority.is_signer` est `true` et renvoyer une erreur `MissingRequiredSignature` sinon.

```rust
if !ctx.accounts.authority.is_signer {
    return Err(ProgramError::MissingRequiredSignature.into());
}
```

En ajoutant une vérification du signataire, l'instruction ne sera traitée que si le compte passé en tant que compte `authority` a également signé la transaction. Si la transaction n'a pas été signée par le compte passé en tant que compte `authority`, la transaction échouera.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
            if !ctx.accounts.authority.is_signer {
            return Err(ProgramError::MissingRequiredSignature.into());
        }

        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### Utiliser le type de compte `Signer` d'Anchor

Cependant, mettre cette vérification dans la fonction d'instruction brouille la séparation entre la validation du compte et la logique de l'instruction.

Heureusement, Anchor facilite la réalisation de vérifications du signataire en fournissant le type de compte `Signer`. Il suffit de changer le type du compte `authority` dans la struct de validation du compte pour qu'il soit de type `Signer`, et Anchor vérifiera à l'exécution que le compte spécifié est un signataire de la transaction. C'est l'approche que nous recommandons généralement, car elle permet de séparer la vérification du signataire de la logique de l'instruction.

Dans l'exemple ci-dessous, si le compte `authority` ne signe pas la transaction, la transaction échouera avant même d'atteindre la logique de l'instruction.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Notez que lorsque vous utilisez le type `Signer`, aucune autre vérification de propriété ou de type n'est effectuée.

### Utiliser la contrainte `#[account(signer)]` d'Anchor

Bien que dans la plupart des cas, le type de compte `Signer` suffise pour garantir qu'un compte a signé une transaction, le fait qu'aucune autre vérification de propriété ou de type n'est effectuée signifie que ce compte ne peut pas vraiment être utilisé à d'autres fins dans l'instruction.

C'est là que la *contrainte* `signer` est utile. La contrainte `#[account(signer)]` vous permet de vérifier que le compte a signé la transaction, tout en bénéficiant également des avantages d'utilisation du type de compte `Account` si vous avez besoin d'accéder à ses données sous-jacentes. 

Par exemple, imaginez écrire une instruction que vous vous attendez à être invoquée via CPI et qui suppose que l'un des comptes passés en paramètre est à la fois un ******signataire****** de la transaction et une ***********source de données***********. Utiliser le type de compte `Signer` ici supprime la désérialisation automatique et la vérification de type que vous obtiendriez avec le type de compte `Account`. C'est à la fois gênant, car vous devez désérialiser manuellement les données du compte dans la logique de l'instruction, et cela peut rendre votre programme vulnérable en ne bénéficiant pas de la vérification de propriété et de type effectuée par le type de compte `Account`.

Dans l'exemple ci-dessous, vous pouvez écrire en toute sécurité une logique pour interagir avec les données stockées dans le compte `authority`, tout en vérifiant qu'il a signé la transaction.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();

        // accéder aux données stockées dans authority
        msg!("Nombre total de déposants : {}", ctx.accounts.authority.num_depositors);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    #[account(signer)]
    pub authority: Account<'info, AuthState>
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
#[account]
pub struct AuthState{
	amount: u64,
	num_depositors: u64,
	num_vaults: u64
}
```

# Laboratoire

Pratiquons en créant un programme simple pour démontrer comment l'absence de vérification du signataire peut permettre à un attaquant de retirer des jetons qui ne lui appartiennent pas.

Ce programme initialise un compte de "coffre-fort" de jetons simplifié et montre comment l'absence de vérification du signataire pourrait permettre au coffre-fort d'être vidé.

### 1. Démarrage

Pour commencer, téléchargez le code de départ depuis la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/solana-signer-auth/tree/starter). Le code de départ comprend un programme avec deux instructions et la configuration de base du fichier de test.

L'instruction `initialize_vault` initialise deux nouveaux comptes : `Vault` et `TokenAccount`. Le compte `Vault` sera initialisé à l'aide d'une adresse dérivée du programme (PDA) et stockera l'adresse d'un compte de jetons et l'autorité du coffre-fort. L'autorité du compte de jetons sera la PDA du `vault`, ce qui permet au programme de signer le transfert de jetons.

L'instruction `insecure_withdraw` transférera des jetons du compte de jetons du `vault` vers un compte de jetons `withdraw_destination`. Cependant, le compte `authority` dans la structure `InsecureWithdraw` a un type de `UncheckedAccount`. Il s'agit d'un wrapper autour de `AccountInfo` pour indiquer explicitement que le compte n'est pas vérifié.

Sans une vérification du signataire, n'importe qui peut simplement fournir la clé publique du compte `authority` qui correspond à `authority` stocké sur le compte `vault`, et l'instruction `insecure_withdraw` continuera à être traitée.

Bien que cela soit quelque peu artificiel dans la mesure où tout programme DeFi avec un coffre-fort serait plus sophistiqué que cela, cela montrera comment l'absence de vérification du signataire peut entraîner le retrait de jetons par la mauvaise partie.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
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
        space = 8 + 32 + 32,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
    )]
    pub token_account: Account<'info, TokenAccount>,
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
        has_one = token_account,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    /// CHECK: demo missing signer check
    pub authority: UncheckedAccount<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 2. Testez l'instruction `insecure_withdraw`

Le fichier de test comprend le code pour invoquer l'instruction `initialize_vault` en utilisant `wallet` comme `authority` sur le coffre-fort. Le code génère ensuite 100 jetons vers le compte de jetons du `vault`. Théoriquement, la clé `wallet` devrait être la seule à pouvoir retirer les 100 jetons du coffre-fort.

Maintenant, ajoutons un test pour invoquer `insecure_withdraw` sur le programme pour montrer que la version actuelle du programme permet effectivement à une tierce partie de retirer ces 100 jetons.

Dans le test, nous utiliserons toujours la clé publique de `wallet` comme compte `authority`, mais nous utiliserons une paire de clés différente pour signer et envoyer la transaction.

```tsx
describe("signer-authorization", () => {
    ...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenAccount.publicKey,
        withdrawDestination: withdrawDestinationFake,
        authority: wallet.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(
      tokenAccount.publicKey
    )
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Exécutez `anchor test` pour voir que les deux transactions se terminent avec succès.

```bash
signer-authorization
  ✔ Initialize Vault (810ms)
  ✔ Insecure withdraw  (405ms)
```

Comme il n'y a pas de vérification du signataire pour le compte `authority`, l'instruction `insecure_withdraw` transférera des jetons du compte de jetons du `vault` vers le compte de jetons `withdrawDestinationFake`, tant que la clé publique du compte `authority` correspond à la clé publique stockée sur le champ d'autorité du compte `vault`. De toute évidence, l'instruction `insecure_withdraw` est aussi peu sécurisée que son nom l'indique.

### 3. Ajoutez l'instruction `secure_withdraw`

Corrigeons le problème dans une nouvelle instruction appelée `secure_withdraw`. Cette instruction sera identique à l'instruction `insecure_withdraw`, sauf que nous utiliserons le type `Signer` dans la structure des comptes pour valider le compte `authority` dans la structure `SecureWithdraw`. Si le compte `authority` n'est pas un signataire de la transaction, nous nous attendons à ce que la transaction échoue et renvoie une erreur.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
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
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

### 4. Testez l'instruction `secure_withdraw`

Avec l'instruction en place, retournez au fichier de test pour tester l'instruction `secure_withdraw`. Invoquez l'instruction `secure_withdraw`, en utilisant à nouveau la clé publique de `wallet` comme compte `authority` et la paire de clés `withdrawDestinationFake` comme signataire et destination du retrait. Comme le compte `authority` est validé à l'aide du type `Signer`, nous nous attendons à ce que la transaction échoue à la vérification du signataire et renvoie une erreur.

```tsx
describe("signer-authorization", () => {
    ...
	it("Secure withdraw", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenAccount.publicKey,
          withdrawDestination: withdrawDestinationFake,
          authority: wallet.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

Exécutez `anchor test` pour voir que la transaction renverra désormais une erreur de vérification de la signature.

```bash
Error: Signature verification failed
```

C'est tout ! C'est assez simple à éviter, mais incroyablement important. Assurez-vous toujours de réfléchir à qui devrait autoriser les instructions et assurez-vous que chacun est un signataire de la transaction.

Si vous voulez jeter un œil au code de la solution finale, vous pouvez le trouver sur la branche `solution` du [dépôt](https://github.com/Unboxed-Software/solana-signer-auth/tree/solution).

# Défi

À ce stade du cours, nous espérons que vous avez commencé à travailler sur des programmes et des projets en dehors des laboratoires et des défis fournis dans ces leçons. Pour ce défi et le reste des leçons sur les vulnérabilités de sécurité, le défi pour chaque leçon sera d'auditer votre propre code à la recherche de la vulnérabilité de sécurité discutée dans la leçon.

Alternativement, vous pouvez trouver des programmes open source à auditer. Il existe de nombreux programmes que vous pouvez consulter. Un bon début si vous ne vous opposez pas à plonger dans Rust natif serait les [programmes SPL](https://github.com/solana-labs/solana-program-library).

Pour cette leçon, examinez un programme (que ce soit le vôtre ou celui que vous avez trouvé en ligne) et effectuez un audit pour les vérifications de signataire. Si vous trouvez un bogue dans le programme de quelqu'un d'autre, veuillez les alerter ! Si vous trouvez un bogue dans votre propre programme, assurez-vous de le corriger immédiatement.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=26b3f41e-8241-416b-9cfa-05c5ab519d80) !
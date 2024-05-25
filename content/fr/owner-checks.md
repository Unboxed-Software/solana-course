---
title: Vérifications du propriétaire
objectives:
- Expliquer les risques de sécurité liés à l'absence de vérifications appropriées du propriétaire
- Implémenter des vérifications du propriétaire en utilisant Rust de manière détaillée
- Utiliser l'enveloppe `Account<'info, T>` d'Anchor et un type de compte pour automatiser les vérifications du propriétaire
- Utiliser la contrainte `#[account(owner = <expr>)]` d'Anchor pour définir explicitement un programme externe devant posséder un compte
---

# Résumé

- Utilisez les **vérifications du propriétaire** pour vérifier que les comptes sont détenus par le programme attendu. Sans des vérifications appropriées du propriétaire, des comptes détenus par des programmes inattendus pourraient être utilisés dans une instruction.
- Pour implémenter une vérification du propriétaire en Rust, il suffit de vérifier que le propriétaire d'un compte correspond à l'ID de programme attendu.

```rust
if ctx.accounts.account.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

- Les types de compte du programme Anchor implémentent le trait `Owner`, permettant à l'enveloppe `Account<'info, T>` de vérifier automatiquement la propriété du programme.
- Anchor vous donne la possibilité de définir explicitement le propriétaire d'un compte si cela doit être différent du programme en cours d'exécution.

# Aperçu général

Les vérifications du propriétaire sont utilisées pour vérifier qu'un compte passé dans une instruction est détenu par un programme attendu. Cela empêche les comptes détenus par un programme inattendu d'être utilisés dans une instruction.

Pour rappel, la structure `AccountInfo` contient les champs suivants. Une vérification du propriétaire consiste à vérifier que le champ `owner` dans `AccountInfo` correspond à l'ID de programme attendu.

```rust
/// Informations sur le compte
#[derive(Clone)]
pub struct AccountInfo<'a> {
    /// Clé publique du compte
    pub key: &'a Pubkey,
    /// La transaction a-t-elle été signée par la clé publique de ce compte ?
    pub is_signer: bool,
    /// Le compte est-il modifiable ?
    pub is_writable: bool,
    /// Les lamports dans le compte. Modifiables par les programmes.
    pub lamports: Rc<RefCell<&'a mut u64>>,
    /// Les données contenues dans ce compte. Modifiables par les programmes.
    pub data: Rc<RefCell<&'a mut [u8]>>,
    /// Programme qui possède ce compte
    pub owner: &'a Pubkey,
    /// Les données de ce compte contiennent un programme chargé (et sont maintenant en lecture seule)
    pub executable: bool,
    /// L'époque à laquelle ce compte devra payer à nouveau le loyer
    pub rent_epoch: Epoch,
}
```

### Vérification du propriétaire manquante

L'exemple ci-dessous montre une `admin_instruction` censée être accessible uniquement par un compte `admin` stocké sur un compte `admin_config`.

Bien que l'instruction vérifie que le compte `admin` a signé la transaction et correspond au champ `admin` stocké sur le compte `admin_config`, il n'y a pas de vérification du propriétaire pour vérifier que le compte `admin_config` passé dans l'instruction est détenu par le programme en cours d'exécution.

Étant donné que le `admin_config` n'est pas vérifié comme indiqué par le type `AccountInfo`, un faux compte `admin_config` détenu par un programme différent pourrait être utilisé dans l'instruction `admin_instruction`. Cela signifie qu'un attaquant pourrait créer un programme avec un `admin_config` dont la structure de données correspond à celle de votre programme, définir sa clé publique comme étant l'`admin` et passer son compte `admin_config` dans votre programme. Cela lui permettrait de tromper votre programme en pensant qu'il est l'admin autorisé pour votre programme.

Cet exemple simplifié n'affiche que l'`admin` dans les journaux du programme. Cependant, vous pouvez imaginer comment une vérification manquante du propriétaire pourrait permettre à des comptes falsifiés d'exploiter une instruction.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...

    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Ajout de la vérification du propriétaire

En Rust pure, vous pourriez résoudre ce problème en comparant le champ `owner` sur le compte à l'ID du programme. S'ils ne correspondent pas, vous retourneriez une erreur `IncorrectProgramId`.

```rust
if ctx.accounts.admin_config.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

Ajouter une vérification du propriétaire empêche que des comptes détenus par un programme inattendu soient passés en tant que compte `admin_config`. Si un faux compte `admin_config` était utilisé dans l'instruction `admin_instruction`, la transaction échouerait.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IncorrectProgramId.into());
        }

        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Utilisation de l'enveloppe `Account<'info, T>` d'Anchor

Anchor peut simplifier cela avec le type `Account`.

`Account<'info, T>` est une enveloppe autour de `AccountInfo` qui vérifie la propriété du programme et désérialise les données sous-jacentes dans le type de compte spécifié `T`. Cela vous permet d'utiliser `Account<'info, T>` pour valider facilement la propriété.

Pour le contexte, l'attribut `#[account]` implémente divers traits pour une structure de données représentant un compte. L'un d'entre eux est le trait `Owner` qui définit une adresse censée posséder un compte. Le propriétaire est défini comme l'ID de programme spécifié dans la macro `declare_id!`.

Dans l'exemple ci-dessous, `Account<'info, AdminConfig>` est utilisé pour valider le `admin_config`. Cela effectuera automatiquement la vérification du propriétaire et désérialisera les données du compte. De plus, la contrainte `has_one` est utilisée pour vérifier que le compte `admin` correspond au champ `admin` stocké sur le compte `admin_config`.

De cette manière, vous n'avez pas besoin de surcharger la logique de votre instruction avec des vérifications du propriétaire.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Utilisation de la contrainte `#[account(owner = <expr>)]` d'Anchor

En plus du type `Account`, vous pouvez utiliser une contrainte `owner`. La contrainte `owner` vous permet de définir le programme qui devrait posséder un compte s'il est différent de celui en cours d'exécution. Cela est utile, par exemple, si vous écrivez une instruction qui s'attend à ce qu'un compte soit une PDA dérivée d'un programme différent. Vous pouvez utiliser les contraintes `seeds` et `bump` et définir le `owner` pour dériver correctement et vérifier l'adresse du compte passé.

Pour utiliser la contrainte `owner`, vous devrez avoir accès à la clé publique du programme que vous vous attendez à posséder un compte. Vous pouvez soit passer le programme en tant que compte supplémentaire, soit coder en dur la clé publique quelque part dans votre programme.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
    #[account(
            seeds = b"test-seed",
            bump,
            owner = token_program.key()
    )]
    pda_derived_from_another_program: AccountInfo<'info>,
    token_program: Program<'info, Token>
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

# Laboratoire

Dans ce laboratoire, nous utiliserons deux programmes pour démontrer comment l'absence de vérification du propriétaire pourrait permettre à un compte factice de vider les jetons d'un compte de "coffre-fort" de jetons simplifié (notez que cela est très similaire au laboratoire de la leçon sur l'autorisation de signature).

Pour illustrer cela, un des programmes ne vérifiera pas le propriétaire du compte de coffre-fort vers lequel il retire des jetons.

Le deuxième programme sera un clone direct du premier programme créé par un utilisateur malveillant pour créer un compte identique au compte de coffre-fort du premier programme.

Sans la vérification du propriétaire, cet utilisateur malveillant pourra fournir le compte de coffre-fort détenu par son programme "falsifié", et le programme original s'exécutera toujours.

### 1. Démarrage

Pour commencer, téléchargez le code de démarrage de la branche `starter` de [ce référentiel](https://github.com/Unboxed-Software/solana-owner-checks/tree/starter). Le code de démarrage comprend deux programmes, `clone` et `owner_check`, ainsi que la configuration de base du fichier de test.

Le programme `owner_check` comprend deux instructions :

- `initialize_vault` initialise un compte de coffre-fort simplifié qui stocke les adresses d'un compte de jetons et d'un compte d'autorité.
- `insecure_withdraw` retire des jetons du compte de jetons, mais ne vérifie pas le propriétaire du compte de coffre-fort.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB");

#[program]
pub mod owner_check {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let account_data = ctx.accounts.vault.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = Vault::try_deserialize(&mut account_data_slice)?;

        if account_state.authority != ctx.accounts.authority.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
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
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = token_account,
        seeds = [b"token"],
        bump,
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
    /// CHECK:
    pub vault: UncheckedAccount<'info>,
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
}
```

Le programme `clone` comprend une seule instruction :

- `initialize_vault` initialise un compte de "coffre-fort" qui imite le compte de "coffre-fort" du programme `owner_check`. Il stocke l'adresse du vrai compte de jetons du coffre-fort, mais permet à l'utilisateur malveillant de mettre son propre compte d'autorité.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

declare_id!("DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3");

#[program]
pub mod clone {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32,
    )]
    pub vault: Account<'info, Vault>,
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 2. Tester l'instruction `insecure_withdraw`

Le fichier de test comprend un test pour invoquer l'instruction `initialize_vault` du programme `owner_check` en utilisant le portefeuille du fournisseur comme `authority`, puis crée 100 jetons dans le compte de jetons.

Le fichier de test comprend également un test pour invoquer l'instruction `initialize_vault` du programme `clone` afin d'initialiser un faux compte de "coffre-fort" stockant le même compte `tokenPDA`, mais une autorité différente. Notez qu'aucun nouveau jeton n'est créé ici.

Ajoutons un test pour invoquer l'instruction `insecure_withdraw`. Ce test doit passer le clone du coffre-fort et la fausse autorité. Comme il n'y a pas de vérification du propriétaire pour vérifier que le compte `vaultClone` est détenu par le programme `owner_check`, la vérification de la donnée de l'instruction réussira et affichera `walletFake` comme une autorité valide. Les jetons du compte `tokenPDA` seront alors retirés vers le compte `withdrawDestinationFake`.

```tsx
describe("owner-check", () => {
	...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
        .insecureWithdraw()
        .accounts({
            vault: vaultClone.publicKey,
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

Exécutez `anchor test` pour voir que `insecure_withdraw` se termine avec succès.

```bash
owner-check
  ✔ Initialize Vault (808ms)
  ✔ Initialize Fake Vault (404ms)
  ✔ Insecure withdraw (409ms)
```

Notez que `vaultClone` se désérialise avec succès même si Anchor initialise automatiquement de nouveaux comptes avec un discriminateur unique de 8 octets et vérifie le discriminateur lors de la désérialisation d'un compte. C'est parce que le discriminateur est un hash du nom du type de compte.

```rust
#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Comme les deux programmes initialisent des comptes identiques et que les deux structures sont nommées `Vault`, les comptes ont le même discriminateur même s'ils sont détenus par des programmes différents.

### 3. Ajouter l'instruction `secure_withdraw`

Corrigeons cette faille de sécurité.

Dans le fichier `lib.rs` du programme `owner_check`, ajoutez une instruction `secure_withdraw` et une structure de comptes `SecureWithdraw`.

Dans la structure `SecureWithdraw`, utilisons `Account<'info, Vault>` pour garantir qu'une vérification du propriétaire est effectuée sur le compte `vault`. Nous utiliserons également la contrainte `has_one` pour vérifier que les comptes `token_account` et `authority` passés à l'instruction correspondent aux valeurs stockées sur le compte `vault`.

```rust
#[program]
pub mod owner_check {
    use super::*;
	...

	pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}
...

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
       has_one = token_account,
       has_one = authority
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

### 4. Tester l'instruction `secure_withdraw`

Pour tester l'instruction `secure_withdraw`, nous invoquerons l'instruction deux fois. Tout d'abord, nous invoquerons l'instruction en utilisant le compte `vaultClone`, que nous nous attendons à échouer. Ensuite, nous invoquerons l'instruction en utilisant le compte `vault` correct pour vérifier que l'instruction fonctionne comme prévu.

```tsx
describe("owner-check", () => {
	...
	it("Secure withdraw, expect error", async () => {
        try {
            const tx = await program.methods
                .secureWithdraw()
                .accounts({
                    vault: vaultClone.publicKey,
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
            vault: vault.publicKey,
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

Exécutez `anchor test` pour voir que la transaction utilisant le compte `vaultClone` retournera maintenant une erreur Anchor, tandis que la transaction utilisant le compte `vault` se terminera avec succès.

```bash
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: AccountOwnedByWrongProgram. Error Number: 3007. Error Message: The given account is owned by a different program than expected.',
'Program log: Left:',
'Program log: DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3',
'Program log: Right:',
'Program log: HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB consumed 5554 of 200000 compute units',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB failed: custom program error: 0xbbf'
```

Ici, nous voyons comment l'utilisation du type `Account<'info, T>` d'Anchor peut simplifier le processus de validation du compte pour automatiser la vérification du propriétaire. De plus, notez que les erreurs d'Anchor peuvent spécifier le compte qui provoque l'erreur (par exemple, les troisième et quatrième lignes des journaux ci-dessus disent `AnchorError caused by account: vault`). Cela peut être très utile lors du débogage.

```bash
✔ Secure withdraw, expect error (78ms)
✔ Secure withdraw (10063ms)
```

C'est tout ce dont vous avez besoin pour vous assurer de vérifier le propriétaire d'un compte ! Comme pour certaines autres exploitations, c'est assez simple à éviter mais très important. Assurez-vous toujours de réfléchir à quels comptes devraient être détenus par quels programmes et assurez-vous d'ajouter une validation appropriée.

Si vous voulez jeter un coup d'œil au code de la solution finale, vous pouvez le trouver sur la branche `solution` du [référentiel](https://github.com/Unboxed-Software/solana-owner-checks/tree/solution).

# Défi

Tout comme avec les autres leçons de cette unité, votre opportunité de pratiquer l'évitement de cette exploitation de sécurité réside dans la vérification de vos propres programmes ou d'autres programmes.

Prenez le temps de passer en revue au moins un programme et assurez-vous que des vérifications appropriées du propriétaire sont effectuées sur les comptes transmis à chaque instruction.

N'oubliez pas, si vous trouvez un bogue ou une exploitation dans le programme de quelqu'un d'autre, veuillez les alerter ! Si vous en trouvez un dans votre propre programme, assurez-vous de le corriger immédiatement.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [et dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=e3069010-3038-4984-b9d3-2dc6585147b1) !
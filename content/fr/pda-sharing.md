---
title: Partage de PDA
objectives:
- Expliquer les risques de sécurité liés au partage de PDA
- Dériver des PDAs ayant des domaines d'autorité distincts
- Utiliser les contraintes `seeds` et `bump` d'Anchor pour valider les comptes PDA
---

# Résumé

- Utiliser la même PDA pour plusieurs domaines d'autorité expose votre programme à la possibilité pour les utilisateurs d'accéder à des données et des fonds qui ne leur appartiennent pas.
- Empêcher l'utilisation de la même PDA pour plusieurs comptes en utilisant des seeds spécifiques à l'utilisateur et/ou au domaine.
- Utiliser les contraintes `seeds` et `bump` d'Anchor pour valider qu'une PDA est dérivée en utilisant les seeds et le bump attendus.

# Aperçu général

Le partage de PDA fait référence à l'utilisation de la même PDA comme signataire pour plusieurs utilisateurs ou domaines. Surtout lors de l'utilisation de PDAs pour la signature, il peut sembler approprié d'utiliser une PDA globale pour représenter le programme. Cependant, cela ouvre la possibilité pour la validation du compte de réussir mais un utilisateur peut accéder à des fonds, des transferts ou des données qui ne lui appartiennent pas.

## PDA globale non sécurisé

Dans l'exemple ci-dessous, l'`autorité` du compte `vault` est une PDA dérivée en utilisant l'adresse `mint` stockée sur le compte `pool`. Cette PDA est passée comme compte `autorité` à l'instruction pour signer le transfert des jetons du compte `vault` vers le `withdraw_destination`.

Utiliser l'adresse `mint` comme seed pour dériver la PDA pour signer le `vault` est non sécurisé car plusieurs comptes `pool` pourraient être créés pour le même compte `vault` de jetons, mais avec un `withdraw_destination` différent. En utilisant l'adresse `mint` comme seed pour dériver la PDA pour signer les transferts de jetons, n'importe quel compte `pool` pourrait signer le transfert de jetons depuis un compte `vault` vers un `withdraw_destination` arbitraire.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_insecure {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[ctx.accounts.pool.mint.as_ref(), &[ctx.accounts.pool.bump]];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(has_one = vault, has_one = withdraw_destination)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

## PDA spécifique au compte sécurisé

Une approche pour créer une PDA spécifique au compte est d'utiliser le `withdraw_destination` comme seed pour dériver la PDA utilisée comme autorité du compte de jetons `vault`. Cela garantit que la PDA signant pour la CPI dans l'instruction `withdraw_tokens` est dérivée en utilisant le compte `withdraw_destination` `withdraw_destination` prévu. En d'autres termes, les jetons d'un compte `vault` ne peuvent être retirés que vers le `withdraw_destination` qui a été initialement initialisé avec le compte `pool`.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_secure {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[
            ctx.accounts.pool.withdraw_destination.as_ref(),
            &[ctx.accounts.pool.bump],
        ];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(has_one = vault, has_one = withdraw_destination)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

## Contraintes `seeds` et `bump` d'Anchor

Les PDAs peuvent être utilisés comme adresse d'un compte et permettre aux programmes de signer les PDAs qu'ils possèdent.

L'exemple ci-dessous utilise une PDA dérivée en utilisant le `withdraw_destination` comme adresse du compte `pool` et propriétaire du compte `vault` de jetons. Cela signifie que seul le compte `pool` associé au `vault` et au `withdraw_destination` correct peut être utilisé dans l'instruction `withdraw_tokens`.

Vous pouvez utiliser les contraintes `seeds` et `bump` d'Anchor avec l'attribut `#[account(...)]` pour valider la PDA du compte `pool`. Anchor dérive une PDA en utilisant les `seeds` et le `bump` spécifiés et la compare au compte passé dans l'instruction en tant que compte `pool`. La contrainte `has_one` est utilisée pour garantir en outre que seuls les comptes corrects stockés sur le compte `pool` sont passés dans l'instruction.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_recommended {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[
            ctx.accounts.pool.withdraw_destination.as_ref(),
            &[ctx.accounts.pool.bump],
        ];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(
				has_one = vault,
				has_one = withdraw_destination,
				seeds = [withdraw_destination.key().as_ref()],
				bump = pool.bump,
		)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

# Laboratoire

Pratiquons en créant un programme simple pour démontrer comment un partage de PDA peut permettre à un attaquant de retirer des jetons qui ne lui appartiennent pas. Ce laboratoire élargit les exemples ci-dessus en incluant les instructions pour initialiser les comptes de programme requis.

### 1. Démarrage

Pour commencer, téléchargez le code de départ sur la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/solana-pda-sharing/tree/starter). Le code de départ comprend un programme avec deux instructions et la configuration de base du fichier de test.

L'instruction `initialize_pool` initialise un nouveau `TokenPool` qui stocke un `vault`, un `mint`, un `withdraw_destination` et un `bump`. Le `vault` est un compte de jetons où l'autorité est définie comme une PDA dérivée de l'adresse `mint`.

L'instruction `withdraw_insecure` transférera des jetons du compte `vault` vers un compte `withdraw_destination`.

Cependant, tel qu'il est écrit, les seeds utilisées pour la signature ne sont pas spécifiques à la destination du `vault`, ouvrant ainsi le programme à des exploits de sécurité. Prenez une minute pour vous familiariser avec le code avant de continuer.

### 2. Testez l'instruction `withdraw_insecure`

Le fichier de test inclut le code pour appeler l'instruction `initialize_pool` et ensuite émettre 100 jetons vers le compte `vault`. Il inclut également un test pour appeler l'instruction `withdraw_insecure` en utilisant le `withdraw_destination` prévu. Cela montre que les instructions peuvent être utilisées comme prévu.

Ensuite, il y a deux tests supplémentaires pour montrer comment les instructions sont vulnérables à l'exploitation.

Le premier test appelle l'instruction `initialize_pool` pour créer un compte "factice" `pool` en utilisant le même compte `vault`, mais avec un `withdraw_destination` différent.

Le deuxième test effectue un retrait de ce pool, volant des fonds du `vault`.

```tsx
it("Insecure initialize allows pool to be initialized with wrong vault", async () => {
    await program.methods
      .initializePool(authInsecureBump)
      .accounts({
        pool: poolInsecureFake.publicKey,
        mint: mint,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestinationFake,
        payer: walletFake.publicKey,
      })
      .signers([walletFake, poolInsecureFake])
      .rpc()

    await new Promise((x) => setTimeout(x, 1000))

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultInsecure.address,
      wallet.payer,
      100
    )

    const account = await spl.getAccount(connection, vaultInsecure.address)
    expect(Number(account.amount)).to.equal(100)
})

it("Insecure withdraw allows stealing from vault", async () => {
    await program.methods
      .withdrawInsecure()
      .accounts({
        pool: poolInsecureFake.publicKey,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestinationFake,
        authority: authInsecure,
        signer: walletFake.publicKey,
      })
      .signers([walletFake])
      .rpc()

    const account = await spl.getAccount(connection, vaultInsecure.address)
    expect(Number(account.amount)).to.equal(0)
})
```

Exécutez `anchor test` pour voir que les transactions se terminent avec succès et que l'instruction `withdraw_insecure` permet au compte `vault` de se vider vers une fausse destination de retrait stockée sur le faux compte `pool`.

### 3. Ajoutez l'instruction `initialize_pool_secure`

Ajoutons maintenant une nouvelle instruction au programme pour initialiser de manière sécurisée un pool.

Cette nouvelle instruction `initialize_pool_secure` initialisera un compte `pool` en tant que PDA dérivée en utilisant le `withdraw_destination`. Elle initialisera également un compte `vault` de jetons avec l'autorité définie comme la PDA `pool`.

```rust
pub fn initialize_pool_secure(ctx: Context<InitializePoolSecure>) -> Result<()> {
    ctx.accounts.pool.vault = ctx.accounts.vault.key();
    ctx.accounts.pool.mint = ctx.accounts.mint.key();
    ctx.accounts.pool.withdraw_destination = ctx.accounts.withdraw_destination.key();
    ctx.accounts.pool.bump = *ctx.bumps.get("pool").unwrap();
    Ok(())
}

...

#[derive(Accounts)]
pub struct InitializePoolSecure<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 32 + 1,
        seeds = [withdraw_destination.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, TokenPool>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = pool,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
```

### 4. Ajoutez l'instruction `withdraw_secure`

Ensuite, ajoutez une instruction `withdraw_secure`. Cette instruction retirera des jetons du compte `vault` vers le `withdraw_destination`. Le compte `pool` est validé en utilisant les contraintes `seeds` et `bump` pour garantir que le compte PDA correct est fourni. Les contraintes `has_one` vérifient que les comptes de jetons `vault` et `withdraw_destination` corrects sont fournis.

```rust
pub fn withdraw_secure(ctx: Context<WithdrawTokensSecure>) -> Result<()> {
    let amount = ctx.accounts.vault.amount;
    let seeds = &[
    ctx.accounts.pool.withdraw_destination.as_ref(),
      &[ctx.accounts.pool.bump],
    ];
    token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
}

...

#[derive(Accounts)]
pub struct WithdrawTokensSecure<'info> {
    #[account(
        has_one = vault,
        has_one = withdraw_destination,
        seeds = [withdraw_destination.key().as_ref()],
        bump = pool.bump,
    )]
    pool: Account<'info, TokenPool>,
    #[account(mut)]
    vault: Account<'info, TokenAccount>,
    #[account(mut)]
    withdraw_destination: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokensSecure<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}
```

### 5. Testez l'instruction `withdraw_secure`

Enfin, retournez au fichier de test pour tester l'instruction `withdraw_secure` et montrer qu'en réduisant la portée de notre autorité de signature PDA, nous avons éliminé la vulnérabilité.

Avant d'écrire un test montrant que la vulnérabilité a été corrigée, écrivons un test qui montre simplement que les instructions d'initialisation et de retrait fonctionnent comme prévu :

```typescript
it("Secure pool initialization and withdraw works", async () => {
    const withdrawDestinationAccount = await getAccount(
      provider.connection,
      withdrawDestination
    )

    await program.methods
      .initializePoolSecure()
      .accounts({
        pool: authSecure,
        mint: mint,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .signers([vaultRecommended])
      .rpc()

    await new Promise((x) => setTimeout(x, 1000))

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultRecommended.publicKey,
      wallet.payer,
      100
    )

    await program.methods
      .withdrawSecure()
      .accounts({
        pool: authSecure,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .rpc()

    const afterAccount = await getAccount(
      provider.connection,
      withdrawDestination
    )

    expect(
      Number(afterAccount.amount) - Number(withdrawDestinationAccount.amount)
    ).to.equal(100)
})
```

Maintenant, testons que l'exploit ne fonctionne plus. Comme l'autorité du `vault` est la PDA `pool` dérivée du compte `withdraw_destination` prévu, il ne devrait plus être possible de retirer vers un compte autre que le `withdraw_destination` prévu.

Ajoutez un test montrant que vous ne pouvez pas appeler `withdraw_secure` avec la mauvaise destination de retrait. Il peut utiliser le pool et le vault créés dans le test précédent.

```typescript
  it("Secure withdraw doesn't allow withdraw to wrong destination", async () => {
    try {
      await program.methods
        .withdrawSecure()
        .accounts({
          pool: authSecure,
          vault: vaultRecommended.publicKey,
          withdrawDestination: withdrawDestinationFake,
        })
        .signers([walletFake])
        .rpc()

      assert.fail("expected error")
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
  })
```

Enfin, comme le compte `pool` est une PDA dérivée du compte `withdraw_destination`, nous ne pouvons pas créer de faux compte `pool` en utilisant la même PDA. Ajoutez un autre test montrant que la nouvelle instruction `initialize_pool_secure` n'autorise pas un attaquant à insérer le mauvais vault.

```typescript
it("Secure pool initialization doesn't allow wrong vault", async () => {
    try {
      await program.methods
        .initializePoolSecure()
        .accounts({
          pool: authSecure,
          mint: mint,
          vault: vaultInsecure.address,
          withdrawDestination: withdrawDestination,
        })
        .signers([vaultRecommended])
        .rpc()

      assert.fail("expected error")
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
})
```

Exécutez `anchor test` pour voir que les nouvelles instructions n'autorisent pas un attaquant à retirer d'un vault qui ne lui appartient pas.

```
  pda-sharing
    ✔ Initialize Pool Insecure (981ms)
    ✔ Withdraw (470ms)
    ✔ Insecure initialize allows pool to be initialized with wrong vault (10983ms)
    ✔ Insecure withdraw allows stealing from vault (492ms)
    ✔ Secure pool initialization and withdraw works (2502ms)
unknown signer: ARjxAsEPj6YsAPKaBfd1AzUHbNPtAeUsqusAmBchQTfV
    ✔ Secure withdraw doesn't allow withdraw to wrong destination
unknown signer: GJcHJLot3whbY1aC9PtCsBYk5jWoZnZRJPy5uUwzktAY
    ✔ Secure pool initialization doesn't allow wrong vault
```

Et voilà ! Contrairement à certaines autres vulnérabilités de sécurité que nous avons discutées, celle-ci est plus conceptuelle et ne peut pas être corrigée en utilisant simplement un type spécifique d'Anchor. Vous devrez réfléchir à l'architecture de votre programme et vous assurer que vous ne partagez pas de PDAs entre différents domaines. 

Si vous souhaitez consulter le code de la solution finale, vous pouvez le trouver sur la branche `solution` du [même dépôt](https://github.com/Unboxed-Software/solana-pda-sharing/tree/solution).

# Défi

Tout comme avec les autres leçons de cette unité, votre opportunité de pratiquer l'évitement de cette faille de sécurité réside dans l'audit de vos propres programmes ou d'autres programmes.

Prenez le temps de passer en revue au moins un programme et recherchez des vulnérabilités potentielles dans sa structure PDA. Les PDAs utilisées pour la signature devraient être étroites et se concentrer autant que possible sur un seul domaine.

N'oubliez pas que si vous trouvez un bug ou une faille dans le programme de quelqu'un d'autre, veuillez les alerter ! Si vous en trouvez un dans votre propre programme, assurez-vous de le corriger immédiatement.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=5744079f-9473-4485-9a14-9be4d31b40d1) !

---
title: Fermeture de comptes et attaques de résurrection
objectives:
- Expliquer les différentes vulnérabilités de sécurité associées à la fermeture incorrecte de comptes de programmes
- Fermer les comptes de programmes de manière sûre et sécurisée en utilisant Rust natif
- Fermer les comptes de programmes de manière sûre et sécurisée en utilisant la contrainte `close` d'Anchor
---

# Résumé

- **La fermeture d'un compte** de manière incorrecte crée une opportunité pour des attaques de réinitialisation/résurrection
- La runtime Solana **collecte les comptes** lorsqu'ils ne sont plus exempts de loyer. La fermeture des comptes implique le transfert des lamports stockés dans le compte pour l'exemption de loyer vers un autre compte de votre choix.
- Vous pouvez utiliser la contrainte `#[account(close = <adresse_pour_envoyer_les_lamports>)]` d'Anchor pour fermer de manière sûre les comptes et définir le discriminateur du compte sur `CLOSED_ACCOUNT_DISCRIMINATOR`
    ```rust
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
    ```

# Aperçu général

Bien que cela semble simple, la fermeture correcte des comptes peut être délicate. Il existe plusieurs façons pour un attaquant de contourner la fermeture du compte si vous ne suivez pas des étapes spécifiques.

Pour mieux comprendre ces vecteurs d'attaque, explorons en profondeur chaque scénario.

## Fermeture de compte non sécurisée

Fondamentalement, la fermeture d'un compte implique le transfert de ses lamports vers un compte séparé, déclenchant ainsi la collecte des déchets par la runtime Solana sur le premier compte. Cela réinitialise le propriétaire du programme au programme système.

Jetez un œil à l'exemple ci-dessous. L'instruction nécessite deux comptes :

1. `account_to_close` - le compte à fermer
2. `destination` - le compte qui doit recevoir les lamports du compte fermé

La logique du programme vise à fermer un compte en augmentant simplement les lamports du compte `destination` du montant stocké dans le compte `account_to_close` et en définissant les lamports du compte `account_to_close` à 0. Avec ce programme, après le traitement complet d'une transaction, le compte `account_to_close` sera collecté par la runtime.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(ctx.accounts.account_to_close.to_account_info().lamports())
            .unwrap();
        **ctx.accounts.account_to_close.to_account_info().lamports.borrow_mut() = 0;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account_to_close: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

Cependant, la collecte des déchets ne se produit pas tant que la transaction n'est pas terminée. Et comme il peut y avoir plusieurs instructions dans une transaction, cela crée une opportunité pour un attaquant d'invoquer l'instruction de fermeture du compte, mais aussi d'inclure dans la transaction un transfert pour rembourser les lamports d'exemption de loyer du compte. Le résultat est que le compte *ne sera pas* collecté, ouvrant la voie à l'attaquant pour provoquer un comportement non souhaité dans le programme et même drainer un protocole.

## Fermeture de compte sécurisée

Les deux choses les plus importantes que vous pouvez faire pour fermer cette faille sont de mettre les données du compte à zéro et d'ajouter un discriminateur de compte indiquant que le compte a été fermé. Vous avez besoin *de ces deux* éléments pour éviter un comportement de programme non souhaité.

Un compte avec des données mises à zéro peut encore être utilisé pour certaines choses, surtout s'il s'agit d'une PDA dont la dérivation d'adresse est utilisée à l'intérieur du programme à des fins de vérification. Cependant, les dommages peuvent être potentiellement limités si l'attaquant ne peut pas accéder aux données précédemment stockées.

Pour sécuriser davantage le programme, cependant, les comptes fermés doivent recevoir un discriminateur de compte qui les désigne comme "fermés", et toutes les instructions doivent effectuer des vérifications sur tous les comptes fournis qui renvoient une erreur si le compte est marqué comme fermé.

Regardez l'exemple ci-dessous. Ce programme transfère les lamports d'un compte, met à zéro les données du compte et définie un discriminateur de compte en une seule instruction dans l'espoir d'empêcher une instruction ultérieure d'utiliser à nouveau ce compte avant qu'il ne soit collecté. Omettre l'une de ces étapes entraînerait une vulnérabilité de sécurité.

```rust
use anchor_lang::prelude::*;
use std::io::Write;
use std::ops::DerefMut;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure_still_still {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let account = ctx.accounts.account.to_account_info();

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        let mut data = account.try_borrow_mut_data()?;
        for byte in data.deref_mut().iter_mut() {
            *byte = 0;
        }

        let dst: &mut [u8] = &mut data;
        let mut cursor = std::io::Cursor::new(dst);
        cursor
            .write_all(&anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR)
            .unwrap();

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

Notez que l'exemple ci-dessus utilise le `CLOSED_ACCOUNT_DISCRIMINATOR` d'Anchor. Il s'agit simplement d'un discriminateur de compte où chaque octet est `255`. Le discriminateur n'a pas de signification inhérente, mais s'il est couplé à des vérifications de validation de compte qui renvoient des erreurs chaque fois qu'un compte avec ce discriminateur est passé à une instruction, vous empêcherez votre programme de traiter involontairement une instruction avec un compte fermé.

### Forcer le vidage manuel d'un compte

Il reste un petit problème. Bien que la pratique de mettre à zéro les données du compte et d'ajouter un discriminateur de compte "fermé" empêchera votre programme d'être exploité, un utilisateur peut toujours empêcher un compte d'être collecté en remboursant les lamports du compte avant la fin d'une instruction. Cela entraîne l'existence d'un ou de plusieurs comptes dans un état de limbes où ils ne peuvent pas être utilisés mais ne peuvent pas non plus être collectés.

Pour gérer ce cas particulier, vous pouvez envisager d'ajouter une instruction qui permettra à *n'importe qui* de définir à zéro les lamports des comptes marqués du discriminateur de compte "fermé". La seule validation de compte que cette instruction effectuerait serait de s'assurer que le compte à vider est marqué comme fermé. Cela pourrait ressembler à ceci :

```rust
use anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR;
use anchor_lang::prelude::*;
use std::io::{Cursor, Write};
use std::ops::DerefMut;

...

    pub fn force_defund(ctx: Context<ForceDefund>) -> ProgramResult {
        let account = &ctx.accounts.account;

        let data = account.try_borrow_data()?;
        assert!(data.len() > 8);

        let mut discriminator = [0u8; 8];
        discriminator.copy_from_slice(&data[0..8]);
        if discriminator != CLOSED_ACCOUNT_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        Ok(())
    }

...

#[derive(Accounts)]
pub struct ForceDefund<'info> {
    account: AccountInfo<'info>,
    destination: AccountInfo<'info>,
}
```

Étant donné que n'importe qui peut appeler cette instruction, cela peut agir comme un moyen de dissuasion contre les tentatives d'attaques par résurrection, car l'attaquant paie l'exemption de loyer du compte, mais n'importe qui d'autre peut réclamer les lamports dans un compte remboursé pour lui-même.

Bien que cela ne soit pas nécessaire, cela peut aider à éliminer le gaspillage d'espace et de lamports associé à ces comptes "limbes".

## Utiliser la contrainte `close` d'Anchor

Heureusement, Anchor simplifie tout cela avec la contrainte `#[account(close = <compte_cible>)]`. Cette contrainte gère tout ce qui est nécessaire pour fermer un compte de manière sécurisée :

1. Transfère les lamports du compte vers le `<compte_cible>` donné
2. Met à zéro les données du compte
3. Définit le discriminateur du compte sur la variante `CLOSED_ACCOUNT_DISCRIMINATOR`

Il vous suffit de l'ajouter dans la struct de validation de compte pour le compte que vous voulez fermer :

```rust
#[derive(Accounts)]
pub struct CloseAccount {
    #[account(
        mut, 
        close = receiver
    )]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
}
```

L'instruction `force_defund` est un ajout facultatif que vous devrez implémenter vous-même si vous souhaitez l'utiliser.

# Laboratoire

Pour clarifier comment un attaquant pourrait tirer parti d'une attaque de résurrection, travaillons avec un programme de loterie simple qui utilise l'état du compte de programme pour gérer la participation d'un utilisateur à la loterie.

## 1. Configuration

Commencez par obtenir le code sur la branche `starter` du [dépôt suivant](https://github.com/Unboxed-Software/solana-closing-accounts/tree/starter).

Le code a deux instructions sur le programme et deux tests dans le répertoire `tests`.

Les instructions du programme sont les suivantes :

1. `enter_lottery`
2. `redeem_rewards_insecure`

Lorsqu'un utilisateur appelle `enter_lottery`, le programme initialisera un compte pour stocker des informations sur la participation à la loterie de l'utilisateur.

Étant donné que c'est un exemple simplifié plutôt qu'un programme de loterie complet, une fois qu'un utilisateur a participé à la loterie, il peut appeler l'instruction `redeem_rewards_insecure` à tout moment. Cette instruction émettra à l'utilisateur une certaine quantité de jetons de récompense proportionnelle au nombre de fois où l'utilisateur a participé à la loterie. Après l'émission des récompenses, le programme ferme la participation à la loterie de l'utilisateur.

Prenez quelques minutes pour vous familiariser avec le code du programme. L'instruction `enter_lottery` crée simplement un compte à une PDA mappée sur l'utilisateur et initialise certaines données dessus.

L'instruction `redeem_rewards_insecure` effectue une validation de compte et de données, émet des jetons sur le compte de jetons donné, puis ferme le compte de loterie en supprimant ses lamports.

Cependant, notez que l'instruction `redeem_rewards_insecure` *transfère uniquement* les lamports du compte, laissant le compte ouvert aux attaques de résurrection.

## 2. Test du programme non sécurisé

Un attaquant qui parvient à empêcher la fermeture de son compte peut alors appeler `redeem_rewards_insecure` plusieurs fois, réclamant plus de récompenses qu'il n'en a droit.

Certains tests de démarrage ont déjà été écrits pour illustrer cette vulnérabilité. Consultez le fichier `closing-accounts.ts` dans le répertoire `tests`. Il y a une configuration dans la fonction `before`, puis un test qui crée simplement une nouvelle participation à la loterie pour `attacker`.

Enfin, il y a un test qui montre comment un attaquant peut garder le compte en vie même après avoir réclamé des récompenses, puis réclamer à nouveau des récompenses. Ce test ressemble à ceci :

```typescript
it("attacker  can close + refund lottery acct + claim multiple rewards", async () => {
    // claim multiple times
    for (let i = 0; i < 2; i++) {
      const tx = new Transaction()
      // instruction claims rewards, program will try to close account
      tx.add(
        await program.methods
          .redeemWinningsInsecure()
          .accounts({
            lotteryEntry: attackerLotteryEntry,
            user: attacker.publicKey,
            userAta: attackerAta,
            rewardMint: rewardMint,
            mintAuth: mintAuth,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      )

      // user adds instruction to refund dataAccount lamports
      const rentExemptLamports =
        await provider.connection.getMinimumBalanceForRentExemption(
          82,
          "confirmed"
        )
      tx.add(
        SystemProgram.transfer({
          fromPubkey: attacker.publicKey,
          toPubkey: attackerLotteryEntry,
          lamports: rentExemptLamports,
        })
      )
      // send tx
      await sendAndConfirmTransaction(provider.connection, tx, [attacker])
      await new Promise((x) => setTimeout(x, 5000))
    }

    const ata = await getAccount(provider.connection, attackerAta)
    const lotteryEntry = await program.account.lotteryAccount.fetch(
      attackerLotteryEntry
    )

    expect(Number(ata.amount)).to.equal(
      lotteryEntry.timestamp.toNumber() * 10 * 2
    )
})
```

Ce test fait ce qui suit :
1. Appelle `redeem_rewards_insecure` pour réclamer les récompenses de l'utilisateur.
2. Dans la même transaction, ajoute une instruction pour rembourser la participation à la loterie de l'utilisateur avant qu'elle ne puisse réellement être fermée.
3. Répète avec succès les étapes 1 et 2, réclamant des récompenses pour une deuxième fois.

Vous pouvez théoriquement répéter les étapes 1-2 indéfiniment jusqu'à ce que a) le programme n'ait plus de récompenses à donner ou b) quelqu'un le remarque et corrige l'exploit. Cela serait évidemment un problème grave dans n'importe quel programme réel car cela permet à un attaquant malveillant de vider tout un pool de récompenses.

## 3. Créer une instruction `redeem_rewards_secure`

Pour éviter que cela ne se produise, nous allons créer une nouvelle instruction qui ferme le compte de la loterie de manière sécurisée en utilisant la contrainte `close` d'Anchor. N'hésitez pas à essayer cela vous-même si vous le souhaitez.

La nouvelle struct de validation de compte appelée `RedeemWinningsSecure` devrait ressembler à ceci :

```rust
#[derive(Accounts)]
pub struct RedeemWinningsSecure<'info> {
    // le programme s'attend à ce que ce compte soit initialisé
    #[account(
        mut,
        seeds = [user.key().as_ref()],
        bump = lottery_entry.bump,
        has_one = user,
        close = user
    )]
    pub lottery_entry: Account<'info, LotteryAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_ata.key() == lottery_entry.user_ata
    )]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = reward_mint.key() == user_ata.mint
    )]
    pub reward_mint: Account<'info, Mint>,
    ///CHECK: mint authority
    #[account(
        seeds = [MINT_SEED.as_bytes()],
        bump
    )]
    pub mint_auth: AccountInfo<'info>,
    pub token_program: Program<'info, Token>
}
```

Cela devrait être exactement la même chose que la struct de validation de compte `RedeemWinnings` originale, sauf qu'il y a une contrainte supplémentaire `close = user` sur le compte `lottery_entry`. Cela dira à Anchor de fermer le compte en mettant à zéro les données, en transférant ses lamports vers le compte `user` et en définissant le discriminateur du compte sur la variante `CLOSED_ACCOUNT_DISCRIMINATOR`. Cette dernière étape est ce qui empêchera le compte d'être réutilisé si le programme a déjà tenté de le fermer.

Ensuite, nous pouvons créer une méthode `mint_ctx` sur la nouvelle struct `RedeemWinningsSecure` pour aider avec la CPI de minting au programme de jetons.

```Rust
impl<'info> RedeemWinningsSecure <'info> {
    pub fn mint_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: self.reward_mint.to_account_info(),
            to: self.user_ata.to_account_info(),
            authority: self.mint_auth.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
```

Enfin, la logique pour la nouvelle instruction sécurisée devrait ressembler à ceci :

```rust
pub fn redeem_winnings_secure(ctx: Context<RedeemWinningsSecure>) -> Result<()> {

    msg!("Calculating winnings");
    let amount = ctx.accounts.lottery_entry.timestamp as u64 * 10;

    msg!("Minting {} tokens in rewards", amount);
    // program signer seeds
    let auth_bump = *ctx.bumps.get("mint_auth").unwrap();
    let auth_seeds = &[MINT_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // redeem rewards by minting to user
    mint_to(ctx.accounts.mint_ctx().with_signer(signer), amount)?;

    Ok(())
}
```

Cette logique calcule simplement les récompenses pour l'utilisateur réclamant et transfère les récompenses. Cependant, en raison de la contrainte `close` dans la struct de validation de compte, l'attaquant ne devrait pas pouvoir appeler cette instruction plusieurs fois.

## 4. Test du programme

Pour tester notre nouvelle instruction sécurisée, créons un nouveau test qui tente d'appeler `redeemingWinningsSecure` deux fois. Nous nous attendons à ce que la deuxième appel lance une erreur.

```typescript
it("attacker cannot claim multiple rewards with secure claim", async () => {
    const tx = new Transaction()
    // instruction claims rewards, program will try to close account
    tx.add(
      await program.methods
        .redeemWinningsSecure()
        .accounts({
          lotteryEntry: attackerLotteryEntry,
          user: attacker.publicKey,
          userAta: attackerAta,
          rewardMint: rewardMint,
          mintAuth: mintAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    )

    // user adds instruction to refund dataAccount lamports
    const rentExemptLamports =
      await provider.connection.getMinimumBalanceForRentExemption(
        82,
        "confirmed"
      )
    tx.add(
      SystemProgram.transfer({
        fromPubkey: attacker.publicKey,
        toPubkey: attackerLotteryEntry,
        lamports: rentExemptLamports,
      })
    )
    // send tx
    await sendAndConfirmTransaction(provider.connection, tx, [attacker])

    try {
      await program.methods
        .redeemWinningsSecure()
        .accounts({
          lotteryEntry: attackerLotteryEntry,
          user: attacker.publicKey,
          userAta: attackerAta,
          rewardMint: rewardMint,
          mintAuth: mintAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker])
        .rpc()
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
})
```

Exécutez `anchor test` pour voir si le test réussit. La sortie ressemblera à ceci :

```bash
  closing-accounts
    ✔ Enter lottery (451ms)
    ✔ attacker can close + refund lottery acct + claim multiple rewards (18760ms)
AnchorError caused by account: lottery_entry. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.
    ✔ attacker cannot claim multiple rewards with secure claim (414ms)
```

Notez que cela n'empêche pas l'utilisateur malveillant de rembourser complètement son compte - cela protège simplement notre programme contre une réutilisation accidentelle du compte lorsqu'il devrait être fermé. Jusqu'à présent, nous n'avons pas implémenté d'instruction `force_defund`, mais nous pourrions le faire. Si vous vous sentez prêt, essayez-le vous-même !

La manière la plus simple et la plus sécurisée de fermer des comptes est d'utiliser la contrainte `close` d'Anchor. Si vous avez besoin d'un comportement plus personnalisé et que vous ne pouvez pas utiliser cette contrainte, assurez-vous de reproduire sa fonctionnalité pour garantir la sécurité de votre programme.

Si vous souhaitez consulter le code de la solution finale, vous pouvez le trouver sur la branche `solution` du [même dépôt](https://github.com/Unboxed-Software/solana-closing-accounts/tree/solution).

# Défi

Tout comme avec les autres leçons de cette unité, votre opportunité de pratiquer l'évitement de cette faille de sécurité réside dans l'audit de votre propre programme ou d'autres programmes.

Prenez le temps de revoir au moins un programme et assurez-vous que lors de la fermeture des comptes, ils ne sont pas vulnérables aux attaques de renaissance.

N'oubliez pas, si vous trouvez un bogue ou une faille dans le programme de quelqu'un d'autre, veuillez les alerter ! Si vous en trouvez un dans votre propre programme, assurez-vous de le corriger immédiatement.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=e6b99d4b-35ed-4fb2-b9cd-73eefc875a0f) !
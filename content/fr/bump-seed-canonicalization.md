---
title: Canonicalisation du "Bump Seed"
objectives:
- Expliquer les vulnérabilités associées à l'utilisation de PDA dérivées sans le "canonical bump"
- Initialiser une PDA en utilisant les contraintes `seeds` et `bump` d'Anchor pour utiliser automatiquement le "canonical bump"
- Utiliser les contraintes `seeds` et `bump` d'Anchor pour garantir que le "canonical bump" est toujours utilisé dans les futures instructions lors de la dérivation d'une PDA
---

# Résumé

- La fonction [**`create_program_address`**](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) dérive une PDA sans rechercher le **canonical bump**. Cela signifie qu'il existe plusieurs bumps valides, chacun produisant des adresses différentes.
- En utilisant [**`find_program_address`**](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address), on garantit que le bump valide le plus élevé, ou le bump canonique, est utilisé pour la dérivation, créant ainsi une méthode déterministe pour trouver une adresse en fonction de seeds spécifiques.
- Lors de l'initialisation, on peut utiliser les contraintes `seeds` et `bump` d'Anchor pour garantir que les dérivations PDA dans la structure de validation du compte utilisent toujours le bump canonique.
- Anchor permet de **spécifier un bump** avec la contrainte `bump = <some_bump>` lors de la vérification de l'adresse d'une PDA.
- Étant donné que `find_program_address` peut être coûteux, la meilleure pratique est de stocker le bump dérivé dans le champ de données du compte pour référence ultérieure lors de la re-dérivation de l'adresse pour la vérification.
    ```rust
    #[derive(Accounts)]
    pub struct VerifyAddress<'info> {
    	#[account(
        	seeds = [DATA_PDA_SEED.as_bytes()],
    	    bump = data.bump
    	)]
    	data: Account<'info, Data>,
    }
    ```

# Aperçu général

Les bumps seeds sont des nombres entre 0 et 255 inclus, utilisés pour garantir qu'une adresse dérivée à l'aide de [`create_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) est une PDA valide. Le **canonical bump** est la valeur de bump la plus élevée qui produit une PDA valide. La norme dans Solana est de *toujours utiliser le bump canonique* lors de la dérivation de PDA, tant pour la sécurité que pour la commodité.

## Dérivation PDA non sécurisée avec `create_program_address`

Étant donné un ensemble de seeds, la fonction `create_program_address` produira une PDA valide environ 50% du temps. La bump seed est un octet supplémentaire ajouté comme seed pour "bump" l'adresse dérivée dans une zone valide. Comme il existe 256 bump seeds possibles et que la fonction produit des PDA valides environ 50% du temps, il existe de nombreuses bumps valides pour un ensemble donné de seeds d'entrée.

Cela peut causer de la confusion pour localiser des comptes lors de l'utilisation des seeds comme moyen de faire correspondre des informations connues à des comptes. En utilisant le bump canonique comme norme, on garantit que l'on peut toujours trouver le bon compte. Plus important encore, cela évite les exploits de sécurité causés par la nature ouverte de l'autorisation de plusieurs bumps.

Dans l'exemple ci-dessous, l'instruction `set_value` utilise un `bump` qui a été passé en tant que données d'instruction pour dériver une PDA. L'instruction dérive ensuite la PDA en utilisant la fonction `create_program_address` et vérifie que l'`adresse` correspond à la clé publique du compte `data`.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_insecure {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, key: u64, new_value: u64, bump: u8) -> Result<()> {
        let address =
            Pubkey::create_program_address(&[key.to_le_bytes().as_ref(), &[bump]], ctx.program_id).unwrap();
        if address != ctx.accounts.data.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        ctx.accounts.data.value = new_value;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct BumpSeed<'info> {
    data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
}
```

Bien que l'instruction dérive la PDA et vérifie le compte transmis, ce qui est bien, elle permet à l'appelant de transmettre un bump arbitraire. Selon le contexte de votre programme, cela pourrait entraîner un comportement indésirable ou une exploitation potentielle.

Si la correspondance de la seed était destinée à imposer une relation un-à-un entre PDA et utilisateur, par exemple, ce programme ne l'appliquerait pas correctement. Un utilisateur pourrait appeler le programme plusieurs fois avec de nombreuses demandes valides, produisant ainsi une PDA différent à chaque fois.

## Dérivation recommandée avec `find_program_address`

Une manière simple de contourner ce problème est de faire en sorte que le programme n'attende que le bump canonique et d'utiliser `find_program_address` pour dériver la PDA.

[`find_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address) *utilise toujours le bump canonique*. Cette fonction itère en appelant `create_program_address`, en commençant par un bump de 255 et en décrémentant le bump d'un à chaque itération. Dès qu'une adresse valide est trouvée, la fonction renvoie à la fois la PDA dériveé et le bump canonique utilisé pour la dériver.

Cela garantit une correspondance unique entre vos seeds d'entrée et l'adresse qu'elles produisent.

```rust
pub fn set_value_secure(
    ctx: Context<BumpSeed>,
    key: u64,
    new_value: u64,
    bump: u8,
) -> Result<()> {
    let (address, expected_bump) =
        Pubkey::find_program_address(&[key.to_le_bytes().as_ref()], ctx.program_id);

    if address != ctx.accounts.data.key() {
        return Err(ProgramError::InvalidArgument.into());
    }
    if expected_bump != bump {
        return Err(ProgramError::InvalidArgument.into());
    }

    ctx.accounts.data.value = new_value;
    Ok(())
}
```

## Utilisez les contraintes `seeds` et `bump` d'Anchor

Anchor offre un moyen pratique de dériver des PDA dans la structure de validation du compte en utilisant les contraintes `seeds` et `bump`. Celles-ci peuvent même être combinées avec la contrainte `init` pour initialiser le compte à l'adresse prévue. Pour protéger le programme de la vulnérabilité que nous avons discutée tout au long de cette leçon, Anchor ne vous permet même pas d'initialiser un compte à une adresse PDA en utilisant autre chose que le bump canonique. À la place, il utilise `find_program_address` pour dériver la PDA, puis effectue l'initialisation.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        Ok(())
    }
}

// initialise le compte à PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // dérive la PDA en utilisant le bump canonique
    bump,
    payer = payer,
    space = 8 + 8
  )]
  data: Account<'info, Data>,
  system_program: Program<'info, System>
}

#[account]
pub struct Data {
    value: u64,
}
```

Si vous n'initialisez pas un compte, vous pouvez toujours valider les PDA avec les contraintes `seeds` et `bump`. Cela redérive simplement la PDA et compare l'adresse dérivée avec l'adresse du compte transmis.

Dans ce scénario, Anchor *permet* de spécifier le bump à utiliser pour dériver la PDA avec `bump = <some_bump>`. L'intention ici n'est pas de vous faire utiliser des bumps arbitraires, mais plutôt de vous permettre d'optimiser votre programme. La nature itérative de `find_program_address` le rend coûteux, donc la meilleure pratique est de stocker le bump canonique dans les données du compte PDA lors de l'initialisation d'une PDA, vous permettant de référencer le bump stocké lors de la validation de la PDA dans des instructions ultérieures.

Lorsque vous spécifiez le bump à utiliser, Anchor utilise `create_program_address` avec le bump fourni au lieu de `find_program_address`. Ce schéma de stockage du bump dans les données du compte garantit que votre programme utilise toujours le bump canonique sans dégrader les performances.

```rust
use anchor_lang::prelude::*;

declare_id!("CVwV9RoebTbmzsGg1uqU1s4a3LvTKseewZKmaNLSxTqc");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        // stocke le bump sur le compte
        ctx.accounts.data.bump = *ctx.bumps.get("data").unwrap();
        Ok(())
    }

    pub fn verify_address(ctx: Context<VerifyAddress>, _key: u64) -> Result<()> {
        msg!("PDA confirmée comme dérivée avec le bump canonique : {}", ctx.accounts.data.key());
        Ok(())
    }
}

// initialise le compte à PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // dérive la PDA en utilisant le bump canonique
    bump,
    payer = payer,
    space = 8 + 8 + 1
  )]
  data: Account<'info, Data>,
  system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(key: u64)]
pub struct VerifyAddress<'info> {
  #[account(
    seeds = [key.to_le_bytes().as_ref()],
    // garantit d'être toujours le bump canonique à chaque fois
    bump = data.bump
  )]
  data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
    // champ bump
    bump: u8
}
```

Si vous ne spécifiez pas le bump sur la contrainte `bump`, Anchor utilisera toujours `find_program_address` pour dériver la PDA en utilisant le bump canonique. En conséquence, votre instruction encourra un budget de calcul variable. Les programmes qui risquent déjà de dépasser leur budget de calcul devraient utiliser ceci avec précaution, car il y a une chance que le budget du programme soit parfois et imprévisiblement dépassé.

D'autre part, si vous devez simplement vérifier l'adresse d'une PDA transmise sans initialiser un compte, vous serez contraint de soit laisser Anchor dériver le bump canonique, soit exposer votre programme à des risques inutiles. Dans ce cas, veuillez utiliser le bump canonique malgré la légère réduction des performances.

# Laboratoire

Pour démontrer les exploits de sécurité possibles lorsque vous ne vérifiez pas le bump canonique, travaillons avec un programme qui permet à chaque utilisateur du programme de "réclamer" des récompenses à temps.

### 1. Configuration

Commencez par obtenir le code sur la branche `starter` de [ce référentiel](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/starter).

Remarquez qu'il y a deux instructions sur le programme et un seul test dans le répertoire `tests`.

Les instructions sur le programme sont :

1. `create_user_insecure`
2. `claim_insecure`

L'instruction `create_user_insecure` crée simplement un nouveau compte à une PDA dérivée en utilisant la clé publique du signataire et un bump transmis.

L'instruction `claim_insecure` émet ensuite 10 jetons à l'utilisateur, puis marque le compte des récompenses comme réclamé pour qu'il ne puisse pas réclamer à nouveau.

Cependant, le programme ne vérifie pas explicitement que les PDA en question utilisent le bump canonique.

Jetez un œil au programme pour comprendre ce qu'il fait avant de continuer.

### 2. Testez les instructions non sécurisées

Étant donné que les instructions ne nécessitent pas explicitement que la PDA `user` utilise le bump canonique, un attaquant peut créer plusieurs comptes par portefeuille et réclamer plus de récompenses que ce qui est autorisé.

Le test dans le répertoire `tests` crée une nouvelle paire de clés appelée `attacker` pour représenter un attaquant. Il parcourt ensuite tous les bumps possibles et appelle `create_user_insecure` et `claim_insecure`. À la fin, le test s'attend à ce que l'attaquant ait réussi à réclamer plusieurs fois et ait gagné plus de 10 jetons au total.

```typescript
it("Attacker can claim more than reward limit with insecure instructions", async () => {
    const attacker = Keypair.generate()
    await safeAirdrop(attacker.publicKey, provider.connection)
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey)

    let numClaims = 0

    for (let i = 0; i < 256; i++) {
      try {
        const pda = createProgramAddressSync(
          [attacker.publicKey.toBuffer(), Buffer.from([i])],
          program.programId
        )
        await program.methods
          .createUserInsecure(i)
          .accounts({
            user: pda,
            payer: attacker.publicKey,
          })
          .signers([attacker])
          .rpc()
        await program.methods
          .claimInsecure(i)
          .accounts({
            user: pda,
            mint,
            payer: attacker.publicKey,
            userAta: ataKey,
          })
          .signers([attacker])
          .rpc()

        numClaims += 1
      } catch (error) {
        if (
          error.message !== "Invalid seeds, address must fall off the curve"
        ) {
          console.log(error)
        }
      }
    }

    const ata = await getAccount(provider.connection, ataKey)

    console.log(
      `Attacker claimed ${numClaims} times and got ${Number(ata.amount)} tokens`
    )

    expect(numClaims).to.be.greaterThan(1)
    expect(Number(ata.amount)).to.be.greaterThan(10)
})
```

Exécutez `anchor test` pour voir que ce test réussit, montrant que l'attaquant a réussi. Comme le test appelle les instructions pour chaque bump valide, cela prend un peu de temps pour s'exécuter, alors soyez patient.

```bash
  bump-seed-canonicalization
Attacker claimed 129 times and got 1290 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (133840ms)
```

### 3. Créez des instructions sécurisées

Démontrons la correction de la vulnérabilité en créant deux nouvelles instructions :

1. `create_user_secure`
2. `claim_secure`

Avant d'écrire la logique de validation de compte ou d'instruction, créons d'abord un nouveau type d'utilisateur, `UserSecure`. Ce nouveau type ajoutera le bump canonique comme champ dans la structure.

```rust
#[account]
pub struct UserSecure {
    auth: Pubkey,
    bump: u8,
    rewards_claimed: bool,
}
```

Ensuite, créons des structures de validation de compte pour chacune des nouvelles instructions. Elles seront très similaires aux versions non sécurisées, mais laisseront à Anchor le soin de gérer la dérivation et la désérialisation des PDA.

```rust
#[derive(Accounts)]
pub struct CreateUserSecure<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [payer.key().as_ref()],
        // dérive la PDA en utilisant le bump canonique
        bump,
        payer = payer,
        space = 8 + 32 + 1 + 1
    )]
    user: Account<'info, UserSecure>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SecureClaim<'info> {
    #[account(
        seeds = [payer.key().as_ref()],
        bump = user.bump,
        constraint = !user.rewards_claimed @ ClaimError::AlreadyClaimed,
        constraint = user.auth == payer.key()
    )]
    user: Account<'info, UserSecure>,
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    mint: Account<'info, Mint>,
    /// VÉRIFICATION : autorisation PDA du mint
    #[account(seeds = ["mint".as_bytes().as_ref()], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}
```

Enfin, implémentons la logique d'instruction pour les deux nouvelles instructions. L'instruction `create_user_secure` doit simplement définir les champs `auth`, `bump` et `rewards_claimed` sur les données du compte `user`.

```rust
pub fn create_user_secure(ctx: Context<CreateUserSecure>) -> Result<()> {
    ctx.accounts.user.auth = ctx.accounts.payer.key();
    ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
    ctx.accounts.user.rewards_claimed = false;
    Ok(())
}
```

L'instruction `claim_secure` doit émettre 10 jetons à l'utilisateur et définir le champ `rewards_claimed` du compte `user` sur `true`.

```rust
pub fn claim_secure(ctx: Context<SecureClaim>) -> Result<()> {
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[&[
                    b"mint".as_ref(),
                &[*ctx.bumps.get("mint_authority").unwrap()],
            ]],
        ),
        10,
    )?;

    ctx.accounts.user.rewards_claimed = true;

    Ok(())
}
```

### 4. Testez les instructions sécurisées

Allons-y et écrivons un test pour montrer que l'attaquant ne peut plus réclamer plus d'une fois en utilisant les nouvelles instructions.

Remarquez que si vous commencez à parcourir en utilisant plusieurs PDA comme l'ancien test, vous ne pouvez même pas passer le bump non canonique aux instructions. Cependant, vous pouvez toujours montrer que l'attaquant ne peut pas réclamer plus d'une fois en appelant l'instruction avec le bump canonique.

```typescript
it.only("Attacker can only claim once with secure instructions", async () => {
    const attacker = Keypair.generate()
    await safeAirdrop(attacker.publicKey, provider.connection)
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey)
    const [userPDA] = findProgramAddressSync(
      [attacker.publicKey.toBuffer()],
      program.programId
    )

    await program.methods
      .createUserSecure()
      .accounts({
        payer: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    await program.methods
      .claimSecure()
      .accounts({
        payer: attacker.publicKey,
        userAta: ataKey,
        mint,
        user: userPDA,
      })
      .signers([attacker])
      .rpc()

    let numClaims = 1

    for (let i = 0; i < 256; i++) {
      try {
        const pda = createProgramAddressSync(
          [attacker.publicKey.toBuffer(), Buffer.from([i])],
          program.programId
        )
        await program.methods
          .createUserSecure()
          .accounts({
            user: pda,
            payer: attacker.publicKey,
          })
          .signers([attacker])
          .rpc()

        await program.methods
          .claimSecure()
          .accounts({
            payer: attacker.publicKey,
            userAta: ataKey,
            mint,
            user: pda,
          })
          .signers([attacker])
          .rpc()

        numClaims += 1
      } catch {}
    }

    const ata = await getAccount(provider.connection, ataKey)

    expect(Number(ata.amount)).to.equal(10)
    expect(numClaims).to.equal(1)
})
```

```bash
  bump-seed-canonicalization
Attacker claimed 119 times and got 1190 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (128493ms)
    ✔ Attacker can only claim once with secure instructions (1448ms)
```

Si vous utilisez Anchor pour toutes les dérivations PDA, cet exploit particulier est assez simple à éviter. Cependant, si vous finissez par faire quelque chose de "non standard", veillez à concevoir votre programme de manière à utiliser explicitement le bump canonique !

Si vous souhaitez consulter le code de solution final, vous pouvez le trouver sur la branche `solution` du [même dépôt](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/solution).

# Défi

Tout comme avec les autres leçons de cette unité, votre opportunité de pratiquer l'évitement de cette faille de sécurité réside dans l'audit de vos propres programmes ou d'autres programmes.

Prenez le temps de revoir au moins un programme et assurez-vous que toutes les dérivations et vérifications PDA utilisent le bump canonique.

N'oubliez pas, si vous trouvez un bug ou une faille dans le programme de quelqu'un d'autre, veuillez les alerter ! Si vous en trouvez un dans votre propre programme, assurez-vous de le corriger immédiatement.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=d3f6ca7a-11c8-421f-b7a3-d6c08ef1aa8b) !

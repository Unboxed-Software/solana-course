---
title: Bump Seed Canonicalization
objectives:
- Ipaliwanag ang mga kahinaan na nauugnay sa paggamit ng mga PDA na nagmula nang walang canonical bump
- Magsimula ng PDA gamit ang `seeds` at `bump` ng Anchor upang awtomatikong magamit ang canonical bump
- Gamitin ang `seeds` at `bump` ng Anchor upang matiyak na ang canonical bump ay palaging ginagamit sa mga tagubilin sa hinaharap kapag kumukuha ng PDA
---

# TL;DR

- Ang [**`create_program_address`**](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) function ay kumukuha ng PDA nang hindi hinahanap ang ** canonical bump**. Nangangahulugan ito na mayroong maraming wastong bumps, na lahat ay magbubunga ng iba't ibang mga address.
- Ang paggamit ng [**`find_program_address`**](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address) ay tinitiyak na ang pinakamataas na wastong bump, o canonical bump , ay ginagamit para sa derivation, kaya lumilikha ng isang deterministikong paraan upang mahanap ang isang address na ibinigay ng mga partikular na binhi.
- Sa pagsisimula, maaari mong gamitin ang `seeds` at `bump` ng Anchor upang matiyak na palaging ginagamit ng mga PDA derivation sa validation struct ng account ang canonical bump
- Binibigyang-daan ka ng Anchor na **tumukoy ng bump** na may hadlang na `bump = <some_bump>` kapag bini-verify ang address ng isang PDA
- Dahil maaaring magastos ang `find_program_address`, ang pinakamahusay na kasanayan ay ang pag-imbak ng nagmula na bump sa field ng data ng isang account na isa-reference sa ibang pagkakataon kapag muling kinukuha ang address para sa pag-verify
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

# Lesson

Ang bump seeds ay isang numero sa pagitan ng 0 at 255, kasama, na ginagamit upang matiyak na ang isang address ay nakuha gamit ang [`create_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html# method.create_program_address) ay isang wastong PDA. Ang **canonical bump** ay ang pinakamataas na bump value na gumagawa ng valid PDA. Ang pamantayan sa Solana ay ang *palaging gamitin ang canonical bump* kapag kumukuha ng mga PDA, kapwa para sa seguridad at kaginhawahan.

## Insecure PDA derivation using `create_program_address`

Dahil sa isang hanay ng mga buto, ang function na `create_program_address` ay gagawa ng wastong PDA halos 50% ng oras. Ang bump seed ay isang karagdagang byte na idinagdag bilang isang seed upang "i-bump" ang hinangong address sa valid na teritoryo. Dahil mayroong 256 na posibleng bump seed at ang function ay gumagawa ng mga valid na PDA sa humigit-kumulang 50% ng oras, mayroong maraming valid na bumps para sa isang naibigay na set ng input seeds.

Maaari mong isipin na maaari itong magdulot ng kalituhan para sa paghahanap ng mga account kapag gumagamit ng mga buto bilang isang paraan ng pagmamapa sa pagitan ng mga kilalang piraso ng impormasyon sa mga account. Ang paggamit ng canonical bump bilang pamantayan ay tinitiyak na palagi mong mahahanap ang tamang account. Higit sa lahat, iniiwasan nito ang mga pagsasamantala sa seguridad na dulot ng bukas na katangian ng pagpayag ng maraming bumps.

Sa halimbawa sa ibaba, ang tagubiling `set_value` ay gumagamit ng `bump` na ipinasa bilang data ng pagtuturo upang makakuha ng PDA. Pagkatapos ay kinukuha ng pagtuturo ang PDA gamit ang function na `create_program_address` at tinitingnan kung ang `address` ay tumutugma sa pampublikong key ng `data` account.

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

Habang kinukuha ng pagtuturo ang PDA at sinusuri ang naipasa-sa-account, na mabuti, pinapayagan nito ang tumatawag na pumasa sa isang arbitrary na bump. Depende sa konteksto ng iyong programa, maaari itong magresulta sa hindi kanais-nais na pag-uugali o potensyal na pagsasamantala.

Kung ang seed mapping ay nilalayong ipatupad ang isang one-to-one na relasyon sa pagitan ng PDA at user, halimbawa, hindi iyon ipapatupad ng program na ito nang maayos. Maaaring tawagan ng isang user ang program nang maraming beses na may maraming wastong bump, bawat isa ay gumagawa ng ibang PDA.

## Recommended derivation using `find_program_address`

Ang isang simpleng paraan sa problemang ito ay ang pag-asa lamang ng programa sa canonical bump at gamitin ang `find_program_address` upang makuha ang PDA.

Ang [`find_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address) *palaging ginagamit ang canonical bump*. Ang function na ito ay umuulit sa pamamagitan ng pagtawag sa `create_program_address`, na nagsisimula sa isang bump na 255 at binabawasan ang bump ng isa sa bawat pag-ulit. Sa sandaling natagpuan ang isang wastong address, ibabalik ng function ang parehong hinango na PDA at ang canonical bump na ginamit upang makuha ito.

Tinitiyak nito ang isa-sa-isang pagmamapa sa pagitan ng iyong mga input seed at ang address na ginagawa ng mga ito.

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

## Use Anchor’s `seeds` and `bump` constraints

Nagbibigay ang Anchor ng maginhawang paraan upang makakuha ng mga PDA sa struct ng pagpapatunay ng account gamit ang mga hadlang na `seeds` at `bump`. Ang mga ito ay maaaring isama pa sa `init` na hadlang upang masimulan ang account sa nilalayong address. Upang maprotektahan ang programa mula sa kahinaan na tinatalakay namin sa buong araling ito, hindi ka pinapayagan ng Anchor na magpasimula ng isang account sa isang PDA gamit ang anumang bagay maliban sa canonical bump. Sa halip, gumagamit ito ng `find_program_address` para makuha ang PDA at pagkatapos ay isagawa ang initialization.

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

// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // derives the PDA using the canonical bump
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

Kung hindi ka nagpapasimula ng account, maaari mo pa ring patunayan ang mga PDA gamit ang mga hadlang na `seeds` at `bump`. Ibinabalik lang nito ang PDA at inihahambing ang nakuhang address sa address ng account na ipinasa.

Sa sitwasyong ito, binibigyang-daan ka ng Anchor *ay* na tukuyin ang bump na gagamitin para makuha ang PDA na may `bump = <some_bump>`. Ang layunin dito ay hindi para sa iyo na gumamit ng mga di-makatwirang bumps, ngunit sa halip ay hayaan kang i-optimize ang iyong program. Ang umuulit na katangian ng `find_program_address` ay ginagawang mahal, kaya ang pinakamahusay na kasanayan ay ang pag-imbak ng canonical bump sa data ng PDA account sa pagsisimula ng isang PDA, na nagbibigay-daan sa iyong i-reference ang bump na nakaimbak kapag pinapatunayan ang PDA sa mga kasunod na tagubilin.

Kapag tinukoy mo ang bump na gagamitin, ang Anchor ay gumagamit ng `create_program_address` kasama ang ibinigay na bump sa halip na `find_program_address`. Tinitiyak ng pattern na ito ng pag-iimbak ng bump sa data ng account na palaging ginagamit ng iyong program ang canonical bump nang hindi nakakasira ng performance.

```rust
use anchor_lang::prelude::*;

declare_id!("CVwV9RoebTbmzsGg1uqU1s4a3LvTKseewZKmaNLSxTqc");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        // store the bump on the account
        ctx.accounts.data.bump = *ctx.bumps.get("data").unwrap();
        Ok(())
    }

    pub fn verify_address(ctx: Context<VerifyAddress>, _key: u64) -> Result<()> {
        msg!("PDA confirmed to be derived with canonical bump: {}", ctx.accounts.data.key());
        Ok(())
    }
}

// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // derives the PDA using the canonical bump
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
    // guranteed to be the canonical bump every time
    bump = data.bump
  )]
  data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
    // bump field
    bump: u8
}
```

Kung hindi mo tutukuyin ang bump sa `bump` constraint, gagamitin pa rin ni Anchor ang `find_program_address` para makuha ang PDA gamit ang canonical bump. Bilang resulta, ang iyong pagtuturo ay magkakaroon ng variable na halaga ng compute budget. Dapat itong gamitin nang may pag-iingat ng mga program na nasa panganib na lumampas sa kanilang compute budget dahil may pagkakataon na ang badyet ng programa ay maaaring paminsan-minsan at hindi mahuhulaan na lumampas.

Sa kabilang banda, kung kailangan mo lang i-verify ang address ng isang PDA na ipinasa nang hindi sinisimulan ang isang account, mapipilitan kang hayaan ang Anchor na makuha ang canonical bump o ilantad ang iyong programa sa mga hindi kinakailangang panganib. Kung ganoon, mangyaring gamitin ang canonical bump sa kabila ng bahagyang marka laban sa pagganap.

# Demo

Upang ipakita ang mga posibleng pagsasamantala sa seguridad kapag hindi mo tiningnan ang canonical bump, magtrabaho tayo sa isang program na nagbibigay-daan sa bawat user ng program na "mag-claim" ng mga reward sa oras.

### 1. Setup

Magsimula sa pamamagitan ng pagkuha ng code sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/starter).

Pansinin na mayroong dalawang tagubilin sa programa at isang pagsubok sa direktoryo ng `mga pagsubok`.

Ang mga tagubilin sa programa ay:

1. `create_user_insecure`
2. `claim_insecure`

Ang tagubiling `create_user_insecure` ay gumagawa lang ng bagong account sa isang PDA na hinango gamit ang public key ng lumagda at isang naipasa na bump.

Ang tagubiling `claim_insecure` ay nagbibigay ng 10 token sa user at pagkatapos ay minarkahan ang mga reward ng account bilang na-claim upang hindi na sila makapag-claim muli.

Gayunpaman, hindi tahasang tinitingnan ng program na ginagamit ng mga PDA na pinag-uusapan ang canonical bump.

Tingnan ang programa upang maunawaan kung ano ang ginagawa nito bago magpatuloy.

### 2. Test insecure instructions

Dahil hindi tahasang hinihiling ng mga tagubilin ang PDA ng `user` na gamitin ang canonical bump, maaaring gumawa ang isang attacker ng maraming account sa bawat wallet at mag-claim ng higit pang reward kaysa sa dapat payagan.

Ang pagsubok sa direktoryo ng `mga pagsubok` ay lumilikha ng bagong keypair na tinatawag na `attacker` upang kumatawan sa isang umaatake. Pagkatapos ay i-loop nito ang lahat ng posibleng bumps at tumatawag ng `create_user_insecure` at `claim_insecure`. Sa pagtatapos, inaasahan ng pagsubok na ang umaatake ay nakapag-claim ng mga reward nang maraming beses at nakakuha ng higit sa 10 token na inilaan sa bawat user.

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

Patakbuhin ang `anchor test` upang makita na ang pagsubok na ito ay pumasa, na nagpapakita na ang umaatake ay matagumpay. Dahil ang pagsubok ay tumatawag sa mga tagubilin para sa bawat wastong bump, ito ay tumatagal ng kaunti upang tumakbo, kaya maging matiyaga.

```bash
  bump-seed-canonicalization
Attacker claimed 129 times and got 1290 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (133840ms)
```

### 3. Create secure instructions

Ipakita natin ang pag-patch ng kahinaan sa pamamagitan ng paggawa ng dalawang bagong tagubilin:

1. `create_user_secure`
2. `claim_secure`

Bago natin isulat ang pagpapatunay ng account o lohika ng pagtuturo, gumawa tayo ng bagong uri ng user, `UserSecure`. Idaragdag ng bagong uri na ito ang canonical bump bilang field sa struct.

```rust
#[account]
pub struct UserSecure {
    auth: Pubkey,
    bump: u8,
    rewards_claimed: bool,
}
```

Susunod, gumawa tayo ng mga istruktura ng pagpapatunay ng account para sa bawat isa sa mga bagong tagubilin. Magiging katulad ang mga ito sa mga hindi secure na bersyon ngunit hahayaan ang Anchor na pangasiwaan ang derivation at deserialization ng mga PDA.

```rust
#[derive(Accounts)]
pub struct CreateUserSecure<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [payer.key().as_ref()],
        // derives the PDA using the canonical bump
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
    /// CHECK: mint auth PDA
    #[account(seeds = ["mint".as_bytes().as_ref()], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}
```

Panghuli, ipatupad natin ang lohika ng pagtuturo para sa dalawang bagong tagubilin. Kailangan lang itakda ng tagubiling `create_user_secure` ang `auth`, `bump` at `rewards_claimed` sa data ng account ng `user`.

```rust
pub fn create_user_secure(ctx: Context<CreateUserSecure>) -> Result<()> {
    ctx.accounts.user.auth = ctx.accounts.payer.key();
    ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
    ctx.accounts.user.rewards_claimed = false;
    Ok(())
}
```

The `claim_secure` instruction needs to mint 10 tokens to the user and set the `user` account's `rewards_claimed` field to `true`.

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

### 4. Test secure instructions

Sige at magsulat tayo ng pagsubok upang ipakita na hindi na maaaring mag-claim ng higit sa isang beses ang umaatake gamit ang mga bagong tagubilin.

Pansinin na kung magsisimula kang mag-loop sa pamamagitan ng paggamit ng maraming PDA tulad ng lumang pagsubok, hindi mo rin maipapasa ang hindi kanonikal na bump sa mga tagubilin. Gayunpaman, maaari ka pa ring mag-loop sa pamamagitan ng paggamit ng iba't ibang PDA at sa dulo suriin na 1 claim lang ang nangyari para sa kabuuang 10 token. Ang iyong huling pagsusulit ay magiging ganito:

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

Kung gagamit ka ng Anchor para sa lahat ng mga derivasyon ng PDA, ang partikular na pagsasamantalang ito ay medyo simpleng iwasan. Gayunpaman, kung gagawa ka ng anumang bagay na "hindi pamantayan," mag-ingat sa disenyo ng iyong programa upang tahasang gamitin ang canonical bump!

Kung gusto mong tingnan ang code ng panghuling solusyon, mahahanap mo ito sa sangay ng `solusyon` ng [parehong repositoryo](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/solution).

# Challenge

Tulad ng iba pang mga aralin sa modyul na ito, ang iyong pagkakataon na magsanay sa pag-iwas sa pagsasamantala sa seguridad na ito ay nakasalalay sa pag-audit ng iyong sarili o iba pang mga programa.

Maglaan ng ilang oras upang suriin ang hindi bababa sa isang programa at tiyaking ginagamit ng lahat ng PDA derivations at tseke ang canonical bump.

Tandaan, kung makakita ka ng bug o pagsasamantala sa programa ng ibang tao, mangyaring alertuhan sila! Kung makakita ka ng isa sa iyong sariling programa, siguraduhing i-patch ito kaagad.
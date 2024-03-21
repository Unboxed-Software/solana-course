---
title: Signer Authorization
objectives:
- Ipaliwanag ang mga panganib sa seguridad na nauugnay sa hindi pagsasagawa ng mga naaangkop na pagsusuri sa pagpirma
- Ipatupad ang mga tseke ng signer gamit ang long-form na Rust
- Magpatupad ng mga tseke ng lumagda gamit ang uri ng `Signer` ng Anchor
- Ipatupad ang mga pagsuri ng lumagda gamit ang hadlang na `#[account(signer)]` ng Anchor
---

# TL;DR

- Gamitin ang **Signer Checks** upang i-verify na ang mga partikular na account ay lumagda sa isang transaksyon. Kung walang naaangkop na pag-check ng lumagda, maaaring maisagawa ng mga account ang mga tagubiling hindi sila dapat pahintulutang gawin.
- Para magpatupad ng signer check sa Rust, tingnan lang kung ang property ng `is_signer` ng account ay `true`
    
    ```rust
    if !ctx.accounts.authority.is_signer {
    	return Err(ProgramError::MissingRequiredSignature.into());
    }
    ```
    
- Sa Anchor, maaari mong gamitin ang **`Signer`** na uri ng account sa struct ng pagpapatunay ng iyong account upang awtomatikong magsagawa ang Anchor ng signer check sa isang partikular na account
- Ang Anchor ay mayroon ding hadlang sa account na awtomatikong magbe-verify na ang isang partikular na account ay pumirma ng isang transaksyon

# Lesson

Ginagamit ang mga tseke ng signer para i-verify na pinahintulutan ng may-ari ng isang account ang isang transaksyon. Kung walang tseke ng signer, ang mga pagpapatakbo na ang pagpapatupad ay dapat na limitado sa mga partikular na account lamang ang posibleng gawin ng anumang account. Sa pinakamasamang sitwasyon, maaari itong magresulta sa mga wallet na ganap na maubos ng mga umaatake na pumasa sa anumang account na gusto nila sa isang pagtuturo.

### Missing Signer Check

Ang halimbawa sa ibaba ay nagpapakita ng sobrang pinasimple na bersyon ng isang pagtuturo na nag-a-update sa field ng `awtoridad` na nakaimbak sa isang account ng programa.

Pansinin na ang field ng `authority` sa struct ng validation ng account na `UpdateAuthority` ay may uri ng `AccountInfo`. Sa Anchor, ang uri ng account na `AccountInfo` ay nagpapahiwatig na walang mga pagsusuri na ginawa sa account bago ang pagpapatupad ng pagtuturo.

Bagama't ang hadlang na `may_isa` ay ginagamit upang patunayan ang `awtoridad` na account na ipinasa sa pagtuturo ay tumutugma sa field ng `awtoridad` na nakaimbak sa `vault` account, walang tseke upang i-verify ang `authority` account na pinahintulutan ang transaksyon.

Nangangahulugan ito na maipapasa lang ng isang attacker ang pampublikong key ng `authority` account at ang kanilang sariling public key bilang ang `new_authority` account upang muling italaga ang kanilang sarili bilang bagong awtoridad ng `vault` account. Sa puntong iyon, maaari silang makipag-ugnayan sa programa bilang bagong awtoridad.

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

### Add signer authorization checks

Ang kailangan mo lang gawin para ma-validate na ang `authority` account na nilagdaan ay magdagdag ng signer check sa loob ng instruction. Nangangahulugan lamang iyon ng pagsuri kung ang `authority.is_signer` ay `true`, at nagbabalik ng error na `MissingRequiredSignature` kung `false`.

```tsx
if !ctx.accounts.authority.is_signer {
    return Err(ProgramError::MissingRequiredSignature.into());
}
```

Sa pamamagitan ng pagdaragdag ng tseke ng lumagda, mapoproseso lamang ang tagubilin kung ang account ay pumasa bilang ang `autoridad` na account ay nilagdaan din ang transaksyon. Kung ang transaksyon ay hindi nilagdaan ng account na ipinasa bilang `authority` account, kung gayon ang transaksyon ay mabibigo.

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

### Use Anchor’s `Signer` account type

Gayunpaman, ang paglalagay ng tseke na ito sa function ng pagtuturo ay nagpapagulo sa paghihiwalay sa pagitan ng pagpapatunay ng account at lohika ng pagtuturo.

Sa kabutihang palad, ginagawang madali ng Anchor ang pagsasagawa ng mga pagsusuri ng signer sa pamamagitan ng pagbibigay ng uri ng account na `Signer`. Baguhin lang ang uri ng `authority` account sa struct ng pagpapatunay ng account upang maging uri ng `Signer`, at titingnan ng Anchor sa runtime na ang tinukoy na account ay isang lumagda sa transaksyon. Ito ang diskarte na karaniwang inirerekomenda namin dahil pinapayagan ka nitong paghiwalayin ang checker check mula sa lohika ng pagtuturo.

Sa halimbawa sa ibaba, kung hindi nilagdaan ng `authority` account ang transaksyon, mabibigo ang transaksyon bago pa man maabot ang lohika ng pagtuturo.

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

Tandaan na kapag ginamit mo ang uri ng `Signer`, walang iba pang pagmamay-ari o pagsusuri ng uri ang isinasagawa.

### Use Anchor’s `#[account(signer)]` constraint

Bagama't sa karamihan ng mga kaso, ang uri ng account na `Signer` ay sapat na upang matiyak na ang isang account ay pumirma sa isang transaksyon, ang katotohanang walang ibang pagmamay-ari o uri ng pagsusuri na isinasagawa ay nangangahulugan na ang account na ito ay hindi talaga magagamit para sa anumang bagay sa pagtuturo.

Dito magagamit ang `signer` *constraint*. Ang hadlang na `#[account(signer)]` ay nagbibigay-daan sa iyong i-verify ang account na nilagdaan ang transaksyon, habang nakakakuha din ng mga benepisyo ng paggamit sa uri ng `Account` kung gusto mo rin ng access sa pinagbabatayan na data nito.

Bilang isang halimbawa kung kailan ito magiging kapaki-pakinabang, isipin ang pagsulat ng isang tagubilin na inaasahan mong ma-invoke sa pamamagitan ng CPI na inaasahan na ang isa sa mga naipasa sa mga account ay parehong ******signer****** sa transaciton at isang ***********data source**************. Ang paggamit ng uri ng account na `Signer` dito ay nag-aalis ng awtomatikong deserialization at pagsusuri ng uri na makukuha mo gamit ang uri ng `Account`. Ito ay parehong nakakaabala, dahil kailangan mong manual na i-deserialize ang data ng account sa lohika ng pagtuturo, at maaaring maging vulnerable ang iyong program sa pamamagitan ng hindi pagkuha ng pagmamay-ari at pagsusuri ng uri na isinagawa ayon sa uri ng `Account`.

Sa halimbawa sa ibaba, maaari mong ligtas na magsulat ng lohika upang makipag-ugnayan sa data na nakaimbak sa `authority` account habang bini-verify din na nilagdaan nito ang transaksyon.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();

        // access the data stored in authority
        msg!("Total number of depositors: {}", ctx.accounts.authority.num_depositors);
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

# Demo

Magsanay tayo sa pamamagitan ng paglikha ng isang simpleng programa upang ipakita kung paano maaaring payagan ng isang nawawalang signer check ang isang umaatake na mag-withdraw ng mga token na hindi sa kanila.

Ang program na ito ay nagpapasimula ng isang pinasimpleng token na "vault" na account at nagpapakita kung paano ang isang nawawalang signer check ay maaaring magbigay-daan sa vault na ma-drain.

### 1. Starter

Upang makapagsimula, i-download ang starter code mula sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/solana-signer-auth/tree/starter). Kasama sa starter code ang isang program na may dalawang tagubilin at ang setup ng boilerplate para sa test file.

Ang tagubiling `initialize_vault` ay nagpapasimula ng dalawang bagong account: `Vault` at `TokenAccount`. Ang `Vault` account ay pasisimulan gamit ang Program Derived Address (PDA) at iimbak ang address ng isang token account at ang awtoridad ng vault. Ang awtoridad ng token account ay ang `vault` na PDA na nagbibigay-daan sa programa na mag-sign para sa paglipat ng mga token.

Ang tagubiling `insecure_withdraw` ay maglilipat ng mga token sa token account ng `vault` account sa isang token account ng `withdraw_destination`. Gayunpaman, ang `authority` account sa `InsecureWithdraw` struct ay may uri ng `UncheckedAccount`. Ito ay isang wrapper sa paligid ng `AccountInfo` upang tahasang isaad na ang account ay hindi naka-check.

Kung walang signer check, kahit sino ay maaaring magbigay ng pampublikong key ng `authority` account na tumutugma sa `authority` na naka-store sa `vault` account at ang `insecure_withdraw` na tagubilin ay patuloy na ipoproseso.

Bagama't ito ay medyo gawa-gawa na ang anumang DeFi program na may vault ay magiging mas sopistikado kaysa dito, ipapakita nito kung paano ang kakulangan ng signer check ay maaaring magresulta sa pag-withdraw ng mga token ng maling partido.

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

### 2. Test `insecure_withdraw` instruction

Kasama sa test file ang code para ma-invoke ang `initialize_vault` na pagtuturo gamit ang `wallet` bilang `authority` sa vault. Ang code ay nagbibigay ng 100 token sa `vault` token account. Ayon sa teorya, ang susi ng `wallet` ay dapat na ang tanging maaaring mag-withdraw ng 100 token mula sa vault.

Ngayon, magdagdag tayo ng pagsubok para ma-invoke ang `insecure_withdraw` sa program para ipakita na ang kasalukuyang bersyon ng program ay nagbibigay-daan sa isang third party na talagang bawiin ang 100 token na iyon.

Sa pagsubok, gagamitin pa rin namin ang pampublikong key ng `wallet` bilang `authority` account, ngunit gagamit kami ng ibang keypair para lagdaan at ipadala ang transaksyon.

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

Patakbuhin ang `anchor test` upang makita na ang parehong mga transaksyon ay matagumpay na makukumpleto.

```bash
signer-authorization
  ✔ Initialize Vault (810ms)
  ✔ Insecure withdraw  (405ms)
```

Dahil walang signer check para sa `authority` account, ang `insecure_withdraw` na tagubilin ay maglilipat ng mga token mula sa `vault` token account sa `withdrawDestinationFake` token account hangga't ang pampublikong key ng`authority` account ay tumutugma sa publiko key na nakaimbak sa authority field ng `vault` account. Maliwanag, ang pagtuturo ng `insecure_withdraw` ay kasing insecure gaya ng iminumungkahi ng pangalan.

### 3. Add `secure_withdraw` instruction

Ayusin natin ang problema sa isang bagong tagubilin na tinatawag na `secure_withdraw`. Magiging kapareho ang tagubiling ito sa tagubiling `insecure_withdraw`, maliban kung gagamitin namin ang uri ng `Signer` sa struct ng Accounts upang patunayan ang `authority` account sa `SecureWithdraw` struct. Kung ang `authority` account ay hindi isang lumagda sa transaksyon, inaasahan naming mabibigo ang transaksyon at magbabalik ng error.

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

### 4. Test `secure_withdraw` instruction

Kapag nakalagay na ang pagtuturo, bumalik sa test file para subukan ang `secure_withdraw` na pagtuturo. Gawin ang tagubiling `secure_withdraw`, gamit muli ang pampublikong key ng `wallet` bilang `authority` account at ang keypair ng `withdrawDestinationFake` bilang ang pumirma at destinasyon ng withdraw. Dahil na-validate ang `authority` account gamit ang uri ng `Signer`, inaasahan naming mabibigo ang transaksyon sa checker check at magbabalik ng error.

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

Patakbuhin ang `anchor test` upang makita na ang transaksyon ay magbabalik na ngayon ng signature verification error.

```bash
Error: Signature verification failed
```

Ayan yun! Ito ay isang medyo simpleng bagay na dapat iwasan, ngunit hindi kapani-paniwalang mahalaga. Siguraduhing palaging pag-isipan kung sino ang dapat na magpapahintulot sa mga tagubilin at tiyaking ang bawat isa ay lumagda sa transaksyon.

Kung gusto mong tingnan ang panghuling code ng solusyon, mahahanap mo ito sa `solution` branch ng [repository](https://github.com/Unboxed-Software/solana-signer-auth/tree/solution) .

# Challenge

At this point in the course, we hope you've started to work on programs and projects outside the Demos and Challenges provided in these lessons. For this and the remainder of the lessons on security vulnerabilities, the Challenge for each lesson will be to audit your own code for the security vulnerability discussed in the lesson. 

Alternatively, you can find open source programs to audit. There are plenty of programs you can look at. A good start if you don't mind diving into native Rust would be the [SPL programs](https://github.com/solana-labs/solana-program-library).

So for this lesson, take a look at a program (whether yours or one you've found online) and audit it for signer checks. If you find a bug in somebody else's program, please alert them! If you find a bug in your own program, be sure to patch it right away.
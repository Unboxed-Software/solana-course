---
title: Account Data Matching
objectives:
- Ipaliwanag ang mga panganib sa seguridad na nauugnay sa mga nawawalang pagsusuri sa pagpapatunay ng data
- Ipatupad ang mga pagsusuri sa pagpapatunay ng data gamit ang long-form na Rust
- Ipatupad ang mga pagsusuri sa pagpapatunay ng data gamit ang mga hadlang sa Anchor
---

# TL;DR

- Gumamit ng **mga pagsusuri sa pagpapatunay ng data** upang i-verify na tumutugma ang data ng account sa inaasahang halaga**.** Kung walang mga naaangkop na pagsusuri sa pagpapatunay ng data, maaaring gamitin ang mga hindi inaasahang account sa isang pagtuturo.
- Upang ipatupad ang mga pagsusuri sa pagpapatunay ng data sa Rust, ihambing lang ang data na nakaimbak sa isang account sa inaasahang halaga.
    
    ```rust
    if ctx.accounts.user.key() != ctx.accounts.user_data.user {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```
    
- Sa Anchor, maaari mong gamitin ang `constraint` upang suriin kung ang ibinigay na expression ay nagsusuri sa true. Bilang kahalili, maaari mong gamitin ang `may_isa` upang tingnan kung ang isang target na field ng account na nakaimbak sa account ay tumutugma sa susi ng isang account sa `Mga Account` na struct.

# Lesson

Ang pagtutugma ng data ng account ay tumutukoy sa mga pagsusuri sa pagpapatunay ng data na ginagamit upang i-verify na ang data na nakaimbak sa isang account ay tumutugma sa inaasahang halaga. Ang mga pagsusuri sa pagpapatunay ng data ay nagbibigay ng paraan upang magsama ng mga karagdagang paghihigpit upang matiyak na ang mga naaangkop na account ay naipapasa sa isang tagubilin.

Maaari itong maging kapaki-pakinabang kapag ang mga account na kinakailangan ng isang pagtuturo ay may mga dependency sa mga halagang nakaimbak sa iba pang mga account o kung ang isang pagtuturo ay nakadepende sa data na nakaimbak sa isang account.

### Missing data validation check

Ang halimbawa sa ibaba ay may kasamang tagubiling `update_admin` na nag-a-update sa field ng `admin` na nakaimbak sa isang `admin_config` na account.

Ang pagtuturo ay walang data validation check upang i-verify ang `admin` account na pumipirma sa transaksyon ay tumutugma sa `admin` na nakaimbak sa `admin_config` account. Nangangahulugan ito ng anumang account na pumipirma sa transaksyon at ipinasa sa pagtuturo dahil maaaring i-update ng `admin` account ang `admin_config` account.

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

### Add data validation check

Ang pangunahing diskarte sa Rust upang malutas ang problemang ito ay ihambing lamang ang ipinasa sa `admin` na key sa `admin` na key na nakaimbak sa `admin_config` na account, na naglalagay ng error kung hindi sila magkatugma.

```rust
if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

Sa pamamagitan ng pagdaragdag ng pagsusuri sa pagpapatunay ng data, ang pagtuturo ng `update_admin` ay mapoproseso lamang kung ang `admin` signer ng transaksyon ay tumugma sa `admin` na nakaimbak sa `admin_config` account.

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

### Use Anchor constraints
Pinapasimple ito ng Anchor gamit ang hadlang na `may_isa`. Maaari mong gamitin ang hadlang na `has_one` upang ilipat ang pagsusuri ng validation ng data mula sa logic ng pagtuturo patungo sa struct ng `UpdateAdmin`.

Sa halimbawa sa ibaba, ang `has_one = admin` ay tumutukoy na ang `admin` account na pumipirma sa transaksyon ay dapat na tumugma sa `admin` na field na nakaimbak sa `admin_config` account. Upang magamit ang hadlang na `may_isa`, ang convention ng pagbibigay ng pangalan ng field ng data sa account ay dapat na pare-pareho sa pagbibigay ng pangalan sa struct ng pagpapatunay ng account.

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

Bilang kahalili, maaari mong gamitin ang `constraint` upang manu-manong magdagdag ng isang expression na dapat suriin sa true upang magpatuloy ang pagpapatupad. Ito ay kapaki-pakinabang kapag sa ilang kadahilanan ay hindi maaaring maging pare-pareho ang pagbibigay ng pangalan o kapag kailangan mo ng mas kumplikadong expression upang ganap na mapatunayan ang papasok na data.

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

# Demo

Para sa demo na ito, gagawa kami ng simpleng "vault" na programa na katulad ng program na ginamit namin sa aralin sa Signer Authorization at sa Owner Check lesson. Katulad ng mga demo na iyon, ipapakita namin sa demo na ito kung paano maaaring magbigay-daan ang isang nawawalang data validation check na ma-drain ang vault.

### 1. Starter

Para makapagsimula, i-download ang starter code mula sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/solana-account-data-matching). Kasama sa starter code ang isang program na may dalawang tagubilin at ang setup ng boilerplate para sa test file.

Ang tagubiling `initialize_vault` ay nagpapasimula ng bagong `Vault` account at isang bagong `TokenAccount`. Ang `Vault` account ay mag-iimbak ng address ng isang token account, ang awtoridad ng vault, at isang withdraw destination token account.

Ang awtoridad ng bagong token account ay itatakda bilang `vault`, isang PDA ng programa. Nagbibigay-daan ito sa `vault` account na mag-sign para sa paglilipat ng mga token mula sa token account.

Inilipat ng tagubiling `insecure_withdraw` ang lahat ng token sa token account ng `vault` account sa isang token account na `withdraw_destination`.

Pansinin na ang tagubiling ito ****ay**** ay may signer check para sa `authority` at may owner check para sa `vault`. Gayunpaman, wala kahit saan sa pagpapatunay ng account o lohika ng pagtuturo na mayroong code na nagsusuri kung ang `authority` account na ipinasa sa pagtuturo ay tumutugma sa `authority` account sa `vault`.

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

### 2. Test `insecure_withdraw` instruction

Upang patunayan na ito ay isang problema, sumulat tayo ng isang pagsubok kung saan ang isang account maliban sa `awtoridad` ng vault ay sumusubok na mag-withdraw mula sa vault.

Kasama sa test file ang code para i-invoke ang `initialize_vault` na pagtuturo gamit ang provider wallet bilang `authority` at pagkatapos ay mag-mint ng 100 token sa `vault` token account.

Magdagdag ng pagsubok para ma-invoke ang `insecure_withdraw` na pagtuturo. Gamitin ang `withdrawDestinationFake` bilang `withdrawDestination` account at `walletFake` bilang `authority`. Pagkatapos ay ipadala ang transaksyon gamit ang `walletFake`.

Dahil walang mga pagsusuri, ang pag-verify ng `authority` account na ipinasa sa pagtuturo ay tumutugma sa mga value na nakaimbak sa `vault` account na sinimulan sa unang pagsubok, matagumpay na mapoproseso ang pagtuturo at ang mga token ay ililipat sa `withdrawDestinationFake` account.

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

Patakbuhin ang `anchor test` upang makita na ang parehong mga transaksyon ay matagumpay na makukumpleto.

```bash
account-data-matching
  ✔ Initialize Vault (811ms)
  ✔ Insecure withdraw (403ms)
```

### 3. Add `secure_withdraw` instruction

Magpatupad tayo ng secure na bersyon ng tagubiling ito na tinatawag na `secure_withdraw`.

Magiging kapareho ang tagubiling ito sa tagubiling `insecure_withdraw`, maliban kung gagamitin namin ang `has_one` constraint sa struct ng pagpapatunay ng account (`SecureWithdraw`) upang tingnan kung ang `authority` account na naipasa sa pagtuturo ay tumutugma sa `authority` account sa `vault` account. Sa ganoong paraan lamang ang tamang account ng awtoridad ang makakapag-withdraw ng mga token ng vault.

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

### 4. Test `secure_withdraw` instruction

Ngayon, subukan natin ang tagubiling `secure_withdraw` gamit ang dalawang pagsubok: isa na gumagamit ng `walletFake` bilang awtoridad at isa na gumagamit ng `wallet` bilang awtoridad. Inaasahan namin na ang unang invocation ay magbabalik ng error at ang pangalawa ay magtatagumpay.

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

Magpatakbo ng `anchor test` upang makita na ang transaksyon gamit ang isang maling account ng awtoridad ay magbabalik na ngayon ng Anchor Error habang matagumpay na nakumpleto ang transaksyon gamit ang mga tamang account.

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

Tandaan na tinukoy ng Anchor sa mga log ang account na nagdudulot ng error (`AnchorError na sanhi ng account: vault`).

```bash
✔ Secure withdraw, expect error (77ms)
✔ Secure withdraw (10073ms)
```

At tulad niyan, isinara mo na ang butas ng seguridad. Ang tema sa karamihan ng mga potensyal na pagsasamantalang ito ay medyo simple ang mga ito. Gayunpaman, habang lumalaki ang iyong mga programa sa saklaw at pagiging kumplikado, nagiging mas madaling makaligtaan ang mga posibleng pagsasamantala. Napakahusay na ugaliing sumulat ng mga pagsusulit na nagpapadala ng mga tagubilin na *hindi dapat* gumana. Mas marami mas mabuti. Sa ganoong paraan makakahuli ka ng mga problema bago ka mag-deploy.

Kung gusto mong tingnan ang code ng panghuling solusyon, mahahanap mo ito sa sangay ng `solusyon` ng [repository](https://github.com/Unboxed-Software/solana-account-data-matching/tree/solution).

# Challenge

Tulad ng iba pang mga aralin sa modyul na ito, ang iyong pagkakataon na magsanay sa pag-iwas sa pagsasamantala sa seguridad na ito ay nakasalalay sa pag-audit ng iyong sarili o iba pang mga programa.

Maglaan ng ilang oras upang suriin ang hindi bababa sa isang programa at tiyaking may wastong pagsusuri sa data upang maiwasan ang mga pagsasamantala sa seguridad.

Tandaan, kung makakita ka ng bug o pagsasamantala sa programa ng ibang tao, mangyaring alertuhan sila! Kung makakita ka ng isa sa iyong sariling programa, siguraduhing i-patch ito kaagad.
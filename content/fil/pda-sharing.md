---
title: PDA Sharing
objectives:
- Ipaliwanag ang mga panganib sa seguridad na nauugnay sa pagbabahagi ng PDA
- Kumuha ng mga PDA na may mga discrete authority domain
- Gamitin ang mga hadlang sa `seeds` at `bump` ng Anchor upang patunayan ang mga PDA account
---

# TL;DR

- Ang paggamit ng parehong PDA para sa maraming awtoridad na domain ay nagbubukas sa iyong programa hanggang sa posibilidad ng mga user na ma-access ang data at mga pondo na hindi sa kanila
- Pigilan ang parehong PDA na gamitin para sa maramihang mga account sa pamamagitan ng paggamit ng mga buto na user at/o domain-specific
- Gamitin ang mga hadlang sa `seeds` at `bump` ng Anchor upang patunayan na ang isang PDA ay nakuha gamit ang inaasahang mga buto at bump

# Lesson

Ang pagbabahagi ng PDA ay tumutukoy sa paggamit ng parehong PDA bilang isang lumagda sa maraming user o domain. Lalo na kapag gumagamit ng mga PDA para sa pagpirma, maaaring mukhang angkop na gumamit ng isang pandaigdigang PDA upang kumatawan sa programa. Gayunpaman, nagbubukas ito ng posibilidad na pumasa ang pagpapatunay ng account ngunit naa-access ng isang user ang mga pondo, paglilipat, o data na hindi sa kanila.

## Insecure global PDA

Sa halimbawa sa ibaba, ang `authority` ng `vault` account ay isang PDA na hinango gamit ang `mint` address na nakaimbak sa `pool` account. Ang PDA na ito ay ipinapasa sa tagubilin bilang `authority` account para mag-sign para sa mga token ng paglilipat mula sa `vault` patungo sa `withdraw_destination`.

Ang paggamit ng `mint` address bilang isang seed para makuha ang PDA para mag-sign para sa `vault` ay hindi secure dahil maraming `pool` account ang maaaring gawin para sa parehong `vault` token account, ngunit ibang `withdraw_destination`. Sa pamamagitan ng paggamit ng `mint` bilang isang seed na nakukuha ang PDA para mag-sign para sa mga paglilipat ng token, anumang `pool` account ay maaaring mag-sign para sa paglipat ng mga token mula sa isang `vault` token account patungo sa isang arbitrary na `withdraw_destination`.

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

## Secure account specific PDA

Ang isang diskarte upang lumikha ng isang account na partikular na PDA ay ang paggamit ng `withdraw_destination` bilang isang binhi upang makuha ang PDA na ginamit bilang awtoridad ng `vault` token account. Tinitiyak nito na ang pag-sign ng PDA para sa CPI sa pagtuturo ng `withdraw_tokens` ay nakukuha gamit ang nilalayong token account na `withdraw_destination`. Sa madaling salita, ang mga token mula sa isang `vault` token account ay maaari lamang i-withdraw sa `withdraw_destination` na orihinal na sinimulan sa `pool` account.

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

## Anchor’s `seeds` and `bump` constraints

Maaaring gamitin ang mga PDA bilang parehong address ng isang account at payagan ang mga program na mag-sign para sa mga PDA na pagmamay-ari nila.

Ang halimbawa sa ibaba ay gumagamit ng PDA na hinango gamit ang `withdraw_destination` bilang parehong address ng `pool` account at may-ari ng `vault` token account. Nangangahulugan ito na ang account lang ng `pool` na nauugnay sa tamang `vault` at `withdraw_destination` ang maaaring gamitin sa pagtuturo ng `withdraw_tokens`.

Magagamit mo ang `seeds` at `bump` ng Anchor na may attribute na `#[account(...)]` para i-validate ang `pool` account PDA. Nakukuha ng Anchor ang isang PDA gamit ang `seeds` at `bump` na tinukoy at inihambing sa account na ipinasa sa pagtuturo bilang `pool` account. Ang `may_isa` na hadlang ay ginagamit upang higit pang matiyak na ang mga tamang account lang na nakaimbak sa `pool` na account ang naipapasa sa pagtuturo.

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

# Demo

Magsanay tayo sa pamamagitan ng paglikha ng isang simpleng programa upang ipakita kung paano maaaring payagan ng pagbabahagi ng PDA ang isang umaatake na mag-withdraw ng mga token na hindi sa kanila. Ang demo na ito ay lumalawak sa mga halimbawa sa itaas sa pamamagitan ng pagsasama ng mga tagubilin upang simulan ang mga kinakailangang account ng programa.

### 1. Starter

Para makapagsimula, i-download ang starter code sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/solana-pda-sharing/tree/starter). Kasama sa starter code ang isang program na may dalawang tagubilin at ang setup ng boilerplate para sa test file.

Ang tagubiling `initialize_pool` ay nagpapasimula ng bagong `TokenPool` na nag-iimbak ng `vault`, `mint`, `withdraw_destination`, at `bump`. Ang `vault` ay isang token account kung saan ang awtoridad ay itinakda bilang isang PDA na hinango gamit ang `mint` na address.

Ang tagubiling `withdraw_insecure` ay maglilipat ng mga token sa `vault` token account sa isang `withdraw_destination` token account.

Gayunpaman, tulad ng nakasulat ang mga buto na ginamit para sa pagpirma ay hindi partikular sa destinasyon ng pag-withdraw ng vault, kaya nagbubukas ng programa sa mga pagsasamantala sa seguridad. Maglaan ng isang minuto upang maging pamilyar sa code bago magpatuloy.

### 2. Test `withdraw_insecure` instruction

Kasama sa test file ang code para ma-invoke ang `initialize_pool` na pagtuturo at pagkatapos ay mag-mint ng 100 token sa `vault` token account. Kasama rin dito ang pagsubok para i-invoke ang `withdraw_insecure` gamit ang nilalayong `withdraw_destination`. Ipinapakita nito na ang mga tagubilin ay maaaring gamitin ayon sa nilalayon.

Pagkatapos nito, may dalawa pang pagsubok upang ipakita kung paano madaling pagsamantalahan ang mga tagubilin.

Invokes ng unang pagsubok ang tagubiling `initialize_pool` na gumawa ng "pekeng" `pool` account gamit ang parehong token account ng `vault`, ngunit ibang `withdraw_destination`.

Ang pangalawang pagsubok ay aalis mula sa pool na ito, pagnanakaw ng mga pondo mula sa vault.

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

Patakbuhin ang `anchor test` upang makita na matagumpay na nakumpleto ang mga transaksyon at ang pagtuturo ng `withdraw_instrucure` ay nagbibigay-daan sa token account ng `vault` na ma-drain sa isang pekeng destinasyon sa pag-withdraw na nakaimbak sa pekeng `pool` account.

### 3. Add `initialize_pool_secure` instruction

Ngayon, magdagdag tayo ng bagong pagtuturo sa programa para sa ligtas na pagsisimula ng pool.

Ang bagong `initialize_pool_secure` na tagubiling ito ay magsisimula ng `pool` account bilang isang PDA na hinango gamit ang `withdraw_destination`. Magsisimula rin ito ng `vault` token account na may awtoridad na itinakda bilang `pool` na PDA.

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

### 4. Add `withdraw_secure` instruction

Susunod, magdagdag ng `withdraw_secure` na pagtuturo. Ang tagubiling ito ay mag-withdraw ng mga token mula sa `vault` token account patungo sa `withdraw_destination`. Ang `pool` account ay napatunayan gamit ang `seeds` at `bump` constraints upang matiyak na ang tamang PDA account ay ibinigay. Sinusuri ng mga hadlang na `may_isa` kung ang tamang `vault` at `withdraw_destination` na token account ay ibinigay.

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

### 5. Test `withdraw_secure` instruction

Panghuli, bumalik sa test file upang subukan ang `withdraw_secure` na pagtuturo at ipakita na sa pamamagitan ng pagpapaliit sa saklaw ng aming awtoridad sa pagpirma ng PDA, inalis namin ang kahinaan.

Bago tayo magsulat ng isang pagsubok na nagpapakita na ang kahinaan ay na-patched, sumulat tayo ng isang pagsubok na nagpapakita lamang na ang pagsisimula at pag-withdraw ng mga tagubilin ay gumagana tulad ng inaasahan:

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

Ngayon, susubukan naming hindi na gumagana ang pagsasamantala. Dahil ang awtoridad sa `vault` ay ang `pool` na PDA na hinango gamit ang nilalayong token account na `withdraw_destination`, wala nang dapat na paraan para mag-withdraw sa isang account maliban sa nilalayong `withdraw_destination`.

Magdagdag ng pagsubok na nagpapakitang hindi mo matatawagan ang `withdraw_secure` sa maling destinasyon ng withdrawal. Maaari nitong gamitin ang pool at vault na ginawa sa nakaraang pagsubok.

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

Panghuli, dahil ang `pool` account ay isang PDA na hinango gamit ang `withdraw_destination` token account, hindi kami makakagawa ng pekeng `pool` account gamit ang parehong PDA. Magdagdag ng isa pang pagsubok na nagpapakita na ang bagong tagubiling `initialize_pool_secure` ay hindi hahayaan ang isang attacker na maglagay sa maling vault.

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

Patakbuhin ang `anchor test` at upang makita na ang mga bagong tagubilin ay hindi nagpapahintulot sa isang umaatake na umatras mula sa isang vault na hindi sa kanila.

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

At ayun na nga! Hindi tulad ng ilan sa iba pang mga kahinaan sa seguridad na napag-usapan namin, ang isang ito ay mas konseptwal at hindi maaaring ayusin sa pamamagitan lamang ng paggamit ng isang partikular na uri ng Anchor. Kakailanganin mong pag-isipan ang arkitektura ng iyong programa at tiyaking hindi ka nagbabahagi ng mga PDA sa iba't ibang domain.

Kung gusto mong tingnan ang panghuling code ng solusyon, mahahanap mo ito sa `solution` branch ng [parehong repositoryo](https://github.com/Unboxed-Software/solana-pda-sharing/tree/solution ).

# Challenge

Tulad ng iba pang mga aralin sa modyul na ito, ang iyong pagkakataon na magsanay sa pag-iwas sa pagsasamantala sa seguridad na ito ay nakasalalay sa pag-audit ng iyong sarili o iba pang mga programa.

Maglaan ng ilang oras upang suriin ang hindi bababa sa isang programa at hanapin ang mga potensyal na kahinaan sa istruktura ng PDA nito. Ang mga PDA na ginagamit para sa pagpirma ay dapat na makitid at nakatutok sa isang domain hangga't maaari.

Tandaan, kung makakita ka ng bug o pagsasamantala sa programa ng ibang tao, mangyaring alertuhan sila! Kung makakita ka ng isa sa iyong sariling programa, siguraduhing i-patch ito kaagad.
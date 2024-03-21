---
title: Closing Accounts and Revival Attacks
objectives:
- Ipaliwanag ang iba't ibang mga kahinaan sa seguridad na nauugnay sa pagsasara ng mga account ng programa nang hindi tama
- Isara ang mga account ng programa nang ligtas at ligtas gamit ang katutubong Rust
- Isara ang mga account ng programa nang ligtas at ligtas gamit ang Anchor `close` constraint
---

# TL;DR

- **Ang pagsasara ng account** ay hindi wastong lumilikha ng pagkakataon para sa muling pagsisimula/pagbabagong pag-atake
- Ang Solana runtime **garbage collects accounts** kapag ang mga ito ay hindi na rent exempt. Ang pagsasara ng mga account ay nagsasangkot ng paglilipat ng mga lamport na nakaimbak sa account para sa pagbubukod sa renta sa isa pang account na iyong pinili.
- Magagamit mo ang Anchor `#[account(close = <address_to_send_lamports>)]` constraint para secure na isara ang mga account at itakda ang account discriminator sa `CLOSED_ACCOUNT_DISCRIMINATOR`

    ```rust
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
    ```

# Lesson

Bagama't ito ay simple, ang pagsasara ng mga account nang maayos ay maaaring nakakalito. Mayroong ilang mga paraan na maaaring iwasan ng isang umaatake ang pagsasara ng account kung hindi mo susundin ang mga partikular na hakbang.

Upang makakuha ng mas mahusay na pag-unawa sa mga vector ng pag-atake na ito, tuklasin natin nang malalim ang bawat isa sa mga sitwasyong ito.

## Insecure account closing

Sa kaibuturan nito, ang pagsasara ng isang account ay nagsasangkot ng paglilipat ng mga lampor nito sa isang hiwalay na account, kaya nati-trigger ang runtime ng Solana upang kolektahin ng basura ang unang account. Nire-reset nito ang may-ari mula sa nagmamay-ari na program patungo sa program ng system.

Tingnan ang halimbawa sa ibaba. Ang pagtuturo ay nangangailangan ng dalawang account:

1. `account_to_close` - ang account na isasara
2. `destination` - ang account na dapat makatanggap ng mga lamport ng saradong account

Ang logic ng program ay nilayon upang isara ang isang account sa pamamagitan lamang ng pagtaas ng `destination` account's lamports sa halagang nakaimbak sa `account_to_close` at ang pagtatakda ng `account_to_close` lamports sa 0. Gamit ang program na ito, pagkatapos maproseso ang isang buong transaksyon, ang ` ang account_to_close` ay magiging basurang kokolektahin ng runtime.

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

Gayunpaman, hindi nangyayari ang pangongolekta ng basura hanggang sa makumpleto ang transaksyon. At dahil maaaring magkaroon ng maramihang mga tagubilin sa isang transaksyon, lumilikha ito ng pagkakataon para sa isang umaatake na ipatupad ang tagubilin upang isara ang account ngunit isama rin sa transaksyon ang isang paglilipat upang i-refund ang mga pagbubukod sa renta ng account. Ang resulta ay ang account *ay hindi* magiging basurang kinokolekta, na nagbubukas ng landas para sa umaatake na magdulot ng hindi sinasadyang pag-uugali sa programa at maubos pa ang isang protocol.

## Secure account closing

Ang dalawang pinakamahalagang bagay na maaari mong gawin upang isara ang butas na ito ay i-zero out ang data ng account at magdagdag ng discriminator ng account na kumakatawan sa account na sarado na. Kailangan mo *parehong* ng mga bagay na ito upang maiwasan ang hindi sinasadyang pag-uugali ng programa.

Ang isang account na may zeroed out na data ay maaari pa ring gamitin para sa ilang bagay, lalo na kung ito ay isang PDA na ang address derivation ay ginagamit sa loob ng program para sa mga layunin ng pag-verify. Gayunpaman, maaaring limitado ang pinsala kung hindi ma-access ng umaatake ang dating nakaimbak na data.

Upang higit pang ma-secure ang program, gayunpaman, ang mga saradong account ay dapat bigyan ng isang account discriminator na nagtatalaga dito bilang "sarado," at lahat ng mga tagubilin ay dapat magsagawa ng mga pagsusuri sa lahat ng mga naipasa na account na nagbabalik ng error kung ang account ay minarkahan na sarado.

Tingnan ang halimbawa sa ibaba. Inililipat ng program na ito ang mga lamport mula sa isang account, tinatanggal ang data ng account, at nagtatakda ng discriminator ng account sa iisang tagubilin sa pag-asang mapigilan ang isang kasunod na tagubilin na gamitin muli ang account na ito bago ito makolekta ng basura. Ang pagkabigong gawin ang alinman sa mga bagay na ito ay magreresulta sa isang kahinaan sa seguridad.

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

Tandaan na ang halimbawa sa itaas ay gumagamit ng `CLOSED_ACCOUNT_DISCRIMINATOR` ng Anchor. Isa lang itong account discriminator kung saan ang bawat byte ay `255`. Ang discriminator ay walang anumang likas na kahulugan, ngunit kung isasama mo ito sa mga pagsusuri sa pagpapatunay ng account na nagbabalik ng mga error sa anumang oras na ang isang account na may ganitong discriminator ay naipasa sa isang pagtuturo, pipigilan mo ang iyong programa sa hindi sinasadyang pagproseso ng isang pagtuturo na may saradong account .

### Manual Force Defund

Mayroon pa ring isang maliit na isyu. Habang ang kasanayan ng pag-zero out sa data ng account at pagdaragdag ng isang "sarado" na discriminator ng account ay pipigilan ang iyong programa mula sa pagsasamantala, ang isang user ay maaari pa ring pigilan ang isang account mula sa pagiging basura na nakolekta sa pamamagitan ng pag-refund ng mga lamports ng account bago matapos ang isang pagtuturo. Nagreresulta ito sa isa o potensyal na maraming account na umiiral sa isang limbo state kung saan hindi magagamit ang mga ito ngunit hindi rin maaaring kolektahin ng basura.

Para pangasiwaan ang edge case na ito, maaari mong isaalang-alang ang pagdaragdag ng tagubilin na magbibigay-daan sa *sinuman* na i-defund ang mga account na may tag na "closed" account discriminator. Ang tanging pagpapatunay ng account na gagawin ng tagubiling ito ay upang matiyak na ang account na nade-defund ay mamarkahan bilang sarado. Maaaring ganito ang hitsura nito:

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

Dahil maaaring tawagan ng sinuman ang tagubiling ito, maaari itong kumilos bilang isang hadlang sa mga pagtatangkang muling pag-atake dahil ang umaatake ay nagbabayad para sa pagbubukod sa upa ng account ngunit sinumang iba ay maaaring mag-claim ng mga lamport sa isang na-refund na account para sa kanilang sarili.

Bagama't hindi kinakailangan, makakatulong ito na maalis ang pag-aaksaya ng espasyo at mga lampara na nauugnay sa mga "limbo" na account na ito.

## Use the Anchor `close` constraint

Sa kabutihang palad, ginagawang mas simple ng Anchor ang lahat ng ito gamit ang hadlang na `#[account(close = <target_account>)]. Pinangangasiwaan ng paghihigpit na ito ang lahat ng kinakailangan upang ligtas na isara ang isang account:

1. Inilipat ang mga lamport ng account sa ibinigay na `<target_account>`
2. Ni-zero out ang data ng account
3. Itinatakda ang discriminator ng account sa variant na `CLOSED_ACCOUNT_DISCRIMINATOR`

Ang kailangan mo lang gawin ay idagdag ito sa struct ng pagpapatunay ng account sa account na gusto mong isara:

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

Ang tagubiling `force_defund` ay isang opsyonal na karagdagan na kakailanganin mong ipatupad nang mag-isa kung gusto mong gamitin ito.

# Demo

Upang linawin kung paano maaaring samantalahin ng isang umaatake ang isang muling pag-atake, magtrabaho tayo sa isang simpleng programa ng lottery na gumagamit ng estado ng account ng programa upang pamahalaan ang paglahok ng isang user sa lottery.

## 1. Setup

Magsimula sa pamamagitan ng pagkuha ng code sa `starter` branch mula sa [sumusunod na repo](https://github.com/Unboxed-Software/solana-closing-accounts/tree/starter).

Ang code ay may dalawang tagubilin sa programa at dalawang pagsubok sa direktoryo ng `mga pagsubok`.

Ang mga tagubilin ng programa ay:

1. `enter_lottery`
2. `redeem_rewards_insecure`

Kapag ang isang user ay tumawag ng `enter_lottery`, ang program ay magpapasimula ng isang account upang mag-imbak ng ilang estado tungkol sa entry ng lottery ng user.

Dahil ito ay isang pinasimpleng halimbawa sa halip na isang ganap na programa ng lottery, kapag ang isang user ay nakapasok na sa lottery, maaari nilang tawagan ang pagtuturo na `redeem_rewards_insecure` anumang oras. Ang tagubiling ito ay magbibigay sa user ng halaga ng Reward token na proporsyonal sa dami ng beses na nakapasok ang user sa lottery. Matapos i-minting ang mga reward, isinasara ng programa ang entry sa lottery ng user.

Maglaan ng isang minuto upang maging pamilyar sa code ng programa. Ang tagubiling `enter_lottery` ay lumilikha lamang ng isang account sa isang PDA na nakamapa sa user at nagpapasimula ng ilang estado dito.

Ang tagubiling `redeem_rewards_insecure` ay nagsasagawa ng ilang pagpapatunay ng account at data, nagbibigay ng mga token sa ibinigay na token account, pagkatapos ay isinasara ang lottery account sa pamamagitan ng pag-alis ng mga lamport nito.

Gayunpaman, pansinin ang tagubiling `redeem_rewards_insecure` *lamang* ay naglilipat ng mga lamport ng account, na nag-iiwan sa account na bukas sa mga muling pag-atake.

## 2. Test Insecure Program

Ang isang attacker na matagumpay na pumipigil sa kanilang account mula sa pagsasara ay maaaring tumawag ng `redeem_rewards_insecure` nang maraming beses, na nagke-claim ng mas maraming reward kaysa sa dapat nilang bayaran.

Naisulat na ang ilang panimulang pagsusulit na nagpapakita ng kahinaang ito. Tingnan ang `closing-accounts.ts` file sa direktoryo ng `tests`. Mayroong ilang setup sa function na `before`, pagkatapos ay isang pagsubok na lumilikha lamang ng bagong entry sa lottery para sa `attacker`.

Panghuli, mayroong pagsubok na nagpapakita kung paano mapapanatili ng isang attacker na buhay ang account kahit na pagkatapos mag-claim ng mga reward at pagkatapos ay mag-claim muli ng mga reward. Ang pagsusulit na iyon ay ganito ang hitsura:

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

Ginagawa ng pagsusulit na ito ang sumusunod:
1. Tumawag ng `redeem_rewards_insecure` para i-redeem ang mga reward ng user
2. Sa parehong transaksyon, nagdaragdag ng tagubilin upang i-refund ang `lottery_entry` ng user bago ito aktwal na maisara
3. Matagumpay na nauulit ang hakbang 1 at 2, na nagre-redeem ng mga reward sa pangalawang pagkakataon.

Maaari mong teoretikal na ulitin ang mga hakbang 1-2 nang walang hanggan hanggang sa alinman sa a) ang programa ay wala nang mga gantimpala na ibibigay o b) may nakapansin at nag-patch ng pagsasamantala. Ito ay malinaw na magiging isang matinding problema sa anumang tunay na programa dahil pinapayagan nito ang isang malisyosong umaatake na maubos ang isang buong reward pool.

## 3. Create a `redeem_rewards_secure` instruction

Upang maiwasang mangyari ito, gagawa kami ng bagong tagubilin na magsasara ng lottery account nang lihim gamit ang Anchor `close` constraint. Huwag mag-atubiling subukan ito sa iyong sarili kung gusto mo.

Ang bagong account validation struct na tinatawag na `RedeemWinningsSecure` ay dapat magmukhang ganito:

```rust
#[derive(Accounts)]
pub struct RedeemWinningsSecure<'info> {
    // program expects this account to be initialized
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

Ito ay dapat na eksaktong kapareho ng orihinal na `RedeemWinnings` account validation struct, maliban kung mayroong karagdagang `close = user` constraint sa `lottery_entry` account. Sasabihin nito sa Anchor na isara ang account sa pamamagitan ng pag-zero out sa data, paglilipat ng mga lampor nito sa `user` account, at pagtatakda ng discriminator ng account sa `CLOSED_ACCOUNT_DISCRIMINATOR`. Ang huling hakbang na ito ay kung ano ang pipigil sa account na magamit muli kung sinubukan na ng program na isara ito.

Pagkatapos, maaari tayong gumawa ng `mint_ctx` na paraan sa bagong `RedeemWinningsSecure` na struct upang makatulong sa pag-minting ng CPI sa token program.

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

Sa wakas, ang lohika para sa bagong secure na pagtuturo ay dapat magmukhang ganito:

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

Kinakalkula lang ng logic na ito ang mga reward para sa nagke-claim na user at inililipat ang mga reward. Gayunpaman, dahil sa hadlang na `close` sa struct ng pagpapatunay ng account, hindi dapat matawagan ng attacker ang tagubiling ito nang maraming beses.

## 4. Test the Program

Upang subukan ang aming bagong secure na pagtuturo, gumawa tayo ng bagong pagsubok na sumusubok na tumawag sa `redeemWinningsSecure` nang dalawang beses. Inaasahan naming magkakaroon ng error ang pangalawang tawag.

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

Patakbuhin ang `anchor test` para makitang pumasa ang pagsubok. Ang output ay magmumukhang ganito:

```bash
  closing-accounts
    ✔ Enter lottery (451ms)
    ✔ attacker can close + refund lottery acct + claim multiple rewards (18760ms)
AnchorError caused by account: lottery_entry. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.
    ✔ attacker cannot claim multiple rewards with secure claim (414ms)
```

Tandaan, hindi nito pinipigilan ang malisyosong user na i-refund nang buo ang kanilang account - pinoprotektahan lang nito ang aming programa mula sa hindi sinasadyang muling paggamit ng account kapag dapat itong isara. Hindi pa kami nagpapatupad ng `force_defund` na pagtuturo sa ngayon, ngunit magagawa namin. Kung nararamdaman mo ito, subukan mo ito sa iyong sarili!

Ang pinakasimple at pinakasecure na paraan upang isara ang mga account ay ang paggamit ng `close` constraint ng Anchor. Kung kailangan mo ng higit pang custom na gawi at hindi mo magagamit ang hadlang na ito, tiyaking gayahin ang functionality nito upang matiyak na secure ang iyong program.

Kung gusto mong tingnan ang panghuling code ng solusyon, mahahanap mo ito sa `solution` branch ng [parehong repositoryo](https://github.com/Unboxed-Software/solana-closing-accounts/tree/solution).

# Challenge

Tulad ng iba pang mga aralin sa modyul na ito, ang iyong pagkakataon na magsanay sa pag-iwas sa pagsasamantala sa seguridad na ito ay nakasalalay sa pag-audit ng iyong sarili o iba pang mga programa.

Maglaan ng ilang oras upang suriin ang hindi bababa sa isang programa at tiyaking kapag isinara ang mga account ay hindi sila madaling kapitan ng mga muling pag-atake.

Tandaan, kung makakita ka ng bug o pagsasamantala sa programa ng ibang tao, mangyaring alertuhan sila! Kung makakita ka ng isa sa iyong sariling programa, siguraduhing i-patch ito kaagad.

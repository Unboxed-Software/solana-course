---
title: Environment Variables in Solana Programs
objectives:
- Tukuyin ang mga feature ng program sa `Cargo.toml` file
- Gamitin ang katangiang Rust `cfg` para may kondisyong mag-compile ng code batay sa kung aling mga feature ang pinapagana o hindi
- Gamitin ang Rust `cfg!` macro para may kondisyong mag-compile ng code batay sa kung aling mga feature ang pinapagana o hindi
- Gumawa ng admin-only na pagtuturo upang mag-set up ng program account na maaaring magamit upang mag-imbak ng mga value ng configuration ng program
---

# TL;DR

- Walang mga "out of the box" na solusyon para sa paglikha ng mga natatanging kapaligiran sa isang onchain na programa, ngunit makakamit mo ang isang bagay na katulad ng mga variable ng kapaligiran kung magiging malikhain ka.
- Maaari mong gamitin ang attribute na `cfg` na may **Mga tampok na Rust** (`#[cfg(feature = ...)]`) upang magpatakbo ng ibang code o magbigay ng iba't ibang mga value ng variable batay sa ibinigay na feature na Rust. _Nangyayari ito sa oras ng pag-compile at hindi ka pinapayagang magpalit ng mga halaga pagkatapos ma-deploy ang isang programa_.
- Katulad nito, maaari mong gamitin ang `cfg!` **macro** upang mag-compile ng iba't ibang mga path ng code batay sa mga feature na pinagana.
- Bilang kahalili, makakamit mo ang isang bagay na katulad ng mga variable ng kapaligiran na maaaring mabago pagkatapos ng pag-deploy sa pamamagitan ng paggawa ng mga account at tagubilin na maa-access lamang ng awtoridad sa pag-upgrade ng programa.

# Lesson

Ang isa sa mga paghihirap na kinakaharap ng mga inhinyero sa lahat ng uri ng software development ay ang pagsulat ng masusubok na code at paglikha ng mga natatanging kapaligiran para sa lokal na pag-unlad, pagsubok, produksyon, atbp.

Maaari itong maging partikular na mahirap sa pagbuo ng programa ng Solana. Halimbawa, isipin ang paggawa ng NFT staking program na nagbibigay ng reward sa bawat staked NFT ng 10 reward token bawat araw. Paano mo masusubok ang kakayahang mag-claim ng mga reward kapag tumatakbo ang mga pagsubok sa loob ng ilang daang millisecond, na halos hindi sapat ang haba para makakuha ng mga reward?

Niresolba ng tradisyunal na web development ang ilan dito gamit ang mga variable ng kapaligiran na ang mga halaga ay maaaring mag-iba sa bawat natatanging "kapaligiran." Sa kasalukuyan, walang pormal na konsepto ng mga variable ng kapaligiran sa isang programa ng Solana. Kung mayroon, magagawa mo lang ito upang ang mga reward sa iyong kapaligiran sa pagsubok ay 10,000,000 token bawat araw at magiging mas madaling subukan ang kakayahang mag-claim ng mga reward.

Sa kabutihang palad, makakamit mo ang katulad na paggana kung magiging malikhain ka. Ang pinakamahusay na diskarte ay marahil isang kumbinasyon ng dalawang bagay:

1. Rust feature flag na nagbibigay-daan sa iyong tukuyin sa iyong build command ang "environment" ng build, kasama ng code na nag-aayos ng mga partikular na value nang naaayon.
2. Mga account at tagubiling "admin-only" ng program na maa-access lang ng awtoridad sa pag-upgrade ng programa

## Rust feature flags

Ang isa sa mga pinakasimpleng paraan upang lumikha ng mga kapaligiran ay ang paggamit ng mga tampok na Rust. Tinutukoy ang mga feature sa `[features]` table ng file ng `Cargo.toml` ng program. Maaari kang tumukoy ng maraming feature para sa iba't ibang sitwasyon ng paggamit.

```toml
[features]
feature-one = []
feature-two = []
```

Mahalagang tandaan na ang nasa itaas ay tumutukoy lamang sa isang tampok. Upang paganahin ang isang tampok kapag sinusubukan ang iyong programa, maaari mong gamitin ang `--features` na flag gamit ang command na `anchor test`.

```bash
anchor test -- --features "feature-one"
```

Maaari ka ring tumukoy ng maraming feature sa pamamagitan ng paghihiwalay sa mga ito gamit ang kuwit.

```bash
anchor test -- --features "feature-one", "feature-two"
```

### Make code conditional using the `cfg` attribute

Sa tinukoy na feature, maaari mong gamitin ang attribute na `cfg` sa loob ng iyong code para may kundisyon na mag-compile ng code batay sa kung pinagana o hindi ang isang partikular na feature. Nagbibigay-daan ito sa iyong isama o ibukod ang ilang partikular na code mula sa iyong programa.

Ang syntax para sa paggamit ng attribute na `cfg` ay katulad ng iba pang macro ng attribute: `#[cfg(feature=[FEATURE_HERE])]`. Halimbawa, pinagsama-sama ng sumusunod na code ang function na `function_for_testing` kapag pinagana ang feature na `testing` at ang `function_when_not_testing` kung hindi:

```rust
#[cfg(feature = "testing")]
fn function_for_testing() {
    // code that will be included only if the "testing" feature flag is enabled
}

#[cfg(not(feature = "testing"))]
fn function_when_not_testing() {
    // code that will be included only if the "testing" feature flag is not enabled
}
```

Nagbibigay-daan ito sa iyo na paganahin o huwag paganahin ang ilang partikular na pagpapagana sa iyong Anchor program sa oras ng pag-compile sa pamamagitan ng pagpapagana o hindi pagpapagana sa feature.

Ito ay hindi isang kahabaan upang isipin na gustong gamitin ito upang lumikha ng natatanging "mga kapaligiran" para sa iba't ibang mga deployment ng programa. Halimbawa, hindi lahat ng token ay may mga deployment sa parehong Mainnet at Devnet. Kaya maaari mong i-hard-code ang isang token address para sa mga deployment ng Mainnet ngunit hard-code ang ibang address para sa mga deployment ng Devnet at Localnet. Sa ganoong paraan maaari kang mabilis na lumipat sa pagitan ng iba't ibang mga kapaligiran nang hindi nangangailangan ng anumang mga pagbabago sa code mismo.

Ang code sa ibaba ay nagpapakita ng isang halimbawa ng isang Anchor program na gumagamit ng `cfg` attribute para magsama ng iba't ibang token address para sa lokal na pagsubok kumpara sa iba pang deployment:

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[cfg(feature = "local-testing")]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("WaoKNLQVDyBx388CfjaVeyNbs3MT2mPgAhoCfXyUvg8");
}

#[cfg(not(feature = "local-testing"))]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

#[program]
pub mod test_program {
    use super::*;

    pub fn initialize_usdc_token_account(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = payer,
    )]
    pub token: Account<'info, TokenAccount>,
    #[account(address = constants::USDC_MINT_PUBKEY)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

Sa halimbawang ito, ginagamit ang attribute na `cfg` para may kundisyon na mag-compile ng dalawang magkaibang pagpapatupad ng module na `constants`. Nagbibigay-daan ito sa program na gumamit ng iba't ibang mga halaga para sa pare-parehong `USDC_MINT_PUBKEY` depende kung pinagana o hindi ang feature na `local-testing`.

### Gawing conditional ang code gamit ang `cfg!` na macro

Katulad ng attribute na `cfg`, binibigyang-daan ka ng `cfg!` **macro** sa Rust na suriin ang mga value ng ilang mga flag ng configuration sa runtime. Maaari itong maging kapaki-pakinabang kung gusto mong magsagawa ng iba't ibang mga path ng code depende sa mga halaga ng ilang mga flag ng configuration.

Magagamit mo ito para i-bypass o isaayos ang mga hadlang batay sa oras na kinakailangan sa NFT staking app na binanggit namin dati. Kapag nagpapatakbo ng pagsubok, maaari kang magsagawa ng code na nagbibigay ng mas mataas na staking reward kung ihahambing sa pagpapatakbo ng production build.

Upang gamitin ang `cfg!` na macro sa isang Anchor program, magdagdag ka lang ng `cfg!` na macro call sa conditional statement na pinag-uusapan:

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn test_function(ctx: Context<Test>) -> Result<()> {
        if cfg!(feature = "local-testing") {
            // This code will be executed only if the "local-testing" feature is enabled
            // ...
        } else {
            // This code will be executed only if the "local-testing" feature is not enabled
            // ...
        }
        // Code that should always be included goes here
        ...
        Ok(())
    }
}
```

Sa halimbawang ito, ginagamit ng `test_function` ang `cfg!` na macro upang suriin ang halaga ng feature na `local-testing` sa runtime. Kung ang feature na `local-testing` ay pinagana, ang unang code path ay isasagawa. Kung ang feature na `local-testing` ay hindi pinagana, ang pangalawang code path ang ipapatupad sa halip.

## Admin-only instructions

Ang mga feature na flag ay mahusay para sa pagsasaayos ng mga value at path ng code sa compilation, ngunit hindi ito nakakatulong nang malaki kung kailangan mong ayusin ang isang bagay pagkatapos mong i-deploy ang iyong program.

Halimbawa, kung ang iyong NFT staking program ay kailangang mag-pivot at gumamit ng ibang rewards token, walang paraan upang i-update ang program nang hindi muling i-deploy. Kung may paraan lang para sa mga admin ng programa na mag-update ng ilang partikular na value ng program... Well, posible!

Una, kailangan mong buuin ang iyong program upang iimbak ang mga halagang inaasahan mong pagbabago sa isang account sa halip na i-hard-coding ang mga ito sa program code.

Susunod, kailangan mong tiyakin na ang account na ito ay maa-update lang ng ilang kilalang awtoridad sa programa, o kung ano ang tinatawag naming admin. Nangangahulugan iyon na ang anumang mga tagubilin na nagbabago sa data sa account na ito ay kailangang may mga hadlang na naglilimita kung sino ang maaaring pumirma para sa pagtuturo. Ito ay medyo diretso sa teorya, ngunit may isang pangunahing isyu: paano malalaman ng programa kung sino ang isang awtorisadong admin?

Buweno, may ilang mga solusyon, bawat isa ay may sariling mga pakinabang at kawalan:

1. Hard-code ang isang admin na pampublikong key na maaaring magamit sa mga hadlang sa pagtuturo lamang ng admin.
2. Gawing admin ang awtoridad sa pag-upgrade ng programa.
3. I-store ang admin sa config account at itakda ang unang admin sa isang `initialize` na pagtuturo.

### Create the config account

Ang unang hakbang ay ang pagdaragdag ng tatawagin naming "config" na account sa iyong programa. Maaari mong i-customize ito upang pinakaangkop sa iyong mga pangangailangan, ngunit iminumungkahi namin ang isang pandaigdigang PDA. Sa Anchor, nangangahulugan lang iyon ng paggawa ng struct ng account at paggamit ng iisang binhi para makuha ang address ng account.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

Ang halimbawa sa itaas ay nagpapakita ng hypothetical config account para sa halimbawa ng NFT staking program na binanggit namin sa buong aralin. Nag-iimbak ito ng data na kumakatawan sa token na dapat gamitin para sa mga reward at ang halaga ng mga token na ibibigay para sa bawat araw ng staking.

Gamit ang tinukoy na config account, siguraduhin lang na ang natitirang bahagi ng iyong code ay tumutukoy sa account na ito kapag ginagamit ang mga halagang ito. Sa ganoong paraan, kung ang data sa account ay nagbabago, ang programa ay umaangkop nang naaayon.

### Constrain config updates to hard-coded admins

Kakailanganin mo ang isang paraan upang simulan at i-update ang data ng config account. Nangangahulugan iyon na kailangan mong magkaroon ng isa o higit pang mga tagubilin na maaaring gamitin ng isang admin. Ang pinakasimpleng paraan upang gawin ito ay ang pag-hard-code ng pampublikong susi ng admin sa iyong code at pagkatapos ay magdagdag ng simpleng pag-check ng signer sa pagpapatunay ng account ng iyong pagtuturo na naghahambing ng lumagda sa pampublikong key na ito.

Sa Anchor, ang pagpilit sa isang `update_program_config` na pagtuturo upang magamit lamang ng isang hard-coded na admin ay maaaring magmukhang ganito:

```rust
#[program]
mod my_program {
    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        reward_token: Pubkey,
        rewards_per_day: u64
    ) -> Result<()> {
        ctx.accounts.program_config.reward_token = reward_token;
        ctx.accounts.program_config.rewards_per_day = rewards_per_day;

        Ok(())
    }
}

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN_PUBKEY: Pubkey = pubkey!("ADMIN_WALLET_ADDRESS_HERE");

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == ADMIN_PUBKEY)]
    pub authority: Signer<'info>,
}
```

Bago pa man isagawa ang logic ng pagtuturo, isasagawa ang pagsusuri upang matiyak na tumutugma ang signer ng pagtuturo sa hard-coded na `ADMIN_PUBKEY`. Pansinin na ang halimbawa sa itaas ay hindi nagpapakita ng tagubilin na nagpapasimula sa config account, ngunit dapat itong magkaroon ng katulad na mga hadlang upang matiyak na hindi masimulan ng isang attacker ang account na may mga hindi inaasahang halaga.

Habang gumagana ang diskarteng ito, nangangahulugan din ito ng pagsubaybay sa isang admin wallet bukod pa sa pagsubaybay sa awtoridad sa pag-upgrade ng isang programa. Sa ilang higit pang mga linya ng code, maaari mo lamang paghigpitan ang isang pagtuturo na matatawag lamang ng awtoridad sa pag-upgrade. Ang tanging nakakalito na bahagi ay ang pagkuha ng awtoridad sa pag-upgrade ng isang programa upang ihambing.

### Constrain config updates to the program's upgrade authority

Sa kabutihang palad, ang bawat programa ay may program data account na nagsasalin sa uri ng Anchor `ProgramData` account at mayroong field na `upgrade_authority_address`. Iniimbak mismo ng program ang address ng account na ito sa data nito sa field na `programdata_address`.

Kaya bilang karagdagan sa dalawang account na kinakailangan ng pagtuturo sa hard-coded na halimbawa ng admin, ang tagubiling ito ay nangangailangan ng `program` at ang `program_data` na mga account.

Pagkatapos ay kailangan ng mga account ang mga sumusunod na limitasyon:

1. Isang hadlang sa `program` na tinitiyak na ang ibinigay na `program_data` account ay tumutugma sa field ng `programdata_address` ng program
2. Isang hadlang sa `program_data` na account na tinitiyak na tumutugma ang signer ng pagtuturo sa field ng `upgrade_authority_address` ng `program_data` account.

Kapag nakumpleto, ganito ang hitsura:

```rust
...

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, MyProgram>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()))]
    pub program_data: Account<'info, ProgramData>,
    pub authority: Signer<'info>,
}
```

Muli, hindi ipinapakita ng halimbawa sa itaas ang pagtuturo na nagpapasimula sa config account, ngunit dapat itong magkaroon ng parehong mga hadlang upang matiyak na hindi masimulan ng isang attacker ang account na may mga hindi inaasahang halaga.

Kung ito ang unang pagkakataon na narinig mo ang tungkol sa program data account, sulit na basahin ang [doc na ito ng Notion](https://www.notion.so/29780c48794c47308d5f138074dd9838) tungkol sa mga pag-deploy ng program.

### Constrain config updates to a provided admin

Pareho sa mga nakaraang opsyon ay medyo secure ngunit hindi rin nababaluktot. Paano kung gusto mong i-update ang admin upang maging ibang tao? Para doon, maaari mong iimbak ang admin sa config account.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    admin: Pubkey,
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

Pagkatapos ay maaari mong hadlangan ang iyong mga tagubilin sa "pag-update" gamit ang isang signer check na tumutugma sa field ng `admin` ng config account.

```rust
...

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == program_config.admin)]
    pub authority: Signer<'info>,
}
```

Mayroong isang catch dito: sa oras sa pagitan ng pag-deploy ng program at pagsisimula ng config account, _walang admin_. Nangangahulugan ito na ang pagtuturo para sa pagsisimula ng config account ay hindi maaaring pilitin na payagan lamang ang mga admin bilang mga tumatawag. Nangangahulugan iyon na maaari itong tawagan ng isang umaatake na naghahanap upang itakda ang kanilang sarili bilang admin.

Bagama't masama ito, nangangahulugan lang ito na hindi mo dapat ituring ang iyong programa bilang "na-initialize" hanggang sa ikaw mismo ang mag-initialize ng config account at ma-verify na ang admin na nakalista sa account ay kung sino ang iyong inaasahan. Kung ang iyong deploy na script ay nagde-deploy at pagkatapos ay agad na tatawagin ang `initialize`, ito ay napaka-malas na alam ng isang attacker ang pagkakaroon ng iyong program na hindi gaanong sinusubukang gawin ang kanilang sarili bilang admin. Kung sa pamamagitan ng ilang nakakabaliw na stroke ng masamang kapalaran ay may isang "humirang" sa iyong programa, maaari mong isara ang programa gamit ang awtoridad sa pag-upgrade at muling i-deploy.

# Demo

Ngayon, sige at subukan natin ito nang magkasama. Para sa demo na ito, gagawa kami ng isang simpleng programa na nagbibigay-daan sa mga pagbabayad sa USDC. Nangongolekta ang programa ng maliit na bayad para sa pagpapadali sa paglipat. Tandaan na ito ay medyo ginawa dahil maaari kang gumawa ng mga direktang paglilipat nang walang intermediary na kontrata, ngunit ginagaya nito kung paano gumagana ang ilang kumplikadong DeFi program.

Mabilis naming malalaman habang sinusubok ang aming programa na maaari itong makinabang mula sa kakayahang umangkop na ibinigay ng isang account sa pagsasaayos na kontrolado ng admin at ilang mga flag ng tampok.

### 1. Starter

I-download ang starter code mula sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/solana-admin-instructions/tree/starter). Ang code ay naglalaman ng isang programa na may iisang pagtuturo at isang pagsubok sa direktoryo ng `mga pagsubok`.

Mabilis nating talakayin kung paano gumagana ang programa.

Ang `lib.rs` file ay may kasamang constant para sa USDC address at isang `payment` na pagtuturo. Ang tagubiling `payment` ay tinatawag na function na `payment_handler` sa `instructions/payment.rs` file kung saan nakapaloob ang logic ng pagtuturo.

Ang file na `instructions/payment.rs` ay naglalaman ng parehong function na `payment_handler` pati na rin ang struct ng validation ng account na `Payment` na kumakatawan sa mga account na kinakailangan ng tagubilin sa `payment`. Kinakalkula ng function na `payment_handler` ang isang 1% na bayarin mula sa halaga ng pagbabayad, inililipat ang bayad sa isang itinalagang token account, at inililipat ang natitirang halaga sa tatanggap ng pagbabayad.

Sa wakas, ang direktoryo ng `pagsusulit` ay may iisang test file, ang `config.ts` na nag-i-invoke lamang ng tagubiling `pagbabayad` at iginiit na ang kaukulang balanse ng token account ay na-debit at na-kredito nang naaayon.

Bago tayo magpatuloy, maglaan ng ilang minuto upang maging pamilyar sa mga file na ito at sa mga nilalaman nito.

### 2. Run the existing test

Magsimula tayo sa pagpapatakbo ng kasalukuyang pagsubok.

Tiyaking gumagamit ka ng `yarn` o `npm install` para i-install ang mga dependency na nakalagay sa `package.json` file. Pagkatapos ay tiyaking patakbuhin ang `listahan ng mga anchor key` upang mai-print sa console ang pampublikong key para sa iyong programa. Naiiba ito batay sa keypair na mayroon ka nang lokal, kaya kailangan mong i-update ang `lib.rs` at `Anchor.toml` para magamit ang *iyong* key.

Panghuli, patakbuhin ang `anchor test` upang simulan ang pagsubok. Dapat itong mabigo sa sumusunod na output:

```
Error: nabigong magpadala ng transaksyon: Nabigo ang simulation ng transaksyon: Error sa pagproseso Tagubilin 0: maling program id para sa pagtuturo
```

Ang dahilan ng error na ito ay sinusubukan naming gamitin ang mainnet USDC mint address (bilang hard-coded sa `lib.rs` file ng program), ngunit ang mint na iyon ay hindi umiiral sa lokal na kapaligiran.

### 3. Adding a `local-testing` feature

Upang ayusin ito, kailangan namin ng mint na magagamit namin nang lokal *at* hard-code sa programa. Dahil madalas na ni-reset ang lokal na kapaligiran sa panahon ng pagsubok, kakailanganin mong mag-imbak ng keypair na magagamit mo upang muling likhain ang parehong mint address sa bawat oras.

Bukod pa rito, hindi mo nais na baguhin ang hard-coded na address sa pagitan ng mga lokal at mainnet na build dahil maaari itong magpakilala ng pagkakamali ng tao (at nakakainis lang). Kaya gagawa kami ng feature na `local-testing` na, kapag pinagana, gagawing gamitin ng program ang aming lokal na mint ngunit kung hindi man ay gagamitin ang production USDC mint.

Bumuo ng bagong keypair sa pamamagitan ng pagpapatakbo ng `solana-keygen grind`. Patakbuhin ang sumusunod na command upang bumuo ng keypair na may pampublikong key na nagsisimula sa "env".

```
solana-keygen grind --starts-with env:1
```

Once a keypair is found, you should see an output similar to the following:

```
Wrote keypair to env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json
```

Ang keypair ay nakasulat sa isang file sa iyong gumaganang direktoryo. Ngayong mayroon na tayong placeholder USDC address, baguhin natin ang `lib.rs` file. Gamitin ang attribute na `cfg` upang tukuyin ang pare-parehong `USDC_MINT_PUBKEY` depende sa kung ang feature na `local-testing` ay pinagana o hindi pinagana. Tandaang itakda ang pare-parehong `USDC_MINT_PUBKEY` para sa `local-testing` gamit ang nabuo sa nakaraang hakbang sa halip na kopyahin ang nasa ibaba.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("...");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

#[program]
pub mod config {
    use super::*;

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

Susunod, idagdag ang feature na `local-testing` sa `Cargo.toml` file na matatagpuan sa `/programs`.

```
[features]
...
local-testing = []
```

Susunod, i-update ang test file na `config.ts` para gumawa ng mint gamit ang nabuong keypair. Magsimula sa pamamagitan ng pagtanggal ng `mint` constant.

```typescript
const mint = new anchor.web3.PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
```

Susunod, i-update ang pagsubok upang lumikha ng mint gamit ang keypair, na magbibigay-daan sa amin na muling gamitin ang parehong mint address sa tuwing tatakbo ang mga pagsubok. Tandaan na palitan ang pangalan ng file ng nabuo sa nakaraang hakbang.

```typescript
let mint: anchor.web3.PublicKey

before(async () => {
  let data = fs.readFileSync(
    "env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json"
  )

  let keypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(data))
  )

  const mint = await spl.createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    0,
    keypair
  )
...
```

Panghuli, patakbuhin ang pagsubok gamit ang feature na `local-testing` na pinagana.

```
anchor test -- --features "local-testing"
```

You should see the following output:

```
config
  ✔ Payment completes successfully (406ms)


1 passing (3s)
```

Boom. Ganoon lang, gumamit ka ng mga feature para magpatakbo ng dalawang magkaibang code path para sa magkaibang environment.

### 4. Program Config

Features are great for setting different values at compilation, but what if you wanted to be able to dynamically update the fee percentage used by the program? Let's make that possible by creating a Program Config account that allows us to update the fee without upgrading the program.

To begin, let's first update the `lib.rs` file to:

1. Include a `SEED_PROGRAM_CONFIG` constant, which will be used to generate the PDA for the program config account.
2. Include an `ADMIN` constant, which will be used as a constraint when initializing the program config account. Run the `solana address` command to get your address to use as the constant's value.
3. Include a `state` module that we'll implement shortly.
4. Include the `initialize_program_config` and `update_program_config` instructions and calls to their "handlers," both of which we'll implement in another step.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
mod state;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("envgiPXWwmpkHFKdy4QLv2cypgAWmVTVEm71YbNpYRu");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN: Pubkey = pubkey!("...");

#[program]
pub mod config {
    use super::*;

    pub fn initialize_program_config(ctx: Context<InitializeProgramConfig>) -> Result<()> {
        instructions::initialize_program_config_handler(ctx)
    }

    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        new_fee: u64,
    ) -> Result<()> {
        instructions::update_program_config_handler(ctx, new_fee)
    }

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

### 5. Program Config State

Susunod, tukuyin natin ang istraktura para sa estado ng `ProgramConfig`. Iimbak ng account na ito ang admin, ang token account kung saan ipinapadala ang mga bayarin, at ang rate ng bayad. Tutukuyin din namin ang bilang ng mga byte na kinakailangan upang maiimbak ang istrukturang ito.

Gumawa ng bagong file na tinatawag na `state.rs` sa `/src` na direktoryo at idagdag ang sumusunod na code.

```rust
use anchor_lang::prelude::*;

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_basis_points: u64,
}

impl ProgramConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8;
}
```

### 6. Add Initialize Program Config Account Instruction

Ngayon gumawa tayo ng lohika ng pagtuturo para sa pagsisimula ng program config account. Dapat lang itong matawagan ng isang transaksyong nilagdaan ng `ADMIN` key at dapat itakda ang lahat ng property sa `ProgramConfig` account.

Gumawa ng folder na tinatawag na `program_config` sa path `/src/instructions/program_config`. Ang folder na ito ay mag-iimbak ng lahat ng mga tagubilin na nauugnay sa program config account.

Sa loob ng folder na `program_config`, lumikha ng file na tinatawag na `initialize_program_config.rs` at idagdag ang sumusunod na code.

```rust
use crate::state::ProgramConfig;
use crate::ADMIN;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct InitializeProgramConfig<'info> {
    #[account(init, seeds = [SEED_PROGRAM_CONFIG], bump, payer = authority, space = ProgramConfig::LEN)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(mut, address = ADMIN)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_program_config_handler(ctx: Context<InitializeProgramConfig>) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.authority.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = 100;
    Ok(())
}
```

### 7. Add Update Program Config Fee Instruction

Susunod, ipatupad ang lohika ng pagtuturo para sa pag-update ng config account. Ang pagtuturo ay dapat na nangangailangan na ang lumagda ay tumugma sa `admin` na nakaimbak sa `program_config` na account.

Sa loob ng folder na `program_config`, lumikha ng file na tinatawag na `update_program_config.rs` at idagdag ang sumusunod na code.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = [SEED_PROGRAM_CONFIG], bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = program_config.admin,
    )]
    pub admin: Signer<'info>,
    /// CHECK: arbitrarily assigned by existing admin
    pub new_admin: UncheckedAccount<'info>,
}

pub fn update_program_config_handler(
    ctx: Context<UpdateProgramConfig>,
    new_fee: u64,
) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.new_admin.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = new_fee;
    Ok(())
}
```

### 8. Add mod.rs and update instructions.rs

Susunod, ilantad natin ang mga tagapangasiwa ng pagtuturo na ginawa namin upang ang tawag mula sa `lib.rs` ay hindi magpakita ng error. Magsimula sa pamamagitan ng pagdaragdag ng file na `mod.rs` sa folder na `program_config`. Idagdag ang code sa ibaba para gawing accessible ang dalawang module, `initialize_program_config` at `update_program_config`.

```rust
mod initialize_program_config;
pub use initialize_program_config::*;

mod update_program_config;
pub use update_program_config::*;
```

Ngayon, i-update ang `instructions.rs` sa path `/src/instructions.rs`. Idagdag ang code sa ibaba para gawing accessible ang dalawang module, `program_config` at `payment`.

```rust
mod program_config;
pub use program_config::*;

mod payment;
pub use payment::*;
```

### 9. Update Payment Instruction

Panghuli, i-update natin ang tagubilin sa pagbabayad upang matiyak na ang `fee_destination` account sa pagtuturo ay tumutugma sa `fee_destination` na nakaimbak sa program config account. Pagkatapos ay i-update ang pagkalkula ng bayarin ng pagtuturo na nakabatay sa `fee_basis_point` na nakaimbak sa program config account.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(
        seeds = [SEED_PROGRAM_CONFIG],
        bump,
        has_one = fee_destination
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub receiver_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub sender: Signer<'info>,
}

pub fn payment_handler(ctx: Context<Payment>, amount: u64) -> Result<()> {
    let fee_amount = amount
        .checked_mul(ctx.accounts.program_config.fee_basis_points)
        .unwrap()
        .checked_div(10000)
        .unwrap();
    let remaining_amount = amount.checked_sub(fee_amount).unwrap();

    msg!("Amount: {}", amount);
    msg!("Fee Amount: {}", fee_amount);
    msg!("Remaining Transfer Amount: {}", remaining_amount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.fee_destination.to_account_info(),
            },
        ),
        fee_amount,
    )?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.receiver_token_account.to_account_info(),
            },
        ),
        remaining_amount,
    )?;

    Ok(())
}
```

### 10. Test

Ngayong tapos na kaming ipatupad ang aming bagong istruktura ng pagsasaayos ng programa at mga tagubilin, magpatuloy tayo sa pagsubok sa aming na-update na programa. Upang magsimula, idagdag ang PDA para sa program config account sa test file.

```typescript
describe("config", () => {
  ...
  const programConfig = findProgramAddressSync(
    [Buffer.from("program_config")],
    program.programId
  )[0]
...
```

Susunod, i-update ang test file na may tatlo pang pagsubok na pagsubok na:

1. Ang program config account ay nasimulan nang tama
2. Ang tagubilin sa pagbabayad ay gumagana ayon sa nilalayon
3. Ang config account ay maaaring matagumpay na ma-update ng admin
4. Ang config account ay hindi maaaring i-update ng iba maliban sa admin

Sinisimulan ng unang pagsubok ang program config account at bini-verify na ang tamang bayad ay nakatakda at na ang tamang admin ay naka-store sa program config account.

```typescript
it("Initialize Program Config Account", async () => {
  const tx = await program.methods
    .initializeProgramConfig()
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      authority: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    100
  )
  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).admin.toString(),
    wallet.publicKey.toString()
  )
})
```

Ang pangalawang pagsubok ay nagpapatunay na ang pagtuturo sa pagbabayad ay gumagana nang tama, na ang bayad ay ipinadala sa patutunguhan ng bayad at ang natitirang balanse ay inililipat sa tatanggap. Dito, ina-update namin ang umiiral nang pagsubok para isama ang `programConfig` account.

```typescript
it("Payment completes successfully", async () => {
  const tx = await program.methods
    .payment(new anchor.BN(10000))
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      senderTokenAccount: senderTokenAccount,
      receiverTokenAccount: receiverTokenAccount,
      sender: sender.publicKey,
    })
    .transaction()

  await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])

  assert.strictEqual(
    (await connection.getTokenAccountBalance(senderTokenAccount)).value
      .uiAmount,
    0
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(feeDestination)).value.uiAmount,
    100
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(receiverTokenAccount)).value
      .uiAmount,
    9900
  )
})
```

Ang ikatlong pagsubok ay sumusubok na i-update ang bayad sa program config account, na dapat ay matagumpay.

```typescript
it("Update Program Config Account", async () => {
  const tx = await program.methods
    .updateProgramConfig(new anchor.BN(200))
    .accounts({
      programConfig: programConfig,
      admin: wallet.publicKey,
      feeDestination: feeDestination,
      newAdmin: sender.publicKey,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    200
  )
})
```

Ang ikaapat na pagsubok ay sumusubok na i-update ang bayad sa program config account, kung saan ang admin ay hindi ang isa na naka-imbak sa program config account, at ito ay dapat mabigo.

```typescript
it("Update Program Config Account with unauthorized admin (expect fail)", async () => {
  try {
    const tx = await program.methods
      .updateProgramConfig(new anchor.BN(300))
      .accounts({
        programConfig: programConfig,
        admin: sender.publicKey,
        feeDestination: feeDestination,
        newAdmin: sender.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])
  } catch (err) {
    expect(err)
  }
})
```

Sa wakas, patakbuhin ang pagsubok gamit ang sumusunod na command:

```
anchor test -- --features "local-testing"
```

Dapat mong makita ang sumusunod na output:

```
config
  ✔ Initialize Program Config Account (199ms)
  ✔ Payment completes successfully (405ms)
  ✔ Update Program Config Account (403ms)
  ✔ Update Program Config Account with unauthorized admin (expect fail)

4 passing (8s)
```

At ayun na nga! Mas pinadali mo ang programa sa pagsulong. Kung gusto mong tingnan ang code ng panghuling solusyon, mahahanap mo ito sa `solution` branch ng [the same repository](https://github.com/Unboxed-Software/solana-admin-instructions/tree/solution).

# Challenge

Ngayon ay oras na para gawin mo ang ilan sa mga ito nang mag-isa. Binanggit namin ang kakayahang magamit ang awtoridad sa pag-upgrade ng programa bilang paunang admin. Sige at i-update ang `initialize_program_config` ng demo upang ang awtoridad lamang sa pag-upgrade ang makakatawag dito sa halip na magkaroon ng hardcoded na `ADMIN`.

Tandaan na ang command na `anchor test`, kapag pinapatakbo sa isang lokal na network, ay magsisimula ng bagong test validator gamit ang `solana-test-validator`. Gumagamit ang test validator na ito ng non-upgradeable loader. Ginagawa ito ng hindi na-upgrade na loader upang hindi masimulan ang `program_data` account ng program kapag nagsimula ang validator. Maaalala mo mula sa aralin na ang account na ito ay kung paano namin naa-access ang awtoridad sa pag-upgrade mula sa programa.

Upang malutas ito, maaari kang magdagdag ng function na `deploy` sa test file na nagpapatakbo ng command sa pag-deploy para sa program na may naa-upgrade na loader. Upang magamit ito, patakbuhin ang `anchor test --skip-deploy`, at tawagan ang function na `deploy` sa loob ng pagsubok upang patakbuhin ang deploy command pagkatapos magsimula ang test validator.

```typescript
import { execSync } from "child_process"

...

const deploy = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/config-keypair.json $(pwd)/target/deploy/config.so`
  execSync(deployCmd)
}

...

before(async () => {
  ...
  deploy()
})
```

Halimbawa, ang utos na patakbuhin ang pagsubok na may mga tampok ay magiging ganito:

```
anchor test --skip-deploy -- --features "local-testing"
```

Subukang gawin ito nang mag-isa, ngunit kung natigil ka, huwag mag-atubiling sumangguni sa `challenge` na sangay ng [parehong repositoryo](https://github.com/Unboxed-Software/solana-admin-instructions/tree/challenge ) upang makita ang isang posibleng solusyon.

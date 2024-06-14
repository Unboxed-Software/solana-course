---
title: Anchor PDAs and Accounts
objectives:
- Gamitin ang mga hadlang sa `seeds` at `bump` upang gumana sa mga PDA account sa Anchor
- Paganahin at gamitin ang hadlang na `init_if_needed`
- Gamitin ang hadlang na `realloc` upang muling maglaan ng espasyo sa isang umiiral nang account
- Gamitin ang hadlang na `close` upang isara ang isang umiiral nang account
---

# TL;DR

- Ang `seeds` at `bump` na mga hadlang ay ginagamit upang simulan at patunayan ang mga PDA account sa Anchor
- Ang `init_if_needed` constraint ay ginagamit upang may kundisyon na magpasimula ng bagong account
- Ang hadlang na `realloc` ay ginagamit upang muling maglaan ng espasyo sa isang umiiral nang account
- Ginagamit ang `close` constraint upang isara ang isang account at i-refund ang renta nito

# Lesson

Sa araling ito, matututunan mo kung paano magtrabaho sa mga PDA, muling italaga ang mga account, at isara ang mga account sa Anchor.

Alalahanin na ang mga Anchor program ay naghihiwalay ng lohika ng pagtuturo mula sa pagpapatunay ng account. Pangunahing nangyayari ang pagpapatunay ng account sa loob ng mga istrukturang kumakatawan sa listahan ng mga account na kailangan para sa isang ibinigay na tagubilin. Ang bawat field ng struct ay kumakatawan sa ibang account, at maaari mong i-customize ang validation na ginawa sa account gamit ang `#[account(...)]` attribute macro.

Bilang karagdagan sa paggamit ng mga hadlang para sa pagpapatunay ng account, ang ilang mga hadlang ay maaaring humawak ng mga paulit-ulit na gawain na kung hindi man ay mangangailangan ng maraming boilerplate sa loob ng aming lohika ng pagtuturo. Ipakikilala ng araling ito ang mga hadlang sa `seeds`, `bump`, `realloc`, at `close` upang matulungan kang simulan at patunayan ang mga PDA, muling italaga ang mga account, at isara ang mga account.

## PDAs with Anchor

Tandaan na ang [mga PDA](https://github.com/Unboxed-Software/solana-course/blob/main/content/pda.md) ay hinango gamit ang isang listahan ng mga opsyonal na buto, bump seed, at program ID. Ang Anchor ay nagbibigay ng isang maginhawang paraan upang patunayan ang isang PDA na may mga hadlang na `seeds` at `bump`.

```rust
#[derive(Accounts)]
struct ExampleAccounts {
  #[account(
    seeds = [b"example_seed"],
    bump
  )]
  pub pda_account: Account<'info, AccountType>,
}
```

Sa panahon ng pagpapatunay ng account, kukuha ang Anchor ng PDA gamit ang mga binhing tinukoy sa hadlang sa `seeds` at i-verify na ang account na naipasa sa pagtuturo ay tumutugma sa PDA na natagpuan gamit ang tinukoy na `seeds`.

Kapag isinama ang hadlang na `bump` nang hindi tinukoy ang isang partikular na bump, magde-default ang Anchor sa paggamit ng canonical bump (ang unang bump na nagreresulta sa isang wastong PDA). Sa karamihan ng mga kaso dapat mong gamitin ang canonical bump.

Maaari mong i-access ang iba pang mga field mula sa loob ng struct mula sa mga hadlang, upang maaari mong tukuyin ang mga seed na umaasa sa iba pang mga account tulad ng pampublikong key ng pumirma.

Maaari mo ring i-reference ang deserialized instruction data kung idaragdag mo ang `#[instruction(...)]` attribute macro sa struct.

Halimbawa, ang sumusunod na halimbawa ay nagpapakita ng listahan ng mga account na kinabibilangan ng `pda_account` at `user`. Ang `pda_account` ay pinipigilan na ang mga buto ay dapat ang string na "example_seed," ang pampublikong key ng `user`, at ang string ay ipinasa sa pagtuturo bilang `instruction_data`.

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct Example<'info> {
    #[account(
        seeds = [b"example_seed", user.key().as_ref(), instruction_data.as_ref()],
        bump
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>
}
```

Kung ang `pda_account` na address na ibinigay ng kliyente ay hindi tumutugma sa PDA na hinango gamit ang tinukoy na mga buto at ang canonical bump, kung gayon ang pagpapatunay ng account ay mabibigo.

### Gumamit ng mga PDA na may hadlang na `init`

Maaari mong pagsamahin ang `seeds` at `bump` constraints sa `init` constraint upang simulan ang isang account gamit ang isang PDA.

Tandaan na ang hadlang na `init` ay dapat gamitin kasama ng mga hadlang sa `nagbabayad` at `space` upang tukuyin ang account na magbabayad para sa pagsisimula ng account at ang puwang na ilalaan sa bagong account. Bilang karagdagan, dapat mong isama ang `system_program` bilang isa sa mga field ng struct ng pagpapatunay ng account.

```rust
#[derive(Accounts)]
pub struct InitializePda<'info> {
    #[account(
        init,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + 8
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: u64,
}
```

Kapag gumagamit ng `init` para sa mga hindi PDA account, ang Anchor ay nagde-default sa pagtatakda sa may-ari ng inisyal na account upang maging program na kasalukuyang nagpapatupad ng pagtuturo.

Gayunpaman, kapag gumagamit ng `init` kasama ng `seeds` at `bump`, ang may-ari *ay dapat na ang executing program. Ito ay dahil ang pagsisimula ng isang account para sa PDA ay nangangailangan ng isang lagda na tanging ang executing program ang maaaring magbigay. Sa madaling salita, mabibigo ang signature verification para sa pagsisimula ng PDA account kung ang program ID na ginamit upang makuha ang PDA ay hindi tumugma sa program ID ng executing program.

Kapag tinutukoy ang halaga ng `space` para sa isang account na sinimulan at pagmamay-ari ng nagpapatupad na Anchor program, tandaan na ang unang 8 byte ay nakalaan para sa account discriminator. Ito ay isang 8-byte na halaga na kinakalkula at ginagamit ng Anchor upang matukoy ang mga uri ng account ng programa. Magagamit mo itong [reference](https://www.anchor-lang.com/docs/space) para kalkulahin kung gaano karaming espasyo ang dapat mong ilaan para sa isang account.

### Seed inference

Ang listahan ng account para sa isang pagtuturo ay maaaring maging talagang mahaba para sa ilang mga programa. Upang gawing simple ang karanasan sa panig ng kliyente kapag gumagamit ng pagtuturo ng Anchor program, maaari naming i-on ang seed inference.

Ang seed inference ay nagdaragdag ng impormasyon tungkol sa mga PDA seeds sa IDL upang ang Anchor ay makapag-infer ng mga PDA seed mula sa umiiral na impormasyon sa call-site. Sa nakaraang halimbawa, ang mga buto ay `b"example_seed"` at `user.key()`. Ang una ay static at samakatuwid ay kilala, at ang pangalawa ay kilala dahil ang `user` ay ang pumirma ng transaksyon.

Kung gumagamit ka ng seed inference kapag binubuo ang iyong program, hangga't tinatawagan mo ang program gamit ang Anchor, hindi mo kailangang tahasang kumuha at pumasa sa PDA. Sa halip, gagawin ito ng Anchor library para sa iyo.

Maaari mong i-on ang seed inference sa `Anchor.toml` file na may `seeds = true` sa ilalim ng `[features]`.

```
[features]
seeds = true
```

### Use the `#[instruction(...)]` attribute macro

Tingnan natin sandali ang `#[instruction(...)]` attribute macro bago magpatuloy. Kapag gumagamit ng `#[instruction(...)]`, ang data ng pagtuturo na ibibigay mo sa listahan ng mga argument ay dapat tumugma at nasa parehong pagkakasunud-sunod ng mga argumento ng pagtuturo. Maaari mong alisin ang mga hindi nagamit na argumento sa dulo ng listahan, ngunit dapat mong isama ang lahat ng argumento hanggang sa huling gagamitin mo.

Halimbawa, isipin na ang isang pagtuturo ay may mga argumento na `input_one`, `input_two`, at `input_three`. Kung ang iyong mga hadlang sa account ay kailangang sumangguni sa `input_one` at `input_three`, kailangan mong ilista ang lahat ng tatlong argument sa `#[instruction(...)]` attribute macro.

Gayunpaman, kung ang iyong mga hadlang ay tumutukoy lamang sa `input_one` at `input_two`, maaari mong alisin ang `input_three`.

```rust
pub fn example_instruction(
    ctx: Context<Example>,
    input_one: String,
    input_two: String,
    input_three: String,
) -> Result<()> {
    ...
    Ok(())
}

#[derive(Accounts)]
#[instruction(input_one:String, input_two:String)]
pub struct Example<'info> {
    ...
}
```

Bukod pa rito, magkakaroon ka ng error kung ililista mo ang mga input sa maling pagkakasunud-sunod:

```rust
#[derive(Accounts)]
#[instruction(input_two:String, input_one:String)]
pub struct Example<'info> {
    ...
}
```

## Init-if-needed

Nagbibigay ang Anchor ng hadlang na `init_if_needed` na maaaring magamit upang simulan ang isang account kung hindi pa nasisimulan ang account.

Naka-gate ang feature na ito sa likod ng feature flag para matiyak na sinadya mong gamitin ito. Para sa mga kadahilanang pangseguridad, matalinong iwasan ang pagkakaroon ng isang sangay ng pagtuturo sa maraming landas ng lohika. At gaya ng ipinahihiwatig ng pangalan, ang `init_if_needed` ay nagpapatupad ng isa sa dalawang posibleng path ng code depende sa estado ng account na pinag-uusapan.

Kapag gumagamit ng `init_if_needed`, kailangan mong tiyaking maayos na protektahan ang iyong programa laban sa mga pag-atake sa muling pagsisimula. Kailangan mong magsama ng mga tseke sa iyong code na nagsusuri na ang nasimulang account ay hindi mai-reset sa mga paunang setting nito pagkatapos ng unang pagkakataon na ito ay nasimulan.

Upang magamit ang `init_if_needed`, kailangan mo munang paganahin ang feature sa `Cargo.toml`.

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
```

Kapag na-enable mo na ang feature, maaari mong isama ang constraint sa `#[account(…)]` attribute macro. Ang halimbawa sa ibaba ay nagpapakita ng paggamit ng `init_if_needed` na hadlang upang simulan ang isang bagong nauugnay na token account kung wala pang isa.

```rust
#[program]
mod example {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
     #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
```

Kapag na-invoke ang `initialize` na pagtuturo sa nakaraang halimbawa, titingnan ng Anchor kung umiiral ang `token_account` at i-initialize ito kung wala. Kung mayroon na ito, magpapatuloy ang pagtuturo nang hindi sinisimulan ang account. Tulad ng `init` constraint, maaari mong gamitin ang `init_if_needed` kasabay ng `seeds` at `bump` kung ang account ay isang PDA.

## Realloc

Ang hadlang na `realloc` ay nagbibigay ng isang simpleng paraan upang muling maglaan ng espasyo para sa mga kasalukuyang account.

Ang `realloc` na hadlang ay dapat gamitin kasama ng mga sumusunod na hadlang:

- `mut` - dapat itakda ang account bilang nababago
- `realloc::payer` - ang account na ibawas o dagdagan ng mga lamport depende sa kung ang relokasyon ay bumababa o tumataas ang espasyo ng account
- `realloc::zero` - boolean upang tukuyin kung ang bagong memorya ay dapat na zero na nasimulan

Tulad ng `init`, dapat mong isama ang `system_program` bilang isa sa mga account sa validation struct ng account kapag gumagamit ng `realloc`.

Nasa ibaba ang isang halimbawa ng muling paglalagay ng espasyo para sa isang account na nag-iimbak ng field ng `data` na may uri ng `String`.

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct ReallocExample<'info> {
    #[account(
        mut,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        realloc = 8 + 4 + instruction_data.len(),
        realloc::payer = user,
        realloc::zero = false,
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: String,
}
```

Pansinin na ang `realloc` ay nakatakda sa `8 + 4 + instruction_data.len()`. Ito ay nahahati tulad ng sumusunod:
- Ang `8` ay para sa discriminator ng account
- Ang `4` ay para sa 4 na byte ng espasyo na ginagamit ng BORSH upang iimbak ang haba ng string
- Ang `instruction_data.len()` ay ang haba ng string mismo

Kung additive ang pagbabago sa haba ng data ng account, ililipat ang mga lampor mula sa `realloc::payer` sa account upang mapanatili ang exemption sa upa. Gayundin, kung subtractive ang pagbabago, ililipat ang mga lamport mula sa account pabalik sa `realloc::payer`.

Ang `realloc::zero` constraint ay kinakailangan upang matukoy kung ang bagong memory ay dapat na zero initialize pagkatapos ng muling paglalagay. Ang paghihigpit na ito ay dapat na itakda sa true sa mga kaso kung saan inaasahan mong ang memorya ng isang account ay lumiliit at lumawak nang maraming beses. Sa ganoong paraan, wala kang puwang na kung hindi man ay magpapakita bilang lipas na data.

## Close

Ang hadlang na `close` ay nagbibigay ng simple at secure na paraan upang isara ang isang umiiral nang account.

Ang hadlang na `close` ay minarkahan ang account bilang sarado sa dulo ng pagpapatupad ng tagubilin sa pamamagitan ng pagtatakda ng discriminator nito sa `CLOSED_ACCOUNT_DISCRIMINATOR` at ipinapadala ang mga lampor nito sa isang tinukoy na account. Ang pagtatakda ng discriminator sa isang espesyal na variant ay ginagawang imposible ang mga pag-atake ng muling pagkabuhay ng account (kung saan ang isang kasunod na tagubilin ay nagdaragdag ng pagbubukod sa renta muli) na imposible. Kung may sumubok na muling simulan ang account, ang muling pagsisimula ay mabibigo sa pagsusuri ng discriminator at ituring na hindi wasto ng programa.

Ang halimbawa sa ibaba ay gumagamit ng `close` constraint upang isara ang `data_account` at ipadala ang mga lamports na inilaan para sa upa sa `receiver` account.

```rust
pub fn close(ctx: Context<Close>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, AccountType>,
    #[account(mut)]
    pub receiver: Signer<'info>
}
```

# Demo

Sanayin natin ang mga konseptong napag-usapan natin sa araling ito sa pamamagitan ng paggawa ng programa sa Pagsusuri ng Pelikula gamit ang balangkas ng Anchor.

Ang program na ito ay magbibigay-daan sa mga user na:

- Gumamit ng isang PDA upang simulan ang isang bagong account sa pagsusuri ng pelikula upang iimbak ang pagsusuri
- I-update ang nilalaman ng isang umiiral na account sa pagsusuri ng pelikula
- Isara ang isang umiiral nang account sa pagsusuri ng pelikula

### 1. Create a new Anchor project

Upang magsimula, gumawa tayo ng bagong proyekto gamit ang `anchor init`.

```console
anchor init anchor-movie-review-program
```

Susunod, mag-navigate sa `lib.rs` file sa loob ng folder ng `programs` at dapat mong makita ang sumusunod na starter code.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
```

Sige at alisin ang `initialize` na pagtuturo at `Initialize` na uri.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}
```

### 2. `MovieAccountState`

Una, gamitin natin ang `#[account]` attribute macro para tukuyin ang `MovieAccountState` na kakatawan sa istruktura ng data ng mga account sa pagsusuri ng pelikula. Bilang paalala, ang macro ng attribute na `#[account]` ay nagpapatupad ng iba't ibang katangian na tumutulong sa serialization at deserialization ng account, itakda ang discriminator para sa account, at itakda ang may-ari ng bagong account bilang program ID na tinukoy sa `declare_id !` macro.

Sa loob ng bawat account sa pagsusuri ng pelikula, iimbak namin ang:

- `reviewer` - user na gumagawa ng review
- `rating` - rating para sa pelikula
- `title` - pamagat ng pelikula
- `paglalarawan` - nilalaman ng pagsusuri

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}

#[account]
pub struct MovieAccountState {
    pub reviewer: Pubkey,    // 32
    pub rating: u8,          // 1
    pub title: String,       // 4 + len()
    pub description: String, // 4 + len()
}
```

### 3. Add Movie Review

Susunod, ipatupad natin ang tagubiling `add_movie_review`. Ang tagubiling `add_movie_review` ay mangangailangan ng `Context` ng uri ng `AddMovieReview` na ipapatupad namin sa ilang sandali.

Mangangailangan ang pagtuturo ng tatlong karagdagang argumento bilang data ng pagtuturo na ibinigay ng isang reviewer:

- `title` - pamagat ng pelikula bilang `String`
- `description` - mga detalye ng review bilang `String`
- `rating` - rating para sa pelikula bilang `u8`

Sa loob ng lohika ng pagtuturo, ilalagay namin ang data ng bagong `movie_review` na account ng data ng pagtuturo. Itatakda din namin ang field ng `reviewer` bilang `initializer` account mula sa konteksto ng pagtuturo.

```rust
#[program]
pub mod movie_review{
    use super::*;

    pub fn add_movie_review(
        ctx: Context<AddMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("Movie Review Account Created");
        msg!("Title: {}", title);
        msg!("Description: {}", description);
        msg!("Rating: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.reviewer = ctx.accounts.initializer.key();
        movie_review.title = title;
        movie_review.rating = rating;
        movie_review.description = description;
        Ok(())
    }
}
```

Susunod, gawin natin ang `AddMovieReview` na struct na ginamit namin bilang generic sa konteksto ng pagtuturo. Ililista ng struct na ito ang mga account na kailangan ng tagubiling `add_movie_review`.

Tandaan, kakailanganin mo ang mga sumusunod na macro:

- Ang `#[derive(Accounts)]` macro ay ginagamit upang i-deserialize at patunayan ang listahan ng mga account na tinukoy sa loob ng struct
- Ang `#[instruction(...)]` attribute macro ay ginagamit upang i-access ang data ng pagtuturo na ipinasa sa pagtuturo
- Ang macro na katangian ng `#[account(...)]` pagkatapos ay tumutukoy ng mga karagdagang hadlang sa mga account

Ang `movie_review` account ay isang PDA na kailangang masimulan, kaya idaragdag namin ang `seeds` at `bump` constraints pati na rin ang `init` constraint kasama ang kinakailangang `payer` at `space` constraints.

Para sa mga binhi ng PDA, gagamitin namin ang pamagat ng pelikula at ang pampublikong susi ng tagasuri. Ang nagbabayad para sa pagsisimula ay dapat ang tagasuri, at ang puwang na nakalaan sa account ay dapat sapat para sa discriminator ng account, ang pampublikong susi ng reviewer, at ang rating, pamagat, at paglalarawan ng pagsusuri ng pelikula.

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct AddMovieReview<'info> {
    #[account(
        init,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 + 1 + 4 + title.len() + 4 + description.len()
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Update Movie Review

Susunod, ipatupad natin ang tagubiling `update_movie_review` na may konteksto na ang generic na uri ay `UpdateMovieReview`.

Gaya ng dati, mangangailangan ang pagtuturo ng tatlong karagdagang argumento bilang data ng pagtuturo na ibinigay ng isang reviewer:

- `title` - pamagat ng pelikula
- `paglalarawan` - mga detalye ng pagsusuri
- `rating` - rating para sa pelikula

Sa loob ng lohika ng pagtuturo, ia-update namin ang `rating` at `paglalarawan` na nakaimbak sa account na `review_pelikula`.

Bagama't hindi nagagamit ang `title` sa mismong instruction function, kakailanganin namin ito para sa pagpapatunay ng account ng `movie_review` sa susunod na hakbang.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn update_movie_review(
        ctx: Context<UpdateMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("Movie review account space reallocated");
        msg!("Title: {}", title);
        msg!("Description: {}", description);
        msg!("Rating: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.rating = rating;
        movie_review.description = description;

        Ok(())
    }

}
```

Susunod, gawin natin ang istrukturang `UpdateMovieReview` para tukuyin ang mga account na kailangan ng pagtuturo ng `update_movie_review`.

Dahil ang `movie_review` na account ay nasimulan na sa puntong ito, hindi na namin kailangan ang `init` constraint. Gayunpaman, dahil maaaring iba na ngayon ang halaga ng `paglalarawan`, kailangan naming gamitin ang hadlang na `realloc` upang muling italaga ang espasyo sa account. Kasama nito, kailangan natin ang `mut`, `realloc::payer`, at `realloc::zero` na mga hadlang.

Kakailanganin pa rin namin ang mga hadlang na `seeds` at `bump` gaya ng mayroon kami sa `AddMovieReview`.

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct UpdateMovieReview<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        realloc = 8 + 32 + 1 + 4 + title.len() + 4 + description.len(),
        realloc::payer = initializer,
        realloc::zero = true,
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

Tandaan na ang hadlang na `realloc` ay nakatakda sa bagong espasyo na kinakailangan ng `movie_review` account batay sa na-update na halaga ng `description`.

Bukod pa rito, ang hadlang na `realloc::payer` ay tumutukoy na ang anumang karagdagang mga lamport na kinakailangan o i-refund ay manggagaling o ipapadala sa `initializer` account.

Sa wakas, itinakda namin ang `realloc::zero` na hadlang sa `true` dahil ang `movie_review` na account ay maaaring ma-update nang maraming beses nang paliitin o palawakin ang espasyong nakalaan sa account.

### 5. Tanggalin ang Pagsusuri ng Pelikula

Panghuli, ipatupad natin ang tagubiling `delete_movie_review` para isara ang isang kasalukuyang account na `movie_review`.

Gagamit kami ng konteksto na ang generic na uri ay `DeleteMovieReview` at hindi magsasama ng anumang karagdagang data ng pagtuturo. Dahil nagsasara lang kami ng account, hindi talaga namin kailangan ang anumang lohika ng pagtuturo sa loob ng katawan ng function. Ang pagsasara mismo ay hahawakan ng Anchor constraint sa uri ng `DeleteMovieReview`.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn delete_movie_review(_ctx: Context<DeleteMovieReview>, title: String) -> Result<()> {
        msg!("Movie review for {} deleted", title);
        Ok(())
    }

}
```

Susunod, ipatupad natin ang `DeleteMovieReview` struct.

```rust
#[derive(Accounts)]
#[instruction(title: String)]
pub struct DeleteMovieReview<'info> {
    #[account(
        mut,
        seeds=[title.as_bytes(), initializer.key().as_ref()],
        bump,
        close=initializer
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>
}
```

Dito ginagamit namin ang `close` constraint upang tukuyin na isasara namin ang `movie_review` na account at na ang renta ay dapat ibalik sa `initializer` account. Kasama rin namin ang mga hadlang sa `seeds` at `bump` para sa `movie_review` account para sa pagpapatunay. Pagkatapos ay pinangangasiwaan ng Anchor ang karagdagang lohika na kinakailangan upang ligtas na isara ang account.

### 6. Pagsubok

Dapat maganda ang programa! Ngayon subukan natin ito. Mag-navigate sa `anchor-movie-review-program.ts` at palitan ang default na test code ng sumusunod.

Dito tayo:

- Lumikha ng mga default na halaga para sa data ng pagtuturo sa pagsusuri ng pelikula
- Kunin ang movie review account PDA
- Lumikha ng mga placeholder para sa mga pagsubok

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { assert, expect } from "chai"
import { AnchorMovieReviewProgram } from "../target/types/anchor_movie_review_program"

describe("anchor-movie-review-program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace
    .AnchorMovieReviewProgram as Program<AnchorMovieReviewProgram>

  const movie = {
    title: "Just a test movie",
    description: "Wow what a good movie it was real great",
    rating: 5,
  }

  const [moviePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  it("Movie review is added`", async () => {})

  it("Movie review is updated`", async () => {})

  it("Deletes a movie review", async () => {})
})
```

Susunod, gawin natin ang unang pagsubok para sa pagtuturo ng `addMovieReview`. Tandaan na hindi kami tahasang nagdaragdag ng `.accounts`. Ito ay dahil ang `Wallet` mula sa `AnchorProvider` ay awtomatikong kasama bilang isang pumirma, ang Anchor ay maaaring magpahiwatig ng ilang partikular na account tulad ng `SystemProgram`, at ang Anchor ay maaari ding maghinuha ng `movieReview` na PDA mula sa `title` na argumento ng pagtuturo at ang pampublikong key ng pumirma .

Kapag tumakbo na ang pagtuturo, kukunin namin ang `movieReview` na account at tingnan kung tumutugma ang data na nakaimbak sa account sa mga inaasahang halaga.

```typescript
it("Movie review is added`", async () => {
  // Add your test here.
  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(movie.title === account.title)
  expect(movie.rating === account.rating)
  expect(movie.description === account.description)
  expect(account.reviewer === provider.wallet.publicKey)
})
```

Susunod, gawin natin ang pagsubok para sa pagtuturo ng `updateMovieReview` na sumusunod sa parehong proseso tulad ng dati.

```typescript
it("Movie review is updated`", async () => {
  const newDescription = "Wow this is new"
  const newRating = 4

  const tx = await program.methods
    .updateMovieReview(movie.title, newDescription, newRating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(movie.title === account.title)
  expect(newRating === account.rating)
  expect(newDescription === account.description)
  expect(account.reviewer === provider.wallet.publicKey)
})
```

Susunod, gawin ang pagsubok para sa pagtuturo ng `deleteMovieReview`

```typescript
it("Deletes a movie review", async () => {
  const tx = await program.methods
    .deleteMovieReview(movie.title)
    .rpc()
})
```

Panghuli, patakbuhin ang `anchor test` at dapat mong makita ang sumusunod na output sa console.

```console
  anchor-movie-review-program
    ✔ Movie review is added` (139ms)
    ✔ Movie review is updated` (404ms)
    ✔ Deletes a movie review (403ms)


  3 passing (950ms)
```

Kung kailangan mo ng mas maraming oras sa proyektong ito para maging komportable sa mga konseptong ito, huwag mag-atubiling tingnan ang [solution code](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/ solution-pdas) bago magpatuloy.

# Challenge

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa. Gamit ang mga konseptong ipinakilala sa araling ito, subukang muling likhain ang Student Intro program na ginamit namin bago gamitin ang Anchor framework.

Ang Student Intro program ay isang Solana Program na nagbibigay-daan sa mga mag-aaral na magpakilala. Kinukuha ng program ang pangalan ng isang user at isang maikling mensahe bilang data ng pagtuturo at lumilikha ng isang account upang iimbak ang data na onchain.

Gamit ang iyong natutunan sa araling ito, buuin ang programang ito. Ang programa ay dapat magsama ng mga tagubilin sa:

1. Magsimula ng isang PDA account para sa bawat mag-aaral na nag-iimbak ng pangalan ng mag-aaral at ang kanilang maikling mensahe
2. I-update ang mensahe sa isang umiiral nang account
3. Isara ang isang umiiral nang account

Subukang gawin ito nang nakapag-iisa kung kaya mo! Ngunit kung natigil ka, huwag mag-atubiling sumangguni sa [solution code](https://github.com/Unboxed-Software/anchor-student-intro-program).
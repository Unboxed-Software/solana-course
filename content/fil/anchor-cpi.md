---
title: Anchor CPIs and Errors
objectives:
- Gumawa ng Cross Program Invocations (CPIs) mula sa isang Anchor program
- Gamitin ang feature na `cpi` upang makabuo ng mga function ng helper para sa pag-invoke ng mga tagubilin sa mga kasalukuyang Anchor program
- Gamitin ang `invoke` at `invoke_signed` upang gumawa ng mga CPI kung saan hindi available ang mga function ng CPI helper
- Lumikha at ibalik ang mga custom na Anchor error
---

# TL;DR

- Nagbibigay ang Anchor ng pinasimpleng paraan upang lumikha ng mga CPI gamit ang isang **`CpiContext`**
- Ang tampok na **`cpi`** ng Anchor ay bumubuo ng mga function ng katulong ng CPI para sa paggamit ng mga tagubilin sa mga umiiral na Anchor program
- Kung wala kang access sa mga function ng helper ng CPI, maaari mo pa ring gamitin ang `invoke` at `invoke_signed` nang direkta
- Ginagamit ang **`error_code`** attribute macro para gumawa ng custom na Anchor Error

# Lesson

Kung iisipin mo ang [unang CPI lesson](cpi.md), maaalala mo na ang paggawa ng mga CPI ay maaaring maging mahirap gamit ang vanilla Rust. Ang Anchor ay ginagawa itong medyo mas simple, lalo na kung ang program na iyong ginagamit ay isa ring Anchor program na ang crate ay maaari mong ma-access.

Sa araling ito, matututunan mo kung paano bumuo ng Anchor CPI. Matututuhan mo rin kung paano magtapon ng mga custom na error mula sa isang Anchor program para makapagsimula kang magsulat ng mas sopistikadong Anchor program.

## Cross Program Invocations (CPIs) with Anchor

Bilang isang refresher, pinapayagan ng mga CPI ang mga program na mag-invoke ng mga tagubilin sa iba pang mga program gamit ang mga function na `invoke` o `invoke_signed`. Nagbibigay-daan ito sa mga bagong programa na bumuo sa ibabaw ng mga kasalukuyang programa (tinatawag namin na composability).

Habang ang direktang paggawa ng mga CPI gamit ang `invoke` o `invoke_signed` ay isa pa ring opsyon, nagbibigay din ang Anchor ng pinasimpleng paraan upang gumawa ng mga CPI sa pamamagitan ng paggamit ng `CpiContext`.

Sa araling ito, gagamitin mo ang `anchor_spl` crate para gumawa ng mga CPI sa SPL Token Program. Maaari mong [tuklasin kung ano ang available sa `anchor_spl` crate](https://docs.rs/anchor-spl/latest/anchor_spl/#).

### `CpiContext`

Ang unang hakbang sa paggawa ng CPI ay gumawa ng instance ng `CpiContext`. Ang `CpiContext` ay halos kapareho sa `Context`, ang unang uri ng argumento na kinakailangan ng mga function ng Anchor instruction. Pareho silang idineklara sa parehong module at nagbabahagi ng magkatulad na pag-andar.

Ang uri ng `CpiContext` ay tumutukoy sa mga input na hindi argumento para sa mga cross program invocations:

- `accounts` - ang listahan ng mga account na kinakailangan para sa pagtuturo na ginagamit
- `remaining_accounts` - anumang natitirang account
- `program` - ang program ID ng program na ini-invoke
- `signer_seeds` - kung ang isang PDA ay pumipirma, isama ang mga buto na kinakailangan upang makuha ang PDA

```rust
pub struct CpiContext<'a, 'b, 'c, 'info, T>
where
    T: ToAccountMetas + ToAccountInfos<'info>,
{
    pub accounts: T,
    pub remaining_accounts: Vec<AccountInfo<'info>>,
    pub program: AccountInfo<'info>,
    pub signer_seeds: &'a [&'b [&'c [u8]]],
}
```

Gumagamit ka ng `CpiContext::new` upang bumuo ng bagong instance kapag nagpapasa sa orihinal na lagda ng transaksyon.

```rust
CpiContext::new(cpi_program, cpi_accounts)
```

```rust
pub fn new(
        program: AccountInfo<'info>,
        accounts: T
    ) -> Self {
    Self {
        accounts,
        program,
        remaining_accounts: Vec::new(),
        signer_seeds: &[],
    }
}
```

Gumagamit ka ng `CpiContext::new_with_signer` upang bumuo ng bagong instance kapag pumirma sa ngalan ng isang PDA para sa CPI.

```rust
CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds)
```

```rust
pub fn new_with_signer(
    program: AccountInfo<'info>,
    accounts: T,
    signer_seeds: &'a [&'b [&'c [u8]]],
) -> Self {
    Self {
        accounts,
        program,
        signer_seeds,
        remaining_accounts: Vec::new(),
    }
}
```

### CPI accounts

Ang isa sa mga pangunahing bagay tungkol sa `CpiContext` na nagpapasimple sa mga cross-program na invocation ay ang argumento ng `accounts` ay isang generic na uri na nagbibigay-daan sa iyong ipasa ang anumang bagay na gumagamit ng `ToAccountMetas` at `ToAccountInfos<'info>` na mga katangian.

Ang mga katangiang ito ay idinaragdag ng `#[derive(Accounts)]` na attribute na macro na ginamit mo noon noong gumagawa ng mga struct upang kumatawan sa mga account ng pagtuturo. Nangangahulugan iyon na maaari kang gumamit ng mga katulad na struct na may `CpiContext`.

Nakakatulong ito sa organisasyon ng code at kaligtasan ng uri.

### Invoke an instruction on another Anchor program

Kapag ang program na tinatawagan mo ay isang Anchor program na may naka-publish na crate, maaaring bumuo ang Anchor ng mga tagabuo ng pagtuturo at mga function ng CPI helper para sa iyo.

Ipahayag lang ang dependency ng iyong program sa program na tinatawagan mo sa `Cargo.toml` file ng iyong program gaya ng sumusunod:

```
[dependencies]
callee = { path = "../callee", features = ["cpi"]}
```

Sa pamamagitan ng pagdaragdag ng `features = ["cpi"]`, pinapagana mo ang feature na `cpi` at nagkakaroon ng access ang iyong program sa module na `callee::cpi`.

Inilalantad ng module ng `cpi` ang mga tagubilin ng `callee` bilang isang Rust function na kumukuha bilang argumento ng `CpiContext` at anumang karagdagang data ng pagtuturo. Ginagamit ng mga function na ito ang parehong format tulad ng mga function ng pagtuturo sa iyong mga Anchor program, gamit lang ang `CpiContext` sa halip na `Context`. Inilalantad din ng module na `cpi` ang mga istruktura ng account na kinakailangan para sa pagtawag sa mga tagubilin.

Halimbawa, kung ang `callee` ay may tagubilin na `do_something` na nangangailangan ng mga account na tinukoy sa `DoSomething` struct, maaari mong i-invoke ang `do_something` gaya ng sumusunod:

```rust
use anchor_lang::prelude::*;
use callee;
...

#[program]
pub mod lootbox_program {
    use super::*;

    pub fn call_another_program(ctx: Context<CallAnotherProgram>, params: InitUserParams) -> Result<()> {
        callee::cpi::do_something(
            CpiContext::new(
                ctx.accounts.callee.to_account_info(),
                callee::DoSomething {
                    user: ctx.accounts.user.to_account_info()
                }
            )
        )
        Ok(())
    }
}
...
```

### Invoke an instruction on a non-Anchor program

Kapag ang program na iyong tinatawagan ay *hindi* isang Anchor program, mayroong dalawang posibleng opsyon:

1. Posible na ang mga tagapangasiwa ng programa ay nag-publish ng isang crate na may sarili nilang mga function ng helper para sa pagtawag sa kanilang programa. Halimbawa, ang `anchor_spl` crate ay nagbibigay ng mga function ng helper na halos magkapareho mula sa pananaw ng call-site sa kung ano ang makukuha mo sa `cpi` na module ng isang Anchor program. Hal. maaari kang mag-mint gamit ang [`mint_to` helper function](https://docs.rs/anchor-spl/latest/src/anchor_spl/token.rs.html#36-58) at gamitin ang [`MintTo` accounts struct ](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.MintTo.html).
    ```rust
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.mint_account.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[&[
                "mint".as_bytes(),
                &[*ctx.bumps.get("mint_authority").unwrap()],
            ]]
        ),
        amount,
    )?;
    ```
2. Kung walang helper module para sa program na ang (mga) tagubilin ay kailangan mong i-invoke, maaari kang bumalik sa paggamit ng `invoke` at `invoke_signed`. Sa katunayan, ang source code ng `mint_to` helper function na binanggit sa itaas ay nagpapakita ng isang halimbawa sa amin gamit ang `invoke_signed` kapag binigyan ng `CpiContext`. Maaari mong sundin ang isang katulad na pattern kung magpasya kang gumamit ng isang account struct at `CpiContext` upang ayusin at ihanda ang iyong CPI.
    ```rust
    pub fn mint_to<'a, 'b, 'c, 'info>(
        ctx: CpiContext<'a, 'b, 'c, 'info, MintTo<'info>>,
        amount: u64,
    ) -> Result<()> {
        let ix = spl_token::instruction::mint_to(
            &spl_token::ID,
            ctx.accounts.mint.key,
            ctx.accounts.to.key,
            ctx.accounts.authority.key,
            &[],
            amount,
        )?;
        solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.to.clone(),
                ctx.accounts.mint.clone(),
                ctx.accounts.authority.clone(),
            ],
            ctx.signer_seeds,
        )
        .map_err(Into::into)
    }
    ```

## Throw errors in Anchor

Malalim na kami sa Anchor sa puntong ito na mahalagang malaman kung paano gumawa ng mga custom na error.

Sa huli, ibinabalik ng lahat ng program ang parehong uri ng error: [`ProgramError`](https://docs.rs/solana-program/latest/solana_program/program_error/enum.ProgramError.html). Gayunpaman, kapag nagsusulat ng isang programa gamit ang Anchor maaari mong gamitin ang `AnchorError` bilang abstraction sa ibabaw ng `ProgramError`. Ang abstraction na ito ay nagbibigay ng karagdagang impormasyon kapag nabigo ang isang programa, kabilang ang:

- Ang pangalan at numero ng error
- Lokasyon sa code kung saan itinapon ang error
- Ang account na lumabag sa isang hadlang

```rust
pub struct AnchorError {
    pub error_name: String,
    pub error_code_number: u32,
    pub error_msg: String,
    pub error_origin: Option<ErrorOrigin>,
    pub compared_values: Option<ComparedValues>,
}
```

Ang mga Anchor Error ay maaaring nahahati sa:

- Anchor Internal Error na ibinabalik ng framework mula sa loob ng sarili nitong code
- Mga custom na error na maaaring gawin ng developer

Maaari kang magdagdag ng mga error na natatangi sa iyong program sa pamamagitan ng paggamit ng attribute na `error_code`. Idagdag lang ang attribute na ito sa isang custom na uri ng `enum`. Pagkatapos ay maaari mong gamitin ang mga variant ng `enum` bilang mga error sa iyong program. Bukod pa rito, maaari kang magdagdag ng mensahe ng error sa bawat variant gamit ang attribute na `msg`. Maaaring ipakita ng mga kliyente ang mensahe ng error na ito kung nangyari ang error.

```rust
#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

Upang magbalik ng custom na error, maaari mong gamitin ang [err](https://docs.rs/anchor-lang/latest/anchor_lang/macro.err.html) o ang [err](https://docs.rs/anchor-lang/latest/anchor_lang/prelude/macro.error.html) macro mula sa isang function ng pagtuturo. Ang mga ito ay nagdaragdag ng file at impormasyon ng linya sa error na pagkatapos ay naka-log sa pamamagitan ng Anchor upang matulungan ka sa pag-debug.

```rust
#[program]
mod hello_anchor {
    use super::*;
    pub fn set_data(ctx: Context<SetData>, data: MyAccount) -> Result<()> {
        if data.data >= 100 {
            return err!(MyError::DataTooLarge);
        }
        ctx.accounts.my_account.set_inner(data);
        Ok(())
    }
}

#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

Bilang kahalili, maaari mong gamitin ang [require](https://docs.rs/anchor-lang/latest/anchor_lang/macro.require.html) macro para pasimplehin ang mga bumabalik na error. Ang code sa itaas ay maaaring i-refactor sa sumusunod:

```rust
#[program]
mod hello_anchor {
    use super::*;
    pub fn set_data(ctx: Context<SetData>, data: MyAccount) -> Result<()> {
        require!(data.data < 100, MyError::DataTooLarge);
        ctx.accounts.my_account.set_inner(data);
        Ok(())
    }
}

#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

# Demo

Sanayin natin ang mga konseptong napag-usapan natin sa araling ito sa pamamagitan ng pagbuo sa ibabaw ng programa ng Pagsusuri ng Pelikula mula sa mga nakaraang aralin.

Sa demo na ito, ia-update namin ang program para mag-mint ng mga token sa mga user kapag nagsumite sila ng bagong review ng pelikula.

### 1. Starter

Upang makapagsimula, gagamitin natin ang huling estado ng programa ng Anchor Movie Review mula sa nakaraang aralin. Kaya, kung kakatapos mo lang ng araling iyon, handa ka nang umalis. Kung papasok ka lang dito, huwag mag-alala, maaari mong [i-download ang starter code](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas). Gagamitin namin ang sangay ng `solution-pdas` bilang aming panimulang punto.

### 2. Add dependencies to `Cargo.toml`

Bago tayo magsimula, kailangan nating paganahin ang feature na `init-if-needed` at idagdag ang `anchor-spl` crate sa mga dependencies sa `Cargo.toml`. Kung kailangan mong mag-ayos sa feature na `init-if-needed`, tingnan ang [Anchor PDAs and Accounts lesson](anchor-pdas.md).

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
anchor-spl = "0.25.0"
```

### 3. Initialize reward token

Susunod, mag-navigate sa `lib.rs` at gumawa ng tagubilin para makapagsimula ng bagong token mint. Ito ang magiging token na mined sa tuwing ang isang user ay umalis ng isang review. Tandaan na hindi namin kailangang isama ang anumang custom na lohika ng pagtuturo dahil ang pagsisimula ay maaaring ganap na mahawakan sa pamamagitan ng mga hadlang sa Anchor.

```rust
pub fn initialize_token_mint(_ctx: Context<InitializeMint>) -> Result<()> {
    msg!("Token mint initialized");
    Ok(())
}
```

Ngayon, ipatupad ang uri ng konteksto na `InitializeMint` at ilista ang mga account at mga hadlang na kinakailangan ng pagtuturo. Dito namin sinisimulan ang isang bagong `Mint` account gamit ang isang PDA na may string na "mint" bilang isang binhi. Tandaan na maaari naming gamitin ang parehong PDA para sa parehong address ng `Mint` account at ang awtoridad ng mint. Ang paggamit ng PDA bilang awtoridad ng mint ay nagbibigay-daan sa aming programa na mag-sign para sa pag-minting ng mga token.

Upang masimulan ang `Mint` account, kakailanganin naming isama ang `token_program`, `rent`, at `system_program` sa listahan ng mga account.
```rust
#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        seeds = ["mint".as_bytes()],
        bump,
        payer = user,
        mint::decimals = 6,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>
}
```

Maaaring may ilang mga hadlang sa itaas na hindi mo pa nakikita. Ang pagdaragdag ng `mint::decimals` at `mint::authority` kasama ng `init` ay nagsisiguro na ang account ay masisimulan bilang isang bagong token mint na may naaangkop na mga decimal at mint authority set.

### 4. Anchor Error

Susunod, gumawa tayo ng Anchor Error na gagamitin natin kapag pinapatunayan ang `rating` na ipinasa sa alinman sa `add_movie_review` o `update_movie_review` na pagtuturo.

```rust
#[error_code]
enum MovieReviewError {
    #[msg("Rating must be between 1 and 5")]
    InvalidRating
}
```

### 5. Update `add_movie_review` instruction

Ngayong nakagawa na tayo ng ilang setup, i-update natin ang pagtuturo ng `add_movie_review` at uri ng konteksto ng `AddMovieReview` upang mag-mint ng mga token sa reviewer.

Susunod, i-update ang uri ng konteksto ng `AddMovieReview` upang idagdag ang mga sumusunod na account:

- `token_program` - gagamitin namin ang Token Program para mag-mint ng mga token
- `mint` - ang mint account para sa mga token na ibibigay namin sa mga user kapag nagdagdag sila ng review ng pelikula
- `token_account` - ang nauugnay na token account para sa nabanggit na `mint` at reviewer
- `associated_token_program` - kinakailangan dahil gagamitin namin ang `associated_token` constraint sa `token_account`
- `rent` - kailangan dahil ginagamit namin ang `init-if-needed` constraint sa `token_account`

```rust
#[derive(Accounts)]
#[instruction(title: String, description: String)]
pub struct AddMovieReview<'info> {
    #[account(
        init,
        seeds=[title.as_bytes(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 + 1 + 4 + title.len() + 4 + description.len()
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
    // ADDED ACCOUNTS BELOW
    pub token_program: Program<'info, Token>,
    #[account(
        seeds = ["mint".as_bytes()]
        bump,
        mut
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = initializer,
        associated_token::mint = mint,
        associated_token::authority = initializer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>
}
```

Muli, ang ilan sa mga hadlang sa itaas ay maaaring hindi pamilyar sa iyo. Ang mga hadlang na `associated_token::mint` at `associated_token::authority` kasama ang `init_if_needed` na kung hindi pa nasisimulan ang account, ito ay pasisimulan bilang nauugnay na token account para sa tinukoy na mint at awtoridad.

Susunod, i-update natin ang tagubiling `add_movie_review` para gawin ang sumusunod:

- Suriin na ang `rating` ay wasto. Kung ito ay hindi wastong rating, ibalik ang `InvalidRating` na error.
- Gumawa ng CPI sa pagtuturo ng `mint_to` ng token program gamit ang mint authority PDA bilang isang pumirma. Tandaan na gagawa kami ng 10 token sa user ngunit kailangan naming mag-adjust para sa mint decimal sa pamamagitan ng paggawa nitong `10*10^6`.

Sa kabutihang palad, maaari naming gamitin ang `anchor_spl` crate upang ma-access ang mga function at uri ng helper tulad ng `mint_to` at `MintTo` para sa pagbuo ng aming CPI sa Token Program. Ang `mint_to` ay kumukuha ng `CpiContext` at integer bilang mga argumento, kung saan kinakatawan ng integer ang bilang ng mga token na gagawin. Maaaring gamitin ang `MintTo` para sa listahan ng mga account na kailangan ng pagtuturo ng mint.

```rust
pub fn add_movie_review(ctx: Context<AddMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Movie review account created");
    msg!("Title: {}", title);
    msg!("Description: {}", description);
    msg!("Rating: {}", rating);

    require!(rating >= 1 && rating <= 5, MovieReviewError::InvalidRating);

    let movie_review = &mut ctx.accounts.movie_review;
    movie_review.reviewer = ctx.accounts.initializer.key();
    movie_review.title = title;
    movie_review.description = description;
    movie_review.rating = rating;

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                authority: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info()
            },
            &[&[
                "mint".as_bytes(),
                &[*ctx.bumps.get("mint").unwrap()]
            ]]
        ),
        10*10^6
    )?;

    msg!("Minted tokens");

    Ok(())
}
```

### 6. Update `update_movie_review` instruction

Dito ay idinaragdag lamang namin ang tseke na ang `rating` ay wasto.

```rust
pub fn update_movie_review(ctx: Context<UpdateMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Movie review account space reallocated");
    msg!("Title: {}", title);
    msg!("Description: {}", description);
    msg!("Rating: {}", rating);

    require!(rating >= 1 && rating <= 5, MovieReviewError::InvalidRating);

    let movie_review = &mut ctx.accounts.movie_review;
    movie_review.description = description;
    movie_review.rating = rating;

    Ok(())
}
```

### 7. Test

Iyan ang lahat ng mga pagbabagong kailangan nating gawin sa programa! Ngayon, i-update natin ang aming mga pagsubok.

Magsimula sa pamamagitan ng pagtiyak na ganito ang hitsura ng iyong pag-import nad `describe` function:

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token"
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

  const [movie_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
  )
...
}
```

With that done, add a test for the `initializeTokenMint` instruction:

```typescript
it("Initializes the reward token", async () => {
    const tx = await program.methods.initializeTokenMint().rpc()
})
```

Pansinin na hindi namin kinailangang magdagdag ng `.accounts` dahil ang tawag nila ay inferred, kasama ang `mint` account (ipagpalagay na pinagana mo ang seed inference).

Susunod, i-update ang pagsubok para sa pagtuturo ng `addMovieReview`. Ang mga pangunahing karagdagan ay:
1. Upang makuha ang nauugnay na address ng token na kailangang ipasa sa pagtuturo bilang isang account na hindi mahihinuha
2. Tingnan sa dulo ng pagsubok na ang nauugnay na token account ay may 10 token

```typescript
it("Movie review is added`", async () => {
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    provider.wallet.publicKey
  )
  
  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .accounts({
      tokenAccount: tokenAccount,
    })
    .rpc()
  
  const account = await program.account.movieAccountState.fetch(movie_pda)
  expect(movie.title === account.title)
  expect(movie.rating === account.rating)
  expect(movie.description === account.description)
  expect(account.reviewer === provider.wallet.publicKey)

  const userAta = await getAccount(provider.connection, tokenAccount)
  expect(Number(userAta.amount)).to.equal((10 * 10) ^ 6)
})
```

Pagkatapos noon, hindi na kailangan ng pagsubok para sa `updateMovieReview` o ang pagsubok para sa `deleteMovieReview` ng anumang mga pagbabago.

Sa puntong ito, patakbuhin ang `anchor test` at dapat mong makita ang sumusunod na output

```console
anchor-movie-review-program
    ✔ Initializes the reward token (458ms)
    ✔ Movie review is added (410ms)
    ✔ Movie review is updated (402ms)
    ✔ Deletes a movie review (405ms)

  5 passing (2s)
```

Kung kailangan mo ng mas maraming oras sa mga konsepto mula sa araling ito o natigil ka, huwag mag-atubiling tingnan ang [code ng solusyon](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-add-tokens). Tandaan na ang solusyon sa demo na ito ay nasa `solution-add-tokens` branch.

# Challenge

Upang mailapat ang iyong natutunan tungkol sa mga CPI sa araling ito, pag-isipan kung paano mo maaaring isama ang mga ito sa programa ng Student Intro. Maaari kang gumawa ng isang bagay na katulad ng ginawa namin sa demo dito at magdagdag ng ilang functionality sa mga mint token sa mga user kapag ipinakilala nila ang kanilang mga sarili.

Subukang gawin ito nang nakapag-iisa kung kaya mo! Ngunit kung natigil ka, huwag mag-atubiling i-reference itong [solution code](https://github.com/Unboxed-Software/anchor-student-intro-program/tree/cpi-challenge). Tandaan na maaaring bahagyang iba ang hitsura ng iyong code kaysa sa code ng solusyon depende sa iyong pagpapatupad.

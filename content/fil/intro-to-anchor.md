---
title: Intro to Anchor development
objectives:
- Gamitin ang balangkas ng Anchor upang bumuo ng isang pangunahing programa
- Ilarawan ang pangunahing istruktura ng isang Anchor program
- Ipaliwanag kung paano ipatupad ang pangunahing pagpapatunay ng account at mga pagsusuri sa seguridad sa Anchor
---

# TL;DR

- **Anchor** ay isang balangkas para sa pagbuo ng mga programang Solana
- **Anchor macros** ay nagpapabilis sa proseso ng pagbuo ng mga programang Solana sa pamamagitan ng pag-abstract ng malaking halaga ng boilerplate code
- Binibigyang-daan ka ng Anchor na bumuo ng **mga secure na programa** nang mas madali sa pamamagitan ng pagsasagawa ng ilang partikular na pagsusuri sa seguridad, nangangailangan ng pagpapatunay ng account, at pagbibigay ng simpleng paraan upang magpatupad ng mga karagdagang pagsusuri.

# Lesson

## What is Anchor?

Ang Anchor ay isang development framework na ginagawang mas madali, mas mabilis, at mas secure ang pagsusulat ng mga programang Solana. Ito ang balangkas na "pumunta sa" para sa pagbuo ng Solana para sa napakagandang dahilan. Ginagawa nitong mas madali ang pag-aayos at pangangatwiran tungkol sa iyong code, awtomatikong nagpapatupad ng mga karaniwang pagsusuri sa seguridad, at nag-aalis ng malaking halaga ng boilerplate na nauugnay sa pagsusulat ng isang programang Solana.

## Anchor program structure

Gumagamit ang Anchor ng mga macro at katangian para bumuo ng boilerplate Rust code para sa iyo. Nagbibigay ang mga ito ng malinaw na istraktura sa iyong programa upang mas madali kang mangatuwiran tungkol sa iyong code. Ang pangunahing mataas na antas ng mga macro at katangian ay:

- `declare_id` - isang macro para sa pagdedeklara ng onchain address ng program
- `#[program]` - isang attribute macro na ginagamit upang tukuyin ang module na naglalaman ng lohika ng pagtuturo ng program
- `Mga Account` - isang katangiang inilapat sa mga istruktura na kumakatawan sa listahan ng mga account na kinakailangan para sa isang pagtuturo
- `#[account]` - isang attribute na macro na ginagamit upang tukuyin ang mga custom na uri ng account para sa program

Pag-usapan natin ang bawat isa sa kanila bago pagsamahin ang lahat ng mga piraso.

## Declare your program ID

Ang `declare_id` macro ay ginagamit upang tukuyin ang onchain na address ng program (i.e. ang `programId`). Kapag bumuo ka ng Anchor program sa unang pagkakataon, bubuo ang framework ng bagong keypair. Ito ang nagiging default na keypair na ginamit upang i-deploy ang program maliban kung tinukoy kung hindi man. Ang kaukulang pampublikong key ay dapat gamitin bilang `programId` na tinukoy sa `declare_id!` na macro.

```rust
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
```

## Define instruction logic

Tinutukoy ng `#[program]` attribute macro ang module na naglalaman ng lahat ng mga tagubilin ng iyong program. Dito mo ipinapatupad ang lohika ng negosyo para sa bawat pagtuturo sa iyong programa.

Ang bawat pampublikong function sa module na may attribute na `#[program]` ay ituturing bilang isang hiwalay na pagtuturo.

Ang bawat function ng pagtuturo ay nangangailangan ng isang parameter ng uri ng `Konteksto` at maaaring opsyonal na magsama ng mga karagdagang parameter ng function na kumakatawan sa data ng pagtuturo. Awtomatikong hahawakan ng Anchor ang deserialization ng data ng pagtuturo para magawa mo ang data ng pagtuturo bilang mga uri ng Rust.

```rust
#[program]
mod program_module_name {
    use super::*;

    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}
```

### Instruction `Context`

Inilalantad ng uri ng `Konteksto` ang metadata ng pagtuturo at mga account sa iyong lohika ng pagtuturo.

```rust
pub struct Context<'a, 'b, 'c, 'info, T> {
    /// Currently executing program id.
    pub program_id: &'a Pubkey,
    /// Deserialized accounts.
    pub accounts: &'b mut T,
    /// Remaining accounts given but not deserialized or validated.
    /// Be very careful when using this directly.
    pub remaining_accounts: &'c [AccountInfo<'info>],
    /// Bump seeds found during constraint validation. This is provided as a
    /// convenience so that handlers don't have to recalculate bump seeds or
    /// pass them in as arguments.
    pub bumps: BTreeMap<String, u8>,
}
```

Ang `Context` ay isang generic na uri kung saan ang `T` ay tumutukoy sa listahan ng mga account na kailangan ng isang pagtuturo. Kapag gumamit ka ng `Context`, tutukuyin mo ang kongkretong uri ng `T` bilang isang struct na gumagamit ng katangian ng `Accounts` (hal. `Context<AddMovieReviewAccounts>`). Sa pamamagitan ng argumentong ito sa konteksto, maa-access ng pagtuturo ang:

- Ang mga account na ipinasa sa pagtuturo (`ctx.accounts`)
- Ang program ID (`ctx.program_id`) ng executing program
- Ang natitirang mga account (`ctx.remaining_accounts`). Ang `remaining_accounts` ay isang vector na naglalaman ng lahat ng account na naipasa sa pagtuturo ngunit hindi idineklara sa `Mga Account` struct.
- Ang mga bumps para sa anumang PDA account sa `Accounts` struct (`ctx.bumps`)


## Define instruction accounts

Ang katangian ng `Mga Account` ay tumutukoy sa istruktura ng data ng mga na-validate na account. Tinutukoy ng mga istrukturang gumagamit ng katangiang ito ang listahan ng mga account na kinakailangan para sa isang ibinigay na pagtuturo. Ang mga account na ito ay malalantad sa pamamagitan ng `Konteksto` ng isang tagubilin upang hindi na kailangan ang manu-manong pag-ulit ng account at deserialization.

Karaniwan mong inilalapat ang katangian ng `Mga Account` sa pamamagitan ng macro na `derive` (hal. `#[derive(Accounts)]`). Nagpapatupad ito ng deserializer na `Mga Account` sa ibinigay na struct at inaalis ang pangangailangang manual na i-deserialize ang bawat account.

Ang mga pagpapatupad ng katangian ng `Mga Account` ay may pananagutan sa pagsasagawa ng lahat ng kinakailangang pagsusuri sa hadlang upang matiyak na ang mga account ay nakakatugon sa mga kundisyon na kinakailangan para sa programa na tumakbo nang ligtas. Ang mga hadlang ay ibinibigay para sa bawat field gamit ang `#account(..)` attribute (higit pa tungkol doon sa ilang sandali).

Halimbawa, ang `instruction_one` ay nangangailangan ng `Context` na argument na may uri ng `InstructionAccounts`. Ang `#[derive(Accounts)]` macro ay ginagamit upang ipatupad ang `InstructionAccounts` struct na kinabibilangan ng tatlong account: `account_name`, `user`, at `system_program`.

```rust
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		...
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}
```

Kapag na-invoke ang `instruction_one`, ang program ay:

- Sinusuri kung ang mga account na ipinasa sa pagtuturo ay tumutugma sa mga uri ng account na tinukoy sa `InstructionAccounts` struct
- Sinusuri ang mga account laban sa anumang karagdagang mga hadlang na tinukoy

Kung ang anumang mga account na ipinasa sa `instruction_one` ay nabigo sa pagpapatunay ng account o mga pagsusuri sa seguridad na tinukoy sa `InstructionAccounts` struct, kung gayon ang pagtuturo ay nabigo bago pa man maabot ang logic ng programa.

## Kumpirmasyon ng account

Maaaring napansin mo sa nakaraang halimbawa na ang isa sa mga account sa `InstructionAccounts` ay may uri ng `Account`, ang isa ay may uri ng `Signer`, at ang isa ay may uri ng `Program`.

Nagbibigay ang Anchor ng ilang uri ng account na maaaring gamitin upang kumatawan sa mga account. Ang bawat uri ay nagpapatupad ng iba't ibang pagpapatunay ng account. Tatalakayin namin ang ilan sa mga karaniwang uri na maaari mong makaharap, ngunit tiyaking tingnan ang [buong listahan ng mga uri ng account](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/index.html).

### `Account`

Ang `Account` ay isang wrapper sa paligid ng `AccountInfo` na nagbe-verify ng pagmamay-ari ng program at nagde-deserialize ng pinagbabatayan na data sa isang uri ng Rust.

```rust
// Deserializes this info
pub struct AccountInfo<'a> {
    pub key: &'a Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
    pub lamports: Rc<RefCell<&'a mut u64>>,
    pub data: Rc<RefCell<&'a mut [u8]>>,    // <---- deserializes account data
    pub owner: &'a Pubkey,    // <---- checks owner program
    pub executable: bool,
    pub rent_epoch: u64,
}
```

Alalahanin ang nakaraang halimbawa kung saan ang `InstructionAccounts` ay may field na `account_name`:

```rust
pub account_name: Account<'info, AccountStruct>
```

Ginagawa ng `Account` wrapper dito ang sumusunod:

- Deserializes ang account `data` sa format ng uri `AccountStruct`
- Sinusuri kung ang may-ari ng programa ng account ay tumutugma sa may-ari ng program na tinukoy para sa uri ng `AccountStruct`.

Kapag ang uri ng account na tinukoy sa `Account` wrapper ay tinukoy sa loob ng parehong crate gamit ang `#[account]` attribute macro, ang pagsusuri sa pagmamay-ari ng program ay laban sa `programId` na tinukoy sa `declare_id!` na macro.

Ang mga sumusunod ay ang mga pagsusuring isinagawa:

```rust
// Checks
Account.info.owner == T::owner()
!(Account.info.owner == SystemProgram && Account.info.lamports() == 0)
```

### `Signer`

Ang uri ng `Signer` ay nagpapatunay na nilagdaan ng ibinigay na account ang transaksyon. Walang ibang pagmamay-ari o uri ng pagsusuri ang ginagawa. Dapat mo lang gamitin ang `Signer` kapag hindi kinakailangan ang pinagbabatayan na data ng account sa pagtuturo.

Para sa `user` account sa nakaraang halimbawa, ang uri ng `Signer` ay tumutukoy na ang `user` na account ay dapat na lumagda sa pagtuturo.

Ang sumusunod na pagsusuri ay isinasagawa para sa iyo:

```rust
// Checks
Signer.info.is_signer == true
```

### `Program`

Ang uri ng `Program` ay nagpapatunay na ang account ay isang partikular na programa.

Para sa account na `system_program` sa nakaraang halimbawa, ang uri ng `Program` ay ginagamit upang tukuyin ang program ay dapat ang system program. Nagbibigay ang Anchor ng uri ng `System` na kinabibilangan ng `programId` ng system program na susuriin.

Ang mga sumusunod na pagsusuri ay ginagawa para sa iyo:

```rust
//Checks
account_info.key == expected_program
account_info.executable == true
```

## Add constraints with `#[account(..)]`

Ginagamit ang `#[account(..)]` attribute macro para maglapat ng mga hadlang sa mga account. Tatalakayin natin ang ilang halimbawa ng hadlang sa mga aralin na ito at sa hinaharap, ngunit tiyaking tingnan ang buong [listahan ng mga posibleng hadlang](https://docs.rs/anchor-lang/latest/anchor_lang/derive .Accounts.html).

Recall muli ang field na `account_name` mula sa halimbawa ng `InstructionAccounts`.

```rust
#[account(init, payer = user, space = 8 + 8)]
pub account_name: Account<'info, AccountStruct>,
#[account(mut)]
pub user: Signer<'info>,
```

Pansinin na ang `#[account(..)]` attribute ay naglalaman ng tatlong comma-separated values:

- `init` - nililikha ang account sa pamamagitan ng CPI sa system program at sinisimulan ito (nagtatakda ng discriminator ng account nito)
- `payer` - tumutukoy sa nagbabayad para sa pagsisimula ng account upang maging `user` na account na tinukoy sa struct
- Ang `space`- ay tumutukoy na ang space na inilaan para sa account ay dapat na `8 + 8` bytes. Ang unang 8 byte ay para sa isang discriminator na awtomatikong idinaragdag ng Anchor upang matukoy ang uri ng account. Ang susunod na 8 byte ay naglalaan ng espasyo para sa data na nakaimbak sa account gaya ng tinukoy sa uri ng `AccountStruct`.

Para sa `user` ginagamit namin ang attribute na `#[account(..)]` para tukuyin na ang ibinigay na account ay mutable. Ang `user` account ay dapat mamarkahan bilang mutable dahil ang mga lampor ay ibabawas mula sa account upang bayaran ang pagsisimula ng `account_name`.

```rust
#[account(mut)]
pub user: Signer<'info>,
```

Tandaan na ang `init` constraint na inilagay sa `account_name` ay awtomatikong may kasamang `mut` constraint upang ang `account_name` at `user` ay mga nababagong account.

## `#[account]`

Inilapat ang attribute na `#[account]` sa mga struct na kumakatawan sa istruktura ng data ng isang Solana account. Ipinapatupad nito ang mga sumusunod na katangian:

- `AccountSerialize`
- `AccountDeserialize`
- `AnchorSerialize`
- `AnchorDeserialize`
- `Clone`
- `Discriminator`
- `Owner`

Maaari kang magbasa nang higit pa tungkol sa [mga detalye ng bawat katangian](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html). Gayunpaman, higit sa lahat ang kailangan mong malaman ay na ang `#[account]` na katangian ay nagbibigay-daan sa serialization at deserialization, at nagpapatupad ng mga katangian ng discriminator at may-ari para sa isang account.

Ang discriminator ay isang 8 byte na natatanging identifier para sa isang uri ng account na nagmula sa unang 8 byte ng SHA256 hash ng pangalan ng uri ng account. Kapag nagpapatupad ng mga katangian ng serialization ng account, ang unang 8 byte ay nakalaan para sa discriminator ng account.

Bilang resulta, susuriin ng anumang mga tawag sa `AccountDeserialize` `try_deserialize` ang discriminator na ito. Kung hindi ito tumugma, nagbigay ng di-wastong account, at lalabas ang deserialization ng account nang may error.

Ang `#[account]` attribute ay nagpapatupad din ng `Owner` trait para sa isang struct gamit ang `programId` na idineklara ng `declareId` ng crate `#[account]` ay ginagamit sa. Sa madaling salita, lahat ng account ay sinimulan gamit ang isang uri ng account na tinukoy gamit ang `#[account]` attribute sa loob ng program ay pagmamay-ari din ng program.

Bilang halimbawa, tingnan natin ang `AccountStruct` na ginamit ng `account_name` ng `InstructionAccounts`

```rust
#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    ...
}

#[account]
pub struct AccountStruct {
    data: u64
}
```

Tinitiyak ng `#[account]` attribute na magagamit ito bilang account sa `InstructionAccounts`.

Kapag nasimulan ang `account_name` na account:

- Ang unang 8 byte ay itinakda bilang `AccountStruct` discriminator
- Tutugma ang field ng data ng account sa `AccountStruct`
- Ang may-ari ng account ay itinakda bilang `programId` mula sa `declare_id`

## Bring it all together

Kapag pinagsama mo ang lahat ng mga uri ng Anchor na ito, magkakaroon ka ng kumpletong programa. Nasa ibaba ang isang halimbawa ng pangunahing Anchor program na may iisang pagtuturo na:

- Nagsisimula ng bagong account
- Ina-update ang field ng data sa account gamit ang data ng pagtuturo na ipinasa sa pagtuturo

```rust
// Use this import to gain access to common anchor features
use anchor_lang::prelude::*;

// Program onchain address
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Instruction logic
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
        ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}

// Validate incoming accounts for instructions
#[derive(Accounts)]
pub struct InstructionAccounts<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}

// Define custom program account type
#[account]
pub struct AccountStruct {
    data: u64
}
```

Handa ka na ngayong bumuo ng sarili mong programa ng Solana gamit ang Anchor framework!

# Demo

Bago tayo magsimula, i-install ang Anchor sa pamamagitan ng [pagsunod sa mga hakbang mula sa Anchor docs](https://www.anchor-lang.com/docs/installation).

Para sa demo na ito gagawa kami ng simpleng counter program na may dalawang tagubilin:

- Ang unang tagubilin ay magpapasimula ng isang counter account
- Ang pangalawang tagubilin ay magdaragdag sa bilang na nakaimbak sa isang counter account

### 1. Setup

Lumikha ng bagong proyekto na tinatawag na `anchor-counter` sa pamamagitan ng pagpapatakbo ng `anchor init`:

```console
anchor init anchor-counter
```

Susunod, patakbuhin ang `anchor-build`

```console
anchor-build
```

Tapos, patakbuhin `anchor keys list`

```console
anchor keys list
```

Kunin ang program ID mula sa `anchor keys list`

```
anchor_counter: BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr
```

Pagkatapos ay i-update ang `declare_id!` sa `lib.rs`

```rust
declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");
```

At i-update din ang `Anchor.toml`

```
[programs.localnet]
anchor_counter = "BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr"
```

Panghuli, tanggalin ang default na code sa `lib.rs` hanggang sa ang natitira na lang ay ang sumusunod:

```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

}
```

### 2. Add the `initialize` instruction

Una, ipatupad natin ang `initialize` na pagtuturo sa loob ng `#[program]`. Ang tagubiling ito ay nangangailangan ng `Konteksto` na may uri ng `Initialize` at hindi kumukuha ng karagdagang data ng pagtuturo. Sa lohika ng pagtuturo, itinatakda lang namin ang field ng `count` ng `count` sa `0`.

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.count = 0;
    msg!("Counter Account Created");
    msg!("Current Count: { }", counter.count);
    Ok(())
}
```

### 3. Implement `Context` type `Initialize`

Susunod, gamit ang `#[derive(Accounts)]` macro, ipatupad natin ang uri ng `Initialize` na naglilista at nagpapatunay sa mga account na ginamit ng tagubiling `initialize`. Kakailanganin nito ang mga sumusunod na account:

- `counter` - ang counter account na sinimulan sa pagtuturo
- `user` - nagbabayad para sa pagsisimula
- `system_program` - ang system program ay kinakailangan para sa pagsisimula ng anumang mga bagong account

```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Implement `Counter`

Susunod, gamitin ang attribute na `#[account]` para tumukoy ng bagong uri ng account na `Counter`. Ang `Counter` struct ay tumutukoy sa isang `count` na field ng uri `u64`. Nangangahulugan ito na maaari naming asahan ang anumang mga bagong account na sinimulan bilang isang uri ng `Counter` na magkaroon ng katugmang istraktura ng data. Awtomatikong itinatakda din ng attribute na `#[account]` ang discriminator para sa isang bagong account at itinatakda ang may-ari ng account bilang `programId` mula sa `declare_id!` na macro.

```rust
#[account]
pub struct Counter {
    pub count: u64,
}
```

### 5. Add `increment` instruction

Sa loob ng `#[program]`, ipatupad natin ang isang `increment` na tagubilin upang dagdagan ang `count` kapag ang isang `counter` na account ay nasimulan ng unang tagubilin. Nangangailangan ang tagubiling ito ng `Konteksto` ng uri ng `Update` (ipinatupad sa susunod na hakbang) at hindi kumukuha ng karagdagang data ng pagtuturo. Sa lohika ng pagtuturo, dinaragdagan lang namin ng `1` ang field ng `count` account ng umiiral nang `count`.

```rust
pub fn increment(ctx: Context<Update>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    msg!("Previous counter: {}", counter.count);
    counter.count = counter.count.checked_add(1).unwrap();
    msg!("Counter incremented. Current count: {}", counter.count);
    Ok(())
}
```

### 6. Implement `Context` type `Update`

Panghuli, gamit muli ang `#[derive(Accounts)]` macro, gawin natin ang uri ng `Update` na naglilista ng mga account na kinakailangan ng tagubiling `increment`. Kakailanganin nito ang mga sumusunod na account:

- `counter` - isang umiiral na counter account upang dagdagan
- `user` - nagbabayad para sa bayarin sa transaksyon

Muli, kakailanganin naming tukuyin ang anumang mga hadlang gamit ang `#[account(..)]` attribute:

```rust
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}
```

### 7. Build

Sa kabuuan, ang kumpletong programa ay magiging ganito:

```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Counter account created. Current count: {}", counter.count);
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        msg!("Previous counter: {}", counter.count);
        counter.count = counter.count.checked_add(1).unwrap();
        msg!("Counter incremented. Current count: {}", counter.count);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}

#[account]
pub struct Counter {
    pub count: u64,
}
```

Patakbuhin ang `anchor build` upang buuin ang program.

### 8. Testing

Ang mga anchor test ay karaniwang mga Typescript integration test na gumagamit ng mocha test framework. Matututunan namin ang higit pa tungkol sa pagsubok sa ibang pagkakataon, ngunit sa ngayon ay mag-navigate sa `anchor-counter.ts` at palitan ang default na test code ng mga sumusunod:

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { AnchorCounter } from "../target/types/anchor_counter"

describe("anchor-counter", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.AnchorCounter as Program<AnchorCounter>

  const counter = anchor.web3.Keypair.generate()

  it("Is initialized!", async () => {})

  it("Incremented the count", async () => {})
})
```

Ang code sa itaas ay bumubuo ng bagong keypair para sa `counter` na account na ating sisimulan at gagawa ng mga placeholder para sa pagsubok ng bawat pagtuturo.

Susunod, likhain ang unang pagsubok para sa `initialize` na pagtuturo:

```typescript
it("Is initialized!", async () => {
  // Add your test here.
  const tx = await program.methods
    .initialize()
    .accounts({ counter: counter.publicKey })
    .signers([counter])
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 0)
})
```

Susunod, lumikha ng pangalawang pagsubok para sa pagtuturo ng `increment`:

```typescript
it("Incremented the count", async () => {
  const tx = await program.methods
    .increment()
    .accounts({ counter: counter.publicKey, user: provider.wallet.publicKey })
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 1)
})
```

Panghuli, patakbuhin ang `anchor test` at dapat mong makita ang sumusunod na output:

```console
anchor-counter
✔ Is initialized! (290ms)
✔ Incremented the count (403ms)


2 passing (696ms)
```

Ang pagpapatakbo ng `anchor test` ay awtomatikong magpapaikot ng lokal na test validator, i-deploy ang iyong program, at pinapatakbo ang iyong mga mocha test laban dito. Huwag mag-alala kung nalilito ka sa mga pagsubok sa ngayon - maghuhukay pa kami sa ibang pagkakataon.

Binabati kita, nakagawa ka lang ng isang programang Solana gamit ang balangkas ng Anchor! Huwag mag-atubiling sumangguni sa [code ng solusyon](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-increment) kung kailangan mo pa ng ilang oras dito.

# Challenge

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa. Dahil nagsisimula kami sa napakasimpleng mga programa, ang sa iyo ay magmumukhang halos magkapareho sa kung ano ang nilikha namin. Kapaki-pakinabang na subukan at makarating sa punto kung saan maaari mong isulat ito mula sa simula nang hindi tinutukoy ang naunang code, kaya subukang huwag kopyahin at i-paste dito.

1. Sumulat ng bagong program na nagpapasimula ng `counter` account
2. Magpatupad ng parehong `increment` at `decrement` na pagtuturo
3. Buuin at i-deploy ang iyong programa tulad ng ginawa namin sa demo
4. Subukan ang iyong bagong deployed na program at gamitin ang Solana Explorer upang suriin ang mga log ng program

Gaya ng dati, maging malikhain sa mga hamong ito at dalhin ang mga ito sa kabila ng mga pangunahing tagubilin kung gusto mo - at magsaya!

Subukang gawin ito nang nakapag-iisa kung kaya mo! Ngunit kung natigil ka, huwag mag-atubiling sumangguni sa [solution code](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).
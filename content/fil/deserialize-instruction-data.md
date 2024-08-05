---
title: Create a Basic Program, Part 1 - Handle Instruction Data
objectives:
- Magtalaga ng mga nababago at hindi nababagong variable sa Rust
- Lumikha at gumamit ng mga Rust struct at enum
- Gumamit ng mga pahayag ng Rust match
- Magdagdag ng mga pagpapatupad sa mga uri ng Rust
- Deserialize ang data ng pagtuturo sa mga uri ng data ng Rust
- Magsagawa ng iba't ibang logic ng programa para sa iba't ibang uri ng mga tagubilin
- Ipaliwanag ang istraktura ng isang matalinong kontrata sa Solana
---

# TL;DR

- Karamihan sa mga programa ay sumusuporta sa **maraming discrete na mga tagubilin** - magpapasya ka kapag isinusulat mo ang iyong programa kung ano ang mga tagubiling ito at kung anong data ang dapat kasama sa kanila
- Ang mga kalawang **enums** ay kadalasang ginagamit upang kumatawan sa mga hiwalay na tagubilin ng programa
- Maaari mong gamitin ang `borsh` crate at ang `derive` attribute para magbigay ng Borsh deserialization at serialization functionality sa Rust structs
- Tumutulong ang mga expression na `match` na kalawang na lumikha ng mga conditional code path batay sa ibinigay na pagtuturo

# Lesson

Isa sa mga pinakapangunahing elemento ng isang programa ng Solana ay ang lohika para sa paghawak ng data ng pagtuturo. Karamihan sa mga program ay sumusuporta sa maraming nauugnay na function at gumagamit ng mga pagkakaiba sa data ng pagtuturo upang matukoy kung aling code path ang isasagawa. Halimbawa, ang dalawang magkaibang format ng data sa data ng pagtuturo na ipinasa sa program ay maaaring kumatawan sa mga tagubilin para sa paggawa ng bagong piraso ng data kumpara sa pagtanggal ng parehong piraso ng data.

Dahil ang data ng pagtuturo ay ibinibigay sa entry point ng iyong programa bilang isang byte array, karaniwan na gumawa ng Rust data type upang kumatawan sa mga tagubilin sa paraang mas magagamit sa kabuuan ng iyong code. Tatalakayin ng araling ito kung paano i-set up ang ganitong uri, kung paano i-deserialize ang data ng pagtuturo sa format na ito, at kung paano isagawa ang tamang path ng code batay sa pagtuturo na ipinasa sa entry point ng programa.

## Rust basics

Bago tayo sumisid sa mga detalye ng isang pangunahing programa ng Solana, pag-usapan natin ang mga pangunahing kaalaman sa Rust na gagamitin natin sa buong araling ito.

### Variables

Ang variable na pagtatalaga sa Rust ay nangyayari sa keyword na `hayaan`.

```rust
let age = 33;
```

Ang mga variable sa Rust bilang default ay hindi nababago, ibig sabihin ay hindi na mababago ang value ng isang variable kapag naitakda na ito. Upang makalikha ng variable na gusto naming baguhin sa isang punto sa hinaharap, ginagamit namin ang keyword na `mut`. Ang pagtukoy sa isang variable gamit ang keyword na ito ay nangangahulugan na ang halaga na nakaimbak dito ay maaaring magbago.

```rust
// compiler will throw error
let age = 33;
age = 34;

// this is allowed
let mut mutable_age = 33;
mutable_age = 34;
```

Ginagarantiyahan ng Rust compiler na ang mga hindi nababagong variable ay tunay na hindi maaaring magbago kaya hindi mo na kailangang subaybayan ito mismo. Ginagawa nitong mas madaling mangatuwiran ang iyong code at pinapasimple nito ang pag-debug.

### Structs

Ang struct, o structure, ay isang custom na uri ng data na nagbibigay-daan sa iyong mag-package nang sama-sama at pangalanan ang maraming magkakaugnay na value na bumubuo sa isang makabuluhang pangkat. Ang bawat piraso ng data sa isang struct ay maaaring may iba't ibang uri at bawat isa ay may pangalang nauugnay dito. Ang mga piraso ng data na ito ay tinatawag na **mga fields**. Pareho silang kumilos sa mga pag-aari sa ibang mga wika.

```rust
struct User {
    active: bool,
    email: String,
    age: u64
}
```

Upang gumamit ng struct pagkatapos naming tukuyin ito, gumawa kami ng instance ng struct na iyon sa pamamagitan ng pagtukoy ng mga kongkretong halaga para sa bawat isa sa mga field.

```rust
let mut user1 = User {
    active: true,
    email: String::from("test@test.com"),
    age: 36
};
```

Upang makakuha o magtakda ng isang partikular na halaga mula sa isang struct, gumagamit kami ng dot notation.

```rust
user1.age = 37;
```

### Enumerations

Ang Enumerations (o Enums) ay isang data struct na nagbibigay-daan sa iyong tukuyin ang isang uri sa pamamagitan ng pag-enumerate sa mga posibleng variant nito. Ang isang halimbawa ng isang enum ay maaaring magmukhang:

```rust
enum LightStatus {
    On,
    Off
}
```

Ang `LightStatus` enum ay may dalawang posibleng variant sa sitwasyong ito: ito ay alinman sa `On` o `Off`.

Maaari ka ring mag-embed ng mga value sa mga variant ng enum, katulad ng pagdaragdag ng mga field sa isang struct.

```rust
enum LightStatus {
    On {
        color: String
    },
    Off
}

let light_status = LightStatus::On { color: String::from("red") };
```

Sa halimbawang ito, ang pagtatakda ng variable sa `On` na variant ng `LightStatus` ay nangangailangan din ng pagtatakda ng value ng `color`.

### Match statements

Ang mga pahayag ng pagtutugma ay halos kapareho sa mga pahayag ng `switch` sa C/C++. Binibigyang-daan ka ng statement na `match` na ihambing ang isang value laban sa isang serye ng mga pattern at pagkatapos ay i-execute ang code batay sa kung aling pattern ang tumutugma sa value. Ang mga pattern ay maaaring gawin ng mga literal na halaga, variable na pangalan, wildcard, at higit pa. Dapat isama sa statement ng tugma ang lahat ng posibleng sitwasyon, kung hindi ay hindi magko-compile ang code.

```rust
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter
}

fn value_in_cents(coin: Coin) -> u8 {
    match coin {
        Coin::Penny => 1,
        Coin::Nickel => 5,
        Coin::Dime => 10,
        Coin::Quarter => 25
    }
}
```

### Implementations

Ang keyword na `impl` ay ginagamit sa Rust upang tukuyin ang mga pagpapatupad ng isang uri. Ang mga pag-andar at mga constant ay maaaring parehong tukuyin sa isang pagpapatupad.

```rust
struct Example {
    number: i32
}

impl Example {
    fn boo() {
        println!("boo! Example::boo() was called!");
    }

    fn answer(&mut self) {
        self.number += 42;
    }

    fn get_number(&self) -> i32 {
        self.number
    }
}
```

Ang function na `boo` dito ay matatawag lang sa mismong uri sa halip na isang instance ng uri, tulad nito:

```rust
Example::boo();
```

Samantala, ang `answer` ay nangangailangan ng nababagong instance ng `Example` at maaaring tawagan gamit ang dot syntax:

```rust
let mut example = Example { number: 3 };
example.answer();
```

### Traits and attributes

Hindi ka gagawa ng sarili mong mga katangian o katangian sa yugtong ito, kaya hindi kami magbibigay ng malalim na paliwanag sa alinman. Gayunpaman, gagamit ka ng `derive` attribute macro at ilang mga katangiang ibinigay ng `borsh` crate, kaya mahalagang mayroon kang mataas na antas ng pang-unawa sa bawat isa.

Inilalarawan ng mga katangian ang isang abstract na interface na maaaring ipatupad ng mga uri. Kung ang isang katangian ay tumutukoy sa isang function na `bark()` at ang isang uri ay nagpatibay ng katangiang iyon, ang uri ay dapat na ipatupad ang `bark()` function.

[Attributes](https://doc.rust-lang.org/rust-by-example/attribute.html) add metadata to a type and can be used for many different purposes.

Kapag idinagdag mo ang [`derive` attribute](https://doc.rust-lang.org/rust-by-example/trait/derive.html) sa isang uri at nagbigay ng isa o higit pang mga sinusuportahang katangian, bubuo ang code sa ilalim ang hood upang awtomatikong ipatupad ang mga katangian para sa ganoong uri. Magbibigay kami ng isang kongkretong halimbawa nito sa ilang sandali.

## Representing instructions as a Rust data type

Ngayong nasaklaw na natin ang mga pangunahing kaalaman sa Rust, ilapat natin ang mga ito sa mga programang Solana.

Mas madalas kaysa sa hindi, ang mga programa ay magkakaroon ng higit sa isang function. Halimbawa, maaaring mayroon kang program na nagsisilbing backend para sa isang app sa pagkuha ng tala. Ipagpalagay na ang program na ito ay tumatanggap ng mga tagubilin para sa paglikha ng isang bagong tala, pag-update ng isang umiiral na tala, at pagtanggal ng isang umiiral na tala.

Dahil ang mga tagubilin ay may mga discrete na uri, kadalasan ay angkop ang mga ito para sa isang uri ng data ng enum.

```rust
enum NoteInstruction {
    CreateNote {
        title: String,
        body: String,
        id: u64
    },
    UpdateNote {
        title: String,
        body: String,
        id: u64
    },
    DeleteNote {
        id: u64
    }
}
```

Pansinin na ang bawat variant ng `NoteInstruction` enum ay may kasamang naka-embed na data na gagamitin ng program para magawa ang mga gawain ng paglikha, pag-update, at pagtanggal ng tala, ayon sa pagkakabanggit.

## Deserialize instruction data

Ang data ng pagtuturo ay ipinapasa sa programa bilang isang byte array, kaya kailangan mo ng isang paraan upang tiyak na i-convert ang array na iyon sa isang halimbawa ng uri ng pagtuturo enum.

Sa mga nakaraang module, ginamit namin ang Borsh para sa client-side serialization at deserialization. Upang gamitin ang Borsh program-side, ginagamit namin ang `borsh` crate. Nagbibigay ang crate na ito ng mga katangian para sa `BorshDeserialize` at `BorshSerialize` na maaari mong ilapat sa iyong mga uri gamit ang attribute na `derive`.

Upang gawing simple ang data ng pagtuturo ng deserializing, maaari kang gumawa ng struct na kumakatawan sa data at gamitin ang attribute na `derive` para ilapat ang trait na `BorshDeserialize` sa struct. Ipinapatupad nito ang mga pamamaraang tinukoy sa `BorshDeserialize`, kasama ang pamamaraang `try_from_slice` na gagamitin namin para i-deserialize ang data ng pagtuturo.

Tandaan, ang struct mismo ay kailangang tumugma sa istraktura ng data sa byte array.

```rust
#[derive(BorshDeserialize)]
struct NoteInstructionPayload {
    id: u64,
    title: String,
    body: String
}
```

Kapag nalikha na ang struct na ito, maaari kang lumikha ng pagpapatupad para sa iyong enum ng pagtuturo upang mahawakan ang lohika na nauugnay sa deserializing na data ng pagtuturo. Karaniwang makitang ginagawa ito sa loob ng isang function na tinatawag na `unpack` na tumatanggap ng data ng pagtuturo bilang argumento at ibinabalik ang naaangkop na instance ng enum na may deserialized na data.

Karaniwang kasanayan ang pagbuo ng iyong programa upang asahan ang unang byte (o iba pang nakapirming bilang ng mga byte) upang maging isang identifier kung saan ang pagtuturo ay dapat tumakbo ang program. Ito ay maaaring isang integer o isang string identifier. Para sa halimbawang ito, gagamitin namin ang unang byte at mga integer ng mapa 0, 1, at 2 sa mga tagubilin sa paggawa, pag-update, at pagtanggal, ayon sa pagkakabanggit.

```rust
impl NoteInstruction {
    // Unpack inbound buffer to associated Instruction
    // The expected format for input is a Borsh serialized vector
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Take the first byte as the variant to
        // determine which instruction to execute
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // Use the temporary payload struct to deserialize
        let payload = NoteInstructionPayload::try_from_slice(rest).unwrap();
        // Match the variant to determine which data struct is expected by
        // the function and return the TestStruct or an error
        Ok(match variant {
            0 => Self::CreateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            1 => Self::UpdateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            2 => Self::DeleteNote {
                id: payload.id
            },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

Marami sa halimbawang ito kaya gawin natin ito nang paisa-isa:

1. Nagsisimula ang function na ito sa pamamagitan ng paggamit ng function na `split_first` sa parameter na `input` upang magbalik ng tuple. Ang unang elemento, `variant`, ay ang unang byte mula sa byte array at ang pangalawang elemento, `rest`, ay ang natitirang bahagi ng byte array.
2. Ginagamit ng function ang pamamaraang `try_from_slice` sa `NoteInstructionPayload` upang i-deserialize ang natitirang bahagi ng byte array sa isang instance ng `NoteInstructionPayload` na tinatawag na `payload`
3. Panghuli, ang function ay gumagamit ng `match` statement sa `variant` para gumawa at ibalik ang naaangkop na enum instance gamit ang impormasyon mula sa `payload`

Tandaan na mayroong Rust syntax sa function na ito na hindi pa namin naipaliwanag. Ang mga function na `ok_or` at `unwrap` ay ginagamit para sa paghawak ng error at tatalakayin nang detalyado sa isa pang aralin.

## Program logic

Sa isang paraan upang i-deserialize ang data ng pagtuturo sa isang custom na uri ng Rust, maaari mong gamitin ang naaangkop na daloy ng kontrol upang magsagawa ng iba't ibang mga path ng code sa iyong programa batay sa kung aling pagtuturo ang ipinasa sa entry point ng iyong programa.

```rust
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Call unpack to deserialize instruction_data
    let instruction = NoteInstruction::unpack(instruction_data)?;
    // Match the returned data struct to what you expect
    match instruction {
        NoteInstruction::CreateNote { title, body, id } => {
            // Execute program code to create a note
        },
        NoteInstruction::UpdateNote { title, body, id } => {
            // Execute program code to update a note
        },
        NoteInstruction::DeleteNote { id } => {
            // Execute program code to delete a note
        }
    }
}
```

Para sa mga simpleng programa kung saan mayroon lamang isa o dalawang tagubilin na isasagawa, maaaring mainam na isulat ang lohika sa loob ng pahayag ng tugma. Para sa mga program na may maraming iba't ibang posibleng mga tagubilin na itugma, ang iyong code ay magiging mas nababasa kung ang lohika para sa bawat pagtuturo ay nakasulat sa isang hiwalay na function at tatawagin lamang mula sa loob ng `match` na pahayag.

## Program file structure

Ang programa ng [Hello World lesson](hello-world-program.md) ay sapat na simple kaya maaari itong makulong sa isang file. Ngunit habang lumalaki ang pagiging kumplikado ng isang programa, mahalagang mapanatili ang isang istraktura ng proyekto na nananatiling nababasa at napapalawak. Kabilang dito ang pag-encapsulate ng code sa mga function at istruktura ng data gaya ng ginawa namin sa ngayon. Ngunit kabilang din dito ang pagpapangkat ng mga kaugnay na code sa magkakahiwalay na mga file.

Halimbawa, ang isang magandang bahagi ng code na pinagsikapan namin sa ngayon ay may kinalaman sa pagtukoy at pag-deserialize ng mga tagubilin. Ang code na iyon ay dapat mabuhay sa sarili nitong file sa halip na isulat sa parehong file bilang entry point. Sa paggawa nito, magkakaroon tayo ng 2 file, ang isa ay may entry point ng programa at ang isa ay may instruction code:

- **lib.rs**
- **instruction.rs**

Kapag sinimulan mong hatiin ang iyong programa nang ganito, kakailanganin mong tiyaking irehistro mo ang lahat ng mga file sa isang sentral na lokasyon. Gagawin namin ito sa `lib.rs`. **Dapat mong irehistro ang bawat file sa iyong programa tulad nito.**

```rust
// This would be inside lib.rs
pub mod instruction;
```

Additionally, any declarations that you would like to be available through `use` statements in other files will need to be prefaced with the `pub` keyword:

```rust
pub enum NoteInstruction { ... }
```

## Demo

Para sa demo ng araling ito, bubuuin namin ang unang kalahati ng programa ng Pagsusuri ng Pelikula na ginamit namin sa Module 1. Ang program na ito ay nag-iimbak ng mga pagsusuri sa pelikula na isinumite ng mga user.

Sa ngayon, magtutuon kami sa deserializing ng data ng pagtuturo. Ang susunod na aralin ay tututuon sa ikalawang kalahati ng programang ito.

### 1. Entry point

Gagamitin namin muli ang [Solana Playground](https://beta.solpg.io/) para buuin ang program na ito. Ang Solana Playground ay nagse-save ng estado sa iyong browser, kaya lahat ng ginawa mo sa nakaraang aralin ay maaaring naroon pa rin. Kung oo, i-clear natin ang lahat mula sa kasalukuyang `lib.rs` file.

Sa loob ng lib.rs, dadalhin namin ang mga sumusunod na crates at tutukuyin kung saan namin gustong ang aming entry point sa program ay kasama ng macro na `entrypoint`.

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::AccountInfo,
};

// Entry point is a function call process_instruction
entrypoint!(process_instruction);

// Inside lib.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {

    Ok(())
}
```

### 2. Deserialize instruction data

Bago tayo magpatuloy sa lohika ng processor, dapat nating tukuyin ang ating mga sinusuportahang tagubilin at ipatupad ang ating deserialization function.

Para sa pagiging madaling mabasa, gumawa tayo ng bagong file na tinatawag na `instruction.rs`. Sa loob ng bagong file na ito, magdagdag ng mga statement na `use` para sa `BorshDeserialize` at `ProgramError`, pagkatapos ay gumawa ng `MovieInstruction` enum na may variant ng `AddMovieReview`. Ang variant na ito ay dapat may mga naka-embed na value para sa `title,` `rating`, at `description`.

```rust
use borsh::{BorshDeserialize};
use solana_program::{program_error::ProgramError};

pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    }
}
```

Susunod, tukuyin ang isang `MovieReviewPayload` struct. Ito ay magsisilbing intermediary type para sa deserializtion kaya dapat nitong gamitin ang `derive` attribute macro para magbigay ng default na pagpapatupad para sa `BorshDeserialize` na katangian.

```rust
#[derive(BorshDeserialize)]
struct MovieReviewPayload {
    title: String,
    rating: u8,
    description: String
}
```

Panghuli, gumawa ng pagpapatupad para sa `MovieInstruction` enum na tumutukoy at nagpapatupad ng function na tinatawag na `unpack` na kumukuha ng byte array bilang argumento at nagbabalik ng uri ng `Result`. Ang function na ito ay dapat:

1. Gamitin ang function na `split_first` upang hatiin ang unang byte ng array mula sa iba pang array
2. Deserialize ang natitirang array sa isang instance ng `MovieReviewPayload`
3. Gumamit ng statement na `match` para ibalik ang variant ng `AddMovieReview` ng `MovieInstruction` kung ang unang byte ng array ay 0 o nagbabalik ng error sa program kung hindi.

```rust
impl MovieInstruction {
    // Unpack inbound buffer to associated Instruction
    // The expected format for input is a Borsh serialized vector
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Split the first byte of data
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // `try_from_slice` is one of the implementations from the BorshDeserialization trait
        // Deserializes instruction byte data into the payload struct
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        // Match the first byte and return the AddMovieReview struct
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

### 3. Program logic

Kapag pinangangasiwaan ang pagtuturo ng deserialization, maaari tayong bumalik sa `lib.rs` file upang pangasiwaan ang ilan sa aming logic ng programa.

Tandaan, dahil nagdagdag kami ng code sa ibang file, kailangan namin itong irehistro sa `lib.rs` file gamit ang `pub mod instruction;`. Pagkatapos ay maaari tayong magdagdag ng statement na `use` para dalhin ang uri ng `MovieInstruction` sa saklaw.

```rust
pub mod instruction;
use instruction::{MovieInstruction};
```

Susunod, tukuyin natin ang isang bagong function na `add_movie_review` na tumatagal bilang mga argumento na `program_id`, `account`, `title`, `rating`, at `description`. Dapat din itong magbalik ng isang instance ng `ProgramResult` Sa loob ng function na ito, i-log lang natin ang ating mga value sa ngayon at muli nating babalikan ang natitirang pagpapatupad ng function sa susunod na aralin.

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

    // Logging instruction data that was passed in
    msg!("Adding movie review...");
    msg!("Title: {}", title);
    msg!("Rating: {}", rating);
    msg!("Description: {}", description);

    Ok(())
}
```

Kapag tapos na iyon, maaari naming tawagan ang `add_movie_review` mula sa `process_instruction` (ang function na itinakda namin bilang aming entry point). Upang maipasa ang lahat ng kinakailangang argumento sa function, kakailanganin muna naming tawagan ang `unpack` na ginawa namin sa `MovieInstruction`, pagkatapos ay gumamit ng `match` na pahayag upang matiyak na ang tagubiling natanggap namin ay ang `AddMovieReview ` variant.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Unpack called
    let instruction = MovieInstruction::unpack(instruction_data)?;
    // Match against the data struct returned into `instruction` variable
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            // Make a call to `add_move_review` function
            add_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

At ganoon din, ang iyong programa ay dapat na gumagana nang sapat upang mai-log ang data ng pagtuturo na ipinasa kapag ang isang transaksyon ay isinumite!

Buuin at i-deploy ang iyong programa mula sa Solana Program tulad ng sa huling aralin. Kung hindi mo pa binago ang program ID mula noong dumaan sa huling aralin, awtomatiko itong ide-deploy sa parehong ID. Kung gusto mo itong magkaroon ng hiwalay na address maaari kang bumuo ng bagong program ID mula sa playground bago i-deploy.

Maaari mong subukan ang iyong programa sa pamamagitan ng pagsusumite ng isang transaksyon na may tamang data ng pagtuturo. Para diyan, huwag mag-atubiling gamitin [ang script na ito](https://github.com/Unboxed-Software/solana-movie-client) o [ang frontend](https://github.com/Unboxed-Software/solana-movie-frontend) na binuo namin sa [Serialize Custom Instruction Data lesson](serialize-instruction-data.md). Sa parehong mga kaso, siguraduhing kopyahin at i-paste mo ang program ID para sa iyong program sa naaangkop na bahagi ng source code upang matiyak na sinusubukan mo ang tamang program.

Kung kailangan mong gumugol ng mas maraming oras sa demo na ito bago magpatuloy, mangyaring gawin! Maaari mo ring tingnan ang program [code ng solusyon](https://beta.solpg.io/62aa9ba3b5e36a8f6716d45b) kung natigil ka.

# Challenge

Para sa hamon ng araling ito, subukang kopyahin ang Student Intro program mula sa Module 1. Tandaan na gumawa kami ng frontend application na nagbibigay-daan sa mga mag-aaral na magpakilala! Kinukuha ng program ang pangalan ng isang user at isang maikling mensahe bilang `instruction_data` at gagawa ng account upang iimbak ang data onchain.

Gamit ang iyong natutunan sa araling ito, buuin ang Student Intro program hanggang sa punto kung saan maaari mong i-print ang `pangalan` at `mensahe` na ibinibigay ng user sa mga log ng programa kapag ang program ay na-invoke.

Maaari mong subukan ang iyong programa sa pamamagitan ng pagbuo ng [frontend](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data) na aming ginawa sa [Serialize Custom Instruction Data lesson](serialize-instruction-data.md) at pagkatapos ay suriin ang mga log ng program sa Solana Explorer. Tandaang palitan ang program ID sa frontend code ng na-deploy mo.

Subukang gawin ito nang nakapag-iisa kung kaya mo! Ngunit kung natigil ka, huwag mag-atubiling sumangguni sa [code ng solusyon](https://beta.solpg.io/62b0ce53f6273245aca4f5b0).

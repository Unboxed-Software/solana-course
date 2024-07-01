---
title: Create a Basic Program, Part 2 - State Management
objectives:
- Ilarawan ang proseso ng paglikha ng bagong account gamit ang Program Derived Address (PDA)
- Gumamit ng mga buto upang makakuha ng PDA
- Gamitin ang puwang na kinakailangan ng isang account upang kalkulahin ang halaga ng upa (sa mga lampara) na dapat ilaan ng isang user
- Gumamit ng Cross Program Invocation (CPI) upang simulan ang isang account na may PDA bilang address ng bagong account
- Ipaliwanag kung paano i-update ang data na nakaimbak sa isang bagong account
---

# TL;DR

- Ang estado ng programa ay nakaimbak sa ibang mga account sa halip na sa mismong programa
- Ang Program Derived Address (PDA) ay hinango mula sa isang program ID at isang opsyonal na listahan ng mga buto. Kapag nakuha na, ang mga PDA ay kasunod na ginagamit bilang address para sa isang storage account.
- Ang paglikha ng isang account ay nangangailangan na kalkulahin namin ang puwang na kinakailangan at ang kaukulang upa na ilalaan para sa bagong account
- Ang paggawa ng bagong account ay nangangailangan ng Cross Program Invocation (CPI) sa `create_account` na pagtuturo sa System Program
- Ang pag-update sa field ng data sa isang account ay nangangailangan na i-serialize namin (i-convert sa byte array) ang data sa account

# Lesson

Ang Solana ay nagpapanatili ng bilis, kahusayan, at pagpapalawak sa bahagi sa pamamagitan ng paggawa ng mga programa na walang estado. Sa halip na magkaroon ng estado na naka-imbak sa mismong programa, ginagamit ng mga program ang modelo ng account ni Solana upang basahin ang estado mula at isulat ang estado upang paghiwalayin ang mga PDA account.

Bagama't isa itong napaka-flexible na modelo, isa rin itong paradigm na maaaring mahirap gamitin kung hindi ito pamilyar. Ngunit huwag mag-alala! Magsisimula tayo nang simple sa araling ito at gagawa ng hanggang sa mas kumplikadong mga programa sa susunod na modyul.

Sa araling ito matututunan natin ang mga pangunahing kaalaman sa pamamahala ng estado para sa isang programang Solana, kabilang ang pagrepresenta sa estado bilang isang uri ng Rust, paggawa ng mga account gamit ang Mga Address na Nagmula sa Programa, at pagse-serialize ng data ng account.

## Program state

Ang lahat ng Solana account ay may field na `data` na naglalaman ng byte array. Ginagawa nitong kasing-flexible ang mga account gaya ng mga file sa isang computer. Maaari kang mag-imbak ng anumang bagay sa isang account (hangga't ang account ay may espasyo sa imbakan para dito).

Kung paanong ang mga file sa isang tradisyunal na filesystem ay umaayon sa mga partikular na format ng data tulad ng PDF o MP3, ang data na nakaimbak sa isang Solana account ay kailangang sumunod sa ilang uri ng pattern upang ang data ay maaaring makuha at ma-deserialize sa isang bagay na magagamit.

### Represent state as a Rust type

Kapag nagsusulat ng isang programa sa Rust, karaniwang ginagawa namin ang "format" na ito sa pamamagitan ng pagtukoy ng isang uri ng data ng Rust. Kung dumaan ka sa [unang bahagi ng araling ito](basic-program-pt-1.md), ito ay halos kapareho sa ginawa namin noong gumawa kami ng enum upang kumatawan sa mga discrete na tagubilin.

Bagama't dapat ipakita ng ganitong uri ang istraktura ng iyong data, para sa karamihan ng mga kaso ng paggamit, sapat na ang isang simpleng istruktura. Halimbawa, ang isang programa sa pagkuha ng tala na nag-iimbak ng mga tala sa magkahiwalay na mga account ay malamang na may data para sa isang pamagat, katawan, at maaaring isang uri ng ID. Maaari kaming lumikha ng isang struct upang kumatawan na tulad ng sumusunod:

```rust
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

### Using Borsh for serialization and deserialization

Tulad ng data ng pagtuturo, kailangan namin ng mekanismo para sa pag-convert mula sa aming Rust na uri ng data sa isang byte array, at kabaliktaran. Ang **Serialization** ay ang proseso ng pag-convert ng object sa isang byte array. Ang **Deserialization** ay ang proseso ng muling pagbuo ng isang bagay mula sa isang byte array.

Patuloy naming gagamitin ang Borsh para sa serialization at deserialization. Sa Rust, maaari naming gamitin ang `borsh` crate para makakuha ng access sa `BorshSerialize` at `BorshDeserialize` na mga katangian. Pagkatapos ay maaari naming ilapat ang mga katangiang iyon gamit ang `derive` attribute macro.

```rust
use borsh::{BorshSerialize, BorshDeserialize};

#[derive(BorshSerialize, BorshDeserialize)]
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

Ang mga katangiang ito ay magbibigay ng mga pamamaraan sa `NoteState` na magagamit namin upang i-serialize at i-deserialize ang data kung kinakailangan.

## Creating accounts

Bago namin ma-update ang field ng data ng isang account, kailangan muna naming gawin ang account na iyon.

Upang lumikha ng bagong account sa loob ng aming programa kailangan naming:

1. Kalkulahin ang espasyo at upa na kailangan para sa account
2. Magkaroon ng address para italaga ang bagong account
3. I-invoke ang system program para gumawa ng bagong account

### Space and rent

Alalahanin na ang pag-iimbak ng data sa network ng Solana ay nangangailangan ng mga user na maglaan ng renta sa anyo ng mga lampor. Ang halaga ng renta na kailangan ng isang bagong account ay depende sa halaga ng espasyo na gusto mong ilaan sa account na iyon. Ibig sabihin, kailangan nating malaman bago gawin ang account kung gaano karaming espasyo ang ilalaan.

Tandaan na ang upa ay mas katulad ng isang deposito. Ang lahat ng lamports na inilaan para sa upa ay maaaring ganap na i-refund kapag ang isang account ay sarado. Bukod pa rito, lahat ng bagong account ay kailangan na ngayong maging [rent-exempt](https://twitter.com/jacobvcreech/status/1524790032938287105), ibig sabihin, hindi ibinabawas ang mga lamport mula sa account sa paglipas ng panahon. Itinuturing na rent-exempt ang isang account kung nagtataglay ito ng hindi bababa sa 2 taong halaga ng upa. Sa madaling salita, ang mga account ay permanenteng iniimbak sa chain hanggang sa isara ng may-ari ang account at bawiin ang renta.

Sa aming halimbawa ng note-taking app, ang `NoteState` struct ay tumutukoy sa tatlong field na kailangang i-store sa isang account: `title`, `body`, at `id`. Upang kalkulahin ang laki na kailangan ng account, idadagdag mo lang ang laki na kinakailangan upang maiimbak ang data sa bawat field.

Para sa dynamic na data, tulad ng mga string, nagdaragdag si Borsh ng karagdagang 4 na byte sa simula upang iimbak ang haba ng partikular na field na iyon. Ibig sabihin, ang `title` at `body` ay bawat 4 byte kasama ang kani-kanilang laki. Ang field ng `id` ay isang 64-bit integer, o 8 byte.

Maaari mong dagdagan ang mga haba na iyon at pagkatapos ay kalkulahin ang renta na kinakailangan para sa halagang iyon ng espasyo gamit ang function na `minimum_balance` mula sa `rent` module ng `solana_program` crate.

```rust
// Calculate account size required for struct NoteState
let account_len: usize = (4 + title.len()) + (4 + body.len()) + 8;

// Calculate rent required
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

### Program Derived Addresses (PDA)

Bago gumawa ng account, kailangan din nating magkaroon ng address para italaga ang account. Para sa mga account na pagmamay-ari ng program, ito ay magiging program derived address (PDA) na makikita gamit ang function na `find_program_address`.

Gaya ng ipinahihiwatig ng pangalan, ang mga PDA ay hinango gamit ang program ID (address ng program na gumagawa ng account) at isang opsyonal na listahan ng "mga buto". Ang mga opsyonal na binhi ay mga karagdagang input na ginagamit sa function na `find_program_address` upang makuha ang PDA. Ang function na ginamit upang kunin ang mga PDA ay magbabalik ng parehong address sa bawat oras na bibigyan ng parehong mga input. Nagbibigay ito sa amin ng kakayahang lumikha ng anumang bilang ng mga PDA account at isang tiyak na paraan upang mahanap ang bawat account.

Bilang karagdagan sa mga binhing ibinibigay mo para sa pagkuha ng PDA, ang function na `find_program_address` ay magbibigay ng karagdagang "bump seed." Ang dahilan kung bakit natatangi ang mga PDA mula sa ibang mga address ng Solana account ay wala silang katumbas na lihim na susi. Tinitiyak nito na tanging ang program na nagmamay-ari ng address ang maaaring pumirma sa ngalan ng PDA. Kapag sinubukan ng function na `find_program_address` na kumuha ng PDA gamit ang ibinigay na mga buto, pumasa ito sa numerong 255 bilang "bump seed." Kung di-wasto ang nagreresultang address (ibig sabihin, may katumbas na lihim na key), binabawasan ng function ang bump seed ng 1 at nakakakuha ng bagong PDA kasama ang bump seed na iyon. Kapag natagpuan ang isang wastong PDA, ibabalik ng function ang PDA at ang bump na ginamit upang makuha ang PDA.

Para sa aming programa sa pagkuha ng tala, gagamitin namin ang pampublikong key ng tagalikha ng tala at ang ID bilang mga opsyonal na binhi upang makuha ang PDA. Ang pag-deliver ng PDA sa ganitong paraan ay nagbibigay-daan sa amin na tiyak na mahanap ang account para sa bawat tala.

```rust
let (note_pda_account, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);
```

### Cross Program Invocation (CPI)

Kapag nakalkula na namin ang renta na kinakailangan para sa aming account at nakakita ng valid na PDA na itatalaga bilang address ng bagong account, handa na kaming gumawa ng account. Ang paglikha ng bagong account sa loob ng aming programa ay nangangailangan ng Cross Program Invocation (CPI). Ang CPI ay kapag ang isang programa ay humihiling ng pagtuturo sa isa pang programa. Upang lumikha ng bagong account sa loob ng aming programa, gagamitin namin ang pagtuturo ng `create_account` sa system program.

Maaaring gawin ang mga CPI gamit ang alinman sa `invoke` o `invoke_signed`.

```rust
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult
```

```rust
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

Para sa araling ito gagamitin namin ang `invoke_signed`. Hindi tulad ng isang regular na lagda kung saan ginagamit ang isang lihim na susi upang pumirma, ginagamit ng `invoke_signed` ang mga opsyonal na buto, bump seed, at program ID upang makakuha ng PDA at pumirma ng isang tagubilin. Ginagawa ito sa pamamagitan ng paghahambing ng nagmula na PDA laban sa lahat ng mga account na ipinasa sa pagtuturo. Kung ang alinman sa mga account ay tumutugma sa PDA, ang field ng signer para sa account na iyon ay nakatakda sa true.

Ang isang programa ay maaaring ligtas na pumirma ng mga transaksyon sa ganitong paraan dahil ang `invoke_signed` ay bumubuo ng PDA na ginagamit para sa pag-sign gamit ang program ID ng program na nagpapatupad ng pagtuturo. Samakatuwid, hindi posible para sa isang programa na bumuo ng isang katugmang PDA upang mag-sign para sa isang account na may PDA na hinango gamit ang isa pang program ID.

```rust
invoke_signed(
    // instruction
    &system_instruction::create_account(
        note_creator.key,
        note_pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
    ),
    // account_infos
    &[note_creator.clone(), note_pda_account.clone(), system_program.clone()],
    // signers_seeds
    &[&[note_creator.key.as_ref(), note_id.as_bytes().as_ref(), &[bump_seed]]],
)?;
```

## Serializing and deserializing account data

Kapag nakagawa na kami ng bagong account, kailangan naming i-access at i-update ang field ng data ng account. Nangangahulugan ito na deserializing ang byte array nito sa isang instance ng uri na ginawa namin, ina-update ang mga field sa instance na iyon, pagkatapos ay i-serialize ang instance na iyon pabalik sa isang byte array.

### Deserialize account data

Ang unang hakbang sa pag-update ng data ng isang account ay i-deserialize ang `data` byte array nito sa uri nitong Rust. Magagawa mo ito sa pamamagitan ng paghiram muna ng field ng data sa account. Nagbibigay-daan ito sa iyong ma-access ang data nang hindi inaako ang pagmamay-ari.

Pagkatapos ay maaari mong gamitin ang function na `try_from_slice_unchecked` upang i-deserialize ang field ng data ng hiniram na account gamit ang format ng uri na ginawa mo upang kumatawan sa data. Nagbibigay ito sa iyo ng isang instance ng iyong uri ng Rust para madali mong ma-update ang mga field gamit ang dot notation. Kung gagawin namin ito gamit ang halimbawa ng app sa pagkuha ng tala na ginagamit namin, magiging ganito ang hitsura:

```rust
let mut account_data = try_from_slice_unchecked::<NoteState>(note_pda_account.data.borrow()).unwrap();

account_data.title = title;
account_data.body = rating;
account_data.id = id;
```

### Serialize account data

Kapag na-update na ang Rust instance na kumakatawan sa data ng account gamit ang mga naaangkop na halaga, maaari mong "i-save" ang data sa account.

Ginagawa ito gamit ang function na `serialize` sa instance ng uri ng Rust na ginawa mo. Kakailanganin mong magpasa ng nababagong reference sa data ng account. Ang syntax dito ay nakakalito, kaya huwag mag-alala kung hindi mo ito lubos na naiintindihan. Ang paghiram at mga sanggunian ay dalawa sa pinakamahirap na konsepto sa Rust.

```rust
account_data.serialize(&mut &mut note_pda_account.data.borrow_mut()[..])?;
```

Kino-convert ng halimbawa sa itaas ang object na `account_data` sa isang byte array at itinatakda ito sa property na `data` sa `note_pda_account`. Ise-save nito ang na-update na variable ng `account_data` sa field ng data ng bagong account. Ngayon kapag kinuha ng isang user ang `note_pda_account` at na-deserialize ang data, ipapakita nito ang na-update na data na na-serialize namin sa account.

## Iterators

Maaaring napansin mo sa mga nakaraang halimbawa na tinukoy namin ang `note_creator` at hindi ipinakita kung saan iyon nanggaling.

Upang makakuha ng access dito at sa iba pang mga account, gumagamit kami ng [Iterator](https://doc.rust-lang.org/std/iter/trait.Iterator.html). Ang iterator ay isang Rust trait na ginagamit upang magbigay ng sequential access sa bawat elemento sa isang koleksyon ng mga value. Ginagamit ang mga iterator sa mga programang Solana upang ligtas na umulit sa listahan ng mga account na ipinasa sa entry point ng programa sa pamamagitan ng argumento ng `accounts`.

### Rust iterator

Ang pattern ng iterator ay nagpapahintulot sa iyo na magsagawa ng ilang gawain sa isang pagkakasunud-sunod ng mga item. Ang paraan ng `iter()` ay lumilikha ng isang iterator object na tumutukoy sa isang koleksyon. Ang isang iterator ay responsable para sa lohika ng pag-ulit sa bawat item at pagtukoy kung kailan natapos ang pagkakasunud-sunod. Sa Rust, ang mga iterator ay tamad, ibig sabihin ay wala silang epekto hanggang sa tumawag ka ng mga pamamaraan na kumukonsumo sa iterator upang gamitin ito. Kapag nakagawa ka na ng iterator, dapat mong tawagan ang `next()` function dito upang makuha ang susunod na item.

```rust
let v1 = vec![1, 2, 3];

// create the iterator over the vec
let v1_iter = v1.iter();

// use the iterator to get the first item
let first_item = v1_iter.next();

// use the iterator to get the second item
let second_item = v1_iter.next();
```

### Solana accounts iterator

Alalahanin na ang `AccountInfo` para sa lahat ng account na kinakailangan ng isang pagtuturo ay dumadaan sa isang argumento ng `account`. Upang ma-parse ang mga account at magamit ang mga ito sa loob ng aming pagtuturo, kakailanganin naming gumawa ng iterator na may nababagong reference sa `accounts`.

Sa puntong iyon, sa halip na direktang gamitin ang iterator, ipinapasa namin ito sa function na `next_account_info` mula sa module na `account_info` na ibinigay ng `solana_program` crate.

Halimbawa, ang pagtuturo upang lumikha ng bagong tala sa isang programa sa pagkuha ng tala ay mangangailangan ng mga account para sa user na gumagawa ng tala, isang PDA upang iimbak ang tala, at ang `system_program` upang magsimula ng isang bagong account. Ipapasa ang lahat ng tatlong account sa entry point ng programa sa pamamagitan ng argumentong `accounts`. Ang isang iterator ng `accounts` ay gagamitin upang paghiwalayin ang `AccountInfo` na nauugnay sa bawat account upang iproseso ang pagtuturo.

Tandaan na ang `&mut` ay nangangahulugang isang nababagong reference sa argumento ng `account`. Maaari kang magbasa nang higit pa tungkol sa [mga sanggunian sa Rust](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html) at [ang `mut` na keyword](https://doc.rust-lang.org/std/keyword.mut.html).

```rust
// Get Account iterator
let account_info_iter = &mut accounts.iter();

// Get accounts
let note_creator = next_account_info(account_info_iter)?;
let note_pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

# Demo

Ang pangkalahatang-ideya na ito ay sumasaklaw sa maraming bagong konsepto. Sanayin natin ang mga ito nang sama-sama sa pamamagitan ng patuloy na paggawa sa programa ng Pagsusuri ng Pelikula mula sa huling aralin. Huwag mag-alala kung papasok ka lang sa araling ito nang hindi mo nagawa ang nakaraang aralin - dapat ay posible na sumunod sa alinmang paraan. Gagamitin namin ang [Solana Playground](https://beta.solpg.io) para isulat, buuin, at i-deploy ang aming code.

Bilang isang refresher, gumagawa kami ng isang programang Solana na nagbibigay-daan sa mga user na magsuri ng mga pelikula. Noong nakaraang aralin, na-deserialize namin ang data ng pagtuturo na ipinasa ng user ngunit hindi pa namin naiimbak ang data na ito sa isang account. I-update natin ngayon ang ating programa para gumawa ng mga bagong account para mag-imbak ng movie review ng user.

### 1. Get the starter code

Kung hindi mo nakumpleto ang demo mula sa huling aralin o gusto mo lang matiyak na wala kang napalampas na anuman, maaari mong i-reference [ang starter code](https://beta.solpg.io/6295b25b0e6ab1eb92d947f7).

Kasalukuyang kasama sa aming programa ang `instruction.rs` file na ginagamit namin upang i-deserialize ang `instruction_data` na ipinasa sa entry point ng programa. Nakumpleto rin namin ang `lib.rs` na file hanggang sa punto kung saan maaari naming i-print ang aming deserialized na data ng pagtuturo sa log ng programa gamit ang `msg!` na macro.

### 2. Create struct to represent account data

Magsimula tayo sa paggawa ng bagong file na pinangalanang `state.rs`.

Ang file na ito ay:

1. Tukuyin ang struct na ginagamit ng aming programa upang i-populate ang field ng data ng isang bagong account
2. Magdagdag ng `BorshSerialize` at `BorshDeserialize` na mga katangian sa struct na ito

Una, dalhin natin sa saklaw ang lahat ng kakailanganin natin mula sa `borsh` crate.

```rust
use borsh::{BorshSerialize, BorshDeserialize};
```

Susunod, gawin natin ang aming `MovieAccountState` na struct. Ang struct na ito ay tutukuyin ang mga parameter na iimbak ng bawat bagong movie review account sa field ng data nito. Ang aming `MovieAccountState` struct ay mangangailangan ng mga sumusunod na parameter:

- `is_initialized` - ipinapakita kung ang account ay nasimulan o hindi
- `rating` - rating ng user sa pelikula
- `description` - paglalarawan ng user sa pelikula
- `title` - pamagat ng pelikulang sinusuri ng user

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub is_initialized: bool,
    pub rating: u8,
    pub title: String,
    pub description: String  
}
```

### 3. Update `lib.rs`

Susunod, i-update natin ang aming `lib.rs` file. Una, dadalhin namin sa saklaw ang lahat ng kailangan namin para makumpleto ang aming programa sa Pagsusuri ng Pelikula. Maaari kang magbasa nang higit pa tungkol sa mga detalye ng bawat item na ginagamit namin mula sa [ang `solana_program` crate](https://docs.rs/solana-program/latest/solana_program/).

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::{next_account_info, AccountInfo},
    system_instruction,
    program_error::ProgramError,
    sysvar::{rent::Rent, Sysvar},
    program::{invoke_signed},
    borsh::try_from_slice_unchecked,
};
use std::convert::TryInto;
pub mod instruction;
pub mod state;
use instruction::MovieInstruction;
use state::MovieAccountState;
use borsh::BorshSerialize;
```

### 4. Iterate through `accounts`

Susunod, ipagpatuloy natin ang pagbuo ng ating function na `add_movie_review`. Alalahanin na ang isang hanay ng mga account ay ipinapasa sa function na `add_movie_review` sa pamamagitan ng isang argumento ng `account`. Upang maproseso ang aming pagtuturo, kakailanganin naming umulit sa pamamagitan ng `accounts` at italaga ang `AccountInfo` para sa bawat account sa sarili nitong variable.

```rust
// Get Account iterator
let account_info_iter = &mut accounts.iter();

// Get accounts
let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

### 5. Derive PDA

Susunod, sa loob ng aming function na `add_movie_review`, independyente nating makuha ang PDA na inaasahan nating naipasa ng user. Kakailanganin nating ibigay ang bump seed para sa derivation sa ibang pagkakataon, kaya kahit na ang `pda_account` ay dapat sumangguni sa parehong account, kami kailangan pa ring tumawag sa `find_program_address`.

Tandaan na nakukuha namin ang PDA para sa bawat bagong account gamit ang public key ng initializer at ang pamagat ng pelikula bilang mga opsyonal na binhi. Ang pag-set up ng PDA sa ganitong paraan ay naghihigpit sa bawat user sa isang review lang para sa alinmang pamagat ng pelikula. Gayunpaman, pinapayagan pa rin nito ang parehong user na suriin ang mga pelikulang may iba't ibang pamagat at iba't ibang user na magsuri ng mga pelikulang may parehong pamagat.

```rust
// Derive PDA and check that it matches client
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
```

### 6. Calculate space and rent

Susunod, kalkulahin natin ang upa na kakailanganin ng ating bagong account. Alalahanin na ang upa ay ang halaga ng mga lamport na dapat ilaan ng isang user sa isang account para sa pag-iimbak ng data sa network ng Solana. Upang kalkulahin ang upa, kailangan muna naming kalkulahin ang halaga ng espasyo na kailangan ng aming bagong account.

Ang `MovieAccountState` struct ay may apat na field. Maglalaan kami ng 1 byte bawat isa para sa `rating` at `is_initialized`. Para sa parehong `title` at `description` ay maglalaan kami ng espasyo na katumbas ng 4 na byte kasama ang haba ng string.

```rust
// Calculate account size required
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());

// Calculate rent required
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

### 7. Create new account

Kapag nakalkula na namin ang upa at na-verify ang PDA, handa na kaming gumawa ng aming bagong account. Upang makalikha ng bagong account, dapat nating tawagan ang tagubiling `create_account` mula sa system program. Ginagawa namin ito gamit ang Cross Program Invocation (CPI) gamit ang function na `invoke_signed`. Gumagamit kami ng `invoke_signed` dahil ginagawa namin ang account gamit ang isang PDA at kailangan namin ng Movie Review program para “lagdaan” ang pagtuturo.

```rust
// Create the account
invoke_signed(
    &system_instruction::create_account(
        initializer.key,
        pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
    ),
    &[initializer.clone(), pda_account.clone(), system_program.clone()],
    &[&[initializer.key.as_ref(), title.as_bytes().as_ref(), &[bump_seed]]],
)?;

msg!("PDA created: {}", pda);
```

### 8. Update account data

Ngayong nakagawa na kami ng bagong account, handa na kaming i-update ang field ng data ng bagong account gamit ang format ng `MovieAccountState` struct mula sa aming `state.rs` file. Ide-deserialize muna namin ang data ng account mula sa `pda_account` gamit ang `try_from_slice_unchecked`, pagkatapos ay itakda ang mga value ng bawat field.

```rust
msg!("unpacking state account");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("borrowed account data");

account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Panghuli, ini-serialize namin ang na-update na `account_data` sa field ng data ng aming `pda_account`.

```rust
msg!("serializing account");
account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
msg!("state account serialized");
```

### 9. Build and deploy

Handa na kaming buuin at i-deploy ang aming programa!

![Gif Build and Deploy Program](../../assets/movie-review-pt2-build-deploy.gif)

Maaari mong subukan ang iyong programa sa pamamagitan ng pagsusumite ng isang transaksyon na may tamang data ng pagtuturo. Para diyan, huwag mag-atubiling gamitin [ang script na ito](https://github.com/Unboxed-Software/solana-movie-client) o [ang frontend](https://github.com/Unboxed-Software/solana- movie-frontend) na binuo namin sa [Deserialize Custom Instruction Data lesson](deserialize-custom-data.md). Sa parehong mga kaso, siguraduhing kopyahin at i-paste mo ang program ID para sa iyong program sa naaangkop na bahagi ng source code upang matiyak na sinusubukan mo ang tamang program.

Kung gagamitin mo ang frontend, palitan lang ang `MOVIE_REVIEW_PROGRAM_ID` sa parehong bahagi ng `MovieList.tsx` at `Form.tsx` ng address ng program na iyong na-deploy. Pagkatapos ay patakbuhin ang frontend, magsumite ng view, at i-refresh ang browser para makita ang review.

Kung kailangan mo ng mas maraming oras sa proyektong ito upang maging komportable sa mga konseptong ito, tingnan ang [code ng solusyon](https://beta.solpg.io/62b23597f6273245aca4f5b4) bago magpatuloy.

# Challenge

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa. Gamit ang mga konseptong ipinakilala sa araling ito, alam mo na ngayon ang lahat ng kakailanganin mo upang muling likhain ang kabuuan ng Student Intro program mula sa Module 1.

Ang Student Intro program ay isang Solana Program na nagbibigay-daan sa mga mag-aaral na magpakilala. Kinukuha ng program ang pangalan ng isang user at isang maikling mensahe bilang `instruction_data` at gagawa ng account upang iimbak ang data onchain.

Gamit ang iyong natutunan sa araling ito, buuin ang programang ito. Bilang karagdagan sa pagkuha ng isang pangalan ng isang maikling mensahe bilang data ng pagtuturo, ang programa ay dapat na:

1. Gumawa ng hiwalay na account para sa bawat mag-aaral
2. I-store ang `is_initialized` bilang boolean, `name` bilang string, at `msg` bilang string sa bawat account

Maaari mong subukan ang iyong programa sa pamamagitan ng pagbuo ng [frontend](https://github.com/Unboxed-Software/solana-student-intros-frontend) na ginawa namin sa [Page, Order, at Filter Program Data lesson](.. /paging-ordering-filtering-data.md). Tandaang palitan ang program ID sa frontend code ng na-deploy mo.

Subukang gawin ito nang nakapag-iisa kung kaya mo! Ngunit kung natigil ka, huwag mag-atubiling sumangguni sa [code ng solusyon](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).


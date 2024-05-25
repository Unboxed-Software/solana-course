---
title: Cross Program Invocations
objectives:
- Ipaliwanag ang Cross-Program Invocations (CPIs)
- Ilarawan kung paano bumuo at gumamit ng mga CPI
- Ipaliwanag kung paano nagbibigay ang isang programa ng lagda para sa isang PDA
- Iwasan ang mga karaniwang pitfall at i-troubleshoot ang mga karaniwang error na nauugnay sa mga CPI
---

# TL;DR

- Ang **Cross-Program Invocation (CPI)** ay isang tawag mula sa isang programa patungo sa isa pa, na nagta-target ng partikular na pagtuturo sa program na tinatawag
- Ginagawa ang mga CPI gamit ang mga utos na `invoke` o `invoke_signed`, ang huli ay kung paano nagbibigay ng mga lagda ang mga program para sa mga PDA na pagmamay-ari nila
- Ginagawa ng mga CPI ang mga programa sa Solana ecosystem na ganap na interoperable dahil ang lahat ng pampublikong tagubilin ng isang programa ay maaaring gamitin ng isa pang programa sa pamamagitan ng isang CPI
- Dahil wala kaming kontrol sa mga account at data na isinumite sa isang programa, mahalagang i-verify ang lahat ng mga parameter na ipinasa sa isang CPI upang matiyak ang seguridad ng programa

# Lesson

## What is a CPI?

Ang Cross-Program Invocation (CPI) ay isang direktang tawag mula sa isang programa patungo sa isa pa. Tulad ng sinumang kliyente na maaaring tumawag sa anumang programa gamit ang JSON RPC, anumang programa ay maaaring direktang tumawag sa anumang iba pang programa. Ang tanging kinakailangan para sa paggamit ng pagtuturo sa isa pang programa mula sa loob ng iyong programa ay ang pagbuo mo ng pagtuturo nang tama. Maaari kang gumawa ng mga CPI sa mga katutubong programa, iba pang mga program na iyong nilikha, at mga programa ng third party. Talagang ginagawa ng mga CPI ang buong Solana ecosystem sa isang higanteng API na magagamit mo bilang isang developer.


Ang mga CPI ay may katulad na komposisyon sa mga tagubilin na nakasanayan mo sa paglikha ng panig ng kliyente. Mayroong ilang mga intricacies at pagkakaiba depende sa kung gumagamit ka ng `invoke` o `invoke_signed`. Tatalakayin natin ang dalawa sa mga ito mamaya sa araling ito.

## How to make a CPI

Ginagawa ang mga CPI gamit ang [`invoke`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke.html) o [`invoke_signed`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke_signed.html) function mula sa `solana_program` crate. Gumagamit ka ng `invoke` upang maipasa ang orihinal na lagda ng transaksyon na ipinasa sa iyong programa. Gumagamit ka ng `invoke_signed` para "mag-sign" ang iyong program para sa mga PDA nito.

```rust
// Used when there are not signatures for PDAs needed
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult

// Used when a program must provide a 'signature' for a PDA, hence the signer_seeds parameter
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

Pinapalawak ng mga CPI ang mga pribilehiyo ng tumatawag sa tumatawag. Kung ang pagtuturo na pinoproseso ng callee program ay naglalaman ng isang account na minarkahan bilang isang signer o nasusulat noong orihinal na ipinasa sa caller program, kung gayon ito ay ituturing na isang signer o nasusulat na account sa invoked program din.

Mahalagang tandaan na ikaw bilang developer ang magpapasya kung aling mga account ang ipapasa sa CPI. Maaari mong isipin ang isang CPI bilang pagbuo ng isa pang pagtuturo mula sa simula gamit lamang ang impormasyong ipinasa sa iyong programa.

### CPI with `invoke`

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &account_infos[account1.clone(), account2.clone(), account3.clone()],
)?;
```

- `program_id` - ang pampublikong key ng program na iyong i-invoke
- `account` - isang listahan ng metadata ng account bilang isang vector. Kailangan mong isama ang bawat account na babasahin o isusulat ng na-invoke na programa
- `data` - isang byte buffer na kumakatawan sa data na ipinapasa sa callee program bilang vector

Ang uri ng `Pagtuturo` ay may sumusunod na kahulugan:

```rust
pub struct Instruction {
    pub program_id: Pubkey,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
}
```


Depende sa program kung saan ka tumatawag, maaaring mayroong magagamit na crate na may mga function ng helper para sa paggawa ng object na `Instruction`. Maraming indibidwal at organisasyon ang gumagawa ng mga crates na available sa publiko kasama ng kanilang mga programa na naglalantad ng mga ganitong uri ng mga function upang pasimplehin ang pagtawag sa kanilang mga programa. Ito ay katulad ng mga Typescript library na ginamit namin sa kursong ito (hal. [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/), [@solana/spl -token](https://solana-labs.github.io/solana-program-library/token/js/)). Halimbawa, sa demo ng araling ito, gagamitin namin ang `spl_token` crate upang lumikha ng mga tagubilin sa pag-print.
Sa lahat ng iba pang sitwasyon, kakailanganin mong gawin ang instance ng `Instruction` mula sa simula.

Bagama't medyo diretso ang field ng `program_id`, ang mga field ng `account` at `data` ay nangangailangan ng ilang paliwanag.

Parehong ang mga field ng `accounts` at `data` ay may uri ng `Vec`, o vector. Maaari mong gamitin ang macro na [`vec`](https://doc.rust-lang.org/std/macro.vec.html) upang bumuo ng vector gamit ang notation ng array, tulad nito:

```rust
let v = vec![1, 2, 3];
assert_eq!(v[0], 1);
assert_eq!(v[1], 2);
assert_eq!(v[2], 3);
```


Inaasahan ng field ng `account` ng struct `Instruction` ang isang vector na may uri na [`AccountMeta`](https://docs.rs/solana-program/latest/solana_program/instruction/struct.AccountMeta.html). Ang `AccountMeta` struct ay may sumusunod na kahulugan:


```rust
pub struct AccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}
```

Putting these two pieces together looks like this:

```rust
use solana_program::instruction::AccountMeta;

vec![
    AccountMeta::new(account1_pubkey, true),
    AccountMeta::read_only(account2_pubkey, false),
    AccountMeta::read_only(account3_pubkey, true),
    AccountMeta::new(account4_pubkey, false),
]
```


Ang huling larangan ng object ng pagtuturo ay ang data, bilang isang byte buffer siyempre. Maaari kang lumikha ng isang byte buffer sa Rust gamit ang `vec` macro muli, na may ipinatupad na function na nagbibigay-daan sa iyong lumikha ng isang vector na may partikular na haba. Kapag nasimulan mo na ang isang walang laman na vector, gagawa ka ng byte buffer na katulad ng kung paano mo gagawin ang client-side. Tukuyin ang data na kinakailangan ng callee program at ang serialization format na ginamit at isulat ang iyong code upang tumugma. Huwag mag-atubiling basahin ang ilan sa [mga tampok ng `vec` na macro na available sa iyo dito](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#).


```rust
let mut vec = Vec::with_capacity(3);
vec.push(1);
vec.push(2);
vec.extend_from_slice(&number_variable.to_le_bytes());
```

Malamang na bago sa iyo ang [`extend_from_slice`](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#method.extend_from_slice). Ito ay isang paraan sa mga vector na kumukuha ng isang slice bilang input, umuulit sa slice, nag-clone ng bawat elemento, at pagkatapos ay idinadagdag ito sa `Vec`.

### Pass a list of accounts

Bilang karagdagan sa pagtuturo, ang parehong `invoke` at `invoke_signed` ay nangangailangan din ng isang listahan ng mga object na `account_info`. Tulad ng listahan ng mga bagay na `AccountMeta` na idinagdag mo sa pagtuturo, dapat mong isama ang lahat ng account na babasahin o isusulat ng program na tinatawagan mo.

Sa oras na gumawa ka ng CPI sa iyong programa, dapat ay nakuha mo na ang lahat ng mga bagay na `account_info` na ipinasa sa iyong programa at inimbak ang mga ito sa mga variable. Bubuo ka ng iyong listahan ng mga bagay na `account_info` para sa CPI sa pamamagitan ng pagpili kung alin sa mga account na ito ang kokopyahin at ipapadala.

Maaari mong kopyahin ang bawat object na `account_info` na kailangan mong ipasa sa CPI gamit ang [`Clone`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html#impl-Clone) na katangian na ipinatupad sa `account_info` struct sa `solana_program` crate. Ang katangiang ito ng `Clone` ay nagbabalik ng kopya ng [`account_info`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html) instance.

```rust
&[first_account.clone(), second_account.clone(), third_account.clone()]
```

### CPI with `invoke`

Gamit ang parehong tagubilin at ang listahan ng mga account na ginawa, maaari kang magsagawa ng isang tawag para sa `invoke`.

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &[account1.clone(), account2.clone(), account3.clone()],
)?;
```

Hindi na kailangang magsama ng lagda dahil ang Solana runtime ay dumadaan sa orihinal na lagda na ipinasa sa iyong programa. Tandaan, hindi gagana ang `invoke` kung kailangan ng pirma sa ngalan ng isang PDA. Para diyan, kakailanganin mong gumamit ng `invoke_signed`.

### CPI with `invoke_signed`


Ang paggamit ng `invoke_signed` ay medyo naiiba dahil lang may karagdagang field na nangangailangan ng mga seed na ginamit upang makuha ang anumang mga PDA na dapat pumirma sa transaksyon. Maaari mong maalala mula sa mga nakaraang aralin na ang mga PDA ay hindi namamalagi sa Ed25519 curve at, samakatuwid, ay walang kaukulang lihim na susi. Sinabihan ka na ang mga programa ay maaaring magbigay ng mga lagda para sa kanilang mga PDA, ngunit hindi mo natutunan kung paano iyon aktwal na nangyayari - hanggang ngayon. Ang mga programa ay nagbibigay ng mga lagda para sa kanilang mga PDA na may function na `invoke_signed`. Ang unang dalawang field ng `invoke_signed` ay kapareho ng `invoke`, ngunit may karagdagang field na `signers_seeds` na gagana rito.


```rust
invoke_signed(
    &instruction,
    accounts,
    &[&["First addresses seed"],
        &["Second addresses first seed",
        "Second addresses second seed"]],
)?;
```

Bagama't walang sariling lihim na susi ang mga PDA, maaari silang gamitin ng isang programa para mag-isyu ng pagtuturo na kinabibilangan ng PDA bilang isang pumirma. Ang tanging paraan para ma-verify ng runtime na ang PDA ay kabilang sa calling program ay para sa calling program na mag-supply ng mga seed na ginamit upang buuin ang address sa field na `signers_seeds`.

Ang runtime ng Solana ay panloob na tatawag sa [`create_program_address`](https://docs.rs/solana-program/1.4.4/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) gamit ang mga seed na ibinigay at ang `program_id ` ng programa sa pagtawag. Maaari nitong ihambing ang resulta laban sa mga address na ibinigay sa pagtuturo. Kung tumugma ang alinman sa mga address, alam ng runtime na ang program na nauugnay sa address na ito ay ang tumatawag at sa gayon ay awtorisadong maging isang pumirma.


## Best Practices and common pitfalls

### Security checks

Mayroong ilang mga karaniwang pagkakamali at bagay na dapat tandaan kapag gumagamit ng mga CPI na mahalaga sa seguridad at katatagan ng iyong programa. Ang unang dapat tandaan ay, tulad ng alam natin sa ngayon, wala tayong kontrol sa kung anong impormasyon ang ipinapasa sa ating mga programa. Para sa kadahilanang ito, mahalagang palaging i-verify ang `program_id`, mga account, at data na ipinasa sa CPI. Kung wala ang mga pagsusuring ito sa seguridad, maaaring magsumite ang isang tao ng transaksyon na humihiling ng pagtuturo sa isang ganap na naiibang programa kaysa sa inaasahan, na hindi perpekto.

Sa kabutihang palad, may mga likas na pagsusuri sa bisa ng anumang PDA na minarkahan bilang mga pumirma sa loob ng function na `invoke_signed`. Ang lahat ng iba pang account at `instruction_data` ay dapat ma-verify sa isang lugar sa iyong program code bago gawin ang CPI. Mahalaga rin na tiyaking tina-target mo ang nilalayon na pagtuturo sa program na iyong ginagamit. Ang pinakamadaling paraan upang gawin ito ay basahin ang source code ng programa na iyong i-invoke tulad ng gagawin mo kung ikaw ay gumagawa ng isang pagtuturo mula sa panig ng kliyente.

### Common errors

Mayroong ilang mga karaniwang error na maaari mong matanggap kapag nagpapatupad ng isang CPI, kadalasang nangangahulugang ginagawa mo ang CPI na may maling impormasyon. Halimbawa, maaari kang makakita ng mensahe ng error na katulad nito:

```text
EF1M4SPfKcchb6scq297y8FPCaLvj5kGjwMzjTM68wjA's signer privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Medyo nakaliligaw ang mensaheng ito, dahil hindi mukhang problema ang "lumalaki ang pribilehiyo ng signer" ngunit, sa totoo lang, nangangahulugan ito na mali ang pagpirma mo para sa address sa mensahe. Kung gumagamit ka ng `invoke_signed` at natanggap ang error na ito, malamang na nangangahulugan ito na ang mga binhi na iyong ibinibigay ay hindi tama. Makakakita ka rin ng [isang halimbawang transaksyon na nabigo sa error na ito](https://explorer.solana.com/tx/3mxbShkerH9ZV1rMmvDfaAhLhJJqrmMjcsWzanjkARjBQurhf4dounrDCUkGunH1p9M4jEwef9parueyHVw6clude=Etnet).

Ang isa pang katulad na error ay itinapon kapag ang isang account kung saan isinulat ay hindi namarkahan bilang `masusulat` sa loob ng `AccountMeta` struct.

```text
2qoeXa9fo8xVHzd2h9mVcueh6oK3zmAiJxCTySM5rbLZ's writable privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Tandaan, ang anumang account na ang data ay maaaring ma-mutate ng programa sa panahon ng pagpapatupad ay dapat na tukuyin bilang masusulat. Sa panahon ng pagpapatupad, ang pagsulat sa isang account na hindi tinukoy bilang nasusulat ay magiging sanhi ng pagkabigo sa transaksyon. Ang pagsulat sa isang account na hindi pag-aari ng programa ay magiging sanhi ng pagkabigo sa transaksyon. Anumang account na ang balanse ng lamport ay maaaring i-mutate ng programa sa panahon ng pagpapatupad ay dapat na tukuyin bilang masusulat. Sa panahon ng pagpapatupad, ang pag-mutate sa mga lamport ng isang account na hindi tinukoy bilang nasusulat ay magiging sanhi ng pagkabigo sa transaksyon. Habang ang pagbabawas ng mga lampor sa isang account na hindi pagmamay-ari ng programa ay magdudulot ng pagkabigo sa transaksyon, ang pagdaragdag ng mga lampor sa anumang account ay pinapayagan, hangga't ito ay nababago.

Upang makita ito sa pagkilos, tingnan ito [transaksyon sa explorer](https://explorer.solana.com/tx/ExB9YQJiSzTZDBqx4itPaa4TpT8VK4Adk7GU5pSoGEzNz9fa7PPZsUxssHGrBbJRnCvhoKgBLCwnVcluyDc?

## Why CPIs matter?

Ang mga CPI ay isang napakahalagang tampok ng Solana ecosystem at ginagawa nilang interoperable ang lahat ng mga programang naka-deploy sa isa't isa. Sa mga CPI ay hindi na kailangang muling imbento ang gulong pagdating sa pag-unlad. Lumilikha ito ng pagkakataon para sa pagbuo ng mga bagong protocol at application sa ibabaw ng kung ano ang naitayo na, tulad ng mga building block o Lego brick. Mahalagang tandaan na ang mga CPI ay isang two-way na kalye at ganoon din ang totoo para sa anumang mga programang ipapatupad mo! Kung gagawa ka ng isang bagay na cool at kapaki-pakinabang, ang mga developer ay may kakayahang bumuo sa ibabaw ng kung ano ang nagawa mo o isaksak lang ang iyong protocol sa anumang ginagawa nila. Ang composability ay isang malaking bahagi ng kung bakit natatangi ang crypto at ang mga CPI ang ginagawang posible nito sa Solana.


Ang isa pang mahalagang aspeto ng CPI ay ang pagpapahintulot nila sa mga programa na pumirma para sa kanilang mga PDA. Tulad ng malamang na napansin mo ngayon, ang mga PDA ay napakadalas na ginagamit sa pagbuo ng Solana dahil pinapayagan nila ang mga programa na kontrolin ang mga partikular na address sa paraang walang panlabas na user ang makakabuo ng mga transaksyon na may wastong mga lagda para sa mga address na iyon. Ito ay maaaring maging *napaka-kapaki-pakinabang para sa maraming mga application sa Web3 (hal. DeFi, NFT, atbp.) Kung walang CPI, ang mga PDA ay hindi halos magiging kapaki-pakinabang dahil walang paraan para sa isang programa na pumirma sa mga transaksyong kinasasangkutan ng mga ito - mahalagang gawing itim ang mga ito mga butas (kapag may ipinadala sa isang PDA, wala nang paraan upang maibalik ito nang walang mga CPI!)

# Demo

Ngayon, kumuha tayo ng ilang karanasan sa mga CPI sa pamamagitan ng paggawa muli ng ilang mga karagdagan sa programa ng Pagsusuri ng Pelikula. Kung pumapasok ka sa araling ito nang hindi dumaan sa mga naunang aralin, ang programa ng Pagsusuri ng Pelikula ay nagbibigay-daan sa mga user na magsumite ng mga pagsusuri sa pelikula at i-store ang mga ito sa mga PDA account.

Noong nakaraang aralin, idinagdag namin ang kakayahang mag-iwan ng mga komento sa iba pang mga pagsusuri sa pelikula gamit ang mga PDA. Sa araling ito, sisikapin namin ang pagkakaroon ng mint token ng programa sa reviewer o commenter anumang oras na magsumite ng review o komento.

Upang maipatupad ito, kakailanganin nating gamitin ang pagtuturo ng `MintTo` ng SPL Token Program gamit ang isang CPI. Kung kailangan mo ng refresher sa mga token, token mints, at pag-print ng mga bagong token, tingnan ang [aralin sa Token Program](./token-program.md) bago magpatuloy sa demo na ito.

### 1. Get starter code and add dependencies

Upang makapagsimula, gagamitin namin ang huling estado ng programa ng Pagsusuri ng Pelikula mula sa nakaraang aralin sa PDA. Kaya, kung kakatapos mo lang ng araling iyon, handa ka nang umalis. Kung tumatalon ka lang dito, huwag mag-alala, maaari mong [i-download ang starter code dito](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments). Gagamitin namin ang sangay na `solution-add-comments` bilang aming panimulang punto.

### 2. Add dependencies to `Cargo.toml`

Bago tayo magsimula, kailangan nating magdagdag ng dalawang bagong dependencies sa `Cargo.toml` file sa ilalim ng `[dependencies]`. Gagamitin namin ang mga crate ng `spl-token` at `spl-associated-token-account` bilang karagdagan sa mga umiiral nang dependency.

```text
spl-token = { version="~3.2.0", features = [ "no-entrypoint" ] }
spl-associated-token-account = { version="=1.0.5", features = [ "no-entrypoint" ] }
```

Pagkatapos idagdag ang nasa itaas, patakbuhin ang `cargo check` sa iyong console upang maresolba ng kargamento ang iyong mga dependency at matiyak na handa ka nang magpatuloy. Depende sa iyong setup, maaaring kailanganin mong baguhin ang mga bersyon ng crate bago magpatuloy.

### 3. Add necessary accounts to `add_movie_review`

Dahil gusto naming magkaroon ng mga token ang mga user sa paggawa ng review, makatuwirang magdagdag ng minting logic sa loob ng function na `add_movie_review`. Dahil gagawa kami ng mga token, ang pagtuturo ng `add_movie_review` ay nangangailangan ng ilang bagong account na maipasa:

- `token_mint` - ang mint address ng token
- `mint_auth` - address ng awtoridad ng token mint
- `user_ata` - ang nauugnay na token account ng user para sa mint na ito (kung saan ilalagay ang mga token)
- `token_program` - address ng token program

Magsisimula tayo sa pamamagitan ng pagdaragdag ng mga bagong account na ito sa lugar ng function na umuulit sa mga naipasa sa mga account:

```rust
// Inside add_movie_review
msg!("Adding movie review...");
msg!("Title: {}", title);
msg!("Rating: {}", rating);
msg!("Description: {}", description);

let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

Walang karagdagang `instruction_data` na kinakailangan para sa bagong functionality, kaya walang mga pagbabagong kailangang gawin sa kung paano deserialized ang data. Ang tanging karagdagang impormasyon na kailangan ay ang mga karagdagang account.

### 4. Mint tokens to the reviewer in `add_movie_review`

Bago tayo sumisid sa minting logic, i-import natin ang address ng Token program at ang pare-parehong `LAMPORTS_PER_SOL` sa tuktok ng file.

```rust
// Inside processor.rs
use solana_program::native_token::LAMPORTS_PER_SOL;
use spl_associated_token_account::get_associated_token_address;
use spl_token::{instruction::initialize_mint, ID as TOKEN_PROGRAM_ID};
```

Ngayon ay maaari na tayong magpatuloy sa lohika na humahawak sa aktwal na paggawa ng mga token! Idaragdag namin ito sa pinakadulo ng function na `add_movie_review` bago ibalik ang `Ok(()).

Ang minting token ay nangangailangan ng pirma ng mint authority. Dahil ang programa ay kailangang makapag-mint ng mga token, ang mint authority ay kailangang isang account kung saan ang programa ay maaaring mag-sign para sa. Sa madaling salita, kailangan itong isang PDA account na pag-aari ng programa.

Aayusin din namin ang aming token mint upang ang mint account ay isang PDA account na maaari naming makuha nang deterministiko. Sa ganitong paraan maaari naming palaging i-verify na ang `token_mint` account na ipinasa sa programa ay ang inaasahang account.

Sige at kunin natin ang token mint at mint authority address gamit ang `find_program_address` function na may mga seed na “token_mint” at "token_auth," ayon sa pagkakabanggit.

```rust
// Mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Next, we'll perform security checks against each of the new accounts passed into the program. Always remember to verify accounts!

```rust
if *token_mint.key != mint_pda {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Mint passed in and mint derived do not match");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(initializer.key, token_mint.key) {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Incorrect token program");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Sa wakas, maaari kaming mag-isyu ng CPI sa `mint_to` function ng token program na may mga tamang account gamit ang `invoke_signed`. Ang `spl_token` crate ay nagbibigay ng `mint_to` helper function para sa paggawa ng pagtuturo ng minting. Ito ay mahusay dahil nangangahulugan ito na hindi namin kailangang manu-manong buuin ang buong pagtuturo mula sa simula. Sa halip, maaari nating ipasa ang mga argumento na kinakailangan ng function. Narito ang function signature:

```rust
// Inside the token program, returns an Instruction object
pub fn mint_to(
    token_program_id: &Pubkey,
    mint_pubkey: &Pubkey,
    account_pubkey: &Pubkey,
    owner_pubkey: &Pubkey,
    signer_pubkeys: &[&Pubkey],
    amount: u64,
) -> Result<Instruction, ProgramError>
```

Pagkatapos ay nagbibigay kami ng mga kopya ng `token_mint`, `user_ata`, at `mint_auth` na mga account. At, pinaka-kaugnay sa araling ito, ibinibigay namin ang mga butong ginamit upang mahanap ang address ng `token_mint`, kasama ang bump seed.

```rust
msg!("Minting 10 tokens to User associated token account");
invoke_signed(
    // Instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        10*LAMPORTS_PER_SOL,
    )?,
    // Account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Seeds
    &[&[b"token_mint", &[mint_bump]]],
)?;

Ok(())
```

Tandaan na gumagamit kami ng `invoke_signed` at hindi `invoke` dito. Ang Token program ay nangangailangan ng `mint_auth` account upang mag-sign para sa transaksyong ito. Dahil ang `mint_auth` account ay isang PDA, tanging ang program kung saan ito hinango ay maaaring mag-sign sa ngalan nito. Kapag tinawag ang `invoke_signed`, ang runtime ng Solana ay tatawag ng `create_program_address` kasama ang mga seeds at bump na ibinigay at pagkatapos ay ihahambing ang nagmula na address sa lahat ng mga address ng ibinigay na `AccountInfo` object. Kung ang alinman sa mga address ay tumutugma sa nagmula na address, alam ng runtime na ang katugmang account ay isang PDA ng program na ito at na ang program ay pumipirma sa transaksyong ito para sa account na ito.

Sa puntong ito, ang pagtuturo ng `add_movie_review` ay dapat na ganap na gumagana at magbibigay ng sampung token sa reviewer kapag may ginawang review.

### 5. Repeat for `add_comment`

Ang aming mga update sa function na `add_comment` ay halos magkapareho sa kung ano ang ginawa namin para sa function na `add_movie_review` sa itaas. Ang pagkakaiba lang ay babaguhin namin ang dami ng mga token na mined para sa isang komento mula sampu hanggang lima upang ang pagdaragdag ng mga review ay mas matimbang sa pagkomento. Una, i-update ang mga account na may parehong apat na karagdagang account tulad ng sa function na `add_movie_review`.

```rust
// Inside add_comment
let account_info_iter = &mut accounts.iter();

let commenter = next_account_info(account_info_iter)?;
let pda_review = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let pda_comment = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

Susunod, lumipat sa ibaba ng function na `add_comment` bago ang `Ok(())`. Pagkatapos ay kunin ang token mint at mint authority account. Tandaan, pareho ang mga PDA na nagmula sa mga buto na "token_mint" at "token_authority" ayon sa pagkakabanggit.

```rust
// Mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Next, verify that each of the new accounts is the correct account.

```rust
if *token_mint.key != mint_pda {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Mint passed in and mint derived do not match");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(commenter.key, token_mint.key) {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Incorrect token program");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Panghuli, gamitin ang `invoke_signed` upang ipadala ang `mint_to` na pagtuturo sa Token program, na nagpapadala ng limang token sa nagkokomento.

```rust
msg!("Minting 5 tokens to User associated token account");
invoke_signed(
    // Instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        5 * LAMPORTS_PER_SOL,
    )?,
    // Account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Seeds
    &[&[b"token_mint", &[mint_bump]]],
)?;

Ok(())
```

### 6. Set up the token mint

Isinulat namin ang lahat ng code na kailangan para mag-mint ng mga token sa mga reviewer at commenter, ngunit lahat ng ito ay ipinapalagay na mayroong isang token mint sa PDA na nagmula sa seed na "token_mint." Para gumana ito, magse-set up kami ng karagdagang tagubilin para sa pagsisimula ng token mint. Isusulat ito na isang beses lang ito matatawag at hindi mahalaga kung sino ang tatawag dito.

Dahil sa buong araling ito, na-martilyo na natin ang lahat ng mga konseptong nauugnay sa mga PDA at CPI nang maraming beses, tatalakayin natin ang kaunting ito nang may mas kaunting paliwanag kaysa sa mga naunang hakbang. Magsimula sa pamamagitan ng pagdaragdag ng pang-apat na variant ng pagtuturo sa `MovieInstruction` enum sa `instruction.rs`.

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    AddComment {
        comment: String,
    },
    InitializeMint,
}
```

Tiyaking idagdag ito sa statement na `match` sa function na `unpack` sa parehong file sa ilalim ng variant na `3`.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment,
                }
            }
            3 => Self::InitializeMint,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
```

Sa function na `process_instruction` sa `processor.rs` file, idagdag ang bagong tagubilin sa statement na `match` at tumawag ng function na `initialize_token_mint`.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview {
            title,
            rating,
            description,
        } => add_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::UpdateMovieReview {
            title,
            rating,
            description,
        } => update_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::AddComment { comment } => add_comment(program_id, accounts, comment),
        MovieInstruction::InitializeMint => initialize_token_mint(program_id, accounts),
    }
}
```

Panghuli, ideklara at ipatupad ang function na `initialize_token_mint`. Ang function na ito ay kukuha ng token mint at mint authority PDA, gagawa ng token mint account, at pagkatapos ay magsisimula ng token mint. Hindi namin ipapaliwanag ang lahat ng ito nang detalyado, ngunit sulit na basahin ang code, lalo na kung ang paggawa at pagsisimula ng token mint ay parehong may kinalaman sa mga CPI. Muli, kung kailangan mo ng refresher sa mga token at mints, tingnan ang [aralin sa Token Program](./token-program.md).

```rust
pub fn initialize_token_mint(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let token_mint = next_account_info(account_info_iter)?;
    let mint_auth = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let sysvar_rent = next_account_info(account_info_iter)?;

    let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
    let (mint_auth_pda, _mint_auth_bump) =
        Pubkey::find_program_address(&[b"token_auth"], program_id);

    msg!("Token mint: {:?}", mint_pda);
    msg!("Mint authority: {:?}", mint_auth_pda);

    if mint_pda != *token_mint.key {
        msg!("Incorrect token mint account");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *token_program.key != TOKEN_PROGRAM_ID {
        msg!("Incorrect token program");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *mint_auth.key != mint_auth_pda {
        msg!("Incorrect mint auth account");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(82);

    invoke_signed(
        &system_instruction::create_account(
            initializer.key,
            token_mint.key,
            rent_lamports,
            82,
            token_program.key,
        ),
        &[
            initializer.clone(),
            token_mint.clone(),
            system_program.clone(),
        ],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Created token mint account");

    invoke_signed(
        &initialize_mint(
            token_program.key,
            token_mint.key,
            mint_auth.key,
            Option::None,
            9,
        )?,
        &[token_mint.clone(), sysvar_rent.clone(), mint_auth.clone()],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Initialized token mint");

    Ok(())
}
```

### 7. Build and deploy

Ngayon ay handa na kaming buuin at i-deploy ang aming programa! Maaari mong buuin ang program sa pamamagitan ng pagpapatakbo ng `cargo build-bpf` at pagkatapos ay patakbuhin ang command na ibinalik, dapat itong magmukhang `solana program deploy <PATH>`.

Bago mo simulan ang pagsubok kung magpapadala sa iyo ng mga token ang pagdaragdag ng review o komento, kailangan mong simulan ang token mint ng program. Maaari mong gamitin ang [script na ito](https://github.com/Unboxed-Software/solana-movie-token-client) para gawin iyon. Kapag na-clone mo na ang repositoryong iyon, palitan ang `PROGRAM_ID` sa `index.ts` ng ID ng iyong program. Pagkatapos ay patakbuhin ang `npm install` at pagkatapos ay `npm start`. Ipinapalagay ng script na nagde-deploy ka sa Devnet. Kung lokal kang nagde-deploy, siguraduhing iangkop ang script nang naaayon.

Kapag nasimulan mo na ang iyong token mint, maaari mong gamitin ang [Movie Review frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-tokens) upang subukan ang pagdaragdag ng mga review at mga komento. Muli, ipinapalagay ng code na nasa Devnet ka kaya mangyaring kumilos nang naaayon.

Pagkatapos magsumite ng pagsusuri, dapat kang makakita ng 10 bagong token sa iyong wallet! Kapag nagdagdag ka ng komento, dapat kang makatanggap ng 5 token. Hindi sila magkakaroon ng magarbong pangalan o larawan dahil hindi kami nagdagdag ng anumang metadata sa token, ngunit nakuha mo ang ideya.

Kung kailangan mo ng mas maraming oras sa mga konsepto mula sa araling ito o natigil ka sa daan, huwag mag-atubiling [tingnan ang code ng solusyon](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-token). Tandaan na ang solusyon sa demo na ito ay nasa `solution-add-tokens` branch.

# Challenge

Upang mailapat ang iyong natutunan tungkol sa mga CPI sa araling ito, pag-isipan kung paano mo maaaring isama ang mga ito sa programa ng Student Intro. Maaari kang gumawa ng isang bagay na katulad ng ginawa namin sa demo dito at magdagdag ng ilang functionality sa mga mint token sa mga user kapag ipinakilala nila ang kanilang mga sarili. O kung talagang ambisyoso ka, isipin kung paano mo makukuha ang lahat ng iyong natutunan sa kurso at lumikha ng isang bagay na ganap na bago mula sa simula.

Ang isang magandang halimbawa ay ang pagbuo ng isang desentralisadong Stack Overflow. Ang programa ay maaaring gumamit ng mga token upang matukoy ang pangkalahatang rating ng isang user, mint token kapag ang mga tanong ay nasasagot nang tama, payagan ang mga user na mag-upvote ng mga sagot, atbp. Lahat ng iyon ay posible at mayroon ka na ngayong mga kasanayan at kaalaman upang pumunta at bumuo ng isang katulad nito sa iyong sariling!

Binabati kita sa pagtatapos ng Modyul 4! Huwag mag-atubiling [magbahagi ng ilang mabilis na feedback](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%204), nang sa gayon ay maaari naming patuloy na mapabuti ang kurso.

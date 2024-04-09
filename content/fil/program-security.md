---
title: Create a Basic Program, Part 3 - Basic Security and Validation
objectives:
- Ipaliwanag ang kahalagahan ng "pag-iisip tulad ng isang umaatake"
- Unawain ang mga pangunahing kasanayan sa seguridad
- Magsagawa ng mga pagsusuri ng may-ari
- Magsagawa ng signer checks
- I-validate ang mga account na ipinasa sa programa
- Magsagawa ng pangunahing data validation
---

# TL;DR

- **Ang pag-iisip na parang attacker** ay nangangahulugan ng pagtatanong ng "Paano ko ito masisira?"
- Magsagawa ng **pagsusuri ng may-ari** upang matiyak na ang ibinigay na account ay pagmamay-ari ng pampublikong key na iyong inaasahan, hal. pagtiyak na ang isang account na inaasahan mong maging isang PDA ay pagmamay-ari ng `program_id`
- Magsagawa ng **signer checks** upang matiyak na ang anumang pagbabago sa account ay nilagdaan ng tamang partido o mga partido
- **Pagpapatunay ng account** ay nangangailangan ng pagtiyak na ang mga ibinigay na account ay ang mga account na inaasahan mong magiging mga ito, hal. pagkuha ng mga PDA na may inaasahang mga binhi upang matiyak na ang address ay tumutugma sa ibinigay na account
- Ang **Pagpapatunay ng data** ay nangangailangan ng pagtiyak na ang anumang ibinigay na data ay nakakatugon sa mga pamantayang kinakailangan ng programa

# Lesson

Sa huling dalawang aralin, pinagsikapan namin ang pagbuo ng programa sa Pagsusuri ng Pelikula. Ang resulta ay medyo cool! Nakakatuwang makakuha ng isang bagay na gumagana sa isang bagong kapaligiran sa pag-unlad.

Ang wastong pagbuo ng programa, gayunpaman, ay hindi nagtatapos sa "get it working." Mahalagang pag-isipan ang mga posibleng punto ng pagkabigo sa iyong code upang mapagaan ang mga ito. Ang mga punto ng pagkabigo ay kung saan posibleng mangyari ang hindi kanais-nais na pag-uugali sa iyong code. Mangyayari man ang hindi kanais-nais na pag-uugali dahil sa mga user na nakikipag-ugnayan sa iyong program sa hindi inaasahang paraan o sinasadya ng mga masasamang aktor na samantalahin ang iyong programa, ang pag-asa sa mga punto ng pagkabigo ay mahalaga upang ma-secure ang pagbuo ng programa.

Tandaan, **wala kang kontrol sa mga transaksyong ipapadala sa iyong programa kapag na-deploy na ito**. Maaari mo lamang kontrolin kung paano pinangangasiwaan ng iyong programa ang mga ito. Bagama't malayo ang araling ito sa isang komprehensibong pangkalahatang-ideya ng seguridad ng programa, tatalakayin namin ang ilan sa mga pangunahing pitfalls na dapat abangan.

## Think like an attacker

Nagbigay ng presentation si [Neodyme](https://workshop.neodyme.io/) sa Breakpoint 2021 na pinamagatang "Think Like An Attacker: Bringing Smart Contracts to Their Break(ing) Point." Kung mayroong isang bagay na aalisin mo sa araling ito, ito ay ang dapat mong isipin na parang isang umaatake.

Sa araling ito, siyempre, hindi namin maaaring saklawin ang lahat ng posibleng magkamali sa iyong mga programa. Sa huli, ang bawat programa ay magkakaroon ng iba't ibang panganib sa seguridad na nauugnay dito. Habang ang pag-unawa sa mga karaniwang pitfall ay *mahahalaga* sa pag-engineer ng magagandang programa, ito ay *hindi sapat* para sa pag-deploy ng mga secure na programa. Upang magkaroon ng pinakamalawak na saklaw ng seguridad na posible, kailangan mong lapitan ang iyong code nang may tamang pag-iisip.

Tulad ng nabanggit ni Neodyme sa kanilang presentasyon, ang tamang pag-iisip ay nangangailangan ng paglipat mula sa tanong na "Nasira ba ito?" sa "Paano ko ito masisira?" Ito ang una at pinakamahalagang hakbang sa pag-unawa sa kung ano ang *aktwal na ginagawa ng iyong code kumpara sa kung ano ang isinulat mo upang gawin ito.

### All programs can be broken

Ito ay hindi isang tanong ng "kung."

Sa halip, ito ay isang tanong ng "kung gaano karaming pagsisikap at dedikasyon ang kakailanganin."

Ang aming trabaho bilang mga developer ay magsara ng maraming butas hangga't maaari at dagdagan ang pagsisikap at dedikasyon na kinakailangan upang masira ang aming code. Halimbawa, sa programang Pagsusuri ng Pelikula na binuo namin nang magkasama sa huling dalawang aralin, nagsulat kami ng code para gumawa ng mga bagong account para mag-imbak ng mga review ng pelikula. Kung susuriin natin ang code, gayunpaman, mapapansin natin kung paano pinapadali din ng programa ang maraming hindi sinasadyang pag-uugali na madali nating mahuli sa pamamagitan ng pagtatanong ng "Paano ko ito masisira?" Susuriin natin ang ilan sa mga problemang ito at kung paano ayusin ang mga ito sa araling ito, ngunit tandaan na hindi sapat ang pagsasaulo ng ilang mga pitfalls. Nasa sa iyo na baguhin ang iyong mindset patungo sa seguridad.

## Error handling

Bago tayo sumisid sa ilan sa mga karaniwang pitfalls sa seguridad at kung paano maiiwasan ang mga ito, mahalagang malaman kung paano gumamit ng mga error sa iyong program. Habang ang iyong code ay maaaring pangasiwaan ang ilang mga isyu nang maganda, ang iba pang mga isyu ay mangangailangan na ang iyong programa ay huminto sa pagpapatupad at magbalik ng isang error sa programa.

### How to create errors

Habang ang `solana_program` crate ay nagbibigay ng `ProgramError` na enum na may listahan ng mga generic na error na magagamit namin, kadalasan ay magiging kapaki-pakinabang na gumawa ng sarili mong error. Ang iyong mga custom na error ay makakapagbigay ng higit pang konteksto at detalye habang nagde-debug ka sa iyong code.

Maaari nating tukuyin ang sarili nating mga error sa pamamagitan ng paggawa ng uri ng enum na naglilista ng mga error na gusto nating gamitin. Halimbawa, ang `NoteError` ay naglalaman ng mga variant na `Forbidden` at `InvalidLength`. Ang enum ay ginawang Rust `Error` na uri sa pamamagitan ng paggamit ng `derive` attribute macro para ipatupad ang `Error` na katangian mula sa `thiserror` na library. Ang bawat uri ng error ay mayroon ding sariling `#[error("...")]` notation. Hinahayaan ka nitong magbigay ng mensahe ng error para sa bawat partikular na uri ng error.

```rust
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Error)]
pub enum NoteError {
    #[error("Wrong note owner")]
    Forbidden,

    #[error("Text is too long")]
    InvalidLength,
}
```

### How to return errors

Inaasahan ng compiler na ang mga error na ibinalik ng program ay may uri ng `ProgramError` mula sa `solana_program` crate. Nangangahulugan iyon na hindi namin maibabalik ang aming custom na error maliban kung mayroon kaming paraan upang i-convert ito sa ganitong uri. Ang sumusunod na pagpapatupad ay humahawak ng conversion sa pagitan ng aming custom na error at ang uri ng `ProgramError`.

```rust
impl From<NoteError> for ProgramError {
    fn from(e: NoteError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Upang ibalik ang custom na error mula sa program, gamitin lang ang `into()` na paraan upang i-convert ang error sa isang instance ng `ProgramError`.

```rust
if pda != *note_pda.key {
    return Err(NoteError::Forbidden.into());
}
```

## Basic security checks

Bagama't hindi komprehensibong mase-secure ng mga ito ang iyong programa, may ilang mga pagsusuri sa seguridad na maaari mong tandaan upang punan ang ilan sa mas malalaking gaps sa iyong code:

- Pagsusuri sa pagmamay-ari - ginagamit upang i-verify na ang isang account ay pagmamay-ari ng programa
- Mga tseke ng lumagda - ginagamit upang i-verify na ang isang account ay lumagda sa isang transaksyon
- Pangkalahatang Pagpapatunay ng Account - ginagamit upang i-verify na ang isang account ay ang inaasahang account
- Data Validation - ginagamit upang i-verify ang mga input na ibinigay ng isang user

### Ownership checks

Ang pagsusuri sa pagmamay-ari ay nagpapatunay na ang isang account ay pagmamay-ari ng inaasahang pampublikong susi. Gamitin natin ang halimbawa ng note-taking app na na-reference natin sa mga nakaraang aralin. Sa app na ito, ang mga user ay maaaring gumawa, mag-update, at magtanggal ng mga tala na iniimbak ng program sa mga PDA account.

Kapag tinawag ng user ang tagubiling `update`, nagbibigay din sila ng `pda_account`. Ipinapalagay namin na ang ibinigay na `pda_account` ay para sa partikular na tala na gusto nilang i-update, ngunit maaaring magpasok ang user ng anumang data ng pagtuturo na gusto nila. Maaari pa nga silang magpadala ng data na tumutugma sa format ng data ng isang note account ngunit hindi rin ginawa ng programa ng note-taking. Ang kahinaan sa seguridad na ito ay isang potensyal na paraan upang ipakilala ang malisyosong code.

Ang pinakasimpleng paraan upang maiwasan ang problemang ito ay palaging suriin kung ang may-ari ng isang account ay ang pampublikong susi na inaasahan mong magiging ito. Sa kasong ito, inaasahan namin na ang note account ay isang PDA account na pagmamay-ari ng mismong programa. Kapag hindi ito ang kaso, maaari naming iulat ito bilang isang error nang naaayon.

```rust
if note_pda.owner != program_id {
    return Err(ProgramError::InvalidNoteAccount);
}
```

Bilang isang side note, ang paggamit ng mga PDA hangga't maaari ay mas secure kaysa sa pagtitiwala sa mga account na pag-aari ng panlabas, kahit na pag-aari ang mga ito ng lumagda sa transaksyon. Ang tanging mga account na may kumpletong kontrol sa programa ay ang mga PDA account, na ginagawa itong pinaka-secure.

### Pagsusuri ng lumagda

Ang isang signer check ay nagpapatunay lamang na ang mga tamang partido ay lumagda sa isang transaksyon. Sa note-taking app, halimbawa, gusto naming i-verify na nilagdaan ng tagalikha ng tala ang transaksyon bago namin iproseso ang tagubiling `update`. Kung hindi, maaaring i-update ng sinuman ang mga tala ng isa pang user sa pamamagitan lamang ng pagpasa sa pampublikong key ng user bilang initializer.

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### General account validation

Bilang karagdagan sa pagsusuri sa mga lumagda at may-ari ng mga account, mahalagang tiyakin na ang mga ibinigay na account ay kung ano ang inaasahan ng iyong code sa kanila. Halimbawa, nais mong patunayan na ang isang ibinigay na address ng PDA account ay maaaring makuha kasama ng mga inaasahang binhi. Tinitiyak nito na ito ang account na iyong inaasahan.

Sa halimbawa ng note-taking app, nangangahulugan iyon ng pagtiyak na makakakuha ka ng tumutugmang PDA gamit ang pampublikong key ng gumawa ng tala at ang ID bilang mga buto (iyon ang ipinapalagay naming ginamit noong ginagawa ang tala). Sa ganoong paraan ang isang user ay hindi maaaring aksidenteng makapasa sa isang PDA account para sa maling tala o, higit sa lahat, na ang user ay hindi pumasa sa isang PDA account na kumakatawan sa tala ng ibang tao nang buo.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);

if pda != *note_pda.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument)
}
```

## Data validation

Katulad ng pagpapatunay ng mga account, dapat mo ring i-validate ang anumang data na ibinigay ng kliyente.

Halimbawa, maaari kang magkaroon ng program ng laro kung saan maaaring maglaan ang isang user ng mga puntos ng katangian ng character sa iba't ibang kategorya. Maaari kang magkaroon ng maximum na limitasyon sa bawat kategorya na 100, kung saan gugustuhin mong i-verify na ang umiiral na alokasyon ng mga puntos at ang bagong alokasyon ay hindi lalampas sa maximum.

```rust
if character.agility + new_agility > 100 {
    msg!("Attribute points cannot exceed 100");
    return Err(AttributeError::TooHigh.into())
}
```

O, ang karakter ay maaaring may allowance ng mga attribute point na maaari niyang ilaan at gusto mong tiyakin na hindi sila lalampas sa allowance na iyon.

```rust
if attribute_allowance < new_agility {
    msg!("Trying to allocate more points than allowed");
    return Err(AttributeError::ExceedsAllowance.into())
}
```

Kung wala ang mga pagsusuring ito, mag-iiba ang gawi ng programa sa iyong inaasahan. Sa ilang mga kaso, gayunpaman, ito ay higit pa sa isang isyu ng hindi natukoy na pag-uugali. Minsan ang hindi pag-validate ng data ay maaaring magresulta sa mga butas sa seguridad na nakakasira sa pananalapi.

Halimbawa, isipin na ang karakter na tinutukoy sa mga halimbawang ito ay isang NFT. Dagdag pa, isipin na ang programa ay nagpapahintulot sa NFT na ma-stake upang makakuha ng mga gantimpala ng token na proporsyonal sa bilang ng mga puntos ng katangian ng NFT. Ang pagkabigong ipatupad ang mga pagsusuri sa pagpapatunay ng data na ito ay magbibigay-daan sa isang masamang aktor na magtalaga ng isang malaswang mataas na bilang ng mga puntos ng katangian at mabilis na maubos ang iyong treasury ng lahat ng mga gantimpala na sinadya upang maikalat nang mas pantay-pantay sa mas malaking grupo ng mga staker.

### Integer overflow and underflow

Ang mga kalawang integer ay may mga nakapirming laki. Nangangahulugan ito na maaari lamang nilang suportahan ang isang partikular na hanay ng mga numero. Ang isang aritmetika na operasyon na nagreresulta sa isang mas mataas o mas mababang halaga kaysa sa kung ano ang sinusuportahan ng hanay ay magiging sanhi ng magreresultang halaga upang balutin. Halimbawa, ang `u8` ay sumusuporta lamang sa mga numerong 0-255, kaya ang resulta ng pagdaragdag na magiging 256 ay magiging 0, 257 ay magiging 1, atbp.

Ito ay palaging mahalaga na tandaan, ngunit lalo na kapag nakikitungo sa anumang code na kumakatawan sa tunay na halaga, tulad ng pagdedeposito at pag-withdraw ng mga token.

Upang maiwasan ang integer overflow at underflow, alinman sa:

1. Magkaroon ng lohika sa lugar na nagsisigurong overflow o underflow *hindi* maaaring mangyari o
2. Gumamit ng checked math tulad ng `checked_add` sa halip na `+`
    ```rust
    let first_int: u8 = 5;
    let second_int: u8 = 255;
    let sum = first_int.checked_add(second_int);
    ```

# Demo

Magsanay tayo kasama ang programa ng Pagsusuri ng Pelikula na ginawa natin sa mga nakaraang aralin. Huwag mag-alala kung papasok ka lang sa araling ito nang hindi mo nagawa ang nakaraang aralin - dapat ay posible na sumunod sa alinmang paraan.

Bilang isang pag-refresh, hinahayaan ng programa ng Pagsusuri ng Pelikula ang mga user na mag-imbak ng mga review ng pelikula sa mga PDA account. Noong nakaraang aralin, natapos namin ang pagpapatupad ng pangunahing pagpapaandar ng pagdaragdag ng pagsusuri sa pelikula. Ngayon, magdadagdag kami ng ilang mga pagsusuri sa seguridad sa functionality na nagawa na namin at magdagdag ng kakayahang mag-update ng review ng pelikula sa isang secure na paraan.

Gaya ng dati, gagamitin namin ang [Solana Playground](https://beta.solpg.io/) upang isulat, buuin, at i-deploy ang aming code.

## 1. Get the starter code

Upang magsimula, mahahanap mo [ang movie review starter code](https://beta.solpg.io/62b552f3f6273245aca4f5c9). Kung sinusundan mo ang mga demo ng Pagsusuri ng Pelikula, mapapansin mo na ni-refactor namin ang aming programa.

Ang refactored starter code ay halos kapareho ng dati. Dahil ang `lib.rs` ay nagiging medyo malaki at mahirap gamitin, pinaghiwalay namin ang code nito sa 3 file: `lib.rs`, `entrypoint.rs`, at `processor.rs`. Ang `lib.rs` ngayon *lamang* ay nagrerehistro ng mga module ng code, ang `entrypoint.rs` *lamang* ay tumutukoy at nagtatakda ng entrypoint ng program, at ang `processor.rs` ay pinangangasiwaan ang logic ng program para sa mga tagubilin sa pagproseso. Nagdagdag din kami ng `error.rs` file kung saan tutukuyin namin ang mga custom na error. Ang kumpletong istraktura ng file ay ang mga sumusunod:

- **lib.rs** - magrehistro ng mga module
- **entrypoint.rs -** entry point sa programa
- **instruction.rs -** i-serialize at deserialize ang data ng pagtuturo
- **processor.rs -** logic ng program upang iproseso ang mga tagubilin
- **state.rs -** serialize at deserialize state
- **error.rs -** custom na mga error sa program

Bilang karagdagan sa ilang mga pagbabago sa istraktura ng file, nag-update kami ng isang maliit na halaga ng code na hahayaan ang demo na ito na mas nakatuon sa seguridad nang hindi ka nagsusulat ng hindi kinakailangang boiler plate.

Dahil papayagan namin ang mga update sa mga review ng pelikula, binago rin namin ang `account_len` sa function na `add_movie_review` (ngayon ay nasa `processor.rs`). Sa halip na kalkulahin ang laki ng review at itakda ang haba ng account sa kasing laki lang ng kailangan, maglalaan lang kami ng 1000 byte sa bawat review account. Sa ganitong paraan, hindi namin kailangang mag-alala tungkol sa muling pagtatalaga ng laki o muling pagkalkula ng renta kapag na-update ng isang user ang kanilang pagsusuri sa pelikula.

Nagpunta kami mula dito:
```rust
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
```

Sa ganito:
```rust
let account_len: usize = 1000;
```

Ang [realloc](https://docs.rs/solana-sdk/latest/solana_sdk/account_info/struct.AccountInfo.html#method.realloc) na pamamaraan ay kamakailan lamang pinagana ng Solana Labs na nagbibigay-daan sa iyong dynamic na baguhin ang laki ng iyong mga account. Hindi namin gagamitin ang paraang ito para sa demo na ito, ngunit ito ay isang bagay na dapat malaman.

Sa wakas, nagpatupad din kami ng ilang karagdagang functionality para sa aming `MovieAccountState` struct sa `state.rs` gamit ang `impl` na keyword.

Para sa aming mga pagsusuri sa pelikula, gusto namin ang kakayahang suriin kung nasimulan na ang isang account. Para magawa ito, gagawa kami ng function na `is_initialized` na sumusuri sa field na `is_initialized` sa struct ng `MovieAccountState`.

Ang `Sealed` ay ang bersyon ni Solana ng `Sized` na katangian ni Rust. Tinutukoy lang nito na ang `MovieAccountState` ay may alam na laki at nagbibigay ito ng ilang pag-optimize ng compiler.

```rust
// inside state.rs
impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Bago magpatuloy, tiyaking mayroon kang matatag na kaalaman sa kasalukuyang estado ng programa. Tingnan ang code at gumugol ng ilang oras sa pag-iisip sa anumang mga lugar na nakakalito sa iyo. Maaaring makatulong na ihambing ang starter code sa [code ng solusyon mula sa nakaraang aralin](https://beta.solpg.io/62b23597f6273245aca4f5b4).

## 2. Custom Errors

Magsimula tayo sa pagsulat ng aming mga custom na error sa programa. Kakailanganin namin ang mga error na magagamit namin sa mga sumusunod na sitwasyon:

- Ang tagubilin sa pag-update ay na-invoke sa isang account na hindi pa nasisimulan
- Ang ibinigay na PDA ay hindi tumutugma sa inaasahan o nagmula na PDA
- Ang input data ay mas malaki kaysa sa pinapayagan ng programa
- Ang ibinigay na rating ay hindi nahuhulog sa hanay na 1-5

Ang starter code ay may kasamang walang laman na `error.rs` file. Buksan ang file na iyon at magdagdag ng mga error para sa bawat isa sa mga kaso sa itaas.

```rust
// inside error.rs
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReviewError{
    // Error 0
    #[error("Account not initialized yet")]
    UninitializedAccount,
    // Error 1
    #[error("PDA derived does not equal PDA passed in")]
    InvalidPDA,
    // Error 2
    #[error("Input data exceeds max length")]
    InvalidDataLength,
    // Error 3
    #[error("Rating greater than 5 or less than 1")]
    InvalidRating,
}

impl From<ReviewError> for ProgramError {
    fn from(e: ReviewError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Tandaan na bilang karagdagan sa pagdaragdag ng mga kaso ng error, idinagdag din namin ang pagpapatupad na nagbibigay-daan sa amin na i-convert ang aming error sa isang uri ng `ProgramError` kung kinakailangan.

Bago magpatuloy, dalhin natin ang `ReviewError` sa saklaw sa `processor.rs`. Gagamitin namin ang mga error na ito sa ilang sandali kapag idinagdag namin ang aming mga pagsusuri sa seguridad.

```rust
// inside processor.rs
use crate::error::ReviewError;
```

## 3. Add security checks to `add_movie_review`

Ngayon na mayroon kaming mga error na gagamitin, ipatupad natin ang ilang mga pagsusuri sa seguridad sa aming function na `add_movie_review`.

### Signer check

Ang unang bagay na dapat nating gawin ay tiyakin na ang `initializer` ng isang pagsusuri ay isa ring lumagda sa transaksyon. Tinitiyak nito na hindi ka makakapagsumite ng mga review ng pelikula na nagpapanggap bilang ibang tao. Ilalagay namin ang tseke na ito pagkatapos ng pag-ulit sa mga account.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;

if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Account validation

Susunod, siguraduhin nating ang `pda_account` na ipinasa ng user ay ang `pda` na inaasahan namin. Tandaan na nakuha namin ang `pda` para sa isang pagsusuri ng pelikula gamit ang `initializer` at `title` bilang mga buto. Sa loob ng aming pagtuturo, kukunin naming muli ang `pda` at pagkatapos ay titingnan kung tumutugma ito sa `pda_account`. Kung hindi magkatugma ang mga address, ibabalik namin ang aming custom na `InvalidPDA` na error.

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Data validation

Ngayon magsagawa tayo ng ilang pagpapatunay ng data.

Magsisimula tayo sa pamamagitan ng pagtiyak na ang `rating` ay nasa loob ng 1 hanggang 5 na sukat. Kung ang rating na ibinigay ng user sa labas ng hanay na ito, ibabalik namin ang aming custom na `InvalidRating` na error.

```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}
```

Susunod, suriin natin na ang nilalaman ng pagsusuri ay hindi lalampas sa 1000 byte na inilaan namin para sa account. Kung lumampas ang laki sa 1000 bytes, ibabalik namin ang aming custom na `InvalidDataLength` na error.

```rust
let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

Panghuli, tingnan natin kung nasimulan na ang account sa pamamagitan ng pagtawag sa function na `is_initialized` na ipinatupad namin para sa aming `MovieAccountState`. Kung umiiral na ang account, magbabalik kami ng error.

```rust
if account_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

Sa kabuuan, ang function na `add_movie_review` ay dapat magmukhang ganito:

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Adding movie review...");
    msg!("Title: {}", title);
    msg!("Rating: {}", rating);
    msg!("Description: {}", description);

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

    let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ProgramError::InvalidArgument)
    }

    if rating > 5 || rating < 1 {
        msg!("Rating cannot be higher than 5");
        return Err(ReviewError::InvalidRating.into())
    }

    let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
    if total_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    let account_len: usize = 1000;

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

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

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("borrowed account data");

    msg!("checking if movie account is already initialized");
    if account_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    account_data.title = title;
    account_data.rating = rating;
    account_data.description = description;
    account_data.is_initialized = true;

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}
```

## 4. Support movie review updates in `MovieInstruction`

Ngayong mas secure na ang `add_movie_review`, ibaling natin ang ating atensyon sa pagsuporta sa kakayahang mag-update ng review ng pelikula.

Magsimula tayo sa pag-update ng `instruction.rs`. Magsisimula kami sa pamamagitan ng pagdaragdag ng variant ng `UpdateMovieReview` sa `MovieInstruction` na may kasamang naka-embed na data para sa bagong pamagat, rating, at paglalarawan.

```rust
// inside instruction.rs
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String
    }
}
```

Maaaring manatiling pareho ang payload struct dahil bukod sa uri ng variant, ang data ng pagtuturo ay pareho sa ginamit namin para sa `AddMovieReview`.

Panghuli, sa `unpack` function na kailangan naming magdagdag ng `UpdateMovieReview` sa match statement.

```rust
// inside instruction.rs
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            1 => Self::UpdateMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

## 5. Define `update_movie_review` function

Ngayon na maaari na naming i-unpack ang aming `instruction_data` at matukoy kung aling pagtuturo ng program ang tatakbo, maaari naming idagdag ang `UpdateMovieReview` sa match statement sa `process_instruction` function sa `processor.rs` file.

```rust
// inside processor.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // unpack instruction data
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        // add UpdateMovieReview to match against our new data structure
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            // make call to update function that we'll define next
            update_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

Susunod, maaari naming tukuyin ang bagong function na `update_movie_review`. Ang kahulugan ay dapat na may parehong mga parameter tulad ng kahulugan ng `add_movie_review`.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

}
```

## 6. Implement `update_movie_review` function

Ang natitira na lang ngayon ay punan ang lohika para sa pag-update ng isang pagsusuri sa pelikula. Lamang gawin itong secure mula sa simula.

Tulad ng function na `add_movie_review`, magsimula tayo sa pamamagitan ng pag-ulit sa mga account. Ang mga account lang na kakailanganin namin ay ang unang dalawa: `initializer` at `pda_account`.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Updating movie review...");

    // Get Account iterator
    let account_info_iter = &mut accounts.iter();

    // Get accounts
    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

}
```

### Ownership Check

Bago tayo magpatuloy, ipatupad natin ang ilang pangunahing pagsusuri sa seguridad. Magsisimula kami sa isang pagsusuri sa pagmamay-ari para sa `pda_account` upang i-verify na ito ay pagmamay-ari ng aming programa. Kung hindi, magbabalik kami ng `InvalidOwner` na error.

```rust
if pda_account.owner != program_id {
    return Err(ProgramError::InvalidOwner)
}
```

### Signer Check

Susunod, magsagawa tayo ng signer check upang i-verify na ang `initializer` ng tagubilin sa pag-update ay nilagdaan din ang transaksyon. Dahil ina-update namin ang data para sa pagsusuri ng pelikula, gusto naming tiyakin na inaprubahan ng orihinal na `initializer` ng pagsusuri ang mga pagbabago sa pamamagitan ng paglagda sa transaksyon. Kung hindi nilagdaan ng `initializer` ang transaksyon, magbabalik kami ng error.

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Account Validation

Susunod, tingnan natin kung ang `pda_account` na ipinasa ng user ay ang PDA na inaasahan namin sa pamamagitan ng pagkuha ng PDA gamit ang `initializer` at `title` bilang mga binhi. Kung hindi magkatugma ang mga address, ibabalik namin ang aming custom na `InvalidPDA` na error. Ipapatupad namin ito sa parehong paraan na ginawa namin sa function na `add_movie_review`.

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Unpack `pda_account` and perform data validation

Ngayong tinitiyak ng aming code na mapagkakatiwalaan natin ang mga naipasa sa mga account, i-unpack natin ang `pda_account` at magsagawa ng ilang pagpapatunay ng data. Magsisimula kami sa pamamagitan ng pag-unpack ng `pda_account` at pagtatalaga nito sa isang nababagong variable na `account_data`.

```rust
msg!("unpacking state account");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("borrowed account data");
```

Ngayon na mayroon na kaming access sa account at sa mga field nito, ang unang bagay na kailangan naming gawin ay i-verify na ang account ay nasimulan na. Hindi maa-update ang isang hindi nasimulang account kaya dapat ibalik ng program ang aming custom na `UninitializedAccount` na error.

```rust
if !account_data.is_initialized() {
    msg!("Account is not initialized");
    return Err(ReviewError::UninitializedAccount.into());
}
```

Susunod, kailangan nating i-validate ang data ng `rating`, `title`, at `description` tulad ng sa function na `add_movie_review`. Gusto naming limitahan ang `rating` sa sukat na 1 hanggang 5 at limitahan ang kabuuang sukat ng pagsusuri na mas mababa sa 1000 byte. Kung ang rating na ibinigay ng user sa labas ng hanay na ito, ibabalik namin ang aming custom na `InvalidRating` na error. Kung masyadong mahaba ang pagsusuri, ibabalik namin ang aming custom na `InvalidDataLength` na error.

```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}

let total_len: usize = 1 + 1 + (4 + account_data.title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

### Update the movie review account

Ngayong naipatupad na namin ang lahat ng mga pagsusuring panseguridad, sa wakas ay maa-update na namin ang account sa pagsusuri ng pelikula sa pamamagitan ng pag-update sa `account_data` at muling pagse-serye nito. Sa puntong iyon, maaari naming ibalik ang `Ok` mula sa aming programa.

```rust
account_data.rating = rating;
account_data.description = description;

account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

Ok(())
```

Kung magkakasama, ang function na `update_movie_review` ay dapat magmukhang katulad ng code snippet sa ibaba. Nagsama kami ng ilang karagdagang pag-log para sa kalinawan sa pag-debug.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Updating movie review...");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

    if pda_account.owner != program_id {
      return Err(ProgramError::IllegalOwner)
    }

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("review title: {}", account_data.title);

    let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    msg!("checking if movie account is initialized");
    if !account_data.is_initialized() {
        msg!("Account is not initialized");
        return Err(ReviewError::UninitializedAccount.into());
    }

    if rating > 5 || rating < 1 {
        msg!("Invalid Rating");
        return Err(ReviewError::InvalidRating.into())
    }

    let update_len: usize = 1 + 1 + (4 + description.len()) + account_data.title.len();
    if update_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    msg!("Review before update:");
    msg!("Title: {}", account_data.title);
    msg!("Rating: {}", account_data.rating);
    msg!("Description: {}", account_data.description);

    account_data.rating = rating;
    account_data.description = description;

    msg!("Review after update:");
    msg!("Title: {}", account_data.title);
    msg!("Rating: {}", account_data.rating);
    msg!("Description: {}", account_data.description);

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}
```

## 7. Build and upgrade

Handa na kaming buuin at i-upgrade ang aming programa! Maaari mong subukan ang iyong programa sa pamamagitan ng pagsusumite ng isang transaksyon na may tamang data ng pagtuturo. Para diyan, huwag mag-atubiling gamitin itong [frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews). Tandaan, upang matiyak na sinusubukan mo ang tamang program, kakailanganin mong palitan ang `MOVIE_REVIEW_PROGRAM_ID` ng iyong program ID sa `Form.tsx` at `MovieCoordinator.ts`.

Kung kailangan mo ng mas maraming oras sa proyektong ito upang maging komportable sa mga konseptong ito, tingnan ang [code ng solusyon](https://beta.solpg.io/62c8c6dbf6273245aca4f5e7) bago magpatuloy.

# Challenge

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa sa pamamagitan ng pagbuo sa itaas ng programa ng Student Intro na ginamit mo sa mga nakaraang aralin. Kung hindi mo pa sinusubaybayan o hindi mo pa nai-save ang iyong code mula noon, huwag mag-atubiling gamitin ang [starter code na ito](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).

Ang Student Intro program ay isang Solana Program na nagbibigay-daan sa mga mag-aaral na magpakilala. Kinukuha ng program ang pangalan ng isang user at isang maikling mensahe bilang instruction_data at gagawa ng account upang iimbak ang data sa chain.

Gamit ang iyong natutunan sa araling ito, subukang ilapat ang iyong natutunan sa Student Intro Program. Ang programa ay dapat:

1. Magdagdag ng pagtuturo na nagpapahintulot sa mga mag-aaral na i-update ang kanilang mensahe
2. Ipatupad ang mga pangunahing pagsusuri sa seguridad na natutunan natin sa araling ito

Subukang gawin ito nang nakapag-iisa kung kaya mo! Ngunit kung natigil ka, huwag mag-atubiling sumangguni sa [code ng solusyon](https://beta.solpg.io/62c9120df6273245aca4f5e8). Tandaan na ang iyong code ay maaaring magmukhang bahagyang naiiba kaysa sa code ng solusyon depende sa mga tseke na iyong ipinapatupad at ang mga error na iyong isinulat. Kapag nakumpleto mo na ang Module 3, gusto naming malaman ang higit pa tungkol sa iyong karanasan! Huwag mag-atubiling [magbahagi ng ilang mabilis na feedback](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%203), nang sa gayon ay maaari naming patuloy na mapabuti ang kurso.
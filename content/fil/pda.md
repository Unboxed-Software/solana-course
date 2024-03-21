---
title: PDAs
objectives:
- Ipaliwanag ang Programa Derived Addresses (PDAs)
- Ipaliwanag ang iba't ibang kaso ng paggamit ng mga PDA
- Ilarawan kung paano hinango ang mga PDA
- Gumamit ng mga derivasyon ng PDA upang hanapin at kunin ang data
---


# TL;DR

- Ang **Program Derived Address** (PDA) ay hinango mula sa isang **program ID** at isang opsyonal na listahan ng **seeds**
- Ang mga PDA ay pagmamay-ari at kinokontrol ng programa kung saan sila nagmula
- Ang derivation ng PDA ay nagbibigay ng deterministikong paraan upang maghanap ng data batay sa mga buto na ginamit para sa derivation
- Maaaring gamitin ang mga buto upang i-map ang data na nakaimbak sa isang hiwalay na PDA account
- Maaaring lagdaan ng isang programa ang mga tagubilin sa ngalan ng mga PDA na nagmula sa ID nito

# Lesson

## What is a Program Derived Address?

Ang Program Derived Addresses (Mga PDA) ay mga address ng account na idinisenyo upang pirmahan ng isang programa sa halip na isang lihim na susi. Gaya ng ipinahihiwatig ng pangalan, ang mga PDA ay hinango gamit ang isang program ID. Opsyonal, ang mga hinangong account na ito ay matatagpuan din gamit ang ID kasama ng isang set ng "mga buto." Higit pa tungkol dito sa ibang pagkakataon, ngunit ang mga binhing ito ay gaganap ng mahalagang papel sa kung paano namin ginagamit ang mga PDA para sa pag-iimbak at pagkuha ng data.

Ang mga PDA ay nagsisilbi ng dalawang pangunahing tungkulin:

1. Magbigay ng isang tiyak na paraan upang mahanap ang address ng isang account na pagmamay-ari ng program
2. Pahintulutan ang programa kung saan nagmula ang isang PDA na mag-sign sa ngalan nito sa parehong paraan na maaaring mag-sign ang isang user gamit ang kanilang sikretong key

Sa araling ito, tututuon tayo sa paggamit ng mga PDA upang maghanap at mag-imbak ng data. Tatalakayin natin ang pagpirma sa isang PDA nang mas masinsinan sa isang aralin sa hinaharap kung saan sinasaklaw natin ang Cross Program Invocations (CPIs).

## Finding PDAs

Ang mga PDA ay hindi teknikal na nilikha. Sa halip, ang mga ito ay *hinahanap* o *hinango* batay sa isang program ID at isa o higit pang mga input seed.

Ang mga keypair ng Solana ay matatagpuan sa tinatawag na Ed25519 Elliptic Curve (Ed25519). Ang Ed25519 ay isang deterministikong signature scheme na ginagamit ni Solana upang makabuo ng kaukulang pampubliko at lihim na mga susi. Sama-sama, tinatawag nating mga keypair ang mga ito.

Bilang kahalili, ang mga PDA ay mga address na nasa *off* ng Ed25519 curve. Nangangahulugan ito na ang mga PDA ay hindi mga pampublikong susi, at walang mga pribadong susi. Ang pag-aari na ito ng mga PDA ay mahalaga para makapag-sign ang mga programa sa kanilang ngalan, ngunit tatalakayin natin iyon sa susunod na aralin.

Upang maghanap ng PDA sa loob ng isang Solana program, gagamitin namin ang function na `find_program_address`. Ang function na ito ay tumatagal ng opsyonal na listahan ng "mga buto" at isang program ID bilang mga input, at pagkatapos ay ibinabalik ang PDA at isang bump seed.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[user.key.as_ref(), user_input.as_bytes().as_ref(), "SEED".as_bytes()], program_id)
```

### Seeds

Ang "Seeds" ay mga opsyonal na input na ginagamit sa function na `find_program_address` upang makakuha ng PDA. Halimbawa, ang mga buto ay maaaring maging anumang kumbinasyon ng mga pampublikong key, mga input na ibinigay ng isang user, o mga hardcoded na halaga. Ang isang PDA ay maaari ding makuha gamit lamang ang program ID at walang karagdagang mga buto. Ang paggamit ng mga buto upang mahanap ang aming mga PDA, gayunpaman, ay nagpapahintulot sa amin na lumikha ng isang arbitrary na bilang ng mga account na maaaring pagmamay-ari ng aming programa.

Habang ikaw, ang nag-develop, ay tinutukoy ang mga binhi na ipapasa sa function na `find_program_address`, ang function mismo ay nagbibigay ng karagdagang binhi na tinatawag na "bump seed." Ang cryptographic function para sa pagkuha ng isang PDA ay nagreresulta sa isang key na nasa *sa* Ed25519 curve halos 50% ng oras. Upang matiyak na ang resulta *ay wala* sa Ed25519 curve at samakatuwid ay walang lihim na key, ang function na `find_program_address` ay nagdaragdag ng numeric seed na tinatawag na bump seed.

Magsisimula ang function sa pamamagitan ng paggamit ng value na `255` bilang bump seed, pagkatapos ay titingnan kung valid PDA ang output. Kung ang resulta ay hindi wastong PDA, binabawasan ng function ang bump seed ng 1 at susubukang muli (`255`, `254`, `253`, at iba pa). Kapag natagpuan ang isang wastong PDA, ibabalik ng function ang PDA at ang bump na ginamit upang makuha ang PDA.

### Under the hood of `find_program_address`

Tingnan natin ang source code para sa `find_program_address`.

```rust
 pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Self::try_find_program_address(seeds, program_id)
        .unwrap_or_else(|| panic!("Unable to find a viable program address bump seed"))
}
```

Sa ilalim ng hood, ipinapasa ng function na `find_program_address` ang input na `seeds` at `program_id` sa function na `try_find_program_address`.

Ang function na `try_find_program_address` ay ipinakilala ang `bump_seed`. Ang `bump_seed` ay isang `u8` na variable na may value na nasa pagitan ng 0 hanggang 255. Ang pag-ulit sa isang pababang hanay na nagsisimula sa 255, ang isang `bump_seed` ay idinaragdag sa mga opsyonal na input seed na pagkatapos ay ipapasa sa `create_program_address` function. Kung ang output ng `create_program_address` ay hindi wastong PDA, ang `bump_seed` ay babawasan ng 1 at ang loop ay magpapatuloy hanggang sa may makitang valid na PDA.

```rust
pub fn try_find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> Option<(Pubkey, u8)> {

    let mut bump_seed = [std::u8::MAX];
    for _ in 0..std::u8::MAX {
        {
            let mut seeds_with_bump = seeds.to_vec();
            seeds_with_bump.push(&bump_seed);
            match Self::create_program_address(&seeds_with_bump, program_id) {
                Ok(address) => return Some((address, bump_seed[0])),
                Err(PubkeyError::InvalidSeeds) => (),
                _ => break,
            }
        }
        bump_seed[0] -= 1;
    }
    None

}
```

Ang function na `create_program_address` ay nagsasagawa ng isang set ng hash operations sa mga seeds at `program_id`. Ang mga operasyong ito ay nagku-compute ng isang susi, pagkatapos ay i-verify kung ang na-compute na key ay nasa Ed25519 elliptic curve o hindi. Kung may nakitang valid na PDA (ibig sabihin, isang address na *off* the curve), ibabalik ang PDA. Kung hindi, may ibabalik na error.

```rust
pub fn create_program_address(
    seeds: &[&[u8]],
    program_id: &Pubkey,
) -> Result<Pubkey, PubkeyError> {

    let mut hasher = crate::hash::Hasher::default();
    for seed in seeds.iter() {
        hasher.hash(seed);
    }
    hasher.hashv(&[program_id.as_ref(), PDA_MARKER]);
    let hash = hasher.result();

    if bytes_are_curve_point(hash) {
        return Err(PubkeyError::InvalidSeeds);
    }

    Ok(Pubkey::new(hash.as_ref()))

}
```

Sa kabuuan, ipinapasa ng function na `find_program_address` ang aming mga input seed at `program_id` sa function na `try_find_program_address`. Ang function na `try_find_program_address` ay nagdaragdag ng `bump_seed` (nagsisimula sa 255) sa aming mga input seed, pagkatapos ay tinatawagan ang function na `create_program_address` hanggang sa makita ang isang wastong PDA. Kapag nahanap na, ibabalik ang PDA at ang `bump_seed`.

Tandaan na para sa parehong mga input seed, ang iba't ibang valid na bump ay bubuo ng iba't ibang valid na PDA. Ang `bump_seed` na ibinalik ng `find_program_address` ay palaging magiging unang balidong PDA na makikita. Dahil ang function ay nagsisimula sa isang `bump_seed` na halaga na 255 at umuulit pababa sa zero, ang `bump_seed` na sa huli ay maibabalik ay palaging ang pinakamalaking wastong 8-bit na halaga na posible. Ang `bump_seed` na ito ay karaniwang tinutukoy bilang "*canonical bump*". Upang maiwasan ang pagkalito, inirerekumenda na gamitin lamang ang canonical bump, at *palaging i-validate ang bawat PDA na ipinasa sa iyong programa.*

Ang isang puntong dapat bigyang-diin ay ang function na `find_program_address` ay nagbabalik lamang ng Programa Derived Address at ang bump seed na ginamit upang makuha ito. Ang function na `find_program_address` ay *hindi* nagpapasimula ng isang bagong account, o anumang PDA na ibinalik ng function ay kinakailangang nauugnay sa isang account na nag-iimbak ng data.

## Use PDA accounts to store data

Dahil ang mga programa mismo ay walang estado, ang estado ng programa ay pinamamahalaan sa pamamagitan ng mga panlabas na account. Dahil maaari kang gumamit ng mga buto para sa pagmamapa at ang mga programa ay maaaring mag-sign sa kanilang ngalan, ang paggamit ng mga PDA account upang mag-imbak ng data na nauugnay sa programa ay isang napakakaraniwang pagpipilian sa disenyo. Bagama't maaaring tawagan ng mga program ang System Program upang lumikha ng mga hindi PDA na account at gamitin din ang mga iyon upang mag-imbak ng data, ang mga PDA ay malamang na ang paraan upang pumunta.

Kung kailangan mo ng refresher kung paano mag-imbak ng data sa mga PDA, tingnan ang [Gumawa ng Basic Program, Part 2 - State Management lesson](../program-state-management.md).

## Map to data stored in PDA accounts

Ang pag-iimbak ng data sa mga PDA account ay kalahati lamang ng equation. Kailangan mo rin ng paraan para makuha ang data na iyon. Pag-uusapan natin ang tungkol sa dalawang diskarte:

1. Paglikha ng isang PDA "mapa" na account na nag-iimbak ng mga address ng iba't ibang mga account kung saan ang data ay nakaimbak
2. Madiskarteng paggamit ng mga buto upang mahanap ang naaangkop na mga PDA account at makuha ang kinakailangang data

### Map to data using PDA "map" accounts

Ang isang diskarte sa pag-aayos ng pag-iimbak ng data ay ang pag-imbak ng mga kumpol ng nauugnay na data sa sarili nilang mga PDA at pagkatapos ay magkaroon ng hiwalay na PDA account na nag-iimbak ng pagmamapa kung nasaan ang lahat ng data.

Halimbawa, maaari kang magkaroon ng note-taking app na ang backing program ay gumagamit ng mga random na buto upang bumuo ng mga PDA account at mag-imbak ng isang tala sa bawat account. Ang programa ay magkakaroon din ng isang pandaigdigang PDA na "mapa" na account na nag-iimbak ng pagmamapa ng mga pampublikong key ng mga user sa listahan ng mga PDA kung saan naka-imbak ang kanilang mga tala. Ang map account na ito ay kukunin gamit ang isang static na binhi, hal. "GLOBAL_MAPPING".

Kapag dumating na ang oras upang kunin ang mga tala ng user, maaari mong tingnan ang map account, tingnan ang listahan ng mga address na nauugnay sa pampublikong key ng isang user, pagkatapos ay kunin ang account para sa bawat isa sa mga address na iyon.

Bagama't ang ganitong solusyon ay marahil ay mas madaling lapitan para sa mga tradisyunal na web developer, ito ay may kasamang ilang mga disbentaha na partikular sa web3 development. Dahil ang laki ng pagmamapa na nakaimbak sa map account ay lalago sa paglipas ng panahon, kakailanganin mong maglaan ng higit na laki kaysa sa kinakailangan sa account noong una mo itong nilikha, o kakailanganin mong muling maglaan ng espasyo para dito sa tuwing may bago. ang tala ay nilikha. Higit pa rito, maaabot mo sa kalaunan ang limitasyon sa laki ng account na 10 megabytes.

Maaari mong pagaanin ang isyung ito sa ilang antas sa pamamagitan ng paggawa ng hiwalay na map account para sa bawat user. Halimbawa, sa halip na magkaroon ng isang PDA map account para sa buong programa, gagawa ka ng PDA map account bawat user. Ang bawat isa sa mga map account na ito ay maaaring makuha gamit ang pampublikong key ng user. Ang mga address para sa bawat tala ay maaaring maiimbak sa loob ng kaukulang account ng mapa ng gumagamit.

Binabawasan ng diskarteng ito ang laki na kinakailangan para sa bawat map account, ngunit sa huli ay nagdaragdag pa rin ng hindi kinakailangang kinakailangan sa proseso: kinakailangang basahin ang impormasyon sa map account *bago* mahanap ang mga account na may nauugnay na data ng tala.

Maaaring may mga pagkakataon kung saan ang paggamit ng diskarteng ito ay makatuwiran para sa iyong aplikasyon, ngunit hindi namin ito inirerekomenda bilang iyong "pumunta sa" diskarte.

### Map to data using PDA derivation

Kung madiskarte ka tungkol sa mga buto na ginagamit mo upang kunin ang mga PDA, maaari mong i-embed ang mga kinakailangang mapping sa mismong mga buto. Ito ang natural na ebolusyon ng halimbawa ng note-taking app na tinalakay namin. Kung sinimulan mong gamitin ang pampublikong key ng tagalikha ng tala bilang isang binhi upang lumikha ng isang account sa mapa bawat user, kung gayon bakit hindi gamitin ang parehong pampublikong susi ng lumikha at ilang iba pang kilalang piraso ng impormasyon upang makakuha ng isang PDA para sa tala mismo?

Ngayon, nang hindi tahasang pinag-uusapan ito, nagmamapa kami ng mga buto sa mga account sa buong kursong ito. Isipin ang programa ng Pagsusuri ng Pelikula na binuo natin sa mga nakaraang aralin. Gumagamit ang program na ito ng pampublikong susi ng gumawa ng review at ang pamagat ng pelikulang kanilang nire-review para mahanap ang address na *dapat* gamitin para iimbak ang review. Ang diskarte na ito ay nagbibigay-daan sa programa na lumikha ng isang natatanging address para sa bawat bagong pagsusuri habang ginagawang madali upang mahanap ang isang pagsusuri kapag kinakailangan. Kapag gusto mong humanap ng review ng user tungkol sa "Spiderman," alam mong naka-store ito sa PDA account na ang address ay maaaring makuha gamit ang pampublikong key ng user at ang text na "Spiderman" bilang mga buto.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[
        initializer.key.as_ref(),
        title.as_bytes().as_ref()
    ],
    program_id)
```

### Associated token account addresses

Ang isa pang praktikal na halimbawa ng ganitong uri ng pagmamapa ay kung paano tinutukoy ang mga nauugnay na token account (ATA) na address. Ang mga token ay madalas na hawak sa isang ATA na ang address ay hinango gamit ang isang wallet address at ang mint address ng isang partikular na token. Ang address para sa isang ATA ay makikita gamit ang function na `get_associated_token_address` na kumukuha ng `wallet_address` at `token_mint_address` bilang mga input.

```rust
let associated_token_address = get_associated_token_address(&wallet_address, &token_mint_address);
```

Under the hood, the associated token address is a PDA found using the `wallet_address`, `token_program_id`, and `token_mint_address` as seeds. This provides a deterministic way to find a token account associated with any wallet address for a specific token mint.

```rust
fn get_associated_token_address_and_bump_seed_internal(
    wallet_address: &Pubkey,
    token_mint_address: &Pubkey,
    program_id: &Pubkey,
    token_program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            &wallet_address.to_bytes(),
            &token_program_id.to_bytes(),
            &token_mint_address.to_bytes(),
        ],
        program_id,
    )
}
```

Ang mga pagmamapa sa pagitan ng mga buto at PDA account na iyong ginagamit ay lubos na nakadepende sa iyong partikular na programa. Bagama't hindi ito isang aralin sa disenyo o arkitektura ng system, ito ay nagkakahalaga ng pagtawag ng ilang mga alituntunin:

- Gumamit ng mga buto na malalaman sa oras ng PDA derivation
- Mag-isip tungkol sa kung anong data ang pinagsama-sama sa isang account
- Maging maalalahanin tungkol sa istruktura ng data na ginagamit sa loob ng bawat account
- Ang mas simple ay karaniwang mas mahusay

# Demo

Magsanay tayo kasama ang programa ng Pagsusuri ng Pelikula na ginawa natin sa mga nakaraang aralin. Huwag mag-alala kung papasok ka lang sa araling ito nang hindi mo nagawa ang nakaraang aralin - dapat ay posible na sumunod sa alinmang paraan.

Bilang isang refresher, hinahayaan ng programa ng Movie Review ang mga user na gumawa ng mga review ng pelikula. Ang mga review na ito ay iniimbak sa isang account gamit ang isang PDA na hinango sa public key ng initializer at ang pamagat ng pelikulang kanilang sinusuri.

Dati, natapos namin ang pagpapatupad ng kakayahang mag-update ng pagsusuri ng pelikula sa isang secure na paraan. Sa demo na ito, magdaragdag kami ng kakayahan para sa mga user na magkomento sa isang pagsusuri ng pelikula. Gagamitin namin ang pagbuo ng feature na ito bilang isang pagkakataon upang pag-aralan kung paano ayusin ang storage ng komento gamit ang mga PDA account.

### 1. Get the starter code

Upang magsimula, mahahanap mo [ang movie program starter code](https://github.com/Unboxed-Software/solana-movie-program/tree/starter) sa `starter` branch.

Kung sinusundan mo ang mga demo ng Pagsusuri ng Pelikula, mapapansin mo na ito ang program na binuo namin sa ngayon. Dati, ginamit namin [Solana Playground](https://beta.solpg.io/) para isulat, buuin, at i-deploy ang aming code. Sa araling ito, bubuo at ide-deploy namin ang programa nang lokal.

Buksan ang folder, pagkatapos ay patakbuhin ang `cargo-build-bpf` upang buuin ang program. Ang utos na `cargo-build-bpf` ay maglalabas ng pagtuturo upang i-deploy ang programa.

```sh
cargo-build-bpf
```

I-deploy ang program sa pamamagitan ng pagkopya sa output ng `cargo-build-bpf` at patakbuhin ang command na `solana program deploy`.

```sh
solana program deploy <PATH>
```

Maaari mong subukan ang programa sa pamamagitan ng paggamit ng pagsusuri ng pelikula [frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews) at pag-update ng program ID gamit ang iyong ' kaka-deploy lang. Tiyaking ginagamit mo ang sangay ng `solution-update-reviews`.

### 2. Plan out the account structure

Ang pagdaragdag ng mga komento ay hindi na kailangang gumawa ng ilang mga pagpapasya tungkol sa kung paano iimbak ang data na nauugnay sa bawat komento. Ang mga pamantayan para sa isang mahusay na istraktura dito ay:

- Hindi masyadong kumplikado
- Ang data ay madaling makuha
- Ang bawat komento ay may maiuugnay dito sa review na nagaganap dito

Para magawa ito, gagawa kami ng dalawang bagong uri ng account:

- Komento counter account
- Magkomento ng account

Magkakaroon ng isang comment counter account sa bawat pagsusuri at isang comment account sa bawat komento. Ang account counter ng komento ay mali-link sa isang ibinigay na pagsusuri sa pamamagitan ng paggamit ng address ng review bilang isang binhi para sa paghahanap ng comment counter PDA. Gagamitin din nito ang static na string na "comment" bilang isang binhi.

Ang account ng komento ay mali-link sa isang pagsusuri sa parehong paraan. Gayunpaman, hindi nito isasama ang string ng "komento" bilang isang binhi at sa halip ay gagamitin ang *aktwal na bilang ng komento* bilang isang binhi. Sa ganoong paraan ang kliyente ay madaling makuha ang mga komento para sa isang ibinigay na pagsusuri sa pamamagitan ng paggawa ng sumusunod:

1. Basahin ang data sa comment counter account para matukoy ang bilang ng mga komento sa isang review.
2. Kung saan ang `n` ay ang kabuuang bilang ng mga komento sa pagsusuri, i-loop ang `n` na beses. Ang bawat pag-ulit ng loop ay makakakuha ng isang PDA gamit ang address ng pagsusuri at ang kasalukuyang numero bilang mga buto. Ang resulta ay `n` na bilang ng mga PDA, na ang bawat isa ay ang address ng isang account na nag-iimbak ng komento.
3. Kunin ang mga account para sa bawat isa sa mga `n` na PDA at basahin ang data na nakaimbak sa bawat isa.

Tinitiyak nito na ang bawat isa sa aming mga account ay maaaring tiyak na makuha gamit ang data na alam na nang maaga.

Upang maipatupad ang mga pagbabagong ito, kakailanganin naming gawin ang sumusunod:

- Tukuyin ang mga struct upang kumatawan sa comment counter at comment accounts
- I-update ang umiiral na `MovieAccountState` upang maglaman ng discriminator (higit pa dito sa ibang pagkakataon)
- Magdagdag ng variant ng pagtuturo upang kumatawan sa tagubiling `add_comment`
- I-update ang kasalukuyang function ng pagpoproseso ng pagtuturo ng `add_movie_review` upang isama ang paggawa ng account counter account
- Lumikha ng bagong `add_comment` na function sa pagproseso ng pagtuturo

### 3. Define `MovieCommentCounter` and `MovieComment` structs

Alalahanin na ang `state.rs` file ay tumutukoy sa mga istrukturang ginagamit ng aming programa upang i-populate ang field ng data ng isang bagong account.

Kakailanganin nating tukuyin ang dalawang bagong struct upang paganahin ang pagkomento.

1. `MovieCommentCounter` - upang mag-imbak ng counter para sa bilang ng mga komentong nauugnay sa isang pagsusuri
2. `MovieComment` - upang mag-imbak ng data na nauugnay sa bawat komento

Upang magsimula, tukuyin natin ang mga istrukturang gagamitin namin para sa aming programa. Tandaan na nagdaragdag kami ng field na `discriminator` sa bawat struct, kasama ang umiiral na `MovieAccountState`. Dahil marami na kaming uri ng account, kailangan namin ng paraan para makuha lang ang uri ng account na kailangan namin mula sa kliyente. Ang discriminator na ito ay isang string na maaaring magamit upang mag-filter sa mga account kapag kinuha namin ang aming mga account ng programa.

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub discriminator: String,
    pub is_initialized: bool,
    pub reviewer: Pubkey,
    pub rating: u8,
    pub title: String,
    pub description: String,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieCommentCounter {
    pub discriminator: String,
    pub is_initialized: bool,
    pub counter: u64
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieComment {
    pub discriminator: String,
    pub is_initialized: bool,
    pub review: Pubkey,
    pub commenter: Pubkey,
    pub comment: String,
    pub count: u64
}

impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieCommentCounter {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieComment {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Dahil nagdagdag kami ng bagong field na `discriminator` sa aming umiiral na struct, kailangang baguhin ang pagkalkula ng laki ng account. Gamitin natin ito bilang isang pagkakataon upang linisin nang kaunti ang ilan sa ating code. Magdaragdag kami ng pagpapatupad para sa bawat isa sa tatlong struct sa itaas na nagdaragdag ng pare-parehong `DISCRIMINATOR` at alinman sa pare-parehong `SIZE` o function na `get_account_size` upang mabilis naming makuha ang laki na kailangan kapag nag-initialize ng account.

```rust
impl MovieAccountState {
    pub const DISCRIMINATOR: &'static str = "review";

    pub fn get_account_size(title: String, description: String) -> usize {
        return (4 + MovieAccountState::DISCRIMINATOR.len())
            + 1
            + 1
            + (4 + title.len())
            + (4 + description.len());
    }
}

impl MovieCommentCounter {
    pub const DISCRIMINATOR: &'static str = "counter";
    pub const SIZE: usize = (4 + MovieCommentCounter::DISCRIMINATOR.len()) + 1 + 8;
}

impl MovieComment {
    pub const DISCRIMINATOR: &'static str = "comment";

    pub fn get_account_size(comment: String) -> usize {
        return (4 + MovieComment::DISCRIMINATOR.len()) + 1 + 32 + 32 + (4 + comment.len()) + 8;
    }
}
```

Ngayon kahit saan kailangan namin ang discriminator o laki ng account, magagamit namin ang pagpapatupad na ito at hindi ipagsapalaran ang hindi sinasadyang mga typo.

### 4. Create `AddComment` instruction

Alalahanin na ang `instruction.rs` file ay tumutukoy sa mga tagubilin na tatanggapin ng aming programa at kung paano i-deserialize ang data para sa bawat isa. Kailangan naming magdagdag ng bagong variant ng pagtuturo para sa pagdaragdag ng mga komento. Magsimula tayo sa pamamagitan ng pagdaragdag ng bagong variant na `AddComment` sa enum ng `MovieInstruction`.

```rust
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
    },
    AddComment {
        comment: String
    }
}
```

Susunod, gumawa tayo ng `CommentPayload` na struct upang kumatawan sa data ng pagtuturo na nauugnay sa bagong tagubiling ito. Karamihan sa data na isasama namin sa account ay mga pampublikong key na nauugnay sa mga account na ipinasa sa programa, kaya ang tanging kailangan lang namin dito ay isang field para kumatawan sa text ng komento.
```rust
#[derive(BorshDeserialize)]
struct CommentPayload {
    comment: String
}
```

Ngayon, i-update natin kung paano namin i-unpack ang data ng pagtuturo. Pansinin na inilipat namin ang deserialization ng data ng pagtuturo sa bawat katugmang case gamit ang nauugnay na payload struct para sa bawat pagtuturo.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description }
            },
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description
                }
            },
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment
                }
            }
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

Panghuli, i-update natin ang function na `process_instruction` sa `processor.rs` para magamit ang bagong variant ng pagtuturo na ginawa namin.

Sa `processor.rs`, ilagay sa saklaw ang mga bagong struct mula sa `state.rs`.

```rust
use crate::state::{MovieAccountState, MovieCommentCounter, MovieComment};
```

Pagkatapos, sa `process_instruction` itugma natin ang aming deserialized na `AddComment` na data ng pagtuturo sa function na `add_comment` na ipapatupad namin sa ilang sandali.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            update_movie_review(program_id, accounts, title, rating, description)
        },

        MovieInstruction::AddComment { comment } => {
            add_comment(program_id, accounts, comment)
        }
    }
}
```

### 5. Update `add_movie_review` to create comment counter account

Bago namin ipatupad ang function na `add_comment`, kailangan naming i-update ang function na `add_movie_review` para magawa ang comment counter account ng review.

Tandaan na susubaybayan ng account na ito ang kabuuang bilang ng mga komentong umiiral para sa isang nauugnay na pagsusuri. Ang address nito ay isang PDA na hango gamit ang address ng pagsusuri ng pelikula at ang salitang "comment" bilang mga buto. Tandaan na kung paano namin iniimbak ang counter ay isang pagpipilian lamang sa disenyo. Maaari rin kaming magdagdag ng field na "counter" sa orihinal na account sa pagsusuri ng pelikula.

Sa loob ng function na `add_movie_review`, magdagdag tayo ng `pda_counter` upang kumatawan sa bagong counter account na sisimulan natin kasama ng movie review account. Nangangahulugan ito na inaasahan na namin ngayon ang apat na account na maipapasa sa function na `add_movie_review` sa pamamagitan ng argumento ng `accounts`.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

Susunod, may check upang matiyak na ang `total_len` ay mas mababa sa 1000 bytes, ngunit ang `total_len` ay hindi na tumpak dahil idinagdag namin ang discriminator. Palitan natin ang `total_len` ng isang tawag sa `MovieAccountState::get_account_size`:

```rust
let account_len: usize = 1000;

if MovieAccountState::get_account_size(title.clone(), description.clone()) > account_len {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into());
}
```

Tandaan na kailangan din itong i-update sa function na `update_movie_review` para gumana nang maayos ang tagubiling iyon.

Kapag nasimulan na namin ang review account, kakailanganin din naming i-update ang `account_data` gamit ang mga bagong field na aming tinukoy sa `MovieAccountState` na struct.

```rust
account_data.discriminator = MovieAccountState::DISCRIMINATOR.to_string();
account_data.reviewer = *initializer.key;
account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Panghuli, idagdag natin ang lohika upang simulan ang counter account sa loob ng function na `add_movie_review`. Ibig sabihin nito:

1. Pagkalkula ng halaga ng exemption sa upa para sa counter account
2. Pagkuha ng counter PDA gamit ang review address at ang string na "comment" bilang mga buto
3. Pag-invoke sa system program para likhain ang account
4. Itakda ang panimulang halaga ng counter
5. I-serialize ang data ng account at ibalik mula sa function

Dapat idagdag ang lahat ng ito sa dulo ng function na `add_movie_review` bago ang `Ok(())`.

```rust
msg!("create comment counter");
let rent = Rent::get()?;
let counter_rent_lamports = rent.minimum_balance(MovieCommentCounter::SIZE);

let (counter, counter_bump) =
    Pubkey::find_program_address(&[pda.as_ref(), "comment".as_ref()], program_id);
if counter != *pda_counter.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument);
}

invoke_signed(
    &system_instruction::create_account(
        initializer.key,
        pda_counter.key,
        counter_rent_lamports,
        MovieCommentCounter::SIZE.try_into().unwrap(),
        program_id,
    ),
    &[
        initializer.clone(),
        pda_counter.clone(),
        system_program.clone(),
    ],
    &[&[pda.as_ref(), "comment".as_ref(), &[counter_bump]]],
)?;
msg!("comment counter created");

let mut counter_data =
    try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

msg!("checking if counter account is already initialized");
if counter_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}

counter_data.discriminator = MovieCommentCounter::DISCRIMINATOR.to_string();
counter_data.counter = 0;
counter_data.is_initialized = true;
msg!("comment count: {}", counter_data.counter);
counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;
```

Ngayon kapag may ginawang bagong review, dalawang account ang sinisimulan:

1. Ang una ay ang review account na nag-iimbak ng mga nilalaman ng pagsusuri. Ito ay hindi nagbabago mula sa bersyon ng program na sinimulan namin.
2. Iniimbak ng pangalawang account ang counter para sa mga komento

### 6. Implement `add_comment`

Panghuli, ipatupad natin ang ating function na `add_comment` upang lumikha ng mga bagong account ng komento.

Kapag may ginawang bagong komento para sa pagsusuri, dagdagan namin ang bilang sa PDA account ng counter ng komento at kukunin ang PDA para sa account ng komento gamit ang address ng pagsusuri at kasalukuyang bilang.

Tulad ng iba pang mga function sa pagpoproseso ng pagtuturo, magsisimula tayo sa pamamagitan ng pag-ulit sa mga account na ipinasa sa programa. At bago tayo gumawa ng anupaman, kailangan nating i-deserialize ang counter account para magkaroon tayo ng access sa kasalukuyang bilang ng komento:

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adding Comment...");
    msg!("Comment: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    Ok(())
}
```

Ngayon na mayroon na kaming access sa counter data, maaari kaming magpatuloy sa mga natitirang hakbang:

1. Kalkulahin ang halaga ng hindi kasama sa upa para sa bagong account ng komento
2. Kunin ang PDA para sa account ng komento gamit ang address ng pagsusuri at ang kasalukuyang komento ay binibilang bilang mga buto
3. I-invoke ang System Program para gumawa ng bagong comment account
4. Itakda ang naaangkop na mga halaga sa bagong likhang account
5. I-serialize ang data ng account at ibalik mula sa function

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adding Comment...");
    msg!("Comment: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    let account_len = MovieComment::get_account_size(comment.clone());

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    let (pda, bump_seed) = Pubkey::find_program_address(&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(),], program_id);
    if pda != *pda_comment.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    invoke_signed(
        &system_instruction::create_account(
        commenter.key,
        pda_comment.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[commenter.clone(), pda_comment.clone(), system_program.clone()],
        &[&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("Created Comment Account");

    let mut comment_data = try_from_slice_unchecked::<MovieComment>(&pda_comment.data.borrow()).unwrap();

    msg!("checking if comment account is already initialized");
    if comment_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    comment_data.discriminator = MovieComment::DISCRIMINATOR.to_string();
    comment_data.review = *pda_review.key;
    comment_data.commenter = *commenter.key;
    comment_data.comment = comment;
    comment_data.is_initialized = true;
    comment_data.serialize(&mut &mut pda_comment.data.borrow_mut()[..])?;

    msg!("Comment Count: {}", counter_data.counter);
    counter_data.counter += 1;
    counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;

    Ok(())
}
```

### 7. Build and deploy

Handa na kaming buuin at i-deploy ang aming programa!

Buuin ang na-update na programa sa pamamagitan ng pagpapatakbo ng `cargo-build-bpf`. Pagkatapos ay i-deploy ang program sa pamamagitan ng pagpapatakbo ng command na `solana program deploy` na naka-print sa console.

Maaari mong subukan ang iyong programa sa pamamagitan ng pagsusumite ng isang transaksyon na may tamang data ng pagtuturo. Maaari kang gumawa ng sarili mong script o huwag mag-atubiling gamitin ang [frontend na ito](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-comments). Tiyaking gamitin ang sangay ng `solution-add-comments` at palitan ang `MOVIE_REVIEW_PROGRAM_ID` sa `utils/constants.ts` ng ID ng iyong program o hindi gagana ang frontend sa iyong program.

Tandaan na gumawa kami ng mga paglabag na pagbabago sa mga review account (ibig sabihin, pagdaragdag ng discriminator). Kung gagamitin mo ang parehong program ID na ginamit mo dati noong i-deploy ang program na ito, wala sa mga review na ginawa mo dati ang lalabas sa frontend na ito dahil sa isang data mismatch.

Kung kailangan mo ng mas maraming oras sa proyektong ito para maging komportable sa mga konseptong ito, tingnan ang [solution code](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments ) bago magpatuloy. Tandaan na ang code ng solusyon ay nasa sangay ng `solution-add-comments` ng naka-link na repository.

# Challenge

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa! Sige at magtrabaho kasama ang Student Intro program na ginamit namin sa mga nakaraang aralin. Ang Student Intro program ay isang Solana program na nagbibigay-daan sa mga mag-aaral na ipakilala ang kanilang sarili. Ang program na ito ay tumatagal ng pangalan ng isang user at isang maikling mensahe bilang `instruction_data` at gumagawa ng isang account upang iimbak ang data sa chain. Para sa hamon na ito dapat mong:

1. Magdagdag ng tagubilin na nagpapahintulot sa ibang mga user na tumugon sa isang intro
2. Buuin at i-deploy ang programa nang lokal

Kung hindi mo pa sinusubaybayan ang mga nakaraang aralin o hindi mo pa nai-save ang iyong trabaho mula noon, huwag mag-atubiling gamitin ang starter code sa `starter` branch ng [repository na ito](https://github.com/Unboxed- Software/solana-student-intro-program/tree/starter).

Subukang gawin ito nang nakapag-iisa kung kaya mo! Kung natigil ka, huwag mag-atubiling sumangguni sa [code ng solusyon](https://github.com/Unboxed-Software/solana-student-intro-program/tree/solution-add-replies). Tandaan na ang code ng solusyon ay nasa branch na `solution-add-replies` at maaaring magmukhang bahagyang naiiba ang iyong code.

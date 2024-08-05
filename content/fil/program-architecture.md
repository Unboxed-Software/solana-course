---
title: Program Architecture
objectives:
- Gumamit ng Box at Zero Copy upang gumana sa malalaking data na onchain
- Gumawa ng mas mahusay na mga desisyon sa disenyo ng PDA
- Patunay sa hinaharap ang iyong mga programa
- Harapin ang mga isyu sa concurrency
---

# TL;DR

- Kung ang iyong mga data account ay masyadong malaki para sa Stack, balutin ang mga ito sa `Box` upang italaga ang mga ito sa Heap
- Gamitin ang Zero-Copy upang harapin ang mga account na masyadong malaki para sa `Box` (< 10MB)
- Ang laki at ang pagkakasunud-sunod ng mga patlang sa isang bagay na account; ilagay ang mga patlang ng variable na haba sa dulo
- Ang Solana ay maaaring magproseso nang magkatulad, ngunit maaari ka pa ring magkaroon ng mga bottleneck; alalahanin ang mga "nakabahaging" account na kailangang sulatan ng lahat ng user na nakikipag-ugnayan sa program
# Lesson

Ang Arkitektura ng Programa ang naghihiwalay sa hobbyist mula sa propesyonal. Ang paggawa ng mga gumaganang programa ay may higit na kinalaman sa system **design** kaysa sa code. At ikaw, bilang taga-disenyo, ay kailangang mag-isip tungkol sa:

     1. Ano ang kailangang gawin ng iyong code
     2. Ano ang mga posibleng pagpapatupad doon
     3. Ano ang mga tradeoff sa pagitan ng iba't ibang mga pagpapatupad

Ang mga tanong na ito ay mas mahalaga kapag bumubuo para sa isang blockchain. Hindi lamang mas limitado ang mga mapagkukunan kaysa sa karaniwang kapaligiran sa pag-compute, nakikitungo ka rin sa mga ari-arian ng mga tao; ang code ay may halaga na ngayon.

Iiwan namin ang karamihan sa talakayan sa pangangasiwa ng asset sa [mga aralin sa seguridad](../security-intro.md), ngunit mahalagang tandaan ang katangian ng mga limitasyon sa mapagkukunan sa pagbuo ng Solana. Siyempre, mayroong mga limitasyon sa isang tipikal na kapaligiran sa pag-unlad, ngunit may mga limitasyon na natatangi sa pag-unlad ng blockchain at Solana tulad ng kung gaano karaming data ang maaaring maimbak sa isang account, ang gastos sa pag-imbak ng data na iyon, at kung gaano karaming mga compute unit ang magagamit bawat transaksyon. Ikaw, ang taga-disenyo ng programa, ay kailangang maging maingat sa mga limitasyong ito upang lumikha ng mga programang abot-kaya, mabilis, ligtas, at gumagana. Ngayon ay tatalakayin natin ang ilan sa mga mas maagang pagsasaalang-alang na dapat gawin kapag gumagawa ng mga programang Solana.

## Dealing With Large Accounts

Sa modernong application programming, hindi namin kailangang isipin ang tungkol sa laki ng mga istruktura ng data na ginagamit namin. Gusto mong gumawa ng string? Maaari kang maglagay ng 4000 character na limitasyon dito kung gusto mong maiwasan ang pang-aabuso, ngunit malamang na hindi ito isang isyu. Gusto mo ng integer? Ang mga ito ay halos palaging 32-bit para sa kaginhawahan.

Sa mataas na antas ng mga wika, ikaw ay nasa data-land-o-plenty! Ngayon, sa Solana land, nagbabayad kami ng bawat byte na nakaimbak (renta) at may mga limitasyon sa laki ng heap, stack at account. Kailangan nating maging mas tuso sa ating mga byte. Mayroong dalawang pangunahing alalahanin na titingnan natin sa seksyong ito:

1. Dahil nagbabayad-per-byte kami, karaniwang gusto naming panatilihing maliit hangga't maaari ang aming footprint. Susuriin namin ang higit pa sa pag-optimize sa isa pang seksyon, ngunit ipapakilala namin sa iyo ang konsepto ng mga laki ng data dito.

2. Kapag nagpapatakbo sa mas malaking data, napupunta kami sa [Stack](https://docs.solana.com/developing/onchain-programs/faq#stack) at [Heap](https://docs.solana. com/developing/onchain-programs/faq#heap-size) na mga hadlang - upang malutas ang mga ito, titingnan natin ang paggamit ng Box at Zero-Copy.

### Sizes

Sa Solana nagbabayad ang isang nagbabayad ng bayad sa transaksyon para sa bawat byte na nakaimbak sa chain. Tinatawag namin itong [rent](https://docs.solana.com/developing/intro/rent). Side note: medyo maling tawag ang upa dahil hindi talaga ito permanenteng kinukuha. Sa sandaling magdeposito ka ng upa sa account, ang data na iyon ay maaaring manatili doon magpakailanman o maaari mong ma-refund ang renta kung isasara mo ang account. Ang renta ay dating aktwal na bagay, ngunit ngayon ay may ipinapatupad na minimum na pagbubukod sa upa. Mababasa mo ang tungkol dito sa [dokumentasyon ng Solana](https://docs.solana.com/developing/intro/rent).

Isantabi ang etimolohiya, ang paglalagay ng data sa blockchain ay maaaring magastos. Ito ang dahilan kung bakit ang mga katangian ng NFT at nauugnay na mga file, tulad ng larawan, ay naka-imbak sa labas ng kadena. Sa bandang huli, gusto mong makakuha ng balanse na nag-iiwan sa iyong program na lubos na gumagana nang hindi nagiging masyadong mahal na ang iyong mga user ay hindi gustong magbayad upang buksan ang data account.

Ang unang bagay na kailangan mong malaman bago ka magsimulang mag-optimize para sa espasyo sa iyong program ay ang laki ng bawat isa sa iyong mga struct.. Nasa ibaba ang isang napaka-kapaki-pakinabang na listahan mula sa [Anchor Book](https://book.anchor-lang. com/anchor_references/space.html).

| Types | Space in bytes | Details/Example |
| --- | --- | --- |
| bool | 1 | would only require 1 bit but still uses 1 byte |
| u8/i8 | 1 |  |
| u16/i16 | 2 |  |
| u32/i32 | 4 |  |
| u64/i64 | 8 |  |
| u128/i128 | 16 |  |
| [T;amount] | space(T) * amount | e.g. space([u16;32]) = 2 * 32 = 64 |
| Pubkey | 32 |  |
| Vec<T> | 4 + (space(T) * amount) | Account size is fixed so account should be initialized with sufficient space from the beginning |
| String | 4 + length of string in bytes | Account size is fixed so account should be initialized with sufficient space from the beginning |
| Option<T> | 1 + (space(T)) |  |
| Enum | 1 + Largest Variant Size | e.g. Enum { A, B { val: u8 }, C { val: u16 } } -> 1 + space(u16) = 3 |
| f32 | 4 | serialization will fail for NaN |
| f64 | 8 | serialization will fail for NaN |
| Accounts | 8 + space(T) | #[account()]
pub struct T { …  |
| Data Structs | space(T) | #[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct T { … } |

Alam ang mga ito, simulan ang pag-iisip tungkol sa maliliit na pag-optimize na maaari mong gawin sa isang programa. Halimbawa, kung mayroon kang field ng integer na aabot lang sa 100, huwag gumamit ng u64/i64, gumamit ng u8. Bakit? Dahil ang u64 ay tumatagal ng 8 byte, na may max na value na 2^64 o 1.84 * 10^19. Iyan ay isang pag-aaksaya ng espasyo dahil kailangan mo lamang na tumanggap ng mga numero hanggang 100. Ang isang solong byte ay magbibigay sa iyo ng max na halaga na 255 na, sa kasong ito, ay magiging sapat. Katulad nito, walang dahilan upang gamitin ang i8 kung hindi ka magkakaroon ng mga negatibong numero.

Mag-ingat sa maliliit na uri ng numero, bagaman. Mabilis kang makakaranas ng hindi inaasahang gawi dahil sa pag-apaw. Halimbawa, ang uri ng u8 na paulit-ulit na nadaragdagan ay aabot sa 255 at pagkatapos ay babalik sa 0 sa halip na 256. Para sa higit pang totoong konteksto, hanapin ang **[Y2K bug](https://www.nationalgeographic.org/ encyclopedia/Y2K-bug/#:~:text=Bilang%20the%20year%202000%20approached%2C%20computer%20programmers%20realized%20na%20computers, would%20be%20damed%20o%20flawed.).**

Kung gusto mong magbasa nang higit pa tungkol sa mga laki ng Anchor, tingnan ang [blog post ng Sec3 tungkol dito](https://www.sec3.dev/blog/all-about-anchor-account-size) .

### Box

Ngayong alam mo na ang kaunti tungkol sa mga laki ng data, laktawan natin at tingnan ang isang problemang makakaharap mo kung gusto mong makitungo sa mas malalaking data account. Sabihin na mayroon kang sumusunod na data account:

```rust
#[account]
pub struct SomeBigDataStruct {
    pub big_data: [u8; 5000],
}  

#[derive(Accounts)]
pub struct SomeFunctionContext<'info> {
    pub some_big_data: Account<'info, SomeBigDataStruct>,
}
```

Kung susubukan mong ipasa ang `SomeBigDataStruct` sa function na may kontekstong `SomeFunctionContext`, tatakbo ka sa sumusunod na babala ng compiler:

`// Stack offset of XXXX exceeded max offset of 4096 by XXXX bytes, please minimize large stack variables`

At kung susubukan mong patakbuhin ang programa ay mag-hang lang ito at mabibigo.

Bakit ito?

Ito ay may kinalaman sa Stack. Sa tuwing tatawag ka ng isang function sa Solana nakakakuha ito ng 4KB na stack frame. Ito ay static na paglalaan ng memorya para sa mga lokal na variable. Dito naiimbak ang buong `SomeBigDataStruct` sa memorya at dahil ang 5000 byte, o 5KB, ay mas malaki kaysa sa limitasyong 4KB, maghahatid ito ng stack error. Kaya paano natin ito aayusin?

Ang sagot ay ang **`Box<T>`** type!

```rust
#[account]
pub struct SomeBigDataStruct {
    pub big_data: [u8; 5000],
}  

#[derive(Accounts)]
pub struct SomeFunctionContext<'info> {
    pub some_big_data: Box<Account<'info, SomeBigDataStruct>>, // <- Box Added!
}
```

Sa Anchor, **`Box<T>`** ay ginagamit upang ilaan ang account sa Heap, hindi sa Stack. Alin ang mahusay dahil binibigyan tayo ng Heap ng 32KB para magtrabaho. Ang pinakamagandang bahagi ay hindi mo kailangang gumawa ng anumang bagay na naiiba sa loob ng function. Ang kailangan mo lang gawin ay magdagdag ng `Box<…>` sa lahat ng iyong malaking data account.

Ngunit ang Box ay hindi perpekto. Maaari mo pa ring mapuno ang stack na may sapat na malalaking account. Malalaman natin kung paano ayusin ito sa susunod na seksyon.

### Zero Copy

Okay, kaya ngayon ay maaari mong harapin ang mga katamtamang laki ng mga account gamit ang `Box`. Ngunit paano kung kailangan mong gumamit ng talagang malalaking account tulad ng maximum na laki na 10MB? Kunin ang sumusunod bilang isang halimbawa:

```rust
#[account]
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384 bytes
}
```

Gagawin ng account na ito na mabigo ang iyong programa, kahit na nakabalot sa isang `Kahon. Upang makayanan ito, maaari mong gamitin ang `zero_copy` at `AccountLoader`. Idagdag lang ang `zero_copy` sa iyong account struct, idagdag ang `zero` bilang isang hadlang sa account validation struct, at i-wrap ang uri ng account sa account validation struct sa isang `AccountLoader`.

```rust
#[account(zero_copy)]
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384 bytes
}

pub struct ConceptZeroCopy<'info> {
    #[account(zero)]
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

Upang maunawaan kung ano ang nangyayari dito, tingnan ang [rust Anchor documentation](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html)

> Other than being more efficient, the most salient benefit [`zero_copy`] provides is the ability to define account types larger than the max stack or heap size. When using borsh, the account has to be copied and deserialized into a new data structure and thus is constrained by stack and heap limits imposed by the BPF VM. With zero copy deserialization, all bytes from the account’s backing `RefCell<&mut [u8]>` are simply re-interpreted as a reference to the data structure. No allocations or copies necessary. Hence the ability to get around stack and heap limitations.

Karaniwan, ang iyong programa ay hindi kailanman talagang naglo-load ng zero-copy data ng account sa stack o heap. Sa halip ay nakakakuha ito ng pointer access sa raw data. Tinitiyak ng `AccountLoader` na hindi ito masyadong magbabago tungkol sa kung paano ka nakikipag-ugnayan sa account mula sa iyong code.

Mayroong ilang mga caveat na gumagamit ng `zero_copy`. Una, hindi mo magagamit ang `init` constraint sa struct ng pagpapatunay ng account tulad ng nakasanayan mo. Ito ay dahil sa pagkakaroon ng limitasyon ng CPI sa mga account na mas malaki sa 10KB.

```rust
pub struct ConceptZeroCopy<'info> {
    #[account(zero, init)] // <- Can't do this
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

Sa halip, ang iyong kliyente ay kailangang gumawa ng malaking account at magbayad para sa upa nito sa isang hiwalay na tagubilin.

```tsx
const accountSize = 16_384 + 8
const ix = anchor.web3.SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: someReallyBigData.publicKey,
  lamports: await program.provider.connection.getMinimumBalanceForRentExemption(accountSize),
  space: accountSize,
  programId: program.programId,
});

const txHash = await program.methods.conceptZeroCopy().accounts({
  owner: wallet.publicKey,
  someReallyBigData: someReallyBigData.publicKey,
}).signers([
  someReallyBigData,
]).preInstructions([
  ix
])
.rpc()
```

Ang pangalawang caveat ay kailangan mong tawagan ang isa sa mga sumusunod na pamamaraan mula sa loob ng iyong rust instruction function para i-load ang account:

- `load_init` kapag unang nagpasimula ng account (babalewalain nito ang nawawalang discriminator ng account na idaragdag lamang pagkatapos ng instruction code ng user)
- `load` kapag hindi nababago ang account
- `load_mut` kapag ang account ay nababago

Halimbawa, kung gusto mong init at manipulahin ang `SomeReallyBigDataStruct` mula sa itaas, tatawagan mo ang sumusunod sa function

```rust
let some_really_big_data = &mut ctx.accounts.some_really_big_data.load_init()?;
```

Pagkatapos mong gawin iyon, maaari mong tratuhin ang account tulad ng normal! Sige at mag-eksperimento dito sa code mismo para makita ang lahat sa aksyon!

Para sa mas mahusay na pag-unawa sa kung paano gumagana ang lahat ng ito, pinagsama-sama ni Solana ang isang napakagandang [video](https://www.youtube.com/watch?v=zs_yU0IuJxc&feature=youtu.be) at [code](https://github .com/solana-developers/anchor-zero-copy-example) na nagpapaliwanag sa Box at Zero-Copy sa vanilla Solana.

## Dealing with Accounts

Ngayong alam mo na ang mga mani at bolts ng pagsasaalang-alang sa espasyo sa Solana, tingnan natin ang ilang mas mataas na antas ng pagsasaalang-alang. Sa Solana, lahat ay isang account, kaya para sa susunod na dalawang seksyon ay titingnan natin ang ilang mga konsepto ng arkitektura ng account.

### Data Order

Ang unang pagsasaalang-alang na ito ay medyo simple. Bilang panuntunan ng thumb, panatilihin ang lahat ng variable na haba ng mga field sa dulo ng account. Tingnan ang sumusunod:

```rust
#[account] // Anchor hides the account discriminator
pub struct BadState {
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
    pub id: u32         // 0xDEAD_BEEF
}
```

Ang field ng `flag` ay variable na haba. Pinapahirap nito ang paghahanap ng isang partikular na account sa pamamagitan ng field ng `id`, dahil ang pag-update sa data sa `flags` ay nagbabago sa lokasyon ng `id` sa memory map.

Upang gawin itong mas malinaw, obserbahan kung ano ang hitsura ng data ng account na ito sa chain kapag ang `flags` ay may apat na item sa vector kumpara sa walong item. Kung tatawagan mo ang `solana account ACCOUNT_KEY` makakakuha ka ng data dump tulad ng sumusunod:

```rust
0000:   74 e4 28 4e    d9 ec 31 0a  -> Account Discriminator (8)
0008:	04 00 00 00    11 22 33 44  -> Vec Size (4) | Data 4*(1)
0010:   DE AD BE EF                 -> id (4)

--- vs ---

0000:   74 e4 28 4e    d9 ec 31 0a  -> Account Discriminator (8)
0008:	08 00 00 00    11 22 33 44  -> Vec Size (8) | Data 4*(1)
0010:   55 66 77 88    DE AD BE EF  -> Data 4*(1) | id (4)
```

Sa parehong mga kaso, ang unang walong byte ay ang discriminator ng Anchor account. Sa unang kaso, ang susunod na apat na byte ay kumakatawan sa laki ng vector ng `flag`, na sinusundan ng isa pang apat na byte para sa data, at panghuli ang data ng field ng `id`.

Sa pangalawang kaso, ang field ng `id` ay inilipat mula sa address na 0x0010 patungo sa 0x0014 dahil ang data sa field ng `flag` ay umabot ng apat pang byte.

Ang pangunahing problema dito ay ang paghahanap. Kapag nag-query ka sa Solana, gumagamit ka ng mga filter na tumitingin sa raw data ng isang account. Ang mga ito ay tinatawag na `memcmp` na mga filter, o memory compare filter. Bibigyan mo ang filter ng isang `offset` at `bytes`, at ang filter pagkatapos ay direktang tumitingin sa memory, na binabawasan mula sa simula ng `offset` na iyong ibinibigay, at inihahambing ang mga byte sa memorya sa `bytes` na iyong ibinigay.

Halimbawa, alam mo na ang `flags` struct ay palaging magsisimula sa address na 0x0008 dahil ang unang 8 byte ay naglalaman ng account discriminator. Ang pag-query sa lahat ng account kung saan ang haba ng `flags` ay katumbas ng apat ay posible dahil *alam namin* na ang apat na byte sa 0x0008 ay kumakatawan sa haba ng data sa `flags`. Dahil ang discriminator ng account ay

```typescript
const states = await program.account.badState.all([
  {memcmp: {
    offset: 8,
    bytes: bs58.encode([0x04])
  }}
]);
```

Gayunpaman, kung gusto mong mag-query ayon sa `id`, hindi mo malalaman kung ano ang ilalagay para sa `offset` dahil variable ang lokasyon ng `id` batay sa haba ng `flags`. Iyon ay tila hindi nakakatulong. Karaniwang nariyan ang mga ID upang tumulong sa mga query! Ang simpleng pag-aayos ay i-flip ang order.

```rust
#[account] // Anchor hides the account disriminator
pub struct GoodState {
	pub id: u32         // 0xDEAD_BEEF
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
}
```

Gamit ang mga field ng variable na haba sa dulo ng struct, maaari mong palaging mag-query ng mga account batay sa lahat ng mga field hanggang sa unang field ng variable na haba. Upang i-echo ang simula ng seksyong ito: Bilang isang tuntunin ng thumb, panatilihin ang lahat ng mga variable na haba ng istraktura sa dulo ng account.

### For Future Use

Sa ilang partikular na sitwasyon, isaalang-alang ang pagdaragdag ng dagdag, hindi nagamit na mga byte sa iyong mga account. Ang mga ito ay nakalaan para sa flexibility at backward compatibility. Kunin ang sumusunod na halimbawa:

```rust
#[account]
pub struct GameState {
    pub health: u64,
    pub mana: u64,
    pub event_log: Vec<string>
}
```

Sa ganitong simpleng estado ng laro, ang isang karakter ay may `health`, `mana`, at isang log ng kaganapan. Kung sa isang punto ay gumagawa ka ng mga pagpapabuti sa laro at gusto mong magdagdag ng field na `karanasan`, magkakaroon ka ng snag. Ang field ng `karanasan` ay dapat na isang numero tulad ng isang `u64`, na sapat na simple upang idagdag. Maaari mong [relocate ang account](./anchor-pdas.md#realloc) at magdagdag ng espasyo.

Gayunpaman, upang mapanatili ang mga dynamic na haba ng field, tulad ng `event_log`, sa dulo ng struct, kakailanganin mong gumawa ng ilang pagmamanipula ng memorya sa lahat ng relocated na account upang ilipat ang lokasyon ng `event_log`. Maaari itong maging kumplikado at ginagawang mas mahirap ang pag-query sa mga account. Mapupunta ka sa isang estado kung saan ang mga hindi na-migrate na account ay may `event_log` sa isang lokasyon at nag-migrate ng mga account sa isa pa. Ang lumang `GameState` na walang `experience` at ang bagong `GameState` na may `experience` dito ay hindi na compatible. Hindi magse-serialize ang mga lumang account kapag ginamit kung saan inaasahan ang mga bagong account. Ang mga tanong ay magiging mas mahirap. Malamang na kakailanganin mong lumikha ng isang migration system at patuloy na lohika upang mapanatili ang pabalik na pagkakatugma. Sa huli, nagsisimula itong tila isang masamang ideya.

Sa kabutihang palad, kung mag-iisip ka nang maaga, maaari kang magdagdag ng field na `for_future_use` na naglalaan ng ilang byte kung saan inaasahan mong higit na kailangan ang mga ito.

```rust
#[account]
pub struct GameState { //V1
    pub health: u64,
    pub mana: u64,
	pub for_future_use: [u8; 128],
    pub event_log: Vec<string>
}
```

Sa ganoong paraan, kapag nagdagdag ka ng `karanasan` o katulad na bagay, mukhang ganito at magkatugma ang luma at bagong mga account.

```rust
#[account]
pub struct GameState { //V2
    pub health: u64,
    pub mana: u64,
	pub experience: u64,
	pub for_future_use: [u8; 120],
    pub event_log: Vec<string>
}
```

Ang mga dagdag na byte na ito ay nagdaragdag sa halaga ng paggamit ng iyong programa. Gayunpaman, mukhang sulit ang benepisyo sa karamihan ng mga kaso.

Kaya bilang pangkalahatang tuntunin ng thumb: anumang oras na sa tingin mo ay may potensyal na magbago ang mga uri ng iyong account sa paraang mangangailangan ng ilang uri ng kumplikadong paglipat, magdagdag ng ilang `for_future_use` byte.

### Pag-optimize ng Data

Ang ideya dito ay magkaroon ng kamalayan sa mga nasayang na piraso. Halimbawa, kung mayroon kang field na kumakatawan sa buwan ng taon, huwag gumamit ng `u64`. Magkakaroon lamang ng 12 buwan. Gumamit ng `u8`. Mas mabuti pa, gumamit ng `u8` Enum at lagyan ng label ang mga buwan.

Upang maging mas agresibo sa kaunting pagtitipid, mag-ingat sa mga boolean. Tingnan ang struct sa ibaba na binubuo ng walong boolean flag. Habang ang isang boolean *maaaring* ay kinakatawan bilang isang bit, ang borsh deserialization ay maglalaan ng isang buong byte sa bawat isa sa mga field na ito. nangangahulugan iyon na ang walong boolean ay magiging walong byte sa halip na walong bits, isang walong beses na pagtaas sa laki.

```rust
#[account]
pub struct BadGameFlags { // 8 bytes
    pub is_frozen: bool,
    pub is_poisoned: bool,
    pub is_burning: bool,
    pub is_blessed: bool,
    pub is_cursed: bool,
    pub is_stunned: bool,
    pub is_slowed: bool,
    pub is_bleeding: bool,
}
```

Para ma-optimize ito, maaari kang magkaroon ng isang field bilang `u8`. Pagkatapos ay maaari kang gumamit ng mga bitwise na operasyon upang tingnan ang bawat bit at matukoy kung ito ay "naka-on" o hindi.

```rust
const IS_FROZEN_FLAG: u8 = 1 << 0;
const IS_POISONED_FLAG: u8 = 1 << 1;
const IS_BURNING_FLAG: u8 = 1 << 2;
const IS_BLESSED_FLAG: u8 = 1 << 3;
const IS_CURSED_FLAG: u8 = 1 << 4;
const IS_STUNNED_FLAG: u8 = 1 << 5;
const IS_SLOWED_FLAG: u8 = 1 << 6;
const IS_BLEEDING_FLAG: u8 = 1 << 7;
const NO_EFFECT_FLAG: u8 = 0b00000000;
#[account]
pub struct GoodGameFlags { // 1 byte
    pub status_flags: u8, 
} 
```

Iyan ay nakakatipid sa iyo ng 7 byte ng data! Ang tradeoff, siyempre, ay kailangan mo na ngayong gumawa ng mga bitwise na operasyon. Ngunit iyon ay nagkakahalaga ng pagkakaroon sa iyong toolkit.

### Indexing

Ang huling konsepto ng account na ito ay masaya at naglalarawan ng kapangyarihan ng mga PDA. Kapag gumagawa ng mga account ng programa, maaari mong tukuyin ang mga buto na ginamit upang makuha ang PDA. Ito ay napakalakas dahil hinahayaan ka nitong makuha ang mga address ng iyong account sa halip na iimbak ang mga ito.

Ang pinakamagandang halimbawa nito ay ang magandang 'ol Associated Token Accounts (ATAs)!

```typescript
function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  )[0];
}
```

Ito ay kung paano iniimbak ang karamihan sa iyong mga token ng SPL. Sa halip na panatilihin ang isang talahanayan ng database ng mga address ng SPL token account, ang tanging bagay na dapat mong malaman ay ang iyong wallet address at ang mint address. Ang ATA address ay maaaring kalkulahin sa pamamagitan ng pag-hash ng mga ito nang sama-sama at viola! Nasa iyo ang address ng iyong token account.

Depende sa seeding maaari kang lumikha ng lahat ng uri ng mga relasyon:

- One-Per-Program (Global Account) - Kung gagawa ka ng account na may tukoy na `seeds=[b"ISA PER PROGRAM"]`, isa lang ang maaaring umiral para sa seed na iyon sa program na iyon. Halimbawa, kung kailangan ng iyong program ng lookup table, maaari mo itong i-seed ng `seeds=[b"Lookup"]`. Mag-ingat lamang na magbigay ng naaangkop na mga paghihigpit sa pag-access.
- One-Per-Owner - Sabihin na gumagawa ka ng video game player account at gusto mo lang ng isang player account sa bawat wallet. Pagkatapos ay i-seed mo ang account ng `seeds=[b"PLAYER", owner.key().as_ref()]`. Sa ganitong paraan, palagi mong malalaman kung saan hahanapin ang player account ng wallet **at** maaari lang magkaroon ng isa sa kanila.
- Multiple-Per-Owner - Okay, ngunit paano kung gusto mo ng maraming account sa bawat wallet? Sabihin na gusto mong mag-mint ng mga episode ng podcast. Pagkatapos ay maaari mong i-seed ang iyong `Podcast` account tulad nito: `seeds=[b"Podcast", owner.key().as_ref(), episode_number.to_be_bytes().as_ref()]`. Ngayon, kung gusto mong hanapin ang episode 50 mula sa isang partikular na wallet, magagawa mo! At maaari kang magkaroon ng maraming episode hangga't gusto mo bawat may-ari.
- One-Per-Owner-Per-Account - Ito ang epektibong halimbawa ng ATA na nakita natin sa itaas. Kung saan mayroon kaming isang token account sa bawat wallet at mint account. `seeds=[b"Mock ATA", owner.key().as_ref(), mint.key().as_ref()]`

Mula doon maaari kang maghalo at tumugma sa lahat ng uri ng matalinong paraan! Ngunit ang naunang listahan ay dapat magbigay sa iyo ng sapat upang makapagsimula.

Ang malaking benepisyo ng talagang pagbibigay-pansin sa aspetong ito ng disenyo ay ang pagsagot sa problema sa 'pag-index'. Kung walang mga PDA at seeds, kailangang subaybayan ng lahat ng user ang lahat ng address ng lahat ng account na nagamit na nila. Hindi ito magagawa para sa mga user, kaya kailangan nilang umasa sa isang sentralisadong entity upang maiimbak ang kanilang mga address sa isang database. Sa maraming paraan na tinatalo ang layunin ng isang network na ipinamamahagi sa buong mundo. Ang mga PDA ay isang mas mahusay na solusyon.

Upang maiuwi ang lahat ng ito, narito ang isang halimbawa ng isang scheme mula sa isang production podcasting program. Ang programa ay nangangailangan ng mga sumusunod na account:

- **Channel Account**
     - Pangalan
     - Mga Nagawa na Episode (u64)
- **(mga) Podcast Account**
     - Pangalan
     - Audio URL

Upang maayos na ma-index ang bawat address ng account, ginagamit ng mga account ang mga sumusunod na binhi:

```rust
// Channel Account
seeds=[b"Channel", owner.key().as_ref()]

// Podcast Account
seeds=[b"Podcast", channel_account.key().as_ref(), episode_number.to_be_bytes().as_ref()]
```

Palagi mong mahahanap ang channel account para sa isang partikular na may-ari. At dahil iniimbak ng channel ang bilang ng mga episode na ginawa, palagi mong alam ang upper bound kung saan maghahanap ng mga query. Bukod pa rito, palagi mong alam kung anong index ang lilikha ng bagong episode sa: `index = episodes_created`.

```rust
Podcast 0: seeds=[b"Podcast", channel_account.key().as_ref(), 0.to_be_bytes().as_ref()] 
Podcast 1: seeds=[b"Podcast", channel_account.key().as_ref(), 1.to_be_bytes().as_ref()] 
Podcast 2: seeds=[b"Podcast", channel_account.key().as_ref(), 2.to_be_bytes().as_ref()] 
...
Podcast X: seeds=[b"Podcast", channel_account.key().as_ref(), X.to_be_bytes().as_ref()] 
```

## Dealing with Concurrency

Isa sa mga pangunahing dahilan para piliin ang Solana para sa iyong blockchain na kapaligiran ay ang parallel transaction execution nito. Ibig sabihin, maaaring magpatakbo ng mga transaksyon nang magkatulad ang Solana hangga't hindi sinusubukan ng mga transaksyong iyon na magsulat ng data sa parehong account. Pinapabuti nito ang throughput ng programa sa labas ng kahon, ngunit sa ilang wastong pagpaplano maiiwasan mo ang mga isyu sa concurrency at talagang mapalakas ang pagganap ng iyong programa.

### Shared Accounts

Kung matagal ka nang nasa crypto, maaaring nakaranas ka ng isang malaking kaganapan sa NFT mint. Ang isang bagong proyekto ng NFT ay lalabas, ang lahat ay talagang nasasabik para dito, at pagkatapos ay ang candymachine ay magiging live. Nakakabaliw na i-click ang `accept transaction` nang mabilis hangga't maaari. Kung matalino ka, maaaring nagsulat ka ng bot upang makapasok sa mga transaksyon nang mas mabilis na magagawa ng UI ng website. Ang galit na pagmamadali sa mint na ito ay lumilikha ng maraming nabigong mga transaksyon. Pero bakit? Dahil sinusubukan ng lahat na magsulat ng data sa parehong Candy Machine account.

Tingnan ang isang simpleng halimbawa:

Sinusubukan nina Alice at Bob na bayaran ang kanilang mga kaibigan na sina Carol at Dean ayon sa pagkakabanggit. Lahat ng apat na account ay nagbabago, ngunit hindi nakadepende sa isa't isa. Ang parehong mga transaksyon ay maaaring tumakbo sa parehong oras.

```rust
Alice -- pays --> Carol

Bob ---- pays --> Dean
```

But if Alice and Bob both try to pay Carol at the same time, they'll run into issues.

```rust
Alice -- pays --> |
						-- > Carol
Bob   -- pays --- |
```

Dahil ang parehong mga transaksyong ito ay sumusulat sa token account ni Carol, isa lamang sa mga ito ang maaaring dumaan sa isang pagkakataon. Sa kabutihang palad, si Solana ay mabilis na masama, kaya malamang na sila ay binabayaran nang sabay. Ngunit ano ang mangyayari kung higit pa sa Alice at Bob ang sumubok na bayaran si Carol?

```rust
Alice -- pays --> |
						-- > Carol
x1000 -- pays --- | 
Bob   -- pays --- |
```

Paano kung subukang bayaran ng 1000 tao si Carol nang sabay? Ang bawat isa sa 1000 mga tagubilin ay ipi-queue up upang tumakbo sa pagkakasunud-sunod. Para sa ilan sa kanila, ang pagbabayad ay tila natuloy kaagad. Sila ang mapalad na maagang naisama ang pagtuturo. Ngunit ang ilan sa kanila ay maghihintay ng kaunti. At para sa ilan, mabibigo lang ang kanilang transaksyon.

Bagama't tila malabong bayaran ng 1000 tao si Carol nang sabay-sabay, talagang karaniwan na magkaroon ng isang kaganapan, tulad ng isang NFT mint, kung saan maraming tao ang sumusubok na sumulat ng data sa parehong account nang sabay-sabay.

Isipin na lumikha ka ng isang napakasikat na programa at gusto mong kumuha ng bayad sa bawat transaksyon na iyong pinoproseso. Para sa mga dahilan ng accounting, gusto mong mapunta ang lahat ng mga bayarin sa isang wallet. Sa setup na iyon, sa pagdami ng mga user, magiging mabagal ang iyong protocol at o magiging hindi maaasahan. Hindi maganda. Kaya ano ang solusyon? Paghiwalayin ang transaksyon ng data mula sa transaksyon ng bayad.

Halimbawa, isipin na mayroon kang data account na tinatawag na `DonationTally`. Ang tanging function nito ay itala kung magkano ang naibigay mo sa isang partikular na hard-coded na pitaka ng komunidad.

```rust
#[account]
pub struct DonationTally {
    is_initialized: bool,
    lamports_donated: u64,
    lamports_to_redeem: u64,
    owner: Pubkey,
}
```

Una, tingnan natin ang suboptimal na solusyon.

```rust
pub fn run_concept_shared_account_bottleneck(ctx: Context<ConceptSharedAccountBottleneck>, lamports_to_donate: u64) -> Result<()> {

    let donation_tally = &mut ctx.accounts.donation_tally;

    if !donation_tally.is_initialized {
        donation_tally.is_initialized = true;
        donation_tally.owner = ctx.accounts.owner.key();
        donation_tally.lamports_donated = 0;
        donation_tally.lamports_to_redeem = 0;
    }

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.community_wallet.to_account_info(),
        });
    transfer(cpi_context, lamports_to_donate)?;
    

    donation_tally.lamports_donated = donation_tally.lamports_donated.checked_add(lamports_to_donate).unwrap();    
    donation_tally.lamports_to_redeem = 0;

    Ok(())
}
```

Makikita mo na ang paglipat sa hardcoded na `community_wallet` ay nangyayari sa parehong function kung saan ina-update mo ang impormasyon sa tally. Ito ang pinakasimpleng solusyon, ngunit kung magpapatakbo ka ng mga pagsubok para sa seksyong ito, makikita mo ang pagbagal.

Ngayon tingnan ang na-optimize na solusyon:

```rust
pub fn run_concept_shared_account(ctx: Context<ConceptSharedAccount>, lamports_to_donate: u64) -> Result<()> {

    let donation_tally = &mut ctx.accounts.donation_tally;

    if !donation_tally.is_initialized {
        donation_tally.is_initialized = true;
        donation_tally.owner = ctx.accounts.owner.key();
        donation_tally.lamports_donated = 0;
        donation_tally.lamports_to_redeem = 0;
    }

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: donation_tally.to_account_info(),
        });
    transfer(cpi_context, lamports_to_donate)?;

    donation_tally.lamports_donated = donation_tally.lamports_donated.checked_add(lamports_to_donate).unwrap();    
    donation_tally.lamports_to_redeem = donation_tally.lamports_to_redeem.checked_add(lamports_to_donate).unwrap();

    Ok(())
}

pub fn run_concept_shared_account_redeem(ctx: Context<ConceptSharedAccountRedeem>) -> Result<()> {
    let transfer_amount: u64 = ctx.accounts.donation_tally.lamports_donated;

    // Decrease balance in donation_tally account
    **ctx.accounts.donation_tally.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;

    // Increase balance in community_wallet account
    **ctx.accounts.community_wallet.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    // Reset lamports_donated and lamports_to_redeem
    ctx.accounts.donation_tally.lamports_to_redeem = 0;

    Ok(())
}
```

Dito, sa `run_concept_shared_account` function, sa halip na ilipat sa bottleneck, ililipat kami sa `donation_tally` PDA. Sa ganitong paraan, pinapagana lang namin ang account ng donator at ang kanilang PDA - kaya walang bottleneck! Bukod pa rito, nag-iingat kami ng panloob na tally kung gaano karaming mga lampor ang kailangang i-redeem, ibig sabihin, ilipat mula sa PDA patungo sa pitaka ng komunidad sa ibang pagkakataon. Sa isang punto sa hinaharap, ang pitaka ng komunidad ay lilipat at lilinisin ang lahat ng mga nahuhulog na lampara (marahil isang magandang trabaho para sa [clockwork](https://www.clockwork.xyz/)). Mahalagang tandaan na ang sinuman ay dapat na makapag-sign para sa redeem function, dahil ang PDA ay may pahintulot sa sarili nito.

Kung nais mong maiwasan ang mga bottleneck sa lahat ng mga gastos, ito ay isang paraan upang harapin ito. Sa huli ito ay isang desisyon sa disenyo at ang mas simple, hindi gaanong pinakamainam na solusyon ay maaaring okay para sa ilang mga programa. Ngunit kung magkakaroon ng mataas na trapiko ang iyong programa, sulit na subukang mag-optimize. Maaari kang magpatakbo ng isang simulation anumang oras upang makita ang iyong pinakamasama, pinakamahusay at median na mga kaso.

## See it in Action

Ang lahat ng code snippet mula sa araling ito ay bahagi ng isang [Solana program na ginawa namin upang ilarawan ang mga konseptong ito](https://github.com/Unboxed-Software/advanced-program-architecture.git). Ang bawat konsepto ay may kasamang programa at test file. Halimbawa, ang **Sizes** concept ay makikita sa:

**program -** `programs/architecture/src/concepts/sizes.rs`

**test -** `cd tests/sizes.ts`

Ngayong nabasa mo na ang tungkol sa bawat isa sa mga konseptong ito, huwag mag-atubiling pumunta sa code upang mag-eksperimento nang kaunti. Maaari mong baguhin ang mga umiiral na halaga, subukang sirain ang programa, at sa pangkalahatan ay subukang maunawaan kung paano gumagana ang lahat.

Maaari mong i-fork at/o i-clone [ang program na ito mula sa Github](https://github.com/Unboxed-Software/advanced-program-architecture.git) upang makapagsimula. Bago buuin at patakbuhin ang test suite, tandaan na i-update ang `lib.rs` at `Anchor.toml` gamit ang iyong lokal na program ID.

Maaari mong patakbuhin ang buong test suite o magdagdag ng `.only` sa `describe` na tawag sa isang partikular na test file upang patakbuhin lang ang mga pagsubok ng file na iyon. Huwag mag-atubiling i-customize ito at gawin itong sarili mo.

## Conclusion

Napag-usapan namin ang tungkol sa ilang mga pagsasaalang-alang sa arkitektura ng programa: mga byte, mga account, mga bottleneck, at higit pa. Malapit ka man sa alinman sa mga partikular na pagsasaalang-alang na ito o hindi, sana ang mga halimbawa at talakayan ay nakapukaw ng ilang pag-iisip. Sa pagtatapos ng araw, ikaw ang taga-disenyo ng iyong system. Ang iyong trabaho ay upang timbangin ang mga kalamangan at kahinaan ng iba't ibang mga solusyon. Maging pasulong na pag-iisip, ngunit maging praktikal. Walang "isang mabuting paraan" upang magdisenyo ng anuman. Alamin lang ang mga trade-off.

# Demo

Gamitin natin ang lahat ng konseptong ito para gumawa ng simple, ngunit na-optimize, RPG game engine sa Solana. Ang program na ito ay magkakaroon ng mga sumusunod na tampok:
- Hayaan ang mga user na lumikha ng isang laro (`Game` account) at maging isang "game master" (ang awtoridad sa laro)
- Ang mga master ng laro ang namamahala sa configuration ng kanilang laro
- Sinuman mula sa publiko ay maaaring sumali sa isang laro bilang isang manlalaro - bawat kumbinasyon ng manlalaro/laro ay magkakaroon ng `Player` account
- Ang mga manlalaro ay maaaring mag-spawn at labanan ang mga halimaw (`Monster` account) sa pamamagitan ng paggastos ng mga action point; gagamit kami ng mga lampor bilang mga punto ng pagkilos
- Ang mga nagastos na action point ay mapupunta sa treasury ng laro gaya ng nakalista sa `Game` account

Tatalakayin namin ang mga tradeoff ng iba't ibang desisyon sa disenyo habang binibigyan ka namin ng ideya kung bakit namin ginagawa ang mga bagay. Magsimula na tayo!

### 1. Program Setup

Itatayo namin ito mula sa simula. Magsimula sa pamamagitan ng paglikha ng bagong Anchor project:

```powershell
anchor init rpg
```

Susunod, palitan ang program ID sa `programs/rpg/lib.rs` at `Anchor.toml` ng program ID na ipinapakita kapag nagpatakbo ka ng `anchor keys list`.

Panghuli, i-scaffold natin ang program sa `lib.rs` file. Upang gawing mas madali ang pagsunod, pananatilihin namin ang lahat sa isang file. Dadagdagan namin ito ng mga komento sa seksyon para sa mas mahusay na organisasyon at nabigasyon. Kopyahin ang sumusunod sa iyong file bago tayo magsimula:

```rust
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};
use anchor_lang::solana_program::log::sol_log_compute_units;

declare_id!("YOUR_KEY_HERE__YOUR_KEY_HERE");

// ----------- ACCOUNTS ----------

// ----------- GAME CONFIG ----------

// ----------- STATUS ----------

// ----------- INVENTORY ----------

// ----------- HELPER ----------

// ----------- CREATE GAME ----------

// ----------- CREATE PLAYER ----------

// ----------- SPAWN MONSTER ----------

// ----------- ATTACK MONSTER ----------

// ----------- REDEEM TO TREASURY ----------

#[program]
pub mod rpg {
    use super::*;

}
```

### 2. Create Account Structures

Ngayong handa na ang ating paunang setup, gawin natin ang ating mga account. Magkakaroon tayo ng 3:

1. `Game` - Ang account na ito ay kumakatawan at namamahala sa isang laro. Kabilang dito ang treasury para sa mga kalahok ng laro na babayaran at isang configuration struct na magagamit ng mga master ng laro upang i-customize ang laro. Dapat itong isama ang mga sumusunod na field:
     - `game_master` - epektibo ang may-ari/awtoridad
     - `treasury` - ang treasury kung saan magpapadala ang mga manlalaro ng mga action point (gagamitin lang namin ang mga lampor para sa mga action point)
     - `action_points_collected` - sinusubaybayan ang bilang ng mga action point na nakolekta ng treasury
     - `game_config` - isang config struct para sa pag-customize ng laro
2. `Player` - Isang PDA account na ang address ay hinango gamit ang game account address at ang wallet address ng player bilang mga buto. Mayroon itong maraming field na kailangan para subaybayan ang estado ng laro ng manlalaro:
     - `player` - ang pampublikong key ng player
     - `laro` - ang address ng kaukulang game account
     - `action_points_spent` - ang bilang ng mga action point na ginugol
     - `action_points_to_be_collected` - ang bilang ng mga action point na kailangan pang kolektahin
     - `status_flag` - katayuan ng manlalaro
     - `experience` - karanasan ng player
     - `kills` - bilang ng mga halimaw na napatay
     - `next_monster_index` - ang index ng susunod na halimaw na haharapin
     - `for_future_use` - 256 bytes na nakalaan para magamit sa hinaharap
     - `inventory` - isang vector ng imbentaryo ng player
3. `Monster` - Isang PDA account na ang address ay hinango gamit ang game account address, ang wallet address ng player, at isang index (ang naka-store bilang `next_monster_index` sa `Player` account).
     - `manlalaro` - ang manlalarong kinakaharap ng halimaw
     - `laro` - ang laro kung saan nauugnay ang halimaw
     - `hitpoints` - kung ilang hit point ang natitira sa halimaw

Kapag idinagdag sa programa, ang mga account ay dapat magmukhang ganito:

```rust
// ----------- ACCOUNTS ----------
#[account]
pub struct Game { // 8 bytes
    pub game_master: Pubkey,            // 32 bytes
    pub treasury: Pubkey,               // 32 bytes

    pub action_points_collected: u64,   // 8 bytes
    
    pub game_config: GameConfig,
}

#[account]
pub struct Player { // 8 bytes
    pub player: Pubkey,                 // 32 bytes
    pub game: Pubkey,                   // 32 bytes

    pub action_points_spent: u64,               // 8 bytes
    pub action_points_to_be_collected: u64,     // 8 bytes

    pub status_flag: u8,                // 8 bytes
    pub experience: u64,                 // 8 bytes
    pub kills: u64,                     // 8 bytes
    pub next_monster_index: u64,        // 8 bytes

    pub for_future_use: [u8; 256],      // Attack/Speed/Defense/Health/Mana?? Metadata??

    pub inventory: Vec<InventoryItem>,  // Max 8 items
}

#[account]
pub struct Monster { // 8 bytes
    pub player: Pubkey,                 // 32 bytes
    pub game: Pubkey,                   // 32 bytes

    pub hitpoints: u64,                 // 8 bytes
}
```

Walang masyadong kumplikadong mga desisyon sa disenyo dito, ngunit pag-usapan natin ang tungkol sa `inventory` at `for_future_use` na mga field sa `Player` struct. Dahil ang `imbentaryo` ay variable sa haba, nagpasya kaming ilagay ito sa dulo ng account upang gawing mas madali ang pag-query. Napagpasyahan din namin na sulit na gumastos ng kaunting dagdag na pera sa pagbubukod sa upa upang magkaroon ng 256 byte ng nakalaan na espasyo sa field na `for_future_use`. Maaari naming ibukod ito at muling italaga ang mga account kung kailangan naming magdagdag ng mga field sa hinaharap, ngunit ang pagdaragdag nito ngayon ay nagpapasimple sa mga bagay para sa amin sa hinaharap.

Kung pipiliin naming muling italaga sa hinaharap, kakailanganin naming magsulat ng mas kumplikadong mga query at malamang na hindi makapag-query sa isang tawag batay sa `imbentaryo`. Ang muling paglalagay at pagdaragdag ng field ay maglilipat sa posisyon ng memorya ng `imbentaryo`, na mag-iiwan sa amin na magsulat ng kumplikadong lohika upang mag-query ng mga account na may iba't ibang istruktura.

### 3. Create ancillary types

Ang susunod na kailangan naming gawin ay magdagdag ng ilan sa mga uri ng aming mga account na sanggunian na hindi pa namin nagagawa.

Magsimula tayo sa config struct ng laro. Sa teknikal na paraan, maaaring napunta ito sa account ng `Game`, ngunit magandang magkaroon ng ilang paghihiwalay at encapsulation. Ang struct na ito ay dapat mag-imbak ng mga max na item na pinapayagan sa bawat player at ilang byte para magamit sa hinaharap. Muli, ang mga byte para sa hinaharap na paggamit dito ay tumutulong sa amin na maiwasan ang pagiging kumplikado sa hinaharap. Pinakamahusay na gagana ang muling paglalagay ng mga account kapag nagdaragdag ka ng mga field sa dulo ng isang account sa halip na sa gitna. Kung inaasahan mong magdagdag ng mga patlang sa gitna ng kasalukuyang petsa, maaaring makatuwirang magdagdag ng ilang byte na "gamitin sa hinaharap" sa harap.

```rust
// ----------- GAME CONFIG ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct GameConfig {
    pub max_items_per_player: u8,
    pub for_future_use: [u64; 16], // Health of Enemies?? Experience per item?? Action Points per Action??
}
```

Susunod, gawin natin ang ating mga flag ng status. Tandaan, *maaari* naming iimbak ang aming mga flag bilang mga boolean ngunit nakakatipid kami ng espasyo sa pamamagitan ng pag-iimbak ng maraming flag sa isang byte. Ang bawat flag ay tumatagal ng ibang bit sa loob ng byte. Maaari naming gamitin ang `<<` operator upang ilagay ang `1` sa tamang bit.

```rust
// ----------- STATUS ----------

const IS_FROZEN_FLAG: u8 = 1 << 0;
const IS_POISONED_FLAG: u8 = 1 << 1;
const IS_BURNING_FLAG: u8 = 1 << 2;
const IS_BLESSED_FLAG: u8 = 1 << 3;
const IS_CURSED_FLAG: u8 = 1 << 4;
const IS_STUNNED_FLAG: u8 = 1 << 5;
const IS_SLOWED_FLAG: u8 = 1 << 6;
const IS_BLEEDING_FLAG: u8 = 1 << 7;
const NO_EFFECT_FLAG: u8 = 0b00000000;
```

Sa wakas, gawin natin ang aming `InventoryItem`. Dapat itong may mga field para sa pangalan ng item, halaga, at ilang byte na nakalaan para magamit sa hinaharap.

```rust
// ----------- INVENTORY ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InventoryItem {
    pub name: [u8; 32], // Fixed Name up to 32 bytes
    pub amount: u64,
    pub for_future_use: [u8; 128], // Metadata?? // Effects // Flags?
}
```

### 4. Create helper function for spending action points

Ang huling bagay na gagawin namin bago isulat ang mga tagubilin ng programa ay lumikha ng isang function ng katulong para sa paggastos ng mga punto ng aksyon. Magpapadala ang mga manlalaro ng mga action point (laports) sa treasury ng laro bilang bayad para sa pagsasagawa ng mga aksyon sa laro.

Dahil ang pagpapadala ng mga lampor sa isang treasury ay nangangailangan ng pagsulat ng data sa treasury account na iyon, madali tayong mauwi sa isang bottleneck sa pagganap kung maraming manlalaro ang sumusubok na sumulat sa parehong treasury nang sabay-sabay (Tingnan ang [Dealing With Concurrency](#dealing-with-concurrency) ).

Sa halip, ipapadala namin ang mga ito sa player PDA account at gagawa ng tagubilin na magpapadala ng mga lamport mula sa account na iyon sa treasury sa isang iglap. Ito ay nagpapagaan ng anumang mga isyu sa concurrency dahil ang bawat manlalaro ay may sariling account, ngunit pinapayagan din ang programa na makuha ang mga lamport na iyon anumang oras.

```rust
// ----------- HELPER ----------

pub fn spend_action_points<'info>(
    action_points: u64, 
    player_account: &mut Account<'info, Player>,
    player: &AccountInfo<'info>, 
    system_program: &AccountInfo<'info>, 
) -> Result<()> {

    player_account.action_points_spent = player_account.action_points_spent.checked_add(action_points).unwrap();
    player_account.action_points_to_be_collected = player_account.action_points_to_be_collected.checked_add(action_points).unwrap();

    let cpi_context = CpiContext::new(
        system_program.clone(), 
        Transfer {
            from: player.clone(),
            to: player_account.to_account_info().clone(),
        });
    transfer(cpi_context, action_points)?;

    msg!("Minus {} action points", action_points);

    Ok(())
}
```

### 5. Create Game

Ang aming unang tagubilin ay gagawa ng `game` account. Kahit sino ay maaaring maging `game_master` at lumikha ng sarili nilang laro, ngunit kapag nalikha na ang isang laro, may ilang partikular na hadlang.

Para sa isa, ang `game` account ay isang PDA gamit ang `treasury` wallet nito. Tinitiyak nito na ang parehong `game_master` ay maaaring magpatakbo ng maraming laro kung gumamit sila ng ibang treasury para sa bawat isa.

Tandaan din na ang `treasury` ay isang lumagda sa pagtuturo. Ito ay upang matiyak na sinumang gumagawa ng laro ay may pribadong mga susi sa `treasury`. Isa itong desisyon sa disenyo sa halip na "ang tamang paraan." Sa huli, ito ay isang hakbang sa seguridad upang matiyak na makukuha ng master ng laro ang kanilang mga pondo.

```rust
// ----------- CREATE GAME ----------

#[derive(Accounts)]
pub struct CreateGame<'info> {
    #[account(
        init, 
        seeds=[b"GAME", treasury.key().as_ref()],
        bump,
        payer = game_master, 
        space = std::mem::size_of::<Game>()+ 8
    )]
    pub game: Account<'info, Game>,

    #[account(mut)]
    pub game_master: Signer<'info>,

    /// CHECK: Need to know they own the treasury
    pub treasury: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn run_create_game(ctx: Context<CreateGame>, max_items_per_player: u8) -> Result<()> {

    ctx.accounts.game.game_master = ctx.accounts.game_master.key().clone();
    ctx.accounts.game.treasury = ctx.accounts.treasury.key().clone();

    ctx.accounts.game.action_points_collected = 0;
    ctx.accounts.game.game_config.max_items_per_player = max_items_per_player;

    msg!("Game created!");

    Ok(())
}
```

### 6. Create Player

Ang aming pangalawang tagubilin ay gagawa ng `player` account. Mayroong tatlong mga tradeoff na dapat tandaan tungkol sa pagtuturo na ito:

1. Ang player account ay isang PDA account na hinango gamit ang `game` at `player` wallet. Hinahayaan nito ang mga manlalaro na lumahok sa maraming laro ngunit mayroon lamang isang account ng manlalaro bawat laro.
2. I-wrap namin ang `game` account sa isang `Box` para ilagay ito sa heap, tinitiyak na hindi namin ma-max out ang Stack.
3. Ang unang aksyon na gagawin ng sinumang manlalaro ay ang pag-spawning sa kanilang sarili, kaya tinatawag naming `spend_action_points`. Sa ngayon, na-hardcode namin ang `action_points_to_spend` upang maging 100 lampport, ngunit maaaring ito ay isang bagay na idaragdag sa game config sa hinaharap.

```rust
// ----------- CREATE PLAYER ----------
#[derive(Accounts)]
pub struct CreatePlayer<'info> {
    pub game: Box<Account<'info, Game>>,

    #[account(
        init, 
        seeds=[
            b"PLAYER", 
            game.key().as_ref(), 
            player.key().as_ref()
        ], 
        bump, 
        payer = player, 
        space = std::mem::size_of::<Player>() + std::mem::size_of::<InventoryItem>() * game.game_config.max_items_per_player as usize + 8)
    ]
    pub player_account: Account<'info, Player>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn run_create_player(ctx: Context<CreatePlayer>) -> Result<()> {

    ctx.accounts.player_account.player = ctx.accounts.player.key().clone();
    ctx.accounts.player_account.game = ctx.accounts.game.key().clone();

    ctx.accounts.player_account.status_flag = NO_EFFECT_FLAG;
    ctx.accounts.player_account.experience = 0;
    ctx.accounts.player_account.kills = 0;

    msg!("Hero has entered the game!");

    {   // Spend 100 lamports to create player
        let action_points_to_spend = 100;

        spend_action_points(
            action_points_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}
```

### 7. Spawn Monster

Ngayon na mayroon na tayong paraan para lumikha ng mga manlalaro, kailangan natin ng paraan para mag-spawn ng mga halimaw para makalaban nila. Ang tagubiling ito ay gagawa ng bagong `Monster` account na ang address ay isang PDA na nagmula sa `game` account, `player` account, at isang index na kumakatawan sa bilang ng mga halimaw na hinarap ng player. Mayroong dalawang desisyon sa disenyo dito na dapat nating pag-usapan:
1. Hinahayaan tayo ng mga buto ng PDA na subaybayan ang lahat ng mga halimaw na naipanganak ng isang manlalaro
2. Ibinalot namin ang parehong `laro` at `player` na account sa `Box` upang italaga ang mga ito sa Heap

```rust
// ----------- SPAWN MONSTER ----------
#[derive(Accounts)]
pub struct SpawnMonster<'info> {
    pub game: Box<Account<'info, Game>>,

    #[account(mut,
        has_one = game,
        has_one = player,
    )]
    pub player_account: Box<Account<'info, Player>>,

    #[account(
        init, 
        seeds=[
            b"MONSTER", 
            game.key().as_ref(), 
            player.key().as_ref(),
            player_account.next_monster_index.to_le_bytes().as_ref()
        ], 
        bump, 
        payer = player, 
        space = std::mem::size_of::<Monster>() + 8)
    ]
    pub monster: Account<'info, Monster>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn run_spawn_monster(ctx: Context<SpawnMonster>) -> Result<()> {

    {
        ctx.accounts.monster.player = ctx.accounts.player.key().clone();
        ctx.accounts.monster.game = ctx.accounts.game.key().clone();
        ctx.accounts.monster.hitpoints = 100;

        msg!("Monster Spawned!");
    }

    {
        ctx.accounts.player_account.next_monster_index = ctx.accounts.player_account.next_monster_index.checked_add(1).unwrap();
    }

    {   // Spend 5 lamports to spawn monster
        let action_point_to_spend = 5;

        spend_action_points(
            action_point_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}
```

### 8. Attack Monster

Ngayon na! Atake natin ang mga halimaw na iyon at magsimulang makakuha ng ilang exp!

Ang lohika dito ay ang mga sumusunod:
- Gumagastos ang mga manlalaro ng 1 `action_point` para umatake at makakuha ng 1 `experience`
- Kung papatayin ng manlalaro ang halimaw, tataas ang kanilang `kill` count

Hanggang sa mga desisyon sa disenyo, binalot namin ang bawat isa sa mga rpg account sa `Box` upang ilaan ang mga ito sa Heap. Bukod pa rito, gumamit kami ng `saturating_add` kapag dumarami ang karanasan at bilang ng mga pumatay.

Tinitiyak ng function na `saturating_add` na hindi kailanman aapaw ang numero. Sabihin na ang `kills` ay isang u8 at ang aking kasalukuyang kill count ay 255 (0xFF). Kung nakapatay ako ng isa pa at nagdagdag ng normal, hal. `255 + 1 = 0 (0xFF + 0x01 = 0x00) = 0`, ang kill count ay magiging 0. Pananatilihin ito ng `saturating_add` sa maximum nito kung malapit na itong gumulong, kaya `255 + 1 = 255` . Maglalagay ng error ang function na `checked_add` kung malapit na itong umapaw. Isaisip ito kapag gumagawa ng matematika sa Rust. Kahit na ang `kills` ay isang u64 at hindi kailanman gagana sa kasalukuyang programming nito, magandang kasanayan na gumamit ng ligtas na matematika at isaalang-alang ang mga roll-over.

```rust
// ----------- ATTACK MONSTER ----------
#[derive(Accounts)]
pub struct AttackMonster<'info> {

    #[account(
        mut,
        has_one = player,
    )]
    pub player_account: Box<Account<'info, Player>>,

    #[account(
        mut,
        has_one = player,
        constraint = monster.game == player_account.game
    )]
    pub monster: Box<Account<'info, Monster>>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn run_attack_monster(ctx: Context<AttackMonster>) -> Result<()> {

    let mut did_kill = false;

    {
        let hp_before_attack =  ctx.accounts.monster.hitpoints;
        let hp_after_attack = ctx.accounts.monster.hitpoints.saturating_sub(1);
        let damage_dealt = hp_before_attack - hp_after_attack;
        ctx.accounts.monster.hitpoints = hp_after_attack;

        

        if hp_before_attack > 0 && hp_after_attack == 0 {
            did_kill = true;
        }

        if  damage_dealt > 0 {
            msg!("Damage Dealt: {}", damage_dealt);
        } else {
            msg!("Stop it's already dead!");
        }
    }

    {
        ctx.accounts.player_account.experience = ctx.accounts.player_account.experience.saturating_add(1);
        msg!("+1 EXP");

        if did_kill {
            ctx.accounts.player_account.kills = ctx.accounts.player_account.kills.saturating_add(1);
            msg!("You killed the monster!");
        }
    }

    {   // Spend 1 lamports to attack monster
        let action_point_to_spend = 1;

        spend_action_points(
            action_point_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}
```

### Redeem to Treasury

Ito ang aming huling tagubilin. Hinahayaan ng tagubiling ito ang sinuman na ipadala ang ginastos na `action_points` sa `treasury` wallet.

Muli, ilagay natin ang mga rpg account at gamitin ang ligtas na matematika.

```rust
// ----------- REDEEM TO TREASUREY ----------
#[derive(Accounts)]
pub struct CollectActionPoints<'info> {

    #[account(
        mut,
        has_one=treasury
    )]
    pub game: Box<Account<'info, Game>>,

    #[account(
        mut,
        has_one=game
    )]
    pub player: Box<Account<'info, Player>>,

    #[account(mut)]
    /// CHECK: It's being checked in the game account
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// literally anyone who pays for the TX fee can run this command - give it to a clockwork bot
pub fn run_collect_action_points(ctx: Context<CollectActionPoints>) -> Result<()> {
    let transfer_amount: u64 = ctx.accounts.player.action_points_to_be_collected;

    **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
    **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    ctx.accounts.player.action_points_to_be_collected = 0;

    ctx.accounts.game.action_points_collected = ctx.accounts.game.action_points_collected.checked_add(transfer_amount).unwrap();

    msg!("The treasury collected {} action points to treasury", transfer_amount);

    Ok(())
}
```

### Putting it all Together

Ngayon na ang lahat ng aming lohika ng pagtuturo ay nakasulat, idagdag natin ang mga function na ito sa aktwal na mga tagubilin sa programa. Makakatulong din ang pag-log ng mga compute unit para sa bawat pagtuturo.

```rust
#[program]
pub mod rpg {
    use super::*;

    pub fn create_game(ctx: Context<CreateGame>, max_items_per_player: u8) -> Result<()> {
        run_create_game(ctx, max_items_per_player)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn create_player(ctx: Context<CreatePlayer>) -> Result<()> {
        run_create_player(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn spawn_monster(ctx: Context<SpawnMonster>) -> Result<()> {
        run_spawn_monster(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn attack_monster(ctx: Context<AttackMonster>) -> Result<()> {
        run_attack_monster(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn deposit_action_points(ctx: Context<CollectActionPoints>) -> Result<()> {
        run_collect_action_points(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

}
```

Kung naidagdag mo nang tama ang lahat ng mga seksyon, dapat ay matagumpay kang makabuo.

```shell
anchor build
```

### Testing

Ngayon, tingnan natin ang gawain ng sanggol na ito!

I-set up natin ang `tests/rpg.ts` file. Sagutin namin ang bawat pagsusulit. Ngunit una, kailangan naming mag-set up ng dalawang magkaibang account. Pangunahin ang `gameMaster` at ang `treasury`.

```tsx
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rpg, IDL } from "../target/types/rpg";
import { assert } from "chai";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("RPG", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Rpg as Program<Rpg>;
  const wallet = anchor.workspace.Rpg.provider.wallet
    .payer as anchor.web3.Keypair;
  const gameMaster = wallet;
  const player = wallet;

  const treasury = anchor.web3.Keypair.generate();

it("Create Game", async () => {});

it("Create Player", async () => {});

it("Spawn Monster", async () => {});

it("Attack Monster", async () => {});

it("Deposit Action Points", async () => {});

});
```

Ngayon, idagdag natin ang pagsubok sa `Gumawa ng Laro`. Tawagan lang ang `create Game` na may walong item, siguraduhing ipasa ang lahat ng account, at tiyaking pipirmahan ng `treasury` account ang transaksyon.

```tsx
it("Create Game", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const txHash = await program.methods
      .createGame(
        8, // 8 Items per player
      )
      .accounts({
        game: gameKey,
        gameMaster: gameMaster.publicKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([treasury])
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Print out if you'd like
    // const account = await program.account.game.fetch(gameKey);

  });
```

Sige at suriin kung gumagana ang iyong pagsubok:

```tsx
yarn install
anchor test
```

**Hacky workaround:** Kung sa ilang kadahilanan, ang command na `yarn install` ay nagreresulta sa ilang `.pnp.*` file at walang `node_modules`, maaaring gusto mong tawagan ang `rm -rf .pnp.*` na sinusundan ng `npm i` at pagkatapos ay `yarn install`. Dapat gumana yan.

Ngayong tumatakbo na ang lahat, ipatupad natin ang mga pagsubok na `Gumawa ng Manlalaro`, `Spawn Monster`, at `Attack Monster`. Patakbuhin ang bawat pagsubok habang kinukumpleto mo ang mga ito upang matiyak na ang mga bagay ay tumatakbo nang maayos.

```typescript
it("Create Player", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );

    const txHash = await program.methods
      .createPlayer()
      .accounts({
        game: gameKey,
        playerAccount: playerKey,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Print out if you'd like
    // const account = await program.account.player.fetch(playerKey);

});

it("Spawn Monster", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );

    const playerAccount = await program.account.player.fetch(playerKey);

    const [monsterKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MONSTER"), gameKey.toBuffer(), player.publicKey.toBuffer(), playerAccount.nextMonsterIndex.toBuffer('le', 8)],
      program.programId
    );

    const txHash = await program.methods
      .spawnMonster()
      .accounts({
        game: gameKey,
        playerAccount: playerKey,
        monster: monsterKey,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Print out if you'd like
    // const account = await program.account.monster.fetch(monsterKey);

});

it("Attack Monster", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // Fetch the latest monster created
    const playerAccount = await program.account.player.fetch(playerKey);
    const [monsterKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MONSTER"), gameKey.toBuffer(), player.publicKey.toBuffer(), playerAccount.nextMonsterIndex.subn(1).toBuffer('le', 8)],
      program.programId
    );

    const txHash = await program.methods
      .attackMonster()
      .accounts({
        playerAccount: playerKey,
        monster: monsterKey,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Print out if you'd like
    // const account = await program.account.monster.fetch(monsterKey);

    const monsterAccount = await program.account.monster.fetch(monsterKey);
    assert(monsterAccount.hitpoints.eqn(99));
});
```

Pansinin ang halimaw na pipiliin naming atakihin ay `playerAccount.nextMonsterIndex.subn(1).toBuffer('le', 8)`. Nagbibigay-daan ito sa amin na atakehin ang pinakahuling halimaw na lumitaw. Anumang bagay sa ibaba ng `nextMonsterIndex` ay dapat okay. Panghuli, dahil ang mga buto ay hanay lamang ng mga byte, kailangan nating gawing u64 ang index, na maliit na endian `le` sa 8 bytes.

Patakbuhin ang `anchor test` upang harapin ang ilang pinsala!

Sa wakas, sumulat tayo ng isang pagsubok upang tipunin ang lahat ng mga nakadepositong punto ng pagkilos. Ang pagsusulit na ito ay maaaring maging kumplikado para sa kung ano ang ginagawa nito. Iyon ay dahil bumubuo kami ng ilang bagong account upang ipakita na maaaring tawagan ng sinuman ang redeem function na `depositActionPoints`. Gumagamit kami ng mga pangalan tulad ng `clockwork` para sa mga ito dahil kung patuloy na tumatakbo ang larong ito, malamang na makatuwirang gumamit ng isang bagay tulad ng [clockwork](https://www.clockwork.xyz/) cron jobs.

```tsx
it("Deposit Action Points", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // To show that anyone can deposit the action points
    // Ie, give this to a clockwork bot
    const clockworkWallet = anchor.web3.Keypair.generate();

    // To give it a starting balance
    const clockworkProvider = new anchor.AnchorProvider(
        program.provider.connection,
        new NodeWallet(clockworkWallet),
        anchor.AnchorProvider.defaultOptions(),
    )
    const clockworkProgram = new anchor.Program<Rpg>(
        IDL,
        program.programId,
        clockworkProvider,
    )

    // Have to give the accounts some lamports else the tx will fail
    const amountToInitialize = 10000000000;

    const clockworkAirdropTx = await clockworkProgram.provider.connection.requestAirdrop(clockworkWallet.publicKey, amountToInitialize);
    await program.provider.connection.confirmTransaction(clockworkAirdropTx, "confirmed");

    const treasuryAirdropTx = await clockworkProgram.provider.connection.requestAirdrop(treasury.publicKey, amountToInitialize);
    await program.provider.connection.confirmTransaction(treasuryAirdropTx, "confirmed");

    const txHash = await clockworkProgram.methods
      .depositActionPoints()
      .accounts({
        game: gameKey,
        player: playerKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    const expectedActionPoints = 100 + 5 + 1; // Player Create ( 100 ) + Monster Spawn ( 5 ) + Monster Attack ( 1 )
    const treasuryBalance = await program.provider.connection.getBalance(treasury.publicKey);
    assert(
        treasuryBalance == 
        (amountToInitialize + expectedActionPoints) // Player Create ( 100 ) + Monster Spawn ( 5 ) + Monster Attack ( 1 )
    );

    const gameAccount = await program.account.game.fetch(gameKey);
    assert(gameAccount.actionPointsCollected.eqn(expectedActionPoints));

    const playerAccount = await program.account.player.fetch(playerKey);
    assert(playerAccount.actionPointsSpent.eqn(expectedActionPoints));
    assert(playerAccount.actionPointsToBeCollected.eqn(0));

});
```

Panghuli, patakbuhin ang `anchor test` para makitang gumagana ang lahat.

Binabati kita! Marami itong dapat takpan, ngunit mayroon ka na ngayong mini RPG game engine. Kung ang mga bagay ay hindi masyadong gumagana, bumalik sa demo at hanapin kung saan ka nagkamali. Kung kailangan mo, maaari kang sumangguni sa [`pangunahing` branch ng solution code](https://github.com/Unboxed-Software/anchor-rpg).

Siguraduhing isabuhay ang mga konseptong ito sa sarili mong mga programa. Ang bawat maliit na pag-optimize ay nagdaragdag!

# Challenge

Ngayon ay iyong pagkakataon na magsanay nang nakapag-iisa. Bumalik sa Demo code na naghahanap ng mga karagdagang pag-optimize at/o pagpapalawak na maaari mong gawin. Pag-isipan ang mga bagong system at feature na idaragdag mo at kung paano mo i-optimize ang mga ito.

Makakahanap ka ng ilang halimbawang pagbabago sa `challenge-solution` branch ng [RPG repository](https://github.com/Unboxed-Software/anchor-rpg/tree/challenge-solution).

Panghuli, dumaan sa isa sa iyong sariling mga programa at mag-isip tungkol sa mga pag-optimize na maaari mong gawin upang mapabuti ang pamamahala ng memorya, laki ng imbakan, at/o kasabay.
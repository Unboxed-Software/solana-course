---
title: Compressed NFTs
objectives:
- Gumawa ng naka-compress na koleksyon ng NFT gamit ang Bubblegum program ng Metaplex
- Mint compressed NFTs gamit ang Bubblegum TS SDK
- Maglipat ng mga naka-compress na NFT gamit ang Bubblegum TS SDK
- Basahin ang naka-compress na data ng NFT gamit ang Read API
---

# TL;DR

- **Mga Compressed NFT (cNFTs)** ay gumagamit ng **State Compression** upang i-hash ang NFT data at iimbak ang hash onchain sa isang account gamit ang isang **kasabay na merkle tree** na istraktura
- Ang cNFT data hash ay hindi magagamit upang ipahiwatig ang cNFT data, ngunit maaari itong magamit upang **mag-verify** kung ang cNFT data na iyong nakikita ay tama
- Pagsuporta sa mga provider ng RPC **index** cNFT data off-chain kapag ang cNFT ay minted para magamit mo ang **Read API** para ma-access ang data
- Ang **Metaplex Bubblegum program** ay isang abstraction sa ibabaw ng **State Compression** program na nagbibigay-daan sa iyo upang mas simpleng lumikha, mag-mint, at pamahalaan ang mga koleksyon ng cNFT

# Lesson

Ang mga naka-compress na NFT (cNFTs) ay eksakto kung ano ang iminumungkahi ng kanilang pangalan: Mga NFT na ang istraktura ay tumatagal ng mas kaunting storage ng account kaysa sa mga tradisyonal na NFT. Ang mga naka-compress na NFT ay gumagamit ng isang konsepto na tinatawag na **State Compression** upang mag-imbak ng data sa paraang lubhang nakakabawas sa mga gastos.

Napakamura ng mga gastos sa transaksyon ng Solana kaya hindi naiisip ng karamihan sa mga user kung gaano kamahal ang pagmimina ng mga NFT. Ang gastos sa pag-set up at paggawa ng 1 milyong tradisyonal na NFT ay humigit-kumulang 24,000 SOL. Sa paghahambing, ang mga cNFT ay maaaring i-structure kung saan ang parehong setup at mint ay nagkakahalaga ng 10 SOL o mas mababa. Nangangahulugan iyon na ang sinumang gumagamit ng mga NFT sa sukat ay maaaring mabawasan ang mga gastos ng higit sa 1000x sa pamamagitan ng paggamit ng mga cNFT sa mga tradisyonal na NFT.

Gayunpaman, ang mga cNFT ay maaaring mahirap gamitin. Sa kalaunan, ang tooling na kinakailangan para magtrabaho sa kanila ay sapat na mababawi mula sa pinagbabatayan na teknolohiya na ang karanasan ng developer sa pagitan ng mga tradisyonal na NFT at cNFT ay magiging bale-wala. Ngunit sa ngayon, kakailanganin mo pa ring maunawaan ang mababang antas ng mga piraso ng puzzle, kaya't humukay tayo!

## A theoretical overview of cNFTs

Karamihan sa mga gastos na nauugnay sa mga tradisyonal na NFT ay bumababa sa espasyo ng imbakan ng account. Gumagamit ang mga naka-compress na NFT ng konsepto na tinatawag na State Compression para mag-imbak ng data sa mas murang **ledger state** ng blockchain, gamit ang mas mahal na espasyo ng account para lang mag-imbak ng "fingerprint", o **hash**, ng data. Binibigyang-daan ka ng hash na ito na i-verify nang cryptographic na hindi na-tamper ang data.

Para sa parehong mga hash ng store at paganahin ang pag-verify, gumagamit kami ng espesyal na istraktura ng binary tree na kilala bilang **kasabay na merkle tree**. Ang istraktura ng punong ito ay nagbibigay-daan sa amin na mag-hash ng data nang magkasama sa isang tiyak na paraan upang makalkula ang isang solong panghuling hash na maiimbak sa chain. Ang panghuling hash na ito ay makabuluhang mas maliit sa laki kaysa sa lahat ng orihinal na data na pinagsama, kaya ang "compression." Ang mga hakbang sa prosesong ito ay:

1. Kumuha ng anumang piraso ng data
2. Gumawa ng hash ng data na ito
3. Itago ang hash na ito bilang isang "dahon" sa ilalim ng puno
4. Ang bawat pares ng dahon ay pinagsasama-sama, na lumilikha ng isang "sanga"
5. Ang bawat branch ay sabay na iha-hash
6. Patuloy na umakyat sa puno at i-hash ang mga katabing sanga
7. Kapag nasa tuktok na ng puno, gagawa ng panghuling "root hash" 
8. Itago ang root hash sa chain bilang isang nabe-verify na patunay ng data sa loob ng bawat dahon
9. Ang sinumang gustong i-verify na ang data na mayroon sila ay tumutugma sa "pinagmulan ng katotohanan" ay maaaring dumaan sa parehong proseso at ihambing ang panghuling hash nang hindi kinakailangang iimbak ang lahat ng data sa chain

Ang isang problemang hindi natugunan sa itaas ay kung paano gawing available ang data kung hindi ito makuha mula sa isang account. Dahil ang proseso ng pag-hash na ito ay nangyayari sa chain, ang lahat ng data ay umiiral sa ledger state at sa teoryang ito ay maaaring makuha mula sa orihinal na transaksyon sa pamamagitan ng pag-replay sa buong chain state mula sa pinagmulan. Gayunpaman, mas diretso (bagaman kumplikado pa rin) na magkaroon ng **indexer** na sumusubaybay at nag-index ng data na ito habang nagaganap ang mga transaksyon. Tinitiyak nito na mayroong isang off-chain na "cache" ng data na maa-access ng sinuman at pagkatapos ay i-verify laban sa onchain na root hash.

Ang prosesong ito ay *napakakomplikado*. Sasaklawin namin ang ilan sa mga pangunahing konsepto sa ibaba ngunit huwag mag-alala kung hindi mo ito naiintindihan kaagad. Pag-uusapan natin ang higit pang teorya sa aralin sa compression ng estado at pangunahing tumutok sa aplikasyon sa mga NFT sa araling ito. Magagawa mong magtrabaho kasama ang mga cNFT sa pagtatapos ng araling ito kahit na hindi mo lubos na nauunawaan ang bawat piraso ng state compression puzzle.

### Concurrent Merkle Trees

Ang **merkle tree** ay isang binary tree structure na kinakatawan ng isang hash. Ang bawat leaf node sa structure ay hash ng panloob na data nito habang ang bawat branch ay hash ng child leaf hash nito. Sa turn, ang mga sanga ay pinagsasama-sama rin hanggang sa kalaunan ay nananatili ang isang panghuling root hash.

Ang anumang pagbabago sa data ng dahon ay nagbabago sa root hash. Nagdudulot ito ng isyu kapag maraming transaksyon sa parehong slot ang sumusubok na baguhin ang data ng dahon. Dahil ang mga transaksyong ito ay dapat na isagawa nang sunud-sunod, lahat maliban sa una ay mabibigo dahil ang root hash at patunay na ipinasa ay mapapawalang-bisa ng unang transaksyon na isasagawa.

Ang **concurrent merkle tree** ay isang merkle tree na nag-iimbak ng secure na changelog ng mga pinakabagong pagbabago kasama ng kanilang root hash at ang patunay upang makuha ito. Kapag sinubukan ng maraming transaksyon sa parehong slot na baguhin ang data ng dahon, maaaring gamitin ang changelog bilang pinagmumulan ng katotohanan upang bigyang-daan ang mga sabay-sabay na pagbabagong gawin sa puno.

Kapag nagtatrabaho sa isang kasabay na puno ng merkle, mayroong tatlong mga variable na tumutukoy sa laki ng puno, ang gastos sa paggawa ng puno, at ang bilang ng mga kasabay na pagbabago na maaaring gawin sa puno:

1. Max depth
2. Max na laki ng buffer
3. Lalim ng canopy

Ang **max depth** ay ang maximum na bilang ng mga hop na makukuha mula sa anumang dahon hanggang sa ugat ng puno. Dahil ang mga merkle tree ay binary tree, ang bawat dahon ay konektado lamang sa isa pang dahon. Ang max depth ay maaaring lohikal na magamit upang kalkulahin ang bilang ng mga node para sa puno na may `2 ^ maxDepth`.

Ang **max na laki ng buffer** ay epektibong ang maximum na bilang ng mga sabay-sabay na pagbabago na maaari mong gawin sa isang puno sa loob ng iisang slot na may bisa pa rin ang root hash.

Ang **canopy depth** ay ang bilang ng mga proof node na naka-store sa chain para sa anumang partikular na proof path. Ang pag-verify ng anumang dahon ay nangangailangan ng kumpletong proof path para sa puno. Ang kumpletong proof path ay binubuo ng isang proof node para sa bawat "layer" ng tree, ibig sabihin, ang max depth na 14 ay nangangahulugang mayroong 14 na proof node. Ang bawat proof node ay nagdaragdag ng 32 byte sa isang transaksyon, kaya ang malalaking puno ay mabilis na lalampas sa maximum na limitasyon sa laki ng transaksyon nang hindi nag-cache ng mga proof node na onchain.

Bawat isa sa tatlong value na ito, max depth, max buffer size, at canopy depth, ay may kasamang tradeoff. Ang pagpapataas ng halaga ng alinman sa mga halagang ito ay nagpapataas sa laki ng account na ginamit upang iimbak ang puno, kaya tumataas ang gastos sa paggawa ng puno.

Ang pagpili sa max depth ay medyo diretso dahil direktang nauugnay ito sa bilang ng mga dahon at samakatuwid ang dami ng data na maaari mong iimbak. Kung kailangan mo ng 1million cNFT sa iisang puno, hanapin ang max depth na ginagawang totoo ang sumusunod na expression: `2^maxDepth > 1million`. Ang sagot ay 20.

Ang pagpili ng maximum na laki ng buffer ay isang tanong ng throughput: kung gaano karaming mga sabay-sabay na pagsusulat ang kailangan mo.

### SPL State Compression and Noop Programs

Umiiral ang SPL State Compression Program upang gawin ang proseso sa itaas na paulit-ulit at nabubuo sa buong Solana ecosystem. Nagbibigay ito ng mga tagubilin para sa pagsisimula ng mga merkle tree, pamamahala sa mga dahon ng puno (ibig sabihin, magdagdag, mag-update, mag-alis ng data), at mag-verify ng data ng dahon.

Ginagamit din ng State Compression Program ang isang hiwalay na "no op" na programa na ang pangunahing layunin ay gawing mas madaling i-index ang data ng dahon sa pamamagitan ng pag-log nito sa estado ng ledger.

### Use the Ledger State for storage

Ang Solana ledger ay isang listahan ng mga entry na naglalaman ng mga nilagdaang transaksyon. Sa teorya, ito ay maaaring masubaybayan pabalik sa genesis block. Ito ay epektibong nangangahulugan na anumang data na nailagay sa isang transaksyon ay umiiral sa ledger.

Kapag gusto mong mag-imbak ng naka-compress na data, ipapasa mo ito sa State Compression program kung saan ito na-hash at inilalabas bilang isang "kaganapan" sa Noop program. Ang hash ay iniimbak sa kaukulang kasabay na merkle tree. Dahil ang data ay dumaan sa isang transaksyon at kahit na umiiral sa mga log ng Noop program, ito ay mananatili magpakailanman sa estado ng ledger.

### Index data for easy lookup

Sa ilalim ng normal na mga kondisyon, karaniwan mong maa-access ang onchain na data sa pamamagitan ng pagkuha ng naaangkop na account. Kapag gumagamit ng state compression, gayunpaman, hindi ito diretso.

Gaya ng nabanggit sa itaas, ang data ay umiiral na ngayon sa estado ng ledger sa halip na sa isang account. Ang pinakamadaling lugar upang mahanap ang buong data ay nasa mga log ng pagtuturo ng Noop, ngunit habang ang data na ito ay sa isang kahulugan ay umiiral sa estado ng ledger magpakailanman, malamang na hindi ito maa-access sa pamamagitan ng mga validator pagkatapos ng isang tiyak na tagal ng panahon.

Para makatipid ng espasyo at maging mas mahusay, hindi pinapanatili ng mga validator ang bawat transaksyon pabalik sa genesis block. Ang partikular na tagal ng oras na maa-access mo ang mga log ng pagtuturo ng Noop na nauugnay sa iyong data ay mag-iiba-iba batay sa validator, ngunit kalaunan ay mawawalan ka ng access dito kung direkta kang umaasa sa mga log ng pagtuturo.

Sa teknikal, *maaari* mong i-replay ang katayuan ng transaksyon pabalik sa genesis block ngunit hindi iyon gagawin ng karaniwang team, at tiyak na hindi ito gaganap. Sa halip, dapat kang gumamit ng indexer na magmamasid sa mga kaganapang ipinadala sa Noop program at mag-imbak ng nauugnay na data sa labas ng chain. Sa ganoong paraan hindi mo kailangang mag-alala tungkol sa lumang data na hindi naa-access.

## Create a cNFT Collection

Sa kawalan ng teoretikal na background, ibaling natin ang ating pansin sa pangunahing punto ng araling ito: kung paano gumawa ng koleksyon ng cNFT.

Sa kabutihang palad, maaari mong gamitin ang mga tool na ginawa ng Solana Foundation, ang Solana developer community, at Metaplex para pasimplehin ang proseso. Sa partikular, gagamitin namin ang `@solana/spl-account-compression` SDK, ang Metaplex Bubblegum program, at ang katumbas na TS SDK ng Bubblegum program na `@metaplex-foundation/mpl-bugglegum`.

<aside>
💡 Sa oras ng pagsulat, ang Metaplex team ay lumilipat sa isang bagong bubblegum client SDK na sumusuporta sa umi, ang kanilang modular framework para sa pagbuo at paggamit ng mga JS client para sa mga programang Solana. Hindi namin gagamitin ang umi na bersyon ng SDK sa araling ito. Sa halip, i-hardcode namin ang aming dependency sa bersyon 0.7 (`@metaplex-foundation/mpl-bubblegum@0.7`). Ang bersyon na ito ay nagbibigay ng mga simpleng helper function para sa pagbuo ng mga tagubilin sa Bubblegum.

</aside>

### Prepare metadata

Bago magsimula, ihahanda mo ang iyong NFT metadata nang katulad ng kung paano mo gagawin kung gumagamit ka ng Candy Machine. Sa kaibuturan nito, ang isang NFT ay isang token lamang na may metadata na sumusunod sa pamantayan ng NFT. Sa madaling salita, dapat itong hugis tulad nito:

```json
{
  "name": "12_217_47",
  "symbol": "RGB",
  "description": "Random RGB Color",
  "seller_fee_basis_points": 0,
  "image": "https://raw.githubusercontent.com/ZYJLiu/rgb-png-generator/master/assets/12_217_47/12_217_47.png",
  "attributes": [
    {
      "trait_type": "R",
      "value": "12"
    },
    {
      "trait_type": "G",
      "value": "217"
    },
    {
      "trait_type": "B",
      "value": "47"
    }
  ]
}
```

Depende sa iyong kaso ng paggamit, maaari mong magawa ito nang pabago-bago o maaaring gusto mong maghanda ng JSON file para sa bawat cNFT bago pa man. Kakailanganin mo rin ang anumang iba pang asset na isinangguni ng JSON, gaya ng url ng `image` na ipinapakita sa halimbawa sa itaas.

### Create Collection NFT

Kung gusto mong maging bahagi ng isang koleksyon ang iyong mga cNFT, kakailanganin mong gumawa ng Collection NFT **bago** ka magsimulang mag-minting ng mga cNFT. Ito ay isang tradisyonal na NFT na nagsisilbing reference na nagbubuklod sa iyong mga cNFT nang magkasama sa isang koleksyon. Maaari mong gawin ang NFT na ito gamit ang `@metaplex-foundation/js` library. Siguraduhin lang na itinakda mo ang `isCollection` sa `true`.

```tsx
const collectionNft = await metaplex.nfts().create({
    uri: someUri,
    name: "Collection NFT",
    sellerFeeBasisPoints: 0,
    updateAuthority: somePublicKey,
    mintAuthority: somePublicKey,
    tokenStandard: 0,
    symbol: "Collection",
    isMutable: true,
    isCollection: true,
})
```

### Create Merkle Tree Account

Ngayon nagsisimula kaming lumihis mula sa proseso na iyong gagamitin kapag lumilikha ng mga tradisyonal na NFT. Ang onchain storage mechanism na ginagamit mo para sa state compression ay isang account na kumakatawan sa isang kasabay na merkle tree. Ang merkle tree account na ito ay kabilang sa SPL State Compression program. Bago ka makagawa ng anumang bagay na nauugnay sa mga cNFT, kailangan mong lumikha ng isang walang laman na merkle tree account na may naaangkop na laki.

Ang mga variable na nakakaapekto sa laki ng account ay:

1. Max depth
2. Max na laki ng buffer
3. Lalim ng canopy

Ang unang dalawang variable ay dapat piliin mula sa isang umiiral na hanay ng mga wastong pares. Ipinapakita ng talahanayan sa ibaba ang mga wastong pares kasama ang bilang ng mga cNFT na maaaring gawin gamit ang mga halagang iyon.

| Max Depth | Max Buffer Size | Max Number of cNFTs |
| --- | --- | --- |
| 3 | 8 | 8 |
| 5 | 8 | 32 |
| 14 | 64 | 16,384 |
| 14 | 256 | 16,384 |
| 14 | 1,024 | 16,384 |
| 14 | 2,048 | 16,384 |
| 15 | 64 | 32,768 |
| 16 | 64 | 65,536 |
| 17 | 64 | 131,072 |
| 18 | 64 | 262,144 |
| 19 | 64 | 524,288 |
| 20 | 64 | 1,048,576 |
| 20 | 256 | 1,048,576 |
| 20 | 1,024 | 1,048,576 |
| 20 | 2,048 | 1,048,576 |
| 24 | 64 | 16,777,216 |
| 24 | 256 | 16,777,216 |
| 24 | 512 | 16,777,216 |
| 24 | 1,024 | 16,777,216 |
| 24 | 2,048 | 16,777,216 |
| 26 | 512 | 67,108,864 |
| 26 | 1,024 | 67,108,864 |
| 26 | 2,048 | 67,108,864 |
| 30 | 512 | 1,073,741,824 |
| 30 | 1,024 | 1,073,741,824 |
| 30 | 2,048 | 1,073,741,824 |

Tandaan na ang bilang ng mga cNFT na maaaring iimbak sa puno ay ganap na nakadepende sa max depth, habang ang laki ng buffer ay tutukuyin ang bilang ng mga kasabay na pagbabago (mints, transfers, atbp.) sa loob ng parehong slot na maaaring mangyari sa tree. Sa madaling salita, piliin ang max depth na tumutugma sa bilang ng mga NFT na kailangan mong hawakan ng puno, pagkatapos ay pumili ng isa sa mga opsyon para sa max na laki ng buffer batay sa trapikong inaasahan mong kakailanganin mong suportahan.

Susunod, piliin ang lalim ng canopy. Ang pagtaas ng lalim ng canopy ay nagdaragdag sa pagiging composability ng iyong mga cNFT. Anumang oras na tatangkain ng code ng iyong developer o ng isa pang developer na i-verify ang isang cNFT, kakailanganing ipasa ng code ang pinakamaraming proof node gaya ng mayroong "mga layer" sa iyong tree. Kaya para sa max depth na 20, kakailanganin mong pumasa sa 20 proof node. Hindi lamang ito nakakapagod, ngunit dahil ang bawat proof node ay 32 bytes, posible na ma-max out ang mga laki ng transaksyon nang napakabilis.

Halimbawa, kung ang iyong puno ay may napakababang canopy depth, ang isang NFT marketplace ay maaaring suportahan lamang ang mga simpleng paglilipat ng NFT sa halip na suportahan ang isang onchain na sistema ng pagbi-bid para sa iyong mga cNFT. Ang canopy ay epektibong nag-cache ng mga patunay na node na onchain para hindi mo na kailangang ipasa ang lahat ng ito sa transaksyon, na nagbibigay-daan para sa mas kumplikadong mga transaksyon.

Ang pagpapataas sa alinman sa tatlong halagang ito ay nagpapataas sa laki ng account, at sa gayon ay tumataas ang gastos na nauugnay sa paggawa nito. Timbangin ang mga benepisyo nang naaayon kapag pumipili ng mga halaga.

Kapag nalaman mo na ang mga value na ito, maaari mong gamitin ang `createAllocTreeIx` helper function mula sa `@solana/spl-account-compression` TS SDK upang gawin ang pagtuturo para sa paggawa ng walang laman na account.

```tsx
import { createAllocTreeIx } from "@solana/spl-account-compression"

const treeKeypair = Keypair.generate()

const allocTreeIx = await createAllocTreeIx(
  connection,
  treeKeypair.publicKey,
  payer.publicKey,
  { maxDepth: 20; maxBufferSize: 256 },
  canopyDepth
)
```

Tandaan na isa lamang itong helper function para sa pagkalkula ng laki na kinakailangan ng account at paggawa ng tagubilin na ipadala sa System Program para sa paglalaan ng account. Hindi pa nakikipag-ugnayan ang function na ito sa anumang mga program na partikular sa compression.

### Use Bubblegum to Initialize Your Tree

Gamit ang walang laman na tree account na nilikha, pagkatapos ay gagamitin mo ang Bubblegum program upang simulan ang puno. Bilang karagdagan sa merkle tree account, gumagawa ang Bubblegum ng tree config account upang magdagdag ng pagsubaybay at functionality na partikular sa cNFT.

Bersyon 0.7 ng `@metaplex-foundation/mpl-bubblegum` TS SDK ay nagbibigay ng helper function na `createCreateTreeInstruction` para sa pagtawag sa `create_tree` na pagtuturo sa Bubblegum program. Bilang bahagi ng tawag, kakailanganin mong kunin ang `treeAuthority` PDA na inaasahan ng programa. Ginagamit ng PDA na ito ang address ng puno bilang isang binhi.

```tsx
import {
	createAllocTreeIx,
	SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from "@solana/spl-account-compression"
import {
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
  createCreateTreeInstruction,
} from "@metaplex-foundation/mpl-bubblegum"

...

const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
  [treeKeypair.publicKey.toBuffer()],
  BUBBLEGUM_PROGRAM_ID
)

const createTreeIx = createCreateTreeInstruction(
  {
    treeAuthority,
    merkleTree: treeKeypair.publicKey,
    payer: payer.publicKey,
    treeCreator: payer.publicKey,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  },
  {
    maxBufferSize: 256,
    maxDepth: 20,
    public: false,
  },
  BUBBLEGUM_PROGRAM_ID
)
```

Ang listahan sa ibaba ay nagpapakita ng kinakailangang input para sa helper function na ito:

- `accounts` - Isang bagay na kumakatawan sa mga account na kinakailangan ng pagtuturo. Kabilang dito ang:
     - `treeAuthority` - Inaasahan ng Bubblegum na ito ay isang PDA na hinango gamit ang merkle tree address bilang isang binhi
     - `merkleTree` - Ang merkle tree account
     - `payer` - Ang address na nagbabayad para sa mga bayarin sa transaksyon, upa, atbp.
     - `treeCreator` - Ang address na ililista bilang tagalikha ng puno
     - `logWrapper` - Ang program na gagamitin upang ilantad ang data sa mga indexer sa pamamagitan ng mga log; ito dapat ang address ng SPL Noop program maliban kung mayroon kang iba pang custom na pagpapatupad
     - `compressionProgram` - Ang compression program na gagamitin para sa pagsisimula ng merkle tree; ito dapat ang address ng SPL State Compression program maliban kung mayroon kang iba pang custom na pagpapatupad
- `args` - Isang bagay na kumakatawan sa mga karagdagang argumento na kinakailangan ng pagtuturo. Kabilang dito ang:
     - `maxBufferSize` - Ang maximum na laki ng buffer ng merkle tree
     - `maxDepth` - Ang pinakamataas na lalim ng merkle tree
     - `pampubliko` - Kapag nakatakda sa `true`, sinuman ay makakapag-mint ng mga cNFT mula sa puno; kapag itinakda sa `false`, tanging ang tagalikha ng puno o ang delegado ng puno ang makakapag-min ng mga cNFT mula sa puno

Kapag isinumite, ito ay i-invoke ang `create_tree` na pagtuturo sa Bubblegum program. Ang tagubiling ito ay gumagawa ng tatlong bagay:

1. Lumilikha ng tree config PDA account
2. Sinisimulan ang tree config account na may naaangkop na mga paunang halaga
3. Nag-isyu ng CPI sa State Compression program para simulan ang walang laman na merkle tree account

Huwag mag-atubiling tingnan ang program code [dito](https://github.com/metaplex-foundation/mpl-bubblegum/blob/main/programs/bubblegum/program/src/lib.rs#L887).

### Mint cNFTs

Kapag nasimulan ang merkle tree account at ang katumbas nitong Bubblegum tree config account, posibleng mag-mint ng mga cNFT sa tree. Ang tagubiling gagamitin sa Bubblegum ay magiging alinman sa `mint_v1` o `mint_to_collection_v1`, depende sa kung gusto mo o hindi na maging bahagi ng isang koleksyon ang minted cNFT.

Bersyon 0.7 ng `@metaplex-foundation/mpl-bubblegum` TS SDK ay nagbibigay ng helper function na `createMintV1Instruction` at `createMintToCollectionV1Instruction` upang gawing mas madali para sa iyo ang paggawa ng mga tagubilin.

Ang parehong mga function ay mangangailangan sa iyo na ipasa ang NFT metadata at isang listahan ng mga account na kinakailangan upang i-mint ang cNFT. Nasa ibaba ang isang halimbawa ng pag-minting sa isang koleksyon:

```tsx
const mintWithCollectionIx = createMintToCollectionV1Instruction(
  {
    payer: payer.publicKey,
    merkleTree: treeAddress,
    treeAuthority,
    treeDelegate: payer.publicKey,
    leafOwner: destination,
    leafDelegate: destination,
    collectionAuthority: payer.publicKey,
    collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID,
    collectionMint: collectionDetails.mint,
    collectionMetadata: collectionDetails.metadata,
    editionAccount: collectionDetails.masterEditionAccount,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    bubblegumSigner,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  },
  {
    metadataArgs: Object.assign(nftMetadata, {
      collection: { key: collectionDetails.mint, verified: false },
    }),
  }
)
```

Pansinin na mayroong dalawang argumento para sa function ng helper: `accounts` at `args`. Ang parameter na `args` ay simpleng NFT metadata, habang ang `accounts` ay isang object na naglilista ng mga account na kinakailangan ng pagtuturo. Tinatanggap na marami sa kanila:

- `payer` - ang account na magbabayad para sa mga bayarin sa transaksyon, upa, atbp.
- `merkleTree` - ang merkle tree account
- `treeAuthority` - ang awtoridad ng puno; dapat ang parehong PDA na nakuha mo dati
- `treeDelegate` - ang punong delegado; ito ay karaniwang kapareho ng tagalikha ng puno
- `leafOwner` - ang gustong may-ari ng naka-compress na NFT na ginagawa
- `leafDelegate` - ang gustong delegado ng naka-compress na NFT na ginagawa; ito ay kadalasang pareho sa may-ari ng dahon
- `collectionAuthority` - ang awtoridad ng koleksyon NFT
- `collectionAuthorityRecordPda` - opsyonal na collection authority record PDA; karaniwang wala, kung saan dapat mong ilagay ang address ng Bubblegum program
- `collectionMint` - ang mint account para sa koleksyon na NFT
- `collectionMetadata` - ang metadata account para sa koleksyon na NFT
- `editionAccount` - ang master edition account ng koleksyon na NFT
- `compressionProgram` - ang compression program na gagamitin; ito dapat ang address ng SPL State Compression program maliban kung mayroon kang iba pang custom na pagpapatupad
- `logWrapper` - ang program na gagamitin upang ilantad ang data sa mga indexer sa pamamagitan ng mga log; ito dapat ang address ng SPL Noop program maliban kung mayroon kang iba pang custom na pagpapatupad
- `bubblegumSigner` - isang PDA na ginagamit ng Bubblegrum program upang pangasiwaan ang pag-verify ng koleksyon
- `tokenMetadataProgram` - ang token metadata program na ginamit para sa koleksyon ng NFT; ito ay palaging ang Metaplex Token Metadata program

Ang pag-mining nang walang koleksyon ay nangangailangan ng mas kaunting mga account, wala sa mga ito ay eksklusibo sa pag-minting nang walang koleksyon. Maaari mong tingnan ang halimbawa sa ibaba.

```tsx
const mintWithoutCollectionIx = createMintV1Instruction(
  {
    payer: payer.publicKey,
    merkleTree: treeAddress,
    treeAuthority,
    treeDelegate: payer.publicKey,
    leafOwner: destination,
    leafDelegate: destination,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    logWrapper: SPL_NOOP_PROGRAM_ID,
  },
  {
    message: nftMetadata,
  }
)
```

## Interact with cNFTs

Mahalagang tandaan na ang mga cNFT *ay hindi* mga token ng SPL. Nangangahulugan iyon na ang iyong code ay kailangang sumunod sa iba't ibang mga kumbensyon upang mahawakan ang paggana ng cNFT tulad ng pagkuha, pag-query, paglilipat, atbp.

### Fetch cNFT data

Ang pinakasimpleng paraan upang kumuha ng data mula sa isang umiiral nang cNFT ay ang paggamit ng [Digital Asset Standard Read API](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata) (Basahin API). Tandaan na ito ay hiwalay sa karaniwang JSON RPC. Para magamit ang Read API, kakailanganin mong gumamit ng sumusuporta sa RPC Provider. Ang Metaplex ay nagpapanatili ng isang (malamang na hindi kumpleto) [listahan ng mga provider ng RPC](https://developers.metaplex.com/bubblegum/rpcs) na sumusuporta sa Read API. Sa araling ito, gagamitin natin ang [Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) dahil mayroon silang libreng suporta para sa Devnet.

Para magamit ang Read API para kumuha ng partikular na cNFT, kailangan mong magkaroon ng asset ID ng cNFT. Gayunpaman, pagkatapos mag-minting ng mga cNFT, magkakaroon ka ng hindi hihigit sa dalawang piraso ng impormasyon:

1. Ang lagda ng transaksyon
2. Ang leaf index (maaaring)

Ang tanging tunay na garantiya ay magkakaroon ka ng lagda ng transaksyon. Ito ay **posible** upang mahanap ang leaf index mula doon, ngunit ito ay nagsasangkot ng ilang medyo kumplikadong pag-parse. Ang maikling kuwento ay dapat mong kunin ang mga nauugnay na log ng pagtuturo mula sa programang Noop at i-parse ang mga ito upang mahanap ang index ng dahon. Tatalakayin natin ito nang mas malalim sa susunod na aralin. Sa ngayon, ipagpalagay naming alam mo ang leaf index.

Ito ay isang makatwirang pagpapalagay para sa karamihan ng mga mints dahil ang minting ay makokontrol ng iyong code at maaaring i-set up nang sunud-sunod upang masubaybayan ng iyong code kung aling index ang gagamitin para sa bawat mint. I.e. ang unang mint ay gagamit ng index 0, ang pangalawang index 1, atbp.

Kapag mayroon ka nang leaf index, maaari mong makuha ang katumbas na ID ng asset ng cNFT. Kapag gumagamit ng Bubblegum, ang asset ID ay isang PDA na hinango gamit ang Bubblegum program ID at ang mga sumusunod na binhi:

1. Ang static na string na `asset` ay kinakatawan sa utf8 encoding
2. Ang address ng merkle tree
3. Ang leaf index

Ang indexer ay mahalagang inoobserbahan ang mga log ng transaksyon mula sa Noop program habang nangyayari ang mga ito at iniimbak ang cNFT metadata na na-hash at naka-store sa merkle tree. Nagbibigay-daan ito sa kanila na ipakita ang data na iyon kapag hiniling. Ang asset id na ito ang ginagamit ng indexer para matukoy ang partikular na asset.

Para sa pagiging simple, maaari mo lang gamitin ang `getLeafAssetId` helper function mula sa Bubblegum SDK. Gamit ang asset ID, ang pagkuha ng cNFT ay medyo diretso. Gamitin lang ang paraan ng `getAsset` na ibinigay ng sumusuportang provider ng RPC:

```tsx
const assetId = await getLeafAssetId(treeAddress, new BN(leafIndex))
const response = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAsset",
		params: {
			id: assetId,
		},
	}),
})

const { result } = await response.json()
console.log(JSON.stringify(result, null, 2))
```

Magbabalik ito ng JSON object na komprehensibo kung ano ang magiging hitsura ng pinagsama-samang on-at off-chain metadata ng isang tradisyonal na NFT. Halimbawa, mahahanap mo ang mga katangian ng cNFT sa `content.metadata.attributes` o ang larawan sa `content.files.uri`.

### Query cNFTs

Kasama rin sa Read API ang mga paraan para makakuha ng maraming asset, query ng may-ari, creator, at higit pa. Halimbawa, sinusuportahan ni Helius ang mga sumusunod na pamamaraan:

- `getAsset`
- `getSignaturesForAsset`
- `searchAssets`
- `getAssetProof`
- `getAssetsByOwner`
- `getAssetsByAuthority`
- `getAssetsByCreator`
- `getAssetsByGroup`

Hindi namin direktang tatalakayin ang karamihan sa mga ito, ngunit tiyaking tingnan ang [Helius docs](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) upang matutunan kung paano gamitin ang mga ito nang tama.

### Transfer cNFTs

Tulad ng karaniwang paglilipat ng token ng SPL, ang seguridad ay pinakamahalaga. Ang paglipat ng token ng SPL, gayunpaman, ay ginagawang napakadali ng pag-verify ng awtoridad sa paglipat. Ito ay binuo sa SPL Token program at karaniwang pagpirma. Ang pagmamay-ari ng isang naka-compress na token ay mas mahirap i-verify. Ang aktwal na pag-verify ay mangyayari sa bahagi ng programa, ngunit ang iyong client-side code ay kailangang magbigay ng karagdagang impormasyon upang gawin itong posible.

Bagama't mayroong Bubblegum na `createTransferInstruction` helper function, mayroong higit pang assembly na kinakailangan kaysa karaniwan. Sa partikular, kailangang i-verify ng Bubblegum program na ang kabuuan ng data ng cNFT ay kung ano ang iginigiit ng kliyente bago maganap ang paglilipat. Ang kabuuan ng data ng cNFT ay na-hash at na-store bilang isang dahon sa merkle tree, at ang merkle tree ay simpleng hash ng lahat ng mga dahon at sanga ng puno. Dahil dito, hindi mo basta-basta masasabi sa program kung anong account ang titingnan at ikumpara nito ang field ng `awtoridad` o `may-ari` ng account sa signer ng transaksyon.

Sa halip, kailangan mong ibigay ang kabuuan ng data ng cNFT at alinman sa patunay na impormasyon ng merkle tree na hindi nakaimbak sa canopy. Sa ganoong paraan, malayang patunayan ng programa na ang ibinigay na data ng cNFT, at samakatuwid ang may-ari ng cNFT, ay tumpak. Pagkatapos lamang ay ligtas na matukoy ng programa kung ang lumagda sa transaksyon ay dapat, sa katunayan, payagan na ilipat ang cNFT.

Sa malawak na termino, nagsasangkot ito ng limang hakbang na proseso:

1. Kunin ang data ng asset ng cNFT mula sa indexer
2. Kunin ang patunay ng cNFT mula sa indexer
3. Kunin ang Merkle tree account mula sa Solana blockchain
4. Ihanda ang patunay ng asset bilang isang listahan ng mga bagay na `AccountMeta`
5. Bumuo at ipadala ang pagtuturo ng Bubblegum transfer

Ang unang dalawang hakbang ay halos magkapareho. Gamit ang iyong sumusuportang provider ng RPC, gamitin ang mga pamamaraang `getAsset` at `getAssetProof` upang kunin ang data ng asset at patunay, ayon sa pagkakabanggit.

```tsx
const assetDataResponse = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAsset",
			params: {
				id: assetId,
			},
		}),
	})
const assetData = (await assetDataResponse.json()).result

const assetProofResponse = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAssetProof",
			params: {
				id: assetId,
			},
		}),
	})
const assetProof = (await assetProofResponse.json()).result
```

Ang ikatlong hakbang ay ang pagkuha ng merkle tree account. Ang pinakasimpleng paraan para gawin ito ay ang paggamit ng uri ng `Concurrent Merkle Tree Account` mula sa `@solana/spl-account-compression`:

```tsx
const treePublicKey = new PublicKey(assetData.compression.tree)

const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
	connection,
	treePublicKey
)
```

Ang ikaapat na hakbang ay ang pinaka-konsepto na mapaghamong hakbang. Gamit ang tatlong piraso ng impormasyong nakalap, kakailanganin mong tipunin ang proof path para sa kaukulang dahon ng cNFT. Ang proof path ay kinakatawan bilang mga account na ipinasa sa pagtuturo ng programa. Ginagamit ng program ang bawat isa sa mga address ng account bilang mga proof node upang patunayan na ang data ng dahon ay kung ano ang sinasabi mo.

Ang buong patunay ay ibinigay ng indexer tulad ng ipinapakita sa itaas sa `assetProof`. Gayunpaman, maaari mong ibukod ang parehong bilang ng mga tail-end na account mula sa patunay bilang ang lalim ng canopy.

```tsx
const canopyDepth = treeAccount.getCanopyDepth() || 0

const proofPath: AccountMeta[] = assetProof.proof
	.map((node: string) => ({
	pubkey: new PublicKey(node),
	isSigner: false,
	isWritable: false
}))
.slice(0, assetProof.proof.length - canopyDepth)
```

Sa wakas, maaari mong tipunin ang pagtuturo sa paglipat. Ang function na helper ng pagtuturo, `createTransferInstruction`, ay nangangailangan ng mga sumusunod na argumento:

- `account` - isang listahan ng mga account sa pagtuturo, gaya ng inaasahan; ang mga ito ay ang mga sumusunod:
     - `merkleTree` - ang merkle tree account
     - `treeAuthority` - ang awtoridad ng merkle tree
     - `leafOwner` - ang may-ari ng dahon (cNFT) na pinag-uusapan
     - `leafDelegate` - ang delegado ng dahon (cNFT) na pinag-uusapan; kung walang idinagdag na delegado, ito ay dapat na kapareho ng `leafOwner`
     - `newLeafOwner` - ang address ng bagong may-ari pagkatapos ng paglipat
     - `logWrapper` - ang program na gagamitin upang ilantad ang data sa mga indexer sa pamamagitan ng mga log; ito dapat ang address ng SPL Noop program maliban kung mayroon kang iba pang custom na pagpapatupad
     - `compressionProgram` - ang compression program na gagamitin; ito dapat ang address ng SPL State Compression program maliban kung mayroon kang iba pang custom na pagpapatupad
     - `anchorRemainingAccounts` - dito mo idaragdag ang proof path
- `args` - mga karagdagang argumento na kinakailangan ng pagtuturo; sila ay:
     - `root` - ang root merkle tree node mula sa asset proof; ito ay ibinigay ng indexer bilang isang string at dapat munang i-convert sa bytes
     - `dataHash` - ang hash ng data ng asset na nakuha mula sa indexer; ito ay ibinigay ng indexer bilang isang string at dapat munang i-convert sa bytes
     - `creatorHash` - ang hash ng cNFT creator na nakuha mula sa indexer; ito ay ibinigay ng indexer bilang isang string at dapat munang i-convert sa bytes
     - `nonce` - ginagamit upang matiyak na walang dalawang dahon ang may parehong hash; ang value na ito ay dapat na kapareho ng `index`
     - `index` - ang index kung saan matatagpuan ang dahon ng cNFT sa merkle tree

Ang isang halimbawa nito ay ipinapakita sa ibaba. Tandaan na ang unang 3 linya ng code ay kumukuha ng karagdagang impormasyon na naka-nest sa mga bagay na ipinakita dati upang sila ay handa nang pumunta kapag assembling ang pagtuturo mismo.

```tsx
const treeAuthority = treeAccount.getAuthority()
const leafOwner = new PublicKey(assetData.ownership.owner)
const leafDelegate = assetData.ownership.delegate
	? new PublicKey(assetData.ownership.delegate)
	: leafOwner

const transferIx = createTransferInstruction(
	{
		merkleTree: treePublicKey,
		treeAuthority,
		leafOwner,
		leafDelegate,
		newLeafOwner: receiver,
		logWrapper: SPL_NOOP_PROGRAM_ID,
		compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
		anchorRemainingAccounts: proofPath,
	},
	{
		root: [...new PublicKey(assetProof.root.trim()).toBytes()],
		dataHash: [...new PublicKey(assetData.compression.data_hash.trim()).toBytes()],
		creatorHash: [
			...new PublicKey(assetData.compression.creator_hash.trim()).toBytes(),
		],
		nonce: assetData.compression.leaf_id,
		index: assetData.compression.leaf_id,
	}
)
```

## Conclusion

Sinaklaw namin ang mga pangunahing kasanayang kailangan para makipag-ugnayan sa mga cNFT, ngunit hindi pa ganap na komprehensibo. Maaari mo ring gamitin ang Bubblegum para gawin ang mga bagay tulad ng pagsunog, pag-verify, pag-delegate, at higit pa. Hindi namin dadaan ang mga ito, ngunit ang mga tagubiling ito ay katulad ng proseso ng mint at paglipat. Kung kailangan mo ang karagdagang functionality na ito, tingnan ang [Bubblegum client source code](https://github.com/metaplex-foundation/mpl-bubblegum/tree/main/clients/js-solita) at gamitin ang mga function ng helper nagbibigay ito.

Tandaan na ang compression ay medyo bago. Ang mga magagamit na tool ay mabilis na uunlad ngunit ang mga prinsipyong natutunan mo sa araling ito ay malamang na mananatiling pareho. Ang mga prinsipyong ito ay maaari ding palawakin sa di-makatwirang pag-compress ng estado, kaya siguraduhing master ang mga ito dito para handa ka na para sa mas nakakatuwang bagay sa mga susunod na aralin!

# Demo

Let’s jump in and practice creating and working with cNFTs. Together, we’ll build as simple a script as possible that will let us mint a cNFT collection from a merkle tree.

### 1. Get the starter code

Una sa lahat, i-clone ang starter code mula sa `starter` branch ng aming [cNFT Demo repository](https://github.com/Unboxed-Software/solana-cnft-demo).

`git clone [https://github.com/Unboxed-Software/solana-cnft-demo.git](https://github.com/Unboxed-Software/solana-cnft-demo.git)`

`cd solana-cnft-demo`

`npm install`

Maglaan ng ilang oras upang maging pamilyar sa ibinigay na starter code. Ang pinakamahalaga ay ang mga function ng helper na ibinigay sa `utils.ts` at ang mga URI na ibinigay sa `uri.ts`.

Nagbibigay ang `uri.ts` file ng 10k URI na magagamit mo para sa off-chain na bahagi ng iyong NFT metadata. Maaari kang, siyempre, lumikha ng iyong sariling metadata. Ngunit ang araling ito ay hindi tahasang tungkol sa paghahanda ng metadata kaya nagbigay kami ng ilan para sa iyo.

Ang `utils.ts` na file ay may ilang mga function ng helper upang pigilan ka sa pagsulat ng mas hindi kinakailangang boilerplate kaysa sa kailangan mo. Ang mga ito ay ang mga sumusunod:

- Ang `getOrCreateKeypair` ay gagawa ng bagong keypair para sa iyo at i-save ito sa isang `.env` file, o kung mayroon nang pribadong key sa `.env` file, magsisimula ito ng keypair mula doon.
- Ipapalabas ng `airdropSolIfNeeded` ang ilang Devnet SOL sa isang tinukoy na address kung ang balanse ng address na iyon ay mas mababa sa 1 SOL.
- Ang `createNftMetadata` ay gagawa ng NFT metadata para sa isang partikular na creator na pampublikong key at index. Ang metadata na nakukuha nito ay dummy metadata lamang gamit ang URI na tumutugma sa ibinigay na index mula sa listahan ng URI.ts` ng mga URI.
- Ang `getOrCreateCollectionNFT` ay kukuha ng koleksyon na NFT mula sa address na tinukoy sa `.env` o kung wala ay lilikha ito ng bago at idagdag ang address sa `.env`.

Sa wakas, mayroong ilang boilerplate sa `index.ts` na lumilikha ng bagong koneksyon sa Devnet, tumatawag sa `getOrCreateKeypair` para magsimula ng "wallet," at tumatawag sa `airdropSolIfNeeded` para pondohan ang wallet kung mababa ang balanse nito.

Isusulat namin ang lahat ng aming code sa `index.ts`.

### 2. Create the merkle tree account

Magsisimula tayo sa paggawa ng merkle tree account. I-encapsulate natin ito sa isang function na sa kalaunan ay gagawa *at* magsisimula ng account. Ilalagay namin ito sa ibaba ng aming `pangunahing` function sa `index.ts`. Tawagin natin itong `createAndInitializeTree`. Para gumana ang function na ito, kakailanganin nito ang mga sumusunod na parameter:

- `connection` - isang `Connection` na gagamitin para sa pakikipag-ugnayan sa network.
- `payer` - isang `Keypair` na magbabayad para sa mga transaksyon.
- `maxDepthSizePair` - isang `ValidDepthSizePair`. Ang ganitong uri ay nagmula sa `@solana/spl-account-compression`. Ito ay isang simpleng bagay na may mga katangian na `maxDepth` at `maxBufferSize` na nagpapatupad ng wastong kumbinasyon ng dalawang value.
- `canopyDepth` - isang numero para sa lalim ng canopy
    
     Sa katawan ng function, bubuo kami ng bagong address para sa tree, pagkatapos ay gagawa kami ng tagubilin para sa paglalaan ng bagong merkle tree account sa pamamagitan ng pagtawag sa `createAllocTreeIx` mula sa `@solana/spl-account-compression`.
    

```tsx
async function createAndInitializeTree(
  connection: Connection,
  payer: Keypair,
  maxDepthSizePair: ValidDepthSizePair,
  canopyDepth: number
) {
	const treeKeypair = Keypair.generate()

	const allocTreeIx = await createAllocTreeIx(
    connection,
    treeKeypair.publicKey,
    payer.publicKey,
    maxDepthSizePair,
    canopyDepth
  )
}
```

### 3. Use Bubblegum to initialize the merkle tree and create the tree config account

Gamit ang pagtuturo para sa paggawa ng puno na handa nang gamitin, maaari tayong lumikha ng isang tagubilin para sa paggamit ng `create_tree` sa programang Bubblegum. Ito ay magsisimula sa merkle tree account *at* gagawa ng bagong tree config account sa Bubblegum program.

Ang tagubiling ito ay kailangan nating ibigay ang sumusunod:

- `accounts` - isang object ng mga kinakailangang account; kabilang dito ang:
     - `treeAuthority` - ito ay dapat na isang PDA na hinango kasama ang merkle tree address at ang Bubblegum program
     - `merkleTree` - ang address ng merkle tree
     - `nagbabayad` - ang nagbabayad ng bayad sa transaksyon
     - `treeCreator` - ang address ng tree creator; gagawin namin itong pareho sa `payer`
     - `logWrapper` - gawin itong `SPL_NOOP_PROGRAM_ID`
     - `compressionProgram` - gawin itong `SPL_ACCOUNT_COMPRESSION_PROGRAM_ID`
- `args` - isang listahan ng mga argumento ng pagtuturo; kabilang dito ang:
     - `maxBufferSize` - ang laki ng buffer mula sa parameter na `maxDepthSizePair` ng aming function
     - `maxDepth` - ang max depth mula sa parameter na `maxDepthSizePair` ng aming function
     - `pampubliko` - maging pampubliko man o hindi ang puno; itatakda namin ito sa `false`

Sa wakas, maaari naming idagdag ang parehong mga tagubilin sa isang transaksyon at isumite ang transaksyon. Tandaan na ang transaksyon ay kailangang pirmahan ng parehong `nagbabayad` at ang `treeKeypair`.

```tsx
async function createAndInitializeTree(
  connection: Connection,
  payer: Keypair,
  maxDepthSizePair: ValidDepthSizePair,
  canopyDepth: number
) {
	const treeKeypair = Keypair.generate()

	const allocTreeIx = await createAllocTreeIx(
    connection,
    treeKeypair.publicKey,
    payer.publicKey,
    maxDepthSizePair,
    canopyDepth
  )

	const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
    [treeKeypair.publicKey.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )

	const createTreeIx = createCreateTreeInstruction(
    {
      treeAuthority,
      merkleTree: treeKeypair.publicKey,
      payer: payer.publicKey,
      treeCreator: payer.publicKey,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    },
    {
      maxBufferSize: maxDepthSizePair.maxBufferSize,
      maxDepth: maxDepthSizePair.maxDepth,
      public: false,
    }
  )

	const tx = new Transaction().add(allocTreeIx, createTreeIx)
  tx.feePayer = payer.publicKey
  
  try {
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [treeKeypair, payer],
      {
        commitment: "confirmed",
        skipPreflight: true,
      }
    )

    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`)

    console.log("Tree Address:", treeKeypair.publicKey.toBase58())

    return treeKeypair.publicKey
  } catch (err: any) {
    console.error("\nFailed to create merkle tree:", err)
    throw err
  }
}
```

Kung gusto mong subukan kung ano ang mayroon ka sa ngayon, huwag mag-atubiling tumawag sa `lumikha At Magsimulang Puno` mula sa `pangunahing` at magbigay ng maliliit na halaga para sa pinakamalalim na lalim at max na laki ng buffer.

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )
}
```

Tandaan na ang Devnet SOL ay throttled kaya kung sumubok ka ng masyadong maraming beses, baka maubusan ka ng Devnet SOL bago tayo makapag-minting. Upang subukan, sa iyong terminal patakbuhin ang sumusunod:

`npm run start`

### 4. Mint cNFTs to your tree

Maniwala ka man o hindi, iyon lang ang kailangan mong gawin para i-set up ang iyong puno sa mga naka-compress na NFT! Ngayon ay ibaling natin ang ating pansin sa pagmimina.

Una, magdeklara tayo ng function na tinatawag na `mintCompressedNftToCollection`. Kakailanganin nito ang mga sumusunod na parameter:

- `connection` - isang `Connection` na gagamitin para sa pakikipag-ugnayan sa network.
- `payer` - isang `Keypair` na magbabayad para sa mga transaksyon.
- `treeAddress` - ang address ng merkle tree
- `collectionDetails` - ang mga detalye ng koleksyon bilang uri ng `CollectionDetails` mula sa `utils.ts`
- `amount` - ang bilang ng mga cNFT na mint

Gagawin ng katawan ng function na ito ang sumusunod:

1. Kunin ang awtoridad ng puno tulad ng dati. Muli, ito ay isang PDA na nagmula sa merkle tree address at sa Bubblegum program.
2. Kunin ang `bubblegumSigner`. Ito ay isang PDA na nagmula sa string na `"collection_cpi"` at ang Bubblegum program at ito ay mahalaga para sa pag-minting sa isang koleksyon.
3. Lumikha ng cNFT metadata sa pamamagitan ng pagtawag sa `createNftMetadata` mula sa aming `utils.ts` file.
4. Lumikha ng pagtuturo ng mint sa pamamagitan ng pagtawag sa `createMintToCollectionV1Instruction` mula sa Bubblegum SDK.
5. Bumuo at magpadala ng isang transaksyon sa pagtuturo ng mint
6. Ulitin ang mga hakbang 3-6 `dami` nang ilang beses

Ang `createMintToCollectionV1Instruction` ay tumatagal ng dalawang argumento: `accounts` at `args`. Ang huli ay simpleng NFT metadata. Tulad ng lahat ng kumplikadong tagubilin, ang pangunahing hadlang ay ang pag-alam kung aling mga account ang ibibigay. Kaya't suriin natin ang mga ito nang mabilis:

- `payer` - ang account na magbabayad para sa mga bayarin sa transaksyon, upa, atbp.
- `merkleTree` - ang merkle tree account
- `treeAuthority` - ang awtoridad ng puno; dapat ang parehong PDA na nakuha mo dati
- `treeDelegate` - ang punong delegado; ito ay karaniwang kapareho ng tagalikha ng puno
- `leafOwner` - ang gustong may-ari ng naka-compress na NFT na ginagawa
- `leafDelegate` - ang gustong delegado ng naka-compress na NFT na ginagawa; ito ay kadalasang pareho sa may-ari ng dahon
- `collectionAuthority` - ang awtoridad ng koleksyon NFT
- `collectionAuthorityRecordPda` - opsyonal na collection authority record PDA; karaniwang wala, kung saan dapat mong ilagay ang address ng Bubblegum program
- `collectionMint` - ang mint account para sa koleksyon na NFT
- `collectionMetadata` - ang metadata account para sa koleksyon na NFT
- `editionAccount` - ang master edition account ng koleksyon na NFT
- `compressionProgram` - ang compression program na gagamitin; ito dapat ang address ng SPL State Compression program maliban kung mayroon kang iba pang custom na pagpapatupad
- `logWrapper` - ang program na gagamitin upang ilantad ang data sa mga indexer sa pamamagitan ng mga log; ito dapat ang address ng SPL Noop program maliban kung mayroon kang iba pang custom na pagpapatupad
- `bubblegumSigner` - isang PDA na ginagamit ng Bubblegrum program upang pangasiwaan ang pag-verify ng koleksyon
- `tokenMetadataProgram` - ang token metadata program na ginamit para sa koleksyon ng NFT; ito ay palaging ang Metaplex Token Metadata program

Kapag pinagsama mo ang lahat, ito ang magiging hitsura nito:

```tsx
async function mintCompressedNftToCollection(
  connection: Connection,
  payer: Keypair,
  treeAddress: PublicKey,
  collectionDetails: CollectionDetails,
  amount: number
) {
  // Derive the tree authority PDA ('TreeConfig' account for the tree account)
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [treeAddress.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )

  // Derive the bubblegum signer, used by the Bubblegum program to handle "collection verification"
  // Only used for `createMintToCollectionV1` instruction
  const [bubblegumSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_cpi", "utf8")],
    BUBBLEGUM_PROGRAM_ID
  )

  for (let i = 0; i < amount; i++) {
    // Compressed NFT Metadata
    const compressedNFTMetadata = createNftMetadata(payer.publicKey, i)

    // Create the instruction to "mint" the compressed NFT to the tree
    const mintIx = createMintToCollectionV1Instruction(
      {
        payer: payer.publicKey, // The account that will pay for the transaction
        merkleTree: treeAddress, // The address of the tree account
        treeAuthority, // The authority of the tree account, should be a PDA derived from the tree account address
        treeDelegate: payer.publicKey, // The delegate of the tree account, should be the same as the tree creator by default
        leafOwner: payer.publicKey, // The owner of the compressed NFT being minted to the tree
        leafDelegate: payer.publicKey, // The delegate of the compressed NFT being minted to the tree
        collectionAuthority: payer.publicKey, // The authority of the "collection" NFT
        collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID, // Must be the Bubblegum program id
        collectionMint: collectionDetails.mint, // The mint of the "collection" NFT
        collectionMetadata: collectionDetails.metadata, // The metadata of the "collection" NFT
        editionAccount: collectionDetails.masterEditionAccount, // The master edition of the "collection" NFT
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        bubblegumSigner,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      },
      {
        metadataArgs: Object.assign(compressedNFTMetadata, {
          collection: { key: collectionDetails.mint, verified: false },
        }),
      }
    )

    try {
      // Create new transaction and add the instruction
      const tx = new Transaction().add(mintIx)

      // Set the fee payer for the transaction
      tx.feePayer = payer.publicKey

      // Send the transaction
      const txSignature = await sendAndConfirmTransaction(
        connection,
        tx,
        [payer],
        { commitment: "confirmed", skipPreflight: true }
      )

      console.log(
        `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
      )
    } catch (err) {
      console.error("\nFailed to mint compressed NFT:", err)
      throw err
    }
  }
}
```

Ito ay isang magandang punto upang subukan sa isang maliit na puno. I-update lang ang `main` para tawagan ang `getOrCreateCollectionNFT` pagkatapos ay `mintCompressedNftToCollection`:

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )

  const collectionNft = await getOrCreateCollectionNFT(connection, wallet)

  await mintCompressedNftToCollection(
    connection,
    wallet,
    treeAddress,
    collectionNft,
    2 ** maxDepthSizePair.maxDepth
  )
}
```

Muli, upang tumakbo, sa iyong uri ng terminal: `npm run start`

### 5. Read existing cNFT data

Ngayong nakapagsulat na tayo ng code para mag-mint ng mga cNFT, tingnan natin kung talagang makukuha natin ang kanilang data. Ito ay nakakalito dahil ang onchain na data ay ang merkle tree account lamang, ang data kung saan maaaring gamitin upang i-verify ang umiiral na impormasyon bilang tumpak ngunit walang silbi sa paghahatid kung ano ang impormasyon.

Magsimula tayo sa pagdedeklara ng function na `logNftDetails` na ginagamit bilang mga parameter na `treeAddress` at `nftsMinted`.

Sa puntong ito, wala talaga kaming direktang identifier ng anumang uri na tumuturo sa aming cNFT. Para makuha iyon, kakailanganin naming malaman ang leaf index na ginamit noong ginawa namin ang aming cNFT. Magagamit namin iyon para makuha ang asset ID na ginagamit ng Read API at pagkatapos ay gamitin ang Read API para kunin ang aming cNFT data.

Sa aming kaso, gumawa kami ng hindi pampublikong puno at gumawa ng 8 cNFT, kaya alam namin na ang mga leaf index na ginamit ay 0-7. Sa pamamagitan nito, magagamit natin ang function na `getLeafAssetId` mula sa `@metaplex-foundation/mpl-bubblegum` para makuha ang asset ID.

Sa wakas, maaari kaming gumamit ng RPC na sumusuporta sa [Read API](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata) para kunin ang asset. Gagamitin namin ang [Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api), ngunit huwag mag-atubiling pumili ng sarili mong RPC provider. Para magamit ang Helius, kakailanganin mong kumuha ng libreng API Key mula sa [kanilang website](https://dev.helius.xyz/). Pagkatapos ay idagdag ang iyong `RPC_URL` sa iyong `.env` file. Halimbawa:

```tsx
# Add this
RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

 Then you simply issue a POST request to your provided RPC URL and put the `getAsset` information in the body:

```tsx
async function logNftDetails(treeAddress: PublicKey, nftsMinted: number) {
  for (let i = 0; i < nftsMinted; i++) {
    const assetId = await getLeafAssetId(treeAddress, new BN(i))
    console.log("Asset ID:", assetId.toBase58())
    const response = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const { result } = await response.json()
    console.log(JSON.stringify(result, null, 2))
  }
}
```

Mahalagang inoobserbahan ni Helius ang mga log ng transaksyon habang nangyayari ang mga ito at iniimbak ang NFT metadata na na-hash at naka-store sa merkle tree. Nagbibigay-daan ito sa kanila na ipakita ang data na iyon kapag hiniling.

Kung magdaragdag kami ng tawag sa function na ito sa dulo ng `pangunahing` at muling patakbuhin ang iyong script, napakakomprehensibo ng data na makukuha namin sa console. Kabilang dito ang lahat ng data na iyong inaasahan sa parehong onchain at off-chain na bahagi ng isang tradisyonal na NFT. Mahahanap mo ang mga katangian, file, pagmamay-ari at impormasyon ng tagalikha ng cNFT, at higit pa.

```json
{
  "interface": "V1_NFT",
  "id": "48Bw561h1fGFK4JGPXnmksHp2fpniEL7hefEc6uLZPWN",
  "content": {
    "$schema": "https://schema.metaplex.com/nft1.0.json",
    "json_uri": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.json",
    "files": [
      {
        "uri": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png",
        "cdn_uri": "https://cdn.helius-rpc.com/cdn-cgi/image//https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png",
        "mime": "image/png"
      }
    ],
    "metadata": {
      "attributes": [
        {
          "value": "183",
          "trait_type": "R"
        },
        {
          "value": "89",
          "trait_type": "G"
        },
        {
          "value": "78",
          "trait_type": "B"
        }
      ],
      "description": "Random RGB Color",
      "name": "CNFT",
      "symbol": "CNFT"
    },
    "links": {
      "image": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png"
    }
  },
  "authorities": [
    {
      "address": "DeogHav5T2UV1zf5XuH4DTwwE5fZZt7Z4evytUUtDtHd",
      "scopes": [
        "full"
      ]
    }
  ],
  "compression": {
    "eligible": false,
    "compressed": true,
    "data_hash": "3RsXHMBDpUPojPLZuMyKgZ1kbhW81YSY3PYmPZhbAx8K",
    "creator_hash": "Di6ufEixhht76sxutC9528H7PaWuPz9hqTaCiQxoFdr",
    "asset_hash": "2TwWjQPdGc5oVripPRCazGBpAyC5Ar1cia8YKUERDepE",
    "tree": "7Ge8nhDv2FcmnpyfvuWPnawxquS6gSidum38oq91Q7vE",
    "seq": 8,
    "leaf_id": 7
  },
  "grouping": [
    {
      "group_key": "collection",
      "group_value": "9p2RqBUAadMznAFiBEawMJnKR9EkFV98wKgwAz8nxLmj"
    }
  ],
  "royalty": {
    "royalty_model": "creators",
    "target": null,
    "percent": 0,
    "basis_points": 0,
    "primary_sale_happened": false,
    "locked": false
  },
  "creators": [
    {
      "address": "HASk3AoTPAvC1KnXSo6Qm73zpkEtEhbmjLpXLgvyKBkR",
      "share": 100,
      "verified": false
    }
  ],
  "ownership": {
    "frozen": false,
    "delegated": false,
    "delegate": null,
    "ownership_model": "single",
    "owner": "HASk3AoTPAvC1KnXSo6Qm73zpkEtEhbmjLpXLgvyKBkR"
  },
  "supply": {
    "print_max_supply": 0,
    "print_current_supply": 0,
    "edition_nonce": 0
  },
  "mutable": false,
  "burnt": false
}
```

Tandaan, kasama rin sa Read API ang mga paraan para makakuha ng maraming asset, query ng may-ari, creator, atbp., at higit pa. Tiyaking tingnan ang [Helius docs](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) para makita kung ano ang available.

### 6. Transfer a cNFT

Ang huling bagay na idaragdag namin sa aming script ay isang paglipat ng cNFT. Tulad ng karaniwang paglilipat ng token ng SPL, ang seguridad ay pinakamahalaga. Hindi tulad ng karaniwang paglilipat ng token ng SPL, gayunpaman, upang makabuo ng secure na paglipat na may anumang uri ng state compression, kailangan ng program na nagsasagawa ng paglilipat ng buong data ng asset.

Ang programa, Bubblegum sa kasong ito, ay kailangang ibigay sa buong data na na-hash at naka-imbak sa kaukulang dahon *at* kailangang mabigyan ng "patunay na landas" para sa pinag-uusapang dahon. Dahil dito, ang mga paglilipat ng cNFT ay medyo mas nakakalito kaysa sa mga paglilipat ng token ng SPL.

Tandaan, ang mga pangkalahatang hakbang ay:

1. Kunin ang data ng asset ng cNFT mula sa indexer
2. Kunin ang patunay ng cNFT mula sa indexer
3. Kunin ang Merkle tree account mula sa Solana blockchain
4. Ihanda ang patunay ng asset bilang isang listahan ng mga bagay na `AccountMeta`
5. Bumuo at ipadala ang pagtuturo ng Bubblegum transfer

Magsimula tayo sa pamamagitan ng pagdedeklara ng function na `transferNft` na tumatagal ng sumusunod:

- `connection` - isang `Connection` object
- `assetId` - isang object na `PublicKey`
- `sender` - isang object na `Keypair` para mapirmahan namin ang transaksyon
- `receiver` - isang object na `PublicKey` na kumakatawan sa bagong may-ari

Sa loob ng function na iyon, kunin natin muli ang data ng asset pagkatapos ay kunin din ang patunay ng asset. Para sa mabuting sukat, balutin natin ang lahat sa isang `try catch`.

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    const assetDataResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const assetData = (await assetDataResponse.json()).result

    const assetProofResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAssetProof",
        params: {
          id: assetId,
        },
      }),
    })
    const assetProof = (await assetProofResponse.json()).result
	} catch (err: any) {
    console.error("\nFailed to transfer nft:", err)
    throw err
	}
}
```

Susunod, kunin natin ang merkle tree account mula sa chain, kunin ang lalim ng canopy, at tipunin ang proof path. Ginagawa namin ito sa pamamagitan ng pagmamapa sa asset proof na nakuha namin mula kay Helius sa isang listahan ng mga object ng `AccountMeta`, pagkatapos ay pag-aalis ng anumang mga proof node sa dulo na naka-cache na sa chain sa canopy.

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    ...

    const treePublicKey = new PublicKey(assetData.compression.tree)

    const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      treePublicKey
    )

    const canopyDepth = treeAccount.getCanopyDepth() || 0

    const proofPath: AccountMeta[] = assetProof.proof
      .map((node: string) => ({
        pubkey: new PublicKey(node),
        isSigner: false,
        isWritable: false,
      }))
      .slice(0, assetProof.proof.length - canopyDepth)
  } catch (err: any) {
    console.error("\nFailed to transfer nft:", err)
    throw err
  }
}
```

Sa wakas, binubuo namin ang pagtuturo gamit ang `createTransferInstruction`, idagdag ito sa isang transaksyon, pagkatapos ay lagdaan at ipadala ang transaksyon. Ganito ang hitsura ng buong function na `transferNft` kapag natapos na:

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    const assetDataResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const assetData = (await assetDataResponse.json()).result

    const assetProofResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAssetProof",
        params: {
          id: assetId,
        },
      }),
    })
    const assetProof = (await assetProofResponse.json()).result

    const treePublicKey = new PublicKey(assetData.compression.tree)

    const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      treePublicKey
    )

    const canopyDepth = treeAccount.getCanopyDepth() || 0

    const proofPath: AccountMeta[] = assetProof.proof
      .map((node: string) => ({
        pubkey: new PublicKey(node),
        isSigner: false,
        isWritable: false,
      }))
      .slice(0, assetProof.proof.length - canopyDepth)

    const treeAuthority = treeAccount.getAuthority()
    const leafOwner = new PublicKey(assetData.ownership.owner)
    const leafDelegate = assetData.ownership.delegate
      ? new PublicKey(assetData.ownership.delegate)
      : leafOwner

    const transferIx = createTransferInstruction(
      {
        merkleTree: treePublicKey,
        treeAuthority,
        leafOwner,
        leafDelegate,
        newLeafOwner: receiver,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        anchorRemainingAccounts: proofPath,
      },
      {
        root: [...new PublicKey(assetProof.root.trim()).toBytes()],
        dataHash: [
          ...new PublicKey(assetData.compression.data_hash.trim()).toBytes(),
        ],
        creatorHash: [
          ...new PublicKey(assetData.compression.creator_hash.trim()).toBytes(),
        ],
        nonce: assetData.compression.leaf_id,
        index: assetData.compression.leaf_id,
      }
    )

    const tx = new Transaction().add(transferIx)
    tx.feePayer = sender.publicKey
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [sender],
      {
        commitment: "confirmed",
        skipPreflight: true,
      }
    )
    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`)
  } catch (err: any) {
    console.error("\nFailed to transfer nft:", err)
    throw err
  }
}
```

Ilipat natin ang ating unang naka-compress na NFT sa index 0 sa ibang tao. Una, kakailanganin naming magpaikot ng isa pang wallet na may ilang mga pondo, pagkatapos ay kunin ang assetID sa index 0 gamit ang `getLeafAssetId`. Pagkatapos ay gagawin namin ang paglipat. Panghuli, ipi-print namin ang buong koleksyon gamit ang aming function na `logNftDetails`. Hindi mo malalaman na ang NFT sa index zero ay mapabilang na ngayon sa aming bagong wallet sa field na `pagmamay-ari`.

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )

  const collectionNft = await getOrCreateCollectionNFT(connection, wallet)

  await mintCompressedNftToCollection(
    connection,
    wallet,
    treeAddress,
    collectionNft,
    2 ** maxDepthSizePair.maxDepth
  )

  const recieverWallet = await getOrCreateKeypair("Wallet_2")
  const assetId = await getLeafAssetId(treeAddress, new BN(0))
  await airdropSolIfNeeded(recieverWallet.publicKey)

  console.log(`Transfering ${assetId.toString()} from ${wallet.publicKey.toString()} to ${recieverWallet.publicKey.toString()}`)

  await transferNft(
    connection,
    assetId,
    wallet,
    recieverWallet.publicKey
  )

  await logNftDetails(treeAddress, 8)
}
```

Sige at patakbuhin ang iyong script. Ang buong bagay ay dapat isagawa nang hindi nabigo, at lahat para sa malapit sa 0.01 SOL!

Binabati kita! Ngayon alam mo na kung paano mag-mint, magbasa, at maglipat ng mga cNFT. Kung gusto mo, maaari mong i-update ang max depth, max buffer size, at canopy depth sa mas malalaking value at hangga't mayroon kang sapat na Devnet SOL, hahayaan ka ng script na ito na mag-mint ng hanggang 10k cNFTs para sa maliit na bahagi ng kung ano ang magagastos nito. para mag-mint ng 10k traditional NFTs (Tandaan: kung plano mong mag-mint ng malaking halaga ng NFTs baka gusto mong subukang i-batch ang mga tagubiling ito para sa mas kaunting kabuuang mga transaksyon).

Kung kailangan mo ng mas maraming oras sa demo na ito, huwag mag-atubiling dumaan muli dito at/o tingnan ang code ng solusyon sa sangay ng `solusyon` ng [demo repo](https://github.com/Unboxed-Software /solana-cnft-demo/tree/solution).

## Challenge

Ikaw na ang mag-isa na kunin ang mga konseptong ito! Hindi tayo magiging sobrang preskriptibo sa puntong ito, ngunit narito ang ilang ideya:

1. Lumikha ng iyong sariling produksyon cNFT koleksyon
2. Bumuo ng UI para sa demo ng araling ito na magbibigay-daan sa iyong gumawa ng cNFT at ipakita ito
3. Tingnan kung maaari mong kopyahin ang ilan sa mga functionality ng demo script sa isang onchain program, ibig sabihin, magsulat ng program na maaaring mag-mint ng mga cNFT
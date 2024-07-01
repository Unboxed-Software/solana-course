---
title: Create Solana NFTs With Metaplex
objectives:
- Ipaliwanag ang mga NFT at kung paano kinakatawan ang mga ito sa network ng Solana
- Ipaliwanag ang papel ng Metaplex sa Solana NFT ecosystem
- Gumawa at mag-update ng mga NFT gamit ang Metaplex SDK
- Ipaliwanag ang pangunahing functionality ng Token Metadata program, Candy Machine program, at Sugar CLI bilang mga tool na tumutulong sa paglikha at pamamahagi ng mga NFT sa Solana
---

# TL;DR

- Ang **Non-Fungible Token (NFTs)** ay kinakatawan sa Solana bilang SPL Token na may nauugnay na metadata account, 0 decimal, at maximum na supply na 1
- Nag-aalok ang **Metaplex** ng koleksyon ng mga tool na nagpapasimple sa paglikha at pamamahagi ng mga NFT sa Solana blockchain
- Ang **Token Metadata** program ay nagsa-standardize sa proseso ng pag-attach ng metadata sa SPL Token
- Ang **Metaplex SDK** ay isang tool na nag-aalok ng mga user-friendly na API upang tulungan ang mga developer sa paggamit ng mga onchain na tool na ibinigay ng Metaplex
- Ang programang **Candy Machine** ay isang tool sa pamamahagi ng NFT na ginagamit upang lumikha at mag-mint ng mga NFT mula sa isang koleksyon
- **Ang Sugar CLI** ay isang tool na nagpapasimple sa proseso ng pag-upload ng mga media/metadata file at paggawa ng Candy Machine para sa isang koleksyon

# Lesson

Ang Solana Non-Fungible Token (NFTs) ay mga SPL token na ginawa gamit ang Token program. Ang mga token na ito, gayunpaman, ay mayroon ding karagdagang metadata account na nauugnay sa bawat token mint. Nagbibigay-daan ito para sa isang malawak na iba't ibang mga kaso ng paggamit para sa mga token. Maaari mong epektibong i-tokenize ang anumang bagay, mula sa imbentaryo ng laro hanggang sa sining.

Sa araling ito, sasakupin namin ang mga pangunahing kaalaman sa kung paano kinakatawan ang mga NFT sa Solana, kung paano gawin at i-update ang mga ito gamit ang Metaplex SDK, at magbigay ng maikling panimula sa mga tool na makakatulong sa iyo sa paggawa at pamamahagi ng mga NFT sa Solana sa sukat.

## NFTs on Solana

Ang Solana NFT ay isang hindi mahahati na token na may nauugnay na metadata. Dagdag pa, ang mint ng token ay may pinakamataas na supply na 1.

Sa madaling salita, ang isang NFT ay isang karaniwang token mula sa Token Program ngunit naiiba sa kung ano ang maaari mong isipin bilang "mga karaniwang token" dahil ito ay:

1. May 0 decimal upang hindi ito mahahati sa mga bahagi
2. Galing sa isang token mint na may supply na 1 para 1 lang sa mga token na ito ang umiiral
3. Nagmula sa isang token mint na ang awtoridad ay nakatakda sa `null` (upang matiyak na hindi kailanman magbabago ang supply)
4. May nauugnay na account na nag-iimbak ng metadata

Habang ang unang tatlong puntos ay mga tampok na maaaring makamit gamit ang SPL Token Program, ang nauugnay na metadata ay nangangailangan ng ilang karagdagang paggana.

Karaniwan, ang metadata ng isang NFT ay may parehong onchain at off-chain na bahagi. Ang onchain metadata ay iniimbak sa isang account na nauugnay sa token mint. Ang isa sa mga field nito ay ang URI na karaniwang tumuturo sa isang off-chain na JSON file (tingnan ang [link na ito](https://lsc6xffbdvalb5dvymf5gwjpeou7rr2btkoltutn5ij5irlpg3wa.arweave.net/XIXrlKEdQLD0dcML01kvI6Ln4x0x) halimbawa). Ang off-chain na bahagi ay nag-iimbak ng karagdagang data at isang link sa larawan. Ang mga permanenteng sistema ng pag-iimbak ng data tulad ng Arweave ay kadalasang ginagamit upang iimbak ang off-chain na bahagi ng NFT metadata.

Nasa ibaba ang isang halimbawa ng ugnayan sa pagitan ng onchain at off-chain metadata. Ang onchain metadata ay naglalaman ng isang URI field na tumuturo sa isang off-chain na `.json` file na nag-iimbak ng link sa larawan ng NFT at karagdagang metadata.

![Screenshot of Metadata](../../assets/solana-nft-metaplex-metadata.png)

## **Metaplex**

Ang [Metaplex](https://www.metaplex.com/) ay isang organisasyong nagbibigay ng hanay ng mga tool, tulad ng [Metaplex SDK](https://docs.metaplex.com/sdks/js/), na nagpapasimple ang paglikha at pamamahagi ng mga NFT sa Solana blockchain. Ang mga tool na ito ay tumutugon sa isang malawak na hanay ng mga kaso ng paggamit at nagbibigay-daan sa iyong madaling pamahalaan ang buong proseso ng NFT sa paglikha at pag-print ng isang koleksyon ng NFT.

Higit na partikular, ang Metaplex SDK ay idinisenyo upang tulungan ang mga developer sa paggamit ng mga onchain na tool na inaalok ng Metaplex. Nag-aalok ito ng user-friendly na API na nakatuon sa mga sikat na kaso ng paggamit at nagbibigay-daan para sa madaling pagsasama sa mga third-party na plugin. Upang matuto nang higit pa tungkol sa mga kakayahan ng Metaplex SDK, maaari kang sumangguni sa [README](https://github.com/metaplex-foundation/js#readme).

Isa sa mga mahahalagang programa na inaalok ng Metaplex ay ang Token Metadata program. Ang Token Metadata program ay nag-standardize sa proseso ng pag-attach ng metadata sa SPL Token. Kapag gumagawa ng NFT gamit ang Metaplex, ang Token Metadata program ay gumagawa ng metadata account gamit ang Program Derived Address (PDA) na may token mint bilang isang binhi. Nagbibigay-daan ito sa metadata account para sa anumang NFT na matukoy nang deterministiko gamit ang address ng token mint. Upang matuto nang higit pa tungkol sa Token Metadata program, maaari kang sumangguni sa Metaplex [dokumentasyon](https://docs.metaplex.com/programs/token-metadata/).

Sa mga sumusunod na seksyon, sasakupin namin ang mga pangunahing kaalaman sa paggamit ng Metaplex SDK upang maghanda ng mga asset, gumawa ng mga NFT, mag-update ng mga NFT, at mag-ugnay ng isang NFT sa isang mas malawak na koleksyon.

### Metaplex instance

Ang isang `Metaplex` instance ay nagsisilbing entry point para sa pag-access sa Metaplex SDK API. Ang pagkakataong ito ay tumatanggap ng koneksyon na ginagamit upang makipag-ugnayan sa cluster. Bukod pa rito, maaaring i-customize ng mga developer ang mga pakikipag-ugnayan ng SDK sa pamamagitan ng pagtukoy ng "Identity Driver" at "Storage Driver."

Ang Identity Driver ay epektibong isang keypair na maaaring magamit upang pumirma ng mga transaksyon, isang kinakailangan kapag lumilikha ng isang NFT. Ginagamit ang Storage Driver para tukuyin ang storage service na gusto mong gamitin para sa pag-upload ng mga asset. Ang driver ng `bundlrStorage` ay ang default na opsyon at nag-a-upload ito ng mga asset sa Arweave, isang permanenteng at desentralisadong serbisyo ng storage.

Nasa ibaba ang isang halimbawa kung paano mo mase-set up ang instance ng `Metaplex` para sa devnet.

```tsx
import {
    Metaplex,
    keypairIdentity,
    bundlrStorage,
} from "@metaplex-foundation/js";
import { Connection, clusterApiUrl, Keypair } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const wallet = Keypair.generate();

const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(wallet))
    .use(
        bundlrStorage({
            address: "https://devnet.bundlr.network",
            providerUrl: "https://api.devnet.solana.com",
            timeout: 60000,
        }),
    );
```

### Upload assets

Bago ka makagawa ng NFT, kailangan mong maghanda at mag-upload ng anumang asset na pinaplano mong iugnay sa NFT. Bagama't hindi ito kailangang isang imahe, karamihan sa mga NFT ay may larawang nauugnay sa kanila.

Ang paghahanda at pag-upload ng isang imahe ay kinabibilangan ng pag-convert ng imahe sa isang buffer, pag-convert nito sa Metaplex na format gamit ang `toMetaplexFile` function, at sa wakas ay pag-upload nito sa itinalagang Storage Driver.

Sinusuportahan ng Metaplex SDK ang paglikha ng isang bagong Metaplex file mula sa alinman sa mga file na nasa iyong lokal na computer o sa mga na-upload ng isang user sa pamamagitan ng isang browser. Magagawa mo ang una sa pamamagitan ng paggamit ng `fs.readFileSync` upang basahin ang file ng imahe, pagkatapos ay i-convert ito sa isang Metaplex file gamit ang `toMetaplexFile`. Panghuli, gamitin ang iyong instance ng `Metaplex` para tawagan ang `storage().upload(file)` para i-upload ang file. Ang return value ng function ay ang URI kung saan iniimbak ang larawan.

```tsx
const buffer = fs.readFileSync("/path/to/image.png");
const file = toMetaplexFile(buffer, "image.png");

const imageUri = await metaplex.storage().upload(file);
```

### Upload metadata

Pagkatapos mag-upload ng larawan, oras na para i-upload ang off-chain na JSON metadata gamit ang `nfts().uploadMetadata` function. Magbabalik ito ng URI kung saan naka-store ang JSON metadata.

Tandaan, kasama sa off-chain na bahagi ng metadata ang mga bagay tulad ng URI ng larawan pati na rin ang karagdagang impormasyon tulad ng pangalan at paglalarawan ng NFT. Bagama't maaari mong teknikal na isama ang anumang gusto mo sa object na ito ng JSON, sa karamihan ng mga kaso dapat mong sundin ang [NFT standard](https://docs.metaplex.com/programs/token-metadata/token-standard#the-non -fungible-standard) para matiyak ang pagiging tugma sa mga wallet, program, at application.

Upang gawin ang metadata, gamitin ang paraang `uploadMetadata` na ibinigay ng SDK. Ang pamamaraang ito ay tumatanggap ng isang metadata object at nagbabalik ng isang URI na tumuturo sa na-upload na metadata.

```tsx
const { uri } = await metaplex.nfts().uploadMetadata({
    name: "My NFT",
    description: "My description",
    image: imageUri,
});
```

### Create NFT

Pagkatapos i-upload ang metadata ng NFT, maaari mo nang gawin ang NFT sa network. Nagbibigay-daan sa iyo ang `create` method ng Metaplex SDK na lumikha ng bagong NFT na may kaunting configuration. Hahawakan ng paraang ito ang paggawa ng mint account, token account, metadata account, at master edition account para sa iyo. Ang data na ibinigay sa paraang ito ay kumakatawan sa onchain na bahagi ng NFT metadata. Maaari mong i-explore ang SDK upang makita ang lahat ng iba pang input na maaaring opsyonal na ibigay sa paraang ito.

```tsx
const { nft } = await metaplex.nfts().create(
    {
        uri: uri,
        name: "My NFT",
        sellerFeeBasisPoints: 0,
    },
    { commitment: "finalized" },
);
```

Ang pamamaraang ito ay nagbabalik ng isang bagay na naglalaman ng impormasyon tungkol sa bagong likhang NFT. Bilang default, itinatakda ng SDK ang property na `isMutable` sa true, na nagbibigay-daan sa mga update na gawin sa metadata ng NFT. Gayunpaman, maaari mong piliing itakda ang `isMutable` sa false, na ginagawang hindi nababago ang metadata ng NFT.

### Update NFT

Kung iniwan mong totoo ang `isMutable`, maaaring magkaroon ka ng dahilan para i-update ang metadata ng iyong NFT. Nagbibigay-daan sa iyo ang paraang `update` ng SDK na i-update ang parehong onchain at off-chain na bahagi ng metadata ng NFT. Upang i-update ang off-chain metadata, kakailanganin mong ulitin ang mga hakbang sa pag-upload ng bagong larawan at metadata URI gaya ng nakabalangkas sa mga nakaraang hakbang, pagkatapos ay ibigay ang bagong metadata URI sa paraang ito. Babaguhin nito ang URI kung saan itinuturo ng onchain metadata, na epektibong ina-update din ang off-chain metadata.

```tsx
const nft = await metaplex.nfts().findByMint({ mintAddress });

const { response } = await metaplex.nfts().update(
    {
        nftOrSft: nft,
        name: "Updated Name",
        uri: uri,
        sellerFeeBasisPoints: 100,
    },
    { commitment: "finalized" },
);
```

Tandaan na ang anumang mga field na hindi mo isasama sa tawag sa `update` ay mananatiling pareho, ayon sa disenyo.

### Add NFT to Collection

Ang [Certified Collection](https://docs.metaplex.com/programs/token-metadata/certified-collections#introduction) ay isang NFT na maaaring pag-aari ng mga indibidwal na NFT. Mag-isip ng malaking koleksyon ng NFT tulad ng Solana Monkey Business. Kung titingnan mo ang [Metadata] ng isang indibidwal na NFT(https://explorer.solana.com/address/C18YQWbfwjpCMeCm2MPGTgfcxGeEDPvNaGpVjwYv33q1/metadata) makakakita ka ng field ng `collection` na may `key` na nakaturo sa `CV. ](https://explorer.solana.com/address/SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND/). Sa madaling salita, ang mga NFT na bahagi ng isang koleksyon ay nauugnay sa isa pang NFT na kumakatawan sa koleksyon mismo.

Upang makapagdagdag ng NFT sa isang koleksyon, kailangan munang gawin ang Collection NFT. Ang proseso ay kapareho ng dati, maliban kung magsasama ka ng isang karagdagang field sa aming NFT Metadata: `isCollection`. Ang field na ito ay nagsasabi sa token program na ang NFT na ito ay isang Collection NFT.

```tsx
const { collectionNft } = await metaplex.nfts().create(
    {
        uri: uri,
        name: "My NFT Collection",
        sellerFeeBasisPoints: 0,
        isCollection: true
    },
    { commitment: "finalized" },
);
```

Pagkatapos ay ilista mo ang Mint Address ng koleksyon bilang reference para sa field ng `collection` sa aming bagong Nft.

```tsx
const { nft } = await metaplex.nfts().create(
    {
        uri: uri,
        name: "My NFT",
        sellerFeeBasisPoints: 0,
        collection: collectionNft.mintAddress
    },
    { commitment: "finalized" },
);
```

Kapag nag-checkout ka ng metadata sa iyong bagong likhang NFT, dapat ka na ngayong makakita ng field na `collection` tulad nito:

```JSON
"collection":{
    "verified": false,
    "key": "SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND"
}
```

Ang huling bagay na kailangan mong gawin ay i-verify ang NFT. Ito ay epektibong i-flip ang `na-verify' na field sa itaas sa true, ngunit ito ay hindi kapani-paniwalang mahalaga. Ito ang nagpapaalam sa mga gumagamit ng programa at app na ang iyong NFT ay sa katunayan bahagi ng koleksyon. Magagawa mo ito gamit ang function na `verifyCollection`:

```tsx
await metaplex.nfts().verifyCollection({
    mintAddress: nft.address,
    collectionMintAddress: collectionNft.address,
    isSizedCollection: true,
})
```

### Candy Machine 

Kapag gumagawa at namamahagi ng maramihang supply ng NFT's, ginagawang madali ng Metaplex gamit ang kanilang [Candy Machine](https://docs.metaplex.com/programs/candy-machine/overview) program at [Sugar CLI](https:// docs.metaplex.com/developer-tools/sugar/).

Ang Candy Machine ay isang epektibong programa sa pagmimina at pamamahagi upang makatulong sa paglunsad ng mga koleksyon ng NFT. Ang Sugar ay isang command line interface na tumutulong sa iyong gumawa ng candy machine, maghanda ng mga asset, at gumawa ng mga NFT sa sukat. Ang mga hakbang na sakop sa itaas para sa paglikha ng isang NFT ay hindi kapani-paniwalang nakakapagod na isagawa para sa libu-libong NFT nang sabay-sabay. Ang Candy Machine at Sugar ay malulutas ito at tumulong na matiyak ang isang patas na paglulunsad sa pamamagitan ng pag-aalok ng ilang mga pananggalang.

Hindi namin sasaklawin ang mga tool na ito nang malalim, ngunit tiyak na tingnan [kung paano gumagana nang magkasama ang Candy Machine at Sugar mula sa Metaplex docs](https://docs.metaplex.com/developer-tools/sugar/overview/introduction).

Upang i-explore ang buong hanay ng mga tool na inaalok ng Metaplex, maaari mong tingnan ang [Repository ng Metaplex](https://github.com/metaplex-foundation/metaplex) sa GitHub.


# Demo

Sa demo na ito, dadaan tayo sa mga hakbang upang lumikha ng isang NFT gamit ang Metaplex SDK, i-update ang metadata ng NFT pagkatapos ng katotohanan, pagkatapos ay iugnay ang NFT sa isang koleksyon. Sa pagtatapos, magkakaroon ka ng pangunahing pag-unawa sa kung paano gamitin ang Metaplex SDK na nakikipag-ugnayan sa mga NFT sa Solana.

### 1. Starter

Upang magsimula, i-download ang starter code mula sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/solana-metaplex/tree/starter).

Ang proyekto ay naglalaman ng dalawang larawan sa `src` na direktoryo na aming gagamitin para sa mga NFT.

Bukod pa rito, sa `index.ts` file, makikita mo ang sumusunod na snippet ng code na may kasamang sample na data para sa NFT na gagawin at ia-update namin.

```tsx
interface NftData {
    name: string;
    symbol: string;
    description: string;
    sellerFeeBasisPoints: number;
    imageFile: string;
}

interface CollectionNftData {
    name: string
    symbol: string
    description: string
    sellerFeeBasisPoints: number
    imageFile: string
    isCollection: boolean
    collectionAuthority: Signer
}

// example data for a new NFT
const nftData = {
    name: "Name",
    symbol: "SYMBOL",
    description: "Description",
    sellerFeeBasisPoints: 0,
    imageFile: "solana.png",
}

// example data for updating an existing NFT
const updateNftData = {
    name: "Update",
    symbol: "UPDATE",
    description: "Update Description",
    sellerFeeBasisPoints: 100,
    imageFile: "success.png",
}

async function main() {
    // create a new connection to the cluster's API
    const connection = new Connection(clusterApiUrl("devnet"));

    // initialize a keypair for the user
    const user = await initializeKeypair(connection);

    console.log("PublicKey:", user.publicKey.toBase58());
}
```

Upang i-install ang mga kinakailangang dependency, patakbuhin ang `npm install` sa command line.

Susunod, i-execute ang code sa pamamagitan ng pagpapatakbo ng `npm start`. Gagawa ito ng bagong keypair, isulat ito sa `.env` file, at airdrop devnet SOL sa keypair.

```
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
Finished successfully
```

### 2. Set up Metaplex

Bago tayo magsimulang gumawa at mag-update ng mga NFT, kailangan nating i-set up ang instance ng Metaplex. I-update ang function na `main()` gamit ang sumusunod:

```tsx
async function main() {
    // create a new connection to the cluster's API
    const connection = new Connection(clusterApiUrl("devnet"));

    // initialize a keypair for the user
    const user = await initializeKeypair(connection);

    console.log("PublicKey:", user.publicKey.toBase58());

    // metaplex set up
    const metaplex = Metaplex.make(connection)
        .use(keypairIdentity(user))
        .use(
            bundlrStorage({
                address: "https://devnet.bundlr.network",
                providerUrl: "https://api.devnet.solana.com",
                timeout: 60000,
            }),
        );
}
```

### 3. `uploadMetadata` helper function

Susunod, hayaang lumikha ng isang helper function upang pangasiwaan ang proseso ng pag-upload ng larawan at metadata, at pagbabalik ng metadata URI. Ang function na ito ay kukuha sa Metaplex instance at NFT data bilang input, at ibabalik ang metadata URI bilang output.

```tsx
// helper function to upload image and metadata
async function uploadMetadata(
    metaplex: Metaplex,
    nftData: NftData,
): Promise<string> {
    // file to buffer
    const buffer = fs.readFileSync("src/" + nftData.imageFile);

    // buffer to metaplex file
    const file = toMetaplexFile(buffer, nftData.imageFile);

    // upload image and get image uri
    const imageUri = await metaplex.storage().upload(file);
    console.log("image uri:", imageUri);

    // upload metadata and get metadata uri (off chain metadata)
    const { uri } = await metaplex.nfts().uploadMetadata({
        name: nftData.name,
        symbol: nftData.symbol,
        description: nftData.description,
        image: imageUri,
    });

    console.log("metadata uri:", uri);
    return uri;
}
```

Ang function na ito ay magbabasa ng isang file ng imahe, i-convert ito sa isang buffer, pagkatapos ay i-upload ito upang makakuha ng isang URI ng imahe. Pagkatapos ay ia-upload nito ang NFT metadata, na kinabibilangan ng pangalan, simbolo, paglalarawan, at URI ng larawan, at makakakuha ng URI ng metadata. Ang URI na ito ay ang off-chain metadata. Ila-log din ng function na ito ang URI ng imahe at URI ng metadata para sa sanggunian.

### 5. `createNft` helper function

Susunod, gumawa tayo ng function ng helper upang mahawakan ang paglikha ng NFT. Kinukuha ng function na ito ang instance ng Metaplex, metadata URI at NFT data bilang mga input. Ginagamit nito ang paraan ng `create` ng SDK upang gawin ang NFT, na ipinapasa ang metadata URI, pangalan, bayad sa nagbebenta, at simbolo bilang mga parameter.

```tsx
// helper function create NFT
async function createNft(
    metaplex: Metaplex,
    uri: string,
    nftData: NftData,
): Promise<NftWithToken> {
    const { nft } = await metaplex.nfts().create(
        {
            uri: uri, // metadata URI
            name: nftData.name,
            sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
            symbol: nftData.symbol,
        },
        { commitment: "finalized" },
    );

    console.log(
        `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
    );

    return nft;
}
```

Nila-log ng function na `createNft` ang token mint URL at ibinabalik ang isang `nft` object na naglalaman ng impormasyon tungkol sa bagong likhang NFT. Ang NFT ay ilalagay sa pampublikong key na naaayon sa `user` na ginamit bilang Identity Driver kapag nagse-set up ng Metaplex instance.

### 6. Create NFT

Ngayong na-set up na namin ang instance ng Metaplex at gumawa ng mga function ng helper para sa pag-upload ng metadata at paggawa ng mga NFT, maaari naming subukan ang mga function na ito sa pamamagitan ng paggawa ng NFT. Sa `main()` function, tawagan ang `uploadMetadata` function para i-upload ang NFT data at makuha ang URI para sa metadata. Pagkatapos, gamitin ang function na `createNft` at metadata URI para gumawa ng NFT.

```tsx
async function main() {
	...

  // upload the NFT data and get the URI for the metadata
  const uri = await uploadMetadata(metaplex, nftData)

  // create an NFT using the helper function and the URI from the metadata
  const nft = await createNft(metaplex, uri, nftData)
}
```

Patakbuhin ang `npm start` sa command line para i-execute ang `main` function. Dapat mong makita ang output na katulad ng sumusunod:

```tsx
Current balance is 1.770520342
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
image uri: https://arweave.net/j5HcSX8qttSgJ_ZDLmbuKA7VGUo7ZLX-xODFU4LFYew
metadata uri: https://arweave.net/ac5fwNfRckuVMXiQW_EAHc-xKFCv_9zXJ-1caY08GFE
Token Mint: https://explorer.solana.com/address/QdK4oCUZ1zMroCd4vqndnTH7aPAsr8ApFkVeGYbvsFj?cluster=devnet
Finished successfully
```

Huwag mag-atubiling suriin ang mga nabuong URI para sa larawan at metadata, pati na rin tingnan ang NFT sa Solana explorer sa pamamagitan ng pagbisita sa URL na ibinigay sa output.

### 7. `updateNftUri` helper function

Susunod, gumawa tayo ng function na helper upang mahawakan ang pag-update ng isang umiiral nang URI ng NFT. Ang function na ito ay kukuha sa Metaplex instance, metadata URI, at mint address ng NFT. Ginagamit nito ang paraan ng `findByMint` ng SDK para kunin ang kasalukuyang data ng NFT gamit ang mint address, at pagkatapos ay ginagamit ang paraan ng `update` para i-update ang metadata gamit ang bagong URI. Sa wakas, itatala nito ang token mint URL at lagda ng transaksyon para sa sanggunian.

```tsx
// helper function update NFT
async function updateNftUri(
    metaplex: Metaplex,
    uri: string,
    mintAddress: PublicKey,
) {
    // fetch NFT data using mint address
    const nft = await metaplex.nfts().findByMint({ mintAddress });

    // update the NFT metadata
    const { response } = await metaplex.nfts().update(
        {
            nftOrSft: nft,
            uri: uri,
        },
        { commitment: "finalized" },
    );

    console.log(
        `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
    );

    console.log(
        `Transaction: https://explorer.solana.com/tx/${response.signature}?cluster=devnet`,
    );
}
```

### 8. Update NFT

Upang i-update ang isang umiiral nang NFT, kailangan muna naming mag-upload ng bagong metadata para sa NFT at kunin ang bagong URI. Sa function na `main()`, tawagan muli ang function na `uploadMetadata` upang i-upload ang na-update na data ng NFT at makuha ang bagong URI para sa metadata. Pagkatapos, maaari naming gamitin ang function ng helper na `updateNftUri`, na ipinapasa ang instance ng Metaplex, ang bagong URI mula sa metadata, at ang mint address ng NFT. Ang `nft.address` ay mula sa output ng `createNft` function.

```tsx
async function main() {
	...

  // upload updated NFT data and get the new URI for the metadata
  const updatedUri = await uploadMetadata(metaplex, updateNftData)

  // update the NFT using the helper function and the new URI from the metadata
  await updateNftUri(metaplex, updatedUri, nft.address)
}
```

Patakbuhin ang `npm start` sa command line para i-execute ang `main` function. Dapat kang makakita ng karagdagang output na katulad ng sumusunod:

```tsx
...
Token Mint: https://explorer.solana.com/address/6R9egtNxbzHr5ksnGqGNHXzKuKSgeXAbcrdRUsR1fkRM?cluster=devnet
Transaction: https://explorer.solana.com/tx/5VkG47iGmECrqD11zbF7psaVqFkA4tz3iZar21cWWbeySd66fTkKg7ni7jiFkLqmeiBM6GzhL1LvNbLh4Jh6ozpU?cluster=devnet
Finished successfully
```

Maaari mo ring tingnan ang mga NFT sa Phantom wallet sa pamamagitan ng pag-import ng `PRIVATE_KEY` mula sa .env file.

### 9. Create an NFT collection

Kahanga-hanga, alam mo na ngayon kung paano lumikha ng isang NFT at i-update ito sa Solana blockchain! Ngunit, paano mo ito idadagdag sa isang koleksyon?

Una, gumawa tayo ng helper function na tinatawag na `createCollectionNft`. Tandaan na ito ay halos kapareho sa `createNft`, ngunit tinitiyak na ang `isCollection` ay nakatakda sa true at ang data ay tumutugma sa mga kinakailangan para sa isang koleksyon.

```tsx
async function createCollectionNft(
    metaplex: Metaplex,
    uri: string,
    data: CollectionNftData
): Promise<NftWithToken> {
    const { nft } = await metaplex.nfts().create(
        {
            uri: uri,
            name: data.name,
            sellerFeeBasisPoints: data.sellerFeeBasisPoints,
            symbol: data.symbol,
            isCollection: true,
        },
        { commitment: "finalized" }
    )

    console.log(
        `Collection Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
    )

    return nft
}
```

Susunod, kailangan nating gawin ang off-chain na data para sa koleksyon. Sa `pangunahing` *bago* ang mga kasalukuyang tawag sa `createNft`, idagdag ang sumusunod na `collectionNftData`:

```tsx
const collectionNftData = {
    name: "TestCollectionNFT",
    symbol: "TEST",
    description: "Test Description Collection",
    sellerFeeBasisPoints: 100,
    imageFile: "success.png",
    isCollection: true,
    collectionAuthority: user,
}
```

Ngayon, tawagan natin ang `uploadMetadata` gamit ang `collectionNftData` at pagkatapos ay tawagan ang `createCollectionNft`. Muli, gawin ito *bago* ang code na lumilikha ng isang NFT.

```tsx
async function main() {
    ...

    // upload data for the collection NFT and get the URI for the metadata
    const collectionUri = await uploadMetadata(metaplex, collectionNftData)

    // create a collection NFT using the helper function and the URI from the metadata
    const collectionNft = await createCollectionNft(
        metaplex,
        collectionUri,
        collectionNftData
    )
}
```

Ibabalik nito ang mint address ng aming koleksyon upang magamit namin ito upang magtalaga ng mga NFT sa koleksyon.

### 10. Assign an NFT to a collection

Ngayong mayroon na tayong koleksyon, baguhin natin ang ating umiiral na code upang ang mga bagong likhang NFT ay maidagdag sa koleksyon. Una, baguhin natin ang ating function na `createNft` upang ang tawag sa `nfts().create` ay kasama ang field na `collection`. Pagkatapos, magdagdag ng code na tumatawag sa `verifyCollection` para gawin ito upang ang field na `verify` sa onchain metadata ay nakatakda sa true. Sa ganitong paraan malalaman ng mga nakakatuwang programa at app na ang NFT sa katunayan ay kabilang sa koleksyon.

```tsx
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData
): Promise<NftWithToken> {
    const { nft } = await metaplex.nfts().create(
        {
            uri: uri, // metadata URI
            name: nftData.name,
            sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
            symbol: nftData.symbol,
        },
        { commitment: "finalized" }
    )

    console.log(
        `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}? cluster=devnet`
    )

    //this is what verifies our collection as a Certified Collection
    await metaplex.nfts().verifyCollection({    
        mintAddress: nft.mint.address,
        collectionMintAddress: collectionMint,
        isSizedCollection: true,
    })

    return nft
}
```

Ngayon, patakbuhin ang `npm start` at voila! Kung susundin mo ang bagong link ng nft at titingnan ang tab na Metadata makakakita ka ng field na `collection` kung saan nakalista ang mint address ng iyong koleksyon.

Binabati kita! Matagumpay mong natutunan kung paano gamitin ang Metaplex SDK upang gumawa, mag-update, at mag-verify ng mga NFT bilang bahagi ng isang koleksyon. Iyon ang lahat ng kailangan mo upang bumuo ng iyong sariling koleksyon para sa halos anumang kaso ng paggamit. Maaari kang bumuo ng isang katunggali sa TicketMaster, baguhin ang Programa ng Membership ng Costco, o i-digitize ang Student ID system ng iyong paaralan. Ang mga posibilidad ay walang hanggan!

Kung gusto mong tingnan ang panghuling code ng solusyon, mahahanap mo ito sa sangay ng solusyon ng parehong [repository](https://github.com/Unboxed-Software/solana-metaplex/tree/solution).

# Challenge

Upang palalimin ang iyong pag-unawa sa mga tool ng Metaplex, sumisid sa dokumentasyon ng Metaplex at gawing pamilyar ang iyong sarili sa iba't ibang mga programa at tool na inaalok ng Metaplex. Halimbawa, maaari mong pag-aralan ang tungkol sa programa ng Candy Machine upang maunawaan ang pagpapagana nito.

Kapag naunawaan mo na kung paano gumagana ang programa ng Candy Machine, subukan ang iyong kaalaman sa pamamagitan ng paggamit ng Sugar CLI upang lumikha ng Candy Machine para sa sarili mong koleksyon. Ang hands-on na karanasang ito ay hindi lamang magpapatibay sa iyong pag-unawa sa mga tool, ngunit magpapalakas din ng iyong kumpiyansa sa iyong kakayahang magamit ang mga ito nang epektibo sa hinaharap.

Magsaya ka dito! Ito ang iyong unang independiyenteng ginawang koleksyon ng NFT! Sa pamamagitan nito, makukumpleto mo ang Modyul 2. Sana ay nararamdaman mo ang proseso! Huwag mag-atubiling [magbahagi ng ilang mabilis na feedback](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%202) nang sa gayon ay maaari naming patuloy na mapabuti ang kurso!
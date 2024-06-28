---
title: Solana Pay
objectives:
- Gamitin ang detalye ng Solana Pay upang bumuo ng mga kahilingan sa pagbabayad at simulan ang mga transaksyon gamit ang mga URL na naka-encode bilang mga QR code
- Gamitin ang library ng `@solana/pay` upang tumulong sa paggawa ng mga kahilingan sa transaksyon ng Solana Pay
- Bahagyang lagdaan ang mga transaksyon at ipatupad ang transaction gating batay sa ilang kundisyon
---

# TL;DR

- **Solana Pay** ay isang detalye para sa pag-encode ng mga kahilingan sa transaksyon ng Solana sa loob ng mga URL, na nagpapagana ng mga standardized na kahilingan sa transaksyon sa iba't ibang Solana app at wallet
- **Partial signing** ng mga transaksyon ay nagbibigay-daan para sa paglikha ng mga transaksyon na nangangailangan ng maramihang mga lagda bago sila isumite sa network
- Ang **Transaction gating** ay nagsasangkot ng pagpapatupad ng mga panuntunan na tumutukoy kung ang ilang partikular na transaksyon ay pinapayagang iproseso o hindi, batay sa ilang kundisyon o pagkakaroon ng partikular na data sa transaksyon

# Lesson

Ang komunidad ng Solana ay patuloy na pinapabuti at pinapalawak ang paggana ng network. Ngunit hindi iyon palaging nangangahulugan ng pagbuo ng bagong teknolohiya. Minsan ito ay nangangahulugan ng paggamit ng mga umiiral na tampok ng network sa bago at kawili-wiling mga paraan.

Ang Solana Pay ay isang magandang halimbawa nito. Sa halip na magdagdag ng bagong functionality sa network, ginagamit ng Solana Pay ang mga kasalukuyang feature ng pag-sign ng network sa isang natatanging paraan upang paganahin ang mga merchant at application na humiling ng mga transaksyon at bumuo ng mga mekanismo ng gating para sa mga partikular na uri ng transaksyon.

Sa buong araling ito, matututunan mo kung paano gamitin ang Solana Pay para gumawa ng mga kahilingan sa paglilipat at transaksyon, i-encode ang mga kahilingang ito bilang QR code, bahagyang pumirma sa mga transaksyon, at mga transaksyon sa gate batay sa mga kundisyong pipiliin mo. Sa halip na pabayaan ito, umaasa kaming makikita mo ito bilang isang halimbawa ng paggamit ng mga umiiral na feature sa mga bago at kawili-wiling paraan, gamit ito bilang isang launching pad para sa iyong sariling natatanging mga pakikipag-ugnayan sa network sa panig ng kliyente.

## Solana Pay

Ang [Solana Pay specification](https://docs.solanapay.com/spec) ay isang set na pamantayan na nagbibigay-daan sa mga user na humiling ng mga pagbabayad at magpasimula ng mga transaksyon gamit ang mga URL sa magkatulad na paraan sa iba't ibang Solana app at wallet.

Ang mga URL ng kahilingan ay may prefix na `solana:` upang maidirekta ng mga platform ang link sa naaangkop na application. Halimbawa, sa mobile ang isang URL na nagsisimula sa `solana:` ay ididirekta sa mga application ng wallet na sumusuporta sa detalye ng Solana Pay. Mula doon, magagamit ng wallet ang natitira sa URL upang wastong pangasiwaan ang kahilingan.

Mayroong dalawang uri ng mga kahilingan na tinukoy ng detalye ng Solana Pay:

1. Kahilingan sa Paglipat: ginagamit para sa simpleng paglilipat ng SOL o SPL Token
2. Kahilingan sa Transaksyon: ginagamit upang humiling ng anumang uri ng transaksyon sa Solana

### Transfer requests

Ang detalye ng kahilingan sa paglipat ay naglalarawan ng isang hindi interactive na kahilingan para sa paglilipat ng token ng SOL o SPL. Ang mga URL ng kahilingan sa paglipat ay may sumusunod na format na `solana:<recipient>?<optional-query-params>`.

Ang halaga ng `recipient` ay kinakailangan at dapat ay isang base58-encoded public key ng account kung saan hinihiling ang paglilipat. Bukod pa rito, sinusuportahan ang mga sumusunod na opsyonal na parameter ng query:

- `amount` - isang non-negative integer o decimal value na nagsasaad ng halaga ng mga token na ililipat
- `spl-token` - isang base58-encoded public key ng isang SPL Token mint account kung ang paglilipat ay isang SPL token at hindi SOL
- `reference` - opsyonal na reference value bilang base58-encoded 32 byte arrays. Ito ay maaaring gamitin ng isang kliyente para sa pagtukoy sa transaksyon na onchain dahil ang kliyente ay hindi magkakaroon ng lagda ng isang transaksyon.
- `label` - isang URL-encoded UTF-8 string na naglalarawan sa pinagmulan ng kahilingan sa paglipat
- `mensahe` - isang URL-encoded UTF-8 string na naglalarawan sa katangian ng kahilingan sa paglipat
- `memo` - isang URL-encoded UTF-8 string na dapat isama sa SPL memo instruction sa transaksyon sa pagbabayad

Bilang halimbawa, narito ang isang URL na naglalarawan ng kahilingan sa paglipat para sa 1 SOL:

```text
solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=1&label=Michael&message=Thanks%20for%20all%20the%20fish&memo=OrderId12345
```

At narito ang isang URL na naglalarawan ng kahilingan sa paglipat para sa 0.1 USDC:

```text
solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=0.01&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### Transaction requests

Ang kahilingan sa transaksyon ng Solana Pay ay katulad ng isang kahilingan sa paglipat dahil isa lang itong URL na maaaring gamitin ng isang sumusuportang wallet. Gayunpaman, interactive ang kahilingang ito at mas open-ended ang format:

```text
solana:<link>
```

Ang halaga ng `link` ay dapat na isang URL kung saan maaaring gumawa ng HTTP na kahilingan ang gumagamit ng wallet. Sa halip na naglalaman ng lahat ng impormasyong kailangan para sa isang transaksyon, ginagamit ng isang kahilingan sa transaksyon ang URL na ito upang kunin ang transaksyon na dapat ipakita sa user.

Kapag nakatanggap ang wallet ng URL ng Kahilingan sa transaksyon, apat na bagay ang mangyayari:

1. Nagpapadala ang wallet ng kahilingan sa GET sa application sa ibinigay na URL ng `link` upang makuha ang isang label at imahe ng icon na ipapakita sa user.
2. Pagkatapos, magpapadala ang wallet ng kahilingan sa POST kasama ang pampublikong susi ng end user.
3. Gamit ang pampublikong key ng end user (at anumang karagdagang impormasyon na ibinigay sa `link`), ang application ay bubuo ng transaksyon at tumugon sa isang base64-encoded serialized na transaksyon.
4. Ang wallet ay nagde-decode at nagde-deserialize ng transaksyon, pagkatapos ay hahayaan ang user na mag-sign at ipadala ang transaksyon.

Dahil mas kasangkot ang mga kahilingan sa transaksyon kaysa sa mga kahilingan sa paglipat, ang natitira sa araling ito ay tututuon sa paggawa ng mga kahilingan sa transaksyon.

## Create a transaction request

### Define the API endpoint

Ang pangunahing bagay na kailangan mong gawin, ang developer, para magawa ang daloy ng kahilingan sa transaksyon ay mag-set up ng REST API endpoint sa URL na plano mong isama sa kahilingan sa transaksyon. Sa araling ito, gagamitin namin ang [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction) para sa aming mga endpoint, ngunit maaari kang gumamit ng kahit anong stack at tool na gusto mo' re pinaka komportable sa.

Sa Next.js, gagawin mo ito sa pamamagitan ng pagdaragdag ng file sa `pages/api` na folder at pag-export ng function na humahawak sa kahilingan at tugon.

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    // Handle the request
}
```

### Handle a GET request

Ang wallet na kumokonsumo ng iyong URL ng kahilingan sa transaksyon ay maglalabas muna ng kahilingan sa GET sa endpoint na ito. Gusto mong ibalik ng iyong endpoint ang isang JSON object na may dalawang field:

1. `label` - isang string na naglalarawan sa pinagmulan ng kahilingan sa transaksyon
2. `icon`- isang URL sa isang imahe na maaaring ipakita sa user

Bumuo sa walang laman na endpoint mula sa dati, na maaaring ganito ang hitsura:

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method === "GET") {
        return get(res)
    } else {
        return res.status(405).json({ error: "Method not allowed" })
    }
}

function get(res: NextApiResponse) {
    res.status(200).json({
        label: "Store Name",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
```

Kapag ang wallet ay humiling ng GET sa API endpoint, ang function na `get` ay tinatawag, na nagbabalik ng tugon na may status code na 200 at ang JSON object na naglalaman ng `label` at `icon`.

### Pangasiwaan ang isang POST na kahilingan at buuin ang transaksyon

Pagkatapos mag-isyu ng kahilingan sa GET, maglalabas ang wallet ng kahilingan sa POST sa parehong URL. Dapat asahan ng iyong endpoint na ang `body` ng POST na kahilingan ay naglalaman ng JSON object na may field na `account` na ibinigay ng humihiling na wallet. Ang halaga ng `account` ay magiging isang string na kumakatawan sa pampublikong key ng end user.

Gamit ang impormasyong ito at anumang karagdagang mga parameter na ibinigay, maaari mong buuin ang transaksyon at ibalik ito sa wallet para sa pagpirma sa pamamagitan ng:

1. Kumokonekta sa Solana network at makuha ang pinakabagong `blockhash`.
2. Paglikha ng bagong transaksyon gamit ang `blockhash`.
3. Pagdaragdag ng mga tagubilin sa transaksyon
4. Pagse-serye ng transaksyon at pagbabalik nito sa isang object na `PostResponse` kasama ng isang mensahe para sa user.

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method === "GET") {
        return get(res)
    } else if (req.method === "POST") {
        return post(req, res)
    } else {
        return res.status(405).json({ error: "Method not allowed" })
    }
}

function get(res: NextApiResponse) {
    res.status(200).json({
        label: "Store Name",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
async function post(
    req: PublicKey,
    res: PublicKey,
) {
    const { account, reference } = req.body

    const connection = new Connection(clusterApiUrl("devnet"));

    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: account,
    });

    const instruction = SystemProgram.transfer({
        fromPubkey: account,
        toPubkey: Keypair.generate().publicKey,
        lamports: 0.001 * LAMPORTS_PER_SOL,
    });

    transaction.add(instruction);

    transaction.keys.push({
        pubkey: reference,
        isSigner: false,
        isWritable: false,
    })

    const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
    });
    const base64 = serializedTransaction.toString("base64");

    const message = "Simple transfer of 0.001 SOL";

    res.send(200).json({
        transaction: base64,
        message,
    })
}
```

Walang masyadong kakaiba dito. Ito ang parehong pagtatayo ng transaksyon na gagamitin mo sa isang karaniwang application sa panig ng kliyente. Ang pagkakaiba lang ay sa halip na pumirma at magsumite sa network, ipapadala mo ang transaksyon bilang base64-encoded string pabalik sa tugon ng HTTP. Ang wallet na nagbigay ng kahilingan ay maaaring magpakita ng transaksyon sa user para sa pagpirma.

### Confirm transaction

Maaaring napansin mo na ang nakaraang halimbawa ay ipinapalagay na isang `reference` ay ibinigay bilang isang parameter ng query. Bagama't ito ay *hindi* isang halaga na ibinigay ng humihiling na wallet, *kapaki-pakinabang na i-set up ang iyong URL ng kahilingan sa paunang transaksyon upang maglaman ng parameter ng query na ito.

Dahil ang iyong aplikasyon ay hindi ang nagsusumite ng isang transaksyon sa network, ang iyong code ay hindi magkakaroon ng access sa isang lagda ng transaksyon. Ito ay karaniwang kung paano mahahanap ng iyong app ang isang transaksyon sa network at makita ang status nito.

Para malampasan ito, maaari kang magsama ng value ng `reference` bilang parameter ng query para sa bawat kahilingan sa transaksyon. Ang value na ito ay dapat na isang base58-encoded 32 byte array na maaaring isama bilang non-signer key sa transaksyon. Nagbibigay-daan ito sa iyong app na gamitin ang `getSignaturesForAddress` na paraan ng RPC upang mahanap ang transaksyon. Pagkatapos ay maiangkop ng iyong app ang UI nito ayon sa status ng isang transaksyon.

Kung gagamitin mo ang library na `@solana/pay`, maaari mong gamitin ang function na helper na `findReference` sa halip na direktang gamitin ang `getSignaturesForAddress`.

## Gated transactions

Nabanggit na namin dati kung paano ang Solana Pay ay isang halimbawa ng kakayahang gumawa ng mga cool na bagong bagay sa network sa pamamagitan ng pagiging malikhain gamit ang kasalukuyang functionality. Ang isa pang maliit na halimbawa ng paggawa nito sa loob ng payong ng Solana Pay ay gawing available lang ang ilang partikular na transaksyon kapag natugunan ang ilang kundisyon.

Dahil kinokontrol mo ang endpoint na pagbuo ng transaksyon, matutukoy mo kung anong pamantayan ang dapat matugunan bago mabuo ang isang transaksyon. Halimbawa, maaari mong gamitin ang field ng `account` na ibinigay sa kahilingan ng POST upang suriin kung ang end user ay may hawak na NFT mula sa isang partikular na koleksyon o kung ang pampublikong key na iyon ay nasa isang paunang natukoy na listahan ng mga account na maaaring gumawa ng partikular na transaksyong ito.

```typescript
// retrieve array of nfts owned by the given wallet
const nfts = await metaplex.nfts().findAllByOwner({ owner: account }).run();

// iterate over the nfts array
for (let i = 0; i < nfts.length; i++) {
    // check if the current nft has a collection field with the desired value
    if (nfts[i].collection?.address.toString() == collection.toString()) {
        // build transaction
    } else {
        // return an error
    }
}
```

### Partial Signing

Kung gusto mo ng ilang partikular na transaksyon sa likod ng ilang uri ng gating mechanism, ang functionality na iyon ay kailangang ipatupad din onchain. Ang pagbabalik ng error mula sa iyong endpoint ng Solana Pay ay nagpapahirap para sa mga end user na gawin ang transaksyon, ngunit maaari pa rin nilang gawin ito nang manu-mano.

Ang ibig sabihin nito ay ang (mga) tagubiling tinatawag ay dapat mangailangan ng ilang uri ng lagda ng "admin" na ang iyong aplikasyon lamang ang makakapagbigay. Sa paggawa nito, gayunpaman, nagawa mo ito upang ang aming mga nakaraang halimbawa ay hindi gumana. Ang transaksyon ay binuo at ipinadala sa humihiling na wallet para sa pirma ng end user, ngunit ang isinumiteng transaksyon ay mabibigo nang walang pirma ng admin.

Sa kabutihang palad, pinapagana ng Solana ang pagiging composability ng lagda na may bahagyang pagpirma.

Ang bahagyang pagpirma sa isang multi-signature na transaksyon ay nagbibigay-daan sa mga pumirma na idagdag ang kanilang lagda bago ang transaksyon ay i-broadcast sa network. Maaari itong maging kapaki-pakinabang sa maraming sitwasyon, kabilang ang:

- Pag-apruba sa mga transaksyon na nangangailangan ng lagda ng maraming partido, tulad ng isang merchant at isang mamimili na kailangang kumpirmahin ang mga detalye ng isang pagbabayad.
- Pag-invoke ng mga custom na program na nangangailangan ng mga lagda ng parehong user at administrator. Makakatulong ito upang limitahan ang pag-access sa mga tagubilin ng programa at matiyak na ang mga awtorisadong partido lamang ang makakapagsagawa ng mga ito.

```typescript
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

const transaction = new Transaction({
  feePayer: account,
  blockhash,
  lastValidBlockHeight,
})

...

transaction.partialSign(adminKeypair)
```

Ang function na `partialSign` ay ginagamit upang magdagdag ng pirma sa isang transaksyon nang hindi ina-override ang anumang mga nakaraang lagda sa transaksyon. Kung gagawa ka ng transaksyon na may maraming pumirma, mahalagang tandaan na kung hindi mo tinukoy ang `feePayer` ng transaksyon, ang unang pumirma ay gagamitin bilang nagbabayad ng bayad para sa transaksyon. Upang maiwasan ang anumang pagkalito o hindi inaasahang pag-uugali, tiyaking tahasang itakda ang nagbabayad ng bayad kapag kinakailangan.

Sa aming halimbawa ng pagpapahintulot lamang sa isang kahilingan sa transaksyon na dumaan kapag ang end user ay may partikular na NFT, idaragdag mo lang ang iyong admin signature sa transaksyon gamit ang `partialSign` bago i-encode ang transaksyon bilang base64-encoded string at ibigay ang HTTP na tugon .

## Solana Pay QR code

Isa sa mga natatanging tampok ng Solana Pay ay ang madaling pagsasama nito sa mga QR code. Dahil ang mga kahilingan sa paglipat at transaksyon ay mga URL lang, maaari mong i-embed ang mga ito sa mga QR code na gagawin mong available sa iyong application o saanman.

Pinapasimple ito ng library ng `@solana/pay` gamit ang ibinigay na function ng helper na `createQR`. Kailangan ng function na ito na ibigay mo ang sumusunod:

- `url` - ang url ng kahilingan sa transaksyon.
- `size` (opsyonal) - ang lapad at taas ng QR code sa mga pixel. Default sa 512.
- `background` (opsyonal) - ang kulay ng background. Default sa puti.
- `kulay` (opsyonal) - ang kulay ng foreground. Default sa itim.

```typescript
const qr = createQR(url, 400, 'transparent')
```

# Demo

Ngayong mayroon ka nang konseptong kaalaman sa Solana Pay, isabuhay natin ito. Gagamitin namin ang Solana Pay upang bumuo ng isang serye ng mga QR code para sa isang scavenger hunt. Dapat bisitahin ng mga kalahok ang bawat lokasyon ng scavenger hunt sa pagkakasunud-sunod. Sa bawat lokasyon, gagamitin nila ang ibinigay na QR code para isumite ang naaangkop na transaksyon sa smart contract ng scavenger hunt na sumusubaybay sa pag-unlad ng user.

### 1. Starter

Para makapagsimula, i-download ang starter code sa `starter` branch ng [repository] na ito(https://github.com/Unboxed-Software/solana-scavenger-hunt-app/tree/starter). Ang starter code ay isang Next.js app na nagpapakita ng Solana Pay QR code. Pansinin na hinahayaan ka ng menu bar na lumipat sa pagitan ng iba't ibang QR code. Ang default na opsyon ay isang simpleng paglilipat ng SOL para sa mga layunin ng paglalarawan. Sa kabuuan Magdaragdag kami ng functionality sa mga opsyon sa lokasyon sa menu bar.

![Screenshot of scavenger hunt app](../../assets/scavenger-hunt-screenshot.png)

Para magawa ito, gagawa kami ng bagong endpoint para sa isang kahilingan sa transaksyon na bubuo ng transaksyon para sa paggamit ng Anchor program sa Devnet. Ang program na ito ay partikular na ginawa para sa "scavenger hunt" app na ito at may dalawang tagubilin: `initialize` at `check_in`. Ang tagubiling `pasimulan` ay ginagamit upang i-set up ang estado ng user, habang ang tagubiling `check_in` ay ginagamit upang mag-record ng check-in sa isang lokasyon sa pangangaso ng basura. Hindi kami gagawa ng anumang pagbabago sa program sa demo na ito, ngunit huwag mag-atubiling tingnan ang [source code](https://github.com/Unboxed-Software/anchor-scavenger-hunt) kung gusto mo upang maging pamilyar sa programa.

Bago magpatuloy, tiyaking pamilyar ka sa starter code para sa Scavenger Hunt app. Ang pagtingin sa `pages/index.tsx`, `utils/createQrCode/simpleTransfer`, at `/utils/checkTransaction` ay magbibigay-daan sa iyo na makita kung paano naka-set up ang kahilingan sa transaksyon para sa pagpapadala ng SOL. Susundan namin ang isang katulad na pattern para sa kahilingan sa transaksyon para sa pag-check in sa isang lokasyon.

### 2. Setup

Bago tayo sumulong, tiyaking mapapatakbo mo ang app nang lokal. Magsimula sa pamamagitan ng pagpapalit ng pangalan ng `.env.example` na file sa frontend na direktoryo sa `.env`. Ang file na ito ay naglalaman ng keypair na gagamitin sa demo na ito upang bahagyang pumirma ng mga transaksyon.

Susunod, i-install ang mga dependency na may `yarn`, pagkatapos ay gamitin ang `yarn dev` at buksan ang iyong browser `localhost:3000` (o ang port na nakasaad sa console kung 3000 ay ginagamit na).

Ngayon, kung susubukan mong i-scan ang QR code na ipinapakita sa page mula sa iyong mobile device, magkakaroon ka ng error. Iyon ay dahil naka-set up ang QR code para ipadala ka sa `localhost:3000` ng iyong computer, na hindi isang address na mapupuntahan ng iyong telepono. Dagdag pa, kailangang gumamit ng HTTPS URL ang Solana Pay upang gumana.

Para makalibot dito, maaari mong gamitin ang [ngrok](https://ngrok.com/). Kakailanganin mong i-install ito kung hindi mo pa ito nagamit dati. Kapag na-install na ito, patakbuhin ang sumusunod na command sa iyong terminal, palitan ang `3000` ng alinmang port na iyong ginagamit para sa proyektong ito:

```bash
ngrok http 3000
```

Bibigyan ka nito ng isang natatanging URL na magagamit mo upang ma-access ang iyong lokal na server nang malayuan. Ang output ay magmumukhang ganito:

```bash
Session Status                online
Account                       your_email@gmail.com (Plan: Free)
Update                        update available (version 3.1.0, Ctrl-U to update)
Version                       3.0.6
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://7761-24-28-107-82.ngrok.io -> http://localhost:3000
```

Ngayon, buksan ang HTTPS ngrok URL na ipinapakita sa iyong console sa browser (hal. https://7761-24-28-107-82.ngrok.io). Papayagan ka nitong mag-scan ng mga QR code mula sa iyong mobile device habang lokal na sumusubok.

Sa oras ng pagsulat, ang demo na ito ay pinakamahusay na gumagana sa Solflare. Magpapakita ang ilang wallet ng maling mensahe ng babala kapag nag-scan ng Solana Pay QR code. Anuman ang wallet na ginagamit mo, siguraduhing lumipat ka sa devnet sa wallet. Pagkatapos ay i-scan ang QR code sa home page na may label na "SOL Transfer". Ang QR code na ito ay isang reference na pagpapatupad para sa isang kahilingan sa transaksyon na nagsasagawa ng simpleng paglilipat ng SOL. Tinatawag din nito ang function na `requestAirdrop` upang pondohan ang iyong mobile wallet gamit ang Devnet SOL dahil karamihan sa mga tao ay walang Devnet SOL na magagamit para sa pagsubok.

Kung matagumpay mong naisagawa ang transaksyon gamit ang QR code, handa ka nang magpatuloy!

### 3. Create a check-in transaction request endpoint

Ngayong handa ka na, oras na para gumawa ng endpoint na sumusuporta sa mga kahilingan sa transaksyon para sa pag-check in sa lokasyon gamit ang programang Scavenger Hunt.

Magsimula sa pamamagitan ng pagbubukas ng file sa `pages/api/checkIn.ts`. Pansinin na mayroon itong helper function para sa pagsisimula ng `eventOrganizer` mula sa isang secret key environment variable. Ang unang bagay na gagawin namin sa file na ito ay ang mga sumusunod:

1. Mag-export ng function na `handler` upang pangasiwaan ang isang arbitrary na kahilingan sa HTTP
2. Magdagdag ng mga function na `get` at `post` para sa paghawak sa mga pamamaraang HTTP na iyon
3. Magdagdag ng logic sa katawan ng function na `handler` para tumawag sa `get`, `post`, o magbalik ng 405 error batay sa paraan ng paghiling ng HTTP

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "GET") {
        return get(res)
    } else if (req.method === "POST") {
        return await post(req, res)
    } else {
        return res.status(405).json({ error: "Method not allowed" })
    }
}

function get(res: NextApiResponse) {}

async function post(req: NextApiRequest, res: NextApiResponse) {}
```

### 4. Update `get` function

Tandaan, ang unang kahilingan mula sa isang wallet ay isang kahilingan sa GET na umaasang magbabalik ang endpoint ng isang label at icon. I-update ang function na `get` para magpadala ng tugon na may "Scavenger Hunt!" label at isang icon ng logo ng Solana.

```jsx
function get(res: NextApiResponse) {
    res.status(200).json({
        label: "Scavenger Hunt!",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
```

### 5. Update `post` function

Pagkatapos ng kahilingan sa GET, maglalabas ang wallet ng kahilingan sa POST sa endpoint. Ang `body` ng kahilingan ay maglalaman ng JSON object na may field na `account` na kumakatawan sa pampublikong key ng end user.

Bilang karagdagan, ang mga parameter ng query ay maglalaman ng anumang na-encode mo sa QR code. Kung titingnan mo ang `utils/createQrCode/checkIn.ts`, mapapansin mo na ang partikular na app na ito ay may kasamang mga parameter para sa `reference` at `id` gaya ng sumusunod:

1. `reference` - isang random na nabuong pampublikong key na ginagamit upang tukuyin ang transaksyon
2. `id` - ang location id bilang integer

Sige at i-update ang function na `post` upang kunin ang `account`, `reference`, at `id` mula sa kahilingan. Dapat kang tumugon nang may error kung ang alinman sa mga ito ay nawawala.

Susunod, magdagdag ng statement na `try catch` kung saan tumutugon ang `catch` block nang may error at ang `try` block ay tumatawag sa isang bagong function na `buildTransaction`. Kung matagumpay ang `buildTransaction`, tumugon gamit ang 200 at JSON object kasama ang transaksyon at isang mensahe na natagpuan ng user ang ibinigay na lokasyon. Huwag mag-alala tungkol sa lohika para sa function na `buildTransaction` - gagawin namin iyon sa susunod.

Tandaan na kakailanganin mo ring mag-import ng `PublicKey` at `Transaction` mula sa `@solana/web3.js` dito.

```typescript
import { NextApiRequest, NextApiResponse } from "next"
import { PublicKey, Transaction } from "@solana/web3.js"
...

async function post(req: NextApiRequest, res: NextApiResponse) {
    const { account } = req.body
    const { reference, id } = req.query

    if (!account || !reference || !id) {
        res.status(400).json({ error: "Missing required parameter(s)" })
        return
    }

    try {
        const transaction = await buildTransaction(
            new PublicKey(account),
            new PublicKey(reference),
            id.toString()
        )

        res.status(200).json({
            transaction: transaction,
            message: `You've found location ${id}!`,
        })
    } catch (err) {
        console.log(err)
        let error = err as any
        if (error.message) {
            res.status(200).json({ transaction: "", message: error.message })
        } else {
            res.status(500).json({ error: "error creating transaction" })
        }
    }
}

async function buildTransaction(
    account: PublicKey,
    reference: PublicKey,
    id: string
): Promise<string> {
    return new Transaction()
}
```

### 6. Implement the `buildTransaction` function

Susunod, ipatupad natin ang function na `buildTransaction`. Dapat itong buuin, bahagyang lagdaan, at ibalik ang transaksyon sa pag-check-in. Ang pagkakasunud-sunod ng mga item na kailangan nitong gawin ay:

1. Kunin ang katayuan ng user
2. Gamitin ang `locationAtIndex` helper function at ang location id para makakuha ng Lokasyon na object
3. I-verify na ang user ay nasa tamang lokasyon
4. Kunin ang kasalukuyang blockhash at huling wastong taas ng block mula sa koneksyon
5. Gumawa ng bagong object ng transaksyon
6. Magdagdag ng tagubilin sa pagsisimula sa transaksyon kung hindi umiiral ang estado ng user
7. Magdagdag ng tagubilin sa pag-check-in sa transaksyon
8. Idagdag ang `reference` na pampublikong key sa pagtuturo sa pag-check-in
9. Bahagyang lagdaan ang transaksyon sa keypair ng event organizer
10. I-serialize ang transaksyon gamit ang base64 encoding at ibalik ang transaksyon

Bagama't diretso ang bawat isa sa mga hakbang na ito, marami itong hakbang. Upang pasimplehin ang function, gagawa kami ng mga walang laman na function ng helper na pupunan namin sa ibang pagkakataon para sa mga hakbang 1, 3, 6, at 7-8. Tatawagin namin itong `fetchUserState`, `verifyCorrectLocation`, `createInitUserInstruction`, at `createCheckInInstruction`, ayon sa pagkakabanggit.

Idaragdag din namin ang mga sumusunod na pag-import:

```typescript
import { NextApiRequest, NextApiResponse } from "next"
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js"
import { locationAtIndex, Location, locations } from "../../utils/locations"
import { connection, gameId, program } from "../../utils/programSetup"
```

Gamit ang mga walang laman na function ng helper at ang mga bagong import, maaari naming punan ang function na `buildTransaction`:

```typescript
async function buildTransaction(
    account: PublicKey,
    reference: PublicKey,
    id: string
): Promise<string> {
    const userState = await fetchUserState(account)

    const currentLocation = locationAtIndex(new Number(id).valueOf())

    if (!currentLocation) {
        throw { message: "Invalid location id" }
    }

    if (!verifyCorrectLocation(userState, currentLocation)) {
        throw { message: "You must visit each location in order!" }
    }

    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash()

    const transaction = new Transaction({
        feePayer: account,
        blockhash,
        lastValidBlockHeight,
    })

    if (!userState) {
        transaction.add(await createInitUserInstruction(account))
    }

    transaction.add(
        await createCheckInInstruction(account, reference, currentLocation)
    )

    transaction.partialSign(eventOrganizer)

    const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
    })

    const base64 = serializedTransaction.toString("base64")

    return base64
}

interface UserState {
    user: PublicKey
    gameId: PublicKey
    lastLocation: PublicKey
}

async function fetchUserState(account: PublicKey): Promise<UserState | null> {
    return null
}

function verifyCorrectLocation(
    userState: UserState | null,
    currentLocation: Location
): boolean {
    return false
}

async function createInitUserInstruction(
    account: PublicKey
): Promise<TransactionInstruction> {
    throw ""
}

async function createCheckInInstruction(
    account: PublicKey,
    reference: PublicKey,
    location: Location
): Promise<TransactionInstruction> {
    throw ""
}
```

### 7. Implement `fetchUserState` function

Kapag natapos na ang function na `buildTransaction`, maaari naming simulan ang pagpapatupad ng mga walang laman na function ng helper na ginawa namin, simula sa `fetchUserState`. Ginagamit ng function na ito ang `gameId` at `account` ng user upang makuha ang PDA ng estado ng user, pagkatapos ay kinukuha ang account na iyon, na ibinabalik ang null kung wala ito.

```typescript
async function fetchUserState(account: PublicKey): Promise<UserState | null> {
    const userStatePDA = PublicKey.findProgramAddressSync(
        [gameId.toBuffer(), account.toBuffer()],
        program.programId
    )[0]

    try {
        return await program.account.userState.fetch(userStatePDA)
    } catch {
        return null
    }
}
```

### 8. Implement `verifyCorrectLocation` function

Susunod, ipatupad natin ang function ng helper na `verifyCorrectLocation`. Ginagamit ang function na ito upang i-verify na ang isang user ay nasa tamang lokasyon sa isang scavenger hunt game.

Kung ang `userState` ay `null`, nangangahulugan iyon na dapat bumisita ang user sa unang lokasyon. Kung hindi, ang user ay dapat na bumisita sa lokasyon na ang index ay 1 higit pa sa kanilang huling binisita na lokasyon.

Kung ang mga kundisyong ito ay nasiyahan, ang function ay magbabalik ng true. Kung hindi, magbabalik ito ng false.

```typescript
function verifyCorrectLocation(
    userState: UserState | null,
    currentLocation: Location
): boolean {
    if (!userState) {
        return currentLocation.index === 1
    }

    const lastLocation = locations.find(
        (location) => location.key.toString() === userState.lastLocation.toString()
    )

    if (!lastLocation || currentLocation.index !== lastLocation.index + 1) {
        return false
    } else {
        return true
    }
}
```

### 9. Implement the instruction creation functions

Panghuli, ipatupad natin ang `createInitUserInstruction` at `createCheckInInstruction`. Ang mga ito ay maaaring gumamit ng Anchor upang buuin at ibalik ang mga kaukulang tagubilin. Ang tanging catch ay ang `createCheckInInstruction` ay kailangang magdagdag ng `reference` sa listahan ng mga tagubilin ng mga key.

```typescript
async function createInitUserInstruction(
    account: PublicKey
): Promise<TransactionInstruction> {
    const initializeInstruction = await program.methods
        .initialize(gameId)
        .accounts({ user: account })
        .instruction()

    return initializeInstruction
}

async function createCheckInInstruction(
    account: PublicKey,
    reference: PublicKey,
    location: Location
): Promise<TransactionInstruction> {
    const checkInInstruction = await program.methods
        .checkIn(gameId, location.key)
        .accounts({
            user: account,
            eventOrganizer: eventOrganizer.publicKey,
        })
        .instruction()

    checkInInstruction.keys.push({
        pubkey: reference,
        isSigner: false,
        isWritable: false,
    })

    return checkInInstruction
}
```

### 10. Test the app

Sa puntong ito dapat gumagana ang iyong app! Sige at subukan ito gamit ang iyong mobile wallet. Magsimula sa pamamagitan ng pag-scan sa QR code para sa `Lokasyon 1`. Tandaang tiyaking gumagana ang iyong frontend gamit ang URL ng ngrok sa halip na `localhost`.

Pagkatapos i-scan ang QR code, dapat kang makakita ng mensaheng nagsasaad na ikaw ay nasa lokasyon 1. Mula doon, i-scan ang QR code sa pahina ng `Lokasyon 2. Maaaring kailanganin mong maghintay ng ilang segundo para ma-finalize ang nakaraang transaksyon bago magpatuloy.

Binabati kita, matagumpay mong natapos ang demo ng scavenger hunt gamit ang Solana Pay! Depende sa iyong background, maaaring hindi ito intuitive o prangka. Kung iyon ang kaso, huwag mag-atubiling dumaan muli sa demo o gumawa ng isang bagay sa iyong sarili. Ang Solana Pay ay nagbubukas ng maraming pinto para sa pagtulay sa agwat sa pagitan ng totoong buhay at onchain na pakikipag-ugnayan.

Kung gusto mong tingnan ang panghuling code ng solusyon, mahahanap mo ito sa sangay ng solusyon ng [parehong repositoryo](https://github.com/Unboxed-Software/solana-scavenger-hunt-app/tree/solution ).

# Challenge

Oras na para subukan ito nang mag-isa. Huwag mag-atubiling bumuo ng sarili mong ideya gamit ang Solana Pay. O, kung kailangan mo ng ilang inspirasyon, maaari mong gamitin ang prompt sa ibaba.

Bumuo ng isang app gamit ang Solana Pay (o baguhin ang isa mula sa demo) upang magbigay ng NFT sa mga user. Upang mapahusay ito, gawin lang posible ang transaksyon kung natutugunan ng user ang isa o higit pang kundisyon (hal. may hawak na NFT mula sa isang partikular na koleksyon, nasa isang paunang natukoy na listahan, atbp.).

Maging malikhain dito! Ang Solana pay spec ay nagbubukas ng maraming pinto para sa mga natatanging kaso ng paggamit.
---
title: Cryptography and the Solana Network
objectives:
- Unawain ang simetriko at walang simetrya na kriptograpiya
- Ipaliwanag ang mga keypair
- Bumuo ng bagong keypair
- Mag-load ng keypair mula sa isang env file
---

# TL;DR

- Ang **keypair** ay isang magkatugmang pares ng **public key** at **secret key**.
- Ang **public key** ay ginagamit bilang isang "address" na tumuturo sa isang account sa network ng Solana. Maaaring ibahagi ang isang pampublikong susi sa sinuman.
- Ang **secret key** ay ginagamit upang i-verify ang awtoridad sa account. Gaya ng ipinahihiwatig ng pangalan, dapat mong palaging panatilihing *lihim* ang mga lihim na susi.
- Ang `@solana/web3.js` ay nagbibigay ng mga function ng helper para sa paglikha ng bagong keypair, o para sa pagbuo ng keypair gamit ang isang umiiral nang secret key.

# Lesson

## Symmetric and Asymmetric Cryptography

Ang 'Cryptography' ay literal na pag-aaral ng pagtatago ng impormasyon. Mayroong dalawang pangunahing uri ng cryptography na makikita mo araw-araw:

**Symmetric Cryptography** ay kung saan ang parehong key ay ginagamit upang i-encrypt at i-decrypt. Daan-daang taong gulang na ito, at ginamit ng lahat mula sa mga sinaunang Egyptian hanggang kay Reyna Elizabeth I.

Mayroong iba't ibang mga symmetric cryptography algorithm, ngunit ang pinakakaraniwang makikita mo ngayon ay ang AES at Chacha20.

**Asymmetric Cryptography**

- Asymmetric cryptography - tinatawag ding '[public key cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography)' ay binuo noong 1970s. Sa asymmetric cryptography, ang mga kalahok ay may mga pares ng key (o **keypair**). Ang bawat keypair ay binubuo ng isang **secret key** at isang **public key**. Ang asymmetric encryption ay gumagana nang iba sa simetriko na pag-encrypt, at maaaring gumawa ng iba't ibang bagay:

- **Encryption**: kung ito ay naka-encrypt gamit ang isang pampublikong susi, tanging ang sikretong key mula sa parehong keypair ang maaaring gamitin para basahin ito
- **Mga Lagda**: kung ito ay naka-encrypt gamit ang isang lihim na susi, ang pampublikong susi mula sa parehong keypair ay maaaring gamitin upang patunayan ang may hawak ng sikretong susi na nilagdaan ito.
- Maaari ka ring gumamit ng asymmetric cryptography para gumawa ng magandang key na gagamitin para sa simetriko cryptography! Ito ay tinatawag na **key exchange** kung saan ginagamit mo ang iyong mga pampublikong key at isang tatanggap na pampublikong key upang makabuo ng isang 'session' key.
- Mayroong iba't ibang mga symmetric cryptography algorithm, ngunit ang pinakakaraniwang makikita mo ngayon ay mga variant ng ECC o RSA.

Ang asymmetric encryption ay napakapopular:
  - Ang iyong bank card ay may lihim na susi sa loob nito, na ginagamit upang pumirma ng mga transaksyon.

    Maaaring kumpirmahin ng iyong bangko na ginawa mo ang transaksyon sa pamamagitan ng pagsuri sa kanila gamit ang katugmang pampublikong key.
  - Ang mga website ay may kasamang pampublikong key sa kanilang certificate, gagamitin ng iyong browser ang pampublikong key na ito upang i-encrypt ang data (tulad ng personal na impormasyon, mga detalye sa pag-log in, at mga numero ng credit card) na ipinapadala nito sa web page.

    Ang website ay may katugmang pribadong key, upang mabasa ng website ang data.
  - Ang iyong elektronikong pasaporte ay nilagdaan ng bansang nagbigay nito, upang matiyak na hindi peke ang pasaporte.

    Maaaring kumpirmahin ito ng electronic passport gate gamit ang pampublikong susi ng iyong bansang nagbigay.
  - Ang mga app sa pagmemensahe sa iyong telepono ay gumagamit ng key exchange para gumawa ng session key.

Sa madaling salita, nasa paligid natin ang cryptography. Ang Solana, pati na rin ang iba pang mga blockchain, ay isa lamang paggamit ng cryptography.

## Solana uses public keys as addresses

![Solana wallet addresses](../../assets/wallet-addresses.svg)

Ang mga taong kalahok sa network ng Solana ay mayroong kahit isang keypair. Sa Solana:

- Ang **public key** ay ginagamit bilang isang "address" na tumuturo sa isang account sa network ng Solana. Kahit na mga friendly na pangalan - tulad ng `example.sol` - tumuturo sa mga address tulad ng `dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8`

- Ang **secret key** ay ginagamit upang i-verify ang awtoridad sa keypair na iyon. Kung mayroon kang sikretong susi para sa isang address, kinokontrol mo ang mga token sa loob ng address na iyon. Para sa kadahilanang ito, gaya ng ipinahihiwatig ng pangalan, dapat mong palaging panatilihing *lihim* ang mga lihim na susi.
## Paggamit ng @solana/web3.js para gumawa ng keypair

Maaari mong gamitin ang Solana blockchain mula sa browser o node.js gamit ang `@solana/web3.js` npm module. Mag-set up ng proyekto kung paano mo karaniwang gagawin, pagkatapos ay [gumamit ng `npm`](https://nodesource.com/blog/an-absolute-beginners-guide-to-using-npm/) para i-install ang `@solana/web3. js`

```
npm i @solana/web3.js
```

Sasaklawin namin ang marami sa [web3.js](https://docs.solana.com/developing/clients/javascript-reference) nang unti-unti sa buong kursong ito, ngunit maaari mo ring tingnan ang [opisyal na dokumentasyon ng web3.js ](https://docs.solana.com/developing/clients/javascript-reference).

Upang magpadala ng mga token, magpadala ng NFTS, o magbasa at magsulat ng data Solana, kakailanganin mo ang iyong sariling keypair. Upang gumawa ng bagong keypair, gamitin ang `Keypair.generate()` function mula sa `@solana/web3.js`:

```typescript
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();

console.log(`The public key is: `, keypair.publicKey.toBase58());
console.log(`The secret key is: `, keypair.secretKey);
```

## ⚠️ Don't include secret keys in your source code

Dahil ang keypair ay maaaring muling buuin mula sa sikretong susi, karaniwang iniimbak lamang namin ang sikretong susi, at ibinabalik ang keypair mula sa sikretong susi.

Bukod pa rito, dahil ang lihim na susi ay nagbibigay ng awtoridad sa address, hindi kami nag-iimbak ng mga lihim na susi sa source code. Sa halip, kami ay:

- Maglagay ng mga lihim na key sa isang `.env` file
- Idagdag ang `.env` sa `.gitignore` para hindi ma-commit ang `.env` file.

## Loading an existing keypair

Kung mayroon ka nang keypair na gusto mong gamitin, maaari kang mag-load ng `Keypair` mula sa isang umiiral nang sikretong key na nakaimbak sa filesystem o isang `.env` na file. Sa node.js, ang `@solana-developers/helpers` npm package ay may kasamang ilang karagdagang function:

  - Upang gumamit ng `.env` file gumamit ng `getKeypairFromEnvironment()`
  - Upang gumamit ng Solana CLI file gumamit ng `getKeypairFromFile()`

```typescript
import * as dotenv from "dotenv";
import { getKeypairFromEnvironment } from "@solana-developers/helpers";

dotenv.config();

const keypair = getKeypairFromEnvironment("SECRET_KEY");
```

Alam mo kung paano gumawa at mag-load ng mga keypair! Isagawa natin ang ating natutunan.

# Demo

### Installation

Gumawa ng bagong direktoryo, i-install ang TypeScript, Solana web3.js at esrun:

```bash
mkdir generate-keypair
cd generate-keypair
npm init -y
npm install typescript @solana/web3.js @digitak/esrun @solana-developers/helpers
```

Gumawa ng bagong file na tinatawag na `generate-keypair.ts`

```typescript
import { Keypair } from "@solana/web3.js";
const keypair = Keypair.generate();
console.log(`✅ Generated keypair!`)
```

Patakbuhin ang `npx esrun generate-keypair.ts`. Dapat mong makita ang teksto:

```
✅ Generated keypair!
```

Ang bawat `Pares ng Susi` ay may ari-arian na `pampublikong Susi` at `lihim na Susi`. I-update ang file:

```typescript
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();

console.log(`The public key is: `, keypair.publicKey.toBase58());
console.log(`The secret key is: `, keypair.secretKey);
console.log(`✅ Finished!`);
```

Run `npx esrun generate-keypair.ts`. You should see the text:

```
The public key is:  764CksEAZvm7C1mg2uFmpeFvifxwgjqxj2bH6Ps7La4F
The secret key is:  Uint8Array(64) [
  (a long series of numbers) 
]
✅ Finished!
```

## Loading an existing keypair from an .env file

Upang matiyak na mananatiling secure ang iyong sikretong key, inirerekomenda namin ang pag-inject ng sikretong key gamit ang isang `.env` file:

Gumawa ng bagong file na tinatawag na `.env` na may mga nilalaman ng key na ginawa mo kanina:

```env
SECRET_KEY="[(a series of numbers)]"
```

Maaari naming i-load ang keypair mula sa kapaligiran. I-update ang `generate-keypair.ts`:

```typescript
import * as dotenv from "dotenv";
import { getKeypairFromEnvironment } from "@solana-developers/helpers";

dotenv.config();

const keypair = getKeypairFromEnvironment("SECRET_KEY");

console.log(
  `✅ Finished! We've loaded our secret key securely, using an env file!`
);
```

Patakbuhin ang `npx esrun generate-keypair.ts`. Dapat mong makita ang sumusunod na resulta:

```text
✅ Finished! We've loaded our secret key securely, using an env file!
```

Natutunan na namin ngayon ang tungkol sa mga keypair, at kung paano mag-imbak ng mga lihim na key nang secure sa Solana. Sa susunod na kabanata, gagamitin natin ang mga ito!
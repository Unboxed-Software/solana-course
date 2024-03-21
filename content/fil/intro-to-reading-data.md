---
title: Read Data From The Solana Network
objectives:
- Unawain ang mga account at ang kanilang mga address
- Intindihin ang SOL at lamports
- Gamitin ang web3.js upang kumonekta sa Solana at magbasa ng balanse sa account
---

## TL;DR

- **SOL** ang pangalan ng katutubong token ni Solana. Ang bawat Sol ay ginawa mula sa 1 bilyong **Lamports**.
- **Mga Account** ay nag-iimbak ng mga token, NFT, program, at data. Sa ngayon, tututuon tayo sa mga account na nag-iimbak ng SOL.
- **Mga Address** ay tumuturo sa mga account sa network ng Solana. Maaaring basahin ng sinuman ang data sa isang ibinigay na address. Karamihan sa mga address ay **mga pampublikong key** din

# Lesson

## Accounts

Ang lahat ng data na nakaimbak sa Solana ay nakaimbak sa mga account. Maaaring mag-imbak ang mga account:

- SOL
- Iba pang mga token, tulad ng USDC
- Mga NFT
- Mga programa, tulad ng programa sa pagsusuri ng pelikula na ginagawa namin sa kursong ito!
- Data ng programa, tulad ng pagsusuri para sa isang partikular na pelikula para sa programa sa itaas!

### SOL

Ang SOL ay ang katutubong token ng Solana - Ang SOL ay ginagamit upang magbayad ng mga bayarin sa transaksyon, magbayad ng renta para sa mga account, at higit pa. Minsan ipinapakita ang SOL na may simbolo na `◎`. Ang bawat SOL ay ginawa mula sa 1 bilyong **Lamports**. Sa parehong paraan na karaniwang ginagawa ng mga finance app ang math sa cents (para sa USD), pence (para sa GBP), karaniwang ginagamit ng mga Solana app ang do math gamit ang Lamports at nagko-convert lang sa SOL para magpakita ng data.

### Addresses

Ang mga address ay natatanging kinikilala ang mga account. Ang mga address ay madalas na ipinapakita bilang base-58 na naka-encode na mga string tulad ng `dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8`. Karamihan sa mga address sa Solana ay **mga pampublikong key** din. Gaya ng nabanggit sa nakaraang kabanata, sinumang kumokontrol sa katugmang secret key ang kumokontrol sa account - halimbawa, ang taong may sikretong key ay maaaring magpadala ng mga token mula sa account.

## Reading from the Solana Blockchain

### Installation

Gumagamit kami ng npm package na tinatawag na `@solana/web3.js` para gawin ang karamihan sa trabaho kasama si Solana. Mag-i-install din kami ng TypeScript at esrun, para makapagpatakbo kami ng command line:

```bash
npm install typescript @solana/web3.js @digitak/esrun 
```

### Connect to the Network

Ang bawat pakikipag-ugnayan sa network ng Solana gamit ang `@solana/web3.js` ay mangyayari sa pamamagitan ng object na `Connection`. Ang object na `Connection` ay nagtatatag ng koneksyon sa isang partikular na network ng Solana, na tinatawag na 'cluster'.

Sa ngayon, gagamitin namin ang `Devnet` cluster kaysa sa `Mainnet`. Gaya ng iminumungkahi ng pangalan, ang `Devnet` cluster ay idinisenyo para sa paggamit at pagsubok ng developer.

```typescript
import { Connection, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
console.log(`✅ Connected!`)
```

Ang pagpapatakbo ng TypeScript na ito (`npx esrun example.ts`) ay nagpapakita ng:

```
✅ Connected!
```

### Read from the Network

Upang basahin ang balanse ng isang account:

```typescript
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);

console.log(`The balance of the account at ${address} is ${balance} lamports`); 
console.log(`✅ Finished!`)
```

Ang ibinalik na balanse ay nasa *laports*. Ang lamport ay ang minor unit para sa Sol, tulad ng cents ay sa US Dollars, o pence ay sa British pounds. Ang isang lamport ay kumakatawan sa 0.000000001 SOL. Kadalasan, ililipat, gagastusin, iimbak at hahawakan namin ang SOL bilang Lamports, magko-convert lang sa buong SOL para ipakita sa mga user. Nagbibigay ang Web3.js ng patuloy na `LAMPORTS_PER_SOL` para sa paggawa ng mabilis na mga conversion.

```typescript
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);
const balanceInSol = balance / LAMPORTS_PER_SOL;

console.log(`The balance of the account at ${address} is ${balanceInSol} SOL`); 
console.log(`✅ Finished!`)
```

Ang pagpapatakbo ng `npx esrun example.ts` ay magpapakita ng tulad ng:

```
The balance of the account at CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN is 0.00114144 SOL
✅ Finished!
```

...at tulad niyan, nagbabasa kami ng data mula sa Solana blockchain!

# Demo

Isagawa natin ang ating natutunan, at lumikha ng isang simpleng website na nagbibigay-daan sa mga user na suriin ang balanse sa isang partikular na address.

Magiging ganito ang hitsura nito:

![Screenshot of demo solution](../../assets/intro-frontend-demo.png)

Sa interes na manatili sa paksa, hindi kami ganap na gagana mula sa simula, kaya [i-download ang starter code](https://github.com/Unboxed-Software/solana-intro-frontend/tree/starter). Ang panimulang proyekto ay gumagamit ng Next.js at Typescript. Kung sanay ka sa ibang stack, huwag mag-alala! Ang mga prinsipyo ng web3 at Solana na matututunan mo sa mga araling ito ay naaangkop sa alinmang frontend stack na pinaka komportable ka.

### 1. Get oriented

Kapag nakuha mo na ang starter code, tumingin sa paligid. I-install ang mga dependencies gamit ang `npm install` at pagkatapos ay patakbuhin ang app gamit ang `npm run dev`. Pansinin na anuman ang ilagay mo sa field ng address, kapag na-click mo ang "Suriin ang Balanse ng SOL" ang balanse ay magiging isang halaga ng placeholder na 1000.

Sa istruktura, ang app ay binubuo ng `index.tsx` at `AddressForm.tsx`. Kapag isinumite ng isang user ang form, tatawagin ang `addressSubmittedHandler` sa `index.tsx`. Doon namin idaragdag ang lohika para i-update ang natitirang bahagi ng UI.

### 2. Install dependencies

Gamitin ang `npm install @solana/web3.js` para i-install ang aming dependency sa web3 library ng Solana.

### 3. Set the address balance

Una, i-import ang `@solana/web3.js` sa itaas ng `index.tsx`.

Ngayong available na ang library, pumunta tayo sa `addressSubmittedHandler()` at gumawa ng instance ng `PublicKey` gamit ang value ng address mula sa input ng form. Susunod, gumawa ng instance ng `Connection` at gamitin ito para tawagan ang `getBalance()`. Ipasok ang halaga ng pampublikong key na kakagawa mo lang. Panghuli, tawagan ang `setBalance()`, ipasa ang resulta mula sa `getBalance`. Kung handa ka, subukan ito nang nakapag-iisa sa halip na kopyahin mula sa snippet ng code sa ibaba.

```typescript
import type { NextPage } from 'next'
import { useState } from 'react'
import styles from '../styles/Home.module.css'
import AddressForm from '../components/AddressForm'
import * as web3 from '@solana/web3.js'

const Home: NextPage = () => {
  const [balance, setBalance] = useState(0)
  const [address, setAddress] = useState('')

  const addressSubmittedHandler = async (address: string) => {
    setAddress(address)
    const key = new web3.PublicKey(address)
    const connection = new web3.Connection(web3.clusterApiUrl('devnet'));
    const balance = await connection.getBalance(key);
    setBalance(balance / web3.LAMPORTS_PER_SOL);
  }
  ...
}
```

Karamihan sa mga oras kapag nakikitungo sa SOL, ang system ay gagamit ng mga lamport sa halip na SOL. Dahil ang mga computer ay mas mahusay sa pagbibigay ng mga buong numero kaysa sa mga fraction, karaniwan naming ginagawa ang karamihan sa aming mga transaksyon sa mga buong laport, nagko-convert lamang pabalik sa Sol upang ipakita ang halaga sa mga user. Ito ang dahilan kung bakit kinukuha namin ang balanseng ibinalik ni Solana at hinahati ito sa `LAMPORTS_PER_SOL`.

Bago ito itakda sa aming estado, iko-convert din namin ito sa SOL gamit ang `LAMPORTS_PER_SOL` constant.

Sa puntong ito dapat kang makapaglagay ng wastong address sa field ng form at i-click ang "Suriin ang Balanse ng SOL" upang makita ang parehong Address at Balanse na napuno sa ibaba.

### 4. Handle invalid addresses

Kakatapos lang namin. Ang tanging natitirang isyu ay ang paggamit ng di-wastong address ay hindi nagpapakita ng anumang mensahe ng error o binabago ang balanseng ipinapakita. Kung bubuksan mo ang developer console, makikita mo ang `Error: Invalid public key input`. Kapag ginagamit ang tagabuo ng `PublicKey`, kailangan mong magpasa ng wastong address o makukuha mo ang error na ito.

Upang ayusin ito, ibalot natin ang lahat sa isang bloke na `try-catch` at alertuhan ang user kung hindi wasto ang kanilang input.

```typescript
const addressSubmittedHandler = async (address: string) => {
  try {
    setAddress(address);
    const key = new web3.PublicKey(address);
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    const balance = await connection.getBalance(key)
    setBalance(balance / web3.LAMPORTS_PER_SOL);
  } catch (error) {
    setAddress("");
    setBalance(0);
    alert(error);
  }
};
```

Pansinin na sa catch block na-clear din namin ang address at balanse upang maiwasan ang pagkalito.

Nagawa natin! Mayroon kaming gumaganang site na nagbabasa ng mga balanse ng SOL mula sa network ng Solana. Malapit ka nang makamit ang iyong mga dakilang ambisyon sa Solana. Kung kailangan mong gumugol ng mas maraming oras sa pagtingin sa code na ito para mas maunawaan ito, tingnan ang kumpletong [code ng solusyon](https://github.com/Unboxed-Software/solana-intro-frontend). Maghintay ka, ang mga araling ito ay mabilis na tataas.

# Challenge

Dahil ito ang unang hamon, pananatilihin namin itong simple. Sige at magdagdag sa frontend na nagawa na namin sa pamamagitan ng pagsasama ng isang line item pagkatapos ng "Balanse." Ipakita ang line item kung ang account ay isang executable account o hindi. Hint: mayroong `getAccountInfo()` na paraan.

Dahil ito ay DevNet, ang iyong regular na mainnet wallet address ay _not_ be executable, kaya kung gusto mo ng address na _will_ be executable para sa pagsubok, gamitin ang `CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN`.

![Screenshot of final challenge solution](../../assets/intro-frontend-challenge.png)

Kung natigil ka huwag mag-atubiling tingnan ang [code ng solusyon](https://github.com/Unboxed-Software/solana-intro-frontend/tree/challenge-solution).

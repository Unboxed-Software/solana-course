---
title: Read Data From The Solana Network
objectives:
- Explain accounts
- Explain SOL and lamports
- Explain public keys
- Explain the JSON RPC API
- Explain web3.js
- Install web3.js
- Use web3.js to create a connection to a Solana node
- Use web3.js to read data from the blockchain (balance, account info, etc.)
---

## TL;DR

- Ang **Mga Account** ay tulad ng mga file sa network ledger ni Solana. Ang lahat ng data ng estado ay nakaimbak sa isang account. Maaaring gamitin ang mga account para sa maraming bagay, ngunit sa ngayon ay tututukan natin ang aspeto ng mga account na nag-iimbak ng SOL.
- **SOL** ang pangalan ng katutubong token ni Solana.
- Ang **Lamports** ay fractional SOL at ipinangalan kay [Leslie Lamport](https://en.wikipedia.org/wiki/Leslie_Lamport).
- **Mga pampublikong key**, madalas na tinutukoy bilang mga address, ay tumuturo sa mga account sa network ng Solana. Bagama't dapat ay mayroon kang isang partikular na sikretong key upang maisagawa ang ilang partikular na function sa loob ng mga account, kahit sino ay maaaring magbasa ng data ng account gamit ang isang pampublikong key.
- **JSON RPC API**: lahat ng pakikipag-ugnayan sa Solana network ay nangyayari sa pamamagitan ng [JSON RPC API](https://docs.solana.com/developing/clients/jsonrpc-api). Ito ay epektibong isang HTTP POST na may JSON body na kumakatawan sa paraan na gusto mong tawagan.
- **@solana/web3.js** ay isang abstraction sa itaas ng JSON RPC API. Maaari itong i-install gamit ang `npm` at pinapayagan kang tawagan ang mga pamamaraan ng Solana bilang mga function ng JavaScript. Halimbawa, maaari mo itong gamitin upang i-query ang balanse ng SOL ng anumang account:

    ```tsx
    async function getBalanceUsingWeb3(address: PublicKey): Promise<number> {
        const connection = new Connection(clusterApiUrl('devnet'));
        return connection.getBalance(address);
    }

    const publicKey = new PublicKey('7C4jsPZpht42Tw6MjXWF56Q5RQUocjBBmciEjDa8HRtp')
    getBalanceUsingWeb3(publicKey).then(balance => {
        console.log(balance)
    })
    ```

# Pangkalahatang-ideya

## Mga Account

Ang mga Solana account ay katulad ng mga file sa mga operating system gaya ng Linux. Ang mga ito ay nagtataglay ng arbitrary, paulit-ulit na data at sapat na kakayahang umangkop upang magamit sa maraming iba't ibang paraan.

Sa araling ito, hindi namin isasaalang-alang ang tungkol sa mga account na lampas sa kanilang kakayahang mag-imbak ng SOL (katutubong token ni Solana - higit pa doon sa ibang pagkakataon). Gayunpaman, ginagamit din ang mga account para mag-imbak ng mga custom na istruktura ng data at executable code na maaaring patakbuhin bilang mga program. Ang mga account ay kasangkot sa lahat ng gagawin mo sa Solana.

### Mga Pampublikong Susi

Ang mga pampublikong susi ay madalas na tinutukoy bilang mga address. Ang mga address ay tumuturo sa mga account sa network ng Solana. Kung gusto mong magpatakbo ng isang partikular na programa o maglipat ng SOL, kakailanganin mong ibigay ang kinakailangang pampublikong susi (o mga susi) para magawa ito.

Ang mga pampublikong key ay 256-bit at kadalasang ipinapakita ang mga ito bilang mga base-58 na naka-encode na mga string tulad ng `7C4jsPZpht42Tw6MjXWF56Q5RQUocjBBmciEjDa8HRtp`.

## Ang Solana JSON RPC API

![Illustration depicting how client-side interaction with the Solana network happens through the JSON RPC API](../assets/json-rpc-illustration.png)

Ang lahat ng pakikipag-ugnayan ng kliyente sa network ng Solana ay nangyayari sa pamamagitan ng [JSON RPC API] ni Solana(https://docs.solana.com/developing/clients/jsonrpc-api).

Alinsunod sa [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification)

> *Ang JSON-RPC ay isang stateless, light-weight remote procedure call (RPC) protocol. Pangunahing tinutukoy ng detalyeng ito ang ilang istruktura ng data at ang mga panuntunan sa kanilang pagpoproseso. Ito ay transport agnostic dahil ang mga konsepto ay maaaring gamitin sa loob ng parehong proseso, sa mga socket, sa http, o sa maraming iba't ibang mga environment na nagpapasa ng mensahe. Gumagamit ito ng [JSON](http://www.json.org/) ([RFC 4627](http://www.ietf.org/rfc/rfc4627.txt)) bilang format ng data.*
>

Sa pagsasagawa, ang pagtutukoy na ito ay nagsasangkot lamang ng pagpapadala ng JSON object na kumakatawan sa isang paraan na gusto mong tawagan. Magagawa mo ito sa mga socket, http, at higit pa.

Ang object ng JSON na ito ay nangangailangan ng apat na miyembro:

- `jsonrpc` - Ang numero ng bersyon ng JSON RPC. Ito ay kailangang *eksaktong* `"2.0"`.
- `id` - Isang identifier na pipiliin mo para sa pagtukoy sa tawag. Ito ay maaaring isang string o isang buong numero.
- `method` - Ang pangalan ng paraan na gusto mong gamitin.
- `params` - Isang array na naglalaman ng mga parameter na gagamitin sa panahon ng method invocation.

Kaya, kung gusto mong tawagan ang paraan ng `getBalance` sa Solana network, maaari kang magpadala ng HTTP na tawag sa isang Solana cluster gaya ng sumusunod:

```tsx
async function getBalanceUsingJSONRPC(address: string): Promise<number> {
    const url = clusterApiUrl('devnet')
    console.log(url);
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [
                address
            ]
        })
    }).then(response => response.json())
    .then(json => {
        if (json.error) {
            throw json.error
        }

        return json['result']['value'] as number;
    })
    .catch(error => {
        throw error
    })
}
```

## Web3.js SDK ni Solana

Bagama't ang JSON-RPC API ay sapat na simple, ito ay nagsasangkot ng malaking halaga ng nakakapagod na boilerplate. Upang pasimplehin ang proseso ng komunikasyon, ginawa ng Solana Labs ang `@solana/web3.js` SDK bilang abstraction sa itaas ng JSON-RPC API.

Binibigyang-daan ka ng Web3.js na tawagan ang mga pamamaraan ng JSON-RPC API gamit ang mga function ng JavaScript. Ang SDK ay nagbibigay ng hanay ng mga function at bagay ng helper. Sasaklawin namin ang maraming SDK nang unti-unti sa buong kursong ito, ngunit hindi namin tatalakayin nang malalim ang lahat, kaya siguraduhing tingnan ang [dokumentasyon](https://docs.solana.com/developing/clients/ javascript-reference) sa isang punto.

### Pag-install

Sa buong kursong ito, karamihan ay gagamit kami ng `npm`. Ang paggamit ng `npm` ay wala sa saklaw ng kursong ito at ipagpalagay namin na ito ay isang tool na regular mong ginagamit. [Tingnan ito](https://nodesource.com/blog/an-absolute-beginners-guide-to-using-npm/) kung hindi iyon ang kaso.

Upang i-install ang `@solana/web3.js`, i-set up ang iyong proyekto sa paraang karaniwan mong gagamitin:

`npm i-install ang @solana/web3.js`.

### Kumonekta sa Network

Ang bawat pakikipag-ugnayan sa network ng Solana gamit ang `@solana/web3.js` ay mangyayari sa pamamagitan ng object na `Connection`. Ang object na ito ay nagtatatag ng isang JSON-RPC na koneksyon sa isang Solana cluster (higit pa sa mga cluster sa ibang pagkakataon). Sa ngayon, gagamitin namin ang url para sa Devnet cluster kaysa sa Mainnet. Gaya ng iminumungkahi ng pangalan, ang cluster na ito ay idinisenyo para sa paggamit at pagsubok ng developer.

```tsx
const connection = new Connection(clusterApiUrl('devnet'));
```

### Basahin mula sa Network

Kapag mayroon kang object na `Connection`, ang pag-query sa network ay kasing simple ng pagtawag sa mga naaangkop na pamamaraan. Halimbawa, upang makuha ang balanse ng isang partikular na address, gagawin mo ang sumusunod:

```tsx
async function getBalanceUsingWeb3(address: PublicKey): Promise<number> {
    const connection = new Connection(clusterApiUrl('devnet'));
    return connection.getBalance(address);
}
```

Ang ibinalik na balanse ay nasa fractional SOL na tinatawag na lamports. Ang isang lamport ay kumakatawan sa 0.000000001 SOL. Karamihan sa mga oras kapag nakikitungo sa SOL ang system ay gagamit ng mga lamport sa halip na SOL. Nagbibigay ang Web3.js ng patuloy na `LAMPORTS_PER_SOL` para sa paggawa ng mabilis na mga conversion.

...at tulad niyan, ngayon alam mo na kung paano magbasa ng data mula sa Solana blockchain! Kapag nakapasok na tayo sa custom na data, magiging mas kumplikado ang mga bagay. Ngunit sa ngayon, isabuhay natin ang natutunan natin sa ngayon.

# Demo

Gumawa tayo ng simpleng website na nagbibigay-daan sa mga user na suriin ang balanse sa isang partikular na address.

Magiging ganito ang hitsura nito:

![Screenshot of demo solution](../assets/intro-frontend-demo.png)

Sa interes na manatili sa paksa, hindi kami ganap na gagana mula sa simula. Mahahanap mo ang starter code [dito](https://github.com/Unboxed-Software/solana-intro-frontend/tree/starter). Ang panimulang proyekto ay gumagamit ng Next.js at Typescript. Kung sanay ka sa ibang stack, huwag mag-alala! Ang mga prinsipyo ng web3 at Solana na matututunan mo sa mga araling ito ay naaangkop sa alinmang frontend stack na pinaka komportable ka.

### 1. Maging oriented

Kapag nakuha mo na ang starter code, tumingin sa paligid. I-install ang mga dependencies gamit ang `npm install` at pagkatapos ay patakbuhin ang app gamit ang `npm run dev`. Pansinin na anuman ang ilagay mo sa field ng address, kapag na-click mo ang "Suriin ang Balanse ng SOL" ang balanse ay magiging isang halaga ng placeholder na 1000.

Sa istruktura, ang app ay binubuo ng `index.tsx` at `AddressForm.tsx`. Kapag isinumite ng isang user ang form, tatawagin ang `addressSubmittedHandler` sa `index.tsx`. Doon namin idaragdag ang lohika para i-update ang natitirang bahagi ng UI.

### 2. Mag-install ng mga dependency

Gamitin ang `npm install @solana/web3.js` para i-install ang aming dependency sa Web3 library ng Solana.

### 3. Itakda ang balanse ng address

Una, i-import ang `@solana/web3.js` sa itaas ng `index.tsx`.

Ngayong available na ang library, pumunta tayo sa `addressSubmittedHandler` at gumawa ng instance ng `PublicKey` gamit ang value ng address mula sa input ng form. Susunod, gumawa ng instance ng `Connection` at gamitin ito para tawagan ang `getBalance`. Ipasok ang halaga ng pampublikong key na kakagawa mo lang. Panghuli, tawagan ang `setBalance`, ipasa ang resulta mula sa `getBalance`. Kung handa ka, subukan ito nang nakapag-iisa sa halip na kopyahin mula sa snippet ng code sa ibaba.

```tsx
import type { NextPage } from 'next'
import { useState } from 'react'
import styles from '../styles/Home.module.css'
import AddressForm from '../components/AddressForm'
import * as Web3 from '@solana/web3.js'

const Home: NextPage = () => {
  const [balance, setBalance] = useState(0)
  const [address, setAddress] = useState('')

  const addressSubmittedHandler = (address: string) => {
    setAddress(address)
    const key = new Web3.PublicKey(address)
    const connection = new Web3.Connection(Web3.clusterApiUrl('devnet'))
    connection.getBalance(key).then(balance => {
      setBalance(balance / Web3.LAMPORTS_PER_SOL)
    })
  }

...

}
```

Pansinin na kinukuha namin ang balanseng ibinalik ni Solana at hinahati ito sa `LAMPORTS_PER_SOL`. Ang mga Lampor ay fractional na SOL (0.000000001 SOL). Karamihan sa mga oras kapag nakikitungo sa SOL, ang system ay gagamit ng mga lamport sa halip na SOL. Sa kasong ito, ang balanse na ibinalik ng network ay nasa lamports. Bago ito itakda sa aming estado, kino-convert namin ito sa SOL gamit ang pare-parehong `LAMPORTS_PER_SOL`.

Sa puntong ito dapat kang makapaglagay ng wastong address sa field ng form at i-click ang "Suriin ang Balanse ng SOL" upang makita ang parehong Address at Balanse na napuno sa ibaba.

### 4. Pangasiwaan ang mga di-wastong address

Kakatapos lang namin. Ang tanging natitirang isyu ay ang paggamit ng di-wastong address ay hindi nagpapakita ng anumang mensahe ng error o binabago ang balanseng ipinapakita. Kung bubuksan mo ang developer console, makikita mo ang `Error: Invalid public key input`. Kapag ginagamit ang tagabuo ng `PublicKey`, kailangan mong magpasa ng wastong address o makukuha mo ang error na ito.

Upang ayusin ito, ibalot natin ang lahat sa isang bloke na `try-catch` at alertuhan ang user kung hindi wasto ang kanilang input.

```tsx
const addressSubmittedHandler = (address: string) => {
  try {
    setAddress(address)
    const key = new Web3.PublicKey(address)
    const connection = new Web3.Connection(Web3.clusterApiUrl('devnet'))
    connection.getBalance(key).then(balance => {
      setBalance(balance / Web3.LAMPORTS_PER_SOL)
    })
  } catch (error) {
    setAddress('')
    setBalance(0)
    alert(error)
  }
}
```

Pansinin na sa catch block na-clear din namin ang address at balanse upang maiwasan ang pagkalito.

Nagawa natin! Mayroon kaming gumaganang site na nagbabasa ng mga balanse ng SOL mula sa network ng Solana. Malapit ka nang makamit ang iyong mga dakilang ambisyon sa Solana. Kung kailangan mong gumugol ng mas maraming oras sa pagtingin sa code na ito para mas maunawaan ito, tingnan ang kumpletong [code ng solusyon](https://github.com/Unboxed-Software/solana-intro-frontend). Maghintay ka, ang mga araling ito ay mabilis na tataas.

# Hamon

Dahil ito ang unang hamon, pananatilihin namin itong simple. Sige at magdagdag sa frontend na nagawa na namin sa pamamagitan ng pagsasama ng isang line item pagkatapos ng "Balanse." Ipakita ang line item kung ang account ay isang executable account o hindi. Hint: mayroong paraan ng `getAccountInfo`.

Ang iyong karaniwang wallet address ay *hindi* magiging executable, kaya kung gusto mo ng isang address na *ay* ma-executable para sa pagsubok, gamitin ang `CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN`.

![Screenshot of final challenge solution](../assets/intro-frontend-challenge.png)

Kung natigil ka huwag mag-atubiling tingnan ang [code ng solusyon](https://github.com/Unboxed-Software/solana-intro-frontend/tree/challenge-solution).

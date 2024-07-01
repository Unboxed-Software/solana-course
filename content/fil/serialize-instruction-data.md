---
title: Serialize Custom Instruction Data
objectives:
- Ipaliwanag ang nilalaman ng isang transaksyon
- Ipaliwanag ang mga tagubilin sa transaksyon
- Ipaliwanag ang mga pangunahing kaalaman ng mga pag-optimize ng runtime ni Solana
- Ipaliwanag Borsh
- Gamitin ang Borsh para i-serialize ang data ng program
---

# TL;DR

- Ang mga transaksyon ay binubuo ng isang hanay ng mga tagubilin, ang isang transaksyon ay maaaring magkaroon ng anumang bilang ng mga tagubilin sa loob nito, bawat isa ay nagta-target ng sarili nitong programa. Kapag isinumite ang isang transaksyon, ipoproseso ng Solana runtime ang mga tagubilin nito sa pagkakasunud-sunod at atomically, ibig sabihin, kung mabibigo ang alinman sa mga tagubilin para sa anumang kadahilanan, ang buong transaksyon ay mabibigo na maproseso.
- Ang bawat *pagtuturo* ay binubuo ng 3 bahagi: ang nilalayong ID ng programa, isang hanay ng lahat ng sangkot na account, at isang byte na buffer ng data ng pagtuturo.
- Ang bawat *transaksyon* ay naglalaman ng: isang hanay ng lahat ng mga account na nilalayon nitong basahin o isulat, isa o higit pang mga tagubilin, kamakailang blockhash, at isa o higit pang mga lagda.
- Upang maipasa ang data ng pagtuturo mula sa isang kliyente, dapat itong i-serialize sa isang byte buffer. Upang mapadali ang prosesong ito ng serialization, gagamitin namin ang [Borsh](https://borsh.io/).
- Maaaring mabigo ang mga transaksyon na maproseso ng blockchain para sa anumang bilang ng mga kadahilanan, tatalakayin natin ang ilan sa mga pinakakaraniwan dito.

# Lesson

## Transactions

Ang mga transaksyon ay kung paano kami nagpapadala ng impormasyon sa blockchain upang maproseso. Sa ngayon, natutunan namin kung paano gumawa ng mga pangunahing transaksyon na may limitadong functionality. Ngunit ang mga transaksyon, at ang mga program kung saan sila ipinapadala, ay maaaring idisenyo upang maging mas nababaluktot at mapangasiwaan ang mas kumplikado kaysa sa napag-usapan namin hanggang ngayon.

### Transaction Contents

Ang bawat transaksyon ay naglalaman ng:

- Isang array na kinabibilangan ng bawat account na nilalayon nitong basahin o isulat
- Isa o higit pang mga tagubilin
- Isang kamakailang blockhash
- Isa o higit pang mga lagda

Pinapasimple ng `@solana/web3.js` ang prosesong ito para sa iyo upang ang talagang kailangan mong pagtuunan ay ang pagdaragdag ng mga tagubilin at lagda. Binubuo ng library ang hanay ng mga account batay sa impormasyong iyon at pinangangasiwaan ang lohika para sa pagsasama ng isang kamakailang blockhash.

## Instructions

Ang bawat tagubilin ay naglalaman ng:

- Ang program ID (public key) ng nilalayon na programa
- Isang array na naglilista ng bawat account na babasahin o isusulat sa panahon ng pagpapatupad
- Isang byte buffer ng data ng pagtuturo

Ang pagkilala sa programa sa pamamagitan ng pampublikong susi nito ay tumitiyak na ang pagtuturo ay isinasagawa ng tamang programa.

Ang pagsasama ng isang hanay ng bawat account na babasahin o isusulat sa nagbibigay-daan sa network na magsagawa ng ilang mga pag-optimize na nagbibigay-daan para sa mataas na pag-load ng transaksyon at mas mabilis na pagpapatupad.

Hinahayaan ka ng byte buffer na ipasa ang panlabas na data sa isang programa.

Maaari kang magsama ng maraming tagubilin sa isang transaksyon. Ipoproseso ng Solana runtime ang mga tagubiling ito sa pagkakasunud-sunod at atomically. Sa madaling salita, kung ang bawat tagubilin ay magtagumpay, ang transaksyon sa kabuuan ay magiging matagumpay, ngunit kung ang isang pagtuturo ay nabigo, ang buong transaksyon ay mabibigo kaagad nang walang mga side-effects.

Ang hanay ng account ay hindi lamang isang hanay ng mga pampublikong key ng mga account. Kasama sa bawat object sa array ang pampublikong key ng account, lumagda man ito o hindi sa transaksyon, at kung ito ay maisusulat o hindi. Kasama kung maisusulat o hindi ang isang account sa panahon ng pagpapatupad ng isang pagtuturo ay nagbibigay-daan sa runtime na mapadali ang parallel processing ng mga smart contract. Dahil dapat mong tukuyin kung aling mga account ang read-only at kung saan ka susulatan, matutukoy ng runtime kung aling mga transaksyon ang hindi magkakapatong o read-only at payagan ang mga ito na isagawa nang sabay-sabay. Para matuto pa tungkol sa runtime ng Solana, tingnan itong [blog post](https://solana.com/news/sealevel-\--parallel-processing-thousands-of-smart-contracts).

### Instruction Data

Ang kakayahang magdagdag ng di-makatwirang data sa isang pagtuturo ay nagsisiguro na ang mga programa ay maaaring maging dynamic at sapat na kakayahang umangkop para sa malawak na mga kaso ng paggamit sa parehong paraan na ang katawan ng isang kahilingan sa HTTP ay nagbibigay-daan sa iyong bumuo ng mga dynamic at flexible na REST API.

Kung paanong ang istraktura ng katawan ng isang kahilingan sa HTTP ay nakasalalay sa endpoint na balak mong tawagan, ang istraktura ng byte buffer na ginamit bilang data ng pagtuturo ay ganap na nakadepende sa programa ng tatanggap. Kung ikaw ay gumagawa ng isang full-stack na dApp nang mag-isa, pagkatapos ay kakailanganin mong kopyahin ang parehong istraktura na ginamit mo noong pagbuo ng program patungo sa client-side code. Kung nakikipagtulungan ka sa isa pang developer na nangangasiwa sa pagbuo ng program, maaari kang makipag-coordinate para matiyak na tumutugma ang mga buffer layout.

Mag-isip tayo ng isang konkretong halimbawa. Isipin na nagtatrabaho sa isang laro sa Web3 at pagiging responsable para sa pagsulat ng client-side code na nakikipag-ugnayan sa isang programa ng imbentaryo ng player. Ang programa ay idinisenyo upang payagan ang kliyente na:

- Magdagdag ng imbentaryo batay sa mga resulta ng laro-play ng isang manlalaro
- Maglipat ng imbentaryo mula sa isang manlalaro patungo sa isa pa
- Magbigay ng kasangkapan sa isang manlalaro ng mga napiling item sa imbentaryo

Ang program na ito ay nakabalangkas sana na ang bawat isa sa mga ito ay naka-encapsulated sa sarili nitong function.

Ang bawat programa, gayunpaman, ay mayroon lamang isang entry point. Ituturo mo sa programa kung alin sa mga function na ito ang tatakbo sa data ng pagtuturo.

Isasama mo rin sa data ng pagtuturo ang anumang impormasyong kailangan ng function upang maisagawa nang maayos, hal. ID ng isang item ng imbentaryo, isang player na ililipat ng imbentaryo, atbp.

Eksakto *paano* ang data na ito ay magiging structured ay depende sa kung paano isinulat ang program, ngunit karaniwan na ang unang field sa data ng pagtuturo ay isang numero na maaaring imapa ng program sa isang function, pagkatapos nito ang mga karagdagang field ay nagsisilbing mga argumento ng function.

## Serialization

Bilang karagdagan sa pag-alam kung anong impormasyon ang isasama sa isang buffer ng data ng pagtuturo, kailangan mo ring i-serialize ito nang maayos. Ang pinakakaraniwang serializer na ginagamit sa Solana ay [Borsh](https://borsh.io). Ayon sa website:

> Borsh stands for Binary Object Representation Serializer for Hashing. It is meant to be used in security-critical projects as it prioritizes consistency, safety, speed; and comes with a strict specification.

Ang Borsh ay nagpapanatili ng [JS library](https://github.com/near/borsh-js) na nangangasiwa sa pagse-serialize ng mga karaniwang uri sa isang buffer. Mayroon ding iba pang mga pakete na binuo sa ibabaw ng borsh na sumusubok na gawing mas madali ang prosesong ito. Gagamitin namin ang library na `@project-serum/borsh` na maaaring i-install gamit ang `npm`.

Mula sa nakaraang halimbawa ng imbentaryo ng laro, tingnan natin ang isang hypothetical na senaryo kung saan itinuturo natin ang programa na magbigay ng kasangkapan sa isang manlalaro ng isang partikular na item. Ipagpalagay na ang programa ay idinisenyo upang tanggapin ang isang buffer na kumakatawan sa isang struct na may mga sumusunod na katangian:

1. `variant` bilang isang unsigned, 8-bit integer na nagtuturo sa program kung aling pagtuturo, o function, ang isasagawa.
2. `playerId` bilang isang unsigned, 16-bit integer na kumakatawan sa player ID ng player na gagamitin sa ibinigay na item.
3. `itemId` bilang isang unsigned, 256-bit integer na kumakatawan sa item ID ng item na gagamitin sa ibinigay na player.

Ang lahat ng ito ay ipapasa bilang isang byte buffer na babasahin sa pagkakasunud-sunod, kaya ang pagtiyak ng wastong pagkakasunud-sunod ng buffer layout ay napakahalaga. Gagawa ka ng buffer layout schema o template para sa itaas tulad ng sumusunod:

```tsx
import * as borsh from '@project-serum/borsh'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])
```

Maaari mong i-encode ang data gamit ang schema na ito gamit ang paraan ng `encode`. Ang pamamaraang ito ay tumatanggap bilang mga argumento ng isang bagay na kumakatawan sa data na isa-serialize at isang buffer. Sa halimbawa sa ibaba, naglalaan kami ng bagong buffer na mas malaki kaysa sa kailangan, pagkatapos ay i-encode ang data sa buffer na iyon at i-slice ang orihinal na buffer pababa sa isang bagong buffer na kasing laki lang ng kinakailangan.

```tsx
import * as borsh from '@project-serum/borsh'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))
```

Kapag maayos nang nagawa ang isang buffer at na-serialize ang data, ang natitira na lang ay ang pagbuo ng transaksyon. Ito ay katulad ng ginawa mo sa mga nakaraang aralin. Ipinapalagay ng halimbawa sa ibaba na:

- Ang `player`, `playerInfoAccount`, at `PROGRAM_ID` ay natukoy na sa isang lugar sa labas ng code snippet
- Ang `player` ay pampublikong key ng isang user
- Ang `playerInfoAccount` ay ang pampublikong susi ng account kung saan isusulat ang mga pagbabago sa imbentaryo
- Gagamitin ang `SystemProgram` sa proseso ng pagsasagawa ng pagtuturo.

```tsx
import * as borsh from '@project-serum/borsh'
import * as web3 from '@solana/web3.js'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))

const endpoint = web3.clusterApiUrl('devnet')
const connection = new web3.Connection(endpoint)

const transaction = new web3.Transaction()
const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: player.publicKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: playerInfoAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    }
  ],
  data: instructionBuffer,
  programId: PROGRAM_ID
})

transaction.add(instruction)

web3.sendAndConfirmTransaction(connection, transaction, [player]).then((txid) => {
  console.log(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
})
```

# Demo

Sanayin natin ito nang sama-sama sa pamamagitan ng pagbuo ng Movie Review app na nagbibigay-daan sa mga user na magsumite ng review ng pelikula at i-store ito sa network ni Solana. Bubuo kami ng app na ito nang paunti-unti sa susunod na ilang mga aralin, na nagdaragdag ng bagong functionality sa bawat aralin.

![Movie review frontend](../../assets/movie-reviews-frontend.png)

Narito ang isang mabilis na diagram ng program na gagawin namin:

![Solana stores data items in PDAs, which can be found by their seeds](../../assets/movie-review-program.svg)

Ang pampublikong key ng Solana program na gagamitin namin para sa application na ito ay `CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN`.

### 1. Download the starter code

Bago tayo magsimula, magpatuloy at i-download ang [starter code](https://github.com/Unboxed-Software/solana-movie-frontend/tree/starter).

Ang proyekto ay isang medyo simpleng Next.js application. Kabilang dito ang `WalletContextProvider` na ginawa namin sa aralin sa Wallets, isang bahagi ng `Card` para sa pagpapakita ng pagsusuri sa pelikula, isang bahagi ng `MovieList` na nagpapakita ng mga review sa isang listahan, isang bahagi ng `Form` para sa pagsusumite ng bagong review, at isang ` Movie.ts` file na naglalaman ng kahulugan ng klase para sa object na `Movie`.

Tandaan na sa ngayon, ang mga pelikulang ipinapakita sa page kapag nagpatakbo ka ng `npm run dev` ay mga pangungutya. Sa araling ito, magtutuon tayo sa pagdaragdag ng bagong pagsusuri ngunit hindi talaga natin makikitang ipinapakita ang pagsusuring iyon. Sa susunod na aralin, magtutuon tayo sa pag-deserialize ng custom na data mula sa mga onchain na account.

### 2. Create the buffer layout

Tandaan na upang maayos na makipag-ugnayan sa isang programa ng Solana, kailangan mong malaman kung paano ito inaasahan na mai-istruktura ang data. Inaasahan ng aming programa sa Pagsusuri ng Pelikula na ang data ng pagtuturo ay naglalaman ng:

1. `variant` bilang isang unsigned, 8-bit integer na kumakatawan sa kung aling pagtuturo ang dapat isagawa (sa madaling salita kung aling function sa program ang dapat tawagan).
2. `title` bilang isang string na kumakatawan sa pamagat ng pelikula na iyong sinusuri.
3. `rating` bilang isang unsigned, 8-bit integer na kumakatawan sa rating sa 5 na ibinibigay mo sa pelikulang iyong sinusuri.
4. `description` bilang isang string na kumakatawan sa nakasulat na bahagi ng review na iiwan mo para sa pelikula.

Mag-configure tayo ng `borsh` na layout sa klase ng `Movie`. Magsimula sa pamamagitan ng pag-import ng `@project-serum/borsh`. Susunod, gumawa ng `borshInstructionSchema` property at itakda ito sa naaangkop na `borsh` struct na naglalaman ng mga property na nakalista sa itaas.

```tsx
import * as borsh from '@project-serum/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  borshInstructionSchema = borsh.struct([
    borsh.u8('variant'),
    borsh.str('title'),
    borsh.u8('rating'),
    borsh.str('description'),
  ])
}
```

Tandaan na *mahalaga ang order*. Kung ang pagkakasunud-sunod ng mga pag-aari dito ay naiiba sa kung paano nakaayos ang programa, ang transaksyon ay mabibigo.

### 3. Gumawa ng paraan para mag-serialize ng data

Ngayong na-set up na natin ang buffer layout, gumawa tayo ng paraan sa `Movie` na tinatawag na `serialize()` na magbabalik ng `Buffer` na may mga property ng `Movie` na naka-encode sa naaangkop na layout.

```tsx
import * as borsh from '@project-serum/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  borshInstructionSchema = borsh.struct([
    borsh.u8('variant'),
    borsh.str('title'),
    borsh.u8('rating'),
    borsh.str('description'),
  ])

  serialize(): Buffer {
    const buffer = Buffer.alloc(1000)
    this.borshInstructionSchema.encode({ ...this, variant: 0 }, buffer)
    return buffer.slice(0, this.borshInstructionSchema.getSpan(buffer))
  }
}
```

Ang pamamaraang ipinakita sa itaas ay unang lumilikha ng sapat na malaking buffer para sa ating object, pagkatapos ay ine-encode ang `{ ...this, variant: 0 }` sa buffer. Dahil ang kahulugan ng klase ng `Pelikula` ay naglalaman ng 3 sa 4 na katangian na kinakailangan ng buffer layout at gumagamit ng parehong pagpapangalan, maaari namin itong gamitin nang direkta sa spread operator at idagdag lang ang property na `variant`. Sa wakas, ang pamamaraan ay nagbabalik ng isang bagong buffer na nag-iiwan sa hindi nagamit na bahagi ng orihinal.

### 4. Send transaction when user submits form

Ngayon na mayroon na kaming mga bloke ng gusali para sa data ng pagtuturo, maaari kaming lumikha at magpadala ng transaksyon kapag ang isang gumagamit ay nagsumite ng form. Buksan ang `Form.tsx` at hanapin ang function na `handleTransactionSubmit`. Ito ay tatawagin ng `handleSubmit` sa tuwing isusumite ng isang user ang form ng Pagsusuri ng Pelikula.

Sa loob ng function na ito, gagawa at ipapadala namin ang transaksyon na naglalaman ng data na isinumite sa pamamagitan ng form.

Magsimula sa pamamagitan ng pag-import ng `@solana/web3.js` at pag-import ng `useConnection` at `useWallet` mula sa `@solana/wallet-adapter-react`.

```tsx
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
```

Susunod, bago ang function na `handleSubmit`, tawagan ang `useConnection()` para makakuha ng object na `connection` at tawagan ang `useWallet()` para makakuha ng `publicKey` at `sendTransaction`.

```tsx
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'

const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export const Form: FC = () => {
  const [title, setTitle] = useState('')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const handleSubmit = (event: any) => {
    event.preventDefault()
    const movie = new Movie(title, rating, description)
    handleTransactionSubmit(movie)
  }

  ...
}
```

Bago natin ipatupad ang `handleTransactionSubmit`, pag-usapan natin kung ano ang kailangang gawin. Kailangan natin:

1. Suriin kung umiiral ang `publicKey` upang matiyak na naikonekta ng user ang kanilang wallet.
2. Tawagan ang `serialize()` sa `movie` upang makakuha ng buffer na kumakatawan sa data ng pagtuturo.
3. Gumawa ng bagong object na `Transaction`.
4. Kunin ang lahat ng mga account na babasahin o isusulat ng transaksyon.
5. Gumawa ng bagong object na `Instruction` na kinabibilangan ng lahat ng account na ito sa argument na `keys`, kasama ang buffer sa argument ng `data`, at kasama ang public key ng program sa argument na `programId`.
6. Idagdag ang pagtuturo mula sa huling hakbang sa transaksyon.
7. Tawagan ang `sendTransaction`, pagpasa sa naka-assemble na transaksyon.

Napakaraming iproseso! Ngunit huwag mag-alala, nagiging mas madali ito kapag ginagawa mo ito. Magsimula tayo sa unang 3 hakbang mula sa itaas:

```tsx
const handleTransactionSubmit = async (movie: Movie) => {
  if (!publicKey) {
    alert('Please connect your wallet!')
    return
  }

  const buffer = movie.serialize()
  const transaction = new web3.Transaction()
}
```

Ang susunod na hakbang ay kunin ang lahat ng mga account na babasahin o isusulat ng transaksyon. Sa mga nakaraang aralin, ang account kung saan iimbak ang data ay ibinigay na sa iyo. Sa pagkakataong ito, mas dynamic ang address ng account, kaya kailangan itong kalkulahin. Tatalakayin namin ito nang malalim sa susunod na aralin, ngunit sa ngayon maaari mong gamitin ang sumusunod, kung saan ang `pda` ay ang address sa account kung saan iimbak ang data:

```tsx
const [pda] = await web3.PublicKey.findProgramAddress(
  [publicKey.toBuffer(), Buffer.from(movie.title)],
  new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
)
```

Bilang karagdagan sa account na ito, kakailanganin din ng program na magbasa mula sa `SystemProgram`, kaya kailangan ding isama ng aming array ang `web3.SystemProgram.programId`.

Sa pamamagitan nito, maaari nating tapusin ang mga natitirang hakbang:

```tsx
const handleTransactionSubmit = async (movie: Movie) => {
  if (!publicKey) {
    alert('Please connect your wallet!')
    return
  }

  const buffer = movie.serialize()
  const transaction = new web3.Transaction()

  const [pda] = await web3.PublicKey.findProgramAddress(
    [publicKey.toBuffer(), new TextEncoder().encode(movie.title)],
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
  )

  const instruction = new web3.TransactionInstruction({
    keys: [
      {
        pubkey: publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false
      }
    ],
    data: buffer,
    programId: new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
  })

  transaction.add(instruction)

  try {
    let txid = await sendTransaction(transaction, connection)
    console.log(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
  } catch (e) {
    alert(JSON.stringify(e))
  }
}
```

At iyon na! Dapat mo na ngayong gamitin ang form sa site upang magsumite ng pagsusuri sa pelikula. Bagama't hindi mo makikita ang pag-update ng UI upang ipakita ang bagong pagsusuri, maaari mong tingnan ang mga log ng programa ng transaksyon sa Solana Explorer upang makitang matagumpay ito.

Kung kailangan mo ng kaunting oras sa proyektong ito para maging komportable, tingnan ang kumpletong [code ng solusyon](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-serialize-instruction-data).

# Challenge

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa. Lumikha ng isang application na nagbibigay-daan sa mga mag-aaral ng kursong ito na ipakilala ang kanilang sarili! Ang programang Solana na sumusuporta dito ay nasa `HdE95RSVsdb315jfJtaykXhXY478h53X6okDupVfY9yf`.

![Screenshot of Student Intros frontend](../../assets/student-intros-frontend.png)

1. Magagawa mo ito mula sa simula o maaari mong [i-download ang starter code](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/starter).
2. Gawin ang layout ng buffer ng pagtuturo sa `StudentIntro.ts`. Inaasahan ng programa na ang data ng pagtuturo ay naglalaman ng:
    1. `variant` bilang isang unsigned, 8-bit integer na kumakatawan sa pagtuturo na tatakbo (dapat ay 0).
    2. `pangalan` bilang isang string na kumakatawan sa pangalan ng mag-aaral.
    3. `mensahe` bilang isang string na kumakatawan sa mensaheng ibinabahagi ng mag-aaral tungkol sa kanilang paglalakbay sa Solana.
3. Gumawa ng paraan sa `StudentIntro.ts` na gagamit ng buffer layout para i-serialize ang isang `StudentIntro` object.
4. Sa bahagi ng `Form`, ipatupad ang function na `handleTransactionSubmit` para mag-serialize ito ng `StudentIntro`, bumuo ng naaangkop na mga tagubilin sa transaksyon at transaksyon, at isumite ang transaksyon sa wallet ng user.
5. Dapat ay magagawa mo na ngayong magsumite ng mga pagpapakilala at maimbak ang impormasyon sa chain! Tiyaking i-log ang transaction ID at tingnan ito sa Solana Explorer para i-verify na gumana ito.

Kung talagang nalilito ka, maaari mong [tingnan ang code ng solusyon](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data).

Huwag mag-atubiling maging malikhain sa mga hamong ito at gawin ang mga ito nang higit pa. Ang mga tagubilin ay wala dito para pigilan ka!

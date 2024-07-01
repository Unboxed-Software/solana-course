---
title: Deserialize Program Data
objectives:
- Ipaliwanag ang Mga Account na Nagmula sa Programa
- Kumuha ng mga PDA na binibigyan ng mga partikular na binhi
- Kunin ang mga account ng program
- Gamitin ang Borsh para i-deserialize ang custom na data
---

# TL;DR

- Ang mga program ay nag-iimbak ng data sa mga PDA, na nangangahulugang **Program Derived Address**.
- Ang mga PDA ay walang kaukulang lihim na susi.
- Upang mag-imbak at maghanap ng data, kumuha ng PDA gamit ang `findProgramAddress(seeds, programid)` na paraan.
- Makukuha mo ang mga account na kabilang sa isang program gamit ang `getProgramAccounts(programId)`.
- Kailangang ma-deserialize ang data ng account gamit ang parehong layout na ginamit upang iimbak ito sa unang lugar. Maaari mong gamitin ang `@project-serum/borsh` para gumawa ng schema.

# Lesson

Sa huling aralin, na-serialize namin ang data ng programa na kasunod na inimbak onchain ng isang Solana program. Sa araling ito, tatalakayin natin nang mas detalyado kung paano nag-iimbak ang mga program ng data sa chain, kung paano kunin ang data, at kung paano i-deserialize ang data na iniimbak nila.
## Programs

Gaya nga ng kasabihan, lahat ng nasa Solana ay isang account. Kahit na mga programa. Ang mga programa ay mga account na nag-iimbak ng code at minarkahan bilang executable. Ang code na ito ay maaaring isagawa ng Solana runtime kapag inutusang gawin ito. Ang isang address ng programa ay isang pampublikong key sa Ed25519 Elliptic Curve. Tulad ng lahat ng pampublikong susi, mayroon silang katumbas na mga lihim na susi.

Ang mga programa ay nag-iimbak ng data nang hiwalay mula sa kanilang code. Ang mga program ay nag-iimbak ng data sa mga PDA, na nangangahulugang **Program Derived Address**. Ang mga PDA ay isang natatanging konsepto sa Solana, ngunit ang pattern ay pamilyar:

  - Maaari mong isipin ang mga PDA bilang isang key value store, kung saan ang address ang susi, at ang data sa loob ng account ay ang value.
  - Maaari mo ring isaalang-alang ang mga PDA bilang mga tala sa isang database, na ang address ang pangunahing susi na ginagamit upang hanapin ang mga halaga sa loob.
 
Pinagsasama-sama ng mga PDA ang mga address ng programa at ilang pinili ng developer upang lumikha ng mga address na nag-iimbak ng mga indibidwal na piraso ng data. Dahil ang mga PDA ay mga address na *off* sa Ed25519 Elliptic curve, ang mga PDA ay walang mga lihim na susi. Sa halip, ang mga PDA ay maaaring lagdaan ng address ng programa na ginamit sa paggawa ng mga ito.

Ang mga PDA at ang data sa loob ng mga ito ay patuloy na mahahanap batay sa address ng programa, bump, at seeds. Upang makahanap ng PDA, ang program ID at mga buto na pinili ng developer (tulad ng isang string ng text) ay ipinapasa sa [`findProgramAddress()`](https://solana-labs.github.io/solana-web3.js/classes/PublicKey.html#findProgramAddress) function.

Tingnan natin ang ilang halimbawa...

#### Example: program with global state 

Ang isang simpleng program na may pandaigdigang estado - tulad ng aming ping counter - ay maaaring naisin na gumamit lamang ng isang PDA, batay sa isang simpleng seed na parirala tulad ng `"GLOBAL_STATE"`. Kung gusto ng kliyente na basahin ang data mula sa PDA na ito, maaari nitong makuha ang address gamit ang program ID at ang parehong binhi.

```typescript
const [pda, bump] = await findProgramAddress(Buffer.from("GLOBAL_STATE"), programId)
```

![Global state using a PDA](../../assets/pdas-global-state.svg)

#### Example: program with user-specific data

Sa mga program na nag-iimbak ng data na partikular sa user, karaniwan nang gamitin ang pampublikong key ng user bilang seed. Pinaghihiwalay nito ang data ng bawat user sa sarili nitong PDA. Ang paghihiwalay ay ginagawang posible para sa kliyente na mahanap ang data ng bawat user sa pamamagitan ng paghahanap ng address gamit ang program ID at pampublikong key ng user.

```typescript
const [pda, bump] = await web3.PublicKey.findProgramAddress(
  [
    publicKey.toBuffer()
  ],
  programId
)
```

![Per user state](../../assets/pdas-per-user-state.svg)
### Example: program with multiple data items per user

Kapag mayroong maraming data item sa bawat user, maaaring gumamit ang isang program ng mas maraming seed para gumawa at tumukoy ng mga account. Halimbawa, sa isang note-taking app ay maaaring mayroong isang account sa bawat tala kung saan ang bawat PDA ay hinango kasama ang pampublikong key ng user at ang pamagat ng tala.

```typescript
const [pda, bump] = await web3.PublicKey.findProgramAddress(
  [
    publicKey.toBuffer(), 
    Buffer.from("Shopping list")
  ],
  programId,
);
```

![Global state using a PDA](../../assets/pdas-note-taking-program.svg)

Sa halimbawang ito, makikita natin na parehong sina Alice at Bob ay may tala na tinatawag na 'Shopping List' ngunit dahil ginagamit natin ang kanilang wallet address bilang isa sa mga buto, maaaring umiral ang parehong mga talang ito nang sabay.

### Getting Multiple Program Accounts

Bilang karagdagan sa pagkuha ng mga address, maaari mong kunin ang lahat ng account na ginawa ng isang program gamit ang `connection.getProgramAccounts(programId)`. Nagbabalik ito ng hanay ng mga bagay kung saan ang bawat bagay ay may `pubkey` na property na kumakatawan sa pampublikong key ng account at isang `account` na property na may uri ng `AccountInfo`. Maaari mong gamitin ang property na `account` para makuha ang data ng account.

```typescript
const accounts = connection.getProgramAccounts(programId).then(accounts => {
  accounts.map(({ pubkey, account }) => {
    console.log('Account:', pubkey)
    console.log('Data buffer:', account.data)
  })
})
```

## Deserializing program data

Ang property na `data` sa isang object na `AccountInfo` ay isang buffer. Upang magamit ito nang mahusay, kakailanganin mong magsulat ng code na nagde-deserialize nito sa isang bagay na mas magagamit. Ito ay katulad ng proseso ng serialization na aming tinalakay noong nakaraang aralin. Gaya ng dati, gagamitin namin ang [Borsh](https://borsh.io/) at `@project-serum/borsh`. Kung kailangan mo ng refresher sa alinman sa mga ito, tingnan ang nakaraang aralin.

Ang deserializing ay nangangailangan ng kaalaman sa layout ng account nang maaga. Kapag gumagawa ng sarili mong mga programa, tutukuyin mo kung paano ito ginagawa bilang bahagi ng prosesong iyon. Maraming mga programa ang mayroon ding dokumentasyon kung paano i-deserialize ang data ng account. Kung hindi, kung magagamit ang program code maaari mong tingnan ang pinagmulan at tukuyin ang istraktura sa ganoong paraan.

Upang maayos na i-deserialize ang data mula sa isang onchain na program, kakailanganin mong gumawa ng schema sa panig ng kliyente na sumasalamin kung paano iniimbak ang data sa account. Halimbawa, ang sumusunod ay maaaring ang schema para sa isang account na nag-iimbak ng metadata tungkol sa isang manlalaro sa isang onchain na laro.

```typescript
import * as borsh from "@project-serum/borsh";

borshAccountSchema = borsh.struct([
  borsh.bool("initialized"),
  borsh.u16("playerId"),
  borsh.str("name"),
]);

```

Kapag natukoy mo na ang iyong layout, tawagan lang ang `.decode(buffer)` sa schema.

```typescript
import * as borsh from "@project-serum/borsh";

borshAccountSchema = borsh.struct([
  borsh.bool("initialized"),
  borsh.u16("playerId"),
  borsh.str("name"),
]);

const { playerId, name } = borshAccountSchema.decode(buffer);

```

# Demo

Sanayin natin ito nang magkasama sa pamamagitan ng patuloy na paggawa sa Movie Review app mula sa huling aralin. Huwag mag-alala kung papasok ka lang sa araling ito - dapat na posible na sundin ang alinmang paraan.

Bilang isang refresher, ang proyektong ito ay gumagamit ng isang Solana program na naka-deploy sa Devnet na nagbibigay-daan sa mga user na magsuri ng mga pelikula. Noong nakaraang aralin, nagdagdag kami ng functionality sa frontend skeleton na nagpapahintulot sa mga user na magsumite ng mga review ng pelikula ngunit ang listahan ng mga review ay nagpapakita pa rin ng mock data. Ayusin natin iyon sa pamamagitan ng pagkuha sa mga storage account ng program at pag-deserialize ng data na nakaimbak doon.

![Screenshot of movie review frontend](../assets/movie-reviews-frontend.png)

### 1. Download the starter code

Kung hindi mo nakumpleto ang demo mula sa huling aralin o gusto mo lang matiyak na wala kang napalampas, maaari mong i-download ang [starter code](https://github.com/Unboxed-Software/solana-movie -frontend/tree/solution-serialize-instruction-data).

Ang proyekto ay isang medyo simpleng Next.js application. Kabilang dito ang `WalletContextProvider` na ginawa namin sa aralin sa Wallets, isang bahagi ng `Card` para sa pagpapakita ng pagsusuri sa pelikula, isang bahagi ng `MovieList` na nagpapakita ng mga review sa isang listahan, isang bahagi ng `Form` para sa pagsusumite ng bagong review, at isang ` Movie.ts` file na naglalaman ng kahulugan ng klase para sa object na `Movie`.

Tandaan na kapag nagpatakbo ka ng `npm run dev`, ang reviews displayed on the page are mocks. We’ll be swapping those out for the real deal.

### 2. Create the buffer layout

Tandaan na para maayos na makipag-ugnayan sa isang Solana program, kailangan mong malaman kung paano nakaayos ang data nito. Isang paalala:

![Ed25519 curve showing Movie Review Program](../assets/movie-review-program.svg)

Ang executable data ng program ay nasa isang program account, ngunit ang mga indibidwal na review ay pinananatili sa mga PDA. Gumagamit kami ng `findProgramAddress()` para gumawa ng PDA na natatangi para sa bawat pitaka, para sa bawat pamagat ng pelikula. Iimbak namin ang sumusunod na data sa `data` ng PDA:

1. `nasimulan` bilang isang boolean na kumakatawan sa kung ang account ay nasimulan o hindi.
2. `rating` bilang unsigned, 8-bit integer na kumakatawan sa rating sa 5 na ibinigay ng reviewer sa pelikula.
3. `title` bilang isang string na kumakatawan sa pamagat ng sinuri na pelikula.
4. `paglalarawan` bilang isang string na kumakatawan sa nakasulat na bahagi ng pagsusuri.

Mag-configure tayo ng layout ng `borsh` sa klase ng `Pelikula` upang kumatawan sa layout ng data ng account ng pelikula. Magsimula sa pamamagitan ng pag-import ng `@project-serum/borsh`. Susunod, gumawa ng `borshAccountSchema` na static na property at itakda ito sa naaangkop na `borsh` struct na naglalaman ng mga property na nakalista sa itaas.

```tsx
import * as borsh from '@project-serum/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  static borshAccountSchema = borsh.struct([
    borsh.bool('initialized'),
    borsh.u8('rating'),
    borsh.str('title'),
    borsh.str('description'),
  ])
}
```

Tandaan, ang order dito *mahalaga*. Kailangan nitong tumugma sa kung paano nakaayos ang data ng account.
### 3. Create a method to deserialize data

Ngayong na-set up na natin ang buffer layout, gumawa tayo ng static na paraan sa `Movie` na tinatawag na `deserialize` na kukuha ng opsyonal na `Buffer` at magbabalik ng `Movie` object o `null`.

```typescript
import * as borsh from '@project-serum/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  static borshAccountSchema = borsh.struct([
    borsh.bool('initialized'),
    borsh.u8('rating'),
    borsh.str('title'),
    borsh.str('description'),
  ])

  static deserialize(buffer?: Buffer): Movie|null {
    if (!buffer) {
      return null
    }

    try {
      const { title, rating, description } = this.borshAccountSchema.decode(buffer)
      return new Movie(title, rating, description)
    } catch(error) {
      console.log('Deserialization error:', error)
      return null
    }
  }
}
```

Sinusuri muna ng pamamaraan kung mayroon o wala ang buffer at ibabalik ang `null` kung wala. Susunod, ginagamit nito ang layout na ginawa namin upang i-decode ang buffer, pagkatapos ay ginagamit ang data upang bumuo at magbalik ng isang instance ng `Pelikula`. Kung nabigo ang pag-decode, itatala ng pamamaraan ang error at ibabalik ang `null`.

### 4. Fetch movie review accounts

Ngayong mayroon na tayong paraan para i-deserialize ang data ng account, kailangan talaga nating kunin ang mga account. Buksan ang `MovieList.tsx` at i-import ang `@solana/web3.js`. Pagkatapos, gumawa ng bagong `Koneksyon` sa loob ng bahagi ng `MovieList`. Panghuli, palitan ang linyang `setMovies(Movie.mocks)` sa loob ng `useEffect` ng isang tawag sa `connection.getProgramAccounts`. Kunin ang resultang array at i-convert ito sa hanay ng mga pelikula at tawagan ang `setMovies`.

```typescript
import { Card } from './Card'
import { FC, useEffect, useState } from 'react'
import { Movie } from '../models/Movie'
import * as web3 from '@solana/web3.js'

const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export const MovieList: FC = () => {
  const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
  const [movies, setMovies] = useState<Movie[]>([])

  useEffect(() => {
    connection.getProgramAccounts(new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)).then(async (accounts) => {
      const movies: Movie[] = accounts.map(({ account }) => {
        return Movie.deserialize(account.data)
      })

      setMovies(movies)
    })
  }, [])

  return (
    <div>
      {
        movies.map((movie, i) => <Card key={i} movie={movie} /> )
      }
    </div>
  )
}
```

Sa puntong ito, dapat mong patakbuhin ang app at makita ang listahan ng mga review ng pelikula na nakuha mula sa programa!

Depende sa kung gaano karaming mga review ang naisumite, maaaring tumagal ito ng mahabang panahon upang ma-load o maaaring ganap na i-lock ang iyong browser. Ngunit huwag mag-alala — sa susunod na aralin, matututunan natin kung paano mag-page at mag-filter ng mga account para mas maging surgical ka sa iyong ni-load.

Kung kailangan mo ng mas maraming oras sa proyektong ito para maging komportable sa mga konseptong ito, tingnan ang [solution code](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-deserialize-account-data) bago magpatuloy.

# Challenge

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa. Noong nakaraang aralin, nagtrabaho ka sa Student Intros app para i-serialize ang data ng pagtuturo at magpadala ng bagong intro sa network. Ngayon, oras na para kunin at i-deserialize ang data ng account ng program. Tandaan, ang programa ng Solana na sumusuporta dito ay nasa `HdE95RSVsdb315jfJtaykXhXY478h53X6okDupVfY9yf`.

![Screenshot of Student Intros frontend](../assets/student-intros-frontend.png)

1. Magagawa mo ito mula sa simula o maaari mong [i-download ang starter code](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data).
2. Gawin ang layout ng buffer ng account sa `StudentIntro.ts`. Ang data ng account ay naglalaman ng:
    1. `pinasimulan` bilang isang unsigned, 8-bit integer na kumakatawan sa pagtuturo na tatakbo (dapat ay 1).
    2. `pangalan` bilang isang string na kumakatawan sa pangalan ng mag-aaral.
    3. `mensahe` bilang isang string na kumakatawan sa mensaheng ibinahagi ng mag-aaral tungkol sa kanilang paglalakbay sa Solana.
3. Gumawa ng static na paraan sa `StudentIntro.ts` na gagamit ng buffer layout upang i-deserialize ang buffer ng data ng account sa isang object na `StudentIntro`.
4. Sa `useEffect` ng component ng `StudentIntroList`, kunin ang mga account ng program at i-deserialize ang kanilang data sa isang listahan ng mga object ng `StudentIntro`.
5. Sa halip na mock data, dapat ay nakikita mo na ngayon ang mga pagpapakilala ng mag-aaral mula sa network!

Kung talagang nalilito ka, huwag mag-atubiling [tingnan ang code ng solusyon](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-deserialize-account-data).

Gaya ng nakasanayan, maging malikhain sa mga hamong ito at dalhin ang mga ito nang higit sa mga tagubilin kung gusto mo!

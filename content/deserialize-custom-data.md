---
title: Deserialize Custom Account Data
objectives:
- Explain Program Derived Accounts
- Derive PDAs given specific seeds
- Fetch a program’s accounts
- Use Borsh to deserialize custom data
---

# TL;DR

- **Program Derived Addresses**, o PDAs, ay mga address na walang kaukulang pribadong key. Ang konsepto ng mga PDA ay nagbibigay-daan para sa mga programa na mag-sign para sa mga transaksyon mismo at nagbibigay-daan para sa pag-iimbak at paghahanap ng data.
- Maaari kang kumuha ng PDA gamit ang `findProgramAddress(seeds, programid)` na paraan.
- Maaari kang makakuha ng hanay ng lahat ng mga account na kabilang sa isang program gamit ang `getProgramAccounts(programId)`.
- Kailangang ma-deserialize ang data ng account gamit ang parehong layout na ginamit upang iimbak ito sa unang lugar. Maaari mong gamitin ang `@project-serum/borsh` para gumawa ng schema.

# Pangkalahatang-ideya

Sa huling aralin, nag-serialize kami ng custom na data ng pagtuturo na pagkatapos ay inimbak on-chain ng isang Solana program. Sa araling ito, tatalakayin natin nang mas detalyado kung paano ginagamit ng mga program ang mga account, kung paano kunin ang mga ito, at kung paano i-deserialize ang data na iniimbak nila.

## Mga Programa

Gaya nga ng kasabihan, lahat ng nasa Solana ay isang account. Kahit na mga programa. Ang mga programa ay mga account na nag-iimbak ng code at minarkahan bilang executable. Ang code na ito ay maaaring isagawa ng Solana runtime kapag inutusang gawin ito.

Ang mga programa mismo, gayunpaman, ay walang estado. Hindi nila maaaring baguhin ang data sa loob ng kanilang account. Maaari lamang silang magpatuloy sa estado sa pamamagitan ng pag-iimbak ng data sa iba pang mga account na maaaring i-reference sa ibang pagkakataon. Ang pag-unawa sa kung paano ginagamit ang mga account na ito at kung paano hanapin ang mga ito ay mahalaga sa client-side na pagbuo ng Solana.

### PDA

Ang PDA ay nangangahulugang Program Derived Address. Gaya ng ipinahihiwatig ng pangalan, ito ay tumutukoy sa isang address (public key) na nagmula sa isang programa at ilang mga buto. Sa nakaraang aralin, tinalakay natin ang mga pampubliko/pribadong susi at kung paano ginagamit ang mga ito sa Solana. Hindi tulad ng keypair, ang isang PDA *walang* ay may kaukulang pribadong key. Ang layunin ng isang PDA ay lumikha ng isang address na maaaring lagdaan ng isang programa sa parehong paraan na maaaring mag-sign ang isang user para sa isang transaksyon gamit ang kanilang wallet.

Kapag nagsumite ka ng transaksyon sa isang program at inaasahan na ang program ay mag-a-update ng estado o mag-imbak ng data sa ilang paraan, ang program na iyon ay gumagamit ng isa o higit pang mga PDA. Mahalaga itong maunawaan kapag bumubuo ng panig ng kliyente para sa dalawang dahilan:

1. Kapag nagsusumite ng transaksyon sa isang programa, kailangang isama ng kliyente ang lahat ng address para sa mga account na susulatan o babasahin. Nangangahulugan ito na hindi tulad ng mas tradisyonal na mga arkitektura ng client-server, ang kliyente ay kailangang magkaroon ng kaalaman na partikular sa pagpapatupad tungkol sa programang Solana. Kailangang malaman ng kliyente kung aling PDA ang gagamitin upang mag-imbak ng data upang maisama nito ang address na iyon sa transaksyon.
2. Katulad nito, kapag nagbabasa ng data mula sa isang programa, kailangang malaman ng kliyente kung aling (mga) account ang babasahin.

### Paghahanap ng mga PDA

Ang mga PDA ay hindi teknikal na nilikha. Sa halip, ang mga ito ay *hinahanap* o *hinango* batay sa isa o higit pang mga input seed.

Ang mga regular na keypair ng Solana ay nasa ed2559 Elliptic Curve. Tinitiyak ng cryptographic function na ito na ang bawat punto sa kahabaan ng curve ay may katumbas na punto sa ibang lugar sa curve, na nagbibigay-daan para sa mga pampubliko/pribadong key. Ang mga PDA ay mga address na nasa *off* ang ed2559 Elliptic curve at samakatuwid ay hindi maaaring lagdaan ng isang pribadong key (dahil walang isa). Tinitiyak nito na ang programa ay ang tanging wastong lumagda para sa address na iyon.

Upang makahanap ng pampublikong key na hindi nasa curve ng ed2559, ang program ID at mga buto na pinili ng developer (tulad ng isang string ng text) ay ipinapasa sa function na [`findProgramAddress(seeds, programid)`](https://solana-labs.github.io/solana-web3.js/classes/PublicKey.html#findProgramAddress). Pinagsasama ng function na ito ang program ID, mga buto, at isang bump seed sa isang buffer at ipinapasa ito sa isang SHA256 hash upang makita kung ang resultang address ay nasa curve o hindi. Kung ang address ay nasa curve (~50% na pagkakataon), ang bump seed ay binabawasan ng 1 at ang address ay kinakalkula muli. Ang bump seed ay nagsisimula sa 255 at unti-unting umuulit pababa sa `bump = 254`, `bump = 253`, atbp. hanggang sa makita ang isang address na may mga ibinigay na seeds at bump na hindi matatagpuan sa ed2559 curve. Ibinabalik ng function na `findProgramAddress` ang resultang address at ang bump na ginamit upang maalis ito sa curve. Sa ganitong paraan, maaaring mabuo ang address kahit saan hangga't mayroon kang bump at buto.

![Screenshot ng ed2559 curve](../assets/ed2559-curve.png)

Ang mga PDA ay isang natatanging konsepto at isa sa mga pinakamahirap na bahagi ng pagbuo ng Solana na maunawaan. Kung hindi mo makuha ito kaagad, huwag mag-alala. Mas magiging makabuluhan ito kapag nagsasanay ka.

### Bakit Ito Mahalaga?

Ang derivation ng mga PDA ay mahalaga dahil ang mga buto na ginamit upang mahanap ang isang PDA ay ang ginagamit namin upang mahanap ang data. Halimbawa, ang isang simpleng program na gumagamit lamang ng isang PDA upang mag-imbak ng pandaigdigang estado ng programa ay maaaring gumamit ng isang simpleng seed na parirala tulad ng "GLOBAL_STATE". Kung gusto ng kliyente na basahin ang data mula sa PDA na ito, maaari nitong makuha ang address gamit ang program ID at ang parehong binhi.

```tsx
const [pda, bump] = await findProgramAddress(Buffer.from("GLOBAL_STATE"), programId)
```

Sa mas kumplikadong mga program na nag-iimbak ng data na partikular sa user, karaniwan nang gamitin ang pampublikong key ng user bilang seed. Pinaghihiwalay nito ang data ng bawat user sa sarili nitong PDA. Ang paghihiwalay ay ginagawang posible para sa kliyente na mahanap ang data ng bawat user sa pamamagitan ng paghahanap ng address gamit ang program ID at pampublikong key ng user.

```tsx
const [pda, bump] = await web3.PublicKey.findProgramAddress(
	[
		publicKey.toBuffer()
	],
	programId
)
```

Gayundin, kapag mayroong maramihang mga account sa bawat user, maaaring gumamit ang isang program ng isa o higit pang karagdagang mga binhi upang lumikha at tumukoy ng mga account. Halimbawa, sa isang note-taking app ay maaaring mayroong isang account sa bawat tala kung saan ang bawat PDA ay hinango kasama ang pampublikong key ng user at ang pamagat ng tala.

```tsx
const [pda, bump] = await web3.PublicKey.findProgramAddress(
	[
		publicKey.toBuffer(),
		Buffer.from('First Note')
	],
	programId
)
```

### Pagkuha ng Maramihang Programa Accounts

Bilang karagdagan sa pagkuha ng mga address, maaari mong kunin ang lahat ng account na ginawa ng isang program gamit ang `connection.getProgramAccounts(programId)`. Nagbabalik ito ng hanay ng mga bagay kung saan ang bawat bagay ay may `pubkey` na property na kumakatawan sa pampublikong key ng account at isang `account` na property na may uri ng `AccountInfo`. Maaari mong gamitin ang property na `account` para makuha ang data ng account.

```tsx
const accounts = connection.getProgramAccounts(programId).then(accounts => {
	accounts.map(({ pubkey, account }) => {
		console.log('Account:', pubkey)
		console.log('Data buffer:', account.data)
	})
})
```

## Deserializing data ng custom na account

Ang property na `data` sa isang object na `AccountInfo` ay isang buffer. Upang magamit ito nang mahusay, kakailanganin mong magsulat ng code na nagde-deserialize nito sa isang bagay na mas magagamit. Ito ay katulad ng proseso ng serialization na aming tinalakay noong nakaraang aralin. Gaya ng dati, gagamitin namin ang [Borsh](https://borsh.io/) at `@project-serum/borsh`. Kung kailangan mo ng refresher sa alinman sa mga ito, tingnan ang nakaraang aralin.

Ang deserializing ay nangangailangan ng kaalaman sa layout ng account nang maaga. Kapag gumagawa ng sarili mong mga programa, tutukuyin mo kung paano ito ginagawa bilang bahagi ng prosesong iyon. Maraming mga programa ang mayroon ding dokumentasyon kung paano i-deserialize ang data ng account. Kung hindi, kung magagamit ang program code maaari mong tingnan ang pinagmulan at tukuyin ang istraktura sa ganoong paraan.

Upang maayos na i-deserialize ang data mula sa isang on-chain na program, kakailanganin mong gumawa ng schema sa panig ng kliyente na sumasalamin kung paano iniimbak ang data sa account. Halimbawa, ang sumusunod ay maaaring ang schema para sa isang account na nag-iimbak ng metadata tungkol sa isang manlalaro sa isang on-chain na laro.

```tsx
import * as borsh from "@project-serum/borsh";

borshAccountSchema = borsh.struct([
	borsh.bool('initialized'),
	borsh.u16('playerId'),
	borsh.str('name')
])
```

Kapag natukoy mo na ang iyong layout, tawagan lang ang `.decode(buffer)` sa schema.

```tsx
import * as borsh from "@project-serum/borsh";

borshAccountSchema = borsh.struct([
	borsh.bool('initialized'),
	borsh.u16('playerId'),
	borsh.str('name')
])

const { playerId, name } = borshAccountSchema.decode(buffer)
```

# Demo

Sanayin natin ito nang magkasama sa pamamagitan ng patuloy na paggawa sa Movie Review app mula sa huling aralin. Huwag mag-alala kung papasok ka lang sa araling ito - dapat na posible na sundin ang alinmang paraan.

Bilang isang refresher, ang proyektong ito ay gumagamit ng isang Solana program na naka-deploy sa Devnet na nagbibigay-daan sa mga user na magsuri ng mga pelikula. Noong nakaraang aralin, nagdagdag kami ng functionality sa frontend skeleton na nagpapahintulot sa mga user na magsumite ng mga review ng pelikula ngunit ang listahan ng mga review ay nagpapakita pa rin ng mock data. Ayusin natin iyon sa pamamagitan ng pagkuha sa mga storage account ng program at pag-deserialize ng data na nakaimbak doon.

![Screenshot ng frontend ng pagsusuri ng pelikula](../assets/movie-reviews-frontend.png)

### 1. I-download ang starter code

Kung hindi mo nakumpleto ang demo mula sa huling aralin o gusto mo lang matiyak na wala kang napalampas, maaari mong i-download ang [starter code](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-serialize-instruction-data).

Ang proyekto ay isang medyo simpleng Next.js application. Kabilang dito ang `WalletContextProvider` na ginawa namin sa aralin sa Wallets, isang bahagi ng `Card` para sa pagpapakita ng pagsusuri sa pelikula, isang bahagi ng `MovieList` na nagpapakita ng mga review sa isang listahan, isang bahagi ng `Form` para sa pagsusumite ng bagong review, at isang ` Movie.ts` file na naglalaman ng kahulugan ng klase para sa object na `Movie`.

Tandaan na kapag nagpatakbo ka ng `npm run dev`, ang mga review na ipinapakita sa page ay mga pangungutya. Papalitan namin ang mga iyon para sa totoong deal.

### 2. Lumikha ng buffer layout

Tandaan na upang maayos na makipag-ugnayan sa isang Solana program, kailangan mong malaman kung paano nakaayos ang data nito.

Ang programa ng Pagsusuri ng Pelikula ay gumagawa ng isang hiwalay na account para sa bawat pagsusuri ng pelikula at iniimbak ang sumusunod na data sa `data` ng account:

1. `nasimulan` bilang isang boolean na kumakatawan sa kung ang account ay nasimulan o hindi.
2. `rating` bilang unsigned, 8-bit integer na kumakatawan sa rating sa 5 na ibinigay ng reviewer sa pelikula.
3. `title` bilang isang string na kumakatawan sa pamagat ng sinuri na pelikula.
4. `paglalarawan` bilang isang string na kumakatawan sa nakasulat na bahagi ng pagsusuri.

Mag-configure tayo ng layout ng `borsh` sa klase ng `Movie` upang kumatawan sa layout ng data ng account ng movie. Magsimula sa pamamagitan ng pag-import ng `@project-serum/borsh`. Susunod, gumawa ng `borshAccountSchema` na static na property at itakda ito sa naaangkop na `borsh` struct na naglalaman ng mga property na nakalista sa itaas.

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

Tandaan, ang order dito *mahalaga*. Kailangan itong tumugma sa kung paano nakaayos ang data ng account.

### 3. Gumawa ng paraan para i-deserialize ang data

Ngayong na-set up na natin ang buffer layout, gumawa tayo ng static na paraan sa `Pelikula` na tinatawag na `deserialize` na kukuha ng opsyonal na `Buffer` at magbabalik ng `Movie` object o `null`.

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

Sinusuri muna ng pamamaraan kung mayroon o wala ang buffer at ibabalik ang `null` kung wala ito. Susunod, ginagamit nito ang layout na ginawa namin upang i-decode ang buffer, pagkatapos ay ginagamit ang data upang bumuo at magbalik ng isang instance ng `Pelikula`. Kung nabigo ang pag-decode, itatala ng pamamaraan ang error at ibabalik ang `null`.

### 4. Kunin ang mga account sa pagsusuri ng pelikula

Ngayong mayroon na tayong paraan para i-deserialize ang data ng account, kailangan talaga nating kunin ang mga account. Buksan ang `MovieList.tsx` at i-import ang `@solana/web3.js`. Pagkatapos, gumawa ng bagong `Koneksyon` sa loob ng bahagi ng `MovieList`. Panghuli, palitan ang linyang `setMovies(Movie.mocks)` sa loob ng `useEffect` ng isang tawag sa `connection.getProgramAccounts`. Kunin ang resultang array at i-convert ito sa hanay ng mga pelikula at tawagan ang `setMovies`.

```tsx
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

# Hamon

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa. Noong nakaraang aralin, nagtrabaho ka sa Student Intros app para i-serialize ang data ng pagtuturo at magpadala ng bagong intro sa network. Ngayon, oras na para kunin at i-deserialize ang data ng account ng program. Tandaan, ang programang Solana na sumusuporta dito ay nasa `HdE95RSVsdb315jfJtaykXhXY478h53X6okDupVfY9yf`.

![Screenshot ng Student Intros frontend](../assets/student-intros-frontend.png)

1. Maaari mong buuin ito mula sa simula o maaari mong i-download ang starter code [dito](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data).
2. Gawin ang layout ng buffer ng account sa `StudentIntro.ts`. Ang data ng account ay naglalaman ng:
    1. `pinasimulan` bilang isang unsigned, 8-bit integer na kumakatawan sa pagtuturo na tumakbo (dapat ay 1).
    2. `pangalan` bilang isang string na kumakatawan sa pangalan ng mag-aaral.
    3. `mensahe` bilang isang string na kumakatawan sa mensaheng ibinahagi ng mag-aaral tungkol sa kanilang paglalakbay sa Solana.
3. Gumawa ng static na paraan sa `StudentIntro.ts` na gagamit ng buffer layout upang i-deserialize ang buffer ng data ng account sa isang object na `StudentIntro`.
4. Sa `useEffect` ng component ng `StudentIntroList`, kunin ang mga account ng program at i-deserialize ang kanilang data sa isang listahan ng mga object ng `StudentIntro`.
5. Sa halip na mock data, dapat ay nakikita mo na ngayon ang mga pagpapakilala ng mag-aaral mula sa network!

Kung talagang nalilito ka, huwag mag-atubiling tingnan ang code ng solusyon [dito](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-deserialize-account-data).

Gaya ng dati, maging malikhain sa mga hamong ito at dalhin ang mga ito sa kabila ng mga tagubilin kung gusto mo!
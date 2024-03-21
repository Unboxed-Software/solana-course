---
title: Page, Order, and Filter Program Data
objectives:
- Mga page, order, at filter na mga account
- I-prefetch ang mga account na walang data
- Tukuyin kung saan nakaimbak ang partikular na data sa buffer layout ng isang account
- I-prefetch ang mga account na may subset ng data na magagamit para mag-order ng mga account
- Kunin lamang ang mga account na ang data ay tumutugma sa mga partikular na pamantayan
- Kumuha ng subset ng kabuuang mga account gamit ang `getMultipleAccounts`
---

# TL;DR

- Ang araling ito ay sumasalamin sa ilang functionality ng mga RPC na tawag na ginamit namin sa deserializing account data lesson
- Upang makatipid sa oras ng pagkalkula, maaari kang kumuha ng malaking bilang ng mga account nang wala ang kanilang data sa pamamagitan ng pag-filter sa mga ito upang magbalik lamang ng hanay ng mga pampublikong key
- Kapag mayroon ka nang na-filter na listahan ng mga pampublikong key, maaari mong i-order ang mga ito at kunin ang data ng account na kinabibilangan nila

# Lesson

Maaaring napansin mo sa huling aralin na habang maaari kaming kumuha at magpakita ng listahan ng data ng account, wala kaming anumang butil na kontrol sa kung ilang account ang kukunin o ang kanilang order. Sa araling ito, malalaman natin ang tungkol sa ilang opsyon sa configuration para sa function na `getProgramAccounts` na magbibigay-daan sa mga bagay tulad ng paging, pag-order ng mga account, at pag-filter.

## Use `dataSlice` to only fetch data you need

Isipin ang Movie Review app na ginawa namin sa mga nakaraang aralin na mayroong apat na milyong review ng pelikula at ang average na pagsusuri ay 500 bytes. Iyon ay magiging lampas sa 2GB ang kabuuang pag-download para sa lahat ng review account. Talagang hindi isang bagay na gusto mong i-download ang iyong frontend sa tuwing nagre-refresh ang page.

Sa kabutihang palad, ang function na `getProgramAccounts` na ginagamit mo para makuha ang lahat ng account ay kumukuha ng configuration object bilang argumento. Ang isa sa mga opsyon sa pagsasaayos ay `dataSlice` na nagbibigay-daan sa iyong magbigay ng dalawang bagay:

- `offset` - ang offset mula sa simula ng buffer ng data upang simulan ang slice
- `length` - ang bilang ng mga byte na ibabalik, simula sa ibinigay na offset

Kapag nagsama ka ng `dataSlice` sa configuration object, ibabalik lang ng function ang subset ng data buffer na iyong tinukoy.

### Paging Accounts

Ang isang lugar na ito ay nagiging kapaki-pakinabang ay ang paging. Kung gusto mong magkaroon ng listahan na nagpapakita ng lahat ng account ngunit napakaraming account na hindi mo nais na hilahin ang lahat ng data nang sabay-sabay, maaari mong kunin ang lahat ng account ngunit hindi kunin ang kanilang data sa pamamagitan ng paggamit ng `dataSlice` ng `{ offset: 0, haba: 0 }`. Pagkatapos ay maaari mong imapa ang resulta sa isang listahan ng mga account key na ang data ay maaari mo lamang makuha kapag kinakailangan.

```tsx
const accountsWithoutData = await connection.getProgramAccounts(
  programId,
  {
    dataSlice: { offset: 0, length: 0 }
  }
)

const accountKeys = accountsWithoutData.map(account => account.pubkey)
```

Gamit ang listahan ng mga key na ito, maaari mong kunin ang data ng account sa “mga pahina” gamit ang pamamaraang `getMultipleAccountsInfo`:

```tsx
const paginatedKeys = accountKeys.slice(0, 10)
const accountInfos = await connection.getMultipleAccountsInfo(paginatedKeys)
const deserializedObjects = accountInfos.map((accountInfo) => {
  // put logic to deserialize accountInfo.data here
})
```

### Ordering Accounts

Nakakatulong din ang opsyong `dataSlice` kapag kailangan mong mag-order ng listahan ng mga account habang nag-paging. Hindi mo pa rin gustong kunin ang lahat ng data nang sabay-sabay, ngunit kailangan mo ang lahat ng mga susi at isang paraan upang mai-order ang mga ito nang maaga. Sa kasong ito, kailangan mong maunawaan ang layout ng data ng account at i-configure ang data slice upang maging data lang na kailangan mong gamitin para sa pag-order.

Halimbawa, maaaring mayroon kang account na nag-iimbak ng impormasyon sa pakikipag-ugnayan tulad nito:

- `pinasimulan` bilang isang boolean
- `phoneNumber` bilang isang unsigned, 64-bit integer
- `firstName` bilang isang string
- `secondName` bilang isang string

Kung gusto mong i-order ang lahat ng mga key ng account ayon sa alpabeto batay sa pangalan ng user, kailangan mong malaman ang offset kung saan nagsisimula ang pangalan. Ang unang field, `na-initialize`, ay kukuha ng unang byte, pagkatapos ang `phoneNumber` ay kukuha ng isa pang 8, kaya ang `firstName` na field ay magsisimula sa offset `1 + 8 = 9`. Gayunpaman, ginagamit ng mga dynamic na field ng data sa borsh ang unang 4 na byte upang i-record ang haba ng data, kaya maaari naming laktawan ang karagdagang 4 na byte, na ginagawang 13 ang offset.

Pagkatapos ay kailangan mong tukuyin ang haba upang gawin ang data slice. Dahil variable ang haba, hindi namin matiyak bago kunin ang data. Ngunit maaari kang pumili ng haba na sapat na malaki upang masakop ang karamihan ng mga kaso at sapat na maikli upang hindi masyadong pabigat na kunin. Ang 15 bytes ay marami para sa karamihan ng mga unang pangalan, ngunit magreresulta sa isang maliit na sapat na pag-download kahit na may isang milyong mga gumagamit.

Kapag nakakuha ka na ng mga account na may ibinigay na data slice, maaari mong gamitin ang `sort` na paraan upang pag-uri-uriin ang array bago ito i-map sa isang array ng mga pampublikong key.

```tsx
const accounts = await connection.getProgramAccounts(
  programId,
  {
    dataSlice: { offset: 13, length: 15 }
  }
)

  accounts.sort( (a, b) => {
    const lengthA = a.account.data.readUInt32LE(0)
    const lengthB = b.account.data.readUInt32LE(0)
    const dataA = a.account.data.slice(4, 4 + lengthA)
    const dataB = b.account.data.slice(4, 4 + lengthB)
    return dataA.compare(dataB)
  })

const accountKeys = accounts.map(account => account.pubkey)
```

Tandaan na sa snippet sa itaas hindi namin inihahambing ang data gaya ng ibinigay. Ito ay dahil para sa mga uri ng dynamic na laki tulad ng mga string, naglalagay si Borsh ng isang unsigned, 32-bit (4 byte) na integer sa simula upang isaad ang haba ng data na kumakatawan sa field na iyon. Kaya para direktang ikumpara ang mga unang pangalan, kailangan nating makuha ang haba para sa bawat isa, pagkatapos ay gumawa ng data slice na may 4 byte offset at tamang haba.

## Use `filters` to only retrieve specific accounts

Mahusay ang paglilimita sa data na natatanggap sa bawat account, ngunit paano kung gusto mo lang ibalik ang mga account na tumutugma sa isang partikular na pamantayan sa halip na lahat ng mga ito? Doon papasok ang opsyon sa pagsasaayos ng `filters`. Ang opsyong ito ay isang array na maaaring magkaroon ng mga bagay na tumutugma sa sumusunod:

- `memcmp` - naghahambing ng ibinigay na serye ng mga byte sa data ng program account sa isang partikular na offset. Mga patlang:
     - `offset` - ang numerong i-offset sa data ng account ng program bago magkumpara ng data
     - `bytes` - isang base-58 na naka-encode na string na kumakatawan sa data na tutugma; limitado sa mas mababa sa 129 bytes
- `dataSize` - inihahambing ang haba ng data ng program account sa ibinigay na laki ng data

Hinahayaan ka nitong mag-filter batay sa tumutugmang data at/o kabuuang laki ng data.

Halimbawa, maaari kang maghanap sa isang listahan ng mga contact sa pamamagitan ng pagsasama ng filter na `memcmp`:

```tsx
async function fetchMatchingContactAccounts(connection: web3.Connection, search: string): Promise<(web3.AccountInfo<Buffer> | null)[]> {
  const accounts = await connection.getProgramAccounts(
    programId,
    {
      dataSlice: { offset: 0, length: 0 },
      filters: [
        {
          memcmp:
            {
              offset: 13,
              bytes: bs58.encode(Buffer.from(search))
            }
        }
      ]
    }
  )
}
```

Dalawang bagay na dapat tandaan sa halimbawa sa itaas:

1. Itinatakda namin ang offset sa 13 dahil natukoy namin dati na ang offset para sa `firstName` sa layout ng data ay 9 at gusto naming laktawan ang unang 4 na byte na nagsasaad ng haba ng string.
2. Gumagamit kami ng third party na library na `bs58` para magsagawa ng base-58 encoding sa termino para sa paghahanap. Maaari mo itong i-install gamit ang `npm install bs58`.

# Demo

Tandaan ang Movie Review app na ginawa namin sa huling dalawang aralin? Papagandahin namin ito nang kaunti sa pamamagitan ng paging sa listahan ng pagsusuri, pag-order ng mga review para hindi sila random, at pagdaragdag ng ilang pangunahing functionality sa paghahanap. Huwag mag-alala kung papasok ka lang sa araling ito nang hindi tinitingnan ang mga nauna - hangga't mayroon kang kinakailangang kaalaman, dapat mong sundin ang demo nang hindi pa nagtatrabaho sa partikular na proyektong ito.

![Screenshot of movie review frontend](../../assets/movie-reviews-frontend.png)

### **1. Download the starter code**

Kung hindi mo nakumpleto ang demo mula sa huling aralin o gusto mo lang matiyak na wala kang napalampas, maaari mong i-download ang [starter code](https://github.com/Unboxed-Software/solana-movie -frontend/tree/solution-deserialize-account-data).

Ang proyekto ay isang medyo simpleng Next.js application. Kabilang dito ang `WalletContextProvider` na ginawa namin sa aralin sa Wallets, isang bahagi ng `Card` para sa pagpapakita ng pagsusuri sa pelikula, isang bahagi ng `MovieList` na nagpapakita ng mga review sa isang listahan, isang bahagi ng `Form` para sa pagsusumite ng bagong review, at isang ` Movie.ts` file na naglalaman ng kahulugan ng klase para sa object na `Movie`.

### 2. Add paging to the reviews
Una sa lahat, gumawa tayo ng puwang para i-encapsulate ang code para sa pagkuha ng data ng account. Gumawa ng bagong file na `MovieCoordinator.ts` at magdeklara ng klase ng `MovieCoordinator`. Pagkatapos ay ilipat natin ang pare-parehong `MOVIE_REVIEW_PROGRAM_ID` mula sa `MovieList` papunta sa bagong file na ito dahil ililipat natin ang lahat ng reference dito

```tsx
const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export class MovieCoordinator { }
```

Ngayon ay magagamit na natin ang `MovieCoordinator` para gumawa ng pagpapatupad ng paging. Isang mabilis na paalala bago tayo sumisid: ito ay magiging kasing simple ng pagpapatupad ng paging hangga't maaari para makapag-focus tayo sa kumplikadong bahagi ng pakikipag-ugnayan sa mga Solana account. Maaari kang, at dapat, gumawa ng mas mahusay para sa isang application sa produksyon.

Kapag wala na iyon, gumawa tayo ng static na property na `accounts` na may uri na `web3.PublicKey[]`, isang static na function na `prefetchAccounts(koneksyon: web3.Connection)`, at isang static na function na `fetchPage(koneksyon: web3. Koneksyon, page: number, perPage: number): Promise<Movie[]>`. Kakailanganin mo ring mag-import ng `@solana/web3.js` at `Pelikula`.

```tsx
import * as web3 from '@solana/web3.js'
import { Movie } from '../models/Movie'

const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export class MovieCoordinator {
  static accounts: web3.PublicKey[] = []

  static async prefetchAccounts(connection: web3.Connection) {

  }

  static async fetchPage(connection: web3.Connection, page: number, perPage: number): Promise<Movie[]> {

  }
}
```

Ang susi sa paging ay i-prefetch ang lahat ng account na walang data. Punan natin ang katawan ng `prefetchAccounts` para gawin ito at itakda ang mga nakuhang pampublikong key sa static na `accounts` na property.

```tsx
static async prefetchAccounts(connection: web3.Connection) {
  const accounts = await connection.getProgramAccounts(
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
    {
      dataSlice: { offset: 0, length: 0 },
    }
  )

  this.accounts = accounts.map(account => account.pubkey)
}
```

Ngayon, punan natin ang paraan ng `fetchPage`. Una, kung hindi pa na-prefetch ang mga account, kakailanganin naming gawin iyon. Pagkatapos, maaari naming makuha ang mga pampublikong key ng account na tumutugma sa hiniling na pahina at tumawag sa `connection.getMultipleAccountsInfo`. Panghuli, inaalis namin ang serialize ng data ng account at ibinabalik ang mga katumbas na bagay na `Pelikula`.

```tsx
static async fetchPage(connection: web3.Connection, page: number, perPage: number): Promise<Movie[]> {
  if (this.accounts.length === 0) {
    await this.prefetchAccounts(connection)
  }

  const paginatedPublicKeys = this.accounts.slice(
    (page - 1) * perPage,
    page * perPage,
  )

  if (paginatedPublicKeys.length === 0) {
    return []
  }

  const accounts = await connection.getMultipleAccountsInfo(paginatedPublicKeys)

  const movies = accounts.reduce((accum: Movie[], account) => {
    const movie = Movie.deserialize(account?.data)
    if (!movie) {
      return accum
    }

    return [...accum, movie]
  }, [])

  return movies
}
```

Kapag tapos na iyon, maaari naming muling i-configure ang `MovieList` upang magamit ang mga pamamaraang ito. Sa `MovieList.tsx`, idagdag ang `const [page, setPage] = useState(1)` malapit sa mga kasalukuyang tawag na `useState`. Pagkatapos, i-update ang `useEffect` para tawagan ang `MovieCoordinator.fetchPage` sa halip na kunin ang mga account na inline.

```tsx
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
const [movies, setMovies] = useState<Movie[]>([])
const [page, setPage] = useState(1)

useEffect(() => {
  MovieCoordinator.fetchPage(
    connection,
    page,
    10
  ).then(setMovies)
}, [page, search])
```

Panghuli, kailangan naming magdagdag ng mga pindutan sa ibaba ng listahan para sa pag-navigate sa iba't ibang mga pahina:

```tsx
return (
  <div>
    {
      movies.map((movie, i) => <Card key={i} movie={movie} /> )
    }
    <Center>
      <HStack w='full' mt={2} mb={8} ml={4} mr={4}>
        {
          page > 1 && <Button onClick={() => setPage(page - 1)}>Previous</Button>
        }
        <Spacer />
        {
          MovieCoordinator.accounts.length > page * 2 &&
            <Button onClick={() => setPage(page + 1)}>Next</Button>
        }
      </HStack>
    </Center>
  </div>
)
```

Sa puntong ito, dapat mong patakbuhin ang proyekto at mag-click sa pagitan ng mga pahina!

### 3. Order reviews alphabetically by title

Kung titingnan mo ang mga review, maaaring mapansin mong wala sila sa anumang partikular na pagkakasunud-sunod. Maaayos namin ito sa pamamagitan ng pagdaragdag lamang ng sapat na data sa aming data slice upang matulungan kaming gumawa ng ilang pag-uuri. Ang iba't ibang katangian sa buffer ng data ng pagsusuri ng pelikula ay inilatag tulad ng sumusunod

- `nasimulan` - unsigned 8-bit integer; 1 byte
- `rating` - unsigned 8-bit integer; 1 byte
- `title` - string; hindi kilalang bilang ng mga byte
- `paglalarawan` - string; hindi kilalang bilang ng mga byte

Batay dito, ang offset na kailangan naming ibigay sa data slice para ma-access ang `title` ay 2. Ang haba, gayunpaman, ay hindi tiyak, kaya maaari lang naming ibigay ang tila makatwirang haba. Mananatili ako sa 18 dahil sasakupin nito ang haba ng karamihan sa mga pamagat nang hindi kumukuha ng masyadong maraming data sa bawat oras.

Kapag nabago na namin ang data slice sa `getProgramAccounts`, kailangan naming aktwal na ayusin ang ibinalik na array. Para magawa ito, kailangan nating ihambing ang bahagi ng buffer ng data na aktwal na tumutugma sa `title`. Ang unang 4 na byte ng isang dynamic na field sa Borsh ay ginagamit upang iimbak ang haba ng field sa mga byte. Kaya sa anumang ibinigay na buffer `data` na hiniwa sa paraang tinalakay namin sa itaas, ang string na bahagi ay `data.slice(4, 4 + data[0])`.

Ngayong napag-isipan na natin ito, baguhin natin ang pagpapatupad ng `prefetchAccounts` sa `MovieCoordinator`:

```tsx
static async prefetchAccounts(connection: web3.Connection, filters: AccountFilter[]) {
  const accounts = await connection.getProgramAccounts(
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
    {
      dataSlice: { offset: 2, length: 18 },
    }
  )

  accounts.sort( (a, b) => {
    const lengthA = a.account.data.readUInt32LE(0)
    const lengthB = b.account.data.readUInt32LE(0)
    const dataA = a.account.data.slice(4, 4 + lengthA)
    const dataB = b.account.data.slice(4, 4 + lengthB)
    return dataA.compare(dataB)
  })

  this.accounts = accounts.map(account => account.pubkey)
}
```

At tulad niyan, magagawa mong patakbuhin ang app at makita ang listahan ng mga review ng pelikula na nakaayos ayon sa alpabeto.

### 4. Add search

Ang huling bagay na gagawin namin para mapahusay ang app na ito ay magdagdag ng ilang pangunahing kakayahan sa paghahanap. Magdagdag tayo ng parameter na `search` sa `prefetchAccounts` at i-configure muli ang body ng function para magamit ito.

Magagamit namin ang property na `filters` ng parameter na `config` ng `getProgramAccounts` upang i-filter ang mga account ayon sa partikular na data. Ang offset sa mga field na `title` ay 2, ngunit ang unang 4 na byte ay ang haba ng title kaya ang aktwal na offset sa string mismo ay 6. Tandaan na ang mga byte ay kailangang base 58 na naka-encode, kaya't i-install at i-import natin ` bs58`.

```tsx
import bs58 from 'bs58'

...

static async prefetchAccounts(connection: web3.Connection, search: string) {
  const accounts = await connection.getProgramAccounts(
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
    {
      dataSlice: { offset: 2, length: 18 },
      filters: search === '' ? [] : [
        {
          memcmp:
            {
              offset: 6,
              bytes: bs58.encode(Buffer.from(search))
            }
        }
      ]
    }
  )

  accounts.sort( (a, b) => {
    const lengthA = a.account.data.readUInt32LE(0)
    const lengthB = b.account.data.readUInt32LE(0)
    const dataA = a.account.data.slice(4, 4 + lengthA)
    const dataB = b.account.data.slice(4, 4 + lengthB)
    return dataA.compare(dataB)
  })

  this.accounts = accounts.map(account => account.pubkey)
}
```

Ngayon, magdagdag ng parameter ng `search` sa `fetchPage` at i-update ang tawag nito sa `prefetchAccounts` upang maipasa ito. Kakailanganin din naming magdagdag ng `reload` na boolean na parameter sa `fetchPage` nang sa gayon ay maaari naming pilitin ang pag-refresh ng prefetching ng account sa tuwing nagbabago ang halaga ng paghahanap.

```tsx
static async fetchPage(connection: web3.Connection, page: number, perPage: number, search: string, reload: boolean = false): Promise<Movie[]> {
  if (this.accounts.length === 0 || reload) {
    await this.prefetchAccounts(connection, search)
  }

  const paginatedPublicKeys = this.accounts.slice(
    (page - 1) * perPage,
    page * perPage,
  )

  if (paginatedPublicKeys.length === 0) {
    return []
  }

  const accounts = await connection.getMultipleAccountsInfo(paginatedPublicKeys)

  const movies = accounts.reduce((accum: Movie[], account) => {
    const movie = Movie.deserialize(account?.data)
    if (!movie) {
      return accum
    }

    return [...accum, movie]
  }, [])

  return movies
}
```

Kapag nakalagay iyon, i-update natin ang code sa `MovieList` para matawag ito nang maayos.

Una, idagdag ang `const [search, setSearch] = useState('')` malapit sa iba pang `useState` na tawag. Pagkatapos ay i-update ang tawag sa `MovieCoordinator.fetchPage` sa `useEffect` para ipasa ang parameter na `search` at i-reload kapag `search !== ''`.

```tsx
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
const [movies, setMovies] = useState<Movie[]>([])
const [page, setPage] = useState(1)
const [search, setSearch] = useState('')

useEffect(() => {
  MovieCoordinator.fetchPage(
    connection,
    page,
    2,
    search,
    search !== ''
  ).then(setMovies)
}, [page, search])
```

Panghuli, magdagdag ng search bar na magtatakda ng halaga ng `search`:

```tsx
return (
  <div>
    <Center>
      <Input
        id='search'
        color='gray.400'
        onChange={event => setSearch(event.currentTarget.value)}
        placeholder='Search'
        w='97%'
        mt={2}
        mb={2}
      />
    </Center>

  ...

  </div>
)
```

At iyon na! Ang app ay nag-order na ngayon ng mga review, paging, at paghahanap.

Napakaraming dapat tunawin, ngunit nagtagumpay ka. Kung kailangan mong gumugol ng mas maraming oras sa mga konsepto, huwag mag-atubiling basahin muli ang mga seksyong pinakahamong para sa iyo at/o tingnan ang [code ng solusyon](https://github.com/Unboxed-Software/solana -movie-frontend/tree/solution-paging-account-data).

# Challenge

Ngayon ay iyong pagkakataon na subukan at gawin ito nang mag-isa. Gamit ang Student Intros app mula sa huling aralin, magdagdag ng paging, pag-order ayon sa alpabeto ayon sa pangalan, at paghahanap ayon sa pangalan.

![Screenshot of Student Intros frontend](../../assets/student-intros-frontend.png)

1. Magagawa mo ito mula sa simula o maaari mong i-download ang [starter code](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-deserialize-account-data)
2. Magdagdag ng paging sa proyekto sa pamamagitan ng pag-prefetch ng mga account na walang data, pagkatapos ay pagkuha lamang ng data ng account para sa bawat account kapag kinakailangan ito.
3. I-order ang mga account na ipinapakita sa app ayon sa alpabeto ayon sa pangalan.
4. Idagdag ang kakayahang maghanap sa pamamagitan ng mga pagpapakilala sa pamamagitan ng pangalan ng mag-aaral.

Ito ay mapaghamong. Kung natigil ka, huwag mag-atubiling sumangguni sa [code ng solusyon](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-paging-account-data). Sa pamamagitan nito, kumpletuhin mo ang Modyul 1! Kumusta ang iyong karanasan? Huwag mag-atubiling [magbahagi ng ilang mabilis na feedback](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%201), nang sa gayon ay maaari naming patuloy na mapabuti ang kurso!

Gaya ng nakasanayan, maging malikhain sa mga hamong ito at dalhin ang mga ito nang higit sa mga tagubilin kung gusto mo!

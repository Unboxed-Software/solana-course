---
title: Intro to client-side Anchor development
objectives:
- Gumamit ng IDL upang makipag-ugnayan sa isang programang Solana mula sa kliyente
- Ipaliwanag ang isang bagay na Anchor `Provider`
- Ipaliwanag ang isang bagay na Anchor `Program`
- Gamitin ang Anchor `MethodsBuilder` upang bumuo ng mga tagubilin at transaksyon
- Gamitin ang Anchor para kumuha ng mga account
- Mag-set up ng frontend para mag-invoke ng mga tagubilin gamit ang Anchor at isang IDL
---

# TL;DR

- Ang **IDL** ay isang file na kumakatawan sa istruktura ng isang Solana program. Ang mga program na isinulat at binuo gamit ang Anchor ay awtomatikong bumubuo ng kaukulang IDL. Ang ibig sabihin ng IDL ay Interface Description Language.
- Ang `@coral-xyz/anchor` ay isang Typescript client na kinabibilangan ng lahat ng kakailanganin mo para makipag-ugnayan sa mga Anchor program
- Isang bagay na **Anchor `Provider`** ang isang `koneksyon` sa isang cluster at isang tinukoy na `wallet` upang paganahin ang pag-sign ng transaksyon
- Isang bagay na **Anchor `Program`** ay nagbibigay ng custom na API upang makipag-ugnayan sa isang partikular na program. Lumilikha ka ng instance ng `Program` gamit ang IDL at `Provider` ng isang program.
- Ang **Anchor `MethodsBuilder`** ay nagbibigay ng isang simpleng interface sa pamamagitan ng `Program` para sa mga tagubilin sa pagbuo at mga transaksyon

# Lesson

Pinapasimple ng Anchor ang proseso ng pakikipag-ugnayan sa mga program ng Solana mula sa kliyente sa pamamagitan ng pagbibigay ng file ng Interface Description Language (IDL) na sumasalamin sa istruktura ng isang programa. Ang paggamit ng IDL kasabay ng Anchor's Typescript library (`@coral-xyz/anchor`) ay nagbibigay ng pinasimpleng format para sa pagbuo ng mga tagubilin at transaksyon.

```tsx
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

Gumagana ito mula sa alinmang Typescript client, ito man ay isang frontend o integration test. Sa araling ito, tatalakayin natin kung paano gamitin ang `@coral-xyz/anchor` upang pasimplehin ang iyong pakikipag-ugnayan sa programa sa panig ng kliyente.

## Anchor client-side structure

Magsimula tayo sa pamamagitan ng pagtalakay sa pangunahing istraktura ng Typescript library ng Anchor. Ang pangunahing object na iyong gagamitin ay ang `Program` object. Ang isang instance ng `Program` ay kumakatawan sa isang partikular na programa ng Solana at nagbibigay ng custom na API para sa pagbabasa at pagsusulat sa programa.

Para gumawa ng instance ng `Program`, kakailanganin mo ang sumusunod:

- IDL - file na kumakatawan sa istruktura ng isang programa
- `Connection` - ang cluster connection
- `Wallet` - default na keypair na ginamit upang magbayad at pumirma ng mga transaksyon
- `Provider` - i-encapsulate ang `Connection` sa isang Solana cluster at isang `Wallet`
- `ProgramId` - ang onchain na address ng program

![Anchor structure](../../assets/anchor-client-structure.png)

Ipinapakita ng larawan sa itaas kung paano pinagsama ang bawat isa sa mga pirasong ito upang lumikha ng isang instance ng `Program`. Tatalakayin natin ang bawat isa sa kanila nang paisa-isa upang makakuha ng mas mahusay na ideya kung paano magkakaugnay ang lahat.

### Interface Description Language (IDL)

Kapag bumuo ka ng Anchor program, bumubuo ang Anchor ng parehong JSON at Typescript file na kumakatawan sa IDL ng iyong program. Kinakatawan ng IDL ang istruktura ng programa at maaaring gamitin ng isang kliyente upang ipahiwatig kung paano makipag-ugnayan sa isang partikular na programa.

Bagama't hindi ito awtomatiko, maaari ka ring bumuo ng IDL mula sa isang katutubong Solana program gamit ang mga tool tulad ng [shank](https://github.com/metaplex-foundation/shank) ng Metaplex.

Upang makakuha ng ideya sa impormasyong ibinibigay ng isang IDL, narito ang IDL para sa counter program na ginawa mo dati:

```json
{
  "version": "0.1.0",
  "name": "counter",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "counter", "isMut": true, "isSigner": true },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "increment",
      "accounts": [
        { "name": "counter", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": false, "isSigner": true }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "Counter",
      "type": {
        "kind": "struct",
        "fields": [{ "name": "count", "type": "u64" }]
      }
    }
  ]
}
```

Sa pag-inspeksyon sa IDL, makikita mo na ang program na ito ay naglalaman ng dalawang tagubilin (`pasimulan` at `increment`).

Pansinin na bilang karagdagan sa pagtukoy sa mga tagubilin, ito ay tumutukoy sa mga account at input para sa bawat pagtuturo. Nangangailangan ng tatlong account ang tagubiling `initialize`:

1. `counter` - ang bagong account na sinisimulan sa pagtuturo
2. `user` - ang nagbabayad para sa transaksyon at pagsisimula
3. `systemProgram` - ang system program ay hinihimok upang simulan ang isang bagong account

At ang pagtuturo ng `increment` ay nangangailangan ng dalawang account:

1. `counter` - isang umiiral na account upang dagdagan ang field ng bilang
2. `user` - ang nagbabayad mula sa transaksyon

Sa pagtingin sa IDL, makikita mo na sa parehong mga tagubilin ang `user` ay kinakailangan bilang isang signer dahil ang `isSigner` na flag ay minarkahan bilang `true`. Bukod pa rito, hindi nangangailangan ng anumang karagdagang data ng pagtuturo ang alinman sa mga tagubilin dahil blangko ang seksyong `args` para sa dalawa.

Kung titingnan sa ibaba ang seksyong `account`, makikita mo na ang program ay naglalaman ng isang uri ng account na pinangalanang `Counter` na may isang field na `count` na may uri na `u64`.

Bagama't hindi ibinibigay ng IDL ang mga detalye ng pagpapatupad para sa bawat pagtuturo, makakakuha tayo ng pangunahing ideya kung paano inaasahan ng onchain program ang mga tagubilin na mabuo at makita ang istruktura ng mga account ng programa.

Hindi alintana kung paano mo ito makuha, *kailangan mo* ng IDL file para makipag-ugnayan sa isang program gamit ang `@coral-xyz/anchor` package. Upang magamit ang IDL, kakailanganin mong isama ang IDL file sa iyong proyekto at pagkatapos ay i-import ang file.

```tsx
import idl from "./idl.json"
```

### Provider

Bago ka makalikha ng object na `Program` gamit ang IDL, kailangan mo munang gumawa ng object na Anchor `Provider`.

Pinagsasama ng object na `Provider` ang dalawang bagay:

- `Connection` - ang koneksyon sa isang Solana cluster (i.e. localhost, devnet, mainnet)
- `Wallet` - isang tinukoy na address na ginamit upang magbayad at pumirma ng mga transaksyon

Ang `Provider` ay makakapagpadala ng mga transaksyon sa Solana blockchain sa ngalan ng isang `Wallet` sa pamamagitan ng pagsasama ng lagda ng wallet sa mga papalabas na transaksyon. Kapag gumagamit ng frontend sa isang Solana wallet provider, lahat ng papalabas na transaksyon ay dapat pa ring aprubahan ng user sa pamamagitan ng kanilang wallet browser extension.

Ang pag-set up ng `Wallet` at `Connection` ay magiging ganito ang hitsura:

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"

const { connection } = useConnection()
const wallet = useAnchorWallet()
```

Upang i-set up ang koneksyon, maaari mong gamitin ang `useConnection` hook mula sa `@solana/wallet-adapter-react` upang makuha ang `Connection` sa isang Solana cluster.

Tandaan na ang object na `Wallet` na ibinigay ng `useWallet` hook mula sa `@solana/wallet-adapter-react` ay hindi tugma sa object na `Wallet` na inaasahan ng Anchor `Provider`. Gayunpaman, ang `@solana/wallet-adapter-react` ay nagbibigay din ng `useAnchorWallet` hook.

Para sa paghahambing, narito ang `AnchorWallet` mula sa `useAnchorWallet`:

```tsx
export interface AnchorWallet {
  publicKey: PublicKey
  signTransaction(transaction: Transaction): Promise<Transaction>
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>
}
```

And the `WalletContextState` from `useWallet`:

```tsx
export interface WalletContextState {
  autoConnect: boolean
  wallets: Wallet[]
  wallet: Wallet | null
  publicKey: PublicKey | null
  connecting: boolean
  connected: boolean
  disconnecting: boolean
  select(walletName: WalletName): void
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendTransaction(
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions
  ): Promise<TransactionSignature>
  signTransaction: SignerWalletAdapterProps["signTransaction"] | undefined
  signAllTransactions:
    | SignerWalletAdapterProps["signAllTransactions"]
    | undefined
  signMessage: MessageSignerWalletAdapterProps["signMessage"] | undefined
}
```

Ang `WalletContextState` ay nagbibigay ng mas maraming functionality kumpara sa `AnchorWallet`, ngunit ang `AnchorWallet` ay kinakailangan upang i-set up ang `Provider` object.

Upang gawin ang object na `Provider` ginagamit mo ang `AnchorProvider` mula sa `@coral-xyz/anchor`.

Ang `AnchorProvider` constructor ay tumatagal ng tatlong parameter:

- `koneksyon` - ang `Koneksyon` sa Solana cluster
- `wallet` - ang object na `Wallet`
- `opts` - opsyonal na parameter na tumutukoy sa mga opsyon sa pagkumpirma, gamit ang default na setting kung hindi ibinigay ang isa

Kapag nagawa mo na ang object na `Provider`, itatakda mo ito bilang default provider gamit ang `setProvider`.

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { AnchorProvider, setProvider } from "@coral-xyz/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()
const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)
```

### Program

Kapag mayroon ka nang IDL at isang provider, maaari kang lumikha ng isang instance ng `Program`. Ang tagabuo ay nangangailangan ng tatlong mga parameter:

- `idl` - ang IDL bilang uri ng `Idl`
- `programId` - ang onchain na address ng program bilang `string` o `PublicKey`
- `Provider` - ang provider na tinalakay sa nakaraang seksyon

Gumagawa ang object ng `Program` ng custom na API na magagamit mo para makipag-ugnayan sa isang Solana program. Ang API na ito ay ang one stop shop para sa lahat ng bagay na nauugnay sa pakikipag-ugnayan sa mga onchain na programa. Sa iba pang mga bagay, maaari kang magpadala ng mga transaksyon, kumuha ng mga deserialized na account, mag-decode ng data ng pagtuturo, mag-subscribe sa mga pagbabago sa account, at makinig sa mga kaganapan. Maaari ka ring [matuto nang higit pa tungkol sa klase ng `Program`](https://coral-xyz.github.io/anchor/ts/classes/Program.html#constructor).

Upang gawin ang object na `Program`, i-import muna ang `Program` at `Idl` mula sa `@coral-xyz/anchor`. Ang `Idl` ay isang uri na magagamit mo kapag nagtatrabaho sa Typescript.

Susunod, tukuyin ang `programId` ng program. Kailangan nating tahasan na sabihin ang `programId` dahil maaaring mayroong maraming mga program na may parehong istraktura ng IDL (ibig sabihin, kung ang parehong programa ay na-deploy nang maraming beses gamit ang iba't ibang mga address). Kapag nililikha ang object na `Program`, ginagamit ang default na `Provider` kung ang isa ay hindi tahasang tinukoy.

Sa kabuuan, ganito ang hitsura ng huling setup:

```tsx
import idl from "./idl.json"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  Program,
  Idl,
  AnchorProvider,
  setProvider,
} from "@coral-xyz/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()

const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)

const programId = new PublicKey("JPLockxtkngHkaQT5AuRYow3HyUv5qWzmhwsCPd653n")
const program = new Program(idl as Idl, programId)
```

## Anchor `MethodsBuilder`

Kapag na-set up na ang object na `Program`, maaari mong gamitin ang Anchor Methods Builder upang bumuo ng mga tagubilin at transaksyong nauugnay sa program. Ginagamit ng `MethodsBuilder` ang IDL upang magbigay ng pinasimpleng format para sa pagbuo ng mga transaksyon na humihiling ng mga tagubilin sa programa.

Tandaan na ginagamit ang convention ng pagpapangalan ng camel case kapag nakikipag-ugnayan sa isang program mula sa kliyente, kumpara sa convention ng pagpapangalan ng snake case na ginamit noong sinusulat ang programa sa kalawang.

Ang pangunahing format ng `MethodsBuilder` ay ganito ang hitsura:

```tsx
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

Sa hakbang-hakbang, ikaw ay:

1. Tumawag sa `mga pamamaraan` sa `program` - ito ang tagabuo ng API para sa paglikha ng mga tawag sa pagtuturo na nauugnay sa IDL ng programa
2. Tawagan ang pangalan ng pagtuturo bilang `.instructionName(instructionDataInputs)` - tawagan lang ang pagtuturo gamit ang tuldok na syntax at ang pangalan ng pagtuturo, na nagpapasa sa anumang mga argumento ng pagtuturo bilang mga halagang pinaghihiwalay ng kuwit
3. Tumawag sa `accounts` - gamit ang tuldok na syntax, tumawag sa `.accounts`, pagpasa sa isang bagay sa bawat account na inaasahan ng pagtuturo batay sa IDL
4. Opsyonal na tawagan ang `signers` - gamit ang dot syntax, tawagan ang `.signers`, pagpasa sa hanay ng mga karagdagang signer na kinakailangan ng pagtuturo
5. Tumawag sa `rpc` - ang paraang ito ay lumilikha at nagpapadala ng nilagdaang transaksyon na may tinukoy na tagubilin at nagbabalik ng `TransactionSignature`. Kapag gumagamit ng `.rpc`, ang `Wallet` mula sa `Provider` ay awtomatikong kasama bilang isang pumirma at hindi kailangang tahasang nakalista.

Tandaan na kung walang karagdagang pumirma ang kinakailangan sa pamamagitan ng pagtuturo maliban sa `Wallet` na tinukoy kasama ng `Provider`, ang `.signer([])` na linya ay maaaring hindi isama.

Maaari mo ring direktang buuin ang transaksyon sa pamamagitan ng pagpapalit ng `.rpc()` sa `.transaction()`. Bumubuo ito ng object na `Transaction` gamit ang tinukoy na pagtuturo.

```tsx
// creates transaction
const transaction = await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .transaction()

await sendTransaction(transaction, connection)
```

Katulad nito, maaari mong gamitin ang parehong format upang bumuo ng isang pagtuturo gamit ang `.instruction()` at pagkatapos ay manu-manong idagdag ang mga tagubilin sa isang bagong transaksyon. Bumubuo ito ng object na `TransactionInstruction` gamit ang tinukoy na pagtuturo.

```tsx
// creates first instruction
const instructionOne = await program.methods
  .instructionOneName(instructionOneDataInputs)
  .accounts({})
  .instruction()

// creates second instruction
const instructionTwo = await program.methods
  .instructionTwoName(instructionTwoDataInputs)
  .accounts({})
  .instruction()

// add both instruction to one transaction
const transaction = new Transaction().add(instructionOne, instructionTwo)

// send transaction
await sendTransaction(transaction, connection)
```

Sa buod, ang Anchor `MethodsBuilder` ay nagbibigay ng pinasimple at mas nababaluktot na paraan upang makipag-ugnayan sa mga onchain na programa. Maaari kang bumuo ng isang pagtuturo, isang transaksyon, o bumuo at magpadala ng isang transaksyon gamit ang karaniwang parehong format nang hindi kinakailangang manu-manong i-serialize o deserialize ang mga account o data ng pagtuturo.

## Fetch program accounts

Binibigyang-daan ka rin ng object na `Program` na madaling makuha at i-filter ang mga account ng program. Tawagan lang ang `account` sa `program` at pagkatapos ay tukuyin ang pangalan ng uri ng account na makikita sa IDL. Pagkatapos ay i-deserialize ng Anchor at ibinabalik ang lahat ng account gaya ng tinukoy.

Ipinapakita ng halimbawa sa ibaba kung paano mo makukuha ang lahat ng umiiral nang `counter` na account para sa Counter program.

```tsx
const accounts = await program.account.counter.all()
```

Maaari ka ring maglapat ng filter sa pamamagitan ng paggamit ng `memcmp` at pagkatapos ay pagtukoy ng `offset` at ang `bytes` upang i-filter.

Kinukuha ng halimbawa sa ibaba ang lahat ng `counter` na account na may `count` na 0. Tandaan na ang `offset` ng 8 ay para sa 8 byte na discriminator na ginagamit ng Anchor upang matukoy ang mga uri ng account. Ang ika-9 na byte ay kung saan magsisimula ang field na `count`. Maaari kang sumangguni sa IDL upang makita na ang susunod na byte ay nag-iimbak ng `count` na field ng uri na `u64`. Ang anchor pagkatapos ay i-filter at ibabalik ang lahat ng mga account na may tumutugmang mga byte sa parehong posisyon.

```tsx
const accounts = await program.account.counter.all([
    {
        memcmp: {
            offset: 8,
            bytes: bs58.encode((new BN(0, 'le')).toArray()),
        },
    },
])
```

Bilang kahalili, maaari mo ring makuha ang data ng deserialized na account para sa isang partikular na account gamit ang `fetch` kung alam mo ang address ng account na iyong hinahanap.

```tsx
const account = await program.account.counter.fetch(ACCOUNT_ADDRESS)
```

Katulad nito, maaari kang kumuha ng maramihang account gamit ang `fetchMultiple`.

```tsx
const accounts = await program.account.counter.fetchMultiple([ACCOUNT_ADDRESS_ONE, ACCOUNT_ADDRESS_TWO])
```

# Demo

Sanayin natin ito nang sama-sama sa pamamagitan ng pagbuo ng frontend para sa Counter program mula sa nakaraang aralin. Bilang paalala, may dalawang tagubilin ang Counter program:

- `initialize` - nagpapasimula ng bagong `Counter` account at itinatakda ang `count` sa `0`
- `increment` - dinadagdagan ang `count` sa isang umiiral na `Counter` account

### 1. Download the starter code

I-download [ang starter code para sa proyektong ito](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/starter). Kapag mayroon ka nang starter code, tumingin sa paligid. I-install ang mga dependency gamit ang `npm install` at pagkatapos ay patakbuhin ang app gamit ang `npm run dev`.

Ang proyektong ito ay isang simpleng Next.js application. Kabilang dito ang `WalletContextProvider` na ginawa namin sa [aralin sa Wallets](https://github.com/Unboxed-Software/solana-course/blob/main/content/interact-with-wallets.md), ang `idl. json` file para sa Counter program, at ang `Initialize` at `Increment` na mga bahagi na gagawin namin sa buong demo na ito. Ang `programId` ng program na aming i-invoke ay kasama rin sa starter code.

### 2. `Initialize`

Upang magsimula, kumpletuhin natin ang setup para gawin ang object na `Program` sa component na `Initialize.tsx`.

Tandaan, kakailanganin namin ng isang instance ng `Program` para magamit ang Anchor `MethodsBuilder` para gamitin ang mga tagubilin sa aming program. Para diyan, kakailanganin namin ng Anchor wallet at isang koneksyon, na makukuha namin mula sa `useAnchorWallet` at `useConnection` hook. Gumawa din tayo ng `useState` para makuha ang instance ng program.

```tsx
export const Initialize: FC<Props> = ({ setCounter }) => {
  const [program, setProgram] = useState("")

  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  ...
}
```

Gamit iyon, maaari kaming gumawa ng aktwal na instance ng `Program`. Gawin natin ito sa isang `useEffect`.

Una kailangan nating kunin ang default na provider kung mayroon na ito, o gawin ito kung wala pa. Magagawa natin iyon sa pamamagitan ng pagtawag sa `getProvider` sa loob ng try/catch block. Kung ang isang error ay itinapon, nangangahulugan iyon na walang default na provider at kailangan naming gumawa ng isa.

Kapag mayroon na kaming provider, makakagawa kami ng instance ng `Program`.

```tsx
useEffect(() => {
  let provider: anchor.Provider

  try {
    provider = anchor.getProvider()
  } catch {
    provider = new anchor.AnchorProvider(connection, wallet, {})
    anchor.setProvider(provider)
  }

  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID)
  setProgram(program)
}, [])
```

Ngayong natapos na namin ang pag-setup ng Anchor, maaari naming aktwal na i-invoke ang `initialize` na pagtuturo ng program. Gagawin namin ito sa loob ng function na `onClick`.

Una, kakailanganin naming bumuo ng bagong `Keypair` para sa bagong `Counter` account dahil magsisimula kami ng account sa unang pagkakataon.

Pagkatapos ay magagamit natin ang Anchor `MethodsBuilder` para gumawa at magpadala ng bagong transaksyon. Tandaan, maaaring ipahiwatig ng Anchor ang ilan sa mga account na kinakailangan, tulad ng mga `user` at `systemAccount` na account. Gayunpaman, hindi nito mahihinuha ang `counter` na account dahil dynamic naming binubuo iyon, kaya kakailanganin mong idagdag ito gamit ang `.accounts`. Kakailanganin mo ring idagdag ang keypair na iyon bilang sign na may `.signers`. Panghuli, maaari mong gamitin ang `.rpc()` upang isumite ang transaksyon sa wallet ng user.

Kapag natapos na ang transaksyon, tawagan ang `setUrl` gamit ang explorer URL at pagkatapos ay tawagan ang `setCounter`, na ipinapasa ang counter account.

```tsx
const onClick = async () => {
  const sig = await program.methods
    .initialize()
    .accounts({
      counter: newAccount.publicKey,
      user: wallet.publicKey,
      systemAccount: anchor.web3.SystemProgram.programId,
    })
    .signers([newAccount])
    .rpc()

    setTransactionUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
    setCounter(newAccount.publicKey)
}
```

### 3. `Increment`

Susunod, lumipat tayo sa bahaging `Increment.tsx`. Katulad ng dati, kumpletuhin ang setup para gawin ang object na `Program`. Bilang karagdagan sa pagtawag sa `setProgram`, ang `useEffect` ay dapat tumawag sa `refreshCount`.

Idagdag ang sumusunod na code para sa paunang set up:

```tsx
export const Increment: FC<Props> = ({ counter, setTransactionUrl }) => {
  const [count, setCount] = useState(0)
  const [program, setProgram] = useState<anchor.Program>()
  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  useEffect(() => {
    let provider: anchor.Provider

    try {
      provider = anchor.getProvider()
    } catch {
      provider = new anchor.AnchorProvider(connection, wallet, {})
      anchor.setProvider(provider)
    }

    const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID)
    setProgram(program)
    refreshCount(program)
  }, [])
  ...
}
```

Susunod, gamitin natin ang Anchor `MethodsBuilder` para makabuo ng bagong tagubilin para gamitin ang `increment` na pagtuturo. Muli, maaaring ipahiwatig ng Anchor ang `user` account mula sa wallet kaya kailangan lang nating isama ang `counter` account.

```tsx
const onClick = async () => {
  const sig = await program.methods
    .increment()
    .accounts({
      counter: counter,
      user: wallet.publicKey,
    })
    .rpc()

  setTransactionUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
}
```

### 5. Display the correct count

Ngayon na maaari na nating simulan ang counter program at dagdagan ang bilang, kailangan nating makuha ang ating UI upang ipakita ang bilang na nakaimbak sa counter account.

Ipapakita namin kung paano obserbahan ang mga pagbabago sa account sa isang aralin sa hinaharap, ngunit sa ngayon ay mayroon lang kaming button na tumatawag sa `refreshCount` upang ma-click mo ito upang ipakita ang bagong bilang pagkatapos ng bawat `increment` invocation.

Sa loob ng `refreshCount`, gamitin natin ang `program` para kunin ang counter account, pagkatapos ay gamitin ang `setCount` upang itakda ang bilang sa numerong nakaimbak sa program:

```tsx
const refreshCount = async (program) => {
  const counterAccount = await program.account.counter.fetch(counter)
  setCount(counterAccount.count.toNumber())
}
```

Napakasimple sa Anchor!

### 5. Test the frontend

Sa puntong ito, dapat gumana ang lahat! Maaari mong subukan ang frontend sa pamamagitan ng pagpapatakbo ng `npm run dev`.

1. Ikonekta ang iyong wallet at dapat mong makita ang button na `Initialize Counter`
2. I-click ang button na `Initialize Counter`, at pagkatapos ay aprubahan ang transaksyon
3. Dapat kang makakita ng link sa ibaba ng screen sa Solana Explorer para sa `pasimulan` na transaksyon. Ang `Increment Counter` na buton, `I-refresh ang Bilang` na buton, at ang bilang ay dapat ding lumabas lahat.
4. I-click ang button na `Increment Counter`, at pagkatapos ay aprubahan ang transaksyon
5. Maghintay ng ilang segundo at i-click ang `Refresh Count`. Dapat tumaas ang bilang sa screen.

![Gif of Anchor Frontend Demo](../../assets/anchor-frontend-demo.gif)

Huwag mag-atubiling i-click ang mga link upang siyasatin ang mga log ng programa mula sa bawat transaksyon!

![Screenshot of Initialize Program Log](../../assets/anchor-frontend-initialize.png)

![Screenshot of Increment Program Log](../../assets/anchor-frontend-increment.png)

Binabati kita, alam mo na ngayon kung paano mag-set up ng frontend para mag-invoke ng isang Solana program gamit ang isang Anchor IDL.

Kung kailangan mo ng mas maraming oras sa proyektong ito para maging komportable sa mga konseptong ito, huwag mag-atubiling tingnan ang [solution code sa `solution-increment` branch](https://github.com/Unboxed-Software/anchor- ping-frontend/tree/solution-increment) bago magpatuloy.

# Challenge

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa. Bilang karagdagan sa ginawa namin sa demo, subukang gumawa ng bagong bahagi sa frontend na nagpapatupad ng isang button upang bawasan ang counter.

Bago buuin ang bahagi sa frontend, kakailanganin mo munang:

1. Bumuo at mag-deploy ng bagong programa na nagpapatupad ng pagtuturo ng `decrement`
2. I-update ang IDL file sa frontend gamit ang isa mula sa iyong bagong program
3. I-update ang `programId` gamit ang isa mula sa iyong bagong program

Kung kailangan mo ng tulong, huwag mag-atubiling [sanggunian ang program na ito](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

Subukang gawin ito nang nakapag-iisa kung kaya mo! Ngunit kung natigil ka, huwag mag-atubiling sumangguni sa [solution code](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-decrement).
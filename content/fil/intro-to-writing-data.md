---
title: Write Data To The Solana Network
objectives:
- Ipaliwanag ang mga transaksyon
- Ipaliwanag ang mga bayarin sa transaksyon
- Gamitin ang `@solana/web3.js` para magpadala ng SOL
- Gamitin ang `@solana/web3.js` para pumirma ng mga transaksyon
- Gamitin ang Solana explorer upang tingnan ang mga transaksyon
---

# TL;DR

Ang lahat ng pagbabago sa onchain na data ay nangyayari sa pamamagitan ng **mga transaksyon**. Ang mga transaksyon ay kadalasang isang hanay ng mga tagubilin na humihimok ng mga programang Solana. Ang mga transaksyon ay atomic, ibig sabihin ay magtagumpay sila - kung ang lahat ng mga tagubilin ay naisakatuparan nang maayos - o nabigo, na parang hindi pa natakbo ang transaksyon.

# Lesson

## Transactions

Ang anumang pagbabago sa onchain na data ay nangyayari sa pamamagitan ng mga transaksyong ipinadala sa mga programa.

Ang mga tagubilin sa transaksyon ay naglalaman ng:

- isang identifier ng program na balak mong gamitin
- isang hanay ng mga account na babasahin mula sa at/o isusulat sa
- data na nakabalangkas bilang isang byte array na tinukoy sa program na ini-invoke

Kapag nagpadala ka ng transaksyon sa isang Solana cluster, ang isang Solana program ay ini-invoke kasama ang mga tagubiling kasama sa transaksyon.

Gaya ng maaari mong asahan, ang `@solana/web3.js` ay nagbibigay ng mga function ng helper para sa paggawa ng mga transaksyon at mga tagubilin. Maaari kang gumawa ng bagong transaksyon kasama ang constructor, `new Transaction()`. Kapag nagawa na, maaari kang magdagdag ng mga tagubilin sa transaksyon gamit ang pamamaraang `add()`.

Ang isa sa mga function ng helper ay `SystemProgram.transfer()`, na gumagawa ng tagubilin para sa paglilipat ng SOL:

```typescript
const transaction = new Transaction()

const sendSolInstruction = SystemProgram.transfer({
  fromPubkey: sender,
  toPubkey: recipient,
  lamports: LAMPORTS_PER_SOL * amount
})

transaction.add(sendSolInstruction)
```

Ang function na `SystemProgram.transfer()` ay nangangailangan ng:

- isang pampublikong susi na naaayon sa account ng nagpadala
- isang pampublikong susi na naaayon sa account ng tatanggap
- ang halaga ng SOL na ipapadala sa lamports.

Ibinabalik ng `SystemProgram.transfer()` ang tagubilin para sa pagpapadala ng SOL mula sa nagpadala patungo sa tatanggap. Ang pagtuturo ay maaaring idagdag sa transaksyon.

Kapag naidagdag na ang lahat ng mga tagubilin, kailangang magpadala ng transaksyon sa cluster at kumpirmahin:

```typescript
const signature = sendAndConfirmTransaction(
  connection,
  transaction,
  [senderKeypair]
)
```

Ang mga function na `sendAndConfirmTransaction()` ay tumatagal bilang mga parameter

- isang kumpol na koneksyon
- isang transaksyon
- isang hanay ng mga keypair na magsisilbing mga lumagda sa transaksyon - sa halimbawang ito, mayroon lang kaming isang pumirma: ang nagpadala.

### Instructions

Ang halimbawa ng pagpapadala ng SOL ay mahusay para sa pagpapakilala sa iyo sa pagpapadala ng mga transaksyon, ngunit maraming web3 development ang magsasangkot ng pagtawag sa mga hindi katutubong programa. Sa halimbawa sa itaas, tinitiyak ng function na `SystemProgram.transfer()` na maipapasa mo ang lahat ng kinakailangang data na kinakailangan upang gawin ang pagtuturo, pagkatapos ay gagawa ito ng pagtuturo para sa iyo. Kapag nagtatrabaho sa mga hindi katutubong programa, gayunpaman, kakailanganin mong maging napaka-espesipiko tungkol sa paggawa ng mga tagubilin na nakabalangkas upang tumugma sa kaukulang programa.

Sa `@solana/web3.js`, makakagawa ka ng mga hindi katutubong tagubilin gamit ang constructor ng `TransactionInstruction`. Ang constructor na ito ay tumatagal ng isang argument ng uri ng data na `TransactionInstructionCtorFields`.

```tsx
export type TransactionInstructionCtorFields = {
  keys: Array<AccountMeta>;
  programId: PublicKey;
  data?: Buffer;
};
```

Alinsunod sa kahulugan sa itaas, ang bagay na ipinasa sa `TransactionInstruction` constructor ay nangangailangan ng:

- isang hanay ng mga key na may uri ng `AccountMeta`
- ang pampublikong susi para sa programang tinatawag
- isang opsyonal na `Buffer` na naglalaman ng data na ipapasa sa program.

Babalewalain natin ang field ng `data` sa ngayon at muli itong babalikan sa susunod na aralin.

Ang field ng `programId` ay medyo nagpapaliwanag sa sarili: ito ang pampublikong susi na nauugnay sa programa. Kakailanganin mong malaman ito nang maaga sa pagtawag sa programa sa parehong paraan na kailangan mong malaman ang pampublikong susi ng isang taong gusto mong padalhan ng SOL.

Ang hanay ng `keys` ay nangangailangan ng kaunting paliwanag. Ang bawat bagay sa array na ito ay kumakatawan sa isang account na babasahin o isusulat sa panahon ng pagpapatupad ng isang transaksyon. Nangangahulugan ito na kailangan mong malaman ang pag-uugali ng program na iyong tinatawagan at tiyaking ibibigay mo ang lahat ng kinakailangang mga account sa array.

Ang bawat bagay sa hanay ng `keys` ay dapat may kasamang sumusunod:
- `pubkey` - ang pampublikong susi ng account
- `isSigner` - isang boolean na kumakatawan kung ang account ay isang lumagda sa transaksyon o hindi
- `isWritable` - isang boolean na kumakatawan kung ang account ay isinulat o hindi sa panahon ng pagpapatupad ng transaksyon

Kung pinagsama-sama ito, maaari tayong magkaroon ng isang bagay tulad ng sumusunod:

```tsx
async function callProgram(
  connection: web3.Connection,
  payer: web3.Keypair,
  programId: web3.PublicKey,
  programDataAccount: web3.PublicKey,
) {
  const instruction = new web3.TransactionInstruction({
    keys: [
      {
        pubkey: programDataAccount,
        isSigner: false,
        isWritable: true,
      },
    ],
    programId,
  });

  const transaction = new web3.Transaction().add(instruction)

  const signature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
  );

  console.log(`✅ Success! Transaction signature is: ${signature}`);
}
```

### Transaction Fees

Ang mga bayarin sa transaksyon ay binuo sa ekonomiya ng Solana bilang kabayaran sa validator network para sa mga mapagkukunan ng CPU at GPU na kinakailangan sa pagproseso ng mga transaksyon. Ang mga bayarin sa transaksyon sa Solana ay deterministiko.

Ang unang pumirma na kasama sa hanay ng mga pumirma sa isang transaksyon ay may pananagutan sa pagbabayad ng bayarin sa transaksyon. Kung ang signer na ito ay walang sapat na SOL sa kanilang account upang mabayaran ang bayad sa transaksyon, ang transaksyon ay ibababa.

Kapag sumusubok, lokal man o sa devnet, maaari mong gamitin ang Solana CLI command na `solana airdrop 1` upang makakuha ng libreng pagsubok na SOL sa iyong account para sa pagbabayad ng mga bayarin sa transaksyon.

### Solana Explorer

![Screenshot of Solana Explorer set to Devnet](../../assets/solana-explorer-devnet.png)

Ang lahat ng mga transaksyon sa blockchain ay makikita ng publiko sa [Solana Explorer](http://explorer.solana.com). Halimbawa, maaari mong kunin ang pirmang ibinalik ng `sendAndConfirmTransaction()` sa halimbawa sa itaas, hanapin ang pirmang iyon sa Solana Explorer, pagkatapos ay tingnan ang:

- kapag nangyari ito
- saang block ito kasama
- ang bayad sa transaksyon
- at iba pa!

![Screenshot of Solana Explorer with details about a transaction](../../assets/solana-explorer-transaction-overview.png)

# Demo

Gagawa kami ng script para mag-ping ng onchain na program na nagdaragdag ng counter sa tuwing na-ping ito. Ang program na ito ay umiiral sa Solana Devnet sa address na `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa`. Iniimbak ng program ang data nito sa isang partikular na account sa address na `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

![Solana stores programs and data in seperate accounts](../../assets/pdas-note-taking-program.svg)

### 1. Basic scaffolding

Magsisimula tayo sa pamamagitan ng paggamit ng parehong mga package at `.env` file na ginawa namin kanina sa [intro to cryptography](../intro-to-cryptography.md):

```typescript
import { Keypair } from "@solana/web3.js";
import * as dotenv from "dotenv";
import base58 from "bs58";
import { getKeypairFromEnvironment } from "@solana-developers/helpers"

dotenv.config();

const payer = getKeypairFromEnvironment('SECRET_KEY')
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))

```

### 4. Ping program

Ngayong na-load na namin ang aming keypair, kailangan naming kumonekta sa Devnet ni Solana. Gumawa tayo ng koneksyon:

```typescript
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
```

Gumawa ngayon ng async function na tinatawag na `sendPingTransaction()` na may dalawang parameter na nangangailangan ng koneksyon at keypair ng nagbabayad bilang mga argumento:

```tsx
async function sendPingTransaction(connection: web3.Connection, payer: web3.Keypair) { }
```

Sa loob ng function na ito, kailangan nating:

1. gumawa ng transaksyon
2. gumawa ng panuto
3. idagdag ang pagtuturo sa transaksyon
4. ipadala ang transaksyon.

Tandaan, ang pinaka-mapanghamong piraso dito ay ang pagsasama ng tamang impormasyon sa pagtuturo. Alam namin ang address ng programa na aming tinatawagan. Alam din namin na ang program ay nagsusulat ng data sa isang hiwalay na account na ang address ay mayroon din kami. Idagdag natin ang mga string na bersyon ng pareho ng mga iyon bilang mga constant sa itaas ng `index.ts` file:

```typescript
const PING_PROGRAM_ADDRESS = new web3.PublicKey('ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa')
const PING_PROGRAM_DATA_ADDRESS =  new web3.PublicKey('Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod')
```

Ngayon, sa function na `sendPingTransaction()`, gumawa tayo ng bagong transaksyon, pagkatapos ay magpasimula ng `PublicKey` para sa program account, at isa pa para sa data account.

```tsx
const transaction = new web3.Transaction()
const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const pingProgramDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)
```

Susunod, gawin natin ang pagtuturo. Tandaan, kailangang isama ng pagtuturo ang pampublikong key para sa Ping program at kailangan din nitong magsama ng array kasama ang lahat ng account na babasahin o isusulat. Sa halimbawang programang ito, tanging ang data account na tinukoy sa itaas ang kailangan.

```typescript
const transaction = new web3.Transaction()

const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const pingProgramDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)

const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: pingProgramDataId,
      isSigner: false,
      isWritable: true
    },
  ],
  programId
})
```

Susunod, idagdag natin ang pagtuturo sa ginawa naming transaksyon. Pagkatapos, tawagan ang `sendAndConfirmTransaction()` sa pamamagitan ng pagpasa sa koneksyon, transaksyon, at nagbabayad. Panghuli, i-log natin ang resulta ng tawag sa function na iyon para mahanap natin ito sa Solana Explorer.

```typescript
const transaction = new web3.Transaction()

const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const pingProgramDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)

const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: pingProgramDataId,
      isSigner: false,
      isWritable: true
    },
  ],
  programId
})

transaction.add(instruction)

const signature = await web3.sendAndConfirmTransaction(
  connection,
  transaction,
  [payer]
)

console.log(`✅ Transaction completed! Signature is ${signature}`)
```

### 5. Airdrop

Ngayon patakbuhin ang code gamit ang `npx esrun send-ping-instruction.ts` at tingnan kung gumagana ito. Maaari kang magkaroon ng sumusunod na error sa console:

```
> Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.
```

Kung makuha mo ang error na ito, ito ay dahil ang iyong keypair ay bago at walang anumang SOL upang masakop ang mga bayarin sa transaksyon. Ayusin natin ito sa pamamagitan ng pagdaragdag ng sumusunod na linya bago ang tawag sa `sendPingTransaction()`:

```typescript
await connection.requestAirdrop(payer.publicKey, web3.LAMPORTS_PER_SOL*1)
```

Ito ay magdeposito ng 1 SOL sa iyong account na magagamit mo para sa pagsubok. Hindi ito gagana sa Mainnet kung saan ito ay talagang may halaga. Ngunit ito ay hindi kapani-paniwalang maginhawa para sa pagsubok sa lokal at sa Devnet.

### 6. Check the Solana explorer

Ngayon patakbuhin muli ang code. Maaaring tumagal ng isang sandali o dalawa, ngunit ngayon ay dapat gumana ang code at dapat mong makita ang isang mahabang string na naka-print sa console, tulad ng sumusunod:

```
✅ Transaction completed! Signature is 55S47uwMJprFMLhRSewkoUuzUs5V6BpNfRx21MpngRUQG3AswCzCSxvQmS3WEPWDJM7bhHm3bYBrqRshj672cUSG
```

Kopyahin ang lagda ng transaksyon. Magbukas ng browser at pumunta sa [https://explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet) (siguraduhin ng parameter ng query sa dulo ng URL na tutuklasin mo ang mga transaksyon sa Devnet sa halip na sa Mainnet). I-paste ang signature sa search bar sa tuktok ng Devnet explorer ni Solana at pindutin ang enter. Dapat mong makita ang lahat ng mga detalye tungkol sa transaksyon. Kung mag-scroll ka hanggang sa ibaba, makikita mo ang `Program Logs`, na nagpapakita kung gaano karaming beses na-ping ang program kasama ang iyong ping.

![Screenshot of Solana Explorer with logs from calling the Ping program](../../assets/solana-explorer-ping-result.png)

Mag-scroll sa paligid ng Explorer at tingnan kung ano ang iyong nakikita:
  - Ang **Account Input(s)** ay magsasama ng:
   - Ang address ng iyong nagbabayad - na na-debit ng 5000 laport para sa transaksyon
   - Ang address ng programa para sa ping program
   - Ang data address para sa ping program
  - Ang seksyong **Instruction** ay maglalaman ng isang iisang instructionm, na walang data - ang ping program ay isang medyo simpleng program, kaya hindi ito nangangailangan ng anumang data.
  - Ang **Program Instruction Logs** ay nagpapakita ng mga log mula sa ping program.

[//]: # "TODO: these would make a good question-and-answer interactive once we have this content hosted on solana.com, and can support adding more interactive content easily."

If you want to make it easier to look at Solana Explorer for transactions in the future, simply change your `console.log` in `sendPingTransaction()` to the following:

```typescript
console.log(`You can view your transaction on the Solana Explorer at:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`)
```

At tulad niyan tumatawag ka sa mga programa sa network ng Solana at nagsusulat ng data sa chain!

### Next steps

Sa susunod na ilang mga aralin matututunan mo kung paano

1. Magpadala ng mga transaksyon nang ligtas mula sa browser sa halip na mula sa pagpapatakbo ng script
2. Magdagdag ng custom na data sa iyong mga tagubilin
3. Deserialize ang data mula sa chain

# Challenge

Sige at gumawa ng script mula sa simula na magbibigay-daan sa iyong ilipat ang SOL mula sa isang account patungo sa isa pa sa Devnet. Siguraduhing i-print ang lagda ng transaksyon upang makita mo ito sa Solana Explorer.

Kung natigil ka huwag mag-atubiling tingnan ang [code ng solusyon](https://github.com/Unboxed-Software/solana-ping-client).

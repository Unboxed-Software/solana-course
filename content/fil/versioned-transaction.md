---
title: Versioned Transactions and Lookup Tables
objectives:
- Lumikha ng mga bersyon na transaksyon
- Lumikha ng mga talahanayan ng paghahanap
- Palawakin ang mga talahanayan ng paghahanap
- Gumamit ng mga lookup table na may mga bersyong transaksyon
---

# TL;DR

- **Mga Bersyon na Transaksyon** ay tumutukoy sa isang paraan upang suportahan ang parehong mga legacy na bersyon at mas bagong bersyon ng mga format ng transaksyon. Ang orihinal na format ng transaksyon ay "legacy" at ang mga bagong bersyon ng transaksyon ay nagsisimula sa bersyon 0. Ipinatupad ang mga bersyong transaksyon upang suportahan ang paggamit ng Address Lookup Tables (tinatawag ding lookup table o LUTs).
- **Mga Talaan ng Paghahanap ng Address** ay mga account na ginagamit upang mag-imbak ng mga address ng iba pang mga account, na maaaring i-reference sa mga may bersyong transaksyon gamit ang isang 1 byte na index sa halip na ang buong 32 byte bawat address. Ito ay nagbibigay-daan sa paglikha ng mas kumplikadong mga transaksyon kaysa sa kung ano ang posible bago ang pagpapakilala ng mga LUT.

# Lesson

Sa disenyo, ang mga transaksyon sa Solana ay limitado sa 1232 bytes. Mabibigo ang mga transaksyong lalampas sa laki na ito. Bagama't pinapagana nito ang isang bilang ng mga pag-optimize ng network, maaari din nitong limitahan ang mga uri ng mga pagpapatakbong atomic na maaaring gawin sa network.

Upang makatulong na makayanan ang limitasyon sa laki ng transaksyon, naglabas si Solana ng bagong format ng transaksyon na nagbibigay-daan sa suporta para sa maraming bersyon ng mga format ng transaksyon. Sa oras ng pagsulat, sinusuportahan ng Solana ang dalawang bersyon ng transaksyon:

1. `legacy` - ang orihinal na format ng transaksyon
2. `0` - ang pinakabagong format ng transaksyon na may kasamang suporta para sa Address Lookup Tables

Ang mga may bersyong transaksyon ay hindi nangangailangan ng anumang mga pagbabago sa mga umiiral nang Solana program, ngunit dapat na ma-update ang anumang client-side code na ginawa bago ang paglabas ng mga bersyong transaksyon. Sa araling ito, sasaklawin natin ang mga pangunahing kaalaman ng mga may bersyong transaksyon at kung paano gamitin ang mga ito, kabilang ang:

- Paglikha ng mga bersyon na transaksyon
- Paglikha at pamamahala ng mga lookup table
- Paggamit ng mga lookup table sa mga may bersyong transaksyon

## Versioned Transactions

Isa sa mga item na kumukuha ng pinakamaraming espasyo sa mga transaksyon sa Solana ay ang pagsasama ng buong address ng account. Sa 32 bytes bawat isa, 39 na account ang magre-render ng isang transaksyon na masyadong malaki. Iyon ay hindi kahit na accounting para sa data ng pagtuturo. Sa pagsasagawa, karamihan sa mga transaksyon ay magiging masyadong malaki na may humigit-kumulang 20 account.

Naglabas si Solana ng mga bersyong transaksyon upang suportahan ang maraming format ng transaksyon. Kasabay ng paglabas ng mga bersyong transaksyon, inilabas ni Solana ang bersyon 0 ng mga transaksyon upang suportahan ang Mga Talaan ng Paghahanap ng Address. Ang mga lookup table ay mga hiwalay na account na nag-iimbak ng mga address ng account at pagkatapos ay nagbibigay-daan sa mga ito na ma-reference sa isang transaksyon gamit ang isang 1 byte na index. Ito ay makabuluhang binabawasan ang laki ng isang transaksyon dahil ang bawat kasamang account ay kailangan na lang gumamit ng 1 byte sa halip na 32 byte.

Kahit na hindi mo kailangang gumamit ng mga lookup table, kakailanganin mong malaman kung paano suportahan ang mga naka-bersyon na transaksyon sa iyong client-side code. Sa kabutihang palad, lahat ng kailangan mo para magtrabaho sa mga may bersyong transaksyon at lookup table ay kasama sa `@solana/web3.js` library.

### Create versioned transaction

Para gumawa ng may bersyon na transaksyon, gagawa ka lang ng `TransactionMessage` na may mga sumusunod na parameter:

- `payerKey` - ang pampublikong key ng account na magbabayad para sa transaksyon
- `recentBlockhash` - isang kamakailang blockhash mula sa network
- `mga tagubilin` - ang mga tagubilin na isasama sa transaksyon

Pagkatapos ay gagawin mong bersyong `0` na transaksyon ang object ng mensaheng ito gamit ang paraan ng `compileToV0Message()`.

```typescript
import * as web3 from "@solana/web3.js";

// Example transfer instruction
const transferInstruction = [
    web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey, // Public key of account that will send the funds
        toPubkey: toAccount.publicKey, // Public key of the account that will receive the funds
        lamports: 1 * LAMPORTS_PER_SOL, // Amount of lamports to be transferred
    }),
];

// Get the latest blockhash
let { blockhash } = await connection.getLatestBlockhash();

// Create the transaction message
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // Public key of the account that will pay for the transaction
    recentBlockhash: blockhash, // Latest blockhash
    instructions: transferInstruction, // Instructions included in transaction
}).compileToV0Message();
```

Sa wakas, ipapasa mo ang pinagsama-samang mensahe sa `VersionedTransaction` constructor upang lumikha ng bagong bersyon na transaksyon. Pagkatapos ay maaaring lagdaan at ipadala ng iyong code ang transaksyon sa network, katulad ng isang legacy na transaksyon.

```typescript
// Create the versioned transaction using the message
const transaction = new web3.VersionedTransaction(message);

// Sign the transaction
transaction.sign([payer]);

// Send the signed transaction to the network
const transactionSignature = await connection.sendTransaction(transaction);
```

## Address Lookup Table

Ang Address Lookup Tables (tinatawag ding lookup tables o LUTs) ay mga account na nag-iimbak ng lookup table ng iba pang mga address ng account. Ang mga LUT account na ito ay pagmamay-ari ng Address Lookup Table Program at ginagamit upang madagdagan ang bilang ng mga account na maaaring isama sa isang transaksyon.

Maaaring kasama sa mga bersyong transaksyon ang address ng isang LUT account at pagkatapos ay sumangguni sa mga karagdagang account na may 1-byte na index sa halip na isama ang buong address ng mga account na iyon. Ito ay makabuluhang binabawasan ang dami ng espasyong ginagamit para sa pagtukoy ng mga account sa isang transaksyon.

Upang pasimplehin ang proseso ng pagtatrabaho sa mga LUT, ang library ng `@solana/web3.js` ay may kasamang klase ng `AddressLookupTableProgram` na nagbibigay ng isang hanay ng mga pamamaraan upang lumikha ng mga tagubilin para sa pamamahala ng mga LUT. Kasama sa mga pamamaraang ito ang:

- `createLookupTable` - lumilikha ng bagong LUT account
- `freezeLookupTable` - ginagawang hindi nababago ang isang umiiral na LUT
- `extendLookupTable` - nagdaragdag ng mga address sa isang umiiral nang LUT
- `deactivateLookupTable` - naglalagay ng LUT sa panahon ng “deactivation” bago ito maisara
- `closeLookupTable` - permanenteng isinasara ang isang LUT account

### Create a lookup table

Ginagamit mo ang paraan ng `createLookupTable` upang bumuo ng pagtuturo na lumilikha ng lookup table. Ang function ay nangangailangan ng mga sumusunod na parameter:

- `authority` - ang account na magkakaroon ng pahintulot na baguhin ang lookup table
- `payer` - ang account na magbabayad para sa paggawa ng account
- `recentSlot` - isang kamakailang puwang upang makuha ang address ng lookup table

Ibinabalik ng function ang parehong pagtuturo upang lumikha ng lookup table at ang address ng lookup table.

```typescript
// Get the current slot
const slot = await connection.getSlot();

// Create an instruction for creating a lookup table
// and retrieve the address of the new lookup table
const [lookupTableInst, lookupTableAddress] =
    web3.AddressLookupTableProgram.createLookupTable({
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        recentSlot: slot - 1, // The recent slot to derive lookup table's address
    });
```

Sa ilalim ng hood, ang lookup table address ay isang PDA na hinango lamang gamit ang `authority` at `recentSlot` bilang seeds.

```typescript
const [lookupTableAddress, bumpSeed] = PublicKey.findProgramAddressSync(
    [params.authority.toBuffer(), toBufferLE(BigInt(params.recentSlot), 8)],
    this.programId,
);
```

Tandaan na ang paggamit ng pinakabagong slot ay minsan nagreresulta sa isang error pagkatapos ipadala ang transaksyon. Para maiwasan ito, maaari kang gumamit ng slot na isang slot bago ang pinakabago (hal. `recentSlot: slot - 1`). Gayunpaman, kung nakatagpo ka pa rin ng isang error sa pagpapadala ng transaksyon, maaari mong subukang ipadala muli ang transaksyon.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"188115589 is not a recent slot",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid instruction data";
```

### Extend a lookup table

Ginagamit mo ang paraan ng `extendLookupTable` upang lumikha ng isang pagtuturo na nagdaragdag ng mga address sa isang kasalukuyang lookup table. Kinakailangan ang mga sumusunod na parameter:

- `payer` - ang account na magbabayad para sa mga bayarin sa transaksyon at anumang tumaas na upa
- `authority` - ang account na may pahintulot na baguhin ang lookup table
- `lookupTable` - ang address ng lookup table na palawigin
- `address` - ang mga address na idaragdag sa lookup table

Ang function ay nagbabalik ng isang tagubilin upang i-extend ang lookup table.

```typescript
const addresses = [
    new web3.PublicKey("31Jy3nFeb5hKVdB4GS4Y7MhU7zhNMFxwF7RGVhPc1TzR"),
    new web3.PublicKey("HKSeapcvwJ7ri6mf3HwBtspLFTDKqaJrMsozdfXfg5y2"),
    // add more addresses
];

// Create an instruction to extend a lookup table with the provided addresses
const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
    payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
    lookupTable: lookupTableAddress, // The address of the lookup table to extend
    addresses: addresses, // The addresses to add to the lookup table
});
```

Tandaan na kapag nagpapalawak ng lookup table, ang bilang ng mga address na maaaring idagdag sa isang pagtuturo ay nililimitahan ng limitasyon sa laki ng transaksyon, na 1232 bytes. Nangangahulugan ito na maaari kang magdagdag ng 30 address sa isang lookup table sa isang pagkakataon. Kung kailangan mong magdagdag ng higit pa riyan, kakailanganin mong magpadala ng maraming transaksyon. Ang bawat lookup table ay maaaring mag-imbak ng maximum na 256 na mga address.

### Send Transaction

Pagkatapos gawin ang mga tagubilin, maaari mong idagdag ang mga ito sa isang transaksyon at ipadala sa network.

```typescript
// Get the latest blockhash
let { blockhash } = await connection.getLatestBlockhash();

// Create the transaction message
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // Public key of the account that will pay for the transaction
    recentBlockhash: blockhash, // Latest blockhash
    instructions: [lookupTableInst, extendInstruction], // Instructions included in transaction
}).compileToV0Message();

// Create the versioned transaction using the message
const transaction = new web3.VersionedTransaction(message);

// Sign the transaction
transaction.sign([payer]);

// Send the signed transaction to the network
const transactionSignature = await connection.sendTransaction(transaction);
```

Tandaan na noong una kang gumawa o nag-extend ng lookup table o kung kailan, kailangan nitong "magpainit" para sa isang slot bago magamit ang LUT o mga bagong address sa mga transaksyon. Sa madaling salita, maaari ka lamang gumamit ng mga lookup table at access address na idinagdag bago ang kasalukuyang slot.

```typescript
SendTransactionError: failed to send transaction: invalid transaction: Transaction address table lookup uses an invalid index
```

Kung nakatagpo ka ng error sa itaas o hindi ma-access ang mga address sa isang lookup table kaagad pagkatapos itong palawigin, ito ay malamang dahil sinusubukan mong i-access ang lookup table o isang partikular na address bago matapos ang panahon ng warm up. Upang maiwasan ang isyung ito, magdagdag ng pagkaantala pagkatapos palawigin ang lookup table bago magpadala ng transaksyon na tumutukoy sa talahanayan.

### Deactivate a lookup table

Kapag hindi na kailangan ng lookup table, maaari mo itong i-deactivate at isara para mabawi ang balanse nito sa upa. Maaaring i-deactivate ang mga talahanayan ng paghahanap ng address anumang oras, ngunit maaari silang patuloy na gamitin ng mga transaksyon hanggang sa hindi na "recent" ang isang tinukoy na "deactivation" slot. Tinitiyak ng "cool-down" na panahon na ito na ang mga in-flight na transaksyon ay hindi ma-censor ng mga LUT na isinara at muling ginawa sa parehong slot. Ang panahon ng pag-deactivate ay humigit-kumulang 513 na mga puwang.

Upang i-deactivate ang isang LUT, gamitin ang paraan ng `deactivateLookupTable` at ipasa ang mga sumusunod na parameter:

- `lookupTable` - ang address ng LUT na ide-deactivate
- `authority` - ang account na may pahintulot na i-deactivate ang LUT

```typescript
const deactivateInstruction =
    web3.AddressLookupTableProgram.deactivateLookupTable({
        lookupTable: lookupTableAddress, // The address of the lookup table to deactivate
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
    });
```

### Close a lookup table

Upang isara ang lookup table pagkatapos ng panahon ng pag-deactivate nito, gamitin ang `closeLookupTable` na paraan. Lumilikha ang paraang ito ng tagubilin upang isara ang isang na-deactivate na lookup table at bawiin ang balanse nito sa upa. Kinakailangan ang mga sumusunod na parameter:

- `lookupTable` - ang address ng LUT na isasara
- `authority` - ang account na may pahintulot na isara ang LUT
- `recipient` - ang account na tatanggap ng na-reclaim na balanse sa upa

```typescript
const closeInstruction = web3.AddressLookupTableProgram.closeLookupTable({
    lookupTable: lookupTableAddress, // The address of the lookup table to close
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
    recipient: user.publicKey, // The recipient of closed account lamports
});
```

Ang pagtatangkang isara ang isang lookup table bago ito ganap na na-deactivate ay magreresulta sa isang error.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Table cannot be closed until it's fully deactivated in 513 blocks",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid program argument";
```

### Freeze a lookup table

Bilang karagdagan sa mga karaniwang pagpapatakbo ng CRUD, maaari mong "i-freeze" ang isang lookup table. Ginagawa nitong hindi nababago upang hindi na ito ma-extend, ma-deactivate, o maisara.

Nag-freeze ka ng lookup table gamit ang `freezeLookupTable` na paraan. Kinakailangan ang mga sumusunod na parameter:

- `lookupTable` - ang address ng LUT na ipi-freeze
- `authority` - ang account na may pahintulot na i-freeze ang LUT

```typescript
const freezeInstruction = web3.AddressLookupTableProgram.freezeLookupTable({
    lookupTable: lookupTableAddress, // The address of the lookup table to freeze
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
});
```

Kapag na-freeze ang isang LUT, magreresulta sa error ang anumang karagdagang pagtatangka na baguhin ito.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Lookup table is frozen",
"Program AddressLookupTab1e1111111111111111111111111 failed: Account is immutable";
```

### Using lookup tables in versioned transactions

Upang gumamit ng lookup table sa isang bersyon na transaksyon, kailangan mong kunin ang lookup table account gamit ang address nito.

```typescript
const lookupTableAccount = (
    await connection.getAddressLookupTable(lookupTableAddress)
).value;
```

Pagkatapos ay maaari kang lumikha ng isang listahan ng mga tagubilin na isasama sa isang transaksyon gaya ng dati. Kapag gumagawa ng `TransactionMessage`, maaari mong isama ang anumang lookup table account sa pamamagitan ng pagpasa sa mga ito bilang array sa `compileToV0Message()` na paraan. Maaari ka ring magbigay ng maramihang lookup table account.

```typescript
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
    recentBlockhash: blockhash, // The blockhash of the most recent block
    instructions: instructions, // The instructions to include in the transaction
}).compileToV0Message([lookupTableAccount]); // Include lookup table accounts

// Create the versioned transaction using the message
const transaction = new web3.VersionedTransaction(message);

// Sign the transaction
transaction.sign([payer]);

// Send the signed transaction to the network
const transactionSignature = await connection.sendTransaction(transaction);
```

# Demo

Sige at magsanay tayo gamit ang mga lookup table!

Gagabayan ka ng demo na ito sa mga hakbang ng paggawa, pagpapalawak, at pagkatapos ay paggamit ng lookup table sa isang may bersyong transaksyon.

### 1. Get the starter code

Upang magsimula, i-download ang starter code mula sa starter branch nitong [repository](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/starter). Kapag mayroon ka na ng starter code, patakbuhin ang `npm install` sa terminal para i-install ang mga kinakailangang dependencies.

Kasama sa starter code ang isang halimbawa ng paggawa ng isang legacy na transaksyon na naglalayong ilipat ang SOL sa atomically sa 22 na tatanggap. Ang transaksyon ay naglalaman ng 22 mga tagubilin kung saan ang bawat tagubilin ay naglilipat ng SOL mula sa pumirma patungo sa ibang tatanggap.

Ang layunin ng starter code ay upang ilarawan ang limitasyon sa bilang ng mga address na maaaring isama sa isang legacy na transaksyon. Ang transaksyon na binuo sa starter code ay inaasahang mabibigo kapag ipinadala.

Ang sumusunod na starter code ay matatagpuan sa `index.ts` file.

```typescript
import { initializeKeypair } from "./initializeKeypair";
import * as web3 from "@solana/web3.js";

async function main() {
    // Connect to the devnet cluster
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialize the user's keypair
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Generate 22 addresses
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    // Create an array of transfer instructions
    const transferInstructions = [];

    // Add a transfer instruction for each address
    for (const address of recipients) {
        transferInstructions.push(
            web3.SystemProgram.transfer({
                fromPubkey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
                toPubkey: address, // The destination account for the transfer
                lamports: web3.LAMPORTS_PER_SOL * 0.01, // The amount of lamports to transfer
            }),
        );
    }

    // Create a transaction and add the transfer instructions
    const transaction = new web3.Transaction().add(...transferInstructions);

    // Send the transaction to the cluster (this will fail in this example if addresses > 21)
    const txid = await connection.sendTransaction(transaction, [user]);

    // Get the latest blockhash and last valid block height
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // Confirm the transaction
    await connection.confirmTransaction({
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
        signature: txid,
    });

    // Log the transaction URL on the Solana Explorer
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

Upang isagawa ang code, patakbuhin ang `npm start`. Gagawa ito ng bagong keypair, isusulat ito sa `.env` na file, airdrop devnet SOL sa keypair, at ipapadala ang transaksyong binuo sa starter code. Ang transaksyon ay inaasahang mabibigo sa mensahe ng error na `Masyadong malaki ang transaksyon.`

```
Creating .env file
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: 5ZZzcDbabFHmoZU8vm3VzRzN5sSQhkf91VJzHAJGNM7B
Error: Transaction too large: 1244 > 1232
```

Sa mga susunod na hakbang, tatalakayin natin kung paano gamitin ang mga lookup table na may mga bersyong transaksyon upang madagdagan ang bilang ng mga address na maaaring isama sa isang transaksyon.

Bago tayo magsimula, magpatuloy at tanggalin ang nilalaman ng `pangunahing` function upang iwan lamang ang sumusunod:

```typescript
async function main() {
    // Connect to the devnet cluster
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialize the user's keypair
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Generate 22 addresses
    const addresses = [];
    for (let i = 0; i < 22; i++) {
        addresses.push(web3.Keypair.generate().publicKey);
    }
}
```

### 2. Create a `sendV0Transaction` helper function

Magpapadala kami ng maramihang "bersyon 0" na mga transaksyon, kaya gumawa tayo ng function ng helper upang mapadali ito.

Ang function na ito ay dapat kumuha ng mga parameter para sa isang koneksyon, keypair ng isang user, isang hanay ng mga tagubilin sa transaksyon, at isang opsyonal na hanay ng mga lookup table account.

Ang function ay pagkatapos ay nagsasagawa ng mga sumusunod na gawain:

- Kinukuha ang pinakabagong blockhash at huling wastong taas ng block mula sa network ng Solana
- Lumilikha ng bagong mensahe ng transaksyon gamit ang ibinigay na mga tagubilin
- Pinirmahan ang transaksyon gamit ang keypair ng user
- Ipinapadala ang transaksyon sa network ng Solana
- Kinukumpirma ang transaksyon
- Nila-log ang URL ng transaksyon sa Solana Explorer

```typescript
async function sendV0Transaction(
    connection: web3.Connection,
    user: web3.Keypair,
    instructions: web3.TransactionInstruction[],
    lookupTableAccounts?: web3.AddressLookupTableAccount[],
) {
    // Get the latest blockhash and last valid block height
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // Create a new transaction message with the provided instructions
    const messageV0 = new web3.TransactionMessage({
        payerKey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        recentBlockhash: blockhash, // The blockhash of the most recent block
        instructions, // The instructions to include in the transaction
    }).compileToV0Message(
        lookupTableAccounts ? lookupTableAccounts : undefined,
    );

    // Create a new transaction object with the message
    const transaction = new web3.VersionedTransaction(messageV0);

    // Sign the transaction with the user's keypair
    transaction.sign([user]);

    // Send the transaction to the cluster
    const txid = await connection.sendTransaction(transaction);

    // Confirm the transaction
    await connection.confirmTransaction(
        {
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
            signature: txid,
        },
        "finalized",
    );

    // Log the transaction URL on the Solana Explorer
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

### 3. Create a `waitForNewBlock` helper function

Tandaan na ang mga lookup table at ang mga address na nakapaloob sa mga ito ay hindi maaaring i-reference kaagad pagkatapos gawin o extension. Nangangahulugan ito na kakailanganin naming maghintay para sa isang bagong bloke bago magsumite ng mga transaksyon na tumutukoy sa bagong likha o pinalawig na talahanayan ng paghahanap. Upang gawing mas simple ito sa hinaharap, gumawa tayo ng `waitForNewBlock` helper function na gagamitin namin upang hintayin ang mga lookup table na ma-activate sa pagitan ng pagpapadala ng mga transaksyon.

Ang function na ito ay magkakaroon ng mga parameter para sa isang koneksyon at isang target na taas ng block. Pagkatapos ay magsisimula ito ng agwat na sumusuri sa kasalukuyang taas ng block ng network tuwing 1000ms. Kapag lumampas na sa target na taas ang bagong block height, ang agwat ay iki-clear at ang pangako ay naresolba.

```typescript
function waitForNewBlock(connection: web3.Connection, targetHeight: number) {
    console.log(`Waiting for ${targetHeight} new blocks`);
    return new Promise(async (resolve: any) => {
        // Get the last valid block height of the blockchain
        const { lastValidBlockHeight } = await connection.getLatestBlockhash();

        // Set an interval to check for new blocks every 1000ms
        const intervalId = setInterval(async () => {
            // Get the new valid block height
            const { lastValidBlockHeight: newValidBlockHeight } =
                await connection.getLatestBlockhash();
            // console.log(newValidBlockHeight)

            // Check if the new valid block height is greater than the target block height
            if (newValidBlockHeight > lastValidBlockHeight + targetHeight) {
                // If the target block height is reached, clear the interval and resolve the promise
                clearInterval(intervalId);
                resolve();
            }
        }, 1000);
    });
}
```

### 4. Create an `initializeLookupTable` function

Ngayong mayroon na kaming ilang function ng helper na handa nang gamitin, magdeklara ng function na pinangalanang `initializeLookupTable`. Ang function na ito ay may mga parameter na `user`, `connection`, at `address`. Ang function ay:

1. Kunin ang kasalukuyang slot
2. Bumuo ng tagubilin para sa paggawa ng lookup table
3. Bumuo ng isang tagubilin para sa pagpapalawak ng lookup table na may ibinigay na mga address
4. Magpadala at kumpirmahin ang isang transaksyon na may mga tagubilin para sa paggawa at pagpapahaba ng lookup table
5. Ibalik ang address ng lookup table

```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Get the current slot
    const slot = await connection.getSlot();

    // Create an instruction for creating a lookup table
    // and retrieve the address of the new lookup table
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
            payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            recentSlot: slot - 1, // The recent slot to derive lookup table's address
        });
    console.log("lookup table address:", lookupTableAddress.toBase58());

    // Create an instruction to extend a lookup table with the provided addresses
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        lookupTable: lookupTableAddress, // The address of the lookup table to extend
        addresses: addresses.slice(0, 30), // The addresses to add to the lookup table
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    return lookupTableAddress;
}
```

### 5. Modify `main` to use lookup tables

Ngayon na maaari na nating simulan ang isang lookup table kasama ang lahat ng address ng mga tatanggap, i-update natin ang `main` upang gumamit ng mga bersyon na transaksyon at lookup table. Kakailanganin nating:

1. Tawagan ang `initializeLookupTable`
2. Tawagan ang `waitForNewBlock`
3. Kunin ang lookup table gamit ang `connection.getAddressLookupTable`
4. Lumikha ng pagtuturo sa paglipat para sa bawat tatanggap
5. Ipadala ang v0 na transaksyon kasama ang lahat ng mga tagubilin sa paglipat

```typescript
async function main() {
    // Connect to the devnet cluster
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialize the user's keypair
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Generate 22 addresses
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    const lookupTableAddress = await initializeLookupTable(
        user,
        connection,
        recipients,
    );

    await waitForNewBlock(connection, 1);

    const lookupTableAccount = (
        await connection.getAddressLookupTable(lookupTableAddress)
    ).value;

    if (!lookupTableAccount) {
        throw new Error("Lookup table not found");
    }

    const transferInstructions = recipients.map((recipient) => {
        return web3.SystemProgram.transfer({
            fromPubkey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            toPubkey: recipient, // The destination account for the transfer
            lamports: web3.LAMPORTS_PER_SOL * 0.01, // The amount of lamports to transfer
        });
    });

    await sendV0Transaction(connection, user, transferInstructions, [
        lookupTableAccount,
    ]);
}
```

Pansinin na gagawa ka ng mga tagubilin sa paglipat gamit ang buong address ng tatanggap kahit na gumawa kami ng lookup table. Iyon ay dahil sa pagsasama ng lookup table sa may bersyong transaksyon, sasabihin mo sa `web3.js` framework na palitan ang anumang mga address ng tatanggap na tumutugma sa mga address sa lookup table na may mga pointer sa lookup table sa halip. Sa oras na maipadala ang transaksyon sa network, ang mga address na umiiral sa lookup table ay ire-reference ng isang byte kaysa sa buong 32 byte.

Gamitin ang `npm start` sa command line para isagawa ang `main` function. Dapat mong makita ang output na katulad ng sumusunod:

```bash
Current balance is 1.38866636
PublicKey: 8iGVBt3dcJdp9KfyTRcKuHY6gXCMFdnSG2F1pAwsUTMX
lookup table address: Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M
https://explorer.solana.com/tx/4JvCo2azy2u8XK2pU8AnJiHAucKTrZ6QX7EEHVuNSED8B5A8t9GqY5CP9xB8fZpTNuR7tbUcnj2MiL41xRJnLGzV?cluster=devnet
Waiting for 1 new blocks
https://explorer.solana.com/tx/rgpmxGU4QaAXw9eyqfMUqv8Lp6LHTuTyjQqDXpeFcu1ijQMmCH2V3Sb54x2wWAbnWXnMpJNGg4eLvuy3r8izGHt?cluster=devnet
Finished successfully
```

Ang unang link ng transaksyon sa console ay kumakatawan sa transaksyon para sa paggawa at pagpapahaba ng lookup table. Ang pangalawang transaksyon ay kumakatawan sa mga paglilipat sa lahat ng mga tatanggap. Huwag mag-atubiling suriin ang mga transaksyong ito sa explorer.

Tandaan, ang parehong transaksyon ay nabigo noong una mong na-download ang starter code. Ngayon na gumagamit na kami ng mga lookup table, magagawa namin ang lahat ng 22 paglilipat sa isang transaksyon.

### 6. Add more address to the lookup table

Tandaan na ang solusyon na naisip namin sa ngayon ay sumusuporta lamang sa mga paglilipat sa hanggang 30 account dahil isang beses lang namin pinalawig ang lookup table. Kapag isinaalang-alang mo ang laki ng pagtuturo sa paglilipat, talagang posible na palawigin ang talahanayan ng paghahanap na may karagdagang 27 address at kumpletuhin ang isang atomic na paglipat sa hanggang 57 na tatanggap. Sige at magdagdag tayo ng suporta para dito ngayon!

Ang kailangan lang nating gawin ay pumunta sa `initializeLookupTable` at gawin ang dalawang bagay:

1. Baguhin ang kasalukuyang tawag sa `extendLookupTable` upang idagdag lamang ang unang 30 addressess (higit pa riyan at ang transaksyon ay magiging masyadong malaki)
2. Magdagdag ng loop na patuloy na magpapalawak ng lookup table 30 address sa isang pagkakataon hanggang sa maidagdag ang lahat ng address

```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Get the current slot
    const slot = await connection.getSlot();

    // Create an instruction for creating a lookup table
    // and retrieve the address of the new lookup table
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
            payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            recentSlot: slot - 1, // The recent slot to derive lookup table's address
        });
    console.log("lookup table address:", lookupTableAddress.toBase58());

    // Create an instruction to extend a lookup table with the provided addresses
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        lookupTable: lookupTableAddress, // The address of the lookup table to extend
        addresses: addresses.slice(0, 30), // The addresses to add to the lookup table
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    var remaining = addresses.slice(30);

    while (remaining.length > 0) {
        const toAdd = remaining.slice(0, 30);
        remaining = remaining.slice(30);
        const extendInstruction =
            web3.AddressLookupTableProgram.extendLookupTable({
                payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
                authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
                lookupTable: lookupTableAddress, // The address of the lookup table to extend
                addresses: toAdd, // The addresses to add to the lookup table
            });

        await sendV0Transaction(connection, user, [extendInstruction]);
    }

    return lookupTableAddress;
}
```

Binabati kita! Kung maganda ang pakiramdam mo tungkol sa demo na ito, malamang na handa ka nang magtrabaho nang mag-isa sa mga lookup table at may bersyong transaksyon. Kung gusto mong tingnan ang panghuling solusyon code maaari mong [hanapin ito sa sangay ng solusyon](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/solution).

# Challenge

Bilang isang hamon, mag-eksperimento sa pag-deactivate, pagsasara at pagyeyelo ng mga talahanayan ng paghahanap. Tandaan na kailangan mong maghintay para sa isang lookup table na matapos ang pag-deactivate bago mo ito maisara. Gayundin, kung ang isang lookup table ay naka-freeze, hindi ito maaaring baguhin (deactivated o sarado), kaya kailangan mong subukan nang hiwalay o gumamit ng hiwalay na lookup table.

1. Gumawa ng function para sa pag-deactivate ng lookup table.
2. Gumawa ng function para sa pagsasara ng lookup table
3. Gumawa ng function para sa pagyeyelo ng lookup table
4. Subukan ang mga function sa pamamagitan ng pagtawag sa kanila sa `main()` function

Maaari mong muling gamitin ang mga function na ginawa namin sa demo para sa pagpapadala ng transaksyon at paghihintay para sa lookup table na i-activate/deactivate. Huwag mag-atubiling i-reference ang [solution code](https://github.com/Unboxed-Software/versioned-transaction/tree/challenge).

---
title: Objetivos de Transacciones Versionadas y Tablas de Búsqueda
objectives:
- Crear transacciones versionadas
- Crear tablas de búsqueda
- Extender tablas de búsqueda
- Usar tablas de búsqueda con transacciones versionadas
---

# TL;DR

-   **Transacciones Versionadas** se refiere a una forma de admitir versiones heredadas y versiones más nuevas de formatos de transacción. El formato de transacción original es "legado" y las nuevas versiones de transacción comienzan en la versión 0. Las transacciones versionadas se implementaron para admitir el uso de tablas de búsqueda de direcciones (también llamadas tablas de búsqueda o LUT).
-   **Tablas de búsqueda de direcciones** son cuentas utilizadas para almacenar direcciones de otras cuentas, que luego pueden ser referenciadas en transacciones versionadas utilizando un índice de 1 byte en lugar de los 32 bytes completos por dirección. Esto permite la creación de transacciones más complejas de lo que era posible antes de la introducción de los LUT.

# Descripción general

Por diseño, las transacciones de Solana están limitadas a 1232 bytes. Las transacciones que excedan este tamaño fallarán. Si bien esto permite una serie de optimizaciones de red, también puede limitar los tipos de operaciones atómicas que se pueden realizar en la red.

Para ayudar a evitar la limitación del tamaño de la transacción, Solana lanzó un nuevo formato de transacción que permite el soporte para múltiples versiones de formatos de transacción. Al momento de escribir este artículo, Solana soporta dos versiones de transacción:

1.  `legacy` - el formato de transacción original
2.  `0` - el formato de transacción más reciente que incluye soporte para tablas de búsqueda de direcciones

Las transacciones versionadas no requieren ninguna modificación a los programas existentes de Solana, pero cualquier código del lado del cliente creado antes del lanzamiento de las transacciones versionadas debe actualizarse. En esta lección, cubriremos los conceptos básicos de las transacciones versionadas y cómo usarlas, incluyendo:

-   Creación de transacciones versionadas
-   Creación y gestión de tablas de consulta
-   Uso de tablas de búsqueda en transacciones versionadas

## Transacciones Versionadas

Uno de los ítems que más espacio ocupan las transacciones de Solana es la inclusión de direcciones de cuenta completas. Con 32 bytes cada una, 39 cuentas representarán una transacción demasiado grande. Eso ni siquiera contabiliza los datos de instrucción. En la práctica, la mayoría de las transacciones serán demasiado grandes con alrededor de 20 cuentas.

Solana lanzó transacciones versionadas para admitir múltiples formatos de transacción. Junto con el lanzamiento de transacciones versionadas, Solana lanzó la versión 0 de transacciones para admitir tablas de búsqueda de direcciones. Las tablas de búsqueda son cuentas separadas que almacenan direcciones de cuenta y luego permiten que se haga referencia a ellas en una transacción utilizando un índice de 1 byte. Esto disminuye significativamente el tamaño de una transacción ya que cada cuenta incluida ahora solo necesita usar 1 byte en lugar de 32 bytes.

Incluso si no necesita usar tablas de búsqueda, necesitará saber cómo admitir transacciones versionadas en su código del lado del cliente. Afortunadamente, todo lo que necesita para trabajar con transacciones versionadas y tablas de búsqueda está incluido en la `@solana/web3.js` biblioteca.

### Crear transacción versionada

Para crear una transacción versionada, simplemente cree una `TransactionMessage` con los siguientes parámetros:

-   `payerKey` - la clave pública de la cuenta que pagará la transacción
-   `recentBlockhash` - un blockhash reciente de la red
-   `instructions` - las instrucciones a incluir en la transacción

A continuación, transforme este objeto de mensaje en una `0` transacción de versión utilizando el `compileToV0Message()` método.

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

Finalmente, pasa el mensaje compilado al `VersionedTransaction` constructor para crear una nueva transacción versionada. Su código puede firmar y enviar la transacción a la red, similar a una transacción heredada.

```typescript
// Create the versioned transaction using the message
const transaction = new web3.VersionedTransaction(message);

// Sign the transaction
transaction.sign([payer]);

// Send the signed transaction to the network
const transactionSignature = await connection.sendTransaction(transaction);
```

## Tabla de búsqueda de direcciones

Las tablas de búsqueda de direcciones (también llamadas tablas de búsqueda o LUT) son cuentas que almacenan una tabla de búsqueda de otras direcciones de cuenta. Estas cuentas LUT son propiedad del Programa de tabla de búsqueda de direcciones y se utilizan para aumentar el número de cuentas que se pueden incluir en una sola transacción.

Las transacciones versionadas pueden incluir la dirección de una cuenta LUT y luego hacer referencia a cuentas adicionales con un índice de 1 byte en lugar de incluir la dirección completa de esas cuentas. Esto reduce significativamente la cantidad de espacio utilizado para hacer referencia a las cuentas en una transacción.

Para simplificar el proceso de trabajo con LUTs, la `@solana/web3.js` biblioteca incluye una `AddressLookupTableProgram` clase que proporciona un conjunto de métodos para crear instrucciones para la gestión de LUTs. Estos métodos incluyen:

-   `createLookupTable` - crea una nueva cuenta LUT
-   `freezeLookupTable` - hace que un LUT existente sea inmutable
-   `extendLookupTable` - añade direcciones a un LUT existente
-   `deactivateLookupTable` - pone un LUT en un período de "desactivación" antes de que pueda cerrarse
-   `closeLookupTable` - cierra permanentemente una cuenta LUT

### Crear una tabla de búsqueda

Utiliza el `createLookupTable` método para construir la instrucción que crea una tabla de búsqueda. La función requiere los siguientes parámetros:

-   `authority` - la cuenta que tendrá permiso para modificar la tabla de búsqueda
-   `payer` - la cuenta que pagará por la creación de la cuenta
-   `recentSlot` - una ranura reciente para derivar la dirección de la tabla de búsqueda

La función devuelve tanto la instrucción para crear la tabla de consulta como la dirección de la tabla de consulta.

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

Bajo el capó, la dirección de la tabla de búsqueda es simplemente un PDA derivado usando el `authority` y `recentSlot` como semillas.

```typescript
const [lookupTableAddress, bumpSeed] = PublicKey.findProgramAddressSync(
    [params.authority.toBuffer(), toBufferLE(BigInt(params.recentSlot), 8)],
    this.programId,
);
```

Tenga en cuenta que el uso de la ranura más reciente a veces resulta en un error después de enviar la transacción. Para evitar esto, puede usar una ranura que es una ranura antes de la más reciente (por ejemplo `recentSlot: slot - 1`). Sin embargo, si aún encuentra un error al enviar la transacción, puede intentar reenviar la transacción.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"188115589 is not a recent slot",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid instruction data";
```

### Extender una tabla de búsqueda

Utilice el `extendLookupTable` método para crear una instrucción que añada direcciones a una tabla de búsqueda existente. Toma los siguientes parámetros:

-   `payer` - la cuenta que pagará las tarifas de transacción y cualquier aumento de alquiler
-   `authority` - la cuenta que tiene permiso para cambiar la tabla de búsqueda
-   `lookupTable` - la dirección de la tabla de búsqueda para extender
-   `addresses` - las direcciones a añadir a la tabla de búsqueda

La función devuelve una instrucción para extender la tabla de búsqueda.

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

Tenga en cuenta que al extender una tabla de búsqueda, el número de direcciones que se pueden agregar en una instrucción está limitado por el límite de tamaño de transacción, que es de 1232 bytes. Esto significa que puede añadir 30 direcciones a una tabla de búsqueda a la vez. Si necesitas añadir más que eso, tendrás que enviar varias transacciones. Cada tabla de búsqueda puede almacenar un máximo de 256 direcciones.

### Enviar transacción

Después de crear las instrucciones, puede añadirlas a una transacción y enviarlas a la red.

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

Tenga en cuenta que cuando crea o extiende una tabla de búsqueda por primera vez o cuando, necesita "calentarse" para una ranura antes de que el LUT o las nuevas direcciones se puedan usar en las transacciones. En otras palabras, solo puede usar tablas de búsqueda y direcciones de acceso que se hayan añadido antes de la ranura actual.

```typescript
SendTransactionError: failed to send transaction: invalid transaction: Transaction address table lookup uses an invalid index
```

Si encuentra el error anterior o no puede acceder a las direcciones en una tabla de búsqueda inmediatamente después de extenderla, es probable que esté intentando acceder a la tabla de búsqueda o a una dirección específica antes del final del período de calentamiento. Para evitar este problema, agregue un retraso después de extender la tabla de búsqueda antes de enviar una transacción que haga referencia a la tabla.

### Desactivar una tabla de búsqueda

Cuando ya no se necesita una tabla de búsqueda, puede desactivarla y cerrarla para recuperar su saldo de alquiler. Las tablas de búsqueda de direcciones se pueden desactivar en cualquier momento, pero pueden continuar siendo utilizadas por las transacciones hasta que una ranura de "desactivación" especificada ya no sea "reciente". Este período de "enfriamiento" garantiza que las transacciones en vuelo no puedan ser censuradas por los LUT que se cierran y recrean en la misma ranura. El periodo de desactivación es de aproximadamente 513 ranuras.

Para desactivar una LUT, utilice el `deactivateLookupTable` método y pase los siguientes parámetros:

-   `lookupTable` - la dirección de la LUT a desactivar
-   `authority` - la cuenta con permiso para desactivar el LUT

```typescript
const deactivateInstruction =
    web3.AddressLookupTableProgram.deactivateLookupTable({
        lookupTable: lookupTableAddress, // The address of the lookup table to deactivate
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
    });
```

### Cerrar una tabla de búsqueda

Para cerrar una tabla de consulta después de su periodo de desactivación, utilice el `closeLookupTable` método. Este método crea una instrucción para cerrar una tabla de búsqueda desactivada y recuperar su saldo de alquiler. Toma los siguientes parámetros:

-   `lookupTable` - la dirección de la LUT que se cerrará
-   `authority` - la cuenta con permiso para cerrar el LUT
-   `recipient` - la cuenta que recibirá el saldo de alquiler reclamado

```typescript
const closeInstruction = web3.AddressLookupTableProgram.closeLookupTable({
    lookupTable: lookupTableAddress, // The address of the lookup table to close
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
    recipient: user.publicKey, // The recipient of closed account lamports
});
```

Si intenta cerrar una tabla de búsqueda antes de que se haya desactivado por completo, se producirá un error.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Table cannot be closed until it's fully deactivated in 513 blocks",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid program argument";
```

### Congelar una tabla de búsqueda

Además de las operaciones estándar de CRUD, puede "congelar" una tabla de búsqueda. Esto lo hace inmutable para que ya no pueda extenderse, desactivarse o cerrarse.

Congela una tabla de búsqueda con el `freezeLookupTable` método. Toma los siguientes parámetros:

-   `lookupTable` - la dirección del LUT que se va a congelar
-   `authority` - la cuenta con permiso para congelar el LUT

```typescript
const freezeInstruction = web3.AddressLookupTableProgram.freezeLookupTable({
    lookupTable: lookupTableAddress, // The address of the lookup table to freeze
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
});
```

Una vez que se congela un LUT, cualquier intento adicional de modificarlo dará como resultado un error.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Lookup table is frozen",
"Program AddressLookupTab1e1111111111111111111111111 failed: Account is immutable";
```

### Uso de tablas de búsqueda en transacciones versionadas

Para utilizar una tabla de búsqueda en una transacción versionada, debe recuperar la cuenta de la tabla de búsqueda utilizando su dirección.

```typescript
const lookupTableAccount = (
    await connection.getAddressLookupTable(lookupTableAddress)
).value;
```

A continuación, puede crear una lista de instrucciones para incluir en una transacción como de costumbre. Al crear el `TransactionMessage`, puede incluir cualquier cuenta de tabla de búsqueda pasándolas como una matriz al `compileToV0Message()` método. También puede proporcionar varias cuentas de tabla de búsqueda.

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

# Demostración

¡Sigamos adelante y practiquemos el uso de tablas de búsqueda!

Esta demostración lo guiará a través de los pasos de creación, extensión y luego uso de una tabla de búsqueda en una transacción versionada.

### 1. Obtener el código de inicio

Para comenzar, descargue el código de inicio de la rama de inicio de este[repository](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/starter). Una vez que tenga el código de inicio, ejecute `npm install` en la terminal para instalar las dependencias requeridas.

El código de inicio incluye un ejemplo de creación de una transacción heredada que pretende transferir atómicamente SOL a 22 destinatarios. La transacción contiene 22 instrucciones donde cada instrucción transfiere SOL del firmante a un destinatario diferente.

El propósito del código de inicio es ilustrar la limitación en el número de direcciones que se pueden incluir en una transacción heredada. Se espera que la transacción incorporada en el código de inicio falle cuando se envíe.

El siguiente código de inicio se puede encontrar en el `index.ts` archivo.

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

Para ejecutar el código, ejecute `npm start`. Esto creará un nuevo par de claves, lo escribirá en el `.env` archivo, airdrop devnet SOL al par de claves y enviará la transacción incorporada en el código de inicio. Se espera que la transacción falle con el mensaje de error `Transaction too large`.

```
Creating .env file
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: 5ZZzcDbabFHmoZU8vm3VzRzN5sSQhkf91VJzHAJGNM7B
Error: Transaction too large: 1244 > 1232
```

En los siguientes pasos, repasaremos cómo usar tablas de búsqueda con transacciones versionadas para aumentar el número de direcciones que se pueden incluir en una sola transacción.

Antes de comenzar, siga adelante y elimine el contenido de la `main` función para dejar solo lo siguiente:

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

### 2. Crear una función de `sendV0Transaction` ayuda

Enviaremos varias transacciones de "versión 0", así que vamos a crear una función de ayuda para facilitar esto.

Esta función debe tomar parámetros para una conexión, el par de claves de un usuario, una matriz de instrucciones de transacción y una matriz opcional de cuentas de tabla de búsqueda.

A continuación, la función realiza las siguientes tareas:

-   Recupera el blockhash más reciente y la última altura de bloque válida de la red Solana
-   Crea un nuevo mensaje de transacción utilizando las instrucciones proporcionadas
-   Firma la transacción utilizando el par de claves del usuario
-   Envía la transacción a la red Solana
-   Confirma la transacción
-   Registra la URL de la transacción en Solana Explorer

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

### 3. Crear una función de `waitForNewBlock` ayuda

Recuerde que las tablas de búsqueda y las direcciones contenidas en ellas no se pueden referenciar inmediatamente después de la creación o extensión. Esto significa que tendremos que esperar un nuevo bloque antes de enviar transacciones que hagan referencia a la tabla de búsqueda recién creada o extendida. Para que esto sea más sencillo en el futuro, vamos a crear una función de `waitForNewBlock` ayuda que usaremos para esperar a que se activen las tablas de búsqueda entre las transacciones de envío.

Esta función tendrá parámetros para una conexión y una altura de bloque objetivo. A continuación, se inicia un intervalo que comprueba la altura de bloque actual de la red cada 1000 ms. Una vez que la nueva altura del bloque excede la altura objetivo, el intervalo se borra y la promesa se resuelve.

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

### 4. Crear una `initializeLookupTable` función

Ahora que tenemos algunas funciones auxiliares listas para funcionar, declare una función llamada `initializeLookupTable`. Esta función tiene parámetros `user`, `connection`, y `addresses`. La función:

1. Recuperar la ranura actual
2. Generar una instrucción para crear una tabla de consulta
3. Generar una instrucción para ampliar la tabla de búsqueda con las direcciones proporcionadas
4. Enviar y confirmar una transacción con las instrucciones para crear y ampliar la tabla de búsqueda
5. Devuelve la dirección de la tabla de búsqueda

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

### 5. Modificar `main` para usar tablas de búsqueda

Ahora que podemos inicializar una tabla de búsqueda con todas las direcciones de los destinatarios, actualicemos `main` para usar transacciones versionadas y tablas de búsqueda. Necesitaremos:

1. Llamar `initializeLookupTable`
2. Llamar `waitForNewBlock`
3. Obtener la tabla de búsqueda usando `connection.getAddressLookupTable`
4. Crear la instrucción de transferencia para cada destinatario
5. Enviar la transacción v0 con todas las instrucciones de transferencia

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

Tenga en cuenta que crea las instrucciones de transferencia con la dirección completa del destinatario aunque hayamos creado una tabla de búsqueda. Esto se debe a que al incluir la tabla de búsqueda en la transacción versionada, le indica al `web3.js` marco que reemplace cualquier dirección de destinatario que coincida con las direcciones en la tabla de búsqueda con punteros a la tabla de búsqueda. En el momento en que la transacción se envía a la red, las direcciones que existen en la tabla de búsqueda serán referenciadas por un solo byte en lugar de los 32 bytes completos.

Utilice `npm start` la línea de comandos para ejecutar la `main` función. Debería ver un resultado similar al siguiente:

```bash
Current balance is 1.38866636
PublicKey: 8iGVBt3dcJdp9KfyTRcKuHY6gXCMFdnSG2F1pAwsUTMX
lookup table address: Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M
https://explorer.solana.com/tx/4JvCo2azy2u8XK2pU8AnJiHAucKTrZ6QX7EEHVuNSED8B5A8t9GqY5CP9xB8fZpTNuR7tbUcnj2MiL41xRJnLGzV?cluster=devnet
Waiting for 1 new blocks
https://explorer.solana.com/tx/rgpmxGU4QaAXw9eyqfMUqv8Lp6LHTuTyjQqDXpeFcu1ijQMmCH2V3Sb54x2wWAbnWXnMpJNGg4eLvuy3r8izGHt?cluster=devnet
Finished successfully
```

El primer enlace de transacción en la consola representa la transacción para crear y extender la tabla de búsqueda. La segunda transacción representa las transferencias a todos los destinatarios. Siéntase libre de inspeccionar estas transacciones en el explorador.

Recuerde, esta misma transacción estaba fallando cuando descargó por primera vez el código de inicio. Ahora que estamos usando tablas de búsqueda, podemos hacer las 22 transferencias en una sola transacción.

### 6. Añadir más direcciones a la tabla de búsqueda

Tenga en cuenta que la solución que hemos ideado hasta ahora solo admite transferencias a hasta 30 cuentas, ya que solo extendemos la tabla de búsqueda una vez. Cuando se tiene en cuenta el tamaño de la instrucción de transferencia, en realidad es posible ampliar la tabla de búsqueda con 27 direcciones adicionales y completar una transferencia atómica hasta 57 destinatarios. ¡Sigamos adelante y añadamos soporte para esto ahora!

Todo lo que tenemos que hacer es entrar `initializeLookupTable` y hacer dos cosas:

1. Modificar la llamada existente `extendLookupTable` a para añadir solo las primeras 30 direcciones (no más de eso y la transacción será demasiado grande)
2. Añadir un bucle que seguirá extendiendo una tabla de búsqueda 30 direcciones a la vez hasta que todas las direcciones se han añadido

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

¡Felicidades! Si te sientes bien con esta demostración, probablemente estés listo para trabajar con tablas de búsqueda y transacciones versionadas por tu cuenta. Si desea echar un vistazo al código de la solución final, puede encontrarlo en la rama de la solución[here](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/solution).

# Desafío

Como desafío, experimente con la desactivación, el cierre y la congelación de las tablas de búsqueda. Recuerde que debe esperar a que una tabla de búsqueda termine de desactivarse antes de poder cerrarla. Además, si una tabla de búsqueda está congelada, no se puede modificar (desactivar o cerrar), por lo que tendrá que probar por separado o usar tablas de búsqueda separadas.

1. Cree una función para desactivar la tabla de búsqueda.
2. Crear una función para cerrar la tabla de búsqueda
3. Crear una función para congelar la tabla de búsqueda
4. Pruebe las funciones llamándolas en la `main()` función

Puede reutilizar las funciones que creamos en la demo para enviar la transacción y esperar a que la tabla de búsqueda se active/desactive. Siéntase libre de hacer referencia a esto[código de solución](https://github.com/Unboxed-Software/versioned-transaction/tree/challenge).

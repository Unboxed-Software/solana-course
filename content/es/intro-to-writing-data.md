---
title: Escribir datos a los objetivos de la red Solana
objectives:
- Explicar el par de teclas
- Utilizar `@solana/web3.js` para generar un par de claves
- Usar `@solana/web3.js` para crear un par de claves usando una clave secreta
- Explicar transacciones
- Explicar las tarifas de transacción
- Usar `@solana/web3.js` para enviar sol
- Utilizar `@solana/web3.js` para firmar transacciones
- Utilice Solana Explorer para ver las transacciones
---

# TL;DR

-   **Par de llaves** se refiere a un emparejamiento de claves públicas y secretas. La clave pública se utiliza como una "dirección" que apunta a una cuenta en la red Solana. La clave secreta se utiliza para verificar la identidad o la autoridad. Como su nombre indica, siempre debe mantener las claves secretas*privado*. `@solana/web3.js` Proporciona funciones de ayuda para crear un nuevo par de claves o para construir un par de claves utilizando una clave secreta existente.
-   **Transacciones** son efectivamente un conjunto de instrucciones que invocan programas de Solana. El resultado de cada transacción depende del programa al que se llama. Todas las modificaciones a los datos en la cadena ocurren a través de transacciones. Ejemplo:

    ```tsx
    const transaction = new Transaction();

    const sendSolInstruction = SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: recipient,
        lamports: LAMPORTS_PER_SOL * amount,
    });

    transaction.add(sendSolInstruction);

    const signature = sendAndConfirmTransaction(connection, transaction, [
        senderKeypair,
    ]);
    ```

# Descripción general

## Par de llaves

Como su nombre indica, un par de claves es un par de claves: una clave pública y una clave secreta.

-   La clave pública se utiliza como una "dirección" que apunta a una cuenta en la red Solana.
-   La clave secreta se utiliza para verificar la identidad o la autoridad. Como su nombre indica, siempre debe mantener las claves secretas*privado*.

Un par de claves es _requerido_ para la gran mayoría de las interacciones dentro de la red Solana. Si aún no tiene un par de teclas, o si desea generar uno nuevo para un propósito específico, `@solana/web3.js` proporciona una función de ayuda para crear un nuevo par de teclas.

```tsx
const ownerKeypair = Keypair.generate();
```

Un par de claves es del tipo de datos `Keypair` y se puede deconstruir en una clave pública:

```tsx
const publicKey = ownerKeypair.publicKey;
```

... o la clave secreta:

```tsx
const secretKey = ownerKeypair.secretKey;
```

Si ya tiene un par de claves que le gustaría usar, puede crear una a `Keypair` partir de la clave secreta usando la `Keypair.fromSecretKey()` función. Para garantizar que su clave secreta se mantenga segura, recomendamos inyectarla a través de una variable de entorno y no comprometer su `.env` archivo.

```tsx
const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[];
const secretKey = Uint8Array.from(secret);
const keypairFromSecretKey = Keypair.fromSecretKey(secretKey);
```

## Transacciones

Cualquier modificación a los datos en la cadena ocurre a través de transacciones enviadas a los programas.

Las instrucciones de transacción contienen:

-   un identificador del programa que pretende invocar
-   una serie de cuentas que se leerán y/o escribirán en
-   datos estructurados como una matriz de bytes que se especifica para el programa que se está invocando

Cuando envía una transacción a un clúster de Solana, se invoca un programa de Solana con las instrucciones incluidas en la transacción.

Como era de esperar, `@solana/web3.js` proporciona funciones de ayuda para crear transacciones e instrucciones. Puede crear una nueva transacción con el constructor, `new Transaction()`. Una vez creada, puede añadir instrucciones a la transacción con el `add()` método.

Las instrucciones pueden complicarse cuando se trabaja con programas personalizados. Afortunadamente, `@solana/web3.js` tiene funciones de conveniencia para algunos de los programas nativos y operaciones básicas de Solana, como transferir SOL:

```tsx
const transaction = new Transaction();

const sendSolInstruction = SystemProgram.transfer({
    fromPubkey: sender,
    toPubkey: recipient,
    lamports: LAMPORTS_PER_SOL * amount,
});

transaction.add(sendSolInstruction);
```

La `SystemProgram.transfer()` función requiere que se pasen como parámetros:

-   una clave pública correspondiente a la cuenta del remitente
-   una clave pública correspondiente a la cuenta del destinatario
-   la cantidad de SOL para enviar en lamports.

Esta función devuelve entonces la instrucción para enviar SOL desde el remitente al destinatario, después de lo cual la instrucción se puede añadir a la transacción.

Una vez creada, una transacción debe enviarse al clúster y confirmarse:

```tsx
const signature = sendAndConfirmTransaction(connection, transaction, [
    senderKeypair,
]);
```

Las `sendAndConfirmTransaction()` funciones toman como parámetros

-   una conexión de clúster
-   una transacción
-   una matriz de pares de claves que actuarán como firmantes en la transacción; en este ejemplo, solo tenemos un firmante: el remitente.

### Instrucciones

El ejemplo de enviar SOL es excelente para presentarle el envío de transacciones, pero una gran cantidad de desarrollo de web3 implicará llamar a programas no nativos. En el ejemplo anterior, la `SystemProgram.transfer()` función garantiza que pase todos los datos necesarios para crear la instrucción, luego crea la instrucción para usted. Sin embargo, cuando trabaje con programas no nativos, deberá ser muy específico sobre la creación de instrucciones que estén estructuradas para que coincidan con el programa correspondiente.

Con `@solana/web3.js`, puede crear instrucciones no nativas con el `TransactionInstruction` constructor. Este constructor toma un único argumento del tipo de datos `TransactionInstructionCtorFields`.

```tsx
export type TransactionInstructionCtorFields = {
    keys: Array<AccountMeta>;
    programId: PublicKey;
    data?: Buffer;
};
```

Según la definición anterior, el objeto pasado al `TransactionInstruction` constructor requiere:

-   una matriz de claves de tipo `AccountMeta`
-   la clave pública para el programa que se llama
-   una opción `Buffer` que contiene datos para pasar al programa.

Ignoraremos el `data` campo por ahora y lo revisaremos en una lección futura.

El `programId` campo es bastante auto explicativo: es la clave pública asociada con el programa. Necesitará saber esto antes de llamar al programa de la misma manera que necesitaría conocer la clave pública de alguien a quien desea enviar SOL.

La `keys` matriz requiere un poco más de explicación. Cada objeto en esta matriz representa una cuenta que se leerá o escribirá durante la ejecución de una transacción. Esto significa que necesita conocer el comportamiento del programa al que está llamando y asegurarse de proporcionar todas las cuentas necesarias en la matriz.

Cada objeto en la `keys` matriz debe incluir lo siguiente:

-   `pubkey` - la clave pública de la cuenta
-   `isSigner` - un booleano que representa si la cuenta es o no un firmante en la transacción
-   `isWritable` - un booleano que representa si la cuenta está escrita o no durante la ejecución de la transacción

Poniendo todo esto junto, podríamos terminar con algo como lo siguiente:

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

    const signature = await web3.sendAndConfirmTransaction(
        connection,
        new web3.Transaction().add(instruction),
        [payer],
    );

    console.log(signature);
}
```

### Tarifas de transacción

Las tarifas de transacción están integradas en la economía de Solana como compensación a la red de validadores por los recursos de CPU y GPU requeridos en el procesamiento de transacciones. A diferencia de muchas redes que tienen un mercado de tarifas donde los usuarios pueden pagar tarifas más altas para aumentar sus posibilidades de ser incluidos en el próximo bloque, las tarifas de transacción de Solana son deterministas.

El primer firmante incluido en la matriz de firmantes en una transacción es responsable de pagar la tarifa de transacción. Si este firmante no tiene suficiente SOL en su cuenta para cubrir la tarifa de transacción, la transacción se cancelará.

Al probar, ya sea localmente o en devnet, puede usar el comando CLI de Solana `solana airdrop 1` para obtener SOL de prueba gratuita en su cuenta para pagar las tarifas de transacción.

### Solana Explorer

![Captura de pantalla de Solana Explorer configurada en Devnet](../../assets/solana-explorer-devnet.png)

Todas las transacciones en la cadena de bloques se pueden ver públicamente en el[Solana Explorer](http://explorer.solana.com). Por ejemplo, podría tomar la firma devuelta por `sendAndConfirmTransaction()` en el ejemplo anterior, buscar esa firma en Solana Explorer y luego ver:

-   cuando ocurrió
-   en qué bloque se incluyó
-   la tasa de transacción
-   ¡Y más!

![Captura de pantalla de Solana Explorer con detalles sobre una transacción](../../assets/solana-explorer-transaction-overview.png)

# Demostración

Vamos a crear un script para hacer ping a un programa simple que aumenta un contador cada vez que se ha hecho ping. Este programa existe en el Solana Devnet en la dirección `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa`. El programa almacena los datos de recuento en una cuenta específica en la dirección `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

### 1. Andamios básicos

Comencemos con algunos andamios básicos. Sin embargo, puede configurar su proyecto si lo considera más apropiado, pero usaremos un proyecto Typescript simple con una dependencia del paquete @solana/web3.js. Si desea utilizar nuestro andamiaje, puede utilizar los siguientes comandos en la línea de comandos:

```bash
mkdir -p solana-ping-client/src && \
	cd solana-ping-client && \
	touch src/index.ts && \
	git init && touch .gitignore && \
	npm init -y && \
	npm install --save-dev typescript && \
  npm install --save-dev ts-node && \
	npx tsc --init && \
	npm install @solana/web3.js && \
	npm install dotenv && \
	touch .env
```

Esto:

1. crear un nuevo directorio para el proyecto con un subdirectorio `src`
2. mover el símbolo del sistema dentro del directorio del proyecto
3. crear un `index.ts` archivo dentro de `src`
4. inicializar un repositorio git con un `.gitignore` archivo
5. crear un nuevo `npm` paquete
6. añadir una dependencia de desarrollador en typeScript
7. añadir una dependencia de desarrollador en `ts-node`
8. crear un `.tsconfig` archivo
9. instalar la `@solana/web3.js` dependencia
10. instalar la `.dotenv` dependencia
11. crear un `.env` archivo

Si desea que nuestro código coincida exactamente, reemplace el contenido de `tsconfig.json` por lo siguiente:

```json
{
    "compilerOptions": {
        "target": "es5",
        "module": "commonjs",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "outDir": "dist"
    },
    "include": ["./src/**/*"]
}
```

Añádase lo siguiente a la lista `.gitignore` :

```
node_modules/
dist/
.env
```

Y por último, añadir lo siguiente al `scripts` objeto en `package.json` :

```json
"start": "ts-node src/index.ts"
```

### 2. Generar un nuevo par de claves

Antes de que puedas hacer algo, necesitarás un par de llaves. Vamos a saltar al `index.ts` archivo y generar uno:

```tsx
import web3 = require("@solana/web3.js");
import "dotenv/config"

async function main() {
    const newKeypair = web3.Keypair.generate();
    console.log(newKeypair.secretKey.toString());
}

main()
    .then(() => {
        console.log("Finished successfully");
    })
    .catch((error) => {
        console.error(error);
    });
```

La mayor parte de este código es solo una copia para ejecutar el archivo correctamente. Las líneas dentro de la `main()` función generan un nuevo par de claves y registran la clave secreta de la consola.

Ejecute `npm start` después de guardar este archivo y debería ver una matriz de números impresos en la consola. Esta matriz representa la clave secreta para su nuevo par de claves. **No** use este par de claves para las operaciones de Mainnet. **Solo use este par de teclas para las pruebas.**

Copie la matriz de claves secretas del registro de la consola y péguela en el `.env` archivo como una variable de entorno llamada, `PRIVATE_KEY`. De esta manera podemos reutilizar este par de claves en el desarrollo futuro en lugar de generar un nuevo par de claves cada vez que ejecutamos algo. Debería verse algo como esto, pero con diferentes números:

```
PRIVATE_KEY=[56,83,31,62,66,154,33,74,106,59,111,224,176,237,89,224,10,220,28,222,128,36,138,89,30,252,100,209,206,155,154,65,98,194,97,182,98,162,107,238,61,183,163,215,44,6,10,49,218,156,5,131,125,253,247,190,181,196,0,249,40,149,119,246]
```

### 3. Inicializar Keypair desde Secret

Ahora que hemos generado con éxito un par de claves y lo hemos copiado en el `.env` archivo, podemos eliminar el código dentro de la `main()` función.

Volveremos a la `main()` función pronto, pero por ahora vamos a crear una nueva función fuera de `main()` llamada `initializeKeypair()`. Dentro de esta nueva función:

1. analizar la variable de `PRIVATE_KEY` entorno como `number[]`
2. utilizarlo para inicializar un `Uint8Array`
3. inicializar y devolver un `Keypair` usando eso `Uint8Array`.

```tsx
function initializeKeypair(): web3.Keypair {
    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[];
    const secretKey = Uint8Array.from(secret);
    const keypairFromSecretKey = web3.Keypair.fromSecretKey(secretKey);
    return keypairFromSecretKey;
}
```

### 4. Programa de ping

Ahora que tenemos una forma de inicializar nuestro par de claves, necesitamos establecer una conexión con Devnet de Solana. En `main()`, vamos a invocar `initializeKeypair()` y crear una conexión:

```tsx
async function main() {
    const payer = initializeKeypair();
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
}
```

Ahora cree una función asíncrona fuera de `main()` llamada `pingProgram()` con dos parámetros que requieren una conexión y un par de claves del pagador como argumentos:

```tsx
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) {}
```

Dentro de esta función, necesitamos:

1. crear una transacción
2. crear una instrucción
3. añadir la instrucción a la transacción
4. enviar la transacción.

Recuerde, la pieza más desafiante aquí es incluir la información correcta en la instrucción. Conocemos la dirección del programa al que llamamos. También sabemos que el programa escribe datos en una cuenta separada cuya dirección también tenemos. Añadamos las versiones de cadena de ambos como constantes en la parte superior del `index.ts` archivo:

```tsx
const PROGRAM_ADDRESS = "ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa";
const PROGRAM_DATA_ADDRESS = "Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod";
```

Ahora, en la `pingProgram()` función, vamos a crear una nueva transacción, luego inicializar una `PublicKey` para la cuenta del programa, y otra para la cuenta de datos.

```tsx
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) {
    const transaction = new web3.Transaction();

    const programId = new web3.PublicKey(PROGRAM_ADDRESS);
    const programDataPubkey = new web3.PublicKey(PROGRAM_DATA_ADDRESS);
}
```

A continuación, vamos a crear la instrucción. Recuerde, la instrucción debe incluir la clave pública para el programa y también debe incluir una matriz con todas las cuentas que se leerán o escribirán. En este programa de ejemplo, solo se necesita la cuenta de datos mencionada anteriormente.

```tsx
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) {
    const transaction = new web3.Transaction();

    const programId = new web3.PublicKey(PROGRAM_ADDRESS);
    const programDataPubkey = new web3.PublicKey(PROGRAM_DATA_ADDRESS);

    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                pubkey: programDataPubkey,
                isSigner: false,
                isWritable: true,
            },
        ],
        programId,
    });
}
```

A continuación, vamos a añadir la instrucción a la transacción que hemos creado al comienzo de la función. Luego, llame pasando `sendAndConfirmTransaction()` la conexión, la transacción y el pagador. Finalmente, vamos a registrar el resultado de esa llamada de función para que podamos buscarlo en el Solana Explorer.

```tsx
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) {
    const transaction = new web3.Transaction();

    const programId = new web3.PublicKey(PROGRAM_ADDRESS);
    const programDataPubkey = new web3.PublicKey(PROGRAM_DATA_ADDRESS);

    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                pubkey: programDataPubkey,
                isSigner: false,
                isWritable: true,
            },
        ],
        programId,
    });

    transaction.add(instruction);

    const signature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [payer],
    );

    console.log(signature);
}
```

Por último, vamos a invocar `pingProgram()` dentro de `main()` usar `connection` y `payer` :

```tsx
async function main() {
    const payer = initializeKeypair();
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    await pingProgram(connection, payer);
}
```

### 5. Airdrop

Ahora ejecute el código con `npm start` y ver si funciona. Puede terminar con el siguiente error en la consola:

> Simulación de transacción fallida: intento de debitar una cuenta pero no se encontró ningún registro de un crédito anterior.

Si obtiene este error, es porque su par de claves es nuevo y no tiene ningún SOL para cubrir las tarifas de transacción. Vamos a arreglar esto añadiendo la siguiente línea `main()` antes de la llamada a `pingProgram()` :

```tsx
await connection.requestAirdrop(payer.publicKey, web3.LAMPORTS_PER_SOL * 1);
```

Esto depositará 1 SOL en su cuenta que puede usar para realizar pruebas. Esto no funcionará en Mainnet, donde realmente tendría valor. Pero es increíblemente conveniente para probar localmente y en Devnet.

### 6. Compruebe el explorador Solana

Ahora ejecute el código de nuevo. Puede tomar un momento o dos, pero ahora el código debería funcionar y debería ver una cadena larga impresa en la consola, como la siguiente:

```
55S47uwMJprFMLhRSewkoUuzUs5V6BpNfRx21MpngRUQG3AswCzCSxvQmS3WEPWDJM7bhHm3bYBrqRshj672cUSG
```

Copie esta firma de confirmación. Abra un navegador y vaya a [https://explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet) (el parámetro de consulta al final de la URL se asegurará de que explore las transacciones en Devnet en lugar de Mainnet). Pegue la firma en la barra de búsqueda en la parte superior del explorador Devnet de Solana y presione enter. Deberías ver todos los detalles de la transacción. Si se desplaza todo el camino hasta la parte inferior, a continuación `Program Logs`, verá, que muestran cuántas veces el programa se ha hecho ping incluyendo su ping.

![Captura de pantalla de Solana Explorer con registros de llamadas al programa Ping](../../assets/solana-explorer-ping-result.png)

Si desea facilitar la búsqueda de transacciones en Solana Explorer en el futuro, simplemente cambie `console.log` `pingProgram()` a lo siguiente:

```tsx
console.log(
    `You can view your transaction on the Solana Explorer at:\nhttps://explorer.solana.com/tx/${sig}?cluster=devnet`,
);
```

Y al igual que usted está llamando a los programas en la red Solana y la escritura de datos a la cadena!

En las próximas lecciones aprenderás cómo

1. hacer esto de forma segura desde el navegador en lugar de ejecutar un script
2. añadir datos personalizados a sus instrucciones
3. deserializar datos de la cadena

# Desafío

Siga adelante y cree un script desde cero que le permita transferir SOL de una cuenta a otra en Devnet. Asegúrese de imprimir la firma de la transacción para que pueda verla en Solana Explorer.

Si te quedas atascado, siéntete libre de echar un vistazo[código de solución](https://github.com/Unboxed-Software/solana-send-sol-client).

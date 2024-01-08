---
title: Crear Tokens con los objetivos del Programa Token
objectives:
- Crear fichas de menta
- Crear cuentas de token
- Tokens de menta
- Transferir tokens
- Quemar tokens
---

# TL;DR

-   **SPL-Tokens** representan todos los tokens no nativos en la red Solana. Tanto las fichas fungibles como las no fungibles (NFT) en Solana son SPL-Tokens
-   El **Programa de tokens** contiene instrucciones para crear e interactuar con SPL-Tokens
-   **Token Mentas** son cuentas que contienen datos sobre un Token específico, pero no contienen Tokens
-   **Cuentas de tokens** se utilizan para mantener tokens de una menta de tokens específica
-   La creación de Mentas Token y Cuentas Token requiere la asignación **alquiler** en SOL. El alquiler de una Cuenta Token se puede reembolsar cuando se cierra la cuenta, sin embargo, Token Mints actualmente no se puede cerrar

# Descripción general

El Programa Token es uno de los muchos programas puestos a disposición por la Biblioteca de Programas Solana (SPL). Contiene instrucciones para crear e interactuar con SPL-Tokens. Estos tokens representan todos los tokens no nativos (es decir, no SOL) en la red Solana.

Esta lección se centrará en los conceptos básicos de la creación y gestión de un nuevo SPL-Token utilizando el Programa Token:

1. Crear un nuevo Token Mint
2. Crear cuentas de token
3. Acuñación
4. Transferencia de tokens de un titular a otro
5. Quemar tokens

Nos acercaremos a esto desde el lado del cliente del proceso de desarrollo utilizando la biblioteca `@solana/spl-token` Javascript.

## Token Mint

Para crear un nuevo SPL-Token primero tienes que crear un Token Mint. Un Token Mint es la cuenta que contiene datos sobre un token específico.

Como ejemplo, veamos[USD Coin (USDC) en el Solana Explorer](https://explorer.solana.com/address/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v). La dirección de Token Mint de USDC es `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. Con el explorador, podemos ver los detalles particulares sobre Token Mint de USDC, como el suministro actual de tokens, las direcciones de las autoridades de menta y congelación, y la precisión decimal del token:

![Captura de pantalla de USDC Token Mint](../../assets/token-program-usdc-mint.png)

Para crear un nuevo Token Mint, debe enviar las instrucciones de transacción correctas al Programa Token. Para ello, utilizaremos la `createMint` función de `@solana/spl-token`.

```tsx
const tokenMint = await createMint(
  connection,
  payer,
  mintAuthority,
  freezeAuthority,
  decimal,
);
```

La `createMint` función devuelve el `publicKey` del nuevo token Mint. Esta función requiere los siguientes argumentos:

-   `connection` - la conexión JSON-RPC al clúster
-   `payer` - la clave pública del ordenante de la operación
-   `mintAuthority` - la cuenta que está autorizada para realizar la acuñación real de tokens desde la ceca de tokens.
-   `freezeAuthority` - una cuenta autorizada para congelar los tokens en una cuenta de tokens. Si la congelación no es un atributo deseado, el parámetro se puede establecer en nulo
-   `decimals` - especifica la precisión decimal deseada del token

Al crear una nueva menta a partir de un script que tiene acceso a su clave secreta, simplemente puede usar la `createMint` función. Sin embargo, si tuviera que construir un sitio web para permitir a los usuarios crear un nuevo token Mint, tendría que hacerlo con la clave secreta del usuario sin hacer que lo expongan al navegador. En ese caso, querrá crear y enviar una transacción con las instrucciones correctas.

Bajo el capó, la `createMint` función es simplemente crear una transacción que contiene dos instrucciones:

1. Crear una nueva cuenta
2. Inicializar una nueva menta

Esto se vería de la siguiente manera:

```tsx
import * as web3 from "@solana/web3";
import * as token from "@solana/spl-token";

async function buildCreateMintTransaction(
  connection: web3.Connection,
  payer: web3.PublicKey,
  decimals: number,
): Promise<web3.Transaction> {
  const lamports = await token.getMinimumBalanceForRentExemptMint(connection);
  const accountKeypair = web3.Keypair.generate();
  const programId = token.TOKEN_PROGRAM_ID;

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: accountKeypair.publicKey,
      space: token.MINT_SIZE,
      lamports,
      programId,
    }),
    token.createInitializeMintInstruction(
      accountKeypair.publicKey,
      decimals,
      payer,
      payer,
      programId,
    ),
  );

  return transaction;
}
```

Al crear manualmente las instrucciones para crear un nuevo token Mint, asegúrese de agregar las instrucciones para crear la cuenta e inicializar el Mint en el*misma transacción*. Si tuviera que hacer cada paso en una transacción separada, teóricamente es posible que otra persona tome la cuenta que crea e inicializarla para su propia menta.

### Exención de alquiler y alquiler

Tenga en cuenta que la primera línea en el cuerpo de la función del fragmento de código anterior contiene una llamada a `getMinimumBalanceForRentExemptMint`, cuyo resultado se pasa a la `createAccount` función. Esto es parte de la inicialización de la cuenta llamada exención de alquiler.

Hasta hace poco, todas las cuentas en Solana estaban obligadas a hacer una de las siguientes cosas para evitar ser desasignadas:

1. Pagar el alquiler a intervalos específicos
2. Depositar suficiente SOL en la inicialización para ser considerado exento de alquiler

Recientemente, se eliminó la primera opción y se convirtió en un requisito depositar suficiente SOL para la exención de alquiler al inicializar una nueva cuenta.

En este caso, estamos creando una nueva cuenta para un token Mint, por lo que usamos `getMinimumBalanceForRentExemptMint` desde la `@solana/spl-token` biblioteca. Sin embargo, este concepto se aplica a todas las cuentas y puede usar el `getMinimumBalanceForRentExemption` método más genérico `Connection` para otras cuentas que necesite crear.

## Cuenta de token

Antes de que pueda acuñar tokens (emitir un nuevo suministro), necesita una cuenta de tokens para mantener los tokens recién emitidos.

Una Cuenta de Token contiene tokens de un "Mint" específico y tiene un "propietario" especificado de la cuenta. Solo el propietario está autorizado a disminuir el saldo de la Cuenta Token (transferencia, grabación, etc.) mientras que cualquier persona puede enviar tokens a la Cuenta Token para aumentar su saldo.

Puede usar la `createAccount` función de la `spl-token` biblioteca para crear la nueva cuenta de token:

```tsx
const tokenAccount = await createAccount(
  connection,
  payer,
  mint,
  owner,
  keypair,
);
```

La `createAccount` función devuelve la `publicKey` de la nueva cuenta de token. Esta función requiere los siguientes argumentos:

-   `connection` - la conexión JSON-RPC al clúster
-   `payer` - la cuenta del ordenante de la operación
-   `mint` - el token Mint con el que está asociada la nueva cuenta de token
-   `owner` - la cuenta del propietario de la nueva cuenta de token
-   `keypair` - este es un parámetro opcional para especificar la nueva dirección de cuenta de token. Si no se proporciona ningún par de claves, la `createAccount` función por defecto es una derivación de las `owner` cuentas `mint` and asociadas.

Tenga en cuenta que esta `createAccount` función es diferente de la `createAccount` función que se muestra arriba cuando miramos debajo del capó de la `createMint` función. Anteriormente usábamos la `createAccount` función on `SystemProgram` para devolver la instrucción para crear todas las cuentas. La `createAccount` función aquí es una función auxiliar en la `spl-token` biblioteca que envía una transacción con dos instrucciones. El primero crea la cuenta y el segundo inicializa la cuenta como una cuenta de token.

Al igual que con la creación de un Token Mint, si necesitáramos construir la transacción `createAccount` manualmente, podríamos duplicar lo que la función está haciendo bajo el capó:

1. Utilizar `getMint` para recuperar los datos asociados con el `mint`
2. Utilizar `getAccountLenForMint` para calcular el espacio necesario para la cuenta de token
3. Utilícelo `getMinimumBalanceForRentExemption` para calcular las lámparas necesarias para la exención de alquiler
4. Crear una nueva transacción usando `SystemProgram.createAccount` y `createInitializeAccountInstruction`. Tenga en cuenta que esto `createAccount` es de `@solana/web3.js` y se utiliza para crear una nueva cuenta genérica. El `createInitializeAccountInstruction` utiliza esta nueva cuenta para inicializar la nueva cuenta de token

```tsx
import * as web3 from "@solana/web3";
import * as token from "@solana/spl-token";

async function buildCreateTokenAccountTransaction(
  connection: web3.Connection,
  payer: web3.PublicKey,
  mint: web3.PublicKey,
): Promise<web3.Transaction> {
  const mintState = await token.getMint(connection, mint);
  const accountKeypair = await web3.Keypair.generate();
  const space = token.getAccountLenForMint(mintState);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);
  const programId = token.TOKEN_PROGRAM_ID;

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: accountKeypair.publicKey,
      space,
      lamports,
      programId,
    }),
    token.createInitializeAccountInstruction(
      accountKeypair.publicKey,
      mint,
      payer,
      programId,
    ),
  );

  return transaction;
}
```

### Cuenta de token asociada

Una Cuenta de Token Asociada es una Cuenta de Token donde la dirección de la Cuenta de Token se obtiene utilizando la clave pública de un propietario y un token Mint. Las cuentas de tokens asociadas proporcionan una forma determinista de encontrar la cuenta de tokens propiedad de una persona específica `publicKey` para una casa de moneda de tokens específica. La mayoría de las veces que cree una cuenta de token, querrá que sea una cuenta de token asociada.

De manera similar a lo anterior, puede crear una cuenta de token asociada utilizando la `createAssociatedTokenAccount` función de la `spl-token` biblioteca.

```tsx
const associatedTokenAccount = await createAssociatedTokenAccount(
  connection,
  payer,
  mint,
  owner,
);
```

Esta función devuelve la `publicKey` de la nueva cuenta de token asociada y requiere los siguientes argumentos:

-   `connection` - la conexión JSON-RPC al clúster
-   `payer` - la cuenta del ordenante de la operación
-   `mint` - el token Mint con el que está asociada la nueva cuenta de token
-   `owner` - la cuenta del propietario de la nueva cuenta de token

También puede usar `getOrCreateAssociatedTokenAccount` para obtener la cuenta de token asociada con una dirección determinada o crearla si no existe. Por ejemplo, si estuviera escribiendo código para enviar tokens a un usuario determinado, probablemente usaría esta función para asegurarse de que la cuenta de token asociada con el usuario determinado se cree si aún no existe.

Bajo el capó, `createAssociatedTokenAccount` está haciendo dos cosas:

1. Usando `getAssociatedTokenAddress` para derivar la dirección de cuenta de token asociada de la `mint` y `owner`
2. Construir una transacción usando instrucciones de `createAssociatedTokenAccountInstruction`

```tsx
import * as web3 from "@solana/web3";
import * as token from "@solana/spl-token";

async function buildCreateAssociatedTokenAccountTransaction(
  payer: web3.PublicKey,
  mint: web3.PublicKey,
): Promise<web3.Transaction> {
  const associatedTokenAddress = await token.getAssociatedTokenAddress(
    mint,
    payer,
    false,
  );

  const transaction = new web3.Transaction().add(
    token.createAssociatedTokenAccountInstruction(
      payer,
      associatedTokenAddress,
      payer,
      mint,
    ),
  );

  return transaction;
}
```

## Tokens de menta

La acuñación de tokens es el proceso de emisión de nuevos tokens en circulación. Cuando usted acuña fichas, aumenta el suministro de la moneda y deposita las fichas recién acuñadas en una cuenta de fichas. Solo la autoridad de la ceca de una ceca de fichas puede acuñar nuevas fichas.

Para mint tokens usando la `spl-token` biblioteca, puede usar la `mintTo` función.

```tsx
const transactionSignature = await mintTo(
  connection,
  payer,
  mint,
  destination,
  authority,
  amount,
);
```

La `mintTo` función devuelve un `TransactionSignature` que se puede ver en Solana Explorer. La `mintTo` función requiere los siguientes argumentos:

-   `connection` - la conexión JSON-RPC al clúster
-   `payer` - la cuenta del ordenante de la operación
-   `mint` - el token Mint con el que está asociada la nueva cuenta de token
-   `destination` - la cuenta de token a la que se acuñarán los tokens
-   `authority` - la cuenta autorizada para acuñar tokens
-   `amount` - la cantidad bruta de fichas para acuñar fuera de los decimales, por ejemplo, si la propiedad de los decimales de Scrooge Coin mint se estableció en 2, entonces para obtener 1 Scrooge Coin completa, tendría que establecer esta propiedad en 100

No es raro actualizar la autoridad de la ceca en una ceca de fichas para que se anule después de que se hayan acuñado las fichas. Esto establecería un suministro máximo y aseguraría que no se puedan acuñar tokens en el futuro. Por el contrario, la autoridad de acuñación podría otorgarse a un programa para que los tokens puedan acuñarse automáticamente a intervalos regulares o de acuerdo con condiciones programables.

Bajo el capó, la `mintTo` función simplemente crea una transacción con las instrucciones obtenidas de la `createMintToInstruction` función.

```tsx
import * as web3 from "@solana/web3";
import * as token from "@solana/spl-token";

async function buildMintToTransaction(
  authority: web3.PublicKey,
  mint: web3.PublicKey,
  amount: number,
  destination: web3.PublicKey,
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createMintToInstruction(mint, destination, authority, amount),
  );

  return transaction;
}
```

## Transferir tokens

Las transferencias SPL-Token requieren que tanto el remitente como el receptor tengan cuentas de tokens para la ceca de los tokens que se transfieren. Los tokens se transfieren desde la cuenta de token del remitente a la cuenta de token del receptor.

Puede usarlo `getOrCreateAssociatedTokenAccount` al obtener la cuenta de token asociada del receptor para asegurarse de que su cuenta de token exista antes de la transferencia. Solo recuerde que si la cuenta aún no existe, esta función la creará y al pagador de la transacción se le cargarán los importes necesarios para la creación de la cuenta.

Una vez que conoce la dirección de la cuenta del token del receptor, transfiere tokens utilizando la `transfer` función de la `spl-token` biblioteca.

```tsx
const transactionSignature = await transfer(
  connection,
  payer,
  source,
  destination,
  owner,
  amount,
);
```

La `transfer` función devuelve un `TransactionSignature` que se puede ver en Solana Explorer. La `transfer` función requiere los siguientes argumentos:

-   `connection` la conexión JSON-RPC al clúster
-   `payer` la cuenta del ordenante de la operación
-   `source` la cuenta de token enviando tokens
-   `destination` la cuenta de tokens que recibe tokens
-   `owner` la cuenta del propietario de la cuenta de `source` token
-   `amount` la cantidad de tokens a transferir

Bajo el capó, la `transfer` función simplemente crea una transacción con las instrucciones obtenidas de la `createTransferInstruction` función:

```tsx
import * as web3 from "@solana/web3";
import * as token from "@solana/spl-token";

async function buildTransferTransaction(
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number,
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createTransferInstruction(source, destination, owner, amount),
  );

  return transaction;
}
```

## Quemar tokens

Quemar tokens es el proceso de disminuir el suministro de tokens de una menta de tokens determinada. Quemar tokens los elimina de la cuenta de token dada y de una circulación más amplia.

Para grabar tokens usando la `spl-token` biblioteca, utiliza la `burn` función.

```tsx
const transactionSignature = await burn(
  connection,
  payer,
  account,
  mint,
  owner,
  amount,
);
```

La `burn` función devuelve un `TransactionSignature` que se puede ver en Solana Explorer. La `burn` función requiere los siguientes argumentos:

-   `connection` la conexión JSON-RPC al clúster
-   `payer` la cuenta del ordenante de la operación
-   `account` la cuenta de tokens para quemar tokens desde
-   `mint` el token Mint asociado con la cuenta de token
-   `owner` la cuenta del propietario de la cuenta de token
-   `amount` la cantidad de tokens para quemar

Bajo el capó, la `burn` función crea una transacción con instrucciones obtenidas de la `createBurnInstruction` función:

```tsx
import * as web3 from "@solana/web3";
import * as token from "@solana/spl-token";

async function buildBurnTransaction(
  account: web3.PublicKey,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number,
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createBurnInstruction(account, mint, owner, amount),
  );

  return transaction;
}
```

## Aprobar delegado

La aprobación de un delegado es el proceso de autorizar a otra cuenta a transferir o grabar tokens desde una cuenta de tokens. Cuando se utiliza un delegado, la autoridad sobre la cuenta de token permanece con el propietario original. La cantidad máxima de tokens que un delegado puede transferir o grabar se especifica en el momento en que el propietario de la cuenta de tokens aprueba al delegado. Tenga en cuenta que solo puede haber una cuenta de delegado asociada con una cuenta de token en un momento dado.

Para aprobar a un delegado utilizando la `spl-token` biblioteca, utilice la `approve` función.

```tsx
const transactionSignature = await approve(
  connection,
  payer,
  account,
  delegate,
  owner,
  amount,
);
```

La `approve` función devuelve un `TransactionSignature` que se puede ver en Solana Explorer. La `approve` función requiere los siguientes argumentos:

-   `connection` la conexión JSON-RPC al clúster
-   `payer` la cuenta del ordenante de la operación
-   `account` la cuenta de token para delegar tokens de
-   `delegate` la cuenta que el propietario está autorizando para transferir o grabar tokens
-   `owner` la cuenta del propietario de la cuenta de token
-   `amount` el número máximo de fichas que el delegado puede transferir o quemar

Bajo el capó, la `approve` función crea una transacción con instrucciones obtenidas de la `createApproveInstruction` función:

```tsx
import * as web3 from "@solana/web3";
import * as token from "@solana/spl-token";

async function buildApproveTransaction(
  account: web3.PublicKey,
  delegate: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number,
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createApproveInstruction(account, delegate, owner, amount),
  );

  return transaction;
}
```

## Revocar delegado

Un delegado previamente aprobado para una cuenta de token puede ser revocado posteriormente. Una vez que se revoca un delegado, el delegado ya no puede transferir tokens desde la cuenta de tokens del propietario. Cualquier cantidad restante que quede sin transferir de la cantidad previamente aprobada ya no puede ser transferida por el delegado.

Para revocar un delegado utilizando la `spl-token` biblioteca, utilice la `revoke` función.

```tsx
const transactionSignature = await revoke(connection, payer, account, owner);
```

La `revoke` función devuelve un `TransactionSignature` que se puede ver en Solana Explorer. La `revoke` función requiere los siguientes argumentos:

-   `connection` la conexión JSON-RPC al clúster
-   `payer` la cuenta del ordenante de la operación
-   `account` la cuenta de token para revocar la autoridad delegada de
-   `owner` la cuenta del propietario de la cuenta de token

Bajo el capó, la `revoke` función crea una transacción con instrucciones obtenidas de la `createRevokeInstruction` función:

```tsx
import * as web3 from "@solana/web3";
import * as token from "@solana/spl-token";

async function buildRevokeTransaction(
  account: web3.PublicKey,
  owner: web3.PublicKey,
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createRevokeInstruction(account, owner),
  );

  return transaction;
}
```

# Demostración

Vamos a crear un script que interactúe con las instrucciones del Programa Token. Crearemos una Casa de la Moneda, crearemos Cuentas de Tokens, acuñaremos tokens, aprobaremos un delegado, transferiremos tokens y quemaremos tokens.

### 1. Andamios básicos

Comencemos con algunos andamios básicos. Le invitamos a configurar su proyecto, sin embargo, se siente más apropiado para usted, pero vamos a utilizar un proyecto Typescript simple con una dependencia de los `@solana/spl-token` paquetes `@solana/web3.js` y.

Puede usar `npx create-solana-client [INSERT_NAME_HERE] --initialize-keypair` en la línea de comandos para clonar la plantilla desde la que comenzaremos. O puede clonar manualmente la plantilla[here](https://github.com/Unboxed-Software/solana-npx-client-template/tree/with-keypair-env). Tenga en cuenta que si utiliza el repositorio de git directamente como punto de partida, comenzaremos desde la `with-keypair-env` rama.

A continuación, tendrá que añadir una dependencia de `@solana/spl-token`. Desde la línea de comandos dentro del directorio recién creado, utilice el comando `npm install @solana/spl-token`.

### 2. Crear Token Mint

Utilizaremos la `@solana/spl-token` biblioteca, así que empecemos por importarla en la parte superior del archivo.

```tsx
import * as token from "@solana/spl-token";
```

A continuación, declare una nueva función `createNewMint` con parámetros `connection` `payer`, `mintAuthority`, `freezeAuthority`, y `decimals`.

En el cuerpo de la función Importar `createMint` desde `@solana/spl-token` y luego crear una función para llamar `createMint` :

```tsx
async function createNewMint(
  connection: web3.Connection,
  payer: web3.Keypair,
  mintAuthority: web3.PublicKey,
  freezeAuthority: web3.PublicKey,
  decimals: number,
): Promise<web3.PublicKey> {
  const tokenMint = await token.createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals,
  );

  console.log(
    `Token Mint: https://explorer.solana.com/address/${tokenMint}?cluster=devnet`,
  );

  return tokenMint;
}
```

Con esa función completada, llámela desde el cuerpo de `main`, configurando `user` como el `payer`, `mintAuthority`, y `freezeAuthority`.

Después de crear la nueva menta, busquemos los datos de la cuenta usando la `getMint` función y almacenémoslos en una variable llamada `mintInfo`. Utilizaremos estos datos más adelante para ajustar la entrada `amount` para la precisión decimal de la menta.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
  const user = await initializeKeypair(connection);

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2,
  );

  const mintInfo = await token.getMint(connection, mint);
}
```

### 3. Crear cuenta de token

Ahora que hemos creado la menta, vamos a crear una nueva cuenta de token, especificando el `user` como el `owner`.

La `createAccount` función crea una nueva cuenta de token con la opción de especificar la dirección de la cuenta de token. Recuerde que si no se proporciona ninguna dirección, `createAccount` usará por defecto la cuenta de token asociada derivada usando el `mint` and `owner`.

Alternativamente, la función también `createAssociatedTokenAccount` creará una cuenta de token asociada con la misma dirección derivada de las claves `owner` públicas `mint` y.

Para nuestra demostración, usaremos la `getOrCreateAssociatedTokenAccount` función para crear nuestra cuenta de token. Esta función obtiene la dirección de una cuenta de token si ya existe. Si no lo hace, creará una nueva cuenta de token asociado en la dirección correspondiente.

```tsx
async function createTokenAccount(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
) {
  const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner,
  );

  console.log(
    `Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`,
  );

  return tokenAccount;
}
```

Agregue una llamada a `createTokenAccount` la entrada `main`, pasando la menta que creamos en el paso anterior y estableciendo la `user` como la `payer` y `owner`.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
  const user = await initializeKeypair(connection);

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2,
  );

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey,
  );
}
```

### 4. Tokens de menta

Ahora que tenemos un token Mint y una cuenta de token, permite que los tokens Mint ingresen a la cuenta de token. Tenga en cuenta que solo la `mintAuthority` lata puede acuñar nuevos tokens a una cuenta de tokens. Recordemos que establecimos el `user` como el `mintAuthority` para el `mint` que creamos.

Cree una función `mintTokens` que use la `spl-token` función `mintTo` para acuñar tokens:

```tsx
async function mintTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.Keypair,
  amount: number,
) {
  const transactionSignature = await token.mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount,
  );

  console.log(
    `Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
  );
}
```

Vamos a llamar a la función en el `main` uso de la `mint` y `tokenAccount` creado previamente.

Tenga en cuenta que tenemos que ajustar la entrada `amount` para la precisión decimal de la menta. Los tokens de nuestro `mint` tienen una precisión decimal de 2. Si solo especificamos 100 como entrada `amount`, solo se acuñará 1 token en nuestra cuenta de token.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
  const user = await initializeKeypair(connection);

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2,
  );

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey,
  );

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals,
  );
}
```

### 5. Aprobar delegado

Ahora que tenemos un token Mint y una cuenta de token, autorizamos a un delegado a transferir tokens en nuestro nombre.

Cree una función `approveDelegate` que use la `spl-token` función `approve` para acuñar tokens:

```tsx
async function approveDelegate(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  delegate: web3.PublicKey,
  owner: web3.Signer | web3.PublicKey,
  amount: number,
) {
  const transactionSignature = await token.approve(
    connection,
    payer,
    account,
    delegate,
    owner,
    amount,
  );

  console.log(
    `Approve Delegate Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
  );
}
```

En `main`, vamos a generar una nueva `Keypair` para representar la cuenta de delegado. Luego, llamemos a nuestra nueva `approveDelegate` función y autoricemos al delegado a transferir hasta 50 tokens desde la cuenta de `user` tokens. Recuerde ajustar la `amount` para la precisión decimal de la `mint`.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
  const user = await initializeKeypair(connection);

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2,
  );

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey,
  );

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals,
  );

  const delegate = web3.Keypair.generate();

  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals,
  );
}
```

### 6. Transferir tokens

A continuación, transfiera algunos de los tokens que acabamos de acuñar utilizando la `transfer` función de la `spl-token` biblioteca.

```tsx
async function transferTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.Keypair,
  amount: number,
) {
  const transactionSignature = await token.transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount,
  );

  console.log(
    `Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
  );
}
```

Antes de que podamos llamar a esta nueva función, necesitamos saber la cuenta a la que transferiremos los tokens.

En `main`, generemos un nuevo `Keypair` para ser el receptor (pero recuerde que esto es solo para simular tener a alguien a quien enviar tokens: en una aplicación real, necesitaría saber la dirección de la billetera de la persona que recibe los tokens).

Luego, cree una cuenta de token para el receptor. Finalmente, llamemos a nuestra nueva `transferTokens` función para transferir tokens de la cuenta de `user` tokens a la cuenta de `receiver` tokens. Utilizaremos el `delegate` que aprobamos en el paso anterior para realizar la transferencia en nuestro nombre.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
  const user = await initializeKeypair(connection);

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2,
  );

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey,
  );

  const mintInfo = await token.getMint(connection, mint);

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals,
  );

  const receiver = web3.Keypair.generate().publicKey;
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver,
  );

  const delegate = web3.Keypair.generate();
  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals,
  );

  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals,
  );
}
```

### 7. Revocar delegado

Ahora que hemos terminado de transferir tokens, vamos a revocar el `delegate` uso de la `revoke` función de la `spl-token` biblioteca.

```tsx
async function revokeDelegate(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  owner: web3.Signer | web3.PublicKey,
) {
  const transactionSignature = await token.revoke(
    connection,
    payer,
    account,
    owner,
  );

  console.log(
    `Revote Delegate Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
  );
}
```

Revoke establecerá el delegado para la cuenta de token como nulo y restablecerá la cantidad delegada a 0. Todo lo que necesitaremos para esta función es la cuenta de token y el usuario. Llamemos a nuestra nueva `revokeDelegate` función para revocar al delegado de la cuenta de `user` token.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
  const user = await initializeKeypair(connection);

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2,
  );

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey,
  );

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals,
  );

  const receiver = web3.Keypair.generate().publicKey;
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver,
  );

  const delegate = web3.Keypair.generate();
  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals,
  );

  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals,
  );

  await revokeDelegate(
    connection,
    user,
    tokenAccount.address,
    user.publicKey,
  );
}
```

### 8. Quemar tokens

Finalmente, eliminemos algunas fichas de la circulación quemándolas.

Cree una `burnTokens` función que use la `burn` función de la `spl-token` biblioteca para eliminar la mitad de sus tokens de la circulación.

```tsx
async function burnTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  mint: web3.PublicKey,
  owner: web3.Keypair,
  amount: number,
) {
  const transactionSignature = await token.burn(
    connection,
    payer,
    account,
    mint,
    owner,
    amount,
  );

  console.log(
    `Burn Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
  );
}
```

Ahora llame a esta nueva función `main` para quemar 25 de los tokens del usuario. Recuerde ajustar la `amount` para la precisión decimal de la `mint`.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
  const user = await initializeKeypair(connection);

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2,
  );

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey,
  );

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals,
  );

  const receiver = web3.Keypair.generate().publicKey;
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver,
  );

  const delegate = web3.Keypair.generate();
  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals,
  );

  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals,
  );

  await revokeDelegate(
    connection,
    user,
    tokenAccount.address,
    user.publicKey,
  );

  await burnTokens(
    connection,
    user,
    tokenAccount.address,
    mint,
    user,
    25 * 10 ** mintInfo.decimals,
  );
}
```

### 9. Pruébalo todo

Con eso, ejecute `npm start`. Debería ver una serie de enlaces de Solana Explorer registrados en la consola. ¡Haga clic en ellos y vea lo que sucedió en cada paso del camino! Ha creado un nuevo token Mint, ha creado una cuenta de token, ha acuñado 100 tokens, ha aprobado un delegado, ha transferido 50 mediante un delegado, ha revocado el delegado y ha quemado 25 más. Estás en camino de convertirte en un experto en tokens.

Si necesitas un poco más de tiempo con este proyecto para sentirte cómodo, echa un vistazo a la [código de solución](https://github.com/Unboxed-Software/solana-token-client)

# Desafío

Ahora es tu turno de construir algo de forma independiente. Cree una aplicación que permita a los usuarios crear una nueva Mint, crear una cuenta de token y tokens Mint.

Tenga en cuenta que no podrá usar directamente las funciones de ayuda que revisamos en la demostración. Para interactuar con el Programa Token utilizando el adaptador de billetera Phantom, tendrá que compilar cada transacción manualmente y enviar la transacción a Phantom para su aprobación.

![Captura de pantalla de Token Program Challenge Frontend](../../assets/token-program-frontend.png)

1. Puede construir esto desde cero o puede descargar el código de inicio[here](https://github.com/Unboxed-Software/solana-token-frontend/tree/starter).
2. Cree un nuevo Token Mint en el `CreateMint` componente.
   Si necesita un repaso sobre cómo enviar transacciones a una billetera para su aprobación, eche un vistazo a la[Lección de monederos](./interact-with-wallets).

  Al crear una nueva menta, el recién generado también `Keypair` tendrá que firmar la transacción. Cuando se requieran firmantes adicionales además de la billetera conectada, use el siguiente formato:

  ```tsx
  sendTransaction(transaction, connection, {
    signers: [Keypair],
  });
  ```

3. Cree una nueva cuenta de token en el `CreateTokenAccount` componente.
4. Tokens de menta en el `MintToForm` componente.

Si te quedas perplejo, siéntete libre de hacer referencia a la[código de solución](https://github.com/ZYJLiu/solana-token-frontend).

¡Y recuerda, sé creativo con estos desafíos y hazlos tuyos!

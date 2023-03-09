# Crear tokens con el programa de tokens 
 ## Objetivos de la lección

*Al final de esta lección, serás capaz de:*
- Crear acuñaciones de fichas
- Crear cuentas de fichas
- Acuñar fichas
- Transferir fichas
- Quemar fichas
 
# Terminología
- Los **tokens SPL** representan todos los tokens no nativos en la red de Solana. Tanto los tokens fungibles como los tokens no fungibles (NFTs) en Solana son tokens SPL
- El **Programa Token** contiene instrucciones para crear e interactuar con tokens SPL
- Las **acuñaciones de tokens** son cuentas que contienen datos sobre un token específico, pero no contienen tokens
- Las **cuentas de tokens** se utilizan para contener tokens de una acuñación de tokens específica
- Crear acuñaciones de tokens y cuentas de tokens requiere asignar **renta** en SOL. La renta de una cuenta de token se puede reembolsar cuando se cierra la cuenta, sin embargo, las acuñaciones de tokens actualmente no se pueden cerrar.
 
 # Resumen
 El Programa Token es uno de los muchos programas disponibles en la biblioteca de programas Solana (SPL). Contiene instrucciones para crear e interactuar con tokens SPL. Estos tokens representan todos los tokens no nativos (es decir, no SOL) en la red de Solana.

 Esta lección se centrará en los conceptos básicos de crear y gestionar un nuevo token SPL utilizando el programa Token:

1. Crear una nueva acuñación de token
2. Crear cuentas de token
3. Acuñar
4. Transferir tokens de un titular a otro
5. Quemar tokens

Abordaremos esto desde el lado del cliente del proceso de desarrollo utilizando la biblioteca Javascript **@solana/spl-token** .
 
 ## ACUÑACIÓN(minteo) DE TOKEN
 Para crear un nuevo SPL-Token, primero debe crear un Token Mint. Un Token Mint es la cuenta que contiene datos sobre un token específico.

Como ejemplo, veamos el **USD Coin (USDC) en el Solana Explorer** . La dirección del Token Mint de USDC es **EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v** . Con el explorador, podemos ver los detalles particulares sobre el Token Mint de USDC, como la oferta actual de tokens, las direcciones de los autoridades de acuñación y congelación, y la precisión decimal del token:
 
 ![2.1](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%202/images/2.1/1.png?raw=true)

 
Para crear una nueva acuñación de Tokens, necesita enviar las instrucciones de transacción correctas al programa de Tokens. Para hacerlo, usaremos la función **createMint** de **@solana/spl-token** .

```Javascript
const tokenMint = await createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimal
);
 
La función **createMint** devuelve la **clave pública** de la nueva fábrica de Tokens. Esta función requiere los siguientes argumentos:


```

- **conexión** - la conexión JSON-RPC al clúster
- **pagador** - la clave pública del pagador de la transacción
- **mintAuthority** - la cuenta que está autorizada para hacer el acuñamiento real de los tokens desde la fábrica de tokens.
- **freezeAuthority** - una cuenta autorizada para congelar los tokens en una cuenta de token. Si congelar no es un atributo deseado, el parámetro se puede establecer en null
- **decimales** - especifica la precisión deseada de los decimales del token.
 
Al crear una nueva acuñación desde un script que tiene acceso a su clave secreta, simplemente puede usar la función **createMint** . Sin embargo, si desea construir un sitio web para permitir a los usuarios crear una nueva fábrica de tokens, debería hacerlo con la clave secreta del usuario sin hacerles exponerlo al navegador. En ese caso, desearía construir y enviar una transacción con las instrucciones correctas.
 
Bajo el capó, la función **createMint** simplemente crea una transacción que contiene dos instrucciones:

1. Crear una nueva cuenta
2. Inicializar una nueva acuñación.

Esto se vería de la siguiente manera:

```Javascript
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateMintTransaction(
    connection: web3.Connection,
    payer: web3.PublicKey,
    decimals: number
): Promise<web3.Transaction> {
    const lamports = await token.getMinimumBalanceForRentExemptMint(connection);
    const accountKeypair = web3.Keypair.generate();
    const programId = token.TOKEN_PROGRAM_ID

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
            programId
        )
    );

    return transaction
}
``` 


Al construir manualmente las instrucciones para crear una nueva acuñación de tokens, asegúrese de agregar las instrucciones para crear la cuenta e inicializar la fábrica en la misma transacción. Si hiciera cada paso en una transacción separada, es probable que alguien más pueda tomar la cuenta que creó e inicializarla para su propia fábrica.
 
### Alquiler y Exención de Alquiler
Tenga en cuenta que la primera línea en el cuerpo de la función del fragmento de código anterior contiene una llamada a **getMinimumBalanceForRentExemptMint** , cuyo resultado se pasa a la función **createAccount** . Esto forma parte de la inicialización de la cuenta llamada exención de alquiler.

Hasta recientemente, todas las cuentas en Solana debían hacer lo siguiente para evitar ser desasignadas:
1. Pagar alquiler en intervalos específicos
2. Depositar suficiente SOL al inicializar para ser considerado exento de alquiler.

Recientemente, se eliminó la primera opción y se convirtió en un requisito depositar suficiente SOL para la exención de alquiler al inicializar una nueva cuenta.

En este caso, estamos creando una nueva cuenta para una fábrica de tokens, por lo que usamos **getMinimumBalanceForRentExemptMint** de la biblioteca **@solana/spl-token** . Sin embargo, este concepto se aplica a todas las cuentas y puede usar el método **getMinimumBalanceForRentExemption** más genérico en **Connection** para otras cuentas que pueda necesitar crear.
 ## Cuenta de Tokens
Antes de poder acuñar tokens (emitir nueva oferta), necesita una Cuenta de Tokens para contener los tokens recién emitidos.

Una Cuenta de Tokens contiene tokens de una "fábrica" específica y tiene un "propietario" específico de la cuenta. Solo el propietario está autorizado a disminuir el saldo de la Cuenta de Tokens (transferir, quemar, etc.), mientras que cualquiera puede enviar tokens a la Cuenta de Tokens para aumentar su saldo.

Puede usar la función **createAccount** de la biblioteca **spl-token** para crear la nueva Cuenta de Tokens:

```Javascript
const tokenAccount = await createAccount(
    connection,
    payer,
    mint,
    owner,
    keypair
);
```
 

La función **createAccount** devuelve la **clave pública** de la nueva cuenta de tokens. Esta función requiere los siguientes argumentos:
 
- **conexión** - la conexión JSON-RPC al clúster
- **pagador** - la cuenta del pagador de la transacción
- **fábrica** - la fábrica de tokens con la que está asociada la nueva cuenta de tokens
- **propietario** - la cuenta del propietario de la nueva cuenta de tokens
- **keypair** - este es un parámetro opcional para especificar la dirección de la nueva cuenta de tokens. Si no se proporciona keypair, la función **createAccount** utiliza una derivación de las cuentas de **fábrica** y **propietario** asociadas.
 
Tenga en cuenta que esta función **createAccount** es diferente de la función **createAccount** mostrada anteriormente cuando miramos bajo el capó de la función **createMint** . Anteriormente usamos la función **createAccount** en **SystemProgram** para devolver la instrucción para crear todas las cuentas. La función **createAccount** aquí es una función auxiliar en la biblioteca **spl-token** que envía una transacción con dos instrucciones. La primera crea la cuenta y la segunda inicializa la cuenta como una Cuenta de Tokens.
Al igual que al crear una Fábrica de Tokens, si necesitáramos construir la transacción para **createAccount** de forma manual, podríamos duplicar lo que la función está haciendo bajo el capó:
 
1. Utilice **getMint** para recuperar los datos asociados con la **fábrica**
2. Utilice **getAccountLenForMint** para calcular el espacio necesario para la cuenta de tokens
3. Utilice **getMinimumBalanceForRentExemption** para calcular los lamports necesarios para la exención de alquiler
4. Crear una nueva transacción utilizando **SystemProgram.createAccount** y **createInitializeAccountInstruction** . Tenga en cuenta que este **createAccount** es de **@solana/web3.js** y se utiliza para crear una nueva cuenta genérica. La función **createInitializeAccountInstruction** utiliza esta nueva cuenta para inicializar la nueva cuenta de tokens.

```Javascript
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateTokenAccountTransaction(
    connection: web3.Connection,
    payer: web3.PublicKey,
    mint: web3.PublicKey
): Promise<web3.Transaction> {
    const mintState = await token.getMint(connection, mint)
    const accountKeypair = await web3.Keypair.generate()
    const space = token.getAccountLenForMint(mintState);
    const lamports = await connection.getMinimumBalanceForRentExemption(space);
    const programId = token.TOKEN_PROGRAM_ID

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
            programId
        )
    );

    return transaction
}
```
 
 ### Cuenta de Tokens Asociada
Una Cuenta de Tokens Asociada es una Cuenta de Tokens donde la dirección de la Cuenta de Tokens se deriva utilizando la clave pública de un propietario y una fábrica de tokens. Las Cuentas de Tokens Asociadas proporcionan una forma determinista de encontrar la Cuenta de Tokens propiedad de una **clave pública** específica para una fábrica de tokens específica. La mayoría de las veces que creas una Cuenta de Tokens, querrás que sea una Cuenta de Tokens Asociada.

Al igual que anteriormente, puede crear una cuenta de tokens asociada utilizando la función **createAssociatedTokenAccount** de la biblioteca **spl-token**.

```Javascript
const associatedTokenAccount = await createAssociatedTokenAccount(
    connection,
	payer,
	mint,
	owner,
);
```
 
Esta función devuelve la **clave pública** de la nueva cuenta de tokens asociada y requiere los siguientes argumentos:
-  **conexión** - la conexión JSON-RPC al clúster
- **pagador** - la cuenta del pagador de la transacción
- **fábrica** - la fábrica de tokens con la que está asociada la nueva cuenta de tokens
- **propietario** - la cuenta del propietario de la nueva cuenta de Tokens
 
También puede utilizar la función **getOrCreateAssociatedTokenAccount** para obtener la Cuenta de Tokens asociada con una dirección dada o crearla si no existe. Por ejemplo, si estuviera escribiendo código para una distribución de tokens a un usuario específico, probablemente utilizaría esta función para asegurar que se crea la cuenta de tokens asociada con el usuario dado si aún no existe.

Bajo el capó, **createAssociatedTokenAccount** está haciendo dos cosas:

```Javascript
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateAssociatedTokenAccountTransaction(
    payer: web3.PublicKey,
    mint: web3.PublicKey
): Promise<web3.Transaction> {
    const associatedTokenAddress = await token.getAssociatedTokenAddress(mint, payer, false);

    const transaction = new web3.Transaction().add(
        token.createAssociatedTokenAccountInstruction(
            payer,
            associatedTokenAddress,
            payer,
            mint
        )
    )

    return transaction
}
```
 
1. Utilizando **getAssociatedTokenAddress** para derivar la dirección de la cuenta de tokens asociada a partir de la **fábrica** y el **propietario**
2. Construyendo una transacción utilizando instrucciones de **createAssociatedTokenAccountInstruction**

## Acuñar(mintear) Tokens
La acuñación de tokens es el proceso de emitir nuevos tokens en circulación. Cuando acuñas tokens, aumentas la oferta de la fábrica de tokens y depositas los tokens recién acuñados en una cuenta de tokens. Solo la autoridad de la fábrica de una fábrica de tokens está autorizada para acuñar nuevos tokens.

Para acuñar tokens utilizando la biblioteca **spl-token** , puede utilizar la función **mintTo**.

```Javascript
const transactionSignature = await mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount
);
```
 
La función **mintTo** devuelve una **TransactionSignature** que se puede ver en el Solana Explorer. La función **mintTo** requiere los siguientes argumentos:

- **conexión** - la conexión JSON-RPC al clúster
- **pagador** - la cuenta del pagador de la transacción
- **fábrica** - la fábrica de tokens de la que se emitirán los nuevos tokens
- **destino** - la cuenta de tokens en la que se acuñarán los tokens
- **autoridad** - la cuenta autorizada para acuñar tokens
-  **cantidad** - la cantidad bruta de tokens a acuñar fuera de los decimales, por ejemplo, si el decimal de la fábrica de Scrooge Coin estaba establecido en 2, entonces para obtener 1 Scrooge Coin completo necesitaría establecer este parámetro en 100

No es infrecuente actualizar la autoridad de la fábrica de tokens en una fábrica de tokens a null después de que los tokens se hayan acuñado. Esto establecería una oferta máxima y aseguraría que no se puedan acuñar tokens en el futuro. Por el contrario, se podría otorgar la autoridad de acuñación a un programa para que los tokens puedan acuñarse automáticamente en intervalos regulares o de acuerdo con condiciones programables.

Bajo el capó, la función **mintTo** simplemente crea una transacción con las instrucciones obtenidas de la función **createMintToInstruction** .

```Javascript
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildMintToTransaction(
    authority: web3.PublicKey,
    mint: web3.PublicKey,
    amount: number,
    destination: web3.PublicKey
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createMintToInstruction(
            mint,
            destination,
            authority,
            amount
        )
    )

    return transaction
}
```

## Transferir Tokens
 
Las transferencias SPL-Token requieren que tanto el remitente como el receptor tengan cuentas de tokens para la fábrica de tokens que se están transfiriendo. Los tokens se transfieren de la cuenta de tokens del remitente a la cuenta de tokens del receptor.

Puede usar **getOrCreateAssociatedTokenAccount** al obtener la cuenta de tokens asociada del receptor para asegurarse de que su cuenta de tokens exista antes de la transferencia. Solo recuerde que si la cuenta no existe ya, esta función la creará y el pagador en la transacción se verá debitado los lamports necesarios para la creación de la cuenta.

Una vez que conozca la dirección de la cuenta de tokens del receptor, **transfiere** tokens utilizando la función transfer de la biblioteca **spl-token**.

```Javascript
const transactionSignature = await transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount
)
```

La función de **transferencia** devuelve una **TransactionSignature** que se puede ver en el Solana Explorer. La función de **transferencia** requiere los siguientes argumentos:
- conexión: la conexión JSON-RPC al clúster
- pagador: la cuenta del pagador de la transacción
- origen: la cuenta de tokens que envía tokens
- destino: la cuenta de tokens que recibe tokens
- propietario: la cuenta del propietario de la cuenta de tokens de origen
- cantidad: la cantidad de tokens a transferir

Bajo el capó, la función de **transferencia** simplemente crea una simplemente crea una transacción con las instrucciones obtenidas de la función **createTransferInstruction**

```Javascript
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildTransferTransaction(
    source: web3.PublicKey,
    destination: web3.PublicKey,
    owner: web3.PublicKey,
    amount: number
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createTransferInstruction(
            source,
            destination,
            owner,
            amount,
        )
    )

    return transaction
}
```


## Quemar Tokens
La quema de tokens es el proceso de disminuir la oferta de tokens de una fábrica de tokens dada. La quema de tokens los elimina de la cuenta de tokens dada y de la circulación en general.

Para quemar tokens utilizando la biblioteca **spl-token** , utiliza la función **burn**.

```Javascript
const transactionSignature = await burn(
    connection,
    payer,
    account,
    mint,
    owner,
    amount
)
```

La función **burn** devuelve una **TransactionSignature** que se puede ver en Solana Explorer. La función **burn** requiere los siguientes argumentos:

- **conexión** - la conexión JSON-RPC al clúster
- **pagador** - la cuenta del pagador de la transacción
- **cuenta** - la cuenta de tokens desde la cual se quemarán los tokens
- **fábrica** - la fábrica de tokens asociada con la cuenta de tokens
- **propietario** - la cuenta del propietario de la cuenta de tokens
- **cantidad** - la cantidad de tokens a quemar

Bajo el capó, la función **burn** crea una transacción con instrucciones obtenidas de la función **createBurnInstruction** :

```Javascript
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildBurnTransaction(
    account: web3.PublicKey,
    mint: web3.PublicKey,
    owner: web3.PublicKey,
    amount: number
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createBurnInstruction(
            account,
            mint,
            owner,
            amount
        )
    )

    return transaction
}
```
 
## Aprobar Delegado
Aprobar un delegado es el proceso de autorizar a otra cuenta para transferir o quemar tokens desde una cuenta de tokens. Al usar un delegado, la autoridad sobre la cuenta de tokens permanece con el propietario original. La cantidad máxima de tokens que un delegado puede transferir o quemar se especifica en el momento en que el propietario de la cuenta de tokens aprueba al delegado. Tenga en cuenta que solo puede haber una cuenta delegada asociada con una cuenta de tokens en cualquier momento dado.

Para aprobar un delegado utilizando la biblioteca **spl-token** , utiliza la función **approve** .

```Javascript
const transactionSignature = await approve(
    connection,
    payer,
    account,
    delegate,
    owner,
    amount
  )
```
  
La función **approve** devuelve una **TransactionSignature** que se puede ver en Solana Explorer. La función **approve** requiere los siguientes argumentos:

- **conexión** - la conexión JSON-RPC al clúster
- **pagador** - la cuenta del pagador de la transacción
- **cuenta** - la cuenta de tokens desde la cual se delegarán los tokens
- **delegado** - la cuenta que el propietario está autorizando para transferir o quemar tokens
- **propietario** - la cuenta del propietario de la cuenta de tokens
- **cantidad** - el número máximo de tokens que el delegado puede transferir o quemar

Bajo el capó, la función **approve** crea una transacción con instrucciones obtenidas de la función **createApproveInstruction**

```Javascript
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildApproveTransaction(
    account: web3.PublicKey,
    delegate: web3.PublicKey,
    owner: web3.PublicKey,
    amount: number
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createApproveInstruction(
            account,
            delegate,
            owner,
            amount
        )
    )

    return transaction
}
```
 
## Revocar Delegado
Un delegado previamente aprobado para una cuenta de tokens puede ser revocado más tarde. Una vez que se revoca un delegado, el delegado ya no puede transferir tokens desde la cuenta de tokens del propietario. Cualquier cantidad restante no transferida del monto previamente aprobado ya no puede ser transferida por el delegado.

Para revocar un delegado utilizando la biblioteca **spl-token** , utiliza la función **revoke** .

```Javascript
const transactionSignature = await revoke(
    connection,
    payer,
    account,
    owner,
  )
```
 
La función **revoke** devuelve una **TransactionSignature** que se puede ver en Solana Explorer. La función **revoke** requiere los siguientes argumentos:

- **conexión** : la conexión JSON-RPC al clúster
- **pagador** : la cuenta del pagador de la transacción
- **cuenta** : la cuenta de tokens desde la cual se revocará la autoridad del delegado
- **propietario** : la cuenta del propietario de la cuenta de tokens

Bajo el capó, la función **revoke** crea una transacción con instrucciones obtenidas de la función **createRevokeInstruction** .

```Javascript
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildRevokeTransaction(
    account: web3.PublicKey,
    owner: web3.PublicKey,
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createRevokeInstruction(
            account,
            owner,
        )
    )

    return transaction
}
```

# DEMOSTRACIÓN
Vamos a crear un script que interactúe con las instrucciones en el Programa de Tokens. Crearemos una Fábrica de Tokens, crearemos Cuentas de Tokens, acuñaremos tokens, aprobaremos a un delegado, transferiremos tokens y quemaremos tokens.

## 1. Estructura básica 
Empecemos con alguna estructura básica. Usted puede configurar su proyecto como mejor le parezca, pero usaremos un proyecto simple de Typescript con una dependencia de **@solana/web3.js** y **@solana/spl-token** paquetes. 
Puede usar **npx create-solana-client [INSERT_NAME_HERE]** en la línea de comandos para clonar la plantilla desde la que comenzaremos. O puede clonar manualmente la plantilla [aquí](https://github.com/Unboxed-Software/solana-client-template). 
Luego deberá agregar una dependencia en **@solana/spl-token** . Desde la línea de comandos dentro del directorio recién creado, utilice el comando **npm install @solana/spl-token** .
 
## 2. Crear Fábrica de Token
 Usaremos la biblioteca **@solana/spl-token** , así que empecemos importándola en la parte superior del archivo.

 ```Javascript
 import * as token from '@solana/spl-token'
 ```
 
A continuación, declare una nueva función **createNewMint** con los parámetros de **conexión** , **pagador** , **mintAuthority** , **freezeAuthority** y **decimales** . 

En el cuerpo de la función, importe **createMint** desde **@solana/spl-token** y luego cree una función para llamar a **createMint** :

```Javascript
async function createNewMint(
    connection: web3.Connection,
    payer: web3.Keypair,
    mintAuthority: web3.PublicKey,
    freezeAuthority: web3.PublicKey,
    decimals: number
): Promise<web3.PublicKey> {

    const tokenMint = await token.createMint(
        connection,
        payer,
        mintAuthority,
        freezeAuthority,
        decimals
    );

    console.log(
        `Token Mint: https://explorer.solana.com/address/${tokenMint}?cluster=devnet`
    );

    return tokenMint;
}
```
 
Una vez completada la función, llámela desde el cuerpo de **main** , estableciendo al **usuario** como **pagador** , **mintAuthority**  y **freezeAuthority** .

Después de crear la nueva fábrica, vamos a recuperar los datos de la cuenta utilizando la función **getMint** y almacenarlos en una variable llamada **mintInfo** . Usaremos estos datos más tarde para ajustar la **cantidad** de entrada para la precisión decimal de la fábrica.

```Javascript
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);
}
```
 
## 3. Crear cuenta de token
Ahora que hemos creado la fábrica, vamos a crear una nueva cuenta de token, especificando al **usuario** como **propietario**. 

La función **createAccount** crea una nueva cuenta de token con la opción de especificar la dirección de la cuenta de token. Recuerde que si no se proporciona una dirección, **createAccount** usará la cuenta de token asociada derivada utilizando la **fábrica** y el **propietario**.

 Alternativamente, la función **createAssociatedTokenAccount** también creará una cuenta de token asociada con la misma dirección derivada de las claves públicas de la **fábrica** y el **propietario**.

 Para nuestra demostración, utilizaremos la función **getOrCreateAssociatedTokenAccount** para crear nuestra cuenta de token. Esta función obtiene la dirección de una cuenta de token si ya existe. Si no es así, creará una nueva cuenta de token asociada en la dirección adecuada.

```Javascript
async function createTokenAccount(
    connection: web3.Connection,
    payer: web3.Keypair,
    mint: web3.PublicKey,
    owner: web3.PublicKey
) {
    const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        owner
    )

    console.log(
        `Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`
    )

    return tokenAccount
}
```
 
 Agregue una llamada a la función createTokenAccount en main, pasando la fábrica que creamos en el paso anterior y estableciendo al usuario como pagador y propietario.

```Javascript
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )
}
```
  
## 4. Acuñar Tokens 
Ahora que tenemos una fábrica de tokens y una cuenta de tokens, acunemos tokens a la cuenta de tokens. Tenga en cuenta que solo la **mintAuthority** puede acuñar nuevos tokens a una cuenta de tokens. Recuerde que establecimos al **usuario** como **mintAuthority** para la **fábrica** que creamos. 
Cree una función **mintTokens** que utilice la función **mintTo** de **spl-token** para acuñar tokens:

```Javascript
async function mintTokens(
    connection: web3.Connection,
    payer: web3.Keypair,
    mint: web3.PublicKey,
    destination: web3.PublicKey,
    authority: web3.Keypair,
    amount: number
) {
    const transactionSignature = await token.mintTo(
        connection,
        payer,
        mint,
        destination,
        authority,
        amount
    )

    console.log(
        `Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```
 
Llamemos la función en **main** utilizando la **fábrica** y la **cuenta de token** creadas anteriormente.

Ten en cuenta que tenemos que ajustar la **cantidad** de entrada para la precisión decimal de la fábrica. Los tokens de nuestra **fábrica** tienen una precisión decimal de 2. Si solo especificamos 100 como la **cantidad** de entrada, solo se acuñará 1 token en nuestra cuenta de token.

```Javascript
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )
}
```
 
## 5. Aprobar Delegado 
Ahora que tenemos una fábrica de tokens y una cuenta de tokens, autorizamos a un delegado para transferir tokens en nuestro nombre.

 Cree una función **approveDelegate** que utilice la función **approve** de **spl-token** para acuñar tokens:

```Javascript
async function approveDelegate(
    connection: web3.Connection,
    payer: web3.Keypair,
    account: web3.PublicKey,
    delegate: web3.PublicKey,
    owner: web3.Signer | web3.PublicKey,
    amount: number
) {
    const transactionSignature = await token.approve(
        connection,
        payer,
        account,
        delegate,
        owner,
        amount
  )

    console.log(
        `Approve Delegate Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```
 
En **main** , generemos un nuevo **Keypair** para representar la cuenta de delegado. Luego, llamemos a nuestra nueva función **approveDelegate** y autorizemos al delegado para transferir hasta 50 tokens de la cuenta de tokens del **usuario**. Recuerde ajustar la **cantidad** para la precisión decimal de la **fábrica**.

```Javascript
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )

    const delegate = web3.Keypair.generate();

    await approveDelegate(
      connection,
      user,
      tokenAccount.address,
      delegate.publicKey,
      user.publicKey,
      50 * 10 ** mintInfo.decimals
    )
}
```
 
## 6. Transferir Tokens
 A continuación, transfiramos algunos de los tokens que acabamos de acuñar utilizando la función de **transferencia** de la biblioteca **spl-token**.

```Javascript
async function transferTokens(
    connection: web3.Connection,
    payer: web3.Keypair,
    source: web3.PublicKey,
    destination: web3.PublicKey,
    owner: web3.Keypair,
    amount: number
) {
    const transactionSignature = await token.transfer(
        connection,
        payer,
        source,
        destination,
        owner,
        amount
    )

    console.log(
        `Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```
 
Antes de llamar a esta nueva función, necesitamos saber la cuenta a la que transferiremos los tokens.

En **main** , generemos un nuevo **Keypair**  para ser el receptor (pero recuerde que esto solo es para simular tener a alguien para enviar tokens - en una aplicación real necesitaría saber la dirección de la billetera de la persona que recibe los tokens).

Luego, cree una cuenta de token para el receptor. Finalmente, llamemos a nuestra nueva función **transferTokens** para transferir tokens de la cuenta de tokens del **usuario** a la cuenta de tokens del **receptor** . Utilizaremos el **delegado** que aprobamos en el paso anterior para realizar la transferencia en nuestro nombre.

```Javascript
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    const mintInfo = await token.getMint(connection, mint);

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )

    const receiver = web3.Keypair.generate().publicKey
    const receiverTokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        receiver
    )

    const delegate = web3.Keypair.generate();
    await approveDelegate(
        connection,
        user,
        tokenAccount.address,
        delegate.publicKey,
        user.publicKey,
        50 * 10 ** mintInfo.decimals
    )

    await transferTokens(
        connection,
        user,
        tokenAccount.address,
        receiverTokenAccount.address,
        delegate,
        50 * 10 ** mintInfo.decimals
    )
}
```
 
## 7. Revocar Delegado 
Ahora que hemos terminado de transferir tokens, revoquemos el **delegado** utilizando la función **revoke** de la biblioteca **spl-token**.

```Javascript
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
  )

    console.log(
        `Revote Delegate Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```

Revoke establecerá el delegado para la cuenta de token en null y restablecerá la cantidad delegada a 0. Todo lo que necesitaremos para esta función es la cuenta de token y el usuario. Llame a nuestra nueva función **revokeDelegate** para revocar el delegado de la cuenta de tokens del **usuario**.

```Javascript
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )

    const receiver = web3.Keypair.generate().publicKey
    const receiverTokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        receiver
    )

    const delegate = web3.Keypair.generate();
    await approveDelegate(
        connection,
        user,
        tokenAccount.address,
        delegate.publicKey,
        user.publicKey,
        50 * 10 ** mintInfo.decimals
    )

    await transferTokens(
        connection,
        user,
        tokenAccount.address,
        receiverTokenAccount.address,
        delegate,
        50 * 10 ** mintInfo.decimals
    )

    await revokeDelegate(
        connection,
        user,
        tokenAccount.address,
        user.publicKey,
    )
}
```

## 8. Quemar Tokens 
Finalmente, eliminemos algunos tokens de circulación quemándolos. 

Cree una función **burnTokens** que utilice la función **burn** de la biblioteca **spl-token** para eliminar la mitad de sus tokens de circulación.

```Javascript
async function burnTokens(
    connection: web3.Connection,
    payer: web3.Keypair,
    account: web3.PublicKey,
    mint: web3.PublicKey,
    owner: web3.Keypair,
    amount: number
) {
    const transactionSignature = await token.burn(
        connection,
        payer,
        account,
        mint,
        owner,
        amount
    )

    console.log(
        `Burn Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```
 
Ahora llama esta nueva función en **main** para quemar 25 tokens del usuario. Recuerda ajustar la **cantidad** para la precisión decimal de la **fábrica**.

```Javascript
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )

    const receiver = web3.Keypair.generate().publicKey
    const receiverTokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        receiver
    )

    const delegate = web3.Keypair.generate();
    await approveDelegate(
        connection,
        user,
        tokenAccount.address,
        delegate.publicKey,
        user.publicKey,
        50 * 10 ** mintInfo.decimals
    )

    await transferTokens(
        connection,
        user,
        tokenAccount.address,
        receiverTokenAccount.address,
        delegate,
        50 * 10 ** mintInfo.decimals
    )

    await revokeDelegate(
        connection,
        user,
        tokenAccount.address,
        user.publicKey,
    )

    await burnTokens(
        connection, 
        user, 
        tokenAccount.address, 
        mint, user, 
        25 * 10 ** mintInfo.decimals
    )
}
```
  
## 9. Pruébalo todo
Con eso, ejecuta **npm start** . ¡Deberías ver una serie de enlaces de Solana Explorer registrados en la consola! ¡Haz clic en ellos y mira lo que sucedió en cada paso del camino! Creaste una nueva fábrica de tokens, creaste una cuenta de tokens, acuñaste 100 tokens, aprobaste un delegado, transferiste 50 usando un delegado, revocaste el delegado y quemaste 25 más. Estás bien encaminado para ser un experto en tokens.
Si necesitas un poco más de tiempo con este proyecto para sentirte cómodo, echa un vistazo al código de solución completo.

## Desafío

Ahora es tu turno de construir algo de forma independiente. Crea una aplicación que permita a los usuarios crear una nueva fábrica, crear una cuenta de tokens y acuñar tokens.

Tenga en cuenta que no podrá usar directamente las funciones de ayuda que revisamos en la demo. Para interactuar con el programa Token utilizando el adaptador de la billetera Phantom, deberá construir manualmente cada transacción y enviar la transacción a Phantom para su aprobación.


![2.3](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%202/images/2.1/2.png)


- Puedes construirlo desde cero o descargar el código inicial [aquí](https://github.com/Unboxed-Software/solana-token-frontend/tree/starter).

- Crea una nueva Fábrica de Tokens en el componente CreateMint. Si necesita un repaso sobre cómo enviar transacciones a una billetera para su aprobación, consulte la [lección de Billeteras](https://soldev.app/course/interact-with-wallets.md).

Al crear una nueva fábrica, la Keypair recién generada también deberá firmar la transacción. Cuando se requieren firmantes adicionales además de la billetera conectada, utilice el siguiente formato:

```Javascript
sendTransaction(transaction, connection, {
    signers: [Keypair],
})
```

Crea una nueva cuenta de Token en el componente CreateTokenAccount.

Acuña tokens en el componente MintToForm.

Si te atascas, no dudes en consultar el [código de solución](https://github.com/ZYJLiu/solana-token-frontend).

Y recuerda, ponte creativo y diviértete!!
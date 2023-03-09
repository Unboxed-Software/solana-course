# Intercambiar tokens con el programa de intercambio de tokens
## Objetivos de la lección:
 Al final de esta lección, podrás:
- Crear una piscina de intercambio de tokens
- Depositar liquidez
- Retirar liquidez
- Intercambiar Tokens
 # Terminología
- El **programa de intercambio de tokens** es un contrato SPL desplegado en Devnet disponible para pruebas y experimentación por parte de desarrolladores y protocolos. Para usos de producción, utilice su propio despliegue o uno mantenido regularmente por un servicio de renombre.
- El programa acepta seis **instrucciones** diferentes, todas las cuales exploraremos en esta lección.
- Los desarrolladores pueden crear y usar **piscinas de liquidez** para intercambiar cualquier token SPL que deseen.
- El programa utiliza una fórmula matemática llamada **"curva"** para calcular el precio de todas las operaciones. Las curvas buscan imitar la dinámica normal de los mercados: por ejemplo, a medida que los operadores compran mucho de un tipo de token, el valor del otro tipo de token sube.

# Resumen 
## Piscinas de intercambio
Antes de entrar en cómo crear e interactuar con piscinas de intercambio en Solana, es importante entender los conceptos básicos de lo que es una piscina de intercambio.

 Una piscina de intercambio es una agregación de dos tokens diferentes con el propósito de proporcionar liquidez para facilitar el intercambio entre cada token.

 Los usuarios proporcionan liquidez a estas piscinas depositando sus propios tokens en cada piscina. Estos usuarios se llaman proveedores de liquidez. Cuando un proveedor de liquidez (o LP) deposita algunos tokens en la piscina de intercambio, se acuñan tokens LP que representan la propiedad fraccional del LP en la piscina.

La mayoría de las piscinas de intercambio cobran una tarifa de negociación por facilitar cada intercambio. Estas tarifas luego se pagan a los LP en proporción a la cantidad de liquidez que están proporcionando en la piscina. Esto proporciona un incentivo para que los LP proporcionen liquidez a la piscina.

Cuando un LP está listo para retirar su liquidez depositada, sus tokens LP son quemados y los tokens de la piscina (proporcionales a la cantidad de tokens LP quemados) se envían a su billetera.

El propósito de las piscinas de intercambio es facilitar el comercio descentralizado entre usuarios. En la finanza tradicional, los usuarios ejecutan operaciones de este tipo a través de una bolsa centralizada en un **libro de órdenes** central. En general, esto requiere un intermediario de tercera parte de confianza.

Debido a la naturaleza descentralizada de las criptomonedas, ahora tenemos una nueva forma de facilitar las operaciones. Muchos protocolos de intercambio descentralizados se han construido para aprovechar esto. **Project Serum** es un ejemplo de un libro de órdenes centralizado descentralizado construido en Solana.

Dado que las piscinas de intercambio son completamente descentralizadas, cualquiera puede emitir instrucciones al programa de intercambio para crear una nueva piscina de intercambio entre cualquier token SPL que desee. Esto es un gran avance más allá de la finanza tradicional. Las piscinas de intercambio y los fabricantes de mercado automatizados (AMMs) son uno de los temas más fascinantes y complejos de DeFi. 

Los detalles técnicos de cómo funcionan están fuera del alcance de esta lección, pero hay una gran cantidad de material disponible si está interesado en aprender más. Por ejemplo, el programa de intercambio de tokens de Solana se inspiró en gran medida en [Uniswap](https://github.com/solana-labs/solana-program-library/tree/master/token-swap/program) y **Balancer** , cada uno de los cuales proporciona una excelente documentación que puede leer.
 
 ## Programa de Intercambio de Token y **@solana/spl-token-swap** 
 
A diferencia del programa Token, no hay un despliegue del programa de intercambio de tokens mantenido por Solana. En cambio, Solana proporciona el [código fuente](https://github.com/solana-labs/solana-program-library/tree/master/token-swap/program) del programa de intercambio de tokens como una implementación de referencia que puedes clonar y desplegar tú mismo. También puedes usar un programa de intercambio de tokens mantenido por una organización de terceros en la que confíes. A lo largo de esta lección, usaremos el despliegue mantenido por Serum en la dirección **SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8** .
 
Solana también mantiene la biblioteca JS **@solana/spl-token-swap** . Esta biblioteca proporciona funciones auxiliares para interactuar con un programa de intercambio de tokens. Cada función auxiliar toma un argumento que representa un ID de programa de intercambio de tokens. Siempre y cuando el programa que uses acepte las instrucciones de intercambio de tokens, puedes usar la biblioteca **@solana/spl-token-swap**  con él.


## Crear una piscina de intercambio
 Crear piscinas de intercambio con el programa SPL Token Swap realmente destaca los modelos de cuenta, instrucción y autorización en Solana. Esta lección combinará y se basará en lo que hemos aprendido hasta ahora en el curso. Para las operaciones específicas del programa de intercambio de tokens, usaremos la biblioteca **@solana/spl-token-swap** .
 
A medida que hablamos de cómo crear una piscina de intercambio, asumiremos que estamos creando una piscina de intercambio para dos tokens llamados Token A y Token B. Crear la piscina de intercambio con la biblioteca **spl-token-swap** es tan simple como enviar una transacción con una instrucción creada con la función **TokenSwap.createInitSwapInstruction** . Sin embargo, hay varias cuentas que debes crear o derivar previamente que serán necesarias al crear esa instrucción:
 
1. **Cuenta de estado de intercambio de tokens** - contiene información sobre la piscina de intercambio
2. **Autoridad de la piscina de intercambio** - el PDA utilizado para firmar transacciones en nombre del programa de intercambio
3. **Cuentas de token para Token A y Token B** - cuentas de token que almacenarán tokens A y B para la piscina
4. **Acuñación de token de la piscina** - la acuñación para el token LP de la piscina
5. **Cuenta de token de la piscina** - la cuenta de token para la acuñación inicial de la acuñación de token de la piscina cuando se crea la cuenta de intercambio
6. **Cuenta de tarifa de token de la piscina** - la cuenta que recibe las tarifas de negociación de la piscina de intercambio
 
 ### Cuenta de estado de intercambio de Tokens
 Antes de poder crear una piscina de intercambio, deberás crear una cuenta de estado de intercambio de tokens. Esta cuenta se utilizará para almacenar información sobre la piscina de intercambio en sí.
 
 Para crear la cuenta de estado de intercambio de tokens, utilizas **SystemProgram** la instrucción **createAccount**.

 ```JavaScript
import * as web3 from '@solana/web3'
import { TokenSwap, TOKEN_SWAP_PROGRAM_ID, TokenSwapLayout } from "@solana/spl-token-swap"

const transaction = new Web3.Transaction()
const tokenSwapStateAccount = Web3.Keypair.generate()
const rent = TokenSwap.getMinBalanceRentForExemptTokenSwap(connection)
const tokenSwapStateAccountInstruction = await Web3.SystemProgram.createAccount({
    newAccountPubkey: tokenSwapStateAccount.publicKey,
    fromPubkey: wallet.publicKey,
    lamports: rent,
    space: TokenSwapLayout.span,
    programId: TOKEN_SWAP_PROGRAM_ID
})
transaction.add(tokenSwapStateAccountInstruction)
```
 
Aquí hay algunas cosas importantes a tener en cuenta en este ejemplo:
 
1. Puedes obtener el número de lamports requeridos para la exención de alquiler utilizando **TokenSwap.getMinBalanceRentForExemptTokenSwap** de la biblioteca **spl-token-swap** .
2. De manera similar, puedes usar **TokenSwapLayout.span** para el espacio requerido en la cuenta.
3. **programId** debe establecerse en **TOKEN_SWAP_PROGRAM_ID** . Esto establece al propietario de la nueva cuenta como el programa de intercambio de tokens en sí. El programa de intercambio de tokens necesitará escribir datos en la nueva cuenta y, por lo tanto, debe establecerse como el propietario.
 
### Autoridad de la piscina de intercambio
La autoridad de la piscina de intercambio es la cuenta utilizada para firmar transacciones en nombre del programa de intercambio. Esta cuenta es una Dirección Derivada de Programa (PDA) derivada del programa de intercambio de tokens y la cuenta de estado de intercambio de tokens.

Las PDAs solo pueden ser creadas por su programa propietario, por lo que no necesita crear esta cuenta directamente. Sin embargo, necesita conocer su clave pública. Puede descubrirla utilizando la función **PublicKey.findProgramAddress** de la biblioteca **@solana/web3**.

```JavaScript
const [swapAuthority, bump] = await Web3.PublicKey.findProgramAddress(
    [tokenSwapStateAccount.publicKey.toBuffer()],
    TOKEN_SWAP_PROGRAM_ID,
)
```
 
La clave pública resultante se usará como autoridad en varias de las cuentas siguientes.
 
 ### Cuentas de token para Token A y Token B
Las cuentas de token A y Token B son las cuentas de token asociadas utilizadas para la piscina de intercambio real. Estas cuentas deben contener un cierto número de tokens A / B respectivamente y la PDA de la autoridad de intercambio debe marcarse como el propietario de cada una para que el programa de intercambio de tokens pueda firmar transacciones y transferir tokens de cada cuenta.

```JavaScript
let tokenAAccountAddress = await token.getAssociatedTokenAddress(
    tokenAMint, // mint
    swapAuthority, // owner
    true // allow owner off curve
)

const tokenAAccountInstruction = await token.createAssociatedTokenAccountInstruction(
    wallet.publicKey, // payer
    tokenAAccountAddress, // ata
    swapAuthority, // owner
    tokenAMint // mint
)

transaction.add(tokenAAccountInstruction)
```
 
Si necesita recordar cómo crear cuentas de token, eche un vistazo a la **lección del programa de token** .
  
### Acuñación de token de la piscina

La acuñación de token de la piscina es la acuñación de los tokens LP que representan la propiedad de un LP en la piscina. Creas esta acuñación de la manera en que aprendiste en la **lección del programa de tokens** . Para que funcione la piscina de intercambio, la autoridad de la acuñación debe ser la cuenta de autoridad de intercambio.

```JavaScript
const poolTokenMint = await token.createMint(
    connection,
    wallet,
    swapAuthority,
    null,
    2
)
```


### Cuenta de token de la piscina
La cuenta de token de la piscina es la cuenta a la que se acuñan los tokens de liquidez iniciales de la piscina cuando se crea por primera vez la cuenta de intercambio. Las acuñaciones posteriores de tokens LP se acuñarán directamente en la cuenta del usuario que agrega liquidez a la piscina. Los tokens de liquidez de la piscina representan propiedad en la liquidez depositada en la piscina.

```JavaScript
const tokenAccountPool = Web3.Keypair.generate()
const rent = await token.getMinimumBalanceForRentExemptAccount(connection)
const createTokenAccountPoolInstruction = Web3.SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: tokenAccountPool.publicKey,
    space: token.ACCOUNT_SIZE,
    lamports: rent,
    programId: token.TOKEN_PROGRAM_ID,
})
const initializeTokenAccountPoolInstruction = token.createInitializeAccountInstruction(
    tokenAccountPool.publicKey,
    poolTokenMint,
    wallet.publicKey
)

transaction.add(createTokenAccountPoolInstruction)
transaction.add(initializeTokenAccountPoolInstruction)
```
 
### Cuenta de tarifa de token de la piscina
La cuenta de tarifa de token de la piscina es la cuenta de token a la que se pagan las tarifas de los intercambios de tokens. Para la implementación de Serum del programa de intercambio de tokens que estamos utilizando, esta cuenta debe ser propiedad de una cuenta específica definida en el programa de intercambio: **HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN** .

```JavaScript
const feeOwner = new web3.PublicKey('HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN')

let tokenFeeAccountAddress = await token.getAssociatedTokenAddress(
    poolTokenMint, // mint
    feeOwner, // owner
    true // allow owner off curve
)

const tokenFeeAccountInstruction = await token.createAssociatedTokenAccountInstruction(
    wallet.publicKey, // payer
    tokenFeeAccountAddress, // ata
    feeOwner, // owner
    poolTokenMint // mint
)

transaction.add(tokenFeeAccountInstruction)
```
 
### Crear la piscina de intercambio
 Con todas las cuentas requeridas creadas, puedes crear la instrucción de inicialización de la piscina de intercambio utilizando **TokenSwap.createInitSwapInstruction** de la biblioteca **spl-token-swap** .

Esta función toma muchos argumentos. Vamos a hablar sobre ellos.

Los primeros 7 argumentos son las cuentas de token requeridas que acabamos de discutir.

Después de eso, viene la constante que representa el ID del programa de token seguida por la constante que representa el ID del programa de intercambio de tokens.

A continuación, hay 4 parejas de argumentos numéricos que representan los numeradores y denominadores de la tarifa de comercio, la tarifa de comercio del propietario, la tarifa de retirada del propietario y la tarifa del host. La instrucción utiliza el numerador y el denominador de cada uno para calcular el porcentaje de la tarifa. Vamos a explicar cada una de las tarifas:
 
1. **Tarifa de comercio** : tarifas que se retienen en las cuentas de token de la piscina de intercambio durante un comercio y aumentan el valor redimible de los tokens LP. Esta tarifa premia a los usuarios por proporcionar liquidez a la piscina de intercambio.
2. **Tarifa de comercio del propietario** : tarifas que se retienen en las cuentas de token de la piscina de intercambio durante un comercio, con el equivalente en tokens LP acuñado al propietario del programa.
3. **Tarifa de retirada del propietario** : tokens LP adicionales que se envían al propietario en cada retirada.
4. **Tarifa de host** : una proporción de las tarifas de comercio del propietario, enviada a una cuenta de token de host adicional proporcionada durante el comercio. Esta tarifa incentiva a las partes externas (como una exchange descentralizada) a proporcionar frontends para la piscina de intercambio y las recompensa con una porción.

Al utilizar un programa de intercambio desplegado y mantenido por un tercero, estas tarifas pueden o no ser fijas, de modo que debes ingresar los argumentos correctos. Necesitarás verificar la implementación del programa de respaldo.
Por último, hay el tipo de curva, que discutiremos más adelante en la lección.

```JavaScript
const createSwapInstruction = TokenSwap.createInitSwapInstruction(
    tokenSwapStateAccount,      // Token swap state account
    swapAuthority,              // Swap pool authority
    poolTokenA,                 // Token A token account
    poolTokenB,                 // Token B token account
    poolTokenMint,              // Swap pool token mint
    tokenFeeAccountAddress,     // Token fee account
    tokenAccountPool.publicKey, // Swap pool token account
    token.TOKEN_PROGRAM_ID,     // Token Program ID
    TOKEN_SWAP_PROGRAM_ID,      // Token Swap Program ID
    0,                          // Trade fee numerator
    10000,                      // Trade fee denominator
    5,                          // Owner trade fee numerator
    10000,                      // Owner trade fee denominator
    0,                          // Owner withdraw fee numerator
    0,                          // Owner withdraw fee denominator
    20,                         // Host fee numerator
    100,                        // Host fee denominator
    CurveType.ConstantProduct   // Curve type
)

transaction.add(createSwapInstruction)
```

Cuando una transacción con estas instrucciones se ejecuta con éxito, se crea la piscina de intercambio y está lista para ser utilizada.
 
## Interactuando con piscinas de intercambio
Una vez que se inicializa la piscina de intercambio, el programa de intercambio de tokens tiene varias instrucciones diferentes para utilizar una piscina de intercambio. Estos incluyen:

1. Ejecutar un intercambio
2. Depositar liquidez
3. Retirar liquidez
 
### Ejecutar un intercambio
 Los usuarios pueden comenzar a operar inmediatamente en una piscina de intercambio utilizando la instrucción de intercambio. La instrucción de intercambio transfiere fondos desde la cuenta de tokens de un usuario a la cuenta de tokens de la piscina de intercambio. La piscina de intercambio luego emite tokens LP ala cuenta de tokens LP del usuario.

Dado que los programas de Solana requieren que se declaren todas las cuentas en la instrucción, los usuarios deben recopilar toda la información de cuentas del token swap state account: las cuentas token A y B, la fábrica de tokens LP y la cuenta de tarifas.

Usamos el intercambio de tokens con la función de ayuda **TokenSwap.swapInstruction** que requiere los siguientes argumentos:

1. **tokenSwap** - la cuenta de estado de intercambio de tokens
2. **autoridad** - la autoridad de la piscina de intercambio
3. **userTransferAuthority** - el delegado sobre la cuenta de tokens del usuario
4. **userSource** - cuenta de tokens del usuario para transferir tokens a la piscina de intercambio
5. **poolSource** - cuenta de tokens de la piscina de intercambio para recibir los tokens transferidos desde el usuario
6. **poolDestination** - cuenta de tokens de la piscina de intercambio para enviar tokens al usuario
7. **userDestination** - cuenta de tokens del usuario para recibir los tokens enviados desde la piscina de intercambio
8. **poolMint** - la dirección de la fábrica de tokens LP
9. **feeAccount** - la cuenta de tokens que recibe las tarifas de operación del propietario
10. **hostFeeAccount** - la cuenta de tokens que recibe las tarifas de operación del host (parámetro opcional), establecida en null si no se proporciona ninguna
11. **swapProgramId** - la dirección del programa de intercambio de tokens
12. **tokenProgramId** - la dirección del programa de tokens
13. **amountIn** - cantidad de tokens que el usuario desea transferir a la piscina de intercambio
14. **minimumAmountOut** es el monto mínimo de tokens que se envían a la cuenta de tokens del usuario. Este parámetro se utiliza para tener en cuenta el deslizamiento. El deslizamiento es la diferencia entre el valor de un token cuando se envía la transacción y cuando se cumple la orden. En este caso, cuanto menor sea el número, más deslizamiento puede ocurrir sin que la transacción falle. A lo largo de esta lección, usaremos 0 para intercambios, ya que calcular el deslizamiento está fuera del alcance de esta lección. Sin embargo, en una aplicación en producción, es importante permitir que los usuarios especificen la cantidad de deslizamiento con la que se sienten cómodos.

La instrucción para intercambiar el token A por el token B será así:

```JavaScript
const swapInstruction = TokenSwap.swapInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    userTokenA,
    poolTokenA,
    poolTokenB,
    userTokenB,
    poolMint,
    feeAccount,
    null,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    amount * 10 ** MintInfoTokenA.decimals,
    0
)

transaction.add(swapInstruction)
```
 
### Depositar liquidez
El Programa de Intercambio de Tokens tiene dos variaciones de instrucciones de depósito. Una permite que los usuarios solo depositen tokens en un lado de la piscina de intercambio a la vez. La otra permite que los usuarios depositen en ambos lados de la piscina de intercambio al mismo tiempo.

Para depositar liquidez en ambos lados de la piscina de intercambio, la billetera de un usuario debe tener una cantidad suficiente de cada token. Al depositar ambos tokens, en lugar de proporcionar la cantidad de cada token para depositar, el usuario especifica la cantidad de tokens LP que desearía recibir. El Programa de Intercambio de Tokens luego calcula la cantidad de cada token que recibirá un depositante dada la curva de la piscina y la liquidez actual.

Podemos depositar ambos tokens al mismo tiempo usando la función de ayuda **TokenSwap.depositAllTokenTypesInstruction** que requiere los siguientes argumentos:

1. **tokenSwap** - la cuenta de estado de intercambio de tokens
2. **authority** - la autoridad de la piscina de intercambio
3. **userTransferAuthority** - la autoridad sobre las cuentas de tokens de usuario
4. **sourceA** - cuenta de token A de usuario para transferir tokens a la cuenta de token A de la piscina de intercambio
5. **sourceB** - cuenta de token B de usuario para transferir tokens a la cuenta de token B de la piscina de intercambio
6. **intoA** - cuenta de token A de la piscina de intercambio para recibir el token A del usuario
7. **intoB** - cuenta de token B de la piscina de intercambio para recibir el token B del usuario
8. **poolToken** - la dirección de acuñación de tokens LP
9. **poolAccount** - cuenta de tokens LP del usuario a la que la piscina de intercambio acuña tokens LP
10. **swapProgramId** - la dirección del Programa de Intercambio de Tokens
11. **tokenProgramId** - la dirección del Programa de Tokens
12. **poolTokenAmount** - cantidad de tokens LP que el depositante espera recibir
13. **maximumTokenA** - cantidad máxima de token A permitida para depositar
14. **maximumTokenB** - cantidad máxima de token B permitida para depositar

Los argumentos **maximumTokenA** y **maximumTokenB** se utilizan para prevenir el deslizamiento. Cuanto mayor sea el número, más deslizamiento puede ocurrir sin un fallo de transacción. Por simplicidad, usaremos un número muy grande para estos argumentos.

La instrucción para depositar tanto el token A como el token B será así:

```JavaScript
const instruction = TokenSwap.depositAllTokenTypesInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    userTokenA,
    userTokenB,
    poolTokenA,
    poolTokenB,
    poolMint,
    userPoolToken,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    poolTokenAmount * 10 ** MintInfoPoolToken.decimals,
    100e9,
    100e9
)

transaction.add(instruction)
```

Podemos depositar tokens en solo un lado de la piscina de intercambio de una manera similar utilizando la función **TokenSwap.depositSingleTokenTypeExactAmountInInstruction** . La principal diferencia es que el último argumento en la instrucción es **minimumPoolTokenAmount** . Al depositar en solo un lado de la piscina de intercambio, el usuario especifica exactamente cuántos tokens depositar. A su vez, el Programa de Intercambio de Tokens calcula la cantidad de tokens LP para acuñar para el usuario por su depósito. Una instrucción de depósito solo de Token A se vería así:

```JavaScript
const instruction = TokenSwap.depositSingleTokenTypeExactAmountInInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    userTokenA,
    poolTokenA,
    poolMint,
    userPoolToken,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    DepositAmountTokenA * 10 ** MintInfoTokenA.decimals,
    0,
)

transaction.add(instruction)
```
 
### Retirar liquidez.
A cambio de proporcionar liquidez, los depositantes reciben tokens LP que representan su propiedad fraccional de todos los tokens A y B en el pool. En cualquier momento, los proveedores de liquidez pueden canjear sus tokens LP por tokens A y B a la tasa de intercambio "justa" actual determinada por la curva. Cuando se retira la liquidez, se transfieren los tokens A y/o B a las cuentas de tokens del usuario y se queman los tokens LP del usuario. 

El programa de intercambio de tokens tiene dos variaciones de instrucciones de retirada. Una permite a los usuarios retirar solo tokens de un lado del pool de intercambio a la vez. La otra permite retirar tokens de ambos lados del pool de intercambio al mismo tiempo. 

Podemos retirar ambos tokens al mismo tiempo usando la función de ayuda **TokenSwap.withdrawAllTokenTypesInstruction** que requiere los siguientes argumentos:

1. **tokenSwap** - la cuenta de estado de intercambio de tokens
2. **authority** - la autoridad de la piscina de intercambio
3. **userTransferAuthority** - la autoridad sobre las cuentas de tokens de usuario
3. **poolMint** - la dirección de la fábrica de tokens LP
4. **feeAccount** - la cuenta de tokens que recibe las tarifas de retiro del propietario
5. **sourcePoolAccount** - cuenta LP-token de usuario para quemar tokens LP-token de la piscina
6. **forma** - cuenta de token A de la piscina de intercambio para retirar
7. **fromB** - cuenta de token B de la piscina de intercambio para retirar
8. **userAccountA** - cuenta de token A de usuario para recibir tokens retirados de la cuenta de token A de la piscina de intercambio
9. **userAccountB** - cuenta de token B de usuario para recibir tokens retirados de la cuenta de token B de la piscina de intercambio
10. **swapProgramId** - la dirección del Programa de Intercambio de Tokens
11. **tokenProgramId** - la dirección del Programa de Tokens
12. **poolTokenAmount** - cantidad de tokens LP que el usuario espera quemar en el retiro
13. **minimumTokenA** - cantidad mínima de token A para retirar
14. **minimumTokenB** - cantidad mínima de token B para retirar 

Los argumentos **minimumTokenA** y **minimumTokenB** se utilizan para evitar el deslizamiento. Cuanto menor sea el número, mayor será posiblemente el deslizamiento. Para simplificar, utilizaremos 0 para estos argumentos.

La instrucción para depositar tanto el token A como el token B se verá así:

```JavaScript
const instruction = TokenSwap.withdrawAllTokenTypesInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    poolMint,
    feeAccount,
    userPoolToken,
    poolTokenA,
    poolTokenB,
    userTokenA,
    userTokenB,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    poolTokenAmount * 10 ** MintInfoPoolToken.decimals,
    0,
    0
)

transaction.add(instruction)
```
 
Podemos retirar tokens de solo un lado del pool de intercambio de manera similar utilizando **TokenSwap.withdrawSingleTokenTypeExactAmountOut** . La principal diferencia es que el último argumento en la instrucción es **maximumPoolTokenAmount** . Al retirar solo un lado del pool de intercambio, el usuario especifica con exactitud cuántos tokens retirar. A su vez, el Programa de Intercambio de Tokens calcula la cantidad de tokens LP que el usuario debe quemar para fabricar. Una instrucción para retirar solo el Token B se vería así:

```JavaScript
const instruction = TokenSwap.depositSingleTokenTypeExactAmountInInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    poolMint,
    feeAccount,
    poolTokenB,
    userTokenB,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    WithdrawAmountTokenB * 10 ** MintInfoTokenB.decimals,
    100e9,
)

transaction.add(instruction)
```
 
## CURVAS
Las curvas de comercio son el núcleo de cómo operan los pools de intercambio y los AMM (creadores de mercado automatizados). La curva de comercio es la función que utiliza el Programa de Intercambio de Tokens para calcular cuánto de un token de destino se proporcionará dada una cantidad de token de origen. La curva establece efectivamente el precio del mercado de los tokens en el pool.
 
El pool con el que interactuaremos en esta lección utiliza una Función de **Curva de Producto** Constante. La curva de producto constante es la conocida curva de estilo Uniswap y Balancer que preserva una invariante en todos los intercambios. Esta invariante se puede expresar como el producto de la cantidad de token A y token B en el pool de intercambio.

```JavaScript
A_total * B_total = invariant
```
  
 Si tenemos 100 tokens A y 5,000 tokens B, nuestra invariante es 500,000.

 Ahora, si un comerciante desea ingresar una cantidad específica de tokens A por una cantidad de tokens B, el cálculo se convierte en una cuestión de resolver "B_out" donde:

```JavaScript
(A_total + A_in) * (B_total - B_out) = invariant
```

Ingresando los 10 tokens A junto con nuestra invariante de medio millón, necesitaríamos resolver para "B_out" de la siguiente manera:

```JavaScript
(100 + 10) * (5,000 - B_out) = 500,000
5,000 - B_out = 500,000 / 110
5,000 - (500,000 / 110) = B_out
B_out = 454.5454...
```
 
El producto de la cantidad de token A y token B siempre debe ser igual a una constante, de ahí el nombre "Producto Constante". Se puede encontrar más información en el [whitepaper de uniswap](https://uniswap.org/whitepaper.pdf) y el [whitepaper de Balance](https://balancer.fi/whitepaper.pdf).
Si las curvas no tienen mucho sentido, ¡no te preocupes! Aunque aprender más sobre cómo funcionan no hace daño, no necesitas entender la totalidad de las matemáticas para poder implementar las curvas comunes.
 
 # Demostración 
Para esta demostración, se ha creado un pool de tokens de dos nuevos tokens y está en vivo en Devnet. ¡Vamos a construir una interfaz de usuario frontal para interactuar con este pool de intercambio! Dado que el pool ya está hecho, no tenemos que preocuparnos por iniciar el pool y financiarlo con tokens. En cambio, nos centraremos en construir las instrucciones para:
- Depositar liquidez en el pool
- Retirar su liquidez depositada
- Intercambiar de un token a otro


![2.2](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%202/images/2.2/1.png?raw=true)


## 1. Descarga el código base
Antes de empezar, descarga el [código base](https://balancer.fi/whitepaper.pdf). 

El proyecto es una aplicación Next.js bastante simple que reutiliza gran parte de lo que se construyó anteriormente para la demostración en la **lección de Programa de Tokens** . Como puedes ver en la imagen anterior, hay varias entradas de texto y botones diferentes, todos los cuales presentarán transacciones a la cadena de bloques en nombre del usuario. Nuestro enfoque en esta demostración será crear las instrucciones que los últimos tres botones presentarán.

Los botones de airdrop ya están implementados y deberían funcionar de forma automática. Utilizan un programa de airdrop que está desplegado en Devnet en la dirección **CPEV4ibq2VUv7UnNpkzUGL82VRzotbv2dy8vGwRfh3H3**. Puedes acuñar tantos tokens como desees en tu billetera para interactuar con el pool.

## 2. Crear la instrucción de depósito
De las dos variaciones de las instrucciones de depósito en el Programa de Intercambio de Tokens, utilizaremos la variación que proporciona liquidez a ambos lados del pool de intercambio a la vez: **TokenSwap.depositAllTokenTypesInstruction**.

La instrucción de depósito debe agregarse dentro del archivo **/components/Deposit.tsx** dentro de la función **handleTransactionSubmit** . Esta función se llama cuando el usuario hace clic en el botón Depositar.

Comencemos derivando tres direcciones de cuentas de tokens asociadas:

1. La cuenta de token asociada correspondiente a la dirección de billetera del usuario y Krypt Coin
2. La cuenta de token asociada correspondiente a la dirección de billetera del usuario y Scrooge Coin
3. La cuenta de token asociada correspondiente a la dirección de billetera del usuario y el token LP del pool de intercambio

Hay varias formas de hacerlo, pero utilizaremos la función de ayuda **getAssociatedTokenAddress** de la biblioteca **spl-token** .

También necesitaremos los datos asociados con la fábrica de tokens del pool para ajustar la entrada del usuario para los decimales del token del pool. Para acceder a los datos de una fábrica de tokens, utilizaremos la función de ayuda **getMint** de la biblioteca **spl-token** .

```JavaScript
const handleTransactionSubmit = async (deposit: DepositAllSchema) => {
    if (!publicKey) {
        alert('Please connect your wallet!')
        return
    }
	// these are the accounts that hold the tokens
    const kryptATA = await token.getAssociatedTokenAddress(kryptMint, publicKey)
    const scroogeATA = await token.getAssociatedTokenAddress(ScroogeCoinMint, publicKey)
	const tokenAccountPool = await token.getAssociatedTokenAddress(pool_mint, publicKey)

    // poolMintInfo holds data we've fetched for the pool token mint
    const poolMintInfo = await token.getMint(connection, poolMint)
}
```

A continuación, necesitamos verificar si la dirección de la **cuenta de tokenPool** que acabamos de derivar ha sido creada. Utilizaremos la función **getAccountInfo** de la biblioteca **@solana/web3** para obtener la información de la cuenta asociada con **tokenAccountPool** . Esta función devolverá un struct **AccountInfo** si la cuenta existe o **null** en caso contrario. Si se devuelve **null** , tendremos que crear la cuenta.

Dado que la función **handleTransactionSubmit** ya estará enviando una transacción, simplemente agregaremos la instrucción para crear una cuenta asociada a la misma transacción en lugar de enviar varias transacciones.

```JavaScript
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert('Please connect your wallet!')
        return
    }

    const kryptATA = await token.getAssociatedTokenAddress(kryptMint, publicKey)
    const scroogeATA = await token.getAssociatedTokenAddress(ScroogeCoinMint, publicKey)
    const tokenAccountPool = await token.getAssociatedTokenAddress(pool_mint, publicKey)

    const poolMintInfo = await token.getMint(connection, poolMint)

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                pool_mint
            )
        transaction.add(createATAInstruction)
    }
}
```
 
Finalmente, podemos crear la instrucción de depósito utilizando la función de ayuda **TokenSwap.depositAllTokenTypesInstruction** de la biblioteca **spl-token-swap** . Luego, agregamos la instrucción y enviamos la transacción.

```JavaScript
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Please connect your wallet!")
        return
    }

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey
    )

    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey
    )

    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey
    )

    const poolMintInfo = await token.getMint(connection, poolMint)

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                poolMint
            )
        transaction.add(createATAInstruction)
    }

    const instruction = TokenSwap.depositAllTokenTypesInstruction(
        tokenSwapStateAccount,
        swapAuthority,
        publicKey,
        kryptATA,
        scroogeATA,
        poolKryptAccount,
        poolScroogeAccount,
        poolMint,
        tokenAccountPool,
        TOKEN_SWAP_PROGRAM_ID,
        token.TOKEN_PROGRAM_ID,
        poolTokenAmount * 10 ** poolMintInfo.decimals,
        100e9,
        100e9
    )

    transaction.add(instruction)

    try {
        let txid = await sendTransaction(transaction, connection)
        alert(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
        console.log(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
    } catch (e) {
        console.log(JSON.stringify(e))
        alert(JSON.stringify(e))
    }
}
```

Con la excepción de la **clave pública** del usuario y sus cuentas de tokens asociadas derivadas (para Krypt Coin, Scrooge Coin y el token LP del pool), observe que todas las cuentas son constantes para este pool de intercambio y se definen en el archivo **const.ts** .
En este punto, ¡deberías poder airdropearte algunos tokens y luego depositarlos en el pool de intercambio!
 
 ## 3. Crear la instrucción de retirar
 
La instrucción de retirar es muy similar a la instrucción de depósito, pero hay algunas diferencias sutiles. Al igual que los depósitos, el Programa de Intercambio de Tokens acepta dos variaciones de la instrucción de retirada. Puedes retirar liquidez de un solo lado del pool de intercambio o puedes retirar tu liquidez depositada de ambos lados a la vez.

De las dos variaciones de las instrucciones de retirada en el Programa de Intercambio de Tokens, utilizaremos la variación que elimina la liquidez de ambos lados del pool de intercambio a la vez: **TokenSwap.withdrawAllTokenTypesInstruction** .
 
La instrucción de retirada debe agregarse dentro del archivo **/components/Withdraw.tsx** dentro de la función **handleTransactionSubmit** . Esta función se llama cuando el usuario hace clic en el botón Retirar.

Comencemos derivando las tres direcciones de cuentas de tokens asociadas, obteniendo los datos de la fábrica de tokens del pool y verificando la dirección de **tokenAccountPool** de la misma manera que lo hicimos para la instrucción de depósito.

```JavaScript
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert('Please connect your wallet!')
        return
    }

    const kryptATA = await token.getAssociatedTokenAddress(kryptMint, publicKey)
    const scroogeATA = await token.getAssociatedTokenAddress(ScroogeCoinMint, publicKey)
    const tokenAccountPool = await token.getAssociatedTokenAddress(pool_mint, publicKey)

    const poolMintInfo = await token.getMint(connection, poolMint)

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                pool_mint
            )
        transaction.add(createATAInstruction)
    }
}
```
 
A continuación, creamos la instrucción de retirada utilizando la función de ayuda **TokenSwap.withdrawAllTokenTypesInstruction** de la biblioteca **spl-token-swap** . Luego, agregamos la instrucción y enviamos la transacción.

```JavaScript
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Please connect your wallet!")
        return
    }

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey
    )
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey
    )
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey
    )

    const poolMintInfo = await token.getMint(connection, poolMint)

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                poolMint
            )
        transaction.add(createATAInstruction)
    }

    const instruction = TokenSwap.withdrawAllTokenTypesInstruction(
        tokenSwapStateAccount,
        swapAuthority,
        publicKey,
        poolMint,
        feeAccount,
        tokenAccountPool,
        poolKryptAccount,
        poolScroogeAccount,
        kryptATA,
        scroogeATA,
        TOKEN_SWAP_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        poolTokenAmount * 10 ** poolMintInfo.decimals,
        0,
        0
    )

    transaction.add(instruction)
    try {
        let txid = await sendTransaction(transaction, connection)
        alert(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
        console.log(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
    } catch (e) {
        console.log(JSON.stringify(e))
        alert(JSON.stringify(e))
    }
}
```

Observe que el orden de las cuentas es diferente para la transacción de retirada y hay una **cuenta de tarifa** adicional proporcionada esta vez. Esta **cuenta de tarifa** es el destino de la tarifa que debe ser pagada por el usuario para retirar liquidez de los pools. 


## 4. Crear la instrucción de intercambio

Ahora es el momento de implementar el propósito real de este programa: la instrucción de intercambio.

Tenga en cuenta que nuestra interfaz de usuario tiene un desplegable para permitir a los usuarios seleccionar el token con el que desean intercambiar, por lo que tendremos que crear nuestra instrucción de manera diferente según lo que el usuario seleccione.

Haremos esto dentro de la función **handleTransactionSubmit** del archivo **/components/Swap.tsx** . Una vez más, tendremos que derivar las **direcciones de Token Asociadas** del usuario para cada token mint (Krypt Coin, Scrooge Coin y Pool Token) y crear el **tokenAccountPool** si aún no existe. Además, obtendremos los datos tanto de Krypt Coin como de Scrooge Coin para tener en cuenta la precisión decimal de los tokens. 

```JavaScript
const handleTransactionSubmit = async () => {
    if (!publicKey) {
      alert("Please connect your wallet!")
      return
    }

    const kryptMintInfo = await token.getMint(connection, kryptMint)
    const ScroogeCoinMintInfo = await token.getMint(connection, ScroogeCoinMint)

    const kryptATA = await token.getAssociatedTokenAddress(kryptMint, publicKey)
    const scroogeATA = await token.getAssociatedTokenAddress(ScroogeCoinMint, publicKey)
    const tokenAccountPool = await token.getAssociatedTokenAddress(poolMint, publicKey)
}
```


A partir de aquí, la entrada del usuario determinará nuestra ruta de ejecución. La elección del usuario se guarda en la propiedad de acuñación, por lo que utilizaremos esto para ramificar entre cada instrucción posible.

```JavaScript
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Please connect your wallet!")
        return
    }

    const kryptMintInfo = await token.getMint(connection, kryptMint)
    const ScroogeCoinMintInfo = await token.getMint(
        connection,
        ScroogeCoinMint
    )

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey
    )
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey
    )
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey
    )

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                poolMint
            )
        transaction.add(createATAInstruction)
    }

    // check which direction to swap
    if (mint == "option1") {
        const instruction = TokenSwap.swapInstruction(
            tokenSwapStateAccount,
            swapAuthority,
            publicKey,
            kryptATA,
            poolKryptAccount,
            poolScroogeAccount,
            scroogeATA,
            poolMint,
            feeAccount,
            null,
            TOKEN_SWAP_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            amount * 10 ** kryptMintInfo.decimals,
            0
        )

        transaction.add(instruction)
    } else if (mint == "option2") {
        const instruction = TokenSwap.swapInstruction(
            tokenSwapStateAccount,
            swapAuthority,
            publicKey,
            scroogeATA,
            poolScroogeAccount,
            poolKryptAccount,
            kryptATA,
            poolMint,
            feeAccount,
            null,
            TOKEN_SWAP_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            amount * 10 ** ScroogeCoinMintInfo.decimals,
            0
        )

        transaction.add(instruction)
    }

    try {
        let txid = await sendTransaction(transaction, connection)
        alert(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
        console.log(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
    } catch (e) {
        console.log(JSON.stringify(e))
        alert(JSON.stringify(e))
    }
}
```

¡Y eso es todo! Una vez que tenga la instrucción de intercambio implementada, la interfaz de usuario debería ser completamente funcional y podrá enviar tokens por el aire, depositar liquidez, retirar su liquidez y intercambiar de un token a otro.

Por favor tómese su tiempo con este código y los conceptos en esta lección. Los grupos de intercambio pueden ser mucho más complicados de lo que hemos implementado hoy, por lo que es importante entender los conceptos básicos. Si necesita más tiempo con la demo, ¡tómese el tiempo que necesite! Y si lo desea, eche un vistazo al [código de solución aquí](https://github.com/Unboxed-Software/solana-token-swap-frontend) .

## Desafío

Ahora que hemos trabajado juntos en la demo, ¡intenta dar un paso más allá con tus propios tokens!

En la lección del [Token Program](https://soldev.app/course/token-program.md) , creaste algunos tokens. Ahora crea un grupo de intercambio para esos tokens y modifica el código de la demo de esta lección para usar tus tokens y el grupo de intercambio recién creado. No hay código de solución para esto, ya que es específico para tus tokens, así que vaya despacio y hazlo paso a paso. ¡Lo tienes!
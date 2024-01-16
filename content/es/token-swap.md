---
title: Tokens de intercambio con los objetivos del Programa de intercambio de tokens
objectives:
- Crear un grupo de intercambio de tokens
- Liquidez de depósitos
- Retirar liquidez
- Tokens de swap
---

# TL;DR

-   El **Programa de intercambio de tokens** es un contrato SPL implementado en Devnet disponible para pruebas y experimentación por parte de desarrolladores y protocolos. Para casos de uso de producción, utilice su propia implementación o una mantenida regularmente por un servicio de buena reputación.
-   El programa acepta seis diferentes**instrucciones**, todos los cuales exploraremos en esta lección.
-   Los desarrolladores pueden crear y usar **fondos de liquidez** para intercambiar entre cualquier token SPL que deseen.
-   El programa utiliza una fórmula matemática llamada "**curva** " para calcular el precio de todas las operaciones. Las curvas tienen como objetivo imitar la dinámica normal del mercado: por ejemplo, a medida que los comerciantes compran un montón de un tipo de token, el valor del otro tipo de token aumenta.

# Descripción general

## Swap Pools

Antes de entrar en cómo crear e interactuar con grupos de swap en Solana, es importante que entendamos los conceptos básicos de lo que es un grupo de swap. Un swap pool es una agregación de dos tokens diferentes con el propósito de proporcionar liquidez para facilitar el intercambio entre cada token.

Los usuarios proporcionan liquidez a estos grupos depositando sus propios tokens en cada grupo. Estos usuarios se llaman proveedores de liquidez. Cuando un proveedor de liquidez (o LP) deposita algunos tokens en el grupo de swaps, se acuñan tokens LP que representan la propiedad fraccionaria del LP en el grupo.

La mayoría de los grupos de swaps cobran una tarifa comercial por facilitar cada swap. Estos honorarios se pagan a continuación a los LP en proporción a la cantidad de liquidez que están proporcionando en el grupo. Esto proporciona un incentivo para que los LP proporcionen liquidez al grupo.

Cuando un LP está listo para retirar su liquidez depositada, sus tokens LP se queman y los tokens del grupo (proporcional a la cantidad de tokens LP quemados) se envían a su billetera.

El propósito de los grupos de swaps es facilitar el comercio descentralizado entre los usuarios. En las finanzas tradicionales, los usuarios ejecutan operaciones como esta a través de un intercambio centralizado en un límite central[order book](https://www.investopedia.com/terms/o/order-book.asp). En general, esto requiere un intermediario de confianza de terceros.

Sin embargo, debido a la naturaleza descentralizada de la criptomoneda, ahora tenemos una nueva forma de facilitar las operaciones. Se han construido muchos protocolos de intercambio descentralizados para aprovechar esto. [Project Serum](https://www.projectserum.com/) es un ejemplo de un libro de órdenes de límite central descentralizado construido en Solana.

Dado que los grupos de swap están completamente descentralizados, cualquiera puede emitir instrucciones al programa de swap para crear un nuevo grupo de swap entre los tokens SPL que desee. Este es un impulso masivo más allá de las finanzas tradicionales. Los grupos de swaps y los creadores de mercado automatizados (AMM) son uno de los temas más fascinantes y complejos de DeFi. Los detalles esenciales de cómo funcionan están fuera del alcance de esta lección, pero hay un montón de material disponible para usted si está interesado en aprender más. Por ejemplo, el Programa de intercambio de tokens de Solana se inspiró en gran medida en [Uniswap](https://uniswap.org/) y[Balancer](https://balancer.fi/), cada uno de los cuales proporciona una excelente documentación que puede leer.

## Programa de intercambio de tokens y `@solana/spl-token-swap`

A diferencia del Programa de tokens, no hay una implementación mantenida por Solana del Programa de intercambio de tokens. Más bien, Solana proporciona [código fuente](https://github.com/solana-labs/solana-program-library/tree/master/token-swap/program) el Programa de intercambio de tokens como una implementación de referencia que puede bifurcar e implementar usted mismo. También puede usar un programa de intercambio de tokens mantenido por una organización de terceros en la que confíe. A lo largo de esta lección, usaremos la implementación mantenida por Serum en address `SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8`.

Solana también mantiene la biblioteca `@solana/spl-token-swap` JS. Esta biblioteca proporciona funciones auxiliares para interactuar con un programa de intercambio de tokens. Cada función de ayuda toma un argumento que representa un ID de programa de intercambio de fichas. Siempre que el programa que utilice acepte las instrucciones de Token Swap, puede utilizar la `@solana/spl-token-swap` biblioteca con él.

## Crear un grupo de swaps

La creación de grupos de intercambio con el Programa de intercambio de tokens SPL realmente muestra la cuenta, las instrucciones y los modelos de autorización en Solana. Esta lección combinará y se basará en mucho de lo que hemos aprendido hasta ahora en el curso. Para las operaciones específicas del Programa de intercambio de tokens, usaremos la `@solana/spl-token-swap` biblioteca.

Mientras hablamos sobre la creación de un grupo de swap, asumiremos que estamos creando un grupo de swap para dos tokens llamados Token A y Token B. Crear el grupo de swap con la `spl-token-swap` biblioteca es tan simple como enviar una transacción con una instrucción creada con la `TokenSwap.createInitSwapInstruction` función. Sin embargo, hay una serie de cuentas que necesita crear o derivar de antemano que serán necesarias al crear esa instrucción:

1. **Cuenta de estado de intercambio de tokens** - contiene información sobre el grupo de swaps
2. **Autoridad del fondo de swaps** - el PDA utilizado para firmar transacciones en nombre del programa de swap
3. **Cuentas de tokens para Token A y Token B** - cuentas de tokens que contendrán tokens A y B para el grupo
4. **Piscina token Mint** - la ceca para el token LP del swap pool
5. **Cuenta de token de grupo** - la cuenta de token para la acuñación inicial de la moneda de token del grupo cuando se crea la cuenta de intercambio
6. **Cuenta de comisión de token de fondo común** - la cuenta a la que se le pagan las comisiones de negociación del swap pool

### Cuenta de Estado de Token Swap

Antes de que pueda crear un grupo de intercambio, deberá crear una cuenta de estado de intercambio de tokens. Esta cuenta se utilizará para almacenar información sobre el grupo de swaps en sí.

Para crear la cuenta de estado de intercambio de tokens, utilice la `SystemProgram` instrucción `createAccount`.

```tsx
import * as web3 from "@solana/web3";
import {
    TokenSwap,
    TOKEN_SWAP_PROGRAM_ID,
    TokenSwapLayout,
} from "@solana/spl-token-swap";

const transaction = new Web3.Transaction();
const tokenSwapStateAccount = Web3.Keypair.generate();
const rent = TokenSwap.getMinBalanceRentForExemptTokenSwap(connection);
const tokenSwapStateAccountInstruction = await Web3.SystemProgram.createAccount(
    {
        newAccountPubkey: tokenSwapStateAccount.publicKey,
        fromPubkey: wallet.publicKey,
        lamports: rent,
        space: TokenSwapLayout.span,
        programId: TOKEN_SWAP_PROGRAM_ID,
    },
);
transaction.add(tokenSwapStateAccountInstruction);
```

Algunos elementos a tener en cuenta de este ejemplo:

1. Puede obtener la cantidad de lámparas requeridas para la exención `TokenSwap.getMinBalanceRentForExemptTokenSwap` de alquiler utilizando la `spl-token-swap` biblioteca.
2. Del mismo modo, puede utilizar `TokenSwapLayout.span` para el espacio requerido en la cuenta.
3. `programId` debe establecerse en `TOKEN_SWAP_PROGRAM_ID`. Esto establece que el propietario de la nueva cuenta sea el propio Programa de intercambio de tokens. El Programa de intercambio de tokens deberá escribir datos en la nueva cuenta y, por lo tanto, debe establecerse como propietario.

### Autoridad de Swap Pool

La autoridad del grupo de swaps es la cuenta utilizada para firmar transacciones en nombre del programa de swaps. Esta cuenta es una dirección derivada del programa (PDA) derivada del programa de intercambio de tokens y la cuenta de estado de intercambio de tokens.

Los PDA solo pueden ser creados por su propio programa, por lo que no es necesario crear esta cuenta directamente. Sin embargo, usted necesita saber su clave pública. Puedes descubrirlo usando la `PublicKey.findProgramAddress` función de la `@solana/web3` biblioteca.

```tsx
const [swapAuthority, bump] = await Web3.PublicKey.findProgramAddress(
    [tokenSwapStateAccount.publicKey.toBuffer()],
    TOKEN_SWAP_PROGRAM_ID,
);
```

La clave pública resultante se utilizará como autoridad en varias de las cuentas que siguen.

### Cuentas de tokens para Token A y Token B

Las cuentas Token A y Token B son cuentas Token asociadas utilizadas para el grupo de swaps real. Estas cuentas deben contener algún número de tokens A/B respectivamente y la autoridad de swap PDA debe estar marcada como propietaria de cada una para que el Programa de Token Swap pueda firmar transacciones y transferir tokens de cada cuenta.

```tsx
let tokenAAccountAddress = await token.getAssociatedTokenAddress(
    tokenAMint, // mint
    swapAuthority, // owner
    true, // allow owner off curve
);

const tokenAAccountInstruction =
    await token.createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        tokenAAccountAddress, // ata
        swapAuthority, // owner
        tokenAMint, // mint
    );

transaction.add(tokenAAccountInstruction);
```

Si necesita un repaso sobre la creación de cuentas de token, eche un vistazo a la[Lección del programa de fichas](./token-program).

### Piscina Token Mint

La casa de la moneda de la piscina es la ceca de los tokens LP que representan la propiedad de un LP en la piscina. Creas esta menta de la forma en que aprendiste en el[Lección del programa de fichas](./token-program). Para que el grupo de swaps funcione, la autoridad de Mint debe ser la cuenta de la autoridad de swaps.

```tsx
const poolTokenMint = await token.createMint(
    connection,
    wallet,
    swapAuthority,
    null,
    2,
);
```

### Cuenta de token de fondo común

La cuenta de token de grupo es la cuenta a la que se acuñan los tokens iniciales del grupo de liquidez cuando se crea por primera vez la cuenta de swap. La acuñación posterior de tokens LP se acuñará directamente en la cuenta del usuario añadiendo liquidez al pool. Los tokens del grupo de liquidez representan la propiedad de la liquidez depositada en el grupo.

```tsx
const tokenAccountPool = Web3.Keypair.generate();
const rent = await token.getMinimumBalanceForRentExemptAccount(connection);
const createTokenAccountPoolInstruction = Web3.SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: tokenAccountPool.publicKey,
    space: token.ACCOUNT_SIZE,
    lamports: rent,
    programId: token.TOKEN_PROGRAM_ID,
});
const initializeTokenAccountPoolInstruction =
    token.createInitializeAccountInstruction(
        tokenAccountPool.publicKey,
        poolTokenMint,
        wallet.publicKey,
    );

transaction.add(createTokenAccountPoolInstruction);
transaction.add(initializeTokenAccountPoolInstruction);
```

### Cuenta de comisión de token de fondo común

La cuenta de comisión de token de fondo es la cuenta de token a la que se pagan las comisiones por los intercambios de token. Para la implementación de Serum del Programa de intercambio de tokens que estamos utilizando, esta cuenta debe ser propiedad de una cuenta específica definida en el programa de intercambio[HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN](https://explorer.solana.com/address/HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN?cluster=devnet) :

```tsx
const feeOwner = new web3.PublicKey(
    "HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN",
);

let tokenFeeAccountAddress = await token.getAssociatedTokenAddress(
    poolTokenMint, // mint
    feeOwner, // owner
    true, // allow owner off curve
);

const tokenFeeAccountInstruction =
    await token.createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        tokenFeeAccountAddress, // ata
        feeOwner, // owner
        poolTokenMint, // mint
    );

transaction.add(tokenFeeAccountInstruction);
```

### Crear el grupo de swaps

Con todas las cuentas de requisitos previos creadas, puede crear la instrucción de inicialización del grupo `TokenSwap.createInitSwapInstruction` de intercambio utilizando la `spl-token-swap` biblioteca.

Esta función se basa _mucho_ en argumentos. Hablemos de ellos.

Los primeros 7 argumentos son las cuentas de token de requisito previo que acabamos de discutir.

Después de eso viene la constante que representa el ID de Programa de Token seguido por la constante que representa el ID de Programa de Intercambio de Token.

A continuación, hay 4 pares de argumentos numéricos que representan numeradores y denominadores para la tarifa comercial, la tarifa comercial del propietario, la tarifa de retiro del propietario y la tarifa del anfitrión. La instrucción utiliza el numerador y el denominador para cada uno para calcular el porcentaje de la tarifa. Vamos a explicar cada una de las tarifas:

1. **Tarifa comercial** - comisiones que son retenidas por las cuentas de tokens de swap pool durante una operación y aumentan el valor canjeable de los tokens LP. Esta tarifa recompensa a los usuarios por proporcionar liquidez al grupo de swaps.
2. **Tarifa comercial del propietario** - honorarios que son retenidos por las cuentas de tokens de swap pool durante una operación, con el equivalente en tokens LP acuñados para el propietario del programa
3. **Tarifa de retiro del propietario** - tokens LP adicionales que se envían al propietario en cada retiro
4. **Tarifa del anfitrión** - una proporción de las tarifas comerciales del propietario, enviadas a una cuenta de token de host adicional proporcionada durante la operación. Esta tarifa incentiva a las partes externas (como un intercambio descentralizado) a proporcionar frontends para el grupo de swaps y los recompensa con una porción.

Al utilizar un programa de intercambio implementado y mantenido por un tercero, estas tarifas pueden o no ser fijas de modo que usted _debe_ ingrese los argumentos correctos. Deberá verificar la implementación del programa de respaldo.

Por último, está el tipo de curva, que discutiremos más adelante en la lección.

```tsx
const createSwapInstruction = TokenSwap.createInitSwapInstruction(
    tokenSwapStateAccount, // Token swap state account
    swapAuthority, // Swap pool authority
    poolTokenA, // Token A token account
    poolTokenB, // Token B token account
    poolTokenMint, // Swap pool token mint
    tokenFeeAccountAddress, // Token fee account
    tokenAccountPool.publicKey, // Swap pool token account
    token.TOKEN_PROGRAM_ID, // Token Program ID
    TOKEN_SWAP_PROGRAM_ID, // Token Swap Program ID
    0, // Trade fee numerator
    10000, // Trade fee denominator
    5, // Owner trade fee numerator
    10000, // Owner trade fee denominator
    0, // Owner withdraw fee numerator
    0, // Owner withdraw fee denominator
    20, // Host fee numerator
    100, // Host fee denominator
    CurveType.ConstantProduct, // Curve type
);

transaction.add(createSwapInstruction);
```

Cuando una transacción con estas instrucciones se ejecuta con éxito, el grupo de swaps se crea y está listo para ser utilizado.

## Interactuar con Swap Pools

Una vez que se inicializa el grupo de intercambio, el Programa de intercambio de tokens tiene algunas instrucciones diferentes para usar un grupo de intercambio. Estos incluyen:

1. Ejecutar un swap
2. Depósito de liquidez
3. Retirar liquidez

### Ejecutar un swap

Los usuarios pueden comenzar a operar inmediatamente en un grupo de swaps utilizando las instrucciones de swap. La instrucción de intercambio transfiere fondos de la cuenta de token de un usuario a la cuenta de token del grupo de intercambio. A continuación, el grupo de intercambio envía tokens LP a la cuenta de tokens LP del usuario.

Dado que los programas de Solana requieren que todas las cuentas se declaren en la instrucción, los usuarios deben recopilar toda la información de la cuenta del estado de intercambio de tokens: las cuentas de tokens A y B, la cuenta de tokens Mint y la cuenta de tarifas.

Intercambiamos tokens utilizando la función `TokenSwap.swapInstruction` Helper que requiere los siguientes argumentos:

1.  `tokenSwap` - la cuenta de estado de intercambio de tokens
2.  `authority` - la autoridad del fondo de permutas financieras
3.  `userTransferAuthority` - el delegado sobre la cuenta de token de usuario
4.  `userSource` - cuenta de token de usuario para transferir tokens al swap
5.  `poolSource` - cuenta de token de swap pool para recibir tokens transferidos del usuario
6.  `poolDestination` - cuenta de token de swap pool para enviar tokens al usuario
7.  `userDestination` - cuenta de token de usuario para recibir tokens enviados desde el grupo de swap
8.  `poolMint` - la dirección de la casa de la moneda LP-token
9.  `feeAccount` - la cuenta de token que recibe las tarifas comerciales del propietario
10. `hostFeeAccount` - la cuenta de token que recibe las tarifas comerciales del host (parámetro opcional), establecida en null si no se proporciona ninguna
11. `swapProgramId` - la dirección del Programa de intercambio de tokens
12. `tokenProgramId` - la dirección del Programa Token
13. `amountIn` - cantidad de tokens que el usuario desea transferir al grupo de swap
14. `minimumAmountOut` - cantidad mínima de tokens enviados a la cuenta de token de usuario. Este parámetro se utiliza para tener en cuenta el deslizamiento. El deslizamiento es la diferencia entre el valor de un token cuando envía la transacción y cuando se cumple el pedido. En este caso, cuanto menor sea el número, más deslizamiento puede ocurrir sin que falle la transacción. A lo largo de esta lección usaremos 0 para los swaps, ya que el cálculo del deslizamiento está fuera del alcance de esta lección. Sin embargo, en una aplicación de producción, es importante permitir que los usuarios especifiquen la cantidad de deslizamiento con la que se sienten cómodos.

La instrucción para intercambiar el token A por el token B se verá así:

```tsx
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
    0,
);

transaction.add(swapInstruction);
```

### Liquidez de depósitos

El Programa de intercambio de tokens tiene dos variaciones de instrucciones de depósito. Uno permite a los usuarios depositar tokens solo en un lado del grupo de swaps a la vez. El otro permite a los usuarios depositar a ambos lados del fondo de swap al mismo tiempo.

Para depositar liquidez en ambos lados del grupo de swaps, la billetera de un usuario debe tener una cantidad suficiente de cada token. Al depositar ambos tokens, en lugar de proporcionar la cantidad de cada token a depositar, el usuario especifica la cantidad de tokens LP que le gustaría recibir. El Programa de intercambio de tokens luego calcula la cantidad de cada token que un depositante recibirá dada la curva del grupo y la liquidez actual.

Podemos depositar ambas fichas al mismo tiempo utilizando la función `TokenSwap.depositAllTokenTypesInstruction` Helper que requiere los siguientes argumentos:

1.  `tokenSwap` - la cuenta de estado de intercambio de tokens
2.  `authority` - la autoridad del fondo de permutas financieras
3.  `userTransferAuthority` - la autoridad sobre las cuentas de token de usuario
4.  `sourceA` - token de usuario Una cuenta para transferir tokens en el token de swap pool Una cuenta
5.  `sourceB` - Cuenta de token de usuario B para transferir tokens a la cuenta de token de swap pool B
6.  `intoA` - cuenta A de token de swap pool para recibir el token A del usuario
7.  `intoB` - cuenta B de token de swap pool para recibir el token B del usuario
8.  `poolToken` - la dirección de la casa de la moneda LP-token
9.  `poolAccount` - cuenta de usuario LP-token el swap pool acuña LP-token a
10. `swapProgramId` - la dirección del Programa de intercambio de tokens
11. `tokenProgramId` - la dirección del Programa Token
12. `poolTokenAmount` - cantidad de LP-token que el depositante espera recibir
13. `maximumTokenA` - cantidad máxima de token A permitida para depositar
14. `maximumTokenB` - cantidad máxima de token A permitida para depositar

Los `maximumTokenB` argumentos `maximumTokenA` y se utilizan para evitar el deslizamiento. Cuanto mayor sea el número, más deslizamiento puede ocurrir sin un fallo de transacción. Para simplificar, usaremos un número muy grande para estos argumentos.

La instrucción para depositar tanto el token A como el token B se verá así:

```tsx
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
    100e9,
);

transaction.add(instruction);
```

Podemos depositar tokens en un solo lado del grupo de swaps de manera similar utilizando el `TokenSwap.depositSingleTokenTypeExactAmountInInstruction`. La principal diferencia es que el último argumento en la instrucción es `minimumPoolTokenAmount`. Al depositar en un solo lado del grupo de swaps, el usuario especifica exactamente cuántos tokens depositar. A su vez, el Programa de intercambio de tokens calcula la cantidad de tokens LP para acuñar al usuario para su depósito. Una instrucción que deposite solo Token A se verá así:

```tsx
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
);

transaction.add(instruction);
```

### Retirar liquidez

A cambio de proporcionar liquidez, los depositantes reciben tokens LP que representan su propiedad fraccionaria de todos los tokens A y B en el grupo. En cualquier momento, los proveedores de liquidez pueden canjear su LP-token a cambio de tokens A y B al tipo de cambio "justo" actual según lo determine la curva. Cuando se retira la liquidez, los tokens A y/o B se transfieren a las cuentas de tokens del usuario y se queman los tokens LP del usuario.

El Programa de intercambio de tokens tiene dos variaciones de instrucciones de retiro. Uno permite a los usuarios retirar solo tokens de un lado del grupo de intercambio a la vez. El otro permite retiros de ambos lados del fondo de swap al mismo tiempo.

Podemos retirar ambas fichas al mismo tiempo utilizando la función de `TokenSwap.withdrawAllTokenTypesInstruction` ayuda que requiere los siguientes argumentos:

1.  `tokenSwap` - la cuenta de estado de intercambio de tokens
2.  `authority` - la autoridad del fondo de permutas financieras
3.  `userTransferAuthority` - la autoridad sobre las cuentas de token de usuario
4.  `poolMint` - la dirección de la casa de la moneda LP-token
5.  `feeAccount` - la cuenta de token que recibe las tarifas de retiro del propietario
6.  `sourcePoolAccount` - cuenta de usuario LP-token para quemar tokens de grupo LP-token desde
7.  `fromA` - swap pool token Una cuenta para retirar
8.  `fromB` - cuenta de token de swap pool B para retirar
9.  `userAccountA` - token de usuario Una cuenta para recibir tokens retirados del token de swap pool Una cuenta
10. `userAccountB` - Cuenta de token de usuario B para recibir tokens retirados de la cuenta de token de swap pool B
11. `swapProgramId` - la dirección del Programa de intercambio de tokens
12. `tokenProgramId` - la dirección del Programa Token
13. `poolTokenAmount` - cantidad de tokens LP que el usuario espera quemar al retirar
14. `minimumTokenA` - cantidad mínima de token A para retirar
15. `minimumTokenB` - cantidad mínima de token B para retirar

Los `minimumTokenB` argumentos `minimumTokenA` y se utilizan para evitar el deslizamiento. Cuanto menor sea el número, más deslizamiento puede ocurrir. Para simplificar, usaremos 0 para estos argumentos.

La instrucción para depositar tanto el token A como el token B se verá así:

```tsx
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
    0,
);

transaction.add(instruction);
```

Podemos retirar fichas de un solo lado del grupo de swaps de una manera similar utilizando el `TokenSwap.withdrawSingleTokenTypeExactAmountOut`. La principal diferencia es que el último argumento en la instrucción es `maximumPoolTokenAmount`. Al retirar solo un lado del grupo de intercambio, el usuario especifica exactamente cuántos tokens retirar. A su vez, el Programa de intercambio de tokens calcula la cantidad de tokens LP para acuñar que el usuario debe quemar. Una instrucción que retire solo el Token B se verá así:

```tsx
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
);

transaction.add(instruction);
```

## Curvas

Las curvas de negociación son el núcleo de cómo operan los grupos de swap y los AMM (creadores de mercado automatizados). La curva de negociación es la función que utiliza el Programa de intercambio de tokens para calcular cuánto de un token de destino se proporcionará dada una cantidad de token de origen. La curva establece efectivamente el precio de mercado de los tokens en el grupo.

La piscina con la que interactuaremos en esta lección emplea una función [Producto constante](https://spl.solana.com/token-swap#curves) de curva. La curva de producto constante es la conocida curva de estilo Uniswap y Balancer que conserva una invariante en todos los swaps. Esta invariante se puede expresar como el producto de la cantidad de token A y token B en el swap pool.

```tsx
A_total * B_total = invariant
```

Si tenemos 100 fichas A y 5.000 fichas B, nuestra invariante es 500.000.

Ahora, si un comerciante desea poner una cantidad específica de token A para una cierta cantidad de token B, el cálculo se convierte en una cuestión de resolver "B_out" donde:

```tsx
(A_total + A_in) * (B_total - B_out) = invariant
```

Poniendo en el token 10 A junto con nuestro invariante de medio millón, tendríamos que resolver para "B_out" así:

```tsx
(100 + 10) * (5,000 - B_out) = 500,000
5,000 - B_out = 500,000 / 110
5,000 - (500,000 / 110) = B_out
B_out = 454.5454...
```

El producto de la cantidad de token A y token B siempre debe ser igual a una constante, de ahí el nombre ‘Producto constante’. Se puede encontrar más información sobre el [Documento técnico de Uniswap](https://uniswap.org/whitepaper.pdf) y el[Libro blanco del equilibrador](https://balancer.fi/whitepaper.pdf).

Si las curvas no tienen mucho sentido, ¡no te preocupes! Si bien aprender más sobre cómo funcionan no duele, no es necesario comprender la totalidad de las matemáticas para poder implementar las curvas comunes.

# Demostración

Para esta demostración, se ha creado un grupo de tokens de dos tokens nuevos y está disponible en Devnet. ¡Vamos a caminar a través de la construcción de una interfaz de usuario frontend para interactuar con este grupo de intercambio! Dado que el pool ya está hecho, no tenemos que preocuparnos por iniciar el pool y financiarlo con tokens. En su lugar, nos centraremos en desarrollar las instrucciones para

-   depósito de liquidez en el fondo común
-   retirar su liquidez depositada
-   intercambio de un token a otro

![Captura de pantalla de la demo de Token Swap](../../assets/token-swap-frontend.png)

### 1. Descarga el código de inicio

Antes de comenzar, siga adelante y descargue el[código de inicio](https://github.com/Unboxed-Software/solana-token-swap-frontend/tree/starter).

El proyecto es una aplicación Next.js bastante simple que reutiliza gran parte de lo que se construyó anteriormente para la demostración en el[Lección del programa de fichas](./token-program). Como puede ver en la imagen de arriba, hay algunas entradas de texto y botones diferentes, todos los cuales enviarán transacciones a la cadena de bloques en nombre del usuario. Nuestro enfoque en esta demostración será crear las instrucciones que enviarán los últimos tres botones.

Los botones de lanzamiento aéreo ya están implementados y deberían funcionar de inmediato. Utilizan un programa de lanzamiento aéreo que se implementa en Devnet en la dirección[CPEV4ibq2VUv7UnNpkzUGL82VRzotbv2dy8vGwRfh3H3](https://explorer.solana.com/address/CPEV4ibq2VUv7UnNpkzUGL82VRzotbv2dy8vGwRfh3H3?cluster=devnet). Puede acuñar tantos tokens como desee en su billetera para interactuar con el grupo.

### 2. Crear la instrucción de depósito

De las dos variaciones de las instrucciones de depósito en el Programa de intercambio de tokens, utilizaremos la variación que proporciona liquidez a ambos lados del grupo de swaps a la vez `TokenSwap.depositAllTokenTypesInstruction` :

La instrucción de depósito debe añadirse dentro del `/components/Deposit.tsx` archivo dentro de la `handleTransactionSubmit` función. Esta función se llama cuando el usuario hace clic en el botón Depositar.

Comenzaremos derivando tres direcciones de cuenta de token asociadas:

1. La cuenta de token asociada correspondiente a la dirección de la billetera del usuario y Krypt Coin
2. La cuenta de token asociada correspondiente a la dirección de la billetera del usuario y Scrooge Coin
3. La cuenta de token asociada correspondiente a la dirección de la billetera del usuario y el token de swap pools LP

Hay varias maneras de hacer esto, pero usaremos la función de ayuda `getAssociatedTokenAddress` de la `spl-token` biblioteca.

También necesitaremos los datos asociados con el token de piscina Mint para ajustar la entrada del usuario para los decimales del token de piscina. Para acceder a los datos de un token Mint, usaremos la función `getMint` de ayuda de la `spl-token` biblioteca.

```tsx
const handleTransactionSubmit = async (deposit: DepositAllSchema) => {
    if (!publicKey) {
        alert("Please connect your wallet!");
        return;
    }
    // these are the accounts that hold the tokens
    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey,
    );
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey,
    );
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        pool_mint,
        publicKey,
    );

    // poolMintInfo holds data we've fetched for the pool token mint
    const poolMintInfo = await token.getMint(connection, poolMint);
};
```

A continuación, tenemos que comprobar si la `tokenAccountPool` dirección que acabamos de derivar se ha creado. Utilizaremos la `getAccountInfo` función de la `@solana/web3` biblioteca para obtener la información de la cuenta asociada con `tokenAccountPool`. Esta función devolverá una `AccountInfo` estructura si la cuenta existe `null` o no. Si `null` se devuelve, tendremos que crear la cuenta.

Dado que la `handleTransactionSubmit` función ya va a enviar una transacción, simplemente agregaremos la instrucción para crear una cuenta asociada a la misma transacción en lugar de enviar varias transacciones.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Please connect your wallet!");
        return;
    }

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey,
    );
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey,
    );
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        pool_mint,
        publicKey,
    );

    const poolMintInfo = await token.getMint(connection, poolMint);

    const transaction = new Web3.Transaction();

    let account = await connection.getAccountInfo(tokenAccountPool);

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                pool_mint,
            );
        transaction.add(createATAInstruction);
    }
};
```

Finalmente, podemos crear la instrucción de depósito utilizando la función de `TokenSwap.depositAllTokenTypesInstruction` ayuda de la `spl-token-swap` biblioteca. Luego añadimos la instrucción y enviamos la transacción.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Please connect your wallet!");
        return;
    }

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey,
    );

    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey,
    );

    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey,
    );

    const poolMintInfo = await token.getMint(connection, poolMint);

    const transaction = new Web3.Transaction();

    let account = await connection.getAccountInfo(tokenAccountPool);

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                poolMint,
            );
        transaction.add(createATAInstruction);
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
        100e9,
    );

    transaction.add(instruction);

    try {
        let txid = await sendTransaction(transaction, connection);
        alert(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`,
        );
        console.log(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`,
        );
    } catch (e) {
        console.log(JSON.stringify(e));
        alert(JSON.stringify(e));
    }
};
```

Con la excepción de las cuentas de token del usuario `publickey` y sus cuentas de token asociadas derivadas (para Krypt Coin, Scrooge Coin y el token LP del grupo), tenga en cuenta que todas las cuentas son constantes para este grupo de intercambio y se definen en el `const.ts` archivo.

En este punto, ¡deberías poder lanzarte algunos tokens y luego depositarlos en el grupo de intercambio!

### 3. Crear la instrucción de retirada

La instrucción de retiro es muy similar a la instrucción de depósito, pero hay algunas diferencias sutiles. Al igual que los depósitos, el Programa de intercambio de tokens acepta dos variaciones de la instrucción de retiro. Puede retirar liquidez de un solo lado del grupo de swaps, o puede retirar su liquidez depositada de ambos lados al mismo tiempo.

De las dos variaciones de las instrucciones de retiro en el Programa de intercambio de tokens, usaremos la variación que elimina la liquidez de ambos lados del grupo de swaps a la vez `TokenSwap.withdrawAllTokenTypesInstruction` :

La instrucción de retirada debe añadirse dentro del `/components/Withdraw.tsx` archivo dentro de la `handleTransactionSubmit` función. Esta función se llama cuando el usuario hace clic en el botón Retirar.

Comenzaremos derivando las tres direcciones de cuenta de token asociadas, recuperando los datos de la moneda de token del grupo y verificando la `tokenAccountPool` dirección de la misma manera que lo hicimos para la instrucción de depósito.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Please connect your wallet!");
        return;
    }

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey,
    );
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey,
    );
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        pool_mint,
        publicKey,
    );

    const poolMintInfo = await token.getMint(connection, poolMint);

    const transaction = new Web3.Transaction();

    let account = await connection.getAccountInfo(tokenAccountPool);

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                pool_mint,
            );
        transaction.add(createATAInstruction);
    }
};
```

A continuación, creamos la instrucción de retirada utilizando la función de `TokenSwap.withdrawAllTokenTypesInstruction` ayuda de la `spl-token-swap` biblioteca. Luego añadimos la instrucción y enviamos la transacción.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Please connect your wallet!");
        return;
    }

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey,
    );
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey,
    );
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey,
    );

    const poolMintInfo = await token.getMint(connection, poolMint);

    const transaction = new Web3.Transaction();

    let account = await connection.getAccountInfo(tokenAccountPool);

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                poolMint,
            );
        transaction.add(createATAInstruction);
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
        0,
    );

    transaction.add(instruction);
    try {
        let txid = await sendTransaction(transaction, connection);
        alert(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`,
        );
        console.log(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`,
        );
    } catch (e) {
        console.log(JSON.stringify(e));
        alert(JSON.stringify(e));
    }
};
```

Tenga en cuenta que el pedido de cuentas es diferente para la transacción de retiro y esta vez se `feeAccount` proporciona un tiempo adicional. Este `feeAccount` es el destino de la tarifa que debe pagar el usuario por retirar liquidez de las piscinas.

### 4. Crear la instrucción de intercambio

Ahora es el momento de implementar el propósito real de este programa: ¡la instrucción de intercambio!

Tenga en cuenta que nuestra interfaz de usuario tiene un menú desplegable para permitir a los usuarios seleccionar qué token les gustaría intercambiar*desde*, por lo que tendremos que crear nuestra instrucción de manera diferente en función de lo que seleccione el usuario.

Lo haremos dentro de la `handleTransactionSubmit` función del `/components/Swap.tsx` archivo. Una vez más, tendremos que derivar las del usuario `Associated Token Addresses` para cada token Mint (Krypt Coin, Scrooge Coin y Pool Token) y crear el `tokenAccountPool` si aún no existe. Además, buscaremos los datos tanto de Krypt Coin como de Scrooge Coin para dar cuenta de la precisión decimal de los tokens.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Please connect your wallet!");
        return;
    }

    const kryptMintInfo = await token.getMint(connection, kryptMint);
    const ScroogeCoinMintInfo = await token.getMint(
        connection,
        ScroogeCoinMint,
    );

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey,
    );
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey,
    );
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey,
    );
};
```

A partir de aquí, la entrada del usuario determinará nuestra ruta de ejecución. La elección del usuario se guarda en la `mint` propiedad, por lo que usaremos esto para ramificar entre cada instrucción posible.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Please connect your wallet!");
        return;
    }

    const kryptMintInfo = await token.getMint(connection, kryptMint);
    const ScroogeCoinMintInfo = await token.getMint(
        connection,
        ScroogeCoinMint,
    );

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey,
    );
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey,
    );
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey,
    );

    const transaction = new Web3.Transaction();

    let account = await connection.getAccountInfo(tokenAccountPool);

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                poolMint,
            );
        transaction.add(createATAInstruction);
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
            0,
        );

        transaction.add(instruction);
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
            0,
        );

        transaction.add(instruction);
    }

    try {
        let txid = await sendTransaction(transaction, connection);
        alert(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`,
        );
        console.log(
            `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`,
        );
    } catch (e) {
        console.log(JSON.stringify(e));
        alert(JSON.stringify(e));
    }
};
```

¡Y eso es todo! Una vez que haya implementado la instrucción de intercambio, la interfaz de usuario debe ser completamente funcional y puede lanzarse por aire tokens, depositar liquidez, retirar su liquidez e intercambiar de token a token.

Tómese su tiempo con este código y los conceptos de esta lección. Los grupos de swaps pueden ser mucho más complicados que el que hemos implementado hoy, por lo que es importante comprender los conceptos básicos. Si necesitas más tiempo con la demo, ¡tómala! Y si lo necesitas, echa un vistazo a la[código de solución aquí](https://github.com/Unboxed-Software/solana-token-swap-frontend).

# Desafío

Ahora que hemos trabajado juntos en la demostración, ¡intenta dar un paso más con tus propios tokens!

En el [Lección del programa de fichas](./token-program) has creado algunas fichas. Ahora haga un grupo de intercambio para esos tokens y modifique el código de la demostración de esta lección para usar sus tokens y el grupo de intercambio recién creado. No hay código de solución para esto, ya que es específico para sus tokens, así que vaya despacio y dé un paso a la vez. ¡Tienes esto!

# Introduccion al desarrollo de anchor del lado del cliente

## Objetivos de la lección

_Al final de esta lección, podrás:_

- Utilizar un IDL para interactuar con un programa de Solana desde el cliente
- Explicar un objeto **Provider** de anclaje
- Explicar un objeto **Program** de anclaje
- Utilizar el **MethodsBuilder** de Anchor para construir instrucciones y transacciones
- Utilizar Anchor para recuperar cuentas
- Configurar una interfaz frontal para invocar instrucciones utilizando Anchor y un IDL

# Terminología

- Anchor's **IDL** es un archivo que representa la estructura de un programa de Solana. Los programas escritos y construidos utilizando Anchor generan automáticamente un IDL correspondiente. IDL significa Lenguaje de Descripción de Interfaz.
- **@project-serum/anchor** es un cliente de Typescript que incluye todo lo necesario para interactuar con programas de Anchor.
- Un objeto **Provider** de _anchor_ combina una **connection** a un clúster y una **wallet** específica para habilitar la firma de transacciones.
- Un objeto **Anchor Program** proporciona una API personalizada para interactuar con un **Program** específico. Crea una instancia de Programa utilizando el IDL y el **Provider** de un programa.
- El **MethodsBuilder** de Anchor proporciona una interfaz simple a través del **Program** para construir instrucciones y transacciones.

# Resumen

Anchor simplifica el proceso de interactuar con programas de Solana desde el cliente proporcionando un archivo de Lenguaje de Descripción de Interfaz (IDL) que refleja la estructura de un programa. Utilizando el IDL en conjunto con la biblioteca de Typescript de Anchor (**@project-serum/anchor** ) proporciona un formato simplificado para construir instrucciones y transacciones."

```Rust
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

Esto funciona desde cualquier cliente de Typescript, ya sea una interfaz frontal o pruebas de integración. En esta lección, veremos cómo utilizar **@project-serum/anchor** para simplificar la interacción del programa del lado del cliente

## Estructura del lado del cliente de Anchor

Empecemos por repasar la estructura básica de la biblioteca de Typescript de Anchor. El objeto principal que utilizarás es el objeto **Program**. Una instancia de **Program** representa un programa específico de Solana y proporciona una API personalizada para leer y escribir en el programa.

Para crear una instancia de **Program** , necesitarás lo siguiente:

- IDL - archivo que representa la estructura de un programa
- **Connection** - la conexión al clúster
- **Wallet** - par de claves predeterminado utilizado para pagar y firmar transacciones
- **Provider** - encapsula la conexión a un clúster de Solana y una Billetera
- **ProgramId** - la dirección en la cadena de bloques del programa


![5.2](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%205/imagenes/2/1.png)


La imagen anterior muestra cómo se combinan cada una de estas piezas para crear una instancia de **Program** . Revisaremos cada uno de ellos individualmente para tener una mejor idea de cómo todo se relaciona.

### Lenguaje de Descripción de Interfaz (IDL)

Cuando construyes un programa de Anchor, Anchor genera tanto un archivo JSON como un archivo de Typescript que representa el IDL de tu programa. El IDL representa la estructura del programa y puede ser utilizado por un cliente para inferir cómo interactuar con un programa específico.
Aunque no es automático, también se puede generar un IDL a partir de un programa nativo de Solana utilizando herramientas como [shank](https://github.com/metaplex-foundation/shank) de Metaplex.

Para tener una idea de la información que proporciona un IDL, aquí está el IDL del programa contador que construiste anteriormente:

```Rust
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

Al inspeccionar el IDL, puedes ver que este programa contiene dos instrucciones (**initialize** e **increment** ).
Observe que además de especificar las instrucciones, especifica las cuentas e inputs para cada instrucción. La instrucción **initialize** requiere tres cuentas:

1. **counter**: la nueva cuenta que se inicializa en la instrucción.
2. **user** : el pagador de la transacción e inicialización.
3. **systemProgram** : se invoca al programa del sistema para inicializar una nueva cuenta.

Y la instrucción de **increment** requiere dos cuentas:

1. **counter** : una cuenta existente para incrementar el campo de conteo
2. **user** : el pagador de la transacción.

Al ver el IDL, se puede ver que en ambas instrucciones se requiere al **user** como firmante ya que la bandera **isSigner** está marcada como **true** . Además, ninguna instrucción requiere datos de instrucción adicionales ya que la sección **args** está en blanco para ambos.
Al mirar más abajo en la sección de **accounts**, se puede ver que el programa contiene un tipo de cuenta llamado **Counter** con un único campo de **count** de tipo **u64** .

Aunque el IDL no proporciona los detalles de implementación para cada instrucción, podemos obtener una idea básica de cómo el programa en la cadena espera que se construyan las instrucciones y ver la estructura de las cuentas del programa.

Independientemente de cómo lo obtengas, necesitas un archivo IDL para interactuar con un programa utilizando el paquete **@project-serum/anchor** . Para usar el IDL, necesitarás incluir el archivo IDL en tu proyecto y luego importar el archivo.

```Rust
import idl from "./idl.json"
```

## Proveedor

Antes de poder crear un objeto **Program** utilizando el IDL, primero necesita crear un objeto **Provider** de Anchor.

El objeto **Provider** combina dos cosas:

- **Connection** : la conexión a un clúster de Solana (es decir, localhost, devnet, mainnet)
- **Wallet** : una dirección especificada utilizada para pagar y firmar transacciones.

El **Provider** entonces es capaz de enviar transacciones a la cadena de bloques Solana en nombre de una **Wallet** incluyendo la firma de la billetera en las transacciones salientes. Al utilizar una interfaz gráfica con un proveedor de billetera de Solana, todas las transacciones salientes deben ser aprobadas por el usuario a través de la extensión del navegador de su billetera.

La configuración de la **Wallet** y la **Connection** se vería algo así:

```Rust
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"

const { connection } = useConnection()
const wallet = useAnchorWallet()
```

Para configurar la conexión, puedes utilizar el hook **useConnection** de **@solana/wallet-adapter-react** para obtener la **Connection** a un clúster de Solana.

Ten en cuenta que el objeto **Wallet** proporcionado por el hook **useWallet** de **@solana/wallet-adapter-react** no es compatible con el objeto **Wallet** que el **Provider** de Anchor espera. Sin embargo, **@solana/wallet-adapter-react** también proporciona un hook **useAnchorWallet**.

Para comparar, aquí está el **AnchorWallet** de **useAnchorWallet** :

```Rust
export interface AnchorWallet {
  publicKey: PublicKey
  signTransaction(transaction: Transaction): Promise<Transaction>
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>
}
```

Y el **WalletContextState** de **useWallet** :

```Rust
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

El **WalletContextState** proporciona mucha más funcionalidad en comparación con el **AnchorWallet**, pero el **AnchorWallet** es necesario para configurar el objeto **Provider**.

Para crear el objeto **Provider** utilizas **AnchorProvider** de **@project-serum/anchor** .

El constructor de **AnchorProvider** toma tres parámetros:

- **connection**: la **Connection** al clúster de Solana
- **wallet**: objeto de **Wallet**
- **opts**: parámetro opcional que especifica las opciones de confirmación, usando una configuración predeterminada si no se proporciona una.

Una vez que hayas creado el objeto **Provider** , lo estableces como el proveedor predeterminado utilizando **setProvider**.

```Rust
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { AnchorProvider, setProvider } from "@project-serum/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()
const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)
```

### Programa

Una vez que tienes el IDL y un proveedor, puedes crear una instancia de **Program** . El constructor requiere tres parámetros:

- **idl** : el IDL como tipo **Idl**
- **programId** : la dirección en la cadena de bloques del programa como una **string** o **PublicKey**
- **Provider** : el proveedor discutido en la sección anterior

El objeto **Program** crea una API personalizada que puedes usar para interactuar con un programa de Solana. Esta API es el lugar de referencia para todas las cosas relacionadas con la comunicación con programas en la cadena. Entre otras cosas, puedes enviar transacciones, obtener cuentas deserializadas, decodificar datos de instrucción, suscribirte a cambios de cuenta y escuchar eventos. Puedes aprender más sobre la clase **Program** [aquí](https://coral-xyz.github.io/anchor/ts/classes/Program.html#constructor).

Para crear el objeto **Program** , primero importa **Program** e **Idl** desde **@project-serum/anchor** . **Idl** es un tipo que puedes usar al trabajar con Typescript.

A continuación, especifique el **programId** del programa. Tenemos que establecer explícitamente el **programId** ya que puede haber varios programas con la misma estructura IDL (es decir, si el mismo programa se despliega varias veces utilizando diferentes direcciones). Al crear el objeto **Program** , se utiliza el **Provider** predeterminado si no se especifica explícitamente uno.

En conjunto, la configuración final se ve así:

```Rust
import idl from "./idl.json"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  Program,
  Idl,
  AnchorProvider,
  setProvider,
} from "@project-serum/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()

const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)

const programId = new PublicKey("JPLockxtkngHkaQT5AuRYow3HyUv5qWzmhwsCPd653n")
const program = new Program(idl as Idl, programId)
```

## Anchor **MethodsBuilder**

Una vez configurado el objeto **Program** , puedes usar el Anchor Methods Builder para construir instrucciones y transacciones relacionadas con el programa. El **MethodsBuilder** utiliza el IDL para proporcionar un formato simplificado para construir transacciones que invocan instrucciones del programa.

Ten en cuenta que se utiliza la convención de nombres camel case al interactuar con un programa desde el cliente, en comparación con la convención de nombres snake case utilizada al escribir el programa en rust.

El formato básico de **MethodsBuilder** es el siguiente:

```Rust
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

Paso a paso, puedes:

1. Llamar **methods** en el **program** : esta es la API del constructor para crear llamadas a instrucciones relacionadas con el IDL del programa.
2. Llamar el nombre de la instrucción como **.instructionName(instructionDataInputs)** : simplemente llama a la instrucción utilizando la sintaxis de punto y el nombre de la instrucción, pasando cualquier argumento de instrucción como valores separados por comas.
3. Llamar a las **accounts** : utilizando la sintaxis de punto, llama a **.accounts** , pasando un objeto con cada cuenta que la instrucción espera según el IDL
4. Opcionalmente llama a los **signer** : utilizando la sintaxis de punto, llama a **.signers** , pasando una matriz de firmantes adicionales requeridos por la instrucción
5. Llamar **rpc** : este método crea y envía una transacción firmada con la instrucción especificada y devuelve una **TransactionSignature** . Cuando se utiliza **.rpc** , la **Wallet** del **Provider** se incluye automáticamente como un firmante y no tiene que ser mencionada explícitamente.

Ten en cuenta que si no se requieren firmantes adicionales por la instrucción además de la **Wallet** especificada con el **Provider** , la línea **.signer([])** se puede excluir.

También puedes construir la transacción directamente cambiando **.rpc()** a **.transaction().** Esto construye un objeto **Transaction** usando la instrucción especificada, con las cuentas y firmantes especificados.

```Rust
// creates transaction
const transaction = await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .transaction()

await sendTransaction(transaction, connection)
```

De manera similar, puedes usar el mismo formato para construir una instrucción utilizando **.instruction()** y luego agregar manualmente las instrucciones a una nueva transacción. Esto crea un objeto **TransactionInstruction** utilizando la instrucción especificada

```Rust
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

En resumen, el Anchor **MethodsBuilder** proporciona una forma simplificada y más flexible de interactuar con programas en la cadena. Puedes construir una instrucción, una transacción o construir y enviar una transacción utilizando básicamente el mismo formato sin tener que serializar o deserializar manualmente las cuentas o los datos de instrucción.

## Obtener Cuentas del Programa

El objeto **Program** también te permite recuperar y filtrar fácilmente las cuentas del programa. Simplemente llama a la **account** en el **program** y luego especifica el nombre del tipo de cuenta tal como se refleja en el IDL. Anchor luego deserializa y devuelve todas las cuentas especificadas.

El ejemplo a continuación muestra cómo puedes recuperar todas las cuentas de **counter** existentes para el programa Contador.

```Rust
const accounts = await program.account.counter.all()
```

También puedes aplicar un filtro utilizando **memcmp** y luego especificando un **offset** y los **bytes** para filtrar.

El ejemplo a continuación recupera todas las cuentas de **counter** con un **count** de 0. Tenga en cuenta que el **offset** de 8 es para el discriminador de 8 bytes que Anchor utiliza para identificar los tipos de cuenta. El noveno byte es donde comienza el campo de **count** . Puede consultar el IDL para ver que el siguiente byte almacena el campo de **count** de tipo **u64** . Anchor luego filtra y devuelve todas las cuentas con bytes coincidentes en la misma posición.

```Rust
const accounts = await program.account.counter.all([
    {
        memcmp: {
            offset: 8,
            bytes: bs58.encode((new BN(0, 'le')).toArray()),
        },
    },
])
```

Como alternativa, también puedes obtener los datos de cuenta deserializados para una cuenta específica utilizando **fetch** si conoces la dirección de la cuenta que estás buscando.

```Rust
const account = await program.account.counter.fetch(ACCOUNT_ADDRESS)
```

De manera similar, puedes buscar varias cuentas utilizando **fetchMultiple**.

```Rust
const accounts = await program.account.counter.fetchMultiple([ACCOUNT_ADDRESS_ONE, ACCOUNT_ADDRESS_TWO])
```

# Demostración

Practiquemos juntos construyendo una interfaz frontal para el programa Counter de la ultima lección. Como recordatorio, el programa Counter tiene dos instrucciones:

- **initialize** - inicializa una nueva cuenta de **Counter** y establece el **count** en **0**
- **increment** - incrementa el contador en una **count** de **Counter** existente

## 1. Descargar el código base

Descarga el código base para este proyecto aquí. Una vez que tengas el código base, echa un vistazo. Instala las dependencias con **npm install** y luego ejecuta la aplicación con **npm run dev** .

Este proyecto es una sencilla aplicación Next.js. Incluye el proveedor de contexto **WalletContextProvider** que creamos en la [lección de Wallets](https://github.com/Unboxed-Software/solana-course/blob/main/content/interact-with-wallets.md), el archivo **idl.json** para el programa Counter, y los componentes **Initialize** e **Increment** que construiremos a lo largo de esta demostración. También se incluye el **programId** del programa que invocaremos en el código base.

## 2. Inicializar

Para comenzar, completemos la configuración para crear el objeto **Program** en el componente **Initialize.tsx** .

Recuerda, necesitaremos una instancia de **Program** para usar el Anchor **MethodsBuilder** para invocar las instrucciones en nuestro programa. Para eso, necesitaremos una billetera Anchor y una conexión, que podemos obtener de los ganchos **useAnchorWallet** y **useConnection** . También creemos un **useState** para capturar la instancia del programa.

```Rust
export const Initialize: FC<Props> = ({ setCounter }) => {
  const [program, setProgram] = useState("")

  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  ...
}
```

Con eso, podemos trabajar en la creación de la instancia de **Program** real. Hagámoslo en un **useEffect** .

Primero, necesitamos obtener el proveedor predeterminado si ya existe o crearlo si no existe. Podemos hacerlo llamando a **getProvider** dentro de un bloque try/catch. Si se produce un error, significa que no hay proveedor predeterminado y necesitamos crear uno.

Una vez que tengamos un proveedor, podemos construir una instancia de **Program** .

```Rust
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

Ahora que hemos terminado la configuración de Anchor, podemos invocar la instrucción **initialize** del programa. Haremos esto dentro de la función **onClick** .

Primero, necesitaremos generar una nueva **Keypair** para la nueva cuenta **Counter** ya que estamos inicializando una cuenta por primera vez.

Luego, podemos usar el Anchor **MethodsBuilder** para crear y enviar una nueva transacción. Recuerda, Anchor puede inferir algunas de las cuentas necesarias, como las cuentas de **user** y **systemAccount** . Sin embargo, no puede inferir la cuenta del **counter** ya que la generamos de forma dinámica, por lo que deberás agregarla con **.accounts** . También deberás agregar esa keypair como una firma con **.signers** . Por último, puedes usar **.rpc()** para enviar la transacción a la billetera del usuario.

Una vez que la transacción se realiza, llama a **setUrl** con la URL del explorador y luego llama a **setCounter** , pasando la cuenta del contador.

```Rust
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

## 3. Incrementar

A continuación, pasemos al componente **Increment.tsx** . Al igual que antes, completa la configuración para crear el objeto **Program** . Además de llamar a **setProgram** , el **useEffect** debería llamar a **refreshCount** .

Agregue el siguiente código para la configuración inicial:

```Rust
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

A continuación, usemos el Anchor **MethodsBuilder** para construir una nueva instrucción para invocar la instrucción de **increment** . Nuevamente, Anchor puede inferir la cuenta de **user** de la billetera, por lo que solo necesitamos incluir la cuenta del **counter** .

```Rust
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

## 5. Mostrar el conteo correcto

Ahora que podemos inicializar el programa contador e incrementar el contador, necesitamos que nuestra interfaz gráfica muestre el contador almacenado en la cuenta del contador.

En una lección futura, mostraremos cómo observar los cambios en las cuentas, pero por ahora solo tenemos un botón que llama a **refreshCount** para que pueda hacer clic en él y ver el nuevo conteo después de cada invocación de **increment** .

Dentro de **refreshCount** , usemos **program** para obtener la cuenta del contador, luego usemos **setCount** para establecer el contador en el número almacenado en el programa:

```Rust
const refreshCount = async (program) => {
  const counterAccount = await program.account.counter.fetch(counter)
  setCount(counterAccount.count.toNumber())
}
```

¡SUPER SIMPLE CON ANCHOR!

## 6. Prueba la interfaz frontal

    ¡En este punto, todo debería funcionar! Puedes probar la interfaz frontal ejecutando **npm run dev** .

1. Conecta tu billetera y deberías ver el botón **Initialize Counter**
2. Haz clic en el botón **Initialize Counter** y luego aprueba la transacción
3. Luego deberías ver un enlace en la parte inferior de la pantalla a Solana Explorer para la transacción de **inicialización** . También deberían aparecer los botones **Increment Counter** , **Refresh Count** y el contador.
4. Haz clic en el botón **Increment Counter** y luego aprueba la transacción
5. Espera unos segundos y haz clic en **Refresh Count** . El contador debería incrementarse en la pantalla.


![5.2](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%205/imagenes/2/gif2-1.gif)


¡No dudes en hacer clic en los enlaces para inspeccionar los registros del programa de cada transacción!


![5.3](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%205/imagenes/2/3.png)


![5.4](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%205/imagenes/2/4.png)


Felicidades, ahora sabes cómo configurar una interfaz frontal para invocar un programa Solana utilizando un IDL de Anchor.
Si necesitas más tiempo con este proyecto para sentirte cómodo con estos conceptos, no dudes en echar un vistazo al [código de la solución en la rama **solution-increment**](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-increment) antes de continuar.

# Reto

Ahora es tu turno de construir algo de forma independiente. A partir de lo que hemos hecho en la demostración, intenta crear un nuevo componente en la interfaz frontal que implemente un botón para decrementar el contador.

Antes de construir el componente en la interfaz frontal, primero deberás:

1. Construir y desplegar un nuevo programa que implemente una instrucción de **decrement** .
2. Actualizar el archivo IDL en la interfaz frontal con el de tu nuevo programa.
3. Actualizar el **programId** con el de tu nuevo programa.
   Si necesitas ayuda, no dudes en consultar este programa [aquí](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement) .
   Intenta hacerlo de forma independiente si puedes. Pero si te atoras, no dudes en consultar el [código de la solución](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-decrement).

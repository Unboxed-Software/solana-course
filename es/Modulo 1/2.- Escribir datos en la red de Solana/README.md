# Escribir datos en la red Solana
## Objetivos de la lección
*Al final de esta lección, podrás:*

- Explicar keypair
- Utilizar **@solana/web3.js** para generar un keypair
- Utilizar **@solana/web3.js** para crear un keypair utilizando una clave secreta
- Explicar transacciones
- Explicar tarifas de transacción
- Utilizar **@solana/web3.js** para enviar sol
- Utilizar **@solana/web3.js** para firmar transacciones
- Utilizar el explorador Solana para ver las transacciones

- **Keypair** se refiere a una combinación de claves públicas y secretas. La clave pública se utiliza como una "dirección" que apunta a una cuenta en la red Solana. La clave secreta se utiliza para verificar la identidad o la autoridad. Como su nombre indica, siempre debes mantener las claves secretas privadas. **@solana/web3.js** proporciona funciones de ayuda para crear un nuevo keypair o para construir un keypair utilizando una clave secreta existente.

- **Las transacciones** son en esencia un paquete de instrucciones que invocan programas Solana. El resultado de cada transacción depende del programa que se llama. Todas las modificaciones a los datos on-chain ocurren a través de transacciones. Ejemplo:

```JavaScript
const transaccion = new Transaction()

const instruccionesParaMandarSol = SystemProgram.transfer({
    deLlavePublica: sender,
    haciaLlavePublica: recipient,
    lamports: LAMPORTS_PER_SOL * amount
})

transaccion.add(instruccionesParaMandarSol)

const firma = sendAndConfirmTransaction(
    conexion,
    transaccion,
    [senderKeypair]
)
```

## Resumen
### Keypair
Como su nombre indica, un keypair es un par de claves: una clave pública y una clave secreta.

- La clave pública se utiliza como una "dirección" que apunta a una cuenta en la red Solana.
- La clave secreta se utiliza para verificar la identidad o la autoridad. Como su nombre indica, siempre debes mantener las claves secretas privadas.
Un keypair es necesario para la gran mayoría de las interacciones dentro de la red Solana. Si aún no tienes un keypair o si deseas generar uno nuevo para un propósito específico, **@solana/web3.js** proporciona una función de ayuda para crear un nuevo keypair.

```JavaScript
const keypairDeLaPersona = Keypair.generate()
```

Un keypair es del tipo de datos *Keypair* y se puede desestructurar en una clave pública:


```JavaScript
const llavePublica = ownerKeypair.publicKey
```

... o la clave secreta:

```JavaScript
const secretKey = ownerKeypair.secretKey
```

If you already have a keypair you’d like to use, you can create a Keypair from the secret key using the *Keypair.fromSecretKey()* function. To ensure that your secret key stays secure, we recommend injecting it through an environment variable and not committing your .env file.

```JavaScript
const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[]
const llaveSecreta = Uint8Array.from(secret)
const keypairDeLaLlaveSecreta = Keypair.fromSecretKey(secretKey)
```

### Transacciones
Cualquier modificación a los datos on-chain ocurre a través de transacciones enviadas a programas.

Las instrucciones de transacción contienen:

Un identificador del programa que deseas invocar
Una matriz de cuentas que se leerán y/o escribirán
Datos estructurados como una matriz de bytes que se especifican al programa que se está invocando
Cuando envías una transacción a un clúster Solana, se invoca un programa Solana con las instrucciones incluidas en la transacción.
Como podrías esperar, @solana/web3.js proporciona funciones de ayuda para crear transacciones e instrucciones. Puedes crear una nueva transacción con el constructor, new Transaction(). Una vez creada, puedes agregar instrucciones a la transacción con el método add().

Las instrucciones pueden complicarse cuando trabajas con programas personalizados. Afortunadamente, @solana/web3.js tiene funciones de comodidad para algunos de los programas nativos de Solana y operaciones básicas, como transferir SOL:

```JavaScript
const transaccion = new Transaction()

const instruccionParaMandarSol = SystemProgram.transfer({
    deLlavePublica: sender,
    haciaLlavePublica: recipient,
    lamports: LAMPORTS_PER_SOL * amount
})

transaccion.add(instruccionParaMandarSol)
```

La función **SystemProgram.transfer()** requiere que pasen como parámetros:
una clave pública correspondiente a la cuenta del remitente
una clave pública correspondiente a la cuenta del destinatario
la cantidad de SOL para enviar en lamports.
Esta función luego devuelve la instrucción para enviar SOL del remitente al destinatario, después de lo cual la instrucción se puede agregar a la transacción.

Una vez creada, una transacción debe ser enviada al cluster y confirmada.

```JavaScript
const firma = sendAndConfirmTransaction(
    connection,
    transaction,
    [senderKeypair]
)
```

La función *sendAndConfirmTransaction()* toma como parámetros:
- una conexión de cluster
- una transacción
- un arreglo de pares de claves que actuarán como firmantes en la transacción - en este ejemplo, solo tenemos un firmante: el remitente.


### Instrucciones
El ejemplo de enviar SOL es excelente para introducirte en el envío de transacciones, pero gran parte del desarrollo web3 involucrará llamadas a programas no nativos. En el ejemplo anterior, la función **SystemProgram.transfer()** asegura que pasas todos los datos necesarios requeridos para crear la instrucción, luego crea la instrucción para ti. Sin embargo, cuando trabajes con programas no nativos, deberás ser muy específico al crear instrucciones estructuradas para que coincidan con el programa correspondiente.

Con **@solana/web3.js**, puedes crear instrucciones no nativas con el constructor **TransactionInstruction**. Este constructor toma un único argumento del tipo de datos **TransactionInstructionCtorFields**.

```JavaScript
export type TransactionInstructionCtorFields = {
  llaves: Array<AccountMeta>;
  programId: PublicKey;
  data?: Buffer;
};
```

Según la definición anterior, el objeto pasado al constructor de **TransactionInstruction** requiere:

- un arreglo de claves de tipo **AccountMeta**
- la clave pública del programa que se está llamando
- un **Buffer** opcional que contiene los datos a pasar al programa.

Ignoraremos el campo de **datos** por ahora y lo revisaremos en una lección futura.

El campo **programId** es bastante autoexplicativo: es la clave pública asociada al programa. Necesitarás conocerlo con anticipación antes de llamar al programa de la misma manera en que necesitarías conocer la clave pública de alguien a quien quieras enviar SOL.

El arreglo de **llaves** requiere un poco más de explicación. Cada objeto en este arreglo representa una cuenta que se leerá o escribirá durante la ejecución de una transacción. Esto significa que debes conocer el comportamiento del programa que estás llamando y asegurarte de proporcionar todas las cuentas necesarias en el arreglo.

Cada objeto en el arreglo de **llaves** debe incluir lo siguiente:

- **pubkey**: la clave pública de la cuenta
- **isSigner**: un booleano que representa si la cuenta es un firmante en la transacción
- **isWritable**: un booleano que representa si la cuenta se escribe durante la ejecución de la transacción

Juntando todo esto, podríamos terminar con algo como lo siguiente:

```JavaScript
async function llamarAlPrograma(
    connection: web3.Connection,
    payer: web3.Keypair,
    programId: web3.PublicKey,
    programDataAccount: web3.PublicKey
) {
    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                pubkey: programDataAccount,
                isSigner: false,
                isWritable: true
            },
        ],
        programId
    })

    const sig = await web3.sendAndConfirmTransaction(
        connection,
        new web3.Transaction().add(instruction),
        [payer]
    )

    console.log(sig)
}
```

Las tarifas de transacción están incorporadas en la economía de Solana como compensación para la red de validadores por los recursos de CPU y GPU requeridos en el procesamiento de transacciones. A diferencia de muchas redes que tienen un mercado de tarifas en el que los usuarios pueden pagar tarifas más altas para aumentar sus posibilidades de ser incluidos en el próximo bloque, las tarifas de transacción de Solana son determinísticas.

El primer firmante incluido en la matriz de firmantes en una transacción es responsable de pagar la tarifa de transacción. Si este firmante no tiene suficientes SOL en su cuenta para cubrir la tarifa de transacción, la transacción será descartada.

Al probar, ya sea localmente o en devnet, puede usar el comando Solana CLI **solana airdrop 1** para obtener SOL de prueba gratuitos en su cuenta para pagar las tarifas de transacción.

### Solana Explorer

<!-- Image here -->
![2.1](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%201/images/1.2/1solana-explorer-devnet.png)

Todas las transacciones en la cadena de bloques son visibles públicamente en el [Explorador de Solana](https://explorer.solana.com). Por ejemplo, podría tomar la firma devuelta por **sendAndConfirmTransaction()** en el ejemplo anterior, buscar esa firma en el Explorador de Solana y ver:

- cuándo ocurrió
- en qué bloque se incluyó
- la tarifa de transacción
- ¡y más!

<!-- Image here -->
![2.2](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.2/2solana-explorer-transaction-overview.png)

## Demo

Vamos a crear un script para hacer un ping a un programa simple que incrementa un contador cada vez que es pingado. Este programa existe en el Devnet de Solana en la dirección **ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa**. El programa almacena los datos del contador en una cuenta específica en la dirección **Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod**.

### 1. Estructura básica
Comencemos con alguna estructura básica. Puedes configurar tu proyecto como mejor te parezca, pero usaremos un proyecto sencillo de Typescript con una dependencia del paquete @solana/web3.js. Si quieres seguir nuestra estructura, puedes usar los siguientes comandos en la línea de comandos:

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
- creará un nuevo directorio para el proyecto con un subdirectorio **src**
- moverá el prompt de comandos dentro del directorio del proyecto
- creará un archivo **index.ts** dentro de **src**
- inicializará un repositorio git con un archivo **.gitignore**
- creará un nuevo paquete **npm**
- agregará una dependencia de desarrollador de typescript
- agregará una dependencia de desarrollador de **ts-node**
- creará un archivo **.tsconfig**
- instalará la dependencia **@solana/web3.js**
- instalará la dependencia **.dotenv**
- creará un archivo **.env**

Si quieres que tu código sea exactamente igual al nuestro, reemplaza el contenido del archivo **tsconfig.json** con lo siguiente:

```JavaScript
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
  "include": [ "./src/**/*" ]
}
```

Agrega el siguiente **.gitignore**

node_modules/
dist/
.env

Por ultimo, agrega lo siguiente al objeto scripts en **package.json**

### 2. Generar un nuevo par de claves
Antes de hacer cualquier cosa, necesitarás un par de claves. Vamos a entrar en el archivo **index.ts** y generar uno:

```JavaScript
import web3 = require('@solana/web3.js')
import Dotenv from 'dotenv'
Dotenv.config()

async function main() {
    const nuevaKeypair = await web3.Keypair.generate()
    console.log(nuevaKeypair.secretKey.toString())
}

main().then(() => {
    console.log("Finished successfully")
}).catch((error) => {
    console.error(error)
})
```

La mayoría de este código es solo una plantilla para ejecutar el archivo correctamente. Las líneas dentro de la función **main()** generan un nuevo par de claves y registran la clave secreta en la consola.

Ejecuta **npm start** después de guardar este archivo y deberías ver una matriz de números impresa en la consola. Esta matriz representa la clave secreta para tu nuevo par de claves. *No uses este par de claves para operaciones de Mainnet. Utilízalo solo para pruebas.*

Copia la matriz de clave secreta de la registro de consola y pégala en el archivo **.env** como una variable de entorno llamada, **PRIVATE_KEY**. De esta manera podemos reutilizar este par de claves en el desarrollo futuro en lugar de generar un nuevo par de claves cada vez que ejecutemos algo. Debería verse algo así pero con números diferentes:

```
PRIVATE_KEY="[56,83,31,62,66,154,33,74,106,59,111,224,176,237,89,224,10,220,28,222,128,36,138,89,30,252,100,209,206,155,154,65,98,194,97,182,98,162,107,238,61,183,163,215,44,6,10,49,218,156,5,131,125,253,247,190,181,196,0,249,40,149,119,246]"
```

### 3. Inicializar el par de claves a partir de la clave secreta
Ahora que hemos generado con éxito un par de claves y lo hemos copiado en el archivo **.env**, podemos eliminar el código dentro de la función **main()**.
Regresaremos a la función **main()** pronto, pero por ahora creemos una nueva función fuera de **main()** llamada **initializeKeypair()**. Dentro de esta nueva función:

analiza la variable de entorno **PRIVATE_KEY** como **number[]**
utilízalo para inicializar un **Uint8Array**
inicializa y devuelve un **Keypair** utilizando ese **Uint8Array**.


```JavaScript
function initializeKeypair(): web3.Keypair {
    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[]
    const secretKey = Uint8Array.from(secret)
    const keypairFromSecretKey = web3.Keypair.fromSecretKey(secretKey)
    return keypairFromSecretKey
}
```

### 4. Ping Program
Ahora que tenemos una forma de inicializar nuestra keypair, necesitamos establecer una conexión con el Devnet de Solana. En **main()**, invoquemos **initializeKeypair()** y creamos una conexión:

```JavaScript
async function main() {
    const quienPaga = initializeKeypair()
    const conexion = new web3.Connection(web3.clusterApiUrl('devnet'))
}
```
Ahora, crea una función asíncrona fuera de main() llamada pingProgram() con dos parámetros que requieren una conexión y una keypair de pagador como argumentos:

```JavaScript
async function pingProgram(conexion: web3.Connection, quienPaga: web3.Keypair) { }
```

Dentro de esta función, necesitamos:

- crear una transacción
- crear una instrucción
- añadir la instrucción a la transacción
- enviar la transacción.

Recuerda, la pieza más desafiante aquí es incluir la información correcta en la instrucción. Sabemos la dirección del programa al que estamos llamando. También sabemos que el programa escribe datos en una cuenta separada cuya dirección también tenemos. Añadamos las versiones en cadena de ambas como constantes en la parte superior del archivo **index.ts**:

```JavaScript
const PROGRAM_ADDRESS = 'ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa'
const PROGRAM_DATA_ADDRESS = 'Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod'
```

Ahora, en la función '**pingProgram()**', creemos una nueva transacción, luego inicializamos una **PublicKey** para la cuenta del programa y otra para la cuenta de datos.


```JavaScript
async function pingProgram(conexion: web3.Connection, quienPaga: web3.Keypair) {
    const transaccion = new web3.Transaction()

    const programId = new web3.PublicKey(PROGRAM_ADDRESS)
    const programDataLlavePublica = new web3.PublicKey(PROGRAM_DATA_ADDRESS)
}
```

A continuación, creemos la instrucción. Recuerda, la instrucción debe incluir la clave pública para el programa y también debe incluir una matriz con todas las cuentas que se leerán o escribirán. En este programa de ejemplo, solo se necesita la cuenta de datos mencionada anteriormente.

```JavaScript
async function pingProgram(conexion: web3.Connection, quienPaga: web3.Keypair) {
    const transaccion = new web3.Transaction()

    const programId = new web3.PublicKey(PROGRAM_ADDRESS)
    const programDataLlavePublica = new web3.PublicKey(PROGRAM_DATA_ADDRESS)

    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                llavePublica: programDataLlavePublica,
                esFirmable: false,
                esEscribible: true
            },
        ],
        programId
    })
}
```

A continuación, agreguemos la instrucción a la transacción que creamos al inicio de la función. Luego, llamemos a **sendAndConfirmTransaction()** pasando la conexión, la transacción y el pagador. Finalmente, registremos el resultado de esa llamada a la función para que podamos buscarlo en el Solana Explorer.

```JavaScript
async function pingProgram(conexion: web3.Connection, quienPaga: web3.Keypair) {
    const transaccion = new web3.Transaction()

    const programId = new web3.PublicKey(PROGRAM_ADDRESS)
    const programDataLlavePublica = new web3.PublicKey(PROGRAM_DATA_ADDRESS)

    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                llavePublica: programDataLlavePublica,
                esFirmable: false,
                esEscribible: true
            },
        ],
        programId
    })

    transaccion.add(instruction)

    const sig = await web3.sendAndConfirmTransaction(
        conexion,
        transaccion,
        [quienPaga]
    )

    console.log(sig)
}
```

Finalmente, invoquemos **pingProgram()** dentro de **main()** utilizando la conexión y el pagador:

```JavaScript
async function main() {
    const quienPaga = initializeKeypair()
    const conexion = new web3.Connection(web3.clusterApiUrl('devnet'))
    await pingProgram(conexion, quienPaga)
}
```

### 5. Airdrop
Ahora ejecuta el código con **npm start** y verifica si funciona. Es posible que obtengas el siguiente error en la consola:

```
La simulación de la transacción falló: intento de debitar una cuenta pero no se encontró registro de un crédito anterior.
```

Si obtienes este error, es porque tu par de claves es nuevo y no tiene ningún SOL para cubrir las tarifas de transacción. Solucionemos esto agregando la siguiente línea en **main()** antes de la llamada a **pingProgram()**:

```JavaScript
await conexion.requestAirdrop(quienPaga.publicKey, web3.LAMPORTS_PER_SOL*1)
```

Esto depositará 1 SOL en tu cuenta que puedes usar para probar. Esto no funcionará en Mainnet donde realmente tendría valor. Pero es increíblemente conveniente para probar localmente y en Devnet.

### 6. Verifica el explorador de solana
Ahora ejecuta el código de nuevo. Puede tomar un momento o dos, pero ahora el código debería funcionar y deberías ver una cadena larga impresa en la consola, como la siguiente:

```
55S47uwMJprFMLhRSewkoUuzUs5V6BpNfRx21MpngRUQG3AswCzCSxvQmS3WEPWDJM7bhHm3bYBrqRshj672cUSG
```

Copia esta firma de confirmación. Abre un navegador y ve a [el explorador de solana](https://explorer.solana.com/?cluster=devnet) (el parámetro de consulta al final de la URL asegurará que explorará las transacciones en Devnet en lugar de en Mainnet). Pega la firma en la barra de búsqueda de la parte superior del explorador de Devnet de Solana y pulsa Enter. Deberías ver todos los detalles sobre la transacción. Si desplazas hasta abajo, verás Program Logs, que muestran cuántas veces se ha llamado al programa, incluido tu llamado.


![2.2](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%201/images/1.2/3solana-explorer-ping-result.png)

Si deseas hacer más fácil buscar transacciones en el Explorador de Solana en el futuro, simplemente cambia tu **console.log** en **pingProgram()** a lo siguiente:

```JavaScript
console.log(`You can view your transaction on the Solana Explorer at:\nhttps://explorer.solana.com/tx/${sig}?cluster=devnet`);
```

Y así de fácil estás llamando programas en la red Solana y escribiendo datos en la cadena.

En las próximas lecciones aprenderás cómo:
- hacerlo de forma segura desde el navegador en lugar de desde un script
- agregar datos personalizados a tus instrucciones
- deserializar datos de la cadena


## Desafío

Adelante y crea un script desde cero que te permita transferir SOL de una cuenta a otra en Devnet. Asegúrate de imprimir la firma de la transacción para que puedas verla en el Explorador Solana.

Si te atascas, no dudes en echar un vistazo al [código de solución](https://github.com/Unboxed-Software/solana-send-sol-client).

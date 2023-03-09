
# Interactuar con Billeteras (Wallets)
## Objetivos de la Lección
*Al final de esta lección, podrás:*
- Explicar los monederos (wallets)
- Instalar la extensión Phantom
- Configurar el monedero Phantom en **Devnet**
- Utilizar el adaptador de monederos para que los usuarios firmen transacciones.
 
# Terminología
- Los **monederos** almacenan su llave privada y manejan la firma segura de transacciones
- Los **monederos de hardware** almacenan su llave privada en un dispositivo separado
- Los **monederos de software** utilizan su computadora para almacenar de forma segura
- Los monederos de software a menudo son **extensiones de navegador** que facilitan la conexión a sitios web
- La **biblioteca Wallet-Adapter** de Solana simplifica el soporte de las extensiones de monederos de navegador, lo que le permite construir sitios web que puedan solicitar la dirección de monedero de un usuario y proponer transacciones para que las firmen.


# Resumen
## Wallets
En las dos lecciones anteriores discutimos las llaves de par. Las llaves de par se utilizan para localizar las cuentas y firmar transacciones. Si bien la llave pública de un par de llaves es perfectamente segura para compartir, la llave privada siempre debe mantenerse en un lugar seguro. Si la llave privada de un usuario se expone, entonces un actor malicioso podría vaciar su cuenta de todos los activos y ejecutar transacciones con la autoridad de ese usuario.
Un "monedero" se refiere a cualquier cosa que almacene una llave privada con el fin de mantenerla segura. Estas opciones de almacenamiento seguro se pueden describir generalmente como "monederos de hardware" o "monederos de software". Los monederos de hardware son dispositivos de almacenamiento que están separados de su computadora. Los monederos de software son aplicaciones que puedes instalar en tus dispositivos existentes.
Los monederos de software a menudo vienen en forma de una extensión de navegador. Esto hace posible que los sitios web interactúen fácilmente con el monedero. Estas interacciones suelen estar limitadas a:

1. Ver la llave pública (dirección) del monedero
2. Enviar transacciones para la aprobación del usuario
3. nviar una transacción aprobada a la red.

Una vez que se envía una transacción, el usuario final puede "confirmar" la transacción y enviarla a la red con su "firma". 
Firmar transacciones requiere el uso de su llave privada. Al permitir que un sitio envíe una transacción a su monedero y que el monedero maneje la firma, asegura que nunca exponga su llave privada al sitio web. En cambio, solo comparte la llave privada con la aplicación del monedero.
A menos que estés creando una aplicación de monedero tú mismo, tu código nunca debería necesitar pedirle a un usuario su llave privada. En cambio, puedes pedirle a los usuarios que se conecten a tu sitio utilizando un monedero confiable.

## Phantom Wallet
**Phantom** es una billetera de software ampliamente utilizada en el ecosistema Solana. Soporta navegadores populares y tiene una aplicación móvil para conectarse en cualquier momento. Se recomienda soportar varias billeteras para las aplicaciones descentralizadas, pero este curso se centra específicamente en Phantom.

## Adaptador de Wallets de Solana
El adaptador de billeteras de Solana es un conjunto de bibliotecas que se pueden utilizar para simplificar el proceso de soporte para las extensiones de navegador de billeteras.
El adaptador de billeteras de Solana consta de varios paquetes modulares. La funcionalidad principal se encuentra en **@solana/wallet-adapter-base** y **@solana/wallet-adapter-react** . 
También hay paquetes que proporcionan componentes para marcos de interfaz de usuario comunes. En esta lección y en todo este curso, estaremos utilizando componentes de **@solana/wallet-adapter-react-ui** . 
Finalmente, hay paquetes que son adaptadores para billeteras específicas, incluyendo Phantom. Puedes usar **@solana/wallet-adapter-wallets** para incluir todas las billeteras soportadas o puedes elegir un paquete de billetera específico como **@solana/wallet-adapter-phantom** .

### Instalar Bibliotecas de Adaptador de Wallet 
Al agregar soporte para billetera a una aplicación react existente, comienzas instalando los paquetes apropiados. Necesitarás **@solana/wallet-adapter-base** , **@solana/wallet-adapter-react** , el paquete (s) para las billeteras que deseas admitir y **@solana/wallet-adapter-react-ui** si planeas utilizar los componentes de react proporcionados, por ejemplo.

```bash
npm install @solana/wallet-adapter-base \
    @solana/wallet-adapter-react \
    @solana/wallet-adapter-phantom \
    @solana/wallet-adapter-react-ui
```

## Conectarse a Wallets
**@solana/wallet-adapter-react** nos permite persistir y acceder a los estados de conexión de la billetera a través de ganchos y proveedores de contexto, a saber:
- **useWallet**
- **WalletProvider**
- **useConnection**
- **ConnectionProvider**
Para que estos funcionen correctamente, cualquier uso de **useWallet** y **useConnection** debería estar envuelto en **WalletProvider** y **ConnectionProvider** . Una de las mejores formas de asegurar esto es envolver toda tu aplicación en **ConnectionProvider** y **WalletProvider** .

```JavaScript
import { NextPage } from 'next'
import { FC, ReactNode } from "react"
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import * as web3 from '@solana/web3.js'

export const Home: NextPage = (props) => {
    const ruta = web3.clusterApiUrl('devnet')
    const billetera = new PhantomWalletAdapter()

    return (
        <ConnectionProvider endpoint={ruta}>
            <WalletProvider wallets={[billetera]}>
                <p>El resto de tu aplicación aquí</p>
            </WalletProvider>
        </ConnectionProvider>
    )
}
```

Ten en cuenta que **ConnectionProvider** requiere una propiedad **endpoint** y que **WalletProvider** requiere una propiedad **wallets** . Seguimos utilizando el endpoint para el clúster Devnet y, por ahora, solo estamos utilizando **PhantomWalletAdapter** para las **billeteras** .

En este punto, puedes conectarte con **wallet.connect()** , lo que efectivamente instruirá a la billetera para solicitar al usuario permiso para ver su llave pública y solicitar la aprobación para las transacciones.

![3.1](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.3/1.png)
 
Aunque podrías hacerlo en un gancho **useEffect** , normalmente desearás proporcionar una funcionalidad más sofisticada. Por ejemplo, es posible que desees que los usuarios puedan elegir de una lista de billeteras admitidas o desconectarse después de haberse conectado.
 
## **@solana/wallet-adapter-react-ui**
Puedes crear componentes personalizados para esto o puedes aprovechar los componentes proporcionados por **@solana/wallet-adapter-react-ui** . La forma más sencilla de proporcionar opciones extensas es usar **WalletModalProvider** y **WalletMultiButton** :

```JavaScript
import { NextPage } from 'next'
import { FC, ReactNode } from "react"
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import * as web3 from '@solana/web3.js'

const Home: NextPage = (props) => {
    const ruta = web3.clusterApiUrl('devnet')
    const billetera = new PhantomWalletAdapter()

    return (
        <ConnectionProvider endpoint={ruta}>
            <WalletProvider wallets={[billetera]}>
                <WalletModalProvider>
                    <WalletMultiButton />
                    <p>El resto de tu aplicación aquí</p>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}

export default Home
```


El **WalletModalProvider** agrega funcionalidad para presentar una pantalla modal para que los usuarios puedan seleccionar qué billetera desean usar. El **WalletMultiButton** cambia el comportamiento para que coincida con el estado de conexión:

![3.2](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.3/2.png)

![3.3](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.3/3.png)

![3.4](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.3/4.png)

![3.5](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.3/5.png)

 También puedes usar componentes más granulares si necesitas una funcionalidad más específica:
- **WalletConnectButton**
- **WalletModal**
- **WalletModalButton**
- **WalletDisconnectButton**
- **WalletIcon**

## Accede a la Información de la Cuenta
Una vez que tu sitio esté conectado a una billetera, **useConnection** recuperará un objeto **Connection** y **useWallet** obtendrá el **WalletContextState** . **WalletContextState** tiene una propiedad **publicKey** que es **nula** cuando no está conectada a una billetera y tiene la llave pública de la cuenta del usuario cuando se conecta una billetera. Con una llave pública y una conexión, puedes recuperar información de la cuenta y más.


```JavaScript
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { FC, useEffect, useState } from 'react'

export const BalanceDisplay: FC = () => {
    const [balance, setBalance] = useState(0)
    const { connection } = useConnection()
    const { publicKey } = useWallet()

    useEffect(() => {
        if (!connection || !publicKey) { return }

        connection.getAccountInfo(publicKey).then(info => {
            setBalance(info.lamports)
        })
    }, [connection, publicKey])

    return (
        <div>
            <p>{publicKey ? `Balance: ${balance / LAMPORTS_PER_SOL} SOL` : ''}</p>
        </div>
    )
}
```

## Enviar Transacciones
**WalletContextState** también proporciona una función **sendTransaction** que puedes usar para enviar transacciones para su aprobación.

```JavaScript
const { publicKey, sendTransaction } = useWallet()
const { connection } = useConnection()

const sendSol = event => {
    event.preventDefault()

    const transaccion = new web3.Transaction()
    const recipientPubKey = new web3.PublicKey(event.target.recipient.value)

    const sendSolInstruction = web3.SystemProgram.transfer({
        deLlavePublica: publicKey,
        aLlavePublica: recipientPubKey,
        lamports: LAMPORTS_PER_SOL * 0.1
    })

    transaccion.add(sendSolInstruction);
    sendTransaction(transaccion, connection).then(sig => {
        console.log(sig)
    })
}
```

Cuando se llama a esta función, la billetera conectada mostrará la transacción para la aprobación del usuario. Si es aprobada, entonces se enviará la transacción.
![3.6](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.3/6.png)

# Demostración
Vamos a tomar el programa Ping de la última lección y construye una interfaz que permita a los usuarios aprobar una transacción que envía un ping al programa. Como recordatorio, la llave pública del programa es: **ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa** y la llave pública de la cuenta de datos es **Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod** .
![3.7](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.3/7.png)

## 1. Descarga la extensión del Navegador Phantom, y configúrala para DevNet
Si aún no lo tienes, descarga la [extensión de la wallet de phantom](https://phantom.app/download) . En el momento de escribir esto, admite los navegadores Chrome, Brave, Firefox y Edge, por lo que también necesitarás tener uno de esos navegadores instalado. Sigue las instrucciones de Phantom para crear una nueva cuenta y una nueva billetera.
Una vez que tengas una billetera, haz clic en el engranaje de configuración en la parte inferior derecha en la interfaz de usuario de Phantom. Desplázate hacia abajo y haz clic en el elemento "Cambiar red" y selecciona "Devnet". Esto garantiza que Phantom estará conectado a la misma red que usaremos en esta demostración.

## 2. Descarga el Código Inicial
Descarga el código inicial para este proyecto **aquí** . Este proyecto es una simple aplicación Next.js. Está en su mayoría vacía excepto por el componente **AppBar** . Construiremos el resto a lo largo de esta demostración.

Puedes ver su estado actual con el comando **npm run dev** en la consola.

## 3. Envuelve la aplicación en los Proveedores de Contexto
Para empezar, vamos a crear un nuevo componente para contener los diversos proveedores de Wallet-Adapter que usaremos. Crea un nuevo archivo dentro de la carpeta de **componentes** llamado **WalletContextProvider.tsx** .

Empecemos con algo de la plantilla de un componente funcional:

```JavaScript
import { FC, ReactNode } from 'react'

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {

    return (

    )
}

export default WalletContextProvider
```

Para conectarse correctamente a la billetera del usuario, necesitaremos un **ConnectionProvider** , **WalletProvider**  y **WalletModalProvider** . Comience importando estos componentes de **@solana/wallet-adapter-react** y **@solana/wallet-adapter-react-ui** . Luego, agrégalos al componente **WalletContextProvider** . Tenga en cuenta que **ConnectionProvider** requiere un parámetro **endpoint** y **WalletProvider** requiere un array de **billeteras** . Por ahora, solo usa una cadena vacía y una array vacía, respectivamente.

```JavaScript
import { FC, ReactNode } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {

    return (
        <ConnectionProvider endpoint={''}>
            <WalletProvider wallets={[]}>
                <WalletModalProvider>
                    { children }
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}

export default WalletContextProvider
```

Lo último que necesitamos es un endpoint actual para **ConnectionProvider** y las billeteras admitidas para **WalletProvider** .
Para el endpoint, utilizaremos la misma función **clusterApiUrl** de la biblioteca **@solana/web3.js** que hemos utilizado antes, por lo que necesitarás importarla. Para la matriz de billeteras, también necesitarás importar la biblioteca **@solana/wallet-adapter-wallets** .

Después de importar estas bibliotecas, crea una constante **endpoint** que utilice la función **clusterApiUrl** para obtener la url de Devnet. Luego, crea una constante **wallets** y establece una matriz que contenga un **PhantomWalletAdapter** recién construido. Finalmente, reemplaza la cadena vacía y la matriz vacía en **ConnectionProvider** y **WalletProvider** , respectivamente.
Para completar este componente, agrega **require('@solana/wallet-adapter-react-ui/styles.css')** ; debajo de tus importaciones para garantizar un estilo y comportamiento adecuado de los componentes de la biblioteca Wallet Adapter.

```JavaScript
import { FC, ReactNode } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import * as web3 from '@solana/web3.js'
import * as walletAdapterWallets from '@solana/wallet-adapter-wallets'
require('@solana/wallet-adapter-react-ui/styles.css')

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const endpoint = web3.clusterApiUrl('devnet')
    const wallets = [new walletAdapterWallets.PhantomWalletAdapter()]

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets}>
                <WalletModalProvider>
                    { children }
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}

export default WalletContextProvider
```


## 4. Agregar Wallet Multi-botón
A continuación, configuraremos el botón Conectar. El botón actual es solo un marcador de posición porque, en lugar de usar un botón estándar o crear un componente personalizado, utilizaremos el "multi-botón" de Wallet-Adapter. Este botón se comunica con los proveedores que configuramos en **WalletContextProvider** y permite a los usuarios elegir una billetera, conectarse a una billetera y desconectarse de una billetera. Si alguna vez necesitas más funcionalidad personalizada, puedes crear un componente personalizado para manejar esto.

Antes de agregar el "multi-botón", debemos envolver la aplicación en el **WalletContextProvider** . Hazlo importándolo en **index.tsx** y agregándolo después de la etiqueta **</Head>** de cierre:

```JavaScript
import { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import WalletContextProvider from '../components/WalletContextProvider'
import { AppBar } from '../components/AppBar'
import Head from 'next/head'
import { PingButton } from '../components/PingButton'

const Home: NextPage = (props) => {

    return (
        <div className={styles.App}>
            <Head>
                <title>Wallet-Adapter Ejemplo</title>
                <meta
                    name="description"
                    content="Wallet-Adapter Ejemplo"
                />
            </Head>
            <WalletContextProvider>
                <AppBar />
                <div className={styles.AppBody}>
                    <PingButton/>
                </div>
            </WalletContextProvider >
        </div>
    );
}

export default Home
```

Si ejecutas la aplicación, todo debería seguir siendo igual ya que el botón actual en la esquina superior derecha sigue siendo solo un marcador de posición. Para remediar esto, abre **AppBar.tsx** y reemplaza **<button>Connect</button>** con **<WalletMultiButton/>** . Necesitarás importar **WalletMultiButton** desde **@solana/wallet-adapter-react-ui** .

En este punto, deberías poder ejecutar la aplicación e interactuar con el botón multi en la esquina superior derecha de la pantalla. Ahora debería leer "Select Wallet" (Seleccionar billetera). Si tienes la extensión Phantom y estás conectado, deberías poder conectar tu billetera Phantom al sitio utilizando este nuevo botón.

## 5. Crear un botón para hacer Ping al Programa
¡Ahora que nuestra aplicación puede conectarse a la billetera Phantom, hagamos que el botón Ping! realmente haga algo.

Comience abriendo el archivo **PingButton.tsx** . Vamos a reemplazar el **console.log** dentro de **onClick** con código que creará una transacción y la enviará a la extensión Phantom para la aprobación del usuario final.

Primero, necesitamos una conexión, la llave pública de la billetera y la función **sendTransaction** de Wallet-Adapter. Para obtener esto, necesitamos importar **useConnection** y **useWallet** de **@solana/wallet-adapter-react** . Mientras estemos aquí, también importemos **@solana/web3.js** ya que lo necesitaremos para crear nuestra transacción.

```JavaScript
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import * as web3 from '@solana/web3.js'
import { FC, useState } from 'react'
import styles from '../styles/PingButton.module.css'

export const PingButton: FC = () => {

	const onClick = () => {
		console.log('Ping!')
	}

	return (
		<div className={styles.buttonContainer} onClick={onClick}>
			<button className={styles.button}>Ping!</button>
		</div>
	)
}
```

Ahora utiliza el gancho **useConnection** para crear una constante de **conexión** y el gancho **useWallet** para crear constantes **publicKey** y **sendTransaction** .

```JavaScript
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import * as web3 from '@solana/web3.js'
import { FC, useState } from 'react'
import styles from '../styles/PingButton.module.css'

export const PingButton: FC = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const onClick = () => {
        console.log('Ping!')
    }

    return (
        <div className={styles.buttonContainer} onClick={onClick}>
            <button className={styles.button}>Ping!</button>
        </div>
    )
}
```

Con eso, podemos completar el cuerpo de **onClick** .
Primero, comprueba que tanto la **conexión** como **publicKey** existen (si alguno de ellos no existe, la billetera del usuario aún no está conectada).

A continuación, construye dos instancias de **PublicKey** , una para el ID del programa **ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa** y otra para la cuenta de datos **Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod** .

A continuación, construye una **Transacción**, luego una nueva **instrucción de transacción** que incluye la cuenta de datos como una llave escribible.

A continuación, agrega la instrucción a la transacción.

Finalmente, llama a **sendTransaction** .

```JavaScript
const onClick = () => {
    if (!connection || !publicKey) { return }

    const programId = new web3.PublicKey(PROGRAM_ID)
    const  datosDeLaCuenta = new web3.PublicKey(DATA_ACCOUNT_PUBKEY)
    const transaccion = new web3.Transaction()

    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                pubkey: datosDeLaCuenta,
                isSigner: false,
                isWritable: true
            },
        ],
        programId
    });

    transaccion.add(instruction)
    sendTransaction(transaccion, connection).then(sig => {
        console.log(sig)
    })
}
```

¡Y eso es todo! Si actualizas la página, conectas tu billetera y haces clic en el botón ping, Phantom debería mostrarte una ventana emergente para confirmar la transacción.

## 6. Añade algunos detalles finos
Hay muchas cosas que podrías hacer para mejorar aún más la experiencia del usuario aquí. Por ejemplo, podrías cambiar la interfaz de usuario para que solo te muestre el botón Ping cuando esté conectada una billetera y muestra algún otro aviso en caso contrario. Podrías vincular a la transacción en Solana Explorer después de que un usuario confirme una transacción para que puedan ver fácilmente los detalles de la transacción. Cuanto más experimentes con ello, más cómodo te sentirás, ¡así que sé creativo!
Si necesitas pasar algún tiempo mirando el código fuente completo de esta demostración para entender todo esto en contexto, echa un vistazo [aquí!](https://github.com/Unboxed-Software/solana-ping-frontend) .
 
## Desafío

Ahora le toca a usted construir algo de forma independiente. Cree una aplicación que permita a un usuario conectar su billetera Phantom y enviar SOL a otra cuenta.


![3.8](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%201/images/1.3/8.png)

- Puedes construir esto desde cero o puedes descargar el código inicial [aquí](https://github.com/Unboxed-Software/solana-send-sol-frontend/tree/starter).
- Envuelva la aplicación inicial en los proveedores de contexto apropiados.
- En el componente de formulario, configure la transacción y envíela a la billetera del usuario para su aprobación.
- Sea creativo con la experiencia del usuario. ¡Agregue un enlace para que el usuario pueda ver la transacción en el Explorador Solana o algo más que le parezca interesante!
- Si realmente está atascado, no dude en consultar el código de solución [aquí](https://github.com/Unboxed-Software/solana-send-sol-frontend/tree/main).
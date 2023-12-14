---
title: Interactúa con los objetivos de Wallets
objectives:
- Explicar monederos
- Instalar extensión fantasma
- Establecer cartera fantasma en [Devnet](https://api.devnet.solana.com/)
- Utilice el adaptador de billetera para que los usuarios firmen transacciones
---

# TL;DR

-   **Carteras** almacenar su clave secreta y manejar la firma de transacciones seguras
-   **Carteras de hardware** almacenar su clave secreta en un dispositivo separado
-   **Carteras de software** utilice su ordenador para un almacenamiento seguro
-   Las billeteras de software a menudo **extensiones del navegador** facilitan la conexión a sitios web
-   Solana 's **Biblioteca de Wallet-Adapter** simplifica el soporte de extensiones de navegador de billetera, lo que le permite crear sitios web que pueden solicitar la dirección de la billetera de un usuario y proponer transacciones para que firmen

# Descripción general

## Carteras

En las dos lecciones anteriores discutimos los pares de claves. Los pares de claves se utilizan para localizar cuentas y firmar transacciones. Si bien la clave pública de un par de claves es perfectamente segura para compartir, la clave secreta siempre debe mantenerse en un lugar seguro. Si la clave secreta de un usuario está expuesta, entonces un actor malicioso podría drenar su cuenta de todos los activos y ejecutar transacciones con la autoridad de ese usuario.

Una “billetera” se refiere a cualquier cosa que almacene una clave secreta para mantenerla segura. Estas opciones de almacenamiento seguro generalmente se pueden describir como billeteras de "hardware" o "software". Las carteras de hardware son dispositivos de almacenamiento que están separados de su ordenador. Las carteras de software son aplicaciones que puede instalar en su (s) dispositivo(s) existente (s).

Las carteras de software a menudo vienen en forma de una extensión del navegador. Esto hace posible que los sitios web interactúen fácilmente con la billetera. Tales interacciones generalmente se limitan a:

1. Ver la clave pública de la billetera (dirección)
2. Enviar transacciones para la aprobación de un usuario
3. Enviar una transacción aprobada a la red

Una vez que se envía una transacción, el usuario final puede "confirmar" la transacción y enviarla a la red con su "firma".

La firma de transacciones requiere el uso de su clave secreta. Al permitir que un sitio envíe una transacción a su billetera y que la billetera se encargue de la firma, se asegura de que nunca exponga su clave secreta al sitio web. En su lugar, solo comparte la clave secreta con la aplicación de billetera.

A menos que esté creando una aplicación de billetera usted mismo, su código nunca debería necesitar pedirle a un usuario su clave secreta. En su lugar, puede pedir a los usuarios que se conecten a su sitio utilizando una billetera de buena reputación.

## Cartera fantasma

Una de las carteras de software más utilizadas en el ecosistema de Solana es[Phantom](https://phantom.app). Phantom es compatible con algunos de los navegadores más populares y tiene una aplicación móvil para conectarse sobre la marcha. Es probable que desee que sus aplicaciones descentralizadas admitan múltiples billeteras, pero este curso se centrará en Phantom.

## Adaptador de cartera de Solana

Wallet-Adapter de Solana es un conjunto de bibliotecas que puede usar para simplificar el proceso de admitir extensiones de navegador de billetera.

El adaptador de cartera de Solana comprende múltiples paquetes modulares. La funcionalidad principal se encuentra en `@solana/wallet-adapter-base` y `@solana/wallet-adapter-react`.

También hay paquetes que proporcionan componentes para marcos de interfaz de usuario comunes. En esta lección y a lo largo de este curso, usaremos componentes de `@solana/wallet-adapter-react-ui`.

Finalmente, hay paquetes que son adaptadores para billeteras específicas, incluido Phantom. Puede usar `@solana/wallet-adapter-wallets` para incluir todas las billeteras compatibles, o puede elegir un paquete de billetera específico como `@solana/wallet-adapter-phantom`.

### Instalar bibliotecas adaptadoras de billetera

Al añadir soporte de billetera a una aplicación de React existente, comienza instalando los paquetes apropiados. Necesitará `@solana/wallet-adapter-base`, `@solana/wallet-adapter-react`, el (los) paquete(s) para la (s) billetera(s) que desea soportar, y `@solana/wallet-adapter-react-ui` si planea usar los componentes de reacción proporcionados, p.

```
npm install @solana/wallet-adapter-base \
    @solana/wallet-adapter-react \
    @solana/wallet-adapter-phantom \
    @solana/wallet-adapter-react-ui
```

### Conectar a carteras

nos `@solana/wallet-adapter-react` permite persistir y acceder a los estados de conexión de la billetera a través de ganchos y proveedores de contexto, a saber:

-   `useWallet`
-   `WalletProvider`
-   `useConnection`
-   `ConnectionProvider`

Para que estos funcionen correctamente, cualquier uso de `useWallet` y `useConnection` debe estar envuelto en `WalletProvider` y `ConnectionProvider`. Una de las mejores maneras de garantizar esto es envolver toda su aplicación `ConnectionProvider` y `WalletProvider` :

```tsx
import { NextPage } from "next";
import { FC, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import * as web3 from "@solana/web3.js";

export const Home: NextPage = (props) => {
  const endpoint = web3.clusterApiUrl("devnet");
  const wallet = new PhantomWalletAdapter();

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[wallet]}>
        <p>Put the rest of your app here</p>
      </WalletProvider>
    </ConnectionProvider>
  );
};
```

Tenga en cuenta que `ConnectionProvider` requiere una `endpoint` propiedad y que `WalletProvider` requiere una `wallets` propiedad. Continuamos usando el punto final para el clúster Devnet, y por ahora solo estamos usando el `PhantomWalletAdapter` para `wallets`.

En este punto, puede conectarse con `wallet.connect()`, lo que instruirá efectivamente a la billetera para solicitar al usuario permiso para ver su clave pública y solicitar la aprobación de transacciones.

![Captura de pantalla del mensaje de conexión a la billetera](../../assets/wallet-connect-prompt.png)

Si bien puede hacer esto en un `useEffect` gancho, generalmente querrá proporcionar una funcionalidad más sofisticada. Por ejemplo, es posible que desee que los usuarios puedan elegir entre una lista de billeteras compatibles o desconectarse después de que ya se hayan conectado.

### `@solana/wallet-adapter-react-ui`

Puede crear componentes personalizados para esto, o puede aprovechar los componentes proporcionados por `@solana/wallet-adapter-react-ui`. La forma más sencilla de proporcionar opciones extensas es usar `WalletModalProvider` y `WalletMultiButton` :

```tsx
import { NextPage } from "next";
import { FC, ReactNode } from "react";
import {
    ConnectionProvider,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import {
    WalletModalProvider,
    WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import * as web3 from "@solana/web3.js";

const Home: NextPage = (props) => {
    const endpoint = web3.clusterApiUrl("devnet");
    const wallet = new PhantomWalletAdapter();

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={[wallet]}>
                <WalletModalProvider>
                    <WalletMultiButton />
                    <p>Put the rest of your app here</p>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default Home;
```

La funcionalidad `WalletModalProvider` añade para presentar una pantalla modal para que los usuarios seleccionen qué billetera les gustaría usar. El comportamiento `WalletMultiButton` cambia para que coincida con el estado de la conexión:

![Captura de pantalla de la opción de selección de billetera de varios botones](../../assets/multi-button-select-wallet.png)

![Captura de pantalla del modal Connect Wallet](../../assets/connect-wallet-modal.png)

![Captura de pantalla de las opciones de conexión de varios botones](../../assets/multi-button-connect.png)

![Captura de pantalla del estado conectado de varios botones](../../assets/multi-button-connected.png)

También puede utilizar componentes más granulares si necesita una funcionalidad más específica:

-   `WalletConnectButton`
-   `WalletModal`
-   `WalletModalButton`
-   `WalletDisconnectButton`
-   `WalletIcon`

### Acceder a la información de la cuenta

Una vez que su sitio esté conectado a una billetera, `useConnection` recuperará un `Connection` objeto y `useWallet` obtendrá la `WalletContextState`. `WalletContextState` tiene una propiedad `publicKey` que está `null` cuando no está conectada a una billetera y tiene la clave pública de la cuenta del usuario cuando se conecta una billetera. Con una clave pública y una conexión, puede obtener información de la cuenta y más.

```tsx
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { FC, useEffect, useState } from "react";

export const BalanceDisplay: FC = () => {
    const [balance, setBalance] = useState(0);
    const { connection } = useConnection();
    const { publicKey } = useWallet();

    useEffect(() => {
        if (!connection || !publicKey) {
            return;
        }

        connection.getAccountInfo(publicKey).then((info) => {
            setBalance(info.lamports);
        });
    }, [connection, publicKey]);

    return (
        <div>
            <p>
                {publicKey ? `Balance: ${balance / LAMPORTS_PER_SOL} SOL` : ""}
            </p>
        </div>
    );
};
```

### Enviar transacciones

`WalletContextState` también proporciona una `sendTransaction` función que puede usar para enviar transacciones para su aprobación.

```tsx
const { publicKey, sendTransaction } = useWallet();
const { connection } = useConnection();

const sendSol = (event) => {
    event.preventDefault();

    const transaction = new web3.Transaction();
    const recipientPubKey = new web3.PublicKey(event.target.recipient.value);

    const sendSolInstruction = web3.SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: recipientPubKey,
        lamports: LAMPORTS_PER_SOL * 0.1,
    });

    transaction.add(sendSolInstruction);
    sendTransaction(transaction, connection).then((sig) => {
        console.log(sig);
    });
};
```

Cuando se llama a esta función, la billetera conectada mostrará la transacción para la aprobación del usuario. Si se aprueba, se enviará la transacción.

![Captura de pantalla del aviso de aprobación de transacción de billetera](../../assets/wallet-transaction-approval-prompt.png)

# Demostración

Tomemos el programa Ping de la última lección y construyamos una interfaz que permita a los usuarios aprobar una transacción que haga ping al programa. Como recordatorio, la clave pública del programa es `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa` y la clave pública de la cuenta de datos es `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

![Captura de pantalla de la aplicación Solana Ping](../../assets/solana-ping-app.png)

### 1. Descargue la extensión del navegador Phantom y configúrela en Devnet

Si aún no lo tienes, descarga el[Extensión del navegador fantasma](https://phantom.app/download). Al momento de escribir, es compatible con los navegadores Chrome, Brave, Firefox y Edge, por lo que también necesitará tener uno de esos navegadores instalado. Siga las instrucciones de Phantom para crear una nueva cuenta y una nueva billetera.

Una vez que tenga una billetera, haga clic en el engranaje de configuración en la parte inferior derecha en la interfaz de usuario fantasma. Desplácese hacia abajo y haga clic en el elemento de línea "Cambiar red" y seleccione "Devnet. Esto asegura que Phantom estará conectado a la misma red que usaremos en esta demo.

### 2. Descarga el código de inicio

Descargue el código de inicio para este proyecto[here](https://github.com/Unboxed-Software/solana-ping-frontend/tree/starter). Este proyecto es una sencilla aplicación Next.js. En su mayoría está vacío, excepto por el `AppBar` componente. Vamos a construir el resto a lo largo de esta demo.

Puede ver su estado actual con el comando `npm run dev` en la consola.

### 3. Envuelva la aplicación en proveedores de contexto

Para empezar, vamos a crear un nuevo componente que contenga los diversos proveedores de adaptadores de billetera que usaremos. Cree un nuevo archivo dentro de la `components` carpeta llamada `WalletContextProvider.tsx`.

Comencemos con algunas de las calderas para un componente funcional:

```tsx
import { FC, ReactNode } from 'react'

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {

    return (

    )
}

export default WalletContextProvider
```

Para conectarse correctamente a la billetera del usuario, necesitaremos un `ConnectionProvider`, `WalletProvider` y `WalletModalProvider`. Comience por importar estos componentes desde `@solana/wallet-adapter-react` y `@solana/wallet-adapter-react-ui`. Añádelos al `WalletContextProvider` componente. Tenga en cuenta que `ConnectionProvider` requiere un `endpoint` parámetro y `WalletProvider` requiere una matriz de `wallets`. Por ahora, solo use una cadena vacía y una matriz vacía, respectivamente.

```tsx
import { FC, ReactNode } from "react";
import {
    ConnectionProvider,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <ConnectionProvider endpoint={""}>
            <WalletProvider wallets={[]}>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
```

Las últimas cosas que necesitamos son un punto final real `ConnectionProvider` y las carteras compatibles `WalletProvider`.

Para el punto final, usaremos la misma `clusterApiUrl` función de la `@solana/web3.js` biblioteca que hemos usado antes, por lo que deberá importarla. Para la variedad de billeteras, también deberá importar la `@solana/wallet-adapter-wallets` biblioteca.

Después de importar estas bibliotecas, cree una constante `endpoint` que use la `clusterApiUrl` función para obtener la URL de Devnet. Luego cree una constante `wallets` y configúrela en una matriz que contenga una nueva construcción `PhantomWalletAdapter`. Finalmente, reemplace la cadena vacía y la matriz vacía en `ConnectionProvider` y `WalletProvider`, respectivamente.

Para completar este componente, agregue a `require('@solana/wallet-adapter-react-ui/styles.css');` continuación sus importaciones para garantizar el estilo y el comportamiento adecuados de los componentes de la biblioteca del adaptador de billetera.

```tsx
import { FC, ReactNode } from "react";
import {
    ConnectionProvider,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import * as web3 from "@solana/web3.js";
import * as walletAdapterWallets from "@solana/wallet-adapter-wallets";
require("@solana/wallet-adapter-react-ui/styles.css");

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const endpoint = web3.clusterApiUrl("devnet");
    const wallets = [new walletAdapterWallets.PhantomWalletAdapter()];

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets}>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
```

### 4. Añadir botón múltiple de monedero

A continuación vamos a configurar el botón Conectar. El botón actual es solo un marcador de posición porque, en lugar de usar un botón estándar o crear un componente personalizado, usaremos el botón múltiple de Wallet-Adapter. Este botón interactúa con los proveedores que configuramos `WalletContextProvider` y permite a los usuarios elegir una billetera, conectarse a una billetera y desconectarse de una billetera. Si alguna vez necesita más funcionalidad personalizada, puede crear un componente personalizado para manejar esto.

Antes de añadir el "botón múltiple", tenemos que envolver la aplicación en el `WalletContextProvider`. Haga esto importándolo `index.tsx` y añadiéndolo después de la `</Head>` etiqueta de cierre:

```tsx
import { NextPage } from "next";
import styles from "../styles/Home.module.css";
import WalletContextProvider from "../components/WalletContextProvider";
import { AppBar } from "../components/AppBar";
import Head from "next/head";
import { PingButton } from "../components/PingButton";

const Home: NextPage = (props) => {
    return (
        <div className={styles.App}>
            <Head>
                <title>Wallet-Adapter Example</title>
                <meta name="description" content="Wallet-Adapter Example" />
            </Head>
            <WalletContextProvider>
                <AppBar />
                <div className={styles.AppBody}>
                    <PingButton />
                </div>
            </WalletContextProvider>
        </div>
    );
};

export default Home;
```

Si ejecuta la aplicación, todo debería seguir siendo igual, ya que el botón actual en la parte superior derecha sigue siendo solo un marcador de posición. Para remediar esto, abra `AppBar.tsx` y reemplace `<button>Connect</button>` con `<WalletMultiButton/>`. Tendrás que importar `WalletMultiButton` desde `@solana/wallet-adapter-react-ui`.

```tsx
import { FC } from "react";
import styles from "../styles/Home.module.css";
import Image from "next/image";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export const AppBar: FC = () => {
    return (
        <div className={styles.AppHeader}>
            <Image src="/solanaLogo.png" height={30} width={200} />
            <span>Wallet-Adapter Example</span>
            <WalletMultiButton />
        </div>
    );
};
```

En este punto, debería poder ejecutar la aplicación e interactuar con el botón múltiple en la parte superior derecha de la pantalla. Ahora debería decir: "Selecciona Wallet. Si tiene la extensión Phantom y ha iniciado sesión, debería poder conectar su billetera Phantom al sitio utilizando este nuevo botón.

### 5. Crear botón para el programa de ping

Ahora que nuestra aplicación puede conectarse a la billetera Phantom, hagamos que el botón "¡Ping!" realmente haga algo.

Empieza abriendo el `PingButton.tsx` archivo. Vamos a reemplazar el `console.log` interior de `onClick` con el código que creará una transacción y enviarlo a la extensión Phantom para la aprobación del usuario final.

Primero, necesitamos una conexión, la clave pública de la billetera y la `sendTransaction` función Wallet-Adapter. Para obtener esto, necesitamos importar `useConnection` y `useWallet` desde `@solana/wallet-adapter-react`. Mientras estamos aquí, también vamos a importar, `@solana/web3.js` ya que lo necesitaremos para crear nuestra transacción.

```tsx
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import * as web3 from "@solana/web3.js";
import { FC, useState } from "react";
import styles from "../styles/PingButton.module.css";

export const PingButton: FC = () => {
    const onClick = () => {
        console.log("Ping!");
    };

    return (
        <div className={styles.buttonContainer} onClick={onClick}>
            <button className={styles.button}>Ping!</button>
        </div>
    );
};
```

Ahora use el `useConnection` gancho para crear una `connection` constante y el `useWallet` gancho para crear `publicKey` y `sendTransaction` constantes.

```tsx
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import * as web3 from "@solana/web3.js";
import { FC, useState } from "react";
import styles from "../styles/PingButton.module.css";

export const PingButton: FC = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const onClick = () => {
        console.log("Ping!");
    };

    return (
        <div className={styles.buttonContainer} onClick={onClick}>
            <button className={styles.button}>Ping!</button>
        </div>
    );
};
```

Con eso, podemos rellenar el cuerpo de `onClick`.

Primero, verifique que ambos `connection` y `publicKey` existan (si cualquiera de los dos no lo hace, entonces la billetera del usuario aún no está conectada).

A continuación, construya dos instancias de `PublicKey`, una para el ID del programa `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa` y otra para la cuenta de datos `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

A continuación, construya una `Transaction`, luego una nueva `TransactionInstruction` que incluya la cuenta de datos como una clave escribible.

A continuación, añada la instrucción a la transacción.

Por último, llame `sendTransaction`.

```tsx
const onClick = () => {
    if (!connection || !publicKey) {
        return;
    }

    const programId = new web3.PublicKey(PROGRAM_ID);
    const programDataAccount = new web3.PublicKey(DATA_ACCOUNT_PUBKEY);
    const transaction = new web3.Transaction();

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

    transaction.add(instruction);
    sendTransaction(transaction, connection).then((sig) => {
        console.log(sig);
    });
};
```

¡Y eso es todo! Si actualiza la página, conecta su billetera y hace clic en el botón de ping, Phantom debería presentarle una ventana emergente para confirmar la transacción.

### 6. Añadir un poco de pulido alrededor de los bordes

Hay muchas cosas que puedes hacer para que la experiencia del usuario sea aún mejor. Por ejemplo, puede cambiar la interfaz de usuario para que solo le muestre el botón Ping cuando se conecta una billetera y mostrar otro mensaje. Puede vincularse a la transacción en Solana Explorer después de que un usuario confirme una transacción para que pueda ver fácilmente los detalles de la transacción. Cuanto más experimente con él, más cómodo se sentirá, ¡así que sea creativo!

Si necesitas pasar algún tiempo mirando el código fuente completo de esta demostración para entender todo esto en contexto, compruébalo[here](https://github.com/Unboxed-Software/solana-ping-frontend).

# Desafío

Ahora es tu turno de construir algo de forma independiente. Cree una aplicación que permita a un usuario conectar su billetera Phantom y enviar SOL a otra cuenta.

![Captura de pantalla de la aplicación Send Sol](../../assets/solana-send-sol-app.png)

1. Puede construir esto desde cero o puede descargar el código de inicio[here](https://github.com/Unboxed-Software/solana-send-sol-frontend/tree/starter).
2. Envuelva la aplicación de inicio en los proveedores de contexto apropiados.
3. En el componente de formulario, configure la transacción y envíela a la billetera del usuario para su aprobación.
4. Sea creativo con la experiencia del usuario. Agregue un enlace para permitir que el usuario vea la transacción en Solana Explorer o algo más que le parezca genial.

Si se queda realmente perplejo, no dude en consultar el código de la solución[here](https://github.com/Unboxed-Software/solana-send-sol-frontend/tree/main).

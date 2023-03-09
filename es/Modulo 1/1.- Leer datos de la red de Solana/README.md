# Leer datos de la red Solana
## Objetivos de la lección
*Al final de esta lección, podrás:*

- Explicar cuentas
- Explicar SOL y lamports
- Explicar las llaves públicas
- Explicar la API JSON RPC
- Explicar web3.js
- Instalar web3.js
- Usar web3.js para crear una conexión con un nodo de Solana
- Usar web3.js para leer datos de la cadena de bloques (saldo, información de la cuenta, etc.)

## TL;DR
- **Las cuentas** son como los archivos en el libro mayor de la red de Solana. Todos los datos de estado se almacenan en una cuenta. Las cuentas se pueden usar para muchas cosas, pero por ahora nos centraremos en el aspecto de las cuentas que almacenan SOL.

- **SOL** es el nombre del token nativo de Solana.

- **Los Lamports** son SOL fraccionarios y están nombrados en honor a Leslie Lamport.

- **Las llaves públicas**, a menudo conocidas como direcciones, apuntan a las cuentas en la red de Solana. Aunque debe tener una clave secreta específica para realizar ciertas funciones dentro de las cuentas, cualquier persona puede leer los datos de la cuenta con una clave pública.

- **API JSON RPC**: todas las interacciones con la red de Solana ocurren a través de la API JSON RPC. Esto es efectivamente un POST HTTP con un cuerpo JSON que representa el método que desea llamar.

- **@solana/web3.js** es una abstracción sobre la API JSON RPC. Se puede instalar con npm y permite llamar a los métodos de Solana como funciones de JavaScript. Por ejemplo, puedes usarlo para consultar el saldo de SOL de cualquier cuenta.

```JavaScript
async function obtenerBalanceUsandoWeb3(llavePublica: llavePublica): Promise<number> {
    const conexion = new conexion(clusterApiUrl('devnet'));
    return conexion.getBalance(llavePublica);
}

const llavePublica = new llavePublica('7C4jsPZpht42Tw6MjXWF56Q5RQUocjBBmciEjDa8HRtp')
obtenerBalanceUsandoWeb3(llavePublica).then(balance => {
    console.log(balance)
})
```

## Resumen
### Cuentas
Las cuentas de Solana son similares a los archivos en sistemas operativos como Linux. Contienen datos arbitrarios y persistentes y son lo suficientemente flexibles como para ser utilizados de muchas maneras diferentes.

En esta lección no consideraremos mucho más allá de la capacidad de las cuentas para almacenar SOL (el token nativo de Solana - más sobre eso más tarde). Sin embargo, las cuentas también se utilizan para almacenar estructuras de datos personalizadas y código ejecutable que se pueden ejecutar como programas. Las cuentas estarán involucradas en todo lo que haga con Solana.

### Llaves públicas
Las llaves públicas a menudo se refieren como direcciones. Las direcciones apuntan a las cuentas en la red de Solana. Si desea ejecutar un programa específico o transferir SOL, deberá proporcionar la clave pública necesaria (o claves) para hacerlo.

Las llaves públicas son de 256 bits y a menudo se muestran como cadenas codificadas en base-58 como ***7C4jsPZpht42Tw6MjXWF56Q5RQUocjBBmciEjDa8HRtp***.

## Solana JSON RPC API

<!-- Image here -->
![1.1](https://github.com/blockchainBS-team/etherfuse-course/blob/main/Modulo%201/images/1.1/1json-rpc-ilustracion.png)

Toda la interacción del cliente con la red Solana se realiza a través de la API JSON RPC de Solana. 

> "JSON-RPC es un protocolo de llamada remota (RPC) ligero y sin estado. Principalmente, esta especificación define varias estructuras de datos y las reglas para su procesamiento. Es independiente del transporte ya que los conceptos se pueden utilizar dentro del mismo proceso, a través de sockets, HTTP y en muchos entornos de comunicación. Utiliza JSON (RFC 4627) como formato de datos." - JSON-RPC 2.0

En la práctica, esta especificación simplemente implica enviar un objeto JSON que representa el método que desea llamar. Puede hacerlo con sockets, HTTP y más.

Este objeto JSON necesita cuatro miembros:

- **jsonrpc** - El número de versión de JSON RPC. Tiene que ser exactamente "2.0".
- **id** - Un identificador que elige para identificar la llamada. Puede ser una cadena o un número entero.
- **method** - El nombre del método que desea invocar.
- **params** - Una matriz que contiene los parámetros a utilizar durante la invocación del método.

Entonces, si quiere llamar al método **getBalance** en la red Solana, podría enviar una llamada HTTP a un clúster de Solana de la siguiente manera:

```JavaScript
async function obtenerBalanceUsandoJSONRPC(llavePublica: string): Promise<number> {
    const url = clusterApiUrl('devnet')
    console.log(url);
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [
                llavePublica
            ]
        })
    }).then(respuesta => respuesta.json())
    .then(json => {
        if (json.error) {
            throw json.error
        }

        return json['result']['value'] as number;
    })
    .catch(error => {
        throw error
    })
}
```

## SDK de Solana Web3.js
Mientras que la API JSON-RPC es lo suficientemente simple, implica una cantidad significativa de código repetitivo. Para simplificar el proceso de comunicación, Solana Labs creó la SDK **@solana/web3.js** como una abstracción encima de la API JSON-RPC.

Web3.js le permite llamar los métodos de la API JSON-RPC mediante funciones de JavaScript. La SDK proporciona una suite de funciones y objetos de ayuda. Cubriremos gran parte de la SDK gradualmente a lo largo de este curso, pero no entraremos en detalle en todo, así que asegúrese de revisar la [documentación](https://docs.solana.com/developing/clients/javascript-reference) en algún momento.

### Instalación
A lo largo de este curso, principalmente usaremos npm. Cómo usar npm está fuera del alcance de este curso y asumiremos que es una herramienta que usa regularmente. [Eche un vistazo](https://nodesource.com/blog/an-absolute-beginners-guide-to-using-npm/) a esto si ese no es el caso.

Para instalar **@solana/web3.js**, configure su proyecto de la manera habitual y luego use:

**npm install @solana/web3.js**.

### Conectar a la red

Cada interacción con la red Solana utilizando **@solana/web3.js** va a suceder a través de un objeto de conexión. Este objeto establece una *conexión* JSON-RPC con un clúster de Solana (más sobre los clústeres más tarde). Por ahora, vamos a usar la URL para el clúster Devnet en lugar de Mainnet. Como su nombre indica, este clúster está diseñado para el uso y prueba de los desarrolladores.

```JavaScript
const conexion = new conexion(clusterApiUrl('devnet'));
```

## Leer desde la red
Una vez que tienes un objeto de *conexión*, consultar la red es tan simple como llamar los métodos apropiados. Por ejemplo, para obtener el saldo de una dirección específica, haces lo siguiente:

```JavaScript
async function obtenerBalanceUsandoWeb3(llavePublica: PublicKey): Promise<number> {
    const conexion = new conexion(clusterApiUrl('devnet'));
    return conexion.getBalance(llavePublica);
}
```

El saldo devuelto está en fracciones de SOL llamadas lamports. Un solo lamport representa 0.000000001 SOL. La mayoría de las veces, al tratar con SOL, el sistema utilizará lamports en lugar de SOL. Web3.js proporciona la constante **LAMPORTS_PER_SOL** para hacer conversiones rápidas.

...y así de fácil, ¡ahora sabes cómo leer datos de la cadena de bloques de Solana! Una vez que entremos en los datos personalizados, las cosas se volverán más complicadas. Pero por ahora, practiquemos lo que hemos aprendido hasta ahora.

# Demo

Creemos un sitio web sencillo que permita a los usuarios verificar el saldo en una dirección específica.

Será algo así:

<!-- Image here -->
![1.2](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%201/images/1.1/2into-fronted-demo.png)

Para mantenernos en el tema, no trabajaremos completamente desde cero. Puedes encontrar el código inicial [aquí](https://github.com/Unboxed-Software/solana-intro-frontend/tree/starter). El proyecto inicial utiliza Next.js y Typescript. Si estás acostumbrado a una pila diferente, ¡no te preocupes! Los principios de web3 y Solana que aprenderás a lo largo de estas lecciones son aplicables a cualquier pila de frontend con la que te sientas más cómodo.

### 1. Orientarse
Una vez que tengas el código inicial, echa un vistazo. Instala las dependencias con npm install y luego ejecuta la aplicación con npm run dev. Observa que, independientemente de lo que pongas en el campo de dirección, cuando hagas clic en "Check SOL Balance", el saldo será un valor de lugar de 1000.
Estructuralmente, la aplicación está compuesta por index.tsx y AddressForm.tsx. Cuando un usuario envía el formulario, se llama al addressSubmittedHandler en index.tsx. Ahí es donde agregaremos la lógica para actualizar el resto de la interfaz de usuario.

### 2. Instalar dependencias
Utilice npm install @solana/web3.js para instalar nuestra dependencia en la biblioteca Web3 de Solana.

### 3. Establecer el saldo de la dirección
Primero, importe @solana/web3.js en la parte superior de index.tsx.

Ahora que la biblioteca está disponible, vamos al addressSubmittedHandler y creamos una instancia de PublicKey utilizando el valor de la dirección del campo de entrada del formulario. A continuación, creamos una instancia de Connection y la utilizamos para llamar a getBalance. Pasar en el valor de la clave pública que acabamos de crear. Finalmente, llame a setBalance, pasando el resultado de getBalance. Si está listo, intente esto independientemente en lugar de copiar desde el fragmento de código a continuación.

```JavaScript
import type { NextPage } from 'next'
import { useState } from 'react'
import styles from '../styles/Home.module.css'
import AddressForm from '../components/AddressForm'
import * as Web3 from '@solana/web3.js'

const Home: NextPage = () => {
  const [balance, setBalance] = useState(0)
  const [llavePublica, setAddress] = useState('')

  const manipuladorDeLlaveAlEnviar = (llavePublica: string) => {
    setAddress(llavePublica)
    const llave = new Web3.PublicKey(llavePublica)
    const conexion = new Web3.Connection(Web3.clusterApiUrl('devnet'))
    conexion.getBalance(llave).then(balance => {
      setBalance(balance / Web3.LAMPORTS_PER_SOL)
    })
  }

...

}
```

Observa que estamos tomando el saldo devuelto por Solana y dividiéndolo por **LAMPORTS_PER_SOL**. Los lamports son SOL fraccionales (0.000000001 SOL). La mayoría de las veces, al tratar con SOL, el sistema utilizará lamports en lugar de SOL. En este caso, el saldo devuelto por la red está en lamports. Antes de establecerlo en nuestro estado, lo convertimos en SOL utilizando la constante **LAMPORTS_PER_SOL**.

En este punto, deberías ser capaz de poner una dirección válida en el campo del formulario y hacer clic en "Check SOL Balance" para ver tanto la dirección como el saldo que se popula a continuación.

### 4. Manejar direcciones inválidas

Estamos casi listos. El único problema restante es que al usar una dirección inválida no se muestra ningún mensaje de error o cambia el saldo mostrado. Si abres la consola del desarrollador, verás el error "Error: entrada de clave pública no válida". Al utilizar el constructor PublicKey, es necesario pasar una dirección válida o obtendrás este error.

Para solucionar esto, envolveremos todo en un bloque try-catch y alertaremos al usuario si su entrada es inválida.

```JavaScript
const manipuladorDeLlaveAlEnviar = (llavePublica: string) => {
  try {
    setAddress(llavePublica)
    const key = new Web3.PublicKey(llavePublica)
    const conexion = new Web3.Connection(Web3.clusterApiUrl('devnet'))
    conexion.getBalance(key).then(balance => {
      setBalance(balance / Web3.LAMPORTS_PER_SOL)
    })
  } catch (error) {
    setAddress('')
    setBalance(0)
    alert(error)
  }
}
```

Ten en cuenta que en el bloque catch también limpiamos la dirección y el saldo para evitar confusiones.

¡Lo hicimos! Tenemos un sitio funcional que lee saldos SOL de la red Solana. Estás bien encaminado para lograr tus grandes ambiciones en Solana. Si necesitas pasar más tiempo mirando este código para entenderlo mejor, echa un vistazo al [código de solución completo](https://github.com/Unboxed-Software/solana-intro-frontend). Aferrate fuerte, estas lecciones aumentarán rápidamente. 

## Desafió

Ya que este es el primer desafío, lo mantendremos sencillo. Adelante y agregue a la interfaz de usuario que ya hemos creado, incluyendo un ítem de línea después de "Balance". Haga que el ítem de línea muestre si la cuenta es o no una cuenta ejecutable. Pista: hay un método getAccountInfo.

Su dirección de billetera estándar no será ejecutable, por lo que si desea una dirección que sea ejecutable para pruebas, utilice CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN.


![1.3](https://raw.githubusercontent.com/blockchainBS-team/etherfuse-course/main/Modulo%201/images/1.1/3into-fronted-challenge.png)

Si se atasca, no dude en mirar el [código de solución](https://github.com/Unboxed-Software/solana-intro-frontend/tree/challenge-solution).
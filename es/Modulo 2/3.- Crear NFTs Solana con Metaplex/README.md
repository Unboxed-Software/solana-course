# Crear NFTs Solana con Metaplex
## Objetivos de la lección
*Al final de esta lección, podrá:*
- Explicar los NFT y cómo se representan en la red de Solana
- Explicar el papel de Metaplex en el ecosistema de NFT de Solana
- Crear y actualizar NFTs utilizando el SDK de Metaplex
- Explicar la funcionalidad básica del programa Token Metadata, el programa Candy Machine y la CLI Sugar como herramientas que ayudan en la creación y distribución de NFTs en Solana.

# Terminología
- Los **Tokens No Fungibles (NFTs)** se representan en Solana como Tokens SPL con una cuenta de metadatos asociada, 0 decimales y un suministro máximo de 1. 
- **Metaplex** ofrece una colección de herramientas que simplifican la creación y distribución de NFTs en la cadena de bloques de Solana. 
- El programa **Token Metadata** estandariza el proceso de adjuntar metadatos a los Tokens SPL. 
- El **SDK de Metaplex** es una herramienta que ofrece APIs fáciles de usar para ayudar a los desarrolladores a utilizar las herramientas en cadena proporcionadas por Metaplex.
- El programa **Candy Machine** es una herramienta de distribución de NFTs utilizada para crear y acuñar NFTs a partir de una colección.
- **Sugar CLI** es una herramienta que simplifica el proceso de subir archivos de medios/metadatos y crear una Candy Machine para una colección.


# Resumen
Los tokens no fungibles (NFTs) de Solana son tokens SPL creados utilizando el Programa de Tokens. Sin embargo, estos tokens también tienen una cuenta de metadatos adicional asociada con cada acuñación de token. Esto permite una gran variedad de usos para los tokens. Puede tokenizar efectivamente cualquier cosa, desde el inventario de un juego hasta el arte.

En esta lección, cubriremos los conceptos básicos de cómo los NFTs se representan en Solana, cómo crearlos y actualizarlos utilizando el SDK de Metaplex, y proporcionaremos una breve introducción a las herramientas que pueden ayudarlo a crear y distribuir NFTs en Solana a gran escala.
 
## NFTs en Solana
Un NFT de Solana es un token no divisible con metadatos asociados que proviene de una acuñación de tokens con un suministro máximo de 1. 
Vamos a desglosar eso un poco. Un NFT es un token estándar del Programa de Tokens, pero difiere de lo que puedes pensar que un “Token Estandar” es. Lo que lo hace único es que:
 
1. Tiene 0 decimales para que no pueda dividirse en partes
2. Viene de una acuñación de tokens con un suministro de 1 para que solo exista 1 de estos tokens.
3. Viene de una acuñación de tokens cuyo autoridad se establece en **null** (para garantizar que el suministro nunca cambie)
4. Tiene una cuenta asociada que almacena metadatos.
Aunque los primeros tres puntos son características estándar que se pueden lograr con el Programa de Tokens SPL, los metadatos asociados requieren alguna funcionalidad adicional.

Por lo general, los metadatos de un NFT tienen un componente tanto en-cadena como fuera de la cadena. Los metadatos en-cadena se almacenan en una cuenta asociada a la acuñación de tokens y contiene un atributo URI que apunta a un archivo JSON fuera de la cadena. El componente fuera de la cadena almacena datos adicionales y un enlace a la imagen. Sistemas de almacenamiento de datos permanentes como Arweave a menudo se utilizan para almacenar el componente fuera de la cadena de los metadatos de NFT.

A continuación se muestra un ejemplo de la relación entre los metadatos en-cadena y fuera de la cadena. Los metadatos en-cadena contienen un campo URI que apunta a un archivo **.json** fuera de la cadena que almacena el enlace a la imagen del NFT y los metadatos adicionales.



![2.3](https://soldev.app/assets/solana-nft-metaplex-metadata.png)



## Metaplex
**Metaplex** es una organización que proporciona una suite de herramientas, como el [SDK de Metaplex](https://docs.metaplex.com/sdks/js/) , que simplifican la creación y distribución de NFT en la cadena de bloques de Solana. Estas herramientas se adaptan a una amplia gama de usos y te permiten gestionar fácilmente todo el proceso de creación y acuñado de una colección de NFT.

En específico, el SDK de Metaplex está diseñado para ayudar a los desarrolladores a utilizar las herramientas en cadena ofrecidas por Metaplex. Ofrece una API fácil de usar que se centra en los usos más populares y permite una fácil integración con complementos de terceros. Para obtener más información sobre las capacidades del SDK de Metaplex, puedes consultar la documentación **README**.

Uno de los programas esenciales ofrecidos por Metaplex es el programa Token Metadata. El programa Token Metadata estandariza el proceso de adjuntar metadatos a los Tokens SPL. Al crear un NFT con Metaplex, el programa Token Metadata crea una cuenta de metadatos utilizando una dirección derivada del programa (PDA) con la acuñación del token como semilla. Esto permite que la cuenta de metadatos de cualquier NFT se ubique de manera determinística utilizando la dirección de la acuñación del token. Para obtener más información sobre el programa Token Metadata, puedes consultar la [documentación](https://docs.metaplex.com/programs/token-metadata/) de Metaplex.

En las siguientes secciones, cubriremos los conceptos básicos de utilizar el SDK de Metaplex para preparar activos, crear NFT, actualizar NFT y asociar un NFT con una colección más amplia.


### Instancia de Metaplex
Una instancia de **Metaplex** sirve como punto de entrada para acceder a las API del SDK de Metaplex. Esta instancia acepta una conexión utilizada para comunicarse con el clúster. Además, los desarrolladores pueden personalizar las interacciones del SDK especificando un "Identity Driver" y un "Storage Driver".

El Identity Driver es en esencia un par de claves que se puede utilizar para firmar transacciones, un requisito al crear un NFT. El Storage Driver se utiliza para especificar el servicio de almacenamiento que desea utilizar para cargar activos. El controlador **bundlrStorage** es la opción predeterminada y carga activos en Arweave, un servicio de almacenamiento permanente y descentralizado.

A continuación se presenta un ejemplo de cómo configurar la instancia de **Metaplex** para devnet.

```JavaScript
import {
    Metaplex,
    keypairIdentity,
    bundlrStorage,
} from "@metaplex-foundation/js";
import { Connection, clusterApiUrl, Keypair } from "@solana/web3.js";

const conexion = new Connection(clusterApiUrl("devnet"));
const billetera = Keypair.generate();

const metaplex = Metaplex.make(conexion)
    .use(keypairIdentity(billetera))
    .use(
        bundlrStorage({
            address: "https://devnet.bundlr.network",
            providerUrl: "https://api.devnet.solana.com",
            timeout: 60000,
        }),
    );
```

### Cargar activos
Antes de poder crear un NFT, es necesario preparar y cargar cualquier activo que planeas asociar con el NFT. Aunque esto no tiene que ser una imagen, la mayoría de los NFTs tienen una imagen asociada a ellos.

Preparar y cargar una imagen implica convertir la imagen en un buffer, convertirla al formato Metaplex utilizando la función **toMetaplexFile** , y finalmente cargarla en el Storage Driver designado.
 
El SDK de Metaplex admite la creación de un nuevo archivo Metaplex a partir de archivos presentes en tu computadora local o aquellos cargados por un usuario a través de un navegador. Puedes hacer lo primero utilizando **fs.readFileSync** para leer el archivo de imagen, luego convertirlo en un archivo Metaplex utilizando **toMetaplexFile** . Finalmente, utilice su instancia de **Metaplex** para llamar a **storage().upload(archivo)** para cargar el archivo. El valor de retorno de la función será la URI donde se almacenó la imagen.

```JavaScript
const buffer = fs.readFileSync("/path/to/image.png");
const archivo = toMetaplexFile(buffer, "image.png");

const uriDeImagen = await metaplex.storage().upload(archivo);
```
 
### Cargar metadatos
Después de cargar una imagen, es hora de cargar los metadatos JSON fuera de la cadena utilizando la función **nfts().uploadMetadata** . Esto devolverá una URI donde se almacena el metadato JSON.

Recuerda, la parte fuera de la cadena del metadato incluye cosas como la URI de la imagen, así como información adicional como el nombre y la descripción del NFT. Aunque técnicamente puedes incluir cualquier cosa que desees en este objeto JSON, en la mayoría de los casos debes seguir el **estándar NFT** para garantizar la compatibilidad con monederos, programas y aplicaciones.

Para crear los metadatos, utilice el método **uploadMetadata** proporcionado por el SDK. Este método acepta un objeto de metadatos y devuelve una URI que apunta a los metadatos cargados.

```JavaScript
const { uri } = await metaplex.nfts().uploadMetadata({
    name: "My NFT",
    description: "My description",
    image: uriDeImagen,
});
```

## Crear NFT
Después de cargar los metadatos del NFT, finalmente puedes crear el NFT en la red. El método **create** del SDK de Metaplex te permite crear un nuevo NFT con una configuración mínima. Este método manejará la creación de la cuenta de acuñación, la cuenta de token, la cuenta de metadatos y la cuenta de edición principal para ti. Los datos proporcionados a este método representarán la parte de la cadena de los metadatos del NFT. Puedes explorar el SDK para ver toda la otra entrada que se puede proporcionar opcionalmente a este método. 

```JavaScript
const { nft } = await metaplex.nfts().create(
    {
        uri: uri,
        name: "My NFT",
        sellerFeeBasisPoints: 0,
    },
    { commitment: "finalized" },
);
```

Este método devuelve un objeto que contiene información sobre el NFT recién creado. De forma predeterminada, el SDK establece la propiedad **isMutable** en true, lo que permite realizar actualizaciones en los metadatos del NFT. Sin embargo, puede elegir establecer **isMutable** en false, lo que hace que los metadatos del NFT sean inmutables.


## Actualizar NFT
Si ha dejado **isMutable** como true, es posible que tenga una razón para actualizar los metadatos de su NFT. El método de **actualización** del SDK le permite actualizar tanto la parte de cadena y fuera de cadena de los metadatos del NFT. Para actualizar los metadatos fuera de cadena, deberá repetir los pasos de cargar una nueva imagen y la URI de metadatos según se describe en los pasos anteriores, y luego proporcionar la nueva URI de metadatos a este método. Esto cambiará la URI a la que apuntan los metadatos en cadena, actualizando efectivamente los metadatos fuera de cadena también.

```JavaScript
const nft = await metaplex.nfts().findByMint({ mintAddress });

const { response } = await metaplex.nfts().update(
    {
        nftOrSft: nft,
        name: "Updated Name",
        uri: uri,
        sellerFeeBasisPoints: 100,
    },
    { commitment: "finalized" },
);
```

Tenga en cuenta que cualquier campo que no incluya en la llamada a **actualizar** permanecerá igual, por diseño.

## Agregar NFT a una colección
Una [colección certificada](https://docs.metaplex.com/programs/token-metadata/certified-collections#introduction) es un NFT al que pueden pertenecer otros NFT individuales. Piense en una gran colección de NFT como Solana Monkey Business. Si mira los [metadatos](https://explorer.solana.com/address/C18YQWbfwjpCMeCm2MPGTgfcxGeEDPvNaGpVjwYv33q1/metadata) de un NFT individual, verá un campo de **colección** con una clave que apunta al [NFT](https://explorer.solana.com/address/SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND/) de la **colección certificada** . En resumen, los NFT que forman parte de una colección están asociados con otro NFT que representa la colección en sí.

Para agregar un NFT a una colección, primero debe crear el NFT de la colección. El proceso es el mismo que antes, excepto que incluirá un campo adicional en los metadatos de nuestro NFT: **isCollection** . Este campo le dice al programa de token que este NFT es un NFT de colección.

```JavaScript
const { collectionNft } = await metaplex.nfts().create(
    {
        uri: uri,
        name: "Mi Coleccion de NFT",
        sellerFeeBasisPoints: 0,
        isCollection: true
    },
    { commitment: "finalized" },
);
```

Luego, enumera la dirección de acuñación de la colección como referencia para el campo de **colección** en nuestro nuevo NFT.

```JavaScript
const { nft } = await metaplex.nfts().create(
    {
        uri: uri,
        name: "Mi NFT",
        sellerFeeBasisPoints: 0,
        collection: collectionNft.mintAddress
    },
    { commitment: "finalized" },
);
```

Cuando revise los metadatos de su NFT recién creado, debería ver un campo de **colección** así:

```JavaScript
"collection":{
    "verified": false,
    "key": "SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND"
}
```

Lo último que necesita hacer es verificar el NFT. Esto efectivamente simplemente invierte el campo verificado anterior a true, pero es increíblemente importante. Esto es lo que permite a los programas y aplicaciones consumidores saber que su NFT es parte de la colección. Puede hacerlo utilizando la función **verifyCollection**:

```JavaScript
await metaplex.nfts().verifyCollection({
    mintAddress: nft.address,
    collectionMintAddress: collectionNft.address,
    isSizedCollection: true,
})
```


## Máquina de caramelos (CANDY MACHINE)
Al crear y distribuir un suministro masivo de NFT, Metaplex lo hace fácil con su programa [Candy Machine](https://docs.metaplex.com/programs/candy-machine/overview) y la [interfaz de línea de comandos Sugar](https://docs.metaplex.com/developer-tools/sugar/) .

Candy Machine es efectivamente un programa de acuñación y distribución para ayudar a lanzar colecciones de NFT. Sugar es una interfaz de línea de comandos que ayuda a crear una máquina de caramelos, preparar activos y crear NFT a gran escala. Los pasos cubiertos anteriormente para crear un NFT serían increíblemente tediosos de ejecutar para miles de NFT de una sola vez. Candy Machine y Sugar resuelven esto y ayudan a garantizar un lanzamiento justo ofreciendo una serie de medidas de seguridad.
No cubriremos estas herramientas en profundidad, pero definitivamente echa un vistazo a cómo funcionan juntas [aquí](https://docs.metaplex.com/developer-tools/sugar/overview/introduction) .
Para explorar la gama completa de herramientas ofrecidas por Metaplex, puede ver el [repositorio de Metaplex](https://github.com/metaplex-foundation/metaplex) en GitHub.


# Demostración
En esta demostración, repasaremos los pasos para crear un NFT utilizando el SDK de Metaplex, actualizaremos los metadatos del NFT después de hecho, y asociaremos el NFT con una colección. Al final, tendrá una comprensión básica de cómo utilizar el SDK de Metaplex para interactuar con los NFT en Solana.


## 1. Inicio
Para comenzar, descargue el código de inicio de la rama de [inicio de este repositorio](https://github.com/Unboxed-Software/solana-metaplex/tree/starter).
El proyecto contiene dos imágenes en el directorio **src** que utilizaremos para los NFT.

Además, en el archivo **index.ts** , encontrará el siguiente fragmento de código que incluye datos de ejemplo para el NFT que estaremos creando y actualizando.

```JavaScript
interface NftData {
    name: string;
    symbol: string;
    description: string;
    sellerFeeBasisPoints: number;
    imageFile: string;
}

interface CollectionNftData {
    name: string
    symbol: string
    description: string
    sellerFeeBasisPoints: number
    imageFile: string
    isCollection: boolean
    collectionAuthority: Signer
}

// example data for a new NFT
const nftData = {
    name: "Name",
    symbol: "SYMBOL",
    description: "Description",
    sellerFeeBasisPoints: 0,
    imageFile: "solana.png",
}

// example data for updating an existing NFT
const updateNftData = {
    name: "Update",
    symbol: "UPDATE",
    description: "Update Description",
    sellerFeeBasisPoints: 100,
    imageFile: "success.png",
}

async function main() {
    // create a new conexion to the cluster's API
    const conexion = new Connection(clusterApiUrl("devnet"));

    // initialize a keypair for the usuario
    const usuario = await initializeKeypair(conexion);

    console.log("PublicKey:", usuario.publicKey.toBase58());
}
```

Para instalar las dependencias necesarias, ejecute **npm install** en la línea de comandos.

A continuación, ejecute el código ejecutando **npm start** . Esto creará una nueva pareja de claves, la escribirá en el archivo **.env** y airdrop devnet SOL a la pareja de claves.

```
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
Finished successfully
```

## 2. Configurar Metaplex
Antes de comenzar a crear y actualizar NFT, necesitamos configurar la instancia de Metaplex. Actualice la función **main()** con lo siguiente:

```JavaScript
async function main() {
    // create a new conexion to the cluster's API
    const conexion = new Connection(clusterApiUrl("devnet"));

    // initialize a keypair for the usuario
    const usuario = await initializeKeypair(conexion);

    console.log("PublicKey:", usuario.publicKey.toBase58());

    // metaplex set up
    const metaplex = Metaplex.make(conexion)
        .use(keypairIdentity(usuario))
        .use(
            bundlrStorage({
                address: "https://devnet.bundlr.network",
                providerUrl: "https://api.devnet.solana.com",
                timeout: 60000,
            }),
        );
}
```

## 3. Función de ayuda **uploadMetadata**
A continuación, creemos una función de ayuda para manejar el proceso de cargar una imagen y metadatos, y devolver la URI de metadatos. Esta función tomará como entrada la instancia de Metaplex y los datos del NFT, y devolverá la URI de metadatos como salida.

```JavaScript
// helper function to upload image and metadata
async function uploadMetadata(
    metaplex: Metaplex,
    nftData: NftData,
): Promise<string> {
    // archivo to buffer
    const buffer = fs.readFileSync("src/" + nftData.imageFile);

    // buffer to metaplex archivo
    const archivo = toMetaplexFile(buffer, nftData.imageFile);

    // upload image and get image uri
    const uriDeImagen = await metaplex.storage().upload(archivo);
    console.log("image uri:", uriDeImagen);

    // upload metadata and get metadata uri (off chain metadata)
    const { uri } = await metaplex.nfts().uploadMetadata({
        name: nftData.name,
        symbol: nftData.symbol,
        description: nftData.description,
        image: uriDeImagen,
    });

    console.log("metadata uri:", uri);
    return uri;
}
```

Esta función leerá un archivo de imagen, lo convertirá en un buffer y lo subirá para obtener una URI de imagen. Luego, subirá los metadatos NFT, que incluyen el nombre, símbolo, descripción y URI de imagen, y obtendrá una URI de metadatos. Esta URI es los metadatos fuera de la cadena. Esta función también registrará la URI de la imagen y la URI de los metadatos para referencia.


## 4. Función de ayuda createNft
A continuación, creemos una función de ayuda para manejar la creación del NFT. Esta función toma como entrada la instancia de Metaplex, la URI de metadatos y los datos del NFT. Utiliza el método **créate** del SDK para crear el NFT, pasando la URI de metadatos, el nombre, la tarifa del vendedor y el símbolo como parámetros.

```JavaScript
// helper function create NFT
async function createNft(
    metaplex: Metaplex,
    uri: string,
    nftData: NftData,
): Promise<NftWithToken> {
    const { nft } = await metaplex.nfts().create(
        {
            uri: uri, // metadata URI
            name: nftData.name,
            sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
            symbol: nftData.symbol,
        },
        { commitment: "finalized" },
    );

    console.log(
        `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
    );

    return nft;
}
```

La función **createNft** registra la URL de acuñación del token y devuelve un objeto **nft** que contiene información sobre el NFT recién creado. El NFT se acuñará en la clave pública correspondiente al **usuario** utilizado como el Identity Driver al configurar la instancia de Metaplex.


## 5. Crear NFT
Ahora que hemos configurado la instancia de Metaplex y creado funciones de ayuda para cargar metadatos y crear NFT, podemos probar estas funciones creando un NFT. En la función **main()** , llame a la función **uploadMetadata** para cargar los datos del NFT y obtener la URI para los metadatos. Luego, use la función **createNft** y la URI de metadatos para crear un NFT.

```JavaScript
async function main() {
	...

  // upload the NFT data and get the URI for the metadata
  const uri = await uploadMetadata(metaplex, nftData)

  // create an NFT using the helper function and the URI from the metadata
  const nft = await createNft(metaplex, uri, nftData)
}
```

Ejecute **npm start** en la línea de comandos para ejecutar la función **principal**. Debería ver una salida similar a la siguiente:

```
Current balance is 1.770520342
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
image uri: https://arweave.net/j5HcSX8qttSgJ_ZDLmbuKA7VGUo7ZLX-xODFU4LFYew
metadata uri: https://arweave.net/ac5fwNfRckuVMXiQW_EAHc-xKFCv_9zXJ-1caY08GFE
Token Mint: https://explorer.solana.com/address/QdK4oCUZ1zMroCd4vqndnTH7aPAsr8ApFkVeGYbvsFj?cluster=devnet
Finished successfully
```

Siéntase libre de inspeccionar las URIs generadas para la imagen y los metadatos, así como ver el NFT en el explorador de Solana visitando la URL proporcionada en la salida.


## 6. Función de ayuda updateNftUri
A continuación, creemos una función de ayuda para manejar la actualización de la URI de un NFT existente. Esta función tomará como entrada la instancia de Metaplex, la URI de metadatos y la dirección de acuñación del NFT. Utiliza el método **findByMint** del SDK para recuperar los datos del NFT existente utilizando la dirección de acuñación, y luego utiliza el método **update** para actualizar los metadatos con la nueva URI. Finalmente, registrará la URL de acuñación del token y la firma de la transacción para referencia.

```JavaScript
// helper function update NFT
async function updateNftUri(
    metaplex: Metaplex,
    uri: string,
    mintAddress: PublicKey,
) {
    // fetch NFT data using mint address
    const nft = await metaplex.nfts().findByMint({ mintAddress });

    // update the NFT metadata
    const { response } = await metaplex.nfts().update(
        {
            nftOrSft: nft,
            uri: uri,
        },
        { commitment: "finalized" },
    );

    console.log(
        `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
    );

    console.log(
        `Transaction: https://explorer.solana.com/tx/${response.signature}?cluster=devnet`,
    );
}
```

## 7. Actualizar NFT
Para actualizar un NFT existente, primero debemos cargar nuevos metadatos para el NFT y obtener la nueva URI. En la función **main()** , llame de nuevo a la función **uploadMetadata** para cargar los datos del NFT actualizados y obtener la nueva URI para los metadatos. Luego, podemos usar la función de ayuda **updateNftUri** , pasando la instancia de Metaplex, la nueva URI de los metadatos y la dirección de acuñación del NFT. La **dirección del nft** es de la salida de la función **createNft** .

```JavaScript
async function main() {
  // upload updated NFT data and get the new URI for the metadata
  const updatedUri = await uploadMetadata(metaplex, updateNftData)

  // update the NFT using the helper function and the new URI from the metadata
  await updateNftUri(metaplex, updatedUri, nft.address)
}
```

Ejecute **npm start** en la línea de comandos para ejecutar la función **principal**. Debería ver una salida adicional similar a la siguiente:

```
...
Token Mint: https://explorer.solana.com/address/6R9egtNxbzHr5ksnGqGNHXzKuKSgeXAbcrdRUsR1fkRM?cluster=devnet
Transaction: https://explorer.solana.com/tx/5VkG47iGmECrqD11zbF7psaVqFkA4tz3iZar21cWWbeySd66fTkKg7ni7jiFkLqmeiBM6GzhL1LvNbLh4Jh6ozpU?cluster=devnet
Finished successfully
```

También puedes ver los NFTs en Phantom billetera importando la **PRIVATE_KEY** desde el archivo .env.


## 8. Crear una colección de NFT
Genial, ¡ahora sabes cómo crear un solo NFT y actualizarlo en la cadena de bloques de Solana! ¿Pero cómo lo agregas a una colección?

Primero, creemos una función de ayuda llamada **createCollectionNft** . Tenga en cuenta que es muy similar a **createNft** , pero asegura que **isCollection** está establecido en true y que los datos cumplen con los requisitos para una colección.

```JavaScript
async function createCollectionNft(
    metaplex: Metaplex,
    uri: string,
    data: CollectionNftData
): Promise<NftWithToken> {
    const { nft } = await metaplex.nfts().create(
        {
            uri: uri,
            name: data.name,
            sellerFeeBasisPoints: data.sellerFeeBasisPoints,
            symbol: data.symbol,
            isCollection: true,
        },
        { commitment: "finalized" }
    )

    console.log(
        `Collection Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
    )

    return nft
}
```

A continuación, necesitamos crear los datos fuera de la cadena para la colección. En el **main** antes de las llamadas existentes a **createNft** , agregue lo siguiente **collectionNftData** :

```JavaScript
const collectionNftData = {
    name: "TestCollectionNFT",
    symbol: "TEST",
    description: "Test Description Collection",
    sellerFeeBasisPoints: 100,
    imageFile: "success.png",
    isCollection: true,
    collectionAuthority: usuario,
}
```

Ahora, llamemos a **uploadMetadata** con los **collectionNftData** y luego llamemos a **createCollectionNft** . Nuevamente, haga esto antes del código que crea un NFT.

```JavaScript
async function main() {
    // upload data for the collection NFT and get the URI for the metadata
    const collectionUri = await uploadMetadata(metaplex, collectionNftData)

    // create a collection NFT using the helper function and the URI from the metadata
    const collectionNft = await createCollectionNft(
        metaplex,
        collectionUri,
        collectionNftData
    )
}
```

Esto devolverá la dirección de la fábrica de nuestra colección para que podamos usarla para asignar NFT a la colección.


## 9. Asignar un NFT a una colección
Ahora que tenemos una colección, modifiquemos nuestro código existente para que los NFTs recién creados se agreguen a la colección. Primero, modifiquemos nuestra función **createNft** para que la llamada a **nfts().create** incluya el campo **colección** . Luego, agreguemos código que llame a **verifyCollection** para que el campo **verificado** en los metadatos en-cadena se establezca en verdadero. De esta manera, los programas y aplicaciones consumidores pueden estar seguros de que el NFT pertenece en realidad a la colección.

```JavaScript
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData
): Promise<NftWithToken> {
    const { nft } = await metaplex.nfts().create(
        {
            uri: uri, // metadata URI
            name: nftData.name,
            sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
            symbol: nftData.symbol,
        },
        { commitment: "finalized" }
    )

    console.log(
        `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}? cluster=devnet`
    )

    //this is what verifies our collection as a Certified Collection
    await metaplex.nfts().verifyCollection({    
        mintAddress: nft.mint.address,
        collectionMintAddress: collectionMint,
        isSizedCollection: true,
    })

    return nft
}
```

¡Ahora, ejecute **npm start** y ¡voilà! Si sigue el nuevo enlace de nft y mira la pestaña Metadatos, verá un campo de **colección** con la dirección de acuñación de su colección listada.

¡Felicidades! Has aprendido con éxito cómo usar el SDK Metaplex para crear, actualizar y verificar NFTs como parte de una colección. Eso es todo lo que necesitas para construir tu propia colección para cualquier caso de uso. Podrías construir un competidor de TicketMaster, renovar el programa de membresía de Costco o incluso digitalizar el sistema de identificación del estudiante de tu escuela. ¡Las posibilidades son infinitas!
Si desea ver el código de la solución final, puede encontrarlo en la rama de [solución del mismo repositorio](https://github.com/Unboxed-Software/solana-metaplex/tree/solution).

## Desafío

Para profundizar tu comprensión de las herramientas de Metaplex, sumergete en la documentación de Metaplex y familiarízate con los diversos programas y herramientas ofrecidos por Metaplex. Por ejemplo, puedes profundizar en el aprendizaje sobre el programa Candy Machine para entender su funcionalidad.

Una vez que tengas una comprensión de cómo funciona el programa Candy Machine, pon a prueba tus conocimientos usando Sugar CLI para crear una Candy Machine para tu propia colección. Esta experiencia práctica no solo reforzará tu comprensión de las herramientas, sino que también aumentará tu confianza en tu capacidad de usarlas efectivamente en el futuro.

¡Diviértete con esto! ¡Esta será tu primera colección de NFT creada independientemente! Con esto, completarás el Módulo 2. ¡Espero que sientas el proceso! ¡No dudes en compartir algunos comentarios rápidos [aquí](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%202) para que podamos seguir mejorando el curso!
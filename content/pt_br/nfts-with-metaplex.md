---
title: Criando NFTs na Solana com o Metaplex
objectives:
1. Explicar o que são NFTs e como são representados na rede Solana.
2. Explicar o papel do Metaplex no ecossistema de NFTs da Solana.
3. Criar e atualizar NFTs usando o SDK do Metaplex.
4. Explicar a funcionalidade básica do programa de Metadados de Token, programa Candy Machine e CLI Sugar como ferramentas que auxiliam na criação e distribuição de NFTs na Solana.
---

# Resumo

- Os **Tokens Não Fungíveis (NFTs)** são representados na Solana como Tokens SPL com uma conta de metadados associada, 0 casas decimais e um fornecimento máximo de 1.
- O **Metaplex** oferece um conjunto de ferramentas que simplificam a criação e distribuição de NFTs na blockchain Solana.
- O programa **Token Metadata** padroniza o processo de anexar metadados aos Tokens SPL.
- O **SDK do Metaplex** é uma ferramenta que oferece APIs amigáveis ao usuário para auxiliar os desenvolvedores na utilização das ferramentas onchain fornecidas pelo Metaplex.
- O programa **Candy Machine** é uma ferramenta de distribuição de NFTs usada para criar e emitir NFTs de uma coleção.
- A **CLI Sugar** é uma ferramenta que simplifica o processo de fazer upload de arquivos de mídia/metadados e criar uma Candy Machine para uma coleção.

# Visão Geral

Os Tokens Não Fungíveis (NFTs) na Solana são tokens SPL criados usando o Programa de Tokens. No entanto, esses tokens também têm uma conta de metadados adicional associada a cada cunhagem de token. Isso permite uma ampla variedade de casos de uso para tokens. Você pode efetivamente tokenizar qualquer coisa, desde inventário de jogos até arte.

Nesta lição, abordaremos o básico de como os NFTs são representados na Solana, como criá-los e atualizá-los usando o SDK do Metaplex, e forneceremos uma breve introdução a ferramentas que podem ajudá-lo a criar e distribuir NFTs em escala na Solana.

## NFTs na Solana

Um NFT na Solana é um token não divisível com metadados associados. Além disso, o cunhagem do token possui um fornecimento máximo de 1.

Em outras palavras, um NFT é um token padrão do Programa de Tokens, mas difere do que você pode pensar como "tokens padrão" no sentido de que:

1. Tem 0 casas decimais para que não possa ser dividido em partes.
2. Vem de uma cunhagem de token com fornecimento de 1, de modo que apenas 1 desses tokens existe.
3. Vem de uma cunhagem de token cuja autoridade é definida como `null` (para garantir que o fornecimento nunca mude).
4. Possui uma conta associada que armazena metadados.

Enquanto os três primeiros pontos são recursos que podem ser alcançados com o Programa de Tokens SPL, os metadados associados exigem alguma funcionalidade adicional.

Normalmente, os metadados de um NFT têm tanto um componente onchain quanto off-chain. Os metadados onchain são armazenados em uma conta associada à cunhagem do token. Um de seus campos é o URI (Identificador Universal de Recursos), que normalmente aponta para um arquivo JSON off-chain (veja [este link](https://lsc6xffbdvalb5dvymf5gwjpeou7rr2btkoltutn5ij5irlpg3wa.arweave.net/XIXrlKEdQLD0dcML01kvI6n4x0GanLnSbeoT1EVvNuw) como exemplo). O componente off-chain armazena dados adicionais e um link para a imagem. Sistemas de armazenamento permanente, como o Arweave, são frequentemente usados para armazenar o componente off-chain dos metadados de NFTs.

Abaixo está um exemplo da relação entre metadados onchain e off-chain. Os metadados onchain contêm um campo URI que aponta normalmente para um arquivo `.json` off-chain que armazena o link para a imagem do NFT e metadados adicionais.

![Captura de tela dos Metadados](../../assets/solana-nft-metaplex-metadata.png)

## **Metaplex**

[Metaplex](https://www.metaplex.com/) é uma organização que fornece um conjunto de ferramentas, como o [SDK do Metaplex](https://docs.metaplex.com/sdks/js/), que simplificam a criação e distribuição de NFTs na blockchain Solana. Essas ferramentas atendem a uma ampla gama de casos de uso e permitem que você gerencie facilmente todo o processo de criação e emissão de uma coleção de NFTs.

Mais especificamente, o SDK do Metaplex foi projetado para ajudar os desenvolvedores a utilizar as ferramentas onchain oferecidas pelo Metaplex. Ele oferece uma API amigável ao usuário que se concentra em casos de uso populares e permite uma integração fácil com plugins de terceiros. Para saber mais sobre as capacidades do SDK do Metaplex, você pode consultar o [README](https://github.com/metaplex-foundation/js#readme).

Um dos programas essenciais oferecidos pelo Metaplex é o programa Token Metadata. O programa Token Metadata padroniza o processo de anexar metadados aos Tokens SPL. Ao criar um NFT com o Metaplex, o programa Token Metadata cria uma conta de metadados usando um Endereço Derivado do Programa (PDA) com a cunhagem do token como semente. Isso permite que a conta de metadados para qualquer NFT seja localizada de maneira determinística usando o endereço de cunhagem do token. Para saber mais sobre o programa Token Metadata, você pode consultar a [documentação do Metaplex](https://docs.metaplex.com/programs/token-metadata/).

Nas seções seguintes, abordaremos o básico do uso do SDK do Metaplex para preparar ativos, criar NFTs, atualizar NFTs e associar um NFT a uma coleção mais ampla.

### Instância do Metaplex

Uma instância do `Metaplex` serve como ponto de entrada para acessar as APIs do SDK do Metaplex. Esta instância aceita uma conexão usada para se comunicar com o cluster. Além disso, os desenvolvedores podem personalizar as interações do SDK especificando um "Driver de Identidade" e um "Driver de Armazenamento".

O Driver de Identidade é efetivamente um par de chaves que pode ser usado para assinar transações, um requisito ao criar um NFT. O Driver de Armazenamento é usado para especificar o serviço de armazenamento que você deseja usar para fazer upload de ativos. O driver `bundlrStorage` é a opção padrão e faz o upload de ativos para o Arweave, um serviço de armazenamento permanente e descentralizado.

Abaixo está um exemplo de como você pode configurar a instância `Metaplex` para a devnet.

```tsx
import {
    Metaplex,
    keypairIdentity,
    bundlrStorage,
} from "@metaplex-foundation/js";
import { Connection, clusterApiUrl, Keypair } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const wallet = Keypair.generate();

const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(wallet))
    .use(
        bundlrStorage({
            address: "https://devnet.bundlr.network",
            providerUrl: "https://api.devnet.solana.com",
            timeout: 60000,
        }),
    );
```

### Upload de ativos

Antes de criar um NFT, você precisa preparar e fazer upload de quaisquer ativos que planeja associar ao NFT. Embora não precise ser uma imagem, a maioria dos NFTs possui uma imagem associada a eles.

Preparar e fazer upload de uma imagem envolve converter a imagem em um buffer, convertê-la para o formato Metaplex usando a função `toMetaplexFile` e, finalmente, fazer o upload para o Driver de Armazenamento designado.

O SDK do Metaplex suporta a criação de um novo arquivo Metaplex a partir de arquivos presentes em seu computador local ou aqueles enviados por um usuário por meio de um navegador. Você pode fazer o primeiro usando `fs.readFileSync` para ler o arquivo de imagem, em seguida, convertê-lo em um arquivo Metaplex usando `toMetaplexFile`. Por fim, use sua instância `Metaplex` para chamar `storage().upload(file)` para fazer o upload do arquivo. O valor de retorno da função será o URI onde a imagem foi armazenada.

```tsx
const buffer = fs.readFileSync("/path/to/image.png");
const file = toMetaplexFile(buffer, "image.png");

const imageUri = await metaplex.storage().upload(file);
```

### Upload de Metadados

Após fazer o upload de uma imagem, é hora de fazer o upload dos metadados JSON off-chain usando a função `nfts().uploadMetadata`. Isso retornará um URI onde os metadados JSON estão armazenados.

Lembre-se, a parte off-chain dos metadados inclui coisas como o URI da imagem, bem como informações adicionais, como o nome e a descrição do NFT. Embora você possa incluir tecnicamente qualquer coisa que desejar neste objeto JSON, na maioria dos casos, você deve seguir o [padrão NFT](https://docs.metaplex.com/programs/token-metadata/token-standard#the-non-fungible-standard) para garantir a compatibilidade com carteiras, programas e aplicativos.

Para criar os metadados, use o método `uploadMetadata` fornecido pelo SDK. Este método aceita um objeto de metadados e retorna um URI que aponta para os metadados enviados.

```tsx
const { uri } = await metaplex.nfts().uploadMetadata({
    name: "Meu NFT",
    description: "Minha descrição",
    image: imageUri,
});
```

### Criando um NFT

Após fazer o upload dos metadados do NFT, você finalmente pode criar o NFT na rede. O método `create` do SDK do Metaplex permite criar um novo NFT com configuração mínima. Este método cuidará da criação da conta de cunhagem, da conta de token, da conta de metadados e da conta da edição principal para você. Os dados fornecidos a este método representarão a parte onchain dos metadados do NFT. Você pode explorar o SDK para ver todas as outras entradas que podem ser opcionalmente fornecidas a este método.

```tsx
const { nft } = await metaplex.nfts().create(
    {
        uri: uri,
        name: "Meu NFT",
        sellerFeeBasisPoints: 0,
    },
    { commitment: "finalized" },
);
```

Este método retorna um objeto contendo informações sobre o NFT recém-criado. Por padrão, o SDK define a propriedade `isMutable` como `true`, permitindo que atualizações sejam feitas nos metadados do NFT. No entanto, você pode optar por definir `isMutable` como `false`, tornando os metadados do NFT imutáveis.

### Atualizando um NFT

Se você deixou `isMutable` como `true`, pode acabar tendo um motivo para atualizar os metadados do seu NFT. O método `update` do SDK permite atualizar tanto a parte onchain quanto a parte off-chain dos metadados do NFT. Para atualizar os metadados off-chain, você precisará repetir as etapas de fazer upload de uma nova imagem e URI de metadados, conforme descrito nas etapas anteriores, e, em seguida, fornecer o novo URI de metadados a este método. Isso alterará o URI para o qual os metadados onchain apontam, efetivamente atualizando os metadados off-chain também.

```tsx
const nft = await metaplex.nfts().findByMint({ mintAddress });

const { response } = await metaplex.nfts().update(
    {
        nftOrSft: nft,
        name: "Nome atualizado",
        uri: uri,
        sellerFeeBasisPoints: 100,
    },
    { commitment: "finalized" },
);
```

Observe que quaisquer campos que você não incluir na chamada para `update` permanecerão os mesmos, por padrão.

### Adicionando um NFT a uma Coleção

Uma [Coleção Certificada](https://docs.metaplex.com/programs/token-metadata/certified-collections#introduction) é um NFT ao qual NFTs individuais podem pertencer. Pense em uma grande coleção de NFTs, como a Solana Monkey Business. Se você olhar para os [Metadados](https://explorer.solana.com/address/C18YQWbfwjpCMeCm2MPGTgfcxGeEDPvNaGpVjwYv33q1/metadata) de um NFT individual, verá um campo `collection` com uma `key` que aponta para o NFT da [Coleção Certificada](https://explorer.solana.com/address/SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND/). Simplificando, os NFTs que fazem parte de uma coleção estão associados a outro NFT que representa a própria coleção.

Para adicionar um NFT a uma coleção, primeiro o NFT de Coleção deve ser criado. O processo é o mesmo que antes, exceto que você incluirá um campo adicional em seus Metadados de NFT: `isCollection`. Este campo informa ao programa de token que este NFT é um NFT de Coleção.

```tsx
const { collectionNft } = await metaplex.nfts().create(
    {
        uri: uri,
        name: "Minha coleção NFT",
        sellerFeeBasisPoints: 0,
        isCollection: true
    },
    { commitment: "finalized" },
);
```

Em seguida, você lista o endereço de cunhagem da coleção como referência para o campo `collection` em nosso novo NFT.

```tsx
const { nft } = await metaplex.nfts().create(
    {
        uri: uri,
        name: "Meu NFT",
        sellerFeeBasisPoints: 0,
        collection: collectionNft.mintAddress
    },
    { commitment: "finalized" },
);
```

Ao verificar os metadados em seu NFT recém-criado, você deverá ver agora um campo `collection` como este:

```JSON
"collection":{
    "verified": false,
    "key": "SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND"
}
```

A última coisa que você precisa fazer é verificar o NFT. Isso efetivamente apenas altera o campo `verified` acima para `true`, mas é incrivelmente importante. Isso permite que programas e aplicativos consumidores saibam que seu NFT faz parte da coleção. Você pode fazer isso usando a função `verifyCollection`:

```tsx
await metaplex.nfts().verifyCollection({
    mintAddress: nft.address,
    collectionMintAddress: collectionNft.address,
    isSizedCollection: true,
})
```

### Candy Machine

Ao criar e distribuir um grande suprimento de NFTs, o Metaplex torna isso fácil com seu programa [Candy Machine](https://docs.metaplex.com/programs/candy-machine/overview) e com a [CLI Sugar](https://docs.metaplex.com/developer-tools/sugar/).

A Candy Machine é efetivamente um programa de cunhagem e distribuição para ajudar a lançar coleções de NFTs. O Sugar é uma interface de linha de comando que ajuda você a criar uma Candy Machine, preparar ativos e criar NFTs em grande escala. As etapas abordadas acima para criar um NFT seriam incrivelmente tediosas de executar para milhares de NFTs de uma só vez. A Candy Machine e o Sugar resolvem isso e ajudam a garantir um lançamento justo oferecendo várias salvaguardas.

Não iremos cobrir essas ferramentas em detalhes, mas definitivamente confira [como a Candy Machine e o Sugar funcionam juntos na documentação do Metaplex](https://docs.metaplex.com/developer-tools/sugar/overview/introduction).

Para explorar a gama completa de ferramentas oferecidas pelo Metaplex, você pode visualizar o [repositório do Metaplex](https://github.com/metaplex-foundation/metaplex) no GitHub.


# Demonstração

Nesta demonstração, passaremos pelas etapas para criar um NFT usando o SDK do Metaplex, atualizar os metadados do NFT após o fato e associar o NFT a uma coleção. No final, você terá uma compreensão básica de como usar o SDK do Metaplex para interagir com NFTs na Solana.

### 1. Código Inicial

Para começar, faça o download do código inicial da branch `starter` deste [repositório](https://github.com/Unboxed-Software/solana-metaplex/tree/starter).

O projeto contém duas imagens no diretório `src` que usaremos para os NFTs.

Além disso, no arquivo `index.ts`, você encontrará o seguinte trecho de código que inclui dados de exemplo para o NFT que criaremos e atualizaremos.

```tsx
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

// dados de exemplo para um novo NFT
const nftData = {
    name: "Nome",
    symbol: "SÍMBOLO",
    description: "Descrição",
    sellerFeeBasisPoints: 0,
    imageFile: "solana.png",
}

// dados de exemplo para atualizar um NFT existente
const updateNftData = {
    name: "Atualizar",
    symbol: "ATUALIZAR",
    description: "Atualize a descrição",
    sellerFeeBasisPoints: 100,
    imageFile: "success.png",
}

async function main() {
    // criar uma nova conexão com a API do cluster
    const connection = new Connection(clusterApiUrl("devnet"));

    // inicializar um par de chaves para o usuário
    const user = await initializeKeypair(connection);

    console.log("PublicKey:", user.publicKey.toBase58());
}
```

Para instalar as dependências necessárias, execute `npm install` na linha de comando.

Em seguida, execute o código executando `npm start`. Isso criará um novo par de chaves, o escreverá no arquivo `.env` e fará airdrop de SOL na devnet para o par de chaves.

```text
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
Finished successfully
```

### 2. Configurando o Metaplex

Antes de começarmos a criar e atualizar NFTs, precisamos configurar a instância do Metaplex. Atualize a função `main()` com o seguinte:

```tsx
async function main() {
    // cria uma nova conexão com a API do cluster
    const connection = new Connection(clusterApiUrl("devnet"));

    // inicializa um par de chaves para o usuário
    const user = await initializeKeypair(connection);

    console.log("PublicKey:", user.publicKey.toBase58());

    // configura o Metaplex
    const metaplex = Metaplex.make(connection)
        .use(keypairIdentity(user))
        .use(
            bundlrStorage({
                address: "https://devnet.bundlr.network",
                providerUrl: "https://api.devnet.solana.com",
                timeout: 60000,
            }),
        );
}
```

### 3. Função auxiliar `uploadMetadata`

Agora, vamos criar uma função auxiliar para lidar com o processo de upload de uma imagem e metadados, e retornar o URI dos metadados. Esta função receberá a instância do Metaplex e os dados do NFT como entrada e retornará o URI dos metadados como saída.

```tsx
// função auxiliar para fazer upload de imagem e metadados
async function uploadMetadata(
    metaplex: Metaplex,
    nftData: NftData,
): Promise<string> {
    // arquivo para o buffer
    const buffer = fs.readFileSync("src/" + nftData.imageFile);

    // buffer para arquivo do Metaplex
    const file = toMetaplexFile(buffer, nftData.imageFile);

    // faz upload da imagem e obtém o URI da imagem
    const imageUri = await metaplex.storage().upload(file);
    console.log("image uri:", imageUri);

    // faz upload dos metadados e obtém o URI dos metadados (metadados off-chain)
    const { uri } = await metaplex.nfts().uploadMetadata({
        name: nftData.name,
        symbol: nftData.symbol,
        description: nftData.description,
        image: imageUri,
    });

    console.log("metadata uri:", uri);
    return uri;
}
```

Esta função lerá um arquivo de imagem, o converterá em um buffer e, em seguida, fará o upload para obter um URI de imagem. Em seguida, fará o upload dos metadados do NFT, que incluem o nome, símbolo, descrição e URI da imagem, e obterá um URI dos metadados. Este URI são os metadados off-chain. Esta função também registrará o URI da imagem e o URI dos metadados para referência.

### 5. Função auxiliar `createNft`

A seguir, vamos criar uma função auxiliar para lidar com a criação do NFT. Esta função recebe a instância do Metaplex, o URI dos metadados e os dados do NFT como entrada. Ela usa o método `create` do SDK para criar o NFT, passando o URI dos metadados, o nome, a taxa do vendedor e o símbolo como parâmetros.

```tsx
// função auxiliar para criar um NFT
async function createNft(
    metaplex: Metaplex,
    uri: string,
    nftData: NftData,
): Promise<NftWithToken> {
    const { nft } = await metaplex.nfts().create(
        {
            uri: uri, // URI dos metadados
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

A função `createNft` registra o URL da conta de cunhagem do token e retorna um objeto `nft` contendo informações sobre o NFT recém-criado. O NFT será cunhado na chave pública correspondente ao `user` usado como Driver de Identidade ao configurar a instância do Metaplex.

### 6. Criando um NFT

Agora que configuramos a instância do Metaplex e criamos funções auxiliares para fazer o upload de metadados e criar NFTs, podemos testar essas funções criando um NFT. Na função `main()`, chame a função `uploadMetadata` para fazer o upload dos dados do NFT e obter o URI dos metadados. Em seguida, use a função `createNft` e o URI dos metadados para criar um NFT.

```tsx
async function main() {
	...

  // faz upload dos dados do NFT e obtém o URI dos metadados
  const uri = await uploadMetadata(metaplex, nftData)

  // cria um NFT usando a função auxiliar e o URI dos metadados
  const nft = await createNft(metaplex, uri, nftData)
}
```

Execute `npm start` na linha de comando para executar a função `main`. Você deve ver uma saída semelhante à seguinte:

```text
Current balance is 1.770520342
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
image uri: https://arweave.net/j5HcSX8qttSgJ_ZDLmbuKA7VGUo7ZLX-xODFU4LFYew
metadata uri: https://arweave.net/ac5fwNfRckuVMXiQW_EAHc-xKFCv_9zXJ-1caY08GFE
Token Mint: https://explorer.solana.com/address/QdK4oCUZ1zMroCd4vqndnTH7aPAsr8ApFkVeGYbvsFj?cluster=devnet
Finished successfully
```

Sinta-se à vontade para inspecionar os URIs gerados para a imagem e os metadados, bem como visualizar o NFT no explorador da Solana visitando o URL fornecido na saída.

### 7. Função auxiliar `updateNftUri`

A seguir, vamos criar uma função auxiliar para lidar com a atualização do URI de um NFT existente. Esta função receberá a instância do Metaplex, o URI dos metadados e o endereço de cunhagem do NFT. Ela usará o método `findByMint` do SDK para buscar os dados do NFT existente usando o endereço da cunhagem e, em seguida, usará o método `update` para atualizar os metadados com o novo URI. Por fim, ela registrará o URL da conta de cunhagem do token e a assinatura da transação para referência.

```tsx
// função auxiliar para atualizar um NFT
async function updateNftUri(
    metaplex: Metaplex,
    uri: string,
    mintAddress: PublicKey,
) {
    // busca os dados do NFT usando o endereço da cunhagem
    const nft = await metaplex.nfts().findByMint({ mintAddress });

    // atualiza os metadados do NFT
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

### 8. Atualizando o NFT

Para atualizar um NFT existente, primeiro precisamos fazer upload de novos metadados para o NFT e obter o novo URI. Na função `main()`, chame novamente a função `uploadMetadata` para fazer upload dos dados atualizados do NFT e obter o novo URI para os metadados. Em seguida, podemos usar a função auxiliar `updateNftUri`, passando a instância do Metaplex, o novo URI dos metadados e o endereço da cunhagem do NFT. O `nft.address` é obtido a partir da saída da função `createNft`.

```tsx
async function main() {
	...

  // faz upload dos dados atualizados do NFT e obtém o novo URI dos metadados
  const updatedUri = await uploadMetadata(metaplex, updateNftData)

  // atualiza o NFT usando a função auxiliar e o novo URI dos metadados
  await updateNftUri(metaplex, updatedUri, nft.address)
}
```

Execute `npm start` na linha de comando para executar a função `main`. Você deve ver uma saída adicional semelhante à seguinte:

```text
...
Token Mint: https://explorer.solana.com/address/6R9egtNxbzHr5ksnGqGNHXzKuKSgeXAbcrdRUsR1fkRM?cluster=devnet
Transaction: https://explorer.solana.com/tx/5VkG47iGmECrqD11zbF7psaVqFkA4tz3iZar21cWWbeySd66fTkKg7ni7jiFkLqmeiBM6GzhL1LvNbLh4Jh6ozpU?cluster=devnet
Finished successfully
```

Você também pode visualizar os NFTs na carteira Phantom importando a `PRIVATE_KEY` do arquivo .env.

### 9. Criando uma coleção de NFTs

Incrível, agora você sabe como criar um único NFT e atualizá-lo na blockchain Solana! Mas, como você o adiciona a uma coleção?

Primeiro, vamos criar uma função auxiliar chamada `createCollectionNft`. Note que ela é muito semelhante à `createNft`, mas garante que `isCollection` esteja definido como `true` e que os dados atendam aos requisitos para uma coleção.

```tsx
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

Em seguida, precisamos criar os dados off-chain para a coleção. Em `main`, *antes* das chamadas existentes para `createNft`, adicione o seguinte `collectionNftData`:

```tsx
const collectionNftData = {
    name: "TestCollectionNFT",
    symbol: "TEST",
    description: "Descrição da coleção de teste",
    sellerFeeBasisPoints: 100,
    imageFile: "success.png",
    isCollection: true,
    collectionAuthority: user,
}
```

Agora, chame `uploadMetadata` com o `collectionNftData` e, em seguida, chame `createCollectionNft`. Novamente, faça isso *antes* do código que cria um NFT. 

```tsx
async function main() {
    ...

    // faz upload dos dados para o NFT de coleção e obtém o URI dos metadados
    const collectionUri = await uploadMetadata(metaplex, collectionNftData)

    // cria um NFT de coleção usando a função auxiliar e o URI dos metadados
    const collectionNft = await createCollectionNft(
        metaplex,
        collectionUri,
        collectionNftData
    )
}
```

Isso retornará o endereço de cunhagem da nossa coleção para que possamos usá-lo para atribuir NFTs à coleção.

### 10. Atribuindo um NFT a uma coleção

Agora que temos uma coleção, vamos modificar nosso código existente para que os NFTs recém-criados sejam adicionados à coleção. Primeiro, vamos modificar nossa função `createNft` para que a chamada para `nfts().create` inclua o campo `collection`. Em seguida, adicione código que chama `verifyCollection` para que o campo `verified` nos metadados onchain seja definido como `true`. É assim que os programas e aplicativos consumidores podem ter certeza de que o NFT realmente pertence à coleção.

```tsx
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData
): Promise<NftWithToken> {
    const { nft } = await metaplex.nfts().create(
        {
            uri: uri, // URI dos metadados
            name: nftData.name,
            sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
            symbol: nftData.symbol,
        },
        { commitment: "finalized" }
    )

    console.log(
        `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}? cluster=devnet`
    )

    // é isso que verifica nossa coleção como Coleção Certificada
    await metaplex.nfts().verifyCollection({    
        mintAddress: nft.mint.address,
        collectionMintAddress: collectionMint,
        isSizedCollection: true,
    })

    return nft
}
```

Agora, execute `npm start` e voilà! Se você seguir o novo link do NFT e olhar na guia de metadados, verá um campo `collection` com o endereço de cunhagem da sua coleção listado.

Parabéns! Você aprendeu com sucesso como usar o SDK do Metaplex para criar, atualizar e verificar NFTs como parte de uma coleção. Isso é tudo o que você precisa para criar sua própria coleção para praticamente qualquer caso de uso. Você poderia criar um concorrente para o TicketMaster, reformular o programa de associação do Costco ou até mesmo digitalizar o sistema de identificação de estudantes da sua escola. As possibilidades são infinitas!

Se você quiser dar uma olhada no código da solução final, você pode encontrá-lo na branch de solução do mesmo [repositório](https://github.com/Unboxed-Software/solana-metaplex/tree/solution).

# Desafio

Para aprofundar sua compreensão das ferramentas do Metaplex, mergulhe na documentação do Metaplex e familiarize-se com os vários programas e ferramentas oferecidos pelo Metaplex. Por exemplo, você pode se aprofundar no aprendizado sobre o programa Candy Machine para entender sua funcionalidade.

Assim que você entender como o programa Candy Machine funciona, coloque seu conhecimento à prova usando a CLI Sugar para criar uma Candy Machine para sua própria coleção. Essa experiência prática não apenas reforçará sua compreensão das ferramentas, mas também aumentará sua confiança em sua capacidade de usá-las efetivamente no futuro.

Divirta-se com isso! Esta será sua primeira coleção de NFTs criada de forma independente! Com isso, você concluirá o Módulo 2. Espero que esteja curtindo o processo! Sinta-se à vontade para [compartilhar um feedback rápido](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%202) para que possamos continuar a melhorar o curso!

---
title: NFTs compactados
Objectives:
- Criar uma coleção de NFTs compactados usando o programa Bubblegum da Metaplex
- Cunhar NFTs compactados usando o SDK TS do Bubblegum 
- Transferir NFTs compactados usando o SDK TS do Bubblegum
- Ler dados de NFTs compactados usando a API Read (de Leitura)
---

# RESUMO

- **NFTs Compactados (cNFTs)** usam **Compactação de estado** para fazer hash de dados de NFTs e armazenar o hash na cadeia numa conta usando uma estrutura **árvore de Merkle concorrente** 
- O hash de dados do cNFT não pode ser usado para inferir os dados do cNFT, mas pode ser usado para **verificar** se os dados do cNFT que você está vendo estão corretos
- Os provedores RPC de suporte **indexam** os dados do cNFT off-chain quando o cNFT é cunhado para que você possa usar a **API de Leitura** para acessar os dados
- O programa **Metaplex Bubblegum** é uma abstração do programa **Compactação de Estado** que permite criar, cunhar e gerenciar coleções de cNFT de forma mais simples.

# Visão Geral

Os NFTs compactados (cNFTs) são exatamente o que seu nome sugere: NFTs cuja estrutura ocupa menos espaço no armazenamento de contas do que os NFTs tradicionais. Os NFTs compactados aproveitam um conceito chamado **Compactação de estado** para armazenar dados de forma a reduzir drasticamente os custos.

Os custos de transação da Solana são tão baixos que a maioria dos usuários nunca pensa no quanto a cunhagem de NFTs pode ser cara em escala. O custo para configurar e cunhar 1 milhão de NFTs tradicionais é de aproximadamente 24.000 SOL. Em comparação, os cNFTs podem ser estruturados de forma que a mesma configuração e cunhagem custem 10 SOL ou menos. Isso significa que qualquer pessoa que use NFTs em escala poderia reduzir os custos em mais de 1.000 vezes usando cNFTs em vez de NFTs tradicionais.

No entanto, pode ser difícil trabalhar com os cNFTs. Eventualmente, as ferramentas necessárias para trabalhar com eles serão suficientemente abstraídas da tecnologia subjacente para que a experiência do desenvolvedor entre os NFTs tradicionais e os cNFTs seja insignificante. Mas, por enquanto, você ainda precisará entender as peças do quebra-cabeça de baixo nível. Então, vamos nos aprofundar!

## Uma visão geral teórica dos cNFTs

A maior parte dos custos associados aos NFTs tradicionais se resume ao espaço de armazenamento da conta. Os NFTs compactados usam um conceito chamado Compactação de Estado para armazenar dados no **estado do livro-razão** mais barato da blockchain, usando o espaço mais caro da conta apenas para armazenar uma "impressão digital", ou **hash**, dos dados. Esse hash permite que você verifique criptograficamente se os dados não foram adulterados.

Para armazenar hashes e permitir a verificação, usamos uma estrutura de árvore binária especial conhecida como **árvore de Merkle concorrente**. Essa estrutura de árvore nos permite fazer o hash de dados juntos de forma determinística para calcular um único hash final que é armazenado na cadeia. Esse hash final é significativamente menor em tamanho do que todos os dados originais combinados, daí a "Compactação". As etapas desse processo são:

1. Pegue qualquer dado
2. Crie um hash desses dados
3. Armazene esse hash como uma "folha" na parte inferior da árvore
4. Cada par de folhas é então transformado em hash, criando um "galho"
5. Cada galho recebe um hash em conjunto
6. Suba continuamente a árvore e faça o hash dos galhos adjacentes juntos
7. Uma vez no topo da árvore, é produzido um "hash raiz" final
8. Armazene o hash raiz na cadeia como uma prova verificável dos dados em cada folha
9. Qualquer pessoa que queira verificar se os dados que possui correspondem à "fonte da verdade" pode passar pelo mesmo processo e comparar o hash final sem precisar armazenar todos os dados na cadeia.

Um problema não abordado no item acima é como disponibilizar os dados se eles não puderem ser obtidos de uma conta. Como esse processo de hashing ocorre na cadeia, todos os dados existem no estado do livro-razão e, teoricamente, poderiam ser recuperados da transação original reproduzindo todo o estado da cadeia desde a origem. No entanto, é muito mais simples (embora ainda complicado) fazer com que um **indexador** rastreie e indexe esses dados à medida que as transações ocorrem. Isso garante que haja um "cache" dos dados off-chain que qualquer pessoa possa acessar e, posteriormente, verificar em relação ao hash raiz onchain.

Esse processo é *muito complexo*. Abordaremos alguns dos principais conceitos abaixo, mas não se preocupe se você não entender imediatamente. Falaremos mais sobre teoria na lição sobre compactação de estado e nos concentraremos principalmente na aplicação a NFTs nesta lição. Você poderá trabalhar com cNFTs ao final desta lição, mesmo que não compreenda totalmente todas as peças do quebra-cabeça da compactação de estado.

### Árvores de Merkle Concorrentes

Uma **árvore de Merkle** é uma estrutura de árvore binária representada por um único hash. Cada nó folha da estrutura é um hash de seus dados internos, enquanto cada galho é um hash dos hashes de suas folhas filhas. Por sua vez, os galhos também são agrupados em hash até que, por fim, reste um hash raiz final.

Qualquer modificação nos dados folha altera o hash raiz. Isso causa um problema quando várias transações no mesmo slot estão tentando modificar os dados folha. Como essas transações devem ser executadas em série, todas, exceto a primeira, falharão, pois o hash raiz e a prova passados terão sido invalidados pela primeira transação a ser executada.

Uma **árvore de merkle concorrente** é uma árvore de merkle que armazena um changelog (log de alterações) seguro das alterações mais recentes, juntamente com seu hash de raiz e a prova para derivá-lo. Quando várias transações no mesmo slot tentam modificar os dados folha, o registro de alterações pode ser usado como uma fonte de verdade para permitir que alterações concorrentes sejam feitas na árvore.

Ao trabalhar com uma árvore de Merkle concorrente, há três variáveis que determinam o tamanho da árvore, o custo para criar a árvore e o número de alterações concorrentes que podem ser feitas na árvore:

1. Profundidade máxima
2. Tamanho máximo do buffer
3. Profundidade do canopy

A **profundidade máxima** é o número máximo de saltos para ir de qualquer folha até a raiz da árvore. Como as árvores de Merkle são árvores binárias, cada folha está conectada somente a uma outra folha. A profundidade máxima pode, então, ser logicamente usada para calcular o número de nós da árvore com `2 ^ maxDepth`.

O **tamanho máximo do buffer** é efetivamente o número máximo de alterações concorrentes que podem ser feitas em uma árvore em um único slot com o hash raiz ainda válido.

A **profundidade do canopy** é o número de nós de prova armazenados onchain para qualquer caminho de prova. A verificação de qualquer folha requer o caminho completo de prova para a árvore. O caminho completo de prova é composto de um nó de prova para cada "camada" da árvore, ou seja, uma profundidade máxima de 14 significa que há 14 nós de prova. Cada nó de prova acrescenta 32 bytes a uma transação, de modo que árvores grandes excederiam rapidamente o limite máximo de tamanho da transação sem armazenar em cache os nós de prova onchain.

Cada um desses três valores, profundidade máxima, tamanho máximo do buffer e profundidade do canopy tem uma contrapartida. Aumentar qualquer um desses valores significa aumentar o tamanho da conta usada para armazenar a árvore, aumentando assim o custo de criação da árvore.

A escolha da profundidade máxima é bastante simples, pois está diretamente relacionada ao número de folhas e, portanto, à quantidade de dados que você pode armazenar. Se precisar de 1 milhão de cNFTs em uma única árvore, encontre a profundidade máxima que torna a seguinte expressão verdadeira: `2^maxDepth > 1 milhão`. A resposta é 20.

A escolha de um tamanho máximo de buffer é efetivamente uma questão de rendimento: quantas gravações concorrentes você precisa.

### Programas de Compactação de Estado SPL e Noop

O Programa de Compactação de Estado SPL existe para tornar o processo acima repetível e passível de composabilidade em todo o ecossistema Solana. Ele fornece instruções para inicializar árvores Merkle, gerenciar folhas de árvores (ou seja, adicionar, atualizar, remover dados) e verificar dados de folhas.

O Programa de Compactação de Estado também aproveita um programa "no op" (que não implementa nenhuma operação) separado, cuja finalidade principal é facilitar a indexação dos dados das folhas registrando-os no estado de livro-razão.

### Use o Estado de Livro-Razão para Armazenamento

O livro-razão Solana é uma lista de entradas que contém transações assinadas. Em teoria, isso pode ser rastreado até o bloco gênese. Isso significa efetivamente que todos os dados que já foram colocados em uma transação existem no livro-razão.

Quando você quiser armazenar dados compactados, passe-os para o programa State Compression ("Compactação de Estado"), onde eles são transformados em hash e emitidos como um "evento" para o programa Noop. O hash é então armazenado na árvore de Merkle concorrente correspondente. Como os dados passaram por uma transação e existem até mesmo nos logs do programa Noop, eles existirão para sempre no estado de livro-razão. 

### Indexar dados para facilitar a pesquisa

Em condições normais, você geralmente acessaria os dados onchain buscando a conta apropriada. No entanto, ao usar a compactação de estado, isso não é tão simples. 

Conforme mencionado acima, os dados agora existem no estado do livro-razão e não em uma conta. O lugar mais fácil para encontrar os dados completos é nos logs da instrução Noop, mas, embora esses dados existam, de certa forma, no estado do livro-razão para sempre, provavelmente ficarão inacessíveis por meio de validadores após um determinado período de tempo.

Para economizar espaço e aumentar o desempenho, os validadores não retêm todas as transações até o bloco gênese. O período específico de tempo em que você poderá acessar os logs de instrução Noop relacionados aos seus dados variará de acordo com o validador, mas, eventualmente, você perderá o acesso a eles se depender diretamente dos logs de instrução.

Tecnicamente, você *pode* reproduzir o estado da transação de volta ao bloco gênese, mas em média as equipes não farão isso e certamente não terão um bom desempenho. Em vez disso, você deve usar um indexador que observará os eventos enviados ao programa Noop e armazenará off-chain os dados relevantes. Dessa forma, você não precisa se preocupar com o fato de os dados antigos ficarem inacessíveis.

## Crie uma Coleção de cNFT

Saindo do contexto teórico, vamos voltar nossa atenção para o ponto principal desta lição: como criar uma coleção cNFT.

Felizmente, você pode usar as ferramentas criadas pela Solana Foundation, pela comunidade de desenvolvedores da Solana e pela Metaplex para simplificar o processo. Especificamente, usaremos o SDK `@solana/spl-account-compression`, o programa Bubblegum da Metaplex e o SDK TS correspondente do programa Bubblegum `@metaplex-foundation/mpl-bugglegum`.

<aside>
💡 No momento em que este artigo foi escrito, a equipe da Metaplex estava fazendo a transição para um novo SDK de cliente Bubblegum compatível com o umi, sua estrutura modular para criar e usar clientes JS para programas Solana. Não usaremos a versão umi do SDK nesta lição. Em vez disso, codificaremos nossa dependência para a versão 0.7 (`@metaplex-foundation/mpl-bubblegum@0.7`). Essa versão fornece funções auxiliares simples para a criação de instruções do Bubblegum.

</aside>

### Prepare os metadados

Antes de começar, você preparará os metadados do NFT de modo semelhante ao que faria se estivesse usando uma Candy Machine. Em sua essência, um NFT é simplesmente um token com metadados que seguem o padrão NFT. Em outras palavras, ele deve ter um formato parecido com este:

```json
{
  "name": "12_217_47",
  "symbol": "RGB",
  "description": "Random RGB Color",
  "seller_fee_basis_points": 0,
  "image": "https://raw.githubusercontent.com/ZYJLiu/rgb-png-generator/master/assets/12_217_47/12_217_47.png",
  "attributes": [
    {
      "trait_type": "R",
      "value": "12"
    },
    {
      "trait_type": "G",
      "value": "217"
    },
    {
      "trait_type": "B",
      "value": "47"
    }
  ]
}
```

Dependendo do seu caso de uso, talvez seja possível gerar isso dinamicamente ou talvez você queira ter um arquivo JSON preparado para cada cNFT com antecedência. Você também precisará de quaisquer outros ativos referenciados pelo JSON, como o url da `imagem` mostrado no exemplo acima. 

### Crie um NFT de Coleção

Se quiser que seus cNFTs façam parte de uma coleção, você precisará criar um NFT de coleção **antes** de começar a cunhar cNFTs. Esse é um NFT tradicional que atua como referência, unindo seus cNFTs em uma única coleção. Você pode criar esse NFT usando a biblioteca `@metaplex-foundation/js`. Apenas certifique-se de definir `isCollection` como `true`.

```tsx
const collectionNft = await metaplex.nfts().create({
    uri: someUri,
    name: "Collection NFT",
    sellerFeeBasisPoints: 0,
    updateAuthority: somePublicKey,
    mintAuthority: somePublicKey,
    tokenStandard: 0,
    symbol: "Collection",
    isMutable: true,
    isCollection: true,
})
```

### Crie uma conta Merkle Tree

Agora começamos a nos desviar do processo que você usaria ao criar NFTs tradicionais. O mecanismo de armazenamento onchain que você usa para a compactação de estado é uma conta que representa uma árvore de Merkle concorrente. Essa conta de árvore de Merkle pertence ao programa de Compactação de Estado SPL. Antes de fazer qualquer coisa relacionada a cNFTs, você precisa criar uma conta de árvore de Merkle vazia com o tamanho apropriado.

As variáveis que afetam o tamanho da conta são:

1. Profundidade máxima
2. Tamanho máximo do buffer
3. Profundidade do canopy

As duas primeiras variáveis devem ser escolhidas em um conjunto existente de pares válidos. A tabela abaixo mostra os pares válidos junto com o número de cNFTs que podem ser criados com esses valores.

| Max Depth | Max Buffer Size | Max Number of cNFTs |
| --- | --- | --- |
| 3 | 8 | 8 |
| 5 | 8 | 32 |
| 14 | 64 | 16,384 |
| 14 | 256 | 16,384 |
| 14 | 1,024 | 16,384 |
| 14 | 2,048 | 16,384 |
| 15 | 64 | 32,768 |
| 16 | 64 | 65,536 |
| 17 | 64 | 131,072 |
| 18 | 64 | 262,144 |
| 19 | 64 | 524,288 |
| 20 | 64 | 1,048,576 |
| 20 | 256 | 1,048,576 |
| 20 | 1,024 | 1,048,576 |
| 20 | 2,048 | 1,048,576 |
| 24 | 64 | 16,777,216 |
| 24 | 256 | 16,777,216 |
| 24 | 512 | 16,777,216 |
| 24 | 1,024 | 16,777,216 |
| 24 | 2,048 | 16,777,216 |
| 26 | 512 | 67,108,864 |
| 26 | 1,024 | 67,108,864 |
| 26 | 2,048 | 67,108,864 |
| 30 | 512 | 1,073,741,824 |
| 30 | 1,024 | 1,073,741,824 |
| 30 | 2,048 | 1,073,741,824 |

Observe que o número de cNFTs que podem ser armazenados na árvore depende inteiramente da profundidade máxima, enquanto o tamanho do buffer determinará o número de alterações concorrentes (cunhagens, transferências etc.) dentro do mesmo slot que podem ocorrer na árvore. Em outras palavras, escolha a profundidade máxima que corresponde ao número de NFTs que você precisa que a árvore armazene e, em seguida, escolha uma das opções para o tamanho máximo do buffer com base no tráfego que você espera que seja necessário suportar.

Em seguida, escolha a profundidade do canopy. Aumentar a profundidade do canopy aumenta a composabilidade de seus cNFTs. Sempre que o seu código ou o código de outro desenvolvedor tentar verificar um cNFT no futuro, o código terá que passar tantos nós de prova quanto o número de "camadas" na sua árvore. Portanto, para uma profundidade máxima de 20, você precisará passar 20 nós de prova. Isso não é apenas tedioso, mas como cada nó de prova tem 32 bytes, é possível atingir o tamanho máximo de transações muito rapidamente.

Por exemplo, se a sua árvore tiver uma profundidade de canopy muito pequena, um mercado de NFTs talvez só possa suportar transferências simples de NFTs em vez de suportar um sistema de lances onchain para seus cNFTs. O canopy efetivamente armazena em cache os nós de prova na cadeia para que você não tenha que passar todos eles para a transação, permitindo transações mais complexas.

O aumento de qualquer um desses três valores aumenta o tamanho da conta, aumentando assim, o custo associado à sua criação. Pese os benefícios adequadamente ao escolher os valores.

Depois de conhecer esses valores, você pode usar a função auxiliar `createAllocTreeIx` do SDK TS `@solana/spl-account-compression`  a fim de criar a instrução para criar a conta vazia.

```tsx
import { createAllocTreeIx } from "@solana/spl-account-compression"

const treeKeypair = Keypair.generate()

const allocTreeIx = await createAllocTreeIx(
  connection,
  treeKeypair.publicKey,
  payer.publicKey,
  { maxDepth: 20; maxBufferSize: 256 },
  canopyDepth
)
```

Observe que essa é simplesmente uma função auxiliar para calcular o tamanho exigido pela conta e criar a instrução a ser enviada ao Programa do Sistema para alocar a conta. Essa função ainda não interage com nenhum programa específico de compactação.

### Use o Bubblegum para Inicializar sua Árvore

Com a conta de árvore vazia criada, você usa o programa Bubblegum para inicializar a árvore. Além da conta de árvore de Merkle, o Bubblegum cria uma conta de configuração de árvore para adicionar rastreamento e funcionalidade específicos de cNFT.

A versão 0.7 do SDK TS `@metaplex-foundation/mpl-bubblegum` fornece a função auxiliar `createCreateTreeInstruction` para chamar a instrução `create_tree` no programa Bubblegum. Como parte da chamada, você precisará derivar o PDA `treeAuthority` esperado pelo programa. Esse PDA usa o endereço da árvore como uma semente.

```tsx
import {
	createAllocTreeIx,
	SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from "@solana/spl-account-compression"
import {
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
  createCreateTreeInstruction,
} from "@metaplex-foundation/mpl-bubblegum"

...

const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
  [treeKeypair.publicKey.toBuffer()],
  BUBBLEGUM_PROGRAM_ID
)

const createTreeIx = createCreateTreeInstruction(
  {
    treeAuthority,
    merkleTree: treeKeypair.publicKey,
    payer: payer.publicKey,
    treeCreator: payer.publicKey,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  },
  {
    maxBufferSize: 256,
    maxDepth: 20,
    public: false,
  },
  BUBBLEGUM_PROGRAM_ID
)
```

A lista abaixo mostra a entrada necessária para essa função auxiliar:

- `accounts` - Um objeto que representa as contas exigidas pela instrução. Isso inclui:
    - `treeAuthority` - O Bubblegum espera que seja um PDA derivado usando o endereço da árvore de Merkle como uma semente
    - `merkleTree` - A conta da árvore de Merkle
    - `payer` - O endereço que paga as taxas de transação, aluguel etc.
    - `treeCreator` - O endereço a ser listado como o criador da árvore
    - `logWrapper` - O programa a ser usado para expor os dados aos indexadores por meio de logs; esse deve ser o endereço do programa Noop do SPL, a menos que você tenha alguma outra implementação personalizada
    - `compressionProgram` - O programa de compactação a ser usado para inicializar a árvore de Merkle; deve ser o endereço do programa Compactação de Estado do SPL, a menos que você tenha outra implementação personalizada
- `args` - Um objeto que representa argumentos adicionais exigidos pela instrução. Isso inclui:
    - `maxBufferSize` - O tamanho máximo do buffer da árvore de Merkle
    - `maxDepth` - A profundidade máxima da árvore de Merkle
    - `public` - Quando definido como `true`, qualquer pessoa poderá extrair cNFTs da árvore; quando definido como `false`, somente o criador da árvore ou o delegatário da árvore poderá extrair cNFTs da árvore

Quando enviado, isso invocará a instrução `create_tree` no programa Bubblegum. Essa instrução faz três coisas:

1. Cria a conta PDA de configuração da árvore
2. Inicializa a conta de configuração da árvore com os valores iniciais apropriados
3. Emite uma CPI para o programa State Compression para inicializar a conta de árvore de Merkle vazia

Sinta-se à vontade para dar uma olhada no código do programa [aqui] (https://github.com/metaplex-foundation/mpl-bubblegum/blob/main/programs/bubblegum/program/src/lib.rs#L887).

### Cunhar cNFTs

Com a conta da árvore de Merkle e a conta correspondente de configuração da árvore do Bubblegum inicializadas, é possível cunhar cNFTs para a árvore. A instrução do Bubblegum a ser usada será `mint_v1` ou `mint_to_collection_v1`, dependendo se você deseja ou não que o cNFT cunhado faça parte de uma coleção.

A versão 0.7 do SDK TS `@metaplex-foundation/mpl-bubblegum` fornece as funções auxiliares `createMintV1Instruction` e `createMintToCollectionV1Instruction` para facilitar a criação das instruções.

Ambas as funções exigirão que você passe os metadados do NFT e uma lista de contas necessárias para cunhar o cNFT. Abaixo está um exemplo de cunhagem de uma coleção:

```tsx
const mintWithCollectionIx = createMintToCollectionV1Instruction(
  {
    payer: payer.publicKey,
    merkleTree: treeAddress,
    treeAuthority,
    treeDelegate: payer.publicKey,
    leafOwner: destination,
    leafDelegate: destination,
    collectionAuthority: payer.publicKey,
    collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID,
    collectionMint: collectionDetails.mint,
    collectionMetadata: collectionDetails.metadata,
    editionAccount: collectionDetails.masterEditionAccount,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    bubblegumSigner,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  },
  {
    metadataArgs: Object.assign(nftMetadata, {
      collection: { key: collectionDetails.mint, verified: false },
    }),
  }
)
```

Observe que há dois argumentos para a função auxiliar: `accounts` e `args`. O parâmetro `args` é simplesmente os metadados do NFT, enquanto `accounts` é um objeto que lista as contas exigidas pela instrução. É certo que há muitas delas:

- `payer` - a conta que pagará as taxas de transação, aluguel etc.
- `merkleTree` - a conta da árvore de Merkle
- `treeAuthority` - a autoridade da árvore; deve ser o mesmo PDA que você derivou anteriormente
- `treeDelegate` - o delegatário da árvore; geralmente é o criador da árvore
- `leafOwner` - o proprietário desejado do NFT compactado que está sendo cunhado
- `leafDelegate` - o delegatário desejado do NFT compactado que está sendo cunhado; geralmente é o proprietário da folha
- `collectionAuthority` - a autoridade do NFT de coleção
- `collectionAuthorityRecordPda` - PDA do registro de autoridade de coleta opcional; normalmente não há nenhum; nesse caso, você deve colocar o endereço do programa Bubblegum
- `collectionMint` - a conta de cunhagem para a coleção de NFT
- `collectionMetadata` - a conta de metadados da coleção de NFT
- `editionAccount` - a conta de edição principal da coleção de NFT
- `compressionProgram` - o programa de compactação a ser usado; deve ser o endereço do programa Compactação de Estado do SPL, a menos que você tenha alguma outra implementação personalizada
- `logWrapper` - o programa a ser usado para expor os dados aos indexadores por meio de logs; esse deve ser o endereço do programa Noop do SPL, a menos que você tenha outra implementação personalizada
- `bubblegumSigner` - um PDA usado pelo programa Bubblegrum para lidar com a verificação da coleta
- `tokenMetadataProgram` - o programa de metadados de token que foi usado para a coleção de NFT; geralmente é sempre o programa de metadados de token Metaplex

A cunhagem sem uma coleção requer menos contas, nenhuma das quais sendo exclusiva para cunhagem sem uma coleção. Você pode dar uma olhada no exemplo abaixo.

```tsx
const mintWithoutCollectionIx = createMintV1Instruction(
  {
    payer: payer.publicKey,
    merkleTree: treeAddress,
    treeAuthority,
    treeDelegate: payer.publicKey,
    leafOwner: destination,
    leafDelegate: destination,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    logWrapper: SPL_NOOP_PROGRAM_ID,
  },
  {
    message: nftMetadata,
  }
)
```

## Interaja com os cNFTs

É importante observar que os cNFTs *não* são tokens SPL. Isso significa que seu código precisa seguir convenções diferentes para lidar com a funcionalidade cNFT, como busca, consulta, transferência etc.

### Busca de dados do cNFT

A maneira mais simples de obter dados de um cNFT existente é usar o [API de Leitura Padrão de Ativos Digitais](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata) (API de Leitura). Observe que isso é separado do RPC JSON padrão. Para usar a API de Leitura, você precisará usar um provedor de RPC compatível. A Metaplex mantém uma lista (provavelmente não exaustiva) de [provedores RPC](https://developers.metaplex.com/bubblegum/rpcs) compatíveis com a API de Leitura. Nesta lição usaremos [Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) já que eles têm suporte gratuito para Devnet.

Para usar a API de Leitura para buscar um cNFT específico, você precisa ter o ID do ativo do cNFT. No entanto, depois de cunhar cNFTs, você terá no máximo duas informações:

1. A assinatura da transação
2. O índice da folha (possivelmente)

A única garantia real é que você terá a assinatura da transação. É **possível** localizar o índice de folha a partir daí, mas isso envolve uma análise bastante complexa. Resumindo, você deve recuperar os logs de instruções relevantes do programa Noop e analisá-los para encontrar o índice de folha. Abordaremos isso mais detalhadamente em uma lição futura. Por enquanto, presumiremos que você conheça o índice da folha.

Essa é uma suposição razoável para a maioria das cunhagens, uma vez que a cunhagem será controlada por seu código e pode ser configurada sequencialmente para que seu código possa rastrear qual índice será usado para cada cunhagem. Ou seja, a primeira cunhagem usará o índice 0, a segunda o índice 1 etc.

Depois de obter o índice da folha, você pode derivar o ID do ativo correspondente do cNFT. Ao usar o Bubblegum, o ID do ativo é um PDA derivado usando o ID do programa Bubblegum e as seguintes sementes:

1. A string estática `asset` representada na codificação utf8
2. O endereço da árvore de Merkle
3. O índice da folha

Basicamente, o indexador observa os registros de transações do programa Noop à medida que elas acontecem e armazena os metadados do cNFT que foram transformados em hash e armazenados na árvore de Merkle. Isso permite que eles apresentem esses dados quando solicitados. Esse ID de ativo é o que o indexador usa para identificar um ativo específico.

Para simplificar, você pode usar apenas a função auxiliar `getLeafAssetId` do SDK do Bubblegum. Com o ID do ativo, a obtenção do cNFT é bastante simples. Basta usar o método `getAsset` fornecido pelo provedor RPC compatível:

```tsx
const assetId = await getLeafAssetId(treeAddress, new BN(leafIndex))
const response = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAsset",
		params: {
			id: assetId,
		},
	}),
})

const { result } = await response.json()
console.log(JSON.stringify(result, null, 2))
```

Isso retornará um objeto JSON que abrange como os metadados onchain e off-chain de um NFT tradicional ficam quando combinados. Por exemplo, você pode encontrar os atributos do cNFT em `content.metadata.attributes` ou a imagem em `content.files.uri`.

### Consulte os cNFTs

A API de Leitura também inclui maneiras de obter vários ativos, fazer consultas por proprietário, criador e muito mais. Por exemplo, o Helius suporta os seguintes métodos:

- `getAsset`
- `getSignaturesForAsset`
- `searchAssets`
- `getAssetProof`
- `getAssetsByOwner`
- `getAssetsByAuthority`
- `getAssetsByCreator`
- `getAssetsByGroup`

Não abordaremos a maioria deles diretamente, mas não deixe de dar uma olhada nos documentos [Helius docs](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) para aprender como usá-los corretamente..

### Transfira os cNFTs

Assim como em uma transferência de token SPL padrão, a segurança é fundamental. Uma transferência de token SPL, no entanto, facilita muito a verificação da autoridade de transferência. Ela é incorporada ao programa de Token SPL e à assinatura padrão. A propriedade de um token compactado é mais difícil de ser verificada. A verificação real ocorrerá no lado do programa, mas o código do lado do cliente precisa fornecer informações adicionais para que isso seja possível.

Embora exista uma função auxiliar `createTransferInstruction` do Bubblegum, é necessário mais trabalho de montagem do que o normal. Especificamente, o programa Bubblegum precisa verificar se a totalidade dos dados do cNFT é o que o cliente afirma, antes que a transferência possa ocorrer. A totalidade dos dados do cNFT foi transformada em hash e armazenada como uma única folha na árvore de Merkle, e a árvore de Merkle é simplesmente um hash de todas as folhas e galhos da árvore. Por esse motivo, você não pode simplesmente informar ao programa qual conta deve ser examinada e fazer com que ele compare o campo `authority` ou `owner` dessa conta com o signatário da transação.

Em vez disso, você precisa fornecer a totalidade dos dados do cNFT e qualquer informação de prova da árvore de Merkle que não esteja armazenada no canopy. Dessa forma, o programa pode provar de forma independente que os dados do cNFT fornecidos e, portanto, o proprietário do cNFT, são precisos. Só então o programa poderá determinar com segurança se o signatário da transação deve, de fato, ter permissão para transferir o cNFT.

Em termos gerais, isso envolve um processo de cinco etapas:

1. Buscar os dados de ativos do cNFT no indexador
2. Buscar a prova do cNFT no indexador
3. Obter a conta da árvore de Merkle da blockchain Solana
4. Preparar a prova do ativo como uma lista de objetos `AccountMeta`.
5. Criar e enviar a instrução de transferência Bubblegum

As duas primeiras etapas são muito semelhantes. Usando seu provedor RPC compatível, use os métodos `getAsset` e `getAssetProof` para obter os dados do ativo e a prova, respectivamente.

```tsx
const assetDataResponse = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAsset",
			params: {
				id: assetId,
			},
		}),
	})
const assetData = (await assetDataResponse.json()).result

const assetProofResponse = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAssetProof",
			params: {
				id: assetId,
			},
		}),
	})
const assetProof = (await assetProofResponse.json()).result
```

A terceira etapa é buscar a conta da árvore de Merkle. A maneira mais simples de fazer isso é usar o tipo `ConcurrentMerkleTreeAccount` de `@solana/spl-account-compression`:

```tsx
const treePublicKey = new PublicKey(assetData.compression.tree)

const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
	connection,
	treePublicKey
)
```

A etapa quatro é a mais desafiadora do ponto de vista conceitual. Usando as três informações coletadas, você precisará montar o caminho da prova para a folha correspondente do cNFT. O caminho da prova é representado como contas passadas para a instrução do programa. O programa usa cada um dos endereços de conta como nós de prova para provar que os dados da folha são o que você diz que são.

A prova completa é fornecida pelo indexador, conforme mostrado acima em `assetProof`. No entanto, você pode excluir da prova o mesmo número de contas finais que o valor da profundidade do canopy.

```tsx
const canopyDepth = treeAccount.getCanopyDepth() || 0

const proofPath: AccountMeta[] = assetProof.proof
	.map((node: string) => ({
	pubkey: new PublicKey(node),
	isSigner: false,
	isWritable: false
}))
.slice(0, assetProof.proof.length - canopyDepth)
```

Por fim, você pode montar a instrução de transferência. A função auxiliar de instrução, `createTransferInstruction`, requer os seguintes argumentos:

- `accounts` - uma lista de contas de instrução, conforme esperado; elas são as seguintes:
    - `merkleTree` - a conta de árvore de Merkle
    - `treeAuthority` - a autoridade da árvore de Merkle
    - `leafOwner` - o proprietário da folha (cNFT) em questão
    - `leafDelegate` - o delegatário da folha (cNFT) em questão; se nenhum delegatário tiver sido adicionado, deverá ser o mesmo que `leafOwner`
    - `newLeafOwner` - o endereço do novo proprietário após a transferência
    - `logWrapper` - o programa a ser usado para expor os dados aos indexadores por meio de logs; esse deve ser o endereço do programa Noop do SPL, a menos que você tenha outra implementação personalizada
    - `compressionProgram` - o programa de compactação a ser usado; esse deve ser o endereço do programa Compactação de Estado do SPL, a menos que você tenha outra implementação personalizada
    - `anchorRemainingAccounts` - é aqui que você adiciona o caminho da prova
- `args` - argumentos adicionais exigidos pela instrução; eles são:
    - `root` - o nó raiz da árvore de Merkle da prova de ativos; isso é fornecido pelo indexador como uma string e deve ser convertido em bytes primeiro
    - `dataHash` - o hash dos dados do ativo recuperado do indexador; é fornecido pelo indexador como uma string e deve ser convertido em bytes primeiro
    - `creatorHash` - o hash do criador do cNFT recuperado do indexador; é fornecido pelo indexador como uma string e deve ser convertido em bytes primeiro
    - `nonce` - usado para garantir que não haja duas folhas com o mesmo hash; esse valor deve ser o mesmo que `index`
    - `index` - o índice em que a folha do cNFT está localizada na árvore de Merkle

Um exemplo disso é mostrado abaixo. Observe que as três primeiras linhas de código capturam informações adicionais aninhadas nos objetos mostrados anteriormente para que estejam prontas para serem usadas ao montar a instrução propriamente dita.

```tsx
const treeAuthority = treeAccount.getAuthority()
const leafOwner = new PublicKey(assetData.ownership.owner)
const leafDelegate = assetData.ownership.delegate
	? new PublicKey(assetData.ownership.delegate)
	: leafOwner

const transferIx = createTransferInstruction(
	{
		merkleTree: treePublicKey,
		treeAuthority,
		leafOwner,
		leafDelegate,
		newLeafOwner: receiver,
		logWrapper: SPL_NOOP_PROGRAM_ID,
		compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
		anchorRemainingAccounts: proofPath,
	},
	{
		root: [...new PublicKey(assetProof.root.trim()).toBytes()],
		dataHash: [...new PublicKey(assetData.compression.data_hash.trim()).toBytes()],
		creatorHash: [
			...new PublicKey(assetData.compression.creator_hash.trim()).toBytes(),
		],
		nonce: assetData.compression.leaf_id,
		index: assetData.compression.leaf_id,
	}
)
```

## Conclusão

Cobrimos as principais habilidades necessárias para interagir com cNFTs, mas não fomos totalmente abrangentes. Você também pode usar o Bubblegum para fazer coisas como queimar, verificar, delegar e muito mais. Não vamos examiná-los, mas essas instruções são semelhantes ao processo de cunhagem e transferência. Se precisar dessa funcionalidade adicional, dê uma olhada no [código-fonte do cliente Bubblegum](https://github.com/metaplex-foundation/mpl-bubblegum/tree/main/clients/js-solita) e aproveite as funções auxiliares que ele oferece.

Lembre-se de que a compactação é relativamente nova. As ferramentas disponíveis evoluirão rapidamente, mas os princípios que você aprendeu nesta lição provavelmente continuarão os mesmos. Esses princípios também podem ser ampliados para a compactação de estados arbitrários, portanto, certifique-se de dominá-los aqui para estar pronto para mais coisas divertidas em lições futuras!

# Demonstração

Vamos começar a praticar a criação e o trabalho com cNFTs. Juntos, criaremos um script tão simples quanto possível que nos permitirá cunhar uma coleção de cNFTs de uma árvore de Merkle.

### 1. Obtenha o código inicial

Para começar, clone o código inicial da branch `starter` de nosso [repositório Demo cNFT](https://github.com/Unboxed-Software/solana-cnft-demo).

`git clone [https://github.com/Unboxed-Software/solana-cnft-demo.git](https://github.com/Unboxed-Software/solana-cnft-demo.git)`

`cd solana-cnft-demo`

`npm install`

Dedique algum tempo para se familiarizar com o código inicial fornecido. O mais importante são as funções auxiliares fornecidas em `utils.ts` e os URIs fornecidos em `uri.ts`.

O arquivo `uri.ts` fornece 10 mil URIs que você pode usar para a parte dos metadados do NFT fora da cadeia. Você pode, é claro, criar seus próprios metadados. Mas esta lição não trata explicitamente da preparação de metadados, por isso fornecemos alguns para você.

O arquivo `utils.ts` tem algumas funções auxiliares para evitar que você escreva mais boilerplate desnecessário do que você precisa. Elas são as seguintes:

- O `getOrCreateKeypair` criará um novo par de chaves para você e o salvará em um arquivo `.env` ou, se já houver uma chave privada no arquivo `.env`, ele inicializará um par de chaves a partir dela.
- O `airdropSolIfNeeded` lançará um SOL da Devnet em um endereço especificado se o saldo desse endereço for inferior a 1 SOL.
- O `createNftMetadata` criará os metadados do NFT para uma determinada chave pública e índice de criador. Os metadados que ele está obtendo são apenas metadados fictícios usando o URI correspondente ao índice fornecido da lista de URIs `uri.ts`.
- O `getOrCreateCollectionNFT` buscará a coleção de NFTs do endereço especificado em `.env` ou, se não houver nenhuma, criará uma nova e adicionará o endereço a `.env`.

Por fim, há alguns procedimentos em `index.ts` que criam uma nova conexão Devnet, chamam `getOrCreateKeypair` para inicializar uma "carteira" e chamam `airdropSolIfNeeded` para depositar fundos na carteira se o saldo estiver baixo.

Escreveremos todo o nosso código no arquivo `index.ts`.

### 2. Crie a conta da árvore de Merkle

Começaremos criando a conta da árvore de Merkle. Vamos encapsular isso em uma função que eventualmente criará *e* inicializará a conta. Vamos colocá-la abaixo da nossa função `main` em `index.ts`. Vamos chamá-la de `createAndInitializeTree`. Para que essa função funcione, ela precisará dos seguintes parâmetros:

- `connection` - uma `Conexão` a ser usada para interagir com a rede.
- `payer` - um `Keypair` que pagará pelas transações.
- `maxDepthSizePair` - um `ValidDepthSizePair`. Esse tipo vem do `@solana/spl-account-compression`. É um objeto simples com as propriedades `maxDepth` e `maxBufferSize` que impõe uma combinação válida dos dois valores.
- `canopyDepth` - um número para a profundidade do canopy
    
    No corpo da função, geraremos um novo endereço para a árvore e, em seguida, criaremos a instrução para alocar uma nova conta de árvore de Merkle chamando `createAllocTreeIx` de `@solana/spl-account-compression`.
    

```tsx
async function createAndInitializeTree(
  connection: Connection,
  payer: Keypair,
  maxDepthSizePair: ValidDepthSizePair,
  canopyDepth: number
) {
	const treeKeypair = Keypair.generate()

	const allocTreeIx = await createAllocTreeIx(
    connection,
    treeKeypair.publicKey,
    payer.publicKey,
    maxDepthSizePair,
    canopyDepth
  )
}
```

### 3. Use o Bubblegum para inicializar a árvore de Merkle e criar a conta de configuração da árvore

Com a instrução para criar a árvore pronta, podemos criar uma instrução para invocar `create_tree` no programa Bubblegum. Isso inicializará a conta de árvore de Merkle *e* criará uma nova conta de configuração de árvore no programa Bubblegum.

Essa instrução precisa que forneçamos o seguinte:

- `accounts` - um objeto de contas necessárias; isso inclui:
    - `treeAuthority` - deve ser um PDA derivado com o endereço da árvore de Merkle e o programa Bubblegum
    - `merkleTree` - o endereço da árvore de Merkle
    - `payer` - o pagador da taxa de transação
    - `treeCreator` - o endereço do criador da árvore; faremos com que seja o mesmo que `payer`
    - `logWrapper` - faz com que seja o `SPL_NOOP_PROGRAM_ID`
    - `compressionProgram` - faz com que seja o `SPL_ACCOUNT_COMPRESSION_PROGRAM_ID`
- `args` - uma lista de argumentos de instrução; isso inclui:
    - `maxBufferSize` - o tamanho do buffer do parâmetro `maxDepthSizePair` da nossa função
    - `maxDepth` - a profundidade máxima do parâmetro `maxDepthSizePair` da nossa função
    - `public` - se a árvore deve ou não ser pública; definiremos como `false`

Por fim, podemos adicionar ambas as instruções a uma transação e enviá-la. Lembre-se de que a transação precisa ser assinada tanto pelo `payer` quanto pelo `treeKeypair`.

```tsx
async function createAndInitializeTree(
  connection: Connection,
  payer: Keypair,
  maxDepthSizePair: ValidDepthSizePair,
  canopyDepth: number
) {
	const treeKeypair = Keypair.generate()

	const allocTreeIx = await createAllocTreeIx(
    connection,
    treeKeypair.publicKey,
    payer.publicKey,
    maxDepthSizePair,
    canopyDepth
  )

	const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
    [treeKeypair.publicKey.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )

	const createTreeIx = createCreateTreeInstruction(
    {
      treeAuthority,
      merkleTree: treeKeypair.publicKey,
      payer: payer.publicKey,
      treeCreator: payer.publicKey,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    },
    {
      maxBufferSize: maxDepthSizePair.maxBufferSize,
      maxDepth: maxDepthSizePair.maxDepth,
      public: false,
    }
  )

	const tx = new Transaction().add(allocTreeIx, createTreeIx)
  tx.feePayer = payer.publicKey
  
  try {
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [treeKeypair, payer],
      {
        commitment: "confirmed",
        skipPreflight: true,
      }
    )

    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`)

    console.log("Tree Address:", treeKeypair.publicKey.toBase58())

    return treeKeypair.publicKey
  } catch (err: any) {
    console.error("\nFailed to create merkle tree:", err)
    throw err
  }
}
```

Se quiser testar o que você tem até agora, sinta-se à vontade para chamar `createAndInitializeTree` de `main` e fornecer valores pequenos para a profundidade máxima e o tamanho máximo do buffer.

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )
}
```

Lembre-se de que o SOL da Devnet é limitado, portanto, se você testar muitas vezes, poderá ficar sem o SOL da Devnet antes de chegarmos à cunhagem. Para testar, em seu terminal, execute o seguinte:

`npm run start`

### 4. Cunhe cNFTs para sua árvore

Acredite ou não, isso é tudo o que você precisa fazer para configurar sua árvore para compactar NFTs! Agora vamos voltar nossa atenção para a cunhagem.

Primeiro, vamos declarar uma função chamada `mintCompressedNftToCollection`. Ela precisará dos seguintes parâmetros:

- `connection` - uma `Connection` a ser usada para interagir com a rede.
- `payer` - um `Keypair` que pagará pelas transações.
- `treeAddress` - o endereço da árvore de Merkle
- `collectionDetails` - os detalhes da coleção como o tipo `CollectionDetails` do `utils.ts`
- `amount` - o número de cNFTs para cunhar

O corpo dessa função fará o seguinte:

1. Deriva a autoridade da árvore como antes. Novamente, esse é um PDA derivado do endereço da árvore de Merkle e do programa Bubblegum.
2. Deriva o `bubblegumSigner`. Esse é um PDA derivado da string `"collection_cpi"` e do programa Bubblegum e é essencial para a cunhagem de uma coleção.
3. Cria os metadados do cNFT chamando `createNftMetadata` em nosso arquivo `utils.ts`.
4. Cria a instrução mint chamando `createMintToCollectionV1Instruction` do SDK do Bubblegum.
5. Cria e envia uma transação com a instrução mint
6. Repete as etapas de 3 a 6 o número de vezes `amount`.

A instrução `createMintToCollectionV1Instruction` recebe dois argumentos: `accounts` e `args`. O último é simplesmente os metadados do NFT. Como em todas as instruções complexas, o principal obstáculo é saber quais contas devem ser fornecidas. Portanto, vamos examiná-las rapidamente:

- `payer` - a conta que pagará as taxas de transação, aluguel etc.
- `merkleTree` - a conta da árvore de Merkle
- `treeAuthority` - a autoridade da árvore; deve ser o mesmo PDA que você derivou anteriormente
- `treeDelegate` - o delegatário da árvore; geralmente é o mesmo que o criador da árvore
- `leafOwner` - o proprietário desejado da NFT compactada que está sendo cunhada
- `leafDelegate` - o delegatário desejado da NFT compactada que está sendo cunhada; geralmente é o proprietário da folha
- `collectionAuthority` - a autoridade da coleção de NFT
- `collectionAuthorityRecordPda` - PDA de registro de autoridade de coleção opcional; normalmente não há nenhum; nesse caso, você deve colocar o endereço do programa Bubblegum
- `collectionMint` - a conta da cunhagem para a coleção de NFT
- `collectionMetadata` - a conta de metadados da coleção de NFT
- `editionAccount` - a conta da edição principal da coleção de NFT
- `compressionProgram` - o programa de compactação a ser usado; esse deve ser o endereço do programa Compactação de Estado do SPL, a menos que você tenha outra implementação personalizada
- `logWrapper` - o programa a ser usado para expor os dados aos indexadores por meio de logs; esse deve ser o endereço do programa Noop do SPL, a menos que você tenha alguma outra implementação personalizada
- `bubblegumSigner` - um PDA usado pelo programa Bubblegum para lidar com a verificação da coleção
- `tokenMetadataProgram` - o programa de metadados de token que foi usado para a coleção de NFT; geralmente é sempre o programa Metaplex Token Metadata

Quando você juntar tudo isso, terá o seguinte:

```tsx
async function mintCompressedNftToCollection(
  connection: Connection,
  payer: Keypair,
  treeAddress: PublicKey,
  collectionDetails: CollectionDetails,
  amount: number
) {
  // Deriva o PDA de autoridade da árvore (conta 'TreeConfig' para a conta da árvore)
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [treeAddress.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )

  // Deriva o signatário do Bubblegum, usado pelo programa Bubblegum para lidar com a "verificação de coleção"
  // Usado somente para a instrução `createMintToCollectionV1`.
  const [bubblegumSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_cpi", "utf8")],
    BUBBLEGUM_PROGRAM_ID
  )

  for (let i = 0; i < amount; i++) {
    // Metadados de NFT Compactado
    const compressedNFTMetadata = createNftMetadata(payer.publicKey, i)

    // Crie a instrução para "cunhar" NFT compactado para a árvore
    const mintIx = createMintToCollectionV1Instruction(
      {
        payer: payer.publicKey, // A conta que pagará pela transação
        merkleTree: treeAddress, // O endereço da conta da árvore
        treeAuthority, // A autoridade da conta da árvore, deve ser um PDA derivado do endereço da conta da árvore
        treeDelegate: payer.publicKey, // O delegatário da conta da árvore, deve ser o mesmo que o criador da árvore por padrão
        leafOwner: payer.publicKey, // O proprietário do NFT compactado que está sendo cunhado para a árvore
        leafDelegate: payer.publicKey, // O delegatário do NFT compactado que está sendo cunhado na árvore
        collectionAuthority: payer.publicKey, // A autoridade da NFT de "coleção" 
        collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID, // Deve ser o ID do programa Bubblegum
        collectionMint: collectionDetails.mint, // A cunhagem do NFT de " coleção". 
        collectionMetadata: collectionDetails.metadata, // Os metadados do NFT de "coleção". 
        editionAccount: collectionDetails.masterEditionAccount, // A edição principal do NFT de "coleção"
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        bubblegumSigner,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      },
      {
        metadataArgs: Object.assign(compressedNFTMetadata, {
          collection: { key: collectionDetails.mint, verified: false },
        }),
      }
    )

    try {
      // Crie nova transação e adicione a instrução
      const tx = new Transaction().add(mintIx)

      // Defina o pagador da taxa para a transação
      tx.feePayer = payer.publicKey

      // Envie a transação
      const txSignature = await sendAndConfirmTransaction(
        connection,
        tx,
        [payer],
        { commitment: "confirmed", skipPreflight: true }
      )

      console.log(
        `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
      )
    } catch (err) {
      console.error("\nFailed to mint compressed NFT:", err)
      throw err
    }
  }
}
```

Esse é um ótimo momento para testar com uma árvore pequena. Basta atualizar o `main` para chamar `getOrCreateCollectionNFT` e, em seguida, `mintCompressedNftToCollection`:

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )

  const collectionNft = await getOrCreateCollectionNFT(connection, wallet)

  await mintCompressedNftToCollection(
    connection,
    wallet,
    treeAddress,
    collectionNft,
    2 ** maxDepthSizePair.maxDepth
  )
}
```

Novamente, para executar, digite em seu terminal: `npm run start`

### 5. Leia dados de cNFT existente

Agora que escrevemos o código para cunhar cNFTs, vamos ver se podemos de fato obter seus dados. Isso é complicado porque os dados na cadeia são apenas a conta da árvore de Merkle, cujos dados podem ser usados para verificar se as informações existentes são precisas, mas são inúteis para transmitir o que são as informações.

Vamos começar declarando uma função `logNftDetails` que recebe como parâmetros `treeAddress` e `nftsMinted`.

Neste momento, não temos um identificador direto de nenhum tipo que aponte para o nosso cNFT. Para obtê-lo, precisaremos conhecer o índice de folha que foi usado quando criamos nosso cNFT. Em seguida, podemos usá-lo para derivar o ID do ativo usado pela API de Leitura e, posteriormente, usar a API de Leitura para buscar os dados do nosso cNFT.

No nosso caso, criamos uma árvore não pública e criamos 8 cNFTs, portanto, sabemos que os índices de folha usados foram 0-7. Com isso, podemos usar a função `getLeafAssetId` de `@metaplex-foundation/mpl-bubblegum` para obter o ID do ativo.

Por fim, podemos usar um RPC compatível com a [API de Leitura](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata) para buscar o ativo. Usaremos o [Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api), mas fique à vontade para escolher seu próprio provedor RPC. Para usar o Helius, você precisará obter uma chave de API gratuita no [site deles](https://dev.helius.xyz/). Em seguida, adicione seu `RPC_URL` ao seu arquivo `.env`. Por exemplo:

```tsx
# Acrescente isso
RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

 Em seguida, basta emitir uma solicitação POST para o URL do RPC fornecido e colocar as informações `getAsset` no corpo:

```tsx
async function logNftDetails(treeAddress: PublicKey, nftsMinted: number) {
  for (let i = 0; i < nftsMinted; i++) {
    const assetId = await getLeafAssetId(treeAddress, new BN(i))
    console.log("Asset ID:", assetId.toBase58())
    const response = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const { result } = await response.json()
    console.log(JSON.stringify(result, null, 2))
  }
}
```

Essencialmente, o Helius observa os logs de transações à medida que elas acontecem e armazena os metadados NFT que possuem hash e que foram armazenados na árvore de Merkle. Isso permite que eles apresentem esses dados quando solicitados. 

Se adicionarmos uma chamada a essa função no final de `main` e executarmos novamente o script, os dados que receberemos de volta no console serão muito abrangentes. Eles incluem todos os dados que você esperaria na parte onchain e off-chain de um NFT tradicional. Você pode encontrar os atributos, os arquivos, as informações de propriedade e do criador do cNFT e muito mais.

```json
{
  "interface": "V1_NFT",
  "id": "48Bw561h1fGFK4JGPXnmksHp2fpniEL7hefEc6uLZPWN",
  "content": {
    "$schema": "https://schema.metaplex.com/nft1.0.json",
    "json_uri": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.json",
    "files": [
      {
        "uri": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png",
        "cdn_uri": "https://cdn.helius-rpc.com/cdn-cgi/image//https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png",
        "mime": "image/png"
      }
    ],
    "metadata": {
      "attributes": [
        {
          "value": "183",
          "trait_type": "R"
        },
        {
          "value": "89",
          "trait_type": "G"
        },
        {
          "value": "78",
          "trait_type": "B"
        }
      ],
      "description": "Random RGB Color",
      "name": "CNFT",
      "symbol": "CNFT"
    },
    "links": {
      "image": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png"
    }
  },
  "authorities": [
    {
      "address": "DeogHav5T2UV1zf5XuH4DTwwE5fZZt7Z4evytUUtDtHd",
      "scopes": [
        "full"
      ]
    }
  ],
  "compression": {
    "eligible": false,
    "compressed": true,
    "data_hash": "3RsXHMBDpUPojPLZuMyKgZ1kbhW81YSY3PYmPZhbAx8K",
    "creator_hash": "Di6ufEixhht76sxutC9528H7PaWuPz9hqTaCiQxoFdr",
    "asset_hash": "2TwWjQPdGc5oVripPRCazGBpAyC5Ar1cia8YKUERDepE",
    "tree": "7Ge8nhDv2FcmnpyfvuWPnawxquS6gSidum38oq91Q7vE",
    "seq": 8,
    "leaf_id": 7
  },
  "grouping": [
    {
      "group_key": "collection",
      "group_value": "9p2RqBUAadMznAFiBEawMJnKR9EkFV98wKgwAz8nxLmj"
    }
  ],
  "royalty": {
    "royalty_model": "creators",
    "target": null,
    "percent": 0,
    "basis_points": 0,
    "primary_sale_happened": false,
    "locked": false
  },
  "creators": [
    {
      "address": "HASk3AoTPAvC1KnXSo6Qm73zpkEtEhbmjLpXLgvyKBkR",
      "share": 100,
      "verified": false
    }
  ],
  "ownership": {
    "frozen": false,
    "delegated": false,
    "delegate": null,
    "ownership_model": "single",
    "owner": "HASk3AoTPAvC1KnXSo6Qm73zpkEtEhbmjLpXLgvyKBkR"
  },
  "supply": {
    "print_max_supply": 0,
    "print_current_supply": 0,
    "edition_nonce": 0
  },
  "mutable": false,
  "burnt": false
}
```

Lembre-se de que a API de Leitura também inclui maneiras de obter vários ativos, fazer consulta por proprietário, criador etc. e muito mais. Não deixe de dar uma olhada na seção de documentos do [Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) para ver o que está disponível.

### 6. Transfira um cNFT

A última coisa que adicionaremos ao nosso script é uma transferência de cNFT. Assim como em uma transferência de token SPL padrão, a segurança é fundamental. No entanto, diferentemente de uma transferência de token SPL padrão, para criar uma transferência segura com qualquer tipo de compactação de estado, o programa que realiza a transferência precisa dos dados completos do ativo.

O programa, neste caso, o Bubblegum, precisa receber todos os dados que foram criptografados e armazenados na folha correspondente *e* precisa receber o "caminho de prova" da folha em questão. Isso torna as transferências de cNFT um pouco mais complicadas do que as transferências de tokens SPL.

Lembre-se, as etapas gerais são:

1. Buscar os dados do ativo do cNFT no indexador
2. Buscar a prova do cNFT no indexador
3. Obter a conta da árvore de Merkle da blockchain Solana
4. Preparar a prova do ativo como uma lista de objetos `AccountMeta`.
5. Criar e enviar a instrução de transferência Bubblegum

Vamos começar declarando uma função `transferNft` que recebe o seguinte:

- `connection` - um objeto `Connection` 
- `assetId` - um objeto `PublicKey`
- `sender` - um objeto `Keypair` para que possamos assinar a transação
- `receiver` - um objeto `PublicKey` que representa o novo proprietário

Dentro dessa função, vamos buscar os dados do ativo novamente e, em seguida, buscar também a prova do ativo. Para garantir, vamos envolver tudo em um `try catch`.

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    const assetDataResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const assetData = (await assetDataResponse.json()).result

    const assetProofResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAssetProof",
        params: {
          id: assetId,
        },
      }),
    })
    const assetProof = (await assetProofResponse.json()).result
	} catch (err: any) {
    console.error("\nFailed to transfer nft:", err)
    throw err
	}
}
```

Em seguida, vamos buscar a conta da árvore de Merkle da cadeia, obter a profundidade do canopy e montar o caminho da prova. Fazemos isso mapeando a prova de ativos que obtivemos do Helius para uma lista de objetos `AccountMeta` e, em seguida, removendo todos os nós de prova do final que já estão armazenados em cache onchain no canopy.

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    ...

    const treePublicKey = new PublicKey(assetData.compression.tree)

    const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      treePublicKey
    )

    const canopyDepth = treeAccount.getCanopyDepth() || 0

    const proofPath: AccountMeta[] = assetProof.proof
      .map((node: string) => ({
        pubkey: new PublicKey(node),
        isSigner: false,
        isWritable: false,
      }))
      .slice(0, assetProof.proof.length - canopyDepth)
  } catch (err: any) {
    console.error("\nFailed to transfer nft:", err)
    throw err
  }
}
```

Por fim, criamos a instrução usando `createTransferInstruction`, a qual adicionamos a uma transação e, em seguida, assinamos e enviamos a transação. Esta é a aparência da função `transferNft` inteira quando concluída:

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    const assetDataResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const assetData = (await assetDataResponse.json()).result

    const assetProofResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAssetProof",
        params: {
          id: assetId,
        },
      }),
    })
    const assetProof = (await assetProofResponse.json()).result

    const treePublicKey = new PublicKey(assetData.compression.tree)

    const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      treePublicKey
    )

    const canopyDepth = treeAccount.getCanopyDepth() || 0

    const proofPath: AccountMeta[] = assetProof.proof
      .map((node: string) => ({
        pubkey: new PublicKey(node),
        isSigner: false,
        isWritable: false,
      }))
      .slice(0, assetProof.proof.length - canopyDepth)

    const treeAuthority = treeAccount.getAuthority()
    const leafOwner = new PublicKey(assetData.ownership.owner)
    const leafDelegate = assetData.ownership.delegate
      ? new PublicKey(assetData.ownership.delegate)
      : leafOwner

    const transferIx = createTransferInstruction(
      {
        merkleTree: treePublicKey,
        treeAuthority,
        leafOwner,
        leafDelegate,
        newLeafOwner: receiver,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        anchorRemainingAccounts: proofPath,
      },
      {
        root: [...new PublicKey(assetProof.root.trim()).toBytes()],
        dataHash: [
          ...new PublicKey(assetData.compression.data_hash.trim()).toBytes(),
        ],
        creatorHash: [
          ...new PublicKey(assetData.compression.creator_hash.trim()).toBytes(),
        ],
        nonce: assetData.compression.leaf_id,
        index: assetData.compression.leaf_id,
      }
    )

    const tx = new Transaction().add(transferIx)
    tx.feePayer = sender.publicKey
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [sender],
      {
        commitment: "confirmed",
        skipPreflight: true,
      }
    )
    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`)
  } catch (err: any) {
    console.error("\nFailed to transfer nft:", err)
    throw err
  }
}
```

Vamos transferir nosso primeiro NFT compactado no índice 0 para outra pessoa. Primeiro, precisamos criar outra carteira com alguns fundos e, em seguida, obter o ID do ativo no índice 0 usando `getLeafAssetId`. Em seguida, faremos a transferência. Por fim, imprimiremos toda a coleção usando nossa função `logNftDetails`. Você verá que o NFT no índice zero agora pertencerá à nossa nova carteira no campo `ownership`. 

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )

  const collectionNft = await getOrCreateCollectionNFT(connection, wallet)

  await mintCompressedNftToCollection(
    connection,
    wallet,
    treeAddress,
    collectionNft,
    2 ** maxDepthSizePair.maxDepth
  )

  const recieverWallet = await getOrCreateKeypair("Wallet_2")
  const assetId = await getLeafAssetId(treeAddress, new BN(0))
  await airdropSolIfNeeded(recieverWallet.publicKey)

  console.log(`Transfering ${assetId.toString()} from ${wallet.publicKey.toString()} to ${recieverWallet.publicKey.toString()}`)

  await transferNft(
    connection,
    assetId,
    wallet,
    recieverWallet.publicKey
  )

  await logNftDetails(treeAddress, 8)
}
```

Vá em frente e execute seu script. Tudo deve ser executado sem falhas, e tudo isso por cerca de 0,01 SOL!

Parabéns! Agora você sabe como cunhar, ler e transferir cNFTs. Se quiser, você pode atualizar a profundidade máxima, o tamanho máximo do buffer e a profundidade do canopy para valores maiores e, desde que tenha SOL suficiente da Devnet, esse script permitirá que você cunhe até 10 mil cNFTs por uma pequena fração do que custaria para cunhar 10 mil NFTs tradicionais (Observação: se você planeja cunhar uma grande quantidade de NFTs, talvez queira tentar executar essas instruções em lote para obter um total menor de transações).

Se precisar de mais tempo com essa demonstração, sinta-se à vontade para analisá-la novamente e/ou dar uma olhada no código da solução na branch `solution` do [repositório de demonstração](https://github.com/Unboxed-Software/solana-cnft-demo/tree/solution).

## Desafio

Agora é a sua vez de dar uma olhada nesses conceitos por conta própria! Não vamos ser excessivamente prescritivos neste momento, mas aqui estão algumas ideias:

1. Crie sua própria coleção de cNFTs de produção
2. Crie uma interface de usuário para a demonstração desta lição que permitirá que você crie e exiba um cNFT
3. Veja se você pode replicar algumas das funcionalidades do script de demonstração em um programa onchain, ou seja, escreva um programa que possa cunhar cNFTs

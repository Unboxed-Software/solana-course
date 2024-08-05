---
title: Serializando Dados de Instrução Personalizados
objectives:
- Explicar os conteúdos de uma transação
- Explicar as instruções de transação
- Explicar os fundamentos das otimizações de tempo de execução da Solana
- Explicar Borsh
- Usar Borsh para serializar dados do programa
---

# Resumo

- Transações são compostas por um array de instruções; uma única transação pode conter qualquer número de instruções, cada uma direcionada ao seu próprio programa. Quando uma transação é enviada, o tempo de execução da Solana processará suas instruções em ordem e de forma atômica, o que significa que se alguma das instruções falhar por qualquer motivo, a transação inteira falhará em seu processamento.
- Cada *instrução* é composta por 3 componentes: o ID do programa pretendido, um array de todas as contas envolvidas e um buffer de bytes de dados de instrução.
- Cada *transação* contém: um array de todas as contas que pretende ler ou escrever, uma ou mais instruções, um hash de bloco recente e uma ou mais assinaturas.
- Para passar dados de instrução de um cliente, eles devem ser serializados em um buffer de bytes. Para facilitar esse processo de serialização, usaremos o [Borsh](https://borsh.io/).
- Transações podem falhar em ser processadas pela blockchain por vários motivos; discutiremos alguns dos mais comuns aqui.

# Visão Geral

## Transações

Transações são a forma como enviamos informações para a blockchain para serem processadas. Até agora, aprendemos como criar transações muito básicas com funcionalidade limitada. Mas transações, e os programas aos quais são enviadas, podem ser projetados para serem muito mais flexíveis e lidar com muito mais complexidade do que lidamos até agora.

### Conteúdo da Transação

Cada transação contém:

- Um array que inclui todas as contas que pretende ler ou escrever
- Uma ou mais instruções
- Um hash de bloco recente
- Uma ou mais assinaturas

O `@solana/web3.js` simplifica esse processo para você, de modo que tudo o que você realmente precisa focar é adicionar instruções e assinaturas. A biblioteca constrói o array de contas com base nessas informações e lida com a lógica para incluir um hash de bloco recente.

## Instruções

Cada instrução contém:

- O ID de programa (chave pública) do programa pretendido
- Um array listando todas as contas que serão lidas ou escritas durante a execução
- Um buffer de bytes de dados de instrução

Identificar o programa por sua chave pública garante que a instrução seja realizada pelo programa correto.

Incluir um array de todas as contas que serão lidas ou escritas permite que a rede realize várias otimizações que permitem alta carga de transação e execução mais rápida.

O buffer de bytes permite passar dados externos para um programa.

Você pode incluir várias instruções em uma única transação. O tempo de execução da Solana processará essas instruções em ordem e de forma atômica. Em outras palavras, se cada instrução for bem-sucedida, então a transação como um todo será bem-sucedida, mas se uma única instrução falhar, então a transação inteira falhará imediatamente sem efeitos colaterais.

O array de contas não é apenas um array das chaves públicas das contas. Cada objeto no array inclui a chave pública da conta, se ela é signatária na transação e se pode ser escrita. Incluir se é possível escrever em uma conta ou não durante a execução de uma instrução permite que o tempo de execução facilite o processamento paralelo de contratos inteligentes. Como você deve definir quais contas são somente leitura e quais você escreverá, o tempo de execução pode determinar quais transações são não sobrepostas, ou somente leitura, e permitir que sejam executadas simultaneamente. Para saber mais sobre o tempo de execução da Solana, confira este [post do blog](https://solana.com/news/sealevel-\--parallel-processing-thousands-of-smart-contracts).

### Dados da Instrução

A capacidade de adicionar dados arbitrários a uma instrução garante que os programas possam ser dinâmicos e flexíveis o suficiente para uso amplo, da mesma forma que o corpo de uma solicitação HTTP permite construir APIs REST dinâmicas e flexíveis.

Assim como a estrutura do corpo de uma solicitação HTTP depende do ponto de extremidade que você pretende chamar, a estrutura do buffer de bytes usado como dados de instrução depende inteiramente do programa de destino. Se você está construindo um dApp full-stack por conta própria, precisará copiar a mesma estrutura que usou ao construir o programa para o código do lado do cliente. Se você estiver trabalhando com outro desenvolvedor que está lidando com o desenvolvimento do programa, vocês podem se coordenar para garantir layouts de buffer correspondentes.

Vamos pensar em um exemplo concreto. Imagine trabalhar em um jogo Web3 e ser responsável por escrever código do lado do cliente que interage com um programa de inventário de jogador. O programa foi projetado para permitir que o cliente:

- Adicione inventário com base nos resultados do jogador
- Transfira inventário de um jogador para outro
- Equipe um jogador com itens de inventário selecionados

Este programa teria sido estruturado de forma que cada um deles fosse encapsulado em sua própria função.

Cada programa, no entanto, tem apenas um ponto de entrada. Você instruiria o programa sobre qual dessas funções executar por meio dos dados da instrução.

Você também incluiria nos dados da instrução qualquer informação que a função precisa para executar corretamente, por exemplo, o ID de um item de inventário, um jogador para transferir inventário, etc.

Exatamente *como* esses dados seriam estruturados dependeria de como o programa foi escrito, mas é comum que o primeiro campo nos dados da instrução seja um número que o programa possa mapear para uma função, após o qual campos adicionais atuam como argumentos da função.

## Serialização

Além de saber quais informações incluir em um buffer de dados de instrução, você também precisa serializá-las corretamente. O serializador mais comum usado na Solana é o [Borsh](https://borsh.io). Conforme o site:

> Borsh significa Binary Object Representation Serializer for Hashing (Serializador de representação de objeto binário para hash). É destinado a ser usado em projetos críticos para a segurança, pois prioriza consistência, segurança, velocidade; e vem com uma especificação rigorosa.

Borsh mantém uma [biblioteca JS](https://github.com/near/borsh-js) que lida com a serialização de tipos comuns em um buffer. Também existem outros pacotes construídos em cima do borsh que tentam tornar esse processo ainda mais fácil. Usaremos a biblioteca `@project-serum/borsh` que pode ser instalada usando `npm`.

Construindo a partir do exemplo anterior do inventário de jogos, vamos olhar para um cenário hipotético onde estamos instruindo o programa a equipar um jogador com um determinado item. Suponha que o programa foi projetado para aceitar um buffer que representa uma estrutura com as seguintes propriedades:

1. `variant` como um inteiro de 8 bits sem sinal que instrui o programa qual instrução, ou função, executar.
2. `playerId` como um inteiro de 16 bits sem sinal que representa o ID do jogador que será equipado com o item fornecido.
3. `itemId` como um inteiro de 256 bits sem sinal que representa o ID do item que será equipado no jogador.

Tudo isso será passado como um buffer de bytes que será lido em ordem, então garantir a ordem correta do layout do buffer é crucial. Você criaria o esquema ou modelo do layout do buffer para o acima da seguinte forma:

```tsx
import * as borsh from '@project-serum/borsh'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])
```

Você pode então codificar dados usando esse esquema com o método `encode`. Esse método aceita como argumentos um objeto representando os dados a serem serializados e um buffer. No exemplo abaixo, alocamos um novo buffer, que é muito maior do que o necessário Em seguida, codificamos os dados nesse buffer e dividimos o buffer original em um novo buffer com o tamanho necessário.

```tsx
import * as borsh from '@project-serum/borsh'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))
```

Uma vez que um buffer é devidamente criado e os dados serializados, tudo o que resta é construir a transação. Isso é semelhante ao que você fez em lições anteriores. O exemplo abaixo presume que:

- `player`, `playerInfoAccount` e `PROGRAM_ID` já estão definidos em algum lugar fora do trecho de código
- `player` é a chave pública de um usuário
- `playerInfoAccount` é a chave pública da conta onde as alterações de inventário serão escritas
- `SystemProgram` será usado no processo de execução da instrução.

```tsx
import * as borsh from '@project-serum/borsh'
import * as web3 from '@solana/web3.js'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))

const endpoint = web3.clusterApiUrl('devnet')
const connection = new web3.Connection(endpoint)

const transaction = new web3.Transaction()
const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: player.publicKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: playerInfoAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    }
  ],
  data: instructionBuffer,
  programId: PROGRAM_ID
})

transaction.add(instruction)

web3.sendAndConfirmTransaction(connection, transaction, [player]).then((txid) => {
  console.log(`Transação enviada: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
})
```

# Demonstração

Vamos praticar isso juntos construindo um aplicativo de Avaliação de Filmes que permite aos usuários enviar uma avaliação de filme e armazená-la na rede Solana. Construiremos este aplicativo um pouco de cada vez ao longo das próximas lições, adicionando novas funcionalidades a cada lição.

![Interface do aplicativo de avaliação de filmes](../../assets/movie-reviews-frontend.png)

Aqui está um diagrama rápido do programa que construiremos:

![A Solana armazena itens de dados em PDAs, que podem ser encontrados por suas sementes](../../assets/movie-review-program.svg)

A chave pública do programa Solana que usaremos para este aplicativo é `CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN`.

### 1. Código inicial

Antes de começarmos, vá em frente e faça o download do [código inicial](https://github.com/Unboxed-Software/solana-movie-frontend/tree/starter).

O projeto é uma aplicação Next.js bastante simples. Ele inclui o `WalletContextProvider` que criamos na lição de Carteiras, um componente `Card` para exibir uma avaliação de filme, um componente `MovieList` que exibe avaliações em uma lista, um componente `Form` para enviar uma nova avaliação e um arquivo `Movie.ts` que contém uma definição de classe para um objeto `Movie`.

Observe que, por enquanto, os filmes exibidos na página quando você executa `npm run dev` são simulações. Nesta lição, nos concentraremos em adicionar uma nova avaliação, mas na verdade não poderemos ver essa avaliação exibida. Na próxima lição, nos concentraremos em desserializar dados personalizados de contas onchain.

### 2. Criando o layout do buffer

Lembre-se de que, para interagir adequadamente com um programa Solana, você precisa saber como ele espera que os dados sejam estruturados. Nosso programa de Avaliação de Filmes espera que os dados de instrução contenham:

1. `variant` como um inteiro de 8 bits sem sinal representando qual instrução deve ser executada (em outras palavras, qual função no programa deve ser chamada).
2. `title` como uma string representando o título do filme que você está avaliando.
3. `rating` como um inteiro de 8 bits sem sinal representando a avaliação de 1 a 5 que você está dando ao filme que está avaliando.
4. `description` como uma string representando a parte escrita da avaliação que você está deixando para o filme.

Vamos configurar um layout `borsh` na classe `Movie`. Comece importando `@project-serum/borsh`. Em seguida, crie uma propriedade `borshInstructionSchema` e defina-a para a estrutura `borsh` apropriada contendo as propriedades listadas acima.

```tsx
import * as borsh from '@project-serum/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  borshInstructionSchema = borsh.struct([
    borsh.u8('variant'),
    borsh.str('title'),
    borsh.u8('rating'),
    borsh.str('description'),
  ])
}
```

Lembre-se de que *a ordem importa*. Se a ordem das propriedades aqui for diferente de como o programa está estruturado, a transação falhará.

### 3. Criando um método para serializar dados

Agora que temos o layout do buffer configurado, vamos criar um método em `Movie` chamado `serialize()` que retornará um `Buffer` com as propriedades de um objeto `Movie` codificadas no layout apropriado.

```tsx
import * as borsh from '@project-serum/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  borshInstructionSchema = borsh.struct([
    borsh.u8('variant'),
    borsh.str('title'),
    borsh.u8('rating'),
    borsh.str('description'),
  ])

  serialize(): Buffer {
    const buffer = Buffer.alloc(1000)
    this.borshInstructionSchema.encode({ ...this, variant: 0 }, buffer)
    return buffer.slice(0, this.borshInstructionSchema.getSpan(buffer))
  }
}
```

O método mostrado acima primeiro cria um buffer grande o suficiente para o nosso objeto, em seguida, codifica `{ ...this, variant: 0 }` no buffer. Como a definição da classe `Movie` contém 3 das 4 propriedades exigidas pelo layout do buffer e usa os mesmos nomes, podemos usá-la diretamente com o operador de propagação e apenas adicionar a propriedade `variant`. Por fim, o método retorna um novo buffer que deixa de fora a parte não utilizada do original.

### 4. Enviando a transação quando o usuário enviar o formulário

Agora que temos os blocos de construção para os dados de instrução, podemos criar e enviar a transação quando um usuário enviar o formulário. Abra `Form.tsx` e localize a função `handleTransactionSubmit`. Esta é chamada por `handleSubmit` toda vez que um usuário envia o formulário de Avaliação de Filme.

Dentro desta função, estaremos criando e enviando a transação que contém os dados enviados através do formulário.

Comece importando `@solana/web3.js` e importando `useConnection` e `useWallet` de `@solana/wallet-adapter-react`.

```tsx
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
```

Em seguida, antes da função `handleSubmit`, chame `useConnection()` para obter um objeto `connection` e chame `useWallet()` para obter `publicKey` e `sendTransaction`.

```tsx
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'

const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export const Form: FC = () => {
  const [title, setTitle] = useState('')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const handleSubmit = (event: any) => {
    event.preventDefault()
    const movie = new Movie(title, rating, description)
    handleTransactionSubmit(movie)
  }

  ...
}
```

Antes de implementarmos `handleTransactionSubmit`, vamos falar sobre o que precisa ser feito. Precisamos:

1. Verificar se `publicKey` existe para garantir que o usuário conectou sua carteira.
2. Chamar `serialize()` em `movie` para obter um buffer representando os dados da instrução.
3. Criar um novo objeto `Transaction`.
4. Obter todas as contas que a transação lerá ou escreverá.
5. Criar um novo objeto `Instruction` que inclui todas essas contas no argumento `keys`, inclui o buffer no argumento `data` e inclui a chave pública do programa no argumento `programId`.
6. Adicionar a instrução do último passo à transação.
7. Chamar `sendTransaction`, passando a transação montada.

Isso é bastante coisa para processar! Mas não se preocupe, fica mais fácil quanto mais você faz isso. Vamos começar com os primeiros 3 passos acima:

```tsx
const handleTransactionSubmit = async (movie: Movie) => {
  if (!publicKey) {
    alert('Please connect your wallet!')
    return
  }

  const buffer = movie.serialize()
  const transaction = new web3.Transaction()
}
```

O próximo passo é obter todas as contas que a transação lerá ou escreverá. Nas lições anteriores, você recebeu a conta onde os dados serão armazenados. Desta vez, o endereço da conta é mais dinâmico, então precisa ser calculado. Cobriremos isso em detalhes na próxima lição, mas por enquanto você pode usar o seguinte, onde `pda` é o endereço para a conta onde os dados serão armazenados:

```tsx
const [pda] = await web3.PublicKey.findProgramAddress(
  [publicKey.toBuffer(), Buffer.from(movie.title)],
  new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
)
```

Além desta conta, o programa também precisará ler do `SystemProgram`, então nosso array também precisa incluir `web3.SystemProgram.programId`.

Com isso, podemos terminar as etapas restantes:

```tsx
const handleTransactionSubmit = async (movie: Movie) => {
  if (!publicKey) {
    alert('Por favor, conecte sua carteira!')
    return
  }

  const buffer = movie.serialize()
  const transaction = new web3.Transaction()

  const [pda] = await web3.PublicKey.findProgramAddress(
    [publicKey.toBuffer(), new TextEncoder().encode(movie.title)],
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
  )

  const instruction = new web3.TransactionInstruction({
    keys: [
      {
        pubkey: publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false
      }
    ],
    data: buffer,
    programId: new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
  })

  transaction.add(instruction)

  try {
    let txid = await sendTransaction(transaction, connection)
    console.log(`Transação enviada: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
  } catch (e) {
    alert(JSON.stringify(e))
  }
}
```

E é isso! Agora você deve ser capaz de usar o formulário no site para enviar uma avaliação de filme. Embora você não veja a interface do usuário atualizar para refletir a nova avaliação, você pode verificar os logs do programa da transação no Explorador da Solana para ver que foi bem-sucedida.

Se você precisar de um pouco mais de tempo com este projeto para se sentir confortável, dê uma olhada no [código da solução completa](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-serialize-instruction-data).

# Desafio

Agora é a sua vez de construir algo de forma independente. Crie um aplicativo que permita que os alunos deste curso se apresentem! O programa Solana que suporta isso está em `HdE95RSVsdb315jfJtaykXhXY478h53X6okDupVfY9yf`.

![Captura de tela da interface do programa Student Intros](../../assets/student-intros-frontend.png)

1. Você pode construir isso do zero ou pode [baixar o código inicial](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/starter).
2. Crie o layout do buffer de instrução em `StudentIntro.ts`. O programa espera que os dados da instrução contenham:
   1. `variant` como um inteiro de 8 bits sem sinal representando a instrução a ser executada (deve ser 0).
   2. `name` como uma string representando o nome do aluno.
   3. `message` como uma string representando a mensagem que o aluno está compartilhando sobre sua jornada na Solana.
3. Crie um método em `StudentIntro.ts` que usará o layout do buffer para serializar um objeto `StudentIntro`.
4. No componente `Form`, implemente a função `handleTransactionSubmit` de modo que serialize um `StudentIntro`, construa a transação e as instruções da transação apropriadas e submeta a transação à carteira do usuário.
5. Você agora deve ser capaz de enviar apresentações e ter as informações armazenadas na cadeia! Certifique-se de registrar o ID da transação e visualizá-la no Explorador da Solana para verificar se funcionou.

Se você ficar confuso, pode [consultar o código da solução](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data).

Sinta-se à vontade para ser criativo com esses desafios e levá-los ainda mais longe. As instruções não estão aqui para limitá-lo!

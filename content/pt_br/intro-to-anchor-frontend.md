---
title: Introdução ao desenvolvimento Anchor do lado do cliente
objectives:
- Usar um IDL para interagir com um programa Solana a partir do cliente
- Explicar um objeto `Provider` Anchor.
- Explicar um objeto `Program` Anchor.
- Usar o `MethodsBuilder` Anchor para criar instruções e transações
- Usar o Anchor para buscar contas
- Configurar um front-end para chamar instruções usando o Anchor e um IDL
---

# RESUMO

- Uma **IDL** é um arquivo que representa a estrutura de um programa Solana. Os programas escritos e criados com o Anchor geram automaticamente uma IDL correspondente. IDL significa Interface Description Language (linguagem de descrição de interface).
- O `@coral-xyz/anchor` é um cliente Typescript que inclui tudo o que você precisa para interagir com os programas Anchor
- Um objeto **Anchor `Provider`** combina uma `connection` a um cluster e uma `wallet` especificada para permitir a assinatura de transações
- Um objeto **Anchor `Program`** fornece uma API personalizada para interagir com um programa específico. Você cria uma instância `Program` usando a IDL e o `Provider` de um programa.
- O **Anchor `MethodsBuilder`** fornece uma interface simples por meio do `Program` para criar instruções e transações

# Visão Geral

O Anchor simplifica o processo de interação com os programas Solana a partir do cliente, fornecendo um arquivo IDL (Linguagem de descrição de interface) que reflete a estrutura de um programa. O uso da IDL em conjunto com a biblioteca Typescript do Anchor (`@coral-xyz/anchor`) fornece um formato simplificado para a criação de instruções e transações.

```tsx
// envia a transação
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

Isso funciona de qualquer cliente Typescript, seja em um frontend ou testes de integração. Nesta lição, veremos como usar o `@coral-xyz/anchor` para simplificar a interação de seu programa no lado do cliente.

## Estrutura Anchor do lado do cliente

Vamos começar examinando a estrutura básica da biblioteca Typescript do Anchor. O principal objeto que você usará é o objeto `Program`. Uma instância `Program` representa um programa Solana específico e fornece uma API personalizada para leitura e gravação no programa.

Para criar uma instância de `Program`, você precisará do seguinte:

- IDL - arquivo que representa a estrutura de um programa.
- `Connection` - a conexão do cluster.
- `Wallet` - par de chaves padrão usado para pagar e assinar transações.
- `Provider` - encapsula o `Connection` em um cluster Solana e uma `Wallet`.
- `ProgramId` - o endereço do programa onchain

![estrutura Anchor](../assets/anchor-client-structure.png)

A figura acima mostra como cada uma dessas peças é combinada para criar uma instância `Program`. Examinaremos cada uma delas individualmente para ter uma ideia melhor de como tudo se encaixa.

### Linguagem de Descrição de Interface (IDL)

Quando você cria um programa Anchor, o Anchor gera um arquivo JSON e Typescript que representa a IDL do seu programa. A IDL representa a estrutura do programa e pode ser usada por um cliente para inferir como interagir com um programa específico.

Embora não seja automático, você também pode gerar uma IDL a partir de um programa Solana nativo usando ferramentas como [shank](https://github.com/metaplex-foundation/shank) da Metaplex. 

Para ter uma ideia das informações que uma IDL fornece, aqui está a IDL do programa counter que você criou anteriormente:

```json
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

Ao inspecionar a IDL, você pode ver que esse programa contém duas instruções (`initialize` e `increment`).

Observe que, além de especificar as instruções, ele especifica as contas e entradas para cada instrução. A instrução `initialize` requer três contas:

1. `counter` - a nova conta que está sendo inicializada na instrução
2. `user` - o pagador da transação e da inicialização
3. `systemProgram` - o programa do sistema que é chamado para inicializar uma nova conta

E a instrução `increment` requer duas contas:

1. `counter` - uma conta existente para incrementar o campo `count` (contagem)
2. `user` - o pagador da transação

Ao examinar a IDL, você pode ver que em ambas as instruções o `user` é necessário como signatário porque o sinalizador `isSigner` está definido como `true`. Além disso, nenhuma das instruções exige dados de instrução adicionais, pois a seção `args` está em branco para ambas.

Observando a seção `accounts`, é possível ver que o programa contém um tipo de conta chamado `Counter` com um único campo `count` do tipo `u64`.

Embora a IDL não forneça os detalhes de implementação de cada instrução, podemos ter uma ideia básica de como o programa onchain espera que as instruções sejam construídas e podemos ver a estrutura das contas do programa.

Independentemente de como você o obtenha, você precisa de um arquivo IDL para interagir com um programa que use o pacote `@coral-xyz/anchor`. Para usar a IDL, você precisará incluir o arquivo IDL em seu projeto e, em seguida, importar o arquivo.

```tsx
import idl from "./idl.json"
```

### Objeto Provider

Antes de criar um objeto `Program` usando a IDL, você precisa primeiro criar um objeto `Provider` Anchor.

O objeto `Provider` combina duas coisas:

- `Connection` - a conexão com um cluster Solana (ou seja, localhost, devnet, mainnet)
- `Wallet` - um endereço específico usado para pagar e assinar transações

O `Provider` pode então enviar transações para a blockchain Solana em nome de uma `Wallet`, incluindo a assinatura da carteira nas transações de saída. Ao usar um frontend com um provedor de carteira Solana, todas as transações de saída ainda devem ser aprovadas pelo usuário por meio da extensão do navegador da carteira.

A configuração do `Wallet` e do `Connection` seria mais ou menos assim:

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"

const { connection } = useConnection()
const wallet = useAnchorWallet()
```

Para configurar a conexão, você pode usar o gancho `useConnection` de `@solana/wallet-adapter-react` para obter a `Connection` em um cluster Solana.

Observe que o objeto `Wallet` fornecido pelo gancho `useWallet` do `@solana/wallet-adapter-react` não é compatível com o objeto `Wallet` que o `Provider` do Anchor espera. No entanto, o `@solana/wallet-adapter-react` também fornece um gancho `useAnchorWallet`.

Para fins de comparação, aqui está o `AnchorWallet` do `useAnchorWallet`:

```tsx
export interface AnchorWallet {
  publicKey: PublicKey
  signTransaction(transaction: Transaction): Promise<Transaction>
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>
}
```

E o `WalletContextState` do `useWallet`:

```tsx
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

O `WalletContextState` oferece muito mais funcionalidades em comparação com o `AnchorWallet`, mas o `AnchorWallet` é necessário para configurar o objeto `Provider`.

Para criar o objeto `Provider`, você usa o `AnchorProvider` do `@coral-xyz/anchor`.

O construtor `AnchorProvider` recebe três parâmetros:

- `connection` - o `Connection` para o cluster do Solana
- `wallet` - o objeto `Wallet`
- `opts` - parâmetro opcional que especifica as opções de confirmação, usando uma configuração padrão se não for fornecida uma.

Depois de criar o objeto `Provider`, você o define como o provedor padrão usando `setProvider`.

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { AnchorProvider, setProvider } from "@coral-xyz/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()
const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)
```

### Programa

Depois de ter a IDL e um provedor, você pode criar uma instância do `Program`. O construtor requer três parâmetros:

- `idl` - a IDL como tipo `Idl`.
- `programId` - o endereço onchain do programa como uma `string` ou `PublicKey`.
- `Provider` - o provedor discutido na seção anterior.

O objeto `Program` cria uma API personalizada que você pode usar para interagir com um programa Solana. Essa API é o ponto de parada único para todas as coisas relacionadas à comunicação com programas onchain. Entre outras coisas, você pode enviar transações, buscar contas desserializadas, decodificar dados de instrução, assinar alterações de conta e ouvir eventos. Você também pode [aprender mais sobre a classe do `Program`](https://coral-xyz.github.io/anchor/ts/classes/Program.html#constructor).

Para criar o objeto `Program`, primeiro importe `Program` e `Idl` de `@coral-xyz/anchor`. O `Idl` é um tipo que pode ser usado quando se trabalha com Typescript.

Em seguida, especifique o `programId` do programa. Temos que declarar explicitamente o `programId`, pois pode haver vários programas com a mesma estrutura IDL (ou seja, se o mesmo programa for implantado várias vezes usando endereços diferentes). Ao criar o objeto `Program`, o `Provider` padrão é usado se não for explicitamente especificado.

Em suma, a configuração final é mais ou menos assim:

```tsx
import idl from "./idl.json"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  Program,
  Idl,
  AnchorProvider,
  setProvider,
} from "@coral-xyz/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()

const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)

const programId = new PublicKey("JPLockxtkngHkaQT5AuRYow3HyUv5qWzmhwsCPd653n")
const program = new Program(idl as Idl, programId)
```

## `MethodsBuilder` Anchor

Uma vez que o objeto `Program` esteja configurado, você poderá usar o Methods Builder Anchor para criar instruções e transações relacionadas ao programa. O `MethodsBuilder` utiliza a IDL para fornecer um formato simplificado para a criação de transações que invocam as instruções do programa.

Observe que a convenção de nomenclatura _camel case_ é usada ao interagir com um programa a partir do cliente, em comparação com a convenção de nomenclatura _snake case_ usada ao escrever o programa no rust.

O formato básico do `MethodsBuilder` tem a seguinte aparência:

```tsx
// envia a transação
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

Indo passo a passo, você:

1. Chama `methods` no `program` - esta é a API do construtor para criar chamadas de instruções relacionadas à IDL do programa.
2. Chama o nome da instrução como `.instructionName(instructionDataInputs)` - simplesmente chame a instrução usando a sintaxe de ponto e o nome da instrução, passando quaisquer argumentos de instrução como valores separados por vírgula.
3. Chama `accounts` - usando a sintaxe de ponto, chama `.accounts`, passando um objeto com cada conta que a instrução espera com base na IDL.
4. Opcionalmente, chama `signers` - usando a sintaxe de ponto, chama `.signers`, passando um array de signatários adicionais exigidos pela instrução.
5. Chama `rpc` - esse método cria e envia uma transação assinada com a instrução especificada e retorna uma `TransactionSignature`. Ao utilizar `.rpc`, a `Wallet` do `Provider` é automaticamente incluída como signatário e não precisa ser listada explicitamente.
Observe que, se nenhuma assinatura adicional for exigida pela instrução além da `Wallet` especificada com o `Provider`, a linha `.signer([])` poderá ser excluída.

Você também pode criar a transação diretamente, alterando `.rpc()` para `.transaction()`. Isso cria um objeto `Transaction` usando a instrução especificada.

```tsx
// cria uma transação
const transaction = await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .transaction()

await sendTransaction(transaction, connection)
```

Da mesma forma, você pode usar o mesmo formato para criar uma instrução usando `.instruction()` e, em seguida, adicionar manualmente as instruções a uma nova transação. Isso cria um objeto `TransactionInstruction` usando a instrução especificada.

```tsx
// cria a primeira instrução
const instructionOne = await program.methods
  .instructionOneName(instructionOneDataInputs)
  .accounts({})
  .instruction()

// cria a segunda instrução
const instructionTwo = await program.methods
  .instructionTwoName(instructionTwoDataInputs)
  .accounts({})
  .instruction()

// adiciona ambas instruções para uma transação
const transaction = new Transaction().add(instructionOne, instructionTwo)

// envia a transaçãpo
await sendTransaction(transaction, connection)
```

Em resumo, o `MethodsBuilder` do Anchor oferece uma maneira simplificada e mais flexível de interagir com programas onchain. Você pode criar uma instrução, uma transação ou criar e enviar uma transação usando basicamente o mesmo formato, sem precisar serializar ou desserializar manualmente as contas ou os dados da instrução.

## Busque contas de programa

O objeto `Program` também permite que você busque e filtre facilmente as contas do programa. Basta chamar `account` em `program` e especificar o nome do tipo de conta, conforme aparece na IDL. Em seguida, o Anchor desserializa e retorna todas as contas conforme especificado.

O exemplo abaixo mostra como você pode obter todas as contas `counter` existentes para o programa Counter.

```tsx
const accounts = await program.account.counter.all()
```

Você também pode aplicar um filtro utilizando `memcmp` e, em seguida, especificando um `offset` e os `bytes` a serem filtrados. 

O exemplo abaixo busca todas as contas `counter` com `count` igual a 0. Observe que o `offset` de 8 é para o discriminador de 8 bytes que o Anchor usa para identificar os tipos de conta. O 9º byte é onde o campo `count` começa. Você pode consultar a IDL para ver que o próximo byte armazena o campo `count` do tipo `u64`. Em seguida, o Anchor filtra e retorna todas as contas com bytes correspondentes na mesma posição.

```tsx
const accounts = await program.account.counter.all([
    {
        memcmp: {
            offset: 8,
            bytes: bs58.encode((new BN(0, 'le')).toArray()),
        },
    },
])
```

Como alternativa, você também pode obter os dados desserializados da conta para uma conta específica usando `fetch` se souber o endereço da conta que está procurando. 

```tsx
const account = await program.account.counter.fetch(ACCOUNT_ADDRESS)
```

Da mesma forma, você pode buscar várias contas usando `fetchMultiple`.

```tsx
const accounts = await program.account.counter.fetchMultiple([ACCOUNT_ADDRESS_ONE, ACCOUNT_ADDRESS_TWO])
```

# Demonstração

Vamos praticar isso juntos criando um frontend para o programa Counter da última lição. Como lembrete, o programa Counter tem duas instruções:

- `initialize` - inicializa uma nova conta `Counter` e define o `count` como `0`.
- `increment` - aumenta o `count` em uma conta `Counter` existente.

### 1. Faça download do código inicial

Faça download [do código inicial para este projeto](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/starter). Quando tiver o código inicial, dê uma olhada. Instale as dependências com `npm install` e, em seguida, execute o aplicativo com `npm run dev`.

Este projeto é um aplicativo Next.js simples. Ele inclui o `WalletContextProvider` que criamos na [lição Wallets](https://github.com/Unboxed-Software/solana-course/blob/main/content/interact-with-wallets.md), o arquivo `idl.json` para o programa Counter e os componentes `Initialize` e `Increment` que serão construídos durante esta demonstração. O `programId` que o programa invocará também está incluído no código inicial.

### 2. `Initialize`

Para começar, vamos concluir a configuração para criar o objeto `Program` no componente `Initialize.tsx`.

Lembre-se de que precisaremos de uma instância de `Program` para usar o `MethodsBuilder` Anchor para invocar as instruções em nosso programa. Para isso, precisaremos de uma carteira Anchor e de uma conexão, que podemos obter com os hooks `useAnchorWallet` e `useConnection`. Vamos criar também um `useState` para capturar a instância do programa.

```tsx
export const Initialize: FC<Props> = ({ setCounter }) => {
  const [program, setProgram] = useState("")

  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  ...
}
```

Com isso, podemos trabalhar na criação da instância real do `Program`. Vamos fazer isso em um `useEffect`.

Primeiro, precisamos obter o provedor padrão, se ele já existir, ou criá-lo, se não existir. Podemos fazer isso chamando `getProvider` dentro de um bloco try/catch. Se for lançado um erro, isso significa que não há um provedor padrão e que precisamos criar um.

Quando tivermos um provedor, poderemos construir uma instância `Program`.

```tsx
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

Agora que terminamos a configuração Anchor, podemos de fato invocar a instrução `initialize` do programa. Faremos isso dentro da função `onClick`.

Primeiro, precisaremos gerar um novo `Keypair` para a nova conta `Counter`, pois estamos inicializando uma conta pela primeira vez.

Em seguida, podemos usar o  `MethodsBuilder` Anchor para criar e enviar uma nova transação. Lembre-se de que o Anchor pode inferir algumas das contas necessárias, como a `user` e a `systemAccount`. Entretanto, ele não pode inferir a conta `counter` porque a geramos dinamicamente. Portanto, você precisará adicioná-la com `.accounts`. Você também precisará adicionar esse par de chaves como uma assinatura com `.signers`. Por fim, você pode usar `.rpc()` para enviar a transação para a carteira do usuário.

Depois que a transação for concluída, chame `setUrl` com o URL do explorador e, em seguida, chame `setCounter`, passando para a conta counter.

```tsx
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

### 3. `Increment`

Em seguida, vamos passar para o componente `Increment.tsx`. Assim como antes, conclua a configuração para criar o objeto `Program`. Além de chamar `setProgram`, o `useEffect` deve chamar `refreshCount`.

Adicione o seguinte código para a configuração inicial:

```tsx
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

Em seguida, vamos usar o Anchor `MethodsBuilder` para criar uma nova instrução para invocar a instrução `increment`. Novamente, o Anchor pode inferir a conta `user` a partir da carteira, portanto, só precisamos incluir a conta `counter`.

```tsx
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

### 5. Exiba a conta correta

Agora que podemos inicializar o programa counter e incrementar a contagem, precisamos fazer com que a interface do usuário mostre a contagem armazenada na conta counter.

Mostraremos como verificar as alterações na conta em uma lição futura, mas, por enquanto, temos apenas um botão que chama `refreshCount` no qual você possa clicar e ver a nova contagem após cada invocação de `increment`.

Dentro de `refreshCount`, vamos usar `program` para buscar a conta counter e, em seguida, usar `setCount` para definir a contagem com o número armazenado no programa:

```tsx
const refreshCount = async (program) => {
  const counterAccount = await program.account.counter.fetch(counter)
  setCount(counterAccount.count.toNumber())
}
```

Super simples com o Anchor!

### 5. Teste o frontend

Neste ponto, tudo deve estar funcionando! Você pode testar o frontend executando `npm run dev`.

1. Conecte sua carteira e você deve ver o botão `Initialize Counter`.
2. Clique no botão `Initialize Counter` e, em seguida, aprove a transação.
3. Em seguida, você verá um link na parte inferior da tela do Solana Explorer para a transação `initialize`. O botão `Increment Counter`, o botão `Refresh Count` e a contagem também devem aparecer.
4. Clique no botão `Increment Counter` e, em seguida, aprove a transação.
5. Aguarde alguns segundos e clique em `Refresh Count`. A contagem deverá ser incrementada na tela.

![Gif de Demonstração do Frontend do Anchor](../assets/anchor-frontend-demo.gif)

Fique à vontade para clicar nos links para inspecionar os registros do programa de cada transação!

![Captura de tela do Log do Programa de Initialize](../assets/anchor-frontend-initialize.png)

![Captura de tela do log do Programa Increment](../assets/anchor-frontend-increment.png)

Parabéns, agora você sabe como configurar um frontend para invocar um programa Solana usando uma IDL Anchor.

Se precisar de mais tempo com este projeto para se sentir confortável com esses conceitos, fique à vontade para dar uma olhada no [código de solução na branch `solution-increment`](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-increment) antes de continuar.

# Desafio

Agora é sua vez de criar algo de forma independente. Com base no que fizemos na demonstração, tente criar um novo componente no frontend que implemente um botão para diminuir o contador.

Antes de criar o componente no frontend, você precisará primeiro:

1. Criar e implantar um novo programa que implemente uma instrução `decrement`.
2. Atualizar o arquivo IDL no front-end com o do seu novo programa.
3. Atualizar o `programId` com o do seu novo programa.

Se precisar de ajuda, sinta-se à vontade para [consultar este programa](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

Tente fazer isso de forma independente, se puder! Mas se você travar, sinta-se à vontade para consultar o [código de solução](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-decrement).

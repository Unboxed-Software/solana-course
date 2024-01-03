---
title: Trocando Tokens com o Programa de Troca de Tokens
objectives:
- Criar um pool de troca de tokens
- Depositar liquidez
- Retirar liquidez
- Trocar tokens
---

# Resumo

- O **Programa de Troca de Tokens** é um contrato SPL implantado na Devnet disponível para testes e experimentação por desenvolvedores e protocolos. Para casos de uso em produção, use sua própria implantação ou uma mantida regularmente por um serviço de reputação.
- O programa aceita seis diferentes **instruções**, todas as quais exploraremos nesta lição.
- Os desenvolvedores podem criar e usar **pools de liquidez** para trocar entre qualquer token SPL que desejarem.
- O programa usa uma fórmula matemática chamada "**curva**" para calcular o preço de todas as negociações. As curvas visam imitar a dinâmica normal do mercado: por exemplo, à medida que os comerciantes compram muitos de um tipo de token, o valor do outro tipo de token sobe.

# Visão Geral

## Pools de Troca

Antes de entrarmos em como criar e interagir com pools de troca na Solana, é importante entendermos o básico do que é um pool de troca. Um pool de troca é uma agregação de dois tokens diferentes com o objetivo de fornecer liquidez para facilitar a troca entre cada token.

Os usuários fornecem liquidez a esses pools depositando seus próprios tokens em cada pool. Esses usuários são chamados de provedores de liquidez. Quando um provedor de liquidez (ou LP) deposita alguns tokens no pool de troca, tokens LP são cunhados que representam a propriedade fracionada do LP no pool.

A maioria dos pools de troca cobra uma taxa de negociação para facilitar cada troca. Essas taxas são então pagas aos LPs proporcionalmente à quantidade de liquidez que estão fornecendo no pool. Isso fornece incentivo para os LPs fornecerem liquidez ao pool.

Quando um LP está pronto para retirar sua liquidez depositada, seus tokens LP são queimados e tokens do pool (proporcional à quantidade de tokens LP queimados) são enviados para sua carteira.

O objetivo dos pools de troca é facilitar o comércio descentralizado entre usuários. No mercado financeiro tradicional, os usuários executam negociações como essa por meio de uma exchange centralizada em um  [livro de ordens](https://www.investopedia.com/terms/o/order-book.asp) de limite centralizado. Geralmente, isso requer um intermediário terceirizado confiável.

Devido à natureza descentralizada das criptomoedas, no entanto, agora temos uma nova maneira de facilitar as negociações. Muitos protocolos de exchanges descentralizadas foram construídos para aproveitar isso. O [Project Serum](https://www.projectserum.com/) é um exemplo de tal livro de ofertas de limite centralizado descentralizado construído na Solana.

Como os pools de troca são completamente descentralizados, qualquer pessoa pode emitir instruções para o programa de troca para criar um novo pool de troca entre quaisquer tokens SPL que desejar. Isso é um grande avanço em relação ao mercado financeiro tradicional. Pools de troca e Criadores de Mercado Automatizados (AMMs) são um dos tópicos mais fascinantes e complexos do DeFi. Os detalhes minuciosos de como eles funcionam estão fora do escopo desta lição, mas há uma tonelada de material disponível para você se estiver interessado em aprender mais. Por exemplo, o Programa de Troca de Tokens da Solana foi fortemente inspirado pela [Uniswap](https://uniswap.org/) e pelo [Balancer](https://balancer.fi/), cada um dos quais fornece excelente documentação que você pode ler.

## Programa de Troca de Tokens e `@solana/spl-token-swap`

Ao contrário do Programa de Tokens, não há uma implantação mantida pela Solana do Programa de Troca de Tokens. Em vez disso, a Solana fornece o [código-fonte](https://github.com/solana-labs/solana-program-library/tree/master/token-swap/program) para o Programa de Troca de Tokens como uma implementação de referência que você pode bifurcar e implantar você mesmo. Você também pode usar um programa de troca de tokens mantido por uma organização terceirizada de confiança. Ao longo desta lição, usaremos a implantação mantida pelo Serum no endereço `SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8`.

A Solana também mantém a biblioteca JS `@solana/spl-token-swap`. Esta biblioteca fornece funções auxiliares para interagir com um programa de troca de tokens. Cada função auxiliar recebe um argumento representando um ID do programa de troca de tokens. Contanto que o programa que você usa aceite as instruções de Troca de Tokens, você pode usar a biblioteca `@solana/spl-token-swap` com ele.

## Criando um Pool de Troca

Criar pools de troca com o Programa SPL de Troca de Tokens realmente mostra os modelos de conta, instrução e autorização na Solana. Esta lição combinará e construirá em cima de muito do que aprendemos até agora no curso. Para operações específicas do Programa de Troca de Tokens, usaremos a biblioteca `@solana/spl-token-swap`.

Ao falar sobre a criação de um pool de troca, assumiremos que estamos criando um pool de troca para dois tokens chamados Token A e Token B. Criar o pool de troca com a biblioteca `spl-token-swap` é tão simples quanto enviar uma transação com uma instrução criada com a função `TokenSwap.createInitSwapInstruction`. No entanto, existem várias contas que você precisa criar ou derivar antes que serão necessárias ao criar essa instrução:
1. **Conta de estado de troca de tokens** - mantém informações sobre o pool de troca
2. **Autoridade do pool de troca** - o PDA usado para assinar transações em nome do programa de troca
3. **Contas de tokens para Token A e Token B** - contas de tokens que conterão tokens A e B para o pool
4. **Cunhagem de tokens do pool** - a cunhagem para o token LP do pool de troca
5. **Conta de token do pool** - a conta de token para a cunhagem inicial do token do pool quando a conta de troca é criada
6. **Conta de taxa de token do pool** - a conta que recebe as taxas de negociação do pool de troca

### Conta de Estado de Troca de Tokens

Antes de poder criar um pool de troca, você precisará criar uma conta de estado de troca de tokens. Esta conta será usada para manter informações sobre o próprio pool de troca.

Para criar a conta de estado de troca de tokens, você usa a instrução `SystemProgram` `createAccount`.

```tsx
import * as web3 from '@solana/web3'
import { TokenSwap, TOKEN_SWAP_PROGRAM_ID, TokenSwapLayout } from "@solana/spl-token-swap"

const transaction = new Web3.Transaction()
const tokenSwapStateAccount = Web3.Keypair.generate()
const rent = TokenSwap.getMinBalanceRentForExemptTokenSwap(connection)
const tokenSwapStateAccountInstruction = await Web3.SystemProgram.createAccount({
    newAccountPubkey: tokenSwapStateAccount.publicKey,
    fromPubkey: wallet.publicKey,
    lamports: rent,
    space: TokenSwapLayout.span,
    programId: TOKEN_SWAP_PROGRAM_ID
})
transaction.add(tokenSwapStateAccountInstruction)
```

Alguns pontos a serem observados neste exemplo:
1. Você pode obter o número de lamports necessário para isenção de aluguel usando `TokenSwap.getMinBalanceRentForExemptTokenSwap` da biblioteca `spl-token-swap`.
2. Da mesma forma, você pode usar `TokenSwapLayout.span` para o espaço necessário na conta.
3. `programId` deve ser definido como `TOKEN_SWAP_PROGRAM_ID`. Isso define o proprietário da nova conta como o próprio Programa de Troca de Tokens. O Programa de Troca de Tokens precisará escrever dados na nova conta e, portanto, deve ser definido como o proprietário.

### Autoridade do Pool de Troca

A autoridade do pool de troca é a conta usada para assinar transações em nome do programa de troca. Esta conta é um Endereço Derivado do Programa (PDA) derivado do Programa de Troca de Tokens e da conta de estado de troca de tokens.

PDAs só podem ser criados por seu programa proprietário, então você não precisa criar esta conta diretamente. No entanto, você precisa conhecer sua chave pública. Você pode descobri-la usando a função `PublicKey.findProgramAddress` da biblioteca `@solana/web3`.

```tsx
const [swapAuthority, bump] = await Web3.PublicKey.findProgramAddress(
    [tokenSwapStateAccount.publicKey.toBuffer()],
    TOKEN_SWAP_PROGRAM_ID,
)
```

A chave pública resultante será usada como autoridade em várias das contas que se seguem.

### Contas de Tokens para Token A e Token B

As contas de Token A e Token B são contas de tokens associadas usadas para o próprio pool de troca. Estas contas devem conter uma quantidade de tokens A/B respectivamente e o PDA da autoridade de troca deve ser marcado como a proprietário de cada uma, para que o Programa de Troca de Tokens possa assinar transações e transferir tokens de cada conta.

```tsx
let tokenAAccountAddress = await token.getAssociatedTokenAddress(
    tokenAMint, // cunhagem
    swapAuthority, // proprietário
    true // permitir proprietário fora da curva
)

const tokenAAccountInstruction = await token.createAssociatedTokenAccountInstruction(
    wallet.publicKey, // pagador
    tokenAAccountAddress, // ata
    swapAuthority, // proprietário
    tokenAMint // cunhagem
)

transaction.add(tokenAAccountInstruction)
```

Se você precisa de uma revisão sobre como criar contas de tokens, dê uma olhada na [lição do Programa de Tokens](./token-program.md).

### Cunhagem de Tokens do Pool

A cunhagem de tokens do pool é a cunhagem dos tokens LP que representam a propriedade de um LP no pool. Você cria esta cunhagem da maneira que aprendeu na [lição do Programa de Tokens](./token-program.md). Para que o pool de troca funcione, a autoridade da cunhagem deve ser a conta da autoridade de troca.

```tsx
const poolTokenMint = await token.createMint(
    connection,
    wallet,
    swapAuthority,
    null,
    2
)
```

### Conta de Tokens do Pool

A conta de tokens do pool é a conta para a qual os tokens iniciais do pool de liquidez são cunhados quando a conta de troca é criada pela primeira vez. A cunhagem subsequente de tokens LP será feita diretamente na conta do usuário que adiciona liquidez ao pool. Os tokens do pool de liquidez representam a propriedade na liquidez depositada no pool.

```tsx
const tokenAccountPool = Web3.Keypair.generate()
const rent = await token.getMinimumBalanceForRentExemptAccount(connection)
const createTokenAccountPoolInstruction = Web3.SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: tokenAccountPool.publicKey,
    space: token.ACCOUNT_SIZE,
    lamports: rent,
    programId: token.TOKEN_PROGRAM_ID,
})
const initializeTokenAccountPoolInstruction = token.createInitializeAccountInstruction(
    tokenAccountPool.publicKey,
    poolTokenMint,
    wallet.publicKey
)

transaction.add(createTokenAccountPoolInstruction)
transaction.add(initializeTokenAccountPoolInstruction)
```

### Conta de Taxa de Tokens do Pool

A conta de taxa de tokens do pool é a conta de tokens para a qual as taxas das trocas de tokens são pagas. Para a implantação do Serum do Programa de Troca de Tokens que estamos usando, esta conta deve ser de propriedade de uma conta específica definida no programa de troca: [HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN](https://explorer.solana.com/address/HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN?cluster=devnet).

```tsx
const feeOwner = new web3.PublicKey('HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN')

let tokenFeeAccountAddress = await token.getAssociatedTokenAddress(
    poolTokenMint, // cunhagem
    feeOwner, // proprietário
    true // permitir proprietário fora da curva
)

const tokenFeeAccountInstruction = await token.createAssociatedTokenAccountInstruction(
    wallet.publicKey, // pagador
    tokenFeeAccountAddress, // ata
    feeOwner, // proprietário
    poolTokenMint // cunhagem
)

transaction.add(tokenFeeAccountInstruction)
```

### Criar o pool de troca

Com todas as contas de pré-requisito criadas, você pode criar a instrução de inicialização do pool de troca usando `TokenSwap.createInitSwapInstruction` da biblioteca `spl-token-swap`.

Esta função exige *muitos* argumentos. Vamos discuti-los.

Os primeiros 7 argumentos são as contas de tokens de pré-requisito que acabamos de discutir.

Depois disso, vem a constante representando o ID do Programa de Tokens seguido pela constante representando o ID do Programa de Troca de Tokens.

Em seguida, há 4 pares de argumentos numéricos representando numeradores e denominadores para a taxa de troca, taxa de troca do proprietário, taxa de retirada do proprietário e taxa de hospedagem. A instrução usa o numerador e denominador de cada um para calcular a porcentagem da taxa. Vamos explicar cada uma das taxas:

1. **Taxa de troca** - taxas que são retidas pelas contas de tokens do pool de troca durante uma troca e que aumentam o valor resgatável dos tokens LP. Esta taxa recompensa os usuários por fornecerem liquidez ao pool de troca.
2. **Taxa de troca do proprietário** - taxas que são retidas pelas contas de tokens do pool de troca durante uma troca, com o equivalente em tokens LP cunhados para o proprietário do programa
3. **Taxa de retirada do proprietário** - tokens LP extras que são enviados ao proprietário a cada retirada
4. **Taxa de hospedagem** - uma proporção das taxas de troca do proprietário, enviada a uma conta de token de hospedagem extra fornecida durante a troca. Esta taxa incentiva partes externas (como uma exchange descentralizada) a fornecer frontends para o pool de troca e as recompensa com uma parte.

Ao usar um programa de troca implantado e mantido por terceiros, essas taxas podem ou não ser fixas de modo que você *deve* inserir os argumentos corretos. Você precisará verificar a implementação do programa de suporte.

Por último, há o tipo de curva, que discutiremos mais adiante na lição.

```tsx
const createSwapInstruction = TokenSwap.createInitSwapInstruction(
    tokenSwapStateAccount,      // Conta de estado da troca de tokens
    swapAuthority,              // Autoridade do pool de troca
    poolTokenA,                 // Conta do token A
    poolTokenB,                 // Conta do token B
    poolTokenMint,              // Cunhagem do token do pool de troca
    tokenFeeAccountAddress,     // Conta de taxa do token
    tokenAccountPool.publicKey, // Conta do token do pool de troca
    token.TOKEN_PROGRAM_ID,     // ID do Programa de Tokens
    TOKEN_SWAP_PROGRAM_ID,      // ID do Programa de Troca de Tokens
    0,                          // Numerador da taxa de troca
    10000,                      // Denominador da taxa de troca
    5,                          // Numerador da taxa de troca do proprietário
    10000,                      // Denominador da taxa de troca do proprietário
    0,                          // Numerador da taxa de retirada do proprietário
    0,                          // Denominador da taxa de retirada do proprietário
    20,                         // Numerador da taxa de hospedagem
    100,                        // Denominador da taxa de hospedagem
    CurveType.ConstantProduct   // Tipo de curva
)

transaction.add(createSwapInstruction)
```

Quando uma transação com essas instruções é executada com sucesso, o pool de troca é criado e está pronto para ser usado.

## Interagindo com Pools de Troca

Uma vez que o pool de troca é inicializado, o Programa de Troca de Tokens tem algumas instruções diferentes para usar um pool de troca. Estas incluem:
1. Executar uma troca
2. Depositar liquidez
3. Retirar liquidez

### Executar uma troca

Os usuários podem começar a negociar imediatamente em um pool de troca usando a instrução de troca. A instrução de troca transfere fundos da conta de tokens do usuário para a conta de tokens do pool de troca. O pool de troca então cunha tokens LP para a conta de tokens LP do usuário.

Como os programas Solana exigem que todas as contas sejam declaradas na instrução, os usuários precisam reunir todas as informações da conta do estado de troca de tokens: as contas dos tokens A e B, cunhagem de tokens do pool e conta de taxa.

Nós trocamos tokens usando a função auxiliar `TokenSwap.swapInstruction` que exige os seguintes argumentos:
1. `tokenSwap` - a conta de estado de troca de tokens
2. `authority` - a autoridade do pool de troca
3. `userTransferAuthority` - o delegado sobre a conta de tokens do usuário
4. `userSource` - conta de tokens do usuário para transferir tokens para a troca
5. `poolSource` - conta de tokens do pool de troca para receber tokens transferidos do usuário
6. `poolDestination` - conta de tokens do pool de troca para enviar tokens ao usuário
7. `userDestination` - conta de tokens do usuário para receber tokens enviados do pool de troca
8. `poolMint` - o endereço da cunhagem dos tokens LP
9. `feeAccount` - a conta de tokens que recebe as taxas de troca do proprietário
10. `hostFeeAccount` - a conta de tokens que recebe as taxas de hospedagem (parâmetro opcional), definido como nulo se nenhum for fornecido
11. `swapProgramId` - o endereço do Programa de Troca de Tokens
12. `tokenProgramId` - o endereço do Programa de Tokens
13. `amountIn` - quantidade de tokens que o usuário deseja transferir para o pool de troca
14. `minimumAmountOut` - quantidade mínima de tokens enviada para a conta de tokens do usuário. Este parâmetro é usado para contabilizar a derrapagem (slippage). Derrapagem é a diferença entre o valor de um token quando você envia a transação versus quando a ordem é cumprida. Neste caso, quanto menor o número, mais derrapagem pode ocorrer sem que a transação falhe. Ao longo desta lição, usaremos 0 para trocas, pois calcular a derrapagem está fora do escopo desta lição. Em um aplicativo de produção, no entanto, é importante permitir que os usuários especifiquem a quantidade de derrapagem com a qual estão confortáveis.

A instrução para trocar o token A pelo token B será assim:

```tsx
const swapInstruction = TokenSwap.swapInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    userTokenA,
    poolTokenA,
    poolTokenB,
    userTokenB,
    poolMint,
    feeAccount,
    null,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    amount * 10 ** MintInfoTokenA.decimals,
    0
)

transaction.add(swapInstruction)
```

### Depositando liquidez

O Programa de Troca de Tokens tem duas variações de instruções de depósito. Uma permite que os usuários depositem tokens apenas em um lado do pool de troca por vez. A outra permite que os usuários depositem em ambos os lados do pool de troca ao mesmo tempo.

Para depositar liquidez em ambos os lados do pool de troca, a carteira do usuário deve ter uma quantidade suficiente de cada token. Ao depositar ambos os tokens, em vez de fornecer a quantidade de cada token a ser depositado, o usuário especifica a quantidade de tokens LP que gostaria de receber. O Programa de Troca de Tokens então calcula a quantidade de cada token que um depositante receberá dada a curva do pool e a liquidez atual.

Podemos depositar ambos os tokens ao mesmo tempo usando a função auxiliar `TokenSwap.depositAllTokenTypesInstruction`, que requer os seguintes argumentos:
1. `tokenSwap` - a conta de estado de troca de tokens
2. `authority` - a autoridade do pool de troca
3. `userTransferAuthority` - a autoridade sobre as contas de tokens do usuário
4. `sourceA` - conta de token A do usuário para transferir tokens para a conta de token A do pool de troca
5. `sourceB` - conta de token B do usuário para transferir tokens para a conta de token B do pool de troca
6. `intoA` - conta de token A do pool de troca para receber o token A do usuário
7. `intoB` - conta de token B do pool de troca para receber o token B do usuário
8. `poolToken` - o endereço da cunhagem dos tokens LP
9. `poolAccount` - conta de token LP do usuário para a qual o pool de troca cunha os tokens LP
10. `swapProgramId` - o endereço do Programa de Troca de Tokens
11. `tokenProgramId` - o endereço do Programa de Tokens
12. `poolTokenAmount` - quantidade de tokens LP que o depositante espera receber
13. `maximumTokenA` - quantidade máxima de token A permitida para depositar
14. `maximumTokenB` - quantidade máxima de token B permitida para depositar

Os argumentos `maximumTokenA` e `maximumTokenB` são usados para prevenir a derrapagem. Quanto maior o número, mais derrapagem pode ocorrer sem uma falha na transação. Para simplificar, usaremos um número muito grande para esses argumentos.

A instrução para depositar os tokens A e B será assim:

```tsx
const instruction = TokenSwap.depositAllTokenTypesInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    userTokenA,
    userTokenB,
    poolTokenA,
    poolTokenB,
    poolMint,
    userPoolToken,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    poolTokenAmount * 10 ** MintInfoPoolToken.decimals,
    100e9,
    100e9
)

transaction.add(instruction)
```

Podemos depositar tokens em apenas um lado do pool de troca de maneira semelhante usando a `TokenSwap.depositSingleTokenTypeExactAmountInInstruction`. A principal diferença é que o último argumento na instrução é `minimumPoolTokenAmount`. Ao depositar em apenas um lado do pool de troca, o usuário especifica exatamente quantos tokens deseja depositar. Por sua vez, o Programa de Troca de Tokens calcula a quantidade de tokens LP a serem cunhados para o usuário pelo seu depósito. Uma instrução depositando apenas o Token A será assim:

```tsx
const instruction = TokenSwap.depositSingleTokenTypeExactAmountInInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    userTokenA,
    poolTokenA,
    poolMint,
    userPoolToken,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    DepositAmountTokenA * 10 ** MintInfoTokenA.decimals,
    0,
)

transaction.add(instruction)
```

### Retirando liquidez

Em troca de fornecer liquidez, os depositantes recebem tokens LP representando sua propriedade fracionada de todos os tokens A e B no pool. A qualquer momento, os provedores de liquidez podem resgatar seus tokens LP em troca dos tokens A e B na taxa de câmbio "justa" atual conforme determinado pela curva. Quando a liquidez é retirada, os tokens A e/ou B são transferidos para as contas de tokens do usuário e seus tokens LP são queimados.

O Programa de Troca de Tokens tem duas variações de instruções de retirada. Uma permite que os usuários retirem tokens de apenas um lado do pool de troca por vez. A outra permite retiradas de ambos os lados do pool de troca ao mesmo tempo.

Podemos retirar ambos os tokens ao mesmo tempo usando a função auxiliar `TokenSwap.withdrawAllTokenTypesInstruction` que requer os seguintes argumentos:
1. `tokenSwap` - a conta de estado de troca de tokens
2. `authority` - a autoridade do pool de troca
3. `userTransferAuthority` - a autoridade sobre as contas de tokens do usuário
4. `poolMint` - o endereço da cunhagem dos tokens LP
5. `feeAccount` - a conta de tokens que recebe as taxas de retirada do proprietário
6. `sourcePoolAccount` - conta de token LP do usuário para queimar tokens LP do pool
7. `fromA` - conta de token A do pool de troca para retirar
8. `fromB` - conta de token B do pool de troca para retirar
9. `userAccountA` - conta de token A do usuário para receber tokens retirados da conta de token A do pool de troca
10. `userAccountB` - conta de token B do usuário para receber tokens retirados da conta de token B do pool de troca
11. `swapProgramId` - o endereço do Programa de Troca de Tokens
12. `tokenProgramId` - o endereço do Programa de Tokens
13. `poolTokenAmount` - quantidade de tokens LP que o usuário espera queimar na retirada
14. `minimumTokenA` - quantidade mínima de token A para retirar
15. `minimumTokenB` - quantidade mínima de token B para retirar

Os argumentos `minimumTokenA` e `minimumTokenB` são usados para prevenir a derrapagem. Quanto menor o número, mais derrapagem pode ocorrer. Para simplificar, usaremos 0 para esses argumentos.

A instrução para retirar os tokens A e B será assim:

```tsx
const instruction = TokenSwap.withdrawAllTokenTypesInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    poolMint,
    feeAccount,
    userPoolToken,
    poolTokenA,
    poolTokenB,
    userTokenA,
    userTokenB,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    poolTokenAmount * 10 ** MintInfoPoolToken.decimals,
    0,
    0
)

transaction.add(instruction)
```

Podemos retirar tokens de apenas um lado do pool de troca de maneira semelhante usando a `TokenSwap.withdrawSingleTokenTypeExactAmountOut`. A principal diferença é que o último argumento na instrução é `maximumPoolTokenAmount`. Ao retirar apenas um lado do pool de troca, o usuário especifica exatamente quantos tokens deseja retirar. Por sua vez, o Programa de Troca de Tokens calcula a quantidade de tokens LP que o usuário deve queimar. Uma instrução retirando apenas o Token B será assim:

```tsx
const instruction = TokenSwap.depositSingleTokenTypeExactAmountInInstruction(
    tokenSwapStateAccount,
    swapAuthority,
    userPublicKey,
    poolMint,
    feeAccount,
    poolTokenB,
    userTokenB,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    WithdrawAmountTokenB * 10 ** MintInfoTokenB.decimals,
    100e9,
)

transaction.add(instruction)
```

## Curvas

As curvas de negociação são o cerne de como os pools de troca e os AMMs (Automated Market Makers, ou Formadores de Mercado Automatizados) operam. A curva de negociação é a função que o Programa de Troca de Tokens usa para calcular quanto de um token de destino será fornecido dado uma quantidade de token de origem. A curva estabelece o preço de mercado dos tokens no pool.

O pool com o qual interagiremos nesta lição emprega uma Função de Curva de [Produto Constante](https://spl.solana.com/token-swap#curves). A curva de produto constante é a curva conhecida do estilo da Uniswap e do Balancer que preserva um invariante em todas as trocas. Este invariante pode ser expresso como o produto da quantidade de token A e token B no pool de troca.

```tsx
A_total * B_total = invariant
```

Se tivermos 100 token A e 5.000 token B, nosso invariante é 500.000.

Agora, se um comerciante deseja colocar uma quantidade específica de token A para alguma quantidade de token B, o cálculo se torna uma questão de resolver "B_out" onde:

```tsx
(A_total + A_in) * (B_total - B_out) = invariant
```

Colocando os 10 tokens A juntamente com nosso invariante de meio milhão, precisaríamos resolver para "B_out" assim:

```tsx
(100 + 10) * (5,000 - B_out) = 500,000
5,000 - B_out = 500,000 / 110
5,000 - (500,000 / 110) = B_out
B_out = 454.5454...
```

O produto da quantidade de token A e token B deve sempre ser igual a uma constante, daí o nome 'Produto Constante'. Mais informações podem ser encontradas no [whitepaper da Uniswap](https://uniswap.org/whitepaper.pdf) e no [whitepaper do Balancer](https://balancer.fi/whitepaper.pdf).

Se as curvas não fazem muito sentido para você, não se preocupe! Embora aprender mais sobre como elas funcionam não seja prejudicial, você não precisa entender toda a matemática para poder implementar as curvas comuns.

# Demonstração

Para esta demonstração, um pool de tokens de dois novos tokens foi criado e está ativo na Devnet. Vamos percorrer a construção de uma interface de usuário de frontend para interagir com este pool de troca! Como o pool já está feito, não precisamos nos preocupar em iniciar o pool e adicionar tokens a ele. Em vez disso, vamos focar em construir as instruções para:

- depositar liquidez no pool
- retirar sua liquidez depositada
- trocar de um token para o outro

![Captura de tela da Demonstração de Troca de Tokens](../../assets/token-swap-frontend.png)

### 1. Código inicial

Antes de começar, vá em frente e baixe o [código inicial](https://github.com/Unboxed-Software/solana-token-swap-frontend/tree/starter).

O projeto é uma aplicação Next.js relativamente simples, reutilizando muito do que foi construído anteriormente para a demonstração na [lição do Programa de Tokens](./token-program.md). Como você pode ver na imagem acima, há alguns campos de texto e botões diferentes - todos os quais submeterão transações para a blockchain em nome do usuário. Nosso foco nesta demonstração será criar as instruções que os três últimos botões submeterão.

Os botões de airdrop já estão implementados e devem funcionar imediatamente. Eles utilizam um programa de airdrop que está implantado na Devnet no endereço [CPEV4ibq2VUv7UnNpkzUGL82VRzotbv2dy8vGwRfh3H3](https://explorer.solana.com/address/CPEV4ibq2VUv7UnNpkzUGL82VRzotbv2dy8vGwRfh3H3?cluster=devnet). Você pode cunhar quantos tokens desejar para sua carteira para interagir com o pool.

### 2. Criando a Instrução de Depósito

Das duas variações de instruções de depósito no Programa de Troca de Tokens, usaremos a variação que fornece liquidez para ambos os lados do pool de troca de uma vez: `TokenSwap.depositAllTokenTypesInstruction`.

A instrução de depósito deve ser adicionada dentro do arquivo `/components/Deposit.tsx` na função `handleTransactionSubmit`. Esta função é chamada quando o usuário clica no botão de depósito.

Começaremos derivando três endereços de contas de token associadas:
1. A conta de token associada correspondente ao endereço da carteira do usuário e à Krypt Coin
2. A conta de token associada correspondente ao endereço da carteira do usuário e ao Scrooge Coin
3. A conta de token associada correspondente ao endereço da carteira do usuário e o token LP do pool de troca

Há várias maneiras de fazer isso, mas usaremos a função auxiliar `getAssociatedTokenAddress` da biblioteca `spl-token`.

Também precisaremos dos dados associados à cunhagem do token do pool para ajustar a entrada do usuário para os decimais do token do pool. Para acessar os dados da cunhagem de um token, usaremos a função auxiliar `getMint` da biblioteca `spl-token`.

```tsx
const handleTransactionSubmit = async (deposit: DepositAllSchema) => {
    if (!publicKey) {
        alert('Conecte sua carteira, por favor!')
        return
    }
	// estas são as contas que mantêm os tokens
    const kryptATA = await token.getAssociatedTokenAddress(kryptMint, publicKey)
    const scroogeATA = await token.getAssociatedTokenAddress(ScroogeCoinMint, publicKey)
	const tokenAccountPool = await token.getAssociatedTokenAddress(pool_mint, publicKey)

    // poolMintInfo contém dados que buscamos para a cunhagem do token do pool
    const poolMintInfo = await token.getMint(connection, poolMint)
}
```

Em seguida, precisamos verificar se o endereço `tokenAccountPool` que acabamos de derivar foi criado. Usaremos a função `getAccountInfo` da biblioteca `@solana/web3` para obter as informações da conta associadas ao `tokenAccountPool`. Esta função retornará uma struct `AccountInfo` se a conta existir ou `null` caso contrário. Se `null` for retornado, precisaremos criar a conta.

Como a função `handleTransactionSubmit` já estará submetendo uma transação, simplesmente adicionaremos a instrução para criar uma conta associada à mesma transação, em vez de submeter múltiplas transações.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert('Conecte sua carteira, por favor!')
        return
    }

    const kryptATA = await token.getAssociatedTokenAddress(kryptMint, publicKey)
    const scroogeATA = await token.getAssociatedTokenAddress(ScroogeCoinMint, publicKey)
    const tokenAccountPool = await token.getAssociatedTokenAddress(pool_mint, publicKey)

    const poolMintInfo = await token.getMint(connection, poolMint)

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                pool_mint
            )
        transaction.add(createATAInstruction)
    }
}
```

Finalmente, podemos criar a instrução de depósito usando a função auxiliar `TokenSwap.depositAllTokenTypesInstruction` da biblioteca `spl-token-swap`. Em seguida, adicionamos a instrução e submetemos a transação.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Conecte sua carteira, por favor!")
        return
    }

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey
    )

    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey
    )

    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey
    )

    const poolMintInfo = await token.getMint(connection, poolMint)

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                poolMint
            )
        transaction.add(createATAInstruction)
    }

    const instruction = TokenSwap.depositAllTokenTypesInstruction(
        tokenSwapStateAccount,
        swapAuthority,
        publicKey,
        kryptATA,
        scroogeATA,
        poolKryptAccount,
        poolScroogeAccount,
        poolMint,
        tokenAccountPool,
        TOKEN_SWAP_PROGRAM_ID,
        token.TOKEN_PROGRAM_ID,
        poolTokenAmount * 10 ** poolMintInfo.decimals,
        100e9,
        100e9
    )

    transaction.add(instruction)

    try {
        let txid = await sendTransaction(transaction, connection)
        alert(
            `Transação enviada: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
        console.log(
            `Transação enviada: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
    } catch (e) {
        console.log(JSON.stringify(e))
        alert(JSON.stringify(e))
    }
}
```

Com exceção da `publickey` do usuário e suas contas de tokens associadas derivadas (para a Krypt Coin, o Scrooge Coin e o token LP do pool), observe que todas as contas são constantes para este pool de troca e são definidas no arquivo `const.ts`.

Neste ponto, você deve ser capaz de enviar o airdrop de alguns tokens para si mesmo e depois depositá-los no pool de troca!

### 3. Criando a Instrução de Retirada

A instrução de retirada é muito semelhante à instrução de depósito, mas há algumas diferenças sutis. Como os depósitos, o Programa de Troca de Tokens aceita duas variações da instrução de retirada. Você pode retirar liquidez de apenas um lado do pool de troca, ou pode retirar sua liquidez depositada de ambos os lados ao mesmo tempo.

Das duas variações de instruções de retirada no Programa de Troca de Tokens, usaremos a variação que remove a liquidez de ambos os lados do pool de troca de uma vez: `TokenSwap.withdrawAllTokenTypesInstruction`.

A instrução de retirada deve ser adicionada dentro do arquivo `/components/Withdraw.tsx` na função `handleTransactionSubmit`. Esta função é chamada quando o usuário clica no botão de retirada.

Começaremos derivando os três endereços de contas de token associadas, buscando os dados da cunhagem do token do pool e verificando o endereço `tokenAccountPool` da mesma maneira que fizemos para a instrução de depósito.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert('Conecte sua carteira, por favor!')
        return
    }

    const kryptATA = await token.getAssociatedTokenAddress(kryptMint, publicKey)
    const scroogeATA = await token.getAssociatedTokenAddress(ScroogeCoinMint, publicKey)
    const tokenAccountPool = await token.getAssociatedTokenAddress(pool_mint, publicKey)

    const poolMintInfo = await token.getMint(connection, poolMint)

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                pool_mint
            )
        transaction.add(createATAInstruction)
    }
}
```

Em seguida, criamos a instrução de retirada usando a função auxiliar `TokenSwap.withdrawAllTokenTypesInstruction` da biblioteca `spl-token-swap`. Depois, adicionamos a instrução e submetemos a transação.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Conecte sua carteira, por favor!")
        return
    }

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey
    )
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey
    )
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey
    )

    const poolMintInfo = await token.getMint(connection, poolMint)

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                poolMint
            )
        transaction.add(createATAInstruction)
    }

    const instruction = TokenSwap.withdrawAllTokenTypesInstruction(
        tokenSwapStateAccount,
        swapAuthority,
        publicKey,
        poolMint,
        feeAccount,
        tokenAccountPool,
        poolKryptAccount,
        poolScroogeAccount,
        kryptATA,
        scroogeATA,
        TOKEN_SWAP_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        poolTokenAmount * 10 ** poolMintInfo.decimals,
        0,
        0
    )

    transaction.add(instruction)
    try {
        let txid = await sendTransaction(transaction, connection)
        alert(
            `Transação enviada: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
        console.log(
            `Transação enviada: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
    } catch (e) {
        console.log(JSON.stringify(e))
        alert(JSON.stringify(e))
    }
}
```

Note que a ordem das contas é diferente para a transação de retirada e há uma `feeAccount` adicional fornecida desta vez. Esta `feeAccount` é o destino da taxa que deve ser paga pelo usuário por retirar liquidez dos pools.

### 4. Criando a Instrução de Troca

Agora é hora de implementar o propósito real deste programa - a instrução de troca!

Observe que nossa interface tem um menu suspenso para permitir que os usuários selecionem *de* qual token eles gostariam de trocar, então teremos que criar nossa instrução de maneira diferente com base no que o usuário selecionar.

Faremos isso dentro da função `handleTransactionSubmit` do arquivo `/components/Swap.tsx`. Mais uma vez, teremos que derivar os `Associated Token Addresses` do usuário para cada cunhagem de token (Krypt Coin, Scrooge Coin e Token do Pool) e criar a `tokenAccountPool` se ela ainda não existir. Além disso, buscaremos os dados da Krypt Coin e do Scrooge Coin, para contabilizar a precisão decimal dos tokens.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
      alert("Conecte sua carteira, por favor!")
      return
    }

    const kryptMintInfo = await token.getMint(connection, kryptMint)
    const ScroogeCoinMintInfo = await token.getMint(connection, ScroogeCoinMint)

    const kryptATA = await token.getAssociatedTokenAddress(kryptMint, publicKey)
    const scroogeATA = await token.getAssociatedTokenAddress(ScroogeCoinMint, publicKey)
    const tokenAccountPool = await token.getAssociatedTokenAddress(poolMint, publicKey)
}
```

A partir daqui, a entrada do usuário determinará nosso caminho de execução. A escolha do usuário é salva na propriedade `mint`, então usaremos isso para ramificar entre cada possível instrução.

```tsx
const handleTransactionSubmit = async () => {
    if (!publicKey) {
        alert("Conecte sua carteira, por favor!")
        return
    }

    const kryptMintInfo = await token.getMint(connection, kryptMint)
    const ScroogeCoinMintInfo = await token.getMint(
        connection,
        ScroogeCoinMint
    )

    const kryptATA = await token.getAssociatedTokenAddress(
        kryptMint,
        publicKey
    )
    const scroogeATA = await token.getAssociatedTokenAddress(
        ScroogeCoinMint,
        publicKey
    )
    const tokenAccountPool = await token.getAssociatedTokenAddress(
        poolMint,
        publicKey
    )

    const transaction = new Web3.Transaction()

    let account = await connection.getAccountInfo(tokenAccountPool)

    if (account == null) {
        const createATAInstruction =
            token.createAssociatedTokenAccountInstruction(
                publicKey,
                tokenAccountPool,
                publicKey,
                poolMint
            )
        transaction.add(createATAInstruction)
    }

    // verifique qual direção trocar
    if (mint == "option1") {
        const instruction = TokenSwap.swapInstruction(
            tokenSwapStateAccount,
            swapAuthority,
            publicKey,
            kryptATA,
            poolKryptAccount,
            poolScroogeAccount,
            scroogeATA,
            poolMint,
            feeAccount,
            null,
            TOKEN_SWAP_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            amount * 10 ** kryptMintInfo.decimals,
            0
        )

        transaction.add(instruction)
    } else if (mint == "option2") {
        const instruction = TokenSwap.swapInstruction(
            tokenSwapStateAccount,
            swapAuthority,
            publicKey,
            scroogeATA,
            poolScroogeAccount,
            poolKryptAccount,
            kryptATA,
            poolMint,
            feeAccount,
            null,
            TOKEN_SWAP_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            amount * 10 ** ScroogeCoinMintInfo.decimals,
            0
        )

        transaction.add(instruction)
    }

    try {
        let txid = await sendTransaction(transaction, connection)
        alert(
            `Transação enviada: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
        console.log(
            `Transação enviada: https://explorer.solana.com/tx/${txid}?cluster=devnet`
        )
    } catch (e) {
        console.log(JSON.stringify(e))
        alert(JSON.stringify(e))
    }
}
```

E é isso! Uma vez que você tenha implementado a instrução de troca, a interface deve estar totalmente funcional e você pode enviar um airdrop de tokens para si mesmo, depositar liquidez, retirar sua liquidez e trocar de token para token!

Por favor, dedique seu tempo com este código e os conceitos desta lição. Pools de troca podem ficar muito mais complicados do que o que implementamos hoje, então é importante entender o básico. Se precisar de mais tempo com a demonstração, aproveite! E se precisar, dê uma olhada no [código da solução aqui](https://github.com/Unboxed-Software/solana-token-swap-frontend).

# Desafio

Agora que trabalhamos juntos na demonstração, tente ir um passo além com seus próprios tokens!

Na [lição do Programa de Tokens](./token-program.md) você criou alguns tokens. Agora faça um pool de troca para esses tokens e modifique o código da demonstração desta lição para usar seus tokens e seu pool de troca recém-criado. Não há um código de solução para isso, pois é específico para seus tokens, então vá devagar e dê um passo de cada vez. Você consegue!

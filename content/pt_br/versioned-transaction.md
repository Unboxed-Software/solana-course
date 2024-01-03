---
title: Transações Versionadas e Tabelas de Consulta
objectives:
- Criar transações versionadas
- Criar tabelas de consulta
- Estender tabelas de consulta
- Usar tabelas de consulta com transações versionadas
---

# Resumo

-   **Transações Versionadas** referem-se a uma maneira de suportar tanto versões legadas quanto novas de formatos de transações. O formato original da transação é "legado" e as novas versões de transações começam na versão 0. Transações versionadas foram implementadas para suportar o uso de Tabelas de Consulta de Endereços (também chamadas de Lookup Tables ou LUTs).
-   **Tabelas de Consulta de Endereços** são contas usadas para armazenar endereços de outras contas, que podem ser referenciadas em transações versionadas usando um índice de 1 byte em vez dos 32 bytes completos por endereço. Isso possibilita a criação de transações mais complexas do que era possível antes da introdução das LUTs.

# Visão Geral

Por padrão, as transações da Solana são limitadas a 1232 bytes. Transações que excedem esse tamanho falharão. Embora isso permita uma série de otimizações de rede, também pode limitar os tipos de operações atômicas que podem ser realizadas na rede.

Para ajudar a contornar a limitação de tamanho de transação, a Solana lançou um novo formato de transação que permite o suporte para múltiplas versões de formatos de transação. No momento da escrita, a Solana suporta duas versões de transação:

1. `legacy` - o formato original da transação
2. `0` - o formato mais recente da transação que inclui suporte para Tabelas de Consulta de Endereços

Transações versionadas não requerem modificações em programas Solana existentes, mas qualquer código do lado do cliente criado antes do lançamento das transações versionadas deve ser atualizado. Nesta lição, abordaremos os conceitos básicos de transações versionadas e como usá-las, incluindo:

-   Criar transações versionadas
-   Criar e gerenciar tabelas de consulta
-   Usar tabelas de consulta em transações versionadas

## Transações Versionadas

Um dos itens que mais ocupam espaço nas transações da Solana é a inclusão de endereços completos de contas. Com 32 bytes cada, 39 contas farão com que uma transação seja muito grande. Isso sem contar os dados da instrução. Na prática, a maioria das transações será muito grande, com cerca de 20 contas.

A Solana lançou transações versionadas para suportar múltiplos formatos de transação. Junto com o lançamento de transações versionadas, a Solana lançou a versão 0 de transações para suportar Tabelas de Consulta de Endereços. Tabelas de consulta são contas separadas que armazenam endereços de conta e permitem que sejam referenciadas em uma transação usando um índice de 1 byte. Isso diminui significativamente o tamanho de uma transação, já que cada conta incluída agora precisa usar apenas 1 byte em vez de 32 bytes.

Mesmo que você não precise usar tabelas de consulta, você precisará saber como suportar transações versionadas em seu código do lado do cliente. Felizmente, tudo o que você precisa para trabalhar com transações versionadas e tabelas de consulta está incluído na biblioteca `@solana/web3.js`.

### Criando uma transação versionada

Para criar uma transação versionada, basta criar uma `TransactionMessage` com os seguintes parâmetros:

- `payerKey` - a chave pública da conta que pagará pela transação
- `recentBlockhash` - um hash de bloco recente da rede
- `instructions` - as instruções a serem incluídas na transação

Você então transforma este objeto de mensagem em uma transação versão `0` usando o método `compileToV0Message()`.

```typescript
import * as web3 from "@solana/web3.js";

// Exemplo de instrução de transferência
const transferInstruction = [
    web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey, // Chave pública da conta que enviará os fundos
        toPubkey: toAccount.publicKey, // Chave pública da conta que receberá os fundos
        lamports: 1 * LAMPORTS_PER_SOL, // Quantidade de lamports a ser transferida
    }),
];

// Obter o último hash de bloco
let { blockhash } = await connection.getLatestBlockhash();

// Criar a mensagem da transação
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // Chave pública da conta que pagará pela transação
    recentBlockhash: blockhash, // Último hash de bloco
    instructions: transferInstruction, // Instruções incluídas na transação
}).compileToV0Message();
```

Finalmente, você passa a mensagem compilada para o construtor `VersionedTransaction` para criar uma nova transação versionada. Seu código pode então assinar e enviar a transação para a rede, semelhante a uma transação legada.

```typescript
// Criar a transação versionada usando a mensagem
const transaction = new web3.VersionedTransaction(message);

// Assinar a transação
transaction.sign([payer]);

// Enviar a transação assinada para a rede
const transactionSignature = await connection.sendTransaction(transaction);
```

## Tabela de Consulta de Endereços

Tabelas de Consulta de Endereços (também chamadas de lookup Tables ou LUTs) são contas que armazenam uma tabela de consulta de outros endereços de conta. Essas contas LUT são de propriedade do Programa de Tabela de Consulta de Endereços e são usadas para aumentar o número de contas que podem ser incluídas em uma única transação.

Transações versionadas podem incluir o endereço de uma conta LUT e então referenciar contas adicionais com um índice de 1 byte em vez de incluir o endereço completo dessas contas. Isso reduz significativamente a quantidade de espaço usado para referenciar contas em uma transação.

Para simplificar o processo de trabalhar com LUTs, a biblioteca `@solana/web3.js` inclui uma classe `AddressLookupTableProgram` que fornece um conjunto de métodos para criar instruções para gerenciar LUTs. Estes métodos incluem:

-   `createLookupTable` - cria uma nova conta LUT
-   `freezeLookupTable` - torna uma LUT existente imutável
-   `extendLookupTable` - adiciona endereços a uma LUT existente
-   `deactivateLookupTable` - coloca uma LUT em um período de "desativação" antes que possa ser fechada
-   `closeLookupTable` - fecha permanentemente uma conta LUT

### Criar uma tabela de consulta

Você usa o método `createLookupTable` para construir a instrução que cria uma tabela de consulta. A função requer os seguintes parâmetros:

-   `authority` - a conta que terá permissão para modificar a tabela de consulta
-   `payer` - a conta que pagará pela criação da conta
-   `recentSlot` - um slot recente para derivar o endereço da tabela de consulta

A função retorna tanto a instrução para criar a tabela de consulta quanto o endereço da tabela de consulta.

```typescript
// Obter o slot atual
const slot = await connection.getSlot();

// Criar uma instrução para criar uma tabela de consulta
// e recuperar o endereço da nova tabela de consulta
const [lookupTableInst, lookupTableAddress] =
    web3.AddressLookupTableProgram.createLookupTable({
        authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
        payer: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
        recentSlot: slot - 1, // O slot recente para derivar o endereço da tabela de consulta
    });
```

Internamente, o endereço da tabela de consulta é simplesmente um PDA derivado usando o `authority` e `recentSlot` como sementes.

```typescript
const [lookupTableAddress, bumpSeed] = PublicKey.findProgramAddressSync(
    [params.authority.toBuffer(), toBufferLE(BigInt(params.recentSlot), 8)],
    this.programId,
);
```

Observe que usar o slot mais recente às vezes resulta em um erro após enviar a transação. Para evitar isso, você pode usar um slot que seja anterior ao mais recente (ex.: `recentSlot: slot - 1`). No entanto, se você ainda encontrar um erro ao enviar a transação, pode tentar reenviá-la.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"188115589 is not a recent slot",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid instruction data";
```

### Estender uma tabela de consulta

Você usa o método `extendLookupTable` para criar uma instrução que adiciona endereços a uma tabela de consulta existente. Ele recebe os seguintes parâmetros:

- `payer` - a conta que pagará pelas taxas de transação e qualquer aumento de aluguel
- `authority` - a conta que tem permissão para alterar a tabela de consulta
- `lookupTable` - o endereço da tabela de consulta a ser estendida
- `addresses` - os endereços a serem adicionados à tabela de consulta

A função retorna uma instrução para estender a tabela de consulta.

```typescript
const addresses = [
    new web3.PublicKey("31Jy3nFeb5hKVdB4GS4Y7MhU7zhNMFxwF7RGVhPc1TzR"),
    new web3.PublicKey("HKSeapcvwJ7ri6mf3HwBtspLFTDKqaJrMsozdfXfg5y2"),
    // adicione mais endereços
];

// Cria uma instrução para estender uma tabela de consulta com os endereços fornecidos
const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
    payer: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas de transação)
    authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
    lookupTable: lookupTableAddress, // O endereço da tabela de consulta a ser estendida
    addresses: addresses, // Os endereços a serem adicionados à tabela de consulta
});
```

Observe que, ao estender uma tabela de consulta, o número de endereços que podem ser adicionados em uma instrução é limitado pelo limite de tamanho da transação, que é de 1232 bytes. Isso significa que você pode adicionar 30 endereços a uma tabela de consulta por vez. Se precisar adicionar mais do que isso, será necessário enviar várias transações. Cada tabela de consulta pode armazenar no máximo 256 endereços.

### Enviando uma Transação

Após criar as instruções, você pode adicioná-las a uma transação e enviá-la para a rede.

```typescript
// Obter o último hash de bloco
let { blockhash } = await connection.getLatestBlockhash();

// Criar a mensagem da transação
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // Chave pública da conta que pagará pela transação
    recentBlockhash: blockhash, // Último hash de bloco
    instructions: [lookupTableInst, extendInstruction], // Instruções incluídas na transação
}).compileToV0Message();

// Criar a transação versionada usando a mensagem
const transaction = new web3.VersionedTransaction(message);

// Assinar a transação
transaction.sign([payer]);

// Enviar a transação assinada para a rede
const transactionSignature = await connection.sendTransaction(transaction);
```

Observe que quando você cria ou estende uma tabela de consulta pela primeira vez, ela precisa "aquecer" por um slot antes que a LUT ou novos endereços possam ser usados em transações. Em outras palavras, você só pode usar tabelas de consulta e acessar endereços que foram adicionados antes do slot atual.

```typescript
SendTransactionError: failed to send transaction: invalid transaction: Transaction address table lookup uses an invalid index
```

Se você encontrar o erro acima ou não conseguir acessar endereços em uma tabela de consulta imediatamente após estendê-la, é provável que você esteja tentando acessar a tabela de consulta ou um endereço específico antes do fim do período de aquecimento. Para evitar esse problema, adicione um atraso após estender a tabela de consulta antes de enviar uma transação que faça referência à tabela.

### Desativando uma tabela de consulta

Quando uma tabela de consulta não é mais necessária, você pode desativá-la e fechá-la para recuperar seu saldo de aluguel. Tabelas de consulta de endereços podem ser desativadas a qualquer momento, mas podem continuar a ser usadas por transações até que um slot de "desativação" especificado não seja mais "recente". Esse período de "resfriamento" garante que transações em andamento não possam ser censuradas por LUTs sendo fechadas e recriadas no mesmo slot. O período de desativação é de aproximadamente 513 slots.

Para desativar uma LUT, use o método `deactivateLookupTable` e passe os seguintes parâmetros:

- `lookupTable` - o endereço da LUT a ser desativada
- `authority` - a conta com permissão para desativar a LUT

```typescript
const deactivateInstruction =
    web3.AddressLookupTableProgram.deactivateLookupTable({
        lookupTable: lookupTableAddress, // O endereço da tabela de consulta a ser desativada
        authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
    });
```

### Fechando uma tabela de consulta

Para fechar uma tabela de consulta após seu período de desativação, use o método `closeLookupTable`. Esse método cria uma instrução para fechar uma tabela de consulta desativada e recuperar seu saldo de aluguel. Ele leva os seguintes parâmetros:

- `lookupTable` - o endereço da LUT a ser fechada
- `authority` - a conta com permissão para fechar a LUT
- `recipient` - a conta que receberá o saldo de aluguel recuperado

```typescript
const closeInstruction = web3.AddressLookupTableProgram.closeLookupTable({
    lookupTable: lookupTableAddress, // O endereço da tabela de consulta a ser fechada
    authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
    recipient: user.publicKey, // O destinatário dos lamports da conta fechada
});
```

Tentar fechar uma tabela de consulta antes dela ter sido completamente desativada resultará em um erro.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Table cannot be closed until it's fully deactivated in 513 blocks",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid program argument";
```

### Congelando uma tabela de consulta

Além das operações CRUD padrão, você pode "congelar" uma tabela de consulta. Isso a torna imutável, de modo que ela não possa mais ser estendida, desativada ou fechada.

Você congela uma tabela de consulta com o método `freezeLookupTable`. Ele leva os seguintes parâmetros:

- `lookupTable` - o endereço da LUT a ser congelada
- `authority` - a conta com permissão para congelar a LUT

```typescript
const freezeInstruction = web3.AddressLookupTableProgram.freezeLookupTable({
    lookupTable: lookupTableAddress, // O endereço da tabela de consulta a ser congelada
    authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
});
```

Uma vez que uma LUT é congelada, quaisquer tentativas posteriores de modificá-la resultarão em um erro.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Lookup table is frozen",
"Program AddressLookupTab1e1111111111111111111111111 failed: Account is immutable";
```

### Usando tabelas de consulta em transações versionadas

Para usar uma tabela de consulta em uma transação versionada, você precisa recuperar a conta da tabela de consulta usando seu endereço.

```typescript
const lookupTableAccount = (
    await connection.getAddressLookupTable(lookupTableAddress)
).value;
```

Você pode então criar uma lista de instruções para incluir em uma transação como de costume. Ao criar a `TransactionMessage`, você pode incluir quaisquer contas de tabela de consulta passando-as como um array para o método `compileToV0Message()`. Você também pode fornecer várias contas de tabela de consulta.

```typescript
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
    recentBlockhash: blockhash, // O blockhash do bloco mais recente
    instructions: instructions, // As instruções a serem incluídas na transação
}).compileToV0Message([lookupTableAccount]); // Incluir contas de tabela de consulta

// Criar a transação versionada usando a mensagem
const transaction = new web3.VersionedTransaction(message);

// Assinar a transação
transaction.sign([payer]);

// Enviar a transação assinada para a rede
const transactionSignature = await connection.sendTransaction(transaction);
```

# Demonstração

Vamos praticar o uso de tabelas de consulta!

Esta demonstração irá guiá-lo através das etapas de criação, extensão e uso de uma tabela de consulta em uma transação versionada.

### 1. Código inicial

Para começar, faça o download do código inicial da branch starter deste [repositório](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/starter). Com o código inicial em mãos, execute `npm install` no terminal para instalar as dependências necessárias.

O código inicial inclui um exemplo de criação de uma transação legada que tem a intenção de transferir SOL para 22 destinatários de forma atômica. A transação contém 22 instruções onde cada instrução transfere SOL do signatário para um destinatário diferente.

O propósito do código inicial é ilustrar a limitação no número de endereços que podem ser incluídos em uma transação legada. Espera-se que a transação incorporada no código inicial falhe quando enviada.

O seguinte código inicial pode ser encontrado no arquivo `index.ts`.

```typescript
import { initializeKeypair } from "./initializeKeypair";
import * as web3 from "@solana/web3.js";

async function main() {
    // Conectar ao cluster da devnet
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Inicializar o par de chaves do usuário
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Gerar 22 endereços
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    // Criar um array de instruções de transferência
    const transferInstructions = [];

    // Adicionar uma instrução de transferência para cada endereço
    for (const address of recipients) {
        transferInstructions.push(
            web3.SystemProgram.transfer({
                fromPubkey: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
                toPubkey: address, // A conta de destino para a transferência
                lamports: web3.LAMPORTS_PER_SOL * 0.01, // A quantidade de lamports a ser transferida
            }),
        );
    }

    // Criar uma transação e adicionar as instruções de transferência
    const transaction = new web3.Transaction().add(...transferInstructions);

    // Enviar a transação para o cluster (isso falhará neste exemplo se os endereços > 21)
    const txid = await connection.sendTransaction(transaction, [user]);

    // Obter o último hash de bloco e a última altura de bloco válida
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // Confirmar a transação
    await connection.confirmTransaction({
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
        signature: txid,
    });

    // Registrar o URL da transação no Explorador Solana
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

Para executar o código, execute `npm start`. Isso criará um novo par de chaves, escreverá no arquivo `.env`, fará um airdrop de SOL da devnet para o par de chaves e enviará a transação construída no código inicial. Espera-se que a transação falhe com a mensagem de erro `Transaction too large`.

```
Creating .env file
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: 5ZZzcDbabFHmoZU8vm3VzRzN5sSQhkf91VJzHAJGNM7B
Error: Transaction too large: 1244 > 1232
```

Nos próximos passos, vamos ver como usar tabelas de consulta com transações versionadas para aumentar o número de endereços que podem ser incluídos em uma única transação.

Antes de começarmos, vá em frente e apague o conteúdo da função `main` para deixar apenas o seguinte:

```typescript
async function main() {
    // Conectar ao cluster da devnet
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Inicializar o par de chaves do usuário
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Gerar 22 endereços
    const addresses = [];
    for (let i = 0; i < 22; i++) {
        addresses.push(web3.Keypair.generate().publicKey);
    }
}
```

### 2. Criando uma função auxiliar `sendV0Transaction`

Vamos enviar várias transações "versão 0", então vamos criar uma função auxiliar para facilitar isso.

Esta função deve receber parâmetros para uma conexão, um par de chaves de um usuário, um array de instruções de transação e um array opcional de contas de tabela de consulta.

A função então realiza as seguintes tarefas:

- Recupera o último hash de bloco e a última altura de bloco válida da rede Solana
- Cria uma nova mensagem de transação usando as instruções fornecidas
- Assina a transação usando o par de chaves do usuário
- Envia a transação para a rede Solana
- Confirma a transação
- Registra o URL da transação no Explorador Solana

```typescript
async function sendV0Transaction(
    connection: web3.Connection,
    user: web3.Keypair,
    instructions: web3.TransactionInstruction[],
    lookupTableAccounts?: web3.AddressLookupTableAccount[],
) {
    // Obter o último hash de bloco e a última altura de bloco válida
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // Criar uma nova mensagem de transação com as instruções fornecidas
    const messageV0 = new web3.TransactionMessage({
        payerKey: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
        recentBlockhash: blockhash, // O hash de bloco do bloco mais recente
        instructions, // As instruções a serem incluídas na transação
    }).compileToV0Message(
        lookupTableAccounts ? lookupTableAccounts : undefined,
    );

    // Criar um novo objeto de transação com a mensagem
    const transaction = new web3.VersionedTransaction(messageV0);

    // Assinar a transação com o par de chaves do usuário
    transaction.sign([user]);

    // Enviar a transação para o cluster
    const txid = await connection.sendTransaction(transaction);

    // Confirmar a transação
    await connection.confirmTransaction(
        {
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
            signature: txid,
        },
        "finalized",
    );

    // Registrar o URL da transação no Explorador Solana
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

### 3. Criando uma função auxiliar `waitForNewBlock`

Lembre-se de que tabelas de consulta e os endereços nelas contidos não podem ser referenciados imediatamente após a criação ou extensão. Isso significa que precisaremos esperar um novo bloco antes de enviar transações que referenciem a tabela de consulta recém-criada ou estendida. Para deixar isso mais simples lá na frente, vamos criar uma função auxiliar `waitForNewBlock` que usaremos para esperar a ativação das tabelas de consulta entre o envio de transações.

Esta função terá parâmetros para uma conexão e uma altura de bloco alvo. Ela então inicia um intervalo que verifica a altura do bloco atual da rede a cada 1000ms. Uma vez que a nova altura do bloco exceda a altura alvo, o intervalo é limpo e a promessa é resolvida.

```typescript
function waitForNewBlock(connection: web3.Connection, targetHeight: number) {
    console.log(`Aguardando por ${targetHeight} novos blocos`);
    return new Promise(async (resolve: any) => {
        // Obter a última altura de bloco válida da blockchain
        const { lastValidBlockHeight } = await connection.getLatestBlockhash();

        // Configurar um intervalo para verificar novos blocos a cada 1000ms
        const intervalId = setInterval(async () => {
            // Obter a nova altura de bloco válida
            const { lastValidBlockHeight: newValidBlockHeight } =
                await connection.getLatestBlockhash();
            // console.log(newValidBlockHeight)

            // Verificar se a nova altura de bloco válida é maior que a altura de bloco alvo
            if (newValidBlockHeight > lastValidBlockHeight + targetHeight) {
                // Se a altura de bloco alvo for alcançada, limpar o intervalo e resolver a promessa
                clearInterval(intervalId);
                resolve();
            }
        }, 1000);
    });
}
```

### 4. Criando uma função `initializeLookupTable`

Agora que temos algumas funções auxiliares prontas, declare uma função chamada `initializeLookupTable`. Esta função possui os parâmetros `user`, `connection` e `addresses`. A função irá:

1. Recuperar o slot atual
2. Gerar uma instrução para criar uma tabela de consulta
3. Gerar uma instrução para estender a tabela de consulta com os endereços fornecidos
4. Enviar e confirmar uma transação com as instruções para criar e estender a tabela de consulta
5. Retornar o endereço da tabela de consulta

```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Obter o slot atual
    const slot = await connection.getSlot();

    // Criar uma instrução para criar uma tabela de consulta
    // e recuperar o endereço da nova tabela de consulta
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
            payer: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
            recentSlot: slot - 1, // O slot recente para derivar o endereço da tabela de consulta
        });
    console.log("endereço da tabela de consulta:", lookupTableAddress.toBase58());

    // Criar uma instrução para estender uma tabela de consulta com os endereços fornecidos
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
        authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
        lookupTable: lookupTableAddress, // O endereço da tabela de consulta a ser estendida
        addresses: addresses.slice(0, 30), // Os endereços a serem adicionados à tabela de consulta
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    return lookupTableAddress;
}
```

### 5. Modificando a função `main` para usar tabelas de consulta

Agora que podemos inicializar uma tabela de consulta com todos os endereços dos destinatários, vamos atualizar a função `main` para usar transações versionadas e tabelas de consulta. Precisaremos:

1. Chamar `initializeLookupTable`
2. Chamar `waitForNewBlock`
3. Obter a tabela de consulta usando `connection.getAddressLookupTable`
4. Criar a instrução de transferência para cada destinatário
5. Enviar a transação v0 com todas as instruções de transferência

```typescript
async function main() {
    // Conectar ao cluster da devnet
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Inicializar o par de chaves do usuário
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Gerar 22 endereços
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    const lookupTableAddress = await initializeLookupTable(
        user,
        connection,
        recipients,
    );

    await waitForNewBlock(connection, 1);

    const lookupTableAccount = (
        await connection.getAddressLookupTable(lookupTableAddress)
    ).value;

    if (!lookupTableAccount) {
        throw new Error("Tabela de consulta não encontrada");
    }

    const transferInstructions = recipients.map((recipient) => {
        return web3.SystemProgram.transfer({
            fromPubkey: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
            toPubkey: recipient, // A conta de destino para a transferência
            lamports: web3.LAMPORTS_PER_SOL * 0.01, // A quantidade de lamports a ser transferida
        });
    });

    await sendV0Transaction(connection, user, transferInstructions, [
        lookupTableAccount,
    ]);
}
```

Observe que você cria as instruções de transferência com o endereço completo do destinatário, mesmo tendo criado uma tabela de consulta. Isso porque, ao incluir a tabela de consulta na transação versionada, você diz ao framework `web3.js` para substituir quaisquer endereços de destinatários que coincidam com endereços na tabela de consulta por ponteiros para a tabela de consulta. Quando a transação é enviada para a rede, endereços que existem na tabela de consulta serão referenciados por um único byte, em vez dos 32 bytes completos.

Use `npm start` na linha de comando para executar a função `main`. Você deve ver uma saída semelhante à seguinte:

```bash
Current balance is 1.38866636
PublicKey: 8iGVBt3dcJdp9KfyTRcKuHY6gXCMFdnSG2F1pAwsUTMX
lookup table address: Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M
https://explorer.solana.com/tx/4JvCo2azy2u8XK2pU8AnJiHAucKTrZ6QX7EEHVuNSED8B5A8t9GqY5CP9xB8fZpTNuR7tbUcnj2MiL41xRJnLGzV?cluster=devnet
Waiting for 1 new blocks
https://explorer.solana.com/tx/rgpmxGU4QaAXw9eyqfMUqv8Lp6LHTuTyjQqDXpeFcu1ijQMmCH2V3Sb54x2wWAbnWXnMpJNGg4eLvuy3r8izGHt?cluster=devnet
Finished successfully
```

O primeiro link de transação no console representa a transação para criar e estender a tabela de consulta. A segunda transação representa as transferências para todos os destinatários. Fique à vontade para inspecionar essas transações no explorador.

Lembre-se, a mesma transação estava falhando quando você baixou o código inicial. Agora que estamos usando tabelas de consulta, podemos fazer todas as 22 transferências em uma única transação.

### 6. Adicionando mais endereços à tabela de consulta

Tenha em mente que a solução que desenvolvemos até agora só suporta transferências para até 30 contas, já que só estendemos a tabela de consulta uma vez. Quando se leva em consideração o tamanho da instrução de transferência, é possível estender a tabela de consulta com 27 endereços adicionais e completar uma transferência atômica para até 57 destinatários. Vamos adicionar suporte para isso agora!

Tudo o que precisamos fazer é ir até `initializeLookupTable` e fazer duas coisas:

1. Modificar a chamada existente para `extendLookupTable` para adicionar apenas os primeiros 30 endereços (mais do que isso e a transação será muito grande)
2. Adicionar um loop que continuará estendendo a tabela de consulta 30 endereços por vez até que todos os endereços tenham sido adicionados

```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Obter o slot atual
    const slot = await connection.getSlot();

    // Criar uma instrução para criar uma tabela de consulta
    // e recuperar o endereço da nova tabela de consulta
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
            payer: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
            recentSlot: slot - 1, // O slot recente para derivar o endereço da tabela de consulta
        });
    console.log("endereço da tabela de consulta:", lookupTableAddress.toBase58());

    // Criar uma instrução para estender uma tabela de consulta com os endereços fornecidos
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
        authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
        lookupTable: lookupTableAddress, // O endereço da tabela de consulta a ser estendida
        addresses: addresses.slice(0, 30), // Os endereços a serem adicionados à tabela de consulta
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    var remaining = addresses.slice(30);

    while (remaining.length > 0) {
        const toAdd = remaining.slice(0, 30);
        remaining = remaining.slice(30);
        const extendInstruction =
            web3.AddressLookupTableProgram.extendLookupTable({
                payer: user.publicKey, // O pagador (ou seja, a conta que pagará pelas taxas da transação)
                authority: user.publicKey, // A autoridade (ou seja, a conta com permissão para modificar a tabela de consulta)
                lookupTable: lookupTableAddress, // O endereço da tabela de consulta a ser estendida
                addresses: toAdd, // Os endereços a serem adicionados à tabela de consulta
            });

        await sendV0Transaction(connection, user, [extendInstruction]);
    }

    return lookupTableAddress;
}
```

Parabéns! Se você se sente confiante com esta demonstração, provavelmente está pronto para trabalhar com tabelas de consulta e transações versionadas por conta própria. Se quiser dar uma olhada no código da solução final, você pode [encontrá-lo na branch da solução](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/solution).

# Desafio

Como um desafio, experimente desativar, fechar e congelar tabelas de consulta. Lembre-se de que você precisa esperar uma tabela de consulta finalizar a desativação antes de poder fechá-la. Além disso, se uma tabela de consulta estiver congelada, ela não poderá ser modificada (desativada ou fechada), então você terá que testar separadamente ou usar tabelas de consulta separadas.

1. Crie uma função para desativar a tabela de consulta.
2. Crie uma função para fechar a tabela de consulta.
3. Crie uma função para congelar a tabela de consulta.
4. Teste as funções chamando-as na função `main()`

Você pode reutilizar as funções que criamos na demonstração para enviar a transação e esperar a tabela de consulta ativar/desativar. Fique à vontade para consultar este [código de solução](https://github.com/Unboxed-Software/versioned-transaction/tree/challenge).

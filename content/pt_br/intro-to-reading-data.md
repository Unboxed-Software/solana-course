---
title: Ler Dados da Rede Solana
objectives:
- Entender contas e seus endereços
- Entender SOL e lamports
- Usar web3.js para conectar à Solana e ler o saldo de uma conta
---

## Resumo

- **SOL** é o nome do token nativo da Solana. Cada Sol é composto por 1 bilhão de **Lamports**.
- **Contas** armazenam tokens, NFTs, programas e dados. Por agora, focaremos em contas que armazenam SOL.
- **Endereços** apontam para contas na rede Solana. Qualquer um pode ler os dados em um determinado endereço. A maioria dos endereços também são **chaves públicas**

# Visão Geral

## Contas

Todos os dados armazenados na Solana estão em contas. As contas podem armazenar:

- SOL
- Outros tokens, como USDC
- NFTs
- Programas, como o programa de avaliação de filmes que construímos neste curso!
- Dados de programas, como uma avaliação para um filme específico para o programa acima!

### SOL

SOL é o token nativo da Solana - SOL é usado para pagar taxas de transação, aluguel para contas e mais. SOL às vezes é mostrado com o símbolo `◎`. Cada SOL é composto por 1 bilhão de **Lamports**. Da mesma forma que aplicativos financeiros normalmente fazem contas em centavos (para USD), pence (para GBP), aplicativos Solana normalmente usam Lamports para fazer cálculos e só convertem para SOL para exibir dados.

### Endereços

Endereços identificam contas de forma única. Endereços são frequentemente mostrados como strings codificadas em base-58, como `dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8`. A maioria dos endereços na Solana também são **chaves públicas**. Como mencionado no capítulo anterior, quem controla a chave secreta correspondente controla a conta - por exemplo, a pessoa com a chave secreta pode enviar tokens da conta.

## Lendo da Blockchain da Solana

### Instalação

Usamos um pacote npm chamado `@solana/web3.js` para fazer a maior parte do trabalho com a Solana. Também instalaremos o TypeScript e o esrun, para que possamos executar comandos de linha de comando:

```bash
npm install typescript @solana/web3.js @digitak/esrun 
```

### Conectando-se à rede

Toda interação com a rede Solana usando `@solana/web3.js` ocorrerá através de um objeto `Connection`. O objeto `Connection` estabelece uma conexão com uma rede Solana específica, chamada de 'cluster'.

Por agora, usaremos o cluster `Devnet` em vez de `Mainnet`. Como o nome sugere, o cluster `Devnet` é projetado para uso e testes por desenvolvedores.

```typescript
import { Connection, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
console.log(`✅ Conectado!`)
```

Executar este código TypeScript (`npx esrun example.ts`) mostra:

```
✅ Conectado!
```

### Lendo da Rede

Para ler o saldo de uma conta:

```typescript
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);

console.log(`O saldo da conta de endereço ${address} é de ${balance} lamports`); 
console.log(`✅ Finalizado!`)
```

O saldo retornado está em *lamports*. Um lamport é a unidade menor para Sol, como os cents são para Dólares Americanos, ou pennies para Libras Esterlinas. Um único lamport representa 0.000000001 SOL. Na maioria das vezes, nós transferimos, gastamos, armazenamos e lidamos com SOL como Lamports, apenas convertendo para SOL completo para exibir aos usuários. Web3.js fornece a constante `LAMPORTS_PER_SOL` para fazer conversões rápidas.

```typescript
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);
const balanceInSol = balance / LAMPORTS_PER_SOL;

console.log(`O saldo da conta de endereço ${address} é de ${balanceInSol} SOL`); 
console.log(`✅ Finalizado!`)
```

Executar `npx esrun example.ts` mostrará algo como:

```
O saldo da conta de endereço CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN é de 0.00114144 SOL
✅ Finalizado!
```

...e assim, estamos lendo dados da blockchain Solana!

# Demonstração

Vamos praticar o que aprendemos e criar um site simples que permite aos usuários verificar o saldo em um endereço específico.

Terá mais ou menos esta aparência:

![Captura de tela da solução de demonstração](../../assets/intro-frontend-demo.png)

No interesse de manter o foco no tópico, não começaremos totalmente do zero, então [baixe o código inicial](https://github.com/Unboxed-Software/solana-intro-frontend/tree/starter). O projeto inicial usa Next.js e Typescript. Se você está acostumado com outra pilha, não se preocupe! Os princípios de web3 e Solana que você aprenderá ao longo dessas lições são aplicáveis a qualquer pilha frontend com a qual você esteja mais confortável.

### 1. Orientação

Uma vez que você tenha o código inicial, dê uma olhada ao redor. Instale as dependências com `npm install` e então execute o aplicativo com `npm run dev`. Note que, não importa o que você coloque no campo de endereço, quando você clicar em “Verificar Saldo SOL”, o saldo será um valor fictício de 1000.

Estruturalmente, o aplicativo é composto por `index.tsx` e `AddressForm.tsx`. Quando um usuário envia o formulário, o `addressSubmittedHandler` em `index.tsx` é chamado. É lá que adicionaremos a lógica para atualizar o resto da interface do usuário.

### 2. Instalando as dependências

Use `npm install @solana/web3.js` para instalar nossa dependência na biblioteca web3 da Solana.

### 3. Definindo o saldo do endereço

Primeiro, importe `@solana/web3.js` no topo de `index.tsx`.

Agora que a biblioteca está disponível, vamos entrar no `addressSubmittedHandler()` e criar uma instância de `PublicKey` usando o valor do endereço da entrada do formulário. Em seguida, crie uma instância de `Connection` e use-a para chamar `getBalance()`. Passe o valor da chave pública que você acabou de criar. Finalmente, chame `setBalance()`, passando o resultado de `getBalance`. Se você estiver disposto, tente isso independentemente em vez de copiar do trecho de código abaixo.

```typescript
import type { NextPage } from 'next'
import { useState } from 'react'
import styles from '../styles/Home.module.css'
import AddressForm from '../components/AddressForm'
import * as web3 from '@solana/web3.js'

const Home: NextPage = () => {
  const [balance, setBalance] = useState(0)
  const [address, setAddress] = useState('')

  const addressSubmittedHandler = async (address: string) => {
    setAddress(address)
    const key = new web3.PublicKey(address)
    const connection = new web3.Connection(web3.clusterApiUrl('devnet'));
    const balance = await connection.getBalance(key);
    setBalance(balance / web3.LAMPORTS_PER_SOL);
  }
  ...
}
```

Na maioria das vezes, ao lidar com SOL, o sistema usará lamports em vez de SOL. Como os computadores lidam melhor com números inteiros do que frações, geralmente fazemos a maioria de nossas transações em lamports inteiros, apenas convertendo de volta para Sol para exibir o valor para os usuários. É por isso que pegamos o saldo retornado pela Solana e o dividimos por `LAMPORTS_PER_SOL`.

Antes de definir o saldo em nosso estado, também o convertemos para SOL usando a constante `LAMPORTS_PER_SOL`.

Neste ponto, você deve ser capaz de colocar um endereço válido no campo do formulário e clicar em “Check SOL Balance” para ver tanto o Endereço quanto o Saldo aparecerem abaixo.

### 4. Lidando com endereços inválidos

Estamos quase terminando. O único problema restante é que o uso de um endereço inválido não mostra nenhuma mensagem de erro ou altera o saldo mostrado. Se você abrir o console do desenvolvedor, verá `Error: Invalid public key input`. Ao usar o construtor `PublicKey`, você precisa passar um endereço válido ou receberá esse erro.

Para corrigir isso, vamos envolver tudo em um bloco `try-catch` e alertar o usuário se a entrada deles for inválida.

```typescript
const addressSubmittedHandler = async (address: string) => {
  try {
    setAddress(address);
    const key = new web3.PublicKey(address);
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    const balance = await connection.getBalance(key)
    setBalance(balance / web3.LAMPORTS_PER_SOL);
  } catch (error) {
    setAddress("");
    setBalance(0);
    alert(error);
  }
};
```

Observe que no bloco `catch` também limpamos o endereço e o saldo para evitar confusão.

Conseguimos! Temos um site funcionando que lê saldos em SOL da rede Solana. Você está no caminho certo para alcançar suas grandes ambições na Solana. Se você precisar passar mais tempo olhando para este código para entendê-lo melhor, dê uma olhada no [código da solução completa](https://github.com/Unboxed-Software/solana-intro-frontend). Segure firme, essas lições vão acelerar rapidamente.

# Desafio

Como este é o primeiro desafio, vamos mantê-lo simples. Vá em frente e melhore o frontend que já criamos, incluindo um item de linha após "Saldo". Faça o item de linha mostrar se a conta é ou não uma conta executável. Dica: há um método `getAccountInfo()`.

Como isso é a DevNet, seu endereço de carteira da mainnet regular _não_ será executável, então, se você quiser um endereço que _será_ executável para teste, use `CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN`.

![Captura de tela da solução final do desafio](../../assets/intro-frontend-challenge.png)

Se você tiver dúvidas, sinta-se à vontade para dar uma olhada no [código da solução](https://github.com/Unboxed-Software/solana-intro-frontend/tree/challenge-solution).

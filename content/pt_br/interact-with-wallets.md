---
title: Interagir com Carteiras
objectives:
- Explicar as carteiras
- Instalar a extensão Phantom
- Definir uma carteira Phantom como [Devnet] (https://api.devnet.solana.com/)
- Usar o adaptador de carteira para que os usuários assinem as transações
---

# RESUMO

- **Carteiras** armazenam sua chave secreta e lidam com a segurança de assinatura de transações
- **Carteiras de Hardware** armazenam sua chave secreta em um dispositivo separado
- **Carteiras de Software** usam seu computador para armazenamento seguro
- As carteiras de software geralmente são **extensões de navegador** que facilitam a conexão com sites
- A biblioteca **Wallet-Adapter** do Solana simplifica o suporte a extensões de navegador de carteiras, permitindo a criação de sites que podem solicitar o endereço da carteira de um usuário e propor transações para serem assinadas por eles.

# Visão Geral

## Carteiras

Nas duas lições anteriores, discutimos os pares de chaves. Os pares de chaves são usados para localizar contas e assinar transações. Embora o compartilhamento da chave pública de um par de chaves seja perfeitamente seguro, a chave secreta deve ser sempre mantida em um local seguro. Se a chave secreta de um usuário for exposta, um agente mal-intencionado poderá drenar todos os ativos da conta e executar transações com a autoridade desse usuário.

Uma "carteira" refere-se a qualquer coisa que armazene uma chave secreta para mantê-la segura. Essas opções de armazenamento seguro geralmente podem ser descritas como carteiras de "hardware" ou de "software". As carteiras de hardware são dispositivos de armazenamento separados de seu computador. As carteiras de software são aplicativos que podem ser instalados em seus dispositivos existentes.

As carteiras de software geralmente vêm na forma de uma extensão de navegador. Isso permite que os sites interajam facilmente com a carteira. Essas interações geralmente são limitadas a:

1. Ver a chave pública (endereço) da carteira
2. Enviar transações para aprovação do usuário
3. Enviar uma transação aprovada para a rede

Depois que uma transação é submetida, o usuário final pode "confirmar" a transação e enviá-la à rede com sua "assinatura".

A assinatura de transações requer o uso de sua chave secreta. Ao permitir que um site envie uma transação para sua carteira e deixar que a carteira cuide da assinatura, você garante que nunca exporá sua chave secreta ao site. Em vez disso, você só compartilha a chave secreta com o aplicativo da carteira.

A menos que você mesmo esteja criando um aplicativo de carteira, seu código nunca deve precisar solicitar a chave secreta de um usuário. Em vez disso, você pode pedir aos usuários que se conectem ao seu site usando uma carteira confiável.

## Carteira Phantom

Uma das carteiras de software mais usadas no ecossistema Solana é a [Phantom] (https://phantom.app). A Phantom é compatível com alguns dos navegadores mais populares e tem um aplicativo móvel para conexão em trânsito. Você provavelmente desejará que seus aplicativos descentralizados sejam compatíveis com a várias carteiras, mas este curso se concentrará na Phantom.

## Wallet-Adaptor (Adaptador de Carteira Solana)

O Wallet-Adaptor da Solana é um conjunto de bibliotecas que você pode usar para simplificar o processo de compatibilidade com extensões de navegador de carteira.

O Wallet-Adaptor do Solana é composto por vários pacotes modulares. A funcionalidade principal é encontrada em `@solana/wallet-adapter-base` e `@solana/wallet-adapter-react`.

Há também pacotes que fornecem componentes para frameworks de Interface do Usuário (UI) comuns. Nesta lição e em todo o curso, usaremos componentes do `@solana/wallet-adapter-react-ui`.

Por fim, há pacotes que são adaptadores para carteiras específicas, incluindo a Phantom. Você pode usar `@solana/wallet-adapter-wallets` para incluir todas as carteiras compatíveis ou pode escolher um pacote de carteira específico, como `@solana/wallet-adapter-phantom`.

### Instale Bibliotecas de Adaptadores de Carteira 

Ao adicionar suporte para carteira a um aplicativo react existente, você começa instalando os pacotes apropriados. Você precisará do `@solana/wallet-adapter-base` e `@solana/wallet-adapter-react`. Se você planeja usar os componentes react disponíveis, também precisará adicionar `@solana/wallet-adapter-react-ui`.

Todas as carteiras que suportam [padrão carteira](https://github.com/wallet-standard/wallet-standard) o fazem imediatamente, e quase todas as carteiras Solana atuais suportam o padrão carteira. No entanto, se você quiser adicionar compatibilidade a carteiras que não suportam o padrão, adicione um pacote para elas.

```
npm install @solana/wallet-adapter-base \
    @solana/wallet-adapter-react \
    @solana/wallet-adapter-react-ui
```

### Conecte-se a Carteiras

`@solana/wallet-adapter-react` permite que persistamos e acessemos os estados de conexão da carteira por meio de ganchos (hooks) e provedores de contexto, a saber:

- `useWallet`
- `WalletProvider`
- `useConnection`
- `ConnectionProvider`

Para que eles funcionem corretamente, qualquer uso de `useWallet` e `useConnection` deve ser incorporado em `WalletProvider` e `ConnectionProvider`. Uma das melhores maneiras de garantir isso é encapsular todo o seu aplicativo em `ConnectionProvider` e `WalletProvider`:

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

Observe que o `ConnectionProvider` requer uma propriedade `endpoint` e que o `WalletProvider` requer uma propriedade `wallets`. Continuamos a usar o ponto de extremidade (endpoint) para o cluster da Devnet e, por enquanto, estamos usando apenas o `PhantomWalletAdapter` para `wallets`.

Nesse momento, você pode se conectar com `wallet.connect()`, que instruirá a carteira a solicitar ao usuário permissão para visualizar sua chave pública e solicitar aprovação para transações.

![Captura de tela do prompt de conexão da carteira](../assets/wallet-connect-prompt.png)

Embora você possa fazer isso em um gancho `useEffect`, geralmente deseja fornecer uma funcionalidade mais sofisticada. Por exemplo, talvez você queira que os usuários possam escolher entre uma lista de carteiras compatíveis ou desconectar-se depois de já terem se conectado.

### `@solana/wallet-adapter-react-ui`

Você pode criar componentes personalizados para isso ou aproveitar os componentes fornecidos por `@solana/wallet-adapter-react-ui`. A maneira mais simples de fornecer opções abrangentes é usar o `WalletModalProvider` e o `WalletMultiButton`:

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

O `WalletModalProvider` adiciona funcionalidade para apresentar uma tela modal para que os usuários selecionem a carteira que desejam usar. O `WalletMultiButton` altera o comportamento para corresponder ao status da conexão:

![Captura de tela do botão múltiplo para selecionar a opção de carteira](../assets/multi-button-select-wallet.png)

![Captura de tela do modal para conectar a carteira](../assets/connect-wallet-modal.png)

![Captura de tela das opções de conexão com botão múltiplo](../assets/multi-button-connect.png)

![Captura de tela do estado conectado do botão múltiplo](../assets/multi-button-connected.png)

Você também pode usar componentes mais granulares se precisar de uma funcionalidade mais específica:

- `WalletConnectButton`
- `WalletModal`
- `WalletModalButton`
- `WalletDisconnectButton`
- `WalletIcon`

### Acesse Informações da Conta

Quando seu site estiver conectado a uma carteira, o `useConnection` recuperará um objeto `Connection` e o `useWallet` obterá o `WalletContextState`. O `WalletContextState` tem uma propriedade `publicKey` que é `null` quando não está conectado a uma carteira e tem a chave pública da conta do usuário quando uma carteira está conectada. Com uma chave pública e uma conexão, você pode obter informações da conta e muito mais.

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

    connection.onAccountChange(
      publicKey,
      (updatedAccountInfo) => {
        setBalance(updatedAccountInfo.lamports / LAMPORTS_PER_SOL);
      },
      "confirmed",
    );

    connection.getAccountInfo(publicKey).then((info) => {
      setBalance(info.lamports);
    });
  }, [connection, publicKey]);

  return (
    <div>
      <p>{publicKey ? `Balance: ${balance / LAMPORTS_PER_SOL} SOL` : ""}</p>
    </div>
  );
};
```

Observe a chamada para connection.onAccountChange(), que atualiza o saldo da conta exibido quando a rede confirma a transação.

### Envie Transações

`WalletContextState` também fornece uma função `sendTransaction` que você pode usar para submeter transações para serem aprovadas. 

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

Quando essa função for chamada, a carteira conectada exibirá a transação para aprovação do usuário. Se aprovada, a transação será enviada.

![Captura de tela do prompt de aprovação de transação de carteira](../assets/wallet-transaction-approval-prompt.png)

# Demonstração

Vamos usar o programa Ping da última lição e criar um frontend que permita aos usuários aprovar uma transação que faça ping no programa. Como lembrete, a chave pública do programa é `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa` e a chave pública da conta de dados é `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

![Captura de tela do APP Solana Ping](../assets/solana-ping-app.png)

### 1. Faça o download da extensão de navegador Phantom e defina-a como Devnet

Se você ainda não o tem, faça o download da [extensão de navegador Phantom](https://phantom.app/download). No momento em que este artigo foi escrito, ele era compatível com os navegadores Chrome, Brave, Firefox e Edge. Portanto, você também precisará ter um desses navegadores instalado. Siga as instruções do Phantom para criar uma nova conta e uma nova carteira.

Depois de ter uma carteira, clique na engrenagem de configurações no canto inferior direito da interface do usuário da Phantom. Role para baixo e clique no item de linha "Change Network" (Alterar rede) e selecione "Devnet". Isso garante que a Phantom estará conectado à mesma rede que usaremos nesta demonstração.

### 2. Faça o download do código inicial

Faça download do [código inicial para este projeto](https://github.com/Unboxed-Software/solana-ping-frontend/tree/starter). Este projeto é um aplicativo Next.js simples. Ele está praticamente vazio, exceto pelo componente `AppBar`. Criaremos o restante ao longo desta demonstração.

Você pode ver seu estado atual com o comando `npm run dev` no console.

### 3. Encapsule o aplicativo em provedores de contexto

Para começar, vamos criar um novo componente para conter os vários provedores de adaptadores de carteira que usaremos. Crie um novo arquivo dentro da pasta `components` chamado `WalletContextProvider.tsx`.

Vamos começar com alguns dos elementos básicos de um componente funcional:

```tsx
import { FC, ReactNode } from "react";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (

  ));
};

export default WalletContextProvider;
```

Para conectar-se adequadamente à carteira do usuário, precisaremos de um `ConnectionProvider`, `WalletProvider` e `WalletModalProvider`. Comece importando esses componentes de `@solana/wallet-adapter-react` e `@solana/wallet-adapter-react-ui`. Em seguida, adicione-os ao componente `WalletContextProvider`. Observe que o `ConnectionProvider` requer um parâmetro `endpoint` e o `WalletProvider` requer um array de `wallets`. Por enquanto, use apenas uma string vazia e um array vazio, respectivamente.

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

As últimas coisas de que precisamos são um ponto de extremidade real para `ConnectionProvider` e as carteiras compatíveis para `WalletProvider`.

Para o ponto de extremidade, usaremos a mesma função `clusterApiUrl` da biblioteca `@solana/web3.js` que usamos anteriormente. Portanto, você precisará importá-la. Para o array de carteiras, você também precisará importar a biblioteca `@solana/wallet-adapter-wallets`.

Depois de importar essas bibliotecas, crie uma constante `endpoint` que use a função `clusterApiUrl` para obter o url do Devnet. Em seguida, crie uma constante `wallets` e defina-a como um array que contém um `PhantomWalletAdapter` recém-construído. Por fim, substitua a string vazia e o array vazio em `ConnectionProvider` e `WalletProvider`, respectivamente.

Para concluir esse componente, adicione `require('@solana/wallet-adapter-react-ui/styles.css');` abaixo de suas importações para garantir o estilo e o comportamento adequados dos componentes da biblioteca do Wallet Adapter.

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

### 4. Adicione o multi-button (botão múltiplo) à carteira

Em seguida, vamos configurar o botão Connect. O botão atual é apenas um espaço reservado porque, em vez de usar um botão padrão ou criar um componente personalizado, usaremos o "multi-button" do Wallet-Adapter. Esse botão faz interface com os provedores que configuramos em `WalletContextProvider` e permite que os usuários escolham uma carteira, conectem-se e desconectem-se de uma carteira. Se precisar de mais funcionalidades personalizadas, você poderá criar um componente personalizado para lidar com isso.

Antes de adicionarmos o "botão múltiplo", precisamos encapsular o aplicativo no `WalletContextProvider`. Para isso, importe-o em `index.tsx` e adicione-o após a tag de fechamento `</Head>`:

```tsx
import { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import WalletContextProvider from '../components/WalletContextProvider'
import { AppBar } from '../components/AppBar'
import Head from 'next/head'
import { PingButton } from '../components/PingButton'

const Home: NextPage = (props) => {

    return (
        <div className={styles.App}>
            <Head>
                <title>Wallet-Adapter Example</title>
                <meta
                    name="description"
                    content="Wallet-Adapter Example"
                />
            </Head>
            <WalletContextProvider>
                <AppBar />
                <div className={styles.AppBody}>
                    <PingButton/>
                </div>
            </WalletContextProvider >
        </div>
    );
}

export default Home
```

Se você executar o aplicativo, tudo vai parecer o mesmo já que o botão atual na parte superior direita da tela ainda é apenas um espaço reservado. Para corrigir isso, abra o `AppBar.tsx` e substitua `<button>Connect</button>` por `<WalletMultiButton/>`. Você precisará importar `WalletMultiButton` de `@solana/wallet-adapter-react-ui`.

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

Nesse momento, você deve conseguir executar o aplicativo e interagir com o botão múltiplo na parte superior direita da tela. Agora deve estar escrito "Select Wallet" (Selecionar carteira). Se você tiver a extensão Phantom e estiver conectado, poderá conectar sua carteira Phantom ao site usando esse novo botão.

### 5. Crie um botão para o programa ping

Agora que nosso aplicativo pode se conectar à carteira Phantom, vamos fazer com que o botão "Ping!" realmente faça alguma coisa.

Comece abrindo o arquivo `PingButton.tsx`. Vamos substituir o `console.log` dentro de `onClick` pelo código que criará uma transação e a enviará à extensão Phantom para aprovação do usuário final.

Primeiro, precisamos de uma conexão, da chave pública da carteira e da função `sendTransaction` do Wallet-Adapter. Para obter isso, precisamos importar `useConnection` e `useWallet` de `@solana/wallet-adapter-react`. Enquanto estivermos aqui, vamos importar também `@solana/web3.js`, pois precisaremos dele para criar nossa transação.

```tsx
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import * as web3 from '@solana/web3.js'
import { FC, useState } from 'react'
import styles from '../styles/PingButton.module.css'

export const PingButton: FC = () => {

  const onClick = () => {
    console.log('Ping!')
  }

  return (
    <div className={styles.buttonContainer} onClick={onClick}>
      <button className={styles.button}>Ping!</button>
    </div>
  )
}
```

Agora, use o gancho `useConnection` para criar uma constante `connection` e o gancho `useWallet` para criar as constantes `publicKey` e `sendTransaction`..

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

Com isso, podemos preencher o corpo do `onClick`.

Primeiro, verifique se `connection` e `publicKey` existem (se não existirem, a carteira do usuário ainda não está conectada).

Em seguida, construa duas instâncias de `PublicKey`, uma para o ID do programa `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa` e outra para a conta de dados `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

Em seguida, crie uma `Transaction` e, depois, uma nova `TransactionInstruction` que inclua a conta de dados como uma chave gravável.

Em seguida, adicione a instrução à transação.

Por fim, chame `sendTransaction`.

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

E é isso! Se você atualizar a página, conectar sua carteira e clicar no botão ping, a Phantom deverá apresentar um pop-up para confirmar a transação.

### 6. Adicione um pouco de acabamento nas bordas

Há muitas coisas que você poderia fazer para tornar a experiência do usuário ainda melhor. Por exemplo, você poderia alterar a interface do usuário para mostrar apenas o botão Ping quando uma carteira estiver conectada e exibir algum outro prompt caso contrário. Você poderia criar um link para a transação no Solana Explorer depois que um usuário confirmar uma transação, para que ele possa ver facilmente os detalhes da transação. Quanto mais você experimentar, mais confortável ficará, portanto, seja criativo!

Você também pode fazer o download do [código fonte completo desta demonstração](https://github.com/Unboxed-Software/solana-ping-frontend) para entender tudo neste contexto.

# Desafio

Agora é sua vez de criar algo de forma independente. Crie um aplicativo que permita que um usuário conecte sua carteira Phantom e envie SOL para outra conta.

![Captura de tela do App para Enviar Sol](../assets/solana-send-sol-app.png)

1. Você pode criar esse aplicativo do zero ou pode [fazer download do código inicial](https://github.com/Unboxed-Software/solana-send-sol-frontend/tree/starter).
2. Encapsule o aplicativo inicial nos provedores de contexto apropriados.
3. No componente de formulário, configure a transação e envie-a para a carteira do usuário para aprovação.
4. Seja criativo com a experiência do usuário. Adicione um link para permitir que o usuário visualize a transação no Solana Explorer ou qualquer outra coisa que lhe pareça interessante!

Se você ficar realmente confuso, sinta-se à vontade para [consultar o código de solução](https://github.com/Unboxed-Software/solana-send-sol-frontend/tree/main).

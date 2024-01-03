---
title: Desenvolvimento Local de Programas
objectives:
- Configurar um ambiente local para desenvolvimento de programas Solana
- Usar comandos básicos da CLI da Solana
- Executar um validador de teste local
- Usar o Rust e a CLI da Solana para implantar um programa Solana do seu ambiente de desenvolvimento local
- Usar a CLI da Solana para visualizar logs de programas
---

# Resumo

- Para começar com a Solana localmente, você primeiro precisará instalar o **Rust** e a **CLI da Solana**
- Usando a CLI da Solana, você pode executar um **validador de teste local** usando o comando `solana-test-validator`
- Uma vez que você tenha o Rust e a CLI da Solana instalados, você poderá construir e implantar seus programas localmente usando os comandos `cargo build-bpf` e `solana program deploy`
- Você pode visualizar logs de programas usando o comando `solana logs`

# Visão Geral

Até agora neste curso, usamos o Solana Playground para desenvolver e implantar programas Solana. E embora seja uma ótima ferramenta, para alguns projetos complexos você pode preferir ter um ambiente de desenvolvimento local configurado. Isso pode ser para usar crates não suportados pelo Solana Playground, para tirar proveito de scripts ou ferramentas personalizadas que você criou, ou simplesmente por preferência pessoal.

Dito isso, esta lição será um pouco diferente das outras. Em vez de cobrir muitos aspectos de como escrever um programa ou interagir com a rede Solana, esta lição se concentrará principalmente na tarefa menos glamorosa de configurar seu ambiente de desenvolvimento local.

Para construir, testar e implantar programas Solana a partir da sua máquina, você precisará instalar o compilador Rust e a Interface de Linha de Comando (CLI) da Solana. Começaremos orientando você através desses processos de instalação e depois cobriremos como usar o que você acabou de instalar.

As instruções de instalação abaixo contêm os passos para instalar o Rust e a CLI da Solana no momento da escrita. Eles podem ter mudado até o momento em que você estiver lendo isto, então se você encontrar problemas, consulte as páginas oficiais de instalação de cada um:

- [Instalar Rust](https://www.rust-lang.org/tools/install)
- [Instalar o Conjunto de Ferramentas Solana](https://docs.solana.com/cli/install-solana-cli-tools)

## Configuração no Windows (com Linux)

### Baixando o Subsistema Windows para Linux (WSL)

Se você estiver em um computador Windows, é recomendado usar o Subsistema Windows para Linux (WSL) para construir seus Programas Solana.

Abra um PowerShell ou Prompt de Comando do Windows **como administrador** e verifique a versão do Windows:

```bash
winver
```

Se você estiver usando o Windows 10 versão 2004 ou superior (Build 19041 ou superior) ou Windows 11, execute o seguinte comando.

```bash
wsl --install
```

Se você estiver usando uma versão mais antiga do Windows, siga [as instruções para versões mais antigas do Windows](https://docs.microsoft.com/pt-br/windows/wsl/install-manual).

Você pode [ler mais sobre a instalação do WSL da Microsoft](https://docs.microsoft.com/pt-br/windows/wsl/install).

### Baixando o Ubuntu

Em seguida, [baixe o Ubuntu](https://apps.microsoft.com/store/detail/ubuntu-2004/9N6SVWS3RX71?hl=en-us&gl=US). O Ubuntu fornece um terminal que permite executar o Linux em um computador Windows. É aqui que você executará os comandos da CLI da Solana.

### Baixando o Rust (para WSL)

Em seguida, abra um terminal Ubuntu e baixe o Rust para WSL usando o seguinte comando. Você pode ler mais sobre [baixar o Rust na documentação oficial](https://www.rust-lang.org/pt-BR/learn/get-started).

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Baixando a CLI da Solana

Agora estamos prontos para baixar a CLI da Solana para Linux. Vá em frente e execute o seguinte comando em um terminal Ubuntu. Você pode ler mais sobre [baixar a CLI da Solana na documentação oficial](https://docs.solana.com/cli/install-solana-cli-tools).

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

## Configuração no macOS

### Baixando o Rust

Primeiro, baixe o Rust seguindo [as instruções](https://www.rust-lang.org/pt-BR/tools/install)

### Baixando a CLI da Solana

Em seguida, baixe a CLI da Solana executando o seguinte comando em seu terminal:

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

Você pode ler mais sobre [baixar a CLI da Solana aqui](https://docs.solana.com/cli/install-solana-cli-tools).

## Noções Básicas da CLI da Solana

A CLI da Solana é uma ferramenta de interface de linha de comando que fornece uma coleção de comandos para interagir com um cluster Solana.

Vamos cobrir alguns dos comandos mais comuns nesta lição, mas você sempre pode ver a lista de todos os possíveis comandos da CLI da Solana executando `solana --help`.

### Configuração da CLI da Solana

A CLI da Solana armazena várias configurações que impactam o comportamento de certos comandos. Você pode usar o seguinte comando para visualizar a configuração atual:

```bash
solana config get
```

O comando `solana config get` retornará o seguinte:

- `Config File` - o arquivo em que a CLI da Solana está localizada no seu computador
- `RPC URL` - ponto de extremidade que você está usando, conectando você ao localhost, Devnet ou Mainnet
- `WebSocket URL` - o websocket para ouvir eventos do cluster que você está direcionando (calculado quando você define o `RPC URL`)
- `Keypair Path` - o caminho do par de chaves usado ao executar subcomandos da CLI da Solana
- `Commitment` - fornece uma medida da confirmação da rede e descreve o quão finalizado um bloco está naquele ponto no tempo

Você pode mudar sua configuração da CLI da Solana a qualquer momento usando o comando `solana config set` seguido pela configuração que deseja atualizar.

A mudança mais comum será para o cluster que você está direcionando. Use o comando `solana config set --url` para mudar o `RPC URL`.

```bash
solana config set --url localhost
```

```bash
solana config set --url devnet
```

```bash
solana config set --url mainnet-beta
```

Da mesma forma, você pode usar o comando `solana config set --keypair` para mudar o `Keypair Path`. A CLI da Solana então usará o par de chaves do caminho especificado ao executar comandos.

```bash
solana config set --keypair ~/<CAMINHO_DO_ARQUIVO>
```

### Validadores de Teste

Muitas vezes, é útil executar um validador de teste local para testar e depurar em vez de implantar na Devnet.

Você pode executar um validador de teste local usando o comando `solana-test-validator`. Este comando cria um processo em andamento que exigirá sua própria janela de linha de comando.

### Transmitindo logs do programa

É frequentemente útil abrir um novo console e executar o comando `solana logs` ao lado do validador de teste. Isso cria outro processo em andamento que transmitirá os logs associados à configuração do seu cluster.

Se a configuração da sua CLI estiver apontada para `localhost`, os logs sempre estarão associados ao validador de teste que você criou, mas você também pode transmitir logs de outros clusters como Devnet e Mainnet Beta. Ao transmitir logs de outros clusters, você deverá incluir um ID de programa com o comando para limitar os logs que você vê do seu programa específico.

### Pares de Chaves

Você pode gerar um novo par de chaves usando o comando `solana-keygen new --outfile`, seguido do caminho do arquivo para armazenar o par de chaves.

```bash
solana-keygen new --outfile ~/<CAMINHO_DO_ARQUIVO>
```

Em alguns momentos, você pode precisar verificar a qual par de chaves sua configuração está apontada. Para visualizar a `publickey` do par de chaves atual definido em `solana config`, use o comando `solana address`.

```bash
solana address
```

Para visualizar o saldo SOL do par de chaves atual definido em `solana config`, use o comando `solana balance`.

```bash
solana balance
```

Para realizar um airdrop de SOL na Devnet ou localhost, use o comando `solana airdrop`. Observe que, na Devnet, você está limitado a 2 SOL por airdrop.

```bash
solana airdrop 2
```

Conforme você desenvolve e testa programas em seu ambiente local, é provável que encontre erros causados por:

- Usar o par de chaves errado
- Não ter saldo SOL suficiente para implantar seu programa ou realizar uma transação
- Estar apontando para o cluster errado

Os comandos da CLI que abordamos até agora devem ajudá-lo a resolver rapidamente esses problemas.

## Desenvolvendo programas Solana em seu ambiente local

Embora o Solana Playground seja tremendamente útil, é difícil superar a flexibilidade do seu próprio ambiente de desenvolvimento local. À medida que você cria programas mais complexos, pode acabar integrando-os com um ou mais clientes que também estão em desenvolvimento em seu ambiente local. Testar entre esses programas e clientes muitas vezes é mais simples quando você escreve, compila e implanta seus programas localmente.

### Criando um novo projeto

Para criar um novo pacote Rust para escrever um programa Solana, você pode usar o comando `cargo new --lib` com o nome do novo diretório que você deseja criar.

```bash
cargo new --lib <NOME_DO_DIRETÓRIO_DO_PROJETO>
```

Este comando criará um novo diretório com o nome que você especificou no final do comando. Este novo diretório conterá um arquivo de manifesto `Cargo.toml` que descreve o pacote.

O arquivo de manifesto contém metadados como nome, versão e dependências (crates). Para escrever um programa Solana, você precisará atualizar o arquivo `Cargo.toml` para incluir `solana-program` como uma dependência. Você também pode precisar adicionar as linhas `[lib]` e `crate-type` mostradas abaixo.

```rust
[package]
name = "<NOME_DO_DIRETÓRIO_DO_PROJETO>"
version = "0.1.0"
edition = "2021"

[features]
no-entrypoint = []

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

Nesse ponto, você pode começar a escrever seu programa na pasta `src`.

### Compilação e Implantação

Quando chegar a hora de compilar seu programa Solana, você pode usar o comando `cargo build-bpf`.

```bash
cargo build-bpf
```

A saída deste comando incluirá instruções para implantar seu programa que se parecerão com isso:

```text
To deploy this program (Para implantar este programa:):
  $ solana program deploy /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local.so
The program address will default to this keypair (override with --program-id) (O endereço do programa será predefinido para este par de chaves (substitua com --program-id)):
  /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local-keypair.json
```

Quando estiver pronto para implantar o programa, use o comando `solana program deploy` de saída do `cargo build-bpf`. Isso implantará seu programa no cluster especificado em sua configuração da CLI.

```rust
solana program deploy <CAMINHO>
```

# Demonstração

Vamos praticar construindo e implantando o programa "Hello World!" que criamos na [lição Hello World](https://github.com/Unboxed-Software/solana-course/pull/content/hello-world-program.md).

Vamos fazer isso tudo localmente, incluindo a implantação em um validador de teste local. Antes de começarmos, certifique-se de ter instalado o Rust e a CLI da Solana. Você pode se referir às instruções na visão geral para configurar se ainda não o fez.

### 1. Criando um novo projeto Rust

Vamos começar criando um novo projeto Rust. Execute o comando `cargo new --lib` abaixo. Sinta-se à vontade para substituir o nome do diretório pelo seu próprio.

```bash
cargo new --lib solana-hello-world-local
```

Lembre-se de atualizar o arquivo `cargo.toml` para incluir `solana-program` como uma dependência e o `crate-type` se ainda não estiver lá.

```bash
[package]
name = "solana-hello-world-local"
version = "0.1.0"
edition = "2021"

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

### 2. Escrevendo seu programa

Em seguida, atualize `lib.rs` com o programa "Hello World!" abaixo. Este programa simplesmente imprime "Hello, world!" no registro do programa quando o programa é chamado.

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult{
    msg!("Hello, world!");

    Ok(())
}
```

### 3. Executando um validador de teste local

Com seu programa escrito, vamos garantir que nossa configuração da CLI da Solana aponte para localhost usando o comando `solana config set --url`.

```bash
solana config set --url localhost
```

Em seguida, verifique se a configuração da CLI da Solana foi atualizada usando o comando `solana config get`.

```bash
solana config get
```

Finalmente, execute um validador de teste local. Em uma janela de terminal separada, execute o comando `solana-test-validator`. Isso é necessário apenas quando nosso `RPC URL` está definido como localhost.

```bash
solana-test-validator
```

### 4. Compilando e Implantando

Agora estamos prontos para compilar e implantar nosso programa. Compile o programa executando o comando `cargo build-bpf`.

```bash
cargo build-bpf
```

Agora vamos implantar nosso programa. Execute o comando `solana program deploy` de saída do `cargo build-bpf`.

```bash
solana program deploy <CAMINHO>
```

O `solana program deploy` irá fornecer o `Program ID` para o seu programa. Agora você pode procurar o programa implantado no [Explorador da Solana](https://explorer.solana.com/?cluster=custom) (para localhost, selecione "Custom RPC URL" como o cluster).

### 5. Visualizando logs do programa

Antes de chamar nosso programa, abra um terminal separado e execute o comando `solana logs`. Isso permitirá que você veja os logs do programa no terminal.

```bash
solana logs <ID_DO_PROGRAMA>
```

Com o validador de teste ainda em execução, tente chamar seu programa usando [este script do lado do cliente](https://github.com/Unboxed-Software/solana-hello-world-client).

Substitua o ID do programa em `index.ts` pelo que você acabou de implantar e, em seguida, execute `npm install` seguido de `npm start`. Isso retornará um URL do Explorador da Solana. Copie o URL para o navegador para procurar a transação no Explorador da Solana e verifique se "Hello, world!" foi impresso no registro do programa. Alternativamente, você pode ver os logs do programa no terminal onde você executou o comando `solana logs`.

E é isso! Você acabou de criar e implantar seu primeiro programa a partir de um ambiente de desenvolvimento local.

# Desafio

Agora é a sua vez de construir algo independentemente. Tente criar um novo programa para imprimir sua própria mensagem nos logs do programa. Desta vez, implante seu programa na Devnet em vez de localhost.

Lembre-se de atualizar o seu `RPC URL` para Devnet usando o comando `solana config set --url`.

Você pode chamar o programa usando o mesmo script do lado do cliente da demonstração, desde que atualize `connection` e o URL do Explorador da Solana para apontar ambos para a Devnet em vez de localhost.

```tsx
let connection = new web3.Connection(web3.clusterApiUrl("devnet"));
```

```tsx
console.log(
    `Transação: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
);
```

Você também pode abrir uma janela separada de linha de comando e usar o comando `solana logs | grep "<ID_DO_PROGRAMA> invoke" -A <NUMERO_DE_LINHAS_A_RETORNAR>`. Ao usar `solana logs` na Devnet, você deve especificar o ID do programa. Caso contrário, o comando `solana logs` retornará um fluxo constante de logs da Devnet. Por exemplo, você faria o seguinte para monitorar as chamadas ao programa de Tokens e mostrar as primeiras 5 linhas de logs para cada chamada:

```bash
solana logs | grep "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke" -A 5
```

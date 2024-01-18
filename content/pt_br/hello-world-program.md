---
title: Hello World
objectives:
- Usar o sistema de módulos do Rust
- Definir uma função no Rust
- Explicar o tipo `Result`.
- Explicar o ponto de entrada para um programa Solana
- Criar e implantar um programa Solana básico
- Enviar uma transação para invocar nosso programa "Hello, world!
---

# RESUMO

- Os **programas** no Solana são um tipo específico de conta que armazena e executa a lógica de instruções
- Os programas Solana têm um único **ponto de entrada** para processar instruções
- Um programa processa uma instrução usando o **program_id**, a lista de **accounts** e os **instruction_data** incluídos na instrução

# Visão Geral

A capacidade do Solana de executar código executável arbitrário é parte do que o torna tão poderoso. Os programas Solana, semelhantes aos "contratos inteligentes" em outros ambientes de blockchain, são literalmente a espinha dorsal do ecossistema Solana. E a coleção de programas cresce diariamente à medida que os desenvolvedores e criadores sonham e implantam novos programas.

Esta lição lhe dará uma introdução básica sobre como escrever e implantar um programa Solana usando a linguagem de programação Rust. Para evitar a distração de configurar um ambiente de desenvolvimento local, usaremos um IDE (ambiente de desenvolvimento integrado) baseado em navegador chamado Solana Playground.

## Conceitos Básicos de Rust

Antes de nos aprofundarmos na construção do nosso programa "Hello, world!", vamos primeiro examinar alguns conceitos básicos do Rust. Se quiser se aprofundar no Rust, dê uma olhada em [livro de linguagem Rust](https://doc.rust-lang.org/book/ch00-00-introduction.html).

### Module System

O Rust organiza o código usando o que é coletivamente chamado de "module system" (sistema de módulo).

Isso inclui:

- **Modules** - Um módulo separa o código em unidades lógicas para fornecer namespaces isolados para organização, escopo e privacidade de caminhos.
- **Crates** - Um crate é uma biblioteca ou um programa executável. O código-fonte de um crate geralmente é subdividido em vários módulos.
- **Packages** - Um pacote contém uma coleção de crates, bem como um arquivo de manifesto para especificar metadados e dependências entre pacotes.

Ao longo desta lição, vamos nos concentrar no uso de crates e módulos.

### Caminhos e escopo

Os crates no Rust contêm módulos que definem a funcionalidade que pode ser compartilhada com vários projetos. Se quisermos acessar um item em um módulo, precisaremos saber o seu "caminho" (como quando estamos navegando em um sistema de arquivos).

Pense na estrutura do crate como uma árvore em que o crate é a base e os módulos são branches, cada uma das quais pode ter submódulos ou itens que são branches adicionais.

O caminho para um módulo ou item específico é o nome de cada etapa do crate para esse módulo, onde cada um é separado por `::`. Como exemplo, vamos dar uma olhada na estrutura a seguir:

1. O crate básico é `solana_program`
2. `solana_program` contém um módulo chamado `account_info`
3. `account_info` contém uma struct chamada `AccountInfo`

O caminho para `AccountInfo` deve ser `solana_program::account_info::AccountInfo`.

Na ausência de outras palavras-chave, precisaríamos fazer referência a todo esse caminho para usar `AccountInfo` em nosso código.

Entretanto, com a palavra-chave [`use`](https://doc.rust-lang.org/stable/book/ch07-04-bringing-paths-into-scope-with-the-use-keyword.html) podemos colocar um item no escopo para que ele possa ser reutilizado em um arquivo sem a necessidade de especificar o caminho completo todas as vezes. É comum ver uma série de comandos `use` na parte superior de um arquivo Rust.

```rust
use solana_program::account_info::AccountInfo
```

### Declarando Funções em Rust

Definimos uma função no Rust usando a palavra-chave `fn` seguida de um nome de função e um conjunto de parênteses.

```rust
fn process_instruction()
```

Em seguida, podemos adicionar argumentos à nossa função incluindo nomes de variáveis e especificando o tipo de dados correspondente entre parênteses.

O Rust é conhecido como uma linguagem "estaticamente tipada" e todo valor no Rust é de um determinado "tipo de dados". Isso significa que o Rust deve conhecer os tipos de todas as variáveis no momento da compilação. Nos casos em que vários tipos são possíveis, devemos adicionar uma anotação de tipo às nossas variáveis.

No exemplo abaixo, criamos uma função chamada `process_instruction` que requer os seguintes argumentos:

- `program_id` - deve ser do tipo `&Pubkey`
- `accounts` - deve ser do tipo `&[AccountInfo]`
- `instruction_data` - deve ser do tipo `&[u8]`

Observe o `&` na frente do tipo de cada argumento listado na função `process_instruction`. Em Rust, `&` representa uma "referência" a outra variável. Isso permite que você se refira a algum valor sem assumir a propriedade dele. É garantido que a "referência" aponte para um valor válido de um tipo específico. A ação de criar uma referência no Rust é chamada de "borrowing" (empréstimo).

Neste exemplo, quando a função `process_instruction` é chamada, o usuário deve passar valores para os argumentos exigidos. A função `process_instruction` então faz referência aos valores passados pelo usuário e garante que cada valor seja do tipo de dados correto especificado na função `process_instruction`.

Além disso, observe os colchetes `[]` em torno de `&[AccountInfo]` e `&[u8]`. Isso significa que os argumentos `accounts` e `instruction_data` esperam "slices" dos tipos `AccountInfo` e `u8`, respectivamente. Um "slice" é semelhante a um array (coleção de objetos do mesmo tipo), exceto pelo fato de que o comprimento não é conhecido no momento da compilação. Em outras palavras, os argumentos `accounts` e `instruction_data` esperam entradas de comprimento desconhecido.

```rust
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
)
```

Podemos então fazer com que nossas funções retornem valores declarando o tipo return usando uma seta `->` após a função.

No exemplo abaixo, a função `process_instruction` agora retornará um valor do tipo `ProgramResult`. Veremos isso na próxima seção.

```rust
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult
```

### enum Result

O `Result` é um tipo de biblioteca padrão que representa dois resultados discretos: sucesso (`Ok`) ou falha (`Err`). Falaremos mais sobre enums em uma lição futura, mas você verá o `Ok` ser usado mais adiante nesta lição, por isso é importante abordar os conceitos básicos.

Ao usar `Ok` ou `Err`, você deve incluir um valor, cujo tipo é determinado pelo contexto do código. Por exemplo, uma função que requer um valor de retorno do tipo `Result<String, i64>` está dizendo que a função pode retornar `Ok` com um valor de string incorporado ou `Err` com um inteiro incorporado. Neste exemplo, o número inteiro é um código de erro que pode ser usado para lidar adequadamente com o erro.

Para retornar um caso de sucesso com um valor do tipo string, você faria o seguinte:

```rust
Ok(String::from("Success!"));
```

Para retornar um erro com um número inteiro, você deve fazer o seguinte:

```rust
Err(404);
```

## Programas Solana

Lembre-se de que todos os dados armazenados na rede Solana estão contidos no que chamamos de contas. Cada conta tem seu próprio endereço exclusivo, que é usado para identificar e acessar os dados da conta. Os programas Solana são apenas um tipo específico de conta Solana que armazena e executa instruções.

### Crate do Programa Solana

Para escrever programas Solana com Rust, usamos a biblioteca crate  "Solana_program". O crate `solana_program` atua como uma biblioteca padrão para os programas Solana. Essa biblioteca padrão contém os módulos e macros que usaremos para desenvolver nossos programas Solana. Se você quiser se aprofundar na biblioteca crate `solana_program`, dê uma olhada [na documentação crate  `solana_program`](https://docs.rs/solana-program/latest/solana_program/index.html).

Para um programa básico, precisaremos incluir no escopo os seguintes itens do crate `solana_program`:

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

- `AccountInfo` - uma struct dentro do módulo `account_info` que nos permite acessar as informações da conta.
- `entrypoint` - uma macro que declara o ponto de entrada do programa.
- `ProgramResult` - um tipo dentro do módulo `entrypoint` que retorna um `Result` ou um `ProgramError`.
- `Pubkey` - uma struct dentro do módulo `pubkey` que nos permite acessar endereços como uma chave pública.
- `msg` - uma macro que nos permite gravar mensagens no log do programa.

### Ponto de Entrada do Programa Solana

Os programas Solana exigem um único ponto de entrada para processar as instruções do programa. O ponto de entrada é declarado com a macro `entrypoint!`.

O ponto de entrada de um programa Solana requer uma função `process_instruction` com os seguintes argumentos:

- `program_id` - o endereço da conta em que o programa está armazenado.
- `accounts` - a lista de contas necessárias para processar a instrução.
- `instruction_data` - os dados serializados e específicos da instrução.

```rust
entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult;
```

Lembre-se de que as contas de programas Solana armazenam apenas a lógica para processar instruções. Isso significa que as contas de programa são "somente leitura" e "sem estado". O "estado" (o conjunto de dados) que um programa requer para processar uma instrução é armazenado em contas de dados (separado da conta do programa).

Para processar uma instrução, as contas de dados que uma instrução requer devem ser explicitamente passadas para o programa por meio do argumento `accounts`. Quaisquer entradas adicionais devem ser passadas por meio do argumento `instruction_data`.

Após a execução do programa, ele deve retornar um valor do tipo `ProgramResult`. Esse tipo é um `Result` em que o valor incorporado de um caso de sucesso é `()` e o valor incorporado de um caso de falha é `ProgramError`. `()` é um valor vazio e `ProgramError` é um tipo de erro definido na caixa `solana_program`.

...e aí está - agora você sabe tudo o que precisa para os fundamentos da criação de um programa Solana usando Rust. Vamos praticar o que aprendemos até agora!

# Demonstração

Vamos criar um programa "Hello, World!" usando o Solana Playground. O Solana Playground é uma ferramenta que permite que você escreva e implante programas Solana a partir do navegador.

### 1. Configure

Abra o [Solana Playground](https://beta.solpg.io/). Em seguida, exclua tudo no arquivo padrão `lib.rs` e crie uma carteira do Playground.

![Gif da Criação de Carteira do Solana Playground](../assets/hello-world-create-wallet.gif)

### 2. Crate do Programa Solana

Primeiro, vamos colocar no escopo tudo o que precisaremos do crate `solana_program`.

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

Em seguida, vamos configurar o ponto de entrada do nosso programa usando a macro `entrypoint!` e criar a função `process_instruction`. A macro `msg!` nos permite imprimir "Hello, world!" no registro do programa quando ele é chamado.

### 3. Ponto de Entrada

```rust
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

Em suma, o programa "Hello, world!" terá a seguinte aparência:

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

### 4. Crie e Implante

Agora, vamos criar e implantar nosso programa usando o Solana Playground.

![Gif da Criação e Implantação do Solana Playground](../assets/hello-world-build-deploy.gif)

### 5. Invoque o Programa

Por fim, vamos invocar nosso programa no lado do cliente. O foco desta lição é criar nosso programa Solana, portanto, avançamos e fornecemos [o código do cliente para invocar nosso programa “Hello, world!”](https://github.com/Unboxed-Software/solana-hello-world-client) para que você possa baixar.

O código fornecido inclui uma função auxiliar `sayHello` que cria e envia nossa transação. Em seguida, chamamos `sayHello` na função principal e imprimimos um URL do Solana Explorer para exibir os detalhes da transação no navegador.

Abra o arquivo `index.ts` e você verá uma variável chamada `programId`. Vá em frente e atualize-a com o ID do programa "Hello, world!" que você acabou de implantar usando o Solana Playground.

```tsx
let programId = new web3.PublicKey("<YOUR_PROGRAM_ID>");
```

Você pode localizar o ID do programa no Solana Playground consultando a figura abaixo.

![Gif do ID do Programa Solana Playground](../assets/hello-world-program-id.gif)

Em seguida, instale os módulos do Node com `npm i`.

Agora, vá em frente e execute o comando `npm start`. Esse comando irá:
1. Gerar um novo par de chaves e criar um arquivo `.env`, caso ainda não exista.
2. Fazer airdrop do SOL devnet.
3. Invocar o programa "Hello, world!
4. Exibir o URL da transação para visualização no Solana Explorer.

Copie o URL da transação impresso no console para o seu navegador. Role a tela para baixo para ver "Hello, world!" em Program Instruction Logs.

![Captura de tela do Log do Programa Explorer da Solana](../assets/hello-world-program-log.png)

Parabéns, você acabou de criar e implantar com sucesso um programa Solana!

# Desafio

Agora é sua vez de criar algo de forma independente. Como estamos começando com programas muito simples, o seu será quase idêntico ao que acabamos de criar. É útil tentar chegar ao ponto em que você possa escrevê-lo do zero sem fazer referência a códigos anteriores, portanto, tente não copiar e colar aqui.

1. Escreva um novo programa que use a macro `msg!` para imprimir sua própria mensagem no registro do programa.
2. Compile e implemente seu programa como fizemos na demonstração.
3. Invoque o programa recém-implantado e use o Solana Explorer para verificar se a sua mensagem foi impressa no registro do programa.

Como sempre, seja criativo com esses desafios e leve-os além das instruções básicas, se quiser, e divirta-se!

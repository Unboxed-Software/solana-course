---
title: Criar um programa básico, Parte 1 - Manipulação de dados de instrução
objectives:
- Atribuir variáveis mutáveis e imutáveis no Rust
- Criar e usar structs e enums no Rust
- Usar instruções de correspondência do Rust
- Adicionar implementações aos tipos do Rust
- Desserializar dados de instruções em tipos de dados Rust
- Executar diferentes lógicas de programa para diferentes tipos de instruções
- Explicar a estrutura de um contrato inteligente no Solana
---

# RESUMO

- A maioria dos programas suporta **múltiplas instruções discretas** - ao escrever o programa, você decide quais são essas instruções e quais dados devem acompanhá-las.
- Os **enums** do Rust são frequentemente usados para representar instruções discretas do programa.
- Você pode usar o crate `borsh` e o atributo `derive` para fornecer a funcionalidade de desserialização e serialização do Borsh para structs do Rust.
- As expressões `match` do Rust ajudam a criar caminhos de código condicional com base na instrução fornecida.

# Visão Geral

Um dos elementos mais básicos de um programa Solana é a lógica de manipulação dos dados de instrução. A maioria dos programas suporta várias funções relacionadas e usa diferenças nos dados de instrução para determinar qual caminho de código deve ser executado. Por exemplo, dois formatos de dados diferentes nos dados de instrução passados para o programa podem representar instruções para a criação de um novo dado ou para a exclusão do mesmo dado.

Como os dados de instrução são fornecidos para o ponto de entrada do seu programa como um array de bytes, é comum criar um tipo de dados Rust para representar as instruções de uma forma que seja mais utilizável em todo o código. Esta lição explicará como configurar esse tipo, como desserializar os dados de instrução nesse formato e como executar o caminho de código adequado com base na instrução passada para o ponto de entrada do programa.

## Fundamentos de Rust

Antes de nos aprofundarmos nos detalhes de um programa Solana básico, vamos falar sobre os fundamentos do Rust que usaremos ao longo desta lição.

### Variáveis

A atribuição de variáveis no Rust ocorre com a palavra-chave `let`.

```rust
let age = 33;
```

Por padrão, as variáveis no Rust são imutáveis, o que significa que o valor de uma variável não pode ser alterado depois de ter sido definido. Para criar uma variável que gostaríamos de alterar em algum momento no futuro, usamos a palavra-chave `mut`. Definir uma variável com essa palavra-chave significa que o valor armazenado nela pode ser alterado.

```rust
// o compilador vai retornar um erro
let age = 33;
age = 34;

// isso é permitido
let mut mutable_age = 33;
mutable_age = 34;
```

O compilador do Rust garante que as variáveis imutáveis realmente não possam ser alteradas, de modo que você não tenha que controlar isso. Isso torna seu código mais fácil de analisar e simplifica a depuração.

### Structs

Uma struct, ou estrutura, é um tipo de dados personalizado que permite agrupar e nomear vários valores relacionados que formam um grupo significativo. Cada dado em uma struct pode ser de tipos diferentes e cada um tem um nome associado a ele. Essas partes de dados são chamadas de **campos**. Eles se comportam de forma semelhante às propriedades em outras linguagens.

```rust
struct User {
    active: bool,
    email: String,
    age: u64
}
```

Para usar uma struct depois de tê-la definido, criamos uma instância dessa struct especificando valores concretos para cada um dos campos.

```rust
let mut user1 = User {
    active: true,
    email: String::from("test@test.com"),
    age: 36
};
```

Para obter ou definir um valor específico de uma struct, usamos a notação de ponto.

```rust
user1.age = 37;
```

### Enumerações

As enumerações (ou Enums) são uma struct de dados que permite definir um tipo enumerando suas possíveis variantes. Um exemplo de enum pode ter a seguinte aparência:

```rust
enum LightStatus {
    On,
    Off
}
```

O enum `LightStatus` tem duas variantes possíveis nessa situação: `On` ou `Off`.

Você também pode incorporar valores em variantes de enum, de forma semelhante à adição de campos a uma struct.

```rust
enum LightStatus {
    On {
        color: String
    },
    Off
}

let light_status = LightStatus::On { color: String::from("red") };
```

Neste exemplo, configurar uma variável para a variante `On` de `LightStatus` requer também a configuração do valor de `color`.

### Declarações Match

As declarações Match são muito semelhantes às declarações `switch` em C/C++. A declaração `match` permite comparar um valor com uma série de padrões e, em seguida, executar o código com base no padrão que corresponde ao valor. Os padrões podem ser compostos de valores literais, nomes de variáveis, caracteres wildcard e outros. A instrução match deve incluir todos os cenários possíveis, caso contrário, o código não será compilado.

```rust
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter
}

fn value_in_cents(coin: Coin) -> u8 {
    match coin {
        Coin::Penny => 1,
        Coin::Nickel => 5,
        Coin::Dime => 10,
        Coin::Quarter => 25
    }
}
```

### Implementações

A palavra chave `impl` é usada em Rust para definir as implementações de um tipo. Funções e constantes podem ser definidas em uma implementação.

```rust
struct Example {
    number: i32
}

impl Example {
    fn boo() {
        println!("boo! Example::boo() was called!");
    }

    fn answer(&mut self) {
        self.number += 42;
    }

    fn get_number(&self) -> i32 {
        self.number
    }
}
```

A função `boo` aqui só pode ser chamada no próprio tipo, e não em uma instância do tipo, da seguinte forma:

```rust
Example::boo();
```

Enquanto isso, `answer` requer uma instância mutável de `Example` e pode ser chamado com a sintaxe de ponto:

```rust
let mut example = Example { number: 3 };
example.answer();
```

### Traits e atributos

Você não criará seus próprios traits ou atributos nesta etapa, portanto, não forneceremos uma explicação detalhada de nenhum deles. No entanto, você usará a macro de atributos `derive` e alguns traits fornecidos pelo crate `borsh`. Portanto, é importante que você tenha um alto nível de compreensão de cada um deles.

Os traits descrevem uma interface abstrata que os tipos podem implementar. Se um trait definir uma função `bark()` e um tipo adotar esse trait, o tipo deverá implementar a função `bark()`.

[Atributos](https://doc.rust-lang.org/rust-by-example/attribute.html) adicionam metadados a um tipo e podem ser usados para muitas finalidades diferentes.

Quando você adiciona o [atributo `derive`](https://doc.rust-lang.org/rust-by-example/trait/derive.html) a um tipo e fornece uma ou mais traits compatíveis, o código é gerado nos bastidores para implementar automaticamente os traits desse tipo. Forneceremos um exemplo concreto disso em breve.

## Representação de instruções como um tipo de dados Rust

Agora que já abordamos os conceitos básicos do Rust, vamos aplicá-los aos programas Solana.

Na maioria das vezes, os programas têm mais de uma função. Por exemplo, você pode ter um programa que atua como backend para um aplicativo de anotações. Suponha que esse programa aceite instruções para criar uma nova nota, atualizar uma nota existente e excluir uma nota existente.

Como as instruções têm tipos discretos, elas geralmente são ideais para um tipo de dados enum.

```rust
enum NoteInstruction {
    CreateNote {
        title: String,
        body: String,
        id: u64
    },
    UpdateNote {
        title: String,
        body: String,
        id: u64
    },
    DeleteNote {
        id: u64
    }
}
```

Observe que cada variante do enum `NoteInstruction` vem com dados incorporados que serão usados pelo programa para realizar as tarefas de criação, atualização e exclusão de uma nota, respectivamente.

## Desserialize dados de instrução

Os dados da instrução são passados para o programa como um array de bytes, portanto, você precisa de uma maneira de converter deterministicamente esse array em uma instância do tipo de enum de instrução.

Nos módulos anteriores, usamos o Borsh para serialização e desserialização no lado do cliente. Para usar o Borsh no lado do programa, usamos o crate `borsh`. Esse crate fornece traits para `BorshDeserialize` e `BorshSerialize` que você pode aplicar aos seus tipos usando o atributo `derive`.

Para simplificar a desserialização dos dados de instrução, você pode criar uma struct que represente os dados e usar o atributo `derive` para aplicar o trait `BorshDeserialize` à struct. Isso implementa os métodos definidos em `BorshDeserialize`, incluindo o método `try_from_slice` que usaremos para desserializar os dados de instrução.

Lembre-se de que a própria struct precisa corresponder à estrutura dos dados no array de bytes.

```rust
#[derive(BorshDeserialize)]
struct NoteInstructionPayload {
    id: u64,
    title: String,
    body: String
}
```

Depois que essa struct tiver sido criada, você poderá criar uma implementação para sua instrução enum para lidar com a lógica associada à desserialização dos dados de instrução. É comum ver isso ser feito dentro de uma função chamada `unpack` que aceita os dados da instrução como argumento e retorna a instância apropriada do enum com os dados desserializados.

É uma prática padrão estruturar seu programa para esperar que o primeiro byte (ou outro número fixo de bytes) seja um identificador da instrução que o programa deve executar. Pode ser um número inteiro ou um identificador de string. Para este exemplo, usaremos o primeiro byte e mapearemos os inteiros 0, 1 e 2 para as instruções create, update e delete, respectivamente.

```rust
impl NoteInstruction {
    // Desempacota o buffer de entrada para a instrução associada
    // O formato esperado para a entrada é um vetor serializado Borsh
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Considera o primeiro byte como a variante para
        // determinar qual instrução será executada
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // Usa a struct de carga útil temporária para desserializar
        let payload = NoteInstructionPayload::try_from_slice(rest).unwrap();
        // Faz a correspondência da variante para determinar qual struct de dados 
        //é esperada pela função e retorna o TestStruct ou um erro
        Ok(match variant {
            0 => Self::CreateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            1 => Self::UpdateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            2 => Self::DeleteNote {
                id: payload.id
            },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

Há muitas coisas neste exemplo, portanto, vamos dar um passo de cada vez:

1. Essa função começa usando a função `split_first` no parâmetro `input` para retornar uma tupla. O primeiro elemento, `variant`, é o primeiro byte da matriz de bytes e o segundo elemento, `rest`, é o restante da matriz de bytes.
2. Em seguida, a função utiliza o método `try_from_slice` em `NoteInstructionPayload` para desserializar o restante do array de bytes em uma instância de `NoteInstructionPayload` chamada `payload`
3. Por fim, a função usa uma declaração `match` em `variant` para criar e retornar a instância de enum apropriada usando informações de `payload`

Observe que há uma sintaxe Rust nessa função que ainda não explicamos. As funções `ok_or` e `unwrap` são usadas para tratamento de erros e serão discutidas em detalhes em outra lição.

## Lógica do programa

Com uma maneira de desserializar os dados de instrução em um tipo Rust personalizado, é possível usar o fluxo de controle apropriado para executar diferentes caminhos de código no programa com base na instrução que é passada para o ponto de entrada do programa.

```rust
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Chama unpack para desserializar instruction_data
    let instruction = NoteInstruction::unpack(instruction_data)?;
    // Faz a correspondência entre a struct de dados retornada e o que você espera
    match instruction {
        NoteInstruction::CreateNote { title, body, id } => {
            // Executa o código do programa para criar uma nota
        },
        NoteInstruction::UpdateNote { title, body, id } => {
            // Executa o código do programa para atualizar uma nota
        },
        NoteInstruction::DeleteNote { id } => {
            // Executa o código do programa para excluir uma nota
        }
    }
}
```

Para programas simples, em que há apenas uma ou duas instruções a serem executadas, pode não haver problema em escrever a lógica dentro da instrução match. Para programas com muitas instruções diferentes possíveis de serem comparadas, seu código será muito mais legível se a lógica de cada instrução for escrita em uma função separada e simplesmente chamada de dentro da instrução `match`.

## Estrutura de arquivo de programa

O programa da [lição Hello World](hello-world-program.md) era simples o suficiente para que pudesse ser contido em um único arquivo. Porém, à medida que a complexidade de um programa aumenta, é importante manter uma estrutura de projeto que permaneça legível e extensível. Isso envolve o encapsulamento do código em funções e estruturas de dados, como fizemos até agora. Mas também envolve o agrupamento de códigos relacionados em arquivos separados.

Por exemplo, uma boa parte do código em que trabalhamos até agora tem a ver com a definição e a desserialização de instruções. Esse código deve estar em seu próprio arquivo em vez de ser escrito no mesmo arquivo que o ponto de entrada. Ao fazer isso, teríamos dois arquivos, um com o ponto de entrada do programa e outro com o código de instrução:

- **lib.rs**
- **instruction.rs**

Quando começar a dividir o programa dessa forma, será necessário certificar-se de registrar todos os arquivos em um local central. Faremos isso em  `lib.rs`. **Você deve registrar todos os arquivos do seu programa desta forma.**

```rust
// Isto deve estar dentro de lib.rs
pub mod instruction;
```

Além disso, todas as declarações que você gostaria que estivessem disponíveis por meio de declarações `use` em outros arquivos precisarão ser precedidas da palavra-chave `pub`:

```rust
pub enum NoteInstruction { ... }
```

## Demonstração

Para a demonstração desta lição, criaremos a primeira metade do programa Movie Review com o qual trabalhamos no Módulo 1. Esse programa armazena avaliações de filmes enviadas pelos usuários.

Por enquanto, vamos nos concentrar na desserialização dos dados da instrução. A lição a seguir se concentrará na segunda parte desse programa.

### 1. Ponto de entrada

Usaremos o [Solana Playground](https://beta.solpg.io/) novamente para desenvolver esse programa. O Solana Playground salva o estado em seu navegador, portanto, é possível que tudo o que você fez na lição anterior ainda esteja lá. Se estiver, vamos limpar tudo do arquivo `lib.rs` atual.

Dentro de lib.rs, vamos trazer os seguintes crates e definir onde queremos que nosso ponto de entrada para o programa esteja, com a macro `entrypoint`.

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::AccountInfo,
};

// O ponto de entrada é uma chamada de função process_instruction
entrypoint!(process_instruction);

// Dentro de lib.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {

    Ok(())
}
```

### 2. Desserialize os dados de instrução

Antes de continuarmos com a lógica do processador, devemos definir nossas instruções compatíveis e implementar nossa função de desserialização.

Para possibilitar a leitura, vamos criar um novo arquivo chamado `instruction.rs`. Dentro desse novo arquivo, adicione as declarações `use` para `BorshDeserialize` e `ProgramError` e, em seguida, crie um enum `MovieInstruction` com uma variante `AddMovieReview`. Essa variante deve ter valores incorporados a `title`, `rating` e `description`.
```rust
use borsh::{BorshDeserialize};
use solana_program::{program_error::ProgramError};

pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    }
}
```

Em seguida, defina uma struct `MovieReviewPayload`. Ela atuará como um tipo intermediário para a desserialização, portanto, deverá usar a macro de atributo `derive` para fornecer uma implementação padrão para o trait `BorshDeserialize`.

```rust
#[derive(BorshDeserialize)]
struct MovieReviewPayload {
    title: String,
    rating: u8,
    description: String
}
```

Por fim, crie uma implementação para o enum `MovieInstruction` que defina e implemente uma função chamada `unpack` que recebe um array de bytes como argumento e retorna um tipo `Result`. Essa função deve:

1. Usar a função `split_first` para separar o primeiro byte do array do restante do array
2. Desserializar o restante do array em uma instância de `MovieReviewPayload`
3. Utilizar uma instrução `match` para retornar a variante `AddMovieReview` de `MovieInstruction` se o primeiro byte do array for 0, caso contrário, retornar um erro de programa.

```rust
impl MovieInstruction {
    // Desempacota o buffer de entrada para a instrução associada
    // O formato esperado para a entrada é um vetor serializado Borsh
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Divide o primeiro byte dos dados
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // `try_from_slice` é uma das implementações do BorshDeserialization 
        // Desserializa dados de bytes de instrução na struct payload
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        // Faz a correspondência com o primeiro byte e retorna a struct AddMovieReview
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

### 3. Lógica do programa

Com a desserialização da instrução concluída, podemos retornar ao arquivo `lib.rs` para lidar com parte da lógica do nosso programa.

Lembre-se de que, como adicionamos código a um arquivo diferente, precisamos registrá-lo no arquivo `lib.rs` usando `pub mod instruction;`. Em seguida, podemos adicionar uma declaração `use` para trazer o tipo `MovieInstruction` para o escopo.

```rust
pub mod instruction;
use instruction::{MovieInstruction};
```

Em seguida, vamos definir uma nova função `add_movie_review` que recebe como argumentos `program_id`, `accounts`, `title`, `rating` e `description`. Ela também deve retornar uma instância de `ProgramResult`. Dentro dessa função, vamos simplesmente registrar nossos valores por enquanto e revisitaremos o restante da implementação da função na próxima lição.

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

    // Dados de instrução de registro que foram passados
    msg!("Adding movie review...");
    msg!("Title: {}", title);
    msg!("Rating: {}", rating);
    msg!("Description: {}", description);

    Ok(())
}
```

Com isso feito, podemos chamar `add_movie_review` de `process_instruction` (a função que definimos como nosso ponto de entrada). Para passar todos os argumentos necessários para a função, primeiro precisamos chamar o `unpack` que criamos em `MovieInstruction` e, em seguida, usar uma declaração `match` para garantir que a instrução que recebemos seja a variante `AddMovieReview`.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Unpack chamado
    let instruction = MovieInstruction::unpack(instruction_data)?;
    // Comparar com a estrutura de dados retornada na variável `instruction`.
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            // Faz uma chamada para a função `add_move_review`.
            add_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

E, assim, seu programa deve ser funcional o suficiente para registrar os dados de instrução passados quando uma transação é enviada!

Crie e implante seu programa a partir do Solana Program, como na última lição. Se você não tiver alterado o ID do programa desde a última lição, ele será implantado automaticamente com o mesmo ID. Se quiser que ele tenha um endereço separado, você pode gerar um novo ID de programa a partir do playground antes da implantação.

Você pode testar seu programa enviando uma transação com os dados de instrução corretos. Para isso, sinta-se à vontade para usar [este script](https://github.com/Unboxed-Software/solana-movie-client) ou [o frontend](https://github.com/Unboxed-Software/solana-movie-frontend) que construímos na [lição Serialize Custom Instruction Data](serialize-instruction-data.md). Em ambos os casos, certifique-se de copiar e colar o ID do programa na área apropriada do código-fonte para ter certeza de que está testando o programa correto.

Se você precisar passar mais tempo com essa demonstração antes de continuar, faça isso! Você também pode dar uma olhada no [código de solução](https://beta.solpg.io/62aa9ba3b5e36a8f6716d45b) se você travar.

# Desafio

Para o desafio desta lição, tente replicar o programa Student Intro do Módulo 1. Lembre-se de que criamos um aplicativo de frontend que permite que os alunos se apresentem! O programa usa o nome de um usuário e uma mensagem curta como `instruction_data` e cria uma conta para armazenar os dados na cadeia.

Usando o que aprendeu nesta lição, desenvolva o programa Student Intro até o ponto em que possa imprimir o `nome` e a `mensagem` fornecidos pelo usuário nos registros do programa quando este for chamado.

Você pode testar seu programa criando o [frontend](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data) que nós criamos na [lição Serialize Custom Instruction Data](serialize-instruction-data.md) e, em seguida, verificar os registros do programa no Solana Explorer. Lembre-se de substituir o ID do programa no código de frontend pelo que você implantou.

Tente fazer isso de forma independente, se possível! Mas, se você tiver dúvidas, sinta-se à vontade para consultar [código de solução](https://beta.solpg.io/62b0ce53f6273245aca4f5b0).

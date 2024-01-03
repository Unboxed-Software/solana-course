---
title: Criando um Programa Básico, Parte 2 - Gerenciamento de Estado
objectives:
- Descrever o processo de criação de uma nova conta usando um Endereço Derivado de Programa (PDA)
- Usar sementes para derivar um PDA
- Usar o espaço necessário por uma conta para calcular a quantidade de aluguel (em lamports) que um usuário deve alocar
- Usar uma Invocação Cruzada de Programa (CPI) para inicializar uma conta com um PDA como o endereço da nova conta
- Explicar como atualizar os dados armazenados em uma nova conta
---

# Resumo

- O estado do programa é armazenado em outras contas, em vez de no próprio programa
- Um Endereço Derivado de Programa (PDA) é derivado de um ID de programa e uma lista opcional de sementes. Uma vez derivados, os PDAs são posteriormente usados como endereço para uma conta de armazenamento.
- Criar uma conta requer que calculemos o espaço necessário e o aluguel correspondente a ser alocado para a nova conta
- Criar uma nova conta requer uma Invocação Cruzada de Programa (CPI) para a instrução `create_account` no Programa do Sistema
- Atualizar o campo de dados em uma conta requer que serializemos (convertamos para array de bytes) os dados na conta

# Visão Geral

A Solana mantém velocidade, eficiência e extensibilidade, em parte, por tornar os programas sem estado. Em vez de ter estado armazenado no próprio programa, os programas usam o modelo de conta da Solana para ler o estado de e escrever o estado em contas PDA separadas.

Embora este seja um modelo extremamente flexível, é também um paradigma que pode ser difícil de trabalhar se for desconhecido. Mas não se preocupe! Começaremos de forma simples nesta lição e avançaremos para programas mais complexos no próximo módulo.

Nesta lição, aprenderemos os conceitos básicos de gerenciamento de estado para um programa Solana, incluindo representar o estado como um tipo Rust, criar contas usando Endereços Derivados de Programa e serializar dados de conta.

## Estado do programa

Todas as contas da Solana têm um campo `data` que armazena um array de bytes. Isso torna as contas tão flexíveis quanto arquivos em um computador. Você pode armazenar literalmente qualquer coisa em uma conta (desde que a conta tenha espaço de armazenamento para isso).

Assim como os arquivos em um sistema de arquivos tradicional seguem formatos de dados específicos, como PDF ou MP3, os dados armazenados em uma conta Solana precisam seguir algum tipo de padrão para que os dados possam ser recuperados e desserializados em algo utilizável.

### Representando o estado como um tipo Rust

Ao escrever um programa em Rust, normalmente criamos este "formato" definindo um tipo de dado Rust. Se você acompanhou a [primeira parte desta lição](basic-program-pt-1.md), isso é muito semelhante ao que fizemos quando criamos um enum para representar instruções discretas.

Embora este tipo deva refletir a estrutura dos seus dados, para a maioria dos casos de uso, uma struct simples é suficiente. Por exemplo, um programa de anotações que armazena notas em contas separadas provavelmente terá dados para um título, corpo e talvez um ID de algum tipo. Poderíamos criar uma struct para representar isso da seguinte forma:

```rust
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

### Usando Borsh para serialização e desserialização

Assim como com os dados de instrução, precisamos de um mecanismo para converter de nosso tipo de dados Rust para um array de bytes, e vice-versa. **Serialização** é o processo de converter um objeto em um array de bytes. **Desserialização** é o processo de reconstruir um objeto a partir de um array de bytes.

Continuaremos a usar Borsh para serialização e desserialização. Em Rust, podemos usar o crate `borsh` para acessar os traits `BorshSerialize` e `BorshDeserialize`. Podemos então aplicar esses traits usando a macro de atributo `derive`.

```rust
use borsh::{BorshSerialize, BorshDeserialize};

#[derive(BorshSerialize, BorshDeserialize)]
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

Esses traits fornecerão métodos em `NoteState` que podemos usar para serializar e desserializar os dados conforme necessário.

## Criando contas

Antes de podermos atualizar o campo de dados de uma conta, primeiro temos que criar essa conta.

Para criar uma nova conta dentro do nosso programa, devemos:

1. Calcular o espaço e o aluguel necessários para a conta
2. Ter um endereço para atribuir a nova conta
3. Invocar o programa do sistema para criar a nova conta

### Espaço e aluguel

Lembre-se de que armazenar dados na rede Solana exige que os usuários aloquem aluguel na forma de lamports. A quantidade de aluguel necessária por uma nova conta depende da quantidade de espaço que você gostaria de alocar para essa conta. Isso significa que precisamos saber antes de criar a conta quanto espaço alocar.

Note que o aluguel é mais como um depósito. Todos os lamports alocados para aluguel podem ser totalmente reembolsados quando uma conta é fechada. Além disso, todas as novas contas agora são obrigadas a ser [isentas de aluguel](https://twitter.com/jacobvcreech/status/1524790032938287105), o que significa que lamports não são deduzidos da conta ao longo do tempo. Uma conta é considerada isenta de aluguel se mantiver pelo menos 2 anos de aluguel. Em outras palavras, as contas são armazenadas permanentemente na cadeia até que o proprietário feche a conta e retire o aluguel.

Em nosso exemplo de aplicativo de anotações, a struct `NoteState` especifica três campos que precisam ser armazenados em uma conta: `title`, `body` e `id`. Para calcular o tamanho que a conta precisa ter, você simplesmente soma o tamanho necessário para armazenar os dados em cada campo.

Para dados dinâmicos, como strings, o Borsh adiciona 4 bytes adicionais no início para armazenar o comprimento daquele campo específico. Isso significa que `title` e `body` são cada um 4 bytes mais seus respectivos tamanhos. O campo `id` é um inteiro de 64 bits, ou 8 bytes.

Você pode somar esses comprimentos e então calcular o aluguel necessário para essa quantidade de espaço usando a função `minimum_balance` do módulo `rent` do crate `solana_program`.

```rust
// Calcular o tamanho da conta necessário para a struct NoteState
let account_len: usize = (4 + title.len()) + (4 + body.len()) + 8;

// Calcular o aluguel necessário
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

### Endereços Derivados de Programa (PDA)

Antes de criar uma conta, também precisamos ter um endereço para atribuir a conta. Para contas de propriedade de programa, este será um endereço derivado de programa (PDA) encontrado usando a função `find_program_address`. 

Como o nome indica, PDAs são derivados usando o ID do programa (endereço do programa que está criando a conta) e uma lista opcional de “sementes”. Sementes opcionais são entradas adicionais usadas na função `find_program_address` para derivar o PDA. A função usada para derivar PDAs retornará o mesmo endereço toda vez que receber as mesmas entradas. Isso nos dá a capacidade de criar qualquer número de contas PDA e uma maneira determinística de encontrar cada conta.

Além das sementes que você fornece para derivar um PDA, a função `find_program_address` fornecerá uma "semente de salto" (bump seed) adicional. O que torna os PDAs únicos em relação a outros endereços de conta Solana é que eles não têm uma chave secreta correspondente. Isso garante que apenas o programa que possui o endereço possa assinar em nome do PDA. Quando a função `find_program_address` tenta derivar um PDA usando as sementes fornecidas, ela passa o número 255 como a "semente de salto". Se o endereço resultante for inválido (ou seja, tiver uma chave secreta correspondente), a função diminui a semente de salto em 1 e deriva um novo PDA com essa semente de salto. Uma vez que um PDA válido é encontrado, a função retorna tanto o PDA quanto o salto que foi usado para derivar o PDA.

Para nosso programa de anotações, usaremos a chave pública do criador da nota e o ID como as sementes opcionais para derivar o PDA. Derivar o PDA desta forma nos permite encontrar deterministicamente a conta para cada nota.

```rust
let (note_pda_account, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);
```

### Invocação Cruzada de Programa (CPI)

Uma vez que calculamos o aluguel necessário para nossa conta e encontramos um PDA válido para atribuir como o endereço da nova conta, estamos finalmente prontos para criar a conta. Criar uma nova conta dentro do nosso programa requer uma Invocação Cruzada de Programa (CPI). Uma CPI acontece quando um programa invoca uma instrução em outro programa. Para criar uma nova conta dentro do nosso programa, invocaremos a instrução `create_account` no programa do sistema.

As CPIs podem ser feitas usando `invoke` ou `invoke_signed`.

```rust
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult
```

```rust
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

Para esta lição, usaremos `invoke_signed`. Diferente de uma assinatura regular onde uma chave secreta é usada para assinar, `invoke_signed` usa as sementes opcionais, a semente de salto e o ID do programa para derivar um PDA e assinar uma instrução. Isso é feito comparando o PDA derivado com todas as contas passadas para a instrução. Se alguma das contas corresponder ao PDA, então o campo de assinatura para essa conta é definido como verdadeiro.

Um programa pode assinar transações de forma segura dessa maneira porque `invoke_signed` gera o PDA usado para assinar com o ID do programa do programa que está invocando a instrução. Portanto, não é possível para um programa gerar um PDA correspondente para assinar uma conta com um PDA derivado usando outro ID de programa.

```rust
invoke_signed(
    // instrução
    &system_instruction::create_account(
        note_creator.key,
        note_pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
    ),
    // informações da conta
    &[note_creator.clone(), note_pda_account.clone(), system_program.clone()],
    // sementes do signatário
    &[&[note_creator.key.as_ref(), note_id.as_bytes().as_ref(), &[bump_seed]]],
)?;
```

## Serializando e desserializando dados de conta

Uma vez que criamos uma nova conta, precisamos acessar e atualizar o campo de dados da conta. Isso significa desserializar seu array de bytes em uma instância do tipo que criamos, atualizar os campos dessa instância e, em seguida, serializar essa instância de volta em um array de bytes.

### Desserializando os dados de conta

O primeiro passo para atualizar os dados de uma conta é desserializar seu array de bytes `data` em seu tipo Rust. Você pode fazer isso primeiro emprestando o campo de dados da conta. Isso permite que você acesse os dados sem tomar posse.

Você pode então usar a função `try_from_slice_unchecked` para desserializar o campo de dados da conta emprestada usando o formato do tipo que você criou para representar os dados. Isso lhe dá uma instância do seu tipo Rust para que você possa facilmente atualizar campos usando notação de ponto. Se fôssemos fazer isso com o exemplo do aplicativo de anotações que estamos usando, ficaria assim:

```rust
let mut account_data = try_from_slice_unchecked::<NoteState>(note_pda_account.data.borrow()).unwrap();

account_data.title = title;
account_data.body = rating;
account_data.id = id;
```

### Serializando dados de conta

Uma vez que a instância Rust representando os dados da conta tenha sido atualizada com os valores apropriados, você pode "salvar" os dados na conta.

Isso é feito com a função `serialize` na instância do tipo Rust que você criou. Você precisará passar uma referência mutável para os dados da conta. A sintaxe aqui é complicada, então não se preocupe se você não entender completamente. Empréstimos e referências são dois dos conceitos mais difíceis em Rust.

```rust
account_data.serialize(&mut &mut note_pda_account.data.borrow_mut()[..])?;
```

O exemplo acima converte o objeto `account_data` em um array de bytes e o define para a propriedade `data` em `note_pda_account`. Isso salva a variável `account_data` atualizada no campo de dados da nova conta. Agora, quando um usuário buscar a `note_pda_account` e desserializar os dados, os dados atualizados que serializamos na conta serão exibidos.

## Iteradores

Você pode ter notado nos exemplos anteriores que referenciamos `note_creator` e não mostramos de onde isso veio.

Para ter acesso a esta e outras contas, usamos um [Iterador](https://doc.rust-lang.org/std/iter/trait.Iterator.html). Um iterador é um trait do Rust usado para dar acesso sequencial a cada elemento em uma coleção de valores. Iteradores são usados em programas Solana para iterar com segurança sobre a lista de contas passadas para o ponto de entrada do programa através do argumento `accounts`.

### Iterador Rust

O padrão iterador permite que você execute alguma tarefa em uma sequência de itens. O método `iter()` cria um objeto iterador que referencia uma coleção. Um iterador é responsável pela lógica de iterar sobre cada item e determinar quando a sequência terminou. Em Rust, iteradores são preguiçosos, o que significa que não têm efeito até que você chame métodos que consomem o iterador para usá-lo. Depois de criar um iterador, você deve chamar a função `next()` nele para obter o próximo item.

```rust
let v1 = vec![1, 2, 3];

// criar o iterador sobre o vec
let v1_iter = v1.iter();

// usar o iterador para obter o primeiro item
let first_item = v1_iter.next();

// usar o iterador para obter o segundo item
let second_item = v1_iter.next();
```

### Iterador de contas Solana

Lembre-se de que o `AccountInfo` para todas as contas necessárias por uma instrução são passadas através de um único argumento `accounts`. Para analisar as contas e usá-las dentro da nossa instrução, precisaremos criar um iterador com uma referência mutável ao argumento `accounts`.

Neste ponto, em vez de usar o iterador diretamente, passamos para a função `next_account_info` do módulo `account_info` fornecido pelo crate `solana_program`.

Por exemplo, a instrução para criar uma nova anotação em um programa de anotações exigiria no mínimo as contas para o usuário que está criando a anotação, um PDA para armazenar a anotação e o `system_program` para inicializar uma nova conta. Todas as três contas seriam passadas para o ponto de entrada do programa através do argumento `accounts`. Um iterador de `accounts` é então usado para separar o `AccountInfo` associado a cada conta para processar a instrução.

Observe que `&mut` significa uma referência mutável ao argumento `accounts`. Você pode ler mais sobre [referências em Rust](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html) e [a palavra-chave `mut`](https://doc.rust-lang.org/std/keyword.mut.html).

```rust
// Obter iterador de conta
let account_info_iter = &mut accounts.iter();

// Obter contas
let note_creator = next_account_info(account_info_iter)?;
let note_pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

# Demonstração

Esta visão geral cobriu muitos conceitos novos. Vamos praticá-los juntos, continuando a trabalhar no programa de Avaliação de Filmes da última lição. Não se preocupe se você está apenas começando nesta lição sem ter feito a anterior - de qualquer forma, deve ser possível acompanhar. Usaremos o [Solana Playground](https://beta.solpg.io) para escrever, construir e implantar nosso código.

Como um lembrete, estamos construindo um programa Solana que permite aos usuários avaliar filmes. Na última lição, desserializamos os dados de instrução passados pelo usuário, mas ainda não armazenamos esses dados em uma conta. Agora, vamos atualizar nosso programa para criar novas contas para armazenar a avaliação de filmes do usuário.

### 1. Código inicial

Se você não completou a demonstração da última lição ou apenas quer ter certeza de que não perdeu nada, você pode consultar [o código inicial](https://beta.solpg.io/6295b25b0e6ab1eb92d947f7).

Nosso programa atualmente inclui o arquivo `instruction.rs` que usamos para desserializar os `instruction_data` passados para o ponto de entrada do programa. Também completamos o arquivo `lib.rs` até o ponto em que podemos imprimir nossos dados de instrução desserializados no log do programa usando a macro `msg!`.

### 2. Criando uma struct para representar dados de conta

Vamos começar criando um novo arquivo chamado `state.rs`.

Este arquivo vai:

1. Definir a struct que nosso programa usa para preencher o campo de dados de uma nova conta
2. Adicionar os traits `BorshSerialize` e `BorshDeserialize` a esta struct

Primeiro, vamos trazer para o escopo tudo o que precisaremos do crate `borsh`.

```rust
use borsh::{BorshSerialize, BorshDeserialize};
```

Em seguida, vamos criar nossa struct `MovieAccountState`. Esta struct definirá os parâmetros que cada nova conta de avaliação de filme armazenará em seu campo de dados. Nossa struct `MovieAccountState` exigirá os seguintes parâmetros:

- `is_initialized` - mostra se a conta foi ou não inicializada
- `rating` - avaliação do usuário sobre o filme
- `description` - descrição do usuário sobre o filme
- `title` - título do filme que o usuário está avaliando

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub is_initialized: bool,
    pub rating: u8,
    pub title: String,
    pub description: String  
}
```

### 3. Atualizando `lib.rs`

Em seguida, vamos atualizar nosso arquivo `lib.rs`. Primeiro, vamos trazer para o escopo tudo o que precisaremos para completar nosso programa de Avaliação de Filmes. Você pode ler mais sobre os detalhes de cada item que estamos usando do [crate `solana_program`](https://docs.rs/solana-program/latest/solana_program/).

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::{next_account_info, AccountInfo},
    system_instruction,
    program_error::ProgramError,
    sysvar::{rent::Rent, Sysvar},
    program::{invoke_signed},
    borsh::try_from_slice_unchecked,
};
use std::convert::TryInto;
pub mod instruction;
pub mod state;
use instruction::MovieInstruction;
use state::MovieAccountState;
use borsh::BorshSerialize;
```

### 4. Iterando através de `accounts`

Em seguida, vamos continuar construindo nossa função `add_movie_review`. Lembre-se de que um array de contas é passado para a função `add_movie_review` através de um único argumento `accounts`. Para processar nossa instrução, precisaremos iterar através de `accounts` e atribuir o `AccountInfo` de cada conta à sua própria variável.

```rust
// Obter iterador de conta
let account_info_iter = &mut accounts.iter();

// Obter contas
let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

### 5. Derivando o PDA

Em seguida, dentro da nossa função `add_movie_review`, vamos derivar independentemente o PDA que esperamos que o usuário tenha passado. Precisaremos fornecer a semente de salto para a derivação mais tarde, então, mesmo que `pda_account` deva referenciar a mesma conta, ainda precisamos chamar `find_program_address`.

Note que derivamos o PDA para cada nova conta usando a chave pública do inicializador e o título do filme como sementes opcionais. Configurar o PDA desta forma restringe cada usuário a apenas uma avaliação para qualquer título de filme. No entanto, ainda permite que o mesmo usuário avalie filmes com títulos diferentes e usuários diferentes avaliem filmes com o mesmo título.

```rust
// Derivar PDA e verificar que corresponde ao cliente
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
```

### 6. Calculando o espaço e o aluguel

Em seguida, vamos calcular o aluguel que nossa nova conta precisará. Lembre-se de que o aluguel é a quantidade de lamports que um usuário deve alocar para uma conta para armazenar dados na rede Solana. Para calcular o aluguel, primeiro devemos calcular a quantidade de espaço que nossa nova conta requer.

A struct `MovieAccountState` tem quatro campos. Alocaremos 1 byte cada para `rating` e `is_initialized`. Para ambos `title` e `description`, alocaremos espaço igual a 4 bytes mais o comprimento da string.

```rust
// Calcular o tamanho da conta necessário
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());

// Calcular o aluguel necessário
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

### 7. Criado uma nova conta

Uma vez que calculamos o aluguel e verificamos o PDA, estamos prontos para criar nossa nova conta. Para criar uma nova conta, devemos chamar a instrução `create_account` do programa do sistema. Fazemos isso com uma Invocação Cruzada de Programa (CPI) usando a função `invoke_signed`. Usamos `invoke_signed` porque estamos criando a conta usando um PDA e precisamos que o programa de Avaliação de Filmes “assine” a instrução.

```rust
// Criar a conta
invoke_signed(
    &system_instruction::create_account(
        initializer.key,
        pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
    ),
    &[initializer.clone(), pda_account.clone(), system_program.clone()],
    &[&[initializer.key.as_ref(), title.as_bytes().as_ref(), &[bump_seed]]],
)?;

msg!("PDA criado: {}", pda);
```

### 8. Atualizando dados da conta

Agora que criamos uma nova conta, estamos prontos para atualizar o campo de dados da nova conta usando o formato da struct `MovieAccountState` do nosso arquivo `state.rs`. Primeiro desserializamos os dados da conta de `pda_account` usando `try_from_slice_unchecked`, em seguida, definimos os valores de cada campo.

```rust
msg!("desempacotando conta de estado");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("dados da conta emprestada");

account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Por fim, serializamos os `account_data` atualizados no campo de dados da nossa `pda_account`.

```rust
msg!("serializando conta");
account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
msg!("conta de estado serializada");
```

### 9. Compilando e implantando

Estamos prontos para compilar e implantar nosso programa!

![Gif Compilar e Implantar Programa](../../assets/movie-review-pt2-build-deploy.gif)

Você pode testar seu programa enviando uma transação com os dados de instrução corretos. Para isso, fique à vontade para usar [este script](https://github.com/Unboxed-Software/solana-movie-client) ou [o frontend](https://github.com/Unboxed-Software/solana-movie-frontend) que construímos na lição [Desserializando Dados de Instrução Personalizados](deserialize-custom-data.md). Em ambos os casos, certifique-se de copiar e colar o ID do programa para o seu programa na área apropriada do código-fonte para garantir que você está testando o programa certo.

Se você usar o frontend, simplesmente substitua o `MOVIE_REVIEW_PROGRAM_ID` nos componentes `MovieList.tsx` e `Form.tsx` pelo endereço do programa que você implantou. Em seguida, execute o frontend, envie uma avaliação e atualize o navegador para ver a avaliação.

Se você precisar de mais tempo com este projeto para se sentir confortável com esses conceitos, dê uma olhada no [código da solução](https://beta.solpg.io/62b23597f6273245aca4f5b4) antes de continuar.

# Desafio

Agora é a sua vez de construir algo independentemente. Equipado com os conceitos introduzidos nesta lição, você agora sabe tudo o que precisará para recriar completamente o programa Student Intro do Módulo 1.

O programa Student Intro é um Programa Solana que permite que os alunos se apresentem. O programa recebe o nome de um usuário e uma mensagem curta como os `instruction_data` e cria uma conta para armazenar os dados na cadeia.

Usando o que você aprendeu nesta lição, desenvolva este programa. Além de receber um nome e uma mensagem curta como dados de instrução, o programa deve:

1. Criar uma conta separada para cada estudante
2. Armazenar `is_initialized` como um booleano, `name` como uma string e `msg` como uma string em cada conta

Você pode testar seu programa construindo o [frontend](https://github.com/Unboxed-Software/solana-student-intros-frontend) que criamos na lição [Paginando, Ordenando e Filtrando Dados do Programa](./paging-ordering-filtering-data.md). Lembre-se de substituir o ID do programa no código do frontend pelo que você implantou.

Tente fazer isso independentemente, se puder! Mas se você tiver dúvidas, fique à vontade para consultar o [código da solução](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).


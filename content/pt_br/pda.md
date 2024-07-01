---
title: PDAs
objectives:
- Explicar Endereços Derivados de Programas (PDAs)
- Explicar diversos casos de uso dos PDAs
- Descrever como os PDAs são derivados
- Usar derivações de PDAs para localizar e recuperar dados
---


# Resumo

- Um **Endereço Derivado de Programa** (PDA) é derivado de um **ID de programa** e uma lista opcional de **sementes**
- Os PDAs são possuídos e controlados pelo programa do qual são derivados
- A derivação de PDA fornece uma maneira determinística de encontrar dados com base nas sementes usadas para a derivação
- Sementes podem ser usadas para mapear os dados armazenados em uma conta PDA separada
- Um programa pode assinar instruções em nome dos PDAs derivados de seu ID

# Visão Geral

## O que é um Endereço Derivado de Programa?

Endereços Derivados de Programas (PDAs) são endereços de contas projetados para serem assinados por um programa ao invés de uma chave secreta. Como o nome sugere, PDAs são derivados usando um ID de programa. Opcionalmente, essas contas derivadas também podem ser encontradas usando o ID junto com um conjunto de "sementes". Mais sobre isso mais tarde, mas essas sementes desempenharão um papel importante em como usamos PDAs para armazenamento e recuperação de dados.

PDAs servem duas funções principais:

1. Fornecer uma maneira determinística de encontrar o endereço de uma conta de propriedade de um programa
2. Autorizar o programa do qual um PDA foi derivado a assinar em seu nome da mesma forma que um usuário pode assinar com sua chave secreta

Nesta lição, vamos nos concentrar em usar PDAs para encontrar e armazenar dados. Discutiremos a assinatura com um PDA mais detalhadamente em uma lição futura onde cobrimos Invocações de Programas Cruzados (CPIs).

## Encontrando PDAs

PDAs não são tecnicamente criados. Em vez disso, eles são *encontrados* ou *derivados* com base em um ID de programa e uma ou mais sementes de entrada.

Pares de chaves Solana podem ser encontrados no que é chamado de Curva Elíptica Ed25519 (Ed25519). Ed25519 é um esquema de assinatura determinístico que a Solana usa para gerar chaves públicas e secretas correspondentes. Juntos, chamamos esses pares de chaves.

Alternativamente, PDAs são endereços que estão *fora* da curva Ed25519. Isso significa que PDAs não são chaves públicas e não possuem chaves privadas. Esta propriedade dos PDAs é essencial para que os programas possam assinar em seu nome, mas abordaremos isso em uma lição futura.

Para encontrar um PDA dentro de um programa Solana, usaremos a função `find_program_address`. Esta função recebe uma lista opcional de "sementes" e um ID de programa como entradas, e então retorna o PDA e uma semente de salto.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[user.key.as_ref(), user_input.as_bytes().as_ref(), "SEED".as_bytes()], program_id)
```

### Sementes (Seeds)

"Sementes" são entradas opcionais usadas na função `find_program_address` para derivar um PDA. Por exemplo, sementes podem ser qualquer combinação de chaves públicas, entradas fornecidas por um usuário ou valores codificados rigidamente. Um PDA também pode ser derivado usando apenas o ID do programa e sem sementes adicionais. No entanto, usar sementes para encontrar nossos PDAs nos permite criar um número arbitrário de contas que nosso programa pode possuir.

Enquanto você, o desenvolvedor, determina as sementes para passar para a função `find_program_address`, a própria função fornece uma semente adicional chamada de "semente de salto" (bump seed). A função criptográfica para derivar um PDA resulta em uma chave que se encontra *na* curva Ed25519 cerca de 50% das vezes. Para garantir que o resultado *não esteja* na curva Ed25519 e, portanto, não tenha uma chave secreta, a função `find_program_address` adiciona uma semente numérica chamada semente de salto.

A função começa usando o valor `255` como a semente de salto, e então verifica se o resultado é um PDA válido. Se o resultado não for um PDA válido, a função diminui a semente de salto em 1 e tenta novamente (`255`, `254`, `253`, etc.). Uma vez que um PDA válido é encontrado, a função retorna tanto o PDA quanto o salto que foi usado para derivar o PDA.

### `find_program_address` internamente

Vamos dar uma olhada no código-fonte da função `find_program_address`.

```rust
 pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Self::try_find_program_address(seeds, program_id)
        .unwrap_or_else(|| panic!("Não foi possível encontrar uma semente de salto viável para o endereço do programa"))
}
```

Internamente, a função `find_program_address` passa as `seeds` de entrada e o `program_id` para a função `try_find_program_address`.

A função `try_find_program_address` então introduz a `bump_seed`. A `bump_seed` é uma variável `u8` com um valor variando entre 0 a 255. Iterando sobre um intervalo descendente começando de 255, uma `bump_seed` é anexada às sementes de entrada opcionais, que são então passadas para a função `create_program_address`. Se a saída da `create_program_address` não for um PDA válido, então a `bump_seed` é diminuída em 1 e o loop continua até que um PDA válido seja encontrado.

```rust
pub fn try_find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> Option<(Pubkey, u8)> {

    let mut bump_seed = [std::u8::MAX];
    for _ in 0..std::u8::MAX {
        {
            let mut seeds_with_bump = seeds.to_vec();
            seeds_with_bump.push(&bump_seed);
            match Self::create_program_address(&seeds_with_bump, program_id) {
                Ok(address) => return Some((address, bump_seed[0])),
                Err(PubkeyError::InvalidSeeds) => (),
                _ => break,
            }
        }
        bump_seed[0] -= 1;
    }
    None

}
```

A função `create_program_address` realiza um conjunto de operações de hash sobre as sementes e o `program_id`. Essas operações calculam uma chave e verificam se a chave calculada está na curva elíptica Ed25519 ou não. Se um PDA válido for encontrado (ou seja, um endereço que está *fora* da curva), então o PDA é retornado. Caso contrário, um erro é retornado.

```rust
pub fn create_program_address(
    seeds: &[&[u8]],
    program_id: &Pubkey,
) -> Result<Pubkey, PubkeyError> {

    let mut hasher = crate::hash::Hasher::default();
    for seed in seeds.iter() {
        hasher.hash(seed);
    }
    hasher.hashv(&[program_id.as_ref(), PDA_MARKER]);
    let hash = hasher.result();

    if bytes_are_curve_point(hash) {
        return Err(PubkeyError::InvalidSeeds);
    }

    Ok(Pubkey::new(hash.as_ref()))

}
```

Em resumo, a função `find_program_address` passa nossas sementes de entrada e `program_id` para a função `try_find_program_address`. A função `try_find_program_address` adiciona uma `bump_seed` (começando de 255) às nossas sementes de entrada e, em seguida, chama a função `create_program_address` até que um PDA válido seja encontrado. Uma vez encontrado, tanto o PDA quanto a `bump_seed` são retornados.

Observe que para as mesmas sementes de entrada, diferentes salto válidos gerarão diferentes PDAs válidos. A `bump_seed` retornada pela `find_program_address` será sempre o primeiro PDA válido encontrado. Como a função começa com um valor de `bump_seed` de 255 e itera para baixo até zero, a `bump_seed` que acaba sendo retornada será sempre o maior valor válido de 8 bits possível. Esta `bump_seed` é comumente referida como o "*salto canônico*". Para evitar confusão, recomenda-se usar apenas o salto canônico e *sempre validar todo PDA passado para o seu programa.*

Um ponto a enfatizar é que a função `find_program_address` retorna apenas um Endereço Derivado de Programa e a semente de salto usada para derivá-lo. A função `find_program_address` *não* inicializa uma nova conta, nem qualquer PDA retornado pela função está necessariamente associado a uma conta que armazena dados.

## Usando contas PDA para armazenar dados

Como os próprios programas são sem estado, o estado do programa é gerenciado por meio de contas externas. Dado que você pode usar sementes para mapeamento e que programas podem assinar em seu nome, usar contas PDA para armazenar dados relacionados ao programa é uma escolha de design extremamente comum. Embora os programas possam invocar o Programa do Sistema para criar contas não-PDA e usá-las para armazenar dados também, PDAs tendem a ser o caminho a seguir.

Se você precisa de uma revisão sobre como armazenar dados em PDAs, dê uma olhada na [lição Crie um Programa Básico, Parte 2 - Gerenciamento de Estado](./program-state-management.md).

## Mapeando dados armazenados em contas PDA

Armazenar dados em contas PDA é apenas metade da equação. Você também precisa de uma maneira de recuperar esses dados. Vamos falar sobre duas abordagens:

1. Criar uma conta "de mapeamento" de PDA, que armazena os endereços de várias contas onde os dados são armazenados
2. Usar estrategicamente sementes para localizar as contas PDA apropriadas e recuperar os dados necessários

### Mapeando dados usando contas "de mapeamento" de PDA

Uma abordagem para organizar o armazenamento de dados é armazenar clusters de dados relevantes em seus próprios PDAs e, em seguida, ter uma conta PDA separada que armazena um mapeamento de onde todos os dados estão.

Por exemplo, você pode ter um aplicativo de anotações cujo programa de suporte usa sementes aleatórias para gerar contas PDA e armazena uma anotação em cada conta. O programa também teria uma única conta global "de mapeamento" de PDA que armazena um mapeamento das chaves públicas dos usuários para a lista de PDAs onde suas anotações são armazenadas. Esta conta de mapeamento seria derivada usando uma semente estática, por exemplo, "GLOBAL_MAPPING".

Quando chega a hora de recuperar as anotações de um usuário, você poderia então olhar para a conta de mapeamento, ver a lista de endereços associados à chave pública de um usuário e, em seguida, recuperar a conta de cada um desses endereços.

Embora tal solução seja talvez mais acessível para desenvolvedores web tradicionais, ela vem com algumas desvantagens que são particulares ao desenvolvimento web3. Como o tamanho do mapeamento armazenado na conta de mapeamento crescerá ao longo do tempo, você precisará alocar mais espaço do que o necessário para a conta quando a criar pela primeira vez, ou precisará realocar espaço para ela sempre que uma nova anotação for criada. Além disso, você acabará alcançando o limite de tamanho da conta de 10 megabytes.

Você poderia mitigar esse problema até certo ponto criando uma conta de mapeamento separada para cada usuário. Por exemplo, em vez de ter uma única conta PDA de mapeamento para todo o programa, você construiria uma conta PDA de mapeamento por usuário. Cada uma dessas contas de mapeamento poderia ser derivada com a chave pública do usuário. Os endereços de cada anotação poderiam então ser armazenados dentro da conta de mapeamento correspondente do usuário.

Essa abordagem reduz o tamanho necessário para cada conta de mapeamento, mas ainda assim adiciona um requisito desnecessário ao processo: ter que ler as informações na conta de mapeamento *antes* de poder encontrar as contas com os dados relevantes da anotação.

Pode haver momentos em que usar essa abordagem faça sentido para o seu aplicativo, mas não recomendamos isso como sua estratégia de ação.

### Mapeando dados usando derivação PDA

Se você for estratégico sobre as sementes que usa para derivar PDAs, pode incorporar os mapeamentos necessários nas próprias sementes. Esta é a evolução natural do exemplo do aplicativo de anotações que acabamos de discutir. Se você começar a usar a chave pública do criador da anotação como uma semente para criar uma conta de mapeamento por usuário, então por que não usar tanto a chave pública do criador quanto alguma outra informação conhecida para derivar um PDA para a própria anotação?

Agora, sem falar sobre isso explicitamente, estivemos mapeando sementes para contas este curso inteiro. Pense no programa de Avaliação de Filmes que construímos em lições anteriores. Este programa usa a chave pública do criador da avaliação e o título do filme que eles estão avaliando para encontrar o endereço que *deve* ser usado para armazenar a avaliação. Essa abordagem permite que o programa crie um endereço único para cada nova avaliação e também facilita a localização de uma avaliação quando necessário. Quando você quer encontrar a avaliação de um usuário de "Homem-Aranha", você sabe que ela está armazenada na conta PDA cujo endereço pode ser derivado usando a chave pública do usuário e o texto "Homem-Aranha" como sementes.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[
        initializer.key.as_ref(),
        title.as_bytes().as_ref()
    ],
    program_id)
```

### Endereços de conta token associada

Outro exemplo prático desse tipo de mapeamento é como os endereços de conta de token associada (ATA) são determinados. Tokens são frequentemente mantidos em uma ATA cujo endereço foi derivado usando um endereço de carteira e o endereço de cunhagem de um token específico. O endereço para uma ATA é encontrado usando a função `get_associated_token_address`, que recebe um `wallet_address` e um `token_mint_address` como entradas.

```rust
let associated_token_address = get_associated_token_address(&wallet_address, &token_mint_address);
```

Internamente, o endereço de uma conta de token associada é um PDA encontrado usando o `wallet_address`, `token_program_id` e `token_mint_address` como sementes. Isso fornece uma maneira determinística de encontrar uma conta de token associada a qualquer endereço de carteira para uma cunhagem de token específica.

```rust
fn get_associated_token_address_and_bump_seed_internal(
    wallet_address: &Pubkey,
    token_mint_address: &Pubkey,
    program_id: &Pubkey,
    token_program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            &wallet_address.to_bytes(),
            &token_program_id.to_bytes(),
            &token_mint_address.to_bytes(),
        ],
        program_id,
    )
}
```

Os mapeamentos entre sementes e contas PDA que você usa dependerão muito do seu programa específico. Embora esta não seja uma lição sobre design ou arquitetura de sistemas, vale a pena mencionar algumas diretrizes:

- Use sementes que serão conhecidas no momento da derivação do PDA
- Seja cuidadoso sobre quais dados são agrupados juntos em uma única conta
- Seja cuidadoso sobre a estrutura de dados usada dentro de cada conta
- O mais simples geralmente é melhor

# Demonstração

Vamos praticar juntos com o programa de Avaliação de Filmes que trabalhamos em lições anteriores. Não se preocupe se você está apenas entrando nesta lição sem ter feito a lição anterior - de qualquer forma, deve ser possível acompanhar.

Como uma revisão, o programa de Avaliação de Filmes permite que os usuários criem avaliações de filmes. Essas avaliações são armazenadas em uma conta usando um PDA derivado com a chave pública do inicializador e o título do filme que está avaliando.

Anteriormente, terminamos de implementar a capacidade de atualizar uma avaliação de filme de maneira segura. Nesta demonstração, adicionaremos a capacidade dos usuários comentarem sobre uma avaliação de filme. Usaremos a construção deste recurso como uma oportunidade para trabalhar como estruturar o armazenamento de comentários usando contas PDA.

### 1. Código inicial

Para começar, você pode encontrar [o código inicial do programa de filmes](https://github.com/Unboxed-Software/solana-movie-program/tree/starter) na branch `starter`.

Se você tem acompanhado as demonstrações do programa de Avaliação de Filmes, notará que este é o programa que construímos até agora. Anteriormente, usamos o [Solana Playground](https://beta.solpg.io/) para escrever, construir e implantar nosso código. Nesta lição, construiremos e implantaremos o programa localmente.

Abra a pasta e execute `cargo-build-bpf` para construir o programa. O comando `cargo-build-bpf` fornecerá instruções para implantar o programa.

```sh
cargo-build-bpf
```

Implante o programa copiando a saída do `cargo-build-bpf` e executando o comando `solana program deploy`.

```sh
solana program deploy <CAMINHO>
```

Você pode testar o programa usando o [frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews) de avaliação de filmes e atualizando o ID do programa com o que você acabou de implantar. Certifique-se de usar a branch `solution-update-reviews`.

### 2. Planejando a estrutura da conta

Adicionar comentários significa que precisamos tomar algumas decisões sobre como armazenar os dados associados a cada comentário. Os critérios para uma boa estrutura aqui são:

- Uma estrutura não excessivamente complicada
- Os dados são facilmente recuperáveis
- Cada comentário tem algo para ligá-lo à avaliação com a qual está associado

Para fazer isso, criaremos dois novos tipos de conta:

- Conta de contador de comentários
- Conta de comentário

Haverá uma conta de contador de comentários por avaliação e uma conta de comentário por comentário. A conta de contador de comentários será vinculada a uma determinada avaliação usando o endereço da avaliação como uma semente para encontrar o PDA do contador de comentários. Também usará a string estática "comment" como uma semente.

A conta de comentário será vinculada a uma avaliação da mesma maneira. No entanto, não incluirá a string "comment" como uma semente e, em vez disso, usará o *número real de comentários* como uma semente. Dessa forma, o cliente pode facilmente recuperar comentários para uma determinada avaliação fazendo o seguinte:

1. Leia os dados na conta de contador de comentários para determinar o número de comentários em uma avaliação
2. Onde `n` é o número total de comentários na avaliação, repita `n` vezes. Cada iteração do loop derivará um PDA usando o endereço da avaliação e o número atual como sementes. O resultado é `n` número de PDAs, cada um dos quais é o endereço de uma conta que armazena um comentário
3. Busque as contas para cada um dos `n` PDAs e leia os dados armazenados em cada um

Isso garante que cada uma de nossas contas possa ser recuperada de forma determinística usando dados que já são conhecidos com antecedência.

Para implementar essas mudanças, precisaremos fazer o seguinte:

- Definir structs para representar as contas de contador de comentários e comentários de filmes
- Atualizar o `MovieAccountState` existente para conter um discriminador (mais sobre isso mais tarde)
- Adicionar uma variante de instrução para representar a instrução `add_comment`
- Atualizar a função de processamento da instrução `add_movie_review` existente para incluir a criação da conta de contador de comentários
- Criar uma nova função de processamento de instrução `add_comment`

### 3. Definindo `MovieCommentCounter` e `MovieComment` structs

Lembre-se de que o arquivo `state.rs` define as structs que nosso programa usa para preencher o campo de dados de uma nova conta.

Precisaremos definir duas novas structs para habilitar comentários.

1. `MovieCommentCounter` - para armazenar um contador para o número de comentários associados a uma avaliação
2. `MovieComment` - para armazenar dados associados a cada comentário

Para começar, vamos definir as structs que usaremos para nosso programa. Observe que estamos adicionando um campo `discriminator` a cada struct, incluindo o `MovieAccountState` existente. Como agora temos vários tipos de conta, precisamos de uma maneira de buscar apenas o tipo de conta de que precisamos do cliente. Este discriminador é uma string que pode ser usada para filtrar contas ao buscarmos nossas contas de programa.

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub discriminator: String,
    pub is_initialized: bool,
    pub reviewer: Pubkey,
    pub rating: u8,
    pub title: String,
    pub description: String,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieCommentCounter {
    pub discriminator: String,
    pub is_initialized: bool,
    pub counter: u64
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieComment {
    pub discriminator: String,
    pub is_initialized: bool,
    pub review: Pubkey,
    pub commenter: Pubkey,
    pub comment: String,
    pub count: u64
}

impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieCommentCounter {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieComment {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Como adicionamos um novo campo `discriminator` à nossa struct existente, o cálculo do tamanho da conta precisa mudar. Vamos usar isso como uma oportunidade para limpar um pouco o nosso código. Vamos adicionar uma implementação para cada uma das três structs acima que adiciona uma constante `DISCRIMINATOR` e uma constante `SIZE` ou função `get_account_size` para que possamos obter rapidamente o tamanho necessário ao inicializar uma conta.

```rust
impl MovieAccountState {
    pub const DISCRIMINATOR: &'static str = "review";

    pub fn get_account_size(title: String, description: String) -> usize {
        return (4 + MovieAccountState::DISCRIMINATOR.len())
            + 1
            + 1
            + (4 + title.len())
            + (4 + description.len());
    }
}

impl MovieCommentCounter {
    pub const DISCRIMINATOR: &'static str = "counter";
    pub const SIZE: usize = (4 + MovieCommentCounter::DISCRIMINATOR.len()) + 1 + 8;
}

impl MovieComment {
    pub const DISCRIMINATOR: &'static str = "comment";

    pub fn get_account_size(comment: String) -> usize {
        return (4 + MovieComment::DISCRIMINATOR.len()) + 1 + 32 + 32 + (4 + comment.len()) + 8;
    }
}
```

Agora, em todos os lugares que precisamos do discriminador ou do tamanho da conta, podemos usar essa implementação e não correr o risco de erros de digitação não intencionais.

### 4. Criando a instrução `AddComment`

Lembre-se de que o arquivo `instruction.rs` define as instruções que nosso programa aceitará e como desserializar os dados para cada uma. Precisamos adicionar uma nova variante de instrução para adicionar comentários. Vamos começar adicionando uma nova variante `AddComment` ao enum `MovieInstruction`.

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    AddComment {
        comment: String
    }
}
```

Em seguida, vamos criar uma struct `CommentPayload` para representar os dados da instrução associados a esta nova instrução. A maior parte dos dados que incluiremos na conta são chaves públicas associadas a contas passadas para o programa, então a única coisa que realmente precisamos aqui é um único campo para representar o texto do comentário.

```rust
#[derive(BorshDeserialize)]
struct CommentPayload {
    comment: String
}
```

Agora vamos atualizar como desempacotamos os dados da instrução. Observe que movemos a desserialização dos dados da instrução para cada caso correspondente usando a struct de carga útil associada para cada instrução.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description }
            },
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description
                }
            },
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment
                }
            }
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

Por último, vamos atualizar a função `process_instruction` em `processor.rs` para usar a nova variante de instrução que criamos.

Em `processor.rs`, traga para o escopo as novas structs de `state.rs`.

```rust
use crate::state::{MovieAccountState, MovieCommentCounter, MovieComment};
```

Em seguida, em `process_instruction`, vamos combinar nossos dados de instrução `AddComment` desserializados com a função `add_comment` que implementaremos em breve.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            update_movie_review(program_id, accounts, title, rating, description)
        },

        MovieInstruction::AddComment { comment } => {
            add_comment(program_id, accounts, comment)
        }
    }
}
```

### 5. Atualizando `add_movie_review` para criar conta de contador de comentários

Antes de implementarmos a função `add_comment`, precisamos atualizar a função `add_movie_review` para criar a conta de contador de comentários da avaliação.

Lembre-se de que esta conta manterá o controle do número total de comentários que existem para uma avaliação associada. Seu endereço será um PDA derivado usando o endereço da avaliação de filme e a palavra “comment” como sementes. Observe que a forma como armazenamos o contador é simplesmente uma escolha de design. Também poderíamos adicionar um campo “counter” à conta original da avaliação de filme.

Dentro da função `add_movie_review`, vamos adicionar um `pda_counter` para representar a nova conta de contador que estaremos inicializando junto com a conta de avaliação de filme. Isso significa que agora esperamos que quatro contas sejam passadas para a função `add_movie_review` através do argumento `accounts`.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

Em seguida, há uma verificação para garantir que `total_len` seja menor que 1000 bytes, mas `total_len` não é mais preciso desde que adicionamos o discriminador. Vamos substituir `total_len` por uma chamada para `MovieAccountState::get_account_size`:

```rust
let account_len: usize = 1000;

if MovieAccountState::get_account_size(title.clone(), description.clone()) > account_len {
    msg!("O comprimento dos dados é maior que 1.000 bytes");
    return Err(ReviewError::InvalidDataLength.into());
}
```

Observe que isso também precisa ser atualizado na função `update_movie_review` para que essa instrução funcione corretamente.

Uma vez que inicializamos a conta da avaliação, também precisaremos atualizar o `account_data` com os novos campos que especificamos na struct `MovieAccountState`.

```rust
account_data.discriminator = MovieAccountState::DISCRIMINATOR.to_string();
account_data.reviewer = *initializer.key;
account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Finalmente, vamos adicionar a lógica para inicializar a conta de contador na função `add_movie_review`. Isso significa:

1. Calcular o valor de isenção de aluguel para a conta de contador
2. Derivar o PDA do contador usando o endereço da avaliação e a string "comment" como sementes
3. Invocar o programa do sistema para criar a conta
4. Definir o valor inicial do contador
5. Serializar os dados da conta e retornar da função

Tudo isso deve ser adicionado ao final da função `add_movie_review` antes do `Ok(())`.

```rust
msg!("criar contador de comentários");
let rent = Rent::get()?;
let counter_rent_lamports = rent.minimum_balance(MovieCommentCounter::SIZE);

let (counter, counter_bump) =
    Pubkey::find_program_address(&[pda.as_ref(), "comment".as_ref()], program_id);
if counter != *pda_counter.key {
    msg!("Sementes inválidas para PDA");
    return Err(ProgramError::InvalidArgument);
}

invoke_signed(
    &system_instruction::create_account(
        initializer.key,
        pda_counter.key,
        counter_rent_lamports,
        MovieCommentCounter::SIZE.try_into().unwrap(),
        program_id,
    ),
    &[
        initializer.clone(),
        pda_counter.clone(),
        system_program.clone(),
    ],
    &[&[pda.as_ref(), "comment".as_ref(), &[counter_bump]]],
)?;
msg!("contador de comentários criado");

let mut counter_data =
    try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

msg!("verificando se a conta de contador já está inicializada");
if counter_data.is_initialized() {
    msg!("Conta já inicializada");
    return Err(ProgramError::AccountAlreadyInitialized);
}

counter_data.discriminator = MovieCommentCounter::DISCRIMINATOR.to_string();
counter_data.counter = 0;
counter_data.is_initialized = true;
msg!("comment count: {}", counter_data.counter);
counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;
```

Agora, quando uma nova avaliação é criada, duas contas são inicializadas:

1. A primeira é a conta da avaliação que armazena o conteúdo da avaliação. Isso não mudou em relação à versão do programa com a qual começamos.
2. A segunda conta armazena o contador para comentários

### 6. Implementando `add_comment`

Finalmente, vamos implementar nossa função `add_comment` para criar novas contas de comentário.

Quando um novo comentário é criado para uma avaliação, incrementaremos a contagem na conta PDA do contador de comentários e derivaremos o PDA para a conta de comentário usando o endereço da avaliação e a contagem atual.

Como em outras funções de processamento de instrução, começaremos iterando pelas contas passadas para o programa. Então, antes de fazermos qualquer outra coisa, precisamos desserializar a conta do contador para termos acesso à contagem atual de comentários:

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adicionando Comentário...");
    msg!("Comentário: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    Ok(())
}
```

Agora que temos acesso aos dados do contador, podemos continuar com as etapas restantes:

1. Calcular o valor de isenção de aluguel para a nova conta de comentário
2. Derivar o PDA para a conta de comentário usando o endereço da avaliação e a contagem atual de comentários como sementes
3. Invocar o Programa do Sistema para criar a nova conta de comentário
4. Definir os valores apropriados para a nova conta criada
5. Serializar os dados da conta e retornar da função

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adicionando Comentário...");
    msg!("Comentário: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    let account_len = MovieComment::get_account_size(comment.clone());

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    let (pda, bump_seed) = Pubkey::find_program_address(&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(),], program_id);
    if pda != *pda_comment.key {
        msg!("Sementes inválidas para PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    invoke_signed(
        &system_instruction::create_account(
        commenter.key,
        pda_comment.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[commenter.clone(), pda_comment.clone(), system_program.clone()],
        &[&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("Conta de comentários criada");

    let mut comment_data = try_from_slice_unchecked::<MovieComment>(&pda_comment.data.borrow()).unwrap();

    msg!("verificando se a conta de comentários já está inicializada");
    if comment_data.is_initialized() {
        msg!("Conta já inicializada");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    comment_data.discriminator = MovieComment::DISCRIMINATOR.to_string();
    comment_data.review = *pda_review.key;
    comment_data.commenter = *commenter.key;
    comment_data.comment = comment;
    comment_data.is_initialized = true;
    comment_data.serialize(&mut &mut pda_comment.data.borrow_mut()[..])?;

    msg!("Contagem de Comentários: {}", counter_data.counter);
    counter_data.counter += 1;
    counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;

    Ok(())
}
```

### 7. Compilando e implantando

Estamos prontos para compilar e implantar nosso programa!

Compile o programa atualizado executando `cargo-build-bpf`. Em seguida, implante o programa executando o comando `solana program deploy` impresso no console.

Você pode testar seu programa enviando uma transação com os dados de instrução corretos. Você pode criar seu próprio script ou se sentir à vontade para usar [este frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-comments). Certifique-se de usar a branch `solution-add-comments` e substituir o `MOVIE_REVIEW_PROGRAM_ID` em `utils/constants.ts` com o ID do seu programa ou o frontend não funcionará com seu programa.

Lembre-se de que fizemos alterações significativas nas contas de avaliação (ou seja, adicionando um discriminador). Se você usar o mesmo ID de programa que usou anteriormente ao implantar este programa, nenhuma das avaliações que você criou anteriormente aparecerá neste frontend devido a uma incompatibilidade de dados.

Se você precisar de mais tempo com este projeto para se sentir confortável com esses conceitos, dê uma olhada no [código da solução](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments) antes de continuar. Observe que o código da solução está na branch `solution-add-comments` do repositório vinculado.

# Desafio

Agora é a sua vez de construir algo de forma independente! Siga em frente e trabalhe com o programa Student Intro que usamos em lições passadas. O programa Student Intro é um programa Solana que permite que os alunos se apresentem. Este programa recebe o nome de um usuário e uma mensagem curta como `instruction_data` e cria uma conta para armazenar os dados onchain. Para este desafio, você deve:

1. Adicionar uma instrução permitindo que outros usuários respondam a uma introdução
2. Compilar e implantar o programa localmente

Se você não acompanhou as lições anteriores ou não salvou seu trabalho anterior, fique à vontade para usar o código inicial na branch `starter` deste [repositório](https://github.com/Unboxed-Software/solana-student-intro-program/tree/starter).

Tente fazer isso de forma independente, se puder! No entanto, se você tiver dúvidas, sinta-se à vontade para consultar o [código da solução](https://github.com/Unboxed-Software/solana-student-intro-program/tree/solution-add-replies). Observe que o código da solução está na branch `solution-add-replies` e que seu código pode parecer um pouco diferente.

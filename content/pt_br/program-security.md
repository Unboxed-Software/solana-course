---
title: Criando um Programa Básico, Parte 3 - Segurança Básica e Validação
objectives:
- Explique a importância de “pensar como um atacante"
- Compreender as práticas básicas de segurança
- Realizar verificações do proprietário
- Realizar verificações de signatários
- Validar contas passadas para o programa
- Realizar validação básica de dados
---

# Resumo

- **Pensar como um atacante** significa perguntar "Como faço para quebrar isso?"
- Realize **verificações de proprietário** para garantir que a conta fornecida seja de propriedade da chave pública esperada, por exemplo, garantindo que uma conta que você espera ser um PDA seja propriedade de `program_id`
- Realize **verificações de assinatura** para garantir que qualquer modificação de conta tenha sido assinada pela parte ou partes corretas
- A **validação de conta** envolve garantir que as contas fornecidas sejam as contas esperadas, por exemplo, derivando PDAs com as sementes esperadas para garantir que o endereço corresponda à conta fornecida
- A **validação de dados** implica garantir que os dados fornecidos atendam aos critérios exigidos pelo programa

# Visão Geral

Nas últimas duas lições, trabalhamos juntos na construção de um programa de Avaliação de Filmes. O resultado final é bem legal! É emocionante fazer algo funcionar em um novo ambiente de desenvolvimento.

No entanto, o desenvolvimento adequado de um programa não termina em "fazer funcionar". É importante pensar nos possíveis pontos de falha no seu código para mitigá-los. Pontos de falha são onde comportamentos indesejáveis no seu código podem potencialmente ocorrer. Seja por usuários interagindo com seu programa de maneiras inesperadas ou por atores maliciosos tentando explorar seu programa intencionalmente, antecipar pontos de falha é essencial para o desenvolvimento seguro de programas.

Lembre-se, **você não tem controle sobre as transações que serão enviadas ao seu programa uma vez que ele estiver implantado**. Você só pode controlar como seu programa lida com elas. Embora esta lição esteja longe de ser uma visão abrangente da segurança do programa, abordaremos algumas das armadilhas básicas a serem observadas.

## Pensando como um atacante

A [Neodyme](https://workshop.neodyme.io/) fez uma apresentação no Breakpoint 2021 intitulada "Pensar Como um Atacante: Levando os Contratos Inteligentes ao Seu Ponto de Ruptura (e Quebra)". Se há algo que você deve absorver desta lição, é que você deve pensar como um atacante.

Nesta lição, claro, não podemos cobrir tudo o que poderia dar errado com seus programas. Em última análise, cada programa terá diferentes riscos de segurança associados a ele. Enquanto compreender as armadilhas comuns seja *essencial* para a engenharia de bons programas, é *insuficiente* para implantar programas seguros. Para ter a cobertura de segurança mais ampla possível, você precisa abordar seu código com a mentalidade correta.

Como mencionado pela Neodyme em sua apresentação, a mentalidade correta exige passar da pergunta "Isso está quebrado?" para "Como eu quebro isso?" Este é o primeiro e mais essencial passo para entender o que seu código *realmente faz* em oposição ao que você o escreveu para fazer.

### Todos os programas podem ser quebrados

Não é uma questão de "se".

Em vez disso, é uma questão de "quanto esforço e dedicação seriam necessários".

Nosso trabalho como desenvolvedores é fechar o máximo de buracos possível e aumentar o esforço e a dedicação necessários para quebrar nosso código. Por exemplo, no programa de Avaliação de Filmes que construímos juntos nas últimas duas lições, escrevemos código para criar novas contas para armazenar avaliações de filmes. Se olharmos o código mais de perto, no entanto, notaremos como o programa também facilita muitos comportamentos não intencionais que poderíamos facilmente detectar perguntando "Como faço para quebrar isso?" Vamos investigar alguns desses problemas e como corrigi-los nesta lição, mas lembre-se de que memorizar algumas armadilhas não é suficiente. Cabe a você mudar sua mentalidade em relação à segurança.

## Manipulação de Erros

Antes de mergulharmos em algumas das armadilhas de segurança comuns e como evitá-las, é importante saber como usar erros em seu programa. Enquanto seu código pode lidar com alguns problemas de maneira elegante, outras questões exigirão que seu programa interrompa a execução e retorne um erro do programa.

### Como criar erros

Embora o crate `solana_program` forneça um enum `ProgramError` com uma lista de erros genéricos que podemos usar, muitas vezes será útil criar seus próprios erros. Seus erros personalizados serão capazes de fornecer mais contexto e detalhes enquanto você estiver depurando seu código.

Podemos definir nossos próprios erros criando um tipo enumerador listando os erros que queremos usar. Por exemplo, o `NoteError` contém as variantes `Forbidden` e `InvalidLength`. O enum é transformado em um tipo de erro Rust usando a macro de atributo `derive` para implementar o trait `Error` da biblioteca `thiserror`. Cada tipo de erro também tem sua própria notação `#[error("...")]`. Isso permite que você forneça uma mensagem de erro para cada tipo de erro em particular.

```rust
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Error)]
pub enum NoteError {
    #[error("Proprietário da anotação incorreto")]
    Forbidden,

    #[error("Texto muito longo")]
    InvalidLength,
}
```

### Como retornar erros

O compilador espera que os erros retornados pelo programa sejam do tipo `ProgramError` do crate `solana_program`. Isso significa que não poderemos retornar nosso erro personalizado, a menos que tenhamos uma maneira de convertê-lo para esse tipo. A implementação a seguir lida com a conversão entre nosso erro personalizado e o tipo `ProgramError`.

```rust
impl From<NoteError> for ProgramError {
    fn from(e: NoteError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Para retornar o erro personalizado do programa, basta usar o método `into()` para converter o erro em uma instância de `ProgramError`.

```rust
if pda != *note_pda.key {
    return Err(NoteError::Forbidden.into());
}
```

## Verificações Básicas de Segurança

Embora essas verificações não garantam a segurança completa do seu programa, existem algumas verificações de segurança que você pode manter em mente para preencher algumas das maiores lacunas no seu código:

- Verificações de propriedade - usadas para verificar se uma conta é de propriedade do programa
- Verificações de assinatura - usadas para verificar se uma conta assinou uma transação
- Validação Geral de Conta - usada para verificar se uma conta é a conta esperada
- Validação de Dados - usada para verificar as entradas fornecidas pelo usuário

### Verificações de Propriedade

Uma verificação de propriedade verifica se uma conta é de propriedade da chave pública esperada. Vamos usar o exemplo do aplicativo de anotações que mencionamos em lições anteriores. Neste aplicativo, os usuários podem criar, atualizar e deletar anotações que são armazenadas pelo programa em contas PDA.

Quando um usuário invoca a instrução `update`, ele também fornece uma `pda_account`. Presumimos que a `pda_account` fornecida é para a anotação específica que ele quer atualizar, mas o usuário pode inserir qualquer dado de instrução que desejar. Ele poderia até enviar dados que correspondam ao formato de dados de uma conta de anotação, mas que não foram criados pelo programa de anotações. Esta vulnerabilidade de segurança é uma maneira potencial de introduzir código malicioso.

A maneira mais simples de evitar este problema é sempre verificar se o proprietário de uma conta é a chave pública que você espera que seja. Neste caso, esperamos que a conta de anotação seja uma conta PDA de propriedade do próprio programa. Quando isso não acontece, podemos reportar adequadamente como um erro.

```rust
if note_pda.owner != program_id {
    return Err(ProgramError::InvalidNoteAccount);
}
```

Como uma observação à parte, usar PDAs sempre que possível é mais seguro do que confiar em contas de propriedade externa, mesmo que sejam de propriedade do signatário da transação. As únicas contas sobre as quais o programa tem controle total são as contas PDA, o que as torna mais seguras.

### Verificações de Signatário

Uma verificação de signatário simplesmente verifica se as partes certas assinaram uma transação. No aplicativo de anotações, por exemplo, gostaríamos de verificar se o criador da anotação assinou a transação antes de processar a instrução `update`. Caso contrário, qualquer pessoa poderia atualizar as anotações de outro usuário simplesmente passando a chave pública do usuário como o inicializador.

```rust
if !initializer.is_signer {
    msg!("Assinatura necessária ausente");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validação Geral de Conta

Além de verificar os signatários e proprietários das contas, é importante garantir que as contas fornecidas sejam o que seu código espera que sejam. Por exemplo, você gostaria de validar que o endereço de uma conta PDA fornecida possa ser derivado com as sementes esperadas. Isso garante que seja a conta que você espera que seja.

No exemplo do aplicativo de anotações, isso significaria garantir que você possa derivar um PDA correspondente usando a chave pública do criador da anotação e o ID como sementes (é o que estamos presumindo que foi usado ao criar a anotação). Dessa forma, um usuário não poderia acidentalmente passar uma conta PDA para a anotação errada ou, mais importante, que o usuário não esteja passando uma conta PDA que representa a anotação de outra pessoa inteiramente.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);

if pda != *note_pda.key {
    msg!("Sementes inválidas para PDA");
    return Err(ProgramError::InvalidArgument)
}
```

## Validação de Dados

Semelhante à validação de contas, você também deve validar quaisquer dados fornecidos pelo cliente.

Por exemplo, você pode ter um programa de jogo onde um usuário pode alocar pontos de atributos de personagens para várias categorias. Você pode ter um limite máximo de 100 em cada categoria. Nesse caso, verifique se a alocação existente de pontos mais a nova alocação não excede o máximo.

```rust
if character.agility + new_agility > 100 {
    msg!("Os pontos de atributos não podem exceder 100");
    return Err(AttributeError::TooHigh.into())
}
```

Ou o personagem pode ter um limite de pontos de atributos que ele pode alocar, e você quer ter certeza de que ele não exceda esse limite.

```rust
if attribute_allowance < new_agility {
    msg!("Tentando alocar mais pontos do que o permitido");
    return Err(AttributeError::ExceedsAllowance.into())
}
```

Sem essas verificações, o comportamento do programa seria diferente do esperado. Em alguns casos, no entanto, é mais do que apenas uma questão de comportamento indefinido. Às vezes, a falha em validar os dados pode resultar em lacunas de segurança financeiramente devastadoras.

Por exemplo, imagine que o personagem referenciado nestes exemplos seja um NFT. Além disso, imagine que o programa permita que o NFT seja colocado em stake para ganhar recompensas de token proporcionais ao número de pontos de atributos do NFT. A falha em implementar essas verificações de validação de dados permitiria a um ator malicioso atribuir um número obscenamente alto de pontos de atributos e rapidamente esgotar seu tesouro de todas as recompensas que deveriam ser distribuídas de maneira mais uniforme entre um grupo maior de participantes.

### Transbordamento e Subtransbordamento de Inteiros

Inteiros em Rust têm tamanhos fixos. Isso significa que eles só podem suportar uma faixa específica de números. Uma operação aritmética que resulta em um valor mais alto ou mais baixo do que o suportado pela faixa fará com que o valor resultante dê a volta. Por exemplo, um `u8` só suporta números de 0-255, então o resultado de uma adição que seria 256 seria na verdade 0, 257 seria 1, etc.

É sempre importante ter isso em mente, especialmente ao lidar com qualquer código que represente valor real, como depósito e retirada de tokens.

Para evitar o transbordamento (overflow) e o subtransbordamento (underflow) de inteiros:

1. Tenha uma lógica em vigor que garanta que o transbordamento e subtransbordamento *não possam* acontecer. Ou
2. Use matemática verificada como `checked_add` em vez de `+`
    ```rust
    let first_int: u8 = 5;
    let second_int: u8 = 255;
    let sum = first_int.checked_add(second_int);
    ```

# Demonstração

Vamos praticar juntos com o programa de Avaliação de Filmes em que trabalhamos nas lições anteriores. Não se preocupe se você está apenas começando nesta lição sem ter feito a lição anterior - deve ser possível acompanhar de qualquer maneira.

Como uma revisão, o programa de Avaliação de Filmes permite que os usuários armazenem avaliações de filmes em contas PDA. Na última lição, terminamos de implementar a funcionalidade básica de adicionar uma avaliação de filme. Agora, vamos adicionar algumas verificações de segurança à funcionalidade que já criamos e adicionar a capacidade de atualizar uma avaliação de filme de maneira segura.

Como antes, vamos usar o [Solana Playground](https://beta.solpg.io/) para escrever, compilar e implantar nosso código.

## 1. Código inicial

Para começar, você pode encontrar [o código inicial de avaliação de filmes](https://beta.solpg.io/62b552f3f6273245aca4f5c9). Se você acompanhou as demonstrações de Avaliação de Filmes, notará que refatoramos nosso programa.

O código inicial refatorado é quase o mesmo de antes. Como `lib.rs` estava ficando muito grande e difícil de trabalhar, separamos seu código em 3 arquivos: `lib.rs`, `entrypoint.rs` e `processor.rs`. `lib.rs` agora *apenas* registra os módulos do código, `entrypoint.rs` *apenas* define e estabelece o ponto de entrada do programa, e `processor.rs` lida com a lógica do programa para processar instruções. Também adicionamos um arquivo `error.rs` onde definiremos erros personalizados. A estrutura completa dos arquivos é a seguinte:

- **lib.rs** - registra módulos
- **entrypoint.rs** - ponto de entrada do programa
- **instruction.rs** - serializa e desserializa dados de instrução
- **processor.rs** - lógica do programa para processar instruções
- **state.rs** - serializa e desserializa estado
- **error.rs** - erros personalizados do programa

Além de algumas mudanças na estrutura de arquivos, atualizamos uma pequena quantidade de código que permitirá que esta demonstração seja mais focada em segurança sem fazer você escrever códigos repetitivos e desnecessários.

Como permitiremos atualizações nas avaliações de filmes, também alteramos `account_len` na função `add_movie_review` (agora em `processor.rs`). Em vez de calcular o tamanho da avaliação e definir o tamanho da conta apenas do tamanho necessário, vamos simplesmente alocar 1000 bytes para cada conta de avaliação. Dessa forma, não precisamos nos preocupar com realocação de tamanho ou recálculo de aluguel quando um usuário atualiza sua avaliação de filme.

Passamos disto:
```rust
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
```

Para isto:
```rust
let account_len: usize = 1000;
```

O método [realloc][https://docs.rs/solana-sdk/latest/solana_sdk/account_info/struct.AccountInfo.html#method.realloc] foi recentemente habilitado pelo Solana Labs, o que permite alterar dinamicamente o tamanho das suas contas. Não usaremos este método para esta demonstração, mas é algo a ser considerado.

Finalmente, também implementamos alguma funcionalidade adicional para nossa estrutura `MovieAccountState` em `state.rs` usando a palavra-chave `impl`.

Para nossas avaliações de filmes, queremos a capacidade de verificar se uma conta já foi inicializada. Para fazer isso, criamos uma função `is_initialized` que verifica o campo `is_initialized` na estrutura `MovieAccountState`.

`Sealed` é a versão da Solana do trait `Sized` do Rust. Isso simplesmente especifica que `MovieAccountState` tem um tamanho conhecido e fornece algumas otimizações de compilador.

```rust
// dentro de state.rs
impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Antes de prosseguir, certifique-se de ter uma compreensão sólida do estado atual do programa. Revise o código e passe um tempo pensando em quaisquer pontos que sejam confusos para você. Pode ser útil comparar o código inicial com o [código de solução da lição anterior](https://beta.solpg.io/62b23597f6273245aca4f5b4).

## 2. Erros Personalizados

Vamos começar escrevendo nossos erros personalizados do programa. Precisaremos de erros que possamos usar nas seguintes situações:

- A instrução de atualização foi invocada em uma conta que ainda não foi inicializada
- O PDA fornecido não corresponde ao PDA esperado ou derivado
- Os dados de entrada são maiores do que o programa permite
- A avaliação fornecida não está na faixa de 1-5

O código inicial inclui um arquivo `error.rs` vazio. Abra esse arquivo e adicione erros para cada um dos casos acima.

```rust
// dentro de error.rs
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReviewError{
    // Erro 0
    #[error("Conta não inicializada ainda")]
    UninitializedAccount,
    // Erro 1
    #[error("PDA derivado não é igual ao PDA passado")]
    InvalidPDA,
    // Erro 2
    #[error("Dados de entrada excedem o comprimento máximo")]
    InvalidDataLength,
    // Erro 3
    #[error("Avaliação maior que 5 ou menor que 1")]
    InvalidRating,
}

impl From<ReviewError> for ProgramError {
    fn from(e: ReviewError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Observe que, além de adicionar os casos de erro, também adicionamos a implementação que nos permite converter nosso erro em um tipo `ProgramError` conforme necessário.

Antes de prosseguir, vamos trazer `ReviewError` para o escopo em `processor.rs`. Vamos usar esses erros em breve quando adicionarmos nossas verificações de segurança.

```rust
// dentro de processor.rs
use crate::error::ReviewError;
```

## 3. Adicione verificações de segurança à `add_movie_review`

Agora que temos erros para usar, vamos implementar algumas verificações de segurança em nossa função `add_movie_review`.

### Verificação de Signatário

A primeira coisa que devemos fazer é garantir que o `initializer` de uma avaliação também seja um signatário da transação. Isso garante que você não possa enviar avaliações de filmes se passando por outra pessoa. Colocaremos essa verificação logo após iterar pelas contas.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;

if !initializer.is_signer {
    msg!("Assinatura necessária ausente");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validação de Conta

Em seguida, vamos garantir que a `pda_account` passada pelo usuário seja o `pda` que esperamos. Lembre-se de que derivamos o `pda` para uma avaliação de filme usando o `initializer` e o `title` como sementes. Dentro da nossa instrução, derivaremos o `pda` novamente e, em seguida, verificaremos se ele corresponde à `pda_account`. Se os endereços não coincidirem, retornaremos nosso erro personalizado `InvalidPDA`.

```rust
// Derive o PDA e verifique se ele corresponde ao cliente
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Sementes inválidas para PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Validação de Dados

Agora vamos realizar alguma validação de dados.

Começaremos garantindo que a `rating` esteja na escala de 1 a 5. Se a avaliação fornecida pelo usuário estiver fora desta faixa, retornaremos nosso erro personalizado `InvalidRating`.

```rust
if rating > 5 || rating < 1 {
    msg!("Avaliação não pode ser maior que 5");
    return Err(ReviewError::InvalidRating.into())
}
```

Em seguida, vamos verificar se o conteúdo da avaliação não excede os 1000 bytes que alocamos para a conta. Se o tamanho exceder 1000 bytes, retornaremos nosso erro personalizado `InvalidDataLength`.

```rust
let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Comprimento dos dados é maior que 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

Por último, vamos verificar se a conta já foi inicializada chamando a função `is_initialized` que implementamos para o nosso `MovieAccountState`. Se a conta já existir, retornaremos um erro.

```rust
if account_data.is_initialized() {
    msg!("Conta já inicializada");
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

Com tudo junto, a função `add_movie_review` deve ficar mais ou menos assim:

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Adicionando avaliação de filme...");
    msg!("Título: {}", title);
    msg!("Avaliação: {}", rating);
    msg!("Descrição: {}", description);

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        msg!("Assinatura necessária ausente");
        return Err(ProgramError::MissingRequiredSignature)
    }

    let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Sementes inválidas para PDA");
        return Err(ProgramError::InvalidArgument)
    }

    if rating > 5 || rating < 1 {
        msg!("Avaliação não pode ser maior que 5");
        return Err(ReviewError::InvalidRating.into())
    }

    let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
    if total_len > 1000 {
        msg!("Comprimento dos dados é maior que 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    let account_len: usize = 1000;

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

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

    msg!("desempacotando conta de estado");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("dados da conta emprestados");

    msg!("verificando se a conta do filme já foi inicializada");
    if account_data.is_initialized() {
        msg!("Conta já inicializada");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    account_data.title = title;
    account_data.rating = rating;
    account_data.description = description;
    account_data.is_initialized = true;

    msg!("serializando conta");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("conta de estado serializada");

    Ok(())
}
```

## 4. Dando suporte a atualizações de avaliações de filmes em `MovieInstruction`

Agora que `add_movie_review` está mais seguro, vamos voltar nossa atenção para dar suporte à capacidade de atualizar uma avaliação de filme.

Vamos começar atualizando `instruction.rs`. Começaremos adicionando uma variante `UpdateMovieReview` a `MovieInstruction` que inclui dados incorporados para o novo título, avaliação e descrição.

```rust
// dentro de instruction.rs
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
    }
}
```

A struct de carga útil pode permanecer a mesma, pois, além do tipo de variante, os dados da instrução são os mesmos que usamos para `AddMovieReview`.

Por fim, na função `unpack`, precisamos adicionar `UpdateMovieReview` à declaração de correspondência.

```rust
// dentro de instruction.rs
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            1 => Self::UpdateMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

## 5. Definindo a função `update_movie_review`

Agora que podemos desempacotar nosso `instruction_data` e determinar qual instrução do programa executar, podemos adicionar `UpdateMovieReview` à declaração de correspondência na função `process_instruction` no arquivo `processor.rs`.

```rust
// dentro de processor.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // desempacotar dados da instrução
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        // adicionar UpdateMovieReview para corresponder à nossa nova estrutura de dados
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            // fazer chamada para função de atualização que definiremos a seguir
            update_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

Em seguida, podemos definir a nova função `update_movie_review`. A definição deve ter os mesmos parâmetros que a definição de `add_movie_review`.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

}
```

## 6. Implementando a função `update_movie_review`

Tudo o que resta agora é preencher a lógica para atualizar uma avaliação de filme. Mas vamos torná-la segura desde o início.

Assim como a função `add_movie_review`, vamos começar iterando pelas contas. As únicas contas de que precisaremos são as duas primeiras: `initializer` e `pda_account`.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Atualizando avaliação de filme...");

    // Obter iterador de conta
    let account_info_iter = &mut accounts.iter();

    // Obter contas
    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

}
```

### Verificação de Propriedade

Antes de continuarmos, vamos implementar algumas verificações básicas de segurança. Começaremos com uma verificação de propriedade em `pda_account` para verificar se ela é de propriedade do nosso programa. Se não for, retornaremos um erro `InvalidOwner`.

```rust
if pda_account.owner != program_id {
    return Err(ProgramError::InvalidOwner)
}
```

### Verificação de Signatário

Em seguida, vamos realizar uma verificação de signatário para verificar se o `initializer` da instrução de atualização também assinou a transação. Como estamos atualizando os dados de uma avaliação de filme, queremos garantir que o `initializer` original da avaliação aprovou as mudanças assinando a transação. Se o `initializer` não assinou a transação, retornaremos um erro.

```rust
if !initializer.is_signer {
    msg!("Assinatura necessária ausente");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validação de Conta

A seguir, vamos verificar se a `pda_account` passada pelo usuário é o PDA que esperamos, derivando o PDA usando `initializer` e `title` como sementes. Se os endereços não coincidirem, retornaremos nosso erro personalizado `InvalidPDA`. Implementaremos isso da mesma maneira que fizemos na função `add_movie_review`.

```rust
// Derivar PDA e verificar se corresponde ao cliente
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Sementes inválidas para PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Desempacotando `pda_account` e realizando validação de dados

Agora que nosso código garante que podemos confiar nas contas passadas, vamos desempacotar a `pda_account` e atribuí-la a uma variável mutável `account_data`.

```rust
msg!("desempacotando conta de estado");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("dados da conta emprestados");
```

Agora que temos acesso à conta e seus campos, a primeira coisa que precisamos fazer é verificar se a conta já foi inicializada. Uma conta não inicializada não pode ser atualizada, então o programa deve retornar nosso erro personalizado `UninitializedAccount`.

```rust
if !account_data.is_initialized() {
    msg!("A conta não foi inicializada");
    return Err(ReviewError::UninitializedAccount.into());
}
```

Em seguida, precisamos validar os dados de `rating`, `title` e `description` da mesma forma que na função `add_movie_review`. Queremos limitar a `rating` a uma escala de 1 a 5 e limitar o tamanho total da avaliação para menos de 1000 bytes. Se a avaliação fornecida pelo usuário estiver fora dessa faixa, então retornaremos nosso erro personalizado `InvalidRating`. Se a avaliação for muito longa, então retornaremos nosso erro personalizado `InvalidDataLength`.

```rust
if rating > 5 || rating < 1 {
    msg!("Avaliação não pode ser maior que 5");
    return Err(ReviewError::InvalidRating.into())
}

let total_len: usize = 1 + 1 + (4 + account_data.title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Comprimento dos dados é maior que 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

### Atualizando a conta da avaliação de filme

Agora que implementamos todas as verificações de segurança, podemos finalmente atualizar a conta da avaliação de filme atualizando `account_data` e serializando-a novamente. Nesse ponto, podemos retornar `Ok` do nosso programa.

```rust
account_data.rating = rating;
account_data.description = description;

account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

Ok(())
```

Com tudo junto, a função `update_movie_review` deve se parecer com o trecho de código abaixo. Incluímos alguns registros adicionais para clareza na depuração.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Atualizando avaliação do filme...");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

    if pda_account.owner != program_id {
      return Err(ProgramError::IllegalOwner)
    }

    if !initializer.is_signer {
        msg!("Assinatura necessária ausente");
        return Err(ProgramError::MissingRequiredSignature)
    }

    msg!("desempacotando conta de estado");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("título da avaliação: {}", account_data.title);

    let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Sementes inválidas para PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    msg!("verificando se a conta do filme está inicializada");
    if !account_data.is_initialized() {
        msg!("Conta não está inicializada");
        return Err(ReviewError::UninitializedAccount.into());
    }

    if rating > 5 || rating < 1 {
        msg!("Avaliação Inválida");
        return Err(ReviewError::InvalidRating.into())
    }

    let update_len: usize = 1 + 1 + (4 + description.len()) + account_data.title.len();
    if update_len > 1000 {
        msg!("Comprimento dos dados é maior que 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    msg!("Avaliação antes da atualização:");
    msg!("Título: {}", account_data.title);
    msg!("Avaliação: {}", account_data.rating);
    msg!("Descrição: {}", account_data.description);

    account_data.rating = rating;
    account_data.description = description;

    msg!("Avaliação após atualização:");
    msg!("Título: {}", account_data.title);
    msg!("Avaliação: {}", account_data.rating);
    msg!("Descrição: {}", account_data.description);

    msg!("serializando conta");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("conta de estado serializada");

    Ok(())
}
```

## 7. Compilando e atualizando

Estamos prontos para compilar e atualizar nosso programa! Você pode testar seu programa enviando uma transação com os dados de instrução corretos. Para isso, fique à vontade para usar este [frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews). Lembre-se de que, para garantir que você está testando o programa certo, precisará substituir `MOVIE_REVIEW_PROGRAM_ID` pelo seu ID de programa em `Form.tsx` e `MovieCoordinator.ts`.

Se você precisar de mais tempo com este projeto para se sentir confortável com esses conceitos, dê uma olhada no [código da solução](https://beta.solpg.io/62c8c6dbf6273245aca4f5e7) antes de continuar.

# Desafio

Agora é a sua vez de construir algo de forma independente, baseando-se no programa Student Intro que você usou em lições anteriores. Se você não acompanhou ou não salvou seu código de antes, fique à vontade para usar [este código inicial](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).

O programa Student Intro é um programa Solana que permite que os alunos se apresentem. O programa recebe o nome de um usuário e uma mensagem curta como `instruction_data` e cria uma conta para armazenar os dados na cadeia.

Aplique o que você aprendeu nesta lição ao Programa Student Intro. O programa deve:

1. Adicionar uma instrução permitindo que os alunos atualizem sua mensagem
2. Implementar as verificações básicas de segurança que aprendemos nesta lição

Tente fazer isso de forma independente se puder! Mas, se você tiver dúvidas, fique à vontade para consultar o [código da solução](https://beta.solpg.io/62c9120df6273245aca4f5e8). Note que seu código pode parecer um pouco diferente do código da solução, dependendo das verificações que você implementar e dos erros que escrever. Uma vez que você concluir o Módulo 3, gostaríamos de saber mais sobre sua experiência! Sinta-se à vontade para [compartilhar um feedback rápido](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%203), para que possamos continuar aprimorando o curso.

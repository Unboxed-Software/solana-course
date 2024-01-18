---
tilte: Invocações entre Programas
objectives:
- Explicar as invocações entre Programas (CPIs)
- Descrever como construir e usar CPIs
- Explicar como um programa fornece uma assinatura para um PDA
- Evitar armadilhas comuns e solucionar erros comuns associados a CPIs
---

# RESUMO

- Uma **Invocação entre Programas (CPI)** é uma chamada de um programa para outro, direcionada a uma instrução específica no programa chamado
- As CPIs são feitas usando os comandos `invoke` ou `invoke_signed`, sendo que o último é a forma como os programas fornecem assinaturas para os PDAs que possuem.
- As CPIs tornam os programas do ecossistema Solana completamente interoperáveis, pois todas as instruções públicas de um programa podem ser invocadas por outro programa por meio de uma CPI.
- Como não temos controle sobre as contas e os dados enviados a um programa, é importante verificar todos os parâmetros passados para uma CPI para garantir a segurança do programa.

# Visão Geral

## O que é uma CPI?

Uma CPI (Cross-Program Invocation, invocação entre programas) é uma chamada direta de um programa para outro. Assim como qualquer cliente pode chamar qualquer programa usando o RPC JSON, qualquer programa pode chamar qualquer outro programa diretamente. O único requisito para invocar uma instrução em outro programa de dentro do seu programa é que você construa a instrução corretamente. Você pode criar CPIs para programas nativos, outros programas criados por você e programas de terceiros. Os CPIs basicamente transformam todo o ecossistema Solana em uma API gigante que está à sua disposição como desenvolvedor.

As CPIs têm uma composição semelhante às instruções que você está acostumado a criar no lado do cliente. Há algumas complexidades e diferenças, dependendo se você estiver usando `invoke` ou `invoke_signed`. Abordaremos essas duas opções mais adiante nesta lição.

## Como criar uma CPI

As CPIs são feitas usando a função [`invoke`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke.html) ou [`invoke_signed`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke_signed.html) do crate `solana_program`. Você usa o `invoke` para basicamente passar a assinatura da transação original que foi passada para o seu programa. Você usa `invoke_signed` para que seu programa "assine" por seus PDAs.

```rust
// Usado quando não há necessidade de assinaturas para PDAs
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult

// Usado quando um programa deve fornecer uma 'assinatura' para um PDA, logo, o parâmetro signer_seeds
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

As CPIs estendem os privilégios do chamador para o receptor. Se a instrução que o programa receptor estiver processando contiver uma conta que foi marcada como signatária ou gravável quando originalmente passada para o programa chamador, ela também será considerada uma conta signatária ou gravável no programa invocado.

É importante observar que você, como desenvolvedor, decide quais contas devem ser passadas para a CPI. Você pode pensar em uma CPI como a construção de outra instrução a partir do zero apenas com as informações que foram passadas para o seu programa.

### CPI com `invoke`

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &account_infos[account1.clone(), account2.clone(), account3.clone()],
)?;
```

- `program_id` - a chave pública do programa que você vai invocar
- `account` - uma lista de metadados da conta como um vetor. Você precisa incluir todas as contas que o programa invocado lerá ou gravará
- `data` - um buffer de bytes que representa os dados que estão sendo passados para o programa chamado como um vetor

O tipo `Instruction` tem a seguinte definição:

```rust
pub struct Instruction {
    pub program_id: Pubkey,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
}
```


Dependendo do programa para o qual você está fazendo a chamada, pode haver um crate disponível com funções auxiliares para criar o objeto `Instruction`. Muitas pessoas e organizações criam crates disponíveis publicamente junto com seus programas que expõem esses tipos de funções para simplificar a chamada de seus programas. Isso é semelhante às bibliotecas Typescript que usamos neste curso (ex. [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/), [@solana/spl-token](https://solana-labs.github.io/solana-program-library/token/js/)). Por exemplo, na demonstração desta lição, usaremos o crate `spl_token` para criar instruções de cunhagem.
Em todos os outros casos, você precisará criar a instância `Instruction` do zero.

Embora o campo `program_id` seja bastante simples, os campos `accounts` e `data` exigem algumas explicações.

Os campos `accounts` e `data` são do tipo `Vec`, ou vetor. Você pode usar a macro [`vec`](https://doc.rust-lang.org/std/macro.vec.html) para construir um vetor usando a notação de vetor, da seguinte forma:

```rust
let v = vec![1, 2, 3];
assert_eq!(v[0], 1);
assert_eq!(v[1], 2);
assert_eq!(v[2], 3);
```


O campo `accounts` da struct `Instruction` espera um vetor do tipo [`AccountMeta`](https://docs.rs/solana-program/latest/solana_program/instruction/struct.AccountMeta.html). A struct `AccountMeta` possui a seguinte definição:


```rust
pub struct AccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}
```

Juntando esses dois pedaços teremos:

```rust
use solana_program::instruction::AccountMeta;

vec![
    AccountMeta::new(account1_pubkey, true),
    AccountMeta::read_only(account2_pubkey, false),
    AccountMeta::read_only(account3_pubkey, true),
    AccountMeta::new(account4_pubkey, false),
]
```


O campo final do objeto de instrução são os dados, como um buffer de bytes, é claro. Você pode criar um buffer de bytes no Rust usando novamente a macro `vec`, que tem uma função implementada que permite criar um vetor de determinado comprimento. Depois de ter inicializado um vetor vazio, você construiria o buffer de bytes de forma semelhante ao que faria no lado do cliente. Determine os dados exigidos pelo programa receptor e o formato de serialização usado e escreva seu código para corresponder. Sinta-se à vontade para ler sobre alguns dos [recursos da macro `vec` disponíveis para você aqui](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#).


```rust
let mut vec = Vec::with_capacity(3);
vec.push(1);
vec.push(2);
vec.extend_from_slice(&number_variable.to_le_bytes());
```

O método [`extend_from_slice`](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#method.extend_from_slice) deve ser, provavelmente, novo para você. É um método para vetores que recebe uma fatia como entrada, itera sobre a fatia, clona cada elemento e, em seguida, anexa-o ao `Vec`.

### Passe uma lista de contas

Além da instrução, tanto o `invoke` quanto o `invoke_signed` também exigem uma lista de objetos `account_info`. Assim como a lista de objetos `AccountMeta` que você adicionou à instrução, é necessário incluir todas as contas que o programa que você está chamando lerá ou gravará.

No momento em que fizer uma CPI em seu programa, você já deverá ter obtido todos os objetos `account_info` que foram passados para o programa e armazenados em variáveis. Você construirá sua lista de objetos `account_info` para a CPI escolhendo quais dessas contas serão copiadas e enviadas.

Você pode copiar cada objeto `account_info` que precisa passar para a CPI usando a carcaterística [`Clone`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html#impl-Clone) implementada na struct `account_info` no crate `solana_program`. Esse trait `Clone` retorna uma cópia da instância [`account_info`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html).

```rust
&[first_account.clone(), second_account.clone(), third_account.clone()]
```

### CPI com `invoke`

Com a instrução e a lista de contas criadas, você pode fazer uma chamada para `invoke`.

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &[account1.clone(), account2.clone(), account3.clone()],
)?;
```

Não há necessidade de incluir uma assinatura porque o tempo de execução da Solana transmite a assinatura original passada para o seu programa. Lembre-se de que o `invoke` não funcionará se for necessária uma assinatura em nome de um PDA. Para isso, você precisará usar `invoke_signed`.

### CPI com `invoke_signed`


O uso de `invoke_signed` é um pouco diferente porque há um campo adicional que requer as sementes usadas para derivar quaisquer PDAs que devem assinar a transação. Você deve se lembrar de lições anteriores em que os PDAs não se encontram na curva Ed25519 e, portanto, não têm uma chave secreta correspondente. Você foi informado de que os programas podem fornecer assinaturas para seus PDAs, mas não aprendeu como isso realmente acontece - até agora. Os programas fornecem assinaturas para seus PDAs com a função `invoke_signed`. Os dois primeiros campos de `invoke_signed` são os mesmos de `invoke`, mas há um campo adicional `signers_seeds` que entra em jogo aqui.


```rust
invoke_signed(
    &instruction,
    accounts,
    &[&["First addresses seed"],
        &["Second addresses first seed",
        "Second addresses second seed"]],
)?;
```

Embora os PDAs não tenham chaves secretas próprias, eles podem ser usados por um programa para emitir uma instrução que inclua o PDA como signatário. A única maneira de o tempo de execução verificar se o PDA pertence ao programa que o está chamando é se o programa que o está chamando fornecer as sementes usadas para gerar o endereço no campo `signers_seeds`.

O tempo de execução da Solana chamará internamente o [`create_program_address`](https://docs.rs/solana-program/1.4.4/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) usando as sementes fornecidas e o `program_id` do programa que está chamando. Em seguida, ele pode comparar o resultado com os endereços fornecidos na instrução. Se algum dos endereços corresponder, o tempo de execução saberá que, de fato, o programa associado a esse endereço é o chamador e, portanto, está autorizado a ser um signatário.


## Práticas Recomendadas e Armadilhas Comuns

### Verificações de Segurança

Há alguns erros comuns e coisas que devem ser lembradas ao utilizar CPIs que são importantes para a segurança e a robustez de seu programa. A primeira coisa a ser lembrada é que, como já sabemos, não temos controle sobre as informações que são passadas para os nossos programas. Por esse motivo, é importante sempre verificar o `program_id`, as contas e os dados transmitidos à CPI. Sem essas verificações de segurança, alguém poderia enviar uma transação que invocasse uma instrução em um programa completamente diferente do esperado, o que não é o ideal.

Felizmente, há verificações inerentes à validade de qualquer PDA marcado como signatário na função `invoke_signed`. Todas as outras contas e `instruction_data` devem ser verificados em algum lugar do código do programa antes de fazer a CPI. Também é importante certificar-se de que você está direcionando a instrução pretendida no programa que está invocando. A maneira mais fácil de fazer isso é ler o código-fonte do programa que você invocará, da mesma forma que faria se estivesse construindo uma instrução do lado do cliente.

### Erros comuns

Há alguns erros comuns que você pode receber ao executar uma CPI, que geralmente significam que você está construindo a CPI com informações incorretas. Por exemplo, você pode se deparar com uma mensagem de erro semelhante a esta:

```text
EF1M4SPfKcchb6scq297y8FPCaLvj5kGjwMzjTM68wjA's signer privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Essa mensagem é um pouco enganosa, pois "privilégio de signatário escalado" não parece ser um problema, mas, na realidade, significa que você está assinando incorretamente o endereço da mensagem. Se estiver usando `invoke_signed` e receber esse erro, isso provavelmente significa que as sementes que você está fornecendo estão incorretas. Você também pode encontrar [um exemplo de transação que falhou com esse erro](https://explorer.solana.com/tx/3mxbShkerH9ZV1rMmvDfaAhLhJJqrmMjcsWzanjkARjBQurhf4dounrDCUkGunH1p9M4jEwef9parueyHVw6r2Et?cluster=devnet).

Outro erro semelhante é lançado quando uma conta que está sendo gravada não está marcada como "gravável" dentro da estrutura `AccountMeta`.

```text
2qoeXa9fo8xVHzd2h9mVcueh6oK3zmAiJxCTySM5rbLZ's writable privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Lembre-se de que qualquer conta cujos dados possam ser alterados pelo programa durante a execução deve ser especificada como gravável. Durante a execução, a gravação em uma conta que não foi especificada como gravável fará com que a transação falhe. A gravação em uma conta que não seja de propriedade do programa fará com que a transação falhe. Qualquer conta cujo saldo do relatório possa ser alterado pelo programa durante a execução deve ser especificada como gravável. Durante a execução, a alteração dos lamports de uma conta que não foi especificada como gravável fará com que a transação falhe. Embora a subtração de lamports de uma conta não pertencente ao programa cause falha na transação, é permitido adicionar lamports a qualquer conta, desde que ela seja mutável.

Para ver isso em ação, olhe aqui [transação no explorador](https://explorer.solana.com/tx/ExB9YQJiSzTZDBqx4itPaa4TpT8VK4Adk7GU5pSoGEzNz9fa7PPZsUxssHGrBbJRnCvhoKgLCWnAycFB7VYDbBg?cluster=devnet).

## Por que as CPIs são importantes?

As CPIs são um recurso muito importante do ecossistema Solana e tornam todos os programas implementados interoperáveis entre si. Com as CPIs, não há necessidade de reinventar a roda quando se trata de desenvolvimento. Isso cria a oportunidade de criar novos protocolos e aplicativos com base no que já foi construído, como se fossem blocos de construção ou peças de Lego. É importante lembrar que as CPIs são uma via de mão dupla, e o mesmo vale para todos os programas que você implanta! Se você criar algo interessante e útil, os desenvolvedores poderão construir em cima do que você fez ou simplesmente conectar seu protocolo ao que quer que eles estejam criando. A composabilidade é uma grande parte do que torna a criptografia tão única e as CPIs são o que torna isso possível na Solana.


Outro aspecto importante das CPIs é que elas permitem que os programas assinem por seus PDAs. Como você já deve ter percebido, os PDAs são usados com muita frequência no desenvolvimento do Solana porque permitem que os programas controlem endereços específicos de forma que nenhum usuário externo possa gerar transações com assinaturas válidas para esses endereços. Isso pode ser *muito* útil para muitos aplicativos na Web3 (por exemplo, DeFi, NFTs etc.). Sem CPIs, os PDAs não seriam tão úteis, pois não haveria como um programa assinar transações envolvendo-os - essencialmente transformando-os em buracos negros (uma vez que algo é enviado para um PDA, não haveria como retirá-lo de volta sem CPIs!)

# Demonstração

Agora, vamos adquirir alguma experiência prática com CPIs, fazendo novamente algumas adições ao programa Movie Review. Se você está chegando a esta lição sem ter passado por lições anteriores, o programa Movie Review permite que os usuários enviem avaliações de filmes e as armazenem em contas de PDA.

Na última lição, adicionamos a possibilidade de deixar comentários em outras avaliações de filmes usando PDAs. Nesta lição, vamos trabalhar para que o programa atribua tokens ao avaliador ou comentarista sempre que uma avaliação ou comentário for enviado.

Para implementar isso, teremos de invocar a instrução `MintTo` do Programa de Token SPL usando uma CPI. Se precisar de uma atualização dos tokens, das cunhagens de tokens e da cunhagem de novos tokens, dê uma olhada em [lição Token Program](./token-program.md) antes de prosseguir com esta demonstração.

### 1. Obter o código inicial e adicionar dependências

Para começar, usaremos o estado final do programa Movie Review da lição anterior do PDA. Portanto, se você acabou de concluir essa lição, já está pronto para começar. Se estiver começando agora, não se preocupe, você pode [fazer download do código inicial aqui](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments). Usaremos a branch `solution-add-comments` como ponto de partida.

### 2. Adicione dependências a `Cargo.toml`

Antes de começarmos, precisamos adicionar duas novas dependências ao arquivo `Cargo.toml` abaixo de `[dependencies]`. Usaremos as crates `spl-token` e `spl-associated-token-account` além das dependências existentes.

```text
spl-token = { version="~3.2.0", features = [ "no-entrypoint" ] }
spl-associated-token-account = { version="=1.0.5", features = [ "no-entrypoint" ] }
```

Depois de adicionar os itens acima, execute `cargo check` no console para que o cargo resolva suas dependências e garanta que você esteja pronto para continuar. Dependendo da sua configuração, talvez seja necessário modificar as versões do crate antes de prosseguir.

### 3. Adicione as contas necessárias a `add_movie_review`

Como queremos que os usuários recebam tokens ao criar uma avaliação, faz sentido adicionar a lógica de cunhagem dentro da função `add_movie_review`. Como estaremos cunhando tokens, a instrução `add_movie_review` requer que algumas novas contas sejam passadas:

- `token_mint` - o endereço da cunhagem do token
- `mint_auth` - endereço da autoridade da cunhagem do token
- `user_ata` - conta de token associada do usuário para essa cunhagem (onde os tokens serão cunhados)
- `token_program` - endereço do programa de token

Começaremos adicionando essas novas contas à área da função que itera através das contas passadas:

```rust
// Dentro de add_movie_review
msg!("Adicionando avaliação de filme...");
msg!("Title: {}", title);
msg!("Rating: {}", rating);
msg!("Description: {}", description);

let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

Não há necessidade de `instruction_data` adicional para a nova funcionalidade, portanto, não é necessário fazer alterações na forma como os dados são desserializados. A única informação adicional necessária são as contas extras.

### 4. Cunhe tokens para o avaliador em `add_movie_review`

Antes de nos aprofundarmos na lógica de cunhagem, vamos importar o endereço do programa Token e a constante `LAMPORTS_PER_SOL` na parte superior do arquivo.

```rust
// Dentro do processor.rs
use solana_program::native_token::LAMPORTS_PER_SOL;
use spl_associated_token_account::get_associated_token_address;
use spl_token::{instruction::initialize_mint, ID as TOKEN_PROGRAM_ID};
```

Agora podemos passar para a lógica que lida com a cunhagem real dos tokens! Adicionaremos isso ao final da função `add_movie_review` logo antes de `Ok(())` ser retornado.

A cunhagem de tokens exige uma assinatura da autoridade de cunhagem. Como o programa precisa ser capaz de cunhar tokens, a autoridade de cunhagem precisa ser uma conta que o programa possa assinar. Em outras palavras, ela precisa ser uma conta PDA de propriedade do programa.

Também estruturaremos a cunhagem de nosso token de forma que a conta de cunhagem seja uma conta PDA que possamos derivar de forma determinística. Dessa forma, sempre poderemos verificar se a conta `token_mint` passada para o programa é a conta esperada.

Vamos em frente, derivar os endereços de cunhagem de token e a autoridade de cunhagem usando a função `find_program_address` com as sementes "token_mint" e "token_auth", respectivamente.

```rust
// Cunhe tokens aqui
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Em seguida, realizaremos verificações de segurança em cada uma das novas contas passadas para o programa. Lembre-se sempre de verificar as contas!

```rust
if *token_mint.key != mint_pda {
    msg!("Cunhagem de token incorreta");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Cunhagem passada e cunhagem derivada não correspondem");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(initializer.key, token_mint.key) {
    msg!("Cunhagem de token incorreta");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Programa de token incorreto");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Finalmente, podemos emitir uma CPI para a função `mint_to` do programa de token com as contas corretas usando `invoke_signed`. O crate `spl_token` fornece uma função auxiliar `mint_to` para criar a instrução de cunhagem. Isso é ótimo porque significa que não precisamos criar manualmente toda a instrução a partir do zero. Em vez disso, podemos simplesmente passar os argumentos exigidos pela função. Aqui está a assinatura da função:

```rust
// Dentro do programa de token, retorna um objeto Instruction
pub fn mint_to(
    token_program_id: &Pubkey,
    mint_pubkey: &Pubkey,
    account_pubkey: &Pubkey,
    owner_pubkey: &Pubkey,
    signer_pubkeys: &[&Pubkey],
    amount: u64,
) -> Result<Instruction, ProgramError>
```

Em seguida, fornecemos cópias das contas `token_mint`, `user_ata` e `mint_auth`. E, o que é mais relevante para esta lição, fornecemos as sementes usadas para encontrar o endereço `token_mint`, incluindo a semente de bump.

```rust
msg!("Cunhando 10 tokens para a conta de token associada ao Uuário");
invoke_signed(
    // Instrução
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        10*LAMPORTS_PER_SOL,
    )?,
    // Account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Sementes
    &[&[b"token_mint", &[mint_bump]]],
)?;

Ok(())
```

Observe que estamos usando `invoke_signed` e não `invoke` aqui. O programa de Token exige que a conta `mint_auth` assine essa transação. Como a conta `mint_auth` é um PDA, somente o programa do qual ela foi derivada pode assinar em seu nome. Quando o `invoke_signed` é chamado, o tempo de execução da Solana chama o `create_program_address` com as sementes e o bump fornecidos e, em seguida, compara o endereço derivado com todos os endereços dos objetos `AccountInfo` fornecidos. Se algum dos endereços corresponder ao endereço derivado, o tempo de execução saberá que a conta correspondente é um PDA desse programa e que o programa está assinando essa transação para essa conta.

Nesse ponto, a instrução `add_movie_review` deve estar totalmente funcional e cunhará dez tokens para o avaliador quando uma avaliação for criada.

### 5. Repita para `add_comment`

Nossas atualizações para a função `add_comment` serão quase idênticas às que fizemos para a função `add_movie_review` acima. A única diferença é que alteraremos a quantidade de tokens cunhados para um comentário de dez para cinco, de modo que a adição de avaliações seja ponderada em relação aos comentários. Primeiro, atualize as contas com as mesmas quatro contas adicionais da função `add_movie_review`.

```rust
// Dentro de add_comment
let account_info_iter = &mut accounts.iter();

let commenter = next_account_info(account_info_iter)?;
let pda_review = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let pda_comment = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

Em seguida, vá para a parte inferior da função `add_comment` logo antes do `Ok(())`. Em seguida, derive as contas token mint e mint authority. Lembre-se de que ambas são PDAs derivadas das sementes "token_mint" e "token_authority", respectivamente.

```rust
// Cunhe tokens aqui
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Em seguida, verifique se cada uma das novas contas é a conta correta.

```rust
if *token_mint.key != mint_pda {
    msg!("Cunhagem de token incorreta");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Cunhagem passada e cunhagem derivada não correspondem");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(commenter.key, token_mint.key) {
    msg!("Cunhagem de token incorreta");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Cunhagem de token incorreta");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Por fim, use `invoke_signed` para enviar a instrução `mint_to` para o programa de Token, enviando cinco tokens para o comentarista.

```rust
msg!("Cunhando 5 tokens para a conta de token associada ao Uuário");
invoke_signed(
    // Instrução
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        5 * LAMPORTS_PER_SOL,
    )?,
    // Account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Sementes
    &[&[b"token_mint", &[mint_bump]]],
)?;

Ok(())
```

### 6. Configure a cunhagem do token

Escrevemos todo o código necessário para cunhar tokens para avaliadores e comentaristas, mas tudo isso pressupõe que há uma cunhagem de token no PDA derivado com a semente "token_mint". Para que isso funcione, vamos configurar uma instrução adicional para inicializar a cunhagem do token. Ela será escrita de forma que só possa ser chamada uma vez e não importa quem a chama.

Considerando que, ao longo desta lição, já abordamos várias vezes todos os conceitos associados a PDAs e CPIs, vamos passar por essa parte com menos explicações do que nas etapas anteriores. Comece adicionando uma quarta variante de instrução ao enum `MovieInstruction` em `instruction.rs`.

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    AddComment {
        comment: String,
    },
    InitializeMint,
}
```

Certifique-se de adicioná-lo à instrução `match` na função `unpack` no mesmo arquivo sob a variante `3`.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment,
                }
            }
            3 => Self::InitializeMint,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
```

Na função `process_instruction` no arquivo `processor.rs`, adicione a nova instrução à instrução `match` e chame uma função `initialize_token_mint`.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview {
            title,
            rating,
            description,
        } => add_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::UpdateMovieReview {
            title,
            rating,
            description,
        } => update_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::AddComment { comment } => add_comment(program_id, accounts, comment),
        MovieInstruction::InitializeMint => initialize_token_mint(program_id, accounts),
    }
}
```

Por fim, declare e implemente a função `initialize_token_mint`. Essa função derivará os PDAs de cunhagem de token e autoridade de cunhagem, criará a conta de cunhagem de token e, em seguida, inicializará a cunhagem de token. Não explicaremos tudo isso em detalhes, mas vale a pena ler o código, especialmente porque a criação e a inicialização da cunhagem de token envolvem CPIs. Novamente, se precisar de uma atualização dos tokens e cunhagens, dê uma olhada na [lição Token Program](./token-program.md).

```rust
pub fn initialize_token_mint(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let token_mint = next_account_info(account_info_iter)?;
    let mint_auth = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let sysvar_rent = next_account_info(account_info_iter)?;

    let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
    let (mint_auth_pda, _mint_auth_bump) =
        Pubkey::find_program_address(&[b"token_auth"], program_id);

    msg!("Token mint: {:?}", mint_pda);
    msg!("Mint authority: {:?}", mint_auth_pda);

    if mint_pda != *token_mint.key {
        msg!("Conta de cunhagem de token incorreta");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *token_program.key != TOKEN_PROGRAM_ID {
        msg!("Programa de token incorreto");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *mint_auth.key != mint_auth_pda {
        msg!("Conta de autorização de cunhagem incorreta");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(82);

    invoke_signed(
        &system_instruction::create_account(
            initializer.key,
            token_mint.key,
            rent_lamports,
            82,
            token_program.key,
        ),
        &[
            initializer.clone(),
            token_mint.clone(),
            system_program.clone(),
        ],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Criada conta de cunhagem de token");

    invoke_signed(
        &initialize_mint(
            token_program.key,
            token_mint.key,
            mint_auth.key,
            Option::None,
            9,
        )?,
        &[token_mint.clone(), sysvar_rent.clone(), mint_auth.clone()],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Inicializada a cunhagem de token");

    Ok(())
}
```

### 7. Construa e implante

Agora estamos prontos para construir e implantar nosso programa! Você pode construir o programa executando `cargo build-bpf` e, em seguida, executando o comando retornado, que deve ser semelhante a `solana program deploy <PATH>`.

Antes de começar a testar se na adição de uma avaliação ou comentário serão ou não enviado tokens, você precisa inicializar a cunhagem de token do programa. Você pode usar [este script](https://github.com/Unboxed-Software/solana-movie-token-client) para fazer isso. Depois de clonar esse repositório, substitua o `PROGRAM_ID` em `index.ts` pelo ID do seu programa. Em seguida, execute `npm install` e, depois, `npm start`. O script assume que você está implantando na Devnet. Se estiver implantando localmente, certifique-se de adaptar o script adequadamente.

Depois de inicializar a cunhagem do seu token, você pode usar o [frontend do Movie Review](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-tokens) para testar a adição de avaliações e comentários. Novamente, o código pressupõe que você esteja na Devnet, portanto, aja de acordo.

Depois de enviar uma avaliação, você verá 10 novos tokens em sua carteira! Ao adicionar um comentário, você deverá receber 5 tokens. Eles não terão um nome ou imagem sofisticados, pois não adicionamos metadados ao token, mas você já entendeu a ideia.

Se você precisar de mais tempo com os conceitos desta lição ou se tiver travado no caminho, fique à vontade para [dar uma olhada no código de solução](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-tokens). Observe que a solução para essa demonstração está na branch `solution-add-tokens`.

# Desafio

Para aplicar o que você aprendeu sobre CPIs nesta lição, pense em como você poderia incorporá-las ao programa Student Intro. Você poderia fazer algo semelhante ao que fizemos na demonstração aqui e adicionar alguma funcionalidade para distribuir tokens aos usuários quando eles se apresentarem. Ou, se estiver se sentindo realmente ambicioso, pense em como poderia aproveitar tudo o que aprendeu até agora no curso e criar algo completamente novo do zero.

Um ótimo exemplo seria a criação de um Stack Overflow descentralizado. O programa poderia usar tokens para determinar a classificação geral de um usuário, cunhar tokens quando as perguntas fossem respondidas corretamente, permitir que os usuários votassem a favor das respostas etc. Tudo isso é possível e agora você tem as habilidades e o conhecimento para criar algo assim por conta própria!

Parabéns por ter chegado ao final do Módulo 4! Sinta-se à vontade para [enviar alguns feedbacks rápidos](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%204), para que possamos continuar a aprimorar o curso.

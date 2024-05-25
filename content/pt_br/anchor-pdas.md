---
title: PDAs e Contas Anchor 
objectives:
- Usar as restrições `seeds` e `bump` para trabalhar com contas PDA no Anchor
- Habilitar e usar a restrição `init_if_needed`
- Usar a restrição `realloc` para realocar espaço numa conta existente
- Usar a restrição `close` para fechar uma conta existente
---

# RESUMO

- As restrições `seeds` e `bump` são usadas para inicializar e validar contas PDA no Anchor
- A restrição `init_if_needed` é usada para inicializar uma nova conta condicionalmente
- A restrição `realloc` é usada para realocar espaço numa conta existente
- A restrição `close` é usada para fechar uma conta e reembolsar seu aluguel

# Visão Geral

Nesta lição você aprenderá como trabalhar com PDAs, realocar e fechar contas no Anchor.

Recorde-se de que os programas Anchor separam a lógica de instrução da validação de contas. A validação de contas ocorre principalmente dentro de structs que representam a lista de contas necessárias para uma determinada instrução. Cada campo da struct representa uma conta diferente, e o usuário pode personalizar a validação realizada na conta utilizando a macro de atributos `#[account(...)]`.

Além de usar restrições para validação de contas, algumas restrições podem lidar com tarefas repetitivas que, de outra forma, exigiriam muito clichê dentro de nossa lógica de instrução. Esta lição apresentará as restrições `seeds`, `bump`, `realloc` e `close` para ajudá-lo a inicializar e validar PDAs, realocar contas e fechar contas.

## PDAs com o Anchor

Recorde-se de que [PDAs](https://github.com/Unboxed-Software/solana-course/blob/main/content/pda.md) são derivadas com o uso de uma lista de sementes opcionais, uma semente bump e um ID de programa. O Anchor fornece uma maneira conveniente de validar um PDA com as restrições `seeds` e `bump`.

```rust
#[derive(Accounts)]
struct ExampleAccounts {
  #[account(
    seeds = [b"example_seed"],
    bump
  )]
  pub pda_account: Account<'info, AccountType>,
}
```

Durante a validação da conta, o Anchor derivará um PDA usando as sementes especificadas na restrição `seeds` e verificará se a conta passou na instrução que corresponde ao PDA encontrado usando as `seeds` específicas.

Quando a restrição `bump` for incluída sem especificação de um determinado bump, o Anchor usará por padrão o bump canônico (o primeiro bump que resulta em um PDA válido). Na maioria dos casos, você deve usar o bump canônico.

É possível acessar outros campos de dentro da struct a partir de restrições. Portanto, é possível especificar sementes que dependem de outras contas, como a chave pública do signatário.

Você também pode fazer referência aos dados de instrução desserializados se adicionar a macro de atributos `#[instruction(...)]` à struct.

Por exemplo, o exemplo a seguir mostra uma lista de contas que inclui `pda_account` e `user`. A `pda_account` está restringida de forma que as sementes sejam a string "example_seed", a chave pública de `user` e a string tenha passado na instrução como `instruction_data`.

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct Example<'info> {
    #[account(
        seeds = [b"example_seed", user.key().as_ref(), instruction_data.as_ref()],
        bump
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>
}
```

Se o endereço `pda_account` fornecido pelo cliente não corresponder ao PDA derivado usando as sementes especificadas e o bump canônico, a validação da conta falhará.

### Use PDAs com a restrição `init` 

Você pode combinar as retrições `seeds` e `bump` com a restrição `init` para inicializar uma conta usando um PDA.

Lembre-se de que a restrição `init` deve ser usada em conjunto com as restrições `payer` e `space` para especificar a conta que pagará pela inicialização da conta e o espaço a ser alocado na nova conta. Além disso, você deve incluir `system_program` como um dos campos da estrutura de validação da conta.

```rust
#[derive(Accounts)]
pub struct InitializePda<'info> {
    #[account(
        init,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + 8
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: u64,
}
```

Ao usar `init` para contas que não sejam PDA, o padrão Anchor é definir o proprietário da conta inicializada como sendo o programa que está executando a instrução no momento.

Entretanto, ao usar `init` em combinação com `seeds` e `bump`, o proprietário *deve* ser o programa em execução. Isso ocorre porque a inicialização de uma conta para o PDA requer uma assinatura que somente o programa em execução pode fornecer. Em outras palavras, a verificação da assinatura para a inicialização da conta PDA falharia se o ID do programa usado para derivar o PDA não correspondesse ao ID do programa em execução.

Ao determinar o valor de `space` para uma conta inicializada e de propriedade do programa Anchor em execução, lembre-se de que os 8 primeiros bytes são reservados para o discriminador de conta. Esse é um valor de 8 bytes que o Anchor calcula e usa para identificar os tipos de conta do programa. Você pode usar essa [referência] (https://www.anchor-lang.com/docs/space) para calcular a quantidade de espaço que deve ser alocada para uma conta.

### Inferência de semente

A lista de contas para uma instrução pode ficar muito longa para alguns programas. Para simplificar a experiência do lado do cliente, ao invocar uma instrução do programa Anchor, podemos ativar a inferência de sementes.

A inferência de sementes adiciona informações sobre sementes de PDA ao IDL para que o Anchor possa inferir sementes de PDA a partir de informações existentes do local da chamada. No exemplo anterior, as sementes são `b "example_seed"` e `user.key()`. A primeira é estática e, portanto, conhecida, e a segunda é conhecida porque `user` é o signatário da transação.

Se você usar a inferência de sementes ao criar seu programa, desde que esteja chamando o programa usando o Anchor, não precisará derivar explicitamente e passar no PDA. Em vez disso, a biblioteca Anchor fará isso por você.

Você pode ativar a inferência de sementes no arquivo `Anchor.toml` com `seeds = true` em `[features]`.

```
[features]
seeds = true
```

### Use a macro de atributos `#[instruction(...)]`

Vamos dar uma breve olhada na macro de atributo `#[instruction(...)]` antes de prosseguirmos. Ao usar `#[instruction(...)]`, os dados da instrução fornecidos na lista de argumentos devem corresponder e estar na mesma ordem dos argumentos da instrução. Você pode omitir argumentos não utilizados no final da lista, mas deve incluir todos os argumentos até o último que será usado.

Por exemplo, imagine que uma instrução tenha os argumentos `input_one`, `input_two` e `input_three`. Se as restrições de sua conta precisarem fazer referência a `input_one` e `input_three`, você precisará listar todos os três argumentos na macro de atributos `#[instruction(...)]`.

Entretanto, se suas restrições fizerem referência apenas a `input_one` e `input_two`, você poderá omitir `input_three`.

```rust
pub fn example_instruction(
    ctx: Context<Example>,
    input_one: String,
    input_two: String,
    input_three: String,
) -> Result<()> {
    ...
    Ok(())
}

#[derive(Accounts)]
#[instruction(input_one:String, input_two:String)]
pub struct Example<'info> {
    ...
}
```

Além disso, você obterá um erro se listar os inputs na ordem incorreta:

```rust
#[derive(Accounts)]
#[instruction(input_two:String, input_one:String)]
pub struct Example<'info> {
    ...
}
```

## Init-if-needed

O Anchor fornece uma restrição `init_if_needed` que pode ser usada para inicializar uma conta se ela ainda não tiver sido inicializada.

Essa funcionalidade está vinculada a um sinalizador de funcionalidade para garantir que você tenha a intenção de usá-lo. Por motivos de segurança, é recomendável evitar que uma instrução se desdobre em vários caminhos lógicos. E, como o nome sugere, o `init_if_needed` executa um dos dois caminhos de código possíveis, dependendo do estado da conta em questão.

Ao usar o `init_if_needed`, você precisa se certificar de proteger adequadamente seu programa contra ataques de reinicialização. É necessário incluir verificações em seu código que chequem se a conta inicializada não pode ser redefinida para suas configurações iniciais após a primeira vez que foi inicializada.

Para usar o `init_if_needed`, você deve primeiro ativar o recurso em `Cargo.toml`.

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
```

Depois de ativar o recurso, você pode incluir a restrição na macro de atributos `#[account(...)]`. O exemplo abaixo demonstra o uso da restrição `init_if_needed` para inicializar uma nova conta de token associada, caso ainda não exista uma.

```rust
#[program]
mod example {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
     #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
```

Quando a instrução `initialize` é invocada no exemplo anterior, o Anchor verifica se a `token_account` existe e a inicializa se não existir. Se ela já existir, a instrução continuará sem inicializar a conta. Assim como na restrição `init`, você pode usar `init_if_needed` em conjunto com `seeds` e `bump` se a conta for um PDA.

## Realloc

A restrição `realloc` fornece uma forma simples de realocação de espaço para contas existentes.

A restrição `realloc` deve ser usada em combinação com as seguintes restrições:

- `mut` - a conta deve ser definida como mutável
- `realloc::payer` - a conta para subtrair ou adicionar lamports, dependendo se a realocação estiver diminuindo ou aumentando o espaço da conta
- `realloc::zero` - um booleano para especificar se a nova memória deve ser inicializada com zero

Assim como acontece com  `init`, deve-se incluir `system_program` como uma das contas na struct de validação de conta quando usar `realloc`.

Abaixo está um exemplo de realocação de espaço para uma conta que armazena um campo `data` do tipo `String`.

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct ReallocExample<'info> {
    #[account(
        mut,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        realloc = 8 + 4 + instruction_data.len(),
        realloc::payer = user,
        realloc::zero = false,
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: String,
}
```

Observe que `realloc` está definido como `8 + 4 + instruction_data.len()`. Isso se divide da seguinte forma:
- `8` é para o discriminador de contas
- `4` é para os 4 bytes de espaço que o BORSH utiliza para armazenar o comprimento da string
- `instruction_data.len()` é o comprimento da própria string

Se a alteração no comprimento dos dados da conta for aditiva, os lamports serão transferidos do `realloc::payer` para a conta a fim de manter a isenção de aluguel. Da mesma forma, se a alteração for subtrativa, os lamports serão transferidos da conta de volta para o `realloc::payer`.

A restrição `realloc::zero` é necessária para determinar se a nova memória deve ser inicializada com zero após a realocação. Essa restrição deve ser definida como verdadeira nos casos em que você espera que a memória de uma conta diminua e aumente várias vezes. Dessa forma, você zera o espaço que, de outra forma, seria exibido como dados obsoletos.

## Close

A restrição `close` fornece uma forma simples e segura de fechar uma conta existente.

A restrição `close` indica a conta como fechada no final da execução da instrução, definindo seu discriminador como `CLOSED_ACCOUNT_DISCRIMINATOR` e envia seus lamports para uma determinada conta. A definição do discriminador como uma variante especial impossibilita ataques de reativação de contas (em que uma instrução subsequente adiciona novamente os lamports de isenção  de aluguel). Se alguém tentar reinicializar a conta, a reinicialização falhará na verificação do discriminador e será considerada inválida pelo programa.

O exemplo abaixo utiliza a restrição `close` para fechar a conta `data_account` e envia os lamports alocados para aluguel para a conta `receiver`.

```rust
pub fn close(ctx: Context<Close>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, AccountType>,
    #[account(mut)]
    pub receiver: Signer<'info>
}
```

# Demonstração

Vamos praticar os conceitos que abordamos nesta lição criando um programa Movie Review usando o framework Anchor.

Este programa permitirá que os usuários:

- Usem um PDA para inicializar uma nova conta de avaliação de filme para armazenar a avaliação
- Atualizem o conteúdo de uma conta de avaliação de filme existente
- Fechem uma conta de avaliação de filme existente

### 1. Crie um novo projeto Anchor

Para começar, vamos criar um novo projeto usando `anchor init`.

```console
anchor init anchor-movie-review-program
```

Em seguida, navegue até o arquivo `lib.rs` dentro da pasta `programs` e você deverá ver o seguinte código inicial.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
```

Vá em frente e remova a instrução `initialize` e o tipo `Initialize`.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}
```

### 2. `MovieAccountState`

Primeiro, vamos usar o macro de atributos `#[account]` para definir o `MovieAccountState` que representará a estrutura de dados da conta de avaliação de filme. Como lembrete, a macro de atributos `#[account]` implementa vários traits que ajudam na serialização e desserialização da conta, define o discriminador para a conta e define o proprietário de uma nova conta como o ID do programa definido na macro `declare_id!`.

Em cada conta de avaliação de filme, armazenaremos o:

- `reviewer` - usuário que cria a avaliação
- `rating` - classificação do filme
- `title` - título do filme
- `description` - conteúdo da avaliação

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}

#[account]
pub struct MovieAccountState {
    pub reviewer: Pubkey,    // 32
    pub rating: u8,          // 1
    pub title: String,       // 4 + len()
    pub description: String, // 4 + len()
}
```

### 3. Adicione uma avaliação de filme

Em seguida, vamos implementar a instrução `add_movie_review`. A instrução `add_movie_review` requer um `Context` do tipo `AddMovieReview` que implementaremos em breve.

A instrução exigirá três argumentos adicionais como dados de instrução fornecidos por um avaliador:

- `title` - título do filme como uma `String`
- `description` - detalhes da avaliação como uma `String`
- `rating` - classificação do filme como uma `u8`

Dentro da lógica de instrução, preencheremos os dados da nova conta `movie_review` com dados de instrução. Também definiremos o campo `reviewer` como a conta `initializer` do contexto da instrução.

```rust
#[program]
pub mod movie_review{
    use super::*;

    pub fn add_movie_review(
        ctx: Context<AddMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("Conta de Avaliação de Filme Criada");
        msg!("Title: {}", title);
        msg!("Description: {}", description);
        msg!("Rating: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.reviewer = ctx.accounts.initializer.key();
        movie_review.title = title;
        movie_review.rating = rating;
        movie_review.description = description;
        Ok(())
    }
}
```

Em seguida, vamos criar a struct `AddMovieReview` que usamos como genérica no contexto da instrução. Essa struct listará as contas que a instrução `add_movie_review` requer.

Lembre-se de que você precisará das seguintes macros:

- A macro `#[derive(Accounts)]` é usada para desserializar e validar a lista de contas especificadas na estrutura
- A macro de atributos `#[instruction(...)]` é usada para acessar os dados de instrução passados para a instrução
- A macro de atributos `#[account(...)]` especifica restrições adicionais nas contas.

A conta `movie_review` é um PDA que precisa ser inicializado, então, acrescentaremos as retrições `seeds` e `bump` assim como a restrição `init` com suas restrições `payer` e `space` necessárias.

Para as sementes do PDA, usaremos o título do filme e a chave pública do avaliador. O pagador para a inicialização deve ser o avaliador, e o espaço alocado na conta deve ser suficiente para o discriminador da conta, a chave pública do avaliador e a classificação, o título e a descrição da avaliação do filme.

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct AddMovieReview<'info> {
    #[account(
        init,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 + 1 + 4 + title.len() + 4 + description.len()
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Atualize a Avaliação do Filme

Em seguida, vamos implementar a instrução `update_movie_review` com um contexto cujo tipo genérico é `UpdateMovieReview`.

Assim como antes, a instrução exigirá três argumentos adicionais como dados de instrução fornecidos por um avaliador:

- `title` - título do filme
- `description` - detalhes da avaliação
- `rating` - classificação do filme

Na lógica da instrução, atualizaremos o `rating` e o `description` armazenados na conta `movie_review`.

Embora o `title` não seja usado na função de instrução em si, precisaremos dele para a validação da conta `movie_review` na próxima etapa.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn update_movie_review(
        ctx: Context<UpdateMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("Movie review account space reallocated");
        msg!("Title: {}", title);
        msg!("Description: {}", description);
        msg!("Rating: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.rating = rating;
        movie_review.description = description;

        Ok(())
    }

}
```

Em seguida, vamos criar a struct `UpdateMovieReview` para definir as contas que a instrução `update_movie_review` requer.

Como a conta `movie_review` já terá sido inicializada a essa altura, não precisamos mais da restrição `init`. Entretanto, como o valor de `description` agora pode ser diferente, precisamos usar a restrição `realloc` para realocar o espaço na conta. Além disso, precisamos das restrições `mut`, `realloc::payer` e `realloc::zero`.

Também precisaremos das restrições `seeds` e `bump`, como fizemos em `AddMovieReview`.

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct UpdateMovieReview<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        realloc = 8 + 32 + 1 + 4 + title.len() + 4 + description.len(),
        realloc::payer = initializer,
        realloc::zero = true,
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

Observe que a restrição `realloc` é definida para o novo espaço exigido pela conta `movie_review` com base no valor atualizado de `description`.

Além disso, a restrição `realloc::payer` especifica que todos os lamport adicionais necessários ou reembolsados virão da conta `initializer` ou serão enviados para ela.

Por fim, definimos a restrição `realloc::zero` como `true` porque a conta `movie_review` pode ser atualizada várias vezes, reduzindo ou expandindo o espaço alocado para a conta.

### 5. Exclua a conta de Avaliação do Filme

Por fim, vamos implementar a instrução `delete_movie_review` para fechar uma conta `movie_review` existente.

Usaremos um contexto cujo tipo genérico é `DeleteMovieReview` e não incluiremos nenhum dado de instrução adicional. Como estamos apenas fechando uma conta, na verdade não precisamos de nenhuma lógica de instrução dentro do corpo da função. O fechamento em si será tratado pela restrição Anchor do tipo `DeleteMovieReview`.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn delete_movie_review(_ctx: Context<DeleteMovieReview>, title: String) -> Result<()> {
        msg!("Movie review for {} deleted", title);
        Ok(())
    }

}
```

Em seguida, vamos implementar a struct `DeleteMovieReview`.

```rust
#[derive(Accounts)]
#[instruction(title: String)]
pub struct DeleteMovieReview<'info> {
    #[account(
        mut,
        seeds=[title.as_bytes(), initializer.key().as_ref()],
        bump,
        close=initializer
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>
}
```

Aqui usamos a restrição `close` para especificar que estamos fechando a conta `movie_review` e que o aluguel deve ser devolvido à conta `initializer`. Também incluímos as restrições `seeds` e `bump` para a conta `movie_review` para validação. Em seguida, o Anchor processa a lógica adicional necessária para fechar a conta com segurança.

### 6. Teste

O programa deve estar pronto para funcionar! Agora vamos testá-lo. Navegue até `anchor-movie-review-program.ts` e substitua o código de teste padrão pelo seguinte.

Aqui nós:

- Criamos valores padrão para os dados de instrução de avaliação de filmes
- Derivamos a conta PDA de avaliação de filmes
- Criamos espaços reservados para os testes

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { assert, expect } from "chai"
import { AnchorMovieReviewProgram } from "../target/types/anchor_movie_review_program"

describe("anchor-movie-review-program", () => {
  // Configura o cliente para usar o cluster local.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace
    .AnchorMovieReviewProgram as Program<AnchorMovieReviewProgram>

  const movie = {
    title: "Just a test movie",
    description: "Wow what a good movie it was real great",
    rating: 5,
  }

  const [moviePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  it("Movie review is added`", async () => {})

  it("Movie review is updated`", async () => {})

  it("Deletes a movie review", async () => {})
})
```

Em seguida, vamos criar o primeiro teste para a instrução `addMovieReview`. Observe que não adicionamos explicitamente `.accounts`. Isso ocorre porque a `Wallet` do `AnchorProvider` é automaticamente incluída como signatário, o Anchor pode inferir determinadas contas, como `SystemProgram` e o Anchor também pode inferir o PDA `movieReview` a partir do argumento da instrução `title` e da chave pública do signatário.

Após a instrução ser executada, buscamos a conta `movieReview` e verificamos se os dados armazenados na conta correspondem aos valores esperados.

```typescript
it("Movie review is added`", async () => {
  // Adicione seu teste aqui.
  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(movie.title === account.title)
  expect(movie.rating === account.rating)
  expect(movie.description === account.description)
  expect(account.reviewer === provider.wallet.publicKey)
})
```

Em seguida, vamos criar o teste para a instrução `updateMovieReview`, seguindo o mesmo procedimento anterior.

```typescript
it("Movie review is updated`", async () => {
  const newDescription = "Wow this is new"
  const newRating = 4

  const tx = await program.methods
    .updateMovieReview(movie.title, newDescription, newRating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(movie.title === account.title)
  expect(newRating === account.rating)
  expect(newDescription === account.description)
  expect(account.reviewer === provider.wallet.publicKey)
})
```

Em seguida, criamos o teste para a instrução `deleteMovieReview`

```typescript
it("Deletes a movie review", async () => {
  const tx = await program.methods
    .deleteMovieReview(movie.title)
    .rpc()
})
```

Por fim, execute `anchor test` e você deve ver a seguinte saída em seu console.

```console
  anchor-movie-review-program
    ✔ Movie review is added` (139ms)
    ✔ Movie review is updated` (404ms)
    ✔ Deletes a movie review (403ms)


  3 passing (950ms)
```

Se precisar de mais tempo com este projeto para se sentir confortável com esses conceitos, dê uma olhada no [código de solução] (https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas) antes de continuar.

# Desafio

Agora é sua vez de criar algo de forma independente. Equipado com os conceitos apresentados nesta lição, tente recriar o programa Student Intro (Apresentação de Estudantes) que usamos anteriormente usando a estrutura Anchor.

O programa Student Intro é um programa Solana que permite que os alunos se apresentem. O programa usa o nome de um usuário e uma mensagem curta como dados de instrução e cria uma conta para armazenar os dados na cadeia.

Usando o que você aprendeu nesta lição, crie esse programa. O programa deve incluir instruções para:

1. Inicializar uma conta PDA para cada aluno que armazene o nome do aluno e sua mensagem curta
2. Atualizar a mensagem em uma conta existente
3. Fechar uma conta existente

Tente fazer isso de forma independente, se possível! Mas se você tiver dúvidas, sinta-se à vontade para consultar o [código de solução] (https://github.com/Unboxed-Software/anchor-student-intro-program).

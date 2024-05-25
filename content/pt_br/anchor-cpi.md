---
title: CPIs e Erros Anchor
objectives:
- Fazer invocações entre programas (CPIs) a partir de um programa Anchor
- Usar a funcionalidade `cpi` para gerar funções auxiliares para invocar instruções em programas Anchor existentes.
- Usar `invoke` e `invoke_signed` para criar CPIs onde as funções auxiliares de CPI não estão disponíveis.
- Criar e retornar erros personalizados do Anchor
---

# RESUMO

- O Anchor oferece uma maneira simplificada de criar CPIs usando um **`CpiContext`**
- A funcionalidade **`cpi`** do Anchor gera funções auxiliares de CPI para invocar instruções em programas Anchor existentes
- Se você não tiver acesso às funções auxiliares de CPI, ainda poderá usar `invoke` e `invoke_signed` diretamente
- A macro de atributos **`error_code`** é usada para criar erros personalizados do Anchor

# Visão Geral

Se você se lembrar da [primeira lição de CPI](cpi.md), verá que a construção de CPIs pode ser complicada com o Rust básico. No entanto, o Anchor torna isso um pouco mais simples, especialmente se o programa que você está invocando também for um programa Anchor cujo crate possa ser acessado.

Nesta lição, você aprenderá a construir um CPI Anchor. Você também aprenderá a lançar erros personalizados de um programa Anchor para que possa começar a escrever programas Anchor mais sofisticados.

## Invocações entre Programas (CPIs) com o Anchor

Para relembrar, os CPIs permitem que os programas invoquem instruções em outros programas usando as funções `invoke` ou `invoke_signed`. Isso permite que novos programas sejam construídos com base em programas existentes (chamamos isso de composabilidade).

Embora a criação de CPIs diretamente usando `invoke` ou `invoke_signed` ainda seja uma opção, o Anchor também oferece uma maneira simplificada de criar CPIs usando um `CpiContext`.

Nesta lição, você usará o crate `anchor_spl` para criar CPIs para o Programa de Token SPL. Você pode [explorar o que está disponível no crate `anchor_spl`](https://docs.rs/anchor-spl/latest/anchor_spl/#).

### `CpiContext`

A primeira etapa na construção de uma CPI é criar uma instância de `CpiContext`. O `CpiContext` é muito semelhante ao `Context`, o primeiro tipo de argumento exigido pelas funções de instrução Anchor. Ambos são declarados no mesmo módulo e compartilham funcionalidade semelhante.

O tipo `CpiContext` especifica entradas sem argumentos para invocações entre programas:

- `accounts` - a lista de contas necessárias para a instrução que está sendo invocada
- `remaining_accounts` - quaisquer contas remanescentes
- `program` - o ID do programa que está sendo invocado
- `signer_seeds` - se um PDA estiver assinando, inclua as sementes necessárias para derivar o PDA

```rust
pub struct CpiContext<'a, 'b, 'c, 'info, T>
where
    T: ToAccountMetas + ToAccountInfos<'info>,
{
    pub accounts: T,
    pub remaining_accounts: Vec<AccountInfo<'info>>,
    pub program: AccountInfo<'info>,
    pub signer_seeds: &'a [&'b [&'c [u8]]],
}
```

Você usa `CpiContext::new` para criar uma nova instância ao passar pela assinatura da transação original.

```rust
CpiContext::new(cpi_program, cpi_accounts)
```

```rust
pub fn new(
        program: AccountInfo<'info>,
        accounts: T
    ) -> Self {
    Self {
        accounts,
        program,
        remaining_accounts: Vec::new(),
        signer_seeds: &[],
    }
}
```

Você usa `CpiContext::new_with_signer` para construir uma nova instância ao assinar em nome de um PDA para a CPI.

```rust
CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds)
```

```rust
pub fn new_with_signer(
    program: AccountInfo<'info>,
    accounts: T,
    signer_seeds: &'a [&'b [&'c [u8]]],
) -> Self {
    Self {
        accounts,
        program,
        signer_seeds,
        remaining_accounts: Vec::new(),
    }
}
```

### Contas CPI

Um dos principais aspectos do `CpiContext` que simplifica as invocações entre programas é que o argumento `accounts` é um tipo genérico que permite que você passe qualquer objeto que adote os traits `ToAccountMetas` e `ToAccountInfos<'info>`.

Esses traits são adicionados pela macro de atributos `#[derive(Accounts)]` que você usou anteriormente ao criar structs para representar contas de instrução. Isso significa que você pode usar structs semelhantes com o `CpiContext`.

Isso auxilia na organização do código e na segurança de tipo.

### Invoque uma instrução em outro programa Anchor

Quando o programa que você está chamando é um programa Anchor com um crate publicado, o Anchor pode gerar construtores de instruções e funções auxiliares de CPI para você.

Basta declarar a dependência do seu programa no programa que você está chamando, no arquivo `Cargo.toml` do seu programa, da seguinte forma:

```
[dependencies]
callee = { path = "../callee", features = ["cpi"]}
```

Ao adicionar `features = ["cpi"]`, você ativa a funcionalidade `cpi` e seu programa obtém acesso ao módulo `callee::cpi`.

O módulo `cpi` expõe as instruções do `callee` como uma função Rust que recebe como argumentos um `CpiContext` e quaisquer dados de instrução adicionais. Essas funções usam o mesmo formato que as funções de instrução em seus programas Anchor, apenas com `CpiContext` em vez de `Context`. O módulo `cpi` também expõe as estruturas de contas necessárias para chamar as instruções.

Por exemplo, se `callee` tiver a instrução `do_something` que requer as contas definidas na struct `DoSomething`, você poderá chamar `do_something` da seguinte forma:

```rust
use anchor_lang::prelude::*;
use callee;
...

#[program]
pub mod lootbox_program {
    use super::*;

    pub fn call_another_program(ctx: Context<CallAnotherProgram>, params: InitUserParams) -> Result<()> {
        callee::cpi::do_something(
            CpiContext::new(
                ctx.accounts.callee.to_account_info(),
                callee::DoSomething {
                    user: ctx.accounts.user.to_account_info()
                }
            )
        )
        Ok(())
    }
}
...
```

### Invocar uma instrução em um programa que não seja o Anchor

Quando o programa que você está chamando *não* é um programa Anchor, há duas opções possíveis:

1. É possível que os mantenedores do programa tenham publicado um crate com suas próprias funções auxiliares para fazer chamadas em seus programas. Por exemplo, o crate `anchor_spl` fornece funções auxiliares que são virtualmente idênticas, do ponto de vista do local de chamada, ao que você obteria com o módulo `cpi` de um programa Anchor. Por exemplo, você pode usar a função auxiliar [`mint_to`] (https://docs.rs/anchor-spl/latest/src/anchor_spl/token.rs.html#36-58) e usar a [struct de contas `MintTo`](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.MintTo.html).
    ```rust
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.mint_account.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[&[
                "mint".as_bytes(),
                &[*ctx.bumps.get("mint_authority").unwrap()],
            ]]
        ),
        amount,
    )?;
    ```
2. Se não houver um módulo auxiliar para o programa cuja(s) instrução(ões) você precisa invocar, você pode voltar a usar `invoke` e `invoke_signed`. De fato, o código-fonte da função auxiliar `mint_to` mencionada acima mostra um exemplo do uso de `invoke_signed` quando é fornecido um `CpiContext`. Você pode seguir um padrão semelhante se decidir usar uma struct de contas e um `CpiContext` para organizar e preparar seu CPI.
    ```rust
    pub fn mint_to<'a, 'b, 'c, 'info>(
        ctx: CpiContext<'a, 'b, 'c, 'info, MintTo<'info>>,
        amount: u64,
    ) -> Result<()> {
        let ix = spl_token::instruction::mint_to(
            &spl_token::ID,
            ctx.accounts.mint.key,
            ctx.accounts.to.key,
            ctx.accounts.authority.key,
            &[],
            amount,
        )?;
        solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.to.clone(),
                ctx.accounts.mint.clone(),
                ctx.accounts.authority.clone(),
            ],
            ctx.signer_seeds,
        )
        .map_err(Into::into)
    }
    ```

## Lançar erros no Anchor

Neste ponto, já estamos suficientemente aprofundados no Anchor para que seja importante saber como criar erros personalizados.

Em última análise, todos os programas retornam o mesmo tipo de erro: [`ProgramError`](https://docs.rs/solana-program/latest/solana_program/program_error/enum.ProgramError.html). Entretanto, ao escrever um programa usando o Anchor, você pode usar o `AnchorError` como uma abstração em cima do `ProgramError`. Essa abstração fornece informações adicionais quando um programa falha, incluindo:

- O nome e o número do erro
- Localização, no código, de onde o erro foi lançado
- A conta que violou uma restrição

```rust
pub struct AnchorError {
    pub error_name: String,
    pub error_code_number: u32,
    pub error_msg: String,
    pub error_origin: Option<ErrorOrigin>,
    pub compared_values: Option<ComparedValues>,
}
```

Erros do Anchor podem ser divididos em:

- Erros internos do Anchor que o framework retorna de dentro de seu próprio código
- Erros personalizados que você, desenvolvedor, pode criar

Você pode adicionar erros exclusivos ao seu programa usando o atributo `error_code`. Basta adicionar esse atributo a um tipo `enum` personalizado. Em seguida, você pode usar as variantes do `enum` como erros em seu programa. Além disso, você pode adicionar uma mensagem de erro a cada variante usando o atributo `msg`. Os clientes podem então exibir essa mensagem de erro se ele ocorrer.

```rust
#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

Para retornar um erro personalizado, você pode usar a macro [err](https://docs.rs/anchor-lang/latest/anchor_lang/macro.err.html) ou [error](https://docs.rs/anchor-lang/latest/anchor_lang/prelude/macro.error.html) de uma função de instrução. Elas adicionam informações de arquivo e linha ao erro que é registrado pelo Anchor para ajudá-lo na depuração.

```rust
#[program]
mod hello_anchor {
    use super::*;
    pub fn set_data(ctx: Context<SetData>, data: MyAccount) -> Result<()> {
        if data.data >= 100 {
            return err!(MyError::DataTooLarge);
        }
        ctx.accounts.my_account.set_inner(data);
        Ok(())
    }
}

#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

Como alternativa, você pode usar a macro [require](https://docs.rs/anchor-lang/latest/anchor_lang/macro.require.html) para simplificar o retorno de erros. O código acima pode ser reformulado para o seguinte:

```rust
#[program]
mod hello_anchor {
    use super::*;
    pub fn set_data(ctx: Context<SetData>, data: MyAccount) -> Result<()> {
        require!(data.data < 100, MyError::DataTooLarge);
        ctx.accounts.my_account.set_inner(data);
        Ok(())
    }
}

#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

# Demonstração

Vamos praticar os conceitos que abordamos nesta lição com base no programa Movie Review (Avaliação de Filme) das lições anteriores.

Nesta demonstração, atualizaremos o programa para cunhar tokens para os usuários quando eles enviarem uma nova avaliação de filme.

### 1. Início

Para começar, usaremos o estado final do programa Anchor Movie Review da lição anterior. Portanto, se você acabou de concluir essa lição, já está pronto para começar. Se estiver começando agora, não se preocupe, você pode [fazer download do código inicial](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas). Usaremos a branch `solution-pdas` como ponto de partida.

### 2. Adicione dependência a `Cargo.toml`

Antes de começarmos, precisamos ativar a funcionalidade `init-if-needed` e adicionar o crate `anchor-spl` às dependências em `Cargo.toml`. Se precisar se familiarizar com a funcionalidade `init-if-needed`, dê uma olhada na lição [Anchor PDAs and Accounts](anchor-pdas.md).

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
anchor-spl = "0.25.0"
```

### 3. Inicialize o token de recompensa

Em seguida, navegue até `lib.rs` e crie uma instrução para inicializar uma cunhagem de um novo token. Esse será o token que será cunhado sempre que um usuário deixar uma avaliação. Observe que não precisamos incluir nenhuma lógica de instrução personalizada, pois a inicialização pode ser tratada inteiramente por meio de restrições do Anchor.

```rust
pub fn initialize_token_mint(_ctx: Context<InitializeMint>) -> Result<()> {
    msg!("Cunhagem de Token inicializada");
    Ok(())
}
```

Agora, implemente o tipo de contexto `InitializeMint` e liste as contas e as restrições que a instrução exige. Aqui, inicializamos uma nova conta `Mint` usando um PDA com a string "mint" como semente. Observe que podemos usar o mesmo PDA tanto para o endereço da conta `Mint` quanto para a autoridade de cunhagem. O uso de um PDA como autoridade de cunhagem permite que nosso programa assine a cunhagem dos tokens.

Para inicializar a conta `Mint`, precisamos incluir o `token_program`, o `rent` e o `system_program` na lista de contas.

```rust
#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        seeds = ["mint".as_bytes()],
        bump,
        payer = user,
        mint::decimals = 6,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>
}
```

Pode haver algumas restrições acima que você ainda não tenha visto. Adicionar `mint::decimals` e `mint::authority` junto com `init` garante que a conta seja inicializada como uma nova cunhagem de token com os decimais apropriados e a autoridade de cunhagem definida.

### 4. Erro Anchor

Em seguida, vamos criar um Erro Anchor, que usaremos ao validar a `rating` que passou tanto para a instrução `add_movie_review` quanto para `update_movie_review`.

```rust
#[error_code]
enum MovieReviewError {
    #[msg("A classificação deve estar entre 1 e 5")]
    InvalidRating
}
```

### 5. Atualize a instrução `add_movie_review`

Agora que já fizemos algumas configurações, vamos atualizar a instrução `add_movie_review` e o tipo de contexto `AddMovieReview` para cunhar tokens para o avaliador.

Em seguida, atualize o tipo de contexto `AddMovieReview` para adicionar as seguintes contas:

- `token_program` - usaremos a Token Program para cunhar tokens
- `mint` - a conta mint para os tokens que serão emitidos para os usuários quando eles adicionarem uma avaliação de filme
- `token_account` - a conta de token associada para o `mint` e o avaliador mencionados anteriormente
- `associated_token_program` - necessário porque usaremos a restrição `associated_token` no `token_account`
- `rent` - necessário porque estamos usando a restrição `init-if-needed` no `token_account`
```rust
#[derive(Accounts)]
#[instruction(title: String, description: String)]
pub struct AddMovieReview<'info> {
    #[account(
        init,
        seeds=[title.as_bytes(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 + 1 + 4 + title.len() + 4 + description.len()
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
    // CONTAS ADICIONADAS ABAIXO
    pub token_program: Program<'info, Token>,
    #[account(
        seeds = ["mint".as_bytes()]
        bump,
        mut
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = initializer,
        associated_token::mint = mint,
        associated_token::authority = initializer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>
}
```

Novamente, algumas das restrições acima podem não ser familiares para você. As restrições `associated_token::mint` e `associated_token::authority`, juntamente com a restrição `init_if_needed`, garantem que, se a conta ainda não tiver sido inicializada, ela será inicializada como uma conta de token associada para a cunhagem e a autoridade específicas.

Em seguida, vamos atualizar a instrução `add_movie_review` para fazer o seguinte:

- Verifique se o valor de `rating` é válido. Se não for, retorne o erro `InvalidRating`.
- Faça um CPI para a instrução `mint_to` do programa de token usando o PDA de autoridade de cunhagem como um signatário. Observe que vamos cunhar 10 tokens para o usuário, mas precisamos ajustar os decimais da cunhagem, tornando-a `10*10^6`.

Felizmente, podemos usar o crate `anchor_spl` para acessar funções auxiliares e tipos como `mint_to` e `MintTo` para construir nossa CPI para a Token Program. O `mint_to` recebe um `CpiContext` e um número inteiro como argumentos, em que o número inteiro representa o número de tokens a serem cunhados. O `MintTo` pode ser usado para a lista de contas que a instrução mint precisa.

```rust
pub fn add_movie_review(ctx: Context<AddMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Conta de avaliação de filmes criada");
    msg!("Title: {}", title);
    msg!("Description: {}", description);
    msg!("Rating: {}", rating);

    require!(rating >= 1 && rating <= 5, MovieReviewError::InvalidRating);

    let movie_review = &mut ctx.accounts.movie_review;
    movie_review.reviewer = ctx.accounts.initializer.key();
    movie_review.title = title;
    movie_review.description = description;
    movie_review.rating = rating;

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                authority: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info()
            },
            &[&[
                "mint".as_bytes(),
                &[*ctx.bumps.get("mint").unwrap()]
            ]]
        ),
        10*10^6
    )?;

    msg!("Minted tokens");

    Ok(())
}
```

### 6. Atualize a instrução `update_movie_review`

Aqui, estamos apenas adicionando a verificação de que `rating` seja válido.

```rust
pub fn update_movie_review(ctx: Context<UpdateMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Espaço da conta de avaliação de filmes realocado");
    msg!("Title: {}", title);
    msg!("Description: {}", description);
    msg!("Rating: {}", rating);

    require!(rating >= 1 && rating <= 5, MovieReviewError::InvalidRating);

    let movie_review = &mut ctx.accounts.movie_review;
    movie_review.description = description;
    movie_review.rating = rating;

    Ok(())
}
```

### 7. Teste

Essas são todas as alterações que precisamos fazer no programa! Agora, vamos atualizar nossos testes.

Comece certificando-se de que suas importações e a função `describe` tenham a seguinte aparência:

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token"
import { AnchorMovieReviewProgram } from "../target/types/anchor_movie_review_program"

describe("anchor-movie-review-program", () => {
  // Configure o cliente para usar o cluster local.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace
    .AnchorMovieReviewProgram as Program<AnchorMovieReviewProgram>

  const movie = {
    title: "Just a test movie",
    description: "Wow what a good movie it was real great",
    rating: 5,
  }

  const [movie_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
  )
...
}
```

Com isso feito, adicione um teste para a instrução `initializeTokenMint`:

```typescript
it("Initializes the reward token", async () => {
    const tx = await program.methods.initializeTokenMint().rpc()
})
```

Observe que não precisamos adicionar `.accounts` porque eles podem ser inferidos, incluindo a conta `mint` (supondo que você tenha a inferência seed habilitada).

Em seguida, atualize o teste para a instrução `addMovieReview`. As principais adições são:
1. Obter o endereço de token associado que precisa passar na instrução como uma conta que não pode ser inferida
2. Verificar no final do teste se a conta de token associada possui 10 tokens

```typescript
it("Movie review is added`", async () => {
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    provider.wallet.publicKey
  )
  
  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .accounts({
      tokenAccount: tokenAccount,
    })
    .rpc()
  
  const account = await program.account.movieAccountState.fetch(movie_pda)
  expect(movie.title === account.title)
  expect(movie.rating === account.rating)
  expect(movie.description === account.description)
  expect(account.reviewer === provider.wallet.publicKey)

  const userAta = await getAccount(provider.connection, tokenAccount)
  expect(Number(userAta.amount)).to.equal((10 * 10) ^ 6)
})
```

Depois disso, nem o teste para `updateMovieReview` nem o teste para `deleteMovieReview` precisa de mudanças.

Neste ponto, execute `anchor test` e você deverá ver a seguinte saída:

```console
anchor-movie-review-program
    ✔ Initializes the reward token (458ms)
    ✔ Movie review is added (410ms)
    ✔ Movie review is updated (402ms)
    ✔ Deletes a movie review (405ms)

  5 passing (2s)
```

Se você precisa de um tempo maior para os conceitos desta lição ou travou ao longo do caminho, sinta-se à vontade para consultar [código de solução](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-add-tokens). Observe que a solução desta demonstração está na branch `solution-add-tokens`.

# Desafio

Para aplicar o que você aprendeu sobre CPIs nessa lição, pense em como você pode incorporar esse conhecimento no programa Student Intro. Você poderia fazer alguma coisa semelhante ao que fizemos nessa demonstração aqui e adicionar algumas funcionalidades para cunhar tokens para usuários no momento em que eles se apresentarem.

Tente fazer isso por conta própria se você puder! Mas, se travar, sinta-se à vontade para consultar esse [código de solução](https://github.com/Unboxed-Software/anchor-student-intro-program/tree/cpi-challenge). Observe que seu código pode ficar ligeiramente diferente do código de solução dependendo de sua implementação.

---
title: Introdução ao desenvolvimento com Anchor
objectives:
- Utilizar o framework Anchor para construir um programa básico
- Descrever a estrutura básica de um programa Anchor
- Explicar como implementar validações básicas de contas e verificações de segurança com o Anchor
---

# Resumo

- O **Anchor** é um framework para construir programas Solana
- **Macros do Anchor** aceleram o processo de construção de programas Solana, abstraindo uma quantidade significativa de código repetitivo
- O Anchor permite construir **programas seguros** mais facilmente, realizando certas verificações de segurança, exigindo validação de contas e fornecendo uma maneira simples de implementar verificações adicionais.

# Visão Geral

## O que é o Anchor?

Anchor é um framework de desenvolvimento que torna a escrita de programas Solana mais fácil, rápida e segura. É o framework "preferido" para o desenvolvimento em Solana por um ótimo motivo. Ele facilita a organização e a compreensão do seu código, implementa verificações de segurança comuns automaticamente e abstrai uma quantidade significativa de código repetitivo associado à escrita de um programa Solana.

## Estrutura de um programa Anchor

O Anchor usa macros e traits para gerar código Rust repetitivo para você. Estes proporcionam uma estrutura clara para o seu programa para que você possa entender melhor o seu código. As principais macros e atributos de alto nível são:

- `declare_id` - uma macro para declarar o endereço onchain do programa
- `#[program]` - uma macro de atributo usada para denotar o módulo que contém a lógica de instrução do programa
- `Accounts` - um trait aplicado a structs que representam a lista de contas necessárias para uma instrução
- `#[account]` - uma macro de atributo usada para definir tipos de conta personalizados para o programa

Vamos falar sobre cada um deles antes de juntar todas as peças.

## Declarando seu ID de programa

A macro `declare_id` é usada para especificar o endereço onchain do programa (ou seja, o `programId`). Quando você constrói um programa Anchor pela primeira vez, o framework gera um novo par de chaves. Esse se torna o par de chaves padrão usado para implantar o programa, a menos que seja especificado de outra forma. A chave pública correspondente deve ser usada como o `programId` especificado na macro `declare_id!`.

```rust
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
```

## Definindo a lógica de instrução

A macro de atributo `#[program]` define o módulo que contém todas as instruções do seu programa. É aqui que você implementa a lógica de negócios para cada instrução no seu programa.

Cada função pública no módulo com o atributo `#[program]` será tratada como uma instrução separada.

Cada função de instrução requer um parâmetro do tipo `Context` e pode opcionalmente incluir parâmetros de função adicionais representando os dados da instrução. O Anchor manipulará automaticamente a desserialização dos dados da instrução para que você possa trabalhar com os dados da instrução como tipos Rust.

```rust
#[program]
mod program_module_name {
    use super::*;

    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}
```

### Contexto da Instrução (`Context`)

O tipo `Context` expõe metadados da instrução e contas à lógica da sua instrução.

```rust
pub struct Context<'a, 'b, 'c, 'info, T> {
    /// ID do programa atualmente em execução.
    pub program_id: &'a Pubkey,
    /// Contas desserializadas.
    pub accounts: &'b mut T,
    /// Contas restantes fornecidas mas não desserializadas ou validadas.
    /// Tenha muito cuidado ao usar isso diretamente.
    pub remaining_accounts: &'c [AccountInfo<'info>],
    /// Sementes de salto (bump seeds) encontradas durante a validação de restrição. Isso é fornecido como uma
    /// conveniência para que os manipuladores não tenham que recalcular sementes de salto ou
    /// passá-las como argumentos.
    pub bumps: BTreeMap<String, u8>,
}
```

`Context` é um tipo genérico onde `T` define a lista de contas que uma instrução requer. Quando você usa `Context`, você especifica o tipo concreto de `T` como uma struct que adota o trait `Accounts` (por exemplo, `Context<AddMovieReviewAccounts>`). Através deste argumento de contexto, a instrução pode então acessar:

- As contas passadas para a instrução (`ctx.accounts`)
- O ID do programa (`ctx.program_id`) do programa em execução
- As contas restantes (`ctx.remaining_accounts`). O `remaining_accounts` é um vetor que contém todas as contas que foram passadas para a instrução, mas não estão declaradas na struct `Accounts`.
- Os saltos para quaisquer contas PDA na struct `Accounts` (`ctx.bumps`)


## Definindo contas de instrução

O trait `Accounts` define uma estrutura de dados de contas validadas. Structs que adotam esse trait definem a lista de contas necessárias para uma determinada instrução. Essas contas são então expostas através do `Context` de uma instrução, de modo que a iteração e desserialização manual de contas não são mais necessárias.

Você normalmente aplica o trait `Accounts` através da macro `derive` (por exemplo, `#[derive(Accounts)]`). Isso implementa um deserializador `Accounts` na struct fornecida e remove a necessidade de desserializar cada conta manualmente.

As implementações do trait `Accounts` são responsáveis por realizar todas as verificações de restrição necessárias para garantir que as contas atendam às condições exigidas para o programa funcionar de forma segura. As restrições são fornecidas para cada campo usando o atributo `#account(..)` (mais sobre isso em breve).

Por exemplo, `instruction_one` requer um argumento `Context` do tipo `InstructionAccounts`. A macro `#[derive(Accounts)]` é usada para implementar a struct `InstructionAccounts`, que inclui três contas: `account_name`, `user` e `system_program`.

```rust
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		...
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}
```

Quando `instruction_one` é invocada, o programa:

- Verifica se as contas passadas para a instrução correspondem aos tipos de conta especificados na struct `InstructionAccounts`
- Verifica as contas em relação a quaisquer restrições adicionais especificadas

Se alguma conta passada para `instruction_one` falhar na validação de conta ou nas verificações de segurança especificadas na struct `InstructionAccounts`, então a instrução falha antes mesmo de alcançar a lógica do programa.

## Validação de conta

Você pode ter notado no exemplo anterior que uma das contas em `InstructionAccounts` era do tipo `Account`, uma era do tipo `Signer` e uma era do tipo `Program`.

O Anchor fornece vários tipos de conta que podem ser usados para representar contas. Cada tipo implementa uma validação de conta diferente. Vamos passar por alguns dos tipos comuns que você pode encontrar, mas não deixe de conferir a [lista completa de tipos de conta](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/index.html).

### `Account`

`Account` é um wrapper em torno de `AccountInfo` que verifica a propriedade do programa e desserializa os dados subjacentes em um tipo Rust.

```rust
// Desserializa estas informações
pub struct AccountInfo<'a> {
    pub key: &'a Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
    pub lamports: Rc<RefCell<&'a mut u64>>,
    pub data: Rc<RefCell<&'a mut [u8]>>,    // <---- desserializa dados da conta
    pub owner: &'a Pubkey,    // <---- verifica o programa proprietário
    pub executable: bool,
    pub rent_epoch: u64,
}
```

Lembre-se do exemplo anterior, onde `InstructionAccounts` tinha um campo `account_name`:

```rust
pub account_name: Account<'info, AccountStruct>
```

Aqui, o wrapper `Account` faz o seguinte:

- Desserializa os `dados` da conta no formato do tipo `AccountStruct`
- Verifica se o proprietário do programa da conta corresponde ao proprietário do programa especificado para o tipo `AccountStruct`.

Quando o tipo de conta especificado no wrapper `Account` é definido no mesmo crate usando a macro de atributo `#[account]`, a verificação da propriedade do programa é em relação ao `programId` definido na macro `declare_id!`.

As seguintes verificações são realizadas:

```rust
// Verificações
Account.info.owner == T::owner()
!(Account.info.owner == SystemProgram && Account.info.lamports() == 0)
```

### `Signer`

O tipo `Signer` valida que a conta dada assinou a transação. Nenhuma outra verificação de propriedade ou tipo é realizada. Você deve usar o `Signer` apenas quando os dados subjacentes da conta não são necessários na instrução.

Para a conta `user` no exemplo anterior, o tipo `Signer` especifica que a conta `user` deve ser um signatário da instrução.

A seguinte verificação é realizada para você:

```rust
// Verificação
Signer.info.is_signer == true
```

### `Program`

O tipo `Program` valida que a conta é um determinado programa.

Para a conta `system_program` no exemplo anterior, o tipo `Program` é usado para especificar que o programa deve ser o programa do sistema. O Anchor fornece um tipo `System` que inclui o `programId` do programa do sistema a ser verificado.

As seguintes verificações são realizadas para você:

```rust
//Verificações
account_info.key == expected_program
account_info.executable == true
```

## Adicionando restrições com `#[account(..)]`

A macro de atributo `#[account(..)]` é usada para aplicar restrições às contas. Vamos revisar alguns exemplos de restrições nesta e em futuras lições, mas em algum momento, certifique-se de olhar a [lista completa de restrições possíveis](https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html).

Lembre-se novamente do campo `account_name` do exemplo `InstructionAccounts`.

```rust
#[account(init, payer = user, space = 8 + 8)]
pub account_name: Account<'info, AccountStruct>,
#[account(mut)]
pub user: Signer<'info>,
```

Note que o atributo `#[account(..)]` contém três valores separados por vírgulas:

- `init` - cria a conta por meio de uma CPI para o programa do sistema e a inicializa (define seu discriminador de conta)
- `payer` - especifica o pagador para a inicialização da conta como sendo a conta `user` definida na struct
- `space` - especifica que o espaço alocado para a conta deve ser de `8 + 8` bytes. Os primeiros 8 bytes são para um discriminador que o Anchor adiciona automaticamente para identificar o tipo de conta. Os próximos 8 bytes alocam espaço para os dados armazenados na conta conforme definido no tipo `AccountStruct`.

Para `user`, usamos o atributo `#[account(..)]` para especificar que a conta referenciada é mutável. A conta `user` deve ser marcada como mutável porque lamports serão deduzidos da conta para pagar pela inicialização de `account_name`.

```rust
#[account(mut)]
pub user: Signer<'info>,
```

Note que a restrição `init` colocada em `account_name` automaticamente inclui uma restrição `mut`, de modo que tanto `account_name` quanto `user` sejam contas mutáveis.

## `#[account]`

O atributo `#[account]` é aplicado a structs que representam a estrutura de dados de uma conta Solana. Ele implementa os seguintes traits:

- `AccountSerialize`
- `AccountDeserialize`
- `AnchorSerialize`
- `AnchorDeserialize`
- `Clone`
- `Discriminator`
- `Owner`

Você pode ler mais sobre os [detalhes de cada trait](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html). No entanto, o que você precisa saber principalmente é que o atributo `#[account]` permite a serialização e desserialização e implementa os traits de discriminador e proprietário para uma conta.

O discriminador é um identificador único de 8 bytes para um tipo de conta derivado dos primeiros 8 bytes do hash SHA256 do nome do tipo de conta. Ao implementar traits de serialização de conta, os primeiros 8 bytes são reservados para o discriminador da conta.

Como resultado, qualquer chamada para `AccountDeserialize`'s `try_deserialize` verificará este discriminador. Se não corresponder, uma conta inválida foi fornecida, e a desserialização da conta sairá com um erro.

O atributo `#[account]` também implementa o trait `Owner` para uma struct utilizando o `programId` declarado pelo `declareId` do crate em que `#[account]` é utilizado. Em outras palavras, todas as contas inicializadas usando um tipo de conta definido que usam o atributo `#[account]` dentro do programa também pertencem ao programa.

Como exemplo, vamos olhar para `AccountStruct` usado por `account_name` de `InstructionAccounts`:

```rust
#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    ...
}

#[account]
pub struct AccountStruct {
    data: u64
}
```

O atributo `#[account]` garante que ele possa ser usado como uma conta em `InstructionAccounts`.

Quando a conta `account_name` é inicializada:

- Os primeiros 8 bytes são definidos como o discriminador `AccountStruct`
- O campo de dados da conta corresponderá a `AccountStruct`
- O proprietário da conta é definido como o `programId` de `declare_id`

## Juntando tudo

Quando você combina todos esses tipos do Anchor, acaba com um programa completo. Abaixo está um exemplo de um programa básico Anchor com uma única instrução que:

- Inicializa uma nova conta
- Atualiza o campo de dados na conta com os dados de instrução passados para a instrução

```rust
// Use esta importação para acessar recursos comuns do Anchor
use anchor_lang::prelude::*;

// Endereço onchain do programa
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Lógica de instrução
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
        ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}

// Valide contas de entrada para instruções
#[derive(Accounts)]
pub struct InstructionAccounts<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}

// Defina um tipo de conta de programa personalizado
#[account]
pub struct AccountStruct {
    data: u64
}
```

Você agora está pronto para construir seu próprio programa Solana usando o framework Anchor!

# Demonstração

Antes de começarmos, instale o Anchor [seguindo os passos de sua documentação oficial](https://www.anchor-lang.com/docs/installation).

Para esta demonstração, criaremos um programa simples de contador com duas instruções:

- A primeira instrução inicializará uma conta de contador
- A segunda instrução incrementará a contagem armazenada em uma conta de contador

### 1. Configuração

Crie um novo projeto chamado `anchor-counter` executando `anchor init`:

```console
anchor init anchor-counter
```

Em seguida, execute `anchor-build`

```console
anchor-build
```

Depois, execute `anchor keys list`

```console
anchor keys list
```

Copie o ID do programa fornecido por `anchor keys list`

```
anchor_counter: BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr
```

Em seguida, atualize `declare_id!` em `lib.rs`

```rust
declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");
```

E também atualize `Anchor.toml`

```
[programs.localnet]
anchor_counter = "BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr"
```

Por fim, exclua o código padrão em `lib.rs` até que tudo o que resta seja o seguinte:

```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

}
```

### 2. Adicionando a instrução `initialize`

Primeiro, vamos implementar a instrução `initialize` dentro de `#[program]`. Esta instrução requer um `Context` do tipo `Initialize` e não requer dados adicionais de instrução. Na lógica da instrução, estamos simplesmente definindo o campo `count` da conta `counter` para `0`.

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.count = 0;
    msg!("Conta de contador criada");
    msg!("Contagem atual: { }", counter.count);
    Ok(())
}
```

### 3. Implementando o `Context` do tipo `Initialize`

Em seguida, usando a macro `#[derive(Accounts)]`, vamos implementar o tipo `Initialize` que lista e valida as contas usadas pela instrução `initialize`. Serão necessárias as seguintes contas:

- `counter` - a conta de contador inicializada na instrução
- `user` - pagador pela inicialização
- `system_program` - o programa do sistema é necessário para a inicialização de quaisquer novas contas

```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Implementando `Counter`

Em seguida, use o atributo `#[account]` para definir um novo tipo de conta `Counter`. A struct `Counter` define um campo `count` do tipo `u64`. Isso significa que podemos esperar que quaisquer novas contas inicializadas como um tipo `Counter` tenham uma estrutura de dados correspondente. O atributo `#[account]` também define automaticamente o discriminador para uma nova conta e define o proprietário da conta como o `programId` da macro `declare_id!`.


```rust
#[account]
pub struct Counter {
    pub count: u64,
}
```

### 5. Adicionando a instrução `increment`

Dentro de `#[program]`, vamos implementar uma instrução `increment` para incrementar o `count` uma vez que uma conta `counter` seja inicializada pela primeira instrução. Esta instrução requer um `Context` do tipo `Update` (implementado na próxima etapa) e não requer dados adicionais de instrução. Na lógica da instrução, estamos simplesmente incrementando o campo `count` de uma conta `counter` existente em `1`.

```rust
pub fn increment(ctx: Context<Update>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    msg!("Contador anterior: {}", counter.count);
    counter.count = counter.count.checked_add(1).unwrap();
    msg!("Contador incrementado. Contagem atual: {}", counter.count);
    Ok(())
}
```

### 6. Implementando o `Context` do tipo `Update`

Por último, usando a macro `#[derive(Accounts)]` novamente, vamos criar o tipo `Update`, que lista as contas que a instrução `increment` requer. Serão necessárias as seguintes contas:

- `counter` - uma conta de contador existente para incrementar
- `user` - pagador pela taxa de transação

Novamente, precisaremos especificar quaisquer restrições usando o atributo `#[account(..)]`:

```rust
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}
```

### 7. Compilando

Tudo junto, o programa completo ficará assim:

```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Conta de contador criada. Contagem atual: {}", counter.count);
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        msg!("Contador anterior: {}", counter.count);
        counter.count = counter.count.checked_add(1).unwrap();
        msg!("Contador incrementado. Contagem atual: {}", counter.count);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}

#[account]
pub struct Counter {
    pub count: u64,
}
```

Execute `anchor build` para construir o programa.

### 8. Testando

Os testes do Anchor são tipicamente testes de integração em Typescript que usam o framework de teste Mocha. Aprenderemos mais sobre testes mais tarde, mas por agora navegue até `anchor-counter.ts` e substitua o código de teste padrão pelo seguinte:

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { AnchorCounter } from "../target/types/anchor_counter"

describe("anchor-counter", () => {
  // Configure o cliente para usar o cluster local.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.AnchorCounter as Program<AnchorCounter>

  const counter = anchor.web3.Keypair.generate()

  it("Foi inicializado!", async () => {})

  it("Contagem incrementada", async () => {})
})
```

O código acima gera um novo par de chaves para a conta `counter` que estaremos inicializando e cria espaços reservados para um teste de cada instrução.

Em seguida, crie o primeiro teste para a instrução `initialize`:

```typescript
it("Foi inicializado!", async () => {
  // Adicione seu teste aqui
  const tx = await program.methods
    .initialize()
    .accounts({ counter: counter.publicKey })
    .signers([counter])
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 0)
})
```

Em seguida, crie o segundo teste para a instrução `increment`:

```typescript
it("Contagem incrementada", async () => {
  const tx = await program.methods
    .increment()
    .accounts({ counter: counter.publicKey, user: provider.wallet.publicKey })
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 1)
})
```

Por último, execute `anchor test` e você deve ver a seguinte saída:

```console
anchor-counter
✔ Is initialized! (290ms)
✔ Incremented the count (403ms)


2 passing (696ms)
```

Executar `anchor test` automaticamente inicia um validador de teste local, implanta seu programa e executa seus testes Mocha nele. Não se preocupe se estiver confuso com os testes por agora - vamos explorar mais sobre isso mais tarde.

Parabéns, você acabou de construir um programa Solana usando o framework Anchor! Sinta-se à vontade para consultar o [código da solução](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-increment) se precisar de mais tempo com ele.

# Desafio

Agora é a sua vez de construir algo independentemente. Como estamos começando com programas muito simples, o seu parecerá quase idêntico ao que acabamos de criar. É útil tentar chegar ao ponto de poder escrevê-lo do zero sem referenciar códigos anteriores, então tente não copiar e colar aqui.

1. Escreva um novo programa que inicializa uma conta `counter`
2. Implemente tanto uma instrução `increment` quanto `decrement`
3. Construa e implante seu programa como fizemos na demonstração
4. Teste seu programa recém-implantado e use o Explorador Solana para verificar os logs do programa

Como sempre, seja criativo com esses desafios e leve-os além das instruções básicas, se desejar - e divirta-se!

Tente fazer isso independentemente, se puder! Mas se você tiver dúvidas, sinta-se à vontade para consultar o [código da solução](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

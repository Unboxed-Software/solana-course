---
title: Variáveis de Ambiente nos Programas Solana
objectives:
- Definir as funcionalidades do programa no arquivo `Cargo.toml`.
- Usar o atributo `cfg` do Rust para compilar código condicionalmente com base em quais funcionalidades estão ou não ativadas
- Usar a macro Rust `cfg!` para compilar código condicionalmente com base em quais funcionalidades estão ou não ativadas.
- Criar uma instrução somente para administradores para configurar uma conta de programa que possa ser usada para armazenar os valores de configuração do programa.
---

# RESUMO

- Não há soluções "prontas para uso" para criar ambientes distintos em um programa onchain, mas você pode conseguir algo semelhante às variáveis de ambiente se for criativo.
- Você pode usar o atributo `cfg` com **funcionalidades do Rust** (`#[cfg(feature = ...)]`) para executar códigos diferentes ou fornecer valores de variáveis diferentes com base na funcionalidade do Rust fornecida. Isso acontece no tempo de compilação e não permite que você troque os valores depois que um programa tiver sido implantado.
- Da mesma forma, você pode usar a **macro** `cfg!` para compilar diferentes caminhos de código com base nas funcionalidades que estão ativadas.
- Como alternativa, você pode obter algo semelhante às variáveis de ambiente que podem ser modificadas após a implantação, criando contas e instruções que só podem ser acessadas pela autoridade de atualização do programa.

# Visão Geral

Uma das dificuldades que os engenheiros enfrentam em todos os tipos de desenvolvimento de software é escrever códigos testáveis e criar ambientes distintos para desenvolvimento local, testes, produção etc.

Isso pode ser particularmente difícil no desenvolvimento de programas Solana. Por exemplo, imagine a criação de um programa de staking de NFTs que recompensa cada NFT em staking com 10 tokens de recompensa por dia. Como você testa a capacidade de reivindicar recompensas quando os testes são executados em algumas centenas de milissegundos, o que não é tempo suficiente para ganhar recompensas?

O desenvolvimento tradicional da Web resolve parte desse problema com variáveis de ambiente cujos valores podem ser diferentes em cada "ambiente" distinto. Atualmente, não há um conceito formal de variáveis de ambiente em um programa Solana. Se houvesse, você poderia simplesmente fazer com que as recompensas em seu ambiente de teste fossem de 10.000.000 de tokens por dia e seria mais fácil testar a capacidade de reivindicar recompensas.

Felizmente, é possível obter uma funcionalidade semelhante se você for criativo. A melhor abordagem é provavelmente uma combinação de duas coisas:

1. Sinalizadores de funcionalidade do Rust que permitem especificar em seu comando de compilação o "ambiente" da compilação, juntamente com o código que ajusta valores específicos adequadamente
2. Contas de programa e instruções "somente para administradores" que só podem ser acessadas pela autoridade de atualização do programa

## Sinalizadores de funcionalidade do Rust

Uma das maneiras mais simples de criar ambientes é usar as funcionalidades do Rust. Elas são definidas na tabela `[features]` do arquivo `Cargo.toml` do programa. Você pode definir várias funcionalidades para diferentes casos de uso.

```toml
[features]
feature-one = []
feature-two = []
```

É importante observar que o comando acima simplesmente define uma funcionalidade. Para ativar uma funcionalidade ao testar seu programa, você pode usar o sinalizador `--features` com o comando `anchor test`.

```bash
anchor test -- --features "feature-one"
```

Você também pode especificar várias funcionalidades, separando-as com uma vírgula.

```bash
anchor test -- --features "feature-one", "feature-two"
```

### Crie uma condicional de código usando o atributo `cfg`.

Com uma funcionalidade definida, você pode usar o atributo `cfg` em seu código para compilar condicionalmente o código com base na ativação ou não de uma determinada funcionalidade. Isso permite que você inclua ou exclua determinado código do seu programa.

A sintaxe para usar o atributo `cfg` é como qualquer outra macro de atributo: `#[cfg(feature=[FEATURE_HERE])]`. Por exemplo, o código a seguir compila a função `function_for_testing` quando a funcionalidade `testing` está habilitada e a `function_when_not_testing` quando não está:

```rust
#[cfg(feature = "testing")]
fn function_for_testing() {
    // código que será incluído somente se o sinalizador de funcionalidade "testing" estiver habilitado
}

#[cfg(not(feature = "testing"))]
fn function_when_not_testing() {
    // código que será incluído somente se o sinalizador de funcionalidade "testing" não estiver habilitado
}
```

Isso permite que você habilite ou desabilite determinadas funcionalidades em seu programa Anchor no momento da compilação, habilitando ou desabilitando a funcionalidade.

Não é difícil imaginar que você queira usar isso para criar "ambientes" distintos para diferentes implantações de programas. Por exemplo, nem todos os tokens são implantados na Mainnet e na Devnet. Portanto, você pode codificar um endereço de token para implantações na Mainnet, mas codificar um endereço diferente para implantações na Devnet e na Localnet. Dessa forma, você pode alternar rapidamente entre diferentes ambientes sem precisar fazer alterações no próprio código.

O código abaixo mostra um exemplo de um programa Anchor que usa o atributo `cfg` para incluir diferentes endereços de token para testes locais em comparação com outras implantações:

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[cfg(feature = "local-testing")]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("WaoKNLQVDyBx388CfjaVeyNbs3MT2mPgAhoCfXyUvg8");
}

#[cfg(not(feature = "local-testing"))]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

#[program]
pub mod test_program {
    use super::*;

    pub fn initialize_usdc_token_account(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = payer,
    )]
    pub token: Account<'info, TokenAccount>,
    #[account(address = constants::USDC_MINT_PUBKEY)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

Neste exemplo, o atributo `cfg` é usado para compilar condicionalmente duas implementações diferentes do módulo `constants`. Isso permite que o programa use valores diferentes para a constante `USDC_MINT_PUBKEY`, dependendo da habilitação ou não da funcionalidade `local-testing`.

### Crie uma condicional de código usando a macro `cfg!`

Semelhante ao atributo `cfg`, a **macro** `cfg!` do Rust permite que você verifique os valores de determinados sinalizadores de configuração no tempo de execução. Isso pode ser útil se você quiser executar caminhos de código diferentes, dependendo dos valores de determinados sinalizadores de configuração.

Você poderia usar isso para ignorar ou ajustar as restrições baseadas em tempo exigidas no aplicativo de staking de NFT que mencionamos anteriormente. Ao executar um teste, você pode executar um código que ofereça recompensas de staking muito maiores em comparação com a execução de uma compilação de produção.

Para usar a macro `cfg!` em um programa Anchor, basta adicionar uma chamada de macro `cfg!` à instrução condicional em questão:

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn test_function(ctx: Context<Test>) -> Result<()> {
        if cfg!(feature = "local-testing") {
            // Este código somente será executado se a funcionalidade "local-testing" estiver habilitada
            // ...
        } else {
            //  Este código somente será executado se a funcionalidade "local-testing" não estiver habilitada
            // ...
        }
        // O código que deve sempre ser incluído fica aqui
        ...
        Ok(())
    }
}
```

Neste exemplo, a função `test_function` utiliza a macro `cfg!` para verificar o valor da funcionalidade `local-testing` no tempo de execução. Se a funcionalidade `local-testing` estiver habilitada, o primeiro caminho de código será executado. Caso contrário, será executado o segundo caminho de código.

## Instruções exclusivas de administradores

Os sinalizadores de funcionalidades são ótimos para ajustar valores e caminhos de código na compilação, mas não ajudam muito se você precisar ajustar algo depois de já ter implantado o programa.

Por exemplo, se o seu programa de staking de NFT tiver que alternar e usar um token de recompensa diferente, não haverá como atualizar o programa sem nova implantação. Se ao menos houvesse uma maneira de os administradores do programa atualizarem determinados valores do programa... Bem, isso é possível!

Primeiro, você precisa estruturar o seu programa para armazenar os valores que você planeja alterar em uma conta, em vez de fazer codificação rígida deles no código do programa.

Em seguida, você precisa garantir que essa conta só possa ser atualizada por alguma autoridade de programa conhecida, ou o que estamos chamando de administrador. Isso significa que qualquer instrução que modifique os dados dessa conta precisa ter restrições que em relação a quem pode assinar a instrução. Isso parece bastante simples na teoria, mas há um problema principal: como o programa sabe quem é um administrador autorizado?

Bem, há algumas soluções, cada uma com suas próprias vantagens e desvantagens:

1. Fazer uma codificação rígida de uma chave pública de administrador que possa ser usada nas restrições de instruções exclusivas para administradores.
2. Fazer com que a autoridade de atualização do programa seja o administrador.
3. Armazenar o administrador na conta de configuração e definir o primeiro administrador em uma instrução `initialize`.

### Crie uma conta de configuração

A primeira etapa é adicionar o que chamaremos de conta de "configuração" ao seu programa. Você pode personalizar isso para atender melhor às suas necessidades, mas sugerimos um único PDA global. No Anchor, isso significa simplesmente criar uma struct de conta e usar uma única semente para derivar o endereço da conta.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

O exemplo acima mostra uma conta de configuração hipotética para o exemplo do programa de staking da NFT que mencionamos ao longo da lição. Ela armazena dados que representam o token que deve ser usado para recompensas e a quantidade de tokens a serem distribuídos por cada dia de staking.

Com a conta de configuração definida, basta garantir que o restante do seu código faça referência a essa conta ao usar esses valores. Dessa forma, se os dados da conta forem alterados, o programa se adaptará adequadamente.

### Restringir as atualizações de configuração a administradores com código rígido

Você precisará de uma maneira de inicializar e atualizar os dados da conta de configuração. Isso significa que você precisa ter uma ou mais instruções que somente um administrador possa invocar. A maneira mais simples de fazer isso é fazer um código rígido da chave pública de um administrador em seu código e, em seguida, adicionar uma verificação simples do signatário na validação da conta da instrução, comparando o signatário com essa chave pública.

No Anchor, restringir uma instrução `update_program_config` para que ela possa ser usada somente por um administrador codificado pode ter a seguinte aparência:

```rust
#[program]
mod my_program {
    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        reward_token: Pubkey,
        rewards_per_day: u64
    ) -> Result<()> {
        ctx.accounts.program_config.reward_token = reward_token;
        ctx.accounts.program_config.rewards_per_day = rewards_per_day;

        Ok(())
    }
}

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN_PUBKEY: Pubkey = pubkey!("ADMIN_WALLET_ADDRESS_HERE");

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == ADMIN_PUBKEY)]
    pub authority: Signer<'info>,
}
```

Antes mesmo de a lógica da instrução ser executada, será realizada uma verificação para garantir que o signatário da instrução corresponda ao `ADMIN_PUBKEY` codificado. Observe que o exemplo acima não mostra a instrução que inicializa a conta de configuração, mas ela deve ter restrições semelhantes para garantir que um invasor não possa inicializar a conta com valores inesperados.

Embora essa abordagem funcione, ela também significa manter o controle de uma carteira de administrador, além de manter o controle da autoridade de atualização de um programa. Com mais algumas linhas de código, você poderia simplesmente restringir uma instrução para que ela só pudesse ser chamada pela autoridade de atualização. A única parte complicada é obter a autoridade de atualização de um programa para poder fazer a comparação.

### Restringir as atualizações de configuração à autoridade de atualização do programa

Felizmente, todo programa tem uma conta de dados do programa que traduz o tipo de conta `ProgramData` do Anchor e tem o campo `upgrade_authority_address`. O próprio programa armazena o endereço dessa conta em seus dados no campo `programdata_address`.

Portanto, além das duas contas exigidas pela instrução no exemplo de codificação rígida do administrador, essa instrução exige as contas `program` e `program_data`.

Assim, as contas precisam da seguintes restrições:

1. Uma restrição no `program` que garante que a conta `program_data` fornecida corresponda ao campo `programdata_address` do programa.
2. Uma restrição na conta `program_data` que garante que o signatário da instrução corresponda ao campo `upgrade_authority_address` da conta `program_data`.

Quando concluído, o resultado é o seguinte:

```rust
...

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, MyProgram>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()))]
    pub program_data: Account<'info, ProgramData>,
    pub authority: Signer<'info>,
}
```

Novamente, o exemplo acima não mostra a instrução que inicializa a conta de configuração, mas ela deve ter as mesmas restrições para garantir que um invasor não possa inicializar a conta com valores inesperados.

Se esta é a primeira vez que você ouve falar sobre a conta de dados do programa, vale a pena ler [este documento Notion](https://www.notion.so/29780c48794c47308d5f138074dd9838) sobre implantações de programas.

### Restrinja as atualizações de configuração a um administrador fornecido

Ambas as opções anteriores são bastante seguras, mas também inflexíveis. E se você quiser atualizar o administrador como outra pessoa? Para isso, você pode armazenar o administrador na conta de configuração.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    admin: Pubkey,
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

Em seguida, você pode restringir suas instruções "update" com uma verificação de signatário que corresponda ao campo `admin` da conta de configuração.

```rust
...

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == program_config.admin)]
    pub authority: Signer<'info>,
}
```

Há um senão aqui: no período entre a implantação de um programa e a inicialização da conta de configuração, _não há administrador_. Isso significa que a instrução para inicializar a conta de configuração não pode ser restringida para permitir apenas administradores como chamadores. Isso significa que ela poderia ser chamada por um invasor que quisesse se definir como administrador.

Embora isso soe mal, na verdade significa apenas que você não deve tratar seu programa como "inicializado" até que você mesmo tenha inicializado a conta de configuração e verificado se o administrador listado na conta é quem você espera. Se o seu script de implantação for implantado e, em seguida, chamar imediatamente `initialize`, é muito improvável que um invasor esteja ciente da existência do seu programa, muito menos que esteja tentando se tornar o administrador. Se, por algum golpe de azar, alguém "interceptar" seu programa, você poderá fechar o programa com a autoridade de atualização e reimplantá-lo.

# Demonstração

Agora vamos experimentar isso juntos. Para esta demonstração, trabalharemos com um programa simples que permite pagamentos em USDC. O programa cobra uma pequena taxa para facilitar a transferência. Observe que isso é um pouco artificial, pois você pode fazer transferências diretas sem um contrato intermediário, mas simula o funcionamento de alguns programas DeFi complexos.

Ao testar nosso programa, descobriremos rapidamente que ele poderia se beneficiar da flexibilidade proporcionada por uma conta de configuração controlada pelo administrador e por alguns sinalizadores de funcionalidades.

### 1. Início

Faça o download do código inicial da branch `starter` deste [repositório](https://github.com/Unboxed-Software/solana-admin-instructions/tree/starter). O código contém um programa com uma única instrução e um único teste no diretório `tests`.

Vamos examinar rapidamente como o programa funciona.

O arquivo `lib.rs` inclui uma constante para o endereço USDC e uma única instrução `payment`. A instrução `payment` simplesmente chamou a função `payment_handler` no arquivo `instructions/payment.rs`, onde a lógica da instrução está contida.

O arquivo `instructions/payment.rs` contém tanto a função `payment_handler` quanto a estrutura de validação de conta `Payment` que representa as contas exigidas pela instrução `payment`. A função `payment_handler` calcula uma taxa de 1% do valor do pagamento, transfere a taxa para uma determinada conta de token e transfere o valor restante para o destinatário do pagamento.

Por fim, o diretório `tests` tem um único arquivo de teste, `config.ts`, que simplesmente invoca a instrução `payment` e afirma que os saldos das contas de token correspondentes foram debitados e creditados de acordo.

Antes de continuarmos, reserve alguns minutos para se familiarizar com esses arquivos e seus conteúdos.

### 2. Execute o teste existente

Vamos começar executando o teste existente.

Certifique-se de usar o `yarn` ou o `npm install` para instalar as dependências contidas no arquivo `package.json`. Em seguida, certifique-se de executar `anchor keys list` para que a chave pública do seu programa seja gravada no console. Isso difere de acordo com o par de chaves que você tem localmente, portanto, é necessário atualizar `lib.rs` e `Anchor.toml` para usar *sua* chave.

Por fim, execute `anchor test` para iniciar o teste. Ele deve falhar com a seguinte saída:

```
Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: incorrect program id for instruction
```

O motivo desse erro é que estamos tentando usar o endereço de cunhagem de USDC da rede principal (conforme código rígido no arquivo `lib.rs` do programa), mas essa cunhagem não existe no ambiente local.

### 3. Adicionando uma funcionalidade `local-testing`

Para corrigir isso, precisamos de uma cunhagen que possa ser usada localmente *e* com código rígido no programa. Como o ambiente local é redefinido com frequência durante os testes, você precisará armazenar um par de chaves que possa ser usado para recriar o mesmo endereço de cunhagem todas as vezes.

Além disso, você não quer ter que alterar o endereço codificado entre as compilações locais e da rede principal, pois isso pode introduzir erro humano (e é simplesmente irritante). Portanto, criaremos uma funcionalidade `local-testing` que, quando habilitada, fará com que o programa use nossa moeda local, mas, caso contrário, usará a moeda USDC de produção.

Gere um novo par de chaves executando o comando `solana-keygen grind`. Execute o seguinte comando para gerar um par de chaves com uma chave pública que comece com "env".

```
solana-keygen grind --starts-with env:1
```

Quando um par de chaves for encontrado, você verá um resultado semelhante ao seguinte:

```
Wrote keypair to env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json
```

O par de chaves é gravado em um arquivo em seu diretório de trabalho. Agora que temos um endereço USDC substituto, vamos modificar o arquivo `lib.rs`. Use o atributo `cfg` para definir a constante `USDC_MINT_PUBKEY`, dependendo do fato de a funcionalidade `local-testing` estar habilitada ou desabilitada. Lembre-se de definir a constante `USDC_MINT_PUBKEY` para `local-testing` com a constante gerada na etapa anterior em vez de copiar a constante abaixo.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("...");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

#[program]
pub mod config {
    use super::*;

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

Em seguida, adicione a funcionalidade `local-testing` ao arquivo `Cargo.toml` localizado em `/programs`.

```
[features]
...
local-testing = []
```

A seguir, atualize o arquivo de teste `config.ts` para criar uma cunhagem usando o par de chaves gerado. Comece excluindo a constate `mint`.

```typescript
const mint = new anchor.web3.PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
```

Em seguida, atualize o teste para criar uma cunhagem usando o par de chaves, o que nos permitirá reutilizar o mesmo endereço de cunhagem cada vez que os testes forem executados. Lembre-se de substituir o nome do arquivo pelo que foi gerado na etapa anterior.

```typescript
let mint: anchor.web3.PublicKey

before(async () => {
  let data = fs.readFileSync(
    "env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json"
  )

  let keypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(data))
  )

  const mint = await spl.createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    0,
    keypair
  )
...
```

Por fim, execute o teste com a funcionalidade `local-testing` habilitada.

```
anchor test -- --features "local-testing"
```

Você deverá ver o seguinte resultado:

```
config
  ✔ Payment completes successfully (406ms)


1 passing (3s)
```

Boom. Dessa forma, você usou funcionalidades para executar dois caminhos de código diferentes para ambientes diferentes.

### 4. Programe a configuração

As funcionalidades são ótimas para definir valores diferentes na compilação, mas e se você quisesse atualizar dinamicamente a porcentagem da taxa usada pelo programa? Vamos tornar isso possível criando uma conta Program Config que nos permita atualizar a taxa sem atualizar o programa.

Para começar, vamos primeiro atualizar o arquivo `lib.rs` para:

1. Incluir uma constante `SEED_PROGRAM_CONFIG`, que será usada para gerar o PDA para a conta de configuração do programa.
2. Incluir uma constante `ADMIN`, que será usada como uma restrição ao inicializar a conta de configuração do programa. Execute o comando `solana address` para obter seu endereço a ser usado como valor da constante.
3. Incluir um módulo `state` que será implementado em breve.
4. Incluir as instruções `initialize_program_config` e `update_program_config` e as chamadas para seus "manipuladores", que serão implementados em outra etapa.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
mod state;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("envgiPXWwmpkHFKdy4QLv2cypgAWmVTVEm71YbNpYRu");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN: Pubkey = pubkey!("...");

#[program]
pub mod config {
    use super::*;

    pub fn initialize_program_config(ctx: Context<InitializeProgramConfig>) -> Result<()> {
        instructions::initialize_program_config_handler(ctx)
    }

    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        new_fee: u64,
    ) -> Result<()> {
        instructions::update_program_config_handler(ctx, new_fee)
    }

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

### 5. Programe o estado de configuração

Em seguida, vamos definir a estrutura para o estado `ProgramConfig`. Essa conta armazenará o administrador, a conta de token para a qual as taxas são enviadas e o valor da taxa. Também especificaremos o número de bytes necessários para armazenar essa estrutura.

Crie um novo arquivo chamado `state.rs` no diretório `/src` e adicione o seguinte código.

```rust
use anchor_lang::prelude::*;

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_basis_points: u64,
}

impl ProgramConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8;
}
```

### 6. Adicione Instrução de Inicialização de Conta de Configuração do Programa

Agora vamos criar a lógica de instrução para inicializar a conta de configuração do programa. Ela só deve poder ser chamada por uma transação assinada pela chave `ADMIN` e deve definir todas as propriedades da conta `ProgramConfig`.

Crie uma pasta chamada `program_config` no caminho `/src/instructions/program_config`. Essa pasta armazenará todas as instruções relacionadas à conta de configuração do programa.

Na pasta `program_config`, crie um arquivo chamado `initialize_program_config.rs` e adicione o seguinte código.

```rust
use crate::state::ProgramConfig;
use crate::ADMIN;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct InitializeProgramConfig<'info> {
    #[account(init, seeds = [SEED_PROGRAM_CONFIG], bump, payer = authority, space = ProgramConfig::LEN)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(mut, address = ADMIN)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_program_config_handler(ctx: Context<InitializeProgramConfig>) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.authority.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = 100;
    Ok(())
}
```

### 7. Adicione Instrução de Atualização de Taxa de Configuração do Programa

Em seguida, implemente a lógica de instrução para atualizar a conta de configuração. A instrução deve exigir que o signatário corresponda ao `admin` armazenado na conta `program_config`.

Na pasta `program_config`, crie um arquivo chamado `update_program_config.rs` e adicione o seguinte código.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = [SEED_PROGRAM_CONFIG], bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = program_config.admin,
    )]
    pub admin: Signer<'info>,
    /// CHECAR: atribuído arbitrariamente pelo administrador existente
    pub new_admin: UncheckedAccount<'info>,
}

pub fn update_program_config_handler(
    ctx: Context<UpdateProgramConfig>,
    new_fee: u64,
) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.new_admin.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = new_fee;
    Ok(())
}
```

### 8. Adicione o mod.rs e atualize o instructions.rs

Em seguida, vamos expor os manipuladores de instruções que criamos para que a chamada do `lib.rs` não apresente um erro. Comece adicionando um arquivo `mod.rs` na pasta `program_config`. Adicione o código abaixo para tornar acessíveis os dois módulos, `initialize_program_config` e `update_program_config`.

```rust
mod initialize_program_config;
pub use initialize_program_config::*;

mod update_program_config;
pub use update_program_config::*;
```

Agora, atualize o `instructions.rs` no caminho `/src/instructions.rs`. Adicione o código abaixo para tornar acessíveis os dois módulos, `program_config` e `payment`.

```rust
mod program_config;
pub use program_config::*;

mod payment;
pub use payment::*;
```

### 9. Atualize a Instrução Payment (de pagamento)

Por fim, vamos atualizar a instrução de pagamento para verificar se a conta `fee_destination` na instrução corresponde à `fee_destination` armazenada na conta de configuração do programa. Em seguida, atualize o cálculo da taxa da instrução para que seja baseado no `fee_basis_point` armazenado na conta de configuração do programa.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(
        seeds = [SEED_PROGRAM_CONFIG],
        bump,
        has_one = fee_destination
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub receiver_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub sender: Signer<'info>,
}

pub fn payment_handler(ctx: Context<Payment>, amount: u64) -> Result<()> {
    let fee_amount = amount
        .checked_mul(ctx.accounts.program_config.fee_basis_points)
        .unwrap()
        .checked_div(10000)
        .unwrap();
    let remaining_amount = amount.checked_sub(fee_amount).unwrap();

    msg!("Amount: {}", amount);
    msg!("Fee Amount: {}", fee_amount);
    msg!("Remaining Transfer Amount: {}", remaining_amount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.fee_destination.to_account_info(),
            },
        ),
        fee_amount,
    )?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.receiver_token_account.to_account_info(),
            },
        ),
        remaining_amount,
    )?;

    Ok(())
}
```

### 10. Teste

Agora que terminamos de implementar nossa nova struct de configuração do programa e as instruções, vamos testar nosso programa atualizado. Para começar, adicione o PDA da conta de configuração do programa ao arquivo de teste.

```typescript
describe("config", () => {
  ...
  const programConfig = findProgramAddressSync(
    [Buffer.from("program_config")],
    program.programId
  )[0]
...
```

Em seguida, atualize o arquivo de teste com mais três testes que comprovem que:

1. A conta de configuração do programa está inicializada corretamente
2. A instrução de pagamento está funcionando como pretendido
3. A conta de configuração pode ser atualizada com êxito pelo administrador
4. A conta de configuração não pode ser atualizada por outra pessoa que não seja o administrador

O primeiro teste inicializa a conta de configuração do programa e verifica se a taxa correta está definida e se o administrador correto está armazenado na conta de configuração do programa.

```typescript
it("Initialize Program Config Account", async () => {
  const tx = await program.methods
    .initializeProgramConfig()
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      authority: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    100
  )
  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).admin.toString(),
    wallet.publicKey.toString()
  )
})
```

O segundo teste verifica se a instrução de pagamento está funcionando corretamente, com a taxa sendo enviada para o destino da taxa e o saldo restante sendo transferido para o destinatário. Aqui, atualizamos o teste existente para incluir a conta `programConfig`.

```typescript
it("Payment completes successfully", async () => {
  const tx = await program.methods
    .payment(new anchor.BN(10000))
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      senderTokenAccount: senderTokenAccount,
      receiverTokenAccount: receiverTokenAccount,
      sender: sender.publicKey,
    })
    .transaction()

  await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])

  assert.strictEqual(
    (await connection.getTokenAccountBalance(senderTokenAccount)).value
      .uiAmount,
    0
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(feeDestination)).value.uiAmount,
    100
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(receiverTokenAccount)).value
      .uiAmount,
    9900
  )
})
```

O terceiro teste tenta atualizar a taxa na conta de configuração do programa, o que deve ser bem-sucedido.

```typescript
it("Update Program Config Account", async () => {
  const tx = await program.methods
    .updateProgramConfig(new anchor.BN(200))
    .accounts({
      programConfig: programConfig,
      admin: wallet.publicKey,
      feeDestination: feeDestination,
      newAdmin: sender.publicKey,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    200
  )
})
```

O quarto teste tenta atualizar a taxa na conta de configuração do programa, onde o administrador não é o que está armazenado na conta de configuração do programa, e isso deve falhar.

```typescript
it("Update Program Config Account with unauthorized admin (expect fail)", async () => {
  try {
    const tx = await program.methods
      .updateProgramConfig(new anchor.BN(300))
      .accounts({
        programConfig: programConfig,
        admin: sender.publicKey,
        feeDestination: feeDestination,
        newAdmin: sender.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])
  } catch (err) {
    expect(err)
  }
})
```

Por fim, execute o teste usando o seguinte comando:

```
anchor test -- --features "local-testing"
```

Você deve ver o seguinte resultado:

```
config
  ✔ Initialize Program Config Account (199ms)
  ✔ Payment completes successfully (405ms)
  ✔ Update Program Config Account (403ms)
  ✔ Update Program Config Account with unauthorized admin (expect fail)

4 passing (8s)
```

E é isso! Você tornou o programa muito mais fácil de trabalhar daqui para frente. Se quiser dar uma olhada no código da solução final, poderá encontrá-lo na branch `solution` do [mesmo repositório](https://github.com/Unboxed-Software/solana-admin-instructions/tree/solution).

# Desafio

Agora é hora de você fazer algumas dessas coisas por conta própria. Mencionamos a possibilidade de usar a autoridade de atualização do programa como administrador inicial.  Vá em frente e atualize o `initialize_program_config` da demonstração para que somente a autoridade de atualização possa chamá-lo em vez de ter um `ADMIN` com código rígido.

Observe que o comando `anchor test`, quando executado em uma rede local, inicia um novo validador de teste usando o `solana-test-validator`. Esse validador de teste usa um carregador não atualizável. O carregador não atualizável faz com que a conta `program_data` do programa não seja inicializada quando o validador é iniciado. Você deve se lembrar, da lição, que essa conta é a forma como acessamos a autoridade de atualização do programa.

Para contornar isso, você pode adicionar uma função `deploy` ao arquivo de teste que executa o comando de implantação do programa com um carregador atualizável. Para usá-la, execute `anchor test --skip-deploy` e chame a função `deploy` dentro do teste para executar o comando de implantação depois que o validador de teste for iniciado.

```typescript
import { execSync } from "child_process"

...

const deploy = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/config-keypair.json $(pwd)/target/deploy/config.so`
  execSync(deployCmd)
}

...

before(async () => {
  ...
  deploy()
})
```

Por exemplo, o comando para executar o teste com funcionalidades seria o seguinte:

```
anchor test --skip-deploy -- --features "local-testing"
```

Tente fazer isso por conta própria, mas, se você travar, sinta-se à vontade para consultar a branch `challenge` do [mesmo repositório](https://github.com/Unboxed-Software/solana-admin-instructions/tree/challenge) para ver uma solução possível.

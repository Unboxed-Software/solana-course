---
title: Funções de Aleatoriedade Verificáveis
objectives:
- Explicar as limitações da geração de números aleatórios onchain
- Explicar como funciona a Aleatoriedade Verificável
- Usar a fila de oráculos VRF do Switchboard para gerar e consumir aleatoriedade de um programa onchain
---

# Resumo

- Tentativas de gerar aleatoriedade em seu programa são provavelmente previsíveis pelos usuários, já que não existe verdadeira aleatoriedade onchain.
- Funções de Aleatoriedade Verificáveis (Verifiable Random Functions, ou VRFs) oferecem aos desenvolvedores a oportunidade de incorporar números aleatórios seguros em seus programas onchain.
- Uma VRF é uma função pseudoaleatória de chave pública que fornece provas de que seus resultados foram calculados corretamente.
- O Switchboard oferece uma VRF amigável para desenvolvedores no ecossistema Solana.

# Visão Geral

## Aleatoriedade On-Chain

Números aleatórios ***não*** são nativamente permitidos na blockchain. Isso se deve ao fato de que Solana é determinística, cada validador executa seu código e precisa ter o mesmo resultado. Então, se você quisesse criar um programa de rifa, teria que procurar fora da blockchain por sua aleatoriedade. É aí que entram as Funções de Aleatoriedade Verificáveis (VRFs). As VRFs oferecem aos desenvolvedores um meio seguro de integrar aleatoriedade na cadeia de maneira descentralizada.

## Tipos de Aleatoriedade

Antes de mergulharmos em como os números aleatórios podem ser gerados para uma blockchain, devemos primeiro entender como eles são gerados em sistemas de computador tradicionais. Existem realmente dois tipos de números aleatórios: *verdadeiramente aleatórios* e *pseudoaleatórios*. A diferença entre os dois está em como os números são gerados.

Computadores podem adquirir números *verdadeiramente aleatórios* ao tomar algum tipo de medição física do mundo externo como entropia. Essas medições aproveitam fenômenos naturais, como ruído eletrônico, decaimento radioativo ou ruído atmosférico, para gerar dados aleatórios. Como esses processos são intrinsecamente imprevisíveis, os números que produzem são genuinamente aleatórios e não reprodutíveis.

Números *pseudoaleatórios*, por outro lado, são gerados por algoritmos que usam um processo determinístico para produzir sequências de números que parecem ser aleatórios. Geradores de números pseudoaleatórios (PRNGs) começam com um valor inicial chamado semente e depois usam fórmulas matemáticas para gerar números subsequentes na sequência. Dada a mesma semente, um PRNG sempre produzirá a mesma sequência de números. É importante semear com algo próximo à verdadeira entropia: uma entrada "aleatória" fornecida pelo administrador, o último log do sistema, alguma combinação do tempo do relógio do seu sistema e outros fatores, etc. Fato curioso: vídeo games antigos foram quebrados porque os speedrunners descobriram como sua aleatoriedade era calculada. Um jogo em particular usou o número de passos dados no jogo como semente.

Infelizmente, nenhum tipo de aleatoriedade é nativamente disponível em programas Solana, porque esses programas têm que ser determinísticos. Todos os validadores precisam chegar à mesma conclusão. Não há como todos eles tirarem o mesmo número aleatório, e se usassem uma semente, seria propenso a ataques. Veja as [FAQs da Solana](https://docs.solana.com/developing/onchain-programs/developing-rust#depending-on-rand) para mais informações. Então, teremos que procurar fora da blockchain por aleatoriedade com VRFs.

## O que é Aleatoriedade Verificável?

Uma Função de Aleatoriedade Verificável (VRF) é uma função pseudoaleatória de chave pública que fornece provas de que seus resultados foram calculados corretamente. Isso significa que podemos usar um par de chaves criptográficas para gerar um número aleatório com uma prova, que pode então ser validada por qualquer pessoa para garantir que o valor foi calculado corretamente sem a possibilidade de vazar a chave secreta do produtor. Uma vez validado, o valor aleatório é armazenado em uma conta na blockchain.

As VRFs são um componente crucial para alcançar aleatoriedade verificável e imprevisível em uma blockchain, abordando algumas das limitações dos PRNGs tradicionais e os desafios de alcançar verdadeira aleatoriedade em um sistema descentralizado.

Existem três propriedades-chave de uma VRF:

1. **Determinismo** - Uma VRF recebe uma chave secreta e um nonce como entradas e produz deterministicamente uma saída (semeadura). O resultado é um valor aparentemente aleatório. Dada a mesma chave secreta e nonce, a VRF sempre produzirá a mesma saída. Esta propriedade garante que o valor aleatório possa ser reproduzido e verificado por qualquer pessoa.
2. **Imprevisibilidade** - A saída de uma VRF parece indistinguível da verdadeira aleatoriedade para qualquer pessoa sem acesso à chave secreta. Esta propriedade garante que, embora a VRF seja determinística, você não pode prever o resultado com antecedência sem conhecimento das entradas.
3. **Verificabilidade** - Qualquer pessoa pode verificar a validade do valor aleatório gerado por uma VRF usando a chave secreta e o nonce correspondentes.

As VRFs não são específicas para Solana e foram utilizadas em outros blockchains para gerar números pseudoaleatórios. Felizmente, o Switchboard oferece sua implementação de VRF para Solana.

## Implementação de VRF do Switchboard

O Switchboard é uma rede de oráculos descentralizada que oferece VRFs na Solana. Oráculos são serviços que fornecem dados externos para uma blockchain, permitindo que eles interajam e respondam a eventos do mundo real. A rede Switchboard é composta por muitos oráculos individuais diferentes executados por terceiros para fornecer dados externos e solicitações de serviço onchain. Para saber mais sobre a rede de Oráculos do Switchboard, consulte nossa [lição sobre Oráculos](./oracles.md).

A VRF do Switchboard permite que os usuários solicitem a um oráculo a produção de uma saída de aleatoriedade na cadeia. Uma vez que um oráculo foi atribuído à solicitação, a prova do resultado da VRF deve ser verificada onchain antes de poder ser usada. A prova de VRF leva 276 instruções (~48 transações) para ser totalmente verificada onchain. Uma vez que a prova é verificada, o programa Switchboard executará um callback onchain definido pela Conta VRF durante a criação da conta. A partir daí, o programa pode consumir os dados aleatórios.

Você pode estar se perguntando como eles são pagos. Na implementação de VRF do Switchboard, você paga por cada solicitação.

## Solicitando e Consumindo uma VRF

Agora que sabemos o que é uma VRF e como ela se encaixa na rede de oráculos do Switchboard, vamos dar uma olhada mais de perto em como realmente solicitar e consumir aleatoriedade de um programa Solana. Em alto nível, o processo para solicitar e consumir aleatoriedade do Switchboard é assim:

1. Crie um PDA `programAuthority` que será usado como autoridade do programa e assinará em nome do programa.
2. Crie uma Conta VRF do Switchboard com o `programAuthority` como `autoridade` e especifique a função `callback` para a qual a VRF retornará os dados.
3. Invoque a instrução `request_randomness` no programa Switchboard. O programa atribuirá um oráculo à nossa solicitação de VRF.
4. O oráculo atende à solicitação e responde ao programa Switchboard com a prova calculada usando sua chave secreta.
5. O oráculo executa as 276 instruções para verificar a prova de VRF.
6. Uma vez que a prova de VRF é verificada, o programa Switchboard invocará o `callback` que foi passado como o callback na solicitação inicial com o número pseudoaleatório retornado pelo Oráculo.
7. O programa consome o número aleatório e pode executar a lógica de negócios com ele!


Há muitas etapas aqui, mas não se preocupe, vamos passar por cada etapa do processo em detalhes.

Primeiro, há algumas contas que teremos que criar nós mesmos para solicitar aleatoriedade, especificamente as contas `authority` e `vrf`. A conta `authority` é um PDA derivado do nosso programa que está solicitando a aleatoriedade. Então, o PDA que criamos terá nossas próprias sementes para nossas próprias necessidades. Por enquanto, vamos simplesmente defini-las como `VRFAUTH`.

```tsx
// derivar o PDA
[vrfAuthorityKey, vrfAuthoritySecret] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("VRFAUTH")],
    program.programId
  )
```

Então, precisamos inicializar uma conta `vrf`, que é propriedade do programa Switchboard, e marcar o PDA que acabamos de derivar como sua autoridade. A conta `vrf` tem a seguinte estrutura de dados.

```rust
pub struct VrfAccountData {
    /// O status atual da conta VRF.
    pub status: VrfStatus,
    /// Contador incremental para rastrear rodadas VRF.
    pub counter: u128,
    /// Conta onchain delegada para fazer alterações na conta. <-- Esta é a nossa PDA
    pub authority: Pubkey,
    /// O OracleQueueAccountData que é atribuído para atender à solicitação de atualização VRF.
    pub oracle_queue: Pubkey,
    /// A conta de token usada para manter fundos para a solicitação de atualização VRF.
    pub escrow: Pubkey,
    /// O callback que é invocado quando uma solicitação de atualização é verificada com sucesso.
    pub callback: CallbackZC,
    /// O número de oráculos atribuídos a uma solicitação de atualização VRF.
    pub batch_size: u32,
    /// Struct contendo o estado intermediário entre as ações de acionamento da VRF.
    pub builders: [VrfBuilder; 8],
    /// O número de construtores.
    pub builders_len: u32,
    pub test_mode: bool,
    /// Resultados do oráculo da rodada atual da solicitação de atualização que ainda não foi aceita como válida
    pub current_round: VrfRound,
    /// Reservado para informações futuras.
    pub _ebuf: [u8; 1024],
}
```

Alguns campos importantes nesta conta são `authority`, `oracle_queue` e `callback`. O `authority` deve ser um PDA do programa que tem a capacidade de solicitar aleatoriedade nesta conta `vrf`. Dessa forma, apenas esse programa pode fornecer a assinatura necessária para a solicitação vrf. O campo `oracle_queue` permite especificar qual fila de oráculo específica você gostaria de atender às solicitações vrf feitas com esta conta. Se você não está familiarizado com filas de oráculos no Switchboard, confira a [lição sobre Oráculos neste módulo](./oracles.md)! Por último, o campo `callback` é onde você define a instrução de retorno que o programa Switchboard deve invocar uma vez que o resultado da aleatoriedade tenha sido verificado.

O campo `callback` é do tipo `[CallbackZC](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/ecvrf.rs#L25)`.

```rust
#[zero_copy(unsafe)]
#[repr(packed)]
pub struct CallbackZC {
    /// O ID do programa do programa de callback que está sendo invocado.
    pub program_id: Pubkey,
    /// As contas sendo usadas na instrução de callback.
    pub accounts: [AccountMetaZC; 32],
    /// O número de contas usadas no callback.
    pub accounts_len: u32,
    /// Os dados de instrução serializados.
    pub ix_data: [u8; 1024],
    /// O número de bytes serializados nos dados da instrução.
    pub ix_data_len: u32,
}
```

Assim é como você define a estrutura Callback do lado do cliente.

```tsx
// exemplo
import Callback from '@switchboard-xyz/solana.js'
...
...

const vrfCallback: Callback = {
      programId: program.programId,
      accounts: [
        // garanta que todas as contas em consumeRandomness estejam preenchidas
        { pubkey: clientState, isSigner: false, isWritable: true },
        { pubkey: vrfClientKey, isSigner: false, isWritable: true },
        { pubkey: vrfSecret.publicKey, isSigner: false, isWritable: true },
      ],
			// use o nome da instrução
      ixData: vrfIxCoder.encode("consumeRandomness", ""), // passe quaisquer parâmetros para a instrução aqui
    }
```

Agora, você pode criar a conta `vrf`.

```tsx
// Criar conta VRF do Switchboard
  [vrfAccount] = await switchboard.queue.createVrf({
    callback: vrfCallback,
    authority: vrfAuthorityKey, // autoridade vrf
    vrfKeypair: vrfSecret,
    enable: !queue.unpermissionedVrfEnabled, // apenas define permissões se necessário
  })
```

Agora que temos todas as nossas contas necessárias, finalmente podemos chamar a instrução `request_randomness` no programa Switchboard. É importante notar que você pode invocar a `request_randomness` em um cliente ou dentro de um programa com uma Invocação Cruzada de Programa (CPI). Vamos dar uma olhada nas contas necessárias para este pedido, verificando a definição da estrutura de Conta no próprio [programa Switchboard](https://github.com/switchboard-xyz/solana-sdk/blob/fbef37e4a78cbd8b8b6346fcb96af1e20204b861/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs#L8).

```rust
// do programa Switchboard
// https://github.com/switchboard-xyz/solana-sdk/blob/fbef37e4a78cbd8b8b6346fcb96af1e20204b861/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs#L8

pub struct VrfRequestRandomness<'info> {
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    #[account(mut)]
    pub vrf: AccountInfo<'info>,
    #[account(mut)]
    pub oracle_queue: AccountInfo<'info>,
    pub queue_authority: AccountInfo<'info>,
    pub data_buffer: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [
            b"PermissionAccountData",
            queue_authority.key().as_ref(),
            oracle_queue.key().as_ref(),
            vrf.key().as_ref()
        ],
        bump = params.permission_bump
    )]
    pub permission: AccountInfo<'info>,
    #[account(mut, constraint = escrow.owner == program_state.key())]
    pub escrow: Account<'info, TokenAccount>,
    #[account(mut, constraint = payer_wallet.owner == payer_authority.key())]
    pub payer_wallet: Account<'info, TokenAccount>,
    #[account(signer)]
    pub payer_authority: AccountInfo<'info>,
    pub recent_blockhashes: AccountInfo<'info>,
    #[account(seeds = [b"STATE"], bump = params.state_bump)]
    pub program_state: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}
```

São muitas contas, vamos passar por cada uma e dar algum contexto.

- `authority` - PDA derivado do nosso programa
- `vrf` - [Conta de propriedade do programa Switchboard](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/vrf/struct.VrfAccountData.html)
- `oracle_queue` - [Conta de propriedade do programa Switchboard que contém metadados sobre a fila de oráculos a ser usada para este pedido](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/queue/struct.OracleQueueAccountData.html)
- `queue_authority` - Autoridade da Fila de Oráculos escolhida
- [`data_buffer`](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/queue.rs#L57C165-L57C165) - Conta da conta `OracleQueueBuffer` contendo uma coleção de chaves públicas de Oráculos que foram detectadas com sucesso antes que a configuração `oracleTimeout` da fila expirasse. Armazenado na conta da Fila de Oráculos.
- [`permission`](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/permission/struct.PermissionAccountData.html) - Dados da Conta de Permissão
- `escrow` - Conta de custódia de Token do Switchboard
- `program_state` - Conta de estado do programa Switchboard, [do tipo `SbState`](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/sb_state/struct.SbState.html)
- `switchboard_program` - Programa Switchboard
- `payer_wallet` - Conta de Token do Pagador, será usada para pagar taxas
- `payer_authority` - Autoridade da Conta de Token do Pagador
- `recent_blockhashes` - [Programa Solana de hashes de bloco recentes](https://docs.rs/solana-program/latest/solana_program/sysvar/recent_blockhashes/index.html)
- `token_program` - Programa de Token da Solana

Essas são todas as contas necessárias apenas para o pedido de aleatoriedade, agora vamos ver como isso fica em um programa Solana via CPI. Para fazer isso, usamos a estrutura de dados `VrfRequestRandomness` do [crate rust SwitchboardV2.](https://github.com/switchboard-xyz/solana-sdk/blob/main/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs) Esta estrutura tem algumas capacidades integradas para facilitar nossas vidas aqui, mais notavelmente a estrutura da conta é definida para nós e podemos facilmente chamar `invoke` ou `invoke_signed` no objeto.

```rust
// nosso programa cliente
use switchboard_v2::VrfRequestRandomness;
use state::*;

pub fn request_randomness(ctx: Context<RequestRandomness>, request_params: RequestRandomnessParams) -> Result <()> {
	let switchboard_program = ctx.accounts.switchboard_program.to_account_info();
	
	let vrf_request_randomness = VrfRequestRandomness {
	    authority: ctx.accounts.vrf_state.to_account_info(),
	    vrf: ctx.accounts.vrf.to_account_info(),
	    oracle_queue: ctx.accounts.oracle_queue.to_account_info(),
	    queue_authority: ctx.accounts.queue_authority.to_account_info(),
	    data_buffer: ctx.accounts.data_buffer.to_account_info(),
	    permission: ctx.accounts.permission.to_account_info(),
	    escrow: ctx.accounts.switchboard_escrow.clone(),
	    payer_wallet: ctx.accounts.payer_wallet.clone(),
	    payer_authority: ctx.accounts.user.to_account_info(),
	    recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
	    program_state: ctx.accounts.program_state.to_account_info(),
	    token_program: ctx.accounts.token_program.to_account_info(),
	};
	
	msg!("requisitando aleatoriedade");
	vrf_request_randomness.invoke_signed(
	    switchboard_program,
	    request_params.switchboard_state_bump,
	    request_params.permission_bump,
	    state_seeds,
	)?;

...

Ok(())

}
```

Uma vez que o programa Switchboard é invocado, ele faz alguma lógica e atribui um oráculo na fila de oráculos definida na conta `vrf` para atender à solicitação de aleatoriedade. O oráculo atribuído calcula um valor aleatório e o envia de volta para o programa Switchboard.

Quando o resultado for verificado, o programa Switchboard então invoca a instrução de `callback` definida na conta `vrf`. A instrução de retorno é onde você teria escrito sua lógica de negócios usando os números aleatórios. No código a seguir, armazenamos a aleatoriedade resultante em nosso PDA `vrf_auth` do nosso primeiro passo.

```rust
// nosso programa cliente

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    // estado do cliente vrf
    #[account]
    pub vrf_auth: AccountLoader<'info, VrfClientState>,
    // conta vrf do switchboard
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_auth.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>
}

pub fn handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Consumindo aleatoriedade!");

		// carregar os dados da conta vrf
    let vrf = ctx.accounts.vrf.load()?;
		// usar o método get_result para buscar os resultados de aleatoriedade
    let result_buffer = vrf.get_result()?;

		// verificar se o buffer de resultado está todo em 0's
    if result_buffer == [0u8; 32] {
        msg!("buffer vrf vazio");
        return Ok(());
    }

    msg!("O buffer de resultado é {:?}", result_buffer);
		// usar o valor aleatório como achar melhor

    Ok(())
}
```

Agora você tem aleatoriedade! Uhu! Mas há uma última coisa sobre a qual ainda não falamos e é como a aleatoriedade é retornada. O Switchboard lhe dá sua aleatoriedade chamando `[get_result()](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/vrf.rs#L122)`. Este método retorna o campo `current_round.result` da conta `vrf` no formato SwitchboardDecimal, que é realmente apenas um buffer de 32 números inteiros sem sinal aleatórios `[u8](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/ecvrf.rs#L65C26-L65C26)`. Você pode usar esses inteiros sem sinal da maneira que achar melhor em seu programa, mas um método muito comum é tratar cada inteiro no buffer como seu próprio número aleatório. Por exemplo, se você precisar de uma rolagem de dados (1-6), basta pegar o primeiro byte do array, aplicar o módulo com 6 e adicionar um.

```rust
// divide o buffer de bytes para armazenar o primeiro valor
let dice_roll = (result_buffer[0] % 6) + 1;
```

O que você faz com os valores aleatórios a partir daí é completamente com você!

Essa é a essência de solicitar aleatoriedade com uma VRF do Switchboard. Para recapitular os passos envolvidos em um pedido de VRF, reveja este diagrama.

![Diagrama VRF](../../assets/vrf-diagram.png)

# Demonstração

Para a demonstração desta lição, continuaremos de onde paramos na [lição sobre Oráculos](./oracle.md). Se você não completou a lição e a demonstração sobre Oráculos, recomendamos fortemente que o faça, pois há muitos conceitos sobrepostos e começaremos a partir da base de código da lição sobre Oráculos.

Se você não quiser completar a lição sobre Oráculos, o código inicial para esta demonstração é fornecido para você no [repositório Github da demonstração na branch principal](https://github.com/Unboxed-Software/michael-burry-escrow).

O repositório contém um programa de custódia "Michael Burry". Este é um programa que permite a um usuário bloquear alguns fundos da Solana em custódia que não podem ser retirados até que o SOL atinja um preço pré-definido em USD, escolhido pelo usuário. Vamos adicionar a funcionalidade VRF a este programa para permitir que o usuário "saia da prisão" jogando dados duplos. Nossa demonstração hoje permitirá que o usuário role dois dados virtuais. Se ele rolar duplos (os dois dados combinarem), o usuário poderá retirar seus fundos da custódia independentemente do preço do SOL.

### 1. Configuração do Programa

Se você está clonando o repositório da lição anterior, certifique-se de fazer o seguinte:

1. `git clone [https://github.com/Unboxed-Software/michael-burry-escrow](https://github.com/Unboxed-Software/michael-burry-escrow)`
2. `cd michael-burry-escrow`
3. `anchor build`
4. `anchor keys list`
    1. Pegue a chave resultante e coloque-a em `Anchor.toml` e `programs/burry-escrow/src/lib.rs`
5. `solana config get`
    1. Pegue seu **Caminho do Par de Chaves** e altere o campo `wallet` no seu `Anchor.toml`
6. `yarn install`
7. `anchor test`

Quando todos os testes passarem, estamos prontos para começar. Vamos começar preenchendo algumas coisas de rotina, e então implementaremos as funções.

### 2. Cargo.toml

Primeiro, já que a VRF usa tokens SPL para suas taxas, precisamos importar `anchor-spl` no nosso arquivo `Cargo.toml`.

```tsx
[dependencies]
anchor-lang = "0.28.0"
anchor-spl = "0.28.0"
switchboard-v2 = "0.4.0"
```

### 3. Lib.rs

Em seguida, vamos editar `lib.rs` e adicionar as funções adicionais que construiremos hoje. As funções são as seguintes:
- `init_vrf_client` - Cria o PDA de autoridade VRF, que assinará e consumirá a aleatoriedade.
- `get_out_of_jail` - Solicita a aleatoriedade da VRF, efetivamente jogando os dados.
- `consume_randomness` - A função de callback para a VRF onde verificaremos os resultados dos dados.

```rust
use anchor_lang::prelude::*;
use instructions::deposit::*;
use instructions::withdraw::*;
use instructions::init_vrf_client::*;
use instructions::get_out_of_jail::*;
use instructions::consume_randomness::*;

pub mod instructions;
pub mod state;
pub mod errors;

declare_id!("SUA_CHAVE_AQUI");

#[program]
mod burry_escrow {

    use crate::instructions::init_vrf_client::init_vrf_client_handler;

    use super::*;

    pub fn deposit(ctx: Context<Deposit>, escrow_amt: u64, unlock_price: f64) -> Result<()> {
        deposit_handler(ctx, escrow_amt, unlock_price)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        withdraw_handler(ctx)
    }

    pub fn init_vrf_client(ctx: Context<InitVrfClient>) -> Result<()>{
        init_vrf_client_handler(ctx)
    }

		pub fn get_out_of_jail(ctx: Context<RequestRandomness>, params: RequestRandomnessParams) -> Result<()>{
        get_out_of_jail_handler(ctx, params)
    }

    pub fn consume_randomness(ctx: Context<ConsumeRandomness>) -> Result<()>{
        consume_randomness_handler(ctx)
    }
}
```

Certifique-se de substituir `SUA_CHAVE_AQUI` pela sua própria chave do programa.

### 4. State.rs

Em seguida, em `state.rs`, adicione uma flag `out_of_jail` ao `EscrowState`. Quando finalmente rolarmos dois dados iguais, vamos ativar esta flag. Quando a função `withdraw` for chamada, podemos transferir os fundos sem verificar o preço.

```rust
// state.rs
#[account]
pub struct EscrowState {
    pub unlock_price: f64,
    pub escrow_amount: u64,
    pub out_of_jail: bool
}
```

Depois, crie nossa segunda conta de dados para este programa: `VrfClientState`. Isso manterá o estado de nossas jogadas de dados. Ela terá os seguintes campos:

- `bump` - Armazena o salto (bump) da conta para facilitar a assinatura posteriormente.
- `result_buffer` - Aqui a VRF despejará os dados de aleatoriedade brutos.
- `dice_type` - Definiremos isso como 6, como em um dado de seis lados.
- `die_result_1` e `die_result_2` - Os resultados de nossa jogada de dados.
- `timestamp` - Mantém o controle de quando foi nossa última jogada.
- `vrf` - Chave pública da conta VRF; propriedade do programa Switchboard. Criaremos isso antes de chamar a função de inicialização do `VrfClientState`.
- `escrow` - Chave pública da nossa conta de custódia Michael Burry.

Também vamos fazer com que o contexto de `VrfClientState` seja uma estrutura `zero_copy`. Isso significa que a inicializaremos com `load_init()` e a passaremos para as contas com `AccountLoader`. Fazemos isso porque as funções VRF são muito intensivas em contas e precisamos ser cuidadosos com a memória stack. Se você deseja saber mais sobre `zero_copy`, dê uma olhada na nossa [lição sobre Arquitetura de Programa](./program-architecture.md).

```rust
// state.rs

#[repr(packed)]
#[account(zero_copy(unsafe))]
#[derive(Default)]
pub struct VrfClientState {
    pub bump: u8,
    pub result_buffer: [u8; 32],
		pub dice_type: u8, // 6 lados
    pub die_result_1: u8,
    pub die_result_2: u8,
    pub timestamp: i64,
    pub vrf: Pubkey,
    pub escrow: Pubkey
}
```



Por último, vamos adicionar o `VRF_STATE_SEED` à nossa conta PDA do cliente VRF.

```rust
pub const VRF_STATE_SEED: &[u8] = b"VRFCLIENT";
```

Seu arquivo `state.rs` deve ficar assim:

```rust
use anchor_lang::prelude::*;

pub const ESCROW_SEED: &[u8] = b"MICHAEL BURRY";
pub const VRF_STATE_SEED: &[u8] = b"VRFCLIENT";
pub const SOL_USDC_FEED: &str = "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR";

#[account]
pub struct EscrowState {
    pub unlock_price: f64,
    pub escrow_amount: u64,
    pub out_of_jail: bool
}

#[repr(packed)]
#[account(zero_copy(unsafe))]
#[derive(Default)]
pub struct VrfClientState {
    pub bump: u8,
    pub result_buffer: [u8; 32],
		pub dice_type: u8, // 6 lados
    pub die_result_1: u8,
    pub die_result_2: u8,
    pub timestamp: i64,
    pub vrf: Pubkey,
    pub escrow: Pubkey
}
```

### 5. Errors.rs

Em seguida, vamos fazer uma rápida parada e adicionar um último erro `InvalidVrfAuthorityError` ao `errors.rs`. Usaremos isso quando a autoridade VRF estiver incorreta.

```rust
use anchor_lang::prelude::*;

#[error_code]
#[derive(Eq, PartialEq)]
pub enum EscrowErrorCode {
    #[msg("Não é uma conta válida do Switchboard")]
    InvalidSwitchboardAccount,
    #[msg("O feed do Switchboard não foi atualizado nos últimos 5 minutos")]
    StaleFeed,
    #[msg("O feed do Switchboard excedeu o intervalo de confiança fornecido")]
    ConfidenceIntervalExceeded,
    #[msg("O preço atual do SOL não está acima do preço de desbloqueio da Custódia.")]
    SolPriceAboveUnlockPrice,
    #[msg("A autoridade da Conta VRF do Switchboard deve ser definida para a chave pública do estado do cliente")]
    InvalidVrfAuthorityError,
}
```

### 6. Mod.rs

Agora, vamos modificar nosso arquivo `mod.rs` para incluir nossas novas funções que escreveremos.

```rust
pub mod deposit;
pub mod withdraw;
pub mod init_vrf_client;
pub mod get_out_of_jail;
pub mod consume_randomness;
```

### 7. Deposit.rs e Withdraw.rs

Por último, vamos atualizar nossos arquivos `deposit.rs` e `withdraw.rs` para refletir nossos novos poderes em breve.

Primeiro, vamos inicializar nossa flag `out_of_jail` como `false` em `deposit.rs`.

```rust
// em deposit.rs
...
let escrow_state = &mut ctx.accounts.escrow_account;
    escrow_state.unlock_price = unlock_price;
    escrow_state.escrow_amount = escrow_amount;
    escrow_state.out_of_jail = false; 
...
```

Em seguida, vamos escrever nossa lógica simples de saída da prisão. Envolva nossas verificações de preço do oráculo com uma instrução `if`. Se a flag `out_of_jail` na conta `escrow_state` for falsa, então verificamos o preço pelo qual desbloquear o SOL:

```rust
if !escrow_state.out_of_jail {
      // obter resultado
      let val: f64 = feed.get_result()?.try_into()?;

      // verificar se o feed foi atualizado nos últimos 300 segundos
      feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
      .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

      msg!("Resultado atual do feed é {}!", val);
      msg!("Preço de desbloqueio é {}", escrow_state.unlock_price);

      if val < escrow_state.unlock_price as f64 {
          return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
      }
  }
```

Se a flag `out_of_jail` for verdadeira, então saímos da prisão de graça e podemos pular a verificação de preço, indo direto para nosso saque.

### 8. Usando a VRF

Agora que tiramos o básico do caminho, vamos passar para nossa primeira adição: inicializar nosso Cliente VRF. Vamos criar um novo arquivo chamado `init_vrf_client.rs` na pasta `/instructions`.

Adicionaremos os crates necessários e criaremos o contexto `InitVrfClient`. Precisaremos das seguintes contas:

- `user` - o signatário que tem fundos na custódia.
- `escrow_account` - a conta de custódia Michael Burry criada quando o usuário bloqueou seus fundos.
- `vrf_client_state` - a conta que criaremos nesta instrução para manter o estado sobre as jogadas de dados do usuário.
- `vrf` - Nossa VRF de propriedade do programa Switchboard. Criaremos esta conta no lado do cliente antes de chamar `init_vrf_client`.
- `system_program` - O programa do sistema, pois usamos a macro init para `vrf_state`, que chama `create_account` internamente.

```rust
use crate::state::*;
use crate::errors::*;
use anchor_lang::prelude::*;
use switchboard_v2::VrfAccountData;

#[derive(Accounts)]
pub struct InitVrfClient<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    // conta de escrow burry
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // estado do cliente vrf
    #[account(
        init,
        seeds = [
						VRF_STATE_SEED,
            user.key.as_ref(),
            escrow_account.key().as_ref(),
            vrf.key().as_ref(),
        ],
        payer = user,
        space = 8 + std::mem::size_of::<VrfClientState>(),
        bump
    )]
    pub vrf_state: AccountLoader<'info, VrfClientState>,

    // conta switchboard vrf
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_state.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>,
    pub system_program: Program<'info, System>
}
```

Note que a conta `vrf_state` é um PDA derivado com a string `VRF_STATE_SEED` e as chaves públicas `user`, `escrow_account` e `vrf` como sementes. Isso significa que um único usuário só pode inicializar uma única conta `vrf_state`, assim como só pode ter uma `escrow_account`. Como só existe uma, se você quiser ser minucioso, talvez queira implementar uma função `close_vrf_state` para recuperar seu aluguel.

Agora, vamos escrever alguma lógica básica de inicialização para esta função. Primeiro carregamos e inicializamos nossa conta `vrf_state` chamando `load_init()`. Em seguida, preenchemos os valores para cada campo.

```rust
pub fn init_vrf_client_handler(ctx: Context<InitVrfClient>) -> Result<()> {
    msg!("validação init_client");

    let mut vrf_state = ctx.accounts.vrf_state.load_init()?;
    *vrf_state = VrfClientState::default();
    vrf_state.bump = ctx.bumps.get("vrf_state").unwrap().clone();
    vrf_state.escrow = ctx.accounts.escrow_account.key();
    vrf_state.die_result_1 = 0;
    vrf_state.die_result_2 = 0;
    vrf_state.timestamp = 0;
    vrf_state.dice_type = 6; // lados

    Ok(())
}
```

### 9. Saindo da Prisão

Agora que temos a conta `VrfClientState` inicializada, podemos usá-la na instrução `get_out_jail`. Crie um novo arquivo chamado `get_out_of_jail.rs` na pasta `/instructions`.

A instrução `get_out_jail` fará nosso pedido VRF para o Switchboard. Precisaremos passar todas as contas necessárias tanto para o pedido VRF quanto para nossa função de callback de lógica de negócios.

Contas VRF:
- `payer_wallet` - a carteira de tokens que pagará pelo pedido VRF; o `user` deve ser o proprietário desta conta.
- `vrf` - A conta VRF criada pelo cliente.
- `oracle_queue` - A fila de oráculos que atenderá ao resultado de aleatoriedade.
- `queue_authority` - A autoridade sobre a fila.
- `data_buffer` - A conta de buffer de dados da fila, usada pela fila para calcular/verificar a aleatoriedade.
- `permission` - Criada ao criar a conta `vrf`. É derivada de várias das outras contas.
- `switchboard_escrow` - Onde o pagador envia os tokens para os pedidos.
- `program_state` - Estado do programa Switchboard.

Programas:
- `switchboard_program`
- `recent_blockhashes`
- `token_program`
- `system_program`

Contas de Lógica de Negócios:
- `user` - A conta do usuário que custodiou os fundos.
- `escrow_account` - A conta de estado de custódia Michael Burry para o usuário.
- `vrf_state` - A conta de estado do cliente VRF inicializada na instrução `init_vrf_client`.

```rust
use crate::state::*;
use crate::errors::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::*;
use switchboard_v2::{VrfAccountData, OracleQueueAccountData, PermissionAccountData, SbState, VrfRequestRandomness};
use anchor_spl::token::{TokenAccount, Token};

#[derive(Accounts)]
pub struct RequestRandomness<'info> {
    // CONTAS PAGADORAS
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut,
        constraint =
            payer_wallet.owner == user.key()
            && switchboard_escrow.mint == program_state.load()?.token_mint
    )]
    pub payer_wallet: Account<'info, TokenAccount>,
    // conta de custódia burry
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // estado do cliente vrf
    #[account(
        mut,
        seeds = [
            VRF_STATE_SEED,
            user.key.as_ref(),
            escrow_account.key().as_ref(),
            vrf.key().as_ref(),
        ],
        bump
    )]
    pub vrf_state: AccountLoader<'info, VrfClientState>,
    // conta vrf do switchboard
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_state.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>,
    // contas switchboard
    #[account(mut,
        has_one = data_buffer
    )]
    pub oracle_queue: AccountLoader<'info, OracleQueueAccountData>,
    /// VERIFICAÇÃO:
    #[account(
        mut,
        constraint = oracle_queue.load()?.authority == queue_authority.key()
    )]
    pub queue_authority: UncheckedAccount<'info>,
    /// VERIFICAÇÃO
    #[account(mut)]
    pub data_buffer: AccountInfo<'info>,
    #[account(mut)]
    pub permission: AccountLoader<'info, PermissionAccountData>,
    #[account(mut,
        constraint = switchboard_escrow.owner == program_state.key() && switchboard_escrow.mint == program_state.load()?.token_mint
    )]
    pub switchboard_escrow: Account<'info, TokenAccount>,
    #[account(mut)]
    pub program_state: AccountLoader<'info, SbState>,
    /// VERIFICAÇÃO:
    #[account(
        address = *vrf.to_account_info().owner,
        constraint = switchboard_program.executable == true
    )]
    pub switchboard_program: AccountInfo<'info>,
    // CONTAS DO SISTEMA
    /// VERIFICAÇÃO:
    #[account(address = recent_blockhashes::ID)]
    pub recent_blockhashes: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
}
```

Por fim, vamos criar uma nova estrutura `RequestRandomnessParams`. Vamos passar os saltos de algumas contas do lado do cliente.

```rust
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct RequestRandomnessParams {
    pub permission_bump: u8,
    pub switchboard_state_bump: u8,
}
```

Agora, podemos trabalhar na lógica desta instrução. A lógica deve reunir todas as contas necessárias e passá-las para `[VrfRequestRandomness](https://github.com/switchboard-xyz/solana-sdk/blob/fbef37e4a78cbd8b8b6346fcb96af1e20204b861/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs#L8)`, que é uma estrutura muito boa do Switchboard. Em seguida, assinaremos o pedido e o enviaremos.

```rust
pub fn get_out_of_jail_handler(ctx: Context<RequestRandomness>, params: RequestRandomnessParams) -> Result <()> {
    let switchboard_program = ctx.accounts.switchboard_program.to_account_info();
    let vrf_state = ctx.accounts.vrf_state.load()?;
    
    let bump = vrf_state.bump.clone();
    drop(vrf_state);

		// construir estrutura de solicitação vrf do crate Rust do Switchboard
    let vrf_request_randomness = VrfRequestRandomness {
        authority: ctx.accounts.vrf_state.to_account_info(),
        vrf: ctx.accounts.vrf.to_account_info(),
        oracle_queue: ctx.accounts.oracle_queue.to_account_info(),
        queue_authority: ctx.accounts.queue_authority.to_account_info(),
        data_buffer: ctx.accounts.data_buffer.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        escrow: ctx.accounts.switchboard_escrow.clone(),
        payer_wallet: ctx.accounts.payer_wallet.clone(),
        payer_authority: ctx.accounts.user.to_account_info(),
        recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
        program_state: ctx.accounts.program_state.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };

    let vrf_key = ctx.accounts.vrf.key();
    let escrow_key = ctx.accounts.escrow_account.key();
    let user_key = ctx.accounts.user.key();
    let state_seeds: &[&[&[u8]]] = &[&[
				&VRF_STATE_SEED,
        user_key.as_ref(),
        escrow_key.as_ref(),
        vrf_key.as_ref(),
        &[bump],
    ]];

    // enviar solicitação vrf com assinatura PDA
    msg!("solicitando aleatoriedade");
    vrf_request_randomness.invoke_signed(
        switchboard_program,
        params.switchboard_state_bump,
        params.permission_bump,
        state_seeds,
    )?;

    msg!("aleatoriedade solicitada com sucesso");

    Ok(())
}
```

### 10. Consumindo Aleatoriedade

Agora que construímos a lógica para solicitar uma VRF do Switchboard, precisamos construir a instrução de callback que o programa Switchboard chamará assim que a VRF for verificada. Crie um novo arquivo chamado `consume_randomness.rs` no diretório `/instructions`.

Esta função usará a aleatoriedade para determinar quais valores de dados foram rolados. Se forem rolados dados duplos, defina o campo `out_of_jail` em `vrf_state` como verdadeiro.

Primeiro, vamos criar o contexto `ConsumeRandomness`. Felizmente, ele só precisa de três contas.

- `escrow_account` - conta de estado para os fundos custodiados do usuário.
- `vrf_state` - conta de estado para manter informações sobre a jogada de dados.
- `vrf` - conta com o número aleatório que acabou de ser calculado pela rede Switchboard.

```rust
// dentro de consume_randomness.rs
use crate::state::*;
use crate::errors::*;
use anchor_lang::prelude::*;
use switchboard_v2::VrfAccountData;

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    // conta de custódia burry
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowState>,
    // estado do cliente vrf
    #[account(mut)]
    pub vrf_state: AccountLoader<'info, VrfClientState>,
    // conta vrf do switchboard
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_state.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>
}
```

Agora vamos escrever a lógica para nosso `consume_randomness_handler`. Primeiro, buscamos os resultados da conta `vrf`. 

Precisamos chamar `load()` porque a `vrf` é passada como um `AccountLoader`. Lembre-se, `AccountLoader` evita transbordamentos (overflows) tanto de stack quanto de heap para contas grandes. Então, chamamos `get_result()` para pegar a aleatoriedade dentro da estrutura `VrfAccountData`. Finalmente, verificamos se o buffer resultante está zerado. Se estiver tudo zero, significa que os Oráculos ainda não verificaram e depositaram a aleatoriedade na conta.

```rust
// dentro de consume_randomness.rs

pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Consumindo aleatoriedade...");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("buffer vrf vazio");
        return Ok(());
    }

		Ok(())
}
```

Então carregamos nosso `vrf_state` usando `load_mut`, já que estaremos armazenando a aleatoriedade e as jogadas de dados nele. Também queremos verificar que o `result_buffer` retornado da `vrf` não coincide byte por byte com o `result_buffer` do `vrf_state`. Se coincidirem, sabemos que a aleatoriedade retornada é antiga.

```rust
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Aleatoriedade consumida com sucesso.");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("buffer vrf vazio");
        return Ok(());
    }
		// novo código
    let vrf_state = &mut ctx.accounts.vrf_state.load_mut()?;
    if result_buffer == vrf_state.result_buffer {
        msg!("result_buffer inalterado");
        return Ok(());
    }

		...
		...
}
```

Agora é hora de realmente usar o resultado aleatório. Como só usamos dois dados, precisamos apenas dos dois primeiros bytes do buffer. Para converter esses valores aleatórios em “jogadas de dados”, usamos aritmética modular. Para quem não está familiarizado com aritmética modular, [a Wikipedia pode ajudar](https://en.wikipedia.org/wiki/Modular_arithmetic). Na aritmética modular, os números "voltam ao início" ao atingir uma quantidade fixa. Essa quantidade fixa é conhecida como o módulo para deixar como o resto. Aqui, o módulo é o `dice_type` armazenado na conta `vrf_state`. Nós codificamos isso como 6 quando a conta foi inicializada para representar um dado de seis lados. Quando usamos `dice_type`, ou 6, como o módulo, nosso resultado será um número de 0-5. Em seguida, adicionamos um, para que as possibilidades resultantes sejam 1-6.

```rust
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Aleatoriedade consumida com sucesso.");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("buffer vrf vazio");
        return Ok(());
    }

    let vrf_state = &mut ctx.accounts.vrf_state.load_mut()?;
    let dice_type = vrf_state.dice_type;
    if result_buffer == vrf_state.result_buffer {
        msg!("result_buffer inalterado");
        return Ok(());
    }

    msg!("Buffer de resultado é {:?}", result_buffer);

    let dice_1 = result_buffer[0] % dice_type + 1;
    let dice_2 = result_buffer[1] % dice_type + 1;

    msg!("Valor atual do Dado 1 [1 - {}) = {}!", dice_type, dice_1);
    msg!("Valor atual do Dado 2 [1 - {}) = {}!", dice_type, dice_2);

		...
		...
}
```

> Fato divertido de Christian (um dos editores): um byte por rolagem é na verdade uma opção um pouco ruim para uma rolagem de dados (Suficientemente bom para demonstrar). Você tem 256 opções em um u8. Quando aplicado o módulo de 6, o número zero tem uma ligeira vantagem na distribuição (256 não é divisível por 6).
> Quantidade de 0s: (255-0)/6 + 1 = 43
> Quantidade de 1s: (256-1)/6 = 42.6, então 42 ocorrências de 1
> Quantidade de 2s: (257-2)/6 = 42.5, então 42 ocorrências de 2
> Quantidade de 3s: (258-3)/6 = 42.5, então 42 ocorrências de 3
> Quantidade de 4s: (259-4)/6 = 42.5, então 42 ocorrências de 4
> Quantidade de 5s: (260-5)/6 = 42.5, então 42 ocorrências de 5

A última coisa que temos que fazer é atualizar os campos em `vrf_state` e determinar se o usuário rolou duplos. Se sim, ative a flag `out_of_jail` para verdadeiro.

Se o `out_of_jail` se tornar verdadeiro, o usuário pode então chamar a instrução `withdraw` e ela pulará a verificação de preço.

```rust
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Aleatoriedade consumida com sucesso.");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("buffer vrf vazio");
        return Ok(());
    }

    let vrf_state = &mut ctx.accounts.vrf_state.load_mut()?;
    let dice_type = vrf_state.dice_type;
    if result_buffer == vrf_state.result_buffer {
        msg!("result_buffer inalterado");
        return Ok(());
    }

    msg!("Buffer de resultado é {:?}", result_buffer);

    let dice_1 = result_buffer[0] % dice_type + 1;
    let dice_2 = result_buffer[1] % dice_type + 1;

    msg!("Valor atual do Dado 1 [1 - {}) = {}!", dice_type, dice_1);
    msg!("Valor atual do Dado 2 [1 - {}) = {}!", dice_type, dice_2);

    msg!("Atualizando o Estado VRF com o valor aleatório...");
    vrf_state.result_buffer = result_buffer;
    vrf_state.die_result_1 = dice_1;
    vrf_state.die_result_2 = dice_2;
    vrf_state.timestamp = Clock::get().unwrap().unix_timestamp;

    if dice_1 == dice_2 {
        msg!("Rolou duplos, saia da prisão de graça!");
        let escrow_state = &mut ctx.accounts.escrow_account;
        escrow_state.out_of_jail = true;
    }

    Ok(())
}
```

E isso é tudo para a funcionalidade de saída da prisão! Parabéns, você acabou de construir um programa que pode consumir feeds de dados do Switchboard e enviar solicitações VRF. Certifique-se de que seu programa seja construído com sucesso executando `anchor build`.

### 11. Testando

Tudo bem, vamos testar nosso programa. Historicamente, precisaríamos testar a VRF na Devnet. Felizmente, a equipe do Switchboard criou algumas funções muito boas para nos permitir executar nosso próprio oráculo VRF localmente. Para isso, precisaremos configurar nosso servidor local, pegar todas as contas certas e, em seguida, chamar nosso programa.

A primeira coisa que faremos é incluir mais algumas contas no nosso arquivo `Anchor.toml`:

```toml
# CONTAS VRF
[[test.validator.clone]] # ID do programa de atestação sbv2
address = "sbattyXrzedoNATfc4L31wC9Mhxsi1BmFhTiN8gDshx"

[[test.validator.clone]] # IDL de atestação sbv2
address = "5ExuoQR69trmKQfB95fDsUGsUrrChbGq9PFgt8qouncz"

[[test.validator.clone]] # SbState sbv2
address = "CyZuD7RPDcrqCGbNvLCyqk6Py9cEZTKmNKujfPi3ynDd"
```

Depois, criamos um novo arquivo de teste chamado `vrf-test.ts` e copiamos e colamos o código abaixo. Ele copia os últimos dois testes da lição sobre oráculos, adiciona algumas importações e adiciona uma nova função chamada `delay`.

```tsx
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BurryEscrow } from "../target/types/burry_escrow";
import { Big } from "@switchboard-xyz/common";
import { AggregatorAccount, AnchorWallet, SwitchboardProgram, SwitchboardTestContext, Callback, PermissionAccount } from "@switchboard-xyz/solana.js"
import { NodeOracle } from "@switchboard-xyz/oracle"
import { assert } from "chai";

export const solUsedSwitchboardFeed = new anchor.web3.PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR")

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

describe("burry-escrow-vrf", () => {
  // Configurar o cliente para usar o cluster local.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.BurryEscrow as Program<BurryEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer

  it("Criar custódia Burry acima do preço", async () => {
    // buscar o objeto de programa da devnet do switchboard 
    const switchboardProgram = await SwitchboardProgram.load(
      "devnet",
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // derivar conta de estado de custódia
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    console.log("Conta de Custódia: ", escrowState.toBase58())

    // buscar último preço do SOL
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error('Agregador não possui valor')
    }
    const failUnlockPrice = solPrice.plus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    // Enviar transação
    try {
      const tx = await program.methods.deposit(
        amountToLockUp, 
        failUnlockPrice
      )
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Sua assinatura de transação", tx)

      // Buscar a conta criada
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("Preço de desbloqueio onchain:", newAccount.unlockPrice)
      console.log("Quantidade em escrow:", escrowBalance)

      // Verificar se os dados onchain são iguais aos 'dados' locais
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch (e) {
      console.log(e)
      assert.fail(e)
    }
  })

  it("Tentar retirar enquanto o preço está abaixo de UnlockPrice", async () => {
    let didFail = false;

    // derivar endereço de escrow
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    
    // enviar tx
    try {
      const tx = await program.methods.withdraw()
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        feedAggregator: solUsedSwitchboardFeed,
        systemProgram: anchor.web3.SystemProgram.programId
    })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Sua assinatura de transação", tx)

    } catch (e) {
      // verificar se tx retorna o erro esperado
      didFail = true;
      console.log(e.error.errorMessage)
      assert(e.error.errorMessage == 'O preço atual do SOL não está acima do preço de desbloqueio do Escrow.')
    }

    assert(didFail)
  })
});
```

> Nota rápida: se você quiser executar apenas os testes de vrf, altere
> 
> 
> `describe("burry-escrow-vrf", () => {`
> 
> — para —
> 
> `describe.only("burry-escrow-vrf", () => {`
> 

Agora, vamos configurar nosso servidor local do Oráculo VRF usando `SwitchboardTestContext`. Isso nos dará um contexto `switchboard` e um nó `oracle`. Chamamos as funções de inicialização na função `before()`. Isso será executado e concluído antes de qualquer teste começar. Por fim, vamos adicionar `oracle?.stop()` à função `after()` para limpar tudo.

```tsx
describe.only("burry-escrow-vrf", () => {
  // Configurar o cliente para usar o cluster local.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.BurryEscrow as Program<BurryEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer

  // CÓDIGO ADICIONADO
  let switchboard: SwitchboardTestContext
  let oracle: NodeOracle

  before(async () => {
    switchboard = await SwitchboardTestContext.loadFromProvider(provider, {
      name: "Fila de Teste",
      // Você pode fornecer um par de chaves para que os esquemas PDA não mudem entre execuções de teste
      // keypair: SwitchboardTestContext.loadKeypair(CAMINHO_DO_PAR_DE_CHAVES_SWITCHBOARD),
      queueSize: 10,
      reward: 0,
      minStake: 0,
      oracleTimeout: 900,
      // agregadores não precisarão de PERMIT_ORACLE_QUEUE_USAGE antes de entrar em uma fila
      unpermissionedFeeds: true,
      unpermissionedVrf: true,
      enableBufferRelayers: true,
      oracle: {
        name: "Oráculo de Teste",
        enable: true,
        // stakingWalletKeypair: SwitchboardTestContext.loadKeypair(CAMINHO_DO_PAR_DE_CHAVES_DE_STAKING),
      },
    })

    oracle = await NodeOracle.fromReleaseChannel({
      chain: "solana",
      // usa a versão mais recente do oráculo para testnet (devnet)
      releaseChannel: "testnet",
      // desativa recursos de produção como monitoramento e alertas
      network: "localnet",
      rpcUrl: provider.connection.rpcEndpoint,
      oracleKey: switchboard.oracle.publicKey.toBase58(),
      // caminho para o par de chaves do pagador para que o oráculo possa pagar por txns
      secretPath: switchboard.walletPath,
      // definido como verdadeiro para suprimir logs do oráculo no console
      silent: false,
      // variáveis de ambiente opcionais para acelerar o fluxo de trabalho
      envVariables: {
        VERBOSE: "1",
        DEBUG: "1",
        DISABLE_NONCE_QUEUE: "1",
        DISABLE_METRICS: "1",
      },
    })

    switchboard.oracle.publicKey

    // inicie o oráculo e aguarde até que ele comece sua ativação onchain
    await oracle.startAndAwait()
  })

  after(() => {
    oracle?.stop()
  })

// ... resto do código
}
```

Agora vamos executar o teste real. Estruturaremos o teste para continuar jogando os dados até obtermos duplos, então verificaremos se podemos retirar os fundos.

Primeiro, reuniremos todas as contas de que precisamos. O contexto de teste `switchboard` nos dá a maioria delas. Então precisaremos chamar nossa função `initVrfClient`. Finalmente, rolaremos nossos dados em um loop e verificaremos se há duplos.

```tsx
it("Role até poder retirar", async () => {
  // derivar endereço de custódia
  const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
    program.programId
  )

  const vrfSecret = anchor.web3.Keypair.generate()
  const [vrfClientKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("VRFCLIENT"),
      payer.publicKey.toBytes(),
      escrowState.toBytes(),
      vrfSecret.publicKey.toBytes(),
    ],
    program.programId
  )
  console.log(`Cliente VRF: ${vrfClientKey}`)

  const vrfIxCoder = new anchor.BorshInstructionCoder(program.idl)
  const vrfClientCallback: Callback = {
    programId: program.programId,
    accounts: [
      // garanta que todas as contas em consumeRandomness estejam preenchidas
      // { pubkey: payer.publicKey, isSigner: false, isWritable: true },
      { pubkey: escrowState, isSigner: false, isWritable: true },
      { pubkey: vrfClientKey, isSigner: false, isWritable: true },
      { pubkey: vrfSecret.publicKey, isSigner: false, isWritable: true },
    ],
    ixData: vrfIxCoder.encode("consumeRandomness", ""), // passe quaisquer parâmetros para a instrução aqui
  }

  const queue = await switchboard.queue.loadData();

  // Criar VRF do Switchboard e conta de permissão
  const [vrfAccount] = await switchboard.queue.createVrf({
    callback: vrfClientCallback,
    authority: vrfClientKey, // autoridade vrf
    vrfKeypair: vrfSecret,
    enable: !queue.unpermissionedVrfEnabled, // apenas define permissões se necessário
  })

  // dados vrf
  const vrf = await vrfAccount.loadData();

  console.log(`Conta VRF Criada: ${vrfAccount.publicKey}`)

  // derivar a conta de permissão VRF existente usando as seeds
  const [permissionAccount, permissionBump] = PermissionAccount.fromSeed(
    switchboard.program,
    queue.authority,
    switchboard.queue.publicKey,
    vrfAccount.publicKey
  )

  const [payerTokenWallet] = await switchboard.program.mint.getOrCreateWrappedUser(
    switchboard.program.walletPubkey,
    { fundUpTo: 1.0 }
  );

  // inicializar cliente vrf
  try {
    const tx = await program.methods.initVrfClient()
    .accounts({
      user: payer.publicKey,
      escrowAccount: escrowState,
      vrfState: vrfClientKey,
      vrf: vrfAccount.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([payer])
    .rpc()
    
  } catch (e) {
    console.log(e)
    assert.fail()
  }

  let rolledDoubles = false
  while(!rolledDoubles){
    try {
      // Solicitar aleatoriedade e rolar os dados
      const tx = await program.methods.getOutOfJail({
        switchboardStateBump: switchboard.program.programState.bump, 
        permissionBump})
      .accounts({
        vrfState: vrfClientKey,
        vrf: vrfAccount.publicKey,
        user: payer.publicKey,
        payerWallet: payerTokenWallet,
        escrowAccount: escrowState,
        oracleQueue: switchboard.queue.publicKey,
        queueAuthority: queue.authority,
        dataBuffer: queue.dataBuffer,
        permission: permissionAccount.publicKey,
        switchboardEscrow: vrf.escrow,
        programState: switchboard.program.programState.publicKey,

        switchboardProgram: switchboard.program.programId,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log(`Conta VrfClient Criada: ${vrfClientKey}`)

      // aguarde alguns segundos para que o Switchboard gere o número aleatório e invoque a instrução de callback
      console.log("Rolar dado...")

      let didUpdate = false;
      let vrfState = await program.account.vrfClientState.fetch(vrfClientKey)

      while(!didUpdate){
        console.log("Verificando dado...")
        vrfState = await program.account.vrfClientState.fetch(vrfClientKey);
        didUpdate = vrfState.timestamp.toNumber() > 0;
        await delay(1000)
      }

      console.log("Resultados da rolagem - Dado 1:", vrfState.dieResult1, "Dado 2:", vrfState.dieResult2)
      if(vrfState.dieResult1 == vrfState.dieResult2){
        rolledDoubles = true
      } else {
        console.log("Redefinindo dado...")
        await delay(5000)
      }

    } catch (e) {
      console.log(e)
      assert.fail()
    }
  }

  const tx = await program.methods.withdraw()
  .accounts({
    user: payer.publicKey,
    escrowAccount: escrowState,
    feedAggregator: solUsedSwitchboardFeed,
    systemProgram: anchor.web3.SystemProgram.programId
  })
  .signers([payer])
  .rpc()
  
  await provider.connection.confirmTransaction(tx, "confirmed")
})
```

Observe a função onde obtemos nossa `payerTokenWallet`. A VRF na verdade exige que o solicitante pague um pouco de SOL encapsulado. Isso faz parte do mecanismo de incentivo da rede de oráculos. Felizmente, com testes, o Switchboard nos dá essa função muito boa para criar e financiar uma carteira de testes.

```typescript
  const [payerTokenWallet] = await switchboard.program.mint.getOrCreateWrappedUser(
    switchboard.program.walletPubkey,
    { fundUpTo: 1.0 }
  );
```

E é isso! Você deve ser capaz de executar e passar todos os testes usando `anchor test`.

Se algo não estiver funcionando, volte e encontre onde você errou. Alternativamente, sinta-se à vontade para experimentar o [código de solução na branch `vrf`](https://github.com/Unboxed-Software/michael-burry-escrow/tree/vrf). Lembre-se de atualizar suas chaves de programa e caminho da carteira como fizemos na [etapa de Configuração](#1-program-setup).

# Desafio

Agora é hora de trabalhar em algo independentemente. Vamos adicionar algumas [regras do jogo Monopoly](https://en.wikipedia.org/wiki/Monopoly_(game)#Rules) ao nosso programa. Adicione alguma lógica ao programa para rastrear quantas vezes um usuário rola. Se eles rolarem 3 vezes sem tirar duplos, eles devem poder retirar seus fundos, assim como sair da prisão no Monopoly.

Se você tiver dúvidas, temos a solução na branch [`vrf-challenge-solution`](https://github.com/Unboxed-Software/michael-burry-escrow/tree/vrf-challenge-solution).

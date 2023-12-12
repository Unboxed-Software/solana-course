---
title: Contas Mutáveis Duplicadas
objectives:
- Explicar os riscos de segurança associados a instruções que exigem duas contas mutáveis do mesmo tipo e como evitá-los
- Implementar uma verificação de contas mutáveis duplicadas usando Rust de formato longo
- Implementar uma verificação de contas mutáveis duplicadas usando restrições Anchor
---

# RESUMO

- Quando uma instrução requer duas contas mutáveis do mesmo tipo, um invasor pode passar a mesma conta duas vezes, fazendo com que a conta sofra mutações não desejadas.
- Para verificar se há contas mutáveis duplicadas no Rust, basta comparar as chaves públicas das duas contas e lançar um erro se elas forem iguais.

  ```rust
  if ctx.accounts.account_one.key() == ctx.accounts.account_two.key() {
      return Err(ProgramError::InvalidArgument)
  }
  ```

- No Anchor, você pode usar `constraint` para adicionar uma restrição explícita a uma conta, verificando se ela não é igual a outra conta.

# Visão Geral

Contas Mutáveis Duplicadas referem-se a uma instrução que requer duas contas mutáveis do mesmo tipo. Quando isso ocorre, você deve confirmar se as duas contas são diferentes para evitar que a mesma conta seja passada duas vezes para a instrução.

Como o programa trata cada conta como se fossem separadas, passar a mesma conta duas vezes pode fazer com que a segunda conta sofra mutações indesejáveis. Isso pode resultar em problemas muito pequenos ou catastróficos - isso realmente depende dos dados que o código altera e de como essas contas são usadas. De qualquer forma, essa é uma vulnerabilidade da qual todos os desenvolvedores devem estar cientes.

### Sem verificação

Por exemplo, imagine um programa que atualiza um campo `data` para `user_a` e `user_b` em uma única instrução. O valor que a instrução define para `user_a` é diferente de `user_b`. Sem verificar se `user_a` e `user_b` são diferentes, o programa atualizaria o campo `data` na conta `user_a` e, em seguida, atualizaria o campo `data` uma segunda vez com um valor diferente, supondo que `user_b` seja uma conta separada.

Você pode ver esse exemplo no código abaixo. Não há nenhuma verificação para checar se `user_a` e `user_b` não são a mesma conta. Ao passar a mesma conta para `user_a` e `user_b`, o campo `data` da conta será definido como `b`, embora a intenção seja definir os valores `a` e `b` em contas separadas. Dependendo do que `data` representa, isso pode ser um pequeno efeito colateral não intencional ou pode significar um grave risco à segurança. Permitir que `user_a` e `user_b` sejam a mesma conta pode resultar em

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_insecure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

### Adicione verificação na instrução

Para corrigir esse problema com o Rust, basta adicionar uma verificação na lógica de instrução para verificar se a chave pública de `user_a` não é a mesma que a chave pública de `user_b`, retornando um erro se forem iguais.

```rust
if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
    return Err(ProgramError::InvalidArgument)
}
```

Essa verificação garante que o  `user_a` e o `user_b` não sejam a mesma conta.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_secure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
            return Err(ProgramError::InvalidArgument.into())
        }
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

### Use `constraint` do Anchor

Uma solução ainda melhor se você estiver usando o Anchor é adicionar a verificação à struct de validação de conta, em vez da lógica de instrução.

Você pode usar a macro de atributos `#[account(...)]` e a palavra-chave `constraint` para adicionar uma restrição manual a uma conta. A palavra-chave `constraint` verificará se a expressão que segue é avaliada como verdadeira ou falsa, retornando um erro se a expressão for avaliada como falsa.

O exemplo abaixo move a verificação da lógica de instrução para a struct de validação de conta, adicionando um `constraint` ao atributo `#[account(...)]`.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_recommended {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(constraint = user_a.key() != user_b.key())]
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

# Demonstração

Vamos praticar criando um programa simples de Pedra Papel Tesoura para demonstrar como a falha na verificação de contas mutáveis duplicadas pode causar um comportamento indefinido em seu programa.

Esse programa inicializará contas "jogador" e terá uma instrução separada que requer duas contas de jogador para representar o início de um jogo de pedra, papel e tesoura.

- Uma instrução `initialize` para inicializar uma conta `PlayerState`
- Uma instrução `rock_paper_scissors_shoot_insecure` que precisa de duas contas `PlayerState`, mas não verifica se as contas passadas para a instrução são diferentes
- Uma instrução `rock_paper_scissors_shoot_secure` que é a mesma que a instrução `rock_paper_scissors_shoot_insecure`, mas adiciona uma restrição que garante que as duas contas de jogador sejam diferentes

### 1. Início

Para começar, baixe o código inicial na branch `starter` deste [repositório](https://github.com/unboxed-software/solana-duplicate-mutable-accounts/tree/starter). O código inicial inclui um programa com duas instruções e a configuração boilerplate para o arquivo de teste.

A instrução `initialize` inicializa uma nova conta `PlayerState` que armazena a chave pública de um jogador e um campo `choice` que é configurado como `None`.

A instrução `rock_paper_scissors_shoot_insecure` requer duas contas `PlayerState` e requer uma escolha do enum `RockPaperScissors` para cada jogador, mas não verifica se as contas passadas para a instrução são diferentes. Isso significa que uma única conta pode ser usada para ambas as contas `PlayerState` na instrução.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.new_player.player = ctx.accounts.payer.key();
        ctx.accounts.new_player.choice = None;
        Ok(())
    }

    pub fn rock_paper_scissors_shoot_insecure(
        ctx: Context<RockPaperScissorsInsecure>,
        player_one_choice: RockPaperScissors,
        player_two_choice: RockPaperScissors,
    ) -> Result<()> {
        ctx.accounts.player_one.choice = Some(player_one_choice);

        ctx.accounts.player_two.choice = Some(player_two_choice);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8
    )]
    pub new_player: Account<'info, PlayerState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RockPaperScissorsInsecure<'info> {
    #[account(mut)]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}

#[account]
pub struct PlayerState {
    player: Pubkey,
    choice: Option<RockPaperScissors>,
}

#[derive(Clone, Copy, BorshDeserialize, BorshSerialize)]
pub enum RockPaperScissors {
    Rock,
    Paper,
    Scissors,
}
```

### 2. Teste a instrução `rock_paper_scissors_shoot_insecure`

O arquivo de teste inclui o código para invocar a instrução `initialize` duas vezes para criar duas contas de jogador.

Adicione um teste para invocar a instrução `rock_paper_scissors_shoot_insecure` passando a `playerOne.publicKey` para ambos os jogadores `playerOne` e `playerTwo`.

```typescript
describe("duplicate-mutable-accounts", () => {
	...
	it("Invoke insecure instruction", async () => {
        await program.methods
        .rockPaperScissorsShootInsecure({ rock: {} }, { scissors: {} })
        .accounts({
            playerOne: playerOne.publicKey,
            playerTwo: playerOne.publicKey,
        })
        .rpc()

        const p1 = await program.account.playerState.fetch(playerOne.publicKey)
        assert.equal(JSON.stringify(p1.choice), JSON.stringify({ scissors: {} }))
        assert.notEqual(JSON.stringify(p1.choice), JSON.stringify({ rock: {} }))
    })
})
```

Execute o `anchor test` para ver que as transações são concluídas com êxito, mesmo que a mesma conta seja usada como duas contas na instrução. Como a conta `playerOne` é usada como ambos os jogadores na instrução, observe que a `choice` armazenada na conta `playerOne` também é substituída e definida incorretamente como `scissors`.

```bash
duplicate-mutable-accounts
  ✔ Initialized Player One (461ms)
  ✔ Initialized Player Two (404ms)
  ✔ Invoke insecure instruction (406ms)
```

Permitir contas duplicadas não só não faz muito sentido para o jogo, como também causa um comportamento indefinido. Se fôssemos desenvolver mais esse programa, ele teria apenas uma opção escolhida e, portanto, não poderia fazer uma comparação com uma segunda opção. O jogo terminaria sempre em um empate. Também não está claro para um ser humano se a escolha do `playerOne` deve ser pedra ou tesoura, portanto o comportamento do programa é estranho.

### 3. Adicione a instrução `rock_paper_scissors_shoot_secure`

Em seguida, retorne ao `lib.rs` e adicione uma instrução `rock_paper_scissors_shoot_secure` que utilize a macro `#[account(...)]` para adicionar uma restrição extra para verificar se `player_one` e `player_two` são contas diferentes.

```rust
#[program]
pub mod duplicate_mutable_accounts {
    use super::*;
		...
        pub fn rock_paper_scissors_shoot_secure(
            ctx: Context<RockPaperScissorsSecure>,
            player_one_choice: RockPaperScissors,
            player_two_choice: RockPaperScissors,
        ) -> Result<()> {
            ctx.accounts.player_one.choice = Some(player_one_choice);

            ctx.accounts.player_two.choice = Some(player_two_choice);
            Ok(())
        }
}

#[derive(Accounts)]
pub struct RockPaperScissorsSecure<'info> {
    #[account(
        mut,
        constraint = player_one.key() != player_two.key()
    )]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}
```

### 7. Teste a instrução `rock_paper_scissors_shoot_secure`

Para testar a instrução `rock_paper_scissors_shoot_secure`, invocaremos a instrução duas vezes. Primeiro, invocaremos a instrução usando duas contas de jogador diferentes para verificar se a instrução funciona como o esperado. Em seguida, invocaremos a instrução usando a `playerOne.publicKey` como ambas as contas de jogador, o que esperamos que falhe.

```typescript
describe("duplicate-mutable-accounts", () => {
	...
    it("Invoke secure instruction", async () => {
        await program.methods
        .rockPaperScissorsShootSecure({ rock: {} }, { scissors: {} })
        .accounts({
            playerOne: playerOne.publicKey,
            playerTwo: playerTwo.publicKey,
        })
        .rpc()

        const p1 = await program.account.playerState.fetch(playerOne.publicKey)
        const p2 = await program.account.playerState.fetch(playerTwo.publicKey)
        assert.equal(JSON.stringify(p1.choice), JSON.stringify({ rock: {} }))
        assert.equal(JSON.stringify(p2.choice), JSON.stringify({ scissors: {} }))
    })

    it("Invoke secure instruction - expect error", async () => {
        try {
        await program.methods
            .rockPaperScissorsShootSecure({ rock: {} }, { scissors: {} })
            .accounts({
                playerOne: playerOne.publicKey,
                playerTwo: playerOne.publicKey,
            })
            .rpc()
        } catch (err) {
            expect(err)
            console.log(err)
        }
    })
})
```

Execute o `anchor test` para verificar se a instrução funciona como o esperado e se o uso da conta `playerOne` duas vezes retorna o erro esperado.

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: RockPaperScissorsShootSecure',
'Program log: AnchorError caused by account: player_one. Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated.',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 5104 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d3'
```

A simples restrição é tudo o que é necessário para fechar essa brecha. Embora um tanto forçado, esse exemplo ilustra o comportamento estranho que pode ocorrer se você escrever o seu programa com a suposição de que duas contas do mesmo tipo serão instâncias diferentes de uma conta, mas não escrever explicitamente essa restrição no seu programa. Sempre pense no comportamento que está esperando do programa e se ele está explícito.

Se quiser dar uma olhada no código de solução final, poderá encontrá-lo na branch `solution` do [repositório](https://github.com/Unboxed-Software/solana-duplicate-mutable-accounts/tree/solution).

# Desafio

Assim como em outras lições deste módulo, sua oportunidade de praticar como evitar essa exploração de segurança está na auditoria de seus próprios programas ou de outros.

Reserve algum tempo para revisar pelo menos um programa e certifique-se de que todas as instruções com duas contas mutáveis do mesmo tipo sejam adequadamente restringidas para evitar duplicatas.

Lembre-se, se você encontrar um bug ou uma exploração no programa de outra pessoa, alerte-a! Se encontrar um bug em seu próprio programa, não deixe de corrigi-lo imediatamente.

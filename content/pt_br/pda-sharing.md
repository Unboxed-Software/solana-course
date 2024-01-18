---
title: Compartilhamento de PDA
objectives:
- Explicar os riscos de segurança associados ao compartilhamento de PDA
- Derivar PDAs que possuem domínios de autoridade discretos
- Usar as restrições `seeds` e `bump` do Anchor para validar contas PDA
---

# Resumo

- Usar o mesmo PDA para vários domínios de autoridade abre seu programa para a possibilidade de usuários acessarem dados e fundos que não lhes pertencem
- Evite o uso do mesmo PDA para várias contas usando sementes que são específicas do usuário e/ou domínio
- Use as restrições `seeds` e `bump` do Anchor para validar que um PDA é derivado usando as sementes e o salto (bump) esperados

# Visão Geral

Compartilhamento de PDA refere-se a usar o mesmo PDA como signatário em vários usuários ou domínios. Especialmente ao usar PDAs para assinaturas, pode parecer apropriado usar um PDA global para representar o programa. No entanto, isso abre a possibilidade de a validação da conta passar, mas um usuário ser capaz de acessar fundos, transferências ou dados que não lhe pertencem.

## PDA global inseguro

No exemplo abaixo, a `authority` da conta `vault` é um PDA derivado usando o endereço `mint` armazenado na conta `pool`. Este PDA é passado para a instrução como a conta `authority` para assinar a transferência de tokens do `vault` para o `withdraw_destination`.

Usar o endereço `mint` como uma semente para derivar o PDA para assinar o `vault` é inseguro porque várias contas `pool` podem ser criadas para a mesma conta de token `vault`, mas com um `withdraw_destination` diferente. Ao usar o `mint` como uma semente para derivar o PDA para assinar transferências de tokens, qualquer conta `pool` poderia assinar a transferência de tokens de uma conta de token `vault` para um `withdraw_destination` arbitrário.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_insecure {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[ctx.accounts.pool.mint.as_ref(), &[ctx.accounts.pool.bump]];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(has_one = vault, has_one = withdraw_destination)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

## PDA específico de conta seguro

Uma abordagem para criar um PDA específico de conta é usar o `withdraw_destination` como uma semente para derivar o PDA usado como autoridade da conta de token `vault`. Isso garante que o PDA que assina a CPI na instrução `withdraw_tokens` seja derivado usando a conta de token `withdraw_destination` pretendida. Em outras palavras, tokens de uma conta de token `vault` só podem ser retirados para o `withdraw_destination` que foi originalmente inicializado com a conta `pool`.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_secure {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[
            ctx.accounts.pool.withdraw_destination.as_ref(),
            &[ctx.accounts.pool.bump],
        ];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(has_one = vault, has_one = withdraw_destination)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

## Restrições `seeds` e `bump` do Anchor

PDAs podem ser usados tanto como o endereço de uma conta quanto permitir que programas assinem pelos PDAs que possuem.

O exemplo abaixo usa um PDA derivado usando o `withdraw_destination` tanto como o endereço da conta `pool` quanto como proprietário da conta de token `vault`. Isso significa que apenas a conta `pool` associada ao `vault` e `withdraw_destination` corretos pode ser usada na instrução `withdraw_tokens`.

Você pode usar as restrições `seeds` e `bump` do Anchor com o atributo `#[account(...)]` para validar o PDA da conta `pool`. O Anchor deriva um PDA usando as `seeds` e `bump` especificados e compara com a conta passada na instrução como a conta `pool`. A restrição `has_one` é usada para garantir ainda mais que apenas as contas corretas armazenadas na conta `pool` sejam passadas para a instrução. 

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_recommended {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[
            ctx.accounts.pool.withdraw_destination.as_ref(),
            &[ctx.accounts.pool.bump],
        ];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(
				has_one = vault,
				has_one = withdraw_destination,
				seeds = [withdraw_destination.key().as_ref()],
				bump = pool.bump,
		)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

# Demonstração

Vamos praticar criando um programa simples para demonstrar como um compartilhamento de PDA pode permitir que um atacante retire tokens que não lhe pertencem. Esta demonstração expande os exemplos acima, incluindo as instruções para inicializar as contas do programa necessárias.

### 1. Código inicial

Para começar, baixe o código inicial na branch `starter` deste [repositório](https://github.com/Unboxed-Software/solana-pda-sharing/tree/starter). O código inicial inclui um programa com duas instruções e a configuração padrão para o arquivo de teste.

A instrução `initialize_pool` inicializa um novo `TokenPool` que armazena um `vault`, `mint`, `withdraw_destination` e `bump`. O `vault` é uma conta de token onde a autoridade é definida como um PDA derivado usando o endereço `mint`.

A instrução `withdraw_insecure` transferirá tokens na conta de token `vault` para uma conta de token `withdraw_destination`.

No entanto, como escrito, as sementes usadas para assinatura não são específicas para o destino de retirada do vault, abrindo o programa para explorações de segurança. Tire um minuto para se familiarizar com o código antes de continuar.

### 2. Testando a instrução `withdraw_insecure`

O arquivo de teste inclui o código para invocar a instrução `initialize_pool` e depois cunhar 100 tokens para a conta de token `vault`. Também inclui um teste para invocar o `withdraw_insecure` usando o `withdraw_destination` pretendido. Isso mostra que as instruções podem ser usadas conforme o pretendido.

Depois disso, há mais dois testes para mostrar como as instruções são vulneráveis à exploração.

O primeiro teste invoca a instrução `initialize_pool` para criar uma conta `pool` "falsa" usando a mesma conta de token `vault`, mas um `withdraw_destination` diferente.

O segundo teste retira desta pool, roubando fundos do vault.

```tsx
it("Inicialização insegura permite que o pool seja inicializado com cofre errado", async () => {
    await program.methods
      .initializePool(authInsecureBump)
      .accounts({
        pool: poolInsecureFake.publicKey,
        mint: mint,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestinationFake,
        payer: walletFake.publicKey,
      })
      .signers([walletFake, poolInsecureFake])
      .rpc()

    await new Promise((x) => setTimeout(x, 1000))

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultInsecure.address,
      wallet.payer,
      100
    )

    const account = await spl.getAccount(connection, vaultInsecure.address)
    expect(Number(account.amount)).to.equal(100)
})

it("A retirada insegura permite roubar do cofre", async () => {
    await program.methods
      .withdrawInsecure()
      .accounts({
        pool: poolInsecureFake.publicKey,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestinationFake,
        authority: authInsecure,
        signer: walletFake.publicKey,
      })
      .signers([walletFake])
      .rpc()

    const account = await spl.getAccount(connection, vaultInsecure.address)
    expect(Number(account.amount)).to.equal(0)
})
```

Execute `anchor test` para ver que as transações são concluídas com sucesso e a instrução `withdraw_insecure` permite que a conta de token `vault` seja drenada para um destino de saque falso armazenado na conta `pool` falsa.

### 3. Adicionando a instrução `initialize_pool_secure`

Agora vamos adicionar uma nova instrução ao programa para inicializar um pool de forma segura.

Esta nova instrução `initialize_pool_secure` inicializará um `pool` como um PDA derivado usando o `withdraw_destination`. Também inicializará uma conta de token `vault` com a autoridade definida como o PDA do `pool`.

```rust
pub fn initialize_pool_secure(ctx: Context<InitializePoolSecure>) -> Result<()> {
    ctx.accounts.pool.vault = ctx.accounts.vault.key();
    ctx.accounts.pool.mint = ctx.accounts.mint.key();
    ctx.accounts.pool.withdraw_destination = ctx.accounts.withdraw_destination.key();
    ctx.accounts.pool.bump = *ctx.bumps.get("pool").unwrap();
    Ok(())
}

...

#[derive(Accounts)]
pub struct InitializePoolSecure<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 32 + 1,
        seeds = [withdraw_destination.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, TokenPool>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = pool,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
```

### 4. Adicionando a instrução `withdraw_secure`

Em seguida, adicione uma instrução `withdraw_secure`. Esta instrução retirará tokens da conta de token `vault` para o `withdraw_destination`. A conta `pool` é validada usando as restrições `seeds` e `bump` para garantir que a conta PDA correta seja fornecida. As restrições `has_one` verificam se as contas de token `vault` e `withdraw_destination` corretas são fornecidas.

```rust
pub fn withdraw_secure(ctx: Context<WithdrawTokensSecure>) -> Result<()> {
    let amount = ctx.accounts.vault.amount;
    let seeds = &[
    ctx.accounts.pool.withdraw_destination.as_ref(),
      &[ctx.accounts.pool.bump],
    ];
    token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
}

...

#[derive(Accounts)]
pub struct WithdrawTokensSecure<'info> {
    #[account(
        has_one = vault,
        has_one = withdraw_destination,
        seeds = [withdraw_destination.key().as_ref()],
        bump = pool.bump,
    )]
    pool: Account<'info, TokenPool>,
    #[account(mut)]
    vault: Account<'info, TokenAccount>,
    #[account(mut)]
    withdraw_destination: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokensSecure<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}
```

### 5. Testando a instrução `withdraw_secure`

Finalmente, volte ao arquivo de teste para testar a instrução `withdraw_secure` e mostrar que, ao restringir o escopo de nossa autoridade de assinatura PDA, removemos a vulnerabilidade.

Antes de escrevermos um teste mostrando que a vulnerabilidade foi corrigida, vamos escrever um teste que simplesmente mostra que as instruções de inicialização e retirada funcionam conforme o esperado:

```typescript
it("Inicialização segura do pool e retirada funcionam", async () => {
    const withdrawDestinationAccount = await getAccount(
      provider.connection,
      withdrawDestination
    )

    await program.methods
      .initializePoolSecure()
      .accounts({
        pool: authSecure,
        mint: mint,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .signers([vaultRecommended])
      .rpc()

    await new Promise((x) => setTimeout(x, 1000))

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultRecommended.publicKey,
      wallet.payer,
      100
    )

    await program.methods
      .withdrawSecure()
      .accounts({
        pool: authSecure,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .rpc()

    const afterAccount = await getAccount(
      provider.connection,
      withdrawDestination
    )

    expect(
      Number(afterAccount.amount) - Number(withdrawDestinationAccount.amount)
    ).to.equal(100)
})
```

Agora, testaremos para comprovar que a brecha de segurança não existe mais. Como a autoridade do `vault` é o PDA `pool` derivado usando a conta de token `withdraw_destination` pretendida, não deve mais haver uma maneira de retirar para uma conta diferente do `withdraw_destination` pretendido.

Adicione um teste que mostra que você não pode chamar `withdraw_secure` com o destino de retirada errado. Pode usar o pool e o cofre (vault) criados no teste anterior.

```typescript
  it("Retirada segura não permite retirada para o destino errado", async () => {
    try {
      await program.methods
        .withdrawSecure()
        .accounts({
          pool: authSecure,
          vault: vaultRecommended.publicKey,
          withdrawDestination: withdrawDestinationFake,
        })
        .signers([walletFake])
        .rpc()

      assert.fail("erro esperado")
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
  })
```

Por fim, como a conta `pool` é um PDA derivado usando a conta de token `withdraw_destination`, não podemos criar uma conta `pool` falsa usando o mesmo PDA. Adicione mais um teste mostrando que a nova instrução `initialize_pool_secure` não permitirá que um atacante coloque o cofre errado.

```typescript
it("Inicialização segura da conta pool não permite o cofre errado", async () => {
    try {
      await program.methods
        .initializePoolSecure()
        .accounts({
          pool: authSecure,
          mint: mint,
          vault: vaultInsecure.address,
          withdrawDestination: withdrawDestination,
        })
        .signers([vaultRecommended])
        .rpc()

      assert.fail("erro esperado")
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
})
```

Execute `anchor test` e veja que as novas instruções não permitem que um atacante retire de um cofre que não seja dele.

```
  pda-sharing
    ✔ Initialize Pool Insecure (981ms)
    ✔ Withdraw (470ms)
    ✔ Insecure initialize allows pool to be initialized with wrong vault (10983ms)
    ✔ Insecure withdraw allows stealing from vault (492ms)
    ✔ Secure pool initialization and withdraw works (2502ms)
unknown signer: ARjxAsEPj6YsAPKaBfd1AzUHbNPtAeUsqusAmBchQTfV
    ✔ Secure withdraw doesn't allow withdraw to wrong destination
unknown signer: GJcHJLot3whbY1aC9PtCsBYk5jWoZnZRJPy5uUwzktAY
    ✔ Secure pool initialization doesn't allow wrong vault
```

E é isso! Ao contrário de algumas outras vulnerabilidades de segurança que discutimos, esta é mais conceitual e não pode ser corrigida simplesmente usando um tipo específico do Anchor. Você precisará pensar na arquitetura do seu programa e garantir que não esteja compartilhando PDAs em diferentes domínios.

Se você quiser dar uma olhada no código da solução final, pode encontrá-lo na branch `solution` do [mesmo repositório](https://github.com/Unboxed-Software/solana-pda-sharing/tree/solution).

# Desafio

Assim como em outras lições deste módulo, sua oportunidade de praticar evitando esta exploração de segurança está em auditar seus próprios programas ou de outras pessoas.

Reserve um tempo para revisar pelo menos um programa e procurar por vulnerabilidades potenciais em sua estrutura de PDA. PDAs usados para assinaturas devem ser restritos e focados em um único domínio, tanto quanto possível.

Lembre-se, se você encontrar um bug ou exploração no programa de outra pessoa, por favor alerte-os! Se encontrar um no seu próprio programa, certifique-se de corrigi-lo imediatamente.
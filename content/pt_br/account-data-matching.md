---
title: Correspondência de Dados da Conta
objectives:
- Explicar os riscos de segurança associados à falta de verificações de validação de dados
- Implementar verificações de validação de dados usando Rust de formato longo
- Implementar verificações de validação de dados usando restrições Anchor
---

# RESUMO

- Use **verificações de validação de dados** para verificar se os dados da conta correspondem a um valor esperado**.** Sem as verificações de validação de dados apropriadas, contas inesperadas podem ser usadas em uma instrução.
- Para implementar verificações de validação de dados no Rust, basta comparar os dados armazenados em uma conta com um valor esperado.
    
    ```rust
    if ctx.accounts.user.key() != ctx.accounts.user_data.user {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```
    
-No Anchor, você pode usar `constraint` para verificar se a expressão fornecida é avaliada como verdadeira. Como alternativa, você pode usar `has_one` para verificar se um campo de conta de destino armazenado na conta corresponde à chave de uma conta na struct `Accounts`.

# Visão Geral

A correspondência de dados da conta refere-se a verificações de validação de dados usadas para checar se os dados armazenados em uma conta correspondem a um valor esperado. As verificações de validação de dados fornecem uma maneira de incluir restrições adicionais para garantir que as contas apropriadas passem para uma instrução. 

Isso pode ser útil quando as contas exigidas por uma instrução tiverem dependências de valores armazenados em outras contas ou se uma instrução dependa dos dados armazenados em uma conta.

### Verificação de validação de dados ausentes

O exemplo abaixo inclui uma instrução `update_admin` que atualiza o campo `admin` armazenado numa conta `admin_config`. 

A instrução não possui uma verificação de validação de dados para checar se a conta `admin` que assina a transação corresponde à `admin` armazenada na conta `admin_config`. Isso significa que qualquer conta que assine a transação e passe na instrução como a conta `admin` pode atualizar a conta `admin_config`.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Adicionar verificação de validação de dados

A abordagem básica do Rust para resolver esse problema é simplesmente comparar a chave `admin` que passou com a chave `admin` armazenada na conta `admin_config`, gerando um erro se não corresponderem.

```rust
if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

Ao adicionar uma verificação de validação de dados, a instrução `update_admin` só processaria se o signatário `admin` da transação correspondesse ao `admin` armazenado na conta `admin_config`.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
      if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Use restrições do Anchor

O Anchor simplifica isso com a restrição `has_one`. Você pode usar a restrição `has_one` para mover a verificação de validação de dados da lógica de instrução para a struct `UpdateAdmin`.

No exemplo abaixo, `has_one = admin` especifica que a conta `admin` que assina a transação deve corresponder ao campo `admin` armazenado na conta `admin_config`. Para usar a restrição `has_one`, a convenção de nomenclatura do campo de dados na conta deve ser consistente com a nomenclatura na struct de validação da conta.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

Como alternativa, você pode usar `constraint` para adicionar manualmente uma expressão que deve ser avaliada como verdadeira para que a execução continue. Isso é útil quando, por algum motivo, a nomenclatura não pode ser consistente ou quando você precisa de uma expressão mais complexa para validar totalmente os dados de entrada.

```rust
#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        constraint = admin_config.admin == admin.key()
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}
```

# Demonstração

Para esta demonstração, criaremos um programa "vault" simples, semelhante ao programa que usamos na lição Signer Authorization (Autorização de Signatário) e na lição Owner Check (Verificação do Proprietário). De forma semelhante a essas demonstrações, mostraremos aqui como a ausência de uma verificação de validação de dados pode permitir que o cofre seja drenado.

### 1. Início

Para começar, faça download do código inicial da branch `starter` [deste repositório](https://github.com/Unboxed-Software/solana-account-data-matching). O código inicial inclui um programa com duas instruções e a configuração padrão para o arquivo de teste. 

A instrução `initialize_vault` inicializa uma nova conta `Vault` uma nova `TokenAccount`. A conta `Vault` armazenará o endereço de uma conta de token, a autoridade do cofre e uma conta de token de destino de retirada.

A autoridade da nova conta de token será definida como o `vault`, um PDA, ou, personal digital assistant (assistente digital pessoal), do programa. Isso permite que a conta `vault` assine a transferência de tokens da conta de tokens. 

A instrução `insecure_withdraw` transfere todos os tokens na conta de token da conta `vault` para uma conta de token `withdraw_destination`. 

Observe que essa instrução ****de fato**** possui uma verificação de signatário para `authority` e uma verificação de proprietário para `vault`. Entretanto, em nenhum lugar da validação da conta ou da lógica da instrução há um código que verifique se a conta `authority` passada na instrução corresponde à conta `authority` na `vault`.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        ctx.accounts.vault.withdraw_destination = ctx.accounts.withdraw_destination.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InsecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
    withdraw_destination: Pubkey,
}
```

### 2. Teste a instrução `insecure_withdraw`

Para provar que isso é um problema, vamos escrever um teste em que uma conta que não seja a `authority` do cofre tenta sacar do cofre.

O arquivo de teste inclui o código para invocar a instrução `initialize_vault` usando a carteira do provedor como a `authority` e, em seguida, cunhar 100 tokens para a conta de token `vault`.

Adicione um teste para invocar a instrução `insecure_withdraw`. Use `withdrawDestinationFake` como a conta `withdrawDestination` e `walletFake` como a `authority`. Em seguida, envie a transação usando `walletFake`.

Como não há verificações para checar se a conta `authority` que passou na instrução corresponde aos valores armazenados na conta `vault` inicializada no primeiro teste, a instrução processará com êxito e os tokens serão transferidos para a conta `withdrawDestinationFake`.

```tsx
describe("account-data-matching", () => {
  ...
  it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestinationFake,
        authority: walletFake.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Run `anchor test` to see that both transactions will complete successfully.

```bash
account-data-matching
  ✔ Initialize Vault (811ms)
  ✔ Insecure withdraw (403ms)
```

### 3. Adicione a instrução `secure_withdraw`

Vamos implementar uma versão segura desta instrução chamada `secure_withdraw`.

Essa instrução será idêntica à instrução `insecure_withdraw`, exceto pelo fato de que usaremos a restrição `has_one` na struct de validação de conta (`SecureWithdraw`) para checar se a conta `authority` passada na instrução corresponde à conta `authority` na conta `vault`. Dessa forma, somente a conta authority correta pode retirar os tokens do cofre.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;
    ...
    pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
        has_one = token_account,
        has_one = authority,
        has_one = withdraw_destination,

    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

### 4. Teste a instrução `secure_withdraw`

Agora vamos testar a instrução `secure_withdraw` com dois testes: um que usa `walletFake` como autoridade e outro que usa `wallet` como autoridade. Esperamos que a primeira invocação retorne um erro e a segunda seja bem-sucedida.

```tsx
describe("account-data-matching", () => {
  ...
  it("Secure withdraw, expect error", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenPDA,
          withdrawDestination: withdrawDestinationFake,
          authority: walletFake.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Secure withdraw", async () => {
    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      tokenPDA,
      wallet.payer,
      100
    )

    await program.methods
      .secureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestination,
        authority: wallet.publicKey,
      })
      .rpc()

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Execute `anchor test` para ver que a transação que usa uma conta de autoridade incorreta agora retornará um Erro Anchor, enquanto a transação que usa contas corretas é concluída com êxito.

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: ConstraintHasOne. Error Number: 2001. Error Message: A has one constraint was violated.',
'Program log: Left:',
'Program log: DfLZV18rD7wCQwjYvhTFwuvLh49WSbXFeJFPQb5czifH',
'Program log: Right:',
'Program log: 5ovvmG5ntwUC7uhNWfirjBHbZD96fwuXDMGXiyMwPg87',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 10401 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d1'
```

Observe que o Anchor especifica nos logs a conta que causa o erro (`AnchorError caused by account: vault`).

```bash
✔ Secure withdraw, expect error (77ms)
✔ Secure withdraw (10073ms)
```

E, dessa forma, você fechou a brecha de segurança. A ideia sobre a maioria dessas possíveis explorações é que elas são bastante simples. Entretanto, à medida que seus programas crescem em escopo e complexidade, fica cada vez mais fácil deixar passar possíveis explorações. É ótimo ter o hábito de escrever testes que enviem instruções que *não* deveriam funcionar. Quanto mais, melhor. Dessa forma, você detecta os problemas antes da implantação.

Se quiser dar uma olhada no código da solução final, poderá encontrá-lo na branch `solution` do [repositório](https://github.com/Unboxed-Software/solana-account-data-matching/tree/solution).

# Desafio

Assim como nas outras lições deste módulo, sua oportunidade de praticar como evitar essa exploração de segurança está na auditoria de seus próprios programas ou de outros.

Dedique algum tempo para analisar pelo menos um programa e garantir que as verificações de dados adequadas estejam presentes para evitar explorações de segurança.

Lembre-se, se você encontrar um bug ou uma exploração no programa de outra pessoa, alerte-a! Se encontrar um bug em seu próprio programa, não deixe de corrigi-lo imediatamente.

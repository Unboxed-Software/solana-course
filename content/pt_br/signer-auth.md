---
title: Autorização de Signatário
objectives:
- Explicar os riscos de segurança associados à não realização de verificações adequadas de signatário
- Implementar verificações de signatários usando o Rust em formato longo
- Implementar verificações de signatários usando o tipo `Signer` do Anchor
- Implementar verificações de signatários usando a restrição `#[account(signer)]` do Anchor
---

# Resumo

- Utilize **Verificações de Signatários** para verificar se contas específicas assinaram uma transação. Sem verificações adequadas de signatários, contas podem ser capazes de executar instruções que não deveriam estar autorizadas a realizar.
- Para implementar uma verificação de signatário em Rust, basta verificar se a propriedade `is_signer` de uma conta é `true`
    
    ```rust
    if !ctx.accounts.authority.is_signer {
    	return Err(ProgramError::MissingRequiredSignature.into());
    }
    ```
    
- No Anchor, você pode usar o tipo de conta **`Signer`** na sua estrutura de validação de contas para que o Anchor realize automaticamente uma verificação de signatário em uma determinada conta.
- O Anchor também possui uma restrição de conta que verifica automaticamente se uma determinada conta assinou uma transação.

# Visão Geral

Verificações de signatários são usadas para verificar se o proprietário de uma conta específica autorizou uma transação. Sem uma verificação de signatário, operações cuja execução deve ser limitada apenas a contas específicas podem potencialmente ser realizadas por qualquer conta. No pior dos casos, isso pode resultar em carteiras sendo completamente drenadas por atacantes que passam qualquer conta que desejam para uma instrução.

### Falta de Verificação de Signatário

O exemplo abaixo mostra uma versão simplificada de uma instrução que atualiza o campo `authority` armazenado em uma conta do programa.

Note que o campo `authority` na estrutura de validação de conta `UpdateAuthority` é do tipo `AccountInfo`. No Anchor, o tipo de conta `AccountInfo` indica que nenhuma verificação é realizada na conta antes da execução da instrução.

Embora a restrição `has_one` seja usada para validar que a conta `authority` passada na instrução corresponde ao campo `authority` armazenado na conta `vault`, não há verificação para confirmar que a conta `authority` autorizou a transação.

Isso significa que um atacante pode simplesmente passar a chave pública da conta `authority` e sua própria chave pública como a conta `new_authority` para se reatribuir como a nova autoridade da conta `vault`. A partir desse ponto, ele pode interagir com o programa como a nova autoridade.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod insecure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
   #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### Adicionando verificações de autorização do signatário

Tudo o que você precisa fazer para validar que a conta `authority` assinou é adicionar uma verificação de signatário dentro da instrução. Isso simplesmente significa verificar se `authority.is_signer` é `true`, retornando um erro `MissingRequiredSignature` se for `false`.

```tsx
if !ctx.accounts.authority.is_signer {
    return Err(ProgramError::MissingRequiredSignature.into());
}
```

Ao adicionar uma verificação de signatário, a instrução só processará se a conta passada como a conta `authority` também assinou a transação. Se a transação não foi assinada pela conta passada como a conta `authority`, então a transação falhará.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
            if !ctx.accounts.authority.is_signer {
            return Err(ProgramError::MissingRequiredSignature.into());
        }

        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### Usando o tipo de conta `Signer` do Anchor

No entanto, colocar essa verificação na função de instrução confunde a separação entre validação de conta e lógica de instrução.

Felizmente, o Anchor facilita a realização de verificações de signatários ao fornecer o tipo de conta `Signer`. Basta mudar o tipo da conta `authority` na estrutura de validação de conta para ser do tipo `Signer`, e o Anchor verificará em tempo de execução que a conta especificada é signatária na transação. Esta é a abordagem que geralmente recomendamos, pois permite separar a verificação de signatário da lógica de instrução.

No exemplo abaixo, se a conta `authority` não assinar a transação, então a transação falhará antes mesmo de chegar à lógica de instrução.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Observe que quando você usa o tipo `Signer`, nenhuma outra verificação de propriedade ou tipo é realizada.

### Usando a restrição `#[account(signer)]` do Anchor

Embora na maioria dos casos, o tipo de conta `Signer` seja suficiente para garantir que uma conta assinou uma transação, o fato de que nenhuma outra verificação de propriedade ou tipo é realizada significa que essa conta não pode realmente ser usada para mais nada na instrução.

É aqui que a *restrição* `signer` se torna útil. A restrição `#[account(signer)]` permite que você verifique se a conta assinou a transação, ao mesmo tempo em que obtém os benefícios de usar o tipo `Account` se você também quiser acessar os dados subjacentes.

Como um exemplo de quando isso seria útil, imagine escrever uma instrução que você espera ser invocada via CPI, que espera que uma das contas passadas seja tanto **signatária** na transação quanto uma **fonte de dados**. Usar o tipo de conta `Signer` aqui remove a desserialização automática e a verificação de tipo que você obteria com o tipo `Account`. Isso é inconveniente, pois você precisa desserializar manualmente os dados da conta na lógica da instrução, e pode tornar seu programa vulnerável por não obter a verificação de propriedade e tipo realizada pelo tipo `Account`.

No exemplo abaixo, você pode, com segurança, escrever a lógica para interagir com os dados armazenados na conta `authority` ao mesmo tempo em que verifica se ela assinou a transação.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();

        // acessar os dados armazenados em autoridade
        msg!("Número total de depositantes: {}", ctx.accounts.authority.num_depositors);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    #[account(signer)]
    pub authority: Account<'info, AuthState>
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
#[account]
pub struct AuthState{
	amount: u64,
	num_depositors: u64,
	num_vaults: u64
}
```

# Demonstração

Vamos praticar criando um programa simples para demonstrar como a falta de uma verificação de signatário pode permitir que um atacante retire tokens que não lhe pertencem.

Este programa inicializa uma conta simplificada de "cofre" de token e demonstra como a falta de uma verificação de signatário poderia permitir que o cofre fosse esvaziado.

### 1. Código Inicial

Para começar, faça o download do código inicial da branch `starter` deste [repositório](https://github.com/Unboxed-Software/solana-signer-auth/tree/starter). O código inicial inclui um programa com duas instruções e a configuração básica para o arquivo de teste.

A instrução `initialize_vault` inicializa duas novas contas: `Vault` e `TokenAccount`. A conta `Vault` será inicializada usando um Endereço Derivado do Programa (PDA) e armazenará o endereço de uma conta de token e a autoridade do cofre. A autoridade da conta de token será o PDA `vault`, o que permite que o programa assine a transferência de tokens.

A instrução `insecure_withdraw` transferirá tokens da conta de token da conta `vault` para uma conta de token de `withdraw_destination`. No entanto, a conta `authority` na estrutura `InsecureWithdraw` tem um tipo de `UncheckedAccount`. Isso é um wrapper em torno de `AccountInfo` para indicar explicitamente que a conta não é verificada.

Sem uma verificação de signatário, qualquer um pode simplesmente fornecer a chave pública da conta `authority` que corresponde à `authority` armazenada na conta `vault` e a instrução `insecure_withdraw` continuaria a processar.

Embora isso seja um pouco forçado, já que qualquer programa DeFi com um cofre seria mais sofisticado do que isso, isso mostrará como a falta de uma verificação de signatário pode resultar em tokens sendo retirados pela parte errada.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
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
        space = 8 + 32 + 32,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
    )]
    pub token_account: Account<'info, TokenAccount>,
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
        has_one = token_account,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    /// CHECK: demonstração sem verificação de signatário
    pub authority: UncheckedAccount<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 2. Testando a instrução `insecure_withdraw`

O arquivo de teste inclui o código para invocar a instrução `initialize_vault` usando `wallet` como a `authority` no cofre. O código então emite 100 tokens para a conta de token `vault`. Teoricamente, a chave `wallet` deveria ser a única que pode retirar os 100 tokens do cofre.

Agora, vamos adicionar um teste para invocar `insecure_withdraw` no programa para mostrar que a versão atual do programa permite que um terceiro, de fato, retire esses 100 tokens.

No teste, ainda usaremos a chave pública de `wallet` como a conta `authority`, mas usaremos um par de chaves diferente para assinar e enviar a transação.

```tsx
describe("signer-authorization", () => {
    ...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenAccount.publicKey,
        withdrawDestination: withdrawDestinationFake,
        authority: wallet.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(
      tokenAccount.publicKey
    )
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Execute `anchor test` para ver que ambas as transações serão concluídas com sucesso.

```bash
signer-authorization
  ✔ Initialize Vault (810ms)
  ✔ Insecure withdraw  (405ms)
```

Como não há verificação de signatário para a conta `authority`, a instrução `insecure_withdraw` transferirá tokens da conta de token `vault` para a conta de token `withdrawDestinationFake`, desde que a chave pública da conta `authority` corresponda à chave pública armazenada no campo de autoridade da conta `vault`. Claramente, a instrução `insecure_withdraw` é tão insegura quanto o nome sugere.

### 3. Adicionando a instrução `secure_withdraw`

Vamos corrigir o problema em uma nova instrução chamada `secure_withdraw`. Esta instrução será idêntica à instrução `insecure_withdraw`, exceto que usaremos o tipo `Signer` na estrutura Accounts para validar a conta `authority` na estrutura `SecureWithdraw`. Se a conta `authority` não for signatária na transação, esperamos que a transação falhe e retorne um erro.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
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
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

### 4. Testando a instrução `secure_withdraw`

Com a instrução no lugar, retorne ao arquivo de teste para testar a instrução `secure_withdraw`. Chame a instrução `secure_withdraw`, novamente usando a chave pública de `wallet` como a conta `authority` e o par de chaves `withdrawDestinationFake` como o signatário e destino da retirada. Como a conta `authority` é validada usando o tipo `Signer`, esperamos que a transação falhe na verificação de signatário e retorne um erro.

```tsx
describe("signer-authorization", () => {
    ...
	it("Retirada segura", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenAccount.publicKey,
          withdrawDestination: withdrawDestinationFake,
          authority: wallet.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

Execute `anchor test` para ver que a transação agora retornará um erro de verificação de assinatura.

```bash
Error: Signature verification failed
```

E pronto! Tudo isso é bem simples de evitar, mas incrivelmente importante. Certifique-se de sempre pensar em quem deve estar autorizando instruções e garantir que cada um seja um signatário na transação.

Se você quiser dar uma olhada no código da solução final, pode encontrá-lo na branch `solution` deste [repositório](https://github.com/Unboxed-Software/solana-signer-auth/tree/solution).

# Desafio

Neste ponto do curso, esperamos que você tenha começado a trabalhar em programas e projetos fora das Demonstrações e Desafios fornecidos nestas lições. Para esta e as demais lições sobre vulnerabilidades de segurança, o Desafio de cada lição será auditar seu próprio código quanto à vulnerabilidade de segurança discutida na lição.

Alternativamente, você pode encontrar programas de código aberto para auditar. Há muitos programas que você pode analisar. Um bom começo, se você não se importar em mergulhar no Rust nativo, seriam os [programas SPL](https://github.com/solana-labs/solana-program-library).

Então, para esta lição, analise um programa (seja seu ou um que você encontrou online) e audite-o para verificações de signatários. Se você encontrar um bug no programa de outra pessoa, por favor, alerte-os! Se você encontrar um bug no seu próprio programa, certifique-se de corrigi-lo imediatamente.
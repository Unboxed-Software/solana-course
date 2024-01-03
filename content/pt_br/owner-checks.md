---
title: Verificação de Proprietário
objectives:
- Explicar os riscos de segurança associados à falta de verificação apropriada do proprietário.
- Implementar verificações de proprietário usando o Rust de forma detalhada.
- Usar o wrapper `Account<'info, T>` do Anchor e um tipo de conta para automatizar verificações de proprietário.
- Usar a restrição `#[account(owner = <expr>)]` do Anchor para definir explicitamente um programa externo que deve ser o proprietário de uma conta.
---

# Resumo

- Utilize as **Verificações de Proprietário** para garantir que as contas sejam de propriedade do programa esperado. Sem verificações de proprietário adequadas, contas pertencentes a programas inesperados podem ser usadas em uma instrução
- Para implementar uma verificação de proprietário em Rust, basta verificar se o proprietário de uma conta corresponde a um ID de programa esperado

```rust
if ctx.accounts.account.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

- Os tipos de conta do programa Anchor implementam o traço `Owner`, o que permite que o wrapper `Account<'info, T>` verifique automaticamente a propriedade do programa
- O Anchor oferece a opção de definir explicitamente o proprietário de uma conta se for diferente do programa atualmente em execução

# Visão Geral

As verificações de proprietário são usadas para garantir que uma conta passada para uma instrução seja de propriedade de um programa esperado. Isso impede que contas pertencentes a programas inesperados sejam usadas em uma instrução.

Como lembrete, a struct `AccountInfo` contém os seguintes campos. Uma verificação de proprietário refere-se à verificação de que o campo `owner` na `AccountInfo` corresponde a um ID de programa esperado.

```jsx
/// Informações da conta
#[derive(Clone)]
pub struct AccountInfo<'a> {
    /// Chave pública da conta
    pub key: &'a Pubkey,
    /// A transação foi assinada por esta chave pública da conta?
    pub is_signer: bool,
    /// A conta pode ser escrita?
    pub is_writable: bool,
    /// Os lamports na conta. Modificável por programas.
    pub lamports: Rc<RefCell<&'a mut u64>>,
    /// Os dados mantidos nesta conta. Modificável por programas.
    pub data: Rc<RefCell<&'a mut [u8]>>,
    /// Programa que é proprietário desta conta
    pub owner: &'a Pubkey,
    /// Os dados desta conta contêm um programa carregado (e agora são somente leitura)
    pub executable: bool,
    /// A época em que esta conta deverá pagar aluguel na próxima vez
    pub rent_epoch: Epoch,
}
```

### Verificação do proprietário ausente

O exemplo abaixo mostra uma `admin_instruction` destinada a ser acessível apenas por uma conta `admin` armazenada em uma conta `admin_config`.

Embora a instrução verifique se a conta `admin` assinou a transação e corresponde ao campo `admin` armazenado na conta `admin_config`, não há verificação de propriedade para verificar se a conta `admin_config` passada para a instrução é de propriedade do programa em execução.

Uma vez que o `admin_config` não é verificado, conforme indicado pelo tipo `AccountInfo`, uma conta `admin_config` falsa de propriedade de um programa diferente poderia ser usada na `admin_instruction`. Isso significa que um atacante poderia criar um programa com um campo `admin_config` cuja estrutura de dados corresponde ao `admin_config` do seu programa, definir sua chave pública como o `admin` e passar sua conta `admin_config` para o seu programa. Isso permitiria que o atacante enganasse o seu programa, fazendo-o pensar que é o administrador autorizado.

Este exemplo simplificado apenas imprime o `admin` nos registros do programa. No entanto, é possível imaginar como a falta de verificação de propriedade poderia permitir que contas falsas explorem a instrução.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...

    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Adicionando verificação de proprietário

Em Rust convencional, você pode resolver esse problema comparando o campo `owner` na conta com o ID do programa. Se eles não corresponderem, você retornaria um erro `IncorrectProgramId`.

```rust
if ctx.accounts.admin_config.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

Adicionar uma verificação de proprietário impede que contas de propriedade de um programa inesperado sejam passadas como a conta `admin_config`. Se uma conta `admin_config` falsa fosse usada na `admin_instruction`, a transação falharia.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IncorrectProgramId.into());
        }

        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Usando `Account<'info, T>` do Anchor

O Anchor pode simplificar isso com o tipo `Account`.

`Account<'info, T>` é um wrapper que envolve `AccountInfo` e verifica a propriedade do programa e desserializa os dados subjacentes no tipo de conta especificado `T`. Isso permite que você use `Account<'info, T>` para validar facilmente a propriedade.

Para contextualizar, o atributo `#[account]` implementa vários traits para uma estrutura de dados que representa uma conta. Um deles é o trait `Owner`, que define um endereço que se espera ser o proprietário de uma conta. O proprietário é definido como o ID do programa especificado na macro `declare_id!`.

No exemplo abaixo, `Account<'info, AdminConfig>` é usado para validar o `admin_config`. Isso realizará automaticamente a verificação do proprietário e desserializará os dados da conta. Além disso, a restrição `has_one` é usada para verificar se a conta `admin` corresponde ao campo `admin` armazenado na conta `admin_config`.

Dessa forma, você não precisa poluir a lógica da instrução com verificações de proprietário.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Usando a restrição `#[account(owner = <expr>)]` do Anchor

Além do tipo `Account`, você pode usar uma restrição `owner`. A restrição `owner` permite que você defina o programa que deve ser proprietário de uma conta se for diferente do programa em execução no momento. Isso é útil, por exemplo, se você estiver escrevendo uma instrução que espera que uma conta seja derivada de um PDA de um programa diferente. Você pode usar as restrições `seeds` e `bump` e definir `owner` para derivar e verificar adequadamente o endereço da conta passada.

Para usar a restrição `owner`, você precisará ter acesso à chave pública do programa que espera ser proprietário de uma conta. Você pode passar o programa como uma conta adicional ou codificar rigidamente a chave pública em algum lugar do seu programa

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
    #[account(
            seeds = b"test-seed",
            bump,
            owner = token_program.key()
    )]
    pda_derived_from_another_program: AccountInfo<'info>,
    token_program: Program<'info, Token>
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

# Demonstração

Nesta demonstração, usaremos dois programas para mostrar como a falta de verificação de proprietário pode permitir que uma conta falsa drenasse os tokens de uma conta "cofre" (vault) de token simplificada (observe que isso é muito semelhante à demonstração da lição de Autorização de Signatários).

Para ilustrar isso, um dos programas estará sem uma verificação de proprietário na conta de cofre para a qual ele retira os tokens.

O segundo programa será um clone direto do primeiro programa criado por um usuário malicioso para criar uma conta idêntica à conta de cofre do primeiro programa.

Sem a verificação de proprietário, esse usuário malicioso poderá passar a conta de cofre de propriedade de seu programa "falso" e o programa original ainda será executado.

### 1. Código Inicial

Para começar, faça o download do código inicial na branch `starter` deste repositório: [link para o repositório](https://github.com/Unboxed-Software/solana-owner-checks/tree/starter). O código inicial inclui dois programas, `clone` e `owner_check`, e a configuração mais repetitiva para o arquivo de teste.

O programa `owner_check` inclui duas instruções:

- `initialize_vault` inicializa uma conta de cofre simplificada que armazena os endereços de uma conta de token e uma conta de autoridade
- `insecure_withdraw` retira tokens da conta de token, mas está sem uma verificação de proprietário para a conta de cofre

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB");

#[program]
pub mod owner_check {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let account_data = ctx.accounts.vault.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = Vault::try_deserialize(&mut account_data_slice)?;

        if account_state.authority != ctx.accounts.authority.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
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
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = token_account,
        seeds = [b"token"],
        bump,
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
    /// Verificação:
    pub vault: UncheckedAccount<'info>,
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
}
```

O programa `clone` inclui uma única instrução:

- `initialize_vault` inicializa uma conta "cofre" que imita a conta de cofre do programa `owner_check`. Ela armazena o endereço da conta de token real do cofre, mas permite que o usuário malicioso coloque sua própria conta de autoridade.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

declare_id!("DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3");

#[program]
pub mod clone {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32,
    )]
    pub vault: Account<'info, Vault>,
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 2. Testando a instrução `insecure_withdraw`

O arquivo de teste inclui um teste para invocar a instrução `initialize_vault` no programa `owner_check`, usando a carteira do fornecedor como a `authority`, e então cria 100 tokens na conta de token.

O arquivo de teste também inclui um teste para invocar a instrução `initialize_vault` no programa `clone`, a fim de inicializar uma conta `vault` falsa armazenando a mesma conta `tokenPDA`, mas com uma `authority` diferente. Observe que nenhum token novo é criado aqui.

Vamos adicionar um teste para invocar a instrução `insecure_withdraw`. Este teste deve passar a conta de cofre clonada e a de autoridade falsa. Como não há verificação de proprietário para verificar se a conta `vaultClone` é de propriedade do programa `owner_check`, a verificação de dados da instrução passará e mostrará `walletFake` como uma autoridade válida. Os tokens da conta `tokenPDA` serão então retirados para a conta `withdrawDestinationFake`.

```tsx
describe("owner-check", () => {
	...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
        .insecureWithdraw()
        .accounts({
            vault: vaultClone.publicKey,
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

Execute `anchor test` para verificar se a instrução `insecure_withdraw` é concluída com sucesso.

```bash
owner-check
  ✔ Initialize Vault (808ms)
  ✔ Initialize Fake Vault (404ms)
  ✔ Insecure withdraw (409ms)
```

Observe que `vaultClone` é desserializado com sucesso, mesmo que o Anchor inicialize automaticamente novas contas com um discriminador exclusivo de 8 bytes e verifique o discriminador ao desserializar uma conta. Isso ocorre porque o discriminador é um hash do nome do tipo de conta.

```rust
#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Como ambos os programas inicializam contas idênticas e ambas as estruturas são nomeadas `Vault`, as contas têm o mesmo discriminador, mesmo que sejam de propriedade de programas diferentes.

### 3. Adicionando a instrução `secure_withdraw`

Vamos fechar essa brecha de segurança.

No arquivo `lib.rs` do programa `owner_check`, adicione uma instrução `secure_withdraw` e uma struct de contas `SecureWithdraw`.

Na struct `SecureWithdraw`, vamos usar `Account<'info, Vault>` para garantir que uma verificação de proprietário seja realizada na conta `vault`. Também usaremos a restrição `has_one` para verificar se as contas `token_account` e `authority` passadas na instrução correspondem aos valores armazenados na conta `vault`.

```rust
#[program]
pub mod owner_check {
    use super::*;
	...

	pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}
...

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
       has_one = token_account,
       has_one = authority
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

### 4. Testando a instrução `secure_withdraw`

Para testar a instrução `secure_withdraw`, a invocaremos duas vezes. Primeiro, a invocaremos usando a conta `vaultClone`, que esperamos que falhe. Em seguida, a invocaremos usando a conta `vault` correta para verificar se a instrução funciona conforme o esperado.

```tsx
describe("owner-check", () => {
	...
	it("Secure withdraw, expect error", async () => {
        try {
            const tx = await program.methods
                .secureWithdraw()
                .accounts({
                    vault: vaultClone.publicKey,
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
            vault: vault.publicKey,
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

Execute `anchor test` para verificar se a transação usando a conta `vaultClone` agora retornará um erro do Anchor, enquanto a transação usando a conta `vault` será concluída com sucesso.

```bash
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: AccountOwnedByWrongProgram. Error Number: 3007. Error Message: The given account is owned by a different program than expected.',
'Program log: Left:',
'Program log: DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3',
'Program log: Right:',
'Program log: HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB consumed 5554 of 200000 compute units',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB failed: custom program error: 0xbbf'
```

Aqui, vemos como o uso do tipo `Account<'info, T>` do Anchor pode simplificar o processo de validação de contas para automatizar a verificação de propriedade. Além disso, observe que os erros do Anchor podem especificar a conta que causa o erro (por exemplo, a terceira linha dos registros acima diz `AnchorError caused by account: vault.`). Isso pode ser muito útil ao depurar.

```bash
✔ Secure withdraw, expect error (78ms)
✔ Secure withdraw (10063ms)
```

Isso é tudo o que você precisa fazer para garantir a verificação de proprietário em uma conta! Como em outras explorações, é relativamente simples evitar, mas muito importante. Certifique-se sempre de pensar em quais contas devem ser de propriedade de quais programas e adicione a validação apropriada.

Se você quiser dar uma olhada no código da solução final, você pode encontrá-lo na branch `solution` deste [repositório](https://github.com/Unboxed-Software/solana-owner-checks/tree/solution).

# Desafio

Assim como em outras lições deste módulo, sua oportunidade de praticar a prevenção dessa exploração de segurança está em auditar seus próprios programas ou outros programas.

Dedique algum tempo para revisar pelo menos um programa e garantir que as verificações de proprietário adequadas sejam realizadas nas contas passadas para cada instrução.

Lembre-se, se encontrar um bug ou exploração no programa de outra pessoa, por favor, alerte-os! Se encontrar um em seu próprio programa, certifique-se de corrigi-lo imediatamente.

---
title: Cosplay de Tipos
objectives:
- Explicar os riscos de segurança associados à não verificação de tipos de contas
- Implementar um discriminador de tipo de conta usando Rust em formato longo
- Utilizar a restrição `init` do Anchor para inicializar contas
- Utilizar o tipo `Account` do Anchor para validação de contas
---

# Resumo

- Utilize discriminadores para distinguir entre diferentes tipos de contas
- Para implementar um discriminador em Rust, inclua um campo na estrutura da conta para representar o tipo de conta

    ```rust
    #[derive(BorshSerialize, BorshDeserialize)]
    pub struct User {
        discriminant: AccountDiscriminant,
        user: Pubkey,
    }

    #[derive(BorshSerialize, BorshDeserialize, PartialEq)]
    pub enum AccountDiscriminant {
        User,
        Admin,
    }
    ```

- Para implementar uma verificação de discriminador em Rust, verifique se o discriminador dos dados da conta desserializada corresponde ao valor esperado

    ```rust
    if user.discriminant != AccountDiscriminant::User {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```

- No Anchor, os tipos de conta de programa implementam automaticamente o trait `Discriminator`, que cria um identificador único de 8 bytes para um tipo
- Use o tipo `Account<'info, T>` do Anchor para verificar automaticamente o discriminador da conta ao desserializar os dados da conta

# Visão Geral

"Cosplay de tipos" refere-se ao uso de um tipo de conta inesperado no lugar de um tipo de conta esperado. Internamente, os dados da conta são simplesmente armazenados como um array de bytes que um programa desserializa em um tipo de conta personalizado. Sem implementar uma maneira de distinguir explicitamente entre tipos de contas, os dados da conta de um tipo inesperado podem resultar em uma instrução sendo usada de maneiras não intencionais.

### Conta não verificada

No exemplo abaixo, tanto os tipos de conta `AdminConfig` quanto `UserConfig` armazenam uma única chave pública. A instrução `admin_instruction` desserializa a conta `admin_config` como um tipo `AdminConfig` e, em seguida, realiza uma verificação de proprietário e uma verificação de validação de dados.

No entanto, os tipos de conta `AdminConfig` e `UserConfig` têm a mesma estrutura de dados. Isso significa que um tipo de conta `UserConfig` pode ser passado como `admin_config`. Contanto que a chave pública armazenada nos dados da conta corresponda ao `admin` que assina a transação, a instrução `admin_instruction` continuaria a processar, mesmo que o signatário não seja realmente um administrador.

Observe que os nomes dos campos armazenados nos tipos de conta (`admin` e `user`) não fazem diferença ao desserializar dados da conta. Os dados são serializados e desserializados com base na ordem dos campos, e não em seus nomes.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_insecure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    user: Pubkey,
}
```

### Adicionando o discriminador de conta

Para resolver isso, você pode adicionar um campo discriminante para cada tipo de conta e definir o discriminante ao inicializar uma conta.

O exemplo abaixo atualiza os tipos de conta `AdminConfig` e `UserConfig` com um campo `discriminant`. A instrução `admin_instruction` inclui uma verificação adicional de validação de dados para o campo `discriminant`.

```rust
if account_data.discriminant != AccountDiscriminant::Admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

Se o campo `discriminant` da conta passada para a instrução como a conta `admin_config` não corresponder ao `AccountDiscriminant` esperado, então a transação falhará. Basta garantir que o valor apropriado para `discriminant` seja definido ao inicializar cada conta (não mostrado no exemplo), e então você pode incluir essas verificações de discriminante em todas as instruções subsequentes.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_secure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        if account_data.discriminant != AccountDiscriminant::Admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    discriminant: AccountDiscriminant,
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    discriminant: AccountDiscriminant,
    user: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq)]
pub enum AccountDiscriminant {
    Admin,
    User,
}
```

### Utilizando o wrapper `Account` do Anchor

Implementar essas verificações para cada conta necessária em cada instrução pode ser tedioso. Felizmente, o Anchor fornece uma macro de atributo `#[account]` para implementar automaticamente traits que toda conta deve ter.

Structs marcadas com `#[account]` podem então ser usadas com `Account` para validar que a conta passada é de fato o tipo que você espera que seja. Ao inicializar uma conta cuja representação de struct possui o atributo `#[account]`, os primeiros 8 bytes são automaticamente reservados para um discriminador único para o tipo de conta. Ao desserializar os dados da conta, o Anchor verificará automaticamente se o discriminador na conta corresponde ao tipo de conta esperado e lançará um erro se não corresponder.

No exemplo abaixo, `Account<'info, AdminConfig>` especifica que a conta `admin_config` deve ser do tipo `AdminConfig`. O Anchor então verifica automaticamente se os primeiros 8 bytes dos dados da conta correspondem ao discriminador do tipo `AdminConfig`.

A verificação de validação de dados para o campo `admin` também é movida da lógica da instrução para a estrutura de validação da conta usando a restrição `has_one`. `#[account(has_one = admin)]` especifica que o campo `admin` da conta `admin_config` deve corresponder à conta `admin` passada para a instrução. Observe que, para a restrição `has_one` funcionar, a nomeação da conta na struct deve corresponder à nomeação do campo na conta que você está validando.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_recommended {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        msg!("Admin {}", ctx.accounts.admin_config.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    #[account(has_one = admin)]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct UserConfig {
    user: Pubkey,
}
```

É importante observar que esta é uma vulnerabilidade com a qual você realmente não precisa se preocupar ao usar o Anchor - essa é a ideia principal desde o início! Após entender como isso pode ser explorado se não for tratado adequadamente em um programa nativo em Rust, esperamos que você tenha uma compreensão muito melhor do propósito do discriminador de conta em uma conta Anchor. O fato de o Anchor definir e verificar automaticamente esse discriminador significa que os desenvolvedores podem passar mais tempo focando em seu produto, mas ainda é muito importante entender o que o Anchor está fazendo nos bastidores para desenvolver programas robustos na Solana.

# Demonstração

Para esta demonstração, criaremos dois programas para demonstrar uma vulnerabilidade de cosplay de tipos.

- O primeiro programa inicializará contas de programa sem um discriminador
- O segundo programa inicializará contas de programa usando a restrição `init` do Anchor, que define automaticamente um discriminador de conta

### 1. Código Inicial

Para começar, faça o download do código inicial da branch `starter` deste [repositório](https://github.com/Unboxed-Software/solana-type-cosplay/tree/starter). O código inicial inclui um programa com três instruções e alguns testes.

As três instruções são:

1. `initialize_admin` - inicializa uma conta de administrador e define a autoridade de administração do programa
2. `initialize_user` - inicializa uma conta de usuário padrão
3. `update_admin` - permite que o administrador existente atualize a autoridade de administração do programa

Dê uma olhada nessas três instruções no arquivo `lib.rs`. A última instrução só deve ser chamada pela conta que corresponde ao campo `admin` na conta de administrador inicializada usando a instrução `initialize_admin`.

### 2. Testando a instrução insegura `update_admin`

No entanto, ambas as contas têm os mesmos campos e tipos de campos:

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    user: Pubkey,
}
```

Devido a isso, é possível passar uma conta `User` no lugar da conta `admin` na instrução `update_admin`, contornando assim o requisito de ser um administrador para chamar esta instrução.

Dê uma olhada no arquivo `solana-type-cosplay.ts` na pasta `tests`. Ele contém algumas configurações básicas e dois testes. Um teste inicializa uma conta de usuário e o outro invoca `update_admin` e passa a conta do usuário no lugar de uma conta de administrador.

Execute `anchor test` para ver que invocar `update_admin` será concluído com sucesso.

```bash
  type-cosplay
    ✔ Initialize User Account (233ms)
    ✔ Invoke update admin instruction with user account (487ms)
```

### 3. Criando o programa `type-checked`

Agora vamos criar um novo programa chamado `type-checked` executando `anchor new type-checked` a partir da raiz do programa anchor existente.

Agora, na sua pasta `programs`, você terá dois programas. Execute `anchor keys list` e você deverá ver o ID do programa para o novo programa. Adicione-o ao arquivo `lib.rs` do programa `type-checked` e ao programa `type_checked` no arquivo `Anchor.toml`.

Em seguida, atualize a configuração do arquivo de teste para incluir o novo programa e dois novos pares de chaves para as contas que inicializaremos para o novo programa.

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { TypeCosplay } from "../target/types/type_cosplay"
import { TypeChecked } from "../target/types/type_checked"
import { expect } from "chai"

describe("type-cosplay", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.TypeCosplay as Program<TypeCosplay>
  const programChecked = anchor.workspace.TypeChecked as Program<TypeChecked>

  const userAccount = anchor.web3.Keypair.generate()
  const newAdmin = anchor.web3.Keypair.generate()

  const userAccountChecked = anchor.web3.Keypair.generate()
  const adminAccountChecked = anchor.web3.Keypair.generate()
})
```

### 4. Implementando o programa `type-checked`

No programa `type_checked`, adicione duas instruções usando a restrição `init` para inicializar uma conta `AdminConfig` e uma conta `User`. Ao usar a restrição `init` para inicializar novas contas de programa, o Anchor definirá automaticamente os primeiros 8 bytes dos dados da conta como um discriminador único para o tipo de conta.

Também adicionaremos uma instrução `update_admin` que valida a conta `admin_config` como um tipo de conta `AdminConfig` usando o wrapper `Account` do Anchor. Para qualquer conta passada como a conta `admin_config`, o Anchor verificará automaticamente se o discriminador da conta corresponde ao tipo de conta esperado.

```rust
use anchor_lang::prelude::*;

declare_id!("FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7");

#[program]
pub mod type_checked {
    use super::*;

    pub fn initialize_admin(ctx: Context<InitializeAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.user_account.user = ctx.accounts.user.key();
        Ok(())
    }

    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeAdmin<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32
    )]
    pub user_account: Account<'info, User>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    pub new_admin: SystemAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct User {
    user: Pubkey,
}
```

### 5. Testando a instrução segura `update_admin`

No arquivo de teste, inicializaremos uma conta `AdminConfig` e uma conta `User` do programa `type_checked`. Em seguida, invocaremos a instrução `updateAdmin` duas vezes passando as contas recém-criadas.

```rust
describe("type-cosplay", () => {
	...

  it("Inicializar conta AdminConfig com verificação de tipo", async () => {
    await programChecked.methods
      .initializeAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
      })
      .signers([adminAccountType])
      .rpc()
  })

  it("Inicializar conta User com verificação de tipo", async () => {
    await programChecked.methods
      .initializeUser()
      .accounts({
        userAccount: userAccountType.publicKey,
        user: provider.wallet.publicKey,
      })
      .signers([userAccountType])
      .rpc()
  })

  it("Invocar instrução de atualização usando a conta User", async () => {
    try {
      await programChecked.methods
        .updateAdmin()
        .accounts({
          adminConfig: userAccountType.publicKey,
          newAdmin: newAdmin.publicKey,
          admin: provider.wallet.publicKey,
        })
        .rpc()
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Invocar instrução de atualização usando a conta AdminConfig", async () => {
    await programChecked.methods
      .updateAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
        newAdmin: newAdmin.publicKey,
        admin: provider.wallet.publicKey,
      })
      .rpc()
  })
})
```

Execute `anchor test`. Para a transação onde passamos o tipo de conta `User`, esperamos a instrução e retornamos um erro do Anchor devido a conta não ser do tipo `AdminConfig`.

```bash
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 invoke [1]',
'Program log: Instruction: UpdateAdmin',
'Program log: AnchorError caused by account: admin_config. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 consumed 4765 of 200000 compute units',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 failed: custom program error: 0xbba'
```

Seguir as melhores práticas do Anchor e usar os tipos do Anchor garantirá que seus programas evitem essa vulnerabilidade. Sempre use o atributo `#[account]` ao criar structs de conta, use a restrição `init` ao inicializar contas e use o tipo `Account` em suas structs de validação de conta.

Se você quiser dar uma olhada no código da solução final, pode encontrá-lo na branch `solution` do [repositório](https://github.com/Unboxed-Software/solana-type-cosplay/tree/solution).

# Desafio

Assim como em outras lições deste módulo, sua oportunidade de praticar como evitar essa exploração de segurança está na auditoria de seus próprios programas ou de outros desenvolvedores.

Reserve um tempo para revisar pelo menos um programa e garantir que os tipos de conta tenham um discriminador e que esses sejam verificados para cada conta e instrução. Como os tipos padrão do Anchor lidam automaticamente com essa verificação, é mais provável que você encontre uma vulnerabilidade em um programa nativo.

Lembre-se, se você encontrar um bug ou exploração no programa de outra pessoa, por favor, alerte-os! Se encontrar um no seu próprio programa, certifique-se de corrigi-lo imediatamente.

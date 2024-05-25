---
title: Ataques de Reinicialização
objectives:
- Explicar os riscos de segurança associados a uma vulnerabilidade de reinicialização
- Usar o formato longo do Rust para verificar se uma conta já foi inicializada
- Usar a restrição `init` do Anchor para inicializar contas, que define automaticamente um discriminador de contas que é verificado para evitar a reinicialização de uma conta.
---

# RESUMO

- Use um discriminador de conta ou um sinalizador de inicialização para verificar se uma conta já foi inicializada e evitar sua reinicialização e a substituição dos dados existentes da conta.
- Para evitar a reinicialização da conta em Rust simples, inicialize as contas com um sinalizador `is_initialized` e verifique se ele já foi definido como true ao inicializar uma conta.
  ```rust
  if account.is_initialized {
      return Err(ProgramError::AccountAlreadyInitialized.into());
  }
  ```
- Para simplificar isso, use a restrição `init` do Anchor para criar uma conta por meio de uma CPI para o programa do sistema e defina seu discriminador.

# Visão Geral

A inicialização refere-se à configuração dos dados de uma nova conta pela primeira vez. Ao inicializar uma nova conta, você deve implementar uma maneira de checar se a conta já foi inicializada. Sem uma verificação apropriada, uma conta existente poderia ser reinicializada e ter os dados existentes sobrescritos.

Observe que a inicialização de uma conta e a criação de uma conta são duas instruções distintas. A criação de uma conta requer a invocação da instrução `create_account` no programa do sistema, que especifica o espaço necessário para a conta, o aluguel em lamports alocado para a conta e o proprietário da conta do programa. A inicialização é uma instrução que define os dados de uma conta recém-criada. A criação e a inicialização de uma conta podem ser combinadas em uma única transação.

### Falta de Verificação de Inicialização

No exemplo abaixo, não há verificações na conta `user`. A instrução `initialize` desserializa os dados da conta `user` como um tipo de conta `User`, define o campo `authority` e serializa os dados atualizados da conta para a conta `user`.

Sem verificações na conta `user`, a mesma conta poderia ser passada para a instrução `initialize` uma segunda vez por outra parte para sobrescrever a `authority` existente armazenada nos dados da conta.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_insecure  {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### Adicione a verificação `is_initialized`

Uma abordagem para corrigir isso é adicionar um campo extra `is_initialized` ao tipo de conta `User` e usá-lo como um sinalizador para verificar se uma conta já foi inicializada.

```jsx
if user.is_initialized {
    return Err(ProgramError::AccountAlreadyInitialized.into());
}
```

Ao incluir uma verificação na instrução `initialize`, a conta `user` só seria inicializada se o campo `is_initialized` ainda não tivesse sido definido como verdadeiro. Se o campo `is_initialized` já estivesse definido, a transação falharia, evitando assim o cenário em que um invasor pudesse substituir a autoridade da conta por sua própria chave pública.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_secure {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        if user.is_initialized {
            return Err(ProgramError::AccountAlreadyInitialized.into());
        }

        user.authority = ctx.accounts.authority.key();
        user.is_initialized = true;

        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    is_initialized: bool,
    authority: Pubkey,
}
```

### Use a restrição `init` do Anchor

O Anchor fornece uma restrição `init` que pode ser utilizada com o atributo `#[account(...)]` para inicializar uma conta. A restrição `init` cria a conta por meio de uma CPI para o programa do sistema e define o discriminador de contas.

A restrição `init` deve ser usada em conjunto com as restrições `payer` e `space`. O `payer` especifica a conta que está pagando pela inicialização da nova conta. O `space` especifica a quantidade de espaço necessário para a nova conta, o que determina a quantidade de lamports que devem ser alocados para a conta. Os primeiros 8 bytes de dados são definidos como um discriminador que o Anchor adiciona automaticamente para identificar o tipo de conta.

O mais importante para esta lição é que a restrição `init` garante que essa instrução só possa ser chamada por cada conta uma vez, de modo que você possa definir o estado inicial da conta na lógica da instrução e não precise se preocupar com a possibilidade de um invasor tentar reinicializar a conta.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_recommended {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("GM");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct User {
    authority: Pubkey,
}
```

### Restrição `init_if_needed` do Anchor

Vale a pena observar que o Anchor tem uma restrição `init_if_needed`. Essa restrição deve ser usada com muita cautela. Na verdade, ela está bloqueada por trás de um sinalizador de recurso para que você seja forçado a usá-la somente quando tiver intenção.

A restrição `init_if_needed` faz a mesma coisa que a restrição `init`, mas se a conta já tiver sido inicializada, a instrução ainda será executada.

Por isso, é *********extremamente********* importante que, ao utilizar essa restrição, você inclua verificações para evitar a redefinição da conta para seu estado inicial.

Por exemplo, se a conta armazena um campo `authority` que é definido na instrução por meio da restrição `init_if_needed`, você precisa de verificações que garantam que nenhum invasor possa chamar a instrução depois que ela já tiver sido inicializada e fazer com que o campo `authority` seja definido novamente.

Na maioria dos casos, é mais seguro ter uma instrução separada para inicializar os dados da conta.

# Demonstração

Para esta demonstração, criaremos um programa simples que não faz nada além de inicializar contas. Incluiremos duas instruções:

- `insecure_initialization` - inicializa uma conta que pode ser reinicializada
- `recommended_initialization` - inicializa uma conta usando a restrição `init` do Anchor

### 1. Início

Para começar, baixe o código inicial `starter` da branch deste [repositório](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/starter). O código inicial inclui um programa com uma instrução e a configuração padrão para o arquivo de teste. 

A instrução `insecure_initialization` inicializa uma nova conta de "usuário" que armazena a chave pública de uma `authority`. Nessa instrução, espera-se que a conta seja alocada no lado do cliente e, em seguida, passada para a instrução do programa. Uma vez passada para o programa, não há verificações para saber se o estado inicial da conta `user` já foi definido. Isso significa que a mesma conta pode ser passada uma segunda vez para substituir a `authority` armazenada em uma conta `user` existente.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;

    pub fn insecure_initialization(ctx: Context<Unchecked>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    #[account(mut)]
    /// CHECK:
    user: UncheckedAccount<'info>,
    authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### 2. Teste a instrução `insecure_initialization`

O arquivo de teste inclui a configuração para criar uma conta invocando o programa do sistema e, em seguida, invoca a instrução `insecure_initialization` duas vezes usando a mesma conta. 

Como não há verificações para confirmar se os dados da conta já foram inicializados, a instrução `insecure_initialization` será concluída com êxito nas duas vezes, apesar de a segunda invocação fornecer uma conta de autoridade *diferente*.

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { Initialization } from "../target/types/initialization"

describe("initialization", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Initialization as Program<Initialization>

  const wallet = anchor.workspace.Initialization.provider.wallet
  const walletTwo = anchor.web3.Keypair.generate()

  const userInsecure = anchor.web3.Keypair.generate()
  const userRecommended = anchor.web3.Keypair.generate()

  before(async () => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: userInsecure.publicKey,
        space: 32,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
          32
        ),
        programId: program.programId,
      })
    )

    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      wallet.payer,
      userInsecure,
    ])

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        walletTwo.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    )
  })

  it("Insecure init", async () => {
    await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
      })
      .rpc()
  })

  it("Re-invoke insecure init with different auth", async () => {
    const tx = await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
        authority: walletTwo.publicKey,
      })
      .transaction()
    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      walletTwo,
    ])
  })
})
```

Execute `anchor test` para verificar que ambas as transações serão concluídas com êxito.

```bash
initialization
  ✔ Insecure init (478ms)
  ✔ Re-invoke insecure init with different auth (464ms)
```

### 3. Adicione a instrução `recommended_initialization`

Vamos criar uma nova instrução chamada `recommended_initialization` que corrige esse problema. Ao contrário da instrução insegura anterior, essa instrução deve tratar tanto da criação quanto da inicialização da conta do usuário usando a restrição `init` do Anchor.

Essa restrição instrui o programa a criar a conta por meio de uma CPI para o programa do sistema, de modo que a conta não precise mais ser criada no lado do cliente. A restrição também define o discriminador de contas. Sua lógica de instrução pode então definir o estado inicial da conta.

Ao fazer isso, você garante que qualquer invocação subsequente da mesma instrução com a mesma conta de usuário falhará em vez de redefinir o estado inicial da conta.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;
		...
    pub fn recommended_initialization(ctx: Context<Checked>) -> Result<()> {
        ctx.accounts.user.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}
```

### 4. Teste a instrução `recommended_initialization`

Para testar a instrução `recommended_initialization`, invocaremos a instrução duas vezes, como antes. Desta vez, esperamos que a transação falhe quando tentarmos inicializar a mesma conta pela segunda vez. 

```tsx
describe("initialization", () => {
  ...
  it("Recommended init", async () => {
    await program.methods
      .recommendedInitialization()
      .accounts({
        user: userRecommended.publicKey,
      })
      .signers([userRecommended])
      .rpc()
  })

  it("Re-invoke recommended init with different auth, expect error", async () => {
    try {
      // Adicione seu teste aqui.
      const tx = await program.methods
        .recommendedInitialization()
        .accounts({
          user: userRecommended.publicKey,
          authority: walletTwo.publicKey,
        })
        .transaction()
      await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
        walletTwo,
        userRecommended,
      ])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

Execute o `anchor test` e veja que a segunda transação que tenta inicializar a mesma conta duas vezes agora retornará um erro, informando que o endereço da conta já está em uso.

```bash
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t invoke [1]',
'Program log: Instruction: RecommendedInitialization',
'Program 11111111111111111111111111111111 invoke [2]',
'Allocate: account Address { address: EMvbwzrs4VTR7G1sNUJuQtvRX1EuvLhqs4PFqrtDcCGV, base: None } already in use',
'Program 11111111111111111111111111111111 failed: custom program error: 0x0',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t consumed 4018 of 200000 compute units',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t failed: custom program error: 0x0'
```

A restrição `init` do Anchor, geralmente é tudo o que você precisa para se proteger contra ataques de reinicialização! Lembre-se de que o fato de a correção para essas explorações de segurança ser simples não significa que não seja importante. Toda vez que você inicializar uma conta, certifique-se de que está usando a restrição `init` ou de que tem alguma outra verificação para evitar a redefinição do estado inicial de uma conta existente.

Se quiser dar uma olhada no código da solução final, poderá encontrá-lo na branch `solution` deste [repositório](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/solution).

# Desafio

Assim como nas outras lições deste módulo, sua oportunidade de praticar como evitar essa exploração de segurança está na auditoria de seus próprios programas ou de outros.

Dedique algum tempo para analisar pelo menos um programa e garantir que as instruções estejam devidamente protegidas contra ataques de reinicialização.

Lembre-se, se você encontrar um bug ou uma exploração de segurança no programa de outra pessoa, alerte-a! Se encontrar um bug em seu próprio programa, não deixe de corrigi-lo imediatamente.

---
title: Canonicalização de Sementes Bump
objectives:
- Explicar as vulnerabilidades associadas ao uso de PDAs derivados sem o bump canônico
- Inicializar um PDA usando as restrições `seeds` e `bump` do Anchor para usar automaticamente o bump canônico.
- Usar as restrições `seeds` e `bump` do Anchor para garantir que o bump canônico seja sempre usado em instruções futuras ao derivar um PDA
---

# RESUMO

- A função [**`create_program_address`**](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) deriva um PDA sem procurar o **bump canônico**. Isso significa que há vários bumps válidos e que todos eles produzirão endereços diferentes.
- O uso de [**`find_program_address`**](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address) garante que o bump válido mais alto, ou bump canônico, seja usado para a derivação, criando assim uma maneira determinística de encontrar um endereço com sementes específicas.
- Na inicialização, você pode usar a restrição `seeds` e `bump` do Anchor para garantir que as derivações de PDA na estrutura de validação de conta sempre usem o bump canônico.
- O Anchor permite que você **especifique um bump** com a restrição `bump = <some_bump>` ao verificar o endereço de um PDA
- Como o `find_program_address` pode ser dispendioso, a prática recomendada é armazenar o bump derivado em um campo de dados da conta, para ser referenciado posteriormente quando o endereço for novamente derivado para verificação.
    ```rust
    #[derive(Accounts)]
    pub struct VerifyAddress<'info> {
    	#[account(
        	seeds = [DATA_PDA_SEED.as_bytes()],
    	    bump = data.bump
    	)]
    	data: Account<'info, Data>,
    }
    ```

# Visão geral

As sementes de bump são um número entre 0 e 255, inclusive, usado para garantir que um endereço derivado usando [`create_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) seja um PDA válido. O **bump canônico** é o maior valor de bump que produz um PDA válido. O padrão em Solana é *sempre usar o bump canônico* ao derivar PDAs, tanto por segurança quanto por conveniência. 

## Derivação insegura de PDA usando `create_program_address`

Dado um conjunto de seeds, a função `create_program_address` produzirá um PDA válido em cerca de 50% das vezes. A semente de bump é um byte adicional acrescentado como uma semente para fazer um "bump" do endereço derivado em um campo válido. Como há 256 sementes de bump possíveis e a função produz PDAs válidos aproximadamente 50% das vezes, há muitos bumps válidos para um determinado conjunto de sementes de entrada.

Você pode imaginar que isso poderia causar confusão na localização de contas ao usar sementes como forma de mapeamento entre partes conhecidas de informações e contas. Usar o bump canônico como padrão garante que você sempre possa encontrar a conta certa. Mais importante ainda, ele evita falhas de segurança causadas pela natureza aberta de permitir vários bumps.

No exemplo abaixo, a instrução `set_value` usa um `bump` que foi passado como dados de instrução para derivar um PDA. Em seguida, a instrução deriva o PDA usando a função `create_program_address` e verifica se o `address` corresponde à chave pública da conta `data`.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_insecure {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, key: u64, new_value: u64, bump: u8) -> Result<()> {
        let address =
            Pubkey::create_program_address(&[key.to_le_bytes().as_ref(), &[bump]], ctx.program_id).unwrap();
        if address != ctx.accounts.data.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        ctx.accounts.data.value = new_value;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct BumpSeed<'info> {
    data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
}
```

Embora a instrução derive o PDA e verifique a conta passada, o que é bom, ela permite que o chamador passe um bump arbitrário. Dependendo do contexto de seu programa, isso pode resultar em um comportamento indesejado ou em uma possível exploração.

Se o mapeamento de sementes tiver como objetivo impor uma relação de um para um entre o PDA e o usuário, por exemplo, esse programa não aplicaria isso adequadamente. Um usuário poderia chamar o programa várias vezes com muitos bumps válidos, cada um produzindo um PDA diferente.

## Derivação recomendada usando o `find_program_address`

Uma maneira simples de contornar esse problema é fazer com que o programa espere apenas o bump canônico e use o `find_program_address` para derivar o PDA. 

O [`find_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address) *sempre usa o bump canônico*. Essa função itera através da chamada de `create_program_address`, iniciando com um bump de 255 e diminuindo o bump em um a cada iteração. Assim que um endereço válido é encontrado, a função retorna tanto o PDA derivado quanto o bump canônico usado para derivá-lo.

Isso garante um mapeamento de um para um entre suas sementes de entrada e o endereço que elas produzem.

```rust
pub fn set_value_secure(
    ctx: Context<BumpSeed>,
    key: u64,
    new_value: u64,
    bump: u8,
) -> Result<()> {
    let (address, expected_bump) =
        Pubkey::find_program_address(&[key.to_le_bytes().as_ref()], ctx.program_id);

    if address != ctx.accounts.data.key() {
        return Err(ProgramError::InvalidArgument.into());
    }
    if expected_bump != bump {
        return Err(ProgramError::InvalidArgument.into());
    }

    ctx.accounts.data.value = new_value;
    Ok(())
}
```

## Use as restrições `seeds` e `bump` do Anchor

O Anchor oferece uma maneira conveniente de derivar PDAs na struct de validação de conta usando as restrições `seeds` e `bump`. Essas restrições podem até ser combinadas com a restrição `init` para inicializar a conta no endereço desejado. Para proteger o programa contra a vulnerabilidade que discutimos ao longo desta lição, o Anchor não permite que você inicialize uma conta em um PDA usando nada mais do que o bump canônico. Em vez disso, ele usa `find_program_address` para derivar o PDA e, em seguida, executa a inicialização.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        Ok(())
    }
}

// inicializa a conta no PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // deriva o PDA usando o bump canônico
    bump,
    payer = payer,
    space = 8 + 8
  )]
  data: Account<'info, Data>,
  system_program: Program<'info, System>
}

#[account]
pub struct Data {
    value: u64,
}
```

Se você não está inicializando uma conta, ainda poderá validar PDAs com as restrições `seeds` e `bump`. Isso simplesmente rederiva o PDA e compara o endereço derivado com o endereço da conta que foi passado.

Nesse cenário, o Anchor permite *sim* que você especifique o bump a ser usado para derivar o PDA com `bump = <some_bump>`. A intenção aqui não é usar bumps arbitrários, mas sim permitir que você otimize seu programa. A natureza iterativa do `find_program_address` torna-o dispendioso, portanto, a prática recomendada é armazenar o bump canônico nos dados da conta do PDA ao inicializar um PDA, permitindo que você faça referência ao bump armazenado ao validar o PDA nas instruções subsequentes.

Quando você especifica o bump a ser usado, o Anchor usa `create_program_address` com o bump fornecido em vez de `find_program_address`. Esse padrão de armazenamento de bump nos dados da conta garante que seu programa sempre use o bump canônico sem prejudicar o desempenho.

```rust
use anchor_lang::prelude::*;

declare_id!("CVwV9RoebTbmzsGg1uqU1s4a3LvTKseewZKmaNLSxTqc");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        // armazena o bump na conta
        ctx.accounts.data.bump = *ctx.bumps.get("data").unwrap();
        Ok(())
    }

    pub fn verify_address(ctx: Context<VerifyAddress>, _key: u64) -> Result<()> {
        msg!("PDA confirmed to be derived with canonical bump: {}", ctx.accounts.data.key());
        Ok(())
    }
}

// inicializa a conta no PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // deriva o PDA usando o bump canônico
    bump,
    payer = payer,
    space = 8 + 8 + 1
  )]
  data: Account<'info, Data>,
  system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(key: u64)]
pub struct VerifyAddress<'info> {
  #[account(
    seeds = [key.to_le_bytes().as_ref()],
    // garantia de ser sempre o bump canônico
    bump = data.bump
  )]
  data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
    // campo bump
    bump: u8
}
```

Se você não especificar o bump na restrição `bump`, o Anchor ainda usará `find_program_address` para derivar o PDA usando o bump canônico. Como consequência, sua instrução incorrerá em uma quantidade variável de orçamento de computação. Os programas que já correm o risco de exceder seu orçamento de computação devem usar isso com cuidado, pois há uma chance de que o orçamento do programa seja ocasional e imprevisivelmente excedido.

Por outro lado, se você precisar apenas verificar o endereço de um PDA passado sem inicializar uma conta, será forçado a permitir que o Anchor derive o bump canônico ou a expor seu programa a riscos desnecessários. Nesse caso, use o bump canônico, apesar da pequena desvantagem de desempenho.

# Demonstração

Para demonstrar as explorações de segurança possíveis quando você não verifica o bump canônico, vamos trabalhar com um programa que permite que cada usuário do programa "solicite" recompensas na hora certa.

### 1. Configure

Comece obtendo o código na branch `starter` do [repositório](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/starter).

Observe que há duas instruções no programa e um único teste no diretório `tests`.

As instruções do programa são:

1. `create_user_insecure`
2. `claim_insecure`

A instrução `create_user_insecure` simplesmente cria uma nova conta em um PDA derivado usando a chave pública do signatário e um bump passado. 

A instrução `claim_insecure` fornece 10 tokens ao usuário e, em seguida, marca as recompensas da conta como reivindicadas para que não possam ser reivindicadas novamente.

No entanto, o programa não verifica explicitamente se os PDAs em questão estão usando o bump canônico.

Dê uma olhada no programa para entender o que ele faz, antes de continuar.

### 2. Teste instruções inseguras

Como as instruções não exigem explicitamente que o PDA do `user` use o bump canônico, um invasor pode criar várias contas por carteira e reivindicar mais recompensas do que deveria ser permitido.

O teste no diretório `tests` cria um novo par de chaves chamado `attacker` para representar um invasor. Em seguida, ele percorre todos os bumps possíveis e chama `create_user_insecure` e `claim_insecure`. No final, o teste pressupõe que o invasor conseguiu reivindicar recompensas várias vezes e ganhou mais do que os 10 tokens alocados por usuário.

```typescript
it("Attacker can claim more than reward limit with insecure instructions", async () => {
    const attacker = Keypair.generate()
    await safeAirdrop(attacker.publicKey, provider.connection)
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey)

    let numClaims = 0

    for (let i = 0; i < 256; i++) {
      try {
        const pda = createProgramAddressSync(
          [attacker.publicKey.toBuffer(), Buffer.from([i])],
          program.programId
        )
        await program.methods
          .createUserInsecure(i)
          .accounts({
            user: pda,
            payer: attacker.publicKey,
          })
          .signers([attacker])
          .rpc()
        await program.methods
          .claimInsecure(i)
          .accounts({
            user: pda,
            mint,
            payer: attacker.publicKey,
            userAta: ataKey,
          })
          .signers([attacker])
          .rpc()

        numClaims += 1
      } catch (error) {
        if (
          error.message !== "Invalid seeds, address must fall off the curve"
        ) {
          console.log(error)
        }
      }
    }

    const ata = await getAccount(provider.connection, ataKey)

    console.log(
      `Attacker claimed ${numClaims} times and got ${Number(ata.amount)} tokens`
    )

    expect(numClaims).to.be.greaterThan(1)
    expect(Number(ata.amount)).to.be.greaterThan(10)
})
```

Execute o `anchor test` para ver se esse teste é aprovado, mostrando que o invasor foi bem-sucedido. Como o teste chama as instruções para cada bump válido, ele demora um pouco para ser executado, portanto, tenha paciência.

```bash
  bump-seed-canonicalization
Attacker claimed 129 times and got 1290 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (133840ms)
```

### 3. Crie instruções seguras

Vamos demonstrar a correção da vulnerabilidade criando duas novas instruções:

1. `create_user_secure`
2. `claim_secure`

Antes de escrevermos a lógica de validação ou instrução da conta, vamos criar um novo tipo de usuário, `UserSecure`. Esse novo tipo adicionará o bump canônico como um campo na struct.

```rust
#[account]
pub struct UserSecure {
    auth: Pubkey,
    bump: u8,
    rewards_claimed: bool,
}
```

Em seguida, vamos criar structs de validação de conta para cada uma das novas instruções. Elas serão muito semelhantes às versões inseguras, mas permitirão que o Anchor manipule a derivação e a desserialização dos PDAs.

```rust
#[derive(Accounts)]
pub struct CreateUserSecure<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [payer.key().as_ref()],
        // deriva o PDA usando o bump canônico
        bump,
        payer = payer,
        space = 8 + 32 + 1 + 1
    )]
    user: Account<'info, UserSecure>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SecureClaim<'info> {
    #[account(
        seeds = [payer.key().as_ref()],
        bump = user.bump,
        constraint = !user.rewards_claimed @ ClaimError::AlreadyClaimed,
        constraint = user.auth == payer.key()
    )]
    user: Account<'info, UserSecure>,
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    mint: Account<'info, Mint>,
    /// VERIFICA: autoridade de cunhagem do PDA
    #[account(seeds = ["mint".as_bytes().as_ref()], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}
```

Por fim, vamos implementar a lógica de instrução para as duas novas instruções. A instrução `create_user_secure` simplesmente precisa definir os campos `auth`, `bump` e `rewards_claimed` nos dados da conta `user`.

```rust
pub fn create_user_secure(ctx: Context<CreateUserSecure>) -> Result<()> {
    ctx.accounts.user.auth = ctx.accounts.payer.key();
    ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
    ctx.accounts.user.rewards_claimed = false;
    Ok(())
}
```

A instrução `claim_secure` precisa cunhar 10 tokens para o usuário e definir o campo `rewards_claimed` da conta `user` como `true`.

```rust
pub fn claim_secure(ctx: Context<SecureClaim>) -> Result<()> {
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[&[
                    b"mint".as_ref(),
                &[*ctx.bumps.get("mint_authority").unwrap()],
            ]],
        ),
        10,
    )?;

    ctx.accounts.user.rewards_claimed = true;

    Ok(())
}
```

### 4. Teste as instruções seguras

Vamos escrever um teste para mostrar que o invasor não pode mais reivindicar mais de uma vez usando as novas instruções.

Observe que, se você começar a fazer um loop usando vários PDAs, como no teste antigo, não será possível nem mesmo passar o bump não canônico para as instruções. No entanto, você ainda pode fazer o loop usando os vários PDAs e, no final, verificar se apenas uma reivindicação ocorreu para um total de 10 tokens. Seu teste final terá a seguinte aparência:

```typescript
it.only("Attacker can only claim once with secure instructions", async () => {
    const attacker = Keypair.generate()
    await safeAirdrop(attacker.publicKey, provider.connection)
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey)
    const [userPDA] = findProgramAddressSync(
      [attacker.publicKey.toBuffer()],
      program.programId
    )

    await program.methods
      .createUserSecure()
      .accounts({
        payer: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    await program.methods
      .claimSecure()
      .accounts({
        payer: attacker.publicKey,
        userAta: ataKey,
        mint,
        user: userPDA,
      })
      .signers([attacker])
      .rpc()

    let numClaims = 1

    for (let i = 0; i < 256; i++) {
      try {
        const pda = createProgramAddressSync(
          [attacker.publicKey.toBuffer(), Buffer.from([i])],
          program.programId
        )
        await program.methods
          .createUserSecure()
          .accounts({
            user: pda,
            payer: attacker.publicKey,
          })
          .signers([attacker])
          .rpc()

        await program.methods
          .claimSecure()
          .accounts({
            payer: attacker.publicKey,
            userAta: ataKey,
            mint,
            user: pda,
          })
          .signers([attacker])
          .rpc()

        numClaims += 1
      } catch {}
    }

    const ata = await getAccount(provider.connection, ataKey)

    expect(Number(ata.amount)).to.equal(10)
    expect(numClaims).to.equal(1)
})
```

```bash
  bump-seed-canonicalization
Attacker claimed 119 times and got 1190 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (128493ms)
    ✔ Attacker can only claim once with secure instructions (1448ms)
```

Se você usar o Anchor para todas as derivações do PDA, essa exploração específica é muito simples de evitar. No entanto, se acabar fazendo algo "fora do padrão", tenha o cuidado de projetar seu programa para usar explicitamente o bump canônico!

Se quiser dar uma olhada no código da solução final, poderá encontrá-lo na brancho `solution` do [mesmo repositório](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/solution).

# Desafio

Assim como nas outras lições deste módulo, sua oportunidade de praticar como evitar esse golpe de segurança está na auditoria de seus próprios programas ou de outros.

Reserve algum tempo para analisar pelo menos um programa e garantir que todas as derivações e verificações do PDA estejam usando o bump canônico.

Lembre-se: se você encontrar um bug ou uma exploração no programa de outra pessoa, alerte-a! Se encontrar um bug em seu próprio programa, não deixe de corrigi-lo imediatamente.

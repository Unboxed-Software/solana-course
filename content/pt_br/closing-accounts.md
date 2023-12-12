---
title: Fechamento de Contas e Ataques de Reativação
Objectives:
- Explicar as várias vulnerabilidades de segurança associadas ao fechamento incorreto de contas de programas
- Fechar as contas do programa de forma segura usando o Rust nativo
- Fechar contas de programas com segurança usando a restrição do Anchor `close
---

# RESUMO

- **Fechar uma conta** indevidamente cria uma oportunidade para ataques de reinicialização/reativação
- O tempo de execução do Solana **coleta lixo de contas** quando elas não são mais isentas de renda. O fechamento de contas envolve a transferência dos lamports armazenados na conta para isenção de aluguel para outra conta de sua escolha.
- Você pode usar a restrição Anchor `#[account(close = <address_to_send_lamports>)]` para fechar contas com segurança e definir o discriminador de contas como `CLOSED_ACCOUNT_DISCRIMINATOR`
    ```rust
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
    ```

# Visão Geral

Embora pareça simples, o fechamento adequado de contas pode ser complicado. Há várias maneiras de um invasor contornar o fechamento da conta se você não seguir etapas específicas.

Para entender melhor esses vetores de ataque, vamos explorar cada um desses cenários em profundidade.

## Fechamento de conta sem segurança

Em sua essência, o fechamento de uma conta envolve a transferência de seus lamports para uma conta separada, acionando assim o tempo de execução do Solana para coletar o lixo da primeira conta. Isso redefine o proprietário do programa de propriedade para o programa do sistema.

Dê uma olhada no exemplo abaixo. A instrução requer duas contas:

1. `account_to_close` - a conta a ser encerrada
2. `destination` - a conta que deve receber os lamports da conta encerrada

A lógica do programa destina-se a fechar uma conta simplesmente aumentando os lamports da conta de destino pelo valor armazenado na `account_to_close` e definindo os lamports da `account_to_close` como 0. Com esse programa, depois que uma transação completa for processada, a `account_to_close` será coletada como lixo pelo tempo de execução.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(ctx.accounts.account_to_close.to_account_info().lamports())
            .unwrap();
        **ctx.accounts.account_to_close.to_account_info().lamports.borrow_mut() = 0;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account_to_close: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

No entanto, a coleta de lixo não ocorre até que a transação seja concluída. E como pode haver várias instruções em uma transação, isso cria uma oportunidade para que um invasor invoque a instrução para fechar a conta, mas também inclua na transação uma transferência para reembolsar os lamports de isenção de aluguel da conta. O resultado é que a conta *não* será coletada como lixo, abrindo um caminho para que o invasor gere um comportamento não intencional no programa e até mesmo drene um protocolo.

## Fechamento seguro de conta

As duas coisas mais importantes que você pode fazer para fechar essa brecha são zerar os dados da conta e adicionar um discriminador de conta que represente que a conta foi fechada. Você precisa de *ambas* as coisas para evitar um comportamento não intencional do programa.

Uma conta com dados zerados ainda pode ser usada para algumas coisas, especialmente se for um PDA cuja derivação de endereço seja usada no programa para fins de verificação. No entanto, os danos podem ser potencialmente limitados se o invasor não puder acessar os dados armazenados anteriormente.

Para proteger ainda mais o programa, no entanto, as contas fechadas devem receber um discriminador de conta que as designe como "fechadas", e todas as instruções devem executar verificações em todas as contas passadas que retornem um erro se a conta estiver marcada como fechada.

Veja o exemplo abaixo. Esse programa transfere os lamports de uma conta, zera os dados da conta e define um discriminador de conta em uma única instrução, na esperança de impedir que uma instrução subsequente utilize essa conta novamente antes que ela seja coletada como lixo. Deixar de fazer qualquer uma dessas coisas resultaria em uma vulnerabilidade de segurança.

```rust
use anchor_lang::prelude::*;
use std::io::Write;
use std::ops::DerefMut;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure_still_still {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let account = ctx.accounts.account.to_account_info();

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        let mut data = account.try_borrow_mut_data()?;
        for byte in data.deref_mut().iter_mut() {
            *byte = 0;
        }

        let dst: &mut [u8] = &mut data;
        let mut cursor = std::io::Cursor::new(dst);
        cursor
            .write_all(&anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR)
            .unwrap();

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

Observe que o exemplo acima está usando o `CLOSED_ACCOUNT_DISCRIMINATOR` do Anchor. Esse é simplesmente um discriminador de contas em que cada byte é `255`. O discriminador não tem nenhum significado inerente, mas se você combiná-lo com verificações de validação de conta que retornam erros sempre que uma conta com esse discriminador é passada para uma instrução, você impedirá que seu programa processe involuntariamente uma instrução com uma conta fechada.

### Retirada manual forçada de fundos

Ainda há um pequeno problema. Embora a prática de zerar os dados da conta e adicionar um discriminador de conta "fechada" impeça que seu programa seja explorado, um usuário ainda pode impedir que uma conta seja coletada como lixo, reembolsando os lamports da conta antes do final de uma instrução. Isso faz com que uma ou muitas contas existam em um estado de limbo em que não podem ser usadas, mas também não podem ser coletadas como lixo.

Para lidar com esse caso extremo, você pode considerar a adição de uma instrução que permita que *qualquer pessoa* retire os fundos de contas marcadas com o discriminador de conta "fechada". A única validação de conta que essa instrução executaria seria para garantir que a conta que está sendo cancelada esteja marcada como fechada. Ela pode ter a seguinte aparência:

```rust
use anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR;
use anchor_lang::prelude::*;
use std::io::{Cursor, Write};
use std::ops::DerefMut;

...

    pub fn force_defund(ctx: Context<ForceDefund>) -> ProgramResult {
        let account = &ctx.accounts.account;

        let data = account.try_borrow_data()?;
        assert!(data.len() > 8);

        let mut discriminator = [0u8; 8];
        discriminator.copy_from_slice(&data[0..8]);
        if discriminator != CLOSED_ACCOUNT_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        Ok(())
    }

...

#[derive(Accounts)]
pub struct ForceDefund<'info> {
    account: AccountInfo<'info>,
    destination: AccountInfo<'info>,
}
```

Como qualquer pessoa pode chamar essa instrução, isso pode funcionar como um impedimento para tentativas de ataques de reativação, uma vez que o invasor está pagando pela isenção do aluguel da conta, mas qualquer outra pessoa pode reivindicar para si os lamports em uma conta reembolsada.

Embora não seja necessário, isso pode ajudar a eliminar o desperdício de espaço e de relatórios associados a essas contas "limbo".

## Use a restrição `close` do Anchor

Felizmente, o Anchor torna tudo isso muito mais simples com a restrição `#[account(close = <target_account>)]`. Essa restrição lida com tudo o que é necessário para fechar uma conta com segurança:

1. Transfere os relatórios da conta para a `<target_account>` fornecida
2. Zera os dados da conta
3. Define o discriminador da conta como a variante `CLOSED_ACCOUNT_DISCRIMINATOR`.

Tudo o que você precisa fazer é adicioná-lo na struct de validação de conta à conta que deseja fechar:

```rust
#[derive(Accounts)]
pub struct CloseAccount {
    #[account(
        mut, 
        close = receiver
    )]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
}
```

A instrução `force_defund` é uma adição opcional que você terá de implementar por conta própria se quiser utilizá-la.

# Demonstração

Para esclarecer como um invasor pode tirar proveito de um ataque de reativação, vamos trabalhar com um programa de loteria simples que usa o estado da conta do programa para gerenciar a participação de um usuário na loteria.

## 1. Configure

Comece obtendo o código na branch `starter` do diretório do [seguinte repositório](https://github.com/Unboxed-Software/solana-closing-accounts/tree/starter).

O código tem duas instruções no programa e dois testes no diretório `tests`.

As instruções do programa são:

1. `enter_lottery`
2. `redeem_rewards_insecure`

Quando um usuário chamar `enter_lottery`, o programa inicializará uma conta para armazenar algum estado sobre a participação do usuário na loteria.

Como este é um exemplo simplificado e não um programa de loteria completo, uma vez que o usuário tenha participado da loteria, ele poderá chamar a instrução `redeem_rewards_insecure` a qualquer momento. Essa instrução cunhará para o usuário uma quantidade de tokens de Recompensa proporcional à quantidade de vezes em que o usuário tenha participado da loteria. Depois de cunhar as recompensas, o programa encerra a participação do usuário na loteria.

Reserve um minuto para se familiarizar com o código do programa. A instrução `enter_lottery` simplesmente cria uma conta em um PDA mapeado para o usuário e inicializa algum estado nela.

A instrução `redeem_rewards_insecure` executa algumas validações de conta e de dados, cunha tokens para a conta de tokens fornecida e, em seguida, fecha a conta da loteria removendo seus lamport.

No entanto, observe que a instrução `redeem_rewards_insecure` *somente* transfere os lamports da conta, deixando a conta aberta a ataques de reativação.

## 2. Teste um Programa Inseguro

Um invasor que consiga impedir o fechamento da conta pode chamar `redeem_rewards_insecure` várias vezes, reivindicando mais prêmios do que o devido.

Já foram escritos alguns testes iniciais que demonstram essa vulnerabilidade. Dê uma olhada no arquivo `closing-accounts.ts` no diretório `tests`. Há algumas configurações na função `before` e, em seguida, um teste que simplesmente cria uma nova entrada de loteria para o `attacker`.

Por fim, há um teste que demonstra como um invasor pode manter a conta ativa mesmo depois de solicitar recompensas e, em seguida, solicitar recompensas novamente. Esse teste tem a seguinte aparência:

```typescript
it("attacker  can close + refund lottery acct + claim multiple rewards", async () => {
    // reivindica várias vezes
    for (let i = 0; i < 2; i++) {
      const tx = new Transaction()
      // instrução solicita recompensas, o programa tentará encerrar a conta
      tx.add(
        await program.methods
          .redeemWinningsInsecure()
          .accounts({
            lotteryEntry: attackerLotteryEntry,
            user: attacker.publicKey,
            userAta: attackerAta,
            rewardMint: rewardMint,
            mintAuth: mintAuth,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      )

      // o usuário adiciona instruções para reembolsar os lamports de dataAccount
      const rentExemptLamports =
        await provider.connection.getMinimumBalanceForRentExemption(
          82,
          "confirmed"
        )
      tx.add(
        SystemProgram.transfer({
          fromPubkey: attacker.publicKey,
          toPubkey: attackerLotteryEntry,
          lamports: rentExemptLamports,
        })
      )
      // envia tx
      await sendAndConfirmTransaction(provider.connection, tx, [attacker])
      await new Promise((x) => setTimeout(x, 5000))
    }

    const ata = await getAccount(provider.connection, attackerAta)
    const lotteryEntry = await program.account.lotteryAccount.fetch(
      attackerLotteryEntry
    )

    expect(Number(ata.amount)).to.equal(
      lotteryEntry.timestamp.toNumber() * 10 * 2
    )
})
```

Esse teste faz o seguinte:
1. Chama `redeem_rewards_insecure` para resgatar as recompensas do usuário
2. Na mesma transação, adiciona uma instrução para reembolsar a `lottery_entry` do usuário antes que ela possa ser fechada
3. Repete com sucesso as etapas 1 e 2, resgatando os prêmios pela segunda vez.

Teoricamente, é possível repetir as etapas 1 e 2 infinitamente até que: a) o programa não tenha mais recompensas para dar ou b) alguém perceba e corrija o golpe. Obviamente, isso seria um problema grave em qualquer programa real, pois permite que um invasor mal-intencionado drene todo o pool de recompensas.

## 3. Crie uma instrução `redeem_rewards_secure`

Para evitar que isso aconteça, vamos criar uma nova instrução que fecha a conta da loteria usando apenas a restrição Anchor `close`. Sinta-se à vontade para testar isso por conta própria, se desejar.

A nova estrutura de validação de conta chamada `RedeemWinningsSecure` deve ter a seguinte aparência:

```rust
#[derive(Accounts)]
pub struct RedeemWinningsSecure<'info> {
    // o programa espera essa conta ser inicializada
    #[account(
        mut,
        seeds = [user.key().as_ref()],
        bump = lottery_entry.bump,
        has_one = user,
        close = user
    )]
    pub lottery_entry: Account<'info, LotteryAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_ata.key() == lottery_entry.user_ata
    )]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = reward_mint.key() == user_ata.mint
    )]
    pub reward_mint: Account<'info, Mint>,
    ///CHECA: a autoridade da cunhagem
    #[account(
        seeds = [MINT_SEED.as_bytes()],
        bump
    )]
    pub mint_auth: AccountInfo<'info>,
    pub token_program: Program<'info, Token>
}
```

Deve ser exatamente igual à estrutura de validação de conta `RedeemWinnings` original, exceto que há uma restrição adicional `close = user` na conta `lottery_entry`. Isso dirá ao Anchor para fechar a conta, zerando os dados, transferindo seus lamports para a conta `user` e definindo o discriminador da conta como `CLOSED_ACCOUNT_DISCRIMINATOR`. Essa última etapa é o que impedirá que a conta seja usada novamente se o programa já tiver tentado fechá-la.

Em seguida, podemos criar um método `mint_ctx` na nova estrutura `RedeemWinningsSecure` para ajudar com a cunhagem CPI para o programa de tokens.

```Rust
impl<'info> RedeemWinningsSecure <'info> {
    pub fn mint_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: self.reward_mint.to_account_info(),
            to: self.user_ata.to_account_info(),
            authority: self.mint_auth.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
```

Por fim, a lógica da nova instrução segura deve ter a seguinte aparência:

```rust
pub fn redeem_winnings_secure(ctx: Context<RedeemWinningsSecure>) -> Result<()> {

    msg!("Cálculo dos prêmios");
    let amount = ctx.accounts.lottery_entry.timestamp as u64 * 10;

    msg!("Minting {} tokens in rewards", amount);
    // sementes do signatário do programa
    let auth_bump = *ctx.bumps.get("mint_auth").unwrap();
    let auth_seeds = &[MINT_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // resgata recompensas por meio de cunhagem para o usuário
    mint_to(ctx.accounts.mint_ctx().with_signer(signer), amount)?;

    Ok(())
}
```

Essa lógica simplesmente calcula as recompensas para o usuário solicitante e transfere as recompensas. No entanto, devido à restrição `close` na estrutura de validação de conta, o invasor não poderá chamar essa instrução várias vezes.

## 4. Teste o Programa

Para testar nossa nova instrução segura, vamos criar um novo teste que tente chamar `redeemingWinningsSecure` duas vezes. Esperamos que a segunda chamada gere um erro.

```typescript
it("attacker cannot claim multiple rewards with secure claim", async () => {
    const tx = new Transaction()
    // instrução solicita recompensas, o programa tentará encerrar a conta
    tx.add(
      await program.methods
        .redeemWinningsSecure()
        .accounts({
          lotteryEntry: attackerLotteryEntry,
          user: attacker.publicKey,
          userAta: attackerAta,
          rewardMint: rewardMint,
          mintAuth: mintAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    )

    // o usuário adiciona instruções para reembolsar os lamports da dataAccount
    const rentExemptLamports =
      await provider.connection.getMinimumBalanceForRentExemption(
        82,
        "confirmed"
      )
    tx.add(
      SystemProgram.transfer({
        fromPubkey: attacker.publicKey,
        toPubkey: attackerLotteryEntry,
        lamports: rentExemptLamports,
      })
    )
    // envia tx
    await sendAndConfirmTransaction(provider.connection, tx, [attacker])

    try {
      await program.methods
        .redeemWinningsSecure()
        .accounts({
          lotteryEntry: attackerLotteryEntry,
          user: attacker.publicKey,
          userAta: attackerAta,
          rewardMint: rewardMint,
          mintAuth: mintAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker])
        .rpc()
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
})
```

Execute o `anchor test` para verificar se o teste foi aprovado. O resultado será parecido com este:

```bash
  closing-accounts
    ✔ Enter lottery (451ms)
    ✔ attacker can close + refund lottery acct + claim multiple rewards (18760ms)
AnchorError caused by account: lottery_entry. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.
    ✔ attacker cannot claim multiple rewards with secure claim (414ms)
```

Observe que isso não impede que o usuário mal-intencionado restitua sua conta - apenas protege nosso programa de reutilizar acidentalmente a conta quando ela deveria estar fechada. Até o momento, não implementamos uma instrução `force_defund`, mas poderíamos. Se você estiver disposto a isso, experimente você mesmo!

A maneira mais simples e segura de fechar contas é usar a restrição `close` do Anchor. Se você precisar de um comportamento mais personalizado e não puder usar essa restrição, certifique-se de replicar sua funcionalidade para garantir que seu programa esteja seguro.

Se quiser dar uma olhada no código de solução final, poderá encontrá-lo na branch `solution` do [mesmo repositório](https://github.com/Unboxed-Software/solana-closing-accounts/tree/solution).

# Desafio

Assim como nas outras lições deste módulo, sua oportunidade de praticar como evitar esse golpe na segurança está na auditoria de seus próprios programas ou de outros.

Reserve algum tempo para revisar pelo menos um programa e garanta que, quando as contas forem fechadas, elas não sejam suscetíveis a ataques de reativação.

Lembre-se: se você encontrar um bug ou uma exploração no programa de outra pessoa, alerte-a! Se encontrar um bug em seu próprio programa, não deixe de corrigi-lo imediatamente.

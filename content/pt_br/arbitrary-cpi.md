---
title: CPI Arbitrário
objectives:
- Explicar os riscos de segurança associados à invocação de uma CPI para um programa desconhecido
- Demonstrar como o módulo CPI do Anchor evita que isso aconteça ao fazer uma CPI de um programa Anchor para outro
- Criar, de forma segura, uma CPI de um programa Anchor para um programa não Anchor arbitrário
---

# RESUMO

- Para gerar uma CPI, o programa de destino deve ter passado na instrução de invocação como uma conta. Isso significa que qualquer programa de destino pode ser passar na instrução. Seu programa deve verificar se há programas incorretos ou inesperados.
- Execute verificações de programa em programas nativos simplesmente comparando a chave pública do programa aprovado com o programa esperado.
- Se um programa for escrito em Anchor, ele poderá ter um módulo CPI disponível publicamente. Isso torna a invocação do programa a partir de outro programa Anchor simples e segura. O módulo CPI do Anchor verifica automaticamente se o endereço do programa passado corresponde ao endereço do programa armazenado no módulo.

# Visão Geral

Uma invocação entre programas (CPI) é quando um programa invoca uma instrução em outro programa. Um "CPI arbitrário" é quando um programa é estruturado para emitir um CPI para qualquer programa passado na instrução, em vez de esperar executar um CPI para um programa específico. Como os chamadores da instrução de seu programa podem passar qualquer programa que desejarem para a lista de contas da instrução, deixar de verificar o endereço de um programa que passou faz com que seu programa execute CPIs para programas arbitrários.

Essa falta de verificação do programa cria uma oportunidade para que um usuário mal-intencionado passe um programa diferente do esperado, fazendo com que o programa original chame uma instrução nesse programa misterioso. Não há como saber quais podem ser as consequências dessa CPI. Isso depende da lógica do programa (tanto do programa original quanto do programa inesperado), bem como de quais outras contas passam na instrução original.

## Falhas na verificações de programas

Veja o programa a seguir como exemplo. A instrução `cpi` invoca a instrução `transfer` em `token_program`, mas não há código que verifique se a conta `token_program` que passou na instrução é, de fato, o Programa de Token SPL.

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_insecure {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        solana_program::program::invoke(
            &spl_token::instruction::transfer(
                ctx.accounts.token_program.key,
                ctx.accounts.source.key,
                ctx.accounts.destination.key,
                ctx.accounts.authority.key,
                &[],
                amount,
            )?,
            &[
                ctx.accounts.source.clone(),
                ctx.accounts.destination.clone(),
                ctx.accounts.authority.clone(),
            ],
        )
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: UncheckedAccount<'info>,
    destination: UncheckedAccount<'info>,
    authority: UncheckedAccount<'info>,
    token_program: UncheckedAccount<'info>,
}
```

Um invasor poderia facilmente chamar essa instrução e passar um programa de token duplicado que ele criou e controlar.

## Adicione verificações de programa

É possível corrigir essa vulnerabilidade simplesmente adicionando algumas linhas à instrução `cpi` para verificar se a chave pública do `token_program` é ou não a do Programa de Token SPL.

```rust
pub fn cpi_secure(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
    if &spl_token::ID != ctx.accounts.token_program.key {
        return Err(ProgramError::IncorrectProgramId);
    }
    solana_program::program::invoke(
        &spl_token::instruction::transfer(
            ctx.accounts.token_program.key,
            ctx.accounts.source.key,
            ctx.accounts.destination.key,
            ctx.accounts.authority.key,
            &[],
            amount,
        )?,
        &[
            ctx.accounts.source.clone(),
            ctx.accounts.destination.clone(),
            ctx.accounts.authority.clone(),
        ],
    )
}
```

Agora, se um invasor passar um programa de token diferente, a instrução retornará o erro `ProgramError::IncorrectProgramId`.

Dependendo do programa que você está invocando com a CPI, é possível fazer uma codificação rígida do endereço do ID do programa esperado ou usar o crate Rust do programa para obter o endereço do programa, se disponível. No exemplo acima, o crate `spl_token` fornece o endereço do Programa de Token SPL.

## Use um módulo CPI Anchor

Uma maneira mais simples de gerenciar as verificações do programa é usar os módulos CPI do Anchor. Aprendemos em uma [lição anterior](https://github.com/Unboxed-Software/solana-course/blob/main/content/anchor-cpi.md) que o Anchor pode gerar automaticamente módulos CPI para simplificar CPIs em um programa. Esses módulos também aumentam a segurança verificando a chave pública do programa que é passada para uma de suas instruções públicas.

Todo programa Anchor usa a macro `declare_id()` para definir o endereço do programa. Quando um módulo CPI é gerado para um programa específico, ele usa o endereço passado nessa macro como a "fonte da verdade" e verificará automaticamente se todos os CPIs feitos com o módulo CPI têm como alvo esse ID de programa.

Embora, em essência, não seja diferente das verificações manuais de programa, o uso de módulos CPI evita a possibilidade de esquecer de realizar uma verificação de programa ou de digitar acidentalmente o ID de programa errado ao codificá-lo.

O programa abaixo mostra um exemplo de uso de um módulo CPI para o Programa de Token SPL para realizar a transferência mostrada nos exemplos anteriores.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_recommended {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        token::transfer(ctx.accounts.transfer_ctx(), amount)
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: Account<'info, TokenAccount>,
    destination: Account<'info, TokenAccount>,
    authority: Signer<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> Cpi<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.source.to_account_info(),
            to: self.destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}
```

Observe que, como no exemplo acima, o Anchor criou alguns [wrappers para programas nativos populares](https://github.com/coral-xyz/anchor/tree/master/spl/src) que permitem que você emita CPIs neles como se fossem programas Anchor.

Além disso, dependendo do programa para o qual você está criando a CPI, talvez seja possível usar [o tipo de conta `Program`](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/program/struct.Program.html) Anchor para validar o programa passado em sua estrutura de validação de conta. Entre os crates [`anchor_lang`](https://docs.rs/anchor-lang/latest/anchor_lang) e [`anchor_spl`](https://docs.rs/anchor_spl/latest/), os seguintes tipos de `Program` são fornecidos imediatamente:

- [`System`](https://docs.rs/anchor-lang/latest/anchor_lang/system_program/struct.System.html)
- [`AssociatedToken`](https://docs.rs/anchor-spl/latest/anchor_spl/associated_token/struct.AssociatedToken.html)
- [`Token`](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.Token.html)

Se você tiver acesso ao módulo CPI do programa Anchor, poderá importar seu tipo de programa com o seguinte, substituindo o nome do programa pelo nome do programa real:

```rust
use other_program::program::OtherProgram;
```

# Demonstração

Para mostrar a importância de verificar o programa que você usa para CPIs, vamos trabalhar com um jogo simplificado e um tanto artificial. Esse jogo representa personagens com contas PDA e usa um programa de "metadados" separado para gerenciar os metadados e atributos das personagens, como saúde e poder.

Embora esse exemplo seja um tanto artificial, na verdade a arquitetura é quase idêntica à forma como os NFTs no Solana funcionam: o Programa de Tokens SPL gerencia a cunhagem, a distribuição e as transferências de tokens e um programa de metadados separado é usado para atribuir metadados aos tokens. Portanto, a vulnerabilidade que abordamos aqui também poderia ser aplicada a tokens reais.

### 1. Configure

Começaremos com a branch `starter` [deste repositório](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/starter). Clone o repositório e, em seguida, abra-o na ramificação `starter`.

Notice that there are three programs:

1. `gameplay`
2. `character-metadata`
3. `fake-metadata`

Além disso, já existe um teste no diretório `tests`.

O primeiro programa, `gameplay`, é o que nosso teste usa diretamente. Dê uma olhada no programa. Ele tem duas instruções:

1. `create_character_insecure` - cria um novo personagem e entra no programa de metadados para configurar os atributos iniciais da personagem
2. `battle_insecure` - coloca duas personagens uma contra a outra, atribuindo uma "vitória" à personagem com os atributos mais altos.

O segundo programa, `character-metadata`, destina-se a ser o programa "aprovado" para lidar com metadados da personagem. Dê uma olhada nesse programa. Ele tem uma única instrução para `create_metadata` que cria um novo PDA e atribui um valor pseudo-aleatório entre 0 e 20 para a saúde e o poder da personagem.

O último programa, `fake-metadata`, é um programa de metadados "falso" destinado a ilustrar o que um invasor pode fazer para explorar nosso programa `gameplay`. Esse programa é quase idêntico ao programa `character-metadata`, só que ele atribui a saúde e o poder iniciais de uma personagem como sendo o máximo permitido: 255.

### 2. Teste a instrução `create_character_insecure`

Já existe um teste no diretório `tests` para isso. Ele é longo, mas reserve um minuto para dar uma olhada nele antes de conversarmos sobre ele:

```typescript
it("Insecure instructions allow attacker to win every time", async () => {
    // Inicializa o jogador um com o programa de metadados real
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: metadataProgram.programId,
        authority: playerOne.publicKey,
      })
      .signers([playerOne])
      .rpc()

    // Inicializa o invasor com um programa de metadados falso
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: fakeMetadataProgram.programId,
        authority: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    // Obtém as contas de metadados de ambos os jogadores
    const [playerOneMetadataKey] = getMetadataKey(
      playerOne.publicKey,
      gameplayProgram.programId,
      metadataProgram.programId
    )

    const [attackerMetadataKey] = getMetadataKey(
      attacker.publicKey,
      gameplayProgram.programId,
      fakeMetadataProgram.programId
    )

    const playerOneMetadata = await metadataProgram.account.metadata.fetch(
      playerOneMetadataKey
    )

    const attackerMetadata = await fakeMetadataProgram.account.metadata.fetch(
      attackerMetadataKey
    )

    // O jogador comum deve ter saúde e poder entre 0 e 20
    expect(playerOneMetadata.health).to.be.lessThan(20)
    expect(playerOneMetadata.power).to.be.lessThan(20)

    // O invasor terá saúde e poder de 255
    expect(attackerMetadata.health).to.equal(255)
    expect(attackerMetadata.power).to.equal(255)
})
```

Esse teste analisa o cenário em que um jogador comum e um invasor criam suas personagens. Somente o invasor passa o ID do programa de metadados falso em vez do programa de metadados real. E como a instrução `create_character_insecure` não tem verificações de programa, ela ainda assim é executada.

O resultado é que a personagem normal tem a quantidade adequada de saúde e poder: cada uma com um valor entre 0 e 20. Mas a saúde e o poder do atacante são 255 cada um, tornando-o imbatível.

Se ainda não o fez, execute o `anchor test` para ver se esse teste de fato se comporta conforme descrito.

### 3. Crie uma instrução `create_character_secure`

Vamos corrigir isso criando uma instrução segura para a criação de uma nova personagem. Essa instrução deve implementar verificações de programa adequadas e usar o crate `cpi` do programa `character-metadata` para fazer a CPI em vez de usar apenas `invoke`.

Se quiser testar suas habilidades, tente fazer isso por conta própria antes de prosseguir.

Começaremos atualizando nossa declaração `use` na parte superior do arquivo `lib.rs` dos programas `gameplay`. Estamos nos dando acesso ao tipo do programa para validação da conta e à função auxiliar para emitir a CPI `create_metadata`.

```rust
use character_metadata::{
    cpi::accounts::CreateMetadata,
    cpi::create_metadata,
    program::CharacterMetadata,
};
```

Em seguida, vamos criar uma nova struct de validação de conta chamada `CreateCharacterSecure`. Desta vez, transformamos o `metadata_program` em um tipo `Program`:

```rust
#[derive(Accounts)]
pub struct CreateCharacterSecure<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 64,
        seeds = [authority.key().as_ref()],
        bump
    )]
    pub character: Account<'info, Character>,
    #[account(
        mut,
        seeds = [character.key().as_ref()],
        seeds::program = metadata_program.key(),
        bump,
    )]
    /// CHECAGEM: checagens manuais
    pub metadata_account: AccountInfo<'info>,
    pub metadata_program: Program<'info, CharacterMetadata>,
    pub system_program: Program<'info, System>,
}
```

Por fim, adicionamos a instrução `create_character_secure`. Ela será igual à anterior, mas usará a funcionalidade completa das CPIs do Anchor em vez de usar `invoke` diretamente:

```rust
pub fn create_character_secure(ctx: Context<CreateCharacterSecure>) -> Result<()> {
    let character = &mut ctx.accounts.character;
    character.metadata = ctx.accounts.metadata_account.key();
    character.auth = ctx.accounts.authority.key();
    character.wins = 0;

    let context = CpiContext::new(
        ctx.accounts.metadata_program.to_account_info(),
        CreateMetadata {
            character: ctx.accounts.character.to_account_info(),
            metadata: ctx.accounts.metadata_account.to_owned(),
            authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );

    create_metadata(context)?;

    Ok(())
}
```

### 4. Teste `create_character_secure`

Agora que temos uma maneira segura de inicializar uma nova personagem, vamos criar um novo teste. Esse teste só precisa tentar inicializar a personagem do invasor e esperar que um erro seja lançado.

```typescript
it("Secure character creation doesn't allow fake program", async () => {
    try {
      await gameplayProgram.methods
        .createCharacterSecure()
        .accounts({
          metadataProgram: fakeMetadataProgram.programId,
          authority: attacker.publicKey,
        })
        .signers([attacker])
        .rpc()
    } catch (error) {
      expect(error)
      console.log(error)
    }
})
```

Execute o `anchor test` se ainda não o fez. Observe que um erro foi lançado como se esperava, indicando que o ID do programa passado na instrução não é o ID do programa esperado:

```bash
'Program log: AnchorError caused by account: metadata_program. Error Code: InvalidProgramId. Error Number: 3008. Error Message: Program ID was not as expected.',
'Program log: Left:',
'Program log: FKBWhshzcQa29cCyaXc1vfkZ5U985gD5YsqfCzJYUBr',
'Program log: Right:',
'Program log: D4hPnYEsAx4u3EQMrKEXsY3MkfLndXbBKTEYTwwm25TE'
```

Isso é tudo o que você precisa fazer para se proteger contra CPIs arbitrárias!

Pode haver ocasiões em que você queira mais flexibilidade nas CPIs do seu programa. Certamente não o impediremos de arquitetar o programa de que precisa, mas tome todas as precauções possíveis para garantir que não haja vulnerabilidades em seu programa.

Se quiser dar uma olhada no código de solução final, poderá encontrá-lo na branch `solution` do [mesmo repositório](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/solution).

# Desafio

Assim como nas outras lições deste módulo, sua oportunidade de praticar como evitar essa exploração de segurança está na auditoria de seus próprios programas ou de outros.

Reserve algum tempo para analisar pelo menos um programa e certifique-se de que as verificações de programa estejam em vigor para cada programa passado nas instruções, especialmente aqueles que são invocados via CPI.

Lembre-se, se você encontrar um bug ou uma exploração no programa de outra pessoa, alerte-a! Se encontrar um bug em seu próprio programa, não se esqueça de corrigi-lo imediatamente.

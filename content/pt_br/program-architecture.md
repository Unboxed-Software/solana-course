---
title: Arquitetura de Programa
objectives:
- Usar Box e Zero-Copy para trabalhar com grandes dados onchain
- Tomar decisões melhores de design de PDA
- Tornar seus programas à prova de futuro
- Lidar com problemas de concorrência
---

# Resumo

- Se suas contas de dados são muito grandes para a memória Stack, use `Box` para alocá-las na memória Heap
- Use Zero-Copy para lidar com contas que são muito grandes para `Box` (< 10MB)
- O tamanho e a ordem dos campos em uma conta importam; coloque campos de comprimento variável no final
- A Solana pode processar em paralelo, mas ainda pode haver gargalos; esteja atento às contas "compartilhadas" que todos os usuários interagindo com o programa têm que escrever

# Visão Geral

A arquitetura do programa é o que separa o amador do profissional. Criar programas de alto desempenho tem mais a ver com o **design** do sistema do que com o código. E você, como designer, precisa pensar sobre:

    1. O que seu código precisa fazer
    2. Quais implementações possíveis existem
    3. Quais são os trade-offs entre diferentes implementações

Essas perguntas são ainda mais importantes ao desenvolver para uma blockchain. Não só os recursos são mais limitados do que em um ambiente de computação típico, mas você também está lidando com os ativos das pessoas; o código agora tem um custo.

Deixaremos a maior parte da discussão sobre o manuseio de ativos para as [lições de segurança](./security-intro.md), mas é importante observar a natureza das limitações de recursos no desenvolvimento na Solana. Existem, claro, limitações de um ambiente de desenvolvimento típico, mas há limitações únicas para o desenvolvimento na blockchain e na Solana, como a quantidade de dados que pode ser armazenada em uma conta, o custo para armazenar esses dados, e quantas unidades de computação estão disponíveis por transação. Você, o designer do programa, deve estar ciente dessas limitações para criar programas que sejam acessíveis, rápidos, seguros e funcionais. Hoje, vamos explorar algumas das considerações mais avançadas que devem ser levadas em conta ao criar programas na Solana. 

## Lidando Com Grandes Contas

Na programação de aplicativos modernos, muitas vezes não precisamos pensar sobre o tamanho das estruturas de dados que estamos usando. Quer fazer uma string? Você pode colocar um limite de 4000 caracteres para evitar abusos, mas isso provavelmente não será um problema. Quer um inteiro? Eles quase sempre têm 32 bits, por conveniência.

Em linguagens de alto nível, você está na terra da abundância de dados! Agora, na Solana, pagamos por byte armazenado (aluguel) e temos limites de tamanho para heap, stack e contas. Temos que ser um pouco mais astutos com nossos bytes. Há duas preocupações principais que vamos examinar nesta seção:

1. Como pagamos por byte, geralmente queremos manter nossa pegada o menor possível. Vamos mergulhar mais em otimização em outra seção, mas vamos introduzir o conceito de tamanhos de dados aqui.

2. Ao operar em dados maiores, enfrentamos restrições de [Stack](https://docs.solana.com/developing/onchain-programs/faq#stack) e [Heap](https://docs.solana.com/developing/onchain-programs/faq#heap-size) - para contornar isso, vamos olhar para o uso de Box e Zero-Copy.

### Tamanhos

Na Solana, o pagador da taxa de uma transação paga por cada byte armazenado onchain. Chamamos isso de [aluguel](https://docs.solana.com/developing/intro/rent). Observação à parte: aluguel é um termo um pouco impróprio, pois nunca é realmente retirado permanentemente. Uma vez que você deposita o aluguel na conta, esses dados podem permanecer lá para sempre ou você pode ser reembolsado do aluguel se fechar a conta. O aluguel costumava ser uma coisa real, mas agora há uma isenção mínima obrigatória de aluguel. Você pode ler sobre isso na [documentação da Solana](https://docs.solana.com/developing/intro/rent).

Deixando de lado a etimologia do aluguel, colocar dados na blockchain pode ser caro. É por isso que os atributos de NFT e arquivos associados, como a imagem, são armazenados fora da blockchain. Em última análise, é desejável encontrar um equilíbrio que deixe seu programa altamente funcional sem se tornar tão caro a ponto de seus usuários não quererem pagar para abrir a conta de dados.

A primeira coisa que você precisa saber antes de começar a otimizar o espaço em seu programa é o tamanho de cada uma das suas structs. Abaixo está uma lista muito útil do [Anchor Book](https://book.anchor-lang.com/anchor_references/space.html).


| Tipos        | Espaço em bytes | Detalhes/Exemplo                                           |
|--------------|-----------------|------------------------------------------------------------|
| bool         | 1               | só precisaria de 1 bit, mas ainda usa 1 byte               |
| u8/i8        | 1               |                                                            |
| u16/i16      | 2               |                                                            |
| u32/i32      | 4               |                                                            |
| u64/i64      | 8               |                                                            |
| u128/i128    | 16              |                                                            |
| [T;quantidade]  | espaço de memória(T) * quantidade | Por exemplo, espaço([u16;32]) = 2 * 32 = 64               |
| Pubkey       | 32              |                                                            |
| Vec<T>       | 4 + (espaço(T) * quantia) | O tamanho da conta é fixo, então a conta deve ser inicializada com espaço suficiente desde o início |
| String       | 4 + comprimento da string em bytes | O tamanho da conta é fixo, então a conta deve ser inicializada com espaço suficiente desde o início |
| Option<T>    | 1 + (espaço(T)) |                                                            |
| Enum         | 1 + Tamanho da Maior Variante | e.g. Enum { A, B { val: u8 }, C { val: u16 } } -> 1 + espaço(u16) = 3 |
| f32          | 4               | a serialização falhará para NaN                            |
| f64          | 8               | a serialização falhará para NaN                            |
| Accounts     | 8 + espaço(T)   | #[account()] pub struct T { …                              |
| Estruturas de Dados | espaço(T) | #[derive(Clone, AnchorSerialize, AnchorDeserialize)] pub struct T { … } |


Sabendo disso, comece a pensar em pequenas otimizações que você pode fazer em um programa. Por exemplo, se você tem um campo inteiro que só chegará a 100, não use um u64/i64, use um u8. Por quê? Porque um u64 ocupa 8 bytes, com um valor máximo de 2^64 ou 1,84 * 10^19. Isso é um desperdício de espaço, já que você só precisa acomodar números até 100. Um único byte lhe dará um valor máximo de 255, o que, neste caso, seria suficiente. Da mesma forma, não há razão para usar i8 se você nunca terá números negativos.

No entanto, tenha cuidado com tipos de número pequenos. Você pode rapidamente encontrar comportamento inesperado devido ao transbordamento (overflow). Por exemplo, um tipo u8 que é incrementado iterativamente atingirá 255 e depois voltará para 0 em vez de 256. Para mais contexto do mundo real, pesquise sobre o **[bug do ano 2000](https://www.nationalgeographic.org/encyclopedia/Y2K-bug/#:~:text=As%20the%20year%202000%20approached%2C%20computer%20programmers%20realized%20that%20computers,would%20be%20damaged%20or%20flawed.)**.

Se você quiser ler mais sobre tamanhos no Anchor, dê uma olhada no [post do blog da Sec3 sobre isso](https://www.sec3.dev/blog/all-about-anchor-account-size).

### Box

Agora que você sabe um pouco sobre tamanhos de dados, vamos avançar e olhar para um problema que você encontrará se quiser lidar com contas de dados maiores. Suponha que você tenha a seguinte conta de dados:

```rust
#[account]
pub struct SomeBigDataStruct {
    pub big_data: [u8; 5000],
}  

#[derive(Accounts)]
pub struct SomeFunctionContext<'info> {
    pub some_big_data: Account<'info, SomeBigDataStruct>,
}
```

Se você tentar passar `SomeBigDataStruct` para a função com o contexto `SomeFunctionContext`, você encontrará o seguinte aviso do compilador:

`// Stack offset of XXXX exceeded max offset of 4096 by XXXX bytes, please minimize large stack variables`

E se você tentar executar o programa, ele apenas travará e falhará.

Por que isso acontece?

Isso tem a ver com a memória Stack. Toda vez que você chama uma função na Solana, ela recebe um quadro da stack de 4KB. Esta é a alocação de memória estática para variáveis locais. É onde toda essa `SomeBigDataStruct` é armazenada na memória e, como 5000 bytes, ou 5KB, é maior que o limite de 4KB, ela lançará um erro de stack. Então, como resolvemos isso?

A resposta é o tipo **`Box<T>`**!

```rust
#[account]
pub struct SomeBigDataStruct {
    pub big_data: [u8; 5000],
}  

#[derive(Accounts)]
pub struct SomeFunctionContext<'info> {
    pub some_big_data: Box<Account<'info, SomeBigDataStruct>>, // <- Box Adicionado!
}
```

No Anchor, **`Box<T>`** é usado para alocar a conta na Heap, não na Stack. O que é ótimo, já que a Heap nos dá 32KB para trabalhar. A melhor parte é que você não precisa fazer nada diferente dentro da função. Tudo o que você precisa fazer é adicionar `Box<...>` em torno de todas as suas grandes contas de dados.

Mas o Box não é perfeito. Você ainda pode ter um transbordamento da stack com contas suficientemente grandes. Aprenderemos como consertar isso na próxima seção.

### Zero-Copy

Ok, então agora você pode lidar com contas de tamanho médio usando um `Box`. Mas e se você precisar usar contas realmente grandes, como o tamanho máximo de 10MB? Tome o seguinte como exemplo:

```rust
#[account]
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384 bytes
}
```

Esta conta fará seu programa falhar, mesmo envolvida em um `Box`. Para contornar isso, você pode usar `zero_copy` e `AccountLoader`. Basta adicionar `zero_copy` à sua estrutura de conta, adicionar `zero` como uma restrição na estrutura de validação da conta, e envolver o tipo de conta na estrutura de validação da conta em um `AccountLoader`.

```rust
#[account(zero_copy)]
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384 bytes
}

pub struct ConceptZeroCopy<'info> {
    #[account(zero)]
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

Para entender o que está acontecendo aqui, dê uma olhada na [documentação Rust do Anchor](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html)

> Além de ser mais eficiente, o benefício mais saliente que [`zero_copy`] oferece é a capacidade de definir tipos de conta maiores do que o tamanho máximo da stack ou heap. Ao usar borsh, a conta tem que ser copiada e desserializada em uma nova estrutura de dados e, portanto, está limitada pelos limites da stack e heap impostos pela máquina virtual BPF. Com a desserialização zero-copy, todos os bytes do `RefCell<&mut [u8]>` de apoio da conta são simplesmente reinterpretados como uma referência à estrutura de dados, sem necessidade de alocações ou cópias. Daí a capacidade de contornar limitações de stack e heap.

Basicamente, seu programa nunca carrega realmente os dados da conta zero-copy na stack ou heap. Em vez disso, obtém acesso por ponteiro aos dados brutos. O `AccountLoader` garante que isso não mude muito a forma como você interage com a conta a partir do seu código.

Há algumas ressalvas ao usar `zero_copy`. Primeiro, você não pode usar a restrição `init` na estrutura de validação da conta como você pode estar acostumado. Isso se deve ao fato de haver um limite de CPI para contas maiores do que 10KB.

```rust
pub struct ConceptZeroCopy<'info> {
    #[account(zero, init)] // <- Não é possível fazer isso
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

Em vez disso, seu cliente tem que criar a grande conta e pagar pelo seu aluguel em uma instrução separada.

```tsx
const accountSize = 16_384 + 8
const ix = anchor.web3.SystemProgram.createAccount({
  fromPubkey: wallet.publicKey,
  newAccountPubkey: someReallyBigData.publicKey,
  lamports: await program.provider.connection.getMinimumBalanceForRentExemption(accountSize),
  space: accountSize,
  programId: program.programId,
});

const txHash = await program.methods.conceptZeroCopy().accounts({
  owner: wallet.publicKey,
  someReallyBigData: someReallyBigData.publicKey,
}).signers([
  someReallyBigData,
]).preInstructions([
  ix
])
.rpc()
```

A segunda ressalva é que você terá que chamar um dos seguintes métodos de dentro da sua função de instrução Rust para carregar a conta:

- `load_init` ao inicializar uma conta pela primeira vez (isso ignorará o discriminador de conta ausente que só é adicionado após o código de instrução do usuário)
- `load` quando a conta não é mutável
- `load_mut` quando a conta é mutável

Por exemplo, se você quisesse inicializar e manipular o `SomeReallyBigDataStruct` mencionado acima, você chamaria o seguinte na função

```rust
let some_really_big_data = &mut ctx.accounts.some_really_big_data.load_init()?;
```

Depois de fazer isso, então você pode tratar a conta como normal! Experimente isso no código você mesmo para ver tudo em ação!

Para um melhor entendimento de como tudo isso funciona, a Solana montou um [vídeo](https://www.youtube.com/watch?v=zs_yU0IuJxc&feature=youtu.be) e um [código](https://github.com/solana-developers/anchor-zero-copy-example) explicando Box e Zero-Copy em Solana básico.

## Lidando com Contas

Agora que você conhece os detalhes de consideração de espaço na Solana, vamos olhar algumas considerações de nível mais alto. Na Solana, tudo é uma conta, então nas próximas seções vamos olhar alguns conceitos de arquitetura de conta.

### Ordem dos Dados

Esta primeira consideração é bastante simples. Como regra geral, mantenha todos os campos de comprimento variável no final da conta. Observe o seguinte:

```rust
#[account] // O Anchor esconde o discriminador de conta
pub struct BadState {
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
    pub id: u32         // 0xDEAD_BEEF
}
```

O campo `flags` é de comprimento variável. Isso torna a busca de uma conta específica pelo campo `id` muito difícil, pois uma atualização nos dados em `flags` muda a localização de `id` no mapa de memória.

Para tornar isso mais claro, observe a aparência dos dados desta conta na cadeia quando `flags` tem quatro itens no vetor versus oito itens. Se você chamasse `solana account ACCOUNT_KEY`, obteria um despejo de dados como o seguinte:

```rust
0000:   74 e4 28 4e    d9 ec 31 0a  -> Account Discriminator (8)
0008:	04 00 00 00    11 22 33 44  -> Vec Size (4) | Data 4*(1)
0010:   DE AD BE EF                 -> id (4)

--- vs ---

0000:   74 e4 28 4e    d9 ec 31 0a  -> Account Discriminator (8)
0008:	08 00 00 00    11 22 33 44  -> Vec Size (8) | Data 4*(1)
0010:   55 66 77 88    DE AD BE EF  -> Data 4*(1) | id (4)
```

Nos dois casos, os primeiros oito bytes são o discriminador de conta do Anchor. No primeiro caso, os próximos quatro bytes representam o tamanho do vetor `flags`, seguido por outros quatro bytes para os dados e, finalmente, os dados do campo `id`.

No segundo caso, o campo `id` se moveu do endereço 0x0010 para 0x0014 porque os dados no campo `flags` ocuparam quatro bytes a mais.

O principal problema com isso é a busca. Quando você consulta a Solana, usa filtros que olham para os dados brutos de uma conta. Esses são chamados de filtros `memcmp`, ou filtros de comparação de memória. Você fornece ao filtro os campos `offset` e `bytes`, e o filtro então olha diretamente para a memória, deslocando-se a partir do início pelo `offset` que você forneceu, e compara os bytes na memória com os `bytes` que você forneceu.

Por exemplo, você sabe que a estrutura `flags` sempre começará no endereço 0x0008, já que os primeiros 8 bytes contêm o discriminador da conta. Consultar todas as contas onde o comprimento de `flags` é igual a quatro é possível porque nós *sabemos* que os quatro bytes em 0x0008 representam o comprimento dos dados em `flags`. Já que o discriminador da conta é:

```typescript
const states = await program.account.badState.all([
  {memcmp: {
    offset: 8,
    bytes: bs58.encode([0x04])
  }}
]);
```

No entanto, se você quisesse consultar pelo `id`, você não saberia o que colocar para o `offset`, já que a localização de `id` é variável com base no comprimento de `flags`. Isso não parece muito útil. IDs geralmente estão lá para ajudar nas consultas! A correção simples é inverter a ordem.

```rust
#[account] // Anchor esconde o discriminador de conta
pub struct GoodState {
	pub id: u32         // 0xDEAD_BEEF
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
}
```

Com campos de comprimento variável no final da struct, você sempre pode consultar contas com base em todos os campos até o primeiro campo de comprimento variável. Para ecoar o início desta seção: Como regra geral, mantenha todas as structs de comprimento variável no final da conta.

### Para Uso Futuro

Em certos casos, considere adicionar bytes extras e não utilizados às suas contas. Estes são reservados para flexibilidade e compatibilidade com versões anteriores. Tome o seguinte exemplo:

```rust
#[account]
pub struct GameState {
    pub health: u64,
    pub mana: u64,
    pub event_log: Vec<string>
}
```

Neste simples estado de jogo (`GameState`), um personagem tem saúde (`health`), `mana` e um registro de eventos (`event_log`). Se em algum momento você estiver fazendo melhorias no jogo e quiser adicionar um campo de experiência (`experience`), você encontrará um obstáculo. O campo `experience` deve ser um número como um `u64`, o que é simples de adicionar. Você pode [realocar a conta](./anchor-pdas.md#realloc) e adicionar espaço.

No entanto, para manter campos de comprimento dinâmico, como `event_log`, no final da struct, você precisaria fazer alguma manipulação de memória em todas as contas realocadas para mover a localização de `event_log`. Isso pode ser complicado e torna a consulta de contas muito mais difícil. Você acabará em um estado onde contas não migradas têm `event_log` em um local e contas migradas em outro. O antigo `GameState` sem `experience` e o novo `GameState` com `experience` nele não são mais compatíveis. Contas antigas não serão serializadas quando usadas onde novas contas são esperadas. As consultas serão muito mais difíceis. Você provavelmente precisará criar um sistema de migração e uma lógica contínua para manter a compatibilidade com versões anteriores. No final das contas, começa a parecer uma má ideia.

Felizmente, se você pensar à frente, você pode adicionar um campo "para uso futuro" (`for_future_use`), que reserva alguns bytes onde você mais espera precisar deles.

```rust
#[account]
pub struct GameState { //V1
    pub health: u64,
    pub mana: u64,
	pub for_future_use: [u8; 128],
    pub event_log: Vec<string>
}
```

Dessa forma, quando você for adicionar `experience` ou algo semelhante, vai parecer com isso abaixo. Agora, as contas antigas e as novas são compatíveis.

```rust
#[account]
pub struct GameState { //V2
    pub health: u64,
    pub mana: u64,
	pub experience: u64,
	pub for_future_use: [u8; 120],
    pub event_log: Vec<string>
}
```

Esses bytes extras aumentam o custo de usar seu programa. No entanto, parece valer a pena na maioria dos casos.

Então, como regra geral: sempre que você achar que os tipos de conta têm potencial para mudar de uma forma que exigirá algum tipo de migração complexa, adicione alguns bytes `for_future_use`.

### Otimização de Dados

A ideia aqui é estar ciente dos bits desperdiçados. Por exemplo, se você tem um campo que representa o mês do ano, não use um `u64`. Só haverá 12 meses. Use um `u8`. Melhor ainda, use um Enum `u8` e rotule os meses.

Para ser ainda mais agressivo nas economias de bits, tenha cuidado com booleanos. Olhe para a struct abaixo composta por oito flags booleanas. Embora um booleano *possa* ser representado como um único bit, a desserialização borsh alocará um byte inteiro para cada um desses campos. Isso significa que oito booleanos acabam sendo oito bytes em vez de oito bits, um aumento de tamanho oito vezes.

```rust
#[account]
pub struct BadGameFlags { // 8 bytes
    pub is_frozen: bool,
    pub is_poisoned: bool,
    pub is_burning: bool,
    pub is_blessed: bool,
    pub is_cursed: bool,
    pub is_stunned: bool,
    pub is_slowed: bool,
    pub is_bleeding: bool,
}
```

Para otimizar isso, você poderia ter um único campo como um `u8`. Então você pode usar operações bit a bit para olhar cada bit e determinar se está "ativado" ou não.

```rust
const IS_FROZEN_FLAG: u8 = 1 << 0;
const IS_POISONED_FLAG: u8 = 1 << 1;
const IS_BURNING_FLAG: u8 = 1 << 2;
const IS_BLESSED_FLAG: u8 = 1 << 3;
const IS_CURSED_FLAG: u8 = 1 << 4;
const IS_STUNNED_FLAG: u8 = 1 << 5;
const IS_SLOWED_FLAG: u8 = 1 << 6;
const IS_BLEEDING_FLAG: u8 = 1 << 7;
const NO_EFFECT_FLAG: u8 = 0b00000000;
#[account]
pub struct GoodGameFlags { // 1 byte
    pub status_flags: u8, 
} 
```

Isso economiza 7 bytes de dados! O trade-off, é claro, é agora você tem que fazer operações bit a bit. Mas isso vale a pena ter no seu conjunto de ferramentas.

### Indexação

Este último conceito de conta é divertido e ilustra o poder dos PDAs. Ao criar contas de programa, você pode especificar as sementes usadas para derivar o PDA. Isso é excepcionalmente poderoso, pois permite derivar seus endereços de conta em vez de armazená-los.

O melhor exemplo disso são as boas e velhas Contas de Token Associadas (Associated Token Accounts, ou ATAs)!

```typescript
function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  )[0];
}
```

Isso é como a maioria dos seus tokens SPL são armazenados. Em vez de manter uma tabela de banco de dados de endereços de contas de token SPL, a única coisa que você precisa saber é o endereço da sua carteira e o endereço da cunhagem. O endereço da ATA pode ser calculado ao juntar esses dois endereços e voilà! Você tem o endereço da sua conta de token.

Dependendo da semeadura, você pode criar todos os tipos de relações:

- Uma-Para-Cada-Programa (Conta Global) - Se você criar uma conta com `seeds=[b"UMA PARA CADA PROGRAMA"]`, apenas uma pode existir para essa semente naquele programa. Por exemplo, se o seu programa precisa de uma tabela de consulta, você poderia criar com `seeds=[b"Consulta"]`. Apenas tenha cuidado para fornecer restrições de acesso apropriadas.
- Uma-Para-Cada-Dono - Digamos que você está criando uma conta de jogador para um jogo de vídeo game e você só quer uma conta de jogador por carteira. Então você semearia a conta com `seeds=[b"JOGADOR", owner.key().as_ref()]`. Dessa forma, você sempre saberá onde procurar pela conta de jogador de uma carteira **e** só pode existir uma delas.
- Múltiplas-Para-Cada-Dono - Ok, mas e se você quiser várias contas por carteira? Digamos que você queira criar episódios de podcasts. Então você poderia semear sua conta `Podcast` assim: `seeds=[b"Podcast", owner.key().as_ref(), episode_number.to_be_bytes().as_ref()]`. Agora, se você quiser procurar o episódio 50 de uma carteira específica, você pode! E você pode ter tantos episódios quanto quiser por dono.
- Uma-Para-Cada-Dono-Para-Cada-Conta - Isso é efetivamente o exemplo de ATA que vimos acima. Onde temos uma conta de token por carteira e conta de cunhagem. `seeds=[b"Mock ATA", owner.key().as_ref(), mint.key().as_ref()]`

A partir daí, você pode misturar e combinar de todas as formas inteligentes! Mas a lista anterior deve dar a você o suficiente para começar.

O grande benefício de realmente prestar atenção a este aspecto do design é responder ao problema de 'indexação'. Sem PDAs e sementes, todos os usuários teriam que acompanhar todos os endereços de todas as contas que já usaram. Isso não é viável para os usuários, então eles teriam que depender de uma entidade centralizada para armazenar seus endereços em um banco de dados. De muitas maneiras, isso derrota o propósito de uma rede globalmente distribuída. PDAs são uma solução muito melhor.

Para reforçar tudo isso, aqui está um exemplo de um esquema de um programa de podcasting em produção. O programa precisava das seguintes contas:

- **Conta do Canal**
    - Nome
    - Episódios Criados (u64)
- **Conta(s) do Podcast**
    - Nome
    - URL do Áudio

Para indexar adequadamente cada endereço de conta, as contas usam as seguintes sementes:

```rust
// Conta do canal
seeds=[b"Channel", owner.key().as_ref()]

// Conta do podcast
seeds=[b"Podcast", channel_account.key().as_ref(), episode_number.to_be_bytes().as_ref()]
```

Você sempre pode encontrar a conta do canal para um proprietário específico. E como o canal armazena o número de episódios criados, você sempre sabe o limite superior de onde procurar para consultas. Além disso, você sempre sabe em que índice criar um novo episódio: `index = episodes_created`.

```rust
Podcast 0: seeds=[b"Podcast", channel_account.key().as_ref(), 0.to_be_bytes().as_ref()] 
Podcast 1: seeds=[b"Podcast", channel_account.key().as_ref(), 1.to_be_bytes().as_ref()] 
Podcast 2: seeds=[b"Podcast", channel_account.key().as_ref(), 2.to_be_bytes().as_ref()] 
...
Podcast X: seeds=[b"Podcast", channel_account.key().as_ref(), X.to_be_bytes().as_ref()] 
```

## Lidando com Concorrência

Um dos principais motivos para escolher Solana para o seu ambiente blockchain é sua execução paralela de transações. Ou seja, a Solana pode executar transações em paralelo, desde que essas transações não estejam tentando escrever dados na mesma conta. Isso melhora o rendimento do programa imediatamente, mas com um planejamento adequado você pode evitar problemas de concorrência e realmente aumentar o desempenho do seu programa.

### Contas Compartilhadas

Se você já está no mundo das criptomoedas há um tempo, pode ter vivenciado um grande evento de cunhagem de NFT. Um novo projeto de NFT está saindo, todos estão realmente empolgados com isso, e então a Candy Machine entra em ação. É uma corrida bem louca para aceitar a transação clicando em `accept transaction` o mais rápido possível. Se você foi esperto, pode ter escrito um bot para inserir as transações mais rápido que a UI do site poderia. Essa corrida louca para cunhar cria muitas transações fracassadas. Mas por quê? Porque todo mundo está tentando escrever dados na mesma conta da Candy Machine.

Veja um exemplo simples:

Alice e Bob estão tentando pagar os amigos Carol e Dean, respectivamente. Todas as quatro contas mudam, mas nenhuma depende uma da outra. Ambas as transações podem ser executadas ao mesmo tempo.

```rust
Alice -- paga --> Carol

Bob ---- paga --> Dean
```

Mas se Alice e Bob tentarem pagar Carol ao mesmo tempo, eles encontrarão problemas.

```rust
Alice -- paga --> |
						-- > Carol
Bob   -- paga --- |
```

Como ambas essas transações escrevem na conta de token da Carol, apenas uma delas pode passar por vez. Felizmente, a Solana é extremamente rápida, então provavelmente parecerá que elas são pagas ao mesmo tempo. Mas, e se mais pessoas além de Alice e Bob tentarem pagar Carol?

```rust
Alice -- paga --> |
						-- > Carol
x1000 -- paga --- | 
Bob   -- paga --- |
```

E se 1000 pessoas tentarem pagar Carol ao mesmo tempo? Cada uma das 1000 instruções será enfileirada para ser executada em sequência. Para algumas delas, o pagamento parecerá realizado imediatamente. Essas pessoas serão as sortudas cuja instrução foi incluída cedo. Mas algumas pessoas acabarão esperando bastante tempo. E para algumas, a transação simplesmente falhará.

Embora pareça improvável que 1000 pessoas paguem Carol ao mesmo tempo, é muito comum ter um evento, como uma cunhagem de NFT, onde muitas pessoas estão tentando escrever dados na mesma conta ao mesmo tempo.

Imagine que você cria um programa super popular e quer cobrar uma taxa em cada transação que processa. Por razões contábeis, você quer que todas essas taxas vão para uma carteira. Com essa configuração, em uma onda de usuários, seu protocolo se tornará lento e ou se tornará pouco confiável. Não é bom. Então, qual é a solução? Separe a transação de dados da transação de taxa.

Por exemplo, imagine que você tenha uma conta de dados chamada `DonationTally`. Sua única função é registrar quanto você doou para uma carteira comunitária específica e codificada.

```rust
#[account]
pub struct DonationTally {
    is_initialized: bool,
    lamports_donated: u64,
    lamports_to_redeem: u64,
    owner: Pubkey,
}
```

Primeiro, vamos examinar a solução abaixo do ideal.

```rust
pub fn run_concept_shared_account_bottleneck(ctx: Context<ConceptSharedAccountBottleneck>, lamports_to_donate: u64) -> Result<()> {

    let donation_tally = &mut ctx.accounts.donation_tally;

    if !donation_tally.is_initialized {
        donation_tally.is_initialized = true;
        donation_tally.owner = ctx.accounts.owner.key();
        donation_tally.lamports_donated = 0;
        donation_tally.lamports_to_redeem = 0;
    }

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.community_wallet.to_account_info(),
        });
    transfer(cpi_context, lamports_to_donate)?;
    

    donation_tally.lamports_donated = donation_tally.lamports_donated.checked_add(lamports_to_donate).unwrap();    
    donation_tally.lamports_to_redeem = 0;

    Ok(())
}
```

Você pode ver que a transferência para a `community_wallet` codificada rigidamente ocorre na mesma função em que você atualiza as informações do saldo. Esta é a solução mais direta, mas se você executar os testes para esta seção, verá a desaceleração.

Agora, examine a solução otimizada:

```rust
pub fn run_concept_shared_account(ctx: Context<ConceptSharedAccount>, lamports_to_donate: u64) -> Result<()> {

    let donation_tally = &mut ctx.accounts.donation_tally;

    if !donation_tally.is_initialized {
        donation_tally.is_initialized = true;
        donation_tally.owner = ctx.accounts.owner.key();
        donation_tally.lamports_donated = 0;
        donation_tally.lamports_to_redeem = 0;
    }

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: donation_tally.to_account_info(),
        });
    transfer(cpi_context, lamports_to_donate)?;

    donation_tally.lamports_donated = donation_tally.lamports_donated.checked_add(lamports_to_donate).unwrap();    
    donation_tally.lamports_to_redeem = donation_tally.lamports_to_redeem.checked_add(lamports_to_donate).unwrap();

    Ok(())
}

pub fn run_concept_shared_account_redeem(ctx: Context<ConceptSharedAccountRedeem>) -> Result<()> {
    let transfer_amount: u64 = ctx.accounts.donation_tally.lamports_donated;

    // Diminuir o saldo na conta donation_tally
    **ctx.accounts.donation_tally.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;

    // Aumentar o saldo na conta community_wallet
    **ctx.accounts.community_wallet.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    // Redefinir lamports_donated e lamports_to_redeem
    ctx.accounts.donation_tally.lamports_to_redeem = 0;

    Ok(())
}
```

Aqui, na função `run_concept_shared_account`, em vez de transferir para o gargalo (`bottleneck`), transferimos para o PDA `donation_tally`. Dessa forma, estamos apenas afetando a conta do doador e seu PDA - então, sem gargalo! Além disso, mantemos um saldo interno de quantos lamports precisam ser resgatados, ou seja, transferidos do PDA para a carteira da comunidade em um momento posterior. Em algum momento no futuro, a carteira da comunidade passará e limpará todos os lamports restantes (provavelmente um bom trabalho para o [Clockwork](https://www.clockwork.xyz/)). É importante notar que qualquer um deve poder assinar pela função de resgate, já que o PDA tem permissão sobre si mesmo.

Se você quiser evitar gargalos a todo custo, esta é uma maneira de abordar isso. Em última análise, esta é uma decisão de design e a solução mais simples e menos otimizada pode ser adequada para alguns programas. Mas se o seu programa tiver um tráfego alto, vale a pena tentar otimizar. Você sempre pode executar uma simulação para ver seus casos piores, melhores e medianos.

## Veja isso em Ação

Todos os trechos de código desta lição fazem parte de um [programa Solana que criamos para ilustrar esses conceitos](https://github.com/Unboxed-Software/advanced-program-architecture.git). Cada conceito possui um programa e um arquivo de teste que o acompanham. Por exemplo, o conceito **Tamanhos** pode ser encontrado em:

**programa** - `programs/architecture/src/concepts/sizes.rs`

**teste** - `cd tests/sizes.ts`

Agora que você leu sobre cada um desses conceitos, sinta-se à vontade para mergulhar no código e experimentar um pouco. Você pode alterar valores existentes, tentar quebrar o programa e tentar entender como tudo funciona de um modo geral.

Você pode fazer o fork e/ou clonar [este programa do Github](https://github.com/Unboxed-Software/advanced-program-architecture.git) para começar. Antes de compilar e executar a suíte de testes, lembre-se de atualizar o `lib.rs` e o `Anchor.toml` com o ID do seu programa local.

Você pode executar toda a suíte de testes ou adicionar `.only` à chamada `describe` em um arquivo de teste específico para executar apenas os testes daquele arquivo. Sinta-se à vontade para personalizá-lo e torná-lo seu.

## Conclusão

Falamos sobre várias considerações de arquitetura de programa: bytes, contas, gargalos e mais. Se você acabar se deparando com alguma dessas considerações específicas ou não, espero que os exemplos e a discussão tenham despertado alguma reflexão. No final do dia, você é o designer do seu sistema. Seu trabalho é pesar os prós e contras de várias soluções. Seja proativo, mas seja prático. Não existe "uma única boa maneira" de projetar qualquer coisa. Apenas conheça os trade-offs.

# Demonstração

Vamos usar todos esses conceitos para criar um simples, mas otimizado, mecanismo de jogo RPG na Solana. Este programa terá as seguintes características:
- Permitir que os usuários criem um jogo (conta `Game`) e se tornem um "mestre do jogo" (a autoridade sobre o jogo)
- Mestres de jogo são responsáveis pela configuração de seus jogos
- Qualquer pessoa do público pode entrar em um jogo como jogador - cada combinação jogador/jogo terá uma conta `Player`
- Jogadores podem gerar e lutar contra monstros (conta `Monster`) gastando pontos de ação; usaremos lamports como pontos de ação
- Pontos de ação gastos vão para o tesouro de um jogo, conforme listado na conta `Game`

Vamos analisar os trade-offs de várias decisões de design à medida que avançamos para dar a você uma ideia do porquê fazemos as coisas. Vamos começar!

### 1. Configuração do Programa

Vamos construir isso do zero. Comece criando um novo projeto Anchor:

```powershell
anchor init rpg
```

Primeiro, substitua o ID do programa em `programs/rpg/lib.rs` e `Anchor.toml` pelo ID do programa mostrado quando você executar `anchor keys list`.

Finalmente, vamos estruturar o programa no arquivo `lib.rs`. Para facilitar o acompanhamento, vamos manter tudo em um arquivo. Vamos aprimorar isso com comentários de seção para melhor organização e navegação. Copie o seguinte em seu arquivo antes de começar:

```rust
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};
use anchor_lang::solana_program::log::sol_log_compute_units;

declare_id!("SUA_CHAVE_AQUI");

// ----------- CONTAS ----------

// ----------- CONFIGURAÇÃO DO JOGO ----------

// ----------- STATUS ----------

// ----------- INVENTÁRIO ----------

// ----------- AUXILIAR ----------

// ----------- CRIAR JOGO ----------

// ----------- CRIAR JOGADOR ----------

// ----------- GERAR MONSTRO ----------

// ----------- ATACAR MONSTRO ----------

// ----------- RESGATAR PARA O TESOURO ----------

#[program]
pub mod rpg {
    use super::*;

}
```

### 2. Criar Estruturas de Conta

Agora que nossa configuração inicial está pronta, vamos criar nossas contas. Teremos 3:

1. `Game` - Esta conta representa e gerencia um jogo. Inclui o tesouro para os participantes do jogo pagarem e uma struct de configuração que os mestres do jogo podem usar para personalizar o jogo. Deve incluir os seguintes campos:
    - `game_master` - efetivamente o dono/autoridade
    - `treasury` - o tesouro para o qual os jogadores enviarão pontos de ação (usaremos apenas lamports para pontos de ação)
    - `action_points_collected` - rastreia o número de pontos de ação coletados pelo tesouro
    - `game_config` - uma estrutura de configuração para personalizar o jogo
2. `Player` - Uma conta PDA cujo endereço é derivado usando o endereço da conta do jogo e o endereço da carteira do jogador como sementes. Tem vários campos necessários para rastrear o estado do jogo do jogador:
    - `player` - a chave pública do jogador
    - `game` - o endereço da conta do jogo correspondente
    - `action_points_spent` - o número de pontos de ação gastos
    - `action_points_to_be_collected` - o número de pontos de ação que ainda precisam ser coletados
    - `status_flag` - o status do jogador
    - `experience` - a experiência do jogador
    - `kills` - número de monstros mortos
    - `next_monster_index` - o índice do próximo monstro a enfrentar
    - `for_future_use` - 256 bytes reservados para uso futuro
    - `inventory` - um vetor do inventário do jogador
3. `Monster` - Uma conta PDA cujo endereço é derivado usando o endereço da conta do jogo, o endereço da carteira do jogador e um índice (o armazenado como `next_monster_index` na conta `Player`).
    - `player` - o jogador que o monstro está enfrentando
    - `game` - o jogo ao qual o monstro está associado
    - `hitpoints` - quantos pontos de vida o monstro ainda tem

Quando adicionadas ao programa, as contas devem parecer com algo assim:

```rust
// ----------- CONTAS ----------
#[account]
pub struct Game { // 8 bytes
    pub game_master: Pubkey,            // 32 bytes
    pub treasury: Pubkey,               // 32 bytes

    pub action_points_collected: u64,   // 8 bytes
    
    pub game_config: GameConfig,
}

#[account]
pub struct Player { // 8 bytes
    pub player: Pubkey,                 // 32 bytes
    pub game: Pubkey,                   // 32 bytes

    pub action_points_spent: u64,               // 8 bytes
    pub action_points_to_be_collected: u64,     // 8 bytes

    pub status_flag: u8,                // 8 bytes
    pub experience: u64,                 // 8 bytes
    pub kills: u64,                     // 8 bytes
    pub next_monster_index: u64,        // 8 bytes

    pub for_future_use: [u8; 256],      // Ataque/Velocidade/Defesa/Saúde/Mana?? Metadados??

    pub inventory: Vec<InventoryItem>,  // Max 8 items
}

#[account]
pub struct Monster { // 8 bytes
    pub player: Pubkey,                 // 32 bytes
    pub game: Pubkey,                   // 32 bytes

    pub hitpoints: u64,                 // 8 bytes
}
```

Não há muitas decisões de design complicadas aqui, mas vamos falar sobre os campos `inventory` e `for_future_use` na struct `Player`. Como `inventory` é variável em comprimento, decidimos colocá-lo no final da conta para facilitar a consulta. Também decidimos que vale a pena gastar um pouco mais de dinheiro na isenção de aluguel para ter 256 bytes de espaço reservado no campo `for_future_use`. Poderíamos excluir isso e simplesmente realocar contas se precisássemos adicionar campos futuramente, mas adicionar isso agora simplifica as coisas para nós no futuro.

Se escolhêssemos realocar no futuro, precisaríamos escrever consultas mais complicadas e provavelmente não poderíamos consultar em uma única chamada com base em `inventory`. Realocar e adicionar um campo moveria a posição de memória de `inventory`, deixando-nos escrever lógica complexa para consultar contas com várias estruturas.

### 3. Criando tipos auxiliares

A próxima coisa que precisamos fazer é adicionar alguns dos tipos que nossas contas referenciam e que ainda não criamos.

Vamos começar com a estrutura de configuração do jogo. Tecnicamente, isso poderia ter sido incluído na conta `Game`, mas é bom ter alguma separação e encapsulamento. Esta estrutura deve armazenar o número máximo de itens permitidos por jogador e alguns bytes para uso futuro. Novamente, os bytes para uso futuro aqui nos ajudam a evitar complexidade no futuro. Realocar contas funciona melhor quando você está adicionando campos no final de uma conta, em vez de no meio. Se você prevê adicionar campos no meio da data existente, pode fazer sentido adicionar alguns bytes de "uso futuro" antecipadamente.

```rust
// ----------- CONFIGURAÇÃO DO JOGO ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct GameConfig {
    pub max_items_per_player: u8,
    pub for_future_use: [u64; 16], // Saúde dos Inimigos?? Experiência por item?? Pontos de Ação por Ação??
}
```

Em seguida, vamos criar nossas flags de status. Lembre-se, nós *poderíamos* armazenar nossas flags como booleanos, mas economizamos espaço armazenando várias flags em um único byte. Cada flag ocupa um bit diferente dentro do byte. Podemos usar o operador `<<` para colocar `1` no bit correto.

```rust
// ----------- STATUS ----------

const IS_FROZEN_FLAG: u8 = 1 << 0;
const IS_POISONED_FLAG: u8 = 1 << 1;
const IS_BURNING_FLAG: u8 = 1 << 2;
const IS_BLESSED_FLAG: u8 = 1 << 3;
const IS_CURSED_FLAG: u8 = 1 << 4;
const IS_STUNNED_FLAG: u8 = 1 << 5;
const IS_SLOWED_FLAG: u8 = 1 << 6;
const IS_BLEEDING_FLAG: u8 = 1 << 7;
const NO_EFFECT_FLAG: u8 = 0b00000000;
```

Finalmente, vamos criar nosso `InventoryItem`. Isso deve ter campos para o nome do item, quantidade e alguns bytes reservados para uso futuro.

```rust
// ----------- INVENTÁRIO ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InventoryItem {
    pub name: [u8; 32], // Nome fixo de até 32 bytes
    pub amount: u64,
    pub for_future_use: [u8; 128], // Metadados?? // Efeitos // Bandeiras?
}
```

### 4. Criando a função auxiliar para gastar pontos de ação

A última coisa que faremos antes de escrever as instruções do programa é criar uma função auxiliar para gastar pontos de ação. Os jogadores enviarão pontos de ação (lamports) para o tesouro do jogo como pagamento por realizar ações no jogo.

Como enviar lamports para um tesouro requer escrever dados nessa conta do tesouro, podemos facilmente acabar com um gargalo de desempenho se muitos jogadores tentarem escrever no mesmo tesouro simultaneamente (veja [Lidando Com Concorrência](#dealing-with-concurrency)).

Em vez disso, enviaremos para a conta PDA do jogador e criaremos uma instrução que enviará os lamports dessa conta para o tesouro de uma vez só. Isso alivia quaisquer problemas de concorrência, já que cada jogador tem sua própria conta, mas também permite que o programa recupere esses lamports a qualquer momento.

```rust
// ----------- AUXILIAR ----------

pub fn spend_action_points<'info>(
    action_points: u64, 
    player_account: &mut Account<'info, Player>,
    player: &AccountInfo<'info>, 
    system_program: &AccountInfo<'info>, 
) -> Result<()> {

    player_account.action_points_spent = player_account.action_points_spent.checked_add(action_points).unwrap();
    player_account.action_points_to_be_collected = player_account.action_points_to_be_collected.checked_add(action_points).unwrap();

    let cpi_context = CpiContext::new(
        system_program.clone(), 
        Transfer {
            from: player.clone(),
            to: player_account.to_account_info().clone(),
        });
    transfer(cpi_context, action_points)?;

    msg!("Menos {} pontos de ação", action_points);

    Ok(())
}
```

### 5. Criando o Jogo

Nossa primeira instrução criará a conta `game`. Qualquer pessoa pode ser um `game_master` e criar seu próprio jogo, mas uma vez que um jogo é criado, existem certas restrições.

Primeiramente, a conta `game` é um PDA usando sua carteira `treasury`. Isso garante que o mesmo `game_master` possa executar vários jogos se usar um tesouro diferente para cada um.

Observe também que `treasury` é um signatário na instrução. Isso é para garantir que quem está criando o jogo tenha as chaves privadas do `treasury`. Esta é uma decisão de design, não "a maneira correta". Em última análise, é uma medida de segurança para garantir que o mestre do jogo possa recuperar seus fundos.

```rust
// ----------- CRIAR JOGO ----------

#[derive(Accounts)]
pub struct CreateGame<'info> {
    #[account(
        init, 
        seeds=[b"GAME", treasury.key().as_ref()],
        bump,
        payer = game_master, 
        space = std::mem::size_of::<Game>()+ 8
    )]
    pub game: Account<'info, Game>,

    #[account(mut)]
    pub game_master: Signer<'info>,

    /// VERIFICAÇÃO: Necessário saber que eles possuem o tesouro
    pub treasury: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn run_create_game(ctx: Context<CreateGame>, max_items_per_player: u8) -> Result<()> {

    ctx.accounts.game.game_master = ctx.accounts.game_master.key().clone();
    ctx.accounts.game.treasury = ctx.accounts.treasury.key().clone();

    ctx.accounts.game.action_points_collected = 0;
    ctx.accounts.game.game_config.max_items_per_player = max_items_per_player;

    msg!("Jogo criado!");

    Ok(())
}
```

### 6. Criando o Jogador

Nossa segunda instrução criará a conta `player`. Existem três compensações a se notar sobre esta instrução:

1. A conta do jogador é uma conta PDA derivada usando as contas `game` e `player`. Isso permite que os jogadores participem de múltiplos jogos, mas tenham apenas uma conta de jogador por jogo.
2. Nós envolvemos a conta `game` em um `Box` para colocá-la na heap, garantindo que não esgotemos a stack.
3. A primeira ação de qualquer jogador é se materializar no jogo, então chamamos `spend_action_points`. Atualmente nós codificamos rigidamente `action_points_to_spend` para ser 100 lamports, mas isso poderia ser algo adicionado à configuração do jogo no futuro.

```rust
// ----------- CRIAR JOGADOR ----------
#[derive(Accounts)]
pub struct CreatePlayer<'info> {
    pub game: Box<Account<'info, Game>>,

    #[account(
        init, 
        seeds=[
            b"PLAYER", 
            game.key().as_ref(), 
            player.key().as_ref()
        ], 
        bump, 
        payer = player, 
        space = std::mem::size_of::<Player>() + std::mem::size_of::<InventoryItem>() * game.game_config.max_items_per_player as usize + 8)
    ]
    pub player_account: Account<'info, Player>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn run_create_player(ctx: Context<CreatePlayer>) -> Result<()> {

    ctx.accounts.player_account.player = ctx.accounts.player.key().clone();
    ctx.accounts.player_account.game = ctx.accounts.game.key().clone();

    ctx.accounts.player_account.status_flag = NO_EFFECT_FLAG;
    ctx.accounts.player_account.experience = 0;
    ctx.accounts.player_account.kills = 0;

    msg!("O Herói entrou no jogo!");

    {   // Gaste 100 lamports para criar o jogador
        let action_points_to_spend = 100;

        spend_action_points(
            action_points_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}
```

### 7. Gerando o Monstro

Agora que temos um meio de criar jogadores, precisamos de uma maneira de gerar monstros para eles lutarem. Esta instrução criará uma nova conta `Monster` cujo endereço é uma conta PDA derivada com a conta `game`, a conta `player` e um índice representando o número de monstros que o jogador enfrentou. Há duas decisões de design aqui sobre as quais devemos falar:
1. As sementes do PDA nos permitem acompanhar todos os monstros que um jogador gerou
2. Nós envolvemos tanto as contas `game` quanto `player` em `Box` para alocá-las na Heap

```rust
// ----------- GERAR MONSTRO ----------
#[derive(Accounts)]
pub struct SpawnMonster<'info> {
    pub game: Box<Account<'info, Game>>,

    #[account(mut,
        has_one = game,
        has_one = player,
    )]
    pub player_account: Box<Account<'info, Player>>,

    #[account(
        init, 
        seeds=[
            b"MONSTER", 
            game.key().as_ref(), 
            player.key().as_ref(),
            player_account.next_monster_index.to_le_bytes().as_ref()
        ], 
        bump, 
        payer = player, 
        space = std::mem::size_of::<Monster>() + 8)
    ]
    pub monster: Account<'info, Monster>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn run_spawn_monster(ctx: Context<SpawnMonster>) -> Result<()> {

    {
        ctx.accounts.monster.player = ctx.accounts.player.key().clone();
        ctx.accounts.monster.game = ctx.accounts.game.key().clone();
        ctx.accounts.monster.hitpoints = 100;

        msg!("Monstro Gerado!");
    }

    {
        ctx.accounts.player_account.next_monster_index = ctx.accounts.player_account.next_monster_index.checked_add(1).unwrap();
    }

    {   // Gaste 5 lamports para gerar o monstro
        let action_point_to_spend = 5;

        spend_action_points(
            action_point_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}
```

### 8. Atacando o Monstro

É agora! Vamos atacar esses monstros e começar a ganhar experiência!

A lógica aqui é a seguinte:
- Os jogadores gastam 1 `action_point` para atacar e ganham 1 `experience`
- Se o jogador matar o monstro, seu contador de `kill` aumenta

Quanto às decisões de design, nós envolvemos cada uma das contas rpg em `Box` para alocá-las na heap. Além disso, usamos `saturating_add` ao incrementar experiência e na contagem de mortes.

A função `saturating_add` garante que o número nunca transbordará. Digamos que `kills` fosse um u8 e minha contagem atual de mortes fosse 255 (0xFF). Se eu matasse outro e adicionasse normalmente, por exemplo, `255 + 1 = 0 (0xFF + 0x01 = 0x00) = 0`, a contagem de mortes acabaria como 0. `saturating_add` manterá no seu máximo se estiver prestes a voltar para trás, então `255 + 1 = 255`. A função `checked_add` lançará um erro se estiver prestes a transbordar. Mantenha isso em mente ao fazer matemática em Rust. Embora `kills` seja um u64 e nunca voltará com sua programação atual, é boa prática usar matemática segura e considerar transbordamentos.

```rust
// ----------- ATACAR MONSTRO ----------
#[derive(Accounts)]
pub struct AttackMonster<'info> {

    #[account(
        mut,
        has_one = player,
    )]
    pub player_account: Box<Account<'info, Player>>,

    #[account(
        mut,
        has_one = player,
        constraint = monster.game == player_account.game
    )]
    pub monster: Box<Account<'info, Monster>>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn run_attack_monster(ctx: Context<AttackMonster>) -> Result<()> {

    let mut did_kill = false;

    {
        let hp_before_attack =  ctx.accounts.monster.hitpoints;
        let hp_after_attack = ctx.accounts.monster.hitpoints.saturating_sub(1);
        let damage_dealt = hp_before_attack - hp_after_attack;
        ctx.accounts.monster.hitpoints = hp_after_attack;

        

        if hp_before_attack > 0 && hp_after_attack == 0 {
            did_kill = true;
        }

        if  damage_dealt > 0 {
            msg!("Danos causados: {}", damage_dealt);
        } else {
            msg!("Pare! Já está morto!");
        }
    }

    {
        ctx.accounts.player_account.experience = ctx.accounts.player_account.experience.saturating_add(1);
        msg!("+1 EXP");

        if did_kill {
            ctx.accounts.player_account.kills = ctx.accounts.player_account.kills.saturating_add(1);
            msg!("Você matou o monstro!");
        }
    }

    {   // Gaste 1 lamport para atacar o monstro
        let action_point_to_spend = 1;

        spend_action_points(
            action_point_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}
```

### Resgatando para o Tesouro

Esta é a nossa última instrução. Esta instrução permite que qualquer pessoa envie os `action_points` gastos para a carteira `treasury`.

Mais uma vez, vamos envolver as contas rpg em `Box` e usar matemática segura.

```rust
// ----------- RESGATAR PARA O TESOURO ----------
#[derive(Accounts)]
pub struct CollectActionPoints<'info> {

    #[account(
        mut,
        has_one=treasury
    )]
    pub game: Box<Account<'info, Game>>,

    #[account(
        mut,
        has_one=game
    )]
    pub player: Box<Account<'info, Player>>,

    #[account(mut)]
    /// VERIFICAÇÃO: Está sendo verificado na conta do jogo
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// literalmente qualquer pessoa que pague pela taxa da transação pode executar este comando, dê isso para um bot do Clockwork
pub fn run_collect_action_points(ctx: Context<CollectActionPoints>) -> Result<()> {
    let transfer_amount: u64 = ctx.accounts.player.action_points_to_be_collected;

    **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
    **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    ctx.accounts.player.action_points_to_be_collected = 0;

    ctx.accounts.game.action_points_collected = ctx.accounts.game.action_points_collected.checked_add(transfer_amount).unwrap();

    msg!("O tesouro coletou {} pontos de ação para tesouro", transfer_amount);

    Ok(())
}
```

### Juntando Tudo

Agora que toda a nossa lógica de instrução está escrita, vamos adicionar essas funções às instruções reais no programa. Também pode ser útil registrar unidades de computação para cada instrução.

```rust
#[program]
pub mod rpg {
    use super::*;

    pub fn create_game(ctx: Context<CreateGame>, max_items_per_player: u8) -> Result<()> {
        run_create_game(ctx, max_items_per_player)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn create_player(ctx: Context<CreatePlayer>) -> Result<()> {
        run_create_player(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn spawn_monster(ctx: Context<SpawnMonster>) -> Result<()> {
        run_spawn_monster(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn attack_monster(ctx: Context<AttackMonster>) -> Result<()> {
        run_attack_monster(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn deposit_action_points(ctx: Context<CollectActionPoints>) -> Result<()> {
        run_collect_action_points(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

}
```

Se você adicionou todas as seções corretamente, você deve conseguir compilar com sucesso.

```shell
anchor build
```

### Testando

Agora, vamos ver essa belezura funcionar!

Vamos configurar o arquivo `tests/rpg.ts`. Nós preencheremos um teste de cada vez. Mas primeiro, precisamos configurar algumas contas diferentes. Principalmente as contas `gameMaster` e `treasury`.

```tsx
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rpg, IDL } from "../target/types/rpg";
import { assert } from "chai";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("RPG", () => {
  // Configure o cliente para usar o cluster local.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Rpg as Program<Rpg>;
  const wallet = anchor.workspace.Rpg.provider.wallet
    .payer as anchor.web3.Keypair;
  const gameMaster = wallet;
  const player = wallet;

  const treasury = anchor.web3.Keypair.generate();

it("Criar Jogo", async () => {});

it("Criar Jogador", async () => {});

it("Gerar Monstro", async () => {});

it("Atacar Monstro", async () => {});

it("Depositar Pontos de Ação", async () => {});

});
```

Agora vamos adicionar o teste `Criar Jogo`. Basta chamar `createGame` com oito itens, certifique-se de passar todas as contas, e garanta que a conta `treasury` assine a transação.

```tsx
it("Criar Jogo", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const txHash = await program.methods
      .createGame(
        8, // 8 Itens por jogador
      )
      .accounts({
        game: gameKey,
        gameMaster: gameMaster.publicKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([treasury])
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Imprima na tela se você desejar
    // const account = await program.account.game.fetch(gameKey);

  });
```

Agora, verifique se o seu teste está funcionando:

```tsx
yarn install
anchor test
```

**Solução alternativa:** Se, por algum motivo, o comando `yarn install` resultar em alguns arquivos `.pnp.*` e nenhum `node_modules`, você pode desejar executar `rm -rf .pnp.*` seguido de `npm i` e depois `yarn install`. Isso deve funcionar.

Agora que tudo está funcionando, vamos implementar os testes de `Criar Jogador`, `Gerar Monstro` e `Atacar Monstro`. Execute cada teste conforme você os completa para garantir que tudo está funcionando bem.

```typescript
it("Criar Jogador", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );

    const txHash = await program.methods
      .createPlayer()
      .accounts({
        game: gameKey,
        playerAccount: playerKey,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Imprima na tela se você desejar
    // const account = await program.account.player.fetch(playerKey);

});

it("Gerar Monstro", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );

    const playerAccount = await program.account.player.fetch(playerKey);

    const [monsterKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MONSTER"), gameKey.toBuffer(), player.publicKey.toBuffer(), playerAccount.nextMonsterIndex.toBuffer('le', 8)],
      program.programId
    );

    const txHash = await program.methods
      .spawnMonster()
      .accounts({
        game: gameKey,
        playerAccount: playerKey,
        monster: monsterKey,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Imprima na tela se você desejar
    // const account = await program.account.monster.fetch(monsterKey);

});

it("Atacar Monstro", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // Busque o último monstro criado
    const playerAccount = await program.account.player.fetch(playerKey);
    const [monsterKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MONSTER"), gameKey.toBuffer(), player.publicKey.toBuffer(), playerAccount.nextMonsterIndex.subn(1).toBuffer('le', 8)],
      program.programId
    );

    const txHash = await program.methods
      .attackMonster()
      .accounts({
        playerAccount: playerKey,
        monster: monsterKey,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Imprima na tela se você desejar
    // const account = await program.account.monster.fetch(monsterKey);

    const monsterAccount = await program.account.monster.fetch(monsterKey);
    assert(monsterAccount.hitpoints.eqn(99));
});
```

Note que o monstro que escolhemos para atacar é `playerAccount.nextMonsterIndex.subn(1).toBuffer('le', 8)`. Isso nos permite atacar o monstro gerado mais recentemente. Qualquer coisa abaixo do `nextMonsterIndex` deve funcionar. Por último, já que sementes são apenas um array de bytes, temos que transformar o índice em u64, que é um little endian `le` de 8 bytes.

Execute `anchor test` para causar algum dano!

Finalmente, vamos escrever um teste para reunir todos os pontos de ação depositados. Este teste pode parecer complexo pelo que está fazendo. Isso porque estamos gerando algumas novas contas para mostrar que qualquer um poderia chamar a função de resgate `depositActionPoints`. Usamos nomes como `clockwork` para estas contas, porque se este jogo estivesse funcionando continuamente, provavelmente faria sentido usar algo como as tarefas cron do [Clockwork](https://www.clockwork.xyz/).

```tsx
it("Depositar Pontos de Ação", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // Para mostrar que qualquer um pode depositar os pontos de ação
    // Ou seja, dê isso para um bot do clockwork
    const clockworkWallet = anchor.web3.Keypair.generate();

    // Para dar um equilíbrio inicial
    const clockworkProvider = new anchor.AnchorProvider(
        program.provider.connection,
        new NodeWallet(clockworkWallet),
        anchor.AnchorProvider.defaultOptions(),
    )
    const clockworkProgram = new anchor.Program<Rpg>(
        IDL,
        program.programId,
        clockworkProvider,
    )

    // Precisa dar alguns lamports às contas, caso contrário a transação falhará
    const amountToInitialize = 10000000000;

    const clockworkAirdropTx = await clockworkProgram.provider.connection.requestAirdrop(clockworkWallet.publicKey, amountToInitialize);
    await program.provider.connection.confirmTransaction(clockworkAirdropTx, "confirmed");

    const treasuryAirdropTx = await clockworkProgram.provider.connection.requestAirdrop(treasury.publicKey, amountToInitialize);
    await program.provider.connection.confirmTransaction(treasuryAirdropTx, "confirmed");

    const txHash = await clockworkProgram.methods
      .depositActionPoints()
      .accounts({
        game: gameKey,
        player: playerKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    const expectedActionPoints = 100 + 5 + 1; // Criação do Jogador ( 100 ) + Geração de Monstro ( 5 ) + Ataque ao Monstro ( 1 )
    const treasuryBalance = await program.provider.connection.getBalance(treasury.publicKey);
    assert(
        treasuryBalance == 
        (amountToInitialize + expectedActionPoints) // Criação do Jogador ( 100 ) + Geração de Monstro ( 5 ) + Ataque ao Monstro ( 1 )
    );

    const gameAccount = await program.account.game.fetch(gameKey);
    assert(gameAccount.actionPointsCollected.eqn(expectedActionPoints));

    const playerAccount = await program.account.player.fetch(playerKey);
    assert(playerAccount.actionPointsSpent.eqn(expectedActionPoints));
    assert(playerAccount.actionPointsToBeCollected.eqn(0));

});
```

Finalmente, execute `anchor test` para ver tudo funcionando.

Parabéns! Cobrimos muito aqui, mas agora você tem um mecanismo de um mini jogo RPG. Se as coisas não estiverem funcionando bem, volte à demonstração e encontre onde você errou. Se precisar, você pode consultar a [branch `main` do código da solução](https://github.com/Unboxed-Software/anchor-rpg).

Certifique-se de colocar esses conceitos em prática em seus próprios programas. Cada pequena otimização conta!

# Desafio

Agora é a sua vez de praticar independentemente. Volte ao código de demonstração procurando por otimizações adicionais e/ou expansões que você pode fazer. Pense em novos sistemas e recursos que você adicionaria e como os otimizaria.

Você pode encontrar algumas modificações de exemplo na branch `challenge-solution` do [repositório RPG](https://github.com/Unboxed-Software/anchor-rpg/tree/challenge-solution).

Finalmente, passe por um dos seus próprios programas e pense nas otimizações que você pode fazer para melhorar o gerenciamento de memória, tamanho de armazenamento e/ou concorrência.
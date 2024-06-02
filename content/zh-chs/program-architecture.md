---
title: 程序架构
objectives:
- 使用盒子和零复制来处理链上的大数据
- 做出更好的PDA设计决策
- 使您的程序具备未来可扩展性
- 处理并发问题
---

# 摘要

- 如果您的数据账户对于堆栈来说太大，可以用`Box`将它们分配到堆中
- 使用零复制来处理对于`Box`太大的账户 (< 10MB)
- 账户中字段的大小和顺序很重要；将可变长度字段放在末尾
- Solana可以并行处理，但仍可能遇到瓶颈；要注意所有用户都要对其进行写入的“共享”账户

# 课程

程序架构是业余爱好者与专业人士的分水岭。打造性能卓越的程序更多取决于系统**设计**，而不是代码。作为设计者，您需要考虑：

    1. 您的代码需要做什么
    2. 可能的实现方法是什么
    3. 不同实现之间的权衡

在为区块链开发时，这些问题更加重要。资源不仅比典型计算环境更有限，还涉及到用户资产；现在的代码是有成本的。

我们将把大部分资产处理讨论留给[安全课程](./security-intro)，但重要的是要注意Solana开发中资源限制的本质。当然，在典型的开发环境中也存在限制，但是区块链和Solana开发独有的限制，比如账户可存储数据量、存储数据的成本以及每个交易可用的计算单元数量。作为程序设计者，您必须留意这些限制，以创建经济实惠、快速、安全和实用的程序。今天我们将深入探讨在创建Solana程序时应该考虑的一些更高级的考量。

## 处理大账户

在现代应用程序编程中，我们很少需要考虑我们使用的数据结构的大小。想要创建一个字符串？您可以设置4000字符的限制，以避免滥用，但这可能不是一个问题。想要一个整数？它们几乎总是32位，非常方便。

在高级语言中，您处于数据世界的丰衣足食！然而，在Solana世界，我们按字节存储（房租）支付并且堆栈、堆、账户大小有限。我们必须在字节方面做得更巧妙。在本节中，我们将关注两个主要关注点：

1. 由于我们按字节收费，我们通常希望尽量减小我们的占用空间。我们将在另一节更深入地探讨优化，但在这里我们将向您介绍数据大小的概念。

2. 在操作更大的数据时，我们会遇到[Stack](https://docs.solana.com/developing/on-chain-programs/faq#stack)和[Heap](https://docs.solana.com/developing/on-chain-programs/faq#heap-size)的限制 - 为了避免这些限制，我们将使用Box和零复制。

### 大小

在Solana中，交易费支付者要为在链上存储的每个字节付费。我们称之为[房租](https://docs.solana.com/developing/intro/rent)。顺便说一句：房租有点称呼不当，因为它实际上从未真正被永久扣除。一旦您将房租存入账户，数据可以永远留在那里，或者如果您关闭账户，您可以获得房租退款。房租曾经是一个实际的东西，但现在有强制的最低房租豁免。您可以在[Solana文档](https://docs.solana.com/developing/intro/rent)中了解更多。

放下房租的词源，将数据放在区块链上可能是昂贵的。这就是为什么NFT属性和相关文件，如图像，被存储在链外。最终，您希望在程序非常实用的同时达到一种平衡，而不至于变得如此昂贵，以至于用户不愿为打开数据账户付费。

在开始为程序空间优化之前，您需要了解每个结构体的大小。下面是来自[Anchor书](https://book.anchor-lang.com/anchor_references/space.html)的一个非常有用的列表。

| 类型 | 字节大小 | 详细/示例 |
| --- | --- | --- |
| bool | 1 | 只需要1位，但仍使用1字节 |
| u8/i8 | 1 |  |
| u16/i16 | 2 |  |
| u32/i32 | 4 |  |
| u64/i64 | 8 |  |
| u128/i128 | 16 |  |
| [T;数量] | 空间(T) * 数量 | 例如，空间([u16;32]) = 2 * 32 = 64 |
| Pubkey | 32 |  |
| Vec<T> | 4 + (空间(T) * 数量) | 账户大小是固定的，因此账户应该从一开始就用足够的空间初始化 |
| String | 4 + 字符串的长度（字节）| 账户大小是固定的，因此账户应该从一开始就用足够的空间初始化 |
| Option<T> | 1 + (空间(T)) |  |
| 枚举 | 1 + 最大变体大小 | 例如，Enum { A, B { val: u8 }, C { val: u16 } } -> 1 + 空间(u16) = 3 |
| f32 | 4 | 序列化NaN将失败 |
| f64 | 8 | 序列化NaN将失败 |
| 账户 | 8 + 空间(T) | #[account()]
pub struct T { …  |
| 数据结构 | 空间(T) | #[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct T { … } |

知道了这些，开始思考您可能在程序中采取的一些微小优化措施。例如，如果您有一个整数字段，它只会达到100，那就不要使用u64/i64，而是使用u8。为什么？因为u64占用8字节，最大值为2^64或1.84 * 10^19。这是对空间的浪费，因为您只需要容纳最多100的数字。一个字节将给您最大值255，在这种情况下已足够。类似地，如果您永远不会有负数，就没有理由使用i8。


小心处理小数类型。由于溢出，您可能会遇到意外行为。例如，通过迭代增加的u8类型将达到255，然后返回到0，而不是256。有关更真实的背景信息，请查看**[Y2K bug](https://www.nationalgeographic.org/encyclopedia/Y2K-bug/#:~:text=As%20the%20year%202000%20approached%2C%20computer%20programmers%20realized%20that%20computers,would%20be%20damaged%20or%20flawed.)。**

如果您想了解有关anchor大小的更多信息，请参阅[Sec3关于此的博客帖子](https://www.sec3.dev/blog/all-about-anchor-account-size)。

### 盒

现在您已经了解了一些有关数据大小的知识，让我们快进一步，看看如果您需要处理更大的数据账户时可能遇到的问题。假设您有以下数据账户：

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

如果您尝试将`SomeBigDataStruct`传递给具有`SomeFunctionContext`上下文的函数，您将遇到以下编译器警告：

`// XXXX的栈偏移超出了XXXX字节的4096的最大偏移，请尽量减小大型栈变量`

如果您尝试运行程序，它将会挂起并失败。

为什么会这样呢？

这与堆栈有关。每次在Solana中调用函数时，都会获得一个4KB的堆栈帧。这是用于局部变量的静态内存分配。这是整个`SomeBigDataStruct`存储在内存中的地方，而由于5000个字节或5KB大于4KB的限制，它会引发堆栈错误。那么我们该如何解决这个问题呢？

答案是**`Box<T>`**类型！

```rust
#[account]
pub struct SomeBigDataStruct {
    pub big_data: [u8; 5000],
}  

#[derive(Accounts)]
pub struct SomeFunctionContext<'info> {
    pub some_big_data: Box<Account<'info, SomeBigDataStruct>>, // <- 增加了Box！
}
```

在Anchor中，**`Box<T>`**用于将账户分配到堆中，而不是堆栈中。这很棒，因为堆给了我们32KB的空间。最好的部分是您不需要在函数内做任何不同的事情。您只需要在所有大型数据账户周围添加`Box<…>`即可。

但是Box并非完美。您仍然可以用足够大的账户溢出堆栈。我们将在下一节学习如何解决这个问题。

### 零拷贝

好了，现在您可以使用`Box`处理中等规模的账户。但是如果您需要使用真正大的账户，比如最大10MB的账户会怎么样呢？以以下示例为例：

```rust
#[account]
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384字节
}
```

即使在`Box`中封装，这个账户也会让您的程序失败。为了解决这个问题，您可以使用`zero_copy`和`AccountLoader`。只需将`zero_copy`添加到您的账户结构中，将`zero`添加到账户验证结构中，并在账户验证结构中将账户类型包装在`AccountLoader`中。

```rust
#[account(zero_copy)]
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384字节
}

pub struct ConceptZeroCopy<'info> {
    #[account(zero)]
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

**注意**：在anchor的旧版本中 `< 0.28.0`，您可能需要使用：`zero_copy(unsafe))`([谢谢 @0xk2_](https://github.com/Unboxed-Software/solana-course/issues/347))

要了解这里发生了什么，请查看[rust Anchor documentation](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html)

> 除了更高效之外，[`zero_copy`]提供的最显著好处是能够定义大于最大堆栈或堆大小的账户类型。使用borsh时，需要将账户复制并反序列化为新的数据结构，因此受到BPF VM强加的堆栈和堆限制的约束。通过零拷贝反序列化，账户的所有字节只是被重新解释为数据结构的引用，​​而不需要分配或复制。因此，能够规避堆栈和堆限制。

基本上，您的程序实际上从未将零拷贝账户数据加载到堆栈或堆中。相反，它得到了对原始数据的指针访问。`AccountLoader`确保这不会对您从代码中与账户交互的方式产生太大的变化。

使用`zero_copy`有一些注意事项。首先，您不能像您可能习惯的那样在账户验证结构中使用`init`约束。这是因为对大于10KB的账户存在CPI限制。

```rust
pub struct ConceptZeroCopy<'info> {
    #[account(zero, init)] // <- 无法这样做
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

相反，您的客户端必须创建大账户并为其支付租金，以进行单独的指令。

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

第二个注意事项是，您必须在rust指令函数内部调用以下方法之一来加载账户：

- 第一次初始化账户时调用`load_init`（这将忽略仅在用户指令代码之后添加的缺少账户细分）
- 当账户不可变时调用`load`
- 当账户可变时调用`load_mut`

例如，如果要初始化并操作上面的`SomeReallyBigDataStruct`，您可以在函数中调用以下内容


```rust
let some_really_big_data = &mut ctx.accounts.some_really_big_data.load_init()?;
```

在你完成这个之后，你可以像处理普通账户一样对待这个账户！放心在代码中添加一些实验来查看所有的操作！

为了更好地理解这一切是如何运作的，Solana制作了一部非常好的 [视频](https://www.youtube.com/watch?v=zs_yU0IuJxc&feature=youtu.be) 和 [代码](https://github.com/solana-developers/anchor-zero-copy-example) 来解释在原生Solana中的Box和Zero-Copy。

## 处理账户

现在你已经了解了Solana上的空间考虑的要点，让我们看看一些更高级别的考虑。在Solana中，一切都是一个账户，所以在接下来的几个部分中，我们将看一些账户结构概念。

### 数据顺序

第一个考虑是相当简单的。一般而言，保持所有可变长度字段位于账户的末尾。看下面:

```rust
#[account] // Anchor隐去了账户区分符
pub struct BadState {
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
    pub id: u32         // 0xDEAD_BEEF
}
```

`flags`字段是可变长度的。这会使得通过`id`字段查找特定账户变得非常困难，因为对`flags`中的数据的更新会改变`id`在内存映射中的位置。

为了更清楚地说明这一点，看一下当`flags`中的矢量项数为4和8时，这个账户在链上的数据是怎样的。如果你调用`solana account ACCOUNT_KEY`，你会得到以下类似的数据转储：

```rust
0000:   74 e4 28 4e    d9 ec 31 0a  -> 账户区分符 (8)
0008:	04 00 00 00    11 22 33 44  -> 矢量项数 (4) | 数据 4*(1)
0010:   DE AD BE EF                 -> id (4)

--- 与 ---

0000:   74 e4 28 4e    d9 ec 31 0a  -> 账户区分符 (8)
0008:	08 00 00 00    11 22 33 44  -> 矢量项数 (8) | 数据 4*(1)
0010:   55 66 77 88    DE AD BE EF  -> 数据 4*(1) | id (4)
```

在这两种情况下，前八个字节是Anchor账户区分符。在第一种情况下，下一个四个字节表示`flags`矢量的大小，接下来四个字节是数据，最后是`id`字段的数据。

在第二种情况下，`id`字段从地址0x0010移动到0x0014，因为`flags`字段中的数据占用了四个额外的字节。

这样做的主要问题是查找。当你查询Solana时，你会使用过滤器来查看账户的原始数据。这些被称为`memcmp`过滤器，或内存比较过滤器。你给过滤器一个`偏移量`和`字节`，过滤器直接查看内存，通过你提供的`偏移量`从开始位置开始偏移，并比较内存中的字节和你提供的`字节`。

例如，你知道`flags`结构总是从地址0x0008开始，因为前8个字节包含了账户区分符。查询所有`flags`长度为4的账户是可能的，因为我们*知道*0x0008处的四个字节代表`flags`中数据的长度。因为账户区分符是

```typescript
const states = await program.account.badState.all([
  {memcmp: {
    offset: 8,
    bytes: bs58.encode([0x04])
  }}
]);
```

然而，如果你想按照`id`来查询，你就不知道为`偏移量`放什么，因为`id`的位置取决于`flags`的长度。这看起来不太有用。ID通常是为了帮助查询的！简单的方法就是改变顺序。

```rust
#[account] // Anchor隐藏了账户区分符
pub struct GoodState {
	pub id: u32         // 0xDEAD_BEEF
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
}
```

将可变长度字段放在结构体的末尾，你可以根据直到第一个可变长度字段之前的所有字段来查询账户。再次强调：一般而言，保持所有可变长度结构体位于账户的末尾。

### 为将来预留

在某些情况下，考虑向你的账户添加额外的、未使用的字节。这是为了灵活性和向后兼容性而保留的。看下面的例子：

```rust
#[account]
pub struct GameState {
    pub health: u64,
    pub mana: u64,
    pub event_log: Vec<string>
}
```

在这个简单的游戏状态中，一个角色有`health`、`mana`和事件日志。如果某一时刻你在进行游戏改进，并且想要添加一个`experience`字段，你会遇到麻烦。`experience`字段应该是一个数字，比如一个`u64`，添加起来也很简单。你可以[重新分配账户](./anchor-pdas.md#realloc) 并添加空间。

然而，要保留像`event_log`这样的动态长度字段放在结构体的末尾，你需要对所有重新分配的账户进行一些内存操作来移动`event_log`的位置。这可能很复杂，并使得查询账户变得更加困难。你最终会处于这样一种状态：未迁移的账户中`event_log`位于一个位置，而迁移的账户中`event_log`位于另一个位置。旧的`GameState`没有`experience`，而新的`GameState`有`experience`，它们不再兼容。在期望使用新账户的地方使用旧账户时，旧账户将无法序列化。查询会更加困难。最终，你可能需要创建一个迁移系统和持续的逻辑来保持向后兼容性。最终，这开始看起来像是一个坏主意。

幸运的是，如果你提前考虑，你可以添加一个`for_future_use`字段来预留一些你认为可能需要的字节。

```rust
#[account]
pub struct GameState { //V1
    pub health: u64,
    pub mana: u64,
	pub for_future_use: [u8; 128],
    pub event_log: Vec<string>
}
```

这样，当你要添加`experience`或类似的东西时，看起来是这样的，旧的和新的账户都是兼容的。


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

这些额外字节确实增加了您程序的使用成本。但在大多数情况下，这似乎是非常值得的好处。

因此，一个通用的经验法则是：每当您认为您的账户类型可能会以某种需要进行复杂迁移的方式发生变化时，都应添加一些 `for_future_use` 字节。

### 数据优化

这里的想法是要注意浪费的位。例如，如果您有一个表示一年中月份的字段，不要使用 `u64`。一年只有12个月。可以使用 `u8`。更好的是，使用 `u8` 枚举并标记这些月份。

为了更加激进地节省比特，对布尔值要格外小心。看下面由八个布尔标志组成的结构。虽然一个布尔值本来可以表示为单个比特，但 borsh 反序列化将为这些字段分配整个字节。这意味着八个布尔值的大小变成了八个字节，而不是八个比特，大小增加了八倍。

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

要优化这个问题，您可以将所有标志合并到一个 `u8` 字段中。然后，您可以使用位操作来查看每个位，以确定它是否是"打开"还是 "关闭"。

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

这样就节省了7个字节的数据！当然，这种方式的缺点是现在您必须进行位操作。不过这是有价值的小技巧。

### 索引

最后一个账户概念非常有趣，它展示了 PDA 的强大作用。在创建程序账户时，您可以指定用于派生 PDA 的种子。这是非常强大的，因为它允许您派生您的账户地址，而不是存储它们。

最好的例子就是关联代币账户 (ATA)！

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

这就是您的大多数 SPL 代币是如何存储的。而不是保存一个 SPL 代币账户地址的数据库表，您只需要知道您的钱包地址和代币地址。ATA 地址可以通过将它们哈希在一起计算得出，然后完成！您就拥有了您的代币账户地址。

根据种子，您可以创建各种关系：

- `One-Per-Program` (全局账户) - 如果您创建一个确定 `seeds=[b"ONE PER PROGRAM"]` 的账户，在该程序中只能存在一个。例如，如果您的程序需要一个查找表，您可以使用 `seeds=[b"Lookup"]` 来定义。只是要小心提供适当的访问限制。

- `One-Per-Owner` - 比如，您创建视频游戏玩家账户，您希望每个钱包只能有一个玩家账户。那么您就可以使用 `seeds=[b"PLAYER", owner.key().as_ref()]` 来定义账户。这样，您总是知道在何处查找钱包的玩家账户 **而且** 只能有一个。

- `Multiple-Per-Owner` - 好了，但是如果您希望钱包有多个账户呢？假设您希望铸造播客剧集。那么，您可以这样定义您的 `Podcast` 账户：`seeds=[b"Podcast", owner.key().as_ref(), episode_number.to_be_bytes().as_ref()]`。现在，如果您想要查找特定钱包的第50集剧集，您就可以找到了！而且每个所有者可以拥有您想要的任意多的剧集。

- `One-Per-Owner-Per-Account` - 这实际上就是我们上面看到的ATA示例。我们每个钱包和代币账户有一个代币账户。`seeds=[b"Mock ATA", owner.key().as_ref(), mint.key().as_ref()]`

接下来，您可以以各种巧妙的方式混合和匹配种子！但上面的列表应该足以让您开始了。

真正在关注这个设计方面的一个重要好处是解决了'索引'问题。没有PDA和种子，所有用户都要追踪他们曾经使用的所有账户的所有地址。这对于用户来说是不可行的，因此他们必须依赖于一个中心化的实体在数据库中存储他们的地址。在许多方面，这违背了全局分布式网络的初衷。PDA 是一个更好的解决方案。

为了使这一切更加具体，这里有一个来自生产播客节目的方案示例。程序需要如下账户：

- **频道账户**
    - 名称
    - 创建的剧集数 (u64)
- **播客账户(s)**
    - 名称
    - 音频 URL

为了正确索引每个账户地址，这些账户使用下列种子：

```rust
// 频道账户
seeds=[b"Channel", owner.key().as_ref()]

// 播客账户
seeds=[b"Podcast", channel_account.key().as_ref(), episode_number.to_be_bytes().as_ref()]
```

您总是能够找到特定所有者的频道账户。而且由于频道存储了创建的剧集数，您总是知道查询的上限位置。此外，您总是知道在何处创建一个新的剧集索引：`index = episodes_created`。


```rust
播客 0：seeds=[b"Podcast", channel_account.key().as_ref(), 0.to_be_bytes().as_ref()]
播客 1：seeds=[b"Podcast", channel_account.key().as_ref(), 1.to_be_bytes().as_ref()]
播客 2：seeds=[b"Podcast", channel_account.key().as_ref(), 2.to_be_bytes().as_ref()]
...
播客X：seeds=[b"Podcast", channel_account.key().as_ref(), X.to_be_bytes().as_ref()]
```

## 处理并发性

选择Solana作为区块链环境的主要原因之一是它的并行交易执行。也就是说，只要这些交易不试图向相同的账户写入数据，Solana就可以并行运行交易。这改进了程序的吞吐量，但通过一些适当的规划，您可以避免并发问题，真正提高程序的性能。

### 共享账户

如果您在加密货币领域有一段时间的经验，您可能经历过一个大型NFT铸造活动。一个新的NFT项目即将发布，每个人都非常期待，然后糖果机开始运转。每个人都疯狂地点击“接受交易”，以尽快完成。如果您足够聪明，可能会编写一个机器人来比网站UI更快地输入交易。这种疯狂的铸造导致了很多失败的交易。但为什么呢？因为每个人都试图向同一个糖果机账户写入数据。

让我们看一个简单的例子：

Alice和Bob分别尝试支付他们的朋友Carol和Dean。四个账户都发生变化，但彼此之间没有依赖关系。两个交易可以同时运行。

```rust
Alice -- 支付 --> Carol

Bob ---- 支付 --> Dean
```

但是，如果Alice和Bob都试图同时支付Carol，它们将遇到问题。

```rust
Alice -- 支付 --> |
						--> Carol
Bob    -- 支付 --> |
```

由于这两个交易都会向Carol的代币账户写入数据，只有一个交易能够同时进行。幸运的是，Solana运行速度极快，因此它们可能看起来似乎同时收到付款。但如果不仅Alice和Bob，而是更多人尝试向Carol支付呢？

```rust
Alice -- 支付 --> |
						--> Carol
x1000 -- 支付 --> |
Bob   -- 支付 --> |
```

如果1000人同时尝试向Carol支付，每个指令都将排队按顺序运行。对于其中的一些人，支付似乎立即完成。它们是幸运的一些人，其指令被早早地包含在内。但有些人将等待相当长的时间。对于一些人来说，他们的交易将失败。

虽然1000人同时向Carol支付似乎不太可能发生，但实际上，在一些事件中（如NFT铸造），许多人同时尝试向同一个账户写入数据是非常常见的。

想象一下，您创建了一个超受欢迎的程序，并且希望从您处理的每笔交易中获取费用。出于会计原因，您希望所有这些费用都流向一个钱包。在用户激增的情况下，您的协议会变得缓慢或不可靠。这并不好。那么解决方案是什么？将数据交易与费用交易分离。

例如，假设您有一个名为`DonationTally`的数据账户，它的唯一功能是记录您向特定的硬编码社区钱包捐赠了多少。

```rust
#[account]
pub struct DonationTally {
    is_initialized: bool,
    lamports_donated: u64,
    lamports_to_redeem: u64,
    owner: Pubkey,
}
```

首先，让我们看一下次优化解决方案。

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

您可以看到，向硬编码的`community_wallet`转账是在更新统计信息的同一个函数中进行的。这是最直接的解决方案，但如果运行此部分的测试，您将看到性能下降。

现在看一下优化后的解决方案：

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

    // 在donation_tally账户中减少余额
    **ctx.accounts.donation_tally.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;

    // 在community_wallet账户中增加余额
    **ctx.accounts.community_wallet.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    // 重置lamports_donated和lamports_to_redeem
    ctx.accounts.donation_tally.lamports_to_redeem = 0;

    Ok(())
}
```


在`run_concept_shared_account`函数中，我们将转账目标从瓶颈改为`donation_tally` PDA。这样，我们只会影响捐助者的账户和他们的PDA - 因此不会有瓶颈！此外，我们会保持一个内部总数，记录需要赎回的lamports数量，即以后需要从PDA转账到社区钱包的数量。在未来的某个时候，社区钱包将会清理所有落单的lamports（可能是[clockwork](https://www.clockwork.xyz/)的一个好任务）。需要注意的是，任何人都应该能够为赎回函数签名，因为PDA对自身具有权限。

如果您想要尽一切办法避免瓶颈，这是一种处理方法。最终这是一个设计决定，较简单、较不优化的解决方案对一些程序可能是可以接受的。但如果您的程序将会有高流量，优化是值得尝试的。您始终可以运行模拟来观察最坏、最好和中位的情况。

## 看它的实际应用

本课程中的所有代码片段都是我们创建的一个[Solana程序](https://github.com/Unboxed-Software/advanced-program-architecture.git)，用来阐释这些概念。每个概念都有一个相应的程序和测试文件。例如，**Sizes**概念可以在以下位置找到： 

**程序-** `programs/architecture/src/concepts/sizes.rs`

**测试-** `cd tests/sizes.ts`

现在您已经详细了解了这些概念，可以随意跳进代码进行一些实验。您可以更改现有值，尝试破坏程序，并且尝试理解一切是如何工作的。

您可以从Github上fork和/或克隆[这个程序](https://github.com/Unboxed-Software/advanced-program-architecture.git)来开始。在构建和运行测试套件之前，请记住使用本地程序ID更新`lib.rs`和`Anchor.toml`。

您可以运行整个测试套件，或者在特定测试文件的`describe`调用中添加`.only`，以只运行该文件的测试。随时定制和适应它，让它成为您自己的。

## 结论

我们已经谈到了许多程序体系结构的考虑因素：字节、账户、瓶颈等等。无论您最终是否遇到这些具体的考虑因素，希望这些例子和讨论引发了一些思考。归根结底，您是系统的设计者。您的工作是权衡各种解决方案的利弊。要有远见，但要实际。设计任何东西并没有“唯一正确的方法”。只需了解权衡。

# 实验

让我们使用所有这些概念来创建在Solana中一个简单但优化的RPG游戏引擎。这个程序将具有以下特点：
- 允许用户创建游戏(`Game`账户)并成为“游戏大师”（对游戏具有权限）
- 游戏大师负责他们游戏的配置
- 公众中的任何人都可以作为玩家加入游戏 - 每个玩家/游戏组合都会有一个`Player`账户
- 玩家可以花费行动点(我们将使用lamports作为行动点)生成和打击怪物(`Monster`账户)
- 消耗的行动点将作为列表在`Game`账户中保存

随着我们的进展，我们将为各种设计决策的权衡提供演练，以便让您了解我们做事情的理由。让我们开始吧！

### 1. 程序设置

我们将从头开始构建。首先创建一个新的Anchor项目：

```bash
anchor init rpg
```

注：本实验是针对Anchor版本`0.28.0`创建的。如果编译时出现问题，请参考[解决方案代码](https://github.com/Unboxed-Software/anchor-rpg/tree/challenge-solution)来设置环境。

接下来，将`programs/rpg/lib.rs`和`Anchor.toml`中的程序ID替换为运行`anchor keys list`时显示的程序ID。

最后，在`lib.rs`文件中构建程序的架构。要使跟随更加轻松，我们将在之前开始时将所有内容都保留在一个文件中。我们将通过部分注释来增强此部分以便更好地组织和导航。在我们开始之前，请将以下内容复制到您的文件中：

```rust
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};
use anchor_lang::solana_program::log::sol_log_compute_units;

declare_id!("YOUR_KEY_HERE__YOUR_KEY_HERE");

// ----------- 账户 ----------

// ----------- 游戏配置 ----------

// ----------- 状态 ----------

// ----------- 库存 ----------

// ----------- 助手 ----------

// ----------- 创建游戏 ----------

// ----------- 创建玩家 ----------

// ----------- 生成怪物 ----------

// ----------- 攻击怪物 ----------

// ----------- 赎回到金库 ----------

#[program]
pub mod rpg {
    use super::*;

}
```
### 2. 创建账户结构

现在我们的初始设置已准备就绪，让我们创建我们的账户。我们将有3个：

1. `游戏` - 此账户代表并管理一场游戏。它包括供游戏参与者支付的资金池，以及游戏主持人可以使用的配置结构。它应包括以下字段：
    - `game_master` - 实际上是所有者/管理者
    - `treasury` - 玩家将发送行动点数的资金池（我们将只使用lamport作为行动点数）
    - `action_points_collected` - 资金池收集的行动点数的数量
    - `game_config` - 用于自定义游戏的配置结构
2. `玩家` - 一个PDA账户，其地址是使用游戏账户地址和玩家的钱包地址作为种子派生而来的。它具有许多字段，用于跟踪玩家的游戏状态：
    - `player` - 玩家的公钥
    - `game` - 相应游戏账户的地址
    - `action_points_spent` - 消耗的行动点数
    - `action_points_to_be_collected` - 尚需收集的行动点数
    - `status_flag` - 玩家的状态           
    - `experience` - 玩家的经验
    - `kills` - 击败怪物的数量
    - `next_monster_index` - 下一个面对的怪物的索引
    - `for_future_use` - 为未来使用保留的256字节
    - `inventory` - 玩家库存的向量
3. `怪物` - 一个PDA账户，其地址是使用游戏账户地址、玩家的钱包地址和一个索引（存储在`玩家`账户的`next_monster_index`中）派生而来的。
    - `player` - 怪物面对的玩家
    - `game` - 与怪物相关联的游戏
    - `hitpoints` - 怪物剩余的生命点数

当添加到程序中时，账户应该如下所示：

```rust
// ----------- 账户 ----------
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

    pub for_future_use: [u8; 256],      // Attack/Speed/Defense/Health/Mana?? Metadata??

    pub inventory: Vec<InventoryItem>,  // Max 8 items
}

#[account]
pub struct Monster { // 8 bytes
    pub player: Pubkey,                 // 32 bytes
    pub game: Pubkey,                   // 32 bytes

    pub hitpoints: u64,                 // 8 bytes
}
```

在这里并没有太多复杂的设计决策，但让我们讨论一下`Player`结构中的`inventory`和`for_future_use`字段。由于`inventory`长度可变，我们决定将其放置在帐户的末尾，以便查询更容易。我们还决定为`for_future_use`字段的预留空间多花一些租金豁免的钱。如果以后需要添加字段，我们可以排除这个字段，并简单地重新分配帐户，但现在添加它对我们将来会简化事情。

如果我们选择在将来重新分配，我们需要编写更复杂的查询，并且可能无法基于`inventory`的单个调用进行查询。重新分配并添加字段将移动`inventory`的内存位置，这样留下我们编写复杂逻辑来查询具有不同结构的帐户。

### 3. 创建辅助类型

接下来，我们需要添加一些帐户引用但尚未创建的类型。

让我们从游戏配置结构开始。从技术上讲，这可以放在`Game`帐户中，但将其分开和封装是比较好的。这个结构应该存储每个玩家允许的最大物品和一些用于将来使用的字节。同样，在这里将来使用的字节帮助我们避免将来的复杂性。当在帐户末尾添加字段时，重新分配帐户的效果最佳，而不是在现有日期的中间添加字段。如果您预期在现有日期中间添加字段，最好一开始就添加一些“将来使用”字节。

```rust
// ----------- 游戏配置 ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct GameConfig {
    pub max_items_per_player: u8,
    pub for_future_use: [u64; 16], // Health of Enemies?? Experience per item?? Action Points per Action??
}
```

接下来，让我们创建我们的状态标志。请记住，我们*可以*将我们的标志存储为布尔值，但通过将多个标志存储为单个字节，我们节省了空间。每个标志在字节内占用不同的位。我们可以使用`<<`运算符将 `1` 放在正确的位上。

```rust
// ----------- 状态 ----------

const FROZEN_FLAG: u8 = 1 << 0;
const POISONED_FLAG: u8 = 1 << 1;
const BURNING_FLAG: u8 = 1 << 2;
const BLESSED_FLAG: u8 = 1 << 3;
const CURSED_FLAG: u8 = 1 << 4;
const STUNNED_FLAG: u8 = 1 << 5;
const SLOWED_FLAG: u8 = 1 << 6;
const BLEEDING_FLAG: u8 = 1 << 7;
const NO_EFFECT_FLAG: u8 = 0b00000000;
```

最后，让我们创建我们的`InventoryItem`。这应该具有用于物品名称、数量和将来使用的多个字节保留的字段。

```rust
// ----------- INVENTORY ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InventoryItem {
    pub name: [u8; 32], // Fixed Name up to 32 bytes
    pub amount: u64,
    pub for_future_use: [u8; 128], // Metadata?? // Effects // Flags?
}
```

### 4. 为花费行动点创建辅助函数

在编写程序说明之前，我们要做的最后一件事是创建一个花费行动点的辅助函数。玩家将发送行动点（lamports）到游戏财政部作为游戏中执行操作的支付。

由于向财政部发送lamports需要向该财政部帐户编写数据，如果许多玩家尝试同时写入同一财政部，我们可能很容易遇到性能瓶颈（请参见[处理并发性](#处理并发性)）。

相反，我们将把它们发送到玩家PDA帐户，并创建一个指令，该指令将一并从该帐户中的lamports发送到财政部。这消除了并发问题，因为每个玩家都有自己的帐户，但也允许程序随时检索这些lamports。

```rust
// ----------- HELPER ----------

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

    msg!("Minus {} action points", action_points);

    Ok(())
}
```

### 5. 创建游戏

我们的第一个指令将创建`game`帐户。任何人都可以成为`game_master`并创建自己的游戏，但一旦游戏创建完成就会有一定的约束。

首先，`game`帐户是使用其`treasury`钱包的PDA。这确保了相同的`game_master`如果为每个游戏使用不同的财政部，则可以运行多个游戏。 

注意 `treasury` 是指示的签署者。这是为了确保创建游戏的人拥有 `treasury` 的私钥。这是一种设计决策，而不是“正确的方法”。最终，这是一项安全措施，以确保游戏主能够检索他们的资金。

```rust
// ----------- 创建游戏 ----------

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

    /// 检查：需知道他们拥有的 treasury
    pub treasury: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn run_create_game(ctx: Context<CreateGame>, max_items_per_player: u8) -> Result<()> {

    ctx.accounts.game.game_master = ctx.accounts.game_master.key().clone();
    ctx.accounts.game.treasury = ctx.accounts.treasury.key().clone();

    ctx.accounts.game.action_points_collected = 0;
    ctx.accounts.game.game_config.max_items_per_player = max_items_per_player;

    msg!("游戏已创建！");

    Ok(())
}
```

### 6. 创建玩家

我们的第二条指示将创建 `player` 账户。有三个值得注意的关于此指示的权衡：

1. 玩家账户是使用 `game` 和 `player` 钱包派生的PDA账户。这使玩家能够参与多个游戏，但只在每个游戏中拥有一个玩家账户。
2. 我们将 `game` 账户封装在 `Box` 中，将其放置在堆中，以确保我们不会超出堆栈的最大限制。
3. 玩家所做的第一个动作是把自己生成进来，所以我们调用 `spend_action_points`。现在我们将 `action_points_to_spend` 硬编码为 100 lamports，但这可能在将来被添加到游戏配置中。

```rust
// ----------- 创建玩家 ----------
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

    msg!("英雄已加入游戏！");

    {   // 花费 100 lamports 创建玩家
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

### 7. 生成怪物

现在我们有了创建玩家的方法，我们需要一种方式来生成他们战斗的怪物。此指示将创建一个新的 `Monster` 账户，其地址是使用 `game` 账户、`player` 账户和代表玩家所面对的怪物数量的索引派生的PDA。这里有两个设计决策我们应该谈谈：
1. PDA seeds 让我们跟踪玩家生成的所有怪物。
2. 我们将 `game` 和 `player` 账户都封装在 `Box` 中，将它们分配给堆。

```rust
// ----------- 生成怪物 ----------
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

        msg!("怪物已生成！");
    }

    {
        ctx.accounts.player_account.next_monster_index = ctx.accounts.player_account.next_monster_index.checked_add(1).unwrap();
    }

    {   // 花费 5 lamports 生成怪物
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

### 8. 攻击怪物

现在！让我们攻击那些怪物，并开始获得一些经验值！

这里的逻辑如下：
- 玩家花费 1 个 `action_point` 进行攻击并获得 1 点 `experience`
- 如果玩家消灭怪物，他们的 `kill` 计数增加

至于设计决策，我们将每个 rpg 账户都封装在 `Box` 中，将它们分配到堆中。此外，在增加经验和击杀计数时，我们使用了 `saturating_add`。


`saturation_add`函数确保数字永远不会溢出。假设`kills`是一个u8类型的变量，而我的当前杀敌数为255（0xFF）。如果我再杀一个敌人然后按常规方法相加（例如`255 + 1 = 0 (0xFF + 0x01 = 0x00) = 0`），杀敌数最终会变成0。而使用`saturation_add`函数会在数字即将发生溢出时将其保持在最大值，因此`255 + 1 = 255`。`checked_add`函数会在即将发生溢出时抛出错误。在进行Rust语言的数学运算时要牢记这一点。即使`kills`是一个u64类型的变量，并且根据当前的编程方式它永远不会溢出，也要使用安全的数学运算并考虑到溢出的情况。

```rust
// ----------- 攻击怪物 ----------
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
        let hp_before_attack = ctx.accounts.monster.hitpoints;
        let hp_after_attack = ctx.accounts.monster.hitpoints.saturating_sub(1);
        let damage_dealt = hp_before_attack - hp_after_attack;
        ctx.accounts.monster.hitpoints = hp_after_attack;

        

        if hp_before_attack > 0 && hp_after_attack == 0 {
            did_kill = true;
        }

        if  damage_dealt > 0 {
            msg!("造成的伤害: {}", damage_dealt);
        } else {
            msg!("已经死了，停下吧！");
        }
    }

    {
        ctx.accounts.player_account.experience = ctx.accounts.player_account.experience.saturating_add(1);
        msg!("+1 经验");

        if did_kill {
            ctx.accounts.player_account.kills = ctx.accounts.player_account.kills.saturating_add(1);
            msg!("你杀死了怪物！");
        }
    }

    {   // 花费1个lamport点来攻击怪物
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

### 兑换为宝库

这是我们的最后一条指令。这条指令允许任何人将已经消耗的“action_points”发送到“treasury”钱包。

同样，让我们封装rpg账户并使用安全的数学运算。

```rust
// ----------- 兑换为宝库 ----------
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
    /// CHECK: 它已经在游戏账户中被检查了
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// 任何支付交易费用的人都可以运行此命令——将它给到一个钟摆机器人
pub fn run_collect_action_points(ctx: Context<CollectActionPoints>) -> Result<()> {
    let transfer_amount: u64 = ctx.accounts.player.action_points_to_be_collected;

    **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
    **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    ctx.accounts.player.action_points_to_be_collected = 0;

    ctx.accounts.game.action_points_collected = ctx.accounts.game.action_points_collected.checked_add(transfer_amount).unwrap();

    msg!("宝库收集了{}个action points", transfer_amount);

    Ok(())
}
```

### 整合所有内容

现在我们所有的指令逻辑都已经编写好，让我们把这些函数添加到程序中的实际指令中。还可以记录每条指令的计算单元。

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

如果你正确添加了所有部分，应该可以成功构建。

```shell
anchor build
```

### 测试

现在，让我们看看这个程序如何工作！

让我们设置`tests/rpg.ts`文件。我们将逐个填写每个测试。但首先，我们需要设置几个不同的账户，主要是`gameMaster`和`treasury`。

```tsx
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rpg, IDL } from "../target/types/rpg";
import { assert } from "chai";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("RPG", () => {
  // 配置客户端以使用本地群集。
  anchor.setProvider(anchor.AnchorProvider.env()); 
```



```tsx
const program = anchor.workspace.Rpg as Program<Rpg>;
const wallet = anchor.workspace.Rpg.provider.wallet
  .payer as anchor.web3.Keypair;
const gameMaster = wallet;
const player = wallet;

const treasury = anchor.web3.Keypair.generate();

it("创建游戏", async () => {});

it("创建玩家", async () => {});

it("生成怪物", async () => {});

it("攻击怪物", async () => {});

it("存入行动点", async () => {});

});
```
现在让我们添加`Create Game`测试。只需调用`createGame`带有八个项目，确保传入所有的账户，并确保`treasury`账户签署交易。

```tsx
it("创建游戏", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const txHash = await program.methods
      .createGame(
        8, // 每位玩家8个物品
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

    // 如果需要，输出
    // const account = await program.account.game.fetch(gameKey);

  });
```

继续检查您的测试是否顺利运行：

```tsx
yarn install
anchor 测试
```

**Hacky workaround:** 如果由于某种原因，“yarn install”命令导致一些“.pnp.*”文件而没有“node_modules”，您可能需要调用“rm -rf .pnp.*”后跟“npm i”，然后再次运行“yarn install”。这应该有效。

现在一切都在运行，让我们实现“Create Player”、“Spawn Monster”和“Attack Monster”测试。完成每个测试后运行每个测试以确保一切顺利运行。

```typescript
it("创建玩家", async () => {
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

    // 如果需要，输出
    // const account = await program.account.player.fetch(playerKey);

});

it("生成怪物", async () => {
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

    // 如果需要，输出
    // const account = await program.account.monster.fetch(monsterKey);

});

it("攻击怪物", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // 获取最新创建的怪物
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

    // 如果需要，输出
    // const account = await program.account.monster.fetch(monsterKey);

    const monsterAccount = await program.account.monster.fetch(monsterKey);
    assert(monsterAccount.hitpoints.eqn(99));
});
```

注意我们选择攻击的怪物是`playerAccount.nextMonsterIndex.subn(1).toBuffer('le', 8)`。这允许我们攻击最近生成的怪物。在`nextMonsterIndex`之下的任何东西都应该没问题。最后，由于种子只是字节数组，我们必须将索引转换为`u64`，它是8字节的小端`le`。

运行`anchor test`来造成一些伤害！

最后，让我们编写测试来收集存入的所有行动点。这个测试可能会因其所做的事情而感到复杂。这是因为我们生成一些新账户来显示任何人都可以调用`depositActionPoints`函数。我们使用像`clockwork`这样的名称，因为如果这个游戏是连续运行的，使用类似于[clockwork](https://www.clockwork.xyz/)的定期任务可能是有意义的。


```tsx
it("存款行动点数", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // 显示任何人都可以存款行动点数
    // 例如，将其交给一个机器人
    const clockworkWallet = anchor.web3.Keypair.generate();

    // 给它一个起始余额
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

    // 必须给账户一些lamports，否则交易将失败
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

    const expectedActionPoints = 100 + 5 + 1; // 玩家创建 ( 100 ) + 怪物生成 ( 5 ) + 怪物攻击 ( 1 )
    const treasuryBalance = await program.provider.connection.getBalance(treasury.publicKey);
    assert(
        treasuryBalance == 
        (amountToInitialize + expectedActionPoints) // 玩家创建 ( 100 ) + 怪物生成 ( 5 ) + 怪物攻击 ( 1 )
    );

    const gameAccount = await program.account.game.fetch(gameKey);
    assert(gameAccount.actionPointsCollected.eqn(expectedActionPoints));

    const playerAccount = await program.account.player.fetch(playerKey);
    assert(playerAccount.actionPointsSpent.eqn(expectedActionPoints));
    assert(playerAccount.actionPointsToBeCollected.eqn(0));

});
```

最后，运行 `anchor test` 以查看一切是否正常运行。

祝贺你！这是一个大工程，但现在你拥有了一个小型的RPG游戏引擎。如果有什么不对劲，可以回顾一下实验室，找到出错的地方。如果需要，可以参考[解决方案代码的`main`分支](https://github.com/Unboxed-Software/anchor-rpg)。

确保将这些概念应用到你自己的程序中。每一个小的优化都会积少成多！

# 挑战

现在该你独立练习了。回顾实验室代码，寻找你可以做的额外优化和/或扩展。思考你想要添加的新系统和功能，以及你将如何优化它们。

你可以在[RPG存储库](https://github.com/Unboxed-Software/anchor-rpg/tree/challenge-solution)的`challenge-solution`分支上找到一些示例修改。

最后，回顾自己的一个程序，想想你可以做哪些优化来改善内存管理、存储大小和/或并发性。

## 实验室完成了吗？

将你的代码推送到GitHub，并[告诉我们你对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=4a628916-91f5-46a9-8eb0-6ba453aa6ca6)！

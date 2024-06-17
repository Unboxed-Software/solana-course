---
title: 通用状态压缩
objectives: 
- 解释 Solana 状态压缩背后的逻辑流程
- 解释 Merkle 树和并发 Merkle 树之间的区别
- 在基本 Solana 程序中实现通用状态压缩
---
**译者**: [ben46](https://github.com/ben46)

# 摘要
- 在 Solana 上，状态压缩最常用于压缩 NFTs，但也可以用于任意数据
- 通过利用 Merkle 树，状态压缩降低了在链上存储数据的量
- Merkle 树存储代表整个哈希二叉树的单个哈希。Merkle 树上的每个叶子都是该叶子数据的哈希。
- 并发 Merkle 树是 Merkle 树的一种特殊版本，允许并发更新。
- 由于状态压缩程序中的数据不存储在链上，您必须使用索引器来维护数据的链下缓存，然后验证该数据与链上 Merkle 树的匹配。

# 课程

先前，我们在压缩 NFTs 的背景下讨论了状态压缩。在撰写本文时，状态压缩最常见的用例是压缩 NFTs，但在任何程序中都可以使用状态压缩。在本课程中，我们将更广泛地讨论状态压缩，以便您可以将其应用于您的任何程序。

## 状态压缩的理论概述

在传统程序中，数据被序列化（通常使用 borsh），然后直接存储在一个账户中。这样做可以使得数据很容易通过 Solana 程序进行读取和写入。存储在账户中的数据可以被“信任”，因为除了由程序提供的机制之外，它无法被修改。

状态压缩实际上断言了这个等式中最重要的部分是数据的“可信度”。如果我们关心的只是数据是否可以被信任，那么我们实际上**可以**不将数据存储在链上的账户中。相反，我们可以存储数据的哈希，其中这些哈希可以用来证明或验证数据。数据的哈希占用的存储空间明显比数据本身少得多。然后，我们可以将实际数据存储在更便宜的地方，并在访问数据时担心验证它与链上哈希的匹配。

Solana 状态压缩程序所使用的特定数据结构是一种特殊的二叉树结构，即 **并发 Merkle 树**。这个树结构以一种确定性的方式将数据片段进行哈希运算，得出一个单一的最终哈希，然后将其存储在链上。这个最终哈希的尺寸明显比所有原始数据的尺寸加起来小，因此称之为“压缩”。这个过程的步骤包括：

1. 取任意数据
2. 创建这个数据的哈希
3. 将这个哈希作为“叶子”存储在树的底部
4. 将每对叶子进行哈希运算，创建一个“分支”
5. 再将每个分支进行哈希运算
6. 不断向树顶部上溯，将相邻的分支进行哈希运算
7. 达到树顶部后，产生一个最终的“根哈希”
8. 将根哈希在链上存储，作为数据在每个叶子内的可验证的证明
9. 任何想要验证他们拥有的数据与“真相”是否相符的人都可以通过同样的过程，比较最终哈希，而无需将所有数据存储在链上

这涉及一些相当严肃的开发折衷：

1. 因为数据不再存储在链上的账户中，所以更难获取。
2. 一旦访问了数据，开发者必须决定他们的应用程序将多频繁地验证数据与链上哈希的匹配。
3. 对数据的任何改变都将需要将先前哈希过的所有数据*和*新数据发送到一个指令。开发者还可能需要提供对用于验证原始数据与哈希匹配的证明所必需的附加数据。

在确定**是否**，**何时**以及**如何**实现状态压缩时，每一点都将被考虑。

### 并发 Merkle 树

**Merkle 树** 是一种由单个哈希表示的二叉树结构。结构中的每个叶节点都是其内部数据的哈希，而每个分支都是其子叶节点哈希的哈希。分支也被哈希在一起，直到最终只剩下一个根哈希。

由于 Merkle 树被表示为单个哈希，对叶数据的任何修改都会改变根哈希。这会在同一时间槽内进行多个事务尝试修改叶数据时引发问题。因为这些事务必须按序执行，除了第一个事务之外，其他所有事务都将失败，因为叶子哈希和证明都将被第一个执行的事务所使无效。换句话说，标准 Merkle 树在一个时间槽内只能修改一个叶子。在依赖单个 Merkle 树的状态压缩程序中，这严重限制了吞吐量。

这个问题可以通过**并发 Merkle 树**来解决。并发 Merkle 树是一棵 Merkle 树，它存储了最近更改的安全更改日志及其根哈希和用于产生它的证明。当同一时间槽内的多个事务尝试修改叶数据时，可以使用更改日志作为真相来源，以允许对树进行并发更改。

换句话说，在存储 Merkle 树的账户只有根哈希时，而并发 Merkle 树还包含了允许随后的写入成功执行所需的附加数据。其中包括：

1. 根哈希 - 与标准 Merkle 树相同的根哈希
2. 更改日志缓冲区 - 这个缓冲区包含了与最近根哈希更改相关的证明数据，以便在同一时间槽内后续的写入可以成功进行
3. 树冠 - 在对任何给定叶子进行更新操作时，您需要从该叶子到根哈希的整个证明路径。树冠会存储沿着该路径的中间证明节点，因此不需要从客户端将它们全部传递给程序。

作为程序架构师，您直接控制与这三个项目直接相关的三个值。您的选择决定了树的大小，创建树的成本以及可以对树进行并发更改的次数：

1. 最大深度
2. 最大缓冲区大小
3. 树冠深度

**最大深度** 是从任意叶子到树根的最大跳数。因为 Merkle 树是二叉树，每个叶子只连接到另一个叶子。最大深度可以逻辑地用于计算树的节点数，即`2 ^ maxDepth`。


**最大缓冲区大小**事实上是指在单个插槽内对树进行的最大并发更改次数，同时使得根哈希仍然有效。当在同一插槽中提交多个交易时，每个交易都在竞争更新标准 Merkle 树上的叶子，只有第一个运行的交易才有效。这是因为该“写”操作将修改存储在账户中的哈希。同一插槽中的后续交易将尝试根据现在过时的哈希验证其数据。并发 Merkle 树具有缓冲区，以便缓冲区可以记录这些修改的运行日志。这允许状态压缩程序在同一插槽中验证多个数据写入，因为它可以查找缓冲区中的先前哈希，并与相应的哈希进行比较。

**树冠深度**是存储在链上的任何给定证明路径的证明节点数量。验证任何叶子需要树的完整证明路径。完整的证明路径由树的每个“层”上的一个证明节点组成，即最大深度为 14 意味着有 14 个证明节点。每个传递到程序的证明节点会向交易添加 32 字节，因此大型树将很快超过最大交易大小限制。在树冠中缓存证明节点有助于改进程序的可组合性。

这三个值，即最大深度、最大缓冲区大小和树冠深度，都伴随着一种权衡。增加任何这些值的大小都会增加用于存储树的账户的大小，从而增加创建树的成本。

选择最大深度相当直截了当，它直接与叶子的数量以及您可以存储的数据量相关。如果您需要在单棵树上存储 100 万个 cNFTs，其中每个 cNFT 为树的一个叶子，请找到使下列表达式成立的最大深度：`2^maxDepth > 100 万`。答案是 20。

选择最大缓冲区大小实际上是一个关于吞吐量的问题：您需要多少并发写入？缓冲区越大，吞吐量越高。

最后，树冠深度将确定您程序的可组合性。状态压缩先驱已经明确表示省略树冠是一个坏主意。如果调用您的状态压缩程序 B 会使交易大小达到上限，程序 A 将无法调用程序 B。请记住，除了必需的证明路径之外，程序 A 还有所需账户和数据，这些都会占用交易空间。

### 在状态压缩程序上访问数据

状态压缩账户并不存储数据本身。相反，它仅存储了上述并发 Merkle 树结构。原始数据本身仅存在于区块链更便宜的**帐本状态**中。这使得数据访问略微更加困难，但并非不可能。

Solana 帐本是一个包含已签名交易的条目列表。理论上，这可以追溯到起源块。这实际上意味着任何曾经被放入交易的数据都存在于账本中。

由于状态压缩哈希过程发生在链上，所有数据存在于账本状态中，理论上可以通过重新播放整个链状态从始至终来检索数据。然而，要想要现在索联系系统对于大多数开发人员来说是更简单的选择，虽然仍然很复杂。这方面需要一些实践后才能理解。

## 状态压缩工具

上述描述的理论对于正确理解状态压缩至关重要。但是，您并不需要从头开始实现其中的任何内容。杰出的工程师已经为您准备好了大部分构建框架，即 SPL 状态压缩程序和 Noop 程序的形式。

### SPL 状态压缩和 Noop 程序

SPL 状态压缩程序的存在旨在使在 Solana 生态系统中创建和更新并发 Merkle 树的过程可重复并且可组合。它提供了初始化 Merkle 树、管理树叶节点（即添加、更新、移除数据）和验证叶数据的说明。

状态压缩程序还利用一个独立的“no op”程序，其主要目的是通过将其记录到账本状态，使叶数据更容易索引。当您想要存储压缩数据时，您会将其传递给状态压缩程序，该程序会对其进行哈希处理并将其作为“事件”传递给 Noop 程序。哈希值将存储在相应的并发 Merkle 树中，但原始数据仍可通过 Noop 程序的交易日志访问。

### 为便捷查找索引数据

在正常情况下，您通常可以通过获取适当的账户来访问链上数据。然而，在使用状态压缩时，情况并非如此。如上所述，数据现在存在于账本状态中，而不是在一个账户中。找到完整数据的最简单地方就在 Noop 指令的日志中。不幸的是，虽然这些数据在某种意义上会永远存在于账本状态中，但它们可能会在一段时间之后失去通过验证程序的访问。

为了节省空间并提高性能，验证程序不会保留自创世区块以来的每个交易。您可以访问与您的数据相关的 Noop 指令日志的具体时间将根据验证程序的不同而不同。最终，如果您直接依赖指令日志，您将失去对其的访问。

从技术上讲，您*可以*重新播放交易状态至创世块，但是大多数团队不会这样做，而且这肯定不会高性能。许多 RPC 提供商已经采用[数字资产标准（DAS）](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api)，以便有效地查询压缩的 NFT 和其他资产。但在撰写本文时，它不支持任意的状态压缩。相反，您有两个主要选择：

1. 使用索引提供商为您的程序构建自定义索引解决方案，以观察发送到 Noop 程序的事件并将相关数据存储在链外。
2. 创建自己的伪索引解决方案，将交易数据存储在链外。

对于许多 dApps 来说，第 2 种选择是很有意义的。大规模应用可能需要依赖基础设施提供商来处理它们的索引。

## 状态压缩开发流程

### 创建 Rust 类型

与传统的 Anchor 程序一样，您应该首先定义程序的 Rust 类型。然而，在状态压缩程序中，您的账户状态将仅存储 Merkle 树。更“可用”的数据架构将被序列化并记录到 Noop 程序。

此类型应包含存储在叶节点中的所有数据以及使数据有意义所需的所有上下文信息。例如，如果您要创建一个简单的消息程序，您的 `Message` 结构可能如下所示：



```rust
#[derive(AnchorSerialize)]
pub struct MessageLog {
		leaf_node: [u8; 32], // 叶节点哈希
    from: Pubkey,        // 消息发送者的公钥
		to: Pubkey,          // 消息接收者的公钥
    message: String,     // 要发送的消息
}

impl MessageLog {
    // 从给定的叶节点和消息构建一个新的消息日志
    pub fn new(leaf_node: [u8; 32], from: Pubkey, to: Pubkey, message: String) -> Self {
        Self { leaf_node, from, to, message }
    }
}
```

要非常明确，**这不是一个可以从中读取的账户**。您的程序将根据指令输入创建此类型的实例，而不是根据它从帐户数据中读取的数据构造此类型的实例。我们将在后面的部分讨论如何读取数据。

### 初始化新树

客户端将通过两个独立的指令创建和初始化 Merkle 树账户。第一个只需调用系统程序来分配账户。第二个将是您在自定义程序上创建的初始化新账户的指令。这种初始化实际上只是记录 Merkle 树的最大深度和缓冲区大小。

此指令需要做的就是构建一个 CPI，以调用 State Compression Program 上的 `init_empty_merkle_tree` 指令。由于这需要最大深度和最大缓冲区大小，则需要将它们作为参数传递给该指令。

请记住，最大深度是指从任何叶子到树根的最大跳数。最大缓冲区大小是指保留用于存储树更新的更改日志的空间量。此更改日志用于确保您的树可以支持同一区块内的并发更新。

例如，如果我们正在为存储用户间的消息初始化树，该指令可能如下所示：

```rust
pub fn create_messages_tree(
    ctx: Context<MessageAccounts>,
    max_depth: u32, // Merkle 树的最大深度
    max_buffer_size: u32 // Merkle 树的最大缓冲区大小
) -> Result<()> {
    // 获取 Merkle 树账户的地址
    let merkle_tree = ctx.accounts.merkle_tree.key();
    // 为 PDA 签名定义种子
    let signer_seeds: &[&[&[u8]]] = &[
        &[
            merkle_tree.as_ref(), // Merkle 树账户的地址作为种子
            &[*ctx.bumps.get("tree_authority").unwrap()], // PDA 的随机数种子
        ],
    ];

    // 创建用于`init_empty_merkle_tree`指令的 cpi 上下文。
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(), // spl 账户压缩程序
        Initialize {
            authority: ctx.accounts.tree_authority.to_account_info(), // Merkle 树的授权，使用 PDA
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // 要初始化的 Merkle 树账户
            noop: ctx.accounts.log_wrapper.to_account_info(), // 用于记录数据的 noop 程序
        },
        signer_seeds // PDA 签名的种子
    );

    // 以给定的最大深度和缓冲区大小初始化空 Merkle 树的 CPI
    init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)?;

    Ok(())
}
```

### 将哈希添加到树中

使用初始化的 Merkle 树，可以开始添加数据哈希。这包括将未压缩数据传递给您的程序中的指令，该指令将对数据进行哈希处理，将其记录为 Noop 程序中的日志，并使用 State Compression Program 的 `append` 指令将哈希添加到树中。以下讨论了您的指令需要深度执行的操作：

1. 使用`keccak` 包中的 `hashv` 函数对数据进行哈希。在大多数情况下，您还会希望对数据的所有者或授权进行哈希处理，以确保它只能被适当的授权者修改。
2. 创建表示要记录到 Noop 程序的数据的日志对象，然后调用 `wrap_application_data_v1` 来向 Noop 程序发布带有该对象的 CPI。这确保了未压缩数据对于寻找它的任何客户端都是 Readily available。 对于广泛使用的用例（如 cNFTs），这将是索引器。您也可能创建自己的观察客户端，以模拟索引器执行的操作，但专用于您的应用程序。
3. 构建并发出 CPI 到 State Compression Program 的 `append` 指令。这需要在签名种子中使用 Merkle 树地址和树授权随机数。

当所有这些操作结合使用消息示例时，看起来如下：

```rust
// 用于向树添加消息的指令。
pub fn append_message(ctx: Context<MessageAccounts>, message: String) -> Result<()> {
    // 对消息进行哈希处理 + 应该具有更新权限的键
    let leaf_node = keccak::hashv(&[message.as_bytes(), ctx.accounts.sender.key().as_ref()]).to_bytes();
    // 使用叶节点哈希、发送者、接收者和消息创建一个新的“消息日志”
    let message_log = MessageLog::new(leaf_node.clone(), ctx.accounts.sender.key().clone(), ctx.accounts.receipient.key().clone(), message);
    // 使用 Noop 程序记录“消息日志”数据
    wrap_application_data_v1(message_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;
    // 获取 Merkle 树账户的地址
    let merkle_tree = ctx.accounts.merkle_tree.key();
    // 为 PDA 签名定义种子
    let signer_seeds: &[&[&[u8]]] = &[
        &[
            merkle_tree.as_ref(), // Merkle 树账户的地址作为种子
            &[*ctx.bumps.get("tree_authority").unwrap()], // PDA 的随机数种子
        ],
    ];
    // 创建新的 cpi 上下文，并将叶节点添加到 Merkle 树中。
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(), // spl 账户压缩程序
        Modify {
            authority: ctx.accounts.tree_authority.to_account_info(), // Merkle 树的授权，使用 PDA
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // 要修改的 Merkle 树账户
            noop: ctx.accounts.log_wrapper.to_account_info(), // 用于记录数据的 noop 程序
        },
        signer_seeds // PDA 签名的种子
    );
    // 添加叶节点到 Merkle 树的 CPI
    append(cpi_ctx, leaf_node)?;
    Ok(())
}
```

### 更新哈希


为了更新数据，您需要创建一个新的哈希来替换默克尔树上相关叶子的哈希。为此，您的程序需要访问四样东西：

1. 要更新的叶子的索引
2. 默克尔树的根哈希
3. 您希望修改的原始数据
4. 更新后的数据

有了这些数据，程序指令可以执行与用于追加初始数据到树的步骤非常类似的步骤：

1. **验证更新权限** - 第一步是新加入的步骤。在大多数情况下，您希望验证更新权限。这通常包括证明“update”事务的签名者是所给索引处叶子的真正所有者或授权者。由于数据被压缩为叶子上的哈希，我们不能简单地将“授权”公钥与存储的值进行比较。相反，我们需要使用旧数据和账户验证结构中列出的“授权”来计算先前的哈希值。然后我们构建和发出一个 CPI 到 State 压缩程序的 `verify_leaf` 指令，使用我们计算出的哈希。
2. **哈希化新数据** - 这一步与追加初始数据中的第一步相同。使用 `keccak` create 中的 `hashv` 函数来对新数据和更新权限进行哈希化，分别使用它们的相应字节表示。
3. **记录新数据** - 这一步与追加初始数据中的第二步相同。创建一个日志结构的实例，并调用 `wrap_application_data_v1` 来发出一个 CPI 到 Noop 程序。
4. **替换现有叶子哈希** - 这一步与追加初始数据中的最后一步稍有不同。构建并发出一个 CPI 到 State 压缩程序的 `replace_leaf` 指令。这使用旧哈希、新哈希和叶子索引来用新哈希替换给定索引处叶子的数据。与之前一样，这需要默克尔树地址和树授权增加作为签名种子。

合并为一个单一指令时，这个过程如下所示：

```rust
pub fn update_message(
    ctx: Context<MessageAccounts>,
    index: u32,
    root: [u8; 32],
    old_message: String,
    new_message: String
) -> Result<()> {
    let old_leaf = keccak
        ::hashv(&[old_message.as_bytes(), ctx.accounts.sender.key().as_ref()])
        .to_bytes();

    let merkle_tree = ctx.accounts.merkle_tree.key();

    // 定义 PDA 签名的种子
    let signer_seeds: &[&[&[u8]]] = &[
        &[
            merkle_tree.as_ref(), // 默克尔树账户地址作为种子
            &[*ctx.bumps.get("tree_authority").unwrap()], // pda 的增加种子
        ],
    ];

    // 验证叶子
    {
        if old_message == new_message {
            msg!("消息相同!");
            return Ok(());
        }

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // spl 账户压缩程序
            VerifyLeaf {
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // 要修改的默克尔树账户
            },
            signer_seeds // PDA 签名的种子
        );
        // 验证或失败
        verify_leaf(cpi_ctx, root, old_leaf, index)?;
    }

    let new_leaf = keccak
        ::hashv(&[new_message.as_bytes(), ctx.accounts.sender.key().as_ref()])
        .to_bytes();

    // 为索引器记录
    let message_log = MessageLog::new(new_leaf.clone(), ctx.accounts.sender.key().clone(), ctx.accounts.recipient.key().clone(), new_message);
    // 使用 noop 程序记录"message log"数据
    wrap_application_data_v1(message_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;

    // 替换叶子
    {
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // spl 账户压缩程序
            Modify {
                authority: ctx.accounts.tree_authority.to_account_info(), // 默克尔树的授权，使用 PDA
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // 要修改的默克尔树账户
                noop: ctx.accounts.log_wrapper.to_account_info(), // 用于记录数据的 noop 程序
            },
            signer_seeds // PDA 签名的种子
        );
        // CPI 来追加叶子节点到默克尔树
        replace_leaf(cpi_ctx, root, old_leaf, new_leaf, index)?;
    }

    Ok(())
}
```

### 删除哈希值

目前，State 压缩程序并没有提供明确的 `delete` 指令。相反，您将希望使用一种表明数据为“已删除”的方式来更新叶子数据。具体的数据将取决于您的使用情况和安全考虑。有些人可以选择将所有数据设置为 0，而其他人可能在“已删除”项目中存储一个静态字符串。

### 从客户端访问数据

到目前为止，讨论的是标准 CRUD 过程中的 3 个：创建、更新和删除。剩下的是在状态压缩中更加困难的概念之一：读取数据。

从客户端访问数据主要有难度，因为数据并未以易于访问的格式存储。存储在默克尔树账户中的数据哈希不能用于重建初始数据，而存储在 Noop 程序中的数据也不是无限可用的。

您最好的选择之一是：

1. 与索引提供者合作，为您的程序创建一个自定义的索引方案，然后根据索引提供的访问方式编写客户端代码。
2. 创建您自己的伪索引器作为一个轻量级的解决方案。

如果您的项目真正分散，以至于许多参与者将通过您自己的前端以外的方式与您的程序交互，那么选项 2 可能不够。但是，根据项目的规模或者您是否能够控制大多数的程序访问，它也是一种可行的方法。

并没有一种“正确”的方式来处理这个问题。两种潜在的方法是：

1. 将原始数据与数据哈希以及存储到的叶子一起存储到数据库中。
2. 创建一个服务器来观察您程序的交易，查找关联的 Noop 日志，解码日志，并将其存储。

在本课程实验中，我们将在编写测试时采取两种方法（尽管我们不会在数据库中保存数据 - 它只会在测试期间存储在内存中）。



这一设定有点繁琐。给定一个特定的交易，你可以从RPC提供者那里获取该交易，获取与Noop程序相关的内部指令，使用`@solana/spl-account-compression` JS包中的`deserializeApplicationDataEvent`函数获取日志，然后使用Borsh进行反序列化。下面是一个基于上述消息程序的示例。

```tsx
export async function getMessageLog(connection: Connection, txSignature: string) {
  // 确认交易，否则有时无法从getTransaction返回null
  const latestBlockHash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txSignature,
  })

  // 使用交易签名获取交易信息
  const txInfo = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  })

  // 获取与程序指令索引0相关的内部指令
  // 在测试交易中只发送一个指令，所以我们可以假定是第一个
  const innerIx = txInfo!.meta?.innerInstructions?.[0]?.instructions

  // 获取匹配SPL_NOOP_PROGRAM_ID的内部指令
  const noopInnerIx = innerIx.filter(
    (instruction) =>
      txInfo?.transaction.message.staticAccountKeys[
        instruction.programIdIndex
      ].toBase58() === SPL_NOOP_PROGRAM_ID.toBase58()
  )

  let messageLog: MessageLog
  for (let i = noopInnerIx.length - 1; i >= 0; i--) {
    try {
      // 尝试解码和反序列化指令数据
      const applicationDataEvent = deserializeApplicationDataEvent(
        Buffer.from(bs58.decode(noopInnerIx[i]?.data!))
      )

      // 获取应用数据
      const applicationData = applicationDataEvent.fields[0].applicationData

      // 将应用数据反序列化为MessageLog实例
      messageLog = deserialize(
        MessageLogBorshSchema,
        MessageLog,
        Buffer.from(applicationData)
      )

      if (messageLog !== undefined) {
        break
      }
    } catch (__) {}
  }

  return messageLog
}
```

## 结论

一般化状态压缩可能会有些困难，但绝对可以通过现有的工具来实现。此外，随着时间的推移，工具和程序都只会变得更好。如果你想要提高开发体验的解决方案，请与社区分享！

# 实验

通过创建一个新的Anchor程序来练习一般化状态压缩。该程序将使用自定义状态压缩来支持一个简单的笔记应用。

### 1. 项目设置

首先初始化一个Anchor程序：

```bash
anchor init compressed-notes
```

我们将使用带有`cpi`功能的`spl-account-compression` crate。让我们将其作为依赖项添加到`programs/compressed-notes/Cargo.toml`中。

```toml
[dependencies]
anchor-lang = "0.28.0"
spl-account-compression = { version="0.2.0", features = ["cpi"] }
solana-program = "1.16.0"
```

我们将在本地进行测试，但我们需要`Mainnet`上的Compression程序和Noop程序。因此，我们需要将它们添加到根目录下的`Anchor.toml`中，以便它们被克隆到本地群集。

```toml
[test.validator]
url = "https://api.mainnet-beta.solana.com"

[[test.validator.clone]]
address = "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"

[[test.validator.clone]]
address = "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
```

最后，让我们为接下来的Demo准备`lib.rs`文件。删除`initialize`指令和`Initialize`账户结构，然后添加下面代码段中显示的`import`（确保填入***你的***程序ID）。

```rust
use anchor_lang::{
    prelude::*, 
    solana_program::keccak
};
use spl_account_compression::{
    Noop,
    program::SplAccountCompression,
    cpi::{
        accounts::{Initialize, Modify, VerifyLeaf},
        init_empty_merkle_tree, verify_leaf, replace_leaf, append, 
    },
    wrap_application_data_v1, 
};

declare_id!("YOUR_KEY_GOES_HERE");

// 结构体代码写在此处

#[program]
pub mod compressed_notes {
    use super::*;

	// 函数代码写在此处
	
}
```

接下来的Demo中，我们将直接在`lib.rs`文件中直接对程序代码进行更新。这样可以简化解释。你可以随意在此基础上进行修改。

继续前请随时构建项目。这可以确保您的环境正常运作并缩短未来的构建时间。

### 2. 定义`Note`模式

接下来，我们将定义程序中笔记的外观。笔记应具有以下属性：

- `leaf_node` - 这应该是一个表示存储在叶节点上的哈希的32字节数组
- `owner` - 笔记所有者的公钥
- `note` - 笔记的字符串表示形式

```rust
#[derive(AnchorSerialize)]
pub struct NoteLog {
    leaf_node: [u8; 32],  // 叶节点哈希
    owner: Pubkey,        // 笔记所有者的公钥
    note: String,         // 笔记消息
}

impl NoteLog {
    // 从给定的叶节点和消息构造一个新笔记
    pub fn new(leaf_node: [u8; 32], owner: Pubkey, note: String) -> Self {
        Self { leaf_node, owner, note }
    }
}
```



在传统的Anchor程序中，这将是一个账户结构，但由于我们在使用状态压缩，我们的账户不会反映我们的本地结构。由于我们不需要账户的所有功能，我们可以使用`AnchorSerialize`派生宏而不是`account`宏。

### 3. 定义输入账户和约束

幸运的是，我们的每一个指令都将使用相同的账户。我们将为我们的账户验证创建一个`NoteAccounts`结构。它将需要以下账户：

- `owner` - 这是笔记的创建者和所有者；应是交易的签名者
- `tree_authority` - Merkle树的授权机构；用于签署与压缩相关的CPI
- `merkle_tree` - 用于存储笔记哈希的Merkle树的地址；由于它由状态压缩程序验证，因此将不受检查
- `log_wrapper` - Noop程序的地址
- `compression_program` - 状态压缩程序的地址

```rust
#[derive(Accounts)]
pub struct NoteAccounts<'info> {
    // 交易的付款人
    #[account(mut)]
    pub owner: Signer<'info>,

    // Merkle树的PDA授权，仅用于签署
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: SystemAccount<'info>,

    // Merkle树账户
    /// 检查：此账户由spl账户压缩程序验证
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    // 用于记录数据的Noop程序
    pub log_wrapper: Program<'info, Noop>,

    // spl账户压缩程序
    pub compression_program: Program<'info, SplAccountCompression>,
}
```

### 4. 创建`create_note_tree`指令

接下来，让我们创建我们的`create_note_tree`指令。请记住，客户端已经分配了Merkle树账户，但将使用此指令来对其进行初始化。

这个指令所需的只是构建一个CPI来调用State Compression程序中的`init_empty_merkle_tree`指令。为此，它需要`NoteAccounts`账户验证结构中列出的账户。它还需要两个额外的参数：

1. `max_depth` - Merkle树的最大深度
2. `max_buffer_size` - Merkle树的最大缓冲区大小

这些值在初始化Merkle树账户上的数据时是必需的。请记住，最大深度是指从任何叶子到树根的最大跳数。最大缓冲区大小是指用于存储树更新的变更日志的空间量。此变更日志用于确保您的树可以支持同一区块内的并发更新。

```rust
#[program]
pub mod compressed_notes {
    use super::*;

    // 用于创建新笔记树的指令。
    pub fn create_note_tree(
        ctx: Context<NoteAccounts>,
        max_depth: u32,       // Merkle树的最大深度
        max_buffer_size: u32, // Merkle树的最大缓冲区大小
    ) -> Result<()> {
        // 获取Merkle树账户的地址
        let merkle_tree = ctx.accounts.merkle_tree.key();

        // 定义PDA签名的种子
        let signer_seeds: &[&[&[u8]]] = &[&[
            merkle_tree.as_ref(), // Merkle树账户的地址作为种子
            &[*ctx.bumps.get("tree_authority").unwrap()], // PDA的bump种子
        ]];

        // 创建init_empty_merkle_tree指令的CPI上下文
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // spl账户压缩程序
            Initialize {
                authority: ctx.accounts.tree_authority.to_account_info(), // Merkle树的授权，使用PDA
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // 要初始化的Merkle树账户
                noop: ctx.accounts.log_wrapper.to_account_info(), // 用于记录数据的noop程序
            },
            signer_seeds, // 用于PDA签名的种子
        );

        // CPI来初始化一个给定最大深度和缓冲区大小的空Merkle树
        init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)?;
        Ok(())
    }

    // ...
}
```

确保CPI上的签名种子包括Merkle树地址和树授权bump。

### 5. 创建`append_note`指令

现在，让我们创建我们的`append_note`指令。此指令需要将原始笔记作为字符串并将其压缩成我们将存储在Merkle树上的哈希。我们还将笔记记录到Noop程序，以便整个数据在链的状态中存在。

以下是这里的步骤：

1. 使用`keccak`库中的`hashv`函数对笔记和所有者进行哈希处理，它们分别作为它们的相应字节表示。这里非常重要的是对所有者进行哈希处理以及对笔记进行哈希处理。这是在更新指令中验证笔记所有权的方法。
2. 使用步骤1中的哈希、所有者的公钥以及笔记的原始字符串创建`NoteLog`结构的实例。然后调用`wrap_application_data_v1`发出CPI到Noop程序，通过`NoteLog`的实例。这确保了笔记的全部内容（而不仅是哈希）对于寻找它的任何客户端都是即时可用的。对于像cNFTs这样的广泛使用情况，那将是索引器。您可能会创建您自己的观测客户端，以模拟索引器为您自己的应用程序所做的工作。
3. 构建并发出CPI到状态压缩程序的`append`指令。它接受第1步中计算所得的哈希，并将其添加到您的Merkle树上的下一个可用叶子节点上。就像之前一样，这需要Merkle树地址和树授权bump作为签名种子。

```rust
#[program]
pub mod compressed_notes {
    use super::*;

    //...

## 翻译 private_upload/default_user/2024-06-02-00-54-02/content copy.zip.extract/content copy/generalized-state-compression.md.part-6.md

```rust
// 指令用于向树添加备注。
pub fn append_note(ctx: Context<NoteAccounts>, note: String) -> Result<()> {
    // 对将作为叶子节点存储的“备注消息”进行哈希处理
    let leaf_node = keccak::hashv(&[note.as_bytes(), ctx.accounts.owner.key().as_ref()]).to_bytes();
    // 使用叶节点哈希和备注创建一个新的“备注日志”。
    let note_log = NoteLog::new(leaf_node.clone(), ctx.accounts.owner.key().clone(), note);
    // 使用空操作程序记录“备注日志”数据
    wrap_application_data_v1(note_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;
    // 获取默克尔树账户的地址
    let merkle_tree = ctx.accounts.merkle_tree.key();
    // 定义pda签名的种子
    let signer_seeds: &[&[&[u8]]] = &[&[
        merkle_tree.as_ref(), // 默克尔树账户的地址作为种子
        &[*ctx.bumps.get("tree_authority").unwrap()], // pda的增加种子
    ]];
    // 创建一个新的cpi上下文并将叶节点添加到默克尔树中。
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(), // spl账户压缩程序
        Modify {
            authority: ctx.accounts.tree_authority.to_account_info(), // 使用PDA的默克尔树的权威
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // 要修改的默克尔树账户
            noop: ctx.accounts.log_wrapper.to_account_info(), // 用于记录数据的空操作程序
        },
        signer_seeds, // pda签名的种子
    );
    // cpi添加叶节点到默克尔树
    append(cpi_ctx, leaf_node)?;
    Ok(())
}

//...
}

#[program]
pub mod compressed_notes {
    use super::*;

    //...

    // 创建`update_note`指令
    pub fn update_note(
        ctx: Context<NoteAccounts>,
        index: u32,
        root: [u8; 32],
        old_note: String,
        new_note: String,
    ) -> Result<()> {
        let old_leaf = keccak::hashv(&[old_note.as_bytes(), ctx.accounts.owner.key().as_ref()]).to_bytes();

        let merkle_tree = ctx.accounts.merkle_tree.key();

        // 定义pda签名的种子
        let signer_seeds: &[&[&[u8]]] = &[&[
            merkle_tree.as_ref(), // 默克尔树账户的地址作为种子
            &[*ctx.bumps.get("tree_authority").unwrap()], // pda的增加种子
        ]];

        // 验证叶节点
        {
            if old_note == new_note {
                msg!("备注相同!");
                return Ok(());
            }

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.compression_program.to_account_info(), // spl账户压缩程序
                VerifyLeaf {
                    merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // 要修改的默克尔树账户
                },
                signer_seeds, // pda签名的种子
            );
            // 验证或失败
            verify_leaf(cpi_ctx, root, old_leaf, index)?;
        }

        let new_leaf = keccak::hashv(&[new_note.as_bytes(), ctx.accounts.owner.key().as_ref()]).to_bytes();

        // 索引器日志
        let note_log = NoteLog::new(new_leaf.clone(), ctx.accounts.owner.key().clone(), new_note);
        // 使用空操作程序记录“备注日志”数据
        wrap_application_data_v1(note_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;

        // 替换叶节点
        {
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.compression_program.to_account_info(), // spl账户压缩程序
                Modify {
                    authority: ctx.accounts.tree_authority.to_account_info(), // 使用PDA的默克尔树的权威
                    merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // 要修改的默克尔树账户
                    noop: ctx.accounts.log_wrapper.to_account_info(), // 用于记录数据的空操作程序
                },
                signer_seeds, // pda签名的种子
            );
            // cpi替换叶节点
            replace_leaf(cpi_ctx, root, old_leaf, new_leaf, index)?;
        }

        Ok(())
    }
}
```

### 7. 客户端测试设置

我们将编写一些测试来确保我们的程序按预期工作。首先，让我们做一些设置。

我们将使用`@solana/spl-account-compression`包。请安装它：

```bash
yarn add @solana/spl-account-compression
```

接下来，我们将提供一个我们创建的实用文件的内容，以便更轻松地进行测试。在`tests`目录中创建一个`utils.ts`文件，并添加以下内容，然后我们将对其进行说明。

```tsx
import {
  SPL_NOOP_PROGRAM_ID,
  deserializeApplicationDataEvent,
} from "@solana/spl-account-compression"
import { Connection, PublicKey } from "@solana/web3.js"
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes"
import { deserialize } from "borsh"
import { keccak256 } from "js-sha3"

class NoteLog {
  leafNode: Uint8Array
  owner: PublicKey
  note: string

  constructor(properties: {
    leafNode: Uint8Array
    owner: Uint8Array
    note: string
  }) {
    this.leafNode = properties.leafNode
    this.owner = new PublicKey(properties.owner)
    this.note = properties.note
  }
}

// 用于Borsh反序列化的描述“Note”结构的映射
const NoteLogBorshSchema = new Map([
  [
    NoteLog,
    {
      kind: "struct",
      fields: [
        ["leafNode", [32]], // 长度为32的`u8`数组
        ["owner", [32]], // 公钥
        ["note", "string"],
      ],
    },
  ],
])

export function getHash(note: string, owner: PublicKey) {
  const noteBuffer = Buffer.from(note)
  const publicKeyBuffer = Buffer.from(owner.toBytes())
  const concatenatedBuffer = Buffer.concat([noteBuffer, publicKeyBuffer])
  const concatenatedUint8Array = new Uint8Array(
    concatenatedBuffer.buffer,
    concatenatedBuffer.byteOffset,
    concatenatedBuffer.byteLength
  )
  return keccak256(concatenatedUint8Array)
}

export async function getNoteLog(connection: Connection, txSignature: string) {
  // 确认交易，否则getTransaction有时会返回null
  const latestBlockHash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txSignature,
  })

  // 使用tx signature获取交易信息
  const txInfo = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  })

  // 获取与索引为0的程序指令相关的内部指令
  // 我们只在测试交易中发送一个指令，所以我们可以假设第一个
  const innerIx = txInfo!.meta?.innerInstructions?.[0]?.instructions

  // 获取与SPL_NOOP_PROGRAM_ID匹配的内部指令
  const noopInnerIx = innerIx.filter(
    (instruction) =>
      txInfo?.transaction.message.staticAccountKeys[
        instruction.programIdIndex
      ].toBase58() === SPL_NOOP_PROGRAM_ID.toBase58()
  )

  let noteLog: NoteLog
  for (let i = noopInnerIx.length - 1; i >= 0; i--) {
    try {
      // 尝试解码和反序列化指令数据
      const applicationDataEvent = deserializeApplicationDataEvent(
        Buffer.from(bs58.decode(noopInnerIx[i]?.data!))
      )

      // 获取应用程序数据
      const applicationData = applicationDataEvent.fields[0].applicationData

      // 将应用程序数据反序列化为NoteLog实例
      noteLog = deserialize(
        NoteLogBorshSchema,
        NoteLog,
        Buffer.from(applicationData)
      )

      if (noteLog !== undefined) {
        break
      }
    } catch (__) {}
  }

  return noteLog
}
```

以上文件有三个主要部分：

1. `NoteLog` - 代表我们将在Noop程序日志中找到的笔记日志的类。我们还在其`NoteLogBorshSchema`中添加了Borsh模式以供反序列化。
2. `getHash` - 创建笔记和笔记所有者的哈希的函数，以便我们可以将其与梅克尔树上找到的内容进行比较
3. `getNoteLog` - 查找提供的交易日志，找到Noop程序日志，然后反序列化并返回相应的笔记日志的函数。

### 8.编写客户端测试

现在我们已经安装了我们的软件包并准备好实用文件，让我们深入了解测试本身。我们将创建四个测试：

1. 创建笔记树 - 这将创建我们将用于存储笔记哈希的梅克尔树
2. 添加笔记 - 这将调用我们的`append_note`指令
3. 添加最大大小笔记 - 这将使用最大化了单个交易中允许的1232字节的笔记来调用我们的`append_note`指令
4. 更新第一个笔记 - 这将调用我们的`update_note`指令来修改我们添加的第一个笔记

第一个测试主要是用于设置。在最后三个测试中，我们将每次断言梅克尔树上的笔记哈希是否与我们根据笔记文本和签署者所期望的结果相匹配。

让我们从导入开始。这里有很多来自Anchor，`@solana/web3.js`，`@solana/spl-account-compression`以及我们自己的实用文件的导入。

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { CompressedNotes } from "../target/types/compressed_notes"
import {
  Keypair,
  Transaction,
  PublicKey,
  sendAndConfirmTransaction,
  Connection,
} from "@solana/web3.js"
import {
  ValidDepthSizePair,
  createAllocTreeIx,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
  ConcurrentMerkleTreeAccount,
} from "@solana/spl-account-compression"
import { getHash, getNoteLog } from "./utils"
import { assert } from "chai"
```

接下来，我们将设置我们将在整个测试中使用的状态变量。这包括默认的Anchor设置以及生成梅克尔树密钥对、树授权和一些笔记。

```tsx
describe("compressed-notes", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const connection = new Connection(
    provider.connection.rpcEndpoint,
    "confirmed" // has to be confirmed for some of the methods below
  )

  const wallet = provider.wallet as anchor.Wallet
  const program = anchor.workspace.CompressedNotes as Program<CompressedNotes>

  // Generate a new keypair for the Merkle tree account
  const merkleTree = Keypair.generate()

  // Derive the PDA to use as the tree authority for the Merkle tree account
  // This is a PDA derived from the Note program, which allows the program to sign for appends instructions to the tree
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [merkleTree.publicKey.toBuffer()],
    program.programId
  )

	const firstNote = "hello world"
  const secondNote = "0".repeat(917)
  const updatedNote = "updated note"


  // TESTS GO HERE

});
```


最后，让我们开始测试本身。首先是“Create Note Tree”测试。此测试将执行两件事：

1. 为 Merkle 树分配一个最大深度为 3、最大缓冲区大小为 8 和遮盖深度为 0 的新账户
2. 使用我们程序的 `createNoteTree` 指令初始化这个新账户

```tsx
it("Create Note Tree", async () => {
  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  // 指令以创建具有树所需空间的新账户
  const allocTreeIx = await createAllocTreeIx(
    connection,
    merkleTree.publicKey,
    wallet.publicKey,
    maxDepthSizePair,
    canopyDepth
  )

  // 通过 Note 程序初始化树的指令
  const ix = await program.methods
    .createNoteTree(maxDepthSizePair.maxDepth, maxDepthSizePair.maxBufferSize)
    .accounts({
      merkleTree: merkleTree.publicKey,
      treeAuthority: treeAuthority,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    })
    .instruction()

  const tx = new Transaction().add(allocTreeIx, ix)
  await sendAndConfirmTransaction(connection, tx, [wallet.payer, merkleTree])
})
```

接下来，我们将创建“Add Note”测试。它应该调用 `append_note` 使用 `firstNote`，然后检查链上哈希是否与我们计算的哈希匹配，以及笔记日志是否与我们传入指令的笔记文本匹配。

```tsx
it("Add Note", async () => {
  const txSignature = await program.methods
    .appendNote(firstNote)
    .accounts({
      merkleTree: merkleTree.publicKey,
      treeAuthority: treeAuthority,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    })
    .rpc()
  
  const noteLog = await getNoteLog(connection, txSignature)
  const hash = getHash(firstNote, provider.publicKey)
  
  assert(hash === Buffer.from(noteLog.leafNode).toString("hex"))
  assert(firstNote === noteLog.note)
})
```

接下来，我们将创建“Add Max Size Note”测试。它与上一个测试相同，但使用第二个笔记。

```tsx
it("Add Max Size Note", async () => {
  // 笔记大小受最大交易大小为 1232 字节的限制，减去指令所需的附加数据
  const txSignature = await program.methods
    .appendNote(secondNote)
    .accounts({
      merkleTree: merkleTree.publicKey,
      treeAuthority: treeAuthority,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    })
    .rpc()
  
  const noteLog = await getNoteLog(connection, txSignature)
  const hash = getHash(secondNote, provider.publicKey)
  
  assert(hash === Buffer.from(noteLog.leafNode).toString("hex"))
  assert(secondNote === noteLog.note)
})
```

最后，我们将创建“Update First Note”测试。这比添加笔记稍微复杂一些。我们将执行以下操作：

1. 获取 Merkle 树根哈希，因为指令需要它
2. 调用我们程序的 `update_note` 指令，传入索引 0 (表示第一个笔记)、Merkle 树根哈希、第一个笔记和更新的数据。记住，它需要第一个笔记和根哈希，因为程序必须在更新笔记的叶节点之前验证整个证明路径。

```tsx
it("Update First Note", async () => {
  const merkleTreeAccount =
    await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      merkleTree.publicKey
    )
  
  const rootKey = merkleTreeAccount.tree.changeLogs[0].root
  const root = Array.from(rootKey.toBuffer())

  const txSignature = await program.methods
    .updateNote(0, root, firstNote, updatedNote)
    .accounts({
      merkleTree: merkleTree.publicKey,
      treeAuthority: treeAuthority,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    })
    .rpc()
  
  const noteLog = await getNoteLog(connection, txSignature)
  const hash = getHash(updatedNote, provider.publicKey)
  
  assert(hash === Buffer.from(noteLog.leafNode).toString("hex"))
  assert(updatedNote === noteLog.note)
})
```

这就是全部，祝贺你！继续运行 `anchor test`，你应该会得到四个通过的测试。

如果遇到问题，请随时回顾一些演示或查看[Compressed Notes 代码仓库](https://github.com/unboxed-software/anchor-compressed-notes)中的完整解决方案代码。

# 挑战

现在你已经练习了状态压缩的基础知识，添加一个新指令到 Compressed Notes 程序。这个新指令应该允许用户删除现有的笔记。请记住，你不能从树中移除叶子节点，因此你需要决定你的程序中“删除”是什么样子的。祝你好运！

如果你想看一个非常简单的删除功能示例，请查看 [GitHub 上的 `solution` 分支](https://github.com/Unboxed-Software/anchor-compressed-notes/tree/solution)。

## 完成实验了吗？

将你的代码推送到 GitHub 并[告诉我们你对这堂课有何看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=60f6b072-eaeb-469c-b32e-5fea4b72d1d1)！

---
title: Token Extensions Program Introduction
objectives:
 - 了解Token扩展程序
 - 了解扩展
---

# 概述
- Solana上现有的Token程序提供了可互换和不可互换Token的接口。然而，随着新功能的需求，对Token程序的各种分叉已经被创建用于添加功能，这给生态系统带来了采用的挑战。
- 为了在不干扰当前用户、钱包和去中心化应用程序（dApps）的情况下引入新的Token功能，并确保现有Token的安全性，一个新的Token程序—Token扩展程序（亦称为Token-2022）已经被开发。
- Token扩展程序是一个单独的程序，具有独立的地址，与原Token程序不同。它通过扩展支持相同的功能，以及额外的功能。

# 概述

Token扩展程序，内部也称为Token 2022，是原始Token程序提供的功能的超集。Token程序通过一套简单的接口和结构来满足大部分可互换和不可互换Token的需求。尽管简单且快速，Token程序缺乏开发人员社区很快发现需要的功能。这导致了Token程序的分叉，潜在地分割了生态系统。

例如，假设一所大学想要向毕业生的钱包发送学位证书的NFT版本。我们怎样确保学位证书永远不会被转移到第三方？在当前的Token程序中，这是不可能的—我们需要在转账指令中添加一个检查，拒绝所有的交易。解决这个问题的方法之一是对Token程序进行分叉，并添加这个检查。然而这意味着这将是一个完全独立的Token程序。大学需要推动钱包和学位验证dapp采用它。此外，不同的大学想要不同的功能怎么办？必须有一种大学DAO来处理这些内部争议—也许会有几个大学DAO... 或者他们可以直接使用新的Token扩展程序中的`不可转让Token`扩展。这是Solana核心程序，被所有人采用。

这就是为什么Token扩展程序被创建，极大地改善了原Token程序中的最受欢迎和最需要的功能的灵活性和定制性。它100%支持开发人员在原始程序中习惯的所有功能，并为未来的改进留下了空间。尽管它是第二个程序，但两个程序要比几十个程序容易得多。

值得一提的是，Token扩展程序部署到一个独立的地址。即使这两个程序的接口相同，这两个程序的地址在任何情况下都**不能互换**。也就是说，使用Token程序创建的Token无法与Token扩展程序交互。因此，如果我们想要支持Token扩展程序，我们的客户端应用程序就需要一些额外的逻辑来区分这两个程序拥有的Token。

最后一点—Token扩展程序并没有完全替代Token程序，如果特定Token的用例非常简单，可能不需要扩展。在这种情况下，原始的Token程序可能略微更适合使用，因为程序不需要经历任何额外的扩展检查。

## 扩展

Token扩展程序的扩展只是扩展。这意味着扩展需要的任何额外数据都被标记到我们熟悉的Mint和Token账户的末尾。这对Token程序和Token扩展程序的接口进行匹配至关重要。

撰写时，[有16个扩展](https://spl.solana.com/token-2022/extensions)，其中4个是关于Token账户，12个是关于Mint账户：

**账户扩展**目前包括：

 - **必需备忘录**
	本扩展使所有转账都需要备忘录，就像传统银行系统一样。

 - **不可变所有权**
	Token账户的所有者通常可以将所有权转让给任何其他地址，这在许多情况下都很有用，但可能会导致安全漏洞，尤其在处理关联Token账户（ATAs）时。为了避免这些问题，我们可以使用这个扩展，使重新分配账户所有权成为不可能。

	注意：所有Token扩展程序ATAs都内置了不可变所有权。

 - **默认账户状态**
	Mint创建者可以使用这个扩展来强制所有新的Token账户都处于冻结状态。这样，用户必须最终与某种类型的服务进行交互，解冻他们的账户并使用Token。

 - **CPI保护**
	该扩展使用户免受未被他们看见的操作的授权，特别是针对既不是系统也不是Token程序的隐藏程序。它通过限制跨程序调用中的某些活动来实现这一点。

**Mint扩展**包括：

 - **转账费用**
	Token扩展程序在协议级别实现了转账费用，从每次转账中扣除一定数量的费用到接收者的账户。这个被扣除的金额是不可访问的，可以由Mint创建者指定的任何地址兑现。

 - **关闭Mint**
	在Token程序下，只能关闭Token账户。然而，现在引入了关闭授权扩展，允许关闭Mint账户。

	注意： 要关闭Mint账户，供应量必须为0。因此，所有铸造的Token必须被销毁。

 - **计息Token**
	具有不断变化价值的Token，为了在客户端显示更新的值，需要需要定期更新操作的代理。通过这一扩展，我们可以通过在Token上设置利率并随时获取其带有利息的数量来改变Token的UI数量。注意，Token上的利息是纯粹装饰性的，不会改变账户中的Token数量。

 - **不可转让的Token**
	该扩展使得可以创建绑定到所有者的Token，意味着它们无法转让给其他人。

 - **永久委托**
	该扩展允许我们为一个Mint指定永久委托。该权限对该Mint的任何Token账户具有无限的委托特权。这意味着它可以在任何账户中燃烧或转移任何数量的Token。永久委托可以被会员计划用来取消访问令牌，也可以被稳定币发行方用来取消受制裁实体持有的余额。该扩展既强大又危险。

 - **转账挂钩**
	该扩展允许Token创建者更好地控制他们的Token如何转移，通过在链上允许回调"挂钩"功能。创建者必须开发并部署一个实现挂钩接口的程序，然后配置他们的Token Mint使用他们的程序。然后，在任何该Mint的转账中，转账挂钩将会被调用。

 - **元数据指针**
	一个Mint可能有多个不同的账户声称描述该Mint。该扩展允许Token创建者指定描述规范元数据的地址。该指针可以是外部账户，如Metaplex元数据账户，或者是使用元数据扩展时自指定的。

 - **元数据**
	该扩展允许Mint创建者将他们的Token的元数据直接包含到Mint账户中。这通常与元数据指针扩展一起使用。


- **群指针**
	将一组令牌想象成“令牌的集合”。更具体地，在 NFT 集合中，带有群指针扩展的铸造将被视为集合 NFT。该扩展包含指向符合 [Token-Group Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-group/interface) 的帐户的指针。

- **群**
	在铸造本身存储了[群信息](https://github.com/solana-labs/solana-program-library/tree/master/token-group/interface)。它总是与群指针扩展一起使用。

- **成员指针**
	群指针的反向是成员指针。此指针指向保存成员数据的帐户，例如它属于哪个群。在 NFT 集合中，这些将是集合中的 NFT。

- **成员**
	这在铸造本身存储了成员信息。它始终与成员指针扩展一起使用。

- **机密转移**
	此扩展增强了交易的隐私，而不会透露交易的重要细节，例如金额。

注意：这些扩展可以混合匹配，以创建大量高功能令牌。

我们将在单独的课程中更深入地探讨每个扩展。

# 在使用 Token Program 和 Token Extension Program 时需要考虑的事项

尽管这两个程序的接口保持一致，但它们是两个不同的程序。这些程序的程序 ID 不能互换使用，它们创建的地址也是不同的。如果要支持 Token Program 令牌和 Token Extension Program 令牌，必须在客户端和程序端上添加额外的逻辑。我们将在以后的课程中深入研究这些实现。

# 实验室
现在，我们将使用 `spl-token-cli` CLI 测试一些这些扩展。

### 1. 入门
在使用这些扩展之前，我们需要安装 `spl-token-cli`。请按照[此指南](https://spl.solana.com/token#setup)中的说明操作。安装完成后，通过运行以下命令验证：

```bash
spl-token --version
```

注意：确保您按照[上述指南](https://spl.solana.com/token#setup)的每个步骤操作，因为它还描述了如何初始化本地钱包和空投 SOL。

### 2. 创建带有关闭授权的铸造

让我们创建一个带有关闭授权扩展的铸造帐户，然后为了展示其工作原理，我们将关闭该铸造帐户！

使用 CLI 创建带有关闭授权扩展的铸造：

此扩展需要以下参数：
 - `create-token`：我们要执行的指令。
 - `--program-id`：此标志用于指定要使用的程序 ID。`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` 是 Token Extension Program 部署的公共地址。
 - `--enable-close`：此标志指定我们要初始化带有关闭授权的铸造帐户。

运行以下命令：

```bash
spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --enable-close
```

我们将看到类似于下面所示的输出：

```bash
Creating token 3s6mQcPHXqwryufMDwknSmkDjtxwVujfovd5gPQLvKw9 under program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

地址：3s6mQcPHXqwryufMDwknSmkDjtxwVujfovd5gPQLvKw9
小数点：9

签名：fGQQ1eAGsnKN11FUcFhGuacpuMTGYwYEfaAVBUys4gvH4pESttRgjVKzTLSfqjeQ5rNXP92qEyBMaFFNTVPMVAD
```

要查看有关新创建的铸造帐户的详细信息，我们可以使用 `display` 命令。此命令将显示关于令牌铸造、帐户或多签的相关详细信息。让我们使用上一步的铸造地址传递给它。

```bash
spl-token display <ACCOUNT_ADDRESS>
```

现在我们有了一个铸造帐户，我们可以使用以下命令关闭它，其中 `<TOKEN_MINT_ADDRESS>` 是上一步的结果地址。

```bash
spl-token close-mint <TOKEN_MINT_ADDRESS> 
```

注意：通过关闭帐户，我们可以收回铸造帐户上的租金拉姆泊。记住，铸造帐户上的供应必须为零。

作为挑战，重复此过程，但在关闭铸造帐户之前，铸造一些令牌，然后尝试关闭它 - 看看会发生什么。（剧透：它将失败）

### 3. 创建一个带有不可变所有者的令牌账户

让我们测试另一个扩展，这次是一个令牌账户扩展。我们将创建一个新的铸造，然后我们将使用不可变所有者扩展创建一个关联的令牌账户。

首先，让我们创建一个新的不带额外扩展的铸造：

```bash
spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb 
```

您应该会得到类似于这样的内容：
```bash
Creating token FXnaqGm42aQgz1zwjKrwfn4Jk6PJ8cvkkSc8ikMGt6EU under program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

地址：FXnaqGm42aQgz1zwjKrwfn4Jk6PJ8cvkkSc8ikMGt6EU
小数点：9

签名：3tX6FHvE24e8UHqSWbK5HRpBFxtCnDTRHASFZtipKkTzapgMGZEeNJ2zHAHSrSUs8L8wQGnLbvJiLrHuomyps39j
```

保存生成的铸造地址，我们将在下一步中使用它。

现在，让我们将这些令牌中的一个铸造到一个使用 `不可变所有者` 扩展的关联令牌账户 (ATA)。默认情况下，所有 ATAs 都启用了 `不可变所有者` 扩展。使用 CLI 创建的所有令牌账户都将是 ATAs，因此 `不可变所有者` 将被启用。


此扩展需要以下参数:
 - `create-account`: 我们要执行的指令。
 - `--program-id` (可选): 我们想要使用的程序ID。这是可选的，因为CLI将找出铸造品所属的程序。
 - `--owner` (可选): 钱包所有者的公钥。它将默认为当前工作的公钥，我们可以通过运行命令 `solana address` 获取。
 - `--fee-payer` (可选): 交易付费的钱包密钥。它将默认为当前工作的密钥对，可以使用 `solana config get` 找到。
 - `<TOKEN_MINT_ADDRESS>`: 这是我们从 `create-token` 命令中获得的铸币账户。

运行以下命令使用不可变所有者扩展来创建关联的代币账户:

```bash
spl-token create-account <TOKEN_MINT_ADDRESS>
```

运行此命令后，我们将会看到以下类似的输出。

```bash
创建账户 F8iDrVskLGwYo53SdJnvBKTpN1C7hobgnPQMq6hLivUn

签名: 5zX73E2aFVwcsvhCgBSF6AxWqydWYk3KJaTmeS4AY22FwCvgEvnodvJ7fzvBHZptqv3FMz6tbLFR5LbmiUHLUkne
```

现在我们可以使用 `mint` 函数为其铸造代币。以下是我们需要提供的参数:
 - `mint`: 指令
 - `<TOKEN_MINT_ADDRESS>`: 我们在第一步中获得的铸币地址
 - `<TOKEN_AMOUNT>`: 要铸造的代币数量
 - `<RECIPIENT_TOKEN_ACCOUNT_ADDRESS>`(可选): 这是用于保存我们在上一步中创建的代币的代币账户。但是，这默认为我们当前工作密钥对和铸币的ATA。因此，它将自动使用我们上一步骤的账户。

```bash
spl-token mint <TOKEN_MINT_ADDRESS> <TOKEN_AMOUNT>
```

这将产生类似以下的结果:
```bash
铸造 1 个代币
  代币: FXnaqGm42aQgz1zwjKrwfn4Jk6PJ8cvkkSc8ikMGt6EU
  收件人: 8r9VNjnLqjzrpgkcgCozgvCBDQwWWYUL7RKwatSWnd6B

签名: 54yREwGCH8YfYXqEf6gRKGou681F8NkToAJZvJqM5qZETJokRkdTb8s8HVkKPeVMQQcc8gCZkq4Kxx3YbLtY9Frk
```

随意使用 `spl-token display` 命令获取一些关于铸造和代币账户的信息。



### 4. 创建一个不可转让的("绑定灵魂")NFT


最后，让我们创建一个不可转让的NFT，有时被称为"绑定灵魂"的NFT。可以把它想象成一个专门由一个人或一个账户拥有的成就代币。为了创建该代币，我们将使用三个扩展:元数据指针、元数据和不可转让的代币。

使用元数据扩展，我们可以直接将元数据包含在铸币账户中，并且不可转让的扩展会使代币专属于该账户。

该命令需要以下参数:
 - `create-token`: 我们希望执行的指令。
 - `--program-id`: 我们希望使用的程序ID。
 - `--decimals`: NFT通常为整数，小数部分为0
 - `--enable-metadata`: 元数据扩展标志。(这将初始化元数据和元数据指针扩展)
 - `--enable-non-transferable`: 不可转让扩展标志。

运行以下命令以创建一个初始化了元数据和不可转让扩展的代币。

```bash
spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --decimals 0 --enable-metadata --enable-non-transferable
```

我们将会看到类似以下的输出。

```bash
在程序 TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb 下创建代币 GVjznwtfPndL9RsBtAYDFT1H8vhQjx8ymAB1rbd17qPr
要在铸币内初始化元数据，请运行 `spl-token initialize-metadata GVjznwtfPndL9RsBtAYDFT1H8vhQjx8ymAB1rbd17qPr <YOUR_TOKEN_NAME> <YOUR_TOKEN_SYMBOL> <YOUR_TOKEN_URI>`, 并使用铸币授权进行签名。

地址:  GVjznwtfPndL9RsBtAYDFT1H8vhQjx8ymAB1rbd17qPr
小数:  0

签名: 5EQ95NPTXg5reg9Ybcw9LQRjiWFZvfb9WqJidxu6kKbcKGajp1U999ioToC1qC88KUS4kdUi6rZbibqjgJbzYses
```

在使用元数据扩展初始化元数据后，我们需要按照上面的输出来初始化元数据。初始化元数据需要以下参数:
 - 铸币地址 : 用于初始化元数据的铸币地址。
 - `<YOUR_TOKEN_NAME>`: 代币的名称
 - `<YOUR_TOKEN_SYMBOL>`: 代币的标识符。
 - `<YOUR_TOKEN_URI>`: 代币的URI。
 - `--update-authority` (可选): 具有更新元数据权限的账户的地址。默认情况下是当前工作的公钥。

运行以下命令来初始化元数据:

```bash
spl-token initialize-metadata <TOKEN_MINT_ADDRESS> 我的代币 TOK http://my.tokn
```

现在，让我们通过调用我们信赖的 `display` 命令来查看元数据。

```bash
spl-token display <TOKEN_MINT_ADDRESS>
```

接下来，让我们更新该铸币的元数据。我们将更新代币的名称。运行以下命令:

```bash
spl-token update-metadata <TOKEN_MINT_ADDRESS> name MyAwesomeNFT
```

现在让我们看看如何向我们的铸币的元数据中添加一个自定义字段。该命令需要以下参数:

 - 铸币地址 : 要更新元数据的铸币的地址。
 - 自定义字段名称 : 新自定义字段的名称。
 - 自定义字段值 : 新自定义字段的值。

运行以下命令:

```bash
spl-token update-metadata <TOKEN_MINT_ADDRESS> new-field new-value
```

我们也可以从铸币元数据中删除自定义字段。运行以下命令:


```bash
spl-token update-metadata <TOKEN_MINT_ADDRESS> new-field --remove
```

最后，让我们将其打造成一个真正的不可转让的NFT。我们通过将NFT铸造到我们的ATA，然后移除铸造权限来实现这一点。这样，供应量将仅为一个。

```bash
spl-token create-account <TOKEN_MINT_ADDRESS>
spl-token mint <TOKEN_MINT_ADDRESS> 1
spl-token authorize <TOKEN_MINT_ADDRESS> mint --disable
```

现在，我们成功地创建了一个不可转让的NFT，它完全归我们的ATA所有。

就是这样！这就是我们如何使用Solana CLI与Token扩展程序来使用这些扩展。我们将在单独的课程中更深入地研究这些扩展，并看看如何以编程方式使用它们。

# 挑战

尝试使用CLI尝试不同的扩展组合。

提示：通过使用`--help`标志调用命令来查看您的选项：
```bash
spl-token --create-token --help
```
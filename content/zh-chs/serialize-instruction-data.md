---
title: 为本地程序开发序列化自定义指令数据
objectives:
- 解释交易内容
- 解释交易指令
- 解释 Solana 运行时优化的基础知识
- 解释 Borsh
- 使用 Borsh 为本地程序序列化程序数据
---
**译者**: [ben46](https://github.com/ben46)

# 摘要

- 本地（非 Anchor）Solana 开发需要手动序列化和反序列化数据。
- 交易由一系列指令组成，单个交易可以包含任意数量的指令，每个指令可以针对不同的程序。当交易提交时，Solana 运行时会按顺序和原子方式处理其指令，这意味着如果任何指令由于任何原因失败，整个交易将无法被处理。
- 每个*指令*由三个组成部分组成：目标程序的 ID、所有涉及的账户的数组以及指令数据的字节缓冲区。
- 每个_交易_包含了一个打算读取或写入的所有账户的数组、一个或多个指令、一个最新的区块哈希以及一个或多个签名。
- 要将来自客户端的指令数据传递，它必须被序列化为一个字节缓冲区。为了简化这个序列化过程，我们将使用[Borsh](https://borsh.io/)。

# 课程

## 交易

到目前为止，我们已经学会了如何为常见的 Solana 程序创建具有指令的交易。本章展示了如何为我们自己的本地 Solana 程序创建指令，这将在以后的几节中开发。具体而言，我们将学习有关序列化和反序列化的内容。对于本地 Solana 程序开发来说，本节是必需的，因此如果你觉得无聊，请不必担心 - 直接跳到 [Anchor](./intro-to-anchor) 章节。

### 交易内容

每个交易包含：

- 一个包括其打算读取或写入的每个账户的数组
- 一个或多个指令
- 一个最新的区块哈希
- 一个或多个签名

`@solana/web3.js` 简化了此过程，因此您所需关注的只是添加指令和签名。该库基于这些信息构建了账户数组，并处理了包括最新区块哈希的逻辑。

## 指令

每个指令包含：

- 打算程序的 ID（公钥）
- 列出在执行过程中将被读取或写入的每个账户的数组
- 指令数据的字节缓冲区

通过其公钥标识程序，以确保正确执行指令。

包含将被读取或写入的每个账户的数组，允许网络执行多项优化，以支持高交易负载和更快的执行。

字节缓冲区允许您将外部数据传递给程序。

您可以在单个交易中包含多个指令。Solana 运行时将按顺序和原子方式处理这些指令。换句话说，如果每个指令成功，那么整个交易也将成功，但如果单个指令失败，则整个交易将立即失败，没有任何副作用。

账户数组不仅仅是账户的公钥数组。数组中的每个对象包括账户的公钥、它是否是交易的签署方以及它是否可写。在执行指令期间，包括帐户是否可写，允许运行时便捷地处理智能合约的并行处理。由于您必须定义哪些账户是只读的，哪些将被写入，因此运行时能够确定哪些交易是不重叠或只读的，并允许它们并行执行。要了解更多关于 Solana 运行时的信息，请查阅 [Sealevel 的这篇博文](https://solana.com/news/sealevel-\--parallel-processing-thousands-of-smart-contracts)。

### 指令数据

向指令中添加任意数据的能力，确保了程序能够具有足够广泛的用例，使其具有动态和灵活的特性，正如 HTTP 请求正文使您能够构建动态和灵活的 REST API 一样。

就像 HTTP 请求正文的结构取决于您打算调用的端点一样，用作指令数据的字节缓冲区的结构完全取决于接收方程序。如果您自己正在构建全栈 dApp，那么您需要在客户端代码上复制构建程序时使用的相同结构。如果您正在与另一位负责程序开发的开发人员合作，您可以协调以确保匹配缓冲区布局。

让我们想象一个具体的例子。想象一下你正在开发一个 Web3 游戏，并且负责编写与玩家库存程序互动的客户端代码。该程序旨在允许客户端：

- 根据玩家游戏结果添加库存
- 将库存从一个玩家转移到另一个玩家
- 为选定的库存物品装备玩家

该程序将被设计为分别将这些功能封装在各自的函数中。

然而，每个程序只有一个入口点。您将通过指令数据指示该程序运行其中的哪个功能。

您还将在指令数据中包含函数需要正常执行的任何信息，例如库存物品的 ID、要转移库存的玩家等。

这些数据结构的结构如何取决于程序的编写方式，但通常会将指令数据的第一个字段设置为程序可以映射到函数的数字，之后的其他字段作为函数参数。

## 序列化

除了了解如何在指令数据缓冲区中包含哪些信息外，您还需要正确地对其进行序列化。Solana 中最常用的序列化器是[Borsh](https://borsh.io)。根据网站上的说明：

> Borsh 代表用于散列的二进制对象表示序列化器。它旨在在优先考虑一致性、安全性、速度并且带有严格规范的安全关键项目中使用。

Borsh 维护了一个[JS 库](https://github.com/near/borsh-js)，用于将常见类型序列化为缓冲区。还有其他构建在 Borsh 之上的软件包，试图使这个过程更加简单。我们将使用 `@coral-xyz/borsh` 库，该库可以使用 `npm` 安装。

基于上述游戏库存示例，假设有一个假设情景，我们正在指示程序为给定物品装备玩家。假设程序的设计是接受代表具有以下属性的结构的缓冲区：

1. `variant` 是一个无符号的 8 位整数，用于指示程序运行哪个指令或函数。
2. `playerId` 是一个无符号的 16 位整数，代表要为其装备给定物品的玩家的玩家 ID。
3. `itemId` 是一个无符号的 256 位整数，代表要为给定玩家装备的物品的物品 ID。

所有这些将作为一个将按顺序读取的字节缓冲区进行传递，因此确保正确的缓冲区布局顺序至关重要。您将创建上述的缓冲区布局模式或模板如下：

```typescript
import * as borsh from '@coral-xyz/borsh'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])
```

然后，您可以使用`encode`方法使用此模式对数据进行编码。此方法接受一个表示要序列化的数据的对象和一个缓冲区作为参数。在下面的示例中，我们分配一个比所需的要大得多的新缓冲区，然后将数据编码到该缓冲区中，并将原始缓冲区切片成一个新缓冲区，该新缓冲区的大小仅为所需的大小。

```typescript
import * as borsh from '@coral-xyz/borsh'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))
```

一旦正确创建了缓冲区并将数据序列化，我们所要做的就是构建交易。这与您在以前的课程中所做的非常相似。下面的示例假设：

- `player`，`playerInfoAccount`和`PROGRAM_ID`已经在代码片段之外的某个地方被定义
- `player`是用户的公钥
- `playerInfoAccount`是要写入库存更改的账户的公钥
- `SystemProgram`将在执行指令的过程中被使用。

```typescript
import * as borsh from '@coral-xyz/borsh'
import * as web3 from '@solana/web3.js'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))

const endpoint = web3.clusterApiUrl('devnet')
const connection = new web3.Connection(endpoint)

const transaction = new web3.Transaction()
const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: player.publicKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: playerInfoAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    }
  ],
  data: instructionBuffer,
  programId: PROGRAM_ID
})

transaction.add(instruction)

web3.sendAndConfirmTransaction(connection, transaction, [player]).then((txid) => {
  console.log(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
})
```

# 实验

让我们通过一起构建一个电影评论应用程序来进行练习，该应用程序允许用户提交电影评论并将其存储在Solana的网络上。在接下来的几堂课中，我们将分步构建这个应用程序，每堂课都会添加新功能。

![电影评论前端](../../assets/movie-reviews-frontend.png)

以下是我们将构建的程序的快速图表：

![Solana将数据项存储在PDAs中，可以通过它们的种子找到](../../assets/movie-review-program.svg)

我们将为此应用程序使用的Solana程序的公钥是`CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN`。

### 1. 下载初始代码

在开始之前，请下载[初始代码](https://github.com/Unboxed-Software/solana-movie-frontend/tree/starter)。

该项目是一个相当简单的Next.js应用程序。它包括我们在钱包课程中创建的`WalletContextProvider`，一个用于显示电影评论的`Card`组件，一个将评论显示在列表中的`MovieList`组件，一个用于提交新评论的`Form`组件以及一个包含`Movie`对象的类定义的`Movie.ts`文件。

请注意，暂时在运行`npm run dev`时页面上显示的电影是模拟的。在本课中，我们将侧重于添加一个新评论，但我们将无法看到该评论显示。下一课，我们将专注于从链上账户中反序列化自定义数据。

### 2. 创建缓冲区布局

请记住，为了正确地与Solana程序交互，您需要知道它期望数据的结构。我们的电影评论程序希望指令数据包含：

1. `variant`，表示应执行哪个指令（也就是程序上应调用的哪个函数）的无符号8位整数。
2. `title`，表示您要评论的电影的标题的字符串。
3. `rating`，表示您为您要评论的电影给出的5分制评分的无符号8位整数。
4. `description`，表示您留下的评论的写部分的字符串。

让我们在`Movie`类中配置`borsh`布局。首先导入`@coral-xyz/borsh`。接下来，创建一个`borshInstructionSchema`属性，并将其设置为包含上述属性的适当`borsh`结构。

```typescript
import * as borsh from '@coral-xyz/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  borshInstructionSchema = borsh.struct([
    borsh.u8('variant'),
    borsh.str('title'),
    borsh.u8('rating'),
    borsh.str('description'),
  ])
}
```

请记住，*顺序很重要*。如果此处的属性顺序与程序的结构不同，交易将失败。

### 3. 创建序列化数据的方法

既然我们已经设置了缓冲区布局，让我们在`Movie`中创建一个名为`serialize()`的方法，该方法将返回一个`Buffer`，其中包含将`Movie`对象的属性编码到适当布局的数据。

```typescript
import * as borsh from '@coral-xyz/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  borshInstructionSchema = borsh.struct([
    borsh.u8('variant'),
    borsh.str('title'),
    borsh.u8('rating'),
    borsh.str('description'),
  ])

  serialize(): Buffer {
    const buffer = Buffer.alloc(1000)
    this.borshInstructionSchema.encode({ ...this, variant: 0 }, buffer)
    return buffer.slice(0, this.borshInstructionSchema.getSpan(buffer))
  }
}
```

以上方法首先为我们的对象创建一个足够大的缓冲区，然后将`{ ...this, variant: 0 }`编码到缓冲区中。由于`Movie`类定义包含了布局所需的4个属性中的3个，并且使用相同的命名，我们可以直接使用扩展运算符并只添加`variant`属性。最后，该方法返回一个新的缓冲区，省略了原始缓冲区中未使用的部分。


### 4. 用户提交表单时发送交易

现在我们已经准备好指令数据的基本构建模块，当用户提交表单时，我们可以创建并发送交易。打开`Form.tsx`文件，找到`handleTransactionSubmit`函数。每当用户提交电影评论表单时，此函数都会被调用。

在这个函数内部，我们将创建并发送包含通过表单提交的数据的交易。

首先要导入`@solana/web3.js`，并从`@solana/wallet-adapter-react`导入`useConnection`和`useWallet`。
```tsx
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
```

在`handleSubmit`函数之前，调用`useConnection()`来获取一个`connection`对象，并调用`useWallet()`来获取`publicKey`和`sendTransaction`。


```tsx
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'

const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export const Form: FC = () => {
  const [title, setTitle] = useState('')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const handleSubmit = (event: any) => {
    event.preventDefault()
    const movie = new Movie(title, rating, description)
    handleTransactionSubmit(movie)
  }

  ...
}
```

在我们实现`handleTransactionSubmit`之前，让我们谈谈需要完成的任务。我们需要：

1. 检查`publicKey`是否存在，以确保用户已连接他们的钱包。
2. 对`movie`调用`serialize()`方法以获得代表指令数据的缓冲区。
3. 创建一个新的`Transaction`对象。
4. 获取该交易将读取或写入的所有账户。
5. 创建一个新的`Instruction`对象，其中包括所有这些账户在`keys`参数中，将缓冲区包含在`data`参数中，并在`programId`参数中包含程序的公钥。
6. 将上一步的指令添加到交易中。
7. 调用`sendTransaction`，传入已组装的交易。

这需要处理的事情有点多！但不用担心，随着实践的深入，情况会变得更容易。让我们从上面的前3个步骤开始：


```typescript
const handleTransactionSubmit = async (movie: Movie) => {
  if (!publicKey) {
    alert('Please connect your wallet!')
    return
  }

  const buffer = movie.serialize()
  const transaction = new web3.Transaction()
}
```
接下来的步骤是获取交易将读取或写入的所有账户。在过去的课程中，已经向您提供了数据将存储的账户。这次，账户的地址更加动态，因此需要进行计算。我们将在下一课中深入讨论这一点，但目前您可以使用以下内容，其中`pda`是数据将存储的账户的地址：

```typescript
const [pda] = await web3.PublicKey.findProgramAddress(
  [publicKey.toBuffer(), Buffer.from(movie.title)],
  new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
)
```
除了这个账户之外，程序还需要从`SystemProgram`中读取，因此我们的数组需要包含`web3.SystemProgram.programId`。

有了这个，我们可以完成剩下的步骤：

```typescript
const handleTransactionSubmit = async (movie: Movie) => {
  if (!publicKey) {
    alert('Please connect your wallet!')
    return
  }

  const buffer = movie.serialize()
  const transaction = new web3.Transaction()

  const [pda] = await web3.PublicKey.findProgramAddress(
    [publicKey.toBuffer(), new TextEncoder().encode(movie.title)],
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
  )

  const instruction = new web3.TransactionInstruction({
    keys: [
      {
        pubkey: publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false
      }
    ],
    data: buffer,
    programId: new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
  })

  transaction.add(instruction)

  try {
    let txid = await sendTransaction(transaction, connection)
    console.log(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
  } catch (e) {
    alert(JSON.stringify(e))
  }
}
```


现在您应该可以使用网站上的表单提交电影评论了。虽然您不会看到用户界面更新以反映新的评论，但您可以查看Solana Explorer上的交易程序日志，以确认提交成功。如果您需要更多时间来熟悉这个项目，可以查看完整的[解决方案代码](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-serialize-instruction-data)。
 

# 挑战

现在轮到您独立构建一些东西了。创建一个应用程序，让这门课程的学生们介绍自己！支持此功能的 Solana 程序是`HdE95RSVsdb315jfJtaykXhXY478h53X6okDupVfY9yf`。

![学生介绍前端](../../assets/student-intros-frontend.png)

1. 您可以从头开始构建，也可以[下载起始代码](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/starter)。
2. 在`StudentIntro.ts`中创建指令缓冲区布局。该程序希望指令数据包含:
   1. `variant`，一个无符号的 8 位整数，表示要运行的指令 (应为 0)。
   2. `name`，表示学生姓名的字符串。
   3. `message`，表示学生在 Solana 旅程中分享的信息的字符串。
3. 在`StudentIntro.ts`中创建一个方法，将使用缓冲区布局对`StudentIntro`对象进行序列化。
4. 在`Form`组件中，实现`handleTransactionSubmit`函数，使其序列化`StudentIntro`，构建适当的事务和事务指令，并将事务提交给用户的钱包。
5. 您现在应该能够提交介绍，并且在链上存储信息！一定要记录交易 ID，并在 Solana Explorer 中查看以验证是否成功。

如果您遇到困难，可以查看[解决方案代码](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data)。

请随意在这些挑战中发挥创造力，并将其带入更深的领域。指南不是来束缚您的！


## 完成了实验吗？

将您的代码推送到 GitHub，并[告诉我们您对这堂课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=6cb40094-3def-4b66-8a72-dd5f00298f61)！
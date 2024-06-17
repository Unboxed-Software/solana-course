---
title: 页面、订单和筛选程序数据
objectives:
- 页面、排序和筛选账户
- 预提取没有数据的账户
- 确定账户的缓冲区布局中存储特定数据的位置
- 预提取具有可用于排序账户的数据子集的账户
- 仅获取数据匹配特定条件的账户
- 使用`getMultipleAccounts`获取账户的子集
---
**译者**: [ben46](https://github.com/ben46)

# 概要

- 这节课深入探讨了我们在反序列化账户数据课程中使用的RPC调用的一些功能
- 为了节省计算时间，您可以通过筛选他们仅返回一个公钥数组来获取大量账户而不包含数据
- 一旦您有了筛选后的可公钥列表，您可以对其进行排序并获取其所属的账户数据

# 课程

你可能已经注意到在上一节课中，虽然我们可以获取并显示账户数据列表，但我们无法对要获取的账户数量或其顺序进行精细控制。在这一课中，我们将学习`getProgramAccounts`函数的一些配置选项，使其能够执行诸如分页、排序账户和筛选等操作。

## 使用 `dataSlice` 仅获取您所需的数据

想象我们在过去几节课上开发的电影评论应用上有四百万条电影评论，平均评论大小为500字节，那么下载所有评论账户的总量将超过2GB。这绝不是您希望在每次页面刷新时都让前端下载的内容。

幸运的是，您用于获取所有账户的`getProgramAccounts`函数接受一个配置对象作为参数。其中的一个配置选项是 `dataSlice`，它允许您提供两个内容：
- `offset` - 从数据缓冲区开头开始切片的偏移量
- `length` - 从提供的偏移量开始返回的字节数

当您在配置对象中包括 `dataSlice` 时，函数将仅返回您指定的数据缓冲区的子集。

### 分页账户

这在分页方面非常有帮助。如果您想要显示所有账户的列表，但账户太多，您不希望一次性拉取所有数据，您可以获取所有账户，但不获取其数据，方法是使用`dataSlice`，例如 `{ offset: 0, length: 0 }`。然后您可以将结果映射到一个只读取需要时才能获取数据的账户键列表。

```tsx
const accountsWithoutData = await connection.getProgramAccounts(
  programId,
  {
    dataSlice: { offset: 0, length: 0 }
  }
)

const accountKeys = accountsWithoutData.map(account => account.pubkey)
```

有了这些键的列表，您可以使用 `getMultipleAccountsInfo` 方法以“页”的形式获取账户数据：

```tsx
const paginatedKeys = accountKeys.slice(0, 10)
const accountInfos = await connection.getMultipleAccountsInfo(paginatedKeys)
const deserializedObjects = accountInfos.map((accountInfo) => {
  // 填充反序列化账户数据的逻辑在此处
})
```

### 对账户进行排序

在分页的同时，`dataSlice` 选项还非常有用，尤其是当您需要对账户列表进行排序时。您仍然不希望一次性获取所有数据，但您确实需要全部键和一种在一开始就对其进行排序的方法。在这种情况下，您需要了解账户数据的布局，并配置数据切片仅包含用于排序的数据。

例如，您可能有一个帐户用于存储联系信息，如下：

- `initialized` 作为布尔值
- `phoneNumber` 作为无符号的64位整数
- `firstName` 作为字符串
- `secondName` 作为字符串

如果您希望根据用户的名字按字母顺序对所有账户键进行排序，您需要找出名字开始的位置的偏移量。第一个字段 `initialized` 占用一个字节，然后 `phoneNumber` 占用另外的8个字节，因此 `firstName` 字段从 偏移量`1 + 8 = 9` 处开始。但是，Borsh中的动态数据字段使用前4个字节来记录数据的长度，所以我们可以跳过额外的4个字节，使得偏移量为13。

然后您需要确定数据切片的长度。由于长度是可变的，我们在获取数据之前无法确定确切的长度。但是，您可以选择一个足够大以涵盖大多数情况的长度，并足够短而不至于过于繁重。15个字节对于大多数名字已经足够，即使有一百万用户，也仍然会保持足够小的下载量。

一旦您使用给定数据切片获取了账户，您可以使用 `sort` 方法对数组进行排序，然后将其映射到一个公钥数组。

```tsx
const accounts = await connection.getProgramAccounts(
  programId,
  {
    dataSlice: { offset: 13, length: 15 }
  }
)

  accounts.sort( (a, b) => {
    const lengthA = a.account.data.readUInt32LE(0)
    const lengthB = b.account.data.readUInt32LE(0)
    const dataA = a.account.data.slice(4, 4 + lengthA)
    const dataB = b.account.data.slice(4, 4 + lengthB)
    return dataA.compare(dataB)
  })

const accountKeys = accounts.map(account => account.pubkey)
```

请注意，上面的代码段中我们没有直接比较数据。这是因为对于像字符串这样的动态大小类型，Borsh在开头放置了一个无符号的32位（4字节）整数来表示该字段所代表的数据的长度。所以为了直接比较名字，我们需要获取每个名字的长度，然后创建一个带有4字节偏移和正确长度的数据切片。

## 使用 `filters` 仅检索特定的账户

限制每个账户接收的数据是非常棒的，但如果您只想返回匹配特定条件的账户而非所有账户，怎么办？这就是 `filters` 配置选项发挥作用的地方。该选项是一个可以包含以下对象的数组：
- `memcmp` - 与特定偏移量处的程序账户数据比较所提供的一系列字节。字段：
    - `offset` - 在比较数据之前要偏移的程序账户数据编号
    - `bytes` - 表示要匹配的数据的base-58编码字符串；限制在129字节以下
- `dataSize` - 将程序账户数据长度与提供的数据大小进行比较

这使您能够根据匹配数据和/或总数据大小进行筛选。

例如，您可以通过包含一个 `memcmp` 过滤器来搜索联系人列表：



```tsx
async function fetchMatchingContactAccounts(connection: web3.Connection, search: string): Promise<(web3.AccountInfo<Buffer> | null)[]> {
  const accounts = await connection.getProgramAccounts(
    programId,
    {
      dataSlice: { offset: 0, length: 0 },
      filters: [
        {
          memcmp:
            {
              offset: 13,
              bytes: bs58.encode(Buffer.from(search))
            }
        }
      ]
    }
  )
}
```

请注意上面示例中的两个要点：

1. 我们将偏移量设置为13，因为我们之前确定数据布局中`firstName`的偏移量为9，我们还要额外跳过表示字符串长度的前4个字节。
2. 我们使用第三方库`bs58`对搜索词进行Base-58编码。您可以使用`npm install bs58`进行安装。

# 实验

还记得我们在过去两课中做过的电影评论应用吗？我们将稍微改进一下，给评论列表分页、对评论进行排序，以及添加一些基本的搜索功能。如果你只是在本课程中跳进来，还没有看过上次的课程，也不用担心 - 只要你具备先前的知识，你应该能够在没有在这个具体项目中做过工作的情况下跟上本实验。

![电影评论前台](../../assets/movie-reviews-frontend.png)

### **1. 下载起始代码**

如果你没有完成上一课中的实验，或者只是想确保没有遗漏任何内容，你可以下载[起始代码](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-deserialize-account-data)。

该项目是一个相当简单的 Next.js 应用程序。它包括我们在钱包课程中创建的`WalletContextProvider`，用于显示电影评论的`Card`组件，用于以列表形式显示评论的`MovieList`组件，用于提交新评论的`Form`组件，以及包含`Movie`对象类定义的`Movie.ts`文件。

### 2. 向评论中添加分页

首先，让我们创建一个用于封装获取账户数据的空间。新建一个文件`MovieCoordinator.ts`，并声明一个`MovieCoordinator`类。然后，我们将`MovieList`中的`MOVIE_REVIEW_PROGRAM_ID`常量移到这个新文件中，因为我们将移动所有对它的引用。

```tsx
const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export class MovieCoordinator { }
```

现在，我们可以使用`MovieCoordinator`来创建分页实现。在我们开始之前，简要说明一下：这将是尽可能简单的分页实现，以便我们可以集中精力处理与 Solana 账户交互的复杂部分。对于生产应用程序，你可以并且应该做得更好。

在这个过程中，关键是要预取所有没有数据的账户。让我们填充`prefetchAccounts`的主体部分，以执行这样的操作，并将检索到的公钥设置为静态`accounts`属性。

```tsx
static async prefetchAccounts(connection: web3.Connection) {
  const accounts = await connection.getProgramAccounts(
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
    {
      dataSlice: { offset: 0, length: 0 },
    }
  )

  this.accounts = accounts.map(account => account.pubkey)
}
```

现在，让我们填写`fetchPage`方法。首先，如果账户尚未被预取，则我们需要执行这样的操作。然后，我们可以获取对应于所请求页面的账户公钥，并调用`connection.getMultipleAccountsInfo`。最后，我们对账户数据进行反序列化，并返回相应的`Movie`对象。

```tsx
static async fetchPage(connection: web3.Connection, page: number, perPage: number): Promise<Movie[]> {
  if (this.accounts.length === 0) {
    await this.prefetchAccounts(connection)
  }

  const paginatedPublicKeys = this.accounts.slice(
    (page - 1) * perPage,
    page * perPage,
  )

  if (paginatedPublicKeys.length === 0) {
    return []
  }

  const accounts = await connection.getMultipleAccountsInfo(paginatedPublicKeys)

  const movies = accounts.reduce((accum: Movie[], account) => {
    const movie = Movie.deserialize(account?.data)
    if (!movie) {
      return accum
    }

    return [...accum, movie]
  }, [])

  return movies
}
```

完成后，我们可以重新配置`MovieList`以使用这些方法。在`MovieList.tsx`中，添加`const [page, setPage] = useState(1)`，靠近现有的`useState`调用。然后，更新`useEffect`，调用`MovieCoordinator.fetchPage`，而不是内联获取账户。

```tsx
const { connection } = useConnection()
const [movies, setMovies] = useState<Movie[]>([])
const [page, setPage] = useState(1)

useEffect(() => {
  MovieCoordinator.fetchPage(
    connection,
    page,
    10
  ).then(setMovies)
}, [page])
```

最后，我们需要在列表底部添加按钮，用于导航到不同页面：

```tsx
return (
  <div>
    {
      movies.map((movie, i) => <Card key={i} movie={movie} /> )
    }
    <Center>
      <HStack w='full' mt={2} mb={8} ml={4} mr={4}>
        {
          page > 1 && <Button onClick={() => setPage(page - 1)}>上一页</Button>
        }
        <Spacer />
        {
          MovieCoordinator.accounts.length > page * 2 &&
            <Button onClick={() => setPage(page + 1)}>下一页</Button>
        }
      </HStack>
    </Center>
  </div>
)
```

此时，您应该能够运行项目并在页面之间单击！

### 3. 根据标题按字母顺序排序点评

如果查看点评，您可能会注意到它们没有特定的顺序。我们可以通过向数据片段中添加足够的数据来帮助我们进行一些排序来解决这个问题。电影点评数据缓冲区中的各种属性排列如下：

- `initialized` - 无符号8位整数；1字节
- `rating` - 无符号8位整数；1字节
- `title` - 字符串；未知字节数
- `description` - 字符串；未知字节数

基于此，我们需要提供给数据片段的偏移量以访问`title`的偏移量为2。然而，长度是不确定的，因此我们可以提供似乎是一个合理长度的长度。我将坚持使用18，因为这将涵盖大多数标题的长度，而不会每次获取太多数据。

修改了`getProgramAccounts`中的数据片段后，我们需要实际对返回的数组进行排序。为此，我们需要比较实际对应于`title`的数据缓冲区的部分。Borsh中动态字段的前4个字节用于存储以字节为单位的字段长度。因此，在我们讨论的任何给定缓冲区`data`上切片的情况下，字符串部分为`data.slice(4, 4 + data[0])`。

现在我们已经考虑了这一点，让我们修改`MovieCoordinator`中`prefetchAccounts`的实现：

```tsx
static async prefetchAccounts(connection: web3.Connection, filters: AccountFilter[]) {
  const accounts = await connection.getProgramAccounts(
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
    {
      dataSlice: { offset: 2, length: 18 },
    }
  )

  accounts.sort( (a, b) => {
    const lengthA = a.account.data.readUInt32LE(0)
    const lengthB = b.account.data.readUInt32LE(0)
    const dataA = a.account.data.slice(4, 4 + lengthA)
    const dataB = b.account.data.slice(4, 4 + lengthB)
    return dataA.compare(dataB)
  })

  this.accounts = accounts.map(account => account.pubkey)
}
```

就是这样，现在您应该能够运行应用程序并按字母顺序查看电影点评列表。

### 4. 添加搜索

我们要做的最后一件事是添加一些基本的搜索功能。让我们向`prefetchAccounts`添加一个`search`参数，并重新配置函数体以使用它。

我们可以使用`getProgramAccounts`的`config`参数的`filters`属性来按特定数据过滤帐户。`title`字段的偏移量是2，但前4个字节是标题的长度，因此字符串本身的实际偏移量是6。请记住，这些字节需要使用base 58编码，因此让我们安装并引入`bs58`。

```tsx
import bs58 from 'bs58'

...

static async prefetchAccounts(connection: web3.Connection, search: string) {
  const accounts = await connection.getProgramAccounts(
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
    {
      dataSlice: { offset: 2, length: 18 },
      filters: search === '' ? [] : [
        {
          memcmp:
            {
              offset: 6,
              bytes: bs58.encode(Buffer.from(search))
            }
        }
      ]
    }
  )

  accounts.sort( (a, b) => {
    const lengthA = a.account.data.readUInt32LE(0)
    const lengthB = b.account.data.readUInt32LE(0)
    const dataA = a.account.data.slice(4, 4 + lengthA)
    const dataB = b.account.data.slice(4, 4 + lengthB)
    return dataA.compare(dataB)
  })

  this.accounts = accounts.map(account => account.pubkey)
}
```

现在，添加一个`search`参数至`fetchPage`，并更新它对`prefetchAccounts`的调用，以传递它。我们还需要向`fetchPage`添加一个名为`reload`的布尔参数，以便我们可以在搜索值更改时强制刷新帐户预取。

```tsx
static async fetchPage(connection: web3.Connection, page: number, perPage: number, search: string, reload: boolean = false): Promise<Movie[]> {
  if (this.accounts.length === 0 || reload) {
    await this.prefetchAccounts(connection, search)
  }

  const paginatedPublicKeys = this.accounts.slice(
    (page - 1) * perPage,
    page * perPage,
  )

  if (paginatedPublicKeys.length === 0) {
    return []
  }

  const accounts = await connection.getMultipleAccountsInfo(paginatedPublicKeys)

  const movies = accounts.reduce((accum: Movie[], account) => {
    const movie = Movie.deserialize(account?.data)
    if (!movie) {
      return accum
    }

    return [...accum, movie]
  }, [])

  return movies
}
```

有了这些，让我们更新`MovieList`中的代码，以正确调用它。

首先，在其他`useState`调用附近添加`const [search, setSearch] = useState('')`。然后，在`useEffect`中更新`MovieCoordinator.fetchPage`的调用，以传递`search`参数，并在`search !== ''`时重新加载。

```tsx
const { connection } = useConnection()
const [movies, setMovies] = useState<Movie[]>([])
const [page, setPage] = useState(1)
const [search, setSearch] = useState('')

useEffect(() => {
  MovieCoordinator.fetchPage(
    connection,
    page,
    2,
    search,
    search !== ''
  ).then(setMovies)
}, [page, search])
```


最后，添加一个搜索栏，用于设置`search`的值：
```tsx
return (
  <div>
    <Center>
      <Input
        id='search'
        color='gray.400'
        onChange={event => setSearch(event.currentTarget.value)}
        placeholder='搜索'
        w='97%'
        mt={2}
        mb={2}
      />
    </Center>

  ...

  </div>
)
```

最后，添加一个搜索栏来设置`search`的值。

这就是全部内容了！应用现在有了有序的评论、分页和搜索功能。

这可是一大堆东西要消化，但你成功了。如果需要更多时间来理解这些概念，可以随意重新阅读对你来说最具挑战性的部分，或者查看[解决方案代码](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-paging-account-data)。

# 挑战

现在该你试着自己做一下了。在上一课的学生介绍应用基础上，添加分页、按姓名进行字母排序以及按姓名搜索的功能。

![学生介绍前端](../../assets/student-intros-frontend.png)

1. 你可以从头开始构建这个项目，或者你可以下载[起始代码](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-deserialize-account-data)
2. 通过预取不带数据的账户来为项目添加分页，然后只有在需要时才获取每个账户的账户数据。
3. 按姓名对应用中显示的账户进行字母排序。
4. 增加按学生姓名搜索介绍的功能。

这是具有挑战性的。如果遇到困难，可以参考[解决方案代码](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-paging-account-data)。随着这一步，你完成了第一模块！你的体验如何？欢迎[分享一些快速反馈](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%201)，这样我们就可以持续改进课程了！

如往常一样，如果愿意，可以在这些挑战中发挥创造力，超出指令范围进行扩展！


## 完成了实验吗？

将你的代码推送到 GitHub，并[告诉我们你对这节课的想法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=9342ad0a-1741-41a5-9f68-662642c8ec93)！

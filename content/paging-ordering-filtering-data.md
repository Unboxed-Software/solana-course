---
title: Page, Order, and Filter Custom Account Data
objectives:
- Page, order, and filter accounts
- Prefetch accounts without data
- Determine where in an account’s buffer layout specific data is stored
- Prefetch accounts with a subset of data that can be used to order accounts
- Fetch only accounts whose data matches specific criteria
- Fetch a subset of total accounts using `getMultipleAccounts`
---

# TL;DR

- This lesson delves into some functionality of the RPC calls that we used in the deserializing account data lesson
- To save on compute time, you can fetch a large number of accounts without their data by filtering them to return just an array of public keys
- Once you have a filtered list of public keys, you can order them and fetch the account data they belong to

# Overview

You may have noticed in the last lesson that while we could fetch and display a list of account data, we didn’t have any granular control over how many accounts to fetch or their order. In this lesson, we’ll learn about some configuration options for the `getProgramAccounts` function that will enable things like paging, ordering accounts, and filtering.

## Use `dataSlice` to only fetch data you need

Imagine the Movie Review app we worked on in past lessons having four million movie reviews and that the average review is 500 bytes. That would make the total download for all review accounts over 2GB. Definitely not something you want to have your frontend download every time the page refreshes.

Fortunately, the `getProgramAccounts` function that you use to get all of the accounts takes a configuration object as argument. One of the configuration options is `dataSlice` which lets you provide two things:

- `offset` - the offset from the beginning of the data buffer to start the slice
- `length` - the number of bytes to return, starting from the provided offset

When you include a `dataSlice` in the configuration object, the function will only return the subset of the data buffer that you specified.

### Paging Accounts

One area this becomes helpful is with paging. If you want to have a list that displays all accounts but there are so many accounts that you don’t want to pull all the data at once, you can fetch all of the accounts with no data. You can then map the result to a list of account keys whose data you can fetch only when needed.

```tsx
const accountsWithoutData = await connection.getProgramAccounts(
	programId,
	{
		dataSlice: { offset: 0, length: 0 }
	}
)

const accountKeys = accountsWithoutData.map(account => account.pubkey)
```

With this list of keys, you can then fetch account data in “pages” using the `getMultipleAccountsInfo` method:

```tsx
const paginatedKeys = accountKeys.slice(0, 10)
const accountInfos = await connection.getMultipleAccountsInfo(paginatedKeys)
const deserializedObjects = accountInfos.map((accountInfo) => {
	// put logic to deserialize accountInfo.data here
})
```

### Ordering Accounts

The `dataSlice` option is also helpful when you need to order a list of accounts while paging. You still don’t want to fetch all the data at once, but you do need all of the keys and a way to order them up front. In this case, you need to understand the layout of the account data and configure the data slice to only be the data you need to use for ordering.

For example, you might have an account that stores contact information like so:

- `initialized` as a boolean
- `phoneNumber` as an unsigned, 64-bit integer
- `firstName` as a string
- `secondName` as a string

If you want to order all of the account keys alphabetically based on the user’s first name, you need to find out the offset where the name starts. The first field, `initialized`, takes the first byte, then `phoneNumber` takes another 8, so the `firstName` field starts at offset `1 + 8 = 9`. However, dynamic data fields in borsh use the first 4 bytes to record the length of the data, so we can skip an additional 4 bytes, making the offset 13.

You then need to determine the length to make the data slice. Since the length is variable, we can’t know for sure before fetching the data. But you can choose a length that is large enough to cover most cases and short enough to not be too much of a burden to fetch. 15 bytes is plenty for most first names, but would result in a small enough download even with a million users.

Once you’ve fetched accounts with the given data slice, you can use the `sort` method to sort the array before mapping it to an array of public keys.

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

Note that in the snippet above we don’t compare the data as given. This is because for dynamically sized types like strings, Borsh places an unsigned, 32-bit integer at the start to indicate the length of the data representing that field. So to compare the first names directly, we need to get the length for each, then create a data slice with a 4 byte offset and the proper length.

## Use `filters` to only retrieve specific accounts

Limiting the data received per account is great, but what if you only want to return accounts that match a specific criteria rather than all of them? That’s where the `filters` configuration option comes in. This option is an array that can have objects matching the following:

- `memcmp` - compares a provided series of bytes with program account data at a particular offset. Fields:
    - `offset` - the number to offset into program account data before comparing data
    - `bytes` - a base-58 encoded string representing the data to match; limited to less than 129 bytes
- `dataSize` - compares the program account data length with the provided data size

These let you filter based on matching data and/or total data size.

For example, you could search through a list of contacts by including a `memcmp` filter:

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

Two things to note in the example above:

1. We’re setting the offset to 13 because we determined previously that the offset for `firstName` in the data layout is 9 and we want to additionally skip the first 4 bytes indicating the length of the string.
2. We’re using a third party library `bs58` to perform base-58 encoding on the search term. You can install it using `npm install bs58`.

# Demo

Remember that Movie Review app we worked on in the last two lessons? We’re going to spice it up a little by paging the review list, ordering the reviews so they aren’t so random, and adding some basic search functionality. No worries if you’re just jumping into this lesson without having looked at the previous ones - as long as you have the prerequisite knowledge, you should be able to follow the demo without having worked in this specific project yet.

![Screenshot of movie review frontend](../assets/movie-reviews-frontend.png)

### **1. Download the starter code**

If you didn’t complete the demo from the last lesson or just want to make sure that you didn’t miss anything, you can download the [starter code](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-deserialize-account-data).

The project is a fairly simple Next.js application. It includes the `WalletContextProvider` we created in the Wallets lesson, a `Card` component for displaying a movie review, a `MovieList` component that displays reviews in a list, a `Form` component for submitting a new review, and a `Movie.ts` file that contains a class definition for a `Movie` object.

### 2. Add paging to the reviews

First things first, let’s create a space to encapsulate the code for fetching account data. Create a new file `MovieCoordinator.ts` and declare a `MovieCoordinator` class. Then let’s move the `MOVIE_REVIEW_PROGRAM_ID` constant from `MovieList` into this new file since we’ll be moving all references to it

```tsx
const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export class MovieCoordinator { }
```

Now we can use `MovieCoordinator` to create a paging implementation. A quick note before we dive in: this will be as simple a paging implementation as possible so that we can focus on the complex part of interacting with Solana accounts. You can, and should, do better for a production application.

With that out of the way, let’s create a static property `accounts` of type `web3.PublicKey[]`, a static function `prefetchAccounts(connection: web3.Connection)`, and a static function `fetchPage(connection: web3.Connection, page: number, perPage: number): Promise<Movie[]>`. You’ll also need to import `@solana/web3.js` and `Movie`.

```tsx
import * as web3 from '@solana/web3.js'
import { Movie } from '../models/Movie'

const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export class MovieCoordinator {
	static accounts: web3.PublicKey[] = []

	static async prefetchAccounts(connection: web3.Connection) {

	}

	static async fetchPage(connection: web3.Connection, page: number, perPage: number): Promise<Movie[]> {

	}
}
```

The key to paging is to prefetch all the accounts without data. Let’s fill in the body of `prefetchAccounts` to do this and set the retrieved public keys to the static `accounts` property.

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

Now, let’s fill in the `fetchPage` method. First, if the accounts haven’t been prefetched yet, we’ll need to do that. Then, we can get the account public keys that correspond to the requested page and call `connection.getMultipleAccountsInfo`. Finally, we deserialize the account data and return the corresponding `Movie` objects.

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

With that done, we can reconfigure `MovieList` to use these methods. In `MovieList.tsx`, add `const [page, setPage] = useState(1)` near the existing `useState` calls. Then, update `useEffect` to call `MovieCoordinator.fetchPage` instead of fetching the accounts inline.

```tsx
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
const [movies, setMovies] = useState<Movie[]>([])
const [page, setPage] = useState(1)

useEffect(() => {
	MovieCoordinator.fetchPage(
		connection,
		page,
		10
	).then(setMovies)
}, [page, search])
```

Lastly, we need to add buttons to the bottom of the list for navigating to different pages:

```tsx
return (
	<div>
		{
			movies.map((movie, i) => <Card key={i} movie={movie} /> )
		}
		<Center>
			<HStack w='full' mt={2} mb={8} ml={4} mr={4}>
				{
					page > 1 && <Button onClick={() => setPage(page - 1)}>Previous</Button>
				}
				<Spacer />
				{
					MovieCoordinator.accounts.length > page * 2 &&
						<Button onClick={() => setPage(page + 1)}>Next</Button>
				}
			</HStack>
		</Center>
	</div>
)
```

At this point, you should be able to run the project and click between pages!

### 3. Order reviews alphabetically by title

If you look at the reviews, you might notice they aren’t in any specific order. We can fix this by adding back just enough data into our data slice to help us do some sorting. The various properties in the movie review data buffer are laid out as follows

- `initialized` - unsigned 8-bit integer; 1 byte
- `rating` - unsigned 8-bit integer; 1 byte
- `title` - string; unknown number of bytes
- `description` - string; unknown number of bytes

Based on this, the offset we need to provide to the data slice to access `title` is 2. The length, however, is indeterminate, so we can just provide what seems to be a reasonable length. I’ll stick with 18 as that will cover the length of most titles without fetching too much data every time.

Once we’ve modified the data slice in `getProgramAccounts`, we then need to actually sort the returned array. To do this, we need to compare the part of the data buffer that actually corresponds to `title`. The first 4 bytes of a dynamic field in Borsh are used to store the length of the field in bytes. So in any given buffer `data` that is sliced the way we discussed above, the string portion is `data.slice(4, 4 + data[0])`.

Now that we’ve thought through this, let’s modify the implementation of `prefetchAccounts` in `MovieCoordinator`:

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

And just like that, you should be able to run the app and see the list of movie reviews ordered alphabetically.

### 4. Add search

The last thing we’ll do to improve this app is to add some basic search capability. Let’s add a `search` parameter to `prefetchAccounts` and reconfigure the body of the function to use it.

We can use the `filters` property of the `config` parameter of `getProgramAccounts` to filter accounts by specific data. The offset to the `title` fields is 2, but the first 4 bytes are the length of the title so the actual offset to the string itself is 6. Remember that the bytes need to be base 58 encoded, so let’s install and import `bs58`.

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

Now, add a `search` parameter to `fetchPage` and update its call to `prefetchAccounts` to pass it along. We’ll also need to add a `reload` boolean parameter to `fetchPage` so that we can force a refresh of the account prefetching every time the search value changes.

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

With that in place, let’s update the code in `MovieList` to call this properly.

First, add `const [search, setSearch] = useState('')` near the other `useState` calls. Then update the call to `MovieCoordinator.fetchPage` in the `useEffect` to pass the `search` parameter and to reload when `search !== ''`.

```tsx
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
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

Finally, add a search bar that will set the value of `search`:

```tsx
return (
	<div>
		<Center>
			<Input
				id='search'
				color='gray.400'
				onChange={event => setSearch(event.currentTarget.value)}
				placeholder='Search'
				w='97%'
				mt={2}
				mb={2}
			/>
		</Center>

...

	</div>
)
```

And that’s it! The app now has ordered reviews, paging, and search.

That was a lot to digest, but you made it through. If you need to spend some more time with the concepts, feel free to reread the sections that were most challenging for you and/or have a look at the [solution code](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-paging-account-data).

# Challenge

Now it’s your turn to try and do this on your own. Using the Student Intros app from last lesson, add paging, ordering alphabetically by name, and searching by name.

![Screenshot of Student Intros frontend](../assets/student-intros-frontend.png)

1. You can build this from scratch or you can download the [starter code](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-deserialize-account-data)
2. Add paging to the project by prefetching accounts without data, then only fetching the account data for each account when it’s needed.
3. Order the accounts displayed in the app alphabetically by name.
4. Add the ability to search through introductions by a student’s name.

This is challenging. If you get stuck, feel free to reference the [solution code](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-paging-account-data). With this you complete Module 1! How was your experience? Feel free to share some quick feedback [here](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%201), so that we can continue to improve the course!

As always, get creative with these challenges and take them beyond the instructions if you want! 

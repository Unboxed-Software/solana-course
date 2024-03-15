---
title: Paginer, ordonner et filtrer les données d'un programme
objectives:
- Paginer, ordonner et filtrer des comptes
- Précharger les comptes sans données
- Déterminer où les données spécifiques d'un compte sont stockées dans la structure du tampon
- Précharger les comptes avec un sous-ensemble de données pouvant être utilisées pour ordonner les comptes
- Récupérer uniquement les comptes dont les données correspondent à des critères spécifiques
- Récupérer un sous-ensemble de comptes totaux en utilisant `getMultipleAccounts`
---

# Résumé

- Cette leçon explore certaines fonctionnalités des appels RPC que nous avons utilisés dans la leçon de désérialisation des données de compte.
- Pour économiser du temps de calcul, vous pouvez récupérer un grand nombre de comptes sans leurs données en les filtrant pour ne retourner qu'un tableau de clés publiques.
- Une fois que vous avez une liste filtrée de clés publiques, vous pouvez les ordonner et récupérer les données de compte auxquelles elles appartiennent.

# Aperçu général

Vous avez peut-être remarqué dans la dernière leçon que bien que nous puissions récupérer et afficher une liste de données de compte, nous n'avions aucun contrôle granulaire sur le nombre de comptes à récupérer ou leur ordre. Dans cette leçon, nous allons découvrir quelques options de configuration pour la fonction `getProgramAccounts` qui permettront des fonctionnalités telles que le paginage, l'ordonnancement des comptes et le filtrage.

## Utilisez `dataSlice` pour ne récupérer que les données dont vous avez besoin

Imaginez l'application de critique de films sur laquelle nous avons travaillé lors des leçons précédentes ayant quatre millions de critique de films et que la taille moyenne d'un critique est de 500 octets. Cela rendrait le téléchargement total pour tous les comptes de critique supérieur à 2 Go. Ce n'est certainement pas quelque chose que vous voulez télécharger à chaque fois que la page se rafraîchit.

Heureusement, la fonction `getProgramAccounts` que vous utilisez pour obtenir tous les comptes prend un objet de configuration en argument. Une des options de configuration est `dataSlice` qui vous permet de fournir deux éléments :

- `offset` - le décalage à partir du début du tampon de données pour commencer la tranche
- `length` - le nombre d'octets à retourner, à partir du décalage fourni

Lorsque vous incluez un `dataSlice` dans l'objet de configuration, la fonction ne renverra que le sous-ensemble du tampon de données que vous avez spécifié.

### Paginer les comptes

Un domaine où cela devient utile est le paginage. Si vous voulez avoir une liste qui affiche tous les comptes mais qu'il y a tellement de comptes que vous ne voulez pas extraire toutes les données en une fois, vous pouvez récupérer tous les comptes mais sans récupérer leurs données en utilisant un `dataSlice` de `{ offset: 0, length: 0 }`. Vous pouvez ensuite mapper le résultat sur une liste de clés de compte dont les données peuvent être récupérées uniquement en cas de besoin.

```tsx
const accountsWithoutData = await connection.getProgramAccounts(
  programId,
  {
    dataSlice: { offset: 0, length: 0 }
  }
)

const accountKeys = accountsWithoutData.map(account => account.pubkey)
```

Avec cette liste de clés, vous pouvez ensuite récupérer les données du compte par "pages" en utilisant la méthode `getMultipleAccountsInfo` :

```tsx
const paginatedKeys = accountKeys.slice(0, 10)
const accountInfos = await connection.getMultipleAccountsInfo(paginatedKeys)
const deserializedObjects = accountInfos.map((accountInfo) => {
  // mettre la logique de désérialisation de infoCompte.data ici
})
```

### Ordonner les comptes

L'option `dataSlice` est également utile lorsque vous devez ordonner une liste de comptes tout en paginant. Vous ne voulez toujours pas extraire toutes les données en une fois, mais vous avez besoin de toutes les clés et d'un moyen de les ordonner dès le départ. Dans ce cas, vous devez comprendre la mise en page des données du compte et configurer la tranche de données pour ne contenir que les données nécessaires à l'ordonnancement.

Par exemple, vous pourriez avoir un compte qui stocke des informations de contact comme ceci :

- `initialized`, un booléen
- `phoneNumber`, un entier non signé sur 64 bits
- `firstName`, une chaîne de caractères
- `secondName`, une chaîne de caractères

Si vous souhaitez trier toutes les clés de compte par ordre alphabétique en fonction du prénom de l'utilisateur, vous devez trouver le décalage où commence le nom. Le premier champ, `initialized`, prend le premier octet, puis `phoneNumber` prend encore 8, donc le champ `firstName` commence au décalage `1 + 8 = 9`. Cependant, les champs de données dynamiques dans borsh utilisent les 4 premiers octets pour enregistrer la longueur des données, nous pouvons donc sauter 4 octets supplémentaires, faisant du décalage 13.

Vous devez ensuite déterminer la longueur à donner à la tranche de données. Comme la longueur est variable, nous ne pouvons pas savoir avec certitude avant de récupérer les données. Mais vous pouvez choisir une longueur suffisamment grande pour couvrir la plupart des cas et suffisamment courte pour ne pas être trop lourde à extraire. 15 octets suffisent amplement pour la plupart des prénoms, mais cela resterait un téléchargement assez petit même avec un million d'utilisateurs.

Une fois que vous avez récupéré les comptes avec la tranche de données donnée, vous pouvez utiliser la méthode `sort` pour trier le tableau avant de le mapper sur un tableau de clés publiques.

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

Notez que dans l'extrait ci-dessus, nous ne comparons pas les données telles quelles. C'est parce que pour les types de taille dynamique comme les chaînes de caractères, Borsh place un entier non signé sur 32 bits (4 octets) au début pour indiquer la longueur des données représentant ce champ. Donc, pour comparer les prénoms directement, nous devons obtenir la longueur pour chacun, puis créer une tranche de données avec un décalage de 4 octets et la longueur appropriée.

## Utilisez `filters` pour récupérer uniquement des comptes spécifiques

Limiter les données reçues par compte est très bien, mais que se passe-t-il si vous ne voulez retourner que les comptes qui correspondent à des critères spécifiques plutôt que tous? C'est là que l'option de configuration `filters` entre en jeu. Cette option est un tableau qui peut avoir des objets correspondant à ce qui suit :

- `memcmp` - compare une série fournie d'octets avec les données du compte de programme à un décalage particulier. Champs :
    - `offset` - le nombre à décaler dans les données du compte de programme avant de comparer les données
    - `bytes` - une chaîne codée en base 58 représentant les données à faire correspondre ; limitée à moins de 129 octets
- `dataSize` - compare la longueur des données du compte de programme avec la taille de données fournie

Ces options vous permettent de filtrer en fonction de données correspondantes et/ou de la taille totale des données.

Par exemple, vous pourriez rechercher dans une liste de contacts en incluant un filtre `memcmp` :

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

Deux choses à noter dans l'exemple ci-dessus :

1. Nous fixons le décalage à 13 car nous avons déterminé précédemment que le décalage pour `firstName` dans la mise en page des données est de 9 et nous voulons également sauter les 4 premiers octets indiquant la longueur de la chaîne.
2. Nous utilisons une bibliothèque tierce `bs58` pour effectuer le codage en base 58 sur le terme de recherche. Vous pouvez l'installer en utilisant `npm install bs58`.

# Laboratoire

Vous vous souvenez de l'application de critique de films sur laquelle nous avons travaillé lors des deux dernières leçons? Nous allons pimenter un peu les choses en paginant la liste des critiques, en ordonnant les critiques pour qu'ils ne soient pas si aléatoires et en ajoutant une fonctionnalité de recherche de base. Pas de soucis si vous commencez cette leçon sans avoir regardé les précédentes - tant que vous avez les connaissances préalables, vous devriez pouvoir suivre le laboratoire sans avoir travaillé dans ce projet spécifique auparavant.

![Capture d'écran de l'interface utilisateur de l'application de critique de films](../assets/movie-reviews-frontend.png)

### **1. Téléchargez le code de départ**

Si vous n'avez pas terminé le laboratoire de la dernière leçon ou si vous voulez simplement vous assurer de ne rien avoir manqué, vous pouvez télécharger le [code de départ](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-deserialize-account-data).

Le projet est une application Next.js assez simple. Il comprend le `WalletContextProvider` que nous avons créé dans la leçon sur les portefeuilles, un composant `Card` pour afficher une critique de film, un composant `MovieList` qui affiche les critiques dans une liste, un composant `Form` pour soumettre une nouvelle critique et un fichier `Movie.ts` qui contient une définition de classe pour un objet `Movie`.

### 2. Ajoutez un paginage aux critiques

Tout d'abord, créons un espace pour encapsuler le code de récupération des données de compte. Créez un nouveau fichier `MovieCoordinator.ts` et déclarez une classe `MovieCoordinator`. Ensuite, déplaçons la constante `MOVIE_REVIEW_PROGRAM_ID` de `MovieList` vers ce nouveau fichier car nous déplacerons toutes les références vers cette constante.

```tsx
const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export class MovieCoordinator { }
```

Maintenant, nous pouvons utiliser `MovieCoordinator` pour créer une implémentation de pagination. Avant de plonger dedans, un petit rappel : il s'agira d'une implémentation de pagination aussi simple que possible afin que nous puissions nous concentrer sur la partie complexe de l'interaction avec les comptes Solana. Vous pouvez, et vous devriez, faire mieux pour une application en production.

Cela étant dit, créons une propriété statique `accounts` de type `web3.PublicKey[]`, une fonction statique `prefetchAccounts(connection: web3.Connection)` et une fonction statique `fetchPage(connection: web3.Connection, page: number, perPage: number): Promise<Movie[]>`. Vous devrez également importer `@solana/web3.js` et `Movie`.

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

La clé de la pagination est de précharger tous les comptes sans données. Remplissons le corps de `prefetchAccounts` pour le faire et définissons les clés publiques récupérées dans la propriété statique `accounts`.

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

Ensuite, remplissons la méthode `fetchPage`. Tout d'abord, si les comptes n'ont pas encore été préchargés, nous devons le faire. Ensuite, nous pouvons obtenir les clés publiques de compte correspondant à la page demandée et appeler `connection.getMultipleAccountsInfo`. Enfin, nous désérialisons les données de compte et retournons les objets `Movie` correspondants.

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

Une fois cela fait, nous pouvons reconfigurer `MovieList` pour utiliser ces méthodes. Dans `MovieList.tsx`, ajoutez `const [page, setPage] = useState(1)` près des appels existants à `useState`. Ensuite, mettez à jour `useEffect` pour appeler `MovieCoordinator.fetchPage` au lieu de récupérer les comptes en ligne.

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

Enfin, nous devons ajouter des boutons en bas de la liste pour naviguer entre les pages :

```tsx
return (
  <div>
    {
      movies.map((movie, i) => <Card key={i} movie={movie} /> )
    }
    <Center>
      <HStack w='full' mt={2} mb={8} ml={4} mr={4}>
        {
          page > 1 && <Button onClick={() => setPage(page - 1)}>Précédent</Button>
        }
        <Spacer />
        {
          MovieCoordinator.accounts.length > page * 2 &&
            <Button onClick={() => setPage(page + 1)}>Suivant</Button>
        }
      </HStack>
    </Center>
  </div>
)
```

À ce stade, vous devriez pouvoir exécuter le projet et cliquer entre les pages !

### 3. Trier les critiques par ordre alphabétique du titre

Si vous regardez les critiques, vous remarquerez peut-être qu'ils ne sont dans aucun ordre spécifique. Nous pouvons résoudre ce problème en ajoutant juste assez de données dans notre tranche de données pour nous aider à trier. Les différentes propriétés dans le tampon de données des critiques de film sont disposées comme suit :

- `initialized`, un entier non signé sur 8 bits ; 1 octet
- `rating`, un entier non signé sur 8 bits ; 1 octet
- `title`, une chaîne de caractères ; nombre d'octets inconnu
- `description`, une chaîne de caractères ; nombre d'octets inconnu

Sur cette base, le décalage que nous devons fournir à la tranche de données pour accéder à `title` est de 2. La longueur, cependant, est indéterminée, nous pouvons donc simplement fournir ce qui semble être une longueur raisonnable. Je vais rester sur 18 car cela couvrira la longueur de la plupart des titres sans récupérer trop de données à chaque fois.

Une fois que nous avons modifié la tranche de données dans `getProgramAccounts`, nous devons ensuite trier le tableau retourné. Pour ce faire, nous devons comparer la partie du tampon de données qui correspond réellement à `title`. Les 4 premiers octets d'un champ dynamique dans Borsh sont utilisés pour stocker la longueur du champ en octets. Ainsi, dans n'importe quel tampon donné `data` qui est découpé comme nous l'avons discuté ci-dessus, la partie de chaîne est `data.slice(4, 4 + data[0])`.

Maintenant que nous avons réfléchi à cela, modifions l'implémentation de `prefetchAccounts` dans `MovieCoordinator` :

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

Et c'est tout, vous devriez pouvoir exécuter l'application et voir la liste des critiques de film triés alphabétiquement.

### 4. Ajouter une recherche

La dernière chose que nous allons faire pour améliorer cette application est d'ajouter une capacité de recherche de base. Ajoutons un paramètre `search` à `prefetchAccounts` et reconfigurons le corps de la fonction pour l'utiliser.

Nous pouvons utiliser la propriété `filters` du paramètre `config` de `getProgramAccounts` pour filtrer les comptes par des données spécifiques. Le décalage vers les champs `title` est de 2, mais les 4 premiers octets sont la longueur du titre, donc le décalage réel vers la chaîne elle-même est de 6. N'oubliez pas que les octets doivent être codés en base 58, alors installons et importons `bs58`.

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

Ajoutez maintenant un paramètre `search` à `fetchPage` et mettez à jour son appel à `prefetchAccounts` pour le transmettre. Nous devrons également ajouter un paramètre booléen `reload` à `fetchPage` afin de pouvoir forcer un rafraîchissement du préchargement des comptes à chaque fois que la valeur de recherche change.

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

Avec cela en place, mettons à jour le code dans `MovieList` pour appeler correctement cette méthode.

Tout d'abord, ajoutez `const [search, setSearch] = useState('')` près des autres appels à `useState`. Ensuite, mettez à jour l'appel à `MovieCoordinator.fetchPage` dans `useEffect` pour passer le paramètre `search` et recharger lorsque `search !== ''`.

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

Enfin, ajoutez une barre de recherche qui définira la valeur de `search`.

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

Et c'est tout ! L'application dispose maintenant de critiques ordonnées, de pagination et de recherche.

C'était beaucoup à assimiler, mais vous y êtes arrivé. Si vous avez besoin de passer plus de temps avec les concepts, n'hésitez pas à relire les sections qui ont été les plus difficiles pour vous et/ou à consulter le [code solution](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-paging-account-data).

# Défi

Maintenant, c'est à votre tour d'essayer de faire cela par vous-même. En utilisant l'application d'introduction des étudiants de la leçon précédente, ajoutez la pagination, le classement alphabétique par nom et la recherche par nom.

![Screenshot du frontend de Student Intros](../assets/student-intros-frontend.png)

1. Vous pouvez construire cela à partir de zéro ou vous pouvez télécharger le [code de départ](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-deserialize-account-data).
2. Ajoutez la pagination au projet en préchargeant les comptes sans données, puis en ne récupérant les données de compte pour chaque compte que lorsque cela est nécessaire.
3. Triez les comptes affichés dans l'application par ordre alphabétique par nom.
4. Ajoutez la possibilité de rechercher des introductions par le nom d'un étudiant.

Ceci devrait être stimulant. Si vous êtes bloqué, n'hésitez pas à vous référer au [code solution](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-paging-account-data). Avec cela, vous terminez le Module 1 ! Quelle a été votre expérience ? N'hésitez pas à [partager un feedback rapide](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%201), afin que nous puissions continuer à améliorer le cours !

Comme toujours, soyez créatif avec ces défis et dépassez les instructions si vous le souhaitez !

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [et dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=9342ad0a-1741-41a5-9f68-662642c8ec93) !
---
title: Architecture de programme
objectives:
- Utiliser Box et Zero Copy pour travailler avec de grandes données onchain
- Prendre de meilleures décisions de conception PDA
- Préparer vos programmes pour l'avenir
- Gérer les problèmes de concurrence
---

# Résumé

- Si vos comptes de données sont trop grands pour la pile (Stack), enveloppez-les dans `Box` pour les allouer dans le tas (Heap)
- Utilisez Zero-Copy pour traiter les comptes trop grands pour `Box` (< 10 Mo)
- La taille et l'ordre des champs dans un compte sont importants; placez les champs de longueur variable à la fin
- Solana peut traiter en parallèle, mais vous pouvez toujours rencontrer des goulots d'étranglement; soyez conscient des comptes "partagés" que tous les utilisateurs interagissant avec le programme doivent écrire

# Aperçu général

L'architecture du programme est ce qui distingue l'amateur du professionnel. Créer des programmes performants a plus à voir avec la **conception** système qu'avec le code. Et vous, en tant que concepteur, devez penser à :

    1. Ce que votre code doit faire
    2. Quelles implémentations possibles existent
    3. Quels sont les compromis entre différentes implémentations

Ces questions sont encore plus importantes lors du développement pour une blockchain. Non seulement les ressources sont plus limitées que dans un environnement informatique typique, mais vous manipulez également les actifs des personnes ; le code a maintenant un coût.

Nous laisserons la plupart de la discussion sur la gestion des actifs aux [leçons de sécurité](./security-intro), mais il est important de noter la nature des limitations de ressources dans le développement Solana. Il existe bien sûr des limitations dans un environnement de développement typique, mais il existe des limitations uniques au développement blockchain et Solana, telles que la quantité de données pouvant être stockée dans un compte, le coût de stockage de ces données et le nombre d'unités de calcul disponibles par transaction. Vous, le concepteur du programme, devez être conscient de ces limitations pour créer des programmes abordables, rapides, sûrs et fonctionnels. Aujourd'hui, nous explorerons certaines des considérations plus avancées à prendre en compte lors de la création de programmes Solana.

## Gestion des Grands Comptes

Dans la programmation d'application moderne, nous n'avons pas souvent à nous soucier de la taille des structures de données que nous utilisons. Vous voulez créer une chaîne de caractères ? Vous pouvez lui imposer une limite de 4000 caractères si vous voulez éviter les abus, mais ce n'est probablement pas un problème. Vous voulez un entier ? Ils sont généralement toujours de 32 bits pour plus de commodité.

Dans les langages de haut niveau, vous êtes dans le pays des données abondantes ! Maintenant, dans le monde Solana, nous payons par octet stocké (loyer) et nous avons des limites sur la pile, le tas et la taille des comptes. Nous devons être un peu plus astucieux avec nos octets. Nous allons examiner deux préoccupations principales dans cette section :

1. Puisque nous payons par octet, nous voulons généralement réduire au maximum notre empreinte. Nous approfondirons l'optimisation dans une autre section, mais nous vous présenterons ici le concept des tailles de données.

2. Lorsque nous traitons des volumes de données plus importants, nous rencontrons des contraintes de [pile](https://docs.solana.com/developing/onchain-programs/faq#stack) et de [tas](https://docs.solana.com/developing/onchain-programs/faq#heap-size) - pour contourner cela, nous examinerons l'utilisation de Box et Zero-Copy.

### Tailles

Sur Solana, le payeur de frais d'une transaction paie pour chaque octet stocké onchain. Nous appelons cela le [loyer](https://docs.solana.com/developing/intro/rent). Notez que le loyer est un peu trompeur car il n'est jamais réellement prélevé de manière permanente. Une fois que vous déposez le loyer dans le compte, ces données peuvent y rester indéfiniment, ou vous pouvez récupérer le loyer si vous fermez le compte. Le loyer était autrefois une chose réelle, mais maintenant il y a une exemption minimale de loyer obligatoire. Vous pouvez en lire davantage dans [la documentation Solana](https://docs.solana.com/developing/intro/rent).

Mis à part l'étymologie du loyer, mettre des données sur la blockchain peut être coûteux. C'est pourquoi les attributs NFT et les fichiers associés, tels que l'image, sont stockés hors chaîne. Vous voulez finalement trouver un équilibre qui rend votre programme hautement fonctionnel sans devenir si coûteux que vos utilisateurs ne veulent pas payer pour ouvrir le compte de données.

La première chose que vous devez savoir avant de commencer à optimiser l'espace dans votre programme est la taille de chacune de vos structures. Voici une liste très utile du [Livre Anchor](https://book.anchor-lang.com/anchor_references/space.html).

| Types | Espace en octets | Détails/Exemple |
| --- | --- | --- |
| bool | 1 | ne nécessiterait qu'un seul bit mais utilise quand même 1 octet |
| u8/i8 | 1 | |
| u16/i16 | 2 | |
| u32/i32 | 4 | |
| u64/i64 | 8 | |
| u128/i128 | 16 | |
| [T;montant] | espace(T) * montant | par exemple, espace([u16;32]) = 2 * 32 = 64 |
| Pubkey | 32 | |
| Vec<T> | 4 + (espace(T) * montant) | La taille du compte est fixe, donc le compte doit être initialisé avec un espace suffisant dès le début |
| String | 4 + longueur de la chaîne en octets | La taille du compte est fixe, donc le compte doit être initialisé avec un espace suffisant dès le début |
| Option<T> | 1 + (espace(T)) | |
| Enum | 1 + Taille de la Variante la plus grande | par exemple, Enum { A, B { val: u8 }, C { val: u16 } } -> 1 + espace(u16) = 3 |
| f32 | 4 | la sérialisation échouera pour NaN |
| f64 | 8 | la sérialisation échouera pour NaN |
| Comptes | 8 + espace(T) | #[account()]
pub struct T { … |
| Structures de Données | espace(T) | #[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct T { … } |

En connaissant cela, commencez à réfléchir aux petites optimisations que vous pourriez apporter à un programme. Par exemple, si vous avez un champ entier qui n'atteindra jamais 100, n'utilisez pas u64/i64, utilisez plutôt u8. Pourquoi ? Parce qu'un u64 prend 8 octets, avec une valeur maximale de 2^64 ou 1,84 * 10^19. C'est du gaspillage d'espace puisque vous n'avez besoin que d'accueillir des nombres jusqu'à 100. Un seul octet vous donnera une valeur maximale de 255, ce qui serait suffisant dans ce cas. De même, il n'y a aucune raison d'utiliser i8 si vous n'aurez jamais de nombres négatifs.

Faites attention aux types de nombres petits, cependant. Vous pouvez rapidement rencontrer des comportements inattendus dus au débordement. Par exemple, un type u8 incrémenté de manière itérative atteindra 255, puis reviendra à 0 au lieu de 256. Pour un contexte plus concret, recherchez le **[bug de l'an 2000](https://www.nationalgeographic.org/encyclopedia/Y2K-bug/#:~:text=As%20the%20year%202000%20approached%2C%20computer%20programmers%20realized%20that%20computers,would%20be%20damaged%20or%20flawed.)**.

Si vous voulez en savoir plus sur les tailles Anchor, consultez [l'article de blog de Sec3 à ce sujet](https://www.sec3.dev/blog/all-about-anchor-account-size).

### Box

Maintenant que vous avez une petite idée des tailles de données, avançons et examinons un problème auquel vous serez confronté si vous voulez traiter des comptes de données plus importants. Disons que vous avez le compte de données suivant :

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

Si vous essayez de passer `SomeBigDataStruct` dans la fonction avec le contexte `SomeFunctionContext`, vous rencontrerez l'avertissement du compilateur suivant :

`// Stack offset of XXXX exceeded max offset of 4096 by XXXX bytes, please minimize large stack variables`

Et si vous essayez d'exécuter le programme, il restera bloqué et échouera.

Pourquoi cela ?

Cela a à voir avec la pile. Chaque fois que vous appelez une fonction dans Solana, elle obtient une trame de pile de 4 Ko. Il s'agit d'une allocation statique de mémoire pour les variables locales. C'est là que l'ensemble `SomeBigDataStruct` est stocké en mémoire et, comme 5000 octets, ou 5 Ko, sont supérieurs à la limite de 4 Ko, une erreur de pile sera générée. Alors, comment résoudre cela ?

La réponse est le type **`Box<T>`** !

```rust
#[account]
pub struct SomeBigDataStruct {
    pub big_data: [u8; 5000],
}  

#[derive(Accounts)]
pub struct SomeFunctionContext<'info> {
    pub some_big_data: Box<Account<'info, SomeBigDataStruct>>, // <- Box Added!
}
```

Dans Anchor, **`Box<T>`** est utilisé pour allouer le compte dans le tas (Heap), pas dans la pile. Ce qui est génial, car le tas nous donne 32 Ko avec lesquels travailler. Le meilleur, c'est que vous n'avez rien à faire de différent à l'intérieur de la fonction. Vous devez simplement ajouter `Box<…>` autour de tous vos gros comptes de données.

Mais Box n'est pas parfait. Vous pouvez toujours déborder la pile avec des comptes suffisamment grands. Nous verrons comment résoudre cela dans la section suivante.

### Zero Copy

D'accord, maintenant vous pouvez gérer des comptes de taille moyenne en utilisant `Box`. Mais que faire si vous devez utiliser des comptes vraiment grands avec comme taille maximale 10 Mo ? Prenez l'exemple suivant :

```rust
#[account]
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384 bytes
}
```

Ce compte fera échouer votre programme, même enveloppé dans un `Box`. Pour contourner cela, vous pouvez utiliser `zero_copy` et `AccountLoader`. Ajoutez simplement `zero_copy` à votre structure de compte, ajoutez `zero` en tant que contrainte dans la structure de validation du compte, et enveloppez le type de compte dans la structure de validation du compte dans un `AccountLoader`.

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

Pour comprendre ce qui se passe ici, consultez [la documentation Rust Anchor](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html)

> En plus d'être plus efficace, le principal avantage [zero_copy] est la capacité à définir des types de compte plus grands que la taille maximale de la pile ou du tas. Lors de l'utilisation de borsh, le compte doit être copié et désérialisé dans une nouvelle structure de données et est donc limité par les limites de la pile et du tas imposées par la VM BPF. Avec la désérialisation zéro copie, tous les octets du [`RefCell<&mut [u8]>`] de soutien du compte sont simplement réinterprétés comme une référence à la structure de données. Aucune allocation ou copie nécessaire. D'où la possibilité de contourner les limitations de la pile et du tas.

Essentiellement, votre programme ne charge jamais réellement les données du compte zero-copy dans la pile ou le tas. Il obtient plutôt un accès par pointeur aux données brutes. L'`AccountLoader` veille à ce que cela ne change pas trop la manière dont vous interagissez avec le compte depuis votre code.

Il y a quelques inconvénients à utiliser `zero_copy`. Tout d'abord, vous ne pouvez pas utiliser la contrainte `init` dans la structure de validation du compte comme vous pourriez en avoir l'habitude. Cela est dû à une limite de CPI sur les comptes de plus de 10 Ko.

```rust
pub struct ConceptZeroCopy<'info> {
    #[account(zero, init)] // <- Can't do this
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

À la place, votre client doit créer le grand compte et payer son loyer dans une instruction séparée.

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

Le deuxième inconvénient est que vous devrez appeler l'une des méthodes suivantes de l'intérieur de votre fonction d'instruction Rust pour charger le compte :

- `load_init` lorsque vous initialisez le compte pour la première fois (cela ignorera le discriminant de compte manquant qui est ajouté seulement après le code d'instruction de l'utilisateur)
- `load` lorsque le compte n'est pas mutable
- `load_mut` lorsque le compte est mutable

Par exemple, si vous vouliez initialiser et manipuler la `SomeReallyBigDataStruct` ci-dessus, vous appelleriez ce qui suit dans la fonction

```rust
let some_really_big_data = &mut ctx.accounts.some_really_big_data.load_init()?;
```

Après cela, vous pouvez traiter le compte comme d'habitude ! N'hésitez pas à expérimenter avec cela dans le code vous-même pour voir tout en action !

Pour une meilleure compréhension de tout cela, Solana a réalisé une très belle [vidéo](https://www.youtube.com/watch?v=zs_yU0IuJxc&feature=youtu.be) et un [code](https://github.com/solana-developers/anchor-zero-copy-example) expliquant Box et Zero-Copy dans Solana vanilla.


## Gestion des comptes

Maintenant que vous comprenez les tenants et aboutissants de la prise en compte de l'espace sur Solana, examinons quelques considérations de niveau supérieur. Sur Solana, tout est un compte, donc dans les sections suivantes, nous examinerons certains concepts d'architecture de compte.

### Ordre des données

Cette première considération est assez simple. En règle générale, placez tous les champs de longueur variable à la fin du compte. Jetez un œil à ce qui suit :

```rust
#[account] // Anchor masque le discriminateur du compte
pub struct BadState {
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
    pub id: u32         // 0xDEAD_BEEF
}
```

Le champ `flags` est de longueur variable. Cela rend la recherche d'un compte spécifique par le champ `id` très difficile, car une mise à jour des données dans `flags` change l'emplacement de `id` sur la carte mémoire.

Pour rendre cela plus clair, observez à quoi ressemble la donnée de ce compte sur la chaîne lorsque `flags` a quatre éléments dans le vecteur par rapport à huit éléments. Si vous appelez `solana account ACCOUNT_KEY`, vous obtiendrez un extrait de données comme suit :

```rust
0000:   74 e4 28 4e    d9 ec 31 0a  -> Discriminateur du compte Anchor (8)
0008:	04 00 00 00    11 22 33 44  -> Taille du vecteur Vec (4) | Données 4*(1)
0010:   DE AD BE EF                 -> id (4)

--- vs ---

0000:   74 e4 28 4e    d9 ec 31 0a  -> Discriminateur du compte Anchor (8)
0008:	08 00 00 00    11 22 33 44  -> Taille du vecteur Vec (8) | Données 4*(1)
0010:   55 66 77 88    DE AD BE EF  -> Données 4*(1) | id (4)
```

Dans les deux cas, les huit premiers octets sont le discriminateur du compte Anchor. Dans le premier cas, les quatre octets suivants représentent la taille du vecteur `flags`, suivis de quatre autres octets pour les données, et enfin les données du champ `id`.

Dans le deuxième cas, le champ `id` a été déplacé de l'adresse 0x0010 à 0x0014 car les données dans le champ `flags` ont pris quatre octets de plus.

Le principal problème ici est la recherche. Lorsque vous interrogez Solana, vous utilisez des filtres qui examinent les données brutes d'un compte. Ceux-ci sont appelés des filtres `memcmp`, ou filtres de comparaison de mémoire. Vous donnez au filtre un `offset` et des `bytes`, et le filtre regarde directement la mémoire, en se décalant à partir du début par l'`offset` que vous fournissez, et compare les octets en mémoire avec les `bytes` que vous fournissez.

Par exemple, vous savez que la structure `flags` commencera toujours à l'adresse 0x0008, car les huit premiers octets contiennent le discriminateur du compte. Interroger tous les comptes où la longueur de `flags` est égale à quatre est possible car nous *savons* que les quatre octets à 0x0008 représentent la longueur des données dans `flags`. Étant donné que le discriminateur du compte est

```typescript
const states = await program.account.badState.all([
  {memcmp: {
    offset: 8,
    bytes: bs58.encode([0x04])
  }}
]);
```

Cependant, si vous voulez interroger par `id`, vous ne sauriez pas quoi mettre pour l'`offset` car l'emplacement de `id` est variable en fonction de la longueur de `flags`. Cela ne semble pas très utile. Les identifiants sont généralement là pour aider aux requêtes ! La solution simple est d'inverser l'ordre.

```rust
#[account] // Anchor masque le discriminateur du compte
pub struct GoodState {
	pub id: u32         // 0xDEAD_BEEF
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
}
```

Avec les champs de longueur variable à la fin de la structure, vous pouvez toujours interroger les comptes en fonction de tous les champs jusqu'au premier champ de longueur variable. Pour répéter le début de cette section : En règle générale, placez toutes les structures de longueur variable à la fin du compte.

### Pour une utilisation future

Dans certains cas, envisagez d'ajouter des octets supplémentaires inutilisés à vos comptes. Ils sont réservés pour la flexibilité et la rétro-compatibilité. Prenons l'exemple suivant :

```rust
#[account]
pub struct GameState {
    pub health: u64,
    pub mana: u64,
    pub event_log: Vec<string>
}
```

Dans cet exemple simple d'état de jeu, un personnage a `health`, `mana`, et un journal d'événements. Si à un moment donné vous apportez des améliorations au jeu et souhaitez ajouter un champ `experience`, vous rencontrerez un problème. Le champ `experience` devrait être un nombre comme un `u64`, ce qui est assez simple à ajouter. Vous pouvez [reallocer le compte](./anchor-pdas.md#realloc) et ajouter de l'espace.

Cependant, pour maintenir des champs de longueur dynamique, comme `event_log`, à la fin de la structure, vous devriez effectuer une manipulation de mémoire sur tous les comptes reallocés pour déplacer l'emplacement de `event_log`. Cela peut être compliqué et rend les requêtes de comptes beaucoup plus difficiles. Vous vous retrouverez dans une situation où les comptes non migrés ont `event_log` à un endroit et les comptes migrés à un autre. L'ancien `GameState` sans `experience` et le nouveau `GameState` avec `experience` ne sont plus compatibles. Les anciens comptes ne seront pas sérialisés lorsqu'ils seront utilisés là où de nouveaux comptes sont attendus. Les requêtes seront bien plus difficiles. Vous devrez probablement créer un système de migration et une logique continue pour maintenir la compatibilité ascendante. En fin de compte, cela commence à sembler une mauvaise idée.

Heureusement, si vous anticipez, vous pouvez ajouter un champ `for_future_use` qui réserve quelques octets là où vous pensez en avoir le plus besoin.

```rust
#[account]
pub struct GameState { //V1
    pub health: u64,
    pub mana: u64,
	pub for_future_use: [u8; 128],
    pub event_log: Vec<string>
}
```

Ainsi, lorsque vous souhaitez ajouter `experience` ou quelque chose de similaire, cela ressemble à ceci et les anciens et nouveaux comptes sont compatibles.

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

Ces octets supplémentaires ajoutent au coût de l'utilisation de votre programme. Cependant, cela semble valoir largement la peine dans la plupart des cas.

Ainsi, en règle générale : chaque fois que vous pensez que vos types de compte ont le potentiel de changer d'une manière qui nécessitera une sorte de migration complexe, ajoutez quelques octets `for_future_use`.

### Optimisation des données

L'idée ici est d'être conscient des bits gaspillés. Par exemple, si vous avez un champ qui représente le mois de l'année, n'utilisez pas un `u64`. Il n'y aura jamais que 12 mois. Utilisez plutôt un `u8`. Mieux encore, utilisez une énumération `u8` et étiquetez les mois.

Pour être encore plus agressif sur l'économie de bits, soyez prudent avec les booléens. Regardez la structure ci-dessous composée de huit drapeaux booléens. Alors qu'un booléen *peut* être représenté par un seul bit, la désérialisation borsh allouera un octet entier à chacun de ces champs. Cela signifie que huit booléens occupent huit octets au lieu de huit bits, soit une augmentation de taille de huit fois.

```rust
#[account]
pub struct BadGameFlags { // 8 octets
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

Pour optimiser cela, vous pourriez avoir un seul champ en tant que `u8`. Ensuite, vous pouvez utiliser des opérations bit à bit pour examiner chaque bit et déterminer s'il est "activé" ou non.

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
pub struct GoodGameFlags { // 1 octet
    pub status_flags: u8, 
} 
```

Cela vous fait économiser 7 octets de données ! Le compromis, bien sûr, est que vous devez maintenant effectuer des opérations bit à bit. Mais cela vaut la peine de l'avoir dans votre boîte à outils.

### Indexation

Le dernier concept de compte est amusant et illustre la puissance des PDAs. Lors de la création de comptes de programme, vous pouvez spécifier les seeds utilisées pour dériver la PDA. C'est exceptionnellement puissant car cela vous permet de dériver vos adresses de compte plutôt que de les stocker.

Le meilleur exemple de ceci est le bon vieux compte associé de jetons (ATAs) !

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

C'est ainsi que la plupart de vos jetons SPL sont stockés. Plutôt que de conserver une table de base de données des adresses de compte de jetons SPL, la seule chose que vous devez savoir est l'adresse de votre portefeuille et l'adresse de la monnaie. L'adresse ATA peut être calculée en hachant ces dernières ensemble et voilà ! Vous avez l'adresse de votre compte de jetons.

En fonction du seeding, vous pouvez créer toutes sortes de relations :

- Un-par-programme (Compte global) - Si vous créez un compte avec une `seeds=[b"ONE PER PROGRAM"]` déterminée, un seul compte peut exister pour cette seed dans ce programme. Par exemple, si votre programme a besoin d'une table de recherche, vous pourriez le créer avec `seeds=[b"Lookup"]`. Veillez simplement à fournir des restrictions d'accès appropriées.
- Un-par-propriétaire - Disons que vous créez un compte de joueur de jeu vidéo et que vous voulez seulement un compte de joueur par portefeuille. Ensuite, vous pourriez créer le compte avec `seeds=[b"PLAYER", owner.key().as_ref()]`. De cette manière, vous saurez toujours où chercher le compte de joueur d'un portefeuille **et** il ne peut y en avoir qu'un.
- Plusieurs-par-propriétaire - D'accord, mais que faire si vous voulez plusieurs comptes par portefeuille ? Disons que vous voulez créer des épisodes de podcast. Ensuite, vous pourriez créer votre compte `Podcast` comme ceci : `seeds=[b"Podcast", owner.key().as_ref(), episode_number.to_be_bytes().as_ref()]`. Maintenant, si vous voulez rechercher l'épisode 50 d'un portefeuille spécifique, vous le pouvez ! Et vous pouvez avoir autant d'épisodes que vous le souhaitez par propriétaire.
- Un-par-propriétaire-par-compte - C'est effectivement l'exemple de l'ATA que nous avons vu précédemment. Où nous avons un compte de jetons par portefeuille et compte de monnaie. `seeds=[b"Mock ATA", owner.key().as_ref(), mint.key().as_ref()]`

À partir de là, vous pouvez mélanger et assortir de toutes sortes de manières intelligentes ! Mais la liste précédente devrait vous donner assez pour commencer.

Le grand avantage de prêter vraiment attention à cet aspect de la conception est de répondre au problème d'‘indexation’. Sans les PDAs et les seeds, tous les utilisateurs devraient garder une trace de toutes les adresses de tous les comptes qu'ils ont utilisés. Cela n'est pas faisable pour les utilisateurs, donc ils devraient dépendre d'une entité centralisée pour stocker leurs adresses dans une base de données. À bien des égards, cela va à l'encontre de l'objectif d'un réseau distribué à l'échelle mondiale. Les PDAs sont une bien meilleure solution.

Pour illustrer tout cela, voici un exemple d'un schéma d'un programme de podcasting en production. Le programme avait besoin des comptes suivants :

- **Compte de chaîne**
    - Nom
    - Épisodes créés (u64)
- **Compte de podcast(s)**
    - Nom
    - URL audio

Pour indexer correctement chaque adresse de compte, les comptes utilisent les seeds suivantes :

```rust
// Compte de chaîne
seeds=[b"Channel", owner.key().as_ref()]

// Compte de podcast
seeds=[b"Podcast", channel_account.key().as_ref(), episode_number.to_be_bytes().as_ref()]
```

Vous pouvez toujours trouver le compte de chaîne pour un propriétaire particulier. Et puisque la chaîne stocke le nombre d'épisodes créés, vous savez toujours la limite supérieure où rechercher des requêtes. De plus, vous savez toujours à quel index créer un nouvel épisode à : `index = episodes_created`.

```rust
Podcast 0: seeds=[b"Podcast", channel_account.key().as_ref(), 0.to_be_bytes().as_ref()] 
Podcast 1: seeds=[b"Podcast", channel_account.key().as_ref(), 1.to_be_bytes().as_ref()] 
Podcast 2: seeds=[b"Podcast", channel_account.key().as_ref(), 2.to_be_bytes().as_ref()] 
...
Podcast X: seeds=[b"Podcast", channel_account.key().as_ref(), X.to_be_bytes().as_ref()] 
```

## Gestion de la concurrence

L'une des principales raisons de choisir Solana pour votre environnement blockchain est son exécution parallèle des transactions. En d'autres termes, Solana peut exécuter des transactions en parallèle tant que celles-ci n'essaient pas d'écrire des données sur le même compte. Cela améliore le débit du programme dès le départ, mais avec une planification appropriée, vous pouvez éviter les problèmes de concurrence et vraiment améliorer les performances de votre programme.

### Comptes partagés

Si vous avez déjà été impliqué dans la cryptomonnaie depuis un certain temps, vous avez peut-être vécu un grand événement de création de NFT. Un nouveau projet NFT est en cours, tout le monde est vraiment excité, et puis la machine distributrice entre en action. C'est une course folle pour cliquer sur "accepter la transaction" aussi rapidement que possible. Si vous avez été astucieux, vous avez peut-être écrit un bot pour saisir les transactions plus rapidement que l'interface utilisateur du site web ne le permettait. Cette ruée vers la création crée de nombreuses transactions échouées. Mais pourquoi ? Parce que tout le monde essaie d'écrire des données sur le même compte de la machine distributrice.

Jetons un coup d'œil à un exemple simple :

Alice et Bob essaient de payer respectivement leurs amis Carol et Dean. Les quatre comptes changent, mais ne dépendent pas les uns des autres. Les deux transactions peuvent s'exécuter en même temps.

```rust
Alice -- paie --> Carol

Bob ---- paie --> Dean
```

Mais si Alice et Bob essaient tous les deux de payer Carol en même temps, ils rencontreront des problèmes.

```rust
Alice -- paie --> |
						-- > Carol
Bob   -- paie --- |
```

Étant donné que ces deux transactions écrivent sur le compte de jetons de Carol, une seule d'entre elles peut passer à la fois. Heureusement, Solana est extrêmement rapide, donc cela semblera probablement comme si elles étaient payées en même temps. Mais que se passe-t-il si plus que simplement Alice et Bob essaient de payer Carol ?

```rust
Alice -- paie --> |
						-- > Carol
x1000 -- paie --- | 
Bob   -- paie --- |
```

Que se passe-t-il si 1000 personnes essaient de payer Carol en même temps ? Chacune des 1000 instructions sera mise en file d'attente pour s'exécuter en séquence. Pour certaines d'entre elles, le paiement semblera avoir été effectué immédiatement. Ce seront les chanceux dont l'instruction a été incluse tôt. Mais pour d'autres, elles devront attendre un peu. Et pour certaines, leur transaction échouera tout simplement.

Bien qu'il semble improbable que 1000 personnes paient Carol en même temps, il est en réalité très courant d'avoir un événement, comme une création d'NFT, où de nombreuses personnes essaient d'écrire des données sur le même compte en même temps.

Imaginez que vous créez un programme très populaire et que vous souhaitez prélever des frais sur chaque transaction que vous traitez. Pour des raisons comptables, vous voulez que tous ces frais aillent à un seul portefeuille. Avec cette configuration, lors d'une hausse d'utilisateurs, votre protocole deviendra lent ou deviendra peu fiable. Pas génial. Alors quelle est la solution ? Séparez la transaction de données de la transaction de frais.

Par exemple, imaginez que vous ayez un compte de données appelé `DonationTally`. Sa seule fonction est d'enregistrer le montant que vous avez donné à un portefeuille communautaire codé en dur.

```rust
#[account]
pub struct DonationTally {
    is_initialized: bool,
    lamports_donated: u64,
    lamports_to_redeem: u64,
    owner: Pubkey,
}
```

Regardons d'abord la solution sous-optimale.

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

Vous pouvez voir que le transfert vers le `community_wallet` codé en dur se produit dans la même fonction que la mise à jour des informations de totalisation. C'est la solution la plus directe, mais si vous exécutez les tests pour cette section, vous verrez le ralentissement.

Maintenant, regardez la solution optimisée.

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

    // Diminuer le solde dans le compte donation_tally
    **ctx.accounts.donation_tally.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;

    // Augmenter le solde dans le compte community_wallet
    **ctx.accounts.community_wallet.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    // Réinitialiser lamports_donated et lamports_to_redeem
    ctx.accounts.donation_tally.lamports_to_redeem = 0;

    Ok(())
}
```

Ici, dans la fonction `run_concept_shared_account`, au lieu de transférer vers le goulot d'étranglement, nous transférons vers la PDA `donation_tally`. De cette manière, nous n'affectons que le compte du donateur et sa PDA - donc pas de goulot d'étranglement ! De plus, nous conservons une totalisation interne du nombre de lamports qui doivent être récupérés, c'est-à-dire transférés de la PDA au portefeuille communautaire ultérieurement. À un moment donné dans le futur, le portefeuille communautaire passera et récupérera tous les lamports traînants (probablement une bonne tâche pour [clockwork](https://www.clockwork.xyz/)). Il est important de noter que n'importe qui devrait pouvoir signer pour la fonction de récupération, car la PDA a la permission sur elle-même.

Si vous voulez éviter les goulets d'étranglement à tout prix, c'est une façon de le faire. En fin de compte, il s'agit d'une décision de conception et la solution plus simple, moins optimale, peut convenir à certains programmes. Mais si votre programme va avoir un trafic élevé, il vaut la peine d'essayer de l'optimiser. Vous pouvez toujours exécuter une simulation pour voir vos cas les pires, les meilleurs et les médians.

## Voyez-le en action

Tous les extraits de code de cette leçon font partie d'un [programme Solana que nous avons créé pour illustrer ces concepts](https://github.com/Unboxed-Software/advanced-program-architecture.git). Chaque concept est accompagné d'un programme et d'un fichier de test. Par exemple, le concept **Sizes** se trouve dans :

**programme -** `programs/architecture/src/concepts/sizes.rs`

**test -** `cd tests/sizes.ts`

Maintenant que vous avez lu chacun de ces concepts, n'hésitez pas à plonger dans le code pour expérimenter un peu. Vous pouvez modifier les valeurs existantes, essayer de casser le programme et essayer de comprendre comment tout fonctionne en général.

Vous pouvez forker et/ou cloner [ce programme depuis Github](https://github.com/Unboxed-Software/advanced-program-architecture.git) pour commencer. Avant de construire et d'exécuter la suite de tests, n'oubliez pas de mettre à jour `lib.rs` et `Anchor.toml` avec votre ID de programme local.

Vous pouvez exécuter l'ensemble de la suite de tests ou ajouter `.only` à l'appel `describe` dans un fichier de test spécifique pour ne lancer que les tests de ce fichier. N'hésitez pas à le personnaliser et à le rendre unique.

## Conclusion

Nous avons parlé de plusieurs considérations architecturales de programme : octets, comptes, goulots d'étranglement, et plus encore. Que vous rencontriez ou non l'une de ces considérations spécifiques, espérons que les exemples et les discussions ont suscité quelques réflexions. En fin de compte, vous êtes le concepteur de votre système. Votre travail consiste à peser le pour et le contre des différentes solutions. Soyez prévoyant, mais soyez pratique. Il n'y a pas "une bonne façon" de concevoir quoi que ce soit. Sachez simplement faire des compromis.

# Laboratoire

Utilisons tous ces concepts pour créer un moteur de jeu RPG simple mais optimisé sur Solana. Ce programme aura les fonctionnalités suivantes :
- Permet aux utilisateurs de créer un jeu (compte `Game`) et de devenir un "maître de jeu" (l'autorité sur le jeu).
- Les maîtres de jeu sont responsables de la configuration de leur jeu.
- Toute personne du public peut rejoindre un jeu en tant que joueur - chaque combinaison joueur/jeu aura un compte `Player`.
- Les joueurs peuvent engendrer et combattre des monstres (compte `Monster`) en dépensant des points d'action ; nous utiliserons des lamports comme points d'action.
- Les points d'action dépensés vont à la trésorerie d'un jeu telle que spécifiée dans le compte `Game`.

Nous examinerons les compromis des différentes décisions de conception au fur et à mesure pour vous donner une idée de pourquoi nous faisons les choses. Commençons !

### 1. Configuration du programme

Nous allons construire cela à partir de zéro. Commencez par créer un nouveau projet Anchor :

```powershell
anchor init rpg
```

Ensuite, remplacez l'ID du programme dans `programs/rpg/lib.rs` et `Anchor.toml` par l'ID du programme affiché lorsque vous exécutez `anchor keys list`.

Enfin, esquissons le programme dans le fichier `lib.rs`. Pour faciliter le suivi, nous allons tout garder dans un seul fichier. Nous allons augmenter cela avec des commentaires de section pour une meilleure organisation et navigation. Copiez ce qui suit dans votre fichier avant de commencer :

```rust
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};
use anchor_lang::solana_program::log::sol_log_compute_units;

declare_id!("VOTRE_CLÉ_ICI__VOTRE_CLÉ_ICI");

// ----------- COMPTES ----------

// ----------- CONFIGURATION DU JEU ----------

// ----------- STATUT ----------

// ----------- INVENTAIRE ----------

// ----------- AIDE ----------

// ----------- CRÉER UN JEU ----------

// ----------- CRÉER UN JOUEUR ----------

// ----------- ENGENDRER UN MONSTRE ----------

// ----------- ATTAQUER UN MONSTRE ----------

// ----------- RACHETER POUR LA TRÉSORERIE ----------

#[program]
pub mod rpg {
    use super::*;

}
```

### 2. Créer les structures de compte

Maintenant que notre configuration initiale est prête, créons nos comptes. Nous en aurons 3 :

1. `Game` - Ce compte représente et gère un jeu. Il inclut la trésorerie vers laquelle les participants au jeu envoient des points d'action et une structure de configuration que les maîtres de jeu peuvent utiliser pour personnaliser le jeu. Il devrait inclure les champs suivants :
    - `game_master` - effectivement le propriétaire/l'autorité
    - `treasury` - la trésorerie à laquelle les joueurs enverront des points d'action (nous utiliserons simplement des lamports pour les points d'action)
    - `action_points_collected` - suit le nombre de points d'action collectés par la trésorerie
    - `game_config` - une structure de configuration pour personnaliser le jeu
2. `Player` - Un compte PDA dont l'adresse est dérivée en utilisant l'adresse du compte du jeu et l'adresse du portefeuille du joueur en tant que seeds. Il a beaucoup de champs nécessaires pour suivre l'état du jeu du joueur :
    - `player` - la clé publique du joueur
    - `game` - l'adresse du compte de jeu correspondant
    - `action_points_spent` - le nombre de points d'action dépensés
    - `action_points_to_be_collected` - le nombre de points d'action qui doivent encore être collectés
    - `status_flag` - le statut du joueur           
    - `experience` - l'expérience du joueur
    - `kills` - le nombre de monstres tués
    - `next_monster_index` - l'indice du prochain monstre à affronter
    - `for_future_use` - 256 octets réservés pour une utilisation future
    - `inventory` - un vecteur de l'inventaire du joueur
3. `Monster` - Un compte PDA dont l'adresse est dérivée en utilisant l'adresse du compte du jeu, l'adresse du portefeuille du joueur et un indice (celui stocké en tant que `next_monster_index` dans le compte `Player`). 
    - `player` - le joueur auquel le monstre fait face
    - `game` - le jeu auquel le monstre est associé 
    - `hitpoints` - combien de points de vie il reste au monstre

Lorsqu'ils sont ajoutés au programme, les comptes devraient ressembler à ceci :

```rust
// ----------- COMPTES ----------
#[account]
pub struct Game { // 8 octets
    pub game_master: Pubkey,            // 32 octets
    pub treasury: Pubkey,               // 32 octets

    pub action_points_collected: u64,   // 8 octets
    
    pub game_config: GameConfig,
}

#[account]
pub struct Player { // 8 octets
    pub player: Pubkey,                 // 32 octets
    pub game: Pubkey,                   // 32 octets

    pub action_points_spent: u64,               // 8 octets
    pub action_points_to_be_collected: u64,     // 8 octets

    pub status_flag: u8,                // 8 octets
    pub experience: u64,                 // 8 octets
    pub kills: u64,                     // 8 octets
    pub next_monster_index: u64,        // 8 octets

    pub for_future_use: [u8; 256],      // Attaque/Vitesse/Défense/Santé/Mana ?? Métadonnées ??

    pub inventory: Vec<InventoryItem>,  // Max 8 items
}

#[account]
pub struct Monster { // 8 octets
    pub player: Pubkey,                 // 32 octets
    pub game: Pubkey,                   // 32 octets

    pub hitpoints: u64,                 // 8 octets
}
```

Il n'y a pas beaucoup de décisions de conception compliquées ici, mais parlons des champs `inventory` et `for_future_use` de la structure `Player`. Étant donné que l'inventaire a une longueur variable, nous avons décidé de le placer à la fin du compte pour faciliter les requêtes. Nous avons également décidé qu'il valait la peine de dépenser un peu plus d'argent en exemption de loyer pour avoir 256 octets d'espace réservé dans le champ `for_future_use`. Nous pourrions l'exclure et simplement réallouer des comptes si nous devons ajouter des champs à l'avenir, mais l'ajouter maintenant simplifie les choses pour nous dans le futur.

Si nous choisissons de réallouer à l'avenir, nous devrions écrire des requêtes plus complexes et ne pourrions probablement pas les interroger en un seul appel basé sur `inventory`. Réallouer et ajouter un champ déplacerait la position mémoire de `inventory`, nous obligeant à écrire une logique complexe pour interroger des comptes avec diverses structures.

### 3. Créer des types auxiliaires

La prochaine chose que nous devons faire est d'ajouter certains des types auxquels nos comptes font référence que nous n'avons pas encore créés.

Commençons par la structure de configuration du jeu. Techniquement, cela aurait pu aller dans le compte `Game`, mais il est agréable d'avoir une certaine séparation et encapsulation. Cette structure devrait stocker le nombre maximal d'objets autorisés par joueur et quelques octets réservés pour une utilisation future. Encore une fois, les octets pour une utilisation future ici nous aident à éviter la complexité à l'avenir. La réallocation de comptes fonctionne mieux lorsque vous ajoutez des champs à la fin d'un compte plutôt qu'au milieu. Si vous prévoyez d'ajouter des champs au milieu de données existantes, il pourrait avoir du sens d'ajouter quelques octets "d'utilisation future" à l'avance.

```rust
// ----------- CONFIGURATION DU JEU ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct GameConfig {
    pub max_items_per_player: u8,
    pub for_future_use: [u64; 16], // Santé des ennemis ?? Expérience par objet ?? Points d'action par action ??
}
```

Ensuite, créons nos drapeaux de statut. N'oubliez pas que nous *pourrions* stocker nos drapeaux en tant que booléens, mais nous économisons de l'espace en stockant plusieurs drapeaux dans un seul octet. Chaque drapeau occupe un bit différent dans l'octet. Nous pouvons utiliser l'opérateur `<<` pour placer `1` dans le bon bit.

```rust
// ----------- STATUT ----------

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

Enfin, créons notre `InventoryItem`. Celui-ci devrait avoir des champs pour le nom de l'objet, la quantité et quelques octets réservés pour une utilisation future.

```rust
// ----------- INVENTAIRE ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InventoryItem {
    pub name: [u8; 32], // Nom fixe jusqu'à 32 octets
    pub amount: u64,
    pub for_future_use: [u8; 128], // Métadonnées ?? Effets // Drapeaux ??
}
```

### 4. Créer une fonction d'aide pour dépenser des points d'action

La dernière chose que nous ferons avant d'écrire les instructions du programme est de créer une fonction d'aide pour dépenser des points d'action. Les joueurs enverront des points d'action (lamports) à la trésorerie en tant que paiement pour effectuer des actions dans le jeu.

Étant donné que l'envoi de lamports à une trésorerie nécessite d'écrire des données dans ce compte de trésorerie, nous pourrions facilement nous retrouver avec un goulot d'étranglement de performance si de nombreux joueurs essaient d'écrire simultanément dans la même trésorerie (voir [Gérer la concurrence](#dealing-with-concurrency)).

À la place, nous les enverrons au compte PDA du joueur et créerons une instruction qui enverra les lamports de ce compte à la trésorerie en une seule fois. Cela élimine tout problème de concurrence puisque chaque joueur a son propre compte, mais permet également au programme de récupérer ces lamports à tout moment.

```rust
// ----------- AIDE ----------

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

    msg!("Moins {} points d'action", action_points);

    Ok(())
}
```

### 5. Créer le Jeu

Notre première instruction va créer le compte `game`. Tout le monde peut être un `game_master` et créer son propre jeu, mais une fois qu'un jeu est créé, il y a certaines contraintes.

Tout d'abord, le compte `game` est une PDA utilisant son portefeuille `treasury`. Cela garantit que le même `game_master` peut exécuter plusieurs jeux s'ils utilisent un trésor différent pour chacun.

Notez également que le `treasury` est un signataire de l'instruction. Cela garantit que la personne qui crée le jeu possède les clés privées du `treasury`. Il s'agit d'une décision de conception plutôt que d'une "bonne manière". En fin de compte, c'est une mesure de sécurité pour garantir que le maître du jeu pourra récupérer ses fonds.

```rust
// ----------- CRÉER LE JEU ----------

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

    /// CHECK : Doit savoir qu'il possède le trésor
    pub treasury: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn run_create_game(ctx: Context<CreateGame>, max_items_per_player: u8) -> Result<()> {

    ctx.accounts.game.game_master = ctx.accounts.game_master.key().clone();
    ctx.accounts.game.treasury = ctx.accounts.treasury.key().clone();

    ctx.accounts.game.action_points_collected = 0;
    ctx.accounts.game.game_config.max_items_per_player = max_items_per_player;

    msg!("Jeu créé !");

    Ok(())
}
```

### 6. Créer le Joueur

Notre deuxième instruction va créer le compte `player`. Il y a trois compromis à noter concernant cette instruction :

1. Le compte joueur est a une PDA dérivée en utilisant les portefeuilles `game` et `player`. Cela permet aux joueurs de participer à plusieurs jeux mais d'avoir un seul compte joueur par jeu.
2. Nous enveloppons le compte `game` dans une `Box` pour le placer sur le tas, nous assurant de ne pas dépasser la pile.
3. La première action que tout joueur effectue est de se créer, donc nous appelons `spend_action_points`. Pour l'instant, nous codons en dur `action_points_to_spend` à 100 lamports, mais cela pourrait être ajouté à la configuration du jeu à l'avenir.

```rust
// ----------- CRÉER LE JOUEUR ----------
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

    msg!("Le héros est entré dans le jeu !");

    {   // Dépenser 100 lamports pour créer le joueur
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

### 7. Faire apparaître le Monstre

Maintenant que nous avons un moyen de créer des joueurs, nous avons besoin d'un moyen de faire apparaître des monstres pour qu'ils les combattent. Cette instruction va créer un nouveau compte `Monster` dont l'adresse est une PDA dérivée avec le compte `game`, le compte `player`, et un index représentant le nombre de monstres auxquels le joueur a été confronté. Il y a deux décisions de conception dont nous devrions parler ici :
1. Les seeds PDA nous permettent de suivre tous les monstres qu'un joueur a créés.
2. Nous enveloppons à la fois les comptes `game` et `player` dans `Box` pour les allouer à la mémoire heap.

```rust
// ----------- FAIRE APPARAÎTRE LE MONSTRE ----------
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

        msg!("Monstre apparu !");
    }

    {
        ctx.accounts.player_account.next_monster_index = ctx.accounts.player_account.next_monster_index.checked_add(1).unwrap();
    }

    {   // Dépenser 5 lamports pour faire apparaître le monstre
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

### 8. Attaquer le Monstre

Maintenant ! Attaquons ces monstres et commençons à gagner de l'expérience !

La logique ici est la suivante :
- Les joueurs dépensent 1 `action_point` pour attaquer et gagnent 1 `experience`
- Si le joueur tue le monstre, son compteur de `kill` augmente

En ce qui concerne les décisions de conception, nous avons enveloppé chacun des comptes rpg dans une `Box` pour les allouer à la mémoire heap. De plus, nous avons utilisé `saturating_add` lors de l'incrémentation de l'expérience et des kills.

La fonction `saturating_add` garantit que le nombre ne débordera jamais. Disons que le nombre de `kills` était un u8 et que mon nombre actuel de kills était de 255 (0xFF). Si je tuais un autre monstre et ajoutais normalement, par exemple `255 + 1 = 0 (0xFF + 0x01 = 0x00) = 0`, le nombre de kills finirait par être 0. `saturating_add` le maintiendra à sa valeur maximale s'il est sur le point de déborder, donc `255 + 1 = 255`. La fonction `checked_add` jettera une erreur s'il est sur le point de déborder. Gardez cela à l'esprit lors de vos calculs en Rust. Même si `kills` est un u64 et ne débordera jamais avec sa programmation actuelle, il est bon de pratiquer des mathématiques sûres et de considérer les débordements.

```rust
// ----------- ATTAQUER LE MONSTRE ----------
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
            msg!("Dégâts infligés : {}", damage_dealt);
        } else {
            msg!("Arrêtez, il est déjà mort !");
        }
    }

    {
        ctx.accounts.player_account.experience = ctx.accounts.player_account.experience.saturating_add(1);
        msg!("+1 EXP");

        if did_kill {
            ctx.accounts.player_account.kills = ctx.accounts.player_account.kills.saturating_add(1);
            msg!("Vous avez tué le monstre !");
        }
    }

    {   // Dépenser 1 lamport pour attaquer le monstre
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

### Collecte vers le Trésor

Ceci est notre dernière instruction. Cette instruction permet à quiconque d'envoyer les `action_points` dépensés vers le portefeuille `treasury`.

Encore une fois, encadrons les comptes RPG et utilisons une arithmétique sécurisée.

```rust
// ----------- COLLECTE VERS LE TRÉSOR ----------
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
    /// CHECK : Elle est vérifiée dans le compte du jeu
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// Quiconque paie les frais de transaction peut exécuter cette commande - donnez-la à un bot programmé
pub fn run_collect_action_points(ctx: Context<CollectActionPoints>) -> Result<()> {
    let transfer_amount: u64 = ctx.accounts.player.action_points_to_be_collected;

    **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
    **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    ctx.accounts.player.action_points_to_be_collected = 0;

    ctx.accounts.game.action_points_collected = ctx.accounts.game.action_points_collected.checked_add(transfer_amount).unwrap();

    msg!("Le trésor a collecté {} points d'action vers le trésor", transfer_amount);

    Ok(())
}
```

### Mise en œuvre globale

Maintenant que toute notre logique d'instruction est écrite, ajoutons ces fonctions à des instructions réelles dans le programme. Il peut également être utile de consigner les unités de calcul pour chaque instruction.

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

Si vous avez ajouté toutes les sections correctement, vous devriez pouvoir construire avec succès.

```shell
anchor build
```

### Tests

Maintenant, voyons cette fonctionnalité en action !

Mettez en place le fichier `tests/rpg.ts`. Nous remplirons chaque test tour à tour. Mais d'abord, nous devons configurer quelques comptes différents, notamment `gameMaster` et `treasury`.

```tsx
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rpg, IDL } from "../target/types/rpg";
import { assert } from "chai";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("RPG", () => {
  // Configurez le client pour utiliser le cluster local.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Rpg as Program<Rpg>;
  const wallet = anchor.workspace.Rpg.provider.wallet
    .payer as anchor.web3.Keypair;
  const gameMaster = wallet;
  const player = wallet;

  const treasury = anchor.web3.Keypair.generate();

  it("Create Game", async () => {});

  it("Create Player", async () => {});

  it("Spawn Monster", async () => {});

  it("Attack Monster", async () => {});

  it("Deposit Action Points", async () => {});

});
```

Ajoutons maintenant le test `Create Game`. Appelez simplement `createGame` avec huit éléments, assurez-vous de transmettre tous les comptes et assurez-vous que le compte `treasury` signe la transaction.

```tsx
it("Create Game", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const txHash = await program.methods
      .createGame(
        8, // 8 Items par joueur
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

    // Affichez si vous le souhaitez
    // const account = await program.account.game.fetch(gameKey);

  });
```

Continuez et vérifiez que votre test s'exécute :

```tsx
yarn install
anchor test
```

**Solution de contournement astucieuse :** Si, pour une raison quelconque, la commande `yarn install` produit des fichiers `.pnp.*` et aucun `node_modules`, vous voudrez peut-être appeler `rm -rf .pnp.*` suivi de `npm i`, puis `yarn install`. Cela devrait fonctionner.

Maintenant que tout fonctionne, implémentons les tests `Create Player`, `Spawn Monster` et `Attack Monster`. Exécutez chaque test au fur et à mesure que vous les terminez pour vous assurer que tout se déroule sans problème.

```typescript
it("Create Player", async () => {
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

    // Affichez si vous le souhaitez
    // const account = await program.account.player.fetch(playerKey);

});

it("Spawn Monster", async () => {
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

    // Affichez si vous le souhaitez
    // const account = await program.account.monster.fetch(monsterKey);

});

it("Attack Monster", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // Récupérer le dernier monstre créé
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

    // Affichez si vous le souhaitez
    // const account = await program.account.monster.fetch(monsterKey);

    const monsterAccount = await program.account.monster.fetch(monsterKey);
    assert(monsterAccount.hitpoints.eqn(99));
});
```

Remarquez que le monstre que nous choisissons d'attaquer est `playerAccount.nextMonsterIndex.subn(1).toBuffer('le', 8)`. Cela nous permet d'attaquer le monstre le plus récent apparu. Tout ce qui est inférieur à `nextMonsterIndex` devrait être correct. Enfin, comme les seeds sont simplement un tableau d'octets, nous devons convertir l'index en u64, qui est en little endian (`le`) sur 8 octets.

Exécutez `anchor test` pour infliger des dégâts !

Enfin, écrivons un test pour collecter tous les points d'action déposés. Ce test peut sembler complexe pour ce qu'il fait. C'est parce que nous générons de nouveaux comptes pour montrer que n'importe qui pourrait appeler la fonction de rachat `depositActionPoints`. Nous utilisons des noms comme `clockwork` pour ceux-ci parce que si ce jeu fonctionnait en continu, il aurait probablement du sens d'utiliser quelque chose comme des tâches cron [clockwork](https://www.clockwork.xyz/).

```tsx
it("Deposit Action Points", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // Pour montrer que n'importe qui peut déposer les points d'action
    // I.e., donnez cela à un bot programmé
    const clockworkWallet = anchor.web3.Keypair.generate();

    // Pour lui donner un solde initial
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

    // Il faut donner quelques lamports aux comptes sinon la transaction échouera
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

    const expectedActionPoints = 100 + 5 + 1; // Création du joueur (100) + Apparition du monstre (5) + Attaque du monstre (1)
    const treasuryBalance = await program.provider.connection.getBalance(treasury.publicKey);
    assert(
        treasuryBalance == 
        (amountToInitialize + expectedActionPoints) // Création du joueur (100) + Apparition du monstre (5) + Attaque du monstre (1)
    );

    const gameAccount = await program.account.game.fetch(gameKey);
    assert(gameAccount.actionPointsCollected.eqn(expectedActionPoints));

    const playerAccount = await program.account.player.fetch(playerKey);
    assert(playerAccount.actionPointsSpent.eqn(expectedActionPoints));
    assert(playerAccount.actionPointsToBeCollected.eqn(0));

});
```

Enfin, exécutez `anchor test` pour vérifier que tout fonctionne correctement.

Félicitations ! C'était beaucoup de chose à couvrir, mais vous disposez désormais d'un mini moteur de jeu RPG. Si les choses ne fonctionnent pas tout à fait, revenez en arrière dans le laboratoire et repérez où vous avez commis une erreur. Si nécessaire, vous pouvez vous référer à la [branche principale du code de la solution](https://github.com/Unboxed-Software/anchor-rpg).

Assurez-vous de mettre en pratique ces concepts dans vos propres programmes. Chaque petite optimisation compte !

# Défi

Maintenant, c'est à votre tour de pratiquer de manière indépendante. Parcourez le code du laboratoire à la recherche d'optimisations supplémentaires et/ou d'extensions que vous pourriez apporter. Réfléchissez aux nouveaux systèmes et fonctionnalités que vous ajouterez et à la manière dont vous les optimiserez.

Vous pouvez trouver quelques modifications d'exemple sur la branche `challenge-solution` du [dépôt RPG](https://github.com/Unboxed-Software/anchor-rpg/tree/challenge-solution).

Enfin, parcourez l'un de vos propres programmes et réfléchissez aux optimisations que vous pouvez apporter pour améliorer la gestion de la mémoire, la taille du stockage et/ou la concurrence.

## Vous avez fini le laboratoire ?

Publiez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=4a628916-91f5-46a9-8eb0-6ba453aa6ca6) !
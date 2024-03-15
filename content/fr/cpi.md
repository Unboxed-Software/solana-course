---
title: Les Invocations Inter-Programme
objectives:
- Expliquer les invocations inter-programme (CPI)
- Décrire la construction et l'utilisation des CPI
- Expliquer comment un programme fournit une signature pour une PDA
- Eviter les pièges communs et déboguer les erreurs communes avec les CPI
---

# Résumé

- Une **Invocation Inter-programme (CPI)** est un appel d'un programme à un autre, ciblant une instruction spécifique sur le programme appelé.
- Les CPI sont réalisées à l'aide des commandes `invoke` ou `invoke_signed`, cette dernière étant utilisée par les programmes pour fournir des signatures aux PDA qu'ils possèdent.
- Les CPI rendent les programmes dans l'écosystème Solana complètement interopérables car toutes les instructions publiques d'un programme peuvent être invoquées par un autre programme via une CPI.
- Étant donné que nous n'avons aucun contrôle sur les comptes et les données soumis à un programme, il est important de vérifier tous les paramètres transmis à une CPI pour garantir la sécurité du programme.

# Aperçu général

## Qu'est-ce qu'une CPI ?

Une Invocation Inter-programme (CPI) est un appel direct d'un programme à un autre. Tout comme n'importe quel client peut appeler n'importe quel programme en utilisant le JSON RPC, tout programme peut appeler n'importe quel autre programme directement. Le seul prérequis pour invoquer une instruction sur un autre programme depuis votre programme est que vous construisiez correctement l'instruction. Vous pouvez effectuer des CPI vers des programmes natifs, d'autres programmes que vous avez créés et des programmes tiers. Les CPI transforment essentiellement tout l'écosystème Solana en une seule API géante qui est à votre disposition en tant que développeur.

Les CPI ont une composition similaire aux instructions que vous avez l'habitude de créer côté client. Il y a quelques subtilités et différences selon que vous utilisez `invoke` ou `invoke_signed`. Nous couvrirons les deux plus tard dans cette leçon.

## Comment réaliser une CPI

Les CPI sont réalisées à l'aide de la fonction [`invoke`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke.html) ou [`invoke_signed`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke_signed.html) de la crate `solana_program`. Vous utilisez `invoke` pour essentiellement transmettre la signature de transaction originale qui a été transmise à votre programme. Vous utilisez `invoke_signed` pour que votre programme "signe" pour ses PDA.

```rust
// Utilisé lorsqu'il n'y a pas besoin de signatures pour les PDA
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult

// Utilisé lorsqu'un programme doit fournir une 'signature' pour une PDA, d'où le paramètre signer_seeds
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

Les CPI étendent les privilèges de l'appelant au destinataire. Si l'instruction que le programme destinataire traite contient un compte qui a été marqué comme un signataire ou modifiable lorsqu'il a été passé initialement au programme appelant, alors il sera considéré comme un compte signataire ou modifiable dans le programme invoqué également.

Il est important de noter que c'est vous, en tant que développeur, qui décidez quels comptes passer dans la CPI. Vous pouvez penser à une CPI comme à la construction d'une autre instruction à partir de zéro avec uniquement les informations qui ont été transmises à votre programme.

### CPI avec `invoke`

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &account_infos[account1.clone(), account2.clone(), account3.clone()],
)?;
```

- `program_id` - la clé publique du programme que vous allez invoquer
- `account` - une liste de métadonnées de compte sous forme de vecteur. Vous devez inclure chaque compte que le programme invoqué lira ou écrira
- `data` - une mémoire tampon d'octets représentant les données transmises au programme destinataire sous forme de vecteur

Le type `Instruction` a la définition suivante :

```rust
pub struct Instruction {
    pub program_id: Pubkey,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
}
```

Selon le programme que vous appelez, il peut y avoir une crate disponible avec des fonctions d'aide pour créer l'objet `Instruction`. De nombreuses personnes et organisations créent des crates disponibles publiquement avec leurs programmes qui exposent ce type de fonctions pour simplifier l'appel de leurs programmes. Cela est similaire aux bibliothèques Typescript que nous avons utilisées dans ce cours (par exemple, [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/), [@solana/spl-token](https://solana-labs.github.io/solana-program-library/token/js/)).
Dans tous les autres cas, vous devrez créer l'instance `Instruction` à partir de zéro.

Bien que le champ `program_id` soit assez simple, les champs `accounts` et `data` nécessitent quelques explications.

Les champs `accounts` et `data` sont tous deux de type `Vec`, ou vecteur. Vous pouvez utiliser la macro [`vec`](https://doc.rust-lang.org/std/macro.vec.html) pour construire un vecteur en utilisant la notation de tableau, comme ceci :

```rust
let v = vec![1, 2, 3];
assert_eq!(v[0], 1);
assert_eq!(v[1], 2);
assert_eq!(v[2], 3);
```


Le champ `accounts` de la structure `Instruction` attend un vecteur de type [`AccountMeta`](https://docs.rs/solana-program/latest/solana_program/instruction/struct.AccountMeta.html). La structure `AccountMeta` a la définition suivante :


```rust
pub struct AccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}
```

En mettant ces deux éléments ensemble, cela ressemble à ceci :

```rust
use solana_program::instruction::AccountMeta;

vec![
    AccountMeta::new(account1_pubkey, true), // métadonnées pour un compte modifiable et signataire
    AccountMeta::read_only(account2_pubkey, false), // métadonnées pour un compte non modifiable et non signataire
    AccountMeta::read_only(account3_pubkey, true), // métadonnées pour un compte non modifiable et signataire
    AccountMeta::new(account4_pubkey, false), // métadonnées pour un compte modifiable et non signataire
]
```

Le champ final de l'objet `instruction` est les données, sous forme de mémoire tampon d'octets bien sûr. Vous pouvez créer une mémoire tampon d'octets en Rust en utilisant à nouveau la macro `vec`, qui a une fonction implémentée vous permettant de créer un vecteur d'une certaine longueur. Une fois que vous avez initialisé un vecteur vide, vous construiriez la mémoire tampon d'octets de manière similaire à celle que vous utiliseriez côté client. Déterminez les données requises par le programme destinataire et le format de sérialisation utilisé, puis écrivez votre code en conséquence. N'hésitez pas à vous renseigner sur certaines des [fonctionnalités de la macro `vec` disponibles pour vous ici](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#).

```rust
let mut vec = Vec::with_capacity(3);
vec.push(1);
vec.push(2);
vec.extend_from_slice(&number_variable.to_le_bytes());
```

La méthode [`extend_from_slice`](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#method.extend_from_slice) est probablement nouvelle pour vous. C'est une méthode sur les vecteurs qui prend une tranche en entrée, itère sur la tranche, clone chaque élément, puis l'ajoute au `Vec`.

### Passer une liste de comptes

En plus de l'instruction, à la fois `invoke` et `invoke_signed` nécessitent également une liste d'objets `account_info`. Tout comme la liste d'objets `AccountMeta` que vous avez ajoutée à l'instruction, vous devez inclure tous les comptes que le programme que vous appelez lira ou écrira.

Au moment où vous effectuez une CPI dans votre programme, vous devriez déjà avoir récupéré tous les objets `account_info` qui ont été transmis à votre programme et les avoir stockés dans des variables. Vous construirez votre liste d'objets `account_info` pour la CPI en choisissant quels comptes copier et envoyer.

Vous pouvez copier chaque objet `account_info` dont vous avez besoin pour passer dans la CPI en utilisant le trait [`Clone`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html#impl-Clone) qui est implémenté sur la structure `account_info` dans le crate `solana_program`. Ce trait `Clone` renvoie une copie de l'instance [`account_info`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html).

```rust
&[first_account.clone(), second_account.clone(), third_account.clone()]
```

### CPI avec `invoke`

Avec à la fois l'instruction et la liste de comptes créées, vous pouvez effectuer un appel à `invoke`.

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &[account1.clone(), account2.clone(), account3.clone()],
)?;
```

Il n'est pas nécessaire d'inclure une signature car le runtime Solana transmet la signature originale transmise à votre programme. Rappelez-vous, `invoke` ne fonctionnera pas si une signature est requise au nom d'une PDA. Pour cela, vous devrez utiliser `invoke_signed`.

### CPI avec `invoke_signed`

L'utilisation de `invoke_signed` est un peu différente simplement parce qu'il y a un champ supplémentaire qui a besoin des seeds utilisées pour dériver les PDA qui doivent signer la transaction. Vous vous souvenez peut-être des leçons précédentes que les PDA ne se trouvent pas sur la courbe Ed25519 et, par conséquent, n'ont pas de clé secrète correspondante. Vous avez été informé que les programmes peuvent fournir des signatures pour leurs PDA, mais vous n'avez pas appris comment cela se passe réellement - jusqu'à maintenant. Les programmes fournissent des signatures pour leurs PDA avec la fonction `invoke_signed`. Les deux premiers champs de `invoke_signed` sont les mêmes que `invoke`, mais il y a un champ supplémentaire `signers_seeds` qui entre en jeu ici.

```rust
invoke_signed(
    &instruction,
    accounts,
    &[&["First addresses seed"],
        &["Second addresses first seed",
        "Second addresses second seed"]],
)?;
```

Bien que les PDA n'aient pas de clés secrètes propres, elles peuvent être utilisées par un programme pour émettre une instruction qui inclut la PDA comme signataire. La seule façon pour le runtime de vérifier que la PDA appartient au programme appelant est que le programme appelant fournisse les seeds utilisées pour générer l'adresse dans le champ `signers_seeds`.

Le runtime Solana appellera internalement [`create_program_address`](https://docs.rs/solana-program/1.4.4/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) en utilisant les seeds fournies et le `program_id` du programme appelant. Il peut ensuite comparer le résultat avec les adresses fournies dans l'instruction. Si l'une des adresses correspond, alors le runtime sait que le programme associé à cette adresse est l'appelant et est donc autorisé à être un signataire.

## Meilleures pratiques et erreurs courantes

### Contrôles de sécurité

Il y a quelques erreurs courantes et choses à se rappeler lors de l'utilisation de CPI qui sont importantes pour la sécurité et la robustesse de votre programme. La première chose à retenir est que, comme nous le savons maintenant, nous n'avons aucun contrôle sur les informations transmises à nos programmes. Pour cette raison, il est important de toujours vérifier le `program_id`, les comptes et les données transmises à la CPI. Sans ces contrôles de sécurité, quelqu'un pourrait soumettre une transaction qui invoque une instruction sur un programme complètement différent de celui qui était prévu, ce qui n'est pas idéal.

Heureusement, il y a des vérifications inhérentes sur la validité de toute PDA marquée comme signataire dans la fonction `invoke_signed`. Tous les autres comptes et `instruction_data` doivent être vérifiés quelque part dans le code de votre programme avant de faire la CPI. Il est également important de s'assurer que vous ciblez l'instruction prévue sur le programme que vous invoquez. La manière la plus simple de le faire est de lire le code source du programme que vous allez invoquer, tout comme vous le feriez si vous construisiez une instruction côté client.

### Erreurs courantes

Il existe quelques erreurs courantes que vous pourriez rencontrer lors de l'exécution d'une CPI, elles signifient généralement que vous construisez la CPI avec des informations incorrectes. Par exemple, vous pouvez rencontrer un message d'erreur similaire à celui-ci :

```text
EF1M4SPfKcchb6scq297y8FPCaLvj5kGjwMzjTM68wjA's signer privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Ce message est un peu trompeur, car "signer privilege escalated" ne semble pas être un problème, mais en réalité, cela signifie que vous signez incorrectement pour l'adresse dans le message. Si vous utilisez `invoke_signed` et que vous recevez cette erreur, cela signifie probablement que les seeds que vous fournissez sont incorrectes. Vous pouvez également trouver [un exemple de transaction ayant échoué avec cette erreur](https://explorer.solana.com/tx/3mxbShkerH9ZV1rMmvDfaAhLhJJqrmMjcsWzanjkARjBQurhf4dounrDCUkGunH1p9M4jEwef9parueyHVw6r2Et?cluster=devnet).

Une autre erreur similaire est déclenchée lorsqu'un compte qui est écrit n'est pas marqué comme `modifiable` à l'intérieur de la structure `AccountMeta`.

```text
2qoeXa9fo8xVHzd2h9mVcueh6oK3zmAiJxCTySM5rbLZ's writable privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

N'oubliez pas, tout compte dont les données peuvent être modifiées par le programme pendant l'exécution doit être spécifié comme modifiable. Pendant l'exécution, écrire dans un compte qui n'a pas été spécifié comme modifiable entraînera l'échec de la transaction. Écrire dans un compte qui n'est pas détenu par le programme entraînera l'échec de la transaction. Tout compte dont le solde lamport peut être modifié par le programme pendant l'exécution doit être spécifié comme modifiable. Pendant l'exécution, la mutation des lamports d'un compte qui n'a pas été spécifié comme modifiable entraînera l'échec de la transaction. Bien que la soustraction de lamports d'un compte non détenu par le programme entraînera l'échec de la transaction, l'ajout de lamports à n'importe quel compte est autorisé, tant qu'il est mutable.

Pour voir cela en action, consultez cette [transaction dans l'explorateur](https://explorer.solana.com/tx/ExB9YQJiSzTZDBqx4itPaa4TpT8VK4Adk7GU5pSoGEzNz9fa7PPZsUxssHGrBbJRnCvhoKgLCWnAycFB7VYDbBg?cluster=devnet).

## Pourquoi les CPI sont-elles importantes ?

Les CPI sont une fonctionnalité très importante de l'écosystème Solana et elles rendent tous les programmes déployés interopérables les uns avec les autres. Avec les CPI, il n'est pas nécessaire de réinventer la roue en matière de développement. Cela crée l'opportunité de construire de nouveaux protocoles et applications sur ce qui a déjà été construit, tout comme des blocs de construction ou des briques Lego. Il est important de se rappeler que les CPI sont une rue à double sens et il en va de même pour tous les programmes que vous déployez ! Si vous construisez quelque chose de cool et utile, les développeurs ont la possibilité de construire dessus ou simplement brancher votre protocole dans ce qu'ils construisent. La composabilité est une grande partie de ce qui rend la crypto si unique et les CPI sont ce qui rend cela possible sur Solana.

Un autre aspect important des CPI est qu'elles permettent aux programmes de signer pour leurs PDA. Comme vous l'avez probablement remarqué jusqu'à présent, les PDA sont très fréquemment utilisés dans le développement Solana car ils permettent aux programmes de contrôler des adresses spécifiques de telle manière qu'aucun utilisateur externe ne puisse générer de transactions avec des signatures valides pour ces adresses. Cela peut être *très* utile pour de nombreuses applications dans Web3 (par exemple, DeFi, NFT, etc.) Sans les CPI, les PDA ne seraient pas aussi utiles car il n'y aurait aucun moyen pour un programme de signer des transactions les impliquant - les transformant essentiellement en trous noirs (une fois que quelque chose est envoyé à une PDA, il n'y aurait aucun moyen de le récupérer sans CPI !)

# Laboratoire

Maintenant, passons à la pratique avec les CPI en apportant quelques modifications au programme de critique de films. Si vous suivez cette leçon sans avoir suivi les précédentes, le programme de critique de films permet aux utilisateurs de soumettre des critiques de films et de les stocker dans des comptes PDA.

Lors de la dernière leçon, nous avons ajouté la possibilité de laisser des commentaires sur d'autres critiques de films à l'aide des PDA. Dans cette leçon, nous allons travailler sur le fait de faire en sorte que le programme crée des jetons pour le critique ou le commentateur à chaque fois qu'une critique ou un commentaire est soumis.

Pour mettre en œuvre cela, nous devrons invoquer l'instruction `MintTo` du programme de jetons SPL Token en utilisant une CPI. Si vous avez besoin d'un rappel sur les jetons, les mints de jetons et la création de nouveaux jetons, consultez la [leçon sur le programme de jetons](./token-program) avant de continuer avec ce laboratoire.

### 1. Obtenir le code de départ et ajouter les dépendances

Pour commencer, nous utiliserons l'état final du programme de critique de film de la leçon précédente sur les PDA. Donc, si vous venez de terminer cette leçon, vous êtes prêt à partir. Si vous venez juste d'arriver ici, pas de soucis, vous pouvez [télécharger le code de départ ici](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments). Nous utiliserons la branche `solution-add-comments` comme point de départ.

### 2. Ajouter les dépendances à `Cargo.toml`

Avant de commencer, nous devons ajouter deux nouvelles dépendances au fichier `Cargo.toml` sous `[dependencies]`. Nous utiliserons les crates `spl-token` et `spl-associated-token-account` en plus des dépendances existantes.

```text
spl-token = { version="~3.2.0", features = [ "no-entrypoint" ] }
spl-associated-token-account = { version="=1.0.5", features = [ "no-entrypoint" ] }
```

Après avoir ajouté ce qui précède, exécutez `cargo check` dans votre console pour que cargo résolve vos dépendances et assurez-vous que vous êtes prêt à continuer. Selon votre configuration, vous devrez peut-être modifier les versions des caisses avant de continuer.

### 3. Ajouter les comptes nécessaires à `add_movie_review`

Parce que nous voulons que les utilisateurs reçoivent des jetons lorsqu'ils créent une critique, il est logique d'ajouter une logique de création de jetons à l'intérieur de la fonction `add_movie_review`. Comme nous allons créer des jetons, l'instruction `add_movie_review` nécessite quelques nouveaux comptes à passer :

- `token_mint` - l'adresse de création de jetons du jeton
- `mint_auth` - adresse de l'autorité du jeton
- `user_ata` - compte de jeton associé de l'utilisateur pour ce jeton (où les jetons seront créés)
- `token_program` - adresse du programme de jetons

Nous commencerons par ajouter ces nouveaux comptes à la zone de la fonction qui itère à travers les comptes passés en argument :

```rust
// À l'intérieur de add_movie_review
msg!("Ajout d'une critique de film...");
msg!("Titre : {}", title);
msg!("Note : {}", rating);
msg!("Description : {}", description);

let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

Il n'est pas nécessaire de fournir des `instruction_data` supplémentaires pour la nouvelle fonctionnalité, donc aucune modification n'est nécessaire quant à la manière dont les données sont désérialisées. La seule information supplémentaire nécessaire est les comptes supplémentaires.

### 4. Créer des jetons pour le critique dans `add_movie_review`

Avant de plonger dans la logique de création des jetons, importons l'adresse du programme de jetons et la constante `LAMPORTS_PER_SOL` en haut du fichier.

```rust
// À l'intérieur de processor.rs
use solana_program::native_token::LAMPORTS_PER_SOL;
use spl_associated_token_account::get_associated_token_address;
use spl_token::{instruction::initialize_mint, ID as TOKEN_PROGRAM_ID};
```

Maintenant, nous pouvons passer à la logique qui gère la création réelle des jetons ! Nous allons ajouter cela à la toute fin de la fonction `add_movie_review`, juste avant que `Ok(())` soit retourné.

La création de jetons nécessite une signature de l'autorité de création. Étant donné que le programme doit pouvoir créer des jetons, l'autorité de création doit être un compte pour lequel le programme peut signer. En d'autres termes, il doit s'agir d'un compte PDA détenu par le programme.

Nous structurerons également notre création de jetons de telle sorte que le compte de création de jetons soit un compte PDA que nous pouvons dériver de manière déterministe. De cette façon, nous pouvons toujours vérifier que le compte `token_mint` passé au programme est le compte attendu.

Allons-y et dérivons le compte de création de jetons et les adresses d'autorité de création en utilisant la fonction `find_program_address` avec les seeds "token_mint" et "token_auth", respectivement.

```rust
// Créer des jetons ici
msg!("dérivation de l'autorité de création de jetons");
let (mint_pda, _mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Ensuite, nous effectuerons des vérifications de sécurité contre chacun des nouveaux comptes passés au programme. N'oubliez jamais de vérifier les comptes !

```rust
if *token_mint.key != mint_pda {
    msg!("Jetons incorrects");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Les jetons passés et les jetons dérivés ne correspondent pas");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(initializer.key, token_mint.key) {
    msg!("Jetons incorrects");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Programme de jetons incorrect");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Enfin, nous pouvons émettre une CPI vers la fonction `mint_to` du programme de jetons avec les comptes corrects en utilisant `invoke_signed`. La caisse `spl_token` fournit une fonction d'aide `mint_to` pour créer l'instruction de création de jetons. C'est génial car cela signifie que nous n'avons pas à construire manuellement toute l'instruction à partir de zéro. Nous pouvons simplement passer les arguments requis par la fonction. Voici la signature de la fonction :

```rust
// À l'intérieur du programme de jetons, renvoie un objet Instruction
pub fn mint_to(
    token_program_id: &Pubkey,
    mint_pubkey: &Pubkey,
    account_pubkey: &Pubkey,
    owner_pubkey: &Pubkey,
    signer_pubkeys: &[&Pubkey],
    amount: u64,
) -> Result<Instruction, ProgramError>
```

Ensuite, nous fournissons des copies des comptes `token_mint`, `user_ata` et `mint_auth`. Et, le plus pertinent pour cette leçon, nous fournissons les seeds utilisées pour trouver l'adresse `token_mint`, y compris la bump seed.

```rust
msg!("Création de 10 jetons pour le compte de jetons associé de l'utilisateur");
invoke_signed(
    // Instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        10*LAMPORTS_PER_SOL,
    )?,
    // Informations sur le compte
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Seeds
    &[&[b"token_auth", &[mint_auth_bump]]],
)?;

Ok(())
```

Notez que nous utilisons `invoke_signed` et non `invoke` ici. Le programme de jetons exige que le compte `mint_auth` signe cette transaction. Étant donné que le compte `mint_auth` est une PDA, seul le programme dont il a été dérivé peut signer en son nom. Lorsque `invoke_signed` est appelé, le runtime de Solana appelle `create_program_address` avec les seeds et le coup fournis, puis compare l'adresse dérivée avec toutes les adresses des objets `AccountInfo` fournis. Si l'une des adresses correspond à l'adresse dérivée, le runtime sait que le compte correspondant est une PDA de ce programme et que le programme signe cette transaction pour ce compte.

À ce stade, l'instruction `add_movie_review` devrait être pleinement fonctionnelle et créera dix jetons pour le critique lorsqu'une critique est créée.

### 5. Répéter pour `add_comment`

Nos mises à jour de la fonction `add_comment` seront presque identiques à ce que nous avons fait pour la fonction `add_movie_review` ci-dessus. La seule différence est que nous changerons le nombre de jetons créés pour un commentaire de dix à cinq afin que l'ajout de critiques soit pondéré par rapport aux commentaires. Tout d'abord, mettez à jour les comptes avec les mêmes quatre comptes supplémentaires que dans la fonction `add_movie_review`.

```rust
// À l'intérieur de add_comment
let account_info_iter = &mut accounts.iter();

let commenter = next_account_info(account_info_iter)?;
let pda_review = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let pda_comment = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

Ensuite, passez au bas de la fonction `add_comment` juste avant le `Ok(())`. Puis, dérivez le compte de création de jetons et les autorités de création de jetons. Rappelez-vous, les deux sont des PDA dérivées des seeds "token_mint" et "token_authority" respectivement.

```rust
// Créer des jetons ici
msg!("dérivation de l'autorité de création de jetons");
let (mint_pda, _mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Ensuite, vérifiez que chacun des nouveaux comptes est le compte correct.

```rust
if *token_mint.key != mint_pda {
    msg!("Jetons incorrects");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Les jetons passés et les jetons dérivés ne correspondent pas");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(commenter.key, token_mint.key) {
    msg!("Jetons incorrects");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Programme de jetons incorrect");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Enfin, utilisez `invoke_signed` pour envoyer l'instruction `mint_to` au programme de jetons, envoyant cinq jetons au commentateur.

```rust
msg!("Création de 5 jetons pour le compte de jetons associé de l'utilisateur");
invoke_signed(
    // Instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        5 * LAMPORTS_PER_SOL,
    )?,
    // Informations sur le compte
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Seeds
    &[&[b"token_auth", &[mint_auth_bump]]],
)?;

Ok(())
```

### 6. Configurer le jeton de création

Nous avons écrit tout le code nécessaire pour créer des jetons pour les critiques et les commentateurs, mais tout cela suppose qu'il y a un jeton de création à la PDA dérivée avec la seed "token_mint". Pour que cela fonctionne, nous allons configurer une instruction supplémentaire pour initialiser le jeton de création. Elle sera écrite de telle sorte qu'elle ne puisse être appelée qu'une seule fois et peu importe qui l'appelle.

Étant donné qu'au cours de cette leçon, nous avons déjà abordé à plusieurs reprises tous les concepts associés aux PDAs et aux CPIs, nous allons aborder cette partie avec moins d'explications que les étapes précédentes. Commencez par ajouter une quatrième variante d'instruction à l'énumération `MovieInstruction` dans `instruction.rs`.

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    AddComment {
        comment: String,
    },
    InitializeMint,
}
```

Assurez-vous de l'ajouter à l'instruction `match` dans la fonction `unpack` dans le même fichier sous la variante `3`.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment,
                }
            }
            3 => Self::InitializeMint,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
```

Dans la fonction `process_instruction` dans le fichier `processor.rs`, ajoutez la nouvelle instruction à l'instruction `match` et appelez une fonction `initialize_token_mint`.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview {
            title,
            rating,
            description,
        } => add_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::UpdateMovieReview {
            title,
            rating,
            description,
        } => update_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::AddComment { comment } => add_comment(program_id, accounts, comment),
        MovieInstruction::InitializeMint => initialize_token_mint(program_id, accounts),
    }
}
```

Enfin, déclarez et implémentez la fonction `initialize_token_mint`. Cette fonction dérivera les PDAs de jetons de création et d'autorités de jetons de création, créera le compte de jetons de création, puis initialisera le jeton de création. Nous n'expliquerons pas tout cela en détail, mais il vaut la peine de lire le code, surtout étant donné que la création et l'initialisation du jeton de création impliquent toutes deux des CPIs. Encore une fois, si vous avez besoin d'un rappel sur les jetons, consultez la [leçon sur le programme de jetons](./token-program).

```rust
pub fn initialize_token_mint(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let token_mint = next_account_info(account_info_iter)?;
    let mint_auth = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let sysvar_rent = next_account_info(account_info_iter)?;

    let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
    let (mint_auth_pda, _mint_auth_bump) =
        Pubkey::find_program_address(&[b"token_auth"], program_id);

    msg!("Token mint: {:?}", mint_pda);
    msg!("Mint authority: {:?}", mint_auth_pda);

    if mint_pda != *token_mint.key {
        msg!("Compte de jetons incorrect");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *token_program.key != TOKEN_PROGRAM_ID {
        msg!("Programme de jetons incorrect");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *mint_auth.key != mint_auth_pda {
        msg!("Compte d'autorisation de création de jetons incorrect");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(82);

    invoke_signed(
        &system_instruction::create_account(
            initializer.key,
            token_mint.key,
            rent_lamports,
            82,
            token_program.key,
        ),
        &[
            initializer.clone(),
            token_mint.clone(),
            system_program.clone(),
        ],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Compte de jetons créé");

    invoke_signed(
        &initialize_mint(
            token_program.key,
            token_mint.key,
            mint_auth.key,
            Option::None,
            9,
        )?,
        &[token_mint.clone(), sysvar_rent.clone(), mint_auth.clone()],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Jeton de création initialisé");

    Ok(())
}
```

### 7. Construire et déployer

Maintenant, nous sommes prêts à construire et déployer notre programme ! Vous pouvez construire le programme en exécutant `cargo build-bpf` et ensuite en exécutant la commande retournée, cela devrait ressembler à quelque chose comme `solana program deploy <CHEMIN>`.

Avant de commencer à tester si l'ajout d'une critique ou d'un commentaire vous envoie des jetons, vous devez initialiser le jeton de création du programme. Vous pouvez utiliser [ce script](https://github.com/Unboxed-Software/solana-movie-token-client) pour ce faire. Une fois que vous avez cloné ce dépôt, remplacez l'`ID_PROGRAMME` dans `index.ts` par l'ID de votre programme. Ensuite, exécutez `npm install` puis `npm start`. Le script suppose que vous déployez sur Devnet. Si vous déployez localement, assurez-vous d'adapter le script en conséquence.

Une fois que vous avez initialisé votre jeton de création, vous pouvez utiliser le [frontend Movie Review](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-tokens) pour tester l'ajout d'avis et de commentaires. Encore une fois, le code suppose que vous êtes sur Devnet, alors agissez en conséquence.

Après avoir soumis un avis, vous devriez voir 10 nouveaux jetons dans votre portefeuille ! Lorsque vous ajoutez un commentaire, vous devriez recevoir 5 jetons. Ils n'auront pas de nom ou d'image fantaisistes car nous n'avons ajouté aucune métadonnée au jeton, mais vous avez compris l'idée.

Si vous avez besoin de plus de temps pour assimiler les concepts de cette leçon ou si vous avez rencontré des difficultés en cours de route, n'hésitez pas à [consulter le code de solution](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-tokens). Notez que la solution à ce laboratoire se trouve sur la branche `solution-add-tokens`.

# Défi

Pour appliquer ce que vous avez appris sur les CPIs dans cette leçon, réfléchissez à la manière dont vous pourriez les incorporer dans le programme d'introduction des étudiants. Vous pourriez faire quelque chose de similaire à ce que nous avons fait dans le laboratoire ici et ajouter une fonctionnalité pour créer des jetons aux utilisateurs lorsqu'ils se présentent. Ou si vous êtes vraiment ambitieux, réfléchissez à la manière dont vous pourriez prendre tout ce que vous avez appris jusqu'à présent dans le cours et créer quelque chose de complètement nouveau à partir de zéro.

Un excellent exemple serait de construire un Stack Overflow décentralisé. Le programme pourrait utiliser des jetons pour déterminer la note globale d'un utilisateur, créer des jetons lorsque des questions sont correctement répondues, permettre aux utilisateurs de voter pour des réponses, etc. Tout cela est possible et vous avez maintenant les compétences et les connaissances pour aller construire quelque chose de similaire par vous-même !

Félicitations d'avoir atteint la fin du Module 4 ! N'hésitez pas à [partager quelques retours rapides](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%204), afin que nous puissions continuer à améliorer le cours.

## Vous avez fini le laboratoire ?

Publiez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=ade5d386-809f-42c2-80eb-a6c04c471f53) !
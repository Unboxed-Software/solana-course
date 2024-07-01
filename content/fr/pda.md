---
title: Les PDA
objectives:
- Expliquer les Adresses Dérivées de Programme (PDA)
- Expliquer divers cas d'utilisation des PDA
- Décrire comment les PDA sont dérivées
- Utiliser les dérivations de PDA pour localiser et récupérer des données
---

# Résumé

- Une **Adresse Dérivée de Programme** (PDA) est dérivée d'un **ID de programme** et éventuellement d'une liste optionnelle de **seeds**
- Les PDA sont la propriété et sous le contrôle du programme dont elles sont dérivées
- La dérivation des PDA offre une façon déterministe de trouver des données en fonction des seeds utilisés pour la dérivation
- Les seeds peuvent être utilisées pour mapper les données stockées dans un compte PDA distinct
- Un programme peut signer des instructions au nom des PDA dérivées de son ID

# Aperçu général

## Qu'est-ce qu'une Adresse Dérivée de Programme ?

Les Adresses Dérivées de Programme (PDA) sont des adresses de compte conçues pour être signées par un programme plutôt qu'une clé secrète. Comme son nom l'indique, les PDA sont dérivées à l'aide d'un ID de programme. Facultativement, ces comptes dérivés peuvent également être trouvés en utilisant l'ID avec une liste de "seeds". Nous approfondirons ce point plus tard, mais ces seeds joueront un rôle important dans la façon dont nous utilisons les PDA pour le stockage et la récupération de données.

Les PDA servent à deux fonctions principales :

1. Fournir une manière déterministe de trouver un élément de données donné pour un programme.
2. Autoriser le programme à partir duquel une PDA a été dérivée à signer en son nom, de la même manière qu'un utilisateur peut signer avec sa clé secrète.

Dans cette leçon, nous nous concentrerons sur l'utilisation des PDA pour trouver et stocker des données. Nous discuterons de la signature avec une PDA de manière plus approfondie dans une leçon future où nous aborderons les Invocations Interprogrammes Croisées (IIC).

## Trouver des PDA

Les PDA ne sont pas créées techniquement. Au lieu de cela, elles sont *trouvées* ou *dérivées* en fonction d'un ID de programme et d'un ou plusieurs seeds d'entrée.

Les paires de clés Solana peuvent être trouvées sur ce qu'on appelle la Courbe Elliptique Ed25519 (ou juste "Ed25519"). Ed25519 est un schéma de signature déterministe que Solana utilise pour générer des clés publiques et privées correspondantes. Nous appelons cela des paires de clés.

Alternativement, les PDA sont des adresses qui se trouvent *en dehors* de la courbe Ed25519. Cela signifie que les PDA ne sont pas des clés publiques et n'ont pas de clés privées. Cette propriété des PDA est essentielle pour permettre aux programmes de signer en leur nom, mais nous aborderons cela dans une leçon future.

Pour trouver une PDA dans un programme Solana, nous utiliserons la fonction `find_program_address`. Cette fonction prend en entrée une liste optionnelle de "seeds" et un ID de programme, puis renvoie la PDA et une "bump seed".

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[user.key.as_ref(), user_input.as_bytes().as_ref(), "SEED".as_bytes()], program_id)
```

### Seeds

Les "seeds" sont des entrées optionnelles utilisées dans la fonction `find_program_address` pour dériver une PDA. Par exemple, les seeds peuvent être n'importe quelle combinaison de clés publiques, d'entrées fournies par un utilisateur, ou de valeurs codées en dur. Une PDA peut également être dérivée en utilisant uniquement l'ID du programme et aucun seed supplémentaire. Cependant, utiliser des seeds pour trouver nos PDA nous permet de créer un nombre arbitraire de comptes que notre programme peut posséder.

Bien que vous, le développeur, déterminiez les seeds à passer dans la fonction `find_program_address`, la fonction elle-même fournit une seed supplémentaire appelée "bump seed". La fonction cryptographique de dérivation d'une PDA donne une clé qui se trouve *sur* la courbe Ed25519 environ 50% du temps. Afin de garantir que le résultat *n'est pas* sur la courbe Ed25519 et n'a donc pas de clé secrète, la fonction `find_program_address` ajoute une seed numérique appelée "bump seed".

La fonction commence par utiliser la valeur `255` comme bump seed, puis vérifie si le résultat est une PDA valide. Si le résultat n'est pas une PDA valide, la fonction diminue la bump seed de 1 et réessaie (`255`, `254`, `253`, etc.). Une fois qu'une PDA valide est trouvée, la fonction renvoie à la fois la PDA et le bump qui a été utilisé pour dériver la PDA.

### Sous le capot de `find_program_address`

Jetons un coup d'œil au code source de `find_program_address`.

```rust
 pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Self::try_find_program_address(seeds, program_id)
        .unwrap_or_else(|| panic!("Unable to find a viable program address bump seed"))
}
```

Sous le capot, la fonction `find_program_address` transmet les `seeds` et l'`ID de programme` en entrée à la fonction `try_find_program_address`.

La fonction `try_find_program_address` introduit ensuite la "bump seed". La "bump seed" est une variable `u8` avec une valeur allant de 0 à 255. En itérant sur une plage décroissante à partir de 255, une "bump seed" est ajoutée aux "seeds" d'entrée optionnels qui sont ensuite transmis à la fonction `create_program_address`. Si la sortie de `create_program_address` n'est pas une PDA valide, alors la "bump seed" est diminuée de 1 et la boucle continue jusqu'à ce qu'une PDA valide soit trouvée.

```rust
pub fn try_find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> Option<(Pubkey, u8)> {

    let mut bump_seed = [std::u8::MAX];
    for _ in 0..std::u8::MAX {
        {
            let mut seeds_with_bump = seeds.to_vec();
            seeds_with_bump.push(&bump_seed);
            match Self::create_program_address(&seeds_with_bump, program_id) {
                Ok(address) => return Some((address, bump_seed[0])),
                Err(PubkeyError::InvalidSeeds) => (),
                _ => break,
            }
        }
        bump_seed[0] -= 1;
    }
    None

}
```

La fonction `create_program_address` effectue une série d'opérations de hachage sur les seeds et l'`ID de programme`. Ces opérations calculent une clé, puis vérifient si la clé calculée se trouve sur la courbe elliptique Ed25519 ou non. Si une PDA valide est trouvée (c'est-à-dire une adresse qui est *hors* de la courbe), alors la PDA est renvoyée. Sinon, une erreur est renvoyée.

```rust
pub fn create_program_address(
    seeds: &[&[u8]],
    program_id: &Pubkey,
) -> Result<Pubkey, PubkeyError> {

    let mut hasher = crate::hash::Hasher::default();
    for seed in seeds.iter() {
        hasher.hash(seed);
    }
    hasher.hashv(&[program_id.as_ref(), PDA_MARKER]);
    let hash = hasher.result();

    if bytes_are_curve_point(hash) {
        return Err(PubkeyError::InvalidSeeds);
    }

    Ok(Pubkey::new(hash.as_ref()))

}
```

En résumé, la fonction `find_program_address` transmet nos seeds d'entrée et l'`ID de programme` à la fonction `try_find_program_address`. La fonction `try_find_program_address` ajoute une "bump seed" (en commençant par 255) à nos seeds d'entrée, puis appelle la fonction `create_program_address` jusqu'à ce qu'une PDA valide soit trouvée. Une fois trouvée, la PDA et la "bump seed" sont renvoyées.

Notez que pour les mêmes seeds d'entrée, différentes "bump seeds" valides généreront différentes PDA valides. La "bump seed" renvoyée par `find_program_address` sera toujours la première PDA valide trouvée. Parce que la fonction commence avec une valeur de "bump seed" de 255 et itère vers le bas jusqu'à zéro, la "bump seed" qui est finalement renvoyée sera toujours la plus grande valeur 8 bits valide possible. Cette "bump seed" est couramment appelée "*bump canonique*". Pour éviter toute confusion, il est recommandé d'utiliser uniquement le "bump canonique" et de *valider toujours chaque PDA transmise à votre programme*.

Un point à souligner est que la fonction `find_program_address` ne renvoie qu'une Adresse Dérivée de Programme et la "bump seed" utilisée pour la dériver. La fonction `find_program_address` n'initialise pas un nouveau compte, et aucune PDA retournée par la fonction n'est nécessairement associée à un compte qui stocke des données.

## Utiliser des comptes PDA pour stocker des données

Étant donné que les programmes eux-mêmes sont sans état, l'état du programme est géré via des comptes externes. Étant donné que vous pouvez utiliser des seeds pour le mappage et que les programmes peuvent signer en leur nom, utiliser des comptes PDA pour stocker des données liées au programme est un choix de conception extrêmement courant. Bien que les programmes puissent invoquer le Programme Système pour créer des comptes non-PDA et les utiliser également pour stocker des données, les PDA ont tendance à être la voie à suivre.

Si vous avez besoin d'un rappel sur la manière de stocker des données dans des PDA, consultez la [leçon sur la Gestion de l'État de Programme de Création de Programme de Base, Partie 2](./program-state-management).

## Mapper les données stockées dans les comptes PDA

Stocker des données dans des comptes PDA n'est que la moitié de l'équation. Vous avez également besoin d'une façon de récupérer ces données. Nous parlerons de deux approches :

1. Création d'un compte PDA "map" qui stocke les adresses des divers comptes où les données sont stockées.
2. Utilisation stratégique de seeds pour localiser les comptes PDA appropriés et récupérer les données nécessaires.

### Mapper les données à l'aide de comptes PDA "map"

Une approche pour organiser le stockage de données consiste à stocker des clusters de données pertinentes dans leurs propres PDA, puis à avoir un compte PDA distinct qui stocke une cartographie de l'emplacement de toutes les données.

Par exemple, vous pourriez avoir une application de prise de notes dont le programme de sauvegarde utilise des seeds aléatoires pour générer des comptes PDA et stocke une note dans chaque compte. Le programme aurait également un seul compte PDA "map" global qui stocke une cartographie des clés publiques des utilisateurs avec la liste des PDA où leurs notes sont stockées. Ce compte de carte serait dérivé en utilisant une seed statique, par exemple "GLOBAL_MAPPING".

Lorsqu'il est temps de récupérer les notes d'un utilisateur, vous pourriez alors consulter le compte de la carte, voir la liste des adresses associées à la clé publique d'un utilisateur, puis récupérer le compte pour chacune de ces adresses.

Bien qu'une telle solution soit peut-être plus abordable pour les développeurs web traditionnels, elle présente quelques inconvénients propres au développement web3. Étant donné que la taille de la cartographie stockée dans le compte de la carte augmentera avec le temps, vous devrez soit allouer plus d'espace que nécessaire au compte lorsque vous le créez initialement, soit vous devrez réallouer de l'espace pour chaque nouvelle note créée. En plus de cela, vous atteindrez éventuellement la limite de taille du compte de 10 mégaoctets.

Vous pourriez atténuer en partie ce problème en créant un compte de carte distinct pour chaque utilisateur. Par exemple, au lieu d'avoir un seul compte PDA de carte pour l'ensemble du programme, vous construiriez un compte de carte PDA par utilisateur. Chacun de ces comptes de carte pourrait être dérivé avec la clé publique de l'utilisateur. Les adresses de chaque note pourraient ensuite être stockées à l'intérieur du compte de carte de l'utilisateur correspondant.

Cette approche réduit la taille requise pour chaque compte de carte, mais ajoute finalement une exigence inutile au processus : devoir lire l'information sur le compte de carte *avant* de pouvoir trouver les comptes avec les données de notes pertinentes.

Il peut y avoir des moments où utiliser cette approche a du sens pour votre application, mais nous ne la recommandons pas comme votre stratégie principale.

### Mapper les données en utilisant la dérivation PDA

Si vous êtes stratégique concernant les seeds que vous utilisez pour dériver des PDA, vous pouvez incorporer les mappages nécessaires dans les seeds eux-mêmes. C'est l'évolution naturelle de l'exemple d'application de prise de notes que nous venons de discuter. Si vous commencez à utiliser la clé publique du créateur de la note comme seed pour créer un compte de carte par utilisateur, alors pourquoi ne pas utiliser à la fois la clé publique du créateur et une autre information connue pour dériver une PDA pour la note elle-même ?

Maintenant, sans en parler explicitement, nous avons mappé des seeds à des comptes pendant tout ce cours. Pensez au programme de critique de film que nous avons construit dans les leçons précédentes. Ce programme utilise la clé publique du créateur d'une critique et le titre du film qu'il critique pour trouver l'adresse qui *devrait* être utilisée pour stocker la critique. Cette approche permet au programme de créer une adresse unique pour chaque nouvelle critique tout en facilitant la localisation d'une critique lorsque cela est nécessaire. Lorsque vous souhaitez trouver la critique d'un utilisateur sur "Spiderman", vous savez qu'elle est stockée dans le compte PDA dont l'adresse peut être dérivée en utilisant la clé publique de l'utilisateur et le texte "Spiderman" comme seeds.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[
        initializer.key.as_ref(),
        title.as_bytes().as_ref()
    ],
    program_id)
```

### Adresses de compte associées de jeton

Un autre exemple pratique de ce type de mappage est la manière dont les adresses de compte associées de jeton (ATA) sont déterminées. Les jetons sont souvent détenus dans une ATA dont l'adresse a été dérivée en utilisant une adresse de portefeuille et l'adresse de la création d'un jeton spécifique. L'adresse d'une ATA est trouvée à l'aide de la fonction `get_associated_token_address` qui prend une `adresse_de_portefeuille` et une `adresse_de_création_de_jetons` en entrée.

```rust
let associated_token_address = get_associated_token_address(&wallet_address, &token_mint_address);
```

Sous le capot, l'adresse de jeton associée est une PDA trouvée en utilisant `wallet_address`, `token_program_id`, et `token_mint_address` comme seeds. Cela offre une manière déterministe de trouver un compte de jeton associé à n'importe quelle adresse de portefeuille pour un jeton spécifique.

```rust
fn get_associated_token_address_and_bump_seed_internal(
    wallet_address: &Pubkey,
    token_mint_address: &Pubkey,
    program_id: &Pubkey,
    token_program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            &wallet_address.to_bytes(),
            &token_program_id.to_bytes(),
            &token_mint_address.to_bytes(),
        ],
        program_id,
    )
}
```

Les mappages entre les seeds et les comptes PDA que vous utilisez dépendront fortement de votre programme spécifique. Bien que ce ne soit pas une leçon sur la conception ou l'architecture système, il est utile de souligner quelques directives :

- Utilisez des seeds qui seront connues au moment de la dérivation des PDA.
- Réfléchissez à quelles données sont regroupées dans un seul compte.
- Réfléchissez à la structure des données utilisée dans chaque compte.
- En général, plus simple est souvent mieux.

# Laboratoire

Pratiquons ensemble avec le programme de critique de films sur lequel nous avons travaillé lors des leçons précédentes. Pas de soucis si vous abordez cette leçon sans avoir suivi la précédente, vous devriez pouvoir suivre de toute façon.

En guise de rappel, le programme de critique de films permet aux utilisateurs de créer des critiques de films. Ces critiques sont stockées dans un compte en utilisant une PDA dérivée avec la clé publique de l'initialisateur et le titre du film qu'ils critiquent.

Précédemment, nous avons terminé la mise en œuvre de la possibilité de mettre à jour une critique de film de manière sécurisée. Dans ce laboratoire, nous ajouterons la possibilité aux utilisateurs de commenter une critique de film. Nous utiliserons la création de cette fonctionnalité comme occasion de travailler sur la façon de structurer le stockage des commentaires à l'aide de comptes PDA.

### 1. Obtenez le code de départ

Pour commencer, vous pouvez trouver [le code de départ du programme de films](https://github.com/Unboxed-Software/solana-movie-program/tree/starter) sur la branche `starter`.

Si vous avez suivi les laboratoires sur la critique de films, vous remarquerez que c'est le programme que nous avons développé jusqu'à présent. Auparavant, nous utilisions [Solana Playground](https://beta.solpg.io/) pour écrire, construire et déployer notre code. Dans cette leçon, nous allons construire et déployer le programme localement.

Ouvrez le dossier, puis exécutez `cargo-build-bpf` pour construire le programme. La commande `cargo-build-bpf` affichera des instructions pour déployer le programme.

```sh
cargo-build-bpf
```

Déployez le programme en copiant la sortie de `cargo-build-bpf` et en exécutant la commande `solana program deploy`.

```sh
solana program deploy <CHEMIN>
```

Vous pouvez tester le programme en utilisant le [frontend de critique de films](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews) et en mettant à jour l'ID du programme avec celui que vous venez de déployer. Assurez-vous d'utiliser la branche `solution-update-reviews`.

### 2. Planifiez la structure du compte

Ajouter des commentaires signifie que nous devons prendre quelques décisions sur la manière de stocker les données associées à chaque commentaire. Les critères d'une bonne structure ici sont :

- Pas trop compliqué
- Les données sont facilement récupérables
- Chaque commentaire a quelque chose pour le lier à la critique à laquelle il est associé

Pour cela, nous allons créer deux nouveaux types de compte :

- Compte de compteur de commentaires
- Compte de commentaire

Il y aura un compte de compteur de commentaires par critique et un compte de commentaire par commentaire. Le compte de compteur de commentaires sera lié à une critique donnée en utilisant l'adresse d'une critique comme seed pour trouver la PDA du compteur de commentaires. Il utilisera également la chaîne statique "comment" comme seed.

Le compte de commentaire sera lié à une critique de la même manière. Cependant, il n'inclura pas la chaîne "comment" en tant que seed et utilisera plutôt le *actual comment count* comme seed. De cette manière, le client peut facilement récupérer les commentaires pour une critique donnée en faisant ce qui suit :

1. Lire les données sur le compte de compteur de commentaires pour déterminer le nombre de commentaires sur une critique.
2. Où `n` est le nombre total de commentaires sur la critique, boucler `n` fois. Chaque itération de la boucle dérivera une PDA en utilisant l'adresse de la critique et le nombre actuel comme seeds. Le résultat est `n` PDA, chacune étant l'adresse d'un compte qui stocke un commentaire.
3. Récupérer les comptes pour chacune des `n` PDA et lire les données stockées dans chacun d'eux.

Cela garantit que chacun de nos comptes peut être récupéré de manière déterministe en utilisant des données qui sont déjà connues à l'avance.

Pour mettre en œuvre ces changements, nous devrons faire ce qui suit :

- Définir des structures pour représenter les comptes de compteur de commentaires et de commentaires
- Mettez à jour le `MovieAccountState` existant pour inclure un discriminant (plus d'informations à ce sujet plus tard)
- Ajoutez une variante d'instruction pour représenter l'instruction `add_comment`
- Mettez à jour la fonction de traitement de l'instruction existante `add_movie_review` pour inclure la création du compte de compteur de commentaires
- Créez une nouvelle fonction de traitement de l'instruction `add_comment`

### 3. Définissez les structures `MovieCommentCounter` et `MovieComment`

Rappelez-vous que le fichier `state.rs` définit les structures que notre programme utilise pour remplir le champ de données d'un nouveau compte.

Nous devrons définir deux nouvelles structures pour permettre les commentaires.

1. `MovieCommentCounter` - pour stocker un compteur pour le nombre de commentaires associés à une critique
2. `MovieComment` - pour stocker les données associées à chaque commentaire

Pour commencer, définissons les structures que nous utiliserons dans notre programme. Notez que nous ajoutons un champ `discriminator` à chaque structure, y compris le `MovieAccountState` existant. Comme nous avons maintenant plusieurs types de comptes, nous avons besoin d'un moyen de ne récupérer que le type de compte dont nous avons besoin du client. Ce discriminant est une chaîne qui peut être utilisée pour filtrer les comptes lorsque nous récupérons nos comptes de programme.

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub discriminator: String,
    pub is_initialized: bool,
    pub reviewer: Pubkey,
    pub rating: u8,
    pub title: String,
    pub description: String,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieCommentCounter {
    pub discriminator: String,
    pub is_initialized: bool,
    pub counter: u64
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieComment {
    pub discriminator: String,
    pub is_initialized: bool,
    pub review: Pubkey,
    pub commenter: Pubkey,
    pub comment: String,
    pub count: u64
}

impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieCommentCounter {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieComment {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Étant donné que nous avons ajouté un nouveau champ `discriminator` à notre structure existante, le calcul de la taille du compte doit changer. Profitons de cette occasion pour nettoyer un peu notre code. Nous allons ajouter une implémentation pour chacune des trois structures ci-dessus qui ajoute une constante `DISCRIMINATOR` et soit une constante `SIZE` ou une fonction `get_account_size` constante afin de pouvoir obtenir rapidement la taille nécessaire lors de l'initialisation d'un compte.

```rust
impl MovieAccountState {
    pub const DISCRIMINATOR: &'static str = "review";

    pub fn get_account_size(title: String, description: String) -> usize {
        return (4 + MovieAccountState::DISCRIMINATOR.len())
            + 1
            + 1
            + (4 + title.len())
            + (4 + description.len());
    }
}

impl MovieCommentCounter {
    pub const DISCRIMINATOR: &'static str = "counter";
    pub const SIZE: usize = (4 + MovieCommentCounter::DISCRIMINATOR.len()) + 1 + 8;
}

impl MovieComment {
    pub const DISCRIMINATOR: &'static str = "comment";

    pub fn get_account_size(comment: String) -> usize {
        return (4 + MovieComment::DISCRIMINATOR.len()) + 1 + 32 + 32 + (4 + comment.len()) + 8;
    }
}
```

Maintenant, partout où nous avons besoin du discriminateur ou de la taille du compte, nous pouvons utiliser cette implémentation et ne pas risquer de fautes de frappe involontaires.

### 4. Créez l'instruction `AddComment`

Rappelez-vous que le fichier `instruction.rs` définit les instructions que notre programme acceptera et comment désérialiser les données pour chacune. Nous devons ajouter une nouvelle variante d'instruction pour ajouter des commentaires. Commençons par ajouter une nouvelle variante `AddComment` à l'énumération `MovieInstruction`.

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    AddComment {
        comment: String
    }
}
```

Ensuite, créons une struct `CommentPayload` pour représenter les données d'instruction associées à cette nouvelle instruction. La plupart des données que nous inclurons dans le compte sont des clés publiques associées aux comptes passés dans le programme, donc la seule chose dont nous avons réellement besoin ici est un seul champ pour représenter le texte du commentaire.

```rust
#[derive(BorshDeserialize)]
struct CommentPayload {
    comment: String
}
```

Maintenant, mettons à jour la façon dont nous désérialisons les données d'instruction. Remarquez que nous avons déplacé la désérialisation des données d'instruction dans chaque cas correspondant en utilisant la struct de payload associée à chaque instruction.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description }
            },
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description
                }
            },
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment
                }
            }
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

Enfin, mettons à jour la fonction `process_instruction` dans `processor.rs` pour utiliser la nouvelle variante d'instruction que nous avons créée.

Dans `processor.rs`, amenez dans le scope les nouvelles structures de `state.rs`.

```rust
use crate::state::{MovieAccountState, MovieCommentCounter, MovieComment};
```

Ensuite, dans `process_instruction`, faisons correspondre nos données d'instruction désérialisées `AddComment` à la fonction `add_comment` que nous implémenterons sous peu.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            update_movie_review(program_id, accounts, title, rating, description)
        },

        MovieInstruction::AddComment { comment } => {
            add_comment(program_id, accounts, comment)
        }
    }
}
```

### 5. Mettez à jour `add_movie_review` pour créer un compte de compteur de commentaires

Avant d'implémenter la fonction `add_comment`, nous devons mettre à jour la fonction `add_movie_review` pour créer le compte de compteur de commentaires de la critique.

Rappelez-vous que ce compte suivra le nombre total de commentaires associés à une critique. Son adresse sera une PDA dérivée en utilisant l'adresse de la critique et le mot "comment" comme seeds. Notez que la façon dont nous stockons le compteur est simplement un choix de conception. Nous pourrions également ajouter un champ "compteur" au compte de la critique de film d'origine.

À l'intérieur de la fonction `add_movie_review`, ajoutons un `pda_counter` pour représenter le nouveau compte de compteur que nous allons initialiser avec le compte de critique de film. Cela signifie que nous nous attendons maintenant à ce que quatre comptes soient passés à la fonction `add_movie_review` via l'argument `accounts`.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

Ensuite, il y a une vérification pour s'assurer que `total_len` est inférieur à 1000 octets, mais `total_len` n'est plus précis depuis que nous avons ajouté le discriminateur. Remplaçons `total_len` par un appel à `MovieAccountState::get_account_size` :

```rust
let account_len: usize = 1000;

if MovieAccountState::get_account_size(title.clone(), description.clone()) > account_len {
    msg!("La longueur des données est supérieure à 1000 octets");
    return Err(ReviewError::InvalidDataLength.into());
}
```

Notez que cela doit également être mis à jour dans la fonction `update_movie_review` pour que cette instruction fonctionne correctement.

Une fois que nous avons initialisé le compte de la critique, nous devrons également mettre à jour les données du compte avec les nouveaux champs que nous avons spécifiés dans la struct `MovieAccountState`.

```rust
account_data.discriminator = MovieAccountState::DISCRIMINATOR.to_string();
account_data.reviewer = *initializer.key;
account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Enfin, ajoutons la logique pour initialiser le compte de compteur à l'intérieur de la fonction `add_movie_review`. Cela signifie :

1. Calculer le montant d'exemption de loyer pour le compte de compteur
2. Dériver la PDA du compteur en utilisant l'adresse de la critique et le mot "comment" comme seeds
3. Invoquer le programme système pour créer le compte
4. Définir la valeur initiale du compteur
5. Sérialiser les données du compte et générer le retour de la fonction

Tout cela doit être ajouté à la fin de la fonction `add_movie_review` avant `Ok(())`.

```rust
msg!("create comment counter");
let rent = Rent::get()?;
let counter_rent_lamports = rent.minimum_balance(MovieCommentCounter::SIZE);

let (counter, counter_bump) =
    Pubkey::find_program_address(&[pda.as_ref(), "comment".as_ref()], program_id);
if counter != *pda_counter.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument);
}

invoke_signed(
    &system_instruction::create_account(
        initializer.key,
        pda_counter.key,
        counter_rent_lamports,
        MovieCommentCounter::SIZE.try_into().unwrap(),
        program_id,
    ),
    &[
        initializer.clone(),
        pda_counter.clone(),
        system_program.clone(),
    ],
    &[&[pda.as_ref(), "comment".as_ref(), &[counter_bump]]],
)?;
msg!("comment counter created");

let mut counter_data =
    try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

msg!("checking if counter account is already initialized");
if counter_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}

counter_data.discriminator = MovieCommentCounter::DISCRIMINATOR.to_string();
counter_data.counter = 0;
counter_data.is_initialized = true;
msg!("comment count: {}", counter_data.counter);
counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;
```

Maintenant, lorsqu'une nouvelle critique est créée, deux comptes sont initialisés :

1. Le premier est le compte de la critique qui stocke le contenu de la critique. Cela n'a pas changé depuis la version du programme avec laquelle nous avons commencé.
2. Le deuxième compte stocke le compteur de commentaires

### 6. Implémentez `add_comment`

Enfin, implémentons notre fonction `add_comment` pour créer de nouveaux comptes de commentaires.

Lorsqu'un nouveau commentaire est créé pour une critique, nous incrémenterons le compte actuel du commentaire sur le compte de compteur de commentaires et dériverons la PDA du compte de commentaire en utilisant l'adresse de la critique et le compteur actuel comme seeds.

Comme dans d'autres fonctions de traitement des instructions, nous commencerons par itérer à travers les comptes passés dans le programme. Ensuite, avant de faire quoi que ce soit d'autre, nous devons désérialiser le compte de compteur pour avoir accès au compteur de commentaires actuel :

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Ajout d'un commentaire...");
    msg!("Commentaire : {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    Ok(())
}
```

Maintenant que nous avons accès aux données du compteur, nous pouvons continuer avec les étapes restantes :

1. Calculer le montant d'exemption de loyer pour le nouveau compte de commentaire
2. Dériver la PDA du compte de commentaire en utilisant l'adresse de la critique et le compteur de commentaires actuel comme seeds
3. Invoquer le programme système pour créer le nouveau compte de commentaire
4. Définir les valeurs appropriées pour le nouveau compte créé
5. Sérialiser les données du compte et générer le retour de la fonction

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Ajout d'un commentaire...");
    msg!("Commentaire : {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    let account_len = MovieComment::get_account_size(comment.clone());

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    let (pda, bump_seed) = Pubkey::find_program_address(&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(),], program_id);
    if pda != *pda_comment.key {
        msg!("Seeds invalides pour la PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    invoke_signed(
        &system_instruction::create_account(
        commenter.key,
        pda_comment.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[commenter.clone(), pda_comment.clone(), system_program.clone()],
        &[&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("Compte de commentaire créé");

    let mut comment_data = try_from_slice_unchecked::<MovieComment>(&pda_comment.data.borrow()).unwrap();

    msg!("Vérification si le compte de commentaire est déjà initialisé");
    if comment_data.is_initialized() {
        msg!("Compte déjà initialisé");
        return Err(ProgramError::AccountAlreadyInitialized)
    }

    comment_data.discriminator = MovieComment::DISCRIMINATOR.to_string();
    comment_data.review = *pda_review.key;
    comment_data.commenter = *commenter.key;
    comment_data.comment = comment;
    comment_data.is_initialized = true;
    comment_data.serialize(&mut &mut pda_comment.data.borrow_mut()[..])?;

    msg!("Nombre de commentaire : {}", counter_data.counter);
    counter_data.counter += 1;
    counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;

    Ok(())
}
```

### 7. Construction et déploiement

Nous sommes prêts à construire et déployer notre programme !

Construisez le programme mis à jour en exécutant `cargo-build-bpf`. Ensuite, déployez le programme en exécutant la commande `solana program deploy` affichée dans la console.

Vous pouvez tester votre programme en soumettant une transaction avec les bonnes données d'instruction. Vous pouvez créer votre propre script ou utiliser librement [ce frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-comments). Assurez-vous d'utiliser la branche `solution-add-comments` et de remplacer `MOVIE_REVIEW_PROGRAM_ID` dans `utils/constants.ts` par l'ID de votre programme, sinon le frontend ne fonctionnera pas avec votre programme.

N'oubliez pas que nous avons apporté des modifications importantes aux comptes de revue (c'est-à-dire l'ajout d'un discriminant). Si vous utilisez le même ID de programme que celui que vous avez utilisé précédemment lors du déploiement de ce programme, aucune des critiques que vous avez créées précédemment ne s'affichera sur ce frontend en raison d'une incohérence des données.

Si vous avez besoin de plus de temps avec ce projet pour vous familiariser avec ces concepts, jetez un œil au [code de solution](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments) avant de continuer. Notez que le code de solution se trouve sur la branche `solution-add-comments` du dépôt lié.

# Défi

Maintenant, c'est à vous de construire quelque chose de manière indépendante ! Allez-y et travaillez avec le programme d'introduction des étudiants que nous avons utilisé dans les leçons précédentes. Le programme d'introduction des étudiants est un programme Solana qui permet aux étudiants de se présenter. Ce programme prend le nom de l'utilisateur et un message court comme `instruction_data` et crée un compte pour stocker les données onchain. Pour ce défi, vous devriez :

1. Ajouter une instruction permettant à d'autres utilisateurs de répondre à une introduction.
2. Construire et déployer le programme localement.

Si vous n'avez pas suivi les leçons précédentes ou n'avez pas sauvegardé votre travail auparavant, n'hésitez pas à utiliser le code de départ sur la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/solana-student-intro-program/tree/starter).

Essayez de le faire de manière indépendante si possible ! Cependant, si vous vous trouvez bloqué, n'hésitez pas à consulter le [code de solution](https://github.com/Unboxed-Software/solana-student-intro-program/tree/solution-add-replies). Notez que le code de solution se trouve sur la branche `solution-add-replies` et que votre code peut avoir l'air légèrement différent.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=89d367b4-5102-4237-a7f4-4f96050fe57e) !
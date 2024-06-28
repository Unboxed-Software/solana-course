---
title: Compression d'État Généralisé
objectives:
- Expliquer la logique derrière la compression d'état Solana
- Expliquer la différence entre un arbre de Merkle et un arbre de Merkle concurrent
- Implémenter une compression d'état générique dans des programmes Solana de base
---

# Résumé
- La compression d'état sur Solana est le plus souvent utilisée pour des NFT compressés, mais il est possible de l'utiliser pour des données arbitraires.
- La compression d'état réduit la quantité de données que vous devez stocker onchain en exploitant les arbres de Merkle.
- Les arbres de Merkle stockent un seul hash qui représente un arbre binaire complet de hashs. Chaque feuille sur un arbre de Merkle est un hash des données de cette feuille.
- Les arbres de Merkle concurrents sont une version spécialisée des arbres de Merkle qui permettent des mises à jour concurrentes.
- Parce que les données dans un programme compressé d'état ne sont pas stockées onchain, vous devez utiliser des indexeurs pour maintenir un cache off-chain des données, puis vérifier ces données par rapport à l'arbre de Merkle onchain.

# Aperçu général

Précédemment, nous avons discuté de la compression d'état dans le contexte des NFT compressés. Au moment de la rédaction, les NFT compressés représentent le cas d'utilisation le plus courant de la compression d'état, mais il est possible d'appliquer la compression d'état de manière plus généralisée à n'importe quel programme. Dans cette leçon, nous discuterons de la compression d'état de manière plus généralisée afin que vous puissiez l'appliquer à n'importe lequel de vos programmes.

## Aperçu théorique de la compression d'état

Dans les programmes traditionnels, les données sont sérialisées (généralement avec Borsh) puis stockées directement dans un compte. Cela permet aux données d'être facilement lues et écrites via les programmes Solana. Vous pouvez "faire confiance" aux données stockées dans les comptes car elles ne peuvent pas être modifiées sauf par les mécanismes exposés par le programme.

La compression d'état affirme efficacement que la partie la plus importante de cette équation est la "fiabilité" des données. Si tout ce qui nous importe est la capacité à faire confiance que les données sont ce qu'elles prétendent être, alors nous pouvons réellement nous en sortir en ***ne*** stockant ***pas*** les données dans un compte onchain. Au lieu de cela, nous pouvons stocker les hashs des données qui peuvent être utilisés pour prouver ou vérifier les données. Le hash des données occupe beaucoup moins d'espace de stockage que les données elles-mêmes. Nous pouvons ensuite stocker les données réelles quelque part de beaucoup moins cher et nous préoccuper de les vérifier par rapport au hash onchain lorsque les données sont consultées.

La structure de données spécifique utilisée par le programme Solana State Compression est une structure d'arbre binaire spéciale connue sous le nom d'**arbre de Merkle concurrent**. Cette structure d'arbre hashe des morceaux de données ensemble de manière déterministe pour calculer un seul hash final qui est stocké onchain. Ce hash final est nettement plus petit en taille que toutes les données originales combinées, d'où le terme "compression". Les étapes de ce processus sont les suivantes :

1. Prendre n'importe quelle donnée
2. Créer un hash de ces données
3. Stocker ce hash en tant que "feuille" en bas de l'arbre
4. Chaque paire de feuilles est ensuite hashée ensemble, créant une "branche"
5. Chaque branche est ensuite hashée ensemble
6. Monter continuellement dans l'arbre et hasher les branches adjacentes
7. Une fois en haut de l'arbre, un hash final "racine" est produit
8. Stocker la racine hashée onchain comme preuve vérifiable des données dans chaque feuille
9. Toute personne souhaitant vérifier que les données qu'elle a correspondent à la "source de vérité" peut suivre le même processus et comparer le hash final sans avoir à stocker toutes les données onchain

Cela implique quelques compromis de développement assez sérieux :

1. Étant donné que les données ne sont plus stockées dans un compte onchain, leur accès est plus difficile.
2. Une fois que les données ont été consultées, les développeurs doivent décider à quelle fréquence leurs applications vérifieront les données par rapport au hash onchain.
3. Toute modification des données nécessitera l'envoi de l'ensemble des données précédemment hashées *et* des nouvelles données dans une instruction. Le développeur peut également devoir fournir des données supplémentaires pertinentes pour les preuves nécessaires pour vérifier les données originales par rapport au hash.

Chacun de ces aspects sera pris en considération lors de la détermination du **si**, du **quand** et du **comment** implémenter la compression d'état pour votre programme.

### Arbres de Merkle Concurrents

Un **arbre de Merkle** est une structure d'arbre binaire représentée par un seul hash. Chaque nœud feuille de la structure est un hash de ses données internes, tandis que chaque branche est un hash des hashs de ses feuilles enfants. À son tour, les branches sont également hashées ensemble jusqu'à ce qu'un seul hash final racine reste.

Étant donné que l'arbre de Merkle est représenté par un seul hash, toute modification des données de la feuille change le hash racine. Cela pose problème lorsque plusieurs transactions dans la même plage horaire tentent de modifier les données de la feuille. Étant donné que ces transactions doivent s'exécuter en série, toutes sauf la première échoueront, car le hash racine et la preuve transmise auront été invalidés par la première transaction à être exécutée. En d'autres termes, un arbre de Merkle standard ne peut modifier qu'une seule feuille par plage horaire. Dans un programme de compression d'état hypothétique qui repose sur un seul arbre de Merkle pour son état, cela limite considérablement le débit.

Cela peut être résolu avec un **arbre de Merkle concurrent**. Un arbre de Merkle concurrent est un arbre de Merkle qui stocke un log de modifications sécurisé des changements les plus récents ainsi que leur hash racine et la preuve pour le dériver. Lorsque plusieurs transactions dans la même plage horaire tentent de modifier les données de la feuille, le log des modifications peut être utilisé comme source de vérité pour permettre des modifications concurrentes à l'arbre.

En d'autres termes, tandis qu'un compte stockant un arbre de Merkle aurait uniquement le hash racine, un arbre de Merkle concurrent contiendra également des données supplémentaires qui permettent aux écritures ultérieures de réussir. Cela inclut :

1. Le hash racine - Le même hash racine qu'un arbre de Merkle standard.
2. Un tampon de log des modifications - Ce tampon contient des données de preuve pertinentes pour les changements récents de hash racine, de sorte que les écritures ultérieures dans la même plage horaire peuvent toujours réussir.
3. Une canopée - Lors de l'exécution d'une action de mise à jour sur une feuille donnée, vous avez besoin du chemin de preuve complet de cette feuille à la racine. La canopée stocke des nœuds de preuve intermédiaires le long de ce chemin afin qu'ils n'aient pas tous à être transmis au programme depuis le client.

En tant qu'architecte de programme, vous contrôlez trois valeurs directement liées à ces trois éléments. Votre choix détermine la taille de l'arbre, le coût de création de l'arbre et le nombre de modifications concurrentes pouvant être apportées à l'arbre :

1. Profondeur maximale
2. Taille maximale du tampon
3. Profondeur de la canopée

La **profondeur maximale** est le nombre maximal de sauts pour aller de n'importe quelle feuille à la racine de l'arbre. Étant donné que les arbres de Merkle sont des arbres binaires, chaque feuille n'est connectée qu'à une autre feuille. La profondeur maximale peut alors logiquement être utilisée pour calculer le nombre de nœuds de l'arbre avec `2 ^ maxDepth`.

La **taille maximale du tampon** est effectivement le nombre maximal de modifications concurrentes que vous pouvez apporter à un arbre dans une seule plage horaire tout en conservant le hash racine valide. Lorsque plusieurs transactions sont soumises dans la même plage horaire, chacune d'entre elles essaie de mettre à jour des feuilles sur un arbre de Merkle standard, seule la première à s'exécuter sera valide. C'est parce que cette opération "d'écriture" modifiera le hash stocké dans le compte. Les transactions ultérieures dans la même plage horaire tenteront de valider leurs données par rapport à un hash désormais obsolète. Un arbre de Merkle concurrent a un tampon pour que le tampon puisse conserver un log continu de ces modifications. Cela permet au programme de compression d'état de valider plusieurs écritures de données dans la même plage horaire car il peut rechercher les hashs précédents dans le tampon et les comparer avec le hash approprié.

La **profondeur de la canopée** est le nombre de nœuds de preuve stockés onchain pour n'importe quel chemin de preuve donné. Vérifier n'importe quelle feuille nécessite le chemin de preuve complet pour l'arbre. Le chemin de preuve complet est composé d'un nœud de preuve pour chaque "couche" de l'arbre, c'est-à-dire une profondeur maximale de 14 signifie qu'il y a 14 nœuds de preuve. Chaque nœud de preuve passé au programme ajoute 32 octets à une transaction, donc de grands arbres dépasseraient rapidement la limite maximale de taille de transaction. La mise en cache des nœuds de preuve onchain dans la canopée aide à améliorer la composabilité du programme.

Chacune de ces trois valeurs, profondeur maximale, taille maximale du tampon et profondeur de la canopée, comporte un compromis. Augmenter la valeur de l'une de ces valeurs augmente la taille du compte utilisé pour stocker l'arbre, augmentant ainsi le coût de création de l'arbre.

Choisir la profondeur maximale est assez simple car elle est directement liée au nombre de feuilles et donc à la quantité de données que vous pouvez stocker. Si vous avez besoin de 1 million de cNFT sur un seul arbre où chaque cNFT est une feuille de l'arbre, trouvez la profondeur maximale qui rend l'expression suivante vraie : `2^maxDepth > 1 million`. La réponse est 20.

Choisir une taille maximale du tampon est effectivement une question de débit : de combien d'écritures concurrentes avez-vous besoin ? Plus le tampon est grand, plus le débit est élevé.

Enfin, la profondeur de la canopée déterminera la composabilité de votre programme. Les pionniers de la compression d'état ont clairement indiqué qu'omettre une canopée est une mauvaise idée. Le programme A ne peut pas appeler votre programme compressé d'état B si cela atteint les limites de taille de transaction. N'oubliez pas, le programme A a également des comptes requis et des données en plus des chemins de preuve requis, chacun occupant de l'espace de transaction.

### Accès aux données sur un programme compressé d'état

Un compte compressé d'état ne stocke pas les données elles-mêmes. Il stocke plutôt la structure d'arbre de Merkle concurrent discutée ci-dessus. Les données brutes elles-mêmes résident uniquement dans l'**état du grand livre (ledger state)** de la blockchain, ce qui est moins cher. Cela rend l'accès aux données quelque peu plus difficile, mais pas impossible.

Le grand livre Solana est une liste d'entrées contenant des transactions signées. En théorie, cela peut être retracé jusqu'au bloc de genèse. Cela signifie effectivement que toutes les données qui ont déjà été intégrées à une transaction existent dans le grand livre.

Étant donné que le processus de hash de compression d'état se produit onchain, toutes les données existent dans l'état du grand livre et pourraient théoriquement être récupérées à partir de la transaction d'origine en rejouant l'ensemble de l'état de la chaîne depuis le début. Cependant, il est beaucoup plus simple (bien que toujours compliqué) d'avoir un **indexeur** qui suit et indexe ces données au fur et à mesure que les transactions se produisent. Cela garantit qu'il y a un "cache" off-chain des données que n'importe qui peut consulter et vérifier par la suite par rapport au hash racine onchain.

Ce processus est complexe, mais il aura du sens après quelques pratiques.

## Outils de compression d'état

La théorie décrite ci-dessus est essentielle pour comprendre correctement la compression d'état. Cependant, vous n'avez pas à implémenter cela de zéro. Des ingénieurs brillants ont posé la plupart des bases pour vous sous la forme du programme SPL State Compression et du programme Noop.

### Programmes SPL State Compression et Noop

Le programme SPL State Compression existe pour rendre le processus de création et de mise à jour d'arbres de Merkle concurrents reproductible et composable dans tout l'écosystème Solana. Il fournit des instructions pour initialiser des arbres de Merkle, gérer les feuilles de l'arbre (c'est-à-dire ajouter, mettre à jour, supprimer des données) et vérifier les données de la feuille.

Le programme de compression d'état utilise également un programme "no op" distinct dont le but principal est de faciliter l'indexation des données de la feuille en les écrivant dans l'état du grand livre. Lorsque vous souhaitez stocker des données compressées, vous les transmettez au programme de compression d'état où elles sont hashées et émises comme un "événement" au programme Noop. Le hash est stocké dans l'arbre de Merkle concurrent correspondant, mais les données brutes restent accessibles via les logs de transactions du programme Noop.

### Indexation des données pour une recherche facile

Dans des conditions normales, vous accéderiez généralement aux données onchain en récupérant le compte approprié. Cependant, lors de l'utilisation de la compression d'état, ce n'est pas aussi simple.

Comme mentionné ci-dessus, les données existent désormais dans l'état du grand livre plutôt que dans un compte. L'endroit le plus facile pour trouver les données complètes est dans les logs de l'instruction Noop. Malheureusement, bien que ces données existent d'une certaine manière dans l'état du grand livre pour toujours, elles seront probablement inaccessibles via les validateurs après un certain temps.

Pour économiser de l'espace et être plus performant, les validateurs ne conservent pas chaque transaction depuis le bloc de genèse. La période spécifique pendant laquelle vous pourrez accéder aux logs d'instructions Noop liés à vos données variera en fonction du validateur. À terme, vous perdrez l'accès si vous vous fiez directement aux logs d'instructions.

Techniquement, vous *pouvez* rejouer l'état des transactions jusqu'au bloc de genèse, mais une équipe normale ne le fera pas, et cela ne sera certainement pas performant. Le [Digital Asset Standard (DAS)](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) a été adopté par de nombreux fournisseurs RPC pour permettre des requêtes efficaces sur des NFT compressés et d'autres actifs. Cependant, au moment de la rédaction, il ne prend pas en charge la compression d'état arbitraire. Au lieu de cela, vous avez deux options principales :

1. Utiliser un fournisseur d'indexation qui construira une solution d'indexation personnalisée pour votre programme en observant les événements envoyés au programme Noop et en stockant les données pertinentes off-chain.
2. Créer votre propre solution d'indexation pseudo qui stocke les données de transaction off-chain.

Pour de nombreuses dApps, l'option 2 a beaucoup de sens. Les applications à plus grande échelle peuvent avoir besoin de s'appuyer sur des fournisseurs d'infrastructure pour gérer leur indexation.

## Processus de développement de la compression d'état

### Créer des types Rust

Comme pour un programme Anchor typique, l'une des premières choses à faire est de définir les types Rust de votre programme. Cependant, les types Rust dans un programme Anchor traditionnel représentent souvent des comptes. Dans un programme compressé d'état, l'état de votre compte ne stockera que l'arbre de Merkle. Le schéma de données "utilisable" sera simplement sérialisé et écrit dans le programme Noop.

Ce type doit inclure toutes les données stockées dans le nœud feuille et toutes les informations contextuelles nécessaires pour donner un sens aux données. Par exemple, si vous deviez créer un programme simple de messagerie, votre struct `Message` pourrait ressembler à ceci :

```rust
#[derive(AnchorSerialize)]
pub struct MessageLog {
		leaf_node: [u8; 32], // Le hash du nœud feuille
    from: Pubkey,        // Pubkey de l'expéditeur du message
		to: Pubkey,          // Pubkey du destinataire du message
    message: String,     // Le message à envoyer
}

impl MessageLog {
    // Construit un nouveau log de messages à partir du nœud feuille donné et du message
    pub fn new(leaf_node: [u8; 32], from: Pubkey, to: Pubkey, message: String) -> Self {
        Self { leaf_node, from, to, message }
    }
}
```

Pour être parfaitement clair, **il s'agit d'un compte que vous ne pourrez pas lire**. Votre programme créera une instance de ce type à partir des entrées d'instructions, ne construisant pas une instance de ce type à partir de données de compte qu'il lit. Nous discuterons de la lecture des données dans une section ultérieure.

### Initialiser un nouvel arbre

Les clients créeront et initialiseront le compte arbre de Merkle en deux instructions distinctes. La première consiste simplement à allouer le compte en appelant le programme Système. La seconde sera une instruction que vous créez dans un programme personnalisé qui initialise le nouveau compte. Cette initialisation consiste essentiellement à enregistrer la profondeur maximale et la taille du tampon pour l'arbre de Merkle.

Tout ce que cette instruction doit faire est de construire une CPI pour invoquer l'instruction `init_empty_merkle_tree` sur le programme de compression d'état. Comme cela nécessite la profondeur maximale et la taille maximale du tampon, celles-ci devront être transmises en tant qu'arguments à l'instruction.

N'oubliez pas, la profondeur maximale fait référence au nombre maximal de sauts pour aller de n'importe quelle feuille à la racine de l'arbre. La taille maximale du tampon fait référence à l'espace réservé pour stocker un log des mises à jour de l'arbre. Ce log est utilisé pour garantir que votre arbre peut prendre en charge des mises à jour concurrentes dans le même bloc.

Par exemple, si nous initialisions un arbre pour stocker des messages entre utilisateurs, l'instruction pourrait ressembler à ceci :

```rust
pub fn create_messages_tree(
    ctx: Context<MessageAccounts>,
    max_depth: u32, // Profondeur maximale de l'arbre de Merkle
    max_buffer_size: u32 // Taille maximale du tampon de l'arbre de Merkle
) -> Result<()> {
    // Obtenir l'adresse du compte arbre de Merkle
    let merkle_tree = ctx.accounts.merkle_tree.key();
    // Définir les seeds pour la signature PDA
    let signer_seeds: &[&[&[u8]]] = &[
        &[
            merkle_tree.as_ref(), // L'adresse du compte arbre de Merkle en tant que seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // La seed de décalage pour la PDA
        ],
    ];

    // Créer un contexte CPI pour l'instruction init_empty_merkle_tree.
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(), // Le programme de compression d'état SPL
        Initialize {
            authority: ctx.accounts.tree_authority.to_account_info(), // L'autorité pour l'arbre de Merkle, en utilisant une PDA
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // Le compte arbre de Merkle à initialiser
            noop: ctx.accounts.log_wrapper.to_account_info(), // Le programme noop pour enregistrer les données
        },
        signer_seeds // Les seeds pour la signature PDA
    );

    // CPI pour initialiser un arbre de Merkle vide avec la profondeur maximale et la taille du tampon
    init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)?;

    Ok(())
}
```

### Ajouter des hashs à l'arbre

Avec un arbre de Merkle initialisé, il est possible de commencer à ajouter des hashs de données. Cela implique de transmettre les données non compressées à une instruction de votre programme qui va hasher les données, les enregistrer dans le programme Noop et utiliser l'instruction `append` du programme de compression d'état pour ajouter le hash à l'arbre. Ce qui suit explique en détail ce que votre instruction doit faire :

1. Utilisez la fonction `hashv` de la crate `keccak` pour hasher les données. Dans la plupart des cas, vous voudrez également hasher le propriétaire ou l'autorité des données pour vous assurer qu'elles ne peuvent être modifiées que par la bonne autorité.
2. Créez un objet de log représentant les données que vous souhaitez enregistrer dans le programme Noop, puis appelez `wrap_application_data_v1` pour émettre une CPI vers le programme Noop avec cet objet. Cela garantit que les données non compressées sont facilement disponibles pour tout client qui les recherche. Pour des cas d'utilisation larges comme les cNFT, ce seraient les indexeurs. Vous pouvez également créer votre propre client observateur pour simuler ce que font les indexeurs mais spécifique à votre application.
3. Construisez et émettez une CPI vers l'instruction `append` du programme de compression d'état. Cela prend le hash calculé à l'étape 1 et l'ajoute à la prochaine feuille disponible de votre arbre de Merkle. Tout comme auparavant, cela nécessite l'adresse de l'arbre de Merkle et la seed de décalage de l'autorité de l'arbre en tant que seeds de signature.

Lorsque tout cela est mis ensemble en utilisant l'exemple de messagerie, cela ressemble à ceci :

```rust
// Instruction pour ajouter un message à un arbre.
pub fn append_message(ctx: Context<MessageAccounts>, message: String) -> Result<()> {
    // Hacher le message + la clé qui devrait avoir l'autorité de mise à jour
    let leaf_node = keccak::hashv(&[message.as_bytes(), ctx.accounts.sender.key().as_ref()]).to_bytes();
    // Créer un nouveau "log de messages" en utilisant le hash du nœud de feuille, l'expéditeur, le destinataire et le message
    let message_log = MessageLog::new(leaf_node.clone(), ctx.accounts.sender.key().clone(), ctx.accounts.receipient.key().clone(), message);
    // Enregistrer les données du "log de messages" en utilisant le programme noop
    wrap_application_data_v1(message_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;
    // Obtenir l'adresse du compte arbre de Merkle
    let merkle_tree = ctx.accounts.merkle_tree.key();
    // Définir les seeds pour la signature PDA
    let signer_seeds: &[&[&[u8]]] = &[
        &[
            merkle_tree.as_ref(), // L'adresse du compte arbre de Merkle en tant que seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // La seed de décalage pour la PDA
        ],
    ];
    // Créer un nouveau contexte CPI et ajouter le nœud de feuille à l'arbre de Merkle.
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(), // Le programme de compression d'état SPL
        Modify {
            authority: ctx.accounts.tree_authority.to_account_info(), // L'autorité pour l'arbre de Merkle, en utilisant une PDA
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // Le compte arbre de Merkle à modifier
            noop: ctx.accounts.log_wrapper.to_account_info(), // Le programme noop pour enregistrer les données
        },
        signer_seeds // Les seeds pour la signature PDA
    );
    // CPI pour ajouter le nœud de feuille à l'arbre de Merkle
    append(cpi_ctx, leaf_node)?;
    Ok(())
}
```

### Mettre à jour les hashs

Pour mettre à jour des données, vous devez créer un nouveau hash pour remplacer le hash à la feuille pertinente de l'arbre de Merkle. Pour ce faire, votre programme a besoin d'accéder à quatre éléments :

1. L'indice de la feuille à mettre à jour
2. Le hash racine de l'arbre de Merkle
3. Les données originales que vous souhaitez modifier
4. Les données mises à jour

Avec accès à ces données, une instruction de programme peut suivre des étapes très similaires à celles utilisées pour ajouter les données initiales à l'arbre :

1. **Vérifier l'autorité de mise à jour** - La première étape est nouvelle. Dans la plupart des cas, vous voulez vérifier l'autorité de mise à jour. Cela implique généralement de prouver que le signataire de la transaction `update` est le véritable propriétaire ou l'autorité de la feuille à l'indice donné. Étant donné que les données sont compressées sous forme de hash sur la feuille, nous ne pouvons pas simplement comparer la clé publique `authority` à une valeur stockée. Au lieu de cela, nous devons calculer le hash précédent en utilisant les anciennes données et l'`authority` répertoriée dans la structure de validation du compte. Ensuite, nous construisons et émettons une CPI vers l'instruction `verify_leaf` du programme de compression d'état en utilisant notre hash calculé.
2. **Hacher les nouvelles données** - Cette étape est la même que la première étape pour ajouter des données initiales. Utilisez la fonction `hashv` de la crate `keccak` pour hasher les nouvelles données et l'autorité de mise à jour, chacune avec leur représentation en octets correspondante.
3. **Enregistrer les nouvelles données** - Cette étape est la même que la deuxième étape pour ajouter des données initiales. Créez une instance de la structure de log et appelez `wrap_application_data_v1` pour émettre une CPI vers le programme Noop.
4. **Remplacer le hash de feuille existant** - Cette étape est légèrement différente de la dernière étape pour ajouter des données initiales. Construisez et émettez une CPI vers l'instruction `replace_leaf` du programme de compression d'état. Cela utilise l'ancien hash, le nouveau hash et l'indice de la feuille pour remplacer les données de la feuille à l'indice donné par le nouveau hash. Tout comme auparavant, cela nécessite l'adresse de l'arbre de Merkle et la seed de décalage de l'autorité de l'arbre en tant que seeds de signature.

Réunis dans une seule instruction, ce processus ressemble à ce qui suit :

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

    // Définir les seeds pour la signature PDA
    let signer_seeds: &[&[&[u8]]] = &[
        &[
            merkle_tree.as_ref(), // L'adresse du compte arbre de Merkle en tant que seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // La seed de décalage pour la PDA
        ],
    ];

    // Vérifier la feuille
    {
        if old_message == new_message {
            msg!("Les messages sont identiques !");
            return Ok(());
        }

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // Le programme de compression d'état SPL
            VerifyLeaf {
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // Le compte arbre de Merkle à modifier
            },
            signer_seeds // Les seeds pour la signature PDA
        );
        // Vérifier ou échouer
        verify_leaf(cpi_ctx, root, old_leaf, index)?;
    }

    let new_leaf = keccak
        ::hashv(&[new_message.as_bytes(), ctx.accounts.sender.key().as_ref()])
        .to_bytes();

    // Enregistrez le changement pour les indexeurs
    let message_log = MessageLog::new(new_leaf.clone(), ctx.accounts.sender.key().clone(), ctx.accounts.recipient.key().clone(), new_message);
    // Enregistrez les données du "log de messages" en utilisant le programme noop
    wrap_application_data_v1(message_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;

    // Remplacer la feuille
    {
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // Le programme de compression d'état SPL
            Modify {
                authority: ctx.accounts.tree_authority.to_account_info(), // L'autorité pour l'arbre de Merkle, en utilisant une PDA
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // Le compte arbre de Merkle à modifier
                noop: ctx.accounts.log_wrapper.to_account_info(), // Le programme noop pour enregistrer les données
            },
            signer_seeds // Les seeds pour la signature PDA
        );
        // CPI pour ajouter le nœud de feuille à l'arbre de Merkle
        replace_leaf(cpi_ctx, root, old_leaf, new_leaf, index)?;
    }

    Ok(())
}
```

### Supprimer des hashs

Au moment de la rédaction, le programme de compression d'état ne fournit pas d'instruction `delete` explicite. Au lieu de cela, vous voudrez mettre à jour les données de la feuille avec des données indiquant que les données sont "supprimées". Les données spécifiques dépendront de votre cas d'utilisation et de vos préoccupations en matière de sécurité. Certains peuvent opter pour définir toutes les données à 0, tandis que d'autres peuvent stocker une chaîne statique que tous les éléments "supprimés" auront en commun.

### Accéder aux données depuis un client

La discussion jusqu'à présent a couvert 3 des 4 procédures CRUD standard : Créer, Mettre à jour et Supprimer. Ce qui reste, c'est l'un des concepts les plus difficiles en compression d'état : la lecture des données.

Accéder aux données depuis un client est délicat principalement parce que les données ne sont pas stockées dans un format facile d'accès. Les hashs de données stockés dans l'arbre de Merkle ne peuvent pas être utilisés pour reconstruire les données initiales, et les données enregistrées dans le programme Noop ne sont pas disponibles indéfiniment.

Votre meilleure option est l'une des deux possibilités :

1. Travailler avec un fournisseur d'indexation pour créer une solution d'indexation personnalisée pour votre programme, puis écrire du code côté client basé sur la manière dont l'indexeur vous donne accès aux données.
2. Créer votre propre pseudo-indexeur comme solution plus légère.

Si votre projet est vraiment décentralisé de telle sorte que de nombreux participants interagiront avec votre programme par d'autres moyens que votre propre interface, alors l'option 2 pourrait ne pas être suffisante. Cependant, en fonction de l'échelle du projet ou du contrôle que vous aurez sur la plupart des accès au programme, cela peut être une approche viable.

Il n'y a pas de "bonne" façon de faire. Deux approches potentielles sont :

1. Stocker les données brutes dans une base de données en même temps que leur envoi au programme, avec la feuille à laquelle les données sont hashées et stockées.
2. Créer un serveur qui observe les transactions de votre programme, recherche les logs Noop associés, les décode et les stocke.

Nous ferons un peu des deux lors de l'écriture des tests dans le laboratoire de cette leçon (bien que nous ne persistions pas les données dans une base de données - elles ne resteront en mémoire que pendant la durée des tests).

La configuration pour cela est quelque peu fastidieuse. Pour une transaction particulière, vous pouvez récupérer la transaction auprès du fournisseur RPC, obtenir les instructions internes associées au programme Noop, utiliser la fonction `deserializeApplicationDataEvent` du package JS `@solana/spl-account-compression` pour obtenir les logs, puis les désérialiser en utilisant Borsh. Voici un exemple basé sur le programme de messagerie utilisé ci-dessus.

```tsx
export async function getMessageLog(connection: Connection, txSignature: string) {
  // Confirmer la transaction, sinon getTransaction renvoie parfois null
  const latestBlockHash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txSignature,
  })

  // Obtenir les informations sur la transaction en utilisant la signature de la transaction
  const txInfo = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  })

  // Obtenir les instructions internes liées à l'instruction du programme à l'index 0
  // Nous n'envoyons qu'une instruction dans la transaction de test, donc nous pouvons supposer la première
  const innerIx = txInfo!.meta?.innerInstructions?.[0]?.instructions

  // Obtenir les instructions internes qui correspondent à SPL_NOOP_PROGRAM_ID
  const noopInnerIx = innerIx.filter(
    (instruction) =>
      txInfo?.transaction.message.staticAccountKeys[
        instruction.programIdIndex
      ].toBase58() === SPL_NOOP_PROGRAM_ID.toBase58()
  )

  let messageLog: MessageLog
  for (let i = noopInnerIx.length - 1; i >= 0; i--) {
    try {
      // Tenter de décoder et désérialiser les données d'instruction
      const applicationDataEvent = deserializeApplicationDataEvent(
        Buffer.from(bs58.decode(noopInnerIx[i]?.data!))
      )

      // Obtenir les données d'application
      const applicationData = applicationDataEvent.fields[0].applicationData

      // Désérialiser les données d'application en instance MessageLog
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

## Conclusion

La compression d'état généralisée peut être difficile mais est tout à fait possible à implémenter avec les outils disponibles. De plus, les outils et programmes ne feront que s'améliorer avec le temps. Si vous trouvez des solutions qui améliorent votre expérience de développement, partagez-les avec la communauté !

# Laboratoire

Pratiquons la compression d'état généralisée en créant un nouveau programme Anchor. Ce programme utilisera une compression d'état personnalisée pour alimenter une application simple de prise de notes.

### 1. Configuration du projet

Commencez par initialiser un programme Anchor :

```bash
anchor init compressed-notes
```

Nous utiliserons la crate `spl-account-compression` avec la fonctionnalité `cpi` activée. Ajoutons-la en tant que dépendance dans `programs/compressed-notes/Cargo.toml`.

```toml
[dependencies]
anchor-lang = "0.28.0"
spl-account-compression = { version="0.2.0", features = ["cpi"] }
solana-program = "1.16.0"
```

Nous allons tester localement, mais nous avons besoin à la fois du programme Compression et du programme Noop de Mainnet. Nous devons les ajouter au fichier `Anchor.toml` à la racine pour qu'ils soient clonés sur notre cluster local.

```toml
[test.validator]
url = "https://api.mainnet-beta.solana.com"

[[test.validator.clone]]
address = "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"

[[test.validator.clone]]
address = "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
```

Enfin, préparons le fichier `lib.rs` pour le reste du tutoriel. Supprimez l'instruction `initialize` et la struct `Initialize` des comptes, puis ajoutez les imports indiqués dans le code ci-dessous (assurez-vous de mettre ***votre*** identifiant de programme) :

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

declare_id!("VOTRE_CLE_ICI");

// LES STRUCTURES VONT ICI

#[program]
pub mod compressed_notes {
    use super::*;

	// LES FONCTIONS VONT ICI
	
}
```

Pour le reste de ce tutoriel, nous apporterons des mises à jour au code du programme directement dans le fichier `lib.rs`. Cela simplifie un peu les explications. Vous êtes libre de modifier la structure comme bon vous semble.

N'hésitez pas à faire un build avant de continuer. Cela assure que votre environnement fonctionne correctement et raccourcit les temps de build futurs.

### 2. Définir le schéma `Note`

Ensuite, nous allons définir à quoi ressemble une note dans notre programme. Les notes devraient avoir les propriétés suivantes :

- `leaf_node` - il s'agit d'un tableau de 32 octets représentant le hash stocké sur le nœud feuille
- `owner` - la clé publique du propriétaire de la note
- `note` - la représentation sous forme de chaîne de la note

```rust
#[derive(AnchorSerialize)]
pub struct NoteLog {
    leaf_node: [u8; 32],  // Le hash du nœud feuille
    owner: Pubkey,        // Clé publique du propriétaire de la note
    note: String,         // Le message de la note
}

impl NoteLog {
    // Construit une nouvelle note à partir du nœud feuille et du message donnés
    pub fn new(leaf_node: [u8; 32], owner: Pubkey, note: String) -> Self {
        Self { leaf_node, owner, note }
    }
}
```

Dans un programme Anchor traditionnel, cela serait une struct d'account, mais comme nous utilisons la compression d'état, nos comptes ne refléteront pas nos structures natives. Comme nous n'avons pas besoin de toute la fonctionnalité d'un compte, nous pouvons simplement utiliser la macro `AnchorSerialize` au lieu de la macro `account`. 

### 3. Définir les comptes d'entrée et les contraintes

Par chance, chacune de nos instructions utilisera les mêmes comptes. Nous allons créer une seule struct `NoteAccounts` pour notre validation de compte. Elle aura les comptes suivants :

- `owner` - c'est le créateur et propriétaire de la note ; devrait être un signataire de la transaction
- `tree_authority` - l'autorité pour l'arbre de Merkle ; utilisée pour signer les CPI liées à la compression
- `merkle_tree` - l'adresse de l'arbre de Merkle utilisée pour stocker les hashs de notes ; sera non vérifiée car elle est validée par le programme de compression d'état
- `log_wrapper` - l'adresse du programme Noop
- `compression_program` - l'adresse du programme de compression d'état

```rust
#[derive(Accounts)]
pub struct NoteAccounts<'info> {
    // Le payeur de la transaction
    #[account(mut)]
    pub owner: Signer<'info>,

    // L'autorité pda pour l'arbre de Merkle, utilisée uniquement pour la signature
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: SystemAccount<'info>,

    // Le compte de l'arbre de Merkle
    /// VÉRIFIER : Ce compte est validé par le programme de compression d'état SPL
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    // Le programme Noop pour enregistrer des données
    pub log_wrapper: Program<'info, Noop>,

    // Le programme de compression d'état SPL
    pub compression_program: Program<'info, SplAccountCompression>,
}
```

### 4. Créer l'instruction `create_note_tree`

Ensuite, créons notre instruction `create_note_tree`. Rappelez-vous, les clients auront déjà alloué le compte de l'arbre de Merkle, mais utiliseront cette instruction pour l'initialiser.

Tout ce que cette instruction doit faire est de construire une CPI pour invoquer l'instruction `init_empty_merkle_tree` sur le programme de compression d'état. Pour ce faire, elle a besoin des comptes répertoriés dans la structure de validation du compte `NoteAccounts`. Elle a également besoin de deux arguments supplémentaires :

1. `max_depth` - la profondeur maximale de l'arbre de Merkle
2. `max_buffer_size` - la taille maximale du tampon de l'arbre de Merkle

Ces valeurs sont nécessaires pour initialiser les données sur le compte de l'arbre de Merkle. N'oubliez pas, la profondeur maximale fait référence au nombre maximal de sauts nécessaires pour passer de n'importe quelle feuille à la racine de l'arbre. La taille maximale du tampon fait référence à la quantité d'espace réservée pour stocker un log des mises à jour de l'arbre. Ce log des modifications est utilisé pour garantir que votre arbre peut prendre en charge des mises à jour concurrentes dans le même bloc.

```rust
#[program]
pub mod compressed_notes {
    use super::*;

    // Instruction pour créer un nouvel arbre de notes.
    pub fn create_note_tree(
        ctx: Context<NoteAccounts>,
        max_depth: u32,       // Profondeur maximale de l'arbre de Merkle
        max_buffer_size: u32, // Taille maximale du tampon de l'arbre de Merkle
    ) -> Result<()> {
        // Obtenez l'adresse du compte de l'arbre de Merkle
        let merkle_tree = ctx.accounts.merkle_tree.key();

        // Définissez les seeds pour la signature pda
        let signer_seeds: &[&[&[u8]]] = &[&[
            merkle_tree.as_ref(), // L'adresse du compte de l'arbre de Merkle en tant que seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // La seed de modification pour la pda
        ]];

        // Créez un contexte cpi pour l'instruction init_empty_merkle_tree.
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // Le programme de compression de compte spl
            Initialize {
                authority: ctx.accounts.tree_authority.to_account_info(), // L'autorité pour l'arbre de Merkle, en utilisant une PDA
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // Le compte de l'arbre de Merkle à initialiser
                noop: ctx.accounts.log_wrapper.to_account_info(), // Le programme noop pour enregistrer les données
            },
            signer_seeds, // Les seeds pour la signature pda
        );

        // CPI pour initialiser un arbre de Merkle vide avec une profondeur maximale et une taille maximale du tampon
        init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)?;
        Ok(())
    }

    //...
}
```

Assurez-vous que les seeds du signataire sur la CPI incluent à la fois l'adresse de l'arbre de Merkle et la seed d'autorité de l'arbre.

### 5. Créer l'instruction `append_note`

Maintenant, créons notre instruction `append_note`. Cette instruction doit prendre la note brute sous forme de chaîne et la compresser en un hash que nous stockerons sur l'arbre de Merkle. Nous enregistrerons également la note dans le programme Noop afin que l'ensemble des données existe dans l'état de la chaîne.

Les étapes ici sont les suivantes :

1. Utilisez la fonction `hashv` de la crate `keccak` pour hasher la note et le propriétaire, chacun sous sa représentation binaire correspondante. Il est ***crucial*** de hasher également le propriétaire ainsi que la note. C'est ainsi que nous vérifierons la propriété de la note avant les mises à jour dans l'instruction de mise à jour.
2. Créez une instance de la struct `NoteLog` en utilisant le hash de l'étape 1, la clé publique du propriétaire et la note brute en tant que chaîne. Ensuite, appelez `wrap_application_data_v1` pour émettre une CPI vers le programme Noop, en passant l'instance de `NoteLog`. Cela garantit que l'ensemble de la note (pas seulement le hash) est facilement disponible pour tout client qui le recherche. Pour des cas d'utilisation larges comme les cNFT, ce seraient les indexeurs. Vous pourriez créer votre client observateur pour simuler ce que font les indexeurs mais pour votre propre application.
3. Construisez et émettez une CPI vers l'instruction `append` du programme de compression d'état. Cela prend le hash calculé à l'étape 1 et l'ajoute à la prochaine feuille disponible sur votre arbre de Merkle. Comme précédemment, cela nécessite l'adresse de l'arbre de Merkle et la seed d'autorité de l'arbre en tant que seeds de signature.

```rust
#[program]
pub mod compressed_notes {
    use super::*;

    //...

    // Instruction pour ajouter une note à un arbre.
    pub fn append_note(ctx: Context<NoteAccounts>, note: String) -> Result<()> {
        // Hachez le "message de la note" qui sera stocké en tant que nœud feuille dans l'arbre de Merkle
        let leaf_node =
            keccak::hashv(&[note.as_bytes(), ctx.accounts.owner.key().as_ref()]).to_bytes();
        // Créez une nouvelle "note log" en utilisant le hash du nœud feuille et la note.
        let note_log = NoteLog::new(leaf_node.clone(), ctx.accounts.owner.key().clone(), note);
        // Enregistrez les données du "note log" en utilisant le programme noop
        wrap_application_data_v1(note_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;
        // Obtenez l'adresse du compte de l'arbre de Merkle
        let merkle_tree = ctx.accounts.merkle_tree.key();
        // Définissez les seeds pour la signature pda
        let signer_seeds: &[&[&[u8]]] = &[&[
            merkle_tree.as_ref(), // L'adresse du compte de l'arbre de Merkle en tant que seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // La seed de modification pour la pda
        ]];
        // Créez un nouveau contexte cpi et ajoutez le nœud feuille à l'arbre de Merkle.
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // Le programme de compression de compte spl
            Modify {
                authority: ctx.accounts.tree_authority.to_account_info(), // L'autorité pour l'arbre de Merkle, en utilisant une PDA
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // Le compte de l'arbre de Merkle à modifier
                noop: ctx.accounts.log_wrapper.to_account_info(), // Le programme noop pour enregistrer les données
            },
            signer_seeds, // Les seeds pour la signature pda
        );
        // CPI pour ajouter le nœud feuille à l'arbre de Merkle
        append(cpi_ctx, leaf_node)?;
        Ok(())
    }

    //...
}
```

### 6. Créer l'instruction `update_note`

La dernière instruction que nous allons créer est l'instruction `update_note`. Cela devrait remplacer une feuille existante par un nouveau hash représentant les nouvelles données de la note mise à jour.

Pour que cela fonctionne, nous aurons besoin des paramètres suivants :

1. `index` - l'indice de la feuille que nous allons mettre à jour
2. `root` - le hash de la racine de l'arbre de Merkle
3. `old_note` - la représentation sous forme de chaîne de la vieille note que nous mettons à jour
4. `new_note` - la représentation sous forme de chaîne de la nouvelle note que nous voulons mettre à jour

N'oubliez pas, les étapes ici sont similaires à `append_note`, mais avec quelques ajouts et modifications mineurs :

1. La première étape est nouvelle. Nous devons d'abord prouver que l'`owner` appelant cette fonction est le véritable propriétaire de la feuille à l'indice donné. Étant donné que les données sont compressées sous forme de hash sur la feuille, nous ne pouvons pas simplement comparer la clé publique de l'`owner` à une valeur stockée. Au lieu de cela, nous devons calculer le hash précédent en utilisant les anciennes données de la note et l'`owner` répertorié dans la structure de validation du compte. Ensuite, construisez et émettez une CPI vers l'instruction `verify_leaf` du programme de compression d'état en utilisant notre hash calculé.
2. Cette étape est la même que la première étape de la création de l'instruction `append_note`. Utilisez la fonction `hashv` du crate `keccak` pour hasher la nouvelle note et son propriétaire, chacun sous sa représentation binaire correspondante.
3. Cette étape est la même que la deuxième étape de la création de l'instruction `append_note`. Créez une instance de la struct `NoteLog` en utilisant le hash de l'étape 2, la clé publique du propriétaire et la nouvelle note en tant que chaîne. Ensuite, appelez `wrap_application_data_v1` pour émettre une CPI vers le programme Noop, en passant l'instance de `NoteLog`.
4. Cette étape est légèrement différente de la dernière étape de la création de l'instruction `append_note`. Construisez et émettez une CPI vers l'instruction `replace_leaf` du programme de compression d'état. Cela utilise l'ancien hash, le nouveau hash et l'indice de la feuille pour remplacer les données de la feuille à l'indice donné par le nouveau hash. Comme précédemment, cela nécessite l'adresse de l'arbre de Merkle et la seed d'autorité de l'arbre en tant que seeds de signature.

```rust
#[program]
pub mod compressed_notes {
    use super::*;

    //...

		pub fn update_note(
        ctx: Context<NoteAccounts>,
        index: u32,
        root: [u8; 32],
        old_note: String,
        new_note: String,
    ) -> Result<()> {
        let old_leaf =
            keccak::hashv(&[old_note.as_bytes(), ctx.accounts.owner.key().as_ref()]).to_bytes();

        let merkle_tree = ctx.accounts.merkle_tree.key();

        // Définissez les seeds pour la signature pda
        let signer_seeds: &[&[&[u8]]] = &[&[
            merkle_tree.as_ref(), // L'adresse du compte de l'arbre de Merkle en tant que seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // La seed de modification pour la pda
        ]];

        // Vérifier la feuille
        {
            if old_note == new_note {
                msg!("Les notes sont identiques !");
                return Ok(());
            }

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.compression_program.to_account_info(), // Le programme de compression de compte spl
                VerifyLeaf {
                    merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // Le compte de l'arbre de Merkle à modifier
                },
                signer_seeds, // Les seeds pour la signature pda
            );
            // Vérifiez ou échouez
            verify_leaf(cpi_ctx, root, old_leaf, index)?;
        }

        let new_leaf =
            keccak::hashv(&[new_note.as_bytes(), ctx.accounts.owner.key().as_ref()]).to_bytes();

        // Enregistrez pour les indexeurs
        let note_log = NoteLog::new(new_leaf.clone(), ctx.accounts.owner.key().clone(), new_note);
        // Enregistrez les données du "note log" en utilisant le programme noop
        wrap_application_data_v1(note_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;

        // Remplacez la feuille
        {
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.compression_program.to_account_info(), // Le programme de compression de compte spl
                Modify {
                    authority: ctx.accounts.tree_authority.to_account_info(), // L'autorité pour l'arbre de Merkle, en utilisant une PDA
                    merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // Le compte de l'arbre de Merkle à modifier
                    noop: ctx.accounts.log_wrapper.to_account_info(), // Le programme noop pour enregistrer les données
                },
                signer_seeds, // Les seeds pour la signature pda
            );
            // CPI pour ajouter le nœud feuille à l'arbre de Merkle
            replace_leaf(cpi_ctx, root, old_leaf, new_leaf, index)?;
        }

        Ok(())
    }
}
```
### 7. Configuration du test client

Nous allons écrire quelques tests pour nous assurer que notre programme fonctionne comme prévu. Tout d'abord, effectuons quelques configurations.

Nous allons utiliser le package `@solana/spl-account-compression`. Allez-y et installez-le :

```bash
yarn add @solana/spl-account-compression
```

Ensuite, nous allons vous fournir le contenu d'un fichier utilitaire que nous avons créé pour faciliter les tests. Créez un fichier `utils.ts` dans le répertoire `tests`, ajoutez le contenu ci-dessous, puis nous l'expliquerons.

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

// Une carte qui décrit la structure de Note pour la désérialisation de Borsh
const NoteLogBorshSchema = new Map([
  [
    NoteLog,
    {
      kind: "struct",
      fields: [
        ["leafNode", [32]], // Tableau de 32 `u8`
        ["owner", [32]], // Pubkey
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
  // Confirmez la transaction, sinon getTransaction renvoie parfois null
  const latestBlockHash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    blockhash: latestHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txSignature,
  })

  // Obtenez les informations sur la transaction en utilisant la signature tx
  const txInfo = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  })

  // Obtenez les instructions internes liées à l'instruction de programme à l'index 0
  // Nous n'envoyons qu'une instruction dans la transaction de test, nous pouvons donc supposer que c'est la première
  const innerIx = txInfo!.meta?.innerInstructions?.[0]?.instructions

  // Obtenez les instructions internes qui correspondent à SPL_NOOP_PROGRAM_ID
  const noopInnerIx = innerIx.filter(
    (instruction) =>
      txInfo?.transaction.message.staticAccountKeys[
        instruction.programIdIndex
      ].toBase58() === SPL_NOOP_PROGRAM_ID.toBase58()
  )

  let noteLog: NoteLog
  for (let i = noopInnerIx.length - 1; i >= 0; i--) {
    try {
      // Tentez de décoder et de désérialiser les données de l'instruction
      const applicationDataEvent = deserializeApplicationDataEvent(
        Buffer.from(bs58.decode(noopInnerIx[i]?.data!))
      )

      // Obtenez les données d'application
      const applicationData = applicationDataEvent.fields[0].applicationData

      // Désérialisez les données d'application en instance NoteLog
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

Il y a trois éléments principaux dans le fichier ci-dessus :

1. `NoteLog` - une classe représentant le log de notes que nous trouverons dans les logs du programme Noop. Nous avons également ajouté le schéma borsh en tant que `NoteLogBorshSchema` pour la désérialisation.
2. `getHash` - une fonction qui crée un hash de la note et du propriétaire de la note afin que nous puissions le comparer à ce que nous trouvons sur l'arbre de Merkle.
3. `getNoteLog` - une fonction qui parcourt les logs de la transaction fournie, trouve les logs du programme Noop, puis désérialise et renvoie le log de notes correspondant.

### 8. Écriture des tests client

Maintenant que nous avons nos packages installés et notre fichier utilitaire prêt, plongeons-nous dans les tests eux-mêmes. Nous allons en créer quatre :

1. Créer l'arbre de notes - cela créera l'arbre de Merkle que nous utiliserons pour stocker les hashs des notes.
2. Ajouter une note - cela appellera notre instruction `append_note`.
3. Ajouter une note de taille maximale - cela appellera notre instruction `append_note` avec une note qui atteint la taille maximale de 1232 octets autorisée dans une seule transaction.
4. Mettre à jour la première note - cela appellera notre instruction `update_note` pour modifier la première note que nous avons ajoutée.

Le premier test est principalement pour la configuration. Dans les trois derniers tests, nous vérifierons à chaque fois que le hash de la note sur l'arbre correspond à ce que nous attendons compte tenu du texte de la note et du signataire.

Commençons par les importations. Il y en a plusieurs de Anchor, `@solana/web3.js`, `@solana/spl-account-compression`, et notre propre fichier utils.

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

Ensuite, nous voudrons configurer les variables d'état que nous utiliserons tout au long de nos tests. Cela inclut la configuration par défaut d'Anchor ainsi que la génération d'une paire de clés pour l'arbre de Merkle, l'autorité de l'arbre, et quelques notes.

```tsx
describe("compressed-notes", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const connection = new Connection(
    provider.connection.rpcEndpoint,
    "confirmed" // doit être confirmé pour certaines des méthodes ci-dessous
  )

  const wallet = provider.wallet as anchor.Wallet
  const program = anchor.workspace.CompressedNotes as Program<CompressedNotes>

  // Générez une nouvelle paire de clés pour le compte de l'arbre de Merkle
  const merkleTree = Keypair.generate()

  // Dérivez la PDA à utiliser comme autorité de l'arbre de Merkle
  // Il s'agit d'une PDA dérivée du programme Note, qui permet au programme de signer des instructions d'ajout à l'arbre
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [merkleTree.publicKey.toBuffer()],
    program.programId
  )

	const firstNote = "hello world"
  const secondNote = "0".repeat(917)
  const updatedNote = "note mise à jour"


  // LES TESTS VONT ICI

});
```

Enfin, commençons par les tests eux-mêmes. Tout d'abord, le test `Create Note Tree`. Ce test fera deux choses :

1. Allouer un nouveau compte pour l'arbre de Merkle avec une profondeur maximale de 3, une taille de tampon maximale de 8, et une profondeur de canopée de 0.
2. Initialiser ce nouveau compte en utilisant l'instruction `createNoteTree` de notre programme.

```tsx
it("Create Note Tree", async () => {
  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  // instruction pour créer un nouveau compte avec l'espace requis pour l'arbre
  const allocTreeIx = await createAllocTreeIx(
    connection,
    merkleTree.publicKey,
    wallet.publicKey,
    maxDepthSizePair,
    canopyDepth
  )

  // instruction pour initialiser l'arbre via le programme Note
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

Ensuite, nous allons créer le test `Add Note`. Il devrait appeler `append_note` avec `firstNote`, puis vérifier que le hash onchain correspond à notre hash calculé et que le log de notes correspond au texte de la note que nous avons passé à l'instruction.

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

Ensuite, nous allons créer le test `Add Max Size Note`. C'est la même chose que le test précédent, mais avec la deuxième note.

```tsx
it("Add Max Size Note", async () => {
  // La taille de la note est limitée par la taille maximale de la transaction de 1232 octets, moins les données supplémentaires requises pour l'instruction
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

Enfin, nous allons créer le test `Update First Note`. C'est légèrement plus complexe que d'ajouter une note. Nous ferons ce qui suit :

1. Obtenez la racine de l'arbre de Merkle car elle est requise par l'instruction.
2. Appelez l'instruction `update_note` de notre programme, en passant l'index 0 (pour la première note), la racine de l'arbre de Merkle, la première note et les données mises à jour. N'oubliez pas, il a besoin de la première note et de la racine car le programme doit vérifier tout le chemin de preuve pour la feuille de la note avant qu'elle ne puisse être mise à jour.

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

C'est tout, félicitations ! Lancez `anchor test` et vous devriez obtenir quatre tests réussis.

Si vous rencontrez des problèmes, n'hésitez pas à revenir en arrière dans la démo ou consultez le code de solution complet dans le [dépôt Compressed Notes](https://github.com/unboxed-software/anchor-compressed-notes).

# Défi

Maintenant que vous avez pratiqué les bases de la compression d'état, ajoutez une nouvelle instruction au programme Compressed Notes. Cette nouvelle instruction devrait permettre aux utilisateurs de supprimer une note existante. Gardez à l'esprit que vous ne pouvez pas supprimer une feuille de l'arbre, donc vous devrez décider à quoi ressemble la "suppression" pour votre programme. Bonne chance !

Si vous souhaitez un exemple très simple d'une fonction de suppression, consultez la [branche `solution` sur GitHub](https://github.com/Unboxed-Software/anchor-compressed-notes/tree/solution).

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=60f6b072-eaeb-469c-b32e-5fea4b72d1d1) !
---
title: Créer un programme de base, Partie 3 - Sécurité de base et validation
objectives:
- Expliquer l'importance de "penser comme un attaquant"
- Comprendre les pratiques de sécurité de base
- Effectuer des vérifications de propriétaire
- Effectuer des vérifications de signataire
- Valider les comptes transmis au programme
- Effectuer une validation de données de base
---

# Résumé

- **Penser comme un attaquant** signifie se demander "Comment puis-je casser cela ?"
- Effectuer des **vérifications de propriétaire** pour s'assurer que le compte fourni est détenu par la clé publique attendue, par exemple, en veillant à ce qu'un compte attendu pour être un compte de PDA soit détenu par `program_id`
- Effectuer des **vérifications de signataire** pour s'assurer que toute modification de compte a été signée par la partie ou les parties appropriées
- La **validation de compte** implique de s'assurer que les comptes fournis sont ceux que vous attendez, par exemple, en dérivant des PDA avec les seeds attendues pour vous assurer que l'adresse correspond au compte fourni
- La **validation de données** implique de s'assurer que toutes les données fournies répondent aux critères requis par le programme

# Aperçu général

Au cours des deux dernières leçons, nous avons travaillé ensemble pour créer un programme d'avis de film. Le résultat final est plutôt cool ! C'est excitant de faire fonctionner quelque chose dans un nouvel environnement de développement.

Cependant, le développement de programmes approprié ne se termine pas à "le faire fonctionner". Il est important de réfléchir aux points de défaillance possibles dans votre code afin de les atténuer. Les points de défaillance sont là où un comportement indésirable dans votre code pourrait potentiellement se produire. Que le comportement indésirable se produise en raison des utilisateurs interagissant avec votre programme de manière inattendue ou que des acteurs malveillants essaient intentionnellement d'exploiter votre programme, anticiper les points de défaillance est essentiel pour le développement sécurisé d'un programme.

Rappelez-vous, **vous n'avez aucun contrôle sur les transactions qui seront envoyées à votre programme une fois déployé**. Vous ne pouvez contrôler que la manière dont votre programme les gère. Bien que cette leçon soit loin d'être une vue d'ensemble complète de la sécurité des programmes, nous aborderons certains des écueils de base à éviter.

## Pensez comme un attaquant

[Neodyme](https://workshop.neodyme.io/) a présenté une conférence à Breakpoint 2021 intitulée "Penser comme un attaquant : amener les contrats intelligents à leur point de rupture". S'il y a une chose à retenir de cette leçon, c'est que vous devez penser comme un attaquant.

Dans cette leçon, bien sûr, nous ne pouvons pas couvrir tout ce qui pourrait mal tourner avec vos programmes. En fin de compte, chaque programme aura des risques de sécurité différents associés. Bien comprendre les pièges courants est *essentiel* pour concevoir de bons programmes, mais cela est *insuffisant* pour déployer des programmes sécurisés. Pour avoir la couverture de sécurité la plus large possible, vous devez aborder votre code avec la bonne mentalité.

Comme Neodyme l'a mentionné dans sa présentation, la bonne mentalité nécessite de passer de la question "Est-ce que cela fonctionne ?" à "Comment puis-je le casser ?" C'est la première et la plus essentielle étape pour comprendre ce que votre code *fait réellement* par opposition à ce que vous l'avez écrit pour faire.

### Tous les programmes peuvent être cassés

Ce n'est pas une question de "si".

C'est plutôt une question de "combien d'efforts et de dévouement cela prendrait-il".

Notre travail en tant que développeurs est de fermer autant de failles que possible et d'augmenter les efforts et le dévouement nécessaires pour casser notre code. Par exemple, dans le programme d'avis de film que nous avons construit ensemble au cours des deux dernières leçons, nous avons écrit du code pour créer de nouveaux comptes pour stocker des avis de film. Si nous examinons de plus près le code, cependant, nous remarquerons comment le programme facilite également beaucoup de comportements involontaires que nous pourrions facilement détecter en se demandant "Comment puis-je le casser ?" Nous examinerons certains de ces problèmes et comment les résoudre dans cette leçon, mais n'oubliez pas que mémoriser quelques pièges n'est pas suffisant. C'est à vous de changer votre mentalité vis-à-vis de la sécurité.

## Gestion des erreurs

Avant d'aborder certains des écueils de sécurité courants et de savoir comment les éviter, il est important de savoir comment utiliser les erreurs dans votre programme. Bien que votre code puisse gérer certains problèmes de manière élégante, d'autres problèmes nécessiteront l'arrêt de l'exécution de votre programme et le retour d'une erreur de programme.

### Comment créer des erreurs

Bien que la crate `solana_program` fournisse une énumération `ProgramError` avec une liste d'erreurs génériques que nous pouvons utiliser, il sera souvent utile de créer les vôtres. Vos erreurs personnalisées pourront fournir plus de contexte et de détails pendant le débogage de votre code.

Nous pouvons définir nos propres erreurs en créant un type énuméré listant les erreurs que nous voulons utiliser. Par exemple, `NoteError` contient les variantes `Forbidden` et `InvalidLength`. L'énumération est transformée en un type `Error` Rust en utilisant l'attribut de macro `derive` pour implémenter le trait `Error` de la bibliothèque `thiserror`. Chaque type d'erreur a également sa propre notation `#[error("...")]`, ce qui vous permet de fournir un message d'erreur pour chaque type d'erreur particulier.

```rust
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Error)]
pub enum NoteError {
    #[error("Propriétaire de la note incorrect")]
    Forbidden,

    #[error("Le texte est trop long")]
    InvalidLength,
}
```

### Comment retourner des erreurs

Le compilateur attend que les erreurs renvoyées par le programme soient de type `ProgramError` de la crate `solana_program`. Cela signifie que nous ne pourrons pas retourner notre erreur personnalisée à moins d'avoir un moyen de la convertir en ce type. L'implémentation suivante gère la conversion entre notre erreur personnalisée et le type `ProgramError`.

```rust
impl From<NoteError> for ProgramError {
    fn from(e: NoteError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Pour retourner l'erreur personnalisée du programme, utilisez simplement la méthode `into()` pour convertir l'erreur en une instance de `ProgramError`.

```rust
if pda != *note_pda.key {
    return Err(NoteError::Forbidden.into());
}
```

## Vérifications de sécurité de base

Bien que celles-ci ne sécurisent pas de manière exhaustive votre programme, il existe quelques vérifications de sécurité que vous pouvez garder à l'esprit pour combler certaines des lacunes plus importantes de votre code :

- Vérifications de propriété - utilisées pour vérifier qu'un compte est détenu par le programme
- Vérifications de signataire - utilisées pour vérifier qu'un compte a signé une transaction
- Validation générale de compte - utilisée pour vérifier qu'un compte est le compte attendu
- Validation de données - utilisée pour vérifier que les entrées fournies par un utilisateur sont valides

### Vérifications de propriété

Une vérification de propriété vérifie qu'un compte est détenu par la clé publique attendue. Prenons l'exemple d'une application de prise de notes que nous avons mentionnée dans les leçons précédentes. Dans cette application, les utilisateurs peuvent créer, mettre à jour et supprimer des notes stockées par le programme dans des comptes PDA.

Lorsqu'un utilisateur invoque l'instruction `update`, il fournit également un `pda_account`. Nous présumons que le `pda_account` fourni est pour la note particulière qu'ils veulent mettre à jour, mais l'utilisateur peut entrer n'importe quelle donnée d'instruction qu'il veut. Il pourrait même potentiellement envoyer des données qui correspondent au format de données d'un compte de note mais qui n'ont pas été créées par le programme de prise de notes. Cette vulnérabilité de sécurité est une façon potentielle d'introduire un code malveillant.

La manière la plus simple d'éviter ce problème est de toujours vérifier que le propriétaire d'un compte est la clé publique que vous vous attendez qu'il soit. Dans ce cas, nous nous attendons à ce que le compte de note soit un compte PDA détenu par le programme lui-même. Lorsque ce n'est pas le cas, nous pouvons le signaler comme une erreur en conséquence.

```rust
if note_pda.owner != program_id {
    return Err(ProgramError::InvalidNoteAccount);
}
```

En passant, l'utilisation de PDAs chaque fois que possible est plus sécurisée que de faire confiance à des comptes détenus à l'extérieur, même s'ils sont détenus par le signataire de la transaction. Les seuls comptes sur lesquels le programme a un contrôle complet sont les comptes PDA, ce qui les rend les plus sécurisés.

### Vérifications de signataire

Une vérification de signataire vérifie simplement que les bonnes parties ont signé une transaction. Dans l'application de prise de notes, par exemple, nous voudrions vérifier que le créateur de la note a signé la transaction avant de traiter l'instruction `update`. Sinon, n'importe qui pourrait mettre à jour les notes d'un autre utilisateur en passant simplement la clé publique de l'utilisateur en tant qu'initialiseur.

```rust
if !initializer.is_signer {
    msg!("Signature requise manquante");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validation générale de compte

En plus de vérifier les signataires et les propriétaires des comptes, il est important de s'assurer que les comptes fournis sont ceux que votre code s'attend à recevoir. Par exemple, vous voudriez valider qu'un compte PDA fourni peut dériver des seeds attendues. Cela garantit qu'il s'agit du compte que vous vous attendez.

Dans l'exemple de l'application de prise de notes, cela signifierait s'assurer que vous pouvez dériver une PDA correspondante en utilisant la clé publique du créateur de la note et l'ID en tant que seeds (c'est ce que nous supposons avoir été utilisé lors de la création de la note). Ainsi, un utilisateur ne pourrait pas accidentellement transmettre un compte PDA pour la mauvaise note ou, plus important encore, que l'utilisateur ne transmette pas un compte PDA qui représente la note de quelqu'un d'autre.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);

if pda != *note_pda.key {
    msg!("Seeds invalides pour la PDA");
    return Err(ProgramError::InvalidArgument)
}
```

## Validation de données

Tout comme pour la validation des comptes, vous devez également valider toutes les données fournies par le client.

Par exemple, vous pouvez avoir un programme de jeu où un utilisateur peut attribuer des points d'attribut de personnage à différentes catégories. Vous pouvez avoir une limite maximale dans chaque catégorie de 100, auquel cas vous voudriez vérifier que l'allocation existante de points plus la nouvelle allocation ne dépasse pas le maximum.

```rust
if character.agility + new_agility > 100 {
    msg!("Les points d'attribut ne peuvent pas dépasser 100");
    return Err(AttributeError::TooHigh.into())
}
```

Ou le personnage peut avoir une allocation de points d'attribut qu'il peut attribuer et vous voulez vous assurer qu'il ne dépasse pas cette allocation.

```rust
if attribute_allowance < new_agility {
    msg!("Tentative d'attribuer plus de points autorisés");
    return Err(AttributeError::ExceedsAllowance.into())
}
```

Sans ces vérifications, le comportement du programme différerait de ce à quoi vous vous attendez. Dans certains cas, cependant, ce n'est pas seulement une question de comportement indéfini. Parfois, le défaut de valider les données peut entraîner des failles de sécurité financièrement dévastatrices.

Par exemple, imaginez que le personnage référencé dans ces exemples est un jeton non fongible (NFT). De plus, imaginez que le programme autorise le NFT à être mis en jeu pour gagner des récompenses en jetons proportionnelles au nombre de points d'attribut de NFT. L'absence de mise en œuvre de ces vérifications de validation des données permettrait à un acteur malveillant d'assigner un nombre obscènement élevé de points d'attribut et de vider rapidement votre trésorerie de toutes les récompenses qui étaient censées être réparties plus uniformément parmi un plus grand nombre de dépositaires.

### Débordement et sous-débordement d'entiers

Les entiers Rust ont des tailles fixes. Cela signifie qu'ils ne peuvent prendre en charge qu'une plage spécifique de nombres. Une opération arithmétique qui résulte en une valeur plus élevée ou plus basse que ce que peut prendre en charge la plage fera en sorte que la valeur résultante s'enroule. Par exemple, un `u8` ne prend en charge que les nombres de 0 à 255, de sorte que le résultat d'une addition qui serait 256 serait en réalité 0, 257 serait 1, etc.

C'est toujours important de garder cela à l'esprit, mais surtout lorsque vous travaillez avec un code qui représente une vraie valeur, comme le dépôt et le retrait de jetons.

Pour éviter le débordement et le sous-débordement d'entiers, il est nécessaire de :

1. Avoir une logique en place qui garantit que le débordement ou le sous-débordement *ne peut pas* se produire ou
2. Utiliser des opérations mathématiques vérifiées comme `checked_add` au lieu de `+`
    ```rust
    let first_int: u8 = 5;
    let second_int: u8 = 255;
    let sum = first_int.checked_add(second_int);
    ```

# Laboratoire

Pratiquons ensemble avec le programme de critique de film sur lequel nous avons travaillé lors des leçons précédentes. Pas de soucis si vous arrivez à cette leçon sans avoir fait la précédente, vous devriez pouvoir suivre de toute façon.

Pour rappel, le programme permet aux utilisateurs de stocker des critiques de films dans des comptes PDA. La dernière fois, nous avons terminé la mise en œuvre de la fonctionnalité de base pour ajouter une critique de film. Maintenant, nous allons ajouter quelques vérifications de sécurité à la fonctionnalité que nous avons déjà créée et ajouter la capacité de mettre à jour une critique de film de manière sécurisée.

Comme auparavant, nous utiliserons [Solana Playground](https://beta.solpg.io/) pour écrire, construire et déployer notre code.

## 1. Obtenir le code de départ

Pour commencer, vous pouvez trouver [le code de départ pour la critique de film](https://beta.solpg.io/62b552f3f6273245aca4f5c9). Si vous avez suivi les laboratoires sur ce programme, vous remarquerez que nous avons refactorisé notre programme.

Le code de départ refactorisé est presque le même qu'auparavant. Comme `lib.rs` devenait assez grand et difficile à manipuler, nous avons séparé son code en 3 fichiers : `lib.rs`, `entrypoint.rs` et `processor.rs`. `lib.rs` ne fait maintenant *que* enregistrer les modules du code, `entrypoint.rs` définit et détermine le point d'entrée du programme, et `processor.rs` gère la logique du programme pour traiter les instructions. Nous avons également ajouté un fichier `error.rs` où nous définirons des erreurs personnalisées. La structure complète du fichier est la suivante :

- **lib.rs** - enregistre les modules
- **entrypoint.rs** - point d'entrée du programme
- **instruction.rs** - sérialise et désérialise les données d'instruction
- **processor.rs** - logique du programme pour traiter les instructions
- **state.rs** - sérialise et désérialise l'état
- **error.rs** - erreurs personnalisées du programme

En plus de quelques modifications de la structure du fichier, nous avons mis à jour une petite partie du code pour que ce laboratoire soit plus axé sur la sécurité sans que vous ayez à écrire de code superflu.

Comme nous allons autoriser les mises à jour des critiques de films, nous avons également modifié `account_len` dans la fonction `add_movie_review` (maintenant dans `processor.rs`). Au lieu de calculer la taille de la critique et de définir la longueur du compte aussi grande qu'elle doit l'être, nous allons simplement allouer 1000 octets à chaque compte de critique. De cette façon, nous n'aurons pas à nous soucier de la réallocation de la taille ou du recalcul du loyer lorsque l'utilisateur met à jour sa critique de film.

Nous sommes passés de ceci :
```rust
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
```
À ceci :
```rust
let account_len: usize = 1000;
```

La méthode [realloc](https://docs.rs/solana-sdk/latest/solana_sdk/account_info/struct.AccountInfo.html#method.realloc) a été récemment activée par Solana Labs, ce qui vous permet de changer dynamiquement la taille de vos comptes. Nous n'utiliserons pas cette méthode pour ce laboratoire, mais il est bon d'en être conscient.

Enfin, nous avons également implémenté une fonctionnalité supplémentaire pour notre struct `MovieAccountState` dans `state.rs` en utilisant le mot-clé `impl`.

Pour nos critiques de films, nous voulons la possibilité de vérifier si un compte a déjà été initialisé. Pour ce faire, nous créons une fonction `is_initialized` qui vérifie le champ `is_initialized` de la struct `MovieAccountState`.

`Sealed` est la version de Solana du trait `Sized` de Rust. Cela spécifie simplement que `MovieAccountState` a une taille connue et permet certaines optimisations du compilateur.

```rust
// à l'intérieur de state.rs
impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Avant de passer à la suite, assurez-vous d'avoir une compréhension solide de l'état actuel du programme. Parcourez le code et passez du temps à réfléchir aux endroits qui vous semblent confus. Il peut être utile de comparer le code de départ avec le [code solution de la leçon précédente](https://beta.solpg.io/62b23597f6273245aca4f5b4).

## 2. Erreurs personnalisées

Commençons par écrire nos erreurs personnalisées du programme. Nous aurons besoin d'erreurs que nous pouvons utiliser dans les situations suivantes :

- L'instruction de mise à jour a été invoquée sur un compte qui n'a pas encore été initialisé
- La PDA fournie ne correspond pas à la PDA attendue ou dérivée
- Les données d'entrée dépassent la longueur maximale autorisée par le programme
- La note fournie n'est pas comprise entre 1 et 5

Le code de départ inclut un fichier `error.rs` vide. Ouvrez ce fichier et ajoutez des erreurs pour chacun des cas ci-dessus.

```rust
// à l'intérieur de error.rs
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReviewError{
    // Erreur 0
    #[error("Compte non initialisé")]
    UninitializedAccount,
    // Erreur 1
    #[error("La PDA dérivée ne correspond pas à la PDA fournie")]
    InvalidPDA,
    // Erreur 2
    #[error("Les données d'entrée dépassent la longueur maximale")]
    InvalidDataLength,
    // Erreur 3
    #[error("Note supérieure à 5 ou inférieure à 1")]
    InvalidRating,
}

impl From<ReviewError> for ProgramError {
    fn from(e: ReviewError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Notez qu'en plus d'ajouter les cas d'erreur, nous avons également ajouté l'implémentation qui nous permet de convertir notre erreur en un type `ProgramError` au besoin.

Avant de passer à la suite, faisons venir `ReviewError` dans la portée de `processor.rs`. Nous utiliserons ces erreurs sous peu lorsque nous ajouterons nos vérifications de sécurité.

```rust
// à l'intérieur de processor.rs
use crate::error::ReviewError;
```

## 3. Ajouter des vérifications de sécurité à `add_movie_review`

Maintenant que nous avons des erreurs à utiliser, ajoutons des vérifications de sécurité à notre fonction `add_movie_review`.

### Vérification du signataire

La première chose que nous devrions faire est de nous assurer que l'`initializer` d'une critique est également un signataire de la transaction. Cela garantit que vous ne pouvez pas soumettre des critiques de films en se faisant passer pour quelqu'un d'autre. Nous placerons cette vérification juste après l'itération sur les comptes.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;

if !initializer.is_signer {
    msg!("Signature requise manquante");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validation du compte

Ensuite, assurons-nous que la `pda_account` fournie par l'utilisateur est la `pda` que nous attendons. Rappelez-vous que nous avons dérivé la `pda` pour une critique de film en utilisant l'`initializer` et le `title` comme seeds. Dans notre instruction, nous dériverons à nouveau la `pda` puis vérifierons si elle correspond à la `pda_account`. Si les adresses ne correspondent pas, nous retournerons notre erreur personnalisée `InvalidPDA`.

```rust
// Dérivez la PDA et vérifiez si elle correspond au client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref()], program_id);

if pda != *pda_account.key {
    msg!("Seeds invalides pour la PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Validation des données

Maintenant, effectuons quelques validations des données.

Commençons par nous assurer que `rating` est comprise entre 1 et 5. Si la note fournie par l'utilisateur est en dehors de cette plage, nous retournerons notre erreur personnalisée `InvalidRating`.

```rust
if rating > 5 || rating < 1 {
    msg!("La note ne peut pas être supérieure à 5");
    return Err(ReviewError::InvalidRating.into())
}
```

Ensuite, vérifions que le contenu de la critique ne dépasse pas les 1000 octets que nous avons alloués pour le compte. Si la taille dépasse 1000 octets, nous retournerons notre erreur personnalisée `InvalidDataLength`.

```rust
let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("La longueur des données est supérieure à 1000 octets");
    return Err(ReviewError::InvalidDataLength.into())
}
```

Enfin, vérifions si le compte a déjà été initialisé en appelant la fonction `is_initialized` que nous avons implémentée pour notre `MovieAccountState`. Si le compte existe déjà, nous retournerons une erreur.

```rust
if account_data.is_initialized() {
    msg!("Compte déjà initialisé");
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

Dans l'ensemble, la fonction `add_movie_review` devrait ressembler à quelque chose comme ceci :

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Ajout d'une critique de film...");
    msg!("Titre : {}", title);
    msg!("Note : {}", rating);
    msg!("Description : {}", description);

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        msg!("Signature requise manquante");
        return Err(ProgramError::MissingRequiredSignature)
    }

    let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref()], program_id);
    if pda != *pda_account.key {
        msg!("Seeds invalides pour la PDA");
        return Err(ProgramError::InvalidArgument)
    }

    if rating > 5 || rating < 1 {
        msg!("La note ne peut pas être supérieure à 5");
        return Err(ReviewError::InvalidRating.into())
    }

    let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
    if total_len > 1000 {
        msg!("La longueur des données est supérieure à 1000 octets");
        return Err(ReviewError::InvalidDataLength.into())
    }

    let account_len: usize = 1000;

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    invoke_signed(
        &system_instruction::create_account(
        initializer.key,
        pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[initializer.clone(), pda_account.clone(), system_program.clone()],
        &[&[initializer.key.as_ref(), title.as_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("PDA créé : {}", pda);

    msg!("Déballage du compte d'état");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("Données du compte empruntées");

    msg!("Vérification si le compte de film est déjà initialisé");
    if account_data.is_initialized() {
        msg!("Compte déjà initialisé");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    account_data.title = title;
    account_data.rating = rating;
    account_data.description = description;
    account_data.is_initialized = true;

    msg!("Sérialisation du compte");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("Compte d'état sérialisé");

    Ok(())
}
```

## 4. Prendre en charge les mises à jour de critiques de films dans `MovieInstruction`

Maintenant que `add_movie_review` est plus sécurisé, tournons notre attention vers le support de la possibilité de mettre à jour une critique de film.

Commençons par mettre à jour `instruction.rs`. Nous commencerons par ajouter une variante `UpdateMovieReview` à `MovieInstruction` qui inclut des données intégrées pour le nouveau titre, la nouvelle note et la nouvelle description.

```rust
// à l'intérieur de instruction.rs
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
    }
}
```

La structure de charge utile peut rester la même puisque, en dehors du type de variante, les données d'instruction sont les mêmes que celles que nous avons utilisées pour `AddMovieReview`.

Enfin, dans la fonction `unpack`, nous devons ajouter `UpdateMovieReview` à l'instruction `match`.

```rust
// à l'intérieur de instruction.rs
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            1 => Self::UpdateMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

## 5. Définir la fonction `update_movie_review`

Maintenant que nous pouvons déballer notre `instruction_data` et déterminer quelle instruction du programme exécuter, ajoutons `UpdateMovieReview` à l'instruction `match` dans la fonction `process_instruction` dans le fichier `processor.rs`.

```rust
// à l'intérieur de processor.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // déballer les données d'instruction
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        // ajouter UpdateMovieReview à la correspondance avec notre nouvelle structure de données
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            // effectuer l'appel à la fonction de mise à jour que nous définirons ensuite
            update_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

Ensuite, nous pouvons définir la nouvelle fonction `update_movie_review`. La définition devrait avoir les mêmes paramètres que la définition de `add_movie_review`.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

}
```

## 6. Implémenter la fonction `update_movie_review`

Tout ce qui reste maintenant est de remplir la logique de mise à jour d'une critique de film. Mais commençons par la rendre sécurisée dès le départ.

Tout comme la fonction `add_movie_review`, commençons par itérer à travers les comptes. Les seuls comptes dont nous aurons besoin sont les deux premiers : `initializer` et `pda_account`.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Mise à jour de la critique de film...");

    // Obtenez l'itérateur de compte
    let account_info_iter = &mut accounts.iter();

    // Obtenez les comptes
    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

}
```

### Vérification de propriété

Avant de continuer, implémentons quelques vérifications de sécurité de base. Commençons par une vérification de propriété sur `pda_account` pour vérifier qu'il appartient à notre programme. Si ce n'est pas le cas, nous retournerons une erreur `InvalidOwner`.

```rust
if pda_account.owner != program_id {
    return Err(ProgramError::InvalidOwner)
}
```

### Vérification du signataire

Ensuite, effectuons une vérification du signataire pour vérifier que l'`initializer` de l'instruction de mise à jour a également signé la transaction. Comme nous mettons à jour les données d'une critique de film, nous voulons nous assurer que l'`initializer` d'origine de la critique a approuvé les modifications en signant la transaction. Si l'`initializer` n'a pas signé la transaction, nous retournerons une erreur.

```rust
if !initializer.is_signer {
    msg!("Signature requise manquante");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Validation du compte

Ensuite, vérifions que la `pda_account` fournie par l'utilisateur est la PDA que nous attendons en dérivant la PDA en utilisant `initializer` et `title` comme seeds. Si les adresses ne correspondent pas, nous retournerons notre erreur personnalisée `InvalidPDA`. Nous implémenterons cela de la même manière que nous l'avons fait dans la fonction `add_movie_review`.

```rust
// Dérivez la PDA et vérifiez si elle correspond au client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref()], program_id);

if pda != *pda_account.key {
    msg!("Seeds invalides pour la PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Déballer `pda_account` et effectuer une validation des données

Maintenant que notre code assure que nous pouvons faire confiance aux comptes fournis, déballons le `pda_account` et effectuons une validation des données. Nous commencerons par déballer `pda_account` et l'assigner à une variable mutable `account_data`.

```rust
msg!("unpacking state account");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("borrowed account data");
```

Maintenant que nous avons accès au compte et à ses champs, la première chose à faire est de vérifier si le compte a déjà été initialisé. Un compte non initialisé ne peut pas être mis à jour, donc le programme devrait renvoyer notre erreur personnalisée `UninitializedAccount`.

```rust
if !account_data.is_initialized() {
    msg!("Le compte n'est pas initialisé");
    return Err(ReviewError::UninitializedAccount.into());
}
```

Ensuite, nous devons valider les données `rating`, `title`, et `description` de la même manière que dans la fonction `add_movie_review`. Nous voulons limiter le `rating` à une échelle de 1 à 5 et limiter la taille totale de la critique à moins de 1000 octets. Si le rating fourni par l'utilisateur est en dehors de cette plage, nous renverrons notre erreur personnalisée `InvalidRating`. Si la critique est trop longue, alors nous renverrons notre erreur personnalisée `InvalidDataLength`.

```rust
if rating > 5 || rating < 1 {
    msg!("Le rating ne peut pas être supérieur à 5");
    return Err(ReviewError::InvalidRating.into())
}

let total_len: usize = 1 + 1 + (4 + account_data.title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("La longueur des données dépasse 1000 octets");
    return Err(ReviewError::InvalidDataLength.into())
}
```

### Mettre à jour le compte de critique de film

Maintenant que nous avons implémenté toutes les vérifications de sécurité, nous pouvons enfin mettre à jour le compte de critique de film en actualisant `account_data` et en le resérialisant. À ce stade, nous pouvons renvoyer `Ok` depuis notre programme.

```rust
account_data.rating = rating;
account_data.description = description;

account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

Ok(())
```

Dans l'ensemble, la fonction `update_movie_review` devrait ressembler à quelque chose comme l'extrait de code ci-dessous. Nous avons inclus quelques logs supplémentaires pour plus de clarté lors du débogage.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Mise à jour de la critique de film...");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

    if pda_account.owner != program_id {
      return Err(ProgramError::IllegalOwner)
    }

    if !initializer.is_signer {
        msg!("Signature requise manquante");
        return Err(ProgramError::MissingRequiredSignature)
    }

    msg!("Déballage du compte d'état");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("Titre de la critique : {}", account_data.title);

    let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Seeds invalides pour la PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    msg!("Vérification si le compte de film est initialisé");
    if !account_data.is_initialized() {
        msg!("Le compte n'est pas initialisé");
        return Err(ReviewError::UninitializedAccount.into());
    }

    if rating > 5 || rating < 1 {
        msg!("Note invalide");
        return Err(ReviewError::InvalidRating.into())
    }

    let update_len: usize = 1 + 1 + (4 + description.len()) + account_data.title.len();
    if update_len > 1000 {
        msg!("La longueur des données est supérieure à 1000 octets");
        return Err(ReviewError::InvalidDataLength.into())
    }

    msg!("Critique avant mise à jour :");
    msg!("Titre : {}", account_data.title);
    msg!("Note : {}", account_data.rating);
    msg!("Description : {}", account_data.description);

    account_data.rating = rating;
    account_data.description = description;

    msg!("Critique après mise à jour :");
    msg!("Titre : {}", account_data.title);
    msg!("Note : {}", account_data.rating);
    msg!("Description : {}", account_data.description);

    msg!("Sérialisation du compte");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("Compte d'état sérialisé");

    Ok(())
}
```

## 7. Construire et mettre à niveau

Nous sommes prêts à construire et à mettre à niveau notre programme ! Vous pouvez tester votre programme en soumettant une transaction avec les bonnes données d'instruction. Pour cela, n'hésitez pas à utiliser [ce frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews). N'oubliez pas de vous assurer que vous testez le bon programme en remplaçant `MOVIE_REVIEW_PROGRAM_ID` par votre ID de programme dans `Form.tsx` et `MovieCoordinator.ts`.

Si vous avez besoin de plus de temps avec ce projet pour vous familiariser avec ces concepts, jetez un œil au [code de la solution](https://beta.solpg.io/62c8c6dbf6273245aca4f5e7) avant de continuer.

# Défi

Maintenant, c'est à vous de construire quelque chose de manière indépendante en vous basant sur le programme d'introduction de l'étudiant que vous avez utilisé dans les leçons précédentes. Si vous n'avez pas suivi ou si vous n'avez pas enregistré votre code précédent, n'hésitez pas à utiliser [ce code de départ](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).

Le programme d'introduction de l'étudiant est un programme Solana qui permet aux étudiants de se présenter. Le programme prend le nom et un court message de l'utilisateur en tant que données d'instruction et crée un compte pour stocker les données onchain.

En utilisant ce que vous avez appris dans cette leçon, essayez d'appliquer ce que vous avez appris au programme d'introduction de l'étudiant. Le programme doit :

1. Ajouter une instruction permettant aux étudiants de mettre à jour leur message
2. Mettre en œuvre les vérifications de sécurité de base que nous avons apprises dans cette leçon

Essayez de faire cela de manière indépendante si possible ! Mais si vous êtes bloqué, n'hésitez pas à consulter le [code de la solution](https://beta.solpg.io/62c9120df6273245aca4f5e8). Notez que votre code peut avoir l'air légèrement différent du code de la solution en fonction des vérifications que vous implémentez et des erreurs que vous écrivez. Une fois que vous aurez terminé le Module 3, nous aimerions en savoir plus sur votre expérience ! N'hésitez pas à [partager quelques commentaires rapides](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%203), afin que nous puissions continuer à améliorer le cours.


## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=3dfb98cc-7ba9-463d-8065-7bdb1c841d43) !
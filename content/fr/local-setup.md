---
title: Développement de programme en local
objectives:
- Mettre en place un environnement local pour le développement de programmes Solana
- Utiliser les commandes de base de la CLI Solana
- Exécuter un validateur de test local
- Utiliser Rust et la CLI Solana pour déployer un programme Solana depuis votre environnement de développement local
- Utiliser la CLI Solana pour afficher les logs du programme
---

# Résumé

- Pour commencer avec Solana localement, vous devrez d'abord installer **Rust** et la **CLI Solana**
- En utilisant la CLI Solana, vous pouvez exécuter un **validateur de test local** en utilisant la commande `solana-test-validator`
- Une fois que Rust et la CLI Solana sont installés, vous pourrez construire et déployer vos programmes localement en utilisant les commandes `cargo build-bpf` et `solana program deploy`
- Vous pouvez afficher les logs du programme en utilisant la commande `solana logs`

# Aperçu général

Jusqu'à présent dans ce cours, nous avons utilisé Solana Playground pour développer et déployer des programmes Solana. Et bien que ce soit un excellent outil, pour certains projets complexes, vous préférerez peut-être avoir un environnement de développement local configuré. Cela peut être nécessaire pour utiliser des crates non pris en charge par Solana Playground, tirer parti de scripts personnalisés ou d'outils que vous avez créés, ou simplement par préférence personnelle.

Cela étant dit, cette leçon sera légèrement différente des autres. Au lieu de couvrir beaucoup de terrain sur la manière d'écrire un programme ou d'interagir avec le réseau Solana, cette leçon se concentrera principalement sur la tâche moins glamour de la configuration de votre environnement de développement local.

Pour construire, tester et déployer des programmes Solana depuis votre machine, vous devrez installer le compilateur Rust et l'interface de ligne de commande (CLI) Solana. Nous commencerons par vous guider à travers ces processus d'installation, puis nous expliquerons comment utiliser ce que vous venez d'installer.

Les instructions d'installation ci-dessous contiennent les étapes pour installer Rust et la CLI Solana au moment de la rédaction. Elles peuvent avoir changé au moment de votre lecture, alors si vous rencontrez des problèmes, veuillez consulter les pages d'installation officielles pour chacun :

- [Installer Rust](https://www.rust-lang.org/tools/install)
- [Installer la suite d'outils Solana](https://docs.solana.com/cli/install-solana-cli-tools)

## Configuration sur Windows (avec Linux)

### Télécharger Windows Subsystem for Linux (WSL)

Si vous êtes sur un ordinateur Windows, il est recommandé d'utiliser Windows Subsystem for Linux (WSL) pour construire vos programmes Solana.

Ouvrez PowerShell ou une invite de commande Windows en tant qu'**administrateur** et vérifiez la version de Windows

```bash
winver
```

Si vous êtes sur Windows 10 version 2004 et supérieure (Build 19041 et supérieure) ou Windows 11, exécutez la commande suivante.

```bash
wsl --install
```

Si vous utilisez une version plus ancienne de Windows, suivez [les instructions pour les versions plus anciennes de Windows](https://docs.microsoft.com/en-us/windows/wsl/install-manual).

Vous pouvez [en savoir plus sur l'installation de WSL depuis Microsoft](https://docs.microsoft.com/en-us/windows/wsl/install).

### Télécharger Ubuntu

Ensuite, [téléchargez Ubuntu](https://apps.microsoft.com/store/detail/ubuntu-2004/9N6SVWS3RX71?hl=en-us&gl=US). Ubuntu fournit un terminal qui vous permet d'exécuter Linux sur un ordinateur Windows. C'est ici que vous exécuterez les commandes Solana CLI.

### Télécharger Rust (pour WSL)

Ensuite, ouvrez un terminal Ubuntu et téléchargez Rust pour WSL en utilisant la commande suivante. Vous pouvez en savoir plus sur [le téléchargement de Rust depuis la documentation](https://www.rust-lang.org/learn/get-started).

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Télécharger la CLI Solana

Maintenant, nous sommes prêts à télécharger la CLI Solana pour Linux. Allez-y et exécutez la commande suivante dans un terminal Ubuntu. Vous pouvez en savoir plus sur [le téléchargement de la CLI Solana depuis la documentation](https://docs.solana.com/cli/install-solana-cli-tools).

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

## Configuration sur macOS

### Télécharger Rust

D'abord, téléchargez Rust en [suivant les instructions](https://www.rust-lang.org/tools/install)

### Télécharger la CLI Solana

Ensuite, téléchargez la CLI Solana en exécutant la commande suivante dans votre terminal.

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

Vous pouvez en savoir plus sur [le téléchargement de la CLI Solana](https://docs.solana.com/cli/install-solana-cli-tools).

## Bases de la CLI Solana

La CLI Solana est un outil d'interface de ligne de commande qui fournit une collection de commandes pour interagir avec un cluster Solana.

Nous couvrirons certaines des commandes les plus courantes dans cette leçon, mais vous pouvez toujours afficher la liste de toutes les commandes possibles de la CLI Solana en exécutant `solana --help`.

### Configuration de la CLI Solana

La CLI Solana stocke plusieurs paramètres de configuration qui affectent le comportement de certaines commandes. Vous pouvez utiliser la commande suivante pour afficher la configuration actuelle :

```bash
solana config get
```

La commande `solana config get` renverra les informations suivantes :

- `Fichier de configuration` - l'emplacement de la CLI Solana sur votre ordinateur
- `URL RPC` - point d'accès que vous utilisez, localhost, Devnet ou Mainnet
- `URL WebSocket` - le websocket pour écouter les événements du cluster que vous ciblez (calculé lorsque vous définissez l'`URL RPC`)
- `Chemin de la paire de clés` - le chemin de la paire de clés utilisée lors de l'exécution des sous-commandes Solana CLI
- `Engagement` - fournit une mesure de la confirmation du réseau et décrit à quel point un bloc est finalisé à ce moment-là

Vous pouvez changer votre configuration de la CLI Solana à tout moment en utilisant la commande `solana config set` suivie du paramètre que vous souhaitez mettre à jour.

Le changement le plus courant sera celui du cluster que vous ciblez. Utilisez la commande `solana config set --url` pour changer l'`URL RPC`.

```bash
solana config set --url localhost
```

```bash
solana config set --url devnet
```

```bash
solana config set --url mainnet-beta
```

De même, vous pouvez utiliser la commande `solana config set --keypair` pour changer le `Chemin de la paire de clés`. La CLI Solana utilisera alors la paire de clés du chemin spécifié lors de l'exécution des commandes.

```bash
solana config set --keypair ~/<CHEMIN_DU_FICHIER>
```

### Validateurs de test

Il est souvent utile d'exécuter un validateur local pour les tests et le débogage plutôt que de déployer sur Devnet.

Vous pouvez exécuter un validateur de test local en utilisant la commande `solana-test-validator`. Cette commande crée un processus continu qui nécessitera sa propre fenêtre de ligne de commande.

### Flux de logs du programme

Il est souvent utile d'ouvrir une nouvelle console et d'exécuter la commande `solana logs` en parallèle avec le validateur de test. Cela crée un autre processus continu qui diffusera les logs associés au cluster de votre configuration.

Si votre configuration de la CLI est pointée vers `localhost`, les logs seront toujours associés au validateur de test que vous avez créé, mais vous pouvez également diffuser les logs depuis d'autres clusters comme Devnet et Mainnet Beta. Lors de la diffusion des logs depuis d'autres clusters, vous voudrez inclure un ID de programme avec la commande pour limiter les logs que vous voyez à votre programme spécifique.

### Paires de clés

Vous pouvez générer une nouvelle paire de clés en utilisant la commande `solana-keygen new --outfile` suivie du chemin du fichier pour stocker la paire de clés.

```bash
solana-keygen new --outfile ~/<CHEMIN_DU_FICHIER>
```

Parfois, vous devrez peut-être vérifier vers quelle paire de clés votre configuration est pointée. Pour afficher la `clé publique` de la paire de clés actuelle définie dans `solana config`, utilisez la commande `solana address`.

```bash
solana address
```

Pour afficher le solde SOL de la paire de clés actuelle définie dans `solana config`, utilisez la commande `solana balance`.

```bash
solana balance
```

Pour recevoir des SOL sur Devnet ou localhost, utilisez la commande `solana airdrop`. Notez que sur Devnet, vous êtes limité à 2 SOL par "airdrop".

```bash
solana airdrop 2
```

En développant et testant des programmes dans votre environnement local, vous rencontrerez probablement des erreurs causées par :

- L'utilisation de la mauvaise paire de clés
- Ne pas avoir assez de SOL pour déployer votre programme ou effectuer une transaction
- Pointage vers le mauvais cluster

Les commandes de la CLI que nous avons couvertes jusqu'à présent devraient vous aider à résoudre rapidement ces problèmes.

## Développer des programmes Solana dans votre environnement local

Bien que Solana Playground soit extrêmement utile, il est difficile de rivaliser avec la flexibilité de votre propre environnement de développement local. En construisant des programmes plus complexes, vous finirez probablement par les intégrer à un ou plusieurs clients qui sont également en développement dans votre environnement local. Les tests entre ces programmes et clients sont souvent plus simples lorsque vous écrivez, construisez et déployez vos programmes localement.

### Créer un nouveau projet

Pour créer un nouveau package Rust pour écrire un programme Solana, vous pouvez utiliser la commande `cargo new --lib` avec le nom du nouveau répertoire que vous souhaitez créer.

```bash
cargo new --lib <NOM_DU_REPERTOIRE_DU_PROJET>
```

Cette commande créera un nouveau répertoire avec le nom que vous avez spécifié à la fin de la commande. Ce nouveau répertoire contiendra un fichier de manifeste `Cargo.toml` qui décrit le package.

Le fichier de manifeste contient des métadonnées telles que le nom, la version et les dépendances (crates). Pour écrire un programme Solana, vous devrez mettre à jour le fichier `Cargo.toml` pour inclure `solana-program` comme dépendance. Vous devrez peut-être également ajouter les lignes `[lib]` et `crate-type` indiquées ci-dessous.

```rust
[package]
name = "<NOM_DU_REPERTOIRE_DU_PROJET>"
version = "0.1.0"
edition = "2021"

[features]
no-entrypoint = []

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

À ce stade, vous pouvez commencer à écrire votre programme dans le dossier `src`.

### Construire et déployer

Quand vient le moment de construire votre programme Solana, vous pouvez utiliser la commande `cargo build-bpf`.

```bash
cargo build-bpf
```

La sortie de cette commande inclura des instructions pour déployer votre programme qui ressemblent à ceci :

```text
To deploy this program:
  $ solana program deploy /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local.so
The program address will default to this keypair (override with --program-id):
  /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local-keypair.json
```

Lorsque vous êtes prêt à déployer le programme, utilisez la commande `solana program deploy` résultant de `cargo build-bpf`. Cela déploiera votre programme sur le cluster spécifié dans votre configuration de la CLI.

```rust
solana program deploy <CHEMIN>
```

# Laboratoire

Pratiquons en construisant et en déployant le programme "Hello World!" que nous avons créé dans la [leçon Hello World](https://github.com/Unboxed-Software/solana-course/pull/content/hello-world-program).

Nous ferons tout cela localement, y compris le déploiement sur un validateur de test local. Avant de commencer, assurez-vous d'avoir installé Rust et la CLI Solana. Vous pouvez vous référer aux instructions dans l'aperçu si ce n'est pas déjà fait.

### 1. Créer un nouveau projet Rust

Commençons par créer un nouveau projet Rust. Exécutez la commande `cargo new --lib` ci-dessous. N'hésitez pas à remplacer le nom du répertoire par le vôtre.

```bash
cargo new --lib solana-hello-world-local
```

N'oubliez pas de mettre à jour le fichier `cargo.toml` pour inclure `solana-program` comme dépendance et `crate-type` s'il n'y est pas déjà.

```bash
[package]
name = "solana-hello-world-local"
version = "0.1.0"
edition = "2021"

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

### 2. Écrire votre programme

Ensuite, mettez à jour `lib.rs` avec le programme "Hello World!" ci-dessous. Ce programme imprime simplement "Hello, world!" dans le journal du programme lorsque le programme est invoqué.

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult{
    msg!("Hello, world!");

    Ok(())
}
```

### 3. Exécuter un validateur de test local

Avec votre programme écrit, assurez-vous que votre configuration de la CLI Solana pointe vers localhost en utilisant la commande `solana config set --url`.

```bash
solana config set --url localhost
```

Ensuite, vérifiez que la configuration de la CLI Solana a été mise à jour en utilisant la commande `solana config get`.

```bash
solana config get
```

Enfin, exécutez un validateur de test local. Dans une fenêtre de terminal séparée, exécutez la commande `solana-test-validator`. Ceci est nécessaire uniquement lorsque notre `URL RPC` est défini sur localhost.

```bash
solana-test-validator
```

### 4. Construire et déployer

Nous sommes maintenant prêts à construire et déployer notre programme. Construisez le programme en utilisant la commande `cargo build-bpf`.

```bash
cargo build-bpf
```

Maintenant, déployons notre programme. Exécutez la commande `solana program deploy` résultante de `cargo build-bpf`.

```bash
solana program deploy <CHEMIN>
```

`solana program deploy` renverra l'`ID du programme` pour votre programme. Vous pouvez maintenant rechercher le programme déployé sur [Solana Explorer](https://explorer.solana.com/?cluster=custom) (pour localhost, sélectionnez "URL RPC personnalisée" comme cluster).

### 5. Afficher les logs du programme

Avant d'invoquer votre programme, ouvrez un terminal séparé et exécutez la commande `solana logs`. Cela nous permettra de voir les logs du programme dans le terminal.

```bash
solana logs <ID_DU_PROGRAMME>
```

Avec le validateur de test toujours en cours d'exécution, essayez d'invoquer votre programme en utilisant [ce script côté client](https://github.com/Unboxed-Software/solana-hello-world-client).

Remplacez l'ID du programme dans `index.ts` par celui du programme que vous venez de déployer, puis exécutez `npm install` suivi de `npm start`. Cela renverra une URL Solana Explorer. Copiez l'URL dans le navigateur pour rechercher la transaction sur Solana Explorer et vérifier que "Hello, world!" a été imprimé dans le journal du programme. Alternativement, vous pouvez voir les logs du programme dans le terminal où vous avez exécuté la commande `solana logs`.

Et voilà ! Vous venez de créer et de déployer votre premier programme depuis un environnement de développement local.

# Défi

Maintenant, c'est à vous de construire quelque chose de manière indépendante. Essayez de créer un nouveau programme pour imprimer votre propre message dans les logs du programme. Cette fois, déployez votre programme sur Devnet au lieu de localhost.

N'oubliez pas de mettre à jour votre `URL RPC` vers Devnet en utilisant la commande `solana config set --url`.

Vous pouvez invoquer le programme en utilisant le même script côté client que dans le laboratoire tant que vous mettez à jour la `connection` et l'URL Solana Explorer pour pointer tous deux vers Devnet au lieu de localhost.

```tsx
let connection = new web3.Connection(web3.clusterApiUrl("devnet"));
```

```tsx
console.log(
    `Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
);
```

Vous pouvez également ouvrir une fenêtre de ligne de commande séparée et utiliser la commande `solana logs | grep "<ID_DU_PROGRAMME> invoke" -A <NOMBRE_DE_LIGNES_A_RETOURNER>`. Lors de l'utilisation de `solana logs` sur Devnet, vous devez spécifier l'ID du programme. Sinon, la commande `solana logs` renverra un flux constant de logs depuis Devnet. Par exemple, vous feriez ce qui suit pour surveiller les invocations du programme Token et afficher les 5 premières lignes de logs pour chaque invocation :

```bash
solana logs | grep "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke" -A 5
```

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=aa0b56d6-02a9-4b36-95c0-a817e2c5b19d) !
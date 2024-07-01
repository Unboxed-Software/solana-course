---
title: Oracles et Réseaux d'Oracles
objectives:
- Expliquer pourquoi les programmes onchain ne peuvent pas facilement accéder aux données du monde réel par eux-mêmes
- Expliquer comment les oracles résolvent le problème de l'accès aux données du monde réel onchain
- Expliquer comment les réseaux d'oracles incitatifs rendent les données plus fiables
- Évaluer efficacement les compromis entre l'utilisation de différents types d'oracles
- Utiliser des oracles à partir d'un programme onchain pour accéder à des données du monde réel
---

# Résumé

- Les oracles sont des services qui fournissent des données externes à un réseau blockchain.
- Il existe deux principaux fournisseurs d'oracles sur Solana : **Switchboard** et **Pyth**.
- Vous pouvez construire votre propre oracle pour créer un flux de données personnalisé.
- Vous devez être prudent lors du choix de vos fournisseurs de flux de données.

# Aperçu général

Les oracles sont des services qui fournissent des données externes à un réseau blockchain. Les blockchains, par nature, sont des environnements cloisonnés qui n'ont aucune connaissance du monde extérieur. Cette contrainte limite intrinsèquement les cas d'utilisation des applications décentralisées (dApps). Les oracles fournissent une solution à cette limitation en créant une manière décentralisée d'obtenir des données du monde réel onchain.

Les oracles peuvent fournir pratiquement n'importe quel type de données onchain, par exemple :

- Résultats d'événements sportifs.
- Données météorologiques.
- Résultats d'élections politiques.
- Données de marché.
- Aléatoire.

Bien que l'implémentation exacte puisse varier d'une blockchain à l'autre, généralement les oracles fonctionnent comme suit :

1. Les données sont obtenues off-chain.
2. Ces données sont publiées onchain dans une transaction et stockées dans un compte.
3. Les programmes peuvent lire les données stockées dans le compte et les utiliser dans leur logique.

Cette leçon abordera les bases du fonctionnement des oracles, l'état des oracles sur Solana et comment utiliser efficacement les oracles dans votre développement Solana.

## Confiance et Réseaux d'Oracles

Le principal obstacle que les oracles doivent surmonter est celui de la confiance. Étant donné que les blockchains exécutent des transactions financières irréversibles, les développeurs et les utilisateurs doivent savoir qu'ils peuvent faire confiance à la validité et à l'exactitude des données de l'oracle. La première étape pour faire confiance à un oracle est de comprendre comment il est mis en œuvre.

En gros, il existe trois types d'implémentations :

1. Un seul oracle centralisé publie des données onchain.
    1. Avantage : C'est simple ; il y a une seule source de vérité.
    2. Inconvénient : Rien n'empêche le fournisseur de l'oracle de fournir des données incorrectes.
2. Un réseau d'oracles publie des données et un mécanisme de consensus est utilisé pour déterminer le résultat final.
    1. Avantage : Le consensus rend moins probable que des données incorrectes soient ajoutées à la chaîne.
    2. Inconvénient : Il n'y a aucun moyen de dissuader les acteurs malveillants de publier des données incorrectes et d'influencer le consensus.
3. Un réseau d'oracles avec un certain mécanisme de proof of stake. Par exemple, exiger des oracles de staker des jetons pour participer au mécanisme de consensus. À chaque réponse, si un oracle s'écarte d'un seuil des résultats acceptés, sa mise est prise par le protocole et il ne peut plus rapporter.
    1. Avantage : Assure qu'aucun oracle individuel ne peut influencer trop drastiquement le résultat final, tout en incitant également à des actions honnêtes et précises.
    2. Inconvénient : Construire des réseaux décentralisés est difficile, les incitations doivent être correctement configurées et suffisantes pour obtenir une participation, etc.

Selon l'utilisation d'un oracle, l'une des solutions ci-dessus pourrait être la bonne approche. Par exemple, vous pourriez être parfaitement disposé à participer à un jeu basé sur la blockchain qui utilise des oracles centralisés pour publier des informations de jeu sur la chaîne.

D'autre part, vous pourriez être moins enclin à faire confiance à un oracle centralisé fournissant des informations sur les prix pour des applications de trading.

Vous pourriez finir par créer de nombreux oracles autonomes pour vos propres applications simplement comme moyen d'obtenir l'accès aux informations hors chaîne dont vous avez besoin. Cependant, il est peu probable que ces oracles soient utilisés par la communauté plus large où la décentralisation est un principe fondamental. Vous devriez également être hésitant à utiliser des oracles centralisés tiers vous-même.

Dans un monde parfait, toutes les données importantes et/ou précieuses seraient fournies sur la chaîne via un réseau d'oracle très efficace grâce à un mécanisme de consensus proof of stake digne de confiance. En introduisant un mécanisme de mise, il est dans l'intérêt des fournisseurs d'oracles de s'assurer que leurs données sont exactes afin de conserver leurs mises.

Même lorsque un réseau d'oracles prétend avoir un tel mécanisme de consensus, assurez-vous de connaître les risques liés à l'utilisation du réseau. Si la valeur totale des applications aval est supérieure à la mise allouée de l'oracle, les oracles peuvent toujours avoir suffisamment d'incitation à collusionner.

Il est de votre responsabilité de connaître la configuration du Réseau d'Oracles et de prendre une décision sur la confiance que vous pouvez leur accorder. En général, les oracles ne doivent être utilisés que pour des fonctions non critiques pour la mission et des scénarios pessimistes doivent être pris en compte.

## Oracles sur Solana

[Pyth](https://pyth.network) et [Switchboard](https://switchboard.xyz) sont les deux principaux fournisseurs d'oracles sur Solana aujourd'hui. Ils sont chacun uniques et suivent des choix de conception légèrement différents.

**Pyth** est principalement axé sur les données financières publiées par des institutions financières de premier ordre. Les fournisseurs de données de Pyth publient les mises à jour des données de marché. Ces mises à jour sont ensuite agrégées et publiées sur la chaîne par le programme Pyth. Les données provenant de Pyth ne sont pas complètement décentralisées, car seuls les fournisseurs de données approuvés peuvent publier des données. L'argument de vente de Pyth est que ses données sont directement vérifiées par la plateforme et proviennent d'institutions financières, garantissant une qualité supérieure.

**Switchboard** est un réseau d'oracle entièrement décentralisé et propose des données de toutes sortes. Consultez tous les flux [sur leur site Web](https://app.switchboard.xyz/solana/devnet/explore) De plus, n'importe qui peut exécuter un oracle Switchboard et n'importe qui peut utiliser leurs données. Cela signifie que vous devrez être diligent dans la recherche des flux. Nous parlerons plus tard de ce qu'il faut rechercher dans la leçon.

Switchboard suit une variation du réseau d'oracle pondéré par la mise décrit dans la troisième option de la section précédente. Il le fait en introduisant ce qu'on appelle des environnements d'exécution de confiance (TEEs). Les TEE sont des environnements sécurisés isolés du reste du système où un code sensible peut être exécuté. En termes simples, étant donné un programme et une entrée, les TEE peuvent exécuter et générer une sortie avec une preuve. Si vous souhaitez en savoir plus sur les TEE, veuillez lire la [documentation de Switchboard](https://docs.switchboard.xyz/functions).

En introduisant des TEE sur des oracles pondérés par la mise, Switchboard est capable de vérifier le logiciel de chaque oracle pour permettre sa participation dans le réseau. Si un opérateur d'oracle agit de manière malveillante et tente de modifier le fonctionnement du code approuvé, une vérification de citation de données échouera. Cela permet aux oracles Switchboard d'opérer au-delà du simple reporting de valeur quantitative, telles que des fonctions - exécutant des calculs personnalisés et confidentiels hors chaîne.

## Oracles Switchboard

Les oracles Switchboard stockent des données sur Solana à l'aide de flux de données. Ces flux de données, également appelés agrégateurs, sont chacun une collection de tâches qui sont agrégées pour produire un résultat unique. Ces agrégateurs sont représentés sur la chaîne comme un compte Solana régulier géré par le programme Switchboard. Lorsqu'un oracle est mis à jour, il écrit les données directement dans ces comptes. Examinons quelques termes pour comprendre comment fonctionne Switchboard :

- **[Agrégateur (Flux de données)](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60)** - Contient la configuration du flux de données, dictant comment les mises à jour du flux de données sont demandées, mises à jour et résolues onchain depuis sa source assignée. L'agrégateur est le compte détenu par le programme Switchboard Solana et c'est là que les données sont publiées onchain.
- **[Job (Tâche)](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/job.rs)** - Chaque source de données doit correspondre à un compte de tâche. Le compte de tâche est une collection de tâches Switchboard utilisées pour indiquer aux oracles comment obtenir et transformer les données. En d'autres termes, il stocke les plans pour obtenir des données hors chaîne pour une source de données particulière.
- **Oracle** - Un programme distinct qui se situe entre Internet et la blockchain et facilite le flux d'informations. Un oracle lit les définitions de tâches d'un flux, calcule le résultat et soumet sa réponse onchain.
- **File d'attente Oracle** - Un groupe d'oracles qui se voient attribuer des demandes de mise à jour de manière circulaire. Les oracles dans la file d'attente doivent envoyer des battements de cœur onchain de manière active pour fournir des mises à jour. Les données et les configurations de cette file d'attente sont stockées onchain dans un [compte détenu par le programme Switchboard](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/javascript/solana.js/src/generated/oracle-program/accounts/OracleQueueAccountData.ts#L8).
- **Consensus Oracle** - Détermine comment les oracles parviennent à un accord sur le résultat onchain accepté. Les oracles Switchboard utilisent la réponse médiane de l'oracle comme résultat accepté. Une autorité de flux peut contrôler le nombre d'oracles demandés et combien doivent répondre pour influencer sa sécurité.

Les oracles Switchboard sont incités à mettre à jour les flux de données car ils sont récompensés pour le faire de manière précise. Chaque flux de données a un compte de « LeaseContract ». Le contrat de location est un compte d'entiercement pré-financé pour récompenser les oracles de la mise à jour des demandes. Seule l'autorité de location prédéfinie peut retirer des fonds du contrat, mais n'importe qui peut y contribuer. Lorsqu'une nouvelle série de mises à jour est demandée pour un flux de données, l'utilisateur qui a demandé la mise à jour est récompensé à partir de l'entiercement. Cela vise à inciter les utilisateurs et les personnes qui exécutent des logiciels pour envoyer systématiquement des demandes de mise à jour aux oracles à maintenir les mises à jour en fonction de la configuration du flux. Une fois qu'une demande de mise à jour a été réalisée avec succès et soumise onchain par les oracles dans la file d'attente, les oracles reçoivent une récompense de l'entiercement. Ces paiements assurent la participation active.

De plus, les oracles doivent miser des jetons avant de pouvoir servir des demandes de mise à jour et soumettre des réponses onchain. Si un oracle soumet un résultat onchain qui se situe en dehors des paramètres configurés de la file d'attente, sa mise sera réduite (si la file d'attente a `slashingEnabled`). Cela aide à garantir que les oracles répondent de bonne foi avec des informations précises.

Maintenant que vous comprenez la terminologie et l'économie, regardons comment les données sont publiées onchain :

1. Configuration de la file d'attente Oracle - Lorsqu'une mise à jour est demandée à partir d'une file d'attente, les prochains `N` oracles sont assignés à la demande de mise à jour et cyclés à l'arrière de la file d'attente. Chaque file d'attente Oracle dans le réseau Switchboard est indépendante et maintient sa propre configuration. Ce choix de conception permet aux utilisateurs d'ajuster le comportement de la file d'attente Oracle en fonction de leur cas d'utilisation spécifique. Une file d'attente Oracle est stockée onchain en tant que compte et contient des métadonnées sur la file d'attente. Une file d'attente est créée en invoquant l'[instruction oracleQueueInit](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/javascript/solana.js/src/generated/oracle-program/instructions/oracleQueueInit.ts#L13) sur le programme Solana Switchboard.
    1. Quelques configurations de file d'attente Oracle pertinentes :
        1. `oracle_timeout` - Intervalle où les oracles obsolètes seront supprimés s'ils n'envoient pas leur battement de cœur.
        2. `reward` - Récompenses à fournir aux oracles et aux ouvreurs de cycle sur cette file d'attente.
        3. `min_stake` - Le montant minimum de mise que les oracles doivent fournir pour rester dans la file d'attente.
        4. `size` - Le nombre actuel d'oracles dans une file d'attente.
        5. `max_size` - Le nombre maximum d'oracles qu'une file d'attente peut prendre en charge.
2. Configuration de l'agrégateur/flux de données - Le compte de l'agrégateur/flux est créé. Un flux appartient à une seule file d'attente Oracle. La configuration du flux dicte comment les demandes de mise à jour du flux sont invoquées et acheminées à travers le réseau.
3. Configuration du compte de tâche - En plus du flux, un compte de tâche pour chaque source de données doit être configuré. Cela définit comment les oracles peuvent satisfaire les demandes de mise à jour du flux. Cela inclut la définition de l'endroit où les oracles doivent extraire les données demandées par le flux.
4. Attribution de la demande - Une fois qu'une mise à jour a été demandée avec le compte du flux, la file d'attente Oracle attribue la demande à différents oracles/nœuds dans la file d'attente pour la satisfaire. Les oracles extraient les données de la source de données définie dans chacun des comptes de tâches du flux. Chaque compte de tâche a un poids qui lui est associé. L'oracle calculera la médiane pondérée des résultats de toutes les tâches.
5. Après réception des réponses de `minOracleResults`, le programme onchain calcule le résultat en utilisant la médiane des réponses de l'oracle. Les oracles qui ont répondu dans les paramètres configurés de la file d'attente sont récompensés, tandis que les oracles qui répondent en dehors de ce seuil sont réduits (si la file d'attente a `slashingEnabled`).
6. Le résultat mis à jour est stocké dans le compte du flux de données pour qu'il puisse être lu/consommé onchain.

### Comment utiliser les oracles Switchboard

Pour utiliser les oracles Switchboard et incorporer des données hors chaîne dans un programme Solana, vous devez d'abord trouver un flux qui fournit les données dont vous avez besoin. Les flux Switchboard sont publics et il y en a des [déjà disponibles que vous pouvez choisir](https://app.switchboard.xyz/solana/devnet/explore). Lorsque vous recherchez un flux, vous devez décider de la précision/fiabilité que vous souhaitez pour le flux, d'où vous souhaitez obtenir les données, ainsi que de la cadence de mise à jour du flux. Lors de la consommation d'un flux disponible publiquement, vous n'avez aucun contrôle sur ces éléments, alors choisissez avec soin !

Par exemple, il existe un flux sponsorisé par Switchboard pour [BTC_USD](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee). Ce flux est disponible sur Solana devnet/mainnet avec la clé publique `8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee`. Il fournit le prix actuel du Bitcoin en USD onchain.

Les données effectives onchain pour un compte de flux Switchboard ressemblent un peu à ceci :

```rust
// du programme solana switchboard
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60

pub struct AggregatorAccountData {
    /// Nom de l'agrégateur à stocker onchain.
    pub name: [u8; 32],
    ...
		...
    /// Pubkey de la file d'attente à laquelle appartient l'agrégateur.
    pub queue_pubkey: Pubkey,
    ...
    /// Nombre minimum de réponses d'oracle nécessaires avant qu'une série de mises à jour ne soit validée.
    pub min_oracle_results: u32,
    /// Nombre minimum de résultats de tâches avant qu'un oracle n'accepte un résultat.
    pub min_job_results: u32,
    /// Nombre minimum de secondes requis entre les cycles de l'agrégateur.
    pub min_update_delay_seconds: u32,
    ...
    /// Pourcentage de changement requis entre un cycle précédent et le cycle actuel. Si le pourcentage de variance n'est pas atteint, rejetez les nouvelles réponses d'oracle.
    pub variance_threshold: SwitchboardDecimal,
    ...
		/// Dernier résultat de demande de mise à jour confirmé qui a été accepté comme valide. C'est là que vous trouverez les données que vous demandez
    pub latest_confirmed_round: AggregatorRound,
		...
    /// The previous confirmed round result.
    pub previous_confirmed_round_result: SwitchboardDecimal,
    /// The slot when the previous confirmed round was opened.
    pub previous_confirmed_round_slot: u64,
		...
}
```

Vous pouvez consulter l'intégralité du code de cette structure de données dans le [programme Switchboard ici](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60).

Certains champs et configurations pertinents sur le type `AggregatorAccountData` sont les suivants :

- `min_oracle_results` - Nombre minimum de réponses d'oracle nécessaires avant qu'une ronde ne soit validée.
- `min_job_results` - Nombre minimum de résultats de travail avant qu'un oracle n'accepte un résultat.
- `variance_threshold` - Pourcentage de changement requis entre une ronde précédente et la ronde actuelle. Si le pourcentage de variance n'est pas atteint, les nouvelles réponses d'oracle sont rejetées.
- `latest_confirmed_round` - Dernière demande de mise à jour confirmée qui a été acceptée comme valide. C'est là que vous trouverez les données du flux dans `latest_confirmed_round.result`.
- `min_update_delay_seconds` - Nombre minimum de secondes requis entre les rondes de l'agrégateur.

Les trois premières configurations énumérées ci-dessus sont directement liées à l'exactitude et à la fiabilité d'un flux de données.

Le champ `min_job_results` représente le nombre minimum de réponses réussies des sources de données qu'un oracle doit recevoir avant de pouvoir soumettre sa réponse sur la chaîne. Cela signifie que si `min_job_results` est trois, chaque oracle doit extraire des données de trois sources d'emploi. Plus ce nombre est élevé, plus les données du flux seront fiables et précises. Cela limite également l'impact qu'une seule source de données peut avoir sur le résultat.

Le champ `min_oracle_results` est le nombre minimum de réponses d'oracle requis pour qu'une ronde soit réussie. N'oubliez pas, chaque oracle dans une file extrait des données de chaque source définie comme un emploi. L'oracle prend ensuite la médiane pondérée des réponses des sources et soumet cette médiane sur la chaîne. Le programme attend ensuite `min_oracle_results` de médianes pondérées et prend la médiane de cela, qui est le résultat final stocké dans le compte du flux de données.

Le champ `min_update_delay_seconds` est directement lié à la cadence de mise à jour d'un flux. `min_update_delay_seconds` doit s'être écoulées entre une ronde de mises à jour et la suivante avant que le programme Switchboard n'accepte les résultats.

Il peut être utile de regarder l'onglet "jobs" d'un flux dans l'explorateur Switchboard. Par exemple, vous pouvez consulter le [flux BTC_USD dans l'explorateur](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee). Chaque travail répertorié définit la source à partir de laquelle les oracles vont extraire des données et la pondération de chaque source. Vous pouvez voir les points d'extrémité API réels qui fournissent les données pour ce flux spécifique. Lorsque vous choisissez un flux de données pour votre programme, des éléments comme celui-ci sont très importants à considérer.

Ci-dessous se trouve une capture d'écran de deux des travaux liés au flux BTC_USD. Il montre deux sources de données : [MEXC](https://www.mexc.com/) et [Coinbase](https://www.coinbase.com/).

![Oracle Jobs](../assets/oracle-jobs.png)

Une fois que vous avez choisi un flux à utiliser, vous pouvez commencer à lire les données de ce flux. Vous le faites simplement en désérialisant et en lisant l'état stocké dans le compte. La manière la plus simple de le faire est d'utiliser la struct `AggregatorAccountData` que nous avons définie ci-dessus à partir de la crate `switchboard_v2` dans votre programme.

```rust
// importer les crates anchor et switchboard
use {
    anchor_lang::prelude::*,
    switchboard_v2::AggregatorAccountData,
};

...

#[derive(Accounts)]
pub struct ConsumeDataAccounts<'info> {
	// passer le compte du flux de données et désérialiser vers AggregatorAccountData
	pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
	...
}
```

Remarquez que nous utilisons le type `AccountLoader` ici au lieu du type `Account` normal pour désérialiser le compte de l'agrégateur. En raison de la taille de `AggregatorAccountData`, le compte utilise ce qu'on appelle le "zero copy". Cela, combiné à `AccountLoader`, empêche le chargement du compte en mémoire et donne à notre programme un accès direct aux données. Lors de l'utilisation de `AccountLoader`, nous pouvons accéder aux données stockées dans le compte de l'une des trois manières suivantes :

- `load_init` après l'initialisation d'un compte (cela ignorera le discriminant de compte manquant qui est ajouté seulement après le code d'instruction de l'utilisateur)
- `load` lorsque le compte n'est pas mutable
- `load_mut` lorsque le compte est mutable

Si vous souhaitez en savoir plus, consultez la [leçon sur l'architecture avancée du programme](./program-architecture) où nous abordons `Zero-Copy` et `AccountLoader`.

Avec le compte d'agrégateur passé dans votre programme, vous pouvez l'utiliser pour obtenir le dernier résultat de l'oracle. Plus précisément, vous pouvez utiliser la méthode `get_result` du type :

```rust
// à l'intérieur d'un programme Anchor
...

let feed = &ctx.accounts.feed_aggregator.load()?;
// obtenir le résultat
let val: f64 = feed.get_result()?.try_into()?;
```

La méthode `get_result` définie sur la struct `AggregatorAccountData` est plus sûre que de récupérer les données avec `latest_confirmed_round.result` car Switchboard a mis en place quelques vérifications de sécurité astucieuses.

```rust
// du programme Switchboard
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L195

pub fn get_result(&self) -> anchor_lang::Result<SwitchboardDecimal> {
    if self.resolution_mode == AggregatorResolutionMode::ModeSlidingResolution {
        return Ok(self.latest_confirmed_round.result);
    }
    let min_oracle_results = self.min_oracle_results;
    let latest_confirmed_round_num_success = self.latest_confirmed_round.num_success;
    if min_oracle_results > latest_confirmed_round_num_success {
        return Err(SwitchboardError::InvalidAggregatorRound.into());
    }
    Ok(self.latest_confirmed_round.result)
}
```

Vous pouvez également voir la valeur actuelle stockée dans un compte `AggregatorAccountData` côté client en TypeScript.

```tsx
import { AggregatorAccount, SwitchboardProgram} from '@switchboard-xyz/solana.js'

...
...
// créer une paire de clés pour l'utilisateur de test
let user = new anchor.web3.Keypair()

// récupérer l'objet de programme devnet de Switchboard
switchboardProgram = await SwitchboardProgram.load(
  "devnet",
  new anchor.web3.Connection("https://api.devnet.solana.com"),
  user
)

// passer l'objet de programme Switchboard et la clé publique du flux dans le constructeur de AggregatorAccount
aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

// récupérer le prix SOL le plus récent
const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
if (solPrice === null) {
  throw new Error('Aggregator holds no value')
}
```

N'oubliez pas, les flux de données Switchboard ne sont que des comptes mis à jour par des tiers (oracles). Étant donné cela, vous pouvez faire tout ce que vous pouvez normalement faire avec des comptes externes à votre programme.

### Bonnes pratiques et pièges courants

Lors de l'intégration des flux Switchboard dans vos programmes, il y a deux groupes de préoccupations à prendre en compte : le choix d'un flux et la consommation réelle des données de ce flux.

Auditez toujours les configurations d'un flux avant de décider de l'incorporer dans un programme. Des configurations telles que **Min Update Delay**, **Min Job Results**, et **Min Oracle Results** peuvent affecter directement les données qui sont finalement persistées sur la chaîne dans le compte de l'agrégateur. Par exemple, en regardant la section de configuration du [flux BTC_USD](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee), vous pouvez voir ses configurations pertinentes.

![Oracle Configs](../assets/oracle-configs.png)

Le flux BTC_USD a un Min Update Delay = 6 secondes. Cela signifie que le prix du BTC est mis à jour au minimum toutes les 6 secondes sur ce flux. Cela convient probablement à la plupart des cas d'utilisation, mais si vous souhaitez utiliser ce flux pour quelque chose de sensible à la latence, ce n'est probablement pas un bon choix.

Il est également utile de vérifier les sources d'un flux dans la section Jobs de l'explorateur oracle. Étant donné que la valeur qui est persistée sur la chaîne est le résultat médian pondéré que les oracles extraient de chaque source, les sources influencent directement ce qui est stocké dans le flux. Recherchez des liens douteux et exécutez éventuellement les API vous-même pendant un certain temps pour gagner confiance en elles.

Une fois que vous avez trouvé un flux qui correspond à vos besoins, vous devez toujours vous assurer d'utiliser le flux de manière appropriée. Par exemple, vous devriez toujours implémenter des vérifications de sécurité nécessaires sur le compte passé dans votre instruction. N'importe quel compte peut être passé dans les instructions de votre programme, vous devriez donc vérifier qu'il s'agit du compte auquel vous vous attendez.

Avec Anchor, si vous désérialisez le compte vers le type `AggregatorAccountData` à partir de la crate `switchboard_v2`, Anchor vérifie que le compte appartient au programme Switchboard. Si votre programme s'attend à ce qu'un seul flux de données spécifique soit passé dans l'instruction, vous pouvez également vérifier que la clé publique du compte passé correspond à ce qu'elle devrait être. Une manière de le faire est de coder en dur l'adresse quelque part dans le programme et d'utiliser des contraintes de compte pour vérifier que l'adresse passée correspond à ce qui est attendu.

```rust
use {
  anchor_lang::prelude::*,
  solana_program::{pubkey, pubkey::Pubkey},
	switchboard_v2::{AggregatorAccountData},
};

pub static BTC_USDC_FEED: Pubkey = pubkey!("8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee");

...
...

#[derive(Accounts)]
pub struct TestInstruction<'info> {
	// Agrégateur Switchboard SOL
	#[account(
	    address = BTC_USDC_FEED
	)]
	pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
}
```

En plus de vous assurer que le compte du flux est celui que vous attendez, vous pouvez également effectuer certaines vérifications sur les données stockées dans le flux dans la logique d'instruction de votre programme. Deux choses courantes à vérifier sont la péremption des données et l'intervalle de confiance.

Chaque flux de données met à jour la valeur actuelle stockée en elle lorsqu'il est déclenché par les oracles. Cela signifie que les mises à jour dépendent des oracles dans la file qui lui est assignée. Selon l'utilisation que vous avez l'intention de faire du flux, il peut être bénéfique de vérifier que la valeur stockée dans le compte a été mise à jour récemment. Par exemple, un protocole de prêt qui doit déterminer si la garantie d'un prêt est tombée en dessous d'un certain niveau peut avoir besoin que les données ne datent pas de plus de quelques secondes. Vous pouvez avoir votre code vérifier l'horodatage de la mise à jour la plus récente stockée dans le compte de l'agrégateur. Le snippet de code suivant vérifie que l'horodatage de la mise à jour la plus récente sur le flux de données remonte à moins de 30 secondes.

```rust
use {
    anchor_lang::prelude::*,
    anchor_lang::solana_program::clock,
    switchboard_v2::{AggregatorAccountData, SwitchboardDecimal},
};

...
...

let feed = &ctx.accounts.feed_aggregator.load()?;
if (clock::Clock::get().unwrap().unix_timestamp - feed.latest_confirmed_round.round_open_timestamp) <= 30{
      valid_transfer = true;
  }
```

Le champ `latest_confirmed_round` sur la struct `AggregatorAccountData` est de type `AggregatorRound` défini comme :

```rust
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L17

pub struct AggregatorRound {
    /// Maintient le nombre de réponses réussies reçues des nœuds.
    /// Les nœuds peuvent soumettre une réponse réussie par ronde.
    pub num_success: u32,
    /// Nombre de réponses d'erreur.
    pub num_error: u32,
    /// Si une ronde de demande de mise à jour s'est terminée.
    pub is_closed: bool,
    /// Maintient le `solana_program::clock::Slot` auquel la ronde a été ouverte.
    pub round_open_slot: u64,
    /// Maintient le `solana_program::clock::UnixTimestamp;` auquel la ronde a été ouverte.
    pub round_open_timestamp: i64,
    /// Maintient la médiane actuelle de toutes les réponses réussies de la ronde.
    pub result: SwitchboardDecimal,
    /// Écart type des résultats acceptés dans la ronde.
    pub std_deviation: SwitchboardDecimal,
    /// Maintient la réponse minimale du nœud cette ronde.
    pub min_response: SwitchboardDecimal,
    /// Maintient la réponse maximale du nœud cette ronde.
    pub max_response: SwitchboardDecimal,
    /// Clés publiques des oracles qui remplissent cette ronde.
    pub oracle_pubkeys_data: [Pubkey; 16],
    /// Représente toutes les réponses réussies des nœuds cette ronde. `NaN` si vide.
    pub medians_data: [SwitchboardDecimal; 16],
    /// Payouts/slashes actuels que les oracles ont reçus cette ronde.
    pub current_payout: [i64; 16],
    /// Tient compte des réponses qui sont remplies ici.
    pub medians_fulfilled: [bool; 16],
    /// Tient compte des erreurs qui sont remplies ici.
    pub errors_fulfilled: [bool; 16],
}
```

Il existe d'autres champs pertinents qui pourraient vous intéresser dans le compte d'agrégateur comme `num_success`, `medians_data`, `std_deviation`, etc. `num_success` est le nombre de réponses réussies reçues des oracles dans cette ronde de mises à jour. `medians_data` est un tableau de toutes les réponses réussies reçues des oracles dans cette ronde. C'est l'ensemble de données qui est utilisé pour dériver la médiane et le résultat final. `std_deviation` est l'écart type des résultats acceptés dans cette ronde. Vous voudrez peut-être vérifier un faible écart type, ce qui signifie que toutes les réponses d'oracle étaient similaires. Le programme Switchboard est responsable de mettre à jour les champs pertinents sur cette struct à chaque fois qu'il reçoit une mise à jour d'un oracle.

Le `AggregatorAccountData` a également une méthode `check_confidence_interval()` que vous pouvez utiliser comme une autre vérification sur les données stockées dans le flux. La méthode vous permet de passer un `max_confidence_interval`. Si l'écart type des résultats reçus de l'oracle est supérieur au `max_confidence_interval` donné, elle retourne une erreur.

```rust
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L228

pub fn check_confidence_interval(
    &self,
    max_confidence_interval: SwitchboardDecimal,
) -> anchor_lang::Result<()> {
    if self.latest_confirmed_round.std_deviation > max_confidence_interval {
        return Err(SwitchboardError::ConfidenceIntervalExceeded.into());
    }
    Ok(())
}
```

Vous pouvez incorporer cela dans votre programme comme ceci :

```rust
use {
    crate::{errors::*},
    anchor_lang::prelude::*,
    std::convert::TryInto,
    switchboard_v2::{AggregatorAccountData, SwitchboardDecimal},
};

...
...

let feed = &ctx.accounts.feed_aggregator.load()?;

// vérifier que le flux ne dépasse pas max_confidence_interval
feed.check_confidence_interval(SwitchboardDecimal::from_f64(max_confidence_interval))
    .map_err(|_| error!(ErrorCode::ConfidenceIntervalExceeded))?;
```

Enfin, il est important de planifier les scénarios les plus défavorables dans vos programmes. Planifiez les flux de données devenant obsolètes et planifiez la fermeture des comptes de flux.

## Conclusion

Les oracles sont un élément essentiel pour de nombreuses applications décentralisées, car elles permettent aux contrats intelligents d'accéder à des données du monde réel. Sur Solana, les oracles Switchboard sont une option décentralisée populaire qui offre une grande flexibilité et une variété de données. En comprenant le fonctionnement des oracles et en choisissant judicieusement vos fournisseurs de données, vous pouvez intégrer efficacement des informations externes dans vos projets Solana.

# Laboratoire

Pratiquons l'utilisation des oracles ! Nous allons créer un programme "Michael Burry Escrow" qui bloque des SOL dans un compte d'entiercement jusqu'à ce que la valeur de SOL soit supérieure à une certaine valeur en USD. Cela est nommé d'après l'investisseur [Michael Burry](https://en.wikipedia.org/wiki/Michael_Burry) qui est célèbre pour avoir prédit la crise immobilière de 2008.

Nous utiliserons l'oracle devnet [SOL_USD](https://app.switchboard.xyz/solana/devnet/feed/GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR) de switchboard. Le programme aura deux instructions principales :

- Dépôt - Bloquer le SOL et définir un prix en USD pour le débloquer.
- Retrait - Vérifier le prix en USD et retirer le SOL si le prix est atteint.

### 1. Configuration du programme

Pour commencer, créons le programme avec

```zsh
anchor init burry-escrow
```

Ensuite, remplacez l'ID du programme dans `lib.rs` et `Anchor.toml` par l'ID du programme affiché lorsque vous exécutez `anchor keys list`.

Ensuite, ajoutez ce qui suit à la fin de votre fichier Anchor.toml. Cela indiquera à Anchor comment configurer notre environnement de test local. Cela nous permettra de tester notre programme localement sans avoir à le déployer et à envoyer des transactions sur le devnet.

```zsh
// Fin de Anchor.toml
[test.validator]
url="https://api.devnet.solana.com"

[test]
startup_wait = 10000

[[test.validator.clone]] # sbv2 devnet programID
address = "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"

[[test.validator.clone]] # sbv2 devnet IDL
address = "Fi8vncGpNKbq62gPo56G4toCehWNy77GgqGkTaAF5Lkk"

[[test.validator.clone]] # sbv2 SOL/USD Feed
address="GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
```

De plus, nous voulons importer la crate `switchboard-v2` dans notre fichier `Cargo.toml`. Assurez-vous que vos dépendances ressemblent à ce qui suit :

```toml
[dependencies]
anchor-lang = "0.28.0"
switchboard-v2 = "0.4.0"
```

Avant de commencer la logique, passons en revue la structure de notre programme. Avec de petits programmes, il est très facile d'ajouter tout le code du contrat intelligent à un seul fichier `lib.rs` et de s'en tenir là. Cependant, pour le maintenir plus organisé, il est utile de le répartir sur différents fichiers. Notre programme aura les fichiers suivants dans le répertoire `programs/src` :

`/instructions/deposit.rs`

`/instructions/withdraw.rs`

`/instructions/mod.rs`

`errors.rs`

`state.rs`

`lib.rs`

Le fichier `lib.rs` continuera de servir de point d'entrée à notre programme, mais la logique de chaque instruction sera contenue dans son propre fichier. Allez-y et créez l'architecture du programme décrite ci-dessus et nous commencerons.

### 2. `lib.rs`

Avant d'écrire une quelconque logique, nous allons configurer toutes nos informations de base. Commençons par `lib.rs`. Notre logique réelle résidera dans le répertoire `/instructions`.

Le fichier `lib.rs` servira de point d'entrée à notre programme. Il définira les points d'API que toutes les transactions doivent parcourir.

```rust
use anchor_lang::prelude::*;
use instructions::deposit::*;
use instructions::withdraw::*;
use state::*;

pub mod instructions;
pub mod state;
pub mod errors;

declare_id!("VOTRE_CLE_PROGRAMME_ICI");

#[program]
mod burry_oracle_program {

    use super::*;

    pub fn deposit(ctx: Context<Deposit>, escrow_amt: u64, unlock_price: u64) -> Result<()> {
        deposit_handler(ctx, escrow_amt, unlock_price)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        withdraw_handler(ctx)
    }
}
```

### 3. `state.rs`

Ensuite, définissons notre compte de données pour ce programme : `EscrowState`. Notre compte de données stockera deux informations :

- `unlock_price` - Le prix de SOL en USD auquel vous pouvez retirer ; vous pouvez le coder en dur à n'importe quelle valeur (par exemple, 21,53 $)
- `escrow_amount` - Suivez le nombre de lamports stockés dans le compte d'entiercement

Nous définirons également notre seed PDA de `"MICHAEL BURRY"` et notre clé publique oracle SOL_USD codée en dur `SOL_USDC_FEED`.

```rust
// dans state.rs
use anchor_lang::prelude::*;

pub const ESCROW_SEED: &[u8] = b"MICHAEL BURRY";
pub const SOL_USDC_FEED: &str = "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR";

#[account]
pub struct EscrowState {
    pub unlock_price: f64,
    pub escrow_amount: u64,
}
```

### 4. Erreurs

Définissons les erreurs personnalisées que nous utiliserons tout au long du programme. Dans le fichier `errors.rs`, collez ce qui suit :

```rust
use anchor_lang::prelude::*;

#[error_code]
#[derive(Eq, PartialEq)]
pub enum EscrowErrorCode {
    #[msg("Ce n'est pas un compte Switchboard valide")]
    InvalidSwitchboardAccount,
    #[msg("Le flux Switchboard n'a pas été mis à jour depuis 5 minutes")]
    FluxObsolescence,
    #[msg("Le flux Switchboard a dépassé l'intervalle de confiance fourni")]
    IntervalleConfianceDepasse,
    #[msg("Le prix actuel de SOL n'est pas supérieur au prix de déverrouillage de l'entiercement.")]
    PrixSolSuperieurPrixDeverrouillage,
}
```

### 5. `mod.rs`

Configurez notre fichier `instructions/mod.rs`.

```rust
// à l'intérieur de mod.rs
pub mod deposit;
pub mod withdraw;
```

### 6. **Dépôt**



Maintenant que tout le code de base est prêt, passons à notre instruction de dépôt. Cela résidera dans le fichier `/src/instructions/deposit.rs`. Lorsqu'un utilisateur dépose, une PDA doit être créée avec la chaîne "MICHAEL BURRY" et la clé publique de l'utilisateur comme seeds. Cela signifie implicitement qu'un utilisateur ne peut ouvrir qu'un compte d'entiercement à la fois. L'instruction devrait initialiser un compte à cette PDA et envoyer la quantité de SOL que l'utilisateur souhaite verrouiller à cet endroit. L'utilisateur devra être un signataire.

Construisons d'abord la structure contexte Deposit. Pour ce faire, nous devons réfléchir aux comptes qui seront nécessaires pour cette instruction. Nous commençons par les suivants :

```rust
//à l'intérieur de deposit.rs
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    system_instruction::transfer,
    program::invoke
};

#[derive(Accounts)]
pub struct Deposit<'info> {
    // compte utilisateur
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
      init,
      seeds = [ESCROW_SEED, user.key().as_ref()],
      bump,
      payer = user,
      space = std::mem::size_of::<EscrowState>() + 8
    )]
    pub escrow_account: Account<'info, EscrowState>,
		// programme système
    pub system_program: Program<'info, System>,
}
```

Remarquez les contraintes que nous avons ajoutées aux comptes :
- Parce que nous allons transférer du SOL du compte utilisateur au compte `escrow_state`, ils doivent tous deux être mutables.
- Nous savons que le `escrow_account` doit être une PDA dérivée avec la chaîne "MICHAEL BURRY" et la clé publique de l'utilisateur. Nous pouvons utiliser les contraintes du compte Anchor pour garantir que l'adresse passée répond réellement à cette exigence.
- Nous savons également que nous devons initialiser un compte à cette PDA pour stocker certaines informations pour le programme. Nous utilisons la contrainte `init` ici.

Passons à la logique réelle. Tout ce que nous avons à faire est d'initialiser l'état du compte `escrow_state` et de transférer le SOL. Nous attendons de l'utilisateur qu'il transmette la quantité de SOL qu'il souhaite verrouiller dans l'entiercement et le prix pour le déverrouiller. Nous stockerons ces valeurs dans le compte `escrow_state`.

Ensuite, la méthode doit exécuter le transfert. Ce programme verrouillera du SOL natif. Pour cette raison, nous n'avons pas besoin d'utiliser des comptes de jetons ou le programme de jetons Solana. Nous devrons utiliser le `system_program` pour transférer les lamports que l'utilisateur souhaite verrouiller dans l'entiercement et invoquer l'instruction de transfert.

```rust
pub fn deposit_handler(ctx: Context<Deposit>, escrow_amt: u64, unlock_price: u64) -> Result<()> {
		msg!("Dépôt de fonds dans l'entiercement...");

    let escrow_state = &mut ctx.accounts.escrow_account;
    escrow_state.unlock_price = unlock_price;
    escrow_state.escrow_amount = escrow_amount;

    let transfer_ix = transfer(
      &ctx.accounts.user.key(),
      &escrow_state.key(),
      escrow_amount
    );

    invoke(
        &transfer_ix,
        &[
            ctx.accounts.user.to_account_info(),
            ctx.accounts.escrow_account.to_account_info(),
            ctx.accounts.system_program.to_account_info()
        ]
    )?;

    msg!("Transfert terminé. L'entiercement débloquera le SOL à {}", &ctx.accounts.escrow_account.unlock_price);
}
```

C'est l'essentiel de l'instruction de dépôt ! Le résultat final du fichier `deposit.rs` devrait ressembler à ce qui suit :

```rust
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    system_instruction::transfer,
    program::invoke
};

pub fn deposit_handler(ctx: Context<Deposit>, escrow_amount: u64, unlock_price: f64) -> Result<()> {
    msg!("Dépôt de fonds dans l'entiercement...");

    let escrow_state = &mut ctx.accounts.escrow_account;
    escrow_state.unlock_price = unlock_price;
    escrow_state.escrow_amount = escrow_amount;

    let transfer_ix = transfer(
        &ctx.accounts.user.key(),
        &escrow_state.key(),
        escrow_amount
    );

    invoke(
        &transfer_ix,
        &[
            ctx.accounts.user.to_account_info(),
            ctx.accounts.escrow_account.to_account_info(),
            ctx.accounts.system_program.to_account_info()
        ]
    )?;

    msg!("Transfert terminé. L'entiercement débloquera le SOL à {}", &ctx.accounts.escrow_account.unlock_price);

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    // compte utilisateur
    #[account(mut)]
    pub user: Signer<'info>,
    // compte pour stocker le SOL dans l'entiercement
    #[account(
        init,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        payer = user,
        space = std::mem::size_of::<EscrowState>() + 8
    )]
    pub escrow_account: Account<'info, EscrowState>,

    pub system_program: Program<'info, System>,
}
```

**Retrait**

L'instruction de retrait nécessitera les mêmes trois comptes que l'instruction de dépôt, ainsi que le compte d'alimentation SOL_USDC Switchboard. Ce code sera placé dans le fichier `withdraw.rs`.

```rust
use crate::state::*;
use crate::errors::*;
use std::str::FromStr;
use anchor_lang::prelude::*;
use switchboard_v2::AggregatorAccountData;
use anchor_lang::solana_program::clock::Clock;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // compte utilisateur
    #[account(mut)]
    pub user: Signer<'info>,
    // compte d'entiercement
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        close = user
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // Aggregator SOL Switchboard
    #[account(
        address = Pubkey::from_str(SOL_USDC_FEED).unwrap()
    )]
    pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
}
```

Notez que nous utilisons la contrainte `close` car une fois la transaction terminée, nous voulons fermer le compte `escrow_account`. Le SOL utilisé comme loyer dans le compte sera transféré au compte utilisateur.

Nous utilisons également les contraintes d'adresse pour vérifier que le compte d'alimentation passé est effectivement le flux `usdc_sol` et non un autre flux (nous avons l'adresse SOL_USDC_FEED codée en dur). De plus, la structure `AggregatorAccountData` que nous désérialisons provient de la crate Rust Switchboard. Elle vérifie que le compte donné est détenu par le programme switchboard et nous permet de consulter facilement ses valeurs. Vous remarquerez qu'elle est enveloppée dans un `AccountLoader`. Cela est dû au fait que le flux est en réalité un compte assez volumineux et doit être copié de manière efficace.

Maintenant, implémentons la logique de l'instruction de retrait. Tout d'abord, nous vérifions si le flux est obsolète. Ensuite, nous récupérons le prix actuel du SOL stocké dans le compte `feed_aggregator`. Enfin, nous voulons vérifier que le prix actuel est supérieur au `unlock_price` de l'entiercement. Si c'est le cas, nous transférons le SOL du compte d'entiercement vers l'utilisateur et fermons le compte. Sinon, l'instruction doit se terminer et renvoyer une erreur.

```rust
pub fn withdraw_handler(ctx: Context<Withdraw>, params: WithdrawParams) -> Result<()> {
    let feed = &ctx.accounts.feed_aggregator.load()?;
    let escrow_state = &ctx.accounts.escrow_account;

    // obtenir le résultat
    let val: f64 = feed.get_result()?.try_into()?;

    // vérifier si le flux a été mis à jour au cours des dernières 300 secondes
    feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
    .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

    msg!("Le résultat actuel du flux est de {} !", val);
    msg!("Le prix de déverrouillage est de {}", escrow_state.unlock_price);

    if val < escrow_state.unlock_price as f64 {
        return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
    }

	....
}
```

Pour finaliser la logique, nous allons effectuer le transfert. Cette fois-ci, nous devrons transférer les fonds d'une manière différente. Étant donné que nous transférons à partir d'un compte qui détient également des données, nous ne pouvons pas utiliser la méthode `system_program::transfer` comme précédemment. Si nous essayons, l'instruction échouera avec l'erreur suivante.

```zsh
'Transfer: `from` must not carry data'
```

Pour remédier à cela, nous utiliserons `try_borrow_mut_lamports()` sur chaque compte et ajouterons/soustrairons le montant de lamports stocké dans chaque compte.

```rust
// 'Transfer: `from` must not carry data'
  **escrow_state.to_account_info().try_borrow_mut_lamports()? = escrow_state
      .to_account_info()
      .lamports()
      .checked_sub(escrow_state.escrow_amount)
      .ok_or(ProgramError::InvalidArgument)?;

  **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.user
      .to_account_info()
      .lamports()
      .checked_add(escrow_state.escrow_amount)
      .ok_or(ProgramError::InvalidArgument)?;
```

La méthode de retrait finale dans le fichier `withdraw.rs` devrait ressembler à ceci:

```rust
use crate::state::*;
use crate::errors::*;
use std::str::FromStr;
use anchor_lang::prelude::*;
use switchboard_v2::AggregatorAccountData;
use anchor_lang::solana_program::clock::Clock;

pub fn withdraw_handler(ctx: Context<Withdraw>) -> Result<()> {
    let feed = &ctx.accounts.feed_aggregator.load()?;
    let escrow_state = &ctx.accounts.escrow_account;

    // obtenir le résultat
    let val: f64 = feed.get_result()?.try_into()?;

    // vérifier si le flux a été mis à jour au cours des dernières 300 secondes
    feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
    .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

    msg!("Le résultat actuel du flux est de {} !", val);
    msg!("Le prix de déverrouillage est de {}", escrow_state.unlock_price);

    if val < escrow_state.unlock_price as f64 {
        return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
    }

    // 'Transfer: `from` must not carry data'
    **escrow_state.to_account_info().try_borrow_mut_lamports()? = escrow_state
        .to_account_info()
        .lamports()
        .checked_sub(escrow_state.escrow_amount)
        .ok_or(ProgramError::InvalidArgument)?;

    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.user
        .to_account_info()
        .lamports()
        .checked_add(escrow_state.escrow_amount)
        .ok_or(ProgramError::InvalidArgument)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // compte utilisateur
    #[account(mut)]
    pub user: Signer<'info>,
    // compte d'entiercement
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        close = user
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // Aggregator SOL Switchboard
    #[account(
        address = Pubkey::from_str(SOL_USDC_FEED).unwrap()
    )]
    pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
}
```

Et c'est tout pour le programme ! À ce stade, vous devriez pouvoir exécuter `anchor build` sans aucune erreur.

Remarque : si vous voyez une erreur comme celle présentée ci-dessous, vous pouvez l'ignorer en toute sécurité.

```bash
Compiling switchboard-v2 v0.4.0
Error: Function _ZN86_$LT$switchboard_v2..aggregator..AggregatorAccountData$u20$as$u20$core..fmt..Debug$GT$3fmt17hea9f7644392c2647E Stack offset of 4128 exceeded max offset of 4096 by 32 bytes, please minimize large stack variables
```

### 7. Tests

Écrivons quelques tests. Nous devrions en avoir quatre :

- Créer un entiercement avec le prix de déverrouillage ***en dessous*** du prix actuel du SOL pour tester le retrait.
- Retirer et fermer l'entiercement ci-dessus.
- Créer un entiercement avec le prix de déverrouillage ***au-dessus*** du prix actuel du SOL pour tester le retrait.
- Tenter de retirer et échouer avec l'entiercement ci-dessus.

Notez qu'il ne peut y avoir qu'un seul entiercement par utilisateur, donc l'ordre ci-dessus est important.

Nous fournirons tout le code de test dans un seul extrait. Parcourez-le pour vous assurer de le comprendre avant d'exécuter `anchor test`.

```typescript
// tests/burry-escrow.ts

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BurryEscrow } from "../target/types/burry_escrow";
import { Big } from "@switchboard-xyz/common";
import { AggregatorAccount, AnchorWallet, SwitchboardProgram } from "@switchboard-xyz/solana.js"
import { assert } from "chai";

export const solUsedSwitchboardFeed = new anchor.web3.PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR")

describe("burry-escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.BurryEscrow as Program<BurryEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer

  it("Create Burry Escrow Below Price", async () => {
    // fetch switchboard devnet program object
    const switchboardProgram = await SwitchboardProgram.load(
      "devnet",
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // derive escrow state account
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )

    // fetch latest SOL price
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error('Aggregator holds no value')
    }
    const failUnlockPrice = solPrice.minus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    // Send transaction
    try {
      const tx = await program.methods.deposit(
        amountToLockUp, 
        failUnlockPrice
      )
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")

      // Fetch the created account
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("Onchain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data onchain is equal to local 'data'
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch (e) {
      console.log(e)
      assert.fail(e)
    }
  })

  it("Withdraw from escrow", async () => {
    // derive escrow address
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    
    // send tx
    const tx = await program.methods.withdraw()
    .accounts({
      user: payer.publicKey,
      escrowAccount: escrowState,
      feedAggregator: solUsedSwitchboardFeed,
      systemProgram: anchor.web3.SystemProgram.programId
  })
    .signers([payer])
    .rpc()

    await provider.connection.confirmTransaction(tx, "confirmed")

    // assert that the escrow account has been closed
    let accountFetchDidFail = false;
    try {
      await program.account.escrowState.fetch(escrowState)
    } catch(e){
      accountFetchDidFail = true;
    }

    assert(accountFetchDidFail)
 
  })

  it("Create Burry Escrow Above Price", async () => {
    // fetch switchboard devnet program object
    const switchboardProgram = await SwitchboardProgram.load(
      "devnet",
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // derive escrow state account
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    console.log("Escrow Account: ", escrowState.toBase58())

    // fetch latest SOL price
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error('Aggregator holds no value')
    }
    const failUnlockPrice = solPrice.plus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    // Send transaction
    try {
      const tx = await program.methods.deposit(
        amountToLockUp, 
        failUnlockPrice
      )
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Your transaction signature", tx)

      // Fetch the created account
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("Onchain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data onchain is equal to local 'data'
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch (e) {
      console.log(e)
      assert.fail(e)
    }
  })

  it("Attempt to withdraw while price is below UnlockPrice", async () => {
    let didFail = false;

    // derive escrow address
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    
    // send tx
    try {
      const tx = await program.methods.withdraw()
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        feedAggregator: solUsedSwitchboardFeed,
        systemProgram: anchor.web3.SystemProgram.programId
    })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Your transaction signature", tx)

    } catch (e) {
      // verify tx returns expected error
      didFail = true;
      console.log(e.error.errorMessage)
      assert(e.error.errorMessage == 'Current SOL price is not above Escrow unlock price.')
    }

    assert(didFail)
  })
});
```

Si vous êtes confiant dans la logique de test, allez-y et exécutez `anchor test` dans votre terminal préféré. Vous devriez obtenir quatre tests réussis.

Si quelque chose s'est mal passé, revenez en arrière dans le laboratoire et assurez-vous d'avoir tout correct. Portez une attention particulière à l'intention derrière le code plutôt que de simplement copier/coller. N'hésitez pas non plus à consulter le code fonctionnel [sur la branche `main` de son dépôt Github](https://github.com/Unboxed-Software/michael-burry-escrow).

## Défi

En tant que défi supplémentaire, créez un plan de secours si le flux de données tombe en panne. Si la file d'attente de l'Oracle n'a pas mis à jour le compte de l'agrégateur depuis X temps ou si le compte du flux de données n'existe plus, retirez les fonds placés en garantie par l'utilisateur.

Une solution potentielle à ce défi peut être trouvée [dans le dépôt Github sur la branche `challenge-solution`](https://github.com/Unboxed-Software/michael-burry-escrow/tree/challenge-solution).

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=1a5d266c-f4c1-4c45-b986-2afd4be59991) !

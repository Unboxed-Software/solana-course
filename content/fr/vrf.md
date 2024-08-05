---
title: Fonctions de hasard vérifiables
objectives:
- Expliquer les limitations de la génération de nombres aléatoires onchain
- Expliquer le fonctionnement des Fonctions Randomness Vérifiables (VRF)
- Utiliser la file d'attente Oracla VRF de Switchboard pour générer et consommer du hasard à partir d'un programme onchain
---

# Résumé

- Les tentatives de génération de hasard au sein de votre programme sont susceptibles d'être devinées par les utilisateurs, car il n'y a pas de véritable hasard onchain.
- Les fonctions de Randomness Vérifiable (VRF) offrent aux développeurs la possibilité d'incorporer des nombres aléatoires générés de manière sécurisée dans leurs programmes onchain.
- Une VRF est une fonction pseudorandom à clé publique qui fournit des preuves que ses sorties ont été calculées correctement.
- Switchboard propose une VRF faites pour les développeurs dans l'écosystème Solana.

# Aperçu général

## Hasard On-Chain

Les nombres aléatoires ne sont ***pas*** nativement autorisés onchain. Cela est dû au caractère déterministe de Solana ; chaque validateur exécute votre code et doit obtenir le même résultat. Ainsi, si vous souhaitez créer un programme de tombola, vous devrez chercher en dehors de la blockchain pour obtenir votre hasard. C'est là que les fonctions de Randomness Vérifiable (VRF) interviennent. Les VRF offrent aux développeurs un moyen sécurisé d'intégrer du hasard onchain de manière décentralisée.

## Types de Hasard

Avant d'explorer comment les nombres aléatoires peuvent être générés pour une blockchain, nous devons d'abord comprendre comment ils sont générés sur les systèmes informatiques traditionnels. Il existe vraiment deux types de nombres aléatoires : le *vrai hasard* et le *pseudorandom*. La différence entre les deux réside dans la manière dont les nombres sont générés.

Les ordinateurs peuvent acquérir des nombres *vraiment aléatoires* en prenant une mesure physique du monde extérieur en tant qu'entropie. Ces mesures exploitent des phénomènes naturels tels que le bruit électronique, la désintégration radioactive ou le bruit atmosphérique pour générer des données aléatoires. Étant donné que ces processus sont intrinsèquement imprévisibles, les nombres qu'ils produisent sont vraiment aléatoires et non reproductibles.

Les nombres *pseudorandom*, en revanche, sont générés par des algorithmes utilisant un processus déterministe pour produire des séquences de nombres qui semblent être aléatoires. Les générateurs de nombres pseudorandom (PRNG) commencent avec une valeur initiale appelée seed, puis utilisent des formules mathématiques pour générer les nombres suivants dans la séquence. Avec la même seed, un PRNG produira toujours la même séquence de nombres. Il est important de semer avec quelque chose proche de l'entropie réelle : une entrée "aléatoire" fournie par l'administrateur, le dernier journal système, une combinaison de l'heure de l'horloge de votre système et d'autres facteurs, etc. Notez qu'il est possible de casser d'anciens jeux vidéo car les joueurs ont découvert comment leur hasard était calculé. Un jeu en particulier utilisait le nombre de pas effectués dans le jeu comme seed.

Malheureusement, aucun des deux types de hasard n'est nativement disponible dans les programmes Solana, car ces programmes doivent être déterministes. Tous les validateurs doivent parvenir à la même conclusion. Il n'y a aucune façon pour eux de tous tirer le même nombre aléatoire, et s'ils utilisaient une seed, elle serait vulnérable aux attaques. Consultez les [FAQ de Solana](https://docs.solana.com/developing/onchain-programs/developing-rust#depending-on-rand) pour plus d'informations. Nous devrons donc chercher en dehors de la blockchain pour obtenir du hasard avec les VRF.

## Qu'est-ce que le Randomness Vérifiable?

Une Fonction de Randomness Vérifiable (VRF) est une fonction pseudorandom à clé publique qui fournit des preuves que ses sorties ont été calculées correctement. Cela signifie que nous pouvons utiliser une paire de clés cryptographiques pour générer un nombre aléatoire avec une preuve, qui peut ensuite être validée par quiconque pour s'assurer que la valeur a été calculée correctement sans possibilité de divulguer la clé secrète du producteur. Une fois validée, la valeur aléatoire est stockée onchain dans un compte.

Les VRF sont un composant crucial pour obtenir du hasard vérifiable et imprévisible sur une blockchain, en adressant certaines des lacunes des PRNG traditionnels et des défis liés à l'obtention d'un véritable hasard dans un système décentralisé.

Il existe trois propriétés clés d'une VRF:

1. **Déterministe** - Une VRF prend une clé secrète et un nonce en entrée et produit de manière déterministe une sortie (ensemencement). Le résultat est une valeur apparemment aléatoire. Avec la même clé secrète et le même nonce, la VRF produira toujours la même sortie. Cette propriété garantit que la valeur aléatoire peut être reproduite et vérifiée par n'importe qui.
2. **Imprévisibilité** - La sortie d'une VRF semble indiscernable du vrai hasard pour quiconque n'a pas accès à la clé secrète. Cette propriété garantit que, bien que la VRF soit déterministe, vous ne pouvez pas prédire le résultat à l'avance sans connaissance des entrées.
3. **Vérifiabilité** - Tout le monde peut vérifier la validité de la valeur aléatoire générée par une VRF en utilisant la clé secrète et le nonce correspondants.

Les VRF ne sont pas spécifiques à Solana et ont été utilisés sur d'autres blockchains pour générer des nombres pseudorandom. Heureusement, Switchboard propose sa mise en œuvre de VRF pour Solana.

## Implémentation VRF de Switchboard

Switchboard est un réseau Oracle décentralisé qui propose des VRF sur Solana. Les Oracles sont des services qui fournissent des données externes à une blockchain, leur permettant d'interagir et de répondre à des événements du monde réel. Le réseau Switchboard est composé de nombreux oracles individuels exploités par des tiers pour fournir des données externes et répondre aux demandes de services onchain. Pour en savoir plus sur le réseau Oracle de Switchboard, veuillez consulter notre [leçon sur les Oracles](./oracles).

La VRF de Switchboard permet aux utilisateurs de demander à un oracle de produire une sortie aléatoire onchain. Une fois qu'un oracle a été assigné à la demande, la preuve du résultat VRF doit être vérifiée onchain avant de pouvoir être utilisée. La preuve VRF nécessite 276 instructions (~48 transactions) pour être entièrement vérifiée onchain. Une fois la preuve vérifiée, le programme Switchboard exécutera un rappel onchain défini par le compte VRF pendant la création du compte. À partir de là, le programme peut consommer les données aléatoires.

Vous pourriez vous demander comment ils sont rémunérés. Dans l'implémentation VRF de Switchboard, vous payez effectivement par demande. // BESOIN de plus de données

## Demande et Consommation de VRF

Maintenant que nous savons ce qu'est une VRF et comment elle s'intègre dans le réseau Oracle Switchboard, examinons de plus près comment demander et consommer du hasard à partir d'un programme Solana. Globalement, le processus de demande et de consommation de hasard depuis Switchboard ressemble à ceci :

1. Créer une PDA (`programAuthority`) qui sera utilisée comme autorité du programme et signera au nom du programme.
2. Créer un compte Switchboard VRF avec `programAuthority` comme `authority` et spécifier la fonction `callback` vers laquelle la VRF renverra les données.
3. Appeler l'instruction `request_randomness` sur le programme Switchboard. Le programme attribuera un oracle à notre demande VRF.
4. L'oracle traite la demande et répond au programme Switchboard avec la preuve calculée à l'aide de sa clé secrète.
5. L'oracle exécute les 276 instructions pour vérifier la preuve VRF.
6. Une fois la preuve VRF vérifiée, le programme Switchboard invoque la `callback` qui a été passée initialement avec la VRF Account lors de la création du compte. À partir de là, le programme peut consommer les données aléatoires.
7. Le programme consomme le nombre aléatoire et peut exécuter la logique métier associée !

Il y a beaucoup d'étapes ici, mais ne vous inquiétez pas, nous allons passer en revue chaque étape du processus en détail.

Tout d'abord, il y a quelques comptes que nous devrons créer nous-mêmes afin de demander du hasard, notamment les comptes `authority` et `vrf`. Le compte `authority` est une PDA dérivée de notre programme qui demande le hasard. Ainsi, la PDA que nous créons aura nos propres seeds pour nos propres besoins. Pour l'instant, nous les définirons simplement à `VRFAUTH`.

```tsx
// dériver la PDA
[vrfAuthorityKey, vrfAuthoritySecret] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("VRFAUTH")],
    program.programId
  )
```

Ensuite, nous devons initialiser un compte `vrf` qui est possédé par le programme Switchboard et marquer la PDA que nous venons de dériver comme son autorité. Le compte `vrf` a la structure de données suivante.

```rust
pub struct VrfAccountData {
    /// Le statut actuel du compte VRF.
    pub status: VrfStatus,
    /// Compteur incrémental pour le suivi des rounds VRF.
    pub counter: u128,
    /// Compte onchain délégué pour apporter des modifications au compte. <-- C'est notre PDA
    pub authority: Pubkey,
    /// Les données de compte OracleQueueAccountData qui sont attribuées pour répondre à la demande de mise à jour VRF.
    pub oracle_queue: Pubkey,
    /// Le compte de jeton utilisé pour détenir des fonds pour la demande de mise à jour VRF.
    pub escrow: Pubkey,
    /// La fonction de rappel qui est invoquée lorsqu'une demande de mise à jour est vérifiée avec succès.
    pub callback: CallbackZC,
    /// Le nombre d'oracles attribués à une demande de mise à jour VRF.
    pub batch_size: u32,
    /// Structure contenant l'état intermédiaire entre les actions de manivella VRF.
    pub builders: [VrfBuilder; 8],
    /// Le nombre de builders.
    pub builders_len: u32,
    pub test_mode: bool,
    /// Résultats Oracle de la ronde actuelle de demande de mise à jour qui n'ont pas encore été acceptés comme valides
    pub current_round: VrfRound,
    /// Réservé pour des informations futures.
    pub _ebuf: [u8; 1024],
}
```

Certains champs importants de ce compte sont `authority`, `oracle_queue` et `callback`. `authority` devrait être une PDA du programme qui a la capacité de demander du hasard sur ce compte `vrf`. De cette façon, seul ce programme peut fournir la signature nécessaire pour la demande vrf. Le champ `oracle_queue` vous permet de spécifier quelle file d'attente d'oracle spécifique vous souhaitez utiliser pour les demandes vrf faites avec ce compte. Si vous n'êtes pas familier avec les files d'attente d'oracle sur Switchboard, consultez la [leçon sur les Oracles dans cette unité](./oracles) ! Enfin, le champ `callback` est l'endroit où vous définissez l'instruction de rappel que le programme Switchboard doit invoquer une fois que le résultat aléatoire a été vérifié.

Le champ `callback` est de type `[CallbackZC](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/ecvrf.rs#L25)`.

```rust
#[zero_copy(unsafe)]
#[repr(packed)]
pub struct CallbackZC {
    /// L'ID du programme du programme de rappel qui est invoqué.
    pub program_id: Pubkey,
    /// Les comptes utilisés dans l'instruction de rappel.
    pub accounts: [AccountMetaZC; 32],
    /// Le nombre de comptes utilisés dans le rappel
    pub accounts_len: u32,
    /// Les données d'instruction sérialisées.
    pub ix_data: [u8; 1024],
    /// Le nombre d'octets sérialisés dans les données d'instruction.
    pub ix_data_len: u32,
}
```

C'est ainsi que vous définissez la structure Callback côté client.

```tsx
// exemple
import Callback from '@switchboard-xyz/solana.js'
...
...

const vrfCallback: Callback = {
      programId: program.programId,
      accounts: [
        // assurez-vous que tous les comptes dans consumeRandomness sont renseignés
        { pubkey: clientState, isSigner: false, isWritable: true },
        { pubkey: vrfClientKey, isSigner: false, isWritable: true },
        { pubkey: vrfSecret.publicKey, isSigner: false, isWritable: true },
      ],
			// utilisez le nom de l'instruction
      ixData: vrfIxCoder.encode("consumeRandomness", ""), // passez tous les paramètres de l'instruction ici
    }
```

Maintenant, vous pouvez créer le compte `vrf`.

```tsx
// Créer Switchboard VRF
  [vrfAccount] = await switchboard.queue.createVrf({
    callback: vrfCallback,
    authority: vrfAuthorityKey, // autorité vrf
    vrfKeypair: vrfSecret,
    enable: !queue.unpermissionedVrfEnabled, // définir les autorisations uniquement si nécessaire
  })
```

Maintenant que nous avons tous nos comptes nécessaires, nous pouvons enfin appeler l'instruction `request_randomness` sur le programme Switchboard. Il est important de noter que vous pouvez invoquer `request_randomness` dans un client ou à l'intérieur d'un programme avec une invocation inter-programme (CPI). Jetons un coup d'œil aux comptes requis pour cette demande en consultant la définition de la struct Account dans le [programme Switchboard réel](https://github.com/switchboard-xyz/solana-sdk/blob/fbef37e4a78cbd8b8b6346fcb96af1e20204b861/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs#L8).

```rust
// du programme Switchboard
// https://github.com/switchboard-xyz/solana-sdk/blob/fbef37e4a78cbd8b8b6346fcb96af1e20204b861/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs#L8

pub struct VrfRequestRandomness<'info> {
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    #[account(mut)]
    pub vrf: AccountInfo<'info>,
    #[account(mut)]
    pub oracle_queue: AccountInfo<'info>,
    pub queue_authority: AccountInfo<'info>,
    pub data_buffer: AccountInfo<'info'>,
    #[account(
        mut,
        seeds = [
            b"PermissionAccountData",
            queue_authority.key().as_ref(),
            oracle_queue.key().as_ref(),
            vrf.key().as_ref()
        ],
        bump = params.permission_bump
    )]
    pub permission: AccountInfo<'info'>,
    #[account(mut, constraint = escrow.owner == program_state.key())]
    pub escrow: Account<'info', TokenAccount>,
    #[account(mut, constraint = payer_wallet.owner == payer_authority.key())]
    pub payer_wallet: Account<'info', TokenAccount>,
    #[account(signer)]
    pub payer_authority: AccountInfo<'info'>,
    pub recent_blockhashes: AccountInfo<'info'>,
    #[account(seeds = [b"STATE"], bump = params.state_bump)]
    pub program_state: AccountInfo<'info'>,
    pub token_program: AccountInfo<'info'>,
}
```

C'est beaucoup de comptes, parcourons chacun d'eux et donnons-leur un peu de contexte.

- `authority` - PDA dérivée de notre programme
- `vrf` - [Compte possédé par le programme Switchboard](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/vrf/struct.VrfAccountData.html)
- Oracle Queue - [Compte possédé par le programme Switchboard qui contient des métadonnées sur la file d'attente d'oracle à utiliser pour cette demande](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/queue/struct.OracleQueueAccountData.html)
- Queue Authority - Autorité de la file d'attente d'oracle choisie
- [Data Buffer](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/queue.rs#L57C165-L57C165) - Compte du `OracleQueueBuffer` contenant une collection de clés publiques d'oracle qui ont réussi à battre avant l'expiration de la configuration `oracleTimeout` de la file d'attente. Stocké dans le compte de file d'attente Oracle.
- [Permission Account Data](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/permission/struct.PermissionAccountData.html)
- Escrow (Compte escrow de Switchboard) - Compte de jeton
- Compte d'état du programme Switchboard - [De type `SbState`](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/sb_state/struct.SbState.html)
- Programme Switchboard - Programme Switchboard
- Payer Token Account - Sera utilisé pour payer les frais
- Payer Authority - Autorité du compte de jeton payeur
- Programme Solana Recent Blockhashes - [Programme Solana Recent Blockhashes](https://docs.rs/solana-program/latest/solana_program/sysvar/recent_blockhashes/index.html)
- Programme Token - Programme Solana Token

Ce sont tous les comptes nécessaires uniquement pour la demande aléatoire, maintenant voyons à quoi cela ressemble dans un programme Solana via une CPI. Pour ce faire, nous utilisons la struct `VrfRequestRandomness` de la [crate rust SwitchboardV2.](https://github.com/switchboard-xyz/solana-sdk/blob/main/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs) Cette struct a certaines capacités intégrées pour nous faciliter la tâche ici, notamment la structure du compte qui nous est définie et nous pouvons facilement appeler `invoke` ou `invoke_signed` sur l'objet.

```rust
// notre programme client
use switchboard_v2::VrfRequestRandomness;
use state::*;

pub fn request_randomness(ctx: Context<RequestRandomness>, request_params: RequestRandomnessParams) -> Result <()> {
	let switchboard_program = ctx.accounts.switchboard_program.to_account_info();
	
	let vrf_request_randomness = VrfRequestRandomness {
	    authority: ctx.accounts.vrf_state.to_account_info(),
	    vrf: ctx.accounts.vrf.to_account_info(),
	    oracle_queue: ctx.accounts.oracle_queue.to_account_info(),
	    queue_authority: ctx.accounts.queue_authority.to_account_info(),
	    data_buffer: ctx.accounts.data_buffer.to_account_info(),
	    permission: ctx.accounts.permission.to_account_info(),
	    escrow: ctx.accounts.switchboard_escrow.clone(),
	    payer_wallet: ctx.accounts.payer_wallet.clone(),
	    payer_authority: ctx.accounts.user.to_account_info(),
	    recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
	    program_state: ctx.accounts.program_state.to_account_info(),
	    token_program: ctx.accounts.token_program.to_account_info(),
	};
	
	msg!("requesting randomness");
	vrf_request_randomness.invoke_signed(
	    switchboard_program,
	    request_params.switchboard_state_bump,
	    request_params.permission_bump,
	    state_seeds,
	)?;

...

Ok(())

}
```

Une fois que le programme Switchboard est invoqué, il effectue une certaine logique de son côté et attribue un oracle dans la file d'attente oracle définie du compte `vrf` pour répondre à la demande de hasard. L'oracle attribué calcule ensuite une valeur aléatoire et la renvoie au programme Switchboard.

Une fois que le résultat est vérifié, le programme Switchboard invoque ensuite l'instruction `callback` définie dans le compte `vrf`. L'instruction callback est l'endroit où vous auriez écrit votre logique métier en utilisant les nombres aléatoires. Dans le code suivant, nous stockons le hasard résultant dans notre PDA `vrf_auth` à partir de notre première étape.

```rust
// notre programme client

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    // état du client vrf
    #[account]
    pub vrf_auth: AccountLoader<'info, VrfClientState>,
    // compte vrf du switchboard
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_auth.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>
}

pub fn handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Consommation de l'aléatoire !");

		// charger les données du compte vrf
    let vrf = ctx.accounts.vrf.load()?;
		// utiliser la méthode get_result pour récupérer les résultats aléatoires
    let result_buffer = vrf.get_result()?;

		// vérifier si le tampon de résultat est tout à 0
    if result_buffer == [0u8; 32] {
        msg!("tampon vrf vide");
        return Ok(());
    }

    msg!("Le tampon de résultat est {:?}", result_buffer);
		// utiliser la valeur aléatoire comme bon vous semble

    Ok(())
}
```

Vous avez maintenant de l'aléatoire ! Hourra ! Mais il y a une dernière chose dont nous n'avons pas encore parlé et c'est comment l'aléatoire est retourné. Switchboard, vous donne votre aléatoire en appelant `[get_result()](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/vrf.rs#L122)`. Cette méthode retourne le champ `current_round.result` du compte `vrf` dans le format SwitchboardDecimal, qui n'est rien d'autre qu'un tampon de 32 entiers non signés `[u8](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/ecvrf.rs#L65C26-L65C26)`. Vous pouvez utiliser ces entiers non signés comme bon vous semble dans votre programme, mais une méthode très courante est de traiter chaque entier du tampon comme son propre nombre aléatoire. Par exemple, si vous avez besoin d'un lancer de dé (1-6), prenez simplement le premier octet du tableau, effectuez le module 6 et ajoutez un.

```rust
// découper le tampon d'octets pour stocker la première valeur
let dice_roll = (result_buffer[0] % 6) + 1;
```

Ce que vous faites ensuite avec les valeurs aléatoires dépend entièrement de vous !

C'est l'essence de la demande d'aléatoire avec une VRF Switchboard. Pour récapituler les étapes impliquées dans une demande VRF, examinez ce diagramme.

![Diagramme VRF](../assets/vrf-diagram.png)

# Laboratoire

Pour le laboratoire de cette leçon, nous reprendrons là où nous nous sommes arrêtés dans la [leçon sur l'Oracle](./oracle). Si vous n'avez pas terminé la leçon et la démo de l'Oracle, nous vous recommandons vivement de le faire, car il y a beaucoup de concepts qui se chevauchent et nous partirons de la base de code de la leçon sur l'Oracle.

Si vous ne voulez pas terminer la leçon sur l'Oracle, le code de démarrage pour ce laboratoire est fourni pour vous dans [la branche principale du référentiel Github du laboratoire](https://github.com/Unboxed-Software/michael-burry-escrow).

Le dépôt contient un programme d'entiercement "Michael Burry". Il s'agit d'un programme qui permet à un utilisateur de bloquer des fonds solana dans un compte d'entiercement qui ne peut pas être retiré tant que le SOL n'a pas atteint un prix prédéfini en USD choisi par l'utilisateur. Nous allons ajouter la fonctionnalité VRF à ce programme pour permettre à l'utilisateur de "sortir de la prison" en faisant un double. Notre démo d'aujourd'hui permettra à l'utilisateur de lancer deux dés virtuels, s'il fait un double (les deux dés correspondent), l'utilisateur peut retirer ses fonds de l'entiercement indépendamment du prix du SOL.

### 1. Configuration du programme

Si vous clonez le dépôt de la leçon précédente, assurez-vous de faire ce qui suit :

1. `git clone [https://github.com/Unboxed-Software/michael-burry-escrow](https://github.com/Unboxed-Software/michael-burry-escrow)`
2. `cd michael-burry-escrow`
3. `anchor build`
4. `anchor keys list`
    1. Prenez la clé résultante et mettez-la dans `Anchor.toml` et `programs/burry-escrow/src/lib.rs`
5. `solana config get`
    1. Prenez le chemin de votre **Keypair** et changez le champ `wallet` dans votre `Anchor.toml`
6. `yarn install`
7. `anchor test`

Lorsque tous les tests passent, nous sommes prêts à commencer. Nous commencerons par remplir quelques éléments de base, puis nous implémenterons les fonctions.

### 2. Cargo.toml

Tout d'abord, puisque la VRF utilise des jetons SPL pour leurs frais, nous devons importer `anchor-spl` dans notre fichier `Cargo.toml`.

```tsx
[dependencies]
anchor-lang = "0.28.0"
anchor-spl = "0.28.0"
switchboard-v2 = "0.4.0"
```

### 3. Lib.rs

Ensuite, éditons `lib.rs` et ajoutons les fonctions supplémentaires que nous allons construire aujourd'hui. Les fonctions sont les suivantes :
- `init_vrf_client` - Crée la PDA de l'autorité VRF, qui signera et consommera l'aléatoire.
- `get_out_of_jail` - Demande l'aléatoire du VRF, effectivement en lançant les dés.
- `consume_randomess` - La fonction de rappel pour la VRF où nous vérifierons les lancers de dés.

```rust
use anchor_lang::prelude::*;
use instructions::deposit::*;
use instructions::withdraw::*;
use instructions::init_vrf_client::*;
use instructions::get_out_of_jail::*;
use instructions::consume_randomness::*;

pub mod instructions;
pub mod state;
pub mod errors;

declare_id!("VOTRE_CLE_ICI");

#[program]
mod burry_escrow {

    use crate::instructions::init_vrf_client::init_vrf_client_handler;

    use super::*;

    pub fn deposit(ctx: Context<Deposit>, escrow_amt: u64, unlock_price: f64) -> Result<()> {
        deposit_handler(ctx, escrow_amt, unlock_price)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        withdraw_handler(ctx)
    }

    pub fn init_vrf_client(ctx: Context<InitVrfClient>) -> Result<()>{
        init_vrf_client_handler(ctx)
    }

		pub fn get_out_of_jail(ctx: Context<RequestRandomness>, params: RequestRandomnessParams) -> Result<()>{
        get_out_of_jail_handler(ctx, params)
    }

    pub fn consume_randomness(ctx: Context<ConsumeRandomness>) -> Result<()>{
        consume_randomness_handler(ctx)
    }
}
```

Assurez-vous de remplacer `VOTRE_CLE_ICI` par votre propre clé de programme.

### 4. State.rs

Ensuite, dans `state.rs`, ajoutez un indicateur `out_of_jail` à `EscrowState`. Lorsque nous faisons finalement deux dés correspondants, nous allons inverser cet indicateur. Lorsque la fonction `withdraw` est appelée, nous pouvons transférer les fonds sans vérifier le prix.

```rust
// state.rs
#[account]
pub struct EscrowState {
    pub unlock_price: f64,
    pub escrow_amount: u64,
    pub out_of_jail: bool
}
```

Ensuite, créez notre deuxième compte de données pour ce programme : `VrfClientState`. Celui-ci va contenir l'état de nos lancers de dés. Il aura les champs suivants :

- `bump` - Stocke le bump du compte pour une signature ultérieure plus facile.
- `result_buffer` - C'est là que la fonction VRF va déverser les données brutes de l'aléatoire.
- `dice_type` - Nous allons le régler à 6 comme dans un dé à 6 faces.
- `die_result_1` et `die_result_2` - Les résultats de notre lancer de dés.
- `timestamp` - Garde la trace de quand notre dernier lancer a eu lieu.
- `vrf` - Clé publique du compte VRF ; appartenant au programme Switchboard. Nous allons le créer avant d'appeler la fonction d'initialisation de `VrfClientState`. 
- `escrow` - Clé publique de notre compte d'entiercement Burry.

Nous allons également faire du contexte `VrfClientState` une structure `zero_copy`. Cela signifie que nous l'initialiserons avec `load_init()` et le passerons dans les comptes avec `AccountLoader`. Nous faisons cela parce que les fonctions VRF nécessitent beaucoup de comptes et nous devons être attentifs à la pile. Si vous voulez en savoir plus sur `zero_copy`, jetez un œil à notre [leçon sur l'architecture du programme](./program-architecture).

```rust
// state.rs

#[repr(packed)]
#[account(zero_copy(unsafe))]
#[derive(Default)]
pub struct VrfClientState {
    pub bump: u8,
    pub result_buffer: [u8; 32],
		pub dice_type: u8, // Dé à 6 faces
    pub die_result_1: u8,
    pub die_result_2: u8,
    pub timestamp: i64,
    pub vrf: Pubkey,
    pub escrow: Pubkey
}
```



Enfin, nous allons ajouter le `VRF_STATE_SEED` à notre PDA de compte client VRF.

```rust
pub const VRF_STATE_SEED: &[u8] = b"VRFCLIENT";
```

Votre fichier `state.rs` devrait ressembler à ceci :

```rust
use anchor_lang::prelude::*;

pub const ESCROW_SEED: &[u8] = b"MICHAEL BURRY";
pub const VRF_STATE_SEED: &[u8] = b"VRFCLIENT";
pub const SOL_USDC_FEED: &str = "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR";

#[account]
pub struct EscrowState {
    pub unlock_price: f64,
    pub escrow_amount: u64,
    pub out_of_jail: bool
}

#[repr(packed)]
#[account(zero_copy(unsafe))]
#[derive(Default)]
pub struct VrfClientState {
    pub bump: u8,
    pub result_buffer: [u8; 32],
		pub dice_type: u8, // Dé à 6 faces
    pub die_result_1: u8,
    pub die_result_2: u8,
    pub timestamp: i64,
    pub vrf: Pubkey,
    pub escrow: Pubkey
}
```

### 5. Errors.rs

Ensuite, faisons une pause rapide et ajoutons une dernière erreur `InvalidVrfAuthorityError` à `errors.rs`. Nous l'utiliserons lorsque l'autorité VRF est incorrecte.

```rust
use anchor_lang::prelude::*;

#[error_code]
#[derive(Eq, PartialEq)]
pub enum EscrowErrorCode {
    #[msg("Not a valid Switchboard account")]
    InvalidSwitchboardAccount,
    #[msg("Switchboard feed has not been updated in 5 minutes")]
    StaleFeed,
    #[msg("Switchboard feed exceeded provided confidence interval")]
    ConfidenceIntervalExceeded,
    #[msg("Current SOL price is not above Escrow unlock price.")]
    SolPriceAboveUnlockPrice,
    #[msg("Switchboard VRF Account's authority should be set to the client's state pubkey")]
    InvalidVrfAuthorityError,
}
```

### 6. Mod.rs

Maintenant, modifions notre fichier `mod.rs` pour inclure nos nouvelles fonctions que nous allons écrire.

```rust
pub mod deposit;
pub mod withdraw;
pub mod init_vrf_client;
pub mod get_out_of_jail;
pub mod consume_randomness;
```

### 7. Deposit.rs et Withdraw.rs

Enfin, mettons à jour nos fichiers `deposit.rs` et `withdraw.rs` pour refléter nos nouveaux pouvoirs à venir.

Tout d'abord, initialisons notre indicateur `out_of_jail` à `false` dans `deposit.rs`.

```rust
// dans deposit.rs
...
let escrow_state = &mut ctx.accounts.escrow_account;
escrow_state.unlock_price = unlock_price;
escrow_state.escrow_amount = escrow_amount;
escrow_state.out_of_jail = false; 
...
```

Ensuite, écrivons notre logique simple pour sortir de prison. Enveloppons nos vérifications de prix Oracle avec une instruction `if`. Si le drapeau `out_of_jail` sur le compte `escrow_state` est faux, alors nous vérifions le prix auquel déverrouiller le SOL :

```rust
if !escrow_state.out_of_jail {
    // obtenir le résultat
    let val: f64 = feed.get_result()?.try_into()?;

    // vérifier si le flux a été mis à jour au cours des dernières 300 secondes
    feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
    .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

    msg!("Le résultat actuel du flux est {}!", val);
    msg!("Le prix de déverrouillage est {}", escrow_state.unlock_price);

    if val < escrow_state.unlock_price as f64 {
        return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
    }
}
```

Si `out_of_jail` est vrai, alors nous sortons de prison gratuitement et pouvons ignorer la vérification de prix, allant directement à notre retrait.

### 8. Utilisation de VRF

Maintenant que nous avons éliminé les éléments superflus, passons à notre première addition : l'initialisation de notre client VRF. Créons un nouveau fichier appelé `init_vrf_client.rs` dans le dossier `/instructions`.

Nous ajouterons les crates nécessaires, puis créerons le contexte `InitVrfClient`. Nous aurons besoin des comptes suivants :

- `user` - le signataire qui a des fonds en consignation.
- `escrow_account` - le compte d'entiercement créé lorsque l'utilisateur a bloqué ses fonds.
- `vrf_client_state` - le compte que nous créerons dans cette instruction pour stocker l'état des lancers de dés de l'utilisateur.
- `vrf` - Notre VRF détenu par le programme Switchboard, nous créerons ce compte côté client avant d'appeler `init_vrf_client`.
- `system_program` - Le programme système, car nous utilisons la macro init pour `vrf_state`, qui appelle `create_account` sous le capot.

```rust
use crate::state::*;
use crate::errors::*;
use anchor_lang::prelude::*;
use switchboard_v2::VrfAccountData;

#[derive(Accounts)]
pub struct InitVrfClient<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    // compte d'entiercement
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // état du client VRF
    #[account(
        init,
        seeds = [
            VRF_STATE_SEED,
            user.key.as_ref(),
            escrow_account.key().as_ref(),
            vrf.key().as_ref(),
        ],
        payer = user,
        space = 8 + std::mem::size_of::<VrfClientState>(),
        bump
    )]
    pub vrf_state: AccountLoader<'info, VrfClientState>,

    // compte VRF de Switchboard
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_state.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>,
    pub system_program: Program<'info, System>
}
```

Notez que le compte `vrf_state` est une PDA dérivée avec la chaîne `VRF_STATE_SEED` et les clés publiques `user`, `escrow_account` et `vrf` comme seeds. Cela signifie qu'un seul utilisateur ne peut initialiser qu'un seul compte `vrf_state`, tout comme il ne peut avoir qu'un seul `escrow_account`. Comme il n'y en a qu'un, si vous voulez être complet, vous voudrez peut-être implémenter une fonction `close_vrf_state` pour récupérer votre loyer.

Maintenant, écrivons une logique d'initialisation de base pour cette fonction. Tout d'abord, chargeons et initialisons notre compte `vrf_state` en appelant `load_init()`. Ensuite, remplissons les valeurs de chaque champ.

```rust
pub fn init_vrf_client_handler(ctx: Context<InitVrfClient>) -> Result<()> {
    msg!("Validation de l'initialisation du client");

    let mut vrf_state = ctx.accounts.vrf_state.load_init()?;
    *vrf_state = VrfClientState::default();
    vrf_state.bump = ctx.bumps.get("vrf_state").unwrap().clone();
    vrf_state.escrow = ctx.accounts.escrow_account.key();
    vrf_state.die_result_1 = 0;
    vrf_state.die_result_2 = 0;
    vrf_state.timestamp = 0;
    vrf_state.dice_type = 6; // à six faces

    Ok(())
}
```

### 9. Sortir de prison

Maintenant que le compte `VrfClientState` est initialisé, nous pouvons l'utiliser dans l'instruction `get_out_jail`. Créez un nouveau fichier appelé `get_out_of_jail.rs` dans le dossier `/instructions`.

L'instruction `get_out_jail` effectuera notre demande VRF à Switchboard. Nous devrons passer tous les comptes nécessaires à la fois pour la demande VRF et pour notre fonction de rappel de logique métier.

Comptes VRF :
- `payer_wallet` - le portefeuille de jetons qui paiera la demande VRF ; l'utilisateur doit être le propriétaire de ce compte.
- `vrf` - Le compte VRF qui a été créé par le client.
- `oracle_queue` - La file d'attente de l'oracle qui traitera le résultat aléatoire.
- `queue_authority` - L'autorité sur la file d'attente.
- `data_buffer` - Le tampon de données de la file d'attente - utilisé par la file d'attente pour calculer/vérifier l'aléatoire.
- `permission` - Créé lors de la création du compte `vrf`. Il est dérivé de plusieurs des autres comptes.
- `switchboard_escrow` - Où le payeur envoie les jetons pour les demandes.
- `program_state` - État du programme Switchboard.

Programmes :
- `switchboard_program`
- `recent_blockhashes`
- `token_program`
- `system_program`

Comptes de logique métier :
- `user` - Le compte utilisateur qui a consigné les fonds.
- `escrow_account` - Le compte d'état d'entiercement Burry pour l'utilisateur.
- `vrf_state` - Le compte d'état du client VRF initialisé dans l'instruction `init_vrf_client`.

```rust
use crate::state::*;
use crate::errors::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::*;
use switchboard_v2::{VrfAccountData, OracleQueueAccountData, PermissionAccountData, SbState, VrfRequestRandomness};
use anchor_spl::token::{TokenAccount, Token};

#[derive(Accounts)]
pub struct RequestRandomness<'info> {
    // COMPTES PAYEUR
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut,
        constraint =
            payer_wallet.owner == user.key()
            && switchboard_escrow.mint == program_state.load()?.token_mint
    )]
    pub payer_wallet: Account<'info, TokenAccount>,
    // compte d'entiercement Burry
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // état du client VRF
    #[account(
        mut,
        seeds = [
            VRF_STATE_SEED,
            user.key.as_ref(),
            escrow_account.key().as_ref(),
            vrf.key().as_ref(),
        ],
        bump
    )]
    pub vrf_state: AccountLoader<'info, VrfClientState>,
    // compte VRF de Switchboard
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_state.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>,
    // comptes Switchboard
    #[account(mut,
        has_one = data_buffer
    )]
    pub oracle_queue: AccountLoader<'info, OracleQueueAccountData>,
    /// VÉRIFICATION :
    #[account(
        mut,
        constraint = oracle_queue.load()?.authority == queue_authority.key()
    )]
    pub queue_authority: UncheckedAccount<'info>,
    /// VÉRIFICATION
    #[account(mut)]
    pub data_buffer: AccountInfo<'info>,
    #[account(mut)]
    pub permission: AccountLoader<'info, PermissionAccountData>,
    #[account(mut,
        constraint = switchboard_escrow.owner == program_state.key() && switchboard_escrow.mint == program_state.load()?.token_mint
    )]
    pub switchboard_escrow: Account<'info, TokenAccount>,
    #[account(mut)]
    pub program_state: AccountLoader<'info, SbState>,
    /// VÉRIFICATION :
    #[account(
        address = *vrf.to_account_info().owner,
        constraint = switchboard_program.executable == true
    )]
    pub switchboard_program: AccountInfo<'info>,
    // COMPTES SYSTÈME
    /// VÉRIFICATION :
    #[account(address = recent_blockhashes::ID)]
    pub recent_blockhashes: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
}
```

Enfin, nous créerons une nouvelle structure `RequestRandomnessParams`. Nous passerons quelques bumps de compte côté client.

```rust
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct RequestRandomnessParams {
    pub permission_bump: u8,
    pub switchboard_state_bump: u8,
}
```

Maintenant, nous pouvons travailler sur la logique de cette instruction. La logique devrait rassembler tous les comptes nécessaires et les passer à `VrfRequestRandomness`, qui est une struct vraiment pratique de Switchboard. Ensuite, nous signerons la demande et la renverrons sur son chemin.

```rust
pub fn get_out_of_jail_handler(ctx: Context<RequestRandomness>, params: RequestRandomnessParams) -> Result<()> {
    let switchboard_program = ctx.accounts.switchboard_program.to_account_info();
    let vrf_state = ctx.accounts.vrf_state.load()?;

    let bump = vrf_state.bump.clone();
    drop(vrf_state);

    // build vrf request struct from the Switchboard Rust crate
    let vrf_request_randomness = VrfRequestRandomness {
        authority: ctx.accounts.vrf_state.to_account_info(),
        vrf: ctx.accounts.vrf.to_account_info(),
        oracle_queue: ctx.accounts.oracle_queue.to_account_info(),
        queue_authority: ctx.accounts.queue_authority.to_account_info(),
        data_buffer: ctx.accounts.data_buffer.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        escrow: ctx.accounts.switchboard_escrow.clone(),
        payer_wallet: ctx.accounts.payer_wallet.clone(),
        payer_authority: ctx.accounts.user.to_account_info(),
        recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
        program_state: ctx.accounts.program_state.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };

    let vrf_key = ctx.accounts.vrf.key();
    let escrow_key = ctx.accounts.escrow_account.key();
    let user_key = ctx.accounts.user.key();
    let state_seeds: &[&[&[u8]]] = &[&[
        &VRF_STATE_SEED,
        user_key.as_ref(),
        escrow_key.as_ref(),
        vrf_key.as_ref(),
        &[bump],
    ]];

    // submit vrf request with PDA signature
    msg!("requesting randomness");
    vrf_request_randomness.invoke_signed(
        switchboard_program,
        params.switchboard_state_bump,
        params.permission_bump,
        state_seeds,
    )?;

    msg!("randomness requested successfully");

    Ok(())
}
```

### 10. Consommer la Randomness

Maintenant que nous avons construit la logique pour demander une VRF à Switchboard, nous devons construire l'instruction de rappel que le programme Switchboard appellera une fois que la VRF aura été vérifiée. Créez un nouveau fichier appelé `consume_randomness.rs` dans le répertoire `/instructions`.

Cette fonction utilisera le hasard créé pour déterminer quels dés ont été lancés. Si des doubles sont obtenus, définissez le champ `out_of_jail` de `vrf_state` sur true.

Tout d'abord, créons le contexte `ConsumeRandomness`. Heureusement, il ne prend que trois comptes.

- `escrow_account` - compte d'état pour les fonds bloqués de l'utilisateur.
- `vrf_state` - compte d'état pour contenir des informations sur le lancer de dés.
- `vrf` - compte avec le nombre aléatoire qui vient d'être calculé par le réseau Switchboard.

```rust
// à l'intérieur de consume_randomness.rs
use crate::state::*;
use crate::errors::*;
use anchor_lang::prelude::*;
use switchboard_v2::VrfAccountData;

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    // compte d'escrow enfoui
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowState>,
    // état du client vrf
    #[account(mut)]
    pub vrf_state: AccountLoader<'info, VrfClientState>,
    // compte vrf de Switchboard
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_state.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>,
}
```

Maintenant, écrivons la logique pour notre `consume_randomness_handler`. Nous allons d'abord récupérer les résultats du compte `vrf`.

Nous devons appeler `load()` car le `vrf` est passé en tant que `AccountLoader`. Rappelez-vous, `AccountLoader` évite les débordements de pile et de tas pour les grands comptes. Ensuite, nous appelons `get_result()` pour récupérer le hasard à l'intérieur de la struct `VrfAccountData`. Enfin, nous vérifierons si le tampon résultant est mis à zéro. S'il est tout à zéro, cela signifie que les Oracles n'ont pas encore vérifié et déposé le hasard dans le compte.

```rust
// à l'intérieur de consume_randomness.rs
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result<()> {
    msg!("Consommation du hasard...");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("tampon vrf vide");
        return Ok(());
    }

    Ok(())
}
```

Ensuite, nous chargeons notre `vrf_state` en utilisant `load_mut` car nous allons stocker le hasard et les résultats des dés à l'intérieur. Nous voulons également vérifier que le tampon `result_buffer` renvoyé par le `vrf` ne correspond pas octet par octet au `result_buffer` du `vrf_state`. S'ils correspondent, nous savons que le hasard retournée est périmée.

```rust
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result<()> {
    msg!("Hasard consommé avec succès.");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("tampon vrf vide");
        return Ok(());
    }
		// nouveau code
    let vrf_state = &mut ctx.accounts.vrf_state.load_mut()?;
    if result_buffer == vrf_state.result_buffer {
        msg!("result_buffer inchangé");
        return Ok(());
    }

    ...
    ...
}
```

Maintenant, il est temps d'utiliser réellement le résultat aléatoire. Puisque nous n'utilisons que deux dés, nous n'avons besoin que des deux premiers octets du tampon. Pour convertir ces valeurs aléatoires en "lancers de dés", nous utilisons l'arithmétique modulaire. Pour ceux qui ne sont pas familiers avec l'arithmétique modulaire, [Wikipedia peut aider](https://en.wikipedia.org/wiki/Modular_arithmetic). En arithmétique modulaire, les nombres "rebouclent" lorsqu'ils atteignent une quantité fixe donnée. Cette quantité fixe donnée est appelée le module à laisser en reste. Ici, le module est le `dice_type` stocké dans le compte `vrf_state`. Nous l'avons codé en dur à 6 lorsque le compte a été initialisé pour représenter un dé à 6 faces. Lorsque nous utilisons `dice_type`, ou 6, comme module, notre résultat sera un nombre de 0 à 5. Nous ajoutons ensuite un, pour rendre les possibilités résultantes de 1 à 6.

```rust
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result<()> {
    msg!("Hasard consommé avec succès.");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("tampon vrf vide");
        return Ok(());
    }

    let vrf_state = &mut ctx.accounts.vrf_state.load_mut()?;
    let dice_type = vrf_state.dice_type;
    if result_buffer == vrf_state.result_buffer {
        msg!("result_buffer inchangé");
        return Ok(());
    }

    msg!("Le tampon de résultat est {:?}", result_buffer);

    let dice_1 = result_buffer[0] % dice_type + 1;
    let dice_2 = result_buffer[1] % dice_type + 1;

    msg!("Valeur actuelle du dé 1 [1 - {}) = {}!", dice_type, dice_1);
    msg!("Valeur actuelle du dé 2 [1 - {}) = {}!", dice_type, dice_2);

    ...
    ...
}
```

> Petit fait amusant de Christian (l'un des éditeurs) : un octet par lancer est en fait une option légèrement mauvaise pour un lancer de dé. (Assez bon pour la démo) Vous avez 256 options dans un u8. Lorsqu'il est modulo 6, le zéro a un léger avantage dans la distribution (256 n'est pas divisible par 6).
> Nombre de 0 : (255-0)/6 + 1 = 43
> Nombre de 1 : (256-1)/6 = 42,6, donc 42 occurrences de 1
> Nombre de 2 : (257-2)/6 = 42,5, donc 42 occurrences de 2
> Nombre de 3 : (258-3)/6 = 42,5, donc 42 occurrences de 3
> Nombre de 4 : (259-4)/6 = 42,5, donc 42 occurrences de 4
> Nombre de 5 : (260-5)/6 = 42,5, donc 42 occurrences de 5

La dernière chose que nous devons faire est de mettre à jour les champs dans `vrf_state` et de déterminer si l'utilisateur a obtenu des doubles. Si c'est le cas, inversez le drapeau `out_of_jail` sur true.

Si le `out_of_jail` devient vrai, l'utilisateur peut alors appeler l'instruction `withdraw` et elle passera outre la vérification du prix.

```rust
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result<()> {
    msg!("Hasard consommé avec succès.");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("tampon vrf vide");
        return Ok(());
    }

    let vrf_state = &mut ctx.accounts.vrf_state.load_mut()?;
    let dice_type = vrf_state.dice_type;
    if result_buffer == vrf_state.result_buffer {
        msg!("result_buffer inchangé");
        return Ok(());
    }

    msg!("Le tampon de résultat est {:?}", result_buffer);

    let dice_1 = result_buffer[0] % dice_type + 1;
    let dice_2 = result_buffer[1] % dice_type + 1;

    msg!("Valeur actuelle du dé 1 [1 - {}) = {}!", dice_type, dice_1);
    msg!("Valeur actuelle du dé 2 [1 - {}) = {}!", dice_type, dice_2);

    msg!("Mise à jour de l'état VRF avec une valeur aléatoire...");
    vrf_state.result_buffer = result_buffer;
    vrf_state.die_result_1 = dice_1;
    vrf_state.die_result_2 = dice_2;
    vrf_state.timestamp = Clock::get().unwrap().unix_timestamp;

    if dice_1 == dice_2 {
        msg!("Lancé de doubles, sortie de prison gratuite !");
        let escrow_state = &mut ctx.accounts.escrow_account;
        escrow_state.out_of_jail = true;
    }

    Ok(())
}
```

Et voilà pour la fonctionnalité de sortie de prison ! Félicitations, vous venez de construire un programme qui peut consommer les flux de données de Switchboard et soumettre des demandes VRF. Assurez-vous que votre programme se construit avec succès en exécutant `anchor build`.

### 11. Test

Aller, testons notre programme. Historiquement, nous aurions besoin de tester la VRF sur Devnet. Heureusement, les gens de Switchboard ont créé quelques fonctions vraiment utiles pour nous permettre d'exécuter notre propre oracle VRF localement. Pour cela, nous devrons configurer notre serveur local, récupérer tous les comptes appropriés, puis appeler notre programme.

La première chose que nous ferons est d'ajouter quelques comptes supplémentaires dans notre fichier `Anchor.toml` :

```rust
# VRF ACCOUNTS
[[test.validator.clone]] # sbv2 attestation programID
address = "sbattyXrzedoNATfc4L31wC9Mhxsi1BmFhTiN8gDshx"

[[test.validator.clone]] # sbv2 attestation IDL
address = "5ExuoQR69trmKQfB95fDsUGsUrrChbGq9PFgt8qouncz"

[[test.validator.clone]] # sbv2 SbState
address = "CyZuD7RPDcrqCGbNvLCyqk6Py9cEZTKmNKujfPi3ynDd"
```

Ensuite, nous créons un nouveau fichier de test appelé `vrf-test.ts` et copions le code ci-dessous. Il copie les deux derniers tests de la leçon sur l'oracle, ajoute quelques importations et ajoute une nouvelle fonction appelée `delay`.

```tsx
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BurryEscrow } from "../target/types/burry_escrow";
import { Big } from "@switchboard-xyz/common";
import { AggregatorAccount, AnchorWallet, SwitchboardProgram, SwitchboardTestContext, Callback, PermissionAccount } from "@switchboard-xyz/solana.js"
import { NodeOracle } from "@switchboard-xyz/oracle"
import { assert } from "chai";

export const solUsedSwitchboardFeed = new anchor.web3.PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR")

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

describe("burry-escrow-vrf", () => {
  // Configurer le client pour utiliser le cluster local.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.BurryEscrow as Program<BurryEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer

  it("Create Burry Escrow Above Price", async () => {
    // obtenir l'objet du programme Switchboard devnet
    const switchboardProgram = await SwitchboardProgram.load(
      "devnet",
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // dériver le compte d'état d'escrow
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    console.log("Compte d'escrow : ", escrowState.toBase58())

    // obtenir le dernier prix de SOL
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error("L'agrégateur ne détient aucune valeur")
    }
    const failUnlockPrice = solPrice.plus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    // Envoyer la transaction
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
      console.log("Signature de votre transaction", tx)

      // Récupérer le compte créé
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("Prix de déverrouillage sur la chaîne :", newAccount.unlockPrice)
      console.log("Montant dans l'escrow :", escrowBalance)

      // Vérifier si les données sur la chaîne sont égales à la 'data' locale
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch (e) {
      console.log(e)
      assert.fail(e)
    }
  })

  it("Attempt to withdraw while price is below UnlockPrice", async () => {
    let didFail = false;

    // dériver l'adresse d'escrow
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    
    // envoyer la transaction
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
      console.log("Signature de votre transaction", tx)

    } catch (e) {
      // vérifier que la transaction renvoie une erreur attendue
      didFail = true;
      console.log(e.error.errorMessage)
      assert(e.error.errorMessage == 'Current SOL price is not above Escrow unlock price.')
    }

    assert(didFail)
  })
});
```

> Note rapide : si vous voulez uniquement exécuter les tests vrf, changez
>
> 
> `describe("burry-escrow-vrf", () => {`
> 
> — à —
> 
> `describe.only("burry-escrow-vrf", () => {`
> 

Maintenant, nous allons configurer notre serveur Oracla VRF local en utilisant `SwitchboardTestContext`. Cela nous donnera un contexte `switchboard` et un nœud `oracle`. Nous appelons les fonctions d'initialisation dans la fonction `before()`. Cela s'exécutera et se terminera avant le début de tous les tests. Enfin, ajoutons `oracle?.stop()` à la fonction `after()` pour tout nettoyer.

```tsx
describe.only("burry-escrow-vrf", () => {
  // Configurer le client pour utiliser le cluster local.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.BurryEscrow as Program<BurryEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer

  // CODE AJOUTÉ
  let switchboard: SwitchboardTestContext
  let oracle: NodeOracle

  before(async () => {
    switchboard = await SwitchboardTestContext.loadFromProvider(provider, {
      name: "Test Queue",
      // Vous pouvez fournir une paire de clés pour que les schémas PDA ne changent pas entre les exécutions de test
      // keypair: SwitchboardTestContext.loadKeypair(SWITCHBOARD_KEYPAIR_PATH),
      queueSize: 10,
      reward: 0,
      minStake: 0,
      oracleTimeout: 900,
      // les agrégateurs ne nécessiteront pas PERMIT_ORACLE_QUEUE_USAGE avant de rejoindre une file d'attente
      unpermissionedFeeds: true,
      unpermissionedVrf: true,
      enableBufferRelayers: true,
      oracle: {
        name: "Test Oracle",
        enable: true,
        // stakingWalletKeypair: SwitchboardTestContext.loadKeypair(STAKING_KEYPAIR_PATH),
      },
    })

    oracle = await NodeOracle.fromReleaseChannel({
      chain: "solana",
      // utilisez la dernière version du testnet (devnet) de l'oracle
      releaseChannel: "testnet",
      // désactive les fonctionnalités de production telles que la surveillance et les alertes
      network: "localnet",
      rpcUrl: provider.connection.rpcEndpoint,
      oracleKey: switchboard.oracle.publicKey.toBase58(),
      // chemin vers la paire de clés du payeur afin que l'oracle puisse payer les transactions
      secretPath: switchboard.walletPath,
      // définir sur true pour supprimer les journaux de l'oracle dans la console
      silent: false,
      // variables d'environnement facultatives pour accélérer le flux de travail
      envVariables: {
        VERBOSE: "1",
        DEBUG: "1",
        DISABLE_NONCE_QUEUE: "1",
        DISABLE_METRICS: "1",
      },
    })

    switchboard.oracle.publicKey

    // démarrer l'oracle et attendre qu'il commence à battre en chaîne
    await oracle.startAndAwait()
  })

  after(() => {
    oracle?.stop()
  })

// ... reste du code
}
```

Maintenant, exécutons le test réel. Nous allons structurer le test pour continuer à lancer les dés jusqu'à ce que nous obtenions un double, puis nous vérifierons que nous pouvons retirer les fonds.

Tout d'abord, nous rassemblerons tous les comptes dont nous avons besoin. Le contexte de test `switchboard` nous donne la plupart de ceux-ci. Ensuite, nous devrons appeler notre fonction `initVrfClient`. Enfin, nous lancerons nos dés dans une boucle et vérifierons les doubles.

```tsx
it("Roll till you can withdraw", async () => {
  // dériver l'adresse d'escrow
  const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
    program.programId
  )

  const vrfSecret = anchor.web3.Keypair.generate()
  const [vrfClientKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("VRFCLIENT"),
      payer.publicKey.toBytes(),
      escrowState.toBytes(),
      vrfSecret.publicKey.toBytes(),
    ],
    program.programId
  )
  console.log(`Client VRF : ${vrfClientKey}`)

  const vrfIxCoder = new anchor.BorshInstructionCoder(program.idl)
  const vrfClientCallback: Callback = {
    programId: program.programId,
    accounts: [
      // assurez-vous que tous les comptes dans consumeRandomness sont peuplés
      // { pubkey: payer.publicKey, isSigner: false, isWritable: true },
      { pubkey: escrowState, isSigner: false, isWritable: true },
      { pubkey: vrfClientKey, isSigner: false, isWritable: true },
      { pubkey: vrfSecret.publicKey, isSigner: false, isWritable: true },
    ],
    ixData: vrfIxCoder.encode("consumeRandomness", ""), // passer tous les paramètres pour l'instruction ici
  }

  const queue = await switchboard.queue.loadData();

  // Créer le compte Switchboard VRF et Permission
  const [vrfAccount] = await switchboard.queue.createVrf({
    callback: vrfClientCallback,
    authority: vrfClientKey, // autorité VRF
    vrfKeypair: vrfSecret,
    enable: !queue.unpermissionedVrfEnabled, // définir les autorisations uniquement si nécessaire
  })

  // données vrf
  const vrf = await vrfAccount.loadData();

  console.log(`Compte VRF créé : ${vrfAccount.publicKey}`)

  // dériver le compte d'autorisation VRF existant en utilisant les seeds
  const [permissionAccount, permissionBump] = PermissionAccount.fromSeed(
    switchboard.program,
    queue.authority,
    switchboard.queue.publicKey,
    vrfAccount.publicKey
  )

  const [payerTokenWallet] = await switchboard.program.mint.getOrCreateWrappedUser(
    switchboard.program.walletPubkey,
    { fundUpTo: 1.0 }
  );

  // initialiser le client VRF
  try {
    const tx = await program.methods.initVrfClient()
    .accounts({
      user: payer.publicKey,
      escrowAccount: escrowState,
      vrfState: vrfClientKey,
      vrf: vrfAccount.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([payer])
    .rpc()
    
  } catch (e) {
    console.log(e)
    assert.fail()
  }

  let rolledDoubles = false
  while(!rolledDoubles){
    try {
      // Demander du hasard et lancer les dés
      const tx = await program.methods.getOutOfJail({
        switchboardStateBump: switchboard.program.programState.bump, 
        permissionBump})
      .accounts({
        vrfState: vrfClientKey,
        vrf: vrfAccount.publicKey,
        user: payer.publicKey,
        payerWallet: payerTokenWallet,
        escrowAccount: escrowState,
        oracleQueue: switchboard.queue.publicKey,
        queueAuthority: queue.authority,
        dataBuffer: queue.dataBuffer,
        permission: permissionAccount.publicKey,
        switchboardEscrow: vrf.escrow,
        programState: switchboard.program.programState.publicKey,

        switchboardProgram: switchboard.program.programId,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log(`Compte VrfClient créé : ${vrfClientKey}`)

      // attendez quelques secondes que Switchboard génère le nombre aléatoire et invoque l'instruction de rappel
      console.log("Lancer le dé...")

      let didUpdate = false;
      let vrfState = await program.account.vrfClientState.fetch(vrfClientKey)

      while(!didUpdate){
        console.log("Vérification du dé...")
        vrfState = await program.account.vrfClientState.fetch(vrfClientKey);
        didUpdate = vrfState.timestamp.toNumber() > 0;
        await delay(1000)
      }

      console.log("Résultats du lancer - Dé 1 :", vrfState.dieResult1, "Dé 2 :", vrfState.dieResult2)
      if(vrfState.dieResult1 == vrfState.dieResult2){
        rolledDoubles = true
      } else {
        console.log("Réinitialisation du dé...")
        await delay(5000)
      }

    } catch (e) {
      console.log(e)
      assert.fail()
    }
  }

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
})
```

Notez la fonction où nous obtenons notre `payerTokenWallet`. VRF nécessite en fait que le demandeur paie quelques SOL enveloppés. Cela fait partie du mécanisme d'incitation du réseau Oracle. Heureusement, avec les tests, Switchboard nous donne cette fonction vraiment pratique pour créer et financer un portefeuille de test.

```typescript
  const [payerTokenWallet] = await switchboard.program.mint.getOrCreateWrappedUser(
    switchboard.program.walletPubkey,
    { fundUpTo: 1.0 }
  );
```

Et voilà ! Vous devriez être capable d'exécuter et de réussir tous les tests en utilisant `anchor test`.

Si quelque chose ne fonctionne pas, retournez en arrière et trouvez où vous avez fait une erreur. Vous pouvez également essayer le [code de solution sur la branche `vrf`](https://github.com/Unboxed-Software/michael-burry-escrow/tree/vrf). N'oubliez pas de mettre à jour vos clés de programme et le chemin du portefeuille comme nous l'avons fait dans [l'étape de configuration](#1-program-setup).

# Défi

Maintenant, c'est le moment de travailler de manière indépendante. Ajoutons quelques [règles du Monopoly](https://en.wikipedia.org/wiki/Monopoly_(game)#Rules) à notre programme. Ajoutez une logique au programme pour suivre combien de fois un utilisateur lance les dés. S'ils lancent 3 fois sans obtenir de doubles, ils devraient pouvoir retirer leurs fonds, tout comme sortir de prison dans Monopoly.

Si vous êtes bloqué, nous avons la solution dans la branche [`vrf-challenge-solution`](https://github.com/Unboxed-Software/michael-burry-escrow/tree/vrf-challenge-solution).


## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=5af49eda-f3e7-407d-8cd7-78d0653ee17c) !
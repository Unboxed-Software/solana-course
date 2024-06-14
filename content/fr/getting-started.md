---
title: Guide du Cours
objectives:
- Comprendre ce qu'est le Web3
- Comprendre ce qu'est Solana
- Comprendre comment ce cours est structuré
- Comprendre comment tirer le meilleur parti de ce cours
---

## Bienvenue !

Bienvenue au meilleur point de départ pour les développeurs qui souhaitent apprendre le Web3 et la blockchain !

## Qu'est-ce que le Web3 ?

Généralement, dans les systèmes plus anciens, les gens interagissent les uns avec les autres par le biais de plates-formes tierces :

- Les comptes des utilisateurs sont stockés sur de grandes plates-formes telles que Google, X (anciennement connu sous le nom de Twitter) et Meta (Facebook, Instagram). Ces comptes peuvent être supprimés à volonté par les entreprises et les éléments "appartenant" à ces comptes peuvent être perdus pour toujours.

- Les comptes stockant de la valeur, tels que les cartes de paiement, les comptes bancaires et les comptes de trading, sont gérés par de grandes plates-formes telles que les entreprises de cartes de crédit, les organisations de transfert d'argent et les bourses. Dans de nombreux cas, ces entreprises retiennent une partie (environ 1% à 3%) de chaque transaction qui a lieu sur leurs plates-formes. Souvent, elles peuvent retarder le règlement de la transaction pour favoriser l'organisation. Dans certains cas, l'élément transféré peut ne pas appartenir au destinataire, mais il est conservé au nom du destinataire.

Le Web3 est une évolution d'Internet qui permet aux gens de **faire des transactions directes les uns avec les autres** :

- Les utilisateurs possèdent leurs propres comptes, représentés par leurs portefeuilles.

- Les transferts de valeur peuvent avoir lieu directement entre les utilisateurs.

- Les jetons - qui représentent des devises, des œuvres d'art numériques, des billets pour des événements, des biens immobiliers ou toute autre chose - sont entièrement sous la garde de l'utilisateur.

Les utilisations courantes du Web3 incluent :

- La vente en ligne de biens et services avec des frais quasi nuls et un règlement instantané.

- La vente d'articles numériques ou physiques, en garantissant que chaque article soit authentique et que les copies soient distinguables des articles originaux.

- Les paiements mondiaux instantanés, sans le temps et les frais des entreprises de "transfert d'argent".

## Qu'est-ce que Solana ?

Solana permet aux gens de **faire des transactions directement, instantanément et quasiment gratuitement**.

Comparée à des plateformes plus anciennes telles que Bitcoin et Ethereum, Solana est :

- Sensiblement plus rapide - la plupart des transactions sont effectuées en une ou deux secondes.

- Beaucoup moins chère - les frais de transaction (appelés "frais de gas" sur les réseaux plus anciens) sont généralement de 0,00025 $ (bien moins d'un centime), quel que soit la valeur de ce qui est transféré.

- Hautement décentralisée, avec l'un des coefficients de Nakamoto les plus élevés (score de décentralisation) de tout les réseaux de preuve d'enjeu.

Beaucoup des cas d'utilisation courants sur Solana ne sont possibles que sur Solana, en raison des coûts élevés et de la lenteur des temps de transaction des blockchains plus anciennes.

## Que vais-je apprendre dans ce cours ?

Dans ce cours, vous apprendrez à :

- Créer des applications Web permettant aux personnes de se connecter en utilisant des portefeuilles Web3.
- Transférer des jetons (comme le USDC, un jeton représentant des dollars américains) entre des personnes.
- Intégrer des outils tels que Solana Pay dans vos applications existantes.
- Créer une application de critique de films qui s'exécute en temps réel sur la blockchain Solana. Vous créerez une interface Web, le programme back-end et la base de données pour l'application.
- Créer des collections de NFT à grande échelle.

Et bien plus encore. Nous maintenons ce cours à jour afin que, au fur et à mesure que de nouvelles technologies s'ajoutent à l'écosystème Solana, vous trouviez un cours adapté ici même.

## De quoi ai-je besoin avant de commencer ?

Vous n'avez **pas** besoin d'avoir une expérience préalable en blockchain pour suivre ce cours !

- Linux, Mac ou un ordinateur Windows.
  Les ordinateurs Windows doivent avoir le [Terminal Windows](https://aka.ms/terminal) et [WSL](https://learn.microsoft.com/en-us/windows/wsl/).
- Une expérience de base en programmation JavaScript / TypeScript. Nous utiliserons également un peu de Rust, mais nous expliquerons le code Rust au fur et à mesure que nous avancerons.
- Node.js 18 installé.
- Rust installé.
- Une connaissance basique de la ligne de commande.

## Comment ce cours est structuré ?

Il existe trois parcours :
 - **Développement d'application décentralisée (dApp)** - création d'applications Web et mobiles qui interagissent avec des programmes Solana onchain populaires. Cela inclut des aspects tels que les transferts et la création de jetons, ainsi que la création de clients pour des programmes quelconques. Si vous souhaitez ajouter des paiements blockchain, des NFTs, la traçabilité blockchain, etc. à vos applications, c'est le meilleur parcours pour commencer.
 - **Développement de programmes onchain** - création d'applications personnalisées qui s'exécutent sur la blockchain. Si vous souhaitez créer une nouvelle application financière ou comptable, utiliser des données provenant de l'extérieur de Solana onchain, ou utiliser la blockchain pour stocker des données quelconques, ce parcours est fait pour vous.
 - **Infrastructure réseau** - couvre l'exécution de Solana lui-même, en tant que RPC ou validateur.

Les modules abordent un sujet spécifique. Ceux-ci sont décomposés en leçons individuelles.

Chaque leçon commence par énumérer les objectives de la leçon, c'est-à-dire ce que vous apprendrez dans la leçon.

Ensuite, il y a un bref 'Résumé' pour que vous puissiez parcourir, avoir une idée de ce que la leçon couvre et décider si la leçon vous convient ou non.

Ensuite, chaque leçon comporte trois sections :

- **Aperçu** - l'aperçu contient du texte explicatif, des exemples et des extraits de code. Vous _n'êtes pas_ censé coder avec les exemples montrés ici. L'objectif est simplement de lire et d'obtenir une initiation aux sujets de la leçon.

- **Laboratoire** - un projet pratique que vous _devriez absolument_ coder en même temps. Il s'agit de votre deuxième exposition au contenu ainsi que de votre première opportunité de plonger et de _faire la chose_.

- **Défi** - un autre projet, avec quelques consignes simples que vous devriez prendre et mettre en œuvre de manière indépendante.

## Comment utiliser efficacement ce cours ?

Les leçons ici sont très efficaces, mais tout le monde a des antécédents et des aptitudes différentes qui ne peuvent pas être prises en compte par un contenu statique. Avec cela à l'esprit, voici trois recommandations sur la manière de tirer le meilleur parti du cours :

1. **Soyez honnête avec vous-même** - cela peut sembler un peu vague, mais être honnête avec soi-même sur la compréhension d'un sujet donné est essentiel pour le maîtriser. Il est très facile de lire quelque chose et de penser "oui, oui, j'ai compris", pour réaliser ensuite que ce n'était pas le cas. Soyez honnête avec vous-même en parcourant chaque leçon. N'hésitez pas à revoir des sections si nécessaire, ou à faire des recherches externes si la formulation de la leçon ne fonctionne pas très bien pour vous.

2. **Faites tous les laboratoires et défis** - cela confirme le premier point. Il est assez difficile de se mentir sur ce que l'on sait d'un sujet lorsque l'on se force à essayer de le faire. Faites chaque laboratoire et chaque défi pour tester votre niveau de connaissance, et répétez-les au besoin. Nous fournissons le code de solution pour tout, mais assurez-vous de l'utiliser comme une ressource utile plutôt qu'une béquille.

3. **Dépassez les attentes** - cela peut sembler cliché, mais ne vous limitez pas à ce que le laboratoire et les défis vous demandent de faire. Soyez créatif ! Prenez les projets et faites-les vôtres. Construisez au-delà d'eux. Plus vous pratiquez, plus vous vous améliorez.

Eh bien, c'est tout pour le discours de motivation. Mettons-nous au travail !
---
title: Comment aborder le module de sécurité du programme
objectives:
- comprendre comment aborder le module de sécurité du programme
---

L'objectif de cette unité est de vous exposer à une grande variété d'exploitations de failles de sécurité courantes spécifiques au développement sur Solana. Nous avons largement modélisé cette unité sur un dépôt GitHub public appelé Sealevel Attacks créé par le génial Armani Ferrante.

Vous pourriez penser : "n'avons-nous pas eu une leçon de sécurité dans le module 3 ?" Oui, tout à fait. Nous voulions nous assurer que toute personne déployant des programmes sur Mainnet dès le départ avait au moins une compréhension de base de la sécurité. Et si c'est votre cas, alors espérons que les principes fondamentaux appris dans cette leçon vous ont permis d'éviter certaines failles courantes de Solana par vous-même.

Cette unité vise à surpasser cette leçon avec deux objectifs en tête :

1. Élargir votre compréhension du modèle de programmation Solana et des domaines sur lesquels vous devez vous concentrer pour combler les failles de sécurité dans vos programmes.
2. Vous montrer la gamme d'outils fournis par Anchor pour vous aider à maintenir la sécurité de vos programmes.

Si vous avez suivi la leçon sur la sécurité de base, les premières leçons devraient vous sembler familières. Elles couvrent largement des sujets que nous avons discutés dans cette leçon. Ensuite, certaines des attaques peuvent sembler nouvelles. Nous vous encourageons à toutes les parcourir.

La dernière chose à souligner est qu'il y a beaucoup plus de leçons dans cette unité que dans les modules précédents. Et les leçons ne dépendent pas les unes des autres de la même manière, vous pouvez donc jongler entre elles un peu plus si vous le souhaitez.

À l'origine, nous avions prévu d'avoir plus de leçons plus courtes dans cette unité. Et bien qu'elles soient peut-être plus courtes que la moyenne, elles ne le sont pas beaucoup. Il s'avère que même si chaque vulnérabilité de sécurité est "simple", il y a beaucoup à discuter. Ainsi, chaque leçon peut avoir un peu moins de prose et plus d'extraits de code, permettant aux lecteurs de choisir à quel point aller en profondeur. Mais, en fin de compte, chaque leçon est toujours aussi complète qu'auparavant pour que vous puissiez vraiment saisir solidement chacun des risques de sécurité discutés.

Comme toujours, nous apprécions les commentaires. Bonne chance dans vos explorations !
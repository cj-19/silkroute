# -*- coding: utf-8 -*-
"""
Insere les 4 guides piliers dans la base (collection content_entries).

Utilisation (PowerShell, depuis le dossier backend) :

    $env:MONGO_URL = "<ta chaine MongoDB Atlas>"
    $env:DB_NAME = "silkroute"
    python seed_guides.py

Le script est idempotent : relance-le apres avoir modifie le contenu ci-dessous,
il met a jour les guides existants (repere par leur slug) au lieu de les dupliquer.
Par defaut les guides sont crees en BROUILLON (published = False) : relis-les dans
l'espace admin (Contenu & SEO), complete les passages marques [A COMPLETER],
puis publie-les et clique sur « Regenerer les pages ».

Options :
    python seed_guides.py --publish     cree directement les guides publies
    python seed_guides.py --list        affiche les guides deja en base
"""
import os
import sys
import uuid
from datetime import datetime, timezone

from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

if not MONGO_URL or not DB_NAME:
    print("Erreur : definis MONGO_URL et DB_NAME avant de lancer ce script.")
    sys.exit(1)

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

CLUSTER_TRANSPORT = "Transport, fret et douane"
CLUSTER_VOYAGE = "Voyager en Chine pour acheter"
CLUSTER_DECIDER = "Se former et decider"


GUIDES = [
    # ------------------------------------------------------------------
    {
        "slug": "fret-aerien-chine-cameroun",
        "cluster": CLUSTER_TRANSPORT,
        "title": "Fret aérien Chine-Cameroun : tarifs au kilo, délais et quand le choisir",
        "meta_description": (
            "Tarifs réels du fret aérien Chine-Cameroun : 8 997 à 10 997 FCFA/kg selon le service, "
            "délais de 2 à 21 jours. Comment choisir, et à partir de quel poids l'aérien coûte trop cher."
        ),
        "body": """L'aérien est le mode de transport le plus utilisé par les petits importateurs africains, et c'est souvent le bon choix — jusqu'à un certain poids. Au-delà, il devient le moyen le plus sûr de perdre sa marge. Voici les tarifs réels que nous pratiquons avec notre transitaire partenaire, et la méthode pour trancher.

## Les tarifs réels, au kilo

Ces prix sont ceux de notre transitaire partenaire pour un départ de Guangzhou vers le Cameroun. Ils sont facturés **au kilo**, ce qui rend le calcul simple mais impitoyable pour les produits volumineux.

| Service | Prix au kilo | Délai | Pour quoi |
| --- | --- | --- | --- |
| Aérien normal | 8 997 FCFA | 7 à 15 jours | Le choix par défaut |
| Aérien sensible | 9 997 FCFA | 15 à 21 jours | Batteries, liquides, cosmétiques |
| Aérien express | 10 997 FCFA | 2 à 3 jours | Urgences, échantillons |

Deux remarques qui surprennent souvent :

- L'**aérien sensible est plus lent que l'aérien normal**, alors qu'il coûte plus cher. Ce n'est pas une erreur : les marchandises classées dangereuses (batteries au lithium, aérosols, produits liquides) passent par des filières spécifiques avec des contrôles supplémentaires. Si votre produit contient une batterie, vous êtes concerné.
- L'**express n'a de sens que pour des échantillons** ou une commande de réassort urgente. À 10 997 FCFA le kilo, 20 kilos coûtent 219 940 FCFA de transport.

## Le piège du poids volumétrique

Une compagnie aérienne ne facture pas le poids réel de votre colis, mais le **poids taxable** : le plus élevé entre le poids réel et le poids volumétrique. Le poids volumétrique se calcule ainsi :

> Longueur × largeur × hauteur en centimètres, divisé par 6 000. Le résultat est en kilos.

Un carton de 60 × 40 × 40 cm pèse volumétriquement 16 kg (96 000 ÷ 6 000). S'il ne contient que 8 kg de marchandise — par exemple des vêtements ou des articles en plastique — vous payez quand même 16 kg, soit 143 952 FCFA au tarif normal au lieu des 71 976 FCFA que vous aviez budgétés.

C'est la première cause de mauvaise surprise chez les nouveaux importateurs. Avant de commander, demandez toujours au fournisseur les **dimensions du carton**, pas seulement le poids.

## À partir de quel poids l'aérien devient déraisonnable

Le calcul dépend de la valeur de votre marchandise. La règle utile : comparez le coût du transport au prix d'achat de la marchandise.

- **Transport inférieur à 20 % du prix d'achat** : l'aérien est confortable.
- **Entre 20 et 40 %** : acceptable si vous avez besoin de la marchandise rapidement ou si votre marge est forte.
- **Au-delà de 40 %** : passez au maritime, ou renoncez au produit.

Un exemple concret. Un article acheté 85 FCFA l'unité en Chine (1 yuan), pesant 500 grammes, revient à 4 499 FCFA de transport aérien par unité. Le transport coûte 53 fois le prix du produit : c'est absurde. Ce produit doit voyager par bateau, ou pas du tout.

À l'inverse, un téléphone acheté 42 500 FCFA (500 yuans) pesant 400 grammes coûte 3 599 FCFA de transport, soit 8 % du prix d'achat. L'aérien est ici parfaitement adapté.

## Ce que l'aérien coûte en plus des kilos

Le prix au kilo n'est pas le coût total. Prévoyez également :

- **Le dédouanement** : droits de douane et taxes, calculés sur la valeur déclarée de la marchandise.
- **Les frais d'agent en douane** si vous passez par un intermédiaire.
- **Les frais fixes du transitaire** : minimum de facturation, manutention, magasinage si vous ne récupérez pas rapidement.

Ce dernier point est souvent sous-estimé. Sur une petite commande, les frais incompressibles d'un import individuel dépassent facilement **15 000 FCFA** avant même de parler du prix du produit. C'est précisément ce qui rend une commande de 5 ou 10 unités non rentable en solo.

## Comment le groupage change le calcul

En regroupant plusieurs acheteurs sur une même expédition, deux choses se produisent.

D'abord, les **frais fixes sont partagés** au lieu d'être supportés par une seule personne. Ensuite, et c'est le levier le plus puissant, la quantité totale commandée atteint le **palier de prix de gros du fournisseur** — souvent 20 à 40 % sous le prix affiché pour une pièce.

Sur SilkRoute, chaque groupage affiche le mode de transport retenu, le tarif au kilo appliqué et un comparateur qui met côte à côte le prix en groupage et le prix que vous paieriez en commandant seul, pour la quantité exacte que vous voulez.

[A COMPLETER APRES LA PREMIERE LIVRAISON : ajouter ici le coût complet réel d'un groupage livré — prix usine, transport, dédouanement, prix rendu à Douala — avec la date. C'est ce chiffre qui rendra cette page impossible à concurrencer.]

## En résumé

- Comptez **8 997 FCFA/kg** en aérien normal, 7 à 15 jours de transit.
- Vérifiez le **poids volumétrique** avant de commander : dimensions du carton obligatoires.
- Si le transport dépasse **40 % du prix d'achat**, passez au maritime.
- Les **frais fixes** rendent les petites commandes individuelles non rentables : c'est là que le groupage fait la différence.

Consultez notre guide sur le [fret maritime Chine-Douala](/guides/fret-maritime-chine-douala) pour comparer, ou parcourez les [groupages ouverts](/groupages) pour voir des cas chiffrés.""",
    },
    # ------------------------------------------------------------------
    {
        "slug": "fret-maritime-chine-douala",
        "cluster": CLUSTER_TRANSPORT,
        "title": "Fret maritime Chine-Douala : CBM, conteneur complet ou groupage",
        "meta_description": (
            "Fret maritime Chine-Douala : 349 500 FCFA le mètre cube, 45 à 60 jours. "
            "Calculer son CBM, choisir entre groupage et conteneur complet, et éviter les frais cachés à l'arrivée."
        ),
        "body": """Le maritime est le mode de transport des marchandises volumineuses, et le seul qui rende viable l'import de meubles, d'électroménager ou de textile en quantité. Il est facturé au volume, pas au poids — ce qui change complètement la façon de calculer.

## Le tarif réel, au mètre cube

Notre transitaire partenaire facture le fret maritime **349 500 FCFA le mètre cube (CBM)**, pour un délai de **45 à 60 jours** de port à port, dédouanement non compris.

Ce chiffre paraît élevé isolément. Il faut le rapporter à ce qu'un mètre cube contient réellement : environ 25 cartons standards de 60 × 40 × 40 cm. Le transport revient alors à **13 980 FCFA par carton**, quel que soit son poids. Un carton de 20 kilos coûte le même prix qu'un carton de 5 kilos.

C'est exactement l'inverse de l'aérien, et c'est pourquoi le maritime devient imbattable dès que la marchandise est dense.

## Calculer son CBM

Le calcul est simple :

> Longueur × largeur × hauteur, en mètres. Le résultat est directement en mètres cubes.

Un carton de 60 × 40 × 40 cm donne 0,6 × 0,4 × 0,4 = **0,096 CBM**. Multipliez par le nombre de cartons pour obtenir le volume total, puis par le tarif.

Pour 30 cartons identiques : 30 × 0,096 = 2,88 CBM, soit 1 006 560 FCFA de transport.

Attention à deux points :

- Les transitaires appliquent presque toujours un **minimum de facturation**, souvent 1 CBM. Expédier 0,3 CBM vous sera facturé comme 1 CBM entier. En dessous d'un mètre cube, le maritime perd tout intérêt en solo.
- Le volume retenu est celui des **cartons**, pas celui des produits. Un fournisseur qui emballe mal vous fait payer de l'air.

## Aérien ou maritime : le point de bascule

Comparez sur la même marchandise. Prenons 30 cartons de 60 × 40 × 40 cm contenant chacun 10 kg, soit 300 kg réels et 2,88 CBM.

| | Aérien normal | Maritime |
| --- | --- | --- |
| Base de facturation | 480 kg taxables | 2,88 CBM |
| Coût du transport | 4 318 560 FCFA | 1 006 560 FCFA |
| Délai | 7 à 15 jours | 45 à 60 jours |

Le maritime coûte ici **4,3 fois moins cher**. Notez que l'aérien facture 480 kg et non 300 : le poids volumétrique (16 kg par carton) dépasse le poids réel.

La règle pratique : **au-delà de 100 kg taxables, calculez systématiquement les deux options**. En dessous, l'aérien gagne presque toujours à cause du minimum de facturation maritime.

## Conteneur complet ou groupage maritime

Deux façons d'expédier par bateau :

**Le groupage maritime (LCL)** : votre marchandise partage un conteneur avec celle d'autres importateurs. Vous payez au CBM. C'est le choix pour tout volume inférieur à 15 CBM environ. Inconvénient : les opérations de dégroupage à l'arrivée ajoutent des délais et des frais.

**Le conteneur complet (FCL)** : vous réservez un conteneur entier. Un 20 pieds contient environ 28 CBM utiles, un 40 pieds environ 58 CBM. À partir de 15 CBM, le prix au mètre cube devient plus avantageux qu'en LCL, et vous évitez les frais de dégroupage.

Pour un importateur qui démarre, le groupage maritime est le point d'entrée réaliste. Un conteneur complet représente un engagement financier et un volume de stock que peu peuvent absorber seuls — c'est précisément le genre de commande qu'un achat groupé permet d'atteindre à plusieurs.

## Les frais que personne n'annonce à l'avance

Le tarif au CBM ne couvre que le transport maritime. À l'arrivée à Douala s'ajoutent :

- Les **frais portuaires et de manutention**.
- Le **dégroupage** si vous êtes en LCL.
- Les **droits de douane et taxes**, calculés sur la valeur déclarée.
- Les **frais de magasinage** si la marchandise reste au port. Ceux-là courent vite : c'est la principale source de mauvaise surprise, et la raison pour laquelle il faut anticiper le dédouanement avant l'arrivée du navire.

Un schéma récurrent dans les témoignages d'importateurs : le transitaire réclame une somme supplémentaire au moment où la marchandise arrive, quand l'importateur n'a plus le choix. Exigez toujours un **devis écrit couvrant le rendu final**, pas seulement le fret.

## Ce que le groupage apporte sur le maritime

Le maritime récompense le volume, et le volume est exactement ce qu'un acheteur seul n'a pas. En mutualisant, on atteint le minimum de facturation sans le subir, on répartit les frais portuaires et de dégroupage, et on obtient le prix de gros du fournisseur.

Sur SilkRoute, les groupages maritimes affichent le volume unitaire du produit, le volume total de la commande et le tarif au CBM appliqué. Vous choisissez votre ville de retrait avant de vous engager — la commande est ensuite répartie par ville avec le transitaire.

[A COMPLETER APRES LA PREMIERE LIVRAISON MARITIME : détailler ici un cas réel — volume total, frais portuaires constatés, droits de douane payés, coût rendu par unité — avec la date.]

## En résumé

- **349 500 FCFA le CBM**, 45 à 60 jours, minimum de facturation d'environ 1 CBM.
- Calculez votre CBM en mètres : longueur × largeur × hauteur.
- Au-delà de **100 kg taxables**, comparez toujours avec l'aérien.
- Réclamez un devis **rendu final**, frais portuaires et dédouanement inclus.

Comparez avec notre guide sur le [fret aérien Chine-Cameroun](/guides/fret-aerien-chine-cameroun), ou voyez les [groupages ouverts](/groupages).""",
    },
    # ------------------------------------------------------------------
    {
        "slug": "voyager-en-chine-ou-acheter-a-distance",
        "cluster": CLUSTER_VOYAGE,
        "title": "Aller en Chine ou acheter à distance : le comparatif chiffré",
        "meta_description": (
            "Budget réel d'un voyage d'achat en Chine depuis le Cameroun : environ 1,5 million FCFA. "
            "À partir de quel volume de commande le déplacement est rentable, et quand acheter à distance."
        ),
        "body": """Beaucoup de commerçants économisent pendant des mois pour aller acheter en Chine. C'est parfois le bon calcul. Souvent, non. La différence tient à un seul chiffre : le volume de votre commande. Voici comment trancher, sans romantisme.

## Ce qu'un voyage d'achat coûte réellement

Un séjour de dix jours à Guangzhou depuis Douala, en restant raisonnable sur le confort :

| Poste | Fourchette |
| --- | --- |
| Billet aller-retour | 600 000 à 900 000 FCFA |
| Visa d'affaires et frais de dossier | 60 000 à 120 000 FCFA |
| Hébergement, 10 nuits | 200 000 à 400 000 FCFA |
| Repas et transports sur place | 100 000 à 180 000 FCFA |
| Interprète ou agent, 5 jours | 150 000 à 300 000 FCFA |
| Imprévus, échantillons, bagages | 100 000 à 200 000 FCFA |
| **Total** | **1 210 000 à 2 100 000 FCFA** |

Retenons **1,5 million FCFA** comme ordre de grandeur pour un premier voyage. À cela s'ajoute ce que personne ne comptabilise : dix jours d'absence de votre commerce, et le fait que la marchandise achetée doit **de toute façon** être transportée et dédouanée, aux mêmes tarifs que si vous l'aviez commandée à distance.

Le voyage ne remplace pas le fret. Il s'y ajoute.

## Le point de bascule

Un voyage se justifie s'il vous fait économiser plus qu'il ne coûte. L'économie vient principalement d'un meilleur prix d'achat, obtenu en négociant sur place et en évitant les intermédiaires — comptez 10 à 20 % sur le prix de la marchandise, ce qui est déjà optimiste pour un premier voyage sans réseau.

Si vous économisez 15 % sur vos achats, il faut commander pour **10 millions de FCFA** de marchandise pour amortir 1,5 million de frais de voyage. À 20 % d'économie, le seuil descend à 7,5 millions.

En dessous de **7 à 10 millions de FCFA de commande**, un voyage d'achat vous coûte plus qu'il ne vous rapporte. C'est un chiffre inconfortable, mais c'est l'arithmétique.

## Ce que le voyage apporte vraiment, et qui ne se chiffre pas

Il serait malhonnête de réduire un voyage à son coût. Se déplacer procure des avantages réels :

- **Voir et toucher la marchandise** avant d'acheter, ce qui élimine le risque de non-conformité.
- **Découvrir des produits** qu'on n'aurait pas cherchés en ligne. C'est souvent le vrai bénéfice d'un salon comme la foire de Canton.
- **Construire une relation** avec un fournisseur, ce qui compte beaucoup dans la culture commerciale chinoise et facilite les commandes suivantes.
- **Comprendre le marché** : les prix réels, les usines, les circuits.

Ces bénéfices sont durables. Ils justifient un voyage **quand on a déjà un volume d'activité**, comme investissement dans la relation fournisseur, pas comme moyen d'économiser sur une première commande.

## Quand acheter à distance est le bon choix

Acheter à distance s'impose dans trois situations :

1. **Votre commande est inférieure à 5 millions de FCFA.** Les frais de voyage écrasent toute économie possible.
2. **Vous testez un produit.** Aucun sens à traverser le monde pour valider une hypothèse commerciale. Commandez petit, mesurez la demande, voyagez ensuite si le produit marche.
3. **Vous ne pouvez pas immobiliser votre trésorerie.** Le voyage exige de payer les frais avant d'avoir vendu quoi que ce soit.

Le vrai obstacle de l'achat à distance n'a jamais été le prix : c'est **le risque**. Envoyer de l'argent à un inconnu à 12 000 kilomètres, sans garantie sur la qualité ni sur l'expédition. C'est ce risque qu'il faut neutraliser, pas contourner par un billet d'avion.

## La troisième voie : acheter à distance, mais en groupe

Un acheteur seul à distance cumule deux handicaps : il paie le prix « petite quantité » du fournisseur, et il supporte seul les frais fixes de transport et de dédouanement.

L'achat groupé supprime les deux. Plusieurs acheteurs se réunissent sur une même commande : le volume atteint le **palier de gros du fournisseur**, et les frais logistiques sont répartis. Chacun réserve la quantité qu'il veut et récupère sa part dans sa ville.

Sur SilkRoute, la vérification du fournisseur — licence commerciale contrôlée et conservée, statut sur les plateformes B2B — est faite avant l'ouverture du groupage. Un transitaire licencié prend en charge la marchandise, et vous suivez l'expédition en six étapes. Le paiement se fait en Mobile Money, sans virement international.

Concrètement : vous obtenez le prix qu'un voyage vous aurait permis de négocier, sans les 1,5 million de frais, et sans le risque d'un fournisseur non vérifié.

## Comment décider, en trois questions

1. **Ma commande dépasse-t-elle 7 millions de FCFA ?** Si oui, le voyage se discute sérieusement.
2. **Ai-je déjà validé que mon produit se vend ?** Si non, testez d'abord en petite quantité.
3. **Mon besoin est-il de négocier ou de sécuriser ?** Si c'est de sécuriser, un intermédiaire vérifié coûte infiniment moins cher qu'un billet.

Si vous décidez malgré tout de partir, sachez que la foire de Canton se tient deux fois par an à Guangzhou, en trois phases de cinq jours chacune, organisées par secteur : électronique et machines en phase 1, maison et mobilier en phase 2, textile, chaussures et bagages en phase 3. Choisir la mauvaise phase revient à faire le voyage pour rien — vérifiez le calendrier officiel avant de réserver.

## En résumé

- Un premier voyage d'achat coûte environ **1,5 million FCFA**, frais de fret non compris.
- Il devient rentable au-delà de **7 à 10 millions FCFA** de commande.
- En dessous, l'achat à distance est plus rationnel — à condition de neutraliser le risque fournisseur.
- L'achat groupé permet d'obtenir le prix de gros sans voyager : c'est la voie médiane.

Parcourez les [groupages ouverts](/groupages) pour comparer sur un cas réel, ou consultez la [FAQ](/faq).""",
    },
    # ------------------------------------------------------------------
    {
        "slug": "achat-groupe-ou-importation-individuelle",
        "cluster": CLUSTER_DECIDER,
        "title": "Achat groupé ou importation individuelle : le comparatif complet",
        "meta_description": (
            "Comparatif chiffré entre importer seul depuis la Chine et rejoindre un achat groupé : "
            "prix de gros, frais partagés, risque fournisseur, délais. Ce que chaque option coûte vraiment."
        ),
        "body": """Importer seul ou se regrouper n'est pas une question de préférence, mais de seuils. À partir d'un certain volume, l'individuel reprend l'avantage. En dessous, il coûte structurellement plus cher. Voici où se situent les limites.

## Les quatre écarts de coût

### 1. Le prix d'achat chez le fournisseur

C'est l'écart le plus important, et le plus mal compris. Les fournisseurs chinois pratiquent des **paliers de quantité**. Le même article peut être affiché à 120 yuans pour une pièce et 85 yuans à partir de 500 pièces, soit **29 % d'écart**.

Un acheteur seul commandant 20 pièces reste sur le palier haut. Un groupe de trente acheteurs atteignant 600 pièces obtient le palier bas — et chaque membre paie ce prix-là, même s'il n'achète que 20 unités.

Aucun autre levier ne produit un écart comparable. C'est le cœur du mécanisme.

### 2. Les frais fixes

Certains coûts ne dépendent pas de la quantité : minimum de facturation du transitaire, frais de dossier de dédouanement, honoraires d'agent en douane, manutention. Sur un import individuel, ils dépassent facilement **15 000 FCFA**, supportés par une seule personne.

Répartis sur trente acheteurs, ils deviennent négligeables par tête. Sur une petite commande, ces frais fixes suffisent à eux seuls à annuler la marge.

### 3. Le minimum de commande du fournisseur

Beaucoup de fournisseurs imposent un **MOQ** — quantité minimale de commande — de 100, 500 ou 1 000 pièces. Un acheteur seul se voit simplement refuser la commande, ou doit accepter une quantité qu'il ne pourra pas écouler. Le groupage fait disparaître l'obstacle.

### 4. Le coût du risque

Le moins visible, et le plus douloureux. Payer un fournisseur non vérifié, c'est accepter une probabilité de tout perdre. Les schémas sont documentés : faux fournisseurs, marchandise sans rapport avec les photos, transitaire qui réclame des frais supplémentaires à l'arrivée quand vous n'avez plus le choix.

Sur une commande de 300 000 FCFA, une chance sur dix de tout perdre représente un coût espéré de 30 000 FCFA. C'est un vrai coût, même s'il n'apparaît sur aucune facture.

## Ce que l'importation individuelle garde comme avantages

Il faut être juste : l'individuel conserve des atouts que le groupage ne peut pas offrir.

- **Vous choisissez exactement votre produit**, sans dépendre de ce qu'un groupe décide d'acheter.
- **Vous fixez votre calendrier**, sans attendre qu'un groupage atteigne sa quantité cible.
- **Vous maîtrisez la relation fournisseur**, ce qui compte si vous visez l'exclusivité sur un produit.
- **Aucun intermédiaire** ne prélève de frais de service.

Ces avantages deviennent décisifs quand votre volume est suffisant pour atteindre seul les paliers de gros — typiquement au-delà de **5 à 7 millions de FCFA** par commande.

## Le comparatif, poste par poste

| | Importation individuelle | Achat groupé |
| --- | --- | --- |
| Prix chez le fournisseur | Palier petite quantité | Palier de gros |
| Frais fixes logistiques | Supportés seul | Répartis entre membres |
| MOQ du fournisseur | Bloquant | Atteint collectivement |
| Vérification du fournisseur | À votre charge | Faite en amont |
| Choix du produit | Total | Limité à l'offre ouverte |
| Calendrier | Libre | Dépend de la date limite du groupage |
| Paiement du fournisseur | Virement international à organiser | Mobile Money local |
| Trésorerie immobilisée | Commande entière | Votre part seulement |
| Frais de service | Aucun | Inclus dans le prix affiché |

## Comment choisir, concrètement

**Le groupage est adapté si** votre commande se situe en dessous de 5 millions de FCFA, si vous testez un produit, si vous n'avez pas de fournisseur de confiance établi, ou si vous ne pouvez pas immobiliser la trésorerie d'une commande complète.

**L'individuel devient préférable si** vous atteignez seul les paliers de gros, si vous avez déjà un fournisseur éprouvé, si vous voulez l'exclusivité sur un produit, ou si votre calendrier ne tolère aucune attente.

Beaucoup d'importateurs commencent en groupage pour apprendre le circuit et valider leurs produits sans risquer leur capital, puis passent à l'individuel sur les produits qui marchent. C'est une progression saine — et le groupage sert alors de formation payée par l'expérience plutôt que par les erreurs.

## Ce qu'il faut vérifier avant de rejoindre un groupage

Tous les groupages ne se valent pas. Avant de vous engager, exigez de voir :

- **Le prix comparé** : ce que vous paieriez seul pour la même quantité, face au prix groupé. Sans comparaison, aucune économie n'est démontrée.
- **La vérification du fournisseur** : licence commerciale contrôlée, statut sur les plateformes B2B.
- **Le transitaire** : nom, licence, tarifs, villes de desserte.
- **La ville de retrait**, et si ce choix est définitif.
- **Le suivi** : comment vous serez informé de l'avancement.

Sur SilkRoute, ces éléments figurent sur chaque page de groupage avant tout engagement, avec un comparateur qui calcule le prix pour la quantité exacte que vous voulez. Le suivi se fait en six étapes mises à jour par le transitaire, et les membres notent le fournisseur après livraison.

[A COMPLETER APRES LES PREMIERES LIVRAISONS : insérer ici deux cas réels chiffrés — un produit acheté en groupage vs le prix constaté pour la même quantité en solo, avec les dates.]

## En résumé

- L'écart décisif est le **prix de gros du fournisseur**, souvent 20 à 40 %.
- Les **frais fixes** condamnent les petites commandes individuelles.
- Le groupage est plus rationnel **en dessous de 5 millions FCFA** par commande.
- Au-delà de **7 millions**, l'individuel reprend l'avantage.
- Dans tous les cas, exigez un **comparatif chiffré** avant de vous engager.

Voyez les [groupages ouverts](/groupages), ou comparez avec nos guides sur le [fret aérien](/guides/fret-aerien-chine-cameroun) et le [fret maritime](/guides/fret-maritime-chine-douala).""",
    },
]


def upsert_guides(publish=False):
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    updated = 0

    for g in GUIDES:
        existing = db.content_entries.find_one({"slug": g["slug"]})
        payload = {
            "type": "guide",
            "slug": g["slug"],
            "title": g["title"],
            "meta_description": g["meta_description"],
            "question": None,
            "answer": None,
            "body": g["body"],
            "cluster": g["cluster"],
            "order": GUIDES.index(g),
            "updated_at": now,
        }

        if existing:
            # On ne force pas l'etat de publication d'un guide deja en base :
            # si tu l'as publie depuis l'admin, il le reste.
            db.content_entries.update_one({"slug": g["slug"]}, {"$set": payload})
            updated += 1
            state = "publie" if existing.get("published") else "brouillon"
            print("  ~ mis a jour : %s (%s)" % (g["slug"], state))
        else:
            payload["content_id"] = "cnt_%s" % uuid.uuid4().hex[:12]
            payload["published"] = publish
            payload["created_at"] = now
            payload["created_by"] = "seed_guides"
            db.content_entries.insert_one(payload)
            created += 1
            print("  + cree : %s (%s)" % (g["slug"], "publie" if publish else "brouillon"))

    words = sum(len(g["body"].split()) for g in GUIDES)
    print("\n%d cree(s), %d mis a jour. Total : %d mots de contenu." % (created, updated, words))
    if not publish and created:
        print("\nLes nouveaux guides sont en BROUILLON. Pour les mettre en ligne :")
        print("  1. Espace admin > Contenu & SEO > onglet Guides")
        print("  2. Relis chaque guide, complete les passages [A COMPLETER]")
        print("  3. Publie-les, puis clique sur « Regenerer les pages »")


def list_guides():
    entries = list(db.content_entries.find({"type": "guide"}, {"_id": 0}))
    if not entries:
        print("Aucun guide en base.")
        return
    print("%-42s %-12s %s" % ("SLUG", "ETAT", "TITRE"))
    print("-" * 100)
    for e in sorted(entries, key=lambda x: x.get("order", 0)):
        print("%-42s %-12s %s" % (
            e.get("slug", ""),
            "publie" if e.get("published") else "brouillon",
            (e.get("title") or "")[:44],
        ))


if __name__ == "__main__":
    if "--list" in sys.argv:
        list_guides()
    else:
        publish = "--publish" in sys.argv
        print("Insertion des %d guides piliers dans %s..." % (len(GUIDES), DB_NAME))
        upsert_guides(publish=publish)

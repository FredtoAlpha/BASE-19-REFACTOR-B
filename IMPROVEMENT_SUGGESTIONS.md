# Suggestions d'Améliorations - Projet Répartition

**Date :** 26 Novembre 2025
**Auteur :** Jules (Agent IA)

Ce document rassemble des suggestions concrètes pour améliorer l'expérience utilisateur, la puissance du moteur de répartition et la gestion de l'architecture "Dual Pipeline", sans nécessiter de refonte complète.

---

## 🎨 1. UI / UX (Interface Utilisateur)

L'interface actuelle (`InterfaceV2.html`) est solide. Voici comment la rendre "intelligente" :

*   **Feedback Visuel "Avant-Drop" :**
    *   *Idée :* Lors du survol d'une colonne avec une carte élève, afficher des indicateurs (+1/-1) sur les compteurs de la colonne (Filles, Garçons, Moyennes) *avant* que l'utilisateur ne lâche la souris.
    *   *Bénéfice :* Aide à la décision en temps réel sans avoir à calculer mentalement.

*   **Timeline Visuelle ("Time Machine") :**
    *   *Idée :* Remplacer la liste textuelle de l'historique par une frise chronologique avec des "snapshots" visuels. Cliquer sur un point permet de revenir à cet état exact.
    *   *Bénéfice :* Navigation plus intuitive dans les essais/erreurs.

*   **Visualisation des Liens (ASSO/DISSO) :**
    *   *Idée :* Un bouton "Afficher Liens" qui dessine des lignes courbes (SVG overlay) reliant les élèves ayant le même code ASSO (vert) ou DISSO (rouge s'ils sont trop proches).
    *   *Bénéfice :* Compréhension immédiate des contraintes invisibles.

---

## ⚙️ 2. Moteur de Répartition (`Phase4_Ultimate`)

Le moteur est performant. Voici des pistes pour le rendre plus "stratège" :

*   **Recuit Simulé Adaptatif (Adaptive Cooling) :**
    *   *Idée :* Rendre le paramètre `coolingRate` dynamique. Si le score stagne trop longtemps, augmenter temporairement la "température" (probabilité d'accepter un mauvais swap) pour sortir d'un optimum local.
    *   *Bénéfice :* Meilleure capacité à résoudre des cas complexes "bloqués".

*   **Contraintes Souples ("Soft Constraints") :**
    *   *Idée :* Au lieu de rejeter strictement un swap invalide (ex: quota dépassé de 1), l'accepter avec une **pénalité massive** dans le score.
    *   *Bénéfice :* Permet au moteur de traverser une zone "interdite" pour trouver une meilleure solution valide plus loin (effet tunnel).

*   **Verrouillage de Classe (Class Locking) :**
    *   *Idée :* Ajouter une option pour "Geler" une classe entière dans l'optimiseur.
    *   *Bénéfice :* Préserve une classe "parfaite" (ex: 6°1) pendant que le moteur travaille sur les autres.

---

## 🛠️ 3. Architecture "Dual Pipeline" (V3 + Legacy)

Pour sécuriser la coexistence des deux systèmes :

*   **Outil de "Sync Check" :**
    *   *Idée :* Un script de diagnostic qui compare les élèves présents dans les onglets Sources (Legacy) et dans `_BASEOPTI` (V3).
    *   *Bénéfice :* Alerte immédiate si le pipeline de secours travaille sur des données périmées ou incomplètes.

*   **Switch d'Urgence Unifié :**
    *   *Idée :* Un sélecteur clair dans la Console Admin : "Mode Actif : V3 (Optimisé)" vs "Mode Secours : Legacy (Direct)". Ce switch doit contrôler globalement quel moteur est appelé par les boutons de l'interface.

*   **Benchmarking Comparatif :**
    *   *Idée :* Option pour lancer les deux moteurs en parallèle (sur copie des données) et comparer leurs résultats (Score final, Temps d'exécution) dans un rapport PDF/Log.

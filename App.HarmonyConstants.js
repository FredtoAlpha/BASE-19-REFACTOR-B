/**
 * ===================================================================
 * HARMONY CONSTANTS - Source unique des valeurs partagées
 * ===================================================================
 *
 * Centralise les listes LV2/OPT et critères académiques
 * utilisés par les deux pipelines (NAUTILUS + LEGACY).
 *
 * RÈGLE : Toute modification de langue ou option se fait ICI.
 *
 * Branche : claude/harmony-algo-j0ITC
 * Date : 2026-02-09
 * ===================================================================
 */

// Liste des LV2 connues (langues vivantes 2)
const HARMONY_LV2_LIST = ['ITA', 'ESP', 'ALL', 'PT'];

// Liste des options connues
const HARMONY_OPT_LIST = ['CHAV', 'LATIN', 'GREC'];

// Critères académiques utilisés pour le scoring
const HARMONY_CRITERIA = ['COM', 'TRA', 'PART', 'ABS'];

// Scores possibles (1 à 4)
const HARMONY_SCORE_VALUES = [1, 2, 3, 4];

/**
 * Vérifie si une valeur est une LV2 connue
 * @param {string} val - Valeur à tester (ex: 'ITA')
 * @returns {boolean}
 */
function isKnownLV2(val) {
  return HARMONY_LV2_LIST.indexOf(val) >= 0;
}

/**
 * Vérifie si une valeur est une option connue
 * @param {string} val - Valeur à tester (ex: 'CHAV')
 * @returns {boolean}
 */
function isKnownOPT(val) {
  return HARMONY_OPT_LIST.indexOf(val) >= 0;
}

/**
 * Calcule le profil académique moyen d'un élève (COM+TRA+PART+ABS)/4
 * @param {Object} row - Ligne de données
 * @param {Object} idx - Map des index de colonnes {COM: n, TRA: n, ...}
 * @returns {number} Score moyen entre 1 et 4
 */
function calculateStudentProfile(row, idx) {
  let sum = 0;
  let count = 0;
  HARMONY_CRITERIA.forEach(function(crit) {
    const val = Number(row[idx[crit]]);
    if (val >= 1 && val <= 4) {
      sum += val;
      count++;
    }
  });
  return count > 0 ? sum / count : 2.5;
}

/**
 * Détecte si un élève est une "tête de classe" (profil fort)
 * @param {number} com - Score COM
 * @param {number} tra - Score TRA
 * @param {number} part - Score PART (optionnel)
 * @returns {boolean}
 */
function isHeadStudent(com, tra, part) {
  const scoreMoy = part !== undefined ? (com + tra + part) / 3 : (com + tra) / 2;
  return (com >= 4 || tra >= 4) || scoreMoy >= 3.5;
}

/**
 * Détecte si un élève est en difficulté (niveau 1)
 * @param {number} com - Score COM
 * @param {number} tra - Score TRA
 * @returns {boolean}
 */
function isNiv1Student(com, tra) {
  return (com <= 1 || tra <= 1);
}

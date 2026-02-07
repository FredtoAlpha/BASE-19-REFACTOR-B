/**
 * ===================================================================
 * APP.CONTEXT.JS - CONSTRUCTION DU CONTEXTE
 * ===================================================================
 *
 * Module contenant les fonctions de construction du contexte d'exécution.
 * Responsabilités: lecture paramètres UI, construction mapping, offres LV2/OPT.
 *
 * ARCHITECTURE PHASE 5 - Refactoring progressif
 * Extraction depuis Orchestration_V14I.js
 *
 * Date: 26 novembre 2025
 * Version: 1.0.0
 * ===================================================================
 */

// ===================================================================
// CONSTRUCTION DU CONTEXTE DEPUIS LES ONGLETS SOURCES
// ===================================================================

/**
 * Construit le contexte depuis les onglets sources (détection automatique)
 *
 * @returns {Object} Contexte complet
 *
 * @example
 * const ctx = makeCtxFromSourceSheets_();
 * // → { ss, sourceSheets, destClasses, sourceToDestMapping, ... }
 */
function makeCtxFromSourceSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets();

  // Détecter les onglets sources (formats multiples supportés)
  const sourceSheets = [];
  // ✅ Pattern universel : 6°1, ALBEXT°7, BONHOURE°2, etc. (toujours avec °)
  const sourcePattern = /^[A-Za-z0-9_-]+°\d+$/;
  // ❌ Exclure les onglets TEST, CACHE, DEF, FIN, etc.
  const excludePattern = /TEST|CACHE|DEF|FIN|SRC|SOURCE|_CONFIG|_STRUCTURE|_LOG/i;

  for (const sheet of allSheets) {
    const name = sheet.getName();
    if (sourcePattern.test(name) && !excludePattern.test(name)) {
      sourceSheets.push(name);
    }
  }

  if (sourceSheets.length === 0) {
    throw new Error(
      '❌ Aucun onglet source trouvé !\n\n' +
      'Formats supportés:\n' +
      '• Classique: 6°1, 5°1, 4°1, 3°1, etc.\n' +
      '• ECOLE: ECOLE1, ECOLE2, etc.\n' +
      '• Personnalisé: GAMARRA°4, NOMECOLE°1, etc.'
    );
  }

  sourceSheets.sort();
  logLine('INFO', `📋 Onglets sources détectés: ${sourceSheets.join(', ')}`);

  // ✅ Lire le mapping CLASSE_ORIGINE → CLASSE_DEST depuis _STRUCTURE
  const sourceToDestMapping = readSourceToDestMapping_();

  // ✅ Extraire les destinations UNIQUES depuis le MAPPING
  const uniqueDestinations = [];
  const seenDest = {};
  const destToSourceMapping = {}; // Mapping inverse pour copier les en-têtes
  const sourceSheetSet = new Set(sourceSheets);

  // Traiter TOUS les mappings depuis _STRUCTURE
  for (const [sourceName, dest] of Object.entries(sourceToDestMapping)) {
    if (dest && !seenDest[dest]) {
      uniqueDestinations.push(dest);
      seenDest[dest] = true;

      // Trouver la première source qui EXISTE physiquement pour cette destination
      if (!destToSourceMapping[dest]) {
        if (sourceSheetSet.has(sourceName)) {
          destToSourceMapping[dest] = sourceName;
        }
      }
    }
  }

  uniqueDestinations.sort();
  logLine('INFO', `📋 Classes de destination: ${uniqueDestinations.join(', ')}`);

  return {
    ss,
    sourceSheets,
    destClasses: uniqueDestinations,
    sourceToDestMapping,
    destToSourceMapping
  };
}

// ===================================================================
// CONSTRUCTION DU CONTEXTE DEPUIS L'INTERFACE
// ===================================================================

/**
 * Construit le contexte depuis l'interface utilisateur
 *
 * @param {Object} options - Options { sourceFamily, targetFamily, maxSwaps, ... }
 * @returns {Object} Contexte complet
 *
 * @example
 * const ctx = makeCtxFromUI_({ sourceFamily: 'TEST', targetFamily: 'CACHE' });
 */
function makeCtxFromUI_(options) {
  const ss = getActiveSS_();

  // Lire le mode source depuis options ou UI (TEST/FIN/CACHE/...)
  const modeSrc = (options && options.sourceFamily) ? String(options.sourceFamily).trim() : (readModeFromUI_() || 'TEST');

  // Le target est CACHE pour l'optimisation
  const writeTarget = (options && options.targetFamily) ? String(options.targetFamily).trim() : 'CACHE';

  // Lire les niveaux à traiter (dynamiquement depuis _STRUCTURE ou _CONFIG)
  const niveaux = (typeof genererNiveauxDynamiques === 'function')
    ? genererNiveauxDynamiques()
    : (readNiveauxFromUI_() || ['6°1', '6°2', '6°3', '6°4', '6°5']);

  // ✅ Construire les noms de feuilles avec les helpers (suffixe uniquement)
  const srcSheets = makeSheetsList_(niveaux, modeSrc);     // ['6°1TEST', '6°2TEST', ...]
  const cacheSheets = makeSheetsList_(niveaux, writeTarget); // ['6°1CACHE', '6°2CACHE', ...]

  logLine('INFO', '📋 Contexte: Source=' + modeSrc + ', Target=' + writeTarget);
  logLine('INFO', '📋 Onglets source: ' + srcSheets.join(', '));
  logLine('INFO', '📋 Onglets cible: ' + cacheSheets.join(', '));

  // Lire les quotas par classe depuis l'interface
  const quotas = readQuotasFromUI_();

  // Lire les cibles d'effectifs par classe
  const targets = readTargetsFromUI_();

  // Lire la tolérance de parité
  const tolParite = readParityToleranceFromUI_() || 2;

  // Lire le nombre max de swaps depuis options ou UI
  const maxSwaps = (options && options.maxSwaps) ? parseInt(options.maxSwaps) : (readMaxSwapsFromUI_() || 500);

  // Lire les autorisations de classes pour options/LV2
  const autorisations = readClassAuthorizationsFromUI_();

  return {
    ss,
    modeSrc,
    writeTarget,
    niveaux,
    srcSheets,
    cacheSheets,
    quotas,
    targets,
    tolParite,
    maxSwaps,
    autorisations
  };
}

// ===================================================================
// LECTURE DES PARAMÈTRES DEPUIS L'INTERFACE
// ===================================================================

/**
 * Lit le mode source depuis l'interface (TEST/CACHE/FIN)
 *
 * @returns {string} Mode source
 *
 * @example
 * const mode = readModeFromUI_(); // → 'TEST'
 */
function readModeFromUI_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const uiSheet = ss.getSheetByName('_INTERFACE_V2') || ss.getSheetByName('UI_Config');
  if (!uiSheet) return 'TEST';

  // ⚠️ LEGACY : Lecture de cellule UI obsolète
  try {
    const value = uiSheet.getRange('B2').getValue();
    return String(value).trim() || 'TEST';
  } catch (e) {
    return 'TEST';
  }
}

/**
 * @deprecated Utiliser genererNiveauxDynamiques() à la place
 * Lit les niveaux à traiter depuis l'interface (legacy)
 *
 * @returns {Array<string>} Liste des niveaux
 */
function readNiveauxFromUI_() {
  // ⚠️ LEGACY : Valeurs codées en dur pour compatibilité
  if (typeof logLine === 'function') {
    logLine('WARN', '⚠️ readNiveauxFromUI_() est obsolète, utilisez genererNiveauxDynamiques()');
  }
  return ['6°1', '6°2', '6°3', '6°4', '6°5'];
}

/**
 * Lit les quotas par classe depuis l'interface ou _STRUCTURE
 *
 * @returns {Object} Quotas {classe: {option: quota}}
 *
 * @example
 * const quotas = readQuotasFromUI_();
 * // → { '6°1': { ITA: 6 }, '6°2': {}, '6°3': { CHAV: 10 } }
 */
function readQuotasFromUI_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Essayer de lire depuis _STRUCTURE
  const structSheet = ss.getSheetByName('_STRUCTURE');
  if (structSheet) {
    return readQuotasFromStructure_(structSheet);
  }

  // Sinon, retour valeurs par défaut
  return {
    "6°1": { ITA: 6 },
    "6°2": {},
    "6°3": { CHAV: 10 },
    "6°4": {},
    "6°5": {}
  };
}

/**
 * Lit les effectifs cibles depuis l'interface ou _STRUCTURE
 *
 * @returns {Object} Effectifs {classe: effectif}
 *
 * @example
 * const targets = readTargetsFromUI_();
 * // → { '6°1': 25, '6°2': 26, '6°3': 25 }
 */
function readTargetsFromUI_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Essayer de lire depuis _STRUCTURE
  const structSheet = ss.getSheetByName('_STRUCTURE');
  if (structSheet) {
    return readTargetsFromStructure_(structSheet);
  }

  // Sinon, valeurs par défaut : 25 élèves par classe
  return {
    "6°1": 25,
    "6°2": 25,
    "6°3": 25,
    "6°4": 25,
    "6°5": 25
  };
}

/**
 * @deprecated Valeur codée en dur, lire depuis _OPTI_CONFIG
 * Lit la tolérance de parité depuis l'interface
 *
 * @returns {number} Tolérance de parité
 */
function readParityToleranceFromUI_() {
  // ⚠️ LEGACY : Valeur codée en dur
  return 2;
}

/**
 * Lit le nombre max de swaps depuis l'interface
 *
 * @returns {number} Nombre max de swaps
 */
function readMaxSwapsFromUI_() {
  // ⚠️ LEGACY : Valeur codée en dur
  return 500;
}

/**
 * Lit les autorisations de classes pour options/LV2
 *
 * @returns {Object} Autorisations {classe: {option: true}}
 *
 * @example
 * const autorisations = readClassAuthorizationsFromUI_();
 * // → { '6°1': { ITA: true, CHAV: false }, '6°2': { ESP: true } }
 */
function readClassAuthorizationsFromUI_() {
  // ⚠️ LEGACY : Retour vide par défaut
  // Cette fonction devrait lire depuis _STRUCTURE ou _CONFIG
  return {};
}

// ===================================================================
// LECTURE DU MAPPING DEPUIS _STRUCTURE
// ===================================================================

/**
 * Lit le mapping CLASSE_ORIGINE → CLASSE_DEST depuis _STRUCTURE
 *
 * @returns {Object} Mapping {origine: destination}
 *
 * @example
 * const mapping = readSourceToDestMapping_();
 * // → { 'ALBEXT°7': '6°5', 'BONHOURE°2': '6°2', '6°1': '6°1' }
 */
function readSourceToDestMapping_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const structSheet = ss.getSheetByName('_STRUCTURE');
  const mapping = {};

  if (!structSheet) {
    return mapping;
  }

  try {
    const data = structSheet.getDataRange().getValues();

    // Recherche de l'en-tête
    let headerRow = -1;
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim().toUpperCase();
        if (cell === 'CLASSE_DEST' || cell === 'CLASSE_ORIGINE') {
          headerRow = i;
          break;
        }
      }
      if (headerRow !== -1) break;
    }

    if (headerRow === -1) {
      logLine('WARN', '⚠️ En-têtes non trouvés dans _STRUCTURE');
      return mapping;
    }

    const headers = data[headerRow];
    const origineCol = headers.indexOf('CLASSE_ORIGINE');
    const destCol = headers.indexOf('CLASSE_DEST');

    if (origineCol === -1 || destCol === -1) {
      logLine('WARN', '⚠️ Colonnes CLASSE_ORIGINE ou CLASSE_DEST introuvables');
      return mapping;
    }

    // Lire le mapping
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      const origine = String(row[origineCol] || '').trim();
      const dest = String(row[destCol] || '').trim();

      if (origine && dest) {
        mapping[origine] = dest;
        logLine('INFO', '  📌 Mapping: ' + origine + ' → ' + dest);
      }
    }

  } catch (e) {
    logLine('WARN', 'Erreur lecture mapping depuis _STRUCTURE : ' + e.message);
  }

  return mapping;
}

// ===================================================================
// CONSTRUCTION DES OFFRES LV2/OPT
// ===================================================================

/**
 * Construit la table des classes offrant LV2/OPT depuis ctx.quotas
 *
 * @param {Object} ctx - Contexte (avec quotas, cacheSheets)
 * @returns {Object} Offres {classe: {LV2: Set, OPT: Set}}
 *
 * @example
 * const offers = buildClassOffers_(ctx);
 * // → { '6°1': { LV2: Set(['ITA']), OPT: Set(['CHAV']) }, ... }
 */
function buildClassOffers_(ctx) {
  const offers = {}; // classe -> {LV2:Set, OPT:Set}

  (ctx.cacheSheets || []).forEach(function(cl) {
    const base = cl.replace(/CACHE$/, '');
    offers[base] = { LV2: new Set(), OPT: new Set() };
  });

  // ctx.quotas vient de _STRUCTURE
  Object.keys(ctx.quotas || {}).forEach(function(classe) {
    const base = classe; // "6°1"
    if (!offers[base]) offers[base] = { LV2: new Set(), OPT: new Set() };
    const q = ctx.quotas[classe] || {};

    Object.keys(q).forEach(function(label) {
      const L = _u_(label);
      // Heuristique: LV2 connus
      if (/(ITA|ALL|ESP|PT|CHI|ANG|GER|LAT2?|ALLEMAND|ESPAGNOL|ITALIEN|CHINOIS|PORTUGAIS)/.test(L)) {
        offers[base].LV2.add(L);
      } else {
        offers[base].OPT.add(L);
      }
    });
  });

  return offers;
}

/**
 * Construit l'offre avec quotas détaillés depuis ctx.quotas
 *
 * @param {Object} ctx - Contexte (avec quotas, cacheSheets)
 * @returns {Object} Offre {cls: {LV2: [], OPT: [], quotas: {option: quota}}}
 *
 * @example
 * const offer = buildOfferWithQuotas_(ctx);
 * // → { '6°1': { LV2: ['ITA'], OPT: ['CHAV'], quotas: {ITA: 6, CHAV: 10} }, ... }
 */
function buildOfferWithQuotas_(ctx) {
  const res = {}; // { cls: { LV2:[], OPT:[], quotas: {ITA:6, CHAV:10, ...} } }

  // Initialiser depuis cacheSheets
  (ctx.cacheSheets || []).forEach(function(name) {
    const cls = name.replace(/CACHE$/, '').trim();
    res[cls] = { LV2: [], OPT: [], quotas: {} };
  });

  // Remplir depuis ctx.quotas
  Object.keys(ctx.quotas || {}).forEach(function(cls) {
    res[cls] = res[cls] || { LV2: [], OPT: [], quotas: {} };
    Object.keys(ctx.quotas[cls]).forEach(function(k) {
      const K = k.toUpperCase();
      const q = Number(ctx.quotas[cls][k]) || 0;
      res[cls].quotas[K] = q;

      // Classifier en LV2 ou OPT
      if (K === 'CHAV' || K === 'LAT' || K === 'GRE' || K === 'OPT' || K === 'ITA_OPT') {
        res[cls].OPT.push(K === 'ITA_OPT' ? 'ITA' : K);
      } else {
        res[cls].LV2.push(K);
      }
    });
  });

  return res;
}

/**
 * Retourne les classes autorisées pour un élève selon ses LV2/OPT
 *
 * @param {Object} eleve - L'élève
 * @param {Object} classOffers - Offres {classe: {LV2: Set, OPT: Set}}
 * @returns {Array<string>} Liste des classes autorisées
 *
 * @example
 * const allowed = computeAllow_(eleve, classOffers);
 * // → ['6°1', '6°3', '6°5']
 */
function computeAllow_(eleve, classOffers) {
  const lv2 = _u_(eleve.LV2 || eleve.lv2);
  const opt = _u_(eleve.OPT || eleve.opt);
  const allClasses = Object.keys(classOffers);
  let allowed = allClasses.slice();

  if (lv2) {
    allowed = allowed.filter(function(cl) { return classOffers[cl].LV2.has(lv2); });
  }
  if (opt) {
    allowed = allowed.filter(function(cl) { return classOffers[cl].OPT.has(opt); });
  }

  return allowed;
}

// ===================================================================
// EXPORTS (Google Apps Script charge automatiquement)
// ===================================================================

/**
 * Note : Dans Google Apps Script, tous les fichiers .js sont chargés
 * automatiquement dans le scope global. Pas besoin d'export/import.
 *
 * Les fonctions définies ici sont automatiquement disponibles dans
 * tous les autres fichiers du projet.
 */

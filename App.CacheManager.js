/**
 * ===================================================================
 * APP.CACHEMANAGER.JS - GESTION DU CACHE
 * ===================================================================
 *
 * Module contenant les fonctions de gestion du cache (onglets CACHE).
 * Responsabilités: lecture, écriture, activation, audit, synchronisation.
 *
 * ARCHITECTURE PHASE 5 - Refactoring progressif
 * Extraction depuis Orchestration_V14I.js
 *
 * Date: 26 novembre 2025
 * Version: 1.0.0
 * ===================================================================
 */

// ===================================================================
// LECTURE DEPUIS LE CACHE
// ===================================================================

/**
 * Lit les élèves depuis les onglets CACHE
 *
 * @param {Object} ctx - Contexte (avec cacheSheets, niveaux, ss)
 * @returns {Object} État des classes {niveau: [eleves]}
 *
 * @example
 * const state = readElevesFromCache_(ctx);
 * // → { '6°1': [...], '6°2': [...] }
 */
function readElevesFromCache_(ctx) {
  const classesState = {};

  // ✅ FIX: Construire mapping onglet → niveau depuis ctx
  const sheetToNiveau = {};
  for (let i = 0; i < (ctx.cacheSheets || []).length; i++) {
    sheetToNiveau[ctx.cacheSheets[i]] = ctx.niveaux[i];
  }

  for (const sheetName of ctx.cacheSheets) {
    const sheet = ctx.ss.getSheetByName(sheetName);
    if (!sheet) {
      logLine('WARN', 'Feuille CACHE ' + sheetName + ' introuvable');
      continue;
    }

    const eleves = readElevesFromSheet_(sheet);
    // ✅ FIX: Utiliser le mapping au lieu du regex /CACHE$/
    const niveau = sheetToNiveau[sheetName] || sheetName.replace(/CACHE$/, '');
    classesState[niveau] = eleves;
  }

  return classesState;
}

/**
 * Lit les élèves depuis le mode source sélectionné (TEST/FIN/CACHE/...)
 *
 * @param {Object} ctx - Contexte (avec srcSheets, ss, modeSrc)
 * @returns {Object} État des classes {niveau: [eleves]}
 *
 * @example
 * const state = readElevesFromSelectedMode_(ctx);
 * // → { '6°1': [...], '6°2': [...] }
 */
function readElevesFromSelectedMode_(ctx) {
  const classesState = {};

  // 🔒 GARDE-FOU : garantir un tableau exploitable
  let srcList = ctx && Array.isArray(ctx.srcSheets) ? ctx.srcSheets : null;
  if (!srcList) {
    if (ctx && typeof ctx.srcSheets === 'string') {
      srcList = ctx.srcSheets.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    } else {
      // reconstruction à partir du ctx si nécessaire
      const tag = (ctx.mode || ctx.sourceTag || 'TEST').toString().trim();
      const lv  = Array.isArray(ctx.levels) ? ctx.levels : [];
      srcList = lv.map(function(l) { return l + tag; });
    }
    ctx.srcSheets = srcList; // pour les appels suivants
  }

  for (const sheetName of srcList) {
    const sheet = ctx.ss.getSheetByName(sheetName);
    if (!sheet) {
      logLine('WARN', 'Feuille source ' + sheetName + ' introuvable');
      continue;
    }

    const eleves = readElevesFromSheet_(sheet);

    // ✅ FIX: Utiliser le mapping pour obtenir le nom de classe de destination
    let niveau;
    if (ctx.sourceToDestMapping && ctx.sourceToDestMapping[sheetName]) {
      // Mode LEGACY avec mapping : utiliser la destination
      niveau = ctx.sourceToDestMapping[sheetName];
      logLine('INFO', '  📌 Lecture ' + sheetName + ' → assignation à ' + niveau);
    } else {
      // Mode normal : retirer le suffixe
      niveau = sheetName.replace(ctx.modeSrc || 'TEST', '');
    }

    classesState[niveau] = eleves;
  }

  return classesState;
}

// ===================================================================
// ACTIVATION ET SYNCHRONISATION DU CACHE
// ===================================================================

/**
 * Force le mode CACHE dans l'interface et recharge
 *
 * @param {Object} ctx - Contexte
 *
 * @example
 * forceCacheInUIAndReload_(ctx);
 */
function forceCacheInUIAndReload_(ctx) {
  try {
    // 1. Sélectionner le mode CACHE dans l'état UI
    setInterfaceModeCACHE_(ctx);

    // 2. Activer visuellement le premier onglet CACHE
    activateFirstCacheTabIfAny_(ctx);

    // 3. Toast pour informer l'utilisateur
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Onglets CACHE mis à jour',
      'Optimisation V14I',
      3
    );

    // 4. Trigger côté front (si HTML/JS)
    triggerUIReloadFromCACHE_();

  } catch (e) {
    logLine('WARN', 'forceCacheInUIAndReload_ failed: ' + e.message);
  }
}

/**
 * Marque le mode CACHE comme actif dans l'interface
 *
 * @param {Object} ctx - Contexte
 *
 * @example
 * setInterfaceModeCACHE_(ctx);
 */
function setInterfaceModeCACHE_(ctx) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const uiSheet = ss.getSheetByName('_INTERFACE_V2') || ss.getSheetByName('UI_Config');
  if (!uiSheet) return;

  try {
    // ⚠️ LEGACY : Écriture de cellule UI obsolète
    // Le mode est maintenant géré par l'interface web (localStorage)
    uiSheet.getRange('B2').setValue('CACHE');
  } catch (e) {
    logLine('WARN', 'setInterfaceModeCACHE_ failed: ' + e.message);
  }
}

/**
 * Active visuellement le premier onglet CACHE
 *
 * @param {Object} ctx - Contexte (avec cacheSheets)
 *
 * @example
 * activateFirstCacheTabIfAny_(ctx);
 */
function activateFirstCacheTabIfAny_(ctx) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const firstName = ctx.cacheSheets && ctx.cacheSheets[0];
  if (firstName) {
    const sheet = ss.getSheetByName(firstName);
    if (sheet) ss.setActiveSheet(sheet);
  }
}

/**
 * Déclenche un reload côté front (HTML/JS)
 * Note: No-op côté Apps Script
 *
 * @example
 * triggerUIReloadFromCACHE_();
 */
function triggerUIReloadFromCACHE_() {
  // Côté Apps Script : no-op
  // Côté front (HTML/JS) : ajouter un handler
  // google.script.run.withSuccessHandler(() => {/* repaint */}).refreshFromCACHE();
}

/**
 * Ouvre visuellement les onglets CACHE et force la synchronisation
 *
 * @param {Object} ctx - Contexte (avec cacheSheets, ss)
 * @returns {Object} Résultat {opened: [], active: string, stats: []}
 *
 * @example
 * const result = openCacheTabs_(ctx);
 * // → { opened: ['6°1CACHE', '6°2CACHE'], active: '6°1CACHE', stats: [...] }
 */
function openCacheTabs_(ctx) {
  try {
    // ✅ Flush AVANT pour garantir que les écritures précédentes sont bien propagées
    SpreadsheetApp.flush();
    Utilities.sleep(200); // Attendre propagation Drive/Sheets

    const opened = [];
    const stats = [];

    // Activer chaque onglet CACHE et récupérer ses stats
    for (let i = 0; i < ctx.cacheSheets.length; i++) {
      const name = ctx.cacheSheets[i];
      const sh = ctx.ss.getSheetByName(name);

      if (sh) {
        // Activer l'onglet pour forcer sa visibilité
        ctx.ss.setActiveSheet(sh);
        sh.getRange('A1').activate(); // Ancrer la sélection
        opened.push(name);

        // Récupérer les stats
        const rows = sh.getLastRow();
        const cols = sh.getLastColumn();
        stats.push({ sheet: name, rows: rows, cols: cols });

        logLine('INFO', '  ✅ Activé: ' + name + ' (' + rows + ' lignes, ' + cols + ' colonnes)');
        Utilities.sleep(80); // Petit délai entre chaque activation
      } else {
        logLine('ERROR', '  ❌ Onglet ' + name + ' introuvable !');
      }
    }

    // Flush APRÈS pour garantir que les activations sont propagées
    SpreadsheetApp.flush();

    const active = ctx.ss.getActiveSheet() ? ctx.ss.getActiveSheet().getName() : '(aucun)';
    logLine('INFO', '✅ Onglet actif final: ' + active);
    logLine('INFO', '✅ ' + opened.length + ' onglets CACHE activés: ' + opened.join(', '));

    return {
      opened: opened,
      active: active,
      stats: stats
    };
  } catch (e) {
    logLine('WARN', '⚠️ openCacheTabs_ a échoué: ' + e.message);
    return {
      opened: [],
      active: null,
      stats: [],
      error: e.message
    };
  }
}

// ===================================================================
// CALCUL DES FLAGS DE MOBILITÉ
// ===================================================================

/**
 * Calcul et écriture des colonnes FIXE/MOBILITE dans tous les onglets CACHE
 *
 * @param {Object} ctx - Contexte (avec ss, quotas, cacheSheets)
 *
 * @example
 * computeMobilityFlags_(ctx);
 */
function computeMobilityFlags_(ctx) {
  logLine('INFO', '🔍 Calcul des statuts de mobilité (FIXE/PERMUT/LIBRE)...');

  const ss = ctx.ss;
  const classOffers = buildClassOffers_(ctx); // "6°1" -> {LV2:Set, OPT:Set}

  logLine('INFO', '  Classes offrant LV2/OPT: ' + JSON.stringify(
    Object.keys(classOffers).reduce(function(acc, cl) {
      acc[cl] = {
        LV2: Array.from(classOffers[cl].LV2),
        OPT: Array.from(classOffers[cl].OPT)
      };
      return acc;
    }, {})
  ));

  // 1) Lire tout le CACHE en mémoire + construire groupes A + index D
  const studentsByClass = {}; // "6°1" -> [{row, data, id, ...}]
  const groupsA = {};         // "A7" -> [{class,nameRow,indexRow,...}]
  const Dindex = {};          // "6°1" -> Set(Dx déjà présents)

  (ctx.cacheSheets || []).forEach(function(cacheName) {
    const base = cacheName.replace(/CACHE$/, '');
    const sh = ss.getSheetByName(cacheName);
    if (!sh) return;

    const lr = Math.max(sh.getLastRow(), 1);
    const lc = Math.max(sh.getLastColumn(), 1);
    const values = sh.getRange(1, 1, lr, lc).getDisplayValues();
    const headers = values[0];
    const find = function(name) { return headers.indexOf(name); };

    // Assure colonnes FIXE & MOBILITE
    const colFIXE = ensureColumn_(sh, 'FIXE');
    const colMOB = ensureColumn_(sh, 'MOBILITE');

    // Indices de colonnes utiles
    const idxNom = find('NOM');
    const idxPrenom = find('PRENOM');
    const idxLV2 = find('LV2');
    const idxOPT = find('OPT');
    const idxA = find('ASSO');
    const idxD = find('DISSO');
    const idxId = find('ID');

    const Dset = new Set();
    Dindex[base] = Dset;

    // Lire toutes les lignes
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const nom = String(row[idxNom] || '').trim();
      if (!nom) continue;

      const prenom = String(row[idxPrenom] || '').trim();
      const lv2 = _u_(row[idxLV2] || '');
      const opt = _u_(row[idxOPT] || '');
      const A = _u_(row[idxA] || '');
      const D = _u_(row[idxD] || '');
      const id = String(row[idxId] || '').trim();

      // Stocker l'élève
      if (!studentsByClass[base]) studentsByClass[base] = [];
      studentsByClass[base].push({
        indexRow: i + 1,
        nom: nom,
        prenom: prenom,
        lv2: lv2,
        opt: opt,
        A: A,
        D: D,
        id: id
      });

      // Indexer groupe A
      if (A) {
        if (!groupsA[A]) groupsA[A] = [];
        groupsA[A].push({
          class: base,
          nameRow: i + 1,
          indexRow: i + 1,
          nom: nom,
          prenom: prenom
        });
      }

      // Indexer code D
      if (D) Dset.add(D);
    }
  });

  // 2) Calculer FIXE et MOBILITE pour chaque élève
  Object.keys(studentsByClass).forEach(function(cls) {
    const eleves = studentsByClass[cls];
    const cacheName = cls + 'CACHE';
    const sh = ss.getSheetByName(cacheName);
    if (!sh) return;

    const colFIXE = ensureColumn_(sh, 'FIXE');
    const colMOB = ensureColumn_(sh, 'MOBILITE');

    eleves.forEach(function(e) {
      const allowed = computeAllow_(e, classOffers);
      const isFixe = (e.A !== '' || e.D !== '' || allowed.length === 1);
      const mobility = isFixe ? 'FIXE' : (allowed.length > 1 ? 'LIBRE' : 'PERMUT');

      // Écrire dans les colonnes
      sh.getRange(e.indexRow, colFIXE + 1).setValue(isFixe ? 'X' : '');
      sh.getRange(e.indexRow, colMOB + 1).setValue(mobility);
    });

    SpreadsheetApp.flush();
    logLine('INFO', '  ✅ ' + cls + ': ' + eleves.length + ' élèves traités');
  });

  logLine('INFO', '✅ Calcul des statuts de mobilité terminé');
}

// ===================================================================
// AUDIT DU CACHE
// ===================================================================

/**
 * Audite les onglets CACHE contre la structure attendue
 * Retourne un objet { classe: { total, F, M, LV2:{}, OPT:{}, violations:{} } }
 *
 * @param {Object} ctx - Contexte (avec ss, quotas, cacheSheets)
 * @returns {Object} Résultat d'audit {classe: {total, F, M, LV2, OPT, violations}}
 *
 * @example
 * const audit = auditCacheAgainstStructure_(ctx);
 * // → { '6°1': { total: 26, F: 13, M: 13, LV2: {ITA: 6}, OPT: {CHAV: 10}, violations: {...} } }
 */
function auditCacheAgainstStructure_(ctx) {
  logLine('INFO', '\n🔍 AUDIT: Vérification conformité CACHE vs STRUCTURE...');

  const offer = buildOfferWithQuotas_(ctx);
  const audit = {};

  // Pour chaque onglet CACHE
  (ctx.cacheSheets || []).forEach(function(cacheName) {
    const cls = cacheName.replace(/CACHE$/, '').trim();
    const sh = ctx.ss.getSheetByName(cacheName);

    if (!sh) {
      logLine('WARN', '  ⚠️ Onglet ' + cacheName + ' introuvable');
      return;
    }

    const data = sh.getDataRange().getValues();
    if (data.length < 2) {
      audit[cls] = {
        total: 0,
        F: 0,
        M: 0,
        LV2: {},
        OPT: {},
        FIXE: 0,
        PERMUT: 0,
        LIBRE: 0,
        violations: { LV2: [], OPT: [], D: [], A: [], QUOTAS: [] }
      };
      return;
    }

    const headers = data[0];
    const find = function(name) { return headers.indexOf(name); };

    const idxSexe = find('SEXE') >= 0 ? find('SEXE') : find('Genre');
    const idxLV2 = find('LV2');
    const idxOPT = find('OPT');
    const idxMob = find('MOBILITE');

    let total = 0, F = 0, M = 0;
    let FIXE = 0, PERMUT = 0, LIBRE = 0;
    const LV2counts = {};
    const OPTcounts = {};
    const violations = { LV2: [], OPT: [], D: [], A: [], QUOTAS: [] };

    // Parcourir les élèves
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      total++;

      // Sexe
      const sexe = _u_(row[idxSexe] || '');
      if (sexe === 'F') F++;
      else if (sexe === 'M') M++;

      // LV2
      const lv2 = _u_(row[idxLV2] || '');
      if (lv2 && lv2 !== 'ANG') {
        LV2counts[lv2] = (LV2counts[lv2] || 0) + 1;

        // Vérifier conformité
        if (offer[cls] && offer[cls].LV2.indexOf(lv2) === -1) {
          violations.LV2.push({ row: i + 1, lv2: lv2 });
        }
      }

      // OPT
      const opt = _u_(row[idxOPT] || '');
      if (opt) {
        OPTcounts[opt] = (OPTcounts[opt] || 0) + 1;

        // Vérifier conformité
        if (offer[cls] && offer[cls].OPT.indexOf(opt) === -1) {
          violations.OPT.push({ row: i + 1, opt: opt });
        }
      }

      // Mobilité
      const mob = _u_(row[idxMob] || '');
      if (mob === 'FIXE') FIXE++;
      else if (mob === 'PERMUT') PERMUT++;
      else if (mob === 'LIBRE') LIBRE++;
    }

    // Vérifier quotas
    if (offer[cls] && offer[cls].quotas) {
      Object.keys(offer[cls].quotas).forEach(function(k) {
        const expected = offer[cls].quotas[k];
        const realized = (LV2counts[k] || 0) + (OPTcounts[k] || 0);
        if (expected > 0 && realized !== expected) {
          violations.QUOTAS.push({
            option: k,
            expected: expected,
            realized: realized,
            delta: realized - expected
          });
        }
      });
    }

    audit[cls] = {
      total: total,
      F: F,
      M: M,
      deltaFM: F - M,
      LV2: LV2counts,
      OPT: OPTcounts,
      FIXE: FIXE,
      PERMUT: PERMUT,
      LIBRE: LIBRE,
      violations: violations
    };

    // Log résumé
    logLine('INFO', '  ✅ ' + cls + ': ' + total + ' élèves (F=' + F + ', M=' + M + ', ΔFM=' + (F - M) + ')');
    if (violations.LV2.length > 0 || violations.OPT.length > 0 || violations.QUOTAS.length > 0) {
      logLine('WARN', '    ⚠️ ' + (violations.LV2.length + violations.OPT.length + violations.QUOTAS.length) + ' violations détectées');
    }
  });

  logLine('INFO', '✅ Audit terminé');
  return audit;
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

/**
 * ===================================================================
 * 🚀 OPTIMUM PRIME ULTIMATE - MOTEUR D'OPTIMISATION
 * ===================================================================
 * LE CONCEPT :
 * Remplace l'usine à gaz "V15" par une architecture saine.
 * Combine la puissance statistique de "Jules Codex" avec les
 * critères pédagogiques "Humains" (Têtes de classe, Niv1).
 *
 * PONDÉRATION ASYMÉTRIQUE DES EXTRÊMES :
 * Appliquée aux deux pipelines (LEGACY et OPTI).
 *
 * AUTEUR : Gemini (Expert Apps Script)
 * DATE : 19/11/2025
 * ===================================================================
 */

// Configuration Ajustable
const ULTIMATE_CONFIG = {
  maxSwaps: 2000,           // Nombre max d'échanges testés
  stagnationLimit: 50,      // Arrêt si pas d'amélioration après N tentatives
  weights: {
    distrib: 5.0,           // Poids de la courbe de Gauss (Note moyenne)
    parity: 4.0,            // Poids de la parité F/M
    profiles: 10.0,         // Poids CRITIQUE des profils (Têtes/Niv1)
    friends: 1000.0         // Poids CRITIQUE des amitiés (ASSO/DISSO)
  },
  targets: {
    headMin: 2,             // Min têtes de classe par classe
    headMax: 5,             // Max têtes de classe par classe
    niv1Max: 4,             // Max élèves en difficulté par classe
    niv1Min: 0
  }
};

/**
 * Point d'entrée principal appelé par le Pipeline OPTI ou LEGACY
 * @param {Object} ctx - Contexte de l'optimisation
 * @returns {Object} Résultat d'optimisation
 */
function Phase4_Ultimate_Run(ctx) {
  const ss = ctx.ss || SpreadsheetApp.getActiveSpreadsheet();
  logLine('INFO', '🚀 Lancement OPTIMUM PRIME ULTIMATE...');

  // 1. CHARGEMENT ET CLASSIFICATION
  const dataResult = loadAndClassifyData_Ultimate(ctx);
  if (!dataResult.ok) {
    logLine('ERROR', '❌ Échec du chargement des données ULTIMATE');
    return { ok: false, message: 'Erreur chargement données' };
  }

  let { allData, byClass, headers } = dataResult;
  logLine('INFO', `📊 Chargement OK : ${allData.length} élèves répartis en ${Object.keys(byClass).length} classes.`);

  // 2. STATISTIQUES GLOBALES
  const globalStats = calculateGlobalStats_Ultimate(allData);
  logLine('INFO', `🎯 Cibles : Ratio F=${(globalStats.ratioF*100).toFixed(1)}%, Moyenne COM=${globalStats.avgCOM.toFixed(2)}`);

  // 3. BOUCLE D'OPTIMISATION "SMART HILL CLIMBING"
  let swapsApplied = 0;
  let stagnationCount = 0;

  for (let iter = 0; iter < ULTIMATE_CONFIG.maxSwaps; iter++) {

    // A. Identifier la classe la plus "malade" (Score le plus élevé)
    const worstClassKey = findWorstClass_Ultimate(byClass, allData, globalStats, ctx);
    if (!worstClassKey) break; // Tout est parfait !

    // B. Identifier une classe partenaire (Le "Médecin")
    const partnerClassKey = findPartnerClass_Ultimate(worstClassKey, byClass, allData, globalStats);
    if (!partnerClassKey) {
      stagnationCount++;
      if(stagnationCount > 10) break;
      continue;
    }

    // C. Chercher le meilleur swap "Chirurgical"
    const bestSwap = findBestSwapBetween_Ultimate(worstClassKey, partnerClassKey, allData, byClass, headers, globalStats, ctx);

    // D. Appliquer si gain positif
    if (bestSwap && bestSwap.gain > 0.0001) {
      applySwap_Ultimate(allData, byClass, bestSwap, headers);
      swapsApplied++;
      stagnationCount = 0;

      // 📋 LOG détaillé de chaque swap
      if (swapsApplied % 10 === 0 || swapsApplied <= 5) {
        logLine('INFO', `⚡ Swap #${swapsApplied}: ${bestSwap.reason} (Gain: ${bestSwap.gain.toFixed(4)})`);
      }
    } else {
      stagnationCount++;
    }

    if (stagnationCount >= ULTIMATE_CONFIG.stagnationLimit) {
      logLine('INFO', '🛑 Convergence atteinte (Stagnation).');
      break;
    }
  }

  // 4. SAUVEGARDE RÉELLE
  const saveResult = saveResults_Ultimate(ss, allData, byClass, headers);

  // 🔍 VALIDATION FINALE : Vérifier absence de duplications DISSO
  const validationResult = validateDISSOConstraints_Ultimate(allData, byClass, headers);
  if (!validationResult.ok) {
    logLine('ERROR', '❌ VALIDATION DISSO ÉCHOUÉE après Phase 4 ULTIMATE !');
    logLine('ERROR', `  Duplications détectées : ${validationResult.duplicates.length}`);
    validationResult.duplicates.forEach(dup => {
      logLine('ERROR', `    • ${dup.classe} : ${dup.code} présent ${dup.count} fois (${dup.noms.join(', ')})`);
    });
  } else {
    logLine('INFO', '✅ Validation DISSO : Aucune duplication détectée');
  }

  logLine('SUCCESS', `✅ ULTIMATE Terminé : ${swapsApplied} swaps chirurgicaux appliqués.`);
  return {
    ok: true,
    swapsApplied: swapsApplied,
    saveResult: saveResult,
    validation: validationResult
  };
}

// ===================================================================
// 🧠 LE CERVEAU : CALCUL DES SCORES (La logique pédagogique)
// ===================================================================

/**
 * Calcule le score de "maladie" d'une classe
 * PONDÉRATION ASYMÉTRIQUE DES EXTRÊMES :
 * - Pénalité forte (au carré) si manque de têtes
 * - Pénalité modérée si excès de têtes
 * - Pénalité très forte (au cube) si excès de Niv1
 * ✅ BUG #4 CORRECTION : Ajout critère d'effectif
 */
function calculateScore_Ultimate(indices, allData, globalStats, className, ctx) {
  let score = 0;
  const students = indices.map(i => allData[i]);
  const total = students.length;
  if (total === 0) return 10000;

  // --- 0. CRITÈRE EFFECTIF (BUG #4 CORRECTION - PRIORITÉ HAUTE) ---
  if (className && ctx && ctx.targets && ctx.targets[className]) {
    const targetSize = ctx.targets[className];
    const sizeDiff = total - targetSize;
    // Pénalité quadratique pour les écarts d'effectif
    score += Math.pow(sizeDiff, 2) * 800;
  }

  // --- 1. CRITÈRE PROFILS (Héritage LEGACY - Priorité Absolue) ---
  const nbTetes = students.filter(s => s.isHead).length;
  const nbNiv1 = students.filter(s => s.isNiv1).length;

  // PONDÉRATION ASYMÉTRIQUE DES EXTRÊMES
  if (nbTetes < ULTIMATE_CONFIG.targets.headMin) {
    score += Math.pow(ULTIMATE_CONFIG.targets.headMin - nbTetes, 2) * 500;
  }
  if (nbTetes > ULTIMATE_CONFIG.targets.headMax) {
    score += (nbTetes - ULTIMATE_CONFIG.targets.headMax) * 200;
  }

  if (nbNiv1 > ULTIMATE_CONFIG.targets.niv1Max) {
    score += Math.pow(nbNiv1 - ULTIMATE_CONFIG.targets.niv1Max, 3) * 100;
  }

  // --- 2. CRITÈRE PARITÉ (Adaptatif) ---
  const nbFilles = students.filter(s => s.sexe === 'F').length;
  const ratioF = nbFilles / total;
  score += Math.abs(ratioF - globalStats.ratioF) * 1000 * ULTIMATE_CONFIG.weights.parity;

  // --- 3. CRITÈRE DISTRIBUTION ACADÉMIQUE (Jules Codex) ---
  const avgCOM = students.reduce((acc, s) => acc + (s.COM || 2.5), 0) / total;
  const avgTRA = students.reduce((acc, s) => acc + (s.TRA || 2.5), 0) / total;

  score += Math.abs(avgCOM - globalStats.avgCOM) * 100 * ULTIMATE_CONFIG.weights.distrib;
  score += Math.abs(avgTRA - globalStats.avgTRA) * 100 * ULTIMATE_CONFIG.weights.distrib;

  return score;
}

/**
 * Identifie le meilleur swap entre deux classes
 */
function findBestSwapBetween_Ultimate(cls1Name, cls2Name, allData, byClass, headers, globalStats, ctx) {
  const idxList1 = byClass[cls1Name];
  const idxList2 = byClass[cls2Name];

  const scoreBefore = calculateScore_Ultimate(idxList1, allData, globalStats, cls1Name, ctx) +
                      calculateScore_Ultimate(idxList2, allData, globalStats, cls2Name, ctx);

  let bestSwap = null;
  let maxGain = 0;

  // Stochastic probing (15 random pairs)
  for (let i = 0; i < 15; i++) {
    const i1 = idxList1[Math.floor(Math.random() * idxList1.length)];
    const s1 = allData[i1];
    if (isFixed(s1)) continue;

    for (let j = 0; j < 15; j++) {
      const i2 = idxList2[Math.floor(Math.random() * idxList2.length)];
      const s2 = allData[i2];
      if (isFixed(s2)) continue;

      // ✅ BUG #5 CORRECTION : Vérifier compatibilité LV2/OPT AVANT swap
      if (!canSwapStudents_Ultimate(i1, i2, cls1Name, cls2Name, idxList1, idxList2, allData, headers, ctx)) {
        continue; // Swap interdit par contraintes LV2/OPT/DISSO
      }

      // Simulation du swap
      const tempList1 = idxList1.filter(idx => idx !== i1).concat([i2]);
      const tempList2 = idxList2.filter(idx => idx !== i2).concat([i1]);

      const scoreAfter = calculateScore_Ultimate(tempList1, allData, globalStats, cls1Name, ctx) +
                         calculateScore_Ultimate(tempList2, allData, globalStats, cls2Name, ctx);

      const gain = scoreBefore - scoreAfter;

      if (gain > maxGain) {
        maxGain = gain;
        bestSwap = {
          idx1: i1,
          idx2: i2,
          cls1: cls1Name,
          cls2: cls2Name,
          gain: gain,
          reason: `Swap ${s1.isHead ? 'Tête' : 'Std'}/${s1.isNiv1 ? 'Niv1' : 'Std'}`
        };
      }
    }
  }

  return bestSwap;
}

/**
 * Charge et classifie toutes les données élèves
 */
function loadAndClassifyData_Ultimate(ctx) {
  const ss = ctx.ss || SpreadsheetApp.getActiveSpreadsheet();
  const allData = [];
  const byClass = {};
  let headersRef = null;
  
  // 🌟 APPROCHE UNIVERSELLE : Détecter LV2 universelles
  const nbClasses = (ctx.niveaux || []).length;
  const lv2Counts = {};
  
  for (const classe in (ctx.quotas || {})) {
    const quotas = ctx.quotas[classe];
    for (const optName in quotas) {
      if (['ITA', 'ESP', 'ALL', 'PT'].indexOf(optName) >= 0 && quotas[optName] > 0) {
        lv2Counts[optName] = (lv2Counts[optName] || 0) + 1;
      }
    }
  }
  
  const lv2Universelles = [];
  for (const lv2 in lv2Counts) {
    if (lv2Counts[lv2] === nbClasses) {
      lv2Universelles.push(lv2);
    }
  }
  
  // Ajouter au contexte
  ctx.lv2Universelles = lv2Universelles;

  // ✅ CORRECTION CRITIQUE : Lire UNIQUEMENT depuis les onglets TEST
  //    qui contiennent le résultat des Phases 1-2-3, PAS depuis les sources
  const testSheets = (ctx.cacheSheets || []).map(name => ss.getSheetByName(name)).filter(s => s);

  testSheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    if (!headersRef) headersRef = data[0];
    const headers = data[0];

    const idx = {
      ID: headers.indexOf('ID_ELEVE'),
      SEXE: headers.indexOf('SEXE'),
      COM: headers.indexOf('COM'),
      TRA: headers.indexOf('TRA'),
      PART: headers.indexOf('PART'),
      MOB: headers.indexOf('MOBILITE'),
      FIXE: headers.indexOf('FIXE')
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[idx.ID]) continue;

      const student = {
        row: row,
        originalSheet: sheet.getName(),
        index: i,
        sexe: String(row[idx.SEXE] || 'M').toUpperCase().trim().charAt(0),
        COM: Number(row[idx.COM]) || 2.5,
        TRA: Number(row[idx.TRA]) || 2.5,
        PART: Number(row[idx.PART]) || 2.5,
        mobilite: String(row[idx.MOB] || row[idx.FIXE] || '').toUpperCase()
      };

      // --- CLASSIFICATION LOGIQUE ---
      const scoreMoy = (student.COM + student.TRA + student.PART) / 3;
      student.isHead = (student.COM >= 4 || student.TRA >= 4) || scoreMoy >= 3.5;
      student.isNiv1 = (student.COM <= 1 || student.TRA <= 1);

      allData.push(student);

      // ✅ CORRECTION : Extraire le nom de classe depuis le nom de l'onglet TEST
      //    Ex: "5°1TEST" → "5°1"
      const sheetName = sheet.getName();
      const className = sheetName.replace(/TEST$/i, '');
      
      if (!byClass[className]) byClass[className] = [];
      byClass[className].push(allData.length - 1);
    }
  });

  return { ok: true, allData: allData, byClass: byClass, headers: headersRef };
}

/**
 * Calcule les statistiques globales
 */
function calculateGlobalStats_Ultimate(allData) {
  let total = allData.length;
  if (total === 0) return { ratioF: 0.5, avgCOM: 2.5, avgTRA: 2.5 };

  const nbFilles = allData.filter(s => s.sexe === 'F').length;
  const sumCOM = allData.reduce((sum, s) => sum + s.COM, 0);
  const sumTRA = allData.reduce((sum, s) => sum + s.TRA, 0);

  return {
    ratioF: nbFilles / total,
    avgCOM: sumCOM / total,
    avgTRA: sumTRA / total
  };
}

/**
 * Identifie la classe "malade" (score le plus élevé)
 */
function findWorstClass_Ultimate(byClass, allData, globalStats, ctx) {
  let maxScore = -1;
  let worstClass = null;
  for (const cls in byClass) {
    const score = calculateScore_Ultimate(byClass[cls], allData, globalStats, cls, ctx);
    if (score > maxScore) {
      maxScore = score;
      worstClass = cls;
    }
  }
  return worstClass;
}

/**
 * Trouve une classe partenaire pour un swap
 */
function findPartnerClass_Ultimate(worstClass, byClass, allData, globalStats) {
  const classes = Object.keys(byClass).filter(c => c !== worstClass);
  if (classes.length === 0) return null;
  return classes[Math.floor(Math.random() * classes.length)];
}

/**
 * Vérifie si un élève est "fixe" (non mobile)
 */
function isFixed(student) {
  const mob = student.mobilite;
  return mob.includes('FIXE') || mob.includes('NON');
}

/**
 * ✅ BUG #5 CORRECTION : Vérifie si un swap respecte les contraintes LV2/OPT/DISSO
 */
function canSwapStudents_Ultimate(idx1, idx2, cls1Name, cls2Name, idxList1, idxList2, allData, headers, ctx) {
  const s1 = allData[idx1];
  const s2 = allData[idx2];

  // Extraire LV2/OPT des élèves
  const idxLV2 = headers.indexOf('LV2');
  const idxOPT = headers.indexOf('OPT');
  const idxDISSO = headers.indexOf('DISSO');

  // ✅ SAFETY CHECK: Vérifier que les colonnes critiques existent
  if (idxDISSO === -1) {
    logLine('ERROR', '❌ CRITIQUE: Colonne DISSO non trouvée dans les headers! Headers: ' + headers.join(', '));
    // Ne pas autoriser le swap si on ne peut pas valider DISSO
    return false;
  }

  const lv2_s1 = String(s1.row[idxLV2] || '').trim().toUpperCase();
  const opt_s1 = String(s1.row[idxOPT] || '').trim().toUpperCase();
  const lv2_s2 = String(s2.row[idxLV2] || '').trim().toUpperCase();
  const opt_s2 = String(s2.row[idxOPT] || '').trim().toUpperCase();
  const disso_s1 = String(s1.row[idxDISSO] || '').trim().toUpperCase();
  const disso_s2 = String(s2.row[idxDISSO] || '').trim().toUpperCase();

  // Vérifier si s2 peut aller dans cls1
  const quotas1 = (ctx && ctx.quotas && ctx.quotas[cls1Name]) || {};
  const lv2Universelles = (ctx && ctx.lv2Universelles) || [];
  
  // ✅ BUG CRITIQUE CORRIGÉ : Vérifier LV2 ET OPT séparément (pas else if)
  // Un élève peut avoir LV2=ESP + OPT=CHAV en même temps !
  
  // Vérifier LV2 (LV2 universelles toujours compatibles)
  if (lv2_s2 && lv2Universelles.indexOf(lv2_s2) === -1 && ['ITA', 'ESP', 'ALL', 'PT'].indexOf(lv2_s2) >= 0) {
    if (!quotas1[lv2_s2] || quotas1[lv2_s2] <= 0) {
      return false; // Classe cible ne propose pas cette LV2
    }
  }
  
  // Vérifier OPT (indépendamment de LV2)
  if (opt_s2 && ['CHAV', 'LATIN'].indexOf(opt_s2) >= 0) {
    if (!quotas1[opt_s2] || quotas1[opt_s2] <= 0) {
      return false; // Classe cible ne propose pas cette option
    }
  }
  
  // ✅ NOUVEAU : Vérifier compatibilité TOTALE (ne pas "gaspiller" une place spécialisée)
  // Si classe propose des OPT (LATIN, CHAV) ET élève n'en a pas, vérifier si c'est optimal
  const classHasOptions = quotas1['LATIN'] > 0 || quotas1['CHAV'] > 0;
  const studentHasNoOption = !opt_s2 || (opt_s2 !== 'LATIN' && opt_s2 !== 'CHAV');
  
  if (classHasOptions && studentHasNoOption && lv2_s2 && lv2_s2 !== 'ESP') {
    // Classe spécialisée (ex: ITA+LATIN) + élève simple (ITA seul)
    // → Ne pas placer un profil simple dans une classe spécialisée
    // (sauf si c'est un swap de parité critique)
    return false;
  }
  
  // Vérifier si s1 peut aller dans cls2
  const quotas2 = (ctx && ctx.quotas && ctx.quotas[cls2Name]) || {};
  
  // Vérifier LV2 (LV2 universelles toujours compatibles)
  if (lv2_s1 && lv2Universelles.indexOf(lv2_s1) === -1 && ['ITA', 'ESP', 'ALL', 'PT'].indexOf(lv2_s1) >= 0) {
    if (!quotas2[lv2_s1] || quotas2[lv2_s1] <= 0) {
      return false; // Classe cible ne propose pas cette LV2
    }
  }
  
  // Vérifier OPT (indépendamment de LV2)
  if (opt_s1 && ['CHAV', 'LATIN'].indexOf(opt_s1) >= 0) {
    if (!quotas2[opt_s1] || quotas2[opt_s1] <= 0) {
      return false; // Classe cible ne propose pas cette option
    }
  }
  
  // ✅ NOUVEAU : Vérifier compatibilité TOTALE (symétrique pour s1 → cls2)
  const class2HasOptions = quotas2['LATIN'] > 0 || quotas2['CHAV'] > 0;
  const student1HasNoOption = !opt_s1 || (opt_s1 !== 'LATIN' && opt_s1 !== 'CHAV');
  
  if (class2HasOptions && student1HasNoOption && lv2_s1 && lv2_s1 !== 'ESP') {
    // Classe spécialisée + élève simple → Ne pas gaspiller la place
    return false;
  }
  
  // Vérifier DISSO : s1 ne doit pas avoir le même code DISSO qu'un élève de cls2 (après swap)
  if (disso_s1) {
    for (let i = 0; i < idxList2.length; i++) {
      const idx = idxList2[i];
      if (idx === idx2) continue; // s2 sera swappé donc ne compte pas
      const otherStudent = allData[idx];
      const otherDisso = String(otherStudent.row[idxDISSO] || '').trim().toUpperCase();
      if (otherDisso && otherDisso === disso_s1) {
        return false; // Conflit DISSO
      }
    }
  }
  
  // Vérifier DISSO : s2 ne doit pas avoir le même code DISSO qu'un élève de cls1 (après swap)
  if (disso_s2) {
    for (let i = 0; i < idxList1.length; i++) {
      const idx = idxList1[i];
      if (idx === idx1) continue; // s1 sera swappé donc ne compte pas
      const otherStudent = allData[idx];
      const otherDisso = String(otherStudent.row[idxDISSO] || '').trim().toUpperCase();
      if (otherDisso && otherDisso === disso_s2) {
        return false; // Conflit DISSO
      }
    }
  }
  
  return true; // Swap autorisé
}

/**
 * Applique un swap d'indices entre deux classes avec logs détaillés
 */
function applySwap_Ultimate(allData, byClass, swap, headers) {
  const idx1 = swap.idx1;
  const idx2 = swap.idx2;

  // 📋 LOG détaillé des élèves swappés
  const s1 = allData[idx1];
  const s2 = allData[idx2];
  const idxNom = headers.indexOf('NOM');
  const idxLV2 = headers.indexOf('LV2');
  const idxOPT = headers.indexOf('OPT');
  const idxDISSO = headers.indexOf('DISSO');

  const nom1 = idxNom >= 0 ? String(s1.row[idxNom] || '') : 'Élève 1';
  const nom2 = idxNom >= 0 ? String(s2.row[idxNom] || '') : 'Élève 2';

  const details1 = [];
  if (idxLV2 >= 0 && s1.row[idxLV2]) details1.push('LV2=' + s1.row[idxLV2]);
  if (idxOPT >= 0 && s1.row[idxOPT]) details1.push('OPT=' + s1.row[idxOPT]);
  if (idxDISSO >= 0 && s1.row[idxDISSO]) details1.push('DISSO=' + s1.row[idxDISSO]);

  const details2 = [];
  if (idxLV2 >= 0 && s2.row[idxLV2]) details2.push('LV2=' + s2.row[idxLV2]);
  if (idxOPT >= 0 && s2.row[idxOPT]) details2.push('OPT=' + s2.row[idxOPT]);
  if (idxDISSO >= 0 && s2.row[idxDISSO]) details2.push('DISSO=' + s2.row[idxDISSO]);

  logLine('DEBUG', `  🔄 ULTIMATE Swap: ${swap.cls1} ↔ ${swap.cls2}`);
  logLine('DEBUG', `    • ${nom1}: ${swap.cls1} → ${swap.cls2} (${details1.join(', ') || 'aucune contrainte'})`);
  logLine('DEBUG', `    • ${nom2}: ${swap.cls2} → ${swap.cls1} (${details2.join(', ') || 'aucune contrainte'})`);

  // Appliquer le swap
  byClass[swap.cls1] = byClass[swap.cls1].filter(i => i !== idx1).concat([idx2]);
  byClass[swap.cls2] = byClass[swap.cls2].filter(i => i !== idx2).concat([idx1]);
}

/**
 * Sauvegarde physiquement les résultats dans les onglets
 */
function saveResults_Ultimate(ss, allData, byClass, headersRef) {
  logLine('INFO', '💾 Début de l\'écriture physique des résultats...');

  if (!headersRef || headersRef.length === 0) {
    logLine('ERROR', '❌ Impossible de sauvegarder : En-têtes manquants');
    return { ok: false };
  }

  let successCount = 0;
  let errorCount = 0;

  for (const className in byClass) {
    const indices = byClass[className];
    
    // ✅ className est déjà le nom de destination (ex: "5°1")
    //    car Phase4 charge depuis les onglets TEST (5°1TEST)
    const testSheetName = className + 'TEST';
    const sheet = ss.getSheetByName(testSheetName);

    if (!sheet) {
      logLine('WARN', `⚠️ Onglet ${testSheetName} introuvable pour l'écriture.`);
      errorCount++;
      continue;
    }

    try {
      const rowsToWrite = [headersRef];
      indices.forEach(idx => {
        const student = allData[idx];
        rowsToWrite.push(student.row);
      });

      if (rowsToWrite.length > 0) {
        sheet.getRange(1, 1, rowsToWrite.length, headersRef.length).setValues(rowsToWrite);
        const lastRow = sheet.getLastRow();
        if (lastRow > rowsToWrite.length) {
          sheet.getRange(rowsToWrite.length + 1, 1, lastRow - rowsToWrite.length, sheet.getLastColumn()).clearContent();
        }
        logLine('INFO', `  ✅ ${testSheetName} : ${indices.length} élèves écrits.`);
        successCount++;
      }
    } catch (e) {
      logLine('ERROR', `  ❌ Erreur écriture ${testSheetName} : ${e.toString()}`);
      errorCount++;
    }
  }

  SpreadsheetApp.flush();
  logLine('SUCCESS', `💾 Sauvegarde complète : ${successCount} réussi(s), ${errorCount} erreur(s)`);

  return {
    ok: errorCount === 0,
    successCount: successCount,
    errorCount: errorCount
  };
}

/**
 * Utilitaire de logging
 */
function logLine(type, msg) {
  const timestamp = new Date().toLocaleTimeString('fr-FR');
  Logger.log(`[${timestamp}] [${type}] ${msg}`);
}

/**
 * 🔍 VALIDATION FINALE : Vérifie qu'il n'y a pas de codes DISSO dupliqués dans les classes
 */
function validateDISSOConstraints_Ultimate(allData, byClass, headers) {
  const idxDISSO = headers.indexOf('DISSO');
  const idxNom = headers.indexOf('NOM');

  if (idxDISSO === -1) {
    logLine('WARN', '⚠️ Colonne DISSO non trouvée, validation DISSO ignorée');
    return { ok: true, message: 'Colonne DISSO non trouvée' };
  }

  // Vérifier chaque classe
  const duplicates = [];
  for (const cls in byClass) {
    const indices = byClass[cls];
    const dissoCounts = {};

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const student = allData[idx];
      const disso = String(student.row[idxDISSO] || '').trim().toUpperCase();
      if (!disso) continue;

      if (!dissoCounts[disso]) {
        dissoCounts[disso] = {
          code: disso,
          count: 0,
          noms: []
        };
      }

      dissoCounts[disso].count++;
      const nom = idxNom >= 0 ? String(student.row[idxNom] || '') : `Élève ${idx}`;
      dissoCounts[disso].noms.push(nom);
    }

    // Détecter duplications
    for (const code in dissoCounts) {
      if (dissoCounts[code].count > 1) {
        duplicates.push({
          classe: cls,
          code: code,
          count: dissoCounts[code].count,
          noms: dissoCounts[code].noms
        });
      }
    }
  }

  return {
    ok: duplicates.length === 0,
    duplicates: duplicates
  };
}

// ===================================================================
// TEST FUNCTIONS
// ===================================================================

/**
 * Lance le moteur Ultimate en mode test
 */
function testPhase4Ultimate() {
  const ctx = {
    ss: SpreadsheetApp.getActiveSpreadsheet()
  };
  const result = Phase4_Ultimate_Run(ctx);
  Logger.log('=== RÉSULTAT TEST ULTIMATE ===');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

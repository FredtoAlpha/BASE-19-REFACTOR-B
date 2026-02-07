/**
 * ===================================================================
 * BACKEND_ELEVES.GS - GESTION DES DONNÉES ÉLÈVES
 * ===================================================================
 * Module responsable de la lecture et l'écriture des données élèves
 * Extrait du Code.gs originel (Lignes 114-339)
 * ===================================================================
 */

// Configuration du module Élèves
const ELEVES_MODULE_CONFIG = {
  cacheTimeout: 300000, // 5 minutes
  maxBatchSize: 1000,
  validationRules: {
    minCOM: 0,
    maxCOM: 5,
    minTRA: 0,
    maxTRA: 5,
    minPART: 0,
    maxPART: 5
  }
};

// Cache global pour les données élèves
let elevesCacheData = null;
let elevesCacheTimestamp = 0;

/**
 * Charge les données élèves depuis tous les onglets source
 * @param {Object} ctx - Contexte d'exécution (contient la spreadsheet)
 * @returns {Array} Liste des élèves avec leurs propriétés
 */
function loadAllStudentsData(ctx) {
  const ss = ctx.ss || SpreadsheetApp.getActiveSpreadsheet();
  const allStudents = [];

  // ✅ DÉTECTION STRICTE : Tout ce qui finit par ° + Chiffre
  const sheets = ss.getSheets().filter(s => {
    const name = s.getName();
    // La règle d'or : "Termine par ° suivi d'au moins un chiffre"
    // Ex: "ECOLE°1" -> OK
    // Ex: "6°1" -> OK
    // Ex: "TEST", "CM2" (sans degré) -> NOK
    return /.+°\d+$/.test(name);
  });

  sheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    const headers = data[0];
    const indices = {
      ID: headers.indexOf('ID_ELEVE'),
      NOM: headers.indexOf('NOM'),
      PRENOM: headers.indexOf('PRENOM'),
      SEXE: headers.indexOf('SEXE'),
      COM: headers.indexOf('COM'),
      TRA: headers.indexOf('TRA'),
      PART: headers.indexOf('PART'),
      ABSENCE: headers.indexOf('ABSENCE'),
      FIXE: headers.indexOf('FIXE'),
      MOBILITE: headers.indexOf('MOBILITE')
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[indices.ID]) continue;

      const student = {
        id: String(row[indices.ID]).trim(),
        nom: String(row[indices.NOM] || '').trim(),
        prenom: String(row[indices.PRENOM] || '').trim(),
        sexe: String(row[indices.SEXE] || 'M').toUpperCase().trim().charAt(0),
        COM: validateScore(row[indices.COM]),
        TRA: validateScore(row[indices.TRA]),
        PART: validateScore(row[indices.PART]),
        absence: Number(row[indices.ABSENCE]) || 0,
        isFixed: String(row[indices.FIXE] || row[indices.MOBILITE] || '').includes('FIXE'),
        sourceSheet: sheet.getName(),
        rowIndex: i + 1
      };

      // Calcul des flags pédagogiques
      const avgScore = (student.COM + student.TRA + student.PART) / 3;
      student.isHead = (student.COM >= 4 || student.TRA >= 4) || avgScore >= 3.5;
      student.isNiv1 = (student.COM <= 1 || student.TRA <= 1);

      allStudents.push(student);
    }
  });

  return allStudents;
}

/**
 * Valide et corrige un score académique
 * @param {*} score - Le score à valider
 * @returns {number} Score validé entre 0 et 5
 */
function validateScore(score) {
  const num = Number(score);
  if (isNaN(num)) return 2.5; // Valeur par défaut
  return Math.max(0, Math.min(5, num));
}

/**
 * Récupère les données groupées par classe
 * @param {string} mode - 'source' ou 'fin' pour indiquer le type d'onglet
 * @returns {Object} Données organisées par classe
 */
function getClassesData(mode = 'source') {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const classesData = {};

  const filter = mode === 'fin' ? /FIN$/ : /.+°\d+$/; // ✅ Pattern universel
  const sheets = ss.getSheets().filter(s => filter.test(s.getName()));

  sheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    classesData[sheet.getName()] = {
      sheetName: sheet.getName(),
      headers: data[0],
      students: data.slice(1).filter(row => row[0] && String(row[0]).trim() !== ''),
      rowCount: data.length - 1,
      timestamp: new Date().getTime()
    };
  });

  return {
    success: true,
    data: classesData
  };
}

/**
 * Sauvegarde les données modifiées dans une classe
 * @param {string} sheetName - Nom de l'onglet cible
 * @param {Array} students - Données à écrire
 * @param {Array} headers - En-têtes de colonne
 * @returns {boolean} Succès de l'opération
 */
function saveStudentsToSheet(sheetName, students, headers) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log(`[ERROR] Onglet ${sheetName} introuvable`);
      return false;
    }

    // Préparer les données (en-têtes + élèves)
    const rowsToWrite = [headers];
    students.forEach(student => {
      if (Array.isArray(student)) {
        rowsToWrite.push(student);
      }
    });

    // Écrire les données
    const range = sheet.getRange(1, 1, rowsToWrite.length, headers.length);
    range.setValues(rowsToWrite);

    // Nettoyer les lignes vides en bas
    const lastRow = sheet.getLastRow();
    if (lastRow > rowsToWrite.length) {
      sheet.getRange(rowsToWrite.length + 1, 1, lastRow - rowsToWrite.length, sheet.getLastColumn())
        .clearContent();
    }

    SpreadsheetApp.flush();
    Logger.log(`[SUCCESS] ${sheetName} sauvegardé (${students.length} élèves)`);
    return true;
  } catch (e) {
    Logger.log(`[ERROR] Erreur lors de la sauvegarde : ${e.toString()}`);
    return false;
  }
}

/**
 * Récupère les statistiques globales sur les élèves
 * @param {Array} students - Liste des élèves
 * @returns {Object} Statistiques
 */
function calculateGlobalStudentStats(students) {
  if (students.length === 0) {
    return {
      total: 0,
      females: 0,
      males: 0,
      ratioF: 0,
      avgCOM: 2.5,
      avgTRA: 2.5,
      avgPART: 2.5,
      headsCount: 0,
      niv1Count: 0
    };
  }

  const females = students.filter(s => s.sexe === 'F').length;
  const males = students.filter(s => s.sexe === 'M').length;
  const heads = students.filter(s => s.isHead).length;
  const niv1 = students.filter(s => s.isNiv1).length;

  const sumCOM = students.reduce((sum, s) => sum + s.COM, 0);
  const sumTRA = students.reduce((sum, s) => sum + s.TRA, 0);
  const sumPART = students.reduce((sum, s) => sum + s.PART, 0);

  return {
    total: students.length,
    females: females,
    males: males,
    ratioF: females / students.length,
    avgCOM: sumCOM / students.length,
    avgTRA: sumTRA / students.length,
    avgPART: sumPART / students.length,
    headsCount: heads,
    niv1Count: niv1
  };
}

/**
 * Crée une copie d'un élève pour manipulation
 * @param {Object} student - Élève source
 * @returns {Object} Copie de l'élève
 */
function cloneStudent(student) {
  return {
    ...student,
    rowData: Array.isArray(student.rowData) ? [...student.rowData] : null
  };
}

/**
 * Valide les données d'une classe
 * @param {string} sheetName - Nom de l'onglet
 * @returns {Object} Résultat de validation
 */
function validateClassData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return { ok: false, errors: ['Onglet introuvable'] };
  }

  const errors = [];
  const warnings = [];
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    errors.push('Aucune donnée élève détectée');
    return { ok: false, errors: errors };
  }

  const headers = data[0];
  const requiredColumns = ['ID_ELEVE', 'NOM', 'SEXE', 'COM', 'TRA'];
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));

  if (missingColumns.length > 0) {
    errors.push(`Colonnes manquantes : ${missingColumns.join(', ')}`);
  }

  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) {
      warnings.push(`Ligne ${i + 1} : ID_ELEVE manquant`);
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    rowCount: data.length - 1
  };
}

// ========== FONCTIONS POUR INTERFACEV2 ==========

/**
 * Sauvegarde un snapshot des élèves
 * @param {Object} disposition - Disposition des élèves par classe
 * @param {string} mode - Mode de sauvegarde (source/test/fin/cache)
 * @returns {Object} {success: boolean, message: string}
 */
function saveElevesSnapshot(disposition, mode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Sauvegarder chaque classe
    for (const [className, classData] of Object.entries(disposition)) {
      const sheet = ss.getSheetByName(className);
      if (!sheet) continue;
      
      const headers = classData.headers || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const students = classData.students || [];
      
      saveStudentsToSheet(className, students, headers);
    }
    
    return { success: true, message: 'Snapshot sauvegardé avec succès' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Récupère les informations du dernier cache
 * @returns {Object} {exists: boolean, date: string, mode: string}
 */
function getLastCacheInfo() {
  try {
    const props = PropertiesService.getUserProperties();
    const cacheData = props.getProperty('INTERFACEV2_CACHE');
    
    if (!cacheData) {
      return { success: true, exists: false };
    }
    
    const cache = JSON.parse(cacheData);
    return {
      success: true,
      exists: true,
      date: cache.timestamp || new Date().toISOString(),
      mode: cache.mode || 'unknown'
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Sauvegarde les données dans le cache
 * @param {Object} cacheData - Données à sauvegarder
 * @returns {Object} {success: boolean}
 */
function saveCacheData(cacheData) {
  try {
    const props = PropertiesService.getUserProperties();
    props.setProperty('INTERFACEV2_CACHE', JSON.stringify(cacheData));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Charge les données depuis le cache
 * @returns {Object} {success: boolean, data: Object}
 */
function loadCacheData() {
  try {
    const props = PropertiesService.getUserProperties();
    const cacheData = props.getProperty('INTERFACEV2_CACHE');
    
    if (!cacheData) {
      return { success: true, data: null };
    }
    
    return { success: true, data: JSON.parse(cacheData) };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Sauvegarde la disposition dans les onglets Google Sheets (création des onglets CACHE)
 * @param {Object} disposition - Objet {className: {headers: [], students: []}}
 * @returns {Object} {success: boolean, saved: number, timestamp: string}
 */
function saveDispositionToSheets(disposition) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let savedCount = 0;

    for (const className in disposition) {
      const classData = disposition[className];

      // Nom de l'onglet CACHE (ex: "5°1 TEST" -> "5°1 CACHE")
      const cacheSheetName = className.replace(/(TEST|FIN|PREVIOUS)$/i, 'CACHE');

      // Créer ou obtenir l'onglet CACHE
      let cacheSheet = ss.getSheetByName(cacheSheetName);
      if (!cacheSheet) {
        cacheSheet = ss.insertSheet(cacheSheetName);
        Logger.log(`✅ Onglet créé: ${cacheSheetName}`);
      } else {
        cacheSheet.clearContents();
        Logger.log(`🔄 Onglet vidé: ${cacheSheetName}`);
      }

      // Écrire les données
      if (classData.headers && classData.students) {
        const allRows = [classData.headers, ...classData.students];
        if (allRows.length > 0 && classData.headers.length > 0) {
          cacheSheet.getRange(1, 1, allRows.length, classData.headers.length)
            .setValues(allRows);
          savedCount++;
        }
      }
    }

    SpreadsheetApp.flush();

    Logger.log(`💾 Sauvegarde réussie: ${savedCount} onglets CACHE créés/mis à jour`);

    return {
      success: true,
      saved: savedCount,
      timestamp: new Date().toISOString()
    };

  } catch (e) {
    Logger.log(`❌ Erreur saveDispositionToSheets: ${e.toString()}`);
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Récupère et efface le contexte du pont depuis ConsolePilotage
 * @returns {Object} {success: boolean, context: Object}
 */
function getBridgeContextAndClear() {
  try {
    const props = PropertiesService.getUserProperties();
    const context = props.getProperty('JULES_CONTEXT');

    if (!context) {
      return { success: true, context: null };
    }

    // Effacer après lecture
    props.deleteProperty('JULES_CONTEXT');

    return { success: true, context: JSON.parse(context) };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

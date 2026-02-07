/**
 * ===================================================================
 * 🔌 BACKEND CORE - Fonctions essentielles pour InterfaceV2
 * ===================================================================
 * Toutes les fonctions appelées par le frontend doivent être ici
 * avec un format de réponse standardisé : {success: true/false, ...}
 * ===================================================================
 */

/**
 * Retourne les paramètres UI (groupes, badges, etc.)
 */
function getUiSettings() {
  try {
    return {
      success: true,
      SHOW_GROUPS_BUTTON: true,
      ENABLE_GENDER_BADGES: true
    };
  } catch (e) {
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Charge les données de toutes les classes selon le mode
 * @param {string} mode - 'TEST', 'FIN', 'SOURCES', 'CACHE', 'PREVIOUS'
 * @returns {Object} Format standardisé {success: true, data: {...}}
 */
function getClassesData(mode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = ss.getSheets();
    
    // Déterminer le suffix selon le mode
    let suffix = '';
    if (mode === 'TEST') suffix = 'TEST';
    else if (mode === 'FIN') suffix = 'FIN';
    else if (mode === 'CACHE') suffix = 'CACHE';
    else if (mode === 'PREVIOUS') suffix = 'PREVIOUS';
    else if (mode === 'SOURCES') suffix = ''; // Onglets sources (6°1, 6°2, etc.)
    
    // Filtrer les onglets selon le mode
    let targetSheets;
    if (mode === 'SOURCES') {
      // Pattern pour onglets sources : "6°1", "5°2", "ECOLE°1", etc.
      targetSheets = allSheets.filter(s => /.+°\d+$/.test(s.getName()));
    } else {
      // Pattern pour autres modes : "6°1TEST", "6°1FIN", etc.
      targetSheets = allSheets.filter(s => s.getName().endsWith(suffix));
    }
    
    if (targetSheets.length === 0) {
      return {
        success: false,
        error: `Aucun onglet trouvé pour le mode: ${mode}`
      };
    }
    
    // Construire l'objet de données
    const result = {};
    
    targetSheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      
      if (data.length < 2) {
        // Onglet vide (juste les en-têtes ou vide)
        result[sheet.getName()] = {
          headers: data[0] || [],
          students: []
        };
        return;
      }
      
      const headers = data[0];
      const students = data.slice(1); // Toutes les lignes sauf l'en-tête
      
      result[sheet.getName()] = {
        headers: headers,
        students: students
      };
    });
    
    Logger.log(`✅ getClassesData(${mode}): ${Object.keys(result).length} classes chargées`);
    
    return {
      success: true,
      data: result
    };
    
  } catch (e) {
    Logger.log(`❌ Erreur getClassesData: ${e.toString()}`);
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Retourne les informations sur la dernière sauvegarde CACHE
 */
function getLastCacheInfo() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheets = ss.getSheets().filter(s => s.getName().endsWith('CACHE'));
    
    if (cacheSheets.length === 0) {
      return {
        success: false,
        exists: false,
        message: 'Aucun onglet CACHE trouvé'
      };
    }
    
    // Compter les élèves dans les onglets CACHE
    let totalStudents = 0;
    cacheSheets.forEach(sheet => {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        totalStudents += (lastRow - 1); // -1 pour l'en-tête
      }
    });
    
    return {
      success: true,
      exists: true,
      sheets: cacheSheets.length,
      students: totalStudents,
      timestamp: new Date().toISOString()
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Récupère et supprime le contexte du pont (Console → Interface)
 */
function getBridgeContextAndClear() {
  try {
    const props = PropertiesService.getUserProperties();
    const contextStr = props.getProperty('JULES_CONTEXT');
    
    if (!contextStr) {
      return {
        success: false,
        hasContext: false,
        message: 'Aucun contexte de pont trouvé'
      };
    }
    
    // Parser le contexte
    const context = JSON.parse(contextStr);
    
    // Supprimer le contexte (one-time use)
    props.deleteProperty('JULES_CONTEXT');
    
    return {
      success: true,
      hasContext: true,
      context: context
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Sauvegarde les données dans les onglets CACHE
 * @param {Object} disposition - Les données à sauvegarder
 * @param {string} sourceMode - Mode source ('TEST', 'FIN', etc.)
 */
function saveCacheData(disposition, sourceMode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let savedCount = 0;
    
    for (const className in disposition) {
      const classData = disposition[className];
      
      // Nom de l'onglet CACHE
      const cacheSheetName = className.replace(/(TEST|FIN|PREVIOUS)$/i, 'CACHE');
      
      // Créer ou obtenir l'onglet CACHE
      let cacheSheet = ss.getSheetByName(cacheSheetName);
      if (!cacheSheet) {
        cacheSheet = ss.insertSheet(cacheSheetName);
      } else {
        cacheSheet.clearContents();
      }
      
      // Écrire les données
      if (classData.headers && classData.students) {
        const allRows = [classData.headers, ...classData.students];
        cacheSheet.getRange(1, 1, allRows.length, classData.headers.length)
          .setValues(allRows);
        savedCount++;
      }
    }
    
    SpreadsheetApp.flush();
    
    return {
      success: true,
      saved: savedCount,
      timestamp: new Date().toISOString()
    };
    
  } catch (e) {
    Logger.log(`❌ Erreur saveCacheData: ${e.toString()}`);
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Charge les données depuis les onglets CACHE
 */
function loadCacheData() {
  try {
    return getClassesData('CACHE');
  } catch (e) {
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Crée les onglets FIN depuis une disposition
 * @param {Object} disposition - Les données des classes
 * @param {string} sourceMode - Mode source
 */
function saveElevesSnapshot(disposition, sourceMode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let createdCount = 0;
    
    for (const className in disposition) {
      const classData = disposition[className];
      
      // Nom de l'onglet FIN
      let finSheetName = className.replace(/(TEST|CACHE|PREVIOUS)$/i, 'FIN');
      if (!finSheetName.endsWith('FIN')) {
        finSheetName += 'FIN';
      }
      
      // Supprimer l'ancien FIN si existe
      let finSheet = ss.getSheetByName(finSheetName);
      if (finSheet) {
        ss.deleteSheet(finSheet);
      }
      
      // Créer le nouvel onglet FIN
      finSheet = ss.insertSheet(finSheetName);
      
      // Écrire les données
      if (classData.headers && classData.students) {
        const allRows = [classData.headers, ...classData.students];
        finSheet.getRange(1, 1, allRows.length, classData.headers.length)
          .setValues(allRows);
        
        // Appliquer le formatage (si la fonction existe)
        if (typeof formatFinSheet_LEGACY === 'function') {
          formatFinSheet_LEGACY(finSheet);
        }
        
        createdCount++;
      }
    }
    
    SpreadsheetApp.flush();
    
    return {
      success: true,
      created: createdCount,
      timestamp: new Date().toISOString()
    };
    
  } catch (e) {
    Logger.log(`❌ Erreur saveElevesSnapshot: ${e.toString()}`);
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Charge les contraintes (ASSO/DISSO) depuis _STRUCTURE
 */
function chargerContraintes() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const structureSheet = ss.getSheetByName('_STRUCTURE');
    
    if (!structureSheet) {
      return {
        success: false,
        error: 'Onglet _STRUCTURE introuvable'
      };
    }
    
    const data = structureSheet.getDataRange().getValues();
    
    return {
      success: true,
      constraints: {
        structure: data.slice(1) // Toutes les lignes sauf l'en-tête
      }
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Test de connexion backend
 */
function testBackendConnection() {
  return {
    success: true,
    message: 'Backend connecté !',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
}

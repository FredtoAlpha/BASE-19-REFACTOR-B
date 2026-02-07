/**
 * Récupère le mot de passe admin depuis _CONFIG B3
 * @returns {string} Le mot de passe configuré
 */
function getAdminPasswordFromConfig() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('_CONFIG');

    if (!configSheet) {
      Logger.warn('Onglet _CONFIG introuvable, utilisation du mot de passe par défaut');
      return 'admin123';
    }

    // Récupérer la valeur en B3
    const password = configSheet.getRange('B3').getValue();

    if (!password || String(password).trim() === '') {
      Logger.warn('Mot de passe vide en _CONFIG B3, utilisation du mot de passe par défaut');
      return 'admin123';
    }

    Logger.info('Mot de passe admin récupéré depuis _CONFIG B3');
    return String(password).trim();

  } catch (e) {
    Logger.error('Erreur lors de la récupération du mot de passe admin', { sheet: '_CONFIG' }, e);
    return 'admin123'; // Fallback
  }
}

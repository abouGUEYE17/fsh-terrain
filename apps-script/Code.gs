/**
 * FSH Terrain – réception des fiches dans Google Drive.
 *
 * Ce script crée dans le Drive du compte qui le déploie :
 *   FSH – Application terrain/
 *     ├── FSH – Base de données terrain   (Google Sheets : Tableau de bord, Collectes, Séances, Rapports)
 *     ├── Rapports/                        (fichiers déposés par les coordonnateurs)
 *     ├── Photos et justificatifs/         (photos des fiches et des séances)
 *     └── Exports Excel/                   (copie .xlsx du classeur, mise à jour chaque heure)
 *
 * Installation : voir README.md (exécuter « installer » une fois, puis déployer en application Web).
 */

// Code à saisir dans l'application (Paramètres). Changez-le avant le déploiement.
const CODE_ACCES = 'FSH-2026-A-CHANGER';

const NOM_DOSSIER = 'FSH – Application terrain';
const NOM_CLASSEUR = 'FSH – Base de données terrain';
const FUSEAU = 'Africa/Dakar';
const MAX_ZONES = 30;

// Les trois feuilles de données ont toujours : A = ID, B = date, C = zone.
const FEUILLES = {
  collecte: {
    nom: 'Collectes',
    colonneLien: 11,
    entetes: ['ID fiche', 'Date', 'Zone', 'Communauté / groupement', "Type d'activité", 'Personnes concernées',
      'Observations', 'Statut', 'Latitude', 'Longitude', 'Photo', 'Auteur', 'Profil', 'Saisie le', 'Reçue le'],
    ligne: (f, lien) => [f.id, jour(f.data.date), texte(f.data.zone), texte(f.data.communaute), texte(f.data.activite),
      nombre(f.data.personnes), texte(f.data.observations), texte(f.data.statut), nombre(f.data.latitude),
      nombre(f.data.longitude), lien, texte(f.auteur), texte(f.role), instant(f.createdAt), new Date()],
  },
  seance: {
    nom: 'Séances',
    colonneLien: 13,
    entetes: ['ID fiche', 'Date', 'Zone', 'Thème', 'Lieu / groupe', 'Animateur', 'Hommes', 'Femmes',
      'Total participants', 'Compte rendu', 'Recommandations', 'Prochaines actions', 'Justificatif', 'Auteur',
      'Profil', 'Saisie le', 'Reçue le'],
    ligne: (f, lien) => [f.id, jour(f.data.date), texte(f.data.zone), texte(f.data.theme), texte(f.data.lieu),
      texte(f.data.animateur), nombre(f.data.hommes), nombre(f.data.femmes), nombre(f.data.participants),
      texte(f.data.compteRendu), texte(f.data.recommandations), texte(f.data.prochainesActions), lien,
      texte(f.auteur), texte(f.role), instant(f.createdAt), new Date()],
  },
  rapport: {
    nom: 'Rapports',
    colonneLien: 7,
    entetes: ['ID fiche', 'Date de dépôt', 'Zone', 'Titre', 'Activité', 'Période', 'Fichier', 'Nom du fichier',
      'Taille (Ko)', 'Auteur', 'Profil', 'Reçu le'],
    ligne: (f, lien) => [f.id, jour(String(f.createdAt || '').slice(0, 10)), texte(f.data.zone), texte(f.data.titre),
      texte(f.data.activite), texte(f.data.periode), lien, texte(f.file ? f.file.name : ''),
      f.file ? Math.round(f.file.size / 1024) : '', texte(f.auteur), texte(f.role), new Date()],
  },
};

// ---------- Points d'entrée de l'application Web ----------

function doGet(e) {
  const code = e && e.parameter ? e.parameter.code : '';
  if (code !== CODE_ACCES) return json({ ok: true, valide: false });
  const ids = ressources();
  return json({
    ok: true,
    valide: true,
    classeur: SpreadsheetApp.openById(ids.classeur).getUrl(),
    dossier: DriveApp.getFolderById(ids.dossier).getUrl(),
  });
}

function doPost(e) {
  let requete;
  try {
    requete = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'format', message: 'Requête illisible' });
  }
  if (!requete || requete.code !== CODE_ACCES) {
    return json({ ok: false, error: 'code', message: "Code d'accès invalide" });
  }
  const fiche = requete.fiche;
  if (!fiche || !FEUILLES[fiche.type] || !/^[A-Z]{3}-\d{8}-[A-Z0-9]{6}$/.test(String(fiche.id)) || !fiche.data) {
    return json({ ok: false, error: 'format', message: 'Fiche incomplète' });
  }

  const verrou = LockService.getScriptLock();
  verrou.waitLock(30000);
  try {
    const ids = ressources();
    const feuille = SpreadsheetApp.openById(ids.classeur).getSheetByName(FEUILLES[fiche.type].nom);

    // Une fiche renvoyée après une coupure réseau n'est pas enregistrée deux fois.
    const existe = feuille.getRange('A:A').createTextFinder(fiche.id).matchEntireCell(true).findNext();
    if (existe) return json({ ok: true, id: fiche.id, doublon: true });

    let url = '';
    if (fiche.file && fiche.file.data) {
      const dossier = DriveApp.getFolderById(fiche.type === 'rapport' ? ids.rapports : ids.photos);
      const nom = fiche.id + ' – ' + String(fiche.file.name || 'fichier').replace(/[\\/:*?"<>|]/g, '_');
      const blob = Utilities.newBlob(Utilities.base64Decode(fiche.file.data),
        fiche.file.type || 'application/octet-stream', nom);
      url = dossier.createFile(blob).getUrl();
    }

    const ligne = FEUILLES[fiche.type].ligne(fiche, url ? 'Ouvrir' : '');
    feuille.appendRow(ligne);
    if (url) {
      feuille.getRange(feuille.getLastRow(), FEUILLES[fiche.type].colonneLien)
        .setRichTextValue(SpreadsheetApp.newRichTextValue().setText('Ouvrir').setLinkUrl(url).build());
    }
    PropertiesService.getScriptProperties().setProperty('A_EXPORTER', '1');
    return json({ ok: true, id: fiche.id, lien: url });
  } catch (err) {
    return json({ ok: false, error: 'serveur', message: String(err && err.message ? err.message : err) });
  } finally {
    verrou.releaseLock();
  }
}

// ---------- Installation ----------

/** À exécuter une fois depuis l'éditeur Apps Script (bouton « Exécuter »). */
function installer() {
  const ids = ressources();
  installerDeclencheurs();
  exporterExcel();
  Logger.log('Dossier Drive : ' + DriveApp.getFolderById(ids.dossier).getUrl());
  Logger.log('Classeur : ' + SpreadsheetApp.openById(ids.classeur).getUrl());
}

function installerDeclencheurs() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'exporterSiNecessaire')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('exporterSiNecessaire').timeBased().everyHours(1).create();
}

/** Retourne les identifiants du dossier et du classeur, en les créant au besoin. */
function ressources() {
  const props = PropertiesService.getScriptProperties();
  const ids = props.getProperties();
  if (ids.dossier && ids.classeur && ids.rapports && ids.photos && ids.exports) return ids;

  const dossier = ids.dossier ? DriveApp.getFolderById(ids.dossier) : DriveApp.createFolder(NOM_DOSSIER);
  const sousDossier = (cle, nom) => ids[cle] || dossier.createFolder(nom).getId();
  const nouveaux = {
    dossier: dossier.getId(),
    rapports: sousDossier('rapports', 'Rapports'),
    photos: sousDossier('photos', 'Photos et justificatifs'),
    exports: sousDossier('exports', 'Exports Excel'),
    classeur: ids.classeur || creerClasseur(dossier),
  };
  props.setProperties(nouveaux);
  return Object.assign({}, ids, nouveaux);
}

function creerClasseur(dossier) {
  const ss = SpreadsheetApp.create(NOM_CLASSEUR);
  ss.setSpreadsheetTimeZone(FUSEAU);
  ss.setSpreadsheetLocale('fr_FR');
  DriveApp.getFileById(ss.getId()).moveTo(dossier);

  const vide = ss.getSheets()[0];
  Object.keys(FEUILLES).forEach((type) => {
    const def = FEUILLES[type];
    const sh = ss.insertSheet(def.nom);
    sh.getRange(1, 1, 1, def.entetes.length).setValues([def.entetes])
      .setFontWeight('bold').setBackground('#0f6b4f').setFontColor('#ffffff').setWrap(true);
    sh.setFrozenRows(1);
    sh.setFrozenColumns(1);
    sh.getRange('B:B').setNumberFormat('dd/mm/yyyy');
    sh.getRange(1, def.entetes.length, sh.getMaxRows(), 1).setNumberFormat('dd/mm/yyyy hh:mm');
    sh.setColumnWidths(1, def.entetes.length, 140);
  });
  ss.getSheetByName('Collectes').getRange('N:N').setNumberFormat('dd/mm/yyyy hh:mm');
  ss.getSheetByName('Séances').getRange('P:P').setNumberFormat('dd/mm/yyyy hh:mm');

  construireTableauDeBord(ss);
  ss.deleteSheet(vide);
  return ss.getId();
}

function construireTableauDeBord(ss) {
  const sh = ss.insertSheet('Tableau de bord', 0);
  const C = "'Collectes'!";
  const S = "'Séances'!";
  const R = "'Rapports'!";

  sh.getRange('A1').setValue('FSH – Tableau de bord des activités terrain').setFontSize(16).setFontWeight('bold');
  sh.getRange('A2').setFormula('="Dernière fiche reçue : "&IFERROR(TEXT(MAX(' + C + 'O2:O,' + S + 'Q2:Q,' + R + 'L2:L),"dd/mm/yyyy hh:mm"),"aucune")');

  // Indicateurs clés
  const kpis = [
    ['Collectes', '=COUNTA(' + C + 'A2:A)'],
    ['Séances', '=COUNTA(' + S + 'A2:A)'],
    ['Participants', '=SUM(' + S + 'I2:I)'],
    ['Rapports déposés', '=COUNTA(' + R + 'A2:A)'],
    ['Fiches à compléter', '=COUNTIF(' + C + 'H2:H,"À compléter")'],
  ];
  kpis.forEach((k, i) => {
    sh.getRange(4, i + 1).setValue(k[0]).setFontColor('#5e6b66');
    sh.getRange(5, i + 1).setFormula(k[1]).setFontSize(20).setFontWeight('bold').setFontColor('#0f6b4f');
  });

  // Activité par zone
  const finZones = 8 + MAX_ZONES;
  sh.getRange('A7').setValue('Activité par zone').setFontWeight('bold');
  sh.getRange('A8:E8').setValues([['Zone', 'Collectes', 'Séances', 'Participants', 'Rapports']]);
  const zones = '{' + C + 'C2:C;' + S + 'C2:C;' + R + 'C2:C}';
  sh.getRange('A9').setFormula('=IFERROR(SORT(UNIQUE(FILTER(' + zones + ',' + zones + '<>""))),"")');
  const lignesZones = [];
  for (let r = 9; r <= finZones; r++) {
    lignesZones.push([
      '=IF($A' + r + '="","",COUNTIF(' + C + '$C$2:$C,$A' + r + '))',
      '=IF($A' + r + '="","",COUNTIF(' + S + '$C$2:$C,$A' + r + '))',
      '=IF($A' + r + '="","",SUMIF(' + S + '$C$2:$C,$A' + r + ',' + S + '$I$2:$I))',
      '=IF($A' + r + '="","",COUNTIF(' + R + '$C$2:$C,$A' + r + '))',
    ]);
  }
  sh.getRange(9, 2, MAX_ZONES, 4).setFormulas(lignesZones);

  // Évolution sur 12 mois
  sh.getRange('G7').setValue('Évolution sur 12 mois').setFontWeight('bold');
  sh.getRange('G8:K8').setValues([['Mois', 'Collectes', 'Séances', 'Participants', 'Rapports']]);
  const lignesMois = [];
  for (let i = 0; i < 12; i++) {
    const r = 9 + i;
    const debut = '$G' + r;
    const fin = 'EDATE($G' + r + ',1)';
    lignesMois.push([
      i === 0 ? '=EOMONTH(TODAY(),-12)+1' : '=EDATE(G' + (r - 1) + ',1)',
      '=COUNTIFS(' + C + '$B$2:$B,">="&' + debut + ',' + C + '$B$2:$B,"<"&' + fin + ')',
      '=COUNTIFS(' + S + '$B$2:$B,">="&' + debut + ',' + S + '$B$2:$B,"<"&' + fin + ')',
      '=SUMIFS(' + S + '$I$2:$I,' + S + '$B$2:$B,">="&' + debut + ',' + S + '$B$2:$B,"<"&' + fin + ')',
      '=COUNTIFS(' + R + '$B$2:$B,">="&' + debut + ',' + R + '$B$2:$B,"<"&' + fin + ')',
    ]);
  }
  sh.getRange(9, 7, 12, 5).setFormulas(lignesMois);
  sh.getRange('G9:G20').setNumberFormat('mmm yyyy');

  [sh.getRange('A8:E8'), sh.getRange('G8:K8')].forEach((r) => r.setFontWeight('bold').setBackground('#e5f2ec'));
  sh.setColumnWidth(1, 180);
  sh.setColumnWidth(6, 30);
  sh.setColumnWidth(7, 110);

  // Graphiques
  sh.insertChart(sh.newChart().asColumnChart()
    .addRange(sh.getRange('A8:C' + finZones))
    .addRange(sh.getRange('E8:E' + finZones))
    .setNumHeaders(1)
    .setOption('title', 'Collectes, séances et rapports par zone')
    .setOption('legend', { position: 'bottom' })
    .setOption('colors', ['#0f6b4f', '#e08a00', '#5b7fbf'])
    .setPosition(4, 13, 0, 0)
    .build());
  sh.insertChart(sh.newChart().asLineChart()
    .addRange(sh.getRange('G8:I20'))
    .addRange(sh.getRange('K8:K20'))
    .setNumHeaders(1)
    .setOption('title', 'Activité mensuelle (12 derniers mois)')
    .setOption('legend', { position: 'bottom' })
    .setOption('colors', ['#0f6b4f', '#e08a00', '#5b7fbf'])
    .setPosition(24, 13, 0, 0)
    .build());
}

// ---------- Export Excel ----------

function exporterSiNecessaire() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('A_EXPORTER') !== '1') return;
  exporterExcel();
}

/** Enregistre une copie .xlsx du classeur (une par jour, remplacée dans la journée). */
function exporterExcel() {
  const props = PropertiesService.getScriptProperties();
  const ids = ressources();
  const url = 'https://docs.google.com/spreadsheets/d/' + ids.classeur + '/export?format=xlsx';
  const reponse = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  const nom = 'FSH_Donnees_terrain_' + Utilities.formatDate(new Date(), FUSEAU, 'yyyy-MM-dd') + '.xlsx';
  const dossier = DriveApp.getFolderById(ids.exports);
  const anciens = dossier.getFilesByName(nom);
  while (anciens.hasNext()) anciens.next().setTrashed(true);
  dossier.createFile(reponse.getBlob().setName(nom));
  props.setProperty('A_EXPORTER', '0');
}

// ---------- Utilitaires ----------

function json(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

// Empêche qu'un texte saisi commençant par « = » soit interprété comme une formule.
function texte(v) {
  const s = v === undefined || v === null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function nombre(v) {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}

function jour(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : '';
}

function instant(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d;
}

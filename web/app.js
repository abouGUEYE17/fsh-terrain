import { putFiche, allFiches, getFiche, deleteFiche } from './db.js';
import { syncAll, getSettings, saveSettings, testConnexion } from './sync.js';

const PROFIL_KEY = 'fsh-profil';
const MAX_FICHIER = 5 * 1024 * 1024;

const ZONES_EXEMPLE = [
  'Dakar Plateau', 'Médina', 'Grand Yoff', 'Parcelles Assainies',
  'Pikine', 'Guédiawaye', 'Keur Massar', 'Rufisque',
];

const TYPES = {
  collecte: {
    label: 'Fiche de collecte',
    court: 'Collecte',
    prefixe: 'COL',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'zone', label: 'Zone', type: 'zone', required: true },
      { name: 'communaute', label: 'Communauté / groupement', type: 'text', required: true },
      {
        name: 'activite', label: "Type d'activité", type: 'select', required: true,
        options: ['Mobilisation communautaire', 'Recensement des habitants', 'Suivi de groupement', 'Visite de terrain', 'Autre'],
      },
      { name: 'personnes', label: 'Nombre de personnes concernées', type: 'number' },
      { name: 'observations', label: 'Observations', type: 'textarea', required: true },
      { name: 'statut', label: 'Statut', type: 'select', required: true, options: ['Complète', 'À compléter'] },
      { name: 'gps', label: 'Localisation', type: 'gps' },
      { name: 'photo', label: 'Photo (facultative)', type: 'photo' },
    ],
  },
  seance: {
    label: 'Séance de sensibilisation',
    court: 'Séance',
    prefixe: 'SEN',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'zone', label: 'Zone', type: 'zone', required: true },
      { name: 'theme', label: 'Thème', type: 'text', required: true },
      { name: 'lieu', label: 'Lieu / groupe', type: 'text', required: true },
      { name: 'animateur', label: 'Animateur', type: 'text', required: true },
      { name: 'hommes', label: 'Hommes', type: 'number', half: true },
      { name: 'femmes', label: 'Femmes', type: 'number', half: true },
      { name: 'participants', label: 'Total participants', type: 'number', required: true },
      { name: 'compteRendu', label: 'Compte rendu', type: 'textarea', required: true },
      { name: 'recommandations', label: 'Recommandations', type: 'textarea' },
      { name: 'prochainesActions', label: 'Prochaines actions', type: 'textarea' },
      { name: 'justificatif', label: 'Justificatif (photo de la liste de présence…)', type: 'photo' },
    ],
  },
  rapport: {
    label: 'Dépôt de rapport',
    court: 'Rapport',
    prefixe: 'RAP',
    fields: [
      { name: 'titre', label: 'Titre du rapport', type: 'text', required: true },
      {
        name: 'activite', label: 'Activité', type: 'select', required: true,
        options: ['Collecte', 'Sensibilisation', 'Réunion', 'Formation', 'Rapport mensuel', 'Autre'],
      },
      { name: 'zone', label: 'Zone', type: 'zone', required: true },
      { name: 'periode', label: 'Période (mois)', type: 'month', required: true },
      { name: 'fichier', label: 'Fichier (PDF, Word ou image, 5 Mo max.)', type: 'file', required: true },
    ],
  },
};

const ROLES = ['Relais', 'Coordonnateur', 'Administrateur'];

// ---------- Utilitaires ----------

const $ = (sel, root = document) => root.querySelector(sel);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function newId(prefixe) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(rnd, (n) => chars[n % chars.length]).join('');
  return `${prefixe}-${today().replace(/-/g, '')}-${code}`;
}

function formatDate(iso) {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const [y, m] = iso.split('-');
    return `${m}/${y}`;
  }
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatTaille(octets) {
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

function toast(message, kind = 'ok') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.className = 'toast'; }, 3500);
}

function getProfil() {
  try {
    return JSON.parse(localStorage.getItem(PROFIL_KEY)) || null;
  } catch {
    return null;
  }
}

function getZones() {
  const zones = getSettings().zones;
  return Array.isArray(zones) && zones.length ? zones : ZONES_EXEMPLE;
}

// Réduit les photos (1600 px, JPEG 70 %) pour économiser la place et les données.
async function compresserImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    if (!blob || blob.size >= file.size) return file;
    const nom = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nom, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// ---------- En-tête : connexion et fiches en attente ----------

async function majEtat() {
  const fiches = await allFiches();
  const attente = fiches.filter((f) => f.sync !== 'synced').length;
  const enLigne = navigator.onLine;
  $('#etat-reseau').textContent = enLigne ? 'En ligne' : 'Hors ligne';
  $('#etat-reseau').className = `pill ${enLigne ? 'pill-ok' : 'pill-off'}`;
  $('#etat-attente').textContent = attente ? `${attente} en attente` : 'Tout est envoyé';
  $('#etat-attente').className = `pill ${attente ? 'pill-wait' : 'pill-ok'}`;
  return fiches;
}

async function lancerSync(manuel = false) {
  const res = await syncAll(() => majEtat());
  await majEtat();
  const surListe = location.hash === '' || location.hash === '#/' || location.hash === '#/fiches';
  if ((res.sent || res.failed) && surListe) route();
  if (!manuel) return;
  if (res.error === 'config') toast('Renseignez l’adresse du service et le code dans Paramètres.', 'err');
  else if (res.error === 'offline') toast('Pas de connexion : les fiches restent sur le téléphone.', 'err');
  else if (res.skipped) toast('Envoi déjà en cours…');
  else if (res.failed) toast(`${res.sent} envoyée(s), ${res.failed} en échec.`, 'err');
  else if (res.sent) toast(`${res.sent} fiche(s) envoyée(s) vers le Drive.`);
  else toast('Aucune fiche en attente.');
}

// ---------- Vues ----------

function vueAccueil(fiches) {
  const profil = getProfil() || {};
  const settings = getSettings();
  const compte = (type) => fiches.filter((f) => f.type === type).length;
  const attente = fiches.filter((f) => f.sync !== 'synced').length;
  const erreurs = fiches.filter((f) => f.sync === 'error').length;
  const lienDrive = settings.classeur
    ? `<a class="btn btn-ghost" href="${esc(settings.classeur)}" target="_blank" rel="noopener">Ouvrir le tableau de bord (Drive)</a>`
    : '';
  return `
    <h1>Bonjour ${esc(profil.nom || '')}</h1>
    <p class="muted">${esc(profil.role || '')}${profil.zone ? ' · ' + esc(profil.zone) : ''}</p>
    <div class="actions">
      <a class="action" href="#/nouveau/collecte"><span class="ico">📋</span>Nouvelle collecte</a>
      <a class="action" href="#/nouveau/seance"><span class="ico">👥</span>Nouvelle séance</a>
      <a class="action" href="#/nouveau/rapport"><span class="ico">📄</span>Déposer un rapport</a>
    </div>
    <h2>Sur ce téléphone</h2>
    <div class="stats">
      <div class="stat"><b>${compte('collecte')}</b><span>Collectes</span></div>
      <div class="stat"><b>${compte('seance')}</b><span>Séances</span></div>
      <div class="stat"><b>${compte('rapport')}</b><span>Rapports</span></div>
      <div class="stat ${attente ? 'warn' : ''}"><b>${attente}</b><span>En attente d’envoi</span></div>
    </div>
    ${erreurs ? `<p class="alert">${erreurs} fiche(s) n’ont pas pu être envoyées. Elles seront renvoyées automatiquement.</p>` : ''}
    <button class="btn" id="btn-sync">Envoyer maintenant</button>
    ${lienDrive}
    <p class="muted small">Dernier envoi : ${settings.lastSync ? formatDate(settings.lastSync) : 'jamais'}</p>
  `;
}

function champHtml(field, valeurs) {
  const id = `f-${field.name}`;
  const req = field.required ? 'required' : '';
  const etoile = field.required ? ' <span class="req">*</span>' : '';
  const v = esc(valeurs[field.name] ?? '');
  const label = `<label for="${id}">${esc(field.label)}${etoile}</label>`;
  switch (field.type) {
    case 'textarea':
      return `<div class="field">${label}<textarea id="${id}" name="${field.name}" rows="3" ${req}>${v}</textarea></div>`;
    case 'select':
      return `<div class="field">${label}<select id="${id}" name="${field.name}" ${req}>
        <option value="">— Choisir —</option>
        ${field.options.map((o) => `<option ${o === valeurs[field.name] ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      </select></div>`;
    case 'zone':
      return `<div class="field">${label}<input id="${id}" name="${field.name}" list="liste-zones" value="${v}" ${req} autocomplete="off"></div>`;
    case 'number':
      return `<div class="field ${field.half ? 'half' : ''}">${label}<input id="${id}" name="${field.name}" type="number" min="0" step="1" inputmode="numeric" value="${v}" ${req}></div>`;
    case 'date':
      return `<div class="field">${label}<input id="${id}" name="${field.name}" type="date" max="${today()}" value="${v}" ${req}></div>`;
    case 'month':
      return `<div class="field">${label}<input id="${id}" name="${field.name}" type="month" value="${v}" ${req}></div>`;
    case 'gps':
      return `<div class="field">${label}
        <button type="button" class="btn btn-ghost" data-gps>📍 Enregistrer ma position</button>
        <input type="hidden" name="latitude"><input type="hidden" name="longitude">
        <small class="muted" data-gps-info>Facultatif</small></div>`;
    case 'photo':
      return `<div class="field">${label}<input id="${id}" name="${field.name}" type="file" accept="image/*" capture="environment" ${req}>
        <small class="muted" data-info="${field.name}"></small></div>`;
    case 'file':
      return `<div class="field">${label}<input id="${id}" name="${field.name}" type="file" accept=".pdf,.doc,.docx,image/*" ${req}>
        <small class="muted" data-info="${field.name}"></small></div>`;
    default:
      return `<div class="field">${label}<input id="${id}" name="${field.name}" type="text" value="${v}" ${req}></div>`;
  }
}

function vueFormulaire(type) {
  const t = TYPES[type];
  const profil = getProfil() || {};
  const valeurs = { date: today(), zone: profil.zone || '', animateur: profil.nom || '', periode: today().slice(0, 7) };
  return `
    <h1>${esc(t.label)}</h1>
    <p class="muted small">Les champs marqués <span class="req">*</span> sont obligatoires. La fiche est enregistrée sur le téléphone, même sans connexion.</p>
    <form id="form-fiche" data-type="${type}" novalidate>
      <div class="grid">${t.fields.map((f) => champHtml(f, valeurs)).join('')}</div>
      <p class="form-error" id="form-error" hidden></p>
      <button class="btn" type="submit">Enregistrer la fiche</button>
      <a class="btn btn-ghost" href="#/">Annuler</a>
    </form>
  `;
}

function badge(fiche) {
  if (fiche.sync === 'synced') return '<span class="badge ok">Envoyée</span>';
  if (fiche.sync === 'error') return '<span class="badge err">Échec – sera renvoyée</span>';
  return '<span class="badge wait">En attente</span>';
}

function resume(fiche) {
  const d = fiche.data;
  if (fiche.type === 'collecte') return `${d.communaute} · ${d.activite}`;
  if (fiche.type === 'seance') return `${d.theme} · ${d.participants} participants`;
  return `${d.titre}`;
}

function vueFiches(fiches, filtres) {
  const q = (filtres.q || '').toLowerCase();
  const liste = fiches.filter((f) => {
    if (filtres.type && f.type !== filtres.type) return false;
    if (filtres.etat === 'attente' && f.sync === 'synced') return false;
    if (filtres.etat === 'envoyee' && f.sync !== 'synced') return false;
    if (q && !JSON.stringify([f.id, f.data]).toLowerCase().includes(q)) return false;
    return true;
  });
  return `
    <h1>Mes fiches</h1>
    <div class="filters">
      <input type="search" id="filtre-q" placeholder="Rechercher (zone, thème, ID…)" value="${esc(filtres.q || '')}">
      <select id="filtre-type">
        <option value="">Tous les types</option>
        ${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${filtres.type === k ? 'selected' : ''}>${t.court}</option>`).join('')}
      </select>
      <select id="filtre-etat">
        <option value="">Tous les états</option>
        <option value="attente" ${filtres.etat === 'attente' ? 'selected' : ''}>En attente</option>
        <option value="envoyee" ${filtres.etat === 'envoyee' ? 'selected' : ''}>Envoyées</option>
      </select>
    </div>
    <button class="btn btn-ghost" id="btn-export">Exporter en CSV (Excel)</button>
    <ul class="cards">
      ${liste.length ? liste.map((f) => `
        <li class="card" data-id="${esc(f.id)}">
          <div class="card-top"><b>${esc(TYPES[f.type].court)}</b> ${badge(f)}</div>
          <div>${esc(resume(f))}</div>
          <div class="muted small">${esc(f.id)} · ${formatDate(f.data.date || f.data.periode)} · ${esc(f.data.zone)}</div>
        </li>`).join('') : '<li class="empty">Aucune fiche.</li>'}
    </ul>
  `;
}

function vueParametres() {
  const p = getProfil() || {};
  const s = getSettings();
  return `
    <h1>Paramètres</h1>
    <form id="form-parametres">
      <h2>Mon profil</h2>
      <div class="field"><label for="p-nom">Nom et prénom <span class="req">*</span></label><input id="p-nom" name="nom" required value="${esc(p.nom || '')}"></div>
      <div class="field"><label for="p-role">Profil <span class="req">*</span></label>
        <select id="p-role" name="role" required>${ROLES.map((r) => `<option ${r === p.role ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label for="p-zone">Zone habituelle</label><input id="p-zone" name="zone" list="liste-zones" value="${esc(p.zone || '')}"></div>
      <div class="field"><label for="p-tel">Téléphone</label><input id="p-tel" name="telephone" type="tel" value="${esc(p.telephone || '')}"></div>

      <h2>Envoi vers Google Drive</h2>
      <div class="field"><label for="s-endpoint">Adresse du service (fournie par l’administrateur)</label>
        <input id="s-endpoint" name="endpoint" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(s.endpoint || '')}"></div>
      <div class="field"><label for="s-code">Code d’accès</label><input id="s-code" name="code" value="${esc(s.code || '')}" autocomplete="off"></div>
      <button type="button" class="btn btn-ghost" id="btn-test">Tester la connexion</button>
      <p class="muted small" id="test-resultat"></p>

      <h2>Liste des zones</h2>
      <div class="field"><label for="s-zones">Une zone par ligne</label><textarea id="s-zones" name="zones" rows="6">${esc(getZones().join('\n'))}</textarea></div>

      <button class="btn" type="submit">Enregistrer</button>
    </form>
  `;
}

// ---------- Détail d'une fiche ----------

async function ouvrirDetail(id) {
  const f = await getFiche(id);
  if (!f) return;
  const t = TYPES[f.type];
  const lignes = t.fields.map((field) => {
    let val = f.data[field.name];
    if (field.type === 'gps') {
      val = f.data.latitude ? `${f.data.latitude}, ${f.data.longitude}` : '';
    } else if (field.type === 'photo' || field.type === 'file') {
      val = f.file && f.file.champ === field.name ? `${f.file.name} (${formatTaille(f.file.size)})` : '';
    } else if (field.type === 'date' || field.type === 'month') {
      val = formatDate(val);
    }
    return val ? `<dt>${esc(field.label)}</dt><dd>${esc(val)}</dd>` : '';
  }).join('');
  $('#detail-contenu').innerHTML = `
    <h2>${esc(t.label)}</h2>
    <p>${badge(f)}</p>
    <dl>
      <dt>Identifiant</dt><dd>${esc(f.id)}</dd>
      <dt>Saisie le</dt><dd>${formatDate(f.createdAt)} par ${esc(f.auteur)}</dd>
      ${f.syncedAt ? `<dt>Envoyée le</dt><dd>${formatDate(f.syncedAt)}</dd>` : ''}
      ${f.lien ? `<dt>Fichier dans le Drive</dt><dd><a href="${esc(f.lien)}" target="_blank" rel="noopener">Ouvrir</a></dd>` : ''}
      ${f.error ? `<dt>Dernière erreur</dt><dd class="err-text">${esc(f.error)}</dd>` : ''}
      ${lignes}
    </dl>
    ${f.sync !== 'synced' ? `<button class="btn btn-danger" data-supprimer="${esc(f.id)}">Supprimer cette fiche</button>` : ''}
  `;
  $('#detail').showModal();
}

// ---------- Export CSV ----------

async function exporterCsv(filtreType) {
  const fiches = await allFiches();
  const types = filtreType ? [filtreType] : Object.keys(TYPES);
  let n = 0;
  for (const type of types) {
    const liste = fiches.filter((f) => f.type === type);
    if (!liste.length) continue;
    const champs = TYPES[type].fields.filter((f) => f.type !== 'gps');
    const entetes = ['ID', 'Saisie le', 'Auteur', 'Profil', ...champs.map((c) => c.label), 'Latitude', 'Longitude', 'État'];
    const lignes = liste.map((f) => [
      f.id, formatDate(f.createdAt), f.auteur, f.role,
      ...champs.map((c) => ((c.type === 'photo' || c.type === 'file')
        ? (f.file && f.file.champ === c.name ? f.file.name : '')
        : f.data[c.name] ?? '')),
      f.data.latitude || '', f.data.longitude || '',
      f.sync === 'synced' ? 'Envoyée' : 'En attente',
    ]);
    const csv = [entetes, ...lignes]
      .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `FSH_${TYPES[type].court}s_${today()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    n++;
  }
  toast(n ? `${n} fichier(s) CSV téléchargé(s).` : 'Aucune fiche à exporter.', n ? 'ok' : 'err');
}

// ---------- Enregistrement d'une fiche ----------

async function enregistrerFiche(form) {
  const type = form.dataset.type;
  const t = TYPES[type];
  const erreur = $('#form-error');
  erreur.hidden = true;

  const montrerErreur = (msg, champ) => {
    erreur.textContent = msg;
    erreur.hidden = false;
    if (champ) champ.focus();
  };

  for (const el of form.elements) {
    if (el.willValidate && !el.checkValidity()) {
      const label = form.querySelector(`label[for="${el.id}"]`);
      const nom = label ? label.textContent.replace('*', '').trim() : 'Un champ';
      return montrerErreur(`${nom} : ${el.validationMessage}`, el);
    }
  }

  const fd = new FormData(form);
  const data = {};
  let fichier = null;
  for (const field of t.fields) {
    if (field.type === 'gps') {
      data.latitude = fd.get('latitude') || '';
      data.longitude = fd.get('longitude') || '';
    } else if (field.type === 'photo' || field.type === 'file') {
      const file = fd.get(field.name);
      if (file && file.size) fichier = { champ: field.name, file };
    } else {
      data[field.name] = String(fd.get(field.name) ?? '').trim();
    }
  }

  if (type === 'seance') {
    const h = Number(data.hommes || 0);
    const fe = Number(data.femmes || 0);
    if (h + fe > Number(data.participants)) {
      return montrerErreur('Le total des participants est inférieur au nombre d’hommes et de femmes.', form.elements.participants);
    }
  }

  let file = null;
  if (fichier) {
    const pret = fichier.champ === 'fichier' ? fichier.file : await compresserImage(fichier.file);
    if (pret.size > MAX_FICHIER) {
      return montrerErreur(`Le fichier fait ${formatTaille(pret.size)} : la limite est de 5 Mo.`, form.elements[fichier.champ]);
    }
    file = {
      champ: fichier.champ,
      name: pret.name,
      type: pret.type || 'application/octet-stream',
      size: pret.size,
      data: await pret.arrayBuffer(),
    };
  }

  const profil = getProfil() || {};
  const fiche = {
    id: newId(t.prefixe),
    type,
    createdAt: new Date().toISOString(),
    auteur: profil.nom || '',
    role: profil.role || '',
    data,
    file,
    sync: 'pending',
  };
  await putFiche(fiche);
  toast(`Fiche ${fiche.id} enregistrée sur le téléphone.`);
  location.hash = '#/fiches';
  if (navigator.onLine) lancerSync();
}

// ---------- Routage ----------

const filtres = { q: '', type: '', etat: '' };

async function route() {
  const main = $('#main');
  const hash = location.hash || '#/';
  const fiches = await majEtat();

  if (!getProfil() && hash !== '#/parametres') {
    location.hash = '#/parametres';
    return;
  }

  document.querySelectorAll('nav a').forEach((a) => {
    a.classList.toggle('active', hash === a.getAttribute('href') || (a.getAttribute('href') === '#/nouveau' && hash.startsWith('#/nouveau')));
  });

  const m = hash.match(/^#\/nouveau\/(\w+)/);
  if (m && TYPES[m[1]]) {
    main.innerHTML = vueFormulaire(m[1]);
  } else if (hash === '#/nouveau') {
    main.innerHTML = `<h1>Nouvelle fiche</h1><div class="actions">${Object.entries(TYPES)
      .map(([k, t]) => `<a class="action" href="#/nouveau/${k}">${esc(t.label)}</a>`).join('')}</div>`;
  } else if (hash === '#/fiches') {
    main.innerHTML = vueFiches(fiches, filtres);
  } else if (hash === '#/parametres') {
    main.innerHTML = vueParametres();
    if (!getProfil()) toast('Bienvenue ! Commencez par renseigner votre profil.');
  } else {
    main.innerHTML = vueAccueil(fiches);
  }
  window.scrollTo(0, 0);
}

function remplirZones() {
  $('#liste-zones').innerHTML = getZones().map((z) => `<option value="${esc(z)}">`).join('');
}

// ---------- Événements ----------

document.addEventListener('click', async (e) => {
  const target = e.target;
  if (target.closest('#btn-sync')) {
    lancerSync(true);
  } else if (target.closest('#btn-export')) {
    exporterCsv(filtres.type);
  } else if (target.closest('[data-gps]')) {
    const info = $('[data-gps-info]');
    if (!navigator.geolocation) {
      info.textContent = 'Localisation non disponible sur cet appareil.';
      return;
    }
    info.textContent = 'Recherche de la position…';
    navigator.geolocation.getCurrentPosition((pos) => {
      const form = $('#form-fiche');
      form.elements.latitude.value = pos.coords.latitude.toFixed(6);
      form.elements.longitude.value = pos.coords.longitude.toFixed(6);
      info.textContent = `Position enregistrée (précision ${Math.round(pos.coords.accuracy)} m)`;
    }, (err) => {
      info.textContent = `Position introuvable : ${err.message}`;
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  } else if (target.closest('#btn-test')) {
    const form = $('#form-parametres');
    const out = $('#test-resultat');
    const endpoint = form.elements.endpoint.value.trim();
    const code = form.elements.code.value.trim();
    if (!endpoint || !code) {
      out.textContent = 'Renseignez l’adresse et le code.';
      return;
    }
    out.textContent = 'Test en cours…';
    try {
      const res = await testConnexion(endpoint, code);
      if (res.valide) {
        out.textContent = 'Connexion réussie : les fiches seront envoyées dans le Drive.';
        const s = getSettings();
        saveSettings({ ...s, classeur: res.classeur, dossier: res.dossier });
      } else {
        out.textContent = 'Le service répond, mais le code d’accès est incorrect.';
      }
    } catch (err) {
      out.textContent = `Échec : ${err.message}. Vérifiez l’adresse et la connexion.`;
    }
  } else if (target.closest('.card[data-id]')) {
    ouvrirDetail(target.closest('.card').dataset.id);
  } else if (target.closest('[data-supprimer]')) {
    const id = target.closest('[data-supprimer]').dataset.supprimer;
    if (confirm('Supprimer définitivement cette fiche du téléphone ?')) {
      await deleteFiche(id);
      $('#detail').close();
      toast('Fiche supprimée.');
      route();
    }
  } else if (target.closest('[data-fermer]')) {
    $('#detail').close();
  }
});

document.addEventListener('input', (e) => {
  const form = e.target.form;
  if (form && form.id === 'form-fiche' && form.dataset.type === 'seance' && ['hommes', 'femmes'].includes(e.target.name)) {
    const total = Number(form.elements.hommes.value || 0) + Number(form.elements.femmes.value || 0);
    if (total > 0) form.elements.participants.value = total;
  }
  if (e.target.id === 'filtre-q') {
    filtres.q = e.target.value;
    clearTimeout(route.timer);
    route.timer = setTimeout(async () => {
      await route();
      const input = $('#filtre-q');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 300);
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'filtre-type') { filtres.type = e.target.value; route(); }
  if (e.target.id === 'filtre-etat') { filtres.etat = e.target.value; route(); }
  if (e.target.type === 'file') {
    const info = document.querySelector(`[data-info="${e.target.name}"]`);
    const file = e.target.files[0];
    if (info) info.textContent = file ? `${file.name} – ${formatTaille(file.size)}` : '';
  }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.id === 'form-fiche') {
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await enregistrerFiche(form);
    } catch (err) {
      toast(`Enregistrement impossible : ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  } else if (form.id === 'form-parametres') {
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    localStorage.setItem(PROFIL_KEY, JSON.stringify({
      nom: fd.get('nom').trim(),
      role: fd.get('role'),
      zone: fd.get('zone').trim(),
      telephone: fd.get('telephone').trim(),
    }));
    const zones = fd.get('zones').split('\n').map((z) => z.trim()).filter(Boolean);
    saveSettings({
      ...getSettings(),
      endpoint: fd.get('endpoint').trim(),
      code: fd.get('code').trim(),
      zones,
    });
    remplirZones();
    toast('Paramètres enregistrés.');
    location.hash = '#/';
    lancerSync();
  }
});

window.addEventListener('hashchange', route);
window.addEventListener('online', () => { majEtat(); lancerSync(); });
window.addEventListener('offline', majEtat);
setInterval(() => { if (navigator.onLine) lancerSync(); }, 2 * 60 * 1000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

remplirZones();
route().then(() => { if (navigator.onLine) lancerSync(); });

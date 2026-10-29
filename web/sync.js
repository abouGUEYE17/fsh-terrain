// Envoi des fiches en attente vers le service Google Apps Script,
// qui les écrit dans le classeur et le dossier Google Drive de la FSH.

import { allFiches, putFiche } from './db.js';

const SETTINGS_KEY = 'fsh-parametres';

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function toBase64(buffer) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([buffer]));
  });
}

async function toPayload(fiche) {
  const payload = {
    id: fiche.id,
    type: fiche.type,
    createdAt: fiche.createdAt,
    auteur: fiche.auteur,
    role: fiche.role,
    data: fiche.data,
  };
  if (fiche.file && fiche.file.data) {
    payload.file = {
      name: fiche.file.name,
      type: fiche.file.type,
      size: fiche.file.size,
      data: await toBase64(fiche.file.data),
    };
  }
  return payload;
}

// Apps Script n'accepte pas les requêtes « preflight » CORS : on envoie le JSON
// en text/plain, ce qui reste une requête simple.
async function post(endpoint, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  return res.json();
}

export async function testConnexion(endpoint, code) {
  const url = new URL(endpoint);
  url.searchParams.set('code', code);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  return res.json();
}

let running = false;

export async function syncAll(onProgress) {
  if (running) return { skipped: true };
  const { endpoint, code } = getSettings();
  if (!endpoint || !code) return { error: 'config' };
  if (!navigator.onLine) return { error: 'offline' };

  running = true;
  let sent = 0;
  let failed = 0;
  try {
    const pending = (await allFiches()).filter((f) => f.sync !== 'synced');
    for (const fiche of pending) {
      let stop = false;
      try {
        const res = await post(endpoint, { code, fiche: await toPayload(fiche) });
        if (!res.ok) {
          stop = res.error === 'code';
          throw new Error(res.message || 'Réponse invalide du serveur');
        }
        fiche.sync = 'synced';
        fiche.syncedAt = new Date().toISOString();
        fiche.error = null;
        if (res.lien) fiche.lien = res.lien;
        // Le fichier est désormais dans le Drive : on libère la place sur le téléphone.
        if (fiche.file) delete fiche.file.data;
        sent++;
      } catch (err) {
        fiche.sync = 'error';
        fiche.error = err.message || String(err);
        failed++;
        if (!navigator.onLine) stop = true;
      }
      await putFiche(fiche);
      if (onProgress) onProgress({ sent, failed, total: pending.length });
      if (stop) break;
    }
  } finally {
    running = false;
  }
  if (sent > 0) {
    const settings = getSettings();
    settings.lastSync = new Date().toISOString();
    saveSettings(settings);
  }
  return { sent, failed };
}

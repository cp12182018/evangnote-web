// ─── Keys ────────────────────────────────────────────────
const KEY           = 'evangnote_contacts';
const TEMPLATES_KEY = 'evangnote_templates';
const SETTINGS_KEY  = 'evangnote_settings';

// ─── Stage definitions (matches Harvest's stage values) ──
export const STAGES = ['new', 'texting', 'invited', 'came', 'growing'];
export const STAGE_LABELS = {
  new:     'New',
  texting: 'Texting',
  invited: 'Invited',
  came:    'Came',
  growing: 'Growing',
};
export const STAGE_COLORS = {
  new:     '#9ca3af',
  texting: '#3b82f6',
  invited: '#f59e0b',
  came:    '#16a34a',
  growing: '#8b5cf6',
};

// ─── Default templates ───────────────────────────────────
export const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-1',
    title: 'First hello',
    body: 'Hi {name}, this is {me}.',
  },
  {
    id: 'tpl-2',
    title: 'Bible study invite',
    body: 'Hi {name}, it was so good talking with you today! We have a Bible study every Wednesday & Thursday evening, 7:30–9:30 PM. You are warmly welcome to come and see!',
  },
  {
    id: 'tpl-3',
    title: 'Follow up',
    body: 'Hi {name}! Just a reminder we still have a Bible Study tomorrow, would you like to come?',
  },
];

// ─── Contact migration (old EvangNote → new schema) ──────
function migrateContact(c) {
  const stage = c.stage
    ? c.stage
    : (c.came ? 'came' : 'new');

  const metOn = c.metOn != null
    ? c.metOn
    : (c.lastContacted ? new Date(c.lastContacted).getTime() : null);

  const createdAt = c.createdAt != null
    ? c.createdAt
    : new Date(c.dateAdded || Date.now()).getTime();

  const updatedAt = c.updatedAt != null
    ? c.updatedAt
    : (metOn ?? createdAt);

  return {
    id:              c.id || crypto.randomUUID(),
    name:            c.name || '',
    phone:           c.phone || '',
    metAt:           c.metAt || c.whereMet || '',
    metOn,
    lastContactedAt: c.lastContactedAt ?? metOn,
    stage,
    notes:           c.notes || '',
    prayer:          c.prayer || '',
    tags:            Array.isArray(c.tags) ? c.tags : [],
    coworkers:       Array.isArray(c.coworkers) ? c.coworkers : [],
    birthday:        c.birthday || null,
    lastReply:       c.lastReply || c.latestReply || '',
    createdAt,
    updatedAt,
  };
}

// ─── CRUD ────────────────────────────────────────────────
export function getContacts() {
  try {
    const raw = localStorage.getItem(KEY);
    const contacts = raw ? JSON.parse(raw) : [];
    return contacts.map(migrateContact);
  } catch { return []; }
}

function persist(contacts) {
  localStorage.setItem(KEY, JSON.stringify(contacts));
}

export function addContact(contact) {
  const contacts = getContacts();
  const now = Date.now();
  contacts.unshift({ ...contact, createdAt: now, updatedAt: now });
  persist(contacts);
}

export function updateContact(updated) {
  const contacts = getContacts();
  const idx = contacts.findIndex(c => c.id === updated.id);
  if (idx !== -1) contacts[idx] = { ...updated, updatedAt: Date.now() };
  persist(contacts);
}

export function deleteContact(id) {
  persist(getContacts().filter(c => c.id !== id));
}

export function deleteContacts(ids) {
  const set = new Set(ids);
  persist(getContacts().filter(c => !set.has(c.id)));
}

export function deleteAllContacts() {
  localStorage.removeItem(KEY);
}

// ─── Bulk import (dedup by phone or name) ────────────────
export function bulkAddContacts(incoming) {
  const contacts = getContacts();
  let added = 0;
  for (const c of incoming) {
    const dup = contacts.some(e =>
      (c.phone && c.phone !== 'No Phone' && e.phone === c.phone) ||
      e.name.toLowerCase() === c.name.toLowerCase()
    );
    if (!dup) { contacts.unshift(c); added++; }
  }
  persist(contacts);
  return added;
}

// ─── Name parser ("John 6.15.26" → date extracted) ───────
export function parseContactName(rawName) {
  const re = /\b(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b/;
  const m = rawName.match(re);
  if (!m) return { cleanName: rawName.trim(), metDate: null };
  let month = parseInt(m[1]), day = parseInt(m[2]), year = parseInt(m[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31)
    return { cleanName: rawName.trim(), metDate: null };
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return { cleanName: rawName.trim(), metDate: null };
  const cleanName = rawName.replace(re, '').replace(/\s+/g, ' ').trim();
  return { cleanName, metDate: date.getTime() }; // ms timestamp
}

// ─── Templates ───────────────────────────────────────────
export function getTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_TEMPLATES.map(t => ({ ...t }));
  } catch { return DEFAULT_TEMPLATES.map(t => ({ ...t })); }
}

export function saveTemplates(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function applyTemplate(body, contactName, userName) {
  return body
    .replace(/\{name\}/g, contactName || '')
    .replace(/\{me\}/g, userName || '');
}

// ─── Settings ────────────────────────────────────────────
export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { userName: '', followUpDays: 7 };
  } catch { return { userName: '', followUpDays: 7 }; }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Backup / Restore (Harvest-compatible JSON format) ───
//
// Schema v1:
// {
//   v: 1,
//   app: "evangnote" | "harvest",
//   exportedAt: ISO string,
//   userName: string,
//   souls: [
//     {
//       id, name, phone,
//       metAt,           // where we met (Harvest: metAt)
//       metOn,           // ms — when first met (Harvest: metOn)
//       lastContactedAt, // ms — last outreach (EvangNote only, Harvest ignores)
//       stage,           // "new"|"texting"|"invited"|"came"|"growing"
//       notes, prayer,
//       tags,            // string[]
//       coworkers,       // string[] names (Harvest uses coworkerIds — we use names)
//       birthday,        // ISO string | null (EvangNote only)
//       lastReply,       // ""|"Waiting"|"Replied"|"None" (EvangNote only)
//       createdAt, updatedAt
//     }
//   ],
//   coworkers: [],
//   templates: [{ id, title, body }]
// }
//
// Harvest uses integer IDs internally; we use UUIDs. Import converts on read.

export function exportBackup() {
  const contacts  = getContacts();
  const templates = getTemplates();
  const settings  = getSettings();

  const backup = {
    v:          1,
    app:        'evangnote',
    exportedAt: new Date().toISOString(),
    userName:   settings.userName,
    souls: contacts.map(c => ({
      id:              c.id,
      name:            c.name,
      phone:           c.phone,
      metAt:           c.metAt,
      metOn:           c.metOn,
      lastContactedAt: c.lastContactedAt,
      stage:           c.stage,
      notes:           c.notes,
      prayer:          c.prayer,
      tags:            c.tags,
      coworkers:       c.coworkers,
      birthday:        c.birthday,
      lastReply:       c.lastReply,
      createdAt:       c.createdAt,
      updatedAt:       c.updatedAt,
    })),
    coworkers: [],
    templates: templates.map(t => ({ id: t.id, title: t.title, body: t.body })),
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `evangnote-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackup(jsonText) {
  try {
    const data = JSON.parse(jsonText);

    // Accept "souls" (Harvest / EvangNote v2) or "contacts" (EvangNote v1)
    const souls     = data.souls || data.contacts || [];
    const templates = data.templates || [];

    const contacts = souls.map(s => migrateContact({
      id:              typeof s.id === 'string' ? s.id : crypto.randomUUID(),
      name:            s.name  || '',
      phone:           s.phone || '',
      metAt:           s.metAt || s.whereMet || '',
      metOn:           s.metOn ?? null,
      lastContactedAt: s.lastContactedAt ?? s.metOn ?? null,
      stage:           s.stage || 'new',
      notes:           s.notes || '',
      prayer:          s.prayer || '',
      tags:            s.tags || [],
      coworkers:       s.coworkers || [],
      birthday:        s.birthday || null,
      lastReply:       s.lastReply || '',
      createdAt:       s.createdAt || Date.now(),
      updatedAt:       s.updatedAt || Date.now(),
    }));

    persist(contacts);

    if (templates.length > 0) {
      saveTemplates(templates.map(t => ({
        id:    t.id    || crypto.randomUUID(),
        title: t.title || '',
        body:  t.body  || '',
      })));
    }

    if (data.userName) {
      saveSettings({ ...getSettings(), userName: data.userName });
    }

    return { success: true, count: contacts.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── vCard import ────────────────────────────────────────
export function parseVcf(text) {
  return text.split(/BEGIN:VCARD/i).slice(1).map(card => {
    const fn  = card.match(/^FN[^:]*:(.+)$/m);
    const tel = card.match(/^TEL[^:]*:(.+)$/m);
    return { name: fn?.[1]?.trim() || '', phone: tel?.[1]?.trim() || '' };
  }).filter(c => c.name.length > 0);
}

// ─── CSV import (expects header row with "name" and "phone" columns) ─
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const ni = header.findIndex(h => h.includes('name'));
  const pi = header.findIndex(h => h.includes('phone') || h.includes('tel'));
  if (ni === -1) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    return { name: cols[ni] || '', phone: pi !== -1 ? cols[pi] || '' : '' };
  }).filter(c => c.name.length > 0);
}

const KEY = 'evangnote_contacts';

export function getContacts() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(contacts) {
  localStorage.setItem(KEY, JSON.stringify(contacts));
}

export function addContact(contact) {
  const contacts = getContacts();
  contacts.unshift(contact);
  save(contacts);
}

export function updateContact(updated) {
  const contacts = getContacts();
  const idx = contacts.findIndex(c => c.id === updated.id);
  if (idx !== -1) contacts[idx] = updated;
  save(contacts);
}

export function deleteContact(id) {
  save(getContacts().filter(c => c.id !== id));
}

export function deleteContacts(ids) {
  const set = new Set(ids);
  save(getContacts().filter(c => !set.has(c.id)));
}

export function deleteAllContacts() {
  localStorage.removeItem(KEY);
}

// Returns how many were actually added (skips duplicates by phone or name)
export function bulkAddContacts(newContacts) {
  const contacts = getContacts();
  let addedCount = 0;
  for (const c of newContacts) {
    const isDup = contacts.some(existing => {
      if (c.phone && c.phone !== 'No Phone' && existing.phone === c.phone) return true;
      if (existing.name.toLowerCase() === c.name.toLowerCase()) return true;
      return false;
    });
    if (!isDup) {
      contacts.unshift(c);
      addedCount++;
    }
  }
  save(contacts);
  return addedCount;
}

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

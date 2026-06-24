import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getContacts, updateContact, deleteContact, parseContactName } from '../utils/storage'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function toInputDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [confirm, setConfirm] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const all = getContacts()
    const found = all.find(c => c.id === id)
    if (!found) { navigate('/'); return }
    setContact(found)
    setDraft(found)
  }, [id])

  if (!contact) return null

  function set(key, val) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  function save() {
    updateContact(draft)
    setContact(draft)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function cancel() {
    setDraft(contact)
    setEditing(false)
  }

  function toggleCame() {
    const updated = { ...contact, came: !contact.came }
    updateContact(updated)
    setContact(updated)
    setDraft(updated)
  }

  function extractDateFromName() {
    const { cleanName, metDate } = parseContactName(contact.name)
    const updated = {
      ...contact,
      name: cleanName,
      lastContacted: metDate || contact.lastContacted,
      latestReply: metDate && !contact.latestReply ? 'Waiting' : contact.latestReply,
    }
    updateContact(updated)
    setContact(updated)
    setDraft(updated)
  }

  function sendTextAndLog() {
    const updated = {
      ...contact,
      lastContacted: new Date().toISOString(),
      latestReply: 'Waiting',
    }
    updateContact(updated)
    setContact(updated)
    setDraft(updated)
    // Open SMS app (same as iOS "Send Text & Log Date")
    const clean = (contact.phone || '').replace(/\D/g, '')
    if (clean) window.location.href = `sms:${clean}`
  }

  function logContactNow() {
    const updated = {
      ...contact,
      lastContacted: new Date().toISOString(),
      latestReply: 'Waiting',
    }
    updateContact(updated)
    setContact(updated)
    setDraft(updated)
  }

  function handleDelete() {
    deleteContact(id)
    navigate('/')
  }

  const replyOptions = [
    { value: '', label: 'New / Not Contacted' },
    { value: 'Waiting', label: 'Waiting for reply' },
    { value: 'Replied', label: 'Replied' },
    { value: 'None', label: 'No action needed' },
  ]

  return (
    <div className="page">
      <div className="header">
        <div className="header-inner">
          <button className="back-btn" onClick={() => navigate('/')}>
            ‹ Contacts
          </button>
          <span className="header-title">{contact.name}</span>
          {editing ? (
            <button className="btn btn-ghost" onClick={save}>Save</button>
          ) : (
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </div>

      <div className="page-content" style={{ paddingTop: 8 }}>

        {saved && (
          <div style={{
            background: 'var(--green-light)',
            color: 'var(--green)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            fontSize: 14,
            marginBottom: 8,
            textAlign: 'center',
            fontWeight: 500
          }}>
            ✓ Changes saved
          </div>
        )}

        {/* Date-in-name detection banner */}
        {parseContactName(contact.name).metDate && (
          <div style={{
            background: 'var(--blue-light)', border: '1px solid #bfdbfe',
            borderRadius: 'var(--radius-sm)', padding: '10px 14px',
            marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
          }}>
            <span style={{ fontSize: 13, color: 'var(--blue-dark)' }}>
              📅 Date detected in name — extract it?
            </span>
            <button
              onClick={extractDateFromName}
              style={{
                background: 'var(--blue)', color: '#fff', border: 'none',
                borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Extract
            </button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="form-section">
          <div className="form-section-title">Quick Actions</div>
          {contact.phone && contact.phone !== 'No Phone' && (
            <button className="action-btn" onClick={sendTextAndLog}>
              <span className="action-icon">💬</span>
              Send Text &amp; Log Date
            </button>
          )}
          {contact.phone && contact.phone !== 'No Phone' && (
            <a className="action-btn" href={`tel:${contact.phone}`}>
              <span className="action-icon">📞</span>
              Call Contact
            </a>
          )}
          <button className="action-btn" onClick={logContactNow}>
            <span className="action-icon">📝</span>
            Log Contact Today (no text)
          </button>
          <button className="action-btn" onClick={toggleCame} style={{ color: contact.came ? 'var(--green)' : 'var(--gray-700)' }}>
            <span className="action-icon">{contact.came ? '✅' : '⛪'}</span>
            {contact.came ? 'Came — tap to move back' : 'Mark as Came to Church'}
          </button>
        </div>

        {/* CRM Status */}
        <div className="form-section">
          <div className="form-section-title">CRM Status</div>
          <div className="form-row">
            <span className="form-label">Last Contacted</span>
            {editing ? (
              <input
                type="date"
                className="form-input"
                value={toInputDate(draft.lastContacted)}
                onChange={e => set('lastContacted', e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
            ) : (
              <span className="form-value">
                {contact.lastContacted ? formatDate(contact.lastContacted) : '—'}
              </span>
            )}
          </div>
          <div className="form-row">
            <span className="form-label">Reply Status</span>
            {editing ? (
              <select
                className="form-select"
                value={draft.latestReply}
                onChange={e => set('latestReply', e.target.value)}
              >
                {replyOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <span className="form-value">
                {replyOptions.find(o => o.value === contact.latestReply)?.label || 'New / Not Contacted'}
              </span>
            )}
          </div>
        </div>

        {/* Personal Details */}
        <div className="form-section">
          <div className="form-section-title">Details</div>
          <div className="form-row">
            <span className="form-label">Name</span>
            {editing ? (
              <input
                className="form-input"
                value={draft.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Full name"
              />
            ) : (
              <span className="form-value">{contact.name}</span>
            )}
          </div>
          <div className="form-row">
            <span className="form-label">Phone</span>
            {editing ? (
              <input
                className="form-input"
                value={draft.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="Phone number"
                type="tel"
              />
            ) : (
              <span className="form-value">{contact.phone || '—'}</span>
            )}
          </div>
          {(contact.birthday || editing) && (
            <div className="form-row">
              <span className="form-label">Birthday</span>
              {editing ? (
                <input
                  type="date"
                  className="form-input"
                  value={toInputDate(draft.birthday)}
                  onChange={e => set('birthday', e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
              ) : (
                <span className="form-value">
                  {contact.birthday
                    ? new Date(contact.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
                    : '—'}
                </span>
              )}
            </div>
          )}
          <div className="form-row">
            <span className="form-label" style={{ color: 'var(--gray-400)', fontSize: 13 }}>Added</span>
            <span className="form-value" style={{ color: 'var(--gray-400)', fontSize: 13 }}>
              {formatDate(contact.dateAdded)}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className="form-section">
          <div className="form-section-title">Conversation Notes</div>
          <textarea
            className="form-textarea"
            value={editing ? draft.notes : contact.notes}
            onChange={e => editing && set('notes', e.target.value)}
            placeholder={editing ? 'Write notes about your conversations...' : 'No notes yet. Tap Edit to add notes.'}
            readOnly={!editing}
          />
        </div>

        {/* Delete */}
        <div className="form-section" style={{ marginTop: 24 }}>
          <button className="danger-btn" onClick={() => setConfirm(true)}>
            🗑 Delete Contact
          </button>
        </div>

        {editing && (
          <div style={{ marginTop: 16 }}>
            <button className="btn" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', width: '100%', padding: '13px' }} onClick={cancel}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {confirm && (
        <div className="overlay" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-title">Delete {contact.name}?</div>
            <div className="dialog-body">
              This contact will be permanently removed from EvangNote.
            </div>
            <div className="dialog-actions">
              <button
                className="btn"
                style={{ background: 'var(--gray-100)', color: 'var(--gray-700)' }}
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getContacts, updateContact, deleteContact, parseContactName,
  getTemplates, applyTemplate, getSettings,
  STAGES, STAGE_LABELS, STAGE_COLORS,
} from '../utils/storage'

function formatDate(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function toInputDate(ms) {
  if (!ms) return ''
  return new Date(ms).toISOString().slice(0, 10)
}

function fromInputDate(str) {
  if (!str) return null
  return new Date(str).getTime()
}

export default function ContactDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const [contact, setContact] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState({})
  const [confirm, setConfirm] = useState(false)
  const [saved, setSaved]     = useState(false)
  const [templates, setTemplates] = useState([])
  const [settings, setSettings]   = useState({ userName: '', followUpDays: 7 })
  const [showTplPicker, setShowTplPicker] = useState(false)
  const [tagInput, setTagInput]   = useState('')

  useEffect(() => {
    const all   = getContacts()
    const found = all.find(c => c.id === id)
    if (!found) { navigate('/'); return }
    setContact(found)
    setDraft(found)
    setTemplates(getTemplates())
    setSettings(getSettings())
  }, [id])

  if (!contact) return null

  function set(key, val) { setDraft(d => ({ ...d, [key]: val })) }

  function save() {
    updateContact(draft)
    setContact({ ...draft })
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function cancel() { setDraft(contact); setEditing(false); setTagInput('') }

  function logContact() {
    const now     = Date.now()
    const updated = { ...contact, lastContactedAt: now, lastReply: 'Waiting', updatedAt: now }
    updateContact(updated)
    setContact(updated)
    setDraft(updated)
  }

  function sendTextAndLog() {
    logContact()
    const clean = (contact.phone || '').replace(/\D/g, '')
    if (clean) window.location.href = `sms:${clean}`
  }

  function openSmsWithTemplate(body) {
    logContact()
    const text  = applyTemplate(body, contact.name.split(' ')[0], settings.userName)
    const clean = (contact.phone || '').replace(/\D/g, '')
    const uri   = clean
      ? `sms:${clean}?body=${encodeURIComponent(text)}`
      : `sms:?body=${encodeURIComponent(text)}`
    window.location.href = uri
    setShowTplPicker(false)
  }

  function extractDateFromName() {
    const { cleanName, metDate } = parseContactName(contact.name)
    const updated = {
      ...contact,
      name:  cleanName,
      metOn: metDate || contact.metOn,
      lastContactedAt: metDate || contact.lastContactedAt,
      lastReply: metDate && !contact.lastReply ? 'Waiting' : contact.lastReply,
    }
    updateContact(updated)
    setContact(updated)
    setDraft(updated)
  }

  function addTag() {
    const tag = tagInput.trim()
    if (!tag || draft.tags.includes(tag)) { setTagInput(''); return }
    set('tags', [...draft.tags, tag])
    setTagInput('')
  }

  function removeTag(tag) {
    set('tags', draft.tags.filter(t => t !== tag))
  }

  function handleDelete() {
    deleteContact(id)
    navigate('/')
  }

  // ── Stage stepper ──
  function StageStepper({ currentStage, onChange, readOnly }) {
    return (
      <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        {STAGES.map((s, i) => {
          const isActive  = currentStage === s
          const isPast    = STAGES.indexOf(currentStage) > i
          const color     = STAGE_COLORS[s]
          return (
            <button
              key={s}
              disabled={readOnly}
              onClick={() => !readOnly && onChange(s)}
              style={{
                flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: isActive ? 700 : 400,
                border: 'none', borderRight: i < STAGES.length - 1 ? '1px solid #e5e7eb' : 'none',
                cursor: readOnly ? 'default' : 'pointer',
                background: isActive ? color : isPast ? color + '30' : '#f9fafb',
                color: isActive ? '#fff' : isPast ? color : '#9ca3af',
                transition: 'background 0.15s',
                lineHeight: 1.3,
              }}
            >
              {STAGE_LABELS[s]}
            </button>
          )
        })}
      </div>
    )
  }

  const hasDateInName = parseContactName(contact.name).metDate !== null

  return (
    <div className="page">
      <div className="header">
        <div className="header-inner">
          <button className="back-btn" onClick={() => navigate('/')}>‹ Contacts</button>
          <span className="header-title">{contact.name}</span>
          {editing
            ? <button className="btn btn-ghost" onClick={save}>Save</button>
            : <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit</button>}
        </div>
      </div>

      <div className="page-content" style={{ paddingTop: 8 }}>

        {saved && (
          <div style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontSize: 14, marginBottom: 8, textAlign: 'center', fontWeight: 500 }}>
            ✓ Saved
          </div>
        )}

        {hasDateInName && (
          <div style={{ background: 'var(--blue-light)', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--blue-dark)' }}>📅 Date detected in name — extract it?</span>
            <button onClick={extractDateFromName} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Extract
            </button>
          </div>
        )}

        {/* ── Stage stepper ── */}
        <div className="form-section">
          <div className="form-section-title">Journey stage</div>
          <StageStepper
            currentStage={editing ? draft.stage : contact.stage}
            onChange={s => set('stage', s)}
            readOnly={!editing}
          />
          {!editing && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
              Tap <b>Edit</b> to advance stage
            </div>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div className="form-section">
          <div className="form-section-title">Actions</div>

          {/* Template picker */}
          {contact.phone && contact.phone !== 'No Phone' && (
            <div style={{ position: 'relative' }}>
              <button className="action-btn" onClick={() => setShowTplPicker(v => !v)}>
                <span className="action-icon">💬</span>
                Send Message from Template
              </button>
              {showTplPicker && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                  boxShadow: 'var(--shadow-md)', overflow: 'hidden',
                }}>
                  {templates.map(t => (
                    <button key={t.id} onClick={() => openSmsWithTemplate(t.body)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
                      <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{t.title}</div>
                      <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {applyTemplate(t.body, contact.name.split(' ')[0], settings.userName)}
                      </div>
                    </button>
                  ))}
                  <button onClick={() => setShowTplPicker(false)}
                    style={{ display: 'block', width: '100%', textAlign: 'center', padding: '10px', border: 'none', background: '#f9fafb', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {contact.phone && contact.phone !== 'No Phone' && (
            <button className="action-btn" onClick={sendTextAndLog}>
              <span className="action-icon">📱</span>
              Open SMS &amp; Log Date
            </button>
          )}
          {contact.phone && contact.phone !== 'No Phone' && (
            <a className="action-btn" href={`tel:${contact.phone}`}>
              <span className="action-icon">📞</span>
              Call
            </a>
          )}
          <button className="action-btn" onClick={logContact}>
            <span className="action-icon">📝</span>
            Log Contact (no text)
          </button>
        </div>

        {/* ── Details ── */}
        <div className="form-section">
          <div className="form-section-title">Details</div>

          <div className="form-row">
            <span className="form-label">Name</span>
            {editing
              ? <input className="form-input" value={draft.name} onChange={e => set('name', e.target.value)} />
              : <span className="form-value">{contact.name}</span>}
          </div>

          <div className="form-row">
            <span className="form-label">Phone</span>
            {editing
              ? <input className="form-input" type="tel" value={draft.phone} onChange={e => set('phone', e.target.value)} />
              : <span className="form-value">{contact.phone || '—'}</span>}
          </div>

          <div className="form-row">
            <span className="form-label">Where met</span>
            {editing
              ? <input className="form-input" placeholder="33rd St, K-Town…" value={draft.metAt} onChange={e => set('metAt', e.target.value)} />
              : <span className="form-value">{contact.metAt || '—'}</span>}
          </div>

          <div className="form-row">
            <span className="form-label">Date met</span>
            {editing
              ? <input className="form-input" type="date" value={toInputDate(draft.metOn)} onChange={e => set('metOn', fromInputDate(e.target.value))} />
              : <span className="form-value">{contact.metOn ? formatDate(contact.metOn) : '—'}</span>}
          </div>

          <div className="form-row">
            <span className="form-label">Last contact</span>
            {editing
              ? <input className="form-input" type="date" value={toInputDate(draft.lastContactedAt)} onChange={e => set('lastContactedAt', fromInputDate(e.target.value))} />
              : <span className="form-value">{contact.lastContactedAt ? formatDate(contact.lastContactedAt) : '—'}</span>}
          </div>

          <div className="form-row">
            <span className="form-label">Reply</span>
            {editing
              ? (
                <select className="form-select" value={draft.lastReply} onChange={e => set('lastReply', e.target.value)}>
                  <option value="">Not contacted</option>
                  <option value="Waiting">Waiting for reply</option>
                  <option value="Replied">Replied</option>
                  <option value="None">No action needed</option>
                </select>
              )
              : <span className="form-value">{contact.lastReply || 'Not contacted'}</span>}
          </div>

          {(contact.birthday || editing) && (
            <div className="form-row">
              <span className="form-label">Birthday</span>
              {editing
                ? <input className="form-input" type="date" value={toInputDate(fromInputDate(draft.birthday))} onChange={e => set('birthday', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                : <span className="form-value">{contact.birthday ? new Date(contact.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '—'}</span>}
            </div>
          )}

          <div className="form-row">
            <span className="form-label" style={{ color: 'var(--gray-400)', fontSize: 12 }}>Added</span>
            <span className="form-value" style={{ color: 'var(--gray-400)', fontSize: 12 }}>{formatDate(contact.createdAt)}</span>
          </div>
        </div>

        {/* ── Tags ── */}
        <div className="form-section">
          <div className="form-section-title">Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: editing ? 8 : 0 }}>
            {(editing ? draft.tags : contact.tags).map(tag => (
              <span key={tag} style={{ background: '#f3f4f6', color: '#374151', borderRadius: 99, padding: '3px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                {tag}
                {editing && (
                  <button onClick={() => removeTag(tag)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                )}
              </span>
            ))}
            {(editing ? draft.tags : contact.tags).length === 0 && !editing && (
              <span style={{ color: '#9ca3af', fontSize: 13 }}>No tags — tap Edit to add</span>
            )}
          </div>
          {editing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input" style={{ flex: 1 }}
                placeholder="Add tag (e.g. Park, Spanish, Men)…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
              />
              <button className="btn" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', padding: '8px 14px' }} onClick={addTag}>Add</button>
            </div>
          )}
        </div>

        {/* ── Prayer Requests ── */}
        <div className="form-section">
          <div className="form-section-title">🙏 Prayer Requests</div>
          <textarea
            className="form-textarea"
            value={editing ? draft.prayer : contact.prayer}
            onChange={e => editing && set('prayer', e.target.value)}
            placeholder={editing ? 'Prayer needs, personal burdens, family…' : 'No prayer notes yet. Tap Edit to add.'}
            readOnly={!editing}
          />
        </div>

        {/* ── Conversation Notes ── */}
        <div className="form-section">
          <div className="form-section-title">Conversation Notes</div>
          <textarea
            className="form-textarea"
            value={editing ? draft.notes : contact.notes}
            onChange={e => editing && set('notes', e.target.value)}
            placeholder={editing ? 'Background, questions, what you talked about, next steps…' : 'No notes yet. Tap Edit to add.'}
            readOnly={!editing}
          />
        </div>

        {/* ── Delete ── */}
        <div className="form-section" style={{ marginTop: 24 }}>
          <button className="danger-btn" onClick={() => setConfirm(true)}>🗑 Delete Contact</button>
        </div>

        {editing && (
          <div style={{ marginTop: 16 }}>
            <button className="btn" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', width: '100%', padding: 13 }} onClick={cancel}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Tap outside to close template picker */}
      {showTplPicker && (
        <div onClick={() => setShowTplPicker(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
      )}

      {confirm && (
        <div className="overlay" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-title">Delete {contact.name}?</div>
            <div className="dialog-body">This contact will be permanently removed.</div>
            <div className="dialog-actions">
              <button className="btn" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)' }} onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addContact } from '../utils/storage'

function uuid() {
  return crypto.randomUUID()
}

export default function AddContact() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', birthday: '' })
  const [error, setError] = useState('')

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    const contact = {
      id: uuid(),
      name: form.name.trim(),
      phone: form.phone.trim() || 'No Phone',
      birthday: form.birthday ? new Date(form.birthday).toISOString() : null,
      dateAdded: new Date().toISOString(),
      lastContacted: null,
      latestReply: '',
      notes: '',
    }
    addContact(contact)
    navigate('/')
  }

  return (
    <div className="page">
      <div className="header">
        <div className="header-inner">
          <button className="back-btn" onClick={() => navigate('/')}>
            ✕ Cancel
          </button>
          <span className="header-title">New Contact</span>
          <button className="btn btn-ghost" onClick={submit}>Add</button>
        </div>
      </div>

      <div className="page-content" style={{ paddingTop: 8 }}>
        <form onSubmit={submit}>
          <div className="form-section">
            <div className="form-section-title">Contact Info</div>

            <div className="form-row">
              <span className="form-label">Name *</span>
              <input
                className="form-input"
                placeholder="Full name"
                value={form.name}
                onChange={e => { set('name', e.target.value); setError('') }}
                autoFocus
              />
            </div>

            <div className="form-row">
              <span className="form-label">Phone</span>
              <input
                className="form-input"
                placeholder="Phone number (optional)"
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>

            <div className="form-row">
              <span className="form-label">Birthday</span>
              <input
                className="form-input"
                type="date"
                value={form.birthday}
                onChange={e => set('birthday', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--red-light)',
              color: 'var(--red)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 16px',
              fontSize: 14,
              marginTop: 8
            }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <button type="submit" className="btn btn-primary btn-full">
              Add to CRM
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

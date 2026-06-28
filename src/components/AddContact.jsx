import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addContact, STAGES, STAGE_LABELS, STAGE_COLORS } from '../utils/storage'

export default function AddContact() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name:    '',
    phone:   '',
    metAt:   '',
    metOn:   '',
    stage:   'new',
    prayer:  '',
    notes:   '',
    birthday: '',
  })
  const [error, setError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState([])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function addTag() {
    const tag = tagInput.trim()
    if (!tag || tags.includes(tag)) { setTagInput(''); return }
    setTags(prev => [...prev, tag])
    setTagInput('')
  }

  function removeTag(tag) { setTags(prev => prev.filter(t => t !== tag)) }

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }

    const metOnMs = form.metOn ? new Date(form.metOn).getTime() : null

    addContact({
      id:              crypto.randomUUID(),
      name:            form.name.trim(),
      phone:           form.phone.trim() || '',
      metAt:           form.metAt.trim(),
      metOn:           metOnMs,
      lastContactedAt: metOnMs,
      stage:           form.stage,
      notes:           form.notes.trim(),
      prayer:          form.prayer.trim(),
      tags,
      coworkers:       [],
      birthday:        form.birthday ? new Date(form.birthday).toISOString() : null,
      lastReply:       metOnMs ? 'Waiting' : '',
    })
    navigate('/')
  }

  return (
    <div className="page">
      <div className="header">
        <div className="header-inner">
          <button className="back-btn" onClick={() => navigate('/')}>✕ Cancel</button>
          <span className="header-title">New Contact</span>
          <button className="btn btn-ghost" onClick={submit}>Add</button>
        </div>
      </div>

      <div className="page-content" style={{ paddingTop: 8 }}>
        <form onSubmit={submit}>

          {/* ── Contact Info ── */}
          <div className="form-section">
            <div className="form-section-title">Contact Info</div>

            <div className="form-row">
              <span className="form-label">Name *</span>
              <input className="form-input" placeholder="Full name" value={form.name}
                onChange={e => { set('name', e.target.value); setError('') }} autoFocus />
            </div>

            <div className="form-row">
              <span className="form-label">Phone</span>
              <input className="form-input" type="tel" placeholder="Phone number (optional)"
                value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>

            <div className="form-row">
              <span className="form-label">Where met</span>
              <input className="form-input" placeholder="33rd St, K-Town…"
                value={form.metAt} onChange={e => set('metAt', e.target.value)} />
            </div>

            <div className="form-row">
              <span className="form-label">Date met</span>
              <input className="form-input" type="date"
                value={form.metOn} onChange={e => set('metOn', e.target.value)} />
            </div>

            <div className="form-row">
              <span className="form-label">Birthday</span>
              <input className="form-input" type="date"
                value={form.birthday} onChange={e => set('birthday', e.target.value)} />
            </div>
          </div>

          {/* ── Stage ── */}
          <div className="form-section">
            <div className="form-section-title">Stage</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STAGES.map(s => {
                const active = form.stage === s
                const color  = STAGE_COLORS[s]
                return (
                  <button key={s} type="button"
                    onClick={() => set('stage', s)}
                    style={{
                      padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: active ? 700 : 400,
                      border: `1.5px solid ${active ? color : '#e5e7eb'}`,
                      background: active ? color : '#f9fafb',
                      color: active ? '#fff' : '#6b7280',
                      cursor: 'pointer',
                    }}>
                    {STAGE_LABELS[s]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Tags ── */}
          <div className="form-section">
            <div className="form-section-title">Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {tags.map(tag => (
                <span key={tag} style={{ background: '#f3f4f6', color: '#374151', borderRadius: 99, padding: '3px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" style={{ flex: 1 }}
                placeholder="Add tag (e.g. Park, Spanish, Men)…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} />
              <button type="button" className="btn"
                style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', padding: '8px 14px' }}
                onClick={addTag}>Add</button>
            </div>
          </div>

          {/* ── Prayer ── */}
          <div className="form-section">
            <div className="form-section-title">🙏 Prayer Requests</div>
            <textarea className="form-textarea"
              placeholder="Prayer needs, personal burdens…"
              value={form.prayer} onChange={e => set('prayer', e.target.value)} />
          </div>

          {/* ── Notes ── */}
          <div className="form-section">
            <div className="form-section-title">Conversation Notes</div>
            <textarea className="form-textarea"
              placeholder="Background, questions, what you talked about…"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {error && (
            <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontSize: 14, marginTop: 8 }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 20, paddingBottom: 16 }}>
            <button type="submit" className="btn btn-primary btn-full">Add to CRM</button>
          </div>
        </form>
      </div>
    </div>
  )
}

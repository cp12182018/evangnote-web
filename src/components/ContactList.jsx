import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getContacts, deleteContacts, deleteAllContacts, bulkAddContacts } from '../utils/storage'

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
}

function statusLabel(reply) {
  if (!reply) return { label: 'New', cls: 'status-new' }
  if (reply === 'Waiting') return { label: 'Waiting', cls: 'status-waiting' }
  if (reply === 'Replied') return { label: 'Replied', cls: 'status-replied' }
  return { label: 'No action', cls: 'status-none' }
}

export default function ContactList() {
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [showRecent, setShowRecent] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [confirm, setConfirm] = useState(null) // { type: 'selected' | 'all' }
  const [menuOpen, setMenuOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncToast, setSyncToast] = useState(null) // { msg, type: 'success'|'error' }
  const menuRef = useRef(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  function load() { setContacts(getContacts()) }
  useEffect(() => { load() }, [])

  // Close menu on outside click
  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const now = Date.now()
  const filtered = contacts.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (showRecent) {
      const addedRecent = (now - new Date(c.dateAdded).getTime()) < THIRTY_DAYS
      const contactedRecent = c.lastContacted && (now - new Date(c.lastContacted).getTime()) < THIRTY_DAYS
      if (!addedRecent && !contactedRecent) return false
    }
    return true
  })

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(c => c.id)))
  }

  function exitEditMode() {
    setEditMode(false)
    setSelected(new Set())
  }

  function showToast(msg, type = 'success') {
    setSyncToast({ msg, type })
    setTimeout(() => setSyncToast(null), 3500)
  }

  function parseVcf(text) {
    return text.split(/BEGIN:VCARD/i).slice(1).map(card => {
      const fnMatch = card.match(/^FN[^:]*:(.+)$/m)
      const telMatch = card.match(/^TEL[^:]*:(.+)$/m)
      return {
        name: fnMatch ? fnMatch[1].trim() : '',
        phone: telMatch ? telMatch[1].trim() : 'No Phone',
      }
    }).filter(c => c.name.length > 0)
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseVcf(ev.target.result)
      if (parsed.length === 0) { showToast('No valid contacts found in file', 'error'); return }
      const toAdd = parsed.map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        phone: p.phone,
        birthday: null,
        dateAdded: new Date().toISOString(),
        lastContacted: null,
        latestReply: '',
        notes: '',
      }))
      const added = bulkAddContacts(toAdd)
      const skipped = toAdd.length - added
      load()
      if (added === 0) showToast(`All ${skipped} already in CRM`, 'error')
      else if (skipped === 0) showToast(`✓ ${added} contact${added !== 1 ? 's' : ''} imported`)
      else showToast(`✓ ${added} imported · ${skipped} already existed`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function syncFromContacts() {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      showToast('Open in iPhone Safari to use Sync', 'error')
      return
    }
    setSyncing(true)
    try {
      const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true })
      if (!picked || picked.length === 0) { setSyncing(false); return }
      const toAdd = picked
        .map(p => ({
          id: crypto.randomUUID(),
          name: (p.name?.[0] || '').trim(),
          phone: p.tel?.[0]?.trim() || 'No Phone',
          birthday: null,
          dateAdded: new Date().toISOString(),
          lastContacted: null,
          latestReply: '',
          notes: '',
        }))
        .filter(c => c.name.length > 0)
      const added = bulkAddContacts(toAdd)
      const skipped = toAdd.length - added
      load()
      if (added === 0) showToast(`All ${skipped} already in CRM`, 'error')
      else if (skipped === 0) showToast(`✓ ${added} contact${added !== 1 ? 's' : ''} added`)
      else showToast(`✓ ${added} added · ${skipped} already existed`)
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Sync failed. Try again.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  function confirmDeleteSelected() {
    deleteContacts([...selected])
    exitEditMode()
    load()
    setConfirm(null)
  }

  function confirmDeleteAll() {
    deleteAllContacts()
    exitEditMode()
    load()
    setConfirm(null)
  }

  return (
    <div className="page">
      <div className="header">
        <div className="header-inner">
          {editMode ? (
            <>
              <button className="btn btn-ghost" onClick={selectAll}>
                {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="header-title">
                {selected.size > 0 ? `${selected.size} Selected` : 'Select Contacts'}
              </span>
              <button className="btn btn-ghost" onClick={exitEditMode}>Done</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => setEditMode(true)}>Edit</button>
              <span className="header-title">EvangNote CRM</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {/* Sync */}
                <button
                  className="btn-icon"
                  onClick={syncFromContacts}
                  disabled={syncing}
                  title="Sync from iPhone Contacts"
                  style={{ opacity: syncing ? 0.5 : 1 }}
                >
                  {syncing ? '⏳' : '🔄'}
                </button>
                {/* Menu */}
                <div className="menu-wrap" ref={menuRef}>
                  <button className="btn-icon" onClick={() => setMenuOpen(v => !v)} title="More options">
                    ⋯
                  </button>
                  {menuOpen && (
                    <div className="menu-dropdown">
                      <button className="menu-item" onClick={() => { setMenuOpen(false); fileInputRef.current.click() }}>
                        📥 Import .vcf Contacts
                      </button>
                      <button className="menu-item danger" onClick={() => { setMenuOpen(false); setConfirm({ type: 'all' }) }}>
                        🗑 Delete All Contacts
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".vcf,text/vcard"
                    style={{ display: 'none' }}
                    onChange={handleImport}
                  />
                </div>
                {/* Add */}
                <button className="btn-icon" onClick={() => navigate('/add')} title="Add contact">
                  ＋
                </button>
              </div>
            </>
          )}
        </div>

        {/* Large title + search */}
        {!editMode && (
          <div className="header-large">
            <div className="page-title">
              Contacts
              {contacts.length > 0 && (
                <span className="count-badge"> {contacts.length}</span>
              )}
            </div>
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                placeholder="Search contacts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="page-content">
        {/* Recent toggle */}
        <div className="toggle-row">
          <span className="toggle-label">Show Recent Only (Last 30 Days)</span>
          <label className="toggle">
            <input type="checkbox" checked={showRecent} onChange={e => setShowRecent(e.target.checked)} />
            <span className="toggle-track"></span>
            <span className="toggle-thumb"></span>
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <div className="empty-title">
              {search ? 'No results' : contacts.length === 0 ? 'No contacts yet' : 'No contacts in range'}
            </div>
            <div className="empty-desc">
              {search
                ? `No contacts match "${search}"`
                : contacts.length === 0
                  ? 'Tap + to add your first evangelism contact'
                  : 'No contacts added or followed up in the last 30 days'}
            </div>
          </div>
        ) : (
          <>
            <div className="section-header">
              {showRecent ? 'Recent (Last 30 Days)' : 'All Contacts'} — {filtered.length}
            </div>
            <ul className="contact-list">
              {filtered.map(c => {
                const st = statusLabel(c.latestReply)
                return (
                  <li key={c.id} className="contact-card">
                    <div
                      className="contact-row"
                      onClick={() => {
                        if (editMode) toggleSelect(c.id)
                        else navigate(`/contact/${c.id}`)
                      }}
                    >
                      {editMode && (
                        <div className="checkbox-col">
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      )}
                      <div className="contact-avatar">{initials(c.name)}</div>
                      <div className="contact-info">
                        <div className="contact-name">{c.name}</div>
                        <div className={`contact-meta ${showRecent ? 'recent' : ''}`}>
                          Added {formatDate(c.dateAdded)}
                          {c.lastContacted && ` · Contacted ${formatDate(c.lastContacted)}`}
                        </div>
                      </div>
                      <span className={`status-badge ${st.cls}`}>{st.label}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {/* Bottom bar in edit mode */}
      {editMode && selected.size > 0 && (
        <div className="bottom-bar">
          <button
            className="btn btn-danger btn-full"
            onClick={() => setConfirm({ type: 'selected' })}
          >
            🗑 Delete {selected.size} Contact{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Sync toast */}
      {syncToast && (
        <div style={{
          position: 'fixed',
          bottom: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          background: syncToast.type === 'error' ? 'var(--gray-900)' : 'var(--green)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 24,
          fontSize: 14,
          fontWeight: 500,
          boxShadow: 'var(--shadow-md)',
          whiteSpace: 'nowrap',
          zIndex: 100,
        }}>
          {syncToast.msg}
        </div>
      )}

      {/* Confirm dialogs */}
      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-title">
              {confirm.type === 'all' ? 'Delete All Contacts?' : `Delete ${selected.size} Contact${selected.size !== 1 ? 's' : ''}?`}
            </div>
            <div className="dialog-body">
              {confirm.type === 'all'
                ? 'This will remove your entire CRM. This cannot be undone.'
                : 'The selected contacts will be permanently removed from EvangNote.'}
            </div>
            <div className="dialog-actions">
              <button className="btn" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)' }} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={confirm.type === 'all' ? confirmDeleteAll : confirmDeleteSelected}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

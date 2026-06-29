import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getContacts, deleteContacts, deleteAllContacts,
  bulkAddContacts, parseContactName, parseVcf, parseCsv,
  importBackup, exportBackup,
  STAGES, STAGE_LABELS, STAGE_COLORS,
  getSettings,
} from '../utils/storage'

const DAY_MS = 24 * 60 * 60 * 1000

function formatDate(ms) {
  if (!ms) return null
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
}

function daysSince(ms) {
  if (!ms) return null
  return Math.floor((Date.now() - ms) / DAY_MS)
}

export default function ContactList() {
  const [contacts, setContacts]       = useState([])
  const [settings, setSettings]       = useState({ userName: '', followUpDays: 7 })
  const [search, setSearch]           = useState('')
  const [activeTab, setActiveTab]     = useState('today') // 'today' | 'all'
  const [stageFilter, setStageFilter] = useState('')
  const [sortBy, setSortBy]           = useState('updated') // 'updated' | 'met' | 'name'
  const [editMode, setEditMode]       = useState(false)
  const [selected, setSelected]       = useState(new Set())
  const [confirm, setConfirm]         = useState(null)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [syncing, setSyncing]         = useState(false)
  const [toast, setToast]             = useState(null)

  const menuRef     = useRef(null)
  const vcfInputRef = useRef(null)
  const csvInputRef = useRef(null)
  const bkpInputRef = useRef(null)
  const navigate    = useNavigate()

  function load() { setContacts(getContacts()); setSettings(getSettings()) }
  useEffect(() => { load() }, [])

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Today: not contacted in followUpDays, not "growing" ──
  const followUpMs = (settings.followUpDays || 7) * DAY_MS
  const todayList = contacts.filter(c => {
    if (c.stage === 'growing') return false
    const lastMs = c.lastContactedAt || c.metOn || c.createdAt
    return !lastMs || (Date.now() - lastMs) >= followUpMs
  })

  // ── All: stage filter + search ──
  const allFiltered = contacts.filter(c => {
    if (stageFilter && c.stage !== stageFilter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const baseList = activeTab === 'today' ? todayList : allFiltered
  const sorted = [...baseList].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'met')  return (a.metOn ?? Infinity) - (b.metOn ?? Infinity)
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  })

  const stageCounts = {}
  STAGES.forEach(s => { stageCounts[s] = contacts.filter(c => c.stage === s).length })

  // ── Selection ──
  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll() {
    setSelected(selected.size === sorted.length ? new Set() : new Set(sorted.map(c => c.id)))
  }
  function exitEdit() { setEditMode(false); setSelected(new Set()) }

  function confirmDeleteSelected() { deleteContacts([...selected]); exitEdit(); load(); setConfirm(null) }
  function confirmDeleteAll()      { deleteAllContacts(); exitEdit(); load(); setConfirm(null) }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Import helpers ──
  function runImport(items, source) {
    if (!items.length) { showToast(`No contacts found in ${source}`, 'error'); return }
    const added   = bulkAddContacts(items)
    const skipped = items.length - added
    load()
    if (added === 0)   showToast(`All ${skipped} already in CRM`, 'error')
    else if (!skipped) showToast(`✓ ${added} imported from ${source}`)
    else               showToast(`✓ ${added} imported · ${skipped} skipped`)
  }

  function handleVcf(e) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseVcf(ev.target.result)
      const toAdd  = parsed.map(p => {
        const { cleanName, metDate } = parseContactName(p.name)
        return {
          id: crypto.randomUUID(), name: cleanName || p.name, phone: p.phone || '',
          metAt: '', metOn: metDate, lastContactedAt: metDate,
          stage: 'new', notes: '', prayer: '', tags: [], coworkers: [],
          birthday: null, lastReply: metDate ? 'Waiting' : '',
          createdAt: Date.now(), updatedAt: Date.now(),
        }
      })
      runImport(toAdd, '.vcf')
    }
    reader.readAsText(file); e.target.value = ''
  }

  function handleCsv(e) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseCsv(ev.target.result)
      const toAdd  = parsed.map(p => ({
        id: crypto.randomUUID(), name: p.name, phone: p.phone || '',
        metAt: '', metOn: null, lastContactedAt: null,
        stage: 'new', notes: '', prayer: '', tags: [], coworkers: [],
        birthday: null, lastReply: '',
        createdAt: Date.now(), updatedAt: Date.now(),
      }))
      runImport(toAdd, '.csv')
    }
    reader.readAsText(file); e.target.value = ''
  }

  function handleBackup(e) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const result = importBackup(ev.target.result)
      load()
      if (result.success) showToast(`✓ Restored ${result.count} contacts from backup`)
      else showToast(`Restore failed: ${result.error}`, 'error')
    }
    reader.readAsText(file); e.target.value = ''
  }

  async function syncFromContacts() {
    showToast('Contact Picker not supported on iPhone. Use Import .vcf instead.', 'error')
    return
    setSyncing(true)
    try {
      const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true })
      if (!picked?.length) { setSyncing(false); return }
      const toAdd = picked.map(p => {
        const raw = (p.name?.[0] || '').trim()
        const { cleanName, metDate } = parseContactName(raw)
        return {
          id: crypto.randomUUID(), name: cleanName || raw, phone: p.tel?.[0]?.trim() || '',
          metAt: '', metOn: metDate, lastContactedAt: metDate,
          stage: 'new', notes: '', prayer: '', tags: [], coworkers: [],
          birthday: null, lastReply: metDate ? 'Waiting' : '',
          createdAt: Date.now(), updatedAt: Date.now(),
        }
      }).filter(c => c.name)
      runImport(toAdd, 'Contacts')
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Sync failed. Try again.', 'error')
    } finally { setSyncing(false) }
  }

  // ── Stage pill ──
  function StagePill({ stage }) {
    const color = STAGE_COLORS[stage] || '#9ca3af'
    return (
      <span style={{
        background: color + '20', color, border: `1px solid ${color}50`,
        borderRadius: 99, padding: '2px 7px', fontSize: 11, fontWeight: 600,
      }}>
        {STAGE_LABELS[stage] || stage}
      </span>
    )
  }

  function AgeBadge({ c }) {
    const days = daysSince(c.lastContactedAt || c.metOn)
    if (days === null) return null
    const urgent = days >= (settings.followUpDays || 7)
    return (
      <span style={{ fontSize: 11, color: urgent ? '#ef4444' : '#9ca3af', fontWeight: urgent ? 600 : 400 }}>
        {days === 0 ? 'today' : `${days}d ago`}
      </span>
    )
  }

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="header">
        <div className="header-inner">
          {editMode ? (
            <>
              <button className="btn btn-ghost" onClick={selectAll}>
                {selected.size === sorted.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="header-title">{selected.size > 0 ? `${selected.size} Selected` : 'Select'}</span>
              <button className="btn btn-ghost" onClick={exitEdit}>Done</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => setEditMode(true)}>Edit</button>
              <span className="header-title">EvangNote</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <div className="menu-wrap" ref={menuRef}>
                  <button className="btn-icon" onClick={() => setMenuOpen(v => !v)} title="More">⋯</button>
                  {menuOpen && (
                    <div className="menu-dropdown">
                      <button className="menu-item" onClick={() => { setMenuOpen(false); vcfInputRef.current.click() }}>📇 Import .vcf (iPhone Contacts)</button>
                      <button className="menu-item" onClick={() => { setMenuOpen(false); csvInputRef.current.click() }}>📊 Import .csv</button>
                      <button className="menu-item" onClick={() => { setMenuOpen(false); bkpInputRef.current.click() }}>📥 Restore backup</button>
                      <button className="menu-item" onClick={() => { setMenuOpen(false); exportBackup() }}>🌾 Sync to Harvest</button>
                      <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
                      <button className="menu-item danger" onClick={() => { setMenuOpen(false); setConfirm({ type: 'all' }) }}>🗑 Delete All</button>
                    </div>
                  )}
                  <input ref={vcfInputRef} type="file" accept=".vcf,text/vcard"        style={{ display: 'none' }} onChange={handleVcf} />
                  <input ref={csvInputRef} type="file" accept=".csv,text/csv"          style={{ display: 'none' }} onChange={handleCsv} />
                  <input ref={bkpInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleBackup} />
                </div>
                <button className="btn-icon" onClick={() => navigate('/add')} title="Add">＋</button>
              </div>
            </>
          )}
        </div>

        {!editMode && (
          <div className="header-large">
            <div className="page-title">
              Contacts{contacts.length > 0 && <span className="count-badge"> {contacts.length}</span>}
            </div>
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder="Search contacts…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="page-content">

        {/* ── Tabs ── */}
        <div className="tab-bar">
          <button className={`tab-btn ${activeTab === 'today' ? 'tab-active' : ''}`}
            onClick={() => { setActiveTab('today'); setSelected(new Set()) }}>
            ☀️ Follow Up
            {todayList.length > 0 && <span className="tab-count">{todayList.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === 'all' ? 'tab-active' : ''}`}
            onClick={() => { setActiveTab('all'); setSelected(new Set()) }}>
            All
            {contacts.length > 0 && <span className="tab-count">{contacts.length}</span>}
          </button>
        </div>

        {/* ── Stage chips (All tab) ── */}
        {activeTab === 'all' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 0 2px' }}>
            <button className={`sort-chip ${!stageFilter ? 'sort-chip-active' : ''}`}
              onClick={() => setStageFilter('')}>All</button>
            {STAGES.map(s => (
              <button key={s}
                className={`sort-chip ${stageFilter === s ? 'sort-chip-active' : ''}`}
                style={stageFilter === s ? { background: STAGE_COLORS[s], color: '#fff', borderColor: STAGE_COLORS[s] } : {}}
                onClick={() => setStageFilter(stageFilter === s ? '' : s)}>
                {STAGE_LABELS[s]}
                {stageCounts[s] > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>{stageCounts[s]}</span>}
              </button>
            ))}
          </div>
        )}

        {/* ── Sort row ── */}
        <div className="sort-row">
          <span className="sort-label">Sort:</span>
          {[['updated','Recent'],['met','Met ↑'],['name','A–Z']].map(([val, label]) => (
            <button key={val}
              className={`sort-chip ${sortBy === val ? 'sort-chip-active' : ''}`}
              onClick={() => setSortBy(val)}>{label}</button>
          ))}
        </div>

        {activeTab === 'today' && todayList.length > 0 && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
            Not contacted in {settings.followUpDays || 7}+ days
          </div>
        )}

        {/* ── Contact list ── */}
        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{activeTab === 'today' ? '🎉' : '👥'}</div>
            <div className="empty-title">
              {activeTab === 'today' ? 'All caught up!'
                : search ? 'No results'
                : contacts.length === 0 ? 'No contacts yet'
                : 'None in this stage'}
            </div>
            <div className="empty-desc">
              {activeTab === 'today'
                ? `Everyone's been followed up in the last ${settings.followUpDays || 7} days.`
                : search ? `No contacts match "${search}"`
                : contacts.length === 0 ? 'Tap + to add your first evangelism contact'
                : 'Try a different stage filter'}
            </div>
          </div>
        ) : (
          <>
            <div className="section-header">
              {activeTab === 'today' ? 'Follow up' : stageFilter ? STAGE_LABELS[stageFilter] : 'All contacts'} — {sorted.length}
            </div>
            <ul className="contact-list">
              {sorted.map(c => (
                <li key={c.id} className="contact-card">
                  <div className="contact-row"
                    onClick={() => editMode ? toggleSelect(c.id) : navigate(`/contact/${c.id}`)}>
                    {editMode && (
                      <div className="checkbox-col">
                        <input type="checkbox" checked={selected.has(c.id)}
                          onChange={() => toggleSelect(c.id)} onClick={e => e.stopPropagation()} />
                      </div>
                    )}
                    <div className="contact-avatar"
                      style={{ background: (STAGE_COLORS[c.stage] || '#9ca3af') + '20', color: STAGE_COLORS[c.stage] || '#6b7280' }}>
                      {initials(c.name)}
                    </div>
                    <div className="contact-info">
                      <div className="contact-name">{c.name}</div>
                      <div className="contact-meta" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <StagePill stage={c.stage} />
                        {c.metOn && <span>Met {formatDate(c.metOn)}</span>}
                        <AgeBadge c={c} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {editMode && selected.size > 0 && (
        <div className="bottom-bar">
          <button className="btn btn-danger btn-full" onClick={() => setConfirm({ type: 'selected' })}>
            🗑 Delete {selected.size} Contact{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? 'var(--gray-900)' : 'var(--green)',
          color: '#fff', padding: '10px 20px', borderRadius: 24, fontSize: 14,
          fontWeight: 500, boxShadow: 'var(--shadow-md)', whiteSpace: 'nowrap', zIndex: 100,
        }}>{toast.msg}</div>
      )}

      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-title">
              {confirm.type === 'all' ? 'Delete All Contacts?' : `Delete ${selected.size} Contact${selected.size !== 1 ? 's' : ''}?`}
            </div>
            <div className="dialog-body">
              {confirm.type === 'all' ? 'This removes your entire CRM. Cannot be undone.' : 'Selected contacts will be permanently removed.'}
            </div>
            <div className="dialog-actions">
              <button className="btn" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)' }} onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirm.type === 'all' ? confirmDeleteAll : confirmDeleteSelected}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  orderBy
} from 'firebase/firestore';

export default function SuperAdminPanel({ onBack }) {
  const { t } = useTranslation();
  const { isSuperAdmin, users } = useAuth();

  const [localities, setLocalities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const emptyForm = { country: '', city: '', area: '', adminIds: [] };
  const [form, setForm] = useState(emptyForm);
  const [adminSearch, setAdminSearch] = useState('');

  // Load localities in real-time
  useEffect(() => {
    const q = query(collection(db, 'localities'), orderBy('country'), orderBy('city'));
    const unsub = onSnapshot(q, (snap) => {
      setLocalities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleEdit = (locality) => {
    setEditingId(locality.id);
    setForm({
      country: locality.country || '',
      city: locality.city || '',
      area: locality.area || '',
      adminIds: locality.adminIds || [],
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setAdminSearch('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const data = {
        country: form.country.trim(),
        city: form.city.trim(),
        area: form.area.trim(),
        adminIds: form.adminIds,
        lastUpdated: new Date().toISOString(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'localities', editingId), data);
        showMsg(t('localityUpdated'));
      } else {
        await addDoc(collection(db, 'localities'), {
          ...data,
          createdAt: new Date().toISOString(),
        });
        showMsg(t('localityAdded'));
      }
      handleCancelForm();
    } catch (err) {
      console.error('Save locality error:', err);
      showMsg(t('errorGeneral'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('deleteLocality') + '?')) return;
    try {
      await deleteDoc(doc(db, 'localities', id));
      showMsg(t('localityDeleted'));
    } catch (err) {
      console.error('Delete locality error:', err);
      showMsg(t('errorGeneral'));
    }
  };

  const toggleAdmin = (userId) => {
    setForm(prev => ({
      ...prev,
      adminIds: prev.adminIds.includes(userId)
        ? prev.adminIds.filter(id => id !== userId)
        : [...prev.adminIds, userId],
    }));
  };

  const filteredUsers = users.filter(u =>
    adminSearch === '' ||
    (u.displayName || u.name || '').toLowerCase().includes(adminSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(adminSearch.toLowerCase())
  );

  if (!isSuperAdmin()) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>⛔ Access Denied</h2>
          <p>You need Super Admin access for this panel.</p>
          <button className="btn-primary" onClick={onBack}>
            {t('dashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="super-admin-panel admin-panel">
      <div className="admin-header">
        <button className="back-btn" onClick={onBack}>
          ← {t('dashboard')}
        </button>
        <h2>👑 {t('superAdminPanel')}</h2>
      </div>

      {message && <div className="message-banner">{message}</div>}

      <div className="admin-content">
        {/* Localities Management */}
        <div className="admin-section">
          <div className="section-header-row">
            <h3>🌍 {t('localities')}</h3>
            <button
              className="btn-primary btn-sm"
              onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
            >
              + {t('addLocality')}
            </button>
          </div>

          {/* Locality Form */}
          {showForm && (
            <div className="card locality-form">
              <h4>{editingId ? t('editLocality') : t('addLocality')}</h4>
              <form onSubmit={handleSave}>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('localityCountry')}</label>
                    <input
                      type="text"
                      required
                      value={form.country}
                      onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                      placeholder="e.g. Egypt"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('localityCity')}</label>
                    <input
                      type="text"
                      required
                      value={form.city}
                      onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                      placeholder="e.g. Cairo"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('localityArea')}</label>
                    <input
                      type="text"
                      required
                      value={form.area}
                      onChange={e => setForm(p => ({ ...p, area: e.target.value }))}
                      placeholder="e.g. New Cairo"
                    />
                  </div>
                </div>

                {/* Assign Admins */}
                <div className="form-group">
                  <label>{t('assignAdmin')}</label>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                    className="search-input"
                  />
                  <div className="users-checklist">
                    {filteredUsers.slice(0, 20).map(u => (
                      <label key={u.id} className="user-check-item">
                        <input
                          type="checkbox"
                          checked={form.adminIds.includes(u.id)}
                          onChange={() => toggleAdmin(u.id)}
                        />
                        <span>{u.displayName || u.name || u.email}</span>
                        {u.role === 'admin' || u.role === 'event_admin' ? (
                          <span className="role-badge admin-badge">{t('roleAdmin')}</span>
                        ) : null}
                      </label>
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="no-results">No users found.</p>
                    )}
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={handleCancelForm}>
                    {t('eventCancel')}
                  </button>
                  <button type="submit" className="btn-primary">
                    {t('saveLocality')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Localities Table */}
          {loading ? (
            <div className="loading-container" style={{ height: 'auto', padding: '2rem' }}>
              <div className="loading-spinner"></div>
            </div>
          ) : localities.length === 0 ? (
            <div className="empty-state">
              <p>{t('noLocalities')}</p>
            </div>
          ) : (
            <div className="localities-table">
              <div className="table-header localities-header">
                <span>{t('localityCountry')}</span>
                <span>{t('localityCity')}</span>
                <span>{t('localityArea')}</span>
                <span>{t('localityAdminIds')}</span>
                <span></span>
              </div>
              {localities.map(loc => {
                const assignedAdmins = users.filter(u => (loc.adminIds || []).includes(u.id));
                return (
                  <div key={loc.id} className="table-row localities-row">
                    <span>{loc.country}</span>
                    <span>{loc.city}</span>
                    <span>{loc.area}</span>
                    <span className="admin-names">
                      {assignedAdmins.length > 0
                        ? assignedAdmins.map(a => a.displayName || a.name || a.email).join(', ')
                        : '—'}
                    </span>
                    <span className="row-actions">
                      <button
                        className="btn-secondary btn-tiny"
                        onClick={() => handleEdit(loc)}
                      >
                        ✏️ {t('editLocality')}
                      </button>
                      <button
                        className="btn-danger btn-tiny"
                        onClick={() => handleDelete(loc.id)}
                      >
                        🗑️ {t('deleteLocality')}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  orderBy, writeBatch
} from 'firebase/firestore';
import { notifyOrganizerAssigned } from '../services/emailService';

const USERS_PAGE_SIZE = 20;

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
  const [usersPageSize, setUsersPageSize] = useState(USERS_PAGE_SIZE);

  // Load localities in real-time
  useEffect(() => {
    const q = query(collection(db, 'localities'), orderBy('country'));
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
    setUsersPageSize(USERS_PAGE_SIZE);
  };

  /**
   * Sync organizerLocalityId on user documents whenever locality adminIds change.
   * Added users get organizerLocalityId set; removed users get it cleared
   * (only if it still points to this locality).
   * Also queues email notifications for newly-assigned organizers.
   */
  const syncOrganizerLocality = async (localityId, localityLabel, newAdminIds, oldAdminIds = []) => {
    const batch = writeBatch(db);
    const added = newAdminIds.filter(id => !oldAdminIds.includes(id));
    const removed = oldAdminIds.filter(id => !newAdminIds.includes(id));

    added.forEach(uid => {
      batch.update(doc(db, 'users', uid), {
        organizerLocalityId: localityId,
        organizerLocalityLabel: localityLabel,
        lastUpdated: new Date().toISOString(),
      });
    });
    removed.forEach(uid => {
      batch.update(doc(db, 'users', uid), {
        organizerLocalityId: '',
        organizerLocalityLabel: '',
        lastUpdated: new Date().toISOString(),
      });
    });

    if (added.length > 0 || removed.length > 0) {
      await batch.commit();
    }

    // Queue email notifications for newly-assigned organizers
    for (const uid of added) {
      const user = users.find(u => u.id === uid);
      if (user?.email) {
        try {
          await notifyOrganizerAssigned({
            email: user.email,
            displayName: user.displayName || user.name || '',
            localityLabel,
          });
        } catch (err) {
          console.error('Failed to queue organizer assignment email:', err);
        }
      }
    }
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
      const localityLabel = `${data.country} → ${data.city} → ${data.area}`;

      if (editingId) {
        // Determine previous adminIds to sync changes
        const prevLocality = localities.find(l => l.id === editingId);
        const oldAdminIds = prevLocality?.adminIds || [];
        await updateDoc(doc(db, 'localities', editingId), data);
        await syncOrganizerLocality(editingId, localityLabel, form.adminIds, oldAdminIds);
        showMsg(t('localityUpdated'));
      } else {
        const newRef = await addDoc(collection(db, 'localities'), {
          ...data,
          createdAt: new Date().toISOString(),
        });
        await syncOrganizerLocality(newRef.id, localityLabel, form.adminIds, []);
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
      // Clear organizerLocalityId for all admins assigned to this locality
      const locality = localities.find(l => l.id === id);
      if (locality?.adminIds?.length > 0) {
        await syncOrganizerLocality(id, '', [], locality.adminIds);
      }
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

  const visibleUsers = filteredUsers.slice(0, usersPageSize);
  const hasMoreUsers = filteredUsers.length > usersPageSize;

  if (!isSuperAdmin()) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>⛔ Access Denied</h2>
          <p>You need Master access for this panel.</p>
          <button className="btn btn-primary" onClick={onBack}>
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
        <h2>{t('superAdminPanel')}</h2>
      </div>

      {message && <div className="message-banner">{message}</div>}

      <div className="admin-content">
        {/* Localities Management */}
        <div className="admin-section">
          <div className="section-header-row">
            <h3>🌍 {t('localities')}</h3>
            <button
              className="btn btn-primary btn-sm"
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
                    {visibleUsers.map(u => (
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
                    {hasMoreUsers && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm load-more-btn"
                        onClick={() => setUsersPageSize(prev => prev + USERS_PAGE_SIZE)}
                      >
                        {t('loadMore')} ({filteredUsers.length - usersPageSize} more)
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={handleCancelForm}>
                    {t('cancelForm')}
                  </button>
                  <button type="submit" className="btn btn-primary">
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
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(loc)}
                      >
                        ✏️ {t('editLocality')}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
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

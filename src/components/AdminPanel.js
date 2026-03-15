import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  doc, updateDoc, collection, query, where,
  onSnapshot, orderBy
} from 'firebase/firestore';

function AdminPanel({ onBack }) {
  const { t } = useTranslation();
  const { userProfile, users, isAdmin, isSuperAdmin } = useAuth();

  const [memberMsg, setMemberMsg] = useState('');
  const [memberLoading, setMemberLoading] = useState(null);
  const [appeals, setAppeals] = useState([]);
  const [appealLoading, setAppealLoading] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');

  // The admin's own localityId / localityLabel
  const adminLocalityId = userProfile?.localityId || '';
  const adminLocalityLabel = userProfile?.localityLabel || userProfile?.city || t('adminLocalityNotSet');

  // Load pending appeals
  useEffect(() => {
    const q = query(
      collection(db, 'appeals'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setAppeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  if (!isAdmin()) {
    return (
      <div className="admin-panel">
        <div className="card access-denied">
          <h2>⛔ {t('errorGeneral')}</h2>
          <button className="btn btn-secondary" onClick={onBack}>{t('dashboard')}</button>
        </div>
      </div>
    );
  }

  const showMemberMsg = (msg) => {
    setMemberMsg(msg);
    setTimeout(() => setMemberMsg(''), 3000);
  };

  // Scope members to this admin's locality (if set), else show all
  const localityMembers = adminLocalityId
    ? users.filter(u => u.localityId === adminLocalityId && u.role !== 'super-admin')
    : users.filter(u => u.role !== 'super-admin');

  const pendingMembers = localityMembers.filter(u => !u.isBlocked && !u.role);
  const activeMembers = localityMembers.filter(u => !u.isBlocked);
  const blockedMembers = localityMembers.filter(u => u.isBlocked);

  const appealUsers = {};
  users.forEach(u => { appealUsers[u.id] = u; });

  const handleToggleBlock = async (user) => {
    setMemberLoading(user.id);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        isBlocked: !user.isBlocked,
        lastUpdated: new Date().toISOString(),
      });
      showMemberMsg(user.isBlocked ? t('memberUnblocked') : t('memberBlocked'));
    } catch (err) {
      console.error('Toggle block error:', err);
    } finally {
      setMemberLoading(null);
    }
  };

  const handleToggleAdmin = async (user) => {
    setMemberLoading(user.id);
    try {
      const newRole = (user.role === 'admin' || user.role === 'event_admin') ? '' : 'admin';
      await updateDoc(doc(db, 'users', user.id), {
        role: newRole,
        lastUpdated: new Date().toISOString(),
      });
      showMemberMsg(newRole === 'admin' ? t('memberPromoted') : t('memberDemoted'));
    } catch (err) {
      console.error('Toggle admin error:', err);
    } finally {
      setMemberLoading(null);
    }
  };

  const handleResolveAppeal = async (appeal, action) => {
    setAppealLoading(appeal.id);
    try {
      await updateDoc(doc(db, 'appeals', appeal.id), {
        status: action,
        reviewedAt: new Date().toISOString(),
      });
      if (action === 'approved') {
        await updateDoc(doc(db, 'users', appeal.userId), {
          isBlocked: false,
          lastUpdated: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Resolve appeal error:', err);
    } finally {
      setAppealLoading(null);
    }
  };

  const getRoleBadge = (user) => {
    if (user.role === 'super-admin') return <span className="role-badge role-badge--super">Super Admin</span>;
    if (user.role === 'admin' || user.role === 'event_admin') return <span className="role-badge role-badge--admin">{t('roleAdmin')}</span>;
    return <span className="role-badge role-badge--friend">{t('roleFriend')}</span>;
  };

  const getStatusBadge = (user) => {
    if (user.isBlocked) return <span className="status-badge status-badge--blocked">{t('accountBlocked')}</span>;
    return <span className="status-badge status-badge--active">{t('accountActive')}</span>;
  };

  const TABS = [
    { key: 'pending', label: t('adminPendingApprovals'), count: pendingMembers.length },
    { key: 'members', label: t('adminMembers'), count: activeMembers.length },
    { key: 'blocked', label: t('adminBlockedMembers'), count: blockedMembers.length },
    { key: 'appeals', label: t('adminAppeals'), count: appeals.length },
  ];

  const renderMemberRow = (user) => (
    <div key={user.id} className="member-row">
      <div className="member-info">
        <div className="member-avatar">
          {user.photoURL
            ? <img src={user.photoURL} alt={user.displayName || user.name} className="member-photo" />
            : <div className="avatar-placeholder avatar-placeholder--sm">{(user.displayName || user.name || '?')[0].toUpperCase()}</div>
          }
        </div>
        <div className="member-details">
          <p className="member-name">{user.displayName || user.name || '—'}</p>
          {user.fullName && user.fullName !== (user.displayName || user.name) && (
            <p className="member-fullname">{user.fullName}</p>
          )}
          <p className="member-email">{user.email || '—'}</p>
          {user.phoneNumber && <p className="member-phone">📞 {user.phoneNumber}</p>}
          {user.localityLabel && <p className="member-locality">📍 {user.localityLabel}</p>}
        </div>
        <div className="member-badges">
          {getRoleBadge(user)}
          {getStatusBadge(user)}
        </div>
      </div>
      <div className="member-actions">
        {!isSuperAdmin() && (user.role === 'super-admin') ? null : (
          <>
            <button
              className={`btn btn-sm ${user.role === 'admin' || user.role === 'event_admin' ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => handleToggleAdmin(user)}
              disabled={memberLoading === user.id}
            >
              {user.role === 'admin' || user.role === 'event_admin' ? t('removeAdmin') : t('promoteToAdmin')}
            </button>
            <button
              className={`btn btn-sm ${user.isBlocked ? 'btn-secondary' : 'btn-danger'}`}
              onClick={() => handleToggleBlock(user)}
              disabled={memberLoading === user.id}
            >
              {user.isBlocked ? t('unblockMember') : t('blockMember')}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <button className="btn btn-secondary" onClick={onBack}>← {t('dashboard')}</button>
        <h2>⚙️ {t('adminPanel')}</h2>
      </div>

      {memberMsg && <div className="message-banner">{memberMsg}</div>}

      {/* Locality Summary */}
      <div className="card locality-summary">
        <div className="locality-summary-inner">
          <span className="locality-icon">📍</span>
          <div>
            <p className="locality-summary-label">{t('adminLocalitySummary')}</p>
            <p className="locality-summary-value">{adminLocalityLabel}</p>
          </div>
          <div className="locality-stats">
            <span className="stat-pill">{localityMembers.length} {t('adminAllMembers')}</span>
            {pendingMembers.length > 0 && (
              <span className="stat-pill stat-pill--warning">{pendingMembers.length} {t('adminPendingApprovals')}</span>
            )}
            {blockedMembers.length > 0 && (
              <span className="stat-pill stat-pill--danger">{blockedMembers.length} {t('adminBlockedMembers')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`admin-tab ${activeTab === tab.key ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Pending Approvals */}
      {activeTab === 'pending' && (
        <div className="card admin-section">
          <h3>{t('adminPendingApprovals')}</h3>
          {pendingMembers.length === 0 ? (
            <p className="empty-state-inline">{t('adminNoPending')}</p>
          ) : (
            <div className="members-list">
              {pendingMembers.map(renderMemberRow)}
            </div>
          )}
        </div>
      )}

      {/* Active Members */}
      {activeTab === 'members' && (
        <div className="card admin-section">
          <h3>{t('adminMembers')}</h3>
          {activeMembers.length === 0 ? (
            <p className="empty-state-inline">{t('adminNoMembers')}</p>
          ) : (
            <div className="members-list">
              {activeMembers.map(renderMemberRow)}
            </div>
          )}
        </div>
      )}

      {/* Blocked Members */}
      {activeTab === 'blocked' && (
        <div className="card admin-section">
          <h3>{t('adminBlockedMembers')}</h3>
          {blockedMembers.length === 0 ? (
            <p className="empty-state-inline">{t('adminNoBlocked')}</p>
          ) : (
            <div className="members-list">
              {blockedMembers.map(renderMemberRow)}
            </div>
          )}
        </div>
      )}

      {/* Appeals */}
      {activeTab === 'appeals' && (
        <div className="card admin-section">
          <h3>{t('adminAppeals')}</h3>
          {appeals.length === 0 ? (
            <p className="empty-state-inline">{t('noAppeals')}</p>
          ) : (
            <div className="appeals-list">
              {appeals.map(appeal => {
                const user = appealUsers[appeal.userId];
                return (
                  <div key={appeal.id} className="appeal-item card">
                    <div className="appeal-header">
                      <div className="appeal-user">
                        <span className="appeal-user-name">{user?.displayName || user?.name || appeal.userId}</span>
                        {user?.email && <span className="appeal-user-email">{user.email}</span>}
                        {user && getStatusBadge(user)}
                      </div>
                      <span className="appeal-date">{appeal.createdAt ? new Date(appeal.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                    <p className="appeal-message">{appeal.message}</p>
                    <div className="appeal-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleResolveAppeal(appeal, 'approved')}
                        disabled={appealLoading === appeal.id}
                      >
                        ✅ {t('approveAppeal')}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleResolveAppeal(appeal, 'rejected')}
                        disabled={appealLoading === appeal.id}
                      >
                        ❌ {t('rejectAppeal')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminPanel;

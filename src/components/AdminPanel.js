import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { shuffleTables, assignUsersToTables, getTableDistributionStats } from '../algorithms/tableAssignment';
import { db } from '../firebase';
import { doc, writeBatch, updateDoc, getDoc } from 'firebase/firestore';

function AdminPanel({ onBack }) {
  const { users, tables, settings, updateSettings, isAdmin, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    maxPeoplePerTable: settings.maxPeoplePerTable || 5,
    considerLocation: settings.considerLocation || false
  });

  // Redirect if not admin
  if (!isAdmin()) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>⛔ Access Denied</h2>
          <p>You don't have permission to access the admin panel.</p>
          <button className="btn-primary" onClick={onBack}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettingsForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const newSettings = {
        ...settings,
        maxPeoplePerTable: parseInt(settingsForm.maxPeoplePerTable),
        considerLocation: settingsForm.considerLocation
      };
      
      await updateSettings(newSettings);
      alert('Settings updated successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShuffleTables = async () => {
    if (!window.confirm('Are you sure you want to shuffle all table assignments? This will randomly reassign all users.')) {
      return;
    }

    try {
      setLoading(true);
      
      const shuffledTables = shuffleTables(tables, settings.maxPeoplePerTable);
      
      // Save shuffled tables to Firebase
      const batch = writeBatch(db);
      
      // Clear existing tables
      tables.forEach(table => {
        const tableRef = doc(db, 'tables', table.id);
        batch.delete(tableRef);
      });
      
      // Create shuffled tables
      shuffledTables.forEach(table => {
        const tableRef = doc(db, 'tables', table.id);
        batch.set(tableRef, table);
      });
      
      await batch.commit();
      alert('Tables shuffled successfully!');
    } catch (error) {
      console.error('Error shuffling tables:', error);
      alert('Failed to shuffle tables. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReassignAll = async () => {
    if (!window.confirm('Are you sure you want to reassign all users? This will create new table assignments from scratch.')) {
      return;
    }

    try {
      setLoading(true);
      
      const allUsers = users.filter(user => user.id);
      const newTables = assignUsersToTables(allUsers, settings, []);
      
      // Save new tables to Firebase
      const batch = writeBatch(db);
      
      // Clear existing tables
      tables.forEach(table => {
        const tableRef = doc(db, 'tables', table.id);
        batch.delete(tableRef);
      });
      
      // Create new tables
      newTables.forEach(table => {
        const tableRef = doc(db, 'tables', table.id);
        batch.set(tableRef, table);
      });
      
      await batch.commit();
      alert('All users reassigned successfully!');
    } catch (error) {
      console.error('Error reassigning users:', error);
      alert('Failed to reassign users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllTables = async () => {
    if (!window.confirm('Are you sure you want to clear all table assignments? This cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      
      const batch = writeBatch(db);
      
      tables.forEach(table => {
        const tableRef = doc(db, 'tables', table.id);
        batch.delete(tableRef);
      });
      
      await batch.commit();
      alert('All tables cleared successfully!');
    } catch (error) {
      console.error('Error clearing tables:', error);
      alert('Failed to clear tables. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAllUsers = async () => {
    const action = window.prompt(
      'Choose action:\n1. Clear tables only (users stay logged in)\n2. Clear tables and mark users for logout\n\nEnter 1 or 2:'
    );

    if (action !== '1' && action !== '2') return;

    const confirmMessage = action === '1' 
      ? 'This will clear all table assignments but keep users logged in. Continue?'
      : 'This will clear all tables AND mark all users for logout. Users will need to sign in again. Continue?';

    if (!window.confirm(confirmMessage)) return;

    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      // Clear all tables
      tables.forEach(table => {
        const tableRef = doc(db, 'tables', table.id);
        batch.delete(tableRef);
      });
      
      // If option 2, also clear all user sessions by deleting user documents
      if (action === '2') {
        users.forEach(user => {
          const userRef = doc(db, 'users', user.id);
          batch.delete(userRef);
        });
      }
      
      await batch.commit();
      
      const successMessage = action === '1' 
        ? 'All tables cleared! Users remain logged in and can request new table assignments.'
        : 'All tables and user sessions cleared! Users will need to sign in again.';
        
      alert(successMessage);
    } catch (error) {
      console.error('Error resetting users:', error);
      alert('Failed to reset users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Role management functions (Super Admin only)
  const handleSetUserRole = async (userId, role) => {
    console.log('🔄 Attempting to set role:', { userId, role });
    
    if (!isSuperAdmin()) {
      alert('Only super admins can manage user roles.');
      return;
    }

    const user = users.find(u => u.id === userId);
    console.log('👤 Found user:', user);

    const confirmMessage = role === '' 
      ? `Remove admin privileges from ${user?.displayName || user?.name || 'this user'}?` 
      : `Make ${user?.displayName || user?.name || 'this user'} a ${role}?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setLoading(true);
      
      console.log('💾 Updating Firestore document...');
      // Update the user's role directly in Firestore using updateDoc
      const userDocRef = doc(db, 'users', userId);
      
      // Check if document exists first
      const docSnapshot = await getDoc(userDocRef);
      if (!docSnapshot.exists()) {
        console.error('❌ User document does not exist:', userId);
        alert('Error: User document not found. Please try again.');
        return;
      }
      
      const updateData = { 
        role: role,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('📝 Update data:', updateData);
      console.log('📍 Document reference:', userDocRef.path);
      console.log('📄 Current document data:', docSnapshot.data());
      
      // Use updateDoc instead of setDoc for better reliability
      await updateDoc(userDocRef, updateData);
      
      console.log('✅ Document updated successfully');
      
      const successMessage = role === '' 
        ? 'Admin privileges removed successfully!' 
        : `User promoted to ${role} successfully!`;
        
      alert(successMessage);
      
      // Force a refresh of the users list to see the change immediately
      console.log('✅ Role updated successfully for user:', userId, 'to role:', role);
    } catch (error) {
      console.error('❌ Error updating user role:', error);
      alert('Failed to update user role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getUserRoleDisplay = (user) => {
    console.log('🏷️ Display role for user:', user.displayName || user.name, 'role:', user.role);
    if (user.role === 'super-admin') return '👑 Super Admin';
    if (user.role === 'admin') return '🔧 Admin';
    return user.isAnonymous ? 'Name-based' : 'Google';
  };

  const getUserRoleActions = (user) => {
    if (!isSuperAdmin()) return null;
    
    // Don't show role actions for the current super admin (prevent self-demotion)
    if (user.role === 'super-admin') return null;
    
    return (
      <div className="role-actions">
        {user.role === 'admin' ? (
          <button
            className="btn-small btn-warning"
            onClick={() => handleSetUserRole(user.id, '')}
            disabled={loading}
            title="Remove admin privileges"
          >
            ⬇️ Demote
          </button>
        ) : (
          <button
            className="btn-small btn-success"
            onClick={() => handleSetUserRole(user.id, 'admin')}
            disabled={loading}
            title="Make admin"
          >
            ⬆️ Make Admin
          </button>
        )}
      </div>
    );
  };

  const stats = getTableDistributionStats(users.length, settings.maxPeoplePerTable);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h2>🔧 Admin Panel</h2>
      </div>

      <div className="admin-content">
        {/* Statistics Section */}
        <div className="admin-section">
          <h3>📊 Current Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Users</h4>
              <p className="stat-number">{users.length}</p>
            </div>
            <div className="stat-card">
              <h4>Active Tables</h4>
              <p className="stat-number">{tables.length}</p>
            </div>
            <div className="stat-card">
              <h4>Assigned Users</h4>
              <p className="stat-number">
                {tables.reduce((total, table) => total + table.members.length, 0)}
              </p>
            </div>
            <div className="stat-card">
              <h4>Unassigned Users</h4>
              <p className="stat-number">
                {users.length - tables.reduce((total, table) => total + table.members.length, 0)}
              </p>
            </div>
          </div>

          <div className="optimal-distribution">
            <h4>Optimal Distribution</h4>
            <p>With {users.length} users and max {settings.maxPeoplePerTable} per table:</p>
            <ul>
              <li>Recommended tables: {stats.totalTables}</li>
              <li>Average people per table: {stats.averagePeoplePerTable}</li>
              <li>Tables with {stats.averagePeoplePerTable + 1} people: {stats.tablesWithExtraPerson}</li>
              <li>Tables with {stats.averagePeoplePerTable} people: {stats.tablesWithNormalCount}</li>
            </ul>
          </div>
        </div>

        {/* Settings Section */}
        <div className="admin-section">
          <h3>⚙️ Settings</h3>
          <form onSubmit={handleSaveSettings} className="settings-form">
            <div className="form-group">
              <label htmlFor="maxPeoplePerTable">Maximum People per Table</label>
              <input
                type="number"
                id="maxPeoplePerTable"
                name="maxPeoplePerTable"
                value={settingsForm.maxPeoplePerTable}
                onChange={handleSettingsChange}
                min="2"
                max="20"
                required
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="considerLocation"
                  checked={settingsForm.considerLocation}
                  onChange={handleSettingsChange}
                />
                Consider user location when assigning tables
              </label>
            </div>

            <div className="form-note">
              <p><strong>Note:</strong> Admin access is now controlled by user roles. Set user.role to 'admin' or 'super-admin' in Firestore to grant admin privileges.</p>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* Table Management Section */}
        <div className="admin-section">
          <h3>🍽️ Table Management</h3>
          <div className="table-actions">
            <button 
              className="btn-primary"
              onClick={handleReassignAll}
              disabled={loading}
            >
              {loading ? 'Processing...' : '🎲 Reassign All Users'}
            </button>
            
            <button 
              className="btn-secondary"
              onClick={handleShuffleTables}
              disabled={loading || tables.length === 0}
            >
              {loading ? 'Processing...' : '🔀 Shuffle Existing Tables'}
            </button>
            
            <button 
              className="btn-danger"
              onClick={handleClearAllTables}
              disabled={loading || tables.length === 0}
            >
              {loading ? 'Processing...' : '🗑️ Clear All Tables'}
            </button>
            
            <button 
              className="btn-danger"
              onClick={handleResetAllUsers}
              disabled={loading}
              style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
            >
              {loading ? 'Processing...' : '🚪 Reset All Users'}
            </button>
          </div>
          
          <div className="action-descriptions">
            <div className="action-desc">
              <strong>Reassign All:</strong> Creates completely new table assignments using the current algorithm
            </div>
            <div className="action-desc">
              <strong>Shuffle Tables:</strong> Randomly redistributes users among existing tables
            </div>
            <div className="action-desc">
              <strong>Clear All:</strong> Removes all table assignments (users will need to get reassigned)
            </div>
            <div className="action-desc">
              <strong>Reset All Users:</strong> Option to clear tables only OR clear tables and force all users to sign in again
            </div>
          </div>
        </div>

        {/* User Management Section */}
        <div className="admin-section">
          <h3>👥 User Management</h3>
          <div className="users-table">
            <div className={`table-header ${isSuperAdmin() ? 'super-admin' : ''}`}>
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Table</span>
              <span>Location</span>
              {isSuperAdmin() && <span>Actions</span>}
            </div>
            {users.map(user => {
              const userTable = tables.find(table => 
                table.members && table.members.some(member => member.id === user.id)
              );
              
              return (
                <div key={user.id} className={`table-row ${isSuperAdmin() ? 'super-admin' : ''}`}>
                  <span className="user-name">
                    {user.displayName || user.name || 'Unknown'}
                    {user.fullName && user.fullName !== user.displayName && (
                      <small> ({user.fullName})</small>
                    )}
                  </span>
                  <span className="user-email">{user.email || 'No email'}</span>
                  <span className="user-role">
                    {getUserRoleDisplay(user)}
                  </span>
                  <span className="user-table">
                    {userTable ? userTable.name : 'Unassigned'}
                  </span>
                  <span className="user-location">
                    {user.location ? 
                      `${user.location.latitude.toFixed(2)}, ${user.location.longitude.toFixed(2)}` : 
                      'No location'
                    }
                  </span>
                  {isSuperAdmin() && (
                    <span className="user-actions">
                      {getUserRoleActions(user)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          {users.length === 0 && (
            <div className="no-users">
              <p>No users have signed up yet.</p>
            </div>
          )}
        </div>

        {/* Current Tables Section */}
        <div className="admin-section">
          <h3>📋 Current Table Assignments</h3>
          {tables.length > 0 ? (
            <div className="admin-tables-list">
              {tables.map(table => (
                <div key={table.id} className="admin-table-card">
                  <div className="admin-table-header">
                    <h4>{table.name}</h4>
                    <span className="table-count">
                      {table.members.length}/{settings.maxPeoplePerTable} people
                    </span>
                  </div>
                  <div className="admin-table-members">
                    {table.members.map(member => (
                      <div key={member.id} className="admin-member">
                        <span className="member-name">{member.name}</span>
                        {member.fullName && member.fullName !== member.name && (
                          <span className="member-full-name">({member.fullName})</span>
                        )}
                        {member.gender && (
                          <span className="member-gender">{member.gender}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-tables">
              <p>No tables have been created yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
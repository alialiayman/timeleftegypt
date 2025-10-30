import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { shuffleTables, assignUsersToTables, getTableDistributionStats } from '../algorithms/tableAssignment';
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';

function AdminPanel({ onBack }) {
  const { users, tables, settings, updateSettings, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    maxPeoplePerTable: settings.maxPeoplePerTable || 5,
    considerLocation: settings.considerLocation || false,
    adminEmails: (settings.adminEmails || []).join(', ')
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
        considerLocation: settingsForm.considerLocation,
        adminEmails: settingsForm.adminEmails
          .split(',')
          .map(email => email.trim())
          .filter(email => email.length > 0)
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

            <div className="form-group">
              <label htmlFor="adminEmails">Admin Email Addresses (comma-separated)</label>
              <textarea
                id="adminEmails"
                name="adminEmails"
                value={settingsForm.adminEmails}
                onChange={handleSettingsChange}
                rows="3"
                placeholder="admin@example.com, admin2@example.com"
              />
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
          </div>
        </div>

        {/* User Management Section */}
        <div className="admin-section">
          <h3>👥 User Management</h3>
          <div className="users-table">
            <div className="table-header">
              <span>Name</span>
              <span>Email</span>
              <span>Type</span>
              <span>Table</span>
              <span>Location</span>
            </div>
            {users.map(user => {
              const userTable = tables.find(table => 
                table.members && table.members.some(member => member.id === user.id)
              );
              
              return (
                <div key={user.id} className="table-row">
                  <span className="user-name">
                    {user.displayName || user.name || 'Unknown'}
                    {user.fullName && user.fullName !== user.displayName && (
                      <small> ({user.fullName})</small>
                    )}
                  </span>
                  <span className="user-email">{user.email || 'No email'}</span>
                  <span className="user-type">
                    {user.isAnonymous ? 'Name-based' : 'Google'}
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
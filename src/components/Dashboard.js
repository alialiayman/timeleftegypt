import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { assignUsersToTables, moveUserBetweenTables } from '../algorithms/tableAssignment';
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';

function Dashboard({ setCurrentView }) {
  const { 
    currentUser, 
    userProfile, 
    users, 
    tables, 
    settings, 
    logout, 
    isAdmin
  } = useAuth();
  
  const [myTable, setMyTable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTableSelection, setShowTableSelection] = useState(false);

  // Find current user's table
  useEffect(() => {
    console.log('Dashboard useEffect - currentUser:', currentUser);
    console.log('Dashboard useEffect - tables:', tables);
    console.log('Dashboard useEffect - users:', users);
    console.log('Dashboard useEffect - settings:', settings);
    console.log('Dashboard useEffect - userProfile:', userProfile);
    
    if (currentUser && tables.length > 0) {
      console.log('Looking for user table for currentUser.uid:', currentUser.uid);
      const userTable = tables.find(table => {
        console.log('Checking table:', table);
        return table.members && table.members.some(member => {
          console.log('Checking member:', member, 'against uid:', currentUser.uid);
          return member.id === currentUser.uid;
        });
      });
      console.log('Found user table:', userTable);
      setMyTable(userTable);
    } else {
      console.log('No currentUser or no tables available');
      setMyTable(null);
    }
  }, [currentUser, tables, users, settings, userProfile]);

  const handleLogout = async () => {
    const confirmMessage = myTable 
      ? `Are you sure you want to logout?\n\nYou will be removed from ${myTable.name} and other participants will be notified.`
      : 'Are you sure you want to logout?';
      
    if (window.confirm(confirmMessage)) {
      try {
        await logout();
      } catch (error) {
        console.error('Error during logout:', error);
        alert('There was an error during logout. Please try again.');
      }
    }
  };

  const handleAssignTable = async () => {
    console.log('handleAssignTable called');
    console.log('currentUser:', currentUser);
    console.log('userProfile:', userProfile);
    
    if (!currentUser || !userProfile) {
      console.error('Missing currentUser or userProfile');
      alert('Please complete your profile first before getting a table assignment.');
      return;
    }

    try {
      setLoading(true);
      console.log('Starting table assignment process');
      
      // Get all users including current user
      let allUsers = users.filter(user => user.id); // Filter out any invalid users
      console.log('Existing users from database:', allUsers);
      
      // Add current user if not in the users list
      const currentUserInList = allUsers.find(user => user.id === currentUser.uid);
      if (!currentUserInList) {
        const currentUserData = {
          id: currentUser.uid,
          email: currentUser.email || '',
          displayName: userProfile.displayName || userProfile.name || currentUser.displayName || '',
          name: userProfile.name || userProfile.displayName || currentUser.displayName || '',
          fullName: userProfile.fullName || '',
          photoURL: userProfile.photoURL || currentUser.photoURL || '',
          gender: userProfile.gender || '',
          preferences: userProfile.preferences || {},
          location: userProfile.location || null,
          isAnonymous: userProfile.isAnonymous || currentUser.isAnonymous
        };
        allUsers.push(currentUserData);
        console.log('Added current user to users list:', currentUserData);
      } else {
        console.log('Current user already in users list');
      }

      console.log('Final users list for assignment:', allUsers);
      console.log('Current settings:', settings);
      console.log('Existing tables:', tables);

      // Test the algorithm with simple data first
      const testUsers = [
        { id: '1', name: 'Test User 1', displayName: 'Test User 1' },
        { id: '2', name: 'Test User 2', displayName: 'Test User 2' },
        { id: currentUser.uid, name: userProfile.displayName, displayName: userProfile.displayName }
      ];
      const testSettings = { maxPeoplePerTable: 5, considerLocation: false };
      
      console.log('Testing algorithm with simple data...');
      const testTables = assignUsersToTables(testUsers, testSettings, []);
      console.log('Algorithm test result:', testTables);

      // Now try with real data
      const newTables = assignUsersToTables(allUsers, settings, tables);
      
      console.log('Generated tables with real data:', newTables);

      if (!newTables || newTables.length === 0) {
        console.error('No tables generated');
        alert('Failed to generate table assignments. Please try again.');
        return;
      }

      // Save tables to Firebase
      const batch = writeBatch(db);
      
      // Clear existing tables
      if (tables && tables.length > 0) {
        console.log('Clearing existing tables:', tables.length);
        tables.forEach(table => {
          const tableRef = doc(db, 'tables', table.id);
          batch.delete(tableRef);
        });
      }
      
      // Create new tables
      console.log('Creating new tables:', newTables.length);
      newTables.forEach(table => {
        const tableRef = doc(db, 'tables', table.id);
        batch.set(tableRef, table);
        console.log('Added table to batch:', table);
      });
      
      await batch.commit();
      console.log('Tables saved to Firestore successfully');
      
    } catch (error) {
      console.error('Error assigning table:', error);
      alert(`Failed to assign table: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeTable = async (newTableId) => {
    if (!currentUser || !myTable) return;

    try {
      setLoading(true);
      
      const result = moveUserBetweenTables(
        tables, 
        currentUser.uid, 
        myTable.id, 
        newTableId, 
        settings.maxPeoplePerTable
      );
      
      if (!result.success) {
        alert(result.message);
        return;
      }
      
      // Save updated tables to Firebase
      const batch = writeBatch(db);
      
      result.tables.forEach(table => {
        const tableRef = doc(db, 'tables', table.id);
        batch.set(tableRef, table);
      });
      
      await batch.commit();
      setShowTableSelection(false);
      
    } catch (error) {
      console.error('Error changing table:', error);
      alert('Failed to change table. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getLocationDisplay = (user) => {
    if (!user.location) return 'Location not available';
    return `${user.location.latitude.toFixed(3)}, ${user.location.longitude.toFixed(3)}`;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="user-info">
          <div className="user-avatar">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="Profile" />
            ) : (
              <div className="avatar-placeholder">
                {(userProfile?.displayName || userProfile?.name || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="user-details">
            <h2>{userProfile?.displayName || userProfile?.name || 'User'}</h2>
            {userProfile?.fullName && userProfile.fullName !== userProfile.displayName && (
              <p className="full-name">{userProfile.fullName}</p>
            )}
            <p className="location">📍 {getLocationDisplay(userProfile || {})}</p>
            {userProfile?.gender && (
              <p className="gender">Gender: {userProfile.gender}</p>
            )}
          </div>
          <div className="user-actions">
            <button 
              className="btn-secondary"
              onClick={() => setCurrentView('profile')}
            >
              Edit Profile
            </button>
            <button 
              className="btn-danger"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="table-assignment-section">
        <h3>Your Table Assignment</h3>
        
        {!myTable ? (
          <div className="no-table-assigned">
            <div className="no-table-card">
              <h4>🎲 No Table Assigned Yet</h4>
              <p>Click the button below to get assigned to a dining table where you'll meet other candidates!</p>
              <button 
                className="btn-primary"
                onClick={handleAssignTable}
                disabled={loading}
              >
                {loading ? 'Assigning...' : '🍽️ Get My Table Assignment'}
              </button>
            </div>
          </div>
        ) : (
          <div className="table-assigned">
            <div className="table-card">
              <div className="table-header">
                <h4>🍽️ {myTable.name}</h4>
                <span className="table-occupancy">
                  {myTable.members.length}/{settings.maxPeoplePerTable} people
                </span>
              </div>
              
              <div className="table-members">
                <h5>Your table companions:</h5>
                <div className="members-list">
                  {myTable.members.map(member => (
                    <div key={member.id} className={`member-card ${member.id === currentUser.uid ? 'current-user' : ''}`}>
                      <div className="member-avatar">
                        {member.photoURL ? (
                          <img 
                            src={member.photoURL} 
                            alt={member.name}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="avatar-placeholder"
                          style={{ display: member.photoURL ? 'none' : 'flex' }}
                        >
                          {(member.name || 'U')[0].toUpperCase()}
                        </div>
                      </div>
                      <div className="member-info">
                        <p className="member-name">
                          {member.name}
                          {member.id === currentUser.uid && <span className="you-badge"> (You)</span>}
                        </p>
                        {member.fullName && member.fullName !== member.name && (
                          <p className="member-full-name">{member.fullName}</p>
                        )}
                        {member.gender && (
                          <p className="member-gender">{member.gender}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="table-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => setShowTableSelection(true)}
                  disabled={loading}
                >
                  Change Table
                </button>
                {isAdmin() && (
                  <button 
                    className="btn-primary"
                    onClick={() => setCurrentView('admin')}
                  >
                    Admin Panel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Selection Modal */}
      {showTableSelection && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Choose a Different Table</h3>
              <button 
                className="modal-close"
                onClick={() => setShowTableSelection(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="available-tables">
                {tables
                  .filter(table => table.id !== myTable?.id)
                  .map(table => (
                    <div key={table.id} className="table-option">
                      <div className="table-option-header">
                        <h4>{table.name}</h4>
                        <span className="table-occupancy">
                          {table.members.length}/{settings.maxPeoplePerTable}
                        </span>
                      </div>
                      <div className="table-option-members">
                        {table.members.slice(0, 3).map(member => (
                          <span key={member.id} className="member-name-small">
                            {member.name}
                          </span>
                        ))}
                        {table.members.length > 3 && (
                          <span className="more-members">
                            +{table.members.length - 3} more
                          </span>
                        )}
                      </div>
                      <button 
                        className="btn-primary"
                        onClick={() => handleChangeTable(table.id)}
                        disabled={loading || table.members.length >= settings.maxPeoplePerTable}
                      >
                        {table.members.length >= settings.maxPeoplePerTable ? 'Full' : 'Join Table'}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Tables Overview */}
      <div className="all-tables-section">
        <h3>All Tables Overview</h3>
        <div className="tables-grid">
          {tables.map(table => (
            <div key={table.id} className={`table-overview-card ${table.id === myTable?.id ? 'my-table' : ''}`}>
              <div className="table-overview-header">
                <h4>{table.name}</h4>
                <span className="table-occupancy">
                  {table.members.length}/{settings.maxPeoplePerTable}
                </span>
                {table.id === myTable?.id && <span className="my-table-badge">Your Table</span>}
              </div>
              <div className="table-overview-members">
                {table.members.map(member => (
                  <span key={member.id} className="member-name-overview">
                    {member.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {tables.length === 0 && (
          <div className="no-tables">
            <p>No tables have been created yet. Be the first to get assigned!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
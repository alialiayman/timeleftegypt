import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { shuffleTables, assignUsersToTables, getTableDistributionStats } from '../algorithms/tableAssignment';
import { db } from '../firebase';
import { doc, writeBatch, updateDoc, getDoc } from 'firebase/firestore';

function AdminPanel({ onBack }) {
  const { 
    users, 
    tables, 
    settings, 
    updateSettings, 
    addLocation, 
    updateLocation, 
    deleteLocation,
    isAdmin, 
    isSuperAdmin 
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    maxPeoplePerTable: settings.maxPeoplePerTable || 5,
    considerLocation: settings.considerLocation || false
  });

  // Location management states
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    googleMapsLink: '',
    description: '',
    expectedTime: ''
  });

  // Event management states
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    name: '',
    interest: '',
    description: '',
    maxSeats: 20,
    isRecurring: true,
    recurringDay: 'monday',
    startTime: '19:00',
    endTime: '21:00'
  });

  // Location management for events
  const [showLocationModal, setShowLocationModal] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventLocationForm, setEventLocationForm] = useState({
    address: '',
    googleMapsLink: '',
    reservationName: ''
  });

  // Attendee viewing
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [viewingEventId, setViewingEventId] = useState(null);

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

  // Location management functions
  const handleLocationFormChange = (e) => {
    const { name, value } = e.target;
    setLocationForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    if (!locationForm.name.trim()) {
      alert('Location name is required');
      return;
    }

    try {
      setLoading(true);
      await addLocation(locationForm);
      setLocationForm({ name: '', googleMapsLink: '', description: '', expectedTime: '' });
      setShowLocationForm(false);
      alert('Location added successfully!');
    } catch (error) {
      console.error('Error adding location:', error);
      alert('Failed to add location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLocation = (location) => { // eslint-disable-line no-unused-vars
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      googleMapsLink: location.googleMapsLink || '',
      description: location.description || '',
      expectedTime: location.expectedTime || ''
    });
    setShowLocationForm(true);
  };

  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    if (!locationForm.name.trim()) {
      alert('Location name is required');
      return;
    }

    try {
      setLoading(true);
      await updateLocation(editingLocation.id, locationForm);
      setLocationForm({ name: '', googleMapsLink: '', description: '', expectedTime: '' });
      setEditingLocation(null);
      setShowLocationForm(false);
      alert('Location updated successfully!');
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Failed to update location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async (locationId) => { // eslint-disable-line no-unused-vars
    if (!window.confirm('Are you sure you want to delete this location? This cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await deleteLocation(locationId);
      alert('Location deleted successfully!');
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cancelLocationForm = () => {
    setLocationForm({ name: '', googleMapsLink: '', description: '', expectedTime: '' });
    setEditingLocation(null);
    setShowLocationForm(false);
  };

  const handleEventFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEventForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEventLocationFormChange = (e) => {
    const { name, value } = e.target;
    setEventLocationForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddEventLocation = (eventId) => {
    setEditingEventId(eventId);
    setEventLocationForm({
      address: '',
      googleMapsLink: '',
      reservationName: ''
    });
    setShowLocationModal(true);
  };

  const handleEditEventLocation = (eventId, location) => {
    setEditingEventId(eventId);
    setEventLocationForm({
      address: location.address || '',
      googleMapsLink: location.googleMapsLink || '',
      reservationName: location.reservationName || ''
    });
    setShowLocationModal(true);
  };

  const handleSaveEventLocation = (e) => {
    e.preventDefault();
    alert(`Location saved for event!\n\nAddress: ${eventLocationForm.address}\nReservation: ${eventLocationForm.reservationName}\n\nNote: This is a demo. In production, this would save to the database.`);
    setShowLocationModal(false);
    setEditingEventId(null);
  };

  const handleToggleRevealLocation = (eventId, currentStatus) => {
    const action = currentStatus ? 'hide' : 'reveal';
    if (window.confirm(`Are you sure you want to ${action} the location for this event?`)) {
      alert(`Location ${action}ed! Users can ${currentStatus ? 'no longer' : 'now'} see the event location.`);
    }
  };

  const handleViewAttendees = (eventId) => {
    setViewingEventId(eventId);
    setShowAttendeesModal(true);
  };

  // Mock attendees data
  const getMockAttendees = (eventId) => {
    const attendeeData = {
      'soiree': [
        { id: 1, name: 'Ahmed Hassan', phone: '+20 100 123 4567', table: 'Table 1', status: 'confirmed' },
        { id: 2, name: 'Sara Mohamed', phone: '+20 101 234 5678', table: 'Table 1', status: 'confirmed' },
        { id: 3, name: 'Omar Ali', phone: '+20 102 345 6789', table: 'Table 2', status: 'confirmed' },
        { id: 4, name: 'Layla Ibrahim', phone: '+20 103 456 7890', table: 'Table 2', status: 'pending' },
        { id: 5, name: 'Youssef Khaled', phone: '+20 104 567 8901', table: 'Not Assigned', status: 'confirmed' },
        { id: 6, name: 'Nour Ahmed', phone: '+20 105 678 9012', table: 'Not Assigned', status: 'pending' },
      ],
      'padel': [
        { id: 1, name: 'Karim Mansour', phone: '+20 106 789 0123', table: 'Court A', status: 'confirmed' },
        { id: 2, name: 'Dina Samir', phone: '+20 107 890 1234', table: 'Court A', status: 'confirmed' },
        { id: 3, name: 'Hossam Fathy', phone: '+20 108 901 2345', table: 'Court B', status: 'confirmed' },
        { id: 4, name: 'Mona Tarek', phone: '+20 109 012 3456', table: 'Not Assigned', status: 'pending' },
      ],
      'movie': [
        { id: 1, name: 'Mahmoud Salah', phone: '+20 110 123 4567', table: 'Row A', status: 'confirmed' },
        { id: 2, name: 'Yasmin Mostafa', phone: '+20 111 234 5678', table: 'Row A', status: 'confirmed' },
        { id: 3, name: 'Amr Gamal', phone: '+20 112 345 6789', table: 'Row B', status: 'confirmed' },
        { id: 4, name: 'Rana Essam', phone: '+20 113 456 7890', table: 'Row B', status: 'pending' },
      ]
    };
    return attendeeData[eventId] || [];
  };

  // Mock member conflicts/blocks - returns array of conflicting member ID pairs
  const getMockMemberConflicts = (eventId) => {
    const conflictData = {
      'padel': [
        { member1Id: 1, member2Id: 3, reason: 'Karim blocked Hossam' },
        { member1Id: 2, member2Id: 4, reason: 'Dina prefers not to meet Mona' }
      ],
      'soiree': [],
      'movie': []
    };
    return conflictData[eventId] || [];
  };

  // Calculate required locations based on member conflicts
  const calculateRequiredLocations = (eventId) => {
    const attendees = getMockAttendees(eventId);
    const conflicts = getMockMemberConflicts(eventId);
    
    if (attendees.length === 0) {
      return { locationsNeeded: 0, groups: [], conflicts: [] };
    }
    
    if (conflicts.length === 0) {
      return { 
        locationsNeeded: 1, 
        groups: [attendees.map(a => a.name)],
        conflicts: []
      };
    }
    
    // Simple greedy algorithm to group non-conflicting members
    const groups = [];
    const assigned = new Set();
    
    attendees.forEach(attendee => {
      if (assigned.has(attendee.id)) return;
      
      // Find all members this person conflicts with
      const conflictsWith = conflicts
        .filter(c => c.member1Id === attendee.id || c.member2Id === attendee.id)
        .map(c => c.member1Id === attendee.id ? c.member2Id : c.member1Id);
      
      // Try to add to existing group without conflicts
      let addedToGroup = false;
      for (let group of groups) {
        const hasConflict = group.some(memberId => conflictsWith.includes(memberId));
        if (!hasConflict) {
          group.push(attendee.id);
          assigned.add(attendee.id);
          addedToGroup = true;
          break;
        }
      }
      
      // Create new group if couldn't add to existing
      if (!addedToGroup) {
        groups.push([attendee.id]);
        assigned.add(attendee.id);
      }
    });
    
    // Convert groups to names
    const namedGroups = groups.map(group => 
      group.map(id => attendees.find(a => a.id === id)?.name || 'Unknown')
    );
    
    return {
      locationsNeeded: groups.length,
      groups: namedGroups,
      conflicts: conflicts.map(c => ({
        ...c,
        member1Name: attendees.find(a => a.id === c.member1Id)?.name || 'Unknown',
        member2Name: attendees.find(a => a.id === c.member2Id)?.name || 'Unknown'
      }))
    };
  };

  const formatTime = (time24) => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleAddEvent = (e) => {
    e.preventDefault();
    alert(`Event "${eventForm.name}" added successfully!\n\nType: ${eventForm.isRecurring ? 'Recurring' : 'One-time'}\nInterest: ${eventForm.interest}\nTime: ${formatTime(eventForm.startTime)} - ${formatTime(eventForm.endTime)}\nMax Seats: ${eventForm.maxSeats}`);
    setEventForm({
      name: '',
      interest: '',
      description: '',
      maxSeats: 20,
      isRecurring: true,
      recurringDay: 'monday',
      startTime: '19:00',
      endTime: '21:00'
    });
    setShowEventForm(false);
  };

  // Mock admin interests
  const adminInterests = ['Soiree', 'Padel', 'Movie Night'];

  const stats = getTableDistributionStats(users.length, settings.maxPeoplePerTable);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h2>{isSuperAdmin() ? '👑 Super Admin Panel' : '🔧 Admin Panel'}</h2>
      </div>

      <div className="admin-content">
        {/* Location Management Section - Super Admin Only */}
        {isSuperAdmin() && (
        <div className="admin-section">
          <h3>🌍 Location Management</h3>
          <div className="location-info">
            <p><strong>Note:</strong> This is a mock demonstration. The app will support international locations across multiple countries and cities.</p>
          </div>
          
          <div className="location-controls">
            <button 
              className="btn-primary"
              onClick={() => setShowLocationForm(true)}
              disabled={loading}
            >
              ➕ Add New Location
            </button>
          </div>

          {showLocationForm && (
            <div className="location-form-modal">
              <div className="location-form">
                <h4>{editingLocation ? 'Edit Location' : 'Add New Location'}</h4>
                <form onSubmit={editingLocation ? handleUpdateLocation : handleAddLocation}>
                  <div className="form-group">
                    <label htmlFor="name">Restaurant Name *</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={locationForm.name}
                      onChange={handleLocationFormChange}
                      required
                      maxLength={100}
                      placeholder="e.g., Downtown Bistro"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="googleMapsLink">Google Maps Link</label>
                    <input
                      type="url"
                      id="googleMapsLink"
                      name="googleMapsLink"
                      value={locationForm.googleMapsLink}
                      onChange={handleLocationFormChange}
                      placeholder="https://maps.google.com/..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={locationForm.description}
                      onChange={handleLocationFormChange}
                      rows="3"
                      maxLength={300}
                      placeholder="Additional details about this location..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="expectedTime">Expected Arrival Time</label>
                    <input
                      type="text"
                      id="expectedTime"
                      name="expectedTime"
                      value={locationForm.expectedTime}
                      onChange={handleLocationFormChange}
                      maxLength={50}
                      placeholder="e.g., 7:00 PM, In 30 minutes"
                    />
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={cancelLocationForm}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? 'Saving...' : (editingLocation ? 'Update Location' : 'Add Location')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="locations-hierarchy">
            {/* Mock Location Hierarchy */}
            <div className="country-section">
              <div className="country-header">
                <h4>🇪🇬 Egypt</h4>
              </div>
              <div className="city-section">
                <div className="city-header">
                  <h5>📍 Cairo</h5>
                </div>
                <div className="areas-list">
                  <div className="area-item">
                    <span className="area-name">Downtown</span>
                    <div className="area-actions">
                      <button className="btn-small btn-secondary" disabled={loading}>
                        ✏️ Edit
                      </button>
                      <button className="btn-small btn-danger" disabled={loading}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  <div className="area-item">
                    <span className="area-name">New Cairo</span>
                    <div className="area-actions">
                      <button className="btn-small btn-secondary" disabled={loading}>
                        ✏️ Edit
                      </button>
                      <button className="btn-small btn-danger" disabled={loading}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  <div className="area-item">
                    <span className="area-name">6th October</span>
                    <div className="area-actions">
                      <button className="btn-small btn-secondary" disabled={loading}>
                        ✏️ Edit
                      </button>
                      <button className="btn-small btn-danger" disabled={loading}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Event Management Section - Regular Admin */}
        {!isSuperAdmin() && (
        <div className="admin-section">
          <h3>🎯 Event Management</h3>
          <p className="section-subtitle">Manage events for your assigned interests</p>
          
          <div className="admin-interests">
            <h4>Your Managed Interests</h4>
            <div className="interests-display">
              {adminInterests.map((interest, index) => (
                <span key={index} className="interest-badge">
                  {interest === 'Movie Night' && '🎬'}
                  {interest === 'Padel' && '🎾'}
                  {interest === 'Soiree' && '🎭'}
                  {' '}{interest}
                </span>
              ))}
            </div>
          </div>

          <div className="event-controls">
            <button 
              className="btn-primary"
              onClick={() => setShowEventForm(true)}
              disabled={loading}
            >
              ➕ Add New Event
            </button>
          </div>

          {showEventForm && (
            <div className="location-form-modal">
              <div className="location-form">
                <h4>Add New Event</h4>
                <form onSubmit={handleAddEvent}>
                  <div className="form-group">
                    <label htmlFor="interest">Interest Category *</label>
                    <select
                      id="interest"
                      name="interest"
                      value={eventForm.interest}
                      onChange={handleEventFormChange}
                      required
                    >
                      <option value="">Select interest</option>
                      {adminInterests.map((interest, index) => (
                        <option key={index} value={interest}>{interest}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="name">Event Name *</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={eventForm.name}
                      onChange={handleEventFormChange}
                      required
                      maxLength={100}
                      placeholder="e.g., Friday Night Movie"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={eventForm.description}
                      onChange={handleEventFormChange}
                      rows="3"
                      maxLength={300}
                      placeholder="Brief description of the event..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="maxSeats">Maximum Seats</label>
                    <input
                      type="number"
                      id="maxSeats"
                      name="maxSeats"
                      value={eventForm.maxSeats}
                      onChange={handleEventFormChange}
                      min="5"
                      max="100"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="isRecurring"
                        checked={eventForm.isRecurring}
                        onChange={handleEventFormChange}
                      />
                      Recurring Event
                    </label>
                  </div>

                  {eventForm.isRecurring && (
                    <div className="form-group">
                      <label htmlFor="recurringDay">Recurring Day</label>
                      <select
                        id="recurringDay"
                        name="recurringDay"
                        value={eventForm.recurringDay}
                        onChange={handleEventFormChange}
                      >
                        <option value="monday">Every Monday</option>
                        <option value="tuesday">Every Tuesday</option>
                        <option value="wednesday">Every Wednesday</option>
                        <option value="thursday">Every Thursday</option>
                        <option value="friday">Every Friday</option>
                        <option value="saturday">Every Saturday</option>
                        <option value="sunday">Every Sunday</option>
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="startTime">Start Time</label>
                    <input
                      type="time"
                      id="startTime"
                      name="startTime"
                      value={eventForm.startTime}
                      onChange={handleEventFormChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="endTime">End Time</label>
                    <input
                      type="time"
                      id="endTime"
                      name="endTime"
                      value={eventForm.endTime}
                      onChange={handleEventFormChange}
                      required
                    />
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowEventForm(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? 'Saving...' : 'Add Event'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Mock Existing Events */}
          <div className="existing-events">
            <h4>Current Events</h4>
            <div className="events-list">
              <div className="event-item">
                <div className="event-item-header">
                  <div className="event-item-info">
                    <h5>🎭 Soirée Night</h5>
                    <span className="recurring-badge">🔄 Recurring - Every Wednesday</span>
                    <span className="recurring-badge">🕐 7:00 PM - 10:00 PM</span>
                    <span className="recurring-badge">👥 12/25 booked</span>
                  </div>
                  <span className="seats-badge">25 seats</span>
                </div>
                <p className="event-item-desc">An elegant evening of conversation, drinks, and networking with fellow TimeLeft members.</p>
                
                {/* Location Section */}
                <div className="event-location-section">
                  <div className="location-status">
                    <strong>📍 Location:</strong>
                    <span className="location-details">
                      The Lounge Bar, 123 Downtown Street, New Cairo<br/>
                      <small>Reservation: TimeLeft Group - Table 5</small>
                    </span>
                    <span className="status-badge revealed">✅ Revealed to Users</span>
                  </div>
                </div>

                <div className="event-item-actions">
                  <button className="btn-small btn-secondary" disabled={loading}>
                    ✏️ Edit Event
                  </button>
                  <button 
                    className="btn-small btn-info" 
                    onClick={() => handleViewAttendees('soiree')}
                    disabled={loading}
                  >
                    👥 View Attendees (12)
                  </button>
                  <button 
                    className="btn-small btn-secondary" 
                    onClick={() => handleEditEventLocation('soiree', {
                      address: 'The Lounge Bar, 123 Downtown Street, New Cairo',
                      googleMapsLink: 'https://maps.google.com/...',
                      reservationName: 'TimeLeft Group - Table 5'
                    })}
                    disabled={loading}
                  >
                    📍 Edit Location
                  </button>
                  <button 
                    className="btn-small btn-warning"
                    onClick={() => handleToggleRevealLocation('soiree', true)}
                    disabled={loading}
                  >
                    👁️ Hide Location
                  </button>
                  <button className="btn-small btn-danger" disabled={loading}>
                    🗑️ Delete
                  </button>
                </div>
              </div>

              <div className="event-item">
                <div className="event-item-header">
                  <div className="event-item-info">
                    <h5>🎾 Padel Club</h5>
                    <span className="recurring-badge">🔄 Recurring - Every Monday</span>
                    <span className="recurring-badge">🕐 6:00 PM - 8:00 PM</span>
                    <span className="recurring-badge">👥 8/16 booked</span>
                  </div>
                  <span className="seats-badge">16 seats</span>
                </div>
                <p className="event-item-desc">Join us for an exciting padel session! All skill levels welcome.</p>
                
                {/* No Location Set - Show Requirements */}
                <div className="event-location-section">
                  <div className="location-status">
                    <strong>📍 Location:</strong>
                    <span className="location-details no-location">No location set</span>
                  </div>
                  
                  {(() => {
                    const locationData = calculateRequiredLocations('padel');
                    return (
                      <div className="location-requirements">
                        <div className="requirements-header">
                          <strong>📊 Location Requirements:</strong>
                          <span className={`locations-needed ${locationData.locationsNeeded > 1 ? 'multiple' : 'single'}`}>
                            {locationData.locationsNeeded} {locationData.locationsNeeded === 1 ? 'location' : 'locations'} needed
                          </span>
                        </div>
                        
                        {locationData.conflicts.length > 0 && (
                          <div className="conflict-details">
                            <p className="conflict-explanation">
                              ⚠️ Member conflicts detected - multiple locations required:
                            </p>
                            <ul className="conflicts-list">
                              {locationData.conflicts.map((conflict, idx) => (
                                <li key={idx}>
                                  <strong>{conflict.member1Name}</strong> and <strong>{conflict.member2Name}</strong>
                                  <br/>
                                  <small>({conflict.reason})</small>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div className="suggested-groups">
                          <strong>Suggested groupings:</strong>
                          {locationData.groups.map((group, idx) => (
                            <div key={idx} className="location-group">
                              <span className="group-label">Location {idx + 1}:</span>
                              <span className="group-members">{group.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="event-item-actions">
                  <button className="btn-small btn-secondary" disabled={loading}>
                    ✏️ Edit Event
                  </button>
                  <button 
                    className="btn-small btn-info" 
                    onClick={() => handleViewAttendees('padel')}
                    disabled={loading}
                  >
                    👥 View Attendees (8)
                  </button>
                  <button 
                    className="btn-small btn-primary" 
                    onClick={() => handleAddEventLocation('padel')}
                    disabled={loading}
                  >
                    ➕ Add Location
                  </button>
                  <button className="btn-small btn-danger" disabled={loading}>
                    🗑️ Delete
                  </button>
                </div>
              </div>

              <div className="event-item">
                <div className="event-item-header">
                  <div className="event-item-info">
                    <h5>🎬 Movie Night</h5>
                    <span className="recurring-badge">🔄 Recurring - Every Friday</span>
                    <span className="recurring-badge">🕐 8:00 PM - 11:00 PM</span>
                    <span className="recurring-badge">👥 20/30 booked</span>
                  </div>
                  <span className="seats-badge">30 seats</span>
                </div>
                <p className="event-item-desc">Watch a curated film followed by discussion and refreshments.</p>
                
                {/* Location Added but Not Revealed */}
                <div className="event-location-section">
                  <div className="location-status">
                    <strong>📍 Location:</strong>
                    <span className="location-details">
                      Cinema Complex, Mall of Cairo<br/>
                      <small>Reservation: TimeLeft Screening - Hall 3</small>
                    </span>
                    <span className="status-badge hidden">🔒 Hidden from Users</span>
                  </div>
                </div>

                <div className="event-item-actions">
                  <button className="btn-small btn-secondary" disabled={loading}>
                    ✏️ Edit Event
                  </button>
                  <button 
                    className="btn-small btn-info" 
                    onClick={() => handleViewAttendees('movie')}
                    disabled={loading}
                  >
                    👥 View Attendees (20)
                  </button>
                  <button 
                    className="btn-small btn-secondary" 
                    onClick={() => handleEditEventLocation('movie', {
                      address: 'Cinema Complex, Mall of Cairo',
                      googleMapsLink: 'https://maps.google.com/...',
                      reservationName: 'TimeLeft Screening - Hall 3'
                    })}
                    disabled={loading}
                  >
                    📍 Edit Location
                  </button>
                  <button 
                    className="btn-small btn-success"
                    onClick={() => handleToggleRevealLocation('movie', false)}
                    disabled={loading}
                  >
                    👁️ Reveal Location
                  </button>
                  <button className="btn-small btn-danger" disabled={loading}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Attendees Modal */}
          {showAttendeesModal && (
            <div className="location-form-modal">
              <div className="location-form attendees-modal">
                <h4>Event Attendees & Table Allocations</h4>
                <div className="attendees-summary">
                  <p><strong>Total Attendees:</strong> {getMockAttendees(viewingEventId).length}</p>
                  <p><strong>Confirmed:</strong> {getMockAttendees(viewingEventId).filter(a => a.status === 'confirmed').length}</p>
                  <p><strong>Pending:</strong> {getMockAttendees(viewingEventId).filter(a => a.status === 'pending').length}</p>
                </div>

                <div className="attendees-table">
                  <div className="table-header-attendees">
                    <span>Name</span>
                    <span>Phone</span>
                    <span>Table</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  {getMockAttendees(viewingEventId).map(attendee => (
                    <div key={attendee.id} className="table-row-attendees">
                      <span className="attendee-name">{attendee.name}</span>
                      <span className="attendee-phone">{attendee.phone}</span>
                      <span className={`attendee-table ${attendee.table === 'Not Assigned' ? 'unassigned' : ''}`}>
                        {attendee.table}
                      </span>
                      <span className="attendee-status">
                        <span className={`status-badge-small ${attendee.status}`}>
                          {attendee.status === 'confirmed' ? '✅ Confirmed' : '⏳ Pending'}
                        </span>
                      </span>
                      <span className="attendee-actions">
                        {attendee.table === 'Not Assigned' && (
                          <button className="btn-tiny btn-primary" disabled={loading}>
                            Assign Table
                          </button>
                        )}
                        {attendee.table !== 'Not Assigned' && (
                          <button className="btn-tiny btn-secondary" disabled={loading}>
                            Change Table
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => {
                      setShowAttendeesModal(false);
                      setViewingEventId(null);
                    }}
                  >
                    Close
                  </button>
                  <button className="btn-primary" disabled={loading}>
                    💾 Save Table Assignments
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Location Modal */}
          {showLocationModal && (
            <div className="location-form-modal">
              <div className="location-form">
                <h4>Event Location Details</h4>
                <form onSubmit={handleSaveEventLocation}>
                  <div className="form-group">
                    <label htmlFor="eventAddress">Address *</label>
                    <input
                      type="text"
                      id="eventAddress"
                      name="address"
                      value={eventLocationForm.address}
                      onChange={handleEventLocationFormChange}
                      required
                      maxLength={200}
                      placeholder="e.g., The Lounge Bar, 123 Downtown Street, New Cairo"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="eventGoogleMapsLink">Google Maps Link *</label>
                    <input
                      type="url"
                      id="eventGoogleMapsLink"
                      name="googleMapsLink"
                      value={eventLocationForm.googleMapsLink}
                      onChange={handleEventLocationFormChange}
                      required
                      placeholder="https://maps.google.com/..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="eventReservationName">Table/Reservation Name *</label>
                    <input
                      type="text"
                      id="eventReservationName"
                      name="reservationName"
                      value={eventLocationForm.reservationName}
                      onChange={handleEventLocationFormChange}
                      required
                      maxLength={100}
                      placeholder="e.g., TimeLeft Group - Table 5"
                    />
                  </div>

                  <div className="form-note">
                    <p><strong>Note:</strong> After saving, you can choose to reveal this location to users who have booked the event.</p>
                  </div>

                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={() => {
                        setShowLocationModal(false);
                        setEditingEventId(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? 'Saving...' : 'Save Location'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Statistics Section - Super Admin Only */}
        {isSuperAdmin() && (
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
        )}

        {/* Settings Section - Super Admin Only */}
        {isSuperAdmin() && (
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
        )}

        {/* Table Management Section - Super Admin Only */}
        {isSuperAdmin() && (
        <div className="admin-section">
          <h3>⏰ Table Management</h3>
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
        )}

        {/* User Management Section - Super Admin Only */}
        {isSuperAdmin() && (
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
        )}

      </div>
    </div>
  );
}

export default AdminPanel;
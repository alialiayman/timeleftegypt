import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function LocationSelection({ onLocationSelected }) {
  const { locations, checkInToLocation, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');

  const handleCheckIn = async () => {
    if (!selectedLocation) {
      alert('Please select a location first.');
      return;
    }

    console.log('🎯 Starting check-in process for location:', selectedLocation);
    
    try {
      setLoading(true);
      console.log('🔄 Calling checkInToLocation...');
      
      const success = await checkInToLocation(selectedLocation);
      
      console.log('📋 checkInToLocation result:', success);
      
      if (success) {
        console.log('✅ Location check-in successful, waiting for state update...');
        // Don't call onLocationSelected() - let the natural state update handle the transition
        if (onLocationSelected) {
          onLocationSelected();
        }
      } else {
        console.error('❌ checkInToLocation returned false');
        alert('Check-in failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error during check-in:', error);
      alert(`Failed to check in: ${error.message}. Please try again.`);
    } finally {
      console.log('🏁 Check-in process completed, setting loading to false');
      setLoading(false);
    }
  };

  const activeLocations = locations.filter(loc => loc.isActive);

  if (activeLocations.length === 0) {
    return (
      <div className="location-selection">
        <div className="location-card">
          <h2>🏢 No Locations Available</h2>
          <p>No restaurant locations are currently active. Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="location-selection">
      <div className="location-card">
        <div className="location-header">
          <h2>⏰ Welcome, {userProfile?.displayName || userProfile?.name}!</h2>
          <p>Please select your restaurant location to continue:</p>
        </div>

        <div className="locations-list">
          {activeLocations.map(location => (
            <div 
              key={location.id} 
              className={`location-option ${selectedLocation === location.id ? 'selected' : ''}`}
              onClick={() => setSelectedLocation(location.id)}
            >
              <div className="location-info">
                <h3>🏢 {location.name}</h3>
                {location.description && (
                  <p className="location-description">{location.description}</p>
                )}
                {location.expectedTime && (
                  <p className="expected-time">
                    <strong>Expected time:</strong> {location.expectedTime}
                  </p>
                )}
              </div>
              
              {location.googleMapsLink && (
                <div className="location-actions">
                  <a 
                    href={location.googleMapsLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="maps-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📍 View on Maps
                  </a>
                </div>
              )}
              
              <div className="selection-indicator">
                {selectedLocation === location.id && <span>✓ Selected</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="check-in-actions">
          <button 
            className="btn btn-primary"
            onClick={handleCheckIn}
            disabled={loading || !selectedLocation}
          >
            {loading ? 'Checking in...' : '✅ Check In to Location'}
          </button>
        </div>

        <div className="location-note">
          <p>
            <strong>Note:</strong> Once you check in, you'll be able to get assigned to a table 
            with other participants at this location.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LocationSelection;
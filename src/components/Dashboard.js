import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function Dashboard({ setCurrentView }) {
  const { 
    userProfile, 
    logout, 
    isAdmin
  } = useAuth();
  
  const [loading] = useState(false);
  const [bookedEvents, setBookedEvents] = useState([]);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await logout();
      } catch (error) {
        console.error('Error during logout:', error);
        alert('There was an error during logout. Please try again.');
      }
    }
  };

  const getLocationDisplay = (user) => {
    // Mock location for demonstration
    return '🇪🇬 Egypt, Cairo, New Cairo';
  };

  // Calculate next occurrence of a specific day
  const getNextDayOfWeek = (dayName) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = days.indexOf(dayName.toLowerCase());
    
    const today = new Date();
    const todayDayIndex = today.getDay();
    
    let daysUntilTarget = dayIndex - todayDayIndex;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    
    return targetDate;
  };

  const formatEventDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Mock events based on user interests
  const mockEvents = [
    {
      id: 'soiree-1',
      name: 'Soirée Night',
      interest: 'Soiree',
      emoji: '🎭',
      date: getNextDayOfWeek('wednesday'),
      maxSeats: 25,
      bookedSeats: 12,
      description: 'An elegant evening of conversation, drinks, and networking with fellow TimeLeft members.',
      whatsappCommunityLink: 'https://chat.whatsapp.com/soiree-community'
    },
    {
      id: 'padel-1',
      name: 'Padel Club',
      interest: 'Padel',
      emoji: '🎾',
      date: getNextDayOfWeek('monday'),
      maxSeats: 16,
      bookedSeats: 8,
      description: 'Join us for an exciting padel session! All skill levels welcome.',
      whatsappCommunityLink: 'https://chat.whatsapp.com/padel-community'
    },
    {
      id: 'movie-1',
      name: 'Movie Night',
      interest: 'Movie Night',
      emoji: '🎬',
      date: getNextDayOfWeek('friday'),
      maxSeats: 30,
      bookedSeats: 18,
      description: 'Watch a curated film followed by discussion and refreshments.',
      whatsappCommunityLink: 'https://chat.whatsapp.com/movie-community'
    }
  ];

  // User's interests (from mock profile)
  const userInterests = ['Movie Night', 'Padel', 'Soiree'];

  const handleBookEvent = (eventId) => {
    if (bookedEvents.includes(eventId)) {
      // Unbook
      setBookedEvents(bookedEvents.filter(id => id !== eventId));
      alert('Event booking cancelled successfully!');
    } else {
      // Book
      setBookedEvents([...bookedEvents, eventId]);
      alert('Event booked successfully! You will receive location details 24 hours before the event.');
    }
  };

  const isEventBooked = (eventId) => bookedEvents.includes(eventId);

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
            {isAdmin() && (
              <button 
                className="btn-primary"
                onClick={() => setCurrentView('admin')}
              >
                {isAdmin() ? 'Admin Panel' : 'Admin Panel'}
              </button>
            )}
            <button 
              className="btn-danger"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* User Interests Section */}
      <div className="interests-section">
        <h3>Your Interests</h3>
        <div className="interests-display">
          {userInterests.map((interest, index) => (
            <span key={index} className="interest-badge">
              {interest === 'Movie Night' && '🎬'}
              {interest === 'Padel' && '🎾'}
              {interest === 'Soiree' && '🎭'}
              {' '}{interest}
            </span>
          ))}
        </div>
      </div>

      {/* Upcoming Events Section */}
      <div className="events-section">
        <h3>Upcoming Events</h3>
        <p className="events-subtitle">Events matched to your interests</p>
        
        <div className="events-grid">
          {mockEvents.map(event => (
            <div key={event.id} className={`event-card ${isEventBooked(event.id) ? 'booked' : ''}`}>
              <div className="event-header">
                <div className="event-title">
                  <span className="event-emoji">{event.emoji}</span>
                  <h4>{event.name}</h4>
                </div>
                {isEventBooked(event.id) && (
                  <span className="booked-badge">✓ Booked</span>
                )}
              </div>
              
              <div className="event-details">
                <div className="event-detail">
                  <span className="detail-icon">📅</span>
                  <span className="detail-text">{formatEventDate(event.date)}</span>
                </div>
                
                <div className="event-detail">
                  <span className="detail-icon">📍</span>
                  <span className="detail-text location-tbd">
                    Location will be announced 24 hours before the event
                  </span>
                </div>
                
                {isAdmin() && (
                  <div className="event-detail">
                    <span className="detail-icon">👥</span>
                    <span className="detail-text">
                      {event.bookedSeats}/{event.maxSeats} seats booked
                    </span>
                  </div>
                )}
              </div>
              
              <p className="event-description">{event.description}</p>
              
              <div className="event-progress">
                <div 
                  className="progress-bar"
                  style={{ width: `${(event.bookedSeats / event.maxSeats) * 100}%` }}
                />
              </div>
              
              <div className="event-actions">
                <button 
                  className={`btn-event ${isEventBooked(event.id) ? 'btn-booked' : 'btn-book'}`}
                  onClick={() => handleBookEvent(event.id)}
                  disabled={loading || (!isEventBooked(event.id) && event.bookedSeats >= event.maxSeats)}
                >
                  {isEventBooked(event.id) 
                    ? '✓ Cancel Booking' 
                    : event.bookedSeats >= event.maxSeats 
                      ? 'Event Full' 
                      : '🎟️ Book Your Seat'}
                </button>
                
                <a 
                  href={event.whatsappCommunityLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                >
                  <span className="whatsapp-icon">💬</span>
                  View Event in WhatsApp
                </a>
              </div>
              
              <p className="event-rsvp-note">
                💡 View event details and chat with other attendees in WhatsApp
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
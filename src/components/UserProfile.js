import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function UserProfile({ onBack }) {
  const { userProfile, updateUserProfile } = useAuth();
  const [formData, setFormData] = useState({
    displayName: '',
    fullName: '',
    phoneNumber: '',
    city: '',
    gender: '',
    preferences: {
      dietary: '',
      interests: '',
      experience: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(true); // Mock: assume verified
  const [blockedMembers, setBlockedMembers] = useState([]);
  const [showBlockMemberModal, setShowBlockMemberModal] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const fileInputRef = useRef(null);

  // Mock members list for blocking
  const mockMembers = [
    { id: 1, name: 'Ahmed Hassan', phone: '+20 100 123 4567' },
    { id: 2, name: 'Sara Mohamed', phone: '+20 101 234 5678' },
    { id: 3, name: 'Omar Ali', phone: '+20 102 345 6789' },
    { id: 4, name: 'Layla Ibrahim', phone: '+20 103 456 7890' },
    { id: 5, name: 'Youssef Khaled', phone: '+20 104 567 8901' },
    { id: 6, name: 'Nour Ahmed', phone: '+20 105 678 9012' },
    { id: 7, name: 'Karim Mansour', phone: '+20 106 789 0123' },
    { id: 8, name: 'Dina Samir', phone: '+20 107 890 1234' },
    { id: 9, name: 'Hossam Fathy', phone: '+20 108 901 2345' },
    { id: 10, name: 'Mona Tarek', phone: '+20 109 012 3456' }
  ];

  // Initialize form data when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || '',
        fullName: userProfile.fullName || '',
        phoneNumber: userProfile.phoneNumber || '',
        city: userProfile.city || '',
        gender: userProfile.gender || '',
        preferences: {
          dietary: userProfile.preferences?.dietary || '',
          interests: userProfile.preferences?.interests || '',
          experience: userProfile.preferences?.experience || '',
          ...userProfile.preferences
        }
      });
      // Mock: set verification status based on whether phone exists
      setIsPhoneVerified(userProfile.phoneVerified || Boolean(userProfile.phoneNumber));
    }
  }, [userProfile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('preferences.')) {
      const prefKey = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [prefKey]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    try {
      setUploadingPhoto(true);
      
      // Create a reference to the file in Firebase Storage
      const fileRef = ref(storage, `profile-photos/${userProfile.id}/${Date.now()}-${file.name}`);
      
      // Upload the file
      const snapshot = await uploadBytes(fileRef, file);
      
      // Get the download URL
      const photoURL = await getDownloadURL(snapshot.ref);
      
      // Update user profile with new photo URL
      await updateUserProfile({ photoURL });
      
      alert('Photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Prepare the data for submission
      const profileUpdate = {
        displayName: formData.displayName.trim(),
        fullName: formData.fullName.trim(),
        gender: formData.gender,
        preferences: {
          dietary: formData.preferences.dietary,
          interests: formData.preferences.interests.trim(),
          experience: formData.preferences.experience.trim()
        }
      };

      console.log('Submitting profile data:', profileUpdate);
      
      await updateUserProfile(profileUpdate);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhone = () => {
    // Mock verification - in production, this would send an SMS
    if (formData.phoneNumber && formData.phoneNumber.length >= 10) {
      const code = prompt('Verification code sent to ' + formData.phoneNumber + '\n\nFor demo: Enter "1234" to verify');
      if (code === '1234') {
        setIsPhoneVerified(true);
        alert('Phone number verified successfully!');
        // In production, update the profile with verified phone
      } else if (code) {
        alert('Invalid verification code. Please try again.');
      }
    } else {
      alert('Please enter a valid phone number');
    }
  };

  const handleWhatsAppMessage = () => {
    const phone = formData.phoneNumber.replace(/[^0-9]/g, '');
    const message = encodeURIComponent('Hello! This is a message from TimeLeft Reconnect.');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const handleBlockMember = (member) => {
    if (window.confirm(`Are you sure you want to block ${member.name}? You will not be matched with them in any events.`)) {
      setBlockedMembers([...blockedMembers, member]);
      alert(`${member.name} has been blocked. You won't meet them in any events.`);
      setShowBlockMemberModal(false);
      setSearchMemberQuery('');
    }
  };

  const handleUnblockMember = (memberId) => {
    const member = blockedMembers.find(m => m.id === memberId);
    if (window.confirm(`Unblock ${member?.name}? They will be able to attend events with you again.`)) {
      setBlockedMembers(blockedMembers.filter(m => m.id !== memberId));
      alert(`${member?.name} has been unblocked.`);
    }
  };

  const getFilteredMembers = () => {
    const blocked = new Set(blockedMembers.map(m => m.id));
    return mockMembers
      .filter(m => !blocked.has(m.id))
      .filter(m => searchMemberQuery === '' || 
        m.name.toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
        m.phone.includes(searchMemberQuery)
      );
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h2>My Profile</h2>
      </div>

      <div className="profile-content">
        {/* Photo Section */}
        <div className="profile-photo-section">
          <div className="current-photo">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="Profile" className="profile-photo" />
            ) : (
              <div className="photo-placeholder">
                {(userProfile?.displayName || userProfile?.name || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="photo-upload">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <button 
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? 'Uploading...' : '📷 Change Photo'}
            </button>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="displayName">Display Name *</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleInputChange}
                required
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                maxLength={100}
                placeholder="Your complete name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber">
                Phone Number * 
                {isPhoneVerified && <span className="verified-badge">✅ Verified</span>}
              </label>
              <div className="phone-input-group">
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  disabled={isPhoneVerified}
                  required
                  maxLength={20}
                  placeholder="+20 123 456 7890"
                  className={isPhoneVerified ? 'verified' : ''}
                />
                <button
                  type="button"
                  className="btn-verify"
                  onClick={handleVerifyPhone}
                  disabled={isPhoneVerified}
                >
                  {isPhoneVerified ? '✓ Verified' : 'Verify'}
                </button>
                {isPhoneVerified && (
                  <button
                    type="button"
                    className="btn-whatsapp"
                    onClick={handleWhatsAppMessage}
                    title="Send WhatsApp message"
                  >
                    💬 WhatsApp
                  </button>
                )}
              </div>
              <small>
                {isPhoneVerified 
                  ? '🔒 Your phone number is verified and secured. Contact support to change it.' 
                  : 'Enter your phone number and verify it to secure your account'}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3>Location Information</h3>
            <div className="form-group">
              <label htmlFor="country">Country</label>
              <select
                id="country"
                name="country"
                value="egypt"
                disabled
              >
                <option value="">Select country</option>
                <option value="egypt">🇪🇬 Egypt</option>
                <option value="usa">🇺🇸 United States</option>
                <option value="uk">🇬🇧 United Kingdom</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="city">City</label>
              <select
                id="city"
                name="city"
                value="cairo"
                disabled
              >
                <option value="">Select city</option>
                <option value="cairo">Cairo</option>
                <option value="alexandria">Alexandria</option>
                <option value="giza">Giza</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="area">Area</label>
              <select
                id="area"
                name="area"
                value="new-cairo"
                disabled
              >
                <option value="">Select area</option>
                <option value="downtown">Downtown</option>
                <option value="new-cairo">New Cairo</option>
                <option value="6th-october">6th October</option>
              </select>
            </div>
            <small className="mock-note">📍 Currently showing: Egypt → Cairo → New Cairo (Mock Data)</small>
          </div>

          <div className="form-section">
            <h3>Preferences & Interests</h3>
            
            <div className="form-group">
              <label htmlFor="preferences.dietary">Dietary Preferences</label>
              <select
                id="preferences.dietary"
                name="preferences.dietary"
                value={formData.preferences.dietary}
                onChange={handleInputChange}
              >
                <option value="">No specific preference</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="pescatarian">Pescatarian</option>
                <option value="halal">Halal</option>
                <option value="kosher">Kosher</option>
                <option value="gluten-free">Gluten-free</option>
                <option value="dairy-free">Dairy-free</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="preferences.interests">Interests & Activities</label>
              <div className="interests-tags">
                <span className="interest-tag selected">🎬 Movie Night</span>
                <span className="interest-tag selected">🎾 Padel</span>
                <span className="interest-tag selected">🎭 Soiree</span>
                <span className="interest-tag">🎮 Gaming</span>
                <span className="interest-tag">🎨 Art</span>
                <span className="interest-tag">📚 Reading</span>
                <span className="interest-tag">🏃 Sports</span>
                <span className="interest-tag">🎵 Music</span>
                <span className="interest-tag">🍳 Cooking</span>
                <span className="interest-tag">✈️ Travel</span>
              </div>
              <small className="mock-note">✨ Mock selection: Movie Night, Padel, Soiree</small>
            </div>

            <div className="form-group">
              <label htmlFor="preferences.experience">Professional Experience</label>
              <textarea
                id="preferences.experience"
                name="preferences.experience"
                value={formData.preferences.experience}
                onChange={handleInputChange}
                rows="3"
                maxLength={300}
                placeholder="Brief description of your professional background or field of work..."
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onBack}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* Blocked Members Section */}
        <div className="blocked-members-section">
          <div className="section-header">
            <h3>🚫 Blocked Members</h3>
            <button 
              type="button" 
              className="btn-small btn-primary"
              onClick={() => setShowBlockMemberModal(true)}
            >
              ➕ Block a Member
            </button>
          </div>
          
          {blockedMembers.length === 0 ? (
            <div className="no-blocked-members">
              <p>You haven't blocked any members yet.</p>
              <small>Blocking a member ensures you won't be matched with them in any events.</small>
            </div>
          ) : (
            <div className="blocked-members-list">
              {blockedMembers.map(member => (
                <div key={member.id} className="blocked-member-item">
                  <div className="member-info">
                    <div className="member-avatar">
                      {member.name[0].toUpperCase()}
                    </div>
                    <div className="member-details">
                      <strong>{member.name}</strong>
                      <small>{member.phone}</small>
                    </div>
                  </div>
                  <button 
                    type="button"
                    className="btn-small btn-secondary"
                    onClick={() => handleUnblockMember(member.id)}
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Block Member Modal */}
        {showBlockMemberModal && (
          <div className="location-form-modal">
            <div className="location-form">
              <h4>Block a Member</h4>
              <p className="modal-description">
                Search for a member to block. Blocked members won't be matched with you in any events.
              </p>
              
              <div className="form-group">
                <label htmlFor="searchMember">Search Member</label>
                <input
                  type="text"
                  id="searchMember"
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  placeholder="Search by name or phone number..."
                  autoFocus
                />
              </div>

              <div className="members-search-results">
                {getFilteredMembers().length === 0 ? (
                  <p className="no-results">No members found matching your search.</p>
                ) : (
                  getFilteredMembers().slice(0, 10).map(member => (
                    <div key={member.id} className="search-result-item">
                      <div className="member-info">
                        <div className="member-avatar-small">
                          {member.name[0].toUpperCase()}
                        </div>
                        <div className="member-details">
                          <strong>{member.name}</strong>
                          <small>{member.phone}</small>
                        </div>
                      </div>
                      <button 
                        type="button"
                        className="btn-tiny btn-danger"
                        onClick={() => handleBlockMember(member)}
                      >
                        🚫 Block
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    setShowBlockMemberModal(false);
                    setSearchMemberQuery('');
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Information */}
        <div className="account-info">
          <h3>Account Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <strong>Phone Number:</strong> {formData.phoneNumber || 'Not provided'}
              {isPhoneVerified && <span className="verified-badge-small">✅ Verified</span>}
            </div>
            <div className="info-item">
              <strong>Email:</strong> {userProfile?.email || 'Not provided'}
            </div>
            <div className="info-item">
              <strong>Account Type:</strong> {userProfile?.isAnonymous ? 'Name-based' : 'Google Account'}
            </div>
            <div className="info-item">
              <strong>Account Status:</strong> <span className="status-active">✅ Active</span>
            </div>
            <div className="info-item">
              <strong>Member Since:</strong> {
                userProfile?.createdAt ? 
                new Date(userProfile.createdAt).toLocaleDateString() : 
                'Recently joined'
              }
            </div>
            <div className="info-item">
              <strong>Last Updated:</strong> {
                userProfile?.lastUpdated ? 
                new Date(userProfile.lastUpdated).toLocaleDateString() : 
                'Never'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function UserProfile({ onBack }) {
  const { userProfile, updateUserProfile, getCurrentLocation } = useAuth();
  const [formData, setFormData] = useState({
    displayName: '',
    fullName: '',
    gender: '',
    preferences: {
      dietary: '',
      interests: '',
      experience: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize form data when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || '',
        fullName: userProfile.fullName || '',
        gender: userProfile.gender || '',
        preferences: {
          dietary: userProfile.preferences?.dietary || '',
          interests: userProfile.preferences?.interests || '',
          experience: userProfile.preferences?.experience || '',
          ...userProfile.preferences
        }
      });
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

  const handleUpdateLocation = async () => {
    try {
      setLocationLoading(true);
      const location = await getCurrentLocation();
      if (location) {
        await updateUserProfile({ location });
        alert('Location updated successfully!');
      } else {
        alert('Could not get your location. Please check your browser permissions.');
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Failed to update location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const getLocationDisplay = () => {
    if (!userProfile?.location) return 'Location not available';
    return `${userProfile.location.latitude.toFixed(6)}, ${userProfile.location.longitude.toFixed(6)}`;
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
            <h3>Location</h3>
            <div className="location-info">
              <p className="current-location">
                <strong>Current Location:</strong> {getLocationDisplay()}
              </p>
              <button 
                type="button"
                className="btn-secondary"
                onClick={handleUpdateLocation}
                disabled={locationLoading}
              >
                {locationLoading ? 'Getting Location...' : '📍 Update Location'}
              </button>
            </div>
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
              <label htmlFor="preferences.interests">Interests & Hobbies</label>
              <textarea
                id="preferences.interests"
                name="preferences.interests"
                value={formData.preferences.interests}
                onChange={handleInputChange}
                rows="3"
                maxLength={300}
                placeholder="Tell others about your interests, hobbies, or what you'd like to discuss..."
              />
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

        {/* Account Information */}
        <div className="account-info">
          <h3>Account Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <strong>Email:</strong> {userProfile?.email || 'Not provided'}
            </div>
            <div className="info-item">
              <strong>Account Type:</strong> {userProfile?.isAnonymous ? 'Name-based' : 'Google Account'}
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
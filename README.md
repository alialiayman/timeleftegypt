# 🎉 Gatherly

**Gatherly** is a locality-based social event platform for Egypt. It connects people through curated real-world experiences — dinners, movie nights, coffee meetups, and more — organized by community leaders called **Organizers** and overseen by a system administrator called the **Master**.

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Roles](#roles)
3. [How Locality Works](#how-locality-works)
4. [Major Flows](#major-flows)
5. [Screenshots](#screenshots)
6. [Architecture](#architecture)
7. [Setup & Running](#setup--running)
8. [Deployment](#deployment)

---

## Overview

Gatherly brings people together through events tied to geographic localities (e.g., Egypt → Cairo → New Cairo). The platform is designed for three types of users:

- **Master** — the system administrator who configures localities and assigns Organizers.
- **Organizer** — a community leader who creates and manages events within their assigned locality.
- **Friend** — a regular user who discovers and books events in their chosen area.

Events are locality-scoped: an Organizer's events automatically belong to their assigned locality, and a Friend sees only events from the locality they've chosen in their profile.

---

## Roles

### 🔑 Master (Super Admin)

The Master has full control over the system. Their responsibilities include:

- **Creating and managing localities** — Each locality is defined by a country, city, and area/district (e.g., Egypt → Cairo → New Cairo).
- **Assigning Organizers to localities** — When a user is assigned as an Organizer for a locality, their account is automatically updated with that locality's ID and label.
- **Managing all users** — Can view, block, or unblock any user.
- **Overseeing all events** — Can see all events regardless of status or locality.

The Master panel is the source of truth for which Organizer manages which locality.

---

### 🎟️ Organizer (Event Admin)

An Organizer is a user assigned by the Master to manage a specific locality. Their responsibilities include:

- **Creating events** — Events created by an Organizer are automatically published with their Master-assigned locality. The Organizer cannot change the locality.
- **Managing their events** — Edit, cancel, or schedule events within their locality.
- **Revealing venues** — After scheduling, the Organizer reveals the venue to booked attendees.
- **Managing attendees** — View booked Friends, send notifications.

> **Important:** An Organizer's event locality is **always inherited** from the Master's assignment. The Organizer cannot edit it — it appears as a read-only field in the event creation form.

---

### 👥 Friend (Regular User)

A Friend is a regular member of the community. Their experience includes:

- **Setting their locality** — In their profile, a Friend selects the locality they want to browse events for (e.g., Egypt → Cairo → New Cairo).
- **Discovering events** — The Dashboard and Events tab both show published events from the Friend's chosen locality only.
- **Booking events** — Friends can RSVP to events and see their bookings on the Dashboard.
- **Submitting events** — Friends can submit event suggestions (pending Organizer approval).
- **Rating events** — After events, Friends can rate their experience.

---

## How Locality Works

Locality is a hierarchical geographic identifier in the format:

```
Egypt → Cairo → New Cairo
```

### Organizer Locality

1. The Master creates a locality record (country → city → area).
2. The Master assigns one or more users as Organizers for that locality.
3. When assigned, the user's profile is automatically updated with:
   - `organizerLocalityId` — the Firestore ID of the locality document
   - `organizerLocalityLabel` — the human-readable label (e.g., "Egypt → Cairo → New Cairo")
4. When an Organizer creates an event, the event's `locality` field is set to `organizerLocalityLabel`.
5. The locality field is **read-only** in the event creation form — Organizers cannot change it.

### Friend Locality

1. A Friend selects their area in their profile (from the list of active localities).
2. Their profile is updated with:
   - `localityId` — the Firestore ID of the locality document
   - `localityLabel` — the human-readable label (e.g., "Egypt → Cairo → New Cairo")
3. The Dashboard and Events tab filter events using `event.locality === userProfile.localityLabel`.
4. Only published events from the Friend's chosen locality are shown.

### Why these are separate

- `organizerLocalityId` / `organizerLocalityLabel` → controls which area an Organizer manages (set by Master, not editable by the Organizer).
- `localityId` / `localityLabel` → controls which events a Friend sees (set by the Friend in their profile).

These fields are intentionally separate and must not be confused or mixed.

---

## Major Flows

### 1. Assigning an Organizer to a Locality

```
Master → Super Admin Panel → Localities
  → Create or Edit locality (country, city, area)
  → Assign user(s) as Organizer
  → Save
  → System writes organizerLocalityId + organizerLocalityLabel to the user's Firestore doc
  → Organizer receives email notification
```

### 2. Organizer Creates an Event

```
Organizer → Events tab → Create Event
  → Fills in title, description, type, date, venue, price
  → Locality is shown as read-only (inherited from Master assignment)
  → Submits
  → Event is saved to Firestore with status = "published" and locality = organizerLocalityLabel
  → Email sent to all Friends in that locality
```

### 3. Friend Browses Events

```
Friend → Profile → Select Locality
  → Saves localityId + localityLabel to their profile

Friend → Dashboard
  → "Events in Your Area" section shows upcoming published events in their locality
  → "Upcoming RSVP'd Events" section shows events they've booked

Friend → Events tab
  → Shows all published events filtered by their profile locality
  → Can book events directly from here
```

### 4. Locality-Based Visibility

- Only events where `event.locality === userProfile.localityLabel` are shown to a Friend.
- Events from other localities are not shown in Friend-facing views.
- Organizers and Masters see all events regardless of locality.

---

## Screenshots

### Master Panel — Locality Management

![Master Panel](docs/screenshots/master-panel.png)

*The Master creates localities and assigns Organizers. Each locality entry shows the country, city, and area.*

---

### Organizer Event Creation — Read-Only Locality

![Organizer Event Creation](docs/screenshots/organizer-create-event.png)

*When an Organizer creates an event, the Locality field is read-only. It is inherited from their Master-assigned locality and cannot be changed.*

---

### Friend Dashboard — Events in Your Area

![Friend Dashboard](docs/screenshots/friend-dashboard.png)

*The Friend's dashboard shows two sections: "Events in Your Area" (locality-filtered discovery) and "Upcoming RSVP'd Events" (booked events).*

---

### Friend Events Tab — Locality-Filtered List

![Friend Events Tab](docs/screenshots/friend-events-tab.png)

*The Events tab shows all published events in the Friend's chosen locality. Friends can book directly from this view.*

---

### Friend Profile — Locality Selection

![Friend Profile Locality](docs/screenshots/friend-profile-locality.png)

*Friends select their area in the profile page. This controls which events they see on the Dashboard and Events tab.*

---

## Architecture

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19.x (Create React App) |
| State Management | React Context API (`AuthContext`) |
| Backend | Firebase (Firestore, Auth, Storage) |
| Database | Firestore (NoSQL, real-time) |
| Authentication | Google Sign-In + Anonymous |
| Storage | Firebase Storage (profile photos) |
| Internationalization | i18next (English + Arabic) |

### Component Structure

```
src/
├── components/
│   ├── SuperAdminPanel.js   # Master: locality management, organizer assignment
│   ├── AdminPanel.js        # Organizer: member management, event oversight
│   ├── EventsScreen.js      # Event creation (organizer) and discovery (friend)
│   ├── Dashboard.js         # Friend dashboard with locality-filtered events
│   ├── UserProfile.js       # Profile editing, locality selection (friend)
│   ├── LoginForm.js         # Authentication
│   ├── LandingPage.js       # Public landing page
│   ├── RatingFlow.js        # Post-event ratings
│   └── InterestsEditor.js   # Interest tags editor
├── contexts/
│   └── AuthContext.js       # Auth state, user profile, role helpers
├── services/
│   ├── emailService.js      # Email notifications (organizer assignment, events)
│   └── aiScheduling.js      # AI-powered event scheduling
├── models/
│   └── index.js             # Data models, enums, factory functions
├── firebase.js              # Firebase config
├── i18n.js                  # Translations (en/ar)
└── App.js                   # Root component, navigation
```

### Key Data Models

**User Profile (`users/{uid}`)**
```javascript
{
  role: 'super_admin' | 'event_admin' | 'friend',

  // Organizer-specific (set by Master)
  organizerLocalityId: 'firestore-locality-doc-id',
  organizerLocalityLabel: 'Egypt → Cairo → New Cairo',

  // Friend-specific (set by Friend in profile)
  localityId: 'firestore-locality-doc-id',
  localityLabel: 'Egypt → Cairo → New Cairo',
}
```

**Event (`events/{eventId}`)**
```javascript
{
  title: 'Friday Movie Night',
  type: 'movie_night',
  locality: 'Egypt → Cairo → New Cairo',  // inherited from Organizer
  status: 'published' | 'pending_approval' | 'cancelled' | 'completed',
  createdBy: 'organizer-uid',
  dateTime: '2025-11-01T19:00:00.000Z',
  price: 150,
  currency: 'EGP',
}
```

**Locality (`localities/{localityId}`)**
```javascript
{
  country: 'Egypt',
  city: 'Cairo',
  area: 'New Cairo',
  adminIds: ['organizer-uid-1', 'organizer-uid-2'],
}
```

---

## Setup & Running

### Prerequisites

- Node.js v14 or higher
- A Firebase project with Authentication (Google + Anonymous), Firestore, and Storage enabled

### Installation

```bash
git clone <repository-url>
cd timeleftegypt
npm install
```

### Firebase Configuration

Update `src/firebase.js` with your Firebase project credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

### Start Development Server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Initial Setup

1. Sign in with Google.
2. In Firestore, manually set your user document's `role` field to `super_admin` to become the Master.
3. Create localities in the Super Admin Panel.
4. Assign users as Organizers for each locality.

---

## Deployment

### Firebase Hosting

```bash
npm run build
firebase deploy
```

### Other Platforms

The app builds to a static bundle and can be deployed to Netlify, Vercel, AWS Amplify, or any static hosting service.

---

## Firestore Security Rules (Recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    // Events: public read for published, write restricted to organizers
    match /events/{eventId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['event_admin', 'super_admin'];
    }
    // Bookings
    match /bookings/{bookingId} {
      allow read, write: if request.auth != null;
    }
    // Localities: read by all, write by super_admin only
    match /localities/{localityId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
    }
  }
}
```

---

Built with ❤️ for better community connections.


A modern web application for automatically assigning TimeLeft members to tables for reconnection events. Built with React and Firebase, this system helps organize small to medium-sized gatherings (2-25 people) by intelligently distributing participants across tables.

## ✨ Features

### 🔐 Authentication
- **Google Sign-In**: Full integration with Google authentication
- **Name-Based Entry**: Quick access by simply entering your name
- **Anonymous Support**: Users can participate without creating accounts

### 🎲 Smart Table Assignment
- **Automatic Assignment**: Intelligent algorithm distributes users evenly across tables
- **Configurable Table Size**: Admin can set maximum people per table (default: 5)
- **Location-Aware**: Optional location-based grouping for better reconnection
- **Round-Robin Distribution**: Ensures balanced table assignments

### 👤 User Profiles
- **Rich Profiles**: Full name, photo, gender, dietary preferences
- **Interest Matching**: Share hobbies, professional background
- **Photo Upload**: Firebase Storage integration for profile pictures
- **Location Tracking**: Automatic geolocation with user permission

### 🔧 Admin Panel
- **Settings Management**: Configure table size, location preferences
- **User Management**: View all users and their assignments
- **Table Shuffling**: Reorganize tables with different algorithms
- **Real-time Statistics**: Monitor participation and distribution
- **Bulk Operations**: Reassign all users or clear all tables

### 📱 Real-time Features
- **Live Updates**: See table assignments update in real-time
- **Table Switching**: Users can request to change tables
- **Member Visibility**: View all table companions with their details
- **Occupancy Tracking**: Real-time table capacity monitoring

## 🛠️ Technology Stack

- **Frontend**: React 19.2.0 with modern hooks
- **Styling**: Custom CSS with responsive design
- **Backend**: Firebase Suite
  - Authentication (Google + Anonymous)
  - Firestore (Real-time database)
  - Storage (Profile photos)
  - Hosting ready
- **Algorithm**: Modular table assignment system

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase project with Authentication, Firestore, and Storage enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd timeleftegypt
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Firebase Configuration**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Google provider)
   - Enable Firestore Database
   - Enable Storage
   - Update `src/firebase.js` with your Firebase config

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

### Firebase Setup

1. **Authentication**
   - Enable Google Sign-in provider
   - Enable Anonymous authentication

2. **Firestore Rules** (Basic setup - adjust for production)
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Users can read/write their own profile
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Anyone can read user profiles and tables
       match /users/{document=**} {
         allow read: if request.auth != null;
       }
       
       match /tables/{document=**} {
         allow read, write: if request.auth != null;
       }
       
       // Only admins can modify settings
       match /settings/{document=**} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && 
           request.auth.token.email in resource.data.adminEmails;
       }
     }
   }
   ```

3. **Storage Rules**
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /profile-photos/{userId}/{allPaths=**} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

## 🎯 Usage Guide

### For Regular Users

1. **Sign In**: Use Google or enter your name
2. **Complete Profile**: Add photo, preferences, and details
3. **Get Table Assignment**: Click to be assigned to a table
4. **Meet Your Table**: View your table companions
5. **Change Tables**: Request to switch if needed

### For Administrators

1. **Access Admin Panel**: Available in header navigation for admin users
2. **Configure Settings**: 
   - Set maximum people per table
   - Enable/disable location-based assignment
   - Manage admin email list
3. **Manage Users**: View all participants and their details
4. **Organize Tables**:
   - Reassign all users with fresh algorithm
   - Shuffle existing table assignments
   - Clear all assignments to start fresh

## 🏗️ Architecture

### Component Structure
```
src/
├── components/
│   ├── AdminPanel.js      # Admin dashboard and controls
│   ├── Dashboard.js       # Main user interface
│   ├── LoginForm.js       # Authentication interface
│   └── UserProfile.js     # Profile management
├── contexts/
│   └── AuthContext.js     # Authentication and data management
├── algorithms/
│   └── tableAssignment.js # Table assignment logic
├── firebase.js            # Firebase configuration
├── App.js                 # Main application component
└── App.css               # Styling
```

### Data Models

**User Profile**
```javascript
{
  id: "user-id",
  email: "user@example.com",
  displayName: "John Doe",
  fullName: "John Michael Doe",
  photoURL: "https://...",
  gender: "male",
  preferences: {
    dietary: "vegetarian",
    interests: "Technology, Travel",
    experience: "Software Engineer"
  },
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 10
  },
  isAnonymous: false,
  createdAt: "2025-10-30T...",
  lastUpdated: "2025-10-30T..."
}
```

**Table Assignment**
```javascript
{
  id: "table-1",
  name: "Table 1",
  members: [
    {
      id: "user-id",
      name: "John Doe",
      fullName: "John Michael Doe",
      photoURL: "https://...",
      gender: "male",
      preferences: {...}
    }
  ]
}
```

**Settings**
```javascript
{
  maxPeoplePerTable: 5,
  considerLocation: false,
  adminEmails: ["admin@example.com"]
}
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file for production deployment:
```
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Admin Configuration
To set up admin users:
1. Go to Firestore Console
2. Create a document in `settings/main`
3. Add field `adminEmails` as an array of email addresses

## 📱 Responsive Design

The application is fully responsive and works on:
- **Desktop**: Full feature set with optimal layout
- **Tablet**: Adapted grid layouts and touch-friendly controls
- **Mobile**: Stacked layouts with simplified navigation

## 🎨 Customization

### Styling
- Modern CSS with custom properties
- Gradient themes and smooth animations
- Easy color scheme modification in `App.css`

### Algorithm
The table assignment algorithm is modular (`src/algorithms/tableAssignment.js`):
- **Round-robin**: Even distribution
- **Location-based**: Geographic clustering
- **Shuffle**: Random redistribution
- **Custom**: Easy to extend for new strategies

## 🚀 Deployment

### Firebase Hosting
```bash
npm run build
firebase deploy
```

### Other Platforms
The app can be deployed to:
- Netlify
- Vercel
- AWS Amplify
- Any static hosting service

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the Firebase documentation for backend issues
- Review the React documentation for frontend questions

## 🔮 Future Enhancements

- **QR Code Check-in**: Quick mobile access
- **Table Chat**: In-app messaging between table members
- **Event Templates**: Predefined configurations for different event types
- **Analytics Dashboard**: Detailed insights on reconnection patterns
- **Integration APIs**: Connect with event management platforms
- **Multi-language Support**: Internationalization
- **Advanced Matching**: AI-powered compatibility matching
- **Table Recommendations**: Suggest optimal table switches

## 📊 Performance

- **Real-time Updates**: Firestore provides instant synchronization
- **Optimized Rendering**: React hooks and efficient state management
- **Responsive Images**: Automatic photo optimization
- **Minimal Bundle Size**: Optimized production builds

---

## Available Scripts (Create React App)

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

---

Built with ❤️ for better reconnection experiences.

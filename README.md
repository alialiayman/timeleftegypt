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

<img width="755" height="99" alt="image" src="https://github.com/user-attachments/assets/ed154f64-5cd7-438f-b584-8ba244b695f4" />

---

## Roles

### 🔑 Master (Super Admin)

The Master has full control over the system. Their responsibilities include:

- **Creating and managing localities** — Each locality is defined by a country, city, and area/district (e.g., Egypt → Cairo → New Cairo).
- **Assigning Organizers to localities** — When a user is assigned as an Organizer for a locality, their account is automatically updated with that locality's ID and label.
- **Managing all users** — Can view, block, or unblock any user.
- **Overseeing all events** — Can see all events regardless of status or locality.

The Master panel is the source of truth for which Organizer manages which locality.

<img width="1191" height="594" alt="image" src="https://github.com/user-attachments/assets/853490f2-d339-4a3d-91f5-90fb11e69d1c" />

---

### 🎟️ Organizer (Event Admin)

An Organizer is a user assigned by the Master to manage a specific locality. Their responsibilities include:

- **Creating events** — Events created by an Organizer are automatically published with their Master-assigned locality. The Organizer cannot change the locality.
- **Managing their events** — Edit, cancel, or schedule events within their locality.
- **Revealing venues** — After scheduling, the Organizer reveals the venue to booked attendees.
- **Managing attendees** — View booked Friends, send notifications.

> **Important:** An Organizer's event locality is **always inherited** from the Master's assignment. The Organizer cannot edit it — it appears as a read-only field in the event creation form.

<img width="1194" height="744" alt="image" src="https://github.com/user-attachments/assets/323e8f5f-56ce-4bbc-b071-d6b3f0324621" />

<img width="1089" height="436" alt="image" src="https://github.com/user-attachments/assets/fdb979ed-9743-41d3-a538-5bc8adf0f6a8" />

---

### 👥 Friend (Regular User)

A Friend is a regular member of the community. Their experience includes:

- **Setting their locality** — In their profile, a Friend selects the locality they want to browse events for (e.g., Egypt → Cairo → New Cairo).
- **Discovering events** — The Dashboard and Events tab both show published events from the Friend's chosen locality only.
- **Booking events** — Friends can RSVP to events and see their bookings on the Dashboard.
- **Submitting events** — Friends can submit event suggestions (pending Organizer approval).
- **Rating events** — After events, Friends can rate their experience.

<img width="1201" height="767" alt="image" src="https://github.com/user-attachments/assets/c75ed3c3-39b4-4d3e-ae7a-88d2c013cd5c" />

---

## How Locality Works

Locality is a hierarchical geographic identifier in the format:

```
Egypt → Cairo → New Cairo
```
<img width="1108" height="754" alt="image" src="https://github.com/user-attachments/assets/eb59ab2a-3298-48b5-80ae-0add406e9e8a" />

### Organizer Locality

1. The Master creates a locality record (country → city → area).
2. The Master assigns one or more users as Organizers for that locality.
3. When assigned, the user's profile is automatically updated with:
   - `organizerLocalityId` — the Firestore ID of the locality document
   - `organizerLocalityLabel` — the human-readable label (e.g., "Egypt → Cairo → New Cairo")
4. When an Organizer creates an event, the event's `locality` field is set to `organizerLocalityLabel`.
5. The locality field is **read-only** in the event creation form — Organizers cannot change it.

<img width="1063" height="783" alt="image" src="https://github.com/user-attachments/assets/33516327-9415-4201-8d86-565e3650dbbb" />


### Friend Locality

1. A Friend selects their area in their profile (from the list of active localities).
2. Their profile is updated with:
   - `localityId` — the Firestore ID of the locality document
   - `localityLabel` — the human-readable label (e.g., "Egypt → Cairo → New Cairo")
3. The Dashboard and Events tab filter events using `event.locality === userProfile.localityLabel`.
4. Only published events from the Friend's chosen locality are shown.

<img width="1197" height="721" alt="image" src="https://github.com/user-attachments/assets/0e04ce1f-13a2-4e99-982f-484a5a9195d8" />


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
<img width="1065" height="626" alt="image" src="https://github.com/user-attachments/assets/66f90865-5567-4d4e-940e-198fbd6a4351" />

### 2. Organizer Creates an Event

```
Organizer → Events tab → Create Event
  → Fills in title, description, type, date, venue, price
  → Locality is shown as read-only (inherited from Master assignment)
  → Submits
  → Event is saved to Firestore with status = "published" and locality = organizerLocalityLabel
  → Email sent to all Friends in that locality
```
<img width="972" height="731" alt="image" src="https://github.com/user-attachments/assets/4d4dc3df-1bc9-42e5-9223-11aa8a40c92b" />

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
<img width="1239" height="597" alt="image" src="https://github.com/user-attachments/assets/db0678bd-e98c-414a-9c2a-04bb2a3939ce" />

### 4. Locality-Based Visibility

- Only events where `event.locality === userProfile.localityLabel` are shown to a Friend.
- Events from other localities are not shown in Friend-facing views.
- Organizers and Masters see all events regardless of locality.

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
npx expo start
````

This will open the Expo Dev Tools.

You can then:

* Press `w` to open the web version
* Press `i` to run on iOS simulator
* Press `a` to run on Android emulator
* Or scan the QR code using Expo Go on your phone

---

### Initial Setup

1. Sign in with Google (or continue as guest if enabled).
2. In Firestore, manually set your user document's `role` field to `master` to become the Master.
3. Create localities in the Master panel.
4. Assign users as Organizers for each locality.

---

## Deployment

### Web (Firebase Hosting)

Build the web version:

```bash
npx expo export --platform web
```

This will generate a `dist` folder.

Deploy to Firebase:

```bash
firebase deploy
```

Make sure your `firebase.json` is configured with:

```json
{
  "hosting": {
    "public": "dist"
  }
}
```

---

### Mobile (iOS / Android)

#### iOS (TestFlight / App Store)

```bash
npx expo prebuild
```

Then open Xcode:

```bash
open ios/*.xcworkspace
```

Archive and upload via Xcode Organizer.

---

#### Android

```bash
npx expo prebuild
```

Then open Android Studio:

```bash
open android
```

Build APK/AAB from Android Studio.

---

### Other Platforms

The web build outputs static files in the `dist` folder and can be deployed to:

* Netlify
* Vercel
* AWS Amplify
* Any static hosting provider

```

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


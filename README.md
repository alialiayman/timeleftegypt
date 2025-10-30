# 🍽️ Dining Table Assignment System

A modern web application for automatically assigning candidates to dining tables for networking events. Built with React and Firebase, this system helps organize small to medium-sized gatherings (2-25 people) by intelligently distributing participants across tables.

## ✨ Features

### 🔐 Authentication
- **Google Sign-In**: Full integration with Google authentication
- **Name-Based Entry**: Quick access by simply entering your name
- **Anonymous Support**: Users can participate without creating accounts

### 🎲 Smart Table Assignment
- **Automatic Assignment**: Intelligent algorithm distributes users evenly across tables
- **Configurable Table Size**: Admin can set maximum people per table (default: 5)
- **Location-Aware**: Optional location-based grouping for better networking
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
- **Analytics Dashboard**: Detailed insights on networking patterns
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

Built with ❤️ for better networking experiences.

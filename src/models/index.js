/**
 * Gatherly Data Models
 * These define the shape of documents stored in Firestore.
 */

/**
 * @typedef {'super_admin' | 'event_admin' | 'friend'} UserRole
 */

/**
 * @typedef {'pending' | 'approved' | 'blocked'} LocationStatus
 */

/**
 * @typedef {'pending' | 'confirmed' | 'cancelled'} BookingStatus
 */

/**
 * @typedef {'like_a_lot' | 'like_a_little' | 'not_at_all'} RatingValue
 */

/**
 * @typedef {'dinner' | 'breakfast' | 'lunch' | 'movie_night' | 'paddle' | 'soiree' | 'coffee_meetup' | 'library_meetup'} EventType
 */

/** All supported event types */
export const EVENT_TYPES = [
  'dinner', 'breakfast', 'lunch', 'movie_night',
  'paddle', 'soiree', 'coffee_meetup', 'library_meetup'
];

/** All supported roles */
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  EVENT_ADMIN: 'event_admin',
  FRIEND: 'friend',
};

/** Location approval statuses */
export const LOCATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  BLOCKED: 'blocked',
};

/** Booking states */
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

/** Rating values */
export const RATING_VALUES = {
  LIKE_A_LOT: 'like_a_lot',
  LIKE_A_LITTLE: 'like_a_little',
  NOT_AT_ALL: 'not_at_all',
};

/**
 * User document (Firestore: users/{userId})
 * @typedef {Object} User
 * @property {string} id - Firebase UID
 * @property {string} email
 * @property {string} displayName
 * @property {string} fullName
 * @property {string} [photoURL]
 * @property {string} [gender] - 'male' | 'female' | 'other'
 * @property {string} [dateOfBirth] - YYYY-MM-DD
 * @property {string} [city]
 * @property {string} [phoneNumber]
 * @property {UserRole} role
 * @property {Object} preferences
 * @property {string} [preferences.dietary]
 * @property {string} [preferences.interests]
 * @property {string} [preferences.experience]
 * @property {string} [currentLocationId]
 * @property {LocationStatus} locationStatus - Approval status for current location
 * @property {boolean} isBlocked
 * @property {boolean} isAnonymous
 * @property {string} createdAt - ISO timestamp
 * @property {string} lastUpdated - ISO timestamp
 */
export const createUser = (overrides = {}) => ({
  id: '',
  email: '',
  displayName: '',
  fullName: '',
  photoURL: null,
  gender: '',
  dateOfBirth: '',
  city: '',
  phoneNumber: '',
  role: USER_ROLES.FRIEND,
  preferences: {
    dietary: '',
    interests: '',
    experience: '',
  },
  currentLocationId: null,
  locationStatus: LOCATION_STATUS.PENDING,
  isBlocked: false,
  isAnonymous: false,
  // Organizer-assigned locality (set by Master via locality management)
  organizerLocalityId: '',
  organizerLocalityLabel: '',
  // User's personal attendance locality (chosen in profile)
  localityId: '',
  localityLabel: '',
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  // Extended profile fields
  status: 'active',            // 'active' | 'blocked'
  eventsAttendedCount: 0,
  friendsMetCount: 0,
  relationshipStatus: '',      // 'single' | 'in_a_relationship' | 'married' | 'prefer_not_to_say'
  children: '',                // 'none' | '1' | '2' | '3+' | 'prefer_not_to_say'
  workIndustry: '',
  customPhotoUrl: '',          // user-uploaded photo (supplements Google photoURL)
  ...overrides,
});

/**
 * Location document (Firestore: locations/{locationId})
 * @typedef {Object} Location
 * @property {string} id
 * @property {string} country
 * @property {string} city
 * @property {string} district
 * @property {string} name - Venue/area display name
 * @property {string} [googleMapsLink]
 * @property {string} [description]
 * @property {string} [expectedTime]
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string} createdBy
 */
export const createLocation = (overrides = {}) => ({
  id: '',
  country: '',
  city: '',
  district: '',
  name: '',
  googleMapsLink: '',
  description: '',
  expectedTime: '',
  isActive: true,
  createdAt: new Date().toISOString(),
  createdBy: '',
  ...overrides,
});

/**
 * Event document (Firestore: events/{eventId})
 * @typedef {Object} GatherlyEvent
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {EventType} type
 * @property {string} locationId
 * @property {string} locationName
 * @property {string} dateTime - ISO timestamp
 * @property {number} maxAttendees
 * @property {number} currentAttendees
 * @property {number} price - 0 = free
 * @property {string} currency
 * @property {string} status - 'draft' | 'published' | 'cancelled' | 'completed'
 * @property {string} createdBy - Admin user ID
 * @property {string} createdAt
 * @property {string} lastUpdated
 * @property {string[]} attendeeIds
 * @property {Object[]} [schedulingGroups] - After AI scheduling
 */
export const createEvent = (overrides = {}) => ({
  id: '',
  title: '',
  description: '',
  type: 'dinner',
  // locality/localityId: area used for Friend event discovery (label + Firestore ID)
  locality: '',
  localityId: '',
  // locationId: optional Firestore reference to a physical venue location document
  // locationName: mirrors locality label for public display (backward-compat and post-reveal display)
  locationId: '',
  locationName: '',
  dateTime: '',
  maxAttendees: 20,
  currentAttendees: 0,
  price: 0,
  currency: 'EGP',
  status: 'draft',
  createdBy: '',
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  attendeeIds: [],
  // Venue scheduling fields
  venueGroups: [],
  locationRevealed: false,
  schedulingCompleted: false,
  ...overrides,
});

/**
 * Booking document (Firestore: bookings/{bookingId})
 * @typedef {Object} Booking
 * @property {string} id
 * @property {string} userId
 * @property {string} eventId
 * @property {BookingStatus} status
 * @property {number} [amountPaid]
 * @property {string} [paymentRef]
 * @property {string} createdAt
 * @property {string} lastUpdated
 */
export const createBooking = (overrides = {}) => ({
  id: '',
  userId: '',
  eventId: '',
  status: BOOKING_STATUS.PENDING,
  amountPaid: 0,
  paymentRef: null,
  // Presence/late status after venue is revealed (set by friend)
  presenceStatus: null, // 'confirmed_present' | 'going_late' | null
  // Whether the friend actually attended the event (for future rating eligibility)
  actuallyAttended: null, // true | false | null (null = not yet recorded)
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  ...overrides,
});

/**
 * Rating document (Firestore: ratings/{ratingId})
 * @typedef {Object} Rating
 * @property {string} id
 * @property {string} fromUserId
 * @property {string} toUserId
 * @property {string} eventId
 * @property {RatingValue} value
 * @property {string} createdAt
 */
export const createRating = (overrides = {}) => ({
  id: '',
  fromUserId: '',
  toUserId: '',
  eventId: '',
  value: RATING_VALUES.LIKE_A_LITTLE,
  createdAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Approval document (Firestore: approvals/{approvalId})
 * Tracks location approval requests from users.
 * @typedef {Object} Approval
 * @property {string} id
 * @property {string} userId
 * @property {string} locationId
 * @property {'pending' | 'approved' | 'rejected'} status
 * @property {string} [reviewedBy]
 * @property {string} [reviewNote]
 * @property {string} createdAt
 * @property {string} [reviewedAt]
 */
export const createApproval = (overrides = {}) => ({
  id: '',
  userId: '',
  locationId: '',
  status: 'pending',
  reviewedBy: null,
  reviewNote: null,
  createdAt: new Date().toISOString(),
  reviewedAt: null,
  ...overrides,
});

/**
 * Block document (Firestore: blocks/{blockId})
 * @typedef {Object} Block
 * @property {string} id
 * @property {string} userId - The blocked user
 * @property {string} blockedBy - Admin who blocked them
 * @property {string} reason
 * @property {string} createdAt
 */
export const createBlock = (overrides = {}) => ({
  id: '',
  userId: '',
  blockedBy: '',
  reason: '',
  createdAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Appeal document (Firestore: appeals/{appealId})
 * Blocked users can submit appeals.
 * @typedef {Object} Appeal
 * @property {string} id
 * @property {string} userId
 * @property {string} message
 * @property {'pending' | 'approved' | 'rejected'} status
 * @property {string} [reviewedBy]
 * @property {string} createdAt
 * @property {string} [reviewedAt]
 */
export const createAppeal = (overrides = {}) => ({
  id: '',
  userId: '',
  message: '',
  status: 'pending',
  reviewedBy: null,
  createdAt: new Date().toISOString(),
  reviewedAt: null,
  ...overrides,
});

/**
 * ContactPermission document (Firestore: contactPermissions/{permId})
 * @typedef {Object} ContactPermission
 * @property {string} id
 * @property {string} requesterId
 * @property {string} targetUserId
 * @property {string} eventId
 * @property {'pending' | 'approved' | 'rejected'} status
 * @property {string} createdAt
 * @property {string} [reviewedAt]
 */
export const createContactPermission = (overrides = {}) => ({
  id: '',
  requesterId: '',
  targetUserId: '',
  eventId: '',
  status: 'pending',
  createdAt: new Date().toISOString(),
  reviewedAt: null,
  ...overrides,
});

/**
 * Notification document (Firestore: notifications/{notifId})
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} userId - Recipient user ID
 * @property {'connect_request' | 'venue_revealed' | 'general'} type
 * @property {string} [fromUserId] - Sender user ID (if applicable)
 * @property {string} [eventId] - Related event ID (if applicable)
 * @property {string} message
 * @property {boolean} read
 * @property {string} createdAt
 */
export const createNotification = (overrides = {}) => ({
  id: '',
  userId: '',
  type: 'general',
  fromUserId: '',
  eventId: '',
  message: '',
  read: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

/**
 * ConnectRequest document (Firestore: connectRequests/{reqId})
 * @typedef {Object} ConnectRequest
 * @property {string} id
 * @property {string} requesterId
 * @property {string} requesterName
 * @property {string} targetUserId
 * @property {'pending' | 'approved' | 'rejected'} status
 * @property {string} message
 * @property {string} createdAt
 * @property {string} [respondedAt]
 */
export const createConnectRequest = (overrides = {}) => ({
  id: '',
  requesterId: '',
  requesterName: '',
  targetUserId: '',
  status: 'pending',
  message: '',
  createdAt: new Date().toISOString(),
  respondedAt: null,
  ...overrides,
});

/**
 * SubscriptionPricing document (Firestore: settings/subscriptionPricing)
 * @typedef {Object} SubscriptionPricing
 * @property {number} price1Month
 * @property {number} price3Month
 * @property {number} price6Month
 * @property {string} currency
 * @property {Array<{code: string, discount: number}>} promoCodes
 * @property {string} updatedAt
 * @property {string} updatedBy
 */
export const createSubscriptionPricing = (overrides = {}) => ({
  price1Month: 0,
  price3Month: 0,
  price6Month: 0,
  currency: 'EGP',
  promoCodes: [],
  updatedAt: new Date().toISOString(),
  updatedBy: '',
  ...overrides,
});

/**
 * VenueGroup — embedded in event.venueGroups after shuffler runs
 * @typedef {Object} VenueGroup
 * @property {string} groupId
 * @property {string} groupName
 * @property {string[]} attendeeIds
 * @property {string} venueName
 * @property {string} venueAddress
 * @property {string} mapUrl
 * @property {boolean} locationRevealed
 */
export const createVenueGroup = (overrides = {}) => ({
  groupId: '',
  groupName: '',
  attendeeIds: [],
  venueName: '',
  venueAddress: '',
  mapUrl: '',
  locationRevealed: false,
  ...overrides,
});

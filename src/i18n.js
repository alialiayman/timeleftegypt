import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // App
      appName: 'Gatherly',
      loading: 'Loading...',
      loadingProfile: 'Loading profile...',
      welcome: 'Welcome, {{name}}!',
      logout: 'Logout',

      // Navigation
      dashboard: 'Dashboard',
      profile: 'Profile',
      admin: 'Admin',
      events: 'Events',

      // Auth
      signIn: 'Sign In',
      signInWithGoogle: 'Sign in with Google',
      signInTagline: 'Connect through real-world experiences',

      // Dashboard
      upcomingEvents: 'Upcoming Events',
      myBookings: 'My Bookings',
      noEvents: 'No upcoming events',
      bookEvent: 'Book',
      cancelBooking: 'Cancel Booking',

      // Events
      eventBrowse: 'Browse Events',
      eventCreate: 'Create Event',
      eventDetails: 'Event Details',
      eventType: 'Event Type',
      eventTitle: 'Title',
      eventDescription: 'Description',
      eventDate: 'Date & Time',
      eventLocation: 'Location',
      eventMaxAttendees: 'Max Attendees',
      eventPrice: 'Price',
      eventFree: 'Free',
      eventPublish: 'Publish Event',
      eventEdit: 'Edit Event',
      eventCancel: 'Cancel Event',
      spotsLeft: '{{count}} spots left',
      fullyBooked: 'Fully Booked',

      // Booking
      bookingConfirm: 'Confirm Booking',
      bookingSuccess: 'Booking confirmed!',
      bookingCancel: 'Cancel Booking',
      bookingStatus: 'Booking Status',
      bookingPending: 'Pending',
      bookingConfirmed: 'Confirmed',
      bookingCancelled: 'Cancelled',

      // Rating
      rateAttendees: 'Rate Attendees',
      rateLikeALot: 'Like a lot ❤️',
      rateLikeALittle: 'Like a little 👍',
      rateNotAtAll: 'Not at all 👎',
      ratingSubmitted: 'Rating submitted!',

      // Location
      selectLocation: 'Select Location',
      locationApproval: 'Location Approval',
      locationPending: 'Approval Pending',
      locationApproved: 'Approved',
      locationBlocked: 'Blocked',
      awaitingApproval: 'Your location is awaiting admin approval.',
      locationChange: 'Change Location',

      // Profile
      editProfile: 'Edit Profile',
      displayName: 'Display Name',
      fullName: 'Full Name',
      phone: 'Phone Number',
      city: 'City',
      gender: 'Gender',
      interests: 'Interests',
      dietary: 'Dietary Preferences',
      experience: 'Background',
      saveProfile: 'Save Profile',

      // Admin
      adminPanel: 'Admin Panel',
      manageEvents: 'Manage Events',
      manageUsers: 'Manage Users',
      manageLocations: 'Manage Locations',
      approvals: 'Approvals',
      userBlocks: 'User Blocks',
      scheduling: 'Scheduling',
      runScheduling: 'Run AI Scheduling',

      // Errors
      errorGeneral: 'Something went wrong. Please try again.',
      errorAuth: 'Authentication failed.',
      errorBooking: 'Booking failed.',
      submitRatings: 'Submit Ratings',
    }
  },
  ar: {
    translation: {
      // App
      appName: 'جاذيرلي',
      loading: 'جارٍ التحميل...',
      loadingProfile: 'جارٍ تحميل الملف الشخصي...',
      welcome: 'أهلاً، {{name}}!',
      logout: 'تسجيل الخروج',

      // Navigation
      dashboard: 'الرئيسية',
      profile: 'الملف الشخصي',
      admin: 'الإدارة',
      events: 'الفعاليات',

      // Auth
      signIn: 'تسجيل الدخول',
      signInWithGoogle: 'الدخول بـ Google',
      signInTagline: 'تواصل من خلال تجارب حقيقية',

      // Dashboard
      upcomingEvents: 'الفعاليات القادمة',
      myBookings: 'حجوزاتي',
      noEvents: 'لا توجد فعاليات قادمة',
      bookEvent: 'احجز',
      cancelBooking: 'إلغاء الحجز',

      // Events
      eventBrowse: 'تصفح الفعاليات',
      eventCreate: 'إنشاء فعالية',
      eventDetails: 'تفاصيل الفعالية',
      eventType: 'نوع الفعالية',
      eventTitle: 'العنوان',
      eventDescription: 'الوصف',
      eventDate: 'التاريخ والوقت',
      eventLocation: 'الموقع',
      eventMaxAttendees: 'الحد الأقصى للحضور',
      eventPrice: 'السعر',
      eventFree: 'مجاني',
      eventPublish: 'نشر الفعالية',
      eventEdit: 'تعديل الفعالية',
      eventCancel: 'إلغاء الفعالية',
      spotsLeft: 'متبقي {{count}} مقعد',
      fullyBooked: 'مكتملة',

      // Booking
      bookingConfirm: 'تأكيد الحجز',
      bookingSuccess: 'تم الحجز بنجاح!',
      bookingCancel: 'إلغاء الحجز',
      bookingStatus: 'حالة الحجز',
      bookingPending: 'في الانتظار',
      bookingConfirmed: 'مؤكد',
      bookingCancelled: 'ملغى',

      // Rating
      rateAttendees: 'تقييم الحاضرين',
      rateLikeALot: 'أعجبني كثيراً ❤️',
      rateLikeALittle: 'أعجبني قليلاً 👍',
      rateNotAtAll: 'لم يعجبني 👎',
      ratingSubmitted: 'تم إرسال التقييم!',

      // Location
      selectLocation: 'اختر الموقع',
      locationApproval: 'اعتماد الموقع',
      locationPending: 'في انتظار الاعتماد',
      locationApproved: 'معتمد',
      locationBlocked: 'محظور',
      awaitingApproval: 'موقعك في انتظار اعتماد المشرف.',
      locationChange: 'تغيير الموقع',

      // Profile
      editProfile: 'تعديل الملف',
      displayName: 'الاسم المعروض',
      fullName: 'الاسم الكامل',
      phone: 'رقم الهاتف',
      city: 'المدينة',
      gender: 'الجنس',
      interests: 'الاهتمامات',
      dietary: 'التفضيلات الغذائية',
      experience: 'الخلفية المهنية',
      saveProfile: 'حفظ الملف',

      // Admin
      adminPanel: 'لوحة التحكم',
      manageEvents: 'إدارة الفعاليات',
      manageUsers: 'إدارة المستخدمين',
      manageLocations: 'إدارة المواقع',
      approvals: 'الاعتمادات',
      userBlocks: 'المحظورون',
      scheduling: 'الجدولة',
      runScheduling: 'تشغيل الجدولة الذكية',

      // Errors
      errorGeneral: 'حدث خطأ. يرجى المحاولة مجدداً.',
      errorAuth: 'فشل التحقق من الهوية.',
      errorBooking: 'فشل الحجز.',
      submitRatings: 'إرسال التقييمات',
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

/**
 * Barrel Export — Screens
 * Satu titik impor pusat untuk seluruh screen di aplikasi.
 */

// Auth Screens
export { default as RoleSelectionScreen } from './auth/RoleSelectionScreen';
export { default as LoginScreen } from './auth/LoginScreen';
export { default as DoctorLoginScreen } from './auth/DoctorLoginScreen';
export { default as AdminGateScreen } from './auth/AdminGateScreen';
export { default as AdminLoginScreen } from './auth/AdminLoginScreen';

// User Screens
export { default as HomeScreen } from './user/HomeScreen';
export { default as BookAppointmentScreen } from './user/BookAppointmentScreen';
export { default as ProfileScreen } from './user/ProfileScreen';

// Admin Screens
export { default as AdminUserScreen } from './admin/AdminUserScreen';

// Shared Screens
export { default as MyAppointmentsScreen } from './shared/MyAppointmentsScreen';
export { default as MainTabNavigator } from './shared/MainTabNavigator';

// Doctor Screens
export { default as DoctorMainNavigator } from './doctor/DoctorMainNavigator';


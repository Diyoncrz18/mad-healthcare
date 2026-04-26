import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';

import {
  RoleSelectionScreen,
  LoginScreen,
  DoctorLoginScreen,
  AdminGateScreen,
  AdminLoginScreen,
  HomeScreen,
  BookAppointmentScreen,
  MyAppointmentsScreen,
  DoctorMainNavigator,
  MainTabNavigator,
  DoctorNotificationsScreen,
  DoctorNotificationDetailScreen,
  DoctorScheduleScreen,
  EditProfileScreen,
  NotificationSettingsScreen,
  HelpCenterScreen,
  AboutAppScreen,
} from './Screens';

export type RootStackParamList = {
  RoleSelection: undefined;
  Login: undefined;
  DoctorLogin: undefined;
  AdminGate: undefined;
  AdminLogin: undefined;
  MainTabs: undefined;
  Home: undefined;
  BookAppointment: undefined;
  MyAppointments: undefined;
  DoctorMain: undefined;
  DoctorNotifications: undefined;
  DoctorNotificationDetail: { notificationId: string };
  DoctorSchedule: undefined;
  EditProfile: undefined;
  NotificationSettings: undefined;
  HelpCenter: undefined;
  AboutApp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type UserRole = 'user' | 'admin' | 'doctor' | null;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);

  useEffect(() => {
    // Ambil sesi saat app dibuka
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const r = session?.user?.user_metadata?.role ?? null;
      setRole(r);
    });

    // Dengarkan perubahan state auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const r = session?.user?.user_metadata?.role ?? null;
      setRole(r);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Tentukan screen awal berdasarkan role:
   * - 'doctor'  → DoctorMain (portal dokter)
   * - 'admin'   → MainTabs  (admin sudah di dalam MainTabNavigator)
   * - 'user'    → MainTabs  (portal pasien)
   * - null      → RoleSelection
   */
  const getInitialRoute = (): keyof RootStackParamList => {
    if (!session) return 'RoleSelection';
    if (role === 'doctor') return 'DoctorMain';
    return 'MainTabs';
  };

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={getInitialRoute()}>
        {session && session.user ? (
          <>
            {role === 'doctor' ? (
              /* ── Portal Dokter ── */
              <>
                <Stack.Screen
                  name="DoctorMain"
                  component={DoctorMainNavigator}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="DoctorNotifications"
                  component={DoctorNotificationsScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="DoctorNotificationDetail"
                  component={DoctorNotificationDetailScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="DoctorSchedule"
                  component={DoctorScheduleScreen}
                  options={{ headerShown: false }}
                />
              </>
            ) : (
              /* ── Portal Pasien / Admin ── */
              <>
                <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
                <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
                <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ title: 'Reservasi Baru' }} />
                <Stack.Screen name="MyAppointments" component={MyAppointmentsScreen} options={{ title: 'Riwayat & Antrean' }} />
              </>
            )}

            {/* ── Shared Detail Screens (semua role) ── */}
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AboutApp" component={AboutAppScreen} options={{ headerShown: false }} />
            
          </>
        ) : (
          /* ── Belum Login ── */
          <>
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="DoctorLogin" component={DoctorLoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AdminGate" component={AdminGateScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AdminLogin" component={AdminLoginScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
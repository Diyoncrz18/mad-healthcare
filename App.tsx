import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';
import PatientCallListener from './Screens/shared/PatientCallListener';

import {
  RoleSelectionScreen,
  LoginScreen,
  DoctorLoginScreen,
  AdminGateScreen,
  AdminLoginScreen,
  HomeScreen,
  BookAppointmentScreen,
  ClinicSpecialtiesScreen,
  MyAppointmentsScreen,
  DoctorMainNavigator,
  MainTabNavigator,
  DoctorNotificationsScreen,
  DoctorNotificationDetailScreen,
  DoctorScheduleScreen,
  DoctorEarningsScreen,
  EditProfileScreen,
  NotificationSettingsScreen,
  HelpCenterScreen,
  AboutAppScreen,
  ChatDetailScreen,
  AdminActivityDetailScreen,
} from './Screens';

export type RootStackParamList = {
  RoleSelection: undefined;
  Login: undefined;
  DoctorLogin: undefined;
  AdminGate: undefined;
  AdminLogin: undefined;
  MainTabs: undefined;
  Home: undefined;
  BookAppointment: { doctorId?: string; specialtyKey?: string } | undefined;
  ClinicSpecialties: { specialtyKey?: string } | undefined;
  MyAppointments: undefined;
  AdminActivityDetail: undefined;
  DoctorMain: undefined;
  DoctorNotifications: undefined;
  DoctorNotificationDetail: { notificationId: string };
  DoctorSchedule: undefined;
  DoctorEarnings: undefined;
  EditProfile: undefined;
  NotificationSettings: undefined;
  HelpCenter: undefined;
  AboutApp: undefined;
  ChatDetail: {
    conversationId: string;
    title?: string;
    contactRole?: 'doctor' | 'user';
    contactUserId?: string;
  };
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
    <>
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
                <Stack.Screen
                  name="DoctorEarnings"
                  component={DoctorEarningsScreen}
                  options={{ headerShown: false }}
                />
              </>
            ) : (
              /* ── Portal Pasien / Admin ── */
              <>
                <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
                <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
                <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ title: 'Reservasi Baru' }} />
                <Stack.Screen name="ClinicSpecialties" component={ClinicSpecialtiesScreen} options={{ headerShown: false }} />
                <Stack.Screen name="MyAppointments" component={MyAppointmentsScreen} options={{ title: 'Riwayat & Antrean' }} />
                <Stack.Screen name="AdminActivityDetail" component={AdminActivityDetailScreen} options={{ headerShown: false }} />
              </>
            )}

            {/* ── Shared Detail Screens (semua role) ── */}
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AboutApp" component={AboutAppScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ headerShown: false }} />

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
    {session && role === 'user' && <PatientCallListener />}
    </>
  );
}

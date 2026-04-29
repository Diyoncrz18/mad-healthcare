/**
 * DoctorMainNavigator — Bottom Tab navigator untuk Portal Dokter.
 * Konsisten dengan tab navigator pasien (rounded surface, brand teal accent).
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';

import DoctorDashboardScreen from './DoctorDashboardScreen';
import DoctorAppointmentsScreen from './DoctorAppointmentsScreen';
import DoctorEarningsScreen from './DoctorEarningsScreen';
import DoctorProfileScreen from './DoctorProfileScreen';
import ChatListScreen from '../shared/ChatListScreen';

const Tab = createBottomTabNavigator();

const TabBarButton = (
  props: BottomTabBarButtonProps & {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
) => {
  const { accessibilityState, onPress, label, icon } = props;
  const isSelected = !!accessibilityState?.selected;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[styles.pill, isSelected && styles.pillActive]}>
        <Ionicons
          name={isSelected ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)}
          size={20}
          color={isSelected ? '#FFFFFF' : COLORS.textMuted}
        />
        {isSelected && <Text style={[styles.label, { color: '#FFFFFF' }]}>{label}</Text>}
      </View>
    </TouchableOpacity>
  );
};

export default function DoctorMainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="DoctorDashboard"
        component={DoctorDashboardScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Beranda" icon="home" />
          ),
        }}
      />
      <Tab.Screen
        name="DoctorChat"
        component={ChatListScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Pesan" icon="chatbubbles" />
          ),
        }}
      />
      <Tab.Screen
        name="DoctorAppointments"
        component={DoctorAppointmentsScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Antrean" icon="calendar" />
          ),
        }}
      />
      <Tab.Screen
        name="DoctorEarnings"
        component={DoctorEarningsScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Pendapatan" icon="trending-up" />
          ),
        }}
      />
      <Tab.Screen
        name="DoctorProfile"
        component={DoctorProfileScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Profil" icon="person" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: LAYOUT.bottomTabHeight,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderTopWidth: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    position: 'absolute',
    ...SHADOWS.lg,
  },
  btn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    gap: SPACING.xs + 2,
  },
  pillActive: { backgroundColor: COLORS.primary },
  label: { ...TYPO.labelSm, color: COLORS.primary },
});

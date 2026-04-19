import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS } from '../constants/theme';

import DoctorDashboardScreen from './DoctorDashboardScreen';
import DoctorAppointmentsScreen from './DoctorAppointmentsScreen';
import DoctorProfileScreen from './DoctorProfileScreen';

const Tab = createBottomTabNavigator();

const TabBarButton = (
  props: BottomTabBarButtonProps & { label: string; icon: keyof typeof Ionicons.glyphMap }
) => {
  const { accessibilityState, onPress, label, icon } = props;
  const isSelected = accessibilityState?.selected;

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.tabButton}>
      <View style={[styles.tabContent, isSelected && styles.tabContentActive]}>
        <Ionicons
          name={isSelected ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)}
          size={22}
          color={isSelected ? COLORS.doctorPrimary : COLORS.textMuted}
        />
        {isSelected && <Text style={styles.tabLabel}>{label}</Text>}
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
          tabBarButton: (props) => <TabBarButton {...props} label="Dashboard" icon="home" />,
        }}
      />
      <Tab.Screen
        name="DoctorAppointments"
        component={DoctorAppointmentsScreen}
        options={{
          tabBarButton: (props) => <TabBarButton {...props} label="Antrean" icon="calendar" />,
        }}
      />
      <Tab.Screen
        name="DoctorProfile"
        component={DoctorProfileScreen}
        options={{
          tabBarButton: (props) => <TabBarButton {...props} label="Profil" icon="person" />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
    height: 80,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 0,
    position: 'absolute',
    ...SHADOWS.lg,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  tabContentActive: {
    backgroundColor: COLORS.doctorPrimaryLight,
  },
  tabLabel: {
    ...FONTS.label,
    fontSize: 13,
    color: COLORS.doctorPrimary,
    marginLeft: SPACING.xs,
  },
});

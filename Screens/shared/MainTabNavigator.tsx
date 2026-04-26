/**
 * MainTabNavigator — Bottom tab untuk Pasien & Admin.
 * Tab bar dengan brand teal accent, fluid pill highlight pada tab aktif.
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { getCurrentUser } from '../services/authService';

import HomeScreen from '../user/HomeScreen';
import MyAppointmentsScreen from '../shared/MyAppointmentsScreen';
import ProfileScreen from '../user/ProfileScreen';
import AdminUserScreen from '../admin/AdminUserScreen';

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
          color={isSelected ? COLORS.primary : COLORS.textMuted}
        />
        {isSelected && <Text style={styles.label}>{label}</Text>}
      </View>
    </TouchableOpacity>
  );
};

export default function MainTabNavigator() {
  const [isUser, setIsUser] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setIsUser((user.user_metadata?.role || 'user') === 'user');
      }
    };
    fetchUser();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={HomeScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Beranda" icon="home" />
          ),
        }}
      />
      {isUser && (
        <Tab.Screen
          name="AppointmentsTab"
          component={MyAppointmentsScreen}
          options={{
            tabBarButton: (props) => (
              <TabBarButton {...props} label="Jadwal" icon="calendar" />
            ),
          }}
        />
      )}
      {!isUser && (
        <Tab.Screen
          name="UsersTab"
          component={AdminUserScreen}
          options={{
            tabBarButton: (props) => (
              <TabBarButton {...props} label="Users" icon="people-circle" />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
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
  pillActive: { backgroundColor: COLORS.primaryLight },
  label: { ...TYPO.labelSm, color: COLORS.primary },
});

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS } from '../constants/theme';
import { getCurrentUser } from '../services/authService';

import HomeScreen from '../user/HomeScreen';
import MyAppointmentsScreen from '../shared/MyAppointmentsScreen';
import ProfileScreen from '../user/ProfileScreen';
import AdminUserScreen from '../admin/AdminUserScreen';

const Tab = createBottomTabNavigator();

const TabBarButton = (props: BottomTabBarButtonProps & { label: string; icon: keyof typeof Ionicons.glyphMap; isUser: boolean }) => {
  const { accessibilityState, onPress, label, icon, isUser } = props;
  const isSelected = accessibilityState?.selected;
  const primaryColor = isUser ? COLORS.userPrimary : COLORS.adminPrimary;
  const primaryLightColor = isUser ? COLORS.userPrimaryLight : COLORS.adminPrimaryLight;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.tabButton}
    >
      <View style={[styles.tabContent, isSelected && { backgroundColor: primaryLightColor }]}>
        <Ionicons
          name={isSelected ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)}
          size={24}
          color={isSelected ? primaryColor : COLORS.textMuted}
        />
        {isSelected && (
          <Text style={[styles.tabLabel, { color: primaryColor }]}>{label}</Text>
        )}
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
          tabBarButton: (props) => <TabBarButton {...props} label="Beranda" icon="home" isUser={isUser} />,
        }}
      />
      {isUser && (
        <Tab.Screen
          name="AppointmentsTab"
          component={MyAppointmentsScreen}
          options={{
            tabBarButton: (props) => <TabBarButton {...props} label="Jadwal" icon="calendar" isUser={isUser} />,
          }}
        />
      )}
      {!isUser && (
        <Tab.Screen
          name="UsersTab"
          component={AdminUserScreen}
          options={{
            tabBarButton: (props) => <TabBarButton {...props} label="Users" icon="people-circle" isUser={isUser} />,
          }}
        />
      )}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarButton: (props) => <TabBarButton {...props} label="Profil" icon="person" isUser={isUser} />,
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
    height: 48,
  },
  tabLabel: {
    ...FONTS.label,
    fontSize: 14,
    marginLeft: SPACING.xs,
  },
});

/**
 * DoctorMainNavigator — Bottom Tab navigator untuk Portal Dokter.
 * Konsisten dengan tab navigator pasien (rounded surface, brand teal accent).
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, LayoutAnimation, Platform, UIManager } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNavigationState } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { useChatUnreadCount } from '../services/chatService';

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
    routeName: string;
    /** Angka kecil di pojok kanan atas icon. 0 = tidak tampil. */
    badge?: number;
  }
) => {
  const { onPress, label, icon, routeName, badge = 0 } = props;
  
  const isSelected = useNavigationState((state) => {
    if (!state) return false;
    const currentRoute = state.routes[state.index];
    return currentRoute.name === routeName;
  });

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [isSelected]);

  const activeColor = COLORS.primary;
  const inactiveColor = '#94A3B8'; // Abu-abu netral
  const backgroundColor = isSelected ? COLORS.brand50 : 'transparent';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} pesan baru` : label}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[styles.iconContainer, { backgroundColor, padding: 12, borderRadius: RADIUS.pill }]}>
        <Ionicons
          name={isSelected ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)}
          size={26}
          color={isSelected ? activeColor : inactiveColor}
        />
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function DoctorMainNavigator() {
  const { count: chatUnread } = useChatUnreadCount();
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
            <TabBarButton {...props} label="Beranda" icon="home" routeName="DoctorDashboard" />
          ),
        }}
      />
      <Tab.Screen
        name="DoctorChat"
        component={ChatListScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton
              {...props}
              label="Pesan"
              icon="chatbubbles"
              routeName="DoctorChat"
              badge={chatUnread}
            />
          ),
        }}
      />
      <Tab.Screen
        name="DoctorAppointments"
        component={DoctorAppointmentsScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Antrean" icon="calendar" routeName="DoctorAppointments" />
          ),
        }}
      />
      <Tab.Screen
        name="DoctorAnalytics"
        component={DoctorEarningsScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Analitik" icon="analytics" routeName="DoctorAnalytics" />
          ),
        }}
      />
      <Tab.Screen
        name="DoctorProfile"
        component={DoctorProfileScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Profil" icon="person" routeName="DoctorProfile" />
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
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});

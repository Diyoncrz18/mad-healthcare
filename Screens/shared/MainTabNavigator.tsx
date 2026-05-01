/**
 * MainTabNavigator — Bottom tab untuk Pasien & Admin.
 * Tab bar dengan brand teal accent, fluid pill highlight pada tab aktif.
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, LayoutAnimation, Platform, UIManager } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNavigationState } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
import { useChatUnreadCount } from '../services/chatService';

import HomeScreen from '../user/HomeScreen';
import MyAppointmentsScreen from '../shared/MyAppointmentsScreen';
import ProfileScreen from '../user/ProfileScreen';
import AdminUserScreen from '../admin/AdminUserScreen';
import ChatListScreen from './ChatListScreen';

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
  
  // Ambil state navigasi untuk menentukan tab aktif secara manual
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

export default function MainTabNavigator() {
  const [isUser, setIsUser] = useState(true);
  const { count: chatUnread } = useChatUnreadCount();

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
            <TabBarButton {...props} label="Beranda" icon="home" routeName="DashboardTab" />
          ),
        }}
      />
      {isUser && (
        <>
          <Tab.Screen
            name="ChatTab"
            component={ChatListScreen}
            options={{
              tabBarButton: (props) => (
                <TabBarButton
                  {...props}
                  label="Pesan"
                  icon="chatbubbles"
                  routeName="ChatTab"
                  badge={chatUnread}
                />
              ),
            }}
          />
          <Tab.Screen
            name="AppointmentsTab"
            component={MyAppointmentsScreen}
            options={{
              tabBarButton: (props) => (
                <TabBarButton {...props} label="Jadwal" icon="calendar" routeName="AppointmentsTab" />
              ),
            }}
          />
        </>
      )}
      {!isUser && (
        <>
          <Tab.Screen
            name="UsersTab"
            component={AdminUserScreen}
            options={{
              tabBarButton: (props) => (
                <TabBarButton {...props} label="Users" icon="people-circle" routeName="UsersTab" />
              ),
            }}
          />
        </>
      )}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarButton: (props) => (
            <TabBarButton {...props} label="Profil" icon="person" routeName="ProfileTab" />
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

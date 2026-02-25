import { Tabs } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';


const CustomTabBarButton = ({ children, onPress }: any) => (
  <TouchableOpacity
    style={styles.customButtonContainer}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.customButton}>
      {children}
    </View>
  </TouchableOpacity>
);

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#9CA3AF', 
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: styles.tabBar,
      }}>
      

      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      

      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="cart.fill" color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="scanner"
        options={{
          title: '', 
          tabBarIcon: () => <IconSymbol size={32} name="camera.fill" color="#fff" />,
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
        }}
      />
      

      <Tabs.Screen
        name="group"
        options={{
          title: 'Group',

          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.3.fill" color={color} />,
        }}
      />
      

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}


const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    backgroundColor: '#ffffff',
    borderRadius: 30, 
    height: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    paddingBottom: 0, 
    borderTopWidth: 0,
  },
  customButtonContainer: {
    top: -25, 
    justifyContent: 'center',
    alignItems: 'center',
  },
  customButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3B82F6', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  }
});
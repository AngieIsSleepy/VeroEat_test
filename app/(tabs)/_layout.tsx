import { Tabs } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

// 🌟 自定义中间凸起的相机按钮
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
        tabBarActiveTintColor: '#3B82F6', // 选中时的蓝色
        tabBarInactiveTintColor: '#9CA3AF', // 未选中时的灰色
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: styles.tabBar, // 应用自定义导航栏样式
      }}>
      
      {/* 1. 首页 (Home) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      
      {/* 2. 库存 (Inventory) */}
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="cart.fill" color={color} />,
        }}
      />
      
      {/* 3. 中间凸起的扫码按钮 (Scanner) */}
      <Tabs.Screen
        name="scanner"
        options={{
          title: '', // 中间按钮通常不需要文字
          tabBarIcon: () => <IconSymbol size={32} name="camera.fill" color="#fff" />,
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
        }}
      />
      
      {/* 4. 新增的群组 (Group) */}
      <Tabs.Screen
        name="group"
        options={{
          title: 'Group',
          // 如果 icon 报错，可以换成 person.fill 或者其他内置 icon
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.3.fill" color={color} />,
        }}
      />
      
      {/* 5. 个人资料 (Profile) */}
      <Tabs.Screen
        name="Profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

// 💅 导航栏的精美样式
const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    backgroundColor: '#ffffff',
    borderRadius: 30, // 圆角悬浮效果
    height: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    paddingBottom: 0, // 重置默认的底部 padding
    borderTopWidth: 0, // 去掉顶部的灰线
  },
  customButtonContainer: {
    top: -25, // 让按钮向上凸出
    justifyContent: 'center',
    alignItems: 'center',
  },
  customButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3B82F6', // 你的主题蓝
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  }
});
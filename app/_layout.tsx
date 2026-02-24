// FILE: app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { InventoryProvider } from '@/context/inventory';
import { ProfileProvider } from '@/context/ProfileContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: '(tabs)', // 推荐使用 initialRouteName 代替 anchor
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <InventoryProvider>
        {/* 🌟 用 ProfileProvider 包裹住整个页面栈，让数据全局可用 */}
        <ProfileProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            {/* 🌟 注册刚刚新建的 login 页面，隐藏顶部导航栏 */}
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack>
        </ProfileProvider>
      </InventoryProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
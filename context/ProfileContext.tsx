import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

// 定义数据的形状
interface ProfileData {
  name: string;
  location: string;
  allergens: string[];
  dietary_preferences: string[];
}

interface ProfileContextType {
  profile: ProfileData;
  isLoading: boolean;
  login: (username: string) => Promise<boolean>;
  updateProfileLocally: (data: Partial<ProfileData>) => void;
  syncToJac: () => Promise<void>;
  logout: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// ⚠️ 确保这是你真实的后端 IP
const JAC_SERVER_URL = 'http://35.2.255.119:8000';

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    location: '',
    allergens: [],
    dietary_preferences: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // App 刚启动时，检查有没有登录过
  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const savedName = await AsyncStorage.getItem('currentUser');
      if (savedName) {
        await fetchProfileFromJac(savedName);
      }
    } catch (e) {
      console.error('Failed to load local data', e);
    } finally {
      setIsLoading(false);
    }
  };

  // 从 Jac 后端获取数据 (GET)
  const fetchProfileFromJac = async (username: string) => {
    try {
      const res = await fetch(`${JAC_SERVER_URL}/walker/get_user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: username }),
      });
      const data = await res.json();
      
      if (data.status === 'success' && data.data) {
        setProfile(data.data); // 把后端拿到的数据存入全局状态
      } else {
        // 如果后端没这个用户，就先只设置名字
        setProfile(prev => ({ ...prev, name: username }));
      }
    } catch (e) {
      console.error('Jac fetch error:', e);
      // 网络断开时，至少保留名字
      setProfile(prev => ({ ...prev, name: username }));
    }
  };

  // 登录逻辑
  const login = async (username: string) => {
    setIsLoading(true);
    try {
      await AsyncStorage.setItem('currentUser', username);
      await fetchProfileFromJac(username);
      setIsLoading(false);
      return true;
    } catch (e) {
      setIsLoading(false);
      return false;
    }
  };

  // 登出逻辑
  const logout = async () => {
    await AsyncStorage.removeItem('currentUser');
    setProfile({ name: '', location: '', allergens: [], dietary_preferences: [] });
  };

  // 仅仅在前端修改状态（比如点亮一个过敏原开关）
  const updateProfileLocally = (data: Partial<ProfileData>) => {
    setProfile(prev => ({ ...prev, ...data }));
  };

  // 真正把数据推送到 Jac 后端 (POST)
  const syncToJac = async () => {
    try {
      const res = await fetch(`${JAC_SERVER_URL}/walker/create_or_update_user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (data.status === 'success') {
        Alert.alert("Success", "Profile saved to Jac Backend!");
      }
    } catch (e) {
      Alert.alert("Error", "Could not sync with backend.");
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, isLoading, login, updateProfileLocally, syncToJac, logout }}>
      {children}
    </ProfileContext.Provider>
  );
}

// 方便其他组件调用的 Hook
export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
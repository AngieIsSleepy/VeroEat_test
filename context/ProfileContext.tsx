import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

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

// Change middle part to your own ipv4 address
const JAC_SERVER_URL = 'http://100.64.0.113:8000';

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    location: '',
    allergens: [],
    dietary_preferences: [],
  });
  const [isLoading, setIsLoading] = useState(true);

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

  const getJacToken = async (username: string) => {
    const loginUsername = username.trim() || "defaultuser";
    const password = "password123456";

    try {
      await fetch(`${JAC_SERVER_URL}/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: password }) 
      });

      const loginRes = await fetch(`${JAC_SERVER_URL}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ username: loginUsername, password: password }) 
      });

      if (loginRes.ok) {
        const responseData = await loginRes.json();
        console.log("Backend gave us:", responseData); 
        
        const finalToken = responseData.data?.token || responseData.token; 
        
        console.log("My final token is:", finalToken); 
        return finalToken; 
      } else {
        console.error("Login completely failed", await loginRes.text());
        return null;
      }
    } catch (e) {
      console.error('Token fetch error:', e);
      return null;
    }
  };


  const fetchProfileFromJac = async (username: string) => {
    const token = await getJacToken(username);
    
    try {
      const res = await fetch(`${JAC_SERVER_URL}/walker/get_user`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ name: username }),
      });
      
      const json = await res.json();
      console.log("📦 [Fetch] Get User Response:", JSON.stringify(json, null, 2));
      
      const payload = json?.data?.result?.response_data;
      
      if (res.ok && payload && payload.status === 'success' && payload.data) {
        console.log("✅ Successfully extracted profile:", payload.data);
        setProfile(payload.data); 
        return;
      }
      
      setProfile(prev => ({ ...prev, name: username }));
      
    } catch (e) {
      console.error("Fetch error:", e);
      setProfile(prev => ({ ...prev, name: username }));
    }
  };

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

  const logout = async () => {
    await AsyncStorage.removeItem('currentUser');
    setProfile({ name: '', location: '', allergens: [], dietary_preferences: [] });
  };

  const updateProfileLocally = (data: Partial<ProfileData>) => {
    setProfile(prev => ({ ...prev, ...data }));
  };

  const syncToJac = async () => {
    const token = await getJacToken(profile.name);

    try {
      const res = await fetch(`${JAC_SERVER_URL}/walker/create_or_update_user`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(profile),
      });
      
      if (res.ok) {
        Alert.alert("Success 🎉", "Profile saved to Cloud!");
        console.log("✅ [Sync] Saved successfully!");
      } else {
        const errorText = await res.text();
        Alert.alert("Backend Crash Info 🚨", errorText.substring(0, 500));
        console.error("❌ [Sync] 500 Error details:", errorText);
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

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
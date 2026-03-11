import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";

interface ProfileData {
  name: string;
  location: string;
  allergens: string[];
  dietary_preferences: string[];
}

interface ProfileContextType {
  profile: ProfileData;
  profiles: string[];
  isLoading: boolean;
  login: (username: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchProfile: (name: string) => Promise<void>;
  // 加上 onSuccess 回调函数参数
  deleteProfile: (name: string, onSuccess?: () => void) => Promise<void>;
  updateProfileLocally: (data: Partial<ProfileData>) => void;
  syncToJac: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);
const JAC_SERVER_URL = "http://100.64.0.113:8000";

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    location: "",
    allergens: [],
    dietary_preferences: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const savedProfiles = await AsyncStorage.getItem("profiles");
      const savedCurrent = await AsyncStorage.getItem("currentUser");
      if (savedProfiles) setProfiles(JSON.parse(savedProfiles));
      if (savedCurrent) {
        const cached = await AsyncStorage.getItem(`cache_${savedCurrent}`);
        if (cached) setProfile(JSON.parse(cached));
        await fetchProfileFromJac(savedCurrent);
      }
    } catch (e) {
      console.error("Initialization error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfileFromJac = async (username: string) => {
    try {
      const res = await fetch(`${JAC_SERVER_URL}/walker/get_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: username }),
      });
      const json = await res.json();
      const payload = json?.data?.result?.response_data;

      if (payload && payload.status === "success" && payload.data) {
        const serverData: ProfileData = {
          name: username,
          location: payload.data.location || "",
          allergens: Array.isArray(payload.data.allergens) ? payload.data.allergens : [],
          dietary_preferences: Array.isArray(payload.data.dietary_preferences) ? payload.data.dietary_preferences : [],
        };
        setProfile(serverData);
        await AsyncStorage.setItem(`cache_${username}`, JSON.stringify(serverData));
      }
    } catch (e) {
      console.log("Network error, kept local data.");
    }
  };

  const login = async (username: string) => {
    const trimmedName = username.trim();
    if (!trimmedName) return false;
    setIsLoading(true);
    try {
      const savedProfiles = await AsyncStorage.getItem("profiles");
      let profileList = savedProfiles ? JSON.parse(savedProfiles) : [];
      if (!profileList.includes(trimmedName)) {
        profileList = [...profileList, trimmedName];
        await AsyncStorage.setItem("profiles", JSON.stringify(profileList));
      }
      setProfiles(profileList);
      await AsyncStorage.setItem("currentUser", trimmedName);

      const cached = await AsyncStorage.getItem(`cache_${trimmedName}`);
      if (cached) setProfile(JSON.parse(cached));
      else setProfile({ name: trimmedName, location: "", allergens: [], dietary_preferences: [] });

      await fetchProfileFromJac(trimmedName);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const switchProfile = async (name: string) => {
    setIsLoading(true);
    try {
      await AsyncStorage.setItem("currentUser", name);
      // 1. 先尝试读取目标用户的本地缓存
      const cached = await AsyncStorage.getItem(`cache_${name}`);
      if (cached) {
        setProfile(JSON.parse(cached));
      } else {
        // 2. 如果没有缓存，给个干净的初始状态
        setProfile({ name, location: "", allergens: [], dietary_preferences: [] });
      }
      // 3. 尝试从云端拉取最新数据覆盖
      await fetchProfileFromJac(name);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. 这里加了 onSuccess 参数 👇
  const deleteProfile = async (name: string, onSuccess?: () => void) => {
      Alert.alert(
        "Confirm Delete",
        `Are you sure you want to delete the profile "${name}"?`,
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Delete",
            style: "destructive",
            onPress: async () => {
              try {
                // 1. 计算新的 profile 列表
                const newProfiles = profiles.filter((p) => p !== name);
                
                // 2. 更新本地持久化存储
                await AsyncStorage.setItem("profiles", JSON.stringify(newProfiles));
                await AsyncStorage.removeItem(`cache_${name}`);
                
                // 3. 更新内存中的列表状态
                setProfiles(newProfiles);

                // 👇 🚨 关键新增：如果传入了清空商品的动作，就在这里执行！
                if (onSuccess) {
                  onSuccess();
                }

                // 4. 处理跳转逻辑（如果你删掉的是当前正在用的用户）
                if (profile.name === name) {
                  if (newProfiles.length > 0) {
                    // 如果还有其他人，切换到第一个
                    const firstProfile = newProfiles[0];
                    await switchProfile(firstProfile);
                    Alert.alert("Profile Deleted", `Switched to ${firstProfile}`);
                  } else {
                    // 如果全删光了，才去登录页
                    await logout();
                    router.replace("/login");
                  }
                }
              } catch (e) {
                console.error("Delete error", e);
                Alert.alert("Error", "Failed to delete profile");
              }
            },
          },
        ]
      );
    };

  const syncToJac = async () => {
    try {
      const res = await fetch(`${JAC_SERVER_URL}/walker/create_or_update_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        await AsyncStorage.setItem(`cache_${profile.name}`, JSON.stringify(profile));
        Alert.alert("Success 🎉", "Settings saved!");
      }
    } catch {
      Alert.alert("Error", "Cloud sync failed");
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem("currentUser");
    setProfile({ name: "", location: "", allergens: [], dietary_preferences: [] });
  };

  const updateProfileLocally = (data: Partial<ProfileData>) => {
    setProfile((prev) => {
      const newProfile = { ...prev, ...data };
      // 🚨 关键修复：每次本地修改（点选过敏原），立刻存入本地缓存！
      // 这样就算没点 Save to Cloud，直接切换账号数据也不会丢了。
      if (newProfile.name) {
        AsyncStorage.setItem(`cache_${newProfile.name}`, JSON.stringify(newProfile)).catch(console.error);
      }
      return newProfile;
    });
  };

  return (
    <ProfileContext.Provider value={{ profile, profiles, isLoading, login, logout, switchProfile, deleteProfile, updateProfileLocally, syncToJac }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be inside ProfileProvider");
  return context;
};
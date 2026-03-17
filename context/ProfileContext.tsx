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
  deleteProfile: (name: string, onSuccess?: () => void) => Promise<void>;
  updateProfileLocally: (data: Partial<ProfileData>) => void;
  syncToJac: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const BACKEND_BASE_URL = "http://100.64.0.113:8000";

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 4000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

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

      if (savedProfiles) {
        setProfiles(JSON.parse(savedProfiles));
      }

      if (savedCurrent) {
        const cached = await AsyncStorage.getItem(`cache_${savedCurrent}`);
        if (cached) {
          setProfile(JSON.parse(cached));
        } else {
          setProfile({
            name: savedCurrent,
            location: "",
            allergens: [],
            dietary_preferences: [],
          });
        }
      }
    } catch (e) {
      console.error("Initialization error", e);
    } finally {
      // 先结束 loading，不等远程
      setIsLoading(false);
    }

    // 放到 finally 后面后台刷新
    try {
      const savedCurrent = await AsyncStorage.getItem("currentUser");
      if (savedCurrent) {
        fetchProfileFromJac(savedCurrent).catch(() => {
          console.log("Background profile refresh failed");
        });
      }
    } catch {}
  };

  const fetchProfileFromJac = async (username: string) => {
    try {
      const res = await fetchWithTimeout(
        `${BACKEND_BASE_URL}/walker/get_user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: username }),
        },
        4000,
      );

      const json = await res.json();

      if (json?.status !== "success" || !json?.data) {
        return;
      }

      const serverData: ProfileData = {
        name: username,
        location: json.data.location || "",
        allergens: Array.isArray(json.data.allergens)
          ? json.data.allergens
          : [],
        dietary_preferences: Array.isArray(json.data.dietary_preferences)
          ? json.data.dietary_preferences
          : [],
      };

      setProfile(serverData);
      await AsyncStorage.setItem(
        `cache_${username}`,
        JSON.stringify(serverData),
      );
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
      if (cached) {
        setProfile(JSON.parse(cached));
      } else {
        const emptyProfile = {
          name: trimmedName,
          location: "",
          allergens: [],
          dietary_preferences: [],
        };
        setProfile(emptyProfile);
        await AsyncStorage.setItem(
          `cache_${trimmedName}`,
          JSON.stringify(emptyProfile),
        );
      }

      setIsLoading(false);

      fetchProfileFromJac(trimmedName).catch(() => {
        console.log("Background profile refresh failed");
      });

      return true;
    } catch {
      return false;
    }
  };

  const switchProfile = async (name: string) => {
    setIsLoading(true);

    try {
      await AsyncStorage.setItem("currentUser", name);

      const cached = await AsyncStorage.getItem(`cache_${name}`);
      if (cached) {
        setProfile(JSON.parse(cached));
      } else {
        const emptyProfile = {
          name,
          location: "",
          allergens: [],
          dietary_preferences: [],
        };
        setProfile(emptyProfile);
        await AsyncStorage.setItem(
          `cache_${name}`,
          JSON.stringify(emptyProfile),
        );
      }

      // 关键：本地数据一到，就结束 loading
      setIsLoading(false);

      // 后台刷新，不阻塞页面
      fetchProfileFromJac(name).catch(() => {
        console.log("Background profile refresh failed");
      });
    } catch {
      setIsLoading(false);
    }
  };

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
              const newProfiles = profiles.filter((p) => p !== name);

              await AsyncStorage.setItem(
                "profiles",
                JSON.stringify(newProfiles),
              );
              await AsyncStorage.removeItem(`cache_${name}`);

              setProfiles(newProfiles);

              if (onSuccess) {
                onSuccess();
              }

              if (profile.name === name) {
                if (newProfiles.length > 0) {
                  const firstProfile = newProfiles[0];
                  await switchProfile(firstProfile);
                  Alert.alert("Profile Deleted", `Switched to ${firstProfile}`);
                } else {
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
      ],
    );
  };

  const syncToJac = async () => {
    try {
      const res = await fetchWithTimeout(
        `${BACKEND_BASE_URL}/walker/create_or_update_user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        },
        5000,
      );

      const json = await res.json();
      console.log("syncToJac response:", json);

      if (!res.ok || json?.status !== "success") {
        Alert.alert("Error", json?.message || "Cloud sync failed");
        return;
      }

      await AsyncStorage.setItem(
        `cache_${profile.name}`,
        JSON.stringify(profile),
      );

      Alert.alert("Success 🎉", "Settings saved!");
    } catch (e) {
      console.log("syncToJac error:", e);
      Alert.alert("Error", "Cloud sync failed");
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem("currentUser");
    setProfile({
      name: "",
      location: "",
      allergens: [],
      dietary_preferences: [],
    });
  };

  const updateProfileLocally = (data: Partial<ProfileData>) => {
    setProfile((prev) => {
      const newProfile = { ...prev, ...data };

      if (newProfile.name) {
        AsyncStorage.setItem(
          `cache_${newProfile.name}`,
          JSON.stringify(newProfile),
        ).catch(console.error);
      }

      return newProfile;
    });
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profiles,
        isLoading,
        login,
        logout,
        switchProfile,
        deleteProfile,
        updateProfileLocally,
        syncToJac,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be inside ProfileProvider");
  return context;
};

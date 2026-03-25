import { API_BASE_URL } from "@/app/config";
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

interface GroupData {
  id: string;
  name: string;
  members: string[];
}

interface ProfileContextType {
  profile: ProfileData;
  profiles: string[];
  groups: GroupData[];
  activeMode: "profile" | "group";
  activeGroup: GroupData | null;
  isLoading: boolean;
  login: (username: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchProfile: (name: string) => Promise<void>;
  deleteProfile: (name: string, onSuccess?: () => void) => Promise<void>;
  updateProfileLocally: (data: Partial<ProfileData>) => void;
  syncToJac: () => Promise<void>;

  createGroup: (name: string, members: string[]) => Promise<void>;
  updateGroup: (
    groupId: string,
    data: Partial<Omit<GroupData, "id">>,
  ) => Promise<void>;
  deleteGroupById: (groupId: string) => Promise<void>;
  setActiveGroup: (groupId: string) => Promise<void>;
  clearActiveGroup: () => Promise<void>;
  getActiveAllergens: () => Promise<string[]>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

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
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [activeMode, setActiveMode] = useState<"profile" | "group">("profile");
  const [activeGroup, setActiveGroupState] = useState<GroupData | null>(null);

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

  const persistGroups = async (nextGroups: GroupData[]) => {
    await AsyncStorage.setItem("groups", JSON.stringify(nextGroups));
  };

  const checkLoginStatus = async () => {
    try {
      const savedProfiles = await AsyncStorage.getItem("profiles");
      const savedCurrent = await AsyncStorage.getItem("currentUser");
      const savedGroups = await AsyncStorage.getItem("groups");
      const savedActiveMode = await AsyncStorage.getItem("activeMode");
      const savedActiveGroupId = await AsyncStorage.getItem("activeGroupId");

      let parsedGroups: GroupData[] = [];

      if (savedProfiles) {
        setProfiles(JSON.parse(savedProfiles));
      }

      if (savedGroups) {
        parsedGroups = JSON.parse(savedGroups);
        setGroups(parsedGroups);
      }

      if (savedActiveMode === "group") {
        setActiveMode("group");
      }

      if (savedActiveGroupId && parsedGroups.length > 0) {
        const matchedGroup =
          parsedGroups.find((group) => group.id === savedActiveGroupId) || null;
        setActiveGroupState(matchedGroup);
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
      setIsLoading(false);
    }

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
        `${API_BASE_URL}/walker/get_user`,
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

      await AsyncStorage.setItem("activeMode", "profile");
      await AsyncStorage.removeItem("activeGroupId");
      setActiveMode("profile");
      setActiveGroupState(null);

      setIsLoading(false);

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

              const newGroups = groups
                .map((group) => ({
                  ...group,
                  members: group.members.filter((member) => member !== name),
                }))
                .filter((group) => group.members.length > 0);

              setGroups(newGroups);
              await persistGroups(newGroups);

              if (
                activeGroup &&
                newGroups.every((group) => group.id !== activeGroup.id)
              ) {
                await AsyncStorage.setItem("activeMode", "profile");
                await AsyncStorage.removeItem("activeGroupId");
                setActiveMode("profile");
                setActiveGroupState(null);
              } else if (activeGroup) {
                const updatedActiveGroup =
                  newGroups.find((group) => group.id === activeGroup.id) ||
                  null;
                setActiveGroupState(updatedActiveGroup);
              }

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
        `${API_BASE_URL}/walker/create_or_update_user`,
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
    await AsyncStorage.setItem("activeMode", "profile");
    await AsyncStorage.removeItem("activeGroupId");

    setActiveMode("profile");
    setActiveGroupState(null);

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

  const createGroup = async (name: string, members: string[]) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert("Error", "Group name cannot be empty");
      return;
    }

    const cleanedMembers = Array.from(
      new Set(members.map((member) => member.trim()).filter(Boolean)),
    );

    if (cleanedMembers.length === 0) {
      Alert.alert("Error", "Group must have at least one member");
      return;
    }

    const newGroup: GroupData = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      members: cleanedMembers,
    };

    const nextGroups = [...groups, newGroup];
    setGroups(nextGroups);
    await persistGroups(nextGroups);
  };

  const updateGroup = async (
    groupId: string,
    data: Partial<Omit<GroupData, "id">>,
  ) => {
    const nextGroups = groups.map((group) => {
      if (group.id !== groupId) return group;

      return {
        ...group,
        ...data,
        name: data.name !== undefined ? data.name.trim() : group.name,
        members:
          data.members !== undefined
            ? Array.from(
                new Set(
                  data.members.map((member) => member.trim()).filter(Boolean),
                ),
              )
            : group.members,
      };
    });

    setGroups(nextGroups);
    await persistGroups(nextGroups);

    if (activeGroup?.id === groupId) {
      const updated = nextGroups.find((group) => group.id === groupId) || null;
      setActiveGroupState(updated);
    }
  };

  const deleteGroupById = async (groupId: string) => {
    const nextGroups = groups.filter((group) => group.id !== groupId);
    setGroups(nextGroups);
    await persistGroups(nextGroups);

    if (activeGroup?.id === groupId) {
      await AsyncStorage.setItem("activeMode", "profile");
      await AsyncStorage.removeItem("activeGroupId");
      setActiveMode("profile");
      setActiveGroupState(null);
    }
  };

  const setActiveGroup = async (groupId: string) => {
    const matchedGroup = groups.find((group) => group.id === groupId) || null;

    if (!matchedGroup) {
      Alert.alert("Error", "Group not found");
      return;
    }

    setActiveMode("group");
    setActiveGroupState(matchedGroup);
    await AsyncStorage.setItem("activeMode", "group");
    await AsyncStorage.setItem("activeGroupId", groupId);
  };

  const clearActiveGroup = async () => {
    setActiveMode("profile");
    setActiveGroupState(null);
    await AsyncStorage.setItem("activeMode", "profile");
    await AsyncStorage.removeItem("activeGroupId");
  };

  const getActiveAllergens = async (): Promise<string[]> => {
    if (activeMode === "profile" || !activeGroup) {
      return profile.allergens || [];
    }

    const allergenSet = new Set<string>();

    for (const memberName of activeGroup.members) {
      const cached = await AsyncStorage.getItem(`cache_${memberName}`);
      if (!cached) continue;

      try {
        const parsed: ProfileData = JSON.parse(cached);
        for (const allergen of parsed.allergens || []) {
          if (typeof allergen === "string" && allergen.trim()) {
            allergenSet.add(allergen.trim().toLowerCase());
          }
        }
      } catch (e) {
        console.log("Failed to parse cached profile", memberName);
      }
    }

    return Array.from(allergenSet);
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profiles,
        groups,
        activeMode,
        activeGroup,
        isLoading,
        login,
        logout,
        switchProfile,
        deleteProfile,
        updateProfileLocally,
        syncToJac,
        createGroup,
        updateGroup,
        deleteGroupById,
        setActiveGroup,
        clearActiveGroup,
        getActiveAllergens,
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

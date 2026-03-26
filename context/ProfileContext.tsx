import { API_BASE_URL } from "@/app/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type ActiveTargetType = "profile" | "group";

type ActiveTargetOption = {
  id: string;
  type: ActiveTargetType;
  label: string;
  subtitle?: string;
};

interface ProfileContextType {
  profile: ProfileData;
  profiles: string[];
  groups: GroupData[];
  activeMode: "profile" | "group";
  activeGroup: GroupData | null;
  isLoading: boolean;

  activeTargetType: ActiveTargetType;
  activeTargetId: string;
  activeTargetLabel: string;

  setActiveProfile: (name: string) => Promise<void>;
  setActiveTarget: (target: {
    type: ActiveTargetType;
    id: string;
  }) => Promise<void>;
  getAllTargetOptions: () => ActiveTargetOption[];

  login: (username: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchProfile: (name: string) => Promise<void>;
  deleteProfile: (name: string, onSuccess?: () => void) => Promise<void>;
  updateProfileLocally: (data: Partial<ProfileData>) => void;

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

const GROUPS_STORAGE_KEY = "groups";
const PROFILES_STORAGE_KEY = "profiles";
const CURRENT_USER_STORAGE_KEY = "currentUser";
const ACTIVE_MODE_STORAGE_KEY = "activeMode";
const ACTIVE_GROUP_ID_STORAGE_KEY = "activeGroupId";

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

  const isApplyingRemoteProfileRef = useRef(false);
  const skipNextProfileSyncRef = useRef(false);

  const activeTargetType: ActiveTargetType =
    activeMode === "group" && activeGroup ? "group" : "profile";

  const activeTargetId = useMemo(() => {
    if (activeMode === "group" && activeGroup) {
      return activeGroup.id;
    }
    return profile.name || "Guest";
  }, [activeMode, activeGroup, profile.name]);

  const activeTargetLabel = useMemo(() => {
    if (activeMode === "group" && activeGroup) {
      return activeGroup.name;
    }
    return profile.name || "Guest";
  }, [activeMode, activeGroup, profile.name]);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const persistGroupsLocally = async (nextGroups: GroupData[]) => {
    await AsyncStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(nextGroups));
  };

  const persistProfilesLocally = async (nextProfiles: string[]) => {
    await AsyncStorage.setItem(
      PROFILES_STORAGE_KEY,
      JSON.stringify(nextProfiles),
    );
  };

  const persistProfileCache = async (data: ProfileData) => {
    if (!data.name) return;
    await AsyncStorage.setItem(`cache_${data.name}`, JSON.stringify(data));
  };

  const syncProfileToBackend = async (profileData: ProfileData) => {
    if (!profileData.name || profileData.name === "Guest") return;

    try {
      await fetchWithTimeout(
        `${API_BASE_URL}/walker/create_or_update_user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profileData),
        },
        5000,
      );
    } catch (e) {
      console.log("Auto profile sync failed:", e);
    }
  };

  const syncGroupsToBackend = async (nextGroups: GroupData[]) => {
    try {
      await fetchWithTimeout(
        `${API_BASE_URL}/groups/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groups: nextGroups }),
        },
        5000,
      );
    } catch (e) {
      console.log("Auto group sync failed:", e);
    }
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

      isApplyingRemoteProfileRef.current = true;
      skipNextProfileSyncRef.current = true;

      setProfile(serverData);
      await persistProfileCache(serverData);

      setTimeout(() => {
        isApplyingRemoteProfileRef.current = false;
      }, 0);
    } catch {
      console.log("Network error, kept local profile data.");
    }
  };

  const fetchGroupsFromBackend = async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/groups`, {}, 4000);
      const json = await res.json();

      const remoteGroups: GroupData[] = Array.isArray(json?.groups)
        ? json.groups
        : [];

      if (!remoteGroups.length) return;

      setGroups(remoteGroups);
      await persistGroupsLocally(remoteGroups);

      const savedActiveGroupId = await AsyncStorage.getItem(
        ACTIVE_GROUP_ID_STORAGE_KEY,
      );
      if (savedActiveGroupId) {
        const matched =
          remoteGroups.find((group) => group.id === savedActiveGroupId) || null;
        setActiveGroupState(matched);
      }
    } catch {
      console.log("Background group refresh failed");
    }
  };

  const ensureSelfProfileExists = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const nextProfiles = profiles.includes(trimmedName)
      ? profiles
      : [trimmedName, ...profiles.filter((p) => p !== trimmedName)];

    setProfiles(nextProfiles);
    await persistProfilesLocally(nextProfiles);
  };

  const checkLoginStatus = async () => {
    try {
      const savedProfiles = await AsyncStorage.getItem(PROFILES_STORAGE_KEY);
      const savedCurrent = await AsyncStorage.getItem(CURRENT_USER_STORAGE_KEY);
      const savedGroups = await AsyncStorage.getItem(GROUPS_STORAGE_KEY);
      const savedActiveMode = await AsyncStorage.getItem(
        ACTIVE_MODE_STORAGE_KEY,
      );
      const savedActiveGroupId = await AsyncStorage.getItem(
        ACTIVE_GROUP_ID_STORAGE_KEY,
      );

      let parsedGroups: GroupData[] = [];
      let parsedProfiles: string[] = [];

      if (savedProfiles) {
        parsedProfiles = JSON.parse(savedProfiles);
        setProfiles(parsedProfiles);
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
          const emptyProfile = {
            name: savedCurrent,
            location: "",
            allergens: [],
            dietary_preferences: [],
          };
          setProfile(emptyProfile);
          await persistProfileCache(emptyProfile);
        }

        if (!parsedProfiles.includes(savedCurrent)) {
          const nextProfiles = [savedCurrent, ...parsedProfiles];
          setProfiles(nextProfiles);
          await persistProfilesLocally(nextProfiles);
        }
      }
    } catch (e) {
      console.error("Initialization error", e);
    } finally {
      setIsLoading(false);
    }

    try {
      const savedCurrent = await AsyncStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (savedCurrent) {
        fetchProfileFromJac(savedCurrent).catch(() => {
          console.log("Background profile refresh failed");
        });
      }
      fetchGroupsFromBackend().catch(() => {
        console.log("Background group refresh failed");
      });
    } catch {}
  };

  const login = async (username: string) => {
    const trimmedName = username.trim();
    if (!trimmedName) return false;

    setIsLoading(true);

    try {
      const savedProfiles = await AsyncStorage.getItem(PROFILES_STORAGE_KEY);
      let profileList = savedProfiles ? JSON.parse(savedProfiles) : [];

      if (!profileList.includes(trimmedName)) {
        profileList = [trimmedName, ...profileList];
        await persistProfilesLocally(profileList);
      }

      setProfiles(profileList);
      await AsyncStorage.setItem(CURRENT_USER_STORAGE_KEY, trimmedName);

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
        await persistProfileCache(emptyProfile);
        syncProfileToBackend(emptyProfile).catch(() => {
          console.log("Initial profile auto sync failed");
        });
      }

      setIsLoading(false);

      fetchProfileFromJac(trimmedName).catch(() => {
        console.log("Background profile refresh failed");
      });

      return true;
    } catch {
      setIsLoading(false);
      return false;
    }
  };

  const switchProfile = async (name: string) => {
    setIsLoading(true);

    try {
      await AsyncStorage.setItem(CURRENT_USER_STORAGE_KEY, name);

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
        await persistProfileCache(emptyProfile);
        syncProfileToBackend(emptyProfile).catch(() => {
          console.log("Initial switched profile auto sync failed");
        });
      }

      await AsyncStorage.setItem(ACTIVE_MODE_STORAGE_KEY, "profile");
      await AsyncStorage.removeItem(ACTIVE_GROUP_ID_STORAGE_KEY);
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

  const setActiveProfile = async (name: string) => {
    await switchProfile(name);
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

              await persistProfilesLocally(newProfiles);
              await AsyncStorage.removeItem(`cache_${name}`);
              setProfiles(newProfiles);

              const newGroups = groups
                .map((group) => ({
                  ...group,
                  members: group.members.filter((member) => member !== name),
                }))
                .filter((group) => group.members.length > 0);

              setGroups(newGroups);
              await persistGroupsLocally(newGroups);
              syncGroupsToBackend(newGroups).catch(() => {
                console.log("Group auto sync after profile delete failed");
              });

              if (
                activeGroup &&
                newGroups.every((group) => group.id !== activeGroup.id)
              ) {
                await AsyncStorage.setItem(ACTIVE_MODE_STORAGE_KEY, "profile");
                await AsyncStorage.removeItem(ACTIVE_GROUP_ID_STORAGE_KEY);
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

  const logout = async () => {
    await AsyncStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    await AsyncStorage.setItem(ACTIVE_MODE_STORAGE_KEY, "profile");
    await AsyncStorage.removeItem(ACTIVE_GROUP_ID_STORAGE_KEY);

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
        persistProfileCache(newProfile).catch(console.error);
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
    await persistGroupsLocally(nextGroups);
    syncGroupsToBackend(nextGroups).catch(() => {
      console.log("Auto group sync after create failed");
    });
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
    await persistGroupsLocally(nextGroups);
    syncGroupsToBackend(nextGroups).catch(() => {
      console.log("Auto group sync after update failed");
    });

    if (activeGroup?.id === groupId) {
      const updated = nextGroups.find((group) => group.id === groupId) || null;
      setActiveGroupState(updated);
    }
  };

  const deleteGroupById = async (groupId: string) => {
    const nextGroups = groups.filter((group) => group.id !== groupId);
    setGroups(nextGroups);
    await persistGroupsLocally(nextGroups);
    syncGroupsToBackend(nextGroups).catch(() => {
      console.log("Auto group sync after delete failed");
    });

    if (activeGroup?.id === groupId) {
      await AsyncStorage.setItem(ACTIVE_MODE_STORAGE_KEY, "profile");
      await AsyncStorage.removeItem(ACTIVE_GROUP_ID_STORAGE_KEY);
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
    await AsyncStorage.setItem(ACTIVE_MODE_STORAGE_KEY, "group");
    await AsyncStorage.setItem(ACTIVE_GROUP_ID_STORAGE_KEY, groupId);
  };

  const clearActiveGroup = async () => {
    setActiveMode("profile");
    setActiveGroupState(null);
    await AsyncStorage.setItem(ACTIVE_MODE_STORAGE_KEY, "profile");
    await AsyncStorage.removeItem(ACTIVE_GROUP_ID_STORAGE_KEY);
  };

  const setActiveTarget = async (target: {
    type: ActiveTargetType;
    id: string;
  }) => {
    if (target.type === "profile") {
      await setActiveProfile(target.id);
      return;
    }

    await setActiveGroup(target.id);
  };

  const getAllTargetOptions = (): ActiveTargetOption[] => {
    const profileOptions: ActiveTargetOption[] = profiles.map((name) => ({
      id: name,
      type: "profile",
      label: name,
      subtitle: "Profile",
    }));

    const groupOptions: ActiveTargetOption[] = groups.map((group) => ({
      id: group.id,
      type: "group",
      label: group.name,
      subtitle: `${group.members.length} member${
        group.members.length === 1 ? "" : "s"
      }`,
    }));

    return [...profileOptions, ...groupOptions];
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
      } catch {
        console.log("Failed to parse cached profile", memberName);
      }
    }

    return Array.from(allergenSet);
  };

  useEffect(() => {
    if (!profile.name || profile.name === "Guest") return;
    if (isApplyingRemoteProfileRef.current) return;

    if (skipNextProfileSyncRef.current) {
      skipNextProfileSyncRef.current = false;
      return;
    }

    syncProfileToBackend(profile).catch(() => {
      console.log("Auto profile sync failed");
    });
  }, [profile]);

  useEffect(() => {
    if (!profile.name) return;
    ensureSelfProfileExists(profile.name).catch(console.error);
  }, [profile.name]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profiles,
        groups,
        activeMode,
        activeGroup,

        activeTargetType,
        activeTargetId,
        activeTargetLabel,

        isLoading,
        login,
        logout,
        switchProfile,
        setActiveProfile,
        setActiveTarget,
        deleteProfile,
        updateProfileLocally,

        createGroup,
        updateGroup,
        deleteGroupById,
        setActiveGroup,
        clearActiveGroup,
        getActiveAllergens,
        getAllTargetOptions,
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

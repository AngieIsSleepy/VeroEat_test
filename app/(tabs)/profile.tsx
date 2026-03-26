import { useInventory } from "@/context/inventory";
import { useProfile } from "@/context/ProfileContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const AVAILABLE_ALLERGENS = [
  "peanuts",
  "milk",
  "egg",
  "gluten",
  "soy",
  "tree nuts",
  "fish",
  "crustacean shellfish",
  "wheat",
  "sesame",
];

export default function ProfileScreen() {
  const {
    profile,
    profiles,
    activeTargetType,
    activeTargetLabel,
    activeTargetId,
    updateProfileLocally,
    switchProfile,
    setActiveTarget,
    deleteProfile,
    logout,
    isLoading,
  } = useProfile();

  const { removeItemsByProfile, recallAlertsEnabled, setRecallAlertsEnabled } =
    useInventory();

  const toggleItem = (item: string) => {
    const current = profile.allergens || [];
    const next = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    updateProfileLocally({ allergens: next });
  };

  const activeTargetText = useMemo(() => {
    return `${activeTargetLabel} (${activeTargetType === "group" ? "Group" : "Profile"})`;
  }, [activeTargetLabel, activeTargetType]);

  const isViewingCurrentProfile =
    activeTargetType === "profile" && activeTargetId === profile.name;

  if (isLoading && !profile.name) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.name?.[0]?.toUpperCase() || "?"}
            </Text>
          </View>
          <Text style={styles.nameText}>{profile.name || "Guest"}</Text>
          <TextInput
            style={styles.locationInput}
            value={profile.location}
            onChangeText={(text) => updateProfileLocally({ location: text })}
            placeholder="Your Location"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={styles.autoSaveText}>Changes save automatically</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Active Target</Text>

          <View style={styles.targetCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.targetLabel}>Now viewing</Text>
              <Text style={styles.targetName}>{activeTargetText}</Text>
              <Text style={styles.targetSubtext}>
                Inventory and scanner currently follow this target.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Details</Text>

          <Text style={styles.helperText}>
            This tab edits the currently selected profile only.
          </Text>

          <Text style={styles.fieldLabel}>Allergies</Text>
          <View style={styles.chipContainer}>
            {AVAILABLE_ALLERGENS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[
                  styles.chip,
                  profile.allergens?.includes(a) && styles.chipSelected,
                ]}
                onPress={() => toggleItem(a)}
              >
                <Text
                  style={[
                    styles.chipText,
                    profile.allergens?.includes(a) && styles.chipTextSelected,
                  ]}
                >
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recall Alerts</Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.settingTitle}>Recall Notifications</Text>
              <Text style={styles.settingSubtitle}>
                Get a phone alert when an item in this profile’s inventory is
                recalled.
              </Text>
            </View>

            <Switch
              value={recallAlertsEnabled}
              onValueChange={setRecallAlertsEnabled}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={recallAlertsEnabled ? "#2563EB" : "#F9FAFB"}
            />
          </View>

          <View style={styles.settingStatusBox}>
            <Ionicons
              name={
                recallAlertsEnabled
                  ? "notifications-outline"
                  : "notifications-off-outline"
              }
              size={16}
              color={recallAlertsEnabled ? "#2563EB" : "#6B7280"}
            />
            <Text
              style={[
                styles.settingStatusText,
                { color: recallAlertsEnabled ? "#2563EB" : "#6B7280" },
              ]}
            >
              {recallAlertsEnabled
                ? "Recall alerts are ON for this profile"
                : "Recall alerts are OFF for this profile"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profiles</Text>

          <Text style={styles.helperText}>
            Self profile is the main profile. Other profiles can be added,
            switched, and deleted here.
          </Text>

          {profiles.length === 0 ? (
            <Text style={styles.emptyText}>No profiles yet</Text>
          ) : (
            profiles.map((name, index) => {
              const isCurrentProfile = name === profile.name;
              const isActiveTarget =
                activeTargetType === "profile" && activeTargetId === name;
              const isSelfProfile = index === 0;

              return (
                <View
                  key={name}
                  style={[
                    styles.profileCard,
                    isActiveTarget && styles.profileCardActive,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.profileCardTitle,
                        isActiveTarget && styles.profileCardTitleActive,
                      ]}
                    >
                      {name}
                      {isSelfProfile ? " (Self)" : ""}
                      {isActiveTarget ? " ✓" : ""}
                    </Text>

                    <Text style={styles.profileCardSubtitle}>
                      {isActiveTarget
                        ? "Currently used by Inventory and Scanner"
                        : "Available profile"}
                    </Text>
                  </View>

                  <View style={styles.profileActions}>
                    {!isCurrentProfile ? (
                      <TouchableOpacity
                        style={styles.profileActionButton}
                        onPress={async () => {
                          await switchProfile(name);
                        }}
                      >
                        <Text style={styles.profileActionButtonText}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}

                    {!isActiveTarget ? (
                      <TouchableOpacity
                        style={styles.useButton}
                        onPress={async () => {
                          await setActiveTarget({
                            type: "profile",
                            id: name,
                          });
                        }}
                      >
                        <Text style={styles.useButtonText}>Use</Text>
                      </TouchableOpacity>
                    ) : null}

                    {!isSelfProfile ? (
                      <TouchableOpacity
                        style={styles.profileDeleteButton}
                        onPress={() =>
                          deleteProfile(name, () => removeItemsByProfile(name))
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.addProfileButton}
            onPress={() => {
              router.push({
                pathname: "/login",
                params: { canGoBack: "true" },
              });
            }}
          >
            <Text style={styles.addProfileButtonText}>
              + Create New Profile
            </Text>
          </TouchableOpacity>

          {!isViewingCurrentProfile ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                You are editing one profile while another target is currently in
                use in Inventory/Scanner.
              </Text>
            </View>
          ) : null}

          {profiles[0] !== profile.name ? (
            <TouchableOpacity
              style={styles.deleteMainButton}
              onPress={() =>
                deleteProfile(profile.name, () =>
                  removeItemsByProfile(profile.name),
                )
              }
            >
              <Text style={styles.deleteMainButtonText}>
                Delete This Profile
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarText: { fontSize: 32, fontWeight: "bold", color: "#1D4ED8" },
  nameText: { fontSize: 24, fontWeight: "bold", color: "#111827" },
  locationInput: {
    fontSize: 16,
    color: "#4B5563",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
    textAlign: "center",
  },
  autoSaveText: {
    marginTop: 10,
    fontSize: 13,
    color: "#16A34A",
    fontWeight: "600",
  },

  section: {
    padding: 20,
    backgroundColor: "#fff",
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 15,
  },
  helperText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 14,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "600",
    marginBottom: 10,
  },

  targetCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  targetLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "600",
  },
  targetName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  targetSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },

  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipSelected: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
  chipText: { fontSize: 14, color: "#4B5563" },
  chipTextSelected: { color: "#FFFFFF" },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  settingStatusBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
  },
  settingStatusText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "600",
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 14,
  },

  profileCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  profileCardActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  profileCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  profileCardTitleActive: {
    color: "#1D4ED8",
  },
  profileCardSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  profileActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  profileActionButton: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  profileActionButtonText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
  useButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  useButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  profileDeleteButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
  },

  actionContainer: { padding: 20 },
  switchButton: {
    backgroundColor: "#E5E7EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  switchButtonText: { color: "#374151", fontSize: 16, fontWeight: "bold" },

  addProfileButton: {
    backgroundColor: "#F0FDF4",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  addProfileButtonModal: {
    backgroundColor: "#F0FDF4",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
  },
  addProfileButtonText: {
    color: "#16A34A",
    fontWeight: "bold",
    fontSize: 16,
  },

  noteBox: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  noteText: {
    color: "#9A3412",
    fontSize: 14,
    lineHeight: 20,
  },

  deleteMainButton: {
    backgroundColor: "#FEF2F2",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  deleteMainButtonText: { color: "#EF4444", fontSize: 16, fontWeight: "bold" },

  logoutButton: { padding: 16, alignItems: "center" },
  logoutButtonText: { color: "#6B7280", fontSize: 16, fontWeight: "bold" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  profileOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingHorizontal: 10,
  },
  profileOptionActive: { backgroundColor: "#EFF6FF", borderRadius: 10 },
  profileOptionText: { fontSize: 16, color: "#374151" },
  activeText: { color: "#3B82F6", fontWeight: "bold" },
  deleteIconButton: { padding: 10 },
  modalClose: { marginTop: 20, alignItems: "center" },
});

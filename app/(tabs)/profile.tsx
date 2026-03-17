import { useInventory } from "@/context/inventory";
import { useProfile } from "@/context/ProfileContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
    updateProfileLocally,
    syncToJac,
    switchProfile,
    deleteProfile,
    logout,
    isLoading,
  } = useProfile();

  const { removeItemsByProfile, recallAlertsEnabled, setRecallAlertsEnabled } =
    useInventory();

  const [showSwitchModal, setShowSwitchModal] = useState(false);

  const toggleItem = (item: string) => {
    const current = profile.allergens || [];
    const next = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    updateProfileLocally({ allergens: next });
  };

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
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergies</Text>
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

        {/* 新增：召回提醒设置 */}
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

        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={syncToJac}>
            <Text style={styles.saveButtonText}>Save to Cloud</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setShowSwitchModal(true)}
          >
            <Text style={styles.switchButtonText}>Switch Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteMainButton}
            onPress={() =>
              deleteProfile(profile.name, () =>
                removeItemsByProfile(profile.name),
              )
            }
          >
            <Text style={styles.deleteMainButtonText}>Delete This Profile</Text>
          </TouchableOpacity>

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

      <Modal visible={showSwitchModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select User</Text>
            {profiles.map((name) => (
              <View
                key={name}
                style={[
                  styles.profileOptionRow,
                  name === profile.name && styles.profileOptionActive,
                ]}
              >
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 15 }}
                  onPress={async () => {
                    await switchProfile(name);
                    setShowSwitchModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.profileOptionText,
                      name === profile.name && styles.activeText,
                    ]}
                  >
                    {name} {name === profile.name && "✓"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    deleteProfile(name, () => removeItemsByProfile(name))
                  }
                  style={styles.deleteIconButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addProfileButton}
              onPress={() => {
                setShowSwitchModal(false);
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

            <TouchableOpacity
              onPress={() => setShowSwitchModal(false)}
              style={styles.modalClose}
            >
              <Text style={{ color: "#6B7280", fontWeight: "bold" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  // 新增：召回提醒样式
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

  actionContainer: { padding: 20 },
  saveButton: {
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  switchButton: {
    backgroundColor: "#E5E7EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  switchButtonText: { color: "#374151", fontSize: 16, fontWeight: "bold" },

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
  addProfileButton: {
    backgroundColor: "#F0FDF4",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
  },
  addProfileButtonText: { color: "#16A34A", fontWeight: "bold", fontSize: 16 },
  modalClose: { marginTop: 20, alignItems: "center" },
});

import { useInventory } from "@/context/inventory";
import { useProfile } from "@/context/ProfileContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
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
    groups,
    activeMode,
    activeGroup,
    updateProfileLocally,
    syncToJac,
    switchProfile,
    deleteProfile,
    logout,
    isLoading,
    createGroup,
    deleteGroupById,
    setActiveGroup,
    clearActiveGroup,
  } = useProfile();

  const { removeItemsByProfile, recallAlertsEnabled, setRecallAlertsEnabled } =
    useInventory();

  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>(
    [],
  );

  const toggleItem = (item: string) => {
    const current = profile.allergens || [];
    const next = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    updateProfileLocally({ allergens: next });
  };

  const toggleGroupMember = (name: string) => {
    setSelectedGroupMembers((prev) =>
      prev.includes(name)
        ? prev.filter((member) => member !== name)
        : [...prev, name],
    );
  };

  const activeTargetText = useMemo(() => {
    if (activeMode === "group" && activeGroup) {
      return `${activeGroup.name} (${activeGroup.members.length} members)`;
    }
    return profile.name || "Guest";
  }, [activeMode, activeGroup, profile.name]);

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
          <Text style={styles.sectionTitle}>Current Scan Target</Text>

          <View style={styles.targetCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.targetLabel}>
                {activeMode === "group" ? "Active Group" : "Active Profile"}
              </Text>
              <Text style={styles.targetName}>{activeTargetText}</Text>
              {activeMode === "group" && activeGroup ? (
                <Text style={styles.targetSubtext}>
                  Members: {activeGroup.members.join(", ")}
                </Text>
              ) : (
                <Text style={styles.targetSubtext}>
                  Scanner is currently checking this profile
                </Text>
              )}
            </View>

            {activeMode === "group" && (
              <TouchableOpacity
                style={styles.secondarySmallButton}
                onPress={clearActiveGroup}
              >
                <Text style={styles.secondarySmallButtonText}>
                  Use Profile
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
          <Text style={styles.sectionTitle}>Create Group</Text>

          <TextInput
            style={styles.groupNameInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group Name"
          />

          <Text style={styles.groupHelperText}>Select Members</Text>

          <View style={styles.memberList}>
            {profiles.map((name) => {
              const selected = selectedGroupMembers.includes(name);
              return (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.memberChip,
                    selected && styles.memberChipSelected,
                  ]}
                  onPress={() => toggleGroupMember(name)}
                >
                  <Text
                    style={[
                      styles.memberChipText,
                      selected && styles.memberChipTextSelected,
                    ]}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.createGroupButton}
            onPress={async () => {
              await createGroup(groupName, selectedGroupMembers);
              setGroupName("");
              setSelectedGroupMembers([]);
            }}
          >
            <Text style={styles.createGroupButtonText}>Create Group</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Groups</Text>

          {groups.length === 0 ? (
            <Text style={styles.emptyText}>No groups yet</Text>
          ) : (
            groups.map((group) => {
              const isActive =
                activeMode === "group" && activeGroup?.id === group.id;

              return (
                <View
                  key={group.id}
                  style={[styles.groupCard, isActive && styles.groupCardActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.groupCardTitle,
                        isActive && styles.groupCardTitleActive,
                      ]}
                    >
                      {group.name} {isActive ? "✓" : ""}
                    </Text>
                    <Text style={styles.groupCardSubtitle}>
                      Members: {group.members.join(", ")}
                    </Text>
                  </View>

                  <View style={styles.groupActions}>
                    {!isActive ? (
                      <TouchableOpacity
                        style={styles.groupActionButton}
                        onPress={async () => {
                          await setActiveGroup(group.id);
                        }}
                      >
                        <Text style={styles.groupActionButtonText}>Use</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.groupUnuseButton}
                        onPress={async () => {
                          await clearActiveGroup();
                        }}
                      >
                        <Text style={styles.groupUnuseButtonText}>Unuse</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.groupDeleteButton}
                      onPress={async () => {
                        await deleteGroupById(group.id);
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
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
  secondarySmallButton: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondarySmallButtonText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 13,
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

  groupNameInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
    marginBottom: 14,
  },
  groupHelperText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 10,
    fontWeight: "600",
  },
  memberList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  memberChip: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  memberChipSelected: {
    backgroundColor: "#DBEAFE",
    borderColor: "#60A5FA",
  },
  memberChipText: {
    fontSize: 14,
    color: "#374151",
  },
  memberChipTextSelected: {
    color: "#1D4ED8",
    fontWeight: "700",
  },
  createGroupButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  createGroupButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 14,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  groupCardActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  groupCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  groupCardTitleActive: {
    color: "#1D4ED8",
  },
  groupCardSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  groupActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  groupActionButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  groupActionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  groupDeleteButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
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
  groupUnuseButton: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
  },

  groupUnuseButtonText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
});
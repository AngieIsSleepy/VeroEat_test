import { useProfile } from "@/context/ProfileContext";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function GroupScreen() {
  const {
    profiles,
    groups,
    activeMode,
    activeGroup,
    createGroup,
    updateGroup,
    deleteGroupById,
    setActiveGroup,
    clearActiveGroup,
  } = useProfile();

  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [editVisible, setEditVisible] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingMembers, setEditingMembers] = useState<string[]>([]);

  const hasMembers = profiles.length > 0;

  const currentTargetLabel = useMemo(() => {
    if (activeMode === "group" && activeGroup) {
      return `Active Group: ${activeGroup.name}`;
    }
    return "Using Individual Profile Mode";
  }, [activeMode, activeGroup]);

  const toggleCreateMember = (name: string) => {
    setSelectedMembers((prev) =>
      prev.includes(name)
        ? prev.filter((member) => member !== name)
        : [...prev, name],
    );
  };

  const toggleEditMember = (name: string) => {
    setEditingMembers((prev) =>
      prev.includes(name)
        ? prev.filter((member) => member !== name)
        : [...prev, name],
    );
  };

  const handleCreateGroup = async () => {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      Alert.alert("Error", "Group name cannot be empty.");
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert("Error", "Please select at least one member.");
      return;
    }

    await createGroup(trimmedName, selectedMembers);
    setGroupName("");
    setSelectedMembers([]);
  };

  const openEditModal = (group: {
    id: string;
    name: string;
    members: string[];
  }) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
    setEditingMembers(group.members);
    setEditVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingGroupId) return;

    const trimmedName = editingName.trim();

    if (!trimmedName) {
      Alert.alert("Error", "Group name cannot be empty.");
      return;
    }

    if (editingMembers.length === 0) {
      Alert.alert("Error", "Please keep at least one member.");
      return;
    }

    await updateGroup(editingGroupId, {
      name: trimmedName,
      members: editingMembers,
    });

    setEditVisible(false);
    setEditingGroupId(null);
    setEditingName("");
    setEditingMembers([]);
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    Alert.alert(
      "Delete Group",
      `Are you sure you want to delete "${groupName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteGroupById(groupId);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Groups</Text>
          <Text style={styles.headerSubtitle}>{currentTargetLabel}</Text>

          {activeMode === "group" && activeGroup ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={clearActiveGroup}
            >
              <Text style={styles.secondaryButtonText}>
                Switch Back to Profile Mode
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create Group</Text>

          <TextInput
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group Name"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.helperTitle}>Select Members</Text>

          {!hasMembers ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                No members available yet. Create members first from your profile flow.
              </Text>
            </View>
          ) : (
            <View style={styles.memberList}>
              {profiles.map((name) => {
                const selected = selectedMembers.includes(name);

                return (
                  <Pressable
                    key={name}
                    style={[
                      styles.memberChip,
                      selected && styles.memberChipSelected,
                    ]}
                    onPress={() => toggleCreateMember(name)}
                  >
                    <Text
                      style={[
                        styles.memberChipText,
                        selected && styles.memberChipTextSelected,
                      ]}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCreateGroup}
          >
            <Text style={styles.primaryButtonText}>Create Group</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Existing Groups</Text>

          {groups.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No groups created yet.</Text>
            </View>
          ) : (
            groups.map((group) => {
              const isActive =
                activeMode === "group" && activeGroup?.id === group.id;

              return (
                <View
                  key={group.id}
                  style={[styles.groupCard, isActive && styles.groupCardActive]}
                >
                  <View style={styles.groupCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.groupName,
                          isActive && styles.groupNameActive,
                        ]}
                      >
                        {group.name} {isActive ? "✓" : ""}
                      </Text>
                      <Text style={styles.groupMeta}>
                        {group.members.length} member
                        {group.members.length === 1 ? "" : "s"}
                      </Text>
                    </View>

                    <View style={styles.actionRow}>
                      {!isActive ? (
                        <TouchableOpacity
                          style={styles.textActionButton}
                          onPress={async () => {
                            await setActiveGroup(group.id);
                          }}
                        >
                          <Text style={styles.useButtonText}>Use</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.textActionButtonSecondary}
                          onPress={async () => {
                            await clearActiveGroup();
                          }}
                        >
                          <Text style={styles.unuseButtonText}>Unuse</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => openEditModal(group)}
                      >
                        <Ionicons
                          name="create-outline"
                          size={20}
                          color="#374151"
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleDeleteGroup(group.id, group.name)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.memberList}>
                    {group.members.map((member) => (
                      <View key={member} style={styles.groupMemberChip}>
                        <Text style={styles.groupMemberChipText}>{member}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={editVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Group</Text>

            <TextInput
              style={styles.input}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="Group Name"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.helperTitle}>Edit Members</Text>

            <View style={styles.memberList}>
              {profiles.map((name) => {
                const selected = editingMembers.includes(name);

                return (
                  <Pressable
                    key={name}
                    style={[
                      styles.memberChip,
                      selected && styles.memberChipSelected,
                    ]}
                    onPress={() => toggleEditMember(name)}
                  >
                    <Text
                      style={[
                        styles.memberChipText,
                        selected && styles.memberChipTextSelected,
                      ]}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => {
                  setEditVisible(false);
                  setEditingGroupId(null);
                  setEditingName("");
                  setEditingMembers([]);
                }}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={handleSaveEdit}
              >
                <Text style={styles.modalPrimaryButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginTop: 36,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 6,
    marginBottom: 14,
  },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
  },

  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
    marginBottom: 14,
  },

  helperTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 10,
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
    color: "#374151",
    fontSize: 14,
  },
  memberChipTextSelected: {
    color: "#1D4ED8",
    fontWeight: "700",
  },

  primaryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  secondaryButton: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
  },

  emptyBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
  },

  groupCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  groupCardActive: {
    borderColor: "#93C5FD",
    backgroundColor: "#EFF6FF",
  },
  groupCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  groupNameActive: {
    color: "#1D4ED8",
  },
  groupMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },

  groupMemberChip: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  groupMemberChipText: {
    fontSize: 13,
    color: "#374151",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 6,
  },
  modalSecondaryButton: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalSecondaryButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  textActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#DBEAFE",
    marginLeft: 4,
  },

  textActionButtonSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    marginLeft: 4,
  },

  useButtonText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
  },

  unuseButtonText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
});
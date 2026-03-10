import { useProfile } from "@/context/ProfileContext";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
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
const AVAILABLE_DIETS = ["vegan", "vegetarian", "keto", "paleo", "halal"];

export default function ProfileScreen() {
  // const { profile, logout, login } = useProfile();

  const { profile, updateProfileLocally, syncToJac, logout, isLoading } =
    useProfile();

  const [isSaving, setIsSaving] = useState(false);

  const toggleItem = (
    category: "allergens" | "dietary_preferences",
    item: string,
  ) => {
    const currentList = profile[category] || [];
    const isSelected = currentList.includes(item);

    const newList = isSelected
      ? currentList.filter((i) => i !== item)
      : [...currentList, item];

    updateProfileLocally({ [category]: newList });
  };

  const handleSave = async () => {
    setIsSaving(true);
    await syncToJac();
    setIsSaving(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login" as any);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 10, color: "#666" }}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
          </Text>
        </View>
        <Text style={styles.nameText}>{profile.name || "Guest User"}</Text>

        <TextInput
          style={styles.locationInput}
          placeholder="Where are you located?"
          placeholderTextColor="#9ca3af"
          value={profile.location}
          onChangeText={(text) => updateProfileLocally({ location: text })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allergies</Text>
        <View style={styles.chipContainer}>
          {AVAILABLE_ALLERGENS.map((allergen) => {
            const isSelected = profile.allergens?.includes(allergen);
            return (
              <TouchableOpacity
                key={allergen}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleItem("allergens", allergen)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}
                >
                  {allergen}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dietary Preferences</Text>
        <View style={styles.chipContainer}>
          {AVAILABLE_DIETS.map((diet) => {
            const isSelected = profile.dietary_preferences?.includes(diet);
            return (
              <TouchableOpacity
                key={diet}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleItem("dietary_preferences", diet)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}
                >
                  {diet}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? "Saving..." : "Save to Cloud"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={handleLogout}
        >
          <Text style={styles.switchButtonText}>Switch Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  nameText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 5,
  },
  locationInput: {
    fontSize: 16,
    color: "#4B5563",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 150,
    textAlign: "center",
  },
  section: { padding: 20, backgroundColor: "#fff", marginTop: 10 },
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
  chipSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  chipText: { fontSize: 14, color: "#4B5563", fontWeight: "500" },
  chipTextSelected: { color: "#FFFFFF" },
  actionContainer: { padding: 20, marginTop: 10 },
  saveButton: {
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 15,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  logoutButton: {
    backgroundColor: "#FEE2E2",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutButtonText: { color: "#EF4444", fontSize: 16, fontWeight: "bold" },

  switchButton: {
      backgroundColor: "#E5E7EB",
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 10,
  },

  switchButtonText: {
      color: "#374151",
      fontSize: 16,
      fontWeight: "bold",
  },
});

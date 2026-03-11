import { useProfile } from "@/context/ProfileContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function LoginScreen() {
  const { canGoBack } = useLocalSearchParams();
  const router = useRouter();
  const { login } = useProfile();
  const [username, setUsername] = useState("");

  const handleLogin = async () => {
    if (!username.trim()) return;
    const success = await login(username.trim());
    if (success) {
      router.replace("/(tabs)/profile");
    }
  };

  return (
    <View style={styles.container}>
      {/* 误触返回按钮 */}
      {canGoBack === "true" && (
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back to Profile</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Who's scanning?</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter Name"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.buttonText}>Start</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", padding: 20 },
  backButton: { position: "absolute", top: 60, left: 20, padding: 10 },
  backButtonText: { color: "#3B82F6", fontSize: 16, fontWeight: "600" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 30, color: "#111827" },
  input: { width: "100%", height: 55, backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 15, fontSize: 18, marginBottom: 20 },
  loginButton: { width: "100%", height: 55, backgroundColor: "#3B82F6", borderRadius: 12, justifyContent: "center", alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
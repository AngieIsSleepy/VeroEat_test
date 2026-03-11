import { useInventory } from "@/context/inventory";
import { useProfile } from "@/context/ProfileContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  peanuts: ["peanut", "peanuts", "groundnut"],
  milk: ["milk", "whey", "casein", "butter", "cream", "cheese", "lactose"],
  egg: ["egg", "eggs"],
  gluten: ["gluten", "barley", "rye", "malt"],
  soy: ["soy", "soybean"],
  "tree nuts": ["almond", "cashew", "walnut", "pecan"],
  fish: ["fish", "salmon", "tuna"],
  "crustacean shellfish": ["shrimp", "crab", "lobster"],
  wheat: ["wheat", "wheat flour"],
  sesame: ["sesame", "sesame oil"],
};

const BABY_RULES = ["honey", "sugar", "salt", "palm oil"];

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);

  const { profile: userProfile, profiles, switchProfile, isLoading: isContextLoading } = useProfile();
  const { addItem } = useInventory();

  const isProcessing = useRef(false);

  useEffect(() => {
    requestPermission();
  }, []);

  const resetScanner = () => {
    isProcessing.current = false;
    setScanned(false);
  };

  const addToInventoryAndReset = (name: string, barcode: string, isSafe: boolean) => {
    const modeLabel = userProfile.name || "Guest";
    
    // 传给 context，确保包含谁扫的和是否安全
    const added = addItem({ 
      name, 
      barcode, 
      scannedBy: modeLabel, 
      isSafe: isSafe        
    });

    Alert.alert(
      added ? "Added to Inventory" : "Already in Inventory",
      `${name}\n(Mode: ${modeLabel})`,
      [{ text: "OK", onPress: resetScanner }]
    );
  };

  const fetchAIRecommendation = async (unsafeProduct: string, reason: string) => {
    setLoadingAI(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "REPLACE_ME", 
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 200,
          messages: [{ role: "user", content: `Product: ${unsafeProduct}. Issue: ${reason}. Suggest 1 safe alternative. Return ONLY JSON: {"recommendation": "name", "brand": "brand"}` }],
        }),
      });
      const result = await response.json();
      const rawText = result.content?.[0]?.text || "{}";
      const data = JSON.parse(rawText);
      Alert.alert("AI Recommendation", `Try: ${data.recommendation}\nBrand: ${data.brand}`, [{ text: "OK", onPress: resetScanner }]);
    } catch {
      Alert.alert("AI Error", "Could not get recommendation.");
      resetScanner();
    } finally {
      setLoadingAI(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (isProcessing.current || scanned) return;
    isProcessing.current = true;
    setScanned(true);

    fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`)
      .then((res) => res.json())
      .then((json) => {
        if (json.status !== 1) {
          Alert.alert("Not Found", "Barcode not recognized", [{ text: "Retry", onPress: resetScanner }]);
          return;
        }

        const product = json.product;
        const name = product.product_name || "Unknown";
        const ingredients = (product.ingredients_text || "").toLowerCase();
        const currentMode = userProfile.name || "Guest";

        let matched: string[] = [];
        if (currentMode === "Baby") {
          matched = BABY_RULES.filter((r) => ingredients.includes(r));
        } else {
          const selectedAllergens = userProfile.allergens || [];
          matched = selectedAllergens.filter((allergen) => {
            const keywords = ALLERGEN_KEYWORDS[allergen] || [allergen];
            return keywords.some((k) => ingredients.includes(k));
          });
        }

        if (matched.length > 0) {
          Alert.alert(
            "⚠️ Warning (Mode: " + currentMode + ")", 
            `${name}\n\nDetected: ${matched.join(", ")}`, 
            [
              { text: "Back", style: "cancel", onPress: resetScanner },
              { text: "Add Anyway", onPress: () => addToInventoryAndReset(name, data, false) },
              { text: "Find Alternative", onPress: () => fetchAIRecommendation(name, matched.join(",")) },
            ]
          );
        } else {
          Alert.alert(
            "Safe to Eat ✅", 
            `Product: ${name}\nMode: ${currentMode}\n\nNo allergens detected for your profile.`,
            [
              { text: "Back", style: "cancel", onPress: resetScanner },
              { text: "Add to Inventory", onPress: () => addToInventoryAndReset(name, data, true) }
            ]
          );
        }
      })
      .catch(() => {
        Alert.alert("Error", "Network request failed");
        resetScanner();
      });
  };

  if (!permission?.granted) return <View style={styles.center}><Text>Camera permission required</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.headerLabel}>Current Mode</Text>
          <Text style={styles.headerValue}>{userProfile.name || "Guest"}</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            {userProfile.allergens.length > 0 ? (
              userProfile.allergens.map((a) => (
                <View key={a} style={styles.allergenChip}>
                  <Text style={styles.allergenChipText}>{a}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.headerSubtext}>{userProfile.name === "Baby" ? "Baby Safety Rules Active" : "No Allergens"}</Text>
            )}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.switchButton} onPress={() => setShowProfiles(true)}>
          <Text style={styles.buttonText}>Switch</Text>
        </TouchableOpacity>
      </View>

      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {showProfiles && (
        <View style={styles.overlay}>
          <View style={styles.profileBox}>
            <Text style={styles.profileTitle}>Select Profile</Text>
            {profiles.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.profileItem, p === userProfile.name && styles.profileItemActive]}
                onPress={async () => {
                  setShowProfiles(false);
                  await switchProfile(p);
                }}
              >
                <Text style={[styles.profileText, p === userProfile.name && styles.profileTextActive]}>
                    {p} {p === userProfile.name ? "✓" : ""}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.profileItem, { backgroundColor: "#F0FDF4", marginTop: 10, borderRadius: 10 }]}
              onPress={() => {
                setShowProfiles(false);
                router.push({ pathname: "/login", params: { canGoBack: "true" } });
              }}
            >
              <Text style={[styles.profileText, { color: "#16A34A", fontWeight: "bold" }]}>
                + Create New Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowProfiles(false)} style={styles.cancel}>
              <Text style={{ color: "red", fontWeight: "bold", marginTop: 10 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(isContextLoading || loadingAI) && (
        <View style={styles.fullLoading} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.85)",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
  },
  headerLabel: { color: "#aaa", fontSize: 10, textTransform: "uppercase" },
  headerValue: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  headerSubtext: { color: "#888", fontSize: 12 },
  allergenChip: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  allergenChipText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  switchButton: { backgroundColor: "#2f95dc", paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "bold" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  profileBox: { backgroundColor: "white", padding: 25, borderRadius: 20, width: "80%" },
  profileTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  profileItem: { padding: 15, borderBottomWidth: 1, borderColor: "#eee" },
  profileItemActive: { backgroundColor: "#f0f9ff" },
  profileText: { fontSize: 16, textAlign: "center" },
  profileTextActive: { color: "#2f95dc", fontWeight: "bold" },
  cancel: { marginTop: 10, alignItems: "center" },
  fullLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 999 }
});
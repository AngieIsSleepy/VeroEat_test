import { useInventory } from "@/context/inventory";
import { useProfile } from "@/context/ProfileContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

  const {
    profile: userProfile,
    profiles,
    switchProfile,
    isLoading: isContextLoading,
  } = useProfile();
  const { addItem } = useInventory();

  const isProcessing = useRef(false);

  useEffect(() => {
    requestPermission();
  }, []);

  const resetScanner = () => {
    isProcessing.current = false;
    setScanned(false);
  };

  // --- 新增：调用 AI 总结成分 ---
  const fetchIngredientsSummary = async (ingredientsText: string) => {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "YOUR_ANTHROPIC_API_KEY", // 🚨 在这里输入你的 API Key
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Summarize these food ingredients into a concise, readable English list. Highlight potential allergens. Original ingredients: ${ingredientsText}`,
            },
          ],
        }),
      });
      const result = await response.json();
      return result.content?.[0]?.text || "No ingredient summary available";
    } catch (err) {
      console.error("AI Summary Error:", err);
      return "No ingredient summary available";
    }
  };

  // --- 修改：添加至清单并处理保质期输入 ---
  const prepareAddToInventory = async (
    name: string,
    barcode: string,
    isSafe: boolean,
    rawIngredients: string,
  ) => {
    setLoadingAI(true);

    // 1. 获取 AI 总结
    const summary = await fetchIngredientsSummary(rawIngredients);
    setLoadingAI(false);

    // 2. 弹出保质期输入框 (输入天数)
    Alert.prompt(
      "Setting Expiry Date",
      "How many days can this food be stored? (Please enter a number)",
      [
        { text: "Cancel", onPress: resetScanner, style: "cancel" },
        {
          text: "Add",
          onPress: (days: string | undefined) => {
            const daysNum = parseInt(days || "7"); // 默认7天
            const expiryTimestamp = Date.now() + daysNum * 24 * 60 * 60 * 1000;

            const added = addItem({
              name,
              barcode,
              scannedBy: userProfile.name || "Guest",
              isSafe,
              expiryDate: expiryTimestamp,
              ingredientsSummary: summary,
            });

            if (added) {
              Alert.alert(
                "Added",
                `${name} has been added to inventory.\nEstimated expiry date: ${new Date(expiryTimestamp).toLocaleDateString()}`,
                [{ text: "OK", onPress: resetScanner }],
              );
            }
          },
        },
      ],
      "plain-text",
      "7", // 默认输入 7
    );
  };

  const fetchAIRecommendation = async (
    unsafeProduct: string,
    reason: string,
  ) => {
    setLoadingAI(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "YOUR_ANTHROPIC_API_KEY",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: `Product: ${unsafeProduct}. Issue: ${reason}. Suggest 1 safe alternative. Return ONLY JSON: {"recommendation": "name", "brand": "brand"}`,
            },
          ],
        }),
      });
      const result = await response.json();
      const rawText = result.content?.[0]?.text || "{}";
      const data = JSON.parse(rawText);
      Alert.alert(
        "AI Recommendation",
        `You can try: ${data.recommendation}\nBrand: ${data.brand}`,
        [{ text: "OK", onPress: resetScanner }],
      );
    } catch {
      Alert.alert("AI Error", "Failed to fetch recommendation");
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
          Alert.alert("Not Found", "Barcode not recognized", [
            { text: "Try Again", onPress: resetScanner },
          ]);
          return;
        }

        const product = json.product;
        const name = product.product_name || "Unknown Product";
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
            `${name}\n\nDetected ingredients: ${matched.join(", ")}`,
            [
              { text: "Back", style: "cancel", onPress: resetScanner },
              {
                text: "Still Add",
                onPress: () =>
                  prepareAddToInventory(name, data, false, ingredients),
              },
              {
                text: "Find Alternatives",
                onPress: () => fetchAIRecommendation(name, matched.join(",")),
              },
            ],
          );
        } else {
          Alert.alert(
            "Safe ✅",
            `Product: ${name}\nCurrent Mode: ${currentMode}\n\nNo allergens detected.`,
            [
              { text: "Back", style: "cancel", onPress: resetScanner },
              {
                text: "Add to Inventory",
                onPress: () =>
                  prepareAddToInventory(name, data, true, ingredients),
              },
            ],
          );
        }
      })
      .catch(() => {
        Alert.alert("Error", "Network request failed");
        resetScanner();
      });
  };

  if (!permission?.granted)
    return (
      <View style={styles.center}>
        <Text>需要相机权限</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* 顶部 Profile 信息栏 */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.headerLabel}>Current Mode</Text>
          <Text style={styles.headerValue}>{userProfile.name || "Guest"}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 4 }}
          >
            {userProfile.allergens.length > 0 ? (
              userProfile.allergens.map((a) => (
                <View key={a} style={styles.allergenChip}>
                  <Text style={styles.allergenChipText}>{a}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.headerSubtext}>
                {userProfile.name === "Baby"
                  ? "Baby safety mode is active"
                  : "No allergen restrictions"}
              </Text>
            )}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setShowProfiles(true)}
        >
          <Text style={styles.buttonText}>Switch</Text>
        </TouchableOpacity>
      </View>

      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={styles.scannerOverlay} pointerEvents="none">
        <View style={styles.scannerBox}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.scanText}>Please scan the barcode</Text>
      </View>

      {showProfiles && (
        <View style={styles.overlay}>
          <View style={styles.profileBox}>
            <Text style={styles.profileTitle}>Select Member</Text>
            {profiles.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.profileItem,
                  p === userProfile.name && styles.profileItemActive,
                ]}
                onPress={async () => {
                  setShowProfiles(false);
                  await switchProfile(p);
                }}
              >
                <Text
                  style={[
                    styles.profileText,
                    p === userProfile.name && styles.profileTextActive,
                  ]}
                >
                  {p} {p === userProfile.name ? "✓" : ""}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[
                styles.profileItem,
                { backgroundColor: "#F0FDF4", marginTop: 10, borderRadius: 10 },
              ]}
              onPress={() => {
                setShowProfiles(false);
                router.push({
                  pathname: "/login",
                  params: { canGoBack: "true" },
                });
              }}
            >
              <Text
                style={[
                  styles.profileText,
                  { color: "#16A34A", fontWeight: "bold" },
                ]}
              >
                + Create New Member
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowProfiles(false)}
              style={styles.cancel}
            >
              <Text style={{ color: "red", fontWeight: "bold", marginTop: 10 }}>
                Cancel
              </Text>
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
  switchButton: {
    backgroundColor: "#2f95dc",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  profileBox: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 20,
    width: "80%",
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  profileItem: { padding: 15, borderBottomWidth: 1, borderColor: "#eee" },
  profileItemActive: { backgroundColor: "#f0f9ff" },
  profileText: { fontSize: 16, textAlign: "center" },
  profileTextActive: { color: "#2f95dc", fontWeight: "bold" },
  cancel: { marginTop: 10, alignItems: "center" },
  fullLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  scannerBox: {
    width: 250,
    height: 250,
    backgroundColor: "transparent",
    position: "relative",
  },
  scanText: {
    color: "white",
    fontSize: 16,
    marginTop: 30,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#10B981",
    borderWidth: 5,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 20,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 20,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 20,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 20,
  },
});

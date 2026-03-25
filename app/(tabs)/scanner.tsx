import { API_BASE_URL } from "@/app/config";
import { useInventory } from "@/context/inventory";
import { useProfile } from "@/context/ProfileContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from './_scanner.styles';

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

interface ScanResult {
  type: "safe" | "unsafe" | "not_found";
  name: string;
  barcode: string;
  ingredients: string;
  imageUrl: string | null;
  matchedAllergens: string[];
  currentMode: string;
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [alternatives, setAlternatives] = useState<any[] | null>(null);
  const [explainedIngredients, setExplainedIngredients] = useState<any[] | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  const {
    profile: userProfile,
    profiles,
    groups,
    activeMode,
    activeGroup,
    switchProfile,
    setActiveGroup,
    clearActiveGroup,
    getActiveAllergens,
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
    setScanResult(null);
    setShowDetails(false);
    setAlternatives(null);
    setExplainedIngredients(null);
  };

  const getCurrentDisplayMode = () => {
    if (activeMode === "group" && activeGroup) {
      return activeGroup.name;
    }
    return userProfile.name || "Guest";
  };

  const getCurrentHeaderAllergens = async () => {
    return await getActiveAllergens();
  };

  const fetchIngredientsExplanation = async (ingredients: string, allergens: string[]) => {
    if (explainedIngredients) {
      setShowDetails(true);
      return;
    }

    setLoadingExplanation(true);
    setShowDetails(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ai/explain-ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: ingredients,
          allergens: allergens.join(","),
        }),
      });
      const result = await response.json();
      if (result.status === "success" && result.data) {
        setExplainedIngredients(result.data);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to explain ingredients.");
    } finally {
      setLoadingExplanation(false);
    }
  };

  const prepareAddToInventory = async (
    name: string,
    barcode: string,
    isSafe: boolean,
    rawIngredients: string,
  ) => {
    setScanResult(null);

    Alert.prompt(
      "Set Expiry Date?",
      "Enter the exact expiration / best by date (e.g., MM/DD/YYYY or YYYY-MM-DD):",
      [
        {
          text: "Skip",
          style: "cancel",
          onPress: () => {
            const added = addItem({
              name,
              barcode,
              scannedBy: getCurrentDisplayMode(),
              isSafe,
              expiryDate: undefined,
              ingredientsSummary: rawIngredients,
            });

            if (added) {
              Alert.alert(
                "Added",
                `${name} has been added without an expiry date.`,
                [{ text: "OK", onPress: resetScanner }]
              );
            }
          }
        },
        {
          text: "Save",
          onPress: (dateString: string | undefined) => {
            let expiryTimestamp = undefined;

            if (dateString && dateString.trim() !== "") {
              const parsedDate = new Date(dateString);
              if (!isNaN(parsedDate.getTime())) {
                expiryTimestamp = parsedDate.getTime();
              } else {
                Alert.alert("Invalid Date", "Could not read the date. Item added without an expiry date.");
              }
            }

            const added = addItem({
              name,
              barcode,
              scannedBy: getCurrentDisplayMode(),
              isSafe,
              expiryDate: expiryTimestamp,
              ingredientsSummary: rawIngredients,
            });

            if (added) {
              const dateMsg = expiryTimestamp
                ? `\nExpiry date set to: ${new Date(expiryTimestamp).toLocaleDateString()}`
                : `\nNo expiry date set.`;

              Alert.alert(
                "Added",
                `${name} has been added to inventory.${dateMsg}`,
                [{ text: "OK", onPress: resetScanner }]
              );
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const fetchAIRecommendation = async (unsafeProduct: string, allergens: string) => {
    setLoadingAI(true);
    setAlternatives(null);

    try {
      const response = await fetch(`${API_BASE_URL}/ai/alternatives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_name: unsafeProduct,
          allergens: allergens,
        }),
      });

      const result = await response.json();

      if (result.status === "success" && result.data) {
        setAlternatives(result.data);
      } else {
        Alert.alert("Error", "Failed to find alternatives.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Network Error", "Could not reach the server.");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (isProcessing.current || scanned) return;
    isProcessing.current = true;
    setScanned(true);

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await res.json();

      if (json.status !== 1) {
        Alert.alert("Not Found", "Barcode not recognized", [
          { text: "Try Again", onPress: resetScanner },
        ]);
        return;
      }

      const product = json.product;
      const name = product.product_name || "Unknown Product";
      const ingredients = (product.ingredients_text || "").toLowerCase();
      const imageUrl = product.image_front_url || product.image_url || null;

      const currentMode = getCurrentDisplayMode();

      let matched: string[] = [];

      if (activeMode === "profile" && currentMode === "Baby") {
        matched = BABY_RULES.filter((r) => ingredients.includes(r));
      } else {
        const selectedAllergens = await getCurrentHeaderAllergens();
        matched = selectedAllergens.filter((allergen) => {
          const keywords = ALLERGEN_KEYWORDS[allergen] || [allergen];
          return keywords.some((k) => ingredients.includes(k));
        });
      }

      setScanResult({
        type: matched.length > 0 ? "unsafe" : "safe",
        name,
        barcode: data,
        ingredients,
        imageUrl,
        matchedAllergens: matched,
        currentMode,
      });
    } catch {
      Alert.alert("Error", "Network request failed");
      resetScanner();
    }
  };

  if (!permission?.granted)
    return (
      <View style={styles.center}>
        <Text>Need Camera Permission</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.headerLabel}>Current Mode</Text>
          <Text style={styles.headerValue}>{getCurrentDisplayMode()}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 4 }}
          >
            {activeMode === "group" && activeGroup ? (
              activeGroup.members.length > 0 ? (
                activeGroup.members.map((member) => (
                  <View key={member} style={styles.allergenChip}>
                    <Text style={styles.allergenChipText}>{member}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.headerSubtext}>No group members</Text>
              )
            ) : userProfile.allergens.length > 0 ? (
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
                  activeMode === "profile" &&
                    p === userProfile.name &&
                    styles.profileItemActive,
                ]}
                onPress={async () => {
                  setShowProfiles(false);
                  await switchProfile(p);
                }}
              >
                <Text
                  style={[
                    styles.profileText,
                    activeMode === "profile" &&
                      p === userProfile.name &&
                      styles.profileTextActive,
                  ]}
                >
                  {p} {activeMode === "profile" && p === userProfile.name ? "✓" : ""}
                </Text>
              </TouchableOpacity>
            ))}

            {groups.length > 0 && (
              <>
                <Text style={localStyles.groupSectionTitle}>Groups</Text>
                {groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.profileItem,
                      activeMode === "group" &&
                        activeGroup?.id === group.id &&
                        styles.profileItemActive,
                    ]}
                    onPress={async () => {
                      setShowProfiles(false);
                      await setActiveGroup(group.id);
                    }}
                  >
                    <Text
                      style={[
                        styles.profileText,
                        activeMode === "group" &&
                          activeGroup?.id === group.id &&
                          styles.profileTextActive,
                      ]}
                    >
                      {group.name}{" "}
                      {activeMode === "group" && activeGroup?.id === group.id ? "✓" : ""}
                    </Text>
                    <Text style={localStyles.groupMemberText}>
                      {group.members.join(", ")}
                    </Text>
                  </TouchableOpacity>
                ))}

                {activeMode === "group" && (
                  <TouchableOpacity
                    style={[styles.profileItem, localStyles.useProfileModeButton]}
                    onPress={async () => {
                      setShowProfiles(false);
                      await clearActiveGroup();
                    }}
                  >
                    <Text style={[styles.profileText, localStyles.useProfileModeText]}>
                      Use Current Profile Instead
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

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

      {scanResult && (
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard}>
            <Text style={scanResult.type === "safe" ? styles.safeTitle : styles.warningTitle}>
              {scanResult.type === "safe" ? "Safe ✅" : `⚠️ Warning (${scanResult.currentMode})`}
            </Text>

            {scanResult.imageUrl && (
              <Image source={{ uri: scanResult.imageUrl }} style={styles.productImage} resizeMode="contain" />
            )}

            <Text style={styles.productName}>{scanResult.name}</Text>

            {scanResult.type === "unsafe" ? (
              <Text style={styles.warningText}>
                Detected: {scanResult.matchedAllergens.join(", ")}
              </Text>
            ) : (
              <Text style={styles.safeText}>No allergens detected.</Text>
            )}

            {showDetails ? (
              <View style={[styles.detailsBox, { maxHeight: 250 }]}>
                <Text style={styles.ingredientsTitle}>🔬 Ingredients Explained:</Text>

                {loadingExplanation ? (
                  <ActivityIndicator size="small" color="#3B82F6" style={{ marginVertical: 20 }} />
                ) : explainedIngredients ? (
                  <ScrollView nestedScrollEnabled={true}>
                    {explainedIngredients.map((item, idx) => (
                      <View key={idx} style={{
                        marginBottom: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: '#E5E7EB',
                        paddingBottom: 8
                      }}>
                        <Text style={{
                          fontWeight: 'bold',
                          color: item.is_allergen ? '#DC2626' : '#1F2937',
                          fontSize: 15
                        }}>
                          {item.is_allergen ? '⚠️ ' : '✅ '}{item.name}
                        </Text>
                        <Text style={{ color: '#4B5563', fontSize: 13, marginTop: 2 }}>
                          {item.explanation}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={{ color: "gray" }}>Could not load explanation.</Text>
                )}

                <TouchableOpacity onPress={() => setShowDetails(false)}>
                  <Text style={styles.toggleText}>Hide Details ▲</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => fetchIngredientsExplanation(scanResult.ingredients, scanResult.matchedAllergens)}>
                <Text style={styles.toggleText}>See Details ▼</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionRow}>
              {scanResult.type === "unsafe" && (
                <TouchableOpacity
                  style={[styles.findAltButton, loadingAI && styles.buttonDisabled]}
                  onPress={() => fetchAIRecommendation(scanResult.name, scanResult.matchedAllergens.join(","))}
                  disabled={loadingAI}
                >
                  {loadingAI ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>✨ Alternatives</Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={scanResult.type === "safe" ? styles.addButtonSafe : styles.addButtonUnsafe}
                onPress={() =>
                  prepareAddToInventory(
                    scanResult.name,
                    scanResult.barcode,
                    scanResult.type === "safe",
                    scanResult.ingredients
                  )
                }
              >
                <Text style={styles.buttonText}>{scanResult.type === "safe" ? "Add to Inventory" : "Still Add"}</Text>
              </TouchableOpacity>
            </View>

            {alternatives && alternatives.length > 0 && (
              <View style={styles.alternativesContainer}>
                <Text style={styles.alternativesTitle}>
                  💡 Safe Alternatives:
                </Text>
                <ScrollView
                  style={styles.alternativesScroll}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {alternatives.map((alt, index) => (
                    <View key={index} style={styles.alternativeCard}>
                      <Text style={styles.altName}>{alt.name}</Text>
                      {alt.brand && alt.brand !== "Generic" && (
                        <Text style={styles.altBrand}>Brand: {alt.brand}</Text>
                      )}
                      <Text style={styles.altReason}>{alt.reason}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity onPress={resetScanner} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Back to Scanner</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isContextLoading && (
        <View style={styles.fullLoading} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  groupSectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6B7280",
    marginTop: 14,
    marginBottom: 8,
  },
  groupMemberText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  useProfileModeButton: {
    marginTop: 10,
    borderRadius: 10,
  },
  useProfileModeText: {
    fontWeight: "bold",
  },
});
import { API_BASE_URL } from "@/app/config";
import { useInventory } from "@/context/inventory";
import { useProfile } from "@/context/ProfileContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { styles } from "./_scanner.styles";

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

const parseExpiryDate = (input: string): number | null => {
  const value = input.trim();

  // support YYYY-MM-DD
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }

  // support MM/DD/YYYY
  match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }

  return null;
};

const isPastExpiryDate = (timestamp: number) => {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();

  return timestamp < todayStart;
};

const formatExpiryDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString();
};

interface ScanResult {
  type: "safe" | "unsafe" | "not_found";
  name: string;
  barcode: string;
  ingredients: string;
  imageUrl: string | null;
  matchedAllergens: string[];
  currentTargetLabel: string;
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [alternatives, setAlternatives] = useState<any[] | null>(null);
  const [explainedIngredients, setExplainedIngredients] = useState<
    any[] | null
  >(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [headerAllergens, setHeaderAllergens] = useState<string[]>([]);

  const {
    activeTargetType,
    activeTargetId,
    activeTargetLabel,
    getAllTargetOptions,
    setActiveTarget,
    getActiveAllergens,
    isLoading: isContextLoading,
  } = useProfile();

  const { addItem } = useInventory();

  const isProcessing = useRef(false);

  useEffect(() => {
    requestPermission();
  }, []);

  useEffect(() => {
    const loadHeaderAllergens = async () => {
      const allergens = await getActiveAllergens();
      setHeaderAllergens(allergens);
    };

    loadHeaderAllergens();
  }, [activeTargetType, activeTargetLabel]);

  const currentTargetTypeText =
    activeTargetType === "group" ? "Group" : "Profile";

  const switchOptions = useMemo(
    () => getAllTargetOptions(),
    [getAllTargetOptions],
  );

  const resetScanner = () => {
    isProcessing.current = false;
    setScanned(false);
    setScanResult(null);
    setShowDetails(false);
    setAlternatives(null);
    setExplainedIngredients(null);
  };

  const fetchIngredientsExplanation = async (
    ingredients: string,
    allergens: string[],
  ) => {
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
          ingredients,
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

  const prepareAddToInventory = async (result: ScanResult) => {
    const { name, barcode, ingredients, matchedAllergens, imageUrl } = result;
    const isSafe = result.type === "safe";
    setScanResult(null);

    Alert.prompt(
      "Set Expiry Date?",
      "Enter expiration / best by date.\nUse YYYY-MM-DD or MM/DD/YYYY.",
      [
        {
          text: "Skip",
          style: "cancel",
          onPress: () => {
            const added = addItem({
              name,
              barcode,
              scannedBy: activeTargetLabel,
              isSafe,
              expiryDate: undefined,
              ingredientsSummary: ingredients,
            });

            if (added) {
              Alert.alert(
                "Added",
                `${name} has been added to ${activeTargetLabel}'s inventory without an expiry date.`,
                [{ text: "OK", onPress: resetScanner }],
              );
            }
          },
        },
        {
          text: "Save",
          onPress: (dateString: string | undefined) => {
            let expiryTimestamp = undefined;

            if (dateString && dateString.trim() !== "") {
              const parsedTimestamp = parseExpiryDate(dateString);

              if (parsedTimestamp === null) {
                Alert.alert(
                  "Invalid Date",
                  "Please use YYYY-MM-DD or MM/DD/YYYY.",
                );
                setScanResult(result);
                return;
              }

              if (isPastExpiryDate(parsedTimestamp)) {
                Alert.alert(
                  "Invalid Date",
                  "Expiration date cannot be earlier than today.",
                );
                setScanResult(result);
                return;
              }

              expiryTimestamp = parsedTimestamp;
            }

            const added = addItem({
              name,
              barcode,
              scannedBy: activeTargetLabel,
              isSafe,
              expiryDate: expiryTimestamp,
              ingredientsSummary: ingredients,
            });

            if (added) {
              const dateMsg = expiryTimestamp
                ? `\nExpiry date set to: ${formatExpiryDate(expiryTimestamp)}`
                : `\nNo expiry date set.`;

              Alert.alert(
                "Added",
                `${name} has been added to ${activeTargetLabel}'s inventory.${dateMsg}`,
                [{ text: "OK", onPress: resetScanner }],
              );
            }
          },
        },
      ],
      "plain-text",
    );
  };

  const fetchAIRecommendation = async (
    unsafeProduct: string,
    allergens: string,
  ) => {
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
          allergens,
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
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${data}.json`,
      );
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

      const selectedAllergens = await getActiveAllergens();
      const matched = selectedAllergens.filter((allergen) => {
        const keywords = ALLERGEN_KEYWORDS[allergen] || [allergen];
        return keywords.some((k) => ingredients.includes(k));
      });

      setScanResult({
        type: matched.length > 0 ? "unsafe" : "safe",
        name,
        barcode: data,
        ingredients,
        imageUrl,
        matchedAllergens: matched,
        currentTargetLabel: activeTargetLabel,
      });
    } catch {
      Alert.alert("Error", "Network request failed");
      resetScanner();
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text>Need Camera Permission</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.headerLabel}>Current Target</Text>
          <Text style={styles.headerValue}>
            {activeTargetLabel} ({currentTargetTypeText})
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 4 }}
          >
            {headerAllergens.length > 0 ? (
              headerAllergens.map((a) => (
                <View key={a} style={styles.allergenChip}>
                  <Text style={styles.allergenChipText}>{a}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.headerSubtext}>No allergen restrictions</Text>
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
            <Text style={styles.profileTitle}>Select Target</Text>

            {switchOptions
              .filter((option) => option.type === "profile")
              .map((option) => {
                const isActive =
                  activeTargetType === "profile" &&
                  activeTargetId === option.id;

                return (
                  <TouchableOpacity
                    key={`profile-${option.id}`}
                    style={[
                      styles.profileItem,
                      isActive && styles.profileItemActive,
                    ]}
                    onPress={async () => {
                      setShowProfiles(false);
                      await setActiveTarget({
                        type: option.type,
                        id: option.id,
                      });
                    }}
                  >
                    <Text
                      style={[
                        styles.profileText,
                        isActive && styles.profileTextActive,
                      ]}
                    >
                      {option.label} {isActive ? "✓" : ""}
                    </Text>
                    <Text style={localStyles.optionTypeText}>Profile</Text>
                  </TouchableOpacity>
                );
              })}

            {switchOptions.some((option) => option.type === "group") && (
              <>
                <Text style={localStyles.groupSectionTitle}>Groups</Text>

                {switchOptions
                  .filter((option) => option.type === "group")
                  .map((option) => {
                    const isActive =
                      activeTargetType === "group" &&
                      activeTargetId === option.id;

                    return (
                      <TouchableOpacity
                        key={`group-${option.id}`}
                        style={[
                          styles.profileItem,
                          isActive && styles.profileItemActive,
                        ]}
                        onPress={async () => {
                          setShowProfiles(false);
                          await setActiveTarget({
                            type: option.type,
                            id: option.id,
                          });
                        }}
                      >
                        <Text
                          style={[
                            styles.profileText,
                            isActive && styles.profileTextActive,
                          ]}
                        >
                          {option.label} {isActive ? "✓" : ""}
                        </Text>
                        <Text style={localStyles.groupMemberText}>
                          {option.subtitle || "Group"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </>
            )}

            <TouchableOpacity
              style={[
                styles.profileItem,
                {
                  backgroundColor: "#F0FDF4",
                  marginTop: 10,
                  borderRadius: 10,
                },
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
            <Text
              style={
                scanResult.type === "safe"
                  ? styles.safeTitle
                  : styles.warningTitle
              }
            >
              {scanResult.type === "safe"
                ? "Safe ✅"
                : `⚠️ Warning (${scanResult.currentTargetLabel})`}
            </Text>

            {scanResult.imageUrl && (
              <Image
                source={{ uri: scanResult.imageUrl }}
                style={styles.productImage}
                resizeMode="contain"
              />
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
                <Text style={styles.ingredientsTitle}>
                  🔬 Ingredients Explained:
                </Text>

                {loadingExplanation ? (
                  <ActivityIndicator
                    size="small"
                    color="#3B82F6"
                    style={{ marginVertical: 20 }}
                  />
                ) : explainedIngredients ? (
                  <ScrollView nestedScrollEnabled={true}>
                    {explainedIngredients.map((item, idx) => (
                      <View
                        key={idx}
                        style={{
                          marginBottom: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: "#E5E7EB",
                          paddingBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: "bold",
                            color: item.is_allergen ? "#DC2626" : "#1F2937",
                            fontSize: 15,
                          }}
                        >
                          {item.is_allergen ? "⚠️ " : "✅ "}
                          {item.name}
                        </Text>
                        <Text
                          style={{
                            color: "#4B5563",
                            fontSize: 13,
                            marginTop: 2,
                          }}
                        >
                          {item.explanation}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={{ color: "gray" }}>
                    Could not load explanation.
                  </Text>
                )}

                <TouchableOpacity onPress={() => setShowDetails(false)}>
                  <Text style={styles.toggleText}>Hide Details ▲</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() =>
                  fetchIngredientsExplanation(
                    scanResult.ingredients,
                    scanResult.matchedAllergens,
                  )
                }
              >
                <Text style={styles.toggleText}>See Details ▼</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionRow}>
              {scanResult.type === "unsafe" && (
                <TouchableOpacity
                  style={[
                    styles.findAltButton,
                    loadingAI && styles.buttonDisabled,
                  ]}
                  onPress={() =>
                    fetchAIRecommendation(
                      scanResult.name,
                      scanResult.matchedAllergens.join(","),
                    )
                  }
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
                style={
                  scanResult.type === "safe"
                    ? styles.addButtonSafe
                    : styles.addButtonUnsafe
                }
                onPress={() => prepareAddToInventory(scanResult)}
              >
                <Text style={styles.buttonText}>
                  {scanResult.type === "safe"
                    ? "Add to Inventory"
                    : "Still Add"}
                </Text>
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
  optionTypeText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
});

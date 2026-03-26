import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useInventory } from "@/context/inventory";
import { useProfile } from "@/context/ProfileContext";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export default function InventoryScreen() {
  const { items, removeItem, clear, runRecallCheckForCurrentTarget } =
    useInventory();

  const {
    activeTargetType,
    activeTargetLabel,
    getAllTargetOptions,
    setActiveTarget,
  } = useProfile();

  const [checkingRecall, setCheckingRecall] = useState(false);

  const currentTargetTypeLabel =
    activeTargetType === "group" ? "Current group" : "Current profile";

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "No Date";
    return new Date(timestamp).toLocaleDateString();
  };

  const handleSwitchTarget = () => {
    const options = getAllTargetOptions();

    Alert.alert(
      "Switch Inventory Target",
      "Choose which profile or group inventory to view.",
      [
        ...options.map((option) => ({
          text:
            option.type === "group"
              ? `Group: ${option.label}`
              : `Profile: ${option.label}`,
          onPress: () =>
            setActiveTarget({
              type: option.type,
              id: option.id,
            }),
        })),
        {
          text: "Cancel",
          style: "cancel" as const,
        },
      ],
    );
  };

  const showIngredientsDetail = (
    name: string,
    summary?: string,
    recallTitle?: string,
    recallReason?: string,
  ) => {
    const recallBlock =
      recallTitle || recallReason
        ? `\n\nRecall Alert:\n${recallTitle || "Recalled product"}${
            recallReason ? `\nReason: ${recallReason}` : ""
          }`
        : "";

    Alert.alert(
      name,
      `${summary || "No ingredients summary available."}${recallBlock}`,
      [{ text: "Close", style: "cancel" }],
    );
  };

  const handleRecallCheck = async () => {
    setCheckingRecall(true);
    try {
      await runRecallCheckForCurrentTarget();
      Alert.alert(
        "Recall Check Complete",
        `Finished checking recalls for ${activeTargetLabel}.`,
      );
    } catch {
      Alert.alert("Error", "Failed to check recall information.");
    } finally {
      setCheckingRecall(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title">Inventory</ThemedText>
          <ThemedText style={styles.profileLabel}>
            {currentTargetTypeLabel}: {activeTargetLabel}
          </ThemedText>

          <Pressable
            style={styles.switchTargetButton}
            onPress={handleSwitchTarget}
          >
            <ThemedText style={styles.switchTargetButtonText}>
              Switch Profile / Group
            </ThemedText>
          </Pressable>
        </View>

        <Pressable
          style={styles.clearBtn}
          onPress={() => {
            if (items.length === 0) return;
            Alert.alert(
              "Clear inventory?",
              `This will remove all items for ${activeTargetLabel}.`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Clear All", style: "destructive", onPress: clear },
              ],
            );
          }}
        >
          <ThemedText type="link" style={{ color: "#EF4444" }}>
            Clear All
          </ThemedText>
        </Pressable>
      </View>

      <Pressable
        style={[
          styles.recallCheckButton,
          checkingRecall && styles.recallCheckButtonDisabled,
        ]}
        onPress={handleRecallCheck}
        disabled={checkingRecall}
      >
        {checkingRecall ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#FFFFFF"
            />
            <ThemedText style={styles.recallCheckButtonText}>
              Check Recall Now
            </ThemedText>
          </>
        )}
      </Pressable>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="basket-outline" size={64} color="#CBD5E1" />
          <ThemedText style={styles.empty}>
            {activeTargetType === "group"
              ? "No items yet for this group. Scan a product to start."
              : "No items yet for this profile. Scan a product to start."}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isExpired = item.expiryDate
              ? item.expiryDate < Date.now()
              : false;

            const daysLeft = item.expiryDate
              ? Math.ceil(
                  (item.expiryDate - Date.now()) / (1000 * 60 * 60 * 24),
                )
              : null;

            const isRecalled = item.recallStatus === "recalled";

            return (
              <Pressable
                onPress={() =>
                  showIngredientsDetail(
                    item.name,
                    item.ingredientsSummary,
                    item.recallTitle,
                    item.recallReason,
                  )
                }
              >
                <ThemedView
                  style={[styles.card, isRecalled && styles.recalledCard]}
                >
                  {isRecalled && (
                    <View style={styles.recallBanner}>
                      <Ionicons
                        name="warning-outline"
                        size={14}
                        color="#FFFFFF"
                      />
                      <ThemedText style={styles.recallBannerText}>
                        RECALLED
                      </ThemedText>
                    </View>
                  )}

                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.titleRow}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={styles.itemName}
                          numberOfLines={1}
                        >
                          {item.name}
                        </ThemedText>

                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: isRecalled
                                ? "#FEE2E2"
                                : item.isSafe
                                  ? "#DCFCE7"
                                  : "#FEE2E2",
                            },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.statusText,
                              {
                                color: isRecalled
                                  ? "#DC2626"
                                  : item.isSafe
                                    ? "#16A34A"
                                    : "#EF4444",
                              },
                            ]}
                          >
                            {isRecalled
                              ? "Recall"
                              : item.isSafe
                                ? "Safe"
                                : "Warning"}
                          </ThemedText>
                        </View>
                      </View>

                      {isRecalled && (
                        <View style={styles.infoRow}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={14}
                            color="#DC2626"
                          />
                          <ThemedText style={styles.recallText}>
                            {" "}
                            {item.recallTitle ||
                              "This product has been recalled."}
                          </ThemedText>
                        </View>
                      )}

                      {!!item.recallReason && (
                        <View style={styles.infoRow}>
                          <Ionicons
                            name="document-text-outline"
                            size={14}
                            color="#DC2626"
                          />
                          <ThemedText style={styles.recallSubText}>
                            {" "}
                            Reason: {item.recallReason}
                          </ThemedText>
                        </View>
                      )}

                      {item.expiryDate && (
                        <View style={styles.infoRow}>
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color={isExpired ? "#EF4444" : "#64748B"}
                          />
                          <ThemedText
                            style={[
                              styles.sub,
                              isExpired && {
                                color: "#EF4444",
                                fontWeight: "bold",
                              },
                            ]}
                          >
                            {" "}
                            Best By: {formatDate(item.expiryDate)} (
                            {isExpired ? "Expired" : `${daysLeft} days left`})
                          </ThemedText>
                        </View>
                      )}

                      <View style={styles.infoRow}>
                        <Ionicons
                          name="person-circle-outline"
                          size={14}
                          color="#64748B"
                        />
                        <ThemedText style={styles.sub}>
                          {" "}
                          Scanned by:{" "}
                          <ThemedText style={styles.boldSub}>
                            {item.scannedBy || "Guest"}
                          </ThemedText>
                        </ThemedText>
                      </View>

                      <View style={styles.infoRow}>
                        <Ionicons
                          name="barcode-outline"
                          size={14}
                          color="#64748B"
                        />
                        <ThemedText style={styles.sub}>
                          {" "}
                          Barcode: {item.barcode}
                        </ThemedText>
                      </View>
                    </View>

                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => removeItem(item.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#94A3B8"
                      />
                    </Pressable>
                  </View>
                </ThemedView>
              </Pressable>
            );
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
    backgroundColor: "#1E293B",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  profileLabel: {
    marginTop: 4,
    color: "#CBD5E1",
    fontSize: 13,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 12,
    marginTop: 4,
  },
  switchTargetButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.12)",
    marginTop: 8,
    marginBottom: 4,
  },
  switchTargetButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#60A5FA",
  },
  recallCheckButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  recallCheckButtonDisabled: {
    opacity: 0.7,
  },
  recallCheckButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -80,
  },
  empty: {
    marginTop: 16,
    color: "#94A3B8",
    fontSize: 16,
    textAlign: "center",
  },
  list: {
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  recalledCard: {
    borderColor: "#DC2626",
    backgroundColor: "#FFF7F7",
  },
  recallBanner: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DC2626",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  recallBannerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  itemName: {
    fontSize: 17,
    flex: 1,
    marginRight: 8,
    color: "#1E293B",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  sub: {
    fontSize: 13,
    color: "#64748B",
  },
  boldSub: {
    fontWeight: "600",
    color: "#334155",
  },
  recallText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "700",
  },
  recallSubText: {
    fontSize: 13,
    color: "#B91C1C",
  },
  removeBtn: {
    padding: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    marginLeft: 8,
  },
});

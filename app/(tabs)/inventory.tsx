import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useInventory } from '@/context/inventory';
import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

export default function InventoryScreen() {
  const { items, removeItem, clear } = useInventory();

  // 格式化日期显示
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'No Date';
    return new Date(timestamp).toLocaleDateString();
  };

  // 查看 AI 成分总结详情
  const showIngredientsDetail = (name: string, summary?: string) => {
    Alert.alert(
      name,
      summary || "No ingredients summary available.",
      [{ text: "Close", style: "cancel" }]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Inventory</ThemedText>
        <Pressable
          style={styles.clearBtn}
          onPress={() => {
            if (items.length === 0) return;
            Alert.alert('Clear inventory?', 'This will remove all items.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear All', style: 'destructive', onPress: clear },
            ]);
          }}
        >
          <ThemedText type="link" style={{ color: '#EF4444' }}>Clear All</ThemedText>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="basket-outline" size={64} color="#CBD5E1" />
          <ThemedText style={styles.empty}>No items yet. Scan a product to start.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            // 计算过期逻辑
            const isExpired = item.expiryDate ? item.expiryDate < Date.now() : false;
            const daysLeft = item.expiryDate 
              ? Math.ceil((item.expiryDate - Date.now()) / (1000 * 60 * 60 * 24)) 
              : null;

            return (
              <Pressable onPress={() => showIngredientsDetail(item.name, item.ingredientsSummary)}>
                <ThemedView style={styles.card}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.titleRow}>
                        <ThemedText type="defaultSemiBold" style={styles.itemName} numberOfLines={1}>
                          {item.name}
                        </ThemedText>
                        
                        <View style={[
                          styles.statusBadge, 
                          { backgroundColor: item.isSafe ? '#DCFCE7' : '#FEE2E2' }
                        ]}>
                          <ThemedText style={[
                            styles.statusText, 
                            { color: item.isSafe ? '#16A34A' : '#EF4444' }
                          ]}>
                            {item.isSafe ? 'Safe' : 'Warning'}
                          </ThemedText>
                        </View>
                      </View>
                      
                      {/* 保质期提示栏 */}
                      {item.expiryDate && (
                        <View style={styles.infoRow}>
                          <Ionicons 
                            name="time-outline" 
                            size={14} 
                            color={isExpired ? "#EF4444" : "#64748B"} 
                          />
                          <ThemedText style={[
                            styles.sub, 
                            isExpired && { color: "#EF4444", fontWeight: "bold" }
                          ]}>
                            {" "}Best By: {formatDate(item.expiryDate)} 
                            {" "}({isExpired ? "Expired" : `${daysLeft} days left`})
                          </ThemedText>
                        </View>
                      )}

                      <View style={styles.infoRow}>
                        <Ionicons name="person-circle-outline" size={14} color="#64748B" />
                        <ThemedText style={styles.sub}>
                          {" "}Scanned by: <ThemedText style={styles.boldSub}>{item.scannedBy || 'Guest'}</ThemedText>
                        </ThemedText>
                      </View>

                      <View style={styles.infoRow}>
                        <Ionicons name="barcode-outline" size={14} color="#64748B" />
                        <ThemedText style={styles.sub}>
                          {" "}Barcode: {item.barcode}
                        </ThemedText>
                      </View>
                    </View>

                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => removeItem(item.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#94A3B8" />
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
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#1E293B' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  clearBtn: { padding: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -80 },
  empty: { marginTop: 16, color: '#94A3B8', fontSize: 16 },
  list: { paddingBottom: 40 },
  card: { 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12, 
    backgroundColor: '#FFFFFF',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3 
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  itemName: { fontSize: 17, flex: 1, marginRight: 8, color: '#1E293B' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  sub: { fontSize: 13, color: '#64748B' },
  boldSub: { fontWeight: '600', color: '#334155' },
  removeBtn: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12, marginLeft: 8 },
});
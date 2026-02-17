// FILE: app/(tabs)/inventory.tsx
import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useInventory } from '@/context/inventory';

export default function InventoryScreen() {
  const { items, removeItem, clear } = useInventory();

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
              { text: 'Clear', style: 'destructive', onPress: clear },
            ]);
          }}
        >
          <ThemedText type="link">Clear</ThemedText>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <ThemedText style={styles.empty}>No items yet. Scan a product and add it.</ThemedText>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ThemedView style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                  <ThemedText style={styles.sub}>Barcode: {item.barcode}</ThemedText>
                </View>

                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removeItem(item.barcode)}
                >
                  <ThemedText type="link">Remove</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  empty: { marginTop: 24, opacity: 0.7 },
  list: { paddingBottom: 24 },
  card: { padding: 14, borderRadius: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sub: { marginTop: 4, opacity: 0.7 },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
});

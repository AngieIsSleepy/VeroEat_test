import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useInventory } from '@/context/inventory';

type ProfileType = 'Baby' | 'Allergy';

const rules: Record<ProfileType, string[]> = {
  'Baby': ['honey', 'sugar', 'salt', 'palm oil', 'additive'],
  'Allergy': ['peanuts', 'milk', 'egg', 'gluten', 'soy']
};

export default function TabOneScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [profile, setProfile] = useState<ProfileType>('Baby');
  const [loadingAI, setLoadingAI] = useState(false);
  const { addItem } = useInventory();
  
  const isProcessing = useRef(false);

  useEffect(() => {
    requestPermission();
  }, []);

  const fetchAIRecommendation = async (unsafeProduct: string, reason: string) => {
  setLoadingAI(true);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'REPLACE_ME', // Replace with your sk-ant-... key
        'anthropic-version': '2023-06-01',
        'dangerouslyAllowBrowser': 'true' // Note: Only works in some environments
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307", // Haiku is faster and cheaper for testing
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `Product: ${unsafeProduct}. Issue: ${reason}. Suggest 1 safe alternative. Return ONLY JSON: {"recommendation": "name", "brand": "brand"}`
          }
        ]
      }),
    });

    const result = await response.json();

    // 1. Check if the API returned an error (like 401 or 403)
    if (result.error) {
      console.error("Claude API Error:", result.error.message);
      throw new Error(result.error.message);
    }

    // 2. Safely extract the text content
    const rawText = result.content[0].text;
    
    // 3. Parse JSON (with a fallback to prevent "undefined")
    const recommendationData = JSON.parse(rawText);

    Alert.alert(
      "AI Recommendation",
      `Try this instead: ${recommendationData.recommendation || 'N/A'}\nBrand: ${recommendationData.brand || 'N/A'}`,
      [{ text: "Got it", onPress: resetScanner }]
    );
  } catch (error) {
    console.error("Fetch Error:", error);
    Alert.alert("AI Error", "The AI service blocked the request or returned invalid data.");
    resetScanner();
  } finally {
    setLoadingAI(false);
  }
};

  const resetScanner = () => {
    isProcessing.current = false;
    setScanned(false);
  };

  const addToInventoryAndReset = (name: string, barcode: string) => {
    const added = addItem({ name, barcode });
    Alert.alert(
      added ? 'Added to Inventory' : 'Already in Inventory',
      `${name}`,
      [{ text: 'OK', onPress: resetScanner }]
    );
  };


  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (isProcessing.current || scanned) return;

    isProcessing.current = true;
    setScanned(true);

    fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`)
      .then(res => res.json())
      .then(json => {
        if (json.status === 1) {
          const product = json.product;
          const productName = product.product_name || 'Unknown Product';
          const ingredients = (product.ingredients_text || "").toLowerCase();
          const forbidden = rules[profile];
          const matched = forbidden.filter(item => ingredients.includes(item));
          
          if (matched.length > 0) {
            // Unsafe: Offer Alternative
            Alert.alert(
              "⚠️ Forbidden Ingredients",
              `Product: ${productName}\n\nDetected: ${matched.join(', ')}`,
              [
                { text: "Don’t Add", style: "cancel", onPress: resetScanner },
                { text: "Add to Inventory", onPress: () => addToInventoryAndReset(productName, data) },
                { text: "Find Alternative", onPress: () => fetchAIRecommendation(productName, matched.join(', ')) },
              ]
            );
          } else {
            // Safe
            Alert.alert(
              "✅ Safe",
              `${productName} is safe for ${profile} mode.`,
              [
                { text: "Add to Inventory", onPress: () => addToInventoryAndReset(productName, data) },
                { text: "OK", onPress: resetScanner },
              ]
            );

          }
        } else {
          Alert.alert("Not Found", "Barcode not recognized.", [{ text: "Retry", onPress: resetScanner }]);
        }
      })
      .catch(() => {
        Alert.alert("Error", "Network request failed");
        resetScanner();
      });
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 20 }}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Authorize Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Current Mode</Text>
          <Text style={styles.headerValue}>{profile}</Text>
        </View>
        <TouchableOpacity 
          style={styles.switchButton} 
          onPress={() => setProfile(prev => prev === 'Baby' ? 'Allergy' : 'Baby')}
        >
          <Text style={styles.buttonText}>Switch Mode</Text>
        </TouchableOpacity>
      </View>

      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "upc_a", "upc_e"] }}
      >
        <View style={styles.overlay}>
          <View style={styles.maskSide} />
          <View style={styles.maskCenterRow}>
            <View style={styles.maskSide} />
            <View style={styles.focusedFrame}>
               <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 }]} />
               <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 }]} />
               <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 }]} />
               <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 }]} />
               {loadingAI && (
                 <View style={styles.aiLoadingOverlay}>
                   <ActivityIndicator size="large" color="#fff" />
                   <Text style={{color: '#fff', marginTop: 10}}>AI Thinking...</Text>
                 </View>
               )}
            </View>
            <View style={styles.maskSide} />
          </View>
          <View style={styles.maskSide} />
        </View>
      </CameraView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Align barcode within the frame</Text>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    position: 'absolute', top: 50, left: 20, right: 20, 
    zIndex: 10, flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 12, alignItems: 'center'
  },
  headerLabel: { color: '#aaa', fontSize: 12 },
  headerValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  switchButton: { backgroundColor: '#2f95dc', padding: 10, borderRadius: 8 },
  button: { backgroundColor: '#2f95dc', padding: 15, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  maskSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', width: '100%' },
  maskCenterRow: { flexDirection: 'row', height: 220 },
  focusedFrame: { width: width * 0.7, height: 220, backgroundColor: 'transparent', position: 'relative' },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: '#2f95dc' },
  footer: { position: 'absolute', bottom: 60, width: '100%', alignItems: 'center' },
  footerText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 20 },
  aiLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(47, 149, 220, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10
  }
});
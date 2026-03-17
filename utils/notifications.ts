import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// 前台收到通知时，也允许弹窗/声音/角标
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function getProjectId(): string | undefined {
  // Expo SDK / EAS 常见位置，做兼容处理
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEasConfig = (Constants as any)?.easConfig?.projectId;

  return fromExpoConfig || fromEasConfig;
}

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  try {
    // Android 通知渠道
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#EF4444",
        sound: "default",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return null;
    }

    const projectId = getProjectId();

    if (!projectId) {
      console.log("Missing Expo projectId; cannot fetch push token");
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenResponse?.data ?? null;
    console.log("Expo push token:", token);

    return token;
  } catch (e) {
    console.log("Failed to get Expo push token:", e);
    return null;
  }
}

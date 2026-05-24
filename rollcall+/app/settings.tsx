import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import BottomTabs from "../components/BottomTabs";
import { useAppStore } from "../store/useAppStore";
import { useAppTheme } from "../theme/useAppTheme";
import { INSTANT_ALERTS_URL } from "../utils/api";
import { registerForPushNotificationsAsync } from "../utils/notifications";

export default function Settings() {
  const theme = useAppTheme();
  const student = useAppStore((state) => state.student);
  const password = useAppStore((state) => state.password);
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const [instantAlertsEnabled, setInstantAlertsEnabled] = useState(false);
  const [savingInstantAlerts, setSavingInstantAlerts] = useState(false);
  const [portalSyncTapCount, setPortalSyncTapCount] = useState(0);

  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const appBuild =
    Constants.expoConfig?.android?.versionCode ||
    Constants.expoConfig?.ios?.buildNumber ||
    "1";
  const appLabel = `v${appVersion} (${appBuild})`;

  useEffect(() => {
    AsyncStorage.getItem(`instantAlerts:${student?.rollNumber || ""}`).then((value) => {
      setInstantAlertsEnabled(value === "true");
    });
  }, [student?.rollNumber]);

  async function toggleTheme() {
    const nextTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
    await AsyncStorage.setItem("rollcall_theme", nextTheme);
  }

  async function setInstantAlerts(enabled: boolean) {
    if (!student?.rollNumber || !password) {
      Alert.alert("Instant Alerts", "Login again once to enable instant alerts.");
      return;
    }

    if (enabled) {
      Alert.alert(
        "Enable Instant Alerts",
        "Optional server-side alerts require RollCall+ to securely store your portal credentials on Cloudflare. They are used only to check attendance/results and send notifications while the app is closed.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable",
            onPress: () => saveInstantAlerts(true),
          },
        ]
      );
      return;
    }

    saveInstantAlerts(false);
  }

  async function saveInstantAlerts(enabled: boolean) {
    try {
      setSavingInstantAlerts(true);
      if (enabled) {
        await registerForPushNotificationsAsync();
      }

      const response = await fetch(INSTANT_ALERTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled,
          rollNumber: student?.rollNumber || "",
          password,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Instant alerts update failed");
      }

      setInstantAlertsEnabled(enabled);
      await AsyncStorage.setItem(
        `instantAlerts:${student?.rollNumber || ""}`,
        enabled ? "true" : "false"
      );
    } catch (error) {
      Alert.alert(
        "Instant Alerts",
        String(error instanceof Error ? error.message : "Could not update instant alerts.")
      );
    } finally {
      setSavingInstantAlerts(false);
    }
  }

  function primePortalSyncAccess() {
    setPortalSyncTapCount((count) => Math.min(count + 1, 3));
  }

  function openPortalSyncIfPrimed() {
    if (portalSyncTapCount < 3) return;
    setPortalSyncTapCount(0);
    router.push("/backend-status");
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[screen, { backgroundColor: theme.dashboardBackground }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={content}
        >
          <View style={header}>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => router.back()}
              style={[iconButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="chevron-back" size={23} color={theme.text} />
            </TouchableOpacity>
          </View>

          <Text style={[eyebrow, { color: theme.primary }]}>PREFERENCES</Text>
          <Text style={[title, { color: theme.text }]}>Settings</Text>
          <Text style={[subtitle, { color: theme.muted }]}>
            Manage alerts, display, portal sync, and account safety.
          </Text>

          <Text style={[sectionTitle, { color: theme.text }]}>Experience</Text>
          <SettingRow
            icon={themeMode === "dark" ? "moon" : "sunny"}
            title="Theme"
            subtitle={themeMode === "dark" ? "Dark Mode" : "Light Mode"}
            color={theme.primary}
            onPress={toggleTheme}
            rightLabel={themeMode === "dark" ? "Dark" : "Light"}
          />

          <Text style={[sectionTitle, { color: theme.text }]}>Notifications</Text>
          <SettingRow
            icon={instantAlertsEnabled ? "notifications" : "notifications-outline"}
            title="Instant Alerts"
            subtitle={
              instantAlertsEnabled
                ? "Server push is enabled for attendance and results"
                : "Optional server checks for attendance/result changes"
            }
            color={instantAlertsEnabled ? theme.success : theme.primary}
            disabled={savingInstantAlerts}
            onPress={() => setInstantAlerts(!instantAlertsEnabled)}
            rightLabel={instantAlertsEnabled ? "On" : "Off"}
          />

          <View style={[privacyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="shield-checkmark-outline" size={22} color={theme.info} />
            <Text style={[privacyText, { color: theme.muted }]}>
              Instant Alerts are optional. If enabled, portal credentials are stored only for server-side attendance/result checks.
            </Text>
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>System</Text>
          <SettingRow
            icon="cloud-done-outline"
            title="Portal Sync"
            subtitle="Cloudflare native scraper is active"
            color={theme.info}
            onPress={primePortalSyncAccess}
            onLongPress={openPortalSyncIfPrimed}
            rightLabel="Enabled"
          />
          <SettingInfo label="Login" value="Saved securely on this device" />
          <SettingInfo label="App Version" value={appLabel} />
        </ScrollView>

        <BottomTabs active="profile" />
      </View>
    </>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  color,
  onPress,
  onLongPress,
  rightLabel,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  onLongPress?: () => void;
  rightLabel: string;
  disabled?: boolean;
}) {
  const theme = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={850}
      style={[
        row,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: disabled ? 0.65 : 1,
        },
      ]}
    >
      <View style={[rowIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[rowSubtitle, { color: theme.muted }]}>{subtitle}</Text>
      </View>

      <View style={[statusPill, { backgroundColor: theme.input, borderColor: theme.border }]}>
        <Text style={[statusText, { color: theme.text }]}>{rightLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SettingInfo({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={[infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[infoLabel, { color: theme.subtle }]}>{label}</Text>
      <Text style={[infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const screen = {
  flex: 1,
};

const content = {
  paddingTop: 58,
  paddingHorizontal: 20,
  paddingBottom: 130,
};

const header = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  marginBottom: 26,
};

const iconButton = {
  width: 46,
  height: 46,
  borderRadius: 16,
  borderWidth: 1,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const eyebrow = {
  fontSize: 14,
  fontWeight: "900" as const,
  letterSpacing: 0,
  marginBottom: 8,
};

const title = {
  fontSize: 46,
  fontWeight: "900" as const,
  letterSpacing: 0,
};

const subtitle = {
  fontSize: 18,
  lineHeight: 26,
  marginTop: 10,
  marginBottom: 28,
};

const sectionTitle = {
  fontSize: 22,
  fontWeight: "900" as const,
  marginTop: 24,
  marginBottom: 12,
};

const row = {
  padding: 16,
  borderRadius: 24,
  borderWidth: 1,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 14,
  marginBottom: 12,
};

const rowIcon = {
  width: 50,
  height: 50,
  borderRadius: 18,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const rowTitle = {
  fontSize: 17,
  fontWeight: "900" as const,
};

const rowSubtitle = {
  fontSize: 13,
  lineHeight: 19,
  fontWeight: "700" as const,
  marginTop: 4,
};

const statusPill = {
  borderWidth: 1,
  borderRadius: 999,
  paddingHorizontal: 11,
  paddingVertical: 7,
};

const statusText = {
  fontSize: 12,
  fontWeight: "900" as const,
};

const privacyCard = {
  borderWidth: 1,
  borderRadius: 22,
  padding: 15,
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  gap: 10,
  marginBottom: 6,
};

const privacyText = {
  flex: 1,
  fontSize: 13,
  lineHeight: 19,
  fontWeight: "700" as const,
};

const infoCard = {
  padding: 18,
  borderRadius: 24,
  marginBottom: 12,
  borderWidth: 1,
};

const infoLabel = {
  fontSize: 13,
  fontWeight: "800" as const,
};

const infoValue = {
  fontSize: 17,
  fontWeight: "900" as const,
  marginTop: 8,
};

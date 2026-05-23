import { Stack, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import BottomTabs from "../components/BottomTabs";
import { useAppStore } from "../store/useAppStore";
import { useAppTheme } from "../theme/useAppTheme";

type Subject = {
  attended: number;
  missed: number;
  total: number;
};

type SavedAccount = {
  rollNumber: string;
  password: string;
  student: any;
  attendance: any[];
  result: any;
  results?: any[];
};

function percentage(attended: number, total: number) {
  if (total === 0) return 0;
  return Math.round((attended / total) * 100);
}

function getInitials(name?: string) {
  if (!name) return "S";
  return name
    .split(" ")
    .map((item) => item[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isAvailable(value?: string) {
  if (!value) return false;
  const cleaned = value.toLowerCase().trim();

  return (
    cleaned !== "" &&
    cleaned !== "not available" &&
    cleaned !== "not avaliable" &&
    cleaned !== "undefined" &&
    cleaned !== "null"
  );
}

export default function Profile() {
  const student = useAppStore((state) => state.student);
  const subjects = useAppStore((state) => state.attendance) as Subject[];
  const clearUser = useAppStore((state) => state.clearUser);
  const setUserData = useAppStore((state) => state.setUserData);
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const theme = useAppTheme();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const totalAttended = subjects.reduce((sum, s) => sum + (s.attended || 0), 0);
  const totalMissed = subjects.reduce((sum, s) => sum + (s.missed || 0), 0);
  const totalLectures = subjects.reduce((sum, s) => sum + (s.total || 0), 0);
  const overall = percentage(totalAttended, totalLectures);

  const photoUrl = student?.photo || student?.profilePic || student?.image;

  async function switchAccount() {
    try {
      const savedUser = await AsyncStorage.getItem("rollcall_user");
      const oldAccountsRaw = await AsyncStorage.getItem("rollcall_accounts");
      const oldAccounts: SavedAccount[] = oldAccountsRaw
        ? JSON.parse(oldAccountsRaw)
        : [];

      let updatedAccounts = oldAccounts;

      if (savedUser) {
        const currentUser: SavedAccount = JSON.parse(savedUser);

        const alreadySaved = oldAccounts.some(
          (acc) => acc.rollNumber === currentUser.rollNumber
        );

        updatedAccounts = alreadySaved
          ? oldAccounts
          : [...oldAccounts, currentUser];

        await AsyncStorage.setItem(
          "rollcall_accounts",
          JSON.stringify(updatedAccounts)
        );
      }

      if (updatedAccounts.length === 0) {
        await AsyncStorage.multiRemove(["rollcall_user", "rollNumber", "password"]);
        clearUser();
        router.replace("/");
        return;
      }

      setSavedAccounts(updatedAccounts);
      setShowAccountPicker(true);
    } catch (error) {
      console.log("Switch account error:", error);
    }
  }

  async function openSavedAccount(account: SavedAccount) {
    try {
      await AsyncStorage.setItem("rollcall_user", JSON.stringify(account));

      setUserData({
        student: account.student,
        attendance: account.attendance || [],
        result: account.result || null,
        results: account.results || [],
        password: account.password || "",
      });

      setShowAccountPicker(false);
      router.replace("/dashboard");
    } catch (error) {
      console.log("Open saved profile account error:", error);
    }
  }

  async function logout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "rollcall_user",
            "rollNumber",
            "password",
          ]);

          clearUser();
          router.replace("/");
        },
      },
    ]);
  }

  async function toggleTheme() {
    const nextTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
    await AsyncStorage.setItem("rollcall_theme", nextTheme);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ padding: 20, paddingTop: 68, paddingBottom: 130 }}>
          <Text style={[sectionTitle, { color: theme.text }]}>Student Profile</Text>

          <View style={[profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[avatarBox, { backgroundColor: theme.input, borderColor: theme.borderStrong }]}>
              {photoUrl ? (
                <Image
                  source={{ uri: photoUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={avatarText}>{getInitials(student?.name)}</Text>
              )}
            </View>

            <Text style={[studentName, { color: theme.text }]}>{student?.name || "Student"}</Text>

            <Text style={[rollText, { color: theme.muted }]}>
              Roll No: {student?.rollNumber || "Not available"}
            </Text>

            <View
              style={{
                backgroundColor: overall >= 75 ? "#22c55e22" : "#ef444422",
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 999,
                marginTop: 16,
                borderWidth: 1,
                borderColor: overall >= 75 ? "#22c55e" : "#ef4444",
              }}
            >
              <Text
                style={{
                  color: overall >= 75 ? "#22c55e" : "#ef4444",
                  fontWeight: "900",
                }}
              >
                {overall >= 75 ? "Safe Attendance" : "Needs Attention"}
              </Text>
            </View>
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>Course Information</Text>

          {isAvailable(student?.course) && (
            <InfoCard label="Course" value={student!.course!} />
          )}

          {isAvailable(student?.semester) && (
            <InfoCard label="Semester" value={student!.semester!} />
          )}

          {isAvailable(student?.section) && (
            <InfoCard label="Section" value={student!.section!} />
          )}

          {isAvailable(student?.labGroup) && (
            <InfoCard label="Lab Group" value={student!.labGroup!} />
          )}

          {isAvailable(student?.batch) && (
            <InfoCard label="Batch" value={student!.batch!} />
          )}

          {isAvailable(student?.universityRollNo) && (
            <InfoCard
              label="University Roll No"
              value={student!.universityRollNo!}
            />
          )}

          <Text style={[sectionTitle, { color: theme.text }]}>Attendance Summary</Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <SummaryCard
              title="Overall"
              value={`${overall}%`}
              color={overall >= 75 ? "#22c55e" : "#ef4444"}
            />

            <SummaryCard
              title="Lectures"
              value={`${totalLectures}`}
              color="#38bdf8"
            />
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <SummaryCard
              title="Present"
              value={`${totalAttended}`}
              color="#22c55e"
            />

            <SummaryCard
              title="Missed"
              value={`${totalMissed}`}
              color="#ef4444"
            />
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>Settings</Text>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={toggleTheme}
            style={[themeToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View>
              <Text style={[infoLabel, { color: theme.subtle }]}>Theme</Text>
              <Text style={[infoValue, { color: theme.text }]}>
                {themeMode === "dark" ? "Dark Mode" : "Light Mode"}
              </Text>
            </View>

            <View style={[themeSwitch, { backgroundColor: theme.primarySoft }]}>
              <Ionicons
                name={themeMode === "dark" ? "moon" : "sunny"}
                size={22}
                color={theme.primary}
              />
            </View>
          </TouchableOpacity>
          <InfoCard label="Portal Sync" value="Enabled" />
          <InfoCard label="Login" value="Saved securely on device" />

          <View style={actionPanel}>
            <ActionButton
              icon="swap-horizontal"
              title="Switch Account"
              subtitle="Choose another saved student profile"
              color="#8b5cf6"
              backgroundColor="#7c3aed22"
              borderColor="#7c3aed66"
              onPress={switchAccount}
            />

            <ActionButton
              icon="cloud-done-outline"
              title="Backend Status"
              subtitle="Check Cloudflare native scraper health"
              color="#38bdf8"
              backgroundColor="#0ea5e922"
              borderColor="#0ea5e966"
              onPress={() => router.push("/backend-status")}
            />

            <ActionButton
              icon="log-out-outline"
              title="Logout"
              subtitle="Remove this session from the device"
              color="#f87171"
              backgroundColor="#ef444422"
              borderColor="#ef444466"
              onPress={logout}
            />
          </View>
        </View>
      </ScrollView>

      <Modal transparent visible={showAccountPicker} animationType="slide">
        <Pressable
          onPress={() => setShowAccountPicker(false)}
          style={[modalBackdrop, { backgroundColor: theme.backdrop }]}
        >
          <Pressable style={[accountModal, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={modalHandle} />

            <Text style={[modalTitle, { color: theme.text }]}>Switch Account</Text>
            <Text style={[modalSubtitle, { color: theme.muted }]}>Choose a saved student profile</Text>

            {savedAccounts.map((account) => (
              <TouchableOpacity
                key={account.rollNumber}
                activeOpacity={0.86}
                onPress={() => openSavedAccount(account)}
                style={[accountItem, { backgroundColor: theme.input, borderColor: theme.border }]}
              >
                <View style={accountAvatar}>
                  <Text style={accountAvatarText}>
                    {getInitials(account.student?.name)}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[accountName, { color: theme.text }]}>
                    {account.student?.name || "Student"}
                  </Text>

                  <Text style={[accountRoll, { color: theme.muted }]}>Roll No: {account.rollNumber}</Text>
                </View>

                <Ionicons name="chevron-forward" size={22} color={theme.subtle} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <BottomTabs active="profile" />
    </>
  );
}

function SummaryCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  const theme = useAppTheme();

  return (
    <View style={[summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[summaryTitle, { color: theme.subtle }]}>{title}</Text>
      <Text style={{ color, fontSize: 30, fontWeight: "900", marginTop: 8 }}>
        {value}
      </Text>
    </View>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={[infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[infoLabel, { color: theme.subtle }]}>{label}</Text>
      <Text style={[infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  title,
  subtitle,
  color,
  backgroundColor,
  borderColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[actionButton, { backgroundColor: theme.surface, borderColor }]}
    >
      <View style={[actionIconBox, { backgroundColor }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[actionTitle, { color: theme.text }]}>{title}</Text>
        <Text style={actionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={22} color={theme.subtle} />
    </TouchableOpacity>
  );
}

const profileCard = {
  backgroundColor: "#0f172a",
  padding: 24,
  borderRadius: 36,
  marginTop: 26,
  alignItems: "center" as const,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const avatarBox = {
  width: 120,
  height: 120,
  borderRadius: 40,
  backgroundColor: "#020617",
  justifyContent: "center" as const,
  alignItems: "center" as const,
  borderWidth: 1,
  borderColor: "#334155",
  overflow: "hidden" as const,
};

const avatarText = {
  color: "#38bdf8",
  fontSize: 38,
  fontWeight: "900" as const,
};

const studentName = {
  color: "white",
  fontSize: 28,
  fontWeight: "900" as const,
  marginTop: 18,
  textAlign: "center" as const,
};

const rollText = {
  color: "#94a3b8",
  marginTop: 8,
  fontSize: 16,
};

const sectionTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 32,
  marginBottom: 16,
};

const summaryCard = {
  flex: 1,
  backgroundColor: "#0f172a",
  padding: 18,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const summaryTitle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: "800" as const,
};

const infoCard = {
  backgroundColor: "#0f172a",
  padding: 18,
  borderRadius: 24,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const infoLabel = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: "800" as const,
};

const infoValue = {
  color: "white",
  fontSize: 17,
  fontWeight: "900" as const,
  marginTop: 8,
};

const actionPanel = {
  marginTop: 30,
  gap: 12,
};

const themeToggle = {
  padding: 18,
  borderRadius: 24,
  marginBottom: 12,
  borderWidth: 1,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
};

const themeSwitch = {
  width: 52,
  height: 52,
  borderRadius: 18,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const actionButton = {
  backgroundColor: "#0f172a",
  padding: 16,
  borderRadius: 24,
  borderWidth: 1,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 14,
};

const actionIconBox = {
  width: 48,
  height: 48,
  borderRadius: 18,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const actionTitle = {
  color: "white",
  fontWeight: "900" as const,
  fontSize: 17,
};

const actionSubtitle = {
  color: "#64748b",
  marginTop: 5,
  fontWeight: "700" as const,
};

const modalBackdrop = {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.58)",
  justifyContent: "flex-end" as const,
};

const accountModal = {
  backgroundColor: "#0f172a",
  padding: 22,
  borderTopLeftRadius: 34,
  borderTopRightRadius: 34,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const modalHandle = {
  width: 48,
  height: 5,
  borderRadius: 999,
  backgroundColor: "#334155",
  alignSelf: "center" as const,
  marginBottom: 18,
};

const modalTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
};

const modalSubtitle = {
  color: "#94a3b8",
  marginTop: 6,
  marginBottom: 16,
  fontWeight: "700" as const,
};

const accountItem = {
  backgroundColor: "#020617",
  borderRadius: 22,
  padding: 16,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: "#1e293b",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 14,
};

const accountAvatar = {
  width: 48,
  height: 48,
  borderRadius: 18,
  backgroundColor: "#7c3aed22",
  justifyContent: "center" as const,
  alignItems: "center" as const,
  borderWidth: 1,
  borderColor: "#7c3aed55",
};

const accountAvatarText = {
  color: "#c4b5fd",
  fontSize: 16,
  fontWeight: "900" as const,
};

const accountName = {
  color: "white",
  fontSize: 16,
  fontWeight: "900" as const,
};

const accountRoll = {
  color: "#94a3b8",
  marginTop: 5,
  fontWeight: "700" as const,
};

import { Stack, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import BottomTabs from "../components/BottomTabs";
import { useAppStore } from "../store/useAppStore";
import { useAppTheme } from "../theme/useAppTheme";
import { API_BASE_URL, HEALTH_URL, SUPPORT_TICKET_URL } from "../utils/api";

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

type SupportCategory = "Login" | "Attendance" | "GPA/GNDU" | "Account" | "App Bug";
type SupportPriority = "Normal" | "Urgent";

type SupportTicket = {
  id: string;
  status: "open" | "shared";
  category: SupportCategory;
  priority: SupportPriority;
  message: string;
  createdAt: string;
};

const SUPPORT_CATEGORIES: SupportCategory[] = [
  "Login",
  "Attendance",
  "GPA/GNDU",
  "Account",
  "App Bug",
];

const SUPPORT_PRIORITIES: SupportPriority[] = ["Normal", "Urgent"];

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

function getSupportTicketsKey(rollNumber?: string) {
  const cleanRoll = String(rollNumber || "").trim();
  return cleanRoll ? `supportTickets:${cleanRoll}` : "supportTickets";
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
  const [showSupportCenter, setShowSupportCenter] = useState(false);
  const [supportCategory, setSupportCategory] = useState<SupportCategory>("Attendance");
  const [supportPriority, setSupportPriority] = useState<SupportPriority>("Normal");
  const [supportContact, setSupportContact] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  const totalAttended = subjects.reduce((sum, s) => sum + (s.attended || 0), 0);
  const totalMissed = subjects.reduce((sum, s) => sum + (s.missed || 0), 0);
  const totalLectures = subjects.reduce((sum, s) => sum + (s.total || 0), 0);
  const overall = percentage(totalAttended, totalLectures);

  const photoUrl = student?.photo || student?.profilePic || student?.image;
  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const appBuild =
    Constants.expoConfig?.android?.versionCode ||
    Constants.expoConfig?.ios?.buildNumber ||
    "1";
  const appLabel = `v${appVersion} (${appBuild})`;
  const supportTicketsKey = getSupportTicketsKey(student?.rollNumber);

  const loadSupportTickets = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(supportTicketsKey);
      setSupportTickets(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.log("Support ticket history load error:", error);
    }
  }, [supportTicketsKey]);

  useEffect(() => {
    loadSupportTickets();
  }, [loadSupportTickets]);

  async function saveSupportTicket(ticket: SupportTicket) {
    const updated = [
      ticket,
      ...supportTickets.filter((item) => item.id !== ticket.id),
    ].slice(0, 10);

    setSupportTickets(updated);
    await AsyncStorage.setItem(supportTicketsKey, JSON.stringify(updated));
  }

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

  async function submitSupportTicket() {
    if (!supportMessage.trim()) {
      Alert.alert("Support", "Please describe the issue first.");
      return;
    }

    try {
      setSubmittingSupport(true);

      let requestId = "Not available";
      let backendStatus = "Not checked";

      try {
        const response = await fetch(HEALTH_URL);
        const data = await response.json();
        requestId =
          data?.requestId || response.headers.get("X-Request-Id") || requestId;
        backendStatus = data?.status || `HTTP ${response.status}`;
      } catch {
        backendStatus = "Health check failed";
      }

      const ticketPayload = {
        category: supportCategory,
        priority: supportPriority,
        contact: supportContact.trim(),
        message: supportMessage.trim(),
        appVersion: appLabel,
        backendStatus,
        requestId,
        apiBaseUrl: API_BASE_URL,
        rollNumber: student?.rollNumber || "",
        platform: "expo",
      };

      const response = await fetch(SUPPORT_TICKET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ticketPayload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Support ticket submit failed");
      }

      await saveSupportTicket({
        id: data.ticketId,
        status: "open",
        category: supportCategory,
        priority: supportPriority,
        message: supportMessage.trim(),
        createdAt: new Date().toISOString(),
      });

      setShowSupportCenter(false);
      setSupportMessage("");
      Alert.alert(
        "Support Ticket Created",
        `Ticket ${data.ticketId} has been saved. We can use this ID to track your issue.`
      );
    } catch (error) {
      const fallbackTicketId = `RC-${Date.now().toString().slice(-6)}`;

      await Share.share({
        title: "RollCall+ support ticket",
        message: [
          "RollCall+ Support Ticket",
          "",
          `Ticket: ${fallbackTicketId}`,
          `Category: ${supportCategory}`,
          `Priority: ${supportPriority}`,
          `Contact: ${supportContact.trim() || "Not provided"}`,
          `App: ${appLabel}`,
          "Backend: Not submitted",
          `Submit Error: ${String(error instanceof Error ? error.message : error)}`,
          `API: ${API_BASE_URL}`,
          `Roll No: ${student?.rollNumber || "Not available"}`,
          "",
          "Issue:",
          supportMessage.trim(),
        ].join("\n"),
      });
      await saveSupportTicket({
        id: fallbackTicketId,
        status: "shared",
        category: supportCategory,
        priority: supportPriority,
        message: supportMessage.trim(),
        createdAt: new Date().toISOString(),
      });
      setShowSupportCenter(false);
      setSupportMessage("");
      Alert.alert(
        "Support Ticket Shared",
        "Cloud submit failed, so a shareable support ticket was prepared instead."
      );
    } finally {
      setSubmittingSupport(false);
    }
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
          <TouchableOpacity
            activeOpacity={1}
            delayLongPress={900}
            onLongPress={() => router.push("/backend-status")}
          >
            <InfoCard label="Portal Sync" value="Enabled" />
          </TouchableOpacity>
          <InfoCard label="Login" value="Saved securely on device" />
          <InfoCard label="App Version" value={appLabel} />

          <Text style={[sectionTitle, { color: theme.text }]}>My Support Tickets</Text>

          {supportTickets.length === 0 ? (
            <View style={[emptySupportCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[emptySupportText, { color: theme.muted }]}>
                No support tickets yet.
              </Text>
            </View>
          ) : (
            supportTickets.map((ticket) => (
              <View
                key={ticket.id}
                style={[supportTicketCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={supportTicketHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[supportTicketId, { color: theme.text }]}>
                      {ticket.id}
                    </Text>
                    <Text style={[supportTicketMeta, { color: theme.subtle }]}>
                      {ticket.category} - {ticket.priority}
                    </Text>
                  </View>

                  <View
                    style={[
                      supportStatusPill,
                      {
                        backgroundColor:
                          ticket.status === "open" ? "#22c55e22" : "#f59e0b22",
                        borderColor:
                          ticket.status === "open" ? "#22c55e" : "#f59e0b",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        supportStatusText,
                        { color: ticket.status === "open" ? "#22c55e" : "#f59e0b" },
                      ]}
                    >
                      {ticket.status === "open" ? "Open" : "Shared"}
                    </Text>
                  </View>
                </View>

                <Text numberOfLines={2} style={[supportTicketMessage, { color: theme.muted }]}>
                  {ticket.message}
                </Text>
              </View>
            ))
          )}

          <View style={actionPanel}>
            <ActionButton
              icon="chatbox-ellipses-outline"
              title="Support Center"
              subtitle="Create a support ticket with app details"
              color="#38bdf8"
              backgroundColor="#0ea5e922"
              borderColor="#0ea5e966"
              onPress={() => setShowSupportCenter(true)}
            />

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

      <Modal transparent visible={showSupportCenter} animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setShowSupportCenter(false);
            }}
            style={[modalBackdrop, { backgroundColor: theme.backdrop }]}
          >
            <Pressable style={[supportModal, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={modalHandle} />

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={supportScrollContent}
              >
                <Text style={[modalTitle, { color: theme.text }]}>Support Center</Text>
                <Text style={[modalSubtitle, { color: theme.muted }]}>
                  Send a support ticket with safe app and portal details.
                </Text>

                <Text style={[supportLabel, { color: theme.subtle }]}>Category</Text>
                <View style={supportChipRow}>
                  {SUPPORT_CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      activeOpacity={0.86}
                      onPress={() => setSupportCategory(category)}
                      style={[
                        supportChip,
                        {
                          backgroundColor:
                            supportCategory === category ? theme.primary : theme.input,
                          borderColor:
                            supportCategory === category ? "#a78bfa" : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          supportChipText,
                          { color: supportCategory === category ? "#ffffff" : theme.text },
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[supportLabel, { color: theme.subtle }]}>Priority</Text>
                <View style={supportChipRow}>
                  {SUPPORT_PRIORITIES.map((priority) => (
                    <TouchableOpacity
                      key={priority}
                      activeOpacity={0.86}
                      onPress={() => setSupportPriority(priority)}
                      style={[
                        supportChip,
                        {
                          backgroundColor:
                            supportPriority === priority ? theme.primary : theme.input,
                          borderColor:
                            supportPriority === priority ? "#a78bfa" : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          supportChipText,
                          { color: supportPriority === priority ? "#ffffff" : theme.text },
                        ]}
                      >
                        {priority}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  placeholder="Contact email or phone"
                  placeholderTextColor={theme.subtle}
                  value={supportContact}
                  onChangeText={setSupportContact}
                  style={[supportInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.borderStrong }]}
                />

                <TextInput
                  placeholder="Describe what happened"
                  placeholderTextColor={theme.subtle}
                  value={supportMessage}
                  onChangeText={setSupportMessage}
                  multiline
                  textAlignVertical="top"
                  style={[supportMessageInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.borderStrong }]}
                />

                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={submittingSupport}
                  onPress={submitSupportTicket}
                  style={[supportSubmit, { opacity: submittingSupport ? 0.7 : 1 }]}
                >
                  <Text style={supportSubmitText}>
                    {submittingSupport ? "Preparing Ticket..." : "Create Support Ticket"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
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
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      disabled={disabled}
      style={[
        actionButton,
        {
          backgroundColor: theme.surface,
          borderColor,
          opacity: disabled ? 0.72 : 1,
        },
      ]}
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

const supportModal = {
  backgroundColor: "#0f172a",
  paddingHorizontal: 22,
  paddingTop: 22,
  paddingBottom: 10,
  borderTopLeftRadius: 34,
  borderTopRightRadius: 34,
  borderWidth: 1,
  borderColor: "#1e293b",
  maxHeight: "82%" as const,
};

const supportScrollContent = {
  paddingBottom: 190,
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

const supportLabel = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: "900" as const,
  marginTop: 8,
  marginBottom: 8,
};

const supportChipRow = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
  marginBottom: 10,
};

const supportChip = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 999,
  borderWidth: 1,
};

const supportChipText = {
  fontWeight: "900" as const,
  fontSize: 13,
};

const supportInput = {
  padding: 14,
  borderRadius: 18,
  borderWidth: 1,
  fontSize: 16,
  marginTop: 8,
};

const supportMessageInput = {
  minHeight: 150,
  padding: 14,
  borderRadius: 18,
  borderWidth: 1,
  fontSize: 16,
  marginTop: 12,
};

const supportSubmit = {
  backgroundColor: "#7c3aed",
  borderRadius: 18,
  padding: 16,
  alignItems: "center" as const,
  marginTop: 14,
};

const supportSubmitText = {
  color: "#ffffff",
  fontSize: 16,
  fontWeight: "900" as const,
};

const emptySupportCard = {
  padding: 18,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const emptySupportText = {
  textAlign: "center" as const,
  fontWeight: "700" as const,
};

const supportTicketCard = {
  padding: 16,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: "#1e293b",
  marginBottom: 12,
};

const supportTicketHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
};

const supportTicketId = {
  fontSize: 16,
  fontWeight: "900" as const,
};

const supportTicketMeta = {
  marginTop: 5,
  fontWeight: "700" as const,
};

const supportStatusPill = {
  paddingHorizontal: 10,
  paddingVertical: 7,
  borderRadius: 999,
  borderWidth: 1,
};

const supportStatusText = {
  fontWeight: "900" as const,
  fontSize: 12,
};

const supportTicketMessage = {
  marginTop: 10,
  lineHeight: 20,
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAppStore } from "../../store/useAppStore";
import { useAppTheme } from "../../theme/useAppTheme";
import { LOGIN_URL } from "../../utils/api";

const APP_LOGO = require("../../assets/icon.png");

type SavedAccount = {
  rollNumber: string;
  password: string;
  student: any;
  attendance: any[];
  result: any;
  results?: any[];
  savedAt?: string;
};

export default function LoginScreen() {
  const [rollNumber, setRollNumber] = useState("");
  const [password, setPassword] = useState("");
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showAccounts, setShowAccounts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const theme = useAppTheme();
  const isLight = theme.mode === "light";
  const loginCardBackground = "#0f172a";
  const loginInputBackground = "#f8fafc";
  const loginBorder = isLight ? "#e2e8f0" : theme.border;

  const setUserData = useAppStore.getState().setUserData;

  const loadSavedAccounts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("rollcall_accounts");
      setSavedAccounts(raw ? JSON.parse(raw) : []);
    } catch (error) {
      console.log("Saved accounts load error:", error);
    }
  }, []);

  const saveAccount = useCallback(async (account: SavedAccount) => {
    await AsyncStorage.setItem("rollcall_user", JSON.stringify(account));

    const oldRaw = await AsyncStorage.getItem("rollcall_accounts");
    const oldAccounts: SavedAccount[] = oldRaw ? JSON.parse(oldRaw) : [];

    const withoutDuplicate = oldAccounts.filter(
      (acc) => acc.rollNumber !== account.rollNumber
    );

    const updatedAccounts = [account, ...withoutDuplicate];

    await AsyncStorage.setItem(
      "rollcall_accounts",
      JSON.stringify(updatedAccounts)
    );

    setSavedAccounts(updatedAccounts);
  }, []);

  const refreshSavedLogin = useCallback(async (account: SavedAccount) => {
    try {
      const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNumber: account.rollNumber,
          password: account.password,
          forceRefresh: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Saved login refresh failed");
      }

      const refreshedAccount: SavedAccount = {
        rollNumber: account.rollNumber,
        password: account.password,
        student: data.student,
        attendance: data.attendance || [],
        result: data.result || null,
        results: data.results || [],
        savedAt: new Date().toISOString(),
      };

      await saveAccount(refreshedAccount);

      setUserData({
        student: refreshedAccount.student,
        attendance: refreshedAccount.attendance,
        result: refreshedAccount.result,
        results: refreshedAccount.results || [],
        password: refreshedAccount.password,
      });

      router.replace("/dashboard");
    } catch (error) {
      console.log("Saved login refresh failed, using cache:", error);

      setUserData({
        student: account.student,
        attendance: account.attendance || [],
        result: account.result || null,
        results: account.results || [],
        password: account.password || "",
      });

      router.replace("/dashboard");
    }
  }, [saveAccount, setUserData]);

  const checkSavedLogin = useCallback(async () => {
    try {
      const savedUser = await AsyncStorage.getItem("rollcall_user");
      if (!savedUser) return;

      const parsedUser: SavedAccount = JSON.parse(savedUser);

      if (parsedUser.rollNumber && parsedUser.password) {
        await refreshSavedLogin(parsedUser);
        return;
      }

      setUserData({
        student: parsedUser.student,
        attendance: parsedUser.attendance || [],
        result: parsedUser.result || null,
        results: parsedUser.results || [],
        password: parsedUser.password || "",
      });

      router.replace("/dashboard");
    } catch (error) {
      console.log("Auto login failed:", error);
    }
  }, [refreshSavedLogin, setUserData]);

  useEffect(() => {
    checkSavedLogin();
    loadSavedAccounts();
  }, [checkSavedLogin, loadSavedAccounts]);

  async function openSavedAccount(account: SavedAccount) {
    try {
      setShowAccounts(false);
      await refreshSavedLogin(account);
    } catch (error) {
      console.log("Open saved account error:", error);
    }
  }

  async function removeSavedAccount(roll: string) {
    try {
      const updated = savedAccounts.filter((acc) => acc.rollNumber !== roll);
      setSavedAccounts(updated);
      await AsyncStorage.setItem("rollcall_accounts", JSON.stringify(updated));
    } catch (error) {
      console.log("Remove saved account error:", error);
    }
  }

  async function handleLogin() {
    if (!rollNumber.trim() || !password.trim()) {
      Alert.alert("Missing Details", "Please enter roll number and password");
      return;
    }

    try {
      setLoading(true);

      const cleanRoll = rollNumber.trim();
      const cleanPassword = password.trim();

      const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNumber: cleanRoll,
          password: cleanPassword,
          forceRefresh: true,
        }),
      });

      const data = await response.json();
      const requestId = data?.requestId || response.headers.get("X-Request-Id");

      if (!response.ok) {
        Alert.alert(
          "Login Failed",
          `${data.message || "Invalid credentials"}${
            requestId ? `\n\nRequest ID: ${requestId}` : ""
          }`
        );
        return;
      }

      const accountPayload: SavedAccount = {
        rollNumber: cleanRoll,
        password: cleanPassword,
        student: data.student,
        attendance: data.attendance || [],
        result: data.result || null,
        results: data.results || [],
        savedAt: new Date().toISOString(),
      };

      await saveAccount(accountPayload);

      setUserData({
        student: data.student,
        attendance: data.attendance || [],
        result: data.result || null,
        results: data.results || [],
        password: cleanPassword,
      });

      router.replace("/dashboard");
    } catch (error) {
      console.log("Login error:", error);
      Alert.alert(
        "Server Error",
        "Could not connect to RollCall+ server. Please check Backend Status from Profile."
      );
    } finally {
      setLoading(false);
    }
  }

  function openSavedAccounts() {
    setShowAccounts(true);
  }

  function closeSavedAccounts() {
    setShowAccounts(false);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: theme.background }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.duration(700)}>
            <View style={[brandMark, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Image source={APP_LOGO} style={brandLogo} resizeMode="contain" />
            </View>

            <Text style={eyebrow}>WELCOME TO</Text>

            <Text style={[title, { color: theme.text }]}>RollCall+</Text>

            <Text style={[subtitle, { color: theme.muted }]}>
              Attendance, GPA, and portal sync in one place.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(120).duration(700)}
            style={[
              loginCard,
              {
                backgroundColor: loginCardBackground,
                borderColor: loginBorder,
                shadowColor: isLight ? "#94a3b8" : "#7c3aed",
              },
            ]}
          >
            <View style={cardHeader}>
              <View>
                <Text style={[cardTitle, { color: "#ffffff" }]}>Student Login</Text>
                <Text style={[cardSubtitle, { color: "#94a3b8" }]}>Use your AGC LMS credentials</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setShowPrivacy(true)}
                style={secureBadge}
              >
                <Ionicons name="shield-checkmark" size={17} color="#22c55e" />
                <Text style={secureBadgeText}>Secure</Text>
              </TouchableOpacity>
            </View>

            <View style={[inputShell, { backgroundColor: loginInputBackground, borderColor: loginBorder }]}>
              <Ionicons name="id-card-outline" size={21} color="#64748b" />

              <TextInput
                placeholder="Roll Number"
                placeholderTextColor="#64748b"
                value={rollNumber}
                onChangeText={setRollNumber}
                autoCapitalize="none"
                autoCorrect={false}
                style={[inputText, { color: "#0f172a" }]}
              />
            </View>

            <View style={[inputShell, { marginBottom: 0, backgroundColor: loginInputBackground, borderColor: loginBorder }]}>
              <Ionicons name="lock-closed-outline" size={21} color="#64748b" />

              <TextInput
                placeholder="Password"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCorrect={false}
                style={[inputText, { color: "#0f172a" }]}
              />

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setShowPassword((value) => !value)}
                style={passwordToggle}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={21}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={handleLogin}
              disabled={loading}
              style={[loginButton, { opacity: loading ? 0.82 : 1 }]}
            >
              {loading ? (
                <View style={buttonContent}>
                  <ActivityIndicator color="white" />
                  <Text style={loginButtonText}>Syncing portal data...</Text>
                </View>
              ) : (
                <View style={buttonContent}>
                  <Text style={loginButtonText}>Login to RollCall+</Text>
                  <Ionicons name="arrow-forward" size={20} color="white" />
                </View>
              )}
            </TouchableOpacity>

            <View style={loginFooterRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setShowPrivacy(true)}
                style={privacyLink}
              >
                <Ionicons name="lock-closed-outline" size={15} color="#38bdf8" />
                <Text style={privacyLinkText}>Privacy</Text>
              </TouchableOpacity>

              <Text style={[footerDot, { color: "#64748b" }]}>•</Text>

              <Text style={[footerText, { color: "#94a3b8" }]}>No selling or sharing</Text>
            </View>

            {savedAccounts.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={openSavedAccounts}
                style={savedAccountButtonLite}
              >
                <Ionicons name="people-outline" size={18} color="#c4b5fd" />
                <Text style={savedAccountTitleLite}>Switch saved account</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal transparent visible={showAccounts} animationType="slide">
        <Pressable
          onPress={closeSavedAccounts}
          style={{
            flex: 1,
            backgroundColor: theme.backdrop,
            justifyContent: "flex-end",
          }}
        >
          <View style={[accountSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable>
              <View>
                <View style={modalHandle} />

                <Text style={[modalTitle, { color: theme.text }]}>Saved Accounts</Text>
                <Text style={[modalSubtitle, { color: theme.muted }]}>
                  Tap a profile to sync and continue
                </Text>
              </View>

              <ScrollView
                style={accountList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {savedAccounts.map((acc) => (
                  <View
                    key={acc.rollNumber}
                  style={[accountCard, { backgroundColor: theme.input, borderColor: theme.border }]}
                >
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={() => openSavedAccount(acc)}
                      style={accountMain}
                    >
                      <View style={accountAvatar}>
                        <Text style={accountInitials}>
                          {String(acc.student?.name || "S")
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[accountName, { color: theme.text }]}>
                          {acc.student?.name || "Student"}
                        </Text>

                        <Text style={[accountMeta, { color: theme.muted }]}>Roll No: {acc.rollNumber}</Text>
                      </View>

                      <Ionicons name="chevron-forward" size={22} color={theme.subtle} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => removeSavedAccount(acc.rollNumber)}
                      style={removeButton}
                    >
                      <Ionicons name="trash-outline" size={16} color="#f87171" />
                      <Text style={removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={showPrivacy} animationType="fade">
        <Pressable
          onPress={() => setShowPrivacy(false)}
          style={{
            flex: 1,
            backgroundColor: theme.backdrop,
            justifyContent: "flex-end",
          }}
        >
          <Pressable style={[privacyModal, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={modalHandle} />

            <View style={privacyModalIcon}>
              <Ionicons name="shield-checkmark" size={30} color="#38bdf8" />
            </View>

            <Text style={[privacyModalTitle, { color: theme.text }]}>Your data stays yours</Text>

            <PrivacyPoint text="RollCall+ uses your login only to fetch your attendance and result from the portal." />
            <PrivacyPoint text="We do not copy, sell, or share your student data." />
            <PrivacyPoint text="Saved accounts stay on this device so switching profiles is faster." />

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => setShowPrivacy(false)}
              style={privacyDoneButton}
            >
              <Text style={privacyDoneText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function PrivacyPoint({ text }: { text: string }) {
  const theme = useAppTheme();

  return (
    <View style={privacyPoint}>
      <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
      <Text style={[privacyPointText, { color: theme.mode === "dark" ? "#cbd5e1" : theme.muted }]}>{text}</Text>
    </View>
  );
}

const brandMark = {
  width: 72,
  height: 72,
  borderRadius: 24,
  backgroundColor: "#0f172a",
  borderWidth: 1,
  borderColor: "#1e293b",
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginBottom: 18,
  overflow: "hidden" as const,
  shadowColor: "#38bdf8",
  shadowOpacity: 0.16,
  shadowRadius: 18,
  elevation: 8,
};

const brandLogo = {
  width: 58,
  height: 58,
};

const eyebrow = {
  color: "#8b5cf6",
  fontSize: 15,
  fontWeight: "900" as const,
};

const title = {
  color: "white",
  fontSize: 44,
  fontWeight: "900" as const,
  marginTop: 8,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 10,
  fontSize: 16,
  lineHeight: 23,
};

const loginCard = {
  backgroundColor: "#0f172a",
  marginTop: 28,
  borderRadius: 30,
  padding: 22,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const cardHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  gap: 12,
  marginBottom: 20,
};

const cardTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
};

const cardSubtitle = {
  color: "#94a3b8",
  marginTop: 6,
  fontWeight: "700" as const,
};

const secureBadge = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
  backgroundColor: "#22c55e1f",
  borderWidth: 1,
  borderColor: "#22c55e55",
  paddingHorizontal: 10,
  paddingVertical: 7,
  borderRadius: 999,
};

const secureBadgeText = {
  color: "#86efac",
  fontWeight: "900" as const,
  fontSize: 12,
};

const inputShell = {
  backgroundColor: "#020617",
  padding: 16,
  borderRadius: 20,
  marginBottom: 14,
  borderWidth: 1,
  borderColor: "#1e293b",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
};

const inputText = {
  flex: 1,
  color: "white",
  fontSize: 16,
};

const passwordToggle = {
  width: 34,
  height: 34,
  borderRadius: 12,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const loginButton = {
  backgroundColor: "#7c3aed",
  padding: 17,
  borderRadius: 22,
  marginTop: 20,
  alignItems: "center" as const,
};

const buttonContent = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 10,
};

const loginButtonText = {
  color: "white",
  fontSize: 16,
  fontWeight: "900" as const,
};

const loginFooterRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
  marginTop: 13,
};

const privacyLink = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 5,
};

const privacyLinkText = {
  color: "#38bdf8",
  fontSize: 13,
  fontWeight: "900" as const,
};

const footerDot = {
  color: "#475569",
  fontWeight: "900" as const,
};

const footerText = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: "700" as const,
};

const savedAccountButtonLite = {
  alignSelf: "center" as const,
  marginTop: 18,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 999,
  backgroundColor: "#7c3aed1f",
};

const savedAccountTitleLite = {
  color: "#c4b5fd",
  fontWeight: "900" as const,
  fontSize: 14,
};

const modalTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
};

const modalHandle = {
  width: 48,
  height: 5,
  borderRadius: 999,
  backgroundColor: "#334155",
  alignSelf: "center" as const,
  marginBottom: 18,
};

const modalSubtitle = {
  color: "#94a3b8",
  marginTop: 6,
  marginBottom: 16,
  fontWeight: "700" as const,
};

const accountSheet = {
  backgroundColor: "#0f172a",
  padding: 22,
  paddingBottom: 28,
  borderTopLeftRadius: 34,
  borderTopRightRadius: 34,
  borderWidth: 1,
  borderColor: "#1e293b",
  maxHeight: "82%" as const,
};

const accountList = {
  maxHeight: 460,
};

const accountCard = {
  backgroundColor: "#020617",
  borderRadius: 22,
  padding: 16,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const accountMain = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 14,
};

const accountAvatar = {
  width: 48,
  height: 48,
  borderRadius: 18,
  backgroundColor: "#7c3aed22",
  borderWidth: 1,
  borderColor: "#7c3aed55",
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const accountInitials = {
  color: "#c4b5fd",
  fontSize: 16,
  fontWeight: "900" as const,
};

const accountName = {
  color: "white",
  fontWeight: "900" as const,
  fontSize: 16,
};

const accountMeta = {
  color: "#94a3b8",
  marginTop: 5,
  fontWeight: "700" as const,
};

const removeButton = {
  alignSelf: "flex-start" as const,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
  marginTop: 12,
  backgroundColor: "#ef44441f",
  borderWidth: 1,
  borderColor: "#ef444455",
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
};

const removeText = {
  color: "#f87171",
  fontWeight: "900" as const,
};

const privacyModal = {
  backgroundColor: "#0f172a",
  padding: 22,
  borderTopLeftRadius: 34,
  borderTopRightRadius: 34,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const privacyModalIcon = {
  width: 58,
  height: 58,
  borderRadius: 22,
  backgroundColor: "#0ea5e922",
  borderWidth: 1,
  borderColor: "#38bdf855",
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginBottom: 16,
};

const privacyModalTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
  marginBottom: 16,
};

const privacyPoint = {
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  gap: 10,
  marginBottom: 14,
};

const privacyPointText = {
  color: "#cbd5e1",
  flex: 1,
  lineHeight: 21,
  fontWeight: "700" as const,
};

const privacyDoneButton = {
  backgroundColor: "#7c3aed",
  padding: 16,
  borderRadius: 20,
  alignItems: "center" as const,
  marginTop: 8,
};

const privacyDoneText = {
  color: "white",
  fontSize: 16,
  fontWeight: "900" as const,
};

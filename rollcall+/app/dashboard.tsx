import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { AnimatedCircularProgress } from "react-native-circular-progress";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import BottomTabs from "../components/BottomTabs";
import DashboardSkeleton from "../components/DashboardSkeleton";
import { notifyAcademicChanges } from "../utils/academicNotifications";
import { registerBackgroundSync } from "../utils/backgroundSync";
import { registerForPushNotificationsAsync } from "../utils/notifications";
import { useAppStore } from "../store/useAppStore";
import { useAppTheme } from "../theme/useAppTheme";
import { LOGIN_URL, PUSH_TOKEN_URL } from "../utils/api";

function percentage(attended: number, total: number) {
  if (!total || total === 0) return 0;
  return Math.round((attended / total) * 100);
}

function getAttendanceColor(percent: number) {
  if (percent >= 85) return "#22c55e";
  if (percent >= 75) return "#84cc16";
  if (percent >= 65) return "#f97316";
  return "#ef4444";
}

type Subject = {
  name: string;
  attended: number;
  total: number;
};

export default function Dashboard() {
  const theme = useAppTheme();
  const student = useAppStore((state) => state.student);
  const subjects = useAppStore((state) => state.attendance);
  const result = useAppStore((state) => state.result);
  const results = useAppStore((state) => state.results);
  const password = useAppStore((state) => state.password);
  const setUserData = useAppStore((state) => state.setUserData);

  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState("Just now");

  useEffect(() => {
    registerBackgroundSync();
  }, []);

  useEffect(() => {
    async function syncPushToken() {
      if (!student?.rollNumber) return;

      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;

        await fetch(PUSH_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rollNumber: student.rollNumber,
            token,
            platform: "expo",
          }),
        });
      } catch (error) {
        console.log("Push token sync error:", error);
      }
    }

    syncPushToken();
  }, [student?.rollNumber]);

  const loadSavedUser = useCallback(async () => {
    try {
      const savedUser = await AsyncStorage.getItem("rollcall_user");

      if (!savedUser) {
        router.replace("/");
        return;
      }

      const parsedUser = JSON.parse(savedUser);

      setUserData({
        student: parsedUser.student || {
          name: "Student",
          rollNumber: parsedUser.rollNumber || "",
        },
        attendance: parsedUser.attendance || [],
        result: parsedUser.result || null,
        results: parsedUser.results || [],
        password: parsedUser.password || "",
      });
    } catch (error) {
      console.log("Dashboard session load error:", error);
      router.replace("/");
    }
  }, [setUserData]);

  useEffect(() => {
    if (!student) loadSavedUser();
  }, [student, loadSavedUser]);

  async function refreshAttendance() {
    if (!student?.rollNumber || !password) return;

    try {
      setRefreshing(true);

      const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rollNumber: student.rollNumber,
          password,
          forceRefresh: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log("Refresh failed:", {
          message: data?.message,
          requestId: data?.requestId || response.headers.get("X-Request-Id"),
        });
        return;
      }

      const newAttendance = data.attendance || [];
      const newResult = data.result || result;
      const newResults = data.results || results;
      const newStudent = data.student || student;

      await notifyAcademicChanges({
        oldAttendance: subjects,
        newAttendance,
        oldResult: result,
        newResult,
      });

      setUserData({
        student: newStudent,
        attendance: newAttendance,
        result: newResult,
        results: newResults,
        password,
      });

      await AsyncStorage.setItem(
        "rollcall_user",
        JSON.stringify({
          rollNumber: newStudent.rollNumber || student.rollNumber,
          password,
          student: newStudent,
          attendance: newAttendance,
          result: newResult,
          results: newResults,
          savedAt: new Date().toISOString(),
        })
      );

      setLastSync(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (error) {
      console.log("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }

  const totalAttended = useMemo(
    () => subjects.reduce((sum, s) => sum + (s.attended || 0), 0),
    [subjects]
  );

  const totalLectures = useMemo(
    () => subjects.reduce((sum, s) => sum + (s.total || 0), 0),
    [subjects]
  );

  const overall = percentage(totalAttended, totalLectures);
  const overallColor = getAttendanceColor(overall);

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? "Good Morning"
      : hour < 17
      ? "Good Afternoon"
      : "Good Evening";

  if (!student) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, backgroundColor: theme.dashboardBackground }}>
          <DashboardSkeleton />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.dashboardBackground }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAttendance}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
      >
        <View
          style={{
            paddingTop: 70,
            paddingHorizontal: 20,
            paddingBottom: 120,
          }}
        >
          <Animated.View
            entering={FadeInUp.duration(600)}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: theme.muted, fontSize: 15, fontWeight: "700" }}
              >
                {greeting}
              </Text>

              <Text
                style={{
                  color: theme.text,
                  fontSize: 30,
                  fontWeight: "900",
                  marginTop: 4,
                }}
                numberOfLines={1}
              >
                {student.name || "Student"}
              </Text>

              <Text style={{ color: theme.subtle, marginTop: 4 }}>
                Roll No: {student.rollNumber}
              </Text>
            </View>

          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(100).duration(650)}
            style={{
              backgroundColor: theme.surface,
              marginTop: 26,
              borderRadius: 32,
              padding: 22,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text
              style={{ color: theme.muted, fontSize: 16, fontWeight: "700" }}
            >
              Attendance Overview
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 24,
              }}
            >
              <AnimatedCircularProgress
                size={150}
                width={15}
                fill={overall}
                tintColor={overallColor}
                backgroundColor={theme.border}
                rotation={0}
                lineCap="round"
              >
                {() => (
                  <View style={{ alignItems: "center" }}>
                    <Text
                      style={{
                        color: theme.text,
                        fontSize: 34,
                        fontWeight: "900",
                      }}
                    >
                      {overall}%
                    </Text>

                    <Text
                      style={{
                        color: overallColor,
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      Present
                    </Text>
                  </View>
                )}
              </AnimatedCircularProgress>

              <View style={{ gap: 22 }}>
                <View>
                  <Text style={{ color: theme.subtle, fontWeight: "700" }}>
                    Classes Held
                  </Text>

                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 30,
                      fontWeight: "900",
                      marginTop: 2,
                    }}
                  >
                    {totalLectures}
                  </Text>
                </View>

                <View>
                  <Text style={{ color: theme.subtle, fontWeight: "700" }}>
                    Classes Attended
                  </Text>

                  <Text
                    style={{
                      color: "#22c55e",
                      fontSize: 30,
                      fontWeight: "900",
                      marginTop: 2,
                    }}
                  >
                    {totalAttended}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(650)}>
            <TouchableOpacity
              onPress={refreshAttendance}
              disabled={refreshing}
              style={{
                backgroundColor: "#7c3aed",
                borderRadius: 24,
                padding: 18,
                marginTop: 18,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: refreshing ? 0.85 : 1,
              }}
            >
              <View>
                <Text
                  style={{ color: "white", fontWeight: "900", fontSize: 16 }}
                >
                  {refreshing ? "Syncing..." : "Sync Now"}
                </Text>

                <Text style={{ color: "#ddd6fe", marginTop: 3 }}>
                  Last synced: {lastSync}
                </Text>
              </View>

              {refreshing ? (
                <ActivityIndicator color="white" />
              ) : (
                <Ionicons name="sync-outline" size={25} color="white" />
              )}
            </TouchableOpacity>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(280)}
            style={{
              color: theme.text,
              fontSize: 24,
              fontWeight: "900",
              marginTop: 34,
              marginBottom: 18,
            }}
          >
            Subjects
          </Animated.Text>

          {refreshing ? (
            <>
              <Text style={{ color: theme.muted, marginBottom: 16 }}>
                Refreshing latest attendance...
              </Text>

              {[1, 2, 3, 4].map((item) => (
                <Animated.View
                  key={item}
                  entering={FadeInDown.delay(item * 70)}
                  style={{
                    height: 86,
                    backgroundColor: theme.surface,
                    borderRadius: 24,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    opacity: 0.65,
                  }}
                />
              ))}
            </>
          ) : subjects.length === 0 ? (
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 24,
                padding: 22,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text
                style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}
              >
                No attendance found
              </Text>

              <Text style={{ color: theme.subtle, marginTop: 8, lineHeight: 20 }}>
                Pull down or tap Sync Now to refresh your latest attendance.
              </Text>
            </View>
          ) : (
            subjects.map((subject: Subject, index: number) => {
              const percent = percentage(subject.attended, subject.total);
              const color = getAttendanceColor(percent);

              return (
                <Animated.View
                  key={subject.name + index}
                  entering={FadeInDown.delay(index * 70).springify()}
                >
                  <TouchableOpacity
                    activeOpacity={0.86}
                    onPress={() =>
                      router.push({
                        pathname: "/subject-detail",
                        params: {
                          subject: JSON.stringify(subject),
                        },
                      })
                    }
                    style={{
                      backgroundColor: theme.surface,
                      borderRadius: 24,
                      padding: 18,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: theme.text,
                            fontSize: 17,
                            fontWeight: "800",
                          }}
                          numberOfLines={2}
                        >
                          {subject.name}
                        </Text>

                        <Text style={{ color: theme.subtle, marginTop: 6 }}>
                          {subject.attended} attended - {subject.total} total
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: color + "22",
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderRadius: 999,
                        }}
                      >
                        <Text
                          style={{
                            color,
                            fontWeight: "900",
                            fontSize: 17,
                          }}
                        >
                          {percent}%
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })
          )}
        </View>
      </ScrollView>

      <BottomTabs active="home" />
    </>
  );
}

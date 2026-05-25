import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";

import BottomTabs from "../components/BottomTabs";
import { useAppStore } from "../store/useAppStore";
import { useAppTheme } from "../theme/useAppTheme";

type HistoryItem = {
  date: string;
  status: string;
};

type Subject = {
  name: string;
  attended: number;
  missed: number;
  total: number;
  history?: HistoryItem[];
};

export default function TodayScreen() {
  const theme = useAppTheme();
  const subjects = useAppStore((state) => state.attendance) as Subject[];
  const student = useAppStore((state) => state.student);

  const today = new Date()
    .toLocaleDateString("en-GB")
    .replace(/\//g, "-");

  const todayData = subjects
    .map((subject) => {
      const history = subject.history || [];
      const latest = history[history.length - 1];

      if (latest && latest.date.includes(today)) {
        return {
          subject: subject.name,
          status: latest.status,
          date: latest.date,
        };
      }

      return null;
    })
    .filter(Boolean);

  const presentCount = todayData.filter(
    (item: any) => item.status === "PRESENT"
  ).length;

  const absentCount = todayData.filter(
    (item: any) => item.status === "ABSENT"
  ).length;
  const markedCount = todayData.length;
  const dailyStatus =
    markedCount === 0
      ? "Waiting for attendance"
      : absentCount > 0
      ? "Attendance needs attention"
      : "All marked classes are present";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ padding: 20, paddingTop: 68, paddingBottom: 120 }}>
          <Text style={[eyebrow, { color: theme.primary }]}>DAILY OVERVIEW</Text>

          <Text style={[title, { color: theme.text }]}>Today</Text>

          <Text style={[subtitle, { color: theme.muted }]}>Attendance activity for today</Text>

          <View style={[mainCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={[
                  statusIcon,
                  {
                    backgroundColor: absentCount > 0 ? theme.danger + "22" : theme.primarySoft,
                  },
                ]}
              >
                <Ionicons
                  name={absentCount > 0 ? "alert-circle-outline" : "calendar-outline"}
                  size={24}
                  color={absentCount > 0 ? theme.danger : theme.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[studentName, { color: theme.text }]}>{dailyStatus}</Text>
                <Text style={[dateText, { color: theme.subtle }]}>
                  {student?.name || "Student"} - {today}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <MiniCard title="Present" value={presentCount} color="#22c55e" />
              <MiniCard title="Absent" value={absentCount} color="#ef4444" />
              <MiniCard title="Marked" value={markedCount} color={theme.info} />
            </View>
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>Today Subjects</Text>

          {todayData.length === 0 ? (
            <View style={[emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[emptyText, { color: theme.muted }]}>
                No attendance is marked yet today. Check again after class or refresh from Home.
              </Text>
            </View>
          ) : (
            todayData.map((item: any, index) => {
              const isPresent = item.status === "PRESENT";

              return (
                <View key={index} style={[subjectCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[subjectName, { color: theme.text }]}>{item.subject}</Text>

                  <View
                    style={{
                      marginTop: 16,
                      alignSelf: "flex-start",
                      backgroundColor: isPresent ? "#22c55e22" : "#ef444422",
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: isPresent ? "#22c55e" : "#ef4444",
                    }}
                  >
                    <Text
                      style={{
                        color: isPresent ? "#22c55e" : "#ef4444",
                        fontWeight: "900",
                      }}
                    >
                      {item.status}
                    </Text>
                  </View>

                  <Text style={[itemDate, { color: theme.subtle }]}>{item.date}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <BottomTabs active="today" />
    </>
  );
}

function MiniCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  const theme = useAppTheme();

  return (
    <View style={[miniCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
      <Text style={[miniTitle, { color: theme.subtle }]}>{title}</Text>

      <Text style={{ color, fontSize: 30, fontWeight: "900", marginTop: 8 }}>
        {value}
      </Text>
    </View>
  );
}

const eyebrow = {
  color: "#38bdf8",
  fontSize: 14,
  fontWeight: "900" as const,
  letterSpacing: 1,
};

const title = {
  color: "white",
  fontSize: 38,
  fontWeight: "900" as const,
  marginTop: 6,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 8,
  fontSize: 16,
};

const mainCard = {
  backgroundColor: "#0f172a",
  padding: 24,
  borderRadius: 34,
  marginTop: 30,
  borderWidth: 1,
  borderColor: "#1e293b",
  shadowColor: "#38bdf8",
  shadowOpacity: 0.2,
  shadowRadius: 20,
  elevation: 10,
};

const studentName = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
};

const dateText = {
  color: "#64748b",
  marginTop: 8,
};

const sectionTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 34,
  marginBottom: 16,
};

const emptyCard = {
  backgroundColor: "#0f172a",
  padding: 28,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const emptyText = {
  color: "#94a3b8",
  textAlign: "center" as const,
  fontSize: 16,
};

const subjectCard = {
  backgroundColor: "#0f172a",
  padding: 22,
  borderRadius: 28,
  marginBottom: 14,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const subjectName = {
  color: "white",
  fontSize: 19,
  fontWeight: "900" as const,
};

const itemDate = {
  color: "#64748b",
  marginTop: 14,
};

const miniCard = {
  flex: 1,
  backgroundColor: "#111827",
  padding: 18,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const miniTitle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: "800" as const,
};

const statusIcon = {
  width: 50,
  height: 50,
  borderRadius: 18,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

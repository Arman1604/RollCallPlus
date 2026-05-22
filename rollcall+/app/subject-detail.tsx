import { Stack, router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../theme/useAppTheme";

type HistoryItem = {
  date: string;
  status: string;
};

type Subject = {
  name: string;
  present?: number;
  absent?: number;
  leave?: number;
  dutyLeave?: number;
  attended: number;
  missed: number;
  total: number;
  history?: HistoryItem[];
};

function percentage(attended: number, total: number) {
  if (!total || total === 0) return 0;
  return Math.round((attended / total) * 100);
}

function getColor(percent: number) {
  if (percent >= 85) return "#22c55e";
  if (percent >= 75) return "#84cc16";
  if (percent >= 65) return "#f97316";
  return "#ef4444";
}

function getLabel(percent: number) {
  if (percent >= 85) return "Excellent";
  if (percent >= 75) return "Safe";
  if (percent >= 65) return "Warning";
  return "Critical";
}

function getStatusColor(status: string) {
  if (status === "PRESENT") return "#22c55e";
  if (status === "DUTY LEAVE") return "#8b5cf6";
  if (status === "LEAVE") return "#f59e0b";
  return "#ef4444";
}

function getSafeMisses(subject: Subject) {
  return Math.max(
    0,
    Math.floor((subject.attended - 0.75 * subject.total) / 0.75)
  );
}

function getClassesNeeded(subject: Subject) {
  const percent = percentage(subject.attended, subject.total);
  if (percent >= 75) return 0;
  return Math.ceil((0.75 * subject.total - subject.attended) / 0.25);
}

export default function SubjectDetail() {
  const theme = useAppTheme();
  const params = useLocalSearchParams();

  const subject: Subject = params.subject
    ? JSON.parse(params.subject as string)
    : {
        name: "Subject",
        attended: 0,
        missed: 0,
        total: 0,
        history: [],
      };

  const percent = percentage(subject.attended, subject.total);
  const color = getColor(percent);

  const safeMisses = getSafeMisses(subject);
  const neededClasses = getClassesNeeded(subject);

  const nextMissPercent = Math.round(
    (subject.attended / (subject.total + 1)) * 100
  );

  const nextAttendPercent = Math.round(
    ((subject.attended + 1) / (subject.total + 1)) * 100
  );

  const history = (subject.history || []).slice().reverse();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#38bdf8", fontWeight: "900", fontSize: 16 }}>
              ← Back
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              color: theme.text,
              fontSize: 34,
              fontWeight: "900",
              marginTop: 24,
              lineHeight: 40,
            }}
          >
            {subject.name}
          </Text>

          <Text style={{ color: theme.muted, marginTop: 8, fontSize: 16 }}>
            Subject performance, history, and AI recovery simulation.
          </Text>

          <View
            style={{
              backgroundColor: theme.surface,
              padding: 24,
              borderRadius: 36,
              marginTop: 28,
              borderWidth: 1,
              borderColor: color,
              shadowColor: color,
              shadowOpacity: 0.25,
              shadowRadius: 18,
              elevation: 8,
            }}
          >
            <Text style={{ color: theme.muted, fontWeight: "800" }}>
              Attendance Status
            </Text>

            <Text
              style={{
                color,
                fontSize: 62,
                fontWeight: "900",
                marginTop: 6,
              }}
            >
              {percent}%
            </Text>

            <Text style={{ color: theme.mode === "dark" ? "#cbd5e1" : theme.muted, fontWeight: "900", fontSize: 17 }}>
              {getLabel(percent)}
            </Text>

            <View
              style={{
                height: 12,
                backgroundColor: theme.input,
                borderRadius: 999,
                marginTop: 18,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.min(percent, 100)}%`,
                  height: "100%",
                  backgroundColor: color,
                  borderRadius: 999,
                }}
              />
            </View>

            <Text style={{ color: theme.muted, marginTop: 16, lineHeight: 22 }}>
              {percent >= 75
                ? "This subject is currently safe. Maintain consistency to protect your margin."
                : "This subject needs recovery. Avoid missing upcoming lectures."}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
            <StatCard title="Attended" value={subject.attended} color="#22c55e" />
            <StatCard title="Missed" value={subject.missed} color="#ef4444" />
            <StatCard title="Total" value={subject.total} color="#38bdf8" />
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>AI Recovery Simulation</Text>

          <View style={[aiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <InfoRow
              label="Safe bunks remaining"
              value={`${safeMisses}`}
              color="#22c55e"
            />

            <InfoRow
              label="Classes needed for 75%"
              value={neededClasses === 0 ? "Already safe" : `${neededClasses}`}
              color={neededClasses === 0 ? "#22c55e" : "#ef4444"}
            />

            <InfoRow
              label="If you miss next class"
              value={`${nextMissPercent}%`}
              color="#ef4444"
            />

            <InfoRow
              label="If you attend next class"
              value={`${nextAttendPercent}%`}
              color="#22c55e"
            />
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>Lecture Breakdown</Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              title="Present"
              value={subject.present || subject.attended || 0}
              color="#22c55e"
            />

            <StatCard
              title="Leave"
              value={subject.leave || 0}
              color="#f59e0b"
            />

            <StatCard
              title="Duty"
              value={subject.dutyLeave || 0}
              color="#8b5cf6"
            />
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>Attendance History</Text>

          {history.length === 0 ? (
            <View style={[emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.muted, textAlign: "center" }}>
                No history available for this subject.
              </Text>
            </View>
          ) : (
            history.map((item, index) => (
              <View key={item.date + index} style={[historyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={{ color: theme.mode === "dark" ? "#e2e8f0" : theme.text, fontWeight: "800" }}>
                  {item.date}
                </Text>

                <View
                  style={{
                    backgroundColor: getStatusColor(item.status) + "22",
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: getStatusColor(item.status),
                  }}
                >
                  <Text
                    style={{
                      color: getStatusColor(item.status),
                      fontWeight: "900",
                    }}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}

function StatCard({
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
    <View
      style={{
        flex: 1,
        backgroundColor: theme.surface,
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ color: theme.subtle, fontSize: 13, fontWeight: "800" }}>
        {title}
      </Text>

      <Text style={{ color, fontSize: 25, fontWeight: "900", marginTop: 7 }}>
        {value}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <Text style={{ color: theme.subtle, fontWeight: "800", fontSize: 13 }}>
        {label}
      </Text>

      <Text style={{ color, fontSize: 19, fontWeight: "900", marginTop: 5 }}>
        {value}
      </Text>
    </View>
  );
}

const sectionTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 34,
  marginBottom: 16,
};

const aiCard = {
  backgroundColor: "#0f172a",
  paddingHorizontal: 20,
  paddingVertical: 8,
  borderRadius: 30,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const historyCard = {
  backgroundColor: "#0f172a",
  padding: 16,
  borderRadius: 22,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: "#1e293b",
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  gap: 12,
};

const emptyCard = {
  backgroundColor: "#0f172a",
  padding: 26,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: "#1e293b",
};

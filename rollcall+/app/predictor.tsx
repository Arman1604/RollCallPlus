import { Stack } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import BottomTabs from "../components/BottomTabs";
import { useAppStore } from "../store/useAppStore";
import { useAppTheme } from "../theme/useAppTheme";

type Subject = {
  name: string;
  attended: number;
  missed: number;
  total: number;
};

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

function getRiskScore(percent: number) {
  if (percent >= 85) return 10;
  if (percent >= 75) return 35;
  if (percent >= 65) return 70;
  return 95;
}

function getPriority(percent: number) {
  if (percent >= 85) return "Healthy";
  if (percent >= 75) return "Moderate";
  if (percent >= 65) return "High Priority";
  return "Critical";
}

function getTrend(percent: number) {
  if (percent >= 85) return "Stable Growth";
  if (percent >= 75) return "Slightly Unstable";
  if (percent >= 65) return "Recovery Required";
  return "Urgent Recovery";
}

function getClassesNeededFor75(subject: Subject) {
  if (percentage(subject.attended, subject.total) >= 75) return 0;
  return Math.ceil((0.75 * subject.total - subject.attended) / 0.25);
}

function getSafeMisses(subject: Subject) {
  return Math.max(
    0,
    Math.floor((subject.attended - 0.75 * subject.total) / 0.75)
  );
}

function getAIInsight(subject: Subject) {
  const percent = percentage(subject.attended, subject.total);
  const safeMisses = getSafeMisses(subject);
  const neededClasses = getClassesNeededFor75(subject);

  if (percent >= 85) {
    return {
      level: "Low Risk",
      confidence: "96%",
      mood: "Excellent",
      emoji: "🟢",
      advice:
        safeMisses > 0
          ? `Strong attendance. You can safely miss around ${safeMisses} class${
              safeMisses > 1 ? "es" : ""
            }, but staying consistent is better.`
          : "Strong attendance, but keep attending regularly to maintain your safe margin.",
    };
  }

  if (percent >= 75) {
    return {
      level: "Safe",
      confidence: "90%",
      mood: "Stable",
      emoji: "🟡",
      advice:
        safeMisses > 0
          ? `You are safe for now. You can miss ${safeMisses} class${
              safeMisses > 1 ? "es" : ""
            }, but avoid unnecessary bunks.`
          : "You are just above the safe zone. Avoid missing the next few lectures.",
    };
  }

  if (percent >= 65) {
    return {
      level: "Medium Risk",
      confidence: "88%",
      mood: "Warning",
      emoji: "🟠",
      advice: `Attend the next ${neededClasses} class${
        neededClasses > 1 ? "es" : ""
      } continuously to recover back to 75%.`,
    };
  }

  return {
    level: "High Risk",
    confidence: "94%",
    mood: "Critical",
    emoji: "🔴",
    advice: `This subject needs urgent focus. Attend at least the next ${neededClasses} class${
      neededClasses > 1 ? "es" : ""
    } to reach the safe zone.`,
  };
}

export default function Predictor() {
  const theme = useAppTheme();
  const subjects = useAppStore((state) => state.attendance) as Subject[];

  const validSubjects = subjects.filter((subject) => subject.total > 0);

  const dangerSubjects = validSubjects.filter(
    (subject) => percentage(subject.attended, subject.total) < 75
  );

  const safeSubjects = validSubjects.filter(
    (subject) => percentage(subject.attended, subject.total) >= 75
  );

  const averageAttendance =
    validSubjects.length === 0
      ? 0
      : Math.round(
          validSubjects.reduce(
            (sum, subject) =>
              sum + percentage(subject.attended, subject.total),
            0
          ) / validSubjects.length
        );

  const overallColor = getAttendanceColor(averageAttendance);

  const highestRiskSubject =
    validSubjects.length === 0
      ? null
      : [...validSubjects].sort(
          (a, b) =>
            percentage(a.attended, a.total) - percentage(b.attended, b.total)
        )[0];

  const bestSubject =
    validSubjects.length === 0
      ? null
      : [...validSubjects].sort(
          (a, b) =>
            percentage(b.attended, b.total) - percentage(a.attended, a.total)
        )[0];

  const disciplineScore =
    validSubjects.length === 0
      ? 0
      : Math.max(0, 100 - dangerSubjects.length * 12);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ padding: 20, paddingTop: 70, paddingBottom: 120 }}>
          <View style={blueGlow} />
          <View style={purpleGlow} />

          <Text style={eyebrow}>ROLLCALL+ INTELLIGENCE</Text>

          <Text style={[title, { color: theme.text }]}>AI Risk Engine</Text>

          <Text style={[subtitle, { color: theme.muted }]}>
            Smart bunk safety, recovery planning, risk score, and subject-wise
            attendance prediction.
          </Text>

          <View
            style={{
              backgroundColor: theme.surface,
              padding: 24,
              borderRadius: 34,
              marginTop: 28,
              borderWidth: 1,
              borderColor: overallColor,
              shadowColor: overallColor,
              shadowOpacity: 0.25,
              shadowRadius: 18,
              elevation: 8,
            }}
          >
            <Text style={[cardLabel, { color: theme.muted }]}>AI Health Score</Text>

            <Text
              style={{
                color: overallColor,
                fontSize: 52,
                fontWeight: "900",
                marginTop: 6,
              }}
            >
              {averageAttendance}%
            </Text>

            <View style={[progressTrack, { backgroundColor: theme.input }]}>
              <View
                style={{
                  width: `${Math.min(averageAttendance, 100)}%`,
                  height: "100%",
                  backgroundColor: overallColor,
                  borderRadius: 999,
                }}
              />
            </View>

            <Text style={[summaryText, { color: theme.mode === "dark" ? "#cbd5e1" : theme.muted }]}>
              {validSubjects.length === 0
                ? "No active subjects found yet. Once lectures begin, AI analysis will appear here."
                : dangerSubjects.length > 0
                ? `${dangerSubjects.length} subject${
                    dangerSubjects.length > 1 ? "s" : ""
                  } need attention. Focus on recovery before taking more bunks.`
                : "Your attendance is currently safe. Keep this consistency to stay above 75%."}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
            <MiniStat title="Active" value={validSubjects.length.toString()} />
            <MiniStat title="Safe" value={safeSubjects.length.toString()} />
            <MiniStat title="Risk" value={dangerSubjects.length.toString()} />
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>Semester AI Summary</Text>

          <View style={[summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SummaryRow
              title="Highest Risk"
              value={
                highestRiskSubject
                  ? `${highestRiskSubject.name} • ${percentage(
                      highestRiskSubject.attended,
                      highestRiskSubject.total
                    )}%`
                  : "Not available"
              }
            />

            <SummaryRow
              title="Best Subject"
              value={
                bestSubject
                  ? `${bestSubject.name} • ${percentage(
                      bestSubject.attended,
                      bestSubject.total
                    )}%`
                  : "Not available"
              }
            />

            <SummaryRow title="Discipline Score" value={`${disciplineScore}/100`} />

            <SummaryRow
              title="Recovery Status"
              value={
                dangerSubjects.length === 0
                  ? "Fully Safe"
                  : `${dangerSubjects.length} subject${
                      dangerSubjects.length > 1 ? "s" : ""
                    } need recovery`
              }
            />
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>AI Risk Analysis</Text>

          {dangerSubjects.length === 0 ? (
            <EmptyCard
              text={
                validSubjects.length === 0
                  ? "No active subjects found yet."
                  : "No risky subjects. You are doing great 🔥"
              }
            />
          ) : (
            dangerSubjects.map((subject, index) => (
              <PredictionCard
                key={subject.name + index}
                subject={subject}
                percent={percentage(subject.attended, subject.total)}
              />
            ))
          )}

          <Text style={[sectionTitle, { color: theme.text }]}>Safe Subjects</Text>

          {safeSubjects.length === 0 ? (
            <EmptyCard text="No safe subjects to show yet." />
          ) : (
            safeSubjects.map((subject, index) => (
              <PredictionCard
                key={subject.name + index}
                subject={subject}
                percent={percentage(subject.attended, subject.total)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <BottomTabs active="predictor" />
    </>
  );
}

function PredictionCard({
  subject,
  percent,
}: {
  subject: Subject;
  percent: number;
}) {
  const theme = useAppTheme();
  const color = getAttendanceColor(percent);
  const ai = getAIInsight(subject);

  const safeMisses = getSafeMisses(subject);
  const classesNeeded = getClassesNeededFor75(subject);

  const nextMissPercent = Math.round(
    (subject.attended / (subject.total + 1)) * 100
  );

  const nextAttendPercent = Math.round(
    ((subject.attended + 1) / (subject.total + 1)) * 100
  );

  const riskScore = getRiskScore(percent);
  const priority = getPriority(percent);
  const trend = getTrend(percent);

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        padding: 20,
        borderRadius: 30,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: color,
        shadowColor: color,
        shadowOpacity: 0.16,
        shadowRadius: 14,
        elevation: 5,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={[subjectName, { color: theme.text }]}>{subject.name}</Text>

          <Text style={[mutedText, { color: theme.subtle }]}>
            {subject.attended} attended • {subject.missed} missed •{" "}
            {subject.total} total
          </Text>
        </View>

        <View
          style={{
            backgroundColor: color + "22",
            borderColor: color,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text style={{ color, fontWeight: "900", fontSize: 17 }}>
            {percent}%
          </Text>
        </View>
      </View>

      <View style={[progressTrack, { backgroundColor: theme.input }]}>
        <View
          style={{
            width: `${Math.min(percent, 100)}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: 999,
          }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <SmallBox title="Risk" value={`${riskScore}/100`} color={color} />
        <SmallBox title="Priority" value={priority} color={color} />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <SmallBox title="Trend" value={trend} color={color} />
        <SmallBox
          title="Need"
          value={
            classesNeeded === 0
              ? "No recovery"
              : `${classesNeeded} class${classesNeeded > 1 ? "es" : ""}`
          }
          color={color}
        />
      </View>

      <View
        style={{
          backgroundColor: theme.input,
          padding: 16,
          borderRadius: 22,
          marginTop: 16,
          borderWidth: 1,
          borderColor: color,
        }}
      >
        <Text style={{ color, fontWeight: "900", fontSize: 15 }}>
          {ai.emoji} AI Analysis • {ai.confidence} confidence
        </Text>

        <Text style={[analysisTitle, { color: theme.text }]}>
          {ai.level} — {ai.mood}
        </Text>

        <Text style={[analysisText, { color: theme.mode === "dark" ? "#cbd5e1" : theme.muted }]}>{ai.advice}</Text>
      </View>

      <View
        style={{
          backgroundColor: color + "18",
          padding: 16,
          borderRadius: 22,
          marginTop: 14,
          borderWidth: 1,
          borderColor: color + "66",
        }}
      >
        <Text style={{ color, fontWeight: "900", fontSize: 15 }}>
          Smart Predictions
        </Text>

        <Text style={[predictionText, { color: theme.mode === "dark" ? "#cbd5e1" : theme.muted }]}>
          Safe bunks remaining:{" "}
          <Text style={[boldWhite, { color: theme.text }]}>{safeMisses}</Text>
        </Text>

        <Text style={[predictionText, { color: theme.mode === "dark" ? "#cbd5e1" : theme.muted }]}>
          If you miss next class:{" "}
          <Text style={{ color: "#ef4444", fontWeight: "900" }}>
            {nextMissPercent}%
          </Text>
        </Text>

        <Text style={[predictionText, { color: theme.mode === "dark" ? "#cbd5e1" : theme.muted }]}>
          If you attend next class:{" "}
          <Text style={{ color: "#22c55e", fontWeight: "900" }}>
            {nextAttendPercent}%
          </Text>
        </Text>
      </View>

      <View style={[recommendationBox, { backgroundColor: theme.input, borderColor: theme.border }]}>
        <Text style={{ color, fontWeight: "900" }}>Final Recommendation</Text>

        <Text style={[recommendationText, { color: theme.mode === "dark" ? "#e2e8f0" : theme.muted }]}>
          {percent >= 75
            ? safeMisses > 0
              ? `You may miss ${safeMisses} class${
                  safeMisses > 1 ? "es" : ""
                }, but attending regularly will keep your margin strong.`
              : "You are safe but have almost no bunk margin. Attend the next lectures."
            : `Do not miss upcoming lectures. Attend ${classesNeeded} class${
                classesNeeded > 1 ? "es" : ""
              } continuously to recover to 75%.`}
        </Text>
      </View>
    </View>
  );
}

function MiniStat({ title, value }: { title: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={[miniStat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[miniTitle, { color: theme.subtle }]}>{title}</Text>

      <Text style={[miniValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function SmallBox({
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
    <View style={[smallBox, { backgroundColor: theme.input, borderColor: theme.border }]}>
      <Text style={[smallTitle, { color: theme.subtle }]}>{title}</Text>

      <Text style={{ color, fontSize: 15, fontWeight: "900", marginTop: 6 }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SummaryRow({ title, value }: { title: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={[summaryRow, { borderBottomColor: theme.border }]}>
      <Text style={[summaryLabel, { color: theme.subtle }]}>{title}</Text>

      <Text style={[summaryValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  const theme = useAppTheme();

  return (
    <View style={[emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[emptyText, { color: theme.muted }]}>{text}</Text>
    </View>
  );
}

const blueGlow = {
  position: "absolute" as const,
  width: 260,
  height: 260,
  borderRadius: 130,
  backgroundColor: "#2563eb22",
  top: -80,
  right: -100,
};

const purpleGlow = {
  position: "absolute" as const,
  width: 220,
  height: 220,
  borderRadius: 110,
  backgroundColor: "#8b5cf622",
  top: 210,
  left: -120,
};

const eyebrow = {
  color: "#38bdf8",
  fontSize: 14,
  fontWeight: "900" as const,
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
  lineHeight: 23,
};

const cardLabel = {
  color: "#94a3b8",
  fontSize: 15,
  fontWeight: "800" as const,
};

const progressTrack = {
  height: 10,
  backgroundColor: "#020617",
  borderRadius: 999,
  marginTop: 16,
  overflow: "hidden" as const,
};

const summaryText = {
  color: "#cbd5e1",
  marginTop: 16,
  lineHeight: 22,
};

const sectionTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 32,
  marginBottom: 16,
};

const summaryCard = {
  backgroundColor: "#0f172a",
  paddingHorizontal: 20,
  paddingVertical: 8,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const subjectName = {
  color: "white",
  fontSize: 18,
  fontWeight: "900" as const,
  lineHeight: 24,
};

const mutedText = {
  color: "#64748b",
  marginTop: 8,
};

const analysisTitle = {
  color: "white",
  fontSize: 21,
  fontWeight: "900" as const,
  marginTop: 8,
};

const analysisText = {
  color: "#cbd5e1",
  marginTop: 8,
  lineHeight: 21,
};

const predictionText = {
  color: "#cbd5e1",
  marginTop: 9,
  lineHeight: 21,
};

const boldWhite = {
  color: "white",
  fontWeight: "900" as const,
};

const recommendationBox = {
  backgroundColor: "#020617",
  padding: 15,
  borderRadius: 20,
  marginTop: 14,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const recommendationText = {
  color: "#e2e8f0",
  marginTop: 6,
  lineHeight: 20,
};

const miniStat = {
  flex: 1,
  backgroundColor: "#0f172a",
  padding: 16,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const miniTitle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: "700" as const,
};

const miniValue = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 6,
};

const smallBox = {
  flex: 1,
  backgroundColor: "#020617",
  padding: 14,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const smallTitle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: "800" as const,
};

const summaryRow = {
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: "#1e293b",
};

const summaryLabel = {
  color: "#64748b",
  fontWeight: "800" as const,
  fontSize: 13,
};

const summaryValue = {
  color: "white",
  fontWeight: "900" as const,
  fontSize: 16,
  marginTop: 4,
};

const emptyCard = {
  backgroundColor: "#0f172a",
  padding: 26,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const emptyText = {
  color: "#94a3b8",
  textAlign: "center" as const,
  lineHeight: 22,
};

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
      advice: `Attend the next ${neededClasses} class${
        neededClasses > 1 ? "es" : ""
      } continuously to recover back to 75%.`,
    };
  }

  return {
    level: "High Risk",
    confidence: "94%",
    mood: "Critical",
    advice: `This subject needs urgent focus. Attend at least the next ${neededClasses} class${
      neededClasses > 1 ? "es" : ""
    } to reach the safe zone.`,
  };
}

export default function Predictor() {
  const theme = useAppTheme();
  const subjects = useAppStore((state) => state.attendance) as Subject[];

  const validSubjects = subjects.filter((subject) => subject.total > 0);
  const sortedSubjects = [...validSubjects].sort(
    (a, b) =>
      percentage(b.attended, b.total) - percentage(a.attended, a.total)
  );
  const rankedSubjects = sortedSubjects.slice(0, 6);

  const totalAttended = validSubjects.reduce(
    (sum, subject) => sum + (subject.attended || 0),
    0
  );
  const totalMissed = validSubjects.reduce(
    (sum, subject) => sum + (subject.missed || 0),
    0
  );
  const totalClasses = validSubjects.reduce(
    (sum, subject) => sum + (subject.total || 0),
    0
  );

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
      : [...sortedSubjects].reverse()[0];

  const bestSubject = validSubjects.length === 0 ? null : sortedSubjects[0];

  const disciplineScore =
    validSubjects.length === 0
      ? 0
      : Math.max(0, 100 - dangerSubjects.length * 12);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ padding: 20, paddingTop: 70, paddingBottom: 190 }}>

          <Text style={eyebrow}>ROLLCALL+ INTELLIGENCE</Text>

          <Text style={[title, { color: theme.text }]}>Attendance Predictor</Text>

          <Text style={[subtitle, { color: theme.muted }]}>
            Bunk safety, recovery planning, and subject-wise attendance risk.
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
            <Text style={[cardLabel, { color: theme.muted }]}>Health Score</Text>

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

          <View style={[actionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[cardLabel, { color: theme.muted }]}>Next Best Move</Text>

            <Text style={[actionTitle, { color: theme.text }]}>
              {validSubjects.length === 0
                ? "Sync attendance first"
                : highestRiskSubject && percentage(highestRiskSubject.attended, highestRiskSubject.total) < 75
                ? `Attend ${highestRiskSubject.name}`
                : "Keep your current rhythm"}
            </Text>

            <Text style={[actionText, { color: theme.mode === "dark" ? "#cbd5e1" : theme.muted }]}>
              {validSubjects.length === 0
                ? "Once your subjects load, RollCall+ will calculate your recovery plan."
                : highestRiskSubject && percentage(highestRiskSubject.attended, highestRiskSubject.total) < 75
                ? `${getClassesNeededFor75(highestRiskSubject)} continuous class${
                    getClassesNeededFor75(highestRiskSubject) === 1 ? "" : "es"
                  } can bring this subject back toward 75%.`
                : "No subject is below 75%. Avoid unnecessary misses to protect your margin."}
            </Text>
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>Semester Summary</Text>

          <View style={[summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SummaryRow
              title="Highest Risk"
              value={
                highestRiskSubject
                  ? `${highestRiskSubject.name} - ${percentage(
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
                  ? `${bestSubject.name} - ${percentage(
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

          <Text style={[sectionTitle, { color: theme.text }]}>Performance Analytics</Text>

          <View style={[analyticsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={analyticsHeader}>
              <View>
                <Text style={[cardLabel, { color: theme.muted }]}>Attendance Distribution</Text>
                <Text style={[analyticsTitle, { color: theme.text }]}>
                  {totalClasses > 0 ? `${totalClasses} total lectures` : "No lectures yet"}
                </Text>
              </View>

              <View style={[analyticsScorePill, { backgroundColor: overallColor + "22", borderColor: overallColor }]}>
                <Text style={{ color: overallColor, fontWeight: "900" }}>
                  {averageAttendance}%
                </Text>
              </View>
            </View>

            <View style={[splitBarTrack, { backgroundColor: theme.input }]}>
              <View
                style={{
                  width: `${totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0}%`,
                  backgroundColor: theme.success,
                  height: "100%",
                }}
              />
              <View
                style={{
                  flex: 1,
                  backgroundColor: totalMissed > 0 ? theme.danger : "transparent",
                  height: "100%",
                }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <AnalyticsMini title="Present" value={totalAttended.toString()} color={theme.success} />
              <AnalyticsMini title="Missed" value={totalMissed.toString()} color={theme.danger} />
            </View>
          </View>

          <View style={[summaryCard, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 14 }]}>
            {rankedSubjects.length === 0 ? (
              <Text style={[emptyText, { color: theme.muted, paddingVertical: 18 }]}>
                Subject analytics will appear after attendance sync.
              </Text>
            ) : (
              rankedSubjects.map((subject, index) => {
                const percent = percentage(subject.attended, subject.total);
                const color = getAttendanceColor(percent);

                return (
                  <View
                    key={subject.name + index}
                    style={[analyticsSubjectRow, { borderBottomColor: theme.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[analyticsSubjectName, { color: theme.text }]} numberOfLines={1}>
                        #{index + 1} {subject.name}
                      </Text>
                      <Text style={[mutedText, { color: theme.subtle }]}>
                        {subject.attended} present - {subject.missed} missed
                      </Text>
                    </View>

                    <Text style={{ color, fontWeight: "900", fontSize: 18 }}>
                      {percent}%
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          <Text style={[sectionTitle, { color: theme.text }]}>Risk Subjects</Text>

          {dangerSubjects.length === 0 ? (
            <EmptyCard
              text={
                validSubjects.length === 0
                  ? "No active subjects found yet."
                  : "No risky subjects. You are in the safe zone."
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
            {subject.attended} attended - {subject.missed} missed -{" "}
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
          Risk Analysis - {ai.confidence} confidence
        </Text>

        <Text style={[analysisTitle, { color: theme.text }]}>
          {ai.level} - {ai.mood}
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

function AnalyticsMini({
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
    <View style={[analyticsMini, { backgroundColor: theme.input, borderColor: theme.border }]}>
      <Text style={[smallTitle, { color: theme.subtle }]}>{title}</Text>
      <Text style={{ color, fontSize: 24, fontWeight: "900", marginTop: 6 }}>
        {value}
      </Text>
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

const actionCard = {
  padding: 18,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: "#1e293b",
  marginTop: 16,
};

const actionTitle = {
  fontSize: 20,
  lineHeight: 26,
  fontWeight: "900" as const,
  marginTop: 8,
};

const actionText = {
  marginTop: 8,
  lineHeight: 21,
};

const analyticsCard = {
  padding: 18,
  borderRadius: 28,
  borderWidth: 1,
};

const analyticsHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  gap: 12,
};

const analyticsTitle = {
  fontSize: 19,
  fontWeight: "900" as const,
  marginTop: 6,
};

const analyticsScorePill = {
  borderRadius: 999,
  borderWidth: 1,
  paddingHorizontal: 12,
  paddingVertical: 8,
};

const splitBarTrack = {
  height: 13,
  borderRadius: 999,
  overflow: "hidden" as const,
  flexDirection: "row" as const,
  marginTop: 18,
};

const analyticsMini = {
  flex: 1,
  borderRadius: 20,
  borderWidth: 1,
  padding: 14,
};

const analyticsSubjectRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  paddingVertical: 14,
  borderBottomWidth: 1,
};

const analyticsSubjectName = {
  fontSize: 16,
  fontWeight: "900" as const,
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
